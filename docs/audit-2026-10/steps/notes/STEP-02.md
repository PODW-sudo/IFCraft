# STEP-02 — handoff notes (single commit path per transform)

## 2026-10-25 - Every gizmo drag wrote the model file twice; a rejected write left a phantom move
- **Type:** Bug (F-002 duplicate half, F-018)
- **Platform:** http://localhost:5173
- **Related tests:** `frontend/src/tests/step02.singleCommitPath.test.ts` (14 new),
  `docs/audit-2026-10/tests/backend/test_step02_single_commit_path.py` (canonical, backend lane)
- **Observed:** `handleTransformEnd` fired `collabClientRef.current?.commitTransform(...)` and then
  awaited a `POST /api/projects/{id}/elements/{id}/placement`, so every drag release rewrote
  `model.ifc` twice, concurrently, and the HTTP half — with no lock check and an `"api-user"` audit row —
  could land after (or instead of) the WebSocket half that does check the soft lock. On failure the
  client only called `console.error`, so the viewport kept showing a wall the file did not contain.
- **Expected:** one persistence call per drag; the WebSocket path when a collaboration client exists
  (it carries the lock check, the `edit_history` row and the broadcast), the REST route only for a
  single-user session; on any refusal the mesh returns to its pre-drag matrix and the user is told.
- **Evidence:** pre-fix `pnpm exec vitest run src/tests/step02.singleCommitPath.test.ts` →
  `11 failed | 3 passed (14)`, headline
  `handleTransformEnd performs 1 WebSocket commit(s) and 1 HTTP post(s). Both rewrite the whole model
  file, so a drag release writes it twice, concurrently, with no lock.: expected 2 to be 1`.
  After the fix: `14 passed (14)`; `pnpm exec tsc -b --noEmit` silent;
  `step28.ergonomics.test.tsx` + `step25.importGraph.test.ts` still `24 passed` (the hook feeds the save
  pill and the new service is reachable from the viewport, so both had to be re-checked).
- **Suggested fix:** Landed on the frontend —
  `frontend/src/hooks/useGizmoTransform.ts`, `frontend/src/services/meshMatrixBridge.ts` (new),
  `frontend/src/components/viewer/ThreeViewport.tsx` (three lines: import, handle registration,
  pre-drag capture). `App.tsx` was **not** touched.
- **Status:** Open — the backend 409 lock check is deferred to the STEP-03 lane, which owns
  `backend/app/api/projects.py`.

### What the failure path does now

1. `ThreeViewport` captures the element's `matrixWorld` when `dragging-changed` flips to `true`
   (`capturePreDragMatrix(expressID, matrix)`), i.e. before TransformControls mutates the object.
2. `handleTransformEnd` reads that matrix as `previousMatrix`, then awaits exactly one write wrapped in
   `withSaveStatus`.
3. On a throw (HTTP 4xx/5xx, network error, or a synchronously throwing `commitTransform`) it calls
   `restoreSceneMatrix(expressID, previousMatrix)` — the viewport writes the matrix back, decomposes it
   into position/quaternion/scale, refreshes the batched instance matrix when the mesh is batched, and
   flags a render — then raises
   `notifyUser({ text: 'Move not saved: <reason> The element was put back where it was.', tone: 'error' })`
   and leaves the save pill in `error`.
4. On success the captured matrix is dropped, so a later failure can never roll back to a stale pose.

### Deferred backend snippet — REST placement lock check (STEP-02 spec 4)

**Do not apply from this lane.** `backend/app/api/projects.py` is owned by STEP-03/STEP-04, which are
landing concurrently. Anchors drift; match on `@router.post("/{project_id}/elements/{express_id}/placement"`.

1. Import (top of `backend/app/api/projects.py`):

```python
from ..services.websocket_manager import ws_manager
```

2. Signature — add the optional caller identity. There is no auth in this app and `TransformPayload`
   carries only `matrix`, so an optional header keeps the harness (which sends nothing) working:

