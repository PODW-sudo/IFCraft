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
  Sliders
} from 'lucide-react';
import type { CadToolMode, CadHistoryItem } from '../../types/ifc';

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
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const tools: { id: CadToolMode; label: string; icon: React.ReactNode; shortcut: string }[] = [
    { id: 'select', label: 'Select', icon: <MousePointer size={16} />, shortcut: 'Esc' },
    { id: 'wall', label: 'Wall', icon: <Square size={16} className="rotate-45" />, shortcut: 'W' },
    { id: 'slab', label: 'Slab', icon: <Square size={16} />, shortcut: 'S' },
    { id: 'column', label: 'Column', icon: <Columns size={16} />, shortcut: 'C' },
    { id: 'door', label: 'Door', icon: <DoorOpen size={16} />, shortcut: 'D' },
    { id: 'window', label: 'Window', icon: <AppWindow size={16} />, shortcut: 'Shift+W' },
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

  return (
    <div
      data-qa="cad-toolbar"
      className="fixed top-20 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 pointer-events-auto select-none"
    >
      {/* Primary Toolbar Pill */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-surface-dock/90 backdrop-blur-xl border border-border-subtle shadow-dock">
        {/* Tool Palette */}
        <div className="flex items-center gap-1 pr-1.5 border-r border-border-subtle">
          {tools.map((t) => {
            const isActive = activeMode === t.id;
            return (
              <button
                key={t.id}
                data-qa={`cad-tool-${t.id}`}
                onClick={() => onSelectMode(t.id)}
                title={`${t.label} (${t.shortcut})`}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-action-primary-bg text-action-primary-text shadow-sm'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-canvas/50'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
                <span className="text-[10px] opacity-60 ml-0.5">{t.shortcut}</span>
              </button>
            );
          })}
        </div>

        {/* Undo / Redo Actions */}
        <div className="flex items-center gap-1 px-1.5 border-r border-border-subtle">
          <button
            data-qa="cad-undo-btn"
            disabled={!canUndo}
            onClick={onUndo}
            title="Undo last CAD action (Ctrl+Z)"
            className={`p-1.5 rounded-xl transition-all ${
              canUndo
                ? 'text-text-primary hover:bg-surface-canvas/60 active:scale-95'
                : 'text-text-secondary/40 cursor-not-allowed'
            }`}
          >
            <Undo2 size={16} />
          </button>
          <button
            data-qa="cad-redo-btn"
            disabled={!canRedo}
            onClick={onRedo}
            title="Redo last CAD action (Ctrl+Y)"
            className={`p-1.5 rounded-xl transition-all ${
              canRedo
                ? 'text-text-primary hover:bg-surface-canvas/60 active:scale-95'
                : 'text-text-secondary/40 cursor-not-allowed'
            }`}
          >
            <Redo2 size={16} />
          </button>
          <button
            data-qa="cad-history-btn"
            onClick={() => {
              onRefreshHistory();
              setShowHistory(!showHistory);
            }}
            title="CAD Transaction History"
            className={`p-1.5 rounded-xl transition-all ${
              showHistory
                ? 'bg-action-primary-bg text-action-primary-text'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60'
            }`}
          >
            <History size={16} />
          </button>
        </div>

        {/* Parametric Settings Toggle */}
        <div className="flex items-center gap-1 pl-1">
          <button
            data-qa="cad-settings-btn"
            onClick={() => setShowSettings(!showSettings)}
            title="CAD Dimensions Settings"
            className={`p-1.5 rounded-xl transition-all ${
              showSettings
                ? 'bg-action-primary-bg text-action-primary-text'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60'
            }`}
          >
            <Sliders size={16} />
          </button>
          <button
            data-qa="cad-close-btn"
            onClick={onClose}
            title="Exit CAD Mode"
            className="p-1.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60 transition-all"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Helper Status Tip */}
      {activeMode !== 'select' && (
        <div
          data-qa="cad-status-banner"
          className="px-3 py-1 rounded-full bg-surface-dock/90 backdrop-blur-md border border-border-subtle text-[11px] text-text-secondary shadow-sm animate-in fade-in slide-in-from-top-1"
        >
          {getHelperText(activeMode)}
        </div>
      )}

      {/* Flyout: Parametric Dimensions */}
      {showSettings && (
        <div
          data-qa="cad-settings-card"
          className="w-72 p-3 rounded-2xl bg-surface-dock/95 backdrop-blur-xl border border-border-subtle shadow-dock flex flex-col gap-2.5 animate-in fade-in zoom-in-95 text-xs text-text-primary"
        >
          <div className="font-semibold text-text-primary border-b border-border-subtle pb-1">
            Parametric Settings
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Wall Height (m):</span>
            <input
              type="number"
              step="0.1"
              min="0.5"
              max="20.0"
              value={wallHeight}
              onChange={(e) => setWallHeight(parseFloat(e.target.value) || 3.0)}
              className="w-20 px-2 py-1 rounded-lg bg-surface-canvas border border-border-subtle text-right font-mono"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Wall Thickness (m):</span>
            <input
              type="number"
              step="0.05"
              min="0.05"
              max="2.0"
              value={wallThickness}
              onChange={(e) => setWallThickness(parseFloat(e.target.value) || 0.2)}
              className="w-20 px-2 py-1 rounded-lg bg-surface-canvas border border-border-subtle text-right font-mono"
            />
          </div>
        </div>
      )}

      {/* Flyout: Transaction History */}
      {showHistory && (
        <div
          data-qa="cad-history-card"
          className="w-80 max-h-72 overflow-y-auto p-3 rounded-2xl bg-surface-dock/95 backdrop-blur-xl border border-border-subtle shadow-dock flex flex-col gap-2 animate-in fade-in zoom-in-95 text-xs text-text-primary"
        >
          <div className="flex items-center justify-between font-semibold text-text-primary border-b border-border-subtle pb-1">
            <span>Transaction Stack</span>
            <span className="text-[10px] text-text-secondary font-mono">{history.length} events</span>
          </div>
          {history.length === 0 ? (
            <div className="text-center py-4 text-text-secondary/60 italic">No CAD actions in stack</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {history.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-2 rounded-xl border text-[11px] ${
                    item.status === 'ACTIVE'
                      ? 'bg-surface-canvas/60 border-border-subtle'
                      : 'bg-surface-canvas/20 border-border-subtle/40 opacity-50 line-through'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-text-primary">
                      {item.action_type.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="text-[10px] text-text-secondary font-mono">
                      #{item.express_id} ({item.entity_type})
                    </span>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      item.status === 'ACTIVE'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-amber-500/10 text-amber-400'
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
