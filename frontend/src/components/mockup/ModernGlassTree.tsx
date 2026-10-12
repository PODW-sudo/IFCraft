import React, { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Box,
  Layers,
  Folder,
  Building2,
  FileText,
  MoreHorizontal
} from 'lucide-react';
import { useResizable } from '../../hooks/useResizable';
import { ResizeHandle } from '../common/ResizeHandle';

export interface TreeSelection {
  category: string;
  count: number;
  expressId?: number;
}

interface ModernGlassTreeProps {
  selectedElement: string;
  onSelectElement: (category: string) => void;
  fileName?: string;
  onWidthChange?: (width: number, isCollapsed: boolean) => void;
}

export const ModernGlassTree: React.FC<ModernGlassTreeProps> = ({
  selectedElement,
  onSelectElement,
  fileName = 'Office_Building.ifc',
  onWidthChange
}) => {
  const [isBuildingOpen, setIsBuildingOpen] = useState(true);
  const [isSpacesOpen, setIsSpacesOpen] = useState(false);
  const [isElementsOpen, setIsElementsOpen] = useState(true);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  const { width, isDragging, startResizing, resetWidth } = useResizable({
    initialWidth: 290,
    minWidth: 220,
    maxWidth: 550,
    storageKey: 'modern_glass_tree_width',
    direction: 'right'
  });

  useEffect(() => {
    onWidthChange?.(width, isPanelCollapsed);
  }, [width, isPanelCollapsed, onWidthChange]);

  const buildingSubNodes = [
    { label: 'Site', count: 1 },
    { label: 'Building', count: 1 },
    { label: 'Storey', count: 6 },
  ];

  const elementTypes = [
    { label: 'Walls', count: 432 },
    { label: 'Floors', count: 178 },
    { label: 'Columns', count: 64 },
    { label: 'Beams', count: 92 },
    { label: 'Doors', count: 76 },
    { label: 'Windows', count: 64 },
  ];

  return (
    <aside
      style={{ width: isPanelCollapsed ? 64 : width }}
      className={`relative flex flex-col h-[calc(100vh-6rem)] bg-white/50 backdrop-blur-2xl rounded-3xl border border-white/60 shadow-2xl ${
        isDragging ? '' : 'transition-[width] duration-150'
      } overflow-hidden select-none z-20 ${
        isPanelCollapsed ? 'p-3' : 'p-4'
      }`}
      aria-label="Model Spatial Tree"
      data-qa="modern-glass-tree"
    >
      {/* Right-edge Resize Handle */}
      {!isPanelCollapsed && (
        <ResizeHandle
          onMouseDown={startResizing}
          onDoubleClick={resetWidth}
          isDragging={isDragging}
          position="right"
        />
      )}

      {/* 1. Header with Collapse Toggle */}
      <div className="flex items-center justify-between pb-2 border-b border-white/30">
        {!isPanelCollapsed && (
          <h2 className="text-sm font-semibold tracking-tight text-slate-800">
            Model
          </h2>
        )}
        <button
          type="button"
          onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white/40 transition-colors ml-auto cursor-pointer"
          title={isPanelCollapsed ? 'Expand Model Tree' : 'Collapse Model Tree'}
          aria-label={isPanelCollapsed ? 'Expand Model Tree' : 'Collapse Model Tree'}
        >
          {isPanelCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronUp className="w-4 h-4" />
          )}
        </button>
      </div>

      {!isPanelCollapsed && (
        <div className="flex-1 overflow-y-auto pr-1 mt-3 space-y-3">
          {/* 2. File Selector Pill Card */}
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white/50 backdrop-blur-md border border-white/70 shadow-sm hover:bg-white/60 transition-colors">
            <div className="flex items-center gap-2.5 truncate">
              <FileText className="w-4 h-4 text-slate-600 shrink-0" />
              <span className="text-xs font-semibold text-slate-800 truncate">
                {fileName}
              </span>
            </div>
            <MoreHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0 cursor-pointer hover:text-slate-700" />
          </div>

          {/* 3. Hierarchy Tree Structure */}
          <div className="space-y-1 text-xs">
            {/* Category: Building (1,248) */}
            <div>
              <div
                onClick={() => setIsBuildingOpen(!isBuildingOpen)}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-white/40 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isBuildingOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-slate-800">Building</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 font-semibold text-[10px]">
                  1,248
                </span>
              </div>

              {/* Subnodes with hierarchy guideline */}
              {isBuildingOpen && (
                <div className="pl-6 ml-3.5 border-l border-slate-300/70 space-y-1 my-1">
                  {buildingSubNodes.map((node) => (
                    <div
                      key={node.label}
                      className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-white/40 cursor-pointer text-slate-600 hover:text-slate-900 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <ChevronRight className="w-3 h-3 text-slate-400" />
                        <Box className="w-3.5 h-3.5 text-slate-500" />
                        <span>{node.label}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        {node.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Category: Spaces (342) */}
            <div>
              <div
                onClick={() => setIsSpacesOpen(!isSpacesOpen)}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-white/40 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isSpacesOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <Folder className="w-4 h-4 text-slate-600" />
                  <span className="font-medium text-slate-800">Spaces</span>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  342
                </span>
              </div>
            </div>

            {/* Category: Elements (906) */}
            <div>
              <div
                onClick={() => setIsElementsOpen(!isElementsOpen)}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-white/40 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isElementsOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-slate-800">Elements</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 font-semibold text-[10px]">
                  906
                </span>
              </div>

              {/* Sub elements */}
              {isElementsOpen && (
                <div className="pl-6 ml-3.5 border-l border-slate-300/70 space-y-1 my-1">
                  {elementTypes.map((elem) => {
                    const isSelected = selectedElement.toLowerCase().includes(elem.label.toLowerCase()) ||
                      (elem.label === 'Walls' && selectedElement === 'IfcWall');

                    return (
                      <div
                        key={elem.label}
                        onClick={() => onSelectElement(elem.label)}
                        className={`flex items-center justify-between py-1.5 px-2 rounded-xl cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-500/15 text-blue-700 font-medium shadow-xs border border-blue-400/30'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <ChevronRight className={`w-3 h-3 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                          <Box className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-600' : 'text-slate-500'}`} />
                          <span>{elem.label}</span>
                        </div>
                        <span className={`text-[11px] font-mono ${isSelected ? 'text-blue-600 font-semibold' : 'text-slate-400'}`}>
                          {elem.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
