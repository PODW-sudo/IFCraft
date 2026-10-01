import json
import logging
from typing import Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..services.websocket_manager import ws_manager, UserSession
from ..services.ifc_service import IFCService
from ..services.project_service import ProjectService

logger = logging.getLogger("ifc_editor.ws_api")
router = APIRouter(tags=["WebSocket Collaboration"])

@router.websocket("/ws/rooms/{project_id}")
async def project_collaboration_ws(websocket: WebSocket, project_id: str):
    await websocket.accept()
    room = ws_manager.get_or_create_room(project_id)
    current_user_id: str | None = None

    try:
        while True:
            text = await websocket.receive_text()
            try:
                data = json.loads(text)
            except Exception:
                continue

            action = data.get("action")

            # 1. User joins collaborative room
            if action == "JOIN":
                user_id = data.get("user_id")
                user_name = data.get("user_name", "Anonymous Architect")
                user_color = data.get("user_color", "#38bdf8")
                current_user_id = user_id

                session = UserSession(user_id, user_name, user_color, websocket)
                room.add_user(session)

                # Send initial state to the joining user
                await websocket.send_text(json.dumps({
                    "type": "ROOM_STATE",
                    "users": [s.to_dict() for s in room.sessions.values()],
                    "locks": room.locks
                }))

                # Broadcast new user presence to others
                await room.broadcast({
                    "type": "USER_JOINED",
                    "user": session.to_dict()
                }, exclude_user_id=user_id)

            # 2. User selects an element (Request Soft Lock)
            elif action == "SELECT_ELEMENT":
                user_id = data.get("user_id")
                express_id = data.get("express_id")

                if express_id is not None and user_id:
                    acquired = room.acquire_lock(express_id, user_id)
                    if acquired:
                        await room.broadcast({
                            "type": "ELEMENT_LOCKED",
                            "express_id": express_id,
                            "lock": room.locks[express_id]
                        })
                    else:
                        current_holder = room.locks.get(express_id)
                        await websocket.send_text(json.dumps({
                            "type": "LOCK_REJECTED",
                            "express_id": express_id,
                            "held_by": current_holder
                        }))

            # 3. User deselects an element (Release Soft Lock)
            elif action == "DESELECT_ELEMENT":
                user_id = data.get("user_id")
                express_id = data.get("express_id")

                if express_id is not None and user_id:
                    released = room.release_lock(express_id, user_id)
                    if released:
                        await room.broadcast({
                            "type": "ELEMENT_UNLOCKED",
                            "express_id": express_id
                        })

            # 4. Real-time 3D Transform Streaming (Live Drag)
            elif action == "TRANSFORM_STREAM":
                user_id = data.get("user_id")
                express_id = data.get("express_id")
                matrix = data.get("matrix")

                if express_id is not None and matrix:
                    # Broadcast live matrix to all other users in room
                    await room.broadcast({
                        "type": "REMOTE_TRANSFORM_STREAM",
                        "user_id": user_id,
                        "express_id": express_id,
                        "matrix": matrix
                    }, exclude_user_id=user_id)

            # 5. Transform Committed (Drag finished & persisted)
            elif action == "TRANSFORM_COMMIT":
                user_id = data.get("user_id")
                express_id = data.get("express_id")
                matrix = data.get("matrix")

                if express_id is not None and matrix:
                    file_path = ProjectService.get_project_file_path(project_id)
                    try:
                        IFCService.update_element_placement(file_path, express_id, matrix)
                        await ProjectService.record_edit(
                            project_id=project_id,
                            user_id=user_id or "anonymous",
                            user_name=data.get("user_name", "Architect"),
                            action_type="transform",
                            express_id=express_id,
                            entity_type="IfcProduct",
                            payload={"matrix": matrix}
                        )
                        # Broadcast confirmation
                        await room.broadcast({
                            "type": "REMOTE_TRANSFORM_COMMITTED",
                            "user_id": user_id,
                            "express_id": express_id,
                            "matrix": matrix
                        }, exclude_user_id=user_id)
                    except Exception as err:
                        logger.error("Failed to commit transform via WS: %s", err)

            # 6. Property Update Broadcast
            elif action == "PROPERTY_UPDATE":
                await room.broadcast({
                    "type": "REMOTE_PROPERTY_UPDATED",
                    "express_id": data.get("express_id"),
                    "pset_name": data.get("pset_name"),
                    "property_name": data.get("property_name"),
                    "value": data.get("value")
                }, exclude_user_id=current_user_id)

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for user %s in project %s", current_user_id, project_id)
    finally:
        if current_user_id:
            released = room.remove_user(current_user_id)
            for express_id in released:
                await room.broadcast({
                    "type": "ELEMENT_UNLOCKED",
                    "express_id": express_id
                })
            await room.broadcast({
                "type": "USER_LEFT",
                "user_id": current_user_id
            })
            ws_manager.remove_room_if_empty(project_id)
