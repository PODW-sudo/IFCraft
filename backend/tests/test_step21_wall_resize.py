import hashlib
import shutil
import sys
import tempfile
from pathlib import Path

import numpy as np
import pytest
from starlette.testclient import TestClient

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.app.main import app
import ifcopenshell
import ifcopenshell.util.unit

PROJECTS_DIR = Path(root_dir) / "storage" / "projects"
# `modelsfortests/Building-Architecture.ifc` is staged as deleted in this working tree; the
# byte-identical fixture lives in backend/app/samples (IFC4X3_ADD2, MILLI length unit).
MILLI_FIXTURE = Path(root_dir) / "backend" / "app" / "samples" / "building_architecture.ifc"
DUPLET_FIXTURE = Path(root_dir) / "modelsfortests" / "Ifc2x3_Duplex_Architecture.ifc"


def _model_path(project_id: str) -> Path:
    return PROJECTS_DIR / project_id / "model.ifc"


def _digest(project_id: str) -> str:
    return hashlib.sha256(_model_path(project_id).read_bytes()).hexdigest()


def _create_wall(client, project_id, height=3.0, thickness=0.25):
    res = client.post(
        f"/api/projects/{project_id}/cad/wall",
        json={
            "start": [0.0, 0.0],
            "end": [6.0, 0.0],
            "elevation": 0.0,
            "height": height,
            "thickness": thickness,
            "name": "AutoTest-step21-wall",
        },
    )
    assert res.status_code == 200, res.text
    return res.json()


def _body_solid(project_id: str, express_id: int):
    model = ifcopenshell.open(str(_model_path(project_id)))
    entity = model.by_id(express_id)
    for rep in entity.Representation.Representations:
        if rep.RepresentationIdentifier != "Body":
            continue
        assert len(rep.Items) == 1, [i.is_a() for i in rep.Items]
        return rep.Items[0], model
    raise AssertionError("no Body representation")


def _geom_extents(project_id: str, express_id: int):
    model = ifcopenshell.open(str(_model_path(project_id)))
    settings = ifcopenshell.geom.settings()
    settings.set("use-world-coords", True)
    shape = ifcopenshell.geom.create_shape(settings, model.by_id(express_id))
    verts = np.array(shape.geometry.verts).reshape(-1, 3)
    return verts.min(axis=0), verts.max(axis=0)


def _dimension(project_id: str, express_id: int, name: str):
    model = ifcopenshell.open(str(_model_path(project_id)))
    entity = model.by_id(express_id)
    for rel in getattr(entity, "IsDefinedBy", []):
        if not rel.is_a("IfcRelDefinesByProperties"):
            continue
        pdef = rel.RelatingPropertyDefinition
        if pdef.is_a("IfcPropertySet") and pdef.Name == "Dimensions":
            for prop in pdef.HasProperties:
                if prop.Name == name:
                    return prop.NominalValue.wrappedValue
    return None


@pytest.fixture()
def metre_project():
    with TestClient(app) as client:
        load = client.post("/api/projects/samples/office_pavilion/load")
        assert load.status_code == 201, load.text
        project_id = load.json()["id"]
        client.put(f"/api/projects/{project_id}", json={"name": "AutoTest-step21-metre"})
        try:
            yield client, project_id
        finally:
            client.delete(f"/api/projects/{project_id}")


@pytest.fixture()
def milli_project():
    """IFC4X3 sample with MILLI length unit (calculate_unit_scale -> 0.001)."""
    tmp = Path(tempfile.mkdtemp()) / "AutoTest-building-architecture.ifc"
    shutil.copy(MILLI_FIXTURE, tmp)
    with TestClient(app) as client:
        with open(tmp, "rb") as fh:
            res = client.post(
                "/api/projects/upload",
                files={"file": ("AutoTest-building-architecture.ifc", fh, "application/octet-stream")},
                data={"name": "AutoTest-step21-milli"},
            )
        assert res.status_code == 201, res.text
        project_id = res.json()["id"]
        try:
            yield client, project_id
        finally:
            client.delete(f"/api/projects/{project_id}")
            tmp.unlink(missing_ok=True)


def test_wall_height_change_changes_the_solid(metre_project):
    """Spec 1, 2, 4, 8: height must reach the extrusion, and the property must agree."""
    client, project_id = metre_project
    wall = _create_wall(client, project_id)
    wall_id = wall["express_id"]

    res = client.patch(
        f"/api/projects/{project_id}/cad/elements/{wall_id}/geometry",
        json={"height": 5.0},
    )
    assert res.status_code == 200, res.text

    solid, model = _body_solid(project_id, wall_id)
    assert solid.is_a("IfcExtrudedAreaSolid")
    assert solid.Depth == pytest.approx(5.0), (
        f"geometry unchanged: Depth is still {solid.Depth} while the panel says 5.0"
    )

    lo, hi = _geom_extents(project_id, wall_id)
    assert hi[2] - lo[2] == pytest.approx(5.0, abs=0.01), (lo, hi)

    assert _dimension(project_id, wall_id, "Height") == pytest.approx(5.0)


