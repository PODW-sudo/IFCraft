import React from 'react';

export type CubeFace = 'top' | 'front' | 'right' | 'back' | 'left' | 'bottom' | 'iso';

interface ModernGlassViewCubeProps {
  onSelectFace: (face: CubeFace) => void;
  activeFace?: CubeFace;
}

export const ModernGlassViewCube: React.FC<ModernGlassViewCubeProps> = ({
  onSelectFace,
  activeFace = 'iso'
}) => {
  return (
    <div
      className="relative select-none pointer-events-auto p-2"
      title="ViewCube - Click faces to align 3D camera"
      data-qa="modern-glass-viewcube"
    >
      {/* 3D Isometric ViewCube Presentation */}
      <div className="relative w-24 h-24 [perspective:600px] flex items-center justify-center">
        <div
          className="relative w-14 h-14 [transform-style:preserve-3d] transition-transform duration-500 ease-out"
          style={{
            transform: 'rotateX(-25deg) rotateY(45deg)'
          }}
        >
          {/* Top Face */}
          <button
            type="button"
            onClick={() => onSelectFace('top')}
            className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold tracking-wider uppercase backdrop-blur-md border transition-all duration-200 cursor-pointer ${
              activeFace === 'top'
                ? 'bg-blue-500/30 border-blue-400 text-blue-700 shadow-sm'
                : 'bg-white/70 border-white/90 text-slate-700 hover:bg-white/90 hover:text-blue-600 hover:shadow'
            }`}
            style={{
              transform: 'rotateX(90deg) translateZ(28px)'
            }}
            title="Top View"
          >
            Top
          </button>

          {/* Front Face */}
          <button
            type="button"
            onClick={() => onSelectFace('front')}
            className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold tracking-wider uppercase backdrop-blur-md border transition-all duration-200 cursor-pointer ${
              activeFace === 'front'
                ? 'bg-blue-500/30 border-blue-400 text-blue-700 shadow-sm'
                : 'bg-white/75 border-white/90 text-slate-700 hover:bg-white/90 hover:text-blue-600 hover:shadow'
            }`}
            style={{
              transform: 'translateZ(28px)'
            }}
            title="Front View"
          >
            Front
          </button>

          {/* Right Face */}
          <button
            type="button"
            onClick={() => onSelectFace('right')}
            className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold tracking-wider uppercase backdrop-blur-md border transition-all duration-200 cursor-pointer ${
              activeFace === 'right'
                ? 'bg-blue-500/30 border-blue-400 text-blue-700 shadow-sm'
                : 'bg-white/60 border-white/80 text-slate-700 hover:bg-white/90 hover:text-blue-600 hover:shadow'
            }`}
            style={{
              transform: 'rotateY(90deg) translateZ(28px)'
            }}
            title="Right View"
          >
            Right
          </button>

          {/* Left Face (Backing) */}
          <button
            type="button"
            onClick={() => onSelectFace('left')}
            className="absolute inset-0 flex items-center justify-center text-[9px] font-medium uppercase bg-white/40 border border-white/60 text-slate-400 opacity-60 hover:opacity-100 transition-opacity"
            style={{
              transform: 'rotateY(-90deg) translateZ(28px)'
            }}
            title="Left View"
          >
            Left
          </button>

          {/* Back Face (Backing) */}
          <button
            type="button"
            onClick={() => onSelectFace('back')}
            className="absolute inset-0 flex items-center justify-center text-[9px] font-medium uppercase bg-white/40 border border-white/60 text-slate-400 opacity-60 hover:opacity-100 transition-opacity"
            style={{
              transform: 'rotateY(180deg) translateZ(28px)'
            }}
            title="Back View"
          >
            Back
          </button>

          {/* Bottom Face */}
          <button
            type="button"
            onClick={() => onSelectFace('bottom')}
            className="absolute inset-0 flex items-center justify-center text-[9px] font-medium uppercase bg-white/30 border border-white/50 text-slate-400 opacity-40 hover:opacity-80 transition-opacity"
            style={{
              transform: 'rotateX(-90deg) translateZ(28px)'
            }}
            title="Bottom View"
          >
            Bottom
          </button>
        </div>
      </div>
    </div>
  );
};
