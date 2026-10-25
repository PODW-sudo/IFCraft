import hashlib
import sys
from pathlib import Path

import pytest
from starlette.testclient import TestClient

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.app.main import app
import ifcopenshell
import ifcopenshell.validate

PROJECTS_DIR = Path(root_dir) / "storage" / "projects"


def _model_path(project_id: str) -> Path:
    return PROJECTS_DIR / project_id / "model.ifc"


def _digest(project_id: str) -> str:
    return hashlib.sha256(_model_path(project_id).read_bytes()).hexdigest()


def _validation_statements(path: Path) -> list[dict]:
    logger = ifcopenshell.validate.json_logger()
    ifcopenshell.validate.validate(str(path), logger, express_rules=True)
    return logger.statements


def _post_property(client, project_id, express_id, **payload):
    body = {"pset_name": "Pset_Step18Probe", "property_name": "FireRating", "value": "FR-60"}
    body.update(payload)
    body.setdefault("value_type", "IfcLabel")
    return client.post(
        f"/api/projects/{project_id}/elements/{express_id}/properties", json=body
    )


def _nominal(project_id: str, express_id: int, pset_name: str, prop_name: str):
    model = ifcopenshell.open(str(_model_path(project_id)))
    entity = model.by_id(express_id)
    for rel in getattr(entity, "IsDefinedBy", []):
        if not rel.is_a("IfcRelDefinesByProperties"):
            continue
        pdef = rel.RelatingPropertyDefinition
        if not pdef.is_a("IfcPropertySet") or pdef.Name != pset_name:
            continue
        for prop in pdef.HasProperties:
            if prop.Name == prop_name:
                return prop.NominalValue
    return None


@pytest.fixture()
def ifc2x3_project():
    """IFC2X3 sample with a measured validation baseline of 0 statements."""
    with TestClient(app) as client:
        res = client.post("/api/projects/samples/ifc2x3_duplex_architecture/load")
        assert res.status_code == 201, res.text
        project_id = res.json()["id"]
        client.put(f"/api/projects/{project_id}", json={"name": "AutoTest-step18-ifc2x3"})
        try:
            yield client, project_id
        finally:
            client.delete(f"/api/projects/{project_id}")


def test_non_value_entity_cannot_be_a_value_type(ifc2x3_project):
    """Spec 2 and 4: IfcWall is an entity, not an IfcValue; it must be refused."""
    client, project_id = ifc2x3_project
    model = ifcopenshell.open(str(_model_path(project_id)))
    wall_id = model.by_type("IfcWall")[0].id()
    before = _digest(project_id)

    res = _post_property(client, project_id, wall_id, value_type="IfcWall", value="x")

    assert res.status_code == 422, res.text
    assert _digest(project_id) == before, "rejected write still modified the model"

    nested = ifcopenshell.open(str(_model_path(project_id)))
    for prop in nested.by_type("IfcPropertySingleValue"):
        nominal = prop.NominalValue
        assert nominal is None or not nominal.is_a("IfcWall"), (
            f"IfcWall nested inside {prop}"
        )


def test_boolean_string_is_coerced_not_dropped(ifc2x3_project):
    """Spec 5: 'IfcBoolean' + 'true' must store True, not $."""
    client, project_id = ifc2x3_project
    wall_id = ifcopenshell.open(str(_model_path(project_id))).by_type("IfcWall")[0].id()

    res = _post_property(
        client, project_id, wall_id,
        pset_name="Pset_Step18Bool", property_name="IsExternal",
        value="true", value_type="IfcBoolean",
    )
    assert res.status_code == 200, res.text

    nominal = _nominal(project_id, wall_id, "Pset_Step18Bool", "IsExternal")
    assert nominal is not None, "NominalValue missing"
    assert nominal.is_a("IfcBoolean"), nominal.is_a()
    assert nominal.wrappedValue is True, (
        f"boolean value was written as {nominal} (silent data loss)"
    )


def test_numeric_string_is_coerced_for_measures(ifc2x3_project):
    """Spec 5: 'IfcLengthMeasure' + '12.5' must store 12.5."""
    client, project_id = ifc2x3_project
    wall_id = ifcopenshell.open(str(_model_path(project_id))).by_type("IfcWall")[0].id()

    res = _post_property(
        client, project_id, wall_id,
        pset_name="Pset_Step18Measure", property_name="Height",
        value="12.5", value_type="IfcLengthMeasure",
    )
    assert res.status_code == 200, res.text
    nominal = _nominal(project_id, wall_id, "Pset_Step18Measure", "Height")
    assert nominal is not None and nominal.wrappedValue == pytest.approx(12.5)


