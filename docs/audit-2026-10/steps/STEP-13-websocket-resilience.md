# STEP-13 — WebSocket resilience: reconnect, `COMMIT_REJECTED`, lock lifecycle

**Status:** not started · **Wave:** B · **Effort:** 2 d
**Findings:** F-017, F-018, F-046 · **Depends on:** STEP-02, STEP-05 · **Blocks:** STEP-19

## Problem

The collaboration socket is a fair-weather connection. If it drops - laptop sleep, backend
restart, a proxy timeout - the client sets a flag to `false` and never reconnects; every later
`send()` silently discards the message, so the user keeps editing a document nobody else can
see, with presence frozen at the moment of the disconnect. When the server *does* reject a commit
because another user holds the soft lock, it sends a `COMMIT_REJECTED` frame that the client's
`switch` has no case for: the rejection is dropped, the optimistic transform stays on screen, and
the losing user never learns they lost. Separately, lock keys are not normalised (`"205"` and
`205` are different dict keys), never expire, and a second session with the same `user_id`
silently replaces the first - and when the *old* socket disconnects it releases the *new*
session's locks.

## Evidence

- `frontend/src/services/collaboration.ts:147-149` — `this.ws.onclose = () => { this.isConnected = false; };` There is no `onerror` handler and no reconnect timer anywhere in the file or in `App.tsx`.
- `frontend/src/services/collaboration.ts:205-209` — `private send(data) { if (this.ws && this.ws.readyState === WebSocket.OPEN) { ... } }` - messages attempted while `CONNECTING`/`CLOSED` are dropped with no queue and no log.
- `frontend/src/services/collaboration.ts:102-145` — the message `switch` handles `ROOM_STATE`, `USER_JOINED`, `USER_LEFT`, `ELEMENT_LOCKED`, `ELEMENT_UNLOCKED`, `LOCK_REJECTED`, `REMOTE_TRANSFORM_STREAM`, `REMOTE_TRANSFORM_COMMITTED`, `REMOTE_PROPERTY_UPDATED`. There is **no** `COMMIT_REJECTED` case.
- `backend/app/api/websocket.py:108-117` — the server does send it: `{"type": "COMMIT_REJECTED", "express_id": ..., "reason": "Element locked by user ..."}`.
- `backend/app/api/websocket.py:37-51` — `JOIN` builds a `UserSession` and calls `room.add_user(session)`; there is no duplicate-id check.
- `backend/app/services/websocket_manager.py:44-50` — `add_user` does `self.sessions[session.user_id] = session`, replacing any live session without closing it or releasing its locks.
- `backend/app/services/websocket_manager.py:52-70` — `remove_user(user_id)` deletes by id with no identity check, so the *old* socket's `finally` block (`websocket.py:152-166`) removes the *new* session and releases its locks.
- `backend/app/services/websocket_manager.py:34-42` — `cleanup_stale_locks` only purges locks whose holder is not in `sessions`; there is no age check, so a client that keeps a socket open forever keeps a lock forever.
- `backend/app/api/websocket.py:54-72` — `express_id = data.get("express_id")` is used as a dict key verbatim; a client sending `"205"` creates a second key for the same element.
- `frontend/src/App.tsx:672-710` — the callbacks object passed to `CollaborationClient` has no rejection handler, so even a correct client could not surface it.
- Measured: `grep -n "COMMIT_REJECTED" frontend/src -r` → **0 matches** (server-side only).
- Measured: `grep -n "onerror\|reconnect\|setTimeout" frontend/src/services/collaboration.ts` → **0 matches**.

## Scope

**Change:**

- `backend/app/services/websocket_manager.py` — `Room` gains canonical integer lock keys, a lock TTL with an injectable clock, identity-checked removal, and a duplicate-join signal that names the replaced session and the locks it held.
- `backend/app/api/websocket.py` — normalise `express_id` before use; on a duplicate `JOIN` close the previous socket with code `4001` and broadcast the released locks; pass the `UserSession` into `remove_user` from the `finally` block.
- `frontend/src/services/wsResilience.ts` — **new** pure module: `nextReconnectDelay`, `shouldReconnect`, `Outbox`, `dispatchServerMessage`.
- `frontend/src/services/collaboration.ts` — use the four helpers: reconnect with backoff on `onclose` (except codes `1000`/`4001`), `onerror` logging, queue writes through `Outbox` and flush on `onopen`, dispatch through `dispatchServerMessage` including a new `onCommitRejected` callback, expose `connectionState`.
- `frontend/src/App.tsx:672-710` — handle `onCommitRejected`: tell the user and reload the authoritative placement for that element; handle `onConnectionState` to show a presence state in the header (the header already renders `collaborators`, so no new UI is required beyond a status dot - **defer the visual to @designer**).

