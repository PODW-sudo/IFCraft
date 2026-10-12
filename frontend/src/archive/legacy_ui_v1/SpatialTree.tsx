import React, { useState, useMemo, useEffect } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Building2,
  FolderTree,
  Layers,
  Box,
  Eye,
  EyeOff,
  Search
} from 'lucide-react';
import type { SpatialNode } from '../../types/ifc';
import { useResizable } from '../../hooks/useResizable';
import { ResizeHandle } from '../common/ResizeHandle';

interface SpatialTreeProps {
  tree: SpatialNode | null;
  selectedExpressID: number | null;
  onSelectElement: (expressID: number | null) => void;
  isolatedExpressID: number | null;
  onToggleIsolate: (expressID: number | null) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  onWidthChange?: (width: number) => void;
}

export const SpatialTree: React.FC<SpatialTreeProps> = ({
  tree,
  selectedExpressID,
  onSelectElement,
  isolatedExpressID,
  onToggleIsolate,
  isOpen,
  onToggleOpen,
  onWidthChange
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set([0]));

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
    maxWidth: 600,
    storageKey: 'ifc_editor_spatial_tree_width',
    direction: 'right'
  });

  useEffect(() => {
    if (onWidthChange && isOpen) {
      onWidthChange(width);
    }
  }, [width, isOpen, onWidthChange]);

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
        return <FolderTree className="w-3.5 h-3.5 text-cyan-400" />;
      case 'IfcSite':
        return <Building2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'IfcBuilding':
        return <Building2 className="w-3.5 h-3.5 text-amber-400" />;
      case 'IfcBuildingStorey':
        return <Layers className="w-3.5 h-3.5 text-purple-400" />;
      default:
        return <Box className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  // Filter node recursively
  const matchesSearch = useMemo(() => {
    if (!searchTerm.trim()) return () => true;
    const term = searchTerm.toLowerCase();
    return (node: SpatialNode): boolean => {
      if (node.name.toLowerCase().includes(term) || node.type.toLowerCase().includes(term) || String(node.express_id).includes(term)) {
        return true;
      }
      return node.children.some((child) => matchesSearch(child));
    };
  }, [searchTerm]);

  const renderNode = (node: SpatialNode, depth: number = 0) => {
    if (!matchesSearch(node)) return null;

    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.express_id) || Boolean(searchTerm);
    const isSelected = selectedExpressID === node.express_id;
    const isIsolated = isolatedExpressID === node.express_id;

    return (
      <div key={`${node.express_id}-${node.global_id}`} className="select-none text-xs">
        <div
          data-qa="tree-node"
          data-express-id={node.express_id}
          onClick={() => onSelectElement(node.express_id)}
          className={`group flex items-center gap-1.5 py-1 px-2 rounded cursor-pointer transition-colors ${
            isSelected
              ? 'bg-cyan-500/20 text-cyan-300 font-medium border border-cyan-500/30'
              : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
          }`}
          style={{ paddingLeft: `${Math.max(8, depth * 14)}px` }}
        >
          {hasChildren ? (
            <button
              data-qa="tree-node-chevron"
              onClick={(e) => toggleExpand(node.express_id, e)}
              className="p-0.5 text-slate-500 hover:text-slate-300 focus:outline-none"
            >
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          ) : (
            <span className="w-4" />
          )}

          {getNodeIcon(node.type)}

          <span className="truncate flex-1" title={`${node.name} (${node.type})`}>
            {node.name}
          </span>

          <span className="text-[10px] text-slate-500 opacity-60 font-mono hidden group-hover:inline">
            #{node.express_id}
          </span>

          {node.type !== 'IfcProject' && node.type !== 'IfcSite' && (
            <button
              data-qa="tree-node-isolate"
              onClick={(e) => {
                e.stopPropagation();
                onToggleIsolate(isIsolated ? null : node.express_id);
              }}
              className={`p-1 rounded text-slate-400 hover:text-white transition-opacity opacity-0 group-hover:opacity-100 ${
                isIsolated ? 'opacity-100 text-cyan-400' : ''
              }`}
              title={isIsolated ? 'Restore all' : 'Isolate element'}
            >
              {isIsolated ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </button>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className="border-l border-slate-800/80 ml-2.5">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      data-qa="spatial-tree-drawer"
      style={{ width: `${width}px` }}
      className="fixed left-4 top-16 bottom-6 z-20 flex flex-col bg-[var(--dock-translucent)] backdrop-blur-xl border border-[var(--border-subtle)] rounded-2xl shadow-[var(--shadow-hud)] text-slate-200 overflow-hidden transition-all duration-200 animate-in fade-in-50 slide-in-from-left-4"
    >
      <ResizeHandle
        position="right"
        onMouseDown={startResizing}
        onDoubleClick={resetWidth}
        isDragging={isDragging}
      />
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-[var(--border-subtle)] bg-[var(--control-bg)]/40">
        <div className="flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            Spatial Hierarchy
          </span>
        </div>
        <button
          data-qa="tree-collapse-btn"
          onClick={onToggleOpen}
          className="text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded hover:bg-[var(--control-hover)] transition-colors"
          title="Close Hierarchy Drawer"
        >
          &times;
        </button>
      </div>

      {/* Search Input */}
      <div className="p-2 border-b border-[var(--border-subtle)]">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-2 text-slate-400" />
          <input
            id="hierarchy-search-input"
            name="hierarchySearch"
            data-qa="tree-search-input"
            type="text"
            aria-label="Search hierarchy"
            placeholder="Search hierarchy (#124, Wall, Slab)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[var(--control-bg)] text-xs text-slate-200 pl-7 pr-2 py-1.5 rounded-lg border border-[var(--border-subtle)] focus:outline-none focus:border-cyan-400/50"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 text-slate-400 hover:text-white text-xs"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Hierarchy Tree List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {tree ? (
          renderNode(tree)
        ) : (
          <div className="text-center text-slate-500 text-xs py-8">
            No IFC model loaded.
          </div>
        )}
      </div>
    </div>
  );
};
