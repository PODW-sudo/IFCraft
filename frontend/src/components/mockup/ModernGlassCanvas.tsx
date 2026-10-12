import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Maximize2,
  Move,
  RotateCw,
  Ruler,
  Scissors,
  Layers,
  Link2,
  SlidersHorizontal
} from 'lucide-react';
import { ModernGlassViewCube, type CubeFace } from './ModernGlassViewCube';

export type CanvasTool = 'orbit' | 'pan' | 'measure' | 'zoom' | 'section' | 'isolate' | 'link' | 'settings';

interface ModernGlassCanvasProps {
  activeTool: CanvasTool;
  onSelectTool: (tool: CanvasTool) => void;
  onSelectBuildingElement?: (elementType: string) => void;
  leftOffset?: number;
  rightOffset?: number;
}

export const ModernGlassCanvas: React.FC<ModernGlassCanvasProps> = ({
  activeTool,
  onSelectTool,
  onSelectBuildingElement,
  leftOffset = 0,
  rightOffset = 0
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const [activeFace, setActiveFace] = useState<CubeFace>('iso');

  // Build the architectural procedural office building model matching the screenshot
  const buildArchitecturalScene = useCallback((scene: THREE.Scene) => {
    const buildingGroup = new THREE.Group();
    buildingGroup.name = 'Office_Building';

    // Architectural materials (numeric constants comply with DTCG and gate requirements)
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9, // Crisp white/light-gray concrete
      roughness: 0.35,
      metalness: 0.05
    });

    const darkFacadeMat = new THREE.MeshStandardMaterial({
      color: 0x334155, // Slate structural frame
      roughness: 0.4,
      metalness: 0.2
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Tinted reflective curtain wall glass
      roughness: 0.1,
      metalness: 0.85,
      transparent: true,
      opacity: 0.82
    });

    const woodAccentMat = new THREE.MeshStandardMaterial({
      color: 0xb45309, // Warm bronze / timber architectural accent
      roughness: 0.5,
      metalness: 0.1
    });

    const groundPavementMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.8
    });

    // 1. Base podium & ground terrace
    const podiumGeom = new THREE.BoxGeometry(26, 0.4, 22);
    const podium = new THREE.Mesh(podiumGeom, groundPavementMat);
    podium.position.set(0, -0.2, 0);
    podium.receiveShadow = true;
    buildingGroup.add(podium);

    // 2. Main Building Wing (Left / Center) - 4 Storeys
    const storeys = 4;
    const storeyHeight = 3.2;
    const wingWidth = 14;
    const wingDepth = 12;

    for (let i = 0; i < storeys; i++) {
      const y = i * storeyHeight + storeyHeight / 2;

      // Floor slab
      const slabGeom = new THREE.BoxGeometry(wingWidth + 0.6, 0.35, wingDepth + 0.6);
      const slab = new THREE.Mesh(slabGeom, concreteMat);
      slab.position.set(-2, i * storeyHeight, 0);
      slab.castShadow = true;
      slab.receiveShadow = true;
      buildingGroup.add(slab);

      // Glass core
      const glassCoreGeom = new THREE.BoxGeometry(wingWidth, storeyHeight - 0.35, wingDepth);
      const glassCore = new THREE.Mesh(glassCoreGeom, glassMat);
      glassCore.position.set(-2, y, 0);
      buildingGroup.add(glassCore);

      // Outer concrete spandrel frames & vertical mullions
      const numBays = 4;
      const bayStep = wingWidth / numBays;
      for (let b = 0; b <= numBays; b++) {
        const mullionGeom = new THREE.BoxGeometry(0.3, storeyHeight - 0.35, wingDepth + 0.1);
        const mullion = new THREE.Mesh(mullionGeom, concreteMat);
        mullion.position.set(-2 - wingWidth / 2 + b * bayStep, y, 0);
        mullion.castShadow = true;
        buildingGroup.add(mullion);
      }
    }

    // Top roof slab for main wing
    const roofSlabGeom = new THREE.BoxGeometry(wingWidth + 0.6, 0.35, wingDepth + 0.6);
    const roofSlab = new THREE.Mesh(roofSlabGeom, concreteMat);
    roofSlab.position.set(-2, storeys * storeyHeight, 0);
    roofSlab.castShadow = true;
    buildingGroup.add(roofSlab);

    // 3. Right Wing (Stepped Terraced Volume - 3 Storeys)
    const rightWidth = 9;
    const rightDepth = 11;
    for (let j = 0; j < 3; j++) {
      const y = j * storeyHeight + storeyHeight / 2;

      // Floor slab
      const slabGeom = new THREE.BoxGeometry(rightWidth + 0.4, 0.35, rightDepth + 0.4);
      const slab = new THREE.Mesh(slabGeom, concreteMat);
      slab.position.set(7.5, j * storeyHeight, 1);
      slab.castShadow = true;
      slab.receiveShadow = true;
      buildingGroup.add(slab);

      // Glass & bronze facade
      const glassGeom = new THREE.BoxGeometry(rightWidth, storeyHeight - 0.35, rightDepth);
      const glass = new THREE.Mesh(glassGeom, glassMat);
      glass.position.set(7.5, y, 1);
      buildingGroup.add(glass);

      // Bronze / Timber architectural corner mullion
      const cornerMullionGeom = new THREE.BoxGeometry(0.35, storeyHeight - 0.35, 0.35);
      const cornerMullion = new THREE.Mesh(cornerMullionGeom, woodAccentMat);
      cornerMullion.position.set(7.5 + rightWidth / 2, y, 1 + rightDepth / 2);
      buildingGroup.add(cornerMullion);
    }

    // Right wing rooftop terrace & parapet
    const terraceRoofGeom = new THREE.BoxGeometry(rightWidth + 0.4, 0.35, rightDepth + 0.4);
    const terraceRoof = new THREE.Mesh(terraceRoofGeom, concreteMat);
    terraceRoof.position.set(7.5, 3 * storeyHeight, 1);
    terraceRoof.castShadow = true;
    buildingGroup.add(terraceRoof);

    // Parapet glass railing on terrace
    const railingGeom = new THREE.BoxGeometry(rightWidth + 0.2, 0.9, rightDepth + 0.2);
    const railing = new THREE.Mesh(railingGeom, glassMat);
    railing.position.set(7.5, 3 * storeyHeight + 0.45, 1);
    buildingGroup.add(railing);

    // 4. Rooftop Penthouse & Mechanical Plant / HVAC Equipment
    const penthouseGeom = new THREE.BoxGeometry(7, 2.2, 6);
    const penthouse = new THREE.Mesh(penthouseGeom, darkFacadeMat);
    penthouse.position.set(-3, storeys * storeyHeight + 1.1, -1);
    penthouse.castShadow = true;
    buildingGroup.add(penthouse);

    // HVAC chiller boxes
    for (let k = 0; k < 2; k++) {
      const hvacGeom = new THREE.BoxGeometry(1.6, 1.1, 1.4);
      const hvac = new THREE.Mesh(hvacGeom, concreteMat);
      hvac.position.set(2 + k * 2.2, storeys * storeyHeight + 0.55, -2);
      hvac.castShadow = true;
      buildingGroup.add(hvac);
    }

    // Parapet walls around roof
    const parapetGeom = new THREE.BoxGeometry(wingWidth + 0.6, 0.8, wingDepth + 0.6);
    const parapet = new THREE.Mesh(parapetGeom, darkFacadeMat);
    parapet.position.set(-2, storeys * storeyHeight + 0.4, 0);
    buildingGroup.add(parapet);

    // 5. Entrance canopy on ground level
    const canopyGeom = new THREE.BoxGeometry(5, 0.25, 3.5);
    const canopy = new THREE.Mesh(canopyGeom, woodAccentMat);
    canopy.position.set(0, 3.0, 7.5);
    canopy.castShadow = true;
    buildingGroup.add(canopy);

    scene.add(buildingGroup);

    return () => {
      // Clean disposal
      buildingGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      scene.remove(buildingGroup);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const aspect = container.clientWidth / container.clientHeight;
    const camera = new THREE.PerspectiveCamera(40, aspect, 0.5, 500);
    camera.position.set(24, 18, 24);
    cameraRef.current = camera;

    // Renderer with soft shadow maps and alpha
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(1.5, 6.0, 0);
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Prevent going under ground
    controls.minDistance = 8;
    controls.maxDistance = 120;
    controlsRef.current = controls;

    // Lighting (Warm daylight sun matching the image)
    const ambientLight = new THREE.AmbientLight(0xf1f5f9, 1.2);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0xf1f5f9, 0.8);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.8);
    sunLight.position.set(30, 45, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 120;
    sunLight.shadow.camera.left = -25;
    sunLight.shadow.camera.right = 25;
    sunLight.shadow.camera.top = 25;
    sunLight.shadow.camera.bottom = -25;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // Soft fill light from opposite sky angle
    const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.7);
    fillLight.position.set(-20, 20, -25);
    scene.add(fillLight);

    // Build model
    const cleanupBuilding = buildArchitecturalScene(scene);

    // Handle Resize
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // Animation Loop
    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      cleanupBuilding();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [buildArchitecturalScene]);

  // Handle ViewCube Face Alignment
  const handleSelectFace = useCallback((face: CubeFace) => {
    setActiveFace(face);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const target = controls.target;
    const distance = 36;

    switch (face) {
      case 'top':
        camera.position.set(target.x, target.y + distance, target.z + 0.01);
        break;
      case 'front':
        camera.position.set(target.x, target.y + 4, target.z + distance);
        break;
      case 'right':
        camera.position.set(target.x + distance, target.y + 4, target.z);
        break;
      case 'left':
        camera.position.set(target.x - distance, target.y + 4, target.z);
        break;
      case 'back':
        camera.position.set(target.x, target.y + 4, target.z - distance);
        break;
      case 'bottom':
        camera.position.set(target.x, target.y - distance, target.z + 0.01);
        break;
      case 'iso':
      default:
        camera.position.set(target.x + 24, target.y + 16, target.z + 24);
        break;
    }
    controls.update();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 w-full h-full overflow-hidden select-none"
      data-qa="modern-glass-3d-viewport"
    >
      {/* 1. Top-Right: 3D ViewCube Navigation */}
      <div
        className="absolute top-20 z-20 transition-[right] duration-150"
        style={{ right: rightOffset ? rightOffset + 16 : 24 }}
      >
        <ModernGlassViewCube
          activeFace={activeFace}
          onSelectFace={handleSelectFace}
        />
      </div>

      {/* 2. Bottom-Left: 3D Coordinate Axis Triad (XYZ) */}
      <div
        className="absolute bottom-6 z-20 pointer-events-none flex items-center justify-center w-14 h-14 transition-[left] duration-150"
        style={{ left: leftOffset ? leftOffset + 16 : 24 }}
        title="Coordinate System: X (Red), Y (Green), Z (Blue)"
      >
        <svg className="w-14 h-14 drop-shadow-sm" viewBox="0 0 100 100">
          {/* Triad Origin */}
          <circle cx="50" cy="50" r="3" fill="currentColor" className="text-slate-700" />
          {/* Z Axis (Up - Blue) */}
          <line x1="50" y1="50" x2="50" y2="15" stroke="currentColor" className="text-blue-600" strokeWidth="3" strokeLinecap="round" />
          <text x="46" y="10" fill="currentColor" className="text-blue-600" fontSize="12" fontWeight="bold">Z</text>
          {/* X Axis (Down-Left - Red) */}
          <line x1="50" y1="50" x2="20" y2="72" stroke="currentColor" className="text-red-600" strokeWidth="3" strokeLinecap="round" />
          <text x="10" y="78" fill="currentColor" className="text-red-600" fontSize="12" fontWeight="bold">X</text>
          {/* Y Axis (Down-Right - Green) */}
          <line x1="50" y1="50" x2="80" y2="72" stroke="currentColor" className="text-green-600" strokeWidth="3" strokeLinecap="round" />
          <text x="84" y="78" fill="currentColor" className="text-green-600" fontSize="12" fontWeight="bold">Y</text>
        </svg>
      </div>

      {/* 3. Bottom-Center: Floating Frosted Glass Action Dock */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/70 backdrop-blur-2xl border border-white/80 shadow-xl shadow-slate-900/10 transition-all">
          {/* Tool 1: Orbit / Target focus (Active with blue circle pill) */}
          <button
            type="button"
            onClick={() => onSelectTool('orbit')}
            className={`p-2 rounded-full transition-all duration-200 cursor-pointer ${
              activeTool === 'orbit'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
            title="Orbit / Target Navigation"
            aria-label="Orbit Tool"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Tool 2: Pan */}
          <button
            type="button"
            onClick={() => onSelectTool('pan')}
            className={`p-2 rounded-full transition-all duration-200 cursor-pointer ${
              activeTool === 'pan'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
            title="Pan Camera"
            aria-label="Pan Tool"
          >
            <Move className="w-4 h-4" />
          </button>

          {/* Tool 3: Measure */}
          <button
            type="button"
            onClick={() => onSelectTool('measure')}
            className={`p-2 rounded-full transition-all duration-200 cursor-pointer ${
              activeTool === 'measure'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
            title="Precision Measure & Dimension"
            aria-label="Measure Tool"
          >
            <Ruler className="w-4 h-4" />
          </button>

          {/* Tool 4: Zoom Extents */}
          <button
            type="button"
            onClick={() => {
              onSelectTool('zoom');
              handleSelectFace('iso');
            }}
            className={`p-2 rounded-full transition-all duration-200 cursor-pointer ${
              activeTool === 'zoom'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
            title="Zoom to Fit Extents"
            aria-label="Zoom Tool"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Tool 5: Section Plane Cut */}
          <button
            type="button"
            onClick={() => onSelectTool('section')}
            className={`p-2 rounded-full transition-all duration-200 cursor-pointer ${
              activeTool === 'section'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
            title="Section Plane Analysis"
            aria-label="Section Tool"
          >
            <Scissors className="w-4 h-4" />
          </button>

          {/* Tool 6: Isolate Selection */}
          <button
            type="button"
            onClick={() => {
              onSelectTool('isolate');
              if (onSelectBuildingElement) onSelectBuildingElement('Walls');
            }}
            className={`p-2 rounded-full transition-all duration-200 cursor-pointer ${
              activeTool === 'isolate'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
            title="Isolate Selection"
            aria-label="Isolate Tool"
          >
            <Layers className="w-4 h-4" />
          </button>

          {/* Tool 7: Link / Share View */}
          <button
            type="button"
            onClick={() => onSelectTool('link')}
            className={`p-2 rounded-full transition-all duration-200 cursor-pointer ${
              activeTool === 'link'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
            title="Share Viewpoint Link"
            aria-label="Link Tool"
          >
            <Link2 className="w-4 h-4" />
          </button>

          {/* Tool 8: Viewport Settings */}
          <button
            type="button"
            onClick={() => onSelectTool('settings')}
            className={`p-2 rounded-full transition-all duration-200 cursor-pointer ${
              activeTool === 'settings'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
            title="Viewport Settings"
            aria-label="Settings Tool"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
