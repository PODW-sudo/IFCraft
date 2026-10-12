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
  ChevronRight,
  ChevronLeft,
  AlignHorizontalJustifyCenter
} from 'lucide-react';
import type { ElementDetails } from '../../types/ifc';
import type { InteractiveEditMode } from '../../types/cadEditing';

export interface GlassContextualModifyDockProps {
  expressId: number;
  elementDetails: ElementDetails | null;
  storeys?: { id: number; name: string; elevation: number }[];
  isPinned: boolean;
  activeInteractiveMode?: InteractiveEditMode;
  leftDrawerOffset?: number;
  rightDrawerOffset?: number;
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

export const GlassContextualModifyDock: React.FC<GlassContextualModifyDockProps> = ({
  expressId,
  elementDetails,
  storeys = [],
  isPinned,
  activeInteractiveMode = 'none',
  leftDrawerOffset = 0,
  rightDrawerOffset = 0,
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
  const [windowWidth, setWindowWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1440
  );

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const effectiveLeft = leftDrawerOffset || 0;
  const effectiveRight = rightDrawerOffset || 0;
  const availableCanvasWidth = Math.max(320, windowWidth - effectiveLeft - effectiveRight);
  const canvasCenterX = effectiveLeft + availableCanvasWidth / 2;

  const [showStoreyMenu, setShowStoreyMenu] = useState(false);
  const [showMaterialMenu, setShowMaterialMenu] = useState(false);
  const [showRotateQuickMenu, setShowRotateQuickMenu] = useState(false);
  const [editingParam, setEditingParam] = useState<'height' | 'thickness' | 'elevation' | null>(null);
  const [tempValue, setTempValue] = useState<string>('');
  const [isExtended, setIsExtended] = useState<boolean>(false);

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
        return <Building size={13} className="text-blue-600 dark:text-cyan-400" />;
      case 'IfcColumn':
        return <Columns size={13} className="text-blue-600 dark:text-cyan-400" />;
      case 'IfcDoor':
        return <DoorOpen size={13} className="text-blue-600 dark:text-cyan-400" />;
      case 'IfcWindow':
        return <AppWindow size={13} className="text-blue-600 dark:text-cyan-400" />;
      default:
        return <Box size={13} className="text-blue-600 dark:text-cyan-400" />;
    }
  };

  const isToolActive = activeInteractiveMode !== 'none';

