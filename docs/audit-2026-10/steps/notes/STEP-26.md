# STEP-26 handoff fragment — repository and process hygiene

> Written 2026-10-25 as the `AGENTS.md` §B8 handoff fragment for STEP-26.
> Merge these entries into `DEVELOPMENT_HANDOFF.md` `## Open Items` / `## Resolved Items` when the
> change is committed. Findings: F-053, F-054, F-057, F-058, F-059, F-060, F-063.

## 2026-10-25 - Repository hygiene is now enforced by a gate, not by convention (F-054, F-057, F-058, F-059, F-060, F-063)

- **Type:** Testability / Docs
- **Platform:** repo (git index, no runtime target)
- **Related tests:** `backend/tests/test_step26_repo_hygiene.py` (11 tests), `scripts/gates/check_repo_hygiene.py`
- **Severity:** P2
- **Observed:** A clone was 239.5 MB across 401 tracked files (175.5 MB of IFC fixtures, 4.17 MB of
  `.agents/` skills, one 47 MB fixture committed twice). `DEVELOPMENT_HANDOFF.md` `## Open Items` held
  `*(None at this time. All 359 test cases passing...)*` while 65 findings were open, and the test-suite
  size was documented as 70 / 113 / 118 / 323 / 359 / 366 in nine places against an actual 372.
- **Expected:** Size, duplicate and documentation drift are detected mechanically on every
  `pytest backend/tests` run, and the backlog section cannot be emptied by a placeholder.
- **Evidence:** gate red before the change with 8 / 9 / 24 / 1 / 9 violations; green afterwards.
  Index is now 158 files / 63.1 MB; exactly one tracked file exceeds 5 MB
  (`backend/app/samples/Ifc2x3_SampleCastle.ifc`, allowlisted with its reason inline); the MD5 duplicate
  walk returns 0 groups. `.agents/` is 0 tracked / 187 files on disk; the 24 dated QA artefacts live in
  `qa_runs/archive/` and new ones are written to `qa_runs/<YYYY-MM-DD>/`.
- **Suggested fix:** Keep `scripts/gates/check_repo_hygiene.py` registered in `scripts/gates/run_gates.py`.
  Adding a second large-file allowlist entry now requires editing the gate file, which is reviewable by
  design. Do not revive the placeholder in `## Open Items` — the gate rejects it.
- **Status:** In Progress (fix staged in the working tree, not committed)

## 2026-10-25 - Where do the 175 MB of untracked IFC fixtures live? (decision outstanding, F-057)

- **Type:** Docs / Enhancement
- **Platform:** repo
- **Related tests:** `docs/audit-2026-10/tests/backend/test_step01_ai_transform_units.py`,
  `test_step04_event_loop_offload.py`, `test_step06_clash_correctness.py`
- **Severity:** P2
- **Observed:** 7 fixtures larger than 5 MB are now `git rm --cached`: they still exist on disk for this
  machine, but a fresh clone does not have them. Three duplicate fixtures were deleted outright after
  verifying their MD5 against the canonical `backend/app/samples/` copies.
- **Expected:** A new contributor can run the fixture-dependent tests without a manual side channel.
- **Evidence:** `git ls-files modelsfortests` → 10 small fixtures (6.1 MB) still tracked; `IFC_FIXTURES_DIR`
  override added to the two docs tests that read `modelsfortests/`.
- **Suggested fix:** Decide as a product owner between Git LFS (org billing) and release assets, then
  document the download step in `README.md`. No URL was invented in this step.
- **Status:** Open

## 2026-10-25 - `/modelsfortests/*` is unfetchable at runtime, and `.git` still holds the 175 MB (F-057, residual)

- **Type:** Bug / Docs
- **Platform:** http://localhost:5173
- **Related tests:** none (no automated case covers the runtime fetch)
- **Severity:** P3
- **Observed:** `frontend/src/hooks/useModelLifecycle.ts:268` fetches `/modelsfortests/Ifc4_Revit_STR.ifc`,
  but Vite serves `frontend/public/`, not the repository root, so the fetch 404s today and the failure is
  swallowed at `:274-276`. Separately, STEP-26 is explicitly **not** a history rewrite: `.git` keeps
  ~175 MB of IFC blobs, so a "green" hygiene gate must not be read as "the repository is small".
- **Expected:** Either the fixture path is served (a `public/` symlink or an explicit dev-server route) or
  the code stops claiming to load it; and the README states the clone-size reality.
- **Evidence:** `useModelLifecycle.ts:268`, `:274-276`; `git ls-tree -r -l HEAD` → 239.5 MB / 401 files.
- **Suggested fix:** Serve the fixtures explicitly in dev, or move them behind the sample API. For the
  history, plan a coordinated `git filter-repo` + force-push (team decision, not a hygiene gate).
- **Status:** Open
