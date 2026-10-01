import sys
from pathlib import Path

# Add project root to sys.path
root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

import asyncio
import pytest
from httpx import AsyncClient, ASGITransport
from backend.app.main import app
from backend.app.core.database import init_db

@pytest.mark.asyncio
async def test_phase1_endpoints():
    # Ensure database tables exist
    await init_db()
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Health check
        res = await client.get("/health")
        assert res.status_code == 200, f"Health check failed: {res.text}"
        health_data = res.json()
        assert health_data["status"] == "ok"
        assert health_data["database_ok"] is True
        assert len(health_data["ifcopenshell_version"]) > 0
        print("\n[PASS] /health check verified.")

        # 2. Project creation (Blank IFC project)
        create_payload = {
            "name": "Phase 1 Test Villa",
            "description": "Automated Quality Gate Project",
            "schema_version": "IFC4"
        }
        res = await client.post("/api/projects", json=create_payload)
        assert res.status_code == 201, f"Project creation failed: {res.text}"
        project_data = res.json()
        project_id = project_data["id"]
        assert project_data["name"] == "Phase 1 Test Villa"
        assert project_data["schema_version"] == "IFC4"
        assert project_data["file_size"] > 0
        print(f"[PASS] Project created successfully with ID: {project_id}")

        # 3. List projects
        res = await client.get("/api/projects")
        assert res.status_code == 200
        projects_list = res.json()
        assert any(p["id"] == project_id for p in projects_list)
        print("[PASS] GET /api/projects successfully returned project list.")

        # 4. Spatial tree
        res = await client.get(f"/api/projects/{project_id}/spatial-tree")
        assert res.status_code == 200, f"Spatial tree failed: {res.text}"
        tree_data = res.json()
        assert tree_data["type"] == "IfcProject"
        assert len(tree_data["children"]) > 0  # Site
        site_node = tree_data["children"][0]
        assert site_node["type"] == "IfcSite"
        assert len(site_node["children"]) > 0  # Building
        building_node = site_node["children"][0]
        assert building_node["type"] == "IfcBuilding"
        assert len(building_node["children"]) > 0  # Storey
        storey_node = building_node["children"][0]
        assert storey_node["type"] == "IfcBuildingStorey"
        print(f"[PASS] Spatial tree hierarchy verified: {tree_data['name']} -> {site_node['name']} -> {building_node['name']} -> {storey_node['name']}")

        # 5. Download IFC file
        res = await client.get(f"/api/projects/{project_id}/download")
        assert res.status_code == 200
        assert b"ISO-10303-21;" in res.content
        assert b"FILE_SCHEMA" in res.content
        assert b"IFC4" in res.content
        print("[PASS] IFC file download verified with valid STEP header.")

        # 6. Delete project
        res = await client.delete(f"/api/projects/{project_id}")
        assert res.status_code == 204
        print("[PASS] Project deletion verified.")

if __name__ == "__main__":
    asyncio.run(test_phase1_endpoints())
