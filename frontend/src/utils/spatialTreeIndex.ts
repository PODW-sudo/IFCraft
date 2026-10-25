import type { SpatialNode } from '../types/ifc';

/**
 * Height of one spatial-tree row, in px. This is a *layout invariant*, not a style
 * preference: the windowing arithmetic in `computeWindow` only holds while every row is
 * exactly this tall. Rendered rows therefore set `height: TREE_ROW_HEIGHT` inline.
 *
 * Change this constant (and nothing else) if the design calls for a different density.
 */
export const TREE_ROW_HEIGHT = 32;

/** Overscan rows rendered above and below the viewport, in the component. */
export const TREE_OVERSCAN = 6;

/**
 * Hard cap on rows produced by one `flattenVisibleTree` pass, so that a fully expanded
 * 50k-element federated model can never emit more than this per frame.
 */
const DEFAULT_MAX_ROWS = 200;

/**
 * Row budget the tree component asks for. Higher than the module default so that opening a
 * large storey (~800 elements on the sample castle) is not silently truncated; it still
 * bounds a single frame's flatten work. Rows beyond the budget stays unreachable until the
 * list is paginated (see the step's Notes).
 */
export const TREE_ROW_BUDGET = 1000;

export interface FlatTreeRow {
  express_id: number;
  name: string;
  type: string;
  depth: number;
  hasChildren: boolean;
  childCount: number;
  matched: boolean;
}

export interface FlattenVisibleTreeOptions {
  /** Ids of the nodes the user has expanded. */
  expanded: ReadonlySet<number>;
  /** Result of `collectMatchingIds`; `null`/`undefined` means "no filter". */
  matchedIds?: ReadonlySet<number> | null;
  /** Result of `buildAncestorSet(tree, matchedIds)`; only read in filter mode. */
  ancestorsOfMatches?: ReadonlySet<number> | null;
  /** Upper bound on emitted rows. Defaults to 200. */
  maxRows?: number;
}

export interface TreeWindowInput {
  scrollTop: number;
  viewportHeight: number;
  rowHeight: number;
  totalRows: number;
  overscan: number;
}

export interface TreeWindow {
  start: number;
  end: number;
  topPadding: number;
  bottomPadding: number;
}

/**
 * Collects the `express_id`s whose name, type or id contains `term` (case-insensitive).
 *
 * One iterative pass, each node visited at most once, `children` read at most once per
 * node. Returns `null` for an empty/whitespace term, which means "no filter" - distinct
 * from an empty set, which means "the filter matches nothing".
 */
export function collectMatchingIds(tree: SpatialNode | null, term: string): Set<number> | null {
  const needle = term.trim().toLowerCase();
  if (!needle) return null;

  const matches = new Set<number>();
  if (!tree) return matches;

  const stack: SpatialNode[] = [tree];
  while (stack.length) {
    const node = stack.pop()!;
    if (
      node.name.toLowerCase().includes(needle) ||
      node.type.toLowerCase().includes(needle) ||
      node.express_id.toString().includes(needle)
    ) {
      matches.add(node.express_id);
    }
    const children = node.children ?? [];
    for (let i = 0; i < children.length; i += 1) stack.push(children[i]);
  }
  return matches;
}

/**
 * Returns every id on the path from the root to a node in `ids` (the matched nodes
 * themselves are excluded). The root is included whenever any descendant matches.
 */
export function buildAncestorSet(tree: SpatialNode | null, ids: ReadonlySet<number>): Set<number> {
  const ancestors = new Set<number>();
  if (!tree || ids.size === 0) return ancestors;

  const path: number[] = [];
  const stack: Array<{ node: SpatialNode; depth: number }> = [{ node: tree, depth: 0 }];

  while (stack.length) {
    const { node, depth } = stack.pop()!;
    path.length = depth;
    path.push(node.express_id);

    if (ids.has(node.express_id)) {
      for (let i = 0; i < path.length - 1; i += 1) ancestors.add(path[i]);
    }

    const children = node.children ?? [];
    for (let i = children.length - 1; i >= 0; i -= 1) {
      stack.push({ node: children[i], depth: depth + 1 });
    }
  }
  return ancestors;
}

