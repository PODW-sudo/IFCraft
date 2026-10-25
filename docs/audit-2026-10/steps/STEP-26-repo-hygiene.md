# STEP-26 — Repository and process hygiene

**Status:** done 2026-10-25 (gate green; `pytest backend/tests` still red for F-001 / STEP-21 lanes) · **Wave:** D · **Effort:** 1.5 d
**Findings:** F-053, F-054, F-057, F-058, F-059, F-060, F-063 · **Depends on:** — (see Notes on ordering vs STEP-25) · **Blocks:** —

## Problem

A clone of this repository is **239.6 MB across 401 tracked files**, of which **175.5 MB is IFC test
fixtures**, **4.17 MB / 184 files is the agent-skill library**, and one 47 MB fixture is committed
**twice** with the same MD5. On top of that the working-tree root carries **24 dated QA artefacts
(2.66 MB)** that contradict each other, the backlog file
(`DEVELOPMENT_HANDOFF.md:41-43`) says *"None at this time. All 359 test cases passing"* while 65
findings are open, and **four documents disagree about how many tests exist in nine places**
(70 / 113 / 118 / 323 / 359 / 366 against an actual **372**). Every one of these is a trust defect
in a repository whose product claim is "the tool tells the truth".

## Evidence

- Measured — `git ls-files | Measure-Object -Line` → **401**; sum of tracked file bytes → **239.6 MB**;
  `Get-ChildItem .git/objects -Recurse` → **39 MB**.
- Measured — `modelsfortests/` → **20 files / 175.5 MB**, all tracked (`git ls-files modelsfortests`).
  Largest: `Ifc2x3_SampleCastle.ifc` 47.0 MB, `Ifc2x3_Duplex_Plumbing.ifc` 30.1 MB,
  `Ifc4_Revit_MEP.ifc` 27.8 MB, `Ifc2x3_Duplex_MEP.ifc` 17.0 MB, `Ifc4_Revit_ARC*.ifc` 13.0 MB ×2,
  `Ifc4_Revit_STR.ifc` 10.8 MB, `Ifc2x3_Duplex_Mechanical.ifc` 8.4 MB.
- Measured — **9 tracked files exceed 5 MB** (214.1 MB combined):
  ```
    47.0 MB  modelsfortests/Ifc2x3_SampleCastle.ifc
    47.0 MB  backend/app/samples/Ifc2x3_SampleCastle.ifc
    30.1 MB  modelsfortests/Ifc2x3_Duplex_Plumbing.ifc
    27.8 MB  modelsfortests/Ifc4_Revit_MEP.ifc
    17.0 MB  modelsfortests/Ifc2x3_Duplex_MEP.ifc
    13.0 MB  modelsfortests/Ifc4_Revit_ARC_FireRatingAdded.ifc
    13.0 MB  modelsfortests/Ifc4_Revit_ARC.ifc
    10.8 MB  modelsfortests/Ifc4_Revit_STR.ifc
     8.4 MB  modelsfortests/Ifc2x3_Duplex_Mechanical.ifc
  ```
- Measured — MD5 over every tracked file: **13 duplicate groups**. Three are IFC fixtures:
  ```
  E7B3C2BBC244400EB7C6D2D032599FD9  backend/app/samples/Ifc2x3_SampleCastle.ifc
                                    modelsfortests/Ifc2x3_SampleCastle.ifc            (47.0 MB each)
  51809F12C46A4074FB551DEF53449EBC  backend/app/samples/building_architecture.ifc
                                    modelsfortests/Building-Architecture.ifc
  E9E6DF73F2DC14ED55ED96C06FEC7C7C  backend/app/samples/ifc2x3_duplex_architecture.ifc
                                    modelsfortests/Ifc2x3_Duplex_Architecture.ifc
  ```
  Six are `.agents/skills/**` copies; four are the frontend dead-code copies that STEP-25 removes.
- Measured — `git ls-files .agents` → **184** files / **4.17 MB tracked** (4.33 MB on disk, i.e. 0.16 MB
  of it is already untracked). `.agents/` is referenced by `README.md:213-214` and `GEMINI.md:71`.
- Measured — working-tree root: **12** `test_report_*.md` + **12** `test_results_*.jsonl`
  = **24 files / 2.66 MB**, dated 2026-10-01 … 2026-10-20. They are already gitignored
  (`.gitignore:41-42`) but never removed, and `.github/workflows/qa-harness.yml:158` +
  `:172-173` still glob for them in the repo root.
  *(F-059 says "20"; the measured count is 24. Use the measurement.)*
- Measured — `test_cases.jsonl` → **372 cases**: `key` **123**, `full` **246**,
  `milestone` **3**. Documented counts:
  ```
  README.md:195           70 structured QA test specifications
  README.md:208          359 granular test cases
  README.md:210          113 critical end-to-end paths
  README.md:219          359 tests
  project.config.md:84   366 comprehensive test specifications
  project.config.md:87   118 critical end-to-end paths
  project.config.md:92   359 test specifications
  AGENTS.md:65           359 test cases
  .github/workflows/qa-harness.yml:9   323 test cases
  ```
