# Verification Log — IFC Editor audit, 2026-10-24

Everything below was executed on the audited working tree (`f5eec4c` + uncommitted `drawings/` work).
The repo was **not modified**. One test project created by `pytest` was deleted afterwards
(`eb2bb0d4-35c5-4a5a-b567-ffd130d5e2e4`); project count returned from 31 to its pre-run 30.
All scratch files were written to `%TEMP%\opencode\audit_repro` and removed.

---

## 1. Suite results

### Backend — `pytest backend/tests -v`

```
1 failed, 11 passed, 1 warning in 46.97s
FAILED backend/tests/test_phase6.py::test_phase6_ai_copilot_suite
AssertionError: Expected 8 columns, found 4
  assert 4 == 8
backend/tests/test_phase6.py:92
```

```
.agents/skills/...  ->  n/a
backend/tests/test_phase6.py:92: AssertionError: Expected 8 columns, found 4
```

Regression source (`git blame -L 770,795 backend/app/services/ai_service.py`):

```
1e0a9b26 (IFC Editor Agent 2026-10-01 770)             generated_elements_count += 4
580724bb (IFC Editor Agent 2026-10-12 772)             # 3. Interior Structural Columns ...
580724bb (IFC Editor Agent 2026-10-12 774)             if length >= 10.0 and width >= 7.0:
580724bb (IFC Editor Agent 2026-10-12 775)                 col_positions = [
580724bb (IFC Editor Agent 2026-10-12 776)                     (length * 0.35 - col_size / 2.0, width * 0.5 - col_size / 2.0),
580724bb (IFC Editor Agent 2026-10-12 777)                     (length * 0.65 - col_size / 2.0, width * 0.5 - col_size / 2.0)
```

`580724b` = *"feat(ui): implement Modern Glass Soft/Elegant UI layout with full-screen 3D viewport and resizable panels"* —
a **UI** commit changed BIM generation logic.

### Frontend — `pnpm exec vitest run`

```
 Test Files  3 passed (3)
      Tests  13 passed (13)
   Duration  4.11s
```

### Type check — `pnpm exec tsc -b --noEmit`

Clean (no output).

### Quality gates — `scripts/gates/run_gates.py`

```
[ PASS ]   | Zero Emoji Gate
[ PASS ]   | Hardcode Linter
[ PASS ]   | Semantic Intent Linter
[ PASS ]   | Token Contrast Verifier
[ PASS ]   | Spatial Collision & Deduplication
OVERALL STATUS: ALL GATES PASSED
```

Note: these gates are static/regex-based. They cannot detect any finding in `FINDINGS.md`.

---

## 2. Live API probes

Server started with `.\backend\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000` from `backend/`.

### 2.1 CORS reflects a foreign Origin with credentials enabled — F-003

```
$ curl -H 'Origin: https://evil.example.com' http://127.0.0.1:8000/health
status 200
  access-control-allow-origin: https://evil.example.com
  access-control-allow-credentials: true

$ curl -X OPTIONS -H 'Origin: https://evil.example.com' \
       -H 'Access-Control-Request-Method: POST' http://127.0.0.1:8000/api/projects
  access-control-allow-methods: DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT, QUERY
  access-control-max-age: 600
  access-control-allow-credentials: true
  access-control-allow-origin: https://evil.example.com
  access-control-allow-headers: content-type
```

Cause: `backend/app/core/config.py:36` puts `"*"` in `CORS_ORIGINS` while `backend/app/main.py:39` sets
`allow_credentials=True`. Starlette then mirrors the caller's Origin instead of emitting `*`.

### 2.2 Event-loop blocking — F-004

Project `b30eaff7-67d5-4733-ac86-a0676def0b0f` ("Historical Castle Benchmark (IFC2X3)", 49,286,967 bytes).

```
GET /api/projects/b30eaff7.../spatial-tree   -> 200, 391,539 bytes, 9,352 ms
concurrent GET /health latency:
    57 ms   (baseline, before)
  8,231 ms   <-- during the spatial-tree request
     47 ms
     46 ms
     49 ms
     52 ms
     53 ms
     52 ms
     64 ms
     48 ms
     45 ms
```

Baseline `/health` is 45–64 ms. The 8.2 s spike proves `ifcopenshell` work runs on the event loop.

### 2.3 Clash detection reports zero walls — F-005

Project `53a78d8b-8f8d-4f3f-bbd7-e8c68a47edf4` ("Ifc2x3_Duplex_Architecture", 57 walls in the model).

```
POST /api/projects/53a78d8b.../clashes/check  -> 200, duration_ms = 4,070.21
  total_clashes    : 110
  hard_clashes     : 45
  clearance_clashes: 65
```

Element types present across all 110 clash items:

```
  IfcSlab : 100
  IfcDoor :  58
  IfcMember: 38
  IfcColumn: 16
  IfcCovering: 8
```

**`IfcWall` does not appear once.** The response carries no `elements_checked` / `sampled` field.

### 2.4 Project list pollution — F-053

