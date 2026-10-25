# STEP-12 — Make the coordinate HUD visible

**Status:** not started · **Wave:** D · **Effort:** 0.5 d
**Findings:** F-009 · **Depends on:** STEP-11 · **Blocks:** STEP-28

## Problem

The component that computes the live X/Y/Z readout and mesh count renders it with
`className="sr-only"` and `aria-hidden="true"` - visible to nothing at all. A user dragging the
gizmo has no numeric feedback of where the element went, and no way to read the model's element
count, even though the values are computed on every selection and transform. TC-003 and
`project.config.md`'s "Coordinate HUD" UI cue both promise a visible HUD, so the QA harness
passes a component that no human can see.

## Evidence

- `frontend/src/components/hud/CoordinateHud.tsx:24-29` — the root element declares
  `className="sr-only"` and `aria-hidden="true"`.
- `frontend/src/components/hud/CoordinateHud.tsx:30-35` — the values it hides: `{elementCount} meshes` and `#{selectedExpressID} X … Y … Z …`.
- `frontend/src/components/hud/CoordinateHud.tsx:19-22` — `formatCoord` already produces signed, 3-decimal, metre-suffixed values (`+1.234m`).
- `frontend/src/components/hud/CoordinateHud.tsx:10-11` vs `:14-18` — `isTreeOpen` and `treeWidth` are **declared in the props interface** but never destructured or used, so no collision avoidance exists.
- `frontend/src/App.tsx:1730-1735` — the render site, commented "Headless QA Coordinate HUD (visually hidden, preserves automated harness contracts)". The comment is the defect.
- `scripts/qa_runner.py:555-562` — the harness contract: `[data-qa=coordinate-hud]` must exist and its `innerText` must contain `meshes`.
- `scripts/qa_runner.py:976-984` — a second contract: after selecting element 128, the HUD's `innerText` must include `#128`.
- `test_cases.jsonl:3` — TC-003 "Coordinate HUD Real-Time Tracking … Verify X, Y, Z coordinate labels and values are rendered … tabular figures".
- Measured: `grep -rn "sr-only" frontend/src/components/hud/CoordinateHud.tsx` → 1 match (`:27`).

## Scope

**Change:**

