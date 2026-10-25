# Roadmap — IFC Editor audit remediation

> **Scope decision (2026-10-25): execute all waves.**
> Waves A, B, C and D were implemented in one pass on 2026-10-25. The dependency graph below was
> honoured; the per-step evidence is in `steps/STATUS.md` and each step's `## Notes` section.
> This file remains as the sequencing record, not as an outstanding backlog.

Derived from `FINDINGS.md` (2026-10-24). Sequenced by **user impact × blast radius ÷ effort**,
not by tech novelty.

**Definition of Done (applies to every step):**

1. The step's TDD test exists, failed before the fix for the stated reason, and passes after.
2. The named regression guard suite is green.
3. No finding IDs listed in the step remain unaddressed.
4. `DEVELOPMENT_HANDOFF.md` has an entry and `steps/STATUS.md` has a row.
5. If the step touches `backend/app/api/*`, `backend/app/services/*` or `frontend/src/*`,
   the behaviour is documented in the step's `## Notes` section.

---

## Dependency graph

```
                     STEP-01 (AI transform units)
                              |
                     STEP-03 (atomic writes + lock)
                              |
        +---------------------+---------------------+
        |                     |                     |
   STEP-04 (event loop)  STEP-06 (clash)      STEP-07 (columns)
        |                     |                     |
        +---------------------+---------------------+
                              |
                     STEP-02 (single commit path)
                              |
                     STEP-05 (CORS + auth)
                              |
                     STEP-13 (WS resilience)
                              |
                     STEP-19 (audit timeline)


   STEP-08 (batched visibility)          STEP-09 (drawings)
        |                                      |
        +------------ STEP-14 (details race) -+
        |
   STEP-23 (viewport perf)

   STEP-10 (undo + confirm)  ->  STEP-21 (wall resize)  ->  STEP-22 (opening storey)
   STEP-16 (.ifczip)         ->  STEP-20 (security hardening)
   STEP-17 (copilot intent)  ->  STEP-18 (IFC schema validity)
   STEP-11 (Ctrl+K)          ->  STEP-12 (coordinate HUD)  ->  STEP-28 (ergonomics)
   STEP-15 (tree virtualize) ->  STEP-28
   STEP-24 (drawings perf/a11y) -> STEP-09
   STEP-25 (dead code)       ->  STEP-27 (test infra)  ->  STEP-28
   STEP-26 (repo hygiene)    ->  (independent)
```

---

## Wave A — Ship-blocking correctness (backend only)

**Goal:** the app must not corrupt models, lie about results, or be reachable by any website.
**Exit criterion:** `pytest backend/tests` green, master green, F-001…F-007 and F-011 closed.

| Step | Title | Findings | Effort | Depends on |
|---|---|---|---|---|
| [STEP-01](steps/STEP-01-ai-transform-units.md) | Fix AI copilot transform units and rotation origin | F-001 | 0.5 d | — |
| [STEP-29](steps/STEP-29-property-edit-persistence.md) | Property Inspector edits must actually persist | F-066 | 0.5 d | — |
| [STEP-03](steps/STEP-03-atomic-writes-and-locking.md) | Atomic writes + per-project write lock | F-002 | 1.5 d | — |
| [STEP-04](steps/STEP-04-event-loop-offload.md) | Move IfcOpenShell off the event loop + model cache | F-004 | 2 d | — |
| [STEP-05](steps/STEP-05-cors-and-auth.md) | CORS lockdown, auth token, WS Origin check | F-003 | 1 d | — |
| [STEP-06](steps/STEP-06-clash-correctness.md) | Clash detection must actually examine walls | F-005 | 1.5 d | — |
| [STEP-07](steps/STEP-07-column-count-regression.md) | Resolve the column-count regression | F-011 | 0.5 d | — |
| [STEP-02](steps/STEP-02-single-commit-path.md) | One commit path per transform | F-002, F-018 | 1 d | STEP-03, STEP-04 |

