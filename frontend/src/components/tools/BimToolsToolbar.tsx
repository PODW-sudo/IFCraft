import React, { useState } from 'react';
import {
  Scissors,
  Ruler,
  Camera,
  Trash2
} from 'lucide-react';

export type CameraPreset = 'iso' | 'top' | 'front' | 'side';
export type RenderStyle = 'shaded' | 'wireframe' | 'ghost';

export interface SectionPlaneConfig {
  enabled: boolean;
  axis: 'x' | 'y' | 'z';
  position: number;
  inverted: boolean;
}

interface BimToolsToolbarProps {
  isMeasureActive: boolean;
  onToggleMeasure: () => void;
  measurementCount: number;
  onClearMeasurements: () => void;
  sectionConfig: SectionPlaneConfig;
  onUpdateSection: (config: SectionPlaneConfig) => void;
  onCameraPreset: (preset: CameraPreset) => void;
  renderStyle: RenderStyle;
  onSetRenderStyle: (style: RenderStyle) => void;
}

export const BimToolsToolbar: React.FC<BimToolsToolbarProps> = ({
  isMeasureActive,
  onToggleMeasure,
  measurementCount,
  onClearMeasurements,
  sectionConfig,
  onUpdateSection,
  onCameraPreset,
  renderStyle,
  onSetRenderStyle
}) => {
  const [showSectionPanel, setShowSectionPanel] = useState(false);
  const [showCameraMenu, setShowCameraMenu] = useState(false);

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
      {/* Interactive Section Planes Flyout Panel */}
      {showSectionPanel && (
        <div className="bg-[#16191f]/95 backdrop-blur-md border border-[#262a33] p-4 rounded-xl shadow-2xl w-72 text-xs space-y-3 animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between border-b border-[#262a33] pb-2">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <Scissors className="w-3.5 h-3.5 text-sky-400" />
              <span>Section / Clipping Plane</span>
            </div>
            <button
              onClick={() => setShowSectionPanel(false)}
              className="text-slate-400 hover:text-white"
            >
              &times;
            </button>
          </div>

          {/* Enable / Disable */}
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Activate Section Cut:</span>
            <input
              type="checkbox"
              checked={sectionConfig.enabled}
              onChange={(e) => onUpdateSection({ ...sectionConfig, enabled: e.target.checked })}
              className="accent-sky-500 w-4 h-4 cursor-pointer"
            />
          </div>

          {/* Axis Selector */}
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Cut Plane Axis:</span>
            <div className="flex items-center gap-1 bg-[#0d0f12] p-1 rounded border border-[#262a33]">
              {(['x', 'y', 'z'] as const).map((ax) => (
                <button
                  key={ax}
                  onClick={() => onUpdateSection({ ...sectionConfig, axis: ax })}
                  className={`px-2 py-0.5 uppercase font-mono text-[11px] rounded transition-colors ${
                    sectionConfig.axis === ax
                      ? 'bg-sky-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {ax}
                </button>
              ))}
            </div>
          </div>

          {/* Slider for Plane Position */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">Plane Offset:</span>
              <span className="font-mono text-sky-400">{sectionConfig.position.toFixed(1)}m</span>
            </div>
            <input
              type="range"
              min="-25"
              max="25"
              step="0.2"
              value={sectionConfig.position}
              onChange={(e) =>
                onUpdateSection({ ...sectionConfig, position: parseFloat(e.target.value) })
              }
              className="w-full accent-sky-400 cursor-pointer"
            />
          </div>

          {/* Invert Direction */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-slate-400">Invert Cut Normal:</span>
            <button
              onClick={() => onUpdateSection({ ...sectionConfig, inverted: !sectionConfig.inverted })}
              className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                sectionConfig.inverted
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {sectionConfig.inverted ? 'Inverted' : 'Standard'}
            </button>
          </div>
        </div>
      )}

      {/* Main Floating Tool Dock */}
      <div className="flex items-center gap-1.5 bg-[#16191f]/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#262a33] shadow-2xl">
        {/* Measurement Tool Button */}
        <button
          onClick={onToggleMeasure}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors border ${
            isMeasureActive
              ? 'bg-sky-500 text-slate-950 font-semibold border-sky-400 shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border-transparent'
          }`}
          title="Point-to-Point 3D Measure Ruler (M)"
        >
          <Ruler className="w-3.5 h-3.5" />
          <span>Measure</span>
          {measurementCount > 0 && (
            <span className="text-[10px] bg-slate-900 text-sky-300 px-1.5 py-0.2 rounded-full font-mono">
              {measurementCount}
            </span>
          )}
        </button>

        {measurementCount > 0 && (
          <button
            onClick={onClearMeasurements}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
            title="Clear all measurements"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        <div className="w-[1px] h-4 bg-[#262a33] mx-0.5" />

        {/* Section / Cut Plane Toggle */}
        <button
          onClick={() => setShowSectionPanel((p) => !p)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors border ${
            sectionConfig.enabled
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border-transparent'
          }`}
          title="Section / Cut Plane Controller"
        >
          <Scissors className="w-3.5 h-3.5" />
          <span>Section</span>
        </button>

        <div className="w-[1px] h-4 bg-[#262a33] mx-0.5" />

        {/* Camera Views Preset Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowCameraMenu((p) => !p)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
            title="Camera Perspective & Orthographic Presets"
          >
            <Camera className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Views</span>
          </button>

          {showCameraMenu && (
            <div className="absolute bottom-10 left-0 bg-[#16191f] border border-[#262a33] rounded-lg shadow-xl p-1.5 min-w-[120px] text-xs space-y-1">
              <button
                onClick={() => {
                  onCameraPreset('iso');
                  setShowCameraMenu(false);
                }}
                className="w-full text-left px-2 py-1 rounded hover:bg-slate-800 text-slate-200"
              >
                Isometric 3D
              </button>
              <button
                onClick={() => {
                  onCameraPreset('top');
                  setShowCameraMenu(false);
                }}
                className="w-full text-left px-2 py-1 rounded hover:bg-slate-800 text-slate-200"
              >
                Top (Floor Plan)
              </button>
              <button
                onClick={() => {
                  onCameraPreset('front');
                  setShowCameraMenu(false);
                }}
                className="w-full text-left px-2 py-1 rounded hover:bg-slate-800 text-slate-200"
              >
                Front Elevation
              </button>
              <button
                onClick={() => {
                  onCameraPreset('side');
                  setShowCameraMenu(false);
                }}
                className="w-full text-left px-2 py-1 rounded hover:bg-slate-800 text-slate-200"
              >
                Side Elevation
              </button>
            </div>
          )}
        </div>

        <div className="w-[1px] h-4 bg-[#262a33] mx-0.5" />

        {/* Render Style Mode: Shaded, Wireframe, Ghost */}
        <div className="flex items-center gap-0.5 bg-[#0d0f12] p-0.5 rounded-lg border border-[#262a33]">
          <button
            onClick={() => onSetRenderStyle('shaded')}
            className={`px-2 py-1 rounded text-[11px] transition-colors ${
              renderStyle === 'shaded'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            title="Solid Shaded Material"
          >
            Solid
          </button>
          <button
            onClick={() => onSetRenderStyle('wireframe')}
            className={`px-2 py-1 rounded text-[11px] transition-colors ${
              renderStyle === 'wireframe'
                ? 'bg-slate-800 text-sky-400 font-semibold'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            title="Wireframe CAD"
          >
            Wire
          </button>
          <button
            onClick={() => onSetRenderStyle('ghost')}
            className={`px-2 py-1 rounded text-[11px] transition-colors ${
              renderStyle === 'ghost'
                ? 'bg-slate-800 text-purple-400 font-semibold'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            title="X-Ray Ghosting"
          >
            X-Ray
          </button>
        </div>
      </div>
    </div>
  );
};
