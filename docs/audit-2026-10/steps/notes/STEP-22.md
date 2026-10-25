# STEP-22 — handoff fragments (backend lane, 2026-10-25)

Scope owned by this lane: the storey resolution inside `create_opening` in
`backend/app/services/cad_service.py`.

**Not** owned (deferred, listed below): existing-project data repair, opening/host-wall geometric
validation (STEP-21 / STEP-10), `frontend/**`.

---

## 2026-10-25 - Landed: door/window fillings are filed under the host wall's storey

- **Type:** Bug
- **Platform:** http://localhost:5173 (backend `POST /api/projects/{id}/cad/opening`)
- **Related tests:** TC-030, TC-031
- **Severity:** P1
- **Observed:** `create_opening` used `_get_target_storey(model)` with no id, which returns
  `IfcBuildingStorey[0]`. Every filling therefore landed on the ground floor regardless of the host
  wall — invisible in the viewport (the void is placed off the wall's own placement), wrong in the
  spatial tree, storey-filtered schedules, plan cuts and exports. On a two-storey model half the
  doors were mis-filed.
- **Expected / delivered:** `storey = ifcopenshell.util.element.get_container(wall)` when it is an
  `IfcBuildingStorey`, else `_get_target_storey(model)` plus a `WARNING` naming the wall id. The
  `IfcOpeningElement` still has no spatial container (`IfcRelVoidsElement` remains its only
  relation), and the opening/filling placements are unchanged.
- **Evidence:** `backend/tests/test_step22_opening_storey.py` — 2 failed (`assert 21 == 27`) before,
  `4 passed` after. Verified the two-storey `duplex_residential` sample files the ground-floor and
  first-floor doors in #21 and #27 respectively.
- **Suggested fix:** n/a
- **Status:** Implemented

---

## 2026-10-25 - Existing projects keep their mis-filed openings (no migration)

- **Type:** Bug
- **Platform:** http://localhost:5173
- **Related tests:** TC-030, TC-031
- **Severity:** P1
- **Observed:** The fix is forward-only. Any project saved before it still has every `IfcDoor` /
  `IfcWindow` contained in `storeys[0]`; opening it today shows the same wrong spatial tree and the
  same wrong schedules, with no indication that the data (not the code) is stale.
- **Expected:** Either a repair pass or a visible diagnostic. The repair is mechanical: for each
  `IfcRelFillsElement`, re-contain the filling in
  `ifcopenshell.util.element.get_container(host_wall)` when that is an `IfcBuildingStorey`.
- **Evidence:** step document `## Notes` (second bullet); the step test only creates new openings.
- **Suggested fix:** one-off script (idempotent, dry-run first, `.bak` of `model.ifc`) added to the
  STEP-26 hygiene pass, or a `POST /cad/repair-containers` endpoint surfaced as a project action.
  Do not run it silently on open — it rewrites user files.
- **Status:** Open

---

## 2026-10-25 - Testability: an `IfcOpenShell` entity dangles when its model is garbage collected

- **Type:** Testability
- **Platform:** http://localhost:5173
- **Related tests:** TC-031
- **Severity:** P2
- **Observed:** The step document's `test_opening_storey_follows_each_wall` **kills the interpreter**
  (`Windows fatal exception: access violation` in
  `ifcopenshell/entity_instance.py:102 __getattr__` via `util.element.get_container`): it unpacks
  `ground_filling, _ = _filling_of(...)` and then rebinds `_` on the second call, which drops the
  first model while `ground_filling` still references it. Re-running the same file "randomly"
  aborts the whole pytest process, so any future copy of that pattern looks like a crash, not a
  test failure.
- **Expected:** Tests keep every model alive for as long as they hold an entity from it.
- **Evidence:** reproduced twice; fixed in `backend/tests/test_step22_opening_storey.py` by binding
  both models to named variables (`ground_model`, `upper_model`) with an explanatory comment.
- **Suggested fix:** a `conftest.py` fixture that opens a project model and yields
  `(model, entity_by_id)` for the duration of the test, so the lifetime is explicit; optionally a
  helper that asserts a model is still open before an entity is used.
- **Status:** Open (documented in the step file; the test itself is fixed)

---

## 2026-10-25 - `get_container` can return an `IfcBuilding` for a wall contained directly in the building

- **Type:** Bug
- **Platform:** http://localhost:5173
- **Related tests:** TC-030
- **Severity:** P3
- **Observed:** A wall assigned straight to the building (`spatial.assign_container` with an
  `IfcBuilding`) resolves to that building, which the `is_a("IfcBuildingStorey")` guard sends to the
  fallback. The filling then lands in `storeys[0]`, which is usually right but can be wrong for a
  building whose first storey is a basement.
- **Expected:** Either accept the fallback (documented) or resolve the nearest storey ancestor /
  nearest storey by `Elevation`.
- **Evidence:** step document `## Risks and rollback` (first row); no fixture exercises it.
- **Suggested fix:** only if a customer model shows the symptom — match `elevation` against the
  `IfcBuildingStorey` list before falling back to `storeys[0]`.
- **Status:** Open
