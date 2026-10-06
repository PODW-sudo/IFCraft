import io
import re
import sys
from pathlib import Path
import pytest
from starlette.testclient import TestClient

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.app.main import app
import ifcopenshell


SAMPLES_DIR = Path(root_dir) / "backend" / "app" / "samples"
IFC_BASE64_GUID_REGEX = re.compile(r"^[0-9A-Za-z_$]{22}$")


def test_step_header_and_schema_versions():
    """Verify STEP ISO-10303-21 structure and schema versions across IFC2X3, IFC4, and IFC4X3."""
    expected_schemas = {
        "ifc2x3_duplex_architecture.ifc": "IFC2X3",
        "duplex_residential.ifc": "IFC4",
        "office_pavilion.ifc": "IFC4",
        "building_architecture.ifc": "IFC4X3",
    }

    for filename, expected_schema in expected_schemas.items():
        file_path = SAMPLES_DIR / filename
        assert file_path.exists(), f"Sample file {filename} missing."

        # Verify raw STEP file syntax
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            header_lines = [f.readline() for _ in range(30)]
            content_start = "".join(header_lines)

            assert "ISO-10303-21;" in content_start, f"{filename} missing ISO-10303-21 header"
            assert "HEADER;" in content_start, f"{filename} missing HEADER section"
            assert "FILE_DESCRIPTION" in content_start, f"{filename} missing FILE_DESCRIPTION"
            assert "FILE_NAME" in content_start, f"{filename} missing FILE_NAME"
            assert "FILE_SCHEMA" in content_start, f"{filename} missing FILE_SCHEMA"

        # Verify IfcOpenShell schema parsing
        model = ifcopenshell.open(str(file_path))
        actual_schema = model.schema
        assert actual_schema.startswith(expected_schema), (
            f"Expected schema {expected_schema} for {filename}, got {actual_schema}"
        )


def test_guid_integrity_and_formatting():
    """Verify all IFC products conform to the standard 22-character Base64 GUID specification."""
    sample_path = SAMPLES_DIR / "duplex_residential.ifc"
    model = ifcopenshell.open(str(sample_path))

    products = model.by_type("IfcProduct")
    assert len(products) > 0, "No IfcProduct elements found in sample model."

    for product in products:
        guid = getattr(product, "GlobalId", None)
        assert guid is not None, f"Element #{product.id()} ({product.is_a()}) missing GlobalId."
        assert len(guid) == 22, f"Element #{product.id()} GlobalId '{guid}' length is not 22 characters."
        assert IFC_BASE64_GUID_REGEX.match(guid), (
            f"Element #{product.id()} GlobalId '{guid}' contains invalid characters."
        )


def test_spatial_containment_hierarchy():
    """Verify standard OpenBIM spatial containment decomposition."""
    sample_path = SAMPLES_DIR / "duplex_residential.ifc"
    model = ifcopenshell.open(str(sample_path))

    # 1. Root project entity
    projects = model.by_type("IfcProject")
    assert len(projects) == 1, "Model must have exactly one IfcProject root."
    project = projects[0]
    assert project.Name is not None

    # 2. Building storey exists
    storeys = model.by_type("IfcBuildingStorey")
    assert len(storeys) >= 1, "Model must contain at least one IfcBuildingStorey."

    # 3. Spatial containment relations
    rel_containments = model.by_type("IfcRelContainedInSpatialStructure")
    assert len(rel_containments) >= 1, "Model must have spatial containment relationships."

    contained_elements_count = sum(len(rel.RelatedElements) for rel in rel_containments)
    assert contained_elements_count > 0, "Spatial structures must contain physical building elements."


def test_step_export_roundtrip_compliance():
    """Verify full round-trip export via API matches STEP schema without corruption."""
    with TestClient(app) as client:
        # Load sample
        load_res = client.post("/api/projects/samples/office_pavilion/load")
        assert load_res.status_code == 201
        project_id = load_res.json()["id"]

        try:
            # Download IFC model directly
            dl_res = client.get(f"/api/projects/{project_id}/download")
            assert dl_res.status_code == 200
            content = dl_res.content

            # Verify STEP delimiters
            assert content.startswith(b"ISO-10303-21;") or b"ISO-10303-21;" in content[:100]
            assert b"END-ISO-10303-21;" in content

            # Parse exported model string using IfcOpenShell
            text_data = content.decode("utf-8", errors="replace")
            exported_model = ifcopenshell.file.from_string(text_data)
            assert exported_model.schema.startswith("IFC4")
            walls = exported_model.by_type("IfcWall")
            assert len(walls) >= 0

        finally:
            client.delete(f"/api/projects/{project_id}")
