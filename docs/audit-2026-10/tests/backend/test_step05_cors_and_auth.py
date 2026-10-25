"""
STEP-05 — Lock down CORS, require an API token, and validate the WebSocket Origin.

Finding: F-003
Code under test:
  backend/app/core/config.py:31-37   (CORS_ORIGINS contains "*")
  backend/app/main.py:36-42          (allow_credentials=True)
  backend/app/api/websocket.py:14-16 (no Origin check)

MEASURED (2026-10-24):
  GET /health with `Origin: https://evil.example.com`
    -> access-control-allow-origin: https://evil.example.com
    -> access-control-allow-credentials: true

HOW TO RUN
    Copy this file into backend/tests/ then:
    .\\backend\\venv\\Scripts\\python.exe -m pytest backend/tests/test_step05_cors_and_auth.py -v
"""

import sys
from pathlib import Path

import pytest
from starlette.testclient import TestClient


def _repo_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "backend" / "app" / "main.py").exists():
            return parent
    raise RuntimeError("Could not locate repository root")


ROOT = _repo_root()
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.main import app  # noqa: E402
from backend.app.core.config import settings  # noqa: E402

ALLOWED_ORIGIN = "http://localhost:5173"
FOREIGN_ORIGIN = "https://evil.example.com"


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_cors_origins_do_not_contain_a_wildcard():
    """A wildcard origin with credentials lets any website reach the local API."""
    assert "*" not in settings.CORS_ORIGINS, (
        f"CORS_ORIGINS contains '*': {settings.CORS_ORIGINS}. "
        "With allow_credentials=True the browser will send cookies/credentials to any origin."
    )
    assert settings.CORS_ORIGINS, "CORS_ORIGINS must not be empty"


def test_foreign_origin_is_not_allowed(client):
    """A request from an unknown origin must not receive an allow-origin header."""
    resp = client.get("/health", headers={"Origin": FOREIGN_ORIGIN})
    assert resp.status_code == 200, "the request itself may still succeed"

    returned = resp.headers.get("access-control-allow-origin")
    assert returned != FOREIGN_ORIGIN, (
        f"the server echoed the foreign origin '{returned}'. Any website the user visits can "
        "read this API. Starlette mirrors the Origin when '*' is in allow_origins and "
        "allow_credentials is True."
    )


def test_preflight_from_a_foreign_origin_is_not_allowed(client):
    """The preflight must not authorise a foreign origin."""
    resp = client.options(
        "/api/projects",
        headers={
            "Origin": FOREIGN_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    returned = resp.headers.get("access-control-allow-origin")
    assert returned != FOREIGN_ORIGIN, (
        f"preflight authorised the foreign origin '{returned}'"
    )


def test_allowed_origin_is_still_permitted(client):
    """The real dev origin must keep working — this is a lockdown, not a blackout."""
    resp = client.get("/health", headers={"Origin": ALLOWED_ORIGIN})
    returned = resp.headers.get("access-control-allow-origin")
    assert returned == ALLOWED_ORIGIN, (
        f"the legitimate dev origin was rejected (got {returned!r}). "
        "CORS lockdown must not break the application itself."
    )


def test_protected_endpoints_require_a_token(client):
    """Every data endpoint must require the API token.

    `GET /health` stays public so the harness and uptime checks keep working.
    """
    token = getattr(settings, "API_TOKEN", None)
    assert token, (
        "settings.API_TOKEN is not defined. The API has no authentication at all — any process "
        "on the machine (and, via CORS, any website) can read and mutate every project."
    )

    for method, path in (
        ("GET", "/api/projects"),
        ("POST", "/api/projects"),
    ):
        kwargs = {"headers": {"Origin": ALLOWED_ORIGIN}}
        if method == "POST":
            kwargs["json"] = {"name": "AutoTest-Step05", "schema_version": "IFC4"}
        resp = getattr(client, method.lower())(path, **kwargs)
        assert resp.status_code in (401, 403), (
            f"{method} {path} returned {resp.status_code} without a token; expected 401/403"
        )


def test_valid_token_is_accepted(client):
    """A correct token must be accepted, and the request must succeed."""
    token = getattr(settings, "API_TOKEN", None)
    assert token, "settings.API_TOKEN is not defined"

    resp = client.get(
        "/api/projects",
        headers={"Origin": ALLOWED_ORIGIN, "X-API-Token": token},
    )
    assert resp.status_code == 200, f"a request with a valid token returned {resp.status_code}: {resp.text}"


def test_websocket_validates_origin_before_accepting():
    """The WebSocket route must check the Origin header before calling `accept()`.

    This is asserted against the source rather than with a live handshake: against the current
    implementation the server accepts the connection and then waits, so a live test would hang
    forever instead of failing. Once the Origin check exists, a live handshake test can be
    added to confirm close code 1008.
    """
    source = (ROOT / "backend" / "app" / "api" / "websocket.py").read_text(encoding="utf-8")

    assert "origin" in source.lower(), (
        "the WebSocket handler never looks at the Origin header. Any website can open "
        "ws://localhost:8000/ws/rooms/<project_id> and write to the model file."
    )

    # The check must happen before the socket is accepted.
    origin_index = source.lower().find("origin")
    accept_index = source.find("await websocket.accept(")
    assert accept_index != -1, "could not locate websocket.accept() in the handler"
    assert origin_index != -1 and origin_index < accept_index, (
        "the Origin check must run BEFORE websocket.accept(); otherwise the connection is "
        "already established when the check runs."
    )

    assert "1008" in source, (
        "a rejected Origin must close the socket with policy-violation code 1008"
    )
