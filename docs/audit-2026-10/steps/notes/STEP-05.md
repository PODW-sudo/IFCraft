## 2026-10-25 - STEP-05: CORS wildcard, missing API auth and unvalidated WebSocket Origin

- **Type:** Bug
- **Platform:** http://localhost:8000 (verified directly and through `starlette.testclient`)
- **Related tests:** `backend/tests/test_step05_cors_and_auth.py` (canonical, 7 cases);
  `backend/tests/conftest.py`; frontend `step02.singleCommitPath`, `step14.elementDetails`,
  `step29.propertyEditPersistence`
- **Severity:** P0
- **Observed:** `GET /health` with `Origin: https://evil.example.com` answered
  `access-control-allow-origin: https://evil.example.com` plus
  `access-control-allow-credentials: true`, so any page the architect had open could read, mutate
  and delete every local project. `ws://localhost:8000/ws/rooms/<project_id>` was accepted before
  any inspection and would write to the model file on `TRANSFORM_COMMIT`. No endpoint required
  authentication of any kind.
- **Expected:** an explicit Origin allow-list, no cross-origin credentials, a per-install token on
  every `/api` route, `/health` and `/api/bootstrap/token` public, `bootstrap/token` 403 for a
  foreign Origin, and a WebSocket handshake from a foreign Origin refused before `accept()`.
- **Evidence:** live probe against uvicorn on 127.0.0.1:8000 (16/16): foreign `/health` returns no
  `access-control-allow-origin`; foreign preflight 400 with no allow-origin; allowed preflight 200;
  `/api/projects` 401 without a token, 200 with `X-API-Token` and with `Bearer`, 401 with a wrong
  token; `/api/bootstrap/token` 403 for `https://evil.example.com` and 200 for the dev origin and
  for no-Origin clients; `/health` 200 unauthenticated; `/api/health` 401; WS foreign Origin
  refused, allowed and absent Origin accepted. Canonical test went `6 failed, 1 passed` before the
  change to `7 passed` after; full backend suite `124 passed`; frontend `24 files / 173 tests` and
  `tsc -b --noEmit` clean.
- **Suggested fix (landed):** removed `"*"` from `settings.CORS_ORIGINS`; `allow_credentials=False`;
  new `backend/app/core/security.py` (`load_or_create_token`, `require_api_token` with
  `secrets.compare_digest` and a 401); token persisted to `storage/.api_token` (0600 on POSIX, in
  `.gitignore`); new `backend/app/api/bootstrap.py` Origin-gated token endpoint; `api_router`
  mounted behind `Depends(require_api_token)`; WebSocket checks `Origin` against `CORS_ORIGINS`
  before `accept()` and closes 1008 otherwise; `frontend/src/services/api.ts` gained `apiFetch`
  (cached token, one bootstrap request, attached to every `/api` call) and every raw `/api` fetch
  in the app now routes through it (gizmo placement, element details, model download, BCF export);
  `scripts/qa_runner.py` and `scripts/ci_verify.ps1` read `storage/.api_token`.
- **Follow-up:** a foreign-origin WebSocket is refused by uvicorn as an HTTP 403 handshake error,
  because a close frame cannot precede the upgrade; the 1008 close code is only observable in a
  transport that accepts before closing (e.g. `TestClient`). Security outcome is identical - the
  connection is never established and no frame is processed. The download routes are now fetched
  as blobs, so the browser uses the `download` filename supplied by the client rather than
  `Content-Disposition`.
- **Status:** Open (follow-up only; the defect itself is fixed)
