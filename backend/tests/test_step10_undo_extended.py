"""audit 5.8 - every CAD/AI write must be reachable with Ctrl+Z.

STEP-10 gave the delete/create/transform paths `begin_snapshot -> write ->
record_transaction`. Four write paths were still outside that seam, so Ctrl+Z silently
skipped over them and undid an *older* action instead:

* `update_geometry` (a resize),
* `assign_storey`,
* `assign_material`,
* the AI copilot writes (`transform_element`, `update_property`, `generate_building`).

`pin_element` is deliberately **not** transacted: it is a database annotation plus a
non-geometric flag, and spending a whole-model pre-image on it would be wrong. That
choice is documented in `CADService.pin_element`; the test at the bottom pins the
behaviour so a later "make everything undoable" pass does not quietly change it.
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
import ifcopenshell.util.element
import ifcopenshell.util.placement

PROJECTS_DIR = Path(root_dir) / "storage" / "projects"


def _model_path(project_id: str) -> Path:
    return PROJECTS_DIR / project_id / "model.ifc"


def _create_wall(client, project_id, *, height=3.0, storey_id=None, elevation=0.0) -> int:
    payload = {
        "start": [0.0, 0.0],
        "end": [4.0, 0.0],
        "elevation": elevation,
        "height": height,
        "thickness": 0.2,
        "name": "AutoTest-undo-extended",
    }
    if storey_id is not None:
        payload["storey_id"] = storey_id
    res = client.post(f"/api/projects/{project_id}/cad/wall", json=payload)
    assert res.status_code == 200, res.text
    return res.json()["express_id"]


def _wall_depth(project_id: str, wall_id: int) -> float:
    model = ifcopenshell.open(str(_model_path(project_id)))
    wall = model.by_id(wall_id)
    for rep in wall.Representation.Representations:
        if rep.RepresentationIdentifier == "Body":
            return float(rep.Items[0].Depth)
    raise AssertionError("wall has no Body extrusion")


def _container_id(project_id: str, express_id: int):
    model = ifcopenshell.open(str(_model_path(project_id)))
    container = ifcopenshell.util.element.get_container(model.by_id(express_id))
    return container.id() if container is not None else None


def _dimension(project_id: str, express_id: int, name: str):
    """Value of Dimensions.<name> on an element, or None when the pset/property is absent."""
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


def _placement_x(project_id: str, express_id: int) -> float:
    model = ifcopenshell.open(str(_model_path(project_id)))
    matrix = ifcopenshell.util.placement.get_local_placement(
        model.by_id(express_id).ObjectPlacement
    )
    return float(matrix[0, 3])


def _undo(client, project_id) -> dict:
    res = client.post(f"/api/projects/{project_id}/cad/undo")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["success"] is True, body
    return body


@pytest.fixture()
def pavilion():
    with TestClient(app) as client:
        load = client.post("/api/projects/samples/office_pavilion/load")
        assert load.status_code == 201, load.text
        project_id = load.json()["id"]
        client.put(f"/api/projects/{project_id}", json={"name": "AutoTest-undo-extended"})
        try:
            yield client, project_id
        finally:
            client.delete(f"/api/projects/{project_id}")


@pytest.fixture()
def duplex():
    with TestClient(app) as client:
        load = client.post("/api/projects/samples/duplex_residential/load")
        assert load.status_code == 201, load.text
        project_id = load.json()["id"]
        client.put(f"/api/projects/{project_id}", json={"name": "AutoTest-undo-extended-duplex"})
        try:
            yield client, project_id
        finally:
            client.delete(f"/api/projects/{project_id}")


def test_ctrl_z_restores_a_resized_wall(pavilion):
    """Spec 1: a geometry edit is its own transaction, not an invisible write."""
    client, project_id = pavilion
    wall_id = _create_wall(client, project_id, height=3.0)
    assert _wall_depth(project_id, wall_id) == pytest.approx(3.0)

    resize = client.patch(
        f"/api/projects/{project_id}/cad/elements/{wall_id}/geometry",
        json={"height": 5.0},
    )
    assert resize.status_code == 200, resize.text
    assert _wall_depth(project_id, wall_id) == pytest.approx(5.0)

    undo = _undo(client, project_id)
    assert undo["action"] == "update_geometry", undo
    assert undo["affected_express_id"] == wall_id, undo
    assert _wall_depth(project_id, wall_id) == pytest.approx(3.0), (
        "Ctrl+Z did not restore the pre-resize height"
    )

    details = client.get(f"/api/projects/{project_id}/elements/{wall_id}")
    assert details.status_code == 200, details.text
    # The pre-image is restored as a whole, so the Dimensions.Height the resize wrote is gone
    # again (None) - and it must certainly not still read 5.0.
    height_property = _dimension(project_id, wall_id, "Height")
    assert height_property is None or height_property == pytest.approx(3.0), (
        f"the Dimensions.Height property still reads {height_property}"
    )


def test_ctrl_z_restores_an_elements_storey(duplex):
    """Spec 2: assign-storey is undoable instead of being skipped by Ctrl+Z."""
    client, project_id = duplex
    model = ifcopenshell.open(str(_model_path(project_id)))
    storeys = {storey.Name: storey.id() for storey in model.by_type("IfcBuildingStorey")}
    ground = storeys["Level 01 - Ground Floor"]
    upper = storeys["Level 02 - First Floor"]

    wall_id = _create_wall(client, project_id, storey_id=ground)
    assert _container_id(project_id, wall_id) == ground

    assign = client.post(
        f"/api/projects/{project_id}/cad/elements/{wall_id}/assign-storey",
        json={"storey_id": upper},
    )
    assert assign.status_code == 200, assign.text
    assert _container_id(project_id, wall_id) == upper

    undo = _undo(client, project_id)
    assert undo["action"] == "assign_storey", undo
    assert _container_id(project_id, wall_id) == ground, "Ctrl+Z did not restore the storey"


def test_ctrl_z_restores_material_assignment(pavilion):
    """Spec 3: a material/colour write is undoable too (it creates a model file otherwise)."""
    client, project_id = pavilion
    wall_id = _create_wall(client, project_id)

    def material_name() -> object:
        body = client.get(f"/api/projects/{project_id}/elements/{wall_id}").json()
        for pset in body.get("psets", []):
            if pset["name"] != "Materials":
                continue
            for prop in pset.get("properties", []):
                if prop["name"] == "MaterialName":
                    return prop["value"]
        return "<absent>"

    assert material_name() == "<absent>"
    assign = client.post(
        f"/api/projects/{project_id}/cad/elements/{wall_id}/material",
        json={"material_name": "Concrete", "color_hex": "#cccccc"},
    )
    assert assign.status_code == 200, assign.text
    assert material_name() == "Concrete"

    undo = _undo(client, project_id)
    assert undo["action"] == "assign_material", undo
    assert material_name() == "<absent>", "material assignment was not reverted"


def test_ctrl_z_restores_an_ai_transform(pavilion):
    """Spec 4: a confirmed copilot write is undoable like any other mutation."""
    client, project_id = pavilion
    wall_id = _create_wall(client, project_id)
    before_x = _placement_x(project_id, wall_id)

    chat = client.post(
        "/api/copilot/chat",
        json={
            "project_id": project_id,
            "provider": "local",
            "messages": [{"role": "user", "content": f"move element #{wall_id} by 1 meters on x"}],
            "confirm_writes": True,
        },
    )
    assert chat.status_code == 200, chat.text
    body = chat.json()
    assert body["project_updated"] is True, body
    assert [call["name"] for call in body["tool_calls"]] == ["transform_element"], body["tool_calls"]
    assert body["tool_calls"][0]["result"]["success"] is True, body["tool_calls"]

    moved_x = _placement_x(project_id, wall_id)
    assert moved_x == pytest.approx(before_x + 1.0, abs=1e-6), (
        f"copilot transform did not move the wall: {before_x} -> {moved_x}"
    )

    undo = _undo(client, project_id)
    assert undo["action"] == "ai_transform", undo
    assert _placement_x(project_id, wall_id) == pytest.approx(before_x, abs=1e-6), (
        "Ctrl+Z did not restore the pre-transform placement"
    )


def test_pinning_is_not_a_transaction(pavilion):
    """Spec 5: pinning is an annotation, so it must not consume an undo slot."""
    client, project_id = pavilion
    wall_id = _create_wall(client, project_id)
    before_x = _placement_x(project_id, wall_id)

    pin = client.post(
        f"/api/projects/{project_id}/cad/elements/{wall_id}/pin",
        json={"is_pinned": True},
    )
    assert pin.status_code == 200, pin.text
    assert client.get(f"/api/projects/{project_id}/cad/pinned").json()["pinned_ids"] == [wall_id]

    # The newest transaction is still the create_wall: undo removes the wall rather than
    # toggling the pin, which is what "pin is not transacted" means in practice.
    undo = _undo(client, project_id)
    assert undo["action"] == "create_wall", undo
    assert before_x == pytest.approx(before_x)
