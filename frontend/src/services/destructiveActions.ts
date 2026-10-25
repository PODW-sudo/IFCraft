/**
 * STEP-10 — the single gate every destructive action must pass through.
 *
 * Pure module: no React, no DOM, no API calls. The caller supplies the confirmation
 * transport (a dialog promise, a test spy, …) and the action itself, so the gate can be
 * unit-tested without a browser and reused by the keyboard handler, the viewport context
 * menu and the contextual modify dock.
 *
 * Spec 8: `runDestructiveAction` calls `confirm` exactly once; `false` short-circuits before
 * `action`; a throwing `action` propagates and never reports `applied`.
 * Spec 9: a delete request always names its subject (`label` + express id).
 */

export type DestructiveActionKind = 'delete-element';

export interface DestructiveRequest {
  /** Machine-readable action family; the dialog picks its copy from this. */
  kind: DestructiveActionKind;
  /** The element the action applies to. Never null - an anonymous destructive prompt is a bug. */
  expressId: number;
  /** Human label of the subject, e.g. `Basic Wall:Party Wall:1234`. */
  label: string;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
}

/**
 * Resolves `true` when the user accepted the action. Synchronous implementations are allowed
 * (tests, native `window.confirm`), but the dialog used in the app resolves a promise.
 */
export type DestructiveConfirm = (request: DestructiveRequest) => boolean | Promise<boolean>;

export type DestructiveOutcome<T> = { applied: false } | { applied: true; result: T };

function assertExpressId(expressId: number): number {
  const id = typeof expressId === 'number' ? expressId : Number(expressId);
  if (!Number.isFinite(id) || !Number.isInteger(id)) {
    throw new Error(`destructiveActions: refusing to build a request for an invalid express id (${String(expressId)})`);
  }
  return id;
}

/**
 * Spec 9 — the message contains the element label *and* its express id, and the confirm button
 * reads `Delete`. Throws rather than building an anonymous request.
 */
export function buildDeleteElementRequest(expressId: number, label: string): DestructiveRequest {
  const id = assertExpressId(expressId);
  const name = typeof label === 'string' ? label.trim() : '';
  if (!name) {
    throw new Error(`destructiveActions: refusing to delete element #${id} without a label`);
  }

  const subject = name.includes(`#${id}`) ? name : `${name} (#${id})`;

  return {
    kind: 'delete-element',
    expressId: id,
    label: name,
    title: 'Delete element?',
    message: `Delete ${subject}? The element is removed from the model. Press Ctrl+Z to undo.`,
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel'
  };
}

/**
 * Spec 8 — `confirm` is asked exactly once. Cancelling leaves the model untouched and resolves
 * `{ applied: false }`. A failing action propagates (no `applied` is reported) so the caller can
 * surface the real error instead of pretending the delete happened.
 */
export async function runDestructiveAction<T>(
  request: DestructiveRequest,
  confirm: DestructiveConfirm,
  action: () => T | Promise<T>
): Promise<DestructiveOutcome<T>> {
  const confirmed = await confirm(request);
  if (!confirmed) {
    return { applied: false };
  }

  const result = await action();
  return { applied: true, result };
}
