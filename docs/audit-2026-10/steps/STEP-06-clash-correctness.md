# STEP-06 — Clash detection must actually examine walls

**Status:** not started · **Wave:** A · **Effort:** 1.5 d
**Findings:** F-005 · **Depends on:** — · **Blocks:** STEP-19 (BCF from clash results), any coordination claim

## Problem

Clash detection never examines a single wall. On a 57-wall model (the audit's headline "113"
double-counted `IfcWallStandardCase`, which is an `IfcWall` subtype in IFC2x3) it returns
"110 clashes" containing **zero `IfcWall` entries**, and the response carries no signal that the
scan was partial.

A BIM engineer reads "0 hard clashes" as a coordination result. A wrong answer here is worse than
no answer: it ships a coordination failure to site.

## Evidence

`backend/app/services/clash_service.py:51-87`:

```python
for t in target_types:                              # 14 types, several overlapping
    elements = model.by_type(t)
    for prod in elements[:25]:                      # :57  hard cap, 25 per type
        try:
            shape = ifcopenshell.geom.create_shape(geom_settings, prod)
            ...
        except Exception:
            continue                                # :83-84  every failure silently dropped
```

**Measured (`VERIFICATION.md` §3.3, 25 walls attempted):**

```
total walls in model: 57 unique (IfcWall 57, of which 56 are IfcWallStandardCase;
                         a naive 57 + 56 = 113 double-counts the subtype)
first 25 walls: geometry_ok=0  geometry_failed=25
   25 x "Failed to process shape. Product: #...=IfcWallStandardCase(...)"
IfcSlab:   ok=21 failed=0
IfcDoor:   ok=14 failed=0
IfcWindow: ok=24 failed=0
```

**Measured live (`VERIFICATION.md` §2.3):**

```
POST /api/projects/53a78d8b.../clashes/check  -> 200, duration_ms = 4,070
  total_clashes: 110   hard: 45   clearance: 65
element types present: IfcSlab 100, IfcDoor 58, IfcMember 38, IfcColumn 16, IfcCovering 8
                        ^^^ no IfcWall, not once
```

Compounding defects in the same function:

- `target_types` (`:44-48`) includes both `IfcWall` and `IfcWallStandardCase`, and both
  `IfcDistributionElement` and `IfcFlowSegment`/`IfcFlowFitting` — so one entity can be boxed
  twice. The self-clash guard at `:169` compares `type_name`, which then differs.
- `ClashCheckResponse` (`backend/app/models/schemas.py:168-175`) has no `elements_checked`,
  `sampled` or `skipped` field.

## Scope

**Change:**
- `backend/app/services/clash_service.py:30-87` — build geometry through
  `ifcopenshell.geom.iterator` with an explicit `Body` context, count failures, remove the cap,
  de-duplicate the product set.
- `backend/app/models/schemas.py:168-175` — add `elements_checked`, `sampled`, `geometry_failures`
  to `ClashCheckResponse`.
- `backend/app/services/clash_service.py:137-185` — populate the new fields; skip self-pairs by
  `express_id`.
- `frontend/src/components/federation/ClashInspector.tsx` — show the completeness signal when
  `sampled` is true or `geometry_failures > 0`.

**Do not change:**
- The AABB overlap maths or the `tolerance` semantics.
- The response field names that already exist (`total_clashes`, `hard_clashes`,
  `clearance_clashes`, `clashes`, `duration_ms`, `tolerance`).

**Non-goals:**
- True triangle-mesh clash detection. AABB is acceptable if it is *honest*; mesh-level detection is
  a later feature.
- Background jobs and progress reporting for very large federations.

## Spec

1. The extracted element set contains **every** element of the target classes, with no per-type cap.
   If a cap is ever reintroduced for performance, the response must set `sampled: true` and report
   `elements_checked`.
2. Geometry is requested with an explicit body representation so walls resolve:
   `settings.set("use-world-coords", True)` and a context identifier of `Body`.
3. Every geometry failure is **counted** and reported as `geometry_failures`; it is logged at
   `WARNING` with the express id.
4. The target class list contains no class that is a supertype of another class in the same list.
   Build the product set once and de-duplicate by `express_id`.
