"""audit 1.5 - repair script for openings mis-filed by the pre-STEP-22 code.

`scripts/repair_opening_containers.py` re-contains every door/window filling in the storey
of the host wall it fills. These tests exercise the planner (pure), the apply path
(`.bak` + atomic replace + idempotency) and the CLI wiring on a throwaway model.
"""

import hashlib
import sys
from pathlib import Path

import pytest

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

import ifcopenshell
import ifcopenshell.api
import ifcopenshell.util.element

SCRIPT_PATH = Path(root_dir) / "scripts" / "repair_opening_containers.py"


def _load_script():
    """Import scripts/repair_opening_containers.py as a module (scripts/ is not a package)."""
    if str(SCRIPT_PATH.parent) not in sys.path:
        sys.path.insert(0, str(SCRIPT_PATH.parent))
    import repair_opening_containers

    return repair_opening_containers


def _digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _build_model(path: Path) -> dict[str, int]:
    """A two-storey model with one door filed in the wrong storey.

    `ground` holds the wall; the door is contained in `basement` on purpose - exactly what
    the pre-STEP-22 code did (every filling in storeys[0]).
    """
    model = ifcopenshell.file(schema="IFC4")
    project = ifcopenshell.api.run(
        "root.create_entity", model, ifc_class="IfcProject", name="AutoTest-repair"
    )
    ifcopenshell.api.run("unit.assign_unit", model)
    ifcopenshell.api.run("context.add_context", model, context_type="Model")

    site = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcSite", name="Site")
    building = ifcopenshell.api.run(
        "root.create_entity", model, ifc_class="IfcBuilding", name="Building"
    )
    ifcopenshell.api.run("aggregate.assign_object", model, relating_object=project, products=[site])
    ifcopenshell.api.run("aggregate.assign_object", model, relating_object=site, products=[building])

    basement = ifcopenshell.api.run(
        "root.create_entity", model, ifc_class="IfcBuildingStorey", name="Basement"
    )
    basement.Elevation = 0.0
    ground = ifcopenshell.api.run(
        "root.create_entity", model, ifc_class="IfcBuildingStorey", name="Ground"
    )
    ground.Elevation = 3.0
    ifcopenshell.api.run(
        "aggregate.assign_object", model, relating_object=building, products=[basement, ground]
    )

    wall = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcWall", name="Resident Wall")
    ifcopenshell.api.run(
        "spatial.assign_container", model, relating_structure=ground, products=[wall]
    )

    opening = ifcopenshell.api.run(
        "root.create_entity", model, ifc_class="IfcOpeningElement", name="Void"
    )
    ifcopenshell.api.run("feature.add_feature", model, feature=opening, element=wall)

    door = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcDoor", name="D1")
    ifcopenshell.api.run("feature.add_filling", model, opening=opening, element=door)
    # The bug: filed in the first storey, not the wall's storey.
    ifcopenshell.api.run(
        "spatial.assign_container", model, relating_structure=basement, products=[door]
    )

    # A second door on a wall with no spatial container at all: no defensible target, so the
    # planner must leave it alone (only 1 of the 2 fillings is repairable).
    orphan_wall = ifcopenshell.api.run(
        "root.create_entity", model, ifc_class="IfcWall", name="Orphan Wall"
    )
    orphan_opening = ifcopenshell.api.run(
        "root.create_entity", model, ifc_class="IfcOpeningElement", name="Orphan Void"
    )
    ifcopenshell.api.run(
        "feature.add_feature", model, feature=orphan_opening, element=orphan_wall
    )
    orphan_door = ifcopenshell.api.run(
        "root.create_entity", model, ifc_class="IfcDoor", name="D2"
    )
    ifcopenshell.api.run(
        "feature.add_filling", model, opening=orphan_opening, element=orphan_door
    )
    ifcopenshell.api.run(
        "spatial.assign_container", model, relating_structure=basement, products=[orphan_door]
    )

    model.write(str(path))
    return {
        "basement": basement.id(),
        "ground": ground.id(),
        "wall": wall.id(),
        "door": door.id(),
        "orphan_wall": orphan_wall.id(),
        "orphan_door": orphan_door.id(),
    }


