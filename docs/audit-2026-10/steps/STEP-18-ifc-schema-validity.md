# STEP-18 — `value_type` literal, OwnerHistory, schema validation

**Status:** not started · **Wave:** C · **Effort:** 2 d
**Findings:** F-014, F-015, F-043, F-064 · **Depends on:** STEP-17 · **Blocks:** —

## Problem

A property edit can produce an IFC file that strict receivers reject. `value_type` is taken verbatim from the client and used as an **entity class name**, so `{"value_type":"IfcWall"}` nests an `IfcWall` inside an `IfcPropertySingleValue`. On IFC2X3 every new `IfcPropertySet` is written without the mandatory `OwnerHistory`, so a model edited in this app **fails `ifcopenshell.validate` with two schema errors per edited element**. And a type mismatch (`"IfcReal"` with `"1.5"`) returns a 500 `RuntimeError: Attribute not set` — or, worse for `IfcBoolean`, silently writes `$`, so the property the user just set is not there.

## Evidence

- `backend/app/models/schemas.py:38` — `PropertySingle.value_type: str = "IfcLabel"` (unconstrained); `backend/app/models/schemas.py:56` — `PropertyUpdatePayload.value_type: str` with a *description* listing five names and no validation.
- `backend/app/services/ifc_service.py:360`, `:380`, `:387` — `model.create_entity(prop_type, prop_val)`, i.e. the client string is an IFC class name.
- `backend/app/services/ifc_service.py:356-373` — new `IfcPropertySet` and `IfcRelDefinesByProperties` are created with `GlobalId` only; no `OwnerHistory`, no `ChangeAction`.
- `backend/app/services/project_service.py:22-36` — `project_dir.mkdir(parents=True, exist_ok=True)` at `:26` runs **before** `IFCService.create_blank_project` at `:32`, which raises for an unknown schema; `backend/app/models/schemas.py:8-9` does not constrain `schema_version`.
- Measured (this audit tree, `ifcopenshell` 0.9.0), IFC2X3 sample + one property write, then `ifcopenshell.validate.validate(path, json_logger(), express_rules=True)`:
  ```
  statements: 2
    Attribute not optional | IfcPropertySet.OwnerHistory        (#39116=IfcPropertySet('3NGGWj5mH29fT$1lNEjLIG',$,'Pset_TestStep18',$,(#39115)))
    Attribute not optional | IfcRelDefinesByProperties.OwnerHistory
  ```
  Baseline for the same file with no edit: **0 statements**.
- Measured, `value_type="IfcWall"`:
  ```
  statements: 5  including
    NominalValue: #39115=IfcWall('x',$,$,$,$,$,$,$)  ->  Not valid
  ```
  The nested entity is `IfcWall` with a bogus `GlobalId` — two violations from one call.
- Measured, coercion matrix on `create_entity`:
  ```
  IfcBoolean('true')  -> OK  IfcBoolean($)          <-- silent data loss
  IfcBoolean(1)       -> OK  IfcBoolean($)          <-- silent data loss
  IfcInteger(3.7)     -> RuntimeError: Attribute not set
  IfcReal('1.5')      -> RuntimeError: Attribute not set
  IfcLabel(42)        -> RuntimeError: Attribute not set
  IfcPositiveLengthMeasure(-2.5) -> OK  IfcPositiveLengthMeasure(-2.5)   <-- violates the type
  ```
- Measured, `ifcopenshell.file(schema="IFC9")` → `RuntimeError : No schema named IFC9`, raised **after** `mkdir`.

## Scope

**Change:**

- `backend/app/models/schemas.py:8-9` — constrain `ProjectCreate.schema_version` to `Literal["IFC2X3", "IFC4", "IFC4X3"]`.
- `backend/app/models/schemas.py:35-38` — add `IFCValueType = Literal[...]` and use it for `PropertySingle.value_type` and `PropertyUpdatePayload.value_type` (`:52-56`).
- `backend/app/services/ifc_service.py:327-395` — `update_element_property`: validate the type against the allowlist, coerce the value, attach `OwnerHistory`, write the pset **after** the value is proved writable.
- `backend/app/services/ifc_service.py` — add `IFC_VALUE_TYPES: frozenset[str]`, `_coerce_value(prop_type, value)`, `_ensure_owner_history(model)` (new helpers above `class IFCService`).
- `backend/app/services/project_service.py:22-36` — `create_project`: validate `data.schema_version` and roll back `project_dir` on any failure.
- `backend/app/api/projects.py:293-336` — map `ValueError` from the service to `422` (currently every failure becomes a 500 at `:332-336`).

