import json
import logging
from typing import Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..services.websocket_manager import ws_manager, UserSession, canonical_express_id
from ..services.ifc_service import IFCService
from ..services.project_service import ProjectService
from ..services.atomic_store import project_write_lock
from ..core.config import settings
from ..core.workers import run_ifc

logger = logging.getLogger("ifc_editor.ws_api")
router = APIRouter(tags=["WebSocket Collaboration"])

# Client-side `shouldReconnect` treats this code as final: the session was replaced by a
# newer socket (another tab / a reconnect that superseded this one).
SESSION_REPLACED_CLOSE_CODE = 4001

# STEP-05 / F-003 spec 5: a handshake from a foreign Origin is refused with "policy violation".
FOREIGN_ORIGIN_CLOSE_CODE = 1008


async def _send_error(websocket: WebSocket, reason: str) -> None:
    await websocket.send_text(json.dumps({"type": "ERROR", "reason": reason}))


async def _resolve_express_id(websocket: WebSocket, data: dict[str, Any]) -> int | None:
    """Normalise ``express_id`` once per frame; answer a malformed value with an ERROR frame."""
    try:
        return canonical_express_id(data.get("express_id"))
    except ValueError:
        await _send_error(websocket, "invalid express_id")
        return None


@router.websocket("/ws/rooms/{project_id}")
async def project_collaboration_ws(websocket: WebSocket, project_id: str):
    # STEP-05 / F-003: validate the Origin BEFORE accept(). Previously the socket was accepted
    # first, so any website the architect had open could connect to ws://localhost:8000 and
    # write to the model file with TRANSFORM_COMMIT. A missing Origin is allowed (CLI clients,
    # the QA runner); a present-but-unknown one is refused.
    origin = websocket.headers.get("origin")
    if origin and origin not in settings.CORS_ORIGINS:
        logger.warning(
            "Rejected WebSocket handshake for project %s from origin %s", project_id, origin
        )
        await websocket.close(code=FOREIGN_ORIGIN_CLOSE_CODE)
        return

    await websocket.accept()
    room = ws_manager.get_or_create_room(project_id)
    current_user_id: str | None = None
    current_session: UserSession | None = None

    try:
        while True:
            text = await websocket.receive_text()
            try:
                data = json.loads(text)
            except Exception:
                continue

            if not isinstance(data, dict):
                await _send_error(websocket, "invalid payload")
                continue

            action = data.get("action")

            # 1. User joins collaborative room
            if action == "JOIN":
                user_id = data.get("user_id")
                user_name = data.get("user_name", "Anonymous Architect")
                user_color = data.get("user_color", "#38bdf8")
                current_user_id = user_id

                session = UserSession(user_id, user_name, user_color, websocket)
                outcome = room.add_user(session)
                current_session = session

                previous = outcome["previous"]
                if outcome["replaced"] and previous is not None and previous.websocket is not websocket:
                    # The newest socket wins: tell the displaced socket, then close it so its
                    # client stops retrying (close code 4001 is final for `shouldReconnect`).
                    try:
                        await previous.websocket.send_text(json.dumps({"type": "SESSION_REPLACED"}))
                    except Exception as err:
                        logger.warning("Could not notify replaced session for %s: %s", user_id, err)
                    try:
                        await previous.websocket.close(code=SESSION_REPLACED_CLOSE_CODE)
                    except Exception as err:
                        logger.warning("Could not close replaced socket for %s: %s", user_id, err)
                    # Locks the displaced session held are already gone from `room.locks`;
                    # tell everyone else so no stale lock badge survives.
                    for released_express_id in outcome["released"]:
                        await room.broadcast({
                            "type": "ELEMENT_UNLOCKED",
                            "express_id": released_express_id
                        })

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
                express_id = await _resolve_express_id(websocket, data)

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
                express_id = await _resolve_express_id(websocket, data)

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
                express_id = await _resolve_express_id(websocket, data)
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
                express_id = await _resolve_express_id(websocket, data)
                matrix = data.get("matrix")

                if express_id is not None and matrix:
                    current_lock = room.locks.get(express_id)
                    # Enforce soft-lock validation on commit: reject if locked by another user
                    if current_lock and current_lock.get("user_id") != user_id:
                        await websocket.send_text(json.dumps({
                            "type": "COMMIT_REJECTED",
                            "express_id": express_id,
                            "reason": f"Element locked by user {current_lock.get('user_id')}"
                        }))
                        continue

                    file_path = ProjectService.get_project_file_path(project_id)
                    try:
                        # STEP-03: the commit is serialised with REST and CAD writes for this
                        # project. STEP-04: the open/mutate/write runs on the bounded IFC pool,
                        # so a 49 MB model no longer stalls this socket (and every other frame)
                        # for seconds. The wire protocol is unchanged (STEP-13).
                        async with project_write_lock(project_id):
                            await run_ifc(
                                IFCService.update_element_placement, file_path, express_id, matrix
                            )
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
                express_id = await _resolve_express_id(websocket, data)

                if express_id is not None:
                    await room.broadcast({
                        "type": "REMOTE_PROPERTY_UPDATED",
                        "express_id": express_id,
                        "pset_name": data.get("pset_name"),
                        "property_name": data.get("property_name"),
                        "value": data.get("value")
                    }, exclude_user_id=current_user_id)

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for user %s in project %s", current_user_id, project_id)
    finally:
        if current_user_id:
            # Was this socket already superseded? Then leave the live session (and its
            # locks) alone and skip USER_LEFT, which would evict the new session's presence.
            superseded = (
                current_session is not None
                and room.sessions.get(current_user_id) is not current_session
            )
            released = room.remove_user(current_user_id, session=current_session)
            for express_id in released:
                await room.broadcast({
                    "type": "ELEMENT_UNLOCKED",
                    "express_id": express_id
                })
            if not superseded:
                await room.broadcast({
                    "type": "USER_LEFT",
                    "user_id": current_user_id
                })
        ws_manager.remove_room_if_empty(project_id)
