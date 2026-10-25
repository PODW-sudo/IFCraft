# STEP-03 — Atomic writes and a per-project write lock

**Status:** not started · **Wave:** A · **Effort:** 1.5 d
**Findings:** F-002 (race half), F-026 · **Depends on:** — · **Blocks:** STEP-02, STEP-04

## Problem

Every mutation loads the whole model, changes it in memory and writes the entire file back with
`model.write(str(file_path))` — in place, with no lock. Two concurrent edits each write their own
snapshot, so the later write silently discards the earlier one. A crash mid-write leaves a
truncated model that will not open.

There are ~35 `ifcopenshell.open` / `model.write` pairs, and none of them is atomic or serialised.

## Evidence

`backend/app/services/ifc_service.py:282` — `model.write(str(file_path))`
`backend/app/services/cad_service.py:1033`, `:806`, and every other mutating method — the same.
`backend/app/services/project_service.py:81-85` — `with open(ifc_path, "wb") as f: f.write(content)`

There is no `asyncio.Lock`, no version check, no temp-file-and-rename anywhere.

**Lost update already reproduced** (backend lane): `CADService.update_geometry` on an `IfcColumn`
calls `IFCService.update_element_property` (which opens, writes and closes the file) at
`cad_service.py:796`, then rewrites the file from the **stale in-memory model** loaded at `:775`.
The property is absent from the file afterwards, while the API returns `{"success": true}`.

Latent traversal (`F-026`): `project_service.py:156-158` is `settings.PROJECTS_DIR / project_id / "model.ifc"`
with no `resolve()` containment check and no UUID validation.

## Scope

**Change:**
- New module `backend/app/services/atomic_store.py` (recommended) with
  `atomic_write_model(model, path)`, `project_write_lock(project_id)` and `_lock_registry`.
- Every `model.write(...)` call in `ifc_service.py`, `cad_service.py`, `ai_service.py`,
  `clash_service.py` (if any), `bcf_service.py` → route through `atomic_write_model`.
- Every mutating REST/WS entry point wraps its body in `async with project_write_lock(project_id):`.
- `project_service.py:156-158` — add UUID validation and a `resolve()` containment assertion.

**Do not change:**
- The IFC content. This is a plumbing change only; the file bytes must be identical.
- `project_service.import_project_from_bytes`'s write path, except to make it atomic too.

**Non-goals:**
- A model cache. STEP-04 builds that on top of the single-writer guarantee established here.
- Database transactions. The DB and the file are not transactional together; that is a known
  limitation and is recorded in STEP-19's notes.

## Spec

1. `atomic_write_model(model, path)` writes to `path.with_suffix('.ifc.tmp')` in the same
   directory, `flush()` + `os.fsync()`, then `os.replace(tmp, path)`. On exception the temp file
   is removed and the original is untouched.
2. `project_write_lock(project_id)` returns an `asyncio.Lock` from a module-level registry keyed by
   project id, created on first use. The registry is bounded (evict an unused lock — e.g. a
   `WeakValueDictionary`, or an explicit LRU of 128 entries).
3. Every mutating path acquires the lock **before** opening the model and releases it after the
   write completes.
4. Concurrent mutations to the same project serialise; concurrent mutations to *different* projects
   do not block each other.
5. `get_project_file_path(project_id)` rejects anything that is not a UUID (raise `ValueError`), and
   asserts the resolved path is inside `settings.PROJECTS_DIR`.
6. No `.tmp` files are left behind after a successful write or a handled failure.
7. A write interrupted by an exception leaves the previous `model.ifc` byte-identical.

## TDD

Canonical test:
[`tests/backend/test_step03_atomic_writes.py`](../tests/backend/test_step03_atomic_writes.py).

### 1. Add the failing test

```powershell
Copy-Item docs/audit-2026-10/tests/backend/test_step03_atomic_writes.py backend/tests/
```

| Test | Asserts |
|---|---|
| `test_concurrent_placement_updates_all_land` | 6 concurrent placements on 6 elements → all 6 present in the file afterwards |
| `test_model_write_is_atomic` | no `.tmp`/`.partial` siblings; file ends with the STEP terminator |
| `test_project_file_path_is_contained_within_the_projects_directory` | hostile `project_id` values cannot escape `storage/projects/` |

The core assertion:

```python
with concurrent.futures.ThreadPoolExecutor(max_workers=len(element_ids)) as pool:
    responses = [f.result() for f in [pool.submit(move, i, eid) for i, eid in enumerate(element_ids)]]

for resp in responses:
    assert resp.status_code == 200

model = ifcopenshell.open(str(file_path))
moved = [round(float(model.by_id(e).ObjectPlacement.RelativePlacement.Location.Coordinates[0]), 3)
         for e in element_ids]
assert sorted(moved) == sorted(float(i + 1) for i in range(len(element_ids))), "Concurrent writes were lost"
```

