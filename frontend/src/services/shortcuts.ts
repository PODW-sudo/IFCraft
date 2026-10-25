/**
 * STEP-28 / F-048 - the single keyboard shortcut registry.
 *
 * Before this module the product had bindings in five places
 * (`App.tsx` x3, `ThreeViewport.tsx`, `SpatialOmnibar.tsx`) and documented none of them.
 * The registry is the source of truth for **both** dispatch and the shortcut legend, so
 * the two cannot drift (spec 2.3).
 *
 * The registry was built *from the code*, not from `USER-NEEDS.md`: every entry below
 * corresponds to a handler that already existed (or, for `?`, was added by this step).
 * Two documented-elsewhere chords are intentionally absent because no handler exists:
 * `Space` and `Ctrl+J`. See the step document's notes.
 */

export type ShortcutGroup = 'Navigation' | 'Editing' | 'View' | 'Tools';

export interface ShortcutDef {
  /** Stable identifier - `App.tsx` switches on this. */
  id: string;
  /** Human label, rendered verbatim by `ShortcutLegend` (must be unique). */
  label: string;
  group: ShortcutGroup;
  /** `event.key` value, matched case-insensitively. */
  key: string;
  /** Requires `Ctrl` (Windows/Linux) or `Cmd` (macOS). */
  ctrlOrMeta?: boolean;
  /** When `true`, `Shift` must be held. When `false`, `Shift` must not be held. */
  shift?: boolean;
  /** Only dispatches when an element is selected. */
  requiresSelection?: boolean;
}

/**
 * Registry order is meaningful: `findShortcut()` returns the first match, so more
 * specific chords are listed before their supersets.
 */
export const SHORTCUTS: readonly ShortcutDef[] = [
  // --- Navigation -----------------------------------------------------------
  {
    id: 'omnibar.open',
    label: 'Command palette',
    group: 'Navigation',
    // SpatialOmnibar.tsx - resolveOmnibarShortcut() handles the chord itself; the
    // registry entry exists so the legend documents it.
    key: 'k',
    ctrlOrMeta: true,
  },
  {
    id: 'app.escape',
    label: 'Cancel tool / clear selection',
    group: 'Navigation',
    key: 'Escape',
    // App.tsx Escape precedence chain (modals -> selection -> dimension -> measure -> tool)
  },
  {
    id: 'viewport.cycleCandidate',
    label: 'Cycle overlapping elements under cursor',
    group: 'Navigation',
    key: 'Tab',
    // ThreeViewport.tsx - window keydown handler, hoverCandidatesRef cycle
  },

  // --- Editing --------------------------------------------------------------
  {
    id: 'element.undo',
    label: 'Undo last edit',
    group: 'Editing',
    key: 'z',
    ctrlOrMeta: true,
    shift: false,
  },
  {
    id: 'element.redo',
    label: 'Redo last edit',
    group: 'Editing',
    key: 'y',
    ctrlOrMeta: true,
    shift: false,
  },
  {
    id: 'element.delete',
    label: 'Delete selected element',
    group: 'Editing',
    key: 'Delete',
    requiresSelection: true,
  },
  {
    id: 'element.clone',
    label: 'Duplicate selected element',
    group: 'Editing',
    key: 'd',
    ctrlOrMeta: true,
    requiresSelection: true,
  },
  {
    id: 'element.rotate',
    label: 'Rotate selection 90° about Z',
    group: 'Editing',
    key: 'r',
    ctrlOrMeta: true,
    requiresSelection: true,
  },

  // --- View -----------------------------------------------------------------
  {
    id: 'viewport.toggleGrid',
    label: 'Toggle ground grid',
    group: 'View',
    key: 'g',
    // App.tsx - guarded against editable targets and an in-flight Revit sequence (F-040)
  },
  {
    id: 'drawing.sheets',
    label: 'Drawing sheets & views',
    group: 'View',
    key: 'S',
    shift: true,
  },
  // --- Tools ----------------------------------------------------------------
  {
    id: 'settings.open',
    label: 'Editor preferences',
    group: 'Tools',
    key: ',',
    ctrlOrMeta: true,
  },
  {
    id: 'help.shortcuts',
    label: 'Open this shortcut legend',
    group: 'Tools',
    key: '?',
    // `?` is Shift+/ on most layouts; matching `e.key === '?'` is layout independent,
    // so `shift` is deliberately unconstrained here.
  },
];

