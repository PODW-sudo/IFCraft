# User Needs — gap analysis

**Who the users are.** Architects, BIM engineers and building-services coordinators doing
billable, deadline-driven work on live building models. They are not 3D-graphics nerds. They work
on 100k-element models, often on mediocre laptops, sometimes on a tablet on site. The IFC model
they are editing is frequently a contractual document shared with contractors and clients.

**Design principle that follows from this:** for this audience, *a tool that tells the truth is
worth more than a tool that does more*. A BIM engineer will forgive a missing feature. They will
not forgive a report that says "0 clashes" when walls were never checked, or a wall that reports
5 m high and stays 4 m. Trust is the product.

---

## 1. Trust what the tool tells you

| Need | Current state | Finding | Step |
|---|---|---|---|
| "If it says there are no clashes, there really are none" | ❌ Clash detection never examines a wall and reports 110 clashes as if complete | F-005 | STEP-06 |
| "If it says the wall is 5 m, the wall is 5 m" | ❌ `PATCH /geometry` changes the property, not the geometry; the wrong model is exported | F-021 | STEP-21 |
| "I can edit a property and it sticks" | ❌ The Property Inspector's edit path sends `PATCH` with the wrong field name — the request can never succeed, and the error is swallowed | F-066 | STEP-29 |
| "If the AI moved it, it moved it where I asked" | ❌ "move 2 m" → 2 km on any millimetre model; 13.5 km on a *zero* delta | F-001 | STEP-01 |
| "The audit trail tells me who changed what" | ❌ Every transaction is classified "added", including deletions; IDs change on every restart | F-022 | STEP-19 |
| "The project list shows what's actually there" | ❌ 30 leftover test projects; element counts go stale after edits | F-053, F-023 | STEP-26, STEP-19 |
| "The tool doesn't act on a half-typed sentence" | ❌ "what is a house?" writes a building into your model | F-013 | STEP-17 |

**The pattern.** Every one of these is the same defect wearing different clothes: the app
reports success it did not achieve. This is the single biggest trust risk in the product, and it
is a Wave A / Wave C priority, not a polish item.

---

## 2. Don't lose work

| Need | Current state | Finding | Step |
|---|---|---|---|
| "I can undo my mistake" | ❌ Undo covers CAD transactions only — not property edits, not gizmo moves, not deletes | F-007 | STEP-10 |
| "The app asks before destroying something" | ❌ Zero confirmation dialogs anywhere; `Delete` key deletes instantly | F-007 | STEP-10 |
| "The file is never half-written" | ❌ `model.write()` writes in place; two writers race on every drag | F-002 | STEP-03 |
| "I can tell whether my work is saved" | ❌ No autosave indicator, no revision list, no "last saved" | F-050 | STEP-28 |
| "Concurrent users don't silently clobber each other" | ❌ No per-project lock; the REST path bypasses the soft lock entirely | F-002, F-018 | STEP-02, STEP-13 |

**The pattern.** The model file *is* the deliverable. A corrupted or silently-reverted model is
worse than a crash, because the user does not know it happened.

---

## 3. Work on real files

| Need | Current state | Finding | Step |
|---|---|---|---|
| "Opening a model doesn't freeze the app" | ❌ 8.2 s total backend freeze on a 49 MB model; every request and socket stalls | F-004 | STEP-04 |
| "My colleague's file formats work" | ❌ `.ifczip` is accepted by validation then always fails 422 | F-012 | STEP-16 |
| "The clash check covers what I designed" | ❌ Walls, openings, stairs and MEP are excluded or sampled at 25 | F-005 | STEP-06 |
| "Clicking an element shows the right element" | ❌ Request race → inspector can show element A while element B is selected | F-016 | STEP-14 |
| "Hiding a category actually hides it" | ❌ On any model > 150 elements, hide / isolate / federation-hide are inert | F-006 | STEP-08 |
| "The drawings I produce are correct" | ❌ Every plan cut at +1.2 m; title block says "BIM Project"; scale doesn't fit the model; print is neither A3 nor 1:100 | F-028, F-030 | STEP-09 |
| "Large models stay usable" | ❌ Unvirtualised tree; hover raycast with no BVH on the batch path; no spatial index | F-031, F-034 | STEP-15, STEP-23 |

---

## 4. Find things

| Need | Current state | Finding | Step |
|---|---|---|---|
| "One keystroke gets me to any tool or element" | ❌ `Ctrl+K` is a dead shortcut — the flagship power-user entry point does nothing | F-008 | STEP-11 |
| "I can search the whole model" | ❌ The omnibar indexes only the first 50 geometries | F-042 | STEP-28 |
| "I know where I am in space" | ❌ The coordinate HUD is `sr-only` — computed but never shown | F-009 | STEP-12 |

---

## 5. Learn the tool

