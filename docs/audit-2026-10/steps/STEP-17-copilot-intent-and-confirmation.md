# STEP-17 — Copilot intent matching + write confirmation

**Status:** not started · **Wave:** C · **Effort:** 2 d
**Findings:** F-013, F-025, F-047 · **Depends on:** — · **Blocks:** STEP-18

## Problem

The copilot executes model writes on a raw substring match. Typing **"what is a house?"** generates a building and writes it into the user's model, because `"house"` is in the generation keyword list. Typing **"remove element 5"** *moves* element 5, because `"remove"` contains `"move"` — and with F-001 still open on millimetre models, "moves" means "displaces by up to 13 km". There is no confirmation step before any write, and when a tool fails the user is left looking at "Executing 1 tool operation(s)…" with no explanation.

## Evidence

- `backend/app/services/ai_service.py:1354` — building intent fires on any of `"generate building" … "house"`; the list has no interrogative guard.
- `backend/app/services/ai_service.py:1386` — transform intent fires on `any(kw in user_msg for kw in ["move", "translate", …])`; `"move" in "remove element 5"` is `True`.
- `backend/app/services/ai_service.py:1121-1123` — any request without a cloud API key routes to `_call_local_deterministic`, so this is the **default** path, not the fallback.
- `backend/app/services/ai_service.py:1126-1146` — every returned call is executed immediately; there is no confirm flag, no dry run and no allowlist.
- `backend/app/services/ai_service.py:1139-1140` — `project_updated` is set only on `result.get("success")`; a failed tool produces no signal at all, and the pre-execution text at `:1382`, `:1445`, `:1483`, `:1512` is already committed to the response.
- `backend/app/services/ai_service.py:632-634` — tool exceptions become `{"error": str(e)}` inside `tool_calls[].result` and nothing else.
- `backend/app/models/schemas.py:98-110` — `CopilotChatRequest` has no confirmation field; `CopilotChatResponse` has no error or pending field.
- `frontend/src/services/api.ts:78-91` posts the request verbatim; `frontend/src/components/copilot/CopilotSidebar.tsx:377-379` only reacts to `project_updated`, so it cannot see a rejection.
- Measured (this audit tree): `POST /api/copilot/chat {"provider":"local","messages":[{"role":"user","content":"what is a house?"}]}` produces `tool_calls[0].name == "generate_building"` and `project_updated == true`.

## Scope

**Change:**

- `backend/app/services/ai_service.py:1337-1354` — replace the substring test with an anchored intent matcher (helpers `_is_interrogative`, `_match_building_intent`).
- `backend/app/services/ai_service.py:1386` — word-boundary verb match for the transform intent.
- `backend/app/services/ai_service.py:1349-1522` — add an explicit deletion intent that returns a message and **no** tool call.
- `backend/app/services/ai_service.py:1126-1146` — gate every model-writing tool behind `request.confirm_writes`; add a bounded tool-feedback round (`MAX_TOOL_ROUNDS = 2`).
- `backend/app/services/ai_service.py:615-634` — add `WRITE_TOOLS: frozenset[str]` and `TOOL_SPECS` metadata exposing `writes_model`.
- `backend/app/models/schemas.py:98-110` — add `CopilotChatRequest.confirm_writes`, and `requires_confirmation`, `pending_tool_calls`, `errors` on `CopilotChatResponse` (new models `PendingToolCall`, `CopilotToolError`).
- `frontend/src/types/ifc.ts:95-108` — mirror the four new fields.
- `frontend/src/components/copilot/CopilotSidebar.tsx:340-379` — send `confirm_writes`, render a confirm/cancel pair on `requires_confirmation`, render `errors` inline.

**Do not change:**

- The provider-caller functions (`_call_gemini`, `_call_anthropic`, `_call_openai`) other than being called twice by the loop. Their transport is STEP-20's concern (SSRF, key in URL).
- `_exec_transform_element` mathematics — F-001 is STEP-01. This step must not touch the matrix code, or the two fixes become untestable in isolation.
- Tool argument schemas in `OPENAI_TOOLS` (`backend/app/services/ai_service.py:25`).

**Non-goals:**

- Undo for copilot writes (STEP-10). This step makes the write *confirmed*; STEP-10 makes it *reversible*.
- A full planner/agent loop with more than one follow-up round. Two rounds is enough to answer a single question after a read tool; unbounded loops are a cost risk with paid providers.
- Read-only copilot intelligence (`USER-NEEDS.md` §6). That is a product direction, not this defect.

