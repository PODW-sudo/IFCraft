# STEP-15 — handoff notes (virtualised spatial tree)

## 2026-10-25 - Spatial tree renders a windowed row slice instead of every expanded node
- **Type:** Bug
- **Platform:** http://localhost:5173
- **Related tests:** TC-027, TC-028, TC-029, TC-031, TC-032
- **Severity:** P1
- **Observed:** `GlassSpatialTree` re-walked each rendered node's subtree on every keystroke
  (`matchesSearch` inside `renderNode` → O(n²) per character) and emitted one DOM element per
  descendant with no windowing; the initial expansion walked every node to depth 3. On a
  federated model the panel froze the main thread while opening a storey or typing a filter.
- **Expected:** One O(n) index pass per keystroke, a bounded number of rows in the DOM
  (`ceil(viewport/32) + 12`), matches inside collapsed branches still visible with their path,
  and a scrollbar that still reflects the whole row count.
- **Evidence:** `frontend/src/tests/step15.spatialTree.test.ts` (9 tests, passing).
  Before: the file failed to resolve `../utils/spatialTreeIndex`.
- **Suggested fix:** Landed. `frontend/src/utils/spatialTreeIndex.ts` (new, pure) provides
  `collectMatchingIds`, `buildAncestorSet`, `flattenVisibleTree`, `computeWindow`,
  `initialExpandedIds`, `keepRowInView`, `TREE_ROW_HEIGHT = 32`, `TREE_OVERSCAN = 6`,
  `TREE_ROW_BUDGET = 1000`. `GlassSpatialTree.tsx` now measures its scroll body
  (`onScroll` + guarded `ResizeObserver`), renders `rows.slice(start, end)` between two spacer
  divs, keeps every row at exactly `TREE_ROW_HEIGHT` inline, and re-anchors `scrollTop` only when
  the toggled node leaves the viewport.
- **Status:** Open (code landed; component-level assertions and the browser measurement below
  are still outstanding)

## Deferred work / follow-ups

### 1. Component assertions (now unblocked — STEP-27's jsdom infrastructure has landed)
`frontend/vite.config.ts` gained `test: { environment: 'jsdom', setupFiles: ['./src/tests/setup.ts'] }`
while this step was in flight, so the assertions the step doc deferred to its acceptance criteria
can now be written:
- rendered row count stays at `ceil(viewport/32) + 12` after scrolling an expanded storey;
- expanding a node near the bottom keeps it on screen;
- `No model loaded` when `tree === null`; isolate button present on every visible row.
Not written here: this lane's assigned validation was the pure-logic test file only.

### 2. Row budget can hide the tail of a very large branch
`flattenVisibleTree` truncates at `maxRows` (module default 200, the component asks for
`TREE_ROW_BUDGET = 1000`). A storey with more than 1000 children will not show rows past the
budget even when scrolled — the spacers are computed from the truncated list, so the scrollbar is
honest about what exists but the extra elements are unreachable until the list is paginated.
Follow-up (STEP-28 territory): raise the budget, page it, or emit a "refine the filter" row.
Do not silently drop the cap — it is what bounds a single frame's work on a 50k-node model.

### 3. Design questions for @designer (file: `frontend/src/components/tree/GlassSpatialTree.tsx`)
- Row density is now a **layout invariant** at 32 px. 28 px would work by changing
  `TREE_ROW_HEIGHT` alone; anything that wraps text breaks the windowing arithmetic.
- Indent step is still `depth * 12`, and the child-count badge still uses `text-[10px]`.
- `FlatTreeRow.matched` is available but deliberately unused: no highlight was invented for
  filter matches. If a highlight is wanted, it is a one-line class change in `renderRow`.

### 4. App wiring needed: **none**
Props, `useResizable` usage, collapsed-rail markup, isolate behaviour, all existing `data-qa`
attributes (`spatial-tree`, `tree-search-input`, `tree-node-chevron`, `tree-toggle-collapse-btn`,
`tree-uncollapse-btn`, `tree-close-btn`) and the render site at `App.tsx:1650-1660` are unchanged.
One attribute was **added** for the harness: `data-qa="tree-scroll-body"` on the scroll container.

### 5. Test-environment note
`src/tests/step15.spatialTree.test.ts` is pure and environment-agnostic; it passes under the
new jsdom default. `pnpm exec tsc -b --noEmit` reports no error in any file this step touched.
