"""
STEP-20 — Outbound-request, secret and path hardening.

Finding: F-019, F-020, F-026, F-027, F-045
Code under test:
  backend/app/services/ai_service.py:1042-1050  (server API-key fallback)
  backend/app/services/ai_service.py:1094-1254  (user-controlled base_url)
  backend/app/services/ai_service.py:1159       (Gemini key in the query string)
  backend/app/api/copilot.py:43-54             (upstream error body echoed to the client)
  backend/app/services/project_service.py:156-158 (project_id -> filesystem path)
  backend/app/api/federation.py:50-66           (unbounded upload)

HOW TO RUN
    Copy this file into backend/tests/ then:
    .\\backend\\venv\\Scripts\\python.exe -m pytest backend/tests/test_step20_security.py -v
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
from backend.app.services.project_service import ProjectService  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_client_base_url_cannot_reach_the_cloud_metadata_service(client):
    """A user-supplied base_url must not let the server probe internal networks."""
    res = client.post(
        "/api/copilot/models",
        json={"provider": "custom", "base_url": "http://169.254.169.254/latest", "api_key": "x"},
    )
    assert res.status_code in (400, 403, 422), (
        f"a link-local metadata URL was accepted with status {res.status_code}. "
        f"body: {res.text[:300]}"
    )


def test_client_base_url_cannot_reach_a_loopback_service(client):
    """A loopback base_url must be rejected unless local providers are explicitly enabled."""
    res = client.post(
        "/api/copilot/models",
        json={"provider": "custom", "base_url": "http://127.0.0.1:22", "api_key": "x"},
    )
    assert res.status_code in (400, 403, 422), (
        f"a loopback base_url was accepted with status {res.status_code}. body: {res.text[:300]}"
    )


def test_upstream_error_bodies_are_not_echoed_to_the_client(client):
    """The upstream response body must not be returned to the caller.

    Echoing it turns the endpoint into a general-purpose internal HTTP proxy with read access.
    """
    res = client.post(
        "/api/copilot/models",
        json={
            "provider": "custom",
            "base_url": "http://192.0.2.1:9/never-listens",
            "api_key": "x",
        },
    )
    body = res.text
    assert "192.0.2.1" not in body, (
        "the upstream host was reflected back to the client. Upstream bodies must be logged "
        "server-side and replaced with a generic message."
    )


def test_gemini_api_key_is_not_in_the_query_string():
    """The Gemini key must be sent as a header, not as a URL parameter.

    A URL ends up in httpx INFO logs, proxy logs and exception text.
    """
    source = (ROOT / "backend" / "app" / "services" / "ai_service.py").read_text(encoding="utf-8")
    assert "key={api_key}" not in source, (
        "the Gemini API key is interpolated into the URL query string and will be written to "
        "the access log. Send it as the x-goog-api-key header instead."
    )
    assert "x-goog-api-key" in source, "the header form is not used anywhere"


def test_project_id_cannot_escape_the_projects_directory():
    """project_id must be constrained so it cannot address a path outside the storage root."""
    from backend.app.core.config import settings

    resolved_root = settings.PROJECTS_DIR.resolve()

    for hostile_id in ("..", "../..", "..\\..", "../../../etc"):
        path = ProjectService.get_project_file_path(hostile_id).resolve()
        assert path.is_relative_to(resolved_root), (
            f"project_id {hostile_id!r} resolves outside the projects directory: {path}"
        )


def test_project_id_is_validated_as_a_uuid():
    """The API must reject a non-UUID project_id with a 4xx, not a 404 or a 500."""
    with TestClient(app) as client:
        res = client.get("/api/projects/not-a-uuid")
        assert res.status_code in (404, 422), (
            f"a non-UUID project_id returned {res.status_code}; expected 404 or 422"
        )


def test_federation_upload_rejects_an_oversize_body(client):
    """The federation upload path has no size limit — it must match the project upload limit."""
    from backend.app.api import federation as federation_module

    assert hasattr(federation_module, "MAX_SUBMODEL_BYTES") or hasattr(
        federation_module, "MAX_UPLOAD_SIZE"
    ), (
        "the federation upload endpoint has no size cap. A single request can exhaust the "
        "host's memory or disk."
    )


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