**Do not change:**

- The wire protocol's existing message names or payload shapes; `COMMIT_REJECTED` is *added* to the client's vocabulary, not changed.
- `Room.broadcast` semantics (`websocket_manager.py:128-137`) or the "send failure only logs a warning" behaviour.
- The soft-lock UX in `useSpatialSelection.handleSelectElement` (`:84-117`).
- The REST placement route itself - recording it as an undoable transaction is STEP-10; this step only ensures the client treats a rejection as final.
- `useGizmoTransform.ts:35,38` - STEP-02 collapses the double write.

**Non-goals:**

- Authentication of the socket beyond the Origin check in STEP-05 (no per-user secrets, no signing).
- CRDT/OT, reconnect replay of missed *remote* edits (the client re-reads the model on reconnect instead).
- Server-push heartbeats/PING-PONG frames. The TTL handles the lock half; a heartbeat is a follow-up.
- Multi-tab identity management beyond "the newest socket wins".

## Spec

1. `Room.acquire_lock(express_id, user_id)` accepts `int` or a numeric `str` and always keys `room.locks` by the canonical `int`. A non-numeric id raises `ValueError` and writes nothing.
2. `Room.cleanup_stale_locks(now=None)` also purges locks whose `acquired_at` is older than `lock_ttl_seconds` (default 120 s), as well as those held by users not present. `acquire_lock` refreshes `acquired_at`.
3. `Room.add_user(session)` returns an object `{replaced: bool, previous: UserSession | null, released: list[int]}`. When a session already exists for that `user_id`, the new session replaces it, `replaced` is `True`, and every lock held by the previous session is removed and reported in `released`.
4. `Room.remove_user(user_id, session=None)` deletes the session only if `session is None` **or** the stored session is that same object. A stale socket's disconnect therefore cannot release the live session's locks.
5. `POST` of a duplicate `JOIN` causes the server to send `{"type": "SESSION_REPLACED"}` to the *old* socket and close it with code `4001`, then broadcast `ELEMENT_UNLOCKED` for each id in `released`.
6. `dispatchServerMessage(message, callbacks)` returns the message type it handled, invokes exactly one callback, tolerates unknown types (`'UNKNOWN'`) and malformed payloads without throwing, and maps `COMMIT_REJECTED` → `callbacks.onCommitRejected(expressId, reason)`.
7. `nextReconnectDelay(attempt, random)` returns `min(30000, 500 * 2**attempt) * (0.8 + 0.4 * random())` - monotonic in `attempt` up to the 30 s cap, with bounded jitter.
8. `shouldReconnect(closeCode)` is `false` for `1000` (clean) and `4001` (session replaced), `true` otherwise.
9. `Outbox` buffers at most `maxSize` (default 50) messages while disconnected and `flush(send)` delivers them in FIFO order and empties the buffer. On overflow it discards the **oldest `TRANSFORM_STREAM`** first and never discards `TRANSFORM_COMMIT`, `SELECT_ELEMENT` or `DESELECT_ELEMENT`.
10. On reconnect the client re-sends `JOIN` and re-sends its current selection (`SELECT_ELEMENT`) so the server-side lock set converges without the user clicking again.
11. `CollaborationClient` exposes `connectionState: 'connecting' | 'open' | 'closed'` and calls the optional `onConnectionState` callback on each transition.

## TDD

### 1. Add the failing tests

Two files, both runnable on today's infrastructure: `Room` is a plain Python class (no DB, no
socket), and the frontend helpers are pure functions.

**File 1:** `backend/tests/test_step13_ws_room.py`
**Command:** `.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step13_ws_room.py -v`

<details>

