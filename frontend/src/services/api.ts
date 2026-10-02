import type { ProjectMetadata, SpatialNode } from '../types/ifc';

const BASE_URL = '/api';

export async function fetchProjects(): Promise<ProjectMetadata[]> {
  const res = await fetch(`${BASE_URL}/projects`);
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.statusText}`);
  return res.json();
}

export async function createProject(
  name: string,
  description?: string,
  schema_version: string = 'IFC4'
): Promise<ProjectMetadata> {
  const res = await fetch(`${BASE_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, schema_version })
  });
  if (!res.ok) throw new Error(`Failed to create project: ${res.statusText}`);
  return res.json();
}

export async function uploadIFCFile(
  file: File,
  name?: string,
  description?: string
): Promise<ProjectMetadata> {
  const formData = new FormData();
  formData.append('file', file);
  if (name) formData.append('name', name);
  if (description) formData.append('description', description);

  const res = await fetch(`${BASE_URL}/projects/upload`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to upload IFC file');
  }
  return res.json();
}

export async function fetchSpatialTree(projectId: string): Promise<SpatialNode> {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/spatial-tree`);
  if (!res.ok) throw new Error(`Failed to load spatial tree: ${res.statusText}`);
  return res.json();
}

export function getDownloadUrl(projectId: string): string {
  return `${BASE_URL}/projects/${projectId}/download`;
}

export async function fetchCopilotProviders(): Promise<import('../types/ifc').AIProvider[]> {
  const res = await fetch(`${BASE_URL}/copilot/providers`);
  if (!res.ok) throw new Error(`Failed to fetch AI providers: ${res.statusText}`);
  return res.json();
}

export async function sendCopilotChat(
  request: import('../types/ifc').CopilotChatRequest
): Promise<import('../types/ifc').CopilotChatResponse> {
  const res = await fetch(`${BASE_URL}/copilot/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'AI Copilot chat failed');
  }
  return res.json();
}

export async function fetchSampleModels(): Promise<Array<{
  id: string;
  name: string;
  description: string;
  schema_version: string;
  element_count: number;
}>> {
  const res = await fetch(`${BASE_URL}/projects/samples/list`);
  if (!res.ok) throw new Error(`Failed to fetch sample models: ${res.statusText}`);
  return res.json();
}

export async function loadSampleProject(sampleId: string): Promise<ProjectMetadata> {
  const res = await fetch(`${BASE_URL}/projects/samples/${sampleId}/load`, {
    method: 'POST'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to load sample project');
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Phase 10: Multi-Model Federation & Clash Detection APIs
// ---------------------------------------------------------------------------

export async function fetchSubModels(projectId: string): Promise<import('../types/ifc').SubModel[]> {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/models`);
  if (!res.ok) throw new Error(`Failed to fetch sub-models: ${res.statusText}`);
  return res.json();
}

export async function uploadSubModel(
  projectId: string,
  file: File,
  discipline: string = 'ARCH',
  name?: string
): Promise<import('../types/ifc').SubModel> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('discipline', discipline);
  if (name) formData.append('name', name);

  const res = await fetch(`${BASE_URL}/projects/${projectId}/models`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to upload sub-model');
  }
  return res.json();
}

export async function deleteSubModel(projectId: string, modelId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/models/${modelId}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error(`Failed to delete sub-model: ${res.statusText}`);
}

export function getSubModelDownloadUrl(projectId: string, modelId: string): string {
  return `${BASE_URL}/projects/${projectId}/models/${modelId}/download`;
}

export async function runClashCheck(
  projectId: string,
  tolerance: number = 0.01,
  modelIds?: string[]
): Promise<import('../types/ifc').ClashCheckResponse> {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/clashes/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tolerance, model_ids: modelIds })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Clash detection failed');
  }
  return res.json();
}

// ===========================================================================
// CAD Modeling & Parametric Synthesis (Phase 11)
// ===========================================================================

export async function createCadWall(
  projectId: string,
  req: import('../types/ifc').CadWallRequest
): Promise<import('../types/ifc').CadElementResponse> {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/cad/wall`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to create wall');
  }
  return res.json();
}

export async function createCadSlab(
  projectId: string,
  req: import('../types/ifc').CadSlabRequest
): Promise<import('../types/ifc').CadElementResponse> {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/cad/slab`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to create slab');
  }
  return res.json();
}

export async function createCadColumn(
  projectId: string,
  req: import('../types/ifc').CadColumnRequest
): Promise<import('../types/ifc').CadElementResponse> {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/cad/column`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to create column');
  }
  return res.json();
}

export async function createCadOpening(
  projectId: string,
  req: import('../types/ifc').CadOpeningRequest
): Promise<import('../types/ifc').CadElementResponse> {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/cad/opening`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to create opening');
  }
  return res.json();
}

export async function undoCad(
  projectId: string
): Promise<import('../types/ifc').CadUndoRedoResponse> {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/cad/undo`, {
    method: 'POST'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to undo');
  }
  return res.json();
}

export async function redoCad(
  projectId: string
): Promise<import('../types/ifc').CadUndoRedoResponse> {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/cad/redo`, {
    method: 'POST'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to redo');
  }
  return res.json();
}

export async function fetchCadHistory(
  projectId: string
): Promise<import('../types/ifc').CadHistoryResponse> {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/cad/history`);
  if (!res.ok) throw new Error(`Failed to fetch CAD history: ${res.statusText}`);
  return res.json();
}

// ===========================================================================
// BCF 2.1 & Temporal Audit API (Phase 12)
// ===========================================================================

export async function fetchBcfTopics(
  projectId: string
): Promise<import('../types/ifc').BcfTopic[]> {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/bcf/topics`);
  if (!res.ok) throw new Error(`Failed to fetch BCF topics: ${res.statusText}`);
  return res.json();
}

export async function createBcfTopic(
  projectId: string,
  req: import('../types/ifc').BcfTopicCreateRequest
): Promise<import('../types/ifc').BcfTopic> {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/bcf/topics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to create BCF topic');
  }
  return res.json();
}

export async function importClashesToBcf(
  projectId: string,
  clashes: import('../types/ifc').ClashRecord[]
): Promise<{ success: boolean; imported_topics_count: number }> {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/bcf/from-clashes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clashes })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to import clashes to BCF');
  }
  return res.json();
}

export function getBcfExportUrl(projectId: string): string {
  return `${BASE_URL}/projects/${projectId}/bcf/export`;
}

export async function fetchAuditTimeline(
  projectId: string
): Promise<import('../types/ifc').AuditTimelineItem[]> {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/audit/timeline`);
  if (!res.ok) throw new Error(`Failed to fetch audit timeline: ${res.statusText}`);
  return res.json();
}

export async function fetchAuditDiff(
  projectId: string
): Promise<import('../types/ifc').AuditDiffResponse> {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/audit/diff`);
  if (!res.ok) throw new Error(`Failed to fetch audit diff: ${res.statusText}`);
  return res.json();
}




