/**
 * STEP-11 / F-008 - the command palette chord, resolved as a pure function so the
 * behaviour can be tested without a DOM.
 */

export type OmnibarShortcutAction = 'open' | 'close' | 'ignore';

export interface ShortcutEventLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  isComposing?: boolean;
}

/**
 * `Ctrl+K` / `Cmd+K` toggles the palette. Everything else - bare `K`, other keys, extra
 * modifiers, and a `K` produced by an IME composition - is ignored so the browser keeps its
 * own behaviour (and `preventDefault()` is not called).
 */
export function resolveOmnibarShortcut(event: ShortcutEventLike, isOpen: boolean): OmnibarShortcutAction {
  if (event.isComposing) return 'ignore';
  if (!(event.ctrlKey || event.metaKey)) return 'ignore';
  if (event.altKey || event.shiftKey) return 'ignore';
  if (event.key.toLowerCase() !== 'k') return 'ignore';
  return isOpen ? 'close' : 'open';
}
