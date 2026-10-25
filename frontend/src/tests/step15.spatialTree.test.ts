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
