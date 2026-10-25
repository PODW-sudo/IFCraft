# Findings Register — IFC Editor

**Audit date:** 2026-10-24
**Commit audited:** `f5eec4c` (master) + uncommitted `drawings/` work in the working tree
**Scope:** `backend/app/**`, `frontend/src/**`, `scripts/**`, repo hygiene

## How to read this

Every finding has a stable ID (`F-NNN`). Steps in `steps/` reference these IDs.
Each finding carries a **verification status**:

| Marker | Meaning |
|---|---|
| **[V]** | Reproduced by the auditor directly (command + measured output in `VERIFICATION.md`) |
| **[L]** | Found by a specialist lane by reading code; line refs verified, behaviour not executed |
| **[R]** | Report/doc inconsistency or repo-hygiene observation (no code behaviour) |

Severity: **P0** ship-blocking · **P1** blocks real work · **P2** correctness/trust · **P3** quality/hygiene.

---

## P0 — Ship-blocking

### F-001 · AI copilot `transform_element` displaces elements ~1000× **[V]**
- **Code:** `backend/app/services/ai_service.py:828-868`; `backend/app/services/ifc_service.py:237-284` (writes, `is_si=True` at `:257`); `backend/app/services/ifc_service.py:286-325` (reads).
- **Defect:** `get_element_placement_matrix` returns the **relative** placement (parent chain ignored) in **project units**. `_exec_transform_element` mixes that with a **metre** delta (`T[0,3]=dx`), then writes it back through `update_element_placement(..., is_si=True)`, which multiplies translations by `1/unit_scale`. On millimetre models this is ×1000.
- **Second defect:** `M_new = T @ R @ M` (`:865`) rotates about the **world origin**, not the element origin.
- **Measured:** on `modelsfortests/Ifc4_Revit_ARC.ifc` (MILLI prefix), a **zero-delta** round trip moved a wall by **13,516 m**.
- **Impact:** "move this wall 2 m" flings it 2 km. No undo entry is written for AI edits.

### F-002 · Every gizmo drag rewrites the IFC file twice, concurrently **[V]**
- **Code:** `frontend/src/hooks/useGizmoTransform.ts:35` (WS `commitTransform`) and `:38` (`POST /api/projects/{id}/elements/{id}/placement`).
- **Both** reach `IFCService.update_element_placement` — via `backend/app/api/websocket.py:122` and `backend/app/api/projects.py:276`.
- **Defect:** the WS write is fire-and-forget and lands milliseconds before the HTTP write. Two concurrent full-file rewrites of the same file, per drag release, with no lock.
- **Impact:** torn/corrupt `model.ifc`; in BIM the model *is* the contractual document.

### F-003 · No authentication anywhere; wildcard CORS with credentials; WS has no Origin check **[V]**
- **Code:** `backend/app/core/config.py:31-37` (`"*"` in `CORS_ORIGINS`); `backend/app/main.py:36-42` (`allow_credentials=True`); `backend/app/api/websocket.py:14-16` (accepts before any project lookup, no Origin check); no `Depends`/security dependency in any `backend/app/api/*.py`.
- **Measured:** `GET /health` with `Origin: https://evil.example.com` returns `access-control-allow-origin: https://evil.example.com` + `access-control-allow-credentials: true`. Starlette mirrors the Origin because `"*"` is present.
- **Impact:** any website the architect visits can read, mutate and DELETE their local projects while the editor is open, and can rewrite element placements over the WebSocket.
- **Note:** the server binds `127.0.0.1`, so this is a *malicious-page-in-your-browser* attack, not a remote one. Still severe for a locally-installed app.

### F-066 · Editing a property value in the Property Inspector never persists **[V]**
- **Code:** `frontend/src/components/properties/GlassPropertyInspector.tsx:143-151` (the *edit existing value* path) vs `backend/app/api/projects.py:293` (the only route: `POST /{project_id}/elements/{express_id}/properties`).
- **Two independent defects in one call:**
  1. `method: 'PATCH'` — the backend defines only `POST`, so the request returns **405 Method Not Allowed**.
  2. body sends `name: prop.name` — `PropertyUpdatePayload` (`backend/app/models/schemas.py:52-56`) requires **`property_name`**, so even with POST it would return **422**.
