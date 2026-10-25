"""STEP-17 - Copilot intent matching + write confirmation.

Canonical tests from `docs/audit-2026-10/steps/STEP-17-copilot-intent-and-confirmation.md`.

Two classes of defect are covered:

* Intent matching: `"what is a house?"` generated a building, and `"remove element 5"`
  moved element 5, because both intents were decided by unanchored substring tests
  (F-013, F-047).
* Write safety: every tool call was executed immediately, and a failed tool produced no
  signal at all - the user was left with "Executing 1 tool operation(s)..." (F-025).
"""
import hashlib
import sys
from pathlib import Path

import pytest
from starlette.testclient import TestClient

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.app.main import app
from backend.app.services.ai_service import AIService
import ifcopenshell

PROJECTS_DIR = Path(root_dir) / "storage" / "projects"


def _model_path(project_id: str) -> Path:
    return PROJECTS_DIR / project_id / "model.ifc"


def _digest(project_id: str) -> str:
    return hashlib.sha256(_model_path(project_id).read_bytes()).hexdigest()


def _chat(client: TestClient, project_id: str, text: str, **extra):
    payload = {
        "project_id": project_id,
        "provider": "local",
        "messages": [{"role": "user", "content": text}],
    }
    payload.update(extra)
    res = client.post("/api/copilot/chat", json=payload)
    assert res.status_code == 200, res.text
    return res.json()


@pytest.fixture()
def project():
    """An AutoTest- project loaded from a bundled sample, cleaned up afterwards."""
    with TestClient(app) as client:
        load = client.post("/api/projects/samples/office_pavilion/load")
        assert load.status_code == 201, load.text
        project_id = load.json()["id"]
        client.put(f"/api/projects/{project_id}", json={"name": "AutoTest-step17-copilot"})
        try:
            yield client, project_id
        finally:
            client.delete(f"/api/projects/{project_id}")


def test_interrogative_never_writes(project):
    """Spec 1 and 2: 'what is a house?' must not touch the model."""
    client, project_id = project
    before = _digest(project_id)

    data = _chat(client, project_id, "what is a house?", confirm_writes=True)

    assert data["tool_calls"] == [], data["tool_calls"]
    assert data["project_updated"] is False
    assert _digest(project_id) == before


def test_remove_is_not_move(project):
    """Spec 3 and 4: 'remove' must not match 'move'; no transform may run."""
    client, project_id = project
    model = ifcopenshell.open(str(_model_path(project_id)))
    wall_id = model.by_type("IfcWall")[0].id()
    before = _digest(project_id)

    data = _chat(client, project_id, f"remove element #{wall_id}", confirm_writes=True)

    names = [c["name"] for c in data["tool_calls"]]
    assert "transform_element" not in names, names
    assert data["project_updated"] is False
    assert _digest(project_id) == before
    assert "delet" in data["message"]["content"].lower()


def test_write_is_withheld_without_confirmation(project):
    """Spec 5, 6: an unconfirmed write is described, not executed."""
    client, project_id = project
    before = _digest(project_id)

    data = _chat(client, project_id, "generate a 1-storey building 6m by 5m")

    assert data["requires_confirmation"] is True, data
    assert data["project_updated"] is False
    assert data["tool_calls"] == []
    assert [p["name"] for p in data["pending_tool_calls"]] == ["generate_building"]
    assert data["pending_tool_calls"][0]["arguments"]["num_storeys"] == 1
    assert _digest(project_id) == before, "model was written before confirmation"


def test_write_executes_once_when_confirmed(project):
    """Spec 7: the confirmed request performs exactly one write."""
    client, project_id = project
    before_walls = len(ifcopenshell.open(str(_model_path(project_id))).by_type("IfcWall"))

    data = _chat(
        client, project_id, "generate a 1-storey building 6m by 5m", confirm_writes=True
    )

    assert data["requires_confirmation"] is False
    assert data["project_updated"] is True, data
    assert len(data["tool_calls"]) == 1
    assert data["tool_calls"][0]["name"] == "generate_building"
    assert data["tool_calls"][0]["result"]["success"] is True

    after_walls = len(ifcopenshell.open(str(_model_path(project_id))).by_type("IfcWall"))
    assert after_walls > before_walls