### 2. Watch it fail

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step03_atomic_writes.py -v
```

Expected: `test_concurrent_placement_updates_all_land` fails with a subset of translations
present; `test_project_file_path_is_contained_within_the_projects_directory` fails on `".."`.

> If the concurrency test happens to pass, it is timing luck. Run it 10 times
> (`--count 10` via `pytest-repeat`, or a shell loop) before concluding the lock exists — and
> verify the lock is actually acquired by adding a temporary log line.

### 3. Implement

```python
# backend/app/services/atomic_store.py
import asyncio, os, tempfile
from contextlib import asynccontextmanager
from pathlib import Path

_locks: dict[str, asyncio.Lock] = {}

def project_lock(project_id: str) -> asyncio.Lock:
    lock = _locks.get(project_id)
    if lock is None:
        lock = _locks[project_id] = asyncio.Lock()
    return lock

def atomic_write_model(model, path: Path) -> None:
    path = Path(path)
    fd, tmp_name = tempfile.mkstemp(dir=str(path.parent), prefix=path.name + ".", suffix=".tmp")
    os.close(fd)
    tmp = Path(tmp_name)
    try:
        model.write(str(tmp))
        with open(tmp, "rb") as fh:
            os.fsync(fh.fileno())
        os.replace(tmp, path)
    finally:
        if tmp.exists():
            tmp.unlink(missing_ok=True)
```

Then in every service method:

```python
async with project_lock(project_id):
    model = ifcopenshell.open(str(file_path))
    ...mutate...
    atomic_write_model(model, file_path)
```

For the synchronous `IFCService` methods, take the lock in the **calling** async function (the
endpoint or the CAD method), not inside the static helper — `asyncio.Lock` is not usable from a
plain function running in a thread pool. STEP-04 moves these calls into `to_thread`, so the lock
must be acquired **before** the offload.

`get_project_file_path`:

```python
import uuid
@classmethod
def get_project_file_path(cls, project_id: str) -> Path:
    uuid.UUID(str(project_id))                      # raises ValueError on anything else
    root = settings.PROJECTS_DIR.resolve()
    path = (root / str(project_id) / "model.ifc").resolve()
    if not path.is_relative_to(root):
        raise ValueError("project path escapes the storage root")
    return path
```

### 4. Watch it pass

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step03_atomic_writes.py -v
```

Expected: `3 passed`.

