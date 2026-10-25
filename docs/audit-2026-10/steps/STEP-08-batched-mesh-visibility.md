# STEP-08 — BatchedMesh visibility, isolation and per-element render styles

**Status:** not started · **Wave:** B · **Effort:** 2 d
**Findings:** F-006 · **Depends on:** — · **Blocks:** STEP-23

## Problem

On any model with more than 150 geometries the viewport switches to one `THREE.BatchedMesh`
per IFC category. From that point on, the tree's isolate button, every category toggle and
federation hide do nothing: the visibility effect flips a flag on per-instance *proxy* meshes
that were created with `proxy.visible = false` and are never added to the scene. A BIM engineer
hides all walls to look at the ductwork and the walls stay on screen - and because the raycast
path still filters by category, the walls also stop being selectable while remaining visible.
Per-element styles (Discipline, Spatial Diff) are inert on the same path for a related reason:
one material is shared by the whole batch.

## Evidence

- `frontend/src/components/viewer/ThreeViewport.tsx:1496` — `const isLargeModel = geometries.length > 150;` switches the whole scene to the batch path.
- `frontend/src/components/viewer/ThreeViewport.tsx:1569-1585` — per-instance `proxy` is created, given `proxy.visible = false` (`:1573`) and stored in `meshMapRef`; it is never passed to `group.add`.
- `frontend/src/components/viewer/ThreeViewport.tsx:1599` — the only object added to the scene for a category is `group.add(batchedMesh)`; no per-instance object reaches the render list.
- `frontend/src/components/viewer/ThreeViewport.tsx:1697-1720` — the visibility effect iterates `meshMapRef` and assigns `mesh.visible = visible` (`:1716`). On the batch path those are the invisible proxies, so nothing on screen changes.
- `frontend/src/components/viewer/ThreeViewport.tsx:336-339` — the picking path filters by `hiddenCategories` / `isolatedExpressID` / `hiddenModelIds`, i.e. the *intent* is honoured for hit-testing but not for rendering. Result: hidden elements are unselectable **and** still visible.
- `frontend/src/components/viewer/ThreeViewport.tsx:1911-1925` (Discipline) and `:1927-1953` (Diff) — assign `mesh.material` per proxy. A `BatchedMesh` draws all instances with the single material handed to its constructor (`:1536`), so per-instance material swaps cannot take effect on the batch path.
- Measured: `grep -r "setVisibleAt" frontend/src` → **0 matches**; `grep -r "perObjectFrustumCulled\|sortObjects" frontend/src` → **0 matches**. The API that makes this work exists in the installed renderer: `frontend/node_modules/three/src/objects/BatchedMesh.js:1163` (`setVisibleAt`), `:1109` (`setColorAt`); `frontend/node_modules/three/src/renderers/webgl/WebGLPrograms.js:208` enables the per-instance colour shader automatically once `_colorsTexture` exists.
- Measured: the batch path is *not* reached by the bundled demo files (all small), which is why the demo path looks correct. Threshold is hit by every real federated model.

## Scope

**Change:**

- `frontend/src/utils/instanceVisibility.ts` — **new** pure module: `isInstanceVisible`, `applyBatchVisibility`, `applyInstanceColors` (no React, no WebGL; the only collaborator is an object with `setVisibleAt` / `setColorAt`).
- `frontend/src/components/viewer/ThreeViewport.tsx:729` — add `batchRegistryRef: React.MutableRefObject<BatchRegistryEntry[]>` next to `meshMapRef`.
- `frontend/src/components/viewer/ThreeViewport.tsx:1467` — clear `batchRegistryRef.current` in the same teardown that clears `meshMapRef`.
- `frontend/src/components/viewer/ThreeViewport.tsx:1593-1600` — register `{ mesh: batchedMesh, instances: instanceDataList }` before `group.add(batchedMesh)`.
- `frontend/src/components/viewer/ThreeViewport.tsx:1698-1720` — rewrite the effect: call `applyBatchVisibility(batchRegistryRef.current, state)` and skip proxy meshes (`if (mesh.userData.batchedMesh) return;`).
- `frontend/src/components/viewer/ThreeViewport.tsx:1911-1953` — Discipline and Diff call `applyInstanceColors(...)` instead of assigning `mesh.material`; reset instance colours to white in every other branch of the same effect.
- `frontend/src/components/viewer/ThreeViewport.tsx:2138-2213` — selection highlight must not be built for instances that are currently hidden (otherwise "hidden" elements still show a yellow contour overlay).

**Do not change:**

