import type { ProjectMetadata, SpatialNode } from '../types/ifc';
import { withSaveStatus } from './saveStatus';

const BASE_URL = '/api';

/** STEP-05 / F-003 — the header every protected route expects (`core/security.py`). */
const API_TOKEN_HEADER = 'X-API-Token';

/**
 * STEP-05 / F-003 — the one place that talks to the API.
 *
 * The backend now requires `X-API-Token` on every `/api` route except `/api/bootstrap/token`.
 * The token is fetched once per page load from that bootstrap endpoint (Origin-gated there, so
 * a foreign page cannot read it) and cached for the lifetime of the tab.
 *
 * Every request in this module — and every raw call site outside it (gizmo placement, element
 * details, model download) — goes through `apiFetch`. Do not call `fetch` with an `/api` URL
 * directly: it will 401.
 */
let cachedToken: string | null = null;
let tokenRequest: Promise<string> | null = null;

async function requestToken(): Promise<string> {
  // The bootstrap route itself is public; `apiFetch` would recurse (and has no token yet).
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/bootstrap/token`, { cache: 'no-store' });
  } catch (err) {
    throw new Error(
      `Cannot reach the backend (${err instanceof Error ? err.message : String(err)}). Is uvicorn running on port 8000?`
    );
  }
  if (!res.ok) {
    const hint = res.status >= 500 ? ' The backend appears to be down or still starting.' : '';
    throw new Error(
      `Failed to obtain the API token (HTTP ${res.status} ${res.statusText}).${hint}`
    );
  }
  const body = (await res.json()) as { token?: string };
  if (!body || typeof body.token !== 'string' || !body.token) {
    throw new Error('The API token bootstrap endpoint returned no token');
  }
  return body.token;
}

/** Resolve the API token, de-duplicating concurrent callers into a single bootstrap request. */
export async function getApiToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  if (!tokenRequest) {
    tokenRequest = requestToken()
      .then((token) => {
        cachedToken = token;
        return token;
      })
      .finally(() => {
        tokenRequest = null;
      });
  }
  return tokenRequest;
}

/** Test seam / logout: prime or clear the cached token. */
export function setApiToken(token: string | null): void {
  cachedToken = token;
  tokenRequest = null;
}

/** `fetch` with the API token attached. All `/api` traffic must go through this. */
export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getApiToken();
  const headers = new Headers(init.headers);
  headers.set(API_TOKEN_HEADER, token);
  return fetch(url, { ...init, headers });
}

// ---------------------------------------------------------------------------------------------
// Signed session identity (open issue 3.5)
// ---------------------------------------------------------------------------------------------

/** What `POST /api/bootstrap/session` returns (`backend/app/api/bootstrap.py`). */
export interface SessionToken {
  token: string;
  userId: string;
  /** Unix seconds, as issued by the server. */
  expiresAt: number;
}

/** Refresh this long before expiry so a reconnect never presents a token about to lapse. */
const SESSION_TOKEN_REFRESH_MARGIN_MS = 60_000;

const sessionTokens = new Map<string, SessionToken>();
const sessionTokenRequests = new Map<string, Promise<SessionToken>>();

async function requestSessionToken(userId: string): Promise<SessionToken> {
  if (!userId) throw new Error('A user id is required to obtain a session token');

  const res = await apiFetch(`${BASE_URL}/bootstrap/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId })
  });
  if (!res.ok) {
    throw new Error(
      `Failed to obtain a session token (HTTP ${res.status} ${res.statusText})`
    );
  }

  const body = (await res.json()) as {
    session_token?: string;
    user_id?: string;
    expires_at?: number;
  };
  if (!body || typeof body.session_token !== 'string' || !body.session_token) {
    throw new Error('The session bootstrap endpoint returned no session token');
  }
  const expiresAt =
    typeof body.expires_at === 'number' && Number.isFinite(body.expires_at)
      ? body.expires_at
      : Math.floor(Date.now() / 1000) + 60;

  const entry: SessionToken = { token: body.session_token, userId, expiresAt };
  sessionTokens.set(userId, entry);
  return entry;
}

