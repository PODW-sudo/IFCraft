# STEP-05 — CORS lockdown, API token, WebSocket Origin check

**Status:** done (2026-10-25) · **Wave:** A · **Effort:** 1 d
**Findings:** F-003 · **Depends on:** — · **Blocks:** STEP-13, STEP-20

## Problem

Any website the architect visits while the editor is open can read, mutate and delete their local
projects. Verified against the running server:

```
$ curl -H 'Origin: https://evil.example.com' http://127.0.0.1:8000/health
access-control-allow-origin: https://evil.example.com
access-control-allow-credentials: true
```

And the WebSocket accepts a connection from any origin and will write to the model file on
`TRANSFORM_COMMIT`.

There is no authentication of any kind on any endpoint.

## Evidence

- `backend/app/core/config.py:31-37` — `CORS_ORIGINS` ends with `"*"`.
- `backend/app/main.py:36-42` — `allow_credentials=True`.
  Starlette mirrors the caller's Origin when `"*"` is present, so the browser treats the response
  as credentialed and allows it.
- `backend/app/api/websocket.py:14-16` — accepts before any project lookup or Origin inspection.
- No `Depends(...)` security dependency anywhere in `backend/app/api/*.py`.

## Scope

**Change:**
- `backend/app/core/config.py` — remove `"*"`, add `API_TOKEN`.
- `backend/app/main.py` — `allow_credentials=False`; add the auth dependency to `api_router`.
- New `backend/app/core/security.py` — token generation/persistence and `require_api_token`.
- `backend/app/api/websocket.py` — validate `Origin` before `accept()`, close with 1008 otherwise.
- `frontend/src/services/api.ts` — send the token on every request.
- `vite.config.ts` — no change needed (the `/api` proxy already exists); the token is fetched at boot.

**Do not change:**
- `/health` — it must stay public for the harness, CI and uptime checks.
- The WebSocket message protocol — only the handshake changes.

**Non-goals:**
- Real user accounts, sessions or roles. This is a local-first app; the threat model is
  *a malicious web page in the user's browser*, not a hostile authenticated user. A single
  process-lifetime token closes it.
