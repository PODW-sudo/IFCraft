## 2026-10-25 - Copilot wrote the model on a question, and moved what it was asked to delete

- **Type:** Bug
- **Platform:** http://localhost:5173 (backend `POST /api/copilot/chat`, provider `local`)
- **Related tests:** F-013, F-025, F-047 (STEP-17);
  `backend/tests/test_step17_copilot_intent.py` (19 tests);
  `frontend/src/tests/step17.copilotConfirm.test.tsx` (5 tests)
- **Severity:** P1
- **Observed:** With no cloud key - i.e. on the default zero-key path - `"what is a house?"`
  produced a `generate_building` tool call and wrote it into the user's model
  (`project_updated: true`), because `"house"` was in an unanchored generation keyword list.
  `"remove element 5"` produced a `transform_element` call, because `"move" in "remove element 5"`
  is `True`; on a millimetre model that is a displacement of up to 13 km. Nothing asked for
  confirmation before any write, and when a tool raised, the exception was folded into
  `tool_calls[].result` with no user-visible signal, leaving "Executing 1 tool operation(s)…" as
  the whole reply. Measured on the pre-fix `HEAD` module against the `office_pavilion` sample:

  ```
  what-is-a-house    -> ['generate_building'] project_updated=True  model_changed=True
  remove-element     -> ['transform_element'] project_updated=True  model_changed=True
  unconfirmed-write  -> ['generate_building'] requires_confirmation=False model_changed=True
  failed-tool        -> project_updated=False errors=[] content='Transforming element #999999 ...'
  ```
- **Expected:** A question never writes. A deletion request says deletion is unavailable and calls
  no tool. Every model-writing tool runs only when the request carries `confirm_writes: true`, and
  an unconfirmed request answers HTTP 200 with `requires_confirmation: true`,
  `project_updated: false`, `tool_calls: []`, a `pending_tool_calls` list and a byte-identical
  `model.ifc`. Intent verbs match on word boundaries. One bounded (`MAX_TOOL_ROUNDS = 2`)
  tool-feedback round feeds results back to an LLM provider. A failed tool sets
  `project_updated: false`, populates `errors: [{tool, message}]` and names the tool and error in
  the reply.
- **Evidence:** Pre-fix probe (HEAD module installed into the copilot router) reproduced all four
  rows above; pre-fix frontend component run produced **5/5** failures (no `confirm_writes` on the
  request, no confirm/cancel controls, no inline errors). Post-fix: 19/19 backend step tests,
  5/5 frontend tests, `test_phase6.py` + `test_step07_column_count.py` green with
  `confirm_writes: True`, `tsc -b --noEmit` clean. Details in
  `docs/audit-2026-10/steps/STEP-17-copilot-intent-and-confirmation.md` → `## Notes`.
- **Suggested fix (implemented in this lane):**
  - `backend/app/services/ai_service.py`: module-level `_is_interrogative()` / `_has_verb()` /
    `_match_building_intent()` / `_describe_write()` with `INTERROGATIVE_LEADERS`,
    `BUILDING_VERBS`, `TRANSFORM_VERBS`, `DELETE_VERBS` as data; an explicit deletion branch that
    returns a message and **no** tool call; `WRITE_TOOLS`, `TOOL_SPECS` (`writes_model`),
    `MAX_TOOL_ROUNDS = 2`; `chat()` partitions reads from writes, withholds writes unless
    `confirm_writes`, collects `errors`, and makes at most one `role="tool"` follow-up round.
  - `backend/app/models/schemas.py`: `CopilotChatRequest.confirm_writes = False`,
    `CopilotChatResponse.requires_confirmation` / `pending_tool_calls` / `errors`, plus
    `PendingToolCall` and `CopilotToolError`.
  - `frontend/src/types/ifc.ts`: mirrors the four fields (and per-bubble proposal state on
    `ChatMessage`).
  - `frontend/src/components/copilot/CopilotSidebar.tsx`: first send is always a dry run
    (`confirm_writes: false`); `requires_confirmation` renders a `data-qa="copilot-confirm-writes"`
    / `copilot-cancel-writes` pair that replays the prompt with `confirm_writes: true` and resolves
    the proposal; `errors` render inline (`data-qa="copilot-tool-errors"`) and do not call
    `onModelModified`.
- **Status:** Fixed (backend + frontend), tests green.
- **Follow-ups not in this lane:**
  - Undo for copilot writes is still STEP-10 - the write is now *confirmed*, not *reversible*.
  - The deletion intent is a message, not a feature: a real copilot delete needs the confirmation
    + undo protocol (say so in the reply until then).
  - Multi-step requests still stop after one follow-up round (`MAX_TOOL_ROUNDS`); revisit with
    STEP-10's transaction model.
  - Provider transports (`_call_gemini` / `_call_anthropic` / `_call_openai`) still carry the key
    in the URL / lack SSRF guards - STEP-20.
  - `scripts/qa_runner.py` clicks a building quick-prompt and only counts message bubbles; it now
    sees a dry-run reply. Add an assertion on `requires_confirmation` + the confirm click when the
    UI harness grows copilot coverage.
