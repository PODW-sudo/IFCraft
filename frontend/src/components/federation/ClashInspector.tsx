import React, { useState } from 'react';
import {
  AlertTriangle,
  Play,
  X,
  Target,
  CheckCircle2,
  Sliders,
  ArrowRight
} from 'lucide-react';
import * as Slider from '@radix-ui/react-slider';
import type { ClashRecord, ClashCheckResponse } from '../../types/ifc';

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

  if (!isOpen) return null;

  const clashes = clashResult?.clashes || [];
  const filteredClashes = clashes.filter((c) => {
    if (filterSeverity === 'all') return true;
    return c.severity === filterSeverity;
  });

  return (
    <div
      data-qa="clash-inspector-hud"
      role="region"
      aria-label="Spatial Clash Detection Inspector"
      className="fixed top-20 left-6 z-40 w-96 max-h-[520px] bg-white/85 dark:bg-slate-900/85 border border-white/60 dark:border-white/10 rounded-2xl shadow-2xl backdrop-blur-2xl p-4 text-slate-800 dark:text-slate-100 flex flex-col gap-3 duration-200 transition-shadow select-none cursor-default"
    >
      <span data-drag-handle="true" className="sr-only" aria-hidden="true" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-semibold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
              Spatial Clash Inspector
              {clashResult && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  {clashResult.total_clashes}
                </span>
              )}
            </h2>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Geometric collision analysis across federated models
            </p>
          </div>
        </div>
        <button
          data-qa="clash-close-btn"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
          title="Close Inspector"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tolerance & Run Action */}
      <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-white/10">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1">
            <Sliders className="w-3 h-3 text-blue-600 dark:text-cyan-400" />
            Clearance Tolerance
          </span>
          <span className="font-mono text-blue-600 dark:text-cyan-400 font-semibold">
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
          <Slider.Track className="bg-slate-200 dark:bg-slate-700 relative grow rounded-full h-1">
            <Slider.Range className="absolute bg-blue-600 dark:bg-cyan-400 rounded-full h-full" />
          </Slider.Track>
          <Slider.Thumb className="block w-3.5 h-3.5 bg-white border border-slate-300 dark:border-slate-600 rounded-full shadow hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-grab active:cursor-grabbing" />
        </Slider.Root>

        <button
          data-qa="clash-run-btn"
          onClick={() => onRunClashCheck(tolerance)}
          disabled={isLoading}
          className={`w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            isLoading
              ? 'bg-blue-100 dark:bg-cyan-500/20 text-blue-400 dark:text-cyan-200 cursor-wait'
              : 'bg-blue-600 hover:bg-blue-500 text-white dark:bg-cyan-500 dark:hover:bg-cyan-400 dark:text-slate-950 shadow-sm'
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
            className={`flex-1 py-1 px-2 rounded-lg border text-center transition-colors cursor-pointer ${
              filterSeverity === 'all'
                ? 'bg-blue-50 dark:bg-slate-700/60 text-blue-700 dark:text-white border-blue-300 dark:border-slate-500 font-semibold'
                : 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All ({clashResult.total_clashes})
          </button>
          <button
            data-qa="clash-tab-hard"
            onClick={() => setFilterSeverity('hard')}
            className={`flex-1 py-1 px-2 rounded-lg border text-center transition-colors cursor-pointer ${
              filterSeverity === 'hard'
                ? 'bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-300 border-red-300 dark:border-red-500/40 font-bold'
                : 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-300'
            }`}
          >
            Hard ({clashResult.hard_clashes})
          </button>
          <button
            data-qa="clash-tab-clearance"
            onClick={() => setFilterSeverity('clearance')}
            className={`flex-1 py-1 px-2 rounded-lg border text-center transition-colors cursor-pointer ${
              filterSeverity === 'clearance'
                ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 font-bold'
                : 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-300'
            }`}
          >
            Clearance ({clashResult.clearance_clashes})
          </button>
        </div>
      )}

      {/* Clash Cards List */}
      <div className="flex flex-col gap-1.5 overflow-y-auto max-h-56 pr-1">
        {clashes.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 dark:text-slate-500">
            <CheckCircle2 className="w-8 h-8 text-emerald-500/70 mb-2" />
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {clashResult ? 'Zero spatial clashes detected!' : 'No clash check run yet'}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              Click &quot;Run Clash Detection&quot; above to inspect geometric intersections.
            </span>
          </div>
        ) : filteredClashes.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
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
                    ? 'bg-blue-50/80 dark:bg-cyan-500/15 border-blue-400 dark:border-cyan-400 shadow-md ring-1 ring-blue-400/40 dark:ring-cyan-400/40'
                    : 'bg-white/60 dark:bg-slate-800/60 border-slate-200/70 dark:border-white/10 hover:border-slate-400 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${
                        isHard
                          ? 'bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-300 border-red-200 dark:border-red-500/40'
                          : 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/40'
                      }`}
                    >
                      {c.severity}
                    </span>
                    <span className="text-[10px] font-mono text-blue-600 dark:text-cyan-400 font-semibold">
                      Depth: {(c.distance * 1000).toFixed(0)} mm
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectClash(c);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-cyan-300 cursor-pointer"
                    title="Focus on collision marker"
                  >
                    <Target className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] gap-2">
                  <div className="flex-1 truncate">
                    <div className="text-slate-800 dark:text-white font-medium truncate">{c.element_a_name}</div>
                    <div className="text-[9px] font-mono text-slate-400">
                      #{c.element_a_id} • {c.element_a_type} ({c.discipline_a})
                    </div>
                  </div>

                  <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />

                  <div className="flex-1 truncate text-right">
                    <div className="text-slate-800 dark:text-white font-medium truncate">{c.element_b_name}</div>
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
