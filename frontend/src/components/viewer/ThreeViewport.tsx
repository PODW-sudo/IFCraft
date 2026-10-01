import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { Move, RotateCw, Maximize2, MousePointer, Magnet } from 'lucide-react';
import type { GeometryData } from '../../types/ifc';

export type TransformMode = 'select' | 'translate' | 'rotate' | 'scale';

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
}

// Architectural Category Materials Palette (Obsidian Minimalist Theme)
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
  onTransformChange
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

  // Initialize Three.js Viewport
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0f12); // Obsidian Minimalist background
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(15, 12, 18);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.maxDistance = 500;
    controls.minDistance = 0.5;
    controlsRef.current = controls;

    // 5. TransformControls (3D Gizmo)
    const tControls = new TransformControls(camera, renderer.domElement);
    tControls.size = 0.75;
    scene.add(tControls.getHelper());
    transformControlsRef.current = tControls;

    // Disable OrbitControls while dragging gizmo
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

    // 6. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(20, 40, 20);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 2048;
    dirLight1.shadow.mapSize.height = 2048;
    dirLight1.shadow.camera.near = 0.5;
    dirLight1.shadow.camera.far = 150;
    dirLight1.shadow.bias = -0.0001;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x94a3b8, 0.4);
    dirLight2.position.set(-20, -10, -20);
    scene.add(dirLight2);

    // 7. Grid Helper
    const gridHelper = new THREE.GridHelper(50, 50, 0x38bdf8, 0x262a33);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    // 8. Group for IFC Meshes
    const meshesGroup = new THREE.Group();
    scene.add(meshesGroup);
    meshesGroupRef.current = meshesGroup;

    // Render loop
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
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

  // Update Geometry Meshes when geometries prop changes
  useEffect(() => {
    const scene = sceneRef.current;
    const group = meshesGroupRef.current;
    const tControls = transformControlsRef.current;
    if (!scene || !group) return;

    if (tControls) tControls.detach();

    // Explicit cleanup of previous meshes to avoid WebGL memory leaks
    while (group.children.length > 0) {
      const child = group.children[0] as THREE.Mesh;
      group.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else if (child.material) {
        child.material.dispose();
      }
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
        side: THREE.DoubleSide
      });

      const mesh = new THREE.Mesh(bufferGeometry, material);
      mesh.castShadow = !isTransparent;
      mesh.receiveShadow = true;

      // Apply transformation matrix
      if (geom.matrix && geom.matrix.length === 16) {
        const mat = new THREE.Matrix4().fromArray(geom.matrix);
        mesh.applyMatrix4(mat);
      }

      mesh.userData = {
        expressID: geom.expressID,
        type: geom.type
      };

      group.add(mesh);

      // Track by expressID
      const existing = meshMapRef.current.get(geom.expressID) || [];
      existing.push(mesh);
      meshMapRef.current.set(geom.expressID, existing);

      // Expand bounding box
      mesh.geometry.computeBoundingBox();
      if (mesh.geometry.boundingBox) {
        const transformedBox = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
        box.union(transformedBox);
      }
    });

    // Fit camera to model
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

  // Handle Selection & TransformControls Attachment
  useEffect(() => {
    const scene = sceneRef.current;
    const tControls = transformControlsRef.current;
    if (!scene || !tControls) return;

    if (bboxHelperRef.current) {
      scene.remove(bboxHelperRef.current);
      bboxHelperRef.current = null;
    }

    if (selectedExpressID === null) {
      tControls.detach();
      return;
    }

    const meshes = meshMapRef.current.get(selectedExpressID);
    if (!meshes || meshes.length === 0) {
      tControls.detach();
      return;
    }

    const primaryMesh = meshes[0];

    // Bounding box helper
    const bbox = new THREE.BoxHelper(primaryMesh, 0x38bdf8);
    scene.add(bbox);
    bboxHelperRef.current = bbox;

    // Attach TransformControls if transformMode !== 'select'
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
  }, [selectedExpressID, transformMode, snapEnabled, onTransformChange]);

  // Keyboard shortcuts (Q = select, W = translate, E = rotate, R = scale, X = snap)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
        case 'q':
          onSetTransformMode('select');
          break;
        case 'w':
          onSetTransformMode('translate');
          break;
        case 'e':
          onSetTransformMode('rotate');
          break;
        case 'r':
          onSetTransformMode('scale');
          break;
        case 'x':
          onToggleSnap();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSetTransformMode, onToggleSnap]);

  // Click Raycasting for Selection
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

      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const expressID = hit.userData.expressID as number;
        onSelectElement(expressID);
      } else {
        onSelectElement(null);
      }
    },
    [onSelectElement]
  );

  return (
    <div className="relative w-full h-full overflow-hidden select-none outline-none">
      {/* 3D Canvas */}
      <div
        ref={containerRef}
        onClick={handleClick}
        className="w-full h-full cursor-crosshair"
      />

      {/* Floating Viewport Pill: Transform Gizmo Controls */}
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
    </div>
  );
};
