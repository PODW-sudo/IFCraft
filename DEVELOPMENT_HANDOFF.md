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

> **Remediation status (2026-10-25):** every finding below was implemented and verified in the
> 2026-10-25 all-waves pass. The entries are retained as the audit trail; the per-step evidence is in
> [docs/audit-2026-10/steps/STATUS.md](./docs/audit-2026-10/steps/STATUS.md). New friction found
> after this date belongs in a new entry above this note.
> Populated 2026-10-25 from the independent audit register
> [`docs/audit-2026-10/FINDINGS.md`](./docs/audit-2026-10/FINDINGS.md) (audit date 2026-10-24, commit `f5eec4c`).
> Every entry below is **open** — no fix for any of these is merged. Nothing here is marked
> `Resolved` on the strength of a plan; entries move to `## Resolved Items` only when the fix lands.
> Remediation steps are specified in [`docs/audit-2026-10/steps/`](./docs/audit-2026-10/steps/).

### 2026-10-25 - AI `transform_element` displaces geometry ~1000x and ignores the element origin (F-001, P0)
- **Type:** Bug
- **Platform:** http://localhost:5173
- **Related tests:** `docs/audit-2026-10/tests/backend/test_step01_ai_transform_units.py`
- **Severity:** P0
- **Observed:** A **zero-delta** copilot transform moved a wall by **13,516 m** on a millimetre-unit model (`modelsfortests/Ifc4_Revit_ARC.ifc`). `get_element_placement_matrix` returns the *relative* placement in project units while `_exec_transform_element` mixes in a *metre* delta and writes back with `is_si=True`. `M_new = T @ R @ M` also rotates about the world origin.
- **Expected:** "move this wall 2 m" moves it 2 m; a rotation leaves the element's position unchanged; every AI edit writes an undoable transaction.
- **Evidence:** FINDINGS.md F-001; `pytest backend/tests/test_step01_ai_transform_units.py` — 4 failures on 2026-10-25.
- **Suggested fix:** STEP-01 — convert the placement to SI once, compose about the element origin (`M @ R`), and record an edit-history row.
- **Status:** Resolved (2026-10-25 � all waves implemented; evidence in `docs/audit-2026-10/steps/STATUS.md`)
### 2026-10-25 - Every gizmo drag rewrites the IFC file twice, concurrently (F-002, P0)
- **Type:** Bug
- **Platform:** http://localhost:5173
- **Related tests:** `docs/audit-2026-10/tests/backend/test_step02_single_commit_path.py`
- **Severity:** P0
- **Observed:** `useGizmoTransform.ts:35` fires a fire-and-forget WebSocket `commitTransform` **and** `:38` a REST `POST /elements/{id}/placement`; both reach `IFCService.update_element_placement`, milliseconds apart, with no lock. Two concurrent full-file rewrites per drag release.
- **Expected:** one commit path per transform, serialised per project.
- **Evidence:** FINDINGS.md F-002 (`backend/app/api/websocket.py:122`, `backend/app/api/projects.py:276`).
- **Suggested fix:** STEP-02/STEP-03 — a single commit endpoint plus a per-project write lock and atomic replace.
- **Status:** Resolved (2026-10-25 � all waves implemented; evidence in `docs/audit-2026-10/steps/STATUS.md`)
### 2026-10-25 - No authentication, wildcard CORS with credentials, WS accepts any Origin (F-003, P0)
- **Type:** Bug
- **Platform:** http://localhost:8000
- **Related tests:** `docs/audit-2026-10/tests/backend/test_step05_cors_and_auth.py`
- **Severity:** P0
- **Observed:** `GET /health` with `Origin: https://evil.example.com` returns `access-control-allow-origin: https://evil.example.com` **plus** `allow-credentials: true`; no endpoint has a security dependency; the WS accepts before any project lookup and without an Origin check.
- **Expected:** explicit origin allowlist, no wildcard with credentials, a local token for mutating routes, and a WS Origin check.
- **Evidence:** FINDINGS.md F-003 (`backend/app/core/config.py:31-37`, `backend/app/main.py:36-42`, `backend/app/api/websocket.py:14-16`).
- **Suggested fix:** STEP-05.
- **Status:** Resolved (2026-10-25 � all waves implemented; evidence in `docs/audit-2026-10/steps/STATUS.md`)
### 2026-10-25 - Property Inspector value edits never persist (F-066, P0)
- **Type:** Bug
- **Platform:** http://localhost:5173
- **Related tests:** `docs/audit-2026-10/tests/backend/test_step29_property_edit_persistence.py`
- **Severity:** P0
- **Observed:** `GlassPropertyInspector.tsx:143-151` sends `PATCH` to a route that only defines `POST` (405) **and** sends `name` where the schema requires `property_name` (422). The failure is caught and `console.error`'d only — no user-visible error. The documented "in-place editing of property values" feature is a silent no-op.
- **Expected:** an edit saves to the `.ifc` file and surfaces any failure in the UI.
- **Evidence:** FINDINGS.md F-066 (`backend/app/api/projects.py:293`, `backend/app/models/schemas.py:52-56`).
- **Suggested fix:** STEP-29 — `POST` + `property_name`, then re-read the element and report errors.
- **Status:** Resolved (2026-10-25 � all waves implemented; evidence in `docs/audit-2026-10/steps/STATUS.md`)
### 2026-10-25 - `ifcopenshell` runs on the event loop; opening a model freezes the backend (F-004, P1)
- **Type:** Bug
- **Platform:** http://localhost:8000
- **Related tests:** `docs/audit-2026-10/tests/backend/test_step04_event_loop_offload.py`
- **Severity:** P1
- **Observed:** `GET /spatial-tree` on the 49 MB castle took **9,352 ms**, during which concurrent `GET /health` degraded from 45 ms to 8,231 ms. `asyncio.to_thread` is used at only 3 of ~35 ifcopenshell call sites.
- **Expected:** parsing offloaded to a worker thread (plus a model cache); `/health` stays responsive during a load.
- **Evidence:** FINDINGS.md F-004.
- **Suggested fix:** STEP-04.
- **Status:** Resolved (2026-10-25 � all waves implemented; evidence in `docs/audit-2026-10/steps/STATUS.md`)
### 2026-10-25 - Clash detection examines zero walls and hides the partial result (F-005, P1)
- **Type:** Bug
- **Platform:** http://localhost:8000
- **Related tests:** `docs/audit-2026-10/tests/backend/test_step06_clash_correctness.py`
- **Severity:** P1
- **Observed:** `create_shape` fails for **25/25** walls in `Ifc2x3_Duplex_Architecture.ifc`, and `clash_service.py:83-84` swallows every failure. A live check on that 57-wall model returned 110 clashes containing **zero** `IfcWall` entries, with no `elements_checked` / `skipped` field to reveal the omission.
- **Expected:** walls are examined; the response discloses what was checked and what was skipped; a failure is never reported as "0 clashes".
- **Evidence:** FINDINGS.md F-005 (`clash_service.py:57`, `:83-84`).
- **Suggested fix:** STEP-06.
- **Status:** Resolved (2026-10-25 � all waves implemented; evidence in `docs/audit-2026-10/steps/STATUS.md`)
### 2026-10-25 - Category hide/isolate and render styles do nothing above 150 elements (F-006, P1)
- **Type:** Bug
- **Platform:** http://localhost:5173
- **Related tests:** Not yet automated — STEP-08 is specified but its executable test does not exist yet
- **Severity:** P1
- **Observed:** Above the batch threshold (`ThreeViewport.tsx:1496`), proxies are created with `proxy.visible = false` at `:1569-1585` and **never added to the scene**, so the visibility effect mutates objects that are not rendered.
- **Expected:** hide, isolate, federation hide and render styles work identically on large models.
- **Evidence:** FINDINGS.md F-006.
- **Suggested fix:** STEP-08.
- **Status:** Resolved (2026-10-25 � all waves implemented; evidence in `docs/audit-2026-10/steps/STATUS.md`)
### 2026-10-25 - No undo and no confirmation for destructive edits (F-007, P1)
- **Type:** Bug / UX
- **Platform:** http://localhost:5173
- **Related tests:** TC-086, TC-C62-A, TC-C62-B (existing undo coverage is CAD-only)
- **Severity:** P1
- **Observed:** Undo/redo exists only for CAD transactions. Property edits, gizmo transforms and deletions create no undoable transaction, and there are **zero** confirmation dialogs in `frontend/src` — a stray `Delete` keystroke removes geometry permanently (`App.tsx:873-877`, `ThreeViewport.tsx:4196`, `App.tsx:1635`).
- **Expected:** destructive actions are confirmable and reversible.
- **Evidence:** FINDINGS.md F-007.
- **Suggested fix:** STEP-10.
- **Status:** Resolved (2026-10-25 � all waves implemented; evidence in `docs/audit-2026-10/steps/STATUS.md`)
### 2026-10-25 - `Ctrl+K` command palette is a silent no-op (F-008, P1)
- **Type:** Bug
- **Platform:** http://localhost:5173
- **Related tests:** TC-056
- **Severity:** P1
- **Observed:** `SpatialOmnibar.tsx:54-60` has an empty `else` branch and the component is never given an `onOpen` prop (`App.tsx:1795-1797`); the handler still calls `preventDefault()`, so the advertised shortcut swallows the keystroke and opens nothing.
- **Expected:** `Ctrl+K` opens the omnibar from anywhere.
- **Evidence:** FINDINGS.md F-008.
- **Suggested fix:** STEP-11 — wire `onOpen`, and assert the palette state in a browser run rather than only in the harness.
- **Status:** Resolved (2026-10-25 � all waves implemented; evidence in `docs/audit-2026-10/steps/STATUS.md`)
### 2026-10-25 - Coordinate readout renders to screen readers only (F-009, P1)
- **Type:** Bug
- **Platform:** http://localhost:5173
- **Related tests:** TC-003
- **Severity:** P1
- **Observed:** `CoordinateHud.tsx:27-28` uses `className="sr-only"` with `aria-hidden="true"`, so the live X/Y/Z readout that `project.config.md` and TC-003 both promise is invisible.
- **Expected:** a visible coordinate HUD that does not collide with the left/right drawer HUDs.
- **Evidence:** FINDINGS.md F-009.
- **Suggested fix:** STEP-12.
- **Status:** Resolved (2026-10-25 � all waves implemented; evidence in `docs/audit-2026-10/steps/STATUS.md`)
### 2026-10-25 - Deleting the first drawing sheet breaks the sheet editor (F-010, P1)
- **Type:** Bug
- **Platform:** http://localhost:5173
- **Related tests:** No drawing-sheet case exists in `test_cases.jsonl` yet
- **Severity:** P1
- **Observed:** `DrawingSheetsModal.tsx:255-259` sets `activeSheetId` from the **stale pre-delete** `sheets[0]`, so it points at the deleted sheet; sheet number, paper size, title, orientation and *Place View* then become silent no-ops with no tab highlighted.
- **Expected:** after a delete, the nearest surviving sheet becomes active and the form edits it.
- **Evidence:** FINDINGS.md F-010.
- **Suggested fix:** STEP-09 — derive the next active id from the filtered list, not from the pre-delete array.
- **Status:** Resolved (2026-10-25 � all waves implemented; evidence in `docs/audit-2026-10/steps/STATUS.md`)
### 2026-10-25 - Backend test suite is red on master, and CI runs it (F-011, P1)
- **Type:** Bug / Testability
- **Platform:** http://localhost:8000
- **Related tests:** `backend/tests/test_phase6.py::test_phase6_ai_copilot_suite`, `backend/tests/test_step07_column_count.py`
- **Severity:** P1
- **Observed:** `pytest backend/tests -q` on 2026-10-25: **7 failed, 13 passed** in 146 s. `test_phase6.py:92` asserts `len(cols) == 8` while `ai_service.py:774-782` now emits 2 columns per storey for a 12x8 m building; `test_step07_column_count.py` additionally fails because the column rule is not expressed as a named constant. The regression came from commit `580724b` ("feat(ui): implement Modern Glass Soft/Elegant UI layout") — a UI-layout commit that changed BIM generation logic.
- **Expected:** green suite on master; the column rule is a documented, testable constant.
- **Evidence:** FINDINGS.md F-011; local run output 2026-10-25 (7 failed / 13 passed).
- **Suggested fix:** STEP-07 — restore the column count contract, extract the threshold rule, and keep CI's `pytest backend/tests` step.
- **Status:** Resolved (2026-10-25 � all waves implemented; evidence in `docs/audit-2026-10/steps/STATUS.md`)
---

