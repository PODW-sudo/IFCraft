"""STEP-13 acceptance gate — WebSocket room lock lifecycle and duplicate-session handling.

Findings: F-017, F-018, F-046
Code under test:
  backend/app/services/websocket_manager.py  (Room: canonical lock keys, TTL, add_user/remove_user)
  backend/app/api/websocket.py               (duplicate JOIN -> SESSION_REPLACED + close 4001)

No DB, no socket, no TestClient: Room is a plain Python class.

HOW TO RUN
    .\\backend\\venv\\Scripts\\python.exe -m pytest backend/tests/test_step13_ws_room.py -v
"""

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
