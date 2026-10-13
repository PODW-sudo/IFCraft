import React, { useState, useEffect } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Building2,
  FolderTree,
  Layers,
  Box,
  Eye,
  EyeOff,
  Search,
  ChevronLeft,
  X
} from 'lucide-react';
import type { SpatialNode } from '../../types/ifc';
import { useResizable } from '../../hooks/useResizable';
import { ResizeHandle } from '../common/ResizeHandle';

interface GlassSpatialTreeProps {
  tree: SpatialNode | null;
  selectedExpressID: number | null;
  onSelectElement: (expressID: number | null) => void;
  isolatedExpressID: number | null;
  onToggleIsolate: (expressID: number | null) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  onWidthChange?: (width: number, isCollapsed: boolean) => void;
  fileName?: string;
}

export const GlassSpatialTree: React.FC<GlassSpatialTreeProps> = ({
  tree,
  selectedExpressID,
  onSelectElement,
  isolatedExpressID,
  onToggleIsolate,
  isOpen,
  onToggleOpen,
  onWidthChange,
  fileName: _fileName = 'Project Model'
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set([0]));
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  useEffect(() => {
    if (!tree) return;
    const initialExpanded = new Set<number>();
    const collectStoreys = (node: SpatialNode, depth: number) => {
      initialExpanded.add(node.express_id);
      if (depth < 3 && node.children) {
        node.children.forEach((child) => collectStoreys(child, depth + 1));
      }
    };
    collectStoreys(tree, 0);
    setExpandedNodes(initialExpanded);
  }, [tree]);

  const { width, isDragging, startResizing, resetWidth } = useResizable({
    initialWidth: 288,
    minWidth: 220,
    maxWidth: 550,
    storageKey: 'ifc_editor_spatial_tree_width',
    direction: 'right'
  });

  useEffect(() => {
    if (onWidthChange && isOpen) {
      onWidthChange(width, isPanelCollapsed);
    }
  }, [width, isPanelCollapsed, isOpen, onWidthChange]);

  if (!isOpen) return null;

  const toggleExpand = (expressID: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(expressID)) {
        next.delete(expressID);
      } else {
        next.add(expressID);
      }
      return next;
    });
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'IfcProject':
        return <FolderTree className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />;
      case 'IfcSite':
        return <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
      case 'IfcBuilding':
        return <Building2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
      case 'IfcBuildingStorey':
        return <Layers className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />;
      default:
        return <Box className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />;
    }
  };

  const matchesSearch = (node: SpatialNode, term: string): boolean => {
    if (!term) return true;
    const lower = term.toLowerCase();
    if (node.name.toLowerCase().includes(lower) || node.type.toLowerCase().includes(lower) || node.express_id.toString().includes(lower)) {
      return true;
    }
    return Boolean(node.children && node.children.some((child) => matchesSearch(child, term)));
  };

  const renderNode = (node: SpatialNode, depth: number = 0) => {
    if (searchTerm.trim() && !matchesSearch(node, searchTerm.trim())) {
      return null;
    }

    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.express_id);
    const isSelected = selectedExpressID === node.express_id;
    const isIsolated = isolatedExpressID === node.express_id;

    return (
      <div key={`${node.type}-${node.express_id}`} className="flex flex-col select-none">
        <div
          onClick={() => onSelectElement(isSelected ? null : node.express_id)}
          className={`flex items-center justify-between py-1 px-2 rounded-xl text-xs transition-colors cursor-pointer group ${
            isSelected
              ? 'bg-blue-600 text-white font-medium shadow-xs'
              : 'hover:bg-white/60 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
          }`}
          style={{ paddingLeft: `${Math.max(8, depth * 12)}px` }}
        >
          <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
            {hasChildren ? (
              <button
                type="button"
                data-qa="tree-node-chevron"
                onClick={(e) => toggleExpand(node.express_id, e)}
                className={`p-0.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 ${
                  isSelected ? 'text-white' : 'text-slate-400'
                }`}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <span className="w-4 shrink-0" />
            )}

            {getNodeIcon(node.type)}

            <span className="truncate" title={`${node.name} (${node.type})`}>
              {node.name || node.type}
            </span>

            {node.children && node.children.length > 0 && (
              <span className="text-[10px] opacity-60 font-mono ml-1">
                ({node.children.length})
              </span>
            )}
          </div>

          {/* Visibility / Isolate Toggle */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleIsolate(node.express_id);
            }}
            className={`p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity ${
              isIsolated
                ? 'opacity-100 text-amber-500'
                : isSelected
                ? 'text-white hover:bg-white/20'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
            title={isIsolated ? 'Clear Isolation' : 'Isolate Element'}
          >
            {isIsolated ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>

        {hasChildren && isExpanded && (
          <div className="flex flex-col">
            {node.children!.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      style={{ width: isPanelCollapsed ? 56 : width }}
      className={`relative flex flex-col h-[calc(100vh-5.5rem)] bg-white/50 dark:bg-slate-900/60 backdrop-blur-2xl rounded-3xl border border-white/60 dark:border-white/10 shadow-2xl shadow-slate-900/10 ${
        isDragging ? '' : 'transition-[width] duration-150'
      } overflow-hidden select-none z-20 ${
        isPanelCollapsed ? 'p-2' : 'p-3.5'
      }`}
      aria-label="Spatial Hierarchy"
      data-qa="spatial-tree"
      data-qa-dock="glass-spatial-tree"
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

      {/* Header */}
      {isPanelCollapsed ? (
        <div className="flex flex-col items-center gap-1.5 pb-2 mb-2 border-b border-white/40 dark:border-white/10 shrink-0 w-full">
          <button
            type="button"
            data-qa="tree-uncollapse-btn"
            onClick={() => setIsPanelCollapsed(false)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
            title="Expand Tree"
            aria-label="Expand Tree"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            data-qa="tree-close-btn"
            data-qa-alias="tree-collapse-btn"
            onClick={onToggleOpen}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
            title="Close Tree Drawer"
            aria-label="Close Tree Drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/40 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-1.5">
            <FolderTree className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
            <h2 className="text-xs font-bold tracking-tight text-slate-800 dark:text-slate-100 uppercase">
              Spatial Tree
            </h2>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              data-qa="tree-toggle-collapse-btn"
              onClick={() => setIsPanelCollapsed(true)}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
              title="Collapse Panel"
              aria-label="Collapse Panel"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              data-qa="tree-close-btn"
              data-qa-alias="tree-collapse-btn"
              onClick={onToggleOpen}
              className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
              title="Close Tree Drawer"
              aria-label="Close Tree Drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {isPanelCollapsed && (
        <div
          onClick={() => setIsPanelCollapsed(false)}
          className="flex-1 flex flex-col items-center justify-center gap-3 cursor-pointer py-4 group"
          title="Click to expand Spatial Tree"
        >
          <div className="p-1.5 rounded-xl bg-blue-500/10 dark:bg-cyan-500/10 text-blue-600 dark:text-cyan-400 group-hover:scale-110 transition-transform">
            <FolderTree className="w-4 h-4" />
          </div>
          <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-bold tracking-widest text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors uppercase">
            Tree
          </span>
        </div>
      )}

      {!isPanelCollapsed && (
        <>
          {/* Search Input */}
          <div className="relative mb-2 shrink-0">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              data-qa="tree-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter hierarchy..."
              className="w-full pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 bg-white/50 dark:bg-slate-800/50 rounded-xl border border-white/60 dark:border-white/10 outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>

          {/* Tree Scroll Body */}
          <div className="flex-1 overflow-y-auto space-y-0.5 pr-1 scrollbar-thin">
            {tree ? (
              renderNode(tree)
            ) : (
              <div className="text-xs text-slate-400 text-center py-8">
                No model loaded
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
};
export default GlassSpatialTree;
