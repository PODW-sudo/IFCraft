import React, { useState, useEffect, useRef } from 'react';
import {
  Copy,
  Trash2,
  Layers,
  Palette,
  Focus,
  SlidersHorizontal,
  Check,
  Box,
  Building,
  Columns,
  DoorOpen,
  AppWindow,
  RotateCw,
  FlipHorizontal,
  Grid3x3,
  AlignHorizontalJustifyCenter,
  Pin,
  PinOff,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import type { ElementDetails } from '../../types/ifc';

export interface SelectionContextOverlayProps {
  expressId: number | null;
  elementDetails: ElementDetails | null;
  screenPosition: { x: number; y: number } | null;
  storeys?: { id: number; name: string; elevation: number }[];
  isPinned?: boolean;
  onClone: (expressId: number) => void;
  onDelete: (expressId: number) => void;
  onUpdateGeometry: (expressId: number, params: { height?: number; thickness?: number; elevation?: number }) => void;
  onAssignStorey: (expressId: number, storeyId: number) => void;
  onAssignMaterial: (expressId: number, materialName: string, colorHex?: string) => void;
  onFocus: (expressId: number) => void;
  onOpenInspector: () => void;
  onMove?: (expressId: number, delta: [number, number, number]) => void;
  onRotate?: (expressId: number, angle_degrees: number, axis: 'x' | 'y' | 'z') => void;
  onMirror?: (expressId: number, axis: 'x' | 'y' | 'z', is_copy: boolean) => void;
  onArray?: (expressId: number, count: number, delta: [number, number, number]) => void;
  onAlign?: (expressId: number, axis: 'x' | 'y' | 'z', target_value?: number) => void;
  onTogglePin?: (expressId: number) => void;
}

const ARCHITECTURAL_MATERIALS = [
  { name: 'Concrete', bgClass: 'bg-slate-400', colorName: 'slate-400' },
  { name: 'Red Brick', bgClass: 'bg-rose-700', colorName: 'rose-700' },
  { name: 'Timber Wood', bgClass: 'bg-amber-600', colorName: 'amber-600' },
  { name: 'Clear Glass', bgClass: 'bg-cyan-400', colorName: 'cyan-400', transparency: 0.7 },
  { name: 'Structural Steel', bgClass: 'bg-slate-600', colorName: 'slate-600' },
  { name: 'White Plaster', bgClass: 'bg-slate-100', colorName: 'slate-100' },
];

export const SelectionContextOverlay: React.FC<SelectionContextOverlayProps> = ({
  expressId,
  elementDetails,
  screenPosition,
  storeys = [],
  isPinned = false,
  onClone,
  onDelete,
  onUpdateGeometry,
  onAssignStorey,
  onAssignMaterial,
  onFocus,
  onOpenInspector,
  onRotate,
  onMirror,
  onArray,
  onAlign,
  onTogglePin,
}) => {
  const [showStoreyMenu, setShowStoreyMenu] = useState(false);
  const [showMaterialMenu, setShowMaterialMenu] = useState(false);
  const [activeToolMenu, setActiveToolMenu] = useState<'rotate' | 'mirror' | 'array' | 'align' | null>(null);
  const [editingParam, setEditingParam] = useState<'height' | 'thickness' | 'elevation' | null>(null);
  const [tempValue, setTempValue] = useState<string>('');
  const [isExtended, setIsExtended] = useState(false);

  // Tool params state
  const [rotateAngle, setRotateAngle] = useState<number>(90);
  const [rotateAxis, setRotateAxis] = useState<'x' | 'y' | 'z'>('z');
  const [mirrorAxis, setMirrorAxis] = useState<'x' | 'y' | 'z'>('x');
  const [mirrorIsCopy, setMirrorIsCopy] = useState<boolean>(true);
  const [arrayCount, setArrayCount] = useState<number>(3);
  const [arraySpacing, setArraySpacing] = useState<number>(2.0);
  const [arrayAxis, setArrayAxis] = useState<'x' | 'y' | 'z'>('x');
  const [alignAxis, setAlignAxis] = useState<'x' | 'y' | 'z'>('z');
  const [alignValue, setAlignValue] = useState<string>('0.0');

  const overlayRef = useRef<HTMLDivElement>(null);

  // Close submenus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        setShowStoreyMenu(false);
        setShowMaterialMenu(false);
        setActiveToolMenu(null);
        setEditingParam(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!expressId || !screenPosition) return null;

  const entityType = elementDetails?.type || 'IfcProduct';
  const entityName = elementDetails?.name || `#${expressId}`;

  // Extract dimensions from element details or psets if present
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

  // Clamp screen coordinates so overlay stays within window viewport
  const overlayWidth = isExtended ? 420 : 160;
  const posX = Math.max(16, Math.min(window.innerWidth - overlayWidth - 20, screenPosition.x - overlayWidth / 2));
  const posY = Math.max(70, Math.min(window.innerHeight - (isExtended ? 140 : 60), screenPosition.y - 42));

  return (
    <div
      ref={overlayRef}
      data-qa="selection-context-overlay"
      data-selected-express-id={expressId}
      style={{ left: `${posX}px`, top: `${posY}px` }}
      className="fixed z-40 pointer-events-auto select-none flex flex-col items-center animate-in fade-in-50 zoom-in-95 duration-150"
    >
      {/* Primary Floating Capsule */}
      {!isExtended ? (
        /* Minimal In-Canvas Capsule (Default) */
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-dock/95 backdrop-blur-2xl border border-border-subtle shadow-dock text-text-primary text-xs">
          {/* Entity Identification Badge */}
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-canvas/60 border border-border-subtle/60 text-text-primary font-medium"
            title={`${entityType} #${expressId}`}
          >
            {getEntityIcon(entityType)}
            <span className="font-semibold text-[11px] truncate max-w-[85px]">
              {entityName}
            </span>
            <span className="text-[10px] font-mono text-text-secondary opacity-70">
              #{expressId}
            </span>
          </div>

          {/* Pinned Indicator Badge */}
          {isPinned && (
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-medium text-[10px]"
              title="Element is pinned (UP to unpin)"
            >
              <Pin size={10} className="text-amber-400" />
            </div>
          )}

          {/* Pin / Unpin button */}
          <button
            data-qa="selection-pin-btn"
            onClick={() => onTogglePin && onTogglePin(expressId)}
            className={`p-1 rounded-full transition-colors ${
              isPinned
                ? 'text-amber-300 bg-amber-500/20 border border-amber-500/40'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60'
            }`}
            title={isPinned ? "Unpin element (UP)" : "Pin element (PN)"}
          >
            {isPinned ? <PinOff size={11} /> : <Pin size={11} />}
          </button>

          {/* Focus button */}
          <button
            data-qa="selection-focus-btn"
            onClick={() => onFocus(expressId)}
            className="p-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60 transition-colors"
            title="Focus camera on element (F)"
          >
            <Focus size={11} />
          </button>

          {/* Extend Toggle Button */}
          <button
            data-qa="selection-extend-btn"
            onClick={() => setIsExtended(true)}
            className="p-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60 transition-colors"
            title="Extend in-canvas controls"
          >
            <ChevronDown size={11} />
          </button>
        </div>
      ) : (
        /* Extended State */
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-surface-dock/95 backdrop-blur-2xl border border-border-subtle shadow-dock text-text-primary text-xs">
          {/* Entity Identification Badge */}
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-canvas/60 border border-border-subtle/60 text-text-primary font-medium"
            title={`${entityType} #${expressId}`}
          >
            {getEntityIcon(entityType)}
            <span className="font-semibold text-[11px] truncate max-w-[100px]">
              {entityName}
            </span>
            <span className="text-[10px] font-mono text-text-secondary opacity-70">
              #{expressId}
            </span>
          </div>

          {/* Collapse Button */}
          <button
            data-qa="selection-collapse-btn"
            onClick={() => {
              setIsExtended(false);
              setActiveToolMenu(null);
              setShowStoreyMenu(false);
              setShowMaterialMenu(false);
              setEditingParam(null);
            }}
            className="p-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60 transition-colors"
            title="Collapse in-canvas controls"
          >
            <ChevronUp size={11} />
          </button>

        {/* Pinned Indicator Badge */}
        {isPinned && (
          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-medium text-[10px]"
            title="Element is pinned (UP to unpin)"
          >
            <Pin size={10} className="text-amber-400" />
            <span>Pinned</span>
          </div>
        )}

        {/* Live Parametric Dimension Badges */}
        <div className="flex items-center gap-1 px-1 border-x border-border-subtle/50">
          {/* Height Badge */}
          {editingParam === 'height' ? (
            <div className="flex items-center gap-0.5 bg-surface-canvas rounded px-1 py-0.5 border border-cyan-500/50">
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
                  ? 'opacity-60 cursor-not-allowed text-text-secondary'
                  : 'hover:bg-surface-canvas/50 text-text-secondary hover:text-text-primary'
              }`}
              title={isPinned ? 'Element pinned (UP to unpin)' : 'Click to edit wall/element height'}
            >
              <span className="opacity-60">H:</span>
              <span className="font-semibold text-text-primary tabular-nums">{heightVal.toFixed(2)}m</span>
            </button>
          )}

          {/* Thickness Badge (for walls/slabs) */}
          {(entityType.includes('Wall') || entityType.includes('Slab')) && (
            editingParam === 'thickness' ? (
              <div className="flex items-center gap-0.5 bg-surface-canvas rounded px-1 py-0.5 border border-cyan-500/50">
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
                    ? 'opacity-60 cursor-not-allowed text-text-secondary'
                    : 'hover:bg-surface-canvas/50 text-text-secondary hover:text-text-primary'
                }`}
                title={isPinned ? 'Element pinned (UP to unpin)' : 'Click to edit wall thickness'}
              >
                <span className="opacity-60">T:</span>
                <span className="font-semibold text-text-primary tabular-nums">{thicknessVal.toFixed(2)}m</span>
              </button>
            )
          )}

          {/* Elevation Badge */}
          {editingParam === 'elevation' ? (
            <div className="flex items-center gap-0.5 bg-surface-canvas rounded px-1 py-0.5 border border-cyan-500/50">
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
                  ? 'opacity-60 cursor-not-allowed text-text-secondary'
                  : 'hover:bg-surface-canvas/50 text-text-secondary hover:text-text-primary'
              }`}
              title={isPinned ? 'Element pinned (UP to unpin)' : 'Click to edit element elevation'}
            >
              <span className="opacity-60">El:</span>
              <span className="font-semibold text-text-primary tabular-nums">+{elevationVal.toFixed(2)}m</span>
            </button>
          )}
        </div>

        {/* Quick CAD Action Icons */}
        <div className="flex items-center gap-0.5">
          {/* Focus In Camera (F) */}
          <button
            data-qa="selection-focus-btn"
            onClick={() => onFocus(expressId)}
            className="p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60 transition-colors"
            title="Focus camera on element (F)"
          >
            <Focus size={13} />
          </button>

          {/* Pin / Unpin (PN / UP) */}
          <button
            data-qa="selection-pin-btn"
            onClick={() => onTogglePin && onTogglePin(expressId)}
            className={`p-1.5 rounded-full transition-colors ${
              isPinned
                ? 'text-amber-300 bg-amber-500/20 border border-amber-500/40'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60'
            }`}
            title={isPinned ? "Unpin element (UP)" : "Pin element (PN)"}
          >
            {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
          </button>

          {/* Rotate (RO) */}
          <button
            data-qa="selection-rotate-btn"
            disabled={isPinned}
            onClick={() => {
              if (isPinned) return;
              setActiveToolMenu(activeToolMenu === 'rotate' ? null : 'rotate');
              setShowStoreyMenu(false);
              setShowMaterialMenu(false);
            }}
            className={`p-1.5 rounded-full transition-colors ${
              isPinned
                ? 'opacity-40 cursor-not-allowed text-text-secondary'
                : activeToolMenu === 'rotate'
                ? 'text-action-primary-text bg-action-primary-bg'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60'
            }`}
            title="Rotate element (RO)"
          >
            <RotateCw size={13} />
          </button>

          {/* Mirror (MM) */}
          <button
            data-qa="selection-mirror-btn"
            disabled={isPinned}
            onClick={() => {
              if (isPinned) return;
              setActiveToolMenu(activeToolMenu === 'mirror' ? null : 'mirror');
              setShowStoreyMenu(false);
              setShowMaterialMenu(false);
            }}
            className={`p-1.5 rounded-full transition-colors ${
              isPinned
                ? 'opacity-40 cursor-not-allowed text-text-secondary'
                : activeToolMenu === 'mirror'
                ? 'text-action-primary-text bg-action-primary-bg'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60'
            }`}
            title="Mirror element (MM)"
          >
            <FlipHorizontal size={13} />
          </button>

          {/* Array (AR) */}
          <button
            data-qa="selection-array-btn"
            onClick={() => {
              setActiveToolMenu(activeToolMenu === 'array' ? null : 'array');
              setShowStoreyMenu(false);
              setShowMaterialMenu(false);
            }}
            className={`p-1.5 rounded-full transition-colors ${
              activeToolMenu === 'array'
                ? 'text-action-primary-text bg-action-primary-bg'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60'
            }`}
            title="Linear array (AR)"
          >
            <Grid3x3 size={13} />
          </button>

          {/* Align (AL) */}
          <button
            data-qa="selection-align-btn"
            disabled={isPinned}
            onClick={() => {
              if (isPinned) return;
              setActiveToolMenu(activeToolMenu === 'align' ? null : 'align');
              setShowStoreyMenu(false);
              setShowMaterialMenu(false);
            }}
            className={`p-1.5 rounded-full transition-colors ${
              isPinned
                ? 'opacity-40 cursor-not-allowed text-text-secondary'
                : activeToolMenu === 'align'
                ? 'text-action-primary-text bg-action-primary-bg'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60'
            }`}
            title="Align element (AL)"
          >
            <AlignHorizontalJustifyCenter size={13} />
          </button>

          {/* Duplicate / Clone (CO / Ctrl+D) */}
          <button
            data-qa="selection-clone-btn"
            onClick={() => onClone(expressId)}
            className="p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60 transition-colors"
            title="Duplicate / Copy (CO / Ctrl+D)"
          >
            <Copy size={13} />
          </button>

          {/* Assign Storey Trigger */}
          <button
            data-qa="selection-storey-btn"
            onClick={() => {
              setShowStoreyMenu(!showStoreyMenu);
              setShowMaterialMenu(false);
              setActiveToolMenu(null);
            }}
            className={`p-1.5 rounded-full transition-colors ${
              showStoreyMenu
                ? 'text-action-primary-text bg-action-primary-bg'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60'
            }`}
            title="Reassign Building Storey"
          >
            <Layers size={13} />
          </button>

          {/* Material Palette Trigger */}
          <button
            data-qa="selection-material-btn"
            onClick={() => {
              setShowMaterialMenu(!showMaterialMenu);
              setShowStoreyMenu(false);
              setActiveToolMenu(null);
            }}
            className={`p-1.5 rounded-full transition-colors ${
              showMaterialMenu
                ? 'text-action-primary-text bg-action-primary-bg'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60'
            }`}
            title="Override architectural material / style"
          >
            <Palette size={13} />
          </button>

          {/* Open Full Inspector Drawer */}
          <button
            data-qa="selection-inspector-btn"
            onClick={onOpenInspector}
            className="p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60 transition-colors"
            title="Inspect full IFC properties & sets"
          >
            <SlidersHorizontal size={13} />
          </button>

          {/* Delete Element (Del) - Strict Intent Danger Token */}
          <button
            data-qa="selection-delete-btn"
            disabled={isPinned}
            onClick={() => {
              if (isPinned) return;
              onDelete(expressId);
            }}
            className={`p-1.5 rounded-full transition-colors ml-0.5 ${
              isPinned
                ? 'opacity-30 cursor-not-allowed text-text-secondary'
                : 'text-red-400 hover:text-red-300 hover:bg-red-500/15'
            }`}
            title={isPinned ? "Element is pinned (UP to unpin)" : "Delete element (Delete)"}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      )}

      {/* Flyout Submenus (only when extended) */}
      {isExtended && (
        <>
          {/* Storey Selector Flyout */}
          {showStoreyMenu && (
        <div
          data-qa="selection-storey-menu"
          className="absolute top-full mt-2 w-48 rounded-xl bg-surface-dock/95 backdrop-blur-2xl border border-border-subtle shadow-hud p-1.5 flex flex-col gap-0.5 text-xs text-text-primary animate-in fade-in-50 zoom-in-95"
        >
          <div className="px-2 py-1 text-[10px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border-subtle/40 mb-1">
            Assign Storey
          </div>
          {storeys.length === 0 ? (
            <div className="px-2 py-1.5 text-text-secondary text-[11px]">No other storeys found</div>
          ) : (
            storeys.map((st) => (
              <button
                key={st.id}
                onClick={() => {
                  onAssignStorey(expressId, st.id);
                  setShowStoreyMenu(false);
                }}
                className="w-full text-left px-2 py-1 rounded-lg hover:bg-surface-canvas/60 transition-colors flex items-center justify-between text-[11px]"
              >
                <span>{st.name}</span>
                <span className="font-mono text-[10px] text-text-secondary">
                  +{st.elevation.toFixed(1)}m
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Material Palette Flyout */}
      {showMaterialMenu && (
        <div
          data-qa="selection-material-menu"
          className="absolute top-full mt-2 w-52 rounded-xl bg-surface-dock/95 backdrop-blur-2xl border border-border-subtle shadow-hud p-1.5 flex flex-col gap-1 text-xs text-text-primary animate-in fade-in-50 zoom-in-95"
        >
          <div className="px-2 py-1 text-[10px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border-subtle/40 mb-0.5">
            Architectural Styles
          </div>
          <div className="grid grid-cols-2 gap-1 p-0.5">
            {ARCHITECTURAL_MATERIALS.map((mat) => (
              <button
                key={mat.name}
                onClick={() => {
                  onAssignMaterial(expressId, mat.name, mat.colorName);
                  setShowMaterialMenu(false);
                }}
                className="flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-surface-canvas/60 transition-colors text-left"
              >
                <span
                  className={`w-3.5 h-3.5 rounded border border-border-subtle flex-shrink-0 ${mat.bgClass}`}
                />
                <span className="text-[11px] truncate">{mat.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {/* Rotate Tool Flyout */}
      {activeToolMenu === 'rotate' && (
        <div
          data-qa="selection-rotate-menu"
          className="absolute top-full mt-2 w-56 rounded-xl bg-surface-dock/95 backdrop-blur-2xl border border-border-subtle shadow-hud p-2 flex flex-col gap-1.5 text-xs text-text-primary animate-in fade-in-50 zoom-in-95"
        >
          <div className="px-1 py-0.5 text-[10px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border-subtle/40 mb-0.5 flex items-center justify-between">
            <span>Rotate Element (RO)</span>
            <span className="font-mono text-[9px] text-cyan-400">Axis {rotateAxis.toUpperCase()}</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {[90, -90, 45, 180].map((deg) => (
              <button
                key={deg}
                onClick={() => {
                  setRotateAngle(deg);
                  if (onRotate) {
                    onRotate(expressId, deg, rotateAxis);
                    setActiveToolMenu(null);
                  }
                }}
                className={`py-1 rounded text-[11px] font-mono transition-colors text-center ${
                  rotateAngle === deg
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                    : 'bg-surface-canvas/60 hover:bg-surface-canvas text-text-secondary hover:text-text-primary'
                }`}
              >
                {deg > 0 ? `+${deg}°` : `${deg}°`}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-border-subtle/30">
            <span className="text-[10px] text-text-secondary font-mono">Axis:</span>
            <div className="flex rounded p-0.5 bg-surface-canvas border border-border-subtle/50">
              {(['z', 'x', 'y'] as const).map((ax) => (
                <button
                  key={ax}
                  onClick={() => setRotateAxis(ax)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase transition-colors ${
                    rotateAxis === ax ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {ax}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                if (onRotate) {
                  onRotate(expressId, rotateAngle, rotateAxis);
                  setActiveToolMenu(null);
                }
              }}
              className="ml-auto px-2.5 py-1 rounded bg-action-primary-bg hover:bg-cyan-400 text-action-primary-text text-[11px] font-semibold transition-colors shadow-sm"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Mirror Tool Flyout */}
      {activeToolMenu === 'mirror' && (
        <div
          data-qa="selection-mirror-menu"
          className="absolute top-full mt-2 w-56 rounded-xl bg-surface-dock/95 backdrop-blur-2xl border border-border-subtle shadow-hud p-2 flex flex-col gap-1.5 text-xs text-text-primary animate-in fade-in-50 zoom-in-95"
        >
          <div className="px-1 py-0.5 text-[10px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border-subtle/40 mb-0.5 flex items-center justify-between">
            <span>Mirror Element (MM)</span>
            <span className="font-mono text-[9px] text-cyan-400">{mirrorIsCopy ? 'Duplicate' : 'In-place'}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-[11px] text-text-secondary">Mirror Axis:</span>
            <div className="flex rounded p-0.5 bg-surface-canvas border border-border-subtle/50">
              {(['x', 'y', 'z'] as const).map((ax) => (
                <button
                  key={ax}
                  onClick={() => setMirrorAxis(ax)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase transition-colors ${
                    mirrorAxis === ax ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {ax}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer py-1 px-1 rounded hover:bg-surface-canvas/50">
            <input
              type="checkbox"
              checked={mirrorIsCopy}
              onChange={(e) => setMirrorIsCopy(e.target.checked)}
              className="rounded border-border-subtle text-cyan-500 focus:ring-0"
            />
            <span className="text-[11px] text-text-primary">Copy original (Duplicate)</span>
          </label>
          <button
            onClick={() => {
              if (onMirror) {
                onMirror(expressId, mirrorAxis, mirrorIsCopy);
                setActiveToolMenu(null);
              }
            }}
            className="w-full mt-1 py-1 rounded bg-action-primary-bg hover:bg-cyan-400 text-action-primary-text text-[11px] font-semibold transition-colors shadow-sm text-center"
          >
            Mirror Element
          </button>
        </div>
      )}

      {/* Array Tool Flyout */}
      {activeToolMenu === 'array' && (
        <div
          data-qa="selection-array-menu"
          className="absolute top-full mt-2 w-60 rounded-xl bg-surface-dock/95 backdrop-blur-2xl border border-border-subtle shadow-hud p-2.5 flex flex-col gap-2 text-xs text-text-primary animate-in fade-in-50 zoom-in-95"
        >
          <div className="px-1 py-0.5 text-[10px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border-subtle/40 flex items-center justify-between">
            <span>Linear Array (AR)</span>
            <span className="font-mono text-[9px] text-cyan-400">{arrayCount} Items</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-text-secondary block mb-0.5">Total Count:</span>
              <input
                type="number"
                min="2"
                max="20"
                value={arrayCount}
                onChange={(e) => setArrayCount(Math.max(2, parseInt(e.target.value) || 2))}
                className="w-full px-2 py-1 rounded bg-surface-canvas border border-border-subtle text-text-primary font-mono text-xs outline-none"
              />
            </div>
            <div>
              <span className="text-[10px] text-text-secondary block mb-0.5">Spacing (m):</span>
              <input
                type="number"
                step="0.5"
                value={arraySpacing}
                onChange={(e) => setArraySpacing(parseFloat(e.target.value) || 1.0)}
                className="w-full px-2 py-1 rounded bg-surface-canvas border border-border-subtle text-text-primary font-mono text-xs outline-none"
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-border-subtle/30">
            <span className="text-[10px] text-text-secondary">Direction:</span>
            <div className="flex rounded p-0.5 bg-surface-canvas border border-border-subtle/50">
              {(['x', 'y', 'z'] as const).map((ax) => (
                <button
                  key={ax}
                  onClick={() => setArrayAxis(ax)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase transition-colors ${
                    arrayAxis === ax ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {ax}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => {
              if (onArray) {
                const delta: [number, number, number] = [
                  arrayAxis === 'x' ? arraySpacing : 0,
                  arrayAxis === 'y' ? arraySpacing : 0,
                  arrayAxis === 'z' ? arraySpacing : 0
                ];
                onArray(expressId, arrayCount, delta);
                setActiveToolMenu(null);
              }
            }}
            className="w-full py-1.5 rounded bg-action-primary-bg hover:bg-cyan-400 text-action-primary-text text-[11px] font-semibold transition-colors shadow-sm text-center"
          >
            Create Linear Array
          </button>
        </div>
      )}

      {/* Align Tool Flyout */}
      {activeToolMenu === 'align' && (
        <div
          data-qa="selection-align-menu"
          className="absolute top-full mt-2 w-56 rounded-xl bg-surface-dock/95 backdrop-blur-2xl border border-border-subtle shadow-hud p-2.5 flex flex-col gap-2 text-xs text-text-primary animate-in fade-in-50 zoom-in-95"
        >
          <div className="px-1 py-0.5 text-[10px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border-subtle/40 flex items-center justify-between">
            <span>Align Element (AL)</span>
            <span className="font-mono text-[9px] text-cyan-400">Axis {alignAxis.toUpperCase()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-text-secondary">Align Axis:</span>
            <div className="flex rounded p-0.5 bg-surface-canvas border border-border-subtle/50">
              {(['z', 'x', 'y'] as const).map((ax) => (
                <button
                  key={ax}
                  onClick={() => setAlignAxis(ax)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase transition-colors ${
                    alignAxis === ax ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {ax}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="text-[10px] text-text-secondary block mb-0.5">Target Coordinate (m):</span>
            <input
              type="number"
              step="0.1"
              value={alignValue}
              onChange={(e) => setAlignValue(e.target.value)}
              className="w-full px-2 py-1 rounded bg-surface-canvas border border-border-subtle text-text-primary font-mono text-xs outline-none"
            />
          </div>
          <div className="flex gap-1 pt-1">
            <button
              onClick={() => setAlignValue('0.0')}
              className="px-2 py-0.5 rounded bg-surface-canvas hover:bg-surface-canvas/80 text-[10px] font-mono text-text-secondary"
            >
              Zero Ground
            </button>
            <button
              onClick={() => {
                if (onAlign) {
                  onAlign(expressId, alignAxis, parseFloat(alignValue) || 0);
                  setActiveToolMenu(null);
                }
              }}
              className="ml-auto px-3 py-1 rounded bg-action-primary-bg hover:bg-cyan-400 text-action-primary-text text-[11px] font-semibold transition-colors shadow-sm"
            >
              Apply Align
            </button>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
