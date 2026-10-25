#!/usr/bin/env python3
"""
scripts/cleanup_test_projects.py
Removes leftover automated test projects from the IFC Editor project store.

DATA SAFETY (AGENTS.md B7, F-053)
  Only projects whose name starts with `AutoTest-` are ever considered, plus any name
  passed explicitly via `--names`. The 30 legacy projects that already exist
  ("Phase 1 Test Villa", "Debug Test", "asd", ...) do NOT match that prefix, so this
  tool never touches them automatically - not even with `--yes`. Deleting one of those
  requires naming it explicitly with `--names`, which is a deliberate human decision.

  Two of the legacy projects (`Historical Castle Benchmark (IFC2X3)`,
  `Ifc2x3_Duplex_Architecture`) are referenced by the audit's own measurements and must
  be kept if the audit is to be re-run.

USAGE
  python scripts/cleanup_test_projects.py                     # dry run: list, delete nothing
  python scripts/cleanup_test_projects.py --names "Debug Test" # dry run: also list that name
  python scripts/cleanup_test_projects.py --yes               # delete AutoTest-* only
  python scripts/cleanup_test_projects.py --yes --names "asd" # delete AutoTest-* + that one name

Exit codes: 0 = success (including "nothing to do"), 1 = refusal or failure.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
API_URL = "http://localhost:8000/api/projects"
TOKEN_FILE = ROOT_DIR / "storage" / ".api_token"


def auth_headers(extra: dict | None = None) -> dict:
    """STEP-05: /api routes require the installation token; read it the same way the QA runner does."""
    headers = {"Accept": "application/json"}
    try:
        token = TOKEN_FILE.read_text(encoding="utf-8").strip()
    except OSError:
        token = ""
    if token:
        headers["X-API-Token"] = token
    if extra:
        headers.update(extra)
    return headers
PROJECTS_DIR = ROOT_DIR / "storage" / "projects"
AUTOTEST_PREFIX = "AutoTest-"


def is_autotest_project_name(name: str) -> bool:
    """Mirror of scripts/qa_runner.py:is_autotest_project_name (single contract, kept in sync)."""
    return name.startswith(AUTOTEST_PREFIX)


def list_projects(api_url: str = API_URL) -> list:
    req = urllib.request.Request(api_url, headers=auth_headers())
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def delete_project(api_url: str, project_id: str) -> bool:
    req = urllib.request.Request(
        f"{api_url.rstrip('/')}/{project_id}", method="DELETE", headers=auth_headers()
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status in (200, 204)
    except (urllib.error.HTTPError, urllib.error.URLError) as exc:
        print(f"[WARN] Could not delete {project_id}: {exc}")
        return False


def dir_size(path: Path) -> int:
    if not path.exists():
        return 0
    return sum(item.stat().st_size for item in path.rglob("*") if item.is_file())


def human_bytes(size: int) -> str:
    value = float(size)
    for unit in ("B", "KB", "MB", "GB"):
        if value < 1024 or unit == "GB":
            return f"{value:6.1f} {unit}"
        value /= 1024
    return f"{value:6.1f} GB"


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "List and delete automated test projects. DRY RUN BY DEFAULT. "
            "Only names starting with 'AutoTest-' (plus names passed via --names) are "
            "candidates; the 30 legacy projects in the store never match that prefix "
            "and are never deleted automatically. Requires --yes to delete anything."
        ),
    )
    parser.add_argument("--yes", action="store_true", help="Actually delete (without this, nothing is deleted)")
    parser.add_argument("--names", nargs="*", default=[], help="Explicit additional project names to consider")
    parser.add_argument("--api-url", default=API_URL, help=f"Backend projects endpoint (default {API_URL})")
    args = parser.parse_args()

    try:
        projects = list_projects(args.api_url)
    except (urllib.error.HTTPError, urllib.error.URLError, OSError, ValueError) as exc:
        print(f"[FAIL] cannot reach {args.api_url}: {exc}")
        print("       start the backend (uvicorn backend.app.main:app) and retry.")
        return 1

    explicit = {name.strip() for name in args.names if name.strip()}
    candidates = [
        project for project in projects
        if is_autotest_project_name(str(project.get("name", "")))
        or str(project.get("name", "")) in explicit
    ]

    print("=" * 78)
    print(" IFC EDITOR - TEST PROJECT CLEANUP" + (" (DELETE MODE)" if args.yes else " (DRY RUN)"))
    print("=" * 78)
    print(f"Projects in store : {len(projects)}")
    print(f"Candidates        : {len(candidates)}")
    print(f"Legacy untouched  : {len(projects) - len(candidates)}")
    print("")

    if not candidates:
        print("Nothing to do: no AutoTest-* project and no name matched --names.")
        return 0

    print(f"{'NAME':<46} {'ID':<38} {'SIZE':>10}")
    print("-" * 96)
    total = 0
    for project in candidates:
        project_id = str(project.get("id", ""))
        name = str(project.get("name", ""))
        size = dir_size(PROJECTS_DIR / project_id)
        total += size
        print(f"{name[:44]:<46} {project_id:<38} {human_bytes(size):>10}")

    print("-" * 96)
    print(f"{len(candidates)} project(s), {human_bytes(total)} on disk")

    if not args.yes:
        print("\nDRY RUN: nothing was deleted. Re-run with --yes to delete the listed projects.")
        return 0

    deleted = 0
    for project in candidates:
        project_id = str(project.get("id", ""))
        name = str(project.get("name", ""))
        if delete_project(args.api_url, project_id):
            deleted += 1
            print(f"[DELETED] {name} ({project_id})")

    print(f"\nDeleted {deleted}/{len(candidates)} project(s) in {human_bytes(total)}.")
    return 0 if deleted == len(candidates) else 1


if __name__ == "__main__":
    sys.exit(main())