5. A pair where `a.express_id == b.express_id` is never reported as a clash.
6. `total_clashes == len(clashes)`.
7. If `geometry_failures > 0`, the response must not be presented as a complete check — the UI
   shows a warning and the `sampled` field explains why.

## TDD

Canonical test:
[`tests/backend/test_step06_clash_correctness.py`](../tests/backend/test_step06_clash_correctness.py).

### 1. Add the failing test

```powershell
Copy-Item docs/audit-2026-10/tests/backend/test_step06_clash_correctness.py backend/tests/
```

| Test | Asserts |
|---|---|
| `test_geometry_extraction_includes_walls` | the box set contains wall entries |
| `test_geometry_extraction_covers_more_than_25_elements_per_type` | wall boxes ≥ wall count (the cap is gone) |
| `test_geometry_failures_are_reported_not_swallowed` | no more boxes than elements; no silent loss |
| `test_clash_response_reports_completeness` | `ClashCheckResponse` has `elements_checked` and `sampled` |

### 2. Watch it fail

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step06_clash_correctness.py -v
```

Verified (2026-10-24): `3 failed, 1 passed`.

```
AssertionError: Only 0 of 113 walls were extracted — the per-type sample cap is still in effect.
assert 0 >= 113

AssertionError: ClashCheckResponse is missing 'elements_checked'.
Present fields: ['clashes','clearance_clashes','duration_ms','hard_clashes','tolerance','total_clashes']
```

(The `113` in that pre-fix output is the same double count — the fixture has 57 unique walls, so the
corrected test asserts `wall_boxes >= 57` **and** that every wall express id is boxed.)

### 3. Implement

```python
TARGET_CLASSES = ("IfcWall", "IfcBeam", "IfcColumn", "IfcSlab", "IfcDoor", "IfcWindow",
                  "IfcMember", "IfcCovering")

settings_ = ifcopenshell.geom.settings()
settings_.set("use-world-coords", True)
settings_.set("exclude-single-vertex", True)

products, seen = [], set()
for cls in TARGET_CLASSES:
    for prod in model.by_type(cls):          # no [:25]
        if prod.id() in seen:
            continue
        seen.add(prod.id())
        products.append(prod)

failures = 0
for prod in products:
    try:
        shape = ifcopenshell.geom.create_shape(settings_, prod)
    except Exception:
        failures += 1
        logger.warning("Clash geometry failed for #%d (%s)", prod.id(), prod.is_a())
        continue
    ...build the box...
```

If `create_shape` on a wall still fails after setting the body context, check whether the wall's
first representation is the `Axis`/`Curve2D` one — `ifcopenshell` uses the first representation it
finds. Set `settings_.set("context-identifier", "Body")` and, if that is insufficient, iterate
`IfcShapeRepresentation` and pick `RepresentationIdentifier == "Body"` explicitly.

Then:

```python
if a.express_id == b.express_id:
    continue
...
return ClashCheckResponse(
    clashes=clashes,
    total_clashes=len(clashes),
    hard_clashes=..., clearance_clashes=...,
    tolerance=tolerance, duration_ms=...,
    elements_checked=len(products),
    geometry_failures=failures,
    sampled=False,
)
```

### 4. Watch it pass

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step06_clash_correctness.py -v
```

Expected: `4 passed`. All 57 unique wall ids in that fixture must be boxed.

