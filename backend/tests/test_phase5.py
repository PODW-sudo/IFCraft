import sys
from pathlib import Path

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

import json
from starlette.testclient import TestClient
from backend.app.main import app

def test_phase5_realtime_collaboration():
    with TestClient(app) as client:
        # 1. Create a project via REST API
        create_res = client.post("/api/projects", json={
            "name": "Phase 5 Collab Project",
            "schema_version": "IFC4"
        })
        assert create_res.status_code == 201, f"Failed to create project: {create_res.text}"
        project = create_res.json()
        project_id = project["id"]

        # 2. Open two simultaneous WebSocket sessions
        with client.websocket_connect(f"/ws/rooms/{project_id}") as ws1:
            with client.websocket_connect(f"/ws/rooms/{project_id}") as ws2:
                # Client 1 joins
                ws1.send_text(json.dumps({
                    "action": "JOIN",
                    "user_id": "user-alice",
                    "user_name": "Alice Architect",
                    "user_color": "#38bdf8"
                }))
                res1 = json.loads(ws1.receive_text())
                assert res1["type"] == "ROOM_STATE"
                assert len(res1["users"]) == 1
                print("\n[PASS] Alice joined room, received initial ROOM_STATE.")

                # Client 2 joins
                ws2.send_text(json.dumps({
                    "action": "JOIN",
                    "user_id": "user-bob",
                    "user_name": "Bob Engineer",
                    "user_color": "#f59e0b"
                }))
                res2 = json.loads(ws2.receive_text())
                assert res2["type"] == "ROOM_STATE"
                assert len(res2["users"]) == 2

                # Client 1 should receive USER_JOINED notification for Bob
                broadcast_to_alice = json.loads(ws1.receive_text())
                assert broadcast_to_alice["type"] == "USER_JOINED"
                assert broadcast_to_alice["user"]["user_id"] == "user-bob"
                print("[PASS] Alice received USER_JOINED broadcast for Bob.")

                # 3. Soft Lock: Alice selects element #21
                ws1.send_text(json.dumps({
                    "action": "SELECT_ELEMENT",
                    "user_id": "user-alice",
                    "express_id": 21
                }))
                lock_msg1 = json.loads(ws1.receive_text())
                assert lock_msg1["type"] == "ELEMENT_LOCKED"
                assert lock_msg1["express_id"] == 21
                assert lock_msg1["lock"]["user_id"] == "user-alice"

                lock_msg2 = json.loads(ws2.receive_text())
                assert lock_msg2["type"] == "ELEMENT_LOCKED"
                assert lock_msg2["express_id"] == 21
                print("[PASS] Both clients received ELEMENT_LOCKED for #21 held by Alice.")

                # 4. Concurrency Conflict: Bob attempts to grab #21
                ws2.send_text(json.dumps({
                    "action": "SELECT_ELEMENT",
                    "user_id": "user-bob",
                    "express_id": 21
                }))
                reject_msg = json.loads(ws2.receive_text())
                assert reject_msg["type"] == "LOCK_REJECTED"
                assert reject_msg["express_id"] == 21
                assert reject_msg["held_by"]["user_id"] == "user-alice"
                print("[PASS] Bob received LOCK_REJECTED because Alice holds the soft lock.")

                # 5. Live Transform Stream: Alice moves element #21
                test_matrix = [
                    1.0, 0.0, 0.0, 0.0,
                    0.0, 1.0, 0.0, 0.0,
                    0.0, 0.0, 1.0, 0.0,
                    5.0, 2.0, 8.0, 1.0
                ]
                ws1.send_text(json.dumps({
                    "action": "TRANSFORM_STREAM",
                    "user_id": "user-alice",
                    "express_id": 21,
                    "matrix": test_matrix
                }))
                stream_msg = json.loads(ws2.receive_text())
                assert stream_msg["type"] == "REMOTE_TRANSFORM_STREAM"
                assert stream_msg["express_id"] == 21
                assert stream_msg["matrix"] == test_matrix
                print("[PASS] Bob received 60fps REMOTE_TRANSFORM_STREAM update from Alice.")

                # 6. Transform Commit: Alice completes transform
                ws1.send_text(json.dumps({
                    "action": "TRANSFORM_COMMIT",
                    "user_id": "user-alice",
                    "user_name": "Alice Architect",
                    "express_id": 21,
                    "matrix": test_matrix
                }))
                commit_msg = json.loads(ws2.receive_text())
                assert commit_msg["type"] == "REMOTE_TRANSFORM_COMMITTED"
                assert commit_msg["express_id"] == 21
                print("[PASS] Bob received REMOTE_TRANSFORM_COMMITTED from Alice.")

                # 7. Lock Release: Alice deselects #21
                ws1.send_text(json.dumps({
                    "action": "DESELECT_ELEMENT",
                    "user_id": "user-alice",
                    "express_id": 21
                }))
                unlock1 = json.loads(ws1.receive_text())
                unlock2 = json.loads(ws2.receive_text())
                assert unlock1["type"] == "ELEMENT_UNLOCKED"
                assert unlock2["type"] == "ELEMENT_UNLOCKED"
                print("[PASS] Both clients received ELEMENT_UNLOCKED after Alice deselected.")

                # 8. Bob now successfully acquires lock on #21
                ws2.send_text(json.dumps({
                    "action": "SELECT_ELEMENT",
                    "user_id": "user-bob",
                    "express_id": 21
                }))
                bob_lock = json.loads(ws2.receive_text())
                assert bob_lock["type"] == "ELEMENT_LOCKED"
                assert bob_lock["lock"]["user_id"] == "user-bob"
                print("[PASS] Bob successfully acquired lock on #21 after release.")

        # Cleanup project
        del_res = client.delete(f"/api/projects/{project_id}")
        assert del_res.status_code == 204
        print("[PASS] Phase 5 collaboration test completed and cleaned up.")

if __name__ == "__main__":
    test_phase5_realtime_collaboration()
