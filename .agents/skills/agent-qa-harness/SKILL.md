---
name: agent-qa-harness
description: >-
  Operate the Agent QA Harness to test the IFC Editor in real browser sessions,
  author and validate test_cases.jsonl, execute automated test suites,
  append results to test_results_YYYY-MM-DD.jsonl, audit usability friction,
  and generate development handoff reports.
---

# Agent QA Harness Skill

This skill teaches agents how to operate the **Agent QA Harness** (derived from [jitangupta/agent-qa-harness](https://github.com/jitangupta/agent-qa-harness)) within the IFC Editor codebase.

---

## 1. Harness Architecture & File Structure

The harness is file-based, deterministic, and agent-neutral:

| File | Purpose | Location |
|---|---|---|
| `AGENTS.md` | Master runbook — source of truth for all QA behaviors | Workspace root |
| `project.config.md` | Product configuration, targets, entry points, and UI cues | Workspace root |
| `test_cases.jsonl` | Structured test specifications (one JSON object per line) | Workspace root |
| `test_results_YYYY-MM-DD.jsonl` | Append-only raw execution log for a dated run | Workspace root |
| `test_report_YYYY-MM-DD.md` | Human-readable markdown summary report | Workspace root |
| `DEVELOPMENT_HANDOFF.md` | Backlog of bugs, UX friction, testability gaps, and suggestions | Workspace root |
| `PATTERNS.md` | Proven patterns for 3D WebGL, WASM workers, and state testing | Workspace root |
| `scripts/qa_runner.py` | Python CLI runner implementing check, list, run, and report | `scripts/` |

---

## 2. CLI Runner Commands

Execute commands using the project Python environment:

```powershell
# Validate harness configuration and test cases
& .\backend\venv\Scripts\python.exe scripts/qa_runner.py check

# List test cases with category breakdown
& .\backend\venv\Scripts\python.exe scripts/qa_runner.py list
& .\backend\venv\Scripts\python.exe scripts/qa_runner.py list --category "Core Features"

# Execute test suite
& .\backend\venv\Scripts\python.exe scripts/qa_runner.py run --smoke
& .\backend\venv\Scripts\python.exe scripts/qa_runner.py run --range TC-001:TC-010

# Generate dated test report
& .\backend\venv\Scripts\python.exe scripts/qa_runner.py report
```

---

## 3. Operational Workflow

### Step 1: Mode Check
1. Inspect `project.config.md`.
2. If any `[FILL IN]` placeholders exist, enter **Setup Mode** (`AGENTS.md` Section A) to configure product parameters.
3. Otherwise, enter **Test Mode** (`AGENTS.md` Section B).

### Step 2: Environment Readiness Check
Verify targets before launching tests:
- Frontend dev server running on `http://localhost:5173`
- Backend API running on `http://localhost:8000`
- WebAssembly worker assets served without 404s

### Step 3: Test Execution & Real-Time Logging
For each test case:
1. Navigate to the target platform and execute steps.
2. Verify visual rendering and DOM state.
3. Check 3D WebGL stability (no context loss, no Three.js warnings).
4. Append result immediately to `test_results_YYYY-MM-DD.jsonl`:
   ```json
   {"id":"TR-001","test_id":"TC-001","platform":"http://localhost:5173","status":"pass","timestamp":"2026-10-01T23:55:00","notes":"Canvas mounted cleanly."}
   ```
   *Statuses:* `pass`, `fail`, `unable_to_test`, `skip`.

### Step 4: Usability Review Rule (Spatial Heuristics)
Do not stop at functional assertions. Evaluate:
- Are controls easy to discover?
- Does the 3D transform gizmo respond without lag or jitter?
- Are coordinate readouts formatted with tabular numbers and proper units?
- Do floating HUDs collide when opened together?

When usability friction is identified, record a `UX` item in `DEVELOPMENT_HANDOFF.md` even if the test status is `pass`.

### Step 5: Development Handoff & Report
1. File discovered defects or friction in `DEVELOPMENT_HANDOFF.md` using severity `P0` (blocker), `P1` (broken workflow), `P2` (noticeable friction), or `P3` (polish).
2. Generate `test_report_YYYY-MM-DD.md` summarizing pass/fail counts, matrix, and findings.

---

## 4. Test Case Authoring Standards

When adding new test cases to `test_cases.jsonl`:
- **Single line JSON:** Exactly one valid JSON object per line.
- **Required fields:** `id`, `category`, `name`, `description`, `preconditions`, `steps`, `expected`, `platforms`.
- **Unique IDs:** Auto-increment sequentially (`TC-027`, `TC-028`, etc.).
- **Proportional coverage:** Ensure balance across Product Presence, UI Navigation, Core Features, Advanced BIM, and Edge Cases.