### 5. Regression guard

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_cad_and_clash.py -q
```

`test_cad_and_clash.py` asserts on the clash endpoint's existing shape; the new fields are additive
so it should stay green. Expect the check to take longer than 4 s once it stops sampling —
record the new duration.

## Acceptance criteria

- [ ] On the 57-wall fixture, every wall express id is boxed and `elements_checked` ≥ the 141 unique
      target entities.
- [ ] No clash item has `element_a_id == element_b_id`.
- [ ] `geometry_failures` is `0` on a fixture where all geometry resolves, and `> 0` when it does not.
- [ ] `ClashCheckResponse` exposes `elements_checked`, `sampled`, `geometry_failures`.
- [ ] The Clash Inspector shows a visible warning when `sampled` is true or `geometry_failures > 0`.
- [ ] The check still completes in a reasonable time on the 49 MB castle (record it; do not regress
      past ~60 s without moving it to a background job).

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| Removing the 25-cap makes the check very slow on large models | Measure on the castle. If it exceeds ~60 s, keep a cap but set `sampled: true` and report it | Restore the cap with honest reporting — never restore the silent cap |
| Wall geometry still fails even with the body context | Fall back to the element's `ObjectPlacement` + `OverallWidth`/`OverallHeight` if present, or to the bounding box of all representations; count whatever still fails | Keep `geometry_failures` visible and document the limitation |
| Existing tests assert exact clash counts | They assert `total_clashes > 0`, not a fixed number. Verify before changing | Adjust the test to assert structure, not a magic number |

## Notes

- This is the clearest example in the codebase of "reports success it did not achieve". Whatever
  else changes, **the response must carry a completeness signal**.
- After this lands, add a fixture-based regression that asserts a known pair of walls which
  physically overlap is reported. Without it, the next geometry regression will be silent again.
- The two-wall fixture can be generated with the CAD API: create two walls at the same coordinates
  and assert exactly one clash.

## Notes — implementation log (2026-10-25)

**Status:** implemented on `main` working tree, uncombined with the other lanes. Step test green
(4 passed). Backend suite: 54 passed / 4 failed, all 4 failures in `test_step13_ws_room.py`
(STEP-13 lane, untouched here).

### What changed

| File | Change |
|---|---|
| `backend/app/services/clash_service.py` | Disjoint `TARGET_CLASSES` (no supertype/subtype pair), no per-type cap, one de-duplicated product set, parallel Body-geometry pass via `geom.iterator`, per-element Body fallback, counted+logged failures, `_is_same_element` guard, completeness fields populated |
| `backend/app/models/schemas.py` | `ClashCheckResponse` gains `elements_checked`, `geometry_failures`, `sampled` (all defaulted, so the change is additive) |
| `frontend/src/components/federation/ClashInspector.tsx` | Completeness banner when `sampled` or `geometry_failures > 0`, honest empty state, `data-qa="clash-completeness-warning"` + `data-qa="clash-elements-checked"` |
| `backend/tests/test_step06_clash_correctness.py` | Copied from `docs/audit-2026-10/tests/backend/`; one assertion corrected (see "Test defect" below) |

### Measured on the Duplex fixture (2.4 MB)

Fixture: `modelsfortests/Ifc2x3_Duplex_Architecture.ifc`.

**Before** (old algorithm reproduced verbatim on the same file, tolerance 0.05):

```
elements attempted          : 134   (14 classes x cap of 25)
geometry failures swallowed : 58
boxes built                 : 76    ifcslab 21, door 14, window 24, member 4, covering 13
wall boxes                  : 0
clashes                     : 86    hard 3 / clearance 83
clash element types         : slab 74, door 48, member 38, window 4, covering 8  (no wall)
extraction                  : 4.3 s
```

**After** (live `POST /api/projects/{id}/clashes/check`, same file uploaded as a project):

| tolerance | total_clashes | hard | clearance | elements_checked | geometry_failures | sampled | duration_ms |
|---|---|---|---|---|---|---|---|
| 0.05 | 541 (len == total) | 90 | 451 | 141 | 0 | false | 1464.5 |
| 0.01 | 536 | 208 | 328 | 141 | 0 | false | 1384.3 |

Clash types after (tol 0.05): `IfcWall` 447, `IfcSlab` 305, `IfcCovering` 111, `IfcDoor` 78,
`IfcMember` 54, `IfcWindow` 46, `IfcBeam` 41 — walls now dominate the report, as they should in a
wall-heavy model. Self-pairs (`element_a_id == element_b_id`): **0**.

So the headline defect is closed: 0 → 447 wall-involving clashes, `elements_checked` 141 = every
unique target entity in the file, `geometry_failures` 0.

### Test defect found in the canonical test (important)

`test_geometry_extraction_covers_more_than_25_elements_per_type` computed

```python
wall_count = len(by_type("IfcWall")) + len(by_type("IfcWallStandardCase"))
```

which is **113 on this fixture, but the fixture has 57 walls**. `IfcWallStandardCase` is a subtype
of `IfcWall` in IFC2x3, so `by_type("IfcWall")` already returns all 56 standard cases
(measured: `IfcWall` 57, `IfcWallStandardCase` 56, naive sum 113, unique express ids 57). The
audit's "113 walls" figure in the Problem/Evidence section has the same double count.

No implementation can satisfy `wall_boxes >= 113` while also satisfying spec item 4 (no
supertype/subtype in the target list, de-duplicate by `express_id`) without emitting each wall
twice. The repo copy of the test now counts unique wall express ids **and** asserts that every wall
id is present — strictly stronger against the cap, and consistent with the spec. The canonical copy
under `docs/audit-2026-10/tests/backend/` has been corrected to the same form (issue 4.4), so a
future copy cannot reintroduce `>= 113`.

### Deviations from the step text

1. **`sampled` is always `false`** — no cap exists, so nothing is sampled. Nothing in the response
   is presented as complete unless the whole target set was boxed.
2. **Self-pair guard is scoped to one model** — `a.model_id == b.model_id and a.express_id ==
   b.express_id`. Express ids are only unique *within* a file: `#500` in ARCH and `#500` in STR are
   different elements, and an unconditional id guard would silently suppress real cross-discipline
   clashes (the same class of bug this step fixes). The single-model double-boxing case the spec
   targets is fully covered, and the fixture run reports 0 self-pairs.
