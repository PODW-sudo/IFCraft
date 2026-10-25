# Sectioning V2 — Plan (Navisworks-style in-canvas control, made better)

Status: **plan only, nothing implemented.** The v1 rewrite was reverted (`git reset --hard 54ad84d`);
`frontend/src/services/sectionEngine.ts`, `sectionCaps.ts`, `components/section/*` and their tests no
longer exist. `HEAD` still contains the original, broken section code.

---

## 1. Goal

A section tool that an architect can drive **on the model**, without hunting for a slider: a visible cut
plane with a grab handle, a numeric readout you can type into, real poché on the cut face, and a state
that can never leave the viewport empty by accident.

Reference behaviour: **Navisworks Manage** (`Enable Sectioning` → light-blue wireframe plane + Move/Rotate
gizmo, numeric Position/Rotation fields, up to six planes, Section Box, `Fit Selection`, capping as a global
option). Research brief with sources: see §11.

Where Navisworks is weak (documented, §11): hollow cuts, a gizmo that is sometimes invisible, plane state
lost or silently applied on reopen, no global reset, and a Section Box whose faces cannot be dragged
individually. V2 fixes each of those rather than copying them.

---

## 2. Post-mortem: why v1 was reverted

Not a style problem — three concrete defects, one of them fatal:

| # | Defect | Consequence |
|---|--------|-------------|
| 1 | `ThreeViewport` built the plane as `plane.set(normal, position * dir)`, so the constant carried the wrong sign. `axis=y, position=4` produced a plane at **y = −4**. | The default cut removed the whole building. |
| 2 | The section state was persisted **per project and restored with `enabled: true`**. | A stale restore clipped the model on load with no visible cause: "the 3D model is not even visible". |
| 3 | Caps, drag handle, saved views, HUD, shortcuts, persistence and the unit boundary all shipped in one commit, tested mostly through React state. | Too much surface to reason about at once; failures overlapped and the harness could not see them. |

Rules carried into V2: one plane-equation function with unit tests **before** any UI; ground-truth bounds
from the scene; section state never restores enabled; each phase independently shippable and verified in a
real browser.

---

## 3. Product spec

### 3.1 Entry points

- Bottom dock scissors button (`data-qa="dock-section-toggle"`) — unchanged hook.
- `S` key, or the Omnibar command `Section: enable`.
- Selecting a face and choosing `Section here` in the context overlay (§3.6).

Turning sectioning on **always** seeds from the model bounds, so the first frame is a partial cut through
the model, never an empty viewport.

### 3.2 The in-canvas manipulator (the core of the request)

A single 3D object per plane, composed of:

1. **Plane frame** — the intersection rectangle of the plane with the model bounds, drawn as a thin
   `LineSegments` frame (1.5 px, `0x38bdf8`), plus a 6 % translucent fill quad to read the plane's
   orientation. Sized from the scene bounds, so it always spans the model, never a fixed `40`.
2. **Normal arrow** — a single arrow along the cut normal, 96 px on screen (constant screen size via
   distance scaling), the only hit target for dragging.
3. **Offset bubble** — an HTML chip pinned to the arrow tip: `Y  +4.00 m`. Click = edit inline, `Enter`
   commits, `Esc` cancels, arrow keys step by 0.1 / 0.01 (Shift) / 1.0 (Alt). This replaces Navisworks'
   off-canvas Position field.
4. **Flip chip** — small `⇄` at the frame corner; flips the kept half by negating the normal and **never**
   moves the plane (asserted in tests).
5. **Axis chips** — `X Y Z` on the frame edge; switching axis re-seeds the offset from the new axis extent
   unless the user typed an explicit offset (a stale X offset read as Y parks the plane outside the model).
6. **Active/inactive styling** — the active plane is `0x38bdf8`; other enabled planes are `0x94a3b8` at 60 %
   (Solibri does this with blue/green). All enabled planes stay visible and draggable — Navisworks only
   renders the current one.

Dragging uses the project's existing `TransformControls` (already used for the element gizmo, so it feels
identical) attached to a dummy object constrained to the plane normal:

- `setMode('translate')`, `showX/Y/Z` limited to the normal axis, `space = 'local'`.
- `setTranslationSnap(0.1)` by default; `Alt` = 1.0 m, `Shift` = 0.01 m (live, via `dragging-changed`).
- Orbit/pan are disabled while `dragging` is true; release commits once (no per-frame state writes).
- `Esc` during a drag restores the pre-drag offset.

