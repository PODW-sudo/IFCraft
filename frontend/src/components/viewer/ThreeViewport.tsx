import React, { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { Move, RotateCw, Maximize2, MousePointer, Magnet } from 'lucide-react';
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
  onSetTransformMode: (mode: TransformMode) => void;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  onTransformEnd: (expressID: number, matrix: number[]) => void;
  onTransformChange?: (expressID: number, pos: [number, number, number], rot: [number, number, number]) => void;
  // Phase 4 Props
  isMeasureActive: boolean;
  measurements: MeasurementRecord[];
  onAddMeasurement: (record: MeasurementRecord) => void;
  sectionConfig: SectionPlaneConfig;
  cameraPresetTrigger?: { preset: CameraPreset; timestamp: number } | null;
  renderStyle: RenderStyle;
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
  onSetTransformMode,
  snapEnabled,
  onToggleSnap,
  onTransformEnd,
  onTransformChange,
  isMeasureActive,
  measurements,
  onAddMeasurement,
  sectionConfig,
  cameraPresetTrigger,
  renderStyle
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
    scene.background = new THREE.Color(0x0d0f12);
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
      powerPreference: 'high-performance'
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x94a3b8, 0.4);
    dirLight2.position.set(-20, -10, -20);
    scene.add(dirLight2);

    // Grid
    const gridHelper = new THREE.GridHelper(50, 50, 0x38bdf8, 0x262a33);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    // Groups
    const meshesGroup = new THREE.Group();
    scene.add(meshesGroup);
    meshesGroupRef.current = meshesGroup;

    const measureGroup = new THREE.Group();
    scene.add(measureGroup);
    measureGroupRef.current = measureGroup;

    // Animate
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
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
        const hit = intersects[0].object;
        const expressID = hit.userData.expressID as number;
        onSelectElement(expressID);
      } else {
        onSelectElement(null);
      }
    },
    [isMeasureActive, pendingStartPoint, onAddMeasurement, onSelectElement]
  );

  return (
    <div className="relative w-full h-full overflow-hidden select-none outline-none">
      <div ref={containerRef} onClick={handleClick} className="w-full h-full cursor-crosshair" />

      {/* Floating Transform Gizmo Controls (Hidden in measure mode) */}
      {!isMeasureActive && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-[#16191f]/90 backdrop-blur-md p-1 rounded-lg border border-[#262a33] shadow-xl">
          <button
            onClick={() => onSetTransformMode('select')}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs transition-colors ${
              transformMode === 'select'
                ? 'bg-sky-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Select Mode (Q)"
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span>Select</span>
          </button>

          <button
            onClick={() => onSetTransformMode('translate')}
            disabled={selectedExpressID === null}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs transition-colors ${
              transformMode === 'translate'
                ? 'bg-sky-500 text-slate-950 font-semibold shadow-sm'
                : selectedExpressID === null
                ? 'text-slate-600 cursor-not-allowed'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Translate Gizmo (W)"
          >
            <Move className="w-3.5 h-3.5" />
            <span>Translate</span>
          </button>

          <button
            onClick={() => onSetTransformMode('rotate')}
            disabled={selectedExpressID === null}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs transition-colors ${
              transformMode === 'rotate'
                ? 'bg-sky-500 text-slate-950 font-semibold shadow-sm'
                : selectedExpressID === null
                ? 'text-slate-600 cursor-not-allowed'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Rotate Gizmo (E)"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Rotate</span>
          </button>

          <button
            onClick={() => onSetTransformMode('scale')}
            disabled={selectedExpressID === null}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs transition-colors ${
              transformMode === 'scale'
                ? 'bg-sky-500 text-slate-950 font-semibold shadow-sm'
                : selectedExpressID === null
                ? 'text-slate-600 cursor-not-allowed'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Scale Gizmo (R)"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Scale</span>
          </button>

          <div className="w-[1px] h-4 bg-[#262a33] mx-1" />

          <button
            onClick={onToggleSnap}
            className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs transition-colors ${
              snapEnabled
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-medium'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
            }`}
            title="Toggle Snap Grid (0.5m / 15°) (X)"
          >
            <Magnet className="w-3.5 h-3.5" />
            <span>Snap</span>
          </button>
        </div>
      )}

      {/* Measure Mode Banner */}
      {isMeasureActive && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-sky-500/10 border border-sky-400/40 backdrop-blur-md px-4 py-2 rounded-lg text-xs text-sky-300 flex items-center gap-2 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
          <span>
            {pendingStartPoint
              ? 'Click second surface point to finish measurement'
              : 'Click first surface point to start measurement'}
          </span>
        </div>
      )}

      {/* Floating Measurement Dimension Tags */}
      {measurements.map((m) => (
        <div
          key={m.id}
          className="absolute pointer-events-none text-[10px] font-mono font-bold bg-[#16191f]/90 text-sky-300 px-2 py-0.5 rounded border border-sky-400/40 shadow"
          style={{
            // Position approximate badge on screen
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        >
          {m.distance.toFixed(2)} m
        </div>
      ))}
    </div>
  );
};
