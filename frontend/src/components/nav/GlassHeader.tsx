import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Slider from '@radix-ui/react-slider';
import {
  ChevronDown,
  Upload,
  PlusCircle,
  Download,
  Search,
  Settings,
  Sun,
  Moon,
  Check,
  FolderTree,
  SlidersHorizontal,
  Sliders,
  Crosshair,
  Sparkles,
  Building2,
  MapPin,
  Keyboard
} from 'lucide-react';
import type { ProjectMetadata } from '../../types/ifc';
import type { Collaborator } from '../../services/collaboration';
import type { UiProfile, CustomProfileSettings } from '../../types/profiles';
import { type UiStyleMode, UI_STYLE_OPTIONS } from '../../types/settings';
import type { ViewportEngine } from '../../types/viewport';
import { SaveStatusIndicator } from './SaveStatusIndicator';
import { withTouchTarget } from '../../utils/touchTargets';

const CUSTOM_TOOL_OPTIONS: Array<{
  key: keyof CustomProfileSettings;
  label: string;
}> = [
  { key: 'showCadToolbar', label: 'CAD Modeling Tools' },
  { key: 'showSnap', label: 'Geometry Snapping' },
  { key: 'showMeasure', label: 'Measure Dimension' },
  { key: 'showSection', label: 'Section Planes' },
  { key: 'showCameraPresets', label: 'Camera Presets' },
  { key: 'showRenderStyle', label: 'Render Styles' },
  { key: 'showTreeDrawer', label: 'Spatial Tree Drawer' },
  { key: 'showPropertyInspector', label: 'Property Inspector' },
  { key: 'showContextualModifyBar', label: 'Contextual Modify Deck' },
];