**Parallelisation:** STEP-01, STEP-29, STEP-03, STEP-04, STEP-05, STEP-06, STEP-07 touch disjoint
files and can run concurrently by seven people. STEP-02 must follow STEP-03 and STEP-04.

**Order inside a step:** STEP-03 (atomic write) before STEP-04 (cache) — the cache assumes a single
writer per project.

**Note on STEP-29:** it was found during audit reconciliation, not in the original four-lane audit.
It is included in Wave A because the Property Inspector's core action (editing a value) does not
work at all, and it is a half-day fix.

---

## Wave B — Feature correctness at real scale

**Goal:** features must work on the models users actually have, and must be reversible.
**Exit criterion:** F-006…F-010, F-016, F-017, F-018, F-031 closed; a 50k-element performance budget
exists and is asserted in CI.

| Step | Title | Findings | Effort | Depends on |
|---|---|---|---|---|
| [STEP-10](steps/STEP-10-undo-and-confirmation.md) | Product-wide undo + destructive-action confirmation | F-007 | 3 d | STEP-02 |
| [STEP-08](steps/STEP-08-batched-mesh-visibility.md) | BatchedMesh visibility, isolation, render styles | F-006 | 2 d | — |
| [STEP-09](steps/STEP-09-drawings-correctness.md) | Drawings: storey elevation, state sync, sheet deletion, scale, print | F-010, F-028, F-030 | 3 d | — |
| [STEP-13](steps/STEP-13-websocket-resilience.md) | WS reconnect, COMMIT_REJECTED, lock lifecycle | F-017, F-018, F-046 | 2 d | STEP-02, STEP-05 |
| [STEP-14](steps/STEP-14-element-details-race.md) | Fix the element-details request race | F-016, F-036 | 1 d | — |
| [STEP-15](steps/STEP-15-spatial-tree-virtualization.md) | Virtualise the spatial tree | F-031 | 2 d | STEP-27 |
| [STEP-27](steps/STEP-27-frontend-test-infrastructure.md) | Frontend test infrastructure (jsdom + testing-library) | F-061, F-062 | 1 d | — |
| [STEP-23](steps/STEP-23-viewport-performance.md) | Hover throttle, geometry disposal, scene teardown, Escape | F-033…F-038 | 3 d | STEP-08 |
| [STEP-24](steps/STEP-24-drawings-perf-and-a11y.md) | Drawings render performance + modal accessibility | F-029, F-032, F-041 | 1.5 d | STEP-09 |

---

## Wave C — Hardening and consistency

**Goal:** the app must be safe to expose to a real team and honest about its own limits.

| Step | Title | Findings | Effort | Depends on |
|---|---|---|---|---|
| [STEP-16](steps/STEP-16-ifczip-upload.md) | Support `.ifczip` uploads | F-012 | 1 d | — |
| [STEP-17](steps/STEP-17-copilot-intent-and-confirmation.md) | Copilot intent matching + write confirmation | F-013, F-025, F-047 | 2 d | — |
| [STEP-18](steps/STEP-18-ifc-schema-validity.md) | `value_type` literal, OwnerHistory, schema validation | F-014, F-015, F-043, F-064 | 2 d | — |
| [STEP-19](steps/STEP-19-audit-timeline.md) | Audit timeline classification + stable IDs | F-022, F-023 | 1.5 d | — |
| [STEP-20](steps/STEP-20-security-hardening.md) | SSRF, secret in URL, path containment, upload limits | F-019, F-020, F-026, F-027, F-045 | 2 d | STEP-05 |
| [STEP-21](steps/STEP-21-wall-geometry-resize.md) | Wall/slab resize must change geometry | F-021 | 2 d | STEP-10 |
| [STEP-22](steps/STEP-22-opening-storey.md) | Openings must use the host wall's storey | F-024 | 0.5 d | — |

---

## Wave D — Hygiene, infrastructure, ergonomics

**Goal:** make the codebase cheap to change and the product cheap to learn.

