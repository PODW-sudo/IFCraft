"""Open issue 3.1 (F-019 quota half) - per-caller sliding-window limit on AI spend.

STEP-20 made the copilot routes safe to aim (no more SSRF via `base_url`), but the install
token from STEP-05 is shared, so a caller holding it could still drain the server's paid
provider quota. `core/rate_limit.py` now admits `AI_RATE_LIMIT_REQUESTS` provider-spending
requests per key per `AI_RATE_LIMIT_WINDOW_SECONDS`.

What this suite pins:

* exactly N requests are admitted and N+1 answers `429` with `Retry-After` and a machine
  readable `{"detail": {"code": "ai_rate_limited", ...}}`;
* the window really slides: an injected clock proves an admission expires rather than a
  fixed bucket resetting on a wall-clock boundary;
* keys are independent (one caller's burst does not spend another's allowance);
* the flag disables it (benchmarks / load tests);
* both model-discovery routes are metered as well as chat;
* unauth requests are still `401`, not `429` (the limiter runs after `require_api_token`);
* the key map is bounded, so rotating tokens cannot grow it without bound.

No provider is called: `AIService.chat` / `AIService.fetch_dynamic_models` are replaced with
local stubs, so the assertions are about the limiter and the HTTP contract only.
"""

from __future__ import annotations

import pytest
from starlette.testclient import TestClient  # patched by conftest to attach the API token

from backend.app.core import rate_limit
from backend.app.core.config import settings
from backend.app.core.rate_limit import SlidingWindowLimiter, caller_key
from backend.app.main import app
from backend.app.models.schemas import (
    ChatMessage,
    CopilotChatResponse,
    CopilotModelsResponse,
)
from backend.app.services.ai_service import AIService

CHAT_PAYLOAD = {
    "project_id": "00000000-0000-0000-0000-000000000000",
    "messages": [{"role": "user", "content": "hello"}],
    "provider": "local",
}


async def _fake_chat(cls, request):  # noqa: ANN001 - classmethod stub
    return CopilotChatResponse(
        message=ChatMessage(role="assistant", content="stub"), project_updated=False
    )


async def _fake_fetch_models(cls, provider, api_key=None, base_url=None):  # noqa: ANN001
    return CopilotModelsResponse(provider=provider, models=["stub"], default_model="stub")


@pytest.fixture
def stub_provider(monkeypatch):
    """Replace the provider transports so nothing leaves the process."""
    monkeypatch.setattr(AIService, "chat", classmethod(_fake_chat))
    monkeypatch.setattr(AIService, "fetch_dynamic_models", classmethod(_fake_fetch_models))


@pytest.fixture
def reset_limiter():
    """Fresh process-wide limiter for every test (the map is a module global)."""
    rate_limit.reset_limiter()
    yield
    rate_limit.reset_limiter()


def _configure(monkeypatch, *, limit: int, window: float = 60.0, enabled: bool = True) -> None:
    monkeypatch.setattr(settings, "AI_RATE_LIMIT_REQUESTS", limit)
    monkeypatch.setattr(settings, "AI_RATE_LIMIT_WINDOW_SECONDS", window)
    monkeypatch.setattr(settings, "AI_RATE_LIMIT_ENABLED", enabled)
    rate_limit.reset_limiter()


# ---------------------------------------------------------------------------
# HTTP contract
# ---------------------------------------------------------------------------

def test_n_requests_allowed_then_429_with_retry_after(
    monkeypatch, stub_provider, reset_limiter
):
    """N admitted, N+1 refused with a usable `Retry-After` and a stable error code."""
    _configure(monkeypatch, limit=3)

    with TestClient(app) as client:
        for index in range(3):
            response = client.post("/api/copilot/chat", json=CHAT_PAYLOAD)
            assert response.status_code == 200, f"request {index + 1}: {response.text}"

        refused = client.post("/api/copilot/chat", json=CHAT_PAYLOAD)

    assert refused.status_code == 429, refused.text
    detail = refused.json()["detail"]
    assert detail["code"] == "ai_rate_limited"
    assert "limit of 3" in detail["message"]

    retry_after = refused.headers.get("retry-after")
    assert retry_after is not None
    assert 1 <= int(retry_after) <= 60


def test_model_discovery_routes_are_metered(monkeypatch, stub_provider, reset_limiter):
    """Both `GET` and `POST /api/copilot/models` spend provider quota, so both are limited."""
    _configure(monkeypatch, limit=2)

    with TestClient(app) as client:
        assert client.get("/api/copilot/models?provider=local").status_code == 200
        assert client.post("/api/copilot/models", json={"provider": "local"}).status_code == 200
        refused = client.get("/api/copilot/models?provider=local")

    assert refused.status_code == 429
    assert refused.json()["detail"]["code"] == "ai_rate_limited"


def test_unmetered_providers_route_stays_available(monkeypatch, reset_limiter):
    """`/providers` is a static list - it must not consume (or be blocked by) the allowance."""
    _configure(monkeypatch, limit=1)

    with TestClient(app) as client:
        assert client.get("/api/copilot/providers").status_code == 200
        assert client.get("/api/copilot/providers").status_code == 200


def test_401_wins_over_429(monkeypatch, stub_provider, reset_limiter):
    """Auth runs first: an unauthenticated caller never touches the counter."""
    _configure(monkeypatch, limit=1)

    with TestClient(app) as client:
        assert client.post("/api/copilot/chat", json=CHAT_PAYLOAD).status_code == 200
        unauth = client.post(
            "/api/copilot/chat", json=CHAT_PAYLOAD, headers={"X-No-API-Token": "1"}
        )

    assert unauth.status_code == 401, unauth.text
    assert unauth.json()["detail"] != "ai_rate_limited"


