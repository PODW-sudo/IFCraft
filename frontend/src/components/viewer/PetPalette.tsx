import React, { useState, useEffect, useRef } from 'react';
import {
  Move,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  ArrowUpDown,
  Grid3x3,
  Copy,
  Trash2,
  Focus,
  Pin,
  PinOff,
  ChevronDown,
  ChevronUp,
  Settings2,
  Building,
  Columns,
  DoorOpen,
  AppWindow,
  Box,
  Layers,
  Palette,
  Check
} from 'lucide-react';
import type { ElementDetails } from '../../types/ifc';
import type { InteractiveEditMode } from '../../types/cadEditing';

export interface PetPaletteProps {
  expressId: number | null;
  elementDetails: ElementDetails | null;
  screenPosition: { x: number; y: number } | null;
  activeTool: InteractiveEditMode;
  isPinned?: boolean;
  storeys?: { id: number; name: string; elevation: number }[];
  onStartMove: () => void;
  onStartRotate: () => void;
  onQuickRotate: (clockwise: boolean) => void;
  onStartMirror: () => void;
  onStartElevate: () => void;
  onStartMultiply: () => void;
  onOpenSpecialModal: () => void;
  onClone: (expressId: number) => void;
  onDelete: (expressId: number) => void;
  onTogglePin: (expressId: number) => void;
  onFocus: (expressId: number) => void;
  onOpenInspector: () => void;
  onUpdateGeometry?: (expressId: number, params: { height?: number; thickness?: number; elevation?: number }) => void;
  onAssignStorey?: (expressId: number, storeyId: number) => void;
  onAssignMaterial?: (expressId: number, materialName: string, colorHex?: string) => void;
}

const ARCHITECTURAL_MATERIALS = [
  { name: 'Concrete', bgClass: 'bg-slate-400', colorName: 'slate-400' },
  { name: 'Red Brick', bgClass: 'bg-rose-700', colorName: 'rose-700' },
  { name: 'Timber Wood', bgClass: 'bg-amber-600', colorName: 'amber-600' },
  { name: 'Clear Glass', bgClass: 'bg-cyan-400', colorName: 'cyan-400' },
  { name: 'Structural Steel', bgClass: 'bg-slate-600', colorName: 'slate-600' },
  { name: 'White Plaster', bgClass: 'bg-slate-100', colorName: 'slate-100' },
];

