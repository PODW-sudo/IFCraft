/**
 * STEP-10 — app-wide confirmation bridge.
 *
 * `runDestructiveAction` takes a `DestructiveConfirm` transport. The app needs exactly one
 * dialog for every trigger (keyboard, context menu, ribbon), so the transport is this tiny store:
 * callers await `requestDestructiveConfirmation(request)` and the single `DestructiveActionHost`
 * mounted in `main.tsx` renders the dialog and resolves the promise.
 *
 * Fail-safe: if no host is listening, the request resolves `false`, so a delete can never happen
 * without a working prompt.
 */

import type { DestructiveRequest } from './destructiveActions';

type Resolver = (confirmed: boolean) => void;

let pending: DestructiveRequest | null = null;
let pendingResolver: Resolver | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

/** Ask the user to confirm `request`. Resolves `false` for cancel, unmount or a missing host. */
export function requestDestructiveConfirmation(request: DestructiveRequest): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    // One prompt at a time: an older pending request is cancelled, never silently dropped.
    if (pendingResolver) {
      const previous = pendingResolver;
      pendingResolver = null;
      pending = null;
      previous(false);
    }

    if (listeners.size === 0) {
      console.warn(
        '[destructive] no confirmation host is mounted - refusing to perform the action'
      );
      resolve(false);
      return;
    }

    pending = request;
    pendingResolver = resolve;
    emit();
  });
}

/** Called by the dialog: `true` = user accepted, `false` = cancel/Escape/backdrop. */
export function resolveDestructiveConfirmation(confirmed: boolean): void {
  const resolve = pendingResolver;
  pendingResolver = null;
  pending = null;
  emit();
  resolve?.(confirmed);
}

export function getPendingDestructiveRequest(): DestructiveRequest | null {
  return pending;
}

export function subscribeDestructiveConfirmation(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
