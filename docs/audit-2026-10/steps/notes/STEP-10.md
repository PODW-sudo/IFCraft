# STEP-10 — handoff fragments (frontend lane, 2026-10-25)

Scope owned by this lane: `frontend/src/services/destructiveActions.ts`,
`frontend/src/services/destructiveConfirmation.ts`, `frontend/src/services/userMessages.ts`,
`frontend/src/components/common/ConfirmDestructiveDialog.tsx`,
`frontend/src/components/common/DestructiveActionHost.tsx`,
`frontend/src/components/common/UserMessageHost.tsx`,
`frontend/src/hooks/useCadDraftingMachine.ts`,
`frontend/src/components/viewer/SpatialContextMenu.tsx`,
`frontend/src/components/cad/GlassContextualModifyDock.tsx`, `frontend/src/main.tsx`, and the
`frontend/src/tests/step10.*` suites.

**Not** owned (deferred, listed below): `backend/**` and `frontend/src/App.tsx`.

---

## 2026-10-25 - `Delete` / `Backspace` still deletes without a confirmation (App.tsx wiring deferred)

- **Type:** Bug
- **Platform:** http://localhost:5173
- **Related tests:** TC-CAD-03, TC-CAD-06, TC-086
- **Severity:** P0
- **Observed:** The viewport context-menu bin and the contextual dock bin now open
  `ConfirmDestructiveDialog` (proved by `src/tests/step10.deleteCallSites.test.tsx`), but
  `App.tsx:873-877` still calls `handleDeleteElement(selectedExpressID)` directly, so one keypress
  removes geometry with no prompt.
- **Expected:** All three triggers gate through `runDestructiveAction`; cancelling any of them
  leaves `model.ifc` byte-identical (Spec 10).
- **Evidence:** `frontend/src/tests/step10.deleteCallSites.test.tsx` (5 tests) covers the context
  menu, the pure executor and the gated `requestDeleteElement`; the key handler is outside this
  lane and still bypasses the gate.
- **Suggested fix:** in `App.tsx` destructure `requestDeleteElement` from
  `useCadDraftingMachine({…})` (keep passing `handleDeleteElement` to the two components — they gate
  internally, so passing the gated variant would double-prompt) and replace the delete branch with:

  ```tsx
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedExpressID !== null) {
      e.preventDefault();
      const label = selectedElementDetails?.name || `Element #${selectedExpressID}`;
      void requestDeleteElement(selectedExpressID, label);
    }
    return;
  }
  ```

  Add `requestDeleteElement` and `selectedElementDetails` to that effect's dependency list.
  Optionally pass `elementLabel={selectedElementDetails?.name}` to `SpatialContextMenu` so the
  prompt names the element instead of `Element #205`.
- **Status:** Open

---

## 2026-10-25 - Undo of a delete is still HTTP 500 on the backend (deferred to the backend lane)

- **Type:** Bug
- **Platform:** http://localhost:5173
- **Related tests:** TC-086, TC-087, TC-C62-A, TC-C63-A
- **Severity:** P0
- **Observed:** `backend/app/services/cad_service.py` still has no snapshot plumbing and no
  `_try_by_id`, so `POST /cad/undo` after a delete raises `RuntimeError: Instance #27 not found`,
  answers 500 and leaves the transaction `ACTIVE`. The frontend half is complete: a `success: false`
  response or a thrown request now produces a dismissible "Undo failed: …" / "Redo failed: …"
  message (`services/userMessages.ts` → `UserMessageHost`), so the user is no longer told nothing.
- **Expected:** Spec 1-7 of the step document — per-transaction pre/post snapshots written in the
  STEP-02 commit path, `undo`/`redo` restore them, `undo` returns `success: false` with HTTP 200
  when there is nothing to undo, and the deleted entity comes back with the **same** `express_id`.
