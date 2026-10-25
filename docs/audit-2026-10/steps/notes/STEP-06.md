## 2026-10-25 - Clash detection examined no walls and reported success anyway (STEP-06 / F-005)

- **Type:** Bug
- **Platform:** http://localhost:5173 (Clash Inspector) + `POST /api/projects/{id}/clashes/check`
- **Related tests:** `backend/tests/test_step06_clash_correctness.py`, `backend/tests/test_cad_and_clash.py`
- **Severity:** P0
- **Observed:** On the 57-wall Duplex fixture the clash check boxed 76 elements (slabs, doors,
  windows, members, coverings) and **zero walls**, because (a) `for prod in elements[:25]` capped
  each class at 25, (b) `create_shape()` picked the wall's `Axis`/`Curve2D` representation and
  raised, and (c) every exception was swallowed by `except Exception: continue`. The response
  carried no field saying the scan was partial, so "0 hard clashes" read as a coordination result.
  Reproduced before the fix: 134 attempts → 58 silent failures, 0 wall boxes, 86 clashes, no wall
  in the report. The class list also held supertype/subtype pairs (`IfcWall` +
  `IfcWallStandardCase`, `IfcDistributionElement` + `IfcFlowSegment`/`IfcFlowFitting`), so single
  entities were boxed twice and the `type_name`-based self-clash guard could not see it.
- **Expected:** Every target element is boxed (no silent sample), wall geometry resolves, failures
  are counted and logged, same-element pairs are never reported, and the response/UI disclose how
  complete the scan was.
- **Evidence:** `TR-STEP06-01` (before/after measurement script output, 2026-10-25):
  before 76 boxes / 0 walls / 86 clashes / 58 swallowed failures; after
  `elements_checked=141`, `geometry_failures=0`, `sampled=false`, 541 clashes (447 wall-involving),
  0 self-pairs, `duration_ms=1464` at tolerance 0.05. Step test 4 passed. Full backend suite
  54 passed / 4 failed (`test_step13_ws_room.py`, STEP-13 lane, unrelated).
- **Suggested fix (applied):**
  - `clash_service.py`: disjoint `TARGET_CLASSES`, de-duplicated product set, no per-type cap,
    parallel `ifcopenshell.geom.iterator` pass over the target products with an explicit
    `Body` `IfcShapeRepresentation` fallback via `create_shape(settings, prod, rep)`, counted +
    `WARNING`-logged `geometry_failures`, `_is_same_element()` guard (express id, scoped per model),
    and `elements_checked` / `geometry_failures` / `sampled` on the response.
  - `schemas.py`: three additive defaulted fields on `ClashCheckResponse`.
  - `ClashInspector.tsx`: amber "Incomplete clash check" banner (`data-qa="clash-completeness-warning"`)
    when `sampled` or `geometry_failures > 0`, honest empty state and an "N checked" footer.
  - **Follow-ups:** (1) the canonical test double-counts walls —
    `by_type("IfcWall")` already contains the 56 `IfcWallStandardCase` entities, so the fixture has
    57 walls, not 113; the repo copy now counts unique express ids and asserts every wall id is
    boxed. (2) Add the overlapping-two-walls fixture regression. (3) Re-baseline any BCF/report
    expectation built on "~110 clashes"; the Duplex now reports 541. (4) `frontend/src/types/ifc.ts`
    should gain the three new fields once that file is free. (5) If the 49 MB castle (not present in
    this tree) exceeds ~60 s, move the check to a background job rather than reintroducing a cap —
    and if a cap returns, it must set `sampled: true`.
- **Status:** Open — implemented and verified locally, pending review/merge; castle timing unmeasured.
