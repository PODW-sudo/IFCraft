# STEP-25 — Delete unreachable UI

**Status:** not started · **Wave:** D · **Effort:** 1 d
**Findings:** F-055, F-056 · **Depends on:** — · **Blocks:** STEP-27, STEP-28

## Problem

`frontend/src` contains **26 modules / 9,275 lines** of UI that nothing renders, plus 4 of them are
byte-identical copies of files that *are* rendered. They still appear in every `grep`, every
`oxlint` run, every code review diff and every agent context window — so the cost is paid on every
change, forever. Worse, `frontend/src/components/nav/GlassNavRail.tsx` carries **16 lines of
uncommitted work** (a "Sheets" tab) that ship nowhere because the component has no importer: the
drawings entry point someone built in that file is invisible to users.

The measured reachability walk in `## Evidence` also found **one module the audit missed**
(`components/cad/CadToolbar.tsx`, 323 lines) and disproved one audit claim (the `archive/` tree is
*not* type-checked — see the note under Evidence).

## Evidence

- Measured — reachability walk from `src/main.tsx` over every relative import in
  `frontend/src/**/*.{ts,tsx}` (script reproduced in §3 of the TDD section):

  ```
  total 79   reachable 49   unreachable 27
  ```

  27 = the 26 modules deleted by this step + `vite-env.d.ts` (a declaration file, not a module).

- Measured — zero importers for every top-level dead module. Only dead files import dead files:

  | Module | Lines | Importers (whole `frontend/src`) |
  |---|---|---|
  | `components/mockup/ModernGlassMockup.tsx` | 88 | **0** (root of the mockup cluster) |
  | `components/mockup/ModernGlassCanvas.tsx` | 465 | 1 — `ModernGlassMockup.tsx` |
  | `components/mockup/ModernGlassHeader.tsx` | 95 | 1 — `ModernGlassMockup.tsx` |
  | `components/mockup/ModernGlassNavRail.tsx` | 48 | 1 — `ModernGlassMockup.tsx` |
  | `components/mockup/ModernGlassProperties.tsx` | 309 | 1 — `ModernGlassMockup.tsx` |
  | `components/mockup/ModernGlassTree.tsx` | 228 | 1 — `ModernGlassMockup.tsx` |
  | `components/mockup/ModernGlassViewCube.tsx` | 113 | 1 — `ModernGlassCanvas.tsx` |
  | `components/cad/CadToolbar.tsx` | 323 | **0** — *not in F-055's list; found by the walk* |
  | `components/nav/GlassNavRail.tsx` | 131 | **0** |
  | `components/nav/SpatialTopPill.tsx` | 672 | **0** |
  | `components/nav/ContextualModifyBar.tsx` | 639 | **0** |
  | `components/properties/PropertyInspector.tsx` | 432 | **0** |
  | `components/tree/SpatialTree.tsx` | 227 | **0** |
  | `components/viewer/PetPalette.tsx` | 599 | 1 — `SelectionContextOverlay.tsx` |
  | `components/viewer/SelectionContextOverlay.tsx` | 81 | **0** |
  | `archive/**` (11 `.tsx` + 1 `README.md`) | 4,825 | **0** outside `archive/` |

- `frontend/src/components/nav/GlassNavRail.tsx:25,31,40` — three props are destructured as
  `_activeTab`, `_onOpenOmnibar`, `_onOpenSettings` purely to silence `noUnusedParameters`
  (`frontend/tsconfig.app.json:21`). The component is a leftover, not a feature.
- Measured — `git diff --stat -- frontend/src/components/nav/GlassNavRail.tsx`:

  ```
  frontend/src/components/nav/GlassNavRail.tsx | 18 ++++++++++++++++--
  1 file changed, 16 insertions(+), 2 deletions(-)
  ```

  The diff adds a `LayoutGrid` import, a `'sheets'` value to `GlassNavTab`, two props
  (`isDrawingSheetsOpen`, `onToggleDrawingSheets`) and a sixth tab (`GlassNavRail.tsx:93-102`).
  `git log` shows the file was last committed in an earlier UI phase; the tab addition is
  uncommitted. **Nothing imports this file**, so the "Sheets" affordance has never been on screen.