  return (
    <div
      ref={barRef}
      data-qa="contextual-modify-bar"
      data-qa-dock="glass-contextual-modify-dock"
      style={{
        left: `${canvasCenterX}px`,
        maxWidth: `${Math.max(280, availableCanvasWidth - 24)}px`
      }}
      className="fixed top-18 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 pointer-events-auto select-none animate-in fade-in slide-in-from-top-2 duration-150 transition-all"
    >
      {/* Primary Frosted Glass Contextual Modify Ribbon */}
      <div className="flex items-center gap-1 sm:gap-1.5 px-3 py-1.5 rounded-full bg-white/70 dark:bg-slate-900/75 backdrop-blur-2xl border border-white/80 dark:border-white/10 shadow-xl shadow-slate-900/10 text-slate-800 dark:text-slate-100 text-xs max-w-full overflow-x-auto scrollbar-none">
        {/* Context Identification Pill */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/60 dark:bg-slate-800/70 border border-white/80 dark:border-white/10 text-slate-800 dark:text-slate-100 font-medium"
          title={`Active Selection: ${entityType} #${expressId}`}
        >
          {getEntityIcon(entityType)}
          <span className={`font-semibold text-xs tracking-tight truncate ${availableCanvasWidth < 720 ? 'max-w-[70px]' : 'max-w-[120px]'}`}>
            {entityName}
          </span>
          <span className="text-[10px] font-mono text-blue-600 dark:text-cyan-400 font-bold">
            #{expressId}
          </span>
        </div>

        {/* Pinned Indicator Badge */}
        {isPinned && (
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-700 dark:text-amber-300 font-medium text-[10px]"
            title="Element is pinned (UP to unpin)"
          >
            <Pin size={10} className="text-amber-600 dark:text-amber-400" />
            <span className="uppercase tracking-wider font-semibold hidden sm:inline">Pinned</span>
          </div>
        )}

        {/* Archicad 29 & Tekla Precision Pet Palette Capsule */}
        <div
          data-qa="selection-context-overlay"
          className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/60 dark:bg-slate-800/60 border border-white/70 dark:border-white/10 transition-all duration-200"
          style={{ width: isExtended ? 220 : 96 }}
        >
          {!isExtended ? (
            <>
              <button
                type="button"
                data-qa="selection-extend-btn"
                onClick={() => setIsExtended(true)}
                className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-semibold text-blue-600 dark:text-cyan-400 hover:bg-white/50 dark:hover:bg-slate-700/50 cursor-pointer"
                title="Expand precision pet palette"
              >
                <span>Pet</span>
                <ChevronRight size={10} />
              </button>
              <button
                type="button"
                data-qa="selection-pin-btn"
                onClick={() => onTogglePin(expressId)}
                className={`p-1 rounded text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer ${
                  isPinned ? 'text-amber-500' : ''
                }`}
                title={isPinned ? 'Unpin element (UP)' : 'Pin element (PN)'}
              >
                {isPinned ? <PinOff size={11} /> : <Pin size={11} />}
              </button>
              <button
                type="button"
                data-qa="selection-focus-btn"
                onClick={() => onFocus(expressId)}
                className="p-1 rounded text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                title="Focus Camera (F)"
              >
                <Focus size={11} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                data-qa="selection-collapse-btn"
                onClick={() => setIsExtended(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer mr-0.5"
                title="Collapse Palette"
              >
                <ChevronLeft size={11} />
              </button>
              <button
                type="button"
                data-qa="pet-move-btn"
                disabled={isPinned}
                onClick={onStartMove}
                className="p-1 rounded text-slate-600 dark:text-slate-300 hover:text-blue-600 cursor-pointer"
                title="Pet Move"
              >
                <Move size={11} />
              </button>
              <button
                type="button"
                data-qa="pet-rotate-btn"
                disabled={isPinned}
                onClick={onStartRotate}
                className="p-1 rounded text-slate-600 dark:text-slate-300 hover:text-blue-600 cursor-pointer"
                title="Pet Rotate"
              >
                <RotateCw size={11} />
              </button>
              <button
                type="button"
                data-qa="pet-mirror-btn"
                disabled={isPinned}
                onClick={onStartMirror}
                className="p-1 rounded text-slate-600 dark:text-slate-300 hover:text-blue-600 cursor-pointer"
                title="Pet Mirror"
              >
                <FlipHorizontal size={11} />
              </button>
              <button
                type="button"
                data-qa="pet-elevate-btn"
                disabled={isPinned}
                onClick={onStartElevate}
                className="p-1 rounded text-slate-600 dark:text-slate-300 hover:text-blue-600 cursor-pointer"
                title="Pet Elevate"
              >
                <ArrowUpDown size={11} />
              </button>
              <button
                type="button"
                data-qa="pet-multiply-btn"
                disabled={isPinned}
                onClick={onStartMultiply}
                className="p-1 rounded text-slate-600 dark:text-slate-300 hover:text-blue-600 cursor-pointer"
                title="Pet Multiply"
              >
                <Grid3x3 size={11} />
              </button>
              <button
                type="button"
                data-qa="pet-special-btn"
                disabled={isPinned}
                onClick={onOpenSpecialModal}
                className="p-1 rounded text-slate-600 dark:text-slate-300 hover:text-blue-600 cursor-pointer"
                title="Move/Copy Special"
              >
                <Settings2 size={11} />
              </button>
            </>
          )}
        </div>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

        {/* Group 1: Transform Tools (Archicad 29 & Tekla 2025) */}
        <div className="flex items-center gap-0.5" role="toolbar" aria-label="Transform Tools">
          {/* Move / Drag (M / Ctrl+D) */}
          <button
            data-qa="modify-move-btn"
            data-qa-ribbon="ribbon-move-btn"
            disabled={isPinned}
            onClick={onStartMove}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeInteractiveMode === 'move'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : isPinned
                ? 'opacity-40 cursor-not-allowed text-slate-400'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
            }`}
            title="Two-Point Reference Move (M / Ctrl+D) - Pick origin then destination. Hold Ctrl to copy."
          >
            <Move size={13} className={activeInteractiveMode === 'move' ? 'text-white' : 'text-blue-600 dark:text-cyan-400'} />
            <span className={availableCanvasWidth < 740 ? 'hidden' : 'hidden sm:inline'}>Move</span>
          </button>

          {/* Rotate (R / Ctrl+E) */}
          <div className="relative flex items-center">
            <button
              data-qa="modify-rotate-btn"
              data-qa-ribbon="ribbon-rotate-btn"
              disabled={isPinned}
              onClick={onStartRotate}
              className={`flex items-center gap-1 px-2 py-1 rounded-l-md text-xs font-medium transition-colors cursor-pointer ${
                activeInteractiveMode === 'rotate'
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : isPinned
                  ? 'opacity-40 cursor-not-allowed text-slate-400'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
              }`}
              title="Arc Rotate (R / Ctrl+E) - Pick center, baseline ray, then target angle."
            >
              <RotateCw size={13} className={activeInteractiveMode === 'rotate' ? 'text-white' : 'text-blue-600 dark:text-cyan-400'} />
              <span className={availableCanvasWidth < 740 ? 'hidden' : 'hidden sm:inline'}>Rotate</span>
            </button>
            <button
              disabled={isPinned}
              onClick={() => setShowRotateQuickMenu(!showRotateQuickMenu)}
              className="px-1 py-1 rounded-r-md text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60 border-l border-slate-300/50 dark:border-slate-700/50 cursor-pointer"
              title="Quick Rotate Options (Ctrl+R)"
            >
              <ChevronDown size={10} />
            </button>

            {/* Quick Rotate Flyout */}
            {showRotateQuickMenu && (
              <div className="absolute top-full left-0 mt-1 w-44 bg-white/95 dark:bg-slate-900/95 border border-white/80 dark:border-white/10 rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-0.5 text-slate-800 dark:text-slate-100">
                <button
                  onClick={() => {
                    onQuickRotate(false);
                    setShowRotateQuickMenu(false);
                  }}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs hover:bg-blue-50 dark:hover:bg-slate-800/80 cursor-pointer"
                >
                  <RotateCcw size={13} className="text-blue-600 dark:text-cyan-400" />
                  <span>Rotate 90° CCW</span>
                  <span className="ml-auto font-mono text-[9px] opacity-60">Ctrl+R</span>
                </button>
                <button
                  onClick={() => {
                    onQuickRotate(true);
                    setShowRotateQuickMenu(false);
                  }}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs hover:bg-blue-50 dark:hover:bg-slate-800/80 cursor-pointer"
                >
                  <RotateCw size={13} className="text-blue-600 dark:text-cyan-400" />
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
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeInteractiveMode === 'mirror'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : isPinned
                ? 'opacity-40 cursor-not-allowed text-slate-400'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
            }`}
            title="Mirror (Ctrl+M) - Define 2-point reflection axis line."
          >
            <FlipHorizontal size={13} className={activeInteractiveMode === 'mirror' ? 'text-white' : 'text-blue-600 dark:text-cyan-400'} />
            <span className={availableCanvasWidth < 900 ? 'hidden' : 'hidden md:inline'}>Mirror</span>
          </button>

          {/* Elevate (E) */}
          <button
            data-qa="modify-elevate-btn"
            data-qa-ribbon="ribbon-elevate-btn"
            disabled={isPinned}
            onClick={onStartElevate}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeInteractiveMode === 'elevate'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : isPinned
                ? 'opacity-40 cursor-not-allowed text-slate-400'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
            }`}
            title="Elevate (E) - Vertical displacement along Z axis."
          >
            <ArrowUpDown size={13} className={activeInteractiveMode === 'elevate' ? 'text-white' : 'text-blue-600 dark:text-cyan-400'} />
            <span className={availableCanvasWidth < 980 ? 'hidden' : 'hidden md:inline'}>Elevate</span>
          </button>

          {/* Multiply / Linear Array (Ctrl+U) */}
          <button
            data-qa="modify-array-btn"
            data-qa-ribbon="ribbon-multiply-btn"
            disabled={isPinned}
            onClick={onStartMultiply}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeInteractiveMode === 'multiply'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : isPinned
                ? 'opacity-40 cursor-not-allowed text-slate-400'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
            }`}
            title="Multiply / Linear Array (Ctrl+U) - Predefine count & spacing or distribute."
          >
            <Grid3x3 size={13} className={activeInteractiveMode === 'multiply' ? 'text-white' : 'text-blue-600 dark:text-cyan-400'} />
            <span className={availableCanvasWidth < 1060 ? 'hidden' : 'hidden lg:inline'}>Multiply</span>
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
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              isPinned
                ? 'opacity-40 cursor-not-allowed text-slate-400'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
            }`}
            title="Align element to Ground (AL)"
          >
            <AlignHorizontalJustifyCenter size={13} className="text-blue-600 dark:text-cyan-400" />
            <span className={availableCanvasWidth < 1140 ? 'hidden' : 'hidden lg:inline'}>Align</span>
          </button>

          {/* Tekla Move/Copy Special Button */}
          <button
            data-qa="modify-special-btn"
            data-qa-ribbon="ribbon-special-btn"
            onClick={onOpenSpecialModal}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:bg-blue-50 dark:hover:bg-slate-800/70 border border-blue-400/30 dark:border-cyan-500/30 transition-colors ml-0.5 cursor-pointer"
            title="Move / Copy Special (Tekla-Style precision dialog)"
          >
            <Settings2 size={13} />
            <span className={availableCanvasWidth < 1200 ? 'hidden' : 'hidden xl:inline'}>Special...</span>
          </button>
        </div>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

        {/* Group 2: Parametric Geometry Inputs */}
        <div className="flex items-center gap-1 bg-white/60 dark:bg-slate-800/60 px-2 py-0.5 rounded-full border border-white/70 dark:border-white/10 text-[11px]">
          {/* Height */}
          {editingParam === 'height' ? (
            <div className="flex items-center gap-1 rounded px-1.5 py-0.5 border border-blue-500/50">
              <span className="text-[10px] text-slate-400 font-mono">H:</span>
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
                className="w-12 bg-transparent text-slate-800 dark:text-slate-100 font-mono text-[11px] outline-none"
              />
              <button onClick={() => handleCommitEdit('height')} className="text-emerald-500 cursor-pointer">
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
              className="px-1.5 py-0.5 rounded text-[10px] font-mono hover:bg-white/50 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
              title="Click to edit height"
            >
              <span className="opacity-60">H:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">{heightVal.toFixed(2)}m</span>
            </button>
          )}

          {/* Thickness */}
          {(entityType.includes('Wall') || entityType.includes('Slab')) && (
            editingParam === 'thickness' ? (
              <div className="flex items-center gap-1 rounded px-1.5 py-0.5 border border-blue-500/50">
                <span className="text-[10px] text-slate-400 font-mono">T:</span>
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
                  className="w-12 bg-transparent text-slate-800 dark:text-slate-100 font-mono text-[11px] outline-none"
                />
                <button onClick={() => handleCommitEdit('thickness')} className="text-emerald-500 cursor-pointer">
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
                className="px-1.5 py-0.5 rounded text-[10px] font-mono hover:bg-white/50 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                title="Click to edit thickness"
              >
                <span className="opacity-60">T:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">{thicknessVal.toFixed(2)}m</span>
              </button>
            )
          )}

          {/* Elevation */}
          {editingParam === 'elevation' ? (
            <div className="flex items-center gap-1 rounded px-1.5 py-0.5 border border-blue-500/50">
              <span className="text-[10px] text-slate-400 font-mono">El:</span>
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
                className="w-12 bg-transparent text-slate-800 dark:text-slate-100 font-mono text-[11px] outline-none"
              />
              <button onClick={() => handleCommitEdit('elevation')} className="text-emerald-500 cursor-pointer">
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
              className="px-1.5 py-0.5 rounded text-[10px] font-mono hover:bg-white/50 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
              title="Click to edit elevation"
            >
              <span className="opacity-60">El:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">+{elevationVal.toFixed(2)}m</span>
            </button>
          )}
        </div>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

        {/* Group 3: Attribution, Pin, Clone, Delete */}
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
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
              title="Assign Storey"
            >
              <Layers size={12} className="text-blue-600 dark:text-cyan-400" />
              <span className={availableCanvasWidth < 840 ? 'hidden' : 'hidden sm:inline'}>Storey</span>
            </button>
            {showStoreyMenu && storeys.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-40 bg-white/95 dark:bg-slate-900/95 border border-white/80 dark:border-white/10 rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-0.5 text-slate-800 dark:text-slate-100">
                {storeys.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => {
                      onAssignStorey(expressId, st.id);
                      setShowStoreyMenu(false);
                    }}
                    className="text-left px-2 py-1.5 rounded-lg text-xs hover:bg-blue-50 dark:hover:bg-slate-800/80 cursor-pointer"
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
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
              title="Assign Material"
            >
              <Palette size={12} className="text-blue-600 dark:text-cyan-400" />
              <span className={availableCanvasWidth < 880 ? 'hidden' : 'hidden sm:inline'}>Material</span>
            </button>
            {showMaterialMenu && (
              <div className="absolute top-full left-0 mt-1 w-44 bg-white/95 dark:bg-slate-900/95 border border-white/80 dark:border-white/10 rounded-xl shadow-2xl p-1 z-50 grid grid-cols-2 gap-1 text-slate-800 dark:text-slate-100">
                {ARCHITECTURAL_MATERIALS.map((mat) => (
                  <button
                    key={mat.name}
                    onClick={() => {
                      onAssignMaterial(expressId, mat.name);
                      setShowMaterialMenu(false);
                    }}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] hover:bg-blue-50 dark:hover:bg-slate-800/80 cursor-pointer"
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
            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
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
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              isPinned
                ? 'text-amber-700 dark:text-amber-300 bg-amber-500/20 border border-amber-500/40'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
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
            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
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
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              isPinned
                ? 'opacity-40 cursor-not-allowed text-slate-400'
                : 'text-slate-600 dark:text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30'
            }`}
            title={isPinned ? 'Element pinned (UP to unpin)' : 'Delete element (Del)'}
          >
            <Trash2 size={13} />
          </button>

          {/* Inspector */}
          <button
            data-qa="modify-inspector-btn"
            onClick={onOpenInspector}
            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
            title="Open Property Inspector"
          >
            <SlidersHorizontal size={13} />
          </button>

          {/* Deselect (X) */}
          <button
            data-qa="modify-close-btn"
            onClick={onDeselect}
            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors ml-0.5 cursor-pointer"
            title="Deselect element (Esc)"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Active Interactive Tool Banner */}
      {isToolActive && (
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/80 dark:bg-slate-800/90 border border-blue-400/40 text-blue-100 text-[11px] shadow-lg animate-in fade-in zoom-in-95 duration-100">
          <Compass size={12} className="animate-spin text-cyan-400" />
          <span className="font-semibold uppercase tracking-wider">
            {activeInteractiveMode.replace('_', ' ')} active
          </span>
          <span className="text-[10px] text-blue-200">
            Pick points in 3D canvas or enter values
          </span>
          <button
            onClick={onCancelInteractiveTool}
            className="ml-1 p-0.5 rounded-full hover:bg-white/20 text-white cursor-pointer"
            title="Cancel tool (Esc)"
          >
            <X size={11} />
          </button>
        </div>
      )}
    </div>
  );
};
export default GlassContextualModifyDock;
