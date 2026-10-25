# STEP-21 — handoff fragments (backend lane, 2026-10-25)

Scope owned by this lane: `backend/app/services/cad_service.py` (wall/slab resize path) and the
single `GeometryNotEditable` → `409` mapping in `backend/app/api/cad.py`.

**Not** owned (deferred, listed below): `backend/app/services/ifc_service.py`, `schemas.py`,
`frontend/**`, the commit/undo path (STEP-02/STEP-10).

---

## 2026-10-25 - Walls created through the API had no geometry at all (ifcopenshell 0.9)

- **Type:** Bug
- **Platform:** http://localhost:5173 (backend `POST /api/projects/{id}/cad/wall`)
- **Related tests:** TC-021, TC-022 (STEP-21 tests 1-3)
- **Severity:** P0
- **Observed:** `create_wall` called `geometry.create_2pt_wall(...)` and threw the return value
  away. With the installed `ifcopenshell` 0.9.0 that usecase *returns* the representation instead of
  assigning it (`backend/venv/Lib/site-packages/ifcopenshell/api/geometry/create_2pt_wall.py:69-88`),
  so every wall created from the UI was written with `Representation = None`: no geometry in the
  viewport, nothing in an export, and a `409` on every attempted resize.
- **Expected:** A wall created by `POST /cad/wall` has one `Body` `IfcShapeRepresentation` with an
  `IfcExtrudedAreaSolid`, exactly as `create_slab`/`create_column` do via
  `geometry.assign_representation`.
- **Evidence:** step document `## Evidence` assumed a representation exists; measured with a
  throwaway `TestClient` script — `#251=IfcWall(...)` had `Representation attr: None` while
  `model.by_type("IfcShapeRepresentation")` counted 11 (all pre-existing).
- **Suggested fix:** landed — `create_wall` keeps the returned representation and assigns it when
  `wall.Representation is None`. No other file changed. `backend/requirements.txt` pins only
  `ifcopenshell>=0.8.0`, so a reinstall can flip this behaviour again; pin the minor version or
  keep this guard.
- **Status:** Implemented (guard); the unpinned dependency is still open.

---

## 2026-10-25 - Column height edit silently resets width and depth to 0.35 m

- **Type:** Bug
- **Platform:** http://localhost:5173 (backend `PATCH /cad/elements/{id}/geometry`)
- **Related tests:** TC-024
- **Severity:** P1
- **Observed:** The `IfcColumn` branch rebuilds its box mesh from
  `width = req.width or 0.35`, `depth = req.depth or 0.35`, `height = req.height or 3.0`. A caller
  that sends only `{"height": 4.0}` for a `0.4 × 0.4 × 3.0` column gets `0.35 × 0.35 × 4.0` —
  a dimension edit destroys two dimensions the user never touched. (Measured; the STEP-21 spec says
  "keep the existing rebuild behaviour", so it was not changed here.)
- **Expected:** Only the requested dimension changes, like the wall path: read `IfcRectangleProfileDef`
  X/Y (or the mesh extents) and reuse them when `width`/`depth` are absent, or require both.
- **Evidence:** `backend/app/services/cad_service.py` column branch in `update_geometry`; throwaway
  probe: `{'item': 'IfcPolygonalFaceSet', 'extent_m': [0.4, 0.4, 3.0]}` before,
  `[0.35, 0.35, 4.0]` after `{"height": 4.0}`.
- **Suggested fix:** capture the current extents before rebuilding
  (`entity.Representation` mesh `Coordinates.CoordList`) and default `w`/`d` from them; or return
  `409` when `width`/`depth` are omitted, which is at least honest.
- **Status:** Open

---

## 2026-10-25 - `_create_box_mesh` still writes raw metres (slab/column *creation* on MILLI models)

- **Type:** Bug
- **Platform:** http://localhost:5173 (backend `POST /cad/slab`, `POST /cad/column`)
- **Related tests:** TC-023
- **Severity:** P2
- **Observed:** `create_slab` and `create_column` pass metres straight into `_create_box_mesh`,
  whose vertices are written as project units. On a MILLI model (`calculate_unit_scale = 0.001`) a
  3 m column is created 3 mm tall. The resize path was converted to project units in this lane
  (`w / unit_scale`), so creation and resize now disagree on a MILLI model.
- **Expected:** One conversion convention: build geometry in project units at the boundary.
- **Evidence:** step document `## Notes` (first bullet); `_create_box_mesh` call sites in
  `create_slab`/`create_column` are unchanged.