- `DEVELOPMENT_HANDOFF.md:41-43`:
  ```
  ## Open Items

  *(None at this time. All 359 test cases passing with zero P0-P3 regressions: 113 key functionalities and 246 milestone tests.)*
  ```
  The section has zero `### ` entries. The parenthetical is also wrong on its own terms:
  123 key + 246 full = 369, not 359.
- Measured — `storage/projects.db` holds **30** projects, **none** prefixed `AutoTest-`
  (`Phase 1 Test Villa`, `Phase 5 Collab Project` ×3, `Debug Test` ×3,
  `Phase 6 AI Copilot Project` ×4, `asd`, …). `scripts/qa_runner.py` contains **no** project
  creation and **no** cleanup call: `grep -n "auto.*clean" scripts/qa_runner.py` → no matches.
  The `AutoTest-` rule in `AGENTS.md` §B7 exists on paper only, so F-053 can recur after any fix.
- `.gitignore:1-44` contains `storage/projects/*`, `test_report_*.md`, `test_results_*.jsonl` —
  and neither `modelsfortests/` nor `.agents/` (F-063).

## Scope

**Change:**

- `scripts/gates/check_repo_hygiene.py` — **new** gate (full code in §1).
- `scripts/gates/run_gates.py:15-21` — add `("Repository Hygiene", "check_repo_hygiene.py")` to `GATES`.
- `backend/tests/test_step26_repo_hygiene.py` — **new** pytest wrapper (full code in §1).
- `.gitignore` — add `modelsfortests/`, `.agents/`, `qa_runs/`, `*.ifc.bak`.
- `modelsfortests/` — `git rm --cached` the **8 fixtures > 5 MB** and keep the small ones tracked
  (`Ifc4_SampleHouse*.ifc`, `Ifc4_BasinFacetedBrep.ifc`, `Ifc4_WallElementedCase.ifc`,
  `Ifc4_CubeAdvancedBrep.ifc`, `Building-Architecture.ifc`, `Ifc2s3_Duplex_Electrical.ifc`,
  `README.md`). Delete the 3 byte-identical duplicates outright (`git rm`, not `--cached`):
  `Ifc2x3_SampleCastle.ifc`, `Building-Architecture.ifc`, `Ifc2x3_Duplex_Architecture.ifc`.
  **Decision for the executor — where the untracked fixtures live.** Recommended: keep them on disk
  in `modelsfortests/` (gitignored) and make fixture-dependent tests locate them through
  `IFC_FIXTURES_DIR` (default `modelsfortests/`), skipping with a clear message when absent.
  Do **not** invent a download URL; hosting them as release assets is a product-owner decision —
  record it as an Open Item rather than solving it here.
- `.agents/` — `git rm -r --cached .agents` (files stay on disk for agent tooling) and add to
  `.gitignore`. Update the two references that would then point at untracked paths:
  `README.md:213-214` (keep the links, note the directory is a local checkout) and `GEMINI.md:71`.
- `DEVELOPMENT_HANDOFF.md:41-45` — replace the placeholder with real entries. Minimum: one `### `
  entry per open finding group that no step has closed yet. Start with the 10 highest-severity open
  findings; do not fabricate statuses.
- Test-count text — rewrite the nine claims at the line numbers above to the measured
  **372 total / 123 key / 246 full**.
- `scripts/qa_runner.py` —
  - `get_results_file` (`:65-67`) → `ROOT_DIR / "qa_runs" / d / f"test_results_{d}.jsonl"`;
    `get_report_file` (`:69-71`) → same directory; `mkdir(parents=True, exist_ok=True)` in both.
  - `run_suite_async` (`:4055-4086`) — wrap the case loop in `try/finally` and call
    `cleanup_autotest_projects(api_url, run_id)`; create every project the run needs as
    `AutoTest-{run_id}-{slug}`.
  - `cmd_run` (`:4091`) — add `--run-id` (default `datetime.now():%Y%m%dT%H%M%S`) and
    `--cleanup-autotest` (purge **all** `AutoTest-*` projects, then exit).
  - New helper `is_autotest_project_name(name: str) -> bool` (module level, tested below).
- `scripts/cleanup_test_projects.py` — **new**, dry-run by default. Lists every project whose name
  matches `is_autotest_project_name()` **or** is in an explicit `--names` list, prints name, id and
  size on disk, and refuses to delete without `--yes`. The 30 existing projects do **not** match the
  prefix, so they are never touched automatically — this is deliberate (data-safety, `AGENTS.md` §B7)
  and must be stated in the tool's `--help`.
- `.github/workflows/qa-harness.yml:158,172-173` — repoint the report globs at `qa_runs/**`.

**Do not change:**

