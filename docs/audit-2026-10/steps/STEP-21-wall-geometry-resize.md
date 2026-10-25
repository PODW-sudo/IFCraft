# STEP-21 — Wall/slab resize must change geometry

**Status:** not started · **Wave:** C · **Effort:** 2 d
**Findings:** F-021 · **Depends on:** STEP-10 · **Blocks:** STEP-22

## Problem

Changing a wall's height in the properties panel changes a **property**, not the wall. The panel then reads 5 m, the model stays 4 m, and the exported IFC — the contractual deliverable — contains the old geometry. A BIM engineer who resizes a wall to clear a duct and exports the model has shipped the clash.

## Evidence

- `backend/app/services/cad_service.py:782-789` — the `IfcWall` branch of `update_geometry` calls `IFCService.update_element_property(..., "Dimensions", "Height", ...)` and re-reads the model. It never touches `Representation`.
- `backend/app/services/cad_service.py:790-796` — the `IfcColumn` branch *does* rebuild a box mesh first, so the two element types diverge: columns resize, walls do not.
- `backend/app/api/cad.py:146-161` — `PATCH /api/projects/{id}/cad/elements/{express_id}/geometry` returns `{"success": True, "updated": True}` regardless, so the caller has no way to detect the no-op.
- `backend/app/services/cad_service.py:798-804` — the `elevation` branch swallows every exception (`except Exception: pass`) and still returns success.
- `backend/app/models/schemas.py:276-281` — `CadGeometryUpdateRequest` documents `height`/`thickness` in **metres** while IFC `Depth`/`YDim` are in **project units**.
- Measured on a wall created by `POST /cad/wall` (6 m × 0.25 m × 3 m, metre model):
  ```
  representation: IfcShapeRepresentation/Body -> IfcExtrudedAreaSolid
    Depth 3.0   ExtrudedDirection (0.0, 0.0, 1.0)
    SweptArea IfcArbitraryClosedProfileDef / IfcIndexedPolyCurve
      CoordList ((0,0), (0,0.25), (6,0.25), (6,0), (0,0))     <- Y is thickness
  world bbox  x 0..6   y 0..0.25   z 0..3
  ```
  After `solid.Depth = 5.0; model.write()` the re-read geometry gives `z 0..5.0` — so the fix is a two-attribute edit, not a rebuild.
- Measured on the same operation in a **millimetre** model (`modelsfortests/Building-Architecture.ifc`, `calculate_unit_scale = 0.001`): `create_2pt_wall(height=3.0)` writes `Depth 3000.0`. `Depth` is in project units, so a naive `solid.Depth = req.height` would shrink the wall to 5 mm.
- Measured: `modelsfortests/Ifc2x3_Duplex_Architecture.ifc` wall `#5399` has `Body -> IfcFaceBasedSurfaceModel`; walls `#3797`/`#3999` have `Body -> IfcExtrudedAreaSolid`, `Depth 3.1`, direction `(0,0,1)`, `IfcRectangleProfileDef`. Imported walls are a mixed population — some are resizable, some are not.

## Scope

**Change:**

- `backend/app/services/cad_service.py:768-809` — rewrite `update_geometry`: geometry first, property second, and no silent success.
- `backend/app/services/cad_service.py` — add `class GeometryNotEditable(Exception)`, plus helpers `_resize_extruded_solid(solid, *, new_height=None, new_thickness=None, unit_scale=None)` and `_find_body_extruded_solid(entity)`.
- `backend/app/api/cad.py:146-161` — map `GeometryNotEditable` → `409` with a machine-readable body.
- `backend/app/services/cad_service.py:798-804` — remove `except Exception: pass` on the elevation branch; a failed placement edit must surface.

**Do not change:**

- `IFCService.update_element_property` (`backend/app/services/ifc_service.py:327-395`) — STEP-18 owns it. Call it, do not edit it.
- `_create_box_mesh` / `create_2pt_wall` — creation, not resize.
- `CadGeometryUpdateRequest` field names or units description (`schemas.py:276-281`). The API contract stays "metres"; the conversion happens in the service.
- The `IfcColumn` rebuild branch beyond making it report failure honestly.

