# STEP-23 — Hover throttle, geometry disposal, scene teardown, Escape

**Status:** not started · **Wave:** B · **Effort:** 3 d
**Findings:** F-033, F-034, F-035, F-037, F-038 · **Depends on:** STEP-08 · **Blocks:** —

## Problem

Moving the mouse across a model allocates: every `pointermove` runs a full-scene raycast, builds a fresh `EdgesGeometry` for the hovered element, and re-renders a 4,250-line component. Worse, tearing the highlight down **disposes geometry the model still owns**, so the next hover forces WebGL to re-upload the mesh. On a 50k-element federated model — the ROADMAP budget is ≥ 30 fps — that is the difference between usable and unusable, and the same defect makes every hover a small GPU-memory leak.

## Evidence

- `frontend/src/components/viewer/ThreeViewport.tsx:352-368` — `disposeHighlightGroup` calls `geometry.dispose()` on everything in the group. Compare `clearGroupChildren` at `:370-388`, which correctly respects `userData.isSharedGeometry`.
- `frontend/src/components/viewer/ThreeViewport.tsx:2383` — the hover overlay is `new THREE.Mesh(mesh.geometry, hoverOverlayMat)`; `:2207` — the selection overlay is `new THREE.Mesh(mesh.geometry, selOverlayMat)`. Both borrow the model's geometry, then `:2397` and `:2293` dispose it.
- `frontend/src/components/viewer/ThreeViewport.tsx:2343`, `:2164`, `:1796` — `new THREE.EdgesGeometry(mesh.geometry, 24)` is built inside a `useEffect` that runs on every `hoveredExpressId` change, i.e. per hover.
- `frontend/src/components/viewer/ThreeViewport.tsx:3196` — `pointermove` calls `updateHoverAtScreenCoords` directly, no rAF coalescing; `:2805-2813` runs `findVisibleCandidates` (a full raycast over `group`) for every event; `:2815-2817` creates a **new array** each time and hands it to `setHoverCandidates`, so React re-renders even when the hovered element did not change.
- `frontend/src/components/viewer/ThreeViewport.tsx:2755-2764` — the keydown effect's dependency array lists `selectedExpressID, onSelectElement, cadToolMode, cadStartPoint, onCadCancel, isMeasureActive, pendingStartPoint, onCancelMeasure` but **not** `interactiveEditState`, while the handler reads `interactiveEditState.mode` at `:2676` and `:2729`. The closure is stale, so `Escape` cannot cancel an in-progress move/rotate.
- `frontend/src/components/viewer/ThreeViewport.tsx:1358-1412` — the scene-teardown cleanup disposes the snap ring, tick, preview, shadow and grid resources, and the three *highlight* groups at `:1387`, `:1470-1478`, but never traverses `meshesGroupRef.current.children`, never disposes `categoryMaterialsRef` / `disciplineMaterialsRef`, and never clears `meshMapRef.current`.
- `frontend/src/components/viewer/ThreeViewport.tsx:895` — `const isLargeModel = geometries.length > 150;` inside the mount effect whose dependency array is `[onTransformEnd, onTransformChange]` (`:1413`). On first render `geometries` is `[]`, so `isLargeModel` is permanently `false` and the adaptive damping branch at `:896-899` never activates. `:2549` recomputes it in a later effect, which is why the inconsistency is invisible: two different answers to the same question.

## Scope

**Change:**

