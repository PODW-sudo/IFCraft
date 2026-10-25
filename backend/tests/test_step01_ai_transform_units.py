"""
STEP-01 — AI copilot `transform_element` must respect project units and rotate about the
element's own origin.

Finding: F-001
Code under test:
  backend/app/services/ai_service.py:818-886  (AIService._exec_transform_element)
  backend/app/services/ifc_service.py:237-284  (IFCService.update_element_placement)
  backend/app/services/ifc_service.py:286-325  (IFCService.get_element_placement_matrix)

HOW TO RUN
    Copy this file into backend/tests/ then:
    .\\backend\\venv\\Scripts\\python.exe -m pytest backend/tests/test_step01_ai_transform_units.py -v

WHAT MUST HAPPEN
  1. A zero-delta transform must not move the element at all.
  2. A delta of 2 m must move the element exactly 2 m (2000 mm on a millimetre model).
  3. A rotation must not translate the element (rotate about the element origin, not the world
     origin).

TODAY ALL THREE FAIL. The zero-delta case moves the element by ~13.5 km on a millimetre model.
"""

import shutil
import sys
import uuid
from pathlib import Path

import pytest
import ifcopenshell
import ifcopenshell.util.placement as up

# --- repo root discovery (works from backend/tests/ or from docs/.../tests/backend/) ---------
def _repo_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "backend" / "app" / "main.py").exists():
            return parent
    raise RuntimeError("Could not locate repository root")


ROOT = _repo_root()
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.services.ai_service import AIService  # noqa: E402
from backend.app.services.project_service import ProjectService  # noqa: E402

# Real-world Revit export. Millimetre units (MILLI prefix) — the format every real customer file
# uses, and the one the bundled demo samples mostly do NOT use (that is why the bug survived).
MM_FIXTURE = ROOT / "modelsfortests" / "Ifc4_Revit_ARC.ifc"

# Tolerance for floating point comparisons, in project units (millimetres).
POS_TOL = 1.0
# Tolerance for orientation vectors.
DIR_TOL = 1e-3


@pytest.fixture(scope="module")
def mm_project(tmp_path_factory):
    """Copy the millimetre-unit fixture into a temp project dir and register a DB row for it."""
    if not MM_FIXTURE.exists():
        pytest.skip(f"fixture missing: {MM_FIXTURE}")

    work_dir = tmp_path_factory.mktemp("step01")
    work_file = work_dir / "model.ifc"
    shutil.copy(MM_FIXTURE, work_file)

    # The service writes an audit row keyed by project_id, so the id must exist in the DB.
    # STEP-03: `get_project_file_path` now rejects a non-UUID project id (path-traversal
    # guard), and `record_edit` -> `refresh_project_metrics` resolves the path from the id,
    # so this harness registers a real UUID. The model under test still lives in `work_file`
    # and is passed explicitly; no assertion changes.
    project_id = str(uuid.uuid4())
    _insert_project_row(project_id, "AutoTest-Step01-TransformUnits", work_file)

    yield project_id, work_file

    _delete_project_row(project_id)


