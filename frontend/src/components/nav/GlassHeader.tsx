import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  ChevronDown,
  Upload,
  PlusCircle,
  Download,
  Search,
  Settings,
  Sun,
  Moon,
  Sparkles,
  FolderTree,
  SlidersHorizontal,
  GripVertical
} from 'lucide-react';
import type { ProjectMetadata } from '../../types/ifc';
import type { Collaborator } from '../../services/collaboration';
import type { UiProfile } from '../../types/profiles';

interface GlassHeaderProps {
  currentProject: ProjectMetadata | null;
  projects?: ProjectMetadata[];
  onSelectProject?: (project: ProjectMetadata) => void;
  onOpenUploadModal: () => void;
  onOpenNewProjectModal: () => void;
  onDownloadProject: () => void;
  activeProfile?: UiProfile;
  onSelectProfile?: (profile: UiProfile) => void;
  onOpenOmnibar: () => void;
  onOpenSettingsModal?: () => void;
  collaborators?: Collaborator[];
  isTreeOpen: boolean;
  onToggleTree: () => void;
  isPropertyOpen: boolean;
  onToggleProperty: () => void;
  isCopilotOpen: boolean;
  onToggleCopilot: () => void;
  currentTheme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const GlassHeader: React.FC<GlassHeaderProps> = ({
  currentProject,
  projects = [],
  onSelectProject,
  onOpenUploadModal,
  onOpenNewProjectModal,
  onDownloadProject,
  activeProfile = 'modify',
  onSelectProfile,
  onOpenOmnibar,
  onOpenSettingsModal,
  collaborators = [],
  isTreeOpen,
  onToggleTree,
  isPropertyOpen,
  onToggleProperty,
  isCopilotOpen,
  onToggleCopilot,
  currentTheme,
  onToggleTheme
}) => {
  return (
    <header
      className="h-16 px-5 flex items-center justify-between border-b border-white/50 dark:border-white/10 bg-white/45 dark:bg-slate-900/60 backdrop-blur-2xl select-none z-30 transition-colors"
      data-qa="glass-header"
      data-qa-top="spatial-top-pill"
      data-qa-draggable-hud="top-pill"
    >
      {/* 1. Left: Brand & Project Selector */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Subtle Grip Handle */}
        <div
          data-drag-handle="true"
          className="flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-grab active:cursor-grabbing pr-0.5"
          title="Drag to reposition header"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        {/* Isometric 3D Brand Logo */}
        <div className="relative w-8 h-8 flex items-center justify-center shrink-0" title="IFC Editor">
          <svg className="w-8 h-8 drop-shadow-sm" viewBox="0 0 36 36">
            <polygon points="18,3 32,11 18,19 4,11" className="fill-amber-500/90" />
            <polygon points="4,11 18,19 18,34 4,26" className="fill-sky-400/90" />
            <polygon points="18,19 32,11 32,26 18,34" className="fill-blue-600/90" />
          </svg>
        </div>

        {/* Project Dropdown */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/60 dark:bg-slate-800/60 hover:bg-white/80 dark:hover:bg-slate-700/70 border border-white/70 dark:border-white/10 shadow-sm text-xs font-semibold text-slate-800 dark:text-slate-100 backdrop-blur-md transition-all cursor-pointer"
              title="Project Selector"
              aria-haspopup="menu"
            >
              <span className="font-bold tracking-tight text-blue-600 dark:text-cyan-400">IFC Editor</span>
              <span className="text-slate-400 dark:text-slate-500">/</span>
              <span className="max-w-[140px] truncate">
                {currentProject ? currentProject.name : 'Select Project'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="z-50 min-w-[220px] bg-white/90 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/70 dark:border-white/10 rounded-2xl p-1.5 shadow-2xl text-xs space-y-1 animate-in fade-in zoom-in-95 text-slate-800 dark:text-slate-200"
              sideOffset={8}
            >
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Projects
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {projects.map((proj) => (
                  <DropdownMenu.Item
                    key={proj.id}
                    onClick={() => onSelectProject?.(proj)}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-blue-50 dark:hover:bg-slate-800/80 cursor-pointer outline-none transition-colors"
                  >
                    <span className="font-medium truncate">{proj.name}</span>
                    {currentProject?.id === proj.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-cyan-400" />
                    )}
                  </DropdownMenu.Item>
                ))}
              </div>

              <div className="h-px bg-slate-200/60 dark:bg-slate-800 my-1" />

              <DropdownMenu.Item
                onClick={onOpenNewProjectModal}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-blue-50 dark:hover:bg-slate-800/80 cursor-pointer outline-none transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                <span>New Blank Project</span>
              </DropdownMenu.Item>

              <DropdownMenu.Item
                onClick={onOpenUploadModal}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-blue-50 dark:hover:bg-slate-800/80 cursor-pointer outline-none transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                <span>Upload IFC</span>
              </DropdownMenu.Item>

              {currentProject && (
                <DropdownMenu.Item
                  onClick={onDownloadProject}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-blue-50 dark:hover:bg-slate-800/80 cursor-pointer outline-none transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                  <span>Export IFC</span>
                </DropdownMenu.Item>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {/* Profile Switcher Tabs */}
        {onSelectProfile && (
          <div
            data-qa="workspace-profile-selector"
            data-qa-ui-profile={activeProfile}
            className="hidden md:flex items-center p-0.5 rounded-full bg-white/50 dark:bg-slate-800/50 border border-white/60 dark:border-white/10 shadow-sm text-[11px] font-medium text-slate-600 dark:text-slate-300"
          >
            {(['review', 'modify', 'query', 'custom'] as UiProfile[]).map((prof) => (
              <button
                key={prof}
                type="button"
                data-qa={prof === 'custom' ? 'profile-custom-trigger' : `profile-${prof}-btn`}
                onClick={() => onSelectProfile(prof)}
                className={`px-3 py-1 rounded-full transition-all capitalize cursor-pointer ${
                  activeProfile === prof
                    ? 'bg-blue-600 text-white shadow-sm font-semibold'
                    : 'hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {prof}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Center: Frosted Omnibar Capsule */}
      <div className="flex-1 max-w-md mx-4">
        <button
          type="button"
          onClick={onOpenOmnibar}
          className="flex items-center justify-between w-full px-4 py-2 rounded-full bg-white/50 dark:bg-slate-800/50 hover:bg-white/70 dark:hover:bg-slate-800/80 border border-white/70 dark:border-white/10 shadow-sm text-xs text-slate-500 dark:text-slate-400 backdrop-blur-md transition-all cursor-pointer group"
          title="Search model... (Ctrl+K)"
        >
          <div className="flex items-center gap-2.5">
            <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors" />
            <span className="text-slate-600 dark:text-slate-300">Search model...</span>
          </div>
          <kbd className="px-2 py-0.5 text-[10px] font-mono rounded-md bg-white/60 dark:bg-slate-700/60 border border-white/80 dark:border-white/10 text-slate-600 dark:text-slate-300 shadow-xs">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* 3. Right: Workspace Toggles, Theme Switcher & Settings */}
      <div className="flex items-center gap-2">
        {/* Spatial Tree Toggle */}
        <button
          type="button"
          onClick={onToggleTree}
          className={`p-2 rounded-full transition-all cursor-pointer ${
            isTreeOpen
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60'
          }`}
          title="Spatial Hierarchy"
          aria-label="Spatial Hierarchy"
        >
          <FolderTree className="w-4 h-4" />
        </button>

        {/* Properties Toggle */}
        <button
          type="button"
          onClick={onToggleProperty}
          className={`p-2 rounded-full transition-all cursor-pointer ${
            isPropertyOpen
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60'
          }`}
          title="Properties"
          aria-label="Properties"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>

        {/* AI Copilot Toggle */}
        <button
          type="button"
          onClick={onToggleCopilot}
          className={`p-2 rounded-full transition-all cursor-pointer ${
            isCopilotOpen
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60'
          }`}
          title="AI Copilot"
          aria-label="AI Copilot"
        >
          <Sparkles className="w-4 h-4" />
        </button>

        {/* Theme Switcher (Default Light <-> Dark Glass) */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="p-2 rounded-full text-slate-700 dark:text-amber-300 hover:bg-white/60 dark:hover:bg-slate-800/60 transition-all cursor-pointer border border-white/40 dark:border-white/10 shadow-xs"
          title={`Switch to ${currentTheme === 'light' ? 'Dark Frosted Obsidian' : 'Light Soft Glass'} Theme`}
          aria-label="Toggle Theme"
        >
          {currentTheme === 'light' ? (
            <Moon className="w-4 h-4 text-slate-700" />
          ) : (
            <Sun className="w-4 h-4 text-amber-300" />
          )}
        </button>

        {/* Collaborators Avatar Cluster */}
        {collaborators.length > 0 && (
          <div className="flex items-center -space-x-1.5 ml-1">
            {collaborators.slice(0, 3).map((collab) => (
              <div
                key={collab.user_id}
                className="w-7 h-7 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center text-[10px] font-bold text-white shadow-sm uppercase"
                style={{ backgroundColor: collab.user_color || 'var(--color-brand-primary)' }}
                title={`${collab.user_name} (${collab.user_id})`}
              >
                {collab.user_name.slice(0, 2)}
              </div>
            ))}
          </div>
        )}

        {/* Settings Button */}
        {onOpenSettingsModal && (
          <button
            type="button"
            data-qa="pill-settings-toggle"
            onClick={onOpenSettingsModal}
            className="p-2 rounded-full text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60 transition-all cursor-pointer ml-1"
            title="Editor Settings"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}

        {/* Quick Action: Export IFC */}
        <button
          type="button"
          data-qa="pill-export-btn"
          onClick={onDownloadProject}
          disabled={!currentProject}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shadow-xs ml-1 ${
            currentProject
              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/25'
              : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
          }`}
          title="Export current IFC model"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export</span>
        </button>
      </div>
    </header>
  );
};
export default GlassHeader;