## Spec

1. A message that is interrogative — first word in `{"what","why","how","who","when","where","which","is","are","does","do","can","could","should","explain","tell","describe","list"}`, or ending in `?` — never produces a model-writing tool call, whatever nouns it contains.
2. Building generation requires **both** an imperative verb (`generate|create|make|build|add|construct`) and a building noun (`building|house|tower|block|pavilion`) in the same message, and is not interrogative.
3. `"remove element 5"` and `"delete element 5"` produce **no** `transform_element` call. They produce a message that says deletion needs confirmation and is not available from the copilot yet.
4. Transform, property-update and generate intents match their verbs on word boundaries (`\bmove\b`), not substrings.
5. Every tool whose name is in `WRITE_TOOLS` executes **only** when `request.confirm_writes is True`.
6. With `confirm_writes` absent or `False` and at least one write tool pending: HTTP `200`; `requires_confirmation == True`; `project_updated == False`; `tool_calls == []`; `pending_tool_calls` lists `{name, arguments}` for each withheld write; the project's `model.ifc` bytes are **unchanged** (sha256 equal before and after).
7. With `confirm_writes: True` the same message executes each write tool exactly once and sets `project_updated == True`.
8. Read-only tools (`query_model`) execute regardless of `confirm_writes`.
9. If any executed tool returns a dict containing `"error"`, the response sets `project_updated == False`, populates `errors` with `{tool, message}`, and `message.content` contains the failing tool name and the error text.
10. After a round that executed tool calls for an LLM provider, the service makes **at most one** follow-up provider call carrying the tool results, and the returned `message.content` is the follow-up text. No more than `MAX_TOOL_ROUNDS` provider calls occur per chat request.
11. For the deterministic engine the returned `message.content` is derived from the executed tool results (e.g. the actual count), not from the template chosen before execution.

## TDD

### 1. Add the failing test

**File:** `backend/tests/test_step17_copilot_intent.py`
**Command:** `.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step17_copilot_intent.py -v`

<details>
```python
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
```
</details>

### 2. Watch it fail

```
$ .\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step17_copilot_intent.py -v
FAILED backend/tests/test_step17_copilot_intent.py::test_interrogative_never_writes
  E   AssertionError: [{'id': 'call_3f2a1b9c', 'name': 'generate_building', ...}] == []
  E   assert 'generate_building' in the tool_calls list
FAILED backend/tests/test_step17_copilot_intent.py::test_remove_is_not_move
  E   AssertionError: 'transform_element' unexpectedly in ['transform_element']
FAILED backend/tests/test_step17_copilot_intent.py::test_write_is_withheld_without_confirmation
  E   KeyError: 'requires_confirmation'
FAILED backend/tests/test_step17_copilot_intent.py::test_failed_tool_is_surfaced
  E   KeyError: 'errors'
FAILED backend/tests/test_step17_copilot_intent.py::test_tool_results_are_fed_back_to_the_model
  E   assert 1 == 2
PASSED backend/tests/test_step17_copilot_intent.py::test_write_executes_once_when_confirmed
PASSED backend/tests/test_step17_copilot_intent.py::test_read_tool_runs_without_confirmation
```

`test_write_executes_once_when_confirmed` passes before the change — that is expected and deliberate: it is the *anti-vacuous* control that proves the confirmed path still works afterwards.

### 3. Implement

1. `backend/app/models/schemas.py` — after `ToolCall` (`:92-96`) add:
   ```python
   class PendingToolCall(BaseModel):
       name: str
       arguments: dict[str, Any]

   class CopilotToolError(BaseModel):
       tool: str
       message: str
   ```
   Add `confirm_writes: bool = False` to `CopilotChatRequest` (`:98-105`) and
   `requires_confirmation: bool = False`, `pending_tool_calls: list[PendingToolCall] = []`,
   `errors: list[CopilotToolError] = []` to `CopilotChatResponse` (`:107-110`).
2. `backend/app/services/ai_service.py:615` — above `execute_tool`, add:
   ```python
   WRITE_TOOLS = frozenset({"generate_building", "transform_element", "update_property"})
   MAX_TOOL_ROUNDS = 2
   ```
