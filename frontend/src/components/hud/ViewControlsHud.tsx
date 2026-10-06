import React from 'react';
import { Compass, GripVertical } from 'lucide-react';
import type { CameraPreset } from '../tools/BimToolsToolbar';
import { useDraggableHud } from './HudLayoutContext';

interface ViewControlsHudProps {
  onCameraPreset?: (preset: CameraPreset) => void;
  activePreset?: CameraPreset | null;
}

export const ViewControlsHud: React.FC<ViewControlsHudProps> = ({
  onCameraPreset,
  activePreset = null
}) => {
  const initialWidth = 240;
  const initialHeight = 36;
  const initialX = typeof window !== 'undefined' ? Math.max(16, window.innerWidth - initialWidth - 24) : 1180;
  const initialY = 72; // Cleanly below the top pill (top pill is at top: 12px, height: 45px)

  const { ref, style, dragProps, isDragging } = useDraggableHud('view-controls', {
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
      className={`flex items-center gap-1 p-1 rounded-xl bg-[var(--dock-translucent)] backdrop-blur-xl border border-[var(--border-subtle)] shadow-[var(--shadow-hud)] select-none text-[10px] font-mono transition-shadow ${
        isDragging ? 'shadow-cyan-500/20 ring-1 ring-cyan-500/40 cursor-grabbing' : 'cursor-grab'
      }`}
      data-qa="view-controls-hud"
    >
      {/* Draggable Grip Handle */}
      <div
        data-drag-handle="true"
        className="flex items-center text-slate-500 hover:text-slate-300 px-1 py-1 cursor-grab active:cursor-grabbing"
        title="Drag to reposition View Controls"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      <div className="flex items-center gap-1 text-slate-400 pr-1.5 font-semibold uppercase tracking-wider text-[9px]">
        <Compass className="w-3 h-3 text-cyan-400" />
        <span className="hidden sm:inline">Views</span>
      </div>

      <div className="h-3 w-[1px] bg-[var(--border-subtle)]" />

      <button
        onClick={() => onCameraPreset && onCameraPreset('iso')}
        className={`px-2 py-0.5 rounded transition-colors text-center font-bold ${
          activePreset === 'iso'
            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
            : 'bg-[var(--control-bg)] hover:bg-[var(--control-hover)] text-slate-200 border border-[var(--border-subtle)]'
        }`}
        title="Isometric 3D View"
        data-qa="view-preset-iso"
      >
        ISO
      </button>

      <button
        onClick={() => onCameraPreset && onCameraPreset('top')}
        className={`px-2 py-0.5 rounded transition-colors text-center font-bold ${
          activePreset === 'top'
            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
            : 'bg-[var(--control-bg)] hover:bg-[var(--control-hover)] text-cyan-300 border border-[var(--border-subtle)]'
        }`}
        title="Top Floor Plan View"
        data-qa="view-preset-top"
      >
        TOP
      </button>

      <button
        onClick={() => onCameraPreset && onCameraPreset('front')}
        className={`px-2 py-0.5 rounded transition-colors text-center font-bold ${
          activePreset === 'front'
            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
            : 'bg-[var(--control-bg)] hover:bg-[var(--control-hover)] text-slate-200 border border-[var(--border-subtle)]'
        }`}
        title="Front Elevation View"
        data-qa="view-preset-front"
      >
        FRONT
      </button>

      <button
        onClick={() => onCameraPreset && onCameraPreset('side')}
        className={`px-2 py-0.5 rounded transition-colors text-center font-bold ${
          activePreset === 'side'
            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
            : 'bg-[var(--control-bg)] hover:bg-[var(--control-hover)] text-slate-200 border border-[var(--border-subtle)]'
        }`}
        title="Side Elevation View"
        data-qa="view-preset-side"
      >
        SIDE
      </button>
    </div>
  );
};
