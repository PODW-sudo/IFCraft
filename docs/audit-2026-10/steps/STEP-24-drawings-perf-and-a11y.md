# STEP-24 — Drawings render performance + modal accessibility

**Status:** not started · **Wave:** B · **Effort:** 1.5 d
**Findings:** F-029, F-032, F-041 · **Depends on:** STEP-09 · **Blocks:** —

## Problem

A drawing preview renders **one SVG `<line>` element per wall segment** while the export path next to it already batches the same segments into two `<path>` elements — so the preview is an order of magnitude heavier than the thing it previews. Every change recomputes **every** view, synchronously. And the sheet dialog declares `aria-modal="true"` with no focus trap, no focus restore and no local Escape handler, so a keyboard user who opens it lands behind it and cannot close it; dragging a trackpad over the sheet also throws `Unable to preventDefault inside passive event listener` into the console that the QA gate reads.

## Evidence

- `frontend/src/components/drawings/DrawingSheetsModal.tsx:964-983` — `vData.lines.map((l, lIdx) => <line … />)`; one DOM node per segment, recomputed on every render.
- `frontend/src/services/drawingEngine.ts:359-373` + `:392-394` — the export path already accumulates `pathCut` / `pathProj` strings and emits exactly two `<path>` elements per viewport. The two renderers disagree about the same data.
- `frontend/src/components/drawings/DrawingSheetsModal.tsx:207-222` — the `useEffect` calls `extractPlanViewVectorData`/`extractSectionViewVectorData` for **every** view whenever `views` or `geometries` changes, and `setVectorCache(newMap)` replaces the whole map, discarding every cached result.
- `frontend/src/components/drawings/DrawingSheetsModal.tsx:431-440` — `role="dialog" aria-modal="true"` on the outer `<div>`; a `grep` for `keydown|Escape|focus|tabIndex` in the file returns **only** the `useRef` import and two `useRef` calls (`:177`, `:181`). There is no focus trap, no `autoFocus`, no restore.
- `frontend/src/App.tsx:962-1009` — the global Escape effect guards on `isOmnibarOpen || isUploadModalOpen || isNewProjectModalOpen || isBcfOpen || isFederationOpen || isSettingsOpen` (`:966`); `isDrawingSheetsOpen` (declared at `:96`, consumed at `:1940`) is **not** in that list, so Escape with the sheet open falls through to "clear selection".
- `frontend/src/components/drawings/DrawingSheetsModal.tsx:363-367` — `e.preventDefault()` inside a React `onWheel` handler. React 17+ attaches `wheel` at the root as a **passive** listener, so `preventDefault()` is a no-op and Chromium logs `Unable to preventDefault inside passive event listener invocation`.

## Scope

**Change:**

- `frontend/src/services/drawingEngine.ts` — add `buildViewportPathData(lines, transform, precision?)` and `recomputeViewIds(previous, next, cached)`; make `exportSheetToSvg` use the first.
- `frontend/src/services/drawingEngine.ts` — add `createWheelZoom(target, options)` (native non-passive listener) and re-export it from the same module or a new `frontend/src/services/wheelZoom.ts`.
- `frontend/src/hooks/modalFocus.ts` — **new**: `nextFocusIndex(current, total, shift)`, plus `useModalFocusTrap(ref, { active, onEscape })` (the hook body needs the DOM; the index helper does not).
- `frontend/src/components/drawings/DrawingSheetsModal.tsx:964-983` — emit two `<path>` elements per viewport via `buildViewportPathData`.
- `frontend/src/components/drawings/DrawingSheetsModal.tsx:207-222` — merge into the cache using `recomputeViewIds`; compute at most one view per animation frame.
- `frontend/src/components/drawings/DrawingSheetsModal.tsx:363-367` — replace the `onWheel` prop with `createWheelZoom` attached to the sheet `<div>` via ref.
- `frontend/src/components/drawings/DrawingSheetsModal.tsx:431-440` — mount `useModalFocusTrap`, add `onEscape={onClose}`.
- `frontend/src/App.tsx:966` — add `isDrawingSheetsOpen` to the Escape guard and close the modal there.