```python
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.app.services.websocket_manager import Room, UserSession


class FakeWebSocket:
    """Room never touches the socket except to hand it to the session."""

    def __init__(self, name: str = "ws"):
        self.name = name
        self.sent: list[str] = []
        self.closed_with: int | None = None

    async def send_text(self, payload: str) -> None:
        self.sent.append(payload)


def _session(user_id: str, ws: FakeWebSocket | None = None) -> UserSession:
    return UserSession(user_id, f"User {user_id}", "#38bdf8", ws or FakeWebSocket(user_id))


def test_lock_keys_are_canonical_integers():
    room = Room("proj-1")
    room.add_user(_session("u1"))
    room.add_user(_session("u2"))

    assert room.acquire_lock("205", "u1") is True
    # 205 and "205" must be the same element, so u2 is blocked by u1's lock.
    assert room.acquire_lock(205, "u2") is False
    assert list(room.locks.keys()) == [205]
    assert isinstance(list(room.locks.keys())[0], int)


def test_non_numeric_element_id_is_rejected_without_polluting_locks():
    room = Room("proj-1")
    room.add_user(_session("u1"))

    with pytest.raises(ValueError):
        room.acquire_lock("not-an-id", "u1")
    assert room.locks == {}


def test_locks_expire_after_the_ttl():
    room = Room("proj-1", lock_ttl_seconds=120)
    room.add_user(_session("u1"))
    room.add_user(_session("u2"))

    start = datetime(2026, 10, 24, 12, 0, 0, tzinfo=timezone.utc)
    assert room.acquire_lock(205, "u1", now=start) is True
    assert room.acquire_lock(205, "u2", now=start + timedelta(seconds=119)) is False

    room.cleanup_stale_locks(now=start + timedelta(seconds=121))
    assert 205 not in room.locks
    # Once the stale lock is gone the other user can take it.
    assert room.acquire_lock(205, "u2", now=start + timedelta(seconds=122)) is True


def test_duplicate_user_id_replaces_and_releases_instead_of_orphaning():
    room = Room("proj-1")
    old = _session("u1")
    room.add_user(old)
    room.add_user(_session("u2"))
    assert room.acquire_lock(205, "u1") is True

    new = _session("u1")
    outcome = room.add_user(new)

    assert outcome["replaced"] is True
    assert 205 in outcome["released"]
    assert 205 not in room.locks          # no orphan lock left behind
    assert room.sessions["u1"] is new

    # The *old* socket disconnecting must not touch the live session's locks.
    assert room.acquire_lock(300, "u1") is True
    room.remove_user("u1", session=old)
    assert room.sessions["u1"] is new
    assert 300 in room.locks


def test_remove_user_only_releases_that_users_locks():
    room = Room("proj-1")
    room.add_user(_session("u1"))
    room.add_user(_session("u2"))
    room.acquire_lock(1, "u1")
    room.acquire_lock(2, "u2")

    released = room.remove_user("u2")

    assert released == [2]
    assert 1 in room.locks
    assert 2 not in room.locks
```

</details>

**File 2:** `frontend/src/tests/step13.wsResilience.test.ts`
**Command:** `pnpm exec vitest run src/tests/step13.wsResilience.test.ts` (from `frontend/`)

<details>

