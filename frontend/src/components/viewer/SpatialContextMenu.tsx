import React, { useEffect, useRef } from 'react';
import {
  Focus,
  Copy,
  Trash2,
  SlidersHorizontal,
  Maximize2,
  MousePointer,
  Square,
  Columns
} from 'lucide-react';
import type { CadToolMode } from '../../types/ifc';

export interface SpatialContextMenuProps {
  position: { x: number; y: number } | null;
  expressId: number | null;
  onClose: () => void;
  onFocus: (id: number) => void;
  onClone: (id: number) => void;
  onDelete: (id: number) => void;
  onOpenInspector: () => void;
  onSelectTool?: (tool: CadToolMode) => void;
  onResetView?: () => void;
  onClearSelection?: () => void;
}

export const SpatialContextMenu: React.FC<SpatialContextMenuProps> = ({
  position,
  expressId,
  onClose,
  onFocus,
  onClone,
  onDelete,
  onOpenInspector,
  onSelectTool,
  onResetView,
  onClearSelection,
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
  const x = Math.min(window.innerWidth - 220, Math.max(16, position.x));
  const y = Math.min(window.innerHeight - 260, Math.max(16, position.y));

  return (
    <div
      ref={menuRef}
      data-qa="spatial-context-menu"
      style={{ left: `${x}px`, top: `${y}px` }}
      className="fixed z-50 w-52 rounded-2xl bg-surface-dock/95 backdrop-blur-2xl border border-border-subtle shadow-dock p-1.5 flex flex-col gap-0.5 text-xs text-text-primary select-none animate-in fade-in-50 zoom-in-95 duration-100"
    >
      {expressId !== null ? (
        <>
          {/* Element Header */}
          <div className="px-2.5 py-1.5 text-[10px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border-subtle/40 mb-1 flex items-center justify-between">
            <span>Element Context</span>
            <span className="font-mono text-[9px] text-cyan-400">#{expressId}</span>
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

          {/* Duplicate / Clone */}
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
              <span>Duplicate</span>
            </div>
            <span className="text-[10px] text-text-secondary opacity-60 font-mono">Ctrl+D</span>
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
            onClick={() => {
              onDelete(expressId);
              onClose();
            }}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-red-500/15 text-red-400 hover:text-red-300 transition-colors text-left"
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
