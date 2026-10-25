import React, { useEffect, useRef } from 'react';
import {
  Focus,
  Copy,
  Trash2,
  SlidersHorizontal,
  Maximize2,
  MousePointer,
  Square,
  Columns,
  RotateCw,
  FlipHorizontal,
  Grid3x3,
  AlignHorizontalJustifyCenter,
  Pin,
  PinOff
} from 'lucide-react';
import type { CadToolMode } from '../../types/ifc';
import {
  buildDeleteElementRequest,
  runDestructiveAction
} from '../../services/destructiveActions';
import { requestDestructiveConfirmation } from '../../services/destructiveConfirmation';
import { notifyUser } from '../../services/userMessages';

export interface SpatialContextMenuProps {
  position: { x: number; y: number } | null;
  expressId: number | null;
  isPinned?: boolean;
  /** STEP-10 — used to name the element in the delete confirmation. */
  elementLabel?: string;
  onClose: () => void;
  onFocus: (id: number) => void;
  onClone: (id: number) => void;
  onDelete: (id: number) => void;
  onOpenInspector: () => void;
  onSelectTool?: (tool: CadToolMode) => void;
  onResetView?: () => void;
  onClearSelection?: () => void;
  onTogglePin?: (id: number) => void;
  onRotate?: (id: number, angle_degrees: number, axis: 'x' | 'y' | 'z') => void;
  onMirror?: (id: number, axis: 'x' | 'y' | 'z', is_copy: boolean) => void;
  onArray?: (id: number, count: number, delta: [number, number, number]) => void;
  onAlign?: (id: number, axis: 'x' | 'y' | 'z', target_value?: number) => void;
}

