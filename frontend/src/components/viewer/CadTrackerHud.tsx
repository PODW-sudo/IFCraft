import React, { useState, useEffect } from 'react';
import {
  Compass,
  Hash,
  CornerDownLeft,
  Copy,
  Lock,
  X
} from 'lucide-react';
import type { TrackerReadout } from '../../types/cadEditing';

export interface CadTrackerHudProps {
  readout: TrackerReadout | null;
  onCommitValue?: (field: 'distance' | 'angle' | 'dx' | 'dy' | 'dz', value: number) => void;
  onCancel?: () => void;
}

export const CadTrackerHud: React.FC<CadTrackerHudProps> = ({
  readout,
  onCommitValue,
  onCancel,
}) => {
  const [typedValue, setTypedValue] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [selectedField, setSelectedField] = useState<'distance' | 'angle' | 'dx' | 'dy' | 'dz'>('distance');

  useEffect(() => {
    if (readout) {
      setSelectedField(readout.activeField);
    }
  }, [readout?.activeField]);

  // Global key listener to catch numeric input when HUD is visible
  useEffect(() => {
    if (!readout) {
      setTypedValue('');
      setIsTyping(false);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently inside an input/textarea in another panel
      const target = e.target as HTMLElement;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) {
        return;
      }

      if ((e.key >= '0' && e.key <= '9') || e.key === '.' || (e.key === '-' && typedValue === '')) {
        e.preventDefault();
        setIsTyping(true);
        setTypedValue((prev) => prev + e.key);
      } else if (e.key === 'Backspace' && isTyping) {
        e.preventDefault();
        setTypedValue((prev) => {
          const next = prev.slice(0, -1);
          if (next.length === 0) setIsTyping(false);
          return next;
        });
      } else if (e.key === 'Tab') {
        e.preventDefault();
        // Cycle fields: distance -> angle -> dx -> dy -> dz -> distance
        const order: ('distance' | 'angle' | 'dx' | 'dy' | 'dz')[] = ['distance', 'angle', 'dx', 'dy', 'dz'];
        const nextIdx = (order.indexOf(selectedField) + 1) % order.length;
        setSelectedField(order[nextIdx]);
        setTypedValue('');
        setIsTyping(false);
      } else if (e.key === 'Enter') {
        if (isTyping && typedValue.length > 0 && onCommitValue) {
          e.preventDefault();
          const val = parseFloat(typedValue);
          if (!isNaN(val)) {
            onCommitValue(selectedField, val);
          }
          setTypedValue('');
          setIsTyping(false);
        }
      } else if (e.key === 'Escape') {
        if (isTyping) {
          e.preventDefault();
          setTypedValue('');
          setIsTyping(false);
        } else if (onCancel) {
          e.preventDefault();
          onCancel();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readout, isTyping, typedValue, selectedField, onCommitValue, onCancel]);

  if (!readout) return null;

  // Clamp screen position to avoid overflowing window
  const hudWidth = 260;
  const hudHeight = 110;
  const posX = Math.max(16, Math.min(window.innerWidth - hudWidth - 16, readout.screenPos.x + 24));
  const posY = Math.max(70, Math.min(window.innerHeight - hudHeight - 16, readout.screenPos.y - 20));

  return (
    <div
      data-qa="cad-tracker-hud"
      style={{ left: `${posX}px`, top: `${posY}px` }}
      className="fixed z-50 pointer-events-auto select-none flex flex-col gap-1.5 p-2 rounded-xl bg-surface-dock/95 backdrop-blur-2xl border border-border-subtle shadow-dock text-text-primary text-xs animate-in fade-in-50 zoom-in-95 duration-100 min-w-[240px]"
    >
      {/* Header Prompt & Mode Badges */}
      <div className="flex items-center justify-between border-b border-border-subtle/50 pb-1 text-[11px]">
        <div className="flex items-center gap-1.5 font-medium text-cyan-400">
          <Compass size={12} />
          <span className="truncate max-w-[130px] font-semibold">{readout.prompt}</span>
        </div>
        <div className="flex items-center gap-1">
          {readout.isCopyActive && (
            <span
              className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[9px] font-bold"
              title="Copy Mode Active (Hold Ctrl to toggle)"
            >
              <Copy size={9} /> COPY
            </span>
          )}
          {readout.isOrthoActive && (
            <span
              className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-mono text-[9px] font-bold"
              title="Ortho Snap Active (Hold Shift to toggle)"
            >
              <Lock size={9} /> ORTHO
            </span>
          )}
        </div>
      </div>

      {/* Step Guide */}
      <div className="text-[10px] text-text-secondary font-medium">
        {readout.stepDescription}
      </div>

      {/* Active Readout / Numerical Typing Row */}
      <div className="bg-surface-canvas/80 border border-border-subtle/70 rounded-lg p-1.5 flex flex-col gap-1">
        {isTyping ? (
          <div className="flex items-center justify-between bg-surface-dock px-2 py-1 rounded border border-cyan-500/70 text-cyan-300 font-mono font-bold">
            <span className="text-[10px] text-text-secondary uppercase">{selectedField}:</span>
            <div className="flex items-center gap-1">
              <span className="text-sm">{typedValue}</span>
              <span className="text-[10px] text-text-secondary">
                {selectedField === 'angle' ? '°' : 'm'}
              </span>
              <CornerDownLeft size={11} className="text-cyan-400 ml-1" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1 font-mono text-[11px]">
            {/* Distance */}
            <div
              onClick={() => setSelectedField('distance')}
              className={`flex items-center justify-between px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                selectedField === 'distance'
                  ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold'
                  : 'hover:bg-surface-dock/60 text-text-secondary'
              }`}
            >
              <span className="opacity-70 text-[10px]">D:</span>
              <span className="text-text-primary tabular-nums">{readout.distance.toFixed(3)}m</span>
            </div>

            {/* Angle */}
            <div
              onClick={() => setSelectedField('angle')}
              className={`flex items-center justify-between px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                selectedField === 'angle'
                  ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold'
                  : 'hover:bg-surface-dock/60 text-text-secondary'
              }`}
            >
              <span className="opacity-70 text-[10px]">A:</span>
              <span className="text-text-primary tabular-nums">{readout.angle.toFixed(1)}°</span>
            </div>

            {/* dX (Red coordinate) */}
            <div
              onClick={() => setSelectedField('dx')}
              className={`flex items-center justify-between px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                selectedField === 'dx'
                  ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold'
                  : 'hover:bg-surface-dock/60 text-text-secondary'
              }`}
            >
              <span className="text-rose-400 font-bold text-[10px]">dX:</span>
              <span className="text-text-primary tabular-nums">{readout.dx.toFixed(2)}m</span>
            </div>

            {/* dY / dZ */}
            <div
              onClick={() => setSelectedField('dz')}
              className={`flex items-center justify-between px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                selectedField === 'dz'
                  ? 'bg-blue-500/20 border border-blue-500/40 text-blue-300 font-bold'
                  : 'hover:bg-surface-dock/60 text-text-secondary'
              }`}
            >
              <span className="text-blue-400 font-bold text-[10px]">dZ:</span>
              <span className="text-text-primary tabular-nums">{readout.dz.toFixed(2)}m</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Hint */}
      <div className="flex items-center justify-between text-[9px] text-text-secondary px-0.5 font-mono">
        <span className="flex items-center gap-1">
          <Hash size={9} /> Type number directly &middot; Tab switches
        </span>
        <button
          onClick={onCancel}
          className="hover:text-text-primary p-0.5 rounded transition-colors"
          title="Cancel operation (Esc)"
        >
          <X size={10} />
        </button>
      </div>
    </div>
  );
};
