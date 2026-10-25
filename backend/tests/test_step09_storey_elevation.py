import sys
from pathlib import Path

import pytest
from starlette.testclient import TestClient

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.app.main import app

FIXTURE = Path(root_dir) / "modelsfortests" / "Ifc4_SampleHouse.ifc"


def _find_nodes(node: dict, type_name: str) -> list[dict]:
    found = [node] if node.get("type") == type_name else []
    for child in node.get("children", []):
        found.extend(_find_nodes(child, type_name))
    return found


def test_spatial_tree_exposes_storey_elevation_and_unit_scale():
    """A millimetre model must report elevations in project units and its unit scale.

    Contract: elevation is in PROJECT units (mm here); unit_scale is metres per project unit.
    """
    assert FIXTURE.exists(), f"fixture missing: {FIXTURE}"

    with TestClient(app) as client:
        with FIXTURE.open("rb") as fh:
            res = client.post(
                "/api/projects/upload",
                files={"file": (FIXTURE.name, fh, "application/octet-stream")},
                data={"name": "AutoTest-Step09-StoreyElevation"},
            )
        assert res.status_code == 201, res.text
        project_id = res.json()["id"]

        try:
            tree_res = client.get(f"/api/projects/{project_id}/spatial-tree")
            assert tree_res.status_code == 200, tree_res.text
            tree = tree_res.json()

            # 1. Unit scale on the root (metres per project unit).  Ifc4_SampleHouse is MILLI.
            assert tree.get("unit_scale") == pytest.approx(0.001), (
                f"root unit_scale missing or wrong: {tree.get('unit_scale')!r}"
            )

            # 2. Storey elevations are real values in project units, not 0.0 placeholders.
            storeys = _find_nodes(tree, "IfcBuildingStorey")
            assert len(storeys) >= 2, f"expected at least 2 storeys, found {len(storeys)}"
            elevations = {s["name"]: s.get("elevation") for s in storeys}
            assert elevations.get("Roof") == pytest.approx(2500.0)
            assert elevations.get("Ground Floor") == pytest.approx(0.0)

            # 3. Every storey carries the field (never null) so consumers have one shape.
            for s in storeys:
                assert s.get("elevation") is not None, f"storey {s['name']} has no elevation"

            # 4. Non-storey nodes do not carry a unit scale - no leakage into elements.
            #    (FastAPI serialises the optional field as null, so assert on the value.)
            walls = _find_nodes(tree, "IfcWall")
            assert walls, "fixture should contain walls"
            assert all(w.get("unit_scale") is None for w in walls)
        finally:
            assert client.delete(f"/api/projects/{project_id}").status_code == 204
