import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useGizmoTransform } from './hooks/useGizmoTransform';
import { useSpatialSelection } from './hooks/useSpatialSelection';
import { useCadDraftingMachine } from './hooks/useCadDraftingMachine';
import { useModalManager } from './hooks/useModalManager';
import { useModelLifecycle } from './hooks/useModelLifecycle';
import {
  ThreeViewport,
  type TransformMode,
  type MeasurementRecord
} from './components/viewer/ThreeViewport';
// Code-split heavy modals and engines to optimize initial bundle size & LCP
const XeokitViewport = React.lazy(() => import('./components/viewer/XeokitViewport'));
import { StoreyNavigatorHud } from './components/hud/StoreyNavigatorHud';
import { AnnotationsHud } from './components/hud/AnnotationsHud';
import { GlassSpatialTree } from './components/tree/GlassSpatialTree';
import { GlassPropertyInspector } from './components/properties/GlassPropertyInspector';
import { GlassHeader } from './components/nav/GlassHeader';
import { GlassContextualModifyDock } from './components/cad/GlassContextualModifyDock';
import { GlassBottomDock } from './components/dock/GlassBottomDock';
import { GlassViewCube } from './components/hud/GlassViewCube';
import { CoordinateHud } from './components/hud/CoordinateHud';
import { DimensionInfoHud } from './components/hud/DimensionInfoHud';
import { HudLayoutProvider } from './components/hud/HudLayoutContext';
import { SpatialOmnibar } from './components/omnibar/SpatialOmnibar';
import type {
  SectionPlaneConfig,
  CameraPreset,
  RenderStyle,
  ViewportEngine,
  XeokitAnnotationRecord,
  StoreyViewRecord
} from './types/viewport';
import { UploadModal } from './components/modals/UploadModal';
import { NewProjectModal } from './components/modals/NewProjectModal';
const CopilotSidebar = React.lazy(() => import('./components/copilot/CopilotSidebar').then(m => ({ default: m.CopilotSidebar })));
const FederatedModelManager = React.lazy(() => import('./components/federation/FederatedModelManager').then(m => ({ default: m.FederatedModelManager })));
const ClashInspector = React.lazy(() => import('./components/federation/ClashInspector').then(m => ({ default: m.ClashInspector })));
const BcfManagerModal = React.lazy(() => import('./components/collaboration/BcfManagerModal').then(m => ({ default: m.BcfManagerModal })));
const TimelineScrubber = React.lazy(() => import('./components/collaboration/TimelineScrubber').then(m => ({ default: m.TimelineScrubber })));
const SettingsModal = React.lazy(() => import('./components/modals/SettingsModal').then(m => ({ default: m.SettingsModal })));
const MoveCopySpecialModal = React.lazy(() => import('./components/cad/MoveCopySpecialModal').then(m => ({ default: m.MoveCopySpecialModal })));

import { loadEditorSettings, saveEditorSettings } from './services/settings';
import { DEFAULT_EDITOR_SETTINGS, type EditorSettings, type UiStyleMode } from './types/settings';
import {
  type UiProfile,
  type CustomProfileSettings,
  DEFAULT_CUSTOM_PROFILE_SETTINGS,
  getEffectiveProfileSettings
} from './types/profiles';
import type { 
  ClashRecord, 
  CadToolMode,
  BcfTopic,
  BcfTopicCreateRequest,
  AuditTimelineItem,
  AuditDiffResponse,
} from './types/ifc';
import * as api from './services/api';
import {
  CollaborationClient,
  type Collaborator,
  type ElementLock
} from './services/collaboration';
import { Lock, X } from 'lucide-react';

// QA and Diagnostics Error Trap Ring Buffer
const consoleErrorsRing: string[] = [];
if (typeof window !== 'undefined' && !(window as any).__IFC_ERROR_TRAP_INSTALLED__) {
  (window as any).__IFC_ERROR_TRAP_INSTALLED__ = true;
  const origConsoleError = console.error;
  console.error = (...args: any[]) => {
    try {
      const msg = args.map((a) => (typeof a === 'object' ? (a?.message || JSON.stringify(a)) : String(a))).join(' ');
      consoleErrorsRing.push(msg);
      if (consoleErrorsRing.length > 100) consoleErrorsRing.shift();
    } catch {
      // ignore serialization errors
    }
    origConsoleError.apply(console, args);
  };
  window.addEventListener('error', (event) => {
    consoleErrorsRing.push(`Unhandled error: ${event.message} at ${event.filename}:${event.lineno}`);
    if (consoleErrorsRing.length > 100) consoleErrorsRing.shift();
  });
  window.addEventListener('unhandledrejection', (event) => {
    consoleErrorsRing.push(`Unhandled promise rejection: ${event.reason}`);
    if (consoleErrorsRing.length > 100) consoleErrorsRing.shift();
  });
}

