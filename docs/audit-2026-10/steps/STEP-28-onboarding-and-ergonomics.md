# STEP-28 — Onboarding, shortcuts, save indicator, touch targets

**Status:** not started · **Wave:** D · **Effort:** 3 d
**Findings:** F-042, F-048, F-049, F-050, F-051, F-052 (+ F-040, folded in — see Notes) · **Depends on:** STEP-11, STEP-12, STEP-25, STEP-27 · **Blocks:** —

## Problem

A first-time user opens the app and lands in **CAD authoring mode** (`App.tsx:417` returns
`'modify'`) with no model loaded, no explanation of what to do, no list of the ~14 undocumented
keyboard shortcuts, and **no way to know whether an edit was persisted** — the only "saved" concept in
the product is `localStorage` for editor preferences (`services/settings.ts:41-47`). On a tablet the
dense icon buttons are **~22-26 px** (`GlassBottomDock.tsx:368` is `p-1.5` around a 14 px icon), well
below the 44 px minimum, and one-finger orbit is not configured anywhere. A BIM engineer evaluating
the tool for 10 minutes cannot tell how to start, what it can do, or whether their work survived.

## Evidence

- `frontend/src/App.tsx:410-418` — `useState<UiProfile>` initialiser; line **417** is
  `return 'modify';` when no `ifc_editor_ui_profile` key exists. `modify` sets
  `showContextualModifyBar: true` and `showCadToolbar: true`
  (`frontend/src/types/profiles.ts:60-76`) before a model exists.
- `frontend/src/App.tsx:1805-1829` — an empty-state overlay **does** exist:
  `{geometries.length === 0 && !isLoading && (…)}` with "Spatial Canvas Ready", an *Upload IFC*
  button and a "Sample Models" button. **Correction to F-051:** there *is* an empty state; what is
  missing is (a) a first-run variant, (b) any shortcut/legend affordance, (c) any explanation of the
  three UI profiles. Report it that way.
- Keyboard bindings exist in **five** places and are documented nowhere:
  `App.tsx:113-133` (`g`/`G` grid, `Shift+S` drawing sheets), `App.tsx:857-959` (`Ctrl+Z`,
  `Ctrl+Y`, `Delete`/`Backspace`, `Ctrl+D`, `Ctrl+,`, Revit two-key `RO`/`MM`/`DM`/`AR`/`AL`/`PN`/`UP`/`MV`/`CO`),
  `App.tsx:962-1009` (`Escape`), `ThreeViewport.tsx:2670-2752` (`Escape`, `Ctrl+R`, `Control`,
  `Tab`), `SpatialOmnibar.tsx:52-65` (`Ctrl+K`).
- Measured — `grep -c "Space" frontend/src/**/*.tsx` for a key handler → **0**. `USER-NEEDS.md:76`
  lists `Space` among the shortcuts; there is no Space binding in the code. Do not put Space in the
  legend unless you add a handler.
- `frontend/src/App.tsx:123-125` — `if ((e.key === 'g' || e.key === 'G') && …)` fires for `SELECT`
  and `BUTTON` targets (the guard at `:116-121` only checks `INPUT`/`TEXTAREA`/`contentEditable`), and
  also fires mid-way through a two-letter Revit sequence (`App.tsx:892-942`), so typing `G` as the
  first letter of a command toggles the grid (F-040).
- `frontend/src/services/settings.ts:4,41-47` — `STORAGE_KEY = 'ifc_editor_settings_v1'`; only
  editor preferences are persisted. No write path reports a save state:
  `frontend/src/hooks/useGizmoTransform.ts:37-45` and
  `frontend/src/components/properties/GlassPropertyInspector.tsx:143,196` fire `fetch()` and only
  `console.error` on failure (`useGizmoTransform.ts:48,51`).
- `frontend/src/components/nav/ContextualModifyBar.tsx:191` — `className="fixed top-14 …"` under a
  header that is `h-16` (`frontend/src/components/nav/GlassHeader.tsx:116`), i.e. 56 px under a 64 px
  bar. **Correction to F-049:** this component has **zero importers** (see STEP-25) and is deleted
  there. The component actually rendered is `GlassContextualModifyDock`
  (`App.tsx:19,1617`) and it uses `top-18` (`GlassContextualModifyDock.tsx:194`), which is 72 px —
  correct. F-049 is therefore **closed by deletion**, and this step's job is only to keep it closed
  (Spec item 6).
