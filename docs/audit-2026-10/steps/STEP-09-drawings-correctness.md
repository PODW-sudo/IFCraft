# STEP-09 — Drawings: storey elevation, state sync, sheet deletion, sheet scale, print

**Status:** not started · **Wave:** B · **Effort:** 3 d
**Findings:** F-010, F-028, F-030 · **Depends on:** — · **Blocks:** STEP-24

## Problem

The Sheet Composer is the deliverable-producing feature and every plan it produces is wrong.
Views are built once in a `useState` initialiser that runs when `App` first mounts - before a
model is loaded - so `storeys` is always `[]` and the sheet always contains one view literally
named "Ground Floor Plan (+1.2m)". Storey elevations are hard-coded to `0.0` the moment the
spatial tree is flattened, so even a live tree would cut every plan 1.2 units above zero. On the
models users actually bring, those units are millimetres: a hard-coded `+1.2` cuts 1.2 mm above
the slab instead of 1.2 m. Deleting the first sheet points `activeSheetId` at the sheet that was
just deleted, so sheet number, paper size, title, orientation and *Place View* all become silent
no-ops. And at 1:100 a 175 mm-wide viewport covers 17.5 m, so a normal building is clipped
mid-wall while print output is neither A3 nor 1:100.

## Evidence

- `frontend/src/components/drawings/DrawingSheetsModal.tsx:57-118` — `const [views, setViews] = useState<BimView[]>(() => {...})`; there is no effect that rebuilds views when `storeys` changes. The `else` at `:77-90` emits the `plan-default` view ("Ground Floor Plan (+1.2m)") whenever `storeys.length === 0`.
- `frontend/src/components/drawings/DrawingSheetsModal.tsx:69-72` — `cutPlane.position: st.elevation + 1.2`; `:83-86` — `position: 1.2` for the fallback.
- `frontend/src/components/drawings/DrawingSheetsModal.tsx:121-168` — sheets, including `projectInfo.projectName` (`:129`) and the default viewports (`:137-166`), come from the same mount-time initialiser. `App.tsx:1939-1946` renders `<DrawingSheetsModal>` unconditionally, so it mounts with `storeys = []` and `projectName = undefined` (the `'BIM Project'` default at `:53`) and never re-derives them.
- `frontend/src/hooks/useSpatialSelection.ts:70-81` — storeys are flattened with `elevation: 0.0` hard-coded at `:75`.
- `frontend/src/workers/ifcWorker.ts:221-231` — `parseNodeRecursive` reads `Name` and `GlobalId` only; `IfcBuildingStorey.Elevation` is never read, and no unit scale is exposed anywhere in the tree.
- `frontend/src/components/drawings/DrawingSheetsModal.tsx:254-259` — `setSheets((prev) => prev.filter(...)); setActiveSheetId(sheets[0].id);` - `sheets` is the pre-update array from this render, so deleting sheet 0 sets `activeSheetId` to the deleted id. `handleUpdateCurrentSheet` (`:262-266`) then matches nothing.
- `frontend/src/services/drawingEngine.ts:341` — `const scaleRatio = 1000 / vp.scale;` treats 1 model unit as 1 metre.
- `frontend/src/services/drawingEngine.ts:495-521` — `printSheet` writes `@page { size: auto; margin: 0; }` and `svg { width: 100vw; height: 100vh; }`, so the printed page is whatever the browser defaults to and the drawing is stretched to the paper, not printed at scale.
- Measured (`backend/venv/Scripts/python.exe`, this repo's fixtures):

  ```
  modelsfortests/Ifc4_Revit_ARC.ifc            unit_scale=0.001
      storeys: Foundation -800.0 | Level 1 Living Rm. -550.0 | Level 1 0.0 | Ceiling 2700.0 | Level 2 3000.0
  modelsfortests/Ifc4_SampleHouse.ifc          unit_scale=0.001
      storeys: Ground Floor 0.0 | Roof 2500.0
  modelsfortests/Ifc2x3_Duplex_Architecture.ifc unit_scale=1.0
      storeys: Level 1 0.0 | Level 2 3.1 | T/FDN -1.25 | Roof 6.0
  ```

  i.e. real Revit exports carry elevation **in millimetres**; the one metre-unit file in the fixture set is the duplex demo file. A hard-coded `+1.2` therefore cuts 1.2 mm above the floor on every real model.
- Derived from `drawingEngine.ts:341` (arithmetic, not a runtime measurement): a 3000-unit wall at 1:100 produces `3000 * (1000/100) = 30,000 mm` of drawn length inside a 175 mm viewport.

## Scope

**Change:**

- `backend/app/models/schemas.py:26-30` — `SpatialNode` gains `elevation: Optional[float] = None` and `unit_scale: Optional[float] = None`.
- `backend/app/services/ifc_service.py:150-157` — populate `elevation` for `IfcBuildingStorey` nodes (`entity.Elevation`) and `unit_scale` on the **root** node only, from `ifcopenshell.util.unit.calculate_unit_scale(model)`.
- `frontend/src/types/ifc.ts:1-6` — mirror the two optional fields on `SpatialNode`.
- `frontend/src/workers/ifcWorker.ts:221-231` — emit `elevation` for storeys and `unit_scale` on the root, using the project's `UnitsInContext` (see Notes for the exact read path).
- `frontend/src/hooks/useSpatialSelection.ts:70-81` — stop hard-coding `elevation: 0.0`; read `node.elevation ?? 0`.
- `frontend/src/services/drawingSheets.ts` — **new** pure module: `buildPlanViewsFromStoreys`, `chooseSheetScale`, `deleteSheetState`.
- `frontend/src/services/drawingEngine.ts:495-521` — split `printSheet` into pure `buildPrintDocument(svg, { width, height })` + a thin `printSheet` that opens the window and writes it; page size comes from the sheet.
- `frontend/src/services/drawingEngine.ts:341` — `scaleRatio = (1000 * unitScale) / vp.scale`.
- `frontend/src/components/drawings/DrawingSheetsModal.tsx:57-118` — replace the `useState` initialisers with `useMemo` over `storeys` / `unitScale` / `projectName` so a sheet never keeps mount-time state. Views must be **derived**, not seeded.
- `frontend/src/components/drawings/DrawingSheetsModal.tsx:121-168` — the default sheet's `projectInfo` and default viewports must be derived from the current props on first open (`isOpen` false → true), and must not be overwritten after the user edits them.
- `frontend/src/components/drawings/DrawingSheetsModal.tsx:254-259` — `handleDeleteSheet` delegates to `deleteSheetState`.
- `frontend/src/components/drawings/DrawingSheetsModal.tsx:892` (preview) and `:339-374` (SVG) — both use the same scale + unit-scale ratio.

**Do not change:**

- `extractPlanViewVectorData` / `extractSectionViewVectorData` (`drawingEngine.ts:16-250`): the cutter is geometrically correct and STEP-24 owns its performance.
- `getSheetDimensions` (`:297-309`) and `PAPER_DIMENSIONS_MM` (`types/drawings.ts:29-37`).
- The SVG layout constants (margins, title block, `clipPath`, callout geometry) - they are correct and tested by `frontend/src/tests/drawings.test.ts`.
- `DrawingSheetsModal` dialogue semantics (`aria-modal`, focus handling) - STEP-24.
- The `<line>`-per-segment preview (`:964-983`) - STEP-24 batches it.

**Non-goals:**

- Persisting sheets/views to the backend or into the IFC file. Sheets remain session state in this step.
- Real section/elevation projection depth logic, hidden-line removal, or poché fills.
- Multi-sheet printing, PDF assembly, or a layout template library.
- The `preventDefault()`-in-`onWheel` console error (F-041 - STEP-24).

## Spec

1. `SpatialNode` (backend model and frontend type) carries `elevation?: number | null` for `IfcBuildingStorey` nodes, in **project units**, and `unit_scale?: number | null` on the root node, defined as *metres per project unit* (`0.001` for a millimetre file, `1.0` for a metre file).
2. `IfcBuildingStorey` nodes that have no `Elevation` attribute serialise `elevation: 0.0`, never `null`, so downstream code has one shape.
3. `buildPlanViewsFromStoreys(storeys, unitScale)` returns one plan view per storey, in input order, with `id = 'plan-storey-<id>'`, `name = '<storey name> Plan'`, `elevation = storey.elevation` and `cutPlane.position = storey.elevation + 1.2 / unitScale` (metres → project units, defaulting `unitScale` to 1 when it is missing or non-positive).
4. When `storeys` is empty, `buildPlanViewsFromStoreys` returns exactly one fallback view whose `cutPlane.position` is `1.2 / unitScale` and whose name contains `+1.2m` only when `unitScale === 1`.
5. `chooseSheetScale(bounds, viewportMm, unitScale)` returns the smallest value from `ARCHITECTURAL_SCALES` for which the drawing fits inside `viewportMm` with a 10 % margin, and the largest available scale (500) when nothing fits. `bounds` is in project units; the drawn extent is `(max-min) * 1000 * unitScale / scale` mm.
6. `deleteSheetState(sheets, activeSheetId, targetId)` returns `{ sheets, activeSheetId }` where the removed id is gone, `activeSheetId` is **never** the removed id, and: if the deleted sheet was active, the selection moves to the surviving sheet at the same index (or the new last sheet); if it was not active, `activeSheetId` is unchanged; deleting the only remaining sheet is a no-op.
7. After the sheet composer is opened for the first time with a loaded project, the title block shows the project's name (not `BIM Project`) and the first viewport is the storey plan of the lowest storey.
8. `buildPrintDocument(svg, { width, height })` returns a complete HTML document whose `@page` rule is `size: <width>mm <height>mm` and whose `<svg>` is addressed at its natural millimetre size (no `100vw`/`100vh`).
9. The preview canvas and the exported SVG place a 3 m wall (3000 units in a mm file) at 30 mm on a 1:100 sheet.
10. Editing sheet metadata after a model loads replaces only the edited field; it must not reset `projectInfo`, viewports or scales that the user has changed.

## TDD

### 1. Add the failing test

Two tests. The backend one is the pin for the unit/elevation contract (runs today, needs no
browser). The frontend one is pure logic (runs today on `vitest` node environment).

**File 1:** `backend/tests/test_step09_storey_elevation.py`
**Command:** `.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step09_storey_elevation.py -v`

<details>

```python
import sys
from pathlib import Path

import pytest
from starlette.testclient import TestClient

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.app.main import app

FIXTURE = Path(root_dir) / "modelsfortests" / "Ifc4_SampleHouse.ifc"


def _find_nodes(node: dict, type_name: str) -> list[dict]:
    found = [node] if node.get("type") == type_name else []
    for child in node.get("children", []):
        found.extend(_find_nodes(child, type_name))
    return found


def test_spatial_tree_exposes_storey_elevation_and_unit_scale():
    """A millimetre model must report elevations in project units and its unit scale.

    Contract: elevation is in PROJECT units (mm here); unit_scale is metres per project unit.
    """
    assert FIXTURE.exists(), f"fixture missing: {FIXTURE}"

    with TestClient(app) as client:
        with FIXTURE.open("rb") as fh:
            res = client.post(
                "/api/projects/upload",
                files={"file": (FIXTURE.name, fh, "application/octet-stream")},
                data={"name": "AutoTest-Step09-StoreyElevation"},
            )
        assert res.status_code == 201, res.text
        project_id = res.json()["id"]

        try:
            tree_res = client.get(f"/api/projects/{project_id}/spatial-tree")
            assert tree_res.status_code == 200, tree_res.text
            tree = tree_res.json()

            # 1. Unit scale on the root (metres per project unit).  Ifc4_SampleHouse is MILLI.
            assert tree.get("unit_scale") == pytest.approx(0.001), (
                f"root unit_scale missing or wrong: {tree.get('unit_scale')!r}"
            )

            # 2. Storey elevations are real values in project units, not 0.0 placeholders.
            storeys = _find_nodes(tree, "IfcBuildingStorey")
            assert len(storeys) >= 2, f"expected at least 2 storeys, found {len(storeys)}"
            elevations = {s["name"]: s.get("elevation") for s in storeys}
            assert elevations.get("Roof") == pytest.approx(2500.0)
            assert elevations.get("Ground Floor") == pytest.approx(0.0)

            # 3. Every storey carries the field (never null) so consumers have one shape.
            for s in storeys:
                assert s.get("elevation") is not None, f"storey {s['name']} has no elevation"

            # 4. Non-storey nodes do not carry a unit scale - no leakage into elements.
            #    (FastAPI serialises the optional field as null, so assert on the value.)
            walls = _find_nodes(tree, "IfcWall")
            assert walls, "fixture should contain walls"
            assert all(w.get("unit_scale") is None for w in walls)
        finally:
            assert client.delete(f"/api/projects/{project_id}").status_code == 204
```

</details>

**File 2:** `frontend/src/tests/step09.drawingsCorrectness.test.ts`
**Command:** `pnpm exec vitest run src/tests/step09.drawingsCorrectness.test.ts` (from `frontend/`)

<details>

```ts
import { describe, it, expect } from 'vitest';
import {
  buildPlanViewsFromStoreys,
  chooseSheetScale,
  deleteSheetState
} from '../services/drawingSheets';
import { buildPrintDocument } from '../services/drawingEngine';
import type { DrawingSheet } from '../types/drawings';

const storeysMm = [
  { id: 11, name: 'Ground Floor', elevation: 0 },
  { id: 12, name: 'Level 2', elevation: 3000 },
  { id: 13, name: 'Roof', elevation: 6000 }
];

const sheet = (id: string, number: string): DrawingSheet => ({
  id,
  sheetNumber: number,
  sheetTitle: `TITLE ${number}`,
  paperSize: 'A3',
  orientation: 'landscape',
  projectInfo: {
    projectName: 'Villa',
    projectNumber: 'PRJ-1',
    client: 'Client',
    author: 'Author',
    date: '2026-10-24',
    revision: 'Rev A',
    status: 'Preliminary'
  },
  viewports: []
});

describe('STEP-09 plan view derivation', () => {
  it('derives one plan per storey with the cut 1.2 m above the storey, in project units', () => {
    const views = buildPlanViewsFromStoreys(storeysMm, 0.001);

    expect(views).toHaveLength(3);
    expect(views.map((v) => v.name)).toEqual(['Ground Floor Plan', 'Level 2 Plan', 'Roof Plan']);
    expect(views.map((v) => v.cutPlane.position)).toEqual([1200, 4200, 7200]);
    expect(views.every((v) => v.type === 'plan')).toBe(true);
    expect(views.every((v) => v.id.startsWith('plan-storey-'))).toBe(true);
  });

  it('still cuts at +1.2 m on a metre-unit model and keeps a labelled fallback view', () => {
    const metreViews = buildPlanViewsFromStoreys([{ id: 1, name: 'Level 1', elevation: 0 }], 1);
    expect(metreViews[0].cutPlane.position).toBeCloseTo(1.2);

    const fallback = buildPlanViewsFromStoreys([], 0.001);
    expect(fallback).toHaveLength(1);
    expect(fallback[0].id).toBe('plan-default');
    expect(fallback[0].cutPlane.position).toBeCloseTo(1200);
  });
});

describe('STEP-09 sheet scale', () => {
  it('picks a scale that fits a 30 m wide building into a 175 x 120 mm viewport at 1:200', () => {
    const bounds = { minX: 0, minY: 0, maxX: 30000, maxY: 20000 }; // mm units
    expect(chooseSheetScale(bounds, { width: 175, height: 120 }, 0.001)).toBe(200);
  });

  it('falls back to the largest available scale when nothing fits', () => {
    const huge = { minX: 0, minY: 0, maxX: 500000, maxY: 400000 }; // 500 m
    expect(chooseSheetScale(huge, { width: 175, height: 120 }, 0.001)).toBe(500);
  });
});

describe('STEP-09 sheet deletion', () => {
  const sheets = [sheet('s1', 'A-101'), sheet('s2', 'A-102'), sheet('s3', 'A-103')];

  it('never leaves activeSheetId pointing at the deleted sheet', () => {
    const next = deleteSheetState(sheets, 's1', 's1');

    expect(next.sheets.map((s) => s.id)).toEqual(['s2', 's3']);
    expect(next.activeSheetId).not.toBe('s1');
    expect(next.sheets.some((s) => s.id === next.activeSheetId)).toBe(true);
    expect(next.activeSheetId).toBe('s2');
  });

  it('keeps the current sheet when a different sheet is deleted', () => {
    const next = deleteSheetState(sheets, 's3', 's2');
    expect(next.activeSheetId).toBe('s3');
    expect(next.sheets.map((s) => s.id)).toEqual(['s1', 's3']);
  });

  it('refuses to delete the last remaining sheet', () => {
    const only = [sheet('s1', 'A-101')];
    const next = deleteSheetState(only, 's1', 's1');
    expect(next.sheets).toHaveLength(1);
    expect(next.activeSheetId).toBe('s1');
  });
});

describe('STEP-09 print document', () => {
  it('declares the real paper size instead of size: auto', () => {
    const html = buildPrintDocument('<svg xmlns="http://www.w3.org/2000/svg"></svg>', {
      width: 420,
      height: 297
    });

    expect(html).toContain('size: 420mm 297mm');
    expect(html).not.toContain('size: auto');
    expect(html).not.toContain('100vw');
  });
});
```

</details>

### 2. Watch it fail

Backend - the field does not exist yet, so pydantic drops it from the response and the test
raises `KeyError`:

```
E       KeyError: 'unit_scale'
backend\tests\test_step09_storey_elevation.py:47: KeyError
=========================== 1 failed in 3.42s ===========================
```

If you add the two fields to `SpatialNode` but forget to populate them, the failure moves to:

```
E       AssertionError: root unit_scale missing or wrong: None
E       assert None == 0.001 ± 1.0e-06
```

Frontend - unresolved module first:

```
FAIL  src/tests/step09.drawingsCorrectness.test.ts
Error: Failed to resolve import "../services/drawingSheets" from
"src/tests/step09.drawingsCorrectness.test.ts". Does the file exist?
```

and once the module exists with the current behaviour (e.g. `deleteSheetState` implemented as
`sheets[0].id`), the meaningful failure is:

```
AssertionError: expected 's1' to not be 's1'
```

### 3. Implement

1. **Backend contract** - `backend/app/models/schemas.py:26-30`: add
   `elevation: Optional[float] = None` and `unit_scale: Optional[float] = None` to `SpatialNode`.
2. `backend/app/services/ifc_service.py:150-157` (`build_node`): compute
   `elevation=float(entity.Elevation or 0.0) if entity.is_a("IfcBuildingStorey") else None`, and set
   `unit_scale=float(ifcopenshell.util.unit.calculate_unit_scale(model))` on the root node only.
   Import `ifcopenshell.util.unit` explicitly (it is not pulled in by `import ifcopenshell`).
3. **Frontend types** - `frontend/src/types/ifc.ts:1-6`: add the same two optional fields.
4. **Worker** - `frontend/src/workers/ifcWorker.ts:221-231`: inside the `try` block that reads
   `line.Name`, add `if (type === 'IfcBuildingStorey' && line.Elevation) elevation = line.Elevation.value;`
   and include `elevation` in the returned node. Compute the unit scale once in `buildSpatialTree`
   (`:128-198`) and attach it to the root node returned at `:188`. See Notes for the read path and
   the defensive default.
5. **Storey flattening** - `frontend/src/hooks/useSpatialSelection.ts:75`:
   `list.push({ id: node.express_id, name: node.name, elevation: node.elevation ?? 0 });`
6. **Pure helpers** - create `frontend/src/services/drawingSheets.ts` with
   `buildPlanViewsFromStoreys(storeys, unitScale)`, `chooseSheetScale(bounds, viewportMm, unitScale)`
   and `deleteSheetState(sheets, activeSheetId, targetId)`. All three must be pure and import only
   types plus `ARCHITECTURAL_SCALES` from `../types/drawings`.
7. **Print** - `frontend/src/services/drawingEngine.ts:495-521`: extract
   `buildPrintDocument(svgContent, { width, height })` returning the full HTML string with
   `@page { size: ${width}mm ${height}mm; margin: 0; }` and an `<svg>` sized in mm; `printSheet`
   becomes: build → `window.open` → `document.write` (unchanged plumbing).
8. **Scale ratio** - `drawingEngine.ts:341` and the duplicated arithmetic in
   `DrawingSheetsModal.tsx:892`: `const scaleRatio = (1000 * unitScale) / vp.scale;`.
   `exportSheetToSvg` gains an optional `unitScale = 1` parameter (4th positional or an options
   object - keep the existing three-argument calls working, `frontend/src/tests/drawings.test.ts:125`
   must not change).
9. **Derive, do not freeze** - `DrawingSheetsModal.tsx:57-118`: replace both `useState`
   initialisers with `useMemo` computed from `storeys`, `unitScale`, `projectName`. Keep a
   `useRef` of "user has edited this sheet" and stop deriving the moment the user types, so an
   in-flight edit is never clobbered.
10. **Placement scale** - `handlePlaceViewOnSheet` (`:269-292`): compute
    `scale: chooseSheetScale(vectorCache.get(view.id)?.bounds ?? fallback, { width: 175, height: 120 }, unitScale)`.
11. Re-run both test commands.

### 4. Watch it pass

```
backend\tests\test_step09_storey_elevation.py::test_spatial_tree_exposes_storey_elevation_and_unit_scale PASSED
=========================== 1 passed in 4.10s ===========================
```

```
 ✓ src/tests/step09.drawingsCorrectness.test.ts (8 tests) 9ms
 ✓ src/tests/drawings.test.ts (4 tests) 7ms
 Test Files  2 passed (2)
      Tests  12 passed (12)
```

Browser check (backend `:8000`, frontend `:5173`, project loaded from `Ifc4_Revit_ARC.ifc`):
open Sheets → the sheet library lists `Foundation Plan`, `Level 1 Plan`, `Level 2 Plan`,
`Roof Plan` (names from the file), the title block shows the project name, and Print preview
reports A3. Then press `Ctrl+P` in the print window: paper size must read A3, not "Letter".

### 5. Regression guard

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/ -q
pnpm exec vitest run          # from frontend/
pnpm exec tsc -b --noEmit     # from frontend/
```

`frontend/src/tests/drawings.test.ts` is the canary: it calls
`exportSheetToSvg(sheet, viewDataMap)` with three arguments and asserts `width="420mm"`,
`SCALE 1:100` and `id="viewport-vp-1"`. All three must stay true.

## Acceptance criteria

- [ ] `GET /api/projects/{id}/spatial-tree` on a millimetre model (e.g. `Ifc4_SampleHouse.ifc`) returns `unit_scale: 0.001` on the root and `elevation: 2500.0` for the `Roof` storey.
- [ ] Opening the Sheet Composer on a loaded project lists one plan view per storey, named after the storey, with the cut 1.2 m above that storey's elevation.
- [ ] The title block shows the loaded project's name; `BIM Project` appears only when no project is loaded.
- [ ] Deleting the first sheet leaves a valid `activeSheetId`; editing the sheet number immediately afterwards changes the visible sheet number.
- [ ] On a 30 m building at 1:100 the app no longer clips it: a newly placed view picks 1:200 (or better) automatically.
- [ ] A 3 m wall in a millimetre file measures 30 mm on a 1:100 sheet, in both the preview canvas and the exported SVG.
- [ ] `Print / PDF` produces a page whose `@page` size is the sheet size in mm; the drawing is not stretched to 100vw.
- [ ] `pytest backend/tests/ -q`, `pnpm exec vitest run`, `pnpm exec tsc -b --noEmit` all green.

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| Elevation semantics get implemented twice (worker + backend) and drift | Backend test pins the contract (`project units`, `unit_scale` = metres per unit); worker is written to the same two sentences; cross-check both on `Ifc4_Revit_ARC.ifc` in one manual pass | Drawings fall back to `elevation ?? 0` - degraded to today's behaviour, not a crash |
| web-ifc `GetLine` does not resolve `UnitsInContext` the way the spec assumes | Read path is spelled out in Notes with 3 `GetLine` hops; default `unitScale = 1` and `console.warn` when the chain breaks, so drawings still render | Drop the worker unit scale and pass `1` from `App`; only the mm-model cut offset regresses |
| Deriving sheets with `useMemo` clobbers user edits when a model reloads | Keep a "user has edited" ref per sheet; stop deriving that sheet once touched | Revert to `useState` initialiser - restores the frozen-at-mount bug but nothing worse |
| `exportSheetToSvg` signature change breaks the existing test / callers | New parameter is optional and defaults to `1`; only two call sites (`DrawingSheetsModal.tsx:351`, `:358`) | Keep the old signature and add a second export `exportSheetToSvgWithUnits` |
| `chooseSheetScale` returns a scale whose text callout overlaps neighbouring viewports | It only changes the placed viewport's `scale`, not its position; 10 % margin, never larger than 1:500 | Clamp to the previous fixed 100 |

## Notes

- **What was executed and what was read.** The three unit/elevation measurements above were run
  against this repo's fixtures with `backend/venv/Scripts/python.exe` + `ifcopenshell 0.9.0`
  (`ifcopenshell.util.unit.calculate_unit_scale` → `0.001` for `Ifc4_Revit_ARC.ifc`,
  `Ifc4_SampleHouse.ifc`; `1.0` for `Ifc2x3_Duplex_Architecture.ifc`). The backend test's premise
  was also executed end-to-end against a temporary storage root (`TestClient`,
  `POST /api/projects/upload` with `name=AutoTest-Step09-Probe` → **201**; `GET /spatial-tree` →
  200, 5,872 bytes; tree = `IfcProject #103 → IfcSite #82887 → IfcBuilding #118 →
  IfcBuildingStorey #131 'Ground Floor' / #137 'Roof'`; 5 `IfcWall` nodes present). Today's node
  payload has exactly the keys `children, express_id, global_id, name, type` - which is why the new
  test fails with `KeyError: 'unit_scale'`. The user's `storage/` was not touched and the project
  count was unchanged. Everything else in the Evidence section is a code read. No browser session
  was run.
- **Worker unit read path (not verified).** The intended sequence in
  `frontend/src/workers/ifcWorker.ts` is: `GetLineIDsWithType(modelID, WebIFC.IFCPROJECT)` → first id
  → `GetLine(modelID, id).UnitsInContext` (a `{ value: unitsId }` handle) → `GetLine(modelID, unitsId).Units`
  (array of handles) → for each unit `GetLine(modelID, unitId)`, keep the one whose
  `UnitType?.value === 'LENGTHUNIT'` and `Name?.value === 'METRE'`, then map
  `Prefix?.value` (`'MILLI' → 0.001`, `'CENTI' → 0.01`, `'DECI' → 0.1`, absent → `1.0`,
  `'KILO' → 1000`). web-ifc returns enum attributes as `{ type: 3, value: 'MILLI' }` objects
  (`frontend/node_modules/web-ifc/web-ifc-api-node.js:17544`), which is why `.value` is used.
  **This path was not executed by the auditor.** If it does not behave as described, keep
  `unit_scale = 1` and open a follow-up; do not block the rest of the step on it.
  `IfcConversionBasedUnit` (feet/inches) is explicitly out of scope and must fall back to `1.0`
  with a warning.
- **`Ifc4_SampleHouse.ifc` is a good fixture** for this step: 2.2 MB, millimetre units, two
  storeys (`Ground Floor 0.0`, `Roof 2500.0`). Copy it into `tmp_path` if you need to mutate it -
  never edit the tracked file.
- **Decision the executor must make:** where sheet state lives. This step keeps it in the
  component (session-only). If the executor decides sheets should survive a reload, that is a new
  endpoint and a new storage concern - out of scope here, and it must not be smuggled in.
- The `projectName` default `'BIM Project'` (`DrawingSheetsModal.tsx:53`) is a legitimate fallback
  for "no project loaded"; the bug is that it is *never* replaced. Do not delete the default.
- F-028 also mentions the sheet paper size/title being frozen. Both are initialised in the same
  `useState` at `:121-168`, so step 9 above covers them; the F-010 delete bug is what makes the
  corruption visible.

### 2026-10-25 — frontend implementation (STEP-09 frontend lane)

- **Executed.** `frontend/src/services/drawingSheets.ts` (new: `buildPlanViewsFromStoreys`,
  `chooseSheetScale`, `deleteSheetState`, `normalizeUnitScale`), `exportSheetToSvg(sheet, map,
  unitScale = 1)` with `scaleRatio = (1000 * unitScale) / vp.scale`, the
  `printSheet` / `buildPrintDocument` split (`@page { size: <w>mm <h>mm }`, no `100vw`),
  `DrawingSheetsModal` views derived with `useMemo` + sheets seeded on open from current props
  (guarded by a "user has edited" ref) + `handleDeleteSheet` delegating to `deleteSheetState` +
  auto-fit on *Place View*, worker `IfcBuildingStorey.Elevation` and root `unit_scale` parsing, and
  `SpatialNode.elevation` / `unit_scale` on the frontend type.
- **Verified.** `step09.drawingsCorrectness.test.ts` 8/8, `step09.drawings.test.ts` 10/11,
  full `vitest run` 128/129, `tsc -b --noEmit` 0, `vite build` green, `drawings.test.ts` unchanged.
- **Deviation.** The audit's ready-made source test reads the *modal* for the `@page` rule; that rule
  now lives in `drawingEngine.buildPrintDocument` (as this step's Scope section asks), so the copied
  test reads the engine for that describe block. A `/// <reference types="node" />` line was added
  because `tsconfig.app.json` includes only `vite/client`.
- **Deferred (not this lane).** (a) `App.tsx` must pass
  `unitScale={spatialTree?.unit_scale ?? 1}` to `<DrawingSheetsModal>`; (b)
  `useSpatialSelection.ts:138` must read `elevation: node.elevation ?? 0` (STEP-14 lane owns the file
  — it is the one remaining red assertion); (c) the backend `SpatialNode.elevation` / `unit_scale`
  patch in `schemas.py` + `ifc_service.py`. Exact snippets in
  `docs/audit-2026-10/steps/notes/STEP-09.md`.
- **Not verified.** No browser session was run in this lane: the 3D preview of a real model, the
  print dialogue's paper size and the storey-name list on `Ifc4_Revit_ARC.ifc` still need the manual
  pass from §4 "Browser check".

### 2026-10-25 — backend lane (the third deferred item is now done)

- **Frontend half is already landed** (see the entry above and `notes/STEP-09.md`): `drawingSheets.ts`,
  the `buildPrintDocument` split, `unitScale` on the export/preview ratio, `useMemo`-derived views,
  `deleteSheetState`, and the worker's `Elevation` / `unit_scale` parsing. The two follow-ups that
  entry listed as deferred have **also landed since** and were re-read for this note:
  `App.tsx:2011` passes `unitScale={spatialTree?.unit_scale ?? 1}` to `<DrawingSheetsModal>`, and
  `useSpatialSelection.ts:138` reads `elevation: node.elevation ?? 0`. With the backend patch below,
  nothing in the storey-plan cut path is still stubbed.
- **Backend contract implemented.** `SpatialNode` gains `elevation: Optional[float] = None` and
  `unit_scale: Optional[float] = None`. `get_spatial_hierarchy` computes
  `ifcopenshell.util.unit.calculate_unit_scale(model)` once (module now imports
  `ifcopenshell.util.unit` explicitly, `1.0` fallback with a warning) and attaches it to the **root**
  node only; `IfcBuildingStorey` nodes carry `float(entity.Elevation or 0.0)`, so a storey with no
  `Elevation` serialises `0.0`, never `null` (spec 2).
- **Watch it fail (re-measured, not quoted).** With the two patches temporarily reverted:
  `AssertionError: root unit_scale missing or wrong: None` / `assert None == 0.001 ± 1.0e-09`,
  `1 failed in 1.40s`. (The doc's other failure mode — `KeyError: 'unit_scale'` when the *field* is
  absent — is what the auditor measured; both were reproduced because both the schema field and the
  population were reverted.)
- **Watch it pass.** `test_step09_storey_elevation.py` → `1 passed in 1.20s` on the restored code.
  Measured payload: root `IfcProject` `unit_scale=0.001`, `Ground Floor` `elevation=0.0`,
  `Roof` `elevation=2500.0`, every `IfcWall` node `unit_scale=None`.
- **Note for the drawing engine.** The published contract is *elevation in project units* +
  *unit_scale = metres per project unit*, matching §Spec 1 and the doc's measured fixture table
  (`Ifc4_SampleHouse` 0.001, `Ifc2x3_Duplex_Architecture` 1.0). No extra conversion happens on either
  side.
