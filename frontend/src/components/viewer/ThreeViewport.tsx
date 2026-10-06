import React, { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';

// Extend Three.js prototypes for geometry acceleration if needed
(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
import type { GeometryData } from '../../types/ifc';
import type { CameraPreset, RenderStyle, SectionPlaneConfig } from '../tools/BimToolsToolbar';

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
  geometries: GeometryData[];
  selectedExpressID: number | null;
  onSelectElement: (expressID: number | null) => void;
  hiddenCategories: Set<string>;
  isolatedExpressID: number | null;
  transformMode: TransformMode;
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

export const ThreeViewport: React.FC<ThreeViewportProps> = ({
  geometries,
  selectedExpressID,
  onSelectElement,
  hiddenCategories,
  isolatedExpressID,
  transformMode,
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
  onCadCancel
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const meshesGroupRef = useRef<THREE.Group | null>(null);
  const meshMapRef = useRef<Map<number, THREE.Mesh[]>>(new Map());
  const bboxHelperRef = useRef<THREE.BoxHelper | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const isDraggingGizmoRef = useRef(false);
  const clashMarkerGroupRef = useRef<THREE.Group | null>(null);
  const cadPreviewGroupRef = useRef<THREE.Group | null>(null);

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
  const disciplineMaterialsRef = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map());
  const diffMaterialsRef = useRef<{ added: THREE.MeshStandardMaterial; modified: THREE.MeshStandardMaterial; unchanged: THREE.MeshStandardMaterial } | null>(null);
  const needsRenderRef = useRef(true);
  const isNavigatingRef = useRef(false);
  const navSettleTimerRef = useRef<number | null>(null);
  const lastScreenMeasureUpdateRef = useRef<MeasurementRecord[]>([]);

  // 1. Initialize Scene & Renderer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0d10);
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
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.maxDistance = 500;
    controls.minDistance = 0.5;
    controlsRef.current = controls;

    // Dynamic Resolution Scaling (DRS) & Shadow Freeze Event Handlers
    controls.addEventListener('start', () => {
      isNavigatingRef.current = true;
      if (navSettleTimerRef.current) window.clearTimeout(navSettleTimerRef.current);
      // Adaptive Dynamic Resolution Scaling: drop to lower pixel ratio during fast camera orbit
      const fastRatio = Math.max(0.75, Math.min(window.devicePixelRatio * 0.75, 1.0));
      renderer.setPixelRatio(fastRatio);
      needsRenderRef.current = true;
    });

    controls.addEventListener('change', () => {
      needsRenderRef.current = true;
    });

    controls.addEventListener('end', () => {
      if (navSettleTimerRef.current) window.clearTimeout(navSettleTimerRef.current);
      navSettleTimerRef.current = window.setTimeout(() => {
        isNavigatingRef.current = false;
        // Restore native sharp resolution when camera motion settles
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.needsUpdate = true;
        needsRenderRef.current = true;
      }, 120);
    });

    // TransformControls
    const tControls = new TransformControls(camera, renderer.domElement);
    tControls.size = 0.75;
    scene.add(tControls.getHelper());
    transformControlsRef.current = tControls;

    tControls.addEventListener('dragging-changed', (event) => {
      const isDragging = Boolean(event.value);
      isDraggingGizmoRef.current = isDragging;
      controls.enabled = !isDragging;
      needsRenderRef.current = true;

      if (!isDragging && tControls.object) {
        const mesh = tControls.object as THREE.Mesh;
        const expressID = mesh.userData.expressID as number;
        mesh.updateMatrixWorld();
        if (mesh.userData.batchedMesh && mesh.userData.batchId !== undefined) {
          mesh.userData.batchedMesh.setMatrixAt(mesh.userData.batchId, mesh.matrixWorld);
          mesh.userData.batchedMesh.instanceMatrix.needsUpdate = true;
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

    // Grid (DTCG tokens: cyan accent line, subtle dark grid)
    const gridHelper = new THREE.GridHelper(50, 50, 0x22d3ee, 0x252b36);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

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
      scene,
      camera,
      meshesGroup,
      renderer,
      getRendererInfo: () => ({
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        points: renderer.info.render.points,
        lines: renderer.info.render.lines,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures
      }),
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
      controls.dispose();
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

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [onTransformEnd, onTransformChange]);

  // 2. Update Section Clipping Plane
  useEffect(() => {
    const plane = clipPlaneRef.current;
    if (!sectionConfig.enabled) {
      plane.set(new THREE.Vector3(0, 1, 0), 1000); // disable by pushing far away
      return;
    }

    const dir = sectionConfig.inverted ? 1 : -1;
    let normal = new THREE.Vector3(0, dir, 0);
    if (sectionConfig.axis === 'x') normal = new THREE.Vector3(dir, 0, 0);
    else if (sectionConfig.axis === 'z') normal = new THREE.Vector3(0, 0, dir);

    plane.set(normal, sectionConfig.position * dir);
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

    if (bboxHelperRef.current) {
      scene.remove(bboxHelperRef.current);
      bboxHelperRef.current = null;
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
            side: THREE.DoubleSide,
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
            side: THREE.DoubleSide,
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

    if (!box.isEmpty() && cameraRef.current && controlsRef.current) {
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
  }, [geometries]);

  // Handle visibility filtering (Categories, Isolation, & Model Federation)
  useEffect(() => {
    meshMapRef.current.forEach((meshes) => {
      meshes.forEach((mesh) => {
        const type = mesh.userData.type as string;
        const expressID = mesh.userData.expressID as number;
        const modelId = (mesh.userData.modelId as string) || 'main';

        let visible = true;
        if (hiddenCategories.has(type)) {
          visible = false;
        }
        if (isolatedExpressID !== null && expressID !== isolatedExpressID) {
          visible = false;
        }
        if (hiddenModelIds && hiddenModelIds.has(modelId)) {
          visible = false;
        }

        mesh.visible = visible;
      });
    });
    needsRenderRef.current = true;
  }, [hiddenCategories, isolatedExpressID, hiddenModelIds]);

  // 4. Update Render Style (Shaded, Wireframe, Ghost, Discipline, Diff) via Shared Material Pool
  useEffect(() => {
    const catMats = categoryMaterialsRef.current;
    const discMats = disciplineMaterialsRef.current;
    const clipPlane = clipPlaneRef.current;

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
          side: THREE.DoubleSide,
          clippingPlanes: [clipPlane],
          clipShadows: true
        });
        discMats.set(disc, m);
      }
      return m;
    };

    if (renderStyle === 'wireframe') {
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
    } else if (renderStyle === 'ghost') {
      catMats.forEach((mat) => {
        mat.wireframe = false;
        mat.transparent = true;
        mat.opacity = 0.25;
        mat.needsUpdate = true;
      });
      meshMapRef.current.forEach((meshes) => {
        meshes.forEach((mesh) => {
          const type = mesh.userData.type as string;
          const targetMat = catMats.get(type);
          if (targetMat && mesh.material !== targetMat) mesh.material = targetMat;
        });
      });
    } else if (renderStyle === 'discipline') {
      meshMapRef.current.forEach((meshes) => {
        meshes.forEach((mesh) => {
          const disc = (mesh.userData.discipline as string) || inferDiscipline(mesh.userData.type as string);
          mesh.material = getDiscMat(disc);
        });
      });
    } else if (renderStyle === 'diff') {
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
    } else {
      // Standard shaded
      catMats.forEach((mat, type) => {
        const config = CATEGORY_COLORS[type] || DEFAULT_MATERIAL_CONFIG;
        mat.wireframe = false;
        mat.transparent = Boolean(config.opacity && config.opacity < 1.0);
        mat.opacity = config.opacity ?? 1.0;
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
  }, [renderStyle, auditDiff]);

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

  // 7. Handle Selection & TransformControls
  useEffect(() => {
    const scene = sceneRef.current;
    const tControls = transformControlsRef.current;
    if (!scene || !tControls) return;

    if (bboxHelperRef.current) {
      scene.remove(bboxHelperRef.current);
      bboxHelperRef.current = null;
    }

    if (selectedExpressID === null || isMeasureActive) {
      tControls.detach();
      return;
    }

    const meshes = meshMapRef.current.get(selectedExpressID);
    if (!meshes || meshes.length === 0) {
      tControls.detach();
      return;
    }

    const primaryMesh = meshes[0];
    const bbox = new THREE.BoxHelper(primaryMesh, 0x38bdf8);
    scene.add(bbox);
    bboxHelperRef.current = bbox;

    if (transformMode === 'select') {
      tControls.detach();
    } else {
      tControls.attach(primaryMesh);
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
  }, [selectedExpressID, transformMode, snapEnabled, onTransformChange, isMeasureActive]);

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

  // Configure OrbitControls isolation and reset snap when measure tool toggles
  useEffect(() => {
    const controls = controlsRef.current;
    if (controls) {
      if (isMeasureActive) {
        // Isolate Left-Click for measurement point placement; use Right-Click to orbit while measuring
        controls.mouseButtons = {
          LEFT: -1 as any,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.ROTATE
        };
      } else {
        controls.mouseButtons = {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN
        };
      }
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

  // Handle ESC key to clear element selection, cancel measurement, or cancel CAD drawing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.code === 'Escape' || e.keyCode === 27) {
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
    onCancelMeasure
  ]);

  // Pointer Move Handler for Snapping Preview & Rubber-Band Measure Line
  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isDraggingGizmoRef.current) return;
      if (!isMeasureActive && cadToolMode === 'select') return;

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
      (raycaster as any).firstHitOnly = true;
      raycaster.setFromCamera(mouse, camera);

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

      if (!isMeasureActive || !snapGroup) return;

      const visibleMeshes = group.children.filter((c) => c.visible);
      const snapResult = findSnapPoint(
        raycaster,
        visibleMeshes,
        camera,
        { x: event.clientX, y: event.clientY },
        rect
      );

      if (snapResult) {
        currentSnapPointRef.current = snapResult.point;
        currentSnapTypeRef.current = snapResult.type;

        // Position & configure snap indicator gizmo
        snapGroup.position.copy(snapResult.point);
        snapGroup.quaternion.copy(camera.quaternion);
        const camDist = camera.position.distanceTo(snapResult.point);
        const scale = Math.max(0.015, camDist * 0.08);
        snapGroup.scale.set(scale, scale, scale);

        // Colorize based on snap type: cyan for vertex, amber for midpoint, emerald for surface
        const ringMesh = snapGroup.children[0] as THREE.Mesh;
        const tickMesh = snapGroup.children[2] as THREE.LineSegments;
        const snapColor = snapResult.type === 'vertex' ? 0x22d3ee : snapResult.type === 'midpoint' ? 0xf59e0b : 0x10b981;
        if (ringMesh?.material instanceof THREE.MeshBasicMaterial) ringMesh.material.color.setHex(snapColor);
        if (tickMesh?.material instanceof THREE.LineBasicMaterial) tickMesh.material.color.setHex(snapColor);
        snapGroup.visible = true;

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
        currentSnapPointRef.current = null;
        currentSnapTypeRef.current = null;
        snapGroup.visible = false;
        setActiveSnap(null);

        if (previewGroup) previewGroup.visible = false;
        setPreviewMeasure(null);
      }
      needsRenderRef.current = true;
    },
    [isMeasureActive, pendingStartPoint, cadToolMode, cadStartPoint]
  );

  const handlePointerLeave = useCallback(() => {
    if (snapIndicatorGroupRef.current) snapIndicatorGroupRef.current.visible = false;
    if (measurePreviewGroupRef.current) measurePreviewGroupRef.current.visible = false;
    setActiveSnap(null);
    setPreviewMeasure(null);
    needsRenderRef.current = true;
  }, []);

  const pointerDownPosRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button === 0) {
        pointerDownPosRef.current = { x: event.clientX, y: event.clientY, time: Date.now() };
        if (isMeasureActive) {
          // Isolate measurement click from OrbitControls pointer capture
          event.stopPropagation();
        }
      }
    },
    [isMeasureActive]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button === 0 && pointerDownPosRef.current) {
        const dx = Math.abs(event.clientX - pointerDownPosRef.current.x);
        const dy = Math.abs(event.clientY - pointerDownPosRef.current.y);
        const dt = Date.now() - pointerDownPosRef.current.time;
        pointerDownPosRef.current = null;

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
        }
      }
    },
    [isMeasureActive, pendingStartPoint, onAddMeasurement]
  );

  // Click Handler for Raycasting (Selection OR Measurement)
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (isDraggingGizmoRef.current) return;
      if (isMeasureActive) return; // Handled reliably via onPointerUp to prevent OrbitControls conflicts

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
      (raycaster as any).firstHitOnly = true;
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

        if (cadToolMode === 'wall') {
          if (!cadStartPoint && hitGround) {
            setCadStartPoint(groundHit.clone());
          } else if (cadStartPoint && hitGround && onCadDrawWall) {
            onCadDrawWall([cadStartPoint.x, cadStartPoint.z], [groundHit.x, groundHit.z]);
            setCadStartPoint(null);
          }
          return;
        }

        if (cadToolMode === 'slab') {
          if (!cadStartPoint && hitGround) {
            setCadStartPoint(groundHit.clone());
          } else if (cadStartPoint && hitGround && onCadDrawSlab) {
            onCadDrawSlab([cadStartPoint.x, cadStartPoint.z], [groundHit.x, groundHit.z]);
            setCadStartPoint(null);
          }
          return;
        }

        if (cadToolMode === 'column') {
          if (hitGround && onCadDrawColumn) {
            onCadDrawColumn([groundHit.x, groundHit.z]);
          }
          return;
        }

        if (cadToolMode === 'door' || cadToolMode === 'window') {
          if (intersects.length > 0 && onCadDrawOpening) {
            const hit = intersects[0];
            let expId: number | null = null;
            if (hit.object instanceof THREE.BatchedMesh && hit.batchId !== undefined) {
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

      // Normal Selection
      if (intersects.length > 0) {
        const hit = intersects[0];
        let expressID: number | null = null;
        if (hit.object instanceof THREE.BatchedMesh && hit.batchId !== undefined) {
          const instances = (hit.object.userData as any)?.instances;
          if (instances && instances[hit.batchId]) {
            expressID = instances[hit.batchId].expressID;
          }
        } else if (hit.object.userData && hit.object.userData.expressID !== undefined) {
          expressID = hit.object.userData.expressID as number;
        }

        if (expressID !== null) {
          onSelectElement(expressID);
          const meshes = meshMapRef.current.get(expressID);
          if (meshes && meshes[0] && onTransformChange) {
            const pos = meshes[0].position.toArray() as [number, number, number];
            const rot = [meshes[0].rotation.x, meshes[0].rotation.y, meshes[0].rotation.z] as [number, number, number];
            onTransformChange(expressID, pos, rot);
          }
        } else {
          onSelectElement(null);
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
      onCadDrawOpening
    ]
  );

  return (
    <div className="relative w-full h-full overflow-hidden select-none outline-none">
      <div
        ref={containerRef}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className="w-full h-full cursor-crosshair"
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
    </div>
  );
};