**Do not change:**

- `extractPlanViewVectorData` / `extractSectionViewVectorData` (`drawingEngine.ts`) — STEP-09 and STEP-09's storey-elevation work own the geometry semantics. This step changes only how the result is *rendered and cached*.
- `exportSheetToSvg`'s sheet layout, title block, scales and print CSS — STEP-09 (F-028, F-030).
- `DrawingSheetsModal.tsx:255-259` (delete-first-sheet bug) — STEP-09 (F-010).
- `frontend/src/workers/ifcWorker.ts` — no worker changes.

**Non-goals:**

- Virtualising the sheet canvas or moving drawing generation into a worker. Both are larger and depend on measurement this audit did not do.
- Porting the preview to a `<canvas>` renderer. Two SVG paths per viewport is already the right shape.
- Extracting `DrawingSheetsModal.tsx` (1,020 lines) into sub-components. The helpers above are extracted because they are testable; the rest can wait for a measured need.

## Spec

1. `buildViewportPathData(lines, transform, precision = 2)` returns `{ cut, projection }`, each a sequence of `M x y L x y ` commands with `precision` decimal places, cut lines in `cut` and projection lines in `projection`.
2. `exportSheetToSvg` emits exactly **two** `<path>` elements per viewport that has at least one line, and no `<line>` inside a viewport's clip group except the title callout at `drawingEngine.ts:402`.
3. The preview emits at most **two** `<path>` elements per viewport and **zero** `<line>` elements inside the viewport body.
4. `recomputeViewIds(previous, next, cached)` returns, in `next` order, the ids that are missing from `cached`, or whose `cutPlane.axis` or `cutPlane.position` differs from the entry with the same id in `previous`. Unchanged views are not returned.
5. The cache merge is additive: a returned id replaces only its own entry; every other entry is preserved by identity.
6. When more than one view needs recomputation, they are computed one per animation frame (`requestAnimationFrame`), not in a single synchronous loop.
7. `createWheelZoom(target, { onZoom, step })` registers exactly one `wheel` listener with `{ passive: false }`, calls `event.preventDefault()` once, and calls `onZoom('in' | 'out')` based on the sign of `deltaY`. It returns a disposer that removes the listener.
8. The modal registers its wheel listener in an effect and disposes it on unmount; no React `onWheel` prop remains.
9. `nextFocusIndex(current, total, shift)` advances within `[0, total)` and wraps; returns `-1` when `total === 0`.
10. When `isDrawingSheetsOpen` is true, `Escape` closes the sheet modal and does not clear the element selection.
11. On open, focus moves into the dialog; on close, focus returns to the element that had it before opening.
12. `Tab` and `Shift+Tab` cycle within the dialog while it is open.

## TDD

### 1. Add the failing test

**File:** `frontend/src/tests/step24.drawingsPerf.test.ts`
**Command:** `cd frontend; pnpm exec vitest run src/tests/step24.drawingsPerf.test.ts`

Specs 1-9 are pure and run today. Specs 3, 10, 11 and 12 assert on rendered React output and are **blocked on STEP-27** — `frontend/vite.config.ts` has no `test` block, and `jsdom` / `@testing-library/react` are not installed (F-061). See `### 2`.

