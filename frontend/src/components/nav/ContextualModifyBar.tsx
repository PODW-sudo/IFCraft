import React, { useState, useEffect, useRef } from 'react';
import {
  Building,
  Columns,
  DoorOpen,
  AppWindow,
  Box,
  Pin,
  PinOff,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  ArrowUpDown,
  Grid3x3,
  Copy,
  Trash2,
  Focus,
  SlidersHorizontal,
  Layers,
  Palette,
  Check,
  X,
  Move,
  Settings2,
  Compass,
  ChevronDown,
  AlignHorizontalJustifyCenter
} from 'lucide-react';
import type { ElementDetails } from '../../types/ifc';
import type { InteractiveEditMode } from '../../types/cadEditing';

export interface ContextualModifyBarProps {
  expressId: number;
  elementDetails: ElementDetails | null;
  storeys?: { id: number; name: string; elevation: number }[];
  isPinned: boolean;
  activeInteractiveMode?: InteractiveEditMode;
  onTogglePin: (expressId: number) => void;
  onStartMove: () => void;
  onStartRotate: () => void;
  onQuickRotate: (clockwise: boolean) => void;
  onStartMirror: () => void;
  onStartElevate: () => void;
  onStartMultiply: () => void;
  onOpenSpecialModal: () => void;
  onCancelInteractiveTool: () => void;
  onClone: (expressId: number) => void;
  onDelete: (expressId: number) => void;
  onUpdateGeometry: (expressId: number, params: { height?: number; thickness?: number; elevation?: number }) => void;
  onAssignStorey: (expressId: number, storeyId: number) => void;
  onAssignMaterial: (expressId: number, materialName: string, colorHex?: string) => void;
  onAlignElement?: (expressId: number, axis?: 'x' | 'y' | 'z', targetValue?: number) => void;
  onFocus: (expressId: number) => void;
  onOpenInspector: () => void;
  onDeselect: () => void;
}

const ARCHITECTURAL_MATERIALS = [
  { name: 'Concrete', bgClass: 'bg-slate-400' },
  { name: 'Red Brick', bgClass: 'bg-rose-700' },
  { name: 'Timber Wood', bgClass: 'bg-amber-600' },
  { name: 'Clear Glass', bgClass: 'bg-cyan-400' },
  { name: 'Structural Steel', bgClass: 'bg-slate-600' },
  { name: 'White Plaster', bgClass: 'bg-slate-100' },
];