- **The failure is swallowed:** `if (!res.ok) throw new Error('Failed to save property edit')` (`:153`) is caught at `:175-177` and only `console.error`'d. No user-visible error.
- **Note:** the *add new property* path at `:196-205` is correct (`POST` + `property_name` + `value_type`), and the older, now-dead `PropertyInspector.tsx:114-123` was also correct. The regression was introduced when `GlassPropertyInspector` was written.
- **Impact:** README feature 3 — "In-place editing of property values (Boolean, Integer, Real, Label) persisted directly to the active `.ifc` file" — **does not work at all**. The most common inspector action is a silent no-op.
- **Related:** the same file also issues a **second, duplicate** element-details fetch (F-036).

---

## P1 — Blocks real work

### F-004 · `ifcopenshell` runs on the event loop; opening a model freezes the whole backend **[V]**
- **Code:** `backend/app/api/projects.py:232` (`get_spatial_hierarchy`), `:251` (`get_element_details`), `:309` (`update_element_property`); `backend/app/services/project_service.py:85` (`validate_ifc`); `backend/app/api/federation.py:66`; `backend/app/services/clash_service.py:137`; `backend/app/services/bcf_service.py:164`; **all** of `backend/app/services/cad_service.py` (e.g. `:117-144`, `:638-672`).
- `asyncio.to_thread` is used in only **3** of ~35 call sites (`projects.py:276`, `websocket.py:122`, `ai_service.py:868`).
- **Measured:** `GET /spatial-tree` on the 49 MB castle → **9,352 ms**, during which concurrent `GET /health` went from 45 ms baseline to **8,231 ms**.
- **Impact:** every request and all WebSocket traffic stall while one user opens a model.

### F-005 · Clash detection never examines a single wall; silently caps and swallows failures **[V]**
- **Code:** `backend/app/services/clash_service.py:57` (`for prod in elements[:25]`), `:83-84` (blanket `except Exception: continue`), `:44-48` (overlapping target types → self-pairs), `:169` (type-equality guard misses self-pairs); response schema `backend/app/models/schemas.py:168-175`.
- **Measured:** `create_shape` fails for **25/25 walls** in `Ifc2x3_Duplex_Architecture.ifc` while slabs/doors/windows succeed (21/14/24). Live `POST /clashes/check` on that 57-wall model returned 110 clashes containing **zero `IfcWall` entries**.
- **Defect:** the response has no `elements_checked` / `sampled` / `skipped` field, so the UI presents a partial scan as complete.
- **Impact:** "0 hard clashes" is a false negative on the primary coordination category.

### F-006 · Category hide, isolate, federation hide and render styles do nothing on models > 150 elements **[V]**
- **Code:** `frontend/src/components/viewer/ThreeViewport.tsx:1496` (batch threshold), `:1569-1585` (proxies created with `proxy.visible = false`, **never added to the scene**), `:1698-1720` (visibility effect mutates only `mesh.visible` on those proxies).
- **Measured:** `setVisibleAt` appears **nowhere** in the codebase (0 matches).
- **Compounding:** picking *does* filter by category (`:337`), so hidden elements also become unselectable.
- **Impact:** on any real model the tree's isolate button, category toggles and federation hide are visually inert.

### F-007 · No undo and no confirmation for destructive edits **[V]**
- **Code:** undo/redo exists **only** for CAD transactions — `backend/app/api/cad.py:86-108`, `backend/app/services/cad_service.py` transaction log. `frontend/src/hooks/useCadDraftingMachine.ts:168` (`handleDeleteElement`) posts to the CAD delete endpoint; property edits, gizmo transforms and deletions create **no** undoable transaction.
- **Measured:** zero `window.confirm` and zero confirmation modals anywhere in `frontend/src`.
- **Triggers:** `frontend/src/App.tsx:873-877` (`Delete`/`Backspace` key), `frontend/src/components/viewer/ThreeViewport.tsx:4196` (context menu), `frontend/src/App.tsx:1635` (contextual modify dock).
- **Impact:** one stray keystroke permanently removes geometry. For a change-averse BIM audience this is the combination that ends trust.