def test_read_tool_runs_without_confirmation(project):
    """Spec 8: query_model is not gated."""
    client, project_id = project
    data = _chat(client, project_id, "how many walls are in the model")
    assert data["requires_confirmation"] is False
    assert [c["name"] for c in data["tool_calls"]] == ["query_model"]
    assert data["tool_calls"][0]["result"]["success"] is True


def test_failed_tool_is_surfaced(project):
    """Spec 9: a failed write must not read as success."""
    client, project_id = project
    data = _chat(
        client, project_id, "move element #999999 by 1 meter on x", confirm_writes=True
    )

    assert data["project_updated"] is False
    assert data["errors"], "a failed tool produced no error signal"
    assert data["errors"][0]["tool"] == "transform_element"
    assert "999999" in data["errors"][0]["message"]
    content = data["message"]["content"].lower()
    assert "transform_element" in content or "999999" in content
    assert "executing 1 tool operation" not in content


def test_tool_results_are_fed_back_to_the_model(project, monkeypatch):
    """Spec 10: exactly one follow-up provider round carries the tool result."""
    client, project_id = project
    calls: list[list[dict]] = []

    async def fake_call(*args, **kwargs):
        messages = args[2] if len(args) > 2 else kwargs["messages"]
        calls.append(messages)
        if len(calls) == 1:
            return "", [
                {"id": "call_1", "name": "query_model",
                 "arguments": {"query_type": "count_by_type", "filters": {"ifc_class": "IfcWall"}}}
            ]
        return "The model contains the requested walls.", []

    monkeypatch.setattr(AIService, "_call_openai", fake_call)

    data = _chat(client, project_id, "count the walls", provider="openai", api_key="test-key")

    assert len(calls) == 2, f"expected one follow-up round, saw {len(calls)} provider calls"
    assert data["message"]["content"] == "The model contains the requested walls."
    assert any(m.get("role") == "tool" for m in calls[1]), (
        "the tool result was never appended to the conversation"
    )


def test_provider_rounds_are_capped(project, monkeypatch):
    """Spec 10 (upper bound): a model that keeps asking for tools cannot loop forever."""
    client, project_id = project
    calls: list[list[dict]] = []

    async def fake_call(*args, **kwargs):
        messages = args[2] if len(args) > 2 else kwargs["messages"]
        calls.append(messages)
        return "", [
            {"id": f"call_{len(calls)}", "name": "query_model",
             "arguments": {"query_type": "count_by_type", "filters": {"ifc_class": "IfcWall"}}}
        ]

    monkeypatch.setattr(AIService, "_call_openai", fake_call)

    data = _chat(client, project_id, "count the walls", provider="openai", api_key="test-key")

    from backend.app.services.ai_service import MAX_TOOL_ROUNDS

    assert len(calls) == MAX_TOOL_ROUNDS, f"MAX_TOOL_ROUNDS is not enforced, saw {len(calls)} calls"
    assert data["requires_confirmation"] is False


@pytest.mark.parametrize(
    "text, interrogative, building, transform, delete",
    [
        ("what is a house?", True, False, False, False),
        ("is a pavilion a building?", True, False, False, False),
        ("how many walls are in the model", True, False, False, False),
        ("generate a 1-storey building 6m by 5m", False, True, False, False),
        ("could you add a 2 storey house?", True, False, False, False),
        ("make me a tower", False, True, False, False),
        ("move element 5 by 2 meters on x", False, False, True, False),
        ("remove element 5", False, False, False, True),
        ("delete element 5", False, False, False, True),
        ("translate element 5 up", False, False, True, False),
        ("rotate element 5 by 45 degrees", False, False, True, False),
    ],
)
def test_intent_matching_table(text, interrogative, building, transform, delete):
    """Spec 1-4 as a table: the matcher is the single place intent is decided."""
    from backend.app.services.ai_service import (
        DELETE_VERBS,
        TRANSFORM_VERBS,
        _has_verb,
        _is_interrogative,
        _match_building_intent,
    )

    assert _is_interrogative(text) is interrogative, text
    assert _match_building_intent(text) is building, text
    assert _has_verb(text, TRANSFORM_VERBS) is transform, text
    assert _has_verb(text, DELETE_VERBS) is delete, text
