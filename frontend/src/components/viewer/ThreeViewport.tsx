import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { GeometryData } from '../../types/ifc';

interface ThreeViewportProps {
  geometries: GeometryData[];
  selectedExpressID: number | null;
  onSelectElement: (expressID: number | null) => void;
  hiddenCategories: Set<string>;
  isolatedExpressID: number | null;
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
  isolatedExpressID
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshesGroupRef = useRef<THREE.Group | null>(null);
  const meshMapRef = useRef<Map<number, THREE.Mesh[]>>(new Map());
  const highlightMeshRef = useRef<THREE.Mesh | null>(null);
  const bboxHelperRef = useRef<THREE.BoxHelper | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

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

    // 5. Lighting
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

    // 6. Grid Helper
    const gridHelper = new THREE.GridHelper(50, 50, 0x38bdf8, 0x262a33);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    // 7. Group for IFC Meshes
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
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update Geometry Meshes when geometries prop changes
  useEffect(() => {
    const scene = sceneRef.current;
    const group = meshesGroupRef.current;
    if (!scene || !group) return;

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

    if (highlightMeshRef.current) {
      scene.remove(highlightMeshRef.current);
      highlightMeshRef.current = null;
    }
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

  // Handle Selection Highlight
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (bboxHelperRef.current) {
      scene.remove(bboxHelperRef.current);
      bboxHelperRef.current = null;
    }

    if (selectedExpressID === null) return;

    const meshes = meshMapRef.current.get(selectedExpressID);
    if (!meshes || meshes.length === 0) return;

    const primaryMesh = meshes[0];
    const bbox = new THREE.BoxHelper(primaryMesh, 0x38bdf8);
    scene.add(bbox);
    bboxHelperRef.current = bbox;
  }, [selectedExpressID]);

  // Click Raycasting for Selection
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
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
    <div
      ref={containerRef}
      onClick={handleClick}
      className="relative w-full h-full cursor-crosshair overflow-hidden select-none outline-none"
    />
  );
};