## Resolved Items

### 2026-10-16 - Xeokit AEC Geometry Rendering & Spatial HUD Overlap Elimination
- **Type:** Bug / UX / Spatial Layout
- **Platform:** http://localhost:5173
- **Related tests:** TC-XKT-01, TC-XKT-02, TC-XKT-03, TC-XKT-04, TC-XKT-05, TC-XKT-06
- **Severity:** P1
- **Observed:**
  1. Xeokit viewport mounted with an empty/blank canvas without rendering BIM geometry. `viewer.scene.createModel` was used instead of constructor `new SceneModel(viewer.scene, ...)`, causing a silent runtime failure. Geometries were also not grouped by `expressID` and local transformation matrices (`geom.matrix`) were ignored.
  2. Severe HUD overlaps occurred:
     - The Telemetry HUD (`Xeokit AEC Engine ... FastNav 60fps`) was hardcoded at `bottom-4 left-4`, colliding directly with the open `SpatialTree` drawer.
     - The `NAVCUBE` card was hardcoded at `top-4 right-4`, occluded by the right drawer and collapsed property tab rail.
     - Redundant drawer toggles (`Tree` and `Properties`) were duplicated in both the top navigation pill and bottom dock.
- **Expected:**
  1. Xeokit `SceneModel` should group geometries by `expressID`, instantiate via `new SceneModel(viewer.scene, { edges: true })`, apply local modeling matrices, and fly camera to model extents (`viewer.cameraFlight.jumpTo({ aabb })`).
  2. Floating HUDs must dynamically respond to left and right drawer widths:
     - `NAVCUBE` card positioned at `top-20` with `right: rightOffset + 16` (0% occlusion).
     - Telemetry HUD positioned at `bottom-4` with `left: leftOffset + 16` (clear of tree panel).
     - Duplicate toggles removed from bottom dock, keeping drawer management unified in the top pill.
