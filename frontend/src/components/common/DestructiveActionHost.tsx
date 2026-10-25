import React, { useSyncExternalStore } from 'react';
import { ConfirmDestructiveDialog } from './ConfirmDestructiveDialog';
import {
  getPendingDestructiveRequest,
  resolveDestructiveConfirmation,
  subscribeDestructiveConfirmation
} from '../../services/destructiveConfirmation';

/**
 * STEP-10 — mounts the single destructive confirmation dialog for the whole app.
 *
 * Mounted once in `main.tsx` so the keyboard handler, the viewport context menu and the contextual
 * modify dock all resolve against the same dialog without prop plumbing through `App.tsx`.
 */
export const DestructiveActionHost: React.FC = () => {
  const pending = useSyncExternalStore(
    subscribeDestructiveConfirmation,
    getPendingDestructiveRequest,
    getPendingDestructiveRequest
  );

  return (
    <ConfirmDestructiveDialog
      request={pending}
      onConfirm={() => resolveDestructiveConfirmation(true)}
      onCancel={() => resolveDestructiveConfirmation(false)}
    />
  );
};

export default DestructiveActionHost;
