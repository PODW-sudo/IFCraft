import { describe, it, expect, vi } from 'vitest';
import type { BimView, DrawingSheet, DrawingViewVectorData } from '../types/drawings';
import {
  buildViewportPathData,
  exportSheetToSvg,
  extractPlanViewVectorData,
  recomputeViewIds
} from '../services/drawingEngine';
import { createWheelZoom } from '../services/wheelZoom';
import { nextFocusIndex } from '../hooks/modalFocus';

/**
 * STEP-24 — Drawings render performance (F-029) + modal keyboard semantics (F-032, F-041).
 *
 * Specs 1-9 of the step document are pure and run here. The rendered assertions (preview emits
 * paths, focus trap, Escape) live in `step24.drawingsA11y.test.tsx`, which needs the jsdom
 * infrastructure from STEP-27.
 */

const WALL = {
  expressID: 101,
  type: 'IfcWallStandardCase',
  matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  color: [0.8, 0.8, 0.8, 1.0],
  positions: new Float32Array([
    0, 0, 0, 10, 0, 0, 10, 3, 0, 0, 0, 0, 10, 3, 0, 0, 3, 0,
    0, 0, 0.3, 10, 0, 0.3, 10, 3, 0.3, 0, 0, 0.3, 10, 3, 0.3, 0, 3, 0.3
  ]),
  normals: new Float32Array(36),
  indices: new Uint32Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
};

function makeView(id: string, position: number): BimView {
  return {
    id,
    name: `View ${id}`,
    type: 'plan',
    elevation: position,
    cutPlane: { axis: 'y', position },
    scale: 100,
    createdAt: '2026-10-24T00:00:00Z'
  };
}

function makeSheet(viewIds: string[]): DrawingSheet {
  return {
    id: 'sheet-1',
    sheetNumber: 'A-101',
    sheetTitle: 'GROUND FLOOR PLAN',
    paperSize: 'A3',
    orientation: 'landscape',
    projectInfo: {
      projectName: 'AutoTest Drawings',
      projectNumber: 'PRJ-1',
      client: 'Client',
      author: 'Author',
      date: '2026-10-24',
      revision: 'Rev A',
      status: 'Preliminary'
    },
    viewports: viewIds.map((viewId, i) => ({
      id: `vp-${i}`,
      viewId,
      viewName: `Viewport ${i}`,
      viewType: 'plan' as const,
      x: 30 + i * 10,
      y: 30,
      width: 160,
      height: 110,
      scale: 100,
      detailNumber: i + 1,
      showTitle: true,
      showFrame: true
    }))
  };
}

