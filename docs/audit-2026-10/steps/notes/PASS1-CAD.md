# PASS1-CAD — open-issue handoff fragments (backend lane, 2026-10-25)

Scope owned by this lane: `backend/app/services/cad_service.py` only.
`OPEN-ISSUES-PLAN.md` items **1.1**, **1.2** and **2.3**; new tests
`backend/tests/test_column_partial_resize.py`, `backend/tests/test_milli_element_creation.py`,
`backend/tests/test_undo_retention.py`.

**Not** owned / not touched: `frontend/**`, `ai_service.py`, `project_service.py`,
`websocket*.py`, `schemas.py`, other step documents, `OPEN-ISSUES-PLAN.md`.

Preserved seams: STEP-03/04 (`project_write_lock` + `run_ifc` + `atomic_write_model`),
STEP-10 (`begin_snapshot` → write → `record_transaction`, `_try_by_id`, snapshot restore),
STEP-19 (`refresh_project_metrics` on every write path), STEP-21 (write geometry, then the
property, then re-read and never report success for a no-op).

---

## 2026-10-25 - Partial column resize destroyed the dimensions the user never touched

- **Type:** Bug
- **Platform:** http://localhost:8000 (`PATCH /api/projects/{id}/cad/elements/{id}/geometry`)
- **Related tests:** TC-024; `backend/tests/test_column_partial_resize.py` (5 passed)
- **Severity:** P1 (issue 1.1)
- **Observed:** the `IfcColumn` branch rebuilt the box from
  `width = req.width or 0.35`, `depth = req.depth or 0.35`, `height = req.height or 3.0`, so
  `{"height": 4.0}` on a `0.4 x 0.4 x 3.0` column produced `0.35 x 0.35 x 4.0` (audit probe,
  STEP-21 note). An elevation-only edit rebuilt the column at the defaults too.
- **Expected:** only the requested dimension changes; when the untouched dimensions cannot be
  read, refuse with one `409 unsupported_geometry` instead of guessing.
- **Implemented:** before the rebuild, `_body_extents_metres()` reads the stored Body
  representation — one `IfcExtrudedAreaSolid` (rectangle `XDim`/`YDim`/`Depth` or
  `IfcIndexedPolyCurve` spans, Z-extrusions only) or one mesh item's
  `Coordinates.CoordList` spans — in project units, then scales by
  `calculate_unit_scale`. A tessellation fallback (`ifcopenshell.geom.create_shape`,
  local coords, already SI) covers items without coordinates. Omitted fields reuse those
  extents. No measurable extents, a multi-item Body, a skewed extrusion or a non-positive
  requested value raises `GeometryNotEditable` → `409 {"code": "unsupported_geometry"}`
  before the model is touched (byte-identical file verified in the test). Sending all three
  dimensions still takes the rebuild path.
- **Evidence:** `test_height_only_resize_keeps_width_and_depth` measures
  `0.4 x 0.4 x 3.0` → `{"height": 4.0}` → **`0.4 x 0.4 x 4.0`** (world bbox, abs `1e-6`);
  `{"width": 0.5}` → `0.5 x 0.4 x 3.0`; `{"depth": 0.6}` → `0.4 x 0.6 x 3.0`;
  `{"width":0.6,"depth":0.5,"height":2.5}` then `{"height":5.0}` → `0.6 x 0.5 x 5.0`.
  `test_unmeasurable_column_refuses_instead_of_guessing` strips the Body and gets `409`
  with an unchanged SHA-256 digest.
- **Suggested fix:** none outstanding. `_verify_persisted_geometry` now re-checks **all
  three** body spans (was height only), so a partial rebuild that silently changes a
  preserved dimension answers an error instead of success.
- **Status:** Implemented

---

## 2026-10-25 - MILLI models: the box-mesh resize divided the unit scale twice

- **Type:** Bug
- **Platform:** http://localhost:8000 (`POST /cad/slab`, `POST /cad/column`, `PATCH .../geometry`)
- **Related tests:** TC-023; `backend/tests/test_milli_element_creation.py` (3 passed)
- **Severity:** P2 (issue 1.2) — the shipped note mis-diagnosed the direction
- **Observed:** the issue text says creation passes metres into `_create_box_mesh` and a 3 m
  column becomes 3 mm. **That did not reproduce on the installed ifcopenshell 0.9.0.**
  `geometry.add_mesh_representation` divides its input by the model unit scale when
  `unit_scale` is omitted (it assumes SI), so writing "metres" was already correct: a 3 m
  column lands as 3000 project units. The real defect was the *resize* branch, which
  passed `h / unit_scale` (3000) into that same implicit conversion: measured with a
  throwaway probe, 3000 in ⇒ 3,000,000 written ⇒ **3000 m**, i.e. a 4 m height edit on a
  MILLI column produced a 4000 m column. Creation and resize disagreed in the opposite
  direction to the note.
