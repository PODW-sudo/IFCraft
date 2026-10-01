import sys
from pathlib import Path

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

import asyncio
import pytest
import ifcopenshell
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.core.database import init_db
from backend.app.services.project_service import ProjectService

@pytest.mark.asyncio
async def test_phase3_transforms_and_properties():
    await init_db()
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create a project
        create_res = await client.post("/api/projects", json={
            "name": "Phase 3 Test Model",
            "schema_version": "IFC4"
        })
        assert create_res.status_code == 201
        project = create_res.json()
        project_id = project["id"]
        
        # 2. Get spatial tree to find an element expressID
        tree_res = await client.get(f"/api/projects/{project_id}/spatial-tree")
        assert tree_res.status_code == 200
        tree = tree_res.json()
        # Find Storey node
        site = tree["children"][0]
        building = site["children"][0]
        storey = building["children"][0]
        target_id = storey["express_id"]
        print(f"\n[PASS] Found target entity: #{target_id} ({storey['name']})")

        # 3. Test 3D Transform Placement Update
        # Column-major 4x4 matrix with translation at (10.0, 5.0, 2.5)
        # Col 0: [1, 0, 0, 0]
        # Col 1: [0, 1, 0, 0]
        # Col 2: [0, 0, 1, 0]
        # Col 3: [10.0, 5.0, 2.5, 1]
        matrix = [
            1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            10.0, 5.0, 2.5, 1.0
        ]
        
        transform_res = await client.post(
            f"/api/projects/{project_id}/elements/{target_id}/placement",
            json={"matrix": matrix}
        )
        assert transform_res.status_code == 200
        assert transform_res.json()["updated"] is True
        print(f"[PASS] Successfully called placement update for entity #{target_id}.")

        # Verify on-disk IFC file has updated coordinates
        ifc_path = ProjectService.get_project_file_path(project_id)
        model = ifcopenshell.open(str(ifc_path))
        entity = model.by_id(target_id)
        assert entity.ObjectPlacement is not None
        rel_placement = entity.ObjectPlacement.RelativePlacement
        coords = rel_placement.Location.Coordinates
        assert abs(coords[0] - 10.0) < 1e-4
        assert abs(coords[1] - 5.0) < 1e-4
        assert abs(coords[2] - 2.5) < 1e-4
        print(f"[PASS] IfcOpenShell verified exact 3D coordinates on disk: {coords}")

        # 4. Test Property Addition and Inline Editing
        prop_payload = {
            "pset_name": "Pset_BuildingStoreyCommon",
            "property_name": "GrossFloorArea",
            "value": 450.5,
            "value_type": "IfcReal"
        }
        prop_res = await client.post(
            f"/api/projects/{project_id}/elements/{target_id}/properties",
            json=prop_payload
        )
        assert prop_res.status_code == 200
        assert prop_res.json()["updated"] is True
        print("[PASS] Successfully posted property update to IFC model.")

        # 5. Fetch Element Details and verify Pset
        detail_res = await client.get(f"/api/projects/{project_id}/elements/{target_id}")
        assert detail_res.status_code == 200
        details = detail_res.json()
        
        # Verify Pset exists
        matching_psets = [p for p in details["psets"] if p["name"] == "Pset_BuildingStoreyCommon"]
        assert len(matching_psets) > 0, "Pset_BuildingStoreyCommon not found in details"
        matching_props = [pr for pr in matching_psets[0]["properties"] if pr["name"] == "GrossFloorArea"]
        assert len(matching_props) > 0, "GrossFloorArea property not found"
        assert abs(float(matching_props[0]["value"]) - 450.5) < 1e-4
        print(f"[PASS] Element details verified property: {matching_props[0]['name']} = {matching_props[0]['value']}")

        # 6. Cleanup
        await client.delete(f"/api/projects/{project_id}")
        print("[PASS] Test project cleaned up.")

if __name__ == "__main__":
    asyncio.run(test_phase3_transforms_and_properties())