/**
 * Issue 3.5 — the signed identity the WebSocket `JOIN` now has to present.
 *
 * Cached per user id until (just before) the server-side expiry, and de-duplicated so two
 * sockets for the same profile in one tab share one bootstrap request. Goes through `apiFetch`
 * because the route sits behind the API token like the rest of `/api`.
 */
export async function fetchSessionToken(userId: string): Promise<string> {
  const cached = sessionTokens.get(userId);
  if (cached && cached.expiresAt * 1000 - Date.now() > SESSION_TOKEN_REFRESH_MARGIN_MS) {
    return cached.token;
  }

  const pending = sessionTokenRequests.get(userId);
  if (pending) return (await pending).token;

  const request = requestSessionToken(userId).finally(() => {
    sessionTokenRequests.delete(userId);
  });
  sessionTokenRequests.set(userId, request);
  return (await request).token;
}

/** Drop a cached token — the server said it is not acceptable (close 1008) or it expired. */
export function invalidateSessionToken(userId: string): void {
  sessionTokens.delete(userId);
  sessionTokenRequests.delete(userId);
}

/** Test seam: forget every cached session token. */
export function clearSessionTokens(): void {
  sessionTokens.clear();
  sessionTokenRequests.clear();
}


/**
 * STEP-21 / issue 1.3 — a refused write keeps its machine-readable reason.
 *
 * FastAPI returns `{"detail": {"code": "unsupported_geometry", "message": "..."}}` for a
 * geometry refusal. `new Error(err.detail)` turned that object into `[object Object]`, so the
 * UI could neither show the reason nor branch on the code. This error carries both.
 */
