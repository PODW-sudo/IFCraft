/**
 * STEP-28 / F-052 - 44 px touch targets.
 *
 * The compact icon buttons in the header and the bottom dock are `p-1` / `p-1.5` around a
 * 13-14 px icon, i.e. roughly 22-26 CSS px - half the 44 px minimum. The fix adds the
 * `min-h-11 min-w-11` floor (44 px at the default 4 px spacing unit) without touching the
 * padding; `index.css` scopes that floor to coarse pointers so the desktop layout is
 * unchanged (spec 4.4).
 */

/** WCAG 2.2 / Apple HIG minimum comfortable touch target. */
export const MIN_TOUCH_TARGET_PX = 44;

/** Tailwind classes that express `MIN_TOUCH_TARGET_PX` at the default spacing unit. */
export const TOUCH_TARGET_CLASSES = 'min-h-11 min-w-11';

const HAS_MIN_SIZE = /(^|\s)min-[hw]-/;

/**
 * Appends the 44 px floor to a class string unless it already declares a minimum size.
 *
 * Idempotent: `withTouchTarget(withTouchTarget(x)) === withTouchTarget(x)`.
 */
export function withTouchTarget(className: string): string {
  const trimmed = className.trim();
  if (!trimmed) return TOUCH_TARGET_CLASSES;
  if (HAS_MIN_SIZE.test(trimmed)) return trimmed;
  return `${trimmed} ${TOUCH_TARGET_CLASSES}`;
}
