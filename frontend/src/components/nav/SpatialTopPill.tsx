import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Box,
  ChevronDown,
  Check,
  PlusCircle,
  Upload,
  Download,
  FolderTree,
  SlidersHorizontal,
  Sparkles,
  Search,
  ChevronRight,
  Eye,
  EyeOff,
  Layers,
  AlertTriangle,
  PenTool
} from 'lucide-react';
import type { ProjectMetadata, SpatialNode } from '../../types/ifc';
import type { Collaborator } from '../../services/collaboration';

const CATEGORY_FILTERS = [
  { key: 'IfcWall', label: 'Walls' },
  { key: 'IfcSlab', label: 'Slabs' },
  { key: 'IfcColumn', label: 'Columns' },
  { key: 'IfcDoor', label: 'Doors' },
  { key: 'IfcWindow', label: 'Windows' }
];

interface SpatialTopPillProps {
  currentProject: ProjectMetadata | null;
  projects?: ProjectMetadata[];
  onSelectProject?: (project: ProjectMetadata) => void;
  onOpenUploadModal: () => void;
  onOpenNewProjectModal: () => void;
  onDownloadProject: () => void;
  isTreeOpen: boolean;
  onToggleTree: () => void;
  isPropertyOpen: boolean;
  onToggleProperty: () => void;
  isCopilotOpen: boolean;
  onToggleCopilot: () => void;
  onOpenOmnibar: () => void;
  selectedExpressID: number | null;
  spatialTree: SpatialNode | null;
  collaborators?: Collaborator[];
  hiddenCategories?: Set<string>;
  onToggleCategory?: (category: string) => void;
  isFederationOpen?: boolean;
  onToggleFederation?: () => void;
  subModelCount?: number;
  isClashOpen?: boolean;
  onToggleClash?: () => void;
  clashCount?: number;
  isCadOpen?: boolean;
  onToggleCad?: () => void;
}