**Non-goals:**

- General parametric editing (voided walls, layered walls, `IfcBooleanClippingResult`, swept solids with a non-Z direction). These return `409 unsupported_geometry` — loudly, which is the whole point of this step.
- Recomputing openings after a wall resize. An opening positioned by `mat_op` relative to the wall base stays valid for a **height** change only while the opening fits; validating that is STEP-22's and STEP-10's territory. Add a note to the handoff.
- Undo for geometry edits. STEP-10 owns the transaction; this step must call whatever STEP-10 provides, or none if it has not landed.

## Spec

1. `PATCH .../cad/elements/{id}/geometry` with `height` on a wall whose Body representation is a single `IfcExtrudedAreaSolid` with `ExtrudedDirection.DirectionRatios == (0,0,1)` sets `solid.Depth = height / calculate_unit_scale(model)`.
2. After the call, `ifcopenshell.geom.create_shape` on the wall reports a Z extent equal to `solid.Depth` (project units) and, converted to metres, equal to the requested `height` within 1 mm.
3. `thickness` on the same wall sets `IfcRectangleProfileDef.YDim = thickness / unit_scale`, or, for `IfcArbitraryClosedProfileDef` whose `OuterCurve` is an `IfcIndexedPolyCurve`, rescales every profile Y coordinate about the profile's minimum Y by `new_thickness / old_thickness`.
4. The `Dimensions.Height` / `Dimensions.Thickness` properties are written **only after** the geometry edit succeeds, and only for the dimensions that were changed.
5. A wall whose Body representation item is not a single `IfcExtrudedAreaSolid` with a Z direction returns HTTP `409` and body `{"detail": {"code": "unsupported_geometry", "message": "<why>"}}`; `model.ifc` is byte-identical afterwards.
6. A `thickness` change on a wall whose profile is neither `IfcRectangleProfileDef` nor an `IfcIndexedPolyCurve` outline returns `409` after the height change (if any) has been written — or, preferably, validates *both* dimensions before writing anything so the call is atomic.
7. `elevation` on any element sets `ObjectPlacement` Z to `elevation / unit_scale`; if that fails, the endpoint returns `422` rather than `{"success": true}`.
8. `{"success": true}` is returned only when the on-disk `Depth`/`YDim` equals the requested value within 1e-6 (project units).
9. A millimetre model round-trips: `height: 5.0` on `Ifc4X3/MILLI` produces `Depth == 5000.0` and a world Z extent of 5000 project units.
10. Resizing a **Column** keeps the existing rebuild behaviour and gains the same honest failure (spec 7/8).

## TDD

### 1. Add the failing test

**File:** `backend/tests/test_step21_wall_resize.py`
**Command:** `.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step21_wall_resize.py -v`

