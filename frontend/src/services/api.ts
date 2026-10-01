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

