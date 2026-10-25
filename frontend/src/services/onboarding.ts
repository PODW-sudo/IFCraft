/**
 * STEP-28 / F-051 - first-run onboarding flag + the read-first default profile.
 *
 * The flag is a single localStorage key. A private-mode browser that throws on
 * `localStorage` must not break the app: `hasCompletedOnboarding()` returns `false`
 * (the card simply shows again) and `completeOnboarding()` swallows the write error.
 * See the step document's risk table for that trade-off.
 */

import type { UiProfile } from '../types/profiles';

export const ONBOARDING_KEY = 'ifc_editor_onboarded_v1';

/** `true` once the user dismissed the first-run card. Never throws. */
export function hasCompletedOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === '1';
  } catch {
    return false;
  }
}

/** Records dismissal. Never throws (private mode, quota, disabled storage). */
export function completeOnboarding(): void {
  try {
    localStorage.setItem(ONBOARDING_KEY, '1');
  } catch {
    // Intentionally silent: the card is dismissible per session through component state.
  }
}

/**
 * Profile for the current session (spec 1.1).
 *
 * A saved choice always wins. A first run lands on `query` - tree, property inspector
 * and coordinate HUD visible, CAD modify ribbon off - which is "read-first" without
 * hiding the data a new user needs in order to understand the model. `review` was
 * rejected because it hides the inspector and the HUD.
 */
export function resolveInitialProfile(savedProfile: UiProfile | null): UiProfile {
  return savedProfile ?? 'query';
}