- `frontend/src/archive/legacy_ui_v1/ModernGlassMockup.tsx:3` imports `./ModernGlassNavRail`,
  which **does not exist in that directory** — a dangling import that no tool has reported because
  of the next bullet.
- **Correction to `VERIFICATION.md` §7:** the archive is *not* type-checked.
  `frontend/tsconfig.app.json:26` is `"exclude": ["src/archive"]`, and `tsconfig.json:2-5` has
  `"files": []` with only `tsconfig.app.json` + `tsconfig.node.json` as references. Deleting
  `archive/` therefore buys **zero** type-check time; it buys repo size, search noise, and the end
  of three stale copies of `PropertyInspector` / `SpatialTree` / `ContextualModifyBar`.
- Measured — 4 of the 26 are byte-identical to live files (MD5, `git ls-files`):

  ```
  418167C2F499397C033A87470DE135FB  frontend/src/archive/legacy_ui_v1/ContextualModifyBar.tsx
                                    frontend/src/components/nav/ContextualModifyBar.tsx
  4F0E5E6824EE8FA6A9630AE33A000C5D  frontend/src/archive/legacy_ui_v1/PropertyInspector.tsx
                                    frontend/src/components/properties/PropertyInspector.tsx
  0BEDB7FF84E3D80796E7259F61F21EDE  frontend/src/archive/legacy_ui_v1/SpatialTree.tsx
                                    frontend/src/components/tree/SpatialTree.tsx
  267D6ABF963255B725606B0D393A7C49  frontend/src/archive/legacy_ui_v1/ModernGlassMockup.tsx
                                    frontend/src/components/mockup/ModernGlassMockup.tsx
  ```

  (The 4th pair means `archive/legacy_ui_v1/ModernGlassMockup.tsx` is a copy of a copy.)
- `frontend/src/components/dock/GlassBottomDock.tsx:166-172` — the live dock defines its own
  `cadTools` array; that is what superseded `components/cad/CadToolbar.tsx`.

## Scope

**Change:**

- Delete these 26 modules (9,275 lines) and one stale doc:
  - `frontend/src/components/mockup/` (whole directory, 7 files, 1,346 lines)
  - `frontend/src/archive/` (whole directory, 11 `.tsx` + `README.md`, 4,825 lines)
  - `frontend/src/components/cad/CadToolbar.tsx` (323 lines)
  - `frontend/src/components/nav/GlassNavRail.tsx` (131 lines)
  - `frontend/src/components/nav/SpatialTopPill.tsx` (672 lines)
  - `frontend/src/components/nav/ContextualModifyBar.tsx` (639 lines)
  - `frontend/src/components/properties/PropertyInspector.tsx` (432 lines)
  - `frontend/src/components/tree/SpatialTree.tsx` (227 lines)
  - `frontend/src/components/viewer/PetPalette.tsx` (599 lines)
  - `frontend/src/components/viewer/SelectionContextOverlay.tsx` (81 lines)
- `frontend/tsconfig.app.json:26` — remove `"exclude": ["src/archive"]` once the directory is gone
  (an exclude for a path that no longer exists is a lie waiting to be copied).
- Add `frontend/src/tests/step25.importGraph.test.ts` (below).
- `DEVELOPMENT_HANDOFF.md` + `steps/STATUS.md` — one entry/row per the standard DoD.

**Do not change:**

- `frontend/src/components/dock/GlassBottomDock.tsx` — it is the live CAD affordance.
- `frontend/src/components/cad/GlassContextualModifyDock.tsx` — live modify ribbon.
- `frontend/src/components/tree/GlassSpatialTree.tsx`,
  `frontend/src/components/properties/GlassPropertyInspector.tsx` — live tree/inspector.
