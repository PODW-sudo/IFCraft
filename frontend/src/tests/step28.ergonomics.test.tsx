import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, screen, fireEvent, act } from '@testing-library/react';
import { MOUSE, TOUCH } from 'three';

import { SHORTCUTS, findShortcut, isEditableTarget } from '../services/shortcuts';
import { ShortcutLegend } from '../components/nav/ShortcutLegend';
import {
  resetSaveStatus,
  markSaving,
  markSaved,
  markSaveError,
} from '../services/saveStatus';
import { useSaveStatus } from '../hooks/useSaveStatus';
import { SaveStatusIndicator } from '../components/nav/SaveStatusIndicator';
import {
  ONBOARDING_KEY,
  hasCompletedOnboarding,
  completeOnboarding,
  resolveInitialProfile,
} from '../services/onboarding';
import {
  DEFAULT_CUSTOM_PROFILE_SETTINGS,
  getEffectiveProfileSettings,
} from '../types/profiles';
import {
  MAX_VISIBLE_RESULTS,
  buildOmnibarItems,
  filterOmnibarItems,
  type OmnibarCallbacks,
  type OmnibarGeometryLike,
} from '../services/omnibarIndex';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { buildOrbitControlConfig } from '../utils/viewportControls';
import dockSource from '../components/cad/GlassContextualModifyDock.tsx?raw';
import headerSource from '../components/nav/GlassHeader.tsx?raw';

function keyEvent(key: string, modifiers: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { key, ...modifiers });
}

const noSelection = { hasSelection: false };
const withSelection = { hasSelection: true };

const OMNIBAR_CALLBACKS: OmnibarCallbacks = {
  onSelectElement: vi.fn(),
  onTriggerTool: vi.fn(),
};

const MANY_GEOMETRIES: OmnibarGeometryLike[] = Array.from({ length: 250 }, (_, index) => ({
  expressID: index + 1,
  type: 'IfcWall',
}));

beforeEach(() => {
  localStorage.clear();
  resetSaveStatus();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('STEP-28 / shortcuts registry', () => {
  it('has unique ids and unique labels', () => {
    const ids = SHORTCUTS.map((shortcut) => shortcut.id);
    const labels = SHORTCUTS.map((shortcut) => shortcut.label);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(labels).size).toBe(labels.length);
    expect(SHORTCUTS.length).toBeGreaterThanOrEqual(10);
  });

  it('matches Ctrl+K but not bare k', () => {
    expect(findShortcut(keyEvent('k', { ctrlKey: true }), noSelection)?.id).toBe('omnibar.open');
    expect(findShortcut(keyEvent('k'), noSelection)).toBeUndefined();
  });

  it('matches the documented bindings', () => {
    expect(findShortcut(keyEvent('g'), noSelection)?.id).toBe('viewport.toggleGrid');
    expect(findShortcut(keyEvent('S', { shiftKey: true }), noSelection)?.id).toBe('drawing.sheets');
    expect(findShortcut(keyEvent('?'), noSelection)?.id).toBe('help.shortcuts');
    expect(findShortcut(keyEvent('Escape'), noSelection)?.id).toBe('app.escape');
    expect(findShortcut(keyEvent('Tab'), noSelection)?.id).toBe('viewport.cycleCandidate');
  });

  it('refuses selection-scoped bindings when nothing is selected', () => {
    expect(findShortcut(keyEvent('Delete'), noSelection)).toBeUndefined();
    expect(findShortcut(keyEvent('Delete'), withSelection)?.id).toBe('element.delete');
    expect(findShortcut(keyEvent('d', { ctrlKey: true }), noSelection)).toBeUndefined();
    expect(findShortcut(keyEvent('d', { ctrlKey: true }), withSelection)?.id).toBe('element.clone');
  });

  it('treats editable controls as non-shortcut targets', () => {
    const select = document.createElement('select');
    const input = document.createElement('input');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const plain = document.createElement('div');

    expect(isEditableTarget(select)).toBe(true);
    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(editable)).toBe(true);
    expect(isEditableTarget(plain)).toBe(false);
    expect(isEditableTarget(document.body)).toBe(false);
  });
});

