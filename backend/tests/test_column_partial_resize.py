"""1.1 (P1): a partial IfcColumn resize must change exactly the requested dimension.

`update_geometry` used to rebuild the column box with ``req.width or 0.35`` /
``req.depth or 0.35`` / ``req.height or 3.0``, so ``{"height": 4.0}`` on a
0.4 x 0.4 x 3.0 column produced 0.35 x 0.35 x 4.0. The branch now reads the
current extents from the Body representation and reuses them for omitted fields;
when the body cannot be measured it must answer 409 instead of guessing.
"""
import hashlib
import sys
from pathlib import Path

import numpy as np
import pytest
from starlette.testclient import TestClient

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.app.main import app
import ifcopenshell

PROJECTS_DIR = Path(root_dir) / "storage" / "projects"


def _model_path(project_id: str) -> Path:
    return PROJECTS_DIR / project_id / "model.ifc"


def _digest(project_id: str) -> str:
    return hashlib.sha256(_model_path(project_id).read_bytes()).hexdigest()


def _extents_m(project_id: str, express_id: int) -> tuple[np.ndarray, np.ndarray]:
    """World-coordinate bbox of the tessellated element, in SI metres."""
    model = ifcopenshell.open(str(_model_path(project_id)))
    settings = ifcopenshell.geom.settings()
    settings.set("use-world-coords", True)
    shape = ifcopenshell.geom.create_shape(settings, model.by_id(express_id))
    verts = np.array(shape.geometry.verts, dtype=float).reshape(-1, 3)
    return verts.min(axis=0), verts.max(axis=0)


def _spans_m(project_id: str, express_id: int) -> tuple[float, float, float]:
    lo, hi = _extents_m(project_id, express_id)
    span = hi - lo
    return float(span[0]), float(span[1]), float(span[2])


@pytest.fixture()
def project():
    with TestClient(app) as client:
        created = client.post(
            "/api/projects", json={"name": "AutoTest-column-partial", "schema_version": "IFC4"}
        )
        assert created.status_code == 201, created.text
        project_id = created.json()["id"]
        try:
            yield client, project_id
        finally:
            client.delete(f"/api/projects/{project_id}")


def _create_column(client, project_id: str, width=0.4, depth=0.4, height=3.0) -> int:
    res = client.post(
        f"/api/projects/{project_id}/cad/column",
        json={
            "position": [2.0, 2.0],
            "elevation": 0.0,
            "height": height,
            "width": width,
            "depth": depth,
            "name": "AutoTest-partial-column",
        },
    )
    assert res.status_code == 200, res.text
    return res.json()["express_id"]


def test_height_only_resize_keeps_width_and_depth(project):
    """{"height": 4.0} on a 0.4x0.4x3.0 column must keep the 0.4x0.4 profile."""
    client, project_id = project
    column_id = _create_column(client, project_id)

    before = _spans_m(project_id, column_id)
    assert before == pytest.approx((0.4, 0.4, 3.0), abs=1e-6), before

    res = client.patch(
        f"/api/projects/{project_id}/cad/elements/{column_id}/geometry",
        json={"height": 4.0},
    )
    assert res.status_code == 200, res.text

    after = _spans_m(project_id, column_id)
    assert after == pytest.approx((0.4, 0.4, 4.0), abs=1e-6), (
        f"height-only resize changed untouched dimensions: {before} -> {after}"
    )


def test_width_only_resize_keeps_depth_and_height(project):
    """{"width": 0.5} must change X only; depth 0.4 and height 3.0 survive."""
    client, project_id = project
    column_id = _create_column(client, project_id)
    before = _spans_m(project_id, column_id)
    assert before == pytest.approx((0.4, 0.4, 3.0), abs=1e-6), before

    res = client.patch(
        f"/api/projects/{project_id}/cad/elements/{column_id}/geometry",
        json={"width": 0.5},
    )
    assert res.status_code == 200, res.text

    after = _spans_m(project_id, column_id)
    assert after == pytest.approx((0.5, 0.4, 3.0), abs=1e-6), (
        f"width-only resize changed untouched dimensions: {before} -> {after}"
    )


def test_depth_only_resize_keeps_width_and_height(project):
    """{"depth": 0.6} must change Y only (the mirror case of the width test)."""
    client, project_id = project
    column_id = _create_column(client, project_id)

    res = client.patch(
        f"/api/projects/{project_id}/cad/elements/{column_id}/geometry",
        json={"depth": 0.6},
    )
    assert res.status_code == 200, res.text

    assert _spans_m(project_id, column_id) == pytest.approx((0.4, 0.6, 3.0), abs=1e-6)


def test_partial_resize_after_full_resize_uses_the_new_extents(project):
    """A second partial edit must read what the first one actually wrote."""
    client, project_id = project
    column_id = _create_column(client, project_id)

    first = client.patch(
        f"/api/projects/{project_id}/cad/elements/{column_id}/geometry",
        json={"width": 0.6, "depth": 0.5, "height": 2.5},
    )
    assert first.status_code == 200, first.text
    assert _spans_m(project_id, column_id) == pytest.approx((0.6, 0.5, 2.5), abs=1e-6)

    second = client.patch(
        f"/api/projects/{project_id}/cad/elements/{column_id}/geometry",
        json={"height": 5.0},
    )
    assert second.status_code == 200, second.text
    assert _spans_m(project_id, column_id) == pytest.approx((0.6, 0.5, 5.0), abs=1e-6)


def test_unmeasurable_column_refuses_instead_of_guessing(project):
    """No Body representation => 409 unsupported_geometry, and no silent 0.35 rebuild."""
    client, project_id = project
    column_id = _create_column(client, project_id)

    # Simulate an imported/degenerate column whose body cannot be measured.
    model = ifcopenshell.open(str(_model_path(project_id)))
    column = model.by_id(column_id)
    column.Representation = None
    model.write(str(_model_path(project_id)))

    before = _digest(project_id)
    res = client.patch(
        f"/api/projects/{project_id}/cad/elements/{column_id}/geometry",
        json={"height": 4.0},
    )

    assert res.status_code == 409, res.text
    body = res.json()["detail"]
    assert body["code"] == "unsupported_geometry", body
    assert "measure" in body["message"].lower(), body
    assert _digest(project_id) == before, "a refused resize still modified the model"

    # Sending every dimension is the documented escape hatch and must still work.
    full = client.patch(
        f"/api/projects/{project_id}/cad/elements/{column_id}/geometry",
        json={"width": 0.3, "depth": 0.3, "height": 2.0},
    )
    assert full.status_code == 200, full.text
    assert _spans_m(project_id, column_id) == pytest.approx((0.3, 0.3, 2.0), abs=1e-6)
