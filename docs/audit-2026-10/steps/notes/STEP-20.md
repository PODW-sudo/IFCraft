## 2026-10-25 - STEP-20: SSRF via copilot `base_url`, secret in the Gemini URL, unbounded federation upload, path leakage in errors

- **Type:** Bug
- **Platform:** http://localhost:8000 (verified through `starlette.testclient`)
- **Related tests:** `backend/tests/test_step20_security.py` (49 cases, canonical stub reconciled
  to the step spec - see the "Deviations" note in the file docstring);
  `backend/tests/test_phase6.py:44-53` (loopback contract); `test_step16_ifczip_upload.py`
- **Severity:** P0
- **Observed:** `POST /api/copilot/models {"provider":"custom","base_url":"http://169.254.169.254/latest/meta-data/"}`
  returned `200` and the server connected to the cloud-metadata endpoint. `openai`/`openrouter`
  also honoured the caller's `base_url` for both discovery and chat, so any caller could aim the
  server's paid key - and its outbound network position - at an arbitrary host. The Gemini key
  travelled as `?key=` in the request URL, which `httpx` writes to its INFO log. The federation
  upload did `await file.read()` with no bound, buffering the whole body in RAM. `FileNotFoundError`
  messages (which quote `C:\...\storage\projects\<id>\model.ifc`) were relayed verbatim as `404`
  details, and `AIService.execute_tool` returned the absolute path in a tool result.
- **Expected:** an outbound URL policy that refuses non-HTTP schemes, userinfo, link-local,
  unspecified, multicast, reserved and non-globally-routable addresses (loopback/RFC1918 only for
  the local providers), a server-fixed cloud endpoint, the Gemini key in `x-goog-api-key`, provider
  errors reduced to `<Provider> API returned error <code>` with the body at `DEBUG` only, a
  `413` for an oversize sub-model upload, and fixed client-facing error text with the exception
  logged server-side.
- **Evidence:** canonical stub `6 failed, 2 passed` before the change (`test_step20_security.py`,
  run on the untouched tree); after the change `49 passed`, full backend suite `173 passed`
  (previously `124`), frontend `24 files / 173 tests` and `pnpm exec tsc -b --noEmit` clean.
  `test_custom_provider_rejects_unsafe_base_urls` asserts each refusal arrives in < 1 s, i.e. no
  connect attempt.
- **Suggested fix (landed):** new `backend/app/core/net_guard.py` (`UrlNotAllowed`,
  `validate_outbound_url(url, *, allow_private)` - resolves the host and classifies the *address*,
  not the string; a literal IP skips DNS); `settings.AI_CLOUD_HOSTS` +
  `settings.MAX_SUBMODEL_BYTES` in `core/config.py`; `ai_service.py` ignores `request.base_url` for
  `gemini`/`claude`/`openai`/`openrouter`, validates `custom`/`ollama` through the guard (and again
  in all three `_fetch_*_models`), sends the Gemini key in `x-goog-api-key`, logs truncated upstream
  bodies at `DEBUG`, and returns `{"error": "Project model file not found."}` from `execute_tool`;
  `api/copilot.py` maps `ValueError` -> 400 and hides unexpected 500 details; `api/federation.py`
  reads the upload in 1 MB chunks against the cap -> `413` before anything is written, and
  `_require_uuid` on the routes that build their own storage paths; `api/cad.py` and
  `api/projects.py` return fixed 404/500 messages and log the exception/path.
- **Follow-up:** DNS is resolved at check time and the connection is made afterwards, so a
  rebinding window remains (closing it needs a pinned transport - out of scope here). `openai`
  callers behind an Azure/proxy endpoint must use the `custom` provider now. F-019's quota half is
  only bounded by the single per-install token from STEP-05: there is still no per-user identity or
  rate limit, so anyone holding the local token can spend the server's cloud quota. CORS is an
  explicit local allow-list after STEP-05, so a foreign page cannot call these routes at all.
- **Status:** Fixed (F-019 SSRF half, F-020, F-026, F-027, F-045); F-019 quota half open by design
  (needs per-user quota, not this step)