export class ApiError extends Error {
  readonly code?: string;
  readonly status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface ApiErrorDetailRecord {
  message?: unknown;
  code?: unknown;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Turn a failed response body into an `ApiError`.
 *
 * Precedence for the message: structured `detail.message` → `detail.code` → `statusText` →
 * caller fallback. `code` is only set when the server sent one.
 */
export function buildApiError(
  body: unknown,
  status: number,
  statusText: string,
  fallback: string
): ApiError {
  const detail = (body as { detail?: unknown } | null | undefined)?.detail;
  if (detail && typeof detail === 'object') {
    const record = detail as ApiErrorDetailRecord;
    const code = nonEmptyString(record.code);
    const message =
      nonEmptyString(record.message) ??
      code ??
      nonEmptyString(statusText) ??
      fallback;
    return new ApiError(message, status, code);
  }
  return new ApiError(nonEmptyString(detail) ?? nonEmptyString(statusText) ?? fallback, status);
}

/** Saves a fetched blob through an object URL — the only way to download with a header. */
function saveBlob(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // The download starts asynchronously; revoking too early cancels it.
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export async function fetchProjects(): Promise<ProjectMetadata[]> {
  const res = await apiFetch(`${BASE_URL}/projects`);
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.statusText}`);
  return res.json();
}

export async function createProject(
  name: string,
  description?: string,
  schema_version: string = 'IFC4'
): Promise<ProjectMetadata> {
  const res = await apiFetch(`${BASE_URL}/projects`, {
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

  const res = await apiFetch(`${BASE_URL}/projects/upload`, {
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
  const res = await apiFetch(`${BASE_URL}/projects/${projectId}/spatial-tree`);
  if (!res.ok) throw new Error(`Failed to load spatial tree: ${res.statusText}`);
  return res.json();
}

export function getDownloadUrl(projectId: string): string {
  return `${BASE_URL}/projects/${projectId}/download`;
}

/**
 * STEP-05 / F-003 — downloads the project IFC *with* the API token.
 *
 * A bare `<a href>` (or `window.open`) cannot attach a request header, so the route would
 * answer 401. The file is fetched through `apiFetch` and saved from a blob instead.
 */
export async function downloadProjectFile(projectId: string, fileName: string): Promise<void> {
  const res = await apiFetch(getDownloadUrl(projectId));
  if (!res.ok) throw new Error(`Failed to download project: ${res.statusText}`);
  saveBlob(await res.blob(), fileName);
}

export async function fetchCopilotProviders(): Promise<import('../types/ifc').AIProvider[]> {
  const res = await apiFetch(`${BASE_URL}/copilot/providers`);
  if (!res.ok) throw new Error(`Failed to fetch AI providers: ${res.statusText}`);
  return res.json();
}

export async function fetchCopilotModels(
  request: import('../types/ifc').CopilotModelsRequest
): Promise<import('../types/ifc').CopilotModelsResponse> {
  const res = await apiFetch(`${BASE_URL}/copilot/models`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to fetch Copilot models');
  }
  return res.json();
}


export async function sendCopilotChat(
  request: import('../types/ifc').CopilotChatRequest
): Promise<import('../types/ifc').CopilotChatResponse> {
  const res = await apiFetch(`${BASE_URL}/copilot/chat`, {
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
  const res = await apiFetch(`${BASE_URL}/projects/samples/list`);
  if (!res.ok) throw new Error(`Failed to fetch sample models: ${res.statusText}`);
  return res.json();
}

export async function loadSampleProject(sampleId: string): Promise<ProjectMetadata> {
  const res = await apiFetch(`${BASE_URL}/projects/samples/${sampleId}/load`, {
    method: 'POST'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to load sample project');
  }
  return res.json();
}

export async function getElementDetails(
  projectId: string,
  expressId: number
): Promise<import('../types/ifc').ElementDetails> {
  const res = await apiFetch(`${BASE_URL}/projects/${projectId}/elements/${expressId}`);
  if (!res.ok) throw new Error(`Failed to load element details: ${res.statusText}`);
  return res.json();
}

/**
 * Writes one property value to an element (STEP-14/STEP-29).
 *
 * `POST` is the only method registered for this route; the payload field is
 * `property_name` (not `name`). Both are required by
 * `PropertyUpdatePayload` - getting either wrong returns 405/422 and used to be
 * swallowed into a console.error.
 */
export async function updateElementProperty(
  projectId: string,
  expressId: number,
  payload: { pset_name: string; property_name: string; value: unknown; value_type?: string }
): Promise<void> {
  // STEP-28 / F-050: a property edit is the write the save pill is judged on, so it is
  // reported like the other element mutations even though the doc calls the raw fetch in
  // GlassPropertyInspector the "write" - that one is a GET (details loader).
  return withSaveStatus(async () => {
    const res = await apiFetch(`${BASE_URL}/projects/${projectId}/elements/${expressId}/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value_type: 'IfcLabel', ...payload })
    });
    if (res.ok) return;

    const detail = (await res.json().catch(() => null)) as
      | { detail?: string | Array<{ msg?: string }> }
      | null;
    const message = Array.isArray(detail?.detail)
      ? detail.detail.map((d) => d.msg).filter(Boolean).join('; ')
      : detail?.detail;
    throw new Error(`Failed to update property: ${message || res.statusText || `HTTP ${res.status}`}`);
  });
}

// ---------------------------------------------------------------------------
// Phase 10: Multi-Model Federation & Clash Detection APIs
// ---------------------------------------------------------------------------

