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
import {
  CLASH_JOB_POLL_INTERVAL_MS,
  ClashJobUnavailableError,
  startClashJob,
  waitForClashJob
} from '../services/clashJob';
import { resetClashJobState, setClashJobState } from '../services/clashJobState';
import { notifyUser } from '../services/userMessages';
import IfcWorker from '../workers/ifcWorker?worker';

/** Abort from an unmount/project change, not a real failure to report. */
function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

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
  // Aborts job polling on unmount or when the project changes (audit issue 2.1).
  const clashJobAbortRef = useRef<AbortController | null>(null);

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
        notifyUser({ tone: 'error', text: `Failed to parse IFC file: ${data.message}` });
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
      // STEP-05 / F-003: authenticated fetch — the download route requires the API token.
      const res = await api.apiFetch(downloadUrl, { cache: 'no-store' });
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

    // A new run supersedes any in-flight poll. The server-side job keeps going (it is
    // bounded and one-per-project); only this tab stops listening to it.
    clashJobAbortRef.current?.abort();
    const controller = new AbortController();
    clashJobAbortRef.current = controller;
    const projectId = currentProject.id;

    setIsClashLoading(true);
    setClashJobState({
      status: 'queued',
      phase: 'queued',
      checked: 0,
      total: 0,
      error: null,
      usedSyncFallback: false
    });

    try {
      let result: ClashCheckResponse;
      try {
        const started = await startClashJob(projectId, tolerance);
        result = await waitForClashJob(projectId, started.job_id, {
          intervalMs: CLASH_JOB_POLL_INTERVAL_MS,
          signal: controller.signal,
          onProgress: (status) => {
            setClashJobState({
              status: status.status,
              phase: status.progress?.phase ?? 'queued',
              checked: status.progress?.checked ?? 0,
              total: status.progress?.total ?? 0,
              error: status.error
            });
          }
        });
      } catch (e) {
        if (e instanceof ClashJobUnavailableError) {
          // Older backend or a proxy that strips the route: fall back to the synchronous
          // endpoint *once*. The job API exists so this path is never the normal one.
          console.warn('Clash job endpoint unavailable, using the synchronous clash check.');
          setClashJobState({
            status: 'running',
            phase: 'extracting',
            checked: 0,
            total: 0,
            error: null,
            usedSyncFallback: true
          });
          result = await api.runClashCheck(projectId, tolerance);
        } else {
          throw e;
        }
      }

      if (controller.signal.aborted) return;
      setClashResult(result);
      if (result.clashes.length > 0) {
        setActiveClash(result.clashes[0]);
      }
      setClashJobState({ status: 'succeeded', phase: 'done', error: null });
    } catch (e) {
      if (isAbortError(e)) return;
      const message =
        e instanceof Error && e.message
          ? e.message
          : 'Clash detection failed. See the server log for details.';
      console.error('Clash detection failed:', e);
      setClashJobState({ status: 'failed', phase: 'failed', error: message });
      notifyUser({ tone: 'error', text: message });
    } finally {
      // Only the run that still owns the ref may clear the shared loading flag.
      if (clashJobAbortRef.current === controller) {
        clashJobAbortRef.current = null;
        if (!controller.signal.aborted) setIsClashLoading(false);
      }
    }
  }, [currentProject]);

  // Project change: stop polling and never show another project's clashes/progress.
  useEffect(() => {
    clashJobAbortRef.current?.abort();
    clashJobAbortRef.current = null;
    resetClashJobState();
    setClashResult(null);
    setActiveClash(null);
    setIsClashLoading(false);
  }, [currentProject?.id]);

  // Unmount: stop polling (the server-side job is bounded and finishes on its own).
  useEffect(() => () => clashJobAbortRef.current?.abort(), []);

  const handleLoadSampleDiscipline = useCallback(async (discipline: 'STRUCT' | 'MEP') => {
    if (!currentProject) return;
    const sampleFileName = discipline === 'STRUCT' ? 'Ifc4_Revit_STR.ifc' : 'Ifc4_Revit_MEP.ifc';
    try {
      const resp = await fetch(`/modelsfortests/${sampleFileName}`);
      if (!resp.ok) {
        // F-057 residual: the fixtures are local-only (not in git). Say so instead of
        // failing silently when a fresh clone or a production build has no copy.
        notifyUser({
          tone: 'error',
          text: `${discipline} sample model is not available. Place ${sampleFileName} in modelsfortests/ and retry.`,
        });
        return;
      }
      const blob = await resp.blob();
      const file = new File([blob], sampleFileName, { type: 'application/octet-stream' });
      await handleUploadSubModel(file, discipline, `${discipline} Model`);
    } catch (e) {
      console.warn('Could not load sample model:', e);
      notifyUser({
        tone: 'error',
        text: `Could not load the ${discipline} sample model: ${e instanceof Error ? e.message : String(e)}`,
      });
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
      // A native alert blocks the UI and leaves the progress bar looking stuck. Keep the
      // modal usable: reset the progress and surface a non-blocking message instead.
      notifyUser({
        tone: 'error',
        text: `Upload failed: ${msg}${/502|Failed to fetch|NetworkError/i.test(msg) ? ' Is the backend running on port 8000?' : ''}`,
      });
      setLoadingStage('');
      setLoadingPercent(0);
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
      notifyUser({ tone: 'error', text: `Could not create the project: ${msg}` });
      setIsLoading(false);
    }
  }, [refreshProjects, loadProject, onCloseNewProjectModal]);

  const handleDownloadProject = useCallback(async () => {
    if (!currentProject) return;
    // STEP-05 / F-003: a bare `<a href>` cannot send the API token, so the file is fetched
    // through the authenticated helper and saved from a blob instead.
    try {
      await api.downloadProjectFile(
        currentProject.id,
        `${currentProject.name.replace(/\s+/g, '_')}.ifc`
      );
    } catch (err) {
      console.error('Failed to download project:', err);
    }
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
      notifyUser({ tone: 'error', text: `Failed to load the sample model: ${msg}` });
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
