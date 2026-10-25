import { describe, it, expect } from 'vitest';
import { resolveOmnibarShortcut } from '../utils/omnibarShortcut';

const ev = (over: Partial<{ key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean; isComposing: boolean }> = {}) => ({
  key: 'k',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  isComposing: false,
  ...over
});

describe('STEP-11 Ctrl+K command palette', () => {
  it('opens the palette when closed', () => {
    expect(resolveOmnibarShortcut(ev({ ctrlKey: true }), false)).toBe('open');
  });

  it('closes the palette when open', () => {
    expect(resolveOmnibarShortcut(ev({ ctrlKey: true }), true)).toBe('close');
  });

  it('accepts Cmd+K and an upper-case K', () => {
    expect(resolveOmnibarShortcut(ev({ metaKey: true }), false)).toBe('open');
    expect(resolveOmnibarShortcut(ev({ ctrlKey: true, key: 'K' }), false)).toBe('open');
  });

  it('ignores alt, shift, other keys and bare K', () => {
    expect(resolveOmnibarShortcut(ev({ ctrlKey: true, altKey: true }), false)).toBe('ignore');
    expect(resolveOmnibarShortcut(ev({ ctrlKey: true, shiftKey: true }), false)).toBe('ignore');
    expect(resolveOmnibarShortcut(ev({ ctrlKey: true, key: 'j' }), false)).toBe('ignore');
    expect(resolveOmnibarShortcut(ev({}), false)).toBe('ignore');
  });

  it('ignores a K that arrives during IME composition', () => {
    expect(resolveOmnibarShortcut(ev({ ctrlKey: true, isComposing: true }), false)).toBe('ignore');
  });
});