- Per-user audit attribution (the client-supplied `user_id` stays spoofable — see STEP-13's notes).

## Spec

1. `CORS_ORIGINS` contains no wildcard and no credentials are allowed cross-origin.
2. A random token is generated on first start and persisted to `storage/.api_token`
   (mode 0600) so it survives restarts and the frontend can be given it once.
3. `GET /api/bootstrap/token` returns `{"token": "..."}` **only** when the request's `Origin` is in
   `CORS_ORIGINS`, or when there is no `Origin` at all (a non-browser client such as the QA
   runner). Otherwise it returns 403. Because `Access-Control-Allow-Origin` is now restricted, a
   foreign page cannot read the response.
4. Every route under `/api` except `bootstrap/token` requires `X-API-Token` (or
   `Authorization: Bearer <token>`) and returns **401** when it is missing or wrong.
5. The WebSocket handler validates `Origin` against `CORS_ORIGINS` **before** `accept()` and closes
   with code **1008** when it does not match. A missing `Origin` is allowed (non-browser clients).
6. The frontend fetches the token once at boot and attaches it to every API and WebSocket call.
7. `scripts/qa_runner.py` and `scripts/ci_verify.ps1` read `storage/.api_token` directly.

## TDD

Canonical test:
[`tests/backend/test_step05_cors_and_auth.py`](../tests/backend/test_step05_cors_and_auth.py).

### 1. Add the failing test

```powershell
Copy-Item docs/audit-2026-10/tests/backend/test_step05_cors_and_auth.py backend/tests/
```

| Test | Asserts |
|---|---|
| `test_cors_origins_do_not_contain_a_wildcard` | no `"*"` in `settings.CORS_ORIGINS` |
| `test_foreign_origin_is_not_allowed` | `Access-Control-Allow-Origin` is not echoed back |
| `test_preflight_from_a_foreign_origin_is_not_allowed` | preflight does not authorise a foreign origin |
| `test_allowed_origin_is_still_permitted` | the dev origin keeps working (regression guard) |
| `test_protected_endpoints_require_a_token` | `/api/projects` returns 401/403 without a token |
| `test_valid_token_is_accepted` | a correct token succeeds |
| `test_websocket_validates_origin_before_accepting` | source contract: Origin check precedes `accept()`, code 1008 |

> **Why the WebSocket test is a source contract and not a handshake:** against the current
> implementation the server accepts and then waits, so `ws.receive()` blocks forever and the test
> hangs rather than fails. Once the fix lands, replace it with a live handshake asserting
> `WebSocketDisconnect(code=1008)`.

### 2. Watch it fail

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step05_cors_and_auth.py -v
```

Verified (2026-10-24): `6 failed, 1 passed` — the one pass is
`test_allowed_origin_is_still_permitted`, which is correct today and must stay correct.

### 3. Implement

```python
# backend/app/core/security.py
import secrets
from pathlib import Path
from fastapi import Depends, Header, HTTPException, Request, status

from .config import settings

TOKEN_FILE = settings.STORAGE_DIR / ".api_token"

def load_or_create_token() -> str:
    if TOKEN_FILE.exists():
        token = TOKEN_FILE.read_text(encoding="utf-8").strip()
        if token:
            return token
    token = secrets.token_urlsafe(32)
    TOKEN_FILE.write_text(token, encoding="utf-8")
    try:
        TOKEN_FILE.chmod(0o600)
    except OSError:
        pass  # Windows: inherit the directory ACL
    return token

def require_api_token(
    x_api_token: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> None:
    expected = settings.API_TOKEN
    supplied = x_api_token
    if not supplied and authorization and authorization.lower().startswith("bearer "):
        supplied = authorization[7:]
    if not supplied or not secrets.compare_digest(supplied, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "A valid API token is required.")
```

```python
# backend/app/main.py
app.add_middleware(CORSMiddleware, allow_origins=settings.CORS_ORIGINS,
                   allow_credentials=False, allow_methods=["*"], allow_headers=["*"])

app.include_router(health_router)                                    # public
app.include_router(bootstrap_router)                                 # public, Origin-gated
app.include_router(api_router, prefix=settings.API_V1_PREFIX,
                   dependencies=[Depends(require_api_token)])        # protected
```

```python
# backend/app/api/websocket.py  — before accept()
origin = websocket.headers.get("origin")
if origin and origin not in settings.CORS_ORIGINS:
    await websocket.close(code=1008)
    return
await websocket.accept()
```

**Frontend:**

```ts
// services/api.ts
let cachedToken: string | null = null;
async function authHeaders(): Promise<Record<string, string>> {
  if (!cachedToken) {
    const res = await fetch(`${BASE_URL}/bootstrap/token`);
    cachedToken = (await res.json()).token;
  }
  return { 'X-API-Token': cachedToken };
}
```

### 4. Watch it pass

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step05_cors_and_auth.py -v
```

Expected: `7 passed`.

### 5. Regression guard

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/ -q
cd frontend; pnpm exec tsc -b --noEmit
```

The existing tests construct `TestClient(app)` and call the API without a token — they will all
start returning 401. **Add a `conftest.py` fixture that sets the token header on the client**, or
have `TestClient` read `storage/.api_token` automatically. Do this as part of the step; do not
weaken the auth to keep them green.

## Acceptance criteria

- [x] `curl -H 'Origin: https://evil.example.com' http://127.0.0.1:8000/api/projects` returns no `Access-Control-Allow-Origin`.
- [x] `GET /api/projects` without a token returns 401.
- [x] `GET /api/projects` with the token from `storage/.api_token` returns 200.
- [x] `GET /health` works with no token.
- [x] `GET /api/bootstrap/token` from a foreign Origin returns 403.
- [x] A WebSocket connection with a foreign Origin is closed with 1008 (verify by hand once fixed).
      *Uvicorn surfaces this as an HTTP 403 handshake rejection - see "Deviations". The connection
      is refused before `accept()` either way.*
- [x] The QA runner still works end to end.
- [x] `storage/.api_token` is in `.gitignore`.

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| The harness and CI break because they send no token | Add a `conftest.py` fixture; make `qa_runner.py` read the token file. Do this in the same commit | Revert the `dependencies=[...]` line only; CORS fix stands independently |
| Token leaking via the bootstrap endpoint | It is Origin-gated and `Access-Control-Allow-Origin` is now restricted. A local malicious process can read the file anyway — that is out of scope | — |
| Users with an existing `storage/.api_token` from a different install | The token is per-install and stored beside the projects; no cross-install sharing | Delete the file to regenerate |
| WebSocket clients that send no Origin (CLI tools) | Spec item 5 allows a missing Origin | — |

## Notes

- **Be honest about what this is.** A process-lifetime bearer token plus Origin validation stops
  *browser-mediated* attacks completely. It does not stop a local process running as the same user,
  and it does not provide per-user identity. Multi-user attribution requires real auth and belongs
  to a later quarter.
- `allow_credentials=False` is intentional. The app uses no cookies; enabling credentials is what
  made the wildcard origin dangerous in the first place.
- While here, add `storage/.api_token` to `.gitignore` next to `storage/projects.db`.

## Notes — implementation (2026-10-25)

**Status:** done. Canonical test `7 passed` (was `6 failed, 1 passed`); full backend suite
`124 passed`; frontend `24 files / 173 tests` and `pnpm exec tsc -b --noEmit` clean; live probe
16/16 against uvicorn.

### What landed

| File | Change |
|---|---|
| `backend/app/core/config.py` | `"*"` removed from `CORS_ORIGINS`; added `API_TOKEN` plus `load_or_create_token()`; token resolved at import so every process agrees |
| `backend/app/core/security.py` (new) | `load_or_create_token()`, `require_api_token()` (`X-API-Token` or `Bearer`, `secrets.compare_digest`, 401) |
| `backend/app/api/bootstrap.py` (new) | `GET /api/bootstrap/token` - 403 for a foreign `Origin`, token for an allowed origin or no `Origin` |
| `backend/app/main.py` | `allow_credentials=False`; health public; bootstrap public; `api_router` behind `Depends(require_api_token)` |
| `backend/app/api/websocket.py` | `Origin` checked against `CORS_ORIGINS` **before** `accept()`, close 1008 otherwise, missing `Origin` allowed |
| `backend/tests/conftest.py` (new) | `TestClient` subclass + `httpx.AsyncClient` patch attach the installation token by default |
| `frontend/src/services/api.ts` | `apiFetch` / `getApiToken` / `setApiToken`; 39 call sites migrated; `downloadProjectFile`, `downloadBcfArchive` blob downloads |
| `frontend/src/hooks/useGizmoTransform.ts` | placement POST through `apiFetch` |
| `frontend/src/components/properties/GlassPropertyInspector.tsx` | details GET through `api.getElementDetails` |
| `frontend/src/hooks/useModelLifecycle.ts` | load-download through `apiFetch`; header download through `downloadProjectFile` (no bare `<a href>`) |
| `frontend/src/components/collaboration/BcfManagerModal.tsx`, `App.tsx` | `.bcfzip` export is a token-authenticated blob download instead of an `<a href>` |
| `frontend/src/tests/setup.ts` | primes the token so exact `fetch` call-count assertions stay meaningful |
| `scripts/qa_runner.py` | `read_api_token()` / `auth_headers()`; every `/api` call sends `X-API-Token` |
| `scripts/ci_verify.ps1` | reads `storage/.api_token`, exports `IFC_API_TOKEN`, new step 5.5 probe (public health / 401 / token accepted) |
| `.gitignore` | `storage/.api_token` |

### Token flow

1. First start: `core/config.py` calls `load_or_create_token()` -> `secrets.token_urlsafe(32)` is
   written to `storage/.api_token` (chmod 0600 on POSIX) and exposed as `settings.API_TOKEN`.
   Subsequent starts read the same file, so restarts do not invalidate the tab that is open.
2. Browser: `services/api.ts` fetches `/api/bootstrap/token` **once**, caches the token in memory
   for the tab, and attaches `X-API-Token` to every `/api` request. Concurrent callers share one
   in-flight bootstrap request.
3. Non-browser clients (`scripts/qa_runner.py`, `scripts/ci_verify.ps1`, curl) read the file
   directly. `Origin` is only a browser concept, so the bootstrap route allows a missing `Origin`.
4. `/health` stays public for the harness, CI and uptime checks; `/api/health` (same handler, inside
   the protected router) requires the token.

### conftest.py and why it is safe

`from starlette.testclient import TestClient` resolves to `TokenTestClient` because the conftest
patches the attribute before test modules are imported. It merges `X-API-Token` into `/api`
requests only, an explicit `X-API-Token`/`Authorization` on the request always wins, and
`X-No-API-Token: 1` opts a single request out. `test_phase1` / `test_phase3` drive the app through
`httpx.AsyncClient(ASGITransport)`, so `httpx.AsyncClient.__init__` is patched to add the same
default header. `require_api_token` still runs on every request - nothing is disabled under pytest.

`test_step05_cors_and_auth.py` is listed in `AUTH_CONTRACT_TEST_MODULES` so it gets a plain client:
its `test_protected_endpoints_require_a_token` case *asserts* the 401 and would be defeated by the
implicit header. That list is the only exemption and it is deliberately explicit.

### Deviations

- **WebSocket close code.** The check runs before `accept()` exactly as specified, but a close frame
  cannot precede the upgrade: uvicorn answers the handshake with **HTTP 403** and the 1008 close
  code is only observable on a transport that accepts first (Starlette's `TestClient`). The
  security outcome is identical - the connection never opens and no frame is read. Kept the
  specified order, since accepting first would reopen the hole for the interval before `close()`.
  The probe logs `InvalidStatus: server rejected WebSocket connection: HTTP 403` for a foreign
  origin and a normal join for the dev origin and for no `Origin`.
- **Vitest token priming.** `src/tests/setup.ts` calls `setApiToken('test-api-token')` instead of
  letting each test bootstrap: `step02` asserts `fetchSpy` call *counts*, so an extra bootstrap
  request would make those assertions lie. The header is still attached on every request.
- **BCF export.** It was an `<a href>` (no header possible) and would have started returning 401.
  Converted to a button that downloads through `apiFetch`. `data-qa="bcf-export-btn"` is unchanged,
  so `qa_runner`'s DOM check still finds it.
- **CORS list.** Added `http://localhost:4173` / `http://127.0.0.1:4173` (`vite preview`'s default
  port); kept the pre-existing `:3000` entries. No wildcard at any position.

### Residual risks

- **Bootstrap race.** Two tabs opening at once each perform one bootstrap request; both get the
  same token, so this is only extra traffic. The token is not persisted in `localStorage`, so a
  reload re-fetches it - deliberate, so a rotated token file cannot leave a stale token in the tab.
  If the bootstrap request fails (backend down), every API call rejects with
  "Failed to obtain the API token", which is the visible symptom rather than a silent 401 storm.
- **Downloads.** The project/BCF downloads are now blob downloads, so the client-side `download`
  filename wins over `Content-Disposition`. Content is byte-identical (verified 124-test suite plus
  the harness's `validate_ifc_export` / `validate_bcf_export`, which read the same routes with the
  header).
- **Origin matching is exact.** `http://localhost:5173/` (trailing slash) or `https://localhost:5173`
  is rejected; browsers never send a trailing slash, so this is a correctness detail rather than a
  usability one.
- **Not in scope, still true.** A local process running as the same user can read
  `storage/.api_token`, and the client-supplied `user_id` stays spoofable (STEP-13). A
  non-browser client that omits `Origin` is allowed by design (spec 5) - the token remains the
  gate for `/api`, but the WebSocket handshake itself is Origin-only, as specified.

