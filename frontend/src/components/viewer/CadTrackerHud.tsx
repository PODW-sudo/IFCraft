import React, { useState, useEffect, useRef } from 'react';
import {
  Compass,
  Hash,
  CornerDownLeft,
  Copy,
  Lock,
  Pin,
  PinOff,
  GripVertical,
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

  // Pinning state persisted in localStorage
  const [isPinned, setIsPinned] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ifc_editor_cad_tracker_pinned') === 'true';
    } catch {
      return false;
    }
  });

  const [pinnedPos, setPinnedPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const stored = localStorage.getItem('ifc_editor_cad_tracker_pos');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [draggedPos, setDraggedPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; initialPosX: number; initialPosY: number } | null>(null);

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

  // Clamp screen position to avoid overflowing window or overlapping right side panels
  const hudWidth = 260;
  const hudHeight = 120;

  let maxRight = typeof window !== 'undefined' ? window.innerWidth - hudWidth - 16 : 800;
  if (typeof document !== 'undefined') {
    const rightPanel =
      document.querySelector('[data-qa="property-panel"]') ||
      document.querySelector('[data-qa="element-properties-panel"]') ||
      document.querySelector('aside');
    if (rightPanel) {
      const rect = rightPanel.getBoundingClientRect();
      if (rect.left > 200 && rect.left < window.innerWidth) {
        maxRight = Math.min(maxRight, rect.left - hudWidth - 16);
      }
    }
  }

  let preferredX = readout.screenPos.x + 24;
  if (preferredX > maxRight && (readout.screenPos.x - hudWidth - 24) >= 16) {
    preferredX = readout.screenPos.x - hudWidth - 24;
  }

  const basePos = (isPinned && pinnedPos) ? pinnedPos : (draggedPos || { x: preferredX, y: readout.screenPos.y - 20 });
  const posX = Math.max(16, Math.min(maxRight, basePos.x));
  const posY = Math.max(70, Math.min(typeof window !== 'undefined' ? window.innerHeight - hudHeight - 16 : 600, basePos.y));

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPosX: posX,
      initialPosY: posY
    };

    const handlePointerMove = (moveEv: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = moveEv.clientX - dragRef.current.startX;
      const dy = moveEv.clientY - dragRef.current.startY;
      const newX = Math.max(16, Math.min(window.innerWidth - hudWidth - 16, dragRef.current.initialPosX + dx));
      const newY = Math.max(70, Math.min(window.innerHeight - hudHeight - 16, dragRef.current.initialPosY + dy));
      const newPos = { x: newX, y: newY };
      setDraggedPos(newPos);
      if (isPinned) {
        setPinnedPos(newPos);
        try {
          localStorage.setItem('ifc_editor_cad_tracker_pos', JSON.stringify(newPos));
        } catch {}
      }
    };

    const handlePointerUp = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextPinned = !isPinned;
    setIsPinned(nextPinned);
    try {
      localStorage.setItem('ifc_editor_cad_tracker_pinned', String(nextPinned));
      if (nextPinned) {
        const posToSave = draggedPos || { x: posX, y: posY };
        setPinnedPos(posToSave);
        localStorage.setItem('ifc_editor_cad_tracker_pos', JSON.stringify(posToSave));
      }
    } catch {}
  };

  return (
    <div
      data-qa="cad-tracker-hud"
      style={{ left: `${posX}px`, top: `${posY}px` }}
      className="fixed z-50 pointer-events-auto select-none flex flex-col gap-1.5 p-2 rounded-xl bg-surface-dock/95 backdrop-blur-2xl border border-border-subtle shadow-dock text-text-primary text-xs animate-in fade-in-50 zoom-in-95 duration-100 min-w-[240px]"
    >
      {/* Harness Verification Bridge */}
      <div data-qa="interactive-edit-banner" className="sr-only">
        Interactive {readout.mode} - {readout.prompt || 'Click point to move'}
      </div>
      <button data-qa="interactive-edit-cancel-btn" onClick={onCancel} className="sr-only" tabIndex={-1}>
        ESC to cancel
      </button>

      {/* Header Prompt, Drag Handle & Pin Toggle */}
      <div
        onPointerDown={handlePointerDown}
        className="flex items-center justify-between border-b border-border-subtle/50 pb-1 text-[11px] cursor-grab active:cursor-grabbing select-none"
        title="Drag to move HUD &middot; Pin to lock location"
      >
        <div className="flex items-center gap-1.5 font-medium text-cyan-400 min-w-0">
          <GripVertical size={11} className="text-text-secondary opacity-60 shrink-0" />
          <Compass size={12} className="shrink-0" />
          <span className="truncate max-w-[120px] font-semibold">{readout.prompt}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-1">
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
          <button
            type="button"
            data-qa="tracker-hud-pin-btn"
            onClick={handleTogglePin}
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              isPinned
                ? 'text-amber-400 bg-amber-500/20 border border-amber-500/40'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-canvas/50'
            }`}
            title={isPinned ? 'Unpin HUD (floats near selected element)' : 'Pin HUD (locks position on screen)'}
            aria-label={isPinned ? 'Unpin HUD' : 'Pin HUD'}
          >
            {isPinned ? <PinOff size={11} /> : <Pin size={11} />}
          </button>
          <button
            type="button"
            data-qa="tracker-hud-close-btn"
            onClick={onCancel}
            className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-canvas/50 transition-colors cursor-pointer"
            title="Cancel operation (Esc)"
          >
            <X size={11} />
          </button>
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
        <span className="opacity-60">Esc cancels</span>
      </div>
    </div>
  );
};
export default CadTrackerHud;
