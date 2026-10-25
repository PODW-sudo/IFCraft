"""One-command dependency CVE audit (open issue 3.7) - the same two gates CI runs.

    .\\backend\\venv\\Scripts\\python.exe scripts/security_audit.py

It runs, against this checkout:

    1. pip-audit -r backend/requirements.txt        (PyPI advisories for every pinned range)
    2. pnpm audit --prod --audit-level high         (production JS deps; fails on high/critical)

CI runs the identical commands in the `security-audit` job of
`.github/workflows/qa-harness.yml`, so a clean local run is a good predictor of a green gate.

Exit codes
----------
0  every available audit passed (or was skipped because the tool is not installed)
1  at least one audit reported a vulnerability (or the tool itself errored)
2  unexpected error

A tool that is not installed is reported as SKIPPED with the install command rather than
silently passing: the point of running this locally is to know what was and was not checked.

`pip-audit` does not grade PyPI advisories by severity, so it fails on *any* known vulnerable
dependency; `pnpm audit --audit-level high` fails only on high/critical. Neither command edits
`requirements.txt` or the lockfile - updating a dependency is a reviewed change, not something
an audit script does on its own.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


def _repo_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "backend" / "app" / "main.py").exists():
            return parent
    raise SystemExit("Could not locate the repository root (backend/app/main.py missing)")


ROOT = _repo_root()


@dataclass
class Audit:
    name: str
    command: list[str]
    cwd: Path
    available: bool
    hint: str
    output: str = ""
    returncode: int = 0
    skipped: bool = False
    error: str = ""

    @property
    def status(self) -> str:
        if self.skipped:
            return "SKIPPED"
        if self.error:
            return "ERROR"
        return "PASS" if self.returncode == 0 else "FAIL"


def _python_module_available(module: str) -> bool:
    probe = subprocess.run(
        [sys.executable, "-m", module, "--version"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=120,
    )
    return probe.returncode == 0


def _build_audits() -> list[Audit]:
    pnpm = shutil.which("pnpm")
    return [
        Audit(
            name="Backend (pip-audit, backend/requirements.txt)",
            command=[sys.executable, "-m", "pip_audit", "-r", "backend/requirements.txt"],
            cwd=ROOT,
            available=_python_module_available("pip_audit"),
            hint=f'"{sys.executable}" -m pip install pip-audit',
        ),
        Audit(
            name="Frontend (pnpm audit --prod --audit-level high)",
            command=[pnpm or "pnpm", "audit", "--prod", "--audit-level", "high"],
            cwd=ROOT / "frontend",
            available=bool(pnpm) and (ROOT / "frontend" / "package.json").exists(),
            hint="corepack enable && pnpm install (in frontend/)",
        ),
    ]


def _run(audit: Audit) -> None:
    if not audit.available:
        audit.skipped = True
        return
    try:
        completed = subprocess.run(
            audit.command,
            cwd=str(audit.cwd),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=1800,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        audit.error = f"{type(exc).__name__}: {exc}"
        audit.returncode = 1
        return
    audit.returncode = completed.returncode
    audit.output = (completed.stdout or "") + (completed.stderr or "")


def main() -> int:
    # Windows consoles default to cp1252; `pnpm audit` and pip-audit emit box drawing and
    # non-ASCII package metadata. Never let a report crash on its own output.
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except (OSError, ValueError):  # pragma: no cover - redirected/closed streams
                pass

    print("Dependency CVE audit (open issue 3.7)")
    print(f"Repository: {ROOT}")
    print()

    audits = _build_audits()
    for index, audit in enumerate(audits, start=1):
        print(f"[{index}/{len(audits)}] {audit.name}")
        _run(audit)
        if audit.skipped:
            print(f"  SKIPPED - tool not available. Install with: {audit.hint}")
        elif audit.error:
            print(f"  ERROR - {audit.error}")
        else:
            body = audit.output.strip()
            if body:
                print(body)
            print(f"  -> {audit.status} (exit {audit.returncode})")
        print()

    print("Summary")
    print("-" * 60)
    for audit in audits:
        note = ""
        if audit.skipped:
            note = f"  ({audit.hint})"
        elif audit.error:
            note = f"  ({audit.error})"
        print(f"{audit.status:<8} {audit.name}{note}")

    failed = [audit for audit in audits if audit.status in ("FAIL", "ERROR")]
    if failed:
        print()
        print("Vulnerable or unverifiable dependencies found. Review the report above; a fixed")
        print("version usually means a small, reviewed bump of requirements.txt or the lockfile.")
        return 1
    if any(audit.skipped for audit in audits):
        print()
        print("At least one audit was skipped; install the tool to get full coverage.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception as exc:  # pragma: no cover - last-resort guard for a local CLI
        print(f"Unexpected error: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise SystemExit(2)
