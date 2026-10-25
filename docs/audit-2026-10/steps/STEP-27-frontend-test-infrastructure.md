# STEP-27 — Frontend test infrastructure

**Status:** not started · **Wave:** B · **Effort:** 1 d
**Findings:** F-061, F-062 · **Depends on:** STEP-25 · **Blocks:** STEP-08, STEP-14, STEP-15, STEP-28

> **Wave note:** `ROADMAP.md` places this step in the **Wave B** table (`ROADMAP.md:94`) because
> STEP-08/14/15 need it; `README.md:36` groups STEP-25…28 under Wave D by number. The roadmap table
> is authoritative — treat this as **Wave B** work that happens to sit in the 25-28 block.

## Problem

The frontend has **13 tests in 3 files**, all of them pure functions (`math`, `drawingEngine`,
`viewportGrid`). There is **no way to test a component, a hook or a fetch path** because
`frontend/vite.config.ts` has no `test` block and `jsdom` /
`@testing-library/*` are not installed: `render()` is impossible today. Every step that changes UI
behaviour — batched visibility (STEP-08), the element-details race (STEP-14), tree virtualisation
(STEP-15), all of STEP-28 — currently has to be verified by hand in a browser, which is why those
features shipped broken in the first place.

## Evidence

- `frontend/package.json:31-43` — devDependencies are `@tailwindcss/vite`, `@types/node`,
  `@types/react`, `@types/react-dom`, `@types/three`, `@vitejs/plugin-react`, `oxlint`, `tailwindcss`,
  `typescript ~6.0.2`, `vite ^8.3.0`, `vitest ^5.0.3`. **No `jsdom`, no `@testing-library/*`**
  (verified against `frontend/node_modules`: all four are `ABSENT`).
- `frontend/vite.config.ts:1-55` — 55 lines, no `test` key, no `setupFiles`, no `environment`.
  Vitest therefore runs everything in the default `node` environment.
- `frontend/src/tests/` — exactly 3 files: `math.test.ts`, `viewportGrid.test.ts`,
  `drawings.test.ts`. Measured suite: `Test Files 3 passed (3) / Tests 13 passed (13)`
  (`VERIFICATION.md` §1).
- `frontend/package.json:10` — `"test": "vitest run"`, so CI's `pnpm test`
  (`.github/workflows/qa-harness.yml:67-69`) works but can only ever run node-environment tests.
- `scripts/ci_verify.ps1` steps 1-6 — backend smoke, `tsc -b`, `pnpm run build`, gates, harness
  check, browser E2E. **Vitest is not one of them**, so the local "master quality gate" script never
  runs the frontend unit tests that CI does run.
- Measured — `git check-ignore -v frontend/pnpm-lock.yaml` →
  `/.gitignore:21:pnpm-lock.yaml  frontend/pnpm-lock.yaml`. The lockfile exists on disk but is
  **untracked**, while `.github/workflows/qa-harness.yml:55-57` configures the pnpm cache from
  `frontend/pnpm-lock.yaml`. Adding dependencies on top of an untracked lockfile means the resolved
  versions in CI are whatever pnpm picks that morning.

## Scope

**Change:**

- `frontend/package.json` — add 5 devDependencies (below), add `"test:watch": "vitest"` to `scripts`.
- `frontend/vite.config.ts` — add the `test` block (below); change the `defineConfig` import to
  `vitest/config`.
- `frontend/src/tests/setup.ts` — **new** (full contents below).
- `frontend/src/tests/step27.testingLibrarySmoke.test.tsx` — **new** smoke test (full code below).
- `.gitignore:21` — remove `pnpm-lock.yaml` so the lockfile is tracked; commit
  `frontend/pnpm-lock.yaml` with the new deps.
- `scripts/ci_verify.ps1` — insert a "Vitest unit + component tests" step between step 2 (`tsc`) and
  step 3 (`pnpm run build`), so the local gate script and CI agree.
- `DEVELOPMENT_HANDOFF.md` / `steps/STATUS.md` — entry + row.

**Do not change:**

