# STEP-22 — Openings must use the host wall's storey

**Status:** not started · **Wave:** C · **Effort:** 0.5 d
**Findings:** F-024 · **Depends on:** — · **Blocks:** —

## Problem

A door or window cut into a first-floor wall is filed under the **ground floor**. `create_opening` asks for "the first `IfcBuildingStorey` in the model" instead of asking which storey the wall is in, so every opening lands in storey index 0. The 3D result looks correct — the void is positioned off the wall's own placement — but the spatial tree, the storey-filtered schedule, the drawings plan cut and every downstream export place that door on the wrong floor. On a two-storey model, half the doors are mis-filed.

## Evidence

- `backend/app/services/cad_service.py:306` — `storey = cls._get_target_storey(model)` with no `storey_id`; `_get_target_storey` (`:67-91`) falls through to `storeys[0]` at `:75-77`.
- `backend/app/services/cad_service.py:368` — `ifcopenshell.api.run("spatial.assign_container", ..., relating_structure=storey, products=[filling])` — the filling is contained in that first storey.
- `backend/app/services/cad_service.py:310` — the wall's own placement *is* read (`get_local_placement(wall.ObjectPlacement)`), so the geometry is right; only the spatial filing is wrong. That is why the defect is invisible in the viewport.
- `backend/app/services/cad_service.py:343` — the opening is attached with `feature.add_feature`, which correctly needs no spatial containment; only the **filling** is mis-assigned. Do not "fix" the opening.
- `backend/app/models/schemas.py:205-213` — `CadOpeningRequest` has no `storey_id`, by design: the host wall must decide.
- Measured storey inventory of the fixtures (`ifcopenshell`):
  ```
  backend/app/samples/office_pavilion.ifc         IFC4   storeys: [(21,'Level 01 - Main Gallery',0.0)]
  backend/app/samples/duplex_residential.ifc      IFC4   storeys: [(21,'Level 01 - Ground Floor',0.0), (27,'Level 02 - First Floor',3.2)]
  modelsfortests/Ifc2x3_Duplex_Architecture.ifc   IFC2X3 storeys: [(39,'Level 1',0.0), (43,'Level 2',3.1), (47,'T/FDN',-1.25), (51,'Roof',6.0)]
  ```
  `office_pavilion` has one storey, which is exactly why the existing suite passes: `backend/tests/test_cad_and_clash.py:21` loads that sample and `:82-86` only checks `opening_express_id is not None`.

## Scope

**Change:**

- `backend/app/services/cad_service.py:302-312` — resolve the storey from the host wall, not from model order.
- `backend/app/services/cad_service.py:1-16` — add `import ifcopenshell.util.element`.

**Do not change:**

- `_get_target_storey` (`:67-91`) — it is correct for `create_wall`/`create_slab`/`create_column`, which take an explicit `storey_id`. Only the opening path stops calling it unconditionally.
- `CadOpeningRequest` (`backend/app/models/schemas.py:205-213`) — no new field.
- The opening↔wall relationship (`:343`, `:367`) — `IfcRelVoidsElement` / `IfcRelFillsElement` are correct.
- `create_wall`'s `storey_id` handling (`:119`).

**Non-goals:**

- Reassigning openings that are already mis-filed in existing projects. That needs a migration/report UI; state it in the handoff.
- Validating that the opening fits inside the host wall's height (see STEP-21 `## Notes`).
- Multi-storey walls (a wall spanning two storeys). Take the wall's own container and leave the edge case.

## Spec

1. The filling created by `POST /api/projects/{id}/cad/opening` is contained in the **host wall's** `IfcBuildingStorey`, resolved with `ifcopenshell.util.element.get_container(wall)`.
2. Two walls in two different storeys, each given an opening, produce two fillings in their respective storeys — and the storey is not necessarily `storeys[0]`.
3. If `get_container(wall)` is `None` or not an `IfcBuildingStorey` (a wall created without `assign_container`), the service falls back to `_get_target_storey(model)` and logs a `WARNING` naming the wall id. It does not raise.
4. If the model has no `IfcBuildingStorey` at all, existing behaviour is preserved (`_get_target_storey` creates one, `:82-91`).
5. The `IfcOpeningElement` is **not** added to any spatial container — `IfcRelVoidsElement` remains its only relation.
6. The response's `opening_express_id` and the filling's placement are unchanged by this step.

## TDD

### 1. Add the failing test