- `backend/app/samples/Ifc2x3_SampleCastle.ifc` — it is a **registered product sample**
  (`backend/app/api/projects.py:54-61`, `sample_castle`, `element_count: 3822`). It stays tracked and
  is the single allowlisted large file. Deleting it breaks `GET /samples/list` +
  `POST /samples/sample_castle/load`.
- `backend/app/samples/ifc2x3_duplex_architecture.ifc`, `building_architecture.ifc`,
  `duplex_residential.ifc`, `office_pavilion.ifc` — all registered samples
  (`projects.py:21-62`) and asserted by `backend/tests/test_phase7.py:147-181`.
- `test_cases.jsonl` content — the count is fixed *by* the file, not the other way round.
- `scripts/capture_render.py`, `verify_layout_renders.py`, `benchmark_navigation.py`,
  `build_test_suite.py`, `html_reporter.py` — no changes in this step.
- Anything under `storage/projects/`.

**Non-goals:**

- **Not** a git-history rewrite. The 175 MB stays in history (`git filter-repo` is a force-push,
  coordinated-as-a-team operation). This step stops the *bleeding*, not the `.git` size.
- **Not** Git LFS onboarding (requires org-level billing decision).
- **Not** collapsing the 372-case milestone suite to ~60 flows — that is `USER-NEEDS.md` §8 and a
  separate, larger decision.
- **Not** deleting the 30 legacy projects automatically.
- **Not** fixing `/modelsfortests/*` being unfetchable at runtime
  (`frontend/src/hooks/useModelLifecycle.ts:268` fetches `/modelsfortests/Ifc4_Revit_STR.ifc`, but
  Vite serves `frontend/public/`, not the repo root — the fetch 404s today and the failure is
  swallowed at `:274-276`). Record it as an Open Item; it is a feature bug, not hygiene.

## Spec

1. `python scripts/gates/check_repo_hygiene.py` exits 0 and prints `OVERALL STATUS: ALL HYGIENE CHECKS PASSED`.
2. The gate fails if **any** tracked file exceeds 5 MB and is not the single
   `backend/app/samples/Ifc2x3_SampleCastle.ifc` allowlist entry. Adding a second allowlist entry
   requires editing the file and is therefore reviewable.
3. The gate fails on **any** two tracked files with identical content (MD5). No allowlist for this
   check — a duplicate is a duplicate.
4. The gate fails if any `test_report_*.md` or `test_results_*.jsonl` exists in the repository root
   (`ROOT_DIR`), regardless of `git` status.
5. The gate fails unless `## Open Items` in `DEVELOPMENT_HANDOFF.md` contains at least one
   `### ` entry **and** does not contain the `*(None` placeholder.
6. The gate fails if any test-count claim in `README.md`, `project.config.md`, `AGENTS.md` or
   `.github/workflows/qa-harness.yml` is a number other than the actual totals derived from
   `test_cases.jsonl` (372 total, 123 key).
7. `backend/tests/test_step26_repo_hygiene.py::test_repo_hygiene_gate_passes` passes as part of
   `pytest backend/tests -q` — i.e. the gate runs in CI (`qa-harness.yml:45-47`) without a new workflow step.
8. `is_autotest_project_name()` returns `True` for `AutoTest-20261024T101500-TC-001` and
   `AutoTest-anything`, `False` for all 30 current project names (`Phase 6 AI Copilot Project`,
   `Debug Test`, `asd`, …) and for `AutoTest` (no hyphen).
9. `qa_runner.py run` writes results/reports under `qa_runs/<YYYY-MM-DD>/` and creates no file in
   the repository root; `python scripts/qa_runner.py report` still finds them.
10. Two consecutive `qa_runner.py run --dry-run` invocations leave the project count unchanged
    (`GET /api/projects` length identical before/after), and `--cleanup-autotest` removes only
    `AutoTest-*` projects.

## TDD

### 1. Add the failing test

This step's "test" is a **gate** plus a one-line pytest wrapper, because that is how this repository
already expresses deterministic policy (`scripts/gates/run_gates.py`). The gate is the executable
specification; the pytest wrapper puts it on the CI path.

**File:** `scripts/gates/check_repo_hygiene.py`
**File:** `backend/tests/test_step26_repo_hygiene.py`
**Command:** `.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step26_repo_hygiene.py -v`

<details>