export const SpatialContextMenu: React.FC<SpatialContextMenuProps> = ({
  position,
  expressId,
  isPinned = false,
  elementLabel,
  onClose,
  onFocus,
  onClone,
  onDelete,
  onOpenInspector,
  onSelectTool,
  onResetView,
  onClearSelection,
  onTogglePin,
  onRotate,
  onMirror,
  onArray,
  onAlign,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleDown);
    return () => window.removeEventListener('mousedown', handleDown);
  }, [onClose]);

  if (!position) return null;

  // Clamp within viewport
  const x = Math.min(window.innerWidth - 240, Math.max(16, position.x));
  const y = Math.min(window.innerHeight - 380, Math.max(16, position.y));

  /**
   * STEP-10 Spec 10 — the bin icon goes through the destructive gate. Cancelling (or Escape, or a
   * backdrop click) leaves the model byte-identical because `onDelete` is never called.
   */
  const requestDelete = (id: number) => {
    const label = elementLabel && elementLabel.trim() ? elementLabel.trim() : `Element #${id}`;
    void runDestructiveAction(
      buildDeleteElementRequest(id, label),
      requestDestructiveConfirmation,
      () => onDelete(id)
    ).catch((err: unknown) => {
      const detail = err instanceof Error ? err.message : String(err);
      console.error('[context-menu] delete failed:', err);
      notifyUser({ text: `Could not delete element #${id}: ${detail}`, tone: 'error' });
    });
  };

  return (
    <div
      ref={menuRef}
      data-qa="spatial-context-menu"
      style={{ left: `${x}px`, top: `${y}px` }}
      className="fixed z-50 w-56 rounded-2xl bg-surface-dock/95 backdrop-blur-2xl border border-border-subtle shadow-dock p-1.5 flex flex-col gap-0.5 text-xs text-text-primary select-none animate-in fade-in-50 zoom-in-95 duration-100"
    >
      {expressId !== null ? (
        <>
          {/* Element Header */}
          <div className="px-2.5 py-1.5 text-[10px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border-subtle/40 mb-1 flex items-center justify-between">
            <span>Element Context</span>
            <div className="flex items-center gap-1.5">
              {isPinned && (
                <span className="flex items-center gap-0.5 text-amber-400 font-mono text-[9px]">
                  <Pin size={10} /> PINNED
                </span>
              )}
              <span className="font-mono text-[9px] text-cyan-400">#{expressId}</span>
            </div>
          </div>

          {/* Focus Element */}
          <button
            data-qa="context-focus-btn"
            onClick={() => {
              onFocus(expressId);
              onClose();
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-surface-canvas/60 text-text-primary transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Focus size={14} className="text-cyan-400" />
              <span>Frame in View</span>
            </div>
            <span className="text-[10px] text-text-secondary opacity-60 font-mono">F</span>
          </button>

          {/* Pin / Unpin (PN / UP) */}
          {onTogglePin && (
            <button
              data-qa="context-pin-btn"
              onClick={() => {
                onTogglePin(expressId);
                onClose();
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-surface-canvas/60 text-text-primary transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                {isPinned ? <PinOff size={14} className="text-amber-400" /> : <Pin size={14} className="text-cyan-400" />}
                <span>{isPinned ? 'Unpin Element' : 'Pin Element'}</span>
              </div>
              <span className="text-[10px] text-text-secondary opacity-60 font-mono">{isPinned ? 'UP' : 'PN'}</span>
            </button>
          )}

          {/* Rotate (RO) */}
          {onRotate && (
            <button
              data-qa="context-rotate-btn"
              disabled={isPinned}
              onClick={() => {
                if (isPinned) return;
                onRotate(expressId, 90, 'z');
                onClose();
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-colors text-left ${
                isPinned ? 'opacity-40 cursor-not-allowed text-text-secondary' : 'hover:bg-surface-canvas/60 text-text-primary'
              }`}
            >
              <div className="flex items-center gap-2">
                <RotateCw size={14} className="text-cyan-400" />
                <span>Rotate 90°</span>
              </div>
              <span className="text-[10px] text-text-secondary opacity-60 font-mono">RO</span>
            </button>
          )}

          {/* Mirror (MM) */}
          {onMirror && (
            <button
              data-qa="context-mirror-btn"
              disabled={isPinned}
              onClick={() => {
                if (isPinned) return;
                onMirror(expressId, 'x', true);
                onClose();
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-colors text-left ${
                isPinned ? 'opacity-40 cursor-not-allowed text-text-secondary' : 'hover:bg-surface-canvas/60 text-text-primary'
              }`}
            >
              <div className="flex items-center gap-2">
                <FlipHorizontal size={14} className="text-cyan-400" />
                <span>Mirror Copy</span>
              </div>
              <span className="text-[10px] text-text-secondary opacity-60 font-mono">MM</span>
            </button>
          )}

          {/* Array (AR) */}
          {onArray && (
            <button
              data-qa="context-array-btn"
              onClick={() => {
                onArray(expressId, 3, [2.0, 0, 0]);
                onClose();
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-surface-canvas/60 text-text-primary transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <Grid3x3 size={14} className="text-cyan-400" />
                <span>Linear Array (3x)</span>
              </div>
              <span className="text-[10px] text-text-secondary opacity-60 font-mono">AR</span>
            </button>
          )}

          {/* Align (AL) */}
          {onAlign && (
            <button
              data-qa="context-align-btn"
              disabled={isPinned}
              onClick={() => {
                if (isPinned) return;
                onAlign(expressId, 'z', 0.0);
                onClose();
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-colors text-left ${
                isPinned ? 'opacity-40 cursor-not-allowed text-text-secondary' : 'hover:bg-surface-canvas/60 text-text-primary'
              }`}
            >
              <div className="flex items-center gap-2">
                <AlignHorizontalJustifyCenter size={14} className="text-cyan-400" />
                <span>Align to Ground</span>
              </div>
              <span className="text-[10px] text-text-secondary opacity-60 font-mono">AL</span>
            </button>
          )}

          {/* Duplicate / Clone (CO) */}
          <button
            data-qa="context-clone-btn"
            onClick={() => {
              onClone(expressId);
              onClose();
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-surface-canvas/60 text-text-primary transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Copy size={14} className="text-cyan-400" />
              <span>Duplicate / Copy</span>
            </div>
            <span className="text-[10px] text-text-secondary opacity-60 font-mono">CO</span>
          </button>

          {/* Open Inspector */}
          <button
            data-qa="context-inspector-btn"
            onClick={() => {
              onOpenInspector();
              onClose();
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-surface-canvas/60 text-text-primary transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={14} className="text-cyan-400" />
              <span>Inspect Properties</span>
            </div>
          </button>

          <div className="my-1 border-t border-border-subtle/40" />

          {/* Delete Element (Del) */}
          <button
            data-qa="context-delete-btn"
            disabled={isPinned}
            onClick={() => {
              if (isPinned) return;
              onClose();
              requestDelete(expressId);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-colors text-left ${
              isPinned
                ? 'opacity-40 cursor-not-allowed text-text-secondary'
                : 'hover:bg-red-500/15 text-red-400 hover:text-red-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Trash2 size={14} />
              <span>Delete Element</span>
            </div>
            <span className="text-[10px] opacity-70 font-mono">Del</span>
          </button>
        </>
      ) : (
        <>
          {/* Viewport Header */}
          <div className="px-2.5 py-1.5 text-[10px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border-subtle/40 mb-1">
            Viewport Actions
          </div>

          {/* Frame All */}
          {onResetView && (
            <button
              onClick={() => {
                onResetView();
                onClose();
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-surface-canvas/60 text-text-primary transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <Maximize2 size={14} className="text-cyan-400" />
                <span>Reset View</span>
              </div>
            </button>
          )}

          {/* CAD Creation Shortcuts */}
          {onSelectTool && (
            <>
              <button
                onClick={() => {
                  onSelectTool('wall');
                  onClose();
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-surface-canvas/60 text-text-primary transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <Square size={14} className="rotate-45 text-cyan-400" />
                  <span>Draw Wall</span>
                </div>
                <span className="text-[10px] text-text-secondary opacity-60 font-mono">W</span>
              </button>

              <button
                onClick={() => {
                  onSelectTool('slab');
                  onClose();
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-surface-canvas/60 text-text-primary transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <Square size={14} className="text-cyan-400" />
                  <span>Draw Slab</span>
                </div>
                <span className="text-[10px] text-text-secondary opacity-60 font-mono">S</span>
              </button>

              <button
                onClick={() => {
                  onSelectTool('column');
                  onClose();
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-surface-canvas/60 text-text-primary transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <Columns size={14} className="text-cyan-400" />
                  <span>Place Column</span>
                </div>
                <span className="text-[10px] text-text-secondary opacity-60 font-mono">C</span>
              </button>
            </>
          )}

          {onClearSelection && (
            <button
              onClick={() => {
                onClearSelection();
                onClose();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-surface-canvas/60 text-text-secondary hover:text-text-primary transition-colors text-left mt-1 border-t border-border-subtle/30"
            >
              <MousePointer size={14} />
              <span>Deselect All</span>
            </button>
          )}
        </>
      )}
    </div>
  );
};