- **New** `frontend/src/components/viewer/highlightDisposal.ts` — `markSharedGeometry`, `disposeHighlightGroup`.
- **New** `frontend/src/components/viewer/hoverScheduler.ts` — `createHoverScheduler`.
- **New** `frontend/src/components/viewer/sceneTeardown.ts` — `disposeSceneGraph`.
- **New** `frontend/src/components/viewer/navigationTuning.ts` — `createNavigationTuning`.
- `frontend/src/components/viewer/ThreeViewport.tsx:352-368` — delete the local `disposeHighlightGroup`, import it from the new module.
- `frontend/src/components/viewer/ThreeViewport.tsx:2207`, `:2383` — call `markSharedGeometry(overlay)` when the overlay borrows `mesh.geometry`; mark the `EdgesGeometry` line objects as **not** shared (they own their geometry).
- `frontend/src/components/viewer/ThreeViewport.tsx:3195-3197` — route `pointermove` through the scheduler.
- `frontend/src/components/viewer/ThreeViewport.tsx:2815-2831` — pass the candidate array through the scheduler's dedupe before `setHoverCandidates`.
- `frontend/src/components/viewer/ThreeViewport.tsx:1358-1413` — call `disposeSceneGraph(...)` in the cleanup.
- `frontend/src/components/viewer/ThreeViewport.tsx:895-901`, `:2549-2555` — obtain damping and batch decisions from `navigationTuning`, never from a captured local.
- `frontend/src/components/viewer/ThreeViewport.tsx:2755-2764` — add `interactiveEditState`, `onActiveInteractiveModeChange` and `onRotateElement` to the dependency array.

**Do not change:**

- `findVisibleCandidates` (`:290-350`) — the raycast itself. BVH acceleration is STEP-08's subject; this step only stops calling it once per pixel.
- The batched-mesh visibility model (`:1496-1600`, `:1698-1720`) — STEP-08.
- `frontend/src/hooks/useSpatialSelection.ts` and the element-details fetch — STEP-14 (F-036).
- `updateInteractiveGuides` / ghost previews — untouched.

**Non-goals:**

- A BVH (`three-mesh-bvh` is already a dependency but unused on this path). That is a separate, measurable step and belongs with STEP-08's batch work.
- Virtualising the spatial tree (STEP-15) or the list of draw calls.
- Refactoring `ThreeViewport.tsx` into smaller components. Tempting and out of scope; this step moves four small modules out and leaves the component's structure alone.

## Spec

1. `disposeHighlightGroup(group, scene)` removes the group from the scene and disposes only objects **whose geometry is not marked shared** (`userData.isSharedGeometry === true`). A model-owned geometry survives with `dispose()` never called on it.
2. `markSharedGeometry(mesh)` sets `userData.isSharedGeometry = true`, and the marker survives `matrixAutoUpdate = false` handling (i.e. it is not overwritten by the overlay construction).
3. An `EdgesGeometry` created for a contour highlight is **not** marked shared and **is** disposed when the group is torn down.
4. `createHoverScheduler` coalesces any number of `schedule(payload)` calls within one animation frame into exactly one `compute(lastPayload)` call.
5. `createHoverScheduler` calls `notify(ids)` only when the computed `ids` array differs **by value** from the previous one; an unchanged hover produces no notification (and therefore no `setState`).
6. `cancel()` drops a pending frame; a `schedule` after `cancel` starts a new one.
7. `disposeSceneGraph(root, scene, options)` disposes every geometry under `root` exactly once, disposes every material in `options.materialPools` exactly once (even when a mesh also references it), clears every map in `options.registries`, and removes `root` from `scene`. It is idempotent: a second call disposes nothing further and returns `{geometries: 0, materials: 0}`.
8. `createNavigationTuning(baseDamping, {adaptive, threshold})` returns `{update(count): number, current: number}`; `update(150)` returns `baseDamping`, `update(151)` returns `max(baseDamping, 0.25)` when `adaptive` is true, and `baseDamping` when `adaptive` is false. `current` reflects the last `update`.
9. The viewport calls `update()` once per geometry-count change (an effect with `[geometries.length]` deps), so the damping applied after a model loads differs from the mount-time value.
10. `Escape` during an interactive move/rotate cancels the edit (`interactiveEditState.mode` becomes `"none"`) instead of deselecting the element.
11. `THREE.EdgesGeometry` is constructed at most once per `hoveredExpressId` transition, not once per pointer move.

## TDD

### 1. Add the failing test

**File:** `frontend/src/tests/step23.viewportPerf.test.ts`
**Command:** `cd frontend; pnpm exec vitest run src/tests/step23.viewportPerf.test.ts`

