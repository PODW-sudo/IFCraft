import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ThreeViewport,
  type TransformMode,
  type MeasurementRecord
} from './components/viewer/ThreeViewport';
import { SpatialTree } from './components/tree/SpatialTree';
import { PropertyInspector } from './components/properties/PropertyInspector';
import { TopToolbar } from './components/toolbar/TopToolbar';
import {
  BimToolsToolbar,
  type SectionPlaneConfig,
  type CameraPreset,
  type RenderStyle
} from './components/tools/BimToolsToolbar';
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
import IfcWorker from './workers/ifcWorker?worker';

export const App: React.FC = () => {
  // Application State
  const [currentProject, setCurrentProject] = useState<ProjectMetadata | null>(null);
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

  // UI State
  const [isTreeOpen, setIsTreeOpen] = useState(true);
  const [isPropertyOpen, setIsPropertyOpen] = useState(true);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
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
        alert(`Element #${expressId} is currently being edited by ${heldBy?.user_name || 'another user'}.`);
        setSelectedExpressID(null);
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

  // Initial load: check existing projects or create a default project
  useEffect(() => {
    async function initApp() {
      try {
        const projects = await api.fetchProjects();
        if (projects.length > 0) {
          await loadProject(projects[0]);
        } else {
          const newProj = await api.createProject(
            'Starter Architectural Villa',
            'Sample building structure generated with IFC Editor',
            'IFC4'
          );
          await loadProject(newProj);
        }
      } catch (err) {
        console.error('Failed to initialize projects:', err);
      }
    }
    initApp();
  }, [loadProject]);

  // Handle Element Selection with Soft Locking
  const handleSelectElement = useCallback(
    (expressID: number | null) => {
      // Release previous selection lock if held
      if (selectedExpressID !== null && collabClientRef.current) {
        collabClientRef.current.deselectElement(selectedExpressID);
      }

      if (expressID !== null) {
        // Check if locked by another user
        const existingLock = elementLocks[expressID];
        if (existingLock) {
          alert(`Element #${expressID} is currently locked by ${existingLock.user_name}.`);
          return;
        }

        setSelectedExpressID(expressID);
        setIsPropertyOpen(true);
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
    [selectedExpressID, elementLocks, transformMode]
  );

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

  return (
    <div className="flex flex-col w-screen h-screen bg-[#0d0f12] text-slate-100 overflow-hidden font-sans">
      {/* Top Navigation & Action Bar */}
      <TopToolbar
        currentProject={currentProject}
        onOpenUploadModal={() => setIsUploadModalOpen(true)}
        onOpenNewProjectModal={() => setIsNewProjectModalOpen(true)}
        onDownloadProject={handleDownloadProject}
        isTreeOpen={isTreeOpen}
        onToggleTree={() => setIsTreeOpen((prev) => !prev)}
        elementCount={geometries.length}
        selectedExpressID={selectedExpressID}
        hiddenCategories={hiddenCategories}
        onToggleCategory={toggleCategoryVisibility}
        collaborators={collaborators}
        isCopilotOpen={isCopilotOpen}
        onToggleCopilot={() => setIsCopilotOpen((prev) => !prev)}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Spatial Tree */}
        <SpatialTree
          tree={spatialTree}
          selectedExpressID={selectedExpressID}
          onSelectElement={handleSelectElement}
          isolatedExpressID={isolatedExpressID}
          onToggleIsolate={setIsolatedExpressID}
          isOpen={isTreeOpen}
          onToggleOpen={() => setIsTreeOpen(false)}
        />

        {/* Center: 3D Viewport with TransformControls, Sectioning, Measurements, Soft Locks */}
        <main className="flex-1 h-full relative">
          <ThreeViewport
            geometries={geometries}
            selectedExpressID={selectedExpressID}
            onSelectElement={handleSelectElement}
            hiddenCategories={hiddenCategories}
            isolatedExpressID={isolatedExpressID}
            transformMode={transformMode}
            onSetTransformMode={setTransformMode}
            snapEnabled={snapEnabled}
            onToggleSnap={() => setSnapEnabled((prev) => !prev)}
            onTransformEnd={handleTransformEnd}
            onTransformChange={handleTransformChange}
            isMeasureActive={isMeasureActive}
            measurements={measurements}
            onAddMeasurement={handleAddMeasurement}
            sectionConfig={sectionConfig}
            cameraPresetTrigger={cameraPresetTrigger}
            renderStyle={renderStyle}
            elementLocks={elementLocks}
            remoteTransform={remoteTransform}
          />

          {/* Floating BIM Inspection Toolbar */}
          <BimToolsToolbar
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

          {/* Empty State Hint */}
          {geometries.length === 0 && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="p-6 rounded-lg bg-[#16191f]/90 border border-[#262a33] text-center max-w-sm pointer-events-auto backdrop-blur-md shadow-2xl">
                <p className="text-sm font-semibold text-slate-200 mb-1">No 3D Meshes In Active Model</p>
                <p className="text-xs text-slate-400 mb-4">
                  This model currently contains spatial hierarchy (Site, Building, Storey). Upload an IFC model or import geometry to view 3D elements.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setIsUploadModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 transition-colors shadow-sm"
                  >
                    Upload IFC
                  </button>
                  <button
                    onClick={() => setIsNewProjectModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#262a33] hover:bg-[#323743] text-white transition-colors border border-zinc-700/60"
                  >
                    Sample Models
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Right: Property Inspector Panel */}
        {selectedExpressID !== null && (
          <PropertyInspector
            projectId={currentProject?.id || null}
            expressId={selectedExpressID}
            isOpen={isPropertyOpen}
            onClose={() => setIsPropertyOpen(false)}
            transformInfo={transformInfo}
          />
        )}

        {/* Right: AI Copilot Sidebar Drawer */}
        <CopilotSidebar
          isOpen={isCopilotOpen}
          onClose={() => setIsCopilotOpen(false)}
          projectId={currentProject?.id || ''}
          selectedExpressId={selectedExpressID}
          onModelModified={handleModelModifiedByCopilot}
        />
      </div>

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
