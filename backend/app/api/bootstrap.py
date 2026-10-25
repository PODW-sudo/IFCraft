"""Token bootstrap endpoint (STEP-05 / F-003, spec 3).

The frontend is served from the vite dev server on a different port than the API, so it
needs a way to obtain the token once at boot. It may do so only when the request comes from
an allowed Origin or from a non-browser client (no Origin header at all) — a foreign page
gets 403 and, because `Access-Control-Allow-Origin` no longer mirrors arbitrary origins,
cannot read the response even if it fires the request.
"""

import logging

from fastapi import APIRouter, HTTPException, Request, status

from ..core.config import settings
from ..core.security import load_or_create_token

logger = logging.getLogger("ifc_editor.bootstrap")

router = APIRouter(tags=["Bootstrap"])


@router.get("/bootstrap/token")
async def bootstrap_token(request: Request) -> dict[str, str]:
    """Return the API token to allowed origins and non-browser clients only."""
    origin = request.headers.get("origin")
    if origin and origin not in settings.CORS_ORIGINS:
        logger.warning("Refused API token bootstrap for disallowed origin %s", origin)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This origin is not allowed to read the API token.",
        )
    return {"token": load_or_create_token()}


__all__ = ["router"]