The four modules under test are pure TypeScript over `three` — **no DOM, no jsdom, no `@testing-library/react`**. This file therefore runs today, before STEP-27 exists. Only spec 10 (the Escape handler) needs a real React render and is deferred to `STEP-27` (see `### 2` note).

<details>
```ts
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

import {
  disposeHighlightGroup,
  markSharedGeometry
} from '../components/viewer/highlightDisposal';
import { createHoverScheduler } from '../components/viewer/hoverScheduler';
import { disposeSceneGraph } from '../components/viewer/sceneTeardown';
import { createNavigationTuning } from '../components/viewer/navigationTuning';

function makeFrameQueue() {
  const queue: Array<() => void> = [];
  return {
    requestFrame: (cb: () => void) => {
      queue.push(cb);
      return queue.length;
    },
    cancelFrame: () => {
      queue.length = 0;
    },
    flush: () => {
      const pending = queue.splice(0, queue.length);
      pending.forEach((cb) => cb());
    },
    get size() {
      return queue.length;
    }
  };
}

describe('highlight disposal (F-033)', () => {
  it('must not dispose geometry owned by the model', () => {
    const modelGeometry = new THREE.BoxGeometry(1, 1, 1);
    const modelDispose = vi.spyOn(modelGeometry, 'dispose');
    const scene = new THREE.Scene();
    const group = new THREE.Group();

    const overlay = new THREE.Mesh(modelGeometry, new THREE.MeshBasicMaterial());
    markSharedGeometry(overlay);
    group.add(overlay);
    scene.add(group);

    disposeHighlightGroup(group, scene);

    expect(modelDispose).not.toHaveBeenCalled();
    expect(scene.children).not.toContain(group);
  });

  it('disposes highlight geometry it owns', () => {
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1), 24);
    const edgesDispose = vi.spyOn(edges, 'dispose');
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    group.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial()));
    scene.add(group);

    disposeHighlightGroup(group, scene);

    expect(edgesDispose).toHaveBeenCalledTimes(1);
  });
});

describe('hover scheduler (F-034)', () => {
  it('coalesces pointer moves into one compute per frame, using the latest event', () => {
    const frames = makeFrameQueue();
    const compute = vi.fn(() => [7]);
    const scheduler = createHoverScheduler({
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
      compute
    });

    scheduler.schedule({ clientX: 1, clientY: 1 });
    scheduler.schedule({ clientX: 2, clientY: 2 });
    scheduler.schedule({ clientX: 3, clientY: 3 });

    expect(compute).not.toHaveBeenCalled();
    expect(frames.size).toBe(1);

    frames.flush();

    expect(compute).toHaveBeenCalledTimes(1);
    expect(compute).toHaveBeenCalledWith({ clientX: 3, clientY: 3 });
  });

  it('does not notify when the hovered set is unchanged', () => {
    const frames = makeFrameQueue();
    const notify = vi.fn();
    const scheduler = createHoverScheduler({
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
      compute: () => [7, 9],
      notify
    });

    scheduler.schedule({ clientX: 10, clientY: 10 });
    frames.flush();
    scheduler.schedule({ clientX: 11, clientY: 11 });
    frames.flush();
    scheduler.schedule({ clientX: 12, clientY: 12 });
    frames.flush();

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith([7, 9]);
  });

  it('notifies once per real change', () => {
    const frames = makeFrameQueue();
    const notify = vi.fn();
    let next = [7];
    const scheduler = createHoverScheduler({
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
      compute: () => next,
      notify
    });

    scheduler.schedule({ clientX: 1, clientY: 1 });
    frames.flush();
    next = [11];
    scheduler.schedule({ clientX: 2, clientY: 2 });
    frames.flush();

    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenLastCalledWith([11]);
  });

  it('cancel drops the pending frame', () => {
    const frames = makeFrameQueue();
    const compute = vi.fn(() => []);
    const scheduler = createHoverScheduler({
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
      compute
    });

    scheduler.schedule({ clientX: 1, clientY: 1 });
    scheduler.cancel();
    expect(frames.size).toBe(0);
    frames.flush();
    expect(compute).not.toHaveBeenCalled();
  });
});

describe('scene teardown (F-037)', () => {
  it('disposes mesh geometry, pooled materials and clears registries', () => {
    const scene = new THREE.Scene();
    const root = new THREE.Group();
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial();

    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const materialDispose = vi.spyOn(material, 'dispose');

    const mesh = new THREE.Mesh(geometry, material);
    root.add(mesh);
    scene.add(root);

    const pool = new Map<string, THREE.Material>([['IfcWall', material]]);
    const meshMap = new Map<number, THREE.Mesh[]>([[1, [mesh]]]);

    const result = disposeSceneGraph(root, scene, {
      materialPools: [pool],
      registries: [meshMap]
    });

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(meshMap.size).toBe(0);
    expect(scene.children).not.toContain(root);
    expect(result.geometries).toBe(1);
    expect(result.materials).toBe(1);
  });

  it('is idempotent', () => {
    const scene = new THREE.Scene();
    const root = new THREE.Group();
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial();
    root.add(new THREE.Mesh(geometry, material));
    scene.add(root);

    disposeSceneGraph(root, scene, {});
    const second = disposeSceneGraph(root, scene, {});

    expect(second.geometries).toBe(0);
    expect(second.materials).toBe(0);
  });
});

describe('navigation tuning (F-038)', () => {
  it('switches to the large-model damping once the count crosses the threshold', () => {
    const tuning = createNavigationTuning(0.18, { adaptive: true, threshold: 150 });

    expect(tuning.update(10)).toBeCloseTo(0.18);
    expect(tuning.current).toBeCloseTo(0.18);

    expect(tuning.update(151)).toBeCloseTo(0.25);
    expect(tuning.current).toBeCloseTo(0.25);

    expect(tuning.update(20)).toBeCloseTo(0.18);
  });

  it('never raises damping when adaptive is disabled', () => {
    const tuning = createNavigationTuning(0.18, { adaptive: false, threshold: 150 });
    expect(tuning.update(5000)).toBeCloseTo(0.18);
  });
});
```
</details>