- **Evidence:** step document "Evidence" (`cad_service.py:399-494`, `:632-693`, `api/cad.py:86-93`);
  the frontend renderer for that message is `frontend/src/services/userMessages.ts` +
  `components/common/UserMessageHost.tsx` (mounted in `main.tsx`).
- **Suggested fix:** implement Spec 1-7 exactly as written; `backend/tests/test_step10_undo_delete.py`
  is the acceptance gate. The executor must also state the snapshot-vs-fragment decision in this
  file (snapshot-per-transaction is recommended because fragments re-insert with new express ids and
  break Spec 3 plus every cross-reference).
- **Status:** Open (backend lane)

---

## 2026-10-25 - Property edits and gizmo placements write no `cad_transactions` row (deferred)

- **Type:** Bug
- **Platform:** http://localhost:5173
- **Related tests:** TC-086, TC-029 (property edit persistence)
- **Severity:** P1
- **Observed:** `backend/app/api/projects.py:293-330` (property edit) and `:260-291` (REST placement)
  bypass the commit helper, so `Ctrl+Z` cannot cover them even in principle. The frontend now routes
  placement through STEP-02's single commit path unchanged (this lane did not touch it).
- **Expected:** Both paths record a transaction through the STEP-02 helper (`action_type`
  `update_property` / `update_placement`) with a pre-image snapshot, so one `Ctrl+Z` reverts them.
- **Evidence:** step document Scope bullets 3-4 and Spec 7; `test_property_edit_is_undoable` in
  `backend/tests/test_step10_undo_delete.py`.
- **Suggested fix:** call the STEP-02 commit helper from both handlers instead of writing the model
  directly.
- **Status:** Open (backend lane)

---

## 2026-10-25 - Destructive confirmation: visual treatment unowned (@designer)

- **Type:** UX
- **Platform:** http://localhost:5173
- **Related tests:** TC-CAD-03
- **Severity:** P2
- **Observed:** `ConfirmDestructiveDialog` implements behaviour only (alertdialog semantics, focus on
  Cancel, Escape/backdrop/Cancel reject) and reuses the existing `--dock-bg` / `--shadow-hud`
  surface with the rose accent already used by the ribbon bin. `UserMessageHost` is a neutral
  bottom-centre stack. Neither has had a design pass.
- **Expected:** A deliberate destructive tone (colour, spacing, icon, enter/exit animation), a
  decision on whether the message host should be a toast, snackbar or inline HUD, and confirmation
  that the bottom-centre host does not collide with the measurement HUD.
- **Evidence:** `frontend/src/components/common/ConfirmDestructiveDialog.tsx`,
  `frontend/src/components/common/UserMessageHost.tsx`.
- **Suggested fix:** @designer pass over both components; keep the `data-qa` hooks and the
  alertdialog/focus contract intact.
- **Status:** Open

---

## 2026-10-25 - Landed: destructive gate + user-visible undo/redo failures (frontend)

- **Type:** Enhancement
- **Platform:** http://localhost:5173
- **Related tests:** TC-CAD-03, TC-CAD-06, TC-086, TC-087
- **Severity:** P1
- **Observed:** Before this lane there were 0 confirmation prompts in `frontend/src` and a failed
  undo only reached `console.error`.
- **Expected / delivered:** `runDestructiveAction` is the only execution path for a delete;
  `handleDeleteElement` is a pure executor that returns `{ ok, error }` and surfaces failures;
  `handleCadUndo` / `handleCadRedo` publish "Undo failed: …" / "Redo failed: …" on
  `success === false` or a thrown request. Tests: `step10.destructiveActions.test.ts` (4),
  `step10.confirmDestructiveDialog.test.tsx` (5), `step10.deleteCallSites.test.tsx` (5);
  `pnpm exec tsc -b` clean.
- **Evidence:** the three test files above.
- **Suggested fix:** n/a
- **Status:** Implemented (frontend); App.tsx + backend items above remain open