```python
@router.post("/{project_id}/elements/{express_id}/placement", status_code=status.HTTP_200_OK)
async def update_element_placement(
    project_id: str,
    express_id: int,
    payload: TransformPayload,
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> dict[str, Any]:
```

(`from fastapi import Header` — add it to the existing fastapi import line.)

3. Body — immediately after the `project` existence check and **before**
   `transaction_id, pre_snapshot = CADService.begin_snapshot(project_id)` (a 409 must not open a
   snapshot):

```python
    # STEP-02 spec 4: an unlocked REST write is equivalent to no lock at all. The WS commit path
    # already enforces this; a single-user REST caller must not be able to overwrite an element that
    # another session holds. `rooms.get` is deliberately non-creating: a REST caller must not
    # materialise a collaboration room.
    room = ws_manager.rooms.get(project_id)
    if x_user_id and room is not None:
        room.cleanup_stale_locks()
        lock = room.locks.get(express_id)
        if lock and lock.get("user_id") != x_user_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Element #{express_id} is locked by "
                    f"{lock.get('user_name', 'another user')}."
                ),
            )
```

Notes for whoever applies it:

- `Room.cleanup_stale_locks()` exists and is called by `acquire_lock` too, so an abandoned lock cannot
  block a write forever.
- The 409 detail is surfaced verbatim by the client: `persistPlacementViaRest` throws
  `err.detail`, which becomes the `Move not saved: …` toast and the save-pill tooltip. Keys off
  `detail`, so keep that field name.
- Regression check once applied: `python -m pytest backend/tests/test_phase5.py -q` plus
  `.\\backend\\venv\\Scripts\\python.exe -m pytest docs/audit-2026-10/tests/backend/test_step02_single_commit_path.py -v`
  (expect `4 passed`).

### Deviations from the step document

1. **Rollback needed a scene seam, so `ThreeViewport.tsx` gained three small edits.** The document's
   sketch (`meshMatrixCache.current`, `restoreMeshMatrix`) assumed a mesh registry the hook could reach;
   none existed. Rather than prop-drill through `App.tsx` (off-limits), the viewport registers a
   `{ read, write }` handle with `services/meshMatrixBridge.ts` and records the pre-drag matrix on
   drag start. `onTransformEnd` / `onTransformChange` and every prop are unchanged, so the App call site
   is untouched.
2. **The fallback is keyed on `collabClientRef.current === null`, not `.connected`.** A client whose
   socket is momentarily down buffers `commitTransform` in the STEP-13 outbox; writing over REST as
   well would produce exactly the duplicate write this step removes. Deviates from the prompt's word
   "connected", matches the step document's spec 3 wording. Covered by a test.
3. **The WS path cannot roll back an asynchronous server rejection yet.** `commitTransform` is
   fire-and-forget and `COMMIT_REJECTED` arrives later via `onCommitRejected` (STEP-13, declared a
   non-goal here). The bridge exports `readPreDragMatrix` + `restoreSceneMatrix` so that callback can do
   the same rollback in three lines. `withSaveStatus` therefore means "frame handed to the socket",
   which is the same honest limitation documented at the top of `services/saveStatus.ts`.
4. **`prev` matrix is not cleared on drag start of an unrelated element.** The cache is keyed by express
   id and cleared per commit; a drag that is cancelled without a commit leaves one stale entry per
   element, which is bounded and overwritten on the next drag of that element.
5. **Not verified in this lane:** the live acceptance items (one `model.ifc` mtime bump, one
   `edit_history` row, one `REMOTE_TRANSFORM_COMMITTED` broadcast per drag) and the visible toast/pill in
   a browser — all need the backend half plus `qa_runner.py run --tier key --browser`. `run_gates.py`
   and the repo-wide formatter were not run (no formatting changes made; no new `data-qa` selectors).