- `frontend/src/components/dock/GlassBottomDock.tsx:368,405,638,675,729,908,947,1014` — `p-1.5`
  (6 px) around `size={13}`/`size={14}` icons ⇒ ~26 px hit areas; line `:1014` is `p-1` ⇒ ~22 px.
- `frontend/src/components/viewer/ThreeViewport.tsx:913-917` — `mouseButtons` sets
  `LEFT: -1`, `MIDDLE: PAN`, `RIGHT: -1`; **no `touches` configuration exists**
  (`grep -n "touches"` → 0 matches), so touch behaviour is OrbitControls' default and is untested on
  a real device.
- `frontend/src/components/omnibar/SpatialOmnibar.tsx:152` — `geometries.slice(0, 50)`; the result
  list is also capped at 15 (`:182,186`) with no "N more" affordance.
- `frontend/src/hooks/useModalManager.ts:27-31` — the doc comment claims "Centralizes … modal focus
  states", but the hook holds booleans only. `SettingsModal.tsx:82-86`, `UploadModal.tsx:53-56` and
  `NewProjectModal.tsx` render plain `<div>`s with **no** `role="dialog"`, no `aria-modal`, no focus
  move, no focus trap and no focus restore. `App.tsx:966-969` only handles `Escape` for settings.

## Scope

**Change:**

- **New modules** (all under `frontend/src/`):
  - `services/shortcuts.ts` — the single shortcut registry + matcher + `isEditableTarget()`.
  - `components/nav/ShortcutLegend.tsx` — renders the registry; opened by `?` / `Shift+/`.
  - `services/saveStatus.ts` + `hooks/useSaveStatus.ts` — save-state store and subscription hook.
  - `components/nav/SaveStatusIndicator.tsx` — `role="status"` pill.
  - `services/onboarding.ts` — `ONBOARDING_KEY`, `hasCompletedOnboarding()`,
    `completeOnboarding()`, `resolveInitialProfile()`.
  - `components/onboarding/OnboardingCard.tsx` — first-run card.
  - `services/omnibarIndex.ts` — `buildOmnibarItems()`, `filterOmnibarItems()`,
    `MAX_VISIBLE_RESULTS`.
  - `hooks/useFocusTrap.ts` — `{ ref, onKeyDown }`.
  - `utils/viewportControls.ts` — `buildOrbitControlConfig()`.
  - `utils/touchTargets.ts` — `MIN_TOUCH_TARGET_PX`, `withTouchTarget()`.
- `frontend/src/App.tsx` — profile default (`:410-418`), shortcut dispatch through
  `findShortcut()` (replaces the `g` handler at `:113-133` and the `Escape` guard at `:962-1009`),
  onboarding card + legend render, empty-state copy, omnibar props (`:1795-1803`).
- `frontend/src/components/nav/GlassHeader.tsx` — a `?` help button that opens the legend (next to the
  existing settings button) and `<SaveStatusIndicator />`.
- `frontend/src/components/omnibar/SpatialOmnibar.tsx:152,182-187` — use `omnibarIndex` helpers; render
  a "N more results" footer instead of a silent cap.
- `frontend/src/components/modals/SettingsModal.tsx:82-86`, `UploadModal.tsx:53-56`,
  `NewProjectModal.tsx` — adopt `useFocusTrap`, add `role="dialog"` + `aria-modal="true"` +
  `aria-labelledby`.
- `frontend/src/components/viewer/ThreeViewport.tsx:913-917` — assign
  `controls.mouseButtons` and `controls.touches` from `buildOrbitControlConfig()`.
- `frontend/src/index.css` — `@media (pointer: coarse)` rule raising `[data-touch-target]` to 44 px.
- `frontend/src/services/api.ts` — wrap the 11 mutating calls with `withSaveStatus()`; wrap the two
  raw `fetch()` calls in `GlassPropertyInspector.tsx` and `useGizmoTransform.ts` the same way.

**Do not change:**

- `frontend/src/components/nav/ContextualModifyBar.tsx` — it must already be gone (STEP-25). If it is
  not, stop and finish STEP-25 first.
- `frontend/src/types/profiles.ts` — do **not** add or rename profile flags. `query` already has the
  flags this step needs (`:78-94`: `showContextualModifyBar: false`, `showCoordinateHud: true`).
- The CAD two-key Revit sequences (`App.tsx:892-942`) — moving them into the registry is a bigger
  refactor with a state machine (buffer + 800 ms timer). Leave them, but **guard** `g` against them
  (Spec item 2d).
