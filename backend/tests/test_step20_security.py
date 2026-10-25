"""STEP-20 — Outbound-request, secret and path hardening.

Findings: F-019, F-020, F-026, F-027, F-045
Code under test:
  backend/app/core/net_guard.py                 (outbound URL policy)
  backend/app/services/ai_service.py            (user-controlled base_url, Gemini key, error bodies)
  backend/app/api/copilot.py                    (upstream error body echoed to the client)
  backend/app/services/project_service.py       (project_id -> filesystem path)
  backend/app/api/federation.py                 (unbounded upload)
  backend/app/api/cad.py, projects.py           (absolute paths in error responses)

The test set is the one specified in docs/audit-2026-10/steps/STEP-20-security-hardening.md
plus the canonical checks that do not contradict that spec. Two canonical assertions were
reconciled, not dropped:

  * the canonical stub required `custom` + `http://127.0.0.1:22` to be refused, which
    contradicts spec 2/4 (and `test_phase6.py:44-53`) - local providers must keep their
    documented loopback use case. The binding contract is `allow_private=True` for
    `custom`/`ollama`, covered by `test_loopback_still_works_for_local_providers`;
  * the canonical stub expected `get_project_file_path("..")` to return a *contained*
    path; spec 8 requires it to raise `ValueError` instead, which is strictly stronger.

HOW TO RUN
    .\\backend\\venv\\Scripts\\python.exe -m pytest backend/tests/test_step20_security.py -v
"""

import asyncio
import json
import re
import sys
import time
from pathlib import Path

import httpx
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

from backend.app.core.config import settings  # noqa: E402
from backend.app.core.net_guard import UrlNotAllowed, validate_outbound_url  # noqa: E402
from backend.app.main import app  # noqa: E402
from backend.app.models.schemas import ChatMessage  # noqa: E402
from backend.app.services.ai_service import AIService  # noqa: E402
from backend.app.services.project_service import ProjectService  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


# ---------------------------------------------------------------------------
# The guard itself (spec 1 and 2)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "url, allow_private",
    [
        ("http://169.254.169.254/latest/meta-data/", True),
        ("http://169.254.169.254/latest/meta-data/", False),
        ("http://[fe80::1]/v1", True),
        ("http://0.0.0.0:8000/v1", True),
        ("http://0.0.0.0:8000/v1", False),
        ("http://224.0.0.1/v1", True),
        ("http://240.0.0.1/v1", True),
        ("http://192.0.2.10/v1", True),      # TEST-NET-1, documentation range
        ("http://100.64.0.1/v1", True),      # CGNAT
        ("http://127.0.0.1:8000/v1", False),  # loopback needs the private opt-in
        ("http://[::1]/v1", False),
        ("http://10.0.0.5/v1", False),
        ("http://172.16.4.2/v1", False),
        ("http://192.168.1.20:11434/v1", False),
        ("http://user:pass@127.0.0.1:8000/v1", True),
        ("file:///C:/Windows/win.ini", True),
        ("ftp://example.com/v1", True),
        ("", True),
        (None, True),
    ],
)
def test_validate_outbound_url_denies(url, allow_private):
    """Spec 1 and 2: scheme, userinfo, host and address class are all enforced."""
    with pytest.raises(UrlNotAllowed):
        validate_outbound_url(url, allow_private=allow_private)


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1:8000/v1",
        "http://[::1]:11434/v1",
        "http://10.0.0.5/v1",
        "http://192.168.1.20:11434/v1",
        "https://93.184.216.34/v1",
    ],
)
def test_validate_outbound_url_allows_private_and_public(url):
    """Spec 2: `allow_private=True` keeps loopback/RFC1918 reachable for local providers."""
    assert validate_outbound_url(url, allow_private=True) == url.rstrip("/")


def test_validate_outbound_url_public_needs_no_private_opt_in():
    """A globally routable address is allowed without `allow_private`."""
    assert validate_outbound_url("https://93.184.216.34/v1") == "https://93.184.216.34/v1"


def test_validate_outbound_url_normalises_the_trailing_slash():
    assert (
        validate_outbound_url("http://127.0.0.1:8000/v1/", allow_private=True)
        == "http://127.0.0.1:8000/v1"
    )


def test_validate_outbound_url_does_not_echo_the_host():
    """The refusal is a category, not a port scanner: the address must not come back."""
    with pytest.raises(UrlNotAllowed) as excinfo:
        validate_outbound_url("http://169.254.169.254/latest/meta-data/", allow_private=True)
    assert "169.254" not in str(excinfo.value)