def test_wall_thickness_change_changes_the_profile(metre_project):
    """Spec 3: thickness must reach the swept profile."""
    client, project_id = metre_project
    wall = _create_wall(client, project_id)
    wall_id = wall["express_id"]

    res = client.patch(
        f"/api/projects/{project_id}/cad/elements/{wall_id}/geometry",
        json={"thickness": 0.4},
    )
    assert res.status_code == 200, res.text

    lo, hi = _geom_extents(project_id, wall_id)
    assert hi[1] - lo[1] == pytest.approx(0.4, abs=0.01), (lo, hi)


def test_millimetre_wall_height_is_converted(milli_project):
    """Spec 1, 9: Depth is in project units, not metres."""
    client, project_id = milli_project
    wall = _create_wall(client, project_id, height=3.0)
    wall_id = wall["express_id"]

    model = ifcopenshell.open(str(_model_path(project_id)))
    scale = ifcopenshell.util.unit.calculate_unit_scale(model)
    assert scale == pytest.approx(0.001), f"fixture is not millimetre: {scale}"

    solid, _ = _body_solid(project_id, wall_id)
    assert solid.Depth == pytest.approx(3000.0)

    res = client.patch(
        f"/api/projects/{project_id}/cad/elements/{wall_id}/geometry",
        json={"height": 5.0},
    )
    assert res.status_code == 200, res.text

    solid, _ = _body_solid(project_id, wall_id)
    assert solid.Depth == pytest.approx(5000.0), (
        f"Depth {solid.Depth} for a 5 m request in a millimetre model"
    )
    lo, hi = _geom_extents(project_id, wall_id)
    # ifcopenshell returns tessellated vertices in SI metres, so 5000 project units == 5.0 m.
    assert hi[2] - lo[2] == pytest.approx(5.0, abs=0.01)
    assert (hi[2] - lo[2]) / scale == pytest.approx(5000.0, abs=10.0)


def test_unsupported_wall_returns_409_and_does_not_write():
    """Spec 5: a face-based wall must refuse, not pretend."""
    tmp = Path(tempfile.mkdtemp()) / "AutoTest-duplex.ifc"
    shutil.copy(DUPLET_FIXTURE, tmp)
    with TestClient(app) as client:
        with open(tmp, "rb") as fh:
            res = client.post(
                "/api/projects/upload",
                files={"file": ("AutoTest-duplex.ifc", fh, "application/octet-stream")},
                data={"name": "AutoTest-step21-duplex"},
            )
        assert res.status_code == 201, res.text
        project_id = res.json()["id"]
        try:
            model = ifcopenshell.open(str(_model_path(project_id)))
            face_based = [
                w.id()
                for w in model.by_type("IfcWall")
                if w.Representation
                and any(
                    i.is_a("IfcFaceBasedSurfaceModel")
                    for r in w.Representation.Representations
                    if r.is_a("IfcShapeRepresentation")
                    for i in r.Items
                )
            ]
            assert face_based, "fixture no longer contains a face-based wall"
            wall_id = face_based[0]
            before = _digest(project_id)

            res = client.patch(
                f"/api/projects/{project_id}/cad/elements/{wall_id}/geometry",
                json={"height": 5.0},
            )

            assert res.status_code == 409, res.text
            assert res.json()["detail"]["code"] == "unsupported_geometry"
            assert _digest(project_id) == before, "a refused resize still modified the model"
        finally:
            client.delete(f"/api/projects/{project_id}")
            tmp.unlink(missing_ok=True)


def test_imported_extruded_wall_is_resizable(metre_project):
    """Spec 1: imported rectangle-profile walls resize too (duplex walls 3797/3999 shape)."""
    client, project_id = metre_project
    model = ifcopenshell.open(str(_model_path(project_id)))
    candidates = [
        w.id()
        for w in model.by_type("IfcWall")
        if w.Representation
        and any(
            i.is_a("IfcExtrudedAreaSolid")
            and i.ExtrudedDirection.DirectionRatios == (0.0, 0.0, 1.0)
            for r in w.Representation.Representations
            if r.is_a("IfcShapeRepresentation")
            for i in r.Items
        )
    ]
    if not candidates:
        pytest.skip("office_pavilion has no Z-extruded imported wall")

    wall_id = candidates[0]
    original, _ = _body_solid(project_id, wall_id)
    target = float(original.Depth) + 1.0

    res = client.patch(
        f"/api/projects/{project_id}/cad/elements/{wall_id}/geometry",
        json={"height": target},
    )
    assert res.status_code == 200, res.text

    solid, _ = _body_solid(project_id, wall_id)
    assert solid.Depth == pytest.approx(target)