- `frontend/src/components/drawings/**` — STEP-09/STEP-24 territory.
- The `XeokitViewport` engine toggle.

**Non-goals:**

- No product tour / tooltip walkthrough / coach marks. A dismissible card plus a real legend is the
  whole onboarding story; anything more becomes a maintenance liability.
- **No autosave.** F-050 is "the user cannot tell whether their work is saved", not "the app should
  save by itself". This step reports the outcome of writes that already happen.
- No revision history / "last saved 3 minutes ago by X" list — that needs the audit timeline
  (STEP-19) and a product decision.
- No i18n, no shortcut re-mapping UI, no persisted user key bindings.
- No `fullscreen`/`ResizeObserver`-driven responsive redesign.

## Spec

**1 — First run is read-first, not CAD-authoring.**
1.1 `resolveInitialProfile(savedProfile: UiProfile | null)` in `services/onboarding.ts` returns
    `savedProfile` when non-null, otherwise `'query'`.
1.2 `App.tsx:417` returns `resolveInitialProfile(<parsed saved value or null>)` — the literal
    `'modify'` disappears.
1.3 With the resulting profile, `getEffectiveProfileSettings(profile, DEFAULT_CUSTOM_PROFILE_SETTINGS)`
    has `showContextualModifyBar === false` and `showCoordinateHud === true` (i.e. STEP-12's HUD is
    still visible on a first run).
1.4 `hasCompletedOnboarding()` returns `false` until `completeOnboarding()` writes
    `localStorage['ifc_editor_onboarded_v1'] = '1'`; it must tolerate `localStorage` throwing
    (private mode) and return `false` rather than propagating.
1.5 `OnboardingCard` renders when `!hasCompletedOnboarding() && geometries.length === 0`, exposes
    `data-qa="onboarding-card"`, three action buttons (Upload IFC / Open sample / Dismiss) and a
    one-line hint for `Ctrl+K` and `?`. Dismissing calls `completeOnboarding()` and unmounts it in
    the same tick.

**2 — Shortcuts become discoverable and correct.**
2.1 `services/shortcuts.ts` exports `SHORTCUTS: readonly ShortcutDef[]` where
    `ShortcutDef = { id: string; label: string; group: 'Navigation' | 'Editing' | 'View' | 'Tools'; key: string; ctrlOrMeta?: boolean; shift?: boolean; requiresSelection?: boolean }`.
2.2 `findShortcut(e, { hasSelection })` matches on `key.toLowerCase()`, `ctrlOrMeta`
    (`e.ctrlKey || e.metaKey`), `shift`, and refuses `requiresSelection` entries when
    `hasSelection === false`. No match ⇒ `undefined`.
2.3 Every entry in `SHORTCUTS` is handled somewhere in `App.tsx`/`ThreeViewport.tsx`. The registry is
    the source of truth for both dispatch and the legend, so the two cannot drift.
2.4 `isEditableTarget(target)` returns `true` for `INPUT`, `TEXTAREA`, `SELECT` and any element whose
    `contenteditable` attribute is `''` or `'true'`; dispatch is skipped for those targets. This is
    the F-040 fix: `g` no longer fires while a `<select>` has focus.
2.5 `g` no longer fires while the Revit sequence buffer is non-empty (`revitKeyBufferRef`), so `g` as
    the first letter of a command does not toggle the grid.
2.6 `?` (and `Shift+/`) opens `ShortcutLegend`; `Escape` closes it; `GlassHeader` has a help button
    with `aria-label="Keyboard shortcuts"` that opens it.
2.7 `ShortcutLegend` renders `role="dialog"`, `aria-modal="true"`, an accessible name matching
    `/keyboard shortcuts/i`, and **every** `SHORTCUTS` entry's `label` exactly once.
2.8 `formatShortcut(def)` renders `Ctrl+K` on Windows/Linux and `⌘K` when `navigator.platform`
    contains `Mac`; it never emits a raw `e.key` value.

**3 — The user can see whether the edit was saved.**
3.1 `services/saveStatus.ts` exports `SaveStatus = 'idle' | 'saving' | 'saved' | 'error'`, a
    `SaveSnapshot = { status, lastSavedAt: Date | null, error: string | null }`, and
    `subscribeSaveStatus()`, `getSaveSnapshot()`, `markSaving()`, `markSaved(at = new Date())`,
    `markSaveError(error)`, `resetSaveStatus()`.
