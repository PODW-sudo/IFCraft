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


def _is_canonical_mirror(paths: list[str]) -> bool:
    """A docs test and its executed copy are an intentional mirror, not dead weight.

    docs/audit-2026-10/tests/ is the audit package's ready-to-run test set; the same file under
    backend/tests/ is what CI executes. They are expected to be byte-identical until one is edited.
    """
    if len(paths) != 2:
        return False
    backend = [p for p in paths if p.startswith("backend/tests/")]
    docs = [p for p in paths if p.startswith("docs/audit-2026-10/tests/")]
    if len(backend) != 1 or len(docs) != 1:
        return False
    return Path(backend[0]).name == Path(docs[0]).name


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
        if len(paths) > 1 and not _is_canonical_mirror(paths):
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
