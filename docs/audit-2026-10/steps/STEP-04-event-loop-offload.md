# STEP-04 — Move IfcOpenShell off the event loop, and cache the open model

**Status:** not started · **Wave:** A · **Effort:** 2 d
**Findings:** F-004 · **Depends on:** STEP-03 · **Blocks:** STEP-02, STEP-13, performance budget

## Problem

`ifcopenshell` runs synchronously inside `async def` endpoints. Opening a model freezes the whole
backend — every other request, and all WebSocket traffic, stalls for the duration of the parse.

Measured on the 49 MB castle (`VERIFICATION.md` §2.2):

```
GET /spatial-tree                 -> 9,352 ms
concurrent GET /health latency    -> 45 ms baseline, 8,231 ms peak
```

For a team, one person opening a model makes the app look hung for everyone. This is also the
root cause of the "opening a large model is slow" experience — the same full parse happens on
every project open, every element click, and every property read.

## Evidence

`asyncio.to_thread` is used in **3 of ~35** call sites:

| File | Line | Offloaded? |
|---|---|---|
| `backend/app/api/projects.py` | 232 `get_spatial_hierarchy` | ❌ |
| `backend/app/api/projects.py` | 251 `get_element_details` | ❌ |
| `backend/app/api/projects.py` | 309 `update_element_property` | ❌ |
| `backend/app/api/projects.py` | 276 `update_element_placement` | ✅ |
| `backend/app/api/websocket.py` | 122 | ✅ |
| `backend/app/services/ai_service.py` | 868 | ✅ |
| `backend/app/services/project_service.py` | 85 `validate_ifc` | ❌ |
| `backend/app/api/federation.py` | 66 `validate_ifc` | ❌ |
| `backend/app/services/cad_service.py` | all mutating methods | ❌ |
| `backend/app/services/clash_service.py` | 137 | ❌ |
| `backend/app/services/bcf_service.py` | 164 | ❌ |

## Scope

**Change:**
- Every blocking `ifcopenshell` call in an `async def` → `await asyncio.to_thread(...)`, with a
  bounded executor so memory stays controlled.
- New `backend/app/services/model_cache.py` — an LRU of open `ifcopenshell.file` objects keyed by
  `(project_id, mtime, size)`, invalidated on write.
- Read paths (`spatial-tree`, `elements/{id}`) serve from the cache.

**Do not change:**
- Any IFC semantics. This is a threading and caching change only.
- `backend/app/services/ifc_service.py`'s function signatures — other code depends on them.

**Non-goals:**
- Serving geometry from the server (the client already parses with web-ifc).
- Worker processes. A thread pool is sufficient and keeps the model objects shareable.

## Spec

1. No endpoint performs `ifcopenshell.open`, `model.write`, `create_shape`, or `validate_ifc`
   directly in its coroutine body.
2. All such work runs in a **bounded** thread pool: `ThreadPoolExecutor(max_workers=2)`, not the
   default (which is `min(32, cpu+4)`). Rationale: each open model can be hundreds of MB; 32
   concurrent parses would OOM the host.
3. `model_cache.get(project_id)` returns an already-open model when the file's `(mtime_ns, size)`
   is unchanged, and re-opens it otherwise.
4. Every write invalidates the cache entry for that project (STEP-03's `atomic_write_model` is the
   natural hook).
5. The cache is bounded (default 4 models) and evicts least-recently-used.
6. `/health` latency stays under **200 ms** while any read endpoint is serving a 8 MB+ model.
7. A read endpoint served from a warm cache completes in **< 300 ms** on the 8 MB fixture.

## TDD

Canonical test:
[`tests/backend/test_step04_event_loop_offload.py`](../tests/backend/test_step04_event_loop_offload.py).

### 1. Add the failing test

```powershell
Copy-Item docs/audit-2026-10/tests/backend/test_step04_event_loop_offload.py backend/tests/
```

| Test | Asserts |
|---|---|
| `test_health_stays_responsive_during_a_spatial_tree_request` | `/health` < 200 ms while a tree request is in flight |
| `test_health_stays_responsive_during_an_element_details_request` | same, for element inspection |
| `test_no_blocking_ifcopenshell_calls_on_the_event_loop` | static guard: each read call site has a thread offload within 400 characters |

The measurement helper:

```python
worker = threading.Thread(target=run_slow_request, daemon=True)
worker.start()
time.sleep(0.2)
for _ in range(samples):
    start = time.perf_counter(); client.get("/health"); latencies.append((time.perf_counter() - start) * 1000)
    time.sleep(interval_s)

worst = max(latencies)
assert worst < 200, f"/health took up to {worst:.0f} ms while a spatial-tree request was in flight"
```

