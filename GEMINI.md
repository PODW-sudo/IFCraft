# IFC Editor — Autonomous Agent Harness & Execution Constraints

## 1. Architectural Baseline & Specifications
Strictly adhere to `ifc_editor_design_and_implementation_plan.md`:
- **Frontend:** React 19, Vite, TypeScript (strict), Tailwind CSS, Lucide React, Radix UI primitives.
- **3D & BIM Engine:** Three.js, `TransformControls`, `web-ifc` (WebAssembly worker).
- **Backend:** Python 3.11, FastAPI, Uvicorn, WebSockets, `aiosqlite`, `ifcopenshell`.
- **Database & Storage:** SQLite (`./storage/projects.db`), local directory storage (`./storage/projects/{id}/`).
- **Package Management:** `pnpm` exclusively for frontend; Python standard `venv` + `pip` for backend.

---

## 2. Autonomous Execution Safeguards

### 2.1 Zero-Placeholder Rule
- Never generate stub functions, mock abstractions, or empty placeholders (`// TODO: implement later`, `pass`, unhandled mock callbacks) for any feature outlined in the current or future phases.
- Every phase must produce fully functional, production-ready code.

### 2.2 Phase-Lock Execution
- Execute strictly one phase at a time based on `ROADMAP.md`. Do not start subsequent phases until the current phase passes its Quality Gate.

### 2.3 Circuit Breaker (Infinite Loop Protection)
- If a compilation or runtime Quality Gate fails, you are allowed up to **3 automated self-repair attempts**.
- If the issue cannot be resolved within 3 attempts, halt immediately, output a concise diagnostic report (error logs, affected files, proposed solutions), and wait for user intervention.

### 2.4 Hardware & Thermal Optimization (Intel Core i5 8th Gen, 16GB RAM)
- **Web Workers:** All `web-ifc` binary parsing, geometry computation, and schema traversals must execute inside dedicated Web Workers to keep the main thread completely responsive.
- **Resource Cleanup:** Explicitly call `.dispose()` on Three.js geometries, materials, and textures when switching models or clearing meshes to avoid WebGL memory leaks.
- **WASM Assets:** Ensure `web-ifc.wasm` is served as a static asset with correct MIME types and headers.

---

## 3. Deterministic Quality Gates
Before marking any phase complete in `ROADMAP.md`, you must run and pass the following checks:
- **Frontend Verification:**
  - `pnpm exec tsc --noEmit` (0 type errors)
  - `pnpm run build` (0 build errors, clean bundle)
- **Backend Verification:**
  - Python import check / smoke test verifying FastAPI and `ifcopenshell` run without runtime errors.
  - Endpoints return expected status codes.
- **Objective UX/UI Gates:**
  - `.\backend\venv\Scripts\python.exe scripts/gates/run_gates.py` (Zero Emoji, Hardcodes, Intent, Contrast all PASS)
- **Agent QA Harness Verification:**
  - `.\backend\venv\Scripts\python.exe scripts/qa_runner.py check` (0 syntax or configuration errors across 70 test cases)
  - Execute Key Functionalities on every test run: `.\backend\venv\Scripts\python.exe scripts/qa_runner.py run --tier key --browser`
  - Execute Major Milestone Suite before marking any phase complete: `.\backend\venv\Scripts\python.exe scripts/qa_runner.py run --milestone --browser` (all 70 tests in live Google Chrome)
  - Append raw results to `test_results_YYYY-MM-DD.jsonl` and compile `test_report_YYYY-MM-DD.md`
  - Record any discovered bugs, UX friction, or testability gaps in `DEVELOPMENT_HANDOFF.md`
- **Git Checkpoint:**
  - After passing all gates, commit changes with message: `feat(phase-X): complete <phase name>`.

---

## 4. Agent QA Harness Integration & Continuous Verification
The project enforces the file-based **Agent QA Harness** (based on `https://github.com/jitangupta/agent-qa-harness`):
- **Master Runbook (`AGENTS.md`):** All autonomous testing follows `AGENTS.md` procedures (Mode detection, test execution, real-time logging, usability review).
- **Test Spec (`test_cases.jsonl`):** Every new feature or architectural phase must add corresponding test cases to `test_cases.jsonl` with unique IDs, preconditions, steps, and expected outcomes.
- **Configuration & Cues (`project.config.md`):** Maintained with up-to-date target endpoints, entry points, UI cues, and data safety rules.
- **Usability Review Rule:** A functional test pass is not sufficient. Agents must evaluate spatial ergonomics, viewport immersion, manipulator responsiveness, and typography, logging all friction points into `DEVELOPMENT_HANDOFF.md`.
- **Known Problem Patterns (`PATTERNS.md`):** Reference established patterns for 3D WebGL canvas raycasting, Web Worker WASM asynchrony, and WebSocket soft-lock testing.
- **QA Subagent & Skills:** Use the `qa-agent` subagent (`.agents/subagents/qa-agent.md`) and `agent-qa-harness` skill (`.agents/skills/agent-qa-harness/SKILL.md`) for executing browser runs and compiling reports.