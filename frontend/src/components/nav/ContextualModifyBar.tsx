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
  FlipHorizontal,
  Grid3x3,
  AlignHorizontalJustifyCenter,
  Copy,
  Trash2,
  Focus,
  SlidersHorizontal,
  Layers,
  Palette,
  Check,
  X,
  Move
} from 'lucide-react';
import type { ElementDetails } from '../../types/ifc';
import { useHudLayout } from '../hud/HudLayoutContext';

export interface ContextualModifyBarProps {
  expressId: number;
  elementDetails: ElementDetails | null;
  storeys?: { id: number; name: string; elevation: number }[];
  isPinned: boolean;
  onTogglePin: (expressId: number) => void;
  onMove?: (expressId: number, delta: [number, number, number]) => void;
  onRotate?: (expressId: number, angle_degrees: number, axis: 'x' | 'y' | 'z') => void;
  onMirror?: (expressId: number, axis: 'x' | 'y' | 'z', is_copy: boolean) => void;
  onArray?: (expressId: number, count: number, delta: [number, number, number]) => void;
  onAlign?: (expressId: number, axis: 'x' | 'y' | 'z', target_value?: number) => void;
  onClone: (expressId: number) => void;
  onDelete: (expressId: number) => void;
  onUpdateGeometry: (expressId: number, params: { height?: number; thickness?: number; elevation?: number }) => void;
  onAssignStorey: (expressId: number, storeyId: number) => void;
  onAssignMaterial: (expressId: number, materialName: string, colorHex?: string) => void;
  onFocus: (expressId: number) => void;
  onOpenInspector: () => void;
  onDeselect: () => void;
}

const ARCHITECTURAL_MATERIALS = [
  { name: 'Concrete', bgClass: 'bg-slate-400', colorName: 'slate-400' },
  { name: 'Red Brick', bgClass: 'bg-rose-700', colorName: 'rose-700' },
  { name: 'Timber Wood', bgClass: 'bg-amber-600', colorName: 'amber-600' },
  { name: 'Clear Glass', bgClass: 'bg-cyan-400', colorName: 'cyan-400' },
  { name: 'Structural Steel', bgClass: 'bg-slate-600', colorName: 'slate-600' },
  { name: 'White Plaster', bgClass: 'bg-slate-100', colorName: 'slate-100' },
];

