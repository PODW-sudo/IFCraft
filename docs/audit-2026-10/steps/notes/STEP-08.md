# STEP-08 — BatchedMesh visibility, isolation and per-element styles · handoff notes

## 2026-10-25 - Category/isolation/federation toggles did nothing on models > 150 elements
- **Type:** Bug
- **Platform:** http://localhost:5173
- **Related tests:** TC for category toggle, isolate, federation hide, Discipline/Diff render style
  (key tier: viewport mount + model load + hierarchy toggles + render style)
- **Severity:** P1
- **Observed:** On any model with more than 150 geometries the viewport builds one
  `THREE.BatchedMesh` per IFC category. The visibility effect then flipped `visible` on the
  per-instance proxy meshes, which are created with `proxy.visible = false` and never added to the
  scene. Hiding all walls left the walls on screen while the pick filter
  (`findVisibleCandidates`) already excluded them — so the walls were simultaneously visible and
  unselectable. Discipline and Spatial Diff were inert for the same structural reason: one material
  is shared by the whole batch, so per-element `mesh.material` swaps could not take effect.
- **Expected:** `hiddenCategories` / `isolatedExpressID` / `hiddenModelIds` change what is drawn, and
  Discipline/Diff colour individual elements. The standard-mesh path (< 150 elements) is unchanged.
- **Evidence:** `pnpm exec vitest run src/tests/step08.instanceVisibility.test.ts` → 6 passed
  (red before implementation: `setVisibleAt` never called, colours never painted).
  `pnpm exec tsc -b --noEmit` clean for `frontend/src/utils/instanceVisibility.ts` and
  `ThreeViewport.tsx`; `pnpm exec vite build` succeeds. Browser check on
  `modelsfortests/Ifc4_Revit_ARC.ifc` **not** performed in this lane.
- **Suggested fix (applied):** new pure module `frontend/src/utils/instanceVisibility.ts`
  (`isInstanceVisible`, `applyBatchVisibility`, `applyInstanceColors`, `createBatchLike`); the
  viewport registers `{ mesh, instances }` per batch in `batchRegistryRef`, drives
  `BatchedMesh.setVisibleAt` (never `mesh.visible`, so `onBeforeRender` can re-show instances),
  resets instance colours to white on every style switch and paints Discipline/Diff through
  `setColorAt`, allocates the colour texture once at load, and suppresses the selection overlay +
  gizmo for an element that is currently hidden.
- **Status:** Fixed — unit-verified. Browser verification of the > 150-element acceptance criteria
  still outstanding; note that `setVisibleAt` needs a frame to take effect (`_visibilityChanged` is
  consumed in `onBeforeRender`) and the effect sets `needsRenderRef.current = true`.
