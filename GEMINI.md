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
- **Git Checkpoint:**
  - After passing the gate, commit changes with message: `feat(phase-X): complete <phase name>`.