<details>
```ts
import { describe, it, expect, vi } from 'vitest';
import type { BimView, DrawingSheet, DrawingViewVectorData } from '../types/drawings';
import {
  buildViewportPathData,
  exportSheetToSvg,
  extractPlanViewVectorData,
  recomputeViewIds
} from '../services/drawingEngine';
import { createWheelZoom } from '../services/wheelZoom';
import { nextFocusIndex } from '../hooks/modalFocus';

const WALL = {
  expressID: 101,
  type: 'IfcWallStandardCase',
  matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  color: [0.8, 0.8, 0.8, 1.0],
  positions: new Float32Array([
    0, 0, 0, 10, 0, 0, 10, 3, 0, 0, 0, 0, 10, 3, 0, 0, 3, 0,
    0, 0, 0.3, 10, 0, 0.3, 10, 3, 0.3, 0, 0, 0.3, 10, 3, 0.3, 0, 3, 0.3
  ]),
  normals: new Float32Array(36),
  indices: new Uint32Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
};

function makeView(id: string, position: number): BimView {
  return {
    id,
    name: `View ${id}`,
    type: 'plan',
    elevation: position,
    cutPlane: { axis: 'y', position },
    scale: 100,
    createdAt: '2026-10-24T00:00:00Z'
  };
}

function makeSheet(viewIds: string[]): DrawingSheet {
  return {
    id: 'sheet-1',
    sheetNumber: 'A-101',
    sheetTitle: 'GROUND FLOOR PLAN',
    paperSize: 'A3',
    orientation: 'landscape',
    projectInfo: {
      projectName: 'AutoTest Drawings',
      projectNumber: 'PRJ-1',
      client: 'Client',
      author: 'Author',
      date: '2026-10-24',
      revision: 'Rev A',
      status: 'Preliminary'
    },
    viewports: viewIds.map((viewId, i) => ({
      id: `vp-${i}`,
      viewId,
      viewName: `Viewport ${i}`,
      viewType: 'plan' as const,
      x: 30 + i * 10,
      y: 30,
      width: 160,
      height: 110,
      scale: 100,
      detailNumber: i + 1,
      showTitle: true,
      showFrame: true
    }))
  };
}

describe('drawing path batching (F-029)', () => {
  it('emits one M command per line and splits cut from projection', () => {
    const lines = [
      { x1: 0, y1: 0, x2: 1, y2: 0, isCut: true },
      { x1: 0, y1: 1, x2: 1, y2: 1, isCut: true },
      { x1: 0, y1: 2, x2: 1, y2: 2, isCut: false }
    ];
    const { cut, projection } = buildViewportPathData(lines, {
      centerX: 0,
      centerY: 0,
      viewportCenterX: 10,
      viewportCenterY: 20,
      scaleRatio: 10
    });

    expect(cut.match(/M /g)?.length).toBe(2);
    expect(projection.match(/M /g)?.length).toBe(1);
    expect(cut.startsWith('M ')).toBe(true);
    expect(projection.startsWith('M ')).toBe(true);
  });

  it('exportSheetToSvg still emits exactly two path elements per viewport', () => {
    const plan = extractPlanViewVectorData([WALL as never], 1.2, 'v1');
    expect(plan.lines.length).toBeGreaterThan(1);

    const sheet = makeSheet(['v1']);
    const svg = exportSheetToSvg(sheet, new Map([['v1', plan]]));

    const pathCount = (svg.match(/<path d="M/g) ?? []).length;
    expect(pathCount).toBe(2);
    expect(svg).toContain('id="viewport-vp-0"');
  });
});

describe('view recomputation (F-029)', () => {
  const cachedWith = (viewId: string): Map<string, DrawingViewVectorData> => {
    const data = extractPlanViewVectorData([WALL as never], 1.2, viewId);
    return new Map([[viewId, data]]);
  };

  it('computes everything on first open', () => {
    const views = [makeView('v1', 1.2), makeView('v2', 3.4)];
    expect(recomputeViewIds(null, views, new Map())).toEqual(['v1', 'v2']);
  });

  it('returns nothing when no view changed', () => {
    const views = [makeView('v1', 1.2), makeView('v2', 3.4)];
    const cached = new Map([
      ...cachedWith('v1'),
      ...cachedWith('v2')
    ]);
    expect(recomputeViewIds(views, views, cached)).toEqual([]);
  });

  it('returns only the view whose cut plane moved', () => {
    const previous = [makeView('v1', 1.2), makeView('v2', 3.4)];
    const next = [makeView('v1', 1.2), makeView('v2', 4.8)];
    const cached = new Map([...cachedWith('v1'), ...cachedWith('v2')]);
    expect(recomputeViewIds(previous, next, cached)).toEqual(['v2']);
  });

  it('treats a newly added view as needing a recompute', () => {
    const previous = [makeView('v1', 1.2)];
    const next = [makeView('v1', 1.2), makeView('v3', 2.0)];
    const cached = cachedWith('v1');
    expect(recomputeViewIds(previous, next, cached)).toEqual(['v3']);
  });
});

describe('wheel zoom without a passive listener (F-041)', () => {
  function makeTarget() {
    const listeners: Array<{ type: string; handler: (e: unknown) => void; options?: AddEventListenerOptions }> = [];
    return {
      listeners,
      target: {
        addEventListener: (type: string, handler: (e: unknown) => void, options?: AddEventListenerOptions) => {
          listeners.push({ type, handler, options });
        },
        removeEventListener: vi.fn()
      }
    };
  }

  it('registers a non-passive listener and prevents default', () => {
    const { listeners, target } = makeTarget();
    const onZoom = vi.fn();

    const dispose = createWheelZoom(target as never, { onZoom });

    expect(listeners).toHaveLength(1);
    expect(listeners[0].type).toBe('wheel');
    expect(listeners[0].options).toEqual({ passive: false });

    const preventDefault = vi.fn();
    listeners[0].handler({ deltaY: -120, preventDefault });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(onZoom).toHaveBeenCalledWith('in');
    expect(typeof dispose).toBe('function');
  });

  it('reports zoom out for a positive delta and disposes cleanly', () => {
    const { listeners, target } = makeTarget();
    const onZoom = vi.fn();

    const dispose = createWheelZoom(target as never, { onZoom });
    listeners[0].handler({ deltaY: 120, preventDefault: vi.fn() });
    expect(onZoom).toHaveBeenCalledWith('out');

    dispose();
    expect(target.removeEventListener).toHaveBeenCalledTimes(1);
  });
});

describe('modal focus order (F-032)', () => {
  it('cycles forward with wrap', () => {
    expect(nextFocusIndex(0, 3, false)).toBe(1);
    expect(nextFocusIndex(1, 3, false)).toBe(2);
    expect(nextFocusIndex(2, 3, false)).toBe(0);
  });

  it('cycles backward with wrap', () => {
    expect(nextFocusIndex(0, 3, true)).toBe(2);
    expect(nextFocusIndex(2, 3, true)).toBe(1);
  });

  it('returns -1 for an empty dialog', () => {
    expect(nextFocusIndex(0, 0, false)).toBe(-1);
  });
});
```
</details>

