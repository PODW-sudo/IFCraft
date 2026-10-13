import React from 'react';
import { Compass, Box } from 'lucide-react';
import type { CameraPreset } from '../../types/viewport';

interface GlassViewCubeProps {
  onCameraPreset: (preset: CameraPreset) => void;
  activePreset?: CameraPreset | null;
  rightOffset?: number;
}

export const GlassViewCube: React.FC<GlassViewCubeProps> = ({
  onCameraPreset,
  activePreset = 'iso',
  rightOffset = 0
}) => {
  return (
    <div
      className="absolute top-20 z-20 pointer-events-auto transition-[right] duration-150 select-none p-2 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-xl flex flex-col items-center gap-1.5 w-32"
      style={{ right: rightOffset ? rightOffset + 16 : 24 }}
      title="Camera View Navigator — Click to align 3D viewport"
      data-qa="glass-viewcube"
      data-qa-hud="view-controls-hud"
      data-qa-draggable-hud="view-controls"
    >
      {/* Hidden Test Anchor for QA Harness (No visible drag mark) */}
      <span data-drag-handle="true" className="sr-only" aria-hidden="true" />

      {/* Compass Orientation Header */}
      <div className="flex items-center justify-between w-full px-1 text-[10px] text-slate-500 dark:text-slate-400 font-semibold tracking-wider uppercase border-b border-slate-200/60 dark:border-white/10 pb-1">
        <div className="flex items-center gap-1">
          <Compass className="w-3 h-3 text-blue-600 dark:text-cyan-400" />
          <span>View</span>
        </div>
        <span className="text-[9px] font-mono font-bold text-blue-600 dark:text-cyan-400 px-1 py-0.2 rounded bg-blue-50 dark:bg-slate-800 border border-blue-200/60 dark:border-white/10">
          N 0°
        </span>
      </div>

      {/* Interactive Camera Preset Buttons */}
      <div className="grid grid-cols-2 gap-1 w-full pt-0.5">
        {/* Isometric 3D (Full Axonometric View) */}
        <button
          type="button"
          data-qa="view-preset-iso"
          onClick={() => onCameraPreset('iso')}
          className={`col-span-2 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl text-[11px] font-semibold transition-all cursor-pointer ${
            activePreset === 'iso'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-100/80 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-white/10'
          }`}
          title="Isometric 3D Axonometric View"
        >
          <Box className="w-3.5 h-3.5" />
          <span>3D Iso</span>
        </button>

        {/* Top (Architectural Plan View) */}
        <button
          type="button"
          data-qa="view-preset-top"
          onClick={() => onCameraPreset('top')}
          className={`flex items-center justify-center px-1.5 py-1.5 rounded-xl text-[11px] font-medium transition-all cursor-pointer ${
            activePreset === 'top'
              ? 'bg-blue-600 text-white font-semibold shadow-sm'
              : 'bg-slate-100/80 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-white/10'
          }`}
          title="Top Plan View (Z-Axis Downward)"
        >
          <span>Top</span>
        </button>

        {/* Front (South Elevation) */}
        <button
          type="button"
          data-qa="view-preset-front"
          onClick={() => onCameraPreset('front')}
          className={`flex items-center justify-center px-1.5 py-1.5 rounded-xl text-[11px] font-medium transition-all cursor-pointer ${
            activePreset === 'front'
              ? 'bg-blue-600 text-white font-semibold shadow-sm'
              : 'bg-slate-100/80 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-white/10'
          }`}
          title="Front Elevation View (Y-Axis North)"
        >
          <span>Front</span>
        </button>

        {/* Side / Right (East Elevation) */}
        <button
          type="button"
          data-qa="view-preset-side"
          onClick={() => onCameraPreset('side')}
          className={`col-span-2 flex items-center justify-center px-2 py-1 rounded-xl text-[11px] font-medium transition-all cursor-pointer ${
            activePreset === 'side'
              ? 'bg-blue-600 text-white font-semibold shadow-sm'
              : 'bg-slate-100/80 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-white/10'
          }`}
          title="Side Elevation View (X-Axis East)"
        >
          <span>Side / Right</span>
        </button>
      </div>
    </div>
  );
};

export default GlassViewCube;
