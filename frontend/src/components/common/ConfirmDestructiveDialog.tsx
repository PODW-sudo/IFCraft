import React, { useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useModalFocusTrap } from '../../hooks/modalFocus';
import type { DestructiveRequest } from '../../services/destructiveActions';

/**
 * STEP-10 — the one dialog every destructive action goes through.
 *
 * Contract:
 * - `role="alertdialog"` + `aria-modal`, labelled/described by its own copy
 * - focus moves to **Cancel** on open (the safe default) and returns to the trigger on close
 * - `Escape`, the backdrop and Cancel all reject; only the destructive button accepts
 * - `data-qa="confirm-destructive"` (+ `-ok` / `-cancel` / `-message`) for the QA harness
 *
 * Visual treatment is @designer-owned: the tokens below reuse the existing dock surface, HUD shadow
 * and rose "danger" accent already used by the ribbon's delete button — no new palette was invented.
 */
export interface ConfirmDestructiveDialogProps {
  request: DestructiveRequest | null;
  onConfirm: () => void;
  onCancel: () => void;
  /** Optional extra context (e.g. the backend error that made the retry necessary). */
  detail?: string;
}

export const ConfirmDestructiveDialog: React.FC<ConfirmDestructiveDialogProps> = ({
  request,
  onConfirm,
  onCancel,
  detail
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const isOpen = request !== null;

  // Escape + Tab cycling + focus restore. Cancel is the first focusable, so it receives focus.
  useModalFocusTrap(dialogRef, { active: isOpen, onEscape: onCancel });

  if (!request) return null;

  return (
    <div
      data-qa="confirm-destructive-backdrop"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in-50 duration-100"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-destructive-title"
        aria-describedby="confirm-destructive-message"
        data-qa="confirm-destructive"
        data-qa-kind={request.kind}
        data-qa-express-id={request.expressId}
        className="w-full max-w-md rounded-2xl bg-[var(--dock-bg)] border border-rose-500/40 text-[var(--text-primary)] shadow-[var(--shadow-hud)] backdrop-blur-md p-5 select-none"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-400">
            <AlertTriangle size={16} />
          </span>
          <div className="min-w-0">
            <h2
              id="confirm-destructive-title"
              className="text-sm font-semibold tracking-tight text-[var(--text-primary)]"
            >
              {request.title}
            </h2>
            <p
              id="confirm-destructive-message"
              data-qa="confirm-destructive-message"
              className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)] break-words"
            >
              {request.message}
            </p>
            {detail && (
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-secondary)] break-words">{detail}</p>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            data-qa="confirm-destructive-cancel"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-xl text-xs font-medium text-[var(--text-primary)] bg-[var(--control-bg)]/60 hover:bg-[var(--control-bg)] transition-colors cursor-pointer"
          >
            {request.cancelLabel}
          </button>
          <button
            type="button"
            data-qa="confirm-destructive-ok"
            onClick={onConfirm}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors cursor-pointer"
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDestructiveDialog;
