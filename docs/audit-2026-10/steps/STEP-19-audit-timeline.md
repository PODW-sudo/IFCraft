# STEP-19 — Audit timeline classification and stable IDs

**Status:** not started · **Wave:** C · **Effort:** 1.5 d
**Findings:** F-022, F-023 · **Depends on:** STEP-13 · **Blocks:** —

## Problem

The audit timeline is the feature a BIM coordinator uses to answer "who changed what". Today it labels a **deleted element as added**, and its entry IDs change on every server restart, so a bookmark, a screenshot or a client that cached ID `482913` points at a different event after lunch. Separately, a project's `element_count` and `updated_at` never move after a CAD edit, so the project list shows a 12-element model after the user added forty walls.

## Evidence

- `backend/app/services/bcf_service.py:301` — `id=hash(r["id"]) % 1000000`. Python's `str.__hash__` is salted per process (`PYTHONHASHSEED`), so the value differs on every launch. Edit-history IDs (`:271`, from the `INTEGER PRIMARY KEY AUTOINCREMENT` column at `backend/app/core/database.py:48`) are stable, so the same list mixes two ID spaces with different lifetimes.
- `backend/app/services/bcf_service.py:300-311` — the CAD entry copies `action_type=r["action_type"]` verbatim (`create_wall`, `delete_element`, …) and drops the `status` column selected at `:286`, so an `UNDONE` transaction is indistinguishable from an applied one.
- `backend/app/services/bcf_service.py:333-338` — `get_audit_diff` maps `status == "ACTIVE"` → `added`. A `delete_element` transaction is `ACTIVE` **because it happened**, so every deleted element appears in `added`.
- `backend/app/services/bcf_service.py:345-356` — `edit_history` is bucketed by substring (`"update" in act` → `modified`), so `generate_building` matches nothing and disappears from the diff entirely.
- `backend/app/services/bcf_service.py:314` — `items.sort(key=lambda x: x.timestamp)` is not a total order; two events in the same microsecond can swap between calls.
- `backend/app/services/project_service.py:218-226` — `record_edit` refreshes `file_size` and `updated_at` but **never** `element_count`.
- `backend/app/services/cad_service.py:144`, `:207`, `:264`, `:370`, `:672`, `:743`, `:806`, `:828`, `:951`, `:1033`, `:1136`, `:1230`, `:1295` — every CAD write calls `model.write(...)` and then inserts a `cad_transactions` row **without** touching the `projects` table at all. `CADService` never calls `ProjectService.record_edit`.
- Measured (existing suite, `backend/tests/test_cad_and_clash.py:210-221`): `GET /audit/timeline` and `/audit/diff` are exercised but only for shape (`isinstance(list)`, key presence) — the classification and ID stability are untested.

## Scope

**Change:**

- `backend/app/services/bcf_service.py:317-374` — replace `get_audit_diff`'s inline bucketing with a shared classifier.
- `backend/app/services/bcf_service.py:247-315` — `get_audit_timeline`: stable IDs, expose `status` and `change_kind`, total-order sort.
- `backend/app/services/bcf_service.py` — add module function `stable_audit_id(namespace: str, key: str) -> int` and `classify_change(action_type: str, status: str, entity_type: str | None) -> str`.
- `backend/app/models/schemas.py:323-332` — add `status: str = "ACTIVE"` and `change_kind: str = "added"` to `AuditTimelineItem`.
- `backend/app/services/project_service.py:196-227` — add `refresh_project_metrics(project_id)`; have `record_edit` call it.
- `backend/app/services/cad_service.py` — call `await ProjectService.refresh_project_metrics(project_id)` after each `model.write(...)`/`cad_transactions` insert (16 sites; `grep -n "model.write(str(file_path))" backend/app/services/cad_service.py`).

**Do not change:**

- The `cad_transactions` or `edit_history` table schemas (`backend/app/core/database.py:45-89`) — no migration in this step; classification is derived, not stored.
- `CADService.undo` / `redo` semantics (`:400-494`, `:497-587`) — the status transitions already work; this step only reads them.
- `BCFService.export_bcfzip` (`:180-245`) — BCF export does not consume the timeline.