def _db():
    import sqlite3
    from backend.app.core.config import settings
    conn = sqlite3.connect(str(settings.DATABASE_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def _insert_project_row(project_id: str, name: str, model_path: Path) -> None:
    from backend.app.core.config import settings
    conn = _db()
    try:
        now = "2026-10-24T00:00:00+00:00"
        conn.execute(
            """INSERT OR REPLACE INTO projects
               (id, name, description, schema_version, file_name, file_size, element_count, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (project_id, name, "STEP-01 TDD fixture", "IFC4", "model.ifc",
             model_path.stat().st_size, 0, now, now),
        )
        conn.commit()
    finally:
        conn.close()
    assert settings.DATABASE_PATH.exists()


def _delete_project_row(project_id: str) -> None:
    conn = _db()
    try:
        conn.execute("DELETE FROM edit_history WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.commit()
    finally:
        conn.close()


def _world_position(model_path: Path, express_id: int):
    """World-space translation of an element, in project units."""
    model = ifcopenshell.open(str(model_path))
    entity = model.by_id(express_id)
    assert entity is not None, f"entity #{express_id} not found"
    matrix = up.get_local_placement(entity.ObjectPlacement)
    return [float(v) for v in matrix[:3, 3]]


def _world_x_axis(model_path: Path, express_id: int):
    """World-space X axis direction of an element."""
    model = ifcopenshell.open(str(model_path))
    entity = model.by_id(express_id)
    matrix = up.get_local_placement(entity.ObjectPlacement)
    return [float(v) for v in matrix[:3, 0]]


def _first_wall(model_path: Path) -> int:
    model = ifcopenshell.open(str(model_path))
    walls = model.by_type("IfcWall")
    assert walls, "fixture contains no IfcWall"
    return walls[0].id()


@pytest.mark.asyncio
async def test_zero_delta_transform_does_not_move_the_element(mm_project):
    """A transform with no delta must be a no-op.

    Regression for the 1000x unit error: the AI path read the placement in project units
    (millimetres) and wrote it back through an SI-declaring writer, which re-scaled the
    translation by 1/unit_scale.
    """
    project_id, model_path = mm_project
    express_id = _first_wall(model_path)

    before = _world_position(model_path, express_id)

    result = await AIService._exec_transform_element(
        project_id, model_path,
        {"element_id": express_id, "dx": 0, "dy": 0, "dz": 0, "rx": 0, "ry": 0, "rz": 0},
    )

    assert result.get("success") is True, f"transform reported failure: {result}"

    after = _world_position(model_path, express_id)
    delta = [after[i] - before[i] for i in range(3)]

    assert abs(delta[0]) < POS_TOL and abs(delta[1]) < POS_TOL and abs(delta[2]) < POS_TOL, (
        "A zero-delta transform moved the element. "
        f"before={before} after={after} delta={delta} (project units are millimetres). "
        "The transform path is mixing project units with SI units."
    )


@pytest.mark.asyncio
async def test_translate_delta_is_expressed_in_metres(mm_project):
    """A delta of 2 m must translate the element by exactly 2 m.

    The AI contract is that dx/dy/dz are metres (see the tool schema in ai_service.py and the
    copilot prompt at ai_service.py:1382). The IFC file may be in millimetres.
    """
    project_id, model_path = mm_project
    express_id = _first_wall(model_path)

    before = _world_position(model_path, express_id)

    result = await AIService._exec_transform_element(
        project_id, model_path,
        {"element_id": express_id, "dx": 2.0, "dy": 0, "dz": 0},
    )
    assert result.get("success") is True, f"transform reported failure: {result}"

    after = _world_position(model_path, express_id)
    moved = after[0] - before[0]

    # 2 m == 2000 mm on this fixture.
    assert abs(moved - 2000.0) < POS_TOL, (
        f"Expected the element to move 2 m (2000 mm on a millimetre model); it moved {moved} mm. "
        f"before={before} after={after}"
    )


@pytest.mark.asyncio
async def test_rotation_preserves_position(mm_project):
    """Rotating an element must not move it.

    The current implementation composes M_new = T @ R @ M, which rotates about the WORLD origin.
    A column at x = 10 m spun 90 degrees about the world origin lands at (0, 10).
    """
    project_id, model_path = mm_project
    express_id = _first_wall(model_path)

    before_pos = _world_position(model_path, express_id)
    before_axis = _world_x_axis(model_path, express_id)

    result = await AIService._exec_transform_element(
        project_id, model_path,
        {"element_id": express_id, "rx": 0, "ry": 0, "rz": 90},
    )
    assert result.get("success") is True, f"transform reported failure: {result}"

    after_pos = _world_position(model_path, express_id)
    after_axis = _world_x_axis(model_path, express_id)

    moved = [after_pos[i] - before_pos[i] for i in range(3)]
    assert abs(moved[0]) < POS_TOL and abs(moved[1]) < POS_TOL and abs(moved[2]) < POS_TOL, (
        "A pure rotation moved the element. The rotation must be applied about the element's own "
        f"origin, not the world origin. before={before_pos} after={after_pos}"
    )

    # The orientation must actually have changed.
    assert abs(before_axis[0] - after_axis[0]) > DIR_TOL or abs(before_axis[1] - after_axis[1]) > DIR_TOL, (
        f"Orientation did not change: before={before_axis} after={after_axis}"
    )


@pytest.mark.asyncio
async def test_transform_is_recorded_as_an_audit_entry(mm_project):
    """AI transforms must leave an audit trail entry for the project."""
    project_id, model_path = mm_project
    express_id = _first_wall(model_path)

    await AIService._exec_transform_element(
        project_id, model_path,
        {"element_id": express_id, "dx": 1.0, "dy": 0, "dz": 0},
    )

    conn = _db()
    try:
        rows = conn.execute(
            "SELECT action_type, express_id FROM edit_history WHERE project_id = ? ORDER BY timestamp DESC",
            (project_id,),
        ).fetchall()
    finally:
        conn.close()

    assert len(rows) >= 1, "no audit entry was written for the AI transform"
    assert rows[0]["action_type"] == "transform_element", (
        f"unexpected audit action_type: {rows[0]['action_type']}"
    )
    assert rows[0]["express_id"] == express_id
