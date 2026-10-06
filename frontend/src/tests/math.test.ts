import { describe, it, expect } from 'vitest';

describe('3D Measurement & Spatial Vector Math', () => {
  function computeMeasurement(start: [number, number, number], end: [number, number, number]) {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const dz = end[2] - start[2];
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const midpoint: [number, number, number] = [
      (start[0] + end[0]) / 2,
      (start[1] + end[1]) / 2,
      (start[2] + end[2]) / 2
    ];
    return {
      distance,
      midpoint,
      dx: Math.abs(dx),
      dy: Math.abs(dy),
      dz: Math.abs(dz)
    };
  }

  it('calculates exact 3D Euclidean distance (3-4-0 right triangle)', () => {
    const res = computeMeasurement([0, 0, 0], [3, 4, 0]);
    expect(res.distance).toBe(5);
    expect(res.midpoint).toEqual([1.5, 2, 0]);
    expect(res.dx).toBe(3);
    expect(res.dy).toBe(4);
    expect(res.dz).toBe(0);
  });

  it('calculates 3D diagonal cube measurement', () => {
    const res = computeMeasurement([1, 1, 1], [3, 3, 3]);
    // dx=2, dy=2, dz=2 => dist = sqrt(4+4+4) = sqrt(12) = 3.4641...
    expect(res.distance).toBeCloseTo(Math.sqrt(12), 4);
    expect(res.midpoint).toEqual([2, 2, 2]);
    expect(res.dx).toBe(2);
    expect(res.dy).toBe(2);
    expect(res.dz).toBe(2);
  });

  it('returns zero distance for identical start and end vertices', () => {
    const res = computeMeasurement([5, 5, 5], [5, 5, 5]);
    expect(res.distance).toBe(0);
    expect(res.midpoint).toEqual([5, 5, 5]);
  });
});

describe('Parametric CAD Grid Snapping', () => {
  function snapToGrid(value: number, step = 0.5): number {
    return Math.round(value / step) * step;
  }

  it('snaps coordinates to nearest half-meter step', () => {
    expect(snapToGrid(1.23, 0.5)).toBe(1.0);
    expect(snapToGrid(1.35, 0.5)).toBe(1.5);
    expect(snapToGrid(4.8, 1.0)).toBe(5.0);
    expect(snapToGrid(-0.24, 0.5)).toBe(-0.0);
  });
});

describe('Native Anti-Overlap Repulsion Logic', () => {
  interface Rect {
    top: number;
    bottom: number;
    left: number;
    right: number;
  }

  function isOverlapFree(r1: Rect, r2: Rect): boolean {
    return (
      r1.bottom <= r2.top ||
      r1.top >= r2.bottom ||
      r1.right <= r2.left ||
      r1.left >= r2.right
    );
  }

  it('confirms cleanly separated floating HUDs do not collide', () => {
    // Top pill (height 48px at top: 12)
    const topPill: Rect = { top: 12, bottom: 60, left: 200, right: 600 };
    // View controls HUD (docked below at top: 72)
    const viewControls: Rect = { top: 72, bottom: 120, left: 200, right: 400 };

    expect(isOverlapFree(topPill, viewControls)).toBe(true);
  });

  it('detects occlusion collision when rects overlap', () => {
    const hud1: Rect = { top: 50, bottom: 100, left: 100, right: 300 };
    const hud2: Rect = { top: 80, bottom: 130, left: 150, right: 350 };

    expect(isOverlapFree(hud1, hud2)).toBe(false);
  });
});
