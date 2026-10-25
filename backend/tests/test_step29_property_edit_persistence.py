"""
STEP-29 — Property Inspector edits must actually persist to the model file.

Finding: F-066
Code under test:
  frontend/src/components/properties/GlassPropertyInspector.tsx:143-151  (the edit call site)
  backend/app/api/projects.py:293                                        (the only route: POST)
  backend/app/models/schemas.py:52-56                                    (PropertyUpdatePayload)
  backend/app/services/ifc_service.py:327-393                            (update_element_property)

BUG (verified 2026-10-24):
  The edit call sends `method: 'PATCH'` (the route is POST only -> 405) and a body with
  `name:` instead of `property_name` (-> 422). The error is swallowed by a console.error,
  so the user sees nothing happen. README feature 3 does not work.

HOW TO RUN
    Copy this file into backend/tests/ then:
    .\\backend\\venv\\Scripts\\python.exe -m pytest backend/tests/test_step29_property_edit_persistence.py -v
"""

import re
import sys
from pathlib import Path

import pytest
from starlette.testclient import TestClient


def _repo_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "backend" / "app" / "main.py").exists():
            return parent
    raise RuntimeError("Could not locate repository root")


ROOT = _repo_root()
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.main import app  # noqa: E402
from backend.app.services.project_service import ProjectService  # noqa: E402

INSPECTOR_SRC = ROOT / "frontend" / "src" / "components" / "properties" / "GlassPropertyInspector.tsx"


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def project(client):
    res = client.post("/api/projects/samples/office_pavilion/load")
    assert res.status_code == 201, f"sample load failed: {res.text}"
    data = res.json()
    yield data["id"]
    client.delete(f"/api/projects/{data['id']}")


def _first_element_id(client, project_id):
    tree = client.get(f"/api/projects/{project_id}/spatial-tree")
    assert tree.status_code == 200, tree.text
    found = []

    def walk(node):
        if not found and node.get("type") in ("IfcWall", "IfcColumn", "IfcSlab"):
            found.append(node["express_id"])
        for child in node.get("children") or []:
            walk(child)

    walk(tree.json())
    assert found, "no element found in the spatial tree"
    return found[0]


def test_frontend_edit_request_matches_the_backend_contract():
    """Every property request the inspector sends must match the only backend route.

    The route is `POST /{project_id}/elements/{express_id}/properties` and the payload schema
    requires `pset_name`, `property_name`, `value` and an optional `value_type`.
    """
    assert INSPECTOR_SRC.exists(), f"missing {INSPECTOR_SRC}"
    source = INSPECTOR_SRC.read_text(encoding="utf-8")

    # STEP-29 moved the request construction out of the component into the pure, unit-tested
    # `propertyUpdate` module. The inspector must delegate to it instead of hand-rolling a
    # fetch (which is how the PATCH / `name` regression was introduced).
    builder = ROOT / "frontend" / "src" / "services" / "propertyUpdate.ts"
    assert builder.exists(), f"missing {builder}"
    assert "buildPropertyUpdateRequest" in source, (
        "GlassPropertyInspector must build property requests with buildPropertyUpdateRequest "
        "from services/propertyUpdate.ts"
    )
    builder_src = builder.read_text(encoding="utf-8")

    method = re.search(r"method:\s*'([A-Z]+)'", builder_src)
    assert method, f"request builder has no explicit method: {builder_src[:200]}"
    assert method.group(1) == "POST", (
        f"the request builder uses {method.group(1)} but the backend route is POST-only "
        f"(backend/app/api/projects.py:293). The request will fail with 405 Method Not Allowed."
    )

    # Strip comments so the doc-comment payload example is not mistaken for the implementation.
    code_src = re.sub(r"/\*.*?\*/", "", builder_src, flags=re.S)
    code_src = re.sub(r"//[^\n]*", "", code_src)
    body_blocks = re.findall(r"body:\s*\{([^}]*)\}", code_src, re.S)
    body_block = next((b for b in body_blocks if "pset_name" in b), None)
    assert body_block is not None, "the request builder has no body object"
    body_keys = set(re.findall(r"([A-Za-z_][A-Za-z0-9_]*)\s*:", body_block))
    assert "property_name" in body_keys, (
        f"the request body is missing 'property_name'; it sends {sorted(body_keys)}. "
        "PropertyUpdatePayload requires 'property_name' -> 422 Unprocessable Entity."
    )
    assert "name" not in body_keys, (
        f"the request body still sends the legacy 'name' field; it sends {sorted(body_keys)}. "
        "PropertyUpdatePayload requires 'property_name'."
    )
    assert "value_type" in body_keys, (
        "the request body is missing 'value_type'; numeric/boolean values would be written "
        "with the wrong IFC measure."
    )


def test_property_edit_persists_to_the_model_file(client, project):
    """A correctly-formed property update must be written into the IFC on disk."""
    import ifcopenshell

    express_id = _first_element_id(client, project)
    file_path = ProjectService.get_project_file_path(project)

    payload = {
        "pset_name": "Pset_AutoTest_Step29",
        "property_name": "AutoTestValue",
        "value": 42,
        "value_type": "IfcInteger",
    }

    res = client.post(f"/api/projects/{project}/elements/{express_id}/properties", json=payload)
    assert res.status_code == 200, f"property update failed: {res.status_code} {res.text}"
    assert res.json().get("updated") is True

    # The value must be readable back through the element-details API.
    details = client.get(f"/api/projects/{project}/elements/{express_id}")
    assert details.status_code == 200, details.text
    psets = details.json()["psets"]
    target = next((p for p in psets if p["name"] == "Pset_AutoTest_Step29"), None)
    assert target is not None, f"pset not returned by the API: {[p['name'] for p in psets]}"
    prop = next((p for p in target["properties"] if p["name"] == "AutoTestValue"), None)
    assert prop is not None, f"property not returned: {target['properties']}"
    assert prop["value"] == 42, f"property value mismatch: {prop}"

    # And it must be in the file, not just in the API's cache.
    model = ifcopenshell.open(str(file_path))
    entity = model.by_id(express_id)
    found = False
    for rel in getattr(entity, "IsDefinedBy", []) or []:
        if not rel.is_a("IfcRelDefinesByProperties"):
            continue
        pset = rel.RelatingPropertyDefinition
        if not pset.is_a("IfcPropertySet") or pset.Name != "Pset_AutoTest_Step29":
            continue
        for prop in pset.HasProperties:
            if prop.Name == "AutoTestValue":
                found = True
                assert prop.NominalValue.wrappedValue == 42
    assert found, "the property was not written into model.ifc"


def test_property_edit_failure_is_not_swallowed(client, project):
    """A rejected property update must surface an error to the user.

    Today the failure is caught and only console.error'd, so the user sees the edit silently
    do nothing. The frontend must show the failure; this test pins the backend half (a bad
    payload is rejected with 422, not 500) and documents the frontend requirement.
    """
    express_id = _first_element_id(client, project)

    res = client.post(
        f"/api/projects/{project}/elements/{express_id}/properties",
        json={"pset_name": "Pset_AutoTest_Step29"},  # missing property_name and value
    )
    assert res.status_code == 422, (
        f"a malformed property payload returned {res.status_code} instead of 422; "
        "the client cannot distinguish 'you typed it wrong' from 'the server broke'"
    )
