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
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl"
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200/80 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 min-h-11 min-w-11 flex items-center justify-center rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-500 dark:text-sky-400">
              <Keyboard className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="shortcut-legend-title"
                className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight"
              >
                Keyboard shortcuts
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Press ? anywhere to reopen this list
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            data-qa="close-shortcut-legend-btn"
            className="p-1.5 min-h-11 min-w-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {grouped.map(({ group, entries }) => (
            <section key={group}>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
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
      <dt className="text-xs text-slate-700 dark:text-slate-300">
        {shortcut.label}
        {shortcut.requiresSelection && (
          <span className="ml-1.5 text-[10px] text-slate-400 dark:text-slate-500">(with a selection)</span>
        )}
      </dt>
      <dd className="shrink-0">
        <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-200">
          {formatShortcut(shortcut)}
        </kbd>
      </dd>
    </div>
  );
}

export default ShortcutLegend;
