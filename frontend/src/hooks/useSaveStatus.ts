import { useEffect, useSyncExternalStore } from 'react';

import {
  SAVED_VISIBLE_MS,
  getSaveSnapshot,
  resetSaveStatus,
  subscribeSaveStatus,
  type SaveSnapshot
} from '../services/saveStatus';

/**
 * STEP-28 / F-050 - subscribes a component to the save-status store.
 *
 * The `saved` -> `idle` decay lives here (not in the store) so it only runs while
 * something is actually rendering the status, and so a fake-timer test can drive it
 * (spec 3.3). `markSaving()`/`markSaved()` replace the snapshot, which re-runs the effect
 * and clears any pending decay - only the last successful write schedules a timer.
 */
export function useSaveStatus(): SaveSnapshot {
  const snapshot = useSyncExternalStore(subscribeSaveStatus, getSaveSnapshot, getSaveSnapshot);

  useEffect(() => {
    if (snapshot.status !== 'saved') return;
    const timer = setTimeout(() => {
      resetSaveStatus();
    }, SAVED_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [snapshot.status]);

  return snapshot;
}
