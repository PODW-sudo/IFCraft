import * as THREE from 'three';

export type InteractiveEditMode =
  | 'none'
  | 'move'
  | 'rotate'
  | 'mirror'
  | 'multiply'
  | 'elevate'
  | 'special_pick';

export type MultiplyInputMethod = 'increment' | 'increment_spread' | 'spread' | 'distribute';

export interface InteractiveEditState {
  mode: InteractiveEditMode;
  step: number; // 1 = origin/center, 2 = destination/ray, 3 = target angle
  originPoint: THREE.Vector3 | null;
  referenceRayPoint: THREE.Vector3 | null;
  currentPoint: THREE.Vector3 | null;
  isCopyMode: boolean; // toggled by Ctrl (Drag a copy / Rotate a copy)
  isMultiCopy: boolean; // toggled by Ctrl+Alt
  isOrthoLocked: boolean; // toggled by Shift
  multiplyCount: number;
  multiplySpacing: number;
  multiplyMethod: MultiplyInputMethod;
  rotateAxis: 'x' | 'y' | 'z' | 'custom';
  customRotateAxis?: { start: THREE.Vector3; end: THREE.Vector3 };
  mirrorPlane: 'x' | 'y' | 'z' | 'line';
  mirrorAxisPoints?: { p1: THREE.Vector3; p2: THREE.Vector3 };
}

export interface TrackerReadout {
  mode?: InteractiveEditMode;
  step?: number;
  distance: number;
  angle: number;
  dx: number;
  dy: number;
  dz: number;
  screenPos: { x: number; y: number };
  activeField: 'distance' | 'angle' | 'dx' | 'dy' | 'dz';
  prompt: string;
  stepDescription?: string;
  isCopyActive?: boolean;
  isOrthoActive?: boolean;
  isCopyMode?: boolean;
  isOrthoLocked?: boolean;
}

export interface MoveCopySpecialParams {
  type: 'linear' | 'rotate' | 'mirror';
  // Linear params
  dx: number;
  dy: number;
  dz: number;
  copies: number;
  isCopy: boolean;
  // Rotate params
  rotateAxis: 'x' | 'y' | 'z' | 'line';
  pivot: [number, number, number];
  angleDegrees: number;
  pitchDz: number;
  // Mirror params
  mirrorAxis: 'x' | 'y' | 'z';
}