export async function fetchSubModels(projectId: string): Promise<import('../types/ifc').SubModel[]> {
  const res = await apiFetch(`${BASE_URL}/projects/${projectId}/models`);
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

  const res = await apiFetch(`${BASE_URL}/projects/${projectId}/models`, {
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
  const res = await apiFetch(`${BASE_URL}/projects/${projectId}/models/${modelId}`, {
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
  const res = await apiFetch(`${BASE_URL}/projects/${projectId}/clashes/check`, {
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
  const res = await apiFetch(`${BASE_URL}/projects/${projectId}/cad/wall`, {
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
  const res = await apiFetch(`${BASE_URL}/projects/${projectId}/cad/slab`, {
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
  const res = await apiFetch(`${BASE_URL}/projects/${projectId}/cad/column`, {
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
  const res = await apiFetch(`${BASE_URL}/projects/${projectId}/cad/opening`, {
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
  const res = await apiFetch(`${BASE_URL}/projects/${projectId}/cad/undo`, {
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
  const res = await apiFetch(`${BASE_URL}/projects/${projectId}/cad/redo`, {
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
  const res = await apiFetch(`${BASE_URL}/projects/${projectId}/cad/history`);
  if (!res.ok) throw new Error(`Failed to fetch CAD history: ${res.statusText}`);
  return res.json();
}

export async function deleteElement(
  projectId: string,
  expressId: number
): Promise<{ success: boolean; express_id: number; message: string }> {
  // STEP-28 / F-050: surface the write outcome in the header save pill.
  return withSaveStatus(async () => {
    const res = await apiFetch(`${BASE_URL}/projects/${projectId}/cad/elements/${expressId}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Failed to delete element');
    }
    return res.json();
  });
}

export async function cloneElement(
  projectId: string,
  expressId: number,
  req: import('../types/ifc').CadCloneRequest = { delta: [1.0, 0.0, 0.0] }
): Promise<import('../types/ifc').CadElementResponse> {
  // STEP-28 / F-050: surface the write outcome in the header save pill.
  return withSaveStatus(async () => {
    const res = await apiFetch(`${BASE_URL}/projects/${projectId}/cad/elements/${expressId}/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Failed to clone element');
    }
    return res.json();
  });
}

export async function moveElement(
  projectId: string,
  expressId: number,
  req: import('../types/ifc').CadMoveRequest
): Promise<import('../types/ifc').CadElementResponse> {
  // STEP-28 / F-050: surface the write outcome in the header save pill.
  return withSaveStatus(async () => {
    const res = await apiFetch(`${BASE_URL}/projects/${projectId}/cad/elements/${expressId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Failed to move element');
    }
    return res.json();
  });
}

export async function rotateElement(
  projectId: string,
  expressId: number,
  req: import('../types/ifc').CadRotateRequest
): Promise<import('../types/ifc').CadElementResponse> {
  // STEP-28 / F-050: surface the write outcome in the header save pill.
  return withSaveStatus(async () => {
    const res = await apiFetch(`${BASE_URL}/projects/${projectId}/cad/elements/${expressId}/rotate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Failed to rotate element');
    }
    return res.json();
  });
}

export async function mirrorElement(
  projectId: string,
  expressId: number,
  req: import('../types/ifc').CadMirrorRequest
): Promise<import('../types/ifc').CadElementResponse> {
  // STEP-28 / F-050: surface the write outcome in the header save pill.
  return withSaveStatus(async () => {
    const res = await apiFetch(`${BASE_URL}/projects/${projectId}/cad/elements/${expressId}/mirror`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Failed to mirror element');
    }
    return res.json();
  });
}

export async function arrayElement(
  projectId: string,
  expressId: number,
  req: import('../types/ifc').CadArrayRequest
): Promise<import('../types/ifc').CadElementResponse[]> {
  // STEP-28 / F-050: surface the write outcome in the header save pill.
  return withSaveStatus(async () => {
    const res = await apiFetch(`${BASE_URL}/projects/${projectId}/cad/elements/${expressId}/array`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Failed to array element');
    }
    return res.json();
  });
}

export async function alignElement(
  projectId: string,
  expressId: number,
  req: import('../types/ifc').CadAlignRequest
): Promise<import('../types/ifc').CadElementResponse> {
  // STEP-28 / F-050: surface the write outcome in the header save pill.
  return withSaveStatus(async () => {
    const res = await apiFetch(`${BASE_URL}/projects/${projectId}/cad/elements/${expressId}/align`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Failed to align element');
    }
    return res.json();
  });
}

export async function pinElement(
  projectId: string,
  expressId: number,
  req: import('../types/ifc').CadPinRequest
): Promise<{ success: boolean; express_id: number; is_pinned: boolean }> {
  // STEP-28 / F-050: surface the write outcome in the header save pill.
  return withSaveStatus(async () => {
    const res = await apiFetch(`${BASE_URL}/projects/${projectId}/cad/elements/${expressId}/pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Failed to pin/unpin element');
    }
    return res.json();
  });
}

export async function fetchPinnedElements(
  projectId: string
): Promise<{ project_id: string; pinned_ids: number[] }> {
  const res = await apiFetch(`${BASE_URL}/projects/${projectId}/cad/pinned`);
  if (!res.ok) throw new Error(`Failed to fetch pinned elements: ${res.statusText}`);
  return res.json();
}

export async function updateElementGeometry(
  projectId: string,
  expressId: number,
  req: import('../types/ifc').CadGeometryUpdateRequest
): Promise<{ success: boolean; express_id: number; updated: boolean }> {
  // STEP-28 / F-050: surface the write outcome in the header save pill.
  return withSaveStatus(async () => {
    const res = await apiFetch(`${BASE_URL}/projects/${projectId}/cad/elements/${expressId}/geometry`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    if (!res.ok) {
      // STEP-21 / issue 1.3 — keep `detail.code` and `detail.message` (see `ApiError`).
      const body = await res.json().catch(() => null);
      throw buildApiError(body, res.status, res.statusText, 'Failed to update geometry');
    }
    return res.json();
  });
}

export async function assignElementStorey(
  projectId: string,
  expressId: number,
  req: import('../types/ifc').CadAssignStoreyRequest
): Promise<{ success: boolean; express_id: number; storey_id: number }> {
  // STEP-28 / F-050: surface the write outcome in the header save pill.
  return withSaveStatus(async () => {
    const res = await apiFetch(`${BASE_URL}/projects/${projectId}/cad/elements/${expressId}/assign-storey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Failed to assign storey');
    }
    return res.json();
  });
}

export async function assignElementMaterial(
  projectId: string,
  expressId: number,
  req: import('../types/ifc').CadMaterialRequest
): Promise<{ success: boolean; express_id: number; material: string }> {
  // STEP-28 / F-050: surface the write outcome in the header save pill.
  return withSaveStatus(async () => {
    const res = await apiFetch(`${BASE_URL}/projects/${projectId}/cad/elements/${expressId}/material`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Failed to assign material');
    }
    return res.json();
  });
}


// ===========================================================================
// BCF 2.1 & Temporal Audit API (Phase 12)
// ===========================================================================

export async function fetchBcfTopics(
  projectId: string
): Promise<import('../types/ifc').BcfTopic[]> {
  const res = await apiFetch(`${BASE_URL}/projects/${projectId}/bcf/topics`);
  if (!res.ok) throw new Error(`Failed to fetch BCF topics: ${res.statusText}`);
  return res.json();
}

export async function createBcfTopic(
  projectId: string,
  req: import('../types/ifc').BcfTopicCreateRequest
): Promise<import('../types/ifc').BcfTopic> {
  const res = await apiFetch(`${BASE_URL}/projects/${projectId}/bcf/topics`, {
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
  const res = await apiFetch(`${BASE_URL}/projects/${projectId}/bcf/from-clashes`, {
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

/** STEP-05 / F-003 — authenticated BCF 2.1 archive download (see `downloadProjectFile`). */
export async function downloadBcfArchive(projectId: string, fileName: string): Promise<void> {
  const res = await apiFetch(getBcfExportUrl(projectId));
  if (!res.ok) throw new Error(`Failed to export BCF topics: ${res.statusText}`);
  saveBlob(await res.blob(), fileName);
}

export async function fetchAuditTimeline(
  projectId: string
): Promise<import('../types/ifc').AuditTimelineItem[]> {
  const res = await apiFetch(`${BASE_URL}/projects/${projectId}/audit/timeline`);
  if (!res.ok) throw new Error(`Failed to fetch audit timeline: ${res.statusText}`);
  return res.json();
}

export async function fetchAuditDiff(
  projectId: string
): Promise<import('../types/ifc').AuditDiffResponse> {
  const res = await apiFetch(`${BASE_URL}/projects/${projectId}/audit/diff`);
  if (!res.ok) throw new Error(`Failed to fetch audit diff: ${res.statusText}`);
  return res.json();
}




