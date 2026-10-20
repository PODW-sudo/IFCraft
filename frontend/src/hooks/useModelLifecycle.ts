import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  GeometryData,
  SpatialNode,
  ProjectMetadata,
  WorkerResponse,
  SubModel,
  ClashRecord,
  ClashCheckResponse,
  DisciplineType
} from '../types/ifc';
import * as api from '../services/api';
import IfcWorker from '../workers/ifcWorker?worker';

export interface UseModelLifecycleProps {
  autoInit?: boolean;
  onResetSelection?: (preserveId?: number | null) => void;
  onCloseUploadModal?: () => void;
  onCloseNewProjectModal?: () => void;
  onPinnedIdsLoaded?: (pinnedIds: Set<number>) => void;
}

export function useModelLifecycle({
  autoInit = true,
  onResetSelection,
  onCloseUploadModal,
  onCloseNewProjectModal,
  onPinnedIdsLoaded
}: UseModelLifecycleProps = {}) {
  // Keep callback refs stable to prevent unneeded re-renders or worker recreation
  const onResetSelectionRef = useRef(onResetSelection);
  onResetSelectionRef.current = onResetSelection;
  const onCloseUploadModalRef = useRef(onCloseUploadModal);
  onCloseUploadModalRef.current = onCloseUploadModal;
  const onCloseNewProjectModalRef = useRef(onCloseNewProjectModal);
  onCloseNewProjectModalRef.current = onCloseNewProjectModal;
  const onPinnedIdsLoadedRef = useRef(onPinnedIdsLoaded);
  onPinnedIdsLoadedRef.current = onPinnedIdsLoaded;

  // Core Model & Hierarchy State
  const [currentProject, setCurrentProject] = useState<ProjectMetadata | null>(null);
  const currentProjectRef = useRef<ProjectMetadata | null>(null);
  currentProjectRef.current = currentProject;
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const projectsRef = useRef<ProjectMetadata[]>([]);
  projectsRef.current = projects;
  const [geometries, setGeometries] = useState<GeometryData[]>([]);
  const [spatialTree, setSpatialTree] = useState<SpatialNode | null>(null);

  // Loading & Progress States
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [loadingPercent, setLoadingPercent] = useState(0);

  // Federation & Sub-Models
  const [subModels, setSubModels] = useState<SubModel[]>([]);
  const [hiddenModelIds, setHiddenModelIds] = useState<Set<string>>(new Set());
  const [clashResult, setClashResult] = useState<ClashCheckResponse | null>(null);
  const [activeClash, setActiveClash] = useState<ClashRecord | null>(null);
  const [isClashLoading, setIsClashLoading] = useState(false);

  // Worker reference
  const workerRef = useRef<Worker | null>(null);

  // Initialize Web Worker ONCE on mount
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
        onCloseUploadModalRef.current?.();
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

  // Fetch projects list
  const refreshProjects = useCallback(async () => {
    try {
      const list = await api.fetchProjects();
      projectsRef.current = list;
      setProjects(list);
      return list;
    } catch (err) {
      console.error('Failed to fetch projects:', err);
      return [];
    }
  }, []);

  // Load project by ID: fetches metadata and downloads IFC buffer to parse
  const loadProject = useCallback(async (project: ProjectMetadata, preserveSelectionId?: number | null) => {
    currentProjectRef.current = project;
    setCurrentProject(project);
    onResetSelectionRef.current?.(preserveSelectionId);

    try {
      setIsLoading(true);
      setLoadingStage('Downloading IFC model from server storage...');
      setLoadingPercent(10);

      const downloadUrl = `${api.getDownloadUrl(project.id)}?t=${Date.now()}`;
      const res = await fetch(downloadUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to download project model');
      const arrayBuffer = await res.arrayBuffer();

      parseBufferInWorker(arrayBuffer, project.file_name);

      // Fetch pinned element constraints
      api.fetchPinnedElements(project.id).then((r) => {
        onPinnedIdsLoadedRef.current?.(new Set(r.pinned_ids || []));
      }).catch((e) => {
        console.warn('Could not fetch pinned elements:', e);
      });
    } catch (err: unknown) {
      console.error('Failed to load project:', err);
      setIsLoading(false);
    }
  }, [parseBufferInWorker]);

  // Initial load: check existing projects or create a default project (guarded to run once on mount)
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (!autoInit || hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    async function initApp() {
      try {
        const list = await refreshProjects();
        if (list.length > 0) {
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
  }, [autoInit, loadProject, refreshProjects]);

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

  const handleFileSelected = useCallback(async (file: File) => {
    try {
      setIsLoading(true);
      setLoadingStage('Uploading file to backend...');
      setLoadingPercent(10);

      const project = await api.uploadIFCFile(file);
      await refreshProjects();
      setCurrentProject(project);
      onResetSelection?.();

      const arrayBuffer = await file.arrayBuffer();
      parseBufferInWorker(arrayBuffer, file.name);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Upload error: ${msg}`);
      setIsLoading(false);
    }
  }, [parseBufferInWorker, refreshProjects, onResetSelection]);

  const handleCreateProject = useCallback(async (name: string, description: string, schema: string) => {
    try {
      setIsLoading(true);
      const project = await api.createProject(name, description, schema);
      await refreshProjects();
      onCloseNewProjectModal?.();
      await loadProject(project);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Creation error: ${msg}`);
      setIsLoading(false);
    }
  }, [refreshProjects, loadProject, onCloseNewProjectModal]);

  const handleDownloadProject = useCallback(() => {
    if (!currentProject) return;
    const downloadUrl = api.getDownloadUrl(currentProject.id);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${currentProject.name.replace(/\s+/g, '_')}.ifc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [currentProject]);

  const handleLoadSample = useCallback(async (sampleId: string) => {
    try {
      setIsLoading(true);
      setLoadingStage('Instantiating architectural sample model...');
      setLoadingPercent(20);

      const sample = await api.loadSampleProject(sampleId);
      await refreshProjects();
      onCloseNewProjectModal?.();
      await loadProject(sample);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Failed to load sample model: ${msg}`);
      setIsLoading(false);
    }
  }, [refreshProjects, loadProject, onCloseNewProjectModal]);

  const loadProjectById = useCallback(async (projectId: string) => {
    let p = projectsRef.current.find((item) => item.id === projectId);
    if (!p) {
      const list = await refreshProjects();
      p = list.find((item) => item.id === projectId);
    }
    if (p) {
      currentProjectRef.current = p;
      setCurrentProject(p);
      await loadProject(p);
    }
  }, [loadProject, refreshProjects]);

  return {
    currentProject,
    setCurrentProject,
    projects,
    setProjects,
    geometries,
    setGeometries,
    spatialTree,
    setSpatialTree,
    isLoading,
    setIsLoading,
    loadingStage,
    setLoadingStage,
    loadingPercent,
    setLoadingPercent,
    subModels,
    setSubModels,
    hiddenModelIds,
    setHiddenModelIds,
    clashResult,
    setClashResult,
    activeClash,
    setActiveClash,
    isClashLoading,
    workerRef,
    currentProjectRef,
    projectsRef,
    loadProject,
    loadProjectById,
    refreshProjects,
    parseBufferInWorker,
    handleToggleModelVisibility,
    handleUploadSubModel,
    handleDeleteSubModel,
    handleRunClashCheck,
    handleLoadSampleDiscipline,
    handleFileSelected,
    handleCreateProject,
    handleDownloadProject,
    handleLoadSample
  };
}