### 2. Watch it fail

Mechanically move each function into its new module **unchanged** first (step 3.1 below). The behavioural failures are the signal that the test is testing the bug, not a missing import:

```
$ cd frontend; pnpm exec vitest run src/tests/step23.viewportPerf.test.ts
 ❯ src/tests/step23.viewportPerf.test.ts (10 tests | 8 failed) 41ms
   × highlight disposal (F-033) > must not dispose geometry owned by the model
     → expected "dispose" to not be called at all, but actually been called 1 times
   × hover scheduler (F-034) > coalesces pointer moves into one compute per frame,
       using the latest event
     → expected [Function compute] to not have been called at all
   × scene teardown (F-037) > disposes mesh geometry, pooled materials and clears registries
     → expected 0 to be 1 // geometry.dispose was never called on meshesGroup children
   × navigation tuning (F-038) > switches to the large-model damping once the count
       crosses the threshold
     → TypeError: createNavigationTuning is not a function
   ...
```

Before the extraction the whole file fails to collect:
```
Error: Failed to resolve import "../components/viewer/highlightDisposal" from
  "src/tests/step23.viewportPerf.test.ts". Does the file exist?
```

**Note on spec 10 (F-035, Escape):** the stale-dependency bug cannot be observed without a React renderer. `frontend/src/tests/step23.viewportEscape.test.tsx` is therefore **blocked on STEP-27** — `frontend/vite.config.ts` has no `test` block, `environment: 'jsdom'` is not configured, and neither `jsdom` nor `@testing-library/react` is installed (F-061). Write that test in the same commit that lands STEP-27; until then, F-035's fix is verified by review (the dependency array gains `interactiveEditState`) plus the `data-qa` QA case in `test_cases.jsonl` for "Escape cancels an in-progress move".

### 3. Implement

