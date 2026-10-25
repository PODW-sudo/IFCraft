"""Two-client collaboration contract (open issue 4.2).

The QA harness can only drive one browser page, so the cross-client behaviour is pinned here at
the wire level: two real WebSocket connections on the same room, one holds a soft lock, and the
other is refused a lock and a transform commit. A commit on an unlocked element still succeeds and
is broadcast to the peer.

No Origin header is sent, so the signed-session gate (browser-only) does not apply; the API token
comes from the tests/conftest.py TestClient patch.
"""

from __future__ import annotations

import json

import pytest
from starlette.testclient import TestClient

from backend.app.main import app


def _recv_until(ws, message_type: str, limit: int = 20) -> dict:
    for _ in range(limit):
        frame = json.loads(ws.receive_text())
        if frame.get("type") == message_type:
            return frame
    raise AssertionError(f"did not receive {message_type}")


def _join(ws, user_id: str, user_name: str):
    ws.send_text(json.dumps({
        "action": "JOIN",
        "user_id": user_id,
        "user_name": user_name,
        "user_color": "#22d3ee",
    }))
    return _recv_until(ws, "ROOM_STATE")


@pytest.fixture()
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="module")
def project() -> str:
    with TestClient(app) as own_client:
        res = own_client.post("/api/projects/samples/office_pavilion/load")
        assert res.status_code == 201, res.text
        project_id = res.json()["id"]
        yield project_id
        own_client.delete(f"/api/projects/{project_id}")


@pytest.fixture()
def products(client: TestClient, project: str) -> list[int]:
    return _product_ids(client, project, 2)


def _product_ids(client: TestClient, project_id: str, count: int) -> list[int]:
    tree = client.get(f"/api/projects/{project_id}/spatial-tree")
    assert tree.status_code == 200, tree.text
    found: list[int] = []

    def walk(node):
        if node.get("type") not in (
            "IfcProject",
            "IfcSite",
            "IfcBuilding",
            "IfcBuildingStorey",
        ):
            found.append(node["express_id"])
        for child in node.get("children") or []:
            walk(child)

    walk(tree.json())
    assert len(found) >= count, f"expected {count} products, found {found}"
    return found[:count]


def test_lock_and_commit_are_arbitrated_between_two_clients(
    client: TestClient, project: str, products: list[int]
):
    express_id, other_id = products

    with client.websocket_connect(f"/ws/rooms/{project}") as alice, \
            client.websocket_connect(f"/ws/rooms/{project}") as bob:
        _join(alice, "user-alice", "Alice")
        _join(bob, "user-bob", "Bob")

        # Alice takes the soft lock.
        alice.send_text(json.dumps({"action": "SELECT_ELEMENT", "express_id": express_id}))
        locked = _recv_until(alice, "ELEMENT_LOCKED")
        assert locked["express_id"] == express_id
        assert locked["lock"]["user_id"] == "user-alice"
        # Bob sees the same broadcast.
        assert _recv_until(bob, "ELEMENT_LOCKED")["lock"]["user_id"] == "user-alice"

        # Bob cannot take it, and cannot commit over it.
        bob.send_text(json.dumps({"action": "SELECT_ELEMENT", "express_id": express_id}))
        rejected = _recv_until(bob, "LOCK_REJECTED")
        assert rejected["held_by"]["user_id"] == "user-alice"

        identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        bob.send_text(json.dumps({
            "action": "TRANSFORM_COMMIT",
            "express_id": express_id,
            "matrix": identity,
            "user_id": "user-alice",  # spoof attempt: must be ignored in favour of the socket identity
        }))
        commit_rejected = _recv_until(bob, "COMMIT_REJECTED")
        assert commit_rejected["express_id"] == express_id

        # An unlocked element commits normally and is broadcast to the peer.
        alice.send_text(json.dumps({"action": "DESELECT_ELEMENT", "express_id": express_id}))
        _recv_until(bob, "ELEMENT_UNLOCKED")

        bob.send_text(json.dumps({
            "action": "TRANSFORM_COMMIT",
            "express_id": other_id,
            "matrix": [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0.25, 0, 0, 1],
        }))
        remote = _recv_until(alice, "REMOTE_TRANSFORM_COMMITTED")
        assert remote["express_id"] == other_id
        assert remote["user_id"] == "user-bob"


def test_commit_from_a_user_who_does_not_hold_the_lock_is_rejected(
    client: TestClient, project: str, products: list[int]
):
    express_id = products[0]
    with client.websocket_connect(f"/ws/rooms/{project}") as alice, \
            client.websocket_connect(f"/ws/rooms/{project}") as bob:
        _join(alice, "user-alice", "Alice")
        _join(bob, "user-bob", "Bob")

        alice.send_text(json.dumps({"action": "SELECT_ELEMENT", "express_id": express_id}))
        _recv_until(bob, "ELEMENT_LOCKED")

        bob.send_text(json.dumps({
            "action": "TRANSFORM_COMMIT",
            "express_id": express_id,
            "matrix": [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        }))
        assert _recv_until(bob, "COMMIT_REJECTED")["express_id"] == express_id