### F-008 · `Ctrl+K` command palette does nothing **[V]**
- **Code:** `frontend/src/components/omnibar/SpatialOmnibar.tsx:54-60` — the `else` branch is empty (`// Open`), and the component receives **no `onOpen` prop** (`frontend/src/App.tsx:1795-1797`).
- The handler still calls `preventDefault()`, so the shortcut is a silent no-op.
- **Impact:** the advertised power-user entry point is dead. `test_cases.jsonl` TC-056 asserts it works.

### F-009 · Coordinate readout is invisible **[V]**
- **Code:** `frontend/src/components/hud/CoordinateHud.tsx:27-28` — `className="sr-only"` + `aria-hidden="true"`.
- The component computes live X/Y/Z and mesh count but renders them to screen readers only.
- **Contract:** `project.config.md` (Coordinate HUD UI cue) and TC-003 both specify a visible HUD.

### F-010 · Deleting the first drawing sheet silently breaks the sheet editor **[V]**
- **Code:** `frontend/src/components/drawings/DrawingSheetsModal.tsx:255-259`
  ```ts
  setSheets((prev) => prev.filter((s) => s.id !== id));
  setActiveSheetId(sheets[0].id);   // stale pre-delete array
  ```
- **Impact:** `activeSheetId` points at a deleted sheet; `handleUpdateCurrentSheet` (`:262-266`) matches nothing → sheet number, paper size, title, orientation and *Place View* all become silent no-ops, with no active tab highlighted.

### F-011 · The backend test suite is red on master, and CI runs it **[V]**
- **Code:** `backend/tests/test_phase6.py:92` asserts `len(cols) == 8`; `backend/app/services/ai_service.py:774-782` now generates 2 columns per storey for a 12×8 m building.
- **Root cause:** `git blame` → commit `580724b` *"feat(ui): implement Modern Glass Soft/Elegant UI layout"*. **A UI-layout commit changed BIM generation logic.**
- **CI:** `.github/workflows/qa-harness.yml` runs `pytest backend/tests -v` → master is red.
- **Related:** the `elif length >= 6.0 and width >= 5.0` branch emits **1** column; smaller buildings get **0** — while the copilot's chat text (`:1382`) always claims *"…floor slabs, and structural columns."*

---

## P2 — Correctness and trust