- The `> 150` threshold at `:1496`, the category → batch grouping at `:1500-1508`, or the standard-mesh path at `:1601-1664`.
- `findVisibleCandidates` (`:290-350`) — the picking filter is already correct and must stay the single source of truth for hit-testing.
- The `meshMapRef` contract: proxies stay `visible = false` because they are *only* used as transform targets and geometry carriers for highlight overlays.
- `disposeHighlightGroup` / scene teardown (`:352-368`, `:1459-1466`) — F-033/F-037 belong to STEP-23.

**Non-goals:**

- Adding a BVH to the batch path, throttling `pointermove`, or fixing the shared-geometry `dispose()` (F-033, F-034 - STEP-23).
- Storey-level or discipline-level isolation UI. This step only makes the existing three inputs (`hiddenCategories`, `isolatedExpressID`, `hiddenModelIds`) actually render.
- Changing `BatchedMesh` for `InstancedMesh` or splitting batches per element.

## Spec

1. `isInstanceVisible(instance, state)` returns `false` iff the instance's `type` is in `hiddenCategories`, **or** `isolatedExpressID` is non-null and differs from `instance.expressID`, **or** the instance's `modelId` (default `'main'`) is in `hiddenModelIds`. Otherwise `true`.
2. `applyBatchVisibility(entries, state)` calls `setVisibleAt(instanceId, visible)` exactly once per registered instance, where `instanceId` is the `addInstance()` id recorded at build time, and returns `{ hidden, shown }` counts. It must never touch `mesh.visible`.
3. `applyBatchVisibility` is idempotent: running it twice with the same state produces the same call sequence.
4. Hiding every instance of a category leaves the `BatchedMesh` itself `visible` (so `onBeforeRender` keeps running and can re-show instances later).
5. `applyInstanceColors(entries, colorsByExpressId)` calls `setColorAt(instanceId, color)` for every instance, using the mapped colour or pure white (`0xffffff`) when absent. It returns the number of instances that received a non-white colour.
6. Discipline mode colours each instance by `inferDiscipline(type)` and Diff mode colours by `auditDiff.added` / `.modified` / default grey; in every other render style instance colours are reset to white so category materials are unchanged.
7. A selected element that is currently hidden by category, isolation or federation produces **no** selection highlight geometry and no attached transform gizmo.
8. The standard-mesh path (`geometries.length <= 150`) keeps the behaviour it has today, byte for byte, including `mesh.visible` assignment.

## TDD

### 1. Add the failing test

**File:** `frontend/src/tests/step08.instanceVisibility.test.ts`
**Command:** `pnpm exec vitest run src/tests/step08.instanceVisibility.test.ts` (from `frontend/`)

This is a pure-logic test: no jsdom, no WebGL, no `@testing-library/react`. It runs on the
current infrastructure (the same node environment `drawings.test.ts` uses). No STEP-27
dependency.

<details>

```ts
import { describe, it, expect, vi } from 'vitest';
import {
  isInstanceVisible,
  applyBatchVisibility,
  applyInstanceColors,
  type BatchRegistryEntry,
  type VisibilityState
} from '../utils/instanceVisibility';

const state = (over: Partial<VisibilityState> = {}): VisibilityState => ({
  hiddenCategories: new Set<string>(),
  isolatedExpressID: null,
  hiddenModelIds: new Set<string>(),
  ...over
});

const wall = { expressID: 101, type: 'IfcWall', modelId: 'main' };
const duct = { expressID: 205, type: 'IfcFlowSegment', modelId: 'mep' };

/** Minimal stand-in for THREE.BatchedMesh: records the calls the viewport must make. */
function fakeBatch() {
  const visibility: Array<[number, boolean]> = [];
  const colors: Array<[number, number]> = [];
  return {
    visibility,
    colors,
    setVisibleAt: vi.fn((id: number, visible: boolean) => {
      visibility.push([id, visible]);
    }),
    setColorAt: vi.fn((id: number, color: number) => {
      colors.push([id, color]);
    })
  };
}

describe('STEP-08 batched instance visibility', () => {
  it('hides an instance whose category is hidden, and only that instance', () => {
    expect(isInstanceVisible(wall, state({ hiddenCategories: new Set(['IfcWall']) }))).toBe(false);
    expect(isInstanceVisible(duct, state({ hiddenCategories: new Set(['IfcWall']) }))).toBe(true);
  });

  it('honours single-element isolation', () => {
    const s = state({ isolatedExpressID: 205 });
    expect(isInstanceVisible(duct, s)).toBe(true);
    expect(isInstanceVisible(wall, s)).toBe(false);
  });

  it('honours federation hide and defaults an absent modelId to "main"', () => {
    const s = state({ hiddenModelIds: new Set(['mep']) });
    expect(isInstanceVisible(duct, s)).toBe(false);
    expect(isInstanceVisible({ expressID: 1, type: 'IfcSlab' }, s)).toBe(true);
  });

  it('drives setVisibleAt per instance and reports counts', () => {
    const batch = fakeBatch();
    const entries: BatchRegistryEntry[] = [{ mesh: batch, instances: [wall, duct] }];

    const result = applyBatchVisibility(entries, state({ hiddenCategories: new Set(['IfcWall']) }));

    expect(result).toEqual({ hidden: 1, shown: 1 });
    expect(batch.visibility).toEqual([
      [0, false],
      [1, true]
    ]);
  });

  it('is idempotent for an unchanged state', () => {
    const batch = fakeBatch();
    const entries: BatchRegistryEntry[] = [{ mesh: batch, instances: [wall, duct] }];
    const s = state({ isolatedExpressID: 101 });

    applyBatchVisibility(entries, s);
    const first = [...batch.visibility];
    applyBatchVisibility(entries, s);

    expect(batch.visibility).toEqual([...first, ...first]);
  });

  it('colours instances per element and resets unmapped instances to white', () => {
    const batch = fakeBatch();
    const entries: BatchRegistryEntry[] = [{ mesh: batch, instances: [wall, duct] }];

    const painted = applyInstanceColors(entries, new Map([[101, 0x10b981]]));

    expect(painted).toBe(1);
    expect(batch.colors).toEqual([
      [0, 0x10b981],
      [1, 0xffffff]
    ]);
  });
});
```

