# IFC Editor — Implementation Roadmap & Verification Checklist

- [x] **Phase 1: Environment Setup & Backend Skeleton**
  - Initialize Python 3.11 virtual environment (`venv`) with FastAPI, Uvicorn, WebSockets, `ifcopenshell`, `aiosqlite`, and `pydantic`.
  - Set up SQLite database schema for projects, sessions, and edit history.
  - Implement REST endpoints: project CRUD, IFC upload, IFC download/export.
  - Create unified `start.ps1` PowerShell runner for local execution.
  - **Quality Gate:** Backend starts cleanly with Uvicorn; `/health` and project endpoints return valid responses.

- [x] **Phase 2: Frontend Foundation & 3D IFC Viewer**
  - Scaffold React 19 + Vite + TypeScript application using `pnpm` and configure Tailwind CSS.
  - Mount Three.js viewport with perspective camera, `OrbitControls`, directional lights, and grid.
  - Integrate `web-ifc` WebAssembly running in a dedicated Web Worker.
  - Build IFC file upload (drag-and-drop + file picker) and render geometry with category-based materials.
  - Implement spatial hierarchy tree (`IfcProject` -> `IfcSite` -> `IfcBuilding` -> `IfcBuildingStorey` -> Elements) with selection raycasting and highlight material.
  - **Quality Gate:** `pnpm exec tsc --noEmit` and `pnpm run build` succeed; test model renders in 3D with functional spatial tree selection.

- [x] **Phase 3: Spatial Transformations & Property Editor**
  - Attach Three.js `TransformControls` (Translate, Rotate, Scale with grid snapping) to selected IFC elements.
  - Build Property Inspector panel displaying attributes, Property Sets (`IfcPropertySet`), and quantities (`IfcElementQuantity`).
  - Wire frontend transform matrix changes to backend FastAPI endpoint using `ifcopenshell` to recalculate `IfcLocalPlacement` and `IfcAxis2Placement3D`.
  - Enable inline editing of property values with backend persistence.
  - **Quality Gate:** Element transformation via 3D gizmo updates backend placement; properties edit cleanly; build passes.

- [x] **Phase 4: Advanced BIM Suite (Sectioning & Measurement)**
  - Implement orthogonal clipping/section planes (X, Y, Z planes) with interactive slider controls.
  - Implement point-to-point 3D measurement ruler with vertex snapping and real-time distance readouts.
  - Implement camera orientation presets (Top, Front, Side, Perspective) and visibility toggles (Hide, Isolate, Wireframe).
  - **Quality Gate:** Section planes cut geometry without WebGL crashes; measurement tool calculates accurate 3D vector distances; build passes.

- [x] **Phase 5: Real-Time Collaboration & Concurrency**
  - Build FastAPI WebSocket room manager (`/ws/rooms/{project_id}`) handling multi-client sessions.
  - Implement user presence indicators (avatars, active selections, color-coded borders).
  - Implement interactive soft-locking on `expressID` during selection and transformation.
  - Stream transform matrix updates over WebSocket with low-latency lerp interpolation.
  - **Quality Gate:** Two simultaneous client sessions correctly broadcast presence, lock elements, and synchronize transforms.

- [x] **Phase 6: Multi-Provider AI Copilot**
  - Build sidebar AI chat UI with provider selector (OpenAI, Anthropic, Google Gemini, Ollama) and client-side API key modal.
  - Implement backend agent router with tool-calling capabilities:
    - `generate_building(specs)`
    - `transform_element(element_id, dx, dy, dz, rx, ry, rz)`
    - `update_property(element_id, pset_name, property_name, value)`
    - `query_model(query_type, filters)`
  - Connect tool execution directly to active 3D scene and backend `ifcopenshell` instances.
  - **Quality Gate:** Tool calling functions parse correctly; mock or live prompts successfully trigger model queries and scene updates.

- [x] **Phase 7: Sample Models, Project Onboarding & Export**
  - Bundle sample IFC models (e.g., standard Duplex / architectural sample).
  - Build blank project generator.
  - Implement complete IFC export generating valid, compliant IFC files with all geometric transformations and modified properties preserved.
  - Create complete project documentation and verify end-to-end user workflows.
  - **Quality Gate:** End-to-end test passes: modify element, update property, export IFC, reload exported IFC, and verify data persistence.

- [x] **Phase 8: Spatial UI/UX Overhaul & Autonomous Quality Gates (Option C)**
  - Integrate adversarial design critic skills and DTCG design token discipline (`tokens.json`, `tokens.css`).
  - Implement 4 automated deterministic quality gates (Zero Emoji, Hex Literal Hardcode Linter, Semantic Intent Linter, WCAG 2.2 AA Contrast Verifier).
  - Transform legacy 3-pane layout into a 100% immersive spatial canvas with floating frosted HUDs (`SpatialTopPill`, `SpatialBottomDock`, `SpatialTree`, `CoordinateHud`, `SpatialOmnibar`).
  - Implement dynamic collision avoidance for overlapping panels and 3D View Orientation Triad.
  - Address adversarial critique directives with complete color unification (purged all `zinc-*` and `sky-*`), shadow acne elimination, true 3D screen-projected measurement tags, and auto-expanding spatial hierarchy.
  - **Quality Gate:** All 4 gates pass 100%; `pnpm exec tsc --noEmit` and `pnpm run build` pass with 0 errors; Design Critic Verdict: **PASS — GRADE S (93/100)**.

