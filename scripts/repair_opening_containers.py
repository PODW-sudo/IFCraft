#!/usr/bin/env python3
"""Re-file door/window fillings under their host wall's storey (audit 1.5).

WHY
  Before STEP-22, `create_opening` filed every `IfcDoor`/`IfcWindow` in the *first* storey
  of the model instead of the storey that contains the host wall. The code fix is
  forward-only, so any project saved earlier still shows every door on the ground floor -
  wrong in the spatial tree, in storey-filtered schedules, in plan cuts and in exports.
  This script repairs those existing files. It is **not** run on project open: a repair
  rewrites a user file and must be an explicit action.

WHAT IT DOES
  For every `IfcRelFillsElement`:
    * resolve the host wall through the opening's `IfcRelVoidsElement`;
    * skip the filling when `get_container(host_wall)` is not an `IfcBuildingStorey`
      (an uncontained or building-assigned wall has no single right storey here - the
      create path's nearest-elevation rule is deliberately *not* guessed backwards);
    * otherwise re-contain the filling in that storey when it is filed elsewhere.

  Idempotent: a second run plans and writes nothing.

DATA SAFETY
  * Dry run by default; nothing is written without `--yes`.
  * `model.ifc` is copied to `model.ifc.bak` before it is replaced.
  * The replacement is atomic (temp file in the project directory + `os.replace`), so a
    crash cannot truncate the model.
  * Only `IfcRelContainedInSpatialStructure` membership of a filling changes: no element,
    placement, property, geometry or express id is touched.
  * Stop the backend (or at least do not edit the same project) while this runs: the
    running server holds no lock this offline script can take.

USAGE
  python scripts/repair_opening_containers.py                       # dry run, all projects
  python scripts/repair_opening_containers.py --yes                 # apply, all projects
  python scripts/repair_opening_containers.py --project-id <uuid>   # one project (repeatable)
  python scripts/repair_opening_containers.py --project-id <uuid> --yes
  python scripts/repair_opening_containers.py --storage-root D:/tmp/projects --yes

Exit codes: 0 = success (including "nothing to do"), 1 = a project failed, 2 = bad usage.
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional

import ifcopenshell
import ifcopenshell.api
import ifcopenshell.util.element

ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_STORAGE_ROOT = ROOT_DIR / "storage" / "projects"
BACKUP_SUFFIX = ".bak"
REPLACE_ATTEMPTS = 3


@dataclass(frozen=True)
class Repair:
    """One filling that belongs in a different storey than the one it is filed in."""

    filling_id: int
    filling_type: str
    filling_name: str
    opening_id: int
    host_wall_id: int
    from_storey_id: Optional[int]
    from_storey_name: str
    to_storey_id: int
    to_storey_name: str

    def describe(self) -> str:
        return (
            f"filling #{self.filling_id} {self.filling_type} "
            f"({self.from_storey_name} -> {self.to_storey_name}), "
            f"host wall #{self.host_wall_id}, opening #{self.opening_id}"
        )


def _host_wall(model: ifcopenshell.file, opening: ifcopenshell.entity_instance):
    """The wall an opening cuts, via IfcRelVoidsElement."""
    for rel in model.by_type("IfcRelVoidsElement"):
        if rel.RelatedOpeningElement is None:
            continue
        if rel.RelatedOpeningElement.id() == opening.id():
            return rel.RelatingBuildingElement
    return None


def _storey_label(storey) -> str:
    name = getattr(storey, "Name", None)
    return f"#{storey.id()} {name}" if name else f"#{storey.id()} (unnamed)"


def plan_repairs(model: ifcopenshell.file) -> list[Repair]:
    """Every filling whose host wall's storey differs from the filling's own container.

    Pure: reads the model, mutates nothing, so the dry run and the apply path share it.
    """
    repairs: list[Repair] = []
    for rel in model.by_type("IfcRelFillsElement"):
        filling = rel.RelatedBuildingElement
        opening = rel.RelatingOpeningElement
        if filling is None or opening is None:
            continue

        host_wall = _host_wall(model, opening)
        if host_wall is None or not host_wall.is_a("IfcWall"):
            continue

        target = ifcopenshell.util.element.get_container(host_wall)
        if target is None or not target.is_a("IfcBuildingStorey"):
            # No defensible target: leave the filling where it is rather than guess.
            continue

        current = ifcopenshell.util.element.get_container(filling)
        if current is not None and current.id() == target.id():
            continue

        repairs.append(
            Repair(
                filling_id=filling.id(),
                filling_type=filling.is_a(),
                filling_name=getattr(filling, "Name", None) or filling.is_a(),
                opening_id=opening.id(),
                host_wall_id=host_wall.id(),
                from_storey_id=current.id() if current is not None else None,
                from_storey_name=_storey_label(current) if current is not None else "no storey",
                to_storey_id=target.id(),
                to_storey_name=_storey_label(target),
            )
        )
    return repairs


def apply_repairs(model: ifcopenshell.file, repairs: Iterable[Repair]) -> int:
    """Re-contain each filling in its host wall's storey. Returns the number moved."""
    moved = 0
    for repair in repairs:
        filling = model.by_id(repair.filling_id)
        storey = model.by_id(repair.to_storey_id)
        if filling is None or storey is None:
            # The plan is stale (the file changed between plan and apply): skip, never raise.
            continue
        ifcopenshell.api.run(
            "spatial.assign_container", model, relating_structure=storey, products=[filling]
        )
        moved += 1
    return moved


