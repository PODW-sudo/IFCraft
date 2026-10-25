"""STEP-13 — socket-level WS handshake coverage (open issue 3.2).

Findings: F-017, F-018, F-046
Code under test:
  backend/app/api/websocket.py               (JOIN / SESSION_REPLACED / 4001, express_id ERROR,
                                              TTL purge broadcast)
  backend/app/services/websocket_manager.py  (Room)

The room unit tests live in `test_step13_ws_room.py`. This file mounts the collaboration
router on a bare `FastAPI` app (no DB, no project service) and drives real WebSocket frames,
so the wire behaviour is permanent instead of a throwaway probe.

HOW TO RUN
    .\\backend\\venv\\Scripts\\python.exe -m pytest backend/tests/test_step13_ws_handshake.py -v
"""

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.app.api import websocket as websocket_api  # noqa: E402
from backend.app.core.security import issue_session_token  # noqa: E402
from backend.app.services.websocket_manager import ws_manager  # noqa: E402

# A local dev origin is allowed by settings.CORS_ORIGINS; the handshake is checked before
# accept(), so a non-empty Origin proves the normal browser path is exercised.
ORIGIN = "http://localhost:5173"

DUPLICATE_JOIN_ROOM = "proj-step13-dup-join"
BAD_EXPRESS_ID_ROOM = "proj-step13-bad-id"
TTL_PURGE_ROOM = "proj-step13-ttl-purge"


@pytest.fixture()
def client():
    """Mount only the WS router: the handshake paths assume no DB and no project row."""
    app = FastAPI()
    app.include_router(websocket_api.router)
    for project_id in (DUPLICATE_JOIN_ROOM, BAD_EXPRESS_ID_ROOM, TTL_PURGE_ROOM):
        ws_manager.rooms.pop(project_id, None)
    with TestClient(app) as test_client:
        yield test_client
    for project_id in (DUPLICATE_JOIN_ROOM, BAD_EXPRESS_ID_ROOM, TTL_PURGE_ROOM):
        ws_manager.rooms.pop(project_id, None)


def _connect(client: TestClient, project_id: str):
    return client.websocket_connect(
        f"/ws/rooms/{project_id}", headers={"origin": ORIGIN}
    )


def _join(ws, user_id: str) -> dict:
    """JOIN as a *browser* would: the connection carries an Origin, so issue 3.5 requires a
    session token signed for this exact user id."""
    ws.send_text(
        json.dumps(
            {
                "action": "JOIN",
                "user_id": user_id,
                "user_name": user_id,
                "session_token": issue_session_token(user_id),
            }
        )
    )
    state = json.loads(ws.receive_text())
    assert state["type"] == "ROOM_STATE", state
    return state


def test_duplicate_join_replaces_the_displaced_socket(client):
    """Spec 3-5: second JOIN wins; the old socket is told, closed with 4001, its lock freed."""
    with _connect(client, DUPLICATE_JOIN_ROOM) as first:
        _join(first, "u1")
        first.send_text(
            json.dumps({"action": "SELECT_ELEMENT", "user_id": "u1", "express_id": 205})
        )
        locked = json.loads(first.receive_text())
        assert locked["type"] == "ELEMENT_LOCKED", locked
        assert locked["express_id"] == 205

        with _connect(client, DUPLICATE_JOIN_ROOM) as second:
            # The new socket's first frame displaces the old one. The released lock is
            # broadcast before ROOM_STATE, and the new ROOM_STATE must not carry it.
            second.send_text(json.dumps({
                "action": "JOIN",
                "user_id": "u1",
                "user_name": "u1",
                "session_token": issue_session_token("u1")
            }))
            unlocked = json.loads(second.receive_text())
            assert unlocked == {"type": "ELEMENT_UNLOCKED", "express_id": 205}, unlocked
            state = json.loads(second.receive_text())
            assert state["type"] == "ROOM_STATE", state
            assert state["locks"] == {}, state["locks"]

            # The displaced socket gets SESSION_REPLACED, then a final close (4001).
            replaced = json.loads(first.receive_text())
            assert replaced == {"type": "SESSION_REPLACED"}, replaced
            with pytest.raises(WebSocketDisconnect) as excinfo:
                first.receive_text()
            assert excinfo.value.code == websocket_api.SESSION_REPLACED_CLOSE_CODE
            assert websocket_api.SESSION_REPLACED_CLOSE_CODE == 4001

    room = ws_manager.rooms.get(DUPLICATE_JOIN_ROOM)
    if room is not None:
        assert room.locks == {}, room.locks


def test_malformed_express_id_answers_with_an_error_frame(client):
    """`express_id` is normalised per frame; a bad value is answered, not silently dropped."""
    with _connect(client, BAD_EXPRESS_ID_ROOM) as ws:
        _join(ws, "u1")
        ws.send_text(
            json.dumps({"action": "SELECT_ELEMENT", "user_id": "u1", "express_id": "not-an-id"})
        )
        error = json.loads(ws.receive_text())
        assert error == {"type": "ERROR", "reason": "invalid express_id"}, error

        room = ws_manager.get_or_create_room(BAD_EXPRESS_ID_ROOM)
        assert room.locks == {}, f"a malformed id polluted the lock map: {room.locks}"


def test_stale_lock_purge_is_broadcast_on_the_next_frame(client):
    """Issue 3.2: a TTL purge must reach the other clients, not just mutate the room.

    The lock is aged in place instead of sleeping for the 120 s TTL (and instead of a zero
    TTL, which races Windows' coarse clock resolution). One frame that touches the room from
    *another* socket must drop it and broadcast `ELEMENT_UNLOCKED` to every client, so no
    stale lock badge survives without that client interacting.
    """
    with _connect(client, TTL_PURGE_ROOM) as first, _connect(client, TTL_PURGE_ROOM) as second:
        _join(first, "u1")
        _join(second, "u2")
        joined_notice = json.loads(first.receive_text())
        assert joined_notice["type"] == "USER_JOINED", joined_notice
        assert joined_notice["user"]["user_id"] == "u2"

        first.send_text(
            json.dumps({"action": "SELECT_ELEMENT", "user_id": "u1", "express_id": 205})
        )
        assert json.loads(first.receive_text())["type"] == "ELEMENT_LOCKED"
        assert json.loads(second.receive_text())["type"] == "ELEMENT_LOCKED"

        room = ws_manager.get_or_create_room(TTL_PURGE_ROOM)
        room.locks[205]["acquired_at"] = (
            datetime.now(timezone.utc) - timedelta(minutes=10)
        ).isoformat()

        # u2's frame releases nothing of its own, so the only traffic it can cause is the
        # housekeeping broadcast for u1's expired lock.
        second.send_text(
            json.dumps({"action": "DESELECT_ELEMENT", "user_id": "u2", "express_id": 999})
        )

        purged = json.loads(second.receive_text())
        assert purged == {"type": "ELEMENT_UNLOCKED", "express_id": 205}, purged
        # The holder is told as well, so its badge disappears too.
        assert json.loads(first.receive_text()) == purged
        assert room.locks == {}, f"the expired lock survived: {room.locks}"
