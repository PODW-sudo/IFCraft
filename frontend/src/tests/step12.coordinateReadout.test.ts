import { describe, it, expect } from 'vitest';
import { formatCoordinate, buildCoordinateReadout } from '../utils/coordinateReadout';

const transform = { position: [1.23456, 0, -2.1] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] };

describe('STEP-12 coordinate readout', () => {
  it('formats signed metres with three decimals', () => {
    expect(formatCoordinate(1.23456)).toBe('+1.235m');
    expect(formatCoordinate(-2.1)).toBe('-2.100m');
    expect(formatCoordinate(0)).toBe('+0.000m');
  });

  it('never renders a negative zero', () => {
    expect(formatCoordinate(-0.0004)).toBe('+0.000m');
    expect(formatCoordinate(-0)).toBe('+0.000m');
  });

  it('keeps the QA harness contract: "meshes" and "#<id>"', () => {
    const readout = buildCoordinateReadout({ selectedExpressID: 128, transformInfo: transform, elementCount: 3822 });

    expect(readout.meshText).toBe('3822 meshes');
    expect(readout.fullText).toContain('meshes');   // qa_runner.py:561-562
    expect(readout.fullText).toContain('#128');     // qa_runner.py:984
  });

  it('renders X, Y and Z in order with units', () => {
    const readout = buildCoordinateReadout({ selectedExpressID: 128, transformInfo: transform, elementCount: 10 });

    expect(readout.positionText).toBe('#128 X +1.235m Y +0.000m Z -2.100m');
  });

  it('falls back to zeroed coordinates when no transform is available yet', () => {
    const readout = buildCoordinateReadout({ selectedExpressID: 7, transformInfo: null, elementCount: 3 });

    expect(readout.positionText).toBe('#7 X +0.000m Y +0.000m Z +0.000m');
  });

  it('omits the position entirely when nothing is selected', () => {
    const readout = buildCoordinateReadout({ selectedExpressID: null, transformInfo: null, elementCount: 3 });

    expect(readout.meshText).toBe('3 meshes');
    expect(readout.fullText).toBe('3 meshes');
    expect(readout.fullText).not.toContain('#');
  });
});
