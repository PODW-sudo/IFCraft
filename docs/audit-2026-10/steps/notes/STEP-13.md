# STEP-13 — handoff fragments (frontend lane, 2026-10-25)

Scope owned by this lane: `frontend/src/services/wsResilience.ts`,
`frontend/src/services/collaboration.ts`, `frontend/src/main.tsx` (message host mount, shared with
STEP-10) and `frontend/src/tests/step13.wsResilience.test.ts`.

**Not** owned (deferred, listed below): `backend/**` and `frontend/src/App.tsx`.

---

## 2026-10-25 - Rejected commit / replaced session were silent; now dispatched and surfaced (App.tsx wiring deferred)

- **Type:** Bug
- **Platform:** http://localhost:5173
- **Related tests:** TC-065, TC-C112-A
- **Severity:** P0
- **Observed:** `grep -r "COMMIT_REJECTED" frontend/src` returned 0 matches. The client `switch` had
  no case for it, so the optimistic transform stayed on screen and the losing user never learned the
  commit was rejected. `App.tsx:672-710` also had no handler for connection state.
- **Expected:** A rejected commit produces a user-visible message within one frame, and the element
  returns to the server's authoritative placement.
- **Evidence:** `src/tests/step13.wsResilience.test.ts` (7 tests) proves
  `dispatchServerMessage({type:'COMMIT_REJECTED'}, …)` routes to `onCommitRejected(expressId, reason)`.
  `services/collaboration.ts` now also falls back to `services/userMessages` when the callback is not
  wired, so the message is visible today (`UserMessageHost` is mounted in `main.tsx`).
- **Suggested fix (App lane):** widen the `CollaborationClient` callbacks object in `App.tsx:672-710`:

  ```tsx
  const [collabState, setCollabState] = useState<'connecting' | 'open' | 'closed'>('closed');

  const client = new CollaborationClient(currentProject.id, {
    // …existing callbacks unchanged…
    onConnectionState: setCollabState,
    onCommitRejected: (expressId, reason) => {
      // Message text is already produced by the client fallback if this is omitted; wire it here
      // only if the App wants its own phrasing/notification surface.
      setSelectedExpressID(expressId);
      void (async () => {
        try {
          const details = await api.getElementDetails(currentProject.id, expressId);
          setSelectedElementDetails(details);            // authoritative properties
          await loadProject(currentProject, expressId);  // authoritative placement + geometry
        } catch (err) {
          console.warn('Could not refresh the rejected element:', err);
        }
      })();
    }
  });
  ```

  Header dot: pass `collabState` into the header component (`GlassHeader` / `ModernGlassHeader`) and
  render `<span data-qa="collab-presence-dot" data-state={collabState} />`. **The dot's visual is
  @designer-owned — this lane exposes the state only.**
- **Status:** Open (App lane) — client half implemented

---

## 2026-10-25 - Lock canonicalisation, TTL, duplicate JOIN and identity-checked removal (deferred to backend)

- **Type:** Bug
- **Platform:** http://localhost:5173
- **Related tests:** TC-065, TC-C112-A
- **Severity:** P1
- **Observed:** `backend/app/services/websocket_manager.py` still keys `room.locks` by whatever the
  client sent (`"205"` ≠ `205`), never expires a lock, replaces a live session on a duplicate
  `user_id` without closing it or releasing its locks, and `remove_user(user_id)` cannot tell a
  stale socket from the live one. `backend/app/api/websocket.py` does not normalise `express_id` and
  does not answer malformed ids with an `ERROR` frame.
- **Expected:** Spec 1-5 of the step document.
- **Evidence:** step document Evidence bullets for `websocket_manager.py:34-70` and
  `websocket.py:37-72`; `backend/tests/test_step13_ws_room.py` is the acceptance gate (5 tests).
- **Suggested fix:** implement Spec 1-5 as written — `_canonical_express_id` (`int()` + `ValueError`),
  `lock_ttl_seconds: int = 120` in `Room.__init__` plus `acquired_at` refresh on `acquire_lock`,
  `add_user` returning `{replaced, previous, released}`, `remove_user(user_id, session=None)`,
  and the duplicate-`JOIN` path in `websocket.py` that sends `SESSION_REPLACED`, closes the old
  socket with `4001` and broadcasts `ELEMENT_UNLOCKED` for each released id.
- **Status:** Open (backend lane)

---

## 2026-10-25 - Reconnect policy, outbox and connection state (frontend) implemented

- **Type:** Enhancement
- **Platform:** http://localhost:5173
- **Related tests:** TC-065
- **Severity:** P1
- **Observed:** `grep -n "onerror\|reconnect\|setTimeout" frontend/src/services/collaboration.ts`
  returned 0 matches; `onclose` only set `isConnected = false`; `send()` dropped every frame while
  the socket was not `OPEN` with no log.
- **Expected / delivered:** `nextReconnectDelay` (500 ms × 2^attempt, capped at 30 s, ±20 % jitter),
  `shouldReconnect` (no retry for `1000` or `4001`), `Outbox` (bound 50, FIFO flush, oldest
  `TRANSFORM_STREAM` evicted first, commits/selections never dropped) and `dispatchServerMessage`
  (returns the handled type, `UNKNOWN` for unknown/malformed payloads, one callback per frame).
  `collaboration.ts` now reconnects with backoff through a timer that `disconnect()` clears, logs
  `onerror`, re-sends `JOIN` + the current `SELECT_ELEMENT` on `onopen` before draining the outbox,
  and exposes `connectionState` plus `onConnectionState`. `SESSION_REPLACED` and `ERROR` frames are
  dispatched to `onSessionReplaced` / `onServerError`.
- **Evidence:** `src/tests/step13.wsResilience.test.ts` (7 tests); `pnpm exec tsc -b` clean.
- **Suggested fix:** n/a
- **Status:** Implemented (frontend); App.tsx + backend items above remain open

---

## 2026-10-25 - Reconnect/rejection flows not verified against a live socket

- **Type:** Testability
- **Platform:** http://localhost:5173
- **Related tests:** TC-065
- **Severity:** P2
- **Observed:** This lane changed no backend code, so the manual two-client checks in the step
  document ("Watch it pass", steps 1-4) could not be run: there is no `COMMIT_REJECTED` producer
  without the backend lock work, and no `4001` close without the duplicate-`JOIN` work. The
  reconnect loop is therefore proven only at the unit level (`nextReconnectDelay`,
  `shouldReconnect`, `Outbox`).
- **Expected:** After the backend lane lands, verify: (1) stop/restart the backend for 5 s → both
  clients reconnect at ~0.5 s, 1 s, 2 s… with presence restored and no page reload; (2) drag an
  element another client holds → rejection message + snap-back; (3) second tab with the same profile
  → first tab stops retrying on `4001` and shows the "opened in another tab" message.
- **Evidence:** `frontend/src/services/collaboration.ts` (reconnect path), step document
  "Watch it pass".
- **Suggested fix:** run the manual checks once `backend/tests/test_step13_ws_room.py` is green, and
  re-check `shouldReconnect` if STEP-05 changes the close code used for a rejected handshake.
- **Status:** Open
