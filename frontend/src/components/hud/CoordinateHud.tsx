import React from 'react';
import { Box, Compass, GripVertical } from 'lucide-react';
import { useDraggableHud } from './HudLayoutContext';

interface CoordinateHudProps {
  selectedExpressID: number | null;
  transformInfo: {
    position: [number, number, number];
    rotation: [number, number, number];
  } | null;
  elementCount: number;
  isTreeOpen?: boolean;
  treeWidth?: number;
}

export const CoordinateHud: React.FC<CoordinateHudProps> = ({
  selectedExpressID,
  transformInfo,
  elementCount,
  isTreeOpen = false,
  treeWidth = 288
}) => {
  const formatCoord = (val: number) => {
    const sign = val >= 0 ? '+' : '';
    return `${sign}${val.toFixed(3)}m`;
  };

  const initialWidth = 300;
  const initialHeight = selectedExpressID !== null ? 80 : 36;
  const initialX = isTreeOpen ? treeWidth + 24 : 24;
  const initialY = typeof window !== 'undefined' ? Math.max(16, window.innerHeight - 90) : 810;

  const { ref, style, dragProps, isDragging } = useDraggableHud('coord-hud', {
    x: initialX,
    y: initialY,
    width: initialWidth,
    height: initialHeight
  });

  return (
    <div
      ref={ref}
      style={style}
      {...dragProps}
      className={`z-20 pointer-events-none select-none flex flex-col gap-2 transition-shadow ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      data-qa="coordinate-hud"
    >
      {/* Active Element & Signed Coordinate Readout */}
      {selectedExpressID !== null && (
        <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-[var(--dock-translucent)] backdrop-blur-xl border border-[var(--border-subtle)] shadow-[var(--shadow-hud)] text-xs pointer-events-auto">
          {/* Draggable Grip Handle */}
          <div
            data-drag-handle="true"
            className="flex items-center text-slate-500 hover:text-slate-300 pr-1 py-1 cursor-grab active:cursor-grabbing"
            title="Drag to reposition Coordinate HUD"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>

          <div className="flex items-center gap-1.5 text-cyan-400 font-mono font-semibold">
            <Box className="w-3.5 h-3.5" />
            <span>#{selectedExpressID}</span>
          </div>

          <div className="h-3 w-[1px] bg-[var(--border-subtle)]" />

          <div className="flex items-center gap-2.5 font-mono text-[11px] text-slate-300">
            <span title="X Position">
              <span className="text-slate-500 mr-1">X</span>
              <span className="tabular-nums">
                {transformInfo ? formatCoord(transformInfo.position[0]) : '+0.000m'}
              </span>
            </span>
            <span title="Y Position">
              <span className="text-slate-500 mr-1">Y</span>
              <span className="tabular-nums">
                {transformInfo ? formatCoord(transformInfo.position[1]) : '+0.000m'}
              </span>
            </span>
            <span title="Z Position">
              <span className="text-slate-500 mr-1">Z</span>
              <span className="tabular-nums">
                {transformInfo ? formatCoord(transformInfo.position[2]) : '+0.000m'}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Viewport Meta Info */}
      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono px-2.5 py-1 rounded-md bg-[var(--dock-translucent)] backdrop-blur-md border border-[var(--border-subtle)]/60 w-fit pointer-events-auto shadow-sm">
        <div
          data-drag-handle="true"
          className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 pr-0.5"
          title="Drag to reposition Coordinate HUD"
        >
          <GripVertical className="w-3 h-3" />
        </div>
        <Compass className="w-3 h-3 text-cyan-400" />
        <span>{elementCount} meshes</span>
        {!isTreeOpen && (
          <>
            <span className="text-slate-600">|</span>
            <span className="text-slate-300">OpenBIM Canvas</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">Ctrl+K for Omnibar</span>
          </>
        )}
      </div>
    </div>
  );
};
