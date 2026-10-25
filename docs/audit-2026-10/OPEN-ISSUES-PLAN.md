# Open issues after the 2026-10-25 remediation

**Baseline:** commit `ec59481` on `master` (all 28 documented steps + STEP-29 landed; 66 findings closed).
**Purpose:** the audit is complete; this document is the backlog that remains. Items are drawn from the
"Open" entries in `steps/notes/STEP-*.md`, re-checked against the committed tree.

Legend: **P1** blocks real work · **P2** correctness/trust · **P3** quality. Effort is S (<½ day),
M (½–2 days), L (>2 days) for a human working with AI, including tests.

---

## 0. Stale "Open" entries — already closed, do not re-open

The per-step notes were written while lanes were still running. These are done in `ec59481`:

| Note | Was | Now |
|---|---|---|
| STEP-02 note | REST placement lock check deferred | 409 lock check implemented in `api/projects.py`, verified by `test_step02_single_commit_path.py` (4 passed) |
| STEP-10/11/12/13/14/24/28 notes | App.tsx wiring deferred | All wiring applied; frontend 24 files / 173 tests and live browser cases green |
| STEP-13 note | backend lock work deferred | Implemented in `websocket_manager.py` / `websocket.py`; `test_step13_ws_room.py` 5 passed |
| STEP-18/19/10-backend notes | full backend suite not run | `pytest backend/tests` 173 passed at the integration gate |
| STEP-27 note | `frontend/pnpm-lock.yaml` not tracked | Committed in `ec59481` |
| STEP-06 note | pending review/merge | Merged. Only the castle timing remains (item 11) |
| STEP-09/STEP-21/STEP-24 notes | deferred App/backend one-liners | Landed; the remaining items are those listed below |

Genuinely open work starts at §1.

---

## 1. CAD geometry correctness (P1/P2) — do first

| # | Issue | Evidence | Fix | Effort |
|---|---|---|---|---|
| 1.1 | **P1** Partial column resize destroys untouched dimensions. `{"height": 4.0}` on a 0.4×0.4×3.0 column rebuilds it 0.35×0.35×4.0. | STEP-21 note; probe `[0.4,0.4,3.0]` → `[0.35,0.35,4.0]` | Read current profile/mesh extents before rebuild; reuse when `width`/`depth` absent (or return 409 when omitted). Add a partial-update test. | S |
| 1.2 | **P2** `create_slab` / `create_column` pass metres into `_create_box_mesh` (project units). On MILLI models a 3 m column is 3 mm. Creation and resize now disagree. | STEP-21 note | Divide by `calculate_unit_scale` at both creation sites, mirroring the resize branch; add MILLI slab/column tests. | S |
| 1.3 | **P2** Geometry-refusal is honest on the wire but invisible in the UI: `new Error(err.detail)` stringifies the 409 object to `[object Object]`, and `handleUpdateGeometry` only `console.error`s. | `api.ts:457-472`, `useCadDraftingMachine.ts:402-417` | Read `detail.message` when `detail` is an object; push a user message; expose `code` so the dock can disable height/thickness for non-resizable selections. | S |
| 1.4 | **P2** Host resize does not revalidate openings: a shortened wall can be shorter than its door; a thickness change can leave the void wider than the wall. | STEP-21 note (a) | Validate openings after resize; warn in the response, or clamp; add a resize-with-opening test. | M |
| 1.5 | **P1** Existing projects still have every opening in `storeys[0]` (fix is forward-only). | STEP-22 note | Idempotent repair script (dry-run, `.bak`) or `POST /cad/repair-containers` surfaced as an explicit project action; never run on open. | M |
| 1.6 | **P3** Walls assigned straight to `IfcBuilding` fall back to `storeys[0]` (wrong if the first storey is a basement). | STEP-22 note | Match the nearest storey by elevation before falling back. Only if a real model shows it. | S |
| 1.7 | **P3** `409` is used for both unsupported geometry and failed placement; step spec 7 asked for 422 on placement failure. | STEP-21 note (b) | Product decision: keep one "geometric edit refused" code or add `GeometryUpdateFailed → 422`. | S |

**Acceptance:** partial column resize changes exactly one dimension; MILLI creation matches MILLI resize;
a 409 raises a visible message in the browser; the repair script is dry-run by default and covered by a test.