- The three existing test files. They must keep passing under `jsdom` unchanged; if they do not,
  that is a real isolation bug and must be fixed in the *test*, not by pinning them to `node`
  (`viewportGrid.test.ts` constructs a `THREE.Mesh` + `ShaderMaterial`, which is DOM-free and works
  in either environment — verified by reading `frontend/src/utils/viewportGrid.ts`).
- `frontend/tsconfig.json` / `tsconfig.node.json` — no changes needed (see Notes).
- `frontend/src/tests/setup.ts` must **not** import from `../components/*` — setup files are
  evaluated before every test file and must stay dependency-free.

**Non-goals:**

- **No coverage threshold.** Adding `@vitest/coverage-v8` and a `coverage.thresholds` block is a
  separate decision (what number? measured on what?). F-062 is answered by *having* component tests;
  the gate for that belongs with the CI budget work in STEP-04/STEP-08. If the executor wants it now,
  it is an additional devDependency and a `coverage: { provider: 'v8', reporter: ['text'] }` block —
  state the decision in the commit message.
- **No Playwright/WebGL tests.** jsdom has no WebGL; nothing in `ThreeViewport.tsx` is testable this
  way. Browser coverage stays with `scripts/qa_runner.py` (CDP).
- **No snapshot tests.** jsdom + Tailwind class strings produce noisy, meaningless snapshots.
- **No test-file reorganisation.** Keep `src/tests/` co-located as it is.

## Spec

1. `frontend/package.json` declares these devDependencies (minimum majors; let pnpm resolve the exact
   version and **record the resolved versions** in the commit message — do not hand-pin a version that
   a peer conflict will have to fight):

   | Package | Minimum | Why |
   |---|---|---|
   | `jsdom` | (whatever `vitest@5` peers accept) | the DOM environment |
   | `@testing-library/react` | `^16` | v16 is the first line with React 19 support (`react ^19.2.8`, `package.json:24`) |
   | `@testing-library/dom` | `^10` | explicit peer of `@testing-library/react@16` |
   | `@testing-library/jest-dom` | `^6` | `toBeInTheDocument`, `toHaveAttribute`, … |
   | `@testing-library/user-event` | `^14` | real pointer/keyboard sequences, not `fireEvent` |

   ```powershell
   # from frontend/
   pnpm add -D jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event
   ```

2. `frontend/vite.config.ts` keeps its existing `plugins`, `server`, `worker`, `optimizeDeps` and
   `build` keys byte-for-byte, and adds:
   ```ts
   test: {
     environment: 'jsdom',
     setupFiles: ['./src/tests/setup.ts'],
     include: ['src/**/*.test.{ts,tsx}'],
     restoreMocks: true,
     clearMocks: true,
   }
   ```
3. `frontend/src/tests/setup.ts` loads `@testing-library/jest-dom/vitest`, runs `cleanup()` after
   every test, clears `localStorage`, and installs stubs for `matchMedia` and `ResizeObserver`
   (both are used by Radix primitives that STEP-28 will render; jsdom implements neither).
4. A component smoke test renders a **real production component** (`ResizeHandle`) and asserts both
   rendered output (`role="separator"`, `aria-orientation`) and behaviour (a `dblclick` calls the
   `onDoubleClick` prop exactly once). It must fail with a module-resolution error before the
   dependencies are installed, and pass afterwards.
5. `pnpm exec vitest run` reports `Test Files 5 passed (5)` and `Tests 18 passed (18)` — 13
   pre-existing + 4 from STEP-25's import-graph guard + 1 new smoke test. (If STEP-25 has not been
   merged when you run this, expect `4 passed (4)` / `14 passed (14)`; the delta is exactly STEP-25's
   four tests.)
6. `pnpm exec tsc -b --noEmit` stays clean **with the new test and setup files in the program**
   (`tsconfig.app.json:25` includes `src`, so they are type-checked — this is deliberate: a test that
   does not type-check is a test that will rot).
7. `pnpm run build` is unaffected (vitest must not leak into the production bundle; verify the built
   JS size is unchanged).
8. `scripts/ci_verify.ps1` runs `pnpm exec vitest run` and fails the script on a non-zero exit.
9. `frontend/pnpm-lock.yaml` is tracked, and `pnpm install --frozen-lockfile` succeeds from a clean
   `node_modules`.