@pytest.mark.parametrize(
    "value, value_type",
    [
        ("not-a-number", "IfcLengthMeasure"),
        (-2.5, "IfcPositiveLengthMeasure"),
        (1.5, "IfcNormalisedRatioMeasure"),
        (3.7, "IfcInteger"),
        (None, "IfcLabel"),
    ],
)
def test_uncoercible_values_are_rejected_without_writing(ifc2x3_project, value, value_type):
    """Spec 6: bad values are a 422 with the model untouched, never a 500."""
    client, project_id = ifc2x3_project
    wall_id = ifcopenshell.open(str(_model_path(project_id))).by_type("IfcWall")[0].id()
    before = _digest(project_id)

    res = _post_property(client, project_id, wall_id, value=value, value_type=value_type)

    assert res.status_code == 422, f"{res.status_code}: {res.text}"
    assert "probe" not in (res.json().get("detail") or "").lower()
    assert _digest(project_id) == before


def test_ifc2x3_pset_creation_is_schema_valid(ifc2x3_project):
    """Spec 7 and 8: no new validation statements on an IFC2X3 pset write."""
    client, project_id = ifc2x3_project
    path = _model_path(project_id)
    wall_id = ifcopenshell.open(str(path)).by_type("IfcWall")[0].id()

    baseline = len(_validation_statements(path))
    assert baseline == 0, f"fixture baseline changed: {baseline} statements"

    res = _post_property(client, project_id, wall_id, pset_name="Pset_Step18Valid")
    assert res.status_code == 200, res.text

    statements = _validation_statements(path)
    owner_history_only = [s for s in statements if "OwnerHistory" in str(s.get("attribute"))]
    assert owner_history_only == [], owner_history_only
    assert len(statements) == baseline, statements


def test_ifc4_property_write_adds_no_validation_errors():
    """Spec 9: the IFC4 path must not gain an OwnerHistory it cannot hold."""
    with TestClient(app) as client:
        load = client.post("/api/projects/samples/office_pavilion/load")
        assert load.status_code == 201, load.text
        project_id = load.json()["id"]
        try:
            path = _model_path(project_id)
            element_id = ifcopenshell.open(str(path)).by_type("IfcProduct")[0].id()
            baseline = len(_validation_statements(path))

            res = _post_property(client, project_id, element_id, pset_name="Pset_Step18IFC4")
            assert res.status_code == 200, res.text

            after = _validation_statements(path)
            assert len(after) == baseline, [s for s in after if "Pset_Step18IFC4" in str(s)]
        finally:
            client.delete(f"/api/projects/{project_id}")


def test_invalid_schema_version_creates_nothing():
    """Spec 1: F-043 — no orphan directory, no row."""
    with TestClient(app) as client:
        before_ids = {p["id"] for p in client.get("/api/projects").json()}
        before_dirs = {p.name for p in PROJECTS_DIR.iterdir() if p.is_dir()}

        res = client.post(
            "/api/projects",
            json={"name": "AutoTest-step18-bad-schema", "schema_version": "IFC9"},
        )
        assert res.status_code == 422, res.text

        assert {p["id"] for p in client.get("/api/projects").json()} == before_ids
        assert {p.name for p in PROJECTS_DIR.iterdir() if p.is_dir()} == before_dirs


def test_service_boundary_rejects_non_value_types(ifc2x3_project):
    """Spec 3: the guard also holds for callers that bypass Pydantic entirely.

    `cad_service` and `ai_service` call `IFCService.update_element_property` directly, so
    the HTTP-layer Literal alone would be decorative.
    """
    client, project_id = ifc2x3_project
    from backend.app.services.ifc_service import IFCService

    path = _model_path(project_id)
    wall_id = ifcopenshell.open(str(path)).by_type("IfcWall")[0].id()
    before = _digest(project_id)

    with pytest.raises(ValueError) as exc_info:
        IFCService.update_element_property(path, wall_id, "Pset_Step18Direct", "Wall", "x", "IfcWall")
    assert "IfcWall" in str(exc_info.value)

    with pytest.raises(ValueError):
        IFCService.update_element_property(
            path, wall_id, "Pset_Step18Direct", "Bogus", "x", "IfcNotARealType"
        )

    with pytest.raises(ValueError) as exc_info:
        IFCService.update_element_property(
            path, wall_id, "Pset_Step18Direct", "Height", 3.7, "IfcInteger"
        )
    assert "Height" in str(exc_info.value)

    assert _digest(project_id) == before, "a rejected service call modified the model"

    model = ifcopenshell.open(str(path))
    assert not [p for p in model.by_type("IfcPropertySet") if p.Name == "Pset_Step18Direct"], (
        "a rejected service call still created the pset"
    )