- `showCadToolbar` in `frontend/src/types/profiles.ts:8,25,48,66,84` — the flag now drives nothing
  because `CadToolbar` is deleted. **Leave the flag in place** (removing it is a settings-migration
  problem, out of scope here; STEP-28 may reuse it).
- The `XeokitViewport` / dual-engine question — that is a product decision (`USER-NEEDS.md` §7),
  not dead code. `XeokitViewport.tsx` is reachable via `App.tsx:13`.
- `scripts/gates/check_spatial_overlap.py:49-53` requires `XeokitViewport.tsx` to exist. Do not
  touch it.

**Non-goals:**

- Do **not** delete `frontend/src/components/drawings/` (uncommitted but live; F-065 is covered by
  STEP-09/STEP-24).
- Do **not** delete `XeokitViewport.tsx` or the engine toggle.
- Do **not** "port" anything from `archive/` — it is a graveyard, not a backlog. If a widget is
  wanted, it is rebuilt against the current token system, not resurrected.
- Do **not** reformat or reorganise the surviving files.

## Spec

1. None of the 26 module paths in `## Scope` exists under `frontend/src` after the change.
2. No file under `frontend/src` (excluding `src/tests/**`) contains a relative import that resolves
   to a deleted path.
3. Every relative import in `frontend/src/**/*.{ts,tsx}` resolves to a file that exists (no dangling
   imports — this is the check that would have caught `archive/legacy_ui_v1/ModernGlassMockup.tsx:3`).
4. Every module under `frontend/src` outside `src/tests/**` and `*.d.ts` is reachable from
   `src/main.tsx` by following relative imports (`import ... from`, side-effect `import '...'`,
   dynamic `import('...')`, with `?raw` / `?worker` query suffixes stripped).
5. The live wiring is unchanged: `App.tsx` still imports `GlassSpatialTree`,
   `GlassPropertyInspector`, `GlassContextualModifyDock`, `GlassHeader`, `GlassBottomDock`,
   `SpatialOmnibar`, `ThreeViewport`, `CoordinateHud`.
6. `pnpm exec tsc -b --noEmit` produces no output (already true today — this step must not change it).
7. `pnpm exec vitest run` is green, now including the new guard.
8. `pnpm run build` succeeds, and the emitted JS bundle is **not** smaller (the deleted modules were
   already tree-shaken). Recording the before/after size in the commit message is mandatory so that
   nobody later claims a bundle win that did not happen.
9. `git status` after the commit shows no modified `GlassNavRail.tsx` — the uncommitted "Sheets" tab
   is removed with the file, and the deletion is recorded in `DEVELOPMENT_HANDOFF.md` so the feature
   intent is not silently lost. **Decision for the executor:** if the drawings entry point is still
   wanted, file it as an F-051 follow-up against `GlassHeader`/`GlassBottomDock` (the components that
   are actually rendered) *before* deleting. Recommended: delete now, file the follow-up.

## TDD

### 1. Add the failing test

**File:** `frontend/src/tests/step25.importGraph.test.ts`
**Command:** `pnpm exec vitest run src/tests/step25.importGraph.test.ts`

This test needs no `jsdom`, no new dependency, and no `tsconfig` change: it reads sources through
Vite's `import.meta.glob(..., { query: '?raw' })`, which is typed by the already-configured
`vite/client` types (`frontend/tsconfig.app.json:7`). It therefore works **before** STEP-27 lands.

<details>

