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


