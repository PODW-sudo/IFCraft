import subprocess
import sys
import zlib
from pathlib import Path

import pytest
from starlette.testclient import TestClient

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.app.main import app
from backend.app.services.bcf_service import stable_audit_id
import ifcopenshell

PROJECTS_DIR = Path(root_dir) / "storage" / "projects"


def _model_path(project_id: str) -> Path:
    return PROJECTS_DIR / project_id / "model.ifc"


def _expected_id(transaction_id: str) -> int:
    return zlib.crc32(f"cad:{transaction_id}".encode("utf-8")) & 0x7FFFFFFF


@pytest.fixture()
def project():
    with TestClient(app) as client:
        load = client.post("/api/projects/samples/office_pavilion/load")
        assert load.status_code == 201, load.text
        project_id = load.json()["id"]
        client.put(f"/api/projects/{project_id}", json={"name": "AutoTest-step19-audit"})
        try:
            yield client, project_id
        finally:
            client.delete(f"/api/projects/{project_id}")


def _create_wall(client, project_id) -> dict:
    res = client.post(
        f"/api/projects/{project_id}/cad/wall",
        json={
            "start": [0.0, 0.0],
            "end": [5.0, 0.0],
            "elevation": 0.0,
            "height": 3.0,
            "thickness": 0.2,
            "name": "AutoTest-step19-wall",
        },
    )
    assert res.status_code == 200, res.text
    return res.json()


def test_timeline_ids_are_stable_and_pure(project):
    """Spec 1-4: IDs are crc32 of a namespaced key, not a salted hash."""
    client, project_id = project
    wall = _create_wall(client, project_id)

    first = client.get(f"/api/projects/{project_id}/audit/timeline").json()
    second = client.get(f"/api/projects/{project_id}/audit/timeline").json()

    ids_first = [item["id"] for item in first]
    ids_second = [item["id"] for item in second]
    assert ids_first == ids_second, "timeline IDs are not stable between calls"
    assert len(set(ids_first)) == len(ids_first), "duplicate timeline IDs"

    expected = _expected_id(wall["transaction_id"])
    assert expected in ids_first, (
        f"expected stable id {expected} for transaction {wall['transaction_id']}; "
        f"timeline ids were {ids_first} (hash()-derived ids are salted per process)"
    )

    # Cross-process proof: same value under a different PYTHONHASHSEED.
    code = (
        "import sys; sys.path.insert(0, r'%s');"
        "from backend.app.services.bcf_service import stable_audit_id;"
        "print(stable_audit_id('cad', '%s'))" % (root_dir, wall["transaction_id"])
    )
    env = {"PYTHONHASHSEED": "1", "SYSTEMROOT": "C:\\Windows", "PATH": ""}
    out = subprocess.run(
        [sys.executable, "-c", code], capture_output=True, text=True, env=env, timeout=120
    )
    assert out.returncode == 0, out.stderr
    assert int(out.stdout.strip()) == expected


def test_cad_delete_is_bucketed_as_deleted(project):
    """Spec 6, 7, 8: a deleted element must never appear in the 'added' bucket."""
    client, project_id = project
    wall = _create_wall(client, project_id)
    wall_id = wall["express_id"]

    after_create = client.get(f"/api/projects/{project_id}/audit/diff").json()
    assert wall_id in after_create["added"], after_create
    assert wall_id not in after_create["deleted"]

    dele = client.delete(f"/api/projects/{project_id}/cad/elements/{wall_id}")
    assert dele.status_code == 200, dele.text

    after_delete = client.get(f"/api/projects/{project_id}/audit/diff").json()
    assert wall_id in after_delete["deleted"], after_delete
    assert wall_id not in after_delete["added"], (
        f"deleted element #{wall_id} still reported as added: {after_delete}"
    )
    assert wall_id not in after_delete["modified"]

    buckets = [
        name for name in ("added", "modified", "deleted") if wall_id in after_delete[name]
    ]
    assert len(buckets) == 1, f"element #{wall_id} appears in {buckets}"


def test_undone_transaction_is_not_counted_as_state(project):
    """Spec 5, 8: an undone create leaves the diff and is flagged in the timeline."""
    client, project_id = project
    wall = _create_wall(client, project_id)
    wall_id = wall["express_id"]
    expected_id = _expected_id(wall["transaction_id"])

    timeline = client.get(f"/api/projects/{project_id}/audit/timeline").json()
    entry = next(i for i in timeline if i["id"] == expected_id)
    assert entry["status"] == "ACTIVE", entry
    assert entry["change_kind"] == "added", entry

    undo = client.post(f"/api/projects/{project_id}/cad/undo")
    assert undo.status_code == 200 and undo.json()["success"] is True, undo.text

    timeline = client.get(f"/api/projects/{project_id}/audit/timeline").json()
    entry = next(i for i in timeline if i["id"] == expected_id)
    assert entry["status"] == "UNDONE", entry

    diff = client.get(f"/api/projects/{project_id}/audit/diff").json()
    assert wall_id not in diff["added"], f"undone create still listed as added: {diff}"
    assert wall_id not in diff["modified"]


def test_move_is_modified_not_added(project):
    """Spec 6: transforms must not pollute the added bucket."""
    client, project_id = project
    wall = _create_wall(client, project_id)
    wall_id = wall["express_id"]

    move = client.post(
        f"/api/projects/{project_id}/cad/elements/{wall_id}/move",
        json={"delta": [1.0, 0.0, 0.0]},
    )
    assert move.status_code == 200, move.text

    diff = client.get(f"/api/projects/{project_id}/audit/diff").json()
    assert wall_id in diff["modified"], diff
    assert wall_id not in diff["deleted"]


def test_element_count_and_updated_at_track_cad_writes(project):
    """Spec 10, 11: F-023 — the project row must follow the model."""
    client, project_id = project
    before = client.get(f"/api/projects/{project_id}").json()
    baseline_count = len(
        ifcopenshell.open(str(_model_path(project_id))).by_type("IfcProduct")
    )
    assert before["element_count"] == baseline_count

    wall = _create_wall(client, project_id)
    after_create = client.get(f"/api/projects/{project_id}").json()
    on_disk = len(ifcopenshell.open(str(_model_path(project_id))).by_type("IfcProduct"))
    assert after_create["element_count"] == on_disk
    assert after_create["element_count"] == baseline_count + 1, (
        f"element_count is stale: {before['element_count']} -> "
        f"{after_create['element_count']} while the model grew by 1"
    )
    assert after_create["updated_at"] > before["updated_at"]

    client.delete(f"/api/projects/{project_id}/cad/elements/{wall['express_id']}")
    after_delete = client.get(f"/api/projects/{project_id}").json()
    assert after_delete["element_count"] == baseline_count
    assert after_delete["updated_at"] > after_create["updated_at"]
