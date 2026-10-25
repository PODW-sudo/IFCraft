## 2026-10-25 - STEP-04: IfcOpenShell off the event loop + bounded model cache

- **Type:** Bug
- **Platform:** http://localhost:8000 (backend; verified through `starlette.testclient`)
- **Related tests:** TC — `backend/tests/test_step04_event_loop_offload.py` (STEP-04)
- **Severity:** P1
- **Observed:** `ifcopenshell.open` / `create_shape` / `model.write` / `validate_ifc` ran inside
  `async def` endpoints. With a 31.6 MB model (`modelsfortests/Ifc2x3_Duplex_Plumbing.ifc`), a
  spatial-tree request held the event loop for 1.4 s and `GET /health`, sampled concurrently, took
  up to **1,435 ms** (`[1435, 9, 16, 16, 4, 6, 8, 15, 8, 9]`). Every element click re-parsed the
  whole file. For a team, one person opening a model made the app look hung for everyone.
- **Expected:** `/health` under 200 ms while any read endpoint services a large model; a read
  served from a warm cache under 300 ms; the thread pool bounded so concurrent parses cannot
  exhaust memory; a write invalidates the cached model.
- **Evidence:** same measurements re-run after the fix: `GET /health` worst **15 ms**
  (`[7, 5, 6, 5, 5, 5, 15, 8, 14, 12]`) while the same cold spatial-tree request (1,587 ms, now in
  a worker) was in flight; warm-cache spatial-tree **13 ms**. Full table in
  `docs/audit-2026-10/steps/STEP-04-event-loop-offload.md` §Implementation notes.
- **Suggested fix (landed):** `backend/app/core/workers.py` — `ThreadPoolExecutor(max_workers=2)`
  plus `run_ifc(...)`; every blocking call site in `api/projects`, `api/federation`,
  `api/websocket`, `project_service`, `cad_service`, `ai_service`, `clash_service`, `bcf_service`
  offloads to it (`asyncio.to_thread` removed). `backend/app/services/model_cache.py` — bounded LRU
  (4 models / 768 MB) keyed by `(project_id, mtime_ns, size)`, invalidated by
  `atomic_store.atomic_write_model` before *and* after the replace; readers serialise on the same
  per-project lock as writers because `ifcopenshell.file` is not thread-safe.
- **Follow-up:** the two-worker bound is a throughput ceiling — a clash check plus a tree request
  occupy both slots and a third read queues. Revisit only with a RAM budget, not by raising the
  number blindly.
- **Status:** Open (follow-up only; the defect itself is fixed)
