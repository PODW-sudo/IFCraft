# STEP-02 — One commit path per transform

**Status:** not started · **Wave:** A · **Effort:** 1 d
**Findings:** F-002, F-018 · **Depends on:** STEP-03, STEP-04 · **Blocks:** STEP-13

## Problem

Every gizmo drag release writes the entire IFC file **twice, concurrently**. The WebSocket commit
is fire-and-forget and lands milliseconds before an HTTP `POST` to the same element, and both
paths end in `IFCService.update_element_placement`, which opens and rewrites the whole model.

The model file is the contractual deliverable in BIM. A torn write is not a bug you can
apologise for.

## Evidence

`frontend/src/hooks/useGizmoTransform.ts:30-55`:

```ts
const handleTransformEnd = useCallback(async (expressID: number, matrix: number[]) => {
  if (!currentProject) return;

  collabClientRef.current?.commitTransform(expressID, matrix);          // :35  -> WS
  try {
    const res = await fetch(
      `/api/projects/${currentProject.id}/elements/${expressID}/placement`,  // :38  -> HTTP
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matrix }) }
    );
    if (!res.ok) { const err = await res.json().catch(...); console.error('Failed to persist transform to backend:', err.detail); }
  } catch (err) { console.error('Network error persisting transform:', err); }
}, [currentProject, collabClientRef]);
```

Both destinations write the file:

- `backend/app/api/websocket.py:122` — `await asyncio.to_thread(IFCService.update_element_placement, file_path, express_id, matrix)`
- `backend/app/api/projects.py:276` — `IFCService.update_element_placement(file_path, express_id, ...)`

**The two paths are not equivalent.** The WS path checks the soft lock (`websocket.py:109-117`),
writes the audit row (`:123-131`) and broadcasts `REMOTE_TRANSFORM_COMMITTED`. The REST path
does none of that and records the edit as `"api-user"`.

## Scope

**Change:**
- `frontend/src/hooks/useGizmoTransform.ts:30-55` — keep exactly one path; add a rollback on failure.

**Do not change:**
- `backend/app/api/projects.py:260-290` — the route stays (other callers may use it), but it must
  gain a lock check. That check is part of this step too: an unlocked REST write is equivalent to
  no lock at all.
- `backend/app/api/websocket.py:103-140` — the WS path is the one that survives.

**Non-goals:**
- Reconnect logic and `COMMIT_REJECTED` handling — STEP-13.
- Undo for transforms — STEP-10.

## Spec

1. `handleTransformEnd` performs **exactly one** persistence call.
2. That call is `collabClientRef.current.commitTransform(...)`, because it carries the soft-lock
   check, the audit row and the broadcast.
3. When collaboration is not connected (`collabClientRef.current === null`), fall back to the REST
   route — a single-user session must still persist.
4. When the REST route is used, it must reject a write on an element locked by another user with
   **409 Conflict**.
5. On any persistence failure the mesh is restored to its pre-drag matrix and the user sees an
   error. The current `console.error`-only path is not acceptable: the screen would show a moved
   wall that the file does not contain.
6. The `IFCService.update_element_placement` call sites drop from two client-side to one.

## TDD

Canonical test:
[`tests/backend/test_step02_single_commit_path.py`](../tests/backend/test_step02_single_commit_path.py).

### 1. Add the failing test

```powershell
Copy-Item docs/audit-2026-10/tests/backend/test_step02_single_commit_path.py backend/tests/
```

| Test | Asserts |
|---|---|
| `test_transform_end_has_exactly_one_commit_path` | `ws_commits + http_posts == 1` inside `handleTransformEnd` |
| `test_the_surviving_path_is_the_one_that_enforces_the_lock` | fails loudly if the WS path is the one removed |
| `test_backend_has_exactly_one_place_that_writes_the_placement_matrix` | both server entry points still call the same service (regression guard) |
| `test_a_failed_persistence_reverts_the_local_transform` | a failure branch restores the previous matrix |

### 2. Watch it fail

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step02_single_commit_path.py -v
```

Verified (2026-10-24): `3 failed, 1 passed`, with

```
handleTransformEnd performs 1 WebSocket commit(s) and 1 HTTP post(s). Both rewrite the whole
model file, so every drag release writes the file twice, concurrently, with no lock.
```

### 3. Implement

```ts
const handleTransformEnd = useCallback(async (expressID: number, matrix: number[]) => {
  if (!currentProject) return;

  const previous = meshMatrixCache.current.get(expressID);   // captured on transform start
  const collab = collabClientRef.current;

  try {
    if (collab) {
      collab.commitTransform(expressID, matrix);             // sole path when collaborating
    } else {
      const res = await fetch(`/api/projects/${currentProject.id}/elements/${expressID}/placement`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matrix }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail ?? res.statusText);
    }
  } catch (err) {
    if (previous) restoreMeshMatrix(expressID, previous);
    onPersistError?.(expressID, String(err));
  }
}, [currentProject, collabClientRef]);
```

Then add the lock check on the REST route (`projects.py:260-290`):

```python
lock = ws_manager.get_room(project_id).locks.get(express_id) if ... else None
if lock and lock["user_id"] != requester_user_id:
    raise HTTPException(status_code=409, detail="Element is locked by another user.")
