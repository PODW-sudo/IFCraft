/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * STEP-12 — The coordinate HUD must be visible.
 *
 * Finding: F-009
 *
 * Bug (verified 2026-10-24):
 *   frontend/src/components/hud/CoordinateHud.tsx:27-28
 *       className="sr-only"
 *       aria-hidden="true"
 *   The component computes live X/Y/Z and the mesh count but renders them for screen readers
 *   only, so the user never sees them. project.config.md and test case TC-003 both specify a
 *   visible coordinate HUD.
 *
 * These assertions are source-level contracts so they run in the existing node test
 * environment. STEP-27 adds jsdom so the rendered output can also be asserted.
 */

const HUD_SRC = resolve(__dirname, '../components/hud/CoordinateHud.tsx');
const readHud = () => readFileSync(HUD_SRC, 'utf8');

describe('STEP-12 · Coordinate HUD visibility', () => {
  it('the component exists', () => {
    expect(existsSync(HUD_SRC)).toBe(true);
  });

  it('is not screen-reader-only', () => {
    const src = readHud();
    expect(src).not.toMatch(/sr-only/);
  });

  it('is not hidden from assistive technology', () => {
    const src = readHud();
    expect(src).not.toMatch(/aria-hidden="true"/);
    expect(src).not.toMatch(/aria-hidden=\{true\}/);
  });

  it('still renders the coordinate payload for the QA harness', () => {
    // project.config.md lists the coordinate HUD as a UI cue with selector div:has-text('X:');
    // the data-qa hook must survive the visibility change.
    const src = readHud();
    expect(src).toMatch(/data-qa="coordinate-hud"/);
    expect(src).toMatch(/\bX\b/);
    expect(src).toMatch(/\bY\b/);
    expect(src).toMatch(/\bZ\b/);
  });

  it('formats coordinates with a unit suffix', () => {
    const src = readHud();
    expect(src).toMatch(/toFixed\(3\)/);
    expect(src).toMatch(/m['"`]/);
  });
});
