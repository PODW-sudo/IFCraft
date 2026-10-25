# STEP-09 — Drawings correctness · handoff notes (frontend lane)

## 2026-10-25 - Sheet state is derived, sheets delete safely, scale fits, print is to scale (frontend half)
- **Type:** Bug
- **Platform:** http://localhost:5173
- **Related tests:** TC-120 (Sheet Composer opens), TC-121 (plan views per storey), TC-122 (delete
  sheet), TC-123 (print/PDF), TC-124 (export SVG)
- **Severity:** P1
- **Observed:** Three defects in the deliverable-producing feature. (1) `views` and `sheets` were built
  in `useState` initialisers that run when `App` mounts — before a model is loaded — so `storeys` was
  always `[]`, the sheet always contained one view named literally "Ground Floor Plan (+1.2m)", the
  title block always read "BIM Project" and nothing ever re-derived. (2) Deleting the first sheet did
  `setActiveSheetId(sheets[0].id)` with the pre-delete array, so `activeSheetId` pointed at the deleted
  sheet and every later sheet edit silently matched nothing. (3) At 1:100 a 175 mm viewport covers
  17.5 m, so a normal building was clipped, and `printSheet` printed `@page { size: auto }` with
  `svg { width: 100vw; height: 100vh }` — neither A3 nor 1:100.
- **Expected:** One plan view per loaded storey, cut 1.2 m above that storey's own elevation in project
  units; a title block that follows the loaded project; a `activeSheetId` that is always a live sheet;
  a placed viewport that auto-fits its building; a print page whose `@page` size is the sheet's real
  millimetre size.
- **Evidence (applied, measured):**
  - `pnpm exec vitest run src/tests/step09.drawingsCorrectness.test.ts` → **8 passed** (was
    `Failed to resolve import "../services/drawingSheets"`).
  - `pnpm exec vitest run src/tests/step09.drawings.test.ts` → 10 passed / 1 failed, the single failure
    being the deferred `useSpatialSelection.ts` one-liner below.
  - `pnpm exec vitest run` (whole suite) → 19 files / 128 passed, 1 failed (same deferral).
  - `pnpm exec tsc -b --noEmit` → 0; `pnpm run build` → built in 5.96 s.
  - `pnpm exec vitest run src/tests/drawings.test.ts` → 4 passed (canary unchanged: `width="420mm"`,
    `SCALE 1:100`, `id="viewport-vp-1"`).
- **Suggested fix (applied, frontend only):**
  - `frontend/src/services/drawingSheets.ts` (**new**, pure): `buildPlanViewsFromStoreys`,
    `chooseSheetScale` (+ `chooseSheetScaleForView`), `deleteSheetState`, `normalizeUnitScale`,
    `PLAN_CUT_HEIGHT_M = 1.2`.
  - `frontend/src/services/drawingEngine.ts`: `exportSheetToSvg(sheet, map, unitScale = 1)` with
    `scaleRatio = (1000 * unitScale) / vp.scale`; print split into `printSheet(svg, pageSize)` +
    `buildPrintDocument(svg, { width, height })` (`@page { size: ${width}mm ${height}mm; margin: 0 }`,
    `svg { width: …mm; height: …mm }`, no `100vw`).
  - `frontend/src/components/drawings/DrawingSheetsModal.tsx`: views derived with `useMemo` from
    `storeys`/`unitScale` (keyed on storey *content*, not array identity); sheets seeded on open from
    the current props and re-seeded only while the user has not edited anything
    (`hasUserSheetEditsRef`); `handleDeleteSheet` delegates to `deleteSheetState`; the sheet preview and
    the SVG export share the same unit-scaled ratio; `handlePlaceViewOnSheet` picks
    `chooseSheetScale(bounds, 175 × 120, unitScale)`.
  - `frontend/src/workers/ifcWorker.ts`: `readLengthUnitScale()` walks
    `IfcProject.UnitsInContext → IfcUnitAssignment.Units → LENGTHUNIT/METRE → SI prefix`
    (`MILLI 0.001`, `CENTI 0.01`, `DECI 0.1`, `KILO 1000`, none `1`) and the scale is attached to the
    **root** node only; `parseNodeRecursive` now emits `elevation` (project units, `0` when the
    attribute is absent) for `IfcBuildingStorey`.
  - `frontend/src/types/ifc.ts`: `SpatialNode.elevation?: number | null` and
    `unit_scale?: number | null`.
