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
  Command
} from 'lucide-react';
import type { GeometryData, SpatialNode } from '../../types/ifc';

interface SpatialOmnibarProps {
  isOpen: boolean;
  onClose: () => void;
  geometries: GeometryData[];
  spatialTree: SpatialNode | null;
  onSelectElement: (expressID: number) => void;
  onTriggerTool: (toolId: string) => void;
}

interface OmnibarItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'element' | 'spatial' | 'tool';
  icon: React.ReactNode;
  action: () => void;
}

export const SpatialOmnibar: React.FC<SpatialOmnibarProps> = ({
  isOpen,
  onClose,
  geometries,
  spatialTree,
  onSelectElement,
  onTriggerTool
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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

  // Construct items index
  const items: OmnibarItem[] = useMemo(() => {
    const list: OmnibarItem[] = [];

    // Tools
    list.push(
      {
        id: 'tool-measure',
        title: 'Measure Tool',
        subtitle: 'Point-to-point 3D laser measurement',
        category: 'tool',
        icon: <Ruler className="w-4 h-4 text-emerald-400" />,
        action: () => onTriggerTool('measure')
      },
      {
        id: 'tool-section',
        title: 'Section Cut',
        subtitle: 'Toggle orthogonal clipping plane (X/Y/Z)',
        category: 'tool',
        icon: <Scissors className="w-4 h-4 text-rose-400" />,
        action: () => onTriggerTool('section')
      },
      {
        id: 'tool-copilot',
        title: 'AI BIM Copilot',
        subtitle: 'Natural language building queries & edits',
        category: 'tool',
        icon: <Sparkles className="w-4 h-4 text-cyan-400" />,
        action: () => onTriggerTool('copilot')
      },
      {
        id: 'tool-export',
        title: 'Export IFC Model',
        subtitle: 'Download updated .ifc geometry and attributes',
        category: 'tool',
        icon: <Download className="w-4 h-4 text-slate-300" />,
        action: () => onTriggerTool('export')
      }
    );

    // Spatial hierarchy nodes
    spatialNodes.forEach((node) => {
      list.push({
        id: `spatial-${node.express_id}`,
        title: node.name || node.type,
        subtitle: `Spatial Container (${node.type}) #${node.express_id}`,
        category: 'spatial',
        icon: node.type.includes('Storey') ? (
          <Layers className="w-4 h-4 text-purple-400" />
        ) : (
          <Building2 className="w-4 h-4 text-amber-400" />
        ),
        action: () => onSelectElement(node.express_id)
      });
    });

    // 3D Geometry elements
    geometries.slice(0, 50).forEach((geom) => {
      list.push({
        id: `element-${geom.expressID}`,
        title: `Element #${geom.expressID}`,
        subtitle: `${geom.type} | Category Geometry`,
        category: 'element',
        icon: <Box className="w-4 h-4 text-cyan-400" />,
        action: () => onSelectElement(geom.expressID)
      });
    });

    return list;
  }, [geometries, spatialNodes, onSelectElement, onTriggerTool]);

  // Filter items based on user query
  const filtered = useMemo(() => {
    if (!query.trim()) return items.slice(0, 15);
    const q = query.toLowerCase();
    return items
      .filter((item) => item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q))
      .slice(0, 15);
  }, [items, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[selectedIndex];
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
        <Dialog.Content className="fixed top-24 left-1/2 -translate-x-1/2 w-full max-w-lg bg-[var(--dock-bg)] border border-[var(--border-subtle)] rounded-2xl shadow-[var(--shadow-hud)] p-2 z-50 text-slate-200 outline-none animate-in fade-in-70 zoom-in-95">
          {/* Search Input Bar */}
          <div className="flex items-center gap-3 px-3 py-2.5 border-b border-[var(--border-subtle)]">
            <Search className="w-4 h-4 text-cyan-400" />
            <input
              type="text"
              autoFocus
              placeholder="Search elements (#124, IfcWall), storeys, or tools..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
            />
            <div className="flex items-center gap-1 font-mono text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-[var(--control-bg)] border border-[var(--border-subtle)]">
              <Command className="w-3 h-3" />
              <span>ESC</span>
            </div>
          </div>

          {/* Results List */}
          <div className="max-h-80 overflow-y-auto p-1.5 space-y-0.5">
            {filtered.length > 0 ? (
              filtered.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                    idx === selectedIndex
                      ? 'bg-cyan-500/15 text-white border border-cyan-500/30'
                      : 'text-slate-300 hover:bg-[var(--control-hover)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="p-1 rounded-md bg-[var(--control-bg)] border border-[var(--border-subtle)]">
                      {item.icon}
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-medium text-slate-200">{item.title}</div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">{item.subtitle}</div>
                    </div>
                  </div>

                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-[var(--control-bg)] text-slate-500 font-mono border border-[var(--border-subtle)]">
                    {item.category}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                No matching elements or tools found.
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
