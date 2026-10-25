"""Open issues 3.3 (WS heartbeat) and 3.5 (signed session identity).

Findings: F-017, F-018, F-046 (STEP-13 follow-ups), audit 2026-10 §3.

Code under test:
  backend/app/core/security.py               (issue_session_token / verify_session_token)
  backend/app/api/bootstrap.py               (POST /api/bootstrap/session, 422 on a bad id)
  backend/app/api/websocket.py               (JOIN token gate -> ERROR + 1008)
  backend/app/services/ws_heartbeat.py       (PING cadence, idle close 1001)

No DB and no real waiting:
  * the socket tests mount only the collaboration router, like `test_step13_ws_handshake.py`;
  * the heartbeat test injects a fake monotonic clock and a fake sleep, so the 25 s / 60 s
    production timings are asserted in microseconds.

HOW TO RUN
    .\\backend\\venv\\Scripts\\python.exe -m pytest backend/tests/test_ws_session.py -v
"""

import asyncio
import json
import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.app.api import websocket as websocket_api  # noqa: E402
from backend.app.core.config import settings  # noqa: E402
from backend.app.core.security import (  # noqa: E402
    issue_session_token,
    session_token_expires_at,
    verify_session_token,
)
from backend.app.services.websocket_manager import ws_manager  # noqa: E402
from backend.app.services.ws_heartbeat import IDLE_CLOSE_CODE, SocketHeartbeat  # noqa: E402

ORIGIN = "http://localhost:5173"
ROOM = "proj-ws-session"
HEARTBEAT_ROOM = "proj-ws-heartbeat"


# ---------------------------------------------------------------------------------------------
# 3.5 — token format and verification
# ---------------------------------------------------------------------------------------------


def test_token_roundtrip_and_format():
    """`payload.signature`, base64url, unpadded — and it verifies for its own user id only."""
    token = issue_session_token("arch-001")

    assert token.count(".") == 1, f"unexpected token shape: {token!r}"
    payload_segment, signature_segment = token.split(".")
    for segment in (payload_segment, signature_segment):
        assert segment and "=" not in segment, f"segment is not unpadded base64url: {segment!r}"
        assert all(char.isalnum() or char in "-_" for char in segment), segment

    assert verify_session_token(token, "arch-001") is True
    assert verify_session_token(token, "arch-002") is False
    assert verify_session_token(token, "") is False
    assert verify_session_token(token, None) is False


def test_payload_carries_the_user_id_and_expiry():
    import base64

    issued_at = 1_700_000_000
    token = issue_session_token("arch-001", now=issued_at)
    payload = token.split(".")[0]
    decoded = base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)).decode()

    assert decoded == f"arch-001:{issued_at + settings.SESSION_TOKEN_TTL_SECONDS}"
    assert session_token_expires_at(issued_at) == issued_at + settings.SESSION_TOKEN_TTL_SECONDS


def test_tampered_tokens_are_rejected():
    """Flipping a payload byte or a signature byte must not verify."""
    token = issue_session_token("arch-001")
    payload, signature = token.split(".")

    def flip(segment: str, index: int) -> str:
        chars = list(segment)
        chars[index] = "A" if chars[index] != "A" else "B"
        return "".join(chars)

    assert verify_session_token(f"{flip(payload, 0)}.{signature}", "arch-001") is False
    assert verify_session_token(f"{payload}.{flip(signature, 0)}", "arch-001") is False
    assert verify_session_token(payload, "arch-001") is False          # no signature at all
    assert verify_session_token(f"{payload}.{signature}.extra", "arch-001") is False
    assert verify_session_token("not-a-token", "arch-001") is False
    assert verify_session_token("", "arch-001") is False
    assert verify_session_token(None, "arch-001") is False


def test_expiry_is_enforced_server_side():
    issued_at = 1_700_000_000
    ttl = settings.SESSION_TOKEN_TTL_SECONDS
    token = issue_session_token("arch-001", now=issued_at)

    assert verify_session_token(token, "arch-001", now=issued_at) is True
    assert verify_session_token(token, "arch-001", now=issued_at + ttl - 1) is True
    assert verify_session_token(token, "arch-001", now=issued_at + ttl) is False
    assert verify_session_token(token, "arch-001", now=issued_at + ttl + 3_600) is False