| ID | Finding | Code | Status |
|---|---|---|---|
| F-012 | `.ifczip` upload is accepted by validation then always fails 422 — the archive is saved as `model.ifc` and parsed as STEP | `backend/app/api/projects.py:114-119`, `backend/app/services/project_service.py:77-85` | [L] |
| F-013 | Deterministic copilot matches intent by raw substring: **"what is a house?"** runs `generate_building` and writes a building into the user's model; `"remove element 5"` matches `"move"` | `backend/app/services/ai_service.py:1354`, `:1386` | [L] |
| F-014 | Client-supplied `value_type` is used verbatim as an IFC **entity class name** — `{"value_type":"IfcWall"}` nests an `IfcWall` inside `IfcPropertySingleValue` | `backend/app/models/schemas.py:38`, `:56`; `backend/app/services/ifc_service.py:360`, `:380`, `:387` | [L] |
| F-015 | Property/pset creation on IFC2X3 omits mandatory `OwnerHistory` → schema-invalid export that strict receivers drop | `backend/app/services/ifc_service.py:356-373` | [L] |
| F-016 | Element-details fetch has no request-ordering guard — click A then B quickly and the inspector can display **A's data while B is selected**, so edits land on the wrong element | `frontend/src/hooks/useSpatialSelection.ts:47-67` | [L] |
| F-017 | WebSocket has no reconnect, no `onerror`, and `send()` silently drops messages while not OPEN | `frontend/src/services/collaboration.ts:147-149`, `:205-208` | [L] |
| F-018 | `COMMIT_REJECTED` from the server is unhandled client-side, **and** the REST placement path performs no lock check — so the rejected move is persisted anyway | `backend/app/api/websocket.py:112-117`; `frontend/src/services/collaboration.ts`; `backend/app/api/projects.py:260-290` | [L] |
| F-019 | SSRF via user-controlled `base_url`; the remote response body is echoed back to the caller. With no `api_key`, the server spends **its own** paid quota for any anonymous caller | `backend/app/services/ai_service.py:1042-1050`, `:1094-1254`; `backend/app/api/copilot.py:43-54` | [L] |
| F-020 | Gemini API key is transmitted in the query string → captured by httpx INFO logs | `backend/app/services/ai_service.py:1159` | [L] |
| F-021 | `PATCH /geometry` on a wall writes `Dimensions.Height` as a **property** but never changes the extruded solid's `Depth` — the panel says 5 m, the model stays 4 m, and the wrong model is exported | `backend/app/services/cad_service.py:782-806`; `backend/app/api/cad.py:146-161` | [L] |
| F-022 | Audit timeline classifies **every** `ACTIVE` transaction as "added" — including deletions — and IDs use salted `str.__hash__`, so they change on every restart | `backend/app/services/bcf_service.py:301`, `:335-356` | [L] |
| F-023 | `element_count` and `updated_at` go stale after CAD edits; CAD deletes are never audited | `backend/app/services/project_service.py:218-226`; `backend/app/services/cad_service.py:632-693` | [L] |
| F-024 | `create_opening` places the door/window in the **first** storey, not the host wall's storey | `backend/app/services/cad_service.py:306` | [L] |
| F-025 | Copilot tool results are never fed back to the model — no agent loop, so multi-step requests silently half-execute | `backend/app/services/ai_service.py:1125-1146` | [L] |
| F-026 | `project_id` is never validated as a UUID; `get_project_file_path` has no `resolve()` containment check | `backend/app/services/project_service.py:156-158` | [L] |
| F-027 | Federation upload has **no size limit**, buffers the whole body in RAM, and `.ifczip` extraction is unbounded (zip bomb) | `backend/app/api/federation.py:50-66` | [L] |
| F-028 | Drawing plan views are frozen at mount (before a model exists) → every plan is cut at a hard-coded **+1.2 m**; the title block reads "BIM Project" | `frontend/src/components/drawings/DrawingSheetsModal.tsx:78-90`, `:129`; `frontend/src/hooks/useSpatialSelection.ts:75`; `frontend/src/workers/ifcWorker.ts:222-227` (no `IfcBuildingStorey.Elevation` parsing) | [L] |
| F-029 | Drawings preview emits one `<line>` element per segment (the SVG *export* path already batches into a single `<path>`) and recomputes every view synchronously on any change | `frontend/src/components/drawings/DrawingSheetsModal.tsx:964-983`, `:207-222`; `frontend/src/services/drawingEngine.ts:367-372` | [L] |
| F-030 | Default sheet scale (`1000/vp.scale`) fits only 17.5 × 12 m; real buildings are clipped mid-wall. Print uses `@page { size: auto }` → output is neither A3 nor 1:100 | `frontend/src/services/drawingEngine.ts:341`, `:495-521`; `frontend/src/components/drawings/DrawingSheetsModal.tsx:143-165` | [L] |
| F-031 | Spatial tree is fully recursive and unvirtualised; search re-walks each subtree per rendered node per keystroke (O(n²)) | `frontend/src/components/tree/GlassSpatialTree.tsx:103-113`, `:112-193` | [L] |
| F-032 | Drawings dialog declares `aria-modal="true"` but has no focus trap, no focus restore and no local Escape handler; the global Escape guard omits `isDrawingSheetsOpen` | `frontend/src/components/drawings/DrawingSheetsModal.tsx:431-440`; `frontend/src/App.tsx:962-1009` | [L] |
| F-033 | Highlight overlays share the **model's** geometry, but `disposeHighlightGroup` calls `geometry.dispose()` on it → WebGL re-upload on every hover | `frontend/src/components/viewer/ThreeViewport.tsx:2207`, `:2383`, `:352-368` | [L] |
| F-034 | `pointermove` triggers a full-scene raycast plus a fresh `THREE.EdgesGeometry` per hover, with no rAF throttle and a new array identity per move → re-render storm of a 4,000-line component | `frontend/src/components/viewer/ThreeViewport.tsx:3196`, `:2815-2831`, `:2343` | [L] |
| F-035 | The viewport's Escape handler reads `interactiveEditState` but omits it from the dependency array → ESC cannot cancel an in-progress move/rotate | `frontend/src/components/viewer/ThreeViewport.tsx:2669-2764` | [L] |
| F-036 | The property inspector issues a **second**, identical element-details fetch instead of using the one `App` already holds; `onPropertyUpdated` is not wired | `frontend/src/components/properties/GlassPropertyInspector.tsx:90-115`; `frontend/src/App.tsx:1666-1673` | [L] |
| F-037 | The whole scene is rebuilt on project change but the teardown never disposes `meshesGroup` children or the three material pools, and `meshMapRef` is not cleared → monotonic WebGL memory growth | `frontend/src/components/viewer/ThreeViewport.tsx:1358-1412`, `:1413` | [L] |
| F-038 | `isLargeModel` is captured at first render (`[]`-scoped effect) → the adaptive large-model damping branch never activates | `frontend/src/components/viewer/ThreeViewport.tsx:895` | [L] |
| F-039 | `App.tsx` monkey-patches `console.error`, `window.onerror` and `unhandledrejection` at module scope and **ships to production bundles** | `frontend/src/App.tsx:70-92` | [L] |
| F-040 | Bare `g` toggles the grid on every keypress outside `INPUT`/`TEXTAREA` — including while typing a two-letter Revit command, and while a `<select>` has focus | `frontend/src/App.tsx:123-129`, `:892` | [L] |
| F-041 | `preventDefault()` inside a React `onWheel` handler is a no-op (React attaches wheel passively) and logs a console error that the QA gate may flag | `frontend/src/components/drawings/DrawingSheetsModal.tsx:363-367` | [L] |
| F-042 | The omnibar indexes only the first 50 geometries | `frontend/src/components/omnibar/SpatialOmnibar.tsx:152` | [L] |
| F-043 | `schema_version` is unvalidated → 500 after `project_dir.mkdir()` leaves an orphan directory with no DB row | `backend/app/services/project_service.py:22-36`; `backend/app/models/schemas.py:8` | [L] |
| F-044 | BCF endpoints take an unvalidated `project_id` → FK violation surfaces as 500 instead of 404 | `backend/app/api/bcf.py:26-30`, `:47-52` | [L] |
| F-045 | Absolute server filesystem paths leak to the client in error details | `backend/app/services/ai_service.py:619`; `backend/app/api/cad.py:38-40` | [L] |
| F-046 | WebSocket soft-lock keys are not normalised (`"205"` ≠ `205`), never expire, and a duplicate `user_id` replaces the live session — releasing its locks | `backend/app/api/websocket.py:54-72`, `:103-140`; `backend/app/services/websocket_manager.py:34-46` | [L] |
| F-047 | No `project_updated`/`sampled` signal when a copilot tool errors — the user sees "Executing 1 tool operation(s)…" with no explanation | `backend/app/services/ai_service.py:1125-1146` | [L] |
| F-048 | The default workspace profile is `"modify"` (CAD authoring mode) on first run | `frontend/src/App.tsx:410-417`; `frontend/src/types/profiles.ts:60-76` | [L] |
| F-049 | `ContextualModifyBar` (an **unmounted** component) carries a stale `fixed top-14` layout. The live dock `GlassContextualModifyDock` uses `top-18` (72 px), which clears the `h-16` (64 px) header — so there is **no live overlap**. Resolved by deleting the dead component. | `frontend/src/components/nav/ContextualModifyBar.tsx:191`; `frontend/src/components/cad/GlassContextualModifyDock.tsx:194`; `frontend/src/components/nav/GlassHeader.tsx:116` | [V] |
| F-050 | No autosave / "saved" indicator and no revision list; `frontend/src/services/settings.ts` persists editor preferences only | `frontend/src/services/settings.ts` | [L] |
| F-051 | No onboarding or first-run guidance. An empty-state **does** exist (`frontend/src/App.tsx:1805-1829`), but there is no first-run tour, no shortcut legend and no "what can I do here" framing | `frontend/src/App.tsx:1805-1829`; `frontend/src/components/omnibar/SpatialOmnibar.tsx` | [V] |
| F-052 | Touch targets are 14–16 px with `p-1`; touch orbit is likely broken because LEFT/RIGHT OrbitControls are disabled on pointer events | `frontend/src/components/viewer/ThreeViewport.tsx:913-917` | [L] |