describe('STEP-28 / shortcut legend', () => {
  it('renders every registered shortcut behind an accessible dialog', () => {
    render(<ShortcutLegend isOpen onClose={() => undefined} />);

    expect(screen.getByRole('dialog', { name: /keyboard shortcuts/i })).toBeInTheDocument();
    for (const shortcut of SHORTCUTS) {
      expect(screen.getByText(shortcut.label)).toBeInTheDocument();
    }
  });

  it('renders nothing when closed', () => {
    render(<ShortcutLegend isOpen={false} onClose={() => undefined} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('STEP-28 / save indicator', () => {
  it('moves idle -> saving -> saved with a timestamp', () => {
    const { result } = renderHook(() => useSaveStatus());
    expect(result.current.status).toBe('idle');

    act(() => {
      markSaving();
    });
    expect(result.current.status).toBe('saving');

    act(() => {
      markSaved(new Date('2026-10-24T10:00:00Z'));
    });
    expect(result.current.status).toBe('saved');
    expect(result.current.lastSavedAt?.toISOString()).toBe('2026-10-24T10:00:00.000Z');
  });

  it('reports a failed write instead of pretending success', () => {
    const { result } = renderHook(() => useSaveStatus());

    act(() => {
      markSaveError(new Error('placement rejected'));
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('placement rejected');
  });

  it('decays from saved back to idle', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useSaveStatus());

    act(() => {
      markSaved(new Date());
    });
    expect(result.current.status).toBe('saved');

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.status).toBe('idle');
  });

  it('exposes its state to assistive tech', () => {
    render(<SaveStatusIndicator />);
    const pill = screen.getByRole('status');
    expect(pill).toHaveAttribute('data-qa', 'save-status');
    expect(pill).toHaveAttribute('aria-live', 'polite');
    expect(pill).toHaveAttribute('data-state', 'idle');

    act(() => {
      markSaved(new Date('2026-10-24T10:00:00Z'));
    });
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'saved');
  });
});

describe('STEP-28 / onboarding and first-run profile', () => {
  it('defaults a first run to read-first rather than CAD authoring', () => {
    expect(resolveInitialProfile(null)).toBe('query');
    expect(resolveInitialProfile('modify')).toBe('modify');
  });

  it('keeps the modify ribbon off and the coordinate HUD on for a first run', () => {
    const settings = getEffectiveProfileSettings(
      resolveInitialProfile(null),
      DEFAULT_CUSTOM_PROFILE_SETTINGS,
    );
    expect(settings.showContextualModifyBar).toBe(false);
    expect(settings.showCoordinateHud).toBe(true);
  });

  it('records that onboarding was completed', () => {
    expect(hasCompletedOnboarding()).toBe(false);
    completeOnboarding();
    expect(hasCompletedOnboarding()).toBe(true);
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('1');
  });
});

describe('STEP-28 / omnibar completeness', () => {
  it('indexes every geometry, not the first fifty', () => {
    const items = buildOmnibarItems({
      geometries: MANY_GEOMETRIES,
      spatialNodes: [],
      callbacks: OMNIBAR_CALLBACKS,
    });
    expect(items.filter((item) => item.category === 'element')).toHaveLength(250);
  });

  it('filters without truncating and finds a late element', () => {
    const items = buildOmnibarItems({
      geometries: MANY_GEOMETRIES,
      spatialNodes: [],
      callbacks: OMNIBAR_CALLBACKS,
    });

    const filtered = filterOmnibarItems(items, 'Element #249');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe('Element #249');

    expect(filterOmnibarItems(items, '')).toHaveLength(items.length);
    expect(MAX_VISIBLE_RESULTS).toBeGreaterThanOrEqual(50);
  });
});

function FocusFixture() {
  const { ref, onKeyDown } = useFocusTrap(true);
  return (
    <div ref={ref} onKeyDown={onKeyDown} role="dialog" aria-modal="true" aria-label="Fixture">
      <button type="button">First</button>
      <button type="button">Last</button>
    </div>
  );
}

describe('STEP-28 / modal focus management', () => {
  it('moves focus in, wraps Tab in both directions, and restores on unmount', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open';
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(<FocusFixture />);
    const first = screen.getByText('First');
    const last = screen.getByText('Last');

    expect(document.activeElement).toBe(first);

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);

    unmount();
    expect(document.activeElement).toBe(trigger);

    trigger.remove();
  });
});

describe('STEP-28 / viewport controls', () => {
  it('configures one-finger orbit and two-finger dolly/pan', () => {
    const config = buildOrbitControlConfig();
    expect(config.touches.ONE).toBe(TOUCH.ROTATE);
    expect(config.touches.TWO).toBe(TOUCH.DOLLY_PAN);
    expect(config.mouseButtons.MIDDLE).toBe(MOUSE.PAN);
    expect(config.mouseButtons.LEFT).toBe(-1);
    expect(config.mouseButtons.RIGHT).toBe(-1);
  });
});

describe('STEP-28 / layout guards', () => {
  it('keeps the 64 px header clearance above the modify dock', () => {
    expect(headerSource).toContain('h-16');

    const offset = /fixed\s+top-(\d+)\b/.exec(dockSource);
    expect(offset, 'GlassContextualModifyDock must declare a fixed top-<n> offset').not.toBeNull();
    expect(Number(offset?.[1]) * 4).toBeGreaterThanOrEqual(64);

    expect(dockSource).not.toMatch(/\btop-14\b/);
  });

  it('gives every parsed dock icon button a 44 px minimum target', () => {
    const buttonPattern = /<button\b((?:\s+[a-zA-Z-]+=(?:"[^"]*"|\{[^}]*\}))*)\s*>/g;
    const offending: string[] = [];
    let examined = 0;
    let match: RegExpExecArray | null;

    while ((match = buttonPattern.exec(dockSource)) !== null) {
      const className = /className="([^"]*)"/.exec(match[1])?.[1];
      if (!className) continue;
      if (!/(^|\s)p-1(\.5)?(\s|$)/.test(className)) continue;

      examined += 1;
      if (!/(^|\s)(min-h-11|min-w-11|h-11|w-11)(\s|$)/.test(className)) {
        offending.push(`${className.slice(0, 80)} …`);
      }
    }

    // Self-validating: if the parser stops matching, this test must not silently pass.
    expect(examined).toBeGreaterThanOrEqual(8);
    expect(offending, 'These dock buttons are smaller than 44x44 CSS px.').toEqual([]);
  });
});
