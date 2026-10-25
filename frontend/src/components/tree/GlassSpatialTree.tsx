import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import {
  buildAncestorSet,
  collectMatchingIds,
  computeWindow,
  flattenVisibleTree,
  initialExpandedIds,
  keepRowInView,
  TREE_OVERSCAN,
  TREE_ROW_BUDGET,
  TREE_ROW_HEIGHT,
  type FlatTreeRow
} from '../../utils/spatialTreeIndex';

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
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(() => new Set<number>());
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(320);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Bounded initial expansion: root + the first-child path down to the first storey.
  // Expanding to depth 3 unconditionally made a large model start with thousands of rows.
  useEffect(() => {
    setExpandedNodes(initialExpandedIds(tree));
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

  // Measure the scroll body so the window can be derived from its real height.
  // `ResizeObserver` is feature-detected: the node test environment does not always have it.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setViewportHeight(el.clientHeight || 320);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isOpen, isPanelCollapsed]);

  // Two O(n) passes per keystroke (not one per rendered node), both memoised.
  const matchedIds = useMemo(() => collectMatchingIds(tree, searchTerm), [tree, searchTerm]);
  const ancestorsOfMatches = useMemo(
    () => (matchedIds && matchedIds.size ? buildAncestorSet(tree, matchedIds) : null),
    [tree, matchedIds]
  );
  const rows = useMemo(
    () =>
      flattenVisibleTree(tree, {
        expanded: expandedNodes,
        matchedIds,
        ancestorsOfMatches,
        maxRows: TREE_ROW_BUDGET
      }),
    [tree, expandedNodes, matchedIds, ancestorsOfMatches]
  );
  const treeWindow = computeWindow({
    scrollTop,
    viewportHeight,
    rowHeight: TREE_ROW_HEIGHT,
    totalRows: rows.length,
    overscan: TREE_OVERSCAN
  });

  // A new filter describes a different row set; reset the scroll position from the event
  // that caused it (an effect here would cascade an extra render per keystroke).
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setScrollTop(0);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  if (!isOpen) return null;

  const toggleExpand = (expressID: number, e: React.MouseEvent) => {
    e.stopPropagation();

    const next = new Set(expandedNodes);
    if (next.has(expressID)) {
      next.delete(expressID);
    } else {
      next.add(expressID);
    }
    setExpandedNodes(next);

    // Expanding/collapsing must not scroll the toggled node out of view. Its row index is
    // stable across its own toggle, but a collapse above the viewport is not, so re-derive
    // the index from the next row set and nudge `scrollTop` only when it left the window.
    const nextRows = flattenVisibleTree(tree, { expanded: next, matchedIds, ancestorsOfMatches });
    const index = nextRows.findIndex((row) => row.express_id === expressID);
    if (index < 0) return;
    const nextScrollTop = keepRowInView(scrollTop, index, viewportHeight, TREE_ROW_HEIGHT);
    if (nextScrollTop !== scrollTop) {
      setScrollTop(nextScrollTop);
      if (scrollRef.current) scrollRef.current.scrollTop = nextScrollTop;
    }
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

  // One windowed row. No recursion: the visible row set is pre-flattened by
  // `flattenVisibleTree`, so the DOM never holds more than the window's rows.
  const renderRow = (row: FlatTreeRow) => {
    const isExpanded = expandedNodes.has(row.express_id);
    const isSelected = selectedExpressID === row.express_id;
    const isIsolated = isolatedExpressID === row.express_id;

    return (
      <div
        key={`${row.type}-${row.express_id}`}
        onClick={() => onSelectElement(isSelected ? null : row.express_id)}
        className={`flex items-center justify-between px-2 rounded-xl text-xs transition-colors cursor-pointer group ${
          isSelected
            ? 'bg-blue-600 text-white font-medium shadow-xs'
            : 'hover:bg-white/60 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
        }`}
        style={{
          paddingLeft: `${Math.max(8, row.depth * 12)}px`,
          // Row height is a layout invariant: `computeWindow` assumes it exactly.
          height: TREE_ROW_HEIGHT,
          overflow: 'hidden'
        }}
      >
        <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
          {row.hasChildren ? (
            <button
              type="button"
              data-qa="tree-node-chevron"
              onClick={(e) => toggleExpand(row.express_id, e)}
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

          {getNodeIcon(row.type)}

          <span className="truncate" title={`${row.name} (${row.type})`}>
            {row.name || row.type}
          </span>

          {row.childCount > 0 && (
            <span className="text-[10px] opacity-60 font-mono ml-1">
              ({row.childCount})
            </span>
          )}
        </div>

        {/* Visibility / Isolate Toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleIsolate(row.express_id);
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
    );
  };

  return (
    <aside
      style={{ width: isPanelCollapsed ? 56 : width }}
      className={`relative flex flex-col h-[calc(100vh-5.5rem)] glass-panel bg-[var(--glass-surface-panel)] backdrop-blur-2xl rounded-3xl border border-[var(--glass-border)] shadow-2xl shadow-slate-900/10 ${
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
              onChange={handleSearchChange}
              placeholder="Filter hierarchy..."
              className="w-full pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 glass-card bg-[var(--glass-surface-card)] rounded-xl border border-[var(--glass-border)] outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>

          {/* Tree Scroll Body - windowed; the spacers keep scrollHeight === rows * TREE_ROW_HEIGHT */}
          <div
            ref={scrollRef}
            data-qa="tree-scroll-body"
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
            className="flex-1 overflow-y-auto pr-1 scrollbar-thin"
          >
            {tree ? (
              <>
                <div style={{ height: treeWindow.topPadding }} aria-hidden="true" />
                {rows.slice(treeWindow.start, treeWindow.end).map(renderRow)}
                <div style={{ height: treeWindow.bottomPadding }} aria-hidden="true" />
              </>
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