### 3.3 Modes

| Mode | Behaviour |
|------|-----------|
| **Off** | No clipping, no handles. Plane parked (`normal (0,0,0)`, `constant 1e9`) so materials keep identity and no shader recompiles. |
| **Plane** | 1–3 independent planes, each with its own axis/offset/flip, combined with AND (`clippingPlanes` array). |
| **Box** | Six faces, each with its own arrow handle and numeric field (Navisworks cannot drag a single face). `Fit to selection`, `Fit to model`, `Shrink 5 %`. |

Switching Plane ↔ Box preserves the plane offsets by mapping the active plane onto the matching box face.

### 3.4 Capping (Revit-style poché, on by default)

- Geometric capping per clip plane: triangulate the cut cross-section of every intersected mesh, merge into
  **one** `BufferGeometry` per plane, render with a flat unlit material (`#1f2937`, `DoubleSide`,
  `polygonOffset` to kill z-fighting) plus a 1 px cut outline in `#0f172a`.
- Why geometric and not stencil: IFC geometry is not watertight and `renderer.stencil` is off by default
  since three r163; stencil caps leak on open shells (walls with openings).
- Toggle `Caps` (default **on**), colour/opacity in a small popover. Navisworks ships hollow cuts and users
  complain for years (§11), so this is a deliberate deviation.
- Rebuild policy: rAF-coalesced, bounded to 8 ms per frame with a work queue; only meshes whose world bounds
  straddle the plane are re-triangulated. Measured target on the 2,144-mesh sample: < 8 ms per update,
  < 40 ms for a full rebuild.

### 3.5 Ghost half (the "better" part)

`Ghost` renders the removed half at 12 % opacity instead of hiding it (off by default):

- Gives the orientation context Navisworks loses the moment you cut.
- Implemented by flipping the plane's normal for a clone of the affected material set (single extra
  material per render style, not per mesh), `depthWrite: false`, `transparent: true`, rendered after opaque.
- Ghost geometry is not pickable and is excluded from measurement, clash and quantity results.

### 3.6 Placement shortcuts Navisworks calls "Align To Surface" / "Fit Selection"

- **Cut at face**: with the section tool active, clicking any face places the plane on that face's plane
  (normal = face normal, offset snapped to the face) — one click, no gizmo nudging.
- **Cut at selection**: uses the selected element's world AABB — plane at the near face, box mode uses the
  AABB directly.
- **Focus cut**: camera moves perpendicular to the plane and frames the cross-section (Navisworks has no
  equivalent; it is the single most useful thing when reviewing a floor cut).

### 3.7 Keyboard (Solibri-grade, applied to a mouse-first tool)

| Key | Action |
|-----|--------|
| `S` | Toggle sectioning |
| `[` / `]` | Nudge active plane −/+ 0.1 m (`Shift` 0.01, `Alt` 1.0) |
| `X` / `Y` / `Z` | Re-target the active plane (`Alt+X/Y/Z` for planes 2 and 3) |
| `F` | Flip the kept half |
| `B` | Toggle box mode |
| `G` | Toggle ghost half |
| `C` | Toggle caps |
| `Space` | Cycle the active plane (Solibri parity) |
| `Shift`+wheel | Move **all** enabled planes together (Solibri parity) |
| `Delete` | Remove the active plane |
| `Esc` | Exit sectioning (never silently leaves a cut on) |

Shortcuts are registered in `services/shortcuts.ts` and skipped while a text field has focus.

### 3.8 Saved states, viewpoints, BCF

- `Save section state` stores planes + mode + camera in the existing viewpoint record, so a QA/BCF topic can
  reopen the exact cut.
- A **Section states** list (max 20) with rename/delete/apply; `Restore last section` is an explicit chip,
  never automatic.
- Section ops participate in a client-side history stack (20 steps): drag, flip, axis, nudge, box resize,
  remove. Navisworks has no undo here; this closes the gap.

### 3.9 Persistence policy (the rule that prevents the v1 failure)

- Persisted per project: `{ planes, mode, caps, ghost }` — **never `enabled`**.
- On project open: state is *offered* ("Restore last section — Y +4.00 m"), not applied.
- Any restored offset is clamped into the freshly computed scene bounds before it is offered.
- If a cut would keep nothing (plane outside bounds), the plane is treated as a miss: it is **not** applied,
  the HUD says `cut misses the model`, and the model stays fully visible.