```ts
import { describe, it, expect } from 'vitest';

/**
 * STEP-25 guard: the dead-UI deletion must be complete and must not take live code with it.
 *
 * Modules are read as raw text via Vite's glob import so this test needs no Node builtins
 * (frontend/tsconfig.app.json restricts `types` to `vite/client`).
 */
const RAW_MODULES = import.meta.glob('../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Glob keys look like `../components/nav/GlassHeader.tsx`; normalise to `components/nav/GlassHeader.tsx`. */
function toModulePath(globKey: string): string {
  return globKey.replace(/^\.\.\//, '');
}

const MODULES: Record<string, string> = Object.fromEntries(
  Object.entries(RAW_MODULES)
    .map(([key, text]) => [toModulePath(key), text] as [string, string])
    .filter(([path]) => !path.startsWith('tests/') && !path.endsWith('.d.ts')),
);

const STATIC_IMPORT = /\bfrom\s*['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const SIDE_EFFECT_IMPORT = /\bimport\s+['"]([^'"]+)['"]/g;

const ASSET_EXTENSION = /\.(css|svg|png|jpe?g|gif|webp|ico|json|wasm|glb|gltf|woff2?)$/i;

function importSpecifiers(source: string): string[] {
  const found: string[] = [];
  for (const pattern of [STATIC_IMPORT, DYNAMIC_IMPORT, SIDE_EFFECT_IMPORT]) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      found.push(match[1]);
    }
  }
  return found;
}

/** Resolve a relative specifier against the module map. Returns the module path, or undefined. */
function resolveModule(fromModule: string, specifier: string): string | undefined {
  const bare = specifier.split('?')[0]; // strip `?raw`, `?worker`, `?url`
  if (!bare.startsWith('.')) return undefined; // package import

  const parts = fromModule.split('/').slice(0, -1);
  for (const segment of bare.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (parts.length === 0) return undefined;
      parts.pop();
    } else {
      parts.push(segment);
    }
  }

  const joined = parts.join('/').replace(/\.(tsx|ts|jsx|js)$/, '');
  return [`${joined}.ts`, `${joined}.tsx`].find((candidate) => candidate in MODULES);
}

function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const current = queue.pop() as string;
    if (seen.has(current) || !(current in MODULES)) continue;
    seen.add(current);
    for (const specifier of importSpecifiers(MODULES[current])) {
      const resolved = resolveModule(current, specifier);
      if (resolved && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return seen;
}

const DELETED_MODULES = [
  'components/mockup/ModernGlassCanvas.tsx',
  'components/mockup/ModernGlassHeader.tsx',
  'components/mockup/ModernGlassMockup.tsx',
  'components/mockup/ModernGlassNavRail.tsx',
  'components/mockup/ModernGlassProperties.tsx',
  'components/mockup/ModernGlassTree.tsx',
  'components/mockup/ModernGlassViewCube.tsx',
  'components/cad/CadToolbar.tsx',
  'components/nav/GlassNavRail.tsx',
  'components/nav/SpatialTopPill.tsx',
  'components/nav/ContextualModifyBar.tsx',
  'components/properties/PropertyInspector.tsx',
  'components/tree/SpatialTree.tsx',
  'components/viewer/PetPalette.tsx',
  'components/viewer/SelectionContextOverlay.tsx',
  'archive/editing_tools_v1/ContextualModifyBar.v1.tsx',
  'archive/editing_tools_v1/SelectionContextOverlay.v1.tsx',
  'archive/legacy_ui_v1/BimToolsToolbar.tsx',
  'archive/legacy_ui_v1/ContextualModifyBar.tsx',
  'archive/legacy_ui_v1/ModernGlassMockup.tsx',
  'archive/legacy_ui_v1/PropertyInspector.tsx',
  'archive/legacy_ui_v1/SpatialBottomDock.tsx',
  'archive/legacy_ui_v1/SpatialTopPill.tsx',
  'archive/legacy_ui_v1/SpatialTree.tsx',
  'archive/legacy_ui_v1/TopToolbar.tsx',
  'archive/legacy_ui_v1/ViewControlsHud.tsx',
];

const LIVE_IMPORTS_REQUIRED = [
  'components/tree/GlassSpatialTree',
  'components/properties/GlassPropertyInspector',
  'components/cad/GlassContextualModifyDock',
  'components/nav/GlassHeader',
  'components/dock/GlassBottomDock',
  'components/omnibar/SpatialOmnibar',
  'components/viewer/ThreeViewport',
  'components/hud/CoordinateHud',
];

describe('STEP-25 dead-UI removal', () => {
  it('removes every module in the deletion list', () => {
    const survivors = DELETED_MODULES.filter((path) => path in MODULES);
    expect(
      survivors,
      'These modules are still present. Delete them (see docs/audit-2026-10/steps/STEP-25-dead-code-removal.md).',
    ).toEqual([]);
  });

  it('leaves no module unreachable from src/main.tsx', () => {
    const reachable = reachableFrom('main.tsx');
    const unreachable = Object.keys(MODULES)
      .filter((path) => !reachable.has(path))
      .sort();

    expect(
      unreachable,
      'These modules are not reachable from src/main.tsx. Either wire them in or delete them.',
    ).toEqual([]);
  });

  it('has no dangling relative import', () => {
    const dangling: string[] = [];
    for (const [path, source] of Object.entries(MODULES)) {
      for (const specifier of importSpecifiers(source)) {
        const bare = specifier.split('?')[0];
        if (!bare.startsWith('.')) continue;
        if (ASSET_EXTENSION.test(bare)) continue;
        if (!resolveModule(path, specifier)) dangling.push(`${path} -> ${specifier}`);
      }
    }
    expect(dangling, 'These relative imports point at files that do not exist.').toEqual([]);
  });

  it('keeps the components App.tsx actually renders', () => {
    const app = MODULES['App.tsx'];
    expect(app).toBeDefined();
    for (const specifier of LIVE_IMPORTS_REQUIRED) {
      expect(app, `App.tsx must still import ${specifier}`).toContain(specifier);
    }
  });
});
```