**File:** `backend/tests/test_step22_opening_storey.py`
**Command:** `.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step22_opening_storey.py -v`

<details>
```python
import sys
from pathlib import Path

import pytest
from starlette.testclient import TestClient

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.app.main import app
import ifcopenshell
import ifcopenshell.util.element

PROJECTS_DIR = Path(root_dir) / "storage" / "projects"


def _model_path(project_id: str) -> Path:
    return PROJECTS_DIR / project_id / "model.ifc"


def _storeys(project_id: str) -> dict[str, int]:
    model = ifcopenshell.open(str(_model_path(project_id)))
    return {s.Name: s.id() for s in model.by_type("IfcBuildingStorey")}


def _create_wall(client, project_id, storey_id, name):
    res = client.post(
        f"/api/projects/{project_id}/cad/wall",
        json={
            "start": [0.0, 0.0],
            "end": [4.0, 0.0],
            "elevation": 0.0,
            "height": 3.0,
            "thickness": 0.2,
            "storey_id": storey_id,
            "name": name,
        },
    )
    assert res.status_code == 200, res.text
    return res.json()


def _create_door(client, project_id, wall_id):
    res = client.post(
        f"/api/projects/{project_id}/cad/opening",
        json={
            "host_wall_id": wall_id,
            "opening_type": "door",
            "offset_along_wall": 1.0,
            "sill_height": 0.0,
            "width": 0.9,
            "height": 2.1,
        },
    )
    assert res.status_code == 200, res.text
    return res.json()


def _filling_of(project_id: str, opening_id: int):
    model = ifcopenshell.open(str(_model_path(project_id)))
    opening = model.by_id(opening_id)
    fillings = [
        rel.RelatedBuildingElement
        for rel in getattr(opening, "HasFillings", [])
        if rel.RelatedBuildingElement
    ]
    assert len(fillings) == 1, f"expected exactly one filling on #{opening_id}"
    return fillings[0], model


@pytest.fixture()
def two_storey_project():
    with TestClient(app) as client:
        load = client.post("/api/projects/samples/duplex_residential/load")
        assert load.status_code == 201, load.text
        project_id = load.json()["id"]
        client.put(f"/api/projects/{project_id}", json={"name": "AutoTest-step22-openings"})
        try:
            yield client, project_id
        finally:
            client.delete(f"/api/projects/{project_id}")


def test_opening_filling_uses_the_host_walls_storey(two_storey_project):
    """Spec 1, 2: a first-floor door belongs in the first floor."""
    client, project_id = two_storey_project
    storeys = _storeys(project_id)
    assert len(storeys) >= 2, storeys
    ground = storeys["Level 01 - Ground Floor"]
    upper = storeys["Level 02 - First Floor"]

    wall = _create_wall(client, project_id, upper, "AutoTest-step22-upper-wall")
    door = _create_door(client, project_id, wall["express_id"])

    filling, model = _filling_of(project_id, door["opening_express_id"])
    container = ifcopenshell.util.element.get_container(filling)

    assert container is not None, "filling has no spatial container"
    assert container.is_a("IfcBuildingStorey"), container.is_a()
    assert container.id() == upper, (
        f"door filed under {container.id()} ({container.Name}), "
        f"expected {upper} ({model.by_id(upper).Name}); ground floor is {ground}"
    )


def test_opening_storey_follows_each_wall(two_storey_project):
    """Spec 2: the two walls must not both land in storeys[0]."""
    client, project_id = two_storey_project
    storeys = _storeys(project_id)
    ground = storeys["Level 01 - Ground Floor"]
    upper = storeys["Level 02 - First Floor"]

    ground_wall = _create_wall(client, project_id, ground, "AutoTest-step22-ground-wall")
    upper_wall = _create_wall(client, project_id, upper, "AutoTest-step22-upper2-wall")

    ground_door = _create_door(client, project_id, ground_wall["express_id"])
    upper_door = _create_door(client, project_id, upper_wall["express_id"])

    ground_filling, _ = _filling_of(project_id, ground_door["opening_express_id"])
    upper_filling, _ = _filling_of(project_id, upper_door["opening_express_id"])

    assert ifcopenshell.util.element.get_container(ground_filling).id() == ground
    assert ifcopenshell.util.element.get_container(upper_filling).id() == upper
    assert ground != upper


def test_opening_is_not_spatially_contained(two_storey_project):
    """Spec 5: the void stays a feature of the wall, not a spatial member."""
    client, project_id = two_storey_project
    storeys = _storeys(project_id)
    wall = _create_wall(client, project_id, storeys["Level 02 - First Floor"], "AutoTest-step22-void-wall")
    door = _create_door(client, project_id, wall["express_id"])

    model = ifcopenshell.open(str(_model_path(project_id)))
    opening = model.by_id(door["opening_express_id"])
    containers = [
        rel.RelatingStructure.id()
        for rel in model.by_type("IfcRelContainedInSpatialStructure")
        for element in rel.RelatedElements
        if element.id() == opening.id()
    ]
    assert containers == [], f"opening was placed in a spatial container: {containers}"


def test_wall_without_container_falls_back(two_storey_project):
    """Spec 3: an uncontained wall must not raise; it falls back and warns."""
    client, project_id = two_storey_project
    storeys = _storeys(project_id)

    # Create a wall, then detach it from its storey to simulate an uncontained wall.
    wall = _create_wall(client, project_id, storeys["Level 02 - First Floor"], "AutoTest-step22-orphan-wall")
    path = _model_path(project_id)
    model = ifcopenshell.open(str(path))
    entity = model.by_id(wall["express_id"])
    for rel in list(model.by_type("IfcRelContainedInSpatialStructure")):
        if entity in rel.RelatedElements:
            remaining = [e for e in rel.RelatedElements if e.id() != entity.id()]
            if remaining:
                rel.RelatedElements = remaining
            else:
                model.remove(rel)
    model.write(str(path))

    door = _create_door(client, project_id, wall["express_id"])

    filling, model = _filling_of(project_id, door["opening_express_id"])
    container = ifcopenshell.util.element.get_container(filling)
    assert container is not None and container.is_a("IfcBuildingStorey"), (
        "fallback did not assign a storey"
    )
```
</details>