1. **Extract, do not rewrite.** Create the four modules by moving the existing code verbatim:
   - `highlightDisposal.ts` ← `ThreeViewport.tsx:352-368` (`disposeHighlightGroup`) as `export function`.
   - `sceneTeardown.ts` ← the resource-disposal sequence at `ThreeViewport.tsx:1371-1407` folded into one function.
   - `hoverScheduler.ts` and `navigationTuning.ts` are new (no existing code to move); `ThreeViewport.tsx:895-899` and `:2549-2555` hold the damping logic to fold into `navigationTuning.ts`.
   Re-import them in `ThreeViewport.tsx` and run the test to get the behavioural red above. Commit nothing yet.
2. `frontend/src/components/viewer/highlightDisposal.ts` —
   ```ts
   import * as THREE from 'three';

   export function markSharedGeometry(object: THREE.Object3D): void {
     object.userData = { ...object.userData, isSharedGeometry: true };
   }

   export function disposeHighlightGroup(group: THREE.Group | null, scene: THREE.Scene | null): void {
     if (!group) return;
     if (scene) scene.remove(group);
     group.traverse((obj) => {
       const holder = obj as THREE.Mesh;
       if (holder.geometry && !obj.userData?.isSharedGeometry) {
         holder.geometry.dispose();
       }
       if (holder.material) {
         const materials = Array.isArray(holder.material) ? holder.material : [holder.material];
         materials.forEach((m) => m?.dispose?.());
       }
     });
     group.clear();
   }
   ```
3. `ThreeViewport.tsx:2207`, `:2383` — call `markSharedGeometry(overlay)` immediately after constructing each overlay mesh, **before** assigning `userData = { sourceMesh: mesh }` (`:2210`, and the hover equivalent) so the marker is not clobbered. In `:2210`/`:2175` change the assignment to `selMesh.userData = { ...selMesh.userData, sourceMesh: mesh }`.
4. `frontend/src/components/viewer/hoverScheduler.ts` —
   ```ts
   export interface PointerPayload { clientX: number; clientY: number }

   export interface HoverSchedulerOptions {
     requestFrame: (cb: () => void) => number;
     cancelFrame: (handle: number) => void;
     compute: (payload: PointerPayload) => number[];
     notify?: (ids: number[]) => void;
     equals?: (a: number[], b: number[]) => boolean;
   }

   export interface HoverScheduler {
     schedule(payload: PointerPayload): void;
     cancel(): void;
   }
   ```
   `schedule` stores the latest payload and requests a frame only if none is pending. The frame body calls `compute(latest)`, compares with the previous result using `equals` (default: same length and same elements in order), and calls `notify` only when different. `cancel` calls `cancelFrame` and clears the handle.
5. `ThreeViewport.tsx:3195-3197` — replace the direct call with `hoverSchedulerRef.current?.schedule({ clientX: event.clientX, clientY: event.clientY })`; construct the scheduler in a `useMemo` whose `compute` closes over a ref (not state), and pass `notify` a function that sets `hoverCandidates`, `setHoveredExpressId`, `setHoverCandidateIndex` and `setIsHoveringInteractiveMesh`. Remove the `setHoverCandidates(candidateIds)` call at `:2817` — the scheduler owns that notification.
6. `frontend/src/components/viewer/sceneTeardown.ts` — `disposeSceneGraph(root, scene, options)` with the dedupe sets from spec 7; traverse `root` disposing geometries (skipping `userData.isSharedGeometry`), collect materials into a `Set`, dispose pooled materials first, registry maps cleared with `.clear()`, then `scene?.remove(root)`.
7. `ThreeViewport.tsx:1358-1413` — in the cleanup, before `renderer.dispose()`, call
   ```ts
   disposeSceneGraph(meshesGroupRef.current, scene, {
     materialPools: [categoryMaterialsRef.current, disciplineMaterialsRef.current],
     registries: [meshMapRef.current]
   });
   meshesGroupRef.current = null;
   ```
