## 2026-10-25 - Property Inspector inline edit never persisted (PATCH + `name`)

- **Type:** Bug
- **Platform:** http://localhost:5173
- **Related tests:** TC property-edit (STEP-29 / F-066); `frontend/src/tests/step29.propertyEditPersistence.test.tsx`
- **Severity:** P1
- **Observed:** Editing an existing property value and pressing Enter/✓ did nothing. The request was
  `PATCH /api/projects/{id}/elements/{n}/properties` with `{ pset_name, name, value }`, so the
  POST-only route answered **405** and, even with the right verb, `property_name` was missing
  (**422**). The failure was swallowed into `console.error`, so the user saw no error and no change.
- **Expected:** `POST` with `{ pset_name, property_name, value, value_type }`, value coerced to the
  property's IFC measure type; visible inline error + reverted value on failure; no request when the
  value is unchanged.
- **Evidence:** Ported contract assertion run against the pre-fix source
  (`git show HEAD:frontend/src/components/properties/GlassPropertyInspector.tsx`) reports
  `#0 method=PATCH … -> 405` and `missing property_name … -> 422`, while the add-property call `#1`
  already emitted `POST` + `property_name` + `value_type`.
- **Suggested fix (implemented in this lane):**
  - `frontend/src/services/propertyUpdate.ts` (new): `buildPropertyUpdateRequest()` returns
    `{ url, method: 'POST', body }` for the one backend route; `coercePropertyValue()` maps
    `IfcBoolean`→bool, `IfcInteger`→int, `IfcReal`/`*Measure`→float, else string, and **throws**
    `PropertyValueError` instead of emitting `NaN` (which serialised to `null` and wrote nothing);
    `isPropertyValueUnchanged()` gates the request.
  - `frontend/src/services/api.ts`: added `updateElementProperty(projectId, expressId, payload)`
    (POST, `value_type` default `IfcLabel`, throws with the backend `detail` text).
  - `GlassPropertyInspector.tsx`: edit path now uses the builder + `api.updateElementProperty`;
    optimistic value with revert on failure; inline `role="alert"` row error
    (`data-qa="property-row-error"`) that persists until the next edit attempt; editor stays open
    with the typed text; no request when the value is unchanged; the add-property path uses the same
    API helper, so there is no second hand-rolled body left to drift.
  - The two `console.error`-only write failure paths are gone.
- **Status:** Fixed in the frontend lane, tests green (12/12 for STEP-29). App-level refresh still
  needs the `onPropertyUpdated` wiring in `App.tsx` (see `notes/STEP-14.md`) so the audit timeline
  updates without a reload.
- **Follow-ups not in this lane:**
  - Backend `backend/app/api/projects.py:332` — unknown element raises `ValueError` and becomes a
    500 rather than a 404.
  - QA harness: assert the IFC entity, not the HTTP status. A 200 that wrote nothing passes today.
  - `value_type` coercion for exotic measures and `OwnerHistory` are STEP-18.