```
GET /api/projects -> count = 31
  Phase 6 AI Copilot Project / Debug Test / Phase 5 Collab Project / Phase 1 Test Villa / AI test / asd ...
```

None use the `AutoTest-` prefix, so the cleanup rule in `AGENTS.md` §B7 never matches them.

### 2.5 Path traversal probes — no traversal found (informational)

```
GET /api/projects/..%2f..%2f..%2f..%2fWindows%2fwin.ini      -> 404
GET /api/projects/../../../../Windows/win.ini                 -> 404
GET /api/projects/..%5c..%5c..%5c..%5cWindows%5cwin.ini      -> 404
```

The `model.ifc` filename is fixed, so arbitrary read is not reachable today. `project_id` is still
unvalidated (F-026) and `get_project_file_path` has no containment check — a latent primitive.

---

## 3. Independent reproductions (Python, in `%TEMP%\opencode\audit_repro`)

### 3.1 Unit-scale census

Every sample file was opened and its metre unit inspected:

```
Ifc2x3_SampleCastle.ifc          schema=IFC2X3   metre_scale=1.0 prefix=MILLI
Ifc4_Revit_ARC.ifc              schema=IFC4     metre_scale=1.0 prefix=MILLI
Ifc4_Revit_MEP.ifc              schema=IFC4     metre_scale=1.0 prefix=MILLI
Ifc4_Revit_STR.ifc              schema=IFC4     metre_scale=1.0 prefix=MILLI
Ifc4_SampleHouse.ifc            schema=IFC4     metre_scale=1.0 prefix=MILLI
building_architecture.ifc        schema=IFC4X3   metre_scale=1.0 prefix=MILLI
Ifc2x3_Duplex_Plumbing.ifc      schema=IFC2X3   metre_scale=1.0 prefix=MILLI
ifc2x3_duplex_architecture.ifc   schema=IFC2X3   metre_scale=1.0 prefix=None    <-- the odd one out
```

**All real-world Revit exports are millimetre.** The bundled duplex sample — the one most demos use —
is the only metre model, which is exactly why the F-001 unit bug survived.

### 3.2 F-001 — zero-delta round trip through the AI transform path

```python
M = IFCService.get_element_placement_matrix(path, eid)      # service "current matrix"
M_new = (T @ R @ M).flatten(order="F").tolist()              # T=I, R=I  (zero delta)
IFCService.update_element_placement(path, eid, M_new)        # is_si=True inside
```

On `modelsfortests/Ifc4_Revit_ARC.ifc`, wall `#<first>`:

```
world pos BEFORE (mm units): [-11116.903, -8490.419, 2700.0]
service matrix translation : [13162.932, 3000.406, -300.0]      <-- RELATIVE, not world
world pos AFTER  (mm units): [13162931.517, 3000406.021, -300000.0]
DELTA raw: [13174048.42, 3008896.44, -302700.0]
displacement: 13,516.68 m
```

Two independent defects visible in one run:
1. the service returns the **relative** placement (`13162.932, 3000.406, -300.0`) while the world
   position is `-11116.903, -8490.419, 2700.0` — the parent chain is ignored;
2. the write path re-scales by 1/0.001.

### 3.3 F-005 — walls never produce geometry

```python
s = ifcopenshell.geom.settings(); s.set("use-world-coords", True)
for w in m.by_type("IfcWall")[:25]:
    ifcopenshell.geom.create_shape(s, w)
```

```
total walls in model: 57
first 25 walls: geometry_ok=0  geometry_failed=25
   1 x Failed to process shape. Product: #5399=IfcWall('2O2Fr$t4X7Zf8NOew3FKau',#33,'Basic Wall:Party Wall ...
   1 x Failed to process shape. Product: #3797=IfcWallStandardCase(...)
   ... (25 total)
IfcSlab:   ok=21 failed=0
IfcDoor:   ok=14 failed=0
IfcWindow: ok=24 failed=0
```

Walls fail 100 %; slabs/doors/windows succeed. `clash_service.py:83-84` swallows every one of these.

---

## 4. Frontend code verification (by reading source)

| Claim | Method | Result |
|---|---|---|
| F-006 batched visibility is a no-op | grep `setVisibleAt` across `frontend/src` | **0 matches** |
| F-006 proxies are never in the scene | read `ThreeViewport.tsx:1569-1599` | `proxy.visible = false`; only `group.add(batchedMesh)` at `:1599` |
| F-006 visibility effect touches proxies only | read `ThreeViewport.tsx:1698-1720` | `mesh.visible = visible` only |
| F-002 double write | read `useGizmoTransform.ts:35,38` + `websocket.py:122` + `projects.py:276` | both reach `IFCService.update_element_placement` |
| F-008 Ctrl+K dead branch | read `SpatialOmnibar.tsx:54-60`, `App.tsx:1795-1797` | `else { // Open }`; no `onOpen` prop |
| F-009 invisible HUD | read `CoordinateHud.tsx:27-28` | `className="sr-only"` `aria-hidden="true"` |
| F-010 delete-first-sheet | read `DrawingSheetsModal.tsx:255-259` | `setActiveSheetId(sheets[0].id)` on the stale array |
| F-007 no confirmation | grep `window.confirm|confirm(` in `frontend/src` | **0 matches** |
| F-007 undo scope | grep `undo|redo|history` in `backend/app/api` | only `/cad/undo`, `/cad/redo`, `/cad/history` |
| F-016 fetch race | read `useSpatialSelection.ts:47-67` | only an `isMounted` guard, no request id |
| F-028 storey elevation | read `useSpatialSelection.ts:75`, `ifcWorker.ts:222-227` | `elevation: 0.0` hard-coded; worker never reads `IfcBuildingStorey.Elevation` |

