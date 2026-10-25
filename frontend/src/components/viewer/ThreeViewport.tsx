import React, { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';

// Extend Three.js prototypes for geometry acceleration if needed
(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
import type { GeometryData } from '../../types/ifc';
import type { CameraPreset, RenderStyle, SectionPlaneConfig } from '../../types/viewport';
import { SpatialContextMenu } from './SpatialContextMenu';
import { DraftingInputHud } from './DraftingInputHud';
import { CadTrackerHud } from './CadTrackerHud';
import type { InteractiveEditMode, InteractiveEditState, TrackerReadout } from '../../types/cadEditing';
import { DEFAULT_EDITOR_SETTINGS, THEME_COLOR_MAP, type EditorSettings } from '../../types/settings';
import { createGroundGrid } from '../../utils/viewportGrid';
import { buildOrbitControlConfig } from '../../utils/viewportControls';
import {
  applyBatchVisibility,
  applyInstanceColors,
  createBatchLike,
  isInstanceVisible,
  type BatchLike,
  type BatchRegistryEntry
} from '../../utils/instanceVisibility';
import { disposeHighlightGroup, markSharedGeometry } from './highlightDisposal';
import { createHoverScheduler, type HoverScheduler } from './hoverScheduler';
import { disposeSceneGraph } from './sceneTeardown';
import { createNavigationTuning, type NavigationTuning } from './navigationTuning';
import { capturePreDragMatrix, registerSceneMatrixHandle } from '../../services/meshMatrixBridge';

export type TransformMode = 'select' | 'translate' | 'rotate' | 'scale';

export type SnapType = 'vertex' | 'midpoint' | 'surface';

export interface ActiveSnap {
  point: THREE.Vector3;
  type: SnapType;
  screenPos: { x: number; y: number };
}

export interface PreviewMeasure {
  distance: number;
  dx: number;
  dy: number;
  dz: number;
  midpointScreen: { x: number; y: number };
}

export interface MeasurementRecord {
  id: string;
  start: [number, number, number];
  end: [number, number, number];
  distance: number;
  midpoint: [number, number, number];
}

interface ThreeViewportProps {
  settings?: EditorSettings;
  geometries: GeometryData[];
  selectedExpressID: number | null;
  onSelectElement: (expressID: number | null) => void;
  hiddenCategories: Set<string>;
  isolatedExpressID: number | null;
  transformMode: TransformMode;
  onSetTransformMode?: (mode: TransformMode) => void;
  snapEnabled: boolean;
  onTransformEnd: (expressID: number, matrix: number[]) => void;
  onTransformChange?: (expressID: number, pos: [number, number, number], rot: [number, number, number]) => void;
  // Phase 4 Props
  isMeasureActive: boolean;
  measurements: MeasurementRecord[];
  onAddMeasurement: (record: MeasurementRecord) => void;
  onSelectMeasurement?: (record: MeasurementRecord) => void;
  onCancelMeasure?: () => void;
  sectionConfig: SectionPlaneConfig;
  cameraPresetTrigger?: { preset: CameraPreset; timestamp: number } | null;
  onCameraPreset?: (preset: CameraPreset) => void;
  renderStyle: RenderStyle;
  // Phase 5 Props: Real-time Collaboration & Soft Locks
  elementLocks?: Record<number, { user_id: string; user_name: string; user_color: string }>;
  remoteTransform?: { expressID: number; matrix: number[] } | null;
  // Dynamic HUD Collision Avoidance
  isRightDrawerOpen?: boolean;
  rightDrawerWidth?: number;
  // Phase 10 Props: Multi-Model Federation & Clash Detection
  hiddenModelIds?: Set<string>;
  activeClash?: import('../../types/ifc').ClashRecord | null;
  // Phase 12 Props: Spatial Change Audit Diff
  auditDiff?: import('../../types/ifc').AuditDiffResponse | null;

  // Phase 11 Props: Interactive CAD Modeling
  cadToolMode?: import('../../types/ifc').CadToolMode;
  onCadDrawWall?: (start: [number, number], end: [number, number]) => void;
  onCadDrawSlab?: (corner1: [number, number], corner2: [number, number]) => void;
  onCadDrawColumn?: (pos: [number, number]) => void;
  onCadDrawOpening?: (hostWallId: number, offsetAlongWall: number) => void;
  onCadCancel?: () => void;

  // Modern In-Viewport BIM Editing
  elementDetails?: import('../../types/ifc').ElementDetails | null;
  storeys?: { id: number; name: string; elevation: number }[];
  onCloneElement?: (expressId: number) => void;
  onDeleteElement?: (expressId: number) => void;
  onUpdateGeometry?: (expressId: number, params: { height?: number; thickness?: number; elevation?: number }) => void;
  onAssignStorey?: (expressId: number, storeyId: number) => void;
  onAssignMaterial?: (expressId: number, materialName: string, colorHex?: string) => void;
  onOpenInspector?: () => void;
  onSelectCadTool?: (tool: import('../../types/ifc').CadToolMode) => void;
  pinnedExpressIds?: Set<number>;
  onTogglePin?: (expressId: number) => void;
  onMoveElement?: (expressId: number, delta: [number, number, number]) => void;
  onRotateElement?: (expressId: number, angle_degrees: number, axis: 'x' | 'y' | 'z') => void;
  onMirrorElement?: (expressId: number, axis: 'x' | 'y' | 'z', is_copy: boolean) => void;
  onArrayElement?: (expressId: number, count: number, delta: [number, number, number]) => void;
  onAlignElement?: (expressId: number, axis: 'x' | 'y' | 'z', target_value?: number) => void;
  focusTrigger?: { expressId: number; timestamp: number } | null;
  activeInteractiveMode?: InteractiveEditMode;
  onActiveInteractiveModeChange?: (mode: InteractiveEditMode) => void;
  onOpenSpecialModal?: () => void;
  onSpecialPointsPicked?: (p1: [number, number, number], p2: [number, number, number]) => void;
  projectId?: string;
  theme?: 'light' | 'dark';
}

const CATEGORY_COLORS: Record<string, { color: number; roughness: number; metalness: number; opacity?: number }> = {
  IfcWall: { color: 0xd8dde4, roughness: 0.85, metalness: 0.05 },
  IfcWallStandardCase: { color: 0xd8dde4, roughness: 0.85, metalness: 0.05 },
  IfcSlab: { color: 0xa8b3c2, roughness: 0.9, metalness: 0.1 },
  IfcDoor: { color: 0xc27845, roughness: 0.6, metalness: 0.1 },
  IfcWindow: { color: 0x67e8f9, roughness: 0.2, metalness: 0.1, opacity: 0.45 },
  IfcCurtainWall: { color: 0x67e8f9, roughness: 0.2, metalness: 0.2, opacity: 0.5 },
  IfcColumn: { color: 0x64748b, roughness: 0.7, metalness: 0.25 },
  IfcBeam: { color: 0x64748b, roughness: 0.7, metalness: 0.25 },
  IfcRoof: { color: 0x475569, roughness: 0.8, metalness: 0.1 },
  IfcStair: { color: 0x94a3b8, roughness: 0.8, metalness: 0.1 },
  IfcRailing: { color: 0x334155, roughness: 0.5, metalness: 0.8 }
};

const DISCIPLINE_COLORS: Record<string, { color: number; roughness: number; metalness: number }> = {
  ARCH: { color: 0xd4d4d8, roughness: 0.8, metalness: 0.05 },
  STRUCT: { color: 0x3b82f6, roughness: 0.5, metalness: 0.3 },
  MEP: { color: 0xf97316, roughness: 0.4, metalness: 0.4 },
  CIVIL: { color: 0x10b981, roughness: 0.7, metalness: 0.1 },
  OTHER: { color: 0xa855f7, roughness: 0.6, metalness: 0.2 }
};

const BIM_PBR_MATERIALS: Record<string, { color: number; roughness: number; metalness: number; transparent?: boolean; opacity?: number }> = {
  IfcWindow: { color: 0x93c5fd, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.4 },
  IfcCurtainWall: { color: 0x60a5fa, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.45 },
  IfcPlate: { color: 0x64748b, roughness: 0.3, metalness: 0.7 },
  IfcBeam: { color: 0x334155, roughness: 0.25, metalness: 0.85 },
  IfcColumn: { color: 0x475569, roughness: 0.25, metalness: 0.85 },
  IfcMember: { color: 0x334155, roughness: 0.3, metalness: 0.8 },
  IfcWall: { color: 0xe2e8f0, roughness: 0.88, metalness: 0.02 },
  IfcWallStandardCase: { color: 0xe2e8f0, roughness: 0.88, metalness: 0.02 },
  IfcSlab: { color: 0xcfd8dc, roughness: 0.72, metalness: 0.08 },
  IfcRoof: { color: 0x3b4252, roughness: 0.65, metalness: 0.1 },
  IfcDoor: { color: 0x854d0e, roughness: 0.5, metalness: 0.15 },
  IfcCovering: { color: 0xf1f5f9, roughness: 0.6, metalness: 0.05 },
  IfcFlowSegment: { color: 0xb45309, roughness: 0.2, metalness: 0.9 },
  IfcFlowFitting: { color: 0x94a3b8, roughness: 0.2, metalness: 0.85 },
  IfcFooting: { color: 0x94a3b8, roughness: 0.95, metalness: 0.0 }
};

function inferDiscipline(type: string, explicitDiscipline?: string): string {
  if (explicitDiscipline) return explicitDiscipline;
  if (type.includes('Beam') || type.includes('Column') || type.includes('Footing') || type.includes('Reinforc') || type.includes('Member')) return 'STRUCT';
  if (type.includes('Pipe') || type.includes('Duct') || type.includes('Flow') || type.includes('Pump') || type.includes('Valve') || type.includes('Fitting') || type.includes('Cable') || type.includes('Electrical')) return 'MEP';
  if (type.includes('Terrain') || type.includes('Site') || type.includes('Road') || type.includes('Bridge')) return 'CIVIL';
  return 'ARCH';
}

const DEFAULT_MATERIAL_CONFIG = { color: 0x94a3b8, roughness: 0.75, metalness: 0.1 };

/**
 * Snapping Engine:
 * Raycasts visible meshes, checks vertex proximity (<= threshold),
 * edge midpoints (<= threshold), and falls back to exact surface hit.
 */
function findSnapPoint(
  raycaster: THREE.Raycaster,
  visibleMeshes: THREE.Object3D[],
  camera: THREE.Camera,
  mouseClientPos?: { x: number; y: number },
  containerRect?: DOMRect
): { point: THREE.Vector3; type: SnapType } | null {
  (raycaster as any).firstHitOnly = true;
  const intersects = raycaster.intersectObjects(visibleMeshes, false);
  if (intersects.length === 0) return null;

  const hit = intersects[0];
  const mesh = hit.object as THREE.Mesh;
  const geom = mesh.geometry;
  const hitPoint = hit.point.clone();

  if (geom instanceof THREE.BufferGeometry && hit.face) {
    const posAttr = geom.getAttribute('position');
    if (posAttr) {
      mesh.updateMatrixWorld(true);
      let worldTransform = mesh.matrixWorld.clone();
      if ((mesh as any).isBatchedMesh && hit.batchId !== undefined) {
        const instMat = new THREE.Matrix4();
        (mesh as any).getMatrixAt(hit.batchId, instMat);
        worldTransform.multiply(instMat);
      }
      const vA = new THREE.Vector3().fromBufferAttribute(posAttr, hit.face.a).applyMatrix4(worldTransform);
      const vB = new THREE.Vector3().fromBufferAttribute(posAttr, hit.face.b).applyMatrix4(worldTransform);
      const vC = new THREE.Vector3().fromBufferAttribute(posAttr, hit.face.c).applyMatrix4(worldTransform);

      const mAB = vA.clone().add(vB).multiplyScalar(0.5);
      const mBC = vB.clone().add(vC).multiplyScalar(0.5);
      const mCA = vC.clone().add(vA).multiplyScalar(0.5);

      // 1. High-precision screen-space proximity snapping (CAD-grade pixel radius)
      if (mouseClientPos && containerRect) {
        const toScreen = (v: THREE.Vector3) => {
          const projected = v.clone().project(camera);
          return {
            x: (projected.x * 0.5 + 0.5) * containerRect.width + containerRect.left,
            y: (-(projected.y * 0.5) + 0.5) * containerRect.height + containerRect.top
          };
        };

        const mouseX = mouseClientPos.x;
        const mouseY = mouseClientPos.y;

        // Vertices (24px screen snap radius - comfortable, magnetic snap)
        const vertices = [vA, vB, vC];
        let closestVertex: THREE.Vector3 | null = null;
        let minPixelDistV = Infinity;
        for (const v of vertices) {
          const s = toScreen(v);
          const distPx = Math.hypot(s.x - mouseX, s.y - mouseY);
          if (distPx < minPixelDistV) {
            minPixelDistV = distPx;
            closestVertex = v;
          }
        }
        if (closestVertex && minPixelDistV <= 24) {
          return { point: closestVertex, type: 'vertex' };
        }

        // Edge Midpoints (18px screen snap radius)
        const midpoints = [mAB, mBC, mCA];
        let closestMidpoint: THREE.Vector3 | null = null;
        let minPixelDistM = Infinity;
        for (const m of midpoints) {
          const s = toScreen(m);
          const distPx = Math.hypot(s.x - mouseX, s.y - mouseY);
          if (distPx < minPixelDistM) {
            minPixelDistM = distPx;
            closestMidpoint = m;
          }
        }
        if (closestMidpoint && minPixelDistM <= 18) {
          return { point: closestMidpoint, type: 'midpoint' };
        }
      }

      // 2. World-space distance proximity fallback
      const camDist = camera.position.distanceTo(hitPoint);
      const vertexThreshold = Math.max(0.35, camDist * 0.035);
      const midThreshold = Math.max(0.25, camDist * 0.025);

      let closestVertex: THREE.Vector3 | null = null;
      let minVertexDist = Infinity;
      for (const v of [vA, vB, vC]) {
        const d = hitPoint.distanceTo(v);
        if (d < minVertexDist) {
          minVertexDist = d;
          closestVertex = v;
        }
      }
      if (closestVertex && minVertexDist <= vertexThreshold) {
        return { point: closestVertex, type: 'vertex' };
      }

      let closestMidpoint: THREE.Vector3 | null = null;
      let minMidDist = Infinity;
      for (const m of [mAB, mBC, mCA]) {
        const d = hitPoint.distanceTo(m);
        if (d < minMidDist) {
          minMidDist = d;
          closestMidpoint = m;
        }
      }
      if (closestMidpoint && minMidDist <= midThreshold) {
        return { point: closestMidpoint, type: 'midpoint' };
      }
    }
  }

  // 3. Fallback to Surface hit point
  return { point: hitPoint, type: 'surface' };
}

/**
 * Visible Surface Raycaster:
 * Finds all visible elements along the ray, prioritizing the frontmost visible surface
 * facing the user and filtering out clipped, hidden, or back-facing interior geometry.
 */
function findVisibleCandidates(
  raycaster: THREE.Raycaster,
  group: THREE.Group,
  clipPlane: THREE.Plane,
  sectionEnabled: boolean,
  hiddenCategories: Set<string>,
  isolatedExpressID: number | null,
  hiddenModelIds?: Set<string>
): { expressID: number; hit: THREE.Intersection; distance: number }[] {
  const visibleMeshes = group.children.filter((c) => c.visible);
  // Do NOT set raycaster.firstHitOnly = true so Three.js accurately tests all objects by distance
  const intersects = raycaster.intersectObjects(visibleMeshes, false);
  if (intersects.length === 0) return [];

  const candidates: { expressID: number; hit: THREE.Intersection; distance: number }[] = [];
  const seenExpressIds = new Set<number>();

  for (const hit of intersects) {
    // 1. Clipping plane test: discard hits behind active section cut
    if (sectionEnabled && clipPlane.distanceToPoint(hit.point) < -0.001) {
      continue;
    }

    // 2. Resolve expressID and type (supporting both BatchedMesh instances and standard Mesh)
    let expressID: number | null = null;
    let type = '';
    let modelId = 'main';

    if (((hit.object as any).isBatchedMesh || hit.object instanceof THREE.BatchedMesh) && hit.batchId !== undefined) {
      const instances = (hit.object.userData as any)?.instances;
      if (instances && instances[hit.batchId]) {
        const inst = instances[hit.batchId];
        expressID = inst.expressID;
        type = inst.type;
        modelId = inst.modelId || 'main';
      }
    } else if (hit.object.userData && hit.object.userData.expressID !== undefined) {
      expressID = hit.object.userData.expressID as number;
      type = hit.object.userData.type || '';
      modelId = hit.object.userData.modelId || 'main';
    }

    if (expressID === null || seenExpressIds.has(expressID)) {
      continue;
    }

    // 3. Visibility filter (categories, isolation, model federation)
    if (hiddenCategories.has(type)) continue;
    if (isolatedExpressID !== null && expressID !== isolatedExpressID) continue;
    if (hiddenModelIds && hiddenModelIds.has(modelId)) continue;

    seenExpressIds.add(expressID);
    candidates.push({ expressID, hit, distance: hit.distance });
  }

  // Sort candidates strictly by ascending optical distance from camera / user viewpoint
  // Candidate 0 is the closest visible surface directly beneath cursor; subsequent candidates follow in line-of-sight depth order
  candidates.sort((a, b) => a.distance - b.distance);

  return candidates;
}

function clearGroupChildren(group: THREE.Group | null): void {
  if (!group) return;
  while (group.children.length > 0) {
    const c = group.children[0];
    group.remove(c);
    c.traverse((child) => {
      if ((child as any).geometry && !(child as any).userData?.isSharedGeometry) {
        (child as any).geometry.dispose();
      }
      if ((child as any).material) {
        if (Array.isArray((child as any).material)) {
          (child as any).material.forEach((m: any) => m?.dispose?.());
        } else {
          (child as any).material.dispose();
        }
      }
    });
  }
}

const GHOST_PREVIEW_LIMIT = 50; // Tekla XS_PREVIEW_LIMIT

function updateInteractiveGuides(
  guidesGroup: THREE.Group,
  state: InteractiveEditState,
  targetPoint: THREE.Vector3,
  selectedMeshes: THREE.Mesh[] = []
) {
  clearGroupChildren(guidesGroup);

  const { mode, step, originPoint, referenceRayPoint } = state;
  if (mode === 'none') return;

  const cyanLineMat = new THREE.LineBasicMaterial({
    color: 0x06b6d4,
    linewidth: 2,
    depthTest: false,
    transparent: true,
    opacity: 0.85
  });
  const dashedLineMat = new THREE.LineDashedMaterial({
    color: 0x22d3ee,
    dashSize: 0.3,
    gapSize: 0.15,
    depthTest: false,
    transparent: true,
    opacity: 0.9
  });
  const originMarkerMat = new THREE.MeshBasicMaterial({
    color: 0x06b6d4,
    depthTest: false
  });
  const targetMarkerMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    wireframe: true,
    depthTest: false
  });
  const ghostMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    transparent: true,
    opacity: 0.45,
    roughness: 0.3,
    metalness: 0.1,
    depthTest: true
  });

  const sphereGeom = new THREE.SphereGeometry(0.08, 16, 16);

  if (step === 1 || !originPoint) {
    const marker = new THREE.Mesh(sphereGeom, targetMarkerMat);
    marker.position.copy(targetPoint);
    marker.renderOrder = 9999;
    guidesGroup.add(marker);
    return;
  }

  const originMarker = new THREE.Mesh(sphereGeom, originMarkerMat);
  originMarker.position.copy(originPoint);
  originMarker.renderOrder = 9999;
  guidesGroup.add(originMarker);

  if (mode === 'move' || mode === 'special_pick') {
    const lineGeom = new THREE.BufferGeometry().setFromPoints([originPoint, targetPoint]);
    const line = new THREE.Line(lineGeom, dashedLineMat);
    line.computeLineDistances();
    line.renderOrder = 9998;
    guidesGroup.add(line);

    const targetMarker = new THREE.Mesh(sphereGeom, targetMarkerMat);
    targetMarker.position.copy(targetPoint);
    targetMarker.renderOrder = 9999;
    guidesGroup.add(targetMarker);

    if (mode === 'move' && selectedMeshes.length > 0) {
      const delta = targetPoint.clone().sub(originPoint);
      selectedMeshes.forEach((mesh) => {
        if (!mesh.geometry) return;
        const ghost = new THREE.Mesh(mesh.geometry, ghostMat);
        ghost.userData = { isSharedGeometry: true };
        ghost.matrixAutoUpdate = false;
        const mat = mesh.matrixWorld.clone();
        mat.setPosition(
          mat.elements[12] + delta.x,
          mat.elements[13] + delta.y,
          mat.elements[14] + delta.z
        );
        ghost.matrix.copy(mat);
        ghost.renderOrder = 9000;
        guidesGroup.add(ghost);
      });
    }
  } else if (mode === 'elevate') {
    const vertTarget = new THREE.Vector3(originPoint.x, targetPoint.y, originPoint.z);
    const lineGeom = new THREE.BufferGeometry().setFromPoints([originPoint, vertTarget]);
    const line = new THREE.Line(lineGeom, dashedLineMat);
    line.computeLineDistances();
    line.renderOrder = 9998;
    guidesGroup.add(line);

    const targetMarker = new THREE.Mesh(sphereGeom, targetMarkerMat);
    targetMarker.position.copy(vertTarget);
    targetMarker.renderOrder = 9999;
    guidesGroup.add(targetMarker);

    if (selectedMeshes.length > 0) {
      const dy = targetPoint.y - originPoint.y;
      selectedMeshes.forEach((mesh) => {
        if (!mesh.geometry) return;
        const ghost = new THREE.Mesh(mesh.geometry, ghostMat);
        ghost.userData = { isSharedGeometry: true };
        ghost.matrixAutoUpdate = false;
        const mat = mesh.matrixWorld.clone();
        mat.setPosition(mat.elements[12], mat.elements[13] + dy, mat.elements[14]);
        ghost.matrix.copy(mat);
        ghost.renderOrder = 9000;
        guidesGroup.add(ghost);
      });
    }
  } else if (mode === 'rotate') {
    if (step === 2) {
      const lineGeom = new THREE.BufferGeometry().setFromPoints([originPoint, targetPoint]);
      const line = new THREE.Line(lineGeom, dashedLineMat);
      line.computeLineDistances();
      line.renderOrder = 9998;
      guidesGroup.add(line);

      const targetMarker = new THREE.Mesh(sphereGeom, targetMarkerMat);
      targetMarker.position.copy(targetPoint);
      targetMarker.renderOrder = 9999;
      guidesGroup.add(targetMarker);
    } else if (step === 3 && referenceRayPoint) {
      const refGeom = new THREE.BufferGeometry().setFromPoints([originPoint, referenceRayPoint]);
      const refLine = new THREE.Line(refGeom, cyanLineMat);
      refLine.renderOrder = 9998;
      guidesGroup.add(refLine);

      const curGeom = new THREE.BufferGeometry().setFromPoints([originPoint, targetPoint]);
      const curLine = new THREE.Line(curGeom, dashedLineMat);
      curLine.computeLineDistances();
      curLine.renderOrder = 9998;
      guidesGroup.add(curLine);

      const r = Math.min(originPoint.distanceTo(referenceRayPoint), 3.0);
      const v1 = new THREE.Vector2(referenceRayPoint.x - originPoint.x, referenceRayPoint.z - originPoint.z).normalize();
      const v2 = new THREE.Vector2(targetPoint.x - originPoint.x, targetPoint.z - originPoint.z).normalize();
      const startAngle = Math.atan2(v1.y, v1.x);
      const endAngle = Math.atan2(v2.y, v2.x);
      const sweep = endAngle - startAngle;

      const arcPoints: THREE.Vector3[] = [];
      const segments = 24;
      for (let i = 0; i <= segments; i++) {
        const theta = startAngle + (sweep * i) / segments;
        arcPoints.push(new THREE.Vector3(originPoint.x + Math.cos(theta) * r, originPoint.y, originPoint.z + Math.sin(theta) * r));
      }
      const arcGeom = new THREE.BufferGeometry().setFromPoints(arcPoints);
      const arcLine = new THREE.Line(arcGeom, cyanLineMat);
      arcLine.renderOrder = 9998;
      guidesGroup.add(arcLine);

      if (selectedMeshes.length > 0) {
        selectedMeshes.forEach((mesh) => {
          if (!mesh.geometry) return;
          const ghost = new THREE.Mesh(mesh.geometry, ghostMat);
          ghost.userData = { isSharedGeometry: true };
          ghost.matrixAutoUpdate = false;
          const rotMat = new THREE.Matrix4().makeRotationY(-sweep);
          const t1 = new THREE.Matrix4().makeTranslation(-originPoint.x, -originPoint.y, -originPoint.z);
          const t2 = new THREE.Matrix4().makeTranslation(originPoint.x, originPoint.y, originPoint.z);
          const fullMat = new THREE.Matrix4().multiply(t2).multiply(rotMat).multiply(t1).multiply(mesh.matrixWorld);
          ghost.matrix.copy(fullMat);
          ghost.renderOrder = 9000;
          guidesGroup.add(ghost);
        });
      }
    }
  } else if (mode === 'mirror') {
    const dir = targetPoint.clone().sub(originPoint).normalize();
    const pStart = originPoint.clone().sub(dir.clone().multiplyScalar(10));
    const pEnd = originPoint.clone().add(dir.clone().multiplyScalar(10));
    const lineGeom = new THREE.BufferGeometry().setFromPoints([pStart, pEnd]);
    const line = new THREE.Line(lineGeom, dashedLineMat);
    line.computeLineDistances();
    line.renderOrder = 9998;
    guidesGroup.add(line);

    const targetMarker = new THREE.Mesh(sphereGeom, targetMarkerMat);
    targetMarker.position.copy(targetPoint);
    targetMarker.renderOrder = 9999;
    guidesGroup.add(targetMarker);

    if (selectedMeshes.length > 0) {
      const dx = targetPoint.x - originPoint.x;
      const dz = targetPoint.z - originPoint.z;
      const axis = Math.abs(dx) >= Math.abs(dz) ? 'x' : 'z';

      selectedMeshes.forEach((mesh) => {
        if (!mesh.geometry) return;
        const ghost = new THREE.Mesh(mesh.geometry, ghostMat);
        ghost.userData = { isSharedGeometry: true };
        ghost.matrixAutoUpdate = false;
        const scaleMat = new THREE.Matrix4().makeScale(
          axis === 'x' ? 1 : -1,
          1,
          axis === 'x' ? -1 : 1
        );
        const t1 = new THREE.Matrix4().makeTranslation(-originPoint.x, -originPoint.y, -originPoint.z);
        const t2 = new THREE.Matrix4().makeTranslation(originPoint.x, originPoint.y, originPoint.z);
        const fullMat = new THREE.Matrix4().multiply(t2).multiply(scaleMat).multiply(t1).multiply(mesh.matrixWorld);
        ghost.matrix.copy(fullMat);
        ghost.renderOrder = 9000;
        guidesGroup.add(ghost);
      });
    }
  } else if (mode === 'multiply') {
    const lineGeom = new THREE.BufferGeometry().setFromPoints([originPoint, targetPoint]);
    const line = new THREE.Line(lineGeom, dashedLineMat);
    line.computeLineDistances();
    line.renderOrder = 9998;
    guidesGroup.add(line);

    const delta = targetPoint.clone().sub(originPoint);
    const count = Math.min(state.multiplyCount || 3, GHOST_PREVIEW_LIMIT);

    if (selectedMeshes.length > 0) {
      for (let i = 1; i <= count; i++) {
        const stepDelta = delta.clone().multiplyScalar(i);
        selectedMeshes.forEach((mesh) => {
          if (!mesh.geometry) return;
          const ghost = new THREE.Mesh(mesh.geometry, ghostMat);
          ghost.userData = { isSharedGeometry: true };
          ghost.matrixAutoUpdate = false;
          const mat = mesh.matrixWorld.clone();
          mat.setPosition(
            mat.elements[12] + stepDelta.x,
            mat.elements[13] + stepDelta.y,
            mat.elements[14] + stepDelta.z
          );
          ghost.matrix.copy(mat);
          ghost.renderOrder = 9000;
          guidesGroup.add(ghost);
        });
      }
    }
  }
}