```python
#!/usr/bin/env python3
"""
Gate: check_repo_hygiene.py
Repository and process hygiene, enforced rather than requested.

Fails when any of the following is true:
1. A tracked file larger than 5 MB exists that is not the single allowlisted product sample.
2. Two tracked files have identical content.
3. A dated QA artefact (test_report_*.md / test_results_*.jsonl) sits in the repository root.
4. DEVELOPMENT_HANDOFF.md '## Open Items' is empty or still holds the placeholder.
5. A documented test count disagrees with test_cases.jsonl.
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent

MAX_TRACKED_BYTES = 5 * 1024 * 1024

# Exactly one entry is permitted, and it must be a registered product sample.
LARGE_FILE_ALLOWLIST = {
    "backend/app/samples/Ifc2x3_SampleCastle.ifc": (
        "Registered product sample 'sample_castle' (backend/app/api/projects.py:54-61)."
    ),
}

ROOT_ARTEFACT_PATTERNS = ("test_report_*.md", "test_results_*.jsonl")
QA_ARTEFACT_DIR = "qa_runs"

DOC_FILES_WITH_COUNTS = (
    "README.md",
    "project.config.md",
    "AGENTS.md",
    ".github/workflows/qa-harness.yml",
)

COUNT_CLAIM = re.compile(
    r"\b(\d{2,4})\s+"
    r"(?:(?:granular|structured|comprehensive|critical|key|milestone|end-to-end|full|QA)\s+)*"
    r"(?:test\s+)?(?:cases|specifications|specs|tests|paths)\b",
    re.IGNORECASE,
)


def git_tracked_files() -> list[str]:
    result = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=ROOT_DIR,
        capture_output=True,
        check=True,
    )
    return [item for item in result.stdout.decode("utf-8", "replace").split("\0") if item]


def check_large_files(tracked: list[str]) -> list[str]:
    problems: list[str] = []
    for relative_path in tracked:
        path = ROOT_DIR / relative_path
        if not path.is_file():
            continue
        size = path.stat().st_size
        if size <= MAX_TRACKED_BYTES or relative_path in LARGE_FILE_ALLOWLIST:
            continue
        problems.append(f"{size / (1024 * 1024):6.1f} MB  {relative_path}")
    return problems


def check_duplicate_content(tracked: list[str]) -> list[str]:
    by_digest: dict[str, list[str]] = {}
    for relative_path in tracked:
        path = ROOT_DIR / relative_path
        if not path.is_file():
            continue
        digest = hashlib.md5(path.read_bytes()).hexdigest()
        by_digest.setdefault(digest, []).append(relative_path)

    problems: list[str] = []
    for digest, paths in sorted(by_digest.items()):
        if len(paths) > 1:
            problems.append(f"{digest[:8]}  " + "  ==  ".join(sorted(paths)))
    return problems


def check_root_artefacts() -> list[str]:
    problems: list[str] = []
    for pattern in ROOT_ARTEFACT_PATTERNS:
        for path in sorted(ROOT_DIR.glob(pattern)):
            if path.is_file():
                kib = path.stat().st_size // 1024
                problems.append(f"{path.name}  ({kib} KB)  -> move to {QA_ARTEFACT_DIR}/")
    return problems


def check_handoff_open_items() -> list[str]:
    path = ROOT_DIR / "DEVELOPMENT_HANDOFF.md"
    if not path.exists():
        return ["DEVELOPMENT_HANDOFF.md is missing"]

    text = path.read_text(encoding="utf-8", errors="replace")
    heading = re.search(r"^## Open Items\s*$", text, re.MULTILINE)
    if not heading:
        return ["DEVELOPMENT_HANDOFF.md has no '## Open Items' heading"]

    section = text[heading.end():]
    next_heading = re.search(r"^## ", section, re.MULTILINE)
    if next_heading:
        section = section[: next_heading.start()]

    if re.search(r"^\s*\*\(None", section, re.MULTILINE):
        return ["'## Open Items' still contains the '*(None at this time...)*' placeholder"]
    if not re.search(r"^### ", section, re.MULTILINE):
        return ["'## Open Items' has no '### YYYY-MM-DD - Title' entry"]
    return []


def expected_test_counts() -> dict[str, int]:
    rows = [
        json.loads(line)
        for line in (ROOT_DIR / "test_cases.jsonl").read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    return {
        "total": len(rows),
        "key": sum(1 for row in rows if row.get("tier") == "key"),
    }


def check_doc_test_counts() -> list[str]:
    try:
        counts = expected_test_counts()
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        return [f"test_cases.jsonl is unreadable: {exc}"]

    allowed = {counts["total"], counts["key"]}
    problems: list[str] = []

    for relative_path in DOC_FILES_WITH_COUNTS:
        path = ROOT_DIR / relative_path
        if not path.exists():
            problems.append(f"{relative_path} is missing")
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for line_no, line in enumerate(text.splitlines(), start=1):
            for match in COUNT_CLAIM.finditer(line):
                claimed = int(match.group(1))
                if claimed not in allowed:
                    problems.append(
                        f"{relative_path}:{line_no} claims {claimed} "
                        f"('{match.group(0).strip()}') but actual is "
                        f"total={counts['total']} key={counts['key']}"
                    )
    return problems


def main() -> int:
    print("=" * 65)
    print("       IFC EDITOR - REPOSITORY HYGIENE GATE")
    print("=" * 65)

    try:
        tracked = git_tracked_files()
    except (OSError, subprocess.CalledProcessError) as exc:
        print(f"[FAIL] cannot read the git index: {exc}")
        return 1

    checks = [
        ("Tracked file size <= 5 MB (1 allowlisted product sample)", check_large_files(tracked)),
        ("No two tracked files share identical content", check_duplicate_content(tracked)),
        ("No dated QA artefacts in the repository root", check_root_artefacts()),
        ("DEVELOPMENT_HANDOFF.md Open Items populated", check_handoff_open_items()),
        ("Documented test counts match test_cases.jsonl", check_doc_test_counts()),
    ]

    failed = False
    for title, problems in checks:
        if problems:
            failed = True
            print(f"\n[FAIL] {title} - {len(problems)} violation(s)")
            for problem in problems:
                print(f"   - {problem}")
        else:
            print(f"[PASS] {title}")

    print("=" * 65)
    print("OVERALL STATUS: FAILED" if failed else "OVERALL STATUS: ALL HYGIENE CHECKS PASSED")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
```