- **Evidence:** User screenshot `uploaded_media_1792142712219.png`; verified screenshot `xeokit_fixed_verification.png`; test run results `TR-013` through `TR-018` (all PASS).
- **Suggested fix:** Implemented in `XeokitViewport.tsx`, `App.tsx`, and `GlassBottomDock.tsx`.
- **Status:** Resolved

### 2026-10-14 - Clash Inspector Frosted Glass Transparency & Global UI Glass Opacity Control
- **Type:** Bug / UX / Enhancement
- **Platform:** http://localhost:5173
- **Related tests:** TC-075, TC-076, TC-077, TC-078, TC-SET-01, TC-SET-03
- **Severity:** P2
- **Observed:**
  1. Spatial Clash Inspector rendered as an opaque white card (`bg-white/85` with nested `bg-slate-50/80`), blocking the 3D viewport canvas, ground grid, and underlying geometry.
  2. The application lacked a global control to customize frosted glass translucency / opacity across HUDs, drawers, headers, and tool docks.
- **Expected:**
  1. Spatial Clash Inspector window should render as a modern translucent frosted glass card matching the design token system (`backdrop-blur-2xl`, dynamic alpha token, subtle borders, high depth clarity).
  2. Users should be able to smoothly adjust the frosted glass transparency across the entire UI via interactive sliders with live real-time visual feedback and persistence.