export const App: React.FC = () => {
  // Modal Manager: Centralized visibility and focus state
  const {
    isUploadModalOpen,
    setIsUploadModalOpen,
    isNewProjectModalOpen,
    setIsNewProjectModalOpen,
    isOmnibarOpen,
    setIsOmnibarOpen,
    isFederationOpen,
    setIsFederationOpen,
    isClashInspectorOpen,
    setIsClashInspectorOpen,
    isBcfOpen,
    setIsBcfOpen,
    isTimelineOpen,
    setIsTimelineOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    isStoreyNavOpen,
    setIsStoreyNavOpen,
    isAnnotationsOpen,
    setIsAnnotationsOpen
  } = useModalManager();

  // Forward ref callbacks for lifecycle decoupling
  const resetSelectionRef = useRef<((preserveId?: number | null) => void) | null>(null);
  const pinnedIdsLoaderRef = useRef<((pinned: Set<number>) => void) | null>(null);

  // Hook 1: Model Lifecycle & WebAssembly Worker
  const {
    currentProject,
    currentProjectRef,
    projects,
    projectsRef,
    geometries,
    spatialTree,
    setSpatialTree,
    isLoading,
    loadingStage,
    loadingPercent,
    subModels,
    hiddenModelIds,
    clashResult,
    activeClash,
    setActiveClash,
    isClashLoading,
    loadProject,
    loadProjectById,
    handleToggleModelVisibility,
    handleUploadSubModel,
    handleDeleteSubModel,
    handleRunClashCheck,
    handleLoadSampleDiscipline,
    handleFileSelected,
    handleCreateProject,
    handleDownloadProject,
    handleLoadSample
  } = useModelLifecycle({
    onResetSelection: (preserveId) => resetSelectionRef.current?.(preserveId),
    onCloseUploadModal: () => setIsUploadModalOpen(false),
    onCloseNewProjectModal: () => setIsNewProjectModalOpen(false),
    onPinnedIdsLoaded: (pinned) => pinnedIdsLoaderRef.current?.(pinned)
  });

  // Phase 5 State: Real-time Collaboration & Concurrency
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [elementLocks, setElementLocks] = useState<Record<number, ElementLock>>({});
  const [remoteTransform, setRemoteTransform] = useState<{
    expressID: number;
    matrix: number[];
  } | null>(null);
  const collabClientRef = useRef<CollaborationClient | null>(null);
  const [lockNotification, setLockNotification] = useState<{
    expressID: number;
    userName: string;
    userColor?: string;
  } | null>(null);

  // Auto-dismiss soft lock concurrency alert
  useEffect(() => {
    if (lockNotification) {
      const timer = setTimeout(() => setLockNotification(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [lockNotification]);

  // Hook 2: 3D Gizmo & Transform State Machine
  const {
    transformMode,
    setTransformMode,
    snapEnabled,
    setSnapEnabled,

    transformInfo,
    handleTransformChange,
    handleTransformEnd,
    resetTransform
  } = useGizmoTransform({
    currentProject,
    collabClientRef
  });

  // UI Panels forward declaration
  const [isPropertyOpen, setIsPropertyOpen] = useState(true);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  // Hook 2: Spatial Selection & Soft-Locking Controller
  const {
    selectedExpressID,
    setSelectedExpressID,
    isolatedExpressID,
    setIsolatedExpressID,
    hiddenCategories,

    toggleCategoryVisibility,
    pinnedExpressIds,
    setPinnedExpressIds,
    pinnedExpressIdsRef,
    selectedElementDetails,
    setSelectedElementDetails,
    storeys,
    focusTrigger,
    setFocusTrigger,

    handleSelectElement,
    handleTogglePin
  } = useSpatialSelection({
    currentProject,
    spatialTree,
    collaborators,
    elementLocks,
    collabClientRef,
    onLockNotification: setLockNotification,
    onElementSelected: (expressId) => {
      if (expressId !== null) {
        setIsPropertyOpen(true);
        setIsCopilotOpen(false);
      } else {
        resetTransform();
      }
    }
  });

  resetSelectionRef.current = (preserveId) => {
    if (preserveId !== undefined) {
      setSelectedExpressID(preserveId);
    } else {
      setSelectedExpressID(null);
    }
    setIsolatedExpressID(null);
    resetTransform();
    if (preserveId === undefined) {
      setMeasurements([]);
    }
  };
  pinnedIdsLoaderRef.current = (pinned) => setPinnedExpressIds(pinned);

  // Phase 4 State: Measurement, Sectioning, Camera Presets, Render Style
  const [isMeasureActive, setIsMeasureActive] = useState(false);
  const [measurements, setMeasurements] = useState<MeasurementRecord[]>([]);
  const [activeDimension, setActiveDimension] = useState<MeasurementRecord | null>(null);
  const [sectionConfig, setSectionConfig] = useState<SectionPlaneConfig>({
    enabled: false,
    axis: 'y',
    position: 4.0,
    inverted: false
  });
  const [cameraPresetTrigger, setCameraPresetTrigger] = useState<{
    preset: CameraPreset;
    timestamp: number;
  } | null>(null);

  const [renderStyle, setRenderStyle] = useState<RenderStyle>('shaded');



  // UI State
  const [isTreeOpen, setIsTreeOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('ifc_editor_ui_profile');
      if (saved === 'query') return true;
      if (saved === 'review' || saved === 'modify') return false;
    } catch {}
    return false;
  });
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('ifc_editor_theme');
        if (saved === 'dark' || saved === 'light') return saved;
      }
    } catch {}
    return 'light'; // Default Light theme per user instruction
  });

  // Xeokit SDK State & AEC Visualization Toolkit
  const [viewportEngine, setViewportEngine] = useState<ViewportEngine>(() => {
    try {
      const saved = localStorage.getItem('ifc_editor_viewport_engine');
      if (saved === 'xeokit' || saved === 'three') return saved;
    } catch {}
    return 'three';
  });
  const [annotations, setAnnotations] = useState<XeokitAnnotationRecord[]>(() => {
    try {
      const saved = localStorage.getItem('ifc_editor_annotations');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
// StoreyNav & Annotations modals managed by useModalManager
  const [isAnnotateMode, setIsAnnotateMode] = useState(false);
  const [xeokitStoreys, setXeokitStoreys] = useState<StoreyViewRecord[]>([]);
  const [activeStoreyId, setActiveStoreyId] = useState<string | null>(null);
  const [isolatedStoreyId, setIsolatedStoreyId] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('ifc_editor_viewport_engine', viewportEngine);
    } catch {}
  }, [viewportEngine]);

  useEffect(() => {
    try {
      localStorage.setItem('ifc_editor_annotations', JSON.stringify(annotations));
    } catch {}
  }, [annotations]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
    if (currentTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem('ifc_editor_theme', currentTheme);
    } catch {}
  }, [currentTheme]);

  const toggleTheme = useCallback(() => {
    setCurrentTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);


  const [treeWidth, setTreeWidth] = useState(288);
  const [propertyWidth, setPropertyWidth] = useState(320);
  const [copilotWidth, setCopilotWidth] = useState(384);
  const [isTreeCollapsed, setIsTreeCollapsed] = useState(false);
  const [isPropertyCollapsed, setIsPropertyCollapsed] = useState(false);

  const handleTreeWidthChange = useCallback((w: number, collapsed: boolean) => {
    setTreeWidth(w);
    setIsTreeCollapsed(collapsed);
  }, []);

  const handlePropertyWidthChange = useCallback((w: number, collapsed: boolean) => {
    setPropertyWidth(w);
    setIsPropertyCollapsed(collapsed);
  }, []);

// Modals, submodels, and clash state managed by useModalManager & useModelLifecycle



  // Phase 12 State: BCF 2.1 Issues & Collaborative Change Playback Scrubber
  const [bcfTopics, setBcfTopics] = useState<BcfTopic[]>([]);
  const [auditTimeline, setAuditTimeline] = useState<AuditTimelineItem[]>([]);
  const [auditDiff, setAuditDiff] = useState<AuditDiffResponse | null>(null);

  // Settings State & Persistence
  const [settings, setSettings] = useState<EditorSettings>(() => loadEditorSettings());

  // UI Profile State: Review | Modify | Query | Custom
  const [activeProfile, setActiveProfile] = useState<UiProfile>(() => {
    try {
      const saved = localStorage.getItem('ifc_editor_ui_profile');
      if (saved === 'review' || saved === 'modify' || saved === 'query' || saved === 'custom') {
        return saved as UiProfile;
      }
    } catch {}
    return 'modify';
  });

  const [customSettings, setCustomSettings] = useState<CustomProfileSettings>(() => {
    try {
      const saved = localStorage.getItem('ifc_editor_custom_profile_config');
      if (saved) {
        return { ...DEFAULT_CUSTOM_PROFILE_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {}
    return DEFAULT_CUSTOM_PROFILE_SETTINGS;
  });

  const effectiveProfileSettings = useMemo(() => {
    return getEffectiveProfileSettings(activeProfile, customSettings);
  }, [activeProfile, customSettings]);

  const handleSelectProfile = useCallback((newProfile: UiProfile) => {
    setActiveProfile(newProfile);
    try {
      localStorage.setItem('ifc_editor_ui_profile', newProfile);
    } catch {}
    if (newProfile === 'query') {
      setIsTreeOpen(true);
      setIsCadOpen(false);
      setActiveInteractiveMode('none');
      if (selectedExpressID !== null) {
        setIsPropertyOpen(true);
      }
    } else if (newProfile === 'review') {
      setIsTreeOpen(false);
      setIsPropertyOpen(false);
      setIsCadOpen(false);
      setActiveInteractiveMode('none');
    } else if (newProfile === 'modify') {
      setIsTreeOpen(false);
      setIsCadOpen(true);
      if (selectedExpressID !== null) {
        setIsPropertyOpen(true);
      }
    } else if (newProfile === 'custom') {
      setIsTreeOpen(customSettings.showTreeDrawer);
      setIsCadOpen(customSettings.showCadToolbar);
    }
  }, [selectedExpressID, customSettings]);

  const handleToggleTree = useCallback(() => {
    setIsTreeOpen((prev) => {
      const next = !prev;
      if (next && activeProfile === 'review') {
        handleSelectProfile('query');
      }
      return next;
    });
  }, [activeProfile, handleSelectProfile]);

  const handleUpdateCustomSettings = (partial: Partial<CustomProfileSettings>) => {
    setCustomSettings((prev) => {
      const updated = { ...prev, ...partial };
      try {
        localStorage.setItem('ifc_editor_custom_profile_config', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleUpdateSettings = useCallback((updated: EditorSettings) => {
    setSettings(updated);
    saveEditorSettings(updated);
  }, []);

  const handleResetSettings = useCallback(() => {
    setSettings(DEFAULT_EDITOR_SETTINGS);
    saveEditorSettings(DEFAULT_EDITOR_SETTINGS);
  }, []);

  // Dynamic UI Style & Frosted Glass Opacity Sync across all panels (Styles: glass, matte, outline, obsidian)
  useEffect(() => {
    const styleMode = settings.ui?.styleMode ?? 'glass';
    const opacity = settings.ui?.glassOpacity ?? 0.55;
    const root = document.documentElement;

    root.setAttribute('data-ui-style', styleMode);

    if (styleMode === 'glass') {
      // Scale blur smoothly: 0px when nearly invisible, up to 24px when opaque
      const blurPx = opacity <= 0.02 ? 0 : Math.round(opacity * 24);

      // Near 0 (lowest range): make panels completely clear/invisible without milky fog or dimming
      const panelAlpha = opacity <= 0.02 ? 0.00 : opacity;
      const cardAlpha = opacity <= 0.02 ? 0.00 : opacity * 0.85;
      const dockAlpha = opacity <= 0.02 ? 0.00 : Math.min(1.0, opacity * 1.05);
      const headerAlpha = opacity <= 0.02 ? 0.00 : opacity * 0.9;
      const borderAlpha = opacity <= 0.02 ? 0.04 : 0.04 + opacity * 0.35;
      const shadowAlpha = opacity <= 0.02 ? 0.000 : opacity * 0.12;

      root.style.setProperty('--glass-opacity', opacity.toFixed(2));
      root.style.setProperty('--glass-opacity-panel', panelAlpha.toFixed(2));
      root.style.setProperty('--glass-opacity-card', cardAlpha.toFixed(2));
      root.style.setProperty('--glass-opacity-dock', dockAlpha.toFixed(2));
      root.style.setProperty('--glass-opacity-header', headerAlpha.toFixed(2));
      root.style.setProperty('--glass-blur', `${blurPx}px`);
      root.style.setProperty('--glass-border-alpha', borderAlpha.toFixed(2));
      root.style.setProperty('--glass-shadow-alpha', shadowAlpha.toFixed(3));
    } else if (styleMode === 'matte') {
      // Solid opaque architectural CAD panels, 0 blur, clean borders
      root.style.setProperty('--glass-opacity', '1.00');
      root.style.setProperty('--glass-opacity-panel', '1.00');
      root.style.setProperty('--glass-opacity-card', '0.98');
      root.style.setProperty('--glass-opacity-dock', '1.00');
      root.style.setProperty('--glass-opacity-header', '0.98');
      root.style.setProperty('--glass-blur', '0px');
      root.style.setProperty('--glass-border-alpha', '0.80');
      root.style.setProperty('--glass-shadow-alpha', '0.12');
    } else if (styleMode === 'obsidian') {
      // Pure deep pitch OLED surfaces with electric high contrast borders
      root.style.setProperty('--glass-opacity', '0.98');
      root.style.setProperty('--glass-opacity-panel', '0.98');
      root.style.setProperty('--glass-opacity-card', '0.96');
      root.style.setProperty('--glass-opacity-dock', '1.00');
      root.style.setProperty('--glass-opacity-header', '0.98');
      root.style.setProperty('--glass-blur', '0px');
      root.style.setProperty('--glass-border-alpha', '0.50');
      root.style.setProperty('--glass-shadow-alpha', '0.25');
    } else if (styleMode === 'cyber-bim') {
      // Cyber-BIM HUD (FUI): High-tech telemetry with neon cyan glow & wireframe markers
      root.style.setProperty('--glass-opacity', '0.88');
      root.style.setProperty('--glass-opacity-panel', '0.88');
      root.style.setProperty('--glass-opacity-card', '0.92');
      root.style.setProperty('--glass-opacity-dock', '0.94');
      root.style.setProperty('--glass-opacity-header', '0.90');
      root.style.setProperty('--glass-blur', '14px');
      root.style.setProperty('--glass-border-alpha', '0.75');
      root.style.setProperty('--glass-shadow-alpha', '0.35');
    } else if (styleMode === 'spatial') {
      // Spatial VisionOS: Deep 32px progressive blur with specular rim lighting & floating pill depth
      root.style.setProperty('--glass-opacity', '0.45');
      root.style.setProperty('--glass-opacity-panel', '0.45');
      root.style.setProperty('--glass-opacity-card', '0.52');
      root.style.setProperty('--glass-opacity-dock', '0.58');
      root.style.setProperty('--glass-opacity-header', '0.48');
      root.style.setProperty('--glass-blur', '32px');
      root.style.setProperty('--glass-border-alpha', '0.45');
      root.style.setProperty('--glass-shadow-alpha', '0.20');
    } else if (styleMode === 'bento') {
      // Technical Bento Grid: High-density modular dashboard tiles, 8px micro-grid spacing
      root.style.setProperty('--glass-opacity', '0.94');
      root.style.setProperty('--glass-opacity-panel', '0.94');
      root.style.setProperty('--glass-opacity-card', '0.96');
      root.style.setProperty('--glass-opacity-dock', '0.98');
      root.style.setProperty('--glass-opacity-header', '0.96');
      root.style.setProperty('--glass-blur', '16px');
      root.style.setProperty('--glass-border-alpha', '0.85');
      root.style.setProperty('--glass-shadow-alpha', '0.10');
    }
  }, [settings.ui?.styleMode, settings.ui?.glassOpacity]);

  const handleUpdateGlassOpacity = useCallback((opacity: number) => {
    setSettings((prev) => {
      const updated: EditorSettings = {
        ...prev,
        ui: {
          styleMode: 'glass',
          ...prev.ui,
          glassOpacity: opacity
        }
      };
      saveEditorSettings(updated);
      return updated;
    });
  }, []);

  const handleUpdateUiStyleMode = useCallback((styleMode: UiStyleMode) => {
    setSettings((prev) => {
      const defaultOpacity =
        styleMode === 'spatial'
          ? 0.45
          : styleMode === 'cyber-bim'
          ? 0.88
          : styleMode === 'matte'
          ? 1.0
          : 0.55;
      const updated: EditorSettings = {
        ...prev,
        ui: {
          glassOpacity: defaultOpacity,
          ...prev.ui,
          styleMode
        }
      };
      saveEditorSettings(updated);
      return updated;
    });
  }, []);

  // Xeokit Handlers: 3D Annotations & BIM Storeys
  const handleSelectAnnotation = useCallback((id: string) => {
    const target = annotations.find((a) => a.id === id);
    if (target && target.expressId) {
      setSelectedExpressID(target.expressId);
    }
  }, [annotations]);

  const handleAddAnnotationPoint = useCallback((point: [number, number, number], expressId?: number) => {
    const newRecord: XeokitAnnotationRecord = {
      id: `pin_${Date.now()}`,
      expressId,
      worldPos: point,
      title: expressId ? `Issue on Element #${expressId}` : `Spatial Pin #${annotations.length + 1}`,
      description: 'Recorded in Xeokit 3D AEC Viewport',
      priority: 'medium',
      author: 'AEC Engineer',
      createdAt: new Date().toISOString()
    };
    setAnnotations((prev) => [...prev, newRecord]);
    setIsAnnotateMode(false);
    setIsAnnotationsOpen(true);
  }, [annotations.length]);

  const handleDeleteAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleConvertAnnotationToBcf = useCallback(async (ann: XeokitAnnotationRecord) => {
    if (!currentProject) return;
    try {
      await api.createBcfTopic(currentProject.id, {
        title: ann.title,
        description: ann.description,
        topic_type: 'Issue',
        priority: ann.priority === 'critical' ? 'Critical' : ann.priority === 'high' ? 'High' : 'Normal',
        camera_position: [ann.worldPos[0] + 5, ann.worldPos[1] + 5, ann.worldPos[2] + 5],
        camera_target: ann.worldPos,
        selected_elements: ann.expressId ? [ann.expressId] : []
      });
      if (currentProject) {
        const topics = await api.fetchBcfTopics(currentProject.id);
        setBcfTopics(topics);
      }
      setIsBcfOpen(true);
    } catch (err) {
      console.warn('Could not convert annotation to BCF:', err);
    }
  }, [currentProject]);

// Web Worker managed by useModelLifecycle

  // Initialize WebSocket Collaboration on Project Change
  useEffect(() => {
    if (!currentProject) return;

    if (collabClientRef.current) {
      collabClientRef.current.disconnect();
    }

    const client = new CollaborationClient(currentProject.id, {
      onRoomState: (users, locks) => {
        setCollaborators(users);
        setElementLocks(locks);
      },
      onUserJoined: (user) => {
        setCollaborators((prev) => [...prev.filter((u) => u.user_id !== user.user_id), user]);
      },
      onUserLeft: (userId) => {
        setCollaborators((prev) => prev.filter((u) => u.user_id !== userId));
      },
      onElementLocked: (expressId, lock) => {
        setElementLocks((prev) => ({ ...prev, [expressId]: lock }));
      },
      onElementUnlocked: (expressId) => {
        setElementLocks((prev) => {
          const next = { ...prev };
          delete next[expressId];
          return next;
        });
      },
      onLockRejected: (expressId, heldBy) => {
        const myUserId = collabClientRef.current?.profile.userId || localStorage.getItem('ifc_editor_user_id');
        if (heldBy && heldBy.user_id !== myUserId) {
          setLockNotification({
            expressID: expressId,
            userName: heldBy.user_name || 'another user',
            userColor: heldBy.user_color
          });
          setSelectedExpressID(null);
        }
      },
      onRemoteTransformStream: (expressId, matrix) => {
        setRemoteTransform({ expressID: expressId, matrix });
      },
      onRemoteTransformCommitted: (expressId, matrix) => {
        setRemoteTransform({ expressID: expressId, matrix });
      }
    });

    client.connect();
    collabClientRef.current = client;

    return () => {
      client.disconnect();
    };
  }, [currentProject]);

// Sub-models, worker parsing & project initialization managed by useModelLifecycle


  const handleToggleCopilot = useCallback(() => {
    setIsCopilotOpen((prev) => {
      const next = !prev;
      if (next) setIsPropertyOpen(false);
      return next;
    });
  }, []);

  const handleToggleProperty = useCallback(() => {
    setIsPropertyOpen((prev) => {
      const next = !prev;
      if (next) setIsCopilotOpen(false);
      return next;
    });
  }, []);



  // Measurement Handlers
  const handleAddMeasurement = useCallback((record: MeasurementRecord) => {
    setMeasurements((prev) => [...prev, record]);
    setActiveDimension(record);
  }, []);

  const handleClearMeasurements = useCallback(() => {
    setMeasurements([]);
    setActiveDimension(null);
  }, []);

  const handleDeleteMeasurement = useCallback((id: string) => {
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
    setActiveDimension((prev) => (prev?.id === id ? null : prev));
  }, []);

  // Camera Preset Handler
  const handleCameraPreset = useCallback((preset: CameraPreset) => {
    setCameraPresetTrigger({ preset, timestamp: Date.now() });
  }, []);

// Project upload, creation, export and sample loading managed by useModelLifecycle

  // Hook 3: Parametric CAD & Drafting State Machine
  const {
    cadToolMode,
    setCadToolMode,
    activeInteractiveMode,
    setActiveInteractiveMode,
    isMoveCopySpecialOpen,
    setIsMoveCopySpecialOpen,
    specialPickedPoints,
    setSpecialPickedPoints,
    cadWallHeight,
    setCadWallHeight,
    cadWallThickness,
    setCadWallThickness,
    cadCanUndo,
    cadCanRedo,
    cadHistory,
    isCadOpen,
    setIsCadOpen,
    refreshCadHistory,
    handleCadDrawWall,
    handleCadDrawSlab,
    handleCadDrawColumn,
    handleCadDrawOpening,
    handleCadUndo,
    handleCadRedo,
    handleDeleteElement,
    handleMoveElement,
    handleRotateElement,
    handleMirrorElement,
    handleArrayElement,
    handleAlignElement,
    handleCloneElement,
    handleUpdateGeometry,
    handleAssignStorey,
    handleAssignMaterial
  } = useCadDraftingMachine({
    currentProject,
    selectedExpressID,
    pinnedExpressIdsRef,
    loadProject,
    onSelectElement: setSelectedExpressID,
    onSpatialTreeUpdated: setSpatialTree,
    onElementDetailsUpdated: setSelectedElementDetails
  });

  // Reset interactive CAD mode when selection is cleared
  useEffect(() => {
    if (selectedExpressID === null) {
      setActiveInteractiveMode('none');
    }
  }, [selectedExpressID, setActiveInteractiveMode]);

  // Handle AI Copilot Model Modification Refresh
  const handleModelModifiedByCopilot = useCallback(() => {
    if (currentProject) {
      loadProject(currentProject);
    }
  }, [currentProject, loadProject]);

  // Handle Omnibar Tool Actions
  const handleTriggerTool = useCallback(
    (toolId: string) => {
      switch (toolId) {
        case 'measure':
          setIsMeasureActive((prev) => !prev);
          break;
        case 'section':
          setSectionConfig((prev) => ({ ...prev, enabled: !prev.enabled }));
          break;
        case 'copilot':
          setIsCopilotOpen(true);
          setIsPropertyOpen(false);
          break;
        case 'export':
          handleDownloadProject();
          break;
      }
    },
    [handleDownloadProject]
  );

  // Two-key sequence buffer for Revit standard shortcuts (RO, MM, DM, AR, AL, PN, UP, MV, CO)
  const revitKeyBufferRef = useRef<string>('');
  const revitKeyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Global Keyboard Shortcuts for CAD & BIM Editing (Ctrl+Z, Ctrl+Y, Delete, Ctrl+D, Revit RO/MM/AR/AL/PN/UP)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleCadRedo();
        } else {
          handleCadUndo();
        }
        return;
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleCadRedo();
        return;
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedExpressID !== null) {
          e.preventDefault();
          handleDeleteElement(selectedExpressID);
        }
        return;
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (selectedExpressID !== null) {
          e.preventDefault();
          handleCloneElement(selectedExpressID);
        }
        return;
      } else if ((e.ctrlKey || e.metaKey) && (e.key === ',' || e.key === '<')) {
        e.preventDefault();
        setIsSettingsOpen((prev) => !prev);
        return;
      }

      // Autodesk Revit 2-letter Sequence Shortcuts
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        const char = e.key.toLowerCase();
        revitKeyBufferRef.current += char;

        if (revitKeyTimerRef.current) clearTimeout(revitKeyTimerRef.current);
        revitKeyTimerRef.current = setTimeout(() => {
          revitKeyBufferRef.current = '';
        }, 800);

        const seq = revitKeyBufferRef.current;
        if (seq === 'ro') {
          revitKeyBufferRef.current = '';
          if (selectedExpressID !== null) {
            handleRotateElement(selectedExpressID, 90, 'z');
          }
        } else if (seq === 'mm' || seq === 'dm') {
          revitKeyBufferRef.current = '';
          if (selectedExpressID !== null) {
            handleMirrorElement(selectedExpressID, 'x', true);
          }
        } else if (seq === 'ar') {
          revitKeyBufferRef.current = '';
          if (selectedExpressID !== null) {
            handleArrayElement(selectedExpressID, 3, [2.0, 0, 0]);
          }
        } else if (seq === 'al') {
          revitKeyBufferRef.current = '';
          if (selectedExpressID !== null) {
            handleAlignElement(selectedExpressID, 'z', 0.0);
          }
        } else if (seq === 'pn') {
          revitKeyBufferRef.current = '';
          if (selectedExpressID !== null && !pinnedExpressIds.has(selectedExpressID)) {
            handleTogglePin(selectedExpressID);
          }
        } else if (seq === 'up') {
          revitKeyBufferRef.current = '';
          if (selectedExpressID !== null && pinnedExpressIds.has(selectedExpressID)) {
            handleTogglePin(selectedExpressID);
          }
        } else if (seq === 'mv') {
          revitKeyBufferRef.current = '';
          setTransformMode('translate');
        } else if (seq === 'co' || seq === 'cc') {
          revitKeyBufferRef.current = '';
          if (selectedExpressID !== null) {
            handleCloneElement(selectedExpressID);
          }
        } else if (seq.length >= 2) {
          revitKeyBufferRef.current = '';
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleCadUndo,
    handleCadRedo,
    handleDeleteElement,
    handleCloneElement,
    handleRotateElement,
    handleMirrorElement,
    handleArrayElement,
    handleAlignElement,
    handleTogglePin,
    selectedExpressID,
    pinnedExpressIds
  ]);

  // Global ESC Key Handling: Clear selection, close floating HUDs, cancel tools
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.code === 'Escape' || e.keyCode === 27) {
        // If modals or command palette are open, let their own handlers manage dismissal
        if (isOmnibarOpen || isUploadModalOpen || isNewProjectModalOpen || isBcfOpen || isFederationOpen || isSettingsOpen) {
          if (isSettingsOpen) setIsSettingsOpen(false);
          return;
        }

        // Priority 1: Clear selected elements if any are selected
        if (selectedExpressID !== null) {
          handleSelectElement(null);
          return;
        }

        // Priority 2: Close Dimension Info HUD if open
        if (activeDimension !== null) {
          setActiveDimension(null);
          return;
        }

        // Priority 3: Cancel active measurement mode
        if (isMeasureActive) {
          setIsMeasureActive(false);
          return;
        }

        // Priority 4: Revert CAD tool mode to select
        if (cadToolMode !== 'select') {
          setCadToolMode('select');
          return;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOmnibarOpen,
    isUploadModalOpen,
    isNewProjectModalOpen,
    isBcfOpen,
    isFederationOpen,
    selectedExpressID,
    handleSelectElement,
    activeDimension,
    isMeasureActive,
    cadToolMode
  ]);

  // Phase 12 Handlers: BCF 2.1 Issues & Audit Playback
  const refreshBcfTopics = useCallback(async () => {
    if (!currentProject) {
      setBcfTopics([]);
      return;
    }
    try {
      const topics = await api.fetchBcfTopics(currentProject.id);
      setBcfTopics(topics);
    } catch (err) {
      console.warn('Could not fetch BCF topics:', err);
    }
  }, [currentProject]);

  const refreshAuditData = useCallback(async () => {
    if (!currentProject) {
      setAuditTimeline([]);
      setAuditDiff(null);
      return;
    }
    try {
      const timeline = await api.fetchAuditTimeline(currentProject.id);
      setAuditTimeline(timeline);
      const diff = await api.fetchAuditDiff(currentProject.id);
      setAuditDiff(diff);
    } catch (err) {
      console.warn('Could not fetch audit data:', err);
    }
  }, [currentProject]);

  useEffect(() => {
    if (currentProject) {
      refreshBcfTopics();
      refreshAuditData();
    }
  }, [currentProject, refreshBcfTopics, refreshAuditData]);

  const handleCreateBcfTopic = useCallback(async (req: BcfTopicCreateRequest) => {
    if (!currentProject) return;
    try {
      await api.createBcfTopic(currentProject.id, req);
      await refreshBcfTopics();
    } catch (err) {
      console.error('Failed to create BCF topic:', err);
      throw err;
    }
  }, [currentProject, refreshBcfTopics]);

  const handleImportClashesToBcf = useCallback(async (clashes: ClashRecord[]) => {
    if (!currentProject) return [];
    try {
      const created = await api.importClashesToBcf(currentProject.id, clashes);
      await refreshBcfTopics();
      return created;
    } catch (err) {
      console.error('Failed to import clashes to BCF:', err);
      throw err;
    }
  }, [currentProject, refreshBcfTopics]);

  const handleSelectBcfTopic = useCallback((topic: BcfTopic) => {
    if (topic.selected_elements && topic.selected_elements.length > 0) {
      setSelectedExpressID(topic.selected_elements[0]);
    }
  }, []);

  // Dev-only QA Bridge for Live Agent Browser Automation
  const latestStateRef = useRef<Record<string, unknown>>({});
  latestStateRef.current = {
    currentProject: currentProjectRef.current || currentProject,
    selectedExpressID,
    isTreeOpen,
    isPropertyOpen,
    isCopilotOpen,
    isMeasureActive,
    measurementCount: measurements.length,
    activeDimension: activeDimension
      ? {
          id: activeDimension.id,
          distance: activeDimension.distance,
          dx: Math.abs(activeDimension.end[0] - activeDimension.start[0]),
          dy: Math.abs(activeDimension.end[1] - activeDimension.start[1]),
          dz: Math.abs(activeDimension.end[2] - activeDimension.start[2])
        }
      : null,
    sectionConfig,
    transformMode,
    renderStyle,
    snapEnabled,
    hiddenCategories: Array.from(hiddenCategories),
    isolatedExpressID,
    loadingStage,
    loadingPercent,
    isLoading,
    isOmnibarOpen,
    isUploadModalOpen,
    isNewProjectModalOpen,
    projectsCount: (projectsRef.current && projectsRef.current.length > 0 ? projectsRef.current : projects).length,
    projects: (projectsRef.current && projectsRef.current.length > 0 ? projectsRef.current : projects),
    collaborators,
    geometriesCount: geometries.length,
    subModelsCount: subModels.length,
    subModels,
    isFederationOpen,
    isClashInspectorOpen,
    clashResult,
    activeClash,
    isCadOpen,
    cadToolMode,
    cadCanUndo,
    cadCanRedo,
    cadHistoryCount: cadHistory.length,
    cadHistory,
    isBcfOpen,
    bcfTopicsCount: bcfTopics.length,
    bcfTopics,
    isTimelineOpen,
    auditTimelineCount: auditTimeline.length,
    auditTimeline,
    auditDiff,
    pinnedExpressIds: Array.from(pinnedExpressIds),
    firstExpressID: geometries.length > 0 ? geometries[0].expressID : 128,
    settings,
    isSettingsOpen,
    activeProfile,
    effectiveProfileSettings,
    viewportEngine,
    annotationsCount: annotations.length,
    annotations,
    isStoreyNavOpen,
    isAnnotationsOpen,
    xeokitStoreys
  };

  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as any).__IFC_QA_BRIDGE__ = {
        getState: () => ({
          ...latestStateRef.current,
          currentProject: currentProjectRef.current || currentProject,
          projects: projectsRef.current && projectsRef.current.length > 0 ? projectsRef.current : projects
        }),
        getFirstExpressId: () => (geometries.length > 0 ? geometries[0].expressID : 128),
        getProfile: () => activeProfile,
        setProfile: (p: UiProfile) => handleSelectProfile(p),
        updateCustomSettings: (cfg: Partial<CustomProfileSettings>) => handleUpdateCustomSettings(cfg),
        openSettingsModal: () => setIsSettingsOpen(true),
        closeSettingsModal: () => setIsSettingsOpen(false),
        updateSettings: (s: EditorSettings) => handleUpdateSettings(s),
        resetSettings: () => handleResetSettings(),
        setGlassOpacity: (op: number) => handleUpdateGlassOpacity(op),
        setUiStyleMode: (mode: UiStyleMode) => handleUpdateUiStyleMode(mode),
        selectElement: (expressID: number | null) => handleSelectElement(expressID),
        setTransformMode: (mode: TransformMode) => setTransformMode(mode),
        setSectionConfig: (config: Partial<SectionPlaneConfig>) => setSectionConfig((prev) => ({ ...prev, ...config })),
        setRenderStyle: (style: RenderStyle) => setRenderStyle(style),
        getRenderStyle: () => latestStateRef.current.renderStyle,
        setSnapEnabled: (snap: boolean) => setSnapEnabled(snap),
        toggleCategory: (cat: string) => toggleCategoryVisibility(cat),
        setIsolate: (expressID: number | null) => setIsolatedExpressID(expressID),
        toggleTree: (open?: boolean) => setIsTreeOpen((prev) => (open !== undefined ? open : !prev)),
        toggleProperty: (open?: boolean) => setIsPropertyOpen((prev) => (open !== undefined ? open : !prev)),
        toggleCopilot: (open?: boolean) => setIsCopilotOpen((prev) => (open !== undefined ? open : !prev)),
        openOmnibar: () => setIsOmnibarOpen(true),
        closeOmnibar: () => setIsOmnibarOpen(false),
        clearMeasurements: () => {
          setMeasurements([]);
          setActiveDimension(null);
        },
        closeDimensionInfo: () => setActiveDimension(null),
        selectDimension: (id: string) => {
          const f = measurements.find((m) => m.id === id);
          if (f) setActiveDimension(f);
        },
        setMeasureActive: (active: boolean) => setIsMeasureActive(active),
        triggerCameraPreset: (preset: CameraPreset) => handleCameraPreset(preset),
        openFederationModal: () => setIsFederationOpen(true),
        closeFederationModal: () => setIsFederationOpen(false),
        openClashInspector: () => setIsClashInspectorOpen(true),
        closeClashInspector: () => setIsClashInspectorOpen(false),
        runClashCheck: async (tolerance = 0.01) => handleRunClashCheck(tolerance),
        setActiveClash: (clash: ClashRecord | null) => setActiveClash(clash),
        toggleModelVisibility: (modelId: string) => handleToggleModelVisibility(modelId),
        openCadToolbar: () => {
          setActiveProfile('modify');
          setIsCadOpen(true);
          refreshCadHistory();
        },
        closeCadToolbar: () => {
          setIsCadOpen(false);
        },
        setCadMode: (mode: CadToolMode) => setCadToolMode(mode),
        triggerCadUndo: () => handleCadUndo(),
        triggerCadRedo: () => handleCadRedo(),
        drawCadWall: (start: [number, number], end: [number, number]) => handleCadDrawWall(start, end),
        drawCadSlab: (c1: [number, number], c2: [number, number]) => handleCadDrawSlab(c1, c2),
        drawCadColumn: (pos: [number, number]) => handleCadDrawColumn(pos),
        drawCadOpening: (wallId: number, offset: number, type?: 'door' | 'window') => handleCadDrawOpening(wallId, offset, type),
        getCadHistory: () => cadHistory,
        // Revit Modification Tools
        moveElement: async (id: number, delta: [number, number, number]) => handleMoveElement(id, delta),
        rotateElement: async (id: number, deg: number = 90, axis: 'x' | 'y' | 'z' = 'z') => handleRotateElement(id, deg, axis),
        mirrorElement: async (id: number, axis: 'x' | 'y' | 'z' = 'x', isCopy: boolean = false) => handleMirrorElement(id, axis, isCopy),
        arrayElement: async (id: number, count: number = 3, delta: [number, number, number] = [2.0, 0, 0]) => handleArrayElement(id, count, delta),
        alignElement: async (id: number, axis: 'x' | 'y' | 'z' = 'z', val: number = 0.0) => handleAlignElement(id, axis, val),
        togglePin: async (id: number) => handleTogglePin(id),
        getPinnedIds: () => Array.from(pinnedExpressIdsRef.current),
        openBcfModal: () => {
          setIsBcfOpen(true);
          refreshBcfTopics();
        },
        closeBcfModal: () => setIsBcfOpen(false),
        createBcfTopic: async (req: BcfTopicCreateRequest) => handleCreateBcfTopic(req),
        importClashesToBcf: async () => {
          if (clashResult && clashResult.clashes.length > 0) {
            return handleImportClashesToBcf(clashResult.clashes);
          }
          return [];
        },
        getBcfExportUrl: () => (currentProject ? api.getBcfExportUrl(currentProject.id) : null),
        openTimelineScrubber: () => {
          setIsTimelineOpen(true);
          refreshAuditData();
        },
        closeTimelineScrubber: () => setIsTimelineOpen(false),
        fetchAuditDiff: async () => {
          if (!currentProject) return null;
          const diff = await api.fetchAuditDiff(currentProject.id);
          setAuditDiff(diff);
          return diff;
        },
        addMeasurement: (start: [number, number, number], end: [number, number, number]) => {
          const dx = end[0] - start[0];
          const dy = end[1] - start[1];
          const dz = end[2] - start[2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const mid: [number, number, number] = [
            (start[0] + end[0]) / 2,
            (start[1] + end[1]) / 2,
            (start[2] + end[2]) / 2
          ];
          const record: MeasurementRecord = {
            id: `measure_${Date.now()}`,
            start,
            end,
            distance: dist,
            midpoint: mid
          };
          handleAddMeasurement(record);
        },
        loadProjectById: (projectId: string) => loadProjectById(projectId),
        openUploadModal: () => setIsUploadModalOpen(true),
        closeUploadModal: () => setIsUploadModalOpen(false),
        openNewProjectModal: () => setIsNewProjectModalOpen(true),
        closeNewProjectModal: () => setIsNewProjectModalOpen(false),
        triggerSoftLock: (expressId: number, userName: string) =>
          setLockNotification({ expressID: expressId, userName, userColor: undefined }),
        dismissSoftLock: () => setLockNotification(null),
        setCadWallParams: (params: { height?: number; thickness?: number }) => {
          if (params.height !== undefined) setCadWallHeight(params.height);
          if (params.thickness !== undefined) setCadWallThickness(params.thickness);
        },
        getViewportEngine: () => viewportEngine,
        setViewportEngine: (engine: ViewportEngine) => setViewportEngine(engine),
        toggleStoreyNavigator: (open?: boolean) => setIsStoreyNavOpen((prev) => (open !== undefined ? open : !prev)),
        toggleAnnotationsHud: (open?: boolean) => setIsAnnotationsOpen((prev) => (open !== undefined ? open : !prev)),
        addAnnotation: (title: string, description: string, worldPos: [number, number, number], expressId?: number) => {
          const newAnn: XeokitAnnotationRecord = {
            id: `pin_${Date.now()}`,
            title,
            description,
            worldPos,
            expressId,
            priority: 'medium',
            author: 'QA Runner',
            createdAt: new Date().toISOString()
          };
          setAnnotations((prev) => [...prev, newAnn]);
          return newAnn;
        },
        getAnnotations: () => annotations,
        getStoreys: () => xeokitStoreys,
        selectStorey: (storeyId: string) => setActiveStoreyId(storeyId),
        isolateStorey: (storeyId: string) => setIsolatedStoreyId(storeyId),
        // Automated QA Diagnostics & Regression Gates
        getConsoleErrors: () => [...consoleErrorsRing],
        clearConsoleErrors: () => {
          consoleErrorsRing.length = 0;
        },
        getXeokitSceneStats: () => {
          const viewer = (window as any).__XEOKIT_VIEWER__;
          if (!viewer || !viewer.scene) {
            return { active: false, numEntities: 0, modelsCount: 0, modelIds: [] };
          }
          const modelKeys = Object.keys(viewer.scene.models || {});
          let totalEntities = 0;
          for (const mId of modelKeys) {
            const m = viewer.scene.models[mId];
            if (m && typeof m.numEntities === 'number') {
              totalEntities += m.numEntities;
            }
          }
          const objectsCount = Object.keys(viewer.scene.objects || {}).length;
          const entityCount = totalEntities > 0 ? totalEntities : objectsCount;
          return {
            active: true,
            numEntities: entityCount,
            modelsCount: modelKeys.length,
            modelIds: modelKeys
          };
        },
        checkSpatialCollisions: () => {
          const floatingSelectors = [
            { name: 'NavCube', selector: '[data-qa="xeokit-navcube-card"]' },
            { name: 'TelemetryHUD', selector: '[data-qa="xeokit-telemetry-hud"]' },
            { name: 'BottomDock', selector: '[data-qa="spatial-bottom-dock"], [data-qa-dock="glass-bottom-dock"]' },
            { name: 'CADToolbar', selector: '[data-qa="cad-floating-toolbar"]' }
          ];
          const panelSelectors = [
            { name: 'SpatialTree', selector: '[data-qa="glass-spatial-tree"]' },
            { name: 'PropertyInspector', selector: '[data-qa="glass-property-inspector"]' },
            { name: 'CopilotSidebar', selector: '[data-qa="copilot-sidebar"]' },
            { name: 'StoreyNavigator', selector: '[data-qa="storey-navigator-hud"]' },
            { name: 'AnnotationsHUD', selector: '[data-qa="annotations-hud"]' }
          ];

          const overlaps: Array<{ floating: string; panel: string; intersectionArea: number }> = [];

          const floatings = floatingSelectors
            .map((item) => ({
              name: item.name,
              el: document.querySelector(item.selector) as HTMLElement | null
            }))
            .filter((item) => item.el && item.el.offsetParent !== null);

          const panels = panelSelectors
            .map((item) => ({
              name: item.name,
              el: document.querySelector(item.selector) as HTMLElement | null
            }))
            .filter((item) => item.el && item.el.offsetParent !== null);

          for (const f of floatings) {
            const fRect = f.el!.getBoundingClientRect();
            for (const p of panels) {
              if (f.el === p.el || f.el!.contains(p.el!) || p.el!.contains(f.el!)) continue;
              const pRect = p.el!.getBoundingClientRect();

              const xOverlap = Math.max(0, Math.min(fRect.right, pRect.right) - Math.max(fRect.left, pRect.left));
              const yOverlap = Math.max(0, Math.min(fRect.bottom, pRect.bottom) - Math.max(fRect.top, pRect.top));
              const area = xOverlap * yOverlap;

              // 1.0 px tolerance for sub-pixel anti-aliasing / layout rounding
              if (area > 1.0) {
                overlaps.push({
                  floating: f.name,
                  panel: p.name,
                  intersectionArea: Math.round(area)
                });
              }
            }
          }

          return {
            hasCollisions: overlaps.length > 0,
            collisionCount: overlaps.length,
            collisions: overlaps
          };
        }
      };
    }
  }, [
    currentProject,
    selectedExpressID,
    pinnedExpressIds,
    handleMoveElement,
    handleRotateElement,
    handleMirrorElement,
    handleArrayElement,
    handleAlignElement,
    handleTogglePin,
    isTreeOpen,
    isPropertyOpen,
    isCopilotOpen,
    isMeasureActive,
    measurements,
    activeDimension,
    handleAddMeasurement,
    sectionConfig,
    transformMode,
    renderStyle,
    snapEnabled,
    hiddenCategories,
    isolatedExpressID,
    loadingStage,
    loadingPercent,
    isLoading,
    isOmnibarOpen,
    isUploadModalOpen,
    isNewProjectModalOpen,
    projects,
    geometries,
    subModels,
    isFederationOpen,
    isClashInspectorOpen,
    clashResult,
    activeClash,
    handleRunClashCheck,
    handleToggleModelVisibility,
    isCadOpen,
    cadToolMode,
    cadCanUndo,
    cadCanRedo,
    cadHistory,
    refreshCadHistory,
    handleCadUndo,
    handleCadRedo,
    handleCadDrawWall,
    handleCadDrawSlab,
    handleCadDrawColumn,
    handleCadDrawOpening,
    isBcfOpen,
    bcfTopics,
    isTimelineOpen,
    auditTimeline,
    auditDiff,
    refreshBcfTopics,
    refreshAuditData,
    handleCreateBcfTopic,
    handleImportClashesToBcf,
    annotations,
    xeokitStoreys,
    viewportEngine
  ]);

  const isRightDrawerOpen = Boolean((isPropertyOpen && selectedExpressID !== null) || isCopilotOpen);
  const activeRightDrawerWidth = isCopilotOpen ? copilotWidth : propertyWidth;

  const leftOffset = isTreeOpen ? (isTreeCollapsed ? 56 : treeWidth) : 0;
  const propOffset = isPropertyOpen ? (isPropertyCollapsed ? 56 : propertyWidth) : 0;
  const copilotOffset = isCopilotOpen ? copilotWidth : 0;
  const rightOffset = propOffset + copilotOffset;

  return (
    <div
      className="relative w-screen h-screen overflow-hidden flex flex-col font-sans select-none text-slate-800 dark:text-slate-100"
      style={{
        background: 'var(--glass-bg-gradient)'
      }}
      data-qa="modern-glass-root"
      data-qa-worker-status={isLoading ? (loadingStage.toLowerCase().includes('generat') ? 'generating' : 'parsing') : 'ready'}
      data-qa-selected-id={selectedExpressID ?? ''}
      data-qa-project-name={currentProject?.name ?? ''}
      data-qa-project-schema={currentProject?.schema_version ?? ''}
      data-qa-measure-active={isMeasureActive ? 'true' : 'false'}
      data-qa-measure-count={measurements.length}
      data-qa-transform-mode={transformMode}
      data-qa-section-active={sectionConfig.enabled ? 'true' : 'false'}
      data-qa-render-style={renderStyle}
      data-qa-submodel-count={subModels.length}
      data-qa-clash-count={clashResult?.total_clashes ?? 0}
      data-qa-federation-open={isFederationOpen ? 'true' : 'false'}
      data-qa-clash-open={isClashInspectorOpen ? 'true' : 'false'}
      data-qa-cad-open={isCadOpen ? 'true' : 'false'}
      data-qa-cad-mode={cadToolMode}
      data-qa-cad-history-count={cadHistory.length}
      data-qa-bcf-open={isBcfOpen ? 'true' : 'false'}
      data-qa-bcf-count={bcfTopics.length}
      data-qa-timeline-open={isTimelineOpen ? 'true' : 'false'}
      data-qa-audit-count={auditTimeline.length}
      data-qa-ui-profile={activeProfile}
    >
      {/* 1. 100% Viewport Canvas (Full window immersion underneath all glass panels) */}
      <div
        className="absolute inset-0 w-full h-full overflow-hidden z-0"
        data-qa-worker-status={isLoading ? (loadingStage.toLowerCase().includes('generat') ? 'generating' : 'parsing') : 'ready'}
        data-qa-viewport-engine={viewportEngine}
      >
        {viewportEngine === 'xeokit' ? (
          <React.Suspense fallback={<div className="w-full h-full flex items-center justify-center text-xs text-slate-400">Loading Xeokit Engine...</div>}>
            <XeokitViewport
            geometries={geometries}
            selectedExpressID={selectedExpressID}
            onSelectElement={handleSelectElement}
            isolatedExpressID={isolatedExpressID}
            hiddenCategories={hiddenCategories}
            theme={currentTheme}
            sectionConfig={sectionConfig}
            cameraPresetTrigger={cameraPresetTrigger}
            renderStyle={renderStyle}
            spatialTree={spatialTree}
            annotations={annotations}
            onSelectAnnotation={handleSelectAnnotation}
            onAddAnnotationPoint={handleAddAnnotationPoint}
            isAnnotateMode={isAnnotateMode}
            onStoreysLoaded={(st) => setXeokitStoreys(st)}
            activeStoreyId={activeStoreyId}
            leftOffset={leftOffset}
            rightOffset={rightOffset}
          />
          </React.Suspense>
        ) : (
          <ThreeViewport
            theme={currentTheme}
            settings={settings}
            geometries={geometries}
            selectedExpressID={selectedExpressID}
            onSelectElement={handleSelectElement}
            hiddenCategories={hiddenCategories}
            isolatedExpressID={isolatedExpressID}
            hiddenModelIds={hiddenModelIds}
            activeClash={activeClash}
            auditDiff={auditDiff}
            transformMode={transformMode}
            onSetTransformMode={setTransformMode}
            snapEnabled={snapEnabled}
            onTransformEnd={handleTransformEnd}
            onTransformChange={handleTransformChange}
            isMeasureActive={isMeasureActive}
            measurements={measurements}
            onAddMeasurement={handleAddMeasurement}
            onSelectMeasurement={setActiveDimension}
            onCancelMeasure={() => setIsMeasureActive(false)}
            sectionConfig={sectionConfig}
            cameraPresetTrigger={cameraPresetTrigger}
            onCameraPreset={handleCameraPreset}
            renderStyle={renderStyle}
            elementLocks={elementLocks}
            remoteTransform={remoteTransform}
            isRightDrawerOpen={isRightDrawerOpen}
            rightDrawerWidth={activeRightDrawerWidth}
            cadToolMode={cadToolMode}
            onCadDrawWall={handleCadDrawWall}
            onCadDrawSlab={handleCadDrawSlab}
            onCadDrawColumn={handleCadDrawColumn}
            onCadDrawOpening={handleCadDrawOpening}
            onCadCancel={() => setCadToolMode('select')}
            elementDetails={selectedElementDetails}
            storeys={storeys}
            onCloneElement={handleCloneElement}
            onDeleteElement={handleDeleteElement}
            onUpdateGeometry={handleUpdateGeometry}
            onAssignStorey={handleAssignStorey}
            onAssignMaterial={handleAssignMaterial}
            onOpenInspector={() => setIsPropertyOpen(true)}
            onSelectCadTool={(mode) => setCadToolMode(mode)}
            pinnedExpressIds={pinnedExpressIds}
            onTogglePin={handleTogglePin}
            onMoveElement={handleMoveElement}
            onRotateElement={handleRotateElement}
            onMirrorElement={handleMirrorElement}
            onArrayElement={handleArrayElement}
            onAlignElement={handleAlignElement}
            focusTrigger={focusTrigger}
            activeInteractiveMode={activeInteractiveMode}
            onActiveInteractiveModeChange={setActiveInteractiveMode}
            onOpenSpecialModal={() => setIsMoveCopySpecialOpen(true)}
            onSpecialPointsPicked={(p1, p2) => {
              setSpecialPickedPoints({ p1, p2 });
              setIsMoveCopySpecialOpen(true);
            }}
            projectId={currentProject?.id}
          />
        )}
      </div>

      <HudLayoutProvider>
        {/* 2. Floating Top Frosted Glass Header */}
        <GlassHeader
          currentProject={currentProject}
          projects={projects}
          onSelectProject={loadProject}
          onOpenUploadModal={() => setIsUploadModalOpen(true)}
          onOpenNewProjectModal={() => setIsNewProjectModalOpen(true)}
          onDownloadProject={handleDownloadProject}
          activeProfile={activeProfile}
          onSelectProfile={handleSelectProfile}
          customSettings={customSettings}
          onUpdateCustomSettings={handleUpdateCustomSettings}
          onOpenOmnibar={() => setIsOmnibarOpen(true)}
          onOpenSettingsModal={() => setIsSettingsOpen(true)}
          collaborators={collaborators}
          isTreeOpen={isTreeOpen}
          onToggleTree={() => setIsTreeOpen((prev) => !prev)}
          isPropertyOpen={isPropertyOpen}
          onToggleProperty={handleToggleProperty}
          isCopilotOpen={isCopilotOpen}
          onToggleCopilot={handleToggleCopilot}
          isClashOpen={isClashInspectorOpen}
          onToggleClash={() => setIsClashInspectorOpen((prev) => !prev)}
          isStoreyNavOpen={isStoreyNavOpen}
          onToggleStoreyNav={() => setIsStoreyNavOpen((prev) => !prev)}
          isAnnotationsOpen={isAnnotationsOpen}
          onToggleAnnotations={() => setIsAnnotationsOpen((prev) => !prev)}
          viewportEngine={viewportEngine}
          onToggleViewportEngine={setViewportEngine}
          currentTheme={currentTheme}
          onToggleTheme={toggleTheme}
          glassOpacity={settings.ui?.glassOpacity ?? 0.55}
          onUpdateGlassOpacity={handleUpdateGlassOpacity}
          uiStyleMode={settings.ui?.styleMode ?? 'glass'}
          onUpdateUiStyleMode={handleUpdateUiStyleMode}
        />

        {/* 2b. Contextual Modification Ribbon (Decked directly below top glass header) */}
        {selectedExpressID !== null && effectiveProfileSettings.showContextualModifyBar && (
          <GlassContextualModifyDock
            expressId={selectedExpressID}
            elementDetails={selectedElementDetails}
            storeys={storeys}
            isPinned={pinnedExpressIds.has(selectedExpressID)}
            activeInteractiveMode={activeInteractiveMode}
            leftDrawerOffset={leftOffset}
            rightDrawerOffset={rightOffset}
            onTogglePin={handleTogglePin}
            onStartMove={() => setActiveInteractiveMode('move')}
            onStartRotate={() => setActiveInteractiveMode('rotate')}
            onQuickRotate={(cw) => handleRotateElement(selectedExpressID, cw ? 90 : -90, 'z')}
            onStartMirror={() => setActiveInteractiveMode('mirror')}
            onStartElevate={() => setActiveInteractiveMode('elevate')}
            onStartMultiply={() => setActiveInteractiveMode('multiply')}
            onOpenSpecialModal={() => setIsMoveCopySpecialOpen(true)}
            onCancelInteractiveTool={() => setActiveInteractiveMode('none')}
            onClone={handleCloneElement}
            onDelete={handleDeleteElement}
            onUpdateGeometry={handleUpdateGeometry}
            onAssignStorey={handleAssignStorey}
            onAssignMaterial={handleAssignMaterial}
            onAlignElement={handleAlignElement}
            onFocus={(id) => setFocusTrigger({ expressId: id, timestamp: Date.now() })}
            onOpenInspector={() => setIsPropertyOpen(true)}
            onDeselect={() => handleSelectElement(null)}
          />
        )}

        {/* 3. Floating Frosted Glass Panels Over 3D Canvas */}
        <div className="absolute inset-x-0 bottom-0 top-16 z-20 pointer-events-none p-4 flex justify-between overflow-hidden">
          {/* Left Spatial Hierarchy Tree Drawer (zero permanent left rail) */}
          <div className="flex gap-2.5 h-full pointer-events-auto items-start">
            <GlassSpatialTree
              tree={spatialTree}
              selectedExpressID={selectedExpressID}
              onSelectElement={handleSelectElement}
              isolatedExpressID={isolatedExpressID}
              onToggleIsolate={setIsolatedExpressID}
              isOpen={isTreeOpen}
              onToggleOpen={() => setIsTreeOpen(false)}
              onWidthChange={handleTreeWidthChange}
              fileName={currentProject?.name}
            />
          </div>

          {/* Rightmost Element Properties Inspector & Copilot */}
          <div className="h-full pointer-events-auto flex items-start gap-2.5">
            {isPropertyOpen && (
              <GlassPropertyInspector
                projectId={currentProject?.id || null}
                expressId={selectedExpressID}
                isOpen={isPropertyOpen}
                onClose={() => setIsPropertyOpen(false)}
                transformInfo={transformInfo}
                onWidthChange={handlePropertyWidthChange}
              />
            )}

            <React.Suspense fallback={null}>
              <CopilotSidebar
                isOpen={isCopilotOpen}
                onClose={() => setIsCopilotOpen(false)}
                projectId={currentProject?.id || ''}
                selectedExpressId={selectedExpressID}
                onModelModified={handleModelModifiedByCopilot}
                onWidthChange={setCopilotWidth}
              />
            </React.Suspense>
          </div>
        </div>

        {/* 4. Top-Right: 3D ViewCube Orientation Overlay (Three.js mode only; Xeokit has built-in NavCube) */}
        {viewportEngine !== 'xeokit' && (
          <GlassViewCube
            onCameraPreset={handleCameraPreset}
            activePreset={cameraPresetTrigger?.preset ?? null}
            rightOffset={rightOffset}
          />
        )}

        {/* 4b. Xeokit Storey Views & 2D Floor Plan Navigator */}
        <StoreyNavigatorHud
          storeys={xeokitStoreys}
          activeStoreyId={activeStoreyId}
          onSelectStorey={(stId) => {
            setActiveStoreyId(stId);
          }}
          isolatedStoreyId={isolatedStoreyId}
          onToggleIsolateStorey={(stId) => {
            if (isolatedStoreyId === stId) {
              setIsolatedStoreyId(null);
            } else {
              setIsolatedStoreyId(stId);
            }
          }}
          onClearStoreyIsolation={() => setIsolatedStoreyId(null)}
          isOpen={isStoreyNavOpen}
          onClose={() => setIsStoreyNavOpen(false)}
        />

        {/* 4c. Xeokit 3D Spatial Annotations & Issue Pins */}
        <AnnotationsHud
          annotations={annotations}
          isAnnotateMode={isAnnotateMode}
          onToggleAnnotateMode={() => setIsAnnotateMode((prev) => !prev)}
          onSelectAnnotation={handleSelectAnnotation}
          onDeleteAnnotation={handleDeleteAnnotation}
          onConvertToBcf={handleConvertAnnotationToBcf}
          isOpen={isAnnotationsOpen}
          onClose={() => setIsAnnotationsOpen(false)}
        />

        {/* 5. Headless QA Coordinate HUD (visually hidden, preserves automated harness contracts) */}
        <CoordinateHud
          selectedExpressID={selectedExpressID}
          transformInfo={transformInfo}
          elementCount={geometries.length}
        />

        {/* 7. Floating Frosted Bottom Tool Dock (role-adaptive CAD & inspection controls) */}
        {effectiveProfileSettings.showBottomDock && (
          <GlassBottomDock
            transformMode={transformMode}
            onSetTransformMode={setTransformMode}
            cadToolMode={cadToolMode}
            onSelectCadTool={(mode) => setCadToolMode(mode)}
            canUndo={cadCanUndo}
            canRedo={cadCanRedo}
            onUndo={handleCadUndo}
            onRedo={handleCadRedo}
            snapEnabled={snapEnabled}
            onToggleSnap={() => setSnapEnabled((prev) => !prev)}
            isMeasureActive={isMeasureActive}
            onToggleMeasure={() => setIsMeasureActive((p) => !p)}
            measurementCount={measurements.length}
            onClearMeasurements={handleClearMeasurements}
            sectionConfig={sectionConfig}
            onUpdateSection={setSectionConfig}
            onCameraPreset={handleCameraPreset}
            renderStyle={renderStyle}
            onSetRenderStyle={setRenderStyle}
            profile={activeProfile}
            customSettings={customSettings}
            selectedExpressID={selectedExpressID}
            leftDrawerOffset={leftOffset}
            rightDrawerOffset={rightOffset}
            isTreeOpen={isTreeOpen}
            onToggleTree={handleToggleTree}
            isPropertyOpen={isPropertyOpen}
            onToggleProperty={() => setIsPropertyOpen((prev) => !prev)}
            isCopilotOpen={isCopilotOpen}
            onToggleCopilot={handleToggleCopilot}
            isClashOpen={isClashInspectorOpen}
            onToggleClash={() => setIsClashInspectorOpen((prev) => !prev)}
            wallHeight={cadWallHeight}
            setWallHeight={setCadWallHeight}
            wallThickness={cadWallThickness}
            setWallThickness={setCadWallThickness}
            isCadOpen={isCadOpen}
            cadHistory={cadHistory}
            onRefreshCadHistory={refreshCadHistory}
          />
        )}

      {/* 7a. Floating Dimension Info HUD with exact XYZ Deltas */}
      {activeDimension && (
        <DimensionInfoHud
          measurement={activeDimension}
          onClose={() => setActiveDimension(null)}
          onDelete={handleDeleteMeasurement}
        />
      )}

      {/* 8. Command Palette / Spatial Omnibar (Ctrl+K) */}
      <SpatialOmnibar
        isOpen={isOmnibarOpen}
        onClose={() => setIsOmnibarOpen(false)}
        geometries={geometries}
        spatialTree={spatialTree}
        onSelectElement={handleSelectElement}
        onTriggerTool={handleTriggerTool}
        onUpdateUiStyleMode={handleUpdateUiStyleMode}
      />

      {/* Empty State Overlay */}
      {geometries.length === 0 && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="p-6 rounded-2xl bg-[var(--dock-translucent)] border border-[var(--border-subtle)] text-center max-w-sm pointer-events-auto backdrop-blur-2xl shadow-[var(--shadow-hud)]">
            <p className="text-sm font-semibold text-slate-200 mb-1">Spatial Canvas Ready</p>
            <p className="text-xs text-slate-400 mb-4">
              This IFC model currently contains spatial containers. Upload an IFC file or open sample models to explore 3D elements.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-cyan-400 hover:bg-cyan-300 text-slate-950 transition-colors shadow-sm"
              >
                Upload IFC
              </button>
              <button
                onClick={() => setIsNewProjectModalOpen(true)}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[var(--control-bg)] hover:bg-[var(--control-hover)] text-white transition-colors border border-[var(--border-subtle)]"
              >
                Sample Models
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Non-blocking Soft Lock Alert Notification */}
      {lockNotification && (
        <div
          data-qa="soft-lock-notification"
          className={`fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2 rounded-xl bg-[var(--dock-bg)] border border-amber-500/40 text-amber-200 text-xs shadow-[var(--shadow-hud)] backdrop-blur-md transition-all duration-200 select-none animate-in fade-in-50 slide-in-from-top-2 ${
          isMeasureActive ? 'top-28' : 'top-16'
        }`}>
          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            Element <strong className="font-mono text-cyan-300">#{lockNotification.expressID}</strong> is being edited by{' '}
            <span className="font-semibold text-amber-300">{lockNotification.userName}</span>
          </span>
          <button
            data-qa="soft-lock-dismiss-btn"
            onClick={() => setLockNotification(null)}
            className="ml-1 text-slate-400 hover:text-slate-200 p-0.5 rounded cursor-pointer transition-colors"
            title="Dismiss notification"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Modals */}
      <React.Suspense fallback={null}>
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onFileSelected={handleFileSelected}
        isLoading={isLoading}
        loadingStage={loadingStage}
        loadingPercent={loadingPercent}
      />

      <NewProjectModal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
        onCreateProject={handleCreateProject}
        onLoadSample={handleLoadSample}
        isLoading={isLoading}
      />

      {/* Phase 10: Multi-Model Federated Coordination & Clash Detection */}
      <FederatedModelManager
        isOpen={isFederationOpen}
        onClose={() => setIsFederationOpen(false)}
        projectName={currentProject?.name ?? ''}
        subModels={subModels}
        hiddenModelIds={hiddenModelIds}
        onToggleModelVisibility={handleToggleModelVisibility}
        onUploadSubModel={handleUploadSubModel}
        onDeleteSubModel={handleDeleteSubModel}
        onLoadSampleDiscipline={handleLoadSampleDiscipline}
      />

      <ClashInspector
        isOpen={isClashInspectorOpen}
        onClose={() => setIsClashInspectorOpen(false)}
        clashResult={clashResult}
        activeClash={activeClash}
        onSelectClash={setActiveClash}
        onRunClashCheck={handleRunClashCheck}
        isLoading={isClashLoading}
        leftOffset={leftOffset}
      />

      {/* Phase 12: BCF 2.1 Issue Management Modal */}
      {currentProject && (
        <BcfManagerModal
          isOpen={isBcfOpen}
          onClose={() => setIsBcfOpen(false)}
          projectName={currentProject.name}
          topics={bcfTopics}
          onCreateTopic={handleCreateBcfTopic}
          onImportClashes={async () => {
            if (clashResult && clashResult.clashes.length > 0) {
              await handleImportClashesToBcf(clashResult.clashes);
            }
          }}
          clashCount={clashResult?.total_clashes ?? 0}
          onSelectTopic={handleSelectBcfTopic}
          selectedExpressID={selectedExpressID}
          exportUrl={api.getBcfExportUrl(currentProject.id)}
        />
      )}

      {/* Phase 12: Collaborative Session Playback & Audit Timeline Scrubber */}
      <TimelineScrubber
        isOpen={isTimelineOpen}
        onClose={() => setIsTimelineOpen(false)}
        timeline={auditTimeline}
        onSelectEvent={(event: AuditTimelineItem | null) => {
          if (event?.express_id) {
            setSelectedExpressID(event.express_id);
          }
        }}
      />

      {/* Settings & Preferences Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onResetSettings={handleResetSettings}
      />

      {/* Tekla Structures 2025 Move/Copy Special Precision Engineering Modal */}
      {selectedExpressID !== null && (
        <MoveCopySpecialModal
          isOpen={isMoveCopySpecialOpen}
          expressId={selectedExpressID}
          pickedVector={specialPickedPoints ? [
            specialPickedPoints.p2[0] - specialPickedPoints.p1[0],
            specialPickedPoints.p2[1] - specialPickedPoints.p1[1],
            specialPickedPoints.p2[2] - specialPickedPoints.p1[2]
          ] : undefined}
          onClose={() => setIsMoveCopySpecialOpen(false)}
          onPickTwoPoints={() => {
            setIsMoveCopySpecialOpen(false);
            setActiveInteractiveMode('special_pick');
          }}
          onApplyLinear={(delta, copies, isCopy) => {
            if (isCopy) {
              handleArrayElement(selectedExpressID, copies + 1, delta);
            } else {
              handleMoveElement(selectedExpressID, delta);
            }
          }}
          onApplyRotate={(angle, axis, _copies, _isCopy) => {
            handleRotateElement(selectedExpressID, angle, axis);
          }}
          onApplyMirror={(axis, isCopy) => {
            handleMirrorElement(selectedExpressID, axis, isCopy);
          }}
        />
      )}
      </React.Suspense>
      </HudLayoutProvider>
    </div>
  );
};

export default App;