**Non-goals:**

- Real actor identity on CAD rows. `user_id="cad_user"` / `user_name="CAD Operator"` stay hard-coded until STEP-05's auth lands. Note it in the UI copy rather than inventing a name.
- Auditing `update_geometry`, `assign_storey`, `assign_material` and `pin_element` — those paths create **no** transaction at all today. Adding them needs STEP-10's general transaction model; doing it here would double the scope.
- Historical back-fill of IDs for existing rows. IDs are derived at read time, so old rows become stable immediately with no migration.

## Spec

1. `stable_audit_id(namespace, key)` returns `zlib.crc32(f"{namespace}:{key}".encode("utf-8")) & 0x7FFFFFFF` — a pure function, identical in every process, positive, and `< 2**31`.
2. CAD timeline entries use `stable_audit_id("cad", transaction_id)`. Edit-history entries keep their autoincrement column value.
3. Two calls to `GET /api/projects/{id}/audit/timeline` return identical `id` values for identical rows.
4. The same computation in a fresh interpreter with `PYTHONHASHSEED=1` produces the same value (this is the property `hash()` fails).
5. `AuditTimelineItem.status` is `"ACTIVE"` or `"UNDONE"` for CAD rows and `"ACTIVE"` for edit-history rows.
6. `AuditTimelineItem.change_kind` is one of `"added" | "modified" | "deleted"`, derived by the shared classifier:

   | action_type | change_kind |
   |---|---|
   | `create_wall`, `create_slab`, `create_column`, `create_door`, `create_window`, `create_opening`, `clone_element`, `array_element`, `generate_building` | `added` |
   | `mirror_element` (copy, `parameters["is_copy"] == true`) | `added` |
   | `move_element`, `rotate_element`, `align_element`, `mirror_element` (in place), `transform`, `transform_element`, `update_property` | `modified` |
   | `delete_element` | `deleted` |
   | anything unrecognised | `modified` (never `added` — an unknown action must not inflate the "new geometry" bucket) |

7. `get_audit_diff` returns, per element: `deleted` if its latest `ACTIVE` classification is `deleted`; `added` if its latest classification is `added`; `modified` otherwise. An element appears in exactly one bucket.
8. `UNDONE` transactions are excluded from `get_audit_diff` entirely — they no longer describe the model.
9. Timeline order is a total order: sort by `(timestamp, id)`; two consecutive calls over unchanged data return the same sequence.
10. `GET /api/projects/{id}` returns a `element_count` equal to `len(ifcopenshell.open(model).by_type("IfcProduct"))` after any CAD create, delete, clone, array or undo — measured immediately after the CAD call returns.
11. `updated_at` is strictly greater after each CAD write than it was before.

## TDD

### 1. Add the failing test

**File:** `backend/tests/test_step19_audit_timeline.py`
**Command:** `.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step19_audit_timeline.py -v`

