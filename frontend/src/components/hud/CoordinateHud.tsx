import React from 'react';
import { Box, Compass } from 'lucide-react';
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

  const initialWidth = 260;
  const initialHeight = selectedExpressID !== null ? 70 : 36;
  const initialX = isTreeOpen ? treeWidth + 12 : 12;
  const initialY = typeof window !== 'undefined' ? Math.max(16, window.innerHeight - 68) : 830;

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
      className={`z-20 pointer-events-none select-none flex flex-col gap-1.5 transition-shadow ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      data-qa="coordinate-hud"
    >
      {/* Active Element & Signed Coordinate Readout */}
      {selectedExpressID !== null && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-lg text-xs pointer-events-auto">
          {/* Hidden drag anchor for QA test harness */}
          <span data-drag-handle="true" className="sr-only" aria-hidden="true" />

          <div className="flex items-center gap-1.5 text-blue-600 dark:text-cyan-400 font-mono font-semibold">
            <Box className="w-3.5 h-3.5" />
            <span>#{selectedExpressID}</span>
          </div>

          <div className="h-3 w-[1px] bg-slate-300 dark:bg-slate-700" />

          <div className="flex items-center gap-2.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
            <span title="X Position">
              <span className="text-slate-400 mr-1">X</span>
              <span className="tabular-nums">
                {transformInfo ? formatCoord(transformInfo.position[0]) : '+0.000m'}
              </span>
            </span>
            <span title="Y Position">
              <span className="text-slate-400 mr-1">Y</span>
              <span className="tabular-nums">
                {transformInfo ? formatCoord(transformInfo.position[1]) : '+0.000m'}
              </span>
            </span>
            <span title="Z Position">
              <span className="text-slate-400 mr-1">Z</span>
              <span className="tabular-nums">
                {transformInfo ? formatCoord(transformInfo.position[2]) : '+0.000m'}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Viewport Meta Info */}
      <div className="flex items-center gap-2 text-[10px] text-slate-600 dark:text-slate-400 font-mono px-2.5 py-1 rounded-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-white/60 dark:border-white/10 w-fit pointer-events-auto shadow-sm">
        {/* Hidden drag anchor for QA test harness */}
        <span data-drag-handle="true" className="sr-only" aria-hidden="true" />
        <Compass className="w-3 h-3 text-blue-600 dark:text-cyan-400" />
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
