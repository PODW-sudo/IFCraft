# TDD test suite

Ready-to-run tests for the steps that can be automated today. They are **not** wired into the
default `pytest` / `vitest` runs, so the repository's CI stays green while this plan is in flight.

## Contents

### Backend — `backend/`

| File | Step | Runs today? | Runtime |
|---|---|---|---|
| `test_step01_ai_transform_units.py` | STEP-01 | ✅ | ~75 s (13 MB fixture re-opened) |
| `test_step02_single_commit_path.py` | STEP-02 | ✅ | < 1 s (source contract) |
| `test_step03_atomic_writes.py` | STEP-03 | ✅ | ~15 s |
| `test_step04_event_loop_offload.py` | STEP-04 | ✅ | ~40 s (8.5 MB upload) |
| `test_step05_cors_and_auth.py` | STEP-05 | ✅ | ~5 s |
| `test_step06_clash_correctness.py` | STEP-06 | ✅ | ~13 s |
| `test_step07_column_count.py` | STEP-07 | ✅ | ~9 s |
| `test_step20_security.py` | STEP-20 | ✅ | ~6 s |
| `test_step29_property_edit_persistence.py` | STEP-29 | ✅ | ~6 s |

### Frontend — `frontend/`

| File | Step | Runs today? | Note |
|---|---|---|---|
| `step09.drawings.test.ts` | STEP-09 | ✅ | source-contract assertions, no DOM |
| `step11.omnibarCtrlK.test.ts` | STEP-11 | ✅ | source-contract assertions, no DOM |
| `step12.coordinateHud.test.ts` | STEP-12 | ✅ | source-contract assertions, no DOM |

The frontend tests deliberately avoid the DOM so they run in the existing `node` environment.
They read the component source and assert structural contracts that the fix must satisfy. Once
**STEP-27** adds `jsdom` + `@testing-library/react`, replace the source contracts with rendered
assertions — but keep a couple of them, because a source contract catches "the prop is not even
passed", which a rendered assertion can miss behind a default value.

## How to run

### Backend

```powershell
# from the repository root
Copy-Item docs/audit-2026-10/tests/backend/test_step01_ai_transform_units.py backend/tests/
.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step01_ai_transform_units.py -v
```

### Frontend

```powershell
# from the repository root
Copy-Item docs/audit-2026-10/tests/frontend/step11.omnibarCtrlK.test.ts frontend/src/tests/
pnpm --dir frontend exec vitest run src/tests/step11.omnibarCtrlK.test.ts
```

`vitest` resolves `node:fs` and `node:path` in the default environment, so no extra configuration
is needed for the source-contract tests.

## Conventions these tests follow

1. **Repo-root discovery is location-independent.** Each backend file walks its parents looking for
   `backend/app/main.py`, so a test works whether it lives in `backend/tests/` or in this folder:

   ```python
   def _repo_root() -> Path:
       for parent in Path(__file__).resolve().parents:
           if (parent / "backend" / "app" / "main.py").exists():
               return parent
       raise RuntimeError("Could not locate repository root")
   ```

2. **Fixtures are copied, never mutated.** `modelsfortests/` files are tracked in git; every test
   uses `tmp_path` / `tmp_path_factory` and copies before writing.

3. **Database rows are cleaned up.** Tests that need a project row insert it themselves and delete
   it in a `finally` block, and use the `AutoTest-` prefix required by `AGENTS.md` §B7.

4. **No test depends on ANOTHER test's side effects.** Order-independent by construction.

5. **A test must fail for the stated reason.** Each files's docstring names the expected failure
   message. If it fails differently, stop and read the reason — do not "fix" the test to match the
   bug.

## Known-good failure signatures

Recorded on 2026-10-24 against `f5eec4c`. If you see something different, the code has moved:

```
test_step01  → 3 failed, 1 passed
  "A zero-delta transform moved the element. before=[12345226892.03, ...] after=[11839867400155.19, ...]"
  "Expected the element to move 2 m (2000 mm on a millimetre model); it moved ..."
  "A pure rotation moved the element."

test_step02  → 3 failed, 1 passed
  "handleTransformEnd performs 1 WebSocket commit(s) and 1 HTTP post(s)."

test_step05  → 6 failed, 1 passed
  "CORS_ORIGINS contains '*': [...]"
  "the server echoed the foreign origin 'https://evil.example.com'"
  "settings.API_TOKEN is not defined."

test_step06  → 3 failed, 1 passed
  "Only 0 of 113 walls were extracted — the per-type sample cap is still in effect."
  "ClashCheckResponse is missing 'elements_checked'."

test_step07  → 2 failed, 2 passed
  "the chat message claims columns but the building has none"
  "the column grid is not expressed as a named, documented rule."

test_step29  → 1 failed, 2 passed
  "fetch call #0 uses PATCH but the backend route is POST-only ... 405 Method Not Allowed"
```

## Tests that are intentionally source contracts

Three kinds of defect cannot be observed through the API in a headless test:

| Defect | Why a source contract | Better test once available |
|---|---|---|
| Double commit path (STEP-02) | requires a real browser drag | Playwright, or a jsdom harness counting `fetch` calls |
| Ctrl+K dead branch (STEP-11) | requires a keyboard event and a rendered component | jsdom + `userEvent.keyboard` (STEP-27) |
| Coordinate HUD `sr-only` (STEP-12) | requires computed styles | jsdom + a class assertion (STEP-27) |
| WebSocket Origin (STEP-05) | the *unfixed* server accepts then waits, so a live test hangs instead of failing | a live handshake asserting close code 1008 once fixed |

The contract tests are deliberately written so they fail on the *cause* (the empty branch, the
`PATCH`, the `sr-only` class) rather than on a symptom.
