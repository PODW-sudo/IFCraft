/**
 * STEP-28 / F-050 - "can I tell whether my edit was saved?"
 *
 * A module-scope store, subscribed to through `useSyncExternalStore`. It records the
 * outcome of writes that already happen; it does **not** autosave, and it does not
 * re-read the model afterwards.
 *
 * Honest limitation: `markSaved()` means *the server accepted the write* (HTTP 2xx), not
 * that the change survived a round trip. A backend that discards a write it acknowledged
 * (F-005/F-021) will still show `Saved`. Do not market this as verification.
 */

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface SaveSnapshot {
  status: SaveStatus;
  lastSavedAt: Date | null;
  error: string | null;
}

/** How long `saved` stays visible before decaying back to `idle` (spec 3.3). */
export const SAVED_VISIBLE_MS = 4000;

type Listener = () => void;

const INITIAL_SNAPSHOT: SaveSnapshot = {
  status: 'idle',
  lastSavedAt: null,
  error: null
};

let snapshot: SaveSnapshot = INITIAL_SNAPSHOT;
const listeners = new Set<Listener>();

function emit(next: SaveSnapshot): void {
  snapshot = next;
  for (const listener of listeners) {
    listener();
  }
}

/** Current snapshot. Stable identity until the next state transition. */
export function getSaveSnapshot(): SaveSnapshot {
  return snapshot;
}

/** Subscribe to transitions; returns the unsubscribe function. */
export function subscribeSaveStatus(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** A write started. Clears the previous error so a retry looks like a retry. */
export function markSaving(): void {
  emit({ status: 'saving', lastSavedAt: snapshot.lastSavedAt, error: null });
}

/** A write succeeded at `at` (defaults to now). */
export function markSaved(at: Date = new Date()): void {
  emit({ status: 'saved', lastSavedAt: at, error: null });
}

/** A write failed. The message is surfaced in the pill's tooltip. */
export function markSaveError(error: unknown): void {
  emit({
    status: 'error',
    lastSavedAt: snapshot.lastSavedAt,
    error: error instanceof Error ? error.message : String(error)
  });
}

/** Back to `Up to date`; used by tests and on project switch. */
export function resetSaveStatus(): void {
  emit(INITIAL_SNAPSHOT);
}

/**
 * Wraps an element-mutation write so the header can report its outcome (spec 3.5).
 *
 * The promise still rejects - callers keep their own error handling - but the shared
 * store has already been updated by the time they see the failure.
 */
export async function withSaveStatus<T>(operation: () => Promise<T>): Promise<T> {
  markSaving();
  try {
    const result = await operation();
    markSaved();
    return result;
  } catch (error) {
    markSaveError(error);
    throw error;
  }
}
