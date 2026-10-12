/**
 * Unified Viewport and CAD Types
 * Extracted from legacy BimToolsToolbar to decouple tools from types.
 */

export type CameraPreset = 'iso' | 'top' | 'front' | 'side';

export type RenderStyle = 'shaded' | 'wireframe' | 'ghost' | 'discipline' | 'diff';

export interface SectionPlaneConfig {
  enabled: boolean;
  axis: 'x' | 'y' | 'z';
  position: number;
  inverted: boolean;
}

export type TransformMode = 'select' | 'translate' | 'rotate' | 'scale';

export type CanvasTool = 'orbit' | 'pan' | 'measure' | 'zoom' | 'section' | 'isolate' | 'link' | 'settings';

export interface MeasurementRecord {
  id: string;
  start: [number, number, number];
  end: [number, number, number];
  distance: number;
  midpoint: [number, number, number];
}