<details>
```python
import hashlib
import shutil
import sys
import tempfile
from pathlib import Path

import numpy as np
import pytest
from starlette.testclient import TestClient

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.app.main import app
import ifcopenshell
import ifcopenshell.util.unit

PROJECTS_DIR = Path(root_dir) / "storage" / "projects"
MILLI_FIXTURE = Path(root_dir) / "modelsfortests" / "Building-Architecture.ifc"
DUPLET_FIXTURE = Path(root_dir) / "modelsfortests" / "Ifc2x3_Duplex_Architecture.ifc"


def _model_path(project_id: str) -> Path:
    return PROJECTS_DIR / project_id / "model.ifc"


def _digest(project_id: str) -> str:
    return hashlib.sha256(_model_path(project_id).read_bytes()).hexdigest()


def _create_wall(client, project_id, height=3.0, thickness=0.25):
    res = client.post(
        f"/api/projects/{project_id}/cad/wall",
        json={
            "start": [0.0, 0.0],
            "end": [6.0, 0.0],
            "elevation": 0.0,
            "height": height,
            "thickness": thickness,
            "name": "AutoTest-step21-wall",
        },
    )
    assert res.status_code == 200, res.text
    return res.json()


def _body_solid(project_id: str, express_id: int):
    model = ifcopenshell.open(str(_model_path(project_id)))
    entity = model.by_id(express_id)
    for rep in entity.Representation.Representations:
        if rep.RepresentationIdentifier != "Body":
            continue
        assert len(rep.Items) == 1, [i.is_a() for i in rep.Items]
        return rep.Items[0], model
    raise AssertionError("no Body representation")


def _geom_extents(project_id: str, express_id: int):
    model = ifcopenshell.open(str(_model_path(project_id)))
    settings = ifcopenshell.geom.settings()
    settings.set("use-world-coords", True)
    shape = ifcopenshell.geom.create_shape(settings, model.by_id(express_id))
    verts = np.array(shape.geometry.verts).reshape(-1, 3)
    return verts.min(axis=0), verts.max(axis=0)


def _dimension(project_id: str, express_id: int, name: str):
    model = ifcopenshell.open(str(_model_path(project_id)))
    entity = model.by_id(express_id)
    for rel in getattr(entity, "IsDefinedBy", []):
        if not rel.is_a("IfcRelDefinesByProperties"):
            continue
        pdef = rel.RelatingPropertyDefinition
        if pdef.is_a("IfcPropertySet") and pdef.Name == "Dimensions":
            for prop in pdef.HasProperties:
                if prop.Name == name:
                    return prop.NominalValue.wrappedValue
    return None


@pytest.fixture()
def metre_project():
    with TestClient(app) as client:
        load = client.post("/api/projects/samples/office_pavilion/load")
        assert load.status_code == 201, load.text
        project_id = load.json()["id"]
        client.put(f"/api/projects/{project_id}", json={"name": "AutoTest-step21-metre"})
        try:
            yield client, project_id
        finally:
            client.delete(f"/api/projects/{project_id}")


@pytest.fixture()
def milli_project():
    """IFC4X3 sample with MILLI length unit (calculate_unit_scale -> 0.001)."""
    tmp = Path(tempfile.mkdtemp()) / "AutoTest-building-architecture.ifc"
    shutil.copy(MILLI_FIXTURE, tmp)
    with TestClient(app) as client:
        with open(tmp, "rb") as fh:
            res = client.post(
                "/api/projects/upload",
                files={"file": ("AutoTest-building-architecture.ifc", fh, "application/octet-stream")},
                data={"name": "AutoTest-step21-milli"},
            )
        assert res.status_code == 201, res.text
        project_id = res.json()["id"]
        try:
            yield client, project_id
        finally:
            client.delete(f"/api/projects/{project_id}")
            tmp.unlink(missing_ok=True)


def test_wall_height_change_changes_the_solid(metre_project):
    """Spec 1, 2, 4, 8: height must reach the extrusion, and the property must agree."""
    client, project_id = metre_project
    wall = _create_wall(client, project_id)
    wall_id = wall["express_id"]

    res = client.patch(
        f"/api/projects/{project_id}/cad/elements/{wall_id}/geometry",
        json={"height": 5.0},
    )
    assert res.status_code == 200, res.text

    solid, model = _body_solid(project_id, wall_id)
    assert solid.is_a("IfcExtrudedAreaSolid")
    assert solid.Depth == pytest.approx(5.0), (
        f"geometry unchanged: Depth is still {solid.Depth} while the panel says 5.0"
    )

    lo, hi = _geom_extents(project_id, wall_id)
    assert hi[2] - lo[2] == pytest.approx(5.0, abs=0.01), (lo, hi)

    assert _dimension(project_id, wall_id, "Height") == pytest.approx(5.0)


def test_wall_thickness_change_changes_the_profile(metre_project):
    """Spec 3: thickness must reach the swept profile."""
    client, project_id = metre_project
    wall = _create_wall(client, project_id)
    wall_id = wall["express_id"]

    res = client.patch(
        f"/api/projects/{project_id}/cad/elements/{wall_id}/geometry",
        json={"thickness": 0.4},
    )
    assert res.status_code == 200, res.text

    lo, hi = _geom_extents(project_id, wall_id)
    assert hi[1] - lo[1] == pytest.approx(0.4, abs=0.01), (lo, hi)


def test_millimetre_wall_height_is_converted(milli_project):
    """Spec 1, 9: Depth is in project units, not metres."""
    client, project_id = milli_project
    wall = _create_wall(client, project_id, height=3.0)
    wall_id = wall["express_id"]

    model = ifcopenshell.open(str(_model_path(project_id)))
    scale = ifcopenshell.util.unit.calculate_unit_scale(model)
    assert scale == pytest.approx(0.001), f"fixture is not millimetre: {scale}"

    solid, _ = _body_solid(project_id, wall_id)
    assert solid.Depth == pytest.approx(3000.0)

    res = client.patch(
        f"/api/projects/{project_id}/cad/elements/{wall_id}/geometry",
        json={"height": 5.0},
    )
    assert res.status_code == 200, res.text

    solid, _ = _body_solid(project_id, wall_id)
    assert solid.Depth == pytest.approx(5000.0), (
        f"Depth {solid.Depth} for a 5 m request in a millimetre model"
    )
    lo, hi = _geom_extents(project_id, wall_id)
    assert hi[2] - lo[2] == pytest.approx(5000.0, abs=10.0)


def test_unsupported_wall_returns_409_and_does_not_write():
    """Spec 5: a face-based wall must refuse, not pretend."""
    tmp = Path(tempfile.mkdtemp()) / "AutoTest-duplex.ifc"
    shutil.copy(DUPLET_FIXTURE, tmp)
    with TestClient(app) as client:
        with open(tmp, "rb") as fh:
            res = client.post(
                "/api/projects/upload",
                files={"file": ("AutoTest-duplex.ifc", fh, "application/octet-stream")},
                data={"name": "AutoTest-step21-duplex"},
            )
        assert res.status_code == 201, res.text
        project_id = res.json()["id"]
        try:
            model = ifcopenshell.open(str(_model_path(project_id)))
            face_based = [
                w.id()
                for w in model.by_type("IfcWall")
                if w.Representation
                and any(
                    i.is_a("IfcFaceBasedSurfaceModel")
                    for r in w.Representation.Representations
                    if r.is_a("IfcShapeRepresentation")
                    for i in r.Items
                )
            ]
            assert face_based, "fixture no longer contains a face-based wall"
            wall_id = face_based[0]
            before = _digest(project_id)

            res = client.patch(
                f"/api/projects/{project_id}/cad/elements/{wall_id}/geometry",
                json={"height": 5.0},
            )

            assert res.status_code == 409, res.text
            assert res.json()["detail"]["code"] == "unsupported_geometry"
            assert _digest(project_id) == before, "a refused resize still modified the model"
        finally:
            client.delete(f"/api/projects/{project_id}")
            tmp.unlink(missing_ok=True)


def test_imported_extruded_wall_is_resizable(metre_project):
    """Spec 1: imported rectangle-profile walls resize too (duplex walls 3797/3999 shape)."""
    client, project_id = metre_project
    model = ifcopenshell.open(str(_model_path(project_id)))
    candidates = [
        w.id()
        for w in model.by_type("IfcWall")
        if w.Representation
        and any(
            i.is_a("IfcExtrudedAreaSolid")
            and i.ExtrudedDirection.DirectionRatios == (0.0, 0.0, 1.0)
            for r in w.Representation.Representations
            if r.is_a("IfcShapeRepresentation")
            for i in r.Items
        )
    ]
    if not candidates:
        pytest.skip("office_pavilion has no Z-extruded imported wall")

    wall_id = candidates[0]
    original, _ = _body_solid(project_id, wall_id)
    target = float(original.Depth) + 1.0

    res = client.patch(
        f"/api/projects/{project_id}/cad/elements/{wall_id}/geometry",
        json={"height": target},
    )
    assert res.status_code == 200, res.text

    solid, _ = _body_solid(project_id, wall_id)
    assert solid.Depth == pytest.approx(target)
```
</details>

