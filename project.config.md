# Project Configuration

This configuration file defines the product, test environments, entry points, and verification cues for the IFC Editor Agent QA Harness.

---

## Product

- **Name:** IFC Editor
- **Type:** Web App (Spatial 3D CAD/BIM Editor)
- **Description:** High-performance browser-based spatial CAD/BIM viewer and editor built with React 19, Three.js, and web-ifc WebAssembly in dedicated Web Workers, backed by FastAPI, SQLite, and IfcOpenShell. Enables multi-user real-time collaboration with soft locking, orthogonal sectioning, 3D measurement with vertex snapping, and a multi-provider AI copilot.

## Platforms / Targets

| Target | URL or Command | Notes |
|---|---|---|
| Local Dev (Web Frontend) | `http://localhost:5173` | Vite dev server serving React 19 spatial UI and WASM workers |
| Local API (FastAPI Backend) | `http://localhost:8000` | FastAPI server providing REST endpoints and WebSocket room sync |
| Production Build Preview | `http://localhost:4173` | Static bundle preview via `pnpm --dir frontend run preview` |

## Entry Point

1. Start backend server: `.\backend\venv\Scripts\uvicorn app.main:app --port 8000`
2. Start frontend dev server: `pnpm --dir frontend run dev`
3. Open browser at `http://localhost:5173`
4. The spatial canvas mounts with a Three.js 3D viewport, top navigation pill (`SpatialTopPill`), bottom dock (`SpatialBottomDock`), and collapsible panels (Spatial Tree, Property Inspector, AI Copilot).

## Key Feature Areas

- **Viewport & Canvas:** Fullscreen Three.js WebGL spatial canvas, OrbitControls, 3D View Orientation Triad, Coordinate HUD.
- **Project Lifecycle:** Upload IFC files via drag-and-drop or modal, load bundled sample models, create blank IFC projects, export modified IFC files.
- **Spatial Hierarchy Tree:** Traversal of `IfcProject` -> `IfcSite` -> `IfcBuilding` -> `IfcBuildingStorey` -> spatial elements with search and selection highlighting.
- **3D Transform Gizmo & Placement Sync:** Interactive Three.js `TransformControls` (Translate, Rotate) with grid snapping, syncing spatial matrices to backend `IfcLocalPlacement`.
- **Property Inspector:** Inspect element attributes, Property Sets (`IfcPropertySet`), and Quantities (`IfcElementQuantity`) with inline editing and persistence.
- **Advanced BIM Suite:** Orthogonal section clipping planes (X, Y, Z axes with position slider and inversion), 3D point-to-point measurement ruler with vertex snapping and screen-space distance tags.
- **Real-Time Collaboration:** FastAPI WebSocket rooms (`/ws/rooms/{project_id}`), live presence indicator badges, expressID soft-locking on selection, transform broadcasting.
- **Multi-Provider AI Copilot:** Floating HUD / sidebar with provider selection (OpenAI, Anthropic, Google Gemini, Ollama), API key configuration, tool execution (`generate_building`, `transform_element`, `update_property`, `query_model`).
- **Spatial UI & DTCG Tokens:** Design Tokens Community Group compliance (`tokens.json`, `tokens.css`), dark/light theme contrast, collision avoidance for overlapping panels, quick search omnibar (Ctrl+K).

## UI Cues

Key elements the QA agent should look for by selector, title, label, or accessible text:

| Element | Search Text / Cue | Selector / Attribute |
|---|---|---|
| Top Navigation Pill | "IFC Editor" project selector | `header`, `button:has-text('IFC Editor')` |
| Project Dropdown Trigger | Project name with chevron | `button[aria-haspopup='menu']` |
| Upload IFC Action | "Upload IFC" | `div[role='menuitem']:has-text('Upload IFC')` |
| Blank Project Action | "New Blank Project" | `div[role='menuitem']:has-text('New Blank Project')` |
| Export IFC Action | "Export IFC" | `div[role='menuitem']:has-text('Export IFC')` |
| Spatial Tree Toggle | "Spatial Hierarchy" / tree icon | `button[title*='Hierarchy']` |
| Property Inspector Toggle | "Properties" / sliders icon | `button[title*='Properties']` |
| AI Copilot Toggle | "AI Copilot" / sparkles icon | `button[title*='Copilot']` |
| Omnibar Trigger | "Search model... (Ctrl+K)" | `button:has-text('Search model')` |
| Bottom Dock | Center bottom floating bar | `div.fixed.bottom-6` |
| Pointer / Select Mode | Pointer icon button | `button[title='Select / Pointer']` |
| Translate Gizmo Mode | Move icon button | `button[title='Translate (G)']` |
| Rotate Gizmo Mode | Rotate icon button | `button[title='Rotate (R)']` |
| Grid Snap Toggle | Grid icon button | `button[title*='Snap']` |
| Measure Tool Toggle | Ruler icon button | `button[title*='Measure']` |
| Section Plane Toggle | Scissors icon button | `button[title*='Section']` |
| Camera Presets Trigger | Camera icon button | `button[title='Camera Presets']` |
| Render Style Trigger | Layers icon button | `button[title='Render Style']` |
| WebGL Canvas | Three.js rendering canvas | `canvas` |
| Coordinate HUD | "X:", "Y:", "Z:" coordinate badges | `div:has-text('X:')` |
| Upload Dropzone | "Drag & drop your IFC file here" | `div:has-text('Drag & drop your IFC file')` |
| Sample Model Button | "Load Duplex Sample" | `button:has-text('Load Duplex Sample')` |

## Data Safety Rules

- Prefix all test-created models and projects with `AutoTest-` (e.g. `AutoTest-Duplex-01`).
- Clean up test projects from `./storage/projects/` and SQLite `./storage/projects.db` after test suites complete.
- Do not perform irreversible deletions on non-test production project files.
- Treat destructive actions outside `AutoTest-` scope as `skip`.

## Testing Strategy & Tiers

The test suite consists of **70 granular test specifications** categorized into two execution tiers:

1. **Key Functionalities Tier (`--tier key`):**
   - 21 critical end-to-end paths executed on **every test suite run**.
   - Covers canvas mount, sample model parsing, orbit/pan/zoom, spatial tree selection, transform gizmo, property editing, sectioning, point-to-point measurement, Omnibar, AI Copilot, and IFC export.
   - Command: `.\backend\venv\Scripts\python.exe scripts/qa_runner.py run --tier key --browser`

2. **Milestone Suite Tier (`--tier full` / `--milestone`):**
   - All 70 test specifications executed by the live agent in Google Chrome on **each major milestone**.
   - Covers every single function, parameter, slider, modal validation, schema, camera preset, category filter, and edge case.
   - Command: `.\backend\venv\Scripts\python.exe scripts/qa_runner.py run --milestone --browser`

## Browser Environment

- **Primary Browser:** Google Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`) via Chromium DevTools Protocol (CDP).
- **Fallback Browser:** Microsoft Edge (`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`).
- **Mode:** Runs headless by default; supports `--headed` flag to observe the live browser window during test execution.

## Setup Notes

- Python 3.11 virtual environment is located at `.\backend\venv\Scripts\python.exe`.
- Frontend uses `pnpm` exclusively; ensure dependencies are installed via `pnpm --dir frontend install`.
- Ensure `web-ifc.wasm` is available in `frontend/public/` or `frontend/node_modules/web-ifc/` and correctly served with `application/wasm` MIME type.
- Port 8000 (Backend) and Port 5173 (Frontend) must be free or properly mapped.

