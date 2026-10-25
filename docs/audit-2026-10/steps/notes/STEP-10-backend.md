# STEP-10 — handoff fragments (backend lane, 2026-10-25)

Scope owned by this lane: `backend/app/services/cad_service.py`,
`backend/app/api/projects.py`, `backend/tests/test_step10_undo_delete.py`.

**Not** owned (still open): the `App.tsx` `Delete`/`Backspace` handler (`:873-877` still calls
`handleDeleteElement` instead of `requestDeleteElement`) and every browser-level acceptance check.
The frontend half (`destructiveActions.ts`, `ConfirmDestructiveDialog.tsx`, `DestructiveActionHost.tsx`,
`userMessages.ts`, the gated context-menu/ribbon bins) is **already landed** — see `notes/STEP-10.md`.

**Decision recorded for the step's open question:** snapshot-per-transaction (whole pre-image), not a
deleted-sub-graph fragment — the fragment approach re-inserts with new express ids and would break
Spec 3 plus every cross-reference (BCF viewpoints, pins, measurements, audit rows).

**STEP-02 seam:** `CADService.begin_snapshot(project_id)` → the existing `model.write()` →
`CADService.record_transaction(...)`. `record_transaction()` is the only insert into
`cad_transactions`; it stores `pre_snapshot` / `post_snapshot` as project-relative paths in the
row's `parameters` JSON (additive, no migration). STEP-02's single commit path should call
`begin_snapshot()` immediately before its temp-file replace and `record_transaction()` for the row;
the eleven per-method triples then collapse into it unchanged.

---

## 2026-10-25 - Undo after a delete raised RuntimeError, answered HTTP 500 and wedged the undo stack

- **Type:** Bug
- **Platform:** http://localhost:8000 (`POST /api/projects/{id}/cad/undo`)
- **Related tests:** TC-001 (undo of delete), `backend/tests/test_step10_undo_delete.py`
- **Severity:** P0
- **Observed:** `delete_element` wrote an `ACTIVE` `delete_element` row with no inverse able to
  restore it. `undo()` then ran `entity = model.by_id(express_id)` (`cad_service.py:433`), which in
  ifcopenshell 0.9 **raises** `RuntimeError: Instance #27 not found` instead of returning `None`, so
  the `if entity:` guard never ran. `api/cad.py`'s `except Exception` turned that into HTTP 500 and
  the row stayed `ACTIVE`, so every subsequent `Ctrl+Z` retried the same crashing row: the stack was
  permanently wedged and the only recovery was re-upload.
- **Expected:** Spec 3-6 — undo of a delete restores the element with the **same** `express_id`,
  `Name` and type; undo answers HTTP 200 with `success: false` (never 500) when there is nothing
  restorable; a second undo after delete+create still answers 200.
- **Evidence:** `backend/tests/test_step10_undo_delete.py` — pre-fix `2 failed, 1 passed`
  (`assert 500 == 200`, `RuntimeError: Instance #27 not found` at `cad_service.py` line 455), `3
  failed` with the third test's assertions strengthened; post-fix `3 passed in 2.13s`. The
  `test_cad_and_clash.py` undo→redo guard stayed green (`2 passed in 1.27s`).
- **Suggested fix (delivered):** per-project undo snapshots (`_snapshot_dir`, `_take_snapshot`,
  `_prune_snapshots`; 20 files / 200 MB, oldest-first, inside the project dir so `delete_project()`
  already purges them); `undo()` restores `parameters.pre_snapshot` over `model.ifc` and marks the
  row `UNDONE`, or returns `success=False` with HTTP 200 when the pre-image is missing or the
  restore would change nothing; `_try_by_id()` replaces the unguarded `by_id` calls in the undo/redo
  and mutation paths; old rows without a snapshot fall back to `_apply_legacy_undo()`, which reports
  "changed nothing" instead of lying. Rollback switch: `CADService.UNDO_SNAPSHOT_ENABLED = False`.
- **Status:** Implemented (backend). Browser confirmation still open.

---

## 2026-10-25 - Redo rebuilt elements with new express ids, and a no-op redo still claimed success

- **Type:** Bug
- **Platform:** http://localhost:8000 (`POST /api/projects/{id}/cad/redo`)
- **Related tests:** `backend/tests/test_step10_undo_delete.py`
- **Severity:** P1
- **Observed:** `redo()` re-synthesised creates through `create_*` (new `express_id`s, so every pin,
  viewpoint and audit row pointing at the old id went stale), deleted the `UNDONE` row and inserted a
  *different* `ACTIVE` row. Unknown `action_type`s fell through with `new_res = None`, yet the row was
  deleted and `success=True` was returned for a no-op.
- **Expected:** Spec 5 — redo restores the post-image, does not create a second `ACTIVE` row for the
  same action, and never reports success when nothing changed.
- **Evidence:** probe (throwaway, against the real storage root; project `AutoTest-`-prefixed and
  deleted): clone a wall → undo → redo → `redo of clone restored SAME express id: True`, history
  showed a single `('clone_element', 'ACTIVE')` and the redo returned the undone row's
  `transaction_id`.
- **Suggested fix (delivered):** `redo()` restores `parameters.post_snapshot` (captured lazily at
  undo time — the file on disk *is* the post-image of the newest `ACTIVE` row on a linear stack, so
  no second 49 MB copy per commit) and flips the same row back to `ACTIVE`. The legacy re-synthesize
  path is kept only for pre-snapshot rows and now returns `success=False` when it applied nothing.
