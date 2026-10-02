import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ThreeViewport,
  type TransformMode,
  type MeasurementRecord
} from './components/viewer/ThreeViewport';
import { SpatialTree } from './components/tree/SpatialTree';
import { PropertyInspector } from './components/properties/PropertyInspector';
import { SpatialTopPill } from './components/nav/SpatialTopPill';
import { SpatialBottomDock } from './components/dock/SpatialBottomDock';
import { CoordinateHud } from './components/hud/CoordinateHud';
import { SpatialOmnibar } from './components/omnibar/SpatialOmnibar';
import type { SectionPlaneConfig, CameraPreset, RenderStyle } from './components/tools/BimToolsToolbar';
import { UploadModal } from './components/modals/UploadModal';
import { NewProjectModal } from './components/modals/NewProjectModal';
import { CopilotSidebar } from './components/copilot/CopilotSidebar';
import type { GeometryData, SpatialNode, ProjectMetadata, WorkerResponse } from './types/ifc';
import * as api from './services/api';
import {
  CollaborationClient,
  type Collaborator,
  type ElementLock
} from './services/collaboration';
import { Lock, X } from 'lucide-react';
import IfcWorker from './workers/ifcWorker?worker';

export const App: React.FC = () => {
  // Application State
  const [currentProject, setCurrentProject] = useState<ProjectMetadata | null>(null);
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [geometries, setGeometries] = useState<GeometryData[]>([]);
  const [spatialTree, setSpatialTree] = useState<SpatialNode | null>(null);
  const [selectedExpressID, setSelectedExpressID] = useState<number | null>(null);
  const [isolatedExpressID, setIsolatedExpressID] = useState<number | null>(null);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());

  // 3D Transform & Property State
  const [transformMode, setTransformMode] = useState<TransformMode>('select');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [transformInfo, setTransformInfo] = useState<{
    position: [number, number, number];
    rotation: [number, number, number];
  } | null>(null);

  // Phase 4 State: Measurement, Sectioning, Camera Presets, Render Style
  const [isMeasureActive, setIsMeasureActive] = useState(false);
  const [measurements, setMeasurements] = useState<MeasurementRecord[]>([]);
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

  // UI State
  const [isTreeOpen, setIsTreeOpen] = useState(true);
  const [isPropertyOpen, setIsPropertyOpen] = useState(true);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [treeWidth, setTreeWidth] = useState(288);
  const [propertyWidth, setPropertyWidth] = useState(320);
  const [copilotWidth, setCopilotWidth] = useState(384);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isOmnibarOpen, setIsOmnibarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [loadingPercent, setLoadingPercent] = useState(0);

  // Web Worker Ref
  const workerRef = useRef<Worker | null>(null);

  // Initialize Web Worker
  useEffect(() => {
    const worker = new IfcWorker();
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const data = event.data;
      if (data.type === 'PROGRESS') {
        setLoadingStage(data.stage);
        setLoadingPercent(data.percent);
      } else if (data.type === 'COMPLETE') {
        setGeometries(data.geometries);
        setSpatialTree(data.spatialTree);
        setIsLoading(false);
        setIsUploadModalOpen(false);
      } else if (data.type === 'ERROR') {
        console.error('Web-IFC Worker Error:', data.message);
        alert(`Failed to parse IFC file: ${data.message}`);
        setIsLoading(false);
      }
    };

    return () => {
      worker.terminate();
    };
  }, []);

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

  const toggleCategoryVisibility = useCallback((category: string) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  // Parse ArrayBuffer with dedicated Web Worker
  const parseBufferInWorker = useCallback((buffer: ArrayBuffer, fileName: string) => {
    if (!workerRef.current) return;
    setIsLoading(true);
    setLoadingStage('Starting WebAssembly worker...');
    setLoadingPercent(5);

    workerRef.current.postMessage(
      {
        action: 'PARSE_IFC',
        buffer,
        fileName
      },
      [buffer]
    );
  }, []);

  // Load project by ID: fetches metadata and downloads IFC buffer to parse
  const loadProject = useCallback(async (project: ProjectMetadata) => {
    setCurrentProject(project);
    setSelectedExpressID(null);
    setIsolatedExpressID(null);
    setTransformInfo(null);
    setMeasurements([]);

    try {
      setIsLoading(true);
      setLoadingStage('Downloading IFC model from server storage...');
      setLoadingPercent(10);

      const downloadUrl = api.getDownloadUrl(project.id);
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error('Failed to download project model');
      const arrayBuffer = await res.arrayBuffer();

      parseBufferInWorker(arrayBuffer, project.file_name);
    } catch (err: unknown) {
      console.error('Failed to load project:', err);
      setIsLoading(false);
    }
  }, [parseBufferInWorker]);

  const refreshProjects = useCallback(async () => {
    try {
      const list = await api.fetchProjects();
      setProjects(list);
      return list;
    } catch (err) {
      console.error('Failed to fetch projects:', err);
      return [];
    }
  }, []);

  // Initial load: check existing projects or create a default project
  useEffect(() => {
    async function initApp() {
      try {
        const list = await refreshProjects();
        if (list.length > 0) {
          await loadProject(list[0]);
        } else {
          const newProj = await api.createProject(
            'Starter Architectural Villa',
            'Sample building structure generated with IFC Editor',
            'IFC4'
          );
          await refreshProjects();
          await loadProject(newProj);
        }
      } catch (err) {
        console.error('Failed to initialize projects:', err);
      }
    }
    initApp();
  }, [loadProject, refreshProjects]);

  // Handle Element Selection with Soft Locking
  const handleSelectElement = useCallback(
    (expressID: number | null) => {
      // Release previous selection lock if held
      if (selectedExpressID !== null && collabClientRef.current) {
        collabClientRef.current.deselectElement(selectedExpressID);
      }

      if (expressID !== null) {
        // Check if locked by another user (NOT ourselves, and only if other user is actively connected)
        const existingLock = elementLocks[expressID];
        const myUserId = collabClientRef.current?.profile.userId || localStorage.getItem('ifc_editor_user_id');

        if (existingLock && existingLock.user_id !== myUserId) {
          const isHolderConnected = collaborators.some((u) => u.user_id === existingLock.user_id);
          if (isHolderConnected) {
            setLockNotification({
              expressID,
              userName: existingLock.user_name || 'another user',
              userColor: existingLock.user_color
            });
            return;
          }
        }

        setSelectedExpressID(expressID);
        setIsPropertyOpen(true);
        setIsCopilotOpen(false);
        if (transformMode === 'select') {
          setTransformMode('translate');
        }
        // Acquire lock via WebSocket
        collabClientRef.current?.selectElement(expressID);
      } else {
        setSelectedExpressID(null);
        setTransformInfo(null);
        setTransformMode('select');
      }
    },
    [selectedExpressID, elementLocks, transformMode, collaborators]
  );

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

  // Handle Transform End: Commit via WebSocket and REST persistence
  const handleTransformEnd = useCallback(
    async (expressID: number, matrix: number[]) => {
      if (!currentProject) return;

      // Broadcast commit over WebSocket for multi-user sync
      collabClientRef.current?.commitTransform(expressID, matrix);

      try {
        const res = await fetch(
          `/api/projects/${currentProject.id}/elements/${expressID}/placement`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matrix })
          }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          console.error('Failed to persist transform to backend:', err.detail);
        }
      } catch (err) {
        console.error('Network error persisting transform:', err);
      }
    },
    [currentProject]
  );

  // Handle Live Transform Coordinate Updates & WebSocket Streaming
  const handleTransformChange = useCallback(
    (_expressID: number, pos: [number, number, number], rot: [number, number, number]) => {
      setTransformInfo({ position: pos, rotation: rot });
    },
    []
  );

  // Measurement Handlers
  const handleAddMeasurement = useCallback((record: MeasurementRecord) => {
    setMeasurements((prev) => [...prev, record]);
  }, []);

  const handleClearMeasurements = useCallback(() => {
    setMeasurements([]);
  }, []);

  // Camera Preset Handler
  const handleCameraPreset = useCallback((preset: CameraPreset) => {
    setCameraPresetTrigger({ preset, timestamp: Date.now() });
  }, []);

  // Handle User File Upload
  const handleFileSelected = async (file: File) => {
    try {
      setIsLoading(true);
      setLoadingStage('Uploading file to backend...');
      setLoadingPercent(10);

      const project = await api.uploadIFCFile(file);
      await refreshProjects();
      setCurrentProject(project);
      setSelectedExpressID(null);
      setIsolatedExpressID(null);

      const arrayBuffer = await file.arrayBuffer();
      parseBufferInWorker(arrayBuffer, file.name);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Upload error: ${msg}`);
      setIsLoading(false);
    }
  };

  // Handle New Project Creation
  const handleCreateProject = async (name: string, description: string, schema: string) => {
    try {
      setIsLoading(true);
      const project = await api.createProject(name, description, schema);
      await refreshProjects();
      setIsNewProjectModalOpen(false);
      await loadProject(project);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Creation error: ${msg}`);
      setIsLoading(false);
    }
  };

  // Handle Download/Export
  const handleDownloadProject = () => {
    if (!currentProject) return;
    const downloadUrl = api.getDownloadUrl(currentProject.id);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${currentProject.name.replace(/\s+/g, '_')}.ifc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Load Sample Project
  const handleLoadSample = async (sampleId: string) => {
    try {
      setIsLoading(true);
      setLoadingStage('Instantiating architectural sample model...');
      setLoadingPercent(20);
      const project = await api.loadSampleProject(sampleId);
      await refreshProjects();
      setIsNewProjectModalOpen(false);
      await loadProject(project);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Failed to load sample: ${msg}`);
      setIsLoading(false);
    }
  };

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

  // Dev-only QA Bridge for Live Agent Browser Automation
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as any).__IFC_QA_BRIDGE__ = {
        getState: () => ({
          currentProject,
          selectedExpressID,
          isTreeOpen,
          isPropertyOpen,
          isCopilotOpen,
          isMeasureActive,
          measurementCount: measurements.length,
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
          projectsCount: projects.length,
          geometriesCount: geometries.length
        }),
        selectElement: (expressID: number | null) => handleSelectElement(expressID),
        setTransformMode: (mode: TransformMode) => setTransformMode(mode),
        setSectionConfig: (config: Partial<SectionPlaneConfig>) => setSectionConfig((prev) => ({ ...prev, ...config })),
        setRenderStyle: (style: RenderStyle) => setRenderStyle(style),
        setSnapEnabled: (snap: boolean) => setSnapEnabled(snap),
        toggleCategory: (cat: string) => toggleCategoryVisibility(cat),
        setIsolate: (expressID: number | null) => setIsolatedExpressID(expressID),
        toggleTree: (open?: boolean) => setIsTreeOpen((prev) => (open !== undefined ? open : !prev)),
        toggleProperty: (open?: boolean) => setIsPropertyOpen((prev) => (open !== undefined ? open : !prev)),
        toggleCopilot: (open?: boolean) => setIsCopilotOpen((prev) => (open !== undefined ? open : !prev)),
        openOmnibar: () => setIsOmnibarOpen(true),
        closeOmnibar: () => setIsOmnibarOpen(false),
        clearMeasurements: () => setMeasurements([]),
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
          setMeasurements((prev) => [
            ...prev,
            {
              id: `measure_${Date.now()}`,
              start,
              end,
              distance: dist,
              midpoint: mid
            }
          ]);
        },
        loadProjectById: (projectId: string) => {
          const p = projects.find((item) => item.id === projectId);
          if (p) loadProject(p);
        }
      };
    }
  }, [
    currentProject,
    selectedExpressID,
    isTreeOpen,
    isPropertyOpen,
    isCopilotOpen,
    isMeasureActive,
    measurements,
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
    geometries
  ]);

  const isRightDrawerOpen = Boolean((isPropertyOpen && selectedExpressID !== null) || isCopilotOpen);
  const activeRightDrawerWidth = isCopilotOpen ? copilotWidth : propertyWidth;

  return (
    <div
      className="relative w-screen h-screen bg-[var(--canvas-bg)] text-slate-100 overflow-hidden font-sans select-none"
      data-qa-worker-status={isLoading ? (loadingStage.toLowerCase().includes('generat') ? 'generating' : 'parsing') : 'ready'}
      data-qa-selected-id={selectedExpressID ?? ''}
      data-qa-project-name={currentProject?.name ?? ''}
      data-qa-project-schema={currentProject?.schema_version ?? ''}
      data-qa-measure-active={isMeasureActive ? 'true' : 'false'}
      data-qa-measure-count={measurements.length}
      data-qa-transform-mode={transformMode}
      data-qa-section-active={sectionConfig.enabled ? 'true' : 'false'}
      data-qa-render-style={renderStyle}
    >
      {/* 1. 100% Viewport Canvas (Full window immersion) */}
      <div
        className="absolute inset-0 w-full h-full overflow-hidden z-0"
        data-qa-worker-status={isLoading ? (loadingStage.toLowerCase().includes('generat') ? 'generating' : 'parsing') : 'ready'}
      >
        <ThreeViewport
          geometries={geometries}
          selectedExpressID={selectedExpressID}
          onSelectElement={handleSelectElement}
          hiddenCategories={hiddenCategories}
          isolatedExpressID={isolatedExpressID}
          transformMode={transformMode}
          snapEnabled={snapEnabled}
          onTransformEnd={handleTransformEnd}
          onTransformChange={handleTransformChange}
          isMeasureActive={isMeasureActive}
          measurements={measurements}
          onAddMeasurement={handleAddMeasurement}
          onCancelMeasure={() => setIsMeasureActive(false)}
          sectionConfig={sectionConfig}
          cameraPresetTrigger={cameraPresetTrigger}
          onCameraPreset={handleCameraPreset}
          renderStyle={renderStyle}
          elementLocks={elementLocks}
          remoteTransform={remoteTransform}
          isRightDrawerOpen={isRightDrawerOpen}
          rightDrawerWidth={activeRightDrawerWidth}
        />
      </div>

      {/* 2. Floating Top Pill Navigation */}
      <SpatialTopPill
        currentProject={currentProject}
        projects={projects}
        onSelectProject={loadProject}
        onOpenUploadModal={() => setIsUploadModalOpen(true)}
        onOpenNewProjectModal={() => setIsNewProjectModalOpen(true)}
        onDownloadProject={handleDownloadProject}
        isTreeOpen={isTreeOpen}
        onToggleTree={() => setIsTreeOpen((prev) => !prev)}
        isPropertyOpen={isPropertyOpen}
        onToggleProperty={handleToggleProperty}
        isCopilotOpen={isCopilotOpen}
        onToggleCopilot={handleToggleCopilot}
        onOpenOmnibar={() => setIsOmnibarOpen(true)}
        selectedExpressID={selectedExpressID}
        spatialTree={spatialTree}
        collaborators={collaborators}
        hiddenCategories={hiddenCategories}
        onToggleCategory={toggleCategoryVisibility}
      />

      {/* 3. Floating Left Hierarchy Drawer */}
      <SpatialTree
        tree={spatialTree}
        selectedExpressID={selectedExpressID}
        onSelectElement={handleSelectElement}
        isolatedExpressID={isolatedExpressID}
        onToggleIsolate={setIsolatedExpressID}
        isOpen={isTreeOpen}
        onToggleOpen={() => setIsTreeOpen(false)}
        onWidthChange={setTreeWidth}
      />

      {/* 4. Floating Right Property Inspector Drawer */}
      {selectedExpressID !== null && (
        <PropertyInspector
          projectId={currentProject?.id || null}
          expressId={selectedExpressID}
          isOpen={isPropertyOpen}
          onClose={() => setIsPropertyOpen(false)}
          transformInfo={transformInfo}
          onWidthChange={setPropertyWidth}
        />
      )}

      {/* 5. Floating AI Copilot Drawer */}
      <CopilotSidebar
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        projectId={currentProject?.id || ''}
        selectedExpressId={selectedExpressID}
        onModelModified={handleModelModifiedByCopilot}
        onWidthChange={setCopilotWidth}
      />

      {/* 6. Contextual Floating Tool Dock (Bottom Center) */}
      <SpatialBottomDock
        transformMode={transformMode}
        onSetTransformMode={setTransformMode}
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
      />

      {/* 7. Bottom-Left Coordinate & Viewport Status HUD */}
      <CoordinateHud
        selectedExpressID={selectedExpressID}
        transformInfo={transformInfo}
        elementCount={geometries.length}
        isTreeOpen={isTreeOpen}
        treeWidth={treeWidth}
      />

      {/* 8. Command Palette / Spatial Omnibar (Ctrl+K) */}
      <SpatialOmnibar
        isOpen={isOmnibarOpen}
        onClose={() => setIsOmnibarOpen(false)}
        geometries={geometries}
        spatialTree={spatialTree}
        onSelectElement={handleSelectElement}
        onTriggerTool={handleTriggerTool}
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
        <div className={`fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2 rounded-xl bg-[var(--dock-bg)] border border-amber-500/40 text-amber-200 text-xs shadow-[var(--shadow-hud)] backdrop-blur-md transition-all duration-200 select-none animate-in fade-in-50 slide-in-from-top-2 ${
          isMeasureActive ? 'top-28' : 'top-16'
        }`}>
          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            Element <strong className="font-mono text-cyan-300">#{lockNotification.expressID}</strong> is being edited by{' '}
            <span className="font-semibold text-amber-300">{lockNotification.userName}</span>
          </span>
          <button
            onClick={() => setLockNotification(null)}
            className="ml-1 text-slate-400 hover:text-slate-200 p-0.5 rounded cursor-pointer transition-colors"
            title="Dismiss notification"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Modals */}
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
    </div>
  );
};

export default App;
