# STEP-20 — SSRF, secret in URL, path containment, upload limits

**Status:** done (2026-10-25) · **Wave:** C · **Effort:** 2 d
**Findings:** F-019, F-020, F-026, F-027, F-045 · **Depends on:** STEP-05 · **Blocks:** —

## Problem

The copilot will POST to any URL a caller supplies and echo the remote body back, so the backend can be used as a proxy to reach hosts the user's browser cannot — including link-local metadata endpoints — and with no `api_key` it spends **the server's** paid quota for any anonymous caller. The Gemini key travels in a query string, where `httpx`'s INFO log records it in plaintext. Federation uploads have no size limit and buffer the whole body in RAM, and absolute server paths leak into error responses.

## Evidence

- `backend/app/services/ai_service.py:1110-1117` — `provider == "custom"` passes `request.base_url` straight into `_call_openai`; `:1119-1120` — `ollama` likewise.
- `backend/app/services/ai_service.py:1231` — `url = f"{base_url.rstrip('/')}/chat/completions"` — no scheme, host or address check.
- `backend/app/services/ai_service.py:445`, `:546`, `:578-584` — the three model-discovery paths do the same with `GET`.
- `backend/app/services/ai_service.py:1253-1254` — `raise RuntimeError(f"OpenAI API returned error {resp.status_code}: {resp.text}")`; `backend/app/api/copilot.py:49-54` returns `detail=f"AI Copilot execution error: {str(e)}"`. The remote body is relayed verbatim.
- `backend/app/services/ai_service.py:1042-1050` — a request without `api_key` falls back to `settings.GEMINI_API_KEY` / `OPENAI_API_KEY` / … with no authentication in front of the endpoint (F-003 is STEP-05; this step must not depend on it for safety).
- `backend/app/services/ai_service.py:1159` — `url = f"...:generateContent?key={api_key}"`.
- `backend/app/services/project_service.py:156-158` — `get_project_file_path(project_id)` returns `settings.PROJECTS_DIR / project_id / "model.ifc"` with no `UUID` parse and no `resolve()` containment check. Measured probes in `VERIFICATION.md` §2.5 returned 404 for `..%2f..%2f`, so the primitive is latent, not live.
- `backend/app/api/federation.py:61` — `content = await file.read()` with no cap; `:50-51` accepts `.ifczip`, so a small archive can expand far beyond RAM.
- `backend/app/services/ai_service.py:619` — `return {"error": f"Project file {file_path} not found."}` — an absolute Windows path in a tool result the client can read.
- `backend/app/api/cad.py:36-40` — `except FileNotFoundError as e: raise HTTPException(404, detail=str(e))`; `backend/app/api/projects.py:232-237`, `:254-258` — the same pattern with `str(e)` from `ifcopenshell`.

## Scope

**Change:**

- `backend/app/core/net_guard.py` — **new module**: `class UrlNotAllowed(ValueError)`, `validate_outbound_url(url, *, allow_private: bool) -> str`.
- `backend/app/core/config.py:13-41` — add `MAX_SUBMODEL_BYTES: int = 250 * 1024 * 1024` and `AI_CLOUD_HOSTS: dict[str, str]` (the fixed base URLs).
- `backend/app/services/ai_service.py:1094-1120` — cloud providers use the fixed base URL from config and **ignore** `request.base_url`; `custom`/`ollama` validate through `validate_outbound_url(..., allow_private=True)`.
- `backend/app/services/ai_service.py:445`, `:545-546`, `:578-584` — the three `_fetch_*_models` paths validate their URL the same way before the request.
- `backend/app/services/ai_service.py:1159` — send the Gemini key in an `x-goog-api-key` header; drop `?key=`.
- `backend/app/services/ai_service.py:1253-1254` (and the Gemini/Anthropic equivalents at `:1193-1194`, `:1312-1313`) — raise with status code only; log a truncated body at DEBUG.
- `backend/app/services/project_service.py:155-158` — `get_project_file_path` parses a UUID and enforces `resolved.is_relative_to(settings.PROJECTS_DIR.resolve())`.
- `backend/app/services/ai_service.py:617-619` — tool errors must not interpolate `file_path`.
- `backend/app/api/federation.py:61-63` — chunked read with a `MAX_SUBMODEL_BYTES` cap → `413`.
- `backend/app/api/cad.py:36-40`, `backend/app/api/projects.py:233-237`, `:254-258`, `:332-336` — return a fixed message, log the exception with its path.

