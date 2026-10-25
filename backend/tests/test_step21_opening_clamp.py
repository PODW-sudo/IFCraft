"""audit 1.4 - a host-wall resize must leave its openings valid.

STEP-21 made a wall resize edit the extrusion; it did not look at the voids in it. A wall
shortened below a door top kept the door's full depth, so the void stuck out of the wall
(invalid IFC, wrong in schedules, cuts and exports), and a thinned wall kept a void wider
than the wall.

Contract:

* shortening a wall below an opening's top clamps the opening's extrusion depth to the
  remaining height;
* thinning a wall below an opening's thickness clamps the void to the wall thickness;
* a resize that does not affect an opening returns `warnings: []`;
* an opening that cannot be clamped is reported in `warnings` and never fails the resize.
"""

import shutil
import sys
import tempfile
from pathlib import Path

import pytest
from starlette.testclient import TestClient

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.app.main import app
import ifcopenshell
import ifcopenshell.util.unit

PROJECTS_DIR = Path(root_dir) / "storage" / "projects"
MILLI_FIXTURE = Path(root_dir) / "backend" / "app" / "samples" / "building_architecture.ifc"


def _model_path(project_id: str) -> Path:
    return PROJECTS_DIR / project_id / "model.ifc"


def _create_wall(client, project_id, *, height=3.0, thickness=0.25) -> int:
    res = client.post(
        f"/api/projects/{project_id}/cad/wall",
        json={
            "start": [0.0, 0.0],
            "end": [4.0, 0.0],
            "elevation": 0.0,
            "height": height,
            "thickness": thickness,
            "name": "AutoTest-clamp-wall",
        },
    )
    assert res.status_code == 200, res.text
    return res.json()["express_id"]


def _create_door(client, project_id, wall_id, *, sill=0.0, height=2.1, width=0.9) -> dict:
    res = client.post(
        f"/api/projects/{project_id}/cad/opening",
        json={
            "host_wall_id": wall_id,
            "opening_type": "door",
            "offset_along_wall": 1.0,
            "sill_height": sill,
            "width": width,
            "height": height,
        },
    )
    assert res.status_code == 200, res.text
    return res.json()


def _opening_solid(project_id: str, opening_id: int):
    """(solid, model) for an opening's single Body extrusion."""
    model = ifcopenshell.open(str(_model_path(project_id)))
    opening = model.by_id(opening_id)
    for rep in opening.Representation.Representations:
        if rep.RepresentationIdentifier != "Body":
            continue
        assert len(rep.Items) == 1, [item.is_a() for item in rep.Items]
        return rep.Items[0], model
    raise AssertionError(f"opening #{opening_id} has no Body representation")


def _profile_y_span_units(solid) -> float:
    curve = solid.SweptArea.OuterCurve
    ys = [float(point[1]) for point in curve.Points.CoordList]
    return max(ys) - min(ys)


@pytest.fixture()
def project():
    with TestClient(app) as client:
        load = client.post("/api/projects/samples/office_pavilion/load")
        assert load.status_code == 201, load.text
        project_id = load.json()["id"]
        client.put(f"/api/projects/{project_id}", json={"name": "AutoTest-opening-clamp"})
        try:
            yield client, project_id
        finally:
            client.delete(f"/api/projects/{project_id}")


@pytest.fixture()
def milli_project():
    """IFC4X3 sample with MILLI length unit (calculate_unit_scale -> 0.001)."""
    tmp = Path(tempfile.mkdtemp()) / "AutoTest-clamp-milli.ifc"
    shutil.copy(MILLI_FIXTURE, tmp)
    with TestClient(app) as client:
        with open(tmp, "rb") as fh:
            res = client.post(
                "/api/projects/upload",
                files={"file": ("AutoTest-clamp-milli.ifc", fh, "application/octet-stream")},
                data={"name": "AutoTest-opening-clamp-milli"},
            )
        assert res.status_code == 201, res.text
        project_id = res.json()["id"]
        try:
            yield client, project_id
        finally:
            client.delete(f"/api/projects/{project_id}")
            tmp.unlink(missing_ok=True)