export const ContextualModifyBar: React.FC<ContextualModifyBarProps> = ({
  expressId,
  elementDetails,
  storeys = [],
  isPinned,
  activeInteractiveMode = 'none',
  onTogglePin,
  onStartMove,
  onStartRotate,
  onQuickRotate,
  onStartMirror,
  onStartElevate,
  onStartMultiply,
  onOpenSpecialModal,
  onCancelInteractiveTool,
  onClone,
  onDelete,
  onUpdateGeometry,
  onAssignStorey,
  onAssignMaterial,
  onAlignElement,
  onFocus,
  onOpenInspector,
  onDeselect,
}) => {
  const [showStoreyMenu, setShowStoreyMenu] = useState(false);
  const [showMaterialMenu, setShowMaterialMenu] = useState(false);
  const [showRotateQuickMenu, setShowRotateQuickMenu] = useState(false);
  const [editingParam, setEditingParam] = useState<'height' | 'thickness' | 'elevation' | null>(null);
  const [tempValue, setTempValue] = useState<string>('');

  const barRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setShowStoreyMenu(false);
        setShowMaterialMenu(false);
        setShowRotateQuickMenu(false);
        setEditingParam(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const entityType = elementDetails?.type || 'IfcProduct';
  const entityName = elementDetails?.name || `#${expressId}`;

  // Extract dimensions from element details / psets
  let heightVal = 3.0;
  let thicknessVal = 0.2;
  let elevationVal = 0.0;

  if (elementDetails?.psets) {
    for (const pset of elementDetails.psets) {
      for (const p of pset.properties) {
        if (p.name.toLowerCase() === 'height' && typeof p.value === 'number') {
          heightVal = p.value;
        } else if (p.name.toLowerCase() === 'thickness' && typeof p.value === 'number') {
          thicknessVal = p.value;
        } else if (p.name.toLowerCase() === 'elevation' && typeof p.value === 'number') {
          elevationVal = p.value;
        }
      }
    }
  }

  const handleCommitEdit = (param: 'height' | 'thickness' | 'elevation') => {
    const num = parseFloat(tempValue);
    if (!isNaN(num) && num > 0) {
      if (param === 'height') onUpdateGeometry(expressId, { height: num });
      if (param === 'thickness') onUpdateGeometry(expressId, { thickness: num });
      if (param === 'elevation') onUpdateGeometry(expressId, { elevation: num });
    }
    setEditingParam(null);
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'IfcWall':
      case 'IfcWallStandardCase':
        return <Building size={13} className="text-cyan-400" />;
      case 'IfcColumn':
        return <Columns size={13} className="text-cyan-400" />;
      case 'IfcDoor':
        return <DoorOpen size={13} className="text-cyan-400" />;
      case 'IfcWindow':
        return <AppWindow size={13} className="text-cyan-400" />;
      default:
        return <Box size={13} className="text-cyan-400" />;
    }
  };

  const isToolActive = activeInteractiveMode !== 'none';

  return (
    <div
      ref={barRef}
      data-qa="contextual-modify-bar"
      className="fixed top-14 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-1 pointer-events-auto select-none animate-in fade-in slide-in-from-top-2 duration-150"
    >
      {/* Primary Contextual Ribbon Bar */}
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-dock/95 backdrop-blur-2xl border border-cyan-500/40 shadow-dock text-text-primary text-xs">
        {/* Context Identification Pill */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-canvas/80 border border-cyan-500/40 text-text-primary font-medium"
          title={`Active Selection: ${entityType} #${expressId}`}
        >
          {getEntityIcon(entityType)}
          <span className="font-semibold text-xs tracking-tight truncate max-w-[110px]">
            {entityName}
          </span>
          <span className="text-[10px] font-mono text-cyan-400">
            #{expressId}
          </span>
        </div>

        {/* Pinned Indicator Badge */}
        {isPinned && (
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-medium text-[10px]"
            title="Element is pinned (UP to unpin)"
          >
            <Pin size={10} className="text-amber-400" />
            <span className="uppercase tracking-wider font-semibold">Pinned</span>
          </div>
        )}

        <div className="h-4 w-px bg-border-subtle mx-0.5" />

        {/* Group 1: Transform Tools (Archicad & Tekla Inspired) */}
        <div className="flex items-center gap-0.5" role="toolbar" aria-label="Transform Tools">
          {/* Move / Drag (M / Ctrl+D) */}
          <button
            data-qa="modify-move-btn"
            data-qa-ribbon="ribbon-move-btn"
            disabled={isPinned}
            onClick={onStartMove}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              activeInteractiveMode === 'move'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                : isPinned
                ? 'opacity-40 cursor-not-allowed text-text-secondary'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60'
            }`}
            title="Two-Point Reference Move (M / Ctrl+D) - Pick origin then destination. Hold Ctrl to copy."
          >
            <Move size={13} className={activeInteractiveMode === 'move' ? 'text-slate-950' : 'text-cyan-400'} />
            <span>Move</span>
          </button>

          {/* Rotate (R / Ctrl+E) */}
          <div className="relative flex items-center">
            <button
              data-qa="modify-rotate-btn"
              data-qa-ribbon="ribbon-rotate-btn"
              disabled={isPinned}
              onClick={onStartRotate}
              className={`flex items-center gap-1 px-2 py-1 rounded-l-md text-xs font-medium transition-colors ${
                activeInteractiveMode === 'rotate'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : isPinned
                  ? 'opacity-40 cursor-not-allowed text-text-secondary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60'
              }`}
              title="Arc Rotate (R / Ctrl+E) - Pick center, baseline ray, then target angle."
            >
              <RotateCw size={13} className={activeInteractiveMode === 'rotate' ? 'text-slate-950' : 'text-cyan-400'} />
              <span>Rotate</span>
            </button>
            <button
              disabled={isPinned}
              onClick={() => setShowRotateQuickMenu(!showRotateQuickMenu)}
              className="px-1 py-1 rounded-r-md text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60 border-l border-border-subtle/40"
              title="Quick Rotate Options (Ctrl+R)"
            >
              <ChevronDown size={10} />
            </button>

            {/* Quick Rotate Flyout */}
            {showRotateQuickMenu && (
              <div className="absolute top-full left-0 mt-1 w-44 bg-surface-dock/95 border border-border-subtle rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-0.5">
                <button
                  onClick={() => {
                    onQuickRotate(false);
                    setShowRotateQuickMenu(false);
                  }}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs text-text-secondary hover:text-text-primary hover:bg-surface-canvas"
                >
                  <RotateCcw size={13} className="text-cyan-400" />
                  <span>Rotate 90° CCW</span>
                  <span className="ml-auto font-mono text-[9px] opacity-60">Ctrl+R</span>
                </button>
                <button
                  onClick={() => {
                    onQuickRotate(true);
                    setShowRotateQuickMenu(false);
                  }}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs text-text-secondary hover:text-text-primary hover:bg-surface-canvas"
                >
                  <RotateCw size={13} className="text-cyan-400" />
                  <span>Rotate 90° CW</span>
                  <span className="ml-auto font-mono text-[9px] opacity-60">Shift+Ctrl+R</span>
                </button>
              </div>
            )}
          </div>

          {/* Mirror (Ctrl+M) */}
          <button
            data-qa="modify-mirror-btn"
            data-qa-ribbon="ribbon-mirror-btn"
            disabled={isPinned}
            onClick={onStartMirror}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              activeInteractiveMode === 'mirror'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                : isPinned
                ? 'opacity-40 cursor-not-allowed text-text-secondary'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60'
            }`}
            title="Mirror (Ctrl+M) - Define 2-point reflection axis line."
          >
            <FlipHorizontal size={13} className={activeInteractiveMode === 'mirror' ? 'text-slate-950' : 'text-cyan-400'} />
            <span>Mirror</span>
          </button>

          {/* Elevate (E) */}
          <button
            data-qa="modify-elevate-btn"
            data-qa-ribbon="ribbon-elevate-btn"
            disabled={isPinned}
            onClick={onStartElevate}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              activeInteractiveMode === 'elevate'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                : isPinned
                ? 'opacity-40 cursor-not-allowed text-text-secondary'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60'
            }`}
            title="Elevate (E) - Vertical displacement along Z axis."
          >
            <ArrowUpDown size={13} className={activeInteractiveMode === 'elevate' ? 'text-slate-950' : 'text-cyan-400'} />
            <span>Elevate</span>
          </button>

          {/* Multiply / Linear Array (Ctrl+U) */}
          <button
            data-qa="modify-array-btn"
            data-qa-ribbon="ribbon-multiply-btn"
            disabled={isPinned}
            onClick={onStartMultiply}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              activeInteractiveMode === 'multiply'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                : isPinned
                ? 'opacity-40 cursor-not-allowed text-text-secondary'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60'
            }`}
            title="Multiply / Linear Array (Ctrl+U) - Predefine count & spacing or distribute."
          >
            <Grid3x3 size={13} className={activeInteractiveMode === 'multiply' ? 'text-slate-950' : 'text-cyan-400'} />
            <span>Multiply</span>
          </button>

          {/* Align (AL) */}
          <button
            data-qa="modify-align-btn"
            disabled={isPinned}
            onClick={() => {
              if (isPinned) return;
              if (onAlignElement) {
                onAlignElement(expressId, 'z', 0.0);
              }
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              isPinned
                ? 'opacity-40 cursor-not-allowed text-text-secondary'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60'
            }`}
            title="Align element to Ground (AL)"
          >
            <AlignHorizontalJustifyCenter size={13} className="text-cyan-400" />
            <span>Align</span>
          </button>

          {/* Tekla Move/Copy Special Button */}
          <button
            data-qa="modify-special-btn"
            data-qa-ribbon="ribbon-special-btn"
            onClick={onOpenSpecialModal}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 border border-cyan-500/30 transition-colors ml-0.5"
            title="Move / Copy Special (Tekla-Style precision dialog)"
          >
            <Settings2 size={13} />
            <span>Special...</span>
          </button>
        </div>

        <div className="h-4 w-px bg-border-subtle mx-0.5" />

        {/* Group 2: Parametric Geometry Badges */}
        <div className="flex items-center gap-1 bg-surface-canvas/60 px-2 py-0.5 rounded-full border border-border-subtle/50 text-[11px]">
          {/* Height */}
          {editingParam === 'height' ? (
            <div className="flex items-center gap-1 bg-surface-canvas rounded px-1.5 py-0.2 border border-cyan-500/50">
              <span className="text-[10px] text-text-secondary font-mono">H:</span>
              <input
                type="number"
                step="0.1"
                autoFocus
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCommitEdit('height');
                  if (e.key === 'Escape') setEditingParam(null);
                }}
                className="w-12 bg-transparent text-text-primary font-mono text-[11px] outline-none"
              />
              <button onClick={() => handleCommitEdit('height')} className="text-emerald-400">
                <Check size={11} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                if (isPinned) return;
                setEditingParam('height');
                setTempValue(heightVal.toFixed(2));
              }}
              disabled={isPinned}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono hover:bg-surface-dock text-text-secondary hover:text-text-primary flex items-center gap-1"
              title="Click to edit height"
            >
              <span className="opacity-60">H:</span>
              <span className="font-semibold text-text-primary tabular-nums">{heightVal.toFixed(2)}m</span>
            </button>
          )}

          {/* Thickness (for walls/slabs) */}
          {(entityType.includes('Wall') || entityType.includes('Slab')) && (
            editingParam === 'thickness' ? (
              <div className="flex items-center gap-1 bg-surface-canvas rounded px-1.5 py-0.2 border border-cyan-500/50">
                <span className="text-[10px] text-text-secondary font-mono">T:</span>
                <input
                  type="number"
                  step="0.05"
                  autoFocus
                  value={tempValue}
                  onChange={(e) => setTempValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCommitEdit('thickness');
                    if (e.key === 'Escape') setEditingParam(null);
                  }}
                  className="w-12 bg-transparent text-text-primary font-mono text-[11px] outline-none"
                />
                <button onClick={() => handleCommitEdit('thickness')} className="text-emerald-400">
                  <Check size={11} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  if (isPinned) return;
                  setEditingParam('thickness');
                  setTempValue(thicknessVal.toFixed(2));
                }}
                disabled={isPinned}
                className="px-1.5 py-0.5 rounded text-[10px] font-mono hover:bg-surface-dock text-text-secondary hover:text-text-primary flex items-center gap-1"
                title="Click to edit thickness"
              >
                <span className="opacity-60">T:</span>
                <span className="font-semibold text-text-primary tabular-nums">{thicknessVal.toFixed(2)}m</span>
              </button>
            )
          )}

          {/* Elevation */}
          {editingParam === 'elevation' ? (
            <div className="flex items-center gap-1 bg-surface-canvas rounded px-1.5 py-0.2 border border-cyan-500/50">
              <span className="text-[10px] text-text-secondary font-mono">El:</span>
              <input
                type="number"
                step="0.1"
                autoFocus
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCommitEdit('elevation');
                  if (e.key === 'Escape') setEditingParam(null);
                }}
                className="w-12 bg-transparent text-text-primary font-mono text-[11px] outline-none"
              />
              <button onClick={() => handleCommitEdit('elevation')} className="text-emerald-400">
                <Check size={11} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                if (isPinned) return;
                setEditingParam('elevation');
                setTempValue(elevationVal.toFixed(2));
              }}
              disabled={isPinned}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono hover:bg-surface-dock text-text-secondary hover:text-text-primary flex items-center gap-1"
              title="Click to edit elevation"
            >
              <span className="opacity-60">El:</span>
              <span className="font-semibold text-text-primary tabular-nums">+{elevationVal.toFixed(2)}m</span>
            </button>
          )}
        </div>

        <div className="h-4 w-px bg-border-subtle mx-0.5" />

        {/* Group 3: Attribution & Management Tools */}
        <div className="flex items-center gap-0.5">
          {/* Storey Menu */}
          <div className="relative">
            <button
              data-qa="modify-storey-btn"
              data-qa-alias="selection-storey-btn"
              onClick={() => {
                setShowStoreyMenu(!showStoreyMenu);
                setShowMaterialMenu(false);
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60 transition-colors"
              title="Assign Storey"
            >
              <Layers size={12} className="text-cyan-400" />
              <span>Storey</span>
            </button>
            {showStoreyMenu && storeys.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-40 bg-surface-dock/95 border border-border-subtle rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-0.5">
                {storeys.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => {
                      onAssignStorey(expressId, st.id);
                      setShowStoreyMenu(false);
                    }}
                    className="text-left px-2 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-primary hover:bg-surface-canvas"
                  >
                    {st.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Material Menu */}
          <div className="relative">
            <button
              data-qa="modify-material-btn"
              data-qa-alias="selection-material-btn"
              onClick={() => {
                setShowMaterialMenu(!showMaterialMenu);
                setShowStoreyMenu(false);
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60 transition-colors"
              title="Assign Material"
            >
              <Palette size={12} className="text-cyan-400" />
              <span>Material</span>
            </button>
            {showMaterialMenu && (
              <div className="absolute top-full left-0 mt-1 w-44 bg-surface-dock/95 border border-border-subtle rounded-xl shadow-2xl p-1 z-50 grid grid-cols-2 gap-1">
                {ARCHITECTURAL_MATERIALS.map((mat) => (
                  <button
                    key={mat.name}
                    onClick={() => {
                      onAssignMaterial(expressId, mat.name);
                      setShowMaterialMenu(false);
                    }}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] text-text-secondary hover:text-text-primary hover:bg-surface-canvas"
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${mat.bgClass}`} />
                    <span className="truncate">{mat.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Focus */}
          <button
            data-qa="modify-focus-btn"
            data-qa-alias="selection-focus-btn"
            data-qa-ribbon="ribbon-focus-btn"
            onClick={() => onFocus(expressId)}
            className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60 transition-colors"
            title="Focus Camera (F)"
          >
            <Focus size={13} />
          </button>

          {/* Pin / Unpin */}
          <button
            data-qa="modify-pin-btn"
            data-qa-alias="selection-pin-btn"
            data-qa-ribbon="ribbon-pin-btn"
            onClick={() => onTogglePin(expressId)}
            className={`p-1.5 rounded-md transition-colors ${
              isPinned
                ? 'text-amber-300 bg-amber-500/20 border border-amber-500/40'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60'
            }`}
            title={isPinned ? 'Unpin element (UP)' : 'Pin element (PN)'}
          >
            {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
          </button>

          {/* Clone in place */}
          <button
            data-qa="selection-clone-btn"
            data-qa-modify="modify-copy-btn"
            data-qa-ribbon="ribbon-clone-btn"
            onClick={() => onClone(expressId)}
            className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60 transition-colors"
            title="Duplicate in place (CO)"
          >
            <Copy size={13} />
          </button>

          {/* Delete */}
          <button
            data-qa="modify-delete-btn"
            data-qa-alias="selection-delete-btn"
            data-qa-ribbon="ribbon-delete-btn"
            disabled={isPinned}
            onClick={() => onDelete(expressId)}
            className={`p-1.5 rounded-md transition-colors ${
              isPinned
                ? 'opacity-40 cursor-not-allowed text-text-secondary'
                : 'text-text-secondary hover:text-rose-400 hover:bg-rose-500/10'
            }`}
            title={isPinned ? 'Element pinned (UP to unpin)' : 'Delete element (Del)'}
          >
            <Trash2 size={13} />
          </button>

          {/* Inspector */}
          <button
            data-qa="modify-inspector-btn"
            onClick={onOpenInspector}
            className="p-1.5 rounded-md text-text-secondary hover:text-cyan-400 hover:bg-surface-canvas/60 transition-colors"
            title="Open Property Inspector"
          >
            <SlidersHorizontal size={13} />
          </button>

          {/* Deselect (X) */}
          <button
            data-qa="modify-close-btn"
            onClick={onDeselect}
            className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60 transition-colors ml-0.5"
            title="Deselect element (Esc)"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Active Interactive Tool Banner */}
      {isToolActive && (
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[11px] shadow-lg animate-in fade-in zoom-in-95 duration-100">
          <Compass size={12} className="animate-spin text-cyan-400" />
          <span className="font-semibold uppercase tracking-wider">
            {activeInteractiveMode} Tool Active
          </span>
          <span className="opacity-70">&middot;</span>
          <span className="text-[10px] text-text-secondary">
            Click in viewport or type coordinates &middot; Esc to cancel
          </span>
          <button
            onClick={onCancelInteractiveTool}
            className="ml-1 p-0.5 hover:text-white rounded transition-colors"
            title="Cancel Tool (Esc)"
          >
            <X size={11} />
          </button>
        </div>
      )}
    </div>
  );
};
