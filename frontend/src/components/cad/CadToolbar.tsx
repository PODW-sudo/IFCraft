import React, { useState } from 'react';
import { 
  MousePointer, 
  Square, 
  Columns, 
  DoorOpen, 
  AppWindow, 
  Undo2, 
  Redo2, 
  History, 
  X, 
  Sliders, 
  GripVertical,
  PenTool
} from 'lucide-react';
import type { CadToolMode, CadHistoryItem } from '../../types/ifc';
import { useDraggableHud } from '../hud/HudLayoutContext';

interface CadToolbarProps {
  activeMode: CadToolMode;
  onSelectMode: (mode: CadToolMode) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  history: CadHistoryItem[];
  onRefreshHistory: () => void;
  onClose: () => void;
  wallHeight: number;
  setWallHeight: (v: number) => void;
  wallThickness: number;
  setWallThickness: (v: number) => void;
  leftOffset?: number;
}

export const CadToolbar: React.FC<CadToolbarProps> = ({
  activeMode,
  onSelectMode,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  history,
  onRefreshHistory,
  onClose,
  wallHeight,
  setWallHeight,
  wallThickness,
  setWallThickness,
  leftOffset = 80
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const tools: { id: CadToolMode; label: string; icon: React.ReactNode; shortcut: string }[] = [
    { id: 'select', label: 'Select', icon: <MousePointer size={15} />, shortcut: 'Esc' },
    { id: 'wall', label: 'Wall', icon: <Square size={15} className="rotate-45" />, shortcut: 'W' },
    { id: 'slab', label: 'Slab', icon: <Square size={15} />, shortcut: 'S' },
    { id: 'column', label: 'Column', icon: <Columns size={15} />, shortcut: 'C' },
    { id: 'door', label: 'Door', icon: <DoorOpen size={15} />, shortcut: 'D' },
    { id: 'window', label: 'Window', icon: <AppWindow size={15} />, shortcut: 'Shift+W' },
  ];

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

  const initialWidth = 208;
  const initialHeight = 340;
  const initialX = leftOffset;
  const initialY = 72;

  const { ref, style, dragProps, isDragging } = useDraggableHud('cad-toolbar', {
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
      data-qa="cad-toolbar"
      data-qa-cad-mode={activeMode}
      className={`z-40 flex flex-col items-center pointer-events-auto select-none transition-shadow ${
        isDragging ? 'shadow-blue-500/20 ring-1 ring-blue-500/40 cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {/* Primary Frosted Glass Toolbox Shelf */}
      <div className="flex flex-col w-52 p-2.5 rounded-3xl bg-white/60 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-2xl shadow-slate-900/10 gap-2">
        {/* Header with Drag Handle, Brand Title, and Close Button */}
        <div className="flex items-center justify-between px-1 pb-1 border-b border-slate-200/60 dark:border-slate-800/80">
          <div
            data-drag-handle="true"
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-grab active:cursor-grabbing"
            title="Drag to reposition CAD Toolbox"
          >
            <GripVertical size={13} className="text-slate-400" />
            <div className="flex items-center gap-1">
              <PenTool size={13} className="text-blue-600 dark:text-cyan-400" />
              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 tracking-tight">CAD Modeling</span>
            </div>
          </div>
          <button
            type="button"
            data-qa="cad-close-btn"
            onClick={onClose}
            title="Exit CAD Mode"
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>

        {/* 2-Column Tool Palette */}
        <div className="grid grid-cols-2 gap-1.5 w-full">
          {tools.map((t) => {
            const isActive = activeMode === t.id;
            return (
              <button
                key={t.id}
                type="button"
                data-qa={`cad-tool-${t.id}`}
                onClick={() => onSelectMode(t.id)}
                title={`${t.label} (${t.shortcut})`}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-2xl text-xs transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60 border border-transparent hover:border-white/40 dark:hover:border-white/5'
                }`}
              >
                <div className={`p-1 rounded-lg ${isActive ? 'bg-blue-700/60 text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                  {t.icon}
                </div>
                <div className="flex flex-col text-left leading-tight">
                  <span className="font-medium">{t.label}</span>
                  <span className={`text-[9px] font-mono ${isActive ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'}`}>
                    {t.shortcut}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Quick Parametric Properties Preview & Toggle */}
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-2xl bg-white/40 dark:bg-slate-800/40 border border-white/50 dark:border-white/5 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="font-mono text-[10px]">H: {wallHeight.toFixed(1)}m</span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span className="font-mono text-[10px]">T: {wallThickness.toFixed(2)}m</span>
          </div>
          <button
            type="button"
            data-qa="cad-settings-btn"
            onClick={() => {
              setShowSettings(!showSettings);
              if (!showSettings) setShowHistory(false);
            }}
            title="CAD Dimensions Settings"
            className={`p-1 rounded-lg transition-colors cursor-pointer ${
              showSettings
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
            }`}
          >
            <Sliders size={12} />
          </button>
        </div>

        {/* Footer: Undo, Redo, Transaction History */}
        <div className="flex items-center justify-between px-1 pt-1 border-t border-slate-200/60 dark:border-slate-800/80">
          <div className="flex items-center gap-1">
            <button
              type="button"
              data-qa="cad-undo-btn"
              disabled={!canUndo}
              onClick={onUndo}
              title="Undo last CAD action (Ctrl+Z)"
              className={`p-1.5 rounded-xl transition-all ${
                canUndo
                  ? 'text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60 cursor-pointer active:scale-95'
                  : 'text-slate-400/40 dark:text-slate-600/40 cursor-not-allowed'
              }`}
            >
              <Undo2 size={13} />
            </button>
            <button
              type="button"
              data-qa="cad-redo-btn"
              disabled={!canRedo}
              onClick={onRedo}
              title="Redo last CAD action (Ctrl+Y)"
              className={`p-1.5 rounded-xl transition-all ${
                canRedo
                  ? 'text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60 cursor-pointer active:scale-95'
                  : 'text-slate-400/40 dark:text-slate-600/40 cursor-not-allowed'
              }`}
            >
              <Redo2 size={13} />
            </button>
          </div>
          <button
            type="button"
            data-qa="cad-history-btn"
            onClick={() => {
              onRefreshHistory();
              setShowHistory(!showHistory);
              if (!showHistory) setShowSettings(false);
            }}
            title="CAD Transaction History"
            className={`flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-medium transition-all cursor-pointer ${
              showHistory
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <History size={12} />
            <span>History</span>
          </button>
        </div>
      </div>

      {/* Helper Status Tip (Floats right of toolbox) */}
      {activeMode !== 'select' && (
        <div
          data-qa="cad-status-banner"
          className="absolute left-full ml-3 top-2 whitespace-nowrap px-3 py-1.5 rounded-full bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl border border-white/60 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-xl pointer-events-none animate-in fade-in slide-in-from-left-1"
        >
          {getHelperText(activeMode)}
        </div>
      )}

      {/* Flyout: Parametric Dimensions (Opens to the right) */}
      {showSettings && (
        <div
          data-qa="cad-settings-card"
          className="absolute left-full ml-3 top-10 w-64 p-3.5 rounded-3xl bg-white/85 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-2xl flex flex-col gap-2.5 animate-in fade-in slide-in-from-left-2 text-xs text-slate-800 dark:text-slate-200 z-50 pointer-events-auto"
        >
          <div className="font-semibold text-slate-900 dark:text-white border-b border-slate-200/60 dark:border-slate-800 pb-1 flex items-center justify-between">
            <span>Parametric Settings</span>
            <span className="text-[10px] text-slate-400 font-normal font-mono">IFC4</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-400">Wall Height (m):</span>
            <input
              data-qa="cad-wall-height-input"
              type="number"
              step="0.1"
              min="0.5"
              max="20.0"
              value={wallHeight}
              onChange={(e) => setWallHeight(parseFloat(e.target.value) || 3.0)}
              className="w-20 px-2 py-1 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-right font-mono text-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-400">Wall Thickness (m):</span>
            <input
              data-qa="cad-wall-thickness-input"
              type="number"
              step="0.05"
              min="0.05"
              max="2.0"
              value={wallThickness}
              onChange={(e) => setWallThickness(parseFloat(e.target.value) || 0.2)}
              className="w-20 px-2 py-1 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-right font-mono text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
      )}

      {/* Flyout: Transaction History (Opens to the right) */}
      {showHistory && (
        <div
          data-qa="cad-history-card"
          className="absolute left-full ml-3 top-20 w-80 max-h-80 overflow-y-auto p-3.5 rounded-3xl bg-white/85 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-2xl flex flex-col gap-2 animate-in fade-in slide-in-from-left-2 text-xs text-slate-800 dark:text-slate-200 z-50 pointer-events-auto"
        >
          <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-white border-b border-slate-200/60 dark:border-slate-800 pb-1">
            <span>Transaction Stack</span>
            <span className="text-[10px] text-slate-400 font-mono">{history.length} events</span>
          </div>
          {history.length === 0 ? (
            <div className="text-center py-4 text-slate-400 italic">No CAD actions in stack</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {history.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-2 rounded-xl border text-[11px] ${
                    item.status === 'ACTIVE'
                      ? 'bg-white/60 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/80'
                      : 'bg-white/20 dark:bg-slate-800/20 border-slate-200/40 dark:border-slate-700/40 opacity-50 line-through'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {item.action_type.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      #{item.express_id} ({item.entity_type})
                    </span>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      item.status === 'ACTIVE'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default CadToolbar;
