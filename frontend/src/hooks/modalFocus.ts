import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/**
 * Modal keyboard semantics (STEP-24, F-032).
 *
 * `nextFocusIndex` is pure so it can be unit-tested without a DOM; `useModalFocusTrap` needs the
 * DOM and is exercised by the rendered a11y test instead. Both live here so the dialog has a single
 * place that owns "which element gets focus" and "what Escape does".
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

/**
 * Index that `Tab` / `Shift+Tab` should move to, wrapping inside `[0, total)`.
 * Returns `-1` when the dialog has nothing focusable.
 */
export function nextFocusIndex(current: number, total: number, shift: boolean): number {
  if (total <= 0) return -1;
  const base = current < 0 ? (shift ? 0 : -1) : current;
  return shift ? (base - 1 + total) % total : (base + 1) % total;
}

export interface ModalFocusTrapOptions {
  /** Trap and restore focus only while this is true (i.e. while the dialog is open). */
  active: boolean;
  /** Called when the user presses Escape inside the dialog. */
  onEscape?: () => void;
}

/**
 * Focus trap for a modal container:
 * - on activation, remembers `document.activeElement` and focuses the first focusable descendant,
 * - keeps `Tab` / `Shift+Tab` cycling inside the container,
 * - routes `Escape` to `onEscape`,
 * - on deactivation / unmount, returns focus to the element that had it before opening.
 *
 * It only intercepts `Tab` and `Escape`; pointer interaction is untouched.
 */
export function useModalFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  { active, onEscape }: ModalFocusTrapOptions
): void {
  const onEscapeRef = useRef(onEscape);

  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    const first = focusables()[0];
    if (first) {
      first.focus();
    } else if (!container.hasAttribute('tabindex')) {
      // Nothing focusable: make the dialog itself focusable so keyboard users are still inside it.
      container.setAttribute('tabindex', '-1');
      container.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onEscapeRef.current?.();
        return;
      }

      if (event.key !== 'Tab') return;

      const list = focusables();
      if (list.length === 0) return;

      const activeIndex = list.indexOf(document.activeElement as HTMLElement);
      const nextIndex = nextFocusIndex(activeIndex, list.length, event.shiftKey);

      event.preventDefault();
      list[nextIndex]?.focus();
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [active, containerRef]);
}
