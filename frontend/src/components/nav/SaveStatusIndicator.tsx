import React from 'react';
import { AlertTriangle, CheckCircle2, CloudUpload, Dot } from 'lucide-react';

import { useSaveStatus } from '../../hooks/useSaveStatus';
import type { SaveStatus } from '../../services/saveStatus';

/**
 * STEP-28 / F-050 - "did that edit actually get written?"
 *
 * Reports the HTTP outcome of element writes (see `services/saveStatus.ts`): it is
 * *not* a verification that the backend kept the change, and it never triggers a save
 * itself. `idle` reads "Up to date" rather than "Saved" because nothing was written yet
 * in this session.
 */

const LABELS: Record<SaveStatus, string> = {
  idle: 'Up to date',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed'
};

const TONE: Record<SaveStatus, string> = {
  idle: 'text-[var(--text-secondary)] border-transparent',
  saving: 'text-sky-600 dark:text-sky-300 border-sky-500/30 bg-sky-500/10',
  saved: 'text-emerald-600 dark:text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  error: 'text-rose-600 dark:text-rose-300 border-rose-500/40 bg-rose-500/10'
};

function StatusIcon({ status }: { status: SaveStatus }) {
  if (status === 'saving') return <CloudUpload className="w-3.5 h-3.5 animate-pulse" aria-hidden="true" />;
  if (status === 'saved') return <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />;
  if (status === 'error') return <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />;
  return <Dot className="w-4 h-4" aria-hidden="true" />;
}

export const SaveStatusIndicator: React.FC = () => {
  const { status, lastSavedAt, error } = useSaveStatus();

  const title = [
    lastSavedAt ? `Last write accepted at ${lastSavedAt.toISOString()}` : 'No writes yet this session',
    error ? `Last error: ${error}` : null
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <span
      role="status"
      aria-live="polite"
      data-qa="save-status"
      data-state={status}
      title={title}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-medium select-none transition-colors ${TONE[status]}`}
    >
      <StatusIcon status={status} />
      <span>{LABELS[status]}</span>
    </span>
  );
};

export default SaveStatusIndicator;
