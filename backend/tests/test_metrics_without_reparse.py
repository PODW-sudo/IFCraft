"""audit 2.2 - a CAD write must not re-parse `model.ifc` just to refresh the metrics.

STEP-19 makes `ProjectService.refresh_project_metrics` the single writer of
`file_size` / `element_count` / `updated_at`, but it did so by opening and scanning the
whole model on *every* CAD write (73 ms on 12 elements, seconds on a 48 MB model - every
gizmo commit paid it).

The contract proved here:

* a write that cannot change the product count (transform, resize) neither parses nor
  touches `element_count`;
* a create/delete passes the count it already has from the model it just wrote;
* `file_size` and `updated_at` still move on every write;
* the real parse is still available (undo/redo), so the flag is not a global off switch.
"""

import sys
from pathlib import Path

import pytest
from starlette.testclient import TestClient

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.app.main import app
from backend.app.services.ifc_service import IFCService
import ifcopenshell

PROJECTS_DIR = Path(root_dir) / "storage" / "projects"


def _model_path(project_id: str) -> Path:
    return PROJECTS_DIR / project_id / "model.ifc"


def _product_count(project_id: str) -> int:
    return len(ifcopenshell.open(str(_model_path(project_id))).by_type("IfcProduct"))


@pytest.fixture()
def parses(monkeypatch) -> list[str]:
    """Record every `IFCService.validate_ifc` call (the model re-parse under test)."""
    calls: list[str] = []
    real = IFCService.validate_ifc

    def counting(file_path):
        calls.append(str(file_path))
        return real(file_path)

    monkeypatch.setattr(IFCService, "validate_ifc", staticmethod(counting))
    return calls


@pytest.fixture()
def project():
    with TestClient(app) as client:
        load = client.post("/api/projects/samples/office_pavilion/load")
        assert load.status_code == 201, load.text
        project_id = load.json()["id"]
        client.put(f"/api/projects/{project_id}", json={"name": "AutoTest-metrics-no-reparse"})
        try:
            yield client, project_id
        finally:
            client.delete(f"/api/projects/{project_id}")


def _create_wall(client, project_id, height=3.0) -> dict:
    res = client.post(
        f"/api/projects/{project_id}/cad/wall",
        json={
            "start": [0.0, 0.0],
            "end": [4.0, 0.0],
            "elevation": 0.0,
            "height": height,
            "thickness": 0.2,
            "name": "AutoTest-metrics-wall",
        },
    )
    assert res.status_code == 200, res.text
    return res.json()


def _row(client, project_id) -> dict:
    res = client.get(f"/api/projects/{project_id}")
    assert res.status_code == 200, res.text
    return res.json()


def test_transform_and_resize_do_not_parse_but_still_touch_the_row(project, parses):
    """A move and a resize must cost zero parses, while file_size/updated_at still move."""
    client, project_id = project
    wall = _create_wall(client, project_id)
    wall_id = wall["express_id"]

    # Warm-up: the create is covered by its own test; discard its calls.
    parses.clear()
    before = _row(client, project_id)

    move = client.post(
        f"/api/projects/{project_id}/cad/elements/{wall_id}/move",
        json={"delta": [1.0, 0.0, 0.0]},
    )
    assert move.status_code == 200, move.text

    resize = client.patch(
        f"/api/projects/{project_id}/cad/elements/{wall_id}/geometry",
        json={"height": 4.5},
    )
    assert resize.status_code == 200, resize.text

    assert parses == [], (
        "a transform and a resize re-parsed the model to refresh the metrics: " f"{parses}"
    )

    after = _row(client, project_id)
    assert after["element_count"] == before["element_count"], (
        "the count moved on a write that cannot add or remove a product: "
        f"{before['element_count']} -> {after['element_count']}"
    )
    assert after["element_count"] == _product_count(project_id)
    assert after["updated_at"] > before["updated_at"], "updated_at did not move on a CAD write"
    assert after["file_size"] == _model_path(project_id).stat().st_size


def test_create_and_delete_update_the_count_without_parsing(project, parses):
    """The count must come from the model just written, not from a second parse."""
    client, project_id = project
    baseline = _product_count(project_id)
    assert _row(client, project_id)["element_count"] == baseline

    parses.clear()
    before = _row(client, project_id)

    wall = _create_wall(client, project_id)
    assert parses == [], f"create_wall re-parsed the model for the metrics: {parses}"
    after_create = _row(client, project_id)
    assert after_create["element_count"] == baseline + 1, (
        "element_count is stale after a create: "
        f"{before['element_count']} -> {after_create['element_count']}"
    )
    assert after_create["element_count"] == _product_count(project_id)
    assert after_create["updated_at"] > before["updated_at"]
    assert after_create["file_size"] == _model_path(project_id).stat().st_size

    parses.clear()
    delete = client.delete(f"/api/projects/{project_id}/cad/elements/{wall['express_id']}")
    assert delete.status_code == 200, delete.text
    assert parses == [], f"delete_element re-parsed the model for the metrics: {parses}"
    after_delete = _row(client, project_id)
    assert after_delete["element_count"] == baseline
    assert after_delete["element_count"] == _product_count(project_id)
    assert after_delete["updated_at"] > after_create["updated_at"]


def test_clone_and_array_report_the_new_count_without_parsing(project, parses):
    """Paths that do add products pass the resulting count, still without a parse."""
    client, project_id = project
    wall = _create_wall(client, project_id)
    wall_id = wall["express_id"]
    baseline = _product_count(project_id)

    parses.clear()
    clone = client.post(
        f"/api/projects/{project_id}/cad/elements/{wall_id}/clone",
        json={"delta": [3.0, 0.0, 0.0]},
    )
    assert clone.status_code == 200, clone.text
    assert parses == [], f"clone_element re-parsed the model: {parses}"
    assert _row(client, project_id)["element_count"] == baseline + 1
    assert _row(client, project_id)["element_count"] == _product_count(project_id)

    parses.clear()
    array = client.post(
        f"/api/projects/{project_id}/cad/elements/{wall_id}/array",
        json={"count": 3, "delta": [0.0, 2.0, 0.0]},
    )
    assert array.status_code == 200, array.text
    assert parses == [], f"array_element re-parsed the model: {parses}"
    assert _row(client, project_id)["element_count"] == baseline + 3
    assert _row(client, project_id)["element_count"] == _product_count(project_id)


def test_undo_still_reconciles_with_a_real_parse(project, parses):
    """The full parse is still the fallback for a restore whose count is unknown."""
    client, project_id = project
    wall = _create_wall(client, project_id)

    delete = client.delete(f"/api/projects/{project_id}/cad/elements/{wall['express_id']}")
    assert delete.status_code == 200, delete.text

    parses.clear()
    undo = client.post(f"/api/projects/{project_id}/cad/undo")
    assert undo.status_code == 200, undo.text
    assert undo.json()["success"] is True, undo.text
    assert len(parses) == 1, f"undo should reconcile the metrics with one parse, saw {parses}"
    assert _row(client, project_id)["element_count"] == _product_count(project_id)