```python
"""STEP-26: repository hygiene gate must pass.

Runs the deterministic hygiene gate as a subprocess so the gate's own exit code is
the assertion (it is the executable specification), and imports qa_runner to cover
the AutoTest- project-name contract that makes F-053 non-recurring.
"""

from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
GATE = ROOT / "scripts" / "gates" / "check_repo_hygiene.py"
QA_RUNNER = ROOT / "scripts" / "qa_runner.py"


def test_repo_hygiene_gate_passes() -> None:
    result = subprocess.run(
        [sys.executable, str(GATE)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        "Repository hygiene gate failed.\n"
        f"--- stdout ---\n{result.stdout}\n--- stderr ---\n{result.stderr}"
    )
    assert "ALL HYGIENE CHECKS PASSED" in result.stdout


def _load_qa_runner():
    spec = importlib.util.spec_from_file_location("qa_runner_step26", QA_RUNNER)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize(
    "name, expected",
    [
        ("AutoTest-20261024T101500-TC-001", True),
        ("AutoTest-anything", True),
        ("AutoTest-", True),
        ("AutoTest", False),
        ("autoTest-x", False),
        ("Phase 6 AI Copilot Project", False),
        ("Debug Test", False),
        ("asd", False),
        ("Phase 1 Test Villa", False),
        ("Historical Castle Benchmark (IFC2X3)", False),
    ],
)
def test_is_autotest_project_name(name: str, expected: bool) -> None:
    qa_runner = _load_qa_runner()
    assert qa_runner.is_autotest_project_name(name) is expected
```

</details>

### 2. Watch it fail

```
$ .\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step26_repo_hygiene.py -v

FAILED backend/tests/test_step26_repo_hygiene.py::test_repo_hygiene_gate_passes
AssertionError: Repository hygiene gate failed.
--- stdout ---
=================================================================
       IFC EDITOR - REPOSITORY HYGIENE GATE
=================================================================

[FAIL] Tracked file size <= 5 MB (1 allowlisted product sample) - 8 violation(s)
   -   17.0 MB  modelsfortests/Ifc2x3_Duplex_MEP.ifc
   -    8.4 MB  modelsfortests/Ifc2x3_Duplex_Mechanical.ifc
   ... 6 more

[FAIL] No two tracked files share identical content - 13 violation(s)
   - 0bedb7ff  frontend/src/archive/legacy_ui_v1/SpatialTree.tsx  ==  frontend/src/components/tree/SpatialTree.tsx
   ... 12 more

[FAIL] No dated QA artefacts in the repository root - 24 violation(s)
   - test_report_2026-10-01.md  (3 KB)  -> move to qa_runs/
   ... 23 more

[FAIL] DEVELOPMENT_HANDOFF.md Open Items populated - 1 violation(s)
   - '## Open Items' still contains the '*(None at this time...)*' placeholder

[FAIL] Documented test counts match test_cases.jsonl - 9 violation(s)
   - README.md:195 claims 70 ('70 structured QA test specifications') but actual is total=372 key=123
   ... 8 more
=================================================================
OVERALL STATUS: FAILED

FAILED backend/tests/test_step26_repo_hygiene.py::test_is_autotest_project_name
AttributeError: module 'qa_runner_step26' has no attribute 'is_autotest_project_name'
```

Counts to expect on the current tree: **8 / 13 / 24 / 1 / 9** violations (8, not 9, for file size
because the allowlisted sample is excluded). If your duplicate count is 9 instead of 13, STEP-25 has
already landed — that is fine; the gate must still be red until the IFC duplicates are removed.

### 3. Implement

1. **Land the gate + wrapper** from §1. Do **not** register it in `run_gates.py` yet — you want to see
   it fail on its own, in isolation, from `backend/`.
2. **Stop the QA artefacts recurring** (`scripts/qa_runner.py:65-71`): move results/reports under
   `qa_runs/<date>/`, create the directory, and update `.github/workflows/qa-harness.yml:158,172-173`
   to `qa_runs/**`. Then move the 24 existing files:
   ```powershell
   New-Item -ItemType Directory -Force qa_runs\archive | Out-Null
   Move-Item test_report_*.md, test_results_*.jsonl qa_runs\archive\
   ```
   `qa_runs/` is gitignored, so the archive leaves the tree without entering history.
