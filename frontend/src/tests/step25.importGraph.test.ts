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
    // Glob keys are relative to this file: `../App.tsx` for modules under `src/`, but
    // `./x.test.ts` for files in `src/tests/` itself. Test files are harness infra, not
    // product modules, so only the `../` keys enter the graph.
    .filter(([globKey]) => globKey.startsWith('../'))
    .map(([key, text]) => [toModulePath(key), text] as [string, string])
    .filter(([path]) => !path.endsWith('.d.ts')),
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

/**
 * Modules that are unreachable *today for reasons outside STEP-25*: they were extracted by
 * other in-flight audit steps that have not wired them into a live importer yet. STEP-25 owns
 * deletions, not wiring, so it must not fail on them — but any module that goes unreachable for
 * any *other* reason still fails this test. Each entry is that step's to remove from this list
 * (by wiring or deleting it); the list must be empty once Wave D lands.
 */
// All previously-exempt modules are now wired into App.tsx / ThreeViewport.tsx. The list stays
// empty so any newly unreachable module fails this guard instead of needing another exemption.
const KNOWN_UNREACHABLE_OUTSIDE_STEP25: string[] = [];

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
      .filter((path) => !KNOWN_UNREACHABLE_OUTSIDE_STEP25.includes(path))
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
