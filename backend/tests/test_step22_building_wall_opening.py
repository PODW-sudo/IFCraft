"""audit 1.6 - a wall assigned straight to the IfcBuilding must not be filed in storeys[0].

`get_container(wall)` returns an `IfcBuilding` when the wall was assigned to the building
instead of a storey (Revit exports and older API-created walls both do this). The
`is_a("IfcBuildingStorey")` guard in `create_opening` sent those walls to the fallback,
which is `storeys[0]` - wrong whenever the first storey is a basement.

Contract: the filling goes to the `IfcBuildingStorey` whose elevation is nearest the wall
base; `_get_target_storey` is only used when the model has no storey at all.
"""

import sys
from pathlib import Path

import pytest
from starlette.testclient import TestClient

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.app.main import app
import ifcopenshell
import ifcopenshell.api
import ifcopenshell.util.element
import ifcopenshell.util.placement

PROJECTS_DIR = Path(root_dir) / "storage" / "projects"


def _model_path(project_id: str) -> Path:
    return PROJECTS_DIR / project_id / "model.ifc"


def _create_wall(client, project_id, *, storey_id, elevation) -> int:
    res = client.post(
        f"/api/projects/{project_id}/cad/wall",
        json={
            "start": [0.0, 0.0],
            "end": [4.0, 0.0],
            "elevation": elevation,
            "height": 3.0,
            "thickness": 0.2,
            "storey_id": storey_id,
            "name": "AutoTest-building-wall",
        },
    )
    assert res.status_code == 200, res.text
    return res.json()["express_id"]


def _create_door(client, project_id, wall_id) -> dict:
    res = client.post(
        f"/api/projects/{project_id}/cad/opening",
        json={
            "host_wall_id": wall_id,
            "opening_type": "door",
            "offset_along_wall": 1.0,
            "sill_height": 0.0,
            "width": 0.9,
            "height": 2.1,
        },
    )
    assert res.status_code == 200, res.text
    return res.json()


@pytest.fixture()
def two_storey_project():
    with TestClient(app) as client:
        load = client.post("/api/projects/samples/duplex_residential/load")
        assert load.status_code == 201, load.text
        project_id = load.json()["id"]
        client.put(f"/api/projects/{project_id}", json={"name": "AutoTest-building-wall-opening"})
        try:
            yield client, project_id
        finally:
            client.delete(f"/api/projects/{project_id}")


def _storey_rows(project_id: str) -> list[tuple[int, str, float]]:
    """(express_id, name, global Z in project units) for every storey, lowest first."""
    model = ifcopenshell.open(str(_model_path(project_id)))
    rows = []
    for storey in model.by_type("IfcBuildingStorey"):
        placement = getattr(storey, "ObjectPlacement", None)
        z = (
            float(ifcopenshell.util.placement.get_local_placement(placement)[2, 3])
            if placement is not None
            else float(storey.Elevation or 0.0)
        )
        rows.append((storey.id(), str(storey.Name), z))
    rows.sort(key=lambda row: row[2])
    return rows


def _reassign_to_building(project_id: str, wall_id: int) -> int:
    """Move the wall out of its storey and into the IfcBuilding (the case under test)."""
    path = _model_path(project_id)
    model = ifcopenshell.open(str(path))
    wall = model.by_id(wall_id)
    building = model.by_type("IfcBuilding")[0]
    ifcopenshell.api.run("spatial.assign_container", model, relating_structure=building, products=[wall])
    model.write(str(path))
    return building.id()


def test_building_assigned_wall_files_its_door_in_the_nearest_storey(two_storey_project):
    """Spec 1, 2: an upper-floor wall contained in the building resolves to that storey."""
    client, project_id = two_storey_project
    storeys = _storey_rows(project_id)
    assert len(storeys) >= 2, storeys

    first_id, first_name, first_z = storeys[0]
    target_id, target_name, target_z = storeys[-1]
    assert target_id != first_id

    model_order = [
        storey.id()
        for storey in ifcopenshell.open(str(_model_path(project_id))).by_type("IfcBuildingStorey")
    ]
    assert model_order[0] != target_id, (
        "fixture no longer distinguishes the fix: storeys[0] is already the target storey"
    )

    # Create the wall in the upper storey (so its placement is at that elevation), then move
    # the containment up to the building: the wall now has no storey container at all.
    wall_id = _create_wall(client, project_id, storey_id=target_id, elevation=target_z)
    building_id = _reassign_to_building(project_id, wall_id)

    model = ifcopenshell.open(str(_model_path(project_id)))
    container = ifcopenshell.util.element.get_container(model.by_id(wall_id))
    assert container is not None and container.id() == building_id, (
        f"precondition: wall should be contained in the building, got {container}"
    )

    door = _create_door(client, project_id, wall_id)

    model = ifcopenshell.open(str(_model_path(project_id)))
    filling = model.by_id(door["express_id"])
    filed_in = ifcopenshell.util.element.get_container(filling)
    assert filed_in is not None and filed_in.is_a("IfcBuildingStorey"), filed_in
    assert filed_in.id() == target_id, (
        f"door filed under {filed_in.id()} ({filed_in.Name}); expected the nearest storey "
        f"{target_id} ({target_name}) - {first_id} ({first_name}) is the first storey, so the "
        "old storeys[0] fallback would pick the wrong one"
    )


def test_wall_at_the_first_storey_still_uses_it(two_storey_project):
    """Guard: nearest-elevation must not displace the ground floor for a ground-level wall."""
    client, project_id = two_storey_project
    storeys = _storey_rows(project_id)
    first_id, first_name, first_z = storeys[0]

    wall_id = _create_wall(client, project_id, storey_id=first_id, elevation=first_z)
    _reassign_to_building(project_id, wall_id)
    door = _create_door(client, project_id, wall_id)

    model = ifcopenshell.open(str(_model_path(project_id)))
    filed_in = ifcopenshell.util.element.get_container(model.by_id(door["express_id"]))
    assert filed_in is not None and filed_in.id() == first_id, (
        f"door filed under {filed_in.id() if filed_in else None}, expected {first_id} ({first_name})"
    )