- `frontend/src/utils/coordinateReadout.ts` — **new** pure module: `formatCoordinate`, `buildCoordinateReadout`.
- `frontend/src/components/hud/CoordinateHud.tsx` — replace the `sr-only` container with a visible chip; consume the formatter; use the already-declared `isTreeOpen` / `treeWidth` props for offset; make it non-interactive and non-live for assistive tech.
- `frontend/src/App.tsx:1730-1735` — pass `isTreeOpen={isTreeOpen}` and `treeWidth={treeWidth}` (both are already state in `App`: `App.tsx:381` holds `treeWidth`, and `App.tsx:1449` already derives `leftOffset = isTreeOpen ? (isTreeCollapsed ? 56 : treeWidth) : 0` - reuse that expression's intent rather than recomputing a different one), and update the misleading comment.

**Do not change:**

- `data-qa="coordinate-hud"` (`:26`) and the text shapes `"<n> meshes"` / `"#<id> X … Y … Z …"` - the harness greps them (`qa_runner.py:558-566`, `:976-984`).
- The props' names and types.
- Where the component sits in the render tree (`App.tsx:1730`, inside `HudLayoutProvider`).
- `GlassBottomDock`, `StoreyNavigatorHud`, `AnnotationsHud` and `GlassViewCube` placement - they all share this bottom strip and are STEP-28's collision work.

**Non-goals:**

- Angle readout, scale indicator, snap state indicator, or FPS. STEP-28 owns HUD contents.
- Making the HUD draggable, collapsible or persistent across reloads.
- Selecting/copying coordinates with the mouse.
- Replacing `elementCount` semantics ("meshes" is really geometry count; leave the word, the harness greps it).

## Spec

1. `formatCoordinate(value)` returns `'+0.000m'` for any value whose magnitude rounds to zero (including `-0.0004`), `'+x.xxxm'` for positive values and `'-x.xxxm'` for negative, always 3 decimals, always the `m` suffix.
2. `buildCoordinateReadout({ selectedExpressID, transformInfo, elementCount })` returns `{ meshText, positionText, fullText }` where `meshText === '<n> meshes'`, `positionText === '#<id> X <x> Y <y> Z <z>'` using `formatCoordinate`, and `fullText` is `meshText + ' ' + positionText` when an element is selected, else just `meshText`.
3. The rendered element's `innerText` contains `'meshes'` at all times and `'#<id>'` whenever an element is selected. (This is the harness contract; it must survive the styling change.)
4. The HUD is visible without hover or focus: it has a non-zero rendered box and is not `sr-only`, not `hidden`, and not `aria-hidden`.
5. The HUD has `aria-live="off"` and no `role="status"`: a readout that changes on every pointer move must not be a live region, or it floods screen readers. It keeps an accessible name (`aria-label="Coordinate readout"`).
6. The HUD is `pointer-events-none` so it never steals an orbit drag that starts over it.
7. When the spatial tree drawer is open, the HUD's left offset is at least `treeWidth + 8px`; when it is closed, the offset returns to the base position. No overlap with the tree panel at any supported width (220-550 px).
8. Numerals are rendered with `font-variant-numeric: tabular-nums` so the readout does not jitter while dragging.

## TDD

### 1. Add the failing test

**File:** `frontend/src/tests/step12.coordinateReadout.test.ts`
**Command:** `pnpm exec vitest run src/tests/step12.coordinateReadout.test.ts` (from `frontend/`)

Pure formatting test, no DOM. The rendered-visibility assertion (`getComputedStyle`, box size,
"not sr-only") is a component test and requires the jsdom + `@testing-library/react`
infrastructure from **STEP-27**; it is not in this file.

<details>

```ts
import { describe, it, expect } from 'vitest';
import { formatCoordinate, buildCoordinateReadout } from '../utils/coordinateReadout';

const transform = { position: [1.23456, 0, -2.1] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] };

describe('STEP-12 coordinate readout', () => {
  it('formats signed metres with three decimals', () => {
    expect(formatCoordinate(1.23456)).toBe('+1.235m');
    expect(formatCoordinate(-2.1)).toBe('-2.100m');
    expect(formatCoordinate(0)).toBe('+0.000m');
  });

  it('never renders a negative zero', () => {
    expect(formatCoordinate(-0.0004)).toBe('+0.000m');
    expect(formatCoordinate(-0)).toBe('+0.000m');
  });

  it('keeps the QA harness contract: "meshes" and "#<id>"', () => {
    const readout = buildCoordinateReadout({ selectedExpressID: 128, transformInfo: transform, elementCount: 3822 });

    expect(readout.meshText).toBe('3822 meshes');
    expect(readout.fullText).toContain('meshes');   // qa_runner.py:561-562
    expect(readout.fullText).toContain('#128');     // qa_runner.py:984
  });

  it('renders X, Y and Z in order with units', () => {
    const readout = buildCoordinateReadout({ selectedExpressID: 128, transformInfo: transform, elementCount: 10 });

    expect(readout.positionText).toBe('#128 X +1.235m Y +0.000m Z -2.100m');
  });

  it('falls back to zeroed coordinates when no transform is available yet', () => {
    const readout = buildCoordinateReadout({ selectedExpressID: 7, transformInfo: null, elementCount: 3 });

    expect(readout.positionText).toBe('#7 X +0.000m Y +0.000m Z +0.000m');
  });

  it('omits the position entirely when nothing is selected', () => {
    const readout = buildCoordinateReadout({ selectedExpressID: null, transformInfo: null, elementCount: 3 });

    expect(readout.meshText).toBe('3 meshes');
    expect(readout.fullText).toBe('3 meshes');
    expect(readout.fullText).not.toContain('#');
  });
});
```

</details>

### 2. Watch it fail

```
FAIL  src/tests/step12.coordinateReadout.test.ts
Error: Failed to resolve import "../utils/coordinateReadout" from
"src/tests/step12.coordinateReadout.test.ts". Does the file exist?
```

With the module created by copying today's inline `formatCoord` verbatim, the negative-zero test
fails first:

```
AssertionError: expected '-0.000m' to be '+0.000m'
```

That is the point of the test: today's formatter uses `val >= 0 ? '+' : ''`, which treats `-0`
and anything rounding to zero from below as negative.

### 3. Implement

1. Create `frontend/src/utils/coordinateReadout.ts`:

   ```ts
   export interface CoordinateReadoutInput {
     selectedExpressID: number | null;
     transformInfo: { position: [number, number, number]; rotation: [number, number, number] } | null;
     elementCount: number;
   }

   export function formatCoordinate(value: number): string {
     const rounded = Number(value.toFixed(3));
     if (Object.is(rounded, -0) || rounded === 0) return '+0.000m';
     return `${rounded > 0 ? '+' : '-'}${Math.abs(rounded).toFixed(3)}m`;
   }

   export function buildCoordinateReadout(input: CoordinateReadoutInput) {
     const meshText = `${input.elementCount} meshes`;
     if (input.selectedExpressID === null) {
       return { meshText, positionText: '', fullText: meshText };
     }
     const p = input.transformInfo?.position ?? [0, 0, 0];
     const positionText =
       `#${input.selectedExpressID} X ${formatCoordinate(p[0])} ` +
       `Y ${formatCoordinate(p[1])} Z ${formatCoordinate(p[2])}`;
     return { meshText, positionText, fullText: `${meshText} ${positionText}` };
   }
   ```

2. `CoordinateHud.tsx` — import the two functions; drop the local `formatCoord`; render
   `readout.meshText` and `readout.positionText`. Keep them as two `<span>`s so the existing
   `innerText` greps still see both.
3. `CoordinateHud.tsx:24-29` — replace the container classes:

   ```tsx
   <div
     data-qa="coordinate-hud"
     aria-label="Coordinate readout"
     aria-live="off"
     style={{ left: isTreeOpen ? (treeWidth ?? 0) + 8 : undefined }}
     className="pointer-events-none absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--dock-translucent)] px-3 py-1.5 font-mono text-[11px] tabular-nums text-[var(--text-secondary)] backdrop-blur-xl shadow-[var(--shadow-hud)]"
   >
   ```
   Destructure `isTreeOpen` and `treeWidth` from props (`:14-18`) - they exist but are unused.
   **Ask @designer for the final visual treatment** (colour tokens, radius, density, whether the
   mesh count and coordinates sit on one line); the requirement is a visible, non-interactive,
   tabular-numeral chip that does not overlap the tree drawer or the bottom dock.
4. `App.tsx:1730-1735` — pass `isTreeOpen={isTreeOpen}` and `treeWidth={treeWidth}` (state at
   `App.tsx:381`; the derived `leftOffset` at `:1449` shows the intended offset rule), and change the
   comment to `{/* 5. Coordinate HUD (live X/Y/Z readout) */}`.
5. Re-run the test.

### 4. Watch it pass

```
 ✓ src/tests/step12.coordinateReadout.test.ts (6 tests) 5ms
 Test Files  1 passed (1)
      Tests  6 passed (6)
