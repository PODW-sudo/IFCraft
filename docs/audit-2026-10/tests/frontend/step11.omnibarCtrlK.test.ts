import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * STEP-11 — Ctrl+K must open the command palette.
 *
 * Finding: F-008
 *
 * Bug (verified 2026-10-24):
 *   frontend/src/components/omnibar/SpatialOmnibar.tsx:54-60
 *       if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
 *         e.preventDefault();
 *         if (isOpen) { onClose(); }
 *         else { /* Open */ }        <-- empty branch
 *       }
 *   The component also receives no `onOpen` prop (frontend/src/App.tsx:1795-1797), so the
 *   advertised command palette can never be opened by keyboard.
 *
 * These assertions are source-level contracts so they run in the existing node test
 * environment. STEP-27 adds jsdom so the behaviour can also be asserted by rendering.
 */

const APP_SRC = resolve(__dirname, '../App.tsx');
const OMNIBAR_SRC = resolve(__dirname, '../components/omnibar/SpatialOmnibar.tsx');

const readApp = () => readFileSync(APP_SRC, 'utf8');
const readOmnibar = () => readFileSync(OMNIBAR_SRC, 'utf8');

describe('STEP-11 · Ctrl+K command palette', () => {
  it('the omnibar component exists', () => {
    expect(existsSync(OMNIBAR_SRC)).toBe(true);
  });

  it('SpatialOmnibar accepts an onOpen prop', () => {
    const src = readOmnibar();
    expect(src).toMatch(/\bonOpen\b/);
    expect(src).not.toMatch(/^\s*onOpen\?:/m); // it must be required, not optional
  });

  it('App passes onOpen to SpatialOmnibar', () => {
    const src = readApp();
    const omnibarBlock = src.slice(src.indexOf('<SpatialOmnibar'));
    expect(omnibarBlock).toMatch(/onOpen\s*=/);
    expect(omnibarBlock).toMatch(/onOpen=\{\(\)\s*=>\s*setIsOmnibarOpen\(true\)\}/);
  });

  it('the Ctrl+K handler opens the palette instead of falling through an empty branch', () => {
    const src = readOmnibar();
    const handlerIndex = src.indexOf("e.key.toLowerCase() === 'k'");
    expect(handlerIndex).toBeGreaterThan(-1);

    const window = src.slice(handlerIndex, handlerIndex + 600);
    expect(window).toMatch(/onOpen\s*\(/);
    expect(window).not.toMatch(/else\s*\{\s*(\/\/[^\n]*)?\s*\}/);
  });

  it('preventDefault is only called on a real shortcut hit', () => {
    const src = readOmnibar();
    const handlerIndex = src.indexOf("e.key.toLowerCase() === 'k'");
    const window = src.slice(handlerIndex, handlerIndex + 600);

    // preventDefault must be guarded by the modifier check, not fired on every keypress.
    const modifierIndex = window.indexOf('e.ctrlKey || e.metaKey');
    const preventIndex = window.indexOf('preventDefault');
    expect(modifierIndex).toBeGreaterThan(-1);
    expect(preventIndex).toBeGreaterThan(-1);
    expect(window.slice(0, preventIndex)).toMatch(/if\s*\(/);
  });
});