- **Status:** Implemented (backend)

---

## 2026-10-25 - Property edits and REST gizmo drags were invisible to Ctrl+Z

- **Type:** Bug
- **Platform:** http://localhost:8000 (`POST /elements/{id}/properties`, `POST /elements/{id}/placement`)
- **Related tests:** `backend/tests/test_step10_undo_delete.py::test_property_edit_is_undoable`, TC-001
- **Severity:** P1
- **Observed:** both routes wrote `model.ifc` and only appended an `edit_history` row, so no
  `cad_transactions` row existed and undo could not reach them even in principle. Worse, undoing the
  *previous* CAD action (e.g. `create_wall`) still "succeeded", silently removing the element the user
  had just edited.
- **Expected:** Spec 7 — a property edit is reverted by one `Ctrl+Z` (previous value restored, or the
  property removed if it did not exist); a gizmo drag through the REST placement route likewise.
- **Evidence:** pre-fix the property test failed at
  `assert client.get(.../elements/{wall_id}).status_code == 200` — undo had removed the whole wall
  instead of reverting the property.
- **Suggested fix (delivered):** both routes use the same commit helper as `cad_service`
  (`begin_snapshot()` before the write, `record_transaction()` after) with `action_type`
  `update_property` / `update_placement`, and discard the orphan snapshot when the write raises. The
  property row also carries `pset_name` / `property_name` / `value` / `value_type` for the history
  panel.
- **Status:** Implemented (backend)

---

## 2026-10-25 - `GET /elements/{id}` answered 500 for a deleted element instead of 404

- **Type:** Bug
- **Platform:** http://localhost:8000 (`GET /api/projects/{id}/elements/{express_id}`)
- **Related tests:** `backend/tests/test_step10_undo_delete.py::test_undo_of_delete_restores_the_same_element`
- **Severity:** P2
- **Observed:** `IFCService.get_element_details()` calls `model.by_id(express_id)` and the API maps any
  non-`ValueError` exception to 500, so inspecting a just-deleted element (exactly what the undo test
  does between delete and undo) returned 500 `"Failed to inspect element #27: Instance #27 not found"`.
- **Expected:** 404 — the element is gone, which is a normal state, not a server fault.
- **Evidence:** pre-fix `assert 500 == 404` in the test above; post-fix the element reads 404 before
  undo and 200 with its original `Name` after.
- **Suggested fix (delivered):** `api/projects.py` maps a `RuntimeError` whose message contains
  `not found` to 404 for that endpoint only, with a comment naming the ifcopenshell quirk. The
  definitive fix (`_try_by_id`) belongs in `IFCService.get_element_details`, which another lane owns.
- **Status:** Implemented (workaround). Superseded once `ifc_service.py` adopts `_try_by_id`.

---

## 2026-10-25 - Snapshot budget is shared by pre- and post-images, so undo depth is ~10 deletions

- **Type:** UX
- **Platform:** http://localhost:8000
- **Related tests:** TC-001
- **Severity:** P3
- **Observed:** Spec 2's budget (20 files / 200 MB per project) is enforced over everything under
  `undo/`, and the redo post-images live there too, so a project holds ~20 files total: 1 pre-image
  per recorded action plus 1 post-image per undone action. Measured: 26 consecutive mutations left
  exactly 20 files, and the 6 oldest pre-images were evicted.
- **Expected:** A user pressing `Ctrl+Z` twenty times should get twenty real restores. Today the
  oldest ones degrade to the legacy inverse path: creates/transforms still revert, but a **delete**
  older than ~10 actions answers `success: false` with "no restorable pre-image" (a clean, visible
  message — not a 500).
- **Evidence:** retention probe against the real storage root (project deleted afterwards):
  `len(undo/*.ifc) == 20` after 26 mutations; undoing far past the budget reported
  `success=False` / `Cannot undo delete_element …: no restorable pre-image`.
- **Suggested fix:** either raise `CADService.UNDO_SNAPSHOT_MAX_FILES` (and accept the disk cost on
  the 47 MB castle sample), or exempt `*.post.ifc` from the file count while keeping it inside the
  200 MB byte budget, or store post-images in a `undo/post/` subdirectory with its own budget. Decide
  once the 47 MB sample's real snapshot cost is measured (the step's own risk-table action).
- **Status:** Open

---

## 2026-10-25 - Backend suite deliberately not run repo-wide (shared SQLite, parallel lanes)

- **Type:** Testability
- **Platform:** http://localhost:8000
- **Related tests:** n/a
- **Severity:** P3
- **Observed:** only `backend/tests/test_step10_undo_delete.py` and
  `backend/tests/test_cad_and_clash.py` were executed from this lane. Other steps are mid-change
  against the same `storage/projects.db` (and `cad_service.py` itself carried unrelated uncommitted
  work from earlier lanes when this lane started), so a repo-wide `pytest backend/tests` was skipped
  as instructed.
- **Expected:** `.\backend\venv\Scripts\python.exe -m pytest backend/tests -q` green at the
  integration gate — in particular `test_step21_wall_resize.py`, `test_step29_property_edit_persistence.py`
  and `test_phase3.py` / `test_phase7.py`, which all touch the two files changed here.
- **Evidence:** `git status` shows concurrent modifications to `ifc_service.py`,
  `project_service.py`, `schemas.py`, `websocket*.py` and several frontend modules.
- **Suggested fix:** run the full backend suite once the parallel lanes settle, before STEP-19.
- **Status:** Open