**Do not change:**

- `backend/app/services/ifc_service.py:236-284` (`update_element_placement`) — STEP-01/STEP-02 territory.
- `IFCService.create_blank_project`'s IFC output — it already writes a correct `IfcOwnerHistory` at `:50-56`; reuse that object, do not create a second one.
- `backend/tests/test_schema_compliance.py` — it is the fixture suite; add to it, never weaken it. (It never calls `ifcopenshell.validate`; this step's new test carries that assertion.)

**Non-goals:**

- Validating *every* entity in the file on upload. `validate()` on a 48 MB model is a multi-minute operation; this step validates the pset path only.
- Repairing pre-existing violations in the bundled samples. `backend/app/samples/office_pavilion.ifc` has **1** pre-existing `IfcOwnerHistory.CorrectChangeAction` error; tests must assert *deltas*, not absolute zero, on that file.
- Converting IFC2X3 models to IFC4. See the decision below.

## Decision the executor must make

F-015 has two possible fixes. **Recommended: add `OwnerHistory` to the created entities; do not upgrade the schema.**

| Option | Consequence |
|---|---|
| **(A) Add `OwnerHistory` (recommended)** | Two attribute assignments. Entity ids, `GlobalId`s and representation trees are untouched, so the user's contractual model stays byte-comparable and `StepId`-stable. This is what every IFC2X3 authoring tool does. |
| (B) Upgrade the model to IFC4 | Rewrites the whole file, invalidates every `express_id` the UI has cached and every BCF topic's `selected_elements`, and cannot be reversed without a backup. It also silently changes the deliverable the client is contracted to receive. |

If the product owner chooses (B) it must become its own step with a backup/undo requirement; it must not be smuggled into this one.

## Spec

1. `POST /api/projects` with `schema_version` outside `{IFC2X3, IFC4, IFC4X3}` returns `422` at request validation, creates **no** directory under `storage/projects/` and **no** row in `projects`.
2. `POST /api/projects/{id}/elements/{eid}/properties` with `value_type: "IfcWall"` returns `422` and leaves `model.ifc` byte-identical.
3. `value_type` outside the allowlist returns `422` from the service even when the request body bypasses Pydantic (direct service call) — the guard is duplicated at the service boundary.
4. The service's allowlist accepts only names that `ifcopenshell.ifcopenshell_wrapper.schema_by_name(model.schema).declaration_by_name(name)` reports as a `type_declaration` **and** that appear in `IFC_VALUE_TYPES`. Entities (`IfcWall`) and unknown names are rejected.
5. Coercion, by family:
   - `IfcLabel`, `IfcText`, `IfcIdentifier` → `str(value)`; `bool`/`None`/containers rejected.
   - `IfcInteger`, `IfcCountMeasure`, `IfcTimeStamp` → `int`; integral floats and digit strings accepted; `3.7` rejected.
   - `IfcReal` and every `Ifc*Measure` → `float`; numeric strings accepted; `bool` rejected.
   - `IfcBoolean`, `IfcLogical` → `bool`; `"true"|"false"|"yes"|"no"|"1"|"0"` and `1|0` accepted; result must be a real boolean, never `$`.
   - `IfcPositive*Measure` → additionally `> 0`; `IfcNormalisedRatioMeasure` → `0.0 ≤ v ≤ 1.0`.
6. A value that cannot be coerced raises `ValueError` with the property name and the expected Python type; the API returns `422`, not `500`, and `model.ifc` is unchanged.
7. On IFC2X3, a newly created `IfcPropertySet` and its `IfcRelDefinesByProperties` carry a non-null `OwnerHistory` obtained by reusing an existing `IfcOwnerHistory` in the model, or creating one (`IfcPerson`/`IfcOrganization`/`IfcPersonAndOrganization`/`IfcApplication`) if the model has none.
8. After any accepted property write, `ifcopenshell.validate.validate(model, express_rules=True)` reports **zero new** statements compared with the pre-write baseline for the same file.
9. Reusing an existing pset leaves `OwnerHistory` untouched (do not resurrect a deleted one, do not add one to an IFC4 pset where the attribute does not exist).

## TDD

### 1. Add the failing test

**File:** `backend/tests/test_step18_ifc_schema_validity.py`
**Command:** `.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step18_ifc_schema_validity.py -v`

<details>
```python
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
```
</details>

### 2. Watch it fail

```
$ .\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step18_ifc_schema_validity.py -v
FAILED backend/tests/test_step18_ifc_schema_validity.py::test_non_value_entity_cannot_be_a_value_type
  E   assert 500 == 422
  E   AssertionError: {"detail":"Failed to update property for #5399: Attribute not set"}   (or 200 with a nested IfcWall)
FAILED backend/tests/test_step18_ifc_schema_validity.py::test_boolean_string_is_coerced_not_dropped
  E   AssertionError: boolean value was written as IfcBoolean($) (silent data loss)
FAILED backend/tests/test_step18_ifc_schema_validity.py::test_numeric_string_is_coerced_for_measures
  E   assert 500 == 200  ->  "Attribute not set"
FAILED backend/tests/test_step18_ifc_schema_validity.py::test_uncoercible_values_are_rejected_without_writing[not-a-number-IfcLengthMeasure]
  E   assert 500 == 422
FAILED backend/tests/test_step18_ifc_schema_validity.py::test_ifc2x3_pset_creation_is_schema_valid
  E   AssertionError: [{'level': 'error', 'message': 'Attribute not optional',
      'attribute': 'IfcPropertySet.OwnerHistory', ...}] == []
FAILED backend/tests/test_step18_ifc_schema_validity.py::test_invalid_schema_version_creates_nothing
  E   assert 500 == 422
  E   AssertionError: {"detail":"Internal Server Error"}   and a new directory appeared under storage/projects
PASSED backend/tests/test_step18_ifc_schema_validity.py::test_ifc4_property_write_adds_no_validation_errors
```

`test_ifc4_property_write_adds_no_validation_errors` passes today and is the guard that the OwnerHistory fix must stay schema-aware.

### 3. Implement

1. `backend/app/models/schemas.py:8-9` —
   ```python
   SchemaVersion = Literal["IFC2X3", "IFC4", "IFC4X3"]

   class ProjectCreate(ProjectBase):
       schema_version: SchemaVersion = Field("IFC4", description="IFC Schema: IFC2X3, IFC4, or IFC4X3")
   ```
   (import `Literal` at `:1`.) Pydantic now rejects `IFC9` with `422` before the handler runs, which is what makes spec 1 hold — verify by re-reading `project_service.py:22-36`.
2. `backend/app/models/schemas.py:35-38` — add
   ```python
   IFCValueType = Literal[
       "IfcLabel", "IfcText", "IfcIdentifier",
       "IfcReal", "IfcInteger", "IfcBoolean", "IfcLogical",
       "IfcCountMeasure", "IfcTimeStamp",
       "IfcLengthMeasure", "IfcPositiveLengthMeasure",
       "IfcAreaMeasure", "IfcVolumeMeasure", "IfcMassMeasure",
       "IfcPlaneAngleMeasure", "IfcRatioMeasure", "IfcPositiveRatioMeasure",
       "IfcNormalisedRatioMeasure", "IfcThermalTransmittanceMeasure",
       "IfcPowerMeasure", "IfcTimeMeasure",
   ]
   ```
   and use it for `PropertySingle.value_type` (`:38`) and `PropertyUpdatePayload.value_type` (`:56`).
   `backend/app/services/cad_service.py:784`, `:786`, `:796`, `:850-854` only ever pass `IfcLengthMeasure`, `IfcLabel`, `IfcReal` — all in the list, so the CAD paths keep compiling.
3. `backend/app/services/ifc_service.py` — above `class IFCService`, add:
   - `IFC_VALUE_TYPES: frozenset[str]` mirroring the `Literal`.
   - `_coerce_value(prop_type: str, value: Any) -> Any` implementing spec 5, raising `ValueError(f"{prop_name}: expected {expected}, got {value!r}")`-style messages (pass the property name in from the caller).
   - `_ensure_owner_history(model) -> Optional[Any]`: return `model.by_type("IfcOwnerHistory")[0]` if any; else create `IfcPerson`/`IfcOrganization`/`IfcPersonAndOrganization`/`IfcApplication` (mirroring `create_blank_project` at `:46-56`) and `model.create_entity("IfcOwnerHistory", OwningUser=…, OwningApplication=…, ChangeAction="ADDED", CreationDate=1700000000)`. Return `None` for schemas where the target entity has no `OwnerHistory` attribute — detect with `"OwnerHistory" in [a.name() for a in model.schema.declaration_by_name("IfcPropertySet").all_attributes()]` guarded by try/except (the `model.schema` attribute is a *string*; use `ifcopenshell.ifcopenshell_wrapper.schema_by_name(model.schema)`).
4. `backend/app/services/ifc_service.py:327-395` — in `update_element_property`, in this order and **before** any `create_entity`:
   1. resolve `entity`; raise `ValueError(f"Entity #{express_id} not found.")` (already at `:342-343`).
   2. `if prop_type not in IFC_VALUE_TYPES: raise ValueError(...)`.
   3. verify the declaration is a `type_declaration` in this model's schema; else `ValueError`.
   4. `prop_val = _coerce_value(prop_type, prop_val)`.
   5. only then create/assign `NominalValue`. Replace the three `model.create_entity(prop_type, prop_val)` calls at `:360`, `:380`, `:387` with the coerced value.
   6. when creating a **new** pset (`:356-373`), pass `OwnerHistory=_ensure_owner_history(model)` to both `IfcPropertySet` and `IfcRelDefinesByProperties` — conditionally, only when the schema allows the attribute (build the kwargs dict, do not hardcode the keyword).
5. `backend/app/services/project_service.py:22-36` — wrap the body in `try/except` and `shutil.rmtree(project_dir, ignore_errors=True)` on failure before re-raising, so an unexpected `create_blank_project` error cannot leave an orphan directory. (With step 1 in place this is a belt-and-braces guard, not the primary fix.)
6. `backend/app/api/projects.py:332-336` — add `except ValueError as e: raise HTTPException(status_code=422, detail=str(e))` before the blanket handler.

### 4. Watch it pass

```
$ .\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step18_ifc_schema_validity.py -v
PASSED backend/tests/test_step18_ifc_schema_validity.py::test_non_value_entity_cannot_be_a_value_type
PASSED backend/tests/test_step18_ifc_schema_validity.py::test_boolean_string_is_coerced_not_dropped
PASSED backend/tests/test_step18_ifc_schema_validity.py::test_numeric_string_is_coerced_for_measures
PASSED backend/tests/test_step18_ifc_schema_validity.py::test_uncoercible_values_are_rejected_without_writing[not-a-number-IfcLengthMeasure]
PASSED backend/tests/test_step18_ifc_schema_validity.py::test_uncoercible_values_are_rejected_without_writing[-2.5-IfcPositiveLengthMeasure]
PASSED backend/tests/test_step18_ifc_schema_validity.py::test_uncoercible_values_are_rejected_without_writing[1.5-IfcNormalisedRatioMeasure]
PASSED backend/tests/test_step18_ifc_schema_validity.py::test_uncoercible_values_are_rejected_without_writing[3.7-IfcInteger]
PASSED backend/tests/test_step18_ifc_schema_validity.py::test_uncoercible_values_are_rejected_without_writing[None-IfcLabel]
PASSED backend/tests/test_step18_ifc_schema_validity.py::test_ifc2x3_pset_creation_is_schema_valid
PASSED backend/tests/test_step18_ifc_schema_validity.py::test_ifc4_property_write_adds_no_validation_errors
PASSED backend/tests/test_step18_ifc_schema_validity.py::test_invalid_schema_version_creates_nothing
11 passed
```

### 5. Regression guard

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_schema_compliance.py -v
.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_cad_and_clash.py -v
.\backend\venv\Scripts\python.exe -m pytest backend/tests/ -q
cd frontend; pnpm exec tsc -b --noEmit
```

`test_cad_and_clash.py` exercises `assign_material`/`update_geometry`, which reach `update_element_property` with `IfcLabel`/`IfcReal`/`IfcLengthMeasure` — if the allowlist is too narrow, that suite is where it shows. `test_schema_compliance.py` guards the sample files and the export round trip.

## Acceptance criteria

- [ ] `{"value_type": "IfcWall"}` → `422`; no `IfcWall` is ever nested in an `IfcPropertySingleValue`.
- [ ] `{"value": "true", "value_type": "IfcBoolean"}` → stored `NominalValue.wrappedValue is True` (not `$`).
- [ ] `{"value": "12.5", "value_type": "IfcLengthMeasure"}` → stored `12.5`.
- [ ] `"not-a-number"` / `-2.5` under `IfcPositiveLengthMeasure` / `3.7` under `IfcInteger` / `null` under `IfcLabel` → `422` and unchanged file digest.
- [ ] IFC2X3 pset creation adds **0** `ifcopenshell.validate` statements (baseline 0 → after 0).
- [ ] IFC4 pset creation adds **0** new statements (baseline 1 → after 1, pre-existing `IfcOwnerHistory.CorrectChangeAction` untouched).
- [ ] `POST /api/projects {"schema_version":"IFC9"}` → `422`, no row, no directory.
- [ ] `pytest backend/tests/test_schema_compliance.py` and `test_cad_and_clash.py` stay green.

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| Narrowing `value_type` to a `Literal` breaks an unknown client that sent `"IfcThermalTransmittanceMeasure"`-style values not in the list | The list covers every type the app itself uses plus the common BIM measures; add entries as data, not logic | Revert the two `Literal` annotations to `str` (service guard remains) |
| Adding `OwnerHistory` to IFC2X3 changes byte output for existing projects | Only newly created psets change; existing psets and `IfcOwnerHistory` objects are reused, never rewritten | Revert `_ensure_owner_history` usage; files revert on the next write |
| `_coerce_value` rejects a value a user considers valid (e.g. `"yes"` for `IfcLogical`) | Explicit synonym table in spec 5; `IfcLogical` accepts `yes/no/true/false/1/0` | Widen the synonym tuple |
| `ValueError` → `422` hides a genuine server bug | Only `ValueError` from the service is mapped; every other exception still returns `500` with a logged traceback | N/A |
| Rolling back `project_dir` on failure deletes a directory a concurrent request already populated | `project_id` is a fresh `uuid4()` at `:24`, so nothing else can be writing there | N/A |

## Notes

- **The coercion matrix is the actual F-064 fix, and it is not cosmetic.** `IfcBoolean('true')` currently *succeeds* and writes `$`. A user sets `IsExternal = true`, the panel says saved, the exported model has no value. That is the "reports success it did not achieve" theme from `USER-NEEDS.md` §1 in its purest form; treat spec 5 as the deliverable and the `Literal` as the cheap half.
- **Two guards, on purpose.** The `Literal` rejects at the HTTP boundary; `IFC_VALUE_TYPES` + the `type_declaration` check rejects at the service boundary. The service is called directly from `backend/app/services/cad_service.py:784` and `backend/app/services/ai_service.py:906`, neither of which passes through Pydantic — so the boundary guard alone would be decorative.
- **`ifcopenshell.validate` cost:** validating the 295-element duplex sample takes well under a second; validating `modelsfortests/Ifc2x3_SampleCastle.ifc` (48 MB) exceeded a 2-minute budget in this audit. Never call `validate()` from a request handler.
- **Sample baselines are measured facts, not assumptions:** `backend/app/samples/ifc2x3_duplex_architecture.ifc` → 0 statements; `backend/app/samples/office_pavilion.ifc` → 1 (`IfcOwnerHistory.CorrectChangeAction`). Assert deltas on any file whose baseline is non-zero.
- **Not verified:** F-014, F-015, F-043 and F-064 are all `[L]` in `FINDINGS.md`. The `## Evidence` measurements above were produced during this documentation pass by running `ifcopenshell.validate` directly against copies of the samples in `%TEMP%`; no HTTP request was made and no repository fixture was modified.
- `backend/tests/test_schema_compliance.py` checks the STEP header, GUID shape and spatial containment but **never calls `ifcopenshell.validate`** — which is exactly how a two-error-per-write regression shipped unnoticed. Consider adding a `validate()` assertion to that file when this step is complete.

### 2026-10-25 — implemented (backend lane)

- **Decision taken: option (A).** Created IFC2X3 psets/rels receive a non-null `OwnerHistory`
  (reusing the model's existing `IfcOwnerHistory`, creating one only when the model has none).
  The schema is **not** upgraded, no `GlobalId`/express id changes, and an IFC4/IFC4X3 pset is left
  alone. Measured basis for the "leave IFC4 alone" half:
  `schema_by_name("IFC2X3").declaration_by_name("IfcPropertySet").all_attributes()` reports
  `OwnerHistory optional=False`, while IFC4/IFC4X3 report `optional=True` — so the write is gated on
  *mandatory*, not merely *present* (`_owner_history_is_mandatory`). That keeps
  `test_ifc4_property_write_adds_no_validation_errors` at baseline 1 → 1.
- **Executed.** `schemas.py`: `SchemaVersion` Literal on `ProjectCreate.schema_version`,
  `IFCValueType` Literal on `PropertySingle.value_type` and `PropertyUpdatePayload.value_type`.
  `ifc_service.py`: `IFC_VALUE_TYPES`, `_coerce_value`, `_schema_declaration`,
  `is_value_type_declaration`, `_owner_history_is_mandatory`, `_ensure_owner_history`,
  `_owner_history_kwargs`; `update_element_property` now validates (allowlist → type declaration →
  coercion) *before* creating anything. `project_service.create_project`: schema guard before
  `mkdir` + `shutil.rmtree` rollback. `api/projects.py`: `except ValueError → 422` on the properties
  route (snapshot discarded, everything else still 500).
- **Watch it fail (recorded, pre-fix `10 failed, 1 passed in 27.35s`).** `IfcWall` as `value_type`
  → `200 {"status":"success"}` (an `IfcWall` nested in `NominalValue`); `"true"`/`IfcBoolean` →
  `wrappedValue is None` (`IfcBoolean($)`, silent data loss); `"12.5"`/`IfcLengthMeasure` →
  `500 Attribute not set`; `-2.5`/`IfcPositiveLengthMeasure`, `1.5`/`IfcNormalisedRatioMeasure`,
  `None`/`IfcLabel` all → `200` (written anyway); IFC2X3 pset → 2 `OwnerHistory` validation
  statements; `schema_version: "IFC9"` → `500 RuntimeError: No schema named IFC9` **plus** an orphan
  directory. Only the IFC4 test passed, as the doc predicted.
- **Watch it pass.** `12 passed in 25.74s` (the doc's 11 plus one added service-boundary test).
  `test_step18_ifc_schema_validity.py::test_service_boundary_rejects_non_value_types` pins spec 3
  against a direct `IFCService` call (the `Literal` alone cannot: `cad_service`/`ai_service` bypass
  Pydantic) and asserts the digest is unchanged and no pset was created.
- **Regression guards.** `test_schema_compliance.py` 4/4 and `test_cad_and_clash.py` 2/2 green.
  The latter exercises `update_element_property` with `IfcLengthMeasure` / `IfcLabel` / `IfcReal`
  (and `pin_element` with `IfcBoolean`), so the allowlist is not too narrow for the app's own writes;
  `ai_service._exec_update_property` only ever infers `IfcBoolean`/`IfcInteger`/`IfcReal`/`IfcLabel`.
- **Read-path risk checked, not just assumed.** A `Literal` on `PropertySingle.value_type` also
  validates values *read* from a model, so every fixture was scanned for `NominalValue` types outside
  the allowlist (`backend/app/samples/*.ifc` and all `modelsfortests/*.ifc` under 40 MB, including
  the Revit ARC/MEP/STR and Duplex MEP files): **0 out-of-list types found**. If a user model ever
  carries one (e.g. `IfcMassDensityMeasure`), `GET /elements/{id}` would raise a response-validation
  error — widen `IFCValueType` when that happens, do not narrow the read path.
- **Deviation.** One extra test file entry (`test_service_boundary_rejects_non_value_types`) beyond
  the doc's list, for spec 3. `ValueError` → 422 was added only to the properties route; the
  placement route keeps its blanket 500 (out of this step's scope).
- **Cleanup.** The two pre-fix runs left exactly the orphan directories F-043 describes
  (`storage/projects/<uuid>/` with no row). Both were verified absent from the `projects` table and
  removed after the fix; the post-fix test asserts no new directory appears.
- **Not done, deliberately.** No `validate()` assertion was added to
  `backend/tests/test_schema_compliance.py` (the fixture suite another lane may touch); the new test
  file carries the assertion instead.
