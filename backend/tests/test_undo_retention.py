"""2.3 (P2): pre-images and post-images must have separate snapshot budgets.

Pre-images (`undo/`) and redo post-images (`undo/post/`) used to share one 20-file /
200 MB budget, so every undone action evicted a pre-image: ~10 actions were undoable and
an older delete answered `success: false`. The budgets are now split (20 pre / 10 post),
so 20 undos still find their pre-images.
"""
import sys
from pathlib import Path

from starlette.testclient import TestClient

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.app.main import app
from backend.app.services.cad_service import CADService
import ifcopenshell

PROJECTS_DIR = Path(root_dir) / "storage" / "projects"


def _model_path(project_id: str) -> Path:
    return PROJECTS_DIR / project_id / "model.ifc"


def _snapshot_files(path: Path) -> list[Path]:
    return sorted(path.glob("*.ifc")) if path.is_dir() else []


def _entity_exists(project_id: str, express_id: int) -> bool:
    model = ifcopenshell.open(str(_model_path(project_id)))
    try:
        model.by_id(express_id)
        return True
    except Exception:
        return False


def _create_wall(client, project_id: str, name: str) -> int:
    res = client.post(
        f"/api/projects/{project_id}/cad/wall",
        json={
            "start": [0.0, 0.0],
            "end": [4.0, 0.0],
            "elevation": 0.0,
            "height": 3.0,
            "thickness": 0.2,
            "name": name,
        },
    )
    assert res.status_code == 200, res.text
    return res.json()["express_id"]


def test_separate_budgets_keep_twenty_actions_undoable():
    """26 mutations => 20 pre-images; 20 undos => still 20 pre-images, <=10 post-images."""
    assert CADService.UNDO_SNAPSHOT_MAX_FILES == 20
    assert CADService.UNDO_POST_MAX_FILES == 10

    with TestClient(app) as client:
        created = client.post(
            "/api/projects", json={"name": "AutoTest-undo-retention", "schema_version": "IFC4"}
        )
        assert created.status_code == 201, created.text
        project_id = created.json()["id"]
        undo_dir = PROJECTS_DIR / project_id / "undo"
        post_dir = undo_dir / CADService.UNDO_POST_SUBDIR

        try:
            # 26 mutations, with a delete at position 13 so it sits inside the last 20.
            victim_id = _create_wall(client, project_id, "RetentionVictim")
            mutation_count = 1
            for index in range(2, 13):
                _create_wall(client, project_id, f"RetentionWall{index}")
                mutation_count += 1

            deleted = client.delete(f"/api/projects/{project_id}/cad/elements/{victim_id}")
            assert deleted.status_code == 200, deleted.text
            mutation_count += 1
            assert not _entity_exists(project_id, victim_id)

            for index in range(14, 27):
                _create_wall(client, project_id, f"RetentionWall{index}")
                mutation_count += 1
            assert mutation_count == 26, mutation_count

            # Budget check before any undo: exactly 20 pre-images, and post-images
            # (created lazily on undo) do not exist yet.
            pre_files = _snapshot_files(undo_dir)
            assert len(pre_files) == 20, f"expected 20 pre-images, found {len(pre_files)}"
            assert sum(p.stat().st_size for p in pre_files) <= CADService.UNDO_SNAPSHOT_MAX_BYTES
            assert _snapshot_files(post_dir) == [], "post-images appeared before the first undo"

            # Twenty regrets must be twenty real restores (this was ~10 with a shared budget).
            for step in range(20):
                undone = client.post(f"/api/projects/{project_id}/cad/undo")
                assert undone.status_code == 200, (step, undone.text)
                assert undone.json()["success"] is True, (step, undone.json())

            # The delete was mutation 13, i.e. the 14th undo from the top: its pre-image
            # must still have existed for that restore.
            assert _entity_exists(project_id, victim_id) is True, (
                "undoing 20 actions did not reach the delete; pre-images were evicted"
            )

            # Each undo also kept a post-image, but only within its own 10-file / 100 MB budget.
            post_files = _snapshot_files(post_dir)
            assert len(post_files) <= CADService.UNDO_POST_MAX_FILES, len(post_files)
            assert sum(p.stat().st_size for p in post_files) <= CADService.UNDO_POST_MAX_BYTES

            # The pre-images were untouched by the undo storm (old code left 0 here).
            assert len(_snapshot_files(undo_dir)) == 20
        finally:
            assert client.delete(f"/api/projects/{project_id}").status_code == 204


def test_post_images_stay_out_of_the_pre_image_directory():
    """A single undo writes its post-image to undo/post/, never to undo/."""
    with TestClient(app) as client:
        created = client.post(
            "/api/projects", json={"name": "AutoTest-undo-postdir", "schema_version": "IFC4"}
        )
        assert created.status_code == 201, created.text
        project_id = created.json()["id"]
        undo_dir = PROJECTS_DIR / project_id / "undo"

        try:
            _create_wall(client, project_id, "PostDirWall")
            undone = client.post(f"/api/projects/{project_id}/cad/undo")
            assert undone.status_code == 200, undone.text
            assert undone.json()["success"] is True, undone.json()

            post_files = _snapshot_files(undo_dir / CADService.UNDO_POST_SUBDIR)
            assert len(post_files) == 1, post_files
            assert post_files[0].name.endswith(".ifc")
            assert not list(undo_dir.glob("*.post.ifc")), (
                "post-images must not be written beside the pre-images"
            )
        finally:
            assert client.delete(f"/api/projects/{project_id}").status_code == 204
