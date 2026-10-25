# STEP-15 — Virtualise the spatial tree

**Status:** not started · **Wave:** B · **Effort:** 2 d
**Findings:** F-031 · **Depends on:** STEP-27 · **Blocks:** STEP-28

## Problem

The spatial tree renders every node of every expanded branch, and the search filter re-walks the
entire subtree **for each rendered node** on **every keystroke** - O(n²) per character. On a
federated model with tens of thousands of elements, opening a storey or typing three letters into
the filter blocks the main thread long enough to freeze the viewport, on a panel that is meant to
be the primary way to find anything.

## Evidence

- `frontend/src/components/tree/GlassSpatialTree.tsx:103-110` — `matchesSearch` recurses into `node.children`:
  ```ts
  const matchesSearch = (node, term) => {
    ...
    return Boolean(node.children && node.children.some((child) => matchesSearch(child, term)));
  };
  ```
- `frontend/src/components/tree/GlassSpatialTree.tsx:112-115` — `renderNode` calls `matchesSearch(node, term)` per node, and `:188` recurses `node.children!.map((child) => renderNode(child, depth + 1))`. Every rendered node therefore re-walks its own subtree → quadratic in the branch size, per keystroke.
- `frontend/src/components/tree/GlassSpatialTree.tsx:186-190` — no windowing: an expanded branch emits one DOM element per descendant, all at once.
- `frontend/src/components/tree/GlassSpatialTree.tsx:46-57` — the initial expansion walks and expands **every node to depth 3**, so a large model starts already expanded three levels deep.
- `frontend/src/components/tree/GlassSpatialTree.tsx:307` — the scroll container is a plain `overflow-y-auto` div with no measurement or windowing.
- Measured: `grep -rn "virtual\|windowing\|useVirtualizer\|react-window" frontend/src frontend/package.json` → **0 matches**; no virtualisation dependency is installed.
- Scale reference: `modelsfortests/Ifc2x3_SampleCastle.ifc` has 3,822 elements (sample metadata, `backend/app/api/projects.py:57`); federated projects multiply that by the number of sub-models.

## Scope

**Change:**

- `frontend/src/utils/spatialTreeIndex.ts` — **new** pure module: `collectMatchingIds`, `buildAncestorSet`, `flattenVisibleTree`, `computeWindow`, `TREE_ROW_HEIGHT`.
- `frontend/src/components/tree/GlassSpatialTree.tsx:103-193` — delete the recursive `renderNode`/`matchesSearch`; render a windowed slice of `flattenVisibleTree(...)` rows by absolute position.
- `frontend/src/components/tree/GlassSpatialTree.tsx:291-316` — the scroll body measures its own height and `scrollTop` and renders `rows.slice(start, end)` between two spacer divs.
- `frontend/src/components/tree/GlassSpatialTree.tsx:46-57` — stop expanding to depth 3 unconditionally; expand the root, the site/building path and the first storey only, so the initial row count is bounded.
- `frontend/src/components/tree/GlassSpatialTree.tsx:186-190` — expansion toggling must not change the scroll position (the row index of the toggled node stays visible).

**Do not change:**

- The props interface (`:19-29`), including `onToggleIsolate`, `fileName`, `onWidthChange`.
- The existing `data-qa` attributes (`:137`, `:298`, `:204-205`, `:222-223`, `:253-257`, `:263-268`) - the QA harness drives the tree through them.
- `useResizable` usage (`:59-71`) and the collapsed-rail rendering (`:218-241`, `:276-289`).
- The isolate button's behaviour (`:167-183`).
- `App.tsx:1650-1660` (the render site and its props).

**Non-goals:**

- Changing the tree's data (grouping by discipline, filtering by storey, showing psets inline).
- Drag-and-drop, multi-select, or keyboard navigation of the tree (STEP-28 owns ergonomics).
- Virtualising the *omnibar* result list - it is already capped at 15 (`SpatialOmnibar.tsx:182-187`).
- Reducing the tree payload from the worker or adding lazy `children` loading; the tree data model stays eager.

## Spec

