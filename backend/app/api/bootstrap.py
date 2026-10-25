"""Bootstrap endpoints (STEP-05 / F-003, open issue 3.5).

The frontend is served from the vite dev server on a different port than the API, so it
needs a way to obtain the token once at boot. It may do so only when the request comes from
an allowed Origin or from a non-browser client (no Origin header at all) — a foreign page
gets 403 and, because `Access-Control-Allow-Origin` no longer mirrors arbitrary origins,
cannot read the response even if it fires the request.

`POST /bootstrap/session` (issue 3.5) hands out the *signed* session identity the WebSocket
JOIN now requires from a browser. It is deliberately behind the same Origin gate as the token
route and nothing stronger: by the time a caller can reach it, it is already the trusted local
UI, and the token it returns only says "this socket is this user id" — the room protocol never
granted more than that. The 12 h expiry means a stale tab cannot collaborate forever.
"""

import logging
import time

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator

from ..core.config import settings
from ..core.security import (
    issue_session_token,
    load_or_create_token,
    session_token_expires_at,
    verify_session_token,
)

logger = logging.getLogger("ifc_editor.bootstrap")

router = APIRouter(tags=["Bootstrap"])


def _reject_foreign_origin(request: Request, action: str) -> None:
    """Shared Origin gate: allowed dev origins and non-browser clients only (STEP-05 spec 3)."""
    origin = request.headers.get("origin")
    if origin and origin not in settings.CORS_ORIGINS:
        logger.warning("Refused %s for disallowed origin %s", action, origin)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This origin is not allowed to {action}.",
        )


class SessionRequest(BaseModel):
    """Body of `POST /bootstrap/session`.

    `min_length=1` / `max_length=128` give FastAPI's 422 for an empty or oversized id instead of
    letting a caller sign an unbounded string (and a blank identity would collide across users).
    """

    user_id: str = Field(
        min_length=1,
        max_length=settings.MAX_SESSION_USER_ID_LENGTH,
        description="Stable client-generated collaboration identity.",
    )

    @field_validator("user_id")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("user_id must not be blank")
        return stripped


class SessionResponse(BaseModel):
    session_token: str
    user_id: str
    expires_at: int


@router.get("/bootstrap/token")
async def bootstrap_token(request: Request) -> dict[str, str]:
    """Return the API token to allowed origins and non-browser clients only."""
    _reject_foreign_origin(request, "read the API token")
    return {"token": load_or_create_token()}


@router.post("/bootstrap/session", response_model=SessionResponse)
async def bootstrap_session(request: Request, payload: SessionRequest) -> SessionResponse:
    """Issue a signed session token for `payload.user_id` (issue 3.5)."""
    _reject_foreign_origin(request, "obtain a session token")

    issued_at = time.time()
    expires_at = session_token_expires_at(issued_at)
    token = issue_session_token(payload.user_id, now=issued_at)
    # Fail closed on our own output: a signing/verification mismatch must never reach a socket.
    if not verify_session_token(token, payload.user_id, now=issued_at):
        logger.error("Issued a session token that does not verify for %s", payload.user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not issue a session token.",
        )
    return SessionResponse(
        session_token=token,
        user_id=payload.user_id,
        expires_at=expires_at,
    )


__all__ = ["router"]