</details>

### 2. Watch it fail

First run (module does not exist yet) - Vite transform error, exact wording varies slightly by
Vite version but always names the unresolved specifier:

```
FAIL  src/tests/step08.instanceVisibility.test.ts
Error: Failed to resolve import "../utils/instanceVisibility" from
"src/tests/step08.instanceVisibility.test.ts". Does the file exist?
```

Create the module with correct signatures but the current (broken) behaviour - i.e.
`applyBatchVisibility` sets `mesh.visible` on the proxies rather than calling `setVisibleAt` -
and the run must fail on the assertions, not on the import:

```
AssertionError: expected [ [ 0, false ], [ 1, true ] ] to deeply equal []
```

If the test passes at this point, the test is not testing the fix - stop and re-read Spec 2.

### 3. Implement

1. Create `frontend/src/utils/instanceVisibility.ts` with the three exports and the two
   interfaces (`InstanceRef`, `VisibilityState`, `BatchLike`, `BatchRegistryEntry`). Keep
   `applyBatchVisibility` free of `three` imports: it must accept any object that implements
   `setVisibleAt` / `setColorAt`, which is what makes it testable.
2. `ThreeViewport.tsx:729` — add `const batchRegistryRef = useRef<BatchRegistryEntry[]>([])`
   beside `meshMapRef`.
3. `ThreeViewport.tsx:1467` — add `batchRegistryRef.current = []` immediately after
   `meshMapRef.current.clear()`, so a project switch cannot leave stale batch handles.
4. `ThreeViewport.tsx:1593` — inside `categoryMap.forEach`, after `batchedMesh.userData = {...}`
   push `{ mesh: batchedMesh, instances: instanceDataList }`.
5. `ThreeViewport.tsx:1698` — replace the body of the visibility effect:

   ```ts
   applyBatchVisibility(batchRegistryRef.current, { hiddenCategories, isolatedExpressID, hiddenModelIds });
   meshMapRef.current.forEach((meshes) => meshes.forEach((mesh) => {
     if (mesh.userData.batchedMesh) return;            // batch instances are handled above
     mesh.visible = isInstanceVisible(
       { expressID: mesh.userData.expressID as number, type: mesh.userData.type as string, modelId: mesh.userData.modelId as string },
       { hiddenCategories, isolatedExpressID, hiddenModelIds }
     );
   }));
   needsRenderRef.current = true;
   ```

6. `ThreeViewport.tsx:1911-1953` — in the Discipline branch build `Map<number, number>` from
   `DISCIPLINE_COLORS[inferDiscipline(type)].color` and call `applyInstanceColors`; in the Diff
   branch map `added → 0x10b981`, `modified → 0xf59e0b`, everything else `0x64748b`. Add a
   single `applyInstanceColors(batchRegistryRef.current, new Map())` at the top of the effect so
   every other style resets to white.
7. `ThreeViewport.tsx:2138` — after `const meshes = meshMapRef.current.get(selectedExpressID)`,
   return early (detach gizmo, hide pivot dot, no overlay) when
   `!isInstanceVisible(...)` for the selected id.
