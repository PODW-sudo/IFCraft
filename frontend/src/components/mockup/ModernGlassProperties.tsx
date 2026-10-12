import React, { useState, useEffect } from 'react';
import { Box, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Copy, Check } from 'lucide-react';
import { useResizable } from '../../hooks/useResizable';
import { ResizeHandle } from '../common/ResizeHandle';

interface ElementPropertyData {
  ifcClass: string;
  badge: string;
  name: string;
  globalId: string;
  type: string;
  material: string;
  length: string;
  height: string;
  thickness: string;
  storey: string;
  elevation: string;
}

const ELEMENT_DATA_MAP: Record<string, ElementPropertyData> = {
  Walls: {
    ifcClass: 'IfcWall',
    badge: 'Wall',
    name: 'Basic Wall: Exterior - 300mm',
    globalId: '2r3fus00305628+6361-000d02f83',
    type: 'IfcWallType',
    material: 'Concrete',
    length: '12.450 m',
    height: '3.000 m',
    thickness: '0.300 m',
    storey: 'Storey 02',
    elevation: '6.000 m',
  },
  Floors: {
    ifcClass: 'IfcSlab',
    badge: 'Floor',
    name: 'Cast-in-Place Concrete Slab - 200mm',
    globalId: '1e4abd99120488+4819-000d09a12',
    type: 'IfcSlabType',
    material: 'Reinforced Concrete C30/37',
    length: '24.800 m',
    height: '0.200 m',
    thickness: '0.200 m',
    storey: 'Storey 02',
    elevation: '6.000 m',
  },
  Columns: {
    ifcClass: 'IfcColumn',
    badge: 'Column',
    name: 'Rectangular Concrete Column 400x400',
    globalId: '3m8bcd11492044+8829-000d01b44',
    type: 'IfcColumnType',
    material: 'Concrete C40/50',
    length: '0.400 m',
    height: '3.000 m',
    thickness: '0.400 m',
    storey: 'Storey 02',
    elevation: '6.000 m',
  },
  Beams: {
    ifcClass: 'IfcBeam',
    badge: 'Beam',
    name: 'IPE 400 Structural Steel Girder',
    globalId: '0p9ffe77281933+1192-000d05c21',
    type: 'IfcBeamType',
    material: 'Structural Steel S355',
    length: '8.200 m',
    height: '0.400 m',
    thickness: '0.180 m',
    storey: 'Storey 02',
    elevation: '9.000 m',
  },
  Doors: {
    ifcClass: 'IfcDoor',
    badge: 'Door',
    name: 'Single Flush Solid Timber Door 900x2100',
    globalId: '4k2aad66109284+3391-000d07e88',
    type: 'IfcDoorType',
    material: 'Solid Core Oak & Aluminum Frame',
    length: '0.900 m',
    height: '2.100 m',
    thickness: '0.045 m',
    storey: 'Storey 02',
    elevation: '6.000 m',
  },
  Windows: {
    ifcClass: 'IfcWindow',
    badge: 'Window',
    name: 'Triple-Glazed Aluminum Ribbon Window',
    globalId: '5l7bbd22901844+7721-000d08f99',
    type: 'IfcWindowType',
    material: 'Low-E Insulated Glass Unit',
    length: '3.600 m',
    height: '1.800 m',
    thickness: '0.090 m',
    storey: 'Storey 02',
    elevation: '6.900 m',
  },
};

interface ModernGlassPropertiesProps {
  selectedCategory?: string;
  onWidthChange?: (width: number, isCollapsed: boolean) => void;
}

