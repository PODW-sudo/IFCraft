import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Upload,
  Download,
  FolderTree,
  PlusCircle,
  Box,
  Sparkles,
  ChevronDown,
  Check
} from 'lucide-react';
import type { ProjectMetadata } from '../../types/ifc';
import type { Collaborator } from '../../services/collaboration';

interface TopToolbarProps {
  currentProject: ProjectMetadata | null;
  projects?: ProjectMetadata[];
  onSelectProject?: (project: ProjectMetadata) => void;
  onOpenUploadModal: () => void;
  onOpenNewProjectModal: () => void;
  onDownloadProject: () => void;
  isTreeOpen: boolean;
  onToggleTree: () => void;
  elementCount: number;
  selectedExpressID: number | null;
  hiddenCategories?: Set<string>;
  onToggleCategory?: (category: string) => void;
  collaborators?: Collaborator[];
  isCopilotOpen?: boolean;
  onToggleCopilot?: () => void;
}

const CATEGORY_FILTERS = [
  { key: 'IfcWall', label: 'Walls' },
  { key: 'IfcSlab', label: 'Slabs' },
  { key: 'IfcColumn', label: 'Columns' },
  { key: 'IfcDoor', label: 'Doors' },
  { key: 'IfcWindow', label: 'Windows' }
];

export const TopToolbar: React.FC<TopToolbarProps> = ({
  currentProject,
  projects = [],
  onSelectProject,
  onOpenUploadModal,
  onOpenNewProjectModal,
  onDownloadProject,
  isTreeOpen,
  onToggleTree,
  elementCount,
  selectedExpressID,
  hiddenCategories = new Set(),
  onToggleCategory,
  collaborators = [],
  isCopilotOpen = false,
  onToggleCopilot
}) => {
  return (
    <header className="h-14 w-full bg-[#16191f]/95 backdrop-blur-md border-b border-[#262a33] flex items-center justify-between px-4 z-20">
      {/* Left: Branding & Project Info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/10">
            <Box className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              IFC Editor <span className="text-[10px] font-normal text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">OpenBIM</span>
            </span>
          </div>
        </div>

        <div className="h-5 w-[1px] bg-[#262a33]" />

        {/* Project Selector Dropdown */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="flex items-center gap-2 text-xs bg-[#0d0f12] hover:bg-[#1a1e26] border border-[#262a33] hover:border-slate-600 px-2.5 py-1.5 rounded-lg transition-colors group cursor-pointer focus:outline-none focus:ring-1 focus:ring-sky-500"
              title="Click to switch or load projects"
            >
              <span className="text-slate-400 group-hover:text-slate-300">Project:</span>
              <span className="font-medium text-slate-200 truncate max-w-[150px]" title={currentProject?.name || 'No project'}>
                {currentProject?.name || 'Default Session'}
              </span>
              {currentProject?.schema_version && (
                <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-mono">
                  {currentProject.schema_version}
                </span>
              )}
              {elementCount > 0 && (
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">
                  {elementCount} meshes
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 transition-transform" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="start"
              sideOffset={6}
              className="w-72 bg-[#16191f] border border-[#262a33] rounded-xl shadow-2xl p-1.5 z-50 text-slate-200 text-xs backdrop-blur-xl animate-in fade-in-80"
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
                            ? 'bg-sky-500/15 text-sky-300 font-medium'
                            : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                        }`}
                      >
                        <div className="truncate flex-1 pr-2">
                          <div className="truncate font-medium">{p.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{p.file_name}</div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] px-1 py-0.5 rounded bg-slate-800 text-slate-400 font-mono border border-slate-700/60">
                            {p.schema_version}
                          </span>
                          {isCurrent && <Check className="w-3.5 h-3.5 text-sky-400" />}
                        </div>
                      </DropdownMenu.Item>
                    );
                  })
                ) : (
                  <div className="px-3 py-2 text-slate-400 text-center">No projects available</div>
                )}
              </div>

              <DropdownMenu.Separator className="h-[1px] bg-[#262a33] my-1.5" />

              <DropdownMenu.Item
                onSelect={onOpenNewProjectModal}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-slate-800/80 hover:text-white text-slate-300 outline-none"
              >
                <PlusCircle className="w-3.5 h-3.5 text-sky-400" />
                <span>New Project / Sample Models...</span>
              </DropdownMenu.Item>

              <DropdownMenu.Item
                onSelect={onOpenUploadModal}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-slate-800/80 hover:text-white text-slate-300 outline-none"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                <span>Upload IFC File...</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Center: Category Filters & Selected Element Indicator */}
      <div className="hidden lg:flex items-center gap-3">
        {onToggleCategory && (
          <div className="flex items-center gap-1 bg-[#0d0f12] p-1 rounded-md border border-[#262a33]">
            {CATEGORY_FILTERS.map((cat) => {
              const isHidden = hiddenCategories.has(cat.key);
              return (
                <button
                  key={cat.key}
                  onClick={() => onToggleCategory(cat.key)}
                  className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                    isHidden
                      ? 'text-slate-600 line-through bg-transparent'
                      : 'text-slate-300 hover:text-white bg-slate-800/80 font-medium'
                  }`}
                  title={isHidden ? `Show ${cat.label}` : `Hide ${cat.label}`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        )}

        {selectedExpressID !== null && (
          <div className="flex items-center gap-2 px-3 py-1 rounded bg-sky-500/10 border border-sky-500/20 text-xs text-sky-300">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <span>Element:</span>
            <span className="font-mono font-bold">#{selectedExpressID}</span>
          </div>
        )}
      </div>

      {/* Right: Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleTree}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors border ${
            isTreeOpen
              ? 'bg-slate-800 text-sky-400 border-sky-500/30'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border-transparent'
          }`}
          title="Toggle Spatial Tree"
        >
          <FolderTree className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Hierarchy</span>
        </button>

        {onToggleCopilot && (
          <button
            onClick={onToggleCopilot}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-all border ${
              isCopilotOpen
                ? 'bg-gradient-to-r from-sky-600/30 to-indigo-600/30 text-sky-300 border-sky-500/50 shadow-sm shadow-sky-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border-slate-700/60'
            }`}
            title="Toggle AI Copilot"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Copilot</span>
          </button>
        )}

        <button
          onClick={onOpenNewProjectModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 border border-slate-700/60 transition-colors"
          title="Create New Blank IFC Project"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Project</span>
        </button>

        <button
          onClick={onOpenUploadModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors shadow-sm"
          title="Upload .ifc file"
        >
          <Upload className="w-3.5 h-3.5 text-sky-400" />
          <span>Upload IFC</span>
        </button>

        {/* Collaborators Avatar Stack */}
        {collaborators && collaborators.length > 0 && (
          <div className="flex items-center -space-x-1.5 pl-1 pr-2 border-r border-[#262a33]">
            {collaborators.map((c) => (
              <div
                key={c.user_id}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow ring-1 ring-[#0d0f12] cursor-default"
                style={{ backgroundColor: c.user_color }}
                title={`${c.user_name} ${c.selected_express_id ? `(editing #${c.selected_express_id})` : ''}`}
              >
                {c.user_name.substring(0, 1).toUpperCase()}
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onDownloadProject}
          disabled={!currentProject}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors shadow-sm ${
            currentProject
              ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800'
          }`}
          title="Download updated .ifc file"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export IFC</span>
        </button>
      </div>
    </header>
  );
};