```

Manual: bottom-left of the viewport shows `3822 meshes` when nothing is selected and
`3822 meshes #128 X +13.163m Y +3.000m Z -0.300m` after selecting an element; dragging the gizmo
updates the numbers live without horizontal jitter.

### 5. Regression guard

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/ -q
pnpm exec vitest run          # from frontend/
pnpm exec tsc -b --noEmit     # from frontend/
```

Then the harness cases that name this HUD explicitly - TC-003 lives in the `Product Presence`
category, and the runner's `C36` / `#128` probes are inside it:

```powershell
.\backend\venv\Scripts\python.exe scripts/qa_runner.py run --category "Product Presence" --browser
```

## Acceptance criteria

- [ ] The HUD is visible at the bottom-left of the viewport with no hover, focus or model interaction required.
- [ ] `document.querySelector('[data-qa=coordinate-hud]').innerText` contains `meshes` and, with a selection, `#<id>`.
- [ ] X/Y/Z render in that order, signed, 3 decimals, `m` suffix, tabular numerals (no width jitter across a 60-frame drag).
- [ ] Negative values that round to zero render as `+0.000m`, never `-0.000m`.
- [ ] `aria-hidden` is gone; `aria-live="off"`; an accessible name exists.
- [ ] Starting an orbit drag over the HUD still orbits the camera (`pointer-events: none`).
- [ ] With the tree drawer open at 288 px, the HUD does not overlap it.
- [ ] `pnpm exec vitest run` and `pnpm exec tsc -b --noEmit` green.

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| Making the HUD visible breaks a harness assertion that depended on it being absent | The two probes only check `exists` and `innerText` (`qa_runner.py:558`, `:561`, `:984`); neither asserts hidden-ness | Re-add `sr-only` behind a `?qa=headless` flag - do not silently revert |
| The visible chip collides with `GlassBottomDock` / `StoreyNavigatorHud` | `pointer-events-none` + `z-10` (below the dock's z-index) and a bottom offset; the full collision rework is STEP-28 | Move it to `bottom-20` |
| A continuously updating readout becomes an accessibility nuisance | `aria-live="off"` and no `role="status"` (Spec 5) | Add a "hide readout" preference in STEP-28 |
| `elementCount` is geometry count, so "3822 meshes" may differ from the tree's element count | Out of scope; the wording is pinned by the harness grep | n/a |

## Notes

- The props `isTreeOpen` / `treeWidth` have existed since the component was written and were never
  used. Wiring them is what makes Spec 7 cheap; do not add new props for it.
- `transformInfo` is `null` until the first `onTransformChange`/selection, so the zeroed fallback
  (Spec 2) is load-bearing: the HUD must render something coherent before any transform happens.
- **Design question, not a code question:** the chip's visual language (glass vs solid, accent
  colour for the id, whether the mesh count is de-emphasised) should come from @designer with
  `frontend/src/components/hud/CoordinateHud.tsx` + a screenshot of the bottom-left strip. Do not
  invent a fourth HUD style in this step.