3. `backend/app/services/ai_service.py:1337` — add module-level helpers `_is_interrogative(text: str) -> bool` and a word-boundary verb matcher `_has_verb(text, verbs) -> bool` using `re.search(rf"\b(?:{'|'.join(verbs)})\b", text)`.
4. `backend/app/services/ai_service.py:1354` — replace the single `if any(kw in user_msg …)` with
   ```python
   if (not _is_interrogative(user_msg)
           and _has_verb(user_msg, ("generate", "create", "make", "build", "add", "construct"))
           and re.search(r"\b(building|house|tower|block|pavilion)\b", user_msg)):
   ```
5. `backend/app/services/ai_service.py:1386` — replace the substring test with
   `elif not _is_interrogative(user_msg) and _has_verb(user_msg, ("move","translate","rotate","shift","offset","transform","nudge")):`.
6. `backend/app/services/ai_service.py` — before the property-update branch (`:1449`) insert a deletion branch:
   ```python
   elif _has_verb(user_msg, ("delete", "remove", "erase", "purge")):
       text = ("Deleting elements from the copilot is not enabled yet: it needs the "
               "confirmation and undo flow. Use the Delete key in the viewport, or the "
               "CAD delete command, so the action is reversible.")
   ```
7. `backend/app/services/ai_service.py:1126-1146` — rewrite the execution block:
   - partition `raw_calls` into `writes` (name in `WRITE_TOOLS`) and `reads`.
   - execute `reads` immediately via `execute_tool`.
   - if `writes` and not `request.confirm_writes`: **do not execute**; set
     `requires_confirmation=True`, build `pending_tool_calls`, and append to `assistant_content`
     a plain-language summary of each intended change (read `name`, `element_id`, `dx/dy/dz`, `pset_name` from `arguments`).
   - if `writes` and `request.confirm_writes`: execute, then set `project_updated` when `result.get("success")`.
   - after execution, collect every result with an `"error"` key into `errors`.
   - if `errors`, set `project_modified = False` and append a sentence to `assistant_content` naming each failing tool and its message.
8. `backend/app/services/ai_service.py:1548` — wrap the provider call in a bounded loop:
   ```python
   rounds = 0
   while True:
       rounds += 1
       assistant_content, raw_calls = await <provider dispatch>
       if not raw_calls or rounds >= MAX_TOOL_ROUNDS or provider == "local":
           break
       messages = messages + [<assistant turn>] + [<one role="tool" message per executed result>]
   ```
   The `role="tool"` message shape for `_call_openai` is
   `{"role": "tool", "tool_call_id": call_id, "content": json.dumps(result)}`; for the deterministic engine the loop breaks immediately (`provider == "local"`), and the text is composed from the executed results instead (step 9).
9. Deterministic engine (`backend/app/services/ai_service.py:1338-1524`) — for `query_model` with `query_type == "count_by_type"`, replace the fixed `text = f"Querying model metrics with type '{q_type}'..."` (`:1512`) with text built from the executed result *after* execution, inside the `chat` method: if the only call is `query_model` and it succeeded, set `assistant_content = result.get("summary")`. Do not change the tool itself.
10. `frontend/src/types/ifc.ts:95-108` — add `confirm_writes?: boolean` to the request and the three response fields.
11. `frontend/src/components/copilot/CopilotSidebar.tsx:340-359` — pass `confirm_writes: false` on the first send; store `response.pending_tool_calls` in state; on confirm re-send the same message with `confirm_writes: true`. Render `response.errors` as an inline warning block under the assistant bubble.

### 4. Watch it pass

```
$ .\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step17_copilot_intent.py -v
PASSED backend/tests/test_step17_copilot_intent.py::test_interrogative_never_writes
PASSED backend/tests/test_step17_copilot_intent.py::test_remove_is_not_move
PASSED backend/tests/test_step17_copilot_intent.py::test_write_is_withheld_without_confirmation
PASSED backend/tests/test_step17_copilot_intent.py::test_write_executes_once_when_confirmed
PASSED backend/tests/test_step17_copilot_intent.py::test_read_tool_runs_without_confirmation
PASSED backend/tests/test_step17_copilot_intent.py::test_failed_tool_is_surfaced
PASSED backend/tests/test_step17_copilot_intent.py::test_tool_results_are_fed_back_to_the_model
7 passed
```