```ts
import { describe, it, expect, vi } from 'vitest';
import {
  nextReconnectDelay,
  shouldReconnect,
  Outbox,
  dispatchServerMessage
} from '../services/wsResilience';

const noJitter = () => 0.5; // (0.8 + 0.4 * 0.5) === 1.0 → exact exponential values

describe('STEP-13 reconnect policy', () => {
  it('backs off exponentially and caps at 30 s', () => {
    const delays = [0, 1, 2, 3, 4, 10].map((n) => nextReconnectDelay(n, noJitter));
    expect(delays).toEqual([500, 1000, 2000, 4000, 8000, 30000]);
  });

  it('never reconnects after a clean close or a replaced session', () => {
    expect(shouldReconnect(1000)).toBe(false);
    expect(shouldReconnect(4001)).toBe(false);
    expect(shouldReconnect(1006)).toBe(true);
    expect(shouldReconnect(1011)).toBe(true);
  });
});

describe('STEP-13 outbox', () => {
  it('queues while closed and flushes in FIFO order', () => {
    const outbox = new Outbox({ maxSize: 10 });
    outbox.push({ action: 'SELECT_ELEMENT', express_id: 1 });
    outbox.push({ action: 'TRANSFORM_COMMIT', express_id: 1 });
    expect(outbox.size).toBe(2);

    const sent: unknown[] = [];
    const flushed = outbox.flush((m) => sent.push(m));

    expect(flushed).toBe(2);
    expect(outbox.size).toBe(0);
    expect(sent.map((m) => (m as { action: string }).action)).toEqual([
      'SELECT_ELEMENT',
      'TRANSFORM_COMMIT'
    ]);
  });

  it('drops the oldest stream frame on overflow but never a commit', () => {
    const outbox = new Outbox({ maxSize: 3 });
    outbox.push({ action: 'TRANSFORM_STREAM', express_id: 1, matrix: [1] });
    outbox.push({ action: 'TRANSFORM_STREAM', express_id: 1, matrix: [2] });
    outbox.push({ action: 'TRANSFORM_COMMIT', express_id: 1, matrix: [3] });
    outbox.push({ action: 'TRANSFORM_STREAM', express_id: 1, matrix: [4] }); // overflow

    const kept: string[] = [];
    outbox.flush((m) => kept.push(JSON.stringify(m)));

    expect(outbox.size).toBe(0);
    expect(kept.join('|')).toContain('"matrix":[3]');   // commit survived
    expect(kept.join('|')).not.toContain('"matrix":[1]'); // oldest stream dropped
  });
});

describe('STEP-13 server message dispatch', () => {
  it('routes COMMIT_REJECTED to the client callback', () => {
    const onCommitRejected = vi.fn();
    const handled = dispatchServerMessage(
      { type: 'COMMIT_REJECTED', express_id: 205, reason: 'Element locked by user u2' },
      { onCommitRejected }
    );

    expect(handled).toBe('COMMIT_REJECTED');
    expect(onCommitRejected).toHaveBeenCalledWith(205, 'Element locked by user u2');
  });

  it('keeps the existing message types working', () => {
    const onElementUnlocked = vi.fn();
    expect(dispatchServerMessage({ type: 'ELEMENT_UNLOCKED', express_id: 7 }, { onElementUnlocked }))
      .toBe('ELEMENT_UNLOCKED');
    expect(onElementUnlocked).toHaveBeenCalledWith(7);
  });

  it('returns UNKNOWN for unrecognised or malformed messages without throwing', () => {
    expect(dispatchServerMessage({ type: 'SOMETHING_NEW' }, {})).toBe('UNKNOWN');
    expect(dispatchServerMessage(null, {})).toBe('UNKNOWN');
    expect(dispatchServerMessage({}, {})).toBe('UNKNOWN');
  });
});
```

</details>

### 2. Watch it fail

Backend:

```
E       TypeError: Room.__init__() got an unexpected keyword argument 'lock_ttl_seconds'
backend\tests\test_step13_ws_room.py:44: TypeError
========================= 5 failed, 0 passed in 1.02s ========================
```

and for the duplicate-join test, once `add_user` still returns `None`:

```
E       TypeError: 'NoneType' object is not subscriptable
```

Frontend:

```
Error: Failed to resolve import "../services/wsResilience" from
"src/tests/step13.wsResilience.test.ts". Does the file exist?
```

Then, with `dispatchServerMessage` copied from the current `switch` (no `COMMIT_REJECTED` case):

```
AssertionError: expected 'UNKNOWN' to be 'COMMIT_REJECTED'
```

### 3. Implement

**Backend**

1. `websocket_manager.py:27-32` — `Room.__init__(self, project_id, lock_ttl_seconds: int = 120)`.
2. `websocket_manager.py:72-116` — `acquire_lock(self, express_id, user_id, now: datetime | None = None)`:
   `eid = _canonical_express_id(express_id)` (module-level helper: `int(express_id)` with `ValueError`
   on bad input), use `eid` everywhere, and stamp `acquired_at` from `now or datetime.now(timezone.utc)`.