8. Re-run the same `pnpm exec vitest run src/tests/step08.instanceVisibility.test.ts`.

> **Note on the findings register:** F-006 says render styles are inert in general. Reading the
> code, the *global* styles do reach the batch because `catMats` materials are the ones handed to
> `BatchedMesh`'s constructor (`:1523-1536`); only the **per-element** styles (Discipline, Diff)
> are structurally impossible with one shared material. The spec above fixes exactly those two and
> leaves the rest alone.

### 4. Watch it pass

```
 ✓ src/tests/step08.instanceVisibility.test.ts (6 tests) 12ms
 Test Files  1 passed (1)
      Tests  6 passed (6)
```

Browser confirmation (needs backend on `:8000` and frontend on `:5173`, with a model > 150
elements - `modelsfortests/Ifc4_Revit_ARC.ifc`):

```powershell
# via the QA bridge seam already exposed by App.tsx:1169
# 1. read mesh count from the HUD: should be unchanged
# 2. toggleCategory('IfcWall') -> wall geometry must disappear from the canvas
# 3. toggleCategory('IfcWall') again -> walls reappear, selected-element contour intact
```

### 5. Regression guard

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/ -q
pnpm exec vitest run          # from frontend/
pnpm exec tsc -b --noEmit     # from frontend/
```

`tsc -b` is the important one here: `BatchedMesh.setColorAt` / `setVisibleAt` are typed in
`@types/three@0.186`, and `three` 0.186.1 is what is installed. If the registry type is wrong the
build fails before the browser does.

## Acceptance criteria

- [ ] On a model with > 150 elements, `toggleCategory('IfcWall')` removes wall geometry from the canvas and re-toggling restores it.
- [ ] On the same model, isolating a single element leaves only that element drawn (grep of the canvas frame is not required; visual check plus `applyBatchVisibility` unit test).
- [ ] On a federated project, `hiddenModelIds` hides the sub-model's geometry.
- [ ] Hidden elements are not selectable **and** not highlighted: clicking where a hidden wall is returns no selection.
- [ ] Discipline render style colours walls/ducts/beams differently on a > 150-element model; Diff style colours added/modified elements per element, not per category.
- [ ] Switching Discipline → Solid resets every instance colour to white (no residue).
- [ ] `pnpm exec tsc -b --noEmit` clean; `pnpm exec vitest run` green including the 6 new tests.
- [ ] No new `setVisibleAt` call sites outside `frontend/src/utils/instanceVisibility.ts` (keeps the seam testable).

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| `_visibilityChanged` is only consumed in `BatchedMesh.onBeforeRender`, so hiding instances may not repaint until the next frame | `needsRenderRef.current = true` is already set by the effect; the render loop draws on demand | Revert the effect body to the previous `mesh.visible` line - behaviour returns to today's (broken but stable) state |
| Colours allocated lazily on first `setColorAt` triggers a shader recompile mid-interaction (one-frame hitch) | Call `applyInstanceColors(entries, new Map())` once at batch build time to force white colours and one recompile at load | Remove the per-instance colour calls; Discipline/Diff fall back to today's per-category colouring |
| `meshMapRef` proxies are consumed by the highlight and gizmo paths; skipping hidden instances could orphan a gizmo | The early return also calls `tControls.detach()`, matching the existing `selectedExpressID === null` path at `:2129-2136` | Restrict the early return to the overlay only; keep the gizmo attached |
| Selection of an element in a hidden category via the tree leaves `selectedExpressID` set but nothing visible | Acceptable and consistent with `findVisibleCandidates`; STEP-28 owns the "selection is hidden" affordance | n/a |
| Threshold-adjacent model sizes (149 vs 151 elements) take different code paths, doubling the test surface | Acceptance requires both paths tested manually once; unit test covers the pure predicate used by both | n/a |

## Notes

- **Verified by reading, not by running.** No browser session was executed for this step. The
  claims are code reads of the cited lines plus two greps (`setVisibleAt` = 0 matches,
  `perObjectFrustumCulled` = 0 matches) and the `three@0.186.1` sources in `node_modules`.
- The installed `three` does support what this step needs: `BatchedMesh.setVisibleAt`
  (`node_modules/three/src/objects/BatchedMesh.js:1163`), `setColorAt` (`:1109`), and the
  `batchingColor` program parameter (`node_modules/three/src/renderers/webgl/WebGLPrograms.js:208`)
  which turns on per-instance colour without a material flag.
- `applyBatchVisibility` deliberately does not import `three`. That keeps the regression test
  dependency-free and means STEP-23 can reuse it when the scene is rebuilt/deleted.
- Batched instances already share one geometry per element (`bg` at `:1544`), so nothing here
  changes memory. F-033 (disposing shared geometry during highlight teardown) is untouched.
- If the executor finds that hiding instances leaves stale pixels on a specific GPU/driver,
  the fallback is `batchedMesh.perObjectFrustumCulled = false; batchedMesh.sortObjects = true;`
  before `computeBoundingSphere()` at `:1598` - but do not enable `sortObjects` without measuring
  frame time first (it makes `onBeforeRender` iterate every instance every frame).

## Notes — implementation (2026-10-25)

**Status:** landed, unit-verified. Browser verification not performed in this lane.

### What changed

- **New** `frontend/src/utils/instanceVisibility.ts` — `isInstanceVisible`,
  `applyBatchVisibility`, `applyInstanceColors`, plus `InstanceRef` / `VisibilityState` /
  `BatchLike` / `BatchRegistryEntry` and a fourth helper, `createBatchLike(raw, makeColor)`
  (see deviations). No `three` import: the only collaborator is a `BatchLike`.
- `ThreeViewport.tsx`:
  - `batchRegistryRef` beside `meshMapRef`; cleared in the model-rebuild teardown **and** in the
    mount-effect teardown, so a project switch / unmount cannot leave stale batch handles.
  - BatchedMesh build now registers `{ mesh: handle, instances: instanceDataList }` before
    `group.add(batchedMesh)` and paints every instance white once at load (the risk-table
    mitigation: the colour texture + shader recompile happen at load, not on the first
    Discipline switch).
  - Visibility effect rewritten: `applyBatchVisibility(...)` for the batch, then the proxy loop
    with `if (mesh.userData.batchedMesh) return;`. `mesh.visible` is never touched on the batch
    path; the standard path is byte-for-byte the old predicate.
  - Render-style effect resets all instances to white on entry; Discipline maps
    `DISCIPLINE_COLORS[inferDiscipline(type)].color`, Diff maps added `0x10b981` / modified
    `0xf59e0b` / everything else `0x64748b`, both via `applyInstanceColors`.
  - Selection effect returns early (detach gizmo, hide pivot dot, no overlay) when the selected
    instance is hidden by category, isolation or federation.

### Tests

```
cd frontend; pnpm exec vitest run src/tests/step08.instanceVisibility.test.ts
 ✓ src/tests/step08.instanceVisibility.test.ts (6 tests)
