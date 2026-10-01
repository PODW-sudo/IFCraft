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

- [ ] **Phase 7: Sample Models, Project Onboarding & Export**
  - Bundle sample IFC models (e.g., standard Duplex / architectural sample).
  - Build blank project generator.
  - Implement complete IFC export generating valid, compliant IFC files with all geometric transformations and modified properties preserved.
  - Create complete project documentation and verify end-to-end user workflows.
  - **Quality Gate:** End-to-end test passes: modify element, update property, export IFC, reload exported IFC, and verify data persistence.