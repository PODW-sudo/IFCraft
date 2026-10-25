# STEP-01 — Fix AI copilot transform units and rotation origin

**Status:** not started · **Wave:** A · **Effort:** 0.5 d
**Findings:** F-001 · **Depends on:** — · **Blocks:** STEP-17 (any AI mutation surface)

## Problem

The copilot's "move this element 2 m" moves it roughly 2 km on any millimetre-unit model.
Measured on `modelsfortests/Ifc4_Revit_ARC.ifc`, a **zero-delta** round trip through the
transform path displaced a wall by **13,516 m**. There is no undo entry for AI edits, so the
damage is not reversible from the UI.

This is the single most severe defect in the product: it is silent, it is destructive, it
targets the most common real-world file format (Revit exports are millimetre), and the user
has no way to recover.

## Evidence

`backend/app/services/ai_service.py:828-868`

```python
current_matrix_16 = IFCService.get_element_placement_matrix(file_path, element_id)   # :828
M = np.array(current_matrix_16).reshape((4, 4), order="F")
T = np.identity(4); T[0, 3] = dx; T[1, 3] = dy; T[2, 3] = dz     # dx is documented in METRES
M_new = T @ R @ M                                                 # :865  rotates about the WORLD origin
new_matrix_16 = M_new.flatten(order="F").tolist()
await asyncio.to_thread(IFCService.update_element_placement, file_path, element_id, new_matrix_16)
```

`backend/app/services/ifc_service.py:286-325` — `get_element_placement_matrix` reads only
`entity.ObjectPlacement.RelativePlacement` (the parent chain is ignored, so the value is a
**local** matrix) and returns it in **project units**.

`backend/app/services/ifc_service.py:257` — the writer is called with `is_si=True`, so
ifcopenshell multiplies translations by `1/unit_scale`:

```python
ifcopenshell.api.run("geometry.edit_object_placement", model, product=entity, matrix=mat4, is_si=True)
```

Reproduction (`VERIFICATION.md` §3.2):

```
world pos BEFORE (mm units): [-11116.903, -8490.419, 2700.0]
service matrix translation : [13162.932, 3000.406, -300.0]      <-- LOCAL, not world
world pos AFTER  (mm units): [13162931.517, 3000406.021, -300000.0]
DELTA: [13174048.42, 3008896.44, -302700.0]  ->  13,516.68 m
```

Unit census (`VERIFICATION.md` §3.1) — every real Revit export in `modelsfortests/` is `MILLI`.
The bundled `ifc2x3_duplex_architecture.ifc` is the only metre model, which is why the demo path
never exposed this.

## Scope

**Change:**
- `backend/app/services/ifc_service.py:286-325` — rewrite `get_element_placement_matrix` to return
  the **world** matrix in project units, via `ifcopenshell.util.placement.get_local_placement()`.
- `backend/app/services/ai_service.py:828-868` — convert the metre delta to project units before
  composing; apply the rotation to the orientation block only.

**Do not change:**
- `IFCService.update_element_placement`'s `is_si` semantics. Other callers depend on it.
  Instead, make the *caller* pass a matrix expressed in the units the writer expects, and
  document that contract at the function.
- `backend/app/api/projects.py:260-290` (the REST placement route). Its contract is "world matrix
  in metres from Three.js" and is covered separately by STEP-02.

**Non-goals:**
- Rewriting the CAD service's transform maths. `cad_service.py:1030` already does it correctly
  (`mat[:3, :3] = R @ mat[:3, :3]`, and it calls `edit_object_placement` **without** `is_si`).
- Adding AI undo. That is STEP-10.

## Spec

1. `IFCService.get_element_placement_matrix(path, express_id)` returns a **column-major 4×4 world
   matrix in project units**, resolved through the full `IfcLocalPlacement.PlacementRelTo` chain.
   For an element with no placement, it returns the identity.
2. `AIService._exec_transform_element` treats `dx/dy/dz` as **metres** and converts them to project
   units using `ifcopenshell.util.unit.calculate_unit_scale(model)` before composing.
3. The translation delta is applied in world space: `M_new[:3, 3] += delta_in_project_units`.
4. The rotation `R` is applied to the **orientation block only**: `M_new[:3, :3] = R @ M[:3, :3]`.
   The translation column is untouched by a pure rotation.
5. A transform with all-zero deltas is a **byte-for-byte no-op** on the element's world position.
6. The existing audit row (`record_edit(action_type="transform_element")`) is preserved.
7. The behaviour is identical on metre and millimetre models.

## TDD

The canonical, executable test is
[`tests/backend/test_step01_ai_transform_units.py`](../tests/backend/test_step01_ai_transform_units.py).
Copy it into `backend/tests/` and run it.