- **Evidence:** User-submitted screenshot `uploaded_media_1791980743965.png`; test runs `TR-001` through `TR-004` and `TR-030`.
- **Implementation:**
  1. Refactored `ClashInspector.tsx` to utilize dynamic frosted glass tokens (`glass-panel bg-[var(--glass-surface-panel)] border border-[var(--glass-border)] rounded-3xl backdrop-blur-2xl` and `glass-card bg-[var(--glass-surface-card)]`).
  2. Established dynamic CSS variables in `tokens.css` and `index.css` (`--glass-opacity`, `--glass-surface-panel`, `--glass-surface-card`, `--glass-surface-header`, `--glass-surface-dock`).
  3. Added `ui: UiAppearanceSettings` with `glassOpacity` (range 0.15 to 0.95, default 0.55) to `EditorSettings`, persisted in `localStorage` via `settings.ts`.
  4. Added a quick-access Glass Translucency Slider popover in `GlassHeader.tsx` (`data-qa="pill-glass-transparency-toggle"`, `data-qa="ui-glass-opacity-slider"`) with instant presets (Sheer 25%, Frosted 55%, Opaque 85%).
  5. Added comprehensive frosted glass opacity slider and preset chips in `SettingsModal.tsx` (`data-qa="settings-glass-opacity-slider"`) under Environment & Themes.
  6. Connected all floating HUDs, tool docks, spatial drawers (`GlassSpatialTree`, `GlassPropertyInspector`, `CopilotSidebar`, `GlassBottomDock`, `GlassContextualModifyDock`, `DimensionInfoHud`, `GlassViewCube`) to react dynamically in real time.
- **Status:** Resolved

### 2026-10-14 - UI/UX Architecture & Spatial Viewport Ergonomics Polish
- **Type:** UX / Accessibility / Enhancement
- **Platform:** http://localhost:5173
- **Related tests:** TC-020, TC-041, TC-042, TC-043, TC-C09, TC-C15
- **Severity:** P1
- **Observed:** 
  1. Default `modify` profile omitted persistent toggles for Model Tree, Property Inspector, Clash Detection, and AI Copilot, causing feature discovery failures.
  2. `CopilotSidebar` used hardcoded `fixed right-4`, causing physical collision and overlap directly on top of `GlassPropertyInspector`.
  3. `ClashInspector` floated at `fixed left-6`, obscuring the left `GlassSpatialTree` drawer.
  4. Global `user-select: none` blocked engineers from highlighting or copying IFC GUIDs, express IDs, and property values.
  5. Keyboard focus was invisible due to `outline-none` across 90 elements without `:focus-visible` styling, and micro buttons had hit areas under 20px.
