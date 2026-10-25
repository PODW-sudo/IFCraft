# STEP-27 — Frontend test infrastructure · handoff notes

## 2026-10-25 - Frontend component-test infra landed, lockfile untracked from .gitignore
- **Type:** Testability
- **Platform:** http://localhost:5173
- **Related tests:** TC-001 (UI loads), TC-002 (model load) — the whole suite was previously manual-only
- **Severity:** P1
- **Observed:** Before this step `frontend/vite.config.ts` had no `test` block and `jsdom` /
  `@testing-library/*` were absent, so `render()` was impossible: every UI change (F-061, F-062) had to
  be verified by hand in Chrome, which is why batched visibility, the element-details race and tree
  virtualisation shipped broken.
- **Expected:** A component, hook or fetch path can be rendered and asserted in-process; the local
  master gate (`scripts/ci_verify.ps1`) and CI run the same unit/component suite.
- **Evidence:** `pnpm exec vitest run src/tests/step27.testingLibrarySmoke.test.tsx` → 1 passed;
  `pnpm exec vitest run src/tests/math.test.ts src/tests/drawings.test.ts src/tests/viewportGrid.test.ts`
  → 3 files / 13 tests passed under `jsdom`; `pnpm exec vite build` succeeds with no
  `vitest`/`@testing-library`/`jest-dom` strings in any emitted chunk.
- **Suggested fix (applied):** devDeps `jsdom@30.1.3`, `@testing-library/react@16.3.3`,
  `@testing-library/dom@10.4.2`, `@testing-library/jest-dom@7.0.1`,
  `@testing-library/user-event@14.6.8`; `test: { environment: 'jsdom', setupFiles:
  ['./src/tests/setup.ts'], include: ['src/**/*.test.{ts,tsx}'], restoreMocks: true, clearMocks: true }`
  with `defineConfig` from `vitest/config`; `frontend/src/tests/setup.ts` (jest-dom matchers, `cleanup()`,
  `localStorage.clear()`, `matchMedia`/`ResizeObserver` stubs); `test:watch` script; Vitest step 2.5 in
  `ci_verify.ps1`; `pnpm-lock.yaml` removed from `.gitignore` so `frontend/pnpm-lock.yaml` (111 KB,
  now containing the resolved test deps) can be tracked.
- **Status:** Open — the lockfile still needs `git add frontend/pnpm-lock.yaml` from the main loop;
  `.github/workflows/qa-harness.yml:55-57` caches on that path, so until it is committed CI re-resolves
  the exact test-dep versions every run.

## 2026-10-25 - STEP-25 import-graph guard reports every test file as dead UI
- **Type:** Bug
- **Platform:** http://localhost:5173
- **Related tests:** TC-001
- **Severity:** P2
- **Observed:** `pnpm exec vitest run` fails with
  "These modules are not reachable from src/main.tsx": `./math.test.ts`, `./drawings.test.ts`,
  `./viewportGrid.test.ts`, `./setup.ts`, `./step27.testingLibrarySmoke.test.tsx`, …
- **Expected:** `src/tests/**` is excluded from the reachability graph; only production modules are
  checked.
- **Evidence:** `frontend/src/tests/step25.importGraph.test.ts:9-24` — the glob is
  `import.meta.glob('../**/*.{ts,tsx}')`, so files in the tests directory come back as `./x.test.ts`,
  while the filter is `!path.startsWith('tests/')`. `toModulePath()` only strips `../`, never `./`.
  The failure reproduces with no STEP-27 files present (it names the three pre-existing test files).
- **Suggested fix:** in `MODULES`, normalise keys first —
  `globKey.replace(/^\.\.\//, '').replace(/^\.\//, '')` — and filter on `!path.startsWith('tests/')`,
  or filter the raw keys on `key.includes('/tests/')` before normalisation.
- **Status:** Closed (same day) — the STEP-25 lane fixed it by keeping only keys that start with
  `../` in `MODULES` (`step25.importGraph.test.ts:25`). Re-ran the full suite: the guard passes.

## 2026-10-25 - STEP-11 audit test cannot parse (nested block comment)
- **Type:** Bug
- **Platform:** http://localhost:5173
- **Related tests:** TC-019 (Omnibar)
- **Severity:** P2
- **Observed:** `pnpm exec tsc -b --noEmit` exits 2 with 39 `TS1xxx` errors, all in
  `frontend/src/tests/step11.omnibarCtrlK.audit.test.ts` around lines 15-22; that file's suite also
  fails to load in Vitest ("Transform failed … PARSE_ERROR").
- **Expected:** The file parses; `tsc -b` is clean and `scripts/ci_verify.ps1` step 2 passes.
- **Evidence:** Line 15 of the docblock quotes the offending production code as
  `else { /* Open */ }        <-- empty branch`. The `*/` inside the docblock closes it early, so the
  remainder of the prose is parsed as code. `pnpm exec tsc -p tsconfig.node.json --noEmit` is 0, and an
  isolated type-check of STEP-27's `setup.ts` + smoke test is 0, so the errors are local to this file.
- **Suggested fix:** rewrite line 15 as `else { /* Open *\/ }` → better, use `// Open` without the
  closing delimiter, or switch the header to `//` line comments. Keep the quoted snippet readable but
  never embed a literal `*/`.
- **Status:** Closed (same day) — the STEP-11 lane removed/replaced the file
  (`step11.omnibarCtrlK.audit.test.ts` no longer exists; `step11.omnibarCtrlK.test.ts` remains). `tsc -b`
  now reports errors only in `step09.drawings.test.ts`, `step12.coordinateHud.test.ts`,
  `ThreeViewport.tsx`, `sceneTeardown.ts` — all other lanes' in-flight work.

## 2026-10-25 - Repo-wide red after STEP-27 lands is feature work, not infrastructure
- **Type:** Testability
- **Platform:** http://localhost:5173
- **Related tests:** TC-001, TC-002, TC-045 (property edit)
- **Severity:** P3
- **Observed:** `pnpm exec vitest run` at the end of this lane is
  `3 failed | 15 passed (18)` files and `6 failed | 113 passed (119)` tests.
- **Expected:** Read the failure list, not the exit code: STEP-27 is an enabler, and the remaining red
  is other lanes' unimplemented features.
- **Evidence:** failures are `step09.drawings.test.ts` ×4 (F-028 storey elevation, F-030 print page
  size), `step24.drawingsPerf.test.ts` ×1 (F-029 two-paths-per-viewport) and
  `step29.propertyEditPersistence.test.tsx` ×1 (save-failure inline error). 11 of STEP-29's 12 tests
  pass, which is the first component-level coverage the frontend has ever had.
- **Suggested fix:** none for this step. Whenever a lane lands STEP-09/STEP-24/STEP-29, the counts move
  without any change to `vite.config.ts` or `setup.ts`.
- **Status:** Open — informational.
