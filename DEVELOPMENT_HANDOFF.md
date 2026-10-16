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

*(None at this time. All 359 test cases passing with zero P0-P3 regressions: 113 key functionalities and 246 milestone tests.)*

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