def test_an_empty_user_id_cannot_be_signed():
    with pytest.raises(ValueError):
        issue_session_token("")
    with pytest.raises(ValueError):
        issue_session_token("   ")


def test_a_user_id_containing_a_colon_still_verifies():
    """The expiry is the last field, so a colon in the id must not confuse the parser."""
    token = issue_session_token("team:arch-001")
    assert verify_session_token(token, "team:arch:001") is False
    assert verify_session_token(token, "team:arch-001") is True


# ---------------------------------------------------------------------------------------------
# 3.5 — bootstrap route
# ---------------------------------------------------------------------------------------------


@pytest.fixture()
def api_client():
    """Full app: the bootstrap router lives under /api and is mounted in `main.py`."""
    from backend.app.main import app

    with TestClient(app) as client:
        yield client


def test_bootstrap_session_issues_a_verifiable_token(api_client):
    resp = api_client.post(
        "/api/bootstrap/session",
        json={"user_id": "arch-001"},
        headers={"Origin": ORIGIN},
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["user_id"] == "arch-001"
    assert isinstance(body["expires_at"], int)
    assert body["expires_at"] > 0
    assert verify_session_token(body["session_token"], "arch-001") is True
    assert verify_session_token(body["session_token"], "arch-002") is False


def test_bootstrap_session_refuses_a_foreign_origin(api_client):
    resp = api_client.post(
        "/api/bootstrap/session",
        json={"user_id": "arch-001"},
        headers={"Origin": "https://evil.example.com"},
    )
    assert resp.status_code == 403, resp.text
    assert "session_token" not in resp.text


@pytest.mark.parametrize("user_id", ["", "   ", "x" * 129])
def test_bootstrap_session_rejects_empty_or_oversized_user_ids(api_client, user_id):
    resp = api_client.post(
        "/api/bootstrap/session",
        json={"user_id": user_id},
        headers={"Origin": ORIGIN},
    )
    assert resp.status_code == 422, f"{user_id!r} was accepted: {resp.status_code} {resp.text}"


def test_bootstrap_session_accepts_the_maximum_length(api_client):
    user_id = "x" * settings.MAX_SESSION_USER_ID_LENGTH
    resp = api_client.post(
        "/api/bootstrap/session",
        json={"user_id": user_id},
        headers={"Origin": ORIGIN},
    )
    assert resp.status_code == 200, resp.text
    assert verify_session_token(resp.json()["session_token"], user_id) is True


# ---------------------------------------------------------------------------------------------
# 3.5 — the WS JOIN gate
# ---------------------------------------------------------------------------------------------


@pytest.fixture()
def ws_client():
    """Mount only the collaboration router: the JOIN paths assume no DB and no project row."""
    app = FastAPI()
    app.include_router(websocket_api.router)
    for project_id in (ROOM, HEARTBEAT_ROOM):
        ws_manager.rooms.pop(project_id, None)
    with TestClient(app) as client:
        yield client
    for project_id in (ROOM, HEARTBEAT_ROOM):
        ws_manager.rooms.pop(project_id, None)


def _expect_error_and_1008(ws) -> dict:
    error = json.loads(ws.receive_text())
    assert error == {"type": "ERROR", "reason": "invalid session token"}, error
    with pytest.raises(WebSocketDisconnect) as excinfo:
        # Anything but a clean close means the server kept the socket open instead.
        for _ in range(5):
            ws.receive_text()
    assert excinfo.value.code == 1008, excinfo.value
    return error


def test_join_without_a_token_is_refused_for_browsers(ws_client):
    with ws_client.websocket_connect(
        f"/ws/rooms/{ROOM}", headers={"origin": ORIGIN}
    ) as ws:
        ws.send_text(json.dumps({"action": "JOIN", "user_id": "u1", "user_name": "u1"}))
        _expect_error_and_1008(ws)

    room = ws_manager.rooms.get(ROOM)
    assert room is None or room.sessions == {}, (
        f"a refused JOIN still registered a session: {getattr(room, 'sessions', None)}"
    )


def test_join_with_an_invalid_token_is_refused(ws_client):
    with ws_client.websocket_connect(
        f"/ws/rooms/{ROOM}", headers={"origin": ORIGIN}
    ) as ws:
        ws.send_text(
            json.dumps({"action": "JOIN", "user_id": "u1", "session_token": "forged.token"})
        )
        _expect_error_and_1008(ws)


def test_join_with_another_users_token_is_refused(ws_client):
    other_users_token = issue_session_token("u2")
    with ws_client.websocket_connect(
        f"/ws/rooms/{ROOM}", headers={"origin": ORIGIN}
    ) as ws:
        ws.send_text(
            json.dumps({"action": "JOIN", "user_id": "u1", "session_token": other_users_token})
        )
        _expect_error_and_1008(ws)


def test_join_with_a_valid_token_is_accepted(ws_client):
    with ws_client.websocket_connect(
        f"/ws/rooms/{ROOM}", headers={"origin": ORIGIN}
    ) as ws:
        ws.send_text(
            json.dumps(
                {
                    "action": "JOIN",
                    "user_id": "u1",
                    "user_name": "Architect One",
                    "session_token": issue_session_token("u1"),
                }
            )
        )
        state = json.loads(ws.receive_text())
        assert state["type"] == "ROOM_STATE", state
        assert [user["user_id"] for user in state["users"]] == ["u1"]


def test_join_without_an_origin_keeps_the_old_behaviour(ws_client):
    """The QA runner and TestClient send no Origin; they must keep working without a token."""
    with ws_client.websocket_connect(f"/ws/rooms/{ROOM}") as ws:
        ws.send_text(json.dumps({"action": "JOIN", "user_id": "harness-user"}))
        state = json.loads(ws.receive_text())
        assert state["type"] == "ROOM_STATE", state
        assert [user["user_id"] for user in state["users"]] == ["harness-user"]


def test_a_joined_session_cannot_impersonate_another_user(ws_client):
    """Issue 3.5: locks are keyed by the JOIN identity, not by a later frame's `user_id`."""
    with ws_client.websocket_connect(
        f"/ws/rooms/{ROOM}", headers={"origin": ORIGIN}
    ) as ws:
        ws.send_text(
            json.dumps(
                {
                    "action": "JOIN",
                    "user_id": "u1",
                    "session_token": issue_session_token("u1"),
                }
            )
        )
        assert json.loads(ws.receive_text())["type"] == "ROOM_STATE"

        ws.send_text(json.dumps({"action": "SELECT_ELEMENT", "user_id": "u2", "express_id": 205}))
        locked = json.loads(ws.receive_text())
        assert locked["type"] == "ELEMENT_LOCKED", locked
        assert locked["lock"]["user_id"] == "u1", locked


# ---------------------------------------------------------------------------------------------
# 3.3 — heartbeat (injected clock: no real waiting)
# ---------------------------------------------------------------------------------------------


class FakeClock:
    """Monotonic clock whose `sleep` advances it — the heartbeat's only source of time."""

    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now

    async def sleep(self, seconds: float) -> None:
        self.now += seconds


class FakeWebSocket:
    def __init__(self) -> None:
        self.sent: list[dict] = []
        self.close_code: int | None = None

    async def send_text(self, payload: str) -> None:
        self.sent.append(json.loads(payload))

    async def close(self, code: int = 1000) -> None:
        self.close_code = code


def test_heartbeat_pings_on_interval_and_does_not_refresh_itself():
    clock = FakeClock()
    ws = FakeWebSocket()
    beat = SocketHeartbeat(ws, ping_interval=25, idle_timeout=60, clock=clock, sleep=clock.sleep)

    assert beat.tick_seconds() == 6.25
    asyncio.run(beat.run(max_ticks=5))  # 5 * 6.25 s = 31.25 s

    assert beat.pings_sent == 1, ws.sent
    assert ws.sent[0]["type"] == "PING"
    assert isinstance(ws.sent[0]["ts"], int)
    assert ws.close_code is None, "a pinging socket must not be closed while it answers"
    # A PING was sent at t=25 and nothing came back: the socket is still ageing.
    assert beat.idle_for == pytest.approx(31.25)


def test_heartbeat_closes_with_1001_when_nothing_is_received():
    clock = FakeClock()
    ws = FakeWebSocket()
    beat = SocketHeartbeat(ws, ping_interval=25, idle_timeout=60, clock=clock, sleep=clock.sleep)

    asyncio.run(beat.run(max_ticks=20))  # 125 s of silence

    assert beat.closed_for_idle is True
    assert ws.close_code == IDLE_CLOSE_CODE == 1001
    # PINGs went out at 25 s and 50 s; the close happened on the first tick past 60 s.
    assert beat.idle_for == pytest.approx(62.5)
    assert [frame["type"] for frame in ws.sent] == ["PING", "PING"]


def test_touch_resets_the_idle_window():
    clock = FakeClock()
    ws = FakeWebSocket()
    beat = SocketHeartbeat(ws, ping_interval=25, idle_timeout=60, clock=clock, sleep=clock.sleep)

    asyncio.run(beat.run(max_ticks=8))  # 50 s
    assert ws.close_code is None

    beat.touch()  # a PONG / any frame arrives
    asyncio.run(beat.run(max_ticks=4))  # +25 s → 25 s idle
    assert ws.close_code is None, "activity must reset the idle deadline"

    asyncio.run(beat.run(max_ticks=8))  # +50 s → 75 s idle
    assert ws.close_code == 1001


# ---------------------------------------------------------------------------------------------
# 3.3 — heartbeat wired into the socket (short intervals, still no 25 s wait)
# ---------------------------------------------------------------------------------------------


def test_idle_socket_is_closed_by_the_server(ws_client, monkeypatch):
    monkeypatch.setattr(settings, "WS_PING_INTERVAL_SECONDS", 0.05)
    monkeypatch.setattr(settings, "WS_IDLE_TIMEOUT_SECONDS", 0.5)

    with ws_client.websocket_connect(f"/ws/rooms/{HEARTBEAT_ROOM}") as ws:
        ws.send_text(json.dumps({"action": "JOIN", "user_id": "idle-user"}))
        assert json.loads(ws.receive_text())["type"] == "ROOM_STATE"

        first = json.loads(ws.receive_text())
        assert first["type"] == "PING", first

        with pytest.raises(WebSocketDisconnect) as excinfo:
            # Never answer a PING: the server must give up on its own.
            for _ in range(100):
                ws.receive_text()
        assert excinfo.value.code == 1001, excinfo.value

    room = ws_manager.rooms.get(HEARTBEAT_ROOM)
    assert room is None or room.sessions == {}, (
        f"the idle session was not released: {getattr(room, 'sessions', None)}"
    )


def test_a_joined_socket_answers_pings_and_survives(ws_client, monkeypatch):
    """A client that answers PING with PONG keeps its session well past the idle timeout."""
    monkeypatch.setattr(settings, "WS_PING_INTERVAL_SECONDS", 0.05)
    monkeypatch.setattr(settings, "WS_IDLE_TIMEOUT_SECONDS", 0.3)

    with ws_client.websocket_connect(f"/ws/rooms/{HEARTBEAT_ROOM}") as ws:
        ws.send_text(json.dumps({"action": "JOIN", "user_id": "live-user"}))
        assert json.loads(ws.receive_text())["type"] == "ROOM_STATE"

        answered = 0
        for _ in range(6):
            frame = json.loads(ws.receive_text())
            assert frame["type"] == "PING", frame
            ws.send_text(json.dumps({"type": "PONG", "ts": frame["ts"]}))
            answered += 1

        assert answered == 6
        room = ws_manager.rooms.get(HEARTBEAT_ROOM)
        assert room is not None and "live-user" in room.sessions
