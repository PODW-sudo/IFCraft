import React, { useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';

import { SHORTCUTS, formatShortcut, type ShortcutDef, type ShortcutGroup } from '../../services/shortcuts';
import { useFocusTrap } from '../../hooks/useFocusTrap';

/**
 * STEP-28 / F-048 - the discovered-once shortcut list.
 *
 * Renders the registry, grouped, with `formatShortcut()` labels. Deliberately a plain
 * `<div role="dialog">` (no Radix) so the legend has no portal/portal-focus quirks and can
 * be unit-tested next to its registry.
 *
 * Opened by `?` (see `App.tsx` dispatch) or by the header help button; closed by `Escape`,
 * the close button, or a click on the backdrop.
 */

const GROUP_ORDER: readonly ShortcutGroup[] = ['Navigation', 'Editing', 'View', 'Tools'];

interface ShortcutLegendProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutLegend: React.FC<ShortcutLegendProps> = ({ isOpen, onClose }) => {
  const { ref, onKeyDown } = useFocusTrap<HTMLDivElement>(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    // Capture phase so the legend closes before any other window-level Escape handler
    // (App.tsx clears the selection, ThreeViewport cancels a tool).
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' && event.code !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    entries: SHORTCUTS.filter((shortcut) => shortcut.group === group)
  })).filter((section) => section.entries.length > 0);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
      data-qa="shortcut-legend-overlay"
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-legend-title"
        data-qa="shortcut-legend"
        onKeyDown={onKeyDown}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-[var(--dock-translucent)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl"
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 min-h-11 min-w-11 flex items-center justify-center rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-500 dark:text-sky-400">
              <Keyboard className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="shortcut-legend-title"
                className="text-sm font-semibold text-[var(--text-primary)] tracking-tight"
              >
                Keyboard shortcuts
              </h2>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Press ? anywhere to reopen this list
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            data-qa="close-shortcut-legend-btn"
            className="p-1.5 min-h-11 min-w-11 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--control-hover)] dark:hover:text-[var(--text-primary)] dark:hover:bg-[var(--control-hover)] transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {grouped.map(({ group, entries }) => (
            <section key={group}>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                {group}
              </h3>
              <dl className="space-y-1.5">
                {entries.map((shortcut) => (
                  <ShortcutRow key={shortcut.id} shortcut={shortcut} />
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};

function ShortcutRow({ shortcut }: { shortcut: ShortcutDef }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-xs text-[var(--text-secondary)]">
        {shortcut.label}
        {shortcut.requiresSelection && (
          <span className="ml-1.5 text-[10px] text-[var(--text-muted)]">(with a selection)</span>
        )}
      </dt>
      <dd className="shrink-0">
        <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--control-bg)] border border-[var(--border-subtle)] text-[var(--text-secondary)] dark:text-[var(--text-primary)]">
          {formatShortcut(shortcut)}
        </kbd>
      </dd>
    </div>
  );
}

export default ShortcutLegend;
