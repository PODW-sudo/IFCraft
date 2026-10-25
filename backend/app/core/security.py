"""API token authentication (STEP-05 / F-003).

The threat model of this app is *a malicious web page in the user's browser*, not a hostile
authenticated user: there are no accounts, no sessions and no roles. A single token that is
generated on first start, persisted to `storage/.api_token` and required on every `/api`
route closes the browser-mediated hole completely.

What this does NOT do: it does not stop a local process running as the same OS user (that
process can read the token file), and it does not provide per-user identity.
"""

import logging
import secrets

from fastapi import Header, HTTPException, status

from .config import default_token_path, load_or_create_token as _load_or_create_token, settings

logger = logging.getLogger("ifc_editor.security")

TOKEN_FILE = default_token_path()

TOKEN_HEADER = "X-API-Token"


def load_or_create_token() -> str:
    """Return the token for this installation, creating `storage/.api_token` if needed."""
    token = _load_or_create_token(TOKEN_FILE)
    if not settings.API_TOKEN:
        settings.API_TOKEN = token
    return settings.API_TOKEN or token


def _extract_token(x_api_token: str | None, authorization: str | None) -> str | None:
    if x_api_token:
        return x_api_token.strip()
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return None


def require_api_token(
    x_api_token: str | None = Header(default=None, alias=TOKEN_HEADER),
    authorization: str | None = Header(default=None),
) -> None:
    """FastAPI dependency: 401 unless a valid `X-API-Token` / `Bearer` token is supplied.

    The comparison is constant-time so a caller cannot learn the token byte by byte from
    response timing.
    """
    expected = settings.API_TOKEN or load_or_create_token()
    supplied = _extract_token(x_api_token, authorization)
    if not supplied or not expected or not secrets.compare_digest(supplied, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A valid API token is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )


__all__ = ["TOKEN_FILE", "TOKEN_HEADER", "load_or_create_token", "require_api_token"]