---

## 2. Performance and durability (P1/P2)

| # | Issue | Evidence | Fix | Effort |
|---|---|---|---|---|
| 2.1 | **P1** Clash check is a full synchronous scan: 47.6 s on `Ifc4_Revit_ARC.ifc` (283 elements, 13.6 MB); the 49 MB castle is unmeasured. | STEP-06 note | Move to a background job with progress/polling, or add a spatial hash broad phase; keep `sampled: true` if any cap is reintroduced. Measure the castle before choosing. | L |
| 2.2 | **P2** `refresh_project_metrics` re-parses `model.ifc` on every CAD write (73 ms on 12 elements; seconds on 48 MB). Every gizmo commit pays it. | STEP-19 note | Take `element_count` from the model cache (STEP-04) or delta it (+1/-1) per transaction; keep the full parse for import only. Assert gizmo ack < 500 ms on the castle. | M |
| 2.3 | **P2** Undo depth is ~10 actions (20 files shared with post-images); an older delete answers `success:false`. | STEP-10 note | Separate post-image budget/subdirectory, or raise the file cap after measuring the 48 MB sample; document the chosen depth. | S/M |
| 2.4 | **P2** No 50k-element performance budget in CI (Wave B exit criterion). | ROADMAP §performance budget | Add a perf suite asserting: first pixels < 5 s, full load < 15 s, orbit ≥ 30 fps, hover < 16 ms, click→panel < 200 ms, health < 200 ms. | L |
| 2.5 | **P2** 2-worker IFC pool is a throughput ceiling: a clash check plus a spatial-tree read occupy both slots; reads serialise with writes per project. | STEP-03/04 notes | Revisit only with a RAM budget; consider a separate read pool or an explicit queue metric. | M |
| 2.6 | **P3** Cache is 4 models / 768 MB; executor is process-wide and never shut down. | STEP-04 note | Add cache/queue metrics to `/health`; make limits configurable. | S |
| 2.7 | **P3** Clash completeness fields were not added to `frontend/src/types/ifc.ts`. | STEP-06 follow-up (4) | Mirror the three fields and drop the local type in `ClashInspector`. | S |

**Acceptance:** clash on the 49 MB castle completes within an agreed budget or reports progress; gizmo
commit ack < 500 ms on the largest fixture; CI fails on a 50k budget regression.

---

## 3. Security, identity, collaboration (P2)

| # | Issue | Evidence | Fix | Effort |
|---|---|---|---|---|
| 3.1 | **P2** F-019 quota half open: the install token gates access but there is no per-user AI quota/rate limit; a caller with the token can spend the server's provider quota. | STEP-20 note | Token-bucket per token/IP + a spend cap; persist counters. | M |
| 3.2 | **P2** WS TTL purge is not broadcast, so a remote client keeps a stale lock badge; duplicate-JOIN `SESSION_REPLACED`/`4001` has no committed socket-level test. | STEP-13 backend note | Broadcast `ELEMENT_UNLOCKED` for ids returned by `cleanup_stale_locks()` on the next frame; promote the throwaway handshake probe into `test_step13_ws_room.py`. | S |
| 3.3 | **P2** No WS heartbeat/PING-PONG: a half-open socket keeps its session and locks until TCP notices. | STEP-13 non-goal | Add ping every 30 s, drop after two misses; unlock on close (already identity-checked). | S |
| 3.4 | **P2** In-process lock is not enough if a second uvicorn worker is added. | STEP-03 note | Enforce a single worker in config/docs, or add an OS file lock (`msvcrt.locking`/`portalocker`). | M |
| 3.5 | **P2** `user_id` on WS frames is client-supplied and spoofable; presence/locks are advisory. | STEP-05/13 notes | Issue a signed session id at bootstrap; keep the protocol shape. | M |
| 3.6 | **P3** Token bootstrap is per-tab; a local same-user process can read `storage/.api_token`; DNS-rebinding window remains (URL validated, then resolved). | STEP-05/20 notes | Single-flight across tabs (BroadcastChannel/localStorage), pin the resolved IP for the outbound request, document the local threat model. | M |
| 3.7 | **P3** No dependency CVE scan in CI. | audit §7 (not verified) | Add `pip-audit` + `pnpm audit --prod` as a non-blocking report, blocking on high/critical. | S |
| 3.8 | **P3** Foreign-Origin WS is refused as an HTTP 403 handshake error, not a 1008 close. | STEP-05 follow-up | Security-equivalent; either document it as the contract or accept-then-close if a test needs 1008. | S |

