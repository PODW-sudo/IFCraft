"""
STEP-07 — The AI copilot's generated building must match what it claims.

Finding: F-011 (and the related claims in ai_service.py:1382)
Code under test:
  backend/app/services/ai_service.py:772-794  (column generation)
  backend/app/services/ai_service.py:809-816  (result summary)
  backend/app/services/ai_service.py:1382      (the chat text)
  backend/tests/test_phase6.py:92              (the currently-red assertion)

SITUATION:
  `git blame` shows commit 580724b — a commit whose message is
  "feat(ui): implement Modern Glass Soft/Elegant UI layout" — changed the column layout from
  4 columns per storey to 2, so `backend/tests/test_phase6.py` now fails on master and CI is red.

  This step does NOT decide whether 4 or 8 columns is correct (that is a product decision).
  It pins the invariants that must hold either way:
    1. the number of columns is a deterministic function of (length, width);
    2. the chat text must not claim structural columns when none were generated;
    3. the reported element_count must equal the number of entities actually written.

HOW TO RUN
    Copy this file into backend/tests/ then:
    .\\backend\\venv\\Scripts\\python.exe -m pytest backend/tests/test_step07_column_count.py -v
"""

import json
import sys
from pathlib import Path

import pytest
from starlette.testclient import TestClient


def _repo_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "backend" / "app" / "main.py").exists():
            return parent
    raise RuntimeError("Could not locate repository root")


ROOT = _repo_root()
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.main import app  # noqa: E402
from backend.app.services.project_service import ProjectService  # noqa: E402
import ifcopenshell  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _create_project(client, name):
    res = client.post("/api/projects", json={"name": name, "schema_version": "IFC4"})
    assert res.status_code == 201, f"project creation failed: {res.text}"
    return res.json()["id"]


def _generate(client, project_id, message):
    res = client.post(
        "/api/copilot/chat",
        json={"project_id": project_id, "provider": "local", "messages": [{"role": "user", "content": message}]},
    )
    assert res.status_code == 200, f"chat failed: {res.status_code} {res.text}"
    data = res.json()
    assert data["tool_calls"], "no tool call was produced"
    return data


def _counts(project_id):
    model = ifcopenshell.open(str(ProjectService.get_project_file_path(project_id)))
    return {
        "walls": len(model.by_type("IfcWall")),
        "slabs": len(model.by_type("IfcSlab")),
        "columns": len(model.by_type("IfcColumn")),
        "storeys": len(model.by_type("IfcBuildingStorey")),
    }


def test_column_count_is_deterministic(client):
    """The same building spec must always produce the same number of columns.

    This holds regardless of whether the "correct" answer is 4 or 8 columns per storey.
    """
    results = []
    for index in range(2):
        project_id = _create_project(client, f"AutoTest-Step07-Determinism-{index}")
        try:
            data = _generate(client, project_id, "Please generate a 2-storey building 12m by 8m")
            call = data["tool_calls"][0]
            assert call["name"] == "generate_building", call
            results.append(_counts(project_id))
        finally:
            client.delete(f"/api/projects/{project_id}")

    assert results[0] == results[1], (
        f"two identical building generations produced different structures: {results[0]} vs "
        f"{results[1]}. The column grid must be a pure function of (length, width, storeys)."
    )


def test_summary_never_claims_columns_that_were_not_generated(client):
    """The copilot text must not promise columns when the building has none.

    A 4 m x 4 m building falls into neither branch of the current grid logic
    (ai_service.py:774-782) and therefore gets zero columns, yet the chat text at
    ai_service.py:1382 always says "complete with perimeter walls, floor slabs, and
    structural columns".
    """
    project_id = _create_project(client, "AutoTest-Step07-ClaimCheck")
    try:
        data = _generate(client, project_id, "Please generate a 1-storey building 4m by 4m")
        counts = _counts(project_id)

        call = data["tool_calls"][0]
        summary = (call.get("result") or {}).get("summary", "")
        raw_message = data.get("message")
        chat_message = raw_message if isinstance(raw_message, str) else json.dumps(raw_message)
        chat_message = chat_message or ""

        if counts["columns"] == 0:
            assert "column" not in summary.lower(), (
                f"the tool summary claims columns but the building has none: {summary!r}. "
                f"Counts: {counts}"
            )
            assert "column" not in chat_message.lower(), (
                f"the chat message claims columns but the building has none: {chat_message!r}. "
                f"Counts: {counts}"
            )
    finally:
        client.delete(f"/api/projects/{project_id}")


def test_reported_element_count_matches_the_model(client):
    """`element_count` must equal the number of elements actually written to the file."""
    project_id = _create_project(client, "AutoTest-Step07-CountMatch")
    try:
        data = _generate(client, project_id, "Please generate a 2-storey building 12m by 8m")
        call = data["tool_calls"][0]
        reported = (call.get("result") or {}).get("element_count")

        counts = _counts(project_id)
        actual = counts["walls"] + counts["slabs"] + counts["columns"]

        assert reported == actual, (
            f"the copilot reported {reported} elements but the file contains {actual} "
            f"({counts}). The count shown to the user must match the model."
        )
    finally:
        client.delete(f"/api/projects/{project_id}")


def test_a_building_below_the_column_threshold_is_documented(client):
    """The executor must record which behaviour is correct.

    The step's decision is: for a 12 m x 8 m building, is the expected column count 4 or 8?
    Whichever is chosen, the number must be a documented function of the dimensions — not an
    accident of a UI commit.

    This test asserts the *documentation* exists in the source as a named constant, so the
    grid is at least explicit and reviewable.
    """
    source = (ROOT / "backend" / "app" / "services" / "ai_service.py").read_text(encoding="utf-8")

    assert "col_positions" in source
    assert re_search(r"COLUMN_|_GRID|grid", source), (
        "the column grid is not expressed as a named, documented rule. Extract it into a "
        "module-level constant or helper so its behaviour is reviewable and testable."
    )


def re_search(pattern, text):
    import re
    return re.search(pattern, text)
