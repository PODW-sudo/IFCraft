import io
import json
import sys
import zipfile
from pathlib import Path
import pytest
from starlette.testclient import TestClient

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.app.main import app
import ifcopenshell


def test_cad_parametric_modeling_and_transactions():
    """Verify parametric CAD modeling (Wall, Slab, Column, Opening) and Undo/Redo."""
    with TestClient(app) as client:
        # 1. Load sample project
        load_res = client.post("/api/projects/samples/office_pavilion/load")
        assert load_res.status_code == 201, f"Failed to load sample: {load_res.text}"
        project = load_res.json()
        project_id = project["id"]

        try:
            # 2. Parametric Wall creation
            wall_req = {
                "start": [0.0, 0.0],
                "end": [6.0, 0.0],
                "elevation": 0.0,
                "height": 3.2,
                "thickness": 0.25,
                "name": "Integration Test Wall"
            }
            wall_res = client.post(f"/api/projects/{project_id}/cad/wall", json=wall_req)
            assert wall_res.status_code == 200, f"Wall creation failed: {wall_res.text}"
            wall_data = wall_res.json()
            assert wall_data["success"] is True
            assert wall_data["entity_type"] == "IfcWall"
            wall_id = wall_data["express_id"]
            assert wall_id > 0

            # 3. Parametric Column creation
            col_req = {
                "position": [3.0, 3.0],
                "elevation": 0.0,
                "height": 3.2,
                "width": 0.4,
                "depth": 0.4,
                "name": "Integration Test Column"
            }
            col_res = client.post(f"/api/projects/{project_id}/cad/column", json=col_req)
            assert col_res.status_code == 200, f"Column creation failed: {col_res.text}"
            col_data = col_res.json()
            assert col_data["success"] is True
            assert col_data["entity_type"] == "IfcColumn"

            # 4. Parametric Slab creation
            slab_req = {
                "boundary": [[0.0, 0.0], [6.0, 0.0], [6.0, 6.0], [0.0, 6.0]],
                "elevation": 3.2,
                "thickness": 0.2,
                "name": "Integration Test Slab"
            }
            slab_res = client.post(f"/api/projects/{project_id}/cad/slab", json=slab_req)
            assert slab_res.status_code == 200, f"Slab creation failed: {slab_res.text}"
            slab_data = slab_res.json()
            assert slab_data["success"] is True
            assert slab_data["entity_type"] == "IfcSlab"

            # 5. Opening creation (Door) inside the wall
            opening_req = {
                "host_wall_id": wall_id,
                "opening_type": "door",
                "offset_along_wall": 2.0,
                "sill_height": 0.0,
                "width": 1.0,
                "height": 2.2,
                "name": "Integration Test Door"
            }
            open_res = client.post(f"/api/projects/{project_id}/cad/opening", json=opening_req)
            assert open_res.status_code == 200, f"Opening creation failed: {open_res.text}"
            open_data = open_res.json()
            assert open_data["success"] is True
            assert open_data["opening_express_id"] is not None

            # 6. Verify CAD history and undo/redo
            history_res = client.get(f"/api/projects/{project_id}/cad/history")
            assert history_res.status_code == 200
            history_data = history_res.json()
            assert len(history_data["history"]) >= 4
            assert history_data["can_undo"] is True

            undo_res = client.post(f"/api/projects/{project_id}/cad/undo")
            assert undo_res.status_code == 200
            undo_data = undo_res.json()
            assert undo_data["success"] is True
            assert undo_data["can_redo"] is True

            redo_res = client.post(f"/api/projects/{project_id}/cad/redo")
            assert redo_res.status_code == 200
            redo_data = redo_res.json()
            assert redo_data["success"] is True

        finally:
            # Cleanup project
            client.delete(f"/api/projects/{project_id}")


