# STEP-29 — Property Inspector edits must actually persist

**Status:** not started · **Wave:** A · **Effort:** 0.5 d
**Findings:** F-066 (new, discovered 2026-10-24 during audit reconciliation)
**Depends on:** — · **Blocks:** STEP-10 (undo for property edits presupposes edits work)

## Problem

Editing an existing property value in the Property Inspector **never saves**. The request is
malformed in two independent ways, so it cannot succeed, and the failure is swallowed into
`console.error`. The user types a new value, presses Enter, and nothing happens — no error, no
change, no persistence.

README feature 3 promises "In-place editing of property values (Boolean, Integer, Real, Label)
persisted directly to the active `.ifc` file". This is the most common inspector action and it
does not work.

## Evidence

`frontend/src/components/properties/GlassPropertyInspector.tsx:143-151` — the **edit** path:

```ts
const res = await fetch(`/api/projects/${projectId}/elements/${expressId}/properties`, {
  method: 'PATCH',                     // (1) the route is POST only  -> 405
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    pset_name: psetName,
    name: prop.name,                   // (2) the field is 'property_name' -> 422
    value: parsedValue
  })
});
if (!res.ok) throw new Error('Failed to save property edit');   // :153
// ...
} catch (err) { console.error('Failed to save property:', err); }  // :175-177  swallowed
```

`backend/app/api/projects.py:293` — the only route:

```python
@router.post("/{project_id}/elements/{express_id}/properties", status_code=status.HTTP_200_OK)
async def update_element_properties(project_id: str, express_id: int, payload: PropertyUpdatePayload) -> dict:
```

`backend/app/models/schemas.py:52-56`:

```python
class PropertyUpdatePayload(BaseModel):
    pset_name: str
    property_name: str          # required; 'name' is not accepted
    value: Any
    value_type: str = "IfcLabel"
```

**Proof that this is a regression, not a design choice:** the *add-property* path in the same
file is correct — `GlassPropertyInspector.tsx:196-205` uses `POST` + `property_name` +
`value_type` — and the older, now-unmounted `PropertyInspector.tsx:114-123` was also correct.

## Scope

**Change:**
- `frontend/src/components/properties/GlassPropertyInspector.tsx:143-151` — `POST`, `property_name`,
  and send `value_type` so numeric/boolean values are written with the right IFC measure.
- `frontend/src/components/properties/GlassPropertyInspector.tsx:175-177` — replace the
  `console.error` with a user-visible failure (inline row error + revert the optimistic value).

**Do not change:**
- `backend/app/api/projects.py:293` — the route is correct as written. The client is wrong.
- `backend/app/models/schemas.py:52-56` — do not add a `name` alias to accommodate the broken
  client; that would hide the next occurrence of this bug.

**Non-goals:**
- The duplicate element-details fetch in the same file (F-036) — that is STEP-14.
- Property *deletion*. It does not exist yet.
- Undo for property edits — STEP-10.

## Spec

1. The edit request is `POST /api/projects/{project_id}/elements/{express_id}/properties`.
2. The body is `{ pset_name, property_name, value, value_type }`, where `value_type` is carried
   over from the property being edited (`prop.value_type`).
3. `value` is coerced to the Python type implied by `value_type` **before** serialisation:
   `IfcBoolean` → bool, `IfcInteger` → int, `IfcReal` → float, otherwise string.
4. On a non-2xx response the local value is **reverted** and an inline error is shown against the
   edited row. The error must persist until the next edit attempt.
5. On success the row shows the persisted value and the inspector refreshes its data (via
   `onPropertyUpdated`, which is wired in STEP-14).
6. No request is sent when the value is unchanged.

## TDD

Canonical test:
[`tests/backend/test_step29_property_edit_persistence.py`](../tests/backend/test_step29_property_edit_persistence.py).

### 1. Add the failing test

```powershell
Copy-Item docs/audit-2026-10/tests/backend/test_step29_property_edit_persistence.py backend/tests/
```

Three assertions:

| Test | Asserts |
|---|---|
| `test_frontend_edit_request_matches_the_backend_contract` | every `fetch()` to `/properties` in the inspector uses `POST` and sends `property_name` |
| `test_property_edit_persists_to_the_model_file` | a correct payload reaches the API **and** lands in `model.ifc` (regression guard — passes today) |
| `test_property_edit_failure_is_not_swallowed` | a malformed payload returns 422, not 500 |

The contract test parses the call site so it cannot be fooled by a comment:

```python
for index, call in enumerate(calls):
    method = re.search(r"method:\s*'([A-Z]+)'", call)
    assert method.group(1) == "POST", (
        f"fetch call #{index} uses {method.group(1)} but the backend route is POST-only "
        f"(backend/app/api/projects.py:293) -> 405 Method Not Allowed"
    )
    body = re.search(r"body:\s*JSON\.stringify\(\s*\{(.*?)\}\s*\)", call, re.S)
    keys = set(re.findall(r"([A-Za-z_][A-Za-z0-9_]*)\s*:", body.group(1)))
    assert "property_name" in keys, f"body sends {sorted(keys)}; 'property_name' is required -> 422"
```