@pytest.fixture()
def model_file(tmp_path):
    path = tmp_path / "model.ifc"
    ids = _build_model(path)
    return path, ids


def test_planner_finds_only_the_repairable_filling(model_file):
    """Spec 1: the plan is the wrong-storey filling, and only that one."""
    path, ids = model_file
    script = _load_script()
    model = ifcopenshell.open(str(path))

    repairs = script.plan_repairs(model)
    assert len(repairs) == 1, [repair.describe() for repair in repairs]
    repair = repairs[0]
    assert repair.filling_id == ids["door"]
    assert repair.host_wall_id == ids["wall"]
    assert repair.to_storey_id == ids["ground"]
    assert repair.from_storey_id == ids["basement"]
    assert repair.from_storey_name != repair.to_storey_name


def test_dry_run_changes_nothing(model_file):
    """Spec 2: no `--yes` means no write, no backup."""
    path, _ids = model_file
    script = _load_script()
    before = _digest(path)

    repairs, moved = script.repair_file(path, apply=False)

    assert len(repairs) == 1
    assert moved == 0
    assert _digest(path) == before, "a dry run rewrote the model"
    assert not path.with_name(path.name + ".bak").exists()


def test_apply_moves_the_filling_and_is_idempotent(model_file):
    """Spec 3, 4, 5: apply re-files the filling, leaves a backup, and a second run is a no-op."""
    path, ids = model_file
    script = _load_script()
    before = _digest(path)

    repairs, moved = script.repair_file(path, apply=True)
    assert len(repairs) == 1
    assert moved == 1

    backup = path.with_name(path.name + ".bak")
    assert backup.is_file(), "no .bak of model.ifc was written"
    assert _digest(backup) == before, "the backup is not the pre-repair file"

    model = ifcopenshell.open(str(path))
    container = ifcopenshell.util.element.get_container(model.by_id(ids["door"]))
    assert container is not None and container.id() == ids["ground"], (
        f"filling is still in {container.id() if container else None}"
    )
    # The unrepairable one is untouched, and nothing was deleted.
    orphan_container = ifcopenshell.util.element.get_container(model.by_id(ids["orphan_door"]))
    assert orphan_container is not None and orphan_container.id() == ids["basement"]
    assert model.by_id(ids["wall"]).is_a() == "IfcWall"

    # Second run: nothing planned, nothing written.
    once = _digest(path)
    repairs_again, moved_again = script.repair_file(path, apply=True)
    assert repairs_again == []
    assert moved_again == 0
    assert _digest(path) == once, "a second run rewrote an already-correct model"


def test_cli_is_dry_by_default_and_writes_with_yes(tmp_path, capsys):
    """Spec 6: the CLI prints a per-project count and only writes on --yes."""
    script = _load_script()
    project_id = "11111111-2222-3333-4444-555555555555"
    project_dir = tmp_path / "projects" / project_id
    project_dir.mkdir(parents=True)
    path = project_dir / "model.ifc"
    ids = _build_model(path)
    before = _digest(path)

    assert script.main(["--storage-root", str(tmp_path / "projects")]) == 0
    out = capsys.readouterr().out
    assert f"project {project_id}: 1 filling(s) to re-file" in out, out
    assert _digest(path) == before, "the default CLI run wrote the model"

    assert script.main(["--storage-root", str(tmp_path / "projects"), "--yes"]) == 0
    out = capsys.readouterr().out
    assert f"project {project_id}: re-filed 1 of 1 filling(s)" in out, out
    assert _digest(path) != before

    model = ifcopenshell.open(str(path))
    container = ifcopenshell.util.element.get_container(model.by_id(ids["door"]))
    assert container is not None and container.id() == ids["ground"]

    # And the CLI agrees it is now clean.
    assert script.main(["--storage-root", str(tmp_path / "projects")]) == 0
    out = capsys.readouterr().out
    assert "0 filling(s) to re-file" in out, out
