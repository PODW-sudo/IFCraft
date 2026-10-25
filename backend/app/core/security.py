"""API token authentication (STEP-05 / F-003) and signed session identity (issue 3.5).

The threat model of this app is *a malicious web page in the user's browser*, not a hostile
authenticated user: there are no accounts, no sessions and no roles. A single token that is
generated on first start, persisted to `storage/.api_token` and required on every `/api`
route closes the browser-mediated hole completely.

What this does NOT do: it does not stop a local process running as the same OS user (that
process can read the token file), and it does not provide per-user identity.

Issue 3.5 adds a *signed* session identity on top of that install token. Every WebSocket frame
carried a client-supplied `user_id`, so presence and soft locks were advisory: a browser at an
allowed Origin could claim any architect's id. `issue_session_token()`/`verify_session_token()`
make that id verifiable without adding an account system:

    token   = base64url(user_id ":" expiry).base64url(HMAC-SHA256(key, "user_id:expiry"))
    key     = settings.API_TOKEN (the per-install secret)
    expiry  = unix seconds, now + settings.SESSION_TOKEN_TTL_SECONDS

The payload is not encrypted — it is signed. It carries no privilege beyond "this caller was
allowed to ask for this id at bootstrap", which is exactly the statement the room protocol
needs. Verification is constant-time on both the signature and the id, and expiry is enforced
server-side.
"""

import base64
import binascii
import hashlib
import hmac
import logging
import secrets
import time

from fastapi import Header, HTTPException, status

from .config import default_token_path, load_or_create_token as _load_or_create_token, settings

logger = logging.getLogger("ifc_editor.security")

TOKEN_FILE = default_token_path()

TOKEN_HEADER = "X-API-Token"

# A session token is ~120 characters for a 32-character user id. The ceiling keeps a hostile
# handshake from making the server HMAC/decode an arbitrarily large string.
MAX_SESSION_TOKEN_LENGTH = 1024

SESSION_TOKEN_SEPARATOR = "."


def _b64url_encode(raw: bytes) -> str:
    """Unpadded base64url — safe inside JSON and a URL, no escaping needed."""
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64url_decode(text: str) -> bytes:
    """Strict decode: reject anything that is not base64url instead of guessing."""
    if not text:
        raise ValueError("empty base64url segment")
    padding = "=" * (-len(text) % 4)
    try:
        return base64.b64decode(text + padding, altchars=b"-_", validate=True)
    except (binascii.Error, ValueError) as err:  # pragma: no cover - defensive
        raise ValueError("invalid base64url segment") from err


def _session_key() -> bytes:
    """The per-install secret. Falls back to the persisted token like `require_api_token`."""
    secret = settings.API_TOKEN or load_or_create_token()
    if not secret:
        # Cannot happen in practice (`load_or_create_token` generates one); failing closed is
        # still better than signing with an empty key.
        raise RuntimeError("No API token is available to sign session tokens")
    return secret.encode("utf-8")


def session_token_expires_at(now: float | None = None) -> int:
    """Unix expiry stamped into a newly issued token (also returned to the client)."""
    issued_at = int(now if now is not None else time.time())
    return issued_at + int(settings.SESSION_TOKEN_TTL_SECONDS)


def issue_session_token(user_id: str, now: float | None = None) -> str:
    """Return a signed `<payload>.<signature>` token for ``user_id``.

    ``now`` exists so tests (and the bootstrap route, which reports `expires_at`) can pin the
    clock; production callers omit it.
    """
    if not isinstance(user_id, str) or not user_id.strip():
        raise ValueError("user_id must be a non-empty string")
    payload = f"{user_id}:{session_token_expires_at(now)}".encode("utf-8")
    signature = hmac.new(_session_key(), payload, hashlib.sha256).digest()
    return f"{_b64url_encode(payload)}{SESSION_TOKEN_SEPARATOR}{_b64url_encode(signature)}"


def verify_session_token(token: str | None, user_id: str | None, now: float | None = None) -> bool:
    """True only for a correctly signed, unexpired token issued for exactly ``user_id``.

    Never raises: a missing, malformed, tampered, expired or wrong-user token is a plain
    ``False`` so the WebSocket path can answer with one error frame and close 1008.
    """
    if not isinstance(token, str) or not token or len(token) > MAX_SESSION_TOKEN_LENGTH:
        return False
    if not isinstance(user_id, str) or not user_id:
        return False

    payload_segment, separator, signature_segment = token.partition(SESSION_TOKEN_SEPARATOR)
    if not separator or not signature_segment:
        return False

    try:
        payload = _b64url_decode(payload_segment)
        supplied_signature = _b64url_decode(signature_segment)
    except ValueError:
        return False

    expected_signature = hmac.new(_session_key(), payload, hashlib.sha256).digest()
    if not hmac.compare_digest(supplied_signature, expected_signature):
        return False

    # Only now is the payload trustworthy enough to parse.
    try:
        payload_text = payload.decode("utf-8")
    except UnicodeDecodeError:
        return False

    # `rpartition` so a user id that contains a colon still parses (the expiry is the last
    # field and is always digits).
    token_user_id, id_separator, expiry_text = payload_text.rpartition(":")
    if not id_separator or not token_user_id or not expiry_text.isdigit():
        return False
    if not hmac.compare_digest(token_user_id.encode("utf-8"), user_id.encode("utf-8")):
        return False

    try:
        expires_at = int(expiry_text)
    except ValueError:  # pragma: no cover - `isdigit()` already guarantees this
        return False

    moment = int(now if now is not None else time.time())
    return moment < expires_at


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


__all__ = [
    "MAX_SESSION_TOKEN_LENGTH",
    "TOKEN_FILE",
    "TOKEN_HEADER",
    "issue_session_token",
    "load_or_create_token",
    "require_api_token",
    "session_token_expires_at",
    "verify_session_token",
]