### 2. Watch it fail

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step29_property_edit_persistence.py -v
```

Verified failure (2026-10-24):

```
AssertionError: fetch call #0 uses PATCH but the backend route is POST-only
(backend/app/api/projects.py:293). The request will fail with 405 Method Not Allowed.

1 failed, 2 passed
```

The two passing tests confirm the backend is correct — this is purely a client defect.

### 3. Implement

```ts
const res = await fetch(`/api/projects/${projectId}/elements/${expressId}/properties`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    pset_name: psetName,
    property_name: prop.name,
    value: parsedValue,
    value_type: prop.value_type || 'IfcLabel',
  }),
});
if (!res.ok) {
  const detail = await res.json().catch(() => ({ detail: res.statusText }));
  setRowError(`${psetName}.${prop.name}: ${detail.detail ?? 'save failed'}`);  // not console.error
  setDetails(previousDetails);          // revert
  return;
}
```

Also fix the type coercion above the call — `parseInt(editValue, 10)` can yield `NaN`, which
serialises to `null` over JSON and silently writes nothing.

### 4. Watch it pass

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step29_property_edit_persistence.py -v
```

Expected: `3 passed`.

### 5. Regression guard

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/ -q
cd frontend; pnpm exec tsc -b --noEmit
```

`test_phase3.py` covers placement/property persistence on the backend and must stay green.

## Acceptance criteria

- [ ] The inspector's edit request is `POST` with `property_name`.
- [ ] A numeric edit changes the value in `model.ifc` (verified by reading the file, not the API).
- [ ] A boolean edit writes `IfcBoolean` with a real `True`/`False`, not the string `"true"`.
- [ ] A failed save shows a visible error against the row and reverts the displayed value.
- [ ] No `console.error`-only failure path remains in the two property write handlers.
- [ ] An unchanged value sends no request.

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| Sending `value_type` changes how existing values are stored | `value_type` already defaults to `IfcLabel` on the backend; the property being edited already carries its type | Revert the single file |
| The inspector is also mounted in a non-editable "review" state | Check `readOnly`/`isOpen` guards before the call; the same guard already exists at `:117` | — |

## Notes

- This was found during audit reconciliation, not in the original four-lane audit. The Property
  Inspector appeared "done" in the README and in the smoke tests because the *add*-property path
  works and returns 200.
- Add this class of bug to the QA harness: **assert the IFC entity, not the HTTP status.** A
  status-code-only test passes for a 200 that wrote nothing.
- While here, check `backend/app/api/projects.py:332` — a genuine `ValueError` (unknown element)
  is converted to a 500 rather than a 404.

### Implementation note (2026-10-25)

- **Done — client only.** The backend was not touched (route, schema and service unchanged, as
  scoped). `PATCH` and `name:` are gone from the frontend entirely; `grep -rn "method: 'PATCH'"
  frontend/src` now returns nothing.
- The request is no longer built inline. `frontend/src/services/propertyUpdate.ts` owns
  `buildPropertyUpdateRequest()` (POST + `property_name` + `value_type`),
  `coercePropertyValue()` (spec 3) and `isPropertyValueUnchanged()` (spec 6). The *add* path was
  routed through the same module because leaving a second hand-rolled body is how this bug
  happened in the first place; its behaviour on the wire is unchanged.
- Coercion throws `PropertyValueError` instead of producing `NaN`. `parseInt('abc')` used to
  serialise as `null` and write nothing, which is a silent success - bad input now shows
  "Expected a whole number for IfcInteger." against the row and sends no request.
- Failure path: optimistic value reverted, inline row error (`data-qa="property-row-error"`,
  `role="alert"`) that persists until the next edit attempt, editor stays open with the typed
  text. `console.error`-only branches are gone from both write handlers; `onSaveError` is exposed
  for hosts that show their own status line.
- Unchanged value: no request, editor closes silently.
- Value types: spec 3's trio (`IfcBoolean`/`IfcInteger`/`IfcReal`) is exact; the previous
  inspector's `*Measure` → float coercion was **kept** (see `REAL_VALUE_TYPES`), otherwise a
  length edit would be stored as the label `"3.5"`. Everything else stays a string.
- Test: `frontend/src/tests/step29.propertyEditPersistence.test.tsx` (12 tests) ports the upstream
  contract assertion (`test_frontend_edit_request_matches_the_backend_contract`) so the call-site
  guard runs in the frontend suite, plus coercion/payload tests and a jsdom test of the failure
  path. **Verified against the pre-fix source** (`git show HEAD:…GlassPropertyInspector.tsx`):
  the ported matcher reports `#0 method=PATCH … -> 405` and `missing property_name -> 422`,
  exactly the documented failure, and `#1` (the add path) already passed.
- Not done here (out of scope): `backend/app/api/projects.py:332` still maps an unknown element to
  500 instead of 404; undo for property edits (STEP-10).
