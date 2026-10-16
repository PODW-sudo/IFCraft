import React from 'react';
import type { StoreyViewRecord } from '../../types/viewport';
import { Building2, Eye, EyeOff, Compass, X } from 'lucide-react';

interface StoreyNavigatorHudProps {
  storeys: StoreyViewRecord[];
  activeStoreyId: string | null;
  onSelectStorey: (storeyId: string) => void;
  isolatedStoreyId: string | null;
  onToggleIsolateStorey: (storeyId: string) => void;
  onClearStoreyIsolation: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const StoreyNavigatorHud: React.FC<StoreyNavigatorHudProps> = ({
  storeys,
  activeStoreyId,
  onSelectStorey,
  isolatedStoreyId,
  onToggleIsolateStorey,
  onClearStoreyIsolation,
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div
      data-qa="storey-navigator-hud"
      className="absolute top-16 left-6 z-30 w-80 rounded-2xl p-4 glass-card bg-[var(--glass-surface-panel)] backdrop-blur-2xl border border-[var(--glass-border)] shadow-2xl animate-in fade-in slide-in-from-top-2 text-slate-800 dark:text-slate-100"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
              Storey Views
            </h3>
            <p className="text-[10px] text-[var(--text-secondary)]">
              Xeokit Floor Plans & Mini-Maps
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--control-hover)] transition-colors cursor-pointer"
          title="Close Storey Navigator"
          data-qa="storey-navigator-close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Storey List */}
      <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
        {storeys.length === 0 ? (
          <div className="p-4 text-center text-xs text-[var(--text-secondary)]">
            No building storeys detected in active model.
          </div>
        ) : (
          storeys.map((st) => {
            const isActive = activeStoreyId === st.id;
            const isIsolated = isolatedStoreyId === st.id;

            return (
              <div
                key={st.id}
                data-qa={`storey-item-${st.id}`}
                className={`p-2.5 rounded-xl border transition-all ${
                  isActive
                    ? 'bg-cyan-500/15 border-cyan-500/50 shadow-xs'
                    : 'bg-[var(--control-bg)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-[var(--text-primary)]">
                      {st.name}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--text-secondary)]">
                      Elevation: {st.elevation >= 0 ? `+${st.elevation.toFixed(2)}m` : `${st.elevation.toFixed(2)}m`}
                      {st.elementCount > 0 && ` | ${st.elementCount} elements`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onSelectStorey(st.id)}
                      title="Plan View (Top-Down Ortho)"
                      className="p-1.5 rounded-lg bg-[var(--control-hover)] hover:bg-cyan-500/20 text-[var(--text-primary)] hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors cursor-pointer"
                      data-qa={`storey-plan-btn-${st.id}`}
                    >
                      <Compass className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onToggleIsolateStorey(st.id)}
                      title={isIsolated ? 'Clear Storey Isolation' : 'Isolate Storey'}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        isIsolated
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40'
                          : 'bg-[var(--control-hover)] hover:bg-slate-200 dark:hover:bg-slate-700 text-[var(--text-secondary)]'
                      }`}
                      data-qa={`storey-isolate-btn-${st.id}`}
                    >
                      {isIsolated ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Controls */}
      {isolatedStoreyId && (
        <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between">
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
            Storey Isolated
          </span>
          <button
            onClick={onClearStoreyIsolation}
            className="text-[10px] px-2 py-1 rounded-lg bg-[var(--control-bg)] hover:bg-[var(--control-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
            data-qa="clear-storey-isolation-btn"
          >
            Show Full Model
          </button>
        </div>
      )}
    </div>
  );
};