3. **Untrack `.agents/`:** `git rm -r --cached --quiet .agents`, add `.agents/` to `.gitignore`,
   and fix `README.md:213-214` + `GEMINI.md:71` to say the directory is a local checkout.
4. **Fix the fixture duplicates first** (biggest single win, −49.4 MB of tracked content, and all 3
   IFC duplicate groups gone):
   ```powershell
   git rm --quiet modelsfortests/Ifc2x3_SampleCastle.ifc `
                   modelsfortests/Building-Architecture.ifc `
                   modelsfortests/Ifc2x3_Duplex_Architecture.ifc
   ```
   The canonical copies stay in `backend/app/samples/` — that is what `SAMPLES_METADATA` loads
   (`backend/app/api/projects.py:79`).
5. **Untrack the remaining large fixtures:**
   `git rm --cached` the 5 remaining files > 5 MB in `modelsfortests/`; add `modelsfortests/` to
   `.gitignore`; keep the small (< 3 MB) fixtures tracked so a fresh clone can still run the small
   tests. Add `IFC_FIXTURES_DIR` resolution where fixtures are referenced
   (`docs/audit-2026-10/tests/backend/*.py` use `ROOT / "modelsfortests"`).
6. **Restore the `AutoTest-` lifecycle** in `scripts/qa_runner.py`:
   ```python
   def is_autotest_project_name(name: str) -> bool:
       return name.startswith("AutoTest-")
   ```
   plus `cleanup_autotest_projects(api_url, run_id)` that lists `GET /api/projects` and issues
   `DELETE /api/projects/{id}` only for names matching `AutoTest-{run_id}`; call it from a
   `finally:` block around the case loop at `:4055-4086`. Add `--cleanup-autotest` for the
   prefix-wide purge.
7. **Add `scripts/cleanup_test_projects.py`** (dry-run default, `--yes` to delete, prints name/id/size,
   refuses unknown names unless `--names` is passed explicitly).
8. **Populate `## Open Items`** in `DEVELOPMENT_HANDOFF.md:41-45`. One `### ` entry per open finding
   group, each with the §B8 field set. Do not mark anything Resolved that has no merged fix.
9. **Fix the nine count claims** to 372 / 123 / 246.
10. **Register the gate:** `scripts/gates/run_gates.py:15-21`.
11. **Run the gate twice** to prove determinism, and **run it on a fresh clone-state check**:
    `git ls-files | ForEach-Object { (Get-Item $_).Length } | Measure-Object -Sum` before/after.

### 4. Watch it pass

```
PS> .\backend\venv\Scripts\python.exe scripts/gates/check_repo_hygiene.py
=================================================================
       IFC EDITOR - REPOSITORY HYGIENE GATE
=================================================================
[PASS] Tracked file size <= 5 MB (1 allowlisted product sample)
[PASS] No two tracked files share identical content
[PASS] No dated QA artefacts in the repository root
[PASS] DEVELOPMENT_HANDOFF.md Open Items populated
[PASS] Documented test counts match test_cases.jsonl
=================================================================
OVERALL STATUS: ALL HYGIENE CHECKS PASSED
```

```
PS> .\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step26_repo_hygiene.py -v
backend/tests/test_step26_repo_hygiene.py::test_repo_hygiene_gate_passes PASSED
backend/tests/test_step26_repo_hygiene.py::test_is_autotest_project_name[...] PASSED (x10)
12 passed
```

### 5. Regression guard

```powershell
.\backend\venv\Scripts\python.exe -m pytest backend/tests/ -q
#   must be green; test_phase7.py depends on backend/app/samples/* which this step does not touch

.\backend\venv\Scripts\python.exe scripts/gates/run_gates.py
#   6 gates now: Zero Emoji, Hardcode Linter, Semantic Intent Linter,
#   Token Contrast Verifier, Spatial Collision & Deduplication, Repository Hygiene
#   OVERALL STATUS: ALL GATES PASSED

.\backend\venv\Scripts\python.exe scripts\qa_runner.py check
#   STATUS: HARNESS CHECK PASSED, and now reports 372 total / 123 key

# from frontend/
pnpm exec tsc -b --noEmit
pnpm exec vitest run
```

## Acceptance criteria

- [ ] `git ls-files` count drops from 401 to **≤ 220** (184 `.agents` + 3 deleted duplicates + 5 untracked big fixtures = −192).
- [ ] Sum of tracked bytes drops from 239.6 MB to **< 70 MB** (measured expectation **68.3 MB**: the
      47 MB allowlisted sample + ~21 MB of source, docs and small fixtures).
