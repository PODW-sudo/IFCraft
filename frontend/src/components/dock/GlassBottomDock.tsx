import React, { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Slider from '@radix-ui/react-slider';
import {
  Ruler,
  Scissors,
  Grid,
  Camera,
  Layers,
  Trash2,
  Undo2,
  Redo2,
  Box,
  MousePointer,
  Move,
  RotateCw,
  Square,
  Columns,
  DoorOpen,
  AppWindow,
  Sliders,
  History,
  FolderTree,
  SlidersHorizontal,
  Sparkles,
  Crosshair
} from 'lucide-react';
import type { TransformMode } from '../viewer/ThreeViewport';
import type { SectionPlaneConfig, CameraPreset, RenderStyle } from '../../types/viewport';
import type { CadToolMode, CadHistoryItem } from '../../types/ifc';
import type { UiProfile, CustomProfileSettings } from '../../types/profiles';

interface GlassBottomDockProps {
  transformMode: TransformMode;
  onSetTransformMode: (mode: TransformMode) => void;
  cadToolMode?: CadToolMode;
  onSelectCadTool?: (mode: CadToolMode) => void;
  wallHeight?: number;
  setWallHeight?: (v: number) => void;
  wallThickness?: number;
  setWallThickness?: (v: number) => void;
  cadHistory?: CadHistoryItem[];
  onRefreshCadHistory?: () => void;
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
  isTreeOpen?: boolean;
  onToggleTree?: () => void;
  isPropertyOpen?: boolean;
  onToggleProperty?: () => void;
  isCopilotOpen?: boolean;
  onToggleCopilot?: () => void;
  isClashOpen?: boolean;
  onToggleClash?: () => void;
  isCadOpen?: boolean;
}

export const GlassBottomDock: React.FC<GlassBottomDockProps> = ({
  transformMode,
  onSetTransformMode,
  cadToolMode = 'select',
  onSelectCadTool,
  isCadOpen = true,
  wallHeight = 3.0,
  setWallHeight,
  wallThickness = 0.2,
  setWallThickness,
  cadHistory = [],
  onRefreshCadHistory,
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
  rightDrawerOffset = 0,
  isTreeOpen = false,
  onToggleTree,
  isPropertyOpen = false,
  onToggleProperty,
  isCopilotOpen = false,
  onToggleCopilot,
  isClashOpen = false,
  onToggleClash
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const effectiveLeft = leftDrawerOffset || 0;
  const effectiveRight = rightDrawerOffset || 0;
  const centerShift = (effectiveLeft - effectiveRight) / 2;

  const dockStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '16px',
    left: '50%',
    transform: `translateX(calc(-50% + ${centerShift}px))`,
    zIndex: 30,
  };

  const getHelperText = (mode: CadToolMode) => {
    switch (mode) {
      case 'wall':
        return 'Click ground to set start point, click again to finish';
      case 'slab':
        return 'Click corner 1 on ground, click corner 2 to create slab';
      case 'column':
        return 'Click anywhere on ground plane to place vertical column';
      case 'door':
        return 'Click along any existing wall to cut opening & insert door';
      case 'window':
        return 'Click along any existing wall to cut opening & insert window';
      default:
        return 'Select mode active (select and transform elements)';
    }
  };

  const isCadActive = (profile === 'modify' && isCadOpen !== false) || (profile === 'custom' && Boolean(customSettings?.showCadToolbar));
  const showSnap = isCadActive || (profile === 'custom' && customSettings?.showSnap !== false);
  const showSection = profile === 'custom' ? customSettings?.showSection !== false : true;
  const showMeasure = profile === 'custom' ? customSettings?.showMeasure !== false : true;

  const cadTools: { id: CadToolMode; label: string; icon: React.ReactNode; shortcut: string }[] = [
    { id: 'select', label: 'Select', icon: <MousePointer size={13} />, shortcut: 'Esc' },
    { id: 'wall', label: 'Wall', icon: <Square size={13} className="rotate-45" />, shortcut: 'W' },
    { id: 'slab', label: 'Slab', icon: <Square size={13} />, shortcut: 'S' },
    { id: 'column', label: 'Column', icon: <Columns size={13} />, shortcut: 'C' },
    { id: 'door', label: 'Door', icon: <DoorOpen size={13} />, shortcut: 'D' },
    { id: 'window', label: 'Window', icon: <AppWindow size={13} />, shortcut: 'Shift+W' },
  ];

  return (
    <div
      style={dockStyle}
      className="z-30 flex flex-col items-center gap-1.5 select-none transition-[transform] duration-200 pointer-events-auto"
      data-qa="spatial-bottom-dock"
      data-qa-dock="glass-bottom-dock"
      data-qa-draggable-hud="bottom-dock"
    >
      {/* Helper Status Tip for Active CAD Tool */}
      {isCadActive && cadToolMode !== 'select' && (
        <div
          data-qa="cad-status-banner"
          className="whitespace-nowrap px-3 py-1 rounded-full glass-card bg-[var(--glass-surface-card)] backdrop-blur-xl border border-[var(--glass-border)] text-xs font-medium text-slate-700 dark:text-slate-200 shadow-xl pointer-events-none animate-in fade-in slide-in-from-bottom-1"
        >
          {getHelperText(cadToolMode)}
        </div>
      )}

      {/* Section Plane Control Card (Floating Glass Card when active) */}
      {sectionConfig.enabled && (
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl glass-card bg-[var(--glass-surface-card)] backdrop-blur-2xl border border-[var(--glass-border)] shadow-2xl text-xs text-slate-800 dark:text-slate-200 animate-in fade-in-50 slide-in-from-bottom-2">
          <div className="flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
            <Scissors className="w-3.5 h-3.5 text-rose-500" />
            <span className="text-[11px]">Axis:</span>
          </div>

          <div className="flex rounded-xl p-0.5 bg-white/60 dark:bg-slate-800/60 border border-white/60 dark:border-white/10">
            {(['x', 'y', 'z'] as const).map((axis) => (
              <button
                key={axis}
                data-qa={`section-axis-${axis}`}
                onClick={() => onUpdateSection({ ...sectionConfig, axis })}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-mono uppercase transition-colors cursor-pointer ${
                  sectionConfig.axis === axis
                    ? 'bg-rose-500 text-white font-bold shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {axis}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-28">
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
            className={`text-[10px] px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
              sectionConfig.inverted
                ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40'
                : 'text-slate-600 dark:text-slate-400 border-white/60 dark:border-white/10 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Flip
          </button>
        </div>
      )}

      {/* Flyout: Parametric Settings for CAD Wall & Slab */}
      {showSettings && (
        <div
          data-qa="cad-settings-card"
          className="flex items-center gap-3 px-3.5 py-1.5 rounded-2xl glass-card bg-[var(--glass-surface-card)] backdrop-blur-2xl border border-[var(--glass-border)] shadow-2xl text-xs text-slate-800 dark:text-slate-200 animate-in fade-in-50 slide-in-from-bottom-2"
        >
          <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">Parametric Defaults:</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500">Height:</span>
            <input
              data-qa="cad-wall-height-input"
              type="number"
              step="0.1"
              min="0.5"
              max="20.0"
              value={wallHeight}
              onChange={(e) => setWallHeight?.(parseFloat(e.target.value) || 3.0)}
              className="w-14 px-1.5 py-0.5 rounded-lg bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-right font-mono text-[11px]"
            />
            <span className="text-[10px] text-slate-400">m</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500">Thickness:</span>
            <input
              data-qa="cad-wall-thickness-input"
              type="number"
              step="0.05"
              min="0.05"
              max="2.0"
              value={wallThickness}
              onChange={(e) => setWallThickness?.(parseFloat(e.target.value) || 0.2)}
              className="w-14 px-1.5 py-0.5 rounded-lg bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-right font-mono text-[11px]"
            />
            <span className="text-[10px] text-slate-400">m</span>
          </div>
        </div>
      )}

      {/* Flyout: CAD History Card */}
      {showHistory && (
        <div
          data-qa="cad-history-card"
          className="w-72 max-h-48 overflow-y-auto p-2.5 rounded-2xl glass-card bg-[var(--glass-surface-card)] backdrop-blur-2xl border border-[var(--glass-border)] shadow-2xl flex flex-col gap-1.5 text-xs text-slate-800 dark:text-slate-200 animate-in fade-in-50 slide-in-from-bottom-2"
        >
          <div className="flex items-center justify-between font-semibold pb-1 border-b border-slate-200 dark:border-slate-800 text-[11px]">
            <span>Transaction Stack</span>
            <span className="text-[10px] text-slate-400 font-mono">{cadHistory.length} events</span>
          </div>
          {cadHistory.length === 0 ? (
            <div className="text-center py-2 text-slate-400 italic text-[11px]">No CAD actions</div>
          ) : (
            <div className="flex flex-col gap-1">
              {cadHistory.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-1.5 rounded-lg border text-[10px] ${
                    item.status === 'ACTIVE'
                      ? 'bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                      : 'opacity-50 line-through'
                  }`}
                >
                  <span className="font-medium">{item.action_type}</span>
                  <span className="font-mono text-slate-400">#{item.express_id}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Role-Adaptive Frosted Glass Bottom Dock */}
      <div
        data-qa={isCadActive ? 'cad-toolbar' : undefined}
        data-qa-cad-mode={isCadActive ? cadToolMode : undefined}
        className="flex items-center gap-1 px-3 py-1 rounded-full glass-dock bg-[var(--glass-surface-dock)] backdrop-blur-2xl border border-[var(--glass-border)] shadow-2xl shadow-slate-900/10 text-xs text-slate-800 dark:text-slate-200"
      >
        {/* Hidden drag anchor for QA test harness */}
        <span data-drag-handle="true" className="sr-only" aria-hidden="true" />

        {/* Active Selection Chip */}
        {selectedExpressID !== null && (
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-700 dark:text-cyan-300 font-mono text-[10px]"
            title={`Selected Element #${selectedExpressID}`}
          >
            <Box className="w-3 h-3 text-blue-600 dark:text-cyan-400" />
            <span>#{selectedExpressID}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ROLE A: REVIEW PROFILE (Pure Viewport Inspection & Model Navigation)     */}
        {/* ========================================================================= */}
        {(profile === 'review' || (profile === 'modify' && !isCadActive)) && (
          <>
            {/* Select Tool */}
            <button
              type="button"
              data-qa="transform-mode-select"
              data-qa-btn="tool-select"
              onClick={() => onSetTransformMode('select')}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                transformMode === 'select'
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
              }`}
              title="Select Mode (Esc)"
            >
              <MousePointer className="w-3.5 h-3.5" />
            </button>

            {/* Camera Orientation Presets Dropdown */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  data-qa="dock-camera-preset-trigger"
                  className="p-1.5 rounded-full text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  title="Camera Orientation Presets"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  sideOffset={10}
                  align="center"
                  className="w-40 bg-white/90 dark:bg-slate-900/95 border border-white/80 dark:border-white/10 rounded-2xl shadow-2xl p-1 text-xs text-slate-800 dark:text-slate-200 backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95"
                >
                  <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-400">Camera Preset</div>
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

            {/* Render Style Dropdown */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  data-qa="dock-render-style-trigger"
                  className="p-1.5 rounded-full text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  title={`Render Style: ${renderStyle}`}
                >
                  <Layers className="w-3.5 h-3.5" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  sideOffset={10}
                  align="center"
                  className="w-40 bg-white/90 dark:bg-slate-900/95 border border-white/80 dark:border-white/10 rounded-2xl shadow-2xl p-1 text-xs text-slate-800 dark:text-slate-200 backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95"
                >
                  <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-400">Render Style</div>
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

            <div className="h-3.5 w-px bg-slate-300 dark:bg-slate-700" />

            {/* Model Tree Drawer Toggle */}
            {onToggleTree && (
              <button
                type="button"
                data-qa="dock-tree-toggle"
                onClick={onToggleTree}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  isTreeOpen
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
                }`}
                title="Model Hierarchy Tree"
              >
                <FolderTree className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Property Inspector Drawer Toggle */}
            {onToggleProperty && (
              <button
                type="button"
                data-qa="dock-property-toggle"
                onClick={onToggleProperty}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  isPropertyOpen
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
                }`}
                title="Property Inspector"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Clash Inspector Toggle */}
            {onToggleClash && (
              <button
                type="button"
                data-qa="dock-clash-toggle"
                onClick={onToggleClash}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  isClashOpen
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
                }`}
                title="Clash Detection"
              >
                <Crosshair className="w-3.5 h-3.5" />
              </button>
            )}

            {/* AI Copilot Toggle */}
            {onToggleCopilot && (
              <button
                type="button"
                data-qa="dock-copilot-toggle"
                onClick={onToggleCopilot}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  isCopilotOpen
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
                }`}
                title="AI Copilot"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        )}

        {/* ========================================================================= */}
        {/* ROLE B: MODIFY PROFILE (CAD Modeling, Drafting & Parametric Authoring)   */}
        {/* ========================================================================= */}
        {isCadActive && (
          <div className="flex items-center gap-1">
            {/* Transform Modes Segment */}
            <div className="flex items-center rounded-full p-0.5 bg-white/40 dark:bg-slate-800/40 border border-white/50 dark:border-white/5">
              <button
                type="button"
                data-qa="transform-mode-select"
                data-qa-btn="tool-select"
                onClick={() => {
                  onSetTransformMode('select');
                  onSelectCadTool?.('select');
                }}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  transformMode === 'select' && cadToolMode === 'select'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Select Mode (Esc)"
              >
                <MousePointer className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                data-qa="transform-mode-translate"
                data-qa-btn="tool-translate"
                onClick={() => onSetTransformMode('translate')}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  transformMode === 'translate'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Translate Gizmo (G)"
              >
                <Move className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                data-qa="transform-mode-rotate"
                data-qa-btn="tool-rotate"
                onClick={() => onSetTransformMode('rotate')}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  transformMode === 'rotate'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Rotate Gizmo (R)"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>

              {showSnap && (
                <button
                  type="button"
                  data-qa="dock-snap-toggle"
                  onClick={onToggleSnap}
                  className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                    snapEnabled
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Toggle Grid Snapping"
                >
                  <Grid className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="h-3.5 w-px bg-slate-300 dark:bg-slate-700" />

            {/* Architectural CAD Primitives (Compact 13px Icons) */}
            <div className="flex items-center gap-0.5">
              {cadTools.filter(t => t.id !== 'select').map((t) => {
                const isActive = cadToolMode === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    data-qa={`cad-tool-${t.id}`}
                    onClick={() => onSelectCadTool?.(t.id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
                    }`}
                    title={`${t.label} (${t.shortcut})`}
                  >
                    {t.icon}
                    <span className="hidden sm:inline">{t.label}</span>
                  </button>
                );
              })}

              {/* Parametric Settings Flyout Toggle */}
              <button
                type="button"
                data-qa="cad-settings-btn"
                onClick={() => {
                  setShowSettings(!showSettings);
                  if (!showSettings) setShowHistory(false);
                }}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  showSettings
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
                }`}
                title="CAD Parametric Settings (Height, Thickness)"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="h-3.5 w-px bg-slate-300 dark:bg-slate-700" />

            {/* Undo / Redo / History */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                data-qa="cad-undo-btn"
                data-qa-btn="dock-undo-btn"
                disabled={!canUndo}
                onClick={onUndo}
                title="Undo (Ctrl+Z)"
                className={`p-1.5 rounded-full transition-colors ${
                  canUndo
                    ? 'text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60 cursor-pointer active:scale-95'
                    : 'text-slate-400/40 dark:text-slate-600/40 cursor-not-allowed'
                }`}
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                data-qa="cad-redo-btn"
                data-qa-btn="dock-redo-btn"
                disabled={!canRedo}
                onClick={onRedo}
                title="Redo (Ctrl+Y)"
                className={`p-1.5 rounded-full transition-colors ${
                  canRedo
                    ? 'text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60 cursor-pointer active:scale-95'
                    : 'text-slate-400/40 dark:text-slate-600/40 cursor-not-allowed'
                }`}
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                data-qa="cad-history-btn"
                onClick={() => {
                  onRefreshCadHistory?.();
                  setShowHistory(!showHistory);
                  if (!showHistory) setShowSettings(false);
                }}
                title="Transaction Stack"
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  showHistory
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/60'
                }`}
              >
                <History className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="h-3.5 w-px bg-slate-300 dark:bg-slate-700" />

            {/* Panel & Drawer Fast Access in Modify Profile */}
            <div className="flex items-center gap-0.5">
              {onToggleTree && (
                <button
                  type="button"
                  data-qa="dock-tree-toggle"
                  onClick={onToggleTree}
                  className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                    isTreeOpen
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
                  }`}
                  title="Model Hierarchy Tree"
                >
                  <FolderTree className="w-3.5 h-3.5" />
                </button>
              )}

              {onToggleProperty && (
                <button
                  type="button"
                  data-qa="dock-property-toggle"
                  onClick={onToggleProperty}
                  className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                    isPropertyOpen
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
                  }`}
                  title="Property Inspector"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>
              )}

              {onToggleClash && (
                <button
                  type="button"
                  data-qa="dock-clash-toggle"
                  onClick={onToggleClash}
                  className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                    isClashOpen
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
                  }`}
                  title="Clash Detection"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                </button>
              )}

              {onToggleCopilot && (
                <button
                  type="button"
                  data-qa="dock-copilot-toggle"
                  onClick={onToggleCopilot}
                  className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                    isCopilotOpen
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
                  }`}
                  title="AI Copilot"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ROLE C: QUERY PROFILE (BIM Hierarchy, Properties, Data Audit)            */}
        {/* ========================================================================= */}
        {profile === 'query' && (
          <>
            {/* Model Tree Toggle */}
            {onToggleTree && (
              <button
                type="button"
                data-qa="dock-tree-toggle"
                onClick={onToggleTree}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] transition-colors cursor-pointer ${
                  isTreeOpen
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
                }`}
                title="Spatial Hierarchy Tree"
              >
                <FolderTree className="w-3.5 h-3.5" />
                <span>Tree</span>
              </button>
            )}

            {/* Property Inspector Toggle */}
            {onToggleProperty && (
              <button
                type="button"
                data-qa="dock-property-toggle"
                onClick={onToggleProperty}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] transition-colors cursor-pointer ${
                  isPropertyOpen
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
                }`}
                title="Property Inspector"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Properties</span>
              </button>
            )}

            <div className="h-3.5 w-px bg-slate-300 dark:bg-slate-700" />

            {/* Render Style */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  data-qa="dock-render-style-trigger"
                  className="p-1.5 rounded-full text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  title="Render Style"
                >
                  <Layers className="w-3.5 h-3.5" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  sideOffset={10}
                  align="center"
                  className="w-40 bg-white/90 dark:bg-slate-900/95 border border-white/80 dark:border-white/10 rounded-2xl shadow-2xl p-1 text-xs text-slate-800 dark:text-slate-200 backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95"
                >
                  <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-400">Render Style</div>
                  {[
                    { id: 'discipline', label: 'Discipline Mode' },
                    { id: 'shaded', label: 'Shaded Materials' },
                    { id: 'diff', label: 'Spatial Diff' }
                  ].map((style) => (
                    <DropdownMenu.Item
                      key={style.id}
                      data-qa={`render-style-${style.id}`}
                      onSelect={() => onSetRenderStyle(style.id as RenderStyle)}
                      className="px-2.5 py-1.5 rounded-xl cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300 transition-colors outline-none"
                    >
                      <span>{style.label}</span>
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </>
        )}

        {/* ========================================================================= */}
        {/* ROLE D: CUSTOM PROFILE (User-Configured Modular Workspace)                */}
        {/* ========================================================================= */}
        {profile === 'custom' && (
          <div className="flex items-center gap-1">
            {/* CAD Tools if enabled */}
            {customSettings?.showCadToolbar && (
              <>
                <div className="flex items-center rounded-full p-0.5 bg-white/40 dark:bg-slate-800/40 border border-white/50 dark:border-white/5">
                  <button
                    type="button"
                    data-qa="transform-mode-select"
                    data-qa-btn="tool-select"
                    onClick={() => {
                      onSetTransformMode('select');
                      onSelectCadTool?.('select');
                    }}
                    className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                      transformMode === 'select' && cadToolMode === 'select'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    title="Select Mode (Esc)"
                  >
                    <MousePointer className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    data-qa="transform-mode-translate"
                    data-qa-btn="tool-translate"
                    onClick={() => onSetTransformMode('translate')}
                    className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                      transformMode === 'translate'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    title="Translate Gizmo (G)"
                  >
                    <Move className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    data-qa="transform-mode-rotate"
                    data-qa-btn="tool-rotate"
                    onClick={() => onSetTransformMode('rotate')}
                    className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                      transformMode === 'rotate'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    title="Rotate Gizmo (R)"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="h-3.5 w-px bg-slate-300 dark:bg-slate-700" />

                <div className="flex items-center gap-0.5">
                  {cadTools.filter(t => t.id !== 'select').map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      data-qa={`cad-tool-${t.id}`}
                      onClick={() => onSelectCadTool?.(t.id)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] transition-colors cursor-pointer ${
                        cadToolMode === t.id
                          ? 'bg-blue-600 text-white shadow-xs font-semibold'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
                      }`}
                      title={`${t.label} (${t.shortcut})`}
                    >
                      {t.icon}
                      <span className="hidden sm:inline">{t.label}</span>
                    </button>
                  ))}
                </div>

                <div className="h-3.5 w-px bg-slate-300 dark:bg-slate-700" />

                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    data-qa="cad-undo-btn"
                    disabled={!canUndo}
                    onClick={onUndo}
                    title="Undo (Ctrl+Z)"
                    className={`p-1.5 rounded-full transition-colors ${
                      canUndo
                        ? 'text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60 cursor-pointer active:scale-95'
                        : 'text-slate-400/40 dark:text-slate-600/40 cursor-not-allowed'
                    }`}
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    data-qa="cad-redo-btn"
                    disabled={!canRedo}
                    onClick={onRedo}
                    title="Redo (Ctrl+Y)"
                    className={`p-1.5 rounded-full transition-colors ${
                      canRedo
                        ? 'text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60 cursor-pointer active:scale-95'
                        : 'text-slate-400/40 dark:text-slate-600/40 cursor-not-allowed'
                    }`}
                  >
                    <Redo2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}

            {/* Snapping if enabled */}
            {customSettings?.showSnap && (
              <button
                type="button"
                data-qa="dock-snap-toggle"
                onClick={onToggleSnap}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  snapEnabled
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Toggle Grid Snapping"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Camera Presets if enabled */}
            {customSettings?.showCameraPresets && (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    data-qa="dock-camera-trigger"
                    className="p-1.5 rounded-full text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                    title="Camera Orientation Presets"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    sideOffset={10}
                    align="center"
                    className="w-40 bg-white/90 dark:bg-slate-900/95 border border-white/80 dark:border-white/10 rounded-2xl shadow-2xl p-1 text-xs text-slate-800 dark:text-slate-200 backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95"
                  >
                    <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-400">Camera Preset</div>
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
            )}

            {/* Render Style if enabled */}
            {customSettings?.showRenderStyle && (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    data-qa="dock-render-style-trigger"
                    className="p-1.5 rounded-full text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                    title={`Render Style: ${renderStyle}`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    sideOffset={10}
                    align="center"
                    className="w-40 bg-white/90 dark:bg-slate-900/95 border border-white/80 dark:border-white/10 rounded-2xl shadow-2xl p-1 text-xs text-slate-800 dark:text-slate-200 backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95"
                  >
                    <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-400">Render Style</div>
                    {[
                      { id: 'discipline', label: 'Discipline Mode' },
                      { id: 'shaded', label: 'Shaded Materials' },
                      { id: 'diff', label: 'Spatial Diff' }
                    ].map((style) => (
                      <DropdownMenu.Item
                        key={style.id}
                        data-qa={`render-style-${style.id}`}
                        onSelect={() => onSetRenderStyle(style.id as RenderStyle)}
                        className="px-2.5 py-1.5 rounded-xl cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300 transition-colors outline-none"
                      >
                        <span>{style.label}</span>
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}

            {/* Spatial Tree if enabled */}
            {customSettings?.showTreeDrawer && onToggleTree && (
              <button
                type="button"
                data-qa="dock-tree-toggle"
                onClick={onToggleTree}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  isTreeOpen
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
                }`}
                title="Spatial Hierarchy Tree"
              >
                <FolderTree className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Properties Inspector if enabled */}
            {customSettings?.showPropertyInspector && onToggleProperty && (
              <button
                type="button"
                data-qa="dock-property-toggle"
                onClick={onToggleProperty}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  isPropertyOpen
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
                }`}
                title="Property Inspector"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        <div className="h-3.5 w-px bg-slate-300 dark:bg-slate-700" />

        {/* Global Common Utilities: Measure & Section */}
        {/* Measure Tool */}
        {showMeasure && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              data-qa="dock-measure-toggle"
              onClick={onToggleMeasure}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                isMeasureActive
                  ? 'bg-emerald-600 text-white shadow-xs font-medium'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
              }`}
              title="Laser Measure (Point-to-Point)"
            >
              <Ruler className="w-3.5 h-3.5" />
            </button>

            {measurementCount > 0 && (
              <button
                type="button"
                data-qa="dock-clear-measurements"
                onClick={onClearMeasurements}
                className="p-1 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                title="Clear all measurements"
              >
                <Trash2 className="w-3 h-3 text-rose-500" />
              </button>
            )}
          </div>
        )}

        {/* Section Cut Toggle */}
        {showSection && (
          <button
            type="button"
            data-qa="dock-section-toggle"
            onClick={() => {
              const nextState = !sectionConfig.enabled;
              onUpdateSection({ ...sectionConfig, enabled: nextState });
            }}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              sectionConfig.enabled
                ? 'bg-rose-600 text-white shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
            }`}
            title="Toggle Orthogonal Section Plane"
          >
            <Scissors className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
export default GlassBottomDock;