**Acceptance:** a second socket taking over a session is covered by a committed test; TTL expiry produces
an unlock broadcast; CI fails on a high CVE.

---

## 4. Test and browser coverage (P2/P3)

| # | Issue | Evidence | Fix | Effort |
|---|---|---|---|---|
| 4.1 | **P2** Only 36 of 372 cases have been run in a live browser (all green), and only manually. | Final verification | Wire `qa_runner.py run --tier key --browser` into CI against a started backend/frontend (token-aware). | M |
| 4.2 | **P2** No end-to-end two-client coverage for reconnect, `COMMIT_REJECTED`, `SESSION_REPLACED`, or the delete-confirmation dialog. | STEP-10/13 notes | Playwright/CDP fixture with two pages; assert rejection message + snap-back, 4001, and no delete on cancel. | M |
| 4.3 | **P3** STEP-14 "zero GETs when details are props", STEP-15 windowing, STEP-23 Escape and STEP-28 44 px are acceptance-only (no tests). | notes | Component tests with jsdom for 14/15/28; Playwright (WebGL) for 23. | M |
| 4.4 | **P3** `test_step06_clash_correctness.py` canonical copy and the step doc still double-count walls (`IfcWall` + `IfcWallStandardCase`); the repo copy is fixed. | STEP-06 note | Correct the shipped docs test (57 unique walls) so a future copy does not reintroduce `>= 113`. | S |
| 4.5 | **P3** `test_cad_and_clash.py` audit block asserts diff shape only; create→delete→diff is not covered. | STEP-19 note | Add the create→delete→diff assertion. | S |
| 4.6 | **P3** STEP-22 test pattern can drop a model and crash the interpreter; lifetime is ad hoc. | STEP-22 note | `conftest.py` fixture yielding `(model, entity_by_id)`; assert model open before use. | S |
| 4.7 | **P3** STEP-11/12 tests assert source shapes (`toFixed`, bare X/Y/Z) rather than behaviour. | STEP-11/12 notes | Replace with behavioural assertions on the resolver/formatter and the rendered HUD. | S |
| 4.8 | **P3** `updateHoverAtScreenCoordsRef` is declared/read but never assigned — hover does not return after an MMB orbit until the next real move. | STEP-23 note | Assign it to a direct `applyHoverNotification(updateHoverAtScreenCoords(...))`; browser-verify. | S |

**Acceptance:** CI runs the key browser tier; two-client tests cover reconnect/rejection/confirmation;
the remaining acceptance-only items have at least one automated assertion each.

---

## 5. Repository and UX hygiene (P2/P3)

| # | Issue | Evidence | Fix | Effort |
|---|---|---|---|---|
| 5.1 | **P2** 7 fixtures > 5 MB are untracked-but-on-disk; a fresh clone cannot run the fixture tests. Smaller fixtures still tracked (6.1 MB). | STEP-26 note | Product decision: Git LFS vs release assets; document the download step. Do not invent a URL. | S (decision) |
| 5.2 | **P2** `/modelsfortests/*` runtime fetch 404s in dev (Vite serves `frontend/public/`), and the failure is swallowed. | STEP-26 note | Serve fixtures explicitly in dev or move them behind the sample API; remove the dead code path if not. | S |
| 5.3 | **P3** `.git` history still holds ~175 MB of IFC blobs; a green hygiene gate is not a small clone. | STEP-26 note | Coordinated `git filter-repo` + force-push (team decision); state the size in README until then. | L |
| 5.4 | **P3** 30 legacy non-`AutoTest-` projects remain in the user's list (by design; never auto-deleted). | STEP-26 note | Ask the user which to archive/delete; the cleanup tool already supports explicit `--names`. | S (decision) |
| 5.5 | **P3** ~10 UI surfaces still use one-off slate/rose classes rather than design tokens; 44 px and HUD collisions were verified by CSS reasoning, not rendered. | STEP-28/design review | Tokenise the remaining colours; render-check 1024×768, 1280×800 and iPad emulation. | S |
| 5.6 | **P3** `showCadToolbar` is now a dead profile flag (CadToolbar deleted). | STEP-25 note | Settings migration to remove it, or reuse it for the dock. | S |
| 5.7 | **P3** Full-state persistence is still missing: drawing sheets are session-only; no autosave/revision list beyond the save pill. | F-050 / STEP-09 non-goal | Persist sheets/views with the project; decide autosave semantics. | M |
| 5.8 | **P3** AI/copilot writes are confirmed but not undoable; `update_geometry`, storey/material assignment and pinning still create no transaction. | STEP-10/17 notes | Extend `begin_snapshot → write → record_transaction` to those paths; add undo tests. | M |

