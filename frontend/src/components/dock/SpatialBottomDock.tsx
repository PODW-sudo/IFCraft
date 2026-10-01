import React, { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Slider from '@radix-ui/react-slider';
import {
  MousePointer,
  Move,
  RotateCw,
  Ruler,
  Scissors,
  Grid,
  Camera,
  Layers,
  Trash2,
  Maximize2
} from 'lucide-react';
import type { TransformMode } from '../viewer/ThreeViewport';
import type { SectionPlaneConfig, CameraPreset, RenderStyle } from '../tools/BimToolsToolbar';

interface SpatialBottomDockProps {
  transformMode: TransformMode;
  onSetTransformMode: (mode: TransformMode) => void;
  snapEnabled: boolean;
  onToggleSnap: () => void;
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

export const SpatialBottomDock: React.FC<SpatialBottomDockProps> = ({
  transformMode,
  onSetTransformMode,
  snapEnabled,
  onToggleSnap,
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
  const [isSectionFlyoutOpen, setIsSectionFlyoutOpen] = useState(false);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 select-none">
      {/* Section Plane Floating Control Card (when section active or clicked) */}
      {sectionConfig.enabled && isSectionFlyoutOpen && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[var(--dock-bg)] border border-[var(--border-subtle)] shadow-[var(--shadow-hud)] text-xs text-slate-200 animate-in fade-in-50 slide-in-from-bottom-2">
          <div className="flex items-center gap-1.5 font-medium text-slate-300">
            <Scissors className="w-3.5 h-3.5 text-rose-400" />
            <span>Axis:</span>
          </div>

          <div className="flex rounded-md p-0.5 bg-[var(--control-bg)] border border-[var(--border-subtle)]">
            {(['x', 'y', 'z'] as const).map((axis) => (
              <button
                key={axis}
                onClick={() => onUpdateSection({ ...sectionConfig, axis })}
                className={`px-2 py-0.5 rounded text-[11px] font-mono uppercase transition-colors ${
                  sectionConfig.axis === axis
                    ? 'bg-rose-500 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {axis}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-32">
            <Slider.Root
              className="relative flex items-center select-none touch-none w-full h-4"
              value={[sectionConfig.position]}
              max={15}
              min={-5}
              step={0.1}
              onValueChange={([val]) => onUpdateSection({ ...sectionConfig, position: val })}
            >
              <Slider.Track className="bg-[var(--control-bg)] relative grow rounded-full h-1">
                <Slider.Range className="absolute bg-rose-500 rounded-full h-full" />
              </Slider.Track>
              <Slider.Thumb className="block w-3.5 h-3.5 bg-white rounded-full shadow hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-rose-400 cursor-grab active:cursor-grabbing" />
            </Slider.Root>
            <span className="font-mono text-[10px] text-slate-400 w-8 tabular-nums">
              {sectionConfig.position.toFixed(1)}m
            </span>
          </div>

          <button
            onClick={() => onUpdateSection({ ...sectionConfig, inverted: !sectionConfig.inverted })}
            className={`text-[10px] px-2 py-1 rounded border transition-colors ${
              sectionConfig.inverted
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'text-slate-400 border-[var(--border-subtle)] hover:text-white'
            }`}
          >
            Flip
          </button>
        </div>
      )}

      {/* Main Floating Tool Dock */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--dock-translucent)] backdrop-blur-xl border border-[var(--border-subtle)] shadow-[var(--shadow-hud)] text-xs text-slate-200">
        {/* Transform Mode Group */}
        <div className="flex items-center gap-1 pr-1.5 border-r border-[var(--border-subtle)]">
          <button
            onClick={() => onSetTransformMode('select')}
            className={`p-2 rounded-full transition-all ${
              transformMode === 'select'
                ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
            }`}
            title="Select Mode (Space)"
          >
            <MousePointer className="w-4 h-4" />
          </button>

          <button
            onClick={() => onSetTransformMode('translate')}
            className={`p-2 rounded-full transition-all ${
              transformMode === 'translate'
                ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
            }`}
            title="Translate / Move (G)"
          >
            <Move className="w-4 h-4" />
          </button>

          <button
            onClick={() => onSetTransformMode('rotate')}
            className={`p-2 rounded-full transition-all ${
              transformMode === 'rotate'
                ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
            }`}
            title="Rotate Mode (R)"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => onSetTransformMode('scale')}
            className={`p-2 rounded-full transition-all ${
              transformMode === 'scale'
                ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
            }`}
            title="Scale Mode (S)"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Snap Toggle */}
        <button
          onClick={onToggleSnap}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full transition-colors ${
            snapEnabled
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
          }`}
          title="Toggle Grid Snapping"
        >
          <Grid className="w-3.5 h-3.5" />
          <span className="text-[10px] font-mono">Snap</span>
        </button>

        <div className="h-4 w-[1px] bg-[var(--border-subtle)]" />

        {/* BIM Tools: Section Plane */}
        <div className="flex items-center">
          <button
            onClick={() => {
              const nextState = !sectionConfig.enabled;
              onUpdateSection({ ...sectionConfig, enabled: nextState });
              setIsSectionFlyoutOpen(nextState);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-colors ${
              sectionConfig.enabled
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
            }`}
            title="Toggle Orthogonal Section Cut"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium hidden sm:inline">Section</span>
          </button>
        </div>

        {/* BIM Tools: Measurement Ruler */}
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleMeasure}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-colors ${
              isMeasureActive
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
            }`}
            title="Toggle 3D Point-to-Point Measurement Laser"
          >
            <Ruler className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium hidden sm:inline">Measure</span>
            {measurementCount > 0 && (
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/30 text-emerald-200 font-mono">
                {measurementCount}
              </span>
            )}
          </button>

          {measurementCount > 0 && (
            <button
              onClick={onClearMeasurements}
              className="p-1 rounded-full text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Clear all measurements"
            >
              <Trash2 className="w-3 h-3 text-red-400" />
            </button>
          )}
        </div>

        <div className="h-4 w-[1px] bg-[var(--border-subtle)]" />

        {/* Render Style Dropdown */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="p-2 rounded-full text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)] transition-colors"
              title={`Render Style: ${renderStyle}`}
            >
              <Layers className="w-4 h-4" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              sideOffset={10}
              align="center"
              className="w-40 bg-[var(--dock-bg)] border border-[var(--border-subtle)] rounded-xl shadow-[var(--shadow-hud)] p-1 text-xs text-slate-200 backdrop-blur-xl z-50"
            >
              <div className="px-2 py-1 text-[10px] uppercase font-semibold text-slate-400">
                Render Style
              </div>
              {[
                { id: 'shaded', label: 'Shaded Materials' },
                { id: 'wireframe', label: 'Wireframe CAD' },
                { id: 'monochrome', label: 'Monochrome Clay' }
              ].map((style) => (
                <DropdownMenu.Item
                  key={style.id}
                  onSelect={() => onSetRenderStyle(style.id as RenderStyle)}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors outline-none ${
                    renderStyle === style.id
                      ? 'bg-cyan-500/15 text-cyan-300 font-medium'
                      : 'hover:bg-[var(--control-hover)] hover:text-white text-slate-300'
                  }`}
                >
                  <span>{style.label}</span>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {/* Camera Preset Dropdown */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="p-2 rounded-full text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)] transition-colors"
              title="Camera Orientation Presets"
            >
              <Camera className="w-4 h-4" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              sideOffset={10}
              align="center"
              className="w-40 bg-[var(--dock-bg)] border border-[var(--border-subtle)] rounded-xl shadow-[var(--shadow-hud)] p-1 text-xs text-slate-200 backdrop-blur-xl z-50"
            >
              <div className="px-2 py-1 text-[10px] uppercase font-semibold text-slate-400">
                Camera Preset
              </div>
              {[
                { id: 'iso', label: 'Isometric 3D' },
                { id: 'top', label: 'Top View (Plan)' },
                { id: 'front', label: 'Front Elevation' },
                { id: 'side', label: 'Side Elevation' }
              ].map((preset) => (
                <DropdownMenu.Item
                  key={preset.id}
                  onSelect={() => onCameraPreset(preset.id as CameraPreset)}
                  className="px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-[var(--control-hover)] hover:text-white text-slate-300 transition-colors outline-none"
                >
                  <span>{preset.label}</span>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
};