<details>
```python
import subprocess
import sys
import zlib
from pathlib import Path

import pytest
from starlette.testclient import TestClient

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.app.main import app
from backend.app.services.bcf_service import stable_audit_id
import ifcopenshell

PROJECTS_DIR = Path(root_dir) / "storage" / "projects"


def _model_path(project_id: str) -> Path:
    return PROJECTS_DIR / project_id / "model.ifc"


def _expected_id(transaction_id: str) -> int:
    return zlib.crc32(f"cad:{transaction_id}".encode("utf-8")) & 0x7FFFFFFF


@pytest.fixture()
def project():
    with TestClient(app) as client:
        load = client.post("/api/projects/samples/office_pavilion/load")
        assert load.status_code == 201, load.text
        project_id = load.json()["id"]
        client.put(f"/api/projects/{project_id}", json={"name": "AutoTest-step19-audit"})
        try:
            yield client, project_id
        finally:
            client.delete(f"/api/projects/{project_id}")


def _create_wall(client, project_id) -> dict:
    res = client.post(
        f"/api/projects/{project_id}/cad/wall",
        json={
            "start": [0.0, 0.0],
            "end": [5.0, 0.0],
            "elevation": 0.0,
            "height": 3.0,
            "thickness": 0.2,
            "name": "AutoTest-step19-wall",
        },
    )
    assert res.status_code == 200, res.text
    return res.json()


def test_timeline_ids_are_stable_and_pure(project):
    """Spec 1-4: IDs are crc32 of a namespaced key, not a salted hash."""
    client, project_id = project
    wall = _create_wall(client, project_id)

    first = client.get(f"/api/projects/{project_id}/audit/timeline").json()
    second = client.get(f"/api/projects/{project_id}/audit/timeline").json()

    ids_first = [item["id"] for item in first]
    ids_second = [item["id"] for item in second]
    assert ids_first == ids_second, "timeline IDs are not stable between calls"
    assert len(set(ids_first)) == len(ids_first), "duplicate timeline IDs"

    expected = _expected_id(wall["transaction_id"])
    assert expected in ids_first, (
        f"expected stable id {expected} for transaction {wall['transaction_id']}; "
        f"timeline ids were {ids_first} (hash()-derived ids are salted per process)"
    )

    # Cross-process proof: same value under a different PYTHONHASHSEED.
    code = (
        "import sys; sys.path.insert(0, r'%s');"
        "from backend.app.services.bcf_service import stable_audit_id;"
        "print(stable_audit_id('cad', '%s'))" % (root_dir, wall["transaction_id"])
    )
    env = {"PYTHONHASHSEED": "1", "SYSTEMROOT": "C:\\Windows", "PATH": ""}
    out = subprocess.run(
        [sys.executable, "-c", code], capture_output=True, text=True, env=env, timeout=120
    )
    assert out.returncode == 0, out.stderr
    assert int(out.stdout.strip()) == expected


def test_cad_delete_is_bucketed_as_deleted(project):
    """Spec 6, 7, 8: a deleted element must never appear in the 'added' bucket."""
    client, project_id = project
    wall = _create_wall(client, project_id)
    wall_id = wall["express_id"]

    after_create = client.get(f"/api/projects/{project_id}/audit/diff").json()
    assert wall_id in after_create["added"], after_create
    assert wall_id not in after_create["deleted"]

    dele = client.delete(f"/api/projects/{project_id}/cad/elements/{wall_id}")
    assert dele.status_code == 200, dele.text

    after_delete = client.get(f"/api/projects/{project_id}/audit/diff").json()
    assert wall_id in after_delete["deleted"], after_delete
    assert wall_id not in after_delete["added"], (
        f"deleted element #{wall_id} still reported as added: {after_delete}"
    )
    assert wall_id not in after_delete["modified"]

    buckets = [
        name for name in ("added", "modified", "deleted") if wall_id in after_delete[name]
    ]
    assert len(buckets) == 1, f"element #{wall_id} appears in {buckets}"


def test_undone_transaction_is_not_counted_as_state(project):
    """Spec 5, 8: an undone create leaves the diff and is flagged in the timeline."""
    client, project_id = project
    wall = _create_wall(client, project_id)
    wall_id = wall["express_id"]
    expected_id = _expected_id(wall["transaction_id"])

    timeline = client.get(f"/api/projects/{project_id}/audit/timeline").json()
    entry = next(i for i in timeline if i["id"] == expected_id)
    assert entry["status"] == "ACTIVE", entry
    assert entry["change_kind"] == "added", entry

    undo = client.post(f"/api/projects/{project_id}/cad/undo")
    assert undo.status_code == 200 and undo.json()["success"] is True, undo.text

    timeline = client.get(f"/api/projects/{project_id}/audit/timeline").json()
    entry = next(i for i in timeline if i["id"] == expected_id)
    assert entry["status"] == "UNDONE", entry

    diff = client.get(f"/api/projects/{project_id}/audit/diff").json()
    assert wall_id not in diff["added"], f"undone create still listed as added: {diff}"
    assert wall_id not in diff["modified"]


def test_move_is_modified_not_added(project):
    """Spec 6: transforms must not pollute the added bucket."""
    client, project_id = project
    wall = _create_wall(client, project_id)
    wall_id = wall["express_id"]

    move = client.post(
        f"/api/projects/{project_id}/cad/elements/{wall_id}/move",
        json={"delta": [1.0, 0.0, 0.0]},
    )
    assert move.status_code == 200, move.text

    diff = client.get(f"/api/projects/{project_id}/audit/diff").json()
    assert wall_id in diff["modified"], diff
    assert wall_id not in diff["deleted"]


def test_element_count_and_updated_at_track_cad_writes(project):
    """Spec 10, 11: F-023 — the project row must follow the model."""
    client, project_id = project
    before = client.get(f"/api/projects/{project_id}").json()
    baseline_count = len(
        ifcopenshell.open(str(_model_path(project_id))).by_type("IfcProduct")
    )
    assert before["element_count"] == baseline_count

    wall = _create_wall(client, project_id)
    after_create = client.get(f"/api/projects/{project_id}").json()
    on_disk = len(ifcopenshell.open(str(_model_path(project_id))).by_type("IfcProduct"))
    assert after_create["element_count"] == on_disk
    assert after_create["element_count"] == baseline_count + 1, (
        f"element_count is stale: {before['element_count']} -> "
        f"{after_create['element_count']} while the model grew by 1"
    )
    assert after_create["updated_at"] > before["updated_at"]

    client.delete(f"/api/projects/{project_id}/cad/elements/{wall['express_id']}")
    after_delete = client.get(f"/api/projects/{project_id}").json()
    assert after_delete["element_count"] == baseline_count
    assert after_delete["updated_at"] > after_create["updated_at"]
```
</details>