- **Expected / delivered:** one explicit convention at the boundary. `_create_box_mesh`
  now pins `unit_scale=1.0` (so its arguments are project units by contract) and all three
  call sites — slab creation, column creation, column resize — divide metres by
  `calculate_unit_scale` themselves. Placement stays SI: `edit_object_placement` converts,
  so the `min_x`/`min_y`/`position - size/2` offsets are not divided again.
- **Evidence:** probe on `backend/app/samples/building_architecture.ifc` (scale 0.001):
  default conversion of `3000` writes `3,000,000` project units (`3000 m`);
  `unit_scale=1.0` writes `3000` (`3.0 m`).
  `test_milli_column_creation_is_in_metres`: 3 m x 0.4 m x 0.4 m column → world bbox
  `(0.4, 0.4, 3.0) m`, body coords `(400, 400, 3000)` project units, bbox min
  `(0.8, 0.8, 0.0)` (placement not scaled). `test_milli_slab_creation_is_in_metres`:
  `(4.0, 3.0, 0.2) m`, coords `(4000, 3000, 200)`.
  `test_milli_creation_and_resize_agree`: create 3 m → `{"height": 4.0}` → `4.0 m`
  (`4000` project units) with the 0.4 m profile preserved.
- **Suggested fix:** n/a. Because the file coordinates are unchanged for creation, no
  existing MILLI column needs repair; only the (previously broken) resize output changes.
- **Status:** Implemented

---

## 2026-10-25 - Undo depth was ~10 actions because post-images ate the pre-image budget

- **Type:** UX / durability
- **Platform:** http://localhost:8000 (`POST /cad/undo`, `POST /cad/redo`)
- **Related tests:** TC-001; `backend/tests/test_undo_retention.py` (2 passed)
- **Severity:** P2 (issue 2.3)
- **Observed:** one budget (20 files / 200 MB under `undo/`) held both pre-images and the
  lazy redo post-images, so ~20 files meant ~10 recorded actions; an older `delete`
  answered `success: false` with "no restorable pre-image".
- **Expected / delivered:** separate budgets. Pre-images stay in `undo/` (20 files /
  200 MB); post-images moved to `undo/post/` (10 files / 100 MB) with their own pruning.
  `_snapshot_dir(project_id, post=…)`, `_take_snapshot(…, post=True)`,
  `_prune_snapshots(…, post=…)` and `_resolve_snapshot_path` were updated; the stored
  `parameters.pre_snapshot` / `parameters.post_snapshot` values remain project-relative
  (`undo/<id>.ifc`, `undo/post/<id>.ifc`). Legacy `undo/<id>.post.ifc` rows still resolve
  (and still count against the pre-image budget, which is where they physically live).
  Undo/redo semantics are otherwise unchanged: one post-image per undone action, the same
  row flips `UNDONE` → `ACTIVE`, no second row for the same action.
- **Evidence:** 26 mutations on a fresh IFC4 project (delete is mutation 13):
  **20 pre-images / 0 post-images**; then 20 undos all return `success: true`, the deleted
  wall is restored, `undo/` still holds **20 pre-images** and `undo/post/` holds **10**
  (≤ 100 MB). Under the old shared budget the same sequence evicted every pre-image.
  A second test asserts a single undo writes exactly one `undo/post/*.ifc` and no
  `undo/*.post.ifc`.
- **Trade-off to record:** redo depth is now bounded by the post-image budget (10 files /
  100 MB), not by the undo depth. Undoing 20 actions leaves the 10 most recent redoable;
  this is a change of *redo* depth only and is documented here rather than silently raised,
  because each post-image is a full model copy (10 x 47 MB castle ≈ 470 MB would exceed
  the 100 MB cap anyway, so the byte cap governs large projects).
- **Status:** Implemented

---

## Testability notes for the next lane

- Only these files were run (no full suite, parallel lanes active):
  `test_column_partial_resize.py` (5), `test_milli_element_creation.py` (3),
  `test_undo_retention.py` (2), `test_step21_wall_resize.py` (5),
  `test_step22_opening_storey.py` (2), `test_step10_undo_delete.py` (3) — **22 passed**.
- The existing STEP-21 MILLI wall assertions still pass unchanged; the wall path
  (`create_2pt_wall` / `IfcExtrudedAreaSolid`) was not touched.
- 1.3 (frontend `[object Object]`) and 1.4 (opening revalidation after host resize) remain
  open and are outside this lane.
- Item 1.1's decision is implemented as "preserve current extents"; the `409` decision is
  implemented as the single `unsupported_geometry` code already mapped in `api/cad.py`.