8. `frontend/src/components/viewer/navigationTuning.ts` — `createNavigationTuning(baseDamping, {adaptive = true, threshold = 150, largeFloor = 0.25})` returning `{update(count), current}`; `update` sets `current = adaptive && count > threshold ? Math.max(baseDamping, largeFloor) : baseDamping`.
9. `ThreeViewport.tsx:895-901` — delete the captured `isLargeModel`; keep the mount-time `controls` creation but read `navigationTuningRef.current.current`. Add an effect with `[geometries.length]` deps that calls `navigationTuningRef.current.update(geometries.length)` and assigns `controls.dampingFactor`. Do the same at `:2549-2555` so both effects agree.
10. `ThreeViewport.tsx:2755-2764` — add `interactiveEditState`, `onActiveInteractiveModeChange`, `onRotateElement` to the dependency array. Do **not** wrap the handler in `useCallback` with a partial list; the array must list everything the handler reads (`:2671-2751` reads `interactiveEditState`, `selectedExpressID`, `cadToolMode`, `cadStartPoint`, `isMeasureActive`, `pendingStartPoint`, `onActiveInteractiveModeChange`, `onRotateElement`, `onSelectElement`, `onCadCancel`, `onCancelMeasure`).
11. `:2343`, `:2164`, `:1796` — move `new THREE.EdgesGeometry(...)` behind a per-`hoveredExpressId` cache (`edgeGeometryCacheRef: Map<number, THREE.BufferGeometry>`) so the contour overlay reuses one geometry per element and the cache is cleared in `disposeSceneGraph`.

### 4. Watch it pass

```
$ cd frontend; pnpm exec vitest run src/tests/step23.viewportPerf.test.ts
 ✓ src/tests/step23.viewportPerf.test.ts (10 tests) 63ms

 Test Files  1 passed (1)
      Tests  10 passed (10)
```

### 5. Regression guard

```
cd frontend; pnpm exec vitest run
cd frontend; pnpm exec tsc -b --noEmit
cd frontend; pnpm run build
.\backend\venv\Scripts\python.exe -m pytest backend/tests/ -q
.\scripts\ui_pipeline.ps1 -Tier quick
```

The production build is the guard that matters here: these are `frontend/src/**` changes, and `tsc -b` catches the `userData` typing churn that the shared-geometry marker introduces.

## Acceptance criteria

- [ ] Hovering an element does not call `dispose()` on the model's `BufferGeometry` (spy count 0).
- [ ] A contour `EdgesGeometry` is disposed exactly once when its highlight group is torn down.
- [ ] 3 `pointermove` events inside one frame produce exactly 1 `compute` call, with the last payload.
- [ ] Repeated hovers over the same element produce exactly 1 `notify` call.
- [ ] `disposeSceneGraph` disposes each geometry and each pooled material exactly once and clears `meshMapRef`.
- [ ] A second `disposeSceneGraph` call returns `{geometries: 0, materials: 0}`.
- [ ] `createNavigationTuning(0.18).update(151)` returns `0.25`; `.update(10)` returns `0.18`.
- [ ] Escape during an interactive move cancels the edit (verified in `TC-*` via the QA bridge until STEP-27 lands).
- [ ] `pnpm exec vitest run`, `tsc -b --noEmit` and `pnpm run build` are green.

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| Marking model geometry as shared means a *genuinely* orphaned overlay geometry is never freed | Only the two overlay meshes (`:2207`, `:2383`) are marked; every other object in a highlight group owns its geometry | Remove the `markSharedGeometry` calls; the leak returns but nothing breaks |
| The hover scheduler's `notify` changes render timing enough to feel less responsive | It coalesces to one notification per animation frame — the same cadence as the render loop | Increase nothing; instead drop the `notify` dedupe (keep the frame coalescing), which is the safe half |
| `disposeSceneGraph` double-frees a material shared between a mesh and a pool | The dedupe `Set` is the contract, and spec 7's test asserts a single call | Guard each `dispose` with a `WeakSet` of already-disposed objects |
| Adding `interactiveEditState` to the Escape deps re-binds the keydown listener on every edit-state change | One listener re-bind per state transition is negligible; the alternative is a stale closure | Use a ref mirror (`interactiveEditStateRef`) and keep `[]` deps — but do not ship the current code |
| Moving damping out of the mount effect changes the initial feel of a small model | `update()` is called once immediately with the real count, so the first frame is correct rather than wrong | N/A |