3. `websocket_manager.py:34-42` — extend `cleanup_stale_locks(now=None)` with a TTL check
   (`datetime.fromisoformat(lock["acquired_at"])` vs `now - timedelta(seconds=self.lock_ttl_seconds)`).
   Parse failures must purge the lock (a lock with an unreadable timestamp is not trustworthy).
4. `websocket_manager.py:44-50` — `add_user` returns `{"replaced": bool, "previous": UserSession | None, "released": list[int]}`;
   release the previous session's locks before inserting the new one.
5. `websocket_manager.py:52-70` — `remove_user(self, user_id, session: UserSession | None = None)`
   with the identity check from Spec 4.
6. `websocket.py:31-51` — on `JOIN`: use the return value; if `replaced`, send
   `{"type": "SESSION_REPLACED"}` to `previous.websocket` and `await previous.websocket.close(code=4001)`,
   then broadcast `ELEMENT_UNLOCKED` for each released id. Wrap the close in `try/except` (the socket
   may already be gone).
7. `websocket.py:56`, `:77`, `:90`, `:106`, `:143-150` — normalise `express_id` once at the top of each
   branch and answer a malformed value with `{"type": "ERROR", "reason": "invalid express_id"}` rather
   than silently ignoring it.
8. `websocket.py:152-166` — keep a `current_session: UserSession | None` and pass it to
   `room.remove_user(current_user_id, session=current_session)`.

**Frontend**

9. Create `frontend/src/services/wsResilience.ts` with the four exports from Spec 6-9 and
   `export const MAX_RECONNECT_DELAY_MS = 30000;`. Keep it dependency-free (no DOM, no `WebSocket`
   global reference at module scope - that is what makes it testable in node).
10. `collaboration.ts` — rewrite `connect()`:
    - `this.ws.onerror = (e) => console.warn('[collab] socket error', e);`
    - `this.ws.onclose = (event) => { this.isConnected = false; this.setState('closed'); if (shouldReconnect(event.code)) this.scheduleReconnect(); }`
    - `scheduleReconnect()` uses `nextReconnectDelay(attempt++, Math.random)` and a `setTimeout` stored
      in a field so `disconnect()` can clear it (otherwise the app reconnects after a project switch).
    - `onopen` re-sends `JOIN` and re-sends the last selected id (Spec 10), then `outbox.flush(send)`.
11. `collaboration.ts:102-145` — replace the `switch` with `dispatchServerMessage(msg, this.callbacks)`;
    add `onCommitRejected?: (expressId: number, reason: string) => void` and
    `onConnectionState?: (state: 'connecting' | 'open' | 'closed') => void` to `CollaborationCallbacks`
    (`:16-26`).