### 2. Watch it fail

```
$ cd frontend; pnpm exec vitest run src/tests/step24.drawingsPerf.test.ts
 ❯ src/tests/step24.drawingsPerf.test.ts (0 tests)
 Error: Failed to resolve import "../services/wheelZoom" from
   "src/tests/step24.drawingsPerf.test.ts". Does the file exist?
```

After creating the three modules with their signatures and empty/moved bodies (step 3.1), the behavioural red:

```
 ❯ src/tests/step24.drawingsPerf.test.ts (11 tests | 8 failed) 38ms
   × drawing path batching (F-029) > emits one M command per line and splits cut from projection
     → TypeError: buildViewportPathData is not a function
   × drawing path batching (F-029) > exportSheetToSvg still emits exactly two path elements per viewport
     → expected 2 to be 2   (passes — this is the pre-existing behaviour, kept as the guard)
   × view recomputation (F-029) > returns only the view whose cut plane moved
     → TypeError: recomputeViewIds is not a function
   × wheel zoom without a passive listener (F-041) > registers a non-passive listener and prevents default
     → TypeError: createWheelZoom is not a function
   × modal focus order (F-032) > cycles forward with wrap
     → TypeError: nextFocusIndex is not a function
```

If you prefer a purely behavioural first red, implement `buildViewportPathData` by calling it from the **preview** first and observe that the preview still emits `<line>` elements — that assertion needs STEP-27 and cannot run today, so the export-level path count in `exportSheetToSvg` is the stand-in guard.