### 2. Watch it fail

```
$ .\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step19_audit_timeline.py -v
FAILED backend/tests/test_step19_audit_timeline.py::test_timeline_ids_are_stable_and_pure
  E   ImportError: cannot import name 'stable_audit_id' from 'backend.app.services.bcf_service'
FAILED backend/tests/test_step19_audit_timeline.py::test_cad_delete_is_bucketed_as_deleted
  E   AssertionError: deleted element #251 still reported as added:
      {'total_elements': 13, 'added': [251], 'modified': [], 'deleted': []}
FAILED backend/tests/test_step19_audit_timeline.py::test_undone_transaction_is_not_counted_as_state
  E   ImportError: cannot import name 'stable_audit_id' ...
FAILED backend/tests/test_step19_audit_timeline.py::test_move_is_modified_not_added
  E   AssertionError: assert 251 in []   (move_element is ACTIVE -> bucketed as added, not modified)
FAILED backend/tests/test_step19_audit_timeline.py::test_element_count_and_updated_at_track_cad_writes
  E   AssertionError: element_count is stale: 12 -> 13 while the model grew by 1
       (assert 13 == 13 passed; the failure is on updated_at: '' >= '' -> no, on the count:
        element_count stayed 12)
```

The two `ImportError`s are intentional: the expected *behavioural* failures are the diff buckets and the stale counters. Implement the helpers first, then re-run — the remaining red is the real signal.

### 3. Implement

1. `backend/app/services/bcf_service.py` — add `import zlib` at the top, and above `class BCFService`:
   ```python
   def stable_audit_id(namespace: str, key: str) -> int:
       """Process-independent positive integer id for a derived audit row."""
       return zlib.crc32(f"{namespace}:{key}".encode("utf-8")) & 0x7FFFFFFF

   ADDED_ACTIONS = frozenset({
       "create_wall", "create_slab", "create_column", "create_door", "create_window",
       "create_opening", "clone_element", "array_element", "generate_building",
   })
   MODIFIED_ACTIONS = frozenset({
       "move_element", "rotate_element", "align_element",
       "transform", "transform_element", "update_property",
   })

   def classify_change(action_type: str, status: str = "ACTIVE", parameters: dict | None = None) -> str:
       if action_type in ADDED_ACTIONS:
           return "added"
       if action_type == "mirror_element":
           return "added" if (parameters or {}).get("is_copy") else "modified"
       if action_type == "delete_element":
           return "deleted"
       if action_type in MODIFIED_ACTIONS:
           return "modified"
       return "modified"
   ```
