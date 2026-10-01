import sys
from pathlib import Path

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

import json
from starlette.testclient import TestClient
from backend.app.main import app
import ifcopenshell

def test_phase6_ai_copilot_suite():
    with TestClient(app) as client:
        # 1. Test providers endpoint
        prov_res = client.get("/api/copilot/providers")
        assert prov_res.status_code == 200
        providers = prov_res.json()
        assert len(providers) >= 4
        provider_ids = [p["id"] for p in providers]
        assert "gemini" in provider_ids
        assert "claude" in provider_ids
        assert "openai" in provider_ids
        assert "ollama" in provider_ids
        assert "local" in provider_ids
        print("\n[PASS] Verified Copilot providers endpoint and models.")

        # 2. Create a blank project
        create_res = client.post("/api/projects", json={
            "name": "Phase 6 AI Copilot Project",
            "schema_version": "IFC4"
        })
        assert create_res.status_code == 201
        project_id = create_res.json()["id"]

        # 3. Test generate_building tool call via chat
        gen_res = client.post("/api/copilot/chat", json={
            "project_id": project_id,
            "provider": "local",
            "messages": [
                {"role": "user", "content": "Please generate a 2-storey building 12m by 8m"}
            ]
        })
        assert gen_res.status_code == 200, f"Chat failed: {gen_res.text}"
        data = gen_res.json()
        assert data["project_updated"] is True
        assert len(data["tool_calls"]) == 1
        t_call = data["tool_calls"][0]
        assert t_call["name"] == "generate_building"
        assert t_call["arguments"]["length"] == 12.0
        assert t_call["arguments"]["width"] == 8.0
        assert t_call["arguments"]["num_storeys"] == 2
        assert t_call["result"]["success"] is True
        assert t_call["result"]["element_count"] > 0
        print(f"[PASS] generate_building executed: {t_call['result']['summary']}")

        # Verify IFC file has the generated elements
        project_file = Path(root_dir) / "storage" / "projects" / project_id / "model.ifc"
        model = ifcopenshell.open(str(project_file))
        walls = model.by_type("IfcWall")
        slabs = model.by_type("IfcSlab")
        cols = model.by_type("IfcColumn")
        assert len(walls) == 8, f"Expected 8 walls, found {len(walls)}"
        assert len(slabs) == 2, f"Expected 2 slabs, found {len(slabs)}"
        assert len(cols) == 8, f"Expected 8 columns, found {len(cols)}"
        target_wall_id = walls[0].id()
        print(f"[PASS] Verified 8 walls, 2 slabs, and 8 columns on disk. Target wall #{target_wall_id}")

        # 4. Test query_model tool call via chat
        query_res = client.post("/api/copilot/chat", json={
            "project_id": project_id,
            "provider": "local",
            "messages": [
                {"role": "user", "content": "How many walls are in the model?"}
            ]
        })
        assert query_res.status_code == 200
        q_data = query_res.json()
        assert len(q_data["tool_calls"]) == 1
        q_call = q_data["tool_calls"][0]
        assert q_call["name"] == "query_model"
        assert q_call["result"]["success"] is True
        assert q_call["result"]["count"] == 8
        print(f"[PASS] query_model executed: {q_call['result']['summary']}")

        # 5. Test transform_element tool call via chat
        trans_res = client.post("/api/copilot/chat", json={
            "project_id": project_id,
            "provider": "local",
            "selected_express_id": target_wall_id,
            "messages": [
                {"role": "user", "content": f"Move element #{target_wall_id} by 3 meters on x and 1.5m up"}
            ]
        })
        assert trans_res.status_code == 200
        tr_data = trans_res.json()
        assert tr_data["project_updated"] is True
        assert len(tr_data["tool_calls"]) == 1
        tr_call = tr_data["tool_calls"][0]
        assert tr_call["name"] == "transform_element"
        assert tr_call["arguments"]["element_id"] == target_wall_id
        assert tr_call["arguments"]["dx"] == 3.0
        assert tr_call["arguments"]["dz"] == 1.5
        assert tr_call["result"]["success"] is True
        print(f"[PASS] transform_element executed: {tr_call['result']['summary']}")

        # 6. Test update_property tool call via chat
        prop_res = client.post("/api/copilot/chat", json={
            "project_id": project_id,
            "provider": "local",
            "selected_express_id": target_wall_id,
            "messages": [
                {"role": "user", "content": f"Set property IsExternal to true on element #{target_wall_id}"}
            ]
        })
        assert prop_res.status_code == 200
        pr_data = prop_res.json()
        assert pr_data["project_updated"] is True
        assert len(pr_data["tool_calls"]) == 1
        pr_call = pr_data["tool_calls"][0]
        assert pr_call["name"] == "update_property"
        assert pr_call["arguments"]["element_id"] == target_wall_id
        assert pr_call["arguments"]["property_name"] == "IsExternal"
        assert pr_call["result"]["success"] is True
        print(f"[PASS] update_property executed: {pr_call['result']['summary']}")

        # 7. Cleanup
        del_res = client.delete(f"/api/projects/{project_id}")
        assert del_res.status_code == 204
        print("[PASS] Phase 6 test project cleaned up successfully.")

if __name__ == "__main__":
    test_phase6_ai_copilot_suite()