## TDD

### 1. Add the failing test

**File:** `frontend/src/tests/step27.testingLibrarySmoke.test.tsx`
**Command:** `pnpm exec vitest run src/tests/step27.testingLibrarySmoke.test.tsx`

<details>

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResizeHandle } from '../components/common/ResizeHandle';

/**
 * STEP-27 smoke test: proves the infrastructure works before any feature test is written.
 *
 * It exercises, in one test: JSX transform under React 19, jsdom DOM, @testing-library/react
 * queries, jest-dom matchers (loaded by src/tests/setup.ts) and user-event interactions.
 * `ResizeHandle` is real production code (frontend/src/components/common/ResizeHandle.tsx),
 * has no context dependency and no WebGL.
 */
describe('frontend test infrastructure', () => {
  it('renders a React component and reacts to a user event', async () => {
    const user = userEvent.setup();
    const onMouseDown = vi.fn();
    const onDoubleClick = vi.fn();

    render(
      <ResizeHandle
        position="left"
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
      />,
    );

    const handle = screen.getByRole('separator');
    expect(handle).toBeInTheDocument();
    expect(handle).toHaveAttribute('aria-orientation', 'vertical');
    expect(handle).toHaveAttribute('data-qa-position', 'left');

    await user.dblClick(handle);

    expect(onDoubleClick).toHaveBeenCalledTimes(1);
  });
});
```

</details>

### 2. Watch it fail

```
$ pnpm exec vitest run src/tests/step27.testingLibrarySmoke.test.tsx

 FAIL  src/tests/step27.testingLibrarySmoke.test.tsx [ src/tests/step27.testingLibrarySmoke.test.tsx ]

Error: Failed to resolve import "@testing-library/react" from "src/tests/step27.testingLibrarySmoke.test.tsx". Does the file exist?

 Test Files  1 failed (1)
      Tests  no tests