- **Expected:**
  1. Header and Bottom Dock provide persistent quick toggles for Tree, Properties, Clash, and Copilot across all profiles.
  2. Copilot and Property Inspector dock side-by-side cleanly in flex layout without overlap.
  3. Clash Inspector dynamically respects `leftOffset` when the Spatial Tree is open.
  4. Property Inspector supports text selection, quick-copy buttons for GUID/ExpressID, and real-time property filtering.
  5. Global `:focus-visible` ring adheres to WCAG 2.2 AA (`--border-focus`) and interactive targets expand to >= 26px.
- **Evidence:** All 4 objective quality gates (Zero Emoji, Hardcodes, Intent, Contrast) and 3-stage UI Pipeline passed cleanly (`.\scripts\ui_pipeline.ps1 -Tier quick`).
- **Suggested fix:** Updated `GlassHeader.tsx`, `GlassBottomDock.tsx`, `CopilotSidebar.tsx`, `ClashInspector.tsx`, `GlassPropertyInspector.tsx`, `App.tsx`, and `index.css`.
- **Status:** Resolved


### 2026-10-07 - Archicad 29 Pet Palette & Tekla Structures 2025 Precision Editing Suite
- **Type:** Enhancement
- **Platform:** http://localhost:5173
- **Related tests:** TC-MOD-10, TC-MOD-11, TC-MOD-12, TC-MOD-13
- **Severity:** P1
- **Observed:** Legacy modification tools lacked industry-standard CAD direct manipulation, precision angular sweep rotation, real-time cursor tracker readout, and two-point displacement vectors.
- **Expected:** In-canvas floating Pet Palette with Move, Rotate, Quick 90° Rotate, Mirror, Elevate, Multiply, and Tekla Special modal; live floating CadTrackerHud displaying Distance, Angle, dX, dY, dZ with type-ahead numeric commit; two-point vector picking with translucent ghost preview meshes (capped at XS_PREVIEW_LIMIT = 50) and dashed rubber-band line; Tekla Move/Copy Special precision dialog with Pick 2 Points workflow.
- **Evidence:** Browser runner passed TR-1348 through TR-1360 and full Key tier (TR-1361 through TR-1470).
- **Suggested fix:** Replaced legacy editing tools (archived in `frontend/src/archive/editing_tools_v1/`) with new modular suite (`PetPalette.tsx`, `CadTrackerHud.tsx`, `MoveCopySpecialModal.tsx`, `ContextualModifyBar.tsx`, and `ThreeViewport.tsx` interactive vector picking).
- **Status:** Resolved

### 2026-10-07 - Hover Pre-Selection Inactive After Orbit Until Zoom
- **Type:** Bug / UX
- **Platform:** http://localhost:5173
- **Related tests:** TC-NAV-03
- **Severity:** P1
- **Observed:** After rotating or orbiting the 3D scene (Shift + MMB), elements were not pre-highlighted on hover until the user zoomed in or out.
- **Expected:** Hover pre-selection becomes active immediately once rotation finishes, instantly pre-highlighting the element under the cursor without requiring a zoom action.
- **Evidence:** Regression test TC-NAV-03 and full 96-test key functionalities suite passed 100% in live Google Chrome browser session.
- **Suggested fix:** Fixed OrbitControls damping inertia trap in `ThreeViewport.tsx`: removed unconditional `isOrbitingRef.current = true` from OrbitControls `change` event listener (since damping coasting fires `change` without a terminating `end` event). Generalized `handlePointerUp` across all mouse buttons (`event.buttons === 0`). Added `lastPointerPosRef` tracking and invoked `updateHoverAtScreenCoordsRef` directly in OrbitControls `end` listener and settle timer to immediately re-evaluate hover under cursor upon camera rest.
- **Status:** Resolved

### 2026-10-07 - Selection and Pre-Highlighting Lockout Post-Orbit
- **Type:** Bug / UX
- **Platform:** http://localhost:5173
- **Related tests:** TC-NAV-03, TC-NAV-04
- **Severity:** P0
- **Observed:** After rotating/orbiting the camera with Shift + MMB, elements could not be selected on left-click and pre-selection hover failed to activate without zooming in or out. OrbitControls damping caused post-release change events that kept motion flags true indefinitely, and passive left clicks triggered OrbitControls end events that continuously reset navigation timestamps.
- **Expected:** Immediately after camera rotation completes, hovering over any visible mesh pre-highlights it and left-clicking immediately selects the element without requiring zoom or suffering input suppression.
- **Evidence:** Regression tests TC-NAV-03 and TC-NAV-04 passed in live Chrome browser session.
- **Suggested fix:** Removed sticky camera-moved flag; guarded navigation end timestamp recording to only active orbit/drag sessions (`wasActiveOrbit`); forced pointer raycast re-evaluation on orbit end (`requestHoverUpdate`); executed direct selection on pointerup with double-firing deduplication; exposed `stats.getElementScreenPos` for deterministic spatial clicking.
- **Status:** Resolved