### 2. Watch it fail

```
$ .\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step22_opening_storey.py -v
FAILED backend/tests/test_step22_opening_storey.py::test_opening_filling_uses_the_host_walls_storey
  E   AssertionError: door filed under 21 (Level 01 - Ground Floor),
      expected 27 (Level 02 - First Floor); ground floor is 21
  E   assert 21 == 27
FAILED backend/tests/test_step22_opening_storey.py::test_opening_storey_follows_each_wall
  E   assert 21 == 27
PASSED backend/tests/test_step22_opening_storey.py::test_opening_is_not_spatially_contained
PASSED backend/tests/test_step22_opening_storey.py::test_wall_without_container_falls_back
```

`test_opening_is_not_spatially_contained` and `test_wall_without_container_falls_back` pass before the change — they are the guards that stop the fix from over-reaching.

### 3. Implement

1. `backend/app/services/cad_service.py:1-16` — add `import ifcopenshell.util.element` beside `ifcopenshell.util.placement` (`:14`).
2. `backend/app/services/cad_service.py:302-306` — after the host-wall lookup, replace
   ```python
   storey = cls._get_target_storey(model)
   ```
   with
   ```python
   host_storey = ifcopenshell.util.element.get_container(wall)
   if host_storey is not None and host_storey.is_a("IfcBuildingStorey"):
       storey = host_storey
   else:
       logger.warning(
           "Host wall #%d has no IfcBuildingStorey container; falling back to the "
           "first storey in the model.", wall.id(),
       )
       storey = cls._get_target_storey(model)
   ```
3. Leave `:368` unchanged — it now receives the right storey.
4. Confirm nothing else in `create_opening` reads `storey` for geometry. It does not: the opening and filling placements come from `wall_mat` at `:336-341` and `:364-366`.

### 4. Watch it pass

```
$ .\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step22_opening_storey.py -v
PASSED backend/tests/test_step22_opening_storey.py::test_opening_filling_uses_the_host_walls_storey
PASSED backend/tests/test_step22_opening_storey.py::test_opening_storey_follows_each_wall
PASSED backend/tests/test_step22_opening_storey.py::test_opening_is_not_spatially_contained
PASSED backend/tests/test_step22_opening_storey.py::test_wall_without_container_falls_back
4 passed
```