def _replace_with_retry(tmp: Path, target: Path) -> None:
    """`os.replace` can lose a race with an antivirus/reader handle on Windows."""
    last_error: Optional[OSError] = None
    for attempt in range(1, REPLACE_ATTEMPTS + 1):
        try:
            os.replace(tmp, target)
            return
        except OSError as exc:  # pragma: no cover - platform dependent
            last_error = exc
            print(f"  replace attempt {attempt}/{REPLACE_ATTEMPTS} failed: {exc}", file=sys.stderr)
            if attempt < REPLACE_ATTEMPTS:
                time.sleep(0.05 * attempt)
    assert last_error is not None
    raise last_error


def atomic_write_model(model: ifcopenshell.file, path: Path) -> None:
    """Serialise into a temp file next to `path`, then rename it over `path` (STEP-03 rule)."""
    path = Path(path)
    fd, tmp_name = tempfile.mkstemp(dir=str(path.parent), prefix=f"{path.name}.", suffix=".tmp")
    os.close(fd)
    tmp = Path(tmp_name)
    try:
        model.write(str(tmp))
        with open(tmp, "rb+") as handle:
            handle.flush()
            os.fsync(handle.fileno())
        _replace_with_retry(tmp, path)
    finally:
        if tmp.exists():  # pragma: no cover - only on a failed write
            try:
                tmp.unlink()
            except OSError:
                pass


def repair_file(path: Path, *, apply: bool) -> tuple[list[Repair], int]:
    """Plan (and optionally apply) the repairs for one `model.ifc`. Returns (plan, moved)."""
    path = Path(path)
    model = ifcopenshell.open(str(path))
    repairs = plan_repairs(model)
    if not apply or not repairs:
        return repairs, 0

    moved = apply_repairs(model, repairs)
    if moved == 0:
        return repairs, 0

    backup = path.with_name(path.name + BACKUP_SUFFIX)
    shutil.copyfile(path, backup)
    atomic_write_model(model, path)
    return repairs, moved


def _project_files(storage_root: Path, project_ids: Optional[set[str]]) -> list[Path]:
    if not storage_root.is_dir():
        return []
    paths: list[Path] = []
    for child in sorted(storage_root.iterdir()):
        if not child.is_dir():
            continue
        if project_ids is not None and child.name not in project_ids:
            continue
        model = child / "model.ifc"
        if model.is_file():
            paths.append(model)
    return paths


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Re-file door/window fillings under their host wall's storey (dry run by default)."
    )
    parser.add_argument(
        "--yes", action="store_true",
        help="actually rewrite the model files (default: dry run, nothing is written)",
    )
    parser.add_argument(
        "--project-id", action="append", default=None, metavar="UUID",
        help="only this project (repeatable); default: every project in the storage root",
    )
    parser.add_argument(
        "--storage-root", default=str(DEFAULT_STORAGE_ROOT), metavar="PATH",
        help=f"project storage directory (default: {DEFAULT_STORAGE_ROOT})",
    )
    args = parser.parse_args(argv)

    storage_root = Path(args.storage_root)
    requested = set(args.project_id) if args.project_id else None
    files = _project_files(storage_root, requested)

    if requested:
        found = {path.parent.name for path in files}
        for missing in sorted(requested - found):
            print(f"project {missing}: no model.ifc under {storage_root}", file=sys.stderr)

    if not files:
        print(f"No project models found under {storage_root}.")
        return 0

    mode = "apply" if args.yes else "dry run"
    print(f"Repairing opening containers in {len(files)} project(s) [{mode}]")

    total_planned = 0
    total_moved = 0
    failures = 0

    for model_path in files:
        project_id = model_path.parent.name
        try:
            repairs, moved = repair_file(model_path, apply=args.yes)
        except Exception as exc:  # a corrupt model must not abort the other projects
            failures += 1
            print(f"project {project_id}: FAILED - {exc}", file=sys.stderr)
            continue

        total_planned += len(repairs)
        total_moved += moved
        if not repairs:
            print(f"project {project_id}: 0 filling(s) to re-file (already correct)")
            continue

        if args.yes:
            print(f"project {project_id}: re-filed {moved} of {len(repairs)} filling(s); backup: {model_path.name}{BACKUP_SUFFIX}")
        else:
            print(f"project {project_id}: {len(repairs)} filling(s) to re-file (dry run - pass --yes to write)")
        for repair in repairs:
            print(f"  {repair.describe()}")

    if args.yes:
        print(f"Done: {total_moved} filling(s) re-filed across {len(files)} project(s).")
    else:
        print(f"Dry run: {total_planned} filling(s) would be re-filed. Nothing was written.")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