1. `collectMatchingIds(tree, term)` returns the set of `express_id`s whose `name`, `type` or `express_id` contains `term`, case-insensitively, visiting each node **at most once**. An empty/whitespace term returns `null` (meaning "no filter"), not an empty set.
2. `buildAncestorSet(tree, ids)` returns the set of ids that are ancestors of any id in `ids` (the root included when a descendant matches).
3. `flattenVisibleTree(tree, options)` returns `FlatTreeRow[]` where each row is `{ express_id, name, type, depth, hasChildren, childCount, matched }`.
4. Without a filter, `flattenVisibleTree` descends only into nodes present in `expanded`; a collapsed node's descendants are **never visited** (not merely hidden), and `node.children` is read at most once per node.
5. With a filter, `flattenVisibleTree` descends regardless of `expanded` but emits a row only when the node is in `matchedIds` or in `ancestorsOfMatches`; emitted rows therefore always form a connected path from the root to each match.
6. `flattenVisibleTree` stops after `maxRows` emitted rows (default `windowSize * 4`, minimum 200) to bound the work even for a fully expanded 50k model.
7. `computeWindow({ scrollTop, viewportHeight, rowHeight, totalRows, overscan })` returns `{ start, end, topPadding, bottomPadding }` with `start = max(0, floor(scrollTop/rowHeight) - overscan)`, `end = min(totalRows, firstVisible + ceil(viewportHeight/rowHeight) + overscan)`, and paddings that keep the total scroll height constant (`topPadding + (end - start)*rowHeight + bottomPadding === totalRows*rowHeight`).
8. The rendered row count never exceeds `ceil(viewportHeight/rowHeight) + 2*overscan`, independent of model size.
9. Every row's height is exactly `TREE_ROW_HEIGHT` px (enforced inline), so the windowing arithmetic holds.
10. Toggling a node's expansion keeps that node's row visible: after expansion, `scrollTop` is adjusted so the toggled node's new index is still within the viewport.
11. The tree still renders `No model loaded` when `tree` is null (`:311-313`) and the isolate button still appears on each row.

## TDD

### 1. Add the failing test

**File:** `frontend/src/tests/step15.spatialTree.test.ts`
**Command:** `pnpm exec vitest run src/tests/step15.spatialTree.test.ts` (from `frontend/`)

The index/flatten/window helpers are pure and run today in the node environment. The
`GlassSpatialTree` **component** assertions (rendered row count on scroll, expansion keeps
position) need jsdom + `@testing-library/react` from **STEP-27** - which is why this step declares
that dependency - and are listed under Acceptance criteria instead of here.

<details>