3. **`settings.set("exclude-single-vertex", True)` from the step snippet does not exist in
   ifcopenshell 0.9.0** (`RuntimeError: Setting not available`); dropped. `context-identifier` is
   likewise unavailable — the correct name is `context-identifiers`, but the implementation instead
   passes the `Body` `IfcShapeRepresentation` explicitly to `create_shape(settings, prod, rep)`,
   which is the deterministic form the step asked for.
4. **`IfcPipeSegment`/`IfcDuctSegment` are gone from the class list** (they do not exist in IFC2x3
   and were only reachable through `IfcDistributionElement`); `IfcFlowSegment`, `IfcFlowFitting`,
   `IfcFlowTerminal` and `IfcDistributionControlElement` keep MEP coverage with no overlap.
5. **Bulk pass is the iterator, with a per-element Body fallback** — the iterator alone is 4.6x
   faster but skips elements it cannot triangulate, so anything it does not return is retried with
   the explicit-Body `create_shape`, and that retry is what produces the counted, WARNING-logged
   `geometry_failures`. Iterator and explicit-Body AABB agreed on all 141 target elements of the
   Duplex (0 mismatches).

### Performance (risk table row 1)

| Model | Size | target elements | extraction | note |
|---|---|---|---|---|
| Duplex Architecture | 2.4 MB | 141 | 1.46 s (whole endpoint) | was 4.07 s live with the cap, 4.3 s extraction |
| `Ifc4_Revit_ARC.ifc` | 13.6 MB | 283 | 47.6 s extraction | per-element `create_shape` took 206 s; the threaded iterator is what bought this |
| `Ifc4_Revit_STR.ifc` | 11.3 MB | 448 | 16.6 s extraction | 100k single-model pairs, AABB scan is negligible |

The 49 MB castle is **not on disk** in this working tree, so the acceptance criterion for it could
not be measured — it needs a run on a machine that has the fixture. ARC at 47.6 s is close to the
~60 s line and is dominated by triangulation of 144 `IfcMember` elements, not by the pair scan.
Follow-up if the castle exceeds 60 s: move the check to a background job (non-goal here) rather
than reintroducing a cap; if a cap is ever added it must set `sampled: true` and be tested.

### Notes for whoever picks this up

- The step's own follow-up is still open: a fixture that asserts two *overlapping* walls produce
  exactly one clash. Worth adding before any further geometry rework — the Duplex now proves walls
  are extracted, but not that a known overlapping pair is found.
- Clash counts on the Duplex rise from 86 to 541 at the same tolerance. That is the point (the 455
  extra results are the wall and beam pairs that never existed before), but any BCF/report snapshot
  or UI expectation built on "~110 clashes" will move and should be re-baselined deliberately.
- `frontend/src/types/ifc.ts` `ClashCheckResponse` still lacks the three new fields; the component
  declares them locally to avoid touching a file owned by another lane. Promote them into the shared
  type when that file is free.

