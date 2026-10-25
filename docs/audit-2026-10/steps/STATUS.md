# Step status board

> **Scope decision (2026-10-25): all waves executed.** Wave A (STEP-01…STEP-07, STEP-29),
> Wave B (STEP-08…STEP-15, STEP-23, STEP-24, STEP-27), Wave C (STEP-16…STEP-22) and
> Wave D (STEP-11, STEP-12, STEP-25, STEP-26, STEP-28) were all implemented in one pass.
> Every row below is `done` except where noted. Per-step evidence lives in the step documents
> (`## Notes`) and in `notes/STEP-*.md`.

Update this table as steps complete. Add the date, the findings closed and a link to the change.

| Step | Title | Wave | Status | Findings | Completed | Change |
|---|---|---|---|---|---|---|
| [STEP-01](STEP-01-ai-transform-units.md) | Fixed AI transform units and rotation origin | A | done | F-001 | 2026-10-25 | World matrix via `get_local_placement`; metre→project-unit delta; rotation applied to the orientation block only; zero-delta writes skipped |
| [STEP-02](STEP-02-single-commit-path.md) | One commit path per transform | A | done | F-002, F-018 | 2026-10-25 | `handleTransformEnd` performs one write (WS when a client exists, REST otherwise), pre-drag matrix rollback + visible error; REST placement rejects a foreign soft lock with 409 |
| [STEP-03](STEP-03-atomic-writes-and-locking.md) | Atomic writes + per-project lock | A | done | F-002, F-026 | 2026-10-25 | `atomic_store.py` (temp → fsync → `os.replace`, cache invalidation) and one bounded per-project `asyncio.Lock`; every service write routed through it; `get_project_file_path` UUID + containment |
| [STEP-04](STEP-04-event-loop-offload.md) | Event-loop offload + model cache | A | done | F-004 | 2026-10-25 | Bounded 2-worker IFC pool (`run_ifc`), LRU model cache keyed `(mtime_ns, size)`; `/health` worst case during a large spatial-tree request 1,435 ms → 15 ms |
| [STEP-05](STEP-05-cors-and-auth.md) | CORS lockdown, token, WS Origin | A | done | F-003 | 2026-10-25 | No wildcard / no cross-origin credentials; per-install `storage/.api_token` required on `/api`; Origin-gated bootstrap; WS Origin checked before accept; frontend/QA/CI send the token |
| [STEP-06](STEP-06-clash-correctness.md) | Clash detection examines walls | A | done | F-005 | 2026-10-25 | Every target element boxed (no cap), explicit Body reps, failures counted, self-pairs skipped, `elements_checked`/`sampled`/`geometry_failures` exposed; Duplex now returns 447 wall-involving clashes with 0 geometry failures |
| [STEP-07](STEP-07-column-count-regression.md) | Column-count regression (green master) | A | done | F-011 | 2026-10-25 | `column_grid()` 2×2 (4/storey) generator; chat/prose/element_count derive from the actual result; `test_phase6` green |
| [STEP-29](STEP-29-property-edit-persistence.md) | Property Inspector edits persist | A | done | F-066 | 2026-10-25 | POST + `property_name` + `value_type` via a pure builder, unchanged values skipped, failures revert and show an inline persistent error |
| [STEP-08](STEP-08-batched-mesh-visibility.md) | BatchedMesh visibility and isolation | B | done | F-006 | 2026-10-25 | `instanceVisibility` module + batch registry; `setVisibleAt`/`setColorAt` per instance; category hide, isolate and federation hide now render; hidden elements no longer get a highlight |
| [STEP-09](STEP-09-drawings-correctness.md) | Drawings correctness | B | done | F-010, F-028, F-030 | 2026-10-25 | Derived sheet state, correct delete-first-sheet, storey elevation (backend + worker, project units), building-fit scale, real `@page` print size |
| [STEP-10](STEP-10-undo-and-confirmation.md) | Product-wide undo + confirmation | B | done | F-007 | 2026-10-25 | Whole-file undo/redo snapshots (20 files / 200 MB, same express ids on redo); property + REST placement transactions; shared destructive dialog at all delete call sites; visible undo/redo failures |
| [STEP-11](STEP-11-omnibar-ctrl-k.md) | Ctrl+K opens the palette | D | done | F-008 | 2026-10-25 | `resolveOmnibarShortcut` + required `onOpen`, wired in App |
| [STEP-12](STEP-12-coordinate-hud-visible.md) | Visible coordinate HUD | D | done | F-009 | 2026-10-25 | Visible, non-interactive, `aria-live="off"` coordinate chip fed by a tested formatter; matches the QA harness text contract |
| [STEP-13](STEP-13-websocket-resilience.md) | WS reconnect and lock lifecycle | B | done | F-017, F-018, F-046 | 2026-10-25 | Backoff reconnect + outbox + `COMMIT_REJECTED` handling; canonical int locks, 120 s TTL, duplicate-JOIN `SUPERSEDED` + 4001 + unlock broadcast; HEADER `onCommitRejected` restores the authoritative pose |
| [STEP-14](STEP-14-element-details-race.md) | Element-details request race | B | done | F-016, F-036 | 2026-10-25 | Sequence-guarded single-flight loader; inspector consumes `details` props (zero duplicate GETs) and never renders another element's data |
| [STEP-15](STEP-15-spatial-tree-virtualization.md) | Virtualised spatial tree | B | done | F-031 | 2026-10-25 | One-pass search index + flattened visible rows + windowed rendering with spacers; scroll anchoring on toggle |
| [STEP-16](STEP-16-ifczip-upload.md) | `.ifczip` upload support | C | done | F-012 | 2026-10-25 | Magic-byte detection, bounded extraction (members/bytes/ratio), stored STEP on project + federation paths |
| [STEP-17](STEP-17-copilot-intent-and-confirmation.md) | Copilot intent + write confirmation | C | done | F-013, F-025, F-047 | 2026-10-25 | Anchored intent matcher (interrogative/delete guards), write tools gated by `confirm_writes`, bounded tool-feedback round, errors surfaced inline |
| [STEP-18](STEP-18-ifc-schema-validity.md) | IFC schema validity | C | done | F-014, F-015, F-043, F-064 | 2026-10-25 | `value_type` Literal + service allowlist/coercion; OwnerHistory only where mandatory (no schema upgrade); schema version validated with directory rollback; ValueError → 422 |
| [STEP-19](STEP-19-audit-timeline.md) | Audit timeline classification | C | done | F-022, F-023 | 2026-10-25 | CRC32-stable ids, `status`/`change_kind`, shared classifier (deletes classified correctly), `refresh_project_metrics` after every CAD/undo/redo write |
| [STEP-20](STEP-20-security-hardening.md) | SSRF, secrets, paths, upload limits | C | done | F-019, F-020, F-026, F-027, F-045 | 2026-10-25 | `net_guard.py` outbound URL policy (cloud hosts fixed, local providers validated), Gemini key moved to header, 250 MB chunked federation cap, fixed client-facing 500 text + server-side path logging; F-019's per-user quota remains a documented follow-up |
| [STEP-21](STEP-21-wall-geometry-resize.md) | Wall/slab resize changes geometry | C | done | F-021 | 2026-10-25 | Extruded-solid depth/profile edits in project units, verify-on-disk, property writes only after geometry, `409 unsupported_geometry` + byte-identical file on unsupported bodies |
| [STEP-22](STEP-22-opening-storey.md) | Opening uses the host wall's storey | C | done | F-024 | 2026-10-25 | Filling is contained in `get_container(wall)` with a warned fallback; opening never enters a spatial container |
| [STEP-23](STEP-23-viewport-performance.md) | Viewport performance + disposal | B | done | F-033…F-038 | 2026-10-25 | Hover scheduler (rAF + dedupe), shared-geometry highlight disposal, edge-geometry cache, idempotent scene teardown, live navigation tuning, Escape deps fixed |
| [STEP-24](STEP-24-drawings-perf-and-a11y.md) | Drawings perf + modal a11y | B | done | F-029, F-032, F-041 | 2026-10-25 | Two batched `<path>` per viewport, one-view-per-rAF cache merge, native non-passive wheel zoom, focus trap/restore + local Escape, App escape guard includes the modal |
| [STEP-25](STEP-25-dead-code-removal.md) | Delete unreachable UI | D | done | F-055, F-056 | 2026-10-25 | 26 modules / 9,275 lines deleted (`mockup/`, `archive/`, `CadToolbar`, `GlassNavRail`, `SpatialTopPill`, `ContextualModifyBar`, `PropertyInspector`, `SpatialTree`, `PetPalette`, `SelectionContextOverlay`); stale tsconfig exclude dropped; import-graph guard now has zero exemptions |
| [STEP-26](STEP-26-repo-hygiene.md) | Repository and process hygiene | D | done | F-053, F-054, F-057…F-060, F-063 | 2026-10-25 | Hygiene gate + wrapper; index 401→158 files, 239.5→63.1 MB; counts 372/123/246; handoff open items restored; QA artefacts under `qa_runs/`; `AutoTest-` cleanup enforced |
| [STEP-27](STEP-27-frontend-test-infrastructure.md) | Frontend test infrastructure | B | done | F-061, F-062 | 2026-10-25 | jsdom + Testing Library + setup + smoke test; `test:watch`; lockfile tracked; Vitest step in `ci_verify.ps1` |
| [STEP-28](STEP-28-onboarding-and-ergonomics.md) | Onboarding and ergonomics | D | done | F-042, F-048…F-052 | 2026-10-25 | Shortcut registry + legend, `query` first-run profile + onboarding card, save-status pill on every element write, whole-model omnibar with "+N more", focus-trapped dialogs, 44 px coarse targets, tested orbit/touch config |