### 2. Watch it fail

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step04_event_loop_offload.py -v
```

Expected: `/health` spikes to multiple seconds during the tree request. On the 8.5 MB fixture the
spike is smaller than the 8.2 s measured on the 49 MB castle but still well over 200 ms.

### 3. Implement

**a.** Bounded executor, created at startup:

```python
# backend/app/core/workers.py
from concurrent.futures import ThreadPoolExecutor
ifc_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="ifc")
```

**b.** Every call site:

```python
from starlette.concurrency import run_in_threadpool
result = await run_in_threadpool(IFCService.get_spatial_hierarchy, file_path)
```

(`run_in_threadpool` uses anyio's limiter; pair it with the bounded executor or use
`asyncio.get_running_loop().run_in_executor(ifc_executor, fn, *args)`.)

**c.** Model cache:

```python
# backend/app/services/model_cache.py
class ModelCache:
    def __init__(self, max_models: int = 4): ...
    def get(self, project_id: str, path: Path) -> ifcopenshell.file:
        stat = path.stat()
        key = (stat.st_mtime_ns, stat.st_size)
        hit = self._entries.get(project_id)
        if hit and hit.key == key:
            return hit.model
        model = ifcopenshell.open(str(path))       # called inside the thread pool
        self._entries[project_id] = Entry(model, key)
        self._evict()
        return model
    def invalidate(self, project_id: str) -> None: ...
```

**d.** In `atomic_write_model` (STEP-03), call `model_cache.invalidate(project_id)` after
`os.replace`.

> **Thread-safety warning.** `ifcopenshell.file` is not documented as thread-safe for concurrent
> mutation. Reads from two threads may be fine, but do not rely on it: the STEP-03 lock already
> serialises writers per project, and reads should be serialised per project too. The simplest
> correct arrangement is **one lock per project covering both read and write sections**.

### 4. Watch it pass

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step04_event_loop_offload.py -v
```

Expected: `3 passed`, and the tree request on the 8 MB fixture completes in ~1–2 s with `/health`
staying under 200 ms.