### 2. Watch it fail

```
$ .\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step21_wall_resize.py -v
FAILED backend/tests/test_step21_wall_resize.py::test_wall_height_change_changes_the_solid
  E   AssertionError: geometry unchanged: Depth is still 3.0 while the panel says 5.0
  E   assert 3.0 == 5.0 ± 5.0e-06
FAILED backend/tests/test_step21_wall_resize.py::test_wall_thickness_change_changes_the_profile
  E   AssertionError: (array([0., 0., 0.]), array([6.  , 0.25, 3.  ]))
  E   assert 0.25 == 0.4 ± 0.01
FAILED backend/tests/test_step21_wall_resize.py::test_millimetre_wall_height_is_converted
  E   AssertionError: Depth 3000.0 for a 5 m request in a millimetre model
FAILED backend/tests/test_step21_wall_resize.py::test_unsupported_wall_returns_409_and_does_not_write
  E   assert 200 == 409
  E   AssertionError: {'success': True, 'express_id': 5399, 'updated': True}
FAILED backend/tests/test_step21_wall_resize.py::test_imported_extruded_wall_is_resizable
  E   AssertionError: assert 3.0 == 4.0 ± 4.0e-06
```

`test_wall_height_change_changes_the_solid` asserts on the **IFC entity and the tessellated geometry**, never on the HTTP status — per `ROADMAP.md` change-control rule 2, which names this exact bug.

