import React, { useState, useEffect } from 'react';
import { Compass, Hash, CornerDownLeft, Lock } from 'lucide-react';
import type { CadToolMode } from '../../types/ifc';

export interface DraftingInputHudProps {
  toolMode: CadToolMode;
  isDrawing: boolean;
  currentLength: number;
  currentAngle: number;
  isOrthoLocked: boolean;
  onCommitDistance?: (length: number) => void;
  onCancel?: () => void;
}

export const DraftingInputHud: React.FC<DraftingInputHudProps> = ({
  toolMode,
  isDrawing,
  currentLength,
  currentAngle,
  isOrthoLocked,
  onCommitDistance,
  onCancel,
}) => {
  const [typedValue, setTypedValue] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);

  // Global keydown listener when actively drawing to capture type-ahead numbers
  useEffect(() => {
    if (!isDrawing) {
      setTypedValue('');
      setIsTyping(false);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // If typing inside an input or textarea elsewhere, ignore
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if ((e.key >= '0' && e.key <= '9') || e.key === '.') {
        e.preventDefault();
        setIsTyping(true);
        setTypedValue((prev) => prev + e.key);
      } else if (e.key === 'Backspace' && isTyping) {
        e.preventDefault();
        setTypedValue((prev) => prev.slice(0, -1));
        if (typedValue.length <= 1) setIsTyping(false);
      } else if (e.key === 'Enter' && isTyping && onCommitDistance) {
        e.preventDefault();
        const dist = parseFloat(typedValue);
        if (!isNaN(dist) && dist > 0) {
          onCommitDistance(dist);
        }
        setTypedValue('');
        setIsTyping(false);
      } else if (e.key === 'Escape') {
        if (isTyping) {
          setTypedValue('');
          setIsTyping(false);
        } else if (onCancel) {
          onCancel();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawing, isTyping, typedValue, onCommitDistance, onCancel]);

  if (!isDrawing && toolMode === 'select') return null;

  const displayLength = isTyping
    ? parseFloat(typedValue) || 0
    : currentLength;

  return (
    <div
      data-qa="drafting-input-hud"
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 pointer-events-auto select-none flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-dock/95 backdrop-blur-2xl border border-border-subtle shadow-dock text-text-primary text-xs animate-in fade-in-50 zoom-in-95 duration-150"
    >
      {/* Tool Indicator */}
      <div className="flex items-center gap-1.5 font-semibold text-[11px] text-cyan-400 uppercase tracking-wider pr-1.5 border-r border-border-subtle/40">
        <Compass size={13} />
        <span>{toolMode}</span>
      </div>

      {/* Dynamic Dimension Readout / Input */}
      <div className="flex items-center gap-1 font-mono">
        <Hash size={12} className="text-text-secondary opacity-60" />
        <span className="text-text-secondary text-[11px]">Distance:</span>
        {isTyping ? (
          <div className="flex items-center gap-1 bg-surface-canvas px-1.5 py-0.5 rounded border border-cyan-500/60 text-cyan-300 font-bold tabular-nums">
            <span>{typedValue}</span>
            <span className="text-[10px] text-text-secondary">m</span>
            <CornerDownLeft size={10} className="text-cyan-400 ml-0.5" />
          </div>
        ) : (
          <span className="font-bold text-text-primary tabular-nums">
            {displayLength.toFixed(3)}m
          </span>
        )}
      </div>

      {/* Dynamic Heading Angle */}
      <div className="flex items-center gap-1 font-mono text-[11px] pl-1.5 border-l border-border-subtle/40 text-text-secondary">
        <span className="opacity-60">Angle:</span>
        <span className="font-semibold text-text-primary tabular-nums">
          {currentAngle.toFixed(1)}°
        </span>
      </div>

      {/* Ortho Lock Badge */}
      {isOrthoLocked && (
        <div
          data-qa="ortho-lock-badge"
          className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-semibold"
          title="Ortho Lock Active (holding Shift)"
        >
          <Lock size={10} />
          <span>ORTHO</span>
        </div>
      )}

      {/* Helper text */}
      <div className="text-[10px] text-text-secondary opacity-60 pl-1">
        {isTyping ? 'Press Enter to commit' : 'Hold Shift for Ortho | Esc to cancel'}
      </div>
    </div>
  );
};
