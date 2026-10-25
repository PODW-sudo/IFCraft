import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CoordinateHud } from '../components/hud/CoordinateHud';

describe('STEP-12 coordinate HUD behaviour', () => {
  it('is visible, non-live and shows the harness-grepped text', () => {
    const { container } = render(
      <CoordinateHud
        selectedExpressID={205}
        transformInfo={{ position: [1.25, -0.0004, -2.5], rotation: [0, 0, 0] }}
        elementCount={17}
      />
    );

    const hud = container.querySelector('[data-qa="coordinate-hud"]') as HTMLElement;
    expect(hud).not.toBeNull();
    const classes = hud.className.split(/\s+/);
    expect(classes).not.toContain('sr-only');
    expect(classes).not.toContain('hidden');
    expect(hud.getAttribute('aria-hidden')).toBeNull();
    expect(hud.getAttribute('aria-live')).toBe('off');
    expect(hud.getAttribute('aria-label')).toBe('Coordinate readout');
    expect(hud.className).toContain('pointer-events-none');

    expect(hud.textContent).toContain('17 meshes');
    expect(hud.textContent).toContain('#205');
    expect(hud.textContent).toContain('X +1.250m');
    expect(hud.textContent).toContain('Y +0.000m');
    expect(hud.textContent).toContain('Z -2.500m');
  });

  it('offsets to the right of an open tree and stays at the base position when closed', () => {
    const { container, rerender } = render(
      <CoordinateHud selectedExpressID={null} transformInfo={null} elementCount={3} isTreeOpen treeWidth={288} />
    );
    const hud = container.querySelector('[data-qa="coordinate-hud"]') as HTMLElement;
    expect(hud.style.left).toBe('296px');
    expect(hud.textContent).toContain('3 meshes');
    expect(hud.textContent).not.toContain('#');

    rerender(
      <CoordinateHud selectedExpressID={null} transformInfo={null} elementCount={3} isTreeOpen={false} treeWidth={288} />
    );
    expect((container.querySelector('[data-qa="coordinate-hud"]') as HTMLElement).style.left).toBe('');
  });
});
