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
  AppWindow
} from 'lucide-react';
import type { ElementDetails } from '../../types/ifc';

export interface SelectionContextOverlayProps {
  expressId: number | null;
  elementDetails: ElementDetails | null;
  screenPosition: { x: number; y: number } | null;
  storeys?: { id: number; name: string; elevation: number }[];
  onClone: (expressId: number) => void;
  onDelete: (expressId: number) => void;
  onUpdateGeometry: (expressId: number, params: { height?: number; thickness?: number; elevation?: number }) => void;
  onAssignStorey: (expressId: number, storeyId: number) => void;
  onAssignMaterial: (expressId: number, materialName: string, colorHex?: string) => void;
  onFocus: (expressId: number) => void;
  onOpenInspector: () => void;
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
  onClone,
  onDelete,
  onUpdateGeometry,
  onAssignStorey,
  onAssignMaterial,
  onFocus,
  onOpenInspector,
}) => {
  const [showStoreyMenu, setShowStoreyMenu] = useState(false);
  const [showMaterialMenu, setShowMaterialMenu] = useState(false);
  const [editingParam, setEditingParam] = useState<'height' | 'thickness' | 'elevation' | null>(null);
  const [tempValue, setTempValue] = useState<string>('');

  const overlayRef = useRef<HTMLDivElement>(null);

  // Close submenus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        setShowStoreyMenu(false);
        setShowMaterialMenu(false);
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
  const posX = Math.max(16, Math.min(window.innerWidth - 380, screenPosition.x - 180));
  const posY = Math.max(70, Math.min(window.innerHeight - 100, screenPosition.y - 48));

  return (
    <div
      ref={overlayRef}
      data-qa="selection-context-overlay"
      data-selected-express-id={expressId}
      style={{ left: `${posX}px`, top: `${posY}px` }}
      className="fixed z-40 pointer-events-auto select-none flex flex-col items-center animate-in fade-in-50 zoom-in-95 duration-150"
    >
      {/* Primary Floating Capsule */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-surface-dock/95 backdrop-blur-2xl border border-border-subtle shadow-dock text-text-primary text-xs">
        {/* Entity Identification Badge */}
        <div
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-canvas/60 border border-border-subtle/60 text-text-primary font-medium"
          title={`${entityType} #${expressId}`}
        >
          {getEntityIcon(entityType)}
          <span className="font-semibold text-[11px] truncate max-w-[110px]">
            {entityName}
          </span>
          <span className="text-[10px] font-mono text-text-secondary opacity-70">
            #{expressId}
          </span>
        </div>

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
                setEditingParam('height');
                setTempValue(heightVal.toFixed(2));
              }}
              className="px-1.5 py-0.5 rounded hover:bg-surface-canvas/50 text-[10px] font-mono text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1"
              title="Click to edit wall/element height"
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
                  setEditingParam('thickness');
                  setTempValue(thicknessVal.toFixed(2));
                }}
                className="px-1.5 py-0.5 rounded hover:bg-surface-canvas/50 text-[10px] font-mono text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1"
                title="Click to edit wall thickness"
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
                setEditingParam('elevation');
                setTempValue(elevationVal.toFixed(2));
              }}
              className="px-1.5 py-0.5 rounded hover:bg-surface-canvas/50 text-[10px] font-mono text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1"
              title="Click to edit element elevation"
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

          {/* Duplicate / Clone (Ctrl+D) */}
          <button
            data-qa="selection-clone-btn"
            onClick={() => onClone(expressId)}
            className="p-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-canvas/60 transition-colors"
            title="Duplicate element (Ctrl+D)"
          >
            <Copy size={13} />
          </button>

          {/* Assign Storey Trigger */}
          <button
            data-qa="selection-storey-btn"
            onClick={() => {
              setShowStoreyMenu(!showStoreyMenu);
              setShowMaterialMenu(false);
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
            onClick={() => onDelete(expressId)}
            className="p-1.5 rounded-full text-red-400 hover:text-red-300 hover:bg-red-500/15 transition-colors ml-0.5"
            title="Delete element from model (Delete)"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

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
    </div>
  );
};
