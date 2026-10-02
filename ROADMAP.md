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