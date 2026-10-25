"""1.2 (P2): creation and resize must agree on the unit convention.

`_create_box_mesh` relied on ifcopenshell's implicit default: `add_mesh_representation`
divides its input by the model unit scale (it assumes SI) and *writes project units*.
The resize branch passed project units (`/ unit_scale`), so on a MILLI model it divided
twice - measured with the installed ifcopenshell 0.9: 3000 project units in => 3,000,000
out => a 4 m column height became 4000 m. `_create_box_mesh` now pins `unit_scale=1.0`
and every caller passes project units explicitly, so creation and resize produce the
same file coordinates. Creation (which passed metres into the old implicit conversion)
was correct before; it still is.
"""
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
# IFC4X3_ADD2 sample whose length unit is MILLI (calculate_unit_scale -> 0.001).
MILLI_FIXTURE = Path(root_dir) / "backend" / "app" / "samples" / "building_architecture.ifc"


def _model_path(project_id: str) -> Path:
    return PROJECTS_DIR / project_id / "model.ifc"


def _world_bbox_m(project_id: str, express_id: int) -> tuple[np.ndarray, np.ndarray]:
    model = ifcopenshell.open(str(_model_path(project_id)))
    settings = ifcopenshell.geom.settings()
    settings.set("use-world-coords", True)
    shape = ifcopenshell.geom.create_shape(settings, model.by_id(express_id))
    verts = np.array(shape.geometry.verts, dtype=float).reshape(-1, 3)
    return verts.min(axis=0), verts.max(axis=0)


def _body_coord_spans(project_id: str, express_id: int) -> tuple[float, float, float]:
    """Raw Body mesh coordinate spans, in project units."""
    model = ifcopenshell.open(str(_model_path(project_id)))
    entity = model.by_id(express_id)
    coords = []
    for rep in entity.Representation.Representations:
        if rep.RepresentationIdentifier != "Body":
            continue
        for item in rep.Items:
            coords.extend(list(item.Coordinates.CoordList or []))
    assert coords, "Body has no mesh coordinates"
    xs = [float(c[0]) for c in coords]
    ys = [float(c[1]) for c in coords]
    zs = [float(c[2]) for c in coords]
    return max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)


@pytest.fixture()
def milli_project():
    assert MILLI_FIXTURE.is_file(), f"missing MILLI fixture: {MILLI_FIXTURE}"
    tmp = Path(tempfile.mkdtemp()) / "AutoTest-milli-creation.ifc"
    shutil.copy(MILLI_FIXTURE, tmp)
    with TestClient(app) as client:
        with open(tmp, "rb") as fh:
            res = client.post(
                "/api/projects/upload",
                files={"file": ("AutoTest-milli-creation.ifc", fh, "application/octet-stream")},
                data={"name": "AutoTest-milli-creation"},
            )
        assert res.status_code == 201, res.text
        project_id = res.json()["id"]
        try:
            model = ifcopenshell.open(str(_model_path(project_id)))
            assert ifcopenshell.util.unit.calculate_unit_scale(model) == pytest.approx(0.001), (
                "fixture is no longer a MILLI model"
            )
            yield client, project_id
        finally:
            client.delete(f"/api/projects/{project_id}")
            tmp.unlink(missing_ok=True)


def test_milli_column_creation_is_in_metres(milli_project):
    """A 3 m x 0.4 m x 0.4 m column on a MILLI model must measure 3 m, not 3 mm."""
    client, project_id = milli_project
    res = client.post(
        f"/api/projects/{project_id}/cad/column",
        json={
            "position": [1.0, 1.0],
            "elevation": 0.0,
            "height": 3.0,
            "width": 0.4,
            "depth": 0.4,
            "name": "AutoTest-milli-column",
        },
    )
    assert res.status_code == 200, res.text
    column_id = res.json()["express_id"]

    lo, hi = _world_bbox_m(project_id, column_id)
    span = hi - lo
    assert span == pytest.approx(np.array([0.4, 0.4, 3.0]), abs=1e-3), (
        f"MILLI column extents {span.tolist()} are not 0.4 x 0.4 x 3.0 m"
    )
    # Placement is SI too: the box is centred on (1.0, 1.0), not scaled to millimetres.
    assert lo[0] == pytest.approx(0.8, abs=1e-3), lo
    assert lo[1] == pytest.approx(0.8, abs=1e-3), lo
    assert lo[2] == pytest.approx(0.0, abs=1e-3), lo

    # The mesh itself carries project units (4000 mm, not 4).
    assert _body_coord_spans(project_id, column_id) == pytest.approx((400.0, 400.0, 3000.0))


def test_milli_slab_creation_is_in_metres(milli_project):
    """A 4 x 3 x 0.2 m slab on a MILLI model must measure 4 x 3 x 0.2 m."""
    client, project_id = milli_project
    res = client.post(
        f"/api/projects/{project_id}/cad/slab",
        json={
            "boundary": [[0.0, 0.0], [4.0, 0.0], [4.0, 3.0], [0.0, 3.0]],
            "elevation": 0.0,
            "thickness": 0.2,
            "name": "AutoTest-milli-slab",
        },
    )
    assert res.status_code == 200, res.text
    slab_id = res.json()["express_id"]

    lo, hi = _world_bbox_m(project_id, slab_id)
    span = hi - lo
    assert span == pytest.approx(np.array([4.0, 3.0, 0.2]), abs=1e-3), (
        f"MILLI slab extents {span.tolist()} are not 4 x 3 x 0.2 m"
    )
    assert _body_coord_spans(project_id, slab_id) == pytest.approx((4000.0, 3000.0, 200.0))


def test_milli_creation_and_resize_agree(milli_project):
    """Creation and the (already converted) resize branch must produce the same scale."""
    client, project_id = milli_project
    res = client.post(
        f"/api/projects/{project_id}/cad/column",
        json={
            "position": [0.0, 0.0],
            "elevation": 0.0,
            "height": 3.0,
            "width": 0.4,
            "depth": 0.4,
            "name": "AutoTest-milli-column-resize",
        },
    )
    assert res.status_code == 200, res.text
    column_id = res.json()["express_id"]

    patched = client.patch(
        f"/api/projects/{project_id}/cad/elements/{column_id}/geometry",
        json={"height": 4.0},
    )
    assert patched.status_code == 200, patched.text

    lo, hi = _world_bbox_m(project_id, column_id)
    assert (hi - lo) == pytest.approx(np.array([0.4, 0.4, 4.0]), abs=1e-3), (lo, hi)
    # The partial resize preserved the MILLI depth as well as converting the new height.
    assert _body_coord_spans(project_id, column_id) == pytest.approx((400.0, 400.0, 4000.0))