| Step | Title | Findings | Effort | Depends on |
|---|---|---|---|---|
| [STEP-25](steps/STEP-25-dead-code-removal.md) | Delete unreachable UI | F-055, F-056 | 1 d | — |
| [STEP-26](steps/STEP-26-repo-hygiene.md) | Repository and process hygiene | F-053, F-054, F-057…F-060, F-063 | 1.5 d | — |
| [STEP-11](steps/STEP-11-omnibar-ctrl-k.md) | Make Ctrl+K open the command palette | F-008 | 0.5 d | — |
| [STEP-12](steps/STEP-12-coordinate-hud-visible.md) | Make the coordinate HUD visible | F-009 | 0.5 d | — |
| [STEP-28](steps/STEP-28-onboarding-and-ergonomics.md) | Onboarding, shortcuts, save indicator, touch targets | F-042, F-048…F-052 | 3 d | STEP-11, STEP-12, STEP-25 |

---

## Items explicitly **not** planned here

These are architectural decisions for a later quarter, not defects. They are recorded so nobody
"fixes" them by accident:

- **CRDT/OT collaboration layer** — soft-locking is the right model for coarse BIM edits
  ("move this wall", "set this pset"). A CRDT would not make `IfcLocalPlacement` entities
  mergeable. Revisit only if real teams report daily lock contention; the likely answer then is
  finer-grained locks (per-storey / per-system), not CRDTs.
- **Keeping Xeokit** — see the note in `USER-NEEDS.md`. The second renderer is fed the same
  web-ifc geometry with `Array.from(Float32Array)` conversion and has no XKT, no tiles, no
  streaming. Consolidate on Three.js, or reintroduce Xeokit correctly as a server-converted
  **read-only** review mode.
- **An element index store (SQLite/DuckDB per project)** — the single highest-leverage *later*
  change; it turns the IFC file from the query substrate into the export artifact and makes the
  copilot cheap and safe. Requires STEP-01…STEP-06 to land first.
- **More Revit/Archicad/Tekla mimicry palettes**, new UI themes, further drawings/sheets
  expansion, and any new "phase" feature until the 50k-element budget passes in CI.

---

## Proposed performance budget (assert in CI)

Introduce with STEP-04, assert from STEP-08 onward. Targets on a mid-range workstation,
federated 50k-element model:

| Metric | Target | Where enforced |
|---|---|---|
| First pixels (parse → first frame) | < 5 s | STEP-04 / perf suite |
| Full interactive load | < 15 s | STEP-04 / perf suite |
| Orbit / pan / zoom | ≥ 30 fps (60 at ≤ 10k) | STEP-08 / perf suite |
| Hover raycast | < 16 ms/frame | STEP-08 |
| Click → property panel | < 200 ms | STEP-04 (model cache) |
| Gizmo commit ack | < 500 ms | STEP-02 + STEP-03 |
| Backend health latency during any request | < 200 ms | STEP-04 (event-loop offload) |

The last row is the cheapest to assert and catches the whole class of F-004 regressions:

```python
# while a spatial-tree request is in flight, /health must stay responsive
assert max_health_latency_ms < 200
```

---

## Change-control rules

1. **Do not ship BIM-logic changes inside UI commits.** F-011 was caused by exactly this.
   A commit that touches `backend/app/services/ifc_service.py`, `cad_service.py` or
   `ai_service.py` must not also touch `frontend/src/components/**`.
2. **Never assert a status code where the behaviour is the contract.** The `PATCH /geometry`
   bug (F-021) passes a status-code-only test. Property/geometry assertions must check the
   IFC entity, not the HTTP status.
3. **Every new AI tool that writes must be undoable and confirmed.** F-001, F-013.
4. **Every new endpoint must be authenticated.** F-003.
5. **A claim of "no clashes", "no errors", or "success" must carry a completeness signal**
   (`elements_checked`, `sampled`, `skipped`). F-005.
