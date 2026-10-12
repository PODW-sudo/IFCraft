import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Slider from '@radix-ui/react-slider';
import {
  Ruler,
  Scissors,
  Grid,
  Camera,
  Layers,
  Trash2,
  GripVertical,
  Undo2,
  Redo2,
  Box
} from 'lucide-react';
import type { TransformMode } from '../viewer/ThreeViewport';
import type { SectionPlaneConfig, CameraPreset, RenderStyle } from '../../types/viewport';
import type { CadToolMode } from '../../types/ifc';
import type { UiProfile, CustomProfileSettings } from '../../types/profiles';
import { useDraggableHud } from '../hud/HudLayoutContext';

interface GlassBottomDockProps {
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
  profile?: UiProfile;
  customSettings?: CustomProfileSettings;
  selectedExpressID?: number | null;
  leftDrawerOffset?: number;
  rightDrawerOffset?: number;
}

export const GlassBottomDock: React.FC<GlassBottomDockProps> = ({
  transformMode: _transformMode,
  onSetTransformMode: _onSetTransformMode,
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
  onSetRenderStyle,
  profile = 'modify',
  customSettings,
  selectedExpressID = null,
  leftDrawerOffset = 0,
  rightDrawerOffset = 0
}) => {
  const [windowWidth, setWindowWidth] = React.useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1440
  );

  React.useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const effectiveLeft = leftDrawerOffset || 0;
  const effectiveRight = rightDrawerOffset || 0;
  const availableCanvasWidth = Math.max(300, windowWidth - effectiveLeft - effectiveRight);
  const initialWidth = Math.min(380, availableCanvasWidth - 24);
  const initialX = effectiveLeft + Math.max(12, (availableCanvasWidth - initialWidth) / 2);
  const initialY = typeof window !== 'undefined' ? Math.max(16, window.innerHeight - 76) : 830;

  const { ref, style, dragProps, isDragging } = useDraggableHud('bottom-dock', {
    x: initialX,
    y: initialY,
    width: initialWidth,
    height: 48
  });

  const showSnap = profile === 'modify' || (profile === 'custom' && customSettings?.showSnap !== false);
  const showSection = profile === 'custom' ? customSettings?.showSection !== false : profile !== 'query';
  const showUndoRedo = profile === 'modify' || (profile === 'custom' && customSettings?.showSnap !== false);

  return (
    <div
      ref={ref}
      style={style}
      {...dragProps}
      className={`z-25 flex flex-col items-center gap-2 select-none transition-shadow ${
        isDragging ? 'shadow-blue-500/20 ring-1 ring-blue-500/40 cursor-grabbing' : 'cursor-grab'
      }`}
      data-qa="spatial-bottom-dock"
      data-qa-dock="glass-bottom-dock"
    >
      {/* Section Plane Control Card (Floating Glass Card) */}
      {sectionConfig.enabled && (
        <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/80 dark:border-white/10 shadow-2xl text-xs text-slate-800 dark:text-slate-200 animate-in fade-in-50 slide-in-from-bottom-2">
          <div className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
            <Scissors className="w-3.5 h-3.5 text-rose-500" />
            <span>Axis:</span>
          </div>

          <div className="flex rounded-xl p-0.5 bg-white/60 dark:bg-slate-800/60 border border-white/60 dark:border-white/10">
            {(['x', 'y', 'z'] as const).map((axis) => (
              <button
                key={axis}
                data-qa={`section-axis-${axis}`}
                onClick={() => onUpdateSection({ ...sectionConfig, axis })}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-mono uppercase transition-colors cursor-pointer ${
                  sectionConfig.axis === axis
                    ? 'bg-rose-500 text-white font-bold shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
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
              <Slider.Track className="bg-slate-200 dark:bg-slate-700 relative grow rounded-full h-1">
                <Slider.Range className="absolute bg-rose-500 rounded-full h-full" />
              </Slider.Track>
              <Slider.Thumb className="block w-3.5 h-3.5 bg-white rounded-full shadow-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-rose-400 cursor-grab active:cursor-grabbing" />
            </Slider.Root>
            <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 w-8 tabular-nums">
              {sectionConfig.position.toFixed(1)}m
            </span>
          </div>

          <button
            data-qa="section-flip-btn"
            onClick={() => onUpdateSection({ ...sectionConfig, inverted: !sectionConfig.inverted })}
            className={`text-[10px] px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
              sectionConfig.inverted
                ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40'
                : 'text-slate-600 dark:text-slate-400 border-white/60 dark:border-white/10 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Flip
          </button>
        </div>
      )}

      {/* Main Floating Frosted Glass Action Dock */}
      <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/70 dark:bg-slate-900/75 backdrop-blur-2xl border border-white/80 dark:border-white/10 shadow-2xl shadow-slate-900/10 text-xs text-slate-800 dark:text-slate-200">
        {/* Draggable Grip Handle */}
        <div
          data-drag-handle="true"
          className="flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 pr-1 py-1 cursor-grab active:cursor-grabbing"
          title="Drag to reposition Bottom Dock"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        {/* Active Selection Chip */}
        {selectedExpressID !== null && (
          <div
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-700 dark:text-cyan-300 font-mono text-[11px]"
            title={`Selected Element #${selectedExpressID}`}
          >
            <Box className="w-3 h-3 text-blue-600 dark:text-cyan-400" />
            <span className={availableCanvasWidth < 600 ? 'hidden' : 'inline'}>#{selectedExpressID}</span>
          </div>
        )}

        {/* Global Snapping Toggle */}
        {showSnap && (
          <button
            data-qa="dock-snap-toggle"
            onClick={onToggleSnap}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition-colors cursor-pointer ${
              snapEnabled
                ? 'bg-blue-600 text-white shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
            }`}
            title="Toggle Precision Snapping (Vertices, Edges, Midpoints)"
          >
            <Grid className="w-3.5 h-3.5" />
            <span className={`text-[10px] font-mono ${availableCanvasWidth < 680 ? 'hidden' : 'hidden sm:inline'}`}>Snap</span>
          </button>
        )}

        {/* Laser Measure Tool */}
        <div className="flex items-center gap-0.5">
          <button
            data-qa="dock-measure-toggle"
            onClick={onToggleMeasure}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors cursor-pointer ${
              isMeasureActive
                ? 'bg-emerald-600 text-white shadow-xs font-medium'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
            }`}
            title="Toggle 3D Point-to-Point Laser Measure"
          >
            <Ruler className="w-3.5 h-3.5" />
            <span className={`text-[11px] font-medium ${availableCanvasWidth < 680 ? 'hidden' : 'hidden sm:inline'}`}>Measure</span>
            {measurementCount > 0 && (
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/30 text-emerald-900 dark:text-emerald-100 font-mono">
                {measurementCount}
              </span>
            )}
          </button>

          {measurementCount > 0 && (
            <button
              data-qa="dock-clear-measurements"
              onClick={onClearMeasurements}
              className="p-1 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
              title="Clear all measurements"
            >
              <Trash2 className="w-3 h-3 text-rose-500" />
            </button>
          )}
        </div>

        {/* Section Cut Toggle */}
        {showSection && (
          <button
            data-qa="dock-section-toggle"
            onClick={() => {
              const nextState = !sectionConfig.enabled;
              onUpdateSection({ ...sectionConfig, enabled: nextState });
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors cursor-pointer ${
              sectionConfig.enabled
                ? 'bg-rose-600 text-white shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
            }`}
            title="Toggle Orthogonal Section Cut"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span className={`text-[11px] font-medium ${availableCanvasWidth < 680 ? 'hidden' : 'hidden sm:inline'}`}>Section</span>
          </button>
        )}

        <div className="h-4 w-[1px] bg-slate-300 dark:bg-slate-700" />

        {/* Render Style Dropdown */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              data-qa="dock-render-style-trigger"
              className="p-1.5 rounded-full text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
              title={`Render Style: ${renderStyle}`}
            >
              <Layers className="w-4 h-4" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              sideOffset={10}
              align="center"
              className="w-44 bg-white/90 dark:bg-slate-900/95 border border-white/80 dark:border-white/10 rounded-2xl shadow-2xl p-1 text-xs text-slate-800 dark:text-slate-200 backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95"
            >
              <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-400">
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
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer transition-colors outline-none ${
                    renderStyle === style.id
                      ? 'bg-blue-600 text-white font-medium shadow-xs'
                      : 'hover:bg-blue-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>{style.label}</span>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {/* Camera Orientation Presets Dropdown */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              data-qa="dock-camera-preset-trigger"
              className="p-1.5 rounded-full text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
              title="Camera Orientation Presets (ISO, Top, Front, Side)"
            >
              <Camera className="w-4 h-4" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              sideOffset={10}
              align="center"
              className="w-44 bg-white/90 dark:bg-slate-900/95 border border-white/80 dark:border-white/10 rounded-2xl shadow-2xl p-1 text-xs text-slate-800 dark:text-slate-200 backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95"
            >
              <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-400">
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
                  className="px-2.5 py-1.5 rounded-xl cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300 transition-colors outline-none"
                >
                  <span>{preset.label}</span>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {/* Undo / Redo Actions */}
        {showUndoRedo && (onUndo || onRedo) && (
          <div className="flex items-center gap-0.5 pl-1 border-l border-slate-300 dark:border-slate-700">
            <button
              data-qa="cad-undo-btn"
              disabled={!canUndo}
              onClick={onUndo}
              title="Undo last action (Ctrl+Z)"
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                canUndo
                  ? 'text-slate-700 dark:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50'
                  : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
              }`}
            >
              <Undo2 size={13} />
            </button>
            <button
              data-qa="cad-redo-btn"
              disabled={!canRedo}
              onClick={onRedo}
              title="Redo last action (Ctrl+Y)"
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                canRedo
                  ? 'text-slate-700 dark:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50'
                  : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
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
export default GlassBottomDock;