export const SpatialTopPill: React.FC<SpatialTopPillProps> = ({
  currentProject,
  projects = [],
  onSelectProject,
  onOpenUploadModal,
  onOpenNewProjectModal,
  onDownloadProject,
  isTreeOpen,
  onToggleTree,
  isPropertyOpen,
  onToggleProperty,
  isCopilotOpen,
  onToggleCopilot,
  onOpenOmnibar,
  selectedExpressID,
  spatialTree,
  collaborators = [],
  hiddenCategories = new Set(),
  onToggleCategory,
  isFederationOpen = false,
  onToggleFederation,
  subModelCount = 0,
  isClashOpen = false,
  onToggleClash,
  clashCount = 0,
  isCadOpen = false,
  onToggleCad
}) => {
  // Find spatial path for breadcrumbs
  const findBreadcrumbPath = (node: SpatialNode | null, targetId: number | null, path: string[] = []): string[] | null => {
    if (!node || targetId === null) return null;
    const currentPath = [...path, node.name || node.type];
    if (node.express_id === targetId) return currentPath;
    for (const child of node.children) {
      const found = findBreadcrumbPath(child, targetId, currentPath);
      if (found) return found;
    }
    return null;
  };

  const breadcrumbs = findBreadcrumbPath(spatialTree, selectedExpressID);

  return (
    <header className="fixed top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--dock-translucent)] backdrop-blur-xl border border-[var(--border-subtle)] shadow-[var(--shadow-hud)] select-none text-xs text-slate-200">
      {/* Brand & Project Selector */}
      <div className="flex items-center gap-2 pr-2 border-r border-[var(--border-subtle)]">
        <div className="w-6 h-6 rounded-md bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
          <Box className="w-3.5 h-3.5" />
        </div>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="flex items-center gap-1.5 text-xs text-slate-200 hover:text-white px-2 py-1 rounded-md hover:bg-[var(--control-hover)] transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-400"
              title="Switch active IFC project"
            >
              <span className="font-semibold max-w-[130px] truncate" title={currentProject?.name || 'Starter Session'}>
                {currentProject?.name || 'Starter Session'}
              </span>
              {currentProject?.schema_version && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--control-bg)] text-slate-400 font-mono border border-[var(--border-subtle)]">
                  {currentProject.schema_version}
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="start"
              sideOffset={8}
              className="w-72 bg-[var(--dock-bg)] border border-[var(--border-subtle)] rounded-xl shadow-[var(--shadow-hud)] p-1.5 z-50 text-slate-200 text-xs backdrop-blur-xl animate-in fade-in-80"
            >
              <div className="px-2 py-1.5 text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                Switch Project
              </div>
              <div className="max-h-60 overflow-y-auto space-y-0.5">
                {projects && projects.length > 0 ? (
                  projects.map((p) => {
                    const isCurrent = currentProject?.id === p.id;
                    return (
                      <DropdownMenu.Item
                        key={p.id}
                        onSelect={() => onSelectProject && onSelectProject(p)}
                        className={`flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-colors outline-none ${
                          isCurrent
                            ? 'bg-cyan-500/15 text-cyan-300 font-medium'
                            : 'hover:bg-[var(--control-hover)] hover:text-white text-slate-300'
                        }`}
                      >
                        <div className="truncate flex-1 pr-2">
                          <div className="truncate font-medium">{p.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{p.file_name}</div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] px-1 py-0.5 rounded bg-[var(--control-bg)] text-slate-400 font-mono border border-[var(--border-subtle)]">
                            {p.schema_version}
                          </span>
                          {isCurrent && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                        </div>
                      </DropdownMenu.Item>
                    );
                  })
                ) : (
                  <div className="px-3 py-2 text-slate-400 text-center">No projects available</div>
                )}
              </div>

              <DropdownMenu.Separator className="h-[1px] bg-[var(--border-subtle)] my-1.5" />

              <DropdownMenu.Item
                onSelect={onOpenNewProjectModal}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-[var(--control-hover)] hover:text-white text-slate-300 outline-none"
              >
                <PlusCircle className="w-3.5 h-3.5 text-cyan-400" />
                <span>New Project / Sample Models...</span>
              </DropdownMenu.Item>

              <DropdownMenu.Item
                onSelect={onOpenUploadModal}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-[var(--control-hover)] hover:text-white text-slate-300 outline-none"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                <span>Upload IFC File...</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Spatial Breadcrumbs (Rendered when element is selected) */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <>
          <div className="hidden md:flex items-center gap-1.5 text-slate-400 text-xs px-2 max-w-sm truncate">
            {breadcrumbs.slice(-3).map((item, idx, arr) => (
              <React.Fragment key={idx}>
                <span
                  className={`truncate ${idx === arr.length - 1 ? 'text-slate-100 font-medium' : 'text-slate-400'}`}
                  title={item}
                >
                  {item}
                </span>
                {idx < arr.length - 1 && <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />}
              </React.Fragment>
            ))}
          </div>
          <div className="h-4 w-[1px] bg-[var(--border-subtle)]" />
        </>
      )}

      {/* Omnibar / Command Palette Trigger */}
      <button
        onClick={onOpenOmnibar}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)] transition-colors border border-transparent hover:border-[var(--border-subtle)]"
        title="Open Command Palette (Ctrl+K)"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="text-[11px] font-mono text-slate-400 bg-[var(--control-bg)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)]">
          Ctrl+K
        </span>
      </button>

      {/* Category Filter Dropdown */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${
              hiddenCategories.size > 0
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
            }`}
            title="Filter Category Visibility"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-xs">Filter</span>
            {hiddenCategories.size > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            )}
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="z-50 min-w-[160px] bg-[var(--dock-bg)] border border-[var(--border-subtle)] rounded-xl p-1 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
            sideOffset={8}
            align="center"
          >
            <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Category Visibility
            </div>
            {CATEGORY_FILTERS.map((cat) => {
              const isHidden = hiddenCategories.has(cat.key);
              return (
                <DropdownMenu.Item
                  key={cat.key}
                  onSelect={(e) => {
                    e.preventDefault();
                    if (onToggleCategory) onToggleCategory(cat.key);
                  }}
                  className="flex items-center justify-between px-2.5 py-1.5 text-xs text-slate-200 rounded-lg cursor-pointer hover:bg-[var(--control-hover)] focus:bg-[var(--control-hover)] outline-none transition-colors"
                >
                  <span className={isHidden ? 'text-slate-500 line-through' : 'text-slate-200'}>
                    {cat.label}
                  </span>
                  {isHidden ? (
                    <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                  ) : (
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                </DropdownMenu.Item>
              );
            })}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Federation Button */}
      <button
        onClick={onToggleFederation}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${
          isFederationOpen
            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
            : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
        }`}
        title="Federated Model Coordination"
      >
        <Layers className="w-3.5 h-3.5" />
        <span className="hidden sm:inline text-xs">Federation</span>
        {subModelCount > 0 && (
          <span className="text-[9px] font-mono px-1 rounded-full bg-cyan-500/25 text-cyan-300">
            +{subModelCount}
          </span>
        )}
      </button>

      {/* Clashes Button */}
      <button
        onClick={onToggleClash}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${
          isClashOpen
            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
            : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
        }`}
        title="Spatial Clash Detection"
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        <span className="hidden sm:inline text-xs">Clashes</span>
        {clashCount > 0 && (
          <span className="text-[9px] font-mono px-1 rounded-full bg-amber-500/30 text-amber-300 font-bold">
            {clashCount}
          </span>
        )}
      </button>

      {/* Parametric CAD Modeling Tool Toggle */}
      <button
        data-qa="pill-cad-toggle"
        onClick={onToggleCad}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
          isCadOpen
            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
            : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
        }`}
        title="Parametric 3D Modeling Tools"
      >
        <PenTool className="w-3.5 h-3.5" />
        <span className="hidden sm:inline text-xs">Model</span>
      </button>

      <div className="h-4 w-[1px] bg-[var(--border-subtle)]" />

      {/* Drawer Toggle Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={onToggleTree}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
            isTreeOpen
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
          }`}
          title="Toggle Spatial Hierarchy Drawer"
        >
          <FolderTree className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Tree</span>
        </button>

        <button
          onClick={onToggleProperty}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
            isPropertyOpen
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
          }`}
          title="Toggle Properties Drawer"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Inspect</span>
        </button>

        <button
          onClick={onToggleCopilot}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
            isCopilotOpen
              ? 'bg-[var(--control-active)] text-cyan-300 border border-[var(--border-focus)] shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
          }`}
          title="Toggle AI Copilot Assistant (Ctrl+J)"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Copilot</span>
        </button>
      </div>

      <div className="h-4 w-[1px] bg-[var(--border-subtle)]" />

      {/* Collaborator Avatars */}
      {collaborators && collaborators.length > 0 && (
        <div className="flex items-center -space-x-1.5 px-1">
          {collaborators.map((c) => (
            <div
              key={c.user_id}
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow ring-1 ring-[var(--dock-bg)] cursor-default"
              style={{ backgroundColor: c.user_color }}
              title={`${c.user_name} ${c.selected_express_id ? `(editing #${c.selected_express_id})` : ''}`}
            >
              {c.user_name.substring(0, 1).toUpperCase()}
            </div>
          ))}
        </div>
      )}

      {/* Quick Action: Export IFC */}
      <button
        onClick={onDownloadProject}
        disabled={!currentProject}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
          currentProject
            ? 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold shadow-sm'
            : 'bg-[var(--control-bg)] text-slate-500 cursor-not-allowed'
        }`}
        title="Export current IFC model"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Export</span>
      </button>
    </header>
  );
};