**Acceptance:** a fresh clone can run fixture tests from the documented path; no 404 fixture fetch; the
remaining hard-coded colours are tokenised and the HUD collision check is screenshot-backed.

---

## Suggested sequence

1. **Hotfix pass (1–2 days):** 1.1, 1.2, 1.3, 2.3, 3.2, 4.4, 4.5, 4.8 — correctness and cheap honesty fixes.
2. **Data-integrity pass:** 1.4, 1.5, 1.6, 2.2, 5.8 — repair existing models and stop paying a full parse per write.
3. **Scale pass:** 2.1, 2.4, 2.5 — background clash, 50k budget in CI.
4. **Security pass:** 3.1, 3.3, 3.4, 3.5, 3.7 — quota, heartbeat, single-writer, signed sessions, CVE gate.
5. **Coverage pass:** 4.1, 4.2, 4.3 — key-tier browser in CI, two-client E2E, component acceptance tests.
6. **Hygiene pass:** 5.1–5.7 — fixture hosting, history decision, token/UX polish, sheet persistence.

## Decisions taken (2026-10-25)

1. **Fixture hosting:** local-only, no paid storage. `modelsfortests/` stays untracked on disk; README documents `IFC_FIXTURES_DIR`; the dev server serves it explicitly; tests skip with a message. No LFS.
2. **Git history:** rewrite. `modelsfortests/` and `.agents/` are removed from history, then the small (6 MB) fixtures are re-added at HEAD.
3. **Legacy projects:** archived (not deleted) to `storage/projects_archive/` with a JSON DB dump and manifest; `--restore <id>` verified.
4. **Column partial update:** preserve current extents.
5. **Audit diff:** `UNDONE` transactions disappear from the diff (pinned by test).
6. **Geometry error code:** one `409 unsupported_geometry` code for geometric refusals.

---

## Execution log (2026-10-25)