### 5. Regression guard

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_phase6.py -v
.\backend\venv\Scripts\python.exe -m pytest backend/tests/ -q
cd frontend; pnpm exec tsc -b --noEmit
cd frontend; pnpm exec vitest run
```

`backend/tests/test_phase6.py` calls `/api/copilot/chat` four times expecting a write (`:64-70`, `:97-103`, `:114-121`, `:135-142`). Under spec 5 those become dry runs. **They must be updated to send `"confirm_writes": True`.** Every assertion in that file stays — this is a contract update, not a relaxation. Do it in the same commit so master never goes from "one pre-existing failure" to five.

## Acceptance criteria

- [x] `"what is a house?"` returns zero tool calls and leaves `model.ifc` byte-identical.
- [x] `"remove element N"` contains no `transform_element` call and says deletion is unavailable.
- [x] A write request without `confirm_writes` returns `requires_confirmation: true`, `project_updated: false`, `tool_calls: []`, and a non-empty `pending_tool_calls`.
- [x] The same request with `confirm_writes: true` executes exactly one write and sets `project_updated: true`.
- [x] `query_model` still runs with `confirm_writes` absent.
- [x] A failed tool produces `errors`, `project_updated: false`, and does not leave "Executing 1 tool operation(s)…" as the entire reply.
- [x] A monkeypatched provider sees exactly 2 calls for one tool round, and the second carries a `role: "tool"` message.
- [x] `test_phase6.py` is green with `confirm_writes: True` added to its four chat calls.
- [x] `tsc -b --noEmit` passes with the four new frontend fields.

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| The confirmation gate breaks existing copilot users/tests | `confirm_writes=True` matches the old behaviour exactly; only `test_phase6.py` needs the field added | Set `confirm_writes: bool = True` in the schema — one-line revert, gate off |
| The anchored matcher rejects legitimate phrasing ("could you add a 2 storey building?") | Interrogative guard is by *first word*; `"could you add…"` matches the prefix list and is treated as a question. Accepted: a question mark should mean "answer me", not "write" | Loosen `_is_interrogative` to require the trailing `?` only |
| Word-boundary verbs miss "relocate" / "displace" | Add synonyms to the verb tuple; the list is data, not logic | N/A |
| The extra provider round doubles token cost for write tools | Round only happens when the first round returned tool calls and a non-`local` provider was used; capped at 2 | Set `MAX_TOOL_ROUNDS = 1` |
| Deterministic-engine text now comes from results, so a failed query reads oddly | `errors` block is appended with the tool name and message | Restore the template string |

## Notes

- **The two intent bugs are the same bug:** unanchored string matching on a natural-language surface. Fix the matcher as one function so the next intent added cannot reintroduce it. If a third intent needs keywords, extend the shared helper rather than adding another `any(kw in …)`.
- **Confirmation is a protocol change, not a UI preference.** `confirm_writes` lives in the request so that a client cannot accidentally write by omitting it, and so that server-side callers (`AIService.chat` is called directly by tests) obey the same rule.
- **Tool-feedback scope:** spec 10 adds *one* follow-up round. F-025's "multi-step requests silently half-execute" is only fully solved when the copilot can iterate — but unbounded iteration against a paid API is worse than a half-executed request, so 2 rounds is the deliberate ceiling. Revisit with STEP-10's transaction model.
- **Frontend confirmation UI needs STEP-27.** `frontend/src/tests/step17.copilotConfirm.test.ts` cannot exist yet: `frontend/vite.config.ts` has no `test` block and neither `jsdom` nor `@testing-library/react` is installed (F-061). The backend tests above are the gating evidence for this step; add the component test when STEP-27 lands.
- **Not verified:** F-013, F-025 and F-047 are `[L]` in `FINDINGS.md` — read-only. The behaviour claimed in `## Evidence` for `"what is a house?"` was re-derived from the source in this tree (`ai_service.py:1354`, `:1121-1123`), not executed.

### Implementation note (2026-10-25)

**Pre-fix failures (recorded, not assumed).** The working tree already carried STEP-01's
uncommitted edits to `ai_service.py`, so reverting the file would have destroyed another lane's
work. Instead the `HEAD` revision of the module was loaded as a separate module and installed into
`backend.app.api.copilot`, which is exactly the code the audit measured. Observable pre-fix
behaviour on the `office_pavilion` sample:

```
PREFIX what-is-a-house    -> ['generate_building'] project_updated=True  model_changed=True
PREFIX remove-element     -> ['transform_element'] project_updated=True  model_changed=True
PREFIX unconfirmed-write  -> ['generate_building'] requires_confirmation=False model_changed=True
PREFIX failed-tool        -> project_updated=False errors=[] content='Transforming element #999999 with offsets: dx=1.0m, ...'
```

