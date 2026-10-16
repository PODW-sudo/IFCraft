import React from 'react';
import type { XeokitAnnotationRecord } from '../../types/viewport';
import { MapPin, Plus, Trash2, Camera, ExternalLink, X } from 'lucide-react';

interface AnnotationsHudProps {
  annotations: XeokitAnnotationRecord[];
  isAnnotateMode: boolean;
  onToggleAnnotateMode: () => void;
  onSelectAnnotation: (id: string) => void;
  onDeleteAnnotation: (id: string) => void;
  onConvertToBcf?: (annotation: XeokitAnnotationRecord) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const AnnotationsHud: React.FC<AnnotationsHudProps> = ({
  annotations,
  isAnnotateMode,
  onToggleAnnotateMode,
  onSelectAnnotation,
  onDeleteAnnotation,
  onConvertToBcf,
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  const getPriorityBadgeClass = (priority: XeokitAnnotationRecord['priority']) => {
    switch (priority) {
      case 'critical':
        return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
      case 'high':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'medium':
        return 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30';
      case 'low':
      default:
        return 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div
      data-qa="annotations-hud"
      className="absolute top-16 right-6 z-30 w-84 rounded-2xl p-4 glass-card bg-[var(--glass-surface-panel)] backdrop-blur-2xl border border-[var(--glass-border)] shadow-2xl animate-in fade-in slide-in-from-top-2 text-slate-800 dark:text-slate-100"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
              3D Annotations
            </h3>
            <p className="text-[10px] text-[var(--text-secondary)]">
              Xeokit Spatial Pins & Issue Markers
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--control-hover)] transition-colors cursor-pointer"
          title="Close Annotations Panel"
          data-qa="annotations-hud-close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Action Toolbar */}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onToggleAnnotateMode}
          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            isAnnotateMode
              ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md'
              : 'bg-[var(--control-bg)] hover:bg-[var(--control-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
          }`}
          data-qa="toggle-annotate-mode-btn"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isAnnotateMode ? 'Click on Model to Drop Pin' : 'Add Spatial Pin'}</span>
        </button>
      </div>

      {/* Annotations List */}
      <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
        {annotations.length === 0 ? (
          <div className="p-4 text-center text-xs text-[var(--text-secondary)]">
            No spatial pins recorded. Click Add Spatial Pin and select any point on the BIM model.
          </div>
        ) : (
          annotations.map((ann) => (
            <div
              key={ann.id}
              data-qa={`annotation-card-${ann.id}`}
              className="p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--control-bg)] hover:border-[var(--border-strong)] transition-all space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--text-primary)] line-clamp-1">
                  {ann.title}
                </span>
                <span
                  className={`text-[9px] uppercase px-1.5 py-0.5 rounded-md border font-mono ${getPriorityBadgeClass(
                    ann.priority
                  )}`}
                >
                  {ann.priority}
                </span>
              </div>

              {ann.description && (
                <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2">
                  {ann.description}
                </p>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)] text-[10px] text-[var(--text-muted)] font-mono">
                <span>
                  [{ann.worldPos[0].toFixed(1)}, {ann.worldPos[1].toFixed(1)}, {ann.worldPos[2].toFixed(1)}]
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onSelectAnnotation(ann.id)}
                    title="Fly camera to annotation"
                    className="p-1 rounded bg-[var(--control-hover)] text-[var(--text-primary)] hover:text-cyan-500 transition-colors cursor-pointer"
                    data-qa={`fly-to-annotation-${ann.id}`}
                  >
                    <Camera className="w-3 h-3" />
                  </button>
                  {onConvertToBcf && (
                    <button
                      onClick={() => onConvertToBcf(ann)}
                      title="Convert to BCF Topic"
                      className="p-1 rounded bg-[var(--control-hover)] text-[var(--text-primary)] hover:text-amber-500 transition-colors cursor-pointer"
                      data-qa={`convert-bcf-annotation-${ann.id}`}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={() => onDeleteAnnotation(ann.id)}
                    title="Delete annotation"
                    className="p-1 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                    data-qa={`delete-annotation-${ann.id}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
