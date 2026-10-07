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
  modelId?: string;
  discipline?: DisciplineType;
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
  has_server_key?: boolean;
}

export type DisciplineType = 'ARCH' | 'STRUCT' | 'MEP' | 'CIVIL' | 'OTHER';

export interface SubModel {
  id: string;
  project_id: string;
  name: string;
  discipline: DisciplineType;
  file_name: string;
  file_size: number;
  element_count: number;
  created_at: string;
  visible?: boolean;
  opacity?: number;
}

export interface ClashRecord {
  id: string;
  element_a_id: number;
  element_a_name: string;
  element_a_type: string;
  model_a_id: string;
  model_a_name: string;
  discipline_a: string;

  element_b_id: number;
  element_b_name: string;
  element_b_type: string;
  model_b_id: string;
  model_b_name: string;
  discipline_b: string;

  severity: 'hard' | 'clearance';
  distance: number;
  intersection_center: [number, number, number];
  box_min: [number, number, number];
  box_max: [number, number, number];
}

export interface ClashCheckResponse {
  total_clashes: number;
  hard_clashes: number;
  clearance_clashes: number;
  tolerance: number;
  clashes: ClashRecord[];
  duration_ms: number;
}

export type CadToolMode = 'select' | 'wall' | 'slab' | 'column' | 'door' | 'window';

export interface CadWallRequest {
  start: [number, number];
  end: [number, number];
  elevation?: number;
  height?: number;
  thickness?: number;
  name?: string;
  storey_id?: number;
}

export interface CadSlabRequest {
  boundary: [number, number][];
  elevation?: number;
  thickness?: number;
  name?: string;
  storey_id?: number;
}

export interface CadColumnRequest {
  position: [number, number];
  elevation?: number;
  height?: number;
  width?: number;
  depth?: number;
  name?: string;
  storey_id?: number;
}

export interface CadOpeningRequest {
  host_wall_id: number;
  opening_type: 'door' | 'window';
  offset_along_wall?: number;
  sill_height?: number;
  width?: number;
  height?: number;
  thickness?: number;
  name?: string;
}

export interface CadElementResponse {
  success: boolean;
  express_id: number;
  global_id: string;
  entity_type: string;
  name: string;
  transaction_id: string;
  opening_express_id?: number;
  message: string;
}

export interface CadUndoRedoResponse {
  success: boolean;
  transaction_id: string;
  action: string;
  affected_express_id: number;
  can_undo: boolean;
  can_redo: boolean;
  message: string;
}

export interface CadHistoryItem {
  id: string;
  action_type: string;
  express_id: number;
  entity_type: string;
  parameters: Record<string, unknown>;
  status: 'ACTIVE' | 'UNDONE';
  created_at: string;
}

export interface CadHistoryResponse {
  history: CadHistoryItem[];
  can_undo: boolean;
  can_redo: boolean;
}

export interface CadCloneRequest {
  delta?: [number, number, number];
  storey_id?: number;
}

export interface CadGeometryUpdateRequest {
  height?: number;
  thickness?: number;
  width?: number;
  depth?: number;
  elevation?: number;
}

export interface CadAssignStoreyRequest {
  storey_id: number;
}

export interface CadMaterialRequest {
  material_name: string;
  color_hex?: string;
  transparency?: number;
}

export interface BcfTopic {
  id: string;
  project_id: string;
  title: string;
  description: string;
  topic_type: string;
  topic_status: string;
  priority: 'Low' | 'Normal' | 'High' | 'Critical' | string;
  creation_author: string;
  camera_position?: [number, number, number];
  camera_target?: [number, number, number];
  selected_elements: number[];
  created_at: string;
  updated_at: string;
}

export interface BcfTopicCreateRequest {
  title: string;
  description?: string;
  topic_type?: string;
  topic_status?: string;
  priority?: string;
  camera_position?: [number, number, number];
  camera_target?: [number, number, number];
  selected_elements?: number[];
}

export interface AuditTimelineItem {
  id: number;
  project_id: string;
  user_id: string;
  user_name: string;
  action_type: string;
  express_id?: number | null;
  entity_type?: string | null;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface AuditDiffResponse {
  total_elements: number;
  added: number[];
  modified: number[];
  deleted: number[];
}


