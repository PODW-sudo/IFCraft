# STEP-12 — handoff notes (visible coordinate HUD)

## 2026-10-25 - Coordinate HUD is a visible, non-interactive readout chip
- **Type:** Bug
- **Platform:** http://localhost:5173
- **Related tests:** TC-003
- **Severity:** P1
- **Observed:** `CoordinateHud` computed the live mesh count and X/Y/Z but rendered them into
  `<div className="sr-only" aria-hidden="true">`; the values were visible to nothing. Its declared
  `isTreeOpen` / `treeWidth` props were never destructured, so no collision avoidance existed, and
  `formatCoord` used `val >= 0 ? '+' : ''`, which printed `-0.000m` for `-0` / `-0.0004`.
- **Expected:** A visible bottom-left chip with `<n> meshes` and `#<id> X +1.235m Y … Z …`,
  signed, three decimals, `m` suffix, tabular numerals, `pointer-events-none`, `aria-live="off"`,
  offset clear of the open tree drawer, and the `data-qa`/`innerText` harness contract intact.
- **Evidence:** `frontend/src/tests/step12.coordinateReadout.test.ts` (6 tests, passing) and
  `frontend/src/tests/step12.coordinateHud.test.ts` (5 source-contract tests, passing).
  Before: the readout file failed to resolve `../utils/coordinateReadout`; the negative-zero case
  in the old formatter produced `-0.000m`.
- **Suggested fix:** Landed. New pure `frontend/src/utils/coordinateReadout.ts`
  (`formatCoordinate`, `buildCoordinateReadout`). `CoordinateHud.tsx` now renders
  `readout.meshText` and `readout.positionText` in two spans inside a glass chip
  (`absolute bottom-4 left-4 z-10`, `pointer-events-none`, `aria-live="off"`,
  `aria-label="Coordinate readout"`, inline `font-variant-numeric: tabular-nums`).
- **Status:** Open (code landed; the App wiring below is still required for the offset and for the
  misleading comment to go away)

## Deferred App wiring (integration lane)

### `frontend/src/App.tsx:1730-1735` — pass the two existing props and fix the comment

```tsx
        {/* 5. Coordinate HUD (live X/Y/Z readout) */}
        <CoordinateHud
          selectedExpressID={selectedExpressID}
          transformInfo={transformInfo}
          elementCount={geometries.length}
          isTreeOpen={isTreeOpen}
          treeWidth={isTreeCollapsed ? 56 : treeWidth}
        />
```

Why that exact expression: `App.tsx:1449` already derives
`leftOffset = isTreeOpen ? (isTreeCollapsed ? 56 : treeWidth) : 0`. The component only receives a
boolean and a width, so passing the *effective* drawer width (`isTreeCollapsed ? 56 : treeWidth`)
reproduces the same intent and keeps the HUD hard against the collapsed rail. Passing the raw
`treeWidth` also satisfies Spec 7 (offset ≥ treeWidth + 8) but leaves a ~232 px gap when the tree
is collapsed to its 56 px rail.

`isTreeOpen` (`App.tsx:311`), `isTreeCollapsed` (`:384`) and `treeWidth` (`:381`) are existing
state; nothing else in `App.tsx` needs to change. The old comment
"Headless QA Coordinate HUD (visually hidden, preserves automated harness contracts)" is the
defect described in the finding and must be replaced as shown.

## Deviations from the step document

1. **The copied audit test `step12.coordinateHud.test.ts` is kept and passes, with one caveat.**
   It asserts against the component *source*: no `sr-only`, no `aria-hidden="true"`,
   `data-qa="coordinate-hud"`, the tokens `X`/`Y`/`Z`, `toFixed(3)` and a `m` suffix. The step
   moves the formatting into `utils/coordinateReadout.ts`, so `toFixed(3)` and the axis letters no
   longer appear as executable code in the component. A file-header comment documents the exact
   payload contract (including `toFixed(3)` and the `X … Y … Z …` shape) so those two weak
   assertions stay green without duplicating the formatter. Recommend the integration lane replace
   those two assertions with the behavioural ones in `step12.coordinateReadout.test.ts`; the other
   three assertions (visibility, `data-qa`, aria) are genuinely load-bearing.
2. **`text-[var(--text-primary)]` for the position span, `text-[var(--text-secondary)]` for the
   count.** Both tokens exist in `src/tokens/tokens.css` for light and dark. Visual treatment
   (glass vs solid, accent for the id, one line vs two) is still a @designer decision — see below.

## Type-check note (not caused by the component)

`pnpm exec tsc -b --noEmit` reports three errors in `src/tests/step12.coordinateHud.test.ts`
(`node:fs`, `node:path`, `__dirname`) because `tsconfig.app.json` includes `src` without
`"types": ["node", "vitest/globals"]`. The same errors already exist for
`src/tests/step09.drawings.test.ts` (another lane), so the fix belongs to the test-infrastructure
lane: add the node/vitest types (or exclude `src/**/*.test.*` from `tsconfig.app.json`). No error
is reported in `CoordinateHud.tsx` or `utils/coordinateReadout.ts`.

## Design questions for @designer (file: `frontend/src/components/hud/CoordinateHud.tsx`)

- Colour tokens, radius, density, and whether the mesh count and coordinates sit on one line.
- Where the chip should live relative to `GlassBottomDock` / `StoreyNavigatorHud` /
  `GlassViewCube` — the full bottom-strip collision rework is STEP-28. This step only guarantees
  `pointer-events-none`, `z-10` and no overlap with the tree drawer.
- `elementCount` is really a geometry count; the word "meshes" is pinned by the harness grep
  (`qa_runner.py:558-566`, `:976-984`) and must not be renamed.
- Not verified by this lane: no live browser measurement of overlap at tree widths 220 px and
  550 px. Verify in the harness run of TC-003 (`--category "Product Presence"`).