| Item | Status | Evidence / residual |
|---|---|---|
| 1.1 column extents | Done | `test_column_partial_resize.py`; partial edits preserve untouched dimensions |
| 1.2 MILLI parity | Done | `test_milli_element_creation.py`; the real defect was a double conversion in resize, fixed at `_create_box_mesh(unit_scale=1.0)` |
| 1.3 geometry error UX | Done | `step21.geometryErrorUx.test.tsx`; structured message + toast + disabled fields |
| 1.4 opening clamp | Done | `test_step21_opening_clamp.py`; warnings returned, never fails the resize |
| 1.5 opening repair | Done | `scripts/repair_opening_containers.py`; dry-run then applied: 15 fillings in 37 projects, second run 0 |
| 1.6 building-assigned wall | Done | `test_step22_building_wall_opening.py`; nearest storey by elevation |
| 2.1 clash jobs | Done | job API + polling; castle job 111 s, progress instead of a blocking request |
| 2.2 metrics without reparse | **Done, target missed** | 0 parses per write; castle gizmo ack is still ~34–39 s (full-file rewrite, not metrics). See residual R1 |
| 2.3 undo depth | Done | pre-images 20/200 MB, post-images 10/100 MB; ~20 undo / 10 redo |
| 2.4 perf budget in CI | **Done, frontend rows manual** | `backend/tests/perf`, `perf-budget` CI job, `scripts/perf_budget.py`; castle 4.9–5.3 s cold / 119–125 ms warm / health p95 13–17 ms; synthetic 50k 2.1–3.1 s; 50k health envelope 1.5 s. See residual R2 |
| 2.5 health metrics | Done | `/health` now reports `ifc` queue, `model_cache`, lock registry; public and parse-free |
| 2.6 cache/queue config | Partial | metrics exposed; limits remain class constants |
| 2.7 clash types | Done | shared `ClashCheckResponse` fields; local type removed |
| 3.1 AI quota | Done | 30 req/60 s sliding window on chat + model discovery; 429 + `Retry-After`; per-install in-memory |
| 3.2 TTL broadcast + socket test | Done | purge broadcast on every frame; `test_step13_ws_handshake.py` |
| 3.3 WS heartbeat | Done | 25 s PING, 60 s idle → 1001; client PONG |
| 3.4 single writer | Done | OS lock; second uvicorn exits 3 (live-verified with three processes) |
| 3.5 signed session | Done | HMAC token; browser JOINs require it; non-browser clients unchanged |
| 3.6 token hardening | Partial | per-tab single-flight + signed sessions; DNS pinning not implemented |
| 3.7 CVE gate | Done | `pip-audit` clean; `pnpm audit` high advisory fixed by `image-size@2.0.3` override; CI job + local script |
| 4.1 key browser in CI | Done (pre-existing) | `e2e-browser-qa` job already starts both servers and runs key/milestone tiers |
| 4.2 two-client coverage | Done (protocol) | `test_two_client_collab.py`: lock, LOCK_REJECTED, COMMIT_REJECTED, remote commit; no two-page browser test |
| 4.3 component/acceptance tests | Partial | Added inspector zero-GET, tree windowing, coordinate-HUD render tests; STEP-23 Escape remains review-only (needs WebGL) |
| 4.4 docs clash test | Done | 57 unique walls; docs copy corrected |
| 4.5 audit diff test | Done | create → delete → diff → undo cycle |
| 4.6 model-lifetime fixture | Not done | `test_step22` fixed locally; no shared fixture added |
| 4.7 weak tests | Partial | HUD render test added; source-shape assertions retained |
| 4.8 hover ref | Done | assigned to the scheduler sink |
| 5.1 fixtures | Done | README policy; no LFS |
| 5.2 `/modelsfortests` fetch | Done | Vite middleware + explicit "fixture missing" toast |
| 5.3 history rewrite | Done | filter-repo + force-push; small fixtures re-added |
| 5.4 legacy projects | Done | 34 archived, restorable |
| 5.5 design tokens | Done (code) | 6 surfaces tokenised; render/contrast checks remain manual |
| 5.6 `showCadToolbar` | Closed as no-op | The flag is live: it gates the custom-profile CAD dock; removal was reverted |
| 5.7 sheet persistence | Done | per-project versioned localStorage; no geometry cached |
| 5.8 undo coverage | Done | geometry/storey/material/AI actions; `pin_element` intentionally untransacted |

## Residuals (honest, not "done")

- **R1 — large-model commit latency.** A castle gizmo commit is still ~34–39 s: the file is opened,
  re-serialised and copied as a pre-image in full. Metrics parsing was removed from the hot path, but
  the single-file IFC substrate remains the limit. Next lever: incremental/delta persistence or an
  element-index store; that is an architectural change, not a hotfix.
- **R2 — 50k `/health` envelope.** p95 is 572–830 ms at 50k products (1.5 s budget) because the
  spatial tree builds 50,000 pydantic nodes and serialises them in one call; castle keeps the strict
  200 ms. Fix by returning plain dicts/streaming the tree. Frontend fps/hover budgets remain
  browser/manual.
- **R3 — quota/lock scope.** The AI quota and single-writer lock are process-local; the signed
  session is required only for browser JOINs (non-browser clients keep the old behaviour).
- **R4 — test reductions.** No two-page browser E2E; STEP-23 Escape and 44 px/contrast checks are
  review/CSS-reasoning only; 4.6 (shared model fixture) and 4.7's source-shape assertions remain.
- **R5 — token hardening.** DNS-rebinding pinning and a cross-tab single-flight bootstrap were not
  implemented; the token is still readable by a same-user local process.
- **R6 — history rewrite cost.** Old hashes are invalid; any clone/fork must re-clone or reset hard.
  The castle sample (47 MB) remains tracked at HEAD; only the duplicate/unused fixture history is gone.