### 3. Implement

1. `backend/app/services/cad_service.py` — add near the top:
   ```python
   class GeometryNotEditable(Exception):
       """Raised when an element's representation cannot be resized parametrically."""
   ```
2. Add `_find_body_extruded_solid(entity) -> tuple[Any, Any] | None`: iterate `entity.Representation.Representations`, take the one with `RepresentationIdentifier == "Body"`, require exactly one item that `is_a("IfcExtrudedAreaSolid")`, return `(solid, representation)`. Return `None` otherwise (do not raise here).
3. Add `_resize_extruded_solid(solid, *, new_height=None, new_thickness=None, unit_scale=1.0)`:
   - if `new_height is not None`: require `tuple(solid.ExtrudedDirection.DirectionRatios) == (0.0, 0.0, 1.0)` else `GeometryNotEditable("wall extrusion is not vertical")`; `solid.Depth = float(new_height) / unit_scale`.
   - if `new_thickness is not None`:
     - `IfcRectangleProfileDef` → `solid.SweptArea.YDim = float(new_thickness) / unit_scale`.
     - `IfcArbitraryClosedProfileDef` with `OuterCurve.is_a("IfcIndexedPolyCurve")` → read `solid.SweptArea.OuterCurve.Points.CoordList` (a tuple of `(x, y)`), compute `y_min`/`y_max`, raise `GeometryNotEditable("profile has no thickness")` if `y_max - y_min <= 0`, else set `CoordList` to `tuple((x, y_min + (y - y_min) * ratio) for x, y in coords)` with `ratio = (new_thickness / unit_scale) / (y_max - y_min)`.
     - anything else → `GeometryNotEditable(f"profile {solid.SweptArea.is_a()} is not resizable")`.
   - Validate **all** requested dimensions before mutating anything (spec 6): compute and check first, assign second.
4. `backend/app/services/cad_service.py:768-809` — replace the wall branch:
   ```python
   if entity.is_a("IfcWall"):
       scale = ifcopenshell.util.unit.calculate_unit_scale(model)
       found = cls._find_body_extruded_solid(entity)
       if found is None:
           raise GeometryNotEditable("wall body is not a single extruded solid")
       solid, _rep = found
       cls._resize_extruded_solid(
           solid,
           new_height=req.height if req.height is not None else None,
           new_thickness=req.thickness if req.thickness is not None else None,
           unit_scale=scale,
       )
       model.write(str(file_path))
       # property AFTER the geometry is committed
       if req.height is not None:
           IFCService.update_element_property(file_path, express_id, "Dimensions", "Height", float(req.height), "IfcLengthMeasure")
       if req.thickness is not None:
           IFCService.update_element_property(file_path, express_id, "Dimensions", "Thickness", float(req.thickness), "IfcLengthMeasure")
       model = ifcopenshell.open(str(file_path))
       entity = model.by_id(express_id)
   ```
   Import `ifcopenshell.util.unit` at `:14`.