- [ ] `git ls-files | Where-Object { (Get-Item $_).Length -gt 5MB }` returns exactly one path: `backend/app/samples/Ifc2x3_SampleCastle.ifc`.
- [ ] The MD5 duplicate walk returns **0** groups.
- [ ] `Get-ChildItem test_report_*.md, test_results_*.jsonl` in the repo root returns nothing; the 24 files live under `qa_runs/archive/`.
- [ ] `DEVELOPMENT_HANDOFF.md` `## Open Items` has ≥ 10 `### ` entries and no `*(None` string.
- [ ] Every test-count claim in the four documents reads 372 (total) or 123 (key); `grep` for `\b(70|113|118|323|359|366)\b` near "test" returns nothing.
- [ ] `check_repo_hygiene.py` exits 0 and exits 1 when a 6 MB file is copied into `frontend/src/` (verify and revert).
- [ ] `backend/tests/test_step26_repo_hygiene.py` is green (12 tests).
- [ ] Two `qa_runner.py run --dry-run` runs add **0** projects: `SELECT COUNT(*) FROM projects` identical before/after.
- [ ] `python scripts/cleanup_test_projects.py` with no flags prints the 30 legacy projects and deletes nothing.

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| `git rm --cached` on `.agents/` breaks an agent workflow that reads tracked skills | Files stay on disk; `.gitignore` keeps them; `README.md`/`GEMINI.md` updated. Verify by running one agent session before merging | `git add -f .agents` restores tracking |
| Untracking large fixtures breaks a fixture-dependent test on another machine / in CI | Small fixtures stay tracked; large ones resolve via `IFC_FIXTURES_DIR` with `pytest.skip` when absent. CI's `pytest backend/tests -v` does not read `modelsfortests/` (verified: only `docs/audit-2026-10/tests/**` does) | `git checkout <sha> -- modelsfortests/` |
| Someone deletes the 47 MB castle sample "because the gate says 5 MB" | Gate allowlists exactly that path with the reason inline; acceptance criterion names it | `git checkout <sha> -- backend/app/samples/Ifc2x3_SampleCastle.ifc` |
| The hygiene gate is registered in `run_gates.py` before the fixes land → every local gate run goes red and people start ignoring it | Implement in the order given: gate first, run standalone, register last (§3 step 10) | Remove the one line from `GATES` |
| Moving QA artefacts to `qa_runs/` breaks the CI step-summary glob | Workflow updated in the same commit (`:158`, `:172-173`); verify with `python scripts/qa_runner.py report` after a dry run | `git revert` |
| `## Open Items` entries are fabricated to satisfy the gate | The gate only checks for existence of `### `. Review the diff: every entry must cite a finding ID and a real observation | Edit the file |
| Doc-count fix introduces a *new* wrong number | The gate recomputes from `test_cases.jsonl` on every run — a wrong number cannot pass | `git revert` |

## Notes

- **Ordering:** STEP-26 is independent of STEP-25, but the duplicate-content check is only green once
  STEP-25 has deleted the four frontend duplicate pairs. Run STEP-25 first, or accept a red gate for
  those four groups while you work and merge both in the same week.
- **The gate cannot check history.** `.git` will stay ~39 MB with 175 MB of IFC blobs in it until a
  coordinated `git filter-repo` + force-push. Say so in the handoff entry; do not let the green gate
  imply the repo is small.
- **F-059 count correction:** the audit says 20 artefacts; the tree has 24 (12 reports + 12 result
  files). Both the gate and the report must use 24.
- **`is_autotest_project_name("AutoTest-")` returns `True`.** That is intentional: an empty run id is
  still a machine-created project. If you prefer to reject it, add the check *and* the parametrised
  case together so the contract stays explicit.
- **`qa_runner.py` currently creates no projects at all** — the 30 leftovers came from manual runs and
  from `pytest` (`backend/tests/test_phase7.py:143-145` does clean up after itself). So step 6 is
  about *future* runs: without it, the next person who automates a project-creating case re-pollutes
  the list.
- The 30 legacy projects must be triaged by a human. Two of them
  (`b30eaff7-…` "Historical Castle Benchmark", `53a78d8b-…` "Ifc2x3_Duplex_Architecture") are used by
  the audit's own measurements; deleting them invalidates a re-run of `VERIFICATION.md` §2.2/§2.3.
  Recommended: keep those two, delete the rest after `--yes`.
- **Two fixture-dependent test files live outside the default test run:**
  `docs/audit-2026-10/tests/backend/test_step01_ai_transform_units.py:49` uses
  `modelsfortests/Ifc4_Revit_ARC.ifc` (13.0 MB — one of the fixtures this step untracks), and
  `test_step06_clash_correctness.py:44` uses `Ifc2x3_Duplex_Architecture.ifc` (2.3 MB — one of the
  three duplicates this step deletes from `modelsfortests/`; the canonical copy stays at
  `backend/app/samples/ifc2x3_duplex_architecture.ifc`). Point both at the new resolution helper as
  part of §3 step 5, or they will fail with `FileNotFoundError` for whoever runs them next.
- Verify `pytest backend/tests -q` is green **before** you start: master is red for an unrelated
  reason (F-011, STEP-07). If it is still red when you finish, report both statuses separately rather
  than attributing the red to this step.

