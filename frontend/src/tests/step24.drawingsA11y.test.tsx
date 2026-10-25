import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DrawingSheetsModal } from '../components/drawings/DrawingSheetsModal';
import type { GeometryData } from '../types/ifc';

/**
 * STEP-24 — rendered accessibility / render-shape assertions (F-029, F-032, F-041).
 *
 * The jsdom infrastructure these need arrived with STEP-27 (`vite.config.ts` `test` block +
 * @testing-library/*). Everything here is driven through real DOM events and rendered output,
 * not through source inspection.
 */

/** 10 m x 3 m x 0.3 m wall box; anything cutting at 1.2 m hits it end to end. */
const WALL: GeometryData = {
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

const STOREYS = [{ id: 1, name: 'Ground Floor', elevation: 0 }];

describe('drawing sheet modal accessibility (F-032, F-041)', () => {
  it('renders batched paths, not lines, inside a viewport', async () => {
    render(
      <DrawingSheetsModal isOpen onClose={() => {}} geometries={[WALL]} storeys={STOREYS} />
    );

    // View geometry is computed one view per animation frame, so wait for the plan to land.
    await waitFor(() => {
      const viewports = document.querySelectorAll('[data-qa^="sheet-viewport-"]');
      expect(viewports.length).toBeGreaterThan(0);
      const paths = viewports[0].querySelectorAll('svg path');
      expect(paths.length).toBeGreaterThan(0);
    });

    const viewports = document.querySelectorAll('[data-qa^="sheet-viewport-"]');
    // Zero DOM nodes per segment: the old preview rendered one <line> per segment.
    expect(viewports[0].querySelectorAll('svg line').length).toBe(0);
    expect(viewports[0].querySelectorAll('svg path').length).toBeLessThanOrEqual(2);
  });

  it('closes on Escape and restores focus', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(<DrawingSheetsModal isOpen onClose={onClose} geometries={[]} />);
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('moves focus into the dialog on open', () => {
    render(<DrawingSheetsModal isOpen onClose={() => {}} geometries={[]} />);
    const modal = screen.getByRole('dialog');
    expect(modal.contains(document.activeElement)).toBe(true);
  });

  it('traps Tab inside the dialog', async () => {
    const user = userEvent.setup();
    render(<DrawingSheetsModal isOpen onClose={() => {}} geometries={[]} />);

    const modal = screen.getByRole('dialog');
    const focusables = modal.querySelectorAll<HTMLElement>('button, [href], input, select, textarea');
    expect(focusables.length).toBeGreaterThan(1);

    focusables[focusables.length - 1].focus();
    await user.tab();

    expect(modal.contains(document.activeElement)).toBe(true);
  });

  it('does not throw on wheel over the sheet', () => {
    render(<DrawingSheetsModal isOpen onClose={() => {}} geometries={[]} />);
    expect(() =>
      screen.getByTestId('drawing-sheets-modal').dispatchEvent(
        new WheelEvent('wheel', { deltaY: -120, bubbles: true, cancelable: true })
      )
    ).not.toThrow();
  });
});
