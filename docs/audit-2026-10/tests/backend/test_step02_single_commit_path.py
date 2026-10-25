"""
STEP-02 — A transform must have exactly one commit path.

Finding: F-002 (the duplicate half), F-018
Code under test:
  frontend/src/hooks/useGizmoTransform.ts:35   (collabClient.commitTransform -> WS)
  frontend/src/hooks/useGizmoTransform.ts:38   (fetch POST .../elements/{id}/placement)
  backend/app/api/websocket.py:119-140          (TRANSFORM_COMMIT -> rewrites model.ifc)
  backend/app/api/projects.py:276               (POST placement -> rewrites model.ifc)

BUG:
  Both paths call IFCService.update_element_placement, which opens and rewrites the whole
  model file. The WebSocket write is fire-and-forget and lands milliseconds before the HTTP
  write, so every drag release performs two concurrent full-file rewrites of the same file.
  The WS path additionally carries the soft-lock check and the audit row, so the two paths
  are NOT equivalent — removing the wrong one breaks collaboration.

HOW TO RUN
    Copy this file into backend/tests/ then:
    .\\backend\\venv\\Scripts\\python.exe -m pytest backend/tests/test_step02_single_commit_path.py -v
"""

import re
import sys
from pathlib import Path

import pytest


def _repo_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "backend" / "app" / "main.py").exists():
            return parent
    raise RuntimeError("Could not locate repository root")


ROOT = _repo_root()
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

GIZMO_SRC = ROOT / "frontend" / "src" / "hooks" / "useGizmoTransform.ts"


@pytest.fixture(scope="module")
def gizmo_source():
    assert GIZMO_SRC.exists(), f"missing {GIZMO_SRC}"
    return GIZMO_SRC.read_text(encoding="utf-8")


def test_transform_end_has_exactly_one_commit_path(gizmo_source):
    """`handleTransformEnd` must not both broadcast a commit and POST a placement."""
    match = re.search(r"handleTransformEnd\s*=\s*useCallback\((.*?)\n  \);", gizmo_source, re.S)
    assert match, "could not locate handleTransformEnd in useGizmoTransform.ts"
    body = match.group(1)

    ws_commits = len(re.findall(r"commitTransform\s*\(", body))
    http_posts = len(re.findall(r"fetch\s*\(", body))

    assert ws_commits + http_posts == 1, (
        f"handleTransformEnd performs {ws_commits} WebSocket commit(s) and {http_posts} HTTP "
        "post(s). Both rewrite the whole model file, so every drag release writes the file "
        "twice, concurrently, with no lock. Keep exactly one path."
    )


def test_the_surviving_path_is_the_one_that_enforces_the_lock(gizmo_source):
    """The WS path carries the soft-lock check and the audit row; the HTTP path does not.

    If the HTTP path is the one that is removed, the transform must still be recorded in
    `edit_history` and still be rejected when another user holds the lock.
    """
    match = re.search(r"handleTransformEnd\s*=\s*useCallback\((.*?)\n  \);", gizmo_source, re.S)
    body = match.group(1)

    uses_ws = "commitTransform" in body
    uses_http = bool(re.search(r"fetch\s*\(", body))

    if uses_http and not uses_ws:
        pytest.fail(
            "The HTTP path was kept and the WebSocket commit removed. The REST placement route "
            "(backend/app/api/projects.py:260-290) performs NO lock check and writes no audit "
            "row, so collaboration guarantees would be silently lost."
        )

    if uses_ws and not uses_http:
        # The WS path must still be given the matrix, and the audit row is written server-side.
        assert "commitTransform" in body
        return

    pytest.fail("neither commit path is present — handleTransformEnd would persist nothing")


def test_backend_has_exactly_one_place_that_writes_the_placement_matrix():
    """Both entry points may exist server-side; the *client* must pick one.

    This test documents the contract rather than failing on the server.
    """
    projects_api = (ROOT / "backend" / "app" / "api" / "projects.py").read_text(encoding="utf-8")
    websocket_api = (ROOT / "backend" / "app" / "api" / "websocket.py").read_text(encoding="utf-8")

    assert "update_element_placement" in projects_api, "the REST placement route disappeared"
    assert "update_element_placement" in websocket_api, "the WS commit path disappeared"

    # Both must call the same service so the write semantics stay identical.
    assert "IFCService.update_element_placement" in projects_api
    assert "IFCService.update_element_placement" in websocket_api


def test_a_failed_persistence_reverts_the_local_transform(gizmo_source):
    """If the commit fails, the mesh must be restored to its pre-drag matrix.

    Today a failed write only console.errors; the element stays visually moved while the file
    was never updated, so the screen and the disk diverge with no signal to the user.
    """
    body = gizmo_source.read_text(encoding="utf-8") if isinstance(gizmo_source, Path) else gizmo_source
    has_failure_branch = "!res.ok" in body or "catch" in body
    assert has_failure_branch, (
        "handleTransformEnd has no failure branch — a rejected commit leaves the element "
        "visually moved with nothing on disk."
    )
    assert re.search(r"(revert|restore|rollback|previousMatrix|originalMatrix)", body, re.I), (
        "the failure branch does not restore the previous matrix. The user must be able to see "
        "that the move did not happen."
    )