```

Red-then-green was observed as specified: unresolved import first, then (with the broken
intermediate module that flipped `mesh.visible` on the proxies) `2 failed | 4 passed` on exactly
the `setVisibleAt` and colour assertions, then 6/6. `pnpm exec tsc -b --noEmit` reports no error
in `instanceVisibility.ts` or `ThreeViewport.tsx` (the remaining project errors belong to other
steps' files). `pnpm exec vite build` succeeds.

### Deviations

- **`createBatchLike` was added as a fourth export.** `THREE.BatchedMesh.setColorAt` takes a
  `THREE.Color`, not a hex number, and acceptance requires "no new `setVisibleAt` call sites
  outside `instanceVisibility.ts`". Keeping the adapter here satisfies both; the viewport passes a
  one-line `(hex) => scratchColor.setHex(hex)` factory and the rules stay three-free.
- `InstanceRef` gained an optional `discipline?: string` so the Discipline style can colour from
  the registry instead of re-deriving from `meshMapRef`.
- The selection effect's dependency array gained `hiddenCategories`, `isolatedExpressID`,
  `hiddenModelIds` (and `getCachedEdgesGeometry` from STEP-23). Without them the "selected element
  was just hidden" transition would not re-run the effect and the contour would survive.

### Residual risk

- `_visibilityChanged` is only consumed in `BatchedMesh.onBeforeRender`; the effect sets
  `needsRenderRef.current = true`, so the next on-demand frame applies it. If a driver shows stale
  pixels, apply the documented `perObjectFrustumCulled = false` / `sortObjects = true` fallback —
  not enabled here, unmeasured.
- Per-instance colours multiply the category material colour, so a dark category material tempers
  the discipline hue. All non-per-element styles reset to white, so Solid/Ghost/Materials are
  unchanged.
- Selecting an element and *then* hiding its category leaves `selectedExpressID` set with nothing
  highlighted (the affordance belongs to STEP-28) — consistent with `findVisibleCandidates`.
- Not verified: the >150-element visual checks (`toggleCategory`, isolation, federation hide,
  Discipline/Diff on `modelsfortests/Ifc4_Revit_ARC.ifc`). No browser session was run.