export const ContextualModifyBar: React.FC<ContextualModifyBarProps> = ({
  expressId,
  elementDetails,
  storeys = [],
  isPinned,
  onTogglePin,
  onMove,
  onRotate,
  onMirror,
  onArray,
  onAlign,
  onClone,
  onDelete,
  onUpdateGeometry,
  onAssignStorey,
  onAssignMaterial,
  onFocus,
  onOpenInspector,
  onDeselect,
}) => {
  const [activeMenu, setActiveMenu] = useState<'rotate' | 'mirror' | 'array' | 'align' | 'storey' | 'material' | 'move' | null>(null);
  const [editingParam, setEditingParam] = useState<'height' | 'thickness' | 'elevation' | null>(null);
  const [tempValue, setTempValue] = useState<string>('');

  // Tool parameter states
  const [rotateAngle, setRotateAngle] = useState<number>(90);
  const [rotateAxis, setRotateAxis] = useState<'x' | 'y' | 'z'>('z');
  const [mirrorAxis, setMirrorAxis] = useState<'x' | 'y' | 'z'>('x');
  const [mirrorIsCopy, setMirrorIsCopy] = useState<boolean>(true);
  const [arrayCount, setArrayCount] = useState<number>(3);
  const [arraySpacing, setArraySpacing] = useState<number>(2.0);
  const [arrayAxis, setArrayAxis] = useState<'x' | 'y' | 'z'>('x');
  const [alignAxis, setAlignAxis] = useState<'x' | 'y' | 'z'>('z');
  const [alignValue, setAlignValue] = useState<string>('0.0');
  const [moveVector, setMoveVector] = useState<[number, number, number]>([1.0, 0.0, 0.0]);

  const barRef = useRef<HTMLDivElement>(null);
  const hudLayout = useHudLayout();

  // Close submenus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
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

  // Follow top-pill bounds if registered in HUD layout
  const topPillHud = hudLayout?.getHud('top-pill');
  const barTop = topPillHud ? topPillHud.y + topPillHud.height + 6 : 64;
  const barLeft = topPillHud ? topPillHud.x + topPillHud.width / 2 : (typeof window !== 'undefined' ? window.innerWidth / 2 : 720);

  return (
    <div
      ref={barRef}
      data-qa="contextual-modify-bar"
      data-selected-express-id={expressId}
      style={{
        top: `${barTop}px`,
        left: `${barLeft}px`,
        transform: 'translateX(-50%)',
      }}
      className="fixed z-35 select-none pointer-events-auto flex flex-col items-center animate-in fade-in-50 slide-in-from-top-2 duration-150"
    >
      {/* Main Modify Ribbon Bar */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--dock-translucent)] backdrop-blur-2xl border border-[var(--border-subtle)] shadow-[var(--shadow-hud)] text-xs text-slate-200">
        
        {/* Context Header Badge */}
        <div className="flex items-center gap-1.5 pr-2 border-r border-[var(--border-subtle)]">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-semibold text-[10px] uppercase tracking-wider">
            <span>Modify</span>
          </div>
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--control-bg)] border border-[var(--border-subtle)] text-slate-200 font-medium"
            title={`${entityType} #${expressId}`}
          >
            {getEntityIcon(entityType)}
            <span className="font-semibold text-[11px] truncate max-w-[110px]">
              {entityName}
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              #{expressId}
            </span>
          </div>
        </div>

        {/* Pinned Status Pill */}
        {isPinned && (
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-medium text-[10px]"
            title="Element is pinned (UP to unpin)"
          >
            <Pin size={10} className="text-amber-400" />
            <span>Pinned</span>
          </div>
        )}

        {/* Section 1: Revit Modification Tools */}
        <div className="flex items-center gap-0.5 px-1 border-r border-[var(--border-subtle)]">
          {/* Move (MV) */}
          <button
            data-qa="modify-move-btn"
            disabled={isPinned}
            onClick={() => {
              if (isPinned) return;
              setActiveMenu(activeMenu === 'move' ? null : 'move');
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
              isPinned
                ? 'opacity-40 cursor-not-allowed text-slate-500'
                : activeMenu === 'move'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-300 hover:text-white hover:bg-[var(--control-hover)]'
            }`}
            title="Move element by vector (MV)"
          >
            <Move size={13} className="text-cyan-400" />
            <span>Move</span>
            <span className="text-[9px] font-mono text-slate-400 opacity-80">MV</span>
          </button>

          {/* Copy (CO / CC) */}
          <button
            data-qa="selection-clone-btn"
            data-qa-modify="modify-copy-btn"
            onClick={() => onClone(expressId)}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-slate-300 hover:text-white hover:bg-[var(--control-hover)] transition-colors"
            title="Duplicate / Copy element (CO / Ctrl+D)"
          >
            <Copy size={13} className="text-cyan-400" />
            <span>Copy</span>
            <span className="text-[9px] font-mono text-slate-400 opacity-80">CO</span>
          </button>

          {/* Rotate (RO) */}
          <button
            data-qa="modify-rotate-btn"
            disabled={isPinned}
            onClick={() => {
              if (isPinned) return;
              setActiveMenu(activeMenu === 'rotate' ? null : 'rotate');
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
              isPinned
                ? 'opacity-40 cursor-not-allowed text-slate-500'
                : activeMenu === 'rotate'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-300 hover:text-white hover:bg-[var(--control-hover)]'
            }`}
            title="Rotate element (RO)"
          >
            <RotateCw size={13} className="text-cyan-400" />
            <span>Rotate</span>
            <span className="text-[9px] font-mono text-slate-400 opacity-80">RO</span>
          </button>

          {/* Mirror (MM) */}
          <button
            data-qa="modify-mirror-btn"
            disabled={isPinned}
            onClick={() => {
              if (isPinned) return;
              setActiveMenu(activeMenu === 'mirror' ? null : 'mirror');
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
              isPinned
                ? 'opacity-40 cursor-not-allowed text-slate-500'
                : activeMenu === 'mirror'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-300 hover:text-white hover:bg-[var(--control-hover)]'
            }`}
            title="Mirror element (MM)"
          >
            <FlipHorizontal size={13} className="text-cyan-400" />
            <span>Mirror</span>
            <span className="text-[9px] font-mono text-slate-400 opacity-80">MM</span>
          </button>

          {/* Array (AR) */}
          <button
            data-qa="modify-array-btn"
            onClick={() => setActiveMenu(activeMenu === 'array' ? null : 'array')}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
              activeMenu === 'array'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-300 hover:text-white hover:bg-[var(--control-hover)]'
            }`}
            title="Linear array (AR)"
          >
            <Grid3x3 size={13} className="text-cyan-400" />
            <span>Array</span>
            <span className="text-[9px] font-mono text-slate-400 opacity-80">AR</span>
          </button>

          {/* Align (AL) */}
          <button
            data-qa="modify-align-btn"
            disabled={isPinned}
            onClick={() => {
              if (isPinned) return;
              setActiveMenu(activeMenu === 'align' ? null : 'align');
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
              isPinned
                ? 'opacity-40 cursor-not-allowed text-slate-500'
                : activeMenu === 'align'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-300 hover:text-white hover:bg-[var(--control-hover)]'
            }`}
            title="Align element (AL)"
          >
            <AlignHorizontalJustifyCenter size={13} className="text-cyan-400" />
            <span>Align</span>
            <span className="text-[9px] font-mono text-slate-400 opacity-80">AL</span>
          </button>

          {/* Pin / Unpin (PN / UP) */}
          <button
            data-qa="modify-pin-btn"
            data-qa-alias="selection-pin-btn"
            onClick={() => onTogglePin(expressId)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
              isPinned
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-300 hover:text-white hover:bg-[var(--control-hover)]'
            }`}
            title={isPinned ? 'Unpin element (UP)' : 'Pin element (PN)'}
          >
            {isPinned ? <PinOff size={13} className="text-amber-400" /> : <Pin size={13} className="text-slate-400" />}
            <span>{isPinned ? 'Unpin' : 'Pin'}</span>
            <span className="text-[9px] font-mono text-slate-400 opacity-80">{isPinned ? 'UP' : 'PN'}</span>
          </button>
        </div>

        {/* Section 2: Parametric Dimensions */}
        <div className="flex items-center gap-1 px-1 border-r border-[var(--border-subtle)]">
          {/* Height Badge */}
          {editingParam === 'height' ? (
            <div className="flex items-center gap-0.5 bg-[var(--control-bg)] rounded px-1.5 py-0.5 border border-cyan-500/50">
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
                className="w-12 bg-transparent text-white font-mono text-[11px] outline-none"
              />
              <button
                onClick={() => handleCommitEdit('height')}
                className="p-0.5 text-emerald-400 hover:text-emerald-300"
              >
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
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors flex items-center gap-1 ${
                isPinned
                  ? 'opacity-60 cursor-not-allowed text-slate-500'
                  : 'hover:bg-[var(--control-hover)] text-slate-300 hover:text-white'
              }`}
              title={isPinned ? 'Element pinned (UP to unpin)' : 'Click to edit height'}
            >
              <span className="text-slate-400">H:</span>
              <span className="font-semibold text-white tabular-nums">{heightVal.toFixed(2)}m</span>
            </button>
          )}

          {/* Thickness Badge (for walls/slabs) */}
          {(entityType.includes('Wall') || entityType.includes('Slab')) && (
            editingParam === 'thickness' ? (
              <div className="flex items-center gap-0.5 bg-[var(--control-bg)] rounded px-1.5 py-0.5 border border-cyan-500/50">
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
                  className="w-12 bg-transparent text-white font-mono text-[11px] outline-none"
                />
                <button
                  onClick={() => handleCommitEdit('thickness')}
                  className="p-0.5 text-emerald-400 hover:text-emerald-300"
                >
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
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors flex items-center gap-1 ${
                  isPinned
                    ? 'opacity-60 cursor-not-allowed text-slate-500'
                    : 'hover:bg-[var(--control-hover)] text-slate-300 hover:text-white'
                }`}
                title={isPinned ? 'Element pinned (UP to unpin)' : 'Click to edit thickness'}
              >
                <span className="text-slate-400">T:</span>
                <span className="font-semibold text-white tabular-nums">{thicknessVal.toFixed(2)}m</span>
              </button>
            )
          )}

          {/* Elevation Badge */}
          {editingParam === 'elevation' ? (
            <div className="flex items-center gap-0.5 bg-[var(--control-bg)] rounded px-1.5 py-0.5 border border-cyan-500/50">
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
                className="w-12 bg-transparent text-white font-mono text-[11px] outline-none"
              />
              <button
                onClick={() => handleCommitEdit('elevation')}
                className="p-0.5 text-emerald-400 hover:text-emerald-300"
              >
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
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors flex items-center gap-1 ${
                isPinned
                  ? 'opacity-60 cursor-not-allowed text-slate-500'
                  : 'hover:bg-[var(--control-hover)] text-slate-300 hover:text-white'
              }`}
              title={isPinned ? 'Element pinned (UP to unpin)' : 'Click to edit elevation'}
            >
              <span className="text-slate-400">El:</span>
              <span className="font-semibold text-white tabular-nums">+{elevationVal.toFixed(2)}m</span>
            </button>
          )}
        </div>

        {/* Section 3: BIM Organization (Storey & Material) */}
        <div className="flex items-center gap-0.5 px-1 border-r border-[var(--border-subtle)]">
          {/* Storey Selector Button */}
          <button
            data-qa="modify-storey-btn"
            data-qa-alias="selection-storey-btn"
            disabled={isPinned}
            onClick={() => {
              if (isPinned) return;
              setActiveMenu(activeMenu === 'storey' ? null : 'storey');
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
              isPinned
                ? 'opacity-40 cursor-not-allowed text-slate-500'
                : activeMenu === 'storey'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-300 hover:text-white hover:bg-[var(--control-hover)]'
            }`}
            title="Assign Storey containment"
          >
            <Layers size={13} className="text-cyan-400" />
            <span>Storey</span>
          </button>

          {/* Material Palette Button */}
          <button
            data-qa="modify-material-btn"
            data-qa-alias="selection-material-btn"
            disabled={isPinned}
            onClick={() => {
              if (isPinned) return;
              setActiveMenu(activeMenu === 'material' ? null : 'material');
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
              isPinned
                ? 'opacity-40 cursor-not-allowed text-slate-500'
                : activeMenu === 'material'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-300 hover:text-white hover:bg-[var(--control-hover)]'
            }`}
            title="Assign architectural material"
          >
            <Palette size={13} className="text-cyan-400" />
            <span>Material</span>
          </button>

          {/* Properties Inspector Trigger */}
          <button
            data-qa="modify-inspector-btn"
            onClick={onOpenInspector}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-slate-300 hover:text-white hover:bg-[var(--control-hover)] transition-colors"
            title="Open Properties Inspector"
          >
            <SlidersHorizontal size={13} className="text-cyan-400" />
            <span>Properties</span>
          </button>
        </div>

        {/* Section 4: Focus, Delete & Deselect */}
        <div className="flex items-center gap-0.5 pl-1">
          {/* Focus in View (F) */}
          <button
            data-qa="modify-focus-btn"
            data-qa-alias="selection-focus-btn"
            onClick={() => onFocus(expressId)}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-[var(--control-hover)] transition-colors"
            title="Focus camera on element (F)"
          >
            <Focus size={13} />
          </button>

          {/* Delete Element (Del) */}
          <button
            data-qa="modify-delete-btn"
            data-qa-alias="selection-delete-btn"
            disabled={isPinned}
            onClick={() => {
              if (isPinned) return;
              onDelete(expressId);
            }}
            className={`p-1.5 rounded-full transition-colors ${
              isPinned
                ? 'opacity-30 cursor-not-allowed text-slate-500'
                : 'text-rose-400 hover:text-rose-300 hover:bg-rose-500/20'
            }`}
            title={isPinned ? 'Element pinned (UP to unpin)' : 'Delete element (Del)'}
          >
            <Trash2 size={13} />
          </button>

          {/* Deselect / Close Button */}
          <button
            data-qa="modify-close-btn"
            onClick={onDeselect}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-[var(--control-hover)] transition-colors ml-0.5"
            title="Clear selection (Esc)"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Contextual Popovers */}
      {/* 1. Move Flyout */}
      {activeMenu === 'move' && (
        <div className="mt-2 w-72 p-3 rounded-2xl bg-[var(--dock-bg)] backdrop-blur-2xl border border-[var(--border-subtle)] shadow-[var(--shadow-hud)] text-slate-200 text-xs animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-subtle)] font-semibold text-white">
            <span className="flex items-center gap-1.5">
              <Move size={13} className="text-cyan-400" />
              Move Element (MV)
            </span>
            <button onClick={() => setActiveMenu(null)} className="text-slate-400 hover:text-white">
              <X size={12} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Delta X (m)</label>
              <input
                type="number"
                step="0.5"
                value={moveVector[0]}
                onChange={(e) => setMoveVector([parseFloat(e.target.value) || 0, moveVector[1], moveVector[2]])}
                className="w-full bg-[var(--control-bg)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Delta Y (m)</label>
              <input
                type="number"
                step="0.5"
                value={moveVector[1]}
                onChange={(e) => setMoveVector([moveVector[0], parseFloat(e.target.value) || 0, moveVector[2]])}
                className="w-full bg-[var(--control-bg)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Delta Z (m)</label>
              <input
                type="number"
                step="0.5"
                value={moveVector[2]}
                onChange={(e) => setMoveVector([moveVector[0], moveVector[1], parseFloat(e.target.value) || 0])}
                className="w-full bg-[var(--control-bg)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-white font-mono"
              />
            </div>
          </div>
          <button
            onClick={() => {
              if (onMove) onMove(expressId, moveVector);
              setActiveMenu(null);
            }}
            className="w-full py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <Check size={13} />
            <span>Apply Move</span>
          </button>
        </div>
      )}

      {/* 2. Rotate Flyout */}
      {activeMenu === 'rotate' && (
        <div className="mt-2 w-72 p-3 rounded-2xl bg-[var(--dock-bg)] backdrop-blur-2xl border border-[var(--border-subtle)] shadow-[var(--shadow-hud)] text-slate-200 text-xs animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-subtle)] font-semibold text-white">
            <span className="flex items-center gap-1.5">
              <RotateCw size={13} className="text-cyan-400" />
              Rotate Element (RO)
            </span>
            <button onClick={() => setActiveMenu(null)} className="text-slate-400 hover:text-white">
              <X size={12} />
            </button>
          </div>
          <div className="flex items-center gap-1 mb-2">
            {[45, 90, 180].map((deg) => (
              <button
                key={deg}
                onClick={() => setRotateAngle(deg)}
                className={`flex-1 py-1 rounded text-xs font-mono transition-colors ${
                  rotateAngle === deg
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                    : 'bg-[var(--control-bg)] hover:bg-[var(--control-hover)] text-slate-300'
                }`}
              >
                {deg}°
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1">
              <label className="text-[10px] text-slate-400 block mb-0.5">Angle (°)</label>
              <input
                type="number"
                value={rotateAngle}
                onChange={(e) => setRotateAngle(parseFloat(e.target.value) || 0)}
                className="w-full bg-[var(--control-bg)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-white font-mono"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-slate-400 block mb-0.5">Axis</label>
              <select
                value={rotateAxis}
                onChange={(e) => setRotateAxis(e.target.value as 'x' | 'y' | 'z')}
                className="w-full bg-[var(--control-bg)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-white font-mono"
              >
                <option value="z">Z (Vertical)</option>
                <option value="x">X (Pitch)</option>
                <option value="y">Y (Roll)</option>
              </select>
            </div>
          </div>
          <button
            onClick={() => {
              if (onRotate) onRotate(expressId, rotateAngle, rotateAxis);
              setActiveMenu(null);
            }}
            className="w-full py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <Check size={13} />
            <span>Apply Rotation</span>
          </button>
        </div>
      )}

      {/* 3. Mirror Flyout */}
      {activeMenu === 'mirror' && (
        <div className="mt-2 w-72 p-3 rounded-2xl bg-[var(--dock-bg)] backdrop-blur-2xl border border-[var(--border-subtle)] shadow-[var(--shadow-hud)] text-slate-200 text-xs animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-subtle)] font-semibold text-white">
            <span className="flex items-center gap-1.5">
              <FlipHorizontal size={13} className="text-cyan-400" />
              Mirror Element (MM)
            </span>
            <button onClick={() => setActiveMenu(null)} className="text-slate-400 hover:text-white">
              <X size={12} />
            </button>
          </div>
          <div className="mb-2">
            <label className="text-[10px] text-slate-400 block mb-0.5">Mirror Plane Axis</label>
            <div className="flex items-center gap-1">
              {(['x', 'y', 'z'] as const).map((ax) => (
                <button
                  key={ax}
                  onClick={() => setMirrorAxis(ax)}
                  className={`flex-1 py-1 rounded text-xs font-mono uppercase transition-colors ${
                    mirrorAxis === ax
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                      : 'bg-[var(--control-bg)] hover:bg-[var(--control-hover)] text-slate-300'
                  }`}
                >
                  {ax} Plane
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 mb-3 cursor-pointer select-none text-slate-300 text-xs">
            <input
              type="checkbox"
              checked={mirrorIsCopy}
              onChange={(e) => setMirrorIsCopy(e.target.checked)}
              className="rounded bg-[var(--control-bg)] border-[var(--border-subtle)] text-cyan-500 focus:ring-0"
            />
            <span>Create duplicate copy (Copy mode)</span>
          </label>
          <button
            onClick={() => {
              if (onMirror) onMirror(expressId, mirrorAxis, mirrorIsCopy);
              setActiveMenu(null);
            }}
            className="w-full py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <Check size={13} />
            <span>Apply Mirror</span>
          </button>
        </div>
      )}

      {/* 4. Array Flyout */}
      {activeMenu === 'array' && (
        <div className="mt-2 w-72 p-3 rounded-2xl bg-[var(--dock-bg)] backdrop-blur-2xl border border-[var(--border-subtle)] shadow-[var(--shadow-hud)] text-slate-200 text-xs animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-subtle)] font-semibold text-white">
            <span className="flex items-center gap-1.5">
              <Grid3x3 size={13} className="text-cyan-400" />
              Linear Array (AR)
            </span>
            <button onClick={() => setActiveMenu(null)} className="text-slate-400 hover:text-white">
              <X size={12} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Total Count (N)</label>
              <input
                type="number"
                min="2"
                max="20"
                value={arrayCount}
                onChange={(e) => setArrayCount(Math.max(2, parseInt(e.target.value) || 2))}
                className="w-full bg-[var(--control-bg)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Spacing (m)</label>
              <input
                type="number"
                step="0.5"
                min="0.1"
                value={arraySpacing}
                onChange={(e) => setArraySpacing(parseFloat(e.target.value) || 1.0)}
                className="w-full bg-[var(--control-bg)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-white font-mono"
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="text-[10px] text-slate-400 block mb-0.5">Direction Axis</label>
            <div className="flex items-center gap-1">
              {(['x', 'y', 'z'] as const).map((ax) => (
                <button
                  key={ax}
                  onClick={() => setArrayAxis(ax)}
                  className={`flex-1 py-1 rounded text-xs font-mono uppercase transition-colors ${
                    arrayAxis === ax
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                      : 'bg-[var(--control-bg)] hover:bg-[var(--control-hover)] text-slate-300'
                  }`}
                >
                  +{ax}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => {
              if (onArray) {
                const deltaVec: [number, number, number] = [
                  arrayAxis === 'x' ? arraySpacing : 0,
                  arrayAxis === 'y' ? arraySpacing : 0,
                  arrayAxis === 'z' ? arraySpacing : 0,
                ];
                onArray(expressId, arrayCount, deltaVec);
              }
              setActiveMenu(null);
            }}
            className="w-full py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <Check size={13} />
            <span>Generate Array</span>
          </button>
        </div>
      )}

      {/* 5. Align Flyout */}
      {activeMenu === 'align' && (
        <div className="mt-2 w-72 p-3 rounded-2xl bg-[var(--dock-bg)] backdrop-blur-2xl border border-[var(--border-subtle)] shadow-[var(--shadow-hud)] text-slate-200 text-xs animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-subtle)] font-semibold text-white">
            <span className="flex items-center gap-1.5">
              <AlignHorizontalJustifyCenter size={13} className="text-cyan-400" />
              Align Coordinate (AL)
            </span>
            <button onClick={() => setActiveMenu(null)} className="text-slate-400 hover:text-white">
              <X size={12} />
            </button>
          </div>
          <div className="mb-2">
            <label className="text-[10px] text-slate-400 block mb-0.5">Alignment Axis</label>
            <div className="flex items-center gap-1">
              {(['z', 'x', 'y'] as const).map((ax) => (
                <button
                  key={ax}
                  onClick={() => setAlignAxis(ax)}
                  className={`flex-1 py-1 rounded text-xs font-mono uppercase transition-colors ${
                    alignAxis === ax
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                      : 'bg-[var(--control-bg)] hover:bg-[var(--control-hover)] text-slate-300'
                  }`}
                >
                  {ax} Axis
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1">
              <label className="text-[10px] text-slate-400 block mb-0.5">Target Value (m)</label>
              <input
                type="number"
                step="0.5"
                value={alignValue}
                onChange={(e) => setAlignValue(e.target.value)}
                className="w-full bg-[var(--control-bg)] border border-[var(--border-subtle)] rounded px-2 py-1 text-xs text-white font-mono"
              />
            </div>
            <button
              onClick={() => setAlignValue('0.0')}
              className="mt-4 px-2 py-1 rounded bg-[var(--control-bg)] hover:bg-[var(--control-hover)] text-slate-300 text-xs font-mono"
              title="Set to Ground 0.0m"
            >
              Ground
            </button>
          </div>
          <button
            onClick={() => {
              if (onAlign) {
                const val = parseFloat(alignValue) || 0.0;
                onAlign(expressId, alignAxis, val);
              }
              setActiveMenu(null);
            }}
            className="w-full py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <Check size={13} />
            <span>Apply Alignment</span>
          </button>
        </div>
      )}

      {/* 6. Storey Flyout */}
      {activeMenu === 'storey' && (
        <div className="mt-2 w-64 p-2 rounded-2xl bg-[var(--dock-bg)] backdrop-blur-2xl border border-[var(--border-subtle)] shadow-[var(--shadow-hud)] text-slate-200 text-xs animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[var(--border-subtle)] font-semibold text-white px-1">
            <span className="flex items-center gap-1.5">
              <Layers size={13} className="text-cyan-400" />
              Building Storey
            </span>
            <button onClick={() => setActiveMenu(null)} className="text-slate-400 hover:text-white">
              <X size={12} />
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {storeys.length === 0 ? (
              <div className="text-slate-400 text-center py-2 text-[11px]">No storeys available</div>
            ) : (
              storeys.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    onAssignStorey(expressId, s.id);
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[var(--control-hover)] text-slate-300 hover:text-white flex items-center justify-between transition-colors text-xs"
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="text-[10px] font-mono text-slate-400">+{s.elevation.toFixed(2)}m</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* 7. Material Flyout */}
      {activeMenu === 'material' && (
        <div className="mt-2 w-64 p-2 rounded-2xl bg-[var(--dock-bg)] backdrop-blur-2xl border border-[var(--border-subtle)] shadow-[var(--shadow-hud)] text-slate-200 text-xs animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[var(--border-subtle)] font-semibold text-white px-1">
            <span className="flex items-center gap-1.5">
              <Palette size={13} className="text-cyan-400" />
              Architectural Material
            </span>
            <button onClick={() => setActiveMenu(null)} className="text-slate-400 hover:text-white">
              <X size={12} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {ARCHITECTURAL_MATERIALS.map((m) => (
              <button
                key={m.name}
                onClick={() => {
                  onAssignMaterial(expressId, m.name);
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--control-hover)] text-slate-300 hover:text-white transition-colors text-xs text-left"
              >
                <div className={`w-3.5 h-3.5 rounded-full ${m.bgClass} border border-white/20 shrink-0`} />
                <span className="truncate">{m.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
