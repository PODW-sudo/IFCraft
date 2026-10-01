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