---

## 4. Interaction contract

```
idle ──(enable)──► seeded (plane at 25 % of the axis extent, caps on)
seeded ──(pointerdown on arrow)──► dragging (orbit disabled, snap from modifiers)
dragging ──(pointerup)──► committed (one state write, one history entry)
dragging ──(Esc)──► seeded (pre-drag offset restored)
seeded ──(type in bubble)──► editing (keyboard captured, Enter commits)
any ──(plane out of bounds)──► miss (clipping bypassed, HUD warning, no caps)
any ──(disable / Esc)──► off (planes parked, no clipping, helpers hidden)
```

Pointer rules: the arrow uses `pointerdown` + `setPointerCapture`; the frame is not a hit target (prevents
accidental drags while orbiting); a click without movement on the frame = no-op; double-click on the frame
opens the numeric bubble.

---

## 5. Architecture

```
frontend/src/sectioning/
  planeMath.ts        // planeFromOffset(axis, offset, flipped) -> {normal, constant}
                      // keepHalfSpaceDistance(), intersectsBounds(), clampOffset()
  state.ts            // SectionState + reducer, single writer applySectionPatch(prev, patch, bounds)
  history.ts          // 20-entry undo stack for section ops only
  caps.ts             // triangulateCut(meshes, plane, bounds) -> merged cap geometry + area
  bounds.ts           // sceneBoundsFromObject(meshesGroup) -> Box3  (world space, ground truth)
  useSectioning.ts    // React controller: state <-> engine, keyboard, persistence offer
  SectionManipulator.tsx  // three.js objects: frame, arrow, chips (imperative, no React re-render per frame)
  SectionHud.tsx      // in-canvas compact bar: [X][Y][Z] | 4.00 m | Flip | Box | Ghost | Caps | Clear
  SectionStatesPanel.tsx  // saved states list
```

**Plane maths (the one place that must be right):**

```ts
// keeps normal·p + constant >= 0
export function planeFromOffset(axis, offset, flipped) {
  const s = flipped ? -1 : 1;
  const n = unitAxis(axis).multiplyScalar(s);   // flip mirrors the kept half
  return new THREE.Plane(n, -s * offset);       // ...and never moves the plane
}
// invariant, unit-tested: plane.distanceToPoint(pointOnAxis(axis, offset)) === 0
```

**Bounds** come from `new THREE.Box3().setFromObject(meshesGroup)` after the geometry effect, refreshed on
geometry change only. Raw `GeometryData.positions` are never used for bounds again (v1 applied matrices by
hand; the scene is the authority).

**Clipping wiring**: one `THREE.Plane[]` array, stable identity, mutated in place; materials reference the
array once at creation, so updating a cut touches **no material** and recompiles no shader. Parked planes
use `normal (0,0,0), constant 1e9` instead of "far away", so `enabled` never changes the material either.

---

## 6. Failure-mode guards ("never invisible again")

1. Restore never sets `enabled`; the user opts in. (§3.9)
2. A plane that misses the bounds is not applied — clipping is bypassed and the HUD says so. (§3.9)
3. Seeding always produces a cut that keeps ≥ 25 % of the model's axis extent.
4. `Esc` always exits; the HUD close button always clears; `Clear` restores an unclipped view in one click.
5. Automated gate: a browser case that loads every sample model and asserts `renderer.info.render.triangles > 0`
   with section **off** *and* with it **on** (a cut may not take the model to zero). This is the check v1 lacked.
6. The empty-viewport case is also covered by a screenshot comparison against a known-good load.

---

## 7. Phases

| Phase | Scope | Done when |
|-------|-------|-----------|
| **0 — maths** (0.5 d) | `planeMath.ts`, `state.ts`, `bounds.ts` + unit tests; no UI change | Tests prove `offset` is where the cut is, flip mirrors without moving, axis switch cannot park the plane outside the model, miss = no clipping |
| **1 — engine** (1 d) | clipping array wiring, caps, parked planes, remove the old `PlaneHelper` card logic | Live: `y=4` cuts at +4; caps visible; materials not recreated on cut changes; 2,144-mesh model stays interactive |
| **2 — manipulator** (1.5 d) | frame, arrow, TransformControls drag, snapping, bubble, flip/axis chips, keyboard, `Esc`/undo | One-handed workflow: enable → drag → flip → type an offset, all on the canvas, no panel |
| **3 — box + HUD** (1 d) | box mode with per-face handles, compact HUD, states panel, ghost toggle | Box faces drag individually; HUD is one row; nothing outside the canvas |
| **4 — states** (0.5 d) | saved states, viewpoint/BCF linkage, restore chip, history | Reopen a project → model visible, restore chip offered, applying it reproduces the cut |
| **5 — gates** (0.5 d) | browser E2E for cut position/caps/visibility, harness hooks, docs | `qa_runner` cases assert geometry (bridge readback), not React state |