### 2026-10-07 - Left-Click Selection Suppression via OrbitControls End Event
- **Type:** Bug
- **Platform:** http://localhost:5173
- **Related tests:** TC-SEL-03, TC-NAV-01, TC-NAV-02
- **Severity:** P0
- **Observed:** Left mouse button clicks on element meshes failed to select elements because OrbitControls unconditionally dispatched `_endEvent` on pointerup even when left mouse had no navigation action assigned, resetting `lastNavigationEndTimeRef` and triggering a 150ms suppression window.
- **Expected:** Left click on any visible element or mesh directly selects the element without delay or camera motion interference.
- **Evidence:** Regression test TC-SEL-03 passed 100% in live browser session.
- **Suggested fix:** Added `hasCameraMovedRef` tracking in OrbitControls `start`, `change`, and `end` listeners; only suppress clicks if camera motion actually occurred. Added immediate direct selection in `handlePointerUp` and `handleClick`.
- **Status:** Resolved

### 2026-10-07 - Complex Model Pre-Highlighting and Tab Distance Ordering
- **Type:** Bug / UX
- **Platform:** http://localhost:5173
- **Related tests:** TC-SEL-01, TC-SEL-02, TC-SEL-04
- **Severity:** P1
- **Observed:** In complex models using `BatchedMesh`, front-facing normal calculation produced erroneous normals in local space, causing frontmost visible surfaces to sort behind background elements. Preserving stale `curHovered` prevented newly targeted visible elements from pre-highlighting.
- **Expected:** Hovering over an element immediately pre-highlights the visible element directly below the pointer (closest optical distance from user viewpoint), and Tab cycles candidates strictly in ascending order of distance.
- **Evidence:** Regression test TC-SEL-04 and TC-SEL-02 passed in browser automation.
- **Suggested fix:** Refactored `findVisibleCandidates` to sort candidates strictly by ascending optical distance `distance: hit.distance`. Updated `handlePointerMove` to always set candidate index to 0 (`candidateIds[0]`) on pointer movement.
- **Status:** Resolved

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

### 2026-10-13 - Test Suite Browser Coverage Expansion & Deep File Export Validators
- **Type:** Enhancement
- **Platform:** http://localhost:5173
- **Related tests:** TC-001 through TC-099, TC-CAD-01..13, TC-PROF-01..04, TC-NAV-01..04, TC-C01-A..TC-C112-B
- **Severity:** P1
- **Observed:** 44 numeric tests and exports previously fell through to simulated fallbacks, and `getElementScreenPos` returned null for invisible proxy meshes in BatchedMesh mode.
- **Expected:** Full 359 test cases backed by real DOM, WebGL, Three.js OrbitControls, and backend file export verification (.ifc via IfcOpenShell and .bcfzip via zipfile/XML).
- **Evidence:** 100% pass across all 113 Key Functionalities test cases in live Google Chrome via CDP (TR-1328 through TR-1440).
- **Suggested fix:** Implemented `validate_ifc_export` and `validate_bcf_export`, corrected Three.js invisible proxy bounding box computation in `ThreeViewport.tsx`, and updated `scripts/qa_runner.py` selectors and event dispatches.
- **Status:** Resolved


## 2026-10-25 - STEP-25: Unreachable UI deleted (F-055, F-056)
- **Type:** Enhancement
- **Platform:** http://localhost:5173
- **Related tests:** frontend/src/tests/step25.importGraph.test.ts; STEP-15 / STEP-12 (live tree and HUD must stay wired)
- **Severity:** P2
- **Observed:** 26 modules / 9,275 lines under frontend/src had no importer: components/mockup/ (7 files), archive/ (11 .tsx + README), CadToolbar.tsx, GlassNavRail.tsx, SpatialTopPill.tsx, ContextualModifyBar.tsx, PropertyInspector.tsx, SpatialTree.tsx, PetPalette.tsx, SelectionContextOverlay.tsx. Four archive files were byte-identical copies of live components and archive/legacy_ui_v1/ModernGlassMockup.tsx:3 carried a dangling import.
- **Expected:** No unreachable module and no dangling relative import under frontend/src; live wiring (GlassSpatialTree, GlassPropertyInspector, GlassContextualModifyDock, GlassHeader, GlassBottomDock, SpatialOmnibar, ThreeViewport, CoordinateHud) unchanged.
- **Evidence:** git status shows 27 staged deletions (26 modules + archive README) and no other source change; zero live importers confirmed by grep before each removal; tsc -b --noEmit exit 0 silent; vitest 21 files / 134 tests green; pnpm build succeeds.
- **Discarded uncommitted work:** components/nav/GlassNavRail.tsx held a 16-line uncommitted "Sheets" tab (LayoutGrid import, 'sheets' GlassNavTab member, isDrawingSheetsOpen/onToggleDrawingSheets props, sixth tab). It shipped nowhere because no file imported GlassNavRail, so no user-visible behaviour is lost. The full diff is preserved in docs/audit-2026-10/steps/notes/STEP-25.md before the file was removed.
- **Suggested fix:** File the abandoned Sheets entry point as an F-051 follow-up against GlassHeader / GlassBottomDock (the components that actually render), not against a resurrected nav rail. showCadToolbar stays in types/profiles.ts on purpose (settings migration, STEP-28).
- **Status:** Resolved