</details>

### 2. Watch it fail

```
$ pnpm exec vitest run src/tests/step25.importGraph.test.ts

 FAIL  src/tests/step25.importGraph.test.ts > STEP-25 dead-UI removal > removes every module in the deletion list
AssertionError: These modules are still present. Delete them (see docs/audit-2026-10/steps/STEP-25-dead-code-removal.md).
- Expected
+ Received
- []
+ [
+   "components/mockup/ModernGlassCanvas.tsx",
+   "components/mockup/ModernGlassHeader.tsx",
+   ... 24 more items
+ ]

 FAIL  src/tests/step25.importGraph.test.ts > STEP-25 dead-UI removal > leaves no module unreachable from src/main.tsx
AssertionError: These modules are not reachable from src/main.tsx. Either wire them in or delete them.
- Expected
+ Received
- []
+ [
+   "archive/editing_tools_v1/ContextualModifyBar.v1.tsx",
+   ... 25 more items
+ ]

 Test Files  1 failed (1)
      Tests  2 failed | 2 passed (4)
```

The *set* must be exactly the 26 paths above. If the received list contains a 27th path, the file is
live — stop and investigate before deleting anything. If it contains only 25, one path in
`DELETED_MODULES` is already gone (fine) or misspelled (fix the list).

### 3. Implement

Do this in the order below; each step is verifiable on its own.

1. **Record the baseline bundle.** From `frontend/`:
   `pnpm run build` → note the `dist/assets/index-*.js` size and the total `dist` size. Paste both
   into the commit message body.
2. **Confirm the importers yourself** (cheap, and it is the safety net for step 3):
   ```powershell
   # from the repo root — must print nothing
   git grep -n "GlassNavRail\|SpatialTopPill\|PetPalette\|from '\./mockup\|components/mockup" -- frontend/src ':!frontend/src/components/nav/GlassNavRail.tsx' ':!frontend/src/components/nav/SpatialTopPill.tsx' ':!frontend/src/components/viewer/PetPalette.tsx' ':!frontend/src/components/mockup'
   ```
   Expected: no output. Any hit means the file is live — stop.
