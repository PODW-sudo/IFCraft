import sys
from pathlib import Path

import pytest
from starlette.testclient import TestClient

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.app.main import app
import ifcopenshell
import ifcopenshell.util.element

PROJECTS_DIR = Path(root_dir) / "storage" / "projects"


def _model_path(project_id: str) -> Path:
    return PROJECTS_DIR / project_id / "model.ifc"


def _storeys(project_id: str) -> dict[str, int]:
    model = ifcopenshell.open(str(_model_path(project_id)))
    return {s.Name: s.id() for s in model.by_type("IfcBuildingStorey")}


def _create_wall(client, project_id, storey_id, name):
    res = client.post(
        f"/api/projects/{project_id}/cad/wall",
        json={
            "start": [0.0, 0.0],
            "end": [4.0, 0.0],
            "elevation": 0.0,
            "height": 3.0,
            "thickness": 0.2,
            "storey_id": storey_id,
            "name": name,
        },
    )
    assert res.status_code == 200, res.text
    return res.json()


def _create_door(client, project_id, wall_id):
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


def _filling_of(project_id: str, opening_id: int):
    model = ifcopenshell.open(str(_model_path(project_id)))
    opening = model.by_id(opening_id)
    fillings = [
        rel.RelatedBuildingElement
        for rel in getattr(opening, "HasFillings", [])
        if rel.RelatedBuildingElement
    ]
    assert len(fillings) == 1, f"expected exactly one filling on #{opening_id}"
    return fillings[0], model


@pytest.fixture()
def two_storey_project():
    with TestClient(app) as client:
        load = client.post("/api/projects/samples/duplex_residential/load")
        assert load.status_code == 201, load.text
        project_id = load.json()["id"]
        client.put(f"/api/projects/{project_id}", json={"name": "AutoTest-step22-openings"})
        try:
            yield client, project_id
        finally:
            client.delete(f"/api/projects/{project_id}")


def test_opening_filling_uses_the_host_walls_storey(two_storey_project):
    """Spec 1, 2: a first-floor door belongs in the first floor."""
    client, project_id = two_storey_project
    storeys = _storeys(project_id)
    assert len(storeys) >= 2, storeys
    ground = storeys["Level 01 - Ground Floor"]
    upper = storeys["Level 02 - First Floor"]

    wall = _create_wall(client, project_id, upper, "AutoTest-step22-upper-wall")
    door = _create_door(client, project_id, wall["express_id"])

    filling, model = _filling_of(project_id, door["opening_express_id"])
    container = ifcopenshell.util.element.get_container(filling)

    assert container is not None, "filling has no spatial container"
    assert container.is_a("IfcBuildingStorey"), container.is_a()
    assert container.id() == upper, (
        f"door filed under {container.id()} ({container.Name}), "
        f"expected {upper} ({model.by_id(upper).Name}); ground floor is {ground}"
    )


def test_opening_storey_follows_each_wall(two_storey_project):
    """Spec 2: the two walls must not both land in storeys[0]."""
    client, project_id = two_storey_project
    storeys = _storeys(project_id)
    ground = storeys["Level 01 - Ground Floor"]
    upper = storeys["Level 02 - First Floor"]

    ground_wall = _create_wall(client, project_id, ground, "AutoTest-step22-ground-wall")
    upper_wall = _create_wall(client, project_id, upper, "AutoTest-step22-upper2-wall")

    ground_door = _create_door(client, project_id, ground_wall["express_id"])
    upper_door = _create_door(client, project_id, upper_wall["express_id"])

    # Hold both models alive: an IfcOpenShell entity_instance dangles (and crashes the
    # interpreter) once the model that owns it is garbage collected.
    ground_filling, ground_model = _filling_of(project_id, ground_door["opening_express_id"])
    upper_filling, upper_model = _filling_of(project_id, upper_door["opening_express_id"])

    assert ifcopenshell.util.element.get_container(ground_filling).id() == ground
    assert ifcopenshell.util.element.get_container(upper_filling).id() == upper
    assert ground != upper


def test_opening_is_not_spatially_contained(two_storey_project):
    """Spec 5: the void stays a feature of the wall, not a spatial member."""
    client, project_id = two_storey_project
    storeys = _storeys(project_id)
    wall = _create_wall(client, project_id, storeys["Level 02 - First Floor"], "AutoTest-step22-void-wall")
    door = _create_door(client, project_id, wall["express_id"])

    model = ifcopenshell.open(str(_model_path(project_id)))
    opening = model.by_id(door["opening_express_id"])
    containers = [
        rel.RelatingStructure.id()
        for rel in model.by_type("IfcRelContainedInSpatialStructure")
        for element in rel.RelatedElements
        if element.id() == opening.id()
    ]
    assert containers == [], f"opening was placed in a spatial container: {containers}"


def test_wall_without_container_falls_back(two_storey_project):
    """Spec 3: an uncontained wall must not raise; it falls back and warns."""
    client, project_id = two_storey_project
    storeys = _storeys(project_id)

    # Create a wall, then detach it from its storey to simulate an uncontained wall.
    wall = _create_wall(client, project_id, storeys["Level 02 - First Floor"], "AutoTest-step22-orphan-wall")
    path = _model_path(project_id)
    model = ifcopenshell.open(str(path))
    entity = model.by_id(wall["express_id"])
    for rel in list(model.by_type("IfcRelContainedInSpatialStructure")):
        if entity in rel.RelatedElements:
            remaining = [e for e in rel.RelatedElements if e.id() != entity.id()]
            if remaining:
                rel.RelatedElements = remaining
            else:
                model.remove(rel)
    model.write(str(path))

    door = _create_door(client, project_id, wall["express_id"])

    filling, model = _filling_of(project_id, door["opening_express_id"])
    container = ifcopenshell.util.element.get_container(filling)
    assert container is not None and container.is_a("IfcBuildingStorey"), (
        "fallback did not assign a storey"
    )