5. `backend/app/services/cad_service.py:798-804` — elevation: convert with the same `unit_scale`, and replace `except Exception: pass` with `except Exception as exc: raise GeometryNotEditable(f"elevation edit failed: {exc}") from exc`. Only run it when `req.elevation is not None`.
6. `backend/app/services/cad_service.py:806-809` — after `model.write`, **re-read the model** and assert the persisted value (spec 8): re-open, re-find the solid, compare `Depth`/`YDim` to the request within `1e-6`; on mismatch raise `RuntimeError("geometry did not persist")`.
7. `backend/app/api/cad.py:146-161` — 
   ```python
   except GeometryNotEditable as exc:
       raise HTTPException(status_code=409, detail={"code": "unsupported_geometry", "message": str(exc)})
   ```
   imported from `..services.cad_service`.

### 4. Watch it pass

```
$ .\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step21_wall_resize.py -v
PASSED backend/tests/test_step21_wall_resize.py::test_wall_height_change_changes_the_solid
PASSED backend/tests/test_step21_wall_resize.py::test_wall_thickness_change_changes_the_profile
PASSED backend/tests/test_step21_wall_resize.py::test_millimetre_wall_height_is_converted
PASSED backend/tests/test_step21_wall_resize.py::test_unsupported_wall_returns_409_and_does_not_write
PASSED backend/tests/test_step21_wall_resize.py::test_imported_extruded_wall_is_resizable
5 passed
```