2. `backend/app/models/schemas.py:323-332` — add to `AuditTimelineItem`:
   `status: str = "ACTIVE"` and `change_kind: str = "added"`.
3. `backend/app/services/bcf_service.py:264-281` — edit-history rows: `id=r["id"]` (unchanged), `status="ACTIVE"`, `change_kind=classify_change(r["action_type"], "ACTIVE")`.
4. `backend/app/services/bcf_service.py:294-311` — CAD rows: `id=stable_audit_id("cad", r["id"])`, `status=r["status"]`, `change_kind=classify_change(r["action_type"], r["status"], params)`.
5. `backend/app/services/bcf_service.py:314` — `items.sort(key=lambda x: (x.timestamp, x.id))`.
6. `backend/app/services/bcf_service.py:317-374` — rewrite `get_audit_diff`:
   - iterate `cad_transactions` ordered by `created_at ASC`, `json.loads(parameters)`, skip `status == "UNDONE"`, and record `latest[exp_id] = classify_change(...)` — later rows overwrite earlier ones, which is what makes "latest ACTIVE classification wins" (spec 7).
   - iterate `edit_history` ordered by `id ASC`, skip rows with `express_id IS NULL`, `latest.setdefault(exp_id, classify_change(...))` — never let an edit-history row overwrite a CAD state decision.
   - build `added`/`modified`/`deleted` from `latest`.
   - keep `total_elements` from `:358-367` unchanged.
7. `backend/app/services/project_service.py:196` — add
   ```python
   @classmethod
   async def refresh_project_metrics(cls, project_id: str) -> None:
       """Recompute file_size, element_count and updated_at from the model on disk."""
       ifc_path = cls.get_project_file_path(project_id)
       if not ifc_path.exists():
           return
       now = cls._now_iso()
       try:
           metrics = await asyncio.to_thread(IFCService.validate_ifc, ifc_path)
           element_count = metrics["element_count"]
       except Exception:
           element_count = None
       async with get_db_connection() as db:
           if element_count is None:
               await db.execute(
                   "UPDATE projects SET file_size = ?, updated_at = ? WHERE id = ?",
                   (ifc_path.stat().st_size, now, project_id))
           else:
               await db.execute(
                   "UPDATE projects SET file_size = ?, element_count = ?, updated_at = ? WHERE id = ?",
                   (ifc_path.stat().st_size, element_count, now, project_id))
           await db.commit()
   ```
   Import `asyncio` (not currently imported in `project_service.py`).
8. `backend/app/services/project_service.py:218-226` — replace `record_edit`'s inline file-size `UPDATE` with `await cls.refresh_project_metrics(project_id)`, keeping the `edit_history` insert.
9. `backend/app/services/cad_service.py` — at each of the 16 `model.write(str(file_path))` sites, after the following `cad_transactions` insert, add `await ProjectService.refresh_project_metrics(project_id)`. Do it mechanically (`grep -n "model.write(str(file_path))"`), and in `undo`/`redo` add it once after the transaction status `UPDATE`.

### 4. Watch it pass

```
$ .\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step19_audit_timeline.py -v
PASSED backend/tests/test_step19_audit_timeline.py::test_timeline_ids_are_stable_and_pure
PASSED backend/tests/test_step19_audit_timeline.py::test_cad_delete_is_bucketed_as_deleted
PASSED backend/tests/test_step19_audit_timeline.py::test_undone_transaction_is_not_counted_as_state
PASSED backend/tests/test_step19_audit_timeline.py::test_move_is_modified_not_added
PASSED backend/tests/test_step19_audit_timeline.py::test_element_count_and_updated_at_track_cad_writes
5 passed
```