export const PetPalette: React.FC<PetPaletteProps> = ({
  expressId,
  elementDetails,
  screenPosition,
  activeTool,
  isPinned = false,
  storeys = [],
  onStartMove,
  onStartRotate,
  onQuickRotate,
  onStartMirror,
  onStartElevate,
  onStartMultiply,
  onOpenSpecialModal,
  onClone,
  onDelete,
  onTogglePin,
  onFocus,
  onOpenInspector,
  onUpdateGeometry,
  onAssignStorey,
  onAssignMaterial,
}) => {
  const [isExtended, setIsExtended] = useState(false);
  const [showStoreyMenu, setShowStoreyMenu] = useState(false);
  const [showMaterialMenu, setShowMaterialMenu] = useState(false);
  const [editingParam, setEditingParam] = useState<'height' | 'thickness' | 'elevation' | null>(null);
  const [tempValue, setTempValue] = useState<string>('');

  const paletteRef = useRef<HTMLDivElement>(null);

  // Close submenus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        setShowStoreyMenu(false);
        setShowMaterialMenu(false);
        setEditingParam(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut cycle (P / Shift+P) like Archicad
  useEffect(() => {
    if (!expressId) return;

    const handleKeyCycle = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        const toolList = [
          { mode: 'move' as const, trigger: onStartMove },
          { mode: 'rotate' as const, trigger: onStartRotate },
          { mode: 'mirror' as const, trigger: onStartMirror },
          { mode: 'elevate' as const, trigger: onStartElevate },
          { mode: 'multiply' as const, trigger: onStartMultiply },
        ];
        const curIdx = toolList.findIndex((t) => t.mode === activeTool);
        const count = toolList.length;
        const nextIdx = e.shiftKey
          ? (curIdx <= 0 ? count - 1 : curIdx - 1)
          : (curIdx + 1) % count;
        toolList[nextIdx].trigger();
      }
    };

    window.addEventListener('keydown', handleKeyCycle);
    return () => window.removeEventListener('keydown', handleKeyCycle);
  }, [expressId, activeTool, onStartMove, onStartRotate, onStartMirror, onStartElevate, onStartMultiply]);

  if (!expressId || !screenPosition) return null;

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
    if (!isNaN(num) && num > 0 && onUpdateGeometry) {
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
        return <Building size={12} className="text-cyan-400" />;
      case 'IfcColumn':
        return <Columns size={12} className="text-cyan-400" />;
      case 'IfcDoor':
        return <DoorOpen size={12} className="text-cyan-400" />;
      case 'IfcWindow':
        return <AppWindow size={12} className="text-cyan-400" />;
      default:
        return <Box size={12} className="text-cyan-400" />;
    }
  };

  // Clamp screen coordinates so pet palette stays inside viewport
  const paletteWidth = isExtended ? 440 : 160;
  const posX = Math.max(16, Math.min(window.innerWidth - paletteWidth - 20, screenPosition.x - paletteWidth / 2));
  const posY = Math.max(70, Math.min(window.innerHeight - (isExtended ? 140 : 60), screenPosition.y - 42));

  return (
    <div
      ref={paletteRef}
      data-qa="selection-context-overlay"
      data-selected-express-id={expressId}
      style={{ left: `${posX}px`, top: `${posY}px` }}
      className="fixed z-40 pointer-events-auto select-none flex flex-col items-center animate-in fade-in-50 zoom-in-95 duration-150"
    >
      {!isExtended ? (
        /* Minimal In-Canvas Capsule (Default collapsed state < 180px) */
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-dock/95 backdrop-blur-2xl border border-border-subtle shadow-dock text-text-primary text-xs">
          {/* Entity Identification Badge */}
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-canvas/60 border border-border-subtle/60 text-text-primary font-medium"
            title={`${entityType} #${expressId}`}
          >
            {getEntityIcon(entityType)}
            <span className="font-semibold text-[11px] truncate max-w-[80px]">
              {entityName}
            </span>
            <span className="text-[10px] font-mono text-text-secondary opacity-70">
              #{expressId}
            </span>
          </div>

          {/* Pinned Badge */}
          {isPinned && (
            <div
              className="flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-medium text-[10px]"
              title="Element is pinned"
            >
              <Pin size={10} className="text-amber-400" />
            </div>
          )}

          {/* Pin Button */}
          <button
            data-qa="selection-pin-btn"
            onClick={() => onTogglePin(expressId)}
            className={`p-1 rounded-full transition-colors ${
              isPinned
                ? 'text-amber-300 bg-amber-500/20 border border-amber-500/40'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60'
            }`}
            title={isPinned ? 'Unpin element (UP)' : 'Pin element (PN)'}
          >
            {isPinned ? <PinOff size={11} /> : <Pin size={11} />}
          </button>

          {/* Focus Button */}
          <button
            data-qa="selection-focus-btn"
            onClick={() => onFocus(expressId)}
            className="p-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60 transition-colors"
            title="Focus camera (F)"
          >
            <Focus size={11} />
          </button>

          {/* Extend Toggle */}
          <button
            data-qa="selection-extend-btn"
            onClick={() => setIsExtended(true)}
            className="p-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60 transition-colors"
            title="Extend editing tools & specs"
          >
            <ChevronDown size={11} />
          </button>
        </div>
      ) : (
        /* Extended Pet Palette State */
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-surface-dock/95 backdrop-blur-2xl border border-cyan-500/40 shadow-dock text-text-primary text-xs">
          {/* Entity Badge */}
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-canvas/60 border border-border-subtle/60 text-text-primary font-medium"
            title={`${entityType} #${expressId}`}
          >
            {getEntityIcon(entityType)}
            <span className="font-semibold text-[11px] truncate max-w-[80px]">
              {entityName}
            </span>
            <span className="text-[10px] font-mono text-text-secondary opacity-70">
              #{expressId}
            </span>
          </div>

          <div className="h-4 w-px bg-border-subtle/60 mx-0.5" />

          {/* Pet Palette Tools */}
          <div className="flex items-center gap-0.5" role="toolbar" aria-label="Pet Palette Tools">
            {/* Move */}
            <button
              data-qa="pet-move-btn"
              disabled={isPinned}
              onClick={onStartMove}
              className={`p-1.5 rounded-full transition-all ${
                activeTool === 'move'
                  ? 'bg-cyan-500 text-slate-950 ring-2 ring-cyan-400 shadow-md font-bold'
                  : isPinned
                  ? 'opacity-40 cursor-not-allowed text-text-secondary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60'
              }`}
              title="Move / Drag (M / Ctrl+D) - Pick origin then destination"
            >
              <Move size={13} />
            </button>

            {/* Rotate */}
            <button
              data-qa="pet-rotate-btn"
              disabled={isPinned}
              onClick={onStartRotate}
              className={`p-1.5 rounded-full transition-all ${
                activeTool === 'rotate'
                  ? 'bg-cyan-500 text-slate-950 ring-2 ring-cyan-400 shadow-md font-bold'
                  : isPinned
                  ? 'opacity-40 cursor-not-allowed text-text-secondary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60'
              }`}
              title="Rotate (R / Ctrl+E) - Pick center, baseline ray, then target angle"
            >
              <RotateCw size={13} />
            </button>

            {/* Quick Rotate 90 CCW */}
            <button
              data-qa="pet-quick-rotate-btn"
              disabled={isPinned}
              onClick={() => onQuickRotate(false)}
              className={`p-1.5 rounded-full transition-all ${
                isPinned
                  ? 'opacity-40 cursor-not-allowed text-text-secondary'
                  : 'text-text-secondary hover:text-cyan-400 hover:bg-surface-canvas/60'
              }`}
              title="Quick Rotate 90° CCW (Ctrl+R)"
            >
              <RotateCcw size={12} />
            </button>

            {/* Mirror */}
            <button
              data-qa="pet-mirror-btn"
              disabled={isPinned}
              onClick={onStartMirror}
              className={`p-1.5 rounded-full transition-all ${
                activeTool === 'mirror'
                  ? 'bg-cyan-500 text-slate-950 ring-2 ring-cyan-400 shadow-md font-bold'
                  : isPinned
                  ? 'opacity-40 cursor-not-allowed text-text-secondary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60'
              }`}
              title="Mirror (Ctrl+M) - Define 2-point reflection axis line"
            >
              <FlipHorizontal size={13} />
            </button>

            {/* Elevate */}
            <button
              data-qa="pet-elevate-btn"
              disabled={isPinned}
              onClick={onStartElevate}
              className={`p-1.5 rounded-full transition-all ${
                activeTool === 'elevate'
                  ? 'bg-cyan-500 text-slate-950 ring-2 ring-cyan-400 shadow-md font-bold'
                  : isPinned
                  ? 'opacity-40 cursor-not-allowed text-text-secondary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60'
              }`}
              title="Elevate (E) - Vertical displacement along Z axis"
            >
              <ArrowUpDown size={13} />
            </button>

            {/* Multiply */}
            <button
              data-qa="pet-multiply-btn"
              disabled={isPinned}
              onClick={onStartMultiply}
              className={`p-1.5 rounded-full transition-all ${
                activeTool === 'multiply'
                  ? 'bg-cyan-500 text-slate-950 ring-2 ring-cyan-400 shadow-md font-bold'
                  : isPinned
                  ? 'opacity-40 cursor-not-allowed text-text-secondary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60'
              }`}
              title="Multiply / Linear Array (Ctrl+U)"
            >
              <Grid3x3 size={13} />
            </button>

            {/* Tekla Special */}
            <button
              data-qa="pet-special-btn"
              onClick={onOpenSpecialModal}
              className="p-1.5 rounded-full text-text-secondary hover:text-cyan-400 hover:bg-surface-canvas/60 transition-colors"
              title="Move / Copy Special dialog"
            >
              <Settings2 size={13} />
            </button>
          </div>

          <div className="h-4 w-px bg-border-subtle/60 mx-0.5" />

          {/* Pin Button */}
          <button
            data-qa="selection-pin-btn"
            onClick={() => onTogglePin(expressId)}
            className={`p-1.5 rounded-full transition-colors ${
              isPinned
                ? 'text-amber-300 bg-amber-500/20 border border-amber-500/40'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60'
            }`}
            title={isPinned ? 'Unpin element (UP)' : 'Pin element (PN)'}
          >
            {isPinned ? <PinOff size={12} /> : <Pin size={12} />}
          </button>

          {/* Focus Button */}
          <button
            data-qa="selection-focus-btn"
            onClick={() => onFocus(expressId)}
            className="p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60 transition-colors"
            title="Focus camera (F)"
          >
            <Focus size={12} />
          </button>

          {/* Clone in place */}
          <button
            data-qa="selection-clone-btn"
            onClick={() => onClone(expressId)}
            className="p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60 transition-colors"
            title="Duplicate in place (CO)"
          >
            <Copy size={12} />
          </button>

          {/* Delete Button */}
          <button
            data-qa="selection-delete-btn"
            disabled={isPinned}
            onClick={() => onDelete(expressId)}
            className={`p-1.5 rounded-full transition-colors ${
              isPinned
                ? 'opacity-40 cursor-not-allowed text-text-secondary'
                : 'text-text-secondary hover:text-rose-400 hover:bg-rose-500/10'
            }`}
            title={isPinned ? 'Element pinned (UP to unpin)' : 'Delete element (Del)'}
          >
            <Trash2 size={12} />
          </button>

          {/* Collapse Button */}
          <button
            data-qa="selection-collapse-btn"
            onClick={() => setIsExtended(false)}
            className="p-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60 transition-colors ml-0.5"
            title="Collapse in-canvas controls"
          >
            <ChevronUp size={12} />
          </button>
        </div>
      )}

      {/* Extended Tray: Dimensions, Storey, Material */}
      {isExtended && (
        <div className="mt-1 flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-dock/90 backdrop-blur-xl border border-border-subtle/80 shadow-dock text-text-primary text-[11px] animate-in fade-in-50 duration-100">
          {/* Height Badge */}
          {editingParam === 'height' ? (
            <div className="flex items-center gap-1 bg-surface-canvas rounded px-1.5 py-0.5 border border-cyan-500/50">
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
              className="px-1.5 py-0.5 rounded text-[10px] font-mono hover:bg-surface-canvas/50 text-text-secondary hover:text-text-primary flex items-center gap-1"
            >
              <span className="opacity-60">H:</span>
              <span className="font-semibold text-text-primary tabular-nums">{heightVal.toFixed(2)}m</span>
            </button>
          )}

          {/* Thickness Badge */}
          {(entityType.includes('Wall') || entityType.includes('Slab')) && (
            editingParam === 'thickness' ? (
              <div className="flex items-center gap-1 bg-surface-canvas rounded px-1.5 py-0.5 border border-cyan-500/50">
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
                className="px-1.5 py-0.5 rounded text-[10px] font-mono hover:bg-surface-canvas/50 text-text-secondary hover:text-text-primary flex items-center gap-1"
              >
                <span className="opacity-60">T:</span>
                <span className="font-semibold text-text-primary tabular-nums">{thicknessVal.toFixed(2)}m</span>
              </button>
            )
          )}

          {/* Elevation Badge */}
          {editingParam === 'elevation' ? (
            <div className="flex items-center gap-1 bg-surface-canvas rounded px-1.5 py-0.5 border border-cyan-500/50">
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
              className="px-1.5 py-0.5 rounded text-[10px] font-mono hover:bg-surface-canvas/50 text-text-secondary hover:text-text-primary flex items-center gap-1"
            >
              <span className="opacity-60">El:</span>
              <span className="font-semibold text-text-primary tabular-nums">+{elevationVal.toFixed(2)}m</span>
            </button>
          )}

          <div className="h-3 w-px bg-border-subtle/60 mx-0.5" />

          {/* Storey Menu Trigger */}
          <div className="relative">
            <button
              onClick={() => {
                setShowStoreyMenu(!showStoreyMenu);
                setShowMaterialMenu(false);
              }}
              className="px-1.5 py-0.5 rounded text-[10px] text-text-secondary hover:text-text-primary hover:bg-surface-canvas/50 flex items-center gap-1"
              title="Assign Storey"
            >
              <Layers size={10} className="text-cyan-400" />
              <span>Storey</span>
            </button>
            {showStoreyMenu && storeys.length > 0 && (
              <div className="absolute left-0 bottom-full mb-1 w-36 bg-surface-dock/95 border border-border-subtle rounded-lg shadow-xl p-1 z-50 flex flex-col gap-0.5">
                {storeys.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => {
                      if (onAssignStorey) onAssignStorey(expressId, st.id);
                      setShowStoreyMenu(false);
                    }}
                    className="text-left px-2 py-1 rounded text-[10px] text-text-secondary hover:text-text-primary hover:bg-surface-canvas"
                  >
                    {st.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Material Menu Trigger */}
          <div className="relative">
            <button
              onClick={() => {
                setShowMaterialMenu(!showMaterialMenu);
                setShowStoreyMenu(false);
              }}
              className="px-1.5 py-0.5 rounded text-[10px] text-text-secondary hover:text-text-primary hover:bg-surface-canvas/50 flex items-center gap-1"
              title="Assign Material"
            >
              <Palette size={10} className="text-cyan-400" />
              <span>Material</span>
            </button>
            {showMaterialMenu && (
              <div className="absolute left-0 bottom-full mb-1 w-40 bg-surface-dock/95 border border-border-subtle rounded-lg shadow-xl p-1 z-50 grid grid-cols-2 gap-1">
                {ARCHITECTURAL_MATERIALS.map((mat) => (
                  <button
                    key={mat.name}
                    onClick={() => {
                      if (onAssignMaterial) onAssignMaterial(expressId, mat.name);
                      setShowMaterialMenu(false);
                    }}
                    className="flex items-center gap-1.5 px-1.5 py-1 rounded text-[10px] text-text-secondary hover:text-text-primary hover:bg-surface-canvas"
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${mat.bgClass}`} />
                    <span className="truncate">{mat.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Property Inspector trigger */}
          <button
            onClick={onOpenInspector}
            className="px-1.5 py-0.5 rounded text-[10px] text-cyan-400 hover:bg-cyan-500/10 font-semibold"
          >
            Props...
          </button>
        </div>
      )}
    </div>
  );
};
