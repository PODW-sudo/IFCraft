import io
import sys
from pathlib import Path

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

import json
from starlette.testclient import TestClient
from backend.app.main import app
import ifcopenshell

def test_phase7_e2e_samples_and_export():
    with TestClient(app) as client:
        # 1. Verify samples list
        samples_res = client.get("/api/projects/samples/list")
        assert samples_res.status_code == 200
        samples = samples_res.json()
        assert len(samples) >= 2
        sample_ids = [s["id"] for s in samples]
        assert "duplex_residential" in sample_ids
        assert "office_pavilion" in sample_ids
        print("\n[PASS] Verified bundled architectural samples catalog.")

        # 2. Load Duplex sample model
        load_res = client.post("/api/projects/samples/duplex_residential/load")
        assert load_res.status_code == 201, f"Failed to load sample: {load_res.text}"
        proj1 = load_res.json()
        p1_id = proj1["id"]
        assert proj1["schema_version"] == "IFC4"
        assert proj1["element_count"] >= 20
        print(f"[PASS] Loaded sample 'duplex_residential' -> Project ID: {p1_id} with {proj1['element_count']} elements.")

        # 3. Check spatial tree
        tree_res = client.get(f"/api/projects/{p1_id}/spatial-tree")
        assert tree_res.status_code == 200
        tree = tree_res.json()
        assert tree["type"] == "IfcProject"
        print("[PASS] Spatial tree structure verified.")

        # Pick first wall element in the model to modify
        file_path = Path(root_dir) / "storage" / "projects" / p1_id / "model.ifc"
        model = ifcopenshell.open(str(file_path))
        walls = model.by_type("IfcWall")
        assert len(walls) > 0
        target_wall = walls[0]
        target_id = target_wall.id()
        print(f"[PASS] Selected target element for modification: #{target_id} ({target_wall.Name})")

        # 4. Modify 3D Spatial Placement
        # Unique target matrix with translation (7.5, 2.5, 1.2)
        mod_matrix = [
            1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            7.5, 2.5, 1.2, 1.0
        ]
        plc_res = client.post(
            f"/api/projects/{p1_id}/elements/{target_id}/placement",
            json={"matrix": mod_matrix}
        )
        assert plc_res.status_code == 200
        print(f"[PASS] Updated placement matrix for #{target_id} to (7.5, 2.5, 1.2).")

        # 5. Modify Property Set Properties
        prop1_res = client.post(
            f"/api/projects/{p1_id}/elements/{target_id}/properties",
            json={
                "pset_name": "Pset_WallCommon",
                "property_name": "FireRating",
                "value": "FR-120",
                "value_type": "IfcLabel"
            }
        )
        assert prop1_res.status_code == 200

        prop2_res = client.post(
            f"/api/projects/{p1_id}/elements/{target_id}/properties",
            json={
                "pset_name": "Pset_WallCommon",
                "property_name": "LoadBearing",
                "value": True,
                "value_type": "IfcBoolean"
            }
        )
        assert prop2_res.status_code == 200
        print(f"[PASS] Updated properties FireRating='FR-120' and LoadBearing=True on #{target_id}.")

        # 6. Export/Download the modified IFC model
        dl_res = client.get(f"/api/projects/{p1_id}/download")
        assert dl_res.status_code == 200
        exported_bytes = dl_res.content
        assert len(exported_bytes) > 1000
        assert b"ISO-10303-21;" in exported_bytes
        print(f"[PASS] Exported IFC file ({len(exported_bytes)} bytes) verified valid STEP format.")

        # 7. Reload / Re-import the exported IFC file as a new project
        upload_res = client.post(
            "/api/projects/upload",
            files={"file": ("reloaded_export.ifc", io.BytesIO(exported_bytes), "application/octet-stream")},
            data={"name": "Reloaded Exported Project", "description": "Verification of persistence"}
        )
        assert upload_res.status_code == 201, f"Upload failed: {upload_res.text}"
        reloaded_proj = upload_res.json()
        reloaded_id = reloaded_proj["id"]
        print(f"[PASS] Re-imported exported IFC file into new project {reloaded_id}.")

        # 8. Verify data persistence in the reloaded project
        reloaded_file = Path(root_dir) / "storage" / "projects" / reloaded_id / "model.ifc"
        model_reloaded = ifcopenshell.open(str(reloaded_file))
        wall_reloaded = model_reloaded.by_id(target_id)
        assert wall_reloaded is not None, f"Element #{target_id} not found in reloaded IFC!"

        # Verify placement coordinates in reloaded IFC
        loc = wall_reloaded.ObjectPlacement.RelativePlacement.Location.Coordinates
        assert abs(float(loc[0]) - 7.5) < 1e-4, f"Expected X=7.5, got {loc[0]}"
        assert abs(float(loc[1]) - 2.5) < 1e-4, f"Expected Y=2.5, got {loc[1]}"
        assert abs(float(loc[2]) - 1.2) < 1e-4, f"Expected Z=1.2, got {loc[2]}"
        print(f"[PASS] Verified exact 3D coordinates persisted: ({loc[0]}, {loc[1]}, {loc[2]}).")

        # Verify property values in reloaded IFC via REST endpoint
        details_res = client.get(f"/api/projects/{reloaded_id}/elements/{target_id}")
        assert details_res.status_code == 200
        details = details_res.json()
        
        pset_wall = next((p for p in details["psets"] if p["name"] == "Pset_WallCommon"), None)
        assert pset_wall is not None, "Pset_WallCommon missing in reloaded element!"
        
        props_dict = {p["name"]: p["value"] for p in pset_wall["properties"]}
        assert props_dict.get("FireRating") == "FR-120", f"Expected FireRating 'FR-120', got {props_dict.get('FireRating')}"
        assert props_dict.get("LoadBearing") is True, f"Expected LoadBearing True, got {props_dict.get('LoadBearing')}"
        print("[PASS] Verified exact property values persisted across export and re-import.")

        # 9. Test Office Pavilion sample load
        pav_res = client.post("/api/projects/samples/office_pavilion/load")
        assert pav_res.status_code == 201
        pav_id = pav_res.json()["id"]
        assert pav_res.json()["element_count"] >= 10
        print(f"[PASS] Loaded sample 'office_pavilion' -> Project ID: {pav_id}.")

        # 10. Clean up all test projects
        for pid in [p1_id, reloaded_id, pav_id]:
            client.delete(f"/api/projects/{pid}")
        print("[PASS] All test projects cleaned up successfully.")

