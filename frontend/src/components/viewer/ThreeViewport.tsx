import React, { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import type { GeometryData } from '../../types/ifc';
import type { CameraPreset, RenderStyle, SectionPlaneConfig } from '../tools/BimToolsToolbar';

export type TransformMode = 'select' | 'translate' | 'rotate' | 'scale';

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

const DEFAULT_MATERIAL_CONFIG = { color: 0x94a3b8, roughness: 0.75, metalness: 0.1 };

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
  sectionConfig,
  cameraPresetTrigger,
  onCameraPreset,
  renderStyle,
  elementLocks = {},
  remoteTransform,
  isRightDrawerOpen = false,
  rightDrawerWidth = 320
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

  // Dynamic 3D Screen Projection for Measurements
  const measurementsRef = useRef(measurements);
  measurementsRef.current = measurements;
  const [screenMeasurements, setScreenMeasurements] = useState<
    { id: string; x: number; y: number; visible: boolean; distance: number }[]
  >([]);

  // Clipping Plane Ref
  const clipPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, -1, 0), 10));

  // Measurement State
  const [pendingStartPoint, setPendingStartPoint] = useState<THREE.Vector3 | null>(null);
  const measureGroupRef = useRef<THREE.Group | null>(null);

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

    // TransformControls
    const tControls = new TransformControls(camera, renderer.domElement);
    tControls.size = 0.75;
    scene.add(tControls.getHelper());
    transformControlsRef.current = tControls;

    tControls.addEventListener('dragging-changed', (event) => {
      const isDragging = Boolean(event.value);
      isDraggingGizmoRef.current = isDragging;
      controls.enabled = !isDragging;

      if (!isDragging && tControls.object) {
        const mesh = tControls.object as THREE.Mesh;
        const expressID = mesh.userData.expressID as number;
        mesh.updateMatrixWorld();
        const matrixArray = mesh.matrixWorld.toArray();
        onTransformEnd(expressID, matrixArray);
      }
    });

    tControls.addEventListener('objectChange', () => {
      if (tControls.object && onTransformChange) {
        const mesh = tControls.object as THREE.Mesh;
        const expressID = mesh.userData.expressID as number;
        const pos = mesh.position.toArray() as [number, number, number];
        const rot = [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z] as [number, number, number];
        onTransformChange(expressID, pos, rot);
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

    // Animate & Dynamic 3D Projection
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);

      // Project 3D vector midpoints to 2D screen coordinates
      if (measurementsRef.current.length > 0 && container) {
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
    };
    animate();

    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      if (container.clientWidth === 0 || container.clientHeight === 0) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
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
      tControls.dispose();
      controls.dispose();
      renderer.dispose();
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
      if (child.geometry) child.geometry.dispose();
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
      else if (child.material) child.material.dispose();
    }
    meshMapRef.current.clear();

    if (bboxHelperRef.current) {
      scene.remove(bboxHelperRef.current);
      bboxHelperRef.current = null;
    }

    if (geometries.length === 0) return;

    const box = new THREE.Box3();

    geometries.forEach((geom) => {
      const bufferGeometry = new THREE.BufferGeometry();
      bufferGeometry.setAttribute('position', new THREE.BufferAttribute(geom.positions, 3));
      bufferGeometry.setAttribute('normal', new THREE.BufferAttribute(geom.normals, 3));
      bufferGeometry.setIndex(new THREE.BufferAttribute(geom.indices, 1));
      bufferGeometry.computeBoundingBox();

      const config = CATEGORY_COLORS[geom.type] || DEFAULT_MATERIAL_CONFIG;
      const isTransparent = Boolean(config.opacity && config.opacity < 1.0);

      const material = new THREE.MeshStandardMaterial({
        color: config.color,
        roughness: config.roughness,
        metalness: config.metalness,
        transparent: isTransparent,
        opacity: config.opacity ?? 1.0,
        side: THREE.DoubleSide,
        clippingPlanes: [clipPlaneRef.current],
        clipShadows: true
      });

      const mesh = new THREE.Mesh(bufferGeometry, material);
      mesh.castShadow = !isTransparent;
      mesh.receiveShadow = true;

      if (geom.matrix && geom.matrix.length === 16) {
        const mat = new THREE.Matrix4().fromArray(geom.matrix);
        mesh.applyMatrix4(mat);
      }

      mesh.userData = { expressID: geom.expressID, type: geom.type };
      group.add(mesh);

      const existing = meshMapRef.current.get(geom.expressID) || [];
      existing.push(mesh);
      meshMapRef.current.set(geom.expressID, existing);

      mesh.geometry.computeBoundingBox();
      if (mesh.geometry.boundingBox) {
        const transformedBox = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
        box.union(transformedBox);
      }
    });

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

  // Handle visibility filtering (Categories & Isolation)
  useEffect(() => {
    meshMapRef.current.forEach((meshes) => {
      meshes.forEach((mesh) => {
        const type = mesh.userData.type as string;
        const expressID = mesh.userData.expressID as number;

        let visible = true;
        if (hiddenCategories.has(type)) {
          visible = false;
        }
        if (isolatedExpressID !== null && expressID !== isolatedExpressID) {
          visible = false;
        }

        mesh.visible = visible;
      });
    });
  }, [hiddenCategories, isolatedExpressID]);

  // 4. Update Render Style (Shaded, Wireframe, Ghost)
  useEffect(() => {
    meshMapRef.current.forEach((meshes) => {
      meshes.forEach((mesh) => {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (!mat) return;

        if (renderStyle === 'wireframe') {
          mat.wireframe = true;
          mat.opacity = 1.0;
          mat.transparent = false;
        } else if (renderStyle === 'ghost') {
          mat.wireframe = false;
          mat.transparent = true;
          mat.opacity = 0.25;
        } else {
          mat.wireframe = false;
          const config = CATEGORY_COLORS[mesh.userData.type] || DEFAULT_MATERIAL_CONFIG;
          mat.transparent = Boolean(config.opacity && config.opacity < 1.0);
          mat.opacity = config.opacity ?? 1.0;
        }
        mat.needsUpdate = true;
      });
    });
  }, [renderStyle]);

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

    return () => {
      lockHelpersRef.current.forEach((helper) => scene.remove(helper));
      lockHelpersRef.current.clear();
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
  }, [remoteTransform]);

  // Click Handler for Raycasting (Selection OR Measurement)
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (isDraggingGizmoRef.current) return;

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
        if (intersects.length > 0) {
          const hitPoint = intersects[0].point;
          if (!pendingStartPoint) {
            setPendingStartPoint(hitPoint);
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
          }
        }
        return;
      }

      // Normal Selection
      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        const expressID = hit.userData.expressID as number;
        onSelectElement(expressID);
        if (onTransformChange) {
          const pos = hit.position.toArray() as [number, number, number];
          const rot = [hit.rotation.x, hit.rotation.y, hit.rotation.z] as [number, number, number];
          onTransformChange(expressID, pos, rot);
        }
      } else {
        onSelectElement(null);
      }
    },
    [isMeasureActive, pendingStartPoint, onAddMeasurement, onSelectElement, onTransformChange]
  );

  return (
    <div className="relative w-full h-full overflow-hidden select-none outline-none">
      <div ref={containerRef} onClick={handleClick} className="w-full h-full cursor-crosshair" />

      {/* 3D Viewport Orientation Triad / Quick-View Gizmo (Top-Right) */}
      <div
        style={{ right: isRightDrawerOpen ? `${rightDrawerWidth + 24}px` : '1rem' }}
        className="absolute top-4 z-10 flex flex-col items-center gap-1.5 p-1.5 rounded-xl bg-[var(--dock-translucent)] backdrop-blur-xl border border-[var(--border-subtle)] shadow-[var(--shadow-hud)] select-none transition-[right] duration-200"
      >
        <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 px-1 font-semibold uppercase tracking-wider">
          <span>Views</span>
        </div>
        <div className="grid grid-cols-2 gap-1 w-24 text-[10px] font-mono">
          <button
            onClick={() => onCameraPreset && onCameraPreset('iso')}
            className="px-1.5 py-1 rounded bg-[var(--control-bg)] hover:bg-[var(--control-hover)] text-slate-200 border border-[var(--border-subtle)] transition-colors text-center font-bold"
            title="Isometric 3D"
          >
            ISO
          </button>
          <button
            onClick={() => onCameraPreset && onCameraPreset('top')}
            className="px-1.5 py-1 rounded bg-[var(--control-bg)] hover:bg-[var(--control-hover)] text-cyan-300 border border-[var(--border-subtle)] transition-colors text-center font-bold"
            title="Top Floor Plan View"
          >
            TOP
          </button>
          <button
            onClick={() => onCameraPreset && onCameraPreset('front')}
            className="px-1.5 py-1 rounded bg-[var(--control-bg)] hover:bg-[var(--control-hover)] text-slate-200 border border-[var(--border-subtle)] transition-colors text-center font-bold"
            title="Front Elevation View"
          >
            FRONT
          </button>
          <button
            onClick={() => onCameraPreset && onCameraPreset('side')}
            className="px-1.5 py-1 rounded bg-[var(--control-bg)] hover:bg-[var(--control-hover)] text-slate-200 border border-[var(--border-subtle)] transition-colors text-center font-bold"
            title="Side Elevation View"
          >
            SIDE
          </button>
        </div>
      </div>

      {/* Measure Mode Banner */}
      {isMeasureActive && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-[var(--dock-translucent)] border border-emerald-500/40 backdrop-blur-xl px-4 py-1.5 rounded-full text-xs text-emerald-300 flex items-center gap-2 shadow-[var(--shadow-hud)]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>
            {pendingStartPoint
              ? 'Click second surface point to finish measurement'
              : 'Click first surface point to start measurement'}
          </span>
        </div>
      )}

      {/* Floating Measurement Dimension Tags Projected from 3D Space */}
      {screenMeasurements.map((m) => (
        m.visible && (
          <div
            key={m.id}
            className="absolute pointer-events-none text-[10px] font-mono font-bold bg-[var(--dock-bg)] text-cyan-300 px-2 py-0.5 rounded border border-cyan-400/40 shadow-[var(--shadow-hud)]"
            style={{
              left: `${m.x}px`,
              top: `${m.y}px`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            {m.distance.toFixed(3)} m
          </div>
        )
      ))}
    </div>
  );
};