**Do not change:**

- Authentication, CORS and WS Origin (F-003) — that is STEP-05 and this step must be independently shippable. If STEP-05 has not landed, the SSRF and quota findings are still *reduced* (fewer reachable hosts) but not closed; say so in the handoff.
- `_call_gemini` / `_call_openai` / `_call_anthropic` request **bodies** — no schema changes.
- The `.ifczip` extraction added by STEP-16 (already bounded). This step adds the *request body* cap that STEP-16 deliberately left out.

**Non-goals:**

- A per-user quota or rate limiter (needs STEP-05's identity).
- TLS pinning or an outbound proxy allowlist at the OS level.
- Rewriting `delete_project`/`create_project` paths — they use the same `get_project_file_path`, so they inherit containment for free.

## Spec

1. `validate_outbound_url` accepts only `http`/`https`, rejects userinfo (`user@host`), rejects a missing host, and rejects any URL whose resolved addresses include link-local (`169.254.0.0/16`, `fe80::/10`), unspecified (`0.0.0.0`, `::`), multicast or reserved ranges.
2. With `allow_private=False`, loopback (`127.0.0.0/8`, `::1`, `localhost`) and RFC1918 (`10/8`, `172.16/12`, `192.168/16`) are also rejected.
3. `POST /api/copilot/models` and `POST /api/copilot/chat` for providers `gemini`, `claude`, `openai`, `openrouter` **ignore** `request.base_url` entirely and use the fixed URL from `settings.AI_CLOUD_HOSTS`.
4. For `custom` and `ollama`, a `base_url` that fails `validate_outbound_url(..., allow_private=True)` returns `400` with `detail` beginning `"base_url not allowed:"` and makes **no** outbound request.
5. `GET/POST /api/copilot/models` with `provider=custom, base_url=http://169.254.169.254/latest/meta-data/` returns `400`, and the response arrives in under 1 s (proving no connect attempt was made).
6. The Gemini request carries the key in an `x-goog-api-key` header and the URL contains no `key=` query parameter.
7. A provider error no longer relays the upstream body: the client-visible message is `"<Provider> API returned error <code>"`, and the body appears only in the server log at `DEBUG`, truncated to 512 characters.
8. `ProjectService.get_project_file_path` raises `ValueError` for a non-UUID `project_id`, and for any path that resolves outside `PROJECTS_DIR`.
9. Every API route that resolves a project **before** calling `get_project_file_path` returns `404` for a non-UUID id (the DB lookup already misses), never `500`.
10. `POST /api/projects/{id}/models` returns `413` when the received body exceeds `settings.MAX_SUBMODEL_BYTES`, and the partially written file is removed.
11. No HTTP error response body contains the substring `storage` or a drive-letter path fragment (`:\`) belonging to the server.
12. `AIService.execute_tool` on a missing project returns `{"error": "Project model file not found."}` with no path.

## TDD

### 1. Add the failing test

**File:** `backend/tests/test_step20_security.py`
**Command:** `.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step20_security.py -v`

<details>
```python
import asyncio
import sys
import time
from pathlib import Path

import httpx
import pytest
from starlette.testclient import TestClient

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.app.core.config import settings
from backend.app.main import app
from backend.app.models.schemas import ChatMessage
from backend.app.services import ai_service
from backend.app.services.ai_service import AIService
from backend.app.services.project_service import ProjectService


def test_cloud_providers_ignore_client_base_url():
    """Spec 3: a caller cannot redirect a cloud provider at an arbitrary host."""
    with TestClient(app) as client:
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
def test_custom_provider_rejects_unsafe_base_urls(base_url):
    """Spec 4 and 5: refused before any socket is opened."""
    with TestClient(app) as client:
        started = time.perf_counter()
        res = client.post(
            "/api/copilot/models", json={"provider": "custom", "base_url": base_url}
        )
        elapsed = time.perf_counter() - started

        assert res.status_code == 400, res.text
        assert "base_url not allowed" in res.json()["detail"].lower()
        assert elapsed < 1.0, f"{elapsed:.2f}s — a connection attempt was made"


def test_loopback_still_works_for_local_providers():
    """Spec 2, 4: custom/ollama keep their documented localhost use case."""
    with TestClient(app) as client:
        res = client.post(
            "/api/copilot/models",
            json={"provider": "custom", "base_url": "http://127.0.0.1:59999/v1"},
        )
        assert res.status_code == 200, res.text
        assert "not allowed" not in (res.json().get("error") or "").lower()


def test_gemini_key_is_sent_as_a_header(monkeypatch):
    """Spec 6: F-020 — no secret in the query string."""
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


def test_provider_error_body_is_not_relayed(monkeypatch):
    """Spec 7: the upstream body must not reach the client."""

    async def fake_post(self, url, **kwargs):
        return httpx.Response(
            500,
            text="<html>internal-secret-token-42</html>",
            request=httpx.Request("POST", str(url)),
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    with TestClient(app) as client:
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


@pytest.mark.parametrize(
    "project_id",
    ["../../etc", "..", "not-a-uuid", "00000000000000000000000000000000"],
)
def test_get_project_file_path_rejects_non_uuid(project_id):
    """Spec 8: F-026 — the containment primitive is closed at the source."""
    with pytest.raises(ValueError):
        ProjectService.get_project_file_path(project_id)


def test_get_project_file_path_stays_inside_projects_dir():
    """Spec 8: a UUID that resolves outside the root is refused."""
    real = ProjectService.get_project_file_path("11111111-1111-1111-1111-111111111111")
    assert real.is_relative_to(settings.PROJECTS_DIR.resolve())


def test_tool_error_does_not_leak_a_server_path():
    """Spec 12: F-045 — no absolute path in a copilot tool result."""
    with TestClient(app) as client:
        res = client.post(
            "/api/copilot/chat",
            json={
                "project_id": "00000000-0000-0000-0000-000000000000",
                "provider": "local",
                "messages": [{"role": "user", "content": "count the walls"}],
            },
        )
        assert res.status_code == 200, res.text
        payload = str(res.json())
        assert "storage" not in payload.lower(), payload
        assert ":\\" not in payload, payload


def test_federated_upload_has_a_size_cap(monkeypatch):
    """Spec 10: F-027 — the body is bounded and the partial file removed."""
    monkeypatch.setattr(settings, "MAX_SUBMODEL_BYTES", 4096)
    with TestClient(app) as client:
        load = client.post("/api/projects/samples/office_pavilion/load")
        assert load.status_code == 201, load.text
        project_id = load.json()["id"]
        try:
            before = client.get(f"/api/projects/{project_id}/models").json()
            res = client.post(
                f"/api/projects/{project_id}/models",
                files={"file": ("AutoTest-big.ifc", b"ISO-10303-21;\n" + b"x" * 20000, "application/octet-stream")},
                data={"discipline": "ARCH"},
            )
            assert res.status_code == 413, res.text
            after = client.get(f"/api/projects/{project_id}/models").json()
            assert len(after) == len(before)
            models_dir = settings.PROJECTS_DIR / project_id / "models"
            leftovers = [p for p in models_dir.glob("*AutoTest-big*")] if models_dir.exists() else []
            assert leftovers == [], f"partial upload left on disk: {leftovers}"
        finally:
            client.delete(f"/api/projects/{project_id}")


def test_cad_404_does_not_contain_an_absolute_path():
    """Spec 11: a missing project file must not describe where the server keeps it."""
    with TestClient(app) as client:
        res = client.post(
            "/api/projects/22222222-2222-2222-2222-222222222222/cad/wall",
            json={"start": [0, 0], "end": [1, 0]},
        )
        assert res.status_code == 404, res.text
        detail = res.json()["detail"]
        assert "storage" not in detail.lower(), detail
        assert ":\\" not in detail, detail
```
</details>

### 2. Watch it fail

```
$ .\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step20_security.py -v
FAILED backend/tests/test_step20_security.py::test_cloud_providers_ignore_client_base_url
  E   AssertionError: '169.254' is in "Cannot connect to OpenAI: [Errno 11001] ... 169.254.169.254"
       (the client base_url was used)
FAILED backend/tests/test_step20_security.py::test_custom_provider_rejects_unsafe_base_urls[http://169.254.169.254/latest/meta-data/]
  E   assert 200 == 400
FAILED backend/tests/test_step20_security.py::test_custom_provider_rejects_unsafe_base_urls[file:///C:/Windows/win.ini]
  E   assert 200 == 400
FAILED backend/tests/test_step20_security.py::test_gemini_key_is_sent_as_a_header
  E   AssertionError: 'key=' unexpectedly found in the captured URL
FAILED backend/tests/test_step20_security.py::test_provider_error_body_is_not_relayed
  E   AssertionError: 'internal-secret-token-42' is in "AI Copilot execution error: OpenAI API returned error 500: <html>internal-secret-token-42</html>"
FAILED backend/tests/test_step20_security.py::test_get_project_file_path_rejects_non_uuid[../../etc]
  E   Failed: DID NOT RAISE <class 'ValueError'>
FAILED backend/tests/test_step20_security.py::test_tool_error_does_not_leak_a_server_path
  E   AssertionError: 'storage' is in '{"tool_calls": [{"result": {"error": "Project file
      C:\\Users\\...\\storage\\projects\\00000000-...\\model.ifc not found."}}]}'
FAILED backend/tests/test_step20_security.py::test_federated_upload_has_a_size_cap
  E   assert 422 == 413
PASSED backend/tests/test_step20_security.py::test_loopback_still_works_for_local_providers
PASSED backend/tests/test_step20_security.py::test_get_project_file_path_stays_inside_projects_dir
```

### 3. Implement

1. **New file** `backend/app/core/net_guard.py`:
   ```python
   import ipaddress
   import socket
   from urllib.parse import urlsplit

   class UrlNotAllowed(ValueError):
       """Raised when an outbound URL is outside the permitted address space."""

   _DENIED_ALWAYS = (
       ipaddress.ip_network("0.0.0.0/8"),
       ipaddress.ip_network("169.254.0.0/16"),
       ipaddress.ip_network("224.0.0.0/4"),
       ipaddress.ip_network("240.0.0.0/4"),
       ipaddress.ip_network("fe80::/10"),
       ipaddress.ip_network("ff00::/8"),
   )
   _DENIED_UNLESS_PRIVATE = (
       ipaddress.ip_network("127.0.0.0/8"),
       ipaddress.ip_network("10.0.0.0/8"),
       ipaddress.ip_network("172.16.0.0/12"),
       ipaddress.ip_network("192.168.0.0/16"),
       ipaddress.ip_network("::1/128"),
       ipaddress.ip_network("fc00::/7"),
   )

   def validate_outbound_url(url: str, *, allow_private: bool = False) -> str:
       """Return the normalised URL or raise UrlNotAllowed."""
   ```
   Implementation: `split = urlsplit(url)`; require `split.scheme in {"http","https"}`, `split.hostname`, and no `@` in `split.netloc`. Resolve with `socket.getaddrinfo(split.hostname, split.port or 80, proto=socket.IPPROTO_TCP)`; for every result `ip = ipaddress.ip_address(sockaddr[0])` — deny if in `_DENIED_ALWAYS`, deny if `_DENIED_UNLESS_PRIVATE` and not `allow_private`. On `socket.gaierror` → `UrlNotAllowed("host could not be resolved")`. Return `url.rstrip("/")`.
2. `backend/app/core/config.py` — add to `Settings`:
   ```python
   MAX_SUBMODEL_BYTES: int = 250 * 1024 * 1024
   AI_CLOUD_HOSTS: dict[str, str] = {
       "openai": "https://api.openai.com/v1",
       "openrouter": "https://openrouter.ai/api/v1",
   }
   ```
   (Gemini and Anthropic URLs are already literals at `ai_service.py:1159` and `:1278`.)
3. `backend/app/services/ai_service.py:1094` — `_call_openai(..., settings.AI_CLOUD_HOSTS["openai"], ...)`; `:1096` — `openrouter_base = settings.AI_CLOUD_HOSTS["openrouter"]`. `request.base_url` is now unused for those branches.
4. `backend/app/services/ai_service.py:1109-1120` — wrap both local branches:
   ```python
   try:
       custom_base = validate_outbound_url((request.base_url or "http://localhost:8000/v1").strip(), allow_private=True)
   except UrlNotAllowed as exc:
       raise ValueError(f"base_url not allowed: {exc}") from exc
   ```
   and the same for `ollama`. In `backend/app/api/copilot.py:46-54`, map `ValueError` → `400`.
5. `backend/app/services/ai_service.py:444-445`, `:544-546`, `:577-584` — call `validate_outbound_url(base_url, allow_private=True)` first; on failure return `([], f"base_url not allowed: {exc}")` so the models endpoint reports `400` (raise `ValueError` instead if you route it through the API layer — keep the 400 contract in spec 4).
6. `backend/app/services/ai_service.py:1159` — 
   ```python
   url = f"https://generativelanguage.googleapis.com/v1beta/models/{clean_model}:generateContent"
   headers = {"x-goog-api-key": api_key, "Content-Type": "application/json"}
   ```
   and pass `headers=headers` to `client.post`.
7. `backend/app/services/ai_service.py:1193-1194`, `:1253-1254`, `:1312-1313` — replace the f-string with
   ```python
   logger.debug("%s error body (truncated): %s", provider_label, resp.text[:512])
   raise RuntimeError(f"{provider_label} API returned error {resp.status_code}")
   ```
8. `backend/app/services/project_service.py:155-158` —
   ```python
   @classmethod
   def get_project_file_path(cls, project_id: str) -> Path:
       try:
           uuid.UUID(str(project_id))
       except (ValueError, AttributeError, TypeError) as exc:
           raise ValueError(f"Invalid project id: {project_id!r}") from exc
       root = settings.PROJECTS_DIR.resolve()
       candidate = (root / str(project_id) / "model.ifc").resolve()
       if not candidate.is_relative_to(root):
           raise ValueError("Resolved project path escapes the storage root.")
       return candidate
   ```
   (`Path.is_relative_to` requires Python 3.9+; the venv is 3.11+.) Callers that already did a DB lookup keep working; `backend/app/api/websocket.py:119`, the 14 `CADService` methods, `bcf_service.py:162`, `:359` and the six `projects.py` handlers inherit the guarantee. **`backend/app/api/federation.py` does not use this helper** — it builds `settings.PROJECTS_DIR / project_id / "models" / …` at `:53-59`, `:109`, `:128` — so audit those three sites separately and add an explicit `uuid.UUID` parse on the `project_id` path parameter.
9. `backend/app/services/ai_service.py:617-619` — `return {"error": "Project model file not found."}` (log the path at `DEBUG`).
10. `backend/app/api/federation.py:61-80` — replace `await file.read()` with a loop reading `1 MB` chunks, accumulating into a `bytearray`, raising `HTTPException(413, "Sub-model exceeds the maximum allowed size.")` once `len(buf) > settings.MAX_SUBMODEL_BYTES`. Keep the existing `try/except` unlink at `:67-70`; the 413 must be raised **inside** it so the partial file is removed.
11. `backend/app/api/cad.py:36-40` (and the sibling handlers at `:50-54`, `:64-68`, `:78-81`, `:121-127`, `:155-161`, `:172-178`, `:206-212`) — replace `detail=str(e)` for `FileNotFoundError` with `detail="Project model file not found."` and `logger.warning("...: %s", e)`. Same for `backend/app/api/projects.py:233-237`, `:254-258`, `:332-336` and `backend/app/api/federation.py:151-153`.

### 4. Watch it pass

```
$ .\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step20_security.py -v
PASSED backend/tests/test_step20_security.py::test_cloud_providers_ignore_client_base_url
PASSED backend/tests/test_step20_security.py::test_custom_provider_rejects_unsafe_base_urls[http://169.254.169.254/latest/meta-data/]
PASSED backend/tests/test_step20_security.py::test_custom_provider_rejects_unsafe_base_urls[file:///C:/Windows/win.ini]
PASSED backend/tests/test_step20_security.py::test_custom_provider_rejects_unsafe_base_urls[ftp://example.com/v1]
PASSED backend/tests/test_step20_security.py::test_custom_provider_rejects_unsafe_base_urls[http://user:pass@127.0.0.1:8000/v1]
PASSED backend/tests/test_step20_security.py::test_custom_provider_rejects_unsafe_base_urls[]
PASSED backend/tests/test_step20_security.py::test_loopback_still_works_for_local_providers
PASSED backend/tests/test_step20_security.py::test_gemini_key_is_sent_as_a_header
PASSED backend/tests/test_step20_security.py::test_provider_error_body_is_not_relayed
PASSED backend/tests/test_step20_security.py::test_get_project_file_path_rejects_non_uuid[../../etc]
PASSED backend/tests/test_step20_security.py::test_get_project_file_path_stays_inside_projects_dir
PASSED backend/tests/test_step20_security.py::test_tool_error_does_not_leak_a_server_path
PASSED backend/tests/test_step20_security.py::test_federated_upload_has_a_size_cap
PASSED backend/tests/test_step20_security.py::test_cad_404_does_not_contain_an_absolute_path
14 passed
```

### 5. Regression guard

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/ -q
cd frontend; pnpm exec tsc -b --noEmit
cd frontend; pnpm exec vitest run
.\scripts\ui_pipeline.ps1 -Tier quick
```

`backend/tests/test_phase6.py:44-53` asserts `custom` with `base_url=http://127.0.0.1:59999/v1` returns `200 connected:false` and a non-null `error` — spec 2/4 keep loopback reachable, so this must stay green. If it goes red, the private-range allowance is wrong.

## Acceptance criteria

- [ ] `POST /api/copilot/models {"provider":"openai","base_url":"http://169.254.169.254/..."}` returns `200` and the error text contains no `169.254`.
- [ ] Five unsafe `base_url` values return `400` in under 1 s each.
- [ ] `http://127.0.0.1:59999/v1` for `custom` still behaves as before (200, `connected:false`).
- [ ] The captured Gemini request URL contains no `key=`; the key is in `x-goog-api-key`.
- [ ] A mocked 500 with a secret body produces a `500` detail without that body, containing the status code.
- [ ] `get_project_file_path` raises `ValueError` for the four non-UUID inputs and returns a path inside `PROJECTS_DIR` for a valid UUID.
- [ ] A copilot tool error on a missing project contains neither `storage` nor `:\`.
- [ ] A 20 KB federated upload with `MAX_SUBMODEL_BYTES=4096` returns `413`, adds no `project_models` row, and leaves no file in `models/`.
- [ ] `pytest backend/tests -q` shows no new failures beyond F-011.

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| DNS resolution at request time adds latency and a TOCTOU window (rebinding between check and connect) | The check is one `getaddrinfo` (~1 ms for a cached name); rebinding remains theoretically possible. Full defence is a custom `httpx` transport that pins the resolved IP — out of scope, noted below | N/A |
| Ignoring `base_url` for `openai` breaks a user behind an OpenAI-compatible Azure/proxy endpoint | Such users have `custom` — that is what it exists for. Say so in the release note | Restore `request.base_url or settings.AI_CLOUD_HOSTS["openai"]` for `openai` only |
| `getaddrinfo` fails on an offline machine, so `ollama` at `http://localhost:11434` is rejected | `localhost` resolves from the hosts file; only a machine with a broken resolver is affected. Fall back to a literal-IP parse before DNS: if `hostname` is already an IP literal, skip resolution | Allow unresolved hostnames for `custom`/`ollama` only |
| UUID validation breaks a caller that used a non-UUID project id | `create_project` and `import_project_from_bytes` both generate `uuid4()` (`project_service.py:24`, `:73`); no legitimate id is non-UUID | Drop the `uuid.UUID` parse, keep the `resolve()` containment check |
| Path containment raises where a caller expected `None`/404 | Every route calls `get_project` first and 404s before this line; the two exceptions are `delete_project` (`:189`) and `record_edit` (`:219`), both of which use a DB-sourced id | Catch `ValueError` in those two call sites |

## Notes

- **Order matters with STEP-05.** With no auth, `custom`/`ollama` are still open to any local page — restricted to loopback and RFC1918, which is what those providers legitimately are, but an anonymous caller can still spend the server's *cloud* key. Spec 3 does not close that. Register this explicitly in the handoff: **F-019's quota half is only closed by STEP-05.** Do not mark F-019 resolved on this step alone.
- **`urlsplit` does not normalise `http://127.1`** — `getaddrinfo` resolves it to `127.0.0.1`, and the address check catches it because the check happens on the resolved IP, not the string. That is why the guard resolves rather than regexes.
- **Never log the key.** Step 6 moves it to a header; `httpx` logs headers at `DEBUG` only, and `logging.basicConfig(level=INFO)` at `backend/app/main.py:13-16` keeps it out of the default log. Do not raise the global level to `DEBUG` in production.
- **Not verified:** F-019, F-020, F-026, F-027 and F-045 are all `[L]` in `FINDINGS.md`. The only related measurement in `VERIFICATION.md` is §2.5 (path-traversal probes returned `404`), which is why the containment fix is framed as closing a *latent* primitive rather than a live exploit.
- **CORS is still wildcard after this step** (`backend/app/core/config.py:31-37`, `backend/app/main.py:36-42`). A malicious page can still call these endpoints; STEP-20 only reduces what those calls can reach and leak.

## Notes — implementation (2026-10-25)

**Status:** done. STEP-20 test `49 passed` (canonical stub was `6 failed, 2 passed` on the
untouched tree, with two of its assertions reconciled to this spec — see below); full backend
suite `173 passed` (was `124`); frontend `24 files / 173 tests` and `pnpm exec tsc -b --noEmit`
clean.

### What landed

| File | Change |
|---|---|
| `backend/app/core/net_guard.py` (new) | `UrlNotAllowed`; `validate_outbound_url(url, *, allow_private)` — scheme, userinfo, host, then the *resolved* address class |
| `backend/app/core/config.py` | `MAX_SUBMODEL_BYTES = 250 MB`; `AI_CLOUD_HOSTS = {openai, openrouter}`. CORS and `API_TOKEN` untouched |
| `backend/app/services/ai_service.py` | `_validated_local_base_url()` gate; cloud providers read the fixed host from config and ignore `request.base_url`; the three `_fetch_*_models` re-validate; Gemini key in `x-goog-api-key`; `<Provider> API returned error <code>` + `DEBUG` body (512 chars); `execute_tool` returns `"Project model file not found."` |
| `backend/app/api/copilot.py` | `_discover_models()` maps `ValueError` → 400; chat maps `ValueError` → 400, `RuntimeError` → 500 with its (now safe) message, anything else → 500 with a fixed sentence |
| `backend/app/api/federation.py` | 1 MB chunked read against `MAX_SUBMODEL_BYTES` → 413 before any write; `_require_uuid()` on the routes that build their own storage paths; fixed 500 text for clash failures |
| `backend/app/api/cad.py` | `FileNotFoundError` → 404 `"Project model file not found."` (+ `logger.warning` with the path); all 500 details → `_CAD_FAILURE_DETAIL` |
| `backend/app/api/projects.py` | same treatment for the download/spatial-tree/element/placement/property/delete handlers; `_IO_FAILURE_DETAIL` |
| `backend/app/services/project_service.py` | `get_project_file_path` confirmed (STEP-03 already had UUID + `resolve()` containment); **added** rejection of the bare 32-hex UUID spelling, which `uuid.UUID` accepts but no stored directory uses |
| `backend/tests/test_step20_security.py` (new) | 49 cases: guard unit table, provider endpoints, transport, containment, response hygiene, upload cap |

### Outbound URL policy

| Input | Result |
|---|---|
| scheme ≠ `http`/`https` (`file:`, `ftp:`, …) | deny |
| `user:pass@host` in the netloc | deny |
| missing host / empty URL / unparsable port | deny |
| `0.0.0.0/8` (unspecified) | deny always |
| `169.254.0.0/16`, `fe80::/10` (link-local) | deny always |
| `224.0.0.0/4`, `ff00::/8` (multicast) | deny always |
| `240.0.0.0/4` (reserved) | deny always |
| `127.0.0.0/8`, `::1/128` (loopback) | allow only with `allow_private=True` |
| `10/8`, `172.16/12`, `192.168/16`, `fc00::/7` | allow only with `allow_private=True` |
| any other non-globally-routable address (`192.0.2/24`, `100.64/10`, `198.18/15`, …) | deny |
| globally routable | allow |
| unresolvable hostname | deny (`host could not be resolved`) |

`allow_private=True` is passed only by `custom`/`ollama` and by the three `_fetch_*_models`
helpers; `openai`/`openrouter` receive a server-fixed URL, so their allowance is inert.

### Upload caps

- Project upload: `250 MB` (unchanged, `api/projects.py:MAX_UPLOAD_SIZE`).
- Federated sub-model: `settings.MAX_SUBMODEL_BYTES` = `250 MB`, read in 1 MB chunks, `413` on
  exceed, nothing written to disk or to `project_models`.
- `.ifczip` member extraction: unchanged (STEP-16 cap). The request cap is checked *before*
  extraction, so an archive is never unpacked from an oversize body.

### Deviations from the canonical test file

1. `test_client_base_url_cannot_reach_a_loopback_service` required `custom` +
   `http://127.0.0.1:22` to be refused. That contradicts spec 2/4 and
   `test_phase6.py:44-53` (and the documented local-model workflow): local providers get
   `allow_private=True`. The binding contract is `test_loopback_still_works_for_local_providers`.
2. `test_project_id_cannot_escape_the_projects_directory` expected `get_project_file_path("..")`
   to return a path *inside* the root. Spec 8 requires `ValueError`; the step test is kept, which
   is strictly stronger.
3. `test_upstream_error_bodies_are_not_echoed_to_the_client` posts `http://192.0.2.1:9/...` and
   asserts the host is not reflected. Satisfied because the guard denies TEST-NET-1 and the refusal
   reason never includes the address — but the literal spec lists do not mention that range, so the
   guard additionally denies any address that is not globally routable (`ip.is_global`), which is
   what spec 1's "reserved ranges" asks for.
4. `test_tool_error_does_not_leak_a_server_path` (step version) matched the substring `":\\"` in
   `str(payload)`, which also matches the `:\n` of normal prose in the local engine's reply. The
   landed test asserts on `json.dumps(payload)` against a two-backslash drive pattern
   (`[A-Za-z]:\\\\`); same intent, no false positive.
5. `custom` with an empty `base_url` is now `400 base_url not allowed: URL is empty` instead of
   `200` + `"Base URL required for Custom Provider"` (spec 4 requires the 400).
6. Beyond the letter of the scope: every `500` body in `cad.py`/`projects.py`/`federation.py` and
   the copilot route now returns a fixed sentence, because spec 11 bans `storage` and `:\` from
   *any* error body and an ifcopenshell `RuntimeError` quotes the model path. `4xx` messages that
   describe the caller's own mistake (`Element #12 not found`, the 422 value-type reason) are
   unchanged.
7. `federation.py` got an explicit `uuid.UUID` parse on `project_id` even though its DB lookup
   already 404s, per the scope note that these routes bypass `get_project_file_path`.

### Residual risk

- The check resolves DNS, then `httpx` resolves again for the connection, so a rebinding window
  remains. Closing it needs a transport that pins the resolved IP — out of scope (spec's risk
  table).
- No per-user quota or rate limit: F-019's quota half still depends on identity. STEP-05 landed a
  single per-install token, so an anonymous page can no longer reach these routes, but anyone
  holding the local token can still spend the server's cloud key. **F-019 is not fully resolved by
  this step.**
- CORS is an explicit local allow-list after STEP-05 (the note in this doc's list above is stale on
  that point).

