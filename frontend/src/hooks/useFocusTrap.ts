import { useCallback, useEffect, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';

/**
 * STEP-28 / F-032 follow-up - modal focus management.
 *
 * `SettingsModal`, `UploadModal` and `NewProjectModal` render hand-rolled `<div>` overlays
 * (no Radix Dialog), so nothing moved focus in, trapped `Tab`, or gave it back on close.
 * This hook does exactly that and nothing else:
 *
 * - on activation: remember `document.activeElement`, focus the first focusable descendant
 *   (or the container itself when it has none),
 * - `Tab` / `Shift+Tab` wrap inside the container,
 * - on deactivation / unmount: restore focus to whatever had it before.
 *
 * Escape stays with the `App.tsx` precedence chain (spec 8.4) - the hook does not own it.
 * Pointer interaction is untouched.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

export interface FocusTrapApi<T extends HTMLElement = HTMLDivElement> {
  ref: RefObject<T | null>;
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
}

export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(isActive: boolean): FocusTrapApi<T> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!isActive) return;
    const container = ref.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const first = focusableIn(container)[0];
    if (first) {
      first.focus();
    } else if (!container.hasAttribute('tabindex')) {
      // Nothing focusable: put focus on the dialog so the keyboard user is still "inside".
      container.setAttribute('tabindex', '-1');
      container.focus();
    }

    return () => {
      if (
        previouslyFocused &&
        typeof previouslyFocused.focus === 'function' &&
        document.contains(previouslyFocused)
      ) {
        previouslyFocused.focus();
      }
    };
  }, [isActive]);

  const onKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return;
    const container = ref.current;
    if (!container) return;

    const focusables = focusableIn(container);
    if (focusables.length === 0) return;

    const currentIndex = focusables.indexOf(document.activeElement as HTMLElement);
    if (currentIndex === -1) return;

    const nextIndex = event.shiftKey
      ? (currentIndex - 1 + focusables.length) % focusables.length
      : (currentIndex + 1) % focusables.length;

    event.preventDefault();
    focusables[nextIndex]?.focus();
  }, []);

  return { ref, onKeyDown };
}
