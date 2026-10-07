import React, { useState } from 'react';
import {
  X,
  SlidersHorizontal,
  Layers,
  Compass,
  Ruler,
  RotateCcw,
  Check,
  Eye
} from 'lucide-react';
import type {
  EditorSettings,
  ViewportThemeId,
  DistanceUnit
} from '../../types/settings';
import { COLOR_PRESETS, THEME_OPTIONS } from '../../types/settings';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: EditorSettings;
  onUpdateSettings: (newSettings: EditorSettings) => void;
  onResetSettings: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onResetSettings
}) => {
  const [activeTab, setActiveTab] = useState<'highlight' | 'viewport' | 'navigation' | 'snapping'>('highlight');

  if (!isOpen) return null;

  const updateHighlighting = (partial: Partial<EditorSettings['highlighting']>) => {
    onUpdateSettings({
      ...settings,
      highlighting: { ...settings.highlighting, ...partial }
    });
  };

  const updateViewport = (partial: Partial<EditorSettings['viewport']>) => {
    onUpdateSettings({
      ...settings,
      viewport: { ...settings.viewport, ...partial }
    });
  };

  const updateNavigation = (partial: Partial<EditorSettings['navigation']>) => {
    onUpdateSettings({
      ...settings,
      navigation: { ...settings.navigation, ...partial }
    });
  };

  const updateSnapping = (partial: Partial<EditorSettings['snapping']>) => {
    onUpdateSettings({
      ...settings,
      snapping: { ...settings.snapping, ...partial }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div
        data-qa="editor-settings-modal"
        className="relative w-full max-w-2xl bg-[var(--dock-bg)] border border-[var(--border-subtle)] rounded-xl shadow-[var(--shadow-dock)] overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100 tracking-tight">Editor Preferences & Viewport Settings</h2>
              <p className="text-[11px] text-slate-400">Customizable highlight colors, navigation ergonomics, and drafting units</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors"
            title="Close Settings (Esc)"
            data-qa="close-settings-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-[var(--border-subtle)] bg-slate-950/30">
          <button
            onClick={() => setActiveTab('highlight')}
            data-qa="tab-highlighting"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg text-xs font-medium transition-colors border-b-2 -mb-[1px] ${
              activeTab === 'highlight'
                ? 'border-sky-400 text-sky-300 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Highlights & Selection</span>
          </button>
          <button
            onClick={() => setActiveTab('viewport')}
            data-qa="tab-viewport"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg text-xs font-medium transition-colors border-b-2 -mb-[1px] ${
              activeTab === 'viewport'
                ? 'border-sky-400 text-sky-300 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Environment & Themes</span>
          </button>
          <button
            onClick={() => setActiveTab('navigation')}
            data-qa="tab-navigation"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg text-xs font-medium transition-colors border-b-2 -mb-[1px] ${
              activeTab === 'navigation'
                ? 'border-sky-400 text-sky-300 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Navigation & Camera</span>
          </button>
          <button
            onClick={() => setActiveTab('snapping')}
            data-qa="tab-snapping"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg text-xs font-medium transition-colors border-b-2 -mb-[1px] ${
              activeTab === 'snapping'
                ? 'border-sky-400 text-sky-300 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
            }`}
          >
            <Ruler className="w-3.5 h-3.5" />
            <span>Units & Snapping</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-300">
          {/* TAB 1: HIGHLIGHTING */}
          {activeTab === 'highlight' && (
            <div className="space-y-6 animate-in fade-in duration-100">
              {/* Active Selection Section */}
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Active Selection Highlight</h3>
                    <p className="text-[11px] text-slate-400">Color and opacity applied when an element is explicitly clicked</p>
                  </div>
                  <div
                    className="w-7 h-7 rounded-lg border border-white/20 shadow-inner flex items-center justify-center font-bold text-[10px]"
                    style={{ backgroundColor: settings.highlighting.selectionColor }}
                  />
                </div>

                {/* Color Pickers & Presets */}
                <div className="space-y-2">
                  <label className="text-[11px] text-slate-400 font-medium">Color Palette Preset</label>
                  <div className="flex flex-wrap items-center gap-2">
                    {COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          updateHighlighting({
                            selectionColor: preset.hex,
                            selectionEdgeColor: preset.hex
                          });
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border transition-all ${
                          settings.highlighting.selectionColor.toLowerCase() === preset.hex.toLowerCase()
                            ? 'border-sky-400 bg-sky-500/20 text-white font-semibold'
                            : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: preset.hex }} />
                        <span>{preset.name}</span>
                        {settings.highlighting.selectionColor.toLowerCase() === preset.hex.toLowerCase() && (
                          <Check className="w-3 h-3 text-sky-400 ml-0.5" />
                        )}
                      </button>
                    ))}
                    {/* Custom input */}
                    <div className="flex items-center gap-1.5 ml-auto">
                      <span className="text-[11px] text-slate-500">Custom:</span>
                      <input
                        type="color"
                        value={settings.highlighting.selectionColor}
                        onChange={(e) => updateHighlighting({ selectionColor: e.target.value, selectionEdgeColor: e.target.value })}
                        className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                        title="Choose custom selection color"
                      />
                    </div>
                  </div>
                </div>

                {/* Sliders: Surface Fill Opacity & Edge Opacity */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1.5">
                      <span className="text-slate-400">Surface Tint Opacity</span>
                      <span className="font-mono text-sky-300">{Math.round(settings.highlighting.selectionFillOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="0.80"
                      step="0.02"
                      value={settings.highlighting.selectionFillOpacity}
                      onChange={(e) => updateHighlighting({ selectionFillOpacity: parseFloat(e.target.value) })}
                      className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] mb-1.5">
                      <span className="text-slate-400">Contour Edge Opacity</span>
                      <span className="font-mono text-sky-300">{Math.round(settings.highlighting.selectionEdgeOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.20"
                      max="1.00"
                      step="0.05"
                      value={settings.highlighting.selectionEdgeOpacity}
                      onChange={(e) => updateHighlighting({ selectionEdgeOpacity: parseFloat(e.target.value) })}
                      className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Pre-selection (Hover) Section */}
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Pre-Selection (Hover) Highlight</h3>
                    <p className="text-[11px] text-slate-400">Subtle highlight shown when hovering over visible surfaces before clicking</p>
                  </div>
                  <div
                    className="w-7 h-7 rounded-lg border border-white/20 shadow-inner flex items-center justify-center font-bold text-[10px]"
                    style={{ backgroundColor: settings.highlighting.preselectionColor }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] text-slate-400 font-medium">Hover Color Palette</label>
                  <div className="flex flex-wrap items-center gap-2">
                    {COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          updateHighlighting({
                            preselectionColor: preset.hex,
                            preselectionEdgeColor: preset.hex
                          });
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border transition-all ${
                          settings.highlighting.preselectionColor.toLowerCase() === preset.hex.toLowerCase()
                            ? 'border-sky-400 bg-sky-500/20 text-white font-semibold'
                            : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: preset.hex }} />
                        <span>{preset.name}</span>
                        {settings.highlighting.preselectionColor.toLowerCase() === preset.hex.toLowerCase() && (
                          <Check className="w-3 h-3 text-sky-400 ml-0.5" />
                        )}
                      </button>
                    ))}
                    <div className="flex items-center gap-1.5 ml-auto">
                      <span className="text-[11px] text-slate-500">Custom:</span>
                      <input
                        type="color"
                        value={settings.highlighting.preselectionColor}
                        onChange={(e) => updateHighlighting({ preselectionColor: e.target.value, preselectionEdgeColor: e.target.value })}
                        className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                        title="Choose custom hover color"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1.5">
                      <span className="text-slate-400">Hover Surface Wash Opacity</span>
                      <span className="font-mono text-sky-300">{Math.round(settings.highlighting.preselectionFillOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.04"
                      max="0.40"
                      step="0.02"
                      value={settings.highlighting.preselectionFillOpacity}
                      onChange={(e) => updateHighlighting({ preselectionFillOpacity: parseFloat(e.target.value) })}
                      className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] mb-1.5">
                      <span className="text-slate-400">Hover Contour Edge Opacity</span>
                      <span className="font-mono text-sky-300">{Math.round(settings.highlighting.preselectionEdgeOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.10"
                      max="1.00"
                      step="0.05"
                      value={settings.highlighting.preselectionEdgeOpacity}
                      onChange={(e) => updateHighlighting({ preselectionEdgeOpacity: parseFloat(e.target.value) })}
                      className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Geometry Mode & X-Ray Options */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-2">
                  <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Highlight Geometry Mode</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateHighlighting({ highlightStyle: 'contours' })}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-all ${
                        settings.highlighting.highlightStyle === 'contours'
                          ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                          : 'border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      True Contours (Edges)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateHighlighting({ highlightStyle: 'box' })}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-all ${
                        settings.highlighting.highlightStyle === 'box'
                          ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                          : 'border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Bounding Box
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500">True Contours outline the exact building silhouette instead of a rectangular box</p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-2">
                  <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Occlusion X-Ray Visibility</label>
                  <label className="flex items-center gap-3 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={settings.highlighting.xrayHighlight}
                      onChange={(e) => updateHighlighting({ xrayHighlight: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-700 text-sky-500 focus:ring-0 bg-slate-950 cursor-pointer"
                    />
                    <span className="text-xs text-slate-300">See-through highlight inside enclosed rooms</span>
                  </label>
                  <p className="text-[10px] text-slate-500">Renders the selection overlay through walls and slabs when occluded</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VIEWPORT & ENVIRONMENT */}
          {activeTab === 'viewport' && (
            <div className="space-y-6 animate-in fade-in duration-100">
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Viewport Canvas Theme</h3>
                <div className="grid grid-cols-2 gap-3">
                  {THEME_OPTIONS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => updateViewport({ theme: t.id as ViewportThemeId })}
                      className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                        settings.viewport.theme === t.id
                          ? 'border-sky-400 bg-sky-500/10 text-white'
                          : 'border-slate-800 bg-slate-900/30 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-lg border border-white/20 shadow-md shrink-0 mt-0.5"
                        style={{ backgroundColor: t.color }}
                      />
                      <div>
                        <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                          {t.label}
                          {settings.viewport.theme === t.id && <Check className="w-3.5 h-3.5 text-sky-400" />}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{t.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid and Axes Controls */}
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-4">
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Ground Grid & Spatial Helpers</h3>
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.viewport.showGrid}
                      onChange={(e) => updateViewport({ showGrid: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-700 text-sky-500 focus:ring-0 bg-slate-950 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs text-slate-200 font-medium">Show Ground Grid</span>
                      <p className="text-[10px] text-slate-500">Renders reference grid at elevation Z=0</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.viewport.showAxes}
                      onChange={(e) => updateViewport({ showAxes: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-700 text-sky-500 focus:ring-0 bg-slate-950 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs text-slate-200 font-medium">Show Origin XYZ Axes</span>
                      <p className="text-[10px] text-slate-500">World origin coordinate triad marker</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: NAVIGATION & CAMERA */}
          {activeTab === 'navigation' && (
            <div className="space-y-6 animate-in fade-in duration-100">
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-4">
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Camera Orbit & Rotation Controls</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium block mb-1.5">Orbit Navigation Style</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateNavigation({ orbitStyle: 'turntable' })}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-all ${
                          settings.navigation.orbitStyle === 'turntable'
                            ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                            : 'border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Turntable (Z-Up Locked)
                      </button>
                      <button
                        type="button"
                        onClick={() => updateNavigation({ orbitStyle: 'free' })}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-all ${
                          settings.navigation.orbitStyle === 'free'
                            ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                            : 'border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Free Trackball
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Turntable keeps the horizon level (Revit/Archicad standard)</p>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 font-medium block mb-1.5">Mouse Wheel Zoom Direction</label>
                    <label className="flex items-center gap-3 cursor-pointer pt-1.5">
                      <input
                        type="checkbox"
                        checked={settings.navigation.invertZoom}
                        onChange={(e) => updateNavigation({ invertZoom: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-700 text-sky-500 focus:ring-0 bg-slate-950 cursor-pointer"
                      />
                      <span className="text-xs text-slate-300">Invert Zoom Direction (Scroll Up to Zoom Out)</span>
                    </label>
                  </div>
                </div>

                {/* Sensitivity Sliders */}
                <div className="grid grid-cols-3 gap-4 pt-2">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1.5">
                      <span className="text-slate-400">Orbit Speed</span>
                      <span className="font-mono text-sky-300">{settings.navigation.orbitSensitivity.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.3"
                      max="2.5"
                      step="0.1"
                      value={settings.navigation.orbitSensitivity}
                      onChange={(e) => updateNavigation({ orbitSensitivity: parseFloat(e.target.value) })}
                      className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1.5">
                      <span className="text-slate-400">Pan Speed</span>
                      <span className="font-mono text-sky-300">{settings.navigation.panSensitivity.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.3"
                      max="2.5"
                      step="0.1"
                      value={settings.navigation.panSensitivity}
                      onChange={(e) => updateNavigation({ panSensitivity: parseFloat(e.target.value) })}
                      className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1.5">
                      <span className="text-slate-400">Zoom Speed</span>
                      <span className="font-mono text-sky-300">{settings.navigation.zoomSensitivity.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.3"
                      max="2.5"
                      step="0.1"
                      value={settings.navigation.zoomSensitivity}
                      onChange={(e) => updateNavigation({ zoomSensitivity: parseFloat(e.target.value) })}
                      className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>

                {/* Camera Damping & Rotation Drag Threshold */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800/60">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1.5">
                      <span className="text-slate-400">Rotation Drag Threshold</span>
                      <span className="font-mono text-sky-300">{settings.navigation.dragThresholdPx}px</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="12"
                      step="1"
                      value={settings.navigation.dragThresholdPx}
                      onChange={(e) => updateNavigation({ dragThresholdPx: parseInt(e.target.value, 10) })}
                      className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Pointer travel required before camera orbit is initiated</p>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1.5">
                      <span className="text-slate-400">Inertial Damping Glide</span>
                      <span className="font-mono text-sky-300">{(settings.navigation.dampingFactor * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.01"
                      max="0.15"
                      step="0.01"
                      value={settings.navigation.dampingFactor}
                      onChange={(e) => updateNavigation({ dampingFactor: parseFloat(e.target.value) })}
                      className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Controls smooth glide when releasing camera orbit</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: UNITS & SNAPPING */}
          {activeTab === 'snapping' && (
            <div className="space-y-6 animate-in fade-in duration-100">
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-4">
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">BIM Architectural Units</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium block mb-1.5">Linear Measurement Unit</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { id: 'm', label: 'Meters (m)' },
                        { id: 'mm', label: 'Millimeters (mm)' },
                        { id: 'cm', label: 'Centimeters (cm)' },
                        { id: 'ft', label: 'Feet (ft)' }
                      ].map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => updateSnapping({ distanceUnit: u.id as DistanceUnit })}
                          className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-all ${
                            settings.snapping.distanceUnit === u.id
                              ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                              : 'border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {u.id}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 font-medium block mb-1.5">Display Decimals Precision</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[0, 1, 2, 3].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => updateSnapping({ unitPrecision: p })}
                          className={`py-1.5 px-2 rounded-lg text-xs font-mono font-medium border text-center transition-all ${
                            settings.snapping.unitPrecision === p
                              ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                              : 'border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {p} dec
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Snapping Increments */}
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-4">
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">CAD Snapping & Increments</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium block mb-1.5">Angular Snap Increment</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[5, 15, 45, 90].map((deg) => (
                        <button
                          key={deg}
                          type="button"
                          onClick={() => updateSnapping({ angularSnapStep: deg })}
                          className={`py-1.5 px-2 rounded-lg text-xs font-mono border text-center transition-all ${
                            settings.snapping.angularSnapStep === deg
                              ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                              : 'border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {deg}°
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 font-medium block mb-1.5">Linear Translation Snap Step</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[0.05, 0.1, 0.5, 1.0].map((step) => (
                        <button
                          key={step}
                          type="button"
                          onClick={() => updateSnapping({ linearSnapStep: step })}
                          className={`py-1.5 px-2 rounded-lg text-xs font-mono border text-center transition-all ${
                            settings.snapping.linearSnapStep === step
                              ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                              : 'border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {step}m
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Magnetic Snap Radii */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800/60">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1.5">
                      <span className="text-slate-400">Vertex Snap Proximity</span>
                      <span className="font-mono text-sky-300">{settings.snapping.screenSnapRadiusVertex}px</span>
                    </div>
                    <input
                      type="range"
                      min="12"
                      max="36"
                      step="2"
                      value={settings.snapping.screenSnapRadiusVertex}
                      onChange={(e) => updateSnapping({ screenSnapRadiusVertex: parseInt(e.target.value, 10) })}
                      className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1.5">
                      <span className="text-slate-400">Edge Midpoint Snap Proximity</span>
                      <span className="font-mono text-sky-300">{settings.snapping.screenSnapRadiusMidpoint}px</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="30"
                      step="2"
                      value={settings.snapping.screenSnapRadiusMidpoint}
                      onChange={(e) => updateSnapping({ screenSnapRadiusMidpoint: parseInt(e.target.value, 10) })}
                      className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-subtle)] bg-slate-900/60">
          <button
            type="button"
            onClick={onResetSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors border border-transparent hover:border-slate-700"
            title="Reset all settings to factory defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Defaults</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 rounded-lg text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-md transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