Total ≈ 5 working days, each phase a separate reviewable commit.

---

## 8. Test strategy

- **Unit** (`vitest`): plane equation invariants, flip, axis re-target, clamping, miss detection, reducer
  idempotence, history stack, cap triangulation area on synthetic boxes and on an L-shaped section.
- **Browser** (`qa_runner`): extend the bridge with `getSectionPlanes()` (normal, constant, offset) and
  `getSectionCapStats()` (cap count, total area) so cases assert **geometry**, the gap that let v1 ship.
  Cases: position on X/Y/Z, flip keeps the plane, depth/box, caps on a known wall, model still renders when
  section is off, restore-offer flow.
- **Visual**: screenshots on X/Y/Z for the sample models, reviewed for cap coverage and z-fighting.
- **Regression**: the existing 256-test suite must stay green; new section modules get their own files.

---

## 9. Non-goals

- Stencil capping.
- Sectioning the 2D drawing sheets (unit conversion stays at the sheet boundary).
- Animated section planes tied to the timeline.
- Xeokit parity — the xeokit engine gets an explicit `Sectioning needs the Three.js viewport` notice instead
  of a silent no-op (filed P2 in `DEVELOPMENT_HANDOFF.md`).

---

## 10. Why this is better than Navisworks

| Capability | Navisworks | V2 |
|---|---|---|
| Cut face | hollow; capping is a global `Options` setting and often reads as a red line | real poché, on by default, per-cut colour |
| Handle | gizmo, documented as sometimes invisible; six planes but only the current one is drawn | frame + arrow + numeric bubble, all enabled planes visible and draggable |
| Numeric entry | off-canvas Position/Rotation panel | inline bubble on the plane, plus keyboard nudge |
| Removed half | hidden | optional 12 % ghost, keeps orientation context |
| Placement | Align To Surface / Fit Selection | same, plus one-click `Cut at face` and `Focus cut` (camera perpendicular) |
| Box | faces cannot be dragged individually (KB-documented) | per-face arrows and numeric fields |
| Undo | none for sectioning | section-local 20-step undo |
| Reopen | plane state restored or lost unpredictably | restore is offered, never applied; impossible to open into an empty view |
| Empty state | can leave a blank viewport | miss detection keeps the model visible and says why |

---

## 11. Sources (Navisworks / Revit / Tekla / Solibri behaviour)

- Enable Sectioning, plane placement, `Fit Selection`: Autodesk 2026 Navisworks help, `GUID-FEEA00D6…`, `GUID-38AEF8DD…`
- Plane graphic ("light blue wireframe"), one current plane, six planes max: `GUID-661F4DEB…`, `GUID-B327300C…`
- Transform gizmos (Move/Rotate/Scale; perpendicular vs parallel arms): `GUID-AE237C4D…`, `GUID-E78E72B9…`
- Numeric Position/Rotation/Size fields: `GUID-45518D0C…`, `GUID-4EE4D5FE…`
- `Align To Surface` / `Align To Line` / `Align To View`: `GUID-A0075A44…`
- Capping as a global option + outline colour: `Interface_Sectioning.htm`; hollow-cut complaints:
  `forums.autodesk.com/t5/navisworks-forum/navisworks-2020-section-capping/td-p/9558539`
- Reopen-state and invisible-gizmo KBs, "move a single box plane": Autodesk KB titles (bodies paywalled)
- Revit section box arrows + `Cut object style` poché: `GUID-BC219BE7…`, `GUID-C9EA51CB…`
- Solibri active/inactive colours, keyboard set, fill-sectioned-components: `help.solibri.com` sectioning tool + settings
- Tekla clip plane scissor symbol, "line symbol indicates the side clipped out", six planes, clip box: `support.tekla.com/…/mod_creating_a_clip_plane`

(Full URLs were captured in the research brief; the GUIDs above resolve under
`help.autodesk.com/cloudhelp/2025|2026/ENU/Navisworks/files/`.)