/** Minimal shape of a keyboard event - keeps the matcher testable without a DOM. */
export interface ShortcutEventLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

export interface ShortcutMatchContext {
  hasSelection: boolean;
}

/**
 * Returns the first registry entry matching `event`, or `undefined`.
 *
 * Matching rules (spec 2.2):
 * - `key` is compared lower-cased, so `K` and `k` are the same chord.
 * - `ctrlOrMeta` entries require Ctrl *or* Cmd; every other entry requires neither.
 * - `shift: true` entries require Shift; `shift: false` entries forbid it; entries that
 *   omit `shift` accept either (needed for `?`).
 * - `requiresSelection` entries never match with `hasSelection === false`.
 */
export function findShortcut(
  event: ShortcutEventLike,
  { hasSelection }: ShortcutMatchContext
): ShortcutDef | undefined {
  if (!event || typeof event.key !== 'string' || event.key.length === 0) return undefined;
  if (event.altKey) return undefined;

  const key = event.key.toLowerCase();
  const ctrlOrMeta = Boolean(event.ctrlKey || event.metaKey);
  const shift = Boolean(event.shiftKey);

  return SHORTCUTS.find((shortcut) => {
    if (shortcut.key.toLowerCase() !== key) return false;
    if (Boolean(shortcut.ctrlOrMeta) !== ctrlOrMeta) return false;
    if (shortcut.shift === true && !shift) return false;
    if (shortcut.shift === false && shift) return false;
    if (shortcut.requiresSelection && !hasSelection) return false;
    return true;
  });
}

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * `true` when the event target is a text-entry control (F-040).
 *
 * Covers `<input>`, `<textarea>`, `<select>` and any element inside a
 * `contenteditable=""` / `contenteditable="true"` subtree. `SELECT` is the case the old
 * guard missed: it only checked `INPUT`/`TEXTAREA`/`isContentEditable`, so pressing `g`
 * while a schema dropdown had focus toggled the 3D grid.
 */
export function isEditableTarget(target: EventTarget | null | undefined): boolean {
  if (!target) return false;
  const element = target as Element & { tagName?: string; closest?: unknown };
  if (typeof element.tagName !== 'string') return false;
  if (EDITABLE_TAGS.has(element.tagName)) return true;
  if (typeof element.closest !== 'function') return false;

  const editable = element.closest('[contenteditable]');
  if (!editable) return false;
  const value = editable.getAttribute('contenteditable');
  return value === '' || value === 'true';
}

/** `true` when the running platform reports a Mac (used only for display). */
export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform = navigator.platform ?? '';
  return /mac/i.test(platform);
}

/**
 * Renders a shortcut the way the legend and tooltips show it.
 *
 * `Ctrl+K` on Windows/Linux, `⌘K` on macOS (spec 2.8). Shift is expressed as `⇧` on
 * macOS and `Shift+` elsewhere. The `key` is always the registry value, never a raw
 * `event.key` captured at runtime.
 */
export function formatShortcut(shortcut: ShortcutDef, mac: boolean = isMacPlatform()): string {
  const key = shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key;

  if (mac) {
    const parts: string[] = [];
    if (shortcut.ctrlOrMeta) parts.push('⌘');
    if (shortcut.shift) parts.push('⇧');
    parts.push(key);
    return parts.join('');
  }

  const parts: string[] = [];
  if (shortcut.ctrlOrMeta) parts.push('Ctrl');
  if (shortcut.shift) parts.push('Shift');
  parts.push(key);
  return parts.join('+');
}
