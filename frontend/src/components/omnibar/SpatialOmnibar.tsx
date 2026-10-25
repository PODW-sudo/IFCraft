import React, { useState, useEffect, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Search,
  Box,
  Layers,
  Building2,
  Ruler,
  Scissors,
  Download,
  Sparkles,
  Command,
  Palette,
  Grid3x3,
  LayoutGrid
} from 'lucide-react';
import type { GeometryData, SpatialNode } from '../../types/ifc';
import { type UiStyleMode } from '../../types/settings';
import { resolveOmnibarShortcut } from '../../utils/omnibarShortcut';
import {
  MAX_VISIBLE_RESULTS,
  buildOmnibarItems,
  filterOmnibarItems,
  type OmnibarItem
} from '../../services/omnibarIndex';

interface SpatialOmnibarProps {
  isOpen: boolean;
  onClose: () => void;
  /** Opens the palette for the `Ctrl+K` / `Cmd+K` chord (STEP-11). */
  onOpen: () => void;
  geometries: GeometryData[];
  spatialTree: SpatialNode | null;
  onSelectElement: (expressID: number) => void;
  onTriggerTool: (toolId: string) => void;
  onUpdateUiStyleMode?: (mode: UiStyleMode) => void;
}

/** Registry `iconKey` -> lucide element. Keeps `services/omnibarIndex.ts` free of JSX. */
const ICONS: Record<string, React.ReactNode> = {
  measure: <Ruler className="w-4 h-4 text-emerald-400" aria-hidden="true" />,
  section: <Scissors className="w-4 h-4 text-rose-400" aria-hidden="true" />,
  grid: <Grid3x3 className="w-4 h-4 text-cyan-400" aria-hidden="true" />,
  sheets: <LayoutGrid className="w-4 h-4 text-blue-400" aria-hidden="true" />,
  copilot: <Sparkles className="w-4 h-4 text-cyan-400" aria-hidden="true" />,
  export: <Download className="w-4 h-4 text-slate-300" aria-hidden="true" />,
  storey: <Layers className="w-4 h-4 text-purple-400" aria-hidden="true" />,
  spatial: <Building2 className="w-4 h-4 text-amber-400" aria-hidden="true" />,
  element: <Box className="w-4 h-4 text-cyan-400" aria-hidden="true" />,
  style: <Palette className="w-4 h-4 text-sky-400" aria-hidden="true" />
};

export const SpatialOmnibar: React.FC<SpatialOmnibarProps> = ({
  isOpen,
  onClose,
  onOpen,
  geometries,
  spatialTree,
  onSelectElement,
  onTriggerTool,
  onUpdateUiStyleMode
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Global Ctrl+K / Cmd+K listener. The chord is resolved by a pure helper so the browser
  // only loses the keypress when the palette actually reacts to it (STEP-11 / F-008).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const action = resolveOmnibarShortcut(e, isOpen);
      if (action === 'ignore') return;
      e.preventDefault();
      if (action === 'open') {
        onOpen();
      } else {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onOpen]);

  // Flatten spatial tree nodes
  const spatialNodes = useMemo(() => {
    const nodes: Array<{ express_id: number; name: string; type: string }> = [];
    const traverse = (node: SpatialNode | null) => {
      if (!node) return;
      nodes.push({ express_id: node.express_id, name: node.name, type: node.type });
      node.children?.forEach(traverse);
    };
    traverse(spatialTree);
    return nodes;
  }, [spatialTree]);

  // STEP-28: the whole model is indexed (no `slice(0, 50)`); see services/omnibarIndex.ts.
  const items: OmnibarItem[] = useMemo(
    () =>
      buildOmnibarItems({
        geometries,
        spatialNodes,
        callbacks: { onSelectElement, onTriggerTool, onUpdateUiStyleMode }
      }),
    [geometries, spatialNodes, onSelectElement, onTriggerTool, onUpdateUiStyleMode]
  );

  // Filtering returns every match; the cap below is visible and labelled.
  const filtered = useMemo(() => filterOmnibarItems(items, query), [items, query]);
  const visible = useMemo(() => filtered.slice(0, MAX_VISIBLE_RESULTS), [filtered]);
  const overflowCount = Math.max(0, filtered.length - MAX_VISIBLE_RESULTS);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, visible.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + visible.length) % Math.max(1, visible.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = visible[selectedIndex];
      if (item) {
        item.action();
        onClose();
      }
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in-50" />
        <Dialog.Content
          data-qa="omnibar-dialog"
          className="fixed top-24 left-1/2 -translate-x-1/2 w-full max-w-lg bg-[var(--dock-bg)] border border-[var(--border-subtle)] rounded-2xl shadow-[var(--shadow-hud)] p-2 z-50 text-[var(--text-primary)] outline-none animate-in fade-in-70 zoom-in-95"
        >
          {/* Search Input Bar */}
          <div className="flex items-center gap-3 px-3 py-2.5 border-b border-[var(--border-subtle)]">
            <Search className="w-4 h-4 text-cyan-400" />
            <input
              data-qa="omnibar-input"
              type="text"
              autoFocus
              placeholder="Search elements (#124), storeys, tools, or UI styles (Cyber-BIM, VisionOS, Bento)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none"
            />
            <div className="flex items-center gap-1 font-mono text-[10px] text-[var(--text-secondary)] px-1.5 py-0.5 rounded bg-[var(--control-bg)] border border-[var(--border-subtle)]">
              <Command className="w-3 h-3" />
              <span>ESC</span>
            </div>
          </div>

          {/* Results List */}
          <div className="max-h-80 overflow-y-auto p-1.5 space-y-0.5">
            {visible.length > 0 ? (
              visible.map((item, idx) => (
                <div
                  key={item.id}
                  data-qa="omnibar-item"
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                    idx === selectedIndex
                      ? 'bg-cyan-500/15 text-white border border-cyan-500/30'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--control-hover)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="p-1 rounded-md bg-[var(--control-bg)] border border-[var(--border-subtle)]">
                      {ICONS[item.iconKey]}
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-medium text-[var(--text-primary)]">{item.title}</div>
                      <div className="text-[10px] text-[var(--text-secondary)] font-mono truncate">{item.subtitle}</div>
                    </div>
                  </div>

                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-[var(--control-bg)] text-[var(--text-secondary)] font-mono border border-[var(--border-subtle)]">
                    {item.category}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-[var(--text-secondary)]">
                No matching elements or tools found.
              </div>
            )}
          </div>

          {/* STEP-28: a labelled cap instead of a silent truncation (spec 7.3) */}
          {overflowCount > 0 && (
            <div
              data-qa="omnibar-overflow"
              className="mx-1.5 mb-0.5 px-3 py-1.5 rounded-lg bg-[var(--control-bg)] border border-[var(--border-subtle)] text-center text-[10px] font-mono text-[var(--text-secondary)]"
            >
              +{overflowCount} more — keep typing
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default SpatialOmnibar;
