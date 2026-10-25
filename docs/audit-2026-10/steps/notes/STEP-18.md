# STEP-18 — handoff fragments (backend lane, 2026-10-25)

Scope owned by this lane: `backend/app/models/schemas.py`,
`backend/app/services/ifc_service.py`, `backend/app/services/project_service.py`,
`backend/app/api/projects.py` (ValueError → 422 only),
`backend/tests/test_step18_ifc_schema_validity.py`.

**Decision taken for the step's open question — option (A): add `OwnerHistory`, do not upgrade the
schema.** Created IFC2X3 `IfcPropertySet` / `IfcRelDefinesByProperties` reuse the model's existing
`IfcOwnerHistory` (one is created only when the model has none). IFC4 / IFC4X3 psets are left
untouched because the attribute is `optional()` in those schemas — the write is gated on
*mandatory*, not merely *present*. No `GlobalId`, express id or representation is rewritten, so the
user's contractual model stays `StepId`-stable.

Status of the four findings: all four are implemented **backend-only** and covered by the new test
file. Nothing here needed the frontend.

---

## 2026-10-25 - `value_type` was used as an entity class name, so a property edit could nest an `IfcWall`

- **Type:** Bug
- **Platform:** http://localhost:8000 (`POST /api/projects/{id}/elements/{eid}/properties`)
- **Related tests:** `backend/tests/test_step18_ifc_schema_validity.py::test_non_value_entity_cannot_be_a_value_type`,
  `::test_service_boundary_rejects_non_value_types` (finding F-014)
- **Severity:** P1
- **Observed:** `PropertyUpdatePayload.value_type` was a free `str` and `IFCService.update_element_property`
  passed it straight to `model.create_entity(prop_type, prop_val)` as a **class name**. `"IfcWall"`
  returned `200 {"status":"success"}` and nested `IfcWall('x',$,$,$,$,$,$,$)` inside
  `IfcPropertySingleValue.NominalValue` — an entity where the schema requires an `IfcValue`, plus a
  bogus `GlobalId`. Strict receivers reject the file.
- **Expected:** Spec 2 and 4 — an entity name is refused with `422`, the file is unchanged, and no
  `IfcPropertySingleValue` anywhere contains an `IfcWall`.
- **Evidence:** pre-fix `assert res.status_code == 422` failed with
  `AssertionError: {"status":"success","express_id":5399,"updated":true}` and `assert 200 == 422`;
  post-fix the request is 422, the sha256 digest of `model.ifc` is unchanged, and re-opening the model
  finds no nested entity.
- **Suggested fix (delivered):** `IFCValueType` Literal on `PropertySingle.value_type` and
  `PropertyUpdatePayload.value_type` (HTTP boundary) **plus** `IFC_VALUE_TYPES` +
  `is_value_type_declaration(model, name)` in `ifc_service.py` (service boundary, because
  `cad_service` / `ai_service` call the service directly and never validate).
- **Status:** Implemented (backend)

---

## 2026-10-25 - `IfcBoolean` + `"true"` reported success and wrote `$`; mismatched types returned 500

- **Type:** Bug
- **Platform:** http://localhost:8000 (`POST …/elements/{eid}/properties`)
- **Related tests:** `::test_boolean_string_is_coerced_not_dropped`, `::test_numeric_string_is_coerced_for_measures`,
  `::test_uncoercible_values_are_rejected_without_writing` (finding F-064)
- **Severity:** P0
- **Observed:** The client value was handed to `create_entity` uncoerced. Measured pre-fix:
  `"true"` / `IfcBoolean` → `200`, stored `IfcBoolean($)` (`wrappedValue is None`) — the panel said
  saved and the exported model had no value; `"12.5"` / `IfcLengthMeasure` →
  `500 {"detail":"Failed to update property for #5399: Attribute not set"}`; `3.7` / `IfcInteger`
  likewise 500; `-2.5` / `IfcPositiveLengthMeasure`, `1.5` / `IfcNormalisedRatioMeasure` and
  `null` / `IfcLabel` all returned **200** and wrote an invalid value.
- **Expected:** Spec 5 and 6 — coerce by family (`str`, `int`, `float`, a *real* `bool`), enforce
  `IfcPositive* > 0` and `IfcNormalisedRatioMeasure ∈ [0,1]`, and reject the rest with `422` naming
  the property and the expected Python type, leaving `model.ifc` byte-identical.
- **Evidence:** post-fix `Boolean string is coerced`: `NominalValue.is_a() == "IfcBoolean"` and
  `wrappedValue is True`; `"12.5"` → `wrappedValue == 12.5`; all five bad-value parametrisations
  return 422 with the digest unchanged. Whole file: `12 passed in 25.74s`.
- **Suggested fix (delivered):** `_coerce_value(prop_type, value, prop_name)` above `class IFCService`
  with the four family branches plus the two range constraints and a non-finite guard; the service now
  validates → coerces → *then* creates the value entity and the pset, so nothing is written on the
  failure path. `api/projects.py` maps `ValueError` to 422 (snapshot discarded) and leaves every other
  exception at 500.
- **Status:** Implemented (backend)

---

## 2026-10-25 - Every new IFC2X3 property set failed `ifcopenshell.validate` with two schema errors

- **Type:** Bug
- **Platform:** http://localhost:8000 (`POST …/elements/{eid}/properties`)
- **Related tests:** `::test_ifc2x3_pset_creation_is_schema_valid`,
  `::test_ifc4_property_write_adds_no_validation_errors` (finding F-015)
