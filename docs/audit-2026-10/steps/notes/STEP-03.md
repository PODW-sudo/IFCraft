## 2026-10-25 - STEP-03: atomic writes + per-project write lock

- **Type:** Bug
- **Platform:** http://localhost:8000 (backend; verified through `starlette.testclient`)
- **Related tests:** TC — `backend/tests/test_step03_atomic_writes.py` (STEP-03)
- **Severity:** P0
- **Observed:** Every mutation loaded the whole model, edited it in memory and wrote it back with
  `model.write(str(file_path))` in place, with no lock. Six concurrent placements on six elements
  lost writes on 3 of 5 runs (the API still answered 200 with "could not replace the existing
  file" or a silently discarded edit), and `get_project_file_path("..")` resolved to
  `storage/model.ifc` — a latent write primitive reachable from the URL.
- **Expected:** Each write is atomic (temp file + `fsync` + `os.replace`), mutations to one project
  serialise, mutations to different projects do not block each other, and a non-UUID project id is
  rejected before any filesystem access.
- **Evidence:** `docs/audit-2026-10/steps/STEP-03-atomic-writes-and-locking.md` §Implementation
  notes; pre-fix run recorded `2 passed / 3 failed` over 5 repetitions of
  `test_concurrent_placement_updates_all_land`; post-fix `5/5` and the file is `7 passed`.
- **Suggested fix (landed):** `backend/app/services/atomic_store.py` —
  `atomic_write_model` / `atomic_write_bytes` / `atomic_copy_file` (temp + fsync + replace with a
  3× retry for Windows handle conflicts) and `project_write_lock(project_id)` (per-project
  `asyncio.Lock`, registry bounded at 128, same-task re-entry via a `ContextVar`). Every service
  write and every undo/redo snapshot restore goes through it; `get_project_file_path` validates a
  UUID and asserts containment inside `PROJECTS_DIR`.
- **Follow-up:** an in-process lock is not enough if a second uvicorn worker is ever added — that
  needs a file lock (`msvcrt.locking` / `portalocker`) or a single-writer process. Record it in the
  deployment notes before scaling out.
- **Status:** Open (follow-up only; the defect itself is fixed)