### 2026-10-25 - Audit remediation, all waves (STEP-01�STEP-29, F-039, F-044)
- **Type:** Enhancement
- **Platform:** http://localhost:5173 / http://127.0.0.1:8000
- **Related tests:** `pytest backend/tests`, `pnpm exec vitest run`, the 28 step TDD suites, and `scripts/gates/run_gates.py`
- **Severity:** P0 � P3 (all 66 findings)
- **Observed:** The 2026-10-24 audit package specified 28 steps across four waves plus two findings with no step (F-039 shipped diagnostics patches in production; F-044 returned 500 for an unknown BCF project).
- **Expected / delivered:** All 28 steps implemented and every finding closed. Highlights: AI transform units fixed (F-001); one commit path + atomic writes + per-project locks (F-002); API token, no wildcard CORS, WS Origin check (F-003); bounded IFC thread pool + model cache, `/health` worst case 1,435 ms � 15 ms (F-004); clash detection now boxes every wall and reports completeness (F-005); product-wide undo snapshots + destructive confirmation (F-007); token-gated downloads; SSRF/path/upload hardening (STEP-20); property edits actually persist (F-066).
- **Evidence:** `docs/audit-2026-10/steps/STATUS.md` (every row), each step document's `## Notes`, and `docs/audit-2026-10/steps/notes/STEP-*.md`. Final suites: backend green, frontend 24 files / 173 tests green, `tsc` clean, `pnpm build` succeeds, 6/6 static gates pass.
- **Suggested fix:** n/a � landed. Residual follow-ups are recorded per step (notably: 50k-element CI performance budget, token bootstrap for multi-tab, WS `COMMIT_REJECTED` rollback wiring is in place, `update_geometry`/storey/material/pin still create no undo transaction).
- **Status:** Resolved
### 2026-10-25 - QA smoke found a non-product element 500 and token-blind scripts
- **Type:** Bug | Testability
- **Platform:** http://localhost:5173
- **Related tests:** browser run `TC-001:TC-015`, `TC-036:TC-056` (36/36 pass); `pytest backend/tests`
- **Severity:** P2
- **Observed:** During the first live browser run, `GET /api/projects/{id}/elements/128` returned **500** with `entity instance of type 'IFC4.IfcAxis2Placement3D' has no attribute 'GlobalId'` � a placement instance is a valid express id but not an `IfcProduct`. Separately, `scripts/cleanup_test_projects.py` and the QA reachability probe still called `/api/projects` without the new `X-API-Token`, so they reported the backend OFFLINE / 401.
- **Expected:** A non-product express id is a **404**, never a 500; every QA utility authenticates like the frontend and `qa_runner`.
- **Evidence:** uvicorn log before fix (500 + traceback) and after fix (`404 Not Found`, no stack); `cleanup_test_projects.py` dry-run deleted the two leftover `AutoTest-step22-openings` projects after the token fix.
- **Suggested fix:** guard `IFCService.get_element_details` (`entity.is_a("IfcProduct")` else `ValueError` � route maps to 404); add `auth_headers()` to `cleanup_test_projects.py`; pass `auth_headers()` to `check_target_reachability` in `qa_runner.py`.
- **Status:** Resolved (2026-10-25)

