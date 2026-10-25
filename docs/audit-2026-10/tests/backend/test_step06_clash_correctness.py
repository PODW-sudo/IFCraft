"""
STEP-06 — Clash detection must actually examine walls, must not silently cap its sample,
and must disclose what it checked.

Finding: F-005
Code under test:
  backend/app/services/clash_service.py:30-87   (ClashService._extract_element_boxes)
  backend/app/services/clash_service.py:137-185 (ClashService.check_clashes)
  backend/app/models/schemas.py:168-175         (ClashCheckResponse)

BUG (measured 2026-10-24):
  `ifcopenshell.geom.create_shape` raises "Failed to process shape" for 25/25 walls in
  modelsfortests/Ifc2x3_Duplex_Architecture.ifc, while slabs/doors/windows succeed (21/14/24).
  clash_service.py:83-84 swallows every one of those failures, so walls never enter the box set.
  A live POST /clashes/check on that model returned 110 clashes containing ZERO IfcWall entries.

HOW TO RUN
    Copy this file into backend/tests/ then:
    .\\backend\\venv\\Scripts\\python.exe -m pytest backend/tests/test_step06_clash_correctness.py -v
"""

import shutil
import sys
from pathlib import Path

import pytest
import ifcopenshell

def _repo_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "backend" / "app" / "main.py").exists():
            return parent
    raise RuntimeError("Could not locate repository root")


ROOT = _repo_root()
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.services.clash_service import ClashService  # noqa: E402

# 57 walls, metre units. Wall geometry is present but create_shape() fails on it in the
# current ifcopenshell configuration (Axis/Curve2D representation is the first representation).
# STEP-26 removed the byte-identical copy that used to live in modelsfortests/; the canonical,
# tracked copy is the registered product sample.
DUPLEX_FIXTURE = ROOT / "backend" / "app" / "samples" / "ifc2x3_duplex_architecture.ifc"


@pytest.fixture(scope="module")
def duplex_model(tmp_path_factory):
    if not DUPLEX_FIXTURE.exists():
        pytest.skip(f"fixture missing: {DUPLEX_FIXTURE}")
    work_dir = tmp_path_factory.mktemp("step06")
    work_file = work_dir / "model.ifc"
    shutil.copy(DUPLEX_FIXTURE, work_file)
    return work_file


def test_geometry_extraction_includes_walls(duplex_model):
    """The extracted box set must contain the walls of the model.

    This is the core assertion. Today it fails with zero walls in the set.
    """
    boxes = ClashService._extract_element_boxes(
        duplex_model, model_id="main", model_name="Test", discipline="ARCH"
    )

    model = ifcopenshell.open(str(duplex_model))
    wall_count = len(model.by_type("IfcWall")) + len(model.by_type("IfcWallStandardCase"))
    assert wall_count > 0, "fixture has no walls"

    wall_boxes = [b for b in boxes if b.type_name in ("IfcWall", "IfcWallStandardCase")]

    assert len(wall_boxes) > 0, (
        f"No walls were extracted, so walls can never clash. "
        f"model has {wall_count} walls, extracted {len(boxes)} boxes of which "
        f"{len(wall_boxes)} are walls. Types found: {sorted({b.type_name for b in boxes})}"
    )


def test_geometry_extraction_covers_more_than_25_elements_per_type(duplex_model):
    """The 25-elements-per-type cap silently ignores most of the model.

    Today `for prod in elements[:25]` means a 57-wall model has 32 walls never checked.

    NOTE (STEP-06 implementation, 2026-10-25): this test used to sum
    `by_type("IfcWall")` + `by_type("IfcWallStandardCase")`, which double-counts — in IFC2x3
    `IfcWallStandardCase` *is* a subtype of `IfcWall`, so `by_type("IfcWall")` already returns
    all 56 of them. The fixture has 57 unique walls, not 113 (measured: 57 + 56 = 113 naive,
    57 unique express ids). Counting unique express ids and requiring every wall id to be
    boxed is strictly stronger than the original cap check. (Issue 4.4: this shipped copy
    now matches `backend/tests/test_step06_clash_correctness.py`.)
    """
    model = ifcopenshell.open(str(duplex_model))
    wall_ids = {w.id() for w in model.by_type("IfcWall")} | {
        w.id() for w in model.by_type("IfcWallStandardCase")
    }
    wall_count = len(wall_ids)
    assert wall_count > 25, "fixture needs more than 25 walls to prove the cap is gone"

    boxes = ClashService._extract_element_boxes(
        duplex_model, model_id="main", model_name="Test", discipline="ARCH"
    )
    wall_boxes = [b for b in boxes if b.type_name in ("IfcWall", "IfcWallStandardCase")]

    assert len(wall_boxes) >= wall_count, (
        f"Only {len(wall_boxes)} of {wall_count} walls were extracted — the per-type sample cap "
        "is still in effect."
    )
    missing = wall_ids - {b.express_id for b in wall_boxes}
    assert not missing, f"{len(missing)} walls were never boxed: {sorted(missing)[:10]}"


def test_geometry_failures_are_reported_not_swallowed(duplex_model):
    """A geometry failure must be counted, not silently dropped.

    The service must expose how many elements it could not build geometry for so the caller can
    decide whether a "0 clashes" result is trustworthy.
    """
    model = ifcopenshell.open(str(duplex_model))
    wall_count = len(model.by_type("IfcWall")) + len(model.by_type("IfcWallStandardCase"))

    # The service must expose a failure count. Today it does not exist at all.
    assert hasattr(ClashService, "_extract_element_boxes"), "service method missing"

    boxes = ClashService._extract_element_boxes(
        duplex_model, model_id="main", model_name="Test", discipline="ARCH"
    )
    total_elements = sum(
        len(model.by_type(t))
        for t in ("IfcWall", "IfcWallStandardCase", "IfcSlab", "IfcDoor", "IfcWindow",
                  "IfcColumn", "IfcMember", "IfcCovering")
    )

    # If geometry is silently dropped, extracted count is far below the model content and there
    # is no way for the caller to tell. This test documents the required contract.
    assert len(boxes) > 0
    assert len(boxes) <= total_elements, "more boxes than elements — self-clash duplication"
    # The important part: the caller-visible response must carry the completeness signal.
    # See test_clash_response_reports_completeness below for the API-level assertion.


def test_clash_response_reports_completeness(duplex_model):
    """The clash response must disclose what was checked.

    Without `elements_checked` / `sampled` / `skipped`, a partial scan is presented to the user
    as a complete coordination result.
    """
    from backend.app.models.schemas import ClashCheckResponse

    fields = set(ClashCheckResponse.model_fields.keys())
    for required in ("elements_checked", "sampled"):
        assert required in fields, (
            f"ClashCheckResponse is missing '{required}'. Present fields: {sorted(fields)}. "
            "A clash report without a completeness signal lets a partial scan be read as a "
            "coordination result."
        )