## Notes

- **F-035 is the cheapest finding in the batch and the most dangerous to leave.** A one-line dependency-array omission makes a documented shortcut (Escape cancels a move) silently unavailable, and no test can see it without a React renderer. That is a direct argument for STEP-27 landing before Wave C closes.
- **Do not "fix" F-034 by adding `useDeferredValue` or `startTransition`.** The cost is the raycast, not the React commit; deferring the commit still runs the raycast per event. Coalesce at the event source.
- **№ of edit sites is high (11) for a 3-day step.** If it overruns, land specs 1-3, 7 and 8 first (they are pure-module work with no component coupling), then 4-6 (hover), then 10 (Escape, one line). Do not land the hover scheduler without the disposal fix — a faster hover that disposes geometry faster is worse.
- **Not verified:** F-033…F-038 are all `[L]` in `FINDINGS.md`; `VERIFICATION.md` §4 explicitly states that no browser session, frame-rate measurement or memory snapshot was taken. Every claim in `## Evidence` above is a verified line reference, not a measured frame time. The 30 fps budget in `ROADMAP.md` remains unproven on this codebase.
- **Metric to add with this step:** the ROADMAP asks for "Hover raycast < 16 ms/frame". `ThreeViewport.tsx:1363` already deletes `window.__THREE_VIEWPORT_STATS__` on teardown, and the QA bridge can read it — use that seam to record a real number in the handoff entry rather than asserting a feeling.

## Notes — implementation (2026-10-25)

**Status:** landed, unit-verified. No browser session, frame-time measurement or memory snapshot
was taken in this lane.

### What changed

- **New modules**
  - `frontend/src/components/viewer/highlightDisposal.ts` — `markSharedGeometry`,
    `disposeHighlightGroup` (moved verbatim from `ThreeViewport.tsx`, one behavioural change:
    geometry with `userData.isSharedGeometry` is no longer disposed).
  - `frontend/src/components/viewer/hoverScheduler.ts` — `createHoverScheduler` (frame coalescing
    + value-equality dedupe, `requestFrame`/`cancelFrame` injected so it is DOM-free).
  - `frontend/src/components/viewer/sceneTeardown.ts` — `disposeSceneGraph(root, scene, options)`
    with module-level `WeakSet` dedupe, so a second call returns `{geometries: 0, materials: 0}`.
  - `frontend/src/components/viewer/navigationTuning.ts` — `createNavigationTuning`
    (`update(count)` / `current`).
- `ThreeViewport.tsx`
  - Local `disposeHighlightGroup` deleted, imported from the module. `clearGroupChildren` (which
    already honoured `isSharedGeometry`) is untouched.
  - Selection wash (`selMesh`) and hover wash (`hoverMesh`) are `markSharedGeometry`d before their
    `userData` is spread-merged with `sourceMesh`, so the marker survives.
  - `pointermove` now calls `hoverScheduler.schedule({clientX, clientY})`; the scheduler's `notify`
    is the new `applyHoverNotification` (sets `hoverCandidates`, `hoveredExpressId`,
    `hoverCandidateIndex`, `isHoveringInteractiveMesh`). `updateHoverAtScreenCoords` returns the id
    array instead of setting state. `cancel()` is called on `pointerleave`, on drag-start and in the
    mount cleanup.
  - Mount cleanup calls `disposeSceneGraph(meshesGroupRef.current, scene, {materialPools:
    [categoryMaterialsRef, disciplineMaterialsRef], registries: [meshMapRef, edgeGeometryCache]})`
    before `renderer.dispose()`, then nulls `meshesGroupRef` and clears `batchRegistryRef`;
    `diffMaterialsRef` is disposed too (it was never freed).
  - The mount effect no longer computes `isLargeModel`; it reads
    `navigationTuningRef.current.current`. A new `[geometries.length]` effect calls
    `navigationTuningRef.current.update(geometries.length)` and assigns `controls.dampingFactor`;
    the settings effect rebuilds the tuning object from the current settings and re-applies it with
    the live count. Both effects therefore agree.
  - Escape handler dependency array gained `interactiveEditState`, `onActiveInteractiveModeChange`,
    `onRotateElement`.
  - Contour edges: `edgeGeometryCacheRef` (`expressID → { source, edges }`) owned by the component,
    cleared + disposed on model rebuild and on unmount. Selection and hover overlays share it and
    mark their `LineSegments` shared, so `disposeHighlightGroup` no longer frees the cache entry it
    is about to reuse.