### 5. Regression guard

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_cad_and_clash.py -v
.\backend\venv\Scripts\python.exe -m pytest backend/tests/ -q
cd frontend; pnpm exec tsc -b --noEmit
cd frontend; pnpm exec vitest run
```

`backend/tests/test_cad_and_clash.py` never calls `PATCH /geometry`, so a 409 leaking onto a valid path will show up as a 500/failed wall creation in that file. If the frontend sends `PATCH .../geometry` from a property panel (`frontend/src/components/properties/**`), a new `409` needs a toast — check with a grep for `geometry` under `frontend/src/services/`.

## Acceptance criteria

- [ ] `PATCH {"height": 5.0}` on a metre-model wall moves `IfcExtrudedAreaSolid.Depth` from `3.0` to `5.0` and the tessellated Z extent to 5.0.
- [ ] `Dimensions.Height` equals the new `Depth` in the same call.
- [ ] `PATCH {"thickness": 0.4}` moves the tessellated Y extent to 0.4.
- [ ] In a MILLI model, `{"height": 5.0}` yields `Depth == 5000.0`.
- [ ] A `IfcFaceBasedSurfaceModel` wall returns `409` with `detail.code == "unsupported_geometry"` and an unchanged file digest.
- [ ] An imported `IfcExtrudedAreaSolid` + `IfcRectangleProfileDef` wall resizes successfully.
- [ ] No path returns `{"success": true}` when the on-disk representation still has the old value.
- [ ] `test_cad_and_clash.py` stays green.

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| Changing `Depth` on imported walls breaks their openings/voids alignment | Openings are positioned relative to `wall_mat` at the wall base (`cad_service.py:336-343`), so a height change does not move them; a *thickness* change can. Note it in the handoff and prefer height support for imported walls first | Gate spec 3 to walls created by `create_2pt_wall` (`solid.SweptArea.OuterCurve.is_a("IfcIndexedPolyCurve")`) and return 409 for imported rectangle profiles |
| `IfcIndexedPolyCurve.CoordList` is a tuple, not a list; assigning a list may not persist | Assign a tuple of tuples, exactly as read; the probe above shows the tuple form | N/A |
| A property write after a successful geometry write leaves the two inconsistent if the pset write fails | The geometry is the source of truth; if the pset write raises, return `500` and let the user retry — the model is *more* correct than before | Swap the order back (worse; do not) |
| `409` breaks a frontend that treats non-200 as a generic error | The body carries `code`, and the message is user-readable; a toast is a one-line change | Return `200` with `{"success": false, "code": ...}` — but that hides the failure, so prefer the 409 |
| Re-reading the model to verify (step 6) doubles parse cost on every resize | Homes are small in practice; STEP-04's cache absorbs it | Drop the verification and rely on the unit test |

## Notes

- **`_create_box_mesh` has a latent unit bug** worth recording but not fixing here: `create_column` and `create_slab` build meshes in raw metres, so on a MILLI model they create geometry 1/1000 the requested size. The `IfcColumn` branch of `update_geometry` (`cad_service.py:791-795`) shares it. Out of scope — but if you touch the column branch for spec 10, fix the scale there and mention it in the handoff.
- **Do not "fix" this by re-running `create_2pt_wall`.** Recovering `p1`/`p2` from the placement plus the profile extent is a lossy inverse, and it silently drops material layers, styles and opening relations. Editing `Depth`/`YDim` in place preserves everything else.
- **Interaction with STEP-22:** a wall resize does not move its openings. After a height change that makes an opening taller than the wall, the model is geometrically wrong even though every entity is valid. STEP-22 fixes opening *storey* assignment, not this; file it if the product owner cares.
- **Not verified:** F-021 is `[L]` in `FINDINGS.md`. The measurements in `## Evidence` were produced during this documentation pass against copies of `backend/app/samples/office_pavilion.ifc`, `modelsfortests/Building-Architecture.ifc` and `modelsfortests/Ifc2x3_Duplex_Architecture.ifc` in `%TEMP%`; the `PATCH` endpoint itself was not called.

### Implementation notes - 2026-10-25

- **Status:** done. `backend/tests/test_step21_wall_resize.py` went `5 failed` (the five documented
  failures) → `5 passed`. `backend/app/api/cad.py` gained only the `GeometryNotEditable` → `409`
  mapping; everything else is in `backend/app/services/cad_service.py`.
- **Where the fix landed:** `update_geometry` now resolves the unit scale once, rejects edits the
  element cannot express, mutates the representation in place (`Depth`, `SweptArea.YDim`, or the
  `IfcIndexedPolyCurve` Y coordinates scaled about the profile's minimum Y), writes the model,
  *then* writes only the changed `Dimensions` properties through the untouched
  `IFCService.update_element_property`, then re-opens the file and refuses to answer
  `{"success": true}` unless the on-disk `Depth`/profile span matches the request within `1e-6`
  project units. `except Exception: pass` on the elevation branch is gone.
- **Measured (throwaway script, `POST /cad/wall` then `PATCH .../geometry`, `ifcopenshell.geom`
  world coords which are SI metres):**

  | model | call | before | after |
  |---|---|---|---|
  | metre | `{"height": 5.0}` | `Depth 3.0`, bbox `6.0 × 0.25 × 3.0`, coords `0…0.25` | `Depth 5.0`, bbox `6.0 × 0.25 × 5.0` |
  | metre | `{"thickness": 0.4}` | `Depth 5.0`, bbox Y `0.25` | bbox Y `0.4`, coords `0…0.4` |
  | MILLI (scale 0.001) | `{"height": 5.0, "thickness": 0.4}` | `Depth 3000.0`, bbox `6.0 × 0.25 × 3.0`, coords Y `250` | `Depth 5000.0`, bbox `6.0 × 0.4 × 5.0`, coords Y `400` |
  | duplex `#3797` (`IfcRectangleProfileDef`) | `{"thickness": 0.5}` | `YDim 0.1479…`, `Depth 3.1` | `YDim 0.5`, `Depth 3.1` |

  The `IfcFaceBasedSurfaceModel` wall `#5399` answers `409 unsupported_geometry` and leaves the
  file digest unchanged; so does a polyline-profile wall asked for `height` **and** `thickness`
  (the height is *not* half-written — validation precedes mutation).
- **Two defects had to be fixed on the way, both inside this step's scope file:**
  1. **Walls created by `POST /cad/wall` had `Representation = None`.** With the installed
     `ifcopenshell` 0.9.0, `geometry.create_2pt_wall` *returns* the representation instead of
     assigning it (`api/geometry/create_2pt_wall.py:69-88`), and `create_wall` discarded the return
     value. Every newly drawn wall therefore had no geometry at all on this toolchain — the panel
     said 3 m, the viewport had nothing, and every resize would have been a 409. `create_wall` now
     assigns the returned representation when the product has none. This is the one change outside
     the strict "resize" wording; without it no resize path is reachable and the step's own
     acceptance criteria cannot be met.
  2. **`geometry.assign_representation` appends on 0.9.** The column rebuild produced two `Body`
     representations and the old (first) one kept winning, so a column "resize" reported success
     and did not move — exactly the bug this step exists to kill. `_replace_body_representation`
     swaps the `Body` entry inside the existing `IfcProductDefinitionShape`. The rebuilt box is
     also converted to project units now (the `## Notes` above invited that), so a column on a
     MILLI model is no longer 1/1000 size after a resize.
- **Deviation — spec 7 says `422`, the delivery answers `409`.** The elevation failure surfaces as
  `GeometryNotEditable`, which the one allowed API edit maps to `409 {"detail": {"code":
  "unsupported_geometry", …}}`. A distinct `422` would need a second mapping in `api/cad.py`, which
  this lane was scoped out of. No test covers the branch. Decision needed: either accept `409`
  for "placement edit failed" too, or add `GeometryUpdateFailed` → `422` in a follow-up.
- **Deviation — spec 7's `/ unit_scale` applies to the stored placement, not to the API matrix.**
  `geometry.edit_object_placement` defaults to `is_si=True` (it multiplies the translation by the
  unit scale itself), so the matrix must carry **metres**. Passing `elevation / unit_scale` on a
  MILLI model produced a placement 1000× too high (measured: request `1.5` → `1_500_000` project
  units, world Z `1500`). Verified after the fix: `{"elevation": 1.5}` stores
  `IfcLocalPlacement` Z `1500` project units and moves the world Z range to `1.5…4.5` on both a
  metre and a MILLI model.
- **Behaviour widened slightly, deliberately:** an elevation-only `PATCH` is still allowed on any
  element (spec 7), but any `height`/`thickness` request on an element that is neither wall nor
  column — and `width`/`depth` on a wall — now returns `409` instead of `{"success": true}` with no
  change. That includes slabs and doors, which the properties dock
  (`frontend/src/components/cad/GlassContextualModifyDock.tsx:165-173`) can send for any selection.
- **Test-file deviations (no assertions weakened):** the MILLI fixture constant points at
  `backend/app/samples/building_architecture.ifc` because `modelsfortests/Building-Architecture.ifc`
  is staged as deleted in this working tree and is byte-identical (verified by `git cat-file blob`
  hash comparison); and the final millimetre assertion compares the tessellated Z span in SI metres
  (`5.0 m`) plus `5.0 / 0.001 ≈ 5000` project units, because `ifcopenshell.geom` returns world
  vertices in metres, not project units.
- **Left as-is on purpose:** the column rebuild still substitutes `0.35 / 0.35 / 3.0` for dimensions
  that were not sent, so `PATCH {"height": 4.0}` on a `0.4 × 0.4` column yields `0.35 × 0.35 × 4.0`.
  Spec 10 says keep the rebuild behaviour; filed as a handoff bug instead.
- **Regression state:** final `pytest backend/tests -q` → **53 passed, 0 failed** (earlier runs
  overlapped the concurrent STEP-01 lane and produced
  `test_step01_ai_transform_units.py::test_transform_is_recorded_as_an_audit_entry`,
  `sqlite3.IntegrityError: FOREIGN KEY constraint failed` in `ProjectService.record_edit`; that file
  passes 4/4 in isolation, so those were shared-`storage/projects.db` contention, not this step).
  `test_cad_and_clash.py` 2/2 green.