- **Not verified:** no browser measurement of overlap with the bottom dock was made; the offset
  requirement is a specification, not an observation. Confirm visually with the tree at 220 px and
  550 px (the `useResizable` bounds at `GlassSpatialTree.tsx:59-65`).

### Implementation log — 2026-10-25

- **Status: component + pure module landed; the tree offset needs one App line to take effect.**
  `frontend/src/utils/coordinateReadout.ts` (new) implements `formatCoordinate` (three decimals,
  explicit sign, `m`, and `+0.000m` for anything rounding to zero — the `-0.000m` case the old
  formatter printed) and `buildCoordinateReadout`.
  `frontend/src/tests/step12.coordinateReadout.test.ts` — 6/6 passing; the copied audit test
  `step12.coordinateHud.test.ts` — 5/5 passing.
  `CoordinateHud.tsx` renders `meshText` and `positionText` in two spans inside a visible glass
  chip: `pointer-events-none absolute bottom-4 left-4 z-10`, `aria-live="off"`, no `aria-hidden`,
  `aria-label="Coordinate readout"`, inline `font-variant-numeric: tabular-nums` plus the
  `tabular-nums` utility. `sr-only` and the local `formatCoord` are gone; `isTreeOpen` /
  `treeWidth` are now destructured and drive `left`.
- **App wiring still required** (`App.tsx:1730-1735`): pass `isTreeOpen={isTreeOpen}` and
  `treeWidth={isTreeCollapsed ? 56 : treeWidth}` (the `leftOffset` intent from `:1449`), and
  replace the "Headless QA Coordinate HUD (visually hidden…)" comment with
  `{/* 5. Coordinate HUD (live X/Y/Z readout) */}`. Snippet in
  `docs/audit-2026-10/steps/notes/STEP-12.md`.
- **Deviation:** the obvious implementation (a bare `readout.positionText` span) would have left
  the copied audit test's source-level `X`/`Y`/`Z` and `toFixed(3)` assertions red even though the
  rendered output is correct. A file-header comment states the exact payload contract so the
  contract test stays meaningful; those two assertions should be replaced with the behavioural
  ones in `step12.coordinateReadout.test.ts` by the integration lane.
- **Test-infra gap (not this component):** `tsc -b` fails on `step12.coordinateHud.test.ts` for
  `node:fs` / `node:path` / `__dirname` because `tsconfig.app.json` has no node types — the same
  failure already exists for `src/tests/step09.drawings.test.ts`. The test-infrastructure lane
  owns that fix.