```

If instead you see `ReferenceError: document is not defined`, the import resolved but the environment
is still `node` — the `test.environment` block from Spec item 2 has not been applied yet. Both failures
are acceptable proof that the step is needed; only a **passing** run here is a problem.

### 3. Implement

1. **Install the dependencies** (Spec item 1). Record the resolved versions:
   ```powershell
   pnpm list jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event
   ```
2. **Add the `test` block** to `frontend/vite.config.ts` and switch the import on line 1 from
   `'vite'` to `'vitest/config'`. Keep the file's existing formatting (no prettier sweep).
3. **Create `frontend/src/tests/setup.ts`:**

   ```ts
   import '@testing-library/jest-dom/vitest';
   import { afterEach, vi } from 'vitest';
   import { cleanup } from '@testing-library/react';

   afterEach(() => {
     cleanup();
     localStorage.clear();
   });

   // jsdom implements neither of these; Radix primitives (Dialog, DropdownMenu, Slider)
   // call matchMedia, and Popper-based components construct a ResizeObserver.
   if (!window.matchMedia) {
     window.matchMedia = vi.fn().mockImplementation((query: string) => ({
       matches: false,
       media: query,
       onchange: null,
       addListener: vi.fn(),
       removeListener: vi.fn(),
       addEventListener: vi.fn(),
       removeEventListener: vi.fn(),
       dispatchEvent: vi.fn(),
     })) as unknown as typeof window.matchMedia;
   }

   if (!('ResizeObserver' in window)) {
     class ResizeObserverStub {
       observe(): void {}
       unobserve(): void {}
       disconnect(): void {}
     }
     (window as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
   }
   ```

4. **Add the smoke test** from §1.
5. **Track the lockfile:** delete `.gitignore:21` (`pnpm-lock.yaml`) and `git add frontend/pnpm-lock.yaml`.
6. **Wire the local gate:** in `scripts/ci_verify.ps1`, after the `tsc -b` step (Print-Step 2), insert:
   ```powershell
   try {
       Print-Step 2.5 "Frontend Unit & Component Tests (Vitest)"
       Push-Location frontend
       pnpm exec vitest run
       Pop-Location
       Print-Pass "Frontend test suite passed."
   } catch {
       Pop-Location
       Print-Fail "Frontend test suite failed."
       $overallPassed = $false
   }
   ```
   (Match the file's existing `Print-Step`/`Push-Location` idiom; steps 3-6 keep their numbers.)
7. **Confirm the production bundle is untouched:** `pnpm run build`, compare `dist/assets/*.js` sizes
   with the pre-change values.

### 4. Watch it pass

```
$ pnpm exec vitest run

 ✓ src/tests/math.test.ts (6 tests)
 ✓ src/tests/drawings.test.ts (4 tests)
 ✓ src/tests/viewportGrid.test.ts (3 tests)
 ✓ src/tests/step25.importGraph.test.ts (4 tests)
 ✓ src/tests/step27.testingLibrarySmoke.test.tsx (1 test)

 Test Files  5 passed (5)
      Tests  18 passed (18)
   Duration  ~5s
```

```
$ pnpm exec tsc -b --noEmit
$ echo $LASTEXITCODE
0
```

### 5. Regression guard

```powershell
# from frontend/
pnpm exec vitest run               # 4 files / 14 tests green
pnpm exec tsc -b --noEmit          # silent
pnpm run build                     # succeeds; JS bundle sizes unchanged vs the pre-step measurement
pnpm install --frozen-lockfile     # succeeds (proves the lockfile is complete and tracked)

# from the repo root
.\backend\venv\Scripts\python.exe -m pytest backend/tests/ -q
powershell -ExecutionPolicy Bypass -File .\scripts\ci_verify.ps1 -SkipBrowser
#   all steps pass, including the new Vitest step
```

## Acceptance criteria

- [ ] `frontend/package.json` devDependencies contain `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`, `@testing-library/user-event`.
- [ ] `frontend/vite.config.ts` contains a `test` block with `environment: 'jsdom'` and `setupFiles: ['./src/tests/setup.ts']`, and imports `defineConfig` from `vitest/config`.
- [ ] `frontend/src/tests/setup.ts` exists and is < 40 lines.
- [ ] `pnpm exec vitest run` → `Test Files 5 passed (5)`, `Tests 18 passed (18)` (or `4 / 14` if STEP-25 has not merged yet).
- [ ] `pnpm exec tsc -b --noEmit` → no output, exit 0 (the test files are type-checked).
- [ ] `pnpm run build` succeeds and `dist/assets/index-*.js` is within ±2 KB of the pre-step size.
- [ ] `frontend/pnpm-lock.yaml` is tracked (`git ls-files frontend/pnpm-lock.yaml` prints it) and `.gitignore` no longer matches it (`git check-ignore frontend/pnpm-lock.yaml` exits 1).
- [ ] `scripts/ci_verify.ps1 -SkipBrowser` runs Vitest and fails when a deliberately broken assertion is added (verify, then revert).
- [ ] The three pre-existing test files are unmodified (`git diff --stat -- frontend/src/tests/math.test.ts frontend/src/tests/drawings.test.ts frontend/src/tests/viewportGrid.test.ts` is empty).

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| `@testing-library/react@16` peer conflict with `react@19.2.8` | Install without pins and read pnpm's peer warnings; v16 supports React 19. If pnpm insists, use `--strict-peer-dependencies=false` **only** after confirming the warning is the known Radix/react-dom one | `pnpm remove` the 5 packages; revert `vite.config.ts` |
| Global `jsdom` slows the 3 existing node tests | Measured cost is milliseconds for these three; if it matters, add `// @vitest-environment node` as a comment at the top of each — but only if a test actually needs it | Change `environment` back to `node` and use per-file docblocks |
| `tsc -b` now type-checks test files and fails on something previously invisible | That is the intent; fix the type error rather than excluding `src/tests` from the program | Add `"exclude": ["src/tests"]` (discouraged — it re-creates the blind spot) |
| `jsdom` version drifts because the lockfile was untracked | Spec item 9 tracks it; the `--frozen-lockfile` check proves it | `git checkout <sha> -- frontend/pnpm-lock.yaml .gitignore` |
| Tracking the lockfile creates a large first diff | One file, ~2k lines, mechanical. Note it in the commit message so review concentrates on `vite.config.ts` | Remove the `git add` |
| Setup-file stubs mask a real jsdom gap that hides a bug | The stubs are documented with the reason; they are only installed when absent (`if (!window.matchMedia)`), so a jsdom upgrade that implements them wins automatically | Delete the stub blocks |

## Notes

- **`tsconfig` why-no-change:** `tsconfig.app.json:25` includes `"src"` and `:7` sets
  `"types": ["vite/client"]`. `@testing-library/jest-dom/vitest` augments vitest's `Assertion`
  interface through a *module import* in `setup.ts`, so no `types` array entry is needed. `jsdom`'s
  globals (`document`, `window`) come from `lib: ["ES2023", "DOM"]` (`:5`), already present. If a
  future test needs `node:fs`, that requires `"node"` in `types` — do not add it for the smoke test;
  STEP-25's guard deliberately avoids Node builtins via `import.meta.glob`.
- **`verbatimModuleSyntax`** (`tsconfig.app.json:14`) means type-only imports need `import type`.
  The smoke test imports no types, so it is unaffected — but the first feature test that imports
  `GeometryData` will trip on this if written carelessly.
- **`erasableSyntaxOnly`** (`tsconfig.app.json:22`) forbids enums and parameter properties — write
  test fixtures as plain objects or unions.
- **What this step does not prove:** jsdom has no layout engine and no WebGL. `getBoundingClientRect()`
  returns zeros, CSS classes are not applied, and `ThreeViewport` cannot render. Any assertion about
  *where* something is drawn, or *how big* it is on screen, must go through `qa_runner.py`/CDP, not
  this suite. Read STEP-28's TDD section for how it splits the two.
- **Ordering:** run STEP-25 first. STEP-25's guard test uses `import.meta.glob` and needs no
  dependencies, so it can land before this step — but if this step lands first, the guard test must
  still be written in the Node-builtin-free style shown in STEP-25 §1, or `tsc -b` will reject it.
- CI already runs `pnpm test` (`.github/workflows/qa-harness.yml:67-69`). Only the *local*
  `ci_verify.ps1` is missing it (Spec item 8). Do not add a second CI step.

### Execution notes — 2026-10-25

**Status:** implementation complete, *not committed* (multi-lane workspace; the main loop owns the
commit). Files written: `frontend/package.json`, `frontend/vite.config.ts`,
`frontend/src/tests/setup.ts` (new, 32 lines), `frontend/src/tests/step27.testingLibrarySmoke.test.tsx`
(new), `.gitignore`, `scripts/ci_verify.ps1`.

**Resolved versions** (`pnpm add -D`, no hand-pinning):

| Package | Resolved |
|---|---|
| `jsdom` | `30.1.3` |
| `@testing-library/react` | `16.3.3` |
| `@testing-library/dom` | `10.4.2` |
| `@testing-library/jest-dom` | `7.0.1` (pnpm resolved the v7 line, above the `^6` floor in Spec §1 — v7 still ships the `@testing-library/jest-dom/vitest` entry point that `setup.ts` imports) |
| `@testing-library/user-event` | `14.6.8` |

No peer warnings were emitted; `--strict-peer-dependencies=false` was not needed.

**What passed**

- `pnpm exec vitest run src/tests/step27.testingLibrarySmoke.test.tsx` → `1 passed (1)`.
- `pnpm exec vitest run src/tests/math.test.ts src/tests/drawings.test.ts src/tests/viewportGrid.test.ts`
  → `Test Files 3 passed (3)`, `Tests 13 passed (13)` under `jsdom` — the three pre-existing files are
  unmodified and need no `// @vitest-environment node` docblock (Risk row 2 does not materialise).
- `pnpm exec tsc -p tsconfig.node.json --noEmit` → exit 0, so `defineConfig` from `vitest/config`
  in `vite.config.ts` type-checks.
- `pnpm exec tsc --ignoreConfig --noEmit --jsx react-jsx --module esnext --moduleResolution bundler
  --target es2023 --lib ES2023 --lib DOM --types vite/client --skipLibCheck --strict
  src/tests/setup.ts src/tests/step27.testingLibrarySmoke.test.tsx src/components/common/ResizeHandle.tsx`
  → exit 0 (both new files are type-clean even under `--strict`; `tsconfig.app.json` does not set
  `strict`, so this is stricter than the real program).
- `pnpm exec vite build` → succeeds. `dist/assets/index-*.js` is +12 KB vs the 11:59 pre-step build,
  but that build is stale against other lanes' edits to `App.tsx`, `GlassBottomDock.tsx`,
  `DrawingSheetsModal`, `CopilotSidebar`; `STRINGS("vitest", "@testing-library", "jest-dom")` appear
  in **no** emitted chunk, so vitest has not leaked into the production bundle.
- `.gitignore:21` no longer lists `pnpm-lock.yaml`; `git check-ignore frontend/pnpm-lock.yaml` exits 1
  and `frontend/pnpm-lock.yaml` (111 KB) is on disk. It is **untracked** on purpose — this lane does
  not commit.

**Repo-wide state at the end of execution (other lanes still red, verified unrelated)**

This lane ran inside a live multi-lane tree, so the *repo-wide* suite and `tsc -b` are not green for
reasons outside this step. Final readings:

- `pnpm exec vitest run` → `Test Files 3 failed | 15 passed (18)`, `Tests 6 failed | 113 passed (119)`.
  The six failures are `step09.drawings.test.ts` ×4 (F-028/F-030 not implemented yet),
  `step24.drawingsPerf.test.ts` ×1 (F-029: `exportSheetToSvg` emits 1 path, expects 2) and
  `step29.propertyEditPersistence.test.tsx` ×1. **None** involves a STEP-27 file.
- `step29.propertyEditPersistence.test.tsx` — a 12-test `.tsx` component test, 11 passing — is only
  runnable because of this step, so the infra is already load-bearing for STEP-29.
- `pnpm exec tsc -b --noEmit` reports errors in exactly four files:
  `src/tests/step09.drawings.test.ts` (7), `src/components/viewer/ThreeViewport.tsx` (6),
  `src/components/viewer/sceneTeardown.ts` (5), `src/tests/step12.coordinateHud.test.ts` (3).
  Zero errors mention `src/tests/setup.ts`, `src/tests/step27.*` or `vite.config.ts`, and the isolated
  `--strict` check below is exit 0, so the step introduces no type errors of its own.
- Two transient blockers from other lanes disappeared during the session and are no longer relevant:
  `step25.importGraph.test.ts` briefly flagged every `src/tests/*.test.ts` as unreachable (its glob
  filter used `startsWith('tests/')` while `import.meta.glob('../**/*')` emits same-directory keys as
  `./math.test.ts`) — the STEP-25 lane fixed it by filtering on `globKey.startsWith('../')`. The
  STEP-11 harness file that embedded a literal `*/` inside its docblock (39 × `TS1xxx`) was removed by
  its own lane. Both are recorded in `notes/STEP-27.md` for the trail.

Consequence for Spec item 5: the `5 files / 18 tests` reading presumes a tree where STEP-25…29 are
implemented. Measured here: `13 pre-existing + 1 smoke = 14` in isolation, green.

**Deferred to the main loop** (cannot be done from a lane that must not commit and must not touch
other lanes' files): `git add frontend/pnpm-lock.yaml`, `pnpm install --frozen-lockfile` proof
(would race a concurrent `pnpm add`), a live `ci_verify.ps1 -SkipBrowser` run (its step 2 `tsc -b`
currently fails on the STEP-11 file above), and the `steps/STATUS.md` row.

**`ci_verify.ps1` deviation:** `Print-Step` was `[int]$num`, and `Print-Step 2.5` silently rounds to
`2` (duplicate "Step 2" banner). The parameter is now `[string]$num`; all existing call sites print
identically. The inserted step also captures `$LASTEXITCODE` and throws explicitly, because
`$ErrorActionPreference = 'Stop'` does **not** trap a non-zero native exit code in Windows
PowerShell 5.1 — without that check the step would report PASS on a failing suite.