---

## 5. Repository hygiene measurements

```
tracked files                                  : 401
tracked files under .agents/                    : 184   (4.17 MB)
modelsfortests/                                : 20 files, 175.5 MB  (tracked)
backend/app/samples/Ifc2x3_SampleCastle.ifc    : 48,131.8 KB
modelsfortests/Ifc2x3_SampleCastle.ifc         : 48,131.8 KB
  MD5 samples/       : E7B3C2BBC244400EB7C6D2D032599FD9
  MD5 modelsfortests/: E7B3C2BBC244400EB7C6D2D032599FD9   <-- byte-identical duplicate
.git objects                                     : 39 MB
```

Largest tracked files (all IFC fixtures): `modelsfortests/Ifc2x3_SampleCastle.ifc` (48.1 MB),
`modelsfortests/Ifc2x3_Duplex_Plumbing.ifc` (30.8 MB), `modelsfortests/Ifc4_Revit_MEP.ifc` (28.5 MB),
`modelsfortests/Ifc2x3_Duplex_MEP.ifc` (17.5 MB), `modelsfortests/Ifc4_Revit_ARC*.ifc` (13.3 MB each).

---

## 6. Documentation count mismatch — F-060

The **true** counts, read from `test_cases.jsonl`:

```
total     : 372
tier=key  : 123
tier=full : 246
tier=milestone : 3
categories: 22   (largest: Advanced BIM 44, Parametric CAD 43, Core Features 42)
```

Nine places in the documentation state a different number:

| Source | Claimed |
|---|---|
| `README.md:195` | "70 structured QA test specifications" |
| `README.md:208` | "359 granular test cases" |
| `README.md:210` | "113 critical end-to-end paths" / "359 product functions" |
| `project.config.md:84` | "366 comprehensive test specifications" / "118 critical" |
| `project.config.md:92` | "All 359 test specifications" |
| `AGENTS.md` §B2 | "all 359 test cases" |
| `.github/workflows/qa-harness.yml` | "the full 323 test cases milestone suite" |

None of them matches 372 / 123 / 246.

---

## 6b. Property Inspector edits never persist — F-066

Verified by reading the live call site against the live route:

```
frontend/src/components/properties/GlassPropertyInspector.tsx:143
    const res = await fetch(`/api/projects/${projectId}/elements/${expressId}/properties`, {
      method: 'PATCH',                                    <-- 405: the route is POST only
      body: JSON.stringify({
        pset_name: psetName,
        name: prop.name,                                  <-- 422: the field is 'property_name'
        value: parsedValue
      })
    });
    ...
    if (!res.ok) throw new Error('Failed to save property edit');   // :153
    ...
  } catch (err) { console.error('Failed to save property:', err); } // :175-177  (swallowed)

backend/app/api/projects.py:293
    @router.post("/{project_id}/elements/{express_id}/properties", ...)
```

```
backend/app/models/schemas.py:52-56
    class PropertyUpdatePayload(BaseModel):
        pset_name: str
        property_name: str          <-- required, and 'name' is not accepted
        value: Any
        value_type: str = "IfcLabel"
```

Two independent contract violations on the same call → the request can never succeed.
The **add-property** path in the same file (`:196-205`) is correct
(`POST` + `property_name` + `value_type`), and the older dead
`frontend/src/components/properties/PropertyInspector.tsx:114-123` was also correct.

---

## 7. What was NOT verified

- No browser session was run. No React runtime, no WebGL frame-rate measurement, no memory snapshot,
  no live console capture. All frontend findings are **static code reads** (marked `[L]`), except those
  confirmed by grep counts.
- The 147 s "49 MB download" observation was **PowerShell `Invoke-WebRequest` buffering overhead**,
  not server time. The server-side cost that matters is F-004, measured directly.
- WebSocket behaviour was not exercised through a real browser handshake; the absence of an Origin
  check was confirmed by reading `backend/app/api/websocket.py:14-16`.
- No dependency CVE scan of `backend/venv`.
- IFC semantics beyond placement, psets and representation presence were not audited
  (e.g. `IfcLocalPlacement` chains for openings, quantity unit metadata).
- Whether `frontend/src/archive/**` reaches the production bundle was not verified. It **is**
  excluded from type-checking by `frontend/tsconfig.app.json:26` (`"exclude": ["src/archive"]`),
  so it is neither type-checked nor bundled — it is tracked dead weight only.