### 1. Add the failing test

```powershell
Copy-Item docs/audit-2026-10/tests/backend/test_step01_ai_transform_units.py backend/tests/
```

It contains four tests:

| Test | Asserts |
|---|---|
| `test_zero_delta_transform_does_not_move_the_element` | a no-op transform moves the element < 1 mm |
| `test_translate_delta_is_expressed_in_metres` | `dx = 2.0` moves the element exactly 2000 mm |
| `test_rotation_preserves_position` | `rz = 90` changes orientation without translating |
| `test_transform_is_recorded_as_an_audit_entry` | the audit row still lands (regression guard — passes today) |

Core assertion:

```python
@pytest.mark.asyncio
async def test_zero_delta_transform_does_not_move_the_element(mm_project):
    project_id, model_path = mm_project
    express_id = _first_wall(model_path)

    before = _world_position(model_path, express_id)

    result = await AIService._exec_transform_element(
        project_id, model_path,
        {"element_id": express_id, "dx": 0, "dy": 0, "dz": 0, "rx": 0, "ry": 0, "rz": 0},
    )
    assert result.get("success") is True

    after = _world_position(model_path, express_id)
    delta = [after[i] - before[i] for i in range(3)]
    assert abs(delta[0]) < POS_TOL and abs(delta[1]) < POS_TOL and abs(delta[2]) < POS_TOL
```

### 2. Watch it fail

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step01_ai_transform_units.py -v
```

Verified failure (2026-10-24):

```
FAILED ...::test_zero_delta_transform_does_not_move_the_element
FAILED ...::test_translate_delta_is_expressed_in_metres
FAILED ...::test_rotation_preserves_position
PASSED ...::test_transform_is_recorded_as_an_audit_entry
3 failed, 1 passed
```

The rotation failure is stark:

```
A pure rotation moved the element. before=[12345226892.03902, -5522328305.788846, -303000000.0]
after=[11839867400155.195, 6535943589318.214, -303003000000.0]
```

### 3. Implement

**a.** Replace `get_element_placement_matrix` (`ifc_service.py:286-325`):

```python
@staticmethod
def get_element_placement_matrix(file_path: Path, express_id: int) -> list[float]:
    """Column-major 4x4 WORLD matrix for an element, in PROJECT UNITS.

    Callers that need SI must convert with
    ifcopenshell.util.unit.calculate_unit_scale(model).
    """
    identity = [1.0,0.0,0.0,0.0, 0.0,1.0,0.0,0.0, 0.0,0.0,1.0,0.0, 0.0,0.0,0.0,1.0]
    if not file_path.exists():
        return identity
    import ifcopenshell
    import ifcopenshell.util.placement as placement_util
    model = ifcopenshell.open(str(file_path))
    entity = model.by_id(express_id)
    if not entity or not getattr(entity, "ObjectPlacement", None):
        return identity
    matrix = placement_util.get_local_placement(entity.ObjectPlacement)
    return [float(v) for v in matrix.flatten(order="F")]
```

**b.** Add a unit helper near the other module functions:

```python
def _unit_scale(model) -> float:
    """Project units per metre. 1.0 for metres, 0.001 for millimetres."""
    import ifcopenshell.util.unit as unit_util
    return float(unit_util.calculate_unit_scale(model))
```

**c.** In `_exec_transform_element`, after loading the matrix:

```python
model = ifcopenshell.open(str(file_path))
scale = _unit_scale(model)              # project units per metre
M = np.array(current_matrix_16).reshape((4, 4), order="F")
R = Rz @ Ry @ Rx

# rotate about the element's own origin
M_new = M.copy()
M_new[:3, :3] = R @ M[:3, :3]

# translate in world space, converting metres -> project units
M_new[0, 3] += dx / scale
M_new[1, 3] += dy / scale
M_new[2, 3] += dz / scale

# the writer declares SI, so hand it SI
M_for_writer = M_new.copy()
M_for_writer[0, 3] *= scale
M_for_writer[1, 3] *= scale
M_for_writer[2, 3] *= scale
```

> **Decision required, and it is easy to get wrong.** `update_element_placement(is_si=True)`
> divides translations by the unit scale. There are two consistent ways to satisfy it:
> **(i)** pass the world matrix with translations expressed in **metres** (multiply by `scale`
> once, as above); or **(ii)** keep `is_si=False` at the call site and pass the matrix in
> project units directly. **Prefer (ii)** — it removes the conversion entirely:
> `ifcopenshell.api.run("geometry.edit_object_placement", model, product=entity, matrix=M_new)`.
> Whichever you choose, add a comment and make the test prove it on both a metre and a
> millimetre fixture.

**d.** Guard the no-op case: if every delta is zero, return success without writing the file at all.

### 4. Watch it pass

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step01_ai_transform_units.py -v
```