describe('drawing path batching (F-029)', () => {
  it('emits one M command per line and splits cut from projection', () => {
    const lines = [
      { x1: 0, y1: 0, x2: 1, y2: 0, isCut: true },
      { x1: 0, y1: 1, x2: 1, y2: 1, isCut: true },
      { x1: 0, y1: 2, x2: 1, y2: 2, isCut: false }
    ];
    const { cut, projection } = buildViewportPathData(lines, {
      centerX: 0,
      centerY: 0,
      viewportCenterX: 10,
      viewportCenterY: 20,
      scaleRatio: 10
    });

    expect(cut.match(/M /g)?.length).toBe(2);
    expect(projection.match(/M /g)?.length).toBe(1);
    expect(cut.startsWith('M ')).toBe(true);
    expect(projection.startsWith('M ')).toBe(true);
  });

  it('exportSheetToSvg still emits exactly two path elements per viewport', () => {
    const plan = extractPlanViewVectorData([WALL as never], 1.2, 'v1');
    expect(plan.lines.length).toBeGreaterThan(1);

    const sheet = makeSheet(['v1']);
    const svg = exportSheetToSvg(sheet, new Map([['v1', plan]]));

    // One batched <path> for the cut boundary, one for the background projection - never one DOM
    // node per segment.
    const pathCount = (svg.match(/<path /g) ?? []).length;
    expect(pathCount).toBe(2);
    // This wall spans the cut plane end to end, so every extracted segment is a cut line and the
    // projection path stays empty; the cut/projection split itself is asserted above.
    const cutCommands = (svg.match(/<path d="M/g) ?? []).length;
    expect(cutCommands).toBe(1);
    expect(svg).toContain('id="viewport-vp-0"');
  });
});

describe('view recomputation (F-029)', () => {
  const cachedWith = (viewId: string): Map<string, DrawingViewVectorData> => {
    const data = extractPlanViewVectorData([WALL as never], 1.2, viewId);
    return new Map([[viewId, data]]);
  };

  it('computes everything on first open', () => {
    const views = [makeView('v1', 1.2), makeView('v2', 3.4)];
    expect(recomputeViewIds(null, views, new Map())).toEqual(['v1', 'v2']);
  });

  it('returns nothing when no view changed', () => {
    const views = [makeView('v1', 1.2), makeView('v2', 3.4)];
    const cached = new Map([
      ...cachedWith('v1'),
      ...cachedWith('v2')
    ]);
    expect(recomputeViewIds(views, views, cached)).toEqual([]);
  });

  it('returns only the view whose cut plane moved', () => {
    const previous = [makeView('v1', 1.2), makeView('v2', 3.4)];
    const next = [makeView('v1', 1.2), makeView('v2', 4.8)];
    const cached = new Map([...cachedWith('v1'), ...cachedWith('v2')]);
    expect(recomputeViewIds(previous, next, cached)).toEqual(['v2']);
  });

  it('treats a newly added view as needing a recompute', () => {
    const previous = [makeView('v1', 1.2)];
    const next = [makeView('v1', 1.2), makeView('v3', 2.0)];
    const cached = cachedWith('v1');
    expect(recomputeViewIds(previous, next, cached)).toEqual(['v3']);
  });
});

describe('wheel zoom without a passive listener (F-041)', () => {
  function makeTarget() {
    const listeners: Array<{ type: string; handler: (e: unknown) => void; options?: AddEventListenerOptions }> = [];
    return {
      listeners,
      target: {
        addEventListener: (type: string, handler: (e: unknown) => void, options?: AddEventListenerOptions) => {
          listeners.push({ type, handler, options });
        },
        removeEventListener: vi.fn()
      }
    };
  }

  it('registers a non-passive listener and prevents default', () => {
    const { listeners, target } = makeTarget();
    const onZoom = vi.fn();

    const dispose = createWheelZoom(target as never, { onZoom });

    expect(listeners).toHaveLength(1);
    expect(listeners[0].type).toBe('wheel');
    expect(listeners[0].options).toEqual({ passive: false });

    const preventDefault = vi.fn();
    listeners[0].handler({ deltaY: -120, preventDefault });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(onZoom).toHaveBeenCalledWith('in');
    expect(typeof dispose).toBe('function');
  });

  it('reports zoom out for a positive delta and disposes cleanly', () => {
    const { listeners, target } = makeTarget();
    const onZoom = vi.fn();

    const dispose = createWheelZoom(target as never, { onZoom });
    listeners[0].handler({ deltaY: 120, preventDefault: vi.fn() });
    expect(onZoom).toHaveBeenCalledWith('out');

    dispose();
    expect(target.removeEventListener).toHaveBeenCalledTimes(1);
  });
});

describe('modal focus order (F-032)', () => {
  it('cycles forward with wrap', () => {
    expect(nextFocusIndex(0, 3, false)).toBe(1);
    expect(nextFocusIndex(1, 3, false)).toBe(2);
    expect(nextFocusIndex(2, 3, false)).toBe(0);
  });

  it('cycles backward with wrap', () => {
    expect(nextFocusIndex(0, 3, true)).toBe(2);
    expect(nextFocusIndex(2, 3, true)).toBe(1);
  });

  it('returns -1 for an empty dialog', () => {
    expect(nextFocusIndex(0, 0, false)).toBe(-1);
  });
});