## Status vocabulary

- `not started` — no work begun.
- `in progress` — the failing test exists and fails for the stated reason.
- `blocked` — a dependency or a decision is outstanding; name it in the Change column.
- `done` — test green, regression guard green, finding closed, handoff entry written.

## Wave exit criteria

- **Wave A** — `pytest backend/tests` fully green; F-001…F-007, F-011 and F-066 closed.
- **Wave B** — a 50k-element performance budget asserted in CI; F-006, F-008…F-010, F-016, F-017, F-031 closed.
- **Wave C** — every endpoint authenticated and bounded; no silent partial results; F-012…F-015, F-019…F-027, F-029 closed.
- **Wave D** — no unreachable module in `frontend/src`; repo under 100 MB tracked; the docs' test counts match reality.

## Final verification (2026-10-25)

- Backend: `backend/venv/Scripts/python.exe -m pytest backend/tests -q` — **173 passed**.
- Frontend: `cd frontend; pnpm exec vitest run` — **24 files / 173 tests passed**; `pnpm exec tsc -b --noEmit` clean; `pnpm build` succeeds.
- Static gates: `python scripts/gates/run_gates.py` — 6/6 passed.
- UI pipeline: `.\scripts\ui_pipeline.ps1 -Tier quick` — Stage 1/2/3 passed.
- Live browser (Chrome via CDP, auth enabled): `qa_runner.py run --range TC-001:TC-015 --browser` and `--range TC-036:TC-056 --browser` — **36/36 passed**, including canvas mount, sample load, export, gizmo placement sync, property edit persistence, sectioning, measurement and Ctrl+K.
- Two findings had no step assigned and were closed during integration: **F-039** (diagnostics monkey-patch now `import.meta.env.DEV` only) and **F-044** (BCF audit routes return 404 for an unknown/invalid project instead of a 500).
- Browser smoke also found and closed a latent 500 (`GET /elements/{id}` on a non-product instance now 404) and two token-blind QA utilities; see `DEVELOPMENT_HANDOFF.md` (2026-10-25 entry).
- Working tree: nothing committed. `git status` contains the implementation diff, STEP-25/26's staged deletions and the new test files.
