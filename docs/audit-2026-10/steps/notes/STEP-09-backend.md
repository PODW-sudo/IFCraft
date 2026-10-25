# STEP-09 — handoff fragments (backend lane, 2026-10-25)

Scope owned by this lane (the backend half of the step): `SpatialNode.elevation` /
`SpatialNode.unit_scale` in `backend/app/models/schemas.py`, their population in
`backend/app/services/ifc_service.py:get_spatial_hierarchy`, and
`backend/tests/test_step09_storey_elevation.py`.

**The frontend half is already landed** — `frontend/src/services/drawingSheets.ts`,
`buildPrintDocument` in `drawingEngine.ts`, `unitScale` in the export/preview ratio,
`useMemo`-derived views and `deleteSheetState` in `DrawingSheetsModal.tsx`, `SpatialNode.elevation` /
`unit_scale` on the frontend type and the worker's `IfcBuildingStorey.Elevation` parsing. See
`docs/audit-2026-10/steps/notes/STEP-09.md` and the dated entry at the end of the step document.
The two items that note listed as deferred have **since landed in the working tree** and were
re-read while writing this fragment:

- `frontend/src/App.tsx:2011` passes `unitScale={spatialTree?.unit_scale ?? 1}` to
  `<DrawingSheetsModal>` (line 2005).
- `frontend/src/hooks/useSpatialSelection.ts:138` now reads
  `elevation: node.elevation ?? 0` instead of hard-coding `0.0`.

So the backend contract below is the last missing piece for the storey-plan cut height; no frontend
follow-up remains in this step.

---

## 2026-10-25 - Drawings had no storey elevation and no unit scale, so every plan was cut at a fake height

- **Type:** Bug
- **Platform:** http://localhost:8000 (`GET /api/projects/{id}/spatial-tree`)
- **Related tests:** `backend/tests/test_step09_storey_elevation.py` (findings F-010, F-028)
- **Severity:** P1
- **Observed:** the spatial tree published exactly `children, express_id, global_id, name, type` per
  node. `IfcBuildingStorey.Elevation` was never read and no unit information was exposed anywhere, so
  the drawing layer fell back to a hard-coded `elevation: 0.0` and a `+1.2` cut. On a real Revit
  export (millimetre units) that cut 1.2 **mm** above the slab instead of 1.2 m, and on a metre-unit
  file it cut every storey at the same height.
- **Expected:** Spec 1 and 2 — each `IfcBuildingStorey` node carries `elevation` in **project units**
  (`0.0`, never `null`, when the attribute is absent) and the **root** node carries
  `unit_scale` = metres per project unit (`0.001` for a millimetre file, `1.0` for a metre file). No
  other node carries a unit scale.
- **Evidence:** re-measured by temporarily reverting only these two patches:
  `AssertionError: root unit_scale missing or wrong: None` / `assert None == 0.001 ± 1.0e-09`,
  `1 failed in 1.40s`. Post-fix `1 passed in 1.20s`, with the payload measured on
  `modelsfortests/Ifc4_SampleHouse.ifc` (uploaded copy, project deleted afterwards):
  root `unit_scale=0.001`; `Ground Floor elevation=0.0`; `Roof elevation=2500.0`; both storeys
  non-null; every `IfcWall` node `unit_scale=None`.
- **Suggested fix (delivered):** `SpatialNode` gains
  `elevation: Optional[float] = None` and `unit_scale: Optional[float] = None`;
  `get_spatial_hierarchy` computes `ifcopenshell.util.unit.calculate_unit_scale(model)` once (module
  now imports `ifcopenshell.util.unit` explicitly — plain `import ifcopenshell` does not provide it),
  falls back to `1.0` with a logged warning, attaches it to the root only via a `is_root` flag on
  `build_node`, and sets `elevation=float(entity.Elevation or 0.0)` for storeys.
- **Status:** Implemented (backend). The browser-level acceptance checks (real `Ifc4_Revit_ARC.ifc`
  storey list, print paper size) still need the manual pass from the step document.

---

## 2026-10-25 - `unit_scale` is published on the root only, on purpose

- **Type:** Docs
- **Platform:** http://localhost:8000 (`GET /api/projects/{id}/spatial-tree`)
- **Related tests:** `backend/tests/test_step09_storey_elevation.py`
- **Severity:** P3
- **Observed:** the two new optional fields are `null` on every non-root node (FastAPI serialises
  them), which can read as "missing" to a consumer that walks to a storey first.
- **Expected:** consumers read both from the root: `elevation` per storey, `unit_scale` once at
  `tree.unit_scale`, then compute `storey.elevation + 1.2 / unit_scale` for the cut plane.
- **Evidence:** the contract is pinned by the test's four assertions, including
  `all(w.get("unit_scale") is None for w in walls)`.
- **Suggested fix (delivered):** documented in the `SpatialNode` field comments and in the step
  document's dated entry. If a future consumer needs the scale on every node, copy it into the
  children at build time — do not recompute it per node (it is a per-file constant).
- **Status:** Implemented (docs). No code change pending.