```

### 4. Watch it pass

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step02_single_commit_path.py -v
```

Expected: `4 passed`.

### 5. Regression guard

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_phase5.py -q
cd frontend; pnpm exec tsc -b --noEmit
```

`test_phase5.py` covers the WebSocket room/lock basics.

## Acceptance criteria

- [ ] One drag produces exactly one file write (verify by watching `model.ifc` mtime twice per drag before and once after).
- [ ] One drag produces exactly one `edit_history` row.
- [ ] One drag produces exactly one `REMOTE_TRANSFORM_COMMITTED` broadcast.
- [ ] With collaboration disconnected, the transform still persists via REST.
- [ ] A REST placement on an element locked by another user returns 409.
- [ ] A failed commit restores the mesh and surfaces a visible error.

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| Removing the HTTP path breaks single-user mode (no WS connection) | Spec item 3: fall back to REST when `collabClientRef.current` is null | Revert one file |
| Adding a lock check to REST breaks the harness, which drives REST directly | The harness runs single-user; no lock exists, so the check passes | Make the check conditional on the caller supplying a `user_id` |
| The 409 arrives after the mesh has already moved | The rollback in spec item 5 handles it | — |

## Notes

- Measure the write count with `(Get-Item storage/projects/<id>/model.ifc).LastWriteTime` before and
  after a drag, or on Linux `inotifywait -m storage/projects/<id>/model.ifc`.
- `commitTransform` sends the **column-major world matrix in metres**. `IFCService.update_element_placement`
  expects whatever units its `is_si` flag implies. Confirm this contract after STEP-01 changes it —
  these two steps touch the same invariant from opposite ends.

### 2026-10-25 — frontend lane landed; backend lock check deferred

Frontend half (spec 1, 2, 3, 5, 6) is implemented and green:

- `frontend/src/hooks/useGizmoTransform.ts` — `handleTransformEnd` now issues **exactly one** write:
  `collabClientRef.current.commitTransform(...)` when a client exists, otherwise the REST fallback. The
  REST branch was moved into a module-level `persistPlacementViaRest()` so the callback body has no
  second request in it (the canonical test counts `commitTransform(` + `fetch(` occurrences and must see
  1). `console.error` is gone: a failure restores the mesh and raises `notifyUser({ tone: 'error' })`,
  and `withSaveStatus` still drives the header pill to `error` / `saved`.
- `frontend/src/services/meshMatrixBridge.ts` (new) — the seam the hook needs to put an element back.
  The viewport registers `{ read, write }` for a world matrix by express id; the hook reads the
  pre-drag matrix the viewport captured on `dragging-changed`.
- `frontend/src/components/viewer/ThreeViewport.tsx` — three small additions only: the import, the
  handle registration (unregistered in the scene-init cleanup), and `capturePreDragMatrix()` on drag
  start. `onTransformEnd` / `onTransformChange` are untouched, so `App.tsx` needs no change at all.
- `frontend/src/tests/step02.singleCommitPath.test.ts` (new) — 14 tests: the ported source contract
  ("1 WS commit + 1 HTTP post" fails before the fix), plus behavioural coverage for WS-only,
  REST-only, 409 rollback, network-error rollback, throwing-commit rollback, and save-status/pill.

**Deferred to the backend lane (owned by STEP-03, whose file is `backend/app/api/projects.py`):**

- Spec 4 — the REST placement route still has **no lock check**, so with collaboration disconnected a
  REST write can overwrite an element another user holds. The route now records an `edit_history` row
  (STEP-10 lane) but still attributes it to `"api-user"`. `handleTransformEnd` already throws the
  resulting `409` into the rollback branch, so the frontend needs no further change when the check
  lands. Verbatim patch: see `docs/audit-2026-10/steps/notes/STEP-02.md`.
- Acceptance item "One drag produces exactly one file write / one `edit_history` row / one
  `REMOTE_TRANSFORM_COMMITTED`" still needs a live run after the backend half lands
  (`qa_runner.py run --tier key --browser`).

**Known limitation, deliberately out of scope:** the WS commit is fire-and-forget, so a *server*
rejection (`COMMIT_REJECTED` -> `onCommitRejected`, STEP-13) arrives after `handleTransformEnd`
resolved. `withSaveStatus` therefore reports `saved` on "frame sent", not "write committed". Wiring
STEP-13's callback to `readPreDragMatrix` + `restoreSceneMatrix` is a three-line change; undo for
transforms stays STEP-10.