3.2 `markSaved()` sets `status: 'saved'` and `lastSavedAt` to the supplied date; `markSaveError()`
    sets `status: 'error'` and `error` to `error instanceof Error ? error.message : String(error)`.
3.3 `useSaveStatus()` subscribes with `useSyncExternalStore` and returns the snapshot; `'saved'`
    decays to `'idle'` after `SAVED_VISIBLE_MS = 4000` (fake timers must be able to drive it).
3.4 `SaveStatusIndicator` renders `<span role="status" aria-live="polite" data-qa="save-status"
    data-state={status}>` with text `Saving…` / `Saved` / `Save failed` / `Up to date`, and a
    `title` carrying `lastSavedAt` in ISO form when present.
3.5 Every element-mutation call in `services/api.ts` (11 functions, `deleteElement` →
    `assignElementMaterial`) and the two raw `fetch()` writes are wrapped so a failure surfaces as
    `status: 'error'` rather than `console.error` only. Project-level calls (`createProject`,
    `uploadIFCFile`, the four `createCad*` builders) are **not** wrapped — their modals already show a
    progress state.

**4 — Touch targets are 44 px.**
4.1 `utils/touchTargets.ts` exports `MIN_TOUCH_TARGET_PX = 44` and
    `withTouchTarget(className: string): string`, which appends `min-h-11 min-w-11` (44 px at the
    default 4 px spacing unit) unless the class string already declares a `min-h-*`/`min-w-*`.
4.2 Every compact icon control in `GlassBottomDock.tsx` and `GlassHeader.tsx` that uses `p-1`/`p-1.5`
    passes its class string through `withTouchTarget()` **or** declares `min-h-11 min-w-11` itself.
4.3 `index.css` contains a `@media (pointer: coarse)` block that gives `[data-touch-target]`
    `min-height: 44px; min-width: 44px`.
4.4 No control becomes visually larger on a fine pointer (the padding change must not change the
    desktop layout width of the header or dock).

**5 — One-finger orbit works on touch.**
5.1 `utils/viewportControls.ts` exports `buildOrbitControlConfig()` returning
    `{ mouseButtons: { LEFT: -1, MIDDLE: MOUSE.PAN, RIGHT: -1 }, touches: { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN } }`.
5.2 `ThreeViewport.tsx:913-917` assigns from that function instead of the inline literal.
5.3 The existing `pointerdown` mutation at `ThreeViewport.tsx:920-933` (which swaps
    `mouseButtons.MIDDLE` to `ROTATE` on Shift) does not touch `touches`.

**6 — The modify dock keeps its 64 px clearance (F-049 stays closed).**
6.1 No file under `frontend/src/components/**` contains `top-14` on a `fixed` element.
6.2 `GlassContextualModifyDock.tsx:194` keeps a `top-<n>` whose `n × 4 px ≥ 64 px`.
6.3 `GlassHeader.tsx:116` keeps `h-16` (the constant the guard is written against).

**7 — The omnibar indexes the whole model and says so.**
7.1 `MAX_VISIBLE_RESULTS = 50` and `buildOmnibarItems({ geometries, spatialNodes, callbacks })` emits
    one `element` item per geometry — **no 50-item slice**.
7.2 `filterOmnibarItems(items, query)` returns **all** matches; an empty query returns all items.
7.3 `SpatialOmnibar` renders `filtered.slice(0, MAX_VISIBLE_RESULTS)` and, when
    `filtered.length > MAX_VISIBLE_RESULTS`, a footer reading `+N more — keep typing`
    (`data-qa="omnibar-overflow"`). Silent truncation is the defect; a labelled cap is fine.

**8 — Modals manage focus.**
8.1 `useFocusTrap(isActive)` returns `{ ref, onKeyDown }`; on activation it focuses the first
    focusable descendant of `ref`, on deactivation it restores focus to the element that was focused
    before activation.
8.2 `onKeyDown` wraps `Tab` from the last focusable to the first and `Shift+Tab` from the first to the
    last, using `preventDefault()`.
8.3 `SettingsModal`, `UploadModal` and `NewProjectModal` attach the hook and declare
    `role="dialog"`, `aria-modal="true"` and `aria-labelledby` pointing at their `<h2>`/`<h3>`.
8.4 `Escape` closes the modal via the existing `App.tsx:962-1009` guard, and focus returns to the
    control that opened it (8.1) — no code in `App.tsx` needs to change for this beyond keeping the
    guard's list in sync.