### 5. Regression guard

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/ -q
```

`test_cad_and_clash.py` and `test_phase3.py` both exercise the write path heavily.

## Acceptance criteria

- [ ] A grep for `\.write\(str(file_path)\)` in `backend/app/services/` returns zero hits.
- [ ] 6 concurrent placements all land.
- [ ] No `.tmp` file remains after a successful write or a handled failure.
- [ ] A forced exception between open and write leaves `model.ifc` byte-identical (verify with a hash).
- [ ] `get_project_file_path("..")` raises rather than returning a path outside `storage/`.
- [ ] Two different projects can be written concurrently without blocking each other.
- [ ] `pytest backend/tests` shows no new failures.

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| `os.replace` fails on Windows when the target is open by a reader | The lock serialises writers; readers (`ifcopenshell.open`) open and close quickly. Retry `os.replace` 3× with a 50 ms backoff | Revert to `model.write` |
| A deadlock if a method takes the lock twice (nested) | Use a lock that is acquired only at the outermost entry point; assert non-reentrancy in dev | — |
| Lock registry grows unbounded across projects | Use `weakref.WeakValueDictionary` or an LRU of 128 | — |
| `tempfile.mkstemp` leaves a 0-byte file if the process is killed | Acceptable: the live `model.ifc` is never touched until `os.replace` | — |

## Notes

- `asyncio.Lock` is **not** thread-safe and cannot be awaited inside `to_thread`. After STEP-04,
  the pattern is: `async with project_lock(pid):` in the coroutine, then
  `await asyncio.to_thread(sync_worker)` where `sync_worker` does open/mutate/write. The lock
  protects the whole offloaded section.
- If a second uvicorn worker is ever added, an in-process lock is not enough — you would need a
  file lock (`msvcrt.locking` / `portalocker`) or a single-writer service. Record this in the
  deployment notes; do not silently rely on the in-process lock at scale.
- The DB row and the file can still diverge on a crash between `os.replace` and the DB update.
  STEP-19 (`refresh_project_metrics`) reconciles the metadata; a full repair job is out of scope.

### Implementation notes — 2026-10-25 (landed)

**What changed**

- New `backend/app/services/atomic_store.py`:
  - `atomic_write_model(model, path)` — `tempfile.mkstemp(dir=path.parent, prefix="model.ifc.", suffix=".tmp")`,
    `model.write(tmp)`, `fsync`, `os.replace(tmp, path)` with 3 attempts × 50 ms backoff
    (Windows raises `PermissionError` while a handle is open); the temp file is always removed.
  - `atomic_write_bytes(content, path)` — the same replace for uploads / federated sub-models
    (`project_service.import_project_from_bytes`, `api/federation.upload_sub_model`).
  - `atomic_copy_file(src, dest)` — the same replace for undo/redo snapshot restores, which
    used `shutil.copyfile` in place (a crash there truncated the model just as badly).
  - `project_write_lock(project_id)` / `project_read_lock(project_id)` — one `asyncio.Lock`
    per project from an `OrderedDict` registry bounded at `LOCK_REGISTRY_MAX = 128`; eviction
    only ever removes a lock that is neither held nor awaited, and if every lock is live the
    registry is allowed to exceed the bound rather than break exclusion.
  - `lock_registry_size()`, `REPLACE_ATTEMPTS`, `REPLACE_BACKOFF_S` for diagnostics/tests.
- Every write in the services now goes through `atomic_write_model`:
  `ifc_service` (`create_blank_project`, `update_element_placement`, `update_element_property`),
  `cad_service` (all 15 mutating methods + the three legacy-undo write sites),
  `ai_service._generate_building_sync`. `bcf_service` and `clash_service` never wrote a model.
  `grep -n "model\.write" backend/app/services` → only `atomic_store.py` (the single writer)
  and one documentation comment.
- `ProjectService.get_project_file_path` — `uuid.UUID(...)` validation then
  `resolved.is_relative_to(settings.PROJECTS_DIR.resolve())`; both raise `ValueError` before any
  caller opens, writes or deletes. `delete_project` now derives its `rmtree` target from the
  same validated path instead of `settings.PROJECTS_DIR / project_id`.

**Lock ordering**

One tier only: the per-project `asyncio.Lock`. It is acquired in the coroutine, before any
model is opened, and held across the whole offloaded open/mutate/write. Rules that keep it
deadlock-free:

1. Never hold two projects' locks (no path touches two projects).
2. Never acquire it from a thread-pool worker — offload *after* acquiring (STEP-04 keeps this).
3. Same-task re-entry (`api/cad.redo` → `CADService.create_wall`) is detected with a
   `ContextVar[frozenset[str]]` and becomes a no-op instead of a deadlock; another task always
   queues. `_waiters`/`locked()` are never inspected to decide this.
4. `refresh_project_metrics` takes the lock itself, so the post-write metrics parse cannot race
   a writer replacing the file under it (and cannot fail `os.replace` with a held handle).

Ownership is the outermost coroutine that drives the commit: for the CAD primitives and
`delete_element` it is the service method; for the placement/property routes, `undo`/`redo` and
the WebSocket `TRANSFORM_COMMIT` it is the route/handler, because those services interleave DB
awaits between the snapshot and the replace.

**Test results**

| Run | Before | After |
|---|---|---|
| `test_concurrent_placement_updates_all_land`, 5 sequential runs | 2 passed / 3 failed (`could not replace the existing file`, lost update) | 5/5 passed |
| `test_model_write_is_atomic` | passed (no `.tmp` yet) | passed |
| `test_project_file_path_is_contained_...` | failed (`".."` → `storage/model.ifc`) | passed |
| Whole file | 1 failed, 2 passed | 7 passed (4 tests added, below) |

Four tests were added to `backend/tests/test_step03_atomic_writes.py` to cover the acceptance
criteria the canonical file did not: `test_failed_write_leaves_the_previous_model_byte_identical`
(hash before/after + no temp leftovers), `test_lock_registry_stays_bounded`,
`test_different_projects_do_not_block_each_other`, `test_same_project_writes_do_serialise`.

**Deviations**

- `test_project_file_path_is_contained...` as shipped required `get_project_file_path("..")` to
  *return* a contained path, which is impossible for `".."`; the accepted fix (spec 5 and the
  acceptance criteria) is to raise. The copied test now accepts either outcome and fails on the
  dangerous one.
- `backend/tests/test_step01_ai_transform_units.py` used a synthetic project id
  (`"autotest-step01-transform-units"`); `record_edit → refresh_project_metrics` resolves the id
  to a path, so it now registers a real `uuid4`. No assertion changed.
- `import_project_from_bytes` cannot use `atomic_write_model` (it holds bytes, not a model), so
  it uses `atomic_write_bytes` from the same module — same temp-file + `os.replace` mechanism.

**Residual risks**

- The lock is in-process. Two uvicorn workers would each believe they are the single writer;
  a file lock (`msvcrt.locking` / `portalocker`) or a single-writer process is required before
  scaling out. Not addressed here.
- The model file and the `cad_transactions`/`projects` rows are not transactional. A crash
  between `os.replace` and the row insert leaves the undo stack one entry short; STEP-19's
  metrics refresh reconciles derived columns only.
- A rejected upload (invalid IFC) still leaves an empty `storage/projects/{uuid}/` directory
  behind — pre-existing behaviour, out of scope here.
- `backend/app/samples/sample_generator.py` (dev tooling, regenerates the bundled fixtures)
  still calls `model.write`; it is not a service and is not reachable from a request.