### 5. Regression guard

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_cad_and_clash.py -v
.\backend\venv\Scripts\python.exe -m pytest backend/tests/ -q
cd frontend; pnpm exec tsc -b --noEmit
```

`backend/tests/test_cad_and_clash.py:72-86` creates an opening on a wall created with the **default** `storey_id` (i.e. `storeys[0]`); the host wall is in `storeys[0]`, so the new code resolves to the same storey and the test stays green. If it goes red, the fallback branch is wrong.

## Acceptance criteria

- [ ] A door cut into a `Level 02 - First Floor` wall has its `IfcDoor` contained in the Level-02 storey.
- [ ] Two walls in two storeys produce fillings in two different storeys.
- [ ] The `IfcOpeningElement` has no `IfcRelContainedInSpatialStructure`.
- [ ] An uncontained host wall falls back without raising and logs a warning.
- [ ] `test_cad_and_clash.py` and the full backend suite show no new failures.

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| `get_container` returns an `IfcBuilding` for walls contained directly in a building | The `is_a("IfcBuildingStorey")` guard sends that case to the fallback, which is at least a storey | N/A |
| A wall in a *different* storey than expected still yields a plausible-looking result | The test asserts the concrete storey id from `IfcBuildingStorey`, not "some storey" | N/A |
| Existing projects keep their mis-filed openings, so the UI still shows old data | Nothing is migrated; the defect is fixed forward only. State this in `DEVELOPMENT_HANDOFF.md` | N/A |
| The warning log fires on every opening for every legacy uncontained wall | It is one `WARNING` per call and names the wall id, which is the diagnostic the user needs | Drop to `INFO` |

## Notes

- **Do not touch `_get_target_storey`.** It is the correct helper for the three creation paths that take an explicit `storey_id`, and three other call sites depend on the `storeys[0]` default (`:119`, `:179`, `:241`, `:710`). Changing its default is a different, wider behavioural change.
- **A pre-existing data problem, not a code problem:** any project already containing openings will keep them on level 0 forever. If the product needs a repair, it is a one-off script that walks `IfcRelFillsElement` and re-contains each filling in `get_container(host_wall)` — a good candidate for STEP-26's hygiene pass, not for this step.
- **Not verified:** F-024 is `[L]` in `FINDINGS.md`. The storey inventories in `## Evidence` were read from the fixtures during this documentation pass; the opening endpoint was not exercised.

### Implementation notes - 2026-10-25

- **Status:** done. `backend/tests/test_step22_opening_storey.py` went `2 failed, 2 passed` (both
  failures exactly `assert 21 == 27`) → `4 passed`. Only `backend/app/services/cad_service.py`
  changed: `import ifcopenshell.util.element` beside `ifcopenshell.util.placement`, and the storey
  resolution in `create_opening` now reads `ifcopenshell.util.element.get_container(wall)` and
  falls back to `_get_target_storey(model)` with a `WARNING` that names the wall id when the
  container is `None` or is not an `IfcBuildingStorey`. Nothing raises on that path;
  `_get_target_storey` itself is untouched, as are `CadOpeningRequest`, the
  `IfcRelVoidsElement` / `IfcRelFillsElement` relations and every placement computation.
- **Verified beyond the suite:** the two-storey `duplex_residential` sample files the ground-floor
  door in `Level 01 - Ground Floor` (#21) and the first-floor door in `Level 02 - First Floor`
  (#27); the `IfcOpeningElement` still has no `IfcRelContainedInSpatialStructure`; a wall detached
  from its storey (the test's simulation of a legacy uncontained wall) still produces a filling in
  a storey and logs
  `Host wall #NNN has no IfcBuildingStorey container; falling back to the first storey in the model.`
- **Test-file deviation (no assertion weakened):** `test_opening_storey_follows_each_wall` as
  written in the TDD block **crashes the interpreter** (`Windows fatal exception: access
  violation`) on this toolchain: it unpacks `_filling_of(...)` into `ground_filling, _` and then
  rebinds `_` on the second call, which drops the first `IfcOpenShell` model while
  `ground_filling` still points into it. The two models are now bound to named variables with a
  comment. Anything else written against this API should do the same.
- **Not migrated:** openings in existing projects stay wherever they already are. A repair is the
  one-off walk described in `## Notes` above; the handoff fragment flags it.
- **Regression state:** final `pytest backend/tests -q` → **53 passed, 0 failed** (an earlier run
  overlapped the concurrent STEP-01 lane and reported
  `test_step01_ai_transform_units.py::test_transform_is_recorded_as_an_audit_entry`,
  `sqlite3.IntegrityError: FOREIGN KEY constraint failed` in `ProjectService.record_edit`; that file
  passes 4/4 in isolation, so it was shared-`storage/projects.db` contention, not this step).
  `test_cad_and_clash.py` 2/2 green.