def test_clash_detection_and_bcf_workflow():
    """Verify Clash Detection, BCF Topic creation, clash conversion, and .bcfzip export."""
    with TestClient(app) as client:
        # 1. Load duplex sample
        load_res = client.post("/api/projects/samples/duplex_residential/load")
        assert load_res.status_code == 201
        project = load_res.json()
        project_id = project["id"]

        try:
            # 2. Execute Clash Detection
            clash_req = {
                "tolerance": 0.05,
                "model_ids": None
            }
            clash_res = client.post(f"/api/projects/{project_id}/clashes/check", json=clash_req)
            assert clash_res.status_code == 200, f"Clash detection failed: {clash_res.text}"
            clash_data = clash_res.json()
            assert "total_clashes" in clash_data
            assert "duration_ms" in clash_data
            assert isinstance(clash_data["clashes"], list)

            # 3. Create a manual BCF Topic
            bcf_req = {
                "title": "HVAC Duct Clashes with Load-bearing Column",
                "description": "Critical interference observed on Ground Floor grid intersection C-3.",
                "topic_type": "Clash",
                "topic_status": "Open",
                "priority": "High",
                "camera_position": [10.5, -4.2, 3.8],
                "camera_target": [5.0, 0.0, 1.5],
                "selected_elements": [101, 102]
            }
            topic_res = client.post(f"/api/projects/{project_id}/bcf/topics", json=bcf_req)
            assert topic_res.status_code == 200, f"BCF topic creation failed: {topic_res.text}"
            topic_data = topic_res.json()
            assert topic_data["title"] == bcf_req["title"]
            assert topic_data["priority"] == "High"
            topic_id = topic_data["id"]

            # 4. List BCF Topics
            list_res = client.get(f"/api/projects/{project_id}/bcf/topics")
            assert list_res.status_code == 200
            topics = list_res.json()
            assert any(t["id"] == topic_id for t in topics)

            # 5. Import Clashes into BCF Topics
            if clash_data["clashes"]:
                sample_clashes = clash_data["clashes"][:2]
            else:
                sample_clashes = [
                    {
                        "id": "clash-mock-1",
                        "element_a_id": 1,
                        "element_a_name": "Wall A",
                        "element_a_type": "IfcWall",
                        "model_a_id": "model-1",
                        "model_a_name": "Arch",
                        "discipline_a": "ARCH",
                        "element_b_id": 2,
                        "element_b_name": "Beam B",
                        "element_b_type": "IfcBeam",
                        "model_b_id": "model-1",
                        "model_b_name": "Struct",
                        "discipline_b": "STRUCT",
                        "severity": "hard",
                        "distance": 0.04,
                        "intersection_center": [2.0, 3.0, 1.5],
                        "box_min": [1.9, 2.9, 1.4],
                        "box_max": [2.1, 3.1, 1.6]
                    }
                ]

            import_res = client.post(
                f"/api/projects/{project_id}/bcf/from-clashes",
                json={"clashes": sample_clashes}
            )
            assert import_res.status_code == 200
            import_data = import_res.json()
            assert import_data["success"] is True
            assert import_data["imported_topics_count"] >= 1

            # 6. Export BCF ZIP Archive (.bcfzip)
            export_res = client.get(f"/api/projects/{project_id}/bcf/export")
            assert export_res.status_code == 200
            assert export_res.headers.get("content-type") == "application/zip"
            zip_bytes = export_res.content
            assert len(zip_bytes) > 200

            # Validate ZIP structure conforming to BCF 2.1 specification
            with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as z:
                namelist = z.namelist()
                assert "bcf.version" in namelist
                version_xml = z.read("bcf.version").decode("utf-8")
                assert 'VersionId="2.1"' in version_xml
                # Must contain folder for our created topic with markup.bcf and viewpoint.bcfv
                assert f"{topic_id}/markup.bcf" in namelist
                assert f"{topic_id}/viewpoint.bcfv" in namelist

            # 7. Check Audit Timeline and Diff
            timeline_res = client.get(f"/api/projects/{project_id}/audit/timeline")
            assert timeline_res.status_code == 200
            assert isinstance(timeline_res.json(), list)

            diff_res = client.get(f"/api/projects/{project_id}/audit/diff")
            assert diff_res.status_code == 200
            diff_data = diff_res.json()
            assert "total_elements" in diff_data
            assert "added" in diff_data
            assert "modified" in diff_data
            assert "deleted" in diff_data

        finally:
            client.delete(f"/api/projects/{project_id}")
