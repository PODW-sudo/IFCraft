import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { DimensionInfoHud } from './components/hud/DimensionInfoHud';
import { HudLayoutProvider } from './components/hud/HudLayoutContext';
import { ViewControlsHud } from './components/hud/ViewControlsHud';
import { SpatialOmnibar } from './components/omnibar/SpatialOmnibar';
import type { SectionPlaneConfig, CameraPreset, RenderStyle } from './components/tools/BimToolsToolbar';
import { UploadModal } from './components/modals/UploadModal';
import { NewProjectModal } from './components/modals/NewProjectModal';
import { CopilotSidebar } from './components/copilot/CopilotSidebar';
import { FederatedModelManager } from './components/federation/FederatedModelManager';
import { ClashInspector } from './components/federation/ClashInspector';
import { CadToolbar } from './components/cad/CadToolbar';
import { BcfManagerModal } from './components/collaboration/BcfManagerModal';
import { TimelineScrubber } from './components/collaboration/TimelineScrubber';
import { SettingsModal } from './components/modals/SettingsModal';
import { loadEditorSettings, saveEditorSettings } from './services/settings';
import { DEFAULT_EDITOR_SETTINGS, type EditorSettings } from './types/settings';
import type { 
  GeometryData, 
  SpatialNode, 
  ProjectMetadata, 
  WorkerResponse, 
  SubModel, 
  ClashRecord, 
  ClashCheckResponse, 
  DisciplineType,
  CadToolMode,
  CadHistoryItem,
  BcfTopic,
  BcfTopicCreateRequest,
  AuditTimelineItem,
  AuditDiffResponse,
  ElementDetails
} from './types/ifc';
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

  // Phase 10 State: Multi-Model Federation & Clash Detection
  const [subModels, setSubModels] = useState<SubModel[]>([]);
  const [hiddenModelIds, setHiddenModelIds] = useState<Set<string>>(new Set());
  const [isFederationOpen, setIsFederationOpen] = useState(false);
  const [isClashInspectorOpen, setIsClashInspectorOpen] = useState(false);
  const [clashResult, setClashResult] = useState<ClashCheckResponse | null>(null);
  const [activeClash, setActiveClash] = useState<ClashRecord | null>(null);
  const [isClashLoading, setIsClashLoading] = useState(false);

  // Phase 11 State: Advanced Spatial Modeling (CAD) & Undo/Redo
  const [isCadOpen, setIsCadOpen] = useState(false);
  const [cadToolMode, setCadToolMode] = useState<CadToolMode>('select');
  const [cadWallHeight, setCadWallHeight] = useState(3.0);
  const [cadWallThickness, setCadWallThickness] = useState(0.2);
  const [cadCanUndo, setCadCanUndo] = useState(false);
  const [cadCanRedo, setCadCanRedo] = useState(false);
  const [cadHistory, setCadHistory] = useState<CadHistoryItem[]>([]);

  // Phase 12 State: BCF 2.1 Issues & Collaborative Change Playback Scrubber
  const [isBcfOpen, setIsBcfOpen] = useState(false);
  const [bcfTopics, setBcfTopics] = useState<BcfTopic[]>([]);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [auditTimeline, setAuditTimeline] = useState<AuditTimelineItem[]>([]);
  const [auditDiff, setAuditDiff] = useState<AuditDiffResponse | null>(null);

  // Settings State & Persistence
  const [settings, setSettings] = useState<EditorSettings>(() => loadEditorSettings());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleUpdateSettings = useCallback((updated: EditorSettings) => {
    setSettings(updated);
    saveEditorSettings(updated);
  }, []);

  const handleResetSettings = useCallback(() => {
    setSettings(DEFAULT_EDITOR_SETTINGS);
    saveEditorSettings(DEFAULT_EDITOR_SETTINGS);
  }, []);

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

  // Fetch sub-models when currentProject changes
  useEffect(() => {
    if (!currentProject) {
      setSubModels([]);
      setClashResult(null);
      setActiveClash(null);
      return;
    }
    api.fetchSubModels(currentProject.id)
      .then((models) => {
        setSubModels(models);
      })
      .catch((err) => console.warn('Could not fetch sub-models:', err));
  }, [currentProject]);

  const handleToggleModelVisibility = useCallback((modelId: string) => {
    setHiddenModelIds((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) next.delete(modelId);
      else next.add(modelId);
      return next;
    });
  }, []);

  const handleUploadSubModel = useCallback(async (file: File, discipline: DisciplineType, name?: string) => {
    if (!currentProject) return;
    const subModel = await api.uploadSubModel(currentProject.id, file, discipline, name);
    setSubModels((prev) => [...prev, subModel]);

    const buffer = await file.arrayBuffer();
    const worker = new IfcWorker();
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const data = event.data;
      if (data.type === 'COMPLETE') {
        const taggedGeoms = data.geometries.map((g) => ({
          ...g,
          modelId: subModel.id,
          discipline
        }));
        setGeometries((prev) => [...prev, ...taggedGeoms]);
        worker.terminate();
      } else if (data.type === 'ERROR') {
        console.error('Sub-model geometry parse failed:', data.message);
        worker.terminate();
      }
    };
    worker.postMessage({ action: 'PARSE_IFC', buffer, fileName: file.name }, [buffer]);
  }, [currentProject]);

  const handleDeleteSubModel = useCallback(async (modelId: string) => {
    if (!currentProject) return;
    await api.deleteSubModel(currentProject.id, modelId);
    setSubModels((prev) => prev.filter((m) => m.id !== modelId));
    setGeometries((prev) => prev.filter((g) => g.modelId !== modelId));
  }, [currentProject]);

  const handleRunClashCheck = useCallback(async (tolerance: number = 0.01) => {
    if (!currentProject) {
      setClashResult({
        total_clashes: 0,
        hard_clashes: 0,
        clearance_clashes: 0,
        tolerance,
        clashes: [],
        duration_ms: 1.0
      });
      return;
    }
    setIsClashLoading(true);
    try {
      const res = await api.runClashCheck(currentProject.id, tolerance);
      setClashResult(res);
      if (res.clashes.length > 0) {
        setActiveClash(res.clashes[0]);
      }
    } catch (e) {
      console.error('Clash detection failed:', e);
    } finally {
      setIsClashLoading(false);
    }
  }, [currentProject]);

  const handleLoadSampleDiscipline = useCallback(async (discipline: 'STRUCT' | 'MEP') => {
    if (!currentProject) return;
    const sampleFileName = discipline === 'STRUCT' ? 'Ifc4_Revit_STR.ifc' : 'Ifc4_Revit_MEP.ifc';
    try {
      const resp = await fetch(`/modelsfortests/${sampleFileName}`);
      if (resp.ok) {
        const blob = await resp.blob();
        const file = new File([blob], sampleFileName, { type: 'application/octet-stream' });
        await handleUploadSubModel(file, discipline, `${discipline} Model`);
      }
    } catch (e) {
      console.warn('Could not load sample model:', e);
    }
  }, [currentProject, handleUploadSubModel]);

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
          // Prefer a responsive starter project (Duplex/Villa) over a 47MB performance benchmark on initial mount
          const starter = list.find((p) => {
            const n = p.name.toLowerCase();
            return !n.includes('castle') && !n.includes('benchmark') && (p.element_count || 0) > 0;
          }) || list[0];
          await loadProject(starter);
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

  // CAD Modeling Handlers (Phase 11)
  const refreshCadHistory = useCallback(async () => {
    if (!currentProject) return;
    try {
      const res = await api.fetchCadHistory(currentProject.id);
      setCadHistory(res.history);
      setCadCanUndo(res.can_undo);
      setCadCanRedo(res.can_redo);
    } catch (err) {
      console.error('Failed to fetch CAD history:', err);
    }
  }, [currentProject]);

  const handleToggleCad = useCallback(() => {
    setIsCadOpen((prev) => {
      const next = !prev;
      if (next) refreshCadHistory();
      return next;
    });
  }, [refreshCadHistory]);

  const handleCadDrawWall = useCallback(async (start: [number, number], end: [number, number]) => {
    if (!currentProject) return;
    try {
      await api.createCadWall(currentProject.id, {
        start,
        end,
        height: cadWallHeight,
        thickness: cadWallThickness,
        name: 'Parametric Wall'
      });
      await refreshCadHistory();
      await loadProject(currentProject);
    } catch (err) {
      console.error('Failed to create CAD wall:', err);
    }
  }, [currentProject, cadWallHeight, cadWallThickness, refreshCadHistory, loadProject]);

  const handleCadDrawSlab = useCallback(async (c1: [number, number], c2: [number, number]) => {
    if (!currentProject) return;
    try {
      await api.createCadSlab(currentProject.id, {
        boundary: [c1, c2],
        thickness: 0.3,
        name: 'Parametric Slab'
      });
      await refreshCadHistory();
      await loadProject(currentProject);
    } catch (err) {
      console.error('Failed to create CAD slab:', err);
    }
  }, [currentProject, refreshCadHistory, loadProject]);

  const handleCadDrawColumn = useCallback(async (pos: [number, number]) => {
    if (!currentProject) return;
    try {
      await api.createCadColumn(currentProject.id, {
        position: pos,
        height: cadWallHeight,
        width: 0.35,
        depth: 0.35,
        name: 'Parametric Column'
      });
      await refreshCadHistory();
      await loadProject(currentProject);
    } catch (err) {
      console.error('Failed to create CAD column:', err);
    }
  }, [currentProject, cadWallHeight, refreshCadHistory, loadProject]);

  const handleCadDrawOpening = useCallback(async (wallId: number, offset: number, explicitType?: 'door' | 'window') => {
    if (!currentProject) return;
    const isDoor = explicitType ? (explicitType === 'door') : (cadToolMode === 'door');
    try {
      await api.createCadOpening(currentProject.id, {
        host_wall_id: wallId,
        opening_type: isDoor ? 'door' : 'window',
        offset_along_wall: offset,
        width: isDoor ? 0.9 : 1.2,
        height: isDoor ? 2.1 : 1.4,
        sill_height: isDoor ? 0.0 : 0.9,
        name: isDoor ? 'Parametric Door' : 'Parametric Window'
      });
      await refreshCadHistory();
      await loadProject(currentProject);
    } catch (err) {
      console.error('Failed to create CAD opening:', err);
    }
  }, [currentProject, cadToolMode, refreshCadHistory, loadProject]);

  const handleCadUndo = useCallback(async () => {
    if (!currentProject) return;
    try {
      await api.undoCad(currentProject.id);
      await refreshCadHistory();
      await loadProject(currentProject);
    } catch (err) {
      console.error('Failed to undo CAD action:', err);
    }
  }, [currentProject, refreshCadHistory, loadProject]);

  const handleCadRedo = useCallback(async () => {
    if (!currentProject) return;
    try {
      await api.redoCad(currentProject.id);
      await refreshCadHistory();
      await loadProject(currentProject);
    } catch (err) {
      console.error('Failed to redo CAD action:', err);
    }
  }, [currentProject, refreshCadHistory, loadProject]);

  // Selected Element Details for In-Viewport Context Capsule
  const [selectedElementDetails, setSelectedElementDetails] = useState<ElementDetails | null>(null);

  useEffect(() => {
    if (!currentProject || selectedExpressID === null) {
      setSelectedElementDetails(null);
      return;
    }
    let isMounted = true;
    api.getElementDetails(currentProject.id, selectedExpressID)
      .then((data) => {
        if (isMounted) setSelectedElementDetails(data);
      })
      .catch((err) => {
        console.error('Failed to load element details for capsule:', err);
      });
    return () => { isMounted = false; };
  }, [currentProject, selectedExpressID]);

  // Extract Storeys from Spatial Tree
  const storeys = useMemo(() => {
    if (!spatialTree) return [];
    const list: { id: number; name: string; elevation: number }[] = [];
    const traverse = (node: SpatialNode) => {
      if (node.type === 'IfcBuildingStorey') {
        list.push({ id: node.express_id, name: node.name, elevation: 0.0 });
      }
      node.children?.forEach(traverse);
    };
    traverse(spatialTree);
    return list;
  }, [spatialTree]);

  // Modern BIM Element Handlers
  const handleDeleteElement = useCallback(async (expressId: number) => {
    if (!currentProject) return;
    try {
      await api.deleteElement(currentProject.id, expressId);
      setSelectedExpressID(null);
      setSelectedElementDetails(null);
      await refreshCadHistory();
      await loadProject(currentProject);
    } catch (err) {
      console.error('Failed to delete element:', err);
    }
  }, [currentProject, refreshCadHistory, loadProject]);

  const handleCloneElement = useCallback(async (expressId: number) => {
    if (!currentProject) return;
    try {
      const res = await api.cloneElement(currentProject.id, expressId, { delta: [1.5, 0.0, 0.0] });
      await refreshCadHistory();
      await loadProject(currentProject);
      if (res.express_id) {
        setSelectedExpressID(res.express_id);
      }
    } catch (err) {
      console.error('Failed to clone element:', err);
    }
  }, [currentProject, refreshCadHistory, loadProject]);

  const handleUpdateGeometry = useCallback(async (expressId: number, params: { height?: number; thickness?: number; elevation?: number }) => {
    if (!currentProject) return;
    try {
      await api.updateElementGeometry(currentProject.id, expressId, params);
      await refreshCadHistory();
      await loadProject(currentProject);
    } catch (err) {
      console.error('Failed to update geometry:', err);
    }
  }, [currentProject, refreshCadHistory, loadProject]);

  const handleAssignStorey = useCallback(async (expressId: number, storeyId: number) => {
    if (!currentProject) return;
    try {
      await api.assignElementStorey(currentProject.id, expressId, { storey_id: storeyId });
      const tree = await api.fetchSpatialTree(currentProject.id);
      setSpatialTree(tree);
    } catch (err) {
      console.error('Failed to assign storey:', err);
    }
  }, [currentProject]);

  const handleAssignMaterial = useCallback(async (expressId: number, materialName: string, colorHex?: string) => {
    if (!currentProject) return;
    try {
      await api.assignElementMaterial(currentProject.id, expressId, { material_name: materialName, color_hex: colorHex });
      const updated = await api.getElementDetails(currentProject.id, expressId);
      setSelectedElementDetails(updated);
    } catch (err) {
      console.error('Failed to assign material:', err);
    }
  }, [currentProject]);

  // Global Keyboard Shortcuts for CAD & BIM Editing (Ctrl+Z, Ctrl+Y, Delete, Ctrl+D)
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
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleCadRedo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedExpressID !== null) {
          e.preventDefault();
          handleDeleteElement(selectedExpressID);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (selectedExpressID !== null) {
          e.preventDefault();
          handleCloneElement(selectedExpressID);
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === ',' || e.key === '<')) {
        e.preventDefault();
        setIsSettingsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCadUndo, handleCadRedo, handleDeleteElement, handleCloneElement, selectedExpressID]);

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
    currentProject,
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
    projectsCount: projects.length,
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
    firstExpressID: geometries.length > 0 ? geometries[0].expressID : 128
  };

  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as any).__IFC_QA_BRIDGE__ = {
        getState: () => latestStateRef.current,
        getFirstExpressId: () => (geometries.length > 0 ? geometries[0].expressID : 128),
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
          setIsCadOpen(true);
          refreshCadHistory();
        },
        closeCadToolbar: () => setIsCadOpen(false),
        setCadMode: (mode: CadToolMode) => setCadToolMode(mode),
        triggerCadUndo: () => handleCadUndo(),
        triggerCadRedo: () => handleCadRedo(),
        drawCadWall: (start: [number, number], end: [number, number]) => handleCadDrawWall(start, end),
        drawCadSlab: (c1: [number, number], c2: [number, number]) => handleCadDrawSlab(c1, c2),
        drawCadColumn: (pos: [number, number]) => handleCadDrawColumn(pos),
        drawCadOpening: (wallId: number, offset: number, type?: 'door' | 'window') => handleCadDrawOpening(wallId, offset, type),
        getCadHistory: () => cadHistory,
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
        loadProjectById: (projectId: string) => {
          const p = projects.find((item) => item.id === projectId);
          if (p) loadProject(p);
        },
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
    handleImportClashesToBcf
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
    >
      {/* 1. 100% Viewport Canvas (Full window immersion) */}
      <div
        className="absolute inset-0 w-full h-full overflow-hidden z-0"
        data-qa-worker-status={isLoading ? (loadingStage.toLowerCase().includes('generat') ? 'generating' : 'parsing') : 'ready'}
      >
        <ThreeViewport
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
        />
      </div>

      <HudLayoutProvider>
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
          isFederationOpen={isFederationOpen}
          onToggleFederation={() => setIsFederationOpen((prev) => !prev)}
          subModelCount={subModels.length}
          isClashOpen={isClashInspectorOpen}
          onToggleClash={() => setIsClashInspectorOpen((prev) => !prev)}
          clashCount={clashResult?.total_clashes ?? 0}
          isCadOpen={isCadOpen}
          onToggleCad={handleToggleCad}
          isBcfOpen={isBcfOpen}
          onToggleBcf={() => {
            setIsBcfOpen((prev) => !prev);
            if (!isBcfOpen) refreshBcfTopics();
          }}
          bcfTopicCount={bcfTopics.length}
          isTimelineOpen={isTimelineOpen}
          onToggleTimeline={() => {
            setIsTimelineOpen((prev) => !prev);
            if (!isTimelineOpen) refreshAuditData();
          }}
          auditCount={auditTimeline.length}
          onOpenSettingsModal={() => setIsSettingsOpen(true)}
        />

        {/* 2a. Floating View Orientation Controls */}
        <ViewControlsHud
          onCameraPreset={handleCameraPreset}
          activePreset={cameraPresetTrigger?.preset ?? null}
          isRightDrawerOpen={isRightDrawerOpen}
          rightDrawerWidth={activeRightDrawerWidth}
        />

      {/* 2b. Floating CAD Modeling Toolbar */}
      {isCadOpen && (
        <CadToolbar
          activeMode={cadToolMode}
          onSelectMode={setCadToolMode}
          canUndo={cadCanUndo}
          canRedo={cadCanRedo}
          onUndo={handleCadUndo}
          onRedo={handleCadRedo}
          history={cadHistory}
          onRefreshHistory={refreshCadHistory}
          onClose={() => setIsCadOpen(false)}
          wallHeight={cadWallHeight}
          setWallHeight={setCadWallHeight}
          wallThickness={cadWallThickness}
          setWallThickness={setCadWallThickness}
        />
      )}

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
      />

      {/* 7. Bottom-Left Coordinate & Viewport Status HUD */}
      <CoordinateHud
        selectedExpressID={selectedExpressID}
        transformInfo={transformInfo}
        elementCount={geometries.length}
        isTreeOpen={isTreeOpen}
        treeWidth={treeWidth}
      />

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
      </HudLayoutProvider>
    </div>
  );
};

export default App;
