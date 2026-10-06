import React, { useState } from 'react';
import { Ruler, X, Copy, Check, GripVertical, Trash2, ArrowRight } from 'lucide-react';
import { useDraggableHud } from './HudLayoutContext';
import type { MeasurementRecord } from '../viewer/ThreeViewport';

export interface DimensionInfoHudProps {
  measurement: MeasurementRecord | null;
  onClose: () => void;
  onDelete?: (id: string) => void;
}

export const DimensionInfoHud: React.FC<DimensionInfoHudProps> = ({
  measurement,
  onClose,
  onDelete
}) => {
  const [copied, setCopied] = useState(false);

  // Position at upper-right below ViewControlsHud or near center-right
  const initialWidth = 280;
  const initialHeight = 240;
  const initialX = typeof window !== 'undefined' ? Math.max(16, window.innerWidth - 320) : 1120;
  const initialY = 130;

  const { ref, style, dragProps, isDragging } = useDraggableHud('dimension-info-hud', {
    x: initialX,
    y: initialY,
    width: initialWidth,
    height: initialHeight
  });

  if (!measurement) return null;

  const dx = measurement.end[0] - measurement.start[0];
  const dy = measurement.end[1] - measurement.start[1];
  const dz = measurement.end[2] - measurement.start[2];
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const absDz = Math.abs(dz);
  const horizontalDist = Math.hypot(dx, dz);

  const handleCopy = () => {
    const text = `Distance: ${measurement.distance.toFixed(3)}m (dX: ${absDx.toFixed(3)}m, dY: ${absDy.toFixed(3)}m, dZ: ${absDz.toFixed(3)}m, dXZ: ${horizontalDist.toFixed(3)}m)`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };


  return (
    <div
      ref={ref}
      style={style}
      {...dragProps}
      className={`z-30 select-none flex flex-col rounded-2xl bg-[var(--dock-translucent)] backdrop-blur-2xl border border-[var(--border-subtle)] shadow-[var(--shadow-hud)] text-xs text-slate-200 overflow-hidden w-[280px] transition-shadow ${
        isDragging ? 'cursor-grabbing' : 'cursor-default'
      }`}
      data-qa="dimension-info-hud"
      data-distance={measurement.distance.toFixed(3)}
      data-delta-x={absDx.toFixed(3)}
      data-delta-y={absDy.toFixed(3)}
      data-delta-z={absDz.toFixed(3)}
    >
      {/* Header with Drag Handle & Close */}
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--control-bg)]/40 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <div
            data-drag-handle="true"
            className="text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing p-0.5"
            title="Drag to reposition Dimension Info"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-1.5 text-cyan-400 font-medium">
            <Ruler className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold tracking-wide">Dimension Details</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onDelete && (
            <button
              data-qa="dimension-delete-btn"
              onClick={() => onDelete(measurement.id)}
              className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Delete this measurement"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
          <button
            data-qa="dimension-close-btn"
            onClick={onClose}
            className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-[var(--control-hover)] transition-colors cursor-pointer"
            title="Close details (ESC)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Total Distance Readout */}
      <div className="px-3.5 pt-3 pb-2 flex items-baseline justify-between border-b border-[var(--border-subtle)]/50">
        <div>
          <div className="text-[10px] font-mono uppercase text-slate-400 font-semibold tracking-wider">
            3D Distance (Euclidean)
          </div>
          <div className="text-xl font-mono font-bold text-cyan-300 tracking-tight flex items-baseline gap-1.5">
            <span>{measurement.distance.toFixed(3)}</span>
            <span className="text-xs font-normal text-slate-400">m</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-mono text-slate-500">Millimeters</div>
          <div className="text-xs font-mono font-medium text-slate-300">
            {(measurement.distance * 1000).toFixed(0)} mm
          </div>
        </div>
      </div>

      {/* Exact XYZ Deltas Breakdown */}
      <div className="p-3 flex flex-col gap-2">
        <div className="text-[10px] font-mono uppercase text-slate-400 font-semibold tracking-wider">
          Exact XYZ Deltas
        </div>
        <div className="grid grid-cols-3 gap-1.5 font-mono text-[11px]">
          {/* Delta X */}
          <div className="flex flex-col p-1.5 rounded-lg bg-[var(--control-bg)]/30 border border-rose-500/30">
            <span className="text-[10px] text-rose-400 font-semibold flex items-center justify-between">
              <span>ΔX</span>
              <span className="text-[9px] text-slate-500">{dx >= 0 ? '+X' : '-X'}</span>
            </span>
            <span className="text-slate-100 font-bold tabular-nums">
              {absDx.toFixed(3)}m
            </span>
          </div>

          {/* Delta Y (Elevation / Height) */}
          <div className="flex flex-col p-1.5 rounded-lg bg-[var(--control-bg)]/30 border border-emerald-500/30">
            <span className="text-[10px] text-emerald-400 font-semibold flex items-center justify-between">
              <span>ΔY</span>
              <span className="text-[9px] text-slate-500">{dy >= 0 ? '+Y' : '-Y'}</span>
            </span>
            <span className="text-slate-100 font-bold tabular-nums">
              {absDy.toFixed(3)}m
            </span>
          </div>

          {/* Delta Z */}
          <div className="flex flex-col p-1.5 rounded-lg bg-[var(--control-bg)]/30 border border-sky-500/30">
            <span className="text-[10px] text-sky-400 font-semibold flex items-center justify-between">
              <span>ΔZ</span>
              <span className="text-[9px] text-slate-500">{dz >= 0 ? '+Z' : '-Z'}</span>
            </span>
            <span className="text-slate-100 font-bold tabular-nums">
              {absDz.toFixed(3)}m
            </span>
          </div>
        </div>

        {/* Plan / Horizontal Offset */}
        <div className="flex items-center justify-between px-2 py-1 rounded bg-[var(--control-bg)]/20 text-[10px] font-mono text-slate-400">
          <span>Horizontal ΔXZ (Plan):</span>
          <span className="text-slate-200 font-semibold">{horizontalDist.toFixed(3)} m</span>
        </div>

        {/* Start / End Points Trajectory */}
        <div className="flex flex-col gap-1 text-[10px] font-mono bg-[var(--dock-bg)]/60 p-2 rounded-lg border border-[var(--border-subtle)]/40 text-slate-400">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">P1 Start:</span>
            <span className="text-slate-300">
              ({measurement.start[0].toFixed(2)}, {measurement.start[1].toFixed(2)}, {measurement.start[2].toFixed(2)})
            </span>
          </div>
          <div className="flex items-center justify-center text-slate-600">
            <ArrowRight className="w-3 h-3" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">P2 End:</span>
            <span className="text-slate-300">
              ({measurement.end[0].toFixed(2)}, {measurement.end[1].toFixed(2)}, {measurement.end[2].toFixed(2)})
            </span>
          </div>
        </div>
      </div>

      {/* Footer Quick Action: Copy Deltas */}
      <div className="px-3 py-2 bg-[var(--control-bg)]/20 border-t border-[var(--border-subtle)]/60 flex items-center justify-end">
        <button
          data-qa="dimension-copy-btn"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-medium text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-colors cursor-pointer"
          title="Copy measurements and XYZ deltas to clipboard"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy XYZ Deltas'}</span>
        </button>
      </div>
    </div>
  );
};
