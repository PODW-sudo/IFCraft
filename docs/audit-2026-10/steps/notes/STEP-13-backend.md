# STEP-13 — handoff fragments (backend lane, 2026-10-25)

Scope owned by this lane: `backend/app/services/websocket_manager.py`,
`backend/app/api/websocket.py`, `backend/tests/test_step13_ws_room.py`.

**Not** owned (still open): `frontend/src/App.tsx` wiring (`onCommitRejected`,
`onConnectionState`) and the manual two-client checks. The frontend half
(`wsResilience.ts`, `collaboration.ts`, `main.tsx`) is **already landed** — see
`notes/STEP-13.md`.

---

## 2026-10-25 - Lock keys were unnormalised, locks never expired, and a duplicate session orphaned its locks

- **Type:** Bug
- **Platform:** http://localhost:8000 (WS `/ws/rooms/{project_id}`)
- **Related tests:** TC-065, TC-C112-A
- **Severity:** P1
- **Observed:** `room.locks` was keyed by whatever the client sent, so `"205"` and `205` were two
  different elements and two users could hold the "same" element. `cleanup_stale_locks()` only
  purged locks whose holder had left, so a client holding a socket open kept a lock forever.
  `add_user()` did `self.sessions[user_id] = session`, silently replacing a live session without
  closing it or releasing its locks, and `remove_user(user_id)` had no identity check — the *old*
  socket's `finally` block therefore evicted the new session and released its locks.
  `websocket.py` used `express_id` verbatim and ignored malformed ids without a reply.
- **Expected:** Spec 1-5 — canonical integer lock keys, a 120 s TTL with refresh on acquire,
  `add_user()` reporting `{replaced, previous, released}`, identity-checked `remove_user()`, and a
  duplicate `JOIN` that tells the old socket (`SESSION_REPLACED`), closes it with `4001` and
  broadcasts `ELEMENT_UNLOCKED` for the released ids.
- **Evidence:** `backend/tests/test_step13_ws_room.py` — pre-fix `FFFF.` (4 failed, 1 passed:
  `assert True is False`, `DID NOT RAISE ValueError`, `TypeError: Room.__init__() got an unexpected
  keyword argument 'lock_ttl_seconds'`, `TypeError: 'NoneType' object is not subscriptable`), post-fix
  `5 passed in 1.14s`. A `TestClient` mount of the router alone (no DB) confirmed the duplicate-JOIN
  wire behaviour: `SESSION_REPLACED` then close code `4001` on the displaced socket,
  `ELEMENT_UNLOCKED` for its lock, and a `ROOM_STATE` without that lock.
- **Suggested fix (delivered):** `canonical_express_id()` + `_canonical_express_id` alias;
  `Room(project_id, lock_ttl_seconds=120)`; `acquire_lock(express_id, user_id, now=None)` refreshing
  `acquired_at` and feeding `now` into `cleanup_stale_locks()`; TTL + absent-user + unparseable
  timestamp purge in `cleanup_stale_locks(now=None)`; `add_user()` releasing the previous session's
  locks before insert; `remove_user(user_id, session=None)` identity check; `websocket.py`
  normalising `express_id` once per frame (`ERROR` / `invalid express_id` on failure) and the
  duplicate-`JOIN` close path (`SESSION_REPLACED_CLOSE_CODE = 4001`).
- **Status:** Implemented (backend). Manual browser checks and `App.tsx` remain open.

---

## 2026-10-25 - A replaced socket's teardown could evict the live session's presence

- **Type:** Bug
- **Platform:** http://localhost:8000
- **Related tests:** TC-065
- **Severity:** P2
- **Observed:** After a duplicate `JOIN`, the displaced socket's `finally` block still ran
  `remove_user(current_user_id)` and broadcast `USER_LEFT` for the user id, even though a newer
  session was live in the room. The identity check protects the session and its locks, but the
  presence broadcast still told every other client the user had left.
- **Expected:** Only the socket that still owns the session announces `USER_LEFT`.
- **Evidence:** `backend/app/api/websocket.py` `finally` block; `superseded` is computed as
  `room.sessions.get(current_user_id) is not current_session` before the removal and skips
  `USER_LEFT`. Covered indirectly by
  `test_duplicate_user_id_replaces_and_releases_instead_of_orphaning` (the session object survives a
  stale `remove_user`).
- **Suggested fix (delivered):** as above; `ws_manager.remove_room_if_empty()` is also called on
  every disconnect now, so a socket that leaves before `JOIN` no longer leaks an empty room.
- **Status:** Implemented (backend)

---

## 2026-10-25 - Duplicate-JOIN and TTL paths have no automated wire-level coverage; browser checks outstanding

- **Type:** Testability
- **Platform:** http://localhost:8000
- **Related tests:** TC-065, TC-C112-A
- **Severity:** P2
- **Observed:** `backend/tests/test_step13_ws_room.py` exercises `Room` directly (no socket), so
  the `SESSION_REPLACED` / `4001` / `ELEMENT_UNLOCKED` wiring in `websocket.py` and the
  `express_id` → `ERROR` path have no permanent test. The throwaway `TestClient` probes used while
  implementing this lane were not committed. The TTL purge is also not broadcast, so a remote client
  can keep a stale lock badge until its next interaction.
- **Expected:** A committed `TestClient`-based test for the duplicate-JOIN handshake (it needs no DB:
  mount only this router, as the probes did), and either a broadcast of TTL purges or a client-side
  expiry hint.
- **Evidence:** probes described in the step document's 2026-10-25 backend note; `pytest
  backend/tests/test_step13_ws_room.py -q` → 5 passed.
- **Suggested fix:** promote the probe into `backend/tests/test_step13_ws_room.py` (a `TestClient`
  section) once the shared SQLite contention from the parallel lanes settles; have
  `SELECT_ELEMENT` broadcast `ELEMENT_UNLOCKED` for ids returned by `cleanup_stale_locks()`.
- **Status:** Open

---

## 2026-10-25 - Repo-wide backend suite not run (shared SQLite, parallel lanes)

- **Type:** Testability
- **Platform:** http://localhost:8000
- **Related tests:** n/a
- **Severity:** P3
- **Observed:** `pytest backend/tests/` was deliberately not executed from this lane: other steps are
  mid-change against the same `storage/` SQLite database, and concurrent runs contend. Only
  `backend/tests/test_step13_ws_room.py` was run (twice at most).
- **Expected:** The full backend suite (including `test_phase5.py`) passes once the parallel lanes
  are merged.
- **Evidence:** `git status` shows other lanes' modifications to `project_service.py`,
  `ifc_service.py`, `cad_service.py`, `schemas.py` and the `projects.py`/`cad.py`/`federation.py`
  APIs while this lane ran.
- **Suggested fix:** run `.\backend\venv\Scripts\python.exe -m pytest backend/tests/ -q` at the
  integration gate, before STEP-19.
- **Status:** Open
