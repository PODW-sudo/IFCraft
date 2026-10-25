"""Shared pytest configuration for the backend suite (STEP-05 / F-003).

The API now requires an `X-API-Token` header on every `/api` route. The suite constructs
`TestClient(app)` in dozens of places and calls those routes without a token, so this file
makes the client attach the installation token by default:

    from starlette.testclient import TestClient   ->  resolves to TokenTestClient

The patch is installed when this conftest is imported, i.e. before the test modules are
imported, so `from starlette.testclient import TestClient` picks up the subclass.

This does **not** weaken the check: `require_api_token` still runs for every request. The
client simply supplies the header a browser (frontend/services/api.ts) or the QA runner
(`scripts/qa_runner.py`) supplies in real life. Anything that wants to observe the
unauthenticated behaviour keeps the real client, either by using `UntokenedTestClient` or by
being listed in `AUTH_CONTRACT_TEST_MODULES` — the STEP-05 contract test asserts that
`GET/POST /api/projects` answer 401 without a token, so it must not receive one implicitly.
"""

from __future__ import annotations

import sys
from pathlib import Path

import starlette.testclient as _starlette_testclient
from starlette.testclient import TestClient as _StarletteTestClient

# ---------------------------------------------------------------------------
# Token plumbing
# ---------------------------------------------------------------------------

def _repo_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "backend" / "app" / "main.py").exists():
            return parent
    raise RuntimeError("Could not locate repository root")


ROOT = _repo_root()
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.core.config import settings  # noqa: E402
from backend.app.core.security import TOKEN_HEADER, load_or_create_token  # noqa: E402

API_TOKEN = load_or_create_token()

#: Test modules that deliberately exercise the unauthenticated path; they get a plain client.
AUTH_CONTRACT_TEST_MODULES = {
    "test_step05_cors_and_auth",
}

#: Request header that suppresses the implicit token on a single request, for tests that need
#: to prove a route is protected while still using the convenience client.
NO_TOKEN_HEADER = "X-No-API-Token"


def _caller_test_module() -> str:
    """Name (without extension) of the closest test module on the call stack."""
    frame = sys._getframe(1)
    this_file = Path(__file__).resolve()
    tests_dir = this_file.parent.name  # "tests"
    while frame is not None:
        filename = frame.f_globals.get("__file__", "")
        if filename:
            path = Path(str(filename))
            if path.resolve() != this_file and path.parent.name == tests_dir and path.suffix == ".py":
                return path.stem
        frame = frame.f_back
    return ""


class TokenTestClient(_StarletteTestClient):
    """`TestClient` that attaches the installation API token to `/api` requests.

    * An explicit `X-API-Token` on the request always wins (including the empty string).
    * `X-No-API-Token: 1` on a single request opts that request out.
    * The token is only attached for `/api/...` URLs; `/health` and the static routes are public.
    """

    def __init__(self, *args, **kwargs):
        # Capture the caller before delegating, `super().__init__` pushes more frames.
        self._token_exempt = _caller_test_module() in AUTH_CONTRACT_TEST_MODULES
        super().__init__(*args, **kwargs)

    def request(self, method, url, *args, **kwargs):  # type: ignore[override]
        if not self._token_exempt and str(url).startswith("/api"):
            headers = dict(kwargs.get("headers") or {})
            lowered = {key.lower(): value for key, value in headers.items()}
            if NO_TOKEN_HEADER.lower() in lowered:
                headers = {
                    key: value
                    for key, value in headers.items()
                    if key.lower() != NO_TOKEN_HEADER.lower()
                }
                kwargs["headers"] = headers
            elif TOKEN_HEADER.lower() not in lowered and "authorization" not in lowered:
                headers[TOKEN_HEADER] = API_TOKEN
                kwargs["headers"] = headers
        return super().request(method, url, *args, **kwargs)


class UntokenedTestClient(_StarletteTestClient):
    """Real `TestClient` with no implicit token — for tests that assert the 401 path."""


# Make `from starlette.testclient import TestClient` (used by every test module) yield the
# token-aware client. Installed at conftest import time, before collection imports the tests.
_starlette_testclient.TestClient = TokenTestClient


def _install_async_client_default_token() -> None:
    """Attach the token to plain `httpx.AsyncClient` usage (test_phase1 / test_phase3).

    Those two tests drive the app through `ASGITransport` instead of `TestClient`, so the
    `TestClient` patch above never sees their requests. They are integration tests of the real
    routes, not of the auth contract, so they get the same implicit header.
    """
    import httpx

    original_init = httpx.AsyncClient.__init__
    if getattr(original_init, "_ifc_api_token_patched", False):
        return

    def __init__(self, *args, **kwargs):
        headers = httpx.Headers(kwargs.get("headers") or {})
        if TOKEN_HEADER.lower() not in {key.lower() for key in headers.keys()}:
            headers[TOKEN_HEADER] = API_TOKEN
        kwargs["headers"] = headers
        original_init(self, *args, **kwargs)

    __init__._ifc_api_token_patched = True  # type: ignore[attr-defined]
    httpx.AsyncClient.__init__ = __init__  # type: ignore[method-assign]


_install_async_client_default_token()

__all__ = [
    "API_TOKEN",
    "TokenTestClient",
    "UntokenedTestClient",
    "settings",
    "NO_TOKEN_HEADER",
]