- **Status:** Open — three items are outside this lane:

  1. **Deferred App wiring (integration lane, `frontend/src/App.tsx:1939-1946`).** The modal now takes
     `unitScale`; without it the cut offset falls back to metres. Add one line:

     ```tsx
     <DrawingSheetsModal
       isOpen={isDrawingSheetsOpen}
       onClose={() => setIsDrawingSheetsOpen(false)}
       geometries={geometries}
       storeys={storeys}
       projectName={currentProject?.name}
       unitScale={spatialTree?.unit_scale ?? 1}
       activeSectionCut={sectionConfig.enabled ? { axis: sectionConfig.axis, position: sectionConfig.position } : undefined}
     />
     ```

     `spatialTree` is already in App's scope (`useModelLifecycle`), and the worker populates the field.

  2. **Deferred `useSpatialSelection.ts` one-liner (STEP-14 lane owns the file).**
     `frontend/src/hooks/useSpatialSelection.ts:138` still reads
     `list.push({ id: node.express_id, name: node.name, elevation: 0.0 });`. Replace with:

     ```ts
     list.push({ id: node.express_id, name: node.name, elevation: node.elevation ?? 0 });
     ```

     Until that lands, `step09.drawings.test.ts` › "the storey list uses the parsed elevation instead
     of a constant" is the one red assertion in the suite. Nothing else depends on it.

  3. **Deferred backend patch (backend lane owns `backend/app/models/schemas.py`,
     `backend/app/services/ifc_service.py`).** `GET /api/projects/{id}/spatial-tree` (used after CAD
     edits via `useCadDraftingMachine.ts:424`, which replaces App's tree) must carry the same contract:

     ```python
     # backend/app/models/schemas.py — SpatialNode
     class SpatialNode(BaseModel):
         express_id: int
         global_id: str
         name: str
         type: str
         elevation: Optional[float] = None      # project units, IfcBuildingStorey only, 0.0 if absent
         unit_scale: Optional[float] = None     # metres per project unit, root node only
         children: List["SpatialNode"] = []

     # backend/app/services/ifc_service.py — inside build_node(entity), root call gets unit_scale
     import ifcopenshell.util.unit  # not pulled in by `import ifcopenshell`

     elevation = (
         float(entity.Elevation or 0.0)
         if entity.is_a("IfcBuildingStorey")
         else None
     )
     unit_scale = float(ifcopenshell.util.unit.calculate_unit_scale(model))  # root only
     ```

     Pin: `backend/tests/test_step09_storey_elevation.py` (already committed by the audit lane) expects
     `unit_scale == 0.001` on the root and `Roof == 2500.0` for `Ifc4_SampleHouse.ifc`.

- **Deviation from the audit test file:** `docs/audit-2026-10/tests/frontend/step09.drawings.test.ts`
  reads the **modal** source for the print `@page` rule, but the rule now lives in
  `services/drawingEngine.ts` (`buildPrintDocument`), which is what the step document asks for. The
  copied test reads the engine for that one describe block; every other assertion is unchanged. A
  `/// <reference types="node" />` line was added because `tsconfig.app.json` only includes
  `vite/client` types (same pre-existing gap as `step12.coordinateHud.test.ts`).
- **Not done (deliberately):** no sheet persistence, no multi-sheet print, no hidden-line removal.
  "Add Plan Cut" / "Add Section Cut" still take their position input in project units even though the
  label says metres — the section default is threaded in from App's `sectionConfig`, whose unit
  convention is outside this step, so converting one and not the other would have been worse.
