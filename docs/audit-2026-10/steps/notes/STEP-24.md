# STEP-24 — Drawings render performance + modal accessibility · handoff notes

## 2026-10-25 - Preview batches to two paths, per-view cache, non-passive wheel, real focus trap
- **Type:** Bug
- **Platform:** http://localhost:5173
- **Related tests:** TC-120 (Sheet Composer opens), TC-125 (sheet zoom), TC-126 (Escape closes sheet)
- **Severity:** P2
- **Observed:** (1) The sheet preview rendered one SVG `<line>` per wall segment while the export path
  next to it already batched the same segments into two `<path>` elements — the preview was an order of
  magnitude heavier than the thing it previewed, and every change rebuilt **every** view synchronously
  (`setVectorCache(newMap)` discarded the whole cache). (2) The dialog declared
  `role="dialog" aria-modal="true"` with no focus trap, no focus restore and no local Escape handler, so
  a keyboard user who opened it landed behind it and could not close it. (3) `e.preventDefault()` sat
  inside a React `onWheel` prop; React attaches `wheel` passively at the root, so Chromium logged
  "Unable to preventDefault inside passive event listener invocation" on every trackpad scroll over the
  sheet.
- **Expected:** At most two `<path>` elements per viewport in the preview and in the export; only
  genuinely stale views recomputed, one per animation frame, merged additively into the cache; a single
  non-passive wheel listener; focus enters the dialog on open, `Tab`/`Shift+Tab` cycle inside it,
  `Escape` closes it and focus returns to the trigger.
- **Evidence (applied, measured):**
  - `pnpm exec vitest run src/tests/step24.drawingsPerf.test.ts` → **11 passed**.
  - `pnpm exec vitest run src/tests/step24.drawingsA11y.test.tsx` → **5 passed** (renders 2 `<path>`
    and 0 `<line>` inside `[data-qa^="sheet-viewport-"]`, Escape calls `onClose`, focus moves in,
    `Tab` wraps inside the dialog, a `WheelEvent` on the modal does not throw).
  - `pnpm exec vitest run` → 19 files / 128 passed, 1 failed (the STEP-09 `useSpatialSelection`
    deferral, unrelated to this step).
  - `pnpm exec tsc -b --noEmit` → 0; `pnpm run build` → built in 5.96 s.
  - `frontend/src/tests/drawings.test.ts` still passes unchanged (export layout, title block,
    `SCALE 1:100`, `id="viewport-vp-1"`).
- **Suggested fix (applied):**
  - `frontend/src/services/drawingEngine.ts`: `buildViewportPathData(lines, transform, precision = 2)`
    → `{ cut, projection }` (one `M` command per line, Y inverted once); `recomputeViewIds(previous,
    next, cached)` → ids missing from the cache or whose `cutPlane.axis`/`position` moved;
    `exportSheetToSvg` now calls the shared helper (the export half of F-029 was always correct — the
    finding is about the preview, which is why the helper is shared rather than duplicated).
  - `frontend/src/services/wheelZoom.ts` (**new**): `createWheelZoom(target, { onZoom })` registers
    exactly one `wheel` listener with `{ passive: false }`, calls `preventDefault()` once, classifies
    `deltaY < 0` as `'in'`, and returns a disposer.
  - `frontend/src/hooks/modalFocus.ts` (**new**): pure `nextFocusIndex(current, total, shift)` plus
    `useModalFocusTrap(ref, { active, onEscape })` — stores `document.activeElement`, focuses the first
    focusable descendant, wraps `Tab`, routes `Escape`, restores focus on cleanup. The focusable list is
    selector-based (no `offsetParent` filtering) so it behaves identically in jsdom and in a browser.
  - `frontend/src/components/drawings/DrawingSheetsModal.tsx`: preview emits
    `[projection, cut]` `<path>` elements built by `buildViewportPathData`; cache merges through
    `vectorCacheRef` using `recomputeViewIds` and computes one view per
    `requestAnimationFrame` (timer fallback for non-visual hosts), cancelled on unmount/close, with a
    full invalidation when the geometry array identity changes (model reload ≠ view edit); the
    `onWheel` prop is gone, replaced by `createWheelZoom` on `boardRef` in an effect; `useModalFocusTrap`
    is mounted on the `role="dialog"` element with `onEscape={onClose}`.
- **Status:** Open — one item is outside this lane.

  **Deferred App wiring (`frontend/src/App.tsx`, integration lane).** `isDrawingSheetsOpen` is not in
  the global Escape guard at `:966`, so Escape with the sheet open falls through to "clear selection"
  (the modal's own `onEscape` fixes the close, but the guard must still not clear the selection first).
  Patch:

  ```tsx
  // frontend/src/App.tsx:966
  if (isOmnibarOpen || isUploadModalOpen || isNewProjectModalOpen || isBcfOpen || isFederationOpen || isSettingsOpen || isDrawingSheetsOpen) {
    if (isSettingsOpen) setIsSettingsOpen(false);
    if (isDrawingSheetsOpen) setIsDrawingSheetsOpen(false);
    return;
  }
  ```

  and add `isDrawingSheetsOpen` to the dependency array at `frontend/src/App.tsx:998-1009`:

  ```tsx
  }, [
    isOmnibarOpen,
    isUploadModalOpen,
    isNewProjectModalOpen,
    isBcfOpen,
    isFederationOpen,
    isDrawingSheetsOpen,
    selectedExpressID,
    handleSelectElement,
    activeDimension,
    isMeasureActive,
    cadToolMode
  ]);
  ```

- **Deviation from the audit test file:** the perf test's viewport assertion counted
  `<path d="M` occurrences and expected 2. Measured with the step's own `WALL` fixture the projection
  path is **empty** (the wall spans the cut plane end to end, so all 4 extracted segments are cut
  lines) and the real count is 1. The assertion now counts `<path ` elements (`toBe(2)`) and pins the
  cut path separately (`<path d="M` → 1); the cut/projection split is covered by the pure
  `buildViewportPathData` test. Both are the behaviour the audit describes — no implementation change
  was made to satisfy a miscounted assertion.
- **Not done (deliberately):** `extractPlanViewVectorData` / `extractSectionViewVectorData` geometry
  semantics were not touched; no canvas renderer, no worker-side drawing generation, no sub-component
  extraction of the 1,100-line modal.