def test_shortening_a_wall_clamps_the_opening_depth(project):
    """Spec 1, 3: a 2.1 m door in a wall shortened to 1.5 m must end up 1.5 m tall."""
    client, project_id = project
    wall_id = _create_wall(client, project_id, height=3.0)
    door = _create_door(client, project_id, wall_id, height=2.1)

    solid_before, _ = _opening_solid(project_id, door["opening_express_id"])
    assert float(solid_before.Depth) == pytest.approx(2.1)

    res = client.patch(
        f"/api/projects/{project_id}/cad/elements/{wall_id}/geometry",
        json={"height": 1.5},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["success"] is True
    warnings = body["warnings"]
    assert warnings, "a clamped opening must be reported to the user"
    assert any("reduced to 1.500 m" in warning for warning in warnings), warnings

    solid_after, model = _opening_solid(project_id, door["opening_express_id"])
    assert float(solid_after.Depth) == pytest.approx(1.5), (
        f"opening still {solid_after.Depth} m tall inside a 1.5 m wall"
    )

    # The opening top must now be at or below the wall top (both measured from the wall base).
    import ifcopenshell.util.placement

    scale = ifcopenshell.util.unit.calculate_unit_scale(model)
    wall = model.by_id(wall_id)
    wall_top = (
        ifcopenshell.util.placement.get_local_placement(wall.ObjectPlacement)[2, 3]
        + float(wall.Representation.Representations[0].Items[0].Depth)
    )
    opening_base = ifcopenshell.util.placement.get_local_placement(
        model.by_id(door["opening_express_id"]).ObjectPlacement
    )[2, 3]
    opening_top = opening_base + float(solid_after.Depth)
    assert opening_top <= wall_top + 1e-6, (opening_top, wall_top, scale)


def test_thinning_a_wall_clamps_the_opening_thickness(project):
    """Spec 2: a 0.4 m void in a wall thinned to 0.2 m must be clamped."""
    client, project_id = project
    wall_id = _create_wall(client, project_id, thickness=0.25)
    door = _create_door(client, project_id, wall_id)

    solid_before, model_before = _opening_solid(project_id, door["opening_express_id"])
    scale = ifcopenshell.util.unit.calculate_unit_scale(model_before)
    assert _profile_y_span_units(solid_before) * scale == pytest.approx(0.4, abs=1e-6)

    res = client.patch(
        f"/api/projects/{project_id}/cad/elements/{wall_id}/geometry",
        json={"thickness": 0.2},
    )
    assert res.status_code == 200, res.text
    warnings = res.json()["warnings"]
    assert any("thick" in warning for warning in warnings), warnings

    solid_after, model_after = _opening_solid(project_id, door["opening_express_id"])
    scale = ifcopenshell.util.unit.calculate_unit_scale(model_after)
    thickness_m = _profile_y_span_units(solid_after) * scale
    assert thickness_m == pytest.approx(0.2, abs=1e-6), (
        f"void is still {thickness_m} m thick in a 0.2 m wall"
    )


def test_a_resize_that_fits_reports_no_warnings(project):
    """Spec 4: a taller wall keeps the door valid, so nothing is reported."""
    client, project_id = project
    wall_id = _create_wall(client, project_id, height=3.0)
    door = _create_door(client, project_id, wall_id, height=2.1)

    res = client.patch(
        f"/api/projects/{project_id}/cad/elements/{wall_id}/geometry",
        json={"height": 4.0},
    )
    assert res.status_code == 200, res.text
    assert res.json()["warnings"] == []

    solid, _ = _opening_solid(project_id, door["opening_express_id"])
    assert float(solid.Depth) == pytest.approx(2.1)


def test_an_opening_that_cannot_be_clamped_warns_instead_of_failing(project):
    """Spec 5: a void with no resizable body must not fail the wall resize."""
    client, project_id = project
    wall_id = _create_wall(client, project_id, height=3.0)
    door = _create_door(client, project_id, wall_id, height=2.1)

    # Break the void's representation behind the service's back: it now has no extrusion to
    # clamp, which is exactly the "imported oddity" case the best-effort path must survive.
    path = _model_path(project_id)
    model = ifcopenshell.open(str(path))
    model.by_id(door["opening_express_id"]).Representation = None
    model.write(str(path))

    res = client.patch(
        f"/api/projects/{project_id}/cad/elements/{wall_id}/geometry",
        json={"height": 1.5},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["success"] is True, "an unclampable opening failed the wall resize"
    assert any("not a single extruded void" in warning for warning in body["warnings"]), body

    wall_solid, _ = _opening_solid(project_id, wall_id)
    assert float(wall_solid.Depth) == pytest.approx(1.5), "the wall resize itself did not apply"


def test_millimetre_wall_clamps_the_opening_in_project_units(milli_project):
    """Spec 6: the clamp converts metres -> project units (2100 -> 1500, not 1.5)."""
    client, project_id = milli_project
    wall_id = _create_wall(client, project_id, height=3.0)
    door = _create_door(client, project_id, wall_id, height=2.1)

    solid_before, model = _opening_solid(project_id, door["opening_express_id"])
    assert ifcopenshell.util.unit.calculate_unit_scale(model) == pytest.approx(0.001)
    assert float(solid_before.Depth) == pytest.approx(2100.0)

    res = client.patch(
        f"/api/projects/{project_id}/cad/elements/{wall_id}/geometry",
        json={"height": 1.5},
    )
    assert res.status_code == 200, res.text
    assert res.json()["warnings"], res.json()

    solid_after, _ = _opening_solid(project_id, door["opening_express_id"])
    assert float(solid_after.Depth) == pytest.approx(1500.0), (
        f"millimetre void Depth is {solid_after.Depth}, expected 1500"
    )
