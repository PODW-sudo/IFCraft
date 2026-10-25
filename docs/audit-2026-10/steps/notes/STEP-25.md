## 2026-10-25 - STEP-25: Unreachable UI deleted (F-055, F-056)

- **Type:** Enhancement
- **Platform:** http://localhost:5173
- **Related tests:** `frontend/src/tests/step25.importGraph.test.ts` (STEP-25 import-graph guard); `frontend/src/tests/step15.spatialTree.test.ts`, `step12.coordinateHud.test.ts` (live tree/HUD unchanged)
- **Severity:** P2
- **Observed:** `frontend/src` carried 26 modules / 9,275 lines of UI with no importer — `components/mockup/` (7 files), `archive/` (11 `.tsx` + README), `CadToolbar.tsx`, `GlassNavRail.tsx`, `SpatialTopPill.tsx`, `ContextualModifyBar.tsx`, `PropertyInspector.tsx`, `SpatialTree.tsx`, `PetPalette.tsx`, `SelectionContextOverlay.tsx`. Four archive files were byte-identical copies of live components, and `archive/legacy_ui_v1/ModernGlassMockup.tsx:3` held a dangling import that no gate reported.
- **Expected:** No unreachable module under `frontend/src`; no dangling relative imports; live wiring (`GlassSpatialTree`, `GlassPropertyInspector`, `GlassContextualModifyDock`, `GlassHeader`, `GlassBottomDock`, `SpatialOmnibar`, `ThreeViewport`, `CoordinateHud`) untouched.
- **Evidence:** `git status --porcelain -- frontend/src` shows 27 staged deletions (26 modules + `archive/` README) and no other source change; verified zero live importers by grep/git-grep before each removal. `pnpm exec tsc -b --noEmit` → exit 0, no output. `pnpm exec vitest run` → 21 files / 134 tests passed. `pnpm run build` → success.
- **Discarded uncommitted work — `components/nav/GlassNavRail.tsx` "Sheets" tab (16 insertions, 2 deletions):** the deletion discarded a never-rendered drawings entry point. Diff removed with the file:
  ```diff
  -import { FolderTree, Ruler, Crosshair, Sparkles, PenTool } from 'lucide-react';
  +import { FolderTree, Ruler, Crosshair, Sparkles, PenTool, LayoutGrid } from 'lucide-react';
  -export type GlassNavTab = 'model' | 'cad' | 'measure' | 'clash' | 'copilot' | 'search' | 'settings';
  +export type GlassNavTab = 'model' | 'cad' | 'measure' | 'clash' | 'copilot' | 'sheets' | 'search' | 'settings';
  +  isDrawingSheetsOpen?: boolean;
  +  onToggleDrawingSheets?: () => void;
  +    {
  +      id: 'sheets' as GlassNavTab,
  +      label: 'Sheets',
  +      icon: LayoutGrid,
  +      active: isDrawingSheetsOpen,
  +      onClick: () => {
  +        onSelectTab?.('sheets');
  +        if (onToggleDrawingSheets) onToggleDrawingSheets();
  +      }
  +    }
  ```
  Because `GlassNavRail.tsx` had no importer, this affordance was never on screen: no user-visible functionality is lost, but the *intent* (a Sheets entry point next to the drawing modal) is recorded here so it is not silently dropped.
- **Suggested fix:** File the abandoned Sheets entry point as an F-051 follow-up against the components that actually render (`GlassHeader` and/or `GlassBottomDock`), not against a resurrected nav rail. The `showCadToolbar` flag in `frontend/src/types/profiles.ts` is intentionally left in place (settings-migration surface, STEP-28).
- **Status:** Resolved