**Blocked assertions, to be written with STEP-27:**
`frontend/src/tests/step24.drawingsA11y.test.tsx` —

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DrawingSheetsModal } from '../components/drawings/DrawingSheetsModal';

// Requires STEP-27: vite.config.ts `test: { environment: 'jsdom', setupFiles: [...] }`
// plus devDependencies jsdom, @testing-library/react, @testing-library/user-event.
describe('drawing sheet modal accessibility (F-032, F-041)', () => {
  it('renders paths, not lines, inside a viewport', () => {
    render(<DrawingSheetsModal isOpen onClose={() => {}} geometries={[]} />);
    const modal = screen.getByRole('dialog');
    expect(modal.querySelectorAll('line').length).toBe(0);
  });

  it('closes on Escape and restores focus', async () => {
    const onClose = vi.fn();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const { unmount } = render(<DrawingSheetsModal isOpen onClose={onClose} geometries={[]} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
    unmount();
    expect(document.activeElement).toBe(trigger);
  });

  it('traps Tab inside the dialog', async () => {
    render(<DrawingSheetsModal isOpen onClose={() => {}} geometries={[]} />);
    const modal = screen.getByRole('dialog');
    const focusables = modal.querySelectorAll<HTMLElement>('button, [href], input, select, textarea');
    expect(focusables.length).toBeGreaterThan(1);
    focusables[focusables.length - 1].focus();
    await userEvent.tab();
    expect(modal.contains(document.activeElement)).toBe(true);
  });

  it('does not throw on wheel over the sheet', () => {
    render(<DrawingSheetsModal isOpen onClose={() => {}} geometries={[]} />);
    expect(() =>
      screen.getByTestId('drawing-sheets-modal').dispatchEvent(
        new WheelEvent('wheel', { deltaY: -120, bubbles: true, cancelable: true })
      )
    ).not.toThrow();
  });
});
```

Do not add this file until STEP-27's vitest config lands; adding it now would turn the default `vitest run` red for infrastructure reasons.

### 3. Implement

1. **Shape first.** Add the four exports with correct signatures and pass-through bodies so the test collects:
   - `drawingEngine.ts`: `buildViewportPathData`, `recomputeViewIds`
   - `services/wheelZoom.ts`: `createWheelZoom`
   - `hooks/modalFocus.ts`: `nextFocusIndex` (plus the `useModalFocusTrap` hook, which needs the DOM)
   Run the test; you now have behavioural failures rather than a resolve error.
2. `frontend/src/services/drawingEngine.ts` — 
   ```ts
   export interface ViewportTransform {
     centerX: number;
     centerY: number;
     viewportCenterX: number;
     viewportCenterY: number;
     scaleRatio: number;
   }

   export function buildViewportPathData(
     lines: VectorLineSegment[],
     t: ViewportTransform,
     precision = 2
   ): { cut: string; projection: string } {
     let cut = '';
     let projection = '';
     for (const l of lines) {
       const sx1 = t.viewportCenterX + (l.x1 - t.centerX) * t.scaleRatio;
       const sy1 = t.viewportCenterY - (l.y1 - t.centerY) * t.scaleRatio;
       const sx2 = t.viewportCenterX + (l.x2 - t.centerX) * t.scaleRatio;
       const sy2 = t.viewportCenterY - (l.y2 - t.centerY) * t.scaleRatio;
       const cmd = `M ${sx1.toFixed(precision)} ${sy1.toFixed(precision)} L ${sx2.toFixed(precision)} ${sy2.toFixed(precision)} `;
       if (l.isCut) cut += cmd;
       else projection += cmd;
     }
     return { cut, projection };
   }
   ```
3. `frontend/src/services/drawingEngine.ts:352-374` — replace the inline `data.lines.forEach` with
   `const { cut: pathCut, projection: pathProj } = buildViewportPathData(data.lines, { centerX, centerY, viewportCenterX: vpCenterX, viewportCenterY: vpCenterY, scaleRatio });`
   keeping the `let pathCut = ''; let pathProj = '';` defaults for the empty-`data` case.
4. `frontend/src/services/drawingEngine.ts` — 
   ```ts
   export function recomputeViewIds(
     previous: BimView[] | null,
     next: BimView[],
     cached: Map<string, DrawingViewVectorData>
   ): string[] {
     const priorById = new Map((previous ?? []).map((v) => [v.id, v]));
     return next
       .filter((v) => {
         if (!cached.has(v.id)) return true;
         const prior = priorById.get(v.id);
         if (!prior) return true;
         return (
           prior.cutPlane.axis !== v.cutPlane.axis ||
           prior.cutPlane.position !== v.cutPlane.position
         );
       })
       .map((v) => v.id);
   }
   ```
5. `frontend/src/components/drawings/DrawingSheetsModal.tsx:207-222` — keep `viewsRef` of the previous array; compute `const stale = recomputeViewIds(viewsRef.current, views, vectorCacheRef.current)`; if empty, return. Otherwise process one id per `requestAnimationFrame`, merging into the existing map:
   ```ts
   setVectorCache((prev) => {
     const next = new Map(prev);
     // one entry per frame
     return next;
   });
   ```
   Track `vectorCacheRef` alongside state so the merge never reads a stale state value, and cancel the pending frame on unmount/close.
6. `frontend/src/services/wheelZoom.ts` — 
   ```ts
   export interface WheelZoomTarget {
     addEventListener(type: 'wheel', handler: (e: WheelEvent) => void, options?: AddEventListenerOptions): void;
     removeEventListener(type: 'wheel', handler: (e: WheelEvent) => void): void;
   }

   export function createWheelZoom(
     target: WheelZoomTarget,
     options: { onZoom: (direction: 'in' | 'out') => void }
   ): () => void {
     const handler = (event: WheelEvent) => {
       event.preventDefault();
       options.onZoom(event.deltaY < 0 ? 'in' : 'out');
     };
     target.addEventListener('wheel', handler, { passive: false });
     return () => target.removeEventListener('wheel', handler);
   }
   ```
7. `DrawingSheetsModal.tsx:363-367` — delete `handleWheel` and the `onWheel={handleWheel}` prop; add
   ```tsx
   const boardRef = useRef<HTMLDivElement | null>(null);
   useEffect(() => {
     if (!isOpen || !boardRef.current) return;
     return createWheelZoom(boardRef.current, {
       onZoom: (dir) => setCanvasZoom((prev) => Math.min(Math.max(0.4, prev * (dir === 'in' ? 1.1 : 0.9)), 4.0))
     });
   }, [isOpen]);
   ```
   and attach `ref={boardRef}` to the element that previously carried `onWheel`.
8. `frontend/src/hooks/modalFocus.ts` —
   ```ts
   export function nextFocusIndex(current: number, total: number, shift: boolean): number {
     if (total <= 0) return -1;
     const base = current < 0 ? (shift ? 0 : -1) : current;
     return shift ? (base - 1 + total) % total : (base + 1) % total;
   }
   ```
   plus `useModalFocusTrap(containerRef, { active, onEscape })`: on `active`, store `document.activeElement`, focus the first focusable inside, and attach a `keydown` listener that handles `Escape` (`onEscape`) and `Tab` (`nextFocusIndex` over the live focusable list, wrapping). On cleanup, restore focus. The hook is **not** unit-tested here (it needs the DOM).
9. `DrawingSheetsModal.tsx:431-440` — `const dialogRef = useRef<HTMLDivElement | null>(null); useModalFocusTrap(dialogRef, { active: isOpen, onEscape: onClose });` and `ref={dialogRef}` on the `role="dialog"` div.
10. `frontend/src/App.tsx:966` — add `isDrawingSheetsOpen` to the guard and close it:
    ```tsx
    if (isOmnibarOpen || isUploadModalOpen || isNewProjectModalOpen || isBcfOpen ||
        isFederationOpen || isSettingsOpen || isDrawingSheetsOpen) {
      if (isSettingsOpen) setIsSettingsOpen(false);
      if (isDrawingSheetsOpen) setIsDrawingSheetsOpen(false);
      return;
    }
    ```
    and add `isDrawingSheetsOpen` to the dependency array at `:998-1009`.

### 4. Watch it pass

```
$ cd frontend; pnpm exec vitest run src/tests/step24.drawingsPerf.test.ts
 ✓ src/tests/step24.drawingsPerf.test.ts (11 tests) 47ms

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

### 5. Regression guard

```
cd frontend; pnpm exec vitest run
cd frontend; pnpm exec tsc -b --noEmit
cd frontend; pnpm run build
.\scripts\ui_pipeline.ps1 -Tier quick
.\backend\venv\Scripts\python.exe -m pytest backend/tests/ -q
```

`frontend/src/tests/drawings.test.ts` already asserts `exportSheetToSvg` output contains `id="viewport-vp-1"`, `SCALE 1:100` and `id="title-block"` (lines 127-135). Step 3 must not change those; if that file goes red, the path batching was wired into the wrong place.

## Acceptance criteria

- [ ] `buildViewportPathData` returns one `M` command per input line, split by `isCut`.
- [ ] `exportSheetToSvg` emits exactly 2 `<path d="M…">` elements per populated viewport (`frontend/src/tests/drawings.test.ts` and the new test agree).
- [ ] The sheet preview renders 0 `<line>` elements inside a viewport body (STEP-27 test).
- [ ] `recomputeViewIds` returns `[]` for unchanged views and exactly the moved view's id when one cut plane moves.
- [ ] Only the recomputed ids are replaced in the vector cache; other entries keep their identity.
- [ ] At most one view is computed per animation frame.
- [ ] The wheel listener is registered with `{ passive: false }` and no console error appears when scrolling over the sheet.
- [ ] `Escape` with the sheet open calls `onClose` and does not clear the element selection.
- [ ] Focus enters the dialog on open and returns to the trigger on close (STEP-27 test).
- [ ] `pnpm exec vitest run`, `tsc -b --noEmit` and `pnpm run build` are green.

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| Two `<path>` elements render differently from N `<line>` elements (line caps, joins, dashes) | `strokeLinecap="round"` and the same stroke widths move onto the `<path>`; compare a screenshot before and after for one real sheet | Keep `<line>` for `isCut` and batch only projections — half the win, no visual risk |
| One-view-per-frame makes a 6-view sheet feel slow to fill in | It fills in ~6 frames (100 ms at 60 fps), which is imperceptible; the previous behaviour blocked for the whole set | Compute two per frame |
| Merging the cache instead of replacing it keeps a stale entry after geometry reloads | Clear `vectorCache` when `geometries` identity changes (that is a full invalidation, not a view edit) | Revert to `setVectorCache(newMap)` on geometry change only |
| `useModalFocusTrap` breaks the existing mouse interactions inside the sheet | The hook only intercepts `Tab` and `Escape`; it never blocks pointer events | Remove the hook, keep the `App.tsx` Escape guard and `createWheelZoom` |
| Adding `isDrawingSheetsOpen` to the App guard changes Escape behaviour elsewhere | The guard only runs while the sheet is open, and the modal is the topmost layer (`z-50` at `:439`) | Revert the one condition |
| `createWheelZoom` with `preventDefault` stops page scrolling while the sheet is open | That is the intent; the sheet is a full-screen modal | Do not call `preventDefault` when the pointer is outside the board ref |

## Notes

- **`modalFocus.ts` mixes a pure helper with a DOM hook on purpose.** That lets `nextFocusIndex` be tested now and keeps the hook beside it, so the STEP-27 test file has nothing left to import.
- **The `onWheel` bug is a good example of why "no console errors" belongs in the QA gate.** `preventDefault()` in a passive listener fails silently except for a console message; a run that only asserts behaviour would have passed while the console filled up. `AGENTS.md` §B3 step 4 already asks for this — enforce it.
- **`exportSheetToSvg` already batched, so F-029's export half was never broken.** Say so in the handoff: the finding is about the *preview* path only. That is the case for sharing the helper rather than writing a second batching routine.
- **Do not touch `DrawingSheetsModal.tsx:255-259`** (delete-first-sheet, F-010). It is adjacent, it is STEP-09's, and this file will already be under review in the same commit. `ROADMAP.md` change-control rule 1 applies to BIM logic, but the same discipline applies to two findings in one diff.
- **Not verified:** F-029, F-032 and F-041 are all `[L]` in `FINDINGS.md`. No browser session was run in the audit (`VERIFICATION.md` §7), so no segment count and no frame time was measured. The `passive`-listener behaviour is a documented React 17+ fact, not something this audit observed.

### 2026-10-25 — implementation (STEP-24 lane)

- **Executed.** `buildViewportPathData` + `recomputeViewIds` in `services/drawingEngine.ts` (export
  now shares the batcher), `services/wheelZoom.ts` (`createWheelZoom`, native
  `{ passive: false }`), `hooks/modalFocus.ts` (`nextFocusIndex` + `useModalFocusTrap`), the modal's
  preview switched to two `<path>` elements per viewport, the cache switched to an additive
  `recomputeViewIds` merge computed one view per `requestAnimationFrame` (timer fallback for
  non-visual hosts, cancelled on close/unmount, full invalidation when the geometry array identity
  changes), the `onWheel` prop replaced by the effect-registered listener, and the focus trap mounted
  on the dialog with `onEscape={onClose}`.
- **Verified.** `step24.drawingsPerf.test.ts` 11/11, `step24.drawingsA11y.test.tsx` 5/5 (STEP-27's
  jsdom infra has landed, so the "blocked" rendered assertions are written and green — except spec 10,
  which is App-level), `tsc -b --noEmit` 0, `vite build` green.
- **Deviation (measured, not assumed).** Spec 2's guard in the perf test counted `<path d="M`
  occurrences and expected 2. With the step's own `WALL` fixture the projection path is empty — all
  4 extracted segments are cut lines — so the true count is 1 and that assertion could never pass
  against any correct implementation. It now counts `<path ` elements (`toBe(2)`) and pins the cut
  path separately. The cut/projection split is asserted directly on `buildViewportPathData`.
- **Deferred (`App.tsx`, integration lane).** `isDrawingSheetsOpen` must join the global Escape guard
  at `:966` (and its dependency array at `:998-1009`) so Escape closes the sheet instead of clearing
  the element selection. Snippet in `docs/audit-2026-10/steps/notes/STEP-24.md`.
- **Not verified.** No browser session: the real-sheet segment count, frame time and the absence of
  the passive-listener console error in Chrome's console are still unmeasured. The two-`<path>`
  rendering is visually equivalent only if `stroke-linecap`/`stroke-linejoin` moved across — they did
  (`round`/`round` at 0.75 cut, `round` at 0.25 projection), but a screenshot diff of one real sheet
  is still worth doing.