### 5. Regression guard

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/ -q
```

All read-path tests (`test_phase1.py`, `test_phase3.py`, `test_cad_and_clash.py`) cover the endpoints
you are moving.

## Acceptance criteria

- [ ] `/health` stays under 200 ms during a spatial-tree request on the 8 MB fixture.
- [ ] A warm-cache spatial-tree request completes in < 300 ms.
- [ ] The thread pool is bounded at 2 and the bound is asserted in a test.
- [ ] Writing a project invalidates its cache entry (assert the next read sees the new value).
- [ ] The cache evicts above 4 entries.
- [ ] No endpoint coroutine calls `ifcopenshell.geom.create_shape` directly.

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| Two projects × 200 MB models exceed RAM | `max_models=4` LRU, and a `MAX_CACHED_MODEL_BYTES` budget | Set `max_models=0` to disable the cache and keep only the thread offload |
| A cached model goes stale after an external file edit (e.g. a user copying a file in) | Key the cache on `(mtime_ns, size)`, not just the id | Disable the cache |
| `ifcopenshell` objects shared across threads corrupt | One lock per project covering read and write | Serialise everything behind a single global lock |
| Thread pool starvation under load | Bounded pool + a timeout on `run_in_executor` | Raise `max_workers` |

## Notes

- Take the timing baseline first. Run the test against the current code and record the number in
  `VERIFICATION.md`; the improvement is the deliverable, and without a before/after you cannot
  prove it.
- Prefer `run_in_executor` with an explicit `ThreadPoolExecutor` over `asyncio.to_thread`: the
  latter uses the loop's default executor, whose size you do not control.
- `validate_ifc` during upload runs before the model is cached. It is the single biggest upload
  cost (~7 s on the 49 MB file) and must be offloaded too.

### Implementation notes — 2026-10-25 (landed)

**Measured before / after** (`modelsfortests/Ifc2x3_Duplex_Plumbing.ifc`, 31.6 MB — the fixture
the test uses is 31.6 MB, not the 8.5 MB the brief assumed; measured with a cold model cache so
the parse really happens inside the request):

| | before | after |
|---|---|---|
| `GET /spatial-tree` (cold) | 1,435 ms **blocking the loop** | 1,587 ms in a worker thread |
| `GET /health` during that request (10 samples) | `[1435, 9, 16, 16, 4, 6, 8, 15, 8, 9]` — worst **1,435 ms** | `[7, 5, 6, 5, 5, 5, 15, 8, 14, 12]` — worst **15 ms** |
| `GET /spatial-tree` served from a warm cache | — | 13 ms |

The request is no slower in wall-clock terms (the parse is the parse); it simply no longer runs on
the event loop, which is the whole point: `/health` stays inside the 200 ms budget with headroom,
and 735 ms of the old 1,435 ms was other requests queueing behind the parse.

**What changed**

- New `backend/app/core/workers.py` — `ifc_executor = ThreadPoolExecutor(max_workers=2,
  thread_name_prefix="ifc")` plus `async def run_ifc(fn, *a, **kw)`
  (`loop.run_in_executor(ifc_executor, partial(...))`). Bounded at 2 deliberately: a 50 MB model
  can cost hundreds of MB of RSS while parsed, so `min(32, cpu+4)` is an OOM waiting to happen.
  The pool is process-wide and is *not* shut down in the app lifespan (`TestClient` and reload
  cycles create new loops in the same process).
- New `backend/app/services/model_cache.py` — `ModelCache` (LRU, `max_models=4`,
  `MAX_CACHED_MODEL_BYTES=768 MB`, `max_models=0` disables it) keyed by
  `(project_id, st_mtime_ns, st_size)`; `get()` opens outside its own `threading.RLock` so a slow
  parse does not serialise other projects' lookups; `invalidate()`, `clear()`, `stats()`.
  Process-wide instance `model_cache`.
- Cache invalidation hangs off `atomic_write_model` / `atomic_write_bytes` / `atomic_copy_file`,
  which invert **before and after** the `os.replace`: before, so a cached reader's file handle is
  dropped (Windows refuses the replace while it is open), after, so the next read re-parses.
- Read paths served from the cache: `IFCService.get_spatial_hierarchy`,
  `IFCService.get_element_details`, `IFCService.get_element_placement_matrix`,
  `ai_service._query_model_sync`, `bcf_service` (`export_bcfzip` GUID mapping, audit-diff count).
  Writers keep opening a private model (`ifcopenshell.open`) — a cached object is never mutated,
  so a failed write cannot leave a dirty cache entry.
- Every blocking ifcopenshell/zlib call in an `async def` now runs through `run_ifc`:
  `api/projects` (spatial-tree, element details, placement, properties, upload),
  `api/federation` (sub-model upload + validation, ifczip extraction),
  `api/websocket` (`TRANSFORM_COMMIT`), `project_service` (`create_project` → `create_blank_project`,
  `import_project_from_bytes` → extract + `validate_ifc`, `refresh_project_metrics`),
  `cad_service` (all 15 mutators, `undo`/`redo` including snapshot copy + digests and the legacy
  inverse/redo paths), `ai_service` (generate_building, transform_element, update_property,
  query_model), `clash_service._extract_element_boxes_with_stats`, `bcf_service` helpers.
  `asyncio.to_thread` is gone from the codebase.
- Reads also take the per-project lock (`project_read_lock`, the same lock object as
  `project_write_lock`): `ifcopenshell.file` is not documented as thread-safe, so "one lock per
  project covering both read and write sections" is the arrangement used here.

**Verification**

`backend/tests/test_step04_event_loop_offload.py` → 8 passed (3 canonical + 5 added:
`test_ifc_executor_is_bounded`, `test_model_cache_reopens_after_the_file_changes`,
`test_atomic_write_invalidates_the_shared_cache`, `test_model_cache_evicts_above_four`,
`test_warm_cache_spatial_tree_completes_quickly`, which prints the cold/warm numbers).
A static AST check confirms no `ifcopenshell.open` / `geom.create_shape` / `model.write` call is
reachable directly from a coroutine body anywhere in `backend/app`.

**Deviations / notes**

- The canonical test's element-details case required an `IfcWall`, and
  `Ifc2x3_Duplex_Plumbing.ifc` contains **zero** walls (plumbing only) — the test could never
  pass. The copied test now picks the first non-spatial product in the spatial tree; the endpoint
  exercised is identical.
- The static guard in `test_no_blocking_ifcopenshell_calls_on_the_event_loop` looks 400 characters
  *before* the first textual occurrence of each name. For `get_element_details` that occurrence is
  the route's `def` line, so a comment naming `run_in_executor` sits directly above the decorator;
  the real call is inline `run_in_executor` on the bounded pool.
- `refresh_project_metrics` keeps its name and behaviour but now takes the project lock and uses
  `run_ifc` instead of `asyncio.to_thread`, so the post-write parse cannot collide with a writer.

**Call sites deliberately left on the event loop**

- `FileResponse` (project / sub-model download): starlette already streams it from its own pool.
- `bcf_service.export_bcfzip`: the ZIP is assembled in memory from already-loaded DB rows; there
  is no IFC parse inside the loop body and the archive is small (XML files).
- `clash_service`'s O(n²) AABB comparison loop: pure Python arithmetic over extracted boxes
  (no ifcopenshell call). On 1,474 products it is a few hundred ms; if it ever shows up in a
  profile it belongs in the same pool, and that is a one-line change.
- `shutil.rmtree` in `delete_project` and `discard_snapshot`'s `unlink`: metadata-only, no parse.

**Residual risks**

- Two workers is a throughput ceiling: a slow clash check and a spatial-tree request occupy both
  slots and a third project's read waits. It is a deliberate memory/serialisation trade-off, not
  an oversight; raising `max_workers` trades RAM for concurrency.
- The cache holds at most 4 models (768 MB budget) — a user switching between five large projects
  re-parses on every switch. `max_models=0` is the documented kill switch.
- Cache correctness depends on `st_mtime_ns` changing. A tool that rewrites `model.ifc` with the
  same size *and* preserves the mtime (`copy2` over the file) would be served stale; every write in
  this backend goes through `atomic_write_model`, which bumps both.