/**
 * Flattens the tree into the rows that should exist right now.
 *
 * - Without a filter, descends only into nodes listed in `expanded`; the children of a
 *   collapsed node are never visited (not merely hidden from the DOM).
 * - With a filter, descends regardless of `expanded` and emits a row only for matches and
 *   their ancestors, so the emitted rows always form a connected path from the root.
 * - Stops after `maxRows` emitted rows (default 200).
 */
export function flattenVisibleTree(tree: SpatialNode | null, options: FlattenVisibleTreeOptions): FlatTreeRow[] {
  if (!tree) return [];

  const { expanded, matchedIds, ancestorsOfMatches } = options;
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  const filtering = Boolean(matchedIds);

  const rows: FlatTreeRow[] = [];
  const stack: Array<{ node: SpatialNode; depth: number }> = [{ node: tree, depth: 0 }];

  while (stack.length && rows.length < maxRows) {
    const { node, depth } = stack.pop()!;

    // Read `children` exactly once per node: `hasChildren`/`childCount` and the descent
    // below must not disagree, and a getter-backed tree must not be walked twice.
    const children = node.children ?? [];
    const childCount = children.length;
    const hasChildren = childCount > 0;

    const isMatch = filtering ? matchedIds!.has(node.express_id) : false;
    const isAncestor = filtering ? Boolean(ancestorsOfMatches?.has(node.express_id)) : false;

    if (filtering && !isMatch && !isAncestor) {
      // Neither a match nor on the path to one - this subtree cannot contribute a row.
      continue;
    }

    rows.push({
      express_id: node.express_id,
      name: node.name,
      type: node.type,
      depth,
      hasChildren,
      childCount,
      matched: isMatch
    });

    if (!hasChildren) continue;

    const descend = filtering ? true : expanded.has(node.express_id);
    if (!descend) continue;

    for (let i = childCount - 1; i >= 0; i -= 1) {
      stack.push({ node: children[i], depth: depth + 1 });
    }
  }

  return rows;
}

/**
 * Visible slice + spacers for a fixed-row-height list.
 *
 * Invariant: `topPadding + (end - start) * rowHeight + bottomPadding === totalRows * rowHeight`,
 * so the scrollbar thumb always reflects the full list.
 */
export function computeWindow({
  scrollTop,
  viewportHeight,
  rowHeight,
  totalRows,
  overscan
}: TreeWindowInput): TreeWindow {
  if (totalRows <= 0 || rowHeight <= 0) {
    return { start: 0, end: 0, topPadding: 0, bottomPadding: 0 };
  }

  const firstVisible = Math.max(0, Math.floor(scrollTop / rowHeight));
  const visibleCount = Math.ceil(viewportHeight / rowHeight);
  const start = Math.max(0, Math.min(totalRows, firstVisible - overscan));
  const end = Math.max(start, Math.min(totalRows, firstVisible + visibleCount + overscan));

  return {
    start,
    end,
    topPadding: start * rowHeight,
    bottomPadding: (totalRows - end) * rowHeight
  };
}

/**
 * `scrollTop` that keeps `rowIndex` inside a viewport of `viewportHeight`, without moving
 * the list when the row is already fully visible. Used after toggling expansion so the
 * toggled node does not scroll out of view.
 */
export function keepRowInView(
  scrollTop: number,
  rowIndex: number,
  viewportHeight: number,
  rowHeight: number
): number {
  const rowTop = rowIndex * rowHeight;
  const rowBottom = rowTop + rowHeight;
  if (rowTop < scrollTop) return Math.max(0, rowTop);
  if (rowBottom > scrollTop + viewportHeight) return Math.max(0, rowBottom - viewportHeight);
  return scrollTop;
}

/**
 * Initial expansion: the root, then the first-child chain down to and including the first
 * `IfcBuildingStorey`. Bounded row count on load, unlike the previous "expand everything to
 * depth 3".
 */
export function initialExpandedIds(tree: SpatialNode | null): Set<number> {
  const expanded = new Set<number>();
  if (!tree) return expanded;

  let cursor: SpatialNode | undefined = tree;
  while (cursor) {
    expanded.add(cursor.express_id);
    if (cursor.type === 'IfcBuildingStorey') break;
    cursor = (cursor.children ?? [])[0];
  }
  return expanded;
}