def test_disabled_flag_bypasses_the_limit(monkeypatch, stub_provider, reset_limiter):
    """`AI_RATE_LIMIT_ENABLED = False` restores unlimited admission."""
    _configure(monkeypatch, limit=1, enabled=False)

    with TestClient(app) as client:
        for _ in range(5):
            assert client.post("/api/copilot/chat", json=CHAT_PAYLOAD).status_code == 200


def test_health_and_projects_are_not_limited(monkeypatch, reset_limiter):
    """The limit is scoped to copilot spend, not to the API as a whole."""
    _configure(monkeypatch, limit=1)

    with TestClient(app) as client:
        for _ in range(3):
            assert client.get("/health").status_code == 200
            assert client.get("/api/projects").status_code == 200


# ---------------------------------------------------------------------------
# Sliding-window semantics (injected clock)
# ---------------------------------------------------------------------------

class _Clock:
    def __init__(self, now: float = 1000.0) -> None:
        self.now = now

    def __call__(self) -> float:
        return self.now


def test_window_slides_with_an_injected_clock():
    clock = _Clock()
    limiter = SlidingWindowLimiter(2, 10, clock=clock)

    assert limiter.check("k") == (True, 0)
    clock.now += 4
    assert limiter.check("k") == (True, 0)

    clock.now += 1  # t=1005, both admissions still inside the 10 s window
    allowed, retry_after = limiter.check("k")
    assert allowed is False
    assert retry_after == 5  # oldest admission (t=1000) leaves at t=1010

    clock.now += 5  # t=1010 - the first admission expires, one slot is free
    assert limiter.check("k") == (True, 0)

    # The second admission (t=1004) is still inside the window, so the next one is refused.
    allowed, retry_after = limiter.check("k")
    assert allowed is False
    assert retry_after == 4


def test_denied_requests_do_not_extend_the_window():
    """A hammering caller is unblocked on schedule, not 60 s after its last refusal."""
    clock = _Clock()
    limiter = SlidingWindowLimiter(1, 10, clock=clock)

    assert limiter.check("k") == (True, 0)
    for _ in range(20):
        assert limiter.check("k")[0] is False
        clock.now += 0.1

    clock.now = 1010.0
    assert limiter.check("k") == (True, 0)


def test_keys_are_independent():
    clock = _Clock()
    limiter = SlidingWindowLimiter(1, 60, clock=clock)

    assert limiter.check("token-a") == (True, 0)
    assert limiter.check("token-a")[0] is False
    assert limiter.check("token-b") == (True, 0)
    assert limiter.check("token-b")[0] is False


def test_zero_limit_refuses_everything_but_keeps_retry_after_sane():
    limiter = SlidingWindowLimiter(0, 30, clock=_Clock())
    allowed, retry_after = limiter.check("k")
    assert allowed is False
    assert retry_after == 30


def test_key_map_is_bounded_and_evicts_the_oldest_entry():
    clock = _Clock()
    limiter = SlidingWindowLimiter(1, 60, clock=clock, max_keys=2)

    assert limiter.check("first") == (True, 0)
    assert limiter.check("second") == (True, 0)
    assert len(limiter) == 2

    assert limiter.check("third") == (True, 0)
    assert len(limiter) == 2
    # "first" was evicted with its history; "second" is still tracked and still refused.
    assert limiter.check("second")[0] is False
    assert limiter.check("first") == (True, 0)
    assert len(limiter) == 2


def test_retry_after_is_never_zero():
    """A sub-second remainder rounds up: `Retry-After: 0` would invite an instant retry."""
    clock = _Clock()
    limiter = SlidingWindowLimiter(1, 10, clock=clock)
    assert limiter.check("k") == (True, 0)
    clock.now = 1009.999
    allowed, retry_after = limiter.check("k")
    assert allowed is False
    assert retry_after == 1


# ---------------------------------------------------------------------------
# Key derivation
# ---------------------------------------------------------------------------

def test_caller_key_hashes_the_token_and_never_stores_it():
    from starlette.requests import Request

    scope = {"type": "http", "client": ("127.0.0.1", 12345), "headers": []}
    request = Request(scope)

    key_a = caller_key(request, "token-one")
    key_b = caller_key(request, "token-two")
    key_anon = caller_key(request, None)

    assert key_a != key_b != key_anon
    assert all(len(key) == 64 for key in (key_a, key_b, key_anon))
    assert "token-one" not in key_a
    # Same token -> same bucket, regardless of the request object.
    assert caller_key(request, "token-one") == key_a


def test_caller_key_falls_back_to_the_client_host():
    from starlette.requests import Request

    def key_for(host: str) -> str:
        scope = {"type": "http", "client": (host, 1234), "headers": []}
        return caller_key(Request(scope), None)

    assert key_for("127.0.0.1") != key_for("192.168.1.20")


# ---------------------------------------------------------------------------
# Guards
# ---------------------------------------------------------------------------

def test_limiter_rejects_a_non_positive_window():
    with pytest.raises(ValueError):
        SlidingWindowLimiter(5, 0)


def test_default_limits_match_the_documented_budget():
    """30 requests/minute is the documented default (README + config comment)."""
    assert settings.AI_RATE_LIMIT_REQUESTS == 30
    assert settings.AI_RATE_LIMIT_WINDOW_SECONDS == 60.0
    assert settings.AI_RATE_LIMIT_ENABLED is True