## TDD

### 1. Add the failing test

**File:** `frontend/src/tests/step28.ergonomics.test.tsx`
**Command:** `pnpm exec vitest run src/tests/step28.ergonomics.test.tsx`

**Requires STEP-27** (jsdom, `@testing-library/react`, `user-event`, `src/tests/setup.ts`).

<details>

```tsx
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
```

</details>

### 2. Watch it fail

```
$ pnpm exec vitest run src/tests/step28.ergonomics.test.tsx

 FAIL  src/tests/step28.ergonomics.test.tsx [ src/tests/step28.ergonomics.test.tsx ]

Error: Failed to resolve import "../services/shortcuts" from "src/tests/step28.ergonomics.test.tsx".
       Does the file exist?

 Test Files  1 failed (1)
      Tests  no tests
```

Then, as each module lands, the interesting failures surface. The ones that prove the step is real:

```
AssertionError: expected 'modify' to be 'query'
  - Expected
  + Received
  - query
  + modify
```
(`resolveInitialProfile` not wired / still returning `'modify'`.)

```
AssertionError: These dock buttons are smaller than 44x44 CSS px.
- []
+ [
+   "p-1.5 rounded-full text-slate-600 dark:text-slate-300 hover:…",
+   … 7 more
+ ]
```

```
AssertionError: expected [ …(250) ] to have a length of 250 but got 50
```
(from `geometries.slice(0, 50)`.)

### 3. Implement

Order matters: each item is independently testable, and the last one (8) touches the most files.

1. **`utils/touchTargets.ts`** — `MIN_TOUCH_TARGET_PX = 44`; `withTouchTarget()` appends
   `min-h-11 min-w-11` when absent. Then change the dock's compact icon buttons
   (`GlassBottomDock.tsx:368,405,638,675,729,908,947,1014`) and the header's icon buttons
   (`GlassHeader.tsx:98-105,665-676` and the neighbouring controls at `:336-664`). Leave the
   dropdown *panel* containers alone — `:378,415,648,685,739,918,957` are `p-1` popovers, not
   buttons, and must not grow. Add the `@media (pointer: coarse)` block to `index.css`.
2. **`utils/viewportControls.ts`** + `ThreeViewport.tsx:913-917`. Leave the Shift-swap handler at
   `:920-933` untouched.
3. **`services/shortcuts.ts`** — registry, `findShortcut`, `isEditableTarget`, `formatShortcut`.
   Populate from the *code*, not from `USER-NEEDS.md`: `Ctrl+K` (`SpatialOmnibar.tsx:54`), `g`
   (`App.tsx:123`), `Shift+S` (`App.tsx:126`), `Ctrl+Z`/`Ctrl+Y`/`Delete`/`Ctrl+D`/`Ctrl+,`
   (`App.tsx:861-889`), `Escape` (`App.tsx:964`), `Ctrl+R`/`Tab` (`ThreeViewport.tsx:2721,2735`),
   `?` (new, item 6).
4. **`components/nav/ShortcutLegend.tsx`** — plain `<div role="dialog">` is fine; it must not import
   Radix (keeps the test free of portal quirks). Group by `ShortcutDef.group`, render
   `formatShortcut(def)` + `label`. Close on overlay click and on `Escape` when open.
5. **`services/saveStatus.ts` + `hooks/useSaveStatus.ts` + `SaveStatusIndicator.tsx`** — module-scope
   `let snapshot: SaveSnapshot` + `Set<listener>`; `useSyncExternalStore`. The 4 s decay lives in the
   hook's `useEffect` (`setTimeout` when `status === 'saved'`, cleared on unmount/change).
   Then wrap the 11 `api.ts` mutators and the two raw `fetch()` writes.