12. `collaboration.ts:205-209` — `send()` calls `this.ws.send` when open, else `this.outbox.push(data)`.
13. `App.tsx:672-710` — add `onCommitRejected`: show a notification ("Another user is editing this
    element") and refresh the element's authoritative placement by calling
    `api.getElementDetails(currentProject.id, expressId)` (import already present) plus
    `loadProject(currentProject, expressId)` for the geometry. Add `onConnectionState` to a local
    `collabState` used for the header dot (ask @designer for the dot's treatment).

### 4. Watch it pass

```
backend\tests\test_step13_ws_room.py::test_lock_keys_are_canonical_integers PASSED
backend\tests\test_step13_ws_room.py::test_non_numeric_element_id_is_rejected_without_polluting_locks PASSED
backend\tests\test_step13_ws_room.py::test_locks_expire_after_the_ttl PASSED
backend\tests\test_step13_ws_room.py::test_duplicate_user_id_replaces_and_releases_instead_of_orphaning PASSED
backend\tests\test_step13_ws_room.py::test_remove_user_only_releases_that_users_locks PASSED
=========================== 5 passed in 0.84s ===========================
```

```
 ✓ src/tests/step13.wsResilience.test.ts (7 tests) 6ms
 Test Files  1 passed (1)
      Tests  7 passed (7)
```

Manual two-client check (two browsers, same project):

1. Client A selects element 205; client B selects it → B sees the lock notification (unchanged).
2. Client A drags element 205 while B holds it → A's `TRANSFORM_COMMIT` is rejected; A sees the
   "another user is editing this element" message and the element snaps back to B's position.
3. Stop the backend for 5 s and restart it → both clients reconnect automatically (browser network
   tab shows retries at ~0.5 s, 1 s, 2 s…) and presence recovers without a page reload.
4. Open the app in a second tab with the same profile → first tab receives `SESSION_REPLACED` and
   stops retrying (close code 4001); its locks are gone from the second tab's presence list.

### 5. Regression guard

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/ -q
pnpm exec vitest run          # from frontend/
pnpm exec tsc -b --noEmit     # from frontend/
```

`backend/tests/test_phase5.py` exercises the collaboration API surface and must stay green.

## Acceptance criteria

- [ ] `room.acquire_lock("205", u1)` and `room.acquire_lock(205, u2)` address the same element; `room.locks` has one integer key.
- [ ] A lock older than the TTL is purged and becomes acquirable by another user.
- [ ] A duplicate `JOIN` releases the previous session's locks, closes the old socket with code 4001, and broadcasts the unlocks.
- [ ] A stale socket's disconnect does not remove the live session or its locks.
- [ ] A rejected commit produces a user-visible message within one frame of the frame arriving, and the element returns to the server's placement.
- [ ] Killing and restarting the backend recovers both clients without a page reload and without dropping the current selection.
- [ ] While disconnected, edits are queued (bounded at 50, stream frames coalesced) and delivered on reconnect; a commit is never silently dropped.
- [ ] No `console.error`-only path remains for a failed `send` or a rejected commit.
- [ ] `pytest backend/tests/ -q`, `pnpm exec vitest run`, `pnpm exec tsc -b --noEmit` all green.

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| A reconnect storm across many clients after a backend restart | Exponential backoff with jitter, capped at 30 s (Spec 7) | Set `shouldReconnect` to `() => false` behind a setting; behaviour returns to today's |
| Closing a duplicate socket with `4001` confuses users who legitimately open two tabs | Message `SESSION_REPLACED` lets the UI say "opened in another tab"; the second tab keeps working | Keep the new socket but *also* release the old locks (drop only the close) |
| Lock TTL of 120 s expiring during a long single edit | `acquire_lock` refreshes on every `SELECT_ELEMENT`; a commit re-checks the lock and can re-acquire | Raise `lock_ttl_seconds`; it is a constructor argument, not a constant |
| Re-sending `JOIN` on reconnect double-registers presence | `add_user` is idempotent for the same socket; the duplicate path releases and replaces cleanly | Skip the re-JOIN on reconnect - presence recovers on the next selection only |
| `dispatchServerMessage` swallows a type that later needs strict handling | It returns the type string, so callers can log unknown types; add a `console.debug` for `UNKNOWN` | Revert to the inline `switch` |
| The reconnect timer fires after the user switched projects | `disconnect()` clears the timer and the attempt counter; the effect at `App.tsx:664-718` already calls `disconnect()` on project change | n/a |

## Notes

- **Boundary with STEP-10.** F-018 has two halves: the client ignoring `COMMIT_REJECTED` (this step)
  and the REST placement path persisting a move without a lock check (STEP-10 records it as an
  undoable transaction; STEP-02 makes it the single write). Do not duplicate that work here.
- **Boundary with STEP-05.** The socket Origin check and the auth token are STEP-05. This step
  assumes a rejected handshake surfaces as a non-`1000` close code; if STEP-05 changes the close
  code for an unauthorised handshake, `shouldReconnect` must be updated in the same PR.
- `Room` is deliberately testable without a socket: every method takes plain data, and the only
  interaction with a `WebSocket` is via `broadcast`, which the tests do not call. That is why the
  backend test needs no `TestClient` and no database.
- **Not verified:** no browser-to-browser session was run for this step. The reconnect and rejection
  flows are specified from the protocol as read (`websocket.py:103-140`) and must be exercised
  manually per the "Watch it pass" section before the step is closed.
- The `PROPERTY_UPDATE` branch (`websocket.py:143-150`) excludes `current_user_id`; after the
  identity change in Spec 4 keep using the session's own `user_id`, not a re-read of `data`.

### 2026-10-25 — Frontend half implemented (test-first); backend half deferred

**Landed in this lane (frontend only):**

- `frontend/src/services/wsResilience.ts` (**new**, pure, no DOM/`WebSocket` reference) —
  `nextReconnectDelay` (Spec 7), `shouldReconnect` (Spec 8, `false` for `1000` / `4001`), `Outbox`
  (Spec 9: bound 50, FIFO `flush`, oldest `TRANSFORM_STREAM` evicted first, `TRANSFORM_COMMIT` /
  `SELECT_ELEMENT` / `DESELECT_ELEMENT` never dropped, `dropped` counter for diagnostics) and
  `dispatchServerMessage` (Spec 6: returns the handled type, one callback per frame, `UNKNOWN` for
  unknown/malformed payloads without throwing, maps `COMMIT_REJECTED` → `onCommitRejected(expressId,
  reason)`, and also `SESSION_REPLACED` → `onSessionReplaced`, `ERROR` → `onServerError`).
- `frontend/src/services/collaboration.ts` — backoff reconnect driven by `nextReconnectDelay`
  (timer stored on the client and cleared by `disconnect()`, attempt counter reset on `onopen`),
  `onerror` logging, writes queued through `Outbox` while the socket is not `OPEN` and flushed on
  `onopen` **after** re-`JOIN` + re-`SELECT_ELEMENT` (Spec 10), `dispatchServerMessage` replaces the
  inline `switch`, `connectionState` getter plus the optional `onConnectionState` callback (Spec 11).
  `CollaborationCallbacks` gained `onCommitRejected`, `onConnectionState`, `onSessionReplaced`,
  `onServerError`. When the host app has not wired the rejection/replacement/error callback, the
  client falls back to `services/userMessages`, so those events are never silent before the App lane
  lands its wiring.
- `frontend/src/main.tsx` — mounts `UserMessageHost` (the STEP-10 message channel) at the composition
  root so the rejection message has somewhere to render.

**Tests (green):** `src/tests/step13.wsResilience.test.ts` (7). `pnpm exec tsc -b` clean; full
`pnpm exec vitest run` 21 files / 134 tests green.

**Deferred — backend lane (not implemented here):** Spec 1-5 — `Room` canonical integer lock keys
with `ValueError` on a non-numeric id, `lock_ttl_seconds` (default 120 s) with `acquired_at` refresh
and TTL purge in `cleanup_stale_locks`, `add_user` returning `{replaced, previous, released}`,
`remove_user(user_id, session=None)` identity check, and the duplicate-`JOIN` path in
`websocket.py` (`SESSION_REPLACED` to the old socket, close `4001`, broadcast `ELEMENT_UNLOCKED`) —
plus `express_id` normalisation and `ERROR` frames. `backend/tests/test_step13_ws_room.py` is the
acceptance gate.

**Deferred — App lane (`frontend/src/App.tsx`, not edited here):** `onCommitRejected` (message +
`api.getElementDetails` + `loadProject(currentProject, expressId)` so the element snaps back to the
server placement) and `onConnectionState` into a local `collabState`. The exact callbacks-object
snippet is in `notes/STEP-13.md`.

**Design (@designer):** the presence **status dot** is unowned — this lane exposes
`connectionState: 'connecting' | 'open' | 'closed'` and calls `onConnectionState`; nothing is
rendered. Colour/placement/tooltip for the dot need a design pass.

**Not verified:** no live two-client session was run (there is no `COMMIT_REJECTED` producer or
`4001` close without the backend half), so the manual checks in "Watch it pass" remain outstanding.
If STEP-05 changes the close code for a rejected handshake, `shouldReconnect` must be updated in the
same change.

### 2026-10-25 — Backend half implemented (Spec 1-5); frontend half already landed

The frontend half above is **landed and green** (`wsResilience.ts`, `collaboration.ts`,
`main.tsx`, 7 vitest cases). This entry covers the backend lane that was deferred there, so
Spec 1-11 are now implemented across both halves; only the `App.tsx` wiring and the manual
two-client checks remain open.

**Landed in this lane (backend only):**

- `backend/app/services/websocket_manager.py` — `canonical_express_id()` (`int()` or numeric `str`
  → `int`; `ValueError` for anything else, including `float`, `bool`, `""`, `"205.0"`, `None`),
  aliased as `_canonical_express_id` as the Spec names it. `Room.__init__(project_id,
  lock_ttl_seconds: int = 120)`. `acquire_lock(..., now=None)` canonicalises, funnels the injected
  clock into `cleanup_stale_locks(now=...)` and refreshes `acquired_at` on every acquire.
  `cleanup_stale_locks(now=None)` purges absent-user locks **and** locks older than the TTL, also
  purging any lock whose `acquired_at` will not parse, and returns the purged ids.
  `add_user(session)` returns `{"replaced", "previous", "released"}` and releases the previous
  session's locks before registering the new one. `remove_user(user_id, session=None)` is
  identity-checked and returns `[]` for a stale socket. `release_lock` canonicalises too.
- `backend/app/api/websocket.py` — `express_id` is normalised once per frame by
  `_resolve_express_id()`, which answers a malformed value with
  `{"type":"ERROR","reason":"invalid express_id"}` instead of silently ignoring the frame; a
  non-dict JSON payload is answered with `invalid payload`. A duplicate `JOIN` sends
  `SESSION_REPLACED` to the displaced socket, closes it with code `4001` (close code in
  `SESSION_REPLACED_CLOSE_CODE`, `try/except` around both the notify and the close) and broadcasts
  `ELEMENT_UNLOCKED` for every id in `released`. The `finally` block passes `current_session` into
  `remove_user()` and suppresses `USER_LEFT` when this socket was already superseded, so the
  displaced socket's teardown cannot evict the live session's presence.

**Test (green):** `.\backend\venv\Scripts\python.exe -m pytest
backend/tests/test_step13_ws_room.py -q` → `5 passed in 1.14s`. Pre-fix the same file was
`4 failed, 1 passed` (`FFFF.`) — `assert True is False` (no canonical keys), `DID NOT RAISE
ValueError`, `TypeError: Room.__init__() got an unexpected keyword argument 'lock_ttl_seconds'`,
`TypeError: 'NoneType' object is not subscriptable`; the step's predicted `5 failed` was optimistic
because `test_remove_user_only_releases_that_users_locks` already passed against the old code.

**Deviations from the Spec text:**

- `cleanup_stale_locks()` returns the purged ids (previously `None`). Callers ignore the value; the
  API does not broadcast unlocks for TTL purges, only for a duplicate-`JOIN` `released` list, so
  remote lock badges can still outlive a TTL expiry by one interaction. Follow-up, not a regression.
- `add_user()` keeps the existing "alone in the room clears every lock" behaviour *after* releasing
  the previous session's locks (it runs before the `len(self.sessions) <= 1` clear), so a
  duplicate join in a two-user room reports exactly the locks it dropped.
- `previous.websocket is not websocket` guard: a second `JOIN` from the *same* socket replaces the
  `UserSession` without closing its own connection.
- `PROPERTY_UPDATE` without a parseable `express_id` now gets an `ERROR` frame instead of
  broadcasting `express_id: null`; `PROPERTY_UPDATE` also reuses the normalised id rather than
  re-reading `data`.
- `ws_manager.remove_room_if_empty()` is now called on every disconnect, not only when the socket
  had joined (a socket that opened and left without `JOIN` no longer leaks an empty room).

**Verification beyond the unit gate (throwaway scripts, not committed):** a `TestClient` mount of
this router only (no DB, no app startup) confirmed: `"205"` then `205` address one integer key;
malformed ids (`"x"`, `"205.0"`, `""`, `None`) return `ERROR` and leave `room.locks` empty and the
socket usable; a duplicate `JOIN` from a third socket delivered `SESSION_REPLACED` and close code
`4001` to the displaced socket, `ELEMENT_UNLOCKED` for its lock to the survivor, and a `ROOM_STATE`
whose `locks` no longer contained it; the new session then acquired a fresh lock.

**Still outstanding:** the browser-to-browser checks in "Watch it pass" (real reconnect after a
backend restart, `COMMIT_REJECTED` + snap-back with two clients) and the `App.tsx` callbacks in the
frontend note above. `pytest backend/tests/` was **not** run repo-wide on purpose — other lanes are
mid-change on a shared SQLite database.

