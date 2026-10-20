import React, { useEffect, useRef, useState } from 'react';
import {
  Viewer,
  SceneModel,
  NavCubePlugin,
  StoreyViewsPlugin,
  BCFViewpointsPlugin,
  AnnotationsPlugin,
  FastNavPlugin,
  SectionPlanesPlugin
} from '@xeokit/xeokit-sdk';
import type { GeometryData, SpatialNode } from '../../types/ifc';
import type {
  CameraPreset,
  RenderStyle,
  SectionPlaneConfig,
  XeokitAnnotationRecord,
  StoreyViewRecord
} from '../../types/viewport';
import { XEOKIT_NAVCUBE_COLORS } from '../../types/settings';
import { MapPin, Zap } from 'lucide-react';

interface XeokitViewportProps {
  geometries: GeometryData[];
  selectedExpressID: number | null;
  onSelectElement: (expressID: number | null) => void;
  isolatedExpressID: number | null;
  hiddenCategories: Set<string>;
  theme?: 'light' | 'dark';
  sectionConfig: SectionPlaneConfig;
  cameraPresetTrigger?: { preset: CameraPreset; timestamp: number } | null;
  renderStyle: RenderStyle;
  spatialTree: SpatialNode | null;
  annotations?: XeokitAnnotationRecord[];
  onSelectAnnotation?: (id: string) => void;
  onAddAnnotationPoint?: (point: [number, number, number], expressId?: number) => void;
  isAnnotateMode?: boolean;
  onStoreysLoaded?: (storeys: StoreyViewRecord[]) => void;
  activeStoreyId?: string | null;
  leftOffset?: number;
  rightOffset?: number;
}

