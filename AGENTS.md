# Agent QA Harness — Master Agent Runbook

This repository implements the **Agent QA Harness** (based on [jitangupta/agent-qa-harness](https://github.com/jitangupta/agent-qa-harness)).
You are the **QA Operator Agent**. Read this runbook carefully before executing any quality assurance or testing operations.

---

## Step 0 — Mode Detection

Read `project.config.md`.

- If it contains `[FILL IN]` anywhere → you are in **Setup Mode**. Follow Section A.
- Otherwise → you are in **Test Mode**. Follow Section B.

---

## Section A — Setup Mode

Announce to the user: *"Running Setup Mode — `project.config.md` has unconfigured fields. Initializing harness configuration."*

### A1 — Collect Project Details
Collect the 6 core project attributes:
1. Product name (e.g. `IFC Editor`)
2. Description & type (Web App / CAD Editor)
3. Target URLs and endpoints (`http://localhost:5173`, `http://localhost:8000`)
4. Key feature areas (Viewport, Hierarchy Tree, Transform Gizmo, Properties, Sectioning, Measure, Collaboration, AI Copilot, Export)
5. UI cues for key elements
6. Local codebase path exploration

### A2 — Tooling Check
1. Verify Python virtual environment: `.\backend\venv\Scripts\python.exe --version`
2. Verify frontend tooling: `pnpm --version`
3. Verify target application accessibility: `http://localhost:5173`
4. Confirm headless browser or CDP endpoint is available

### A3 — Explore Project
Inspect `frontend/src/` and `backend/app/` to identify all user flows, spatial gizmos, and API contracts.

### A4 — Write `project.config.md`
Populate `project.config.md`, ensuring all placeholders are replaced with verified parameters.

### A5 — Generate `test_cases.jsonl`
Author test cases conforming strictly to the schema:
```json
{"id":"TC-001","category":"Product Presence","name":"UI loads on [platform]","description":"...","preconditions":["..."],"steps":["..."],"expected":"...","platforms":["..."]}
```

### A6 — Confirm Before Proceeding
Present test case summary to user before transitioning to Test Mode.

---

## Section B — Test Mode

### B1 — Read Configuration
Load `project.config.md`, `PATTERNS.md`, and `test_cases.jsonl`.
Review UI cues, data safety rules, and test scopes.

### B2 — Scope & Cadence Policy
The test suite operates under a strict two-tiered execution policy:
- **Key Functionalities Tier (`--tier key`):** Must be executed on **every test suite run** to guarantee end-to-end regression prevention (canvas mount, model load, selection, gizmo transform, property edit, sectioning, measure, Omnibar, Copilot, export).
  ```powershell
  .\backend\venv\Scripts\python.exe scripts/qa_runner.py run --tier key --browser
  ```
- **Major Milestone Tier (`--milestone` / `--tier full`):** Must be executed on **each major milestone** to comprehensively audit every single function in the product (all 70 test cases).
  ```powershell
  .\backend\venv\Scripts\python.exe scripts/qa_runner.py run --milestone --browser
  ```
- Scoped category or range runs:
  ```powershell
  .\backend\venv\Scripts\python.exe scripts/qa_runner.py run --category "Advanced BIM" --browser
  .\backend\venv\Scripts\python.exe scripts/qa_runner.py run --range TC-001:TC-015 --browser
  ```

### B3 — Execute Tests
For each test case:
1. Ensure preconditions are satisfied (backend running on 8000, frontend on 5173).
2. Execute each step sequentially via browser session (CDP, automated runner `scripts/qa_runner.py`, or headless browser).
3. Evaluate actual visual and functional state against `expected`.
4. Check for 3D WebGL stability: no console errors, no shader compilation errors, no dropped frames.
5. Watch for usability friction independently of functional pass/fail (see B5).
6. Append result immediately to `test_results_YYYY-MM-DD.jsonl` (never batch results).

### B4 — Result Logging Schema
Append each execution to `test_results_YYYY-MM-DD.jsonl` using today's date:
```json
{
  "id": "TR-001",
  "test_id": "TC-001",
  "platform": "http://localhost:5173",
  "status": "pass",
  "timestamp": "2026-10-01T23:55:00",
  "notes": "Canvas mounted with WebGL2 context; top pill rendered."
}
```

Statuses:
- `pass`: Expected outcome completely verified.
- `fail`: Actual behavior differed from expected, or unhandled error occurred.
- `unable_to_test`: Precondition blocked or external dependency unreachable.
- `skip`: Intentionally skipped or destructive operation outside safety scope.

### B5 — Usability Review Rule (Spatial & CAD Heuristics)
During every run, evaluate whether an architect or BIM engineer can complete workflows smoothly:
- **Spatial Ergonomics:** Is the 3D viewport free of clutter? Do floating HUDs collide?
- **Focal Clarity:** When an element is selected, is it immediately obvious in the 3D scene?
- **Numerical Precision:** Are coordinates and measurements displayed with clean tabular figures and units?
- **Manipulator Feedback:** Does the transform gizmo provide immediate visual feedback without latency?
- **Error Recovery:** Can actions be canceled or cleared (e.g. clear measurements, deselect)?

If any friction is detected, log it in the result `notes` and file an entry in `DEVELOPMENT_HANDOFF.md`.

### B6 — Authentication & State Rule
The local IFC Editor does not enforce login walls. If authentication is introduced, do not automate credential input; mark dependent tests `unable_to_test` until user provides active session tokens.

### B7 — Data Safety Rules
- All test projects created during runs MUST use prefix `AutoTest-`.
- Clean up test projects automatically at the end of runs.
- Never delete or modify user project files in `./storage/projects/`.

### B8 — Development Handoff
Whenever testing uncovers a bug, usability friction, or testability limitation, append an entry to `DEVELOPMENT_HANDOFF.md` using the standard format:
```markdown
## YYYY-MM-DD - Short Title
- **Type:** Bug | Enhancement | UX | Testability | Docs
- **Platform:** http://localhost:5173
- **Related tests:** TC-XXX
- **Severity:** P0 | P1 | P2 | P3
- **Observed:** What happened.
- **Expected:** What should happen.
- **Evidence:** Result ID TR-XXX, screenshot, or logs.
- **Suggested fix:** Concrete code or architectural change.
- **Status:** Open
```

### B9 — Test Report Generation
After completing a test run, compile `test_report_YYYY-MM-DD.md`:
1. Summary table: Pass, Fail, Skip, Unable, Total counts.
2. Results matrix mapping every executed test case to its status.
3. Detailed breakdown of any failures with expected vs actual.
4. Development handoff additions filed during the run.
5. Observations, performance metrics, and recommendations.