### Tests

```
cd frontend; pnpm exec vitest run src/tests/step23.viewportPerf.test.ts
 ✓ src/tests/step23.viewportPerf.test.ts (10 tests)
```

Red-then-green as specified: the file first failed to resolve all four imports; then, with the
functions moved across unchanged, 8 of 10 failed on behaviour (`dispose` called on model geometry,
`compute` called synchronously per event, `createNavigationTuning is not a function`). After
implementation 10/10, and 16/16 together with STEP-08's file. `pnpm exec tsc -b --noEmit` is clean
for these files; `pnpm exec vite build` succeeds. Full `pnpm exec vitest run`: 128 passed, 1 failed
— the failure is `src/tests/step09.drawings.test.ts` (storey elevation), owned by another lane.

### Deviations

- **`cancel()` also resets the dedupe baseline.** Without it, leaving an element and re-entering the
  same element produced no `notify` (the previous id array still matched) and the hover highlight
  never came back. Documented in the module; the spec's tests still pass.
- **The edge cache owns its `EdgesGeometry`,** so the overlay `LineSegments` are marked shared. This
  is stricter than spec 11 (once per transition): it is once per element per model load. It does
  mean "a contour `EdgesGeometry` is disposed when its highlight group is torn down" is no longer
  literally true in the component — the module contract (`spec 3`) is unchanged and still tested;
  the cache disposes it on rebuild/unmount instead.
- `diffMaterialsRef` disposal and `clearEdgeGeometryCache` in two dependency arrays are additions
  the spec's edit list did not name; both are required for the teardown to be leak-free/consistent.
- **F-035 is fixed by review only.** STEP-27 has since landed (`jsdom` + `@testing-library/react` are
  configured in `vite.config.ts`), so `step23.viewportEscape.test.tsx` is no longer blocked by
  infrastructure — it is blocked by `ThreeViewport` needing a WebGL context to mount. Not written
  here.

### Residual risk

- `updateHoverAtScreenCoordsRef` is **declared and read but never assigned** (`:780`, `:1032`,
  `:1041`, `:3621`). It was already dead before this step, so the "re-evaluate hover after the
  camera settles" and "re-evaluate on non-left pointerup" paths are no-ops. Deliberately left dead
  to avoid changing post-orbit hover behaviour; wiring it is a one-liner plus a QA pass.
- Hover state now lands one animation frame after the pointer move rather than synchronously. The
  cursor class (`cursor-pointer`) and the hover overlay can lag by ≤ 1 frame.
- The edge cache is unbounded per model: hovering N distinct elements keeps N `EdgesGeometry`
  objects alive until the next model load. Acceptable for the ROADMAP's 50k-element target only
  because edges are built on hover, not on load; an LRU cap is the follow-up if memory shows up in
  the heap snapshot.
- The first frame after mount may still use the base damping: the mount effect creates
  `OrbitControls` and starts `animate()` before the `[geometries.length]` effect corrects
  `dampingFactor`. Same tick, but not provably before the first paint.
- Not verified: hover raycast time, the `< 16 ms/frame` budget, GPU-memory before/after, and the
  Escape-cancels-a-move QA case.

