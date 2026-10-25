/**
 * Observable state for the background clash job (audit issue 2.1).
 *
 * The job is started and polled by `useModelLifecycle` (which owns the project id), while the
 * inspector renders it. App.tsx does not pass clash-job props to `ClashInspector`, so the two
 * communicate through this tiny external store instead of being rewired through the root
 * component. `useSyncExternalStore` keeps it tear-free.
 */

import type { ClashJobPhase, ClashJobStatusValue } from '../types/ifc';

export interface ClashJobUiState {
  /** `idle` before the first run; otherwise the server-reported job status. */
  status: 'idle' | ClashJobStatusValue;
  phase: ClashJobPhase;
  /** Cumulative work units completed. */
  checked: number;
  /** Cumulative work units for the job; `0` until the server knows the model size. */
  total: number;
  /** Server message for a failed job. */
  error: string | null;
  /** True when the job endpoint was missing and the synchronous route was used instead. */
  usedSyncFallback: boolean;
}

const IDLE: ClashJobUiState = Object.freeze({
  status: 'idle',
  phase: 'queued',
  checked: 0,
  total: 0,
  error: null,
  usedSyncFallback: false,
});

let current: ClashJobUiState = IDLE;
const listeners = new Set<() => void>();

export function getClashJobState(): ClashJobUiState {
  return current;
}

export function subscribeClashJobState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setClashJobState(patch: Partial<ClashJobUiState>): void {
  const next: ClashJobUiState = { ...current, ...patch };
  if (
    next.status === current.status &&
    next.phase === current.phase &&
    next.checked === current.checked &&
    next.total === current.total &&
    next.error === current.error &&
    next.usedSyncFallback === current.usedSyncFallback
  ) {
    return;
  }
  current = next;
  listeners.forEach((listener) => listener());
}

export function resetClashJobState(): void {
  setClashJobState(IDLE);
}

/** True while the server is still working on the job. */
export function isClashJobInFlight(state: ClashJobUiState): boolean {
  return state.status === 'queued' || state.status === 'running';
}