```ts
import { describe, it, expect } from 'vitest';
import {
  collectMatchingIds,
  buildAncestorSet,
  flattenVisibleTree,
  computeWindow,
  TREE_ROW_HEIGHT
} from '../utils/spatialTreeIndex';
import type { SpatialNode } from '../types/ifc';

const leaf = (id: number, name: string, type = 'IfcWall'): SpatialNode => ({
  express_id: id,
  global_id: `g-${id}`,
  name,
  type,
  children: []
});

/** Project → Building → 2 storeys → 3 walls each. */
function makeTree(): SpatialNode {
  return {
    express_id: 1,
    global_id: 'proj',
    name: 'Project',
    type: 'IfcProject',
    children: [
      {
        express_id: 10,
        global_id: 'bld',
        name: 'Building A',
        type: 'IfcBuilding',
        children: [
          {
            express_id: 20,
            global_id: 'st-1',
            name: 'Level 1',
            type: 'IfcBuildingStorey',
            children: [leaf(100, 'Wall A'), leaf(101, 'Wall B'), leaf(102, 'Window C', 'IfcWindow')]
          },
          {
            express_id: 21,
            global_id: 'st-2',
            name: 'Level 2',
            type: 'IfcBuildingStorey',
            children: [leaf(200, 'Wall D'), leaf(201, 'Duct E', 'IfcFlowSegment'), leaf(202, 'Wall F')]
          }
        ]
      }
    ]
  };
}

describe('STEP-15 tree index', () => {
  it('finds a deep match by name, type and express id in one pass', () => {
    const tree = makeTree();

    expect([...collectMatchingIds(tree, 'duct')!]).toEqual([201]);
    expect([...collectMatchingIds(tree, 'ifcwindow')!]).toEqual([102]);
    expect([...collectMatchingIds(tree, '20')!].sort()).toEqual([20, 200, 201, 202]);
  });

  it('returns null for an empty term and an empty set for no match', () => {
    const tree = makeTree();
    expect(collectMatchingIds(tree, '   ')).toBeNull();
    expect(collectMatchingIds(tree, 'nothing-here')!.size).toBe(0);
  });

  it('computes the ancestor path of every match', () => {
    const tree = makeTree();
    const ancestors = buildAncestorSet(tree, new Set([201]));

    expect([...ancestors].sort((a, b) => a - b)).toEqual([1, 10, 21]);
  });
});

describe('STEP-15 flatten', () => {
  it('emits one row per node and only descends into expanded nodes', () => {
    const tree = makeTree();
    const rows = flattenVisibleTree(tree, { expanded: new Set([1, 10, 20]) });

    // 21 is a child of the expanded building, so it appears as a collapsed row after 20's subtree.
    expect(rows.map((r) => r.express_id)).toEqual([1, 10, 20, 100, 101, 102, 21]);
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 2, 3, 3, 3, 2]);
    expect(rows.find((r) => r.express_id === 20)?.childCount).toBe(3);
    expect(rows.find((r) => r.express_id === 21)?.hasChildren).toBe(true);
  });

  it('does not even visit the children of a collapsed node', () => {
    const tree = makeTree();
    let childReads = 0;
    const storey = tree.children![0].children![0];
    Object.defineProperty(storey, 'children', {
      get() {
        childReads += 1;
        return [leaf(100, 'Wall A')];
      }
    });

    const rows = flattenVisibleTree(tree, { expanded: new Set([1, 10]) });

    // `children` is read once (to compute hasChildren/childCount) and never descended into.
    // Implementations that read `node.children` twice will fail this assertion - read it once.
    expect(childReads).toBe(1);
    expect(rows.map((r) => r.express_id)).toEqual([1, 10, 20, 21]);
  });

  it('shows matches inside collapsed branches together with their ancestors', () => {
    const tree = makeTree();
    const matchedIds = collectMatchingIds(tree, 'duct')!;
    const rows = flattenVisibleTree(tree, {
      expanded: new Set([1]), // everything below the project is collapsed
      matchedIds,
      ancestorsOfMatches: buildAncestorSet(tree, matchedIds)
    });

    expect(rows.map((r) => r.express_id)).toEqual([1, 10, 21, 201]);
    expect(rows.at(-1)?.matched).toBe(true);
  });

  it('caps the number of emitted rows', () => {
    const tree = makeTree();
    const rows = flattenVisibleTree(tree, { expanded: new Set([1, 10, 20, 21]), maxRows: 4 });
    expect(rows).toHaveLength(4);
  });
});

describe('STEP-15 window arithmetic', () => {
  it('computes the visible slice and consistent spacers', () => {
    const win = computeWindow({ scrollTop: 3200, viewportHeight: 640, rowHeight: TREE_ROW_HEIGHT, totalRows: 10000, overscan: 4 });

    expect(win.start).toBe(96);   // 3200/32 = 100, minus 4 overscan
    expect(win.end).toBe(124);    // 100 + 20 visible + 4 overscan
    expect(win.topPadding).toBe(96 * TREE_ROW_HEIGHT);
    expect(win.bottomPadding).toBe((10000 - 124) * TREE_ROW_HEIGHT);
    expect(
      win.topPadding + (win.end - win.start) * TREE_ROW_HEIGHT + win.bottomPadding
    ).toBe(10000 * TREE_ROW_HEIGHT);
  });

  it('clamps at the top and the bottom of the list', () => {
    const top = computeWindow({ scrollTop: 0, viewportHeight: 320, rowHeight: 32, totalRows: 10, overscan: 4 });
    expect(top.start).toBe(0);
    expect(top.end).toBe(10);
    expect(top.bottomPadding).toBe(0);

    const bottom = computeWindow({ scrollTop: 318, viewportHeight: 320, rowHeight: 32, totalRows: 10, overscan: 4 });
    expect(bottom.end).toBe(10);
  });
});
```

</details>

### 2. Watch it fail

```
FAIL  src/tests/step15.spatialTree.test.ts
Error: Failed to resolve import "../utils/spatialTreeIndex" from
"src/tests/step15.spatialTree.test.ts". Does the file exist?
```

Then, with the module implemented by porting `matchesSearch`/`renderNode` (per-node recursion,
no ancestor set), the filter test fails - the match inside the collapsed storey is never reached:

```
AssertionError: expected [ 1 ] to deeply equal [ 1, 10, 21, 201 ]
```

### 3. Implement

1. Create `frontend/src/utils/spatialTreeIndex.ts`:

   ```ts
   export const TREE_ROW_HEIGHT = 32;

   export interface FlatTreeRow {
     express_id: number; name: string; type: string; depth: number;
     hasChildren: boolean; childCount: number; matched: boolean;
   }

   export function collectMatchingIds(tree: SpatialNode | null, term: string): Set<number> | null {
     const needle = term.trim().toLowerCase();
     if (!needle) return null;
     const matches = new Set<number>();
     const stack: SpatialNode[] = tree ? [tree] : [];
     while (stack.length) {
       const node = stack.pop()!;
       if (
         node.name.toLowerCase().includes(needle) ||
         node.type.toLowerCase().includes(needle) ||
         node.express_id.toString().includes(needle)
       ) matches.add(node.express_id);
       for (const child of node.children ?? []) stack.push(child);
     }
     return matches;
   }
   ```

   `buildAncestorSet(tree, ids)` is a DFS carrying a path array; push every path member when a hit
   is found. `flattenVisibleTree` and `computeWindow` follow Spec 3-7 exactly. Keep all four
   functions free of React and of the DOM (no `window`, no `document`, no `three`).