export const XeokitViewport: React.FC<XeokitViewportProps> = ({
  geometries,
  selectedExpressID,
  onSelectElement,
  isolatedExpressID,
  hiddenCategories,
  theme = 'light',
  sectionConfig,
  cameraPresetTrigger,
  renderStyle,
  spatialTree,
  annotations = [],
  onSelectAnnotation,
  onAddAnnotationPoint,
  isAnnotateMode = false,
  onStoreysLoaded,
  activeStoreyId,
  leftOffset = 0,
  rightOffset = 0
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const navCubeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewerRef = useRef<any>(null);
  const navCubeRef = useRef<any>(null);
  const fastNavRef = useRef<any>(null);
  const storeyViewsRef = useRef<any>(null);
  const bcfPluginRef = useRef<any>(null);
  const annotationsPluginRef = useRef<any>(null);
  const sectionPlanesRef = useRef<any>(null);
  const activeSectionIdRef = useRef<string | null>(null);
  const modelLoadedRef = useRef<boolean>(false);
  const [fastNavActive] = useState(true);
  const [fpsReadout, setFpsReadout] = useState<number>(60);
  const [viewerInstance, setViewerInstance] = useState<any>(null);

  // Initialize Xeokit Viewer and Core Plugins
  useEffect(() => {
    if (!canvasRef.current || !navCubeCanvasRef.current) return;

    try {
      const viewer = new Viewer({
        canvasElement: canvasRef.current,
        transparent: true,
        pbrEnabled: true,
        saoEnabled: true,
        colorTextureEnabled: true
      });

      viewerRef.current = viewer;
      setViewerInstance(viewer);
      if (typeof window !== 'undefined') {
        (window as any).__XEOKIT_VIEWER__ = viewer;
      }

      // 1. Genuine Xeokit 3D NavCube Plugin
      const cubePalette = theme === 'dark' ? XEOKIT_NAVCUBE_COLORS.dark : XEOKIT_NAVCUBE_COLORS.light;
      const navCube = new NavCubePlugin(viewer, {
        canvasElement: navCubeCanvasRef.current,
        visible: true,
        cameraFly: true,
        cameraFlyDuration: 0.45,
        color: cubePalette.color,
        frontColor: cubePalette.frontColor,
        textColor: cubePalette.textColor,
        hoverColor: cubePalette.hoverColor,
        fitVisible: true,
        synchProjection: true
      });
      navCubeRef.current = navCube;

      // 2. Xeokit FastNav 60fps Optimizer
      const fastNav = new FastNavPlugin(viewer, {
        hideEdges: true,
        hidePBR: true,
        hideSAO: true,
        hideColorTexture: true
      });
      fastNavRef.current = fastNav;

      // 3. StoreyViewsPlugin for IFC Building Storey visualization
      const storeyViews = new StoreyViewsPlugin(viewer);
      storeyViewsRef.current = storeyViews;

      // 4. BCFViewpointsPlugin for standard BCF 2.1 interchange
      const bcfPlugin = new BCFViewpointsPlugin(viewer, {
        originatingSystem: 'IFC Editor AEC',
        authoringTool: 'IFC Editor Xeokit Studio'
      });
      bcfPluginRef.current = bcfPlugin;

      // 5. AnnotationsPlugin for 3D spatial markers
      const annotationsPlugin = new AnnotationsPlugin(viewer, {});
      annotationsPluginRef.current = annotationsPlugin;

      annotationsPlugin.on('markerClicked', (annotation: any) => {
        if (annotation?.id && onSelectAnnotation) {
          onSelectAnnotation(annotation.id);
        }
      });

      // 6. SectionPlanesPlugin for dynamic cross-section slicing
      const sectionPlanes = new SectionPlanesPlugin(viewer);
      sectionPlanesRef.current = sectionPlanes;

      // Selection Raycasting via cameraControl
      viewer.cameraControl.on('picked', (pickResult: any) => {
        if (isAnnotateMode && pickResult?.worldPos && onAddAnnotationPoint) {
          const expressId = pickResult.entity?.id ? Number(pickResult.entity.id) : undefined;
          onAddAnnotationPoint(
            [pickResult.worldPos[0], pickResult.worldPos[1], pickResult.worldPos[2]],
            expressId
          );
          return;
        }

        if (pickResult?.entity?.id) {
          const parsed = Number(pickResult.entity.id);
          onSelectElement(isNaN(parsed) ? null : parsed);
        } else {
          onSelectElement(null);
        }
      });

      viewer.cameraControl.on('pickedNothing', () => {
        if (!isAnnotateMode) {
          onSelectElement(null);
        }
      });

      // Frame rate estimation ticker
      let frameCount = 0;
      let lastTime = performance.now();
      const tickSub = viewer.scene.on('tick', () => {
        frameCount++;
        const now = performance.now();
        if (now - lastTime >= 1000) {
          setFpsReadout(Math.round((frameCount * 1000) / (now - lastTime)));
          frameCount = 0;
          lastTime = now;
        }
      });

      // Fit camera initially
      viewer.cameraFlight.flyTo({
        eye: [15, 12, 18],
        look: [0, 0, 0],
        up: [0, 1, 0],
        duration: 0.1
      });

      return () => {
        viewer.scene.off(tickSub);
        try {
          if (navCubeRef.current) navCubeRef.current.destroy();
          if (fastNavRef.current) fastNavRef.current.destroy();
          if (storeyViewsRef.current) storeyViewsRef.current.destroy();
          if (bcfPluginRef.current) bcfPluginRef.current.destroy();
          if (annotationsPluginRef.current) annotationsPluginRef.current.destroy();
          if (sectionPlanesRef.current) sectionPlanesRef.current.destroy();
          viewer.destroy();
        } catch (e) {
          console.warn('Error destroying Xeokit viewer:', e);
        }
        viewerRef.current = null;
        setViewerInstance(null);
        if (typeof window !== 'undefined' && (window as any).__XEOKIT_VIEWER__ === viewer) {
          (window as any).__XEOKIT_VIEWER__ = null;
        }
        navCubeRef.current = null;
        fastNavRef.current = null;
        storeyViewsRef.current = null;
        bcfPluginRef.current = null;
        annotationsPluginRef.current = null;
        sectionPlanesRef.current = null;
      };
    } catch (err) {
      console.error('Failed to initialize Xeokit Viewer:', err);
    }
  }, []);

  // Update NavCube theme colors dynamically
  useEffect(() => {
    if (!navCubeRef.current) return;
    const cubePalette = theme === 'dark' ? XEOKIT_NAVCUBE_COLORS.dark : XEOKIT_NAVCUBE_COLORS.light;
    navCubeRef.current.color = cubePalette.color;
    navCubeRef.current.frontColor = cubePalette.frontColor;
    navCubeRef.current.textColor = cubePalette.textColor;
    navCubeRef.current.hoverColor = cubePalette.hoverColor;
  }, [theme]);

  // Load Geometries into Xeokit SceneModel
  useEffect(() => {
    const viewer = viewerRef.current || viewerInstance;
    if (!viewer) return;

    if (geometries.length === 0) {
      const existing = viewer.scene.models['ifcModel'];
      if (existing) existing.destroy();
      return;
    }

    try {
      const existingModel = viewer.scene.models['ifcModel'];
      if (existingModel) {
        existingModel.destroy();
      }

      const sceneModel = new SceneModel(viewer.scene, {
        id: 'ifcModel',
        isModel: true,
        edges: true
      });

      // Group geometries by expressID so each entity in Xeokit has a unique ID
      const expressMap = new Map<number, GeometryData[]>();
      for (let i = 0; i < geometries.length; i++) {
        const geom = geometries[i];
        const list = expressMap.get(geom.expressID) || [];
        list.push(geom);
        expressMap.set(geom.expressID, list);
      }

      expressMap.forEach((geomList, expressId) => {
        const meshIds: string[] = [];

        geomList.forEach((geom, idx) => {
          const meshId = `mesh_${expressId}_${idx}`;
          const col = geom.color;
          const r = col ? col[0] : 0.75;
          const g = col ? col[1] : 0.75;
          const b = col ? col[2] : 0.75;
          const a = col && col[3] !== undefined ? col[3] : 1.0;

          (sceneModel as any).createMesh({
            id: meshId,
            primitive: 'triangles',
            positions: Array.from(geom.positions),
            indices: Array.from(geom.indices),
            matrix: geom.matrix && geom.matrix.length === 16 ? Array.from(geom.matrix) : undefined,
            color: [r, g, b],
            opacity: a
          });

          meshIds.push(meshId);
        });

        (sceneModel as any).createEntity({
          id: String(expressId),
          meshIds,
          isObject: true
        });
      });

      sceneModel.finalize();
      modelLoadedRef.current = true;

      // Extract and register Spatial MetaModel for StoreyViewsPlugin
      if (spatialTree) {
        const metaObjects: any[] = [];
        const storeysFound: StoreyViewRecord[] = [];

        const traverse = (node: SpatialNode, parentId?: string) => {
          const id = String(node.express_id);
          const type = node.type || 'IfcProduct';
          metaObjects.push({
            id,
            name: node.name || `${type} #${id}`,
            type,
            parent: parentId
          });

          if (type === 'IfcBuildingStorey') {
            storeysFound.push({
              id,
              name: node.name || `Storey #${id}`,
              elevation: 0,
              elementCount: node.children ? node.children.length : 0
            });
          }

          if (node.children) {
            for (const child of node.children) {
              traverse(child, id);
            }
          }
        };

        traverse(spatialTree);

        try {
          if (viewer.metaScene.metaModels['ifcModel']) {
            viewer.metaScene.destroyMetaModel('ifcModel');
          }
          viewer.metaScene.createMetaModel('ifcModel', { metaObjects });
          if (onStoreysLoaded && storeysFound.length > 0) {
            onStoreysLoaded(storeysFound);
          }
        } catch (mErr) {
          console.warn('Could not register MetaModel in Xeokit:', mErr);
        }
      }

      // Automatically fit camera to model bounds
      const aabb = sceneModel.aabb;
      if (aabb && aabb[3] >= aabb[0]) {
        viewer.cameraFlight.jumpTo({
          aabb
        });
      }
    } catch (err) {
      console.error('Error populating Xeokit SceneModel:', err);
    }
  }, [viewerInstance, geometries, spatialTree]);

  // Synchronize Element Selection & Highlighting
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !modelLoadedRef.current) return;

    try {
      viewer.scene.setObjectsSelected(viewer.scene.selectedObjectIds, false);
      if (selectedExpressID !== null) {
        viewer.scene.setObjectsSelected([String(selectedExpressID)], true);
      }
    } catch {}
  }, [selectedExpressID]);

  // Synchronize Category Filtering & Isolation
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !modelLoadedRef.current) return;

    try {
      if (isolatedExpressID !== null) {
        for (const geom of geometries) {
          const isTarget = geom.expressID === isolatedExpressID;
          viewer.scene.setObjectsVisible([String(geom.expressID)], isTarget);
        }
        return;
      }

      for (const geom of geometries) {
        const isHidden = hiddenCategories.has(geom.type);
        viewer.scene.setObjectsVisible([String(geom.expressID)], !isHidden);
      }
    } catch {}
  }, [isolatedExpressID, hiddenCategories, geometries]);

  // Synchronize Render Styles (shaded, wireframe, ghost)
  // Synchronize Render Styles (transparent, solid, wireframe, shadowed, materials)
  useEffect(() => {
    const viewer = viewerRef.current || viewerInstance;
    if (!viewer) return;

    try {
      const allIds = geometries.map((g) => String(g.expressID));

      if (renderStyle === 'transparent' || renderStyle === 'ghost') {
        // 1. Transparent with Solid Edges (Architectural Ghost Contours)
        if (allIds.length > 0) viewer.scene.setObjectsXRayed(allIds, true);
        if (viewer.scene.xrayMaterial) {
          viewer.scene.xrayMaterial.fill = true;
          viewer.scene.xrayMaterial.fillAlpha = 0.25;
          viewer.scene.xrayMaterial.fillColor = [0.65, 0.75, 0.88];
          viewer.scene.xrayMaterial.edges = true;
          viewer.scene.xrayMaterial.edgeAlpha = 1.0;
          viewer.scene.xrayMaterial.edgeColor = theme === 'dark' ? [0.65, 0.75, 0.9] : [0.12, 0.16, 0.24];
          viewer.scene.xrayMaterial.edgeWidth = 2;
        }
        if (viewer.scene.edgeMaterial) {
          viewer.scene.edgeMaterial.edges = true;
          viewer.scene.edgeMaterial.edgeAlpha = 1.0;
        }
        if (viewer.scene.sao) viewer.scene.sao.enabled = false;
        viewer.scene.pbrEnabled = false;

      } else if (renderStyle === 'wireframe') {
        // 2. Wireframe CAD
        if (allIds.length > 0) viewer.scene.setObjectsXRayed(allIds, true);
        if (viewer.scene.xrayMaterial) {
          viewer.scene.xrayMaterial.fill = false;
          viewer.scene.xrayMaterial.fillAlpha = 0.0;
          viewer.scene.xrayMaterial.edges = true;
          viewer.scene.xrayMaterial.edgeAlpha = 1.0;
          viewer.scene.xrayMaterial.edgeColor = theme === 'dark' ? [0.25, 0.75, 1.0] : [0.08, 0.12, 0.2];
          viewer.scene.xrayMaterial.edgeWidth = 1.5;
        }
        if (viewer.scene.edgeMaterial) {
          viewer.scene.edgeMaterial.edges = true;
          viewer.scene.edgeMaterial.edgeAlpha = 1.0;
        }
        if (viewer.scene.sao) viewer.scene.sao.enabled = false;
        viewer.scene.pbrEnabled = false;

      } else if (renderStyle === 'shadowed') {
        // 3. Shadowed (Scalable Ambient Obscurance & Depth Occlusion)
        if (allIds.length > 0) {
          viewer.scene.setObjectsXRayed(allIds, false);
          viewer.scene.setObjectsOpacity(allIds, 1.0);
        }
        if (viewer.scene.xrayMaterial) {
          viewer.scene.xrayMaterial.fill = false;
          viewer.scene.xrayMaterial.edges = false;
        }
        if (viewer.scene.sao) {
          viewer.scene.sao.enabled = true;
          viewer.scene.sao.intensity = 0.7;
          viewer.scene.sao.bias = 0.5;
          viewer.scene.sao.scale = 1.0;
          viewer.scene.sao.kernelRadius = 70;
          viewer.scene.sao.blur = true;
        }
        if (viewer.scene.edgeMaterial) {
          viewer.scene.edgeMaterial.edges = true;
          viewer.scene.edgeMaterial.edgeAlpha = 0.5;
          viewer.scene.edgeMaterial.edgeColor = [0.1, 0.1, 0.1];
        }
        viewer.scene.pbrEnabled = false;

      } else if (renderStyle === 'materials') {
        // 4. Authentic BIM Materials (PBR pipeline)
        if (allIds.length > 0) {
          viewer.scene.setObjectsXRayed(allIds, false);
          viewer.scene.setObjectsOpacity(allIds, 1.0);
        }
        if (viewer.scene.xrayMaterial) {
          viewer.scene.xrayMaterial.fill = false;
          viewer.scene.xrayMaterial.edges = false;
        }
        viewer.scene.pbrEnabled = true;
        viewer.scene.colorTextureEnabled = true;
        if (viewer.scene.sao) {
          viewer.scene.sao.enabled = true;
          viewer.scene.sao.intensity = 0.35;
        }
        if (viewer.scene.edgeMaterial) {
          viewer.scene.edgeMaterial.edges = true;
          viewer.scene.edgeMaterial.edgeAlpha = 0.35;
          viewer.scene.edgeMaterial.edgeColor = [0.2, 0.2, 0.2];
        }

      } else {
        // 5. Solid CAD Mode (Default / Shaded / Discipline / Diff)
        if (allIds.length > 0) {
          viewer.scene.setObjectsXRayed(allIds, false);
          viewer.scene.setObjectsOpacity(allIds, 1.0);
        }
        if (viewer.scene.xrayMaterial) {
          viewer.scene.xrayMaterial.fill = false;
          viewer.scene.xrayMaterial.edges = false;
        }
        if (viewer.scene.edgeMaterial) {
          viewer.scene.edgeMaterial.edges = true;
          viewer.scene.edgeMaterial.edgeAlpha = 0.8;
          viewer.scene.edgeMaterial.edgeColor = [0.15, 0.15, 0.15];
        }
        if (viewer.scene.sao) viewer.scene.sao.enabled = false;
        viewer.scene.pbrEnabled = false;
      }
    } catch (err) {
      console.warn('Failed to apply Xeokit render style:', err);
    }
  }, [viewerInstance, renderStyle, geometries, theme]);

  // Synchronize Camera Presets
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !cameraPresetTrigger) return;

    const aabb = viewer.scene.aabb;
    const center = [
      (aabb[0] + aabb[3]) / 2,
      (aabb[1] + aabb[4]) / 2,
      (aabb[2] + aabb[5]) / 2
    ];
    const dx = aabb[3] - aabb[0];
    const dy = aabb[4] - aabb[1];
    const dz = aabb[5] - aabb[2];
    const maxDim = Math.max(dx, dy, dz, 5);
    const dist = maxDim * 1.8;

    switch (cameraPresetTrigger.preset) {
      case 'top':
        viewer.cameraFlight.flyTo({
          eye: [center[0], center[1] + dist, center[2]],
          look: center,
          up: [0, 0, -1],
          duration: 0.4
        });
        break;
      case 'front':
        viewer.cameraFlight.flyTo({
          eye: [center[0], center[1], center[2] + dist],
          look: center,
          up: [0, 1, 0],
          duration: 0.4
        });
        break;
      case 'side':
        viewer.cameraFlight.flyTo({
          eye: [center[0] + dist, center[1], center[2]],
          look: center,
          up: [0, 1, 0],
          duration: 0.4
        });
        break;
      case 'iso':
      default:
        viewer.cameraFlight.flyTo({
          eye: [center[0] + dist * 0.7, center[1] + dist * 0.7, center[2] + dist * 0.7],
          look: center,
          up: [0, 1, 0],
          duration: 0.4
        });
        break;
    }
  }, [cameraPresetTrigger]);

  // Synchronize Section Planes
  useEffect(() => {
    const sectionPlanes = sectionPlanesRef.current;
    if (!sectionPlanes) return;

    try {
      if (activeSectionIdRef.current) {
        sectionPlanes.destroySectionPlane(activeSectionIdRef.current);
        activeSectionIdRef.current = null;
      }

      if (sectionConfig.enabled) {
        let dir = [0, -1, 0];
        let pos = [0, sectionConfig.position, 0];

        if (sectionConfig.axis === 'x') {
          dir = [sectionConfig.inverted ? 1 : -1, 0, 0];
          pos = [sectionConfig.position, 0, 0];
        } else if (sectionConfig.axis === 'y') {
          dir = [0, sectionConfig.inverted ? 1 : -1, 0];
          pos = [0, sectionConfig.position, 0];
        } else if (sectionConfig.axis === 'z') {
          dir = [0, 0, sectionConfig.inverted ? 1 : -1];
          pos = [0, 0, sectionConfig.position];
        }

        const sp = sectionPlanes.createSectionPlane({
          id: 'xeokit_clipping_plane',
          pos,
          dir,
          active: true
        });
        activeSectionIdRef.current = sp.id;
      }
    } catch (err) {
      console.warn('Could not update Xeokit section plane:', err);
    }
  }, [sectionConfig]);

  // Synchronize 3D Spatial Annotations
  useEffect(() => {
    const annotationsPlugin = annotationsPluginRef.current;
    if (!annotationsPlugin) return;

    try {
      const existing = Object.keys(annotationsPlugin.annotations);
      for (const id of existing) {
        annotationsPlugin.destroyAnnotation(id);
      }

      for (const ann of annotations) {
        annotationsPlugin.createAnnotation({
          id: ann.id,
          worldPos: ann.worldPos,
          markerHTML: `<div class="w-4 h-4 rounded-full bg-cyan-500 border-2 border-white shadow-lg cursor-pointer transform -translate-x-1/2 -translate-y-1/2 hover:scale-125 transition-transform" title="${ann.title}"></div>`,
          values: {
            title: ann.title,
            description: ann.description
          }
        });
      }
    } catch (err) {
      console.warn('Error syncing Xeokit annotations:', err);
    }
  }, [annotations]);

  // Active Storey Navigation
  useEffect(() => {
    const storeyViews = storeyViewsRef.current;
    if (!storeyViews || !activeStoreyId) return;

    try {
      if (storeyViews.storeys && storeyViews.storeys[activeStoreyId]) {
        storeyViews.gotoStoreyCamera(activeStoreyId, { projection: 'ortho' });
      }
    } catch (err) {
      console.warn('Error navigating to storey in Xeokit:', err);
    }
  }, [activeStoreyId]);

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none"
      data-qa="xeokit-viewport-container"
    >
      {/* Primary Xeokit WebGL Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-crosshair touch-none"
        data-qa="xeokit-webgl-canvas"
      />

      {/* Xeokit Authentic 3D NavCube Plugin Canvas */}
      <div
        className="absolute top-20 z-20 pointer-events-auto rounded-2xl p-1 glass-card bg-[var(--glass-surface-card)] backdrop-blur-xl border border-[var(--glass-border)] shadow-2xl flex flex-col items-center transition-[right] duration-200"
        style={{ right: rightOffset ? rightOffset + 16 : 24 }}
        data-qa="xeokit-navcube-card"
      >
        <canvas
          ref={navCubeCanvasRef}
          width={110}
          height={110}
          className="cursor-pointer"
          data-qa="xeokit-navcube-canvas"
          title="Xeokit 3D NavCube - Click face, edge or corner to align camera"
        />
        <div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono text-[var(--text-secondary)] border-t border-[var(--border-subtle)] w-full justify-between">
          <span className="font-semibold text-cyan-600 dark:text-cyan-400">NAVCUBE</span>
          <span className="text-[9px] opacity-75">3D AEC</span>
        </div>
      </div>

      {/* Telemetry HUD: Xeokit AEC Engine Active */}
      <div
        className="absolute bottom-4 z-20 pointer-events-none flex items-center gap-2 px-3 py-1.5 rounded-full glass-card bg-[var(--glass-surface-card)] backdrop-blur-xl border border-[var(--glass-border)] shadow-xl text-xs text-[var(--text-secondary)] transition-[left] duration-200"
        style={{ left: leftOffset ? leftOffset + 16 : 16 }}
        data-qa="xeokit-telemetry-hud"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="font-semibold text-[var(--text-primary)]">Xeokit AEC Engine</span>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--control-bg)] border border-[var(--border-subtle)]">
          {fpsReadout} FPS
        </span>
        <span
          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--control-bg)] border border-[var(--border-subtle)] uppercase text-cyan-600 dark:text-cyan-400 font-semibold"
          data-qa="xeokit-render-style-badge"
          title={`Active Visual Style: ${renderStyle}`}
        >
          {renderStyle}
        </span>
        {fastNavActive && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-cyan-600 dark:text-cyan-400">
            <Zap className="w-3 h-3" />
            FastNav 60fps
          </span>
        )}
      </div>

      {/* Annotate Mode Indicator Banner */}
      {isAnnotateMode && (
        <div
          className="absolute top-20 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 rounded-full glass-card bg-[var(--glass-surface-card)] backdrop-blur-xl border border-cyan-500 text-xs font-medium text-cyan-700 dark:text-cyan-300 shadow-2xl flex items-center gap-2 pointer-events-none animate-in fade-in"
          data-qa="annotate-mode-banner"
        >
          <MapPin className="w-3.5 h-3.5 text-cyan-500 animate-bounce" />
          <span>Click anywhere on building model to drop a 3D annotation pin</span>
        </div>
      )}
    </div>
  );
};

export default XeokitViewport;
