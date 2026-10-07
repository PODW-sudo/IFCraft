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

*(None at this time. All 70 test cases passing with zero P0-P3 regressions.)*

---

## Resolved Items

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
