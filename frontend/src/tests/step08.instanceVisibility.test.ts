import { describe, it, expect, vi } from 'vitest';
import {
  isInstanceVisible,
  applyBatchVisibility,
  applyInstanceColors,
  type BatchRegistryEntry,
  type VisibilityState
} from '../utils/instanceVisibility';

const state = (over: Partial<VisibilityState> = {}): VisibilityState => ({
  hiddenCategories: new Set<string>(),
  isolatedExpressID: null,
  hiddenModelIds: new Set<string>(),
  ...over
});

const wall = { expressID: 101, type: 'IfcWall', modelId: 'main' };
const duct = { expressID: 205, type: 'IfcFlowSegment', modelId: 'mep' };

/** Minimal stand-in for THREE.BatchedMesh: records the calls the viewport must make. */
function fakeBatch() {
  const visibility: Array<[number, boolean]> = [];
  const colors: Array<[number, number]> = [];
  return {
    visibility,
    colors,
    setVisibleAt: vi.fn((id: number, visible: boolean) => {
      visibility.push([id, visible]);
    }),
    setColorAt: vi.fn((id: number, color: number) => {
      colors.push([id, color]);
    })
  };
}

describe('STEP-08 batched instance visibility', () => {
  it('hides an instance whose category is hidden, and only that instance', () => {
    expect(isInstanceVisible(wall, state({ hiddenCategories: new Set(['IfcWall']) }))).toBe(false);
    expect(isInstanceVisible(duct, state({ hiddenCategories: new Set(['IfcWall']) }))).toBe(true);
  });

  it('honours single-element isolation', () => {
    const s = state({ isolatedExpressID: 205 });
    expect(isInstanceVisible(duct, s)).toBe(true);
    expect(isInstanceVisible(wall, s)).toBe(false);
  });

  it('honours federation hide and defaults an absent modelId to "main"', () => {
    const s = state({ hiddenModelIds: new Set(['mep']) });
    expect(isInstanceVisible(duct, s)).toBe(false);
    expect(isInstanceVisible({ expressID: 1, type: 'IfcSlab' }, s)).toBe(true);
  });

  it('drives setVisibleAt per instance and reports counts', () => {
    const batch = fakeBatch();
    const entries: BatchRegistryEntry[] = [{ mesh: batch, instances: [wall, duct] }];

    const result = applyBatchVisibility(entries, state({ hiddenCategories: new Set(['IfcWall']) }));

    expect(result).toEqual({ hidden: 1, shown: 1 });
    expect(batch.visibility).toEqual([
      [0, false],
      [1, true]
    ]);
  });

  it('is idempotent for an unchanged state', () => {
    const batch = fakeBatch();
    const entries: BatchRegistryEntry[] = [{ mesh: batch, instances: [wall, duct] }];
    const s = state({ isolatedExpressID: 101 });

    applyBatchVisibility(entries, s);
    const first = [...batch.visibility];
    applyBatchVisibility(entries, s);

    expect(batch.visibility).toEqual([...first, ...first]);
  });

  it('colours instances per element and resets unmapped instances to white', () => {
    const batch = fakeBatch();
    const entries: BatchRegistryEntry[] = [{ mesh: batch, instances: [wall, duct] }];

    const painted = applyInstanceColors(entries, new Map([[101, 0x10b981]]));

    expect(painted).toBe(1);
    expect(batch.colors).toEqual([
      [0, 0x10b981],
      [1, 0xffffff]
    ]);
  });
});