- [x] **Phase 9: Agent QA Harness & Comprehensive Live Browser Automation**
  - Implement full file-based QA Harness based on `jitangupta/agent-qa-harness` (`AGENTS.md`, `project.config.md`, `PATTERNS.md`, `DEVELOPMENT_HANDOFF.md`, `CLAUDE.md`).
  - Author and tier 70 granular test case specifications (`test_cases.jsonl`) covering 100% of product functions.
  - Establish two-tiered execution policy:
    - **Key Functionalities Tier (`--tier key`):** 21 critical E2E user paths executed on every test run.
    - **Major Milestone Tier (`--milestone` / `--tier full`):** Exhaustive 70-test audit executed on major releases.
  - Expose robust frontend testability bridge (`window.__IFC_QA_BRIDGE__`) and semantic `data-qa-*` DOM attributes.
  - Build automated CLI runner (`scripts/qa_runner.py`) interfacing with Google Chrome via Chrome DevTools Protocol (CDP).
  - Register autonomous `qa-agent` subagent and `agent-qa-harness` skill.
  - **Quality Gate:** `qa_runner.py check` passes 70/70; Key suite (21/21) passes in Chrome; Milestone suite (49/49) passes in Chrome (100% pass rate); all 4 UX/design gates pass; `pnpm exec tsc --noEmit` has 0 errors.

- [x] **Phase 10: Multi-Model Federated Coordination & Spatial Clash Detection**
  - Database schema & SQLite index for federated project sub-models (`project_models`).
  - FastAPI federation endpoints (`/api/projects/{id}/submodels`) for multi-model upload, layer visibility, and discipline tagging (`ARCH`, `STRUCT`, `MEP`, `CIVIL`).
  - High-performance AABB + triangle collision & clearance clash detection engine (`clash_service.py`) supporting cross-schema (IFC2X3/IFC4) geometry.
  - Frontend floating HUDs: `FederatedModelManager` and `ClashInspector` with tolerance slider and severity tabs.
  - Discipline mode rendering shader in `ThreeViewport.tsx` and 3D pulsing clash marker pin with bounding wireframe.
  - Expanded QA Harness test suite with TC-071 through TC-078 (26 key tests, 78 total tests).
  - **Quality Gate:** Key tier (26/26) passes in live Chrome; all 4 UI gates pass; `pnpm exec tsc --noEmit` passes with 0 errors.

- [x] **Phase 11: Advanced Spatial Modeling & Interactive IFC Element Creation**
  - Backend parametric CAD service (`cad_service.py`) & endpoints (`/api/projects/{id}/cad/*`) leveraging `ifcopenshell.api` to synthesize walls, slabs, columns, doors, and windows with `IfcOpeningElement` boolean void cutouts.
  - Frontend CAD drawing toolbar (`CadToolbar.tsx`) and viewport click-to-draw snapping helpers (ground plane, wall guides).
  - Bidirectional Undo/Redo stack (`Ctrl+Z`, `Ctrl+Y`) with SQLite transaction persistence (`cad_transactions`).
  - QA Harness test cases (TC-079 to TC-088) covering CAD creation and undo/redo operations (33 key tests, 88 total tests).
  - **Quality Gate:** Key tier (33/33) passes with 100% in live Chrome; element creation generates valid IFC geometry; undo/redo restores state accurately; all 4 UI gates pass; `pnpm exec tsc --noEmit` has 0 errors.

- [x] **Phase 12: Collaborative Session Playback, BCF Export & Spatial Change Audit**
  - Backend BCF 2.1 standard `.bcfzip` generator (`bcf_service.py`) & export endpoints (`/api/projects/{id}/bcf/*`) packaging `bcf.version`, `markup.bcf`, and `viewpoint.bcfv` with perspective camera direction and FoV.
  - Automatic conversion of geometric clash detection collisions into BCF topics with localized clash viewpoints.
  - Temporal change audit log tracking element additions, moves, and deletions with timestamps and user attribution (`audit_service.py` & `/api/projects/{id}/audit/*`).
  - Frontend visual diff rendering shader in `ThreeViewport.tsx` (added = emerald green, modified = amber, unchanged = ghost slate).
  - Temporal audit playback timeline scrubber (`TimelineScrubber.tsx`) with play/pause, step controls, and element focus.
  - Floating `BcfManagerModal.tsx` for creating topics, attaching 3D viewpoints, and exporting standard `.bcfzip`.
  - Expanded QA Harness test suite with TC-089 through TC-096 (41 key tests, 96 total tests).
  - **Quality Gate:** Standard BCF 2.1 archive exports with verified folder structure; visual diff accurately color-codes elements; Key QA tier passes 41/41 (100%) in live Google Chrome; all 4 UI gates pass; `pnpm exec tsc --noEmit` and `pnpm run build` pass with 0 errors.

- [x] **Phase 13: CI/CD Automated Regression Pipeline & Master Quality Gates**
  - GitHub Actions automated CI workflow (`.github/workflows/qa-harness.yml`) running backend unit tests, frontend build, UX lint gates, and headless Chrome E2E harness.
  - Local all-in-one verification script (`scripts/ci_verify.ps1`) executing all 6 verification stages.
  - Full major milestone audit running all 96 tests across all categories in Google Chrome (55/55 milestone tests PASS, 41/41 key tests PASS, 100% pass rate).
  - Comprehensive final release walkthrough artifact and documentation.
  - **Quality Gate:** Complete test suite passes with 100% pass rate in live Google Chrome via CDP (TR-542 to TR-596 and TR-597 to TR-637); 0 lint, type, or token contrast errors across entire codebase; `ci_verify.ps1` returns exit code 0.