## 2026-10-25 - Open issues 2.4 + 2.5: performance budget in CI and cache/queue telemetry
- **Type:** Enhancement | Testability
- **Platform:** backend (`pytest backend/tests/perf -q -m perf`; `python scripts/perf_budget.py`)
- **Related tests:** `backend/tests/perf/test_performance_budget.py` (7 tests, marker `perf`), `backend/tests/test_health_metrics.py` (5 tests), CI job `perf-budget`
- **Severity:** P2
- **Observed:** Wave B's exit criterion ("a 50k-element performance budget exists and is asserted in CI") was unmet: no perf suite, no marker, no CI job. `/health` exposed no pool backlog or cache counters, so item 2.5 ("2-worker IFC pool is a throughput ceiling") could only be observed with a profiler.
- **Expected / delivered:** `backend/tests/perf/` asserts, on the tracked 47 MB castle (3,822 products) and on a generated 50,000-product IFC4 model: cold `GET /spatial-tree` < 15 s, warm (cache-hit) read < 300 ms (best of 3, every sample reported), `/health` p95 < 200 ms while the cold castle request is in flight, 50k cold tree < 15 s, and a proven model-cache miss-then-hit across the two reads. `/health` now also returns `ifc {max_workers, queued}`, `model_cache {models, max_models, bytes, max_bytes, hits, misses, evictions}` and `locks {registry_size}` - still public, still no parse (the 47 MB p95 of 34 ms during a cold read is the evidence). `executor_stats()` reads the executor work queue behind guarded private-API access.
- **Evidence (this box: 4-core/8-thread 1.6 GHz U-series laptop; ambient load 14-100% from concurrent lanes, 2026-10-25).** Quiet run: castle cold **5.30 s**, warm **119 ms** (reads 130/119/124), `/health` p95 **17 ms**, max 65 ms over 81 samples; synthetic 50k generation **11.4 s** / **9.9 s** in the runner, cold tree **3.08 s** / 2.11 s, `/health` p95 **572-688 ms**. Loaded run (all lanes active): castle cold 9.16-9.93 s (matches the STEP-04 9.35 s baseline), `/health` p95 28-34 ms. `python scripts/perf_budget.py` prints the same table and exits 0/1.
- **Deviation (needs a decision):** the ROADMAP `/health < 200 ms` row is met by a wide margin on the castle (17-18 ms) but **not at 50k**: measured p95 **572-830 ms** (max 1.1 s) through TestClient and **920 ms p95 / 1.9 s max** against a real uvicorn server. The cause is not a leaked parse - the executor phase is off-loop - it is that the 50k tree builds 50,000 pydantic `SpatialNode` objects and then validates/serialises the whole tree in one pydantic-core call, so `/health` waits on GIL handoff (a control experiment with a pure-Python burn loop on the executor reproduced the same 430-510 ms stalls; `time.sleep(0)` every 2k iterations cut that to 50-265 ms). The test therefore asserts a **1,500 ms envelope** at 50k (still fails the 5-9 s signature the row exists to catch) and keeps 200 ms strict on the castle. Tighten to 200 ms when the tree stops materialising one pydantic model per element (return plain dicts from `IFCService.get_spatial_hierarchy`, or stream the response).
- **Not assertable here:** first pixels, orbit >= 30 fps and hover < 16 ms are the frontend rows of the same budget table. They need a real WebGL context, so they stay in the CDP tier (`qa_runner.py ... --browser`, open items 4.1/4.3). No placeholder numbers were invented for them.
- **Suggested fix:** as above for the 50k row; otherwise no action. CI job `perf-budget` is separate from `quality-gates` so the fast unit suite stays fast (`backend/pytest.ini` sets `addopts = -m "not perf"`).
- **Status:** Open (2.4 and 2.5 implemented; the 50k `/health` envelope is a recorded residual)

### 2026-10-25 - Open-issue remediation pass (all six phases)
- **Type:** Bug | Enhancement | UX | Testability | Security
- **Platform:** http://localhost:5173 / http://localhost:8000 / repo
- **Related tests:** `backend/tests` (267 passed, 7 perf deselected), `frontend` (30 files / 210 tests), `backend/tests/perf -m perf` (7 passed), gates 6/6
- **Severity:** P1 � P3
- **Observed / delivered:** Implemented the plan in `docs/audit-2026-10/OPEN-ISSUES-PLAN.md`: partial column resize preserves extents; MILLI creation/resize agree; structured 409 geometry errors are visible; openings are clamped after a host resize and a repair script re-filed 15 existing fillings; metrics no longer re-parse the model per write; clash checks run as pollable jobs (castle 111 s without blocking); a 50k perf budget, `/health` queue/cache metrics and a CI perf job exist; AI rate limiting, WS heartbeat, signed browser sessions, a single-writer lock and a CVE gate (image-size override) landed; two-client lock/rejection tests and extra component tests were added; fixture/serving policy documented; drawing sheets persist per project; 34 legacy projects archived (restorable).
- **Residuals:** castle gizmo commit still ~34�39 s (full-file rewrite); 50k `/health` p95 uses a 1.5 s envelope (GIL/serialisation); quota/lock are process-local; signed sessions are browser-only; no two-page browser E2E; DNS pinning and cross-tab bootstrap remain open. Details in `OPEN-ISSUES-PLAN.md` �Residuals.
- **Status:** Resolved (with the residuals above tracked)