# ---------------------------------------------------------------------------
# Provider endpoints (spec 3, 4, 5)
# ---------------------------------------------------------------------------

def test_cloud_providers_ignore_client_base_url(client):
    """Spec 3: a caller cannot redirect a cloud provider at an arbitrary host."""
    res = client.post(
        "/api/copilot/models",
        json={
            "provider": "openai",
            "api_key": "",
            "base_url": "http://169.254.169.254/latest/meta-data/",
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["connected"] is False
    assert "169.254" not in (data.get("error") or ""), data


@pytest.mark.parametrize(
    "base_url",
    [
        "http://169.254.169.254/latest/meta-data/",
        "file:///C:/Windows/win.ini",
        "ftp://example.com/v1",
        "http://user:pass@127.0.0.1:8000/v1",
        "",
    ],
)
def test_custom_provider_rejects_unsafe_base_urls(client, base_url):
    """Spec 4 and 5: refused before any socket is opened."""
    started = time.perf_counter()
    res = client.post(
        "/api/copilot/models", json={"provider": "custom", "base_url": base_url}
    )
    elapsed = time.perf_counter() - started

    assert res.status_code == 400, res.text
    assert "base_url not allowed" in res.json()["detail"].lower()
    assert elapsed < 1.0, f"{elapsed:.2f}s - a connection attempt was made"


def test_ollama_provider_rejects_a_link_local_base_url(client):
    """Spec 4: the same policy applies to the other local provider."""
    res = client.post(
        "/api/copilot/models",
        json={"provider": "ollama", "base_url": "http://169.254.169.254/v1"},
    )
    assert res.status_code == 400, res.text
    assert "base_url not allowed" in res.json()["detail"].lower()


def test_loopback_still_works_for_local_providers(client):
    """Spec 2, 4: custom/ollama keep their documented localhost use case."""
    res = client.post(
        "/api/copilot/models",
        json={"provider": "custom", "base_url": "http://127.0.0.1:59999/v1"},
    )
    assert res.status_code == 200, res.text
    assert "not allowed" not in (res.json().get("error") or "").lower()


def test_upstream_error_bodies_are_not_echoed_to_the_client(client):
    """The upstream body must not be returned to the caller.

    Echoing it turns the endpoint into a general-purpose internal HTTP proxy with read
    access. A TEST-NET-1 host is refused by the policy, so this also pins that the refusal
    does not describe the host it never contacted.
    """
    res = client.post(
        "/api/copilot/models",
        json={
            "provider": "custom",
            "base_url": "http://192.0.2.1:9/never-listens",
            "api_key": "x",
        },
    )
    assert "192.0.2.1" not in res.text, res.text


# ---------------------------------------------------------------------------
# Transport (spec 6, 7)
# ---------------------------------------------------------------------------

def test_gemini_key_is_sent_as_a_header(monkeypatch):
    """Spec 6: F-020 - no secret in the query string."""
    captured: dict = {}

    async def fake_post(self, url, **kwargs):
        captured["url"] = str(url)
        captured["headers"] = kwargs.get("headers") or {}
        return httpx.Response(
            200,
            json={"candidates": [{"content": {"parts": [{"text": "ok"}]}}]},
            request=httpx.Request("POST", str(url)),
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    text, calls = asyncio.run(
        AIService._call_gemini("AIzaSECRETKEY", "gemini-3.8-flash",
                               [ChatMessage(role="user", content="hi")], None)
    )
    assert text == "ok"
    assert "key=" not in captured["url"], captured["url"]
    assert "AIzaSECRETKEY" not in captured["url"]
    header_blob = " ".join(f"{k}: {v}" for k, v in captured["headers"].items())
    assert "AIzaSECRETKEY" in header_blob, captured["headers"]


def test_gemini_api_key_is_not_in_the_query_string():
    """Spec 6: the source keeps the header form and has no `?key=` interpolation."""
    source = (ROOT / "backend" / "app" / "services" / "ai_service.py").read_text(
        encoding="utf-8"
    )
    assert "key={api_key}" not in source, (
        "the Gemini API key is interpolated into the URL query string and will be written "
        "to the access log. Send it as the x-goog-api-key header instead."
    )
    assert "x-goog-api-key" in source, "the header form is not used anywhere"


def test_provider_error_body_is_not_relayed(monkeypatch, client):
    """Spec 7: the upstream body must not reach the client."""

    async def fake_post(self, url, **kwargs):
        return httpx.Response(
            500,
            text="<html>internal-secret-token-42</html>",
            request=httpx.Request("POST", str(url)),
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    res = client.post(
        "/api/copilot/chat",
        json={
            "project_id": "00000000-0000-0000-0000-000000000000",
            "provider": "openai",
            "api_key": "sk-test",
            "messages": [{"role": "user", "content": "hello"}],
        },
    )
    assert res.status_code == 500
    detail = res.json()["detail"]
    assert "internal-secret-token-42" not in detail, detail
    assert "500" in detail


# ---------------------------------------------------------------------------
# Path containment (spec 8, 9)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "project_id",
    ["../../etc", "..", "not-a-uuid", "00000000000000000000000000000000"],
)
def test_get_project_file_path_rejects_non_uuid(project_id):
    """Spec 8: F-026 - the containment primitive is closed at the source."""
    with pytest.raises(ValueError):
        ProjectService.get_project_file_path(project_id)


def test_get_project_file_path_stays_inside_projects_dir():
    """Spec 8: a UUID resolves inside the storage root."""
    real = ProjectService.get_project_file_path("11111111-1111-1111-1111-111111111111")
    assert real.is_relative_to(settings.PROJECTS_DIR.resolve())


def test_project_id_is_validated_as_a_uuid(client):
    """Spec 9: a non-UUID project_id is a 4xx, never a 500."""
    res = client.get("/api/projects/not-a-uuid")
    assert res.status_code in (404, 422), res.text
    assert "storage" not in res.text.lower()


# ---------------------------------------------------------------------------
# Response hygiene (spec 11, 12)
# ---------------------------------------------------------------------------

def test_tool_error_does_not_leak_a_server_path(client):
    """Spec 12: F-045 - no absolute path in a copilot tool result.

    The payload is serialised with `json.dumps` and matched against a two-backslash drive
    path (`C:\\\\...`), so the `:` followed by an escaped newline (`:\\n`) in the prose does
    not read as a Windows path.
    """
    res = client.post(
        "/api/copilot/chat",
        json={
            "project_id": "00000000-0000-0000-0000-000000000000",
            "provider": "local",
            "messages": [{"role": "user", "content": "count the walls"}],
        },
    )
    assert res.status_code == 200, res.text
    payload = json.dumps(res.json())
    assert "storage" not in payload.lower(), payload
    assert not re.search(r"[A-Za-z]:\\\\", payload), payload


def test_cad_404_does_not_contain_an_absolute_path(client):
    """Spec 11: a missing project file must not describe where the server keeps it."""
    res = client.post(
        "/api/projects/22222222-2222-2222-2222-222222222222/cad/wall",
        json={"start": [0, 0], "end": [1, 0]},
    )
    assert res.status_code == 404, res.text
    detail = res.json()["detail"]
    assert "storage" not in detail.lower(), detail
    assert ":\\" not in detail, detail


def test_error_details_do_not_leak_absolute_paths(client):
    """500 responses must not contain the server's filesystem layout."""
    res = client.post(
        "/api/projects",
        json={"name": "AutoTest-Step20", "schema_version": "NOT_A_SCHEMA"},
    )
    if res.status_code >= 500:
        assert str(settings.BASE_DIR) not in res.text, (
            f"the error response leaks the server root path: {res.text[:300]}"
        )


# ---------------------------------------------------------------------------
# Upload cap (spec 10)
# ---------------------------------------------------------------------------

def test_federated_upload_has_a_size_cap(client, monkeypatch):
    """Spec 10: F-027 - the body is bounded and no partial file is left behind."""
    monkeypatch.setattr(settings, "MAX_SUBMODEL_BYTES", 4096)
    load = client.post("/api/projects/samples/office_pavilion/load")
    assert load.status_code == 201, load.text
    project_id = load.json()["id"]
    try:
        before = client.get(f"/api/projects/{project_id}/models").json()
        res = client.post(
            f"/api/projects/{project_id}/models",
            files={
                "file": (
                    "AutoTest-big.ifc",
                    b"ISO-10303-21;\n" + b"x" * 20000,
                    "application/octet-stream",
                )
            },
            data={"discipline": "ARCH"},
        )
        assert res.status_code == 413, res.text
        after = client.get(f"/api/projects/{project_id}/models").json()
        assert len(after) == len(before)
        models_dir = settings.PROJECTS_DIR / project_id / "models"
        leftovers = (
            [p for p in models_dir.glob("*AutoTest-big*")] if models_dir.exists() else []
        )
        assert leftovers == [], f"partial upload left on disk: {leftovers}"
    finally:
        client.delete(f"/api/projects/{project_id}")