- **Severity:** P1
- **Observed:** New `IfcPropertySet` and `IfcRelDefinesByProperties` entities were created with
  `GlobalId` only. On an IFC2X3 file one property write produced
  `statements: 2` — `Attribute not optional | IfcPropertySet.OwnerHistory` and the same for
  `IfcRelDefinesByProperties` — from a baseline of 0. A model edited in this app could not be
  validated by a strict receiver.
- **Expected:** Spec 7 and 8 — a newly created IFC2X3 pset/rel carries a non-null `OwnerHistory`, and
  a property write adds **zero** validation statements vs the pre-write baseline.
- **Evidence:** post-fix `baseline == 0` → after write `0` statements; the IFC4 test holds its
  pre-existing baseline of 1 (`IfcOwnerHistory.CorrectChangeAction`, untouched) → after write still 1.
- **Suggested fix (delivered):** `_owner_history_is_mandatory(model, entity)` (checks
  `attribute.optional()` via `ifcopenshell.ifcopenshell_wrapper.schema_by_name(model.schema)`),
  `_ensure_owner_history(model)` (reuses `model.by_type("IfcOwnerHistory")[0]`, creating
  `IfcPerson` / `IfcOrganization` / `IfcPersonAndOrganization` / `IfcApplication` + `IfcOwnerHistory`
  only when the model has none — mirroring `create_blank_project`), and `_owner_history_kwargs(...)`
  spread into `create_entity`. Reused psets are never touched.
- **Status:** Implemented (backend, option A). Option B (upgrade the model to IFC4) remains a
  separate decision with a backup requirement — it is **not** implemented.

---

## 2026-10-25 - `schema_version: "IFC9"` returned 500 and left an orphan directory in storage

- **Type:** Bug
- **Platform:** http://localhost:8000 (`POST /api/projects`)
- **Related tests:** `::test_invalid_schema_version_creates_nothing` (finding F-043)
- **Severity:** P2
- **Observed:** `ProjectCreate.schema_version` was an unconstrained `str` and
  `ProjectService.create_project` ran `project_dir.mkdir(parents=True, exist_ok=True)` **before**
  `IFCService.create_blank_project`, so `ifcopenshell.file(schema="IFC9")` raised
  `RuntimeError: No schema named IFC9` after the directory existed and no `projects` row did. Every
  bad request left another empty folder under `storage/projects/`.
- **Expected:** Spec 1 — `422` at request validation, no new directory, no new row.
- **Evidence:** pre-fix `assert 500 == 422` plus an empty `<uuid>/` directory that the failing request
  created (two such orphans were produced by the two pre-fix runs of this lane, verified absent from
  the `projects` table, then removed). Post-fix the test asserts both the id set and the directory set
  are unchanged.
- **Suggested fix (delivered):** `SchemaVersion = Literal["IFC2X3","IFC4","IFC4X3"]` on
  `ProjectCreate.schema_version`; `ALLOWED_SCHEMA_VERSIONS` re-checked at the top of
  `create_project` **before** `mkdir`; the rest of the body wrapped in `try/except` with
  `shutil.rmtree(project_dir, ignore_errors=True)` before re-raising. The value mismatch is raised as
  `ValueError` so a direct service caller gets a clean error instead of an ifcopenshell `RuntimeError`.
- **Status:** Implemented (backend)

---

## 2026-10-25 - Read-path risk of the `value_type` Literal was measured, not assumed

- **Type:** Testability
- **Platform:** http://localhost:8000 (`GET …/elements/{eid}`)
- **Related tests:** n/a (a scan, not a test)
- **Severity:** P3
- **Observed:** `PropertySingle` is also a **response** model and `get_element_details` fills
  `value_type` from `prop.NominalValue.is_a()`. Constraining it to a `Literal` therefore validates
  data already in the file; an unlisted select member would turn a property read into a
  response-validation error.
- **Expected:** The allowlist must cover every `NominalValue` type the repo's own models contain.
- **Evidence:** scanned `backend/app/samples/*.ifc` and all `modelsfortests/*.ifc` under 40 MB
  (including Revit ARC/MEP/STR and the Duplex MEP files): **0** `IfcPropertySingleValue` nominal types
  outside `IFC_VALUE_TYPES`.
- **Suggested fix:** if a user model ever carries e.g. `IfcMassDensityMeasure`, add it to
  `IFCValueType` **and** `IFC_VALUE_TYPES` — do not weaken `PropertySingle.value_type` back to `str`,
  and do not add coercion logic for it.
- **Status:** Open (monitoring). No code change pending.

---

## 2026-10-25 - Only this lane's test files plus the two named guards were executed

- **Type:** Testability
- **Platform:** http://localhost:8000
- **Related tests:** `test_step18_ifc_schema_validity.py`, `test_schema_compliance.py`,
  `test_cad_and_clash.py`
- **Severity:** P3
- **Observed:** `pytest backend/tests` was deliberately **not** run repo-wide: other lanes are editing
  `cad_service.py` / `projects.py` and concurrent pytest runs contend on the shared
  `storage/projects.db`.
- **Expected:** the full suite green at the integration gate, especially
  `test_step29_property_edit_persistence.py` (same endpoint), `test_step21_wall_resize.py` and
  `test_step22_opening_storey.py` (call `update_element_property` with `IfcLengthMeasure`).
- **Evidence:** `24 passed` for the three step files + the two guards in one run
  (`test_schema_compliance.py` 4/4, `test_cad_and_clash.py` 2/2).
- **Suggested fix:** run `.\backend\venv\Scripts\python.exe -m pytest backend/tests -q` once the
  parallel lanes settle.
- **Status:** Open
