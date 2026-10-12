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
  PenTool,
  ClipboardList,
  History,
  GripVertical,
  Settings,
  Sliders
} from 'lucide-react';
import { useDraggableHud } from '../hud/HudLayoutContext';
import type { ProjectMetadata, SpatialNode } from '../../types/ifc';
import type { Collaborator } from '../../services/collaboration';
import type { UiProfile, CustomProfileSettings } from '../../types/profiles';

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
  activeProfile?: UiProfile;
  onSelectProfile?: (profile: UiProfile) => void;
  customSettings?: CustomProfileSettings;
  onUpdateCustomSettings?: (settings: Partial<CustomProfileSettings>) => void;
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
  isBcfOpen?: boolean;
  onToggleBcf?: () => void;
  bcfTopicCount?: number;
  isTimelineOpen?: boolean;
  onToggleTimeline?: () => void;
  auditCount?: number;
  onOpenSettingsModal?: () => void;
  onOpenMockup?: () => void;
}

export const SpatialTopPill: React.FC<SpatialTopPillProps> = ({
  currentProject,
  projects = [],
  onSelectProject,
  activeProfile = 'modify',
  onSelectProfile,
  customSettings,
  onUpdateCustomSettings,
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
  onToggleCad,
  isBcfOpen = false,
  onToggleBcf,
  bcfTopicCount = 0,
  isTimelineOpen = false,
  onToggleTimeline,
  auditCount = 0,
  onOpenSettingsModal,
  onOpenMockup
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
  const isReview = activeProfile === 'review';

  const [windowWidth, setWindowWidth] = React.useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1440
  );

  React.useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { ref, style, dragProps, isDragging } = useDraggableHud('top-pill', {
    x: 0,
    y: 0,
    width: windowWidth,
    height: 44
  });

  return (
    <header
      ref={ref}
      style={isDragging ? style : { ...style, left: 0, top: 0, width: '100%', maxWidth: '100vw' }}
      {...dragProps}
      className={`fixed top-0 left-0 right-0 h-11 w-full bg-slate-950/90 backdrop-blur-md border-b border-white/[0.08] z-40 px-3 flex items-center justify-between select-none text-xs text-slate-200 transition-shadow ${
        isDragging ? 'shadow-cyan-500/20 ring-1 ring-cyan-500/40 cursor-grabbing' : ''
      }`}
      data-qa="spatial-top-pill"
    >
      {/* Left Zone: Brand, Project Selector, Profiles */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        {/* Draggable Grip Handle */}
        <div
          data-drag-handle="true"
          className="flex items-center text-slate-500 hover:text-slate-300 pr-1 py-1 cursor-grab active:cursor-grabbing"
          title="Drag to reposition Top Bar"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>

      {/* Brand & Project Selector */}
      <div className="flex items-center gap-2 pr-2 border-r border-[var(--border-subtle)]">
        <div className="w-6 h-6 rounded-md bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
          <Box className="w-3.5 h-3.5" />
        </div>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              data-qa="pill-project-trigger"
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

              {onOpenSettingsModal && (
                <DropdownMenu.Item
                  onSelect={onOpenSettingsModal}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-[var(--control-hover)] hover:text-white text-slate-300 outline-none"
                  data-qa="dropdown-settings-item"
                >
                  <Settings className="w-3.5 h-3.5 text-sky-400" />
                  <span>Editor Settings (Ctrl+,)...</span>
                </DropdownMenu.Item>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Workspace Profile Segmented Selector: Review | Modify | Query | Custom */}
      {onSelectProfile && (
        <div
          data-qa="workspace-profile-selector"
          data-qa-ui-profile={activeProfile}
          className="flex items-center rounded-full bg-[var(--control-bg)]/80 p-0.5 border border-[var(--border-subtle)] text-[11px] shadow-sm"
        >
          <button
            data-qa="profile-review-btn"
            onClick={() => onSelectProfile('review')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-all ${
              activeProfile === 'review'
                ? 'bg-cyan-500/20 text-cyan-300 shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
            }`}
            title="Review Profile: 100% Immersive View, Presentations & Coordination"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className={windowWidth < 1280 ? 'hidden' : 'hidden xl:inline'}>Review</span>
          </button>

          <button
            data-qa="profile-modify-btn"
            onClick={() => onSelectProfile('modify')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-all ${
              activeProfile === 'modify'
                ? 'bg-cyan-500/20 text-cyan-300 shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
            }`}
            title="Modify Profile: Direct CAD Modeling, Precision Snapping & Transformations"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span className={windowWidth < 1280 ? 'hidden' : 'hidden xl:inline'}>Modify</span>
          </button>

          <button
            data-qa="profile-query-btn"
            onClick={() => onSelectProfile('query')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-all ${
              activeProfile === 'query'
                ? 'bg-cyan-500/20 text-cyan-300 shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
            }`}
            title="Query Profile: BIM Property Analysis & Spatial Hierarchy Inspection"
          >
            <Search className="w-3.5 h-3.5" />
            <span className={windowWidth < 1280 ? 'hidden' : 'hidden xl:inline'}>Query</span>
          </button>

          {/* Custom Profile Dropdown with Live Toolbars Configuration */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                data-qa="profile-custom-trigger"
                onClick={() => onSelectProfile('custom')}
                className={`flex items-center gap-1 px-2 py-1 rounded-full font-medium transition-all ${
                  activeProfile === 'custom'
                    ? 'bg-cyan-500/20 text-cyan-300 shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
                }`}
                title="Custom Profile: Configure Toolbar & Panel Visibility"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span className={windowWidth < 1280 ? 'hidden' : 'hidden xl:inline'}>Custom</span>
                <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="center"
                sideOffset={8}
                className="w-72 bg-[var(--dock-bg)] border border-[var(--border-subtle)] rounded-xl shadow-[var(--shadow-hud)] p-2 z-50 text-slate-200 text-xs backdrop-blur-xl animate-in fade-in"
              >
                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[var(--border-subtle)]">
                  <span className="text-[10px] uppercase font-semibold text-slate-400">Custom Profile Toolbars</span>
                  <span className="text-[9px] text-cyan-400 font-mono">Live Toggles</span>
                </div>
                <div className="space-y-1">
                  {[
                    { key: 'showContextualModifyBar', label: 'CAD Modify Ribbon' },
                    { key: 'showCadToolbar', label: 'CAD Modeling Palette' },
                    { key: 'showBottomDock', label: 'Spatial Bottom Dock' },
                    { key: 'showViewControls', label: 'View Orientation HUD' },
                    { key: 'showCoordinateHud', label: 'Placement Coordinates HUD' },
                    { key: 'showBreadcrumbs', label: 'Spatial Breadcrumbs' },
                    { key: 'showSnap', label: 'Precision Snapping' },
                    { key: 'showMeasure', label: 'Laser Measure Tool' },
                    { key: 'showSection', label: 'Section Cut Plane' },
                    { key: 'showRenderStyle', label: 'Render Style Selector' }
                  ].map((item) => {
                    const isEnabled = customSettings ? (customSettings as any)[item.key] !== false : true;
                    return (
                      <div
                        key={item.key}
                        data-qa={`custom-toggle-${item.key}`}
                        onClick={() => {
                          if (onUpdateCustomSettings) {
                            onUpdateCustomSettings({ [item.key]: !isEnabled });
                          }
                        }}
                        className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-[var(--control-hover)] cursor-pointer select-none transition-colors"
                      >
                        <span className="text-slate-300 text-xs">{item.label}</span>
                        <div
                          className={`w-8 h-4 rounded-full transition-colors flex items-center px-0.5 ${
                            isEnabled ? 'bg-cyan-500' : 'bg-slate-700'
                          }`}
                        >
                          <div
                            className={`w-3 h-3 rounded-full bg-white transition-transform ${
                              isEnabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
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

      {/* Center Zone: Breadcrumbs & Omnibar */}
      <div className="flex items-center gap-2 mx-auto px-2 min-w-0">
        {/* Spatial Breadcrumbs (Rendered when element is selected) */}
        {(customSettings ? customSettings.showBreadcrumbs !== false : true) && breadcrumbs && breadcrumbs.length > 0 && (
          <>
            <div className="hidden lg:flex items-center gap-1.5 text-slate-400 text-xs px-2 max-w-xs truncate">
              {windowWidth < 1366 ? (
                <span className="truncate text-slate-100 font-medium max-w-[110px]" title={breadcrumbs[breadcrumbs.length - 1]}>
                  {breadcrumbs[breadcrumbs.length - 1]}
                </span>
              ) : (
                breadcrumbs.slice(-3).map((item, idx, arr) => (
                  <React.Fragment key={idx}>
                    <span
                      className={`truncate ${idx === arr.length - 1 ? 'text-slate-100 font-medium' : 'text-slate-400'}`}
                      title={item}
                    >
                      {item}
                    </span>
                    {idx < arr.length - 1 && <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />}
                  </React.Fragment>
                ))
              )}
            </div>
            <div className="h-4 w-[1px] bg-[var(--border-subtle)]" />
          </>
        )}

        {/* Omnibar / Command Palette Trigger */}
        <button
          data-qa="pill-omnibar-trigger"
          onClick={onOpenOmnibar}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)] transition-colors border border-transparent hover:border-[var(--border-subtle)]"
          title="Open Command Palette (Ctrl+K)"
        >
          <Search className="w-3.5 h-3.5" />
          <span className={`text-[11px] font-mono text-slate-400 bg-[var(--control-bg)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)] ${windowWidth < 1050 ? 'hidden' : 'hidden md:inline'}`}>
            Ctrl+K
          </span>
        </button>
      </div>

      {/* Right Zone: Tools, Drawers, Avatars, Settings, Export */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Category Filter Dropdown (hidden in Review mode) */}
        {!isReview && (
          <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              data-qa="pill-filter-trigger"
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${
                hiddenCategories.size > 0
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
              }`}
              title="Filter Category Visibility"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className={windowWidth < 1500 ? 'hidden' : 'hidden 2xl:inline text-xs'}>Filter</span>
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
                    data-qa={`category-filter-${cat.key}`}
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
      )}

      {/* Federation Button (Query & Custom profiles) */}
      {(activeProfile === 'query' || activeProfile === 'custom') && (
        <button
          data-qa="pill-federation-toggle"
          onClick={onToggleFederation}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${
            isFederationOpen
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
          }`}
          title="Federated Model Coordination"
        >
          <Layers className="w-3.5 h-3.5" />
          <span className={windowWidth < 1500 ? 'hidden' : 'hidden 2xl:inline text-xs'}>Federation</span>
          {subModelCount > 0 && (
            <span className="text-[9px] font-mono px-1 rounded-full bg-cyan-500/25 text-cyan-300">
              +{subModelCount}
            </span>
          )}
        </button>
      )}

      {/* Clashes Button (Query & Custom profiles) */}
      {(activeProfile === 'query' || activeProfile === 'custom') && (
        <button
          data-qa="pill-clashes-toggle"
          onClick={onToggleClash}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${
            isClashOpen
              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
          }`}
          title="Spatial Clash Detection"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span className={windowWidth < 1500 ? 'hidden' : 'hidden 2xl:inline text-xs'}>Clashes</span>
          {clashCount > 0 && (
            <span className="text-[9px] font-mono px-1 rounded-full bg-amber-500/30 text-amber-300 font-bold">
              {clashCount}
            </span>
          )}
        </button>
      )}

      {/* Parametric CAD Modeling Tool Toggle (Modify & Custom profiles) */}
      {(activeProfile === 'modify' || (activeProfile === 'custom' && customSettings?.showCadToolbar !== false)) && (
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
          <span className={windowWidth < 1500 ? 'hidden' : 'hidden 2xl:inline text-xs'}>Model</span>
        </button>
      )}

      {/* BCF Issues & Collaboration Toggle (Query & Custom profiles) */}
      {(activeProfile === 'query' || activeProfile === 'custom') && (
        <button
          data-qa="pill-bcf-toggle"
          onClick={onToggleBcf}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
            isBcfOpen
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
          }`}
          title="BCF Issues & Viewpoints"
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span className={windowWidth < 1500 ? 'hidden' : 'hidden 2xl:inline text-xs'}>BCF</span>
          {bcfTopicCount > 0 && (
            <span className="text-[9px] font-mono px-1 rounded-full bg-cyan-500/25 text-cyan-300">
              {bcfTopicCount}
            </span>
          )}
        </button>
      )}

      {/* Audit Timeline Scrubber Toggle (Query & Custom profiles) */}
      {(activeProfile === 'query' || activeProfile === 'custom') && (
        <button
          data-qa="pill-timeline-toggle"
          onClick={onToggleTimeline}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
            isTimelineOpen
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
          }`}
          title="Session Playback & Change Audit"
        >
          <History className="w-3.5 h-3.5" />
          <span className={windowWidth < 1500 ? 'hidden' : 'hidden 2xl:inline text-xs'}>Timeline</span>
          {auditCount > 0 && (
            <span className="text-[9px] font-mono px-1 rounded-full bg-slate-700 text-slate-300">
              {auditCount}
            </span>
          )}
        </button>
      )}

      {/* Drawer Toggle Controls (hidden in Review mode) */}
      {!isReview && (
        <>
          <div className="h-4 w-[1px] bg-[var(--border-subtle)]" />
          <div className="flex items-center gap-1">
            <button
              data-qa="pill-tree-toggle"
              onClick={onToggleTree}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                isTreeOpen
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
              }`}
              title="Toggle Spatial Hierarchy Drawer"
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span className={windowWidth < 1300 ? 'hidden' : 'hidden xl:inline'}>Tree</span>
            </button>

            <button
              data-qa="pill-inspect-toggle"
              onClick={onToggleProperty}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                isPropertyOpen
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
              }`}
              title="Toggle Properties Drawer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className={windowWidth < 1300 ? 'hidden' : 'hidden xl:inline'}>Inspect</span>
            </button>

            <button
              data-qa="pill-copilot-toggle"
              onClick={onToggleCopilot}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                isCopilotOpen
                  ? 'bg-[var(--control-active)] text-cyan-300 border border-[var(--border-focus)] shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[var(--control-hover)]'
              }`}
              title="Toggle AI Copilot Assistant (Ctrl+J)"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span className={windowWidth < 1300 ? 'hidden' : 'hidden xl:inline'}>Copilot</span>
            </button>
          </div>
        </>
      )}

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

      {/* Modern Glass Mockup Preview Trigger */}
      {onOpenMockup && (
        <button
          data-qa="pill-modern-glass-toggle"
          onClick={onOpenMockup}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-sky-300 hover:text-white bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/30 shadow-sm transition-all cursor-pointer"
          title="Preview Modern Glass UI Mockup"
        >
          <Box className="w-3.5 h-3.5 text-sky-400" />
          <span className={windowWidth < 1200 ? 'hidden' : 'hidden lg:inline'}>Modern Glass</span>
        </button>
      )}

      {/* Settings Modal Trigger */}
      {onOpenSettingsModal && (
        <button
          data-qa="pill-settings-toggle"
          onClick={onOpenSettingsModal}
          className="p-1.5 rounded-full text-slate-400 hover:text-slate-100 hover:bg-[var(--control-hover)] transition-colors border border-transparent hover:border-[var(--border-subtle)]"
          title="Editor Settings & Viewport Preferences (Ctrl+,)"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Quick Action: Export IFC */}
      <button
        data-qa="pill-export-btn"
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
        <span className={windowWidth < 1100 ? 'hidden' : 'hidden lg:inline'}>Export</span>
      </button>
      </div>
    </header>
  );
};