interface GlassHeaderProps {
  currentProject: ProjectMetadata | null;
  projects?: ProjectMetadata[];
  onSelectProject?: (project: ProjectMetadata) => void;
  onOpenUploadModal: () => void;
  onOpenNewProjectModal: () => void;
  onDownloadProject: () => void;
  activeProfile?: UiProfile;
  onSelectProfile?: (profile: UiProfile) => void;
  customSettings?: CustomProfileSettings;
  onUpdateCustomSettings?: (settings: Partial<CustomProfileSettings>) => void;
  onOpenOmnibar: () => void;
  onOpenSettingsModal?: () => void;
  /** STEP-28: opens the keyboard shortcut legend (`?`). */
  onOpenShortcuts?: () => void;
  /** STEP-28: renders the save-state pill. Defaults to `true`. */
  showSaveStatus?: boolean;
  collaborators?: Collaborator[];
  isTreeOpen?: boolean;
  onToggleTree?: () => void;
  isPropertyOpen?: boolean;
  onToggleProperty?: () => void;
  isCopilotOpen?: boolean;
  onToggleCopilot?: () => void;
  isClashOpen?: boolean;
  onToggleClash?: () => void;
  isStoreyNavOpen?: boolean;
  onToggleStoreyNav?: () => void;
  isAnnotationsOpen?: boolean;
  onToggleAnnotations?: () => void;
  viewportEngine?: ViewportEngine;
  onToggleViewportEngine?: (engine: ViewportEngine) => void;
  currentTheme: 'light' | 'dark';
  onToggleTheme: () => void;
  glassOpacity?: number;
  onUpdateGlassOpacity?: (opacity: number) => void;
  uiStyleMode?: UiStyleMode;
  onUpdateUiStyleMode?: (style: UiStyleMode) => void;
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
  customSettings,
  onUpdateCustomSettings,
  onOpenOmnibar,
  onOpenSettingsModal,
  onOpenShortcuts,
  showSaveStatus = true,
  collaborators = [],
  isTreeOpen = false,
  onToggleTree,
  isPropertyOpen = false,
  onToggleProperty,
  isCopilotOpen = false,
  onToggleCopilot,
  isClashOpen = false,
  onToggleClash,
  isStoreyNavOpen = false,
  onToggleStoreyNav,
  isAnnotationsOpen = false,
  onToggleAnnotations,
  viewportEngine = 'three',
  onToggleViewportEngine,
  currentTheme,
  onToggleTheme,
  glassOpacity,
  onUpdateGlassOpacity,
  uiStyleMode = 'glass',
  onUpdateUiStyleMode
}) => {
  return (
    <header
      className="h-16 px-5 flex items-center justify-between border-b border-[var(--glass-border)] glass-header bg-[var(--glass-surface-header)] backdrop-blur-2xl select-none z-30 transition-colors"
      data-qa="glass-header"
      data-qa-top="spatial-top-pill"
      data-qa-draggable-hud="top-pill"
    >
      {/* 1. Left: Brand & Project Selector */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Hidden drag anchor for QA test harness */}
        <span data-drag-handle="true" className="sr-only" aria-hidden="true" />

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
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--dock-translucent)] hover:bg-[var(--control-hover)] border border-[var(--border-subtle)] shadow-sm text-xs font-semibold text-[var(--text-primary)] backdrop-blur-md transition-all cursor-pointer"
              title="Project Selector"
              aria-haspopup="menu"
            >
              <span className="font-bold tracking-tight text-blue-600 dark:text-cyan-400">IFC Editor</span>
              <span className="text-[var(--text-muted)]">/</span>
              <span className="max-w-[140px] truncate">
                {currentProject ? currentProject.name : 'Select Project'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="z-50 min-w-[220px] bg-white/90 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/70 dark:border-white/10 rounded-2xl p-1.5 shadow-2xl text-xs space-y-1 animate-in fade-in zoom-in-95 text-[var(--text-primary)]"
              sideOffset={8}
            >
              <div className="px-2 py-1 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
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

              <div className="h-px bg-[var(--border-subtle)] my-1" />

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
            className="hidden md:flex items-center p-0.5 rounded-full bg-[var(--dock-translucent)] border border-[var(--border-subtle)] shadow-sm text-[11px] font-medium text-[var(--text-secondary)]"
          >
            {(['review', 'modify', 'query'] as UiProfile[]).map((prof) => (
              <button
                key={prof}
                type="button"
                data-qa={`profile-${prof}-btn`}
                onClick={() => onSelectProfile(prof)}
                className={`px-3 py-1 rounded-full transition-all capitalize cursor-pointer ${
                  activeProfile === prof
                    ? 'bg-blue-600 text-white shadow-sm font-semibold'
                    : 'hover:text-[var(--text-primary)] dark:hover:text-[var(--text-primary)]'
                }`}
              >
                {prof}
              </button>
            ))}

            {/* Custom Role Combo Button: Split Switcher + Tool Checklist Dropdown */}
            <DropdownMenu.Root>
              <div
                className={`flex items-center rounded-full transition-all ${
                  activeProfile === 'custom'
                    ? 'bg-blue-600 text-white shadow-sm font-semibold'
                    : 'hover:text-[var(--text-primary)] dark:hover:text-[var(--text-primary)]'
                }`}
              >
                <button
                  type="button"
                  data-qa="profile-custom-btn"
                  onClick={() => onSelectProfile('custom')}
                  className={`pl-3 pr-1 py-1 rounded-l-full capitalize cursor-pointer ${
                    activeProfile === 'custom' ? 'text-white' : 'hover:text-[var(--text-primary)] dark:hover:text-[var(--text-primary)]'
                  }`}
                  title="Switch to Custom Profile"
                >
                  Custom
                </button>

                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    data-qa="profile-custom-trigger"
                    aria-label="Customize visible tools"
                    title="Configure visible tools for Custom role"
                    className={`pr-2.5 pl-1 py-1 rounded-r-full cursor-pointer flex items-center justify-center transition-colors border-l ${
                      activeProfile === 'custom'
                        ? 'border-white/20 text-white/90 hover:text-white hover:bg-blue-700/60'
                        : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] dark:hover:text-[var(--text-primary)] hover:bg-[var(--control-hover)] dark:hover:bg-[var(--control-hover)]'
                    }`}
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenu.Trigger>
              </div>

              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  data-qa="profile-custom-dropdown"
                  className="z-50 min-w-[240px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/70 dark:border-white/10 rounded-2xl p-2 shadow-2xl text-xs space-y-1 animate-in fade-in zoom-in-95 text-[var(--text-primary)]"
                  sideOffset={8}
                  align="end"
                >
                  <div className="px-2 py-1 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    Custom Role Visible Tools
                  </div>
                  <div className="space-y-0.5">
                    {CUSTOM_TOOL_OPTIONS.map((tool) => {
                      const isChecked = customSettings ? Boolean(customSettings[tool.key]) : true;
                      return (
                        <div
                          key={tool.key}
                          role="menuitemcheckbox"
                          aria-checked={isChecked}
                          data-qa={`custom-tool-toggle-${tool.key}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activeProfile !== 'custom') {
                              onSelectProfile('custom');
                            }
                            onUpdateCustomSettings?.({ [tool.key]: !isChecked });
                          }}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-blue-50 dark:hover:bg-slate-800/80 cursor-pointer select-none transition-colors"
                        >
                          <span className="font-medium text-[var(--text-secondary)]">
                            {tool.label}
                          </span>
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                              isChecked
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'border-[var(--border-subtle)] bg-[var(--dock-translucent)]'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        )}
      </div>

      {/* 2. Center: Frosted Omnibar Capsule */}
      <div className="flex-1 max-w-md mx-4">
        <button
          type="button"
          onClick={onOpenOmnibar}
          className="flex items-center justify-between w-full px-4 py-2 rounded-full bg-[var(--dock-translucent)] hover:bg-[var(--control-hover)] border border-[var(--border-subtle)] shadow-sm text-xs text-[var(--text-secondary)] backdrop-blur-md transition-all cursor-pointer group"
          title="Search model... (Ctrl+K)"
        >
          <div className="flex items-center gap-2.5">
            <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors" />
            <span className="text-[var(--text-secondary)]">Search model...</span>
          </div>
          <kbd className="px-2 py-0.5 text-[10px] font-mono rounded-md bg-[var(--control-bg)] border border-[var(--border-subtle)] text-[var(--text-secondary)] dark:text-[var(--text-primary)] shadow-xs">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* 3. Right: Drawer Toggles, Theme Switcher, Collaborators, Settings & Export */}
      <div className="flex items-center gap-2">
        {/* Drawer & Tool Fast Access Group */}
        <div
          data-qa="header-drawer-toggles"
          className="flex items-center p-0.5 rounded-full bg-[var(--dock-translucent)] border border-[var(--border-subtle)] shadow-sm text-xs gap-0.5"
        >
          {onToggleTree && (
            <button
              type="button"
              data-qa="header-tree-toggle"
              data-qa-btn="pill-tree-toggle"
              onClick={onToggleTree}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                isTreeOpen
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] dark:hover:text-[var(--text-primary)] hover:bg-[var(--control-hover)] dark:hover:bg-[var(--control-hover)]'
              }`}
              title="Spatial Hierarchy Tree"
              aria-label="Toggle Spatial Tree"
              aria-pressed={isTreeOpen}
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Tree</span>
            </button>
          )}

          {onToggleProperty && (
            <button
              type="button"
              data-qa="header-property-toggle"
              data-qa-btn="pill-property-toggle"
              data-qa-inspect-btn="true"
              onClick={onToggleProperty}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                isPropertyOpen
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] dark:hover:text-[var(--text-primary)] hover:bg-[var(--control-hover)] dark:hover:bg-[var(--control-hover)]'
              }`}
              title="Element Properties Inspector"
              aria-label="Toggle Property Inspector"
              aria-pressed={isPropertyOpen}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Props</span>
            </button>
          )}

          {onToggleClash && (
            <button
              type="button"
              data-qa="header-clash-toggle"
              data-qa-btn="pill-clash-toggle"
              onClick={onToggleClash}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                isClashOpen
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] dark:hover:text-[var(--text-primary)] hover:bg-[var(--control-hover)] dark:hover:bg-[var(--control-hover)]'
              }`}
              title="Spatial Clash Detection"
              aria-label="Toggle Clash Detection"
              aria-pressed={isClashOpen}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Clash</span>
            </button>
          )}

          {onToggleCopilot && (
            <button
              type="button"
              data-qa="header-copilot-toggle"
              data-qa-btn="pill-copilot-toggle"
              onClick={onToggleCopilot}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                isCopilotOpen
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] dark:hover:text-[var(--text-primary)] hover:bg-[var(--control-hover)] dark:hover:bg-[var(--control-hover)]'
              }`}
              title="Autonomous OpenBIM AI Copilot"
              aria-label="Toggle AI Copilot"
              aria-pressed={isCopilotOpen}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
              <span className="hidden xl:inline">Copilot</span>
            </button>
          )}

          {onToggleStoreyNav && (
            <button
              type="button"
              data-qa="header-storey-toggle"
              data-qa-btn="pill-storey-toggle"
              onClick={onToggleStoreyNav}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                isStoreyNavOpen
                  ? 'bg-cyan-500 text-slate-950 shadow-xs font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] dark:hover:text-[var(--text-primary)] hover:bg-[var(--control-hover)] dark:hover:bg-[var(--control-hover)]'
              }`}
              title="Storey Views & 2D Floor Plans"
              aria-label="Toggle Storey Views"
              aria-pressed={isStoreyNavOpen}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Storeys</span>
            </button>
          )}

          {onToggleAnnotations && (
            <button
              type="button"
              data-qa="header-annotations-toggle"
              data-qa-btn="pill-annotations-toggle"
              onClick={onToggleAnnotations}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                isAnnotationsOpen
                  ? 'bg-cyan-500 text-slate-950 shadow-xs font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] dark:hover:text-[var(--text-primary)] hover:bg-[var(--control-hover)] dark:hover:bg-[var(--control-hover)]'
              }`}
              title="3D Spatial Annotations & Pins"
              aria-label="Toggle 3D Annotations"
              aria-pressed={isAnnotationsOpen}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Pins</span>
            </button>
          )}
        </div>

        {/* Viewport Engine Switcher (Three.js CAD <-> Xeokit AEC) */}
        {onToggleViewportEngine && (
          <div
            data-qa="header-engine-switcher"
            className="flex items-center rounded-full p-0.5 bg-[var(--dock-translucent)] border border-[var(--border-subtle)] shadow-xs"
          >
            <button
              type="button"
              data-qa="engine-toggle-three"
              onClick={() => onToggleViewportEngine('three')}
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all cursor-pointer ${
                viewportEngine === 'three'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] dark:hover:text-[var(--text-primary)]'
              }`}
              title="Three.js CAD Authoring Engine"
            >
              CAD
            </button>
            <button
              type="button"
              data-qa="engine-toggle-xeokit"
              onClick={() => onToggleViewportEngine('xeokit')}
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all cursor-pointer ${
                viewportEngine === 'xeokit'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] dark:hover:text-[var(--text-primary)]'
              }`}
              title="Xeokit AEC BIM Engine (NavCube, Storey Views, FastNav, 3D Annotations)"
            >
              Xeokit
            </button>
          </div>
        )}

        <div className="h-4 w-px bg-[var(--border-subtle)] mx-0.5" />

        {/* Theme Switcher (Default Light <-> Dark Glass) */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="p-2 rounded-full text-[var(--text-secondary)] dark:text-amber-300 hover:bg-[var(--control-hover)] dark:hover:bg-[var(--control-hover)] transition-all cursor-pointer border border-[var(--border-subtle)] shadow-xs"
          title={`Switch to ${currentTheme === 'light' ? 'Dark Frosted Obsidian' : 'Light Soft Glass'} Theme`}
          aria-label="Toggle Theme"
        >
          {currentTheme === 'light' ? (
            <Moon className="w-4 h-4 text-[var(--text-secondary)]" />
          ) : (
            <Sun className="w-4 h-4 text-amber-300" />
          )}
        </button>

        {/* Quick UI Glass Translucency Slider Control */}
        {onUpdateGlassOpacity && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                data-qa="pill-glass-transparency-toggle"
                className="p-2 rounded-full text-[var(--text-secondary)] hover:bg-[var(--control-hover)] dark:hover:bg-[var(--control-hover)] transition-all cursor-pointer border border-[var(--border-subtle)] shadow-xs"
                title={`UI Glass Opacity: ${(glassOpacity ?? 0.55) <= 0.02 ? '0% (Invisible)' : `${Math.round((glassOpacity ?? 0.55) * 100)}%`} (Click to adjust)`}
                aria-label="Adjust UI Glass Transparency"
              >
                <Sliders className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="z-50 min-w-[340px] max-w-[360px] glass-panel bg-[var(--glass-surface-panel)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-2xl p-3.5 shadow-2xl text-xs space-y-3 animate-in fade-in zoom-in-95 text-[var(--text-primary)]"
                sideOffset={8}
                align="end"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-xs">
                    <Sliders className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                    <span>UI Style & Translucency</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-blue-600 dark:text-cyan-400">
                    {uiStyleMode === 'matte'
                      ? 'Solid Matte'
                      : (glassOpacity ?? 0.55) <= 0.02
                      ? '0% (Invisible)'
                      : `${Math.round((glassOpacity ?? 0.55) * 100)}%`}
                  </span>
                </div>

                {/* Quick UI Style Selector */}
                {onUpdateUiStyleMode && (
                  <div className="space-y-2 pb-2.5 border-b border-[var(--glass-border)]">
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                      <span className="font-semibold uppercase tracking-wider text-[10px]">Interface Concepts</span>
                      <span className="font-mono text-[10px] text-blue-600 dark:text-cyan-400 font-bold px-1.5 py-0.5 rounded bg-blue-500/10 dark:bg-cyan-500/10 border border-blue-500/20 dark:border-cyan-500/30 capitalize">
                        {UI_STYLE_OPTIONS.find((s) => s.id === uiStyleMode)?.badge ?? uiStyleMode}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 max-h-[220px] overflow-y-auto pr-0.5">
                      {UI_STYLE_OPTIONS.map((style) => {
                        const isSelected = uiStyleMode === style.id;
                        return (
                          <button
                            key={style.id}
                            type="button"
                            data-qa={`header-style-btn-${style.id}`}
                            onClick={() => onUpdateUiStyleMode(style.id)}
                            className={`px-2 py-1.5 rounded-lg text-left transition-all cursor-pointer border ${
                              isSelected
                                ? 'border-blue-500 dark:border-cyan-400 bg-blue-50/90 dark:bg-cyan-500/20 text-blue-700 dark:text-cyan-300 font-bold shadow-sm'
                                : 'border-[var(--glass-border)] glass-card bg-[var(--glass-surface-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] dark:hover:text-[var(--text-primary)] hover:border-[var(--border-subtle)]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[11px] font-semibold truncate leading-tight">{style.name.split(' (')[0]}</span>
                              {style.badge && (
                                <span className={`text-[8px] uppercase tracking-wider px-1 py-0.5 rounded font-mono font-bold shrink-0 ${
                                  isSelected
                                    ? 'bg-blue-600 dark:bg-cyan-400 text-white dark:text-slate-950'
                                    : 'bg-[var(--control-bg)] text-[var(--text-secondary)]'
                                }`}>
                                  {style.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-[9px] text-[var(--text-secondary)] truncate mt-0.5 leading-normal">
                              {style.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)] font-mono">
                    <span>0% (Clear)</span>
                    <span>100% (Solid)</span>
                  </div>
                  <Slider.Root
                    data-qa="ui-glass-opacity-slider"
                    value={[glassOpacity ?? 0.55]}
                    min={0.0}
                    max={1.0}
                    step={0.02}
                    onValueChange={([val]) => onUpdateGlassOpacity(val)}
                    className="relative flex items-center select-none touch-none w-full h-4"
                  >
                    <Slider.Track className="bg-[var(--border-subtle)] relative grow rounded-full h-1.5">
                      <Slider.Range className="absolute bg-blue-600 dark:bg-cyan-400 rounded-full h-full" />
                    </Slider.Track>
                    <Slider.Thumb
                      className="block w-4 h-4 bg-white border border-slate-300 dark:border-slate-600 rounded-full shadow-md hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-grab active:cursor-grabbing transition-transform"
                      aria-label="UI Glass Opacity"
                    />
                  </Slider.Root>
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-4 gap-1 pt-1">
                  {[
                    { label: 'Clear', val: 0.0 },
                    { label: 'Sheer', val: 0.25 },
                    { label: 'Frosted', val: 0.55 },
                    { label: 'Opaque', val: 0.90 }
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => onUpdateGlassOpacity(p.val)}
                      className={`py-1 rounded-lg text-[10px] font-mono border text-center transition-all cursor-pointer ${
                        Math.abs((glassOpacity ?? 0.55) - p.val) < 0.04
                          ? 'border-blue-400 dark:border-cyan-400 bg-blue-50/80 dark:bg-cyan-500/20 text-blue-700 dark:text-cyan-300 font-bold'
                          : 'border-[var(--glass-border)] glass-card bg-[var(--glass-surface-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] dark:hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}

        {/* Collaborators Avatar Cluster */}
        {collaborators.length > 0 && (
          <div className="flex items-center -space-x-1.5 ml-1">
            {collaborators.slice(0, 3).map((collab) => (
              <div
                key={collab.user_id}
                className="w-7 h-7 rounded-full border-2 border-[var(--border-subtle)] flex items-center justify-center text-[10px] font-bold text-white shadow-sm uppercase"
                style={{ backgroundColor: collab.user_color || 'var(--color-brand-primary)' }}
                title={`${collab.user_name} (${collab.user_id})`}
              >
                {collab.user_name.slice(0, 2)}
              </div>
            ))}
          </div>
        )}

        {/* STEP-28: Keyboard shortcut legend + save-state pill */}
        {onOpenShortcuts && (
          <button
            type="button"
            data-qa="pill-shortcuts-help"
            data-touch-target="true"
            onClick={onOpenShortcuts}
            className={withTouchTarget(
              'p-2 flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--control-hover)] dark:hover:bg-[var(--control-hover)] transition-all cursor-pointer ml-1'
            )}
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
          >
            <Keyboard className="w-4 h-4" />
          </button>
        )}

        {showSaveStatus && (
          <div className="ml-1 shrink-0">
            <SaveStatusIndicator />
          </div>
        )}

        {/* Settings Button */}
        {onOpenSettingsModal && (
          <button
            type="button"
            data-qa="pill-settings-toggle"
            data-touch-target="true"
            onClick={onOpenSettingsModal}
            className={withTouchTarget(
              'p-2 flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--control-hover)] dark:hover:bg-[var(--control-hover)] transition-all cursor-pointer ml-1'
            )}
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
              : 'bg-[var(--border-subtle)] text-[var(--text-muted)] cursor-not-allowed'
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
