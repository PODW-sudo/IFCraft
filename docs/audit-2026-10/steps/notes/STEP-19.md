# STEP-19 — handoff fragments (backend lane, 2026-10-25)

Scope owned by this lane: `backend/app/services/bcf_service.py` (classifier + stable IDs +
timeline/diff), `backend/app/models/schemas.py` (`AuditTimelineItem.status` / `.change_kind`),
`backend/app/services/project_service.py` (`refresh_project_metrics`), `backend/app/services/cad_service.py`
(metrics/audit hooks only — STEP-10's snapshot/undo machinery and STEP-21/STEP-22 geometry paths were
left intact), `backend/tests/test_step19_audit_timeline.py`.

---

## 2026-10-25 - Audit timeline IDs changed on every server restart

- **Type:** Bug
- **Platform:** http://localhost:8000 (`GET /api/projects/{id}/audit/timeline`)
- **Related tests:** `backend/tests/test_step19_audit_timeline.py::test_timeline_ids_are_stable_and_pure`
  (finding F-022)
- **Severity:** P1
- **Observed:** CAD timeline entries used `id=hash(r["id"]) % 1000000`. `str.__hash__` is salted per
  process, so the same transaction answered a different id after a restart: a bookmark, a screenshot
  or a client that cached id `482913` pointed at a different event after lunch. The list also mixed
  two ID spaces with different lifetimes (edit-history autoincrement vs the salted hash), and the
  sort key was `timestamp` alone — not a total order, so two events in the same microsecond could
  swap between calls.
- **Expected:** Spec 1-4 — `stable_audit_id(namespace, key)` =
  `zlib.crc32(f"{namespace}:{key}") & 0x7FFFFFFF`, identical in every process; two consecutive GETs
  return identical id lists; ordering is a total order.
- **Evidence:** pre-fix `expected stable id 752978764 for transaction fb711a96-…; timeline ids were
  [205518]` (`assert 752978764 in [205518]`). Post-fix the subprocess launched with
  `PYTHONHASHSEED=1`, `SYSTEMROOT` and an empty `PATH` printed the same integer (exit 0), i.e. the
  cross-process property was executed, not assumed; two consecutive GETs returned identical id
  sequences (`ids stable (2 GET): True`).
- **Suggested fix (delivered):** `stable_audit_id` module function; CAD rows use
  `stable_audit_id("cad", r["id"])`, edit-history rows keep their autoincrement `id`;
  `items.sort(key=lambda x: (x.timestamp, x.id))`. No migration: ids are derived at read time, so old
  rows became stable immediately.
- **Status:** Implemented (backend)

---

## 2026-10-25 - A deleted element was reported as *added*, and an undone action looked applied

- **Type:** Bug
- **Platform:** http://localhost:8000 (`GET /api/projects/{id}/audit/diff`, `/audit/timeline`)
- **Related tests:** `::test_cad_delete_is_bucketed_as_deleted`, `::test_undone_transaction_is_not_counted_as_state`,
  `::test_move_is_modified_not_added` (findings F-022, F-023)
- **Severity:** P1
- **Observed:** `get_audit_diff` mapped `status == "ACTIVE"` → `added`, so **every** applied action
  counted as new geometry: a `delete_element` transaction is `ACTIVE` *because it happened*, and a
  `move_element` too. `get_audit_timeline` copied `action_type` verbatim and dropped the `status`
  column it selected, so an `UNDONE` transaction was indistinguishable from an applied one. Edit
  history was bucketed by substring (`"update" in act`), so `generate_building` vanished from the diff
  entirely.
- **Expected:** Spec 5-8 — a shared `classify_change(action_type, status, parameters)` mapping
  (`create_*`/`clone`/`array`/`generate_building` → `added`, `mirror_element` with
  `is_copy=true` → `added` else `modified`, transforms/`update_property` → `modified`,
  `delete_element` → `deleted`, anything unknown → `modified` never `added`); per element the
  **latest ACTIVE** classification wins, each element appears in exactly one bucket, and `UNDONE`
  rows are excluded from the diff while still being visible in the timeline with
  `status="UNDONE"`.
- **Evidence:** pre-fix, measured: after create+delete the diff was
  `{'total_elements': 13, 'added': [251], 'modified': [], 'deleted': []}`; after create+move,
  `{'total_elements': 14, 'added': [251], 'modified': [], 'deleted': []}` (`assert 251 in []`); the
  timeline lookup for the stable id raised `StopIteration` because the payload had no
  `status`/`change_kind`. Post-fix, measured on a throwaway project (baseline 13 products):
  `timeline: 1953126570 create_wall ACTIVE added | 719926507 create_wall ACTIVE added |
  76968358 move_element ACTIVE modified | 1505639449 delete_element ACTIVE deleted` and
  `diff: added [] modified [251] deleted [274]`; after one undo of the delete,
  `delete_element` reads `UNDONE` and the diff becomes `added [274] deleted []`.
