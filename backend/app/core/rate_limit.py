"""Per-caller AI rate limit (open issue 3.1 / F-019 quota half).

STEP-20 closed the SSRF half of F-019: a caller can no longer aim the server's paid key at
an arbitrary host. What remained open is the *quota* half: the per-install token from STEP-05
gates access, but it is shared by every caller in the installation, so anyone holding it could
spend the provider quota without bound.

This module adds an in-memory sliding-window limiter on the three routes that actually spend
provider quota:

* `POST /api/copilot/chat`
* `GET  /api/copilot/models` and `POST /api/copilot/models` (model discovery calls the provider)

Everything else - `/health`, bootstrap, project reads/writes, the WebSocket - is deliberately
not limited. The limiter is process-local: it is an accident guard, not a billing firewall.
With one uvicorn process (enforced by `core/server_lock.py`, open issue 3.4) that is exact;
a future multi-worker deployment would need a shared counter (SQLite/Redis).

Keying
------
The key is the SHA-256 digest of the API token supplied on the request. All browsers in one
installation share the same install token (there are no per-user accounts by design), so the
limit is effectively a per-installation one, plus one bucket per client host for callers that
present no token at all. Tokens never leave this module in cleartext; the digest is what the
bounded key map holds.
"""

from __future__ import annotations

import hashlib
import logging
import math
import threading
import time
from collections import deque
from typing import Callable

from fastapi import Depends, Header, HTTPException, Request, status

from .config import settings
from .security import TOKEN_HEADER, _extract_token, require_api_token

logger = logging.getLogger("ifc_editor.rate_limit")


class SlidingWindowLimiter:
    """Thread-safe fixed-capacity sliding-window counter.

    ``check`` records the admitted request and answers ``(allowed, retry_after_seconds)``.
    A denied request is **not** recorded, so a caller that hammers the endpoint cannot push
    its own window forward and lock itself out forever.

    The key map is bounded (`max_keys`, default 1024) so an attacker rotating tokens cannot
    grow it without bound; when full, the oldest-inserted key is evicted (FIFO). Eviction
    forgives that key's history - acceptable for an abuse guard whose only failure mode is a
    few seconds of extra allowance.
    """

    def __init__(
        self,
        limit: int,
        window_seconds: float,
        *,
        clock: Callable[[], float] = time.monotonic,
        max_keys: int = 1024,
    ) -> None:
        if window_seconds <= 0:
            raise ValueError("window_seconds must be positive")
        self._limit = int(limit)
        self._window = float(window_seconds)
        self._clock = clock
        self._max_keys = max(1, int(max_keys))
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    @property
    def limit(self) -> int:
        return self._limit

    @property
    def window_seconds(self) -> float:
        return self._window

    def check(self, key: str) -> tuple[bool, int]:
        """Admit or refuse one request for ``key``.

        Returns ``(True, 0)`` when admitted, ``(False, retry_after)`` when the limit is
        already reached, where ``retry_after`` is whole seconds (at least 1) until the
        oldest admitted request leaves the window.
        """
        with self._lock:
            now = self._clock()
            cutoff = now - self._window

            bucket = self._hits.get(key)
            if bucket is not None:
                while bucket and bucket[0] <= cutoff:
                    bucket.popleft()
                if not bucket:
                    del self._hits[key]
                    bucket = None

            if self._limit <= 0:
                # A zero/negative limit is "refuse everything" rather than "unlimited".
                return False, max(1, int(math.ceil(self._window)))

            if bucket is None:
                if len(self._hits) >= self._max_keys:
                    self._hits.pop(next(iter(self._hits)))
                bucket = deque()
                self._hits[key] = bucket

            if len(bucket) >= self._limit:
                retry_after = int(math.ceil(bucket[0] + self._window - now))
                return False, max(1, retry_after)

            bucket.append(now)
            return True, 0

    def reset(self) -> None:
        """Drop every recorded window (tests only)."""
        with self._lock:
            self._hits.clear()

    def __len__(self) -> int:
        with self._lock:
            return len(self._hits)


# ---------------------------------------------------------------------------
# Application wiring
# ---------------------------------------------------------------------------

_limiter: SlidingWindowLimiter | None = None
_limiter_config: tuple[int, float] | None = None


def get_limiter() -> SlidingWindowLimiter:
    """The process-wide limiter, rebuilt when the configured limit/window changes.

    Reading the config here (instead of at import) keeps the values patchable in tests and
    means an operator editing `AI_RATE_LIMIT_*` gets the new shape without stale state.
    """
    global _limiter, _limiter_config
    limit = int(settings.AI_RATE_LIMIT_REQUESTS)
    window = float(settings.AI_RATE_LIMIT_WINDOW_SECONDS)
    if _limiter is None or _limiter_config != (limit, window):
        _limiter = SlidingWindowLimiter(limit, window)
        _limiter_config = (limit, window)
    return _limiter


def reset_limiter() -> None:
    """Forget the process-wide limiter (tests and a config change between runs)."""
    global _limiter, _limiter_config
    _limiter = None
    _limiter_config = None


def caller_key(request: Request, token: str | None) -> str:
    """SHA-256 digest of the supplied token, or of the client host when none was supplied."""
    if token:
        material = f"token:{token}"
    else:
        host = request.client.host if request.client else "unknown"
        material = f"host:{host}"
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


def enforce_ai_rate_limit(
    request: Request,
    x_api_token: str | None = Header(default=None, alias=TOKEN_HEADER),
    authorization: str | None = Header(default=None),
    _: None = Depends(require_api_token),
) -> None:
    """FastAPI dependency for the provider-spending copilot routes.

    Depends on `require_api_token` so an unauthenticated request is a `401` before it ever
    touches the counter; the router-level dependency from STEP-05 still applies as usual.
    """
    if not settings.AI_RATE_LIMIT_ENABLED:
        return

    limiter = get_limiter()
    token = _extract_token(x_api_token, authorization)
    allowed, retry_after = limiter.check(caller_key(request, token))
    if allowed:
        return

    logger.warning(
        "AI rate limit hit (limit=%s per %ss); refusing with 429, retry after %ss",
        limiter.limit,
        limiter.window_seconds,
        retry_after,
    )
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail={
            "code": "ai_rate_limited",
            "message": (
                f"AI request limit of {limiter.limit} per {limiter.window_seconds:.0f}s "
                f"exceeded. Retry in {retry_after}s."
            ),
        },
        headers={"Retry-After": str(retry_after)},
    )


__all__ = [
    "SlidingWindowLimiter",
    "caller_key",
    "enforce_ai_rate_limit",
    "get_limiter",
    "reset_limiter",
]