def test_external_sample_models_from_modelsfortests():
    with TestClient(app) as client:
        # 1. Test loading IFC2X3 Duplex Architecture
        res_duplex = client.post("/api/projects/samples/ifc2x3_duplex_architecture/load")
        assert res_duplex.status_code == 201
        duplex_data = res_duplex.json()
        assert duplex_data["schema_version"] == "IFC2X3"
        assert duplex_data["element_count"] == 295
        duplex_id = duplex_data["id"]

        # Verify spatial tree
        tree_res = client.get(f"/api/projects/{duplex_id}/spatial-tree")
        assert tree_res.status_code == 200
        tree = tree_res.json()
        assert tree["type"] == "IfcProject"
        assert len(tree["children"]) > 0

        # 2. Test loading Building Architecture (IFC4X3)
        res_bld = client.post("/api/projects/samples/building_architecture/load")
        assert res_bld.status_code == 201
        bld_data = res_bld.json()
        assert bld_data["schema_version"] == "IFC4X3"
        assert bld_data["element_count"] == 20
        bld_id = bld_data["id"]

        # Verify spatial tree
        tree_bld_res = client.get(f"/api/projects/{bld_id}/spatial-tree")
        assert tree_bld_res.status_code == 200
        tree_bld = tree_bld_res.json()
        assert tree_bld["type"] == "IfcProject"

        # Clean up
        client.delete(f"/api/projects/{duplex_id}")
        client.delete(f"/api/projects/{bld_id}")
        print("\n[PASS] Verified modelsfortests sample models (IFC2X3 & IFC4X3).")

if __name__ == "__main__":
    test_phase7_e2e_samples_and_export()
    test_external_sample_models_from_modelsfortests()