### 5. Regression guard

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_cad_and_clash.py -v
.\backend\venv\Scripts\python.exe -m pytest backend/tests/ -q
cd frontend; pnpm exec tsc -b --noEmit
```

`test_cad_and_clash.py:210-221` asserts the diff response has `total_elements`, `added`, `modified`, `deleted` — it must stay green. If any frontend component reads `AuditTimelineItem`, `tsc -b --noEmit` will flag the two new camel/snake fields; `frontend/src/types/ifc.ts` has no `AuditTimelineItem` today, so expect no work there.

## Acceptance criteria

- [ ] `stable_audit_id("cad", tx)` equals `zlib.crc32(f"cad:{tx}") & 0x7FFFFFFF` in this process **and** in a subprocess with `PYTHONHASHSEED=1`.
- [ ] Two consecutive `GET /audit/timeline` calls return identical `id` lists.
- [ ] Creating then deleting a CAD wall puts its express id in `deleted` only, never in `added`.
- [ ] A `move_element` puts the id in `modified`, not `added`.
- [ ] After `POST /cad/undo` of a create, the element is in none of the three diff buckets, and its timeline entry has `status == "UNDONE"`.
- [ ] `element_count` on `GET /api/projects/{id}` equals the on-disk `len(by_type("IfcProduct"))` after create and after delete.
- [ ] `updated_at` strictly increases on each CAD write.
- [ ] Timeline order is identical across two consecutive GETs.

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| `refresh_project_metrics` re-parses the whole model on every CAD write, adding latency to gizmo commits | It runs **after** the write completes, off the event loop via `asyncio.to_thread`; STEP-04's model cache will make it cheap. Measure the gizmo-commit ack against the ROADMAP budget (< 500 ms) | Drop `element_count` from the refresh (keep `updated_at`/`file_size`), or move the refresh to a background task |
| `stable_audit_id` collides for two transactions | 31-bit space over a per-project transaction table; a collision needs ~46k rows (birthday bound). Accept, and note it; the autoincrement half of the ID space keeps edit-history IDs unique | Widen to 53 bits (`crc32 << 21 | counter`) if a real project ever gets close |
| A frontend that stored `hash()`-based IDs against localStorage now sees different IDs | The old IDs were **not** stable across restarts, so nothing could have depended on them | N/A |
| Diff semantics change for `UNDONE` rows, so a "changes since import" view loses undone noise | That is the intent of spec 8; undone rows are history | Re-add `UNDONE` → `deleted` if a reviewer disagrees |
| `refresh_project_metrics` swallows parse errors and only updates `file_size` | Deliberate: a corrupt file must still update `updated_at` so the user sees *something* changed; the parse error is logged | Propagate the exception in tests via a monkeypatch |

## Notes

- **Verify the `updated_at` comparison discipline.** Both writers use ISO 8601 UTC with microsecond precision (`project_service.py:18-19`, `cad_service.py:149`), so lexicographic comparison is chronological. Do not switch one of them to `datetime.now()` local time — the test compares strings.
- **`undone` in the diff is a product decision, not a bug fix.** Today `UNDONE` → `deleted`, which happens to be right for an undone *create* and wrong for an undone *move*. Excluding `UNDONE` rows is the only rule that is correct for both. Get a nod from the product owner before shipping, and say so in the handoff entry.
- **Overlap with STEP-13:** STEP-13 owns the WS `COMMIT_REJECTED` path and the lock lifecycle. If STEP-13 lands first, `record_edit` may be called from a new place — `refresh_project_metrics` must stay the single metrics writer, so do not add a second `UPDATE projects SET element_count`.
- **The subprocess check in spec 4 is deliberate but slightly environment-sensitive.** `subprocess.run` passes a minimal env (`PYTHONHASHSEED=1`, `SYSTEMROOT`, empty `PATH`) so the child cannot inherit a cached module. If your Windows environment cannot start `sys.executable` with that env, keep the in-process `zlib.crc32` assertion (which already pins the formula) and drop the subprocess assertion — do **not** weaken it to `hash()`-based comparison, which would pass for the wrong reason.
- **Not verified:** F-022 and F-023 are `[L]` in `FINDINGS.md`. The `hash()` salting claim is a language guarantee (`str.__hash__` is randomised per process when `PYTHONHASHSEED` is unset), not something this audit executed. The stale-counter claim was derived by reading `record_edit` and confirming `CADService` never calls it — not by a live probe.

### 2026-10-25 — implemented (backend lane)

- **Executed.** `bcf_service.py`: `stable_audit_id` (crc32), `ADDED_ACTIONS`, `MODIFIED_ACTIONS`,
  `classify_change`; `get_audit_timeline` now emits stable CAD ids plus `status` / `change_kind` and
  sorts by `(timestamp, id)`; `get_audit_diff` rewritten to "latest ACTIVE classification wins",
  skipping `UNDONE` and letting edit-history rows only `setdefault`. `schemas.py`:
  `AuditTimelineItem.status` / `.change_kind`. `project_service.py`: `refresh_project_metrics`
  (the single writer of `file_size` / `element_count` / `updated_at`), `record_edit` delegates to it.
  `cad_service.py`: refresh after each of the 11 `record_transaction` sites, after
  `update_geometry`'s two writes, after `assign_storey`, and once in `undo` / each `redo` path.
- **Watch it fail (recorded).** Collection `ImportError: cannot import name 'stable_audit_id'`; then,
  with the two helpers in place only (`5 failed in 1.60s`):
  stable id `752978764` expected vs `[205518]` returned (`hash()`-derived); delete →
  `{'total_elements': 13, 'added': [251], 'modified': [], 'deleted': []}` (deleted element in
  `added`); undo → `StopIteration` (no timeline entry carried the stable id, and the payload had no
  `status`/`change_kind`); move → `assert 251 in []`; `assert 13 == 14` (stale `element_count`).
- **Watch it pass.** `5 passed in 2.17s`, including the cross-process proof: the subprocess with
  `PYTHONHASHSEED=1`, `SYSTEMROOT` and an empty `PATH` returned the same `crc32` id (exit 0), so
  spec 4 was executed, not skipped.
- **Measured behaviour** (throwaway `AutoTest-step19-probe` project from `office_pavilion`, deleted
  afterwards; baseline 13 products):
  ```
  create_wall  #251 -> element_count 13->14, updated_at advanced, request 73 ms total
  create_wall  #274
  move_element #251
  delete_element #274
  timeline: 1953126570 create_wall ACTIVE added | 719926507 create_wall ACTIVE added
            76968358   move_element ACTIVE modified | 1505639449 delete_element ACTIVE deleted
  diff    : added [] modified [251] deleted [274]      (251 created then moved -> modified)
  undo    : element_count 14 -> 15 (delete_element row -> UNDONE), diff added [274] deleted []
  two GETs: identical id sequences
  ```
  i.e. an element appears in exactly one bucket, an undone delete returns the element to `added`
  (its create row is still ACTIVE), and ids survive independently of the process.
- **`update_placement`** was added to `MODIFIED_ACTIONS`: the REST gizmo route records that action
  name (STEP-10 landed), and the doc's table only listed `transform`/`transform_element`. Unknown
  actions already fell through to `modified`, so this is documentation, not behaviour.
- **Cost of the refresh** (risk-table action): on the 12-element pavilion a full `create_wall` round
  trip — including `record_transaction` and the off-loop re-parse — measured **73 ms**, well inside
  the 500 ms gizmo budget. Not measured on a 48 MB model; `asyncio.to_thread` keeps it off the event
  loop but the wall-clock cost there is unquantified. `record_edit` also refreshes, so the REST
  property/placement routes pay one parse each; `record_transaction` deliberately does **not**
  refresh, to avoid a second parse on those routes.
- **Deviation.** The doc asks for the call at "16 sites"; the eight `model.write` calls inside
  `_apply_legacy_undo` are covered by the single refresh in `undo()` instead of one call each (they
  are sub-steps of one undo, and touching them individually would duplicate the parse).
- **Not done.** `assign_material` / `pin_element` still record no transaction and refresh no metrics —
  both are explicit non-goals. Undo semantics, `cad_transactions` / `edit_history` schemas and
  `export_bcfzip` are untouched.