i.e. `test_interrogative_never_writes`, `test_remove_is_not_move`,
`test_write_is_withheld_without_confirmation` and `test_failed_tool_is_surfaced` fail (the failed
tool leaves `errors == []`, the template text and a `False` flag with no explanation), and
`test_tool_results_are_fed_back_to_the_model` sees 1 provider call. The frontend test was run
against the pre-fix component (`git show HEAD:.../CopilotSidebar.tsx` copied into place, then
restored): **5/5 failed** — no `confirm_writes` on the request, no `Confirm write` / `Cancel`
controls, no inline error block.

**Backend.**

- `_is_interrogative`, `_has_verb`, `_match_building_intent`, `_describe_write` are module-level
  helpers next to the deterministic engine, with the verb/noun tuples as data
  (`BUILDING_VERBS`, `TRANSFORM_VERBS`, `DELETE_VERBS`, `INTERROGATIVE_LEADERS`). Every intent now
  goes through them; no `any(kw in msg …)` remains in the engine.
- Branch order is building → transform → **delete (message, no tool call)** → property → query, so
  a deletion can no longer fall through into a transform. The query branch is deliberately *not*
  interrogative-gated: `"how many walls…"` is a question and must still be answered.
- `WRITE_TOOLS`, `TOOL_SPECS` (`writes_model` per tool, derived from `OPENAI_TOOLS` so the two
  cannot drift) and `MAX_TOOL_ROUNDS = 2` sit above `execute_tool`. `OPENAI_TOOLS` is unchanged.
- `chat()` now: normalises the conversation once, dispatches through a local `dispatch()` closure
  (the provider transport is untouched), executes reads immediately, withholds writes behind
  `request.confirm_writes`, collects `errors` from any result dict containing `"error"`, and loops
  at most `MAX_TOOL_ROUNDS` times, feeding `role="tool"` messages back for the single follow-up
  round. Local provider breaks after round 1, per spec.
- Reply text is never a lie: withheld writes append a bullet list built from the withheld
  arguments; failures append the failing tool + its message and drop a bare
  "Executing N tool operation(s)…" placeholder. For the deterministic single `query_model` round
  the reply is the tool's own `summary`.
- `CopilotChatRequest.confirm_writes` defaults to **False**, so an old client cannot write by
  omission (the deliberate protocol choice in the Risks table).

**Deviations from the letter of the spec (all small, all deliberate).**

1. `_message_view()` was added and used by the three `_call_*` callers. The tool-feedback round
   appends plain dict turns carrying `tool_call_id`, which `ChatMessage` cannot express, and the
   published test asserts `m.get("role") == "tool"` over the whole list. Transport concerns
   (URL, auth header, SSRF) are untouched — that is still STEP-20.
2. `_call_openai` only appends the `selected_id` context to a **user** turn (previously to whatever
   was last), otherwise the context would be glued onto a `role="tool"` message on the follow-up
   round. `_call_anthropic` maps a `role="tool"` turn to a `user` turn containing the result,
   because this transport has no tool-result block; dropping it would violate spec 10.
3. `backend/tests/test_step07_column_count.py` also posts an unconfirmed `generate_building`
   through `/api/copilot/chat`, so it received `confirm_writes: True` in its `_generate()` helper.
   The step doc only named `test_phase6.py`; leaving the STEP-07 test behind would have turned the
   contract change into three red tests in another lane's file.
4. The doc's note that the frontend test "cannot exist yet" is stale: STEP-27 landed
   vitest + jsdom + `@testing-library/react` and the `test` block in `vite.config.ts`. The component
   test was written (`frontend/src/tests/step17.copilotConfirm.test.tsx`, 5 tests).
5. `ChatMessage` (frontend) gained `requiresConfirmation`, `pendingToolCalls`, `errors` and
   `sourcePrompt` so a *bubble* can carry its own proposal; the confirm button replays
   `sourcePrompt` with `confirm_writes: true` and resolves the proposal so it cannot be clicked
   twice.

**Not done here (by scope).** No undo for copilot writes (STEP-10), no multi-step planning beyond
one follow-up round, no read-only-copilot work (`USER-NEEDS.md` §6), no change to
`_exec_transform_element`, `OPENAI_TOOLS` argument schemas, `api/projects.py` or the provider
transports.