---

## P3 — Quality, hygiene, dead weight

| ID | Finding | Evidence | Status |
|---|---|---|---|
| F-053 | 30 leftover test projects sit in the user's project list (`Phase 6 AI Copilot Project`, `Debug Test`, `Phase 5 Collab Project`…). They are not `AutoTest-` prefixed, so the cleanup rule in `AGENTS.md` never fires | `storage/projects.db` | [V] |
| F-054 | `DEVELOPMENT_HANDOFF.md` has an **empty "Open Items" section** — all 10 entries are Resolved. The backlog is not maintained | `DEVELOPMENT_HANDOFF.md:1-200` | [V] |
| F-055 | Dead code: `frontend/src/components/mockup/*` (~1,100 lines), `frontend/src/archive/**` (~3,500 lines, excluded from `tsconfig.app.json` so not type-checked but still tracked), plus unmounted `CadToolbar` (323 lines), `GlassNavRail`, `PetPalette`, `SpatialTopPill`, `SelectionContextOverlay`, `ContextualModifyBar`, `PropertyInspector`, `SpatialTree` | `frontend/src/**`; `frontend/tsconfig.app.json:26` | [L] |
| F-056 | `GlassNavRail.tsx` has **uncommitted changes that ship nowhere** (it has no live importers) | `git status` | [V] |
| F-057 | `modelsfortests/` is **175.5 MB** of IFC fixtures tracked in git; `backend/app/samples/Ifc2x3_SampleCastle.ifc` is byte-identical to `modelsfortests/Ifc2x3_SampleCastle.ifc` (same MD5 `E7B3C2BB…`) | `git ls-files` | [V] |
| F-058 | `.agents/` commits **184 files / 4.17 MB** of agent skills into the product repository | `git ls-files .agents` | [V] |
| F-059 | 25 dated `test_report_*.md` + `test_results_*.jsonl` artefacts in the repo root (gitignored, but still in the working tree) | repo root | [V] |
| F-060 | Documentation contradicts the real test counts in **9 places**. The true counts from `test_cases.jsonl` are **372 total / 123 `key` / 246 `full` / 3 `milestone`**. The docs claim 70, 113, 118, 323, 359 and 366 | `README.md:195,208-211`; `project.config.md:84,92`; `AGENTS.md`; `.github/workflows/qa-harness.yml` | [V] |
| F-061 | No frontend component/hook/API test infrastructure: `frontend/vite.config.ts` has no `test` block, and `jsdom` / `@testing-library/react` are not installed — component tests are impossible today | `frontend/vite.config.ts`; `frontend/package.json` | [V] |
| F-062 | Frontend coverage is 3 pure-function files / 13 tests | `frontend/src/tests/*` | [V] |
| F-063 | `modelsfortests/` and `backend/app/samples/` are not in `.gitignore`; only `storage/projects/*` is excluded | `.gitignore` | [V] |
| F-064 | `value_type`/`value` are not coerced to the Python type the target measure expects | `backend/app/services/ifc_service.py:360-390` | [L] |
| F-065 | `frontend/src/components/drawings/` is unreviewed, uncommitted work shipped as a feature | `git status` | [V] |