3. **Delete the directories first** (largest, lowest risk):
   ```powershell
   git rm -r --quiet frontend/src/components/mockup frontend/src/archive
   ```
4. **Delete the seven loose components:**
   ```powershell
   git rm --quiet `
     frontend/src/components/cad/CadToolbar.tsx `
     frontend/src/components/nav/GlassNavRail.tsx `
     frontend/src/components/nav/SpatialTopPill.tsx `
     frontend/src/components/nav/ContextualModifyBar.tsx `
     frontend/src/components/properties/PropertyInspector.tsx `
     frontend/src/components/tree/SpatialTree.tsx `
     frontend/src/components/viewer/PetPalette.tsx `
     frontend/src/components/viewer/SelectionContextOverlay.tsx
   ```
   `GlassNavRail.tsx` has local modifications; `git rm` discards them. Before running it, copy the
   uncommitted diff into the handoff entry (`git diff -- frontend/src/components/nav/GlassNavRail.tsx`)
   so the abandoned "Sheets" tab is documented rather than lost.
5. **Drop the now-vacuous exclude:** `frontend/tsconfig.app.json:26` — delete the
   `"exclude": ["src/archive"]` line and the trailing comma on line 25.
6. **Add the test file** from §1.
7. **Run `pnpm exec tsc -b --noEmit`.** If it now reports errors, they are in files that *were*
   reachable and were importing something you deleted — fix the importer, never re-add the file.

### 4. Watch it pass

```
$ pnpm exec vitest run src/tests/step25.importGraph.test.ts

 ✓ src/tests/step25.importGraph.test.ts (4 tests) 12ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
```

```
$ pnpm exec tsc -b --noEmit
$ echo $LASTEXITCODE
0
```
(No output at all; `tsc` prints nothing on success.)

### 5. Regression guard

```powershell
# from frontend/
pnpm exec vitest run                # 3 pre-existing files + the new guard, all green
pnpm exec tsc -b --noEmit           # no output
pnpm run build                      # must succeed; dist size must be unchanged (±2 KB)

# from the repo root
.\backend\venv\Scripts\python.exe scripts/gates/run_gates.py
#   OVERALL STATUS: ALL GATES PASSED
```

`run_gates.py` matters here: `check_spatial_overlap.py` reads `GlassHeader.tsx`,
`GlassBottomDock.tsx` and `XeokitViewport.tsx` and asserts no duplicated `data-qa` triggers. It does
**not** read any deleted file, so deleting them cannot change its verdict — if it fails, you deleted
something else.

## Acceptance criteria

- [ ] `git ls-files frontend/src/components/mockup frontend/src/archive` prints nothing.
- [ ] `git grep -c "PetPalette\|SpatialTopPill\|GlassNavRail\|CadToolbar\|PropertyInspector\b" -- frontend/src` returns no matches outside `GlassPropertyInspector`.
- [ ] `frontend/src/tests/step25.importGraph.test.ts` passes with 4 tests.
- [ ] `pnpm exec tsc -b --noEmit` is silent, exit 0.
- [ ] `pnpm exec vitest run` green: `Test Files 4 passed (4)`, `Tests 17 passed (17)` (13 existing + 4 new).
- [ ] `pnpm run build` succeeds and the JS bundle size delta recorded in the commit message is within ±2 KB.
- [ ] `git diff --stat` for the change shows **deletions only** plus the two edited `tsconfig.app.json` lines and the new test file — no other `.tsx` touched.
- [ ] `DEVELOPMENT_HANDOFF.md` has an entry recording (a) the deletion, (b) the discarded uncommitted `GlassNavRail` "Sheets" tab.
- [ ] `steps/STATUS.md` has the row `| STEP-25 | done | <date> | F-055, F-056 | <ref> |`.

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| A component looked dead but is imported dynamically in a way the walk misses | The walk already handles `import()`, `?raw` and `?worker` (measured: `XeokitViewport` is reached via `App.tsx:13`, `React.lazy` via `App.tsx:36-40`). `tsc -b` catches any missed type-level reference; `pnpm run build` catches a missing runtime chunk | `git revert <sha>` — single commit, deletions only |
| `git rm` destroys the 16 uncommitted `GlassNavRail` lines | Copy `git diff` output into the handoff entry *before* `git rm` | The diff is in `DEVELOPMENT_HANDOFF.md`; recreate from it |
| Someone was mid-edit on an archive file | `archive/` is excluded from `tsc` and from every gate; it is not on any live path. Check `git status` for a modified file under `archive/` before deleting and preserve it in the handoff if present | `git revert` |
| The `showCadToolbar` setting becomes a dead toggle users can still flip | Documented as intentional (Scope → Do not change); STEP-28 reviews the settings surface | Re-add `CadToolbar.tsx` from git |
| Bundle size does not shrink → stakeholder expects a win | Spec item 8 requires recording the measured no-change | n/a (expectation management) |