export const ModernGlassProperties: React.FC<ModernGlassPropertiesProps> = ({
  selectedCategory = 'Walls',
  onWidthChange
}) => {
  const [isDimensionsOpen, setIsDimensionsOpen] = useState(true);
  const [isLocationOpen, setIsLocationOpen] = useState(true);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const { width, isDragging, startResizing, resetWidth } = useResizable({
    initialWidth: 340,
    minWidth: 260,
    maxWidth: 600,
    storageKey: 'modern_glass_properties_width',
    direction: 'left'
  });

  useEffect(() => {
    onWidthChange?.(width, isPanelCollapsed);
  }, [width, isPanelCollapsed, onWidthChange]);

  // Normalize category lookup
  const currentData = ELEMENT_DATA_MAP[selectedCategory] || ELEMENT_DATA_MAP.Walls;

  const handleCopyId = () => {
    navigator.clipboard.writeText(currentData.globalId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <aside
      style={{ width: isPanelCollapsed ? 64 : width }}
      className={`relative flex flex-col h-[calc(100vh-6rem)] bg-white/50 backdrop-blur-2xl rounded-3xl border border-white/60 shadow-2xl ${
        isDragging ? '' : 'transition-[width] duration-150'
      } overflow-y-auto select-none z-20 ${
        isPanelCollapsed ? 'p-3 items-center' : 'p-5'
      }`}
      aria-label="Element Properties Inspector"
      data-qa="modern-glass-properties"
    >
      {/* Left-edge Resize Handle */}
      {!isPanelCollapsed && (
        <ResizeHandle
          onMouseDown={startResizing}
          onDoubleClick={resetWidth}
          isDragging={isDragging}
          position="left"
        />
      )}

      {/* 1. Panel Header */}
      <div className="flex items-center justify-between pb-1 border-b border-white/30 w-full">
        {!isPanelCollapsed && (
          <h2 className="text-base font-semibold tracking-tight text-slate-900 truncate">
            Element Properties
          </h2>
        )}
        <button
          type="button"
          onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white/40 transition-colors ml-auto cursor-pointer"
          title={isPanelCollapsed ? 'Expand Properties Panel' : 'Collapse Properties Panel'}
          aria-label={isPanelCollapsed ? 'Expand Properties Panel' : 'Collapse Properties Panel'}
        >
          {isPanelCollapsed ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>

      {!isPanelCollapsed && (
        <>
          {/* 2. Overview Card */}
      <div className="rounded-2xl bg-white/50 backdrop-blur-md border border-white/70 p-4 shadow-sm mt-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Box className="w-6 h-6 text-slate-800" />
            <span className="text-base font-bold text-slate-900">
              {currentData.ifcClass}
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/15 text-blue-600 font-semibold text-xs">
            {currentData.badge}
          </span>
        </div>

        <div className="space-y-2 text-xs pt-1 border-t border-slate-200/60">
          <div className="flex items-start justify-between gap-2">
            <span className="text-slate-500">Name</span>
            <span className="text-slate-800 font-medium text-right truncate max-w-[180px]" title={currentData.name}>
              {currentData.name}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">GlobalId</span>
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600">
              <span className="truncate max-w-[150px]">{currentData.globalId.slice(0, 16)}...</span>
              <button
                type="button"
                onClick={handleCopyId}
                className="p-1 rounded hover:bg-white/60 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                title="Copy GlobalId"
                aria-label="Copy GlobalId"
              >
                {copiedId ? (
                  <Check className="w-3 h-3 text-green-600" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">Type</span>
            <span className="text-slate-800 font-medium font-mono text-[11px]">
              {currentData.type}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">Material</span>
            <span className="text-slate-800 font-medium">
              {currentData.material}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Collapsible Dimensions Section */}
      <div className="rounded-2xl bg-white/45 backdrop-blur-md border border-white/60 p-4 shadow-sm mt-3.5">
        <div
          onClick={() => setIsDimensionsOpen(!isDimensionsOpen)}
          className="flex items-center justify-between cursor-pointer select-none"
        >
          <h3 className="text-sm font-semibold tracking-tight text-slate-900">
            Dimensions
          </h3>
          <button
            type="button"
            className="p-1 rounded text-slate-500 hover:text-slate-800 transition-colors"
            aria-label={isDimensionsOpen ? 'Collapse Dimensions' : 'Expand Dimensions'}
          >
            {isDimensionsOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>

        {isDimensionsOpen && (
          <div className="space-y-2 text-xs pt-3 mt-1 border-t border-slate-200/60">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Length</span>
              <span className="font-mono tabular-nums text-slate-800 font-medium">
                {currentData.length}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">Height</span>
              <span className="font-mono tabular-nums text-slate-800 font-medium">
                {currentData.height}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">Thickness</span>
              <span className="font-mono tabular-nums text-slate-800 font-medium">
                {currentData.thickness}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 4. Collapsible Location Section */}
      <div className="rounded-2xl bg-white/45 backdrop-blur-md border border-white/60 p-4 shadow-sm mt-3.5">
        <div
          onClick={() => setIsLocationOpen(!isLocationOpen)}
          className="flex items-center justify-between cursor-pointer select-none"
        >
          <h3 className="text-sm font-semibold tracking-tight text-slate-900">
            Location
          </h3>
          <button
            type="button"
            className="p-1 rounded text-slate-500 hover:text-slate-800 transition-colors"
            aria-label={isLocationOpen ? 'Collapse Location' : 'Expand Location'}
          >
            {isLocationOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>

        {isLocationOpen && (
          <div className="space-y-2 text-xs pt-3 mt-1 border-t border-slate-200/60">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Building Storey</span>
              <span className="text-slate-800 font-medium">
                {currentData.storey}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">Elevation</span>
              <span className="font-mono tabular-nums text-slate-800 font-medium">
                {currentData.elevation}
              </span>
            </div>
          </div>
        )}
      </div>
        </>
      )}
    </aside>
  );
};
