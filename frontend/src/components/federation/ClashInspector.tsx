import React, { useState, useSyncExternalStore } from 'react';
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
import { getClashJobState, subscribeClashJobState } from '../../services/clashJobState';

interface ClashInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  clashResult: ClashCheckResponse | null;
  activeClash: ClashRecord | null;
  onSelectClash: (clash: ClashRecord | null) => void;
  onRunClashCheck: (tolerance: number) => Promise<void>;
  isLoading: boolean;
  leftOffset?: number;
}

export const ClashInspector: React.FC<ClashInspectorProps> = ({
  isOpen,
  onClose,
  clashResult,
  activeClash,
  onSelectClash,
  onRunClashCheck,
  isLoading,
  leftOffset = 0
}) => {
  const [tolerance, setTolerance] = useState(0.01); // 1cm = 0.01m
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'hard' | 'clearance'>('all');
  // Background job progress (audit issue 2.1). The hook owns the polling; this store lets the
  // inspector render it without threading new props through App.tsx.
  const job = useSyncExternalStore(
    subscribeClashJobState,
    getClashJobState,
    getClashJobState
  );

  if (!isOpen) return null;

  // Completeness fields live on the shared `ClashCheckResponse` type now (audit issue 2.7);
  // they stay optional because an older payload can omit them.
  const geometryFailures = clashResult?.geometry_failures ?? 0;
  const sampled = clashResult?.sampled ?? false;
  const elementsChecked = clashResult?.elements_checked ?? 0;
  // Older payloads lack the completeness fields entirely; do not claim "0 checked".
  const hasCompleteness = typeof clashResult?.elements_checked === 'number';
  // A partial scan must never be presented as a coordination result.
  const isIncomplete = sampled || geometryFailures > 0;

  const jobFailed = job.status === 'failed';
  const jobInFlight = job.status === 'queued' || job.status === 'running';
  const busy = isLoading || jobInFlight;
  const progressPercent =
    job.total > 0 ? Math.min(100, Math.round((job.checked / job.total) * 100)) : 0;
  const progressLabel = job.usedSyncFallback
    ? 'Running the synchronous clash check…'
    : job.phase === 'comparing'
      ? 'Testing element pairs…'
      : job.total > 0
        ? `Checking ${job.checked}/${job.total} elements…`
        : 'Starting clash check…';
  const runLabel = busy
    ? job.usedSyncFallback
      ? 'Running Clash Detection…'
      : 'Checking Clashes…'
    : 'Run Clash Detection';

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
      style={{ left: leftOffset ? `${leftOffset + 24}px` : '24px' }}
      className="fixed top-20 z-40 w-96 max-h-[520px] glass-panel bg-[var(--glass-surface-panel)] border border-[var(--glass-border)] rounded-3xl shadow-2xl backdrop-blur-2xl p-4 text-[var(--text-primary)] flex flex-col gap-3 duration-200 transition-all select-none cursor-default"
    >
      <span data-drag-handle="true" className="sr-only" aria-hidden="true" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--glass-border)] pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-semibold tracking-tight text-[var(--text-primary)] flex items-center gap-1.5">
              Spatial Clash Inspector
              {clashResult && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  {clashResult.total_clashes}
                </span>
              )}
            </h2>
            <p className="text-[10px] text-[var(--text-secondary)]">
              Geometric collision analysis across federated models
            </p>
          </div>
        </div>
        <button
          data-qa="clash-close-btn"
          onClick={onClose}
          className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--control-hover)] dark:hover:text-[var(--text-primary)] dark:hover:bg-[var(--control-hover)] transition-colors cursor-pointer"
          title="Close Inspector"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tolerance & Run Action */}
      <div className="flex flex-col gap-2 p-2.5 rounded-2xl glass-card bg-[var(--glass-surface-card)] border border-[var(--glass-border)] shadow-xs">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[var(--text-secondary)] font-medium flex items-center gap-1">
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
          <Slider.Track className="bg-[var(--border-subtle)] relative grow rounded-full h-1">
            <Slider.Range className="absolute bg-blue-600 dark:bg-cyan-400 rounded-full h-full" />
          </Slider.Track>
          <Slider.Thumb className="block w-3.5 h-3.5 bg-white border border-slate-300 dark:border-slate-600 rounded-full shadow hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-grab active:cursor-grabbing" />
        </Slider.Root>

        <button
          data-qa="clash-run-btn"
          onClick={() => onRunClashCheck(tolerance)}
          disabled={busy}
          className={`w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            busy
              ? 'bg-blue-100 dark:bg-cyan-500/20 text-blue-400 dark:text-cyan-200 cursor-wait'
              : 'bg-blue-600 hover:bg-blue-500 text-white dark:bg-cyan-500 dark:hover:bg-cyan-400 dark:text-slate-950 shadow-sm'
          }`}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{runLabel}</span>
        </button>

        {/* Background job progress (audit issue 2.1) */}
        {busy && (
          <div data-qa="clash-job-progress" role="status" className="flex flex-col gap-1">
            <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--border-subtle)]">
              <div
                className="h-full rounded-full bg-blue-600 dark:bg-cyan-400 transition-[width] duration-300"
                style={{ width: `${job.usedSyncFallback ? 100 : progressPercent}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-[var(--text-secondary)]">
              {progressLabel}
            </span>
          </div>
        )}
      </div>

      {/* A failed background job must say why, not just stop spinning. */}
      {jobFailed && job.error && (
        <div
          data-qa="clash-job-error"
          role="alert"
          className="flex items-start gap-2 p-2.5 rounded-2xl bg-red-50 dark:bg-red-500/15 border border-red-300 dark:border-red-500/40 text-red-800 dark:text-red-200"
        >
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold">Clash check failed</span>
            <span className="text-[10px] leading-snug break-words">{job.error}</span>
            <span className="text-[10px] leading-snug text-red-600/80 dark:text-red-300/80">
              The result below, if any, is from an earlier run.
            </span>
          </div>
        </div>
      )}

      {/* Completeness warning — a partial scan is not a coordination result */}
      {clashResult && isIncomplete && (
        <div
          data-qa="clash-completeness-warning"
          role="status"
          className="flex items-start gap-2 p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-200"
        >
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold">Incomplete clash check</span>
            <span className="text-[10px] leading-snug">
              {geometryFailures > 0 && (
                <>
                  {geometryFailures} element{geometryFailures === 1 ? '' : 's'} could not be
                  checked (no usable geometry).{' '}
                </>
              )}
              {sampled && (
                <>
                  Only a sample of the model was examined ({elementsChecked} element
                  {elementsChecked === 1 ? '' : 's'}).{' '}
                </>
              )}
              A zero-clash result here is unverified, not a clearance.
            </span>
          </div>
        </div>
      )}

      {/* Summary Filter Tabs */}
      {clashResult && (
        <div className="flex items-center justify-between gap-1 text-[10px] font-mono">
          <button
            data-qa="clash-tab-all"
            onClick={() => setFilterSeverity('all')}
            className={`flex-1 py-1 px-2 rounded-lg border text-center transition-colors cursor-pointer ${
              filterSeverity === 'all'
                ? 'bg-blue-50 dark:bg-slate-700/60 text-blue-700 dark:text-white border-blue-300 dark:border-slate-500 font-semibold'
                : 'border-[var(--glass-border)] glass-card bg-[var(--glass-surface-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] dark:hover:text-[var(--text-primary)]'
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
                : 'border-[var(--glass-border)] glass-card bg-[var(--glass-surface-card)] text-[var(--text-secondary)] hover:text-red-500 dark:hover:text-red-300'
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
                : 'border-[var(--glass-border)] glass-card bg-[var(--glass-surface-card)] text-[var(--text-secondary)] hover:text-amber-600 dark:hover:text-amber-300'
            }`}
          >
            Clearance ({clashResult.clearance_clashes})
          </button>
        </div>
      )}

      {/* Clash Cards List */}
      <div className="flex flex-col gap-1.5 overflow-y-auto max-h-56 pr-1">
        {clashes.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center text-[var(--text-muted)]">
            {isIncomplete ? (
              <AlertTriangle className="w-8 h-8 text-amber-500/80 mb-2" />
            ) : (
              <CheckCircle2 className="w-8 h-8 text-emerald-500/70 mb-2" />
            )}
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              {clashResult
                ? isIncomplete
                  ? `No clashes among the ${elementsChecked} element${elementsChecked === 1 ? '' : 's'} that could be checked`
                  : 'Zero spatial clashes detected!'
                : 'No clash check run yet'}
            </span>
            <span className="text-[10px] text-[var(--text-secondary)] mt-1">
              {clashResult && isIncomplete
                ? 'This scan was partial — resolve the warning above before reporting clearance.'
                : 'Click "Run Clash Detection" above to inspect geometric intersections.'}
            </span>
          </div>
        ) : filteredClashes.length === 0 ? (
          <div className="p-4 text-center text-xs text-[var(--text-secondary)]">
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
                    : 'glass-card bg-[var(--glass-surface-card)] border-[var(--glass-border)] hover:border-slate-400 dark:hover:border-slate-600'
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
                    className="p-1 rounded text-[var(--text-secondary)] hover:text-blue-600 dark:hover:text-cyan-300 cursor-pointer"
                    title="Focus on collision marker"
                  >
                    <Target className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] gap-2">
                  <div className="flex-1 truncate">
                    <div className="text-[var(--text-primary)] font-medium truncate">{c.element_a_name}</div>
                    <div className="text-[9px] font-mono text-[var(--text-muted)]">
                      #{c.element_a_id} • {c.element_a_type} ({c.discipline_a})
                    </div>
                  </div>

                  <ArrowRight className="w-3 h-3 text-[var(--text-muted)] shrink-0" />

                  <div className="flex-1 truncate text-right">
                    <div className="text-[var(--text-primary)] font-medium truncate">{c.element_b_name}</div>
                    <div className="text-[9px] font-mono text-[var(--text-muted)]">
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
        <div className="flex items-center justify-between gap-2 text-[9px] font-mono text-[var(--text-secondary)] pt-1">
          <span data-qa="clash-elements-checked">
            {hasCompleteness ? `${elementsChecked} checked` : 'Checked'}
            {geometryFailures > 0 ? ` • ${geometryFailures} failed` : ''}
            {sampled ? ' • sampled' : ''}
          </span>
          <span>Inspection completed in {clashResult.duration_ms} ms</span>
        </div>
      )}
    </div>
  );
};
