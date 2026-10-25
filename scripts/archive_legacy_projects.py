#!/usr/bin/env python3
"""Archive legacy/test projects out of the active project list without deleting data.

Why: the 2026-10 audit found 30+ pre-audit test projects polluting the project picker
(F-053). `cleanup_test_projects.py` deletes only `AutoTest-*` projects by design. This
script is the explicit, reversible path for everything else:

  storage/projects/<id>/            ->  storage/projects_archive/<slug>-<id>/files/
  all DB rows for that project      ->  storage/projects_archive/<slug>-<id>/project.json
  append-only index                 ->  storage/projects_archive/manifest.jsonl

Restore with `--restore <id>`: rows are re-inserted (projects first) and the directory
is moved back to storage/projects/<id>.

Safety:
  * dry-run by default; `--yes` is required to move/delete anything;
  * the archive directory is never inside the active projects directory;
  * if the DB dump or the move fails, the project is left untouched;
  * `--keep` excludes by exact name; `--id` limits to explicit ids.

Usage:
  .\\backend\\venv\\Scripts\\python.exe scripts\\archive_legacy_projects.py
  .\\backend\\venv\\Scripts\\python.exe scripts\\archive_legacy_projects.py --keep "My real project" --yes
  .\\backend\\venv\\Scripts\\python.exe scripts\\archive_legacy_projects.py --restore <project-id>
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DB_PATH = ROOT_DIR / "storage" / "projects.db"
PROJECTS_DIR = ROOT_DIR / "storage" / "projects"
ARCHIVE_DIR = ROOT_DIR / "storage" / "projects_archive"
MANIFEST = ARCHIVE_DIR / "manifest.jsonl"

# Child tables first on dump; projects first on restore (FK order).
TABLES = [
    "projects",
    "sessions",
    "edit_history",
    "project_models",
    "cad_transactions",
    "bcf_topics",
    "pinned_elements",
]
CHILD_TABLES = [t for t in TABLES if t != "projects"]


def slugify(name: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9._-]+", "-", name).strip("-")
    return (slug or "project")[:60]


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def table_columns(conn: sqlite3.Connection, table: str) -> list[str]:
    return [r["name"] for r in conn.execute(f"PRAGMA table_info({table})")]


def dump_project(conn: sqlite3.Connection, project_id: str) -> dict:
    dump: dict[str, list[dict]] = {}
    for table in TABLES:
        if table == "projects":
            rows = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchall()
        else:
            rows = conn.execute(
                f"SELECT * FROM {table} WHERE project_id = ?", (project_id,)
            ).fetchall()
        dump[table] = [dict(row) for row in rows]
    return dump


def insert_rows(conn: sqlite3.Connection, dump: dict) -> None:
    for table in TABLES:
        rows = dump.get(table) or []
        if not rows:
            continue
        cols = [c for c in table_columns(conn, table) if c in rows[0]]
        placeholders = ", ".join("?" for _ in cols)
        sql = f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({placeholders})"
        for row in rows:
            conn.execute(sql, [row.get(c) for c in cols])
    conn.commit()


def list_candidates(conn: sqlite3.Connection, only_ids: set[str], keep: set[str]) -> list[sqlite3.Row]:
    rows = conn.execute("SELECT id, name, created_at FROM projects ORDER BY created_at").fetchall()
    out = []
    for row in rows:
        if only_ids and row["id"] not in only_ids:
            continue
        if row["name"] in keep:
            continue
        out.append(row)
    return out


def archive_one(conn: sqlite3.Connection, row: sqlite3.Row, apply: bool) -> bool:
    project_id = row["id"]
    name = row["name"]
    src = PROJECTS_DIR / project_id
    target = ARCHIVE_DIR / f"{slugify(name)}-{project_id}"

    if not apply:
        size = sum(f.stat().st_size for f in src.rglob("*") if f.is_file()) if src.exists() else 0
        print(f"  [DRY] {name} ({project_id})  {size/1024:.1f} KB  -> {target.name}")
        return True

    if target.exists() and (target / "files").exists():
        print(f"  [SKIP] archive target already holds files: {target}")
        return False

    dump = dump_project(conn, project_id)
    if not dump["projects"]:
        print(f"  [SKIP] no projects row for {project_id} (already archived?)")
        return False

    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    target.mkdir(parents=True, exist_ok=True)
    (target / "project.json").write_text(
        json.dumps(dump, indent=2, ensure_ascii=False, default=str), encoding="utf-8"
    )

    moved = False
    try:
        if src.exists():
            shutil.move(str(src), str(target / "files"))
            moved = True

        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.commit()
    except Exception:
        # Best-effort rollback so a failed archive never loses the active project.
        conn.rollback()
        if moved and (target / "files").exists() and not src.exists():
            shutil.move(str(target / "files"), str(src))
        shutil.rmtree(target, ignore_errors=True)
        raise

    record = {
        "id": project_id,
        "name": name,
        "created_at": row["created_at"],
        "archived_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "archive_dir": target.name,
    }
    with MANIFEST.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False) + "\n")
    print(f"  [ARCHIVED] {name} ({project_id}) -> {target.name}")
    return True


def restore(conn: sqlite3.Connection, project_id: str) -> int:
    matches = []
    if MANIFEST.exists():
        for line in MANIFEST.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            rec = json.loads(line)
            if rec.get("id") == project_id:
                matches.append(rec)
    if not matches:
        print(f"[FAIL] no manifest entry for {project_id}")
        return 1
    rec = matches[-1]
    target = ARCHIVE_DIR / rec["archive_dir"]
    dump = json.loads((target / "project.json").read_text(encoding="utf-8"))

    existing = conn.execute("SELECT 1 FROM projects WHERE id = ?", (project_id,)).fetchone()
    if existing:
        print(f"[FAIL] project {project_id} already exists in the active database")
        return 1

    src = PROJECTS_DIR / project_id
    moved = False
    try:
        if (target / "files").exists():
            if src.exists():
                print(f"[FAIL] active directory already exists: {src}")
                return 1
            shutil.move(str(target / "files"), str(src))
            moved = True
        insert_rows(conn, dump)
    except Exception:
        conn.rollback()
        if moved and src.exists() and not (target / "files").exists():
            shutil.move(str(src), str(target / "files"))
        raise

    print(f"[RESTORED] {rec['name']} ({project_id})")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Archive/restore legacy IFC projects (reversible)")
    parser.add_argument("--yes", action="store_true", help="Apply the archive (default: dry run)")
    parser.add_argument("--id", action="append", default=[], help="Only this project id (repeatable)")
    parser.add_argument("--keep", action="append", default=[], help="Exact project name to keep (repeatable)")
    parser.add_argument("--restore", metavar="PROJECT_ID", help="Restore one archived project id")
    args = parser.parse_args()

    if not DB_PATH.exists():
        print(f"[FAIL] database not found: {DB_PATH}")
        return 1

    conn = connect()
    try:
        if args.restore:
            return restore(conn, args.restore)

        candidates = list_candidates(conn, set(args.id), set(args.keep))
        total = sum(
            sum(f.stat().st_size for f in (PROJECTS_DIR / r["id"]).rglob("*") if f.is_file())
            if (PROJECTS_DIR / r["id"]).exists()
            else 0
            for r in candidates
        )
        print(f"Projects in store : {conn.execute('SELECT COUNT(*) FROM projects').fetchone()[0]}")
        print(f"Candidates        : {len(candidates)}")
        print(f"Kept by name      : {len(args.keep)} rule(s)")
        print(f"Size on disk      : {total/1024/1024:.1f} MB")
        print("-" * 78)
        for row in candidates:
            archive_one(conn, row, apply=False)

        if not args.yes:
            print("\nDRY RUN: nothing was moved. Re-run with --yes to archive the listed projects.")
            return 0

        print("\nArchiving...")
        archived = sum(1 for row in candidates if archive_one(conn, row, apply=True))
        print(f"\nArchived {archived}/{len(candidates)} project(s).")
        print(f"Manifest: {MANIFEST}")
        print(f"Restore : scripts/archive_legacy_projects.py --restore <project-id>")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
