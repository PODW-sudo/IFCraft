# STEP-23 — Hover throttle, geometry disposal, scene teardown, Escape · handoff notes

## 2026-10-25 - Hover disposed the model's geometry and re-rendered per pixel
- **Type:** Bug
- **Platform:** http://localhost:5173
- **Related tests:** TC for hover preselection, selection contours, orbit performance, Escape during
  an interactive move
- **Severity:** P1
- **Observed:** `disposeHighlightGroup` called `geometry.dispose()` on every child of the highlight
  group, including the two overlays that borrow `mesh.geometry` (selection wash, hover wash). Every
  hover therefore freed a geometry the model still owned, forcing WebGL to re-upload it on the next
  hover — a slow, visible stall plus a per-hover GPU-memory churn. Separately, `pointermove` ran a
  full-scene raycast and `setHoverCandidates(newArray)` on every event (React re-render even when
  the hovered element did not change), the scene teardown never traversed the mesh group or disposed
  the shared material pools, `isLargeModel` was captured by an effect that always saw
  `geometries === []`, and the keydown effect's dependency array omitted `interactiveEditState` so
  Escape could not cancel an in-progress move/rotate.
- **Expected:** Hover never disposes model-owned geometry; three pointer moves inside one frame
  produce one raycast; an unchanged hover produces no state update; teardown disposes each geometry
  and pooled material exactly once and is idempotent; adaptive damping follows the real element
  count; Escape cancels an interactive edit.
- **Evidence:** `pnpm exec vitest run src/tests/step23.viewportPerf.test.ts` → 10 passed (red before
  implementation: 8 behaviour failures, incl. `dispose` called on the model geometry and
  `createNavigationTuning is not a function`). Full `pnpm exec vitest run` → 128 passed, 1 failed
  (`src/tests/step09.drawings.test.ts`, another lane). `pnpm exec tsc -b --noEmit` clean for the new
  modules and `ThreeViewport.tsx`; `pnpm exec vite build` succeeds. No frame-time or heap
  measurement was taken.
- **Suggested fix (applied):** new `highlightDisposal.ts` (`markSharedGeometry`,
  `disposeHighlightGroup` that skips `isSharedGeometry`), `hoverScheduler.ts` (rAF coalescing +
  value-dedupe, injectable frame queue), `sceneTeardown.ts` (`disposeSceneGraph` with `WeakSet`
  dedupe, pool disposal, registry clear, idempotent), `navigationTuning.ts`
  (`createNavigationTuning`). `ThreeViewport` marks both overlays shared, routes `pointermove`
  through the scheduler, caches one `EdgesGeometry` per element, calls `disposeSceneGraph` before
  `renderer.dispose()`, derives damping from one tuning object on `[geometries.length]`, and adds
  `interactiveEditState` / `onActiveInteractiveModeChange` / `onRotateElement` to the Escape deps.
- **Status:** Fixed — unit-verified for specs 1-9 and 11; spec 10 (Escape) is verified by review
  only. Browser/perf verification outstanding.

## 2026-10-25 - `updateHoverAtScreenCoordsRef` is never assigned (dead hover refresh path)
- **Type:** Bug
- **Platform:** http://localhost:5173
- **Related tests:** TC for hover preselection after orbiting the camera
- **Severity:** P3
- **Observed:** `ThreeViewport.tsx` declares `updateHoverAtScreenCoordsRef` and reads it in three
  places (camera-settle re-evaluation, the non-left-button `pointerup`, the measure/CAD
  `pointerup`), but nothing ever assigns it. All three paths are no-ops, so the preselection
  highlight does not come back under the cursor after an MMB orbit until the next real pointer move.
- **Expected:** After the camera settles (or after releasing MMB), hover is re-evaluated at the last
  pointer position, as the comments claim.
- **Evidence:** `Select-String -Path frontend/src/components/viewer/ThreeViewport.tsx -Pattern
  "updateHoverAtScreenCoordsRef\s*="` → 0 matches; declaration at `:780`, reads at `:1032`, `:1041`,
  `:3621`.
- **Suggested fix:** after the Step-23 scheduler exists, assign
  `updateHoverAtScreenCoordsRef.current = (x, y) => applyHoverNotification(updateHoverAtScreenCoords(x, y));`
  (direct call, not scheduled — these three paths want immediacy). Left unwired in this step to
  avoid changing post-orbit hover behaviour without a browser pass.
- **Status:** Open
