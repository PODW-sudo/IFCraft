import { describe, it, expect } from 'vitest';
import { createGroundGrid } from '../utils/viewportGrid';

describe('createGroundGrid', () => {
  it('instantiates anti-aliased ground grid mesh with custom shader uniforms', () => {
    const grid = createGroundGrid({
      size: 200,
      radius: 80,
      isLight: false
    });

    expect(grid.mesh).toBeDefined();
    expect(grid.mesh.name).toBe('bim-ground-grid');
    expect(grid.mesh.position.y).toBeCloseTo(-0.01);
    expect(grid.material.transparent).toBe(true);
    expect(grid.material.depthWrite).toBe(false);
    expect(grid.material.uniforms.uRadius.value).toBe(80);
    expect(grid.material.uniforms.uOpacity.value).toBe(0.65);

    grid.dispose();
  });

  it('updates elevation dynamically when auto-grounded to model bounding box', () => {
    const grid = createGroundGrid();
    expect(grid.mesh.position.y).toBeCloseTo(-0.01);

    grid.setElevation(-5.2);
    expect(grid.mesh.position.y).toBeCloseTo(-5.2);

    grid.setElevation(0.0);
    expect(grid.mesh.position.y).toBeCloseTo(0.0);

    grid.dispose();
  });

  it('updates theme between light and dark palettes', () => {
    const grid = createGroundGrid({ isLight: false });
    expect(grid.material.uniforms.uOpacity.value).toBe(0.65);

    // Switch to light mode
    grid.updateTheme(true);
    expect(grid.material.uniforms.uOpacity.value).toBe(0.5);

    // Switch to custom base color
    grid.updateTheme(false, 0x1e293b);
    expect(grid.material.uniforms.uGridColorMinor.value.getHex()).toBe(0x1e293b);

    grid.dispose();
  });
});
