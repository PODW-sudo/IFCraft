import React, { useState } from 'react';
import {
  AlertTriangle,
  Play,
  X,
  Target,
  CheckCircle2,
  Sliders,
  ArrowRight,
  GripVertical
} from 'lucide-react';
import * as Slider from '@radix-ui/react-slider';
import type { ClashRecord, ClashCheckResponse } from '../../types/ifc';
import { useDraggableHud } from '../hud/HudLayoutContext';

interface ClashInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  clashResult: ClashCheckResponse | null;
  activeClash: ClashRecord | null;
  onSelectClash: (clash: ClashRecord | null) => void;
  onRunClashCheck: (tolerance: number) => Promise<void>;
  isLoading: boolean;
}

export const ClashInspector: React.FC<ClashInspectorProps> = ({
  isOpen,
  onClose,
  clashResult,
  activeClash,
  onSelectClash,
  onRunClashCheck,
  isLoading
}) => {
  const [tolerance, setTolerance] = useState(0.01); // 1cm = 0.01m
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'hard' | 'clearance'>('all');

  const initialWidth = 384;
  const initialHeight = 480;
  const initialX = 24;
  const initialY = typeof window !== 'undefined' ? Math.max(16, window.innerHeight - 560) : 340;

  const { ref, style, dragProps, isDragging } = useDraggableHud('clash-inspector', {
    x: initialX,
    y: initialY,
    width: initialWidth,
    height: initialHeight
  });

  if (!isOpen) return null;

  const clashes = clashResult?.clashes || [];
  const filteredClashes = clashes.filter((c) => {
    if (filterSeverity === 'all') return true;
    return c.severity === filterSeverity;
  });

  return (
    <div
      ref={ref}
      style={style}
      {...dragProps}
      data-qa="clash-inspector-hud"
      role="region"
      aria-label="Spatial Clash Detection Inspector"
      className={`z-40 w-96 max-h-[520px] bg-[var(--dock-bg)] border border-[var(--border-subtle)] rounded-2xl shadow-[var(--shadow-hud)] backdrop-blur-xl p-4 text-slate-100 flex flex-col gap-3 duration-200 transition-shadow ${
        isDragging ? 'shadow-cyan-500/20 ring-1 ring-cyan-500/40 cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
        <div className="flex items-center gap-2">
          {/* Draggable Grip Handle */}
          <div
            data-drag-handle="true"
            className="flex items-center text-slate-500 hover:text-slate-300 pr-0.5 cursor-grab active:cursor-grabbing"
            title="Drag to reposition Clash Inspector"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>
          <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-semibold tracking-tight text-white flex items-center gap-1.5">
              Spatial Clash Inspector
              {clashResult && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {clashResult.total_clashes}
                </span>
              )}
            </h2>
            <p className="text-[10px] text-slate-400">
              Geometric collision analysis across federated models
            </p>
          </div>
        </div>
        <button
          data-qa="clash-close-btn"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[var(--control-hover)] transition-colors"
          title="Close Inspector"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tolerance & Run Action */}
      <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-[var(--control-bg)] border border-[var(--border-subtle)]">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-300 font-medium flex items-center gap-1">
            <Sliders className="w-3 h-3 text-cyan-400" />
            Clearance Tolerance
          </span>
          <span className="font-mono text-cyan-300 font-semibold">
            {(tolerance * 1000).toFixed(0)} mm ({(tolerance).toFixed(3)}m)
          </span>
        </div>

        <Slider.Root
          data-qa="clash-tolerance-slider"
          value={[tolerance]}
          min={0.001}
          max={0.1}
          step={0.005}
          onValueChange={([val]) => setTolerance(val)}
          className="relative flex items-center select-none touch-none w-full h-4"
        >
          <Slider.Track className="bg-[var(--border-subtle)] relative grow rounded-full h-1">
            <Slider.Range className="absolute bg-cyan-400 rounded-full h-full" />
          </Slider.Track>
          <Slider.Thumb className="block w-3.5 h-3.5 bg-white rounded-full shadow hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-400 cursor-grab active:cursor-grabbing" />
        </Slider.Root>

        <button
          data-qa="clash-run-btn"
          onClick={() => onRunClashCheck(tolerance)}
          disabled={isLoading}
          className={`w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors ${
            isLoading
              ? 'bg-cyan-500/20 text-cyan-200 cursor-wait'
              : 'bg-[var(--action-primary)] hover:bg-[var(--action-primary-hover)] text-[var(--action-primary-text)] shadow-sm'
          }`}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{isLoading ? 'Computing Intersections...' : 'Run Clash Detection'}</span>
        </button>
      </div>

      {/* Summary Filter Tabs */}
      {clashResult && (
        <div className="flex items-center justify-between gap-1 text-[10px] font-mono">
          <button
            data-qa="clash-tab-all"
            onClick={() => setFilterSeverity('all')}
            className={`flex-1 py-1 px-2 rounded-lg border text-center transition-colors ${
              filterSeverity === 'all'
                ? 'bg-slate-700/60 text-white border-slate-500'
                : 'border-[var(--border-subtle)] text-slate-400 hover:text-white'
            }`}
          >
            All ({clashResult.total_clashes})
          </button>
          <button
            data-qa="clash-tab-hard"
            onClick={() => setFilterSeverity('hard')}
            className={`flex-1 py-1 px-2 rounded-lg border text-center transition-colors ${
              filterSeverity === 'hard'
                ? 'bg-red-500/20 text-red-300 border-red-500/40 font-bold'
                : 'border-[var(--border-subtle)] text-slate-400 hover:text-red-300'
            }`}
          >
            Hard ({clashResult.hard_clashes})
          </button>
          <button
            data-qa="clash-tab-clearance"
            onClick={() => setFilterSeverity('clearance')}
            className={`flex-1 py-1 px-2 rounded-lg border text-center transition-colors ${
              filterSeverity === 'clearance'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                : 'border-[var(--border-subtle)] text-slate-400 hover:text-amber-300'
            }`}
          >
            Clearance ({clashResult.clearance_clashes})
          </button>
        </div>
      )}

      {/* Clash Cards List */}
      <div className="flex flex-col gap-1.5 overflow-y-auto max-h-56 pr-1">
        {clashes.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400">
            <CheckCircle2 className="w-8 h-8 text-emerald-400/60 mb-2" />
            <span className="text-xs font-medium text-slate-300">
              {clashResult ? 'Zero spatial clashes detected!' : 'No clash check run yet'}
            </span>
            <span className="text-[10px] text-slate-500 mt-1">
              Click &quot;Run Clash Detection&quot; above to inspect geometric intersections.
            </span>
          </div>
        ) : filteredClashes.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400">
            No clashes matching &quot;{filterSeverity}&quot; filter.
          </div>
        ) : (
          filteredClashes.map((c) => {
            const isSelected = activeClash?.id === c.id;
            const isHard = c.severity === 'hard';

            return (
              <div
                key={c.id}
                onClick={() => onSelectClash(isSelected ? null : c)}
                className={`p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-cyan-500/15 border-cyan-400 shadow-md ring-1 ring-cyan-400/40'
                    : 'bg-[var(--control-bg)] border-[var(--border-subtle)] hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${
                        isHard
                          ? 'bg-red-500/20 text-red-300 border-red-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}
                    >
                      {c.severity}
                    </span>
                    <span className="text-[10px] font-mono text-cyan-300">
                      Depth: {(c.distance * 1000).toFixed(0)} mm
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectClash(c);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-cyan-300"
                    title="Focus on collision marker"
                  >
                    <Target className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] gap-2">
                  <div className="flex-1 truncate">
                    <div className="text-white font-medium truncate">{c.element_a_name}</div>
                    <div className="text-[9px] font-mono text-slate-400">
                      #{c.element_a_id} • {c.element_a_type} ({c.discipline_a})
                    </div>
                  </div>

                  <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />

                  <div className="flex-1 truncate text-right">
                    <div className="text-white font-medium truncate">{c.element_b_name}</div>
                    <div className="text-[9px] font-mono text-slate-400">
                      #{c.element_b_id} • {c.element_b_type} ({c.discipline_b})
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {clashResult && (
        <div className="text-[9px] font-mono text-slate-500 text-right pt-1">
          Inspection completed in {clashResult.duration_ms} ms
        </div>
      )}
    </div>
  );
};
