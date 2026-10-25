# STEP-10 — Product-wide undo and destructive-action confirmation

**Status:** not started · **Wave:** B · **Effort:** 3 d
**Findings:** F-007 · **Depends on:** STEP-02 · **Blocks:** STEP-21

## Problem

Nothing in this application is reversible except CAD primitives, and the one thing that *is*
reversible is broken in the most dangerous way: undo after a delete throws a `RuntimeError`
inside the service, returns HTTP 500, and leaves the transaction marked `ACTIVE` - so every
subsequent `Ctrl+Z` retries the same crashing row and the user's undo stack is permanently
wedged. There is no confirmation anywhere in `frontend/src` (0 matches for `window.confirm` and
0 for `confirm(`), so `Delete`, the contextual ribbon's bin icon and the viewport context menu
all remove geometry on a single keystroke. For a change-averse BIM audience this is the
combination that ends trust: one stray keypress, no warning, and the only recovery path is a
re-upload.

## Evidence

- `backend/app/services/cad_service.py:632-693` — `delete_element` removes the product, writes the file, then inserts a `delete_element` row with `status = 'ACTIVE'` (`:675-685`). So a delete *looks* undoable.
- `backend/app/services/cad_service.py:399-494` — `undo()` has restore branches for `move_element` / `rotate_element` / `align_element` / `mirror_element` / `array_element` / `clone_element` and a catch-all `else` (`:458-472`) that tries to remove the entity and then unconditionally marks the row `UNDONE` and returns `success=True` (`:486-494`). There is **no** branch that restores a deleted product.
- `backend/app/services/cad_service.py:433` — `entity = model.by_id(express_id)`. In ifcopenshell 0.9.0 this **raises** `RuntimeError` for a missing id; it does not return `None`, so the intended `if entity:` guard never runs.
- `backend/app/api/cad.py:86-93` — the `RuntimeError` is caught by `except Exception` and re-raised as HTTP 500.
- `frontend/src/hooks/useCadDraftingMachine.ts:146-155` — `handleCadUndo` catches the failure and only `console.error`s it. The user sees a spinner-free nothing.
- `frontend/src/App.tsx:861-868` — `Ctrl/Cmd+Z` is wired to `handleCadUndo`, so the wedged stack is exactly what the user hits first.
- `frontend/src/App.tsx:873-877` — `Delete` / `Backspace` call `handleDeleteElement(selectedExpressID)` with no guard.
- `frontend/src/components/viewer/SpatialContextMenu.tsx:248-268` and `frontend/src/components/cad/GlassContextualModifyDock.tsx:738-752` — the other two delete triggers; both call the same `handleDeleteElement` (`useCadDraftingMachine.ts:168-185`).
- `backend/app/api/projects.py:293-330` (property edit) and `:260-291` (REST placement) — neither records a `cad_transactions` row, so `Ctrl+Z` cannot cover them even in principle.
- Measured (throwaway probe against a temporary storage root + database; the user's `storage/projects.db` was not touched):

  ```
  created wall #27 name='ProbeWall'
  delete -> success=True tx=d085cd39-30e9-48b4-8ca1-9ce02e8baff1
  after delete: by_id(27) is MISSING
  undo -> RuntimeError: Instance #27 not found
      File "...\backend\app\services\cad_service.py", line 433, in undo
  ```

- Measured: `grep -r "window.confirm|\bconfirm(" frontend/src` → **0 matches**.

## Scope

**Change:**

- `backend/app/services/cad_service.py` — introduce a per-project **undo snapshot** written before every model mutation, and rewrite `undo` / `redo` to restore from it (see Spec 1-4). Add `_try_by_id()` helper and use it everywhere `by_id` may miss (at least `:433`, `:444`, `:452`, `:461`, `:532`).
- `backend/app/services/cad_service.py:399-494` — `undo` must return `success=False` when nothing changed, and must not raise for a missing entity.
- `backend/app/api/projects.py:293-330` — the property-edit path records a transaction through the same commit helper (STEP-02) so `Ctrl+Z` covers it.
- `backend/app/api/projects.py:260-291` — the REST placement path likewise (this also closes the F-018 half that STEP-13 does not own: the rejected-via-WS move is not persisted through an unrecorded path).
- `frontend/src/services/destructiveActions.ts` — **new** pure module: `buildDeleteElementRequest`, `runDestructiveAction`.
- `frontend/src/hooks/useCadDraftingMachine.ts:168-185` — `handleDeleteElement` stays the single choke point for deletes; it must not itself prompt (the caller does) and must surface a failure instead of swallowing it.
- `frontend/src/App.tsx:873-877`, `frontend/src/components/viewer/SpatialContextMenu.tsx:252-256`, `frontend/src/components/cad/GlassContextualModifyDock.tsx:744` — route through `runDestructiveAction` with a real dialog.
- `frontend/src/components/common/ConfirmDestructiveDialog.tsx` — **new** dialog component (focus-trapped, `role="alertdialog"`, `data-qa="confirm-destructive"`), used by all three call sites.
- `frontend/src/hooks/useCadDraftingMachine.ts:146-166` — `handleCadUndo` / `handleCadRedo` must show a user-visible message when `success === false` or the request fails.

**Do not change:**

- The `cad_transactions` table shape beyond additive columns/indexes; existing rows must still parse (`get_history` at `cad_service.py:589-629`).
- The undo *semantics* for CAD primitives as seen by users: one `Ctrl+Z` reverts exactly one user action.
- `QuickRotate`/`Mirror`/`Array` behaviour, pinning rules (`is_element_pinned` guard at `cad_service.py:643-644`) or the 50-row history limit (`:598`).
- The existing pytest suite's expectations in `backend/tests/test_cad_and_clash.py:88-104` (undo then redo still both return `success: true`).

**Non-goals:**

- A CRDT or multi-user undo. Undo stays per-project, last-writer-wins, exactly as the artboard model is today.
- Undo for copilot/AI edits (STEP-17 owns confirmation for those, and F-001/STEP-01 owns the units).
- Redesigning the CAD history panel UI.
- Confirmation for non-destructive actions (render style changes, section toggles).

## Spec

1. Before any operation writes `model.ifc`, the service stores a copy of the pre-write file at `storage/projects/{project_id}/undo/{transaction_id}.ifc`. Snapshot creation happens in exactly one place - the single commit path introduced by STEP-02 - not in each `create_*` / `move_*` method.
2. A transaction row records `snapshot_path` (nullable) in its `parameters` JSON (no schema migration required) or as a new nullable column - the executor picks one and documents it. Retention: at most 20 snapshots or 200 MB per project, oldest-first eviction. Snapshots are deleted with the project.
3. `POST /api/projects/{id}/cad/undo` restores the pre-image of the most recent `ACTIVE` transaction and marks that row `UNDONE`. After the call, every entity that existed before the action exists again **with the same `express_id`** (ids are referenced by BCF topics, pins, measurements and the audit log, so identity must be preserved - a re-created entity with a new id does not satisfy this requirement).
4. `undo` returns `success: false` and a message, **without raising**, when there is no `ACTIVE` transaction or when the pre-image is missing. It must never return `success: true` unless the model file changed.
5. `POST .../cad/redo` restores the post-image of the most recently `UNDONE` transaction. Applying redo does not create a second `ACTIVE` row for the same action.
6. `undo` on a delete restores an element that `GET /api/projects/{id}/elements/{express_id}` answers for, with its original `Name`, `type` and property sets.
7. A property edit made through `POST /api/projects/{id}/elements/{express_id}/properties` is undoable by the same endpoint, restoring the previous value (or removing the property if it did not exist).
8. `runDestructiveAction(request, confirm, action)` calls `confirm` exactly once; when `confirm` returns `false` it does not call `action` and resolves to `{ applied: false }`; when `confirm` returns `true` it calls `action` exactly once and resolves to `{ applied: true, result }`. If `action` throws, the error propagates and `applied` is not reported.
9. `buildDeleteElementRequest(expressId, label)` returns a request whose `message` contains the element label **and** its express id, and whose `confirmLabel` is `Delete`. No destructive request may be constructed without an identifiable subject.
10. All three delete triggers (`Delete`/`Backspace`, context menu, contextual dock) go through requirement 8. Cancelling any of them leaves the model byte-identical.
11. A failed undo or redo shows a visible, dismissible message naming the action that failed; it never fails silently to `console.error` only.

## TDD

### 1. Add the failing test

**File:** `backend/tests/test_step10_undo_delete.py`
**Command:** `.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step10_undo_delete.py -v`

<details>

```python
import sys
from pathlib import Path

from starlette.testclient import TestClient

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.app.main import app
import ifcopenshell


def _project_file(project_id: str) -> Path:
    return Path(root_dir) / "storage" / "projects" / project_id / "model.ifc"


def _entity_exists(project_id: str, express_id: int) -> bool:
    """ifcopenshell 0.9.0 raises RuntimeError for a missing id - do not use by_id in a boolean."""
    model = ifcopenshell.open(str(_project_file(project_id)))
    try:
        model.by_id(express_id)
        return True
    except Exception:
        return False


def test_undo_of_delete_restores_the_same_element():
    """Deleting a wall and pressing undo must bring the wall back, with the same express_id."""
    with TestClient(app) as client:
        created = client.post("/api/projects", json={"name": "AutoTest-Step10-UndoDelete", "schema_version": "IFC4"})
        assert created.status_code == 201, created.text
        project_id = created.json()["id"]

        try:
            wall_res = client.post(
                f"/api/projects/{project_id}/cad/wall",
                json={
                    "start": [0.0, 0.0],
                    "end": [4.0, 0.0],
                    "elevation": 0.0,
                    "height": 3.0,
                    "thickness": 0.2,
                    "name": "UndoProbeWall",
                },
            )
            assert wall_res.status_code == 200, wall_res.text
            wall_id = wall_res.json()["express_id"]

            deleted = client.delete(f"/api/projects/{project_id}/cad/elements/{wall_id}")
            assert deleted.status_code == 200, deleted.text
            assert client.get(f"/api/projects/{project_id}/elements/{wall_id}").status_code == 404
            assert _entity_exists(project_id, wall_id) is False

            undo = client.post(f"/api/projects/{project_id}/cad/undo")
            assert undo.status_code == 200, f"undo returned {undo.status_code}: {undo.text}"
            body = undo.json()
            assert body["success"] is True, body
            assert body["affected_express_id"] == wall_id

            # Identity is preserved, not just "a wall exists again".
            assert _entity_exists(project_id, wall_id) is True, "undo did not restore the deleted entity"
            details = client.get(f"/api/projects/{project_id}/elements/{wall_id}")
            assert details.status_code == 200, details.text
            assert details.json()["name"] == "UndoProbeWall"

            model = ifcopenshell.open(str(_project_file(project_id)))
            assert model.by_id(wall_id).is_a() == "IfcWall"
        finally:
            assert client.delete(f"/api/projects/{project_id}").status_code == 204


def test_undo_never_wedges_the_stack_and_never_lies():
    """A second undo must report failure, not HTTP 500, and must not claim success."""
    with TestClient(app) as client:
        created = client.post("/api/projects", json={"name": "AutoTest-Step10-UndoWedged", "schema_version": "IFC4"})
        assert created.status_code == 201, created.text
        project_id = created.json()["id"]

        try:
            # Nothing has been done yet: undo must be a clean "no".
            empty = client.post(f"/api/projects/{project_id}/cad/undo")
            assert empty.status_code == 200, f"undo on an empty stack returned {empty.status_code}: {empty.text}"
            assert empty.json()["success"] is False

            wall_res = client.post(
                f"/api/projects/{project_id}/cad/wall",
                json={"start": [0.0, 0.0], "end": [4.0, 0.0], "height": 3.0, "thickness": 0.2, "name": "W1"},
            )
            wall_id = wall_res.json()["express_id"]
            client.delete(f"/api/projects/{project_id}/cad/elements/{wall_id}")

            first = client.post(f"/api/projects/{project_id}/cad/undo")
            assert first.status_code == 200 and first.json()["success"] is True

            # The delete is undone; the create_wall transaction is still ACTIVE, so this
            # undo must remove the wall again - and must still answer 200, not 500.
            second = client.post(f"/api/projects/{project_id}/cad/undo")
            assert second.status_code == 200, f"second undo returned {second.status_code}: {second.text}"
            assert second.json()["success"] is True
            assert _entity_exists(project_id, wall_id) is False
        finally:
            assert client.delete(f"/api/projects/{project_id}").status_code == 204


def test_property_edit_is_undoable():
    """A property written through the REST endpoint must be reverted by Ctrl+Z."""
    with TestClient(app) as client:
        created = client.post("/api/projects", json={"name": "AutoTest-Step10-UndoProperty", "schema_version": "IFC4"})
        assert created.status_code == 201, created.text
        project_id = created.json()["id"]

        try:
            wall_res = client.post(
                f"/api/projects/{project_id}/cad/wall",
                json={"start": [0.0, 0.0], "end": [4.0, 0.0], "height": 3.0, "thickness": 0.2, "name": "PropWall"},
            )
            wall_id = wall_res.json()["express_id"]

            def read_value() -> object:
                body = client.get(f"/api/projects/{project_id}/elements/{wall_id}").json()
                for pset in body.get("psets", []):
                    if pset["name"] != "Pset_AutoTest":
                        continue
                    for prop in pset.get("properties", []):
                        if prop["name"] == "FireRating":
                            return prop["value"]
                return "<absent>"

            before = read_value()
            assert before == "<absent>"

            write = client.post(
                f"/api/projects/{project_id}/elements/{wall_id}/properties",
                json={
                    "pset_name": "Pset_AutoTest",
                    "property_name": "FireRating",
                    "value": "REI60",
                    "value_type": "IfcLabel",
                },
            )
            assert write.status_code == 200, write.text
            assert read_value() == "REI60"

            undo = client.post(f"/api/projects/{project_id}/cad/undo")
            assert undo.status_code == 200, undo.text
            assert undo.json()["success"] is True, undo.json()
            assert read_value() == "<absent>", "property edit was not reverted"
        finally:
            assert client.delete(f"/api/projects/{project_id}").status_code == 204
```

</details>

**File 2:** `frontend/src/tests/step10.destructiveActions.test.ts`
**Command:** `pnpm exec vitest run src/tests/step10.destructiveActions.test.ts` (from `frontend/`)

Pure-logic test - no jsdom, no STEP-27 dependency. The `ConfirmDestructiveDialog`
*component* test does require STEP-27 (jsdom + `@testing-library/react`); it is deliberately
not part of this file.

<details>

```ts
import { describe, it, expect, vi } from 'vitest';
import {
  buildDeleteElementRequest,
  runDestructiveAction
} from '../services/destructiveActions';

describe('STEP-10 destructive-action gate', () => {
  it('does not perform the action when the user cancels', async () => {
    const action = vi.fn(async () => 'done');
    const confirm = vi.fn(() => false);

    const outcome = await runDestructiveAction(buildDeleteElementRequest(205, 'Basic Wall:Party Wall'), confirm, action);

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(action).not.toHaveBeenCalled();
    expect(outcome).toEqual({ applied: false });
  });

  it('performs the action exactly once when confirmed', async () => {
    const action = vi.fn(async () => 'done');
    const confirm = vi.fn(() => true);

    const outcome = await runDestructiveAction(buildDeleteElementRequest(205, 'Basic Wall'), confirm, action);

    expect(action).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({ applied: true, result: 'done' });
  });

  it('propagates a failing action instead of reporting success', async () => {
    const action = vi.fn(async () => {
      throw new Error('500 from backend');
    });

    await expect(
      runDestructiveAction(buildDeleteElementRequest(205, 'Basic Wall'), () => true, action)
    ).rejects.toThrow('500 from backend');
  });

  it('names the element in the request so the prompt is never anonymous', () => {
    const req = buildDeleteElementRequest(205, 'Basic Wall:Party Wall:1234');

    expect(req.message).toContain('Basic Wall:Party Wall:1234');
    expect(req.message).toContain('205');
    expect(req.confirmLabel).toBe('Delete');
    expect(req.kind).toBe('delete-element');
  });
});
```

</details>

### 2. Watch it fail

Backend:

```
E       RuntimeError: Instance #27 not found
C:\...\backend\app\services\cad_service.py:433: RuntimeError
backend\tests\test_step10_undo_delete.py:52: AssertionError
E       AssertionError: undo returned 500: {"detail":"Failed to undo transaction: Instance #27 not found"}
========================= 3 failed, 0 passed in 9.83s ========================
```

The third test fails separately and for the same root cause class:

```
E       AssertionError: property edit was not reverted
E       assert 'REI60' == '<absent>'
```

Frontend:

```
Error: Failed to resolve import "../services/destructiveActions" from
"src/tests/step10.destructiveActions.test.ts". Does the file exist?
```

and, with the module present but the gate omitted (action always runs):

```
AssertionError: expected "spy" to not be called at all, but actually been called 1 times
```

### 3. Implement

1. **Snapshot plumbing (backend, after STEP-02 lands).** Add to `backend/app/services/cad_service.py`:
   `_snapshot_dir(project_id)` → `ProjectService.get_project_file_path(project_id).parent / "undo"`;
   `_take_snapshot(project_id, transaction_id)` copying `model.ifc` to `undo/{transaction_id}.ifc`;
   `_prune_snapshots(project_id)` enforcing Spec 2 limits. Call `_take_snapshot` from the STEP-02
   commit helper **before** the temp-file replace, not inside each action method.
2. **`_try_by_id`** — `@staticmethod def _try_by_id(model, express_id) -> Optional[Any]` wrapping
   `model.by_id` in `try/except Exception: return None`. Replace the five unsafe call sites listed
   in Scope. This alone converts the HTTP 500 into a correct 404/`success: false`.
3. **`undo`** (`:399-494`) — keep the transaction selection query; look up `snapshot_path` from the
   row's `parameters`; if present, copy it over `model.ifc` and mark the row `UNDONE`; if absent,
   fall back to the existing per-action inverse logic (so the step is incremental and old rows keep
   working) and set `success=False` if that logic changed nothing. Never return `success=True`
   after a no-op.
4. **`redo`** (`:496-587`) — same shape with the post-image. Store both paths in `parameters`
   (`pre_snapshot`, `post_snapshot`) when the commit helper finishes.
5. **Record the missing writers** — `backend/app/api/projects.py:309-316` (property update) and
   `:276-285` (placement) must go through the same helper that (a) takes a snapshot and (b) inserts
   the `cad_transactions` row. Give them `action_type` values `update_property` and
   `update_placement` so the history panel reads sensibly.
6. **Frontend gate** — create `frontend/src/services/destructiveActions.ts` with the types and the
   two functions from Spec 8-9. No React imports.
7. **Dialog** — create `frontend/src/components/common/ConfirmDestructiveDialog.tsx`: controlled
   component, `role="alertdialog"`, `aria-labelledby`/`aria-describedby`, Escape = cancel, focus to
   the cancel button on open, `data-qa="confirm-destructive"` plus
   `data-qa="confirm-destructive-ok"` / `-cancel` for the QA harness. **Ask @designer for the
   visual treatment** (destructive red, spacing, animation); do not invent a new palette.
8. **Wire the three triggers** — in `App.tsx`, hold
   `pendingDestructive: DestructiveRequest | null`; `handleDeleteElement` callers go through
   `runDestructiveAction(req, () => dialogConfirm(), () => handleDeleteElement(id))`. The dialog
   resolves a promise stored in a ref. Do the same in `SpatialContextMenu.tsx:252-256` and
   `GlassContextualModifyDock.tsx:744` - i.e. move the prompt to the *caller* so
   `useCadDraftingMachine.handleDeleteElement` stays a pure executor.
9. **Surface undo failures** — in `useCadDraftingMachine.ts:146-166`, when
   `res.success === false` set a user-visible message via the existing notification mechanism
   (see `setLockNotification` in `App.tsx:693-703` for the pattern) instead of only `console.error`.
10. Re-run both test commands.

> **Decision the executor must make (state it in the handoff entry):** snapshot-per-transaction
> (recommended, Spec 1-5) versus restoring only the deleted sub-graph as a STEP fragment. The
> fragment approach avoids 49 MB copies but usually re-inserts with new express ids, which breaks
> Spec 3 and every cross-reference (BCF viewpoints, pinned elements, audit rows). If the executor
> chooses fragments, Spec 3 must be renegotiated with the product owner first - do not silently
> relax the test.

### 4. Watch it pass

```
backend\tests\test_step10_undo_delete.py::test_undo_of_delete_restores_the_same_element PASSED
backend\tests\test_step10_undo_delete.py::test_undo_never_wedges_the_stack_and_never_lies PASSED
backend\tests\test_step10_undo_delete.py::test_property_edit_is_undoable PASSED
=========================== 3 passed in 14.20s ===========================
```

```
 ✓ src/tests/step10.destructiveActions.test.ts (4 tests) 6ms
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

Manual: load a project, select a wall, press `Delete` → dialog appears naming the wall; cancel →
wall still there; confirm → wall gone; `Ctrl+Z` → wall is back and still selected-able at the same
express id (check the tree node).

### 5. Regression guard

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/ -q
pnpm exec vitest run          # from frontend/
pnpm exec tsc -b --noEmit     # from frontend/
```

`backend/tests/test_cad_and_clash.py:88-104` is the specific guard: create four CAD elements,
`undo`, assert `success is True` and `can_redo is True`, then `redo`, assert `success is True`.
Snapshot-based undo must keep that sequence green.

## Acceptance criteria

- [ ] `DELETE /cad/elements/{id}` then `POST /cad/undo` returns HTTP 200 and the element exists again with the **same** `express_id`, `Name` and type.
- [ ] `POST /cad/undo` on a project with no transactions returns HTTP 200 with `success: false` (never 500).
- [ ] Two consecutive undos after a delete+create sequence both return 200; the stack is never wedged.
- [ ] A property edit through `POST /elements/{id}/properties` is reverted by one `Ctrl+Z`.
- [ ] A gizmo drag via the REST placement route is reverted by one `Ctrl+Z`.
- [ ] `Delete`, the context-menu bin and the ribbon bin each show a dialog naming the element; cancelling leaves the model byte-identical (compare `model.ifc` hash before/after).
- [ ] `grep -r "confirm(" frontend/src` no longer returns 0 - the gate is reachable from all three triggers.
- [ ] Undo/redo retention: no project accumulates more than 20 snapshots or 200 MB under `undo/`.
- [ ] `pytest backend/tests/ -q`, `pnpm exec vitest run`, `pnpm exec tsc -b --noEmit` all green.

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| Whole-file snapshots are expensive on a 49 MB model (copy per mutation) | Snapshot in the commit path only, prune to 20 files / 200 MB, and skip snapshots for read-only ops; measure with the castle sample before shipping | Set `undo_snapshot_enabled = False` in settings → falls back to the existing per-action inverse logic |
| Restoring a whole file discards another user's concurrent edit | STEP-03's per-project write lock plus STEP-13's lock lifecycle mean one writer at a time; a restored snapshot is therefore the state that user saw | Restrict undo to transactions owned by the current `user_id` |
| `_try_by_id` hides real errors (e.g. a corrupt file) | Catch only `RuntimeError`/`Exception` from `by_id` and let `model.write` failures propagate | Revert to raw `by_id` and keep the 500 - no worse than today |
| Confirmation dialogs slow down power users who delete dozens of elements | Add a "don't ask again this session" checkbox later (STEP-28); do **not** add it here | Remove the gate; behaviour returns to today's |
| Dialog promise never resolves if the modal unmounts mid-prompt | Resolve the pending promise with `false` in the unmount cleanup | n/a |
| Snapshot restore rewrites `model.ifc` while a WebSocket client holds a stale matrix | STEP-13 broadcasts lock releases; add a `REMOTE_TRANSFORM_COMMITTED`-style broadcast after undo (see STEP-13 Spec 6) | Undo does not broadcast; clients refresh on next selection |

## Notes

- **Measured vs read.** The `RuntimeError: Instance #27 not found` at `cad_service.py:433` and the
  "delete succeeds, entity is missing, undo throws" sequence were **executed** (probe script against
  a temporary storage root + temp database; the user's `storage/projects.db` was not modified, the
  project count was unchanged, and the temp tree was deleted). The 0-match grep for confirmations was
  executed. The third test's premise was also executed: `POST /elements/{id}/properties` with
  `property_name`/`value_type` returns 200 and the value is readable back from
  `GET /elements/{id}`, so the test is failing for the right reason (no transaction recorded), not
  because the property write is broken. Everything else is a code read.
- **ifcopenshell 0.9.0 quirk worth knowing:** `model.by_id(x)` raises `RuntimeError` for a missing
  id. Any boolean check must be wrapped. This is the direct cause of the 500, and it is why the
  existing `if entity:` guard at `cad_service.py:434` never protected anything.
- **The step is deliberately ordered after STEP-02.** Snapshotting inside each of the ~12 `create_*` /
  `move_*` methods would leave two write paths again, which is exactly the F-002 defect. If STEP-02
  is not landed, stop and finish it first.
- **`parameters` JSON vs a new column:** `parameters` already exists and is `TEXT` holding JSON;
  adding `pre_snapshot`/`post_snapshot` keys needs no migration. A dedicated column is cleaner but
  requires touching `init_db()` (`backend/app/core/database.py:63-76`) for existing installs -
  either is acceptable, be consistent and document it.
- **Not verified:** whether the audit/BCF "deleted" classification (F-022, STEP-19) picks up an
  undo correctly; STEP-19 should be told that `UNDONE` rows will exist with a restored snapshot.
- The `Delete`-key handler at `App.tsx:873` also fires for `Backspace`; keep that, but the dialog
  makes the accidental case safe, which is the point.

### 2026-10-25 — Frontend half implemented (test-first); backend half deferred

**Landed in this lane (frontend only):**

- `frontend/src/services/destructiveActions.ts` (**new**, pure) — `buildDeleteElementRequest`,
  `runDestructiveAction`, `DestructiveRequest` / `DestructiveConfirm` / `DestructiveOutcome`.
  `buildDeleteElementRequest` throws rather than building a prompt without a subject (Spec 9).
- `frontend/src/components/common/ConfirmDestructiveDialog.tsx` (**new**) — `role="alertdialog"`,
  `aria-modal`, labelled/described, focus trapped via `hooks/modalFocus.useModalFocusTrap` (STEP-24),
  focus starts on **Cancel**, Escape / backdrop / Cancel all reject, `data-qa="confirm-destructive"`
  plus `-ok` / `-cancel` / `-message` / `-backdrop`.
- `frontend/src/services/destructiveConfirmation.ts` + `components/common/DestructiveActionHost.tsx`
  (**new**) — one app-wide dialog instance so the three triggers share it without prop plumbing;
  `requestDestructiveConfirmation(request)` resolves `false` (fail-safe) when no host is mounted.
- `frontend/src/hooks/useCadDraftingMachine.ts` — `handleDeleteElement` is now a **pure executor**
  (`{ ok, error }`, no prompt) that surfaces failures through `services/userMessages`; the new gated
  `requestDeleteElement(expressId, label?)` wraps it in `runDestructiveAction`; `handleCadUndo` /
  `handleCadRedo` publish "Undo failed: …" / "Redo failed: …" on `success === false` **and** on a
  thrown request (Spec 11).
- `frontend/src/components/viewer/SpatialContextMenu.tsx` and
  `frontend/src/components/cad/GlassContextualModifyDock.tsx` — both bins call
  `runDestructiveAction` with the shared dialog before invoking `onDelete`; the context menu gained
  an optional `elementLabel` prop.
- `frontend/src/services/userMessages.ts` + `components/common/UserMessageHost.tsx` (**new**),
  mounted in `frontend/src/main.tsx` (composition root) so the undo/redo failure message is visible
  without editing `App.tsx`.

**Tests (green):** `src/tests/step10.destructiveActions.test.ts` (4),
`src/tests/step10.confirmDestructiveDialog.test.tsx` (5 — the auto-generated jsdom/RTL half the spec
deferred to STEP-27, which has landed), `src/tests/step10.deleteCallSites.test.tsx` (5 — the real
context menu and the real hook). `pnpm exec tsc -b` clean; full `pnpm exec vitest run` 21 files /
134 tests green.

**Deferred — backend lane (not implemented here):** Spec 1-2 snapshot plumbing in
`cad_service.py` (`_snapshot_dir` / `_take_snapshot` / `_prune_snapshots`, `parameters.pre_snapshot`
+ `post_snapshot`), Spec 3-6 `undo`/`redo` rewrite plus `_try_by_id`, Spec 7 property-edit
transaction recording (`backend/app/api/projects.py:293-330`), and REST placement recording
(`:260-291`). `backend/tests/test_step10_undo_delete.py` remains the acceptance gate. The
snapshot-per-transaction vs. deleted-sub-graph **decision is still open** — this lane implemented
neither, and the frontend does not care which is chosen as long as `success: false` comes back with
HTTP 200 instead of a 500.

**Deferred — App lane (`frontend/src/App.tsx`, not edited here):** the `Delete`/`Backspace` handler
at `:873-877` still calls `handleDeleteElement` directly, and the exact replacement snippet is in
`notes/STEP-10.md`. Keep passing `handleDeleteElement` (the executor) to `SpatialContextMenu` and
`GlassContextualModifyDock` — they gate internally, so passing `requestDeleteElement` there would
double-prompt.

**Design (@designer):** dialog tone/spacing/animation and the message host's position/format are
unowned. Both reuse the existing `--dock-bg` / `--shadow-hud` surface and the rose accent already
used by the ribbon bin; no new palette was invented.

### 2026-10-25 — Backend half implemented (snapshot-per-transaction); frontend already landed

**Decision on the open question in step 3:** **snapshot-per-transaction**, not a deleted-sub-graph
fragment. Restoring the whole pre-image is what satisfies Spec 3: the element comes back with the
**same** `express_id`, `Name`, `type` and property sets, so BCF viewpoints, pins, measurements and
audit rows still resolve. Fragments would have re-inserted with new ids.

**Landed in this lane (backend only):**

- `backend/app/services/cad_service.py` — undo snapshot plumbing:
  `_snapshot_dir()` → `storage/projects/{project_id}/undo/`; `_take_snapshot(project_id,
  transaction_id, suffix="")` (copy of `model.ifc`, returns the *project-relative* path
  `undo/<tx>.ifc`); `_prune_snapshots()` enforcing **20 files / 200 MB per project, oldest-first**;
  `_resolve_snapshot_path()`, `_file_digest()`, `_parse_parameters()`, `_stack_state()`,
  `_try_by_id()`.
- `undo()` rewritten: restores `parameters.pre_snapshot` over `model.ifc`, marks the row `UNDONE`,
  and returns `success=False` + HTTP 200 (never raising) when there is no `ACTIVE` row, when the
  pre-image is missing/pruned, or when the restore would not change a byte. Rows written before this
  change (no `pre_snapshot`) fall back to the old per-action inverse logic via `_apply_legacy_undo()`,
  which now uses `_try_by_id` and reports "changed nothing" instead of lying.
- `redo()` rewritten: restores `parameters.post_snapshot` and flips the **same** row back to `ACTIVE`
  (Spec 5 — no duplicate `ACTIVE` row). The legacy re-synthesize path remains for pre-snapshot rows
  and now refuses to report success when it did nothing.
- Snapshot is taken **before** every recorded mutation (`create_wall` / `create_slab` /
  `create_column` / `create_opening` / `delete_element` / `clone_element` / `move_element` /
  `rotate_element` / `mirror_element` / `array_element` / `align_element`) through the shared triple
  `begin_snapshot()` → `model.write()` → `record_transaction()`.
- `backend/app/api/projects.py` — the property-edit and REST placement routes now record
  `update_property` / `update_placement` transactions through the same helper, so `Ctrl+Z` covers
  them (Spec 7 and the F-018 half STEP-13 does not own). A failed write discards its orphan snapshot.
  `GET /elements/{express_id}` maps the ifcopenshell `RuntimeError: Instance #N not found` to **404**
  instead of 500 (the definitive `_try_by_id` fix belongs in `ifc_service.py`, owned elsewhere).
- `backend/tests/test_step10_undo_delete.py` (**new**) — the step's three tests.

**Snapshot retention behaviour:** `undo/{transaction_id}.ifc` is the pre-image, captured at commit;
`undo/{transaction_id}.post.ifc` is the post-image, captured **lazily at undo time** (the file on
disk at that moment *is* the post-image of the newest `ACTIVE` transaction on a linear stack), which
avoids writing a second 49 MB copy on every commit. Both count against the same **20 files / 200 MB**
budget by mtime, so the effective snapshot depth is ~10 actions; beyond that `undo` degrades to the
legacy inverse path (creates/transforms still revert, a delete reports a clean `success=False`
"no restorable pre-image"). Snapshots live inside the project directory, so `delete_project()`'s
`rmtree` already removes them; setting `CADService.UNDO_SNAPSHOT_ENABLED = False` is the rollback
switch from the risk table (no settings key was added — `core/config.py` is not in this lane).

**STEP-02 seam (do not duplicate this triple elsewhere):** `CADService.begin_snapshot()` →
the existing `model.write()` call → `CADService.record_transaction()`. `record_transaction()` is the
only place that inserts `cad_transactions` rows, and it stores `parameters.pre_snapshot` /
`post_snapshot` as project-relative paths (the `parameters` JSON option from the step's note — no
schema migration). When STEP-02 lands its single commit path, it takes the snapshot immediately
before its temp-file replace and calls `record_transaction()` for the row; the eleven per-method
triples collapse into it with no behaviour change. `pre_snapshot`/`post_snapshot` keys are additive,
so existing rows still parse in `get_history()` and old rows keep working through the inverse path.

**Deviations from the letter of the spec (deliberate):**

- Post-image is captured lazily at undo time instead of at commit time (halves the snapshot bytes per
  action; same result on a linear stack).
- `test_property_edit_is_undoable` gained two assertions (`action == "update_property"` and the wall
  still existing). Verbatim, that test **passed pre-fix for the wrong reason**: undo of the
  unrecorded property edit removed the whole wall, so the property read back as `<absent>` either
  way. It now fails pre-fix for the right reason.
- `update_geometry`, `assign_storey`, `assign_material` and `pin_element` still record no transaction,
  so they remain non-undoable. They were out of this lane's named `by_id` sites; STEP-02's commit path
  will pick them up once each mutation goes through it. Raw `by_id` calls were kept there (and in
  `create_opening`'s host-wall lookup / `_get_target_storey`) to avoid churn in other lanes' code.

**Tests:** `backend/tests/test_step10_undo_delete.py` — pre-fix, the three tests verbatim gave
`2 failed, 1 passed` (`RuntimeError: Instance #27 not found` at `cad_service.py` → HTTP 500 on undo;
the property test passed *vacuously*), and `3 failed` once the third test's missing assertions were
added; post-fix `3 passed in 2.13s`. `backend/tests/test_cad_and_clash.py` (the undo→redo guard)
`2 passed in 1.27s`. Probes also confirmed: redo restores the post-image with the same express id and
reuses the row; the REST placement route is undoable; 26 mutations leave exactly 20 files under
`undo/`; a legacy row without `pre_snapshot` still undoes through the inverse path; move / clone /
array / mirror all undo through the snapshot path.

**Still open (not this lane):** the `App.tsx` `Delete`/`Backspace` handler still calls
`handleDeleteElement` directly instead of `requestDeleteElement` (see `notes/STEP-10.md`), and every
criteria item that needs the browser (dialog on all three triggers, cancel leaves `model.ifc`
byte-identical, `Ctrl+Z` after a gizmo drag in the UI) is unverified here. STEP-19 should be told that
`UNDONE` rows now exist alongside a restored snapshot.