- **Suggested fix:** divide `dx`/`dy`/`dz` by `ifcopenshell.util.unit.calculate_unit_scale(model)`
  at both creation call sites (mirroring the resize branch), and add a MILLI slab/column test — the
  existing suite only exercises metre models.
- **Status:** Open

---

## 2026-10-25 - `409 unsupported_geometry` reaches the user as `[object Object]` / console only

- **Type:** UX
- **Platform:** http://localhost:5173
- **Related tests:** TC-021, TC-024
- **Severity:** P2
- **Observed:** `frontend/src/services/api.ts:467-470` throws `new Error(err.detail)`; the new `409`
  body is an object (`{"code": "unsupported_geometry", "message": …}`), so the message stringifies
  to `[object Object]`, and `useCadDraftingMachine.handleUpdateGeometry` swallows the throw into
  `console.error`. A refused resize is now *honest on the wire* and invisible in the UI.
- **Expected:** A dismissible message naming the reason ("this wall's geometry cannot be resized
  parametrically"), reusing `services/userMessages.ts` + `UserMessageHost` from STEP-10.
- **Evidence:** `frontend/src/services/api.ts:457-472`,
  `frontend/src/hooks/useCadDraftingMachine.ts:402-417`,
  `frontend/src/components/cad/GlassContextualModifyDock.tsx:165-173`.
- **Suggested fix:** in `updateElementGeometry`, read `err.detail?.message ?? err.detail` and lift
  the catch to a `pushUserMessage("error", …)`; expose `code` so the dock can disable the
  height/thickness fields for non-resizable selections. Frontend lane — not touched here.
- **Status:** Open (frontend lane)

---

## 2026-10-25 - Resize does not move or validate openings; elevation failures answer 409, not 422

- **Type:** Bug
- **Platform:** http://localhost:5173
- **Related tests:** TC-021, TC-022
- **Severity:** P3
- **Observed:** Two documented gaps. (a) A wall `height`/`thickness` change edits the extrusion only;
  an opening positioned off the wall base keeps its sill and can end up taller than a shortened
  wall, and a *thickness* change can leave the void wider than the wall. (b) Step spec 7 asks for
  `422` when the elevation edit fails; the delivery returns `409 unsupported_geometry` because that
  is the only mapping this lane was scoped to add in `api/cad.py`.
- **Expected:** (a) at minimum a warning in the response, ideally clamping; (b) one agreed status
  code for "geometric edit refused" — either accept `409` for placement failures too, or add
  `GeometryUpdateFailed` → `422`.
- **Evidence:** step document non-goals and `## Risks and rollback`; measured `409` body for a wall
  with no extruded body, and `200` for a valid elevation.
- **Suggested fix:** (a) belongs with STEP-22/STEP-10 (opening validity after a host resize);
  (b) product decision, one line in `api/cad.py` either way.
- **Status:** Open

---

## 2026-10-25 - Landed: wall resize edits the representation, not just the property

- **Type:** Enhancement
- **Platform:** http://localhost:5173
- **Related tests:** TC-021, TC-022, TC-023
- **Severity:** P1
- **Observed:** `IfcWall` resize wrote `Dimensions.Height`/`Dimensions.Thickness` and left the
  `IfcExtrudedAreaSolid` untouched, so the panel and the exported IFC disagreed; the elevation
  branch swallowed every exception and still answered `{"success": true}`.
- **Expected / delivered:** geometry first (`Depth` for height, `SweptArea.YDim` or the
  `IfcIndexedPolyCurve` Y span for thickness, all converted with
  `ifcopenshell.util.unit.calculate_unit_scale`), property second, and a re-read verification that
  refuses success unless the on-disk value matches within `1e-6` project units. Non-editable
  representations (`IfcFaceBasedSurfaceModel`, multi-item bodies, non-Z extrusions, polyline
  profiles asked for thickness) return `409 {"detail": {"code": "unsupported_geometry", "message":
  …}}` and leave `model.ifc` byte-identical — validation runs before any mutation. Measured:
  metre wall `Depth 3.0 → 5.0` with bbox Z `3.0 → 5.0`; thickness `0.25 → 0.4`; MILLI wall
  `Depth 3000 → 5000`, coords Y `250 → 400`; imported `IfcRectangleProfileDef` wall `YDim → 0.5`
  with `Depth 3.1` preserved.
- **Evidence:** `backend/tests/test_step21_wall_resize.py` (5 passed),
  `backend/tests/test_cad_and_clash.py` (2 passed), full suite 52 passed / 1 pre-existing
  `test_step01` FK failure that passes in isolation.
- **Suggested fix:** n/a
- **Status:** Implemented
