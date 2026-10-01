import React from 'react';
import { Box, Compass } from 'lucide-react';

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

  const leftPosition = isTreeOpen ? `${treeWidth + 24}px` : '1.5rem';

  return (
    <div
      style={{ left: leftPosition }}
      className="fixed bottom-6 z-20 pointer-events-none select-none flex flex-col gap-2 transition-[left] duration-200"
    >
      {/* Active Element & Signed Coordinate Readout */}
      {selectedExpressID !== null && (
        <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-[var(--dock-translucent)] backdrop-blur-xl border border-[var(--border-subtle)] shadow-[var(--shadow-hud)] text-xs pointer-events-auto">
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