// Headless CDP pointer capture safety guard
if (typeof Element !== 'undefined' && !((Element.prototype as any).__safePointerCaptureInstalled)) {
  (Element.prototype as any).__safePointerCaptureInstalled = true;
  const origSet = Element.prototype.setPointerCapture;
  if (origSet) {
    Element.prototype.setPointerCapture = function(pointerId: number) {
      try {
        origSet.call(this, pointerId);
      } catch {
        // Suppress synthetic/headless pointer capture mismatch
      }
    };
  }
  const origRelease = Element.prototype.releasePointerCapture;
  if (origRelease) {
    Element.prototype.releasePointerCapture = function(pointerId: number) {
      try {
        origRelease.call(this, pointerId);
      } catch {
        // Suppress synthetic/headless pointer capture mismatch
      }
    };
  }
}

export const ThreeViewport: React.FC<ThreeViewportProps> = ({
  settings = DEFAULT_EDITOR_SETTINGS,
  geometries,
  selectedExpressID,
  onSelectElement,
  hiddenCategories,
  isolatedExpressID,
  transformMode,
  onSetTransformMode,
  snapEnabled,
  onTransformEnd,
  onTransformChange,
  isMeasureActive,
  measurements,
  onAddMeasurement,
  onSelectMeasurement,
  onCancelMeasure,
  sectionConfig,
  cameraPresetTrigger,
  onCameraPreset: _onCameraPreset,
  renderStyle,
  elementLocks = {},
  remoteTransform,
  isRightDrawerOpen: _isRightDrawerOpen = false,
  rightDrawerWidth: _rightDrawerWidth = 320,
  hiddenModelIds,
  activeClash,
  auditDiff,
  cadToolMode = 'select',

  onCadDrawWall,
  onCadDrawSlab,
  onCadDrawColumn,
  onCadDrawOpening,
  onCadCancel,

  elementDetails: _elementDetails,
  storeys: _storeys = [],
  onCloneElement,
  onDeleteElement,
  onUpdateGeometry: _onUpdateGeometry,
  onAssignStorey: _onAssignStorey,
  onAssignMaterial: _onAssignMaterial,
  onOpenInspector,
  onSelectCadTool,
  pinnedExpressIds,
  onTogglePin,
  onMoveElement,
  onRotateElement,
  onMirrorElement,
  onArrayElement,
  onAlignElement,
  focusTrigger,
  activeInteractiveMode = 'none',
  onActiveInteractiveModeChange,
  onOpenSpecialModal: _onOpenSpecialModal,
  onSpecialPointsPicked,
  projectId,
  theme = 'light',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const meshesGroupRef = useRef<THREE.Group | null>(null);
  const meshMapRef = useRef<Map<number, THREE.Mesh[]>>(new Map());
  // STEP-08: registered BatchedMesh handles + their per-instance metadata, so the
  // visibility/colour effects can drive the batch instead of the invisible proxies.
  const batchRegistryRef = useRef<BatchRegistryEntry[]>([]);
  const animFrameIdRef = useRef<number | null>(null);
  const isDraggingGizmoRef = useRef(false);
  const pivotDotGroupRef = useRef<THREE.Group | null>(null);
  const clashMarkerGroupRef = useRef<THREE.Group | null>(null);
  const cadPreviewGroupRef = useRef<THREE.Group | null>(null);
  const editGuidesGroupRef = useRef<THREE.Group | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const groundGridRef = useRef<ReturnType<typeof createGroundGrid> | null>(null);
  const lastFittedProjectIdRef = useRef<string | null>(null);

  // Industry-Grade CAD/BIM Interactive Editing State (Archicad 29 & Tekla 2025)
  const [interactiveEditState, setInteractiveEditState] = useState<InteractiveEditState>({
    mode: 'none',
    step: 1,
    originPoint: null,
    referenceRayPoint: null,
    currentPoint: null,
    isCopyMode: false,
    isMultiCopy: false,
    isOrthoLocked: false,
    multiplyCount: 3,
    multiplySpacing: 2.0,
    multiplyMethod: 'increment',
    rotateAxis: 'z',
    mirrorPlane: 'x',
  });
  const [trackerReadout, setTrackerReadout] = useState<TrackerReadout | null>(null);

  // Modern In-Viewport BIM Editing State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; expressId: number | null } | null>(null);
  const [draftingLength, setDraftingLength] = useState<number>(0);
  const [draftingAngle, setDraftingAngle] = useState<number>(0);
  const [isOrthoLocked, setIsOrthoLocked] = useState<boolean>(false);
  const [isHoveringInteractiveMesh, setIsHoveringInteractiveMesh] = useState<boolean>(false);

  // Hover & Pre-Selection Engine State (Revit-style Depth Cycling & Subtle Highlighting)
  const [hoveredExpressId, setHoveredExpressId] = useState<number | null>(null);
  const hoveredExpressIdRef = useRef<number | null>(null);
  hoveredExpressIdRef.current = hoveredExpressId;

  const [hoverCandidates, setHoverCandidates] = useState<number[]>([]);
  const hoverCandidatesRef = useRef<number[]>([]);
  hoverCandidatesRef.current = hoverCandidates;

  const [hoverCandidateIndex, setHoverCandidateIndex] = useState<number>(0);
  const hoverCandidateIndexRef = useRef<number>(0);
  hoverCandidateIndexRef.current = hoverCandidateIndex;

  // Rotation & Drag Isolation Tracking (prevents selection during/after camera orbit)
  const isPointerDraggingRef = useRef<boolean>(false);
  const isOrbitingRef = useRef<boolean>(false);
  const lastNavigationEndTimeRef = useRef<number>(0);
  const lastPointerUpSelectTimeRef = useRef<number>(0);
  const lastPointerPosRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const updateHoverAtScreenCoordsRef = useRef<((clientX: number, clientY: number) => void) | null>(null);
  // STEP-23: hover is coalesced to one raycast per animation frame (F-034).
  const hoverComputeRef = useRef<((payload: { clientX: number; clientY: number }) => number[]) | null>(null);
  const hoverNotifyRef = useRef<((ids: number[]) => void) | null>(null);
  const hoverSchedulerRef = useRef<HoverScheduler | null>(null);

  // Hover & Selection Highlight Mesh Helper Refs
  const hoverHighlightGroupRef = useRef<THREE.Group | null>(null);
  const selectedHighlightGroupRef = useRef<THREE.Group | null>(null);

  const hoveredElementName = React.useMemo(() => {
    if (hoveredExpressId === null) return '';
    const mesh = meshMapRef.current.get(hoveredExpressId)?.[0];
    if (mesh?.userData?.type) {
      return `${mesh.userData.type} #${hoveredExpressId}`;
    }
    const geom = geometries.find((g) => g.expressID === hoveredExpressId);
    if (geom?.type) {
      return `${geom.type} #${hoveredExpressId}`;
    }
    return `#${hoveredExpressId}`;
  }, [hoveredExpressId, geometries]);

  // CAD Interactive Modeling State
  const [cadStartPoint, setCadStartPoint] = useState<THREE.Vector3 | null>(null);

  // Dynamic 3D Screen Projection for Measurements
  const measurementsRef = useRef(measurements);
  measurementsRef.current = measurements;
  const [screenMeasurements, setScreenMeasurements] = useState<
    { id: string; x: number; y: number; visible: boolean; distance: number }[]
  >([]);

  // Immediately clear or prune projected screen labels when measurements change
  useEffect(() => {
    if (measurements.length === 0) {
      setScreenMeasurements([]);
    } else {
      setScreenMeasurements((prev) => prev.filter((sm) => measurements.some((m) => m.id === sm.id)));
    }
    needsRenderRef.current = true;
  }, [measurements]);

  // Clipping Plane Ref
  const clipPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, -1, 0), 10));
  const sectionPlaneHelperRef = useRef<THREE.PlaneHelper | null>(null);

  // Measurement & Snapping State
  const [pendingStartPoint, setPendingStartPoint] = useState<THREE.Vector3 | null>(null);
  const [activeSnap, setActiveSnap] = useState<ActiveSnap | null>(null);
  const [previewMeasure, setPreviewMeasure] = useState<PreviewMeasure | null>(null);
  const currentSnapPointRef = useRef<THREE.Vector3 | null>(null);
  const currentSnapTypeRef = useRef<SnapType | null>(null);
  const snapIndicatorGroupRef = useRef<THREE.Group | null>(null);
  const measurePreviewGroupRef = useRef<THREE.Group | null>(null);
  const measureGroupRef = useRef<THREE.Group | null>(null);

  // Performance Engine Refs: Shared Materials & Damped Rendering
  const categoryMaterialsRef = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map());
  const renderStyleRef = useRef<RenderStyle>(renderStyle);
  renderStyleRef.current = renderStyle;
  const disciplineMaterialsRef = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map());
  const diffMaterialsRef = useRef<{ added: THREE.MeshStandardMaterial; modified: THREE.MeshStandardMaterial; unchanged: THREE.MeshStandardMaterial } | null>(null);
  const transparentEdgesGroupRef = useRef<THREE.Group | null>(null);
  const shadowGroundRef = useRef<THREE.Mesh | null>(null);
  const needsRenderRef = useRef(true);
  const isNavigatingRef = useRef(false);
  const navSettleTimerRef = useRef<number | null>(null);
  const lastScreenMeasureUpdateRef = useRef<MeasurementRecord[]>([]);

  // STEP-23: adaptive damping is derived once per geometry-count change, never from a
  // value captured by the mount effect (which always saw the empty first render).
  const navigationTuningRef = useRef<NavigationTuning>(
    createNavigationTuning(settings.navigation?.dampingFactor ?? 0.18, {
      adaptive: settings.navigation?.adaptiveLargeModelDamping ?? true,
      threshold: 150
    })
  );

  // STEP-23: contour edges are cached per element so hovering the same element twice
  // does not rebuild `EdgesGeometry`. The cache owns the geometry (see integration note
  // in `docs/audit-2026-10/steps/STEP-23-viewport-performance.md`).
  const edgeGeometryCacheRef = useRef<
    Map<number, { source: THREE.BufferGeometry; edges: THREE.EdgesGeometry }>
  >(new Map());

  /**
   * STEP-23 (F-034): one `EdgesGeometry` per element, reused by the selection and
   * hover overlays. The cache owns the geometry, so overlays are marked shared and
   * `disposeHighlightGroup` leaves it alive.
   */
  const getCachedEdgesGeometry = useCallback((mesh: THREE.Mesh): THREE.EdgesGeometry | null => {
    const source = mesh.geometry as THREE.BufferGeometry | undefined;
    if (!source) return null;
    const expressID = mesh.userData.expressID as number;
    const cached = edgeGeometryCacheRef.current.get(expressID);
    if (cached && cached.source === source) return cached.edges;
    cached?.edges.dispose();
    const edges = new THREE.EdgesGeometry(source, 24);
    edgeGeometryCacheRef.current.set(expressID, { source, edges });
    return edges;
  }, []);

  const clearEdgeGeometryCache = useCallback(() => {
    edgeGeometryCacheRef.current.forEach((entry) => entry.edges.dispose());
    edgeGeometryCacheRef.current.clear();
  }, []);

  /**
   * STEP-23 (F-034): single sink for hover results. The scheduler only calls this
   * when the candidate set actually changed, so moving inside one element no longer
   * re-renders the whole viewport.
   */
  const applyHoverNotification = useCallback((candidateIds: number[]) => {
    hoverCandidatesRef.current = candidateIds;
    setHoverCandidates(candidateIds);
    setIsHoveringInteractiveMesh(candidateIds.length > 0);

    if (candidateIds.length === 0) {
      hoveredExpressIdRef.current = null;
      setHoveredExpressId(null);
      hoverCandidateIndexRef.current = 0;
      setHoverCandidateIndex(0);
    } else {
      hoverCandidateIndexRef.current = 0;
      setHoverCandidateIndex(0);
      hoveredExpressIdRef.current = candidateIds[0];
      setHoveredExpressId(candidateIds[0]);
    }
    needsRenderRef.current = true;
  }, []);
  hoverNotifyRef.current = applyHoverNotification;

  // 1. Initialize Scene & Renderer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const isLight = theme === 'light';
    const initialThemeKey = settings.viewport?.theme ?? (isLight ? 'studio-gray' : 'dark-slate');
    const initialBg = THEME_COLOR_MAP[initialThemeKey] ?? (isLight ? 0xdce5ef : 0x0b0d10);
    scene.background = new THREE.Color(
      initialThemeKey === 'custom' && settings.viewport?.customCanvasColor
        ? settings.viewport.customCanvasColor
        : (isLight ? 0xdce5ef : initialBg)
    );
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(15, 12, 18);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false; // Freeze shadow auto-update during navigation
    renderer.shadowMap.needsUpdate = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.localClippingEnabled = true; // Phase 4: Local Clipping Planes
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);

    // STEP-23 (F-038): the damping factor comes from `navigationTuningRef`, which is
    // updated by the `[geometries.length]` effect below. Never derive it here: this
    // effect captures the empty first render (`geometries === []`), so a local
    // `isLargeModel` would be permanently `false`.
    controls.enableDamping = settings.navigation?.enableDamping ?? true;
    controls.dampingFactor = navigationTuningRef.current.current;
    controls.rotateSpeed = settings.navigation?.orbitSensitivity ?? 1.0;
    controls.panSpeed = settings.navigation?.panSensitivity ?? 1.0;
    controls.zoomSpeed = settings.navigation?.zoomSensitivity ?? 1.0;
    controls.screenSpacePanning = true;
    controls.maxDistance = 500;
    controls.minDistance = 0.5;
    // Revit / Blender CAD standard:
    // Scroll: zoom in / out
    // Middle mouse button (MMB) drag: Pan / Drag
    // Middle mouse button + Shift (Shift + MMB) drag: Rotate / Orbit
    // Left click: 100% free for CAD drafting, element selection, and commands
    // STEP-28 / F-052: mouse + touch navigation from one tested config. LEFT/RIGHT stay disabled so
    // a left click remains available to selection and CAD commands; one finger orbits, two dolly+pan.
    const orbitControlConfig = buildOrbitControlConfig();
    controls.mouseButtons = orbitControlConfig.mouseButtons;
    controls.touches = orbitControlConfig.touches;
    controlsRef.current = controls;

    const handleDomPointerDown = (e: PointerEvent) => {
      if (controlsRef.current) {
        if (e.shiftKey && (e.button === 1 || e.buttons === 4)) {
          controlsRef.current.mouseButtons.MIDDLE = THREE.MOUSE.ROTATE;
        } else if (e.button === 1 || e.buttons === 4) {
          controlsRef.current.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
        }
      }
    };
    const handleDomPointerUp = () => {
      if (controlsRef.current) {
        controlsRef.current.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
      }
    };
    renderer.domElement.addEventListener('pointerdown', handleDomPointerDown);
    window.addEventListener('pointerup', handleDomPointerUp);

    // Dynamic Resolution Scaling (DRS) & Camera Navigation / Orbit Event Handlers
    controls.addEventListener('start', () => {
      isOrbitingRef.current = true;
      isNavigatingRef.current = true;
      if (navSettleTimerRef.current) window.clearTimeout(navSettleTimerRef.current);
      // Adaptive Dynamic Resolution Scaling: drop to lower pixel ratio during fast camera orbit
      const fastRatio = Math.max(0.75, Math.min(window.devicePixelRatio * 0.75, 1.0));
      renderer.setPixelRatio(fastRatio);
      needsRenderRef.current = true;
    });

    controls.addEventListener('change', () => {
      if (isOrbitingRef.current) {
        isNavigatingRef.current = true;
        lastNavigationEndTimeRef.current = Date.now();
      }
      needsRenderRef.current = true;
    });

    controls.addEventListener('end', () => {
      const wasActiveOrbit = isOrbitingRef.current;
      isOrbitingRef.current = false;
      isPointerDraggingRef.current = false;
      if (wasActiveOrbit) {
        lastNavigationEndTimeRef.current = Date.now();
        if (navSettleTimerRef.current) window.clearTimeout(navSettleTimerRef.current);
        navSettleTimerRef.current = window.setTimeout(() => {
          isNavigatingRef.current = false;
          // Restore native sharp resolution when camera motion settles
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
          renderer.shadowMap.needsUpdate = true;
          needsRenderRef.current = true;

          // Re-evaluate hover under cursor now that camera rotation settled
          if (lastPointerPosRef.current && updateHoverAtScreenCoordsRef.current) {
            updateHoverAtScreenCoordsRef.current(
              lastPointerPosRef.current.clientX,
              lastPointerPosRef.current.clientY
            );
          }
        }, 80);
      } else {
        isNavigatingRef.current = false;
        if (lastPointerPosRef.current && updateHoverAtScreenCoordsRef.current) {
          updateHoverAtScreenCoordsRef.current(
            lastPointerPosRef.current.clientX,
            lastPointerPosRef.current.clientY
          );
        }
      }
    });

    // TransformControls (Compact, sleek CAD proportions: 0.42 instead of 0.75)
    const tControls = new TransformControls(camera, renderer.domElement);
    tControls.size = 0.42;
    scene.add(tControls.getHelper());
    transformControlsRef.current = tControls;

    /**
     * STEP-02 / F-002: the gizmo hook cannot reach the scene, but a rejected placement has to put
     * the element back (spec 5). Read/write a world matrix by express id - nothing else.
     */
    const unregisterSceneMatrixHandle = registerSceneMatrixHandle({
      read: (expressID: number) => {
        const mesh = meshMapRef.current.get(expressID)?.[0];
        if (!mesh) return null;
        mesh.updateMatrixWorld();
        return mesh.matrixWorld.toArray();
      },
      write: (expressID: number, matrix: number[]) => {
        const mesh = meshMapRef.current.get(expressID)?.[0];
        if (!mesh) return false;
        mesh.matrix.fromArray(matrix);
        mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
        mesh.updateMatrixWorld(true);
        if (mesh.userData.batchedMesh && mesh.userData.batchId !== undefined) {
          mesh.userData.batchedMesh.setMatrixAt(mesh.userData.batchId, mesh.matrixWorld);
          mesh.userData.batchedMesh.instanceMatrix.needsUpdate = true;
        }
        renderer.shadowMap.needsUpdate = true;
        needsRenderRef.current = true;
        return true;
      }
    });

    // Inactive Pivot Dot / Origin Anchor Indicator Group
    const pivotDotGroup = new THREE.Group();
    pivotDotGroup.name = 'pivot-dot-group';
    pivotDotGroup.visible = false;
    scene.add(pivotDotGroup);
    pivotDotGroupRef.current = pivotDotGroup;

    tControls.addEventListener('dragging-changed', (event) => {
      const isDragging = Boolean(event.value);
      isDraggingGizmoRef.current = isDragging;
      controls.enabled = !isDragging;
      needsRenderRef.current = true;

      if (isDragging && tControls.object) {
        // STEP-02 spec 5: remember where the element started so a refused write can undo the drag.
        const startMesh = tControls.object as THREE.Mesh;
        startMesh.updateMatrixWorld();
        capturePreDragMatrix(startMesh.userData.expressID as number, startMesh.matrixWorld.toArray());
      }

      if (!isDragging && tControls.object) {
        const mesh = tControls.object as THREE.Mesh;
        const expressID = mesh.userData.expressID as number;
        mesh.updateMatrixWorld();
        if (mesh.userData.batchedMesh && mesh.userData.batchId !== undefined) {
          mesh.userData.batchedMesh.setMatrixAt(mesh.userData.batchId, mesh.matrixWorld);
          mesh.userData.batchedMesh.instanceMatrix.needsUpdate = true;
        }
        if (selectedHighlightGroupRef.current) {
          selectedHighlightGroupRef.current.children.forEach((child) => {
            const sourceMesh = (child.userData as any)?.sourceMesh;
            if (sourceMesh) {
              child.matrix.copy(sourceMesh.matrixWorld);
            }
          });
        }
        const matrixArray = mesh.matrixWorld.toArray();
        renderer.shadowMap.needsUpdate = true;
        onTransformEnd(expressID, matrixArray);
      }
    });

    tControls.addEventListener('objectChange', () => {
      needsRenderRef.current = true;
      if (tControls.object) {
        const mesh = tControls.object as THREE.Mesh;
        mesh.updateMatrixWorld();
        if (mesh.userData.batchedMesh && mesh.userData.batchId !== undefined) {
          mesh.userData.batchedMesh.setMatrixAt(mesh.userData.batchId, mesh.matrixWorld);
          mesh.userData.batchedMesh.instanceMatrix.needsUpdate = true;
        }
        if (selectedHighlightGroupRef.current) {
          selectedHighlightGroupRef.current.children.forEach((child) => {
            const sourceMesh = (child.userData as any)?.sourceMesh;
            if (sourceMesh) {
              child.matrix.copy(sourceMesh.matrixWorld);
            }
          });
        }
        if (onTransformChange) {
          const expressID = mesh.userData.expressID as number;
          const pos = mesh.position.toArray() as [number, number, number];
          const rot = [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z] as [number, number, number];
          onTransformChange(expressID, pos, rot);
        }
      }
    });

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(20, 40, 20);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 2048;
    dirLight1.shadow.mapSize.height = 2048;
    dirLight1.shadow.bias = -0.0005; // Eliminates shadow acne on co-planar BIM walls
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x94a3b8, 0.4);
    dirLight2.position.set(-20, -10, -20);
    scene.add(dirLight2);

    // High-craft procedural anti-aliased ground grid with radial falloff (eliminates moire and z-fighting)
    const gridBaseCol = new THREE.Color(settings.viewport?.gridBaseColor ?? DEFAULT_EDITOR_SETTINGS.viewport.gridBaseColor).getHex();
    const groundGrid = createGroundGrid({
      size: 240,
      radius: 90,
      isLight,
      baseColorHex: gridBaseCol
    });
    groundGrid.mesh.position.y = -0.01;
    groundGrid.mesh.visible = settings.viewport?.showGrid ?? true;
    scene.add(groundGrid.mesh);
    groundGridRef.current = groundGrid;

    // Groups
    const meshesGroup = new THREE.Group();
    scene.add(meshesGroup);
    meshesGroupRef.current = meshesGroup;

    const measureGroup = new THREE.Group();
    scene.add(measureGroup);
    measureGroupRef.current = measureGroup;

    const cadGroup = new THREE.Group();
    scene.add(cadGroup);
    cadPreviewGroupRef.current = cadGroup;

    const editGroup = new THREE.Group();
    editGroup.name = 'edit-guides-group';
    scene.add(editGroup);
    editGuidesGroupRef.current = editGroup;

    // Snap Indicator Gizmo (High renderOrder, depthTest false for obstruction-free snapping)
    const snapGroup = new THREE.Group();
    snapGroup.visible = false;
    snapGroup.renderOrder = 9999;

    const ringGeom = new THREE.RingGeometry(0.12, 0.16, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false
    });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    ringMesh.renderOrder = 9999;
    snapGroup.add(ringMesh);

    const dotGeom = new THREE.CircleGeometry(0.04, 16);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false
    });
    const dotMesh = new THREE.Mesh(dotGeom, dotMat);
    dotMesh.renderOrder = 10000;
    snapGroup.add(dotMesh);

    // 4 CAD crosshair tick marks
    const tickGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.25, 0, 0), new THREE.Vector3(-0.16, 0, 0),
      new THREE.Vector3(0.16, 0, 0), new THREE.Vector3(0.25, 0, 0),
      new THREE.Vector3(0, -0.25, 0), new THREE.Vector3(0, -0.16, 0),
      new THREE.Vector3(0, 0.16, 0), new THREE.Vector3(0, 0.25, 0)
    ]);
    const tickMat = new THREE.LineBasicMaterial({
      color: 0x22d3ee,
      depthTest: false,
      depthWrite: false
    });
    const tickMesh = new THREE.LineSegments(tickGeom, tickMat);
    tickMesh.renderOrder = 10000;
    snapGroup.add(tickMesh);

    scene.add(snapGroup);
    snapIndicatorGroupRef.current = snapGroup;

    // Dynamic Measure Preview Line & End Spheres
    const previewGroup = new THREE.Group();
    previewGroup.visible = false;
    previewGroup.renderOrder = 9998;

    const previewLineGeom = new THREE.BufferGeometry();
    const previewLineMat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 0.2,
      gapSize: 0.1,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.95
    });
    const previewLine = new THREE.Line(previewLineGeom, previewLineMat);
    previewLine.renderOrder = 9998;
    previewGroup.add(previewLine);

    const startSphereGeom = new THREE.SphereGeometry(0.06, 16, 16);
    const startSphereMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      depthTest: false,
      depthWrite: false
    });
    const startSphere = new THREE.Mesh(startSphereGeom, startSphereMat);
    startSphere.renderOrder = 9999;
    previewGroup.add(startSphere);

    const endSphereGeom = new THREE.SphereGeometry(0.06, 16, 16);
    const endSphereMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      depthTest: false,
      depthWrite: false
    });
    const endSphere = new THREE.Mesh(endSphereGeom, endSphereMat);
    endSphere.renderOrder = 9999;
    previewGroup.add(endSphere);

    scene.add(previewGroup);
    measurePreviewGroupRef.current = previewGroup;

    // Expose renderer stats and core refs for automated verification
    (window as any).__THREE_VIEWPORT_STATS__ = {
      THREE,
      scene,
      camera,
      meshesGroup,
      renderer,
      getElementScreenPos: (expressId: number) => {
        const meshes = meshMapRef.current.get(expressId);
        if (!meshes || meshes.length === 0 || !cameraRef.current || !containerRef.current) return null;
        const box = new THREE.Box3();
        meshes.forEach((m) => {
          if (m.geometry) {
            if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
            if (m.geometry.boundingBox) {
              box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld));
            }
          } else {
            box.union(new THREE.Box3().setFromObject(m));
          }
        });
        if (box.isEmpty()) return null;
        const center = new THREE.Vector3();
        box.getCenter(center);
        center.project(cameraRef.current);
        if (center.z > 1.0 || center.z < -1.0) return null;
        const rect = containerRef.current.getBoundingClientRect();
        return {
          x: ((center.x + 1) / 2) * rect.width + rect.left,
          y: ((-center.y + 1) / 2) * rect.height + rect.top
        };
      },
      getRendererInfo: () => ({
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        points: renderer.info.render.points,
        lines: renderer.info.render.lines,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures
      }),
      getRenderStats: () => {
        let wireframe = false;
        let opacity = 1.0;
        let roughness = 0.7;
        let metalness = 0.05;
        let sampleCount = 0;

        if (categoryMaterialsRef.current.size > 0) {
          const firstMat = categoryMaterialsRef.current.values().next().value;
          if (firstMat) {
            wireframe = Boolean(firstMat.wireframe);
            opacity = firstMat.opacity;
            roughness = firstMat.roughness;
            metalness = firstMat.metalness;
            sampleCount++;
          }
        }

        if (sampleCount === 0) {
          meshMapRef.current.forEach((meshes) => {
            if (sampleCount === 0 && meshes.length > 0 && meshes[0].material) {
              const m = meshes[0].material as THREE.MeshStandardMaterial;
              wireframe = Boolean(m.wireframe);
              opacity = m.opacity;
              roughness = m.roughness;
              metalness = m.metalness;
              sampleCount++;
            }
          });
        }

        if (sampleCount === 0) {
          wireframe = (renderStyleRef.current === 'wireframe');
          opacity = (renderStyleRef.current === 'transparent' || renderStyleRef.current === 'ghost') ? 0.28 : 1.0;
        }

        return {
          wireframe,
          opacity,
          roughness,
          metalness,
          shadowMapEnabled: Boolean(renderer.shadowMap.enabled),
          shadowGroundVisible: Boolean(shadowGroundRef.current && shadowGroundRef.current.visible),
          transparentEdgesGroupVisible: Boolean(transparentEdgesGroupRef.current && transparentEdgesGroupRef.current.visible),
          transparentEdgesCount: transparentEdgesGroupRef.current ? transparentEdgesGroupRef.current.children.length : 0
        };
      },
      requestRender: () => {
        needsRenderRef.current = true;
      }
    };

    // Animate & Dynamic 3D Projection with Damped On-Demand Rendering
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const cameraMoved = controls.update();
      if (cameraMoved) {
        needsRenderRef.current = true;
      }

      // Update snap indicator orientation and camera distance compensation
      if (snapGroup.visible && camera) {
        snapGroup.quaternion.copy(camera.quaternion);
        const dist = camera.position.distanceTo(snapGroup.position);
        const s = Math.max(0.015, dist * 0.08); // Consistent ~16-20px screen size
        snapGroup.scale.set(s, s, s);
        needsRenderRef.current = true;
      }

      // Update pivot dot orientation and camera distance compensation
      if (pivotDotGroupRef.current && pivotDotGroupRef.current.visible && camera) {
        pivotDotGroupRef.current.quaternion.copy(camera.quaternion);
        const dist = camera.position.distanceTo(pivotDotGroupRef.current.position);
        const s = Math.max(0.012, dist * 0.038); // Consistent ~14px screen size
        pivotDotGroupRef.current.scale.set(s, s, s);
        needsRenderRef.current = true;
      }

      // Render only when camera moves, animations play, or scene changes
      if (needsRenderRef.current) {
        renderer.render(scene, camera);
        needsRenderRef.current = false;

        // Project 3D vector midpoints to 2D screen coordinates
        if (container) {
          if (measurementsRef.current.length === 0) {
            if (lastScreenMeasureUpdateRef.current !== measurementsRef.current) {
              lastScreenMeasureUpdateRef.current = measurementsRef.current;
              setScreenMeasurements([]);
            }
          } else if (cameraMoved || lastScreenMeasureUpdateRef.current !== measurementsRef.current) {
            lastScreenMeasureUpdateRef.current = measurementsRef.current;
            const width = container.clientWidth;
            const height = container.clientHeight;
            const projected = measurementsRef.current.map((m) => {
              const vec = new THREE.Vector3(...m.midpoint).project(camera);
              const x = (vec.x * 0.5 + 0.5) * width;
              const y = (-(vec.y * 0.5) + 0.5) * height;
              const visible = vec.z < 1.0 && x >= 0 && x <= width && y >= 0 && y <= height;
              return { id: m.id, x, y, visible, distance: m.distance };
            });
            setScreenMeasurements(projected);
          }
        }
      }
    };
    animate();

    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      if (container.clientWidth === 0 || container.clientHeight === 0) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
      needsRenderRef.current = true;
    };
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (navSettleTimerRef.current) window.clearTimeout(navSettleTimerRef.current);
      delete (window as any).__THREE_VIEWPORT_STATS__;

      tControls.dispose();
      unregisterSceneMatrixHandle();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', handleDomPointerDown);
      window.removeEventListener('pointerup', handleDomPointerUp);

      // STEP-23 (F-034): drop any coalesced hover frame before the renderer goes away.
      hoverSchedulerRef.current?.cancel();

      // STEP-23: the contour-edge cache owns its geometries; drop them before the
      // model geometry they were derived from.
      clearEdgeGeometryCache();

      // STEP-23 (F-037): dispose the model graph, the shared material pools and the
      // registries, then detach. `renderer.dispose()` runs after this so no live
      // BufferGeometry outlives the GL context.
      disposeSceneGraph(meshesGroupRef.current, scene, {
        materialPools: [
          categoryMaterialsRef.current as Map<string, THREE.Material>,
          disciplineMaterialsRef.current as Map<string, THREE.Material>
        ],
        registries: [
          meshMapRef.current as Map<unknown, unknown>,
          edgeGeometryCacheRef.current as Map<unknown, unknown>
        ]
      });
      meshesGroupRef.current = null;
      batchRegistryRef.current = [];
      if (diffMaterialsRef.current) {
        diffMaterialsRef.current.added.dispose();
        diffMaterialsRef.current.modified.dispose();
        diffMaterialsRef.current.unchanged.dispose();
        diffMaterialsRef.current = null;
      }

      renderer.dispose();

      ringGeom.dispose();
      ringMat.dispose();
      dotGeom.dispose();
      dotMat.dispose();
      tickGeom.dispose();
      tickMat.dispose();
      scene.remove(snapGroup);

      previewLineGeom.dispose();
      previewLineMat.dispose();
      startSphereGeom.dispose();
      startSphereMat.dispose();
      endSphereGeom.dispose();
      endSphereMat.dispose();
      scene.remove(previewGroup);

      if (transparentEdgesGroupRef.current) {
        disposeHighlightGroup(transparentEdgesGroupRef.current, scene);
        transparentEdgesGroupRef.current = null;
      }
      if (shadowGroundRef.current) {
        scene.remove(shadowGroundRef.current);
        shadowGroundRef.current.geometry.dispose();
        (shadowGroundRef.current.material as THREE.Material).dispose();
        shadowGroundRef.current = null;
      }
      if (groundGridRef.current) {
        scene.remove(groundGridRef.current.mesh);
        groundGridRef.current.dispose();
        groundGridRef.current = null;
      }
      if (sectionPlaneHelperRef.current) {
        scene.remove(sectionPlaneHelperRef.current);
        sectionPlaneHelperRef.current.geometry.dispose();
        (sectionPlaneHelperRef.current.material as THREE.Material).dispose();
        sectionPlaneHelperRef.current = null;
      }

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [onTransformEnd, onTransformChange, clearEdgeGeometryCache]);

  // 1b. Keep the adaptive damping in sync with the real geometry count (F-038).
  // One answer to "is this a large model?", recomputed whenever the count changes.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const damping = navigationTuningRef.current.update(geometries.length);
    controls.dampingFactor = damping;
    needsRenderRef.current = true;
  }, [geometries.length]);

  // 2. Update Section Clipping Plane & Visualizer Helper
  useEffect(() => {
    const plane = clipPlaneRef.current;
    if (!sectionConfig.enabled) {
      plane.set(new THREE.Vector3(0, 1, 0), 1000); // disable by pushing far away
      if (sectionPlaneHelperRef.current) {
        sectionPlaneHelperRef.current.visible = false;
      }
      return;
    }

    const dir = sectionConfig.inverted ? 1 : -1;
    let normal = new THREE.Vector3(0, dir, 0);
    if (sectionConfig.axis === 'x') normal = new THREE.Vector3(dir, 0, 0);
    else if (sectionConfig.axis === 'z') normal = new THREE.Vector3(0, 0, dir);

    plane.set(normal, sectionConfig.position * dir);

    const scene = sceneRef.current;
    if (scene) {
      if (!sectionPlaneHelperRef.current) {
        const helper = new THREE.PlaneHelper(plane, 40, 0x0284c7);
        helper.renderOrder = 8000;
        const lineMat = helper.material as THREE.LineBasicMaterial;
        lineMat.transparent = true;
        lineMat.opacity = 0.65;
        lineMat.depthWrite = false;
        scene.add(helper);
        sectionPlaneHelperRef.current = helper;
      }
      sectionPlaneHelperRef.current.visible = true;
      sectionPlaneHelperRef.current.plane = plane;
    }
  }, [sectionConfig]);

  // 3. Update Meshes & Apply Clipping Planes & Materials
  useEffect(() => {
    const scene = sceneRef.current;
    const group = meshesGroupRef.current;
    const tControls = transformControlsRef.current;
    if (!scene || !group) return;

    if (tControls) tControls.detach();

    while (group.children.length > 0) {
      const child = group.children[0] as THREE.Mesh;
      group.remove(child);
      if (child.geometry) {
        (child.geometry as any).disposeBoundsTree?.();
        child.geometry.dispose();
      }
    }
    meshMapRef.current.clear();
    batchRegistryRef.current = [];

    if (selectedHighlightGroupRef.current) {
      disposeHighlightGroup(selectedHighlightGroupRef.current, scene);
      selectedHighlightGroupRef.current = null;
    }
    if (hoverHighlightGroupRef.current) {
      disposeHighlightGroup(hoverHighlightGroupRef.current, scene);
      hoverHighlightGroupRef.current = null;
    }
    if (transparentEdgesGroupRef.current) {
      disposeHighlightGroup(transparentEdgesGroupRef.current, scene);
      transparentEdgesGroupRef.current = null;
    }
    // STEP-23: contour edges were derived from the geometry disposed above.
    clearEdgeGeometryCache();
    if (shadowGroundRef.current) {
      if (scene) scene.remove(shadowGroundRef.current);
      shadowGroundRef.current.geometry.dispose();
      (shadowGroundRef.current.material as THREE.Material).dispose();
      shadowGroundRef.current = null;
    }

    if (geometries.length === 0) return;

    // Clear previous category materials
    const catMats = categoryMaterialsRef.current;
    catMats.forEach((m) => m.dispose());
    catMats.clear();

    const box = new THREE.Box3();
    const isLargeModel = geometries.length > 150;

    if (isLargeModel) {
      // High-performance BatchedMesh engine: Consolidate geometries by category into single draw calls
      const categoryMap = new Map<string, GeometryData[]>();
      geometries.forEach((g) => {
        let list = categoryMap.get(g.type);
        if (!list) {
          list = [];
          categoryMap.set(g.type, list);
        }
        list.push(g);
      });

      // Reused colour scratch for per-instance paint (see batchHandle below).
      const scratchColor = new THREE.Color();

      categoryMap.forEach((catGeoms, category) => {
        let totalVerts = 0;
        let totalIndices = 0;
        catGeoms.forEach((g) => {
          totalVerts += g.positions.length / 3;
          totalIndices += g.indices.length;
        });

        // Get or create shared category material
        let material = catMats.get(category);
        if (!material) {
          const config = CATEGORY_COLORS[category] || DEFAULT_MATERIAL_CONFIG;
          const isTransparent = Boolean(config.opacity && config.opacity < 1.0);
          material = new THREE.MeshStandardMaterial({
            color: config.color,
            roughness: config.roughness,
            metalness: config.metalness,
            transparent: isTransparent,
            opacity: config.opacity ?? 1.0,
            side: isTransparent ? THREE.DoubleSide : THREE.FrontSide,
            clippingPlanes: [clipPlaneRef.current],
            clipShadows: true
          });
          catMats.set(category, material);
        }

        const batchedMesh = new THREE.BatchedMesh(catGeoms.length, totalVerts, totalIndices, material);
        batchedMesh.castShadow = !material.transparent;
        batchedMesh.receiveShadow = true;
        batchedMesh.frustumCulled = true;

        const instanceDataList: { expressID: number; type: string; discipline: string; modelId: string }[] = [];

        catGeoms.forEach((geom) => {
          const bg = new THREE.BufferGeometry();
          bg.setAttribute('position', new THREE.BufferAttribute(geom.positions, 3));
          bg.setAttribute('normal', new THREE.BufferAttribute(geom.normals, 3));
          bg.setIndex(new THREE.BufferAttribute(geom.indices, 1));
          bg.computeBoundingBox();
          bg.computeBoundingSphere();

          const gid = batchedMesh.addGeometry(bg);
          const iid = batchedMesh.addInstance(gid);

          const mat = geom.matrix && geom.matrix.length === 16
            ? new THREE.Matrix4().fromArray(geom.matrix)
            : new THREE.Matrix4();
          batchedMesh.setMatrixAt(iid, mat);

          const disc = geom.discipline || inferDiscipline(geom.type);
          const modelId = geom.modelId || 'main';

          instanceDataList.push({
            expressID: geom.expressID,
            type: geom.type,
            discipline: disc,
            modelId
          });

          // Lightweight selection and transform proxy
          const proxy = new THREE.Mesh(bg, material);
          proxy.applyMatrix4(mat);
          proxy.updateMatrixWorld(true);
          proxy.visible = false;
          proxy.userData = {
            expressID: geom.expressID,
            type: geom.type,
            discipline: disc,
            modelId,
            batchedMesh,
            batchId: iid
          };

          const existing = meshMapRef.current.get(geom.expressID) || [];
          existing.push(proxy);
          meshMapRef.current.set(geom.expressID, existing);

          if (bg.boundingBox) {
            const transformedBox = bg.boundingBox.clone().applyMatrix4(mat);
            box.union(transformedBox);
          }
        });

        batchedMesh.userData = {
          category,
          instances: instanceDataList
        };
        batchedMesh.computeBoundingBox();
        batchedMesh.computeBoundingSphere();

        // STEP-08: hand the batch to the visibility/colour effects. `createBatchLike`
        // is the only place that touches the renderer's setVisibleAt/setColorAt; the
        // rules themselves stay in `utils/instanceVisibility`.
        const batchHandle: BatchLike = createBatchLike(batchedMesh, (hex) =>
          scratchColor.setHex(hex)
        );
        batchRegistryRef.current.push({ mesh: batchHandle, instances: instanceDataList });

        // Allocate the per-instance colour texture once, at load time, so the shader
        // recompile happens here instead of on the first Discipline/Diff switch.
        applyInstanceColors(
          [{ mesh: batchHandle, instances: instanceDataList }],
          new Map<number, number>()
        );

        group.add(batchedMesh);
      });
    } else {
      // Standard separate mesh mode for small models (< 150 elements)
      geometries.forEach((geom) => {
        const bufferGeometry = new THREE.BufferGeometry();
        bufferGeometry.setAttribute('position', new THREE.BufferAttribute(geom.positions, 3));
        bufferGeometry.setAttribute('normal', new THREE.BufferAttribute(geom.normals, 3));
        bufferGeometry.setIndex(new THREE.BufferAttribute(geom.indices, 1));
        bufferGeometry.computeBoundingBox();
        bufferGeometry.computeBoundingSphere();

        // Compute BVH bounds tree for sub-millisecond accelerated raycasting
        try {
          (bufferGeometry as any).computeBoundsTree?.();
        } catch (err) {
          console.warn('BVH computation failed on geom:', err);
        }

        let material = catMats.get(geom.type);
        if (!material) {
          const config = CATEGORY_COLORS[geom.type] || DEFAULT_MATERIAL_CONFIG;
          const isTransparent = Boolean(config.opacity && config.opacity < 1.0);
          material = new THREE.MeshStandardMaterial({
            color: config.color,
            roughness: config.roughness,
            metalness: config.metalness,
            transparent: isTransparent,
            opacity: config.opacity ?? 1.0,
            side: isTransparent ? THREE.DoubleSide : THREE.FrontSide,
            clippingPlanes: [clipPlaneRef.current],
            clipShadows: true
          });
          catMats.set(geom.type, material);
        }

        const isTransparent = material.transparent;
        const mesh = new THREE.Mesh(bufferGeometry, material);
        mesh.castShadow = !isTransparent;
        mesh.receiveShadow = true;
        mesh.frustumCulled = true;

        if (geom.matrix && geom.matrix.length === 16) {
          const mat = new THREE.Matrix4().fromArray(geom.matrix);
          mesh.applyMatrix4(mat);
        }
        mesh.updateMatrixWorld(true);

        mesh.userData = {
          expressID: geom.expressID,
          type: geom.type,
          modelId: geom.modelId || 'main',
          discipline: geom.discipline || inferDiscipline(geom.type)
        };
        group.add(mesh);

        const existing = meshMapRef.current.get(geom.expressID) || [];
        existing.push(mesh);
        meshMapRef.current.set(geom.expressID, existing);

        if (bufferGeometry.boundingBox) {
          const transformedBox = bufferGeometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
          box.union(transformedBox);
        }
      });
    }

    if (rendererRef.current) {
      rendererRef.current.shadowMap.needsUpdate = true;
    }
    needsRenderRef.current = true;

    if (!box.isEmpty()) {
      const groundY = box.min.y - 0.02;
      if (groundGridRef.current) {
        groundGridRef.current.setElevation(groundY);
      }
    }

    if (!box.isEmpty() && cameraRef.current && controlsRef.current) {
      const projKey = projectId || (geometries.length > 0 ? 'loaded' : null);
      if (projKey && lastFittedProjectIdRef.current !== projKey) {
        lastFittedProjectIdRef.current = projKey;
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = cameraRef.current.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        cameraZ *= 1.8;

        cameraRef.current.position.set(center.x + cameraZ * 0.8, center.y + cameraZ * 0.6, center.z + cameraZ);
        cameraRef.current.lookAt(center);
        controlsRef.current.target.copy(center);
        controlsRef.current.update();
      }
    }
  }, [geometries, projectId, clearEdgeGeometryCache]);

  // Handle visibility filtering (Categories, Isolation, & Model Federation)
  useEffect(() => {
    const state = { hiddenCategories, isolatedExpressID, hiddenModelIds };

    // STEP-08 (F-006): the batch path draws every instance through one BatchedMesh,
    // so the proxies in `meshMapRef` are never on screen. Drive the batch's own
    // per-instance visibility - never `mesh.visible`, which would stop
    // `onBeforeRender` from re-showing instances later.
    applyBatchVisibility(batchRegistryRef.current, state);

    meshMapRef.current.forEach((meshes) => {
      meshes.forEach((mesh) => {
        // Batch instances are handled above; their proxies only carry transforms.
        if (mesh.userData.batchedMesh) return;
        mesh.visible = isInstanceVisible(
          {
            expressID: mesh.userData.expressID as number,
            type: mesh.userData.type as string,
            modelId: (mesh.userData.modelId as string) || 'main'
          },
          state
        );
      });
    });
    needsRenderRef.current = true;
  }, [hiddenCategories, isolatedExpressID, hiddenModelIds]);

  // 4. Update Render Style (Shaded, Wireframe, Ghost, Discipline, Diff) via Shared Material Pool
  useEffect(() => {
    const catMats = categoryMaterialsRef.current;
    const discMats = disciplineMaterialsRef.current;
    const clipPlane = clipPlaneRef.current;

    // STEP-08: a BatchedMesh draws every instance with one material, so per-element
    // styles must go through the instance colour channel. Reset to white first so a
    // style switch (Discipline -> Solid) leaves no residue behind.
    applyInstanceColors(batchRegistryRef.current, new Map<number, number>());

    const getDiscMat = (disc: string) => {
      let m = discMats.get(disc);
      if (!m) {
        const discColor = DISCIPLINE_COLORS[disc] || DISCIPLINE_COLORS.ARCH;
        m = new THREE.MeshStandardMaterial({
          color: discColor.color,
          roughness: discColor.roughness,
          metalness: discColor.metalness,
          transparent: false,
          opacity: 1.0,
          side: THREE.FrontSide,
          clippingPlanes: [clipPlane],
          clipShadows: true
        });
        discMats.set(disc, m);
      }
      return m;
    };

    if (renderStyle === 'transparent' || renderStyle === 'ghost') {
      // 1. Transparent with Solid Edges (Architectural Ghost Contours)
      if (shadowGroundRef.current) shadowGroundRef.current.visible = false;
      if (rendererRef.current) {
        rendererRef.current.shadowMap.enabled = false;
        rendererRef.current.shadowMap.needsUpdate = false;
      }

      catMats.forEach((mat) => {
        mat.wireframe = false;
        mat.transparent = true;
        mat.opacity = 0.28;
        mat.depthWrite = true;
        mat.needsUpdate = true;
      });

      meshMapRef.current.forEach((meshes) => {
        meshes.forEach((mesh) => {
          const type = mesh.userData.type as string;
          const targetMat = catMats.get(type);
          if (targetMat && mesh.material !== targetMat) mesh.material = targetMat;
        });
      });

      // Show solid contour edges
      const scene = sceneRef.current;
      if (!transparentEdgesGroupRef.current && scene) {
        const edgeGroup = new THREE.Group();
        edgeGroup.name = 'transparent-edges-group';
        scene.add(edgeGroup);
        transparentEdgesGroupRef.current = edgeGroup;
      }

      const edgeGroup = transparentEdgesGroupRef.current;
      if (edgeGroup) {
        if (edgeGroup.children.length === 0) {
          const edgeColor = theme === 'dark' ? 0x94a3b8 : 0x1e293b;
          const edgeMat = new THREE.LineBasicMaterial({
            color: edgeColor,
            transparent: false,
            opacity: 1.0,
            depthTest: true,
            clippingPlanes: [clipPlane]
          });

          meshMapRef.current.forEach((meshes) => {
            meshes.forEach((mesh) => {
              if (mesh.geometry) {
                try {
                  const edgesGeom = new THREE.EdgesGeometry(mesh.geometry, 24);
                  const lineSegs = new THREE.LineSegments(edgesGeom, edgeMat);
                  lineSegs.matrixAutoUpdate = false;
                  lineSegs.matrix.copy(mesh.matrixWorld);
                  lineSegs.userData = { isSharedEdgeGeometry: true };
                  edgeGroup.add(lineSegs);
                } catch {}
              }
            });
          });
        }
        edgeGroup.visible = true;
      }

    } else if (renderStyle === 'wireframe') {
      // 2. Wireframe CAD
      if (transparentEdgesGroupRef.current) transparentEdgesGroupRef.current.visible = false;
      if (shadowGroundRef.current) shadowGroundRef.current.visible = false;
      if (rendererRef.current) {
        rendererRef.current.shadowMap.enabled = false;
        rendererRef.current.shadowMap.needsUpdate = false;
      }

      catMats.forEach((mat) => {
        mat.wireframe = true;
        mat.opacity = 1.0;
        mat.transparent = false;
        mat.needsUpdate = true;
      });
      meshMapRef.current.forEach((meshes) => {
        meshes.forEach((mesh) => {
          const type = mesh.userData.type as string;
          const targetMat = catMats.get(type);
          if (targetMat && mesh.material !== targetMat) mesh.material = targetMat;
        });
      });

    } else if (renderStyle === 'shadowed') {
      // 3. Shadowed (Directional Lighting & Contact Shadows)
      if (transparentEdgesGroupRef.current) transparentEdgesGroupRef.current.visible = false;

      catMats.forEach((mat, type) => {
        const config = CATEGORY_COLORS[type] || DEFAULT_MATERIAL_CONFIG;
        mat.wireframe = false;
        mat.transparent = Boolean(config.opacity && config.opacity < 1.0);
        mat.opacity = config.opacity ?? 1.0;
        mat.roughness = 0.65;
        mat.metalness = 0.1;
        mat.color.setHex(config.color);
        mat.needsUpdate = true;
      });

      meshMapRef.current.forEach((meshes) => {
        meshes.forEach((mesh) => {
          const type = mesh.userData.type as string;
          const targetMat = catMats.get(type);
          if (targetMat && mesh.material !== targetMat) mesh.material = targetMat;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        });
      });

      if (rendererRef.current) {
        rendererRef.current.shadowMap.enabled = true;
        rendererRef.current.shadowMap.autoUpdate = true;
        rendererRef.current.shadowMap.needsUpdate = true;
      }

      const scene = sceneRef.current;
      if (!shadowGroundRef.current && scene) {
        const gGeom = new THREE.PlaneGeometry(250, 250);
        const gMat = new THREE.ShadowMaterial({ opacity: 0.35, clippingPlanes: [clipPlane] });
        const ground = new THREE.Mesh(gGeom, gMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.02;
        ground.receiveShadow = true;
        scene.add(ground);
        shadowGroundRef.current = ground;
      }
      if (shadowGroundRef.current) shadowGroundRef.current.visible = true;

    } else if (renderStyle === 'materials') {
      // 4. Authentic BIM Materials (PBR Physical Simulation)
      if (transparentEdgesGroupRef.current) transparentEdgesGroupRef.current.visible = false;
      if (shadowGroundRef.current) shadowGroundRef.current.visible = false;

      catMats.forEach((mat, type) => {
        const pbr = BIM_PBR_MATERIALS[type] || {
          color: (CATEGORY_COLORS[type] || DEFAULT_MATERIAL_CONFIG).color,
          roughness: 0.5,
          metalness: 0.2
        };
        mat.wireframe = false;
        mat.color.setHex(pbr.color);
        mat.roughness = pbr.roughness;
        mat.metalness = pbr.metalness;
        mat.transparent = Boolean(pbr.transparent);
        mat.opacity = pbr.opacity ?? 1.0;
        mat.needsUpdate = true;
      });

      meshMapRef.current.forEach((meshes) => {
        meshes.forEach((mesh) => {
          const type = mesh.userData.type as string;
          const targetMat = catMats.get(type);
          if (targetMat && mesh.material !== targetMat) mesh.material = targetMat;
        });
      });

      if (rendererRef.current) {
        rendererRef.current.shadowMap.enabled = true;
        rendererRef.current.shadowMap.autoUpdate = true;
        rendererRef.current.shadowMap.needsUpdate = true;
      }

    } else if (renderStyle === 'discipline') {
      // 5. Discipline Mode
      if (transparentEdgesGroupRef.current) transparentEdgesGroupRef.current.visible = false;
      if (shadowGroundRef.current) shadowGroundRef.current.visible = false;
      if (rendererRef.current) {
        rendererRef.current.shadowMap.enabled = false;
        rendererRef.current.shadowMap.needsUpdate = false;
      }

      meshMapRef.current.forEach((meshes) => {
        meshes.forEach((mesh) => {
          const disc = (mesh.userData.discipline as string) || inferDiscipline(mesh.userData.type as string);
          mesh.material = getDiscMat(disc);
        });
      });

      // STEP-08: the batch has a single material, so discipline is expressed per
      // instance through the colour channel (white reset already applied above).
      const disciplineColors = new Map<number, number>();
      batchRegistryRef.current.forEach((entry) => {
        entry.instances.forEach((instance) => {
          const disc = instance.discipline ?? inferDiscipline(instance.type);
          disciplineColors.set(
            instance.expressID,
            (DISCIPLINE_COLORS[disc] || DISCIPLINE_COLORS.ARCH).color
          );
        });
      });
      applyInstanceColors(batchRegistryRef.current, disciplineColors);

    } else if (renderStyle === 'diff') {
      // 6. Spatial Diff Mode
      if (transparentEdgesGroupRef.current) transparentEdgesGroupRef.current.visible = false;
      if (shadowGroundRef.current) shadowGroundRef.current.visible = false;
      if (rendererRef.current) {
        rendererRef.current.shadowMap.enabled = false;
        rendererRef.current.shadowMap.needsUpdate = false;
      }

      if (!diffMaterialsRef.current) {
        diffMaterialsRef.current = {
          added: new THREE.MeshStandardMaterial({ color: 0x10b981, transparent: false, opacity: 1.0, clippingPlanes: [clipPlane] }),
          modified: new THREE.MeshStandardMaterial({ color: 0xf59e0b, transparent: false, opacity: 1.0, clippingPlanes: [clipPlane] }),
          unchanged: new THREE.MeshStandardMaterial({ color: 0x64748b, transparent: true, opacity: 0.2, clippingPlanes: [clipPlane] })
        };
      }
      const dm = diffMaterialsRef.current;
      meshMapRef.current.forEach((meshes) => {
        meshes.forEach((mesh) => {
          const expressId = mesh.userData.expressID as number;
          const isAdded = auditDiff?.added?.includes(expressId);
          const isModified = auditDiff?.modified?.includes(expressId);
          if (isAdded) mesh.material = dm.added;
          else if (isModified) mesh.material = dm.modified;
          else mesh.material = dm.unchanged;
        });
      });

      // STEP-08: same reasoning as Discipline - Diff is inherently per element.
      const added = new Set(auditDiff?.added ?? []);
      const modified = new Set(auditDiff?.modified ?? []);
      const diffColors = new Map<number, number>();
      batchRegistryRef.current.forEach((entry) => {
        entry.instances.forEach((instance) => {
          const expressId = instance.expressID;
          if (added.has(expressId)) diffColors.set(expressId, 0x10b981);
          else if (modified.has(expressId)) diffColors.set(expressId, 0xf59e0b);
          else diffColors.set(expressId, 0x64748b);
        });
      });
      applyInstanceColors(batchRegistryRef.current, diffColors);

    } else {
      // 7. Solid CAD Mode (Default / Shaded)
      if (transparentEdgesGroupRef.current) transparentEdgesGroupRef.current.visible = false;
      if (shadowGroundRef.current) shadowGroundRef.current.visible = false;
      if (rendererRef.current) {
        rendererRef.current.shadowMap.enabled = false;
        rendererRef.current.shadowMap.needsUpdate = false;
      }

      catMats.forEach((mat, type) => {
        const config = CATEGORY_COLORS[type] || DEFAULT_MATERIAL_CONFIG;
        mat.wireframe = false;
        mat.transparent = Boolean(config.opacity && config.opacity < 1.0);
        mat.opacity = config.opacity ?? 1.0;
        mat.roughness = config.roughness ?? 0.7;
        mat.metalness = config.metalness ?? 0.05;
        mat.color.setHex(config.color);
        mat.needsUpdate = true;
      });
      meshMapRef.current.forEach((meshes) => {
        meshes.forEach((mesh) => {
          const type = mesh.userData.type as string;
          const targetMat = catMats.get(type);
          if (targetMat && mesh.material !== targetMat) mesh.material = targetMat;
        });
      });
    }
    needsRenderRef.current = true;
  }, [renderStyle, auditDiff, theme]);

  // 4b. Render 3D Clash Collision Marker & Wireframe Box
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (!clashMarkerGroupRef.current) {
      const g = new THREE.Group();
      scene.add(g);
      clashMarkerGroupRef.current = g;
    }
    const group = clashMarkerGroupRef.current;

    // Clear previous clash marker
    while (group.children.length > 0) {
      const child = group.children[0] as THREE.Mesh;
      group.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
      else if (child.material) child.material.dispose();
    }

    if (!activeClash) return;

    const center = new THREE.Vector3(...activeClash.intersection_center);

    // Glowing collision octahedron marker
    const markerGeom = new THREE.OctahedronGeometry(0.35, 0);
    const markerMat = new THREE.MeshStandardMaterial({
      color: activeClash.severity === 'hard' ? 0xef4444 : 0xf59e0b,
      emissive: activeClash.severity === 'hard' ? 0xdc2626 : 0xd97706,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.8
    });
    const markerMesh = new THREE.Mesh(markerGeom, markerMat);
    markerMesh.position.copy(center);
    markerMesh.renderOrder = 9999;
    group.add(markerMesh);

    // Bounding collision wireframe box
    const minPt = new THREE.Vector3(...activeClash.box_min);
    const maxPt = new THREE.Vector3(...activeClash.box_max);
    const b3 = new THREE.Box3(minPt, maxPt);
    const boxHelper = new THREE.Box3Helper(b3, new THREE.Color(activeClash.severity === 'hard' ? 0xef4444 : 0xf59e0b));
    group.add(boxHelper);

    // Smoothly focus camera on clash center
    if (controlsRef.current && cameraRef.current) {
      controlsRef.current.target.copy(center);
      const cam = cameraRef.current;
      cam.position.set(center.x + 3.5, center.y + 2.5, center.z + 3.5);
      cam.lookAt(center);
      controlsRef.current.update();
    }
    needsRenderRef.current = true;
  }, [activeClash]);

  // 5. Handle Camera Presets (Iso, Top, Front, Side)
  useEffect(() => {
    if (!cameraPresetTrigger) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const target = controls.target.clone();
    const dist = camera.position.distanceTo(target);

    switch (cameraPresetTrigger.preset) {
      case 'top':
        camera.position.set(target.x, target.y + dist, target.z + 0.0001);
        break;
      case 'front':
        camera.position.set(target.x, target.y, target.z + dist);
        break;
      case 'side':
        camera.position.set(target.x + dist, target.y, target.z);
        break;
      case 'iso':
      default:
        camera.position.set(target.x + dist * 0.6, target.y + dist * 0.5, target.z + dist * 0.6);
        break;
    }
    camera.lookAt(target);
    controls.update();
    needsRenderRef.current = true;
  }, [cameraPresetTrigger]);

  // 6. Render Measurements in 3D (Markers & Dimension Lines)
  useEffect(() => {
    const group = measureGroupRef.current;
    if (!group) return;

    while (group.children.length > 0) {
      const c = group.children[0];
      group.remove(c);
      if ('geometry' in c && c.geometry instanceof THREE.BufferGeometry) c.geometry.dispose();
      if ('material' in c && c.material instanceof THREE.Material) c.material.dispose();
    }

    const sphereGeom = new THREE.SphereGeometry(0.08, 16, 16);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const lineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });

    measurements.forEach((m) => {
      const p1 = new THREE.Vector3(...m.start);
      const p2 = new THREE.Vector3(...m.end);

      // Sphere markers
      const s1 = new THREE.Mesh(sphereGeom, markerMat);
      s1.position.copy(p1);
      group.add(s1);

      const s2 = new THREE.Mesh(sphereGeom, markerMat);
      s2.position.copy(p2);
      group.add(s2);

      // Dimension line
      const lineGeom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const line = new THREE.Line(lineGeom, lineMat);
      group.add(line);
    });

    if (pendingStartPoint) {
      const pendingSphere = new THREE.Mesh(
        sphereGeom,
        new THREE.MeshBasicMaterial({ color: 0xf59e0b })
      );
      pendingSphere.position.copy(pendingStartPoint);
      group.add(pendingSphere);
    }
    needsRenderRef.current = true;
  }, [measurements, pendingStartPoint]);

  // 7. Handle Active Selection & TransformControls
  useEffect(() => {
    const scene = sceneRef.current;
    const tControls = transformControlsRef.current;
    if (!scene || !tControls) return;

    if (selectedHighlightGroupRef.current) {
      disposeHighlightGroup(selectedHighlightGroupRef.current, scene);
      selectedHighlightGroupRef.current = null;
    }

    if (selectedExpressID === null || isMeasureActive) {
      tControls.detach();
      if (pivotDotGroupRef.current) {
        pivotDotGroupRef.current.visible = false;
      }
      needsRenderRef.current = true;
      return;
    }

    const meshes = meshMapRef.current.get(selectedExpressID);
    if (!meshes || meshes.length === 0) {
      tControls.detach();
      if (pivotDotGroupRef.current) {
        pivotDotGroupRef.current.visible = false;
      }
      needsRenderRef.current = true;
      return;
    }

    // STEP-08 (spec 7): a selected element that is currently hidden by category,
    // isolation or federation produces no highlight overlay and no gizmo - otherwise
    // "hidden" elements still show a contour.
    const visibilityState = { hiddenCategories, isolatedExpressID, hiddenModelIds };
    if (
      !isInstanceVisible(
        {
          expressID: selectedExpressID,
          type: meshes[0].userData.type as string,
          modelId: (meshes[0].userData.modelId as string) || 'main'
        },
        visibilityState
      )
    ) {
      tControls.detach();
      if (pivotDotGroupRef.current) {
        pivotDotGroupRef.current.visible = false;
      }
      needsRenderRef.current = true;
      return;
    }

    const primaryMesh = meshes[0];
    const highlightConfig = settings?.highlighting ?? DEFAULT_EDITOR_SETTINGS.highlighting;
    const selGroup = new THREE.Group();
    selGroup.name = 'selection-highlight-group';

    const edgeColor = new THREE.Color(highlightConfig.selectionEdgeColor || DEFAULT_EDITOR_SETTINGS.highlighting.selectionEdgeColor);
    const edgeOpacity = highlightConfig.selectionEdgeOpacity ?? 1.0;
    const isContours = highlightConfig.highlightStyle === 'contours';

    meshes.forEach((mesh) => {
      if (!mesh.geometry) return;
      mesh.updateMatrixWorld(true);

      // High-visibility Architectural Contours or Bounding Box
      if (isContours) {
        try {
          // STEP-23: reused per element; owned by the edge cache, not by this group.
          const edgesGeom = getCachedEdgesGeometry(mesh);
          if (!edgesGeom) throw new Error('missing geometry');
          const edgeMat = new THREE.LineBasicMaterial({
            color: edgeColor,
            transparent: edgeOpacity < 1,
            opacity: edgeOpacity,
            depthTest: !highlightConfig.xrayHighlight,
            depthWrite: false
          });
          const lineSegs = new THREE.LineSegments(edgesGeom, edgeMat);
          lineSegs.matrixAutoUpdate = false;
          lineSegs.matrix.copy(mesh.matrixWorld);
          markSharedGeometry(lineSegs);
          lineSegs.userData = { ...lineSegs.userData, sourceMesh: mesh };
          selGroup.add(lineSegs);
        } catch {
          const bbox = new THREE.BoxHelper(mesh, edgeColor.getHex());
          bbox.userData = { sourceMesh: mesh };
          selGroup.add(bbox);
        }
      } else {
        const bbox = new THREE.BoxHelper(mesh, edgeColor.getHex());
        const boxMat = bbox.material as THREE.LineBasicMaterial;
        boxMat.transparent = edgeOpacity < 1;
        boxMat.opacity = edgeOpacity;
        boxMat.depthWrite = false;
        bbox.userData = { sourceMesh: mesh };
        selGroup.add(bbox);
      }

      // Distinct active selection surface wash
      if ((highlightConfig.selectionFillOpacity ?? 0.28) > 0) {
        const fillColor = new THREE.Color(highlightConfig.selectionColor || DEFAULT_EDITOR_SETTINGS.highlighting.selectionColor);
        const selOverlayMat = new THREE.MeshBasicMaterial({
          color: fillColor,
          transparent: true,
          opacity: highlightConfig.selectionFillOpacity ?? 0.28,
          depthTest: !highlightConfig.xrayHighlight,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
          side: THREE.DoubleSide,
          clippingPlanes: sectionConfig.enabled ? [clipPlaneRef.current] : []
        });
        const selMesh = new THREE.Mesh(mesh.geometry, selOverlayMat);
        selMesh.matrixAutoUpdate = false;
        selMesh.matrix.copy(mesh.matrixWorld);
        // STEP-23 (F-033): the wash borrows the model's geometry - never dispose it.
        markSharedGeometry(selMesh);
        selMesh.userData = { ...selMesh.userData, sourceMesh: mesh };
        selGroup.add(selMesh);
      }
    });

    scene.add(selGroup);
    selectedHighlightGroupRef.current = selGroup;

    const isElementPinned = Boolean(selectedExpressID && pinnedExpressIds?.has(selectedExpressID));

    // Inactive Pivot Dot / Center Anchor Hub Management
    if (pivotDotGroupRef.current) {
      while (pivotDotGroupRef.current.children.length > 0) {
        const c = pivotDotGroupRef.current.children[0];
        pivotDotGroupRef.current.remove(c);
        if ('geometry' in c && (c as any).geometry) (c as any).geometry.dispose();
        if ('material' in c && (c as any).material) (c as any).material.dispose();
      }

      if (!isElementPinned && !isMeasureActive) {
        primaryMesh.updateMatrixWorld(true);
        pivotDotGroupRef.current.position.copy(primaryMesh.position);

        // Core Glowing Dot (subtle, sleek CAD anchor)
        const dotGeom = new THREE.SphereGeometry(0.12, 24, 24);
        const dotMat = new THREE.MeshStandardMaterial({
          color: 0x00e5ff,
          emissive: 0x00838f,
          emissiveIntensity: 0.9,
          roughness: 0.15,
          metalness: 0.85,
          depthTest: false,
          depthWrite: false
        });
        const dotSphere = new THREE.Mesh(dotGeom, dotMat);
        dotSphere.name = 'pivot-dot-sphere';
        dotSphere.userData = { isPivotDot: true, expressID: selectedExpressID };
        dotSphere.renderOrder = 10000;
        pivotDotGroupRef.current.add(dotSphere);

        // Outer Halo Accent Ring
        const haloGeom = new THREE.RingGeometry(0.18, 0.25, 32);
        const haloMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.75,
          side: THREE.DoubleSide,
          depthTest: false,
          depthWrite: false
        });
        const haloRing = new THREE.Mesh(haloGeom, haloMat);
        haloRing.name = 'pivot-dot-halo';
        haloRing.userData = { isPivotDot: true, expressID: selectedExpressID };
        haloRing.renderOrder = 10000;
        if (cameraRef.current) haloRing.quaternion.copy(cameraRef.current.quaternion);
        pivotDotGroupRef.current.add(haloRing);

        pivotDotGroupRef.current.visible = true;
      } else {
        pivotDotGroupRef.current.visible = false;
      }
    }

    if (transformMode === 'select' || isElementPinned) {
      tControls.detach();
    } else {
      tControls.attach(primaryMesh);
      tControls.size = 0.42; // Compact, sleek CAD proportions!
      tControls.setMode(transformMode);
      tControls.setTranslationSnap(snapEnabled ? 0.5 : null);
      tControls.setRotationSnap(snapEnabled ? Math.PI / 12 : null);
      tControls.setScaleSnap(snapEnabled ? 0.25 : null);

      if (onTransformChange) {
        const pos = primaryMesh.position.toArray() as [number, number, number];
        const rot = [primaryMesh.rotation.x, primaryMesh.rotation.y, primaryMesh.rotation.z] as [number, number, number];
        onTransformChange(selectedExpressID, pos, rot);
      }
    }
    needsRenderRef.current = true;

    return () => {
      if (selectedHighlightGroupRef.current && scene) {
        disposeHighlightGroup(selectedHighlightGroupRef.current, scene);
        selectedHighlightGroupRef.current = null;
      }
      if (pivotDotGroupRef.current) {
        pivotDotGroupRef.current.visible = false;
      }
    };
  }, [selectedExpressID, transformMode, snapEnabled, onTransformChange, isMeasureActive, sectionConfig.enabled, settings, hiddenCategories, isolatedExpressID, hiddenModelIds, getCachedEdgesGeometry]);

  // 7b. Handle Hover / Pre-Selection Highlight (Subtle, clearly distinct from active selection)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (hoverHighlightGroupRef.current) {
      disposeHighlightGroup(hoverHighlightGroupRef.current, scene);
      hoverHighlightGroupRef.current = null;
    }

    if (
      hoveredExpressId === null ||
      hoveredExpressId === selectedExpressID ||
      isMeasureActive ||
      cadToolMode !== 'select'
    ) {
      needsRenderRef.current = true;
      return;
    }

    const meshes = meshMapRef.current.get(hoveredExpressId);
    if (!meshes || meshes.length === 0) {
      needsRenderRef.current = true;
      return;
    }

    const highlightConfig = settings?.highlighting ?? DEFAULT_EDITOR_SETTINGS.highlighting;
    const hoverGroup = new THREE.Group();
    hoverGroup.name = 'hover-highlight-group';

    const edgeColor = new THREE.Color(highlightConfig.preselectionEdgeColor || DEFAULT_EDITOR_SETTINGS.highlighting.preselectionEdgeColor);
    const edgeOpacity = highlightConfig.preselectionEdgeOpacity ?? 0.65;
    const isContours = highlightConfig.highlightStyle === 'contours';

    meshes.forEach((mesh) => {
      if (!mesh.geometry) return;
      mesh.updateMatrixWorld(true);

      // Hover Contours or Bounding Box
      if (isContours) {
        try {
          // STEP-23: cached per element, owned by the edge cache.
          const edgesGeom = getCachedEdgesGeometry(mesh);
          if (!edgesGeom) throw new Error('missing geometry');
          const edgeMat = new THREE.LineBasicMaterial({
            color: edgeColor,
            transparent: true,
            opacity: edgeOpacity,
            depthTest: !highlightConfig.xrayHighlight,
            depthWrite: false
          });
          const lineSegs = new THREE.LineSegments(edgesGeom, edgeMat);
          lineSegs.matrixAutoUpdate = false;
          lineSegs.matrix.copy(mesh.matrixWorld);
          markSharedGeometry(lineSegs);
          hoverGroup.add(lineSegs);
        } catch {
          const hoverBbox = new THREE.BoxHelper(mesh, edgeColor.getHex());
          hoverGroup.add(hoverBbox);
        }
      } else {
        const hoverBbox = new THREE.BoxHelper(mesh, edgeColor.getHex());
        const boxMat = hoverBbox.material as THREE.LineBasicMaterial;
        boxMat.transparent = true;
        boxMat.opacity = edgeOpacity;
        boxMat.depthWrite = false;
        hoverGroup.add(hoverBbox);
      }

      // Subtle surface tint wash
      if ((highlightConfig.preselectionFillOpacity ?? 0.14) > 0) {
        const fillColor = new THREE.Color(highlightConfig.preselectionColor || DEFAULT_EDITOR_SETTINGS.highlighting.preselectionColor);
        const hoverOverlayMat = new THREE.MeshBasicMaterial({
          color: fillColor,
          transparent: true,
          opacity: highlightConfig.preselectionFillOpacity ?? 0.14,
          depthTest: !highlightConfig.xrayHighlight,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
          side: THREE.DoubleSide,
          clippingPlanes: sectionConfig.enabled ? [clipPlaneRef.current] : []
        });
        const hoverMesh = new THREE.Mesh(mesh.geometry, hoverOverlayMat);
        hoverMesh.matrixAutoUpdate = false;
        hoverMesh.matrix.copy(mesh.matrixWorld);
        // STEP-23 (F-033): borrowed model geometry - must survive teardown.
        markSharedGeometry(hoverMesh);
        hoverGroup.add(hoverMesh);
      }
    });

    scene.add(hoverGroup);
    hoverHighlightGroupRef.current = hoverGroup;

    needsRenderRef.current = true;

    return () => {
      if (hoverHighlightGroupRef.current && scene) {
        disposeHighlightGroup(hoverHighlightGroupRef.current, scene);
        hoverHighlightGroupRef.current = null;
      }
    };
  }, [hoveredExpressId, selectedExpressID, isMeasureActive, cadToolMode, sectionConfig.enabled, settings, getCachedEdgesGeometry]);

  // Focus camera on element (F key)
  const handleFocusElement = useCallback((expressId: number) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const meshes = meshMapRef.current.get(expressId);
    if (!meshes || meshes.length === 0) return;
    const box = new THREE.Box3();
    meshes.forEach((m) => {
      m.updateMatrixWorld(true);
      if (m.geometry) {
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        if (m.geometry.boundingBox) {
          box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld));
          return;
        }
      }
      box.union(new THREE.Box3().setFromObject(m));
    });
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 2.0);

    controlsRef.current.target.copy(center);
    cameraRef.current.position.set(
      center.x + maxDim * 1.5,
      center.y + maxDim * 1.2,
      center.z + maxDim * 1.5
    );
    cameraRef.current.lookAt(center);
    controlsRef.current.update();
    needsRenderRef.current = true;
  }, []);

  useEffect(() => {
    if (focusTrigger && focusTrigger.expressId) {
      handleFocusElement(focusTrigger.expressId);
    }
  }, [focusTrigger, handleFocusElement]);

  // Reset view
  const handleResetView = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    controlsRef.current.target.set(0, 0, 0);
    cameraRef.current.position.set(12, 10, 15);
    cameraRef.current.lookAt(0, 0, 0);
    controlsRef.current.update();
    needsRenderRef.current = true;
  }, []);

  // Commit drafting distance from type-ahead input
  const handleCommitDraftingDistance = useCallback((exactLength: number) => {
    if (!cadStartPoint || !onCadDrawWall) return;
    const rad = (draftingAngle * Math.PI) / 180;
    const endX = cadStartPoint.x + Math.cos(rad) * exactLength;
    const endZ = cadStartPoint.z + Math.sin(rad) * exactLength;
    onCadDrawWall([cadStartPoint.x, cadStartPoint.z], [endX, endZ]);
    setCadStartPoint(null);
  }, [cadStartPoint, draftingAngle, onCadDrawWall]);

  const lockHelpersRef = useRef<Map<number, THREE.BoxHelper>>(new Map());

  // Render Remote Locks with User Color
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    lockHelpersRef.current.forEach((helper) => scene.remove(helper));
    lockHelpersRef.current.clear();

    Object.entries(elementLocks).forEach(([expIdStr, lock]) => {
      const expId = Number(expIdStr);
      // Don't render lock outline for our own selection
      if (expId === selectedExpressID) return;

      const meshes = meshMapRef.current.get(expId);
      if (meshes && meshes.length > 0) {
        const color = new THREE.Color(lock.user_color);
        const helper = new THREE.BoxHelper(meshes[0], color);
        scene.add(helper);
        lockHelpersRef.current.set(expId, helper);
      }
    });
    needsRenderRef.current = true;

    return () => {
      lockHelpersRef.current.forEach((helper) => scene.remove(helper));
      lockHelpersRef.current.clear();
      needsRenderRef.current = true;
    };
  }, [elementLocks, selectedExpressID]);

  // Apply Remote Transform Stream
  useEffect(() => {
    if (!remoteTransform) return;
    const meshes = meshMapRef.current.get(remoteTransform.expressID);
    if (!meshes || meshes.length === 0) return;

    const mat = new THREE.Matrix4().fromArray(remoteTransform.matrix);
    meshes[0].matrix.copy(mat);
    meshes[0].matrix.decompose(meshes[0].position, meshes[0].quaternion, meshes[0].scale);
    meshes[0].updateMatrixWorld(true);

    const lockHelper = lockHelpersRef.current.get(remoteTransform.expressID);
    if (lockHelper) lockHelper.update();
    needsRenderRef.current = true;
  }, [remoteTransform]);

  // Configure OrbitControls navigation and reset snap when measure tool toggles
  useEffect(() => {
    const controls = controlsRef.current;
    if (controls) {
      // Revit / Blender navigation invariant: Left click is 100% free, MMB pans/drags, Shift+MMB rotates
      controls.mouseButtons = buildOrbitControlConfig().mouseButtons;
    }
    if (!isMeasureActive) {
      setPendingStartPoint(null);
      setActiveSnap(null);
      setPreviewMeasure(null);
      currentSnapPointRef.current = null;
      currentSnapTypeRef.current = null;
      if (snapIndicatorGroupRef.current) snapIndicatorGroupRef.current.visible = false;
      if (measurePreviewGroupRef.current) measurePreviewGroupRef.current.visible = false;
      needsRenderRef.current = true;
    }
  }, [isMeasureActive]);

  // Dynamically sync user settings (Theme, Grid, Navigation Sensitivities) to Three.js scene
  useEffect(() => {
    const scene = sceneRef.current;
    const controls = controlsRef.current;
    if (!scene || !controls) return;

    const isLight = theme === 'light';
    const themeKey = settings?.viewport?.theme ?? (isLight ? 'studio-gray' : 'dark-slate');
    const themeBg = THEME_COLOR_MAP[themeKey] ?? (isLight ? 0xdce5ef : 0x0b0d10);
    scene.background = new THREE.Color(
      themeKey === 'custom' && settings?.viewport?.customCanvasColor
        ? settings?.viewport?.customCanvasColor
        : (isLight ? 0xdce5ef : themeBg)
    );

    if (settings?.navigation) {
      // STEP-23 (F-038): same tuning object as the mount effect - one answer.
      const tuning = createNavigationTuning(settings.navigation.dampingFactor ?? 0.18, {
        adaptive: settings.navigation.adaptiveLargeModelDamping ?? true,
        threshold: 150
      });
      tuning.update(geometries.length);
      navigationTuningRef.current = tuning;
      controls.enableDamping = settings.navigation.enableDamping;
      controls.dampingFactor = tuning.current;
      controls.rotateSpeed = settings.navigation.orbitSensitivity;
      controls.panSpeed = settings.navigation.panSensitivity;
      controls.zoomSpeed = settings.navigation.zoomSensitivity;
    }

    if (groundGridRef.current) {
      groundGridRef.current.mesh.visible = settings?.viewport?.showGrid ?? true;
      const baseCol = settings?.viewport?.gridBaseColor ? new THREE.Color(settings.viewport.gridBaseColor).getHex() : undefined;
      groundGridRef.current.updateTheme(isLight, baseCol);
    }
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = settings?.viewport?.showGrid ?? true;
    }
    needsRenderRef.current = true;
  }, [settings, theme, geometries.length]);

  // Reset CAD preview when returning to select mode
  useEffect(() => {
    if (cadToolMode === 'select') {
      setCadStartPoint(null);
      if (cadPreviewGroupRef.current) {
        while (cadPreviewGroupRef.current.children.length > 0) {
          const c = cadPreviewGroupRef.current.children[0];
          cadPreviewGroupRef.current.remove(c);
          if ('geometry' in c && c.geometry instanceof THREE.BufferGeometry) c.geometry.dispose();
          if ('material' in c && c.material instanceof THREE.Material) c.material.dispose();
        }
      }
      needsRenderRef.current = true;
    }
  }, [cadToolMode]);

  // Synchronize activeInteractiveMode prop with local interactiveEditState & cleanup guides on cancel/switch
  useEffect(() => {
    setInteractiveEditState((prev) => {
      if (prev.mode === activeInteractiveMode) return prev;
      return {
        ...prev,
        mode: activeInteractiveMode,
        step: 1,
        originPoint: null,
        referenceRayPoint: null,
        currentPoint: null,
        isCopyMode: false,
      };
    });

    if (activeInteractiveMode === 'none') {
      setTrackerReadout(null);
      if (editGuidesGroupRef.current) {
        clearGroupChildren(editGuidesGroupRef.current);
      }
      needsRenderRef.current = true;
    } else {
      let prompt = 'Click base point';
      if (activeInteractiveMode === 'move') {
        prompt = 'Click base point for move (or origin)';
      } else if (activeInteractiveMode === 'rotate') {
        prompt = 'Click rotation center point';
      } else if (activeInteractiveMode === 'mirror') {
        prompt = 'Click first point of mirror axis';
      } else if (activeInteractiveMode === 'multiply') {
        prompt = 'Click base point for array';
      } else if (activeInteractiveMode === 'elevate') {
        prompt = 'Click base reference elevation';
      } else if (activeInteractiveMode === 'special_pick') {
        prompt = 'Click Point 1 for vector';
      }

      let initScreenX = typeof window !== 'undefined' ? window.innerWidth / 2 : 400;
      let initScreenY = typeof window !== 'undefined' ? window.innerHeight / 2 : 300;
      const container = containerRef.current;
      const camera = cameraRef.current;
      if (container && camera && selectedExpressID !== null) {
        const selectedMeshes = meshMapRef.current.get(selectedExpressID);
        if (selectedMeshes && selectedMeshes.length > 0) {
          const box = new THREE.Box3();
          for (const m of selectedMeshes) {
            box.expandByObject(m);
          }
          if (!box.isEmpty()) {
            const anchor = new THREE.Vector3();
            box.getCenter(anchor);
            anchor.y = box.max.y;
            const projected = anchor.clone().project(camera);
            const rect = container.getBoundingClientRect();
            initScreenX = rect.left + ((projected.x + 1) * rect.width) / 2;
            initScreenY = rect.top + ((-projected.y + 1) * rect.height) / 2;
          }
        }
      }

      setTrackerReadout({
        mode: activeInteractiveMode,
        step: 1,
        distance: 0,
        angle: 0,
        dx: 0,
        dy: 0,
        dz: 0,
        isCopyMode: false,
        isCopyActive: false,
        isOrthoLocked: false,
        isOrthoActive: false,
        activeField: activeInteractiveMode === 'rotate' ? 'angle' : activeInteractiveMode === 'elevate' ? 'dy' : 'distance',
        prompt,
        screenPos: { x: initScreenX, y: initScreenY }
      });
      needsRenderRef.current = true;
    }
  }, [activeInteractiveMode, selectedExpressID]);

  // Handle ESC (clear selection / cancel), TAB (cycle candidate elements), and CAD shortcut keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      // Handle Escape: cancel interactive CAD editing first, then regular deselection
      if (e.key === 'Escape' || e.code === 'Escape' || e.keyCode === 27) {
        if (interactiveEditState.mode !== 'none') {
          e.preventDefault();
          setInteractiveEditState((prev) => ({ ...prev, mode: 'none', step: 1 }));
          setTrackerReadout(null);
          if (editGuidesGroupRef.current) {
            clearGroupChildren(editGuidesGroupRef.current);
          }
          if (onActiveInteractiveModeChange) onActiveInteractiveModeChange('none');
          needsRenderRef.current = true;
          return;
        }

        if (selectedExpressID !== null) {
          onSelectElement(null);
        }
        if (cadToolMode !== 'select') {
          if (cadStartPoint) {
            setCadStartPoint(null);
          } else if (onCadCancel) {
            onCadCancel();
          }
          if (cadPreviewGroupRef.current) {
            while (cadPreviewGroupRef.current.children.length > 0) {
              const c = cadPreviewGroupRef.current.children[0];
              cadPreviewGroupRef.current.remove(c);
            }
          }
        }
        if (isMeasureActive) {
          if (pendingStartPoint) {
            setPendingStartPoint(null);
            setPreviewMeasure(null);
            if (measurePreviewGroupRef.current) {
              measurePreviewGroupRef.current.visible = false;
            }
          } else if (onCancelMeasure) {
            onCancelMeasure();
          }
        }
        return;
      }

      if (isInput) return;

      // Quick Rotate 90 CW / CCW (Ctrl+R / Shift+Ctrl+R)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R') && selectedExpressID !== null) {
        e.preventDefault();
        const cw = e.shiftKey;
        if (onRotateElement) onRotateElement(selectedExpressID, cw ? 90 : -90, 'z');
        return;
      }

      // Modifier key toggle during active interactive editing
      if (e.key === 'Control' && interactiveEditState.mode !== 'none') {
        setInteractiveEditState((prev) => ({ ...prev, isCopyMode: !prev.isCopyMode }));
        return;
      }

      // Tab Key: Cycle through candidate elements under cursor
      if (e.key === 'Tab') {
        if (hoverCandidatesRef.current.length > 1) {
          e.preventDefault();
          e.stopPropagation();
          const count = hoverCandidatesRef.current.length;
          const nextIdx = e.shiftKey
            ? (hoverCandidateIndexRef.current - 1 + count) % count
            : (hoverCandidateIndexRef.current + 1) % count;
          hoverCandidateIndexRef.current = nextIdx;
          const targetExpressId = hoverCandidatesRef.current[nextIdx];
          hoveredExpressIdRef.current = targetExpressId;
          setHoverCandidateIndex(nextIdx);
          setHoveredExpressId(targetExpressId);
          needsRenderRef.current = true;
          return;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedExpressID,
    onSelectElement,
    cadToolMode,
    cadStartPoint,
    onCadCancel,
    isMeasureActive,
    pendingStartPoint,
    onCancelMeasure,
    // STEP-23 (F-035): the handler reads these; without them the closure is stale and
    // Escape cannot cancel an in-progress move/rotate.
    interactiveEditState,
    onActiveInteractiveModeChange,
    onRotateElement
  ]);

  // Helper: Evaluates visible surface candidates at screen coordinates.
  // STEP-23: returns the candidate ids instead of setting state - the hover scheduler
  // owns the state update and the dedupe (F-034).
  const updateHoverAtScreenCoords = useCallback(
    (clientX: number, clientY: number): number[] => {
      if (isMeasureActive || cadToolMode !== 'select' || isDraggingGizmoRef.current) {
        return hoverCandidatesRef.current;
      }
      const container = containerRef.current;
      const camera = cameraRef.current;
      const group = meshesGroupRef.current;
      if (!container || !camera || !group) return hoverCandidatesRef.current;

      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      // Inactive Pivot Dot hover check
      if (pivotDotGroupRef.current && pivotDotGroupRef.current.visible && selectedExpressID !== null) {
        const dotHits = raycaster.intersectObjects(pivotDotGroupRef.current.children, true);
        if (dotHits.length > 0) {
          if (containerRef.current) containerRef.current.style.cursor = 'pointer';
          const halo = pivotDotGroupRef.current.getObjectByName('pivot-dot-halo') as THREE.Mesh;
          if (halo && halo.material instanceof THREE.MeshBasicMaterial) {
            halo.material.opacity = 1.0;
            halo.scale.set(1.35, 1.35, 1.35);
          }
          needsRenderRef.current = true;
          return hoverCandidatesRef.current;
        } else {
          const halo = pivotDotGroupRef.current.getObjectByName('pivot-dot-halo') as THREE.Mesh;
          if (halo && halo.material instanceof THREE.MeshBasicMaterial) {
            halo.material.opacity = 0.75;
            halo.scale.set(1.0, 1.0, 1.0);
          }
        }
      }

      const visibleCandidates = findVisibleCandidates(
        raycaster,
        group,
        clipPlaneRef.current,
        sectionConfig.enabled,
        hiddenCategories,
        isolatedExpressID,
        hiddenModelIds
      );

      const candidateIds = visibleCandidates.map((c) => c.expressID);
      needsRenderRef.current = true;
      return candidateIds;
    },
    [
      isMeasureActive,
      cadToolMode,
      sectionConfig.enabled,
      hiddenCategories,
      isolatedExpressID,
      hiddenModelIds
    ]
  );

  // STEP-23 (F-034): one raycast per animation frame, one notification per real
  // change. `compute`/`notify` read refs so the scheduler never closes over stale
  // props (hiddenCategories, isolation, ...).
  hoverComputeRef.current = (payload) => updateHoverAtScreenCoords(payload.clientX, payload.clientY);
  const hoverScheduler = React.useMemo(
    () =>
      createHoverScheduler({
        requestFrame: (cb) => window.requestAnimationFrame(cb),
        cancelFrame: (handle) => window.cancelAnimationFrame(handle),
        compute: (payload) => hoverComputeRef.current?.(payload) ?? hoverCandidatesRef.current,
        notify: (ids) => hoverNotifyRef.current?.(ids)
      }),
    []
  );
  hoverSchedulerRef.current = hoverScheduler;
  // Cancel and cleanup interactive CAD editing
  const handleCancelInteractiveEdit = useCallback(() => {
    setInteractiveEditState({
      mode: 'none',
      step: 1,
      originPoint: null,
      referenceRayPoint: null,
      currentPoint: null,
      isCopyMode: false,
      isMultiCopy: false,
      isOrthoLocked: false,
      multiplyCount: 3,
      multiplySpacing: 2.0,
      multiplyMethod: 'increment',
      rotateAxis: 'z',
      mirrorPlane: 'x',
    });
    setTrackerReadout(null);
    if (editGuidesGroupRef.current) {
      clearGroupChildren(editGuidesGroupRef.current);
    }
    if (onActiveInteractiveModeChange) onActiveInteractiveModeChange('none');
    needsRenderRef.current = true;
  }, [onActiveInteractiveModeChange]);

  // Immediately apply transformations in 3D viewport without resetting scene or camera
  const applyLocalElementTransform = useCallback(
    (
      expressId: number,
      type: 'move' | 'rotate' | 'mirror',
      options: {
        delta?: [number, number, number];
        angle_degrees?: number;
        axis?: 'x' | 'y' | 'z';
        center?: THREE.Vector3;
      }
    ) => {
      const meshes = meshMapRef.current.get(expressId);
      if (!meshes || meshes.length === 0) return;

      if (type === 'move') {
        const d = options.delta || [0, 0, 0];
        const offset = new THREE.Vector3(d[0], d[1], d[2]);
        meshes.forEach((mesh) => {
          mesh.position.add(offset);
          mesh.updateMatrixWorld(true);
          if (mesh.userData.batchedMesh && mesh.userData.batchId !== undefined) {
            const bm = mesh.userData.batchedMesh as THREE.BatchedMesh;
            bm.setMatrixAt(mesh.userData.batchId, mesh.matrixWorld);
            bm.computeBoundingBox();
            bm.computeBoundingSphere();
          }
        });
      } else if (type === 'rotate') {
        const deg = options.angle_degrees || 0;
        const rad = (deg * Math.PI) / 180;
        const origin = options.center;
        meshes.forEach((mesh) => {
          if (origin) {
            const t1 = new THREE.Matrix4().makeTranslation(-origin.x, -origin.y, -origin.z);
            const rotMat = new THREE.Matrix4().makeRotationY(-rad);
            const t2 = new THREE.Matrix4().makeTranslation(origin.x, origin.y, origin.z);
            const fullMat = new THREE.Matrix4().multiply(t2).multiply(rotMat).multiply(t1);
            mesh.applyMatrix4(fullMat);
          } else {
            mesh.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -rad);
          }
          mesh.updateMatrixWorld(true);
          if (mesh.userData.batchedMesh && mesh.userData.batchId !== undefined) {
            const bm = mesh.userData.batchedMesh as THREE.BatchedMesh;
            bm.setMatrixAt(mesh.userData.batchId, mesh.matrixWorld);
            bm.computeBoundingBox();
            bm.computeBoundingSphere();
          }
        });
      } else if (type === 'mirror') {
        const axis = options.axis || 'x';
        const origin = options.center || (meshes[0] ? meshes[0].position : new THREE.Vector3());
        const scaleMat = new THREE.Matrix4().makeScale(
          axis === 'x' ? 1 : -1,
          1,
          axis === 'x' ? -1 : 1
        );
        const t1 = new THREE.Matrix4().makeTranslation(-origin.x, -origin.y, -origin.z);
        const t2 = new THREE.Matrix4().makeTranslation(origin.x, origin.y, origin.z);
        const fullMat = new THREE.Matrix4().multiply(t2).multiply(scaleMat).multiply(t1);

        meshes.forEach((mesh) => {
          mesh.applyMatrix4(fullMat);
          mesh.updateMatrixWorld(true);
          if (mesh.userData.batchedMesh && mesh.userData.batchId !== undefined) {
            const bm = mesh.userData.batchedMesh as THREE.BatchedMesh;
            bm.setMatrixAt(mesh.userData.batchId, mesh.matrixWorld);
            bm.computeBoundingBox();
            bm.computeBoundingSphere();
          }
        });
      }

      // Update active highlight outlines and transform controls
      if (selectedHighlightGroupRef.current) {
        selectedHighlightGroupRef.current.children.forEach((child) => {
          const sourceMesh = (child.userData as any)?.sourceMesh;
          if (sourceMesh) {
            child.matrix.copy(sourceMesh.matrixWorld);
            (child as any).update?.();
          }
        });
      }
      if (transformControlsRef.current?.object) {
        transformControlsRef.current.getHelper()?.updateMatrixWorld();
      }
      if (onTransformChange && meshes[0]) {
        const pos = meshes[0].position.toArray() as [number, number, number];
        const rot = [meshes[0].rotation.x, meshes[0].rotation.y, meshes[0].rotation.z] as [number, number, number];
        onTransformChange(expressId, pos, rot);
      }
      if (rendererRef.current) {
        rendererRef.current.shadowMap.needsUpdate = true;
      }
      needsRenderRef.current = true;
    },
    [onTransformChange]
  );

  // Commit value entered in CadTrackerHud
  const handleCommitTrackerValue = useCallback(
    (field: 'distance' | 'angle' | 'dx' | 'dy' | 'dz', value: number) => {
      if (selectedExpressID === null || interactiveEditState.mode === 'none') return;

      if (interactiveEditState.mode === 'move') {
        let delta: [number, number, number] = [0, 0, 0];
        if (trackerReadout && interactiveEditState.originPoint) {
          delta = [trackerReadout.dx, trackerReadout.dy, trackerReadout.dz];
        }
        if (field === 'distance') {
          const curLen = Math.hypot(delta[0], delta[1], delta[2]);
          if (curLen > 0.001) {
            const factor = value / curLen;
            delta = [delta[0] * factor, delta[1] * factor, delta[2] * factor];
          } else {
            delta = [value, 0, 0];
          }
        } else if (field === 'dx') {
          delta[0] = value;
        } else if (field === 'dy') {
          delta[1] = value;
        } else if (field === 'dz') {
          delta[2] = value;
        }
        applyLocalElementTransform(selectedExpressID, 'move', { delta });
        if (onMoveElement) onMoveElement(selectedExpressID, delta);
        handleCancelInteractiveEdit();
      } else if (interactiveEditState.mode === 'rotate') {
        applyLocalElementTransform(selectedExpressID, 'rotate', {
          angle_degrees: value,
          axis: 'z',
          center: interactiveEditState.originPoint || undefined
        });
        if (onRotateElement) onRotateElement(selectedExpressID, value, 'z');
        handleCancelInteractiveEdit();
      } else if (interactiveEditState.mode === 'elevate') {
        applyLocalElementTransform(selectedExpressID, 'move', { delta: [0, value, 0] });
        if (onMoveElement) onMoveElement(selectedExpressID, [0, value, 0]);
        handleCancelInteractiveEdit();
      } else if (interactiveEditState.mode === 'multiply') {
        let delta: [number, number, number] = [value, 0, 0];
        if (trackerReadout && interactiveEditState.originPoint) {
          const d = [trackerReadout.dx, trackerReadout.dy, trackerReadout.dz] as [number, number, number];
          const curLen = Math.hypot(d[0], d[1], d[2]);
          if (curLen > 0.001) {
            const factor = value / curLen;
            delta = [d[0] * factor, d[1] * factor, d[2] * factor];
          }
        }
        if (onArrayElement) onArrayElement(selectedExpressID, interactiveEditState.multiplyCount, delta);
        handleCancelInteractiveEdit();
      }
    },
    [selectedExpressID, interactiveEditState, trackerReadout, applyLocalElementTransform, onMoveElement, onRotateElement, onArrayElement, handleCancelInteractiveEdit]
  );

  // Pointer Move Handler for Snapping Preview & Rubber-Band Measure Line
  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isDraggingGizmoRef.current) return;

      lastPointerPosRef.current = { clientX: event.clientX, clientY: event.clientY };

      // If no mouse buttons are held, clear any drag tracking
      if (event.buttons === 0) {
        isPointerDraggingRef.current = false;
        pointerDownPosRef.current = null;
      }

      // Track pointer drag distance for rotation / pan detection when any button is held
      if (event.buttons !== 0 && pointerDownPosRef.current) {
        const dragDist = Math.hypot(
          event.clientX - pointerDownPosRef.current.x,
          event.clientY - pointerDownPosRef.current.y
        );
        if (dragDist > 4) {
          isPointerDraggingRef.current = true;
          // While dragging or rotating the camera, clear hover highlight
          hoverScheduler.cancel();
          if (hoveredExpressIdRef.current !== null) {
            hoveredExpressIdRef.current = null;
            setHoveredExpressId(null);
            setHoverCandidates([]);
            hoverCandidatesRef.current = [];
            hoverCandidateIndexRef.current = 0;
            setHoverCandidateIndex(0);
          }
          return;
        }
      }

      // If a button is held down or the camera is actively orbiting via OrbitControls drag, suppress hover
      if (event.buttons !== 0 || isOrbitingRef.current || isPointerDraggingRef.current) {
        return;
      }

      // Interactive CAD Editing Mode (Archicad 29 Pet Palette & Tekla 2025 Precision Move/Rotate)
      if (interactiveEditState.mode !== 'none') {
        const container = containerRef.current;
        const camera = cameraRef.current;
        const group = meshesGroupRef.current;
        const editGroup = editGuidesGroupRef.current;
        if (!container || !camera || !editGroup) return;

        const rect = container.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);

        let planeElev = 0;
        if (selectedExpressID !== null) {
          const sMeshes = meshMapRef.current.get(selectedExpressID);
          if (sMeshes && sMeshes[0]) {
            planeElev = sMeshes[0].position.y;
          }
        }
        const workPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeElev);
        const planeHit = new THREE.Vector3();
        raycaster.ray.intersectPlane(workPlane, planeHit);

        let hitPoint = planeHit.clone();
        if (snapEnabled && group) {
          const visibleMeshes = group.children.filter((c) => c.visible);
          const snap = findSnapPoint(raycaster, visibleMeshes, camera, { x: event.clientX, y: event.clientY }, rect);
          if (snap) {
            hitPoint = snap.point.clone();
            currentSnapPointRef.current = snap.point;
          } else {
            currentSnapPointRef.current = null;
          }
        }

        const isShift = event.shiftKey;
        if (isShift && interactiveEditState.originPoint) {
          const ox = interactiveEditState.originPoint.x;
          const oz = interactiveEditState.originPoint.z;
          const dx = hitPoint.x - ox;
          const dz = hitPoint.z - oz;
          if (Math.abs(dx) > Math.abs(dz)) {
            hitPoint.z = oz;
          } else {
            hitPoint.x = ox;
          }
        }

        let dist = 0;
        let angle = 0;
        let dx = 0;
        let dy = 0;
        let dz = 0;
        if (interactiveEditState.originPoint) {
          const o = interactiveEditState.originPoint;
          dx = hitPoint.x - o.x;
          dy = hitPoint.y - o.y;
          dz = hitPoint.z - o.z;
          dist = o.distanceTo(hitPoint);
          if (interactiveEditState.mode === 'rotate' && interactiveEditState.referenceRayPoint) {
            const v1 = new THREE.Vector2(interactiveEditState.referenceRayPoint.x - o.x, interactiveEditState.referenceRayPoint.z - o.z).normalize();
            const v2 = new THREE.Vector2(hitPoint.x - o.x, hitPoint.z - o.z).normalize();
            const rad = Math.atan2(v2.y, v2.x) - Math.atan2(v1.y, v1.x);
            angle = (rad * 180) / Math.PI;
          } else {
            angle = (Math.atan2(dz, dx) * 180) / Math.PI;
            if (angle < 0) angle += 360;
          }
        }

        // Anchor tracker HUD near selected element (stable in-canvas position, does not chase mouse pointer)
        const selectedMeshes = selectedExpressID !== null ? meshMapRef.current.get(selectedExpressID) || [] : [];
        const anchorWorld = new THREE.Vector3();
        if (selectedMeshes.length > 0) {
          const b = new THREE.Box3();
          selectedMeshes.forEach((m) => b.expandByObject(m));
          b.getCenter(anchorWorld);
          anchorWorld.y = b.max.y; // anchor near top of element
        } else if (interactiveEditState.originPoint) {
          anchorWorld.copy(interactiveEditState.originPoint);
        } else {
          anchorWorld.copy(hitPoint);
        }

        const screenVec = anchorWorld.clone().project(camera);
        let hudScreenX = ((screenVec.x + 1) / 2) * rect.width + rect.left;
        let hudScreenY = ((-screenVec.y + 1) / 2) * rect.height + rect.top;

        // If behind camera frustum, fallback to safe screen center
        if (screenVec.z > 1.0) {
          hudScreenX = rect.left + rect.width / 2;
          hudScreenY = rect.top + rect.height / 2;
        }

        let prompt = '';
        if (interactiveEditState.mode === 'move') {
          prompt = interactiveEditState.step === 1 ? 'Click start point for move vector' : 'Click destination point (or type distance)';
        } else if (interactiveEditState.mode === 'rotate') {
          prompt = interactiveEditState.step === 1 ? 'Click rotation center point' : interactiveEditState.step === 2 ? 'Click reference direction ray (0° baseline)' : 'Click new direction ray (or type angle)';
        } else if (interactiveEditState.mode === 'mirror') {
          prompt = interactiveEditState.step === 1 ? 'Click first point of mirror axis' : 'Click second point of mirror axis';
        } else if (interactiveEditState.mode === 'multiply') {
          prompt = interactiveEditState.step === 1 ? 'Click base point for array' : 'Click displacement / spacing vector';
        } else if (interactiveEditState.mode === 'elevate') {
          prompt = interactiveEditState.step === 1 ? 'Click base reference elevation' : 'Move cursor vertically to set new elevation';
        } else if (interactiveEditState.mode === 'special_pick') {
          prompt = interactiveEditState.step === 1 ? 'Click Point 1 for vector' : 'Click Point 2 to measure offset';
        }

        setTrackerReadout({
          mode: interactiveEditState.mode,
          step: interactiveEditState.step,
          distance: dist,
          angle: angle,
          dx: dx,
          dy: dy,
          dz: dz,
          isCopyMode: interactiveEditState.isCopyMode,
          isOrthoLocked: isShift,
          activeField: interactiveEditState.mode === 'rotate' ? 'angle' : interactiveEditState.mode === 'elevate' ? 'dy' : 'distance',
          prompt,
          screenPos: { x: hudScreenX, y: hudScreenY }
        });
        updateInteractiveGuides(editGroup, interactiveEditState, hitPoint, selectedMeshes);
        needsRenderRef.current = true;
        return;
      }

      if (!isMeasureActive && cadToolMode === 'select') {
        // STEP-23 (F-034): coalesce to one raycast per animation frame.
        hoverScheduler.schedule({ clientX: event.clientX, clientY: event.clientY });
        return;
      }

      const container = containerRef.current;
      const camera = cameraRef.current;
      const group = meshesGroupRef.current;
      const snapGroup = snapIndicatorGroupRef.current;
      const previewGroup = measurePreviewGroupRef.current;
      const cadGroup = cadPreviewGroupRef.current;
      if (!container || !camera || !group) return;

      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      // Snapping evaluation for both measuring and CAD drafting
      const visibleMeshes = group.children.filter((c) => c.visible);
      const snapResult = snapGroup ? findSnapPoint(
        raycaster,
        visibleMeshes,
        camera,
        { x: event.clientX, y: event.clientY },
        rect
      ) : null;

      if (snapResult) {
        currentSnapPointRef.current = snapResult.point;
        currentSnapTypeRef.current = snapResult.type;
        if (snapGroup) {
          snapGroup.position.copy(snapResult.point);
          snapGroup.quaternion.copy(camera.quaternion);
          const camDist = camera.position.distanceTo(snapResult.point);
          const scale = Math.max(0.015, camDist * 0.08);
          snapGroup.scale.set(scale, scale, scale);
          const ringMesh = snapGroup.children[0] as THREE.Mesh;
          if (ringMesh && ringMesh.material instanceof THREE.MeshBasicMaterial) {
            ringMesh.material.color.setHex(
              snapResult.type === 'vertex'
                ? 0x22d3ee
                : snapResult.type === 'midpoint'
                ? 0xfbbf24
                : 0x34d399
            );
          }
          snapGroup.visible = true;
        }
      } else {
        currentSnapPointRef.current = null;
        if (snapGroup) snapGroup.visible = false;
      }

      // CAD Preview handling
      if (cadToolMode !== 'select' && cadGroup) {
        while (cadGroup.children.length > 0) {
          const c = cadGroup.children[0];
          cadGroup.remove(c);
          if ('geometry' in c && c.geometry instanceof THREE.BufferGeometry) c.geometry.dispose();
          if ('material' in c && c.material instanceof THREE.Material) c.material.dispose();
        }

        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const groundHit = new THREE.Vector3();
        const hitGround = raycaster.ray.intersectPlane(groundPlane, groundHit);

        // Snap to active snap point if present and snap is enabled
        if (snapEnabled && currentSnapPointRef.current) {
          groundHit.copy(currentSnapPointRef.current);
        }

        // Orthogonal Lock (holding Shift)
        const orthoActive = event.shiftKey;
        setIsOrthoLocked(orthoActive);
        if (orthoActive && cadStartPoint) {
          const dx = groundHit.x - cadStartPoint.x;
          const dz = groundHit.z - cadStartPoint.z;
          if (Math.abs(dx) > Math.abs(dz)) {
            groundHit.z = cadStartPoint.z;
          } else {
            groundHit.x = cadStartPoint.x;
          }
        }

        // Track live distance and angle
        if (cadStartPoint) {
          const dist = Math.hypot(groundHit.x - cadStartPoint.x, groundHit.z - cadStartPoint.z);
          const rad = Math.atan2(groundHit.z - cadStartPoint.z, groundHit.x - cadStartPoint.x);
          let deg = (rad * 180) / Math.PI;
          if (deg < 0) deg += 360;
          setDraftingLength(dist);
          setDraftingAngle(deg);
        }

        if (cadToolMode === 'wall') {
          if (cadStartPoint && hitGround) {
            const geom = new THREE.BufferGeometry().setFromPoints([cadStartPoint, groundHit]);
            const mat = new THREE.LineBasicMaterial({ color: 0x06b6d4, linewidth: 3 });
            cadGroup.add(new THREE.Line(geom, mat));
            const sMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
            const s1 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), sMat);
            s1.position.copy(cadStartPoint);
            const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), sMat);
            s2.position.copy(groundHit);
            cadGroup.add(s1);
            cadGroup.add(s2);
          } else if (hitGround) {
            const sMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, wireframe: true });
            const s = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), sMat);
            s.position.copy(groundHit);
            cadGroup.add(s);
          }
        } else if (cadToolMode === 'column' && hitGround) {
          const colGeom = new THREE.BoxGeometry(0.35, 3.0, 0.35);
          const colMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.5 });
          const colMesh = new THREE.Mesh(colGeom, colMat);
          colMesh.position.set(groundHit.x, 1.5, groundHit.z);
          cadGroup.add(colMesh);
        } else if (cadToolMode === 'slab') {
          if (cadStartPoint && hitGround) {
            const dx = Math.max(0.2, Math.abs(groundHit.x - cadStartPoint.x));
            const dz = Math.max(0.2, Math.abs(groundHit.z - cadStartPoint.z));
            const midX = (cadStartPoint.x + groundHit.x) / 2;
            const midZ = (cadStartPoint.z + groundHit.z) / 2;
            const slabGeom = new THREE.BoxGeometry(dx, 0.3, dz);
            const slabMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.4 });
            const slabMesh = new THREE.Mesh(slabGeom, slabMat);
            slabMesh.position.set(midX, -0.15, midZ);
            cadGroup.add(slabMesh);
          } else if (hitGround) {
            const sMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, wireframe: true });
            const s = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), sMat);
            s.position.copy(groundHit);
            cadGroup.add(s);
          }
        }
      }

      if (isMeasureActive) {
        if (snapResult) {
          // Calculate 2D screen coordinates for hover micro-badge
          const vec = snapResult.point.clone().project(camera);
          const screenX = (vec.x * 0.5 + 0.5) * rect.width;
          const screenY = (-(vec.y * 0.5) + 0.5) * rect.height;

          setActiveSnap({
            point: snapResult.point,
            type: snapResult.type,
            screenPos: { x: screenX, y: screenY }
          });

          // Update dynamic rubber-band measure preview line if pending start point exists
          if (pendingStartPoint && previewGroup) {
            const previewLine = previewGroup.children[0] as THREE.Line;
            const startMarker = previewGroup.children[1] as THREE.Mesh;
            const endMarker = previewGroup.children[2] as THREE.Mesh;

            if (previewLine && previewLine.geometry) {
              previewLine.geometry.setFromPoints([pendingStartPoint, snapResult.point]);
              previewLine.computeLineDistances();
            }
            if (startMarker) startMarker.position.copy(pendingStartPoint);
            if (endMarker) endMarker.position.copy(snapResult.point);
            previewGroup.visible = true;

            const dist = pendingStartPoint.distanceTo(snapResult.point);
            const dx = Math.abs(snapResult.point.x - pendingStartPoint.x);
            const dy = Math.abs(snapResult.point.y - pendingStartPoint.y);
            const dz = Math.abs(snapResult.point.z - pendingStartPoint.z);
            const mid = pendingStartPoint.clone().add(snapResult.point).multiplyScalar(0.5);

            const midVec = mid.project(camera);
            const midScreenX = (midVec.x * 0.5 + 0.5) * rect.width;
            const midScreenY = (-(midVec.y * 0.5) + 0.5) * rect.height;

            setPreviewMeasure({
              distance: dist,
              dx,
              dy,
              dz,
              midpointScreen: { x: midScreenX, y: midScreenY }
            });
          }
        } else {
          setActiveSnap(null);
          if (previewGroup) previewGroup.visible = false;
          setPreviewMeasure(null);
        }
      }
      needsRenderRef.current = true;
    },
    [
      isMeasureActive,
      pendingStartPoint,
      cadToolMode,
      cadStartPoint,
      snapEnabled,
      sectionConfig.enabled,
      hiddenCategories,
      isolatedExpressID,
      hiddenModelIds,
      interactiveEditState,
      selectedExpressID,
      hoverScheduler
    ]
  );

  const handlePointerLeave = useCallback(() => {
    lastPointerPosRef.current = null;
    isPointerDraggingRef.current = false;
    pointerDownPosRef.current = null;
    hoverScheduler.cancel();
    setIsHoveringInteractiveMesh(false);
    setHoveredExpressId(null);
    setHoverCandidates([]);
    hoverCandidatesRef.current = [];
    hoverCandidateIndexRef.current = 0;
    setHoverCandidateIndex(0);
    if (snapIndicatorGroupRef.current) snapIndicatorGroupRef.current.visible = false;
    if (measurePreviewGroupRef.current) measurePreviewGroupRef.current.visible = false;
    setActiveSnap(null);
    setPreviewMeasure(null);
    needsRenderRef.current = true;
  }, [hoverScheduler]);

  const pointerDownPosRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      pointerDownPosRef.current = { x: event.clientX, y: event.clientY, time: Date.now() };
      isPointerDraggingRef.current = false;

      if (isMeasureActive && event.button === 0) {
        // Isolate measurement click from pointer capture
        event.stopPropagation();
      }
    },
    [isMeasureActive]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      isPointerDraggingRef.current = false;
      let dx = 0;
      let dy = 0;
      let dt = 0;
      if (pointerDownPosRef.current) {
        dx = Math.abs(event.clientX - pointerDownPosRef.current.x);
        dy = Math.abs(event.clientY - pointerDownPosRef.current.y);
        dt = Date.now() - pointerDownPosRef.current.time;
        if (dx > 6 || dy > 6) {
          lastNavigationEndTimeRef.current = Date.now();
        }
        pointerDownPosRef.current = null;
      }

      // When releasing any camera navigation button (such as MMB rotate or pan), re-evaluate hover immediately
      if (event.button !== 0 && lastPointerPosRef.current && updateHoverAtScreenCoordsRef.current) {
        updateHoverAtScreenCoordsRef.current(
          lastPointerPosRef.current.clientX,
          lastPointerPosRef.current.clientY
        );
      }

      if (event.button === 0) {

        if (isMeasureActive && dx < 10 && dy < 10 && dt < 1200) {
          event.stopPropagation();

          let hitPoint: THREE.Vector3 | null = currentSnapPointRef.current;
          if (!hitPoint) {
            const container = containerRef.current;
            const camera = cameraRef.current;
            const group = meshesGroupRef.current;
            if (container && camera && group) {
              const rect = container.getBoundingClientRect();
              const mouse = new THREE.Vector2(
                ((event.clientX - rect.left) / rect.width) * 2 - 1,
                -((event.clientY - rect.top) / rect.height) * 2 + 1
              );
              const raycaster = new THREE.Raycaster();
              (raycaster as any).firstHitOnly = true;
              raycaster.setFromCamera(mouse, camera);
              const visibleMeshes = group.children.filter((c) => c.visible);
              const snap = findSnapPoint(
                raycaster,
                visibleMeshes,
                camera,
                { x: event.clientX, y: event.clientY },
                rect
              );
              if (snap) {
                hitPoint = snap.point;
              } else {
                const intersects = raycaster.intersectObjects(visibleMeshes, false);
                if (intersects.length > 0) hitPoint = intersects[0].point;
              }
            }
          }

          if (hitPoint) {
            if (!pendingStartPoint) {
              setPendingStartPoint(hitPoint.clone());
            } else {
              const dist = pendingStartPoint.distanceTo(hitPoint);
              const mid = pendingStartPoint.clone().add(hitPoint).multiplyScalar(0.5);
              onAddMeasurement({
                id: `m-${Date.now()}`,
                start: [pendingStartPoint.x, pendingStartPoint.y, pendingStartPoint.z],
                end: [hitPoint.x, hitPoint.y, hitPoint.z],
                distance: dist,
                midpoint: [mid.x, mid.y, mid.z]
              });
              setPendingStartPoint(null);
              setPreviewMeasure(null);
              if (measurePreviewGroupRef.current) {
                measurePreviewGroupRef.current.visible = false;
              }
            }
            needsRenderRef.current = true;
          }
          return;
        }

        // Check if user clicked the Inactive Pivot Dot / Origin Anchor Hub
        if (
          pivotDotGroupRef.current &&
          pivotDotGroupRef.current.visible &&
          selectedExpressID !== null &&
          dx <= 8 &&
          dy <= 8 &&
          dt < 800
        ) {
          const container = containerRef.current;
          const camera = cameraRef.current;
          if (container && camera) {
            const rect = container.getBoundingClientRect();
            const mouse = new THREE.Vector2(
              ((event.clientX - rect.left) / rect.width) * 2 - 1,
              -((event.clientY - rect.top) / rect.height) * 2 + 1
            );
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
            const dotHits = raycaster.intersectObjects(pivotDotGroupRef.current.children, true);
            if (dotHits.length > 0) {
              event.stopPropagation();
              if (transformMode === 'select') {
                onSetTransformMode?.('translate');
              } else {
                onSetTransformMode?.('select');
              }
              needsRenderRef.current = true;
              return;
            }
          }
        }

        // Direct and reliable selection on left pointerup: prevents lost selections if browser click is delayed or throttled
        if (
          !isMeasureActive &&
          interactiveEditState.mode === 'none' &&
          cadToolMode === 'select' &&
          !isDraggingGizmoRef.current &&
          !isOrbitingRef.current &&
          !isPointerDraggingRef.current &&
          dx <= 6 &&
          dy <= 6 &&
          dt < 800
        ) {
          lastPointerUpSelectTimeRef.current = Date.now();
          const container = containerRef.current;
          const camera = cameraRef.current;
          const group = meshesGroupRef.current;
          if (container && camera && group) {
            const rect = container.getBoundingClientRect();
            const mouse = new THREE.Vector2(
              ((event.clientX - rect.left) / rect.width) * 2 - 1,
              -((event.clientY - rect.top) / rect.height) * 2 + 1
            );
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);

            const candidates = findVisibleCandidates(
              raycaster,
              group,
              clipPlaneRef.current,
              sectionConfig.enabled,
              hiddenCategories,
              isolatedExpressID,
              hiddenModelIds
            );

            if (candidates.length > 0) {
              const pre = hoveredExpressIdRef.current;
              const hasPre = pre !== null && candidates.some((c) => c.expressID === pre);
              const targetId = hasPre ? (pre as number) : candidates[0].expressID;
              onSelectElement(targetId);
              const meshes = meshMapRef.current.get(targetId);
              if (meshes && meshes[0] && onTransformChange) {
                const pos = meshes[0].position.toArray() as [number, number, number];
                const rot = [meshes[0].rotation.x, meshes[0].rotation.y, meshes[0].rotation.z] as [number, number, number];
                onTransformChange(targetId, pos, rot);
              }
            } else {
              onSelectElement(null);
            }
          }
        }
      }
    },
    [
      isMeasureActive,
      cadToolMode,
      pendingStartPoint,
      onAddMeasurement,
      onSelectElement,
      onTransformChange,
      sectionConfig.enabled,
      hiddenCategories,
      isolatedExpressID,
      hiddenModelIds,
      interactiveEditState
    ]
  );

  // Click Handler for Raycasting (Selection OR Measurement)
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (isDraggingGizmoRef.current) return;
      if (isMeasureActive) return; // Handled reliably via onPointerUp to prevent OrbitControls conflicts

      // Interactive CAD Editing Mode Click Handler (Archicad 29 & Tekla 2025)
      if (interactiveEditState.mode !== 'none') {
        const container = containerRef.current;
        const camera = cameraRef.current;
        const group = meshesGroupRef.current;
        if (!container || !camera) return;

        const rect = container.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);

        let planeElev = 0;
        if (selectedExpressID !== null) {
          const sMeshes = meshMapRef.current.get(selectedExpressID);
          if (sMeshes && sMeshes[0]) {
            planeElev = sMeshes[0].position.y;
          }
        }
        const workPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeElev);
        const planeHit = new THREE.Vector3();
        raycaster.ray.intersectPlane(workPlane, planeHit);

        let hitPoint = planeHit.clone();
        if (snapEnabled && group) {
          const visibleMeshes = group.children.filter((c) => c.visible);
          const snap = findSnapPoint(raycaster, visibleMeshes, camera, { x: event.clientX, y: event.clientY }, rect);
          if (snap) {
            hitPoint = snap.point.clone();
          }
        }

        if (event.shiftKey && interactiveEditState.originPoint) {
          const ox = interactiveEditState.originPoint.x;
          const oz = interactiveEditState.originPoint.z;
          const dx = hitPoint.x - ox;
          const dz = hitPoint.z - oz;
          if (Math.abs(dx) > Math.abs(dz)) {
            hitPoint.z = oz;
          } else {
            hitPoint.x = ox;
          }
        }

        if (interactiveEditState.step === 1) {
          setInteractiveEditState((prev) => ({
            ...prev,
            step: 2,
            originPoint: hitPoint.clone()
          }));
          needsRenderRef.current = true;
          return;
        }

        if (interactiveEditState.step === 2) {
          const origin = interactiveEditState.originPoint;
          if (!origin) return;

          if (interactiveEditState.mode === 'move') {
            const delta: [number, number, number] = [
              hitPoint.x - origin.x,
              hitPoint.y - origin.y,
              hitPoint.z - origin.z
            ];
            if (selectedExpressID !== null) {
              applyLocalElementTransform(selectedExpressID, 'move', { delta });
              if (onMoveElement) {
                onMoveElement(selectedExpressID, delta);
              }
            }
            handleCancelInteractiveEdit();
            return;
          }

          if (interactiveEditState.mode === 'rotate') {
            setInteractiveEditState((prev) => ({
              ...prev,
              step: 3,
              referenceRayPoint: hitPoint.clone()
            }));
            needsRenderRef.current = true;
            return;
          }

          if (interactiveEditState.mode === 'mirror') {
            const dx = hitPoint.x - origin.x;
            const dz = hitPoint.z - origin.z;
            const axis = Math.abs(dx) >= Math.abs(dz) ? 'x' : 'z';
            if (selectedExpressID !== null) {
              if (!interactiveEditState.isCopyMode) {
                applyLocalElementTransform(selectedExpressID, 'mirror', { axis, center: origin });
              }
              if (onMirrorElement) {
                onMirrorElement(selectedExpressID, axis, interactiveEditState.isCopyMode);
              }
            }
            handleCancelInteractiveEdit();
            return;
          }

          if (interactiveEditState.mode === 'multiply') {
            const delta: [number, number, number] = [
              hitPoint.x - origin.x,
              hitPoint.y - origin.y,
              hitPoint.z - origin.z
            ];
            if (selectedExpressID !== null && onArrayElement) {
              onArrayElement(selectedExpressID, interactiveEditState.multiplyCount, delta);
            }
            handleCancelInteractiveEdit();
            return;
          }

          if (interactiveEditState.mode === 'elevate') {
            const dy = hitPoint.y - origin.y;
            if (selectedExpressID !== null) {
              applyLocalElementTransform(selectedExpressID, 'move', { delta: [0, dy, 0] });
              if (onMoveElement) {
                onMoveElement(selectedExpressID, [0, dy, 0]);
              }
            }
            handleCancelInteractiveEdit();
            return;
          }

          if (interactiveEditState.mode === 'special_pick') {
            if (onSpecialPointsPicked) {
              onSpecialPointsPicked(
                [origin.x, origin.y, origin.z],
                [hitPoint.x, hitPoint.y, hitPoint.z]
              );
            }
            handleCancelInteractiveEdit();
            return;
          }
        }

        if (interactiveEditState.step === 3 && interactiveEditState.mode === 'rotate') {
          const origin = interactiveEditState.originPoint;
          const refRay = interactiveEditState.referenceRayPoint;
          if (origin && refRay && selectedExpressID !== null) {
            const v1 = new THREE.Vector2(refRay.x - origin.x, refRay.z - origin.z).normalize();
            const v2 = new THREE.Vector2(hitPoint.x - origin.x, hitPoint.z - origin.z).normalize();
            const rad = Math.atan2(v2.y, v2.x) - Math.atan2(v1.y, v1.x);
            let deg = (rad * 180) / Math.PI;
            applyLocalElementTransform(selectedExpressID, 'rotate', { angle_degrees: deg, axis: 'z', center: origin });
            if (onRotateElement) {
              onRotateElement(selectedExpressID, deg, 'z');
            }
          }
          handleCancelInteractiveEdit();
          return;
        }
        return;
      }

      const now = Date.now();
      // If handlePointerUp already handled selection on pointerup, skip redundant execution
      if (now - lastPointerUpSelectTimeRef.current < 250) {
        return;
      }

      // 1. FORBID SELECTION WHEN ROTATING OR PANNING CAMERA VIA MIDDLE MOUSE
      const timeSinceNav = now - lastNavigationEndTimeRef.current;
      if (
        isOrbitingRef.current ||
        isPointerDraggingRef.current ||
        (isNavigatingRef.current && timeSinceNav < 80)
      ) {
        isPointerDraggingRef.current = false;
        return;
      }
      isPointerDraggingRef.current = false;

      const container = containerRef.current;
      const camera = cameraRef.current;
      const group = meshesGroupRef.current;
      if (!container || !camera || !group) return;

      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      const visibleMeshes = group.children.filter((c) => c.visible);
      const intersects = raycaster.intersectObjects(visibleMeshes, false);

      if (isMeasureActive) {
        // Use active snap point if present, else fallback to raycast intersection
        let hitPoint: THREE.Vector3 | null = currentSnapPointRef.current;
        if (!hitPoint && intersects.length > 0) {
          hitPoint = intersects[0].point;
        }

        if (hitPoint) {
          if (!pendingStartPoint) {
            setPendingStartPoint(hitPoint.clone());
          } else {
            const dist = pendingStartPoint.distanceTo(hitPoint);
            const mid = pendingStartPoint.clone().add(hitPoint).multiplyScalar(0.5);
            onAddMeasurement({
              id: `m-${Date.now()}`,
              start: [pendingStartPoint.x, pendingStartPoint.y, pendingStartPoint.z],
              end: [hitPoint.x, hitPoint.y, hitPoint.z],
              distance: dist,
              midpoint: [mid.x, mid.y, mid.z]
            });
            setPendingStartPoint(null);
            setPreviewMeasure(null);
            if (measurePreviewGroupRef.current) {
              measurePreviewGroupRef.current.visible = false;
            }
          }
        }
        return;
      }

      // CAD Modeling Tool Actions
      if (cadToolMode !== 'select') {
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const groundHit = new THREE.Vector3();
        const hitGround = raycaster.ray.intersectPlane(groundPlane, groundHit);

        const targetHit = (snapEnabled && currentSnapPointRef.current)
          ? currentSnapPointRef.current.clone()
          : groundHit.clone();

        if (event.shiftKey && cadStartPoint) {
          const dx = targetHit.x - cadStartPoint.x;
          const dz = targetHit.z - cadStartPoint.z;
          if (Math.abs(dx) > Math.abs(dz)) {
            targetHit.z = cadStartPoint.z;
          } else {
            targetHit.x = cadStartPoint.x;
          }
        }

        if (cadToolMode === 'wall') {
          if (!cadStartPoint && hitGround) {
            setCadStartPoint(targetHit.clone());
          } else if (cadStartPoint && hitGround && onCadDrawWall) {
            onCadDrawWall([cadStartPoint.x, cadStartPoint.z], [targetHit.x, targetHit.z]);
            setCadStartPoint(null);
          }
          return;
        }

        if (cadToolMode === 'slab') {
          if (!cadStartPoint && hitGround) {
            setCadStartPoint(targetHit.clone());
          } else if (cadStartPoint && hitGround && onCadDrawSlab) {
            onCadDrawSlab([cadStartPoint.x, cadStartPoint.z], [targetHit.x, targetHit.z]);
            setCadStartPoint(null);
          }
          return;
        }

        if (cadToolMode === 'column') {
          if (hitGround && onCadDrawColumn) {
            onCadDrawColumn([targetHit.x, targetHit.z]);
          }
          return;
        }

        if (cadToolMode === 'door' || cadToolMode === 'window') {
          if (intersects.length > 0 && onCadDrawOpening) {
            const hit = intersects[0];
            let expId: number | null = null;
            if (((hit.object as any).isBatchedMesh || hit.object instanceof THREE.BatchedMesh) && hit.batchId !== undefined) {
              const instances = (hit.object.userData as any)?.instances;
              if (instances && instances[hit.batchId]) expId = instances[hit.batchId].expressID;
            } else if (hit.object.userData?.expressID) {
              expId = hit.object.userData.expressID as number;
            }
            if (expId !== null) {
              const meshes = meshMapRef.current.get(expId);
              const offset = meshes && meshes[0] ? Math.max(0.5, meshes[0].position.distanceTo(hit.point)) : 1.0;
              onCadDrawOpening(expId, offset);
            }
          }
          return;
        }
        return;
      }

      // Normal Selection: Select currently pre-selected / hovered element (or cycled via Tab) or frontmost visible candidate
      const candidates = findVisibleCandidates(
        raycaster,
        group,
        clipPlaneRef.current,
        sectionConfig.enabled,
        hiddenCategories,
        isolatedExpressID,
        hiddenModelIds
      );

      if (candidates.length > 0) {
        const pre = hoveredExpressIdRef.current;
        const hasPre = pre !== null && candidates.some((c) => c.expressID === pre);
        const targetId = hasPre ? (pre as number) : candidates[0].expressID;
        onSelectElement(targetId);
        const meshes = meshMapRef.current.get(targetId);
        if (meshes && meshes[0] && onTransformChange) {
          const pos = meshes[0].position.toArray() as [number, number, number];
          const rot = [meshes[0].rotation.x, meshes[0].rotation.y, meshes[0].rotation.z] as [number, number, number];
          onTransformChange(targetId, pos, rot);
        }
      } else {
        onSelectElement(null);
      }
    },
    [
      isMeasureActive,
      pendingStartPoint,
      onAddMeasurement,
      onSelectElement,
      onTransformChange,
      cadToolMode,
      cadStartPoint,
      onCadDrawWall,
      onCadDrawSlab,
      onCadDrawColumn,
      onCadDrawOpening,
      snapEnabled,
      sectionConfig.enabled,
      hiddenCategories,
      isolatedExpressID,
      hiddenModelIds,
      interactiveEditState,
      handleCancelInteractiveEdit,
      onMoveElement,
      onRotateElement,
      onMirrorElement,
      onArrayElement,
      onSpecialPointsPicked,
      applyLocalElementTransform
    ]
  );

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    const now = Date.now();
    if (
      isOrbitingRef.current ||
      isPointerDraggingRef.current ||
      (now - lastNavigationEndTimeRef.current < 200)
    ) {
      return;
    }

    const container = containerRef.current;
    const camera = cameraRef.current;
    const group = meshesGroupRef.current;
    if (!container || !camera || !group) return;

    const rect = container.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const candidates = findVisibleCandidates(
      raycaster,
      group,
      clipPlaneRef.current,
      sectionConfig.enabled,
      hiddenCategories,
      isolatedExpressID,
      hiddenModelIds
    );

    if (candidates.length > 0) {
      const expressID = candidates[0].expressID;
      onSelectElement(expressID);
      setContextMenu({ x: event.clientX, y: event.clientY, expressId: expressID });
      return;
    }

    setContextMenu({ x: event.clientX, y: event.clientY, expressId: null });
  }, [
    onSelectElement,
    sectionConfig.enabled,
    hiddenCategories,
    isolatedExpressID,
    hiddenModelIds
  ]);

  const getCursorClass = () => {
    if (interactiveEditState.mode !== 'none') return 'cursor-crosshair';
    if (isMeasureActive || cadToolMode !== 'select') return 'cursor-crosshair';
    if (hoveredExpressId !== null || isHoveringInteractiveMesh) return 'cursor-pointer';
    return 'cursor-default';
  };

  return (
    <div className="relative w-full h-full overflow-hidden select-none outline-none">
      <div
        ref={containerRef}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className={`w-full h-full ${getCursorClass()}`}
      />


      {/* Measure Mode Banner */}
      {isMeasureActive && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-[var(--dock-translucent)] border border-emerald-500/40 backdrop-blur-xl px-4 py-1.5 rounded-full text-xs text-emerald-300 flex items-center gap-2.5 shadow-[var(--shadow-hud)] select-none">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-mono font-medium">
            {pendingStartPoint ? (
              <>
                Click second point to finish
                {previewMeasure && (
                  <span className="ml-2 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-500/30">
                    {previewMeasure.distance.toFixed(3)} m
                  </span>
                )}
              </>
            ) : (
              'Hover over vertices or edges to snap • Click to start measurement'
            )}
          </span>
          <button
            data-qa="measurement-banner-cancel"
            onClick={() => {
              if (pendingStartPoint) {
                setPendingStartPoint(null);
                setPreviewMeasure(null);
                if (measurePreviewGroupRef.current) measurePreviewGroupRef.current.visible = false;
              } else if (onCancelMeasure) {
                onCancelMeasure();
              }
            }}
            className="text-[10px] text-slate-400 hover:text-slate-200 font-mono ml-1 px-1.5 py-0.5 rounded bg-[var(--control-bg)] hover:bg-[var(--control-hover)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
            title="Cancel measurement (Esc)"
          >
            ESC to cancel
          </button>
        </div>
      )}



      {/* Interactive CAD Tracker HUD (Archicad 29 & Tekla 2025 Floating Input) */}
      <CadTrackerHud
        readout={trackerReadout}
        onCommitValue={handleCommitTrackerValue}
        onCancel={handleCancelInteractiveEdit}
      />

      {/* Hover Snap Point Micro-Badge */}
      {isMeasureActive && activeSnap && (
        <div
          className="absolute pointer-events-none z-30 transition-transform duration-75 select-none"
          style={{
            left: `${activeSnap.screenPos.x}px`,
            top: `${activeSnap.screenPos.y - 18}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div
            className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border shadow-lg flex items-center gap-1.5 backdrop-blur-md ${
              activeSnap.type === 'vertex'
                ? 'bg-slate-950/90 text-cyan-300 border-cyan-400'
                : activeSnap.type === 'midpoint'
                ? 'bg-slate-950/90 text-amber-300 border-amber-400'
                : 'bg-slate-950/90 text-emerald-300 border-emerald-400'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                activeSnap.type === 'vertex'
                  ? 'bg-cyan-400 animate-pulse'
                  : activeSnap.type === 'midpoint'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-emerald-400'
              }`}
            />
            <span>
              {activeSnap.type === 'vertex'
                ? 'Vertex Snap'
                : activeSnap.type === 'midpoint'
                ? 'Midpoint Snap'
                : 'Surface Snap'}
            </span>
          </div>
        </div>
      )}

      {/* Dynamic Rubber-Band Measurement HUD Pill (Projected from Line Midpoint) */}
      {isMeasureActive && pendingStartPoint && previewMeasure && (
        <div
          className="absolute pointer-events-none z-30 select-none flex flex-col items-center"
          style={{
            left: `${previewMeasure.midpointScreen.x}px`,
            top: `${previewMeasure.midpointScreen.y}px`,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className="bg-[var(--dock-bg)] text-cyan-200 border border-cyan-400/60 px-2.5 py-1 rounded-md shadow-[var(--shadow-hud)] backdrop-blur-md flex flex-col items-center gap-0.5">
            <div className="text-xs font-mono font-bold text-cyan-300 tracking-tight">
              {previewMeasure.distance.toFixed(3)} m
            </div>
            <div className="text-[9px] font-mono text-slate-400 flex items-center gap-1.5">
              <span>X {previewMeasure.dx.toFixed(2)}</span>
              <span className="text-slate-600">•</span>
              <span>Y {previewMeasure.dy.toFixed(2)}</span>
              <span className="text-slate-600">•</span>
              <span>Z {previewMeasure.dz.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Measurement Dimension Tags Projected from 3D Space */}
      {screenMeasurements
        .filter((sm) => measurements.some((m) => m.id === sm.id))
        .map((m) => (
        m.visible && (
          <div
            key={m.id}
            onClick={(e) => {
              e.stopPropagation();
              const found = measurements.find((item) => item.id === m.id);
              if (found && onSelectMeasurement) {
                onSelectMeasurement(found);
              }
            }}
            className="absolute pointer-events-auto cursor-pointer hover:scale-105 active:scale-95 text-[10px] font-mono font-bold bg-[var(--dock-bg)] text-cyan-300 hover:text-cyan-200 px-2 py-0.5 rounded border border-cyan-400/40 hover:border-cyan-400 shadow-[var(--shadow-hud)] transition-all select-none"
            style={{
              left: `${m.x}px`,
              top: `${m.y}px`,
              transform: 'translate(-50%, -50%)'
            }}
            title="Click to view exact XYZ deltas"
            data-qa="measurement-dimension-tag"
            data-measure-id={m.id}
          >
            {m.distance.toFixed(3)} m
          </div>
        )
      ))}


      {/* 3D Spatial Context Menu (Right Click) */}
      {contextMenu && (
        <SpatialContextMenu
          position={{ x: contextMenu.x, y: contextMenu.y }}
          expressId={contextMenu.expressId}
          isPinned={Boolean(contextMenu.expressId && pinnedExpressIds?.has(contextMenu.expressId))}
          onClose={() => setContextMenu(null)}
          onFocus={(id) => handleFocusElement(id)}
          onClone={(id) => onCloneElement && onCloneElement(id)}
          onDelete={(id) => onDeleteElement && onDeleteElement(id)}
          onOpenInspector={() => onOpenInspector && onOpenInspector()}
          onSelectTool={(tool) => onSelectCadTool && onSelectCadTool(tool)}
          onResetView={handleResetView}
          onClearSelection={() => onSelectElement(null)}
          onRotate={(id, angle, axis) => onRotateElement && onRotateElement(id, angle, axis)}
          onMirror={(id, axis, copy) => onMirrorElement && onMirrorElement(id, axis, copy)}
          onArray={(id, count, delta) => onArrayElement && onArrayElement(id, count, delta)}
          onAlign={(id, axis, val) => onAlignElement && onAlignElement(id, axis, val)}
          onTogglePin={(id) => onTogglePin && onTogglePin(id)}
        />
      )}

      {/* Dynamic Drafting HUD (Type-ahead Distance & Angle during Drawing) */}
      {cadToolMode !== 'select' && (
        <DraftingInputHud
          toolMode={cadToolMode}
          isDrawing={Boolean(cadStartPoint)}
          currentLength={draftingLength}
          currentAngle={draftingAngle}
          isOrthoLocked={isOrthoLocked}
          onCommitDistance={handleCommitDraftingDistance}
          onCancel={() => {
            setCadStartPoint(null);
            if (onCadCancel) onCadCancel();
          }}
        />
      )}

      {/* Tab Candidate Cycling Pill (Multi-Surface Depth Selection) */}
      {hoverCandidates.length > 1 && hoveredExpressId !== null && cadToolMode === 'select' && !isMeasureActive && (
        <div
          className="absolute bottom-24 left-1/2 -translate-x-1/2 pointer-events-none flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 border border-slate-300/90 dark:border-cyan-400/40 shadow-xl shadow-slate-900/10 dark:shadow-black/50 backdrop-blur-xl text-xs font-mono select-none z-30 transition-all duration-150 animate-in fade-in"
          data-qa="tab-candidate-pill"
        >
          <kbd className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-cyan-500/20 text-blue-700 dark:text-cyan-300 font-bold text-[10px] border border-blue-300/80 dark:border-cyan-500/40 shadow-2xs">
            Tab
          </kbd>
          <span className="text-slate-700 dark:text-slate-200 font-medium">
            Cycle surface{' '}
            <strong className="text-slate-950 dark:text-white font-extrabold">
              {hoverCandidateIndex + 1}
            </strong>{' '}
            <span className="text-slate-500 dark:text-slate-400 font-normal">of</span>{' '}
            <strong className="text-slate-950 dark:text-white font-extrabold">
              {hoverCandidates.length}
            </strong>
          </span>
          <span className="text-blue-700 dark:text-cyan-300 font-bold text-[11px] font-mono">
            ({hoveredElementName})
          </span>
        </div>
      )}
    </div>
  );
};
