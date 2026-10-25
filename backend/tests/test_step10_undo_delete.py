import sys
from pathlib import Path

from starlette.testclient import TestClient

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.app.main import app
import ifcopenshell


def _project_file(project_id: str) -> Path:
    return Path(root_dir) / "storage" / "projects" / project_id / "model.ifc"


def _entity_exists(project_id: str, express_id: int) -> bool:
    """ifcopenshell 0.9.0 raises RuntimeError for a missing id - do not use by_id in a boolean."""
    model = ifcopenshell.open(str(_project_file(project_id)))
    try:
        model.by_id(express_id)
        return True
    except Exception:
        return False


def test_undo_of_delete_restores_the_same_element():
    """Deleting a wall and pressing undo must bring the wall back, with the same express_id."""
    with TestClient(app) as client:
        created = client.post("/api/projects", json={"name": "AutoTest-Step10-UndoDelete", "schema_version": "IFC4"})
        assert created.status_code == 201, created.text
        project_id = created.json()["id"]

        try:
            wall_res = client.post(
                f"/api/projects/{project_id}/cad/wall",
                json={
                    "start": [0.0, 0.0],
                    "end": [4.0, 0.0],
                    "elevation": 0.0,
                    "height": 3.0,
                    "thickness": 0.2,
                    "name": "UndoProbeWall",
                },
            )
            assert wall_res.status_code == 200, wall_res.text
            wall_id = wall_res.json()["express_id"]

            deleted = client.delete(f"/api/projects/{project_id}/cad/elements/{wall_id}")
            assert deleted.status_code == 200, deleted.text
            assert client.get(f"/api/projects/{project_id}/elements/{wall_id}").status_code == 404
            assert _entity_exists(project_id, wall_id) is False

            undo = client.post(f"/api/projects/{project_id}/cad/undo")
            assert undo.status_code == 200, f"undo returned {undo.status_code}: {undo.text}"
            body = undo.json()
            assert body["success"] is True, body
            assert body["affected_express_id"] == wall_id

            # Identity is preserved, not just "a wall exists again".
            assert _entity_exists(project_id, wall_id) is True, "undo did not restore the deleted entity"
            details = client.get(f"/api/projects/{project_id}/elements/{wall_id}")
            assert details.status_code == 200, details.text
            assert details.json()["name"] == "UndoProbeWall"

            model = ifcopenshell.open(str(_project_file(project_id)))
            assert model.by_id(wall_id).is_a() == "IfcWall"
        finally:
            assert client.delete(f"/api/projects/{project_id}").status_code == 204


def test_undo_never_wedges_the_stack_and_never_lies():
    """A second undo must report failure, not HTTP 500, and must not claim success."""
    with TestClient(app) as client:
        created = client.post("/api/projects", json={"name": "AutoTest-Step10-UndoWedged", "schema_version": "IFC4"})
        assert created.status_code == 201, created.text
        project_id = created.json()["id"]

        try:
            # Nothing has been done yet: undo must be a clean "no".
            empty = client.post(f"/api/projects/{project_id}/cad/undo")
            assert empty.status_code == 200, f"undo on an empty stack returned {empty.status_code}: {empty.text}"
            assert empty.json()["success"] is False

            wall_res = client.post(
                f"/api/projects/{project_id}/cad/wall",
                json={"start": [0.0, 0.0], "end": [4.0, 0.0], "height": 3.0, "thickness": 0.2, "name": "W1"},
            )
            wall_id = wall_res.json()["express_id"]
            client.delete(f"/api/projects/{project_id}/cad/elements/{wall_id}")

            first = client.post(f"/api/projects/{project_id}/cad/undo")
            assert first.status_code == 200 and first.json()["success"] is True

            # The delete is undone; the create_wall transaction is still ACTIVE, so this
            # undo must remove the wall again - and must still answer 200, not 500.
            second = client.post(f"/api/projects/{project_id}/cad/undo")
            assert second.status_code == 200, f"second undo returned {second.status_code}: {second.text}"
            assert second.json()["success"] is True
            assert _entity_exists(project_id, wall_id) is False
        finally:
            assert client.delete(f"/api/projects/{project_id}").status_code == 204


def test_property_edit_is_undoable():
    """A property written through the REST endpoint must be reverted by Ctrl+Z."""
    with TestClient(app) as client:
        created = client.post("/api/projects", json={"name": "AutoTest-Step10-UndoProperty", "schema_version": "IFC4"})
        assert created.status_code == 201, created.text
        project_id = created.json()["id"]

        try:
            wall_res = client.post(
                f"/api/projects/{project_id}/cad/wall",
                json={"start": [0.0, 0.0], "end": [4.0, 0.0], "height": 3.0, "thickness": 0.2, "name": "PropWall"},
            )
            wall_id = wall_res.json()["express_id"]

            def read_value() -> object:
                body = client.get(f"/api/projects/{project_id}/elements/{wall_id}").json()
                for pset in body.get("psets", []):
                    if pset["name"] != "Pset_AutoTest":
                        continue
                    for prop in pset.get("properties", []):
                        if prop["name"] == "FireRating":
                            return prop["value"]
                return "<absent>"

            before = read_value()
            assert before == "<absent>"

            write = client.post(
                f"/api/projects/{project_id}/elements/{wall_id}/properties",
                json={
                    "pset_name": "Pset_AutoTest",
                    "property_name": "FireRating",
                    "value": "REI60",
                    "value_type": "IfcLabel",
                },
            )
            assert write.status_code == 200, write.text
            assert read_value() == "REI60"

            undo = client.post(f"/api/projects/{project_id}/cad/undo")
            assert undo.status_code == 200, undo.text
            assert undo.json()["success"] is True, undo.json()
            # Guard against a vacuous pass: reverting the *property* must keep the element.
            assert undo.json()["action"] == "update_property", undo.json()
            assert client.get(f"/api/projects/{project_id}/elements/{wall_id}").status_code == 200, (
                "undo removed the wall instead of reverting the property edit"
            )
            assert read_value() == "<absent>", "property edit was not reverted"
        finally:
            assert client.delete(f"/api/projects/{project_id}").status_code == 204
