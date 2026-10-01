import React, { useState, useMemo } from 'react';
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

interface SpatialTreeProps {
  tree: SpatialNode | null;
  selectedExpressID: number | null;
  onSelectElement: (expressID: number | null) => void;
  isolatedExpressID: number | null;
  onToggleIsolate: (expressID: number | null) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const SpatialTree: React.FC<SpatialTreeProps> = ({
  tree,
  selectedExpressID,
  onSelectElement,
  isolatedExpressID,
  onToggleIsolate,
  isOpen,
  onToggleOpen
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set([0]));

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
        return <FolderTree className="w-3.5 h-3.5 text-sky-400" />;
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
          onClick={() => onSelectElement(node.express_id)}
          className={`group flex items-center gap-1.5 py-1 px-2 rounded cursor-pointer transition-colors ${
            isSelected
              ? 'bg-sky-500/20 text-sky-300 font-medium border border-sky-500/30'
              : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
          }`}
          style={{ paddingLeft: `${Math.max(8, depth * 14)}px` }}
        >
          {hasChildren ? (
            <button
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
              onClick={(e) => {
                e.stopPropagation();
                onToggleIsolate(isIsolated ? null : node.express_id);
              }}
              className={`p-1 rounded text-slate-400 hover:text-white transition-opacity opacity-0 group-hover:opacity-100 ${
                isIsolated ? 'opacity-100 text-sky-400' : ''
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
    <div className="w-72 h-[calc(100vh-4rem)] flex flex-col bg-[#16191f]/90 backdrop-blur-md border-r border-[#262a33] text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#262a33]">
        <div className="flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            Spatial Tree
          </span>
        </div>
        <button
          onClick={onToggleOpen}
          className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-slate-800"
        >
          &times;
        </button>
      </div>

      {/* Search Input */}
      <div className="p-2 border-b border-[#262a33]">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-2 text-slate-400" />
          <input
            id="hierarchy-search-input"
            name="hierarchySearch"
            type="text"
            aria-label="Search hierarchy"
            placeholder="Search hierarchy..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0d0f12] text-xs text-slate-200 pl-7 pr-2 py-1.5 rounded border border-[#262a33] focus:outline-none focus:border-sky-500/50"
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
