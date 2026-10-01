export interface SpatialNode {
  express_id: number;
  global_id: string;
  name: string;
  type: string;
  children: SpatialNode[];
}

export interface GeometryData {
  expressID: number;
  type: string;
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  matrix: number[]; // 16 floats
  color: [number, number, number, number]; // RGBA [0-1]
}

export interface WorkerParseRequest {
  action: 'PARSE_IFC';
  buffer: ArrayBuffer;
  fileName: string;
}

export interface WorkerProgressResponse {
  type: 'PROGRESS';
  stage: string;
  percent: number;
}

export interface WorkerCompleteResponse {
  type: 'COMPLETE';
  geometries: GeometryData[];
  spatialTree: SpatialNode;
  elementCount: number;
}

export interface WorkerErrorResponse {
  type: 'ERROR';
  message: string;
}

export type WorkerResponse = WorkerProgressResponse | WorkerCompleteResponse | WorkerErrorResponse;

export interface ProjectMetadata {
  id: string;
  name: string;
  description?: string;
  schema_version: string;
  file_name: string;
  file_size: number;
  element_count: number;
  created_at: string;
  updated_at: string;
}

export interface PropertySingle {
  name: string;
  value: unknown;
  value_type: string;
}

export interface PropertySetData {
  name: string;
  properties: PropertySingle[];
}

export interface ElementDetails {
  express_id: number;
  global_id: string;
  name: string;
  type: string;
  psets: PropertySetData[];
  quantities: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: Record<string, unknown>;
}

export interface CopilotChatRequest {
  project_id: string;
  messages: { role: string; content: string }[];
  provider: string;
  model?: string;
  api_key?: string;
  base_url?: string;
  selected_express_id?: number | null;
}

export interface CopilotChatResponse {
  message: { role: string; content: string };
  tool_calls: ToolCall[];
  project_updated: boolean;
}

export interface AIProvider {
  id: string;
  name: string;
  models: string[];
  default_model: string;
  default_base_url?: string;
  requires_api_key: boolean;
}