2. `GlassSpatialTree.tsx:42-57` — replace `expandedNodes` initialisation: expand `tree.express_id`
   plus the chain down to the first `IfcBuildingStorey` only. Keep `Set<number>`.
3. `GlassSpatialTree.tsx:291-316` — add `scrollTop` / `viewportHeight` state fed by an
   `onScroll` handler and a `ResizeObserver` on the scroll container (guard `typeof ResizeObserver
   !== 'undefined'` so the node test environment does not break).
4. `GlassSpatialTree.tsx:103-193` — delete `matchesSearch` and `renderNode`; add:

   ```tsx
   const matchedIds = useMemo(() => collectMatchingIds(tree, searchTerm), [tree, searchTerm]);
   const ancestorsOfMatches = useMemo(
     () => (matchedIds && matchedIds.size ? buildAncestorSet(tree, matchedIds) : null),
     [tree, matchedIds]
   );
   const rows = useMemo(
     () => flattenVisibleTree(tree, { expanded: expandedNodes, matchedIds, ancestorsOfMatches }),
     [tree, expandedNodes, matchedIds, ancestorsOfMatches]
   );
   const window = computeWindow({ scrollTop, viewportHeight, rowHeight: TREE_ROW_HEIGHT, totalRows: rows.length, overscan: 6 });
   ```

   Render `<div style={{ height: window.topPadding }} />`, `rows.slice(window.start, window.end)`
   as rows, `<div style={{ height: window.bottomPadding }} />`. Each row keeps the current markup
   (indent via `paddingLeft`, chevron, icon, isolate button) with `style={{ height: TREE_ROW_HEIGHT }}`
   merged into the existing inline style.
5. Expansion toggle must not jump: after `toggleExpand`, compute the toggled node's new row index
   and, if it is outside `[window.start, window.end]`, set `scrollTop` accordingly.
6. Re-run the test.

> The row height (32 px) and the overscan (6 rows) are performance constants. Confirm the row
> height with **@designer** before shipping: it is now a layout invariant, not a style preference.
> If the design needs 28 px rows, change `TREE_ROW_HEIGHT` only and the arithmetic and tests follow.

### 4. Watch it pass

```
 ✓ src/tests/step15.spatialTree.test.ts (9 tests) 7ms
 Test Files  1 passed (1)
      Tests  9 passed (9)
```

Browser measurement (after STEP-27 has landed, else measure manually):

```powershell
# Load the castle model (3,822 elements), open the tree, expand Building + all storeys
# Then, with the devtools performance recorder running, type "wall" one character at a time.
# Target: no frame over 16 ms attributable to the tree; DOM node count under ~40 rows.
```

