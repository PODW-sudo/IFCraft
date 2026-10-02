# Development Handoff

This file captures bugs, usability friction, testability gaps, and enhancement opportunities discovered while executing the Agent QA Harness on the IFC Editor.

This file is separate from dated test reports (`test_report_YYYY-MM-DD.md`).
- **Test reports** answer: "What happened during this specific test run?"
- **Development handoff** answers: "What needs to be fixed, refined, or improved next?"

> [!IMPORTANT]
> Capture usability friction here even when the underlying test passes (`pass`). If a workflow is technically functional but feels confusing, hidden, sluggish, awkward to manipulate in 3D, or hard to recover from, file a `UX` entry.

---

## Severity Guide

- **P0 — Critical Blocker:** Application crash, WebGL context loss, data loss, corrupted IFC export, or complete inability to load models.
- **P1 — Workflow Break:** Core feature failure on primary target (e.g. transform gizmo failing to sync with backend, clipping planes crashing shader, property edit not persisting).
- **P2 — Friction / Usability:** Noticeable UX issue, confusing navigation, panel collision, lack of visual feedback, or missing cursor state with an available workaround.
- **P3 — Polish / Testability:** Minor visual inconsistency, copy polish, documentation clarity, or missing `data-testid` / testability seams.

---

## Entry Template

```markdown
## YYYY-MM-DD - Short Title

- **Type:** Bug | Enhancement | UX | Testability | Docs
- **Platform:** http://localhost:5173
- **Related tests:** TC-XXX, TC-YYY
- **Severity:** P0 | P1 | P2 | P3
- **Observed:** What happened.
- **Expected:** What should happen.
- **Evidence:** Result ID (e.g. TR-005), screenshot, or reproduction log.
- **Suggested fix:** Concrete implementation or architectural recommendation.
- **Status:** Open | In Progress | Resolved
```

---

## Open Items

*(None at this time. All 70 test cases passing with zero P0-P3 regressions.)*

---

## Resolved Items

### 2026-10-02 - Add Explicit DOM Status Attributes for Web Worker Parsing
- **Type:** Testability
- **Platform:** http://localhost:5173
- **Related tests:** TC-004
- **Severity:** P3
- **Observed:** When loading large IFC models, the agent had to rely on visual progress bar polling rather than a semantic DOM attribute.
- **Expected:** Viewport root element and container expose `data-qa-worker-status="parsing | generating | ready"` for deterministic assertions.
- **Evidence:** Bound `data-qa-worker-status` directly on `#root > div` and ThreeViewport container wrapper in `App.tsx`.
- **Suggested fix:** Bound `data-qa-worker-status` attribute on ThreeViewport outer container and root container to active `loadingStage` state.
- **Status:** Resolved

### 2026-10-01 - Elimination of Hex Literals and Emoji Ornaments
- **Type:** UX
- **Platform:** http://localhost:5173
- **Related tests:** TC-025
- **Severity:** P2
- **Observed:** Legacy panels used untokenized hex colors and emoji ornaments.
- **Expected:** Unified DTCG tokens and Lucide icons across all HUDs and toolbars.
- **Evidence:** Phase 8 deterministic quality gates run (scripts/gates/run_gates.py).
- **Suggested fix:** Refactored all components to use `tokens.json` CSS custom properties and Lucide React icons.
- **Status:** Resolved
