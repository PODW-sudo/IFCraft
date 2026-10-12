import React from 'react';
import { GripVertical } from 'lucide-react';
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
      className="absolute top-20 z-20 pointer-events-auto transition-[right] duration-150 select-none p-1.5 flex flex-col items-center gap-1"
      style={{ right: rightOffset ? rightOffset + 16 : 24 }}
      title="ViewCube - Click faces to align 3D camera"
      data-qa="glass-viewcube"
      data-qa-hud="view-controls-hud"
      data-qa-draggable-hud="view-controls"
    >
      {/* Draggable Grip Handle */}
      <div
        data-drag-handle="true"
        className="flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-grab active:cursor-grabbing p-0.5"
        title="Drag to reposition View Controls"
      >
        <GripVertical className="w-3 h-3" />
      </div>
      <div className="relative w-22 h-22 [perspective:600px] flex items-center justify-center">
        <div
          className="relative w-13 h-13 [transform-style:preserve-3d] transition-transform duration-500 ease-out"
          style={{ transform: 'rotateX(-25deg) rotateY(45deg)' }}
        >
          {/* Top Face */}
          <button
            type="button"
            data-qa="view-preset-top"
            onClick={() => onCameraPreset('top')}
            className={`absolute inset-0 flex items-center justify-center text-[9px] font-bold tracking-wider uppercase backdrop-blur-md border transition-all cursor-pointer ${
              activePreset === 'top'
                ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                : 'bg-white/70 dark:bg-slate-800/80 border-white/90 dark:border-white/20 text-slate-700 dark:text-slate-200 hover:bg-white/90 hover:text-blue-600'
            }`}
            style={{ transform: 'rotateX(90deg) translateZ(26px)' }}
            title="Top View (Plan)"
          >
            Top
          </button>

          {/* Front Face */}
          <button
            type="button"
            data-qa="view-preset-front"
            onClick={() => onCameraPreset('front')}
            className={`absolute inset-0 flex items-center justify-center text-[9px] font-bold tracking-wider uppercase backdrop-blur-md border transition-all cursor-pointer ${
              activePreset === 'front'
                ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                : 'bg-white/75 dark:bg-slate-800/85 border-white/90 dark:border-white/20 text-slate-700 dark:text-slate-200 hover:bg-white/90 hover:text-blue-600'
            }`}
            style={{ transform: 'translateZ(26px)' }}
            title="Front Elevation"
          >
            Front
          </button>

          {/* Right / Side Face */}
          <button
            type="button"
            data-qa="view-preset-side"
            onClick={() => onCameraPreset('side')}
            className={`absolute inset-0 flex items-center justify-center text-[9px] font-bold tracking-wider uppercase backdrop-blur-md border transition-all cursor-pointer ${
              activePreset === 'side'
                ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                : 'bg-white/65 dark:bg-slate-800/75 border-white/80 dark:border-white/20 text-slate-700 dark:text-slate-200 hover:bg-white/90 hover:text-blue-600'
            }`}
            style={{ transform: 'rotateY(90deg) translateZ(26px)' }}
            title="Side Elevation"
          >
            Right
          </button>

          {/* Isometric Reset Pill */}
          <button
            type="button"
            data-qa="view-preset-iso"
            onClick={() => onCameraPreset('iso')}
            className={`absolute -bottom-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider backdrop-blur-md border transition-all cursor-pointer ${
              activePreset === 'iso'
                ? 'bg-blue-600 text-white border-blue-400 shadow-xs'
                : 'bg-white/70 dark:bg-slate-800/70 border-white/80 dark:border-white/20 text-slate-600 dark:text-slate-300 hover:text-blue-600'
            }`}
            title="Isometric 3D"
          >
            Iso
          </button>
        </div>
      </div>
    </div>
  );
};
export default GlassViewCube;
