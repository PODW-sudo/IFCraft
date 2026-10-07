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
  Maximize2,
  GripVertical,
  Square,
  Columns,
  DoorOpen,
  AppWindow,
  Undo2,
  Redo2,
  Hammer
} from 'lucide-react';
import type { TransformMode } from '../viewer/ThreeViewport';
import type { SectionPlaneConfig, CameraPreset, RenderStyle } from '../tools/BimToolsToolbar';
import type { CadToolMode } from '../../types/ifc';
import { useDraggableHud } from '../hud/HudLayoutContext';

interface SpatialBottomDockProps {
  transformMode: TransformMode;
  onSetTransformMode: (mode: TransformMode) => void;
  cadToolMode?: CadToolMode;
  onSelectCadTool?: (mode: CadToolMode) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
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

type DockCategory = 'transform' | 'model' | 'inspect';

export const SpatialBottomDock: React.FC<SpatialBottomDockProps> = ({
  transformMode,
  onSetTransformMode,
  cadToolMode = 'select',
  onSelectCadTool,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
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
  // Automatically switch tab if cadToolMode changes
  const [activeCategory, setActiveCategory] = useState<DockCategory>(
    cadToolMode !== 'select' ? 'model' : 'transform'
  );

  const initialWidth = 620;
  const initialHeight = 48;
  const initialX = typeof window !== 'undefined' ? Math.max(16, (window.innerWidth - initialWidth) / 2) : 410;
  const initialY = typeof window !== 'undefined' ? Math.max(16, window.innerHeight - 80) : 820;

  const { ref, style, dragProps, isDragging } = useDraggableHud('bottom-dock', {
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
      className={`z-30 flex flex-col items-center gap-2 select-none transition-shadow ${
        isDragging ? 'shadow-cyan-500/20 ring-1 ring-cyan-500/40 cursor-grabbing' : 'cursor-grab'
      }`}
      data-qa="spatial-bottom-dock"
    >
      {/* Section Plane Floating Control Card (when section active) */}
      {sectionConfig.enabled && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[var(--dock-bg)] border border-[var(--border-subtle)] shadow-[var(--shadow-hud)] text-xs text-slate-200 animate-in fade-in-50 slide-in-from-bottom-2">
          <div className="flex items-center gap-1.5 font-medium text-slate-300">
            <Scissors className="w-3.5 h-3.5 text-rose-400" />
            <span>Axis:</span>
          </div>

          <div className="flex rounded-md p-0.5 bg-[var(--control-bg)] border border-[var(--border-subtle)]">
            {(['x', 'y', 'z'] as const).map((axis) => (
              <button
                key={axis}
                data-qa={`section-axis-${axis}`}
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
              data-qa="section-slider"
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
            data-qa="section-flip-btn"
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

      {/* Main Unified Floating Dock */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--dock-translucent)] backdrop-blur-xl border border-[var(--border-subtle)] shadow-[var(--shadow-hud)] text-xs text-slate-200">
        {/* Draggable Grip Handle */}
        <div
          data-drag-handle="true"
          className="flex items-center text-slate-500 hover:text-slate-300 pr-1 py-1 cursor-grab active:cursor-grabbing"
          title="Drag to reposition Bottom Dock"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        {/* Category Segmented Control */}
        <div className="flex items-center rounded-full bg-[var(--control-bg)]/80 p-0.5 border border-[var(--border-subtle)]/60 mr-1">
          <button
            data-qa="dock-tab-transform"
            onClick={() => {
              setActiveCategory('transform');
              if (onSelectCadTool) onSelectCadTool('select');
            }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
              activeCategory === 'transform'
                ? 'bg-cyan-500/20 text-cyan-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Transform
          </button>
          <button
            data-qa="dock-tab-model"
            onClick={() => setActiveCategory('model')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 ${
              activeCategory === 'model'
                ? 'bg-cyan-500/20 text-cyan-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Hammer size={12} />
            <span>Model</span>
          </button>
          <button
            data-qa="dock-tab-inspect"
            onClick={() => setActiveCategory('inspect')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
              activeCategory === 'inspect'
                ? 'bg-cyan-500/20 text-cyan-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Inspect
          </button>
        </div>

        <div className="h-4 w-[1px] bg-[var(--border-subtle)]" />

        {/* TAB CONTENT: TRANSFORM */}
        {activeCategory === 'transform' && (
          <div className="flex items-center gap-1 pr-1 border-r border-[var(--border-subtle)]">
            <button
              data-qa="dock-mode-select"
              onClick={() => onSetTransformMode('select')}
              className={`p-1.5 rounded-full transition-all ${
                transformMode === 'select'
                  ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
              }`}
              title="Select Mode (Space)"
            >
              <MousePointer className="w-4 h-4" />
            </button>

            <button
              data-qa="dock-mode-translate"
              onClick={() => onSetTransformMode('translate')}
              className={`p-1.5 rounded-full transition-all ${
                transformMode === 'translate'
                  ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
              }`}
              title="Translate / Move (G)"
            >
              <Move className="w-4 h-4" />
            </button>

            <button
              data-qa="dock-mode-rotate"
              onClick={() => onSetTransformMode('rotate')}
              className={`p-1.5 rounded-full transition-all ${
                transformMode === 'rotate'
                  ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
              }`}
              title="Rotate Mode (R)"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            <button
              data-qa="dock-mode-scale"
              onClick={() => onSetTransformMode('scale')}
              className={`p-1.5 rounded-full transition-all ${
                transformMode === 'scale'
                  ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
              }`}
              title="Scale Mode (S)"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* TAB CONTENT: BIM MODEL */}
        {activeCategory === 'model' && onSelectCadTool && (
          <div className="flex items-center gap-1 pr-1 border-r border-[var(--border-subtle)]">
            <button
              data-qa="cad-tool-select"
              onClick={() => onSelectCadTool('select')}
              className={`p-1.5 rounded-full transition-all ${
                cadToolMode === 'select'
                  ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
              }`}
              title="Select / Transform (Esc)"
            >
              <MousePointer className="w-4 h-4" />
            </button>

            <button
              data-qa="cad-tool-wall"
              onClick={() => onSelectCadTool('wall')}
              className={`p-1.5 rounded-full transition-all ${
                cadToolMode === 'wall'
                  ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
              }`}
              title="Draw Parametric Wall (W)"
            >
              <Square className="w-4 h-4 rotate-45" />
            </button>

            <button
              data-qa="cad-tool-slab"
              onClick={() => onSelectCadTool('slab')}
              className={`p-1.5 rounded-full transition-all ${
                cadToolMode === 'slab'
                  ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
              }`}
              title="Draw Floor Slab (S)"
            >
              <Square className="w-4 h-4" />
            </button>

            <button
              data-qa="cad-tool-column"
              onClick={() => onSelectCadTool('column')}
              className={`p-1.5 rounded-full transition-all ${
                cadToolMode === 'column'
                  ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
              }`}
              title="Place Column (C)"
            >
              <Columns className="w-4 h-4" />
            </button>

            <button
              data-qa="cad-tool-door"
              onClick={() => onSelectCadTool('door')}
              className={`p-1.5 rounded-full transition-all ${
                cadToolMode === 'door'
                  ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
              }`}
              title="Cut Opening & Place Door (D)"
            >
              <DoorOpen className="w-4 h-4" />
            </button>

            <button
              data-qa="cad-tool-window"
              onClick={() => onSelectCadTool('window')}
              className={`p-1.5 rounded-full transition-all ${
                cadToolMode === 'window'
                  ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
              }`}
              title="Cut Opening & Place Window (Shift+W)"
            >
              <AppWindow className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* TAB CONTENT: INSPECT */}
        {activeCategory === 'inspect' && (
          <div className="flex items-center gap-1 pr-1 border-r border-[var(--border-subtle)]">
            {/* Section Plane Toggle */}
            <button
              data-qa="dock-section-toggle"
              onClick={() => {
                const nextState = !sectionConfig.enabled;
                onUpdateSection({ ...sectionConfig, enabled: nextState });
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

            {/* Render Style Dropdown */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  data-qa="dock-render-style-trigger"
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)] transition-colors"
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
                    { id: 'ghost', label: 'Ghost / X-Ray' },
                    { id: 'discipline', label: 'Discipline Mode' },
                    { id: 'diff', label: 'Spatial Diff' }
                  ].map((style) => (
                    <DropdownMenu.Item
                      key={style.id}
                      data-qa={`render-style-${style.id}`}
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
                  data-qa="dock-camera-preset-trigger"
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)] transition-colors"
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
                      data-qa={`camera-preset-${preset.id}`}
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
        )}

        {/* Global Snapping Toggle */}
        <button
          data-qa="dock-snap-toggle"
          onClick={onToggleSnap}
          className={`flex items-center gap-1 px-2 py-1 rounded-full transition-colors ${
            snapEnabled
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
          }`}
          title="Toggle Precision Snapping (Vertices, Edges, Midpoints)"
        >
          <Grid className="w-3.5 h-3.5" />
          <span className="text-[10px] font-mono">Snap</span>
        </button>

        {/* Laser Measure Tool */}
        <div className="flex items-center gap-1">
          <button
            data-qa="dock-measure-toggle"
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
              data-qa="dock-clear-measurements"
              onClick={onClearMeasurements}
              className="p-1 rounded-full text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Clear all measurements"
            >
              <Trash2 className="w-3 h-3 text-red-400" />
            </button>
          )}
        </div>

        {/* Undo / Redo Actions */}
        {(onUndo || onRedo) && (
          <div className="flex items-center gap-0.5 pl-1 border-l border-[var(--border-subtle)]">
            <button
              data-qa="cad-undo-btn"
              disabled={!canUndo}
              onClick={onUndo}
              title="Undo last action (Ctrl+Z)"
              className={`p-1.5 rounded-full transition-colors ${
                canUndo
                  ? 'text-slate-200 hover:bg-[var(--control-hover)]'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
            >
              <Undo2 size={13} />
            </button>
            <button
              data-qa="cad-redo-btn"
              disabled={!canRedo}
              onClick={onRedo}
              title="Redo last action (Ctrl+Y)"
              className={`p-1.5 rounded-full transition-colors ${
                canRedo
                  ? 'text-slate-200 hover:bg-[var(--control-hover)]'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
            >
              <Redo2 size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