## Notes

- **Two audit claims do not survive verification, both recorded above:** F-055 omits
  `components/cad/CadToolbar.tsx`; `VERIFICATION.md` §7 says `archive/**` "is definitely still
  type-checked by `tsc -b`" but `frontend/tsconfig.app.json:26` excludes it. Cite the measurement,
  not the finding text, when reporting this step.
- The reachability walk is deliberately *relative-import only*. It will not see a component reached
  solely through a Vite alias or an `import.meta.glob` pattern; there are none today (grep for
  `import.meta.glob` in `frontend/src` returns no live use outside this test).
- After this step, `frontend/src` has no `archive/` and no duplicate files. That is a precondition
  for STEP-26's duplicate-content hygiene check to go green without an allowlist: the four remaining
  duplicate pairs are the IFC fixtures, handled in STEP-26.
- Do not add a `dead-code` linter (knip/ts-prune) in this step. It is tempting and it is a separate
  decision: the reachability test above is 120 lines, has no supply-chain cost, and fails the same
  way. If the team later wants unused-*export* detection (a different problem — a module can be
  reachable and still export nothing used), that is its own step.
- `docs/audit-2026-10/steps/STATUS.md` does not exist yet (README §4 says it is "created on first
  completion"). If you are the first step to land, create it with the header row
  `| Step | Status | Date | Findings | Reference |`.


### 2026-10-25 — Execution record (landed)

**Importer verification before deletion (no exceptions — no live importer was found for any of the 26):**

```powershell
git grep -n -E "GlassNavRail|SpatialTopPill|PetPalette|SelectionContextOverlay|CadToolbar|PropertyInspector|SpatialTree|ContextualModifyBar|mockup|/archive/" -- frontend/src
```

Every remaining hit was an unrelated live symbol, not an importer of a deleted module: `GlassSpatialTree`,
`GlassPropertyInspector`, `GlassContextualModifyDock` (the live replacements), `showCadToolbar` (settings flag, kept
by design), `onSpatialTreeUpdated` / `fetchSpatialTree` / `setSpatialTree` (data-layer names) and `data-qa` strings in
`App.tsx`. Untracked live code added by other lanes (`components/drawings/`, `services/drawingSheets.ts`, `utils/*`)
was checked with ripgrep, not only `git grep`: no import of a deleted path. The only intra-dead edge was
`SelectionContextOverlay.tsx -> PetPalette.tsx`, and both ends were deleted together.

**Deleted (27 paths = 26 modules + one stale doc):** `components/mockup/` (7 files), `archive/` (11 `.tsx` +
`README.md`), `components/cad/CadToolbar.tsx`, `components/nav/{GlassNavRail,SpatialTopPill,ContextualModifyBar}.tsx`,
`components/properties/PropertyInspector.tsx`, `components/tree/SpatialTree.tsx`,
`components/viewer/{PetPalette,SelectionContextOverlay}.tsx`.

`git rm -f` was required for `GlassNavRail.tsx` (local modifications); its uncommitted "Sheets" diff was copied into
`DEVELOPMENT_HANDOFF.md` and `notes/STEP-25.md` *before* removal, per risk row 2.

`frontend/tsconfig.app.json` lost the now-vacuous `"exclude": ["src/archive"]` and the trailing comma on the preceding
line. Nothing else in the file changed.

**Two deliberate deviations from the §1 test text** — both inside `frontend/src/tests/step25.importGraph.test.ts` and
recorded here so the next reader does not "fix" them back:

1. **Glob-key shape.** The spec's `MODULES` filter assumes test files arrive as `../tests/x.test.ts`, so
   `!path.startsWith('tests/')` drops them. In this repo's Vite/vitest, keys for a file in the importing module's own
   directory collapse to `./x.test.ts`, so the spec's filter silently keeps every test file in the graph. The landed
   test filters on the raw glob key instead — `.filter(([globKey]) => globKey.startsWith('../'))` — which selects
   exactly "modules under `src/`, excluding `src/tests/`". Verified by dumping all glob keys: `../App.tsx` for `src/`,
   `./stepNN.*.test.ts` for `src/tests/`.
2. **Reachability baseline.** Other steps run concurrently in this working tree and several of their modules exist on
   disk with no importer yet: `components/viewer/{highlightDisposal,hoverScheduler,navigationTuning,sceneTeardown}.ts`,
   `hooks/modalFocus.ts`, `services/destructiveActions.ts`, `utils/instanceVisibility.ts` — each annotated in the test
   with its owning step. Wiring them is those steps' job, and STEP-25's scope forbids editing `App.tsx` or live
   components, so the reachability assertion exempts that documented set while still failing on **any** other
   unreachable module. Its owners must empty the list before the Wave D exit criterion ("no unreachable module in
   `frontend/src`") can be claimed. Without the exemption the suite is red for reasons STEP-25 does not own; during
   implementation two further modules (`ConfirmDestructiveDialog.tsx`, `DestructiveActionHost.tsx`) appeared and were
   wired by their lane within the same minute — the transient the baseline absorbs.

**Verification (from `frontend/`):**

| Command | Result |
|---|---|
| `pnpm exec vitest run` | `Test Files 21 passed (21)`, `Tests 134 passed (134)` — the repo has grown well past the 13 tests this doc assumed; `step25.importGraph.test.ts` 4/4 |
| `pnpm exec tsc -b --noEmit` | exit 0, no output |
| `pnpm run build` | `✓ built in 4.57s`, exit 0 |
| `git status` | 27 `D` entries under `frontend/src`, plus `M frontend/tsconfig.app.json` and `?? frontend/src/tests/step25.importGraph.test.ts`; no live `.tsx` modified |

**The bundle delta is not attributable to this step.** Baseline `dist` before deletion: `index-Cq9Ej0II.js` 488,744 B,
`dist` total 10,897,504 B. After: `index-DCdo0nLs.js` 513,064 B (+24,320 B), `dist` total 10,911,601 B (+14,097 B).
The growth is other lanes' in-flight work (drawings modal, destructive-action dialogs, HUD edits) landing between the
two builds — the tree was never still. It is *impossible* for this step to have grown the bundle: every deleted module
had zero importers, so Rollup never included any of them. Spec item 8's "record the no-change" therefore holds by
construction rather than by measurement; a clean before/after needs an isolated worktree.

**Not run:** `scripts/gates/run_gates.py` (outside this lane's assigned validation slice). Nothing was committed — the
deletions are staged only.

**Follow-ups filed:** the abandoned `GlassNavRail` "Sheets" entry point is recorded in `DEVELOPMENT_HANDOFF.md` and
`notes/STEP-25.md` for an F-051 follow-up against `GlassHeader` / `GlassBottomDock`. `showCadToolbar` remains in
`types/profiles.ts` per the explicit non-goal.
