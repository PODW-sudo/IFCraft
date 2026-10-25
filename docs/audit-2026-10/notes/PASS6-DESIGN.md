# Issue 5.5 — UI token polish pass (deliverable)

Bounded polish only: no redesign, no geometry/print layout, no data-qa/data-testid/text changes, no App.tsx/ThreeViewport/collaboration/package.json/tests/backend.

## Per-file verdict

| File | Verdict | What changed |
|------|---------|--------------|
| `frontend/src/components/nav/ShortcutLegend.tsx` | PASS | Dialog bg/border → `--dock-translucent` / `--border-subtle`; heading/subtext/label/muted text → `--text-primary`/`--secondary`/`--muted`; close button and key chip → tokens + `--control-bg`/`--control-hover`. Left `bg-black/70` overlay backdrop and sky brand icon untouched. |
| `frontend/src/components/nav/SaveStatusIndicator.tsx` | PASS | Idle tone → `text-[var(--text-secondary)]`. Kept semantic sky/emerald/rose status hues (saving/saved/error) with their existing dark variants. |
| `frontend/src/components/hud/CoordinateHud.tsx` | PASS | Already fully tokenized (`--border-subtle`, `--dock-translucent`, `--text-primary/secondary`, `--shadow-hud`). No changes needed. |
| `frontend/src/components/federation/ClashInspector.tsx` | PASS | Container/headings/subtext/buttons/tabs/labels/footer/card text → `--text-primary`/`--secondary`/`--muted`; progress & slider tracks → `--border-subtle`. Kept semantic amber/rose/emerald warning/error banners and severity pills, plus brand blue selection. |
| `frontend/src/components/drawings/DrawingSheetsModal.tsx` | PASS (chrome only) | Overlay text → `--text-primary`; header bg → `--dock-translucent`; print icon → `--text-secondary`; divider → `--border-subtle`; sidebar bg → `--glass-surface-card`. Left all drawing geometry/print layout untouched (paper sheet, title block, viewport frames, SVG strokes, detail tags). Kept semantic rose delete/section actions. |
| `frontend/src/components/nav/GlassHeader.tsx` | PASS | Tokenized header chrome across project selector, dropdown text, profile tabs, the 6 drawer toggles, engine switcher, omnibar, search, kbd, drawer group, theme/glass toggles, settings & shortcuts pills → `--text-primary/secondary/muted`, `--dock-translucent`, `--control-bg/hover`, `--border-subtle`. Kept brand logo fills, brand button states, dropdown portal surfaces, dropdown item hover states. |
| `frontend/src/index.css` | NOT CHANGED | No token added. `--surface-canvas` is referenced by `DrawingSheetsModal` inputs but is undefined in `tokens.css` (pre-existing); I did not invent a value per the bounded-scope instruction — noted below as residual risk. |

## Token replacements made
- `--text-primary` — primary headings/labels
- `--text-secondary` — secondary body text
- `--text-muted` — captions/muted text
- `--dock-translucent` — translucent panel/header/sidebar/chip surfaces
- `--control-bg` — control surfaces (key chips, unselected badges, kbd)
- `--control-hover` — hover backgrounds
- `--border-subtle` — subtle borders, dividers, slider & progress tracks
- `--glass-surface-panel` / `--glass-surface-card` / `--glass-border` — kept consistent with existing glass usage

Semantic danger/warning hues (rose error, amber warning, emerald saved) were kept and already carry dark variants. Brand hues (blue/sky/cyan) left as-is.

## Collision check (1024×768 & 1280×800)
Checked via CSS reasoning (no browser render available); **no clear overlap was fixed** because none is unambiguous without paint:
- Coordinate HUD (`bottom-4 left-4 z-10`) vs bottom dock (`bottom:16px z-30`): share the ~16px-from-bottom band; HUD is left-aligned/content-width, dock is centered. At 1024px a sliver of HUD text *could* sit under the dock's left edge when both are visible with long content; z-ordering gives the dock precedence. Not changed — altering positions risks the step12 HUD contract tests.
- Onboarding card vs HUD: settled positions don't overlap (card is centered empty-state overlay; HUD is bottom-left). Transient bottom-slide passes through briefly.
- Save pill vs help/settings: `gap-2` + `ml-1` with 44px coarse-pointer floors; no overlap.
- Clash banner vs footer: clash inspector is `top-20 z-40 fixed w-96`; no viewport footer. Completeness banner lives inside it.
- Toast host vs dock: no separate toast host component exists; soft-lock notification is top-centered; no dock collision.

## Validation results
- `pnpm exec vitest run` → **30 files / 210 tests, all PASS**
- `pnpm exec tsc -b --noEmit` → **no new errors**; only pre-existing TS6133 (unused `screen` import) in the untracked `step12.coordinateHud.render.test.tsx` (baseline was also red on this; tests are off-limits per constraints)
- `pnpm exec vite build` → **green** (EXIT 0); Tailwind arbitrary-value token classes compile

## Residual risk (could not verify without a browser)
1. **HUD vs bottom dock overlap** at 1024×768 when both are visible with long coordinate text (see above).
2. **`--surface-canvas` undefined** — used by `DrawingSheetsModal` inputs but missing from `tokens.css`; pre-existing, left as-is.
3. **AA contrast on both themes** — not visually verified; contrast follows the established token pattern already used by `DrawingSheetsModal`/`CoordinateHud` (the audit's reference tokenized components).
4. **HUD vs onboarding card** during the card's bottom-slide animation — transient only; settled state is clear.

No commit made, no repo-wide formatter run.