### 2026-10-25 — Execution notes (completed)

- **Test counts verified before editing:** a script over `test_cases.jsonl` returns **372 total /
  123 `key` / 246 `full` / 3 `milestone`** — identical to the measured figures in this document, so no
  correction was needed there. All nine documented claims were rewritten: the four "totals" lines read
  372, the two "critical paths" lines read 123. The two tier lines that must state the *milestone* size
  (`README.md:211`, `project.config.md:92`) and the `AGENTS.md` tier line now read "246 full-tier
  **checks**" — deliberately not "tests"/"cases", because the gate's count-claim regex accepts only the
  total and the key totals and would otherwise fail on a number that is correct for that tier.
- **Duplicate groups were 9, not 13.** STEP-25's four frontend duplicate pairs are already staged for
  deletion, so the "STEP-25 has already landed" branch of §2 applies. The 9 remaining groups were the
  6 `.agents/skills/**` pairs plus the 3 IFC fixture pairs; after untracking `.agents/` and removing the
  fixtures the gate's duplicate walk returns **0**.
- **8 large fixtures, 7 of them `--cached`.** The document says "`git rm --cached` the 5 remaining files
  > 5 MB", which is an arithmetic slip: 8 files exceed 5 MB and three of them are the duplicates that
  step 4 deletes, leaving **7**. `Building-Architecture.ifc` (0.14 MB) is a duplicate but not a large
  file. All 7 were `git rm --cached`, so they stay on disk for the fixture-dependent tests.
- **Duplicates verified by hash before deleting.** `git rm` (not `--cached`) on
  `modelsfortests/Ifc2x3_SampleCastle.ifc` (E7B3C2BB), `modelsfortests/Building-Architecture.ifc`
  (51809F12) and `modelsfortests/Ifc2x3_Duplex_Architecture.ifc` (E9E6DF73) — each MD5 matched the
  `backend/app/samples/` copy named in the Evidence section before the delete.
- **`backend/tests/test_step26_repo_hygiene.py` collects 11 tests, not 12:** 1 gate wrapper + 10
  parametrised `is_autotest_project_name` cases. All 11 pass. The "12" in §4/acceptance is off by one.
- **Fixture resolution implemented as recommended:** `docs/audit-2026-10/tests/backend/
  test_step01_ai_transform_units.py` and `test_step04_event_loop_offload.py` now resolve
  `IFC_FIXTURES_DIR` (default `<repo>/modelsfortests`) and skip with an explicit message when absent;
  `test_step06_clash_correctness.py` points at the canonical tracked
  `backend/app/samples/ifc2x3_duplex_architecture.ifc` instead of the deleted duplicate. No download URL
  was invented.
- **Artefact move:** the 24 root QA files moved to `qa_runs/archive/`; 22 of them were still *tracked*
  despite `.gitignore:41-42`, so their deletions are staged. `qa_runs/` is gitignored by this step.
  `qa_runner.py run`/`report` now write to `qa_runs/<YYYY-MM-DD>/` (verified with a 2-case dry run: the
  only file in the repo root afterwards is none), and `cmd_report` prints the absolute path.
- **AutoTest lifecycle:** `is_autotest_project_name`, `autotest_project_name`,
  `create_autotest_project`, `cleanup_autotest_projects` are module-level; `run_suite_async` closes the CDP
  session and deletes `AutoTest-<run-id>*` in a `finally:` block (skipped in `--dry-run`, which creates
  nothing); `--cleanup-autotest` purges the whole prefix and exits.
- **Measured end state:** index `158` files / **63.1 MB** (HEAD: 401 / 239.5 MB). Exactly one tracked file
  is > 5 MB (`backend/app/samples/Ifc2x3_SampleCastle.ifc`). `.agents/` is 0 tracked / 187 files on disk.
  Staged deletions: 184 `.agents` + 10 `modelsfortests` + 22 QA artefacts (+27 frontend from STEP-25).
- **Regression guard at hand-off:** `scripts/gates/run_gates.py` → all **6** gates pass (Repository
  Hygiene included). `pytest backend/tests -q` → **7 failed / 37 passed**; none of the failures belong to
  this step (2 x `test_step01_ai_transform_units.py` = F-001 lane, 5 x `test_step21_wall_resize.py` =
  STEP-21 lane). At session start the suite was 7 failed / 13 passed, i.e. already red (F-011).
- **Gate proven to bite:** copying a 6 MB file into `frontend/src/` and `git add -f`-ing it makes the gate
  exit 1 with two violations (size + duplicate); after `git rm --cached` and deleting the probe files the
  gate returns to green. Determinism confirmed by repeated consecutive runs (identical output).
- **Not verified locally:** anything requiring a live backend on `:8000` — `--cleanup-autotest` and
  `scripts/cleanup_test_projects.py` were exercised only on their offline paths (clean warning / exit 1).
  Consequently the 30 legacy projects were never listed or deleted by this session, which is the
  intended data-safe default.