Expected: `4 passed`. Runtime is ~75 s (the 13 MB fixture is re-opened several times).

### 5. Regression guard

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/ -q
```

`test_phase3.py` exercises placement round-trips and must stay green. Note that master is already
red on `test_phase6.py` until STEP-07 lands — compare against that baseline, not against green.

## Acceptance criteria

- [ ] A zero-delta AI transform leaves the element's world position unchanged on a millimetre model.
- [ ] `dx = 2.0` moves the element exactly 2 m (2000 mm on the mm fixture).
- [ ] `rz = 90` changes orientation without moving the element.
- [ ] The same three assertions hold on a metre-unit model.
- [ ] `get_element_placement_matrix`'s docstring states "world matrix, project units".
- [ ] `update_element_placement`'s docstring states which units it expects and which `is_si` value goes with them.
- [ ] The audit row is still written.
- [ ] `test_phase3.py` is green.

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| Other callers of `get_element_placement_matrix` relied on the local-matrix behaviour | Grep for all call sites before changing; the AI path is the only consumer (`ai_service.py:828`) | Revert the single commit; the old function is a self-contained block |
| `is_si=True` conversion is off by a factor of 1000 in the other direction | The test asserts world position on a real mm fixture, not an intermediate value | Revert |
| Elements with `PlacementRelTo` chains behave differently after switching to `get_local_placement` | That is the *point* — the old code ignored the chain. Add a fixture with a nested placement to the test | Revert |

## Notes

- `cad_service.py:1030` is the reference implementation for "rotate about the element origin".
  Copy its pattern rather than inventing one.
- Do **not** fix this by dividing by 1000 based on a prefix check. Use
  `ifcopenshell.util.unit.calculate_unit_scale()` — it handles `IfcConversionBasedUnit`
  (feet, inches) as well.
- This step does not add AI undo. Until STEP-10 lands, an AI transform is still irreversible.
  Consider shipping STEP-01 and STEP-10 in the same release.

### Execution notes — 2026-10-25 (implemented, ready for review)

**What changed**
- `IFCService.get_element_placement_matrix` now resolves the full `PlacementRelTo` chain via
  `ifcopenshell.util.placement.get_local_placement()` and returns the **world** matrix in
  **project units**. Docstring states the contract; identity is returned for a missing file or an
  element without `ObjectPlacement`.
- `AIService._exec_transform_element` reads the unit scale with the new module-level
  `_unit_scale(model)` helper (`ifcopenshell.util.unit.calculate_unit_scale`), converts the
  metre deltas to project units, rotates only the orientation block
  (`M_new[:3, :3] = R[:3, :3] @ M[:3, :3]`) and translates in world space. An all-zero delta is a
  no-op that never touches the file (the audit row is still written).
- `IFCService.update_element_placement` behaviour is unchanged (`is_si=True`); only its docstring
  now states the contract: *world matrix, translation column in SI metres*.

**Writer-unit decision** — took option **(i)**, not the preferred (ii): the AI path hands the writer
a world matrix whose translation is converted project units → metres, keeping `is_si=True`.
Option (ii) would have required flipping `is_si` inside `update_element_placement`, which the
`## Scope` section forbids ("do not change `update_element_placement`'s `is_si` semantics"), and the
two other callers (`api/projects.py:276`, `api/websocket.py:122`) already pass Three.js world
matrices in metres, so `is_si=True` is the established contract. The conversion is done once at
the call site and is covered by the assertions below on both unit systems.

**Tests**
- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_step01_ai_transform_units.py -q`
  — failed 3/4 before the change (zero-delta displaced ~1.2e10 project units, 2 m reported as
  ~1.23e10), **4 passed** after (~2 min).
- Full suite: `pytest backend/tests -q` → **44 passed**.
- Acceptance criterion "same assertions on a metre model" is not covered by the checked-in test
  (it only ships the mm fixture); verified ad hoc on `modelsfortests/Ifc2x3_Duplex_Architecture.ifc`
  (unit scale 1.0): zero-delta delta `[0,0,0]`, `dx=2.0` moved exactly `2.0`, `rz=90` moved `0` and
  rotated the X axis from `[0,-1,0]` to `[1,0,0]`.

**Residual risk**
- Nested placements are now written back through `edit_object_placement`'s world-matrix path
  (it inverts the parent frame itself). That is correct for the Revit fixture and the duplex model,
  but grids/linear placements are unsupported by ifcopenshell and still fall back to the legacy
  direct-placement branch, which does **not** convert units.
- `new_position` in the tool result is now the element's world position in **project units**
  (previously a local, mixed-unit value). No caller or test depends on the old value.