### 5. Regression guard

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/ -q
pnpm exec vitest run          # from frontend/
pnpm exec tsc -b --noEmit     # from frontend/
```

`pnpm exec tsc -b --noEmit` is the second guard: the tree is consumed by the QA harness through
`data-qa` attributes, and a refactor that drops one will not fail at runtime until the harness runs.

## Acceptance criteria

- [ ] With the castle model (3,822 elements) and every storey expanded, the rendered DOM contains at most `ceil(viewport/32) + 12` tree rows.
- [ ] Typing in the filter does not allocate a row for every element; the filter result appears within one frame on a 50k-node tree (manual measurement).
- [ ] A match inside a collapsed storey is shown, along with the path to it.
- [ ] The scroll thumb reflects the full row count (spacer arithmetic), and scrolling to the end shows the last element.
- [ ] Toggling expansion of a node near the bottom keeps that node on screen.
- [ ] The isolate button still works on every visible row; `data-qa="spatial-tree"`, `tree-search-input`, `tree-node-chevron` are unchanged.
- [ ] `No model loaded` still renders when there is no tree.
- [ ] `pnpm exec vitest run` and `pnpm exec tsc -b --noEmit` green.

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| Fixed row height breaks with long names / wrapped text | Names are already `truncate` (`:155`); enforce `h-[32px] overflow-hidden` and a `title` tooltip (already present) | Remove the height and switch to a measured-row windowing library (react-window) - larger change, same tests |
| `ResizeObserver` unavailable in some embedders | Guarded feature detection with a `window.innerHeight` fallback | Compute the window from a fixed assumed height |
| Expansion keeps position but loses the visual anchor when a node above the viewport is toggled | Only adjust `scrollTop` when the toggled node leaves the window | Leave `scrollTop` untouched (accept the jump) |
| `buildAncestorSet` doubles traversal cost on each keystroke | Both passes are O(n) and memoised on `[tree, searchTerm]`; a 50k tree is two array scans, not two per node | Fold the two passes into one function that returns `{ matched, ancestors }` |
| Rows filtered out by `maxRows` are unreachable when scrolling | `maxRows` defaults to `windowSize * 4` and is recomputed on scroll (the window moves), so the cap only bounds a single frame's work | Raise the cap; it is a parameter, not a constant |
| STEP-27 is not landed, so the component test cannot run | The pure-logic tests are independent; do the component assertions manually until STEP-27 lands | Ship the pure modules only and keep the current renderer behind a flag |

## Notes

- **Why STEP-27 is a declared dependency even though the tests here run today:** the interesting
  failures (DOM row count, scroll anchoring, isolate-button hit area) are component behaviours and
  cannot be asserted in the node environment. The pure-logic tests pin the algorithmic contract and
  are worth landing first, but do not close the step without the component assertions.
- **Traversal, not timing, is what the tests assert.** The "does not visit collapsed children" test
  uses a counting getter on `children` rather than a wall-clock budget, because timing assertions on
  CI are flaky. Wall-clock is checked once, manually, per the "Watch it pass" section.
- The `data-qa` attributes are the QA harness's contract (`scripts/qa_runner.py` drives the tree by
  them). Preserve them verbatim; a rename is a silent harness regression.
- **Not verified:** no browser measurement of the current tree's cost was taken by the auditor, and
  no frame-timing number is claimed anywhere in this step. The 3,822-element figure is the sample's
  own metadata (`backend/app/api/projects.py:57`), not a measurement.
- **Design question:** row density (32 px vs 28 px), the indent step (currently `depth * 12` at
  `:131`) and the hover affordances must be confirmed with @designer; the step only fixes the
  invariant that the height is constant.

### Implementation log — 2026-10-25

- **Status: code landed, step not closed.** `frontend/src/utils/spatialTreeIndex.ts` (new, pure,
  no React/DOM/three) implements `collectMatchingIds`, `buildAncestorSet`, `flattenVisibleTree`,
  `computeWindow`, plus `initialExpandedIds`, `keepRowInView`, `TREE_ROW_HEIGHT = 32`,
  `TREE_OVERSCAN = 6`, `TREE_ROW_BUDGET = 1000`.
  `frontend/src/tests/step15.spatialTree.test.ts` — 9/9 passing (was: unresolved import).
- `GlassSpatialTree.tsx`: `matchesSearch`/`renderNode` deleted; the scroll body measures itself
  (`onScroll` + `ResizeObserver` behind a `typeof ResizeObserver !== 'undefined'` guard) and
  renders `rows.slice(start, end)` between two spacer divs; every row sets
  `height: TREE_ROW_HEIGHT` inline; the `space-y-0.5` utility was removed so the arithmetic holds.
  Initial expansion is now `initialExpandedIds(tree)`: root + first-child chain to the first
  `IfcBuildingStorey`.
- **Row cap caveat:** `flattenVisibleTree` truncates at `maxRows` (module default 200; the
  component asks for `TREE_ROW_BUDGET = 1000`). A single storey with more than 1000 children will
  not show its tail until the list is paginated. This is spec 6 working as written, not an
  accident — but it needs a follow-up (raise/paginate) before a 50k-model milestone.
- **Deviations from the spec text:** two helpers not named in the spec (`initialExpandedIds`,
  `keepRowInView`) were extracted so the initial-expansion rule and the scroll-anchor rule are
  testable pure functions instead of inline component logic; one `data-qa` attribute was **added**
  (`data-qa="tree-scroll-body"`). No existing attribute, prop, or `App.tsx` render site changed —
  **this step needs no App wiring.**
- **Not done here:** the deferred component assertions (DOM row count, scroll anchoring,
  isolate hit area). STEP-27's jsdom + `@testing-library/react` infrastructure landed mid-flight
  (`vite.config.ts` has a `test` block with `environment: 'jsdom'`), so they are writable now;
  they were outside this lane's assigned validation. `types` for node globals are still missing in
  `tsconfig.app.json`, which is why test files that read source with `node:fs` fail `tsc -b`.
- Details, follow-ups and the @designer questions: `docs/audit-2026-10/steps/notes/STEP-15.md`.

