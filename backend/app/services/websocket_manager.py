import json
import logging
from typing import Any, Optional
from datetime import datetime, timezone
from fastapi import WebSocket

logger = logging.getLogger("ifc_editor.websocket")

class UserSession:
    def __init__(self, user_id: str, user_name: str, user_color: str, websocket: WebSocket):
        self.user_id = user_id
        self.user_name = user_name
        self.user_color = user_color
        self.websocket = websocket
        self.selected_express_id: Optional[int] = None
        self.joined_at = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> dict[str, Any]:
        return {
            "user_id": self.user_id,
            "user_name": self.user_name,
            "user_color": self.user_color,
            "selected_express_id": self.selected_express_id,
            "joined_at": self.joined_at
        }

class Room:
    def __init__(self, project_id: str):
        self.project_id = project_id
        self.sessions: dict[str, UserSession] = {} # user_id -> UserSession
        # express_id -> { user_id, user_name, user_color, acquired_at }
        self.locks: dict[int, dict[str, Any]] = {}

    def cleanup_stale_locks(self):
        """Purge any locks held by disconnected users."""
        active_user_ids = set(self.sessions.keys())
        stale_express_ids = [
            eid for eid, lock in self.locks.items()
            if lock.get("user_id") not in active_user_ids
        ]
        for eid in stale_express_ids:
            del self.locks[eid]

    def add_user(self, session: UserSession):
        self.sessions[session.user_id] = session
        # If this is the only active user in the room, clear all stale locks
        if len(self.sessions) <= 1:
            self.locks.clear()
        else:
            self.cleanup_stale_locks()

    def remove_user(self, user_id: str) -> list[int]:
        """Remove user and release all locks held by this user."""
        released_locks = []
        for express_id, lock_info in list(self.locks.items()):
            if lock_info["user_id"] == user_id:
                del self.locks[express_id]
                released_locks.append(express_id)
        if user_id in self.sessions:
            del self.sessions[user_id]

        # If only 0 or 1 user left in the room, clear all locks so remaining user is never blocked
        if len(self.sessions) <= 1:
            for express_id in list(self.locks.keys()):
                released_locks.append(express_id)
            self.locks.clear()
        else:
            self.cleanup_stale_locks()

        return released_locks

    def acquire_lock(self, express_id: int, user_id: str) -> bool:
        """Attempt to acquire soft lock on element for user."""
        self.cleanup_stale_locks()

        # If user is alone in the room, ALWAYS grant lock
        if len(self.sessions) <= 1:
            session = self.sessions.get(user_id)
            self.locks[express_id] = {
                "user_id": user_id,
                "user_name": session.user_name if session else "User",
                "user_color": session.user_color if session else "#38bdf8",
                "acquired_at": datetime.now(timezone.utc).isoformat()
            }
            if session:
                session.selected_express_id = express_id
            return True

        if express_id in self.locks:
            holder_id = self.locks[express_id].get("user_id")
            # If held by the same user or by an inactive session, grant/refresh lock
            if holder_id == user_id or holder_id not in self.sessions:
                session = self.sessions.get(user_id)
                self.locks[express_id] = {
                    "user_id": user_id,
                    "user_name": session.user_name if session else "User",
                    "user_color": session.user_color if session else "#38bdf8",
                    "acquired_at": datetime.now(timezone.utc).isoformat()
                }
                if session:
                    session.selected_express_id = express_id
                return True
            return False # Locked by another active user
        
        session = self.sessions.get(user_id)
        if not session:
            return False
            
        self.locks[express_id] = {
            "user_id": user_id,
            "user_name": session.user_name,
            "user_color": session.user_color,
            "acquired_at": datetime.now(timezone.utc).isoformat()
        }
        session.selected_express_id = express_id
        return True

    def release_lock(self, express_id: int, user_id: str) -> bool:
        """Release soft lock if held by user."""
        if express_id in self.locks and self.locks[express_id]["user_id"] == user_id:
            del self.locks[express_id]
            session = self.sessions.get(user_id)
            if session and session.selected_express_id == express_id:
                session.selected_express_id = None
            return True
        return False

    async def broadcast(self, message: dict[str, Any], exclude_user_id: Optional[str] = None):
        """Broadcast message to all connected clients in this project room."""
        payload = json.dumps(message)
        for user_id, session in list(self.sessions.items()):
            if exclude_user_id and user_id == exclude_user_id:
                continue
            try:
                await session.websocket.send_text(payload)
            except Exception as e:
                logger.warning("Failed to send WS message to user %s: %s", user_id, e)

class WebSocketRoomManager:
    def __init__(self):
        self.rooms: dict[str, Room] = {}

    def get_or_create_room(self, project_id: str) -> Room:
        if project_id not in self.rooms:
            self.rooms[project_id] = Room(project_id)
        return self.rooms[project_id]

    def remove_room_if_empty(self, project_id: str):
        if project_id in self.rooms and len(self.rooms[project_id].sessions) == 0:
            del self.rooms[project_id]

ws_manager = WebSocketRoomManager()