6. **`services/onboarding.ts` + `OnboardingCard.tsx`**; change `App.tsx:410-418` to
   `resolveInitialProfile(saved)`; render `<OnboardingCard />` beside the existing empty state at
   `App.tsx:1805-1829` (keep that overlay — it is not a duplicate, it is the "no geometry in this
   project" state).
7. **`services/omnibarIndex.ts`** + rewrite `SpatialOmnibar.tsx:68-187` to call it, remove
   `.slice(0, 50)`, add the overflow footer.
8. **`hooks/useFocusTrap.ts`** + the three modals. Focusable selector:
   `'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'`.
   Capture `document.activeElement` on activation, restore in the cleanup.
9. **Wire dispatch:** in `App.tsx` replace the `g`/`Shift+S` handler (`:113-133`) with one that calls
   `findShortcut(e, { hasSelection: selectedExpressID !== null })` and switches on `id`; skip when
   `isEditableTarget(e.target)` or when `revitKeyBufferRef.current !== ''`. Leave the `Escape`
   precedence chain (`:962-1009`) as-is, but route its matcher through `findShortcut` so the legend
   stays honest.
10. **Header affordances:** help button + `<SaveStatusIndicator />` in `GlassHeader.tsx`, immediately
    before the settings button at `:665-676`; pass `onOpenShortcuts` from `App.tsx` the way
    `onOpenOmnibar` is already passed (`App.tsx:1590`).

### 4. Watch it pass

```
$ pnpm exec vitest run src/tests/step28.ergonomics.test.tsx

 ✓ src/tests/step28.ergonomics.test.tsx (20 tests) 180ms

 Test Files  1 passed (1)
      Tests  20 passed (20)
```

```
$ pnpm exec vitest run
 Test Files  6 passed (6)
      Tests  38 passed (38)   # 13 pre-existing + 4 (STEP-25) + 1 (STEP-27) + 20 new
```

### 5. Regression guard

```powershell
# from frontend/
pnpm exec vitest run
pnpm exec tsc -b --noEmit
pnpm run build

# from the repo root
.\backend\venv\Scripts\python.exe scripts/gates/run_gates.py
#   includes check_spatial_overlap.py — the header/dock data-qa dedupe check MUST still pass.
#   If it fails, you added a duplicate data-qa attribute to GlassHeader/GlassBottomDock.

# live check — the only way to verify 4.x-6.x visually
.\backend\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000   # from backend/
pnpm run dev                                                                             # from frontend/
.\backend\venv\Scripts\python.exe scripts\qa_runner.py run --range TC-001:TC-015 --browser
#   plus a manual pass at 1280x800 and in Chrome DevTools device emulation (iPad, touch)
```

## Acceptance criteria

- [ ] `grep -n "return 'modify'" frontend/src/App.tsx` → no match in the profile initialiser (`:410-418`).
- [ ] Fresh `localStorage` + reload ⇒ the modify ribbon is absent, the coordinate HUD is visible, and the onboarding card is shown once.
- [ ] `?` opens the legend; `Escape` closes it; the header help button has `aria-label="Keyboard shortcuts"`.
- [ ] Every `SHORTCUTS` entry is dispatchable: a manual pass confirms each binding listed in the legend actually fires (11+ bindings).
- [ ] Typing `g` into a `<select>`, an `<input>` and a two-letter Revit sequence does **not** toggle the grid.
- [ ] A successful property edit shows `Saved` (`data-state="saved"`) within 1 s and returns to `Up to date` after 5 s; a forced 500 (rename a backend route) shows `Save failed`.
- [ ] Every dock/header icon button resolves to ≥ 44 × 44 CSS px in DevTools' computed box on a coarse-pointer emulation, and the fine-pointer desktop layout is unchanged (header height 64 px, dock width unchanged).
- [ ] One-finger drag orbits and two-finger drag dollies on a touch device or DevTools emulation.
- [ ] `top-14` appears nowhere under `frontend/src/components/`; the live dock's offset is ≥ 64 px.
- [ ] The omnibar finds `Element #249` on a 250-element model and shows the `+N more` footer at 51+ matches.
- [ ] `Tab`/`Shift+Tab` cycle inside Settings, Upload and New Project modals; closing returns focus to the trigger.
- [ ] `pnpm exec vitest run` → 6 files / 38 tests; `tsc -b --noEmit` silent; `run_gates.py` all pass.

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| a dedicated step decides `?` should open something else | `?` is chosen because it is unbound (measured) and conventional; the registry makes a rebind a one-line change | Edit `SHORTCUTS` |
| Centralising dispatch breaks a binding nobody documented | The registry is built *from* the existing handlers; each `ShortcutDef` is matched 1:1 with a line reference in a code comment. The manual acceptance pass walks the legend | `git revert` — the old handlers are in the same commit's diff |
| `useSyncExternalStore` + module-scope state leaks between tests | `resetSaveStatus()` in `beforeEach`; `setup.ts` clears `localStorage` in `afterEach` | n/a |
| `saved` decay makes the indicator flicker on rapid edits | `markSaving()` clears the pending decay timer; only the last write schedules one | Raise `SAVED_VISIBLE_MS` |
| 44 px padding grows the dock/header and breaks `check_spatial_overlap.py`'s assumptions | Use `min-h-11 min-w-11` + `items-center justify-center` **without** increasing `p-1.5`; the desktop box stays 26 px because `min-*` only sets a floor when a coarse pointer matches `data-touch-target` | Remove the media query |
| Onboarding card covers the viewport on every load if the flag cannot persist | `hasCompletedOnboarding()` returns `false` on a `localStorage` throw — so a private-mode user sees it every load. Mitigation: the card is one line tall and dismissible per session via component state, and the flag failure is logged once | Revert `onboarding.ts` |
| `saveStatus` reports `saved` for a write that the backend silently discarded (F-005-style lie) | It reports the HTTP outcome, not a re-read. Document that limit in the component's doc comment; do not claim "verified" | n/a |
| Focus trap fights Radix components (omnibar dialog, dropdowns) | Only the three hand-rolled modals adopt the hook; Radix already traps focus for `Dialog` | Remove the hook from the offending modal |

## Notes

- **Two findings are already answered by other steps, and this document must not "re-fix" them:**
  - **F-049** is closed by STEP-25 (the offending component is deleted). The live dock is correct at
    `top-18`. Spec item 6 is a *guard*, not a fix.
  - **F-048**'s `modify` default and **F-051**'s "no empty state" are both only half true — there is an
    empty state (`App.tsx:1805-1829`), and the profile default is a one-word change. Do not rebuild
    either from scratch.
- **F-040 is folded in** even though `ROADMAP.md:126` does not list it under STEP-28:
  `USER-NEEDS.md:76` maps it here, and it is the same key-handler code the registry replaces. If the
  reviewer disagrees, `isEditableTarget()` and Spec 2.4/2.5 can be dropped without touching the rest.
- **`Space` is not a shortcut.** `USER-NEEDS.md:76` lists `G/R/S/Space/Delete/Ctrl+K/Ctrl+J/Ctrl+D`;
  measured, there is **no** `Space` handler and **no** `Ctrl+J` handler (grep → 0 matches for both),
  while `Ctrl+,`, `Ctrl+R` and `Tab` *do* exist and are not in that list. Build the legend from the
  code. Correct the user-needs table in a follow-up doc commit if you like — do not invent handlers to
  match it.
- **Why `'query'` and not `'review'` as the first-run profile:** `review` hides the property inspector
  and the coordinate HUD (`profiles.ts:49,52`), which would look like a regression the moment STEP-12
  lands. `query` keeps the tree, inspector and HUD visible and only removes the CAD ribbon — which is
  exactly "read-first". This is a product decision; if the owner prefers `review`, change one line in
  `resolveInitialProfile()` and update the two assertions in the test.
- **The `?` key needs `Shift+/` on most layouts.** Match `e.key === '?'` first (layout-independent on
  US/UK), and keep `Shift+/` in the registry entry so the legend reads correctly.
- **The static dock guard is a heuristic.** It reads `<button … className="…">` out of the raw file;
  a button whose `onClick` contains balanced braces inside a nested arrow function could be skipped.
  The `expect(examined).toBeGreaterThanOrEqual(8)` line is there so a silent parser regression shows up
  as a failure instead of a green lie. Anything the guard cannot see must be covered by the manual
  acceptance item about computed 44 px boxes.
- **The save indicator reports HTTP outcomes only.** A `200` that the backend then discards (F-005,
  F-021) still reads `Saved`. Do not market this as "your work is verified"; it is "the server accepted
  the write". The honest upgrade is a re-read/ETag comparison, which belongs with STEP-02/STEP-04.
- **Touch orbit cannot be verified in this repo's tooling.** No device farm, and jsdom has no pointer
  input. Spec 5.x is verifiable at the config level; the *feel* needs one human with a tablet, once.
  Record the result in the handoff entry.
- Do not let this step run before STEP-27: the test file imports `@testing-library/react` and the
  `?raw` module type, both of which STEP-27 installs and configures.

## Notes — implementation log (2026-10-25, STEP-28 lane)

**Status:** code landed, tests green, App.tsx / ThreeViewport.tsx wiring deferred to the integration
lane (see `docs/audit-2026-10/steps/notes/STEP-28.md` for the exact snippets).

Landed in this lane:

- `services/shortcuts.ts` (registry, `findShortcut`, `isEditableTarget`, `formatShortcut`),
  `components/nav/ShortcutLegend.tsx`, `services/saveStatus.ts` + `hooks/useSaveStatus.ts` +
  `components/nav/SaveStatusIndicator.tsx`, `services/onboarding.ts` +
  `components/onboarding/OnboardingCard.tsx`, `services/omnibarIndex.ts`, `hooks/useFocusTrap.ts`,
  `utils/viewportControls.ts`, `utils/touchTargets.ts`.
- `GlassHeader.tsx`: `?` help button (`aria-label="Keyboard shortcuts"`, `data-qa="pill-shortcuts-help"`)
  and `<SaveStatusIndicator />`, both optional via `onOpenShortcuts` / `showSaveStatus`.
- `SpatialOmnibar.tsx`: indexes the whole model through `omnibarIndex`, keeps the STEP-11
  `resolveOmnibarShortcut` listener, adds the `data-qa="omnibar-overflow"` `+N more — keep typing` footer.
- `SettingsModal.tsx`, `UploadModal.tsx`, `NewProjectModal.tsx`: `useFocusTrap` + `role="dialog"` +
  `aria-modal="true"` + `aria-labelledby`.
- `services/api.ts`: the 11 element mutators (`deleteElement` … `assignElementMaterial`) **plus**
  `updateElementProperty` (12 total) run through `withSaveStatus()`; `useGizmoTransform.ts`'s raw
  placement `POST` reports failures instead of only logging them.
- `index.css`: `@media (pointer: coarse)` 44 px rule for `[data-touch-target]` and a matching
  `@media (pointer: fine)` rule that keeps the pre-existing 26 px icon-button box.
- Touch targets: `GlassContextualModifyDock.tsx` (17 buttons) and `GlassBottomDock.tsx` (27) now carry
  `min-h-11 min-w-11` + `data-touch-target`, without touching their padding.

Deviations and findings worth reading before the integration pass:

1. **The 44 px guard in the TDD test reads `components/cad/GlassContextualModifyDock.tsx`, not
   `GlassBottomDock.tsx`.** `dockSource` in the test file is the *modify* dock (`?raw`), so the
   `examined >= 8` assertion is satisfied by that file. Both files were fixed; `GlassBottomDock` is the
   one Spec 4.2 actually names.
2. **`min-h-11` alone would have grown the desktop dock.** Spec 4.4 and the risk table disagree with
   each other: the test demands the literal `min-h-11` token in the class string, but an unconditional
   `min-height: 44px` changes the fine-pointer geometry. `index.css` therefore scopes the floor:
   un-layered CSS outranks Tailwind's `@layer utilities`, so
   `@media (pointer: fine) { .min-h-11.min-w-11 { min-height: 26px; min-width: 26px } }` keeps the old
   26 px icon box while `(pointer: coarse)` promotes `[data-touch-target]` to 44 px.
3. **The step document says to wrap "the two raw `fetch()` calls in `GlassPropertyInspector.tsx`"** — the
   only raw `fetch` there is the *details loader* (`GET /elements/:id`), not a write. The property write
   goes through `api.updateElementProperty`, which is now wrapped; that is also what the acceptance item
   "a successful property edit shows `Saved`" needs.
4. **`Ctrl+Shift+Z` is not in the registry.** `findShortcut` refuses `element.undo` when Shift is held
   (`shift: false`), and `element.redo` is `Ctrl+Y`. `App.tsx`'s legacy branch keeps handling
   `Ctrl+Shift+Z`; the legend does not claim it.
5. **`services/shortcuts.ts` label for `?` is "Open this shortcut legend", not "Keyboard shortcuts"** —
   the dialog's `<h2>` is "Keyboard shortcuts" and the TDD test asserts every label appears exactly
   once, so an identical label would collide with the title.
6. **`frontend/src/tests/step25.importGraph.test.ts` gained five `KNOWN_UNREACHABLE_OUTSIDE_STEP25`
   entries** (the modules above that only App.tsx / ThreeViewport.tsx can make reachable). They must be
   deleted in the same change that wires them; the entries are commented with the exact call site.
7. **Not verified here:** live browser measurement of 44 px computed boxes, one-finger orbit on a
   tablet, and the `?`-opens-the-legend behaviour — all three need App.tsx wiring plus a human with a
   device. `run_gates.py` (including `check_spatial_overlap.py`) was not run in this lane.