| Need | Current state | Finding | Step |
|---|---|---|---|
| "I know what the app can do in the first minute" | ❌ Default profile is "modify" (CAD authoring) before a model is loaded; no empty state, no onboarding | F-048, F-051 | STEP-28 |
| "I know what the shortcuts are" | ❌ Shortcuts exist (G / R / S / Delete / Ctrl+K / Ctrl+D) but are undiscoverable; bare `g` also fires while typing | F-051, F-040 | STEP-28 |
| "The panels don't fight each other" | ⚠️ The live dock clears the header (`top-18` vs `h-16`); the stale `top-14` ribbon is dead code that should not still exist | F-049 | STEP-25 |
| "I can operate it on a tablet" | ❌ 14–16 px touch targets; touch orbit likely broken (LEFT/RIGHT pointer events disabled) | F-052 | STEP-28 |

---

## 6. The AI copilot — what it should actually be

Today the copilot can *mutate* a model: `generate_building`, `transform_element`,
`update_property`. For this audience that is the wrong first move.

- A BIM coordinator is the most change-averse software user there is. On a contractual model, one
  hallucinated `express_id` is a data-integrity incident, and there is no undo (F-001, F-013).
- The highest-value, lowest-risk capability is **read-only model intelligence**: *"which Level-2
  walls lack a FireRating?"*, *"quantity take-off of structural steel by storey"*, *"what changed
  since Tuesday's upload — draft a BCF topic for each clash"*. These are the questions BIM
  coordinators get asked in meetings. They are pure reads over data the product already has
  (psets, `edit_history`, clash results), a wrong answer costs nothing, and a right answer saves
  an hour of tree-clicking.
- Mutations come **later**, transactionally: each AI edit becomes a proposed transaction, rendered
  as a 3D preview diff (the diff shader already exists), applied only on confirm, and undoable in
  one step.

**Direction:** *AI proposes, engineer disposes, everything reversible.* That is the framing this
audience will trust.

---

## 7. The dual-engine question

`ThreeViewport.tsx` and `XeokitViewport.tsx` both exist. The Xeokit path is fed the **same**
web-ifc-parsed geometry, converting every `Float32Array` to a boxed JS number array
(`XeokitViewport.tsx:266-295`) — no XKT, no tiles, no streaming, no lazy load. It is a second
renderer wearing Xeokit's skin.

The cost is already visible in this repo: every viewport capability is implemented twice, QA
carries a parallel `TC-XKT-*` suite, the header carries an engine toggle users must understand,
and the 2026-10-16 handoff entry is a Xeokit-specific blank-canvas regression. All interactive
editing — gizmos, CAD state machine, measurement snapping, ghost previews — is Three.js-native.

**Recommendation:** consolidate on Three.js. Delete `XeokitViewport.tsx`, the toggle and the
`TC-XKT-*` suite; fold the genuinely good ideas (Storey Views, FastNav-style quality degradation)
into the Three path. If a customer's 200 MB model later defeats Three, reintroduce Xeokit
correctly as a **read-only review mode** — offline `xeokit-convert` IFC→XKT at upload time, tiles
and streaming, no editing. That is a server-side conversion job, not a second editor.

This is not scheduled as a step in `ROADMAP.md` because it is a product decision rather than a
defect. It should be decided before Wave B adds any further viewport capability, because every
viewport feature added after the decision costs 1× or 2× depending on when it was made.

---

## 8. What the QA harness is worth

The harness is genuinely good testability engineering — the `__IFC_QA_BRIDGE__` seam, the
deterministic gates and the CDP runner are all sound. But it is currently producing **noise**:

- master is red (F-011) and CI runs pytest, so red is the normal state
- `DEVELOPMENT_HANDOFF.md`'s *Open Items* section is **empty** (F-054) — the backlog is not maintained
- 20 dated reports in the repo root contradict each other; one report records TC-001 as both
  passing and failing, and another verifies the *wrong project* and records a pass (F-059, F-060)
- the documentation disagrees on the test count in six places (F-060)
- there are no frontend component/hook tests at all — 13 pure-function tests (F-061, F-062)

**Keep:** the pytest suite, vitest, `tsc -b`, the production build, the five deterministic gates,
the CI workflow skeleton, the bridge seam.
**Fix:** one fresh `AutoTest-` project per test case; a `run_id` so results dedupe; key-tier
failures must fail the build; add the two missing suites — **performance budgets** and
**concurrency** (two clients committing simultaneously → assert no corruption, locks honoured).
**Cut:** the 20 dated reports from the working tree, the 372-case milestone tier (collapse to ~60
genuinely distinct flows), and `qa_runner.py`'s size (3,776 lines → per-category spec modules).

---

## 9. Summary: the three sentences that matter

1. **This app must not lie.** Clash results, property edits, the copilot and the audit trail all
   currently report outcomes the system did not produce.
2. **This app must not lose work.** One writer per model, atomic writes, undo for every
   destructive action, a confirmation before anything is deleted.
3. **This app must not fall over on a real file.** 8-second freezes, 1000× unit errors and
   wall-less clash checks are all failures on files that exist in the wild — not on the small
   bundled samples the demo path happens to use.