---

## Cross-cutting themes

1. **The IFC file is the database, and every operation re-reads and re-writes all of it.** 35 `ifcopenshell.open` / `model.write` pairs; no per-project lock; no atomic write. (F-001, F-002, F-004)
2. **The app reports success it did not achieve.** Walls never clash-checked but "110 clashes" returned; wall height changed in the properties panel but not in the geometry; a copilot "transform" that moved the element 13 km. (F-001, F-005, F-021)
3. **Nothing is reversible.** Undo covers CAD transactions only; deletes have no confirmation; writes are non-atomic. (F-002, F-007)
4. **Everything is anonymous.** No auth, wildcard CORS, unchecked WS Origin, spoofable `user_id`. (F-003, F-019)
5. **Features shipped ahead of the substrate.** Clash samples 25 elements per type; the drawings feature freezes its state before a model exists; the AI writes without confirmation. (F-005, F-013, F-028)
6. **The QA harness produces noise.** Master is red; the handoff backlog is empty; 20 dated reports contradict each other; the docs disagree on test counts. (F-011, F-054, F-059, F-060)

---

## Related step documents

| Step | Title | Primary findings |
|---|---|---|
| [STEP-01](steps/STEP-01-ai-transform-units.md) | Fix AI copilot transform units and rotation origin | F-001 |
| [STEP-29](steps/STEP-29-property-edit-persistence.md) | Property Inspector edits must actually persist | F-066 |
| [STEP-02](steps/STEP-02-single-commit-path.md) | One commit path per transform | F-002, F-018 |
| [STEP-03](steps/STEP-03-atomic-writes-and-locking.md) | Atomic writes + per-project lock | F-002, F-001 |
| [STEP-04](steps/STEP-04-event-loop-offload.md) | Move IfcOpenShell off the event loop + model cache | F-004 |
| [STEP-05](steps/STEP-05-cors-and-auth.md) | CORS lockdown, auth token, WS Origin check | F-003 |
| [STEP-06](steps/STEP-06-clash-correctness.md) | Clash detection must actually examine walls | F-005 |
| [STEP-07](steps/STEP-07-column-count-regression.md) | Resolve the column-count regression (red master) | F-011 |
| [STEP-08](steps/STEP-08-batched-mesh-visibility.md) | BatchedMesh visibility, isolation and render styles | F-006 |
| [STEP-09](steps/STEP-09-drawings-correctness.md) | Drawings: storey elevation, state sync, sheet deletion, scale, print | F-010, F-028, F-030 |
| [STEP-10](steps/STEP-10-undo-and-confirmation.md) | Product-wide undo + destructive-action confirmation | F-007 |
| [STEP-11](steps/STEP-11-omnibar-ctrl-k.md) | Make Ctrl+K open the command palette | F-008 |
| [STEP-12](steps/STEP-12-coordinate-hud-visible.md) | Make the coordinate HUD visible | F-009 |
| [STEP-13](steps/STEP-13-websocket-resilience.md) | WS reconnect, COMMIT_REJECTED, lock lifecycle | F-017, F-018, F-046 |
| [STEP-14](steps/STEP-14-element-details-race.md) | Fix the element-details request race | F-016, F-036 |
| [STEP-15](steps/STEP-15-spatial-tree-virtualization.md) | Virtualise the spatial tree | F-031 |
| [STEP-16](steps/STEP-16-ifczip-upload.md) | Support `.ifczip` uploads | F-012 |
| [STEP-17](steps/STEP-17-copilot-intent-and-confirmation.md) | Copilot intent matching + write confirmation | F-013, F-025, F-047 |
| [STEP-18](steps/STEP-18-ifc-schema-validity.md) | `value_type` literal, OwnerHistory, schema validation | F-014, F-015, F-043, F-064 |
| [STEP-19](steps/STEP-19-audit-timeline.md) | Correct audit timeline classification and stable IDs | F-022, F-023 |
| [STEP-20](steps/STEP-20-security-hardening.md) | SSRF, secret in URL, path containment, upload limits | F-019, F-020, F-026, F-027, F-045 |
| [STEP-21](steps/STEP-21-wall-geometry-resize.md) | Wall/slab resize must change geometry | F-021 |
| [STEP-22](steps/STEP-22-opening-storey.md) | Openings must be assigned to the host wall's storey | F-024 |
| [STEP-23](steps/STEP-23-viewport-performance.md) | Hover throttle, geometry disposal, scene teardown, Escape | F-033…F-038 |
| [STEP-24](steps/STEP-24-drawings-perf-and-a11y.md) | Drawings render performance + modal accessibility | F-029, F-032, F-041 |
| [STEP-25](steps/STEP-25-dead-code-removal.md) | Delete unreachable UI | F-055, F-056 |
| [STEP-26](steps/STEP-26-repo-hygiene.md) | Repository and process hygiene | F-053, F-057, F-058, F-059, F-060, F-063 |
| [STEP-27](steps/STEP-27-frontend-test-infrastructure.md) | Frontend test infrastructure | F-061, F-062 |
| [STEP-28](steps/STEP-28-onboarding-and-ergonomics.md) | Onboarding, shortcuts, save indicator, touch targets | F-042, F-048…F-052 |