- **Suggested fix (delivered):** `ADDED_ACTIONS` / `MODIFIED_ACTIONS` / `classify_change` module
  functions, used by both `get_audit_timeline` and `get_audit_diff`; the diff iterates CAD rows
  oldest-first (`ORDER BY created_at ASC, rowid ASC`) writing `latest[exp_id]`, skips `UNDONE`, then
  lets edit-history rows only `setdefault` so an audit-log line can never override a CAD verdict.
  `update_placement` was added to `MODIFIED_ACTIONS` because the REST gizmo route records that name.
- **Status:** Implemented (backend). **Product decision to confirm** (see the step document's note):
  excluding `UNDONE` rows from the diff is correct for both an undone create and an undone move, but
  a "changes since import" view loses undone noise — get a nod from the product owner before
  release.

---

## 2026-10-25 - `element_count` and `updated_at` never moved after a CAD edit

- **Type:** Bug
- **Platform:** http://localhost:8000 (`GET /api/projects/{id}`, project list)
- **Related tests:** `::test_element_count_and_updated_at_track_cad_writes` (finding F-023)
- **Severity:** P1
- **Observed:** every CAD write called `model.write(...)` and inserted a `cad_transactions` row without
  touching the `projects` table at all — `CADService` never called `ProjectService.record_edit`, and
  `record_edit` itself refreshed only `file_size`/`updated_at`, never `element_count`. The project
  list therefore kept reporting the imported count (12 on the pavilion) after the user added walls.
- **Expected:** Spec 10-11 — `element_count` equals `len(ifcopenshell.open(model).by_type("IfcProduct"))`
  immediately after a create/delete/clone/array/undo, and `updated_at` strictly increases on each CAD
  write.
- **Evidence:** pre-fix `assert 13 == 14` (`element_count is stale: 12 -> 13` in the audit's wording;
  the pavilion fixture actually loads 13 products). Post-fix:
  `element_count 13 -> 14` after one wall, `updated_at advanced=True`, `14 -> 15` after undoing a
  delete, and `diff.total_elements` agrees with the project row.
- **Suggested fix (delivered):** `ProjectService.refresh_project_metrics(project_id)` — the **single**
  writer of `file_size` / `element_count` / `updated_at`, recomputing via
  `asyncio.to_thread(IFCService.validate_ifc, …)` and falling back to `file_size`/`updated_at` only
  when the model cannot be parsed. `record_edit` delegates to it, and `cad_service` awaits it after
  each of the 11 `record_transaction` sites, after `update_geometry` (two writes, no transaction row),
  after `assign_storey`, and once in `undo` / each `redo` path.
- **Status:** Implemented (backend)

---

## 2026-10-25 - The metrics refresh costs a full model re-parse per CAD write

- **Type:** UX
- **Platform:** http://localhost:8000 (`POST /api/projects/{id}/cad/*`)
- **Related tests:** `::test_element_count_and_updated_at_track_cad_writes`
- **Severity:** P2
- **Observed:** `refresh_project_metrics` opens and scans `model.ifc` on every CAD write to count
  `IfcProduct`. Measured on the 12-element `office_pavilion` project: a full `create_wall` round trip
  (write + `record_transaction` + refresh) took **73 ms**, well inside the 500 ms gizmo budget. The
  48 MB `Ifc2x3_SampleCastle.ifc` and 29 MB MEP models were **not** measured — there the parse is
  seconds, and every gizmo commit now pays it.
- **Expected:** a commit ack under the ROADMAP budget on the largest model the product claims to
  support.
- **Evidence:** probe timings above; the parse runs off the event loop (`asyncio.to_thread`), so it
  does not stall other requests in the meantime.
- **Suggested fix:** keep refreshing `updated_at`/`file_size` cheaply and take `element_count` from
  the model cache once STEP-04 lands; or delta the count (create → +1, delete → −1) and keep the full
  re-parse for import only. Do **not** add a second `UPDATE projects SET element_count` path.
- **Status:** Open

---

## 2026-10-25 - Only this lane's test file plus `test_cad_and_clash.py` / `test_schema_compliance.py` were executed

- **Type:** Testability
- **Platform:** http://localhost:8000
- **Related tests:** `test_step19_audit_timeline.py`
- **Severity:** P3
- **Observed:** `pytest backend/tests` was not run repo-wide: other lanes are editing
  `cad_service.py` / `projects.py` and concurrent runs contend on the shared `storage/projects.db`.
  `test_cad_and_clash.py:210-221` only asserts the diff *shape*, which is how a deleted element in the
  `added` bucket shipped unnoticed.
- **Expected:** the full suite green at the integration gate.
- **Evidence:** `24 passed` across the three step files + the two named guards in a single run
  (`test_cad_and_clash.py` 2/2, `test_schema_compliance.py` 4/4).
- **Suggested fix:** strengthen `test_cad_and_clash.py`'s audit block with a create→delete→diff
  assertion so the shape-only check cannot regress silently again.
- **Status:** Open
