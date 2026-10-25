import json
import logging
from typing import Any, Optional
from datetime import datetime, timedelta, timezone
from fastapi import WebSocket

logger = logging.getLogger("ifc_editor.websocket")

# A soft lock is refreshed on every acquire (SELECT_ELEMENT / commit re-check) and dropped
# once it has not been touched for this long (STEP-13, Spec 2).
DEFAULT_LOCK_TTL_SECONDS = 120


def canonical_express_id(express_id: Any) -> int:
    """Normalise an IFC express id to its canonical ``int``.

    The wire format is not normalised by every client (``"205"`` vs ``205``), so every
    lock path funnels through here. Accepts an ``int`` or a numeric ``str`` and raises
    ``ValueError`` for anything else *without* writing to ``room.locks``.
    """
    if isinstance(express_id, bool) or isinstance(express_id, float):
        raise ValueError(f"express_id must be an int or a numeric string, got {express_id!r}")
    if isinstance(express_id, int):
        return express_id
    if isinstance(express_id, str):
        return int(express_id.strip())  # ValueError for "", "not-an-id", "205.0", ...
    raise ValueError(f"express_id must be an int or a numeric string, got {express_id!r}")


# Step document names the helper `_canonical_express_id`; keep both spellings so callers
# and the spec agree.
_canonical_express_id = canonical_express_id


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
    def __init__(self, project_id: str, lock_ttl_seconds: int = DEFAULT_LOCK_TTL_SECONDS):
        self.project_id = project_id
        self.lock_ttl_seconds = lock_ttl_seconds
        self.sessions: dict[str, UserSession] = {} # user_id -> UserSession
        # canonical int express_id -> { user_id, user_name, user_color, acquired_at }
        self.locks: dict[int, dict[str, Any]] = {}

    def cleanup_stale_locks(self, now: Optional[datetime] = None) -> list[int]:
        """Purge locks held by absent users or older than the TTL.

        A lock whose ``acquired_at`` cannot be parsed is purged as well: an unreadable
        timestamp is not trustworthy. Returns the express ids that were purged.
        """
        moment = now or datetime.now(timezone.utc)
        active_user_ids = set(self.sessions.keys())
        cutoff = moment - timedelta(seconds=self.lock_ttl_seconds)
        purged: list[int] = []

        for express_id, lock in list(self.locks.items()):
            if lock.get("user_id") not in active_user_ids:
                del self.locks[express_id]
                purged.append(express_id)
                continue

            try:
                acquired_at = datetime.fromisoformat(lock.get("acquired_at"))
            except (TypeError, ValueError):
                del self.locks[express_id]
                purged.append(express_id)
                continue

            if acquired_at.tzinfo is None:
                acquired_at = acquired_at.replace(tzinfo=timezone.utc)
            if acquired_at < cutoff:
                del self.locks[express_id]
                purged.append(express_id)

        return purged

    def _release_locks_for(self, user_id: str) -> list[int]:
        """Drop every lock held by ``user_id`` and return the affected express ids."""
        released: list[int] = []
        for express_id, lock_info in list(self.locks.items()):
            if lock_info.get("user_id") == user_id:
                del self.locks[express_id]
                released.append(express_id)
        return released

    def _stamp_lock(self, express_id: int, user_id: str, now: datetime) -> None:
        """Write (or refresh) the lock for ``express_id``, resetting its ``acquired_at``."""
        session = self.sessions.get(user_id)
        self.locks[express_id] = {
            "user_id": user_id,
            "user_name": session.user_name if session else "User",
            "user_color": session.user_color if session else "#38bdf8",
            "acquired_at": now.isoformat()
        }
        if session:
            session.selected_express_id = express_id

    def add_user(self, session: UserSession) -> dict[str, Any]:
        """Register (or replace) a session.

        Returns ``{"replaced": bool, "previous": UserSession | None, "released": list[int]}``.
        When a session already exists for that ``user_id`` it is replaced and every lock it
        held is released here, so a duplicate JOIN never orphans locks.
        """
        previous = self.sessions.get(session.user_id)
        released: list[int] = []
        if previous is not None:
            released = self._release_locks_for(session.user_id)

        self.sessions[session.user_id] = session
        # If this is the only active user in the room, clear all stale locks
        if len(self.sessions) <= 1:
            self.locks.clear()
        else:
            self.cleanup_stale_locks()

        return {
            "replaced": previous is not None,
            "previous": previous,
            "released": released
        }

    def remove_user(self, user_id: str, session: Optional[UserSession] = None) -> list[int]:
        """Remove user and release all locks held by this user.

        When ``session`` is provided the removal is identity-checked: it only proceeds if
        the stored session *is* that object. A stale socket's disconnect therefore cannot
        evict the live session or release its locks (STEP-13, Spec 4).
        """
        stored = self.sessions.get(user_id)
        if stored is not None and session is not None and stored is not session:
            return []

        released_locks = self._release_locks_for(user_id)
        if stored is not None:
            del self.sessions[user_id]

        # If room is now completely empty, clear any remaining locks
        if len(self.sessions) == 0:
            for express_id in list(self.locks.keys()):
                released_locks.append(express_id)
            self.locks.clear()
        else:
            self.cleanup_stale_locks()

        return released_locks

    def acquire_lock(self, express_id: Any, user_id: str, now: Optional[datetime] = None) -> bool:
        """Attempt to acquire soft lock on element for user."""
        eid = canonical_express_id(express_id)
        moment = now or datetime.now(timezone.utc)
        self.cleanup_stale_locks(now=moment)

        # If user is alone in the room, ALWAYS grant lock
        if len(self.sessions) <= 1:
            self._stamp_lock(eid, user_id, moment)
            return True

        if eid in self.locks:
            holder_id = self.locks[eid].get("user_id")
            # If held by the same user or by an inactive session, grant/refresh lock
            if holder_id == user_id or holder_id not in self.sessions:
                self._stamp_lock(eid, user_id, moment)
                return True
            return False # Locked by another active user

        session = self.sessions.get(user_id)
        if not session:
            return False

        self._stamp_lock(eid, user_id, moment)
        return True

    def release_lock(self, express_id: Any, user_id: str) -> bool:
        """Release soft lock if held by user."""
        try:
            eid = canonical_express_id(express_id)
        except ValueError:
            return False

        if eid in self.locks and self.locks[eid].get("user_id") == user_id:
            del self.locks[eid]
            session = self.sessions.get(user_id)
            if session and session.selected_express_id == eid:
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
