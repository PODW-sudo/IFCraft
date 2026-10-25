import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  X,
  Plus,
  Trash2,
  Download,
  Printer,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Scissors,
  FileText,
  Building2,
  LayoutGrid,
  Move
} from 'lucide-react';
import type { GeometryData } from '../../types/ifc';
import type {
  BimView,
  DrawingSheet,
  SheetViewport,
  PaperSize,
  PaperOrientation,
  DrawingViewVectorData
} from '../../types/drawings';
import {
  PAPER_DIMENSIONS_MM,
  ARCHITECTURAL_SCALES
} from '../../types/drawings';
import {
  extractPlanViewVectorData,
  extractSectionViewVectorData,
  getSheetDimensions,
  exportSheetToSvg,
  downloadSvgFile,
  printSheet,
  buildViewportPathData,
  recomputeViewIds
} from '../../services/drawingEngine';
import {
  buildPlanViewsFromStoreys,
  chooseSheetScale,
  deleteSheetState
} from '../../services/drawingSheets';
import { createWheelZoom } from '../../services/wheelZoom';
import { useModalFocusTrap } from '../../hooks/modalFocus';
import { loadPersistedSheets, savePersistedSheets } from '../../services/drawingSheetStore';

interface DrawingSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  geometries: GeometryData[];
  storeys?: { id: number; name: string; elevation: number }[];
  projectName?: string;
  /**
   * Metres per project unit (`0.001` for a millimetre IFC file, `1` for a metre file).
   * Comes from the spatial tree's root node; defaults to `1` so metre-unit callers are unchanged.
   */
  unitScale?: number;
  /** Active project id; keys the local sheet/view persistence. Omit for an ephemeral composer. */
  projectId?: string | null;
  activeSectionCut?: { axis: 'x' | 'y' | 'z'; position: number };
}

/** Paper size the default plan/section viewports are laid out for. */
const VIEWPORT_SIZE_MM = { width: 175, height: 120 };

/** `requestAnimationFrame` with a timer fallback so a non-visual host (jsdom) still progresses. */
function scheduleFrame(callback: () => void): number {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(callback);
  return setTimeout(callback, 16) as unknown as number;
}

function cancelFrame(handle: number): void {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle);
  else clearTimeout(handle);
}

/**
 * Default section views. Module-level and frozen so their identity never changes between renders,
 * which keeps `recomputeViewIds` from mistaking them for edited views.
 */
const DEFAULT_SECTION_VIEWS: BimView[] = [
  {
    id: 'section-a',
    name: 'Section A-A (Cross)',
    type: 'section',
    cutPlane: { axis: 'x', position: 0 },
    scale: 100,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'section-b',
    name: 'Section B-B (Longitudinal)',
    type: 'section',
    cutPlane: { axis: 'z', position: 0 },
    scale: 100,
    createdAt: '2026-01-01T00:00:00.000Z'
  }
];

/** Lowest storey plan, i.e. the view a floor-plan sheet is expected to open with. */
function pickLowestPlanView(planViews: BimView[]): BimView {
  return planViews.reduce(
    (lowest, view) => ((view.elevation ?? 0) < (lowest.elevation ?? 0) ? view : lowest),
    planViews[0]
  );
}

/**
 * The sheet the composer seeds on first open: the loaded project's name, the lowest storey plan and
 * the cross section, at a scale that actually fits the viewport.
 */
function createDefaultSheet(
  projectName: string,
  planView: BimView,
  planScale: number
): DrawingSheet {
  return {
    id: 'sheet-1',
    sheetNumber: 'A-101',
    sheetTitle: 'FLOOR PLANS & SECTIONS',
    paperSize: 'A3',
    orientation: 'landscape',
    projectInfo: {
      projectName,
      projectNumber: 'PRJ-2026-01',
      client: 'Architectural Client',
      author: 'Lead Architect',
      date: new Date().toISOString().split('T')[0],
      revision: 'Rev A',
      status: 'Preliminary'
    },
    viewports: [
      {
        id: 'vp-1',
        viewId: planView.id,
        viewName: planView.name,
        viewType: 'plan',
        x: 35,
        y: 25,
        width: VIEWPORT_SIZE_MM.width,
        height: VIEWPORT_SIZE_MM.height,
        scale: planScale,
        detailNumber: 1,
        showTitle: true,
        showFrame: true
      },
      {
        id: 'vp-2',
        viewId: DEFAULT_SECTION_VIEWS[0].id,
        viewName: DEFAULT_SECTION_VIEWS[0].name,
        viewType: 'section',
        x: 220,
        y: 25,
        width: VIEWPORT_SIZE_MM.width,
        height: VIEWPORT_SIZE_MM.height,
        scale: 100,
        detailNumber: 2,
        showTitle: true,
        showFrame: true
      }
    ]
  };
}

export const DrawingSheetsModal: React.FC<DrawingSheetsModalProps> = ({
  isOpen,
  onClose,
  geometries,
  storeys = [],
  projectName = 'BIM Project',
  unitScale = 1,
  projectId = null,
  activeSectionCut
}) => {
  // 1. Views are DERIVED from the loaded model, never frozen at mount (F-028).
  //    Custom views the user creates are the only view state this component owns.
  //
  //    The derivation is keyed on the *content* of the storey list, not on the identity of the
  //    array the parent passes: a parent that rebuilds its array on every render would otherwise
  //    re-derive on every render, and the seeding effect below would never settle.
  const storeysRef = useRef(storeys);
  storeysRef.current = storeys;
  const viewsCreatedAtRef = useRef(new Date().toISOString());
  const storeysKey = storeys
    .map((s) => `${s.id}:${s.name}:${s.elevation ?? 0}`)
    .join('|');

  const planViews = useMemo(
    () => buildPlanViewsFromStoreys(storeysRef.current, unitScale, viewsCreatedAtRef.current),
    [storeysKey, unitScale]
  );
  const [customViews, setCustomViews] = useState<BimView[]>([]);

  const views = useMemo(
    () => [...planViews, ...DEFAULT_SECTION_VIEWS, ...customViews],
    [planViews, customViews]
  );

  // 2. Sheets: seeded on first open from the current props, then owned by the user.
  const [sheets, setSheets] = useState<DrawingSheet[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string>('');
  const [selectedViewportId, setSelectedViewportId] = useState<string | null>(null);
  /** Set as soon as the user touches a sheet, so a re-derivation can never clobber an edit. */
  const hasUserSheetEditsRef = useRef(false);

  // Zoom & Pan for the interactive sheet canvas
  const [canvasZoom, setCanvasZoom] = useState<number>(1.2);
  const [canvasPan, setCanvasPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Viewport Dragging on Sheet State
  const [draggingVpId, setDraggingVpId] = useState<string | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; vpX: number; vpY: number }>({
    mouseX: 0,
    mouseY: 0,
    vpX: 0,
    vpY: 0
  });

  // New View Form State
  const [isAddingPlan, setIsAddingPlan] = useState(false);
  const [newPlanElevation, setNewPlanElevation] = useState<number>(1.2);
  const [newPlanName, setNewPlanName] = useState('New Plan View');

  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionAxis, setNewSectionAxis] = useState<'x' | 'z'>('z');
  const [newSectionPos, setNewSectionPos] = useState<number>(activeSectionCut ? activeSectionCut.position : 0);
  const [newSectionName, setNewSectionName] = useState('Section C-C');

  // Vector Data Cache: viewId -> DrawingViewVectorData.
  // State drives rendering; the ref is the source of truth for merges so a batched update can
  // never read a stale state value.
  const [vectorCache, setVectorCache] = useState<Map<string, DrawingViewVectorData>>(new Map());
  const vectorCacheRef = useRef<Map<string, DrawingViewVectorData>>(new Map());
  const viewsRef = useRef<BimView[] | null>(null);
  const geometriesRef = useRef<GeometryData[] | null>(null);
  const pendingViewIdsRef = useRef<string[]>([]);
  const frameRef = useRef<number | null>(null);

  // Active sheet reference
  const currentSheet = useMemo(() => {
    return sheets.find((s) => s.id === activeSheetId) || sheets[0];
  }, [sheets, activeSheetId]);

  // A different geometry set is a full invalidation (model reload), not a view edit: drop the whole
  // cache so a stale entry can never outlive the geometry it was cut from.
  useEffect(() => {
    if (!isOpen) return;
    if (geometriesRef.current === geometries) return;
    geometriesRef.current = geometries;
    vectorCacheRef.current = new Map();
    setVectorCache(new Map());
  }, [isOpen, geometries]);

  // Compute or retrieve vector data for the views that actually need it.
  // Only the id list returned by `recomputeViewIds` is recomputed, the cache merge is additive, and
  // at most one view is computed per animation frame so a 6-view sheet does not block the modal.
  useEffect(() => {
    if (!isOpen || geometries.length === 0) return;

    const staleIds = recomputeViewIds(viewsRef.current, views, vectorCacheRef.current);
    viewsRef.current = views;
    if (staleIds.length === 0) return;

    const viewsById = new Map(views.map((v) => [v.id, v]));
    pendingViewIdsRef.current = staleIds;

    const computeNext = () => {
      frameRef.current = null;
      const id = pendingViewIdsRef.current.shift();
      const view = id ? viewsById.get(id) : undefined;

      if (id && view) {
        const data = view.type === 'plan'
          ? extractPlanViewVectorData(geometries, view.cutPlane.position, view.id)
          : extractSectionViewVectorData(
              geometries,
              view.cutPlane.axis === 'x' ? 'x' : 'z',
              view.cutPlane.position,
              view.id
            );

        // Additive merge: only this view's entry is replaced, every other entry keeps its identity.
        vectorCacheRef.current.set(id, data);
        setVectorCache(new Map(vectorCacheRef.current));
      }

      if (pendingViewIdsRef.current.length > 0) {
        frameRef.current = scheduleFrame(computeNext);
      }
    };

    frameRef.current = scheduleFrame(computeNext);

    return () => {
      if (frameRef.current !== null) cancelFrame(frameRef.current);
      frameRef.current = null;
      pendingViewIdsRef.current = [];
    };
  }, [isOpen, views, geometries]);

  // F-050: load a project's saved sheets once per project id. A different project resets the
  // composer first, so sheets can never leak between projects.
  const persistedProjectRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    if (persistedProjectRef.current === projectId) return;
    persistedProjectRef.current = projectId ?? null;
    hasUserSheetEditsRef.current = false;
    setSheets([]);
    setActiveSheetId('');
    setSelectedViewportId(null);
    setCustomViews([]);
  }, [isOpen, projectId]);

  // Seed the sheet on open, from the props that are current *now* rather than at mount (F-028).
  // Once the user has touched a sheet its state is left alone, so a late model load or a project
  // rename can never overwrite an in-flight edit.
  useEffect(() => {
    if (!isOpen || hasUserSheetEditsRef.current) return;

    const saved = loadPersistedSheets(projectId);
    if (saved) {
      persistedProjectRef.current = projectId ?? null;
      hasUserSheetEditsRef.current = true;
      setSheets(saved.sheets);
      setActiveSheetId(saved.activeSheetId);
      setCustomViews(saved.customViews);
      setSelectedViewportId(null);
      return;
    }

    const planView = pickLowestPlanView(planViews);
    const cached = vectorCacheRef.current.get(planView.id);
    const planScale = cached
      ? chooseSheetScale(cached.bounds, VIEWPORT_SIZE_MM, unitScale)
      : planView.scale;
    const seeded = createDefaultSheet(projectName, planView, planScale);

    setSheets([seeded]);
    setActiveSheetId(seeded.id);
    setSelectedViewportId(null);
  }, [isOpen, projectId, projectName, planViews, unitScale]);

  // Persist only after the user has actually edited a sheet/view, so the seeded default keeps
  // tracking the project's storeys until they take ownership of it.
  useEffect(() => {
    if (!isOpen || !projectId || !hasUserSheetEditsRef.current || sheets.length === 0) return;
    const handle = setTimeout(() => {
      savePersistedSheets(projectId, sheets, activeSheetId, customViews);
    }, 250);
    return () => clearTimeout(handle);
  }, [isOpen, projectId, sheets, activeSheetId, customViews]);

  // Physical sheet size in millimeters
  const sheetDimensions = useMemo(() => {
    if (!currentSheet) return { width: 420, height: 297 };
    return getSheetDimensions(currentSheet.paperSize, currentSheet.orientation);
  }, [currentSheet]);

  // Add a new drawing sheet
  const handleAddSheet = () => {
    hasUserSheetEditsRef.current = true;
    const nextIdx = sheets.length + 1;
    const newSheet: DrawingSheet = {
      id: `sheet-${Date.now()}`,
      sheetNumber: `A-10${nextIdx}`,
      sheetTitle: `ARCHITECTURAL DRAWING ${nextIdx}`,
      paperSize: 'A3',
      orientation: 'landscape',
      projectInfo: {
        projectName,
        projectNumber: 'PRJ-2026-01',
        client: 'Architectural Client',
        author: 'Lead Architect',
        date: new Date().toISOString().split('T')[0],
        revision: 'Rev A',
        status: 'Preliminary'
      },
      viewports: []
    };
    setSheets((prev) => [...prev, newSheet]);
    setActiveSheetId(newSheet.id);
  };

  // Delete a sheet. The next active id is resolved against the *post-delete* list by
  // `deleteSheetState`, so it can never point at the sheet that was just removed (F-010).
  const handleDeleteSheet = (id: string) => {
    const { sheets: next, activeSheetId: nextActiveId } = deleteSheetState(sheets, activeSheetId, id);
    if (next === sheets) return; // last remaining sheet: nothing to delete

    hasUserSheetEditsRef.current = true;
    setSheets(next);
    setActiveSheetId(next[0] ? nextActiveId : activeSheetId);
    setSelectedViewportId(null);
  };

  // Update current sheet metadata
  const handleUpdateCurrentSheet = (partial: Partial<DrawingSheet>) => {
    hasUserSheetEditsRef.current = true;
    setSheets((prev) =>
      prev.map((s) => (s.id === activeSheetId ? { ...s, ...partial } : s))
    );
  };

  // Place a view onto the active sheet, at a scale that fits its vector bounds
  const handlePlaceViewOnSheet = (view: BimView) => {
    if (!currentSheet) return;

    const cached = vectorCacheRef.current.get(view.id);
    const scale = cached
      ? chooseSheetScale(cached.bounds, VIEWPORT_SIZE_MM, unitScale)
      : view.scale;

    const newVp: SheetViewport = {
      id: `vp-${Date.now()}`,
      viewId: view.id,
      viewName: view.name,
      viewType: view.type,
      x: 35 + (currentSheet.viewports.length * 15) % 150,
      y: 25 + (currentSheet.viewports.length * 15) % 100,
      width: VIEWPORT_SIZE_MM.width,
      height: VIEWPORT_SIZE_MM.height,
      scale,
      detailNumber: currentSheet.viewports.length + 1,
      showTitle: true,
      showFrame: true
    };

    handleUpdateCurrentSheet({
      viewports: [...currentSheet.viewports, newVp]
    });
    setSelectedViewportId(newVp.id);
  };

  // Remove a viewport from active sheet
  const handleRemoveViewport = (vpId: string) => {
    if (!currentSheet) return;
    handleUpdateCurrentSheet({
      viewports: currentSheet.viewports.filter((v) => v.id !== vpId)
    });
    if (selectedViewportId === vpId) {
      setSelectedViewportId(null);
    }
  };

  // Update a viewport's scale
  const handleUpdateViewportScale = (vpId: string, scale: number) => {
    if (!currentSheet) return;
    handleUpdateCurrentSheet({
      viewports: currentSheet.viewports.map((v) => (v.id === vpId ? { ...v, scale } : v))
    });
  };

  // Create custom Plan View
  const handleCreatePlanView = () => {
    const newView: BimView = {
      id: `plan-${Date.now()}`,
      name: newPlanName,
      type: 'plan',
      elevation: newPlanElevation,
      cutPlane: {
        axis: 'y',
        position: newPlanElevation
      },
      scale: 100,
      createdAt: new Date().toISOString()
    };
    setCustomViews((prev) => [...prev, newView]);
    setIsAddingPlan(false);
  };

  // Create custom Section View
  const handleCreateSectionView = () => {
    const newView: BimView = {
      id: `section-${Date.now()}`,
      name: newSectionName,
      type: 'section',
      cutPlane: {
        axis: newSectionAxis,
        position: newSectionPos
      },
      scale: 100,
      createdAt: new Date().toISOString()
    };
    setCustomViews((prev) => [...prev, newView]);
    setIsAddingSection(false);
  };

  // Export standalone SVG file
  const handleExportSvg = () => {
    if (!currentSheet) return;
    const svgContent = exportSheetToSvg(currentSheet, vectorCacheRef.current, unitScale);
    downloadSvgFile(`${currentSheet.sheetNumber}_${currentSheet.sheetTitle}`, svgContent);
  };

  // Print sheet at the sheet's real paper size (A3 by default) instead of the browser default.
  const handlePrint = () => {
    if (!currentSheet) return;
    const svgContent = exportSheetToSvg(currentSheet, vectorCacheRef.current, unitScale);
    printSheet(svgContent, sheetDimensions);
  };

  // Native, non-passive wheel zoom. A React `onWheel` prop cannot preventDefault (React attaches
  // `wheel` passively), which is what logged "Unable to preventDefault inside passive event
  // listener" into the console (F-041).
  const boardRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!isOpen || !boardRef.current) return;
    return createWheelZoom(boardRef.current, {
      onZoom: (direction) =>
        setCanvasZoom((prev) =>
          Math.min(Math.max(0.4, prev * (direction === 'in' ? 1.1 : 0.9)), 4.0)
        )
    });
  }, [isOpen]);

  // Canvas Pan Handlers
  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    // If middle mouse or spacebar or clicking background
    if (e.button === 1 || e.altKey || (e.target as HTMLElement).id === 'drawing-board') {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - canvasPan.x, y: e.clientY - canvasPan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setCanvasPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y
      });
      return;
    }

    if (draggingVpId && currentSheet) {
      const deltaX = (e.clientX - dragStartRef.current.mouseX) / canvasZoom;
      const deltaY = (e.clientY - dragStartRef.current.mouseY) / canvasZoom;

      const newX = Math.max(10, Math.min(sheetDimensions.width - 60, dragStartRef.current.vpX + deltaX));
      const newY = Math.max(10, Math.min(sheetDimensions.height - 40, dragStartRef.current.vpY + deltaY));

      hasUserSheetEditsRef.current = true;
      setSheets((prev) =>
        prev.map((s) => {
          if (s.id !== currentSheet.id) return s;
          return {
            ...s,
            viewports: s.viewports.map((vp) =>
              vp.id === draggingVpId ? { ...vp, x: Math.round(newX), y: Math.round(newY) } : vp
            )
          };
        })
      );
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingVpId(null);
  };

  const startDragViewport = (e: React.MouseEvent, vp: SheetViewport) => {
    e.stopPropagation();
    setSelectedViewportId(vp.id);
    setDraggingVpId(vp.id);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      vpX: vp.x,
      vpY: vp.y
    };
  };

  // Reset view to fit sheet
  const handleFitToPage = useCallback(() => {
    setCanvasZoom(1.35);
    setCanvasPan({ x: 0, y: 0 });
  }, []);

  // Focus enters the dialog on open, Tab/Shift+Tab cycle inside it, Escape closes it and focus
  // returns to the element that opened it (F-032).
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useModalFocusTrap(dialogRef, { active: isOpen, onEscape: onClose });

  if (!isOpen) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Drawing Sheets and Views"
      data-qa="drawing-sheets-modal"
      data-testid="drawing-sheets-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-md animate-in fade-in select-none text-[var(--text-primary)]"
    >
      <div className="relative w-full h-full max-w-[96vw] max-h-[94vh] rounded-3xl glass-card bg-[var(--glass-surface-panel)] backdrop-blur-2xl border border-[var(--glass-border)] shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-[var(--border-subtle)] bg-[var(--dock-translucent)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Drawing Sheets & Views Composer
              </h2>
              <p className="text-[11px] text-[var(--text-secondary)]">
                2D Floor Plans &bull; Cross Sections &bull; Scaled Title Block Sheets
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportSvg}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--control-bg)] hover:bg-[var(--control-hover)] text-xs font-medium text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
              title="Export Scalable Vector Graphics (SVG)"
              data-qa="btn-export-sheet-svg"
            >
              <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Export SVG</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--control-bg)] hover:bg-[var(--control-hover)] text-xs font-medium text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
              title="Print Sheet / Save as PDF"
              data-qa="btn-print-sheet"
            >
              <Printer className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <span>Print / PDF</span>
            </button>

            <div className="h-4 w-px bg-[var(--border-subtle)] mx-1" />

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--control-hover)] transition-colors cursor-pointer"
              title="Close Composer"
              data-qa="btn-close-drawing-sheets"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Content: Left Inspector & Right Canvas */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Controls & Library Sidebar */}
          <div className="w-84 border-r border-[var(--border-subtle)] bg-[var(--glass-surface-card)] p-4 flex flex-col gap-4 overflow-y-auto">
            {/* 1. Active Sheet Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Active Drawing Sheet
                </span>
                <button
                  type="button"
                  onClick={handleAddSheet}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-600 text-white text-[10px] font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
                  title="Create New Sheet"
                  data-qa="btn-add-sheet"
                >
                  <Plus className="w-3 h-3" />
                  <span>New Sheet</span>
                </button>
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {sheets.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSheetId(s.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      s.id === activeSheetId
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-[var(--control-bg)] text-[var(--text-primary)] hover:bg-[var(--control-hover)] border border-[var(--border-subtle)]'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>{s.sheetNumber}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Sheet Properties */}
            {currentSheet && (
              <div className="p-3 rounded-2xl bg-[var(--control-bg)] border border-[var(--border-subtle)] space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border-subtle)]">
                  <span className="font-semibold text-[var(--text-primary)]">Sheet Parameters</span>
                  {sheets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteSheet(currentSheet.id)}
                      className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      title="Delete Sheet"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-[var(--text-muted)] font-medium">Sheet Number</label>
                    <input
                      type="text"
                      value={currentSheet.sheetNumber}
                      onChange={(e) => handleUpdateCurrentSheet({ sheetNumber: e.target.value })}
                      className="w-full mt-0.5 px-2 py-1 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--text-muted)] font-medium">Paper Size</label>
                    <select
                      value={currentSheet.paperSize}
                      onChange={(e) => handleUpdateCurrentSheet({ paperSize: e.target.value as PaperSize })}
                      className="w-full mt-0.5 px-2 py-1 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                    >
                      {Object.keys(PAPER_DIMENSIONS_MM).map((key) => (
                        <option key={key} value={key}>
                          {PAPER_DIMENSIONS_MM[key as PaperSize].title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-[var(--text-muted)] font-medium">Sheet Title</label>
                  <input
                    type="text"
                    value={currentSheet.sheetTitle}
                    onChange={(e) => handleUpdateCurrentSheet({ sheetTitle: e.target.value })}
                    className="w-full mt-0.5 px-2 py-1 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] font-semibold"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-[var(--text-secondary)]">Orientation:</span>
                  <div className="flex gap-1">
                    {(['landscape', 'portrait'] as PaperOrientation[]).map((or) => (
                      <button
                        key={or}
                        type="button"
                        onClick={() => handleUpdateCurrentSheet({ orientation: or })}
                        className={`px-2 py-0.5 rounded-lg text-[10px] capitalize font-medium cursor-pointer ${
                          currentSheet.orientation === or
                            ? 'bg-blue-600 text-white'
                            : 'bg-[var(--control-hover)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {or}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 3. Views Browser & Viewport Placement */}
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Available BIM Views ({views.length})
                </span>
              </div>

              {/* Views List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {views.map((v) => {
                  const isPlan = v.type === 'plan';
                  return (
                    <div
                      key={v.id}
                      className="p-2.5 rounded-xl bg-[var(--control-bg)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {isPlan ? (
                            <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <Scissors className="w-3.5 h-3.5 text-rose-500" />
                          )}
                          <span className="text-xs font-semibold text-[var(--text-primary)]">
                            {v.name}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-[var(--text-muted)]">
                          {isPlan
                            ? `Y = ${(v.cutPlane.position * unitScale).toFixed(2)}m`
                            : `${v.cutPlane.axis.toUpperCase()} = ${(v.cutPlane.position * unitScale).toFixed(2)}m`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-[var(--text-muted)]">Scale:</span>
                          <span className="text-[10px] font-mono text-[var(--text-secondary)] font-medium">
                            1:{v.scale}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handlePlaceViewOnSheet(v)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                          title="Place this view on current drawing sheet"
                          data-qa={`btn-place-view-${v.id}`}
                        >
                          <Plus className="w-3 h-3" />
                          <span>Place View</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* View Creation Triggers */}
              <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
                {!isAddingPlan && !isAddingSection ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsAddingPlan(true)}
                      className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-xl bg-[var(--control-bg)] hover:bg-[var(--control-hover)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-primary)] transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                      <span>Add Plan Cut</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingSection(true)}
                      className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-xl bg-[var(--control-bg)] hover:bg-[var(--control-hover)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-primary)] transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3 text-rose-500" />
                      <span>Add Section Cut</span>
                    </button>
                  </div>
                ) : isAddingPlan ? (
                  <div className="p-3 rounded-2xl bg-[var(--control-bg)] border border-blue-500/40 space-y-2 text-xs animate-in fade-in">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">New Plan View</span>
                    <div>
                      <label className="text-[10px] text-[var(--text-muted)]">View Name</label>
                      <input
                        type="text"
                        value={newPlanName}
                        onChange={(e) => setNewPlanName(e.target.value)}
                        className="w-full mt-0.5 px-2 py-1 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--text-muted)]">Cut Elevation (meters)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={newPlanElevation}
                        onChange={(e) => setNewPlanElevation(parseFloat(e.target.value) || 0)}
                        className="w-full mt-0.5 px-2 py-1 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] font-mono"
                      />
                    </div>
                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddingPlan(false)}
                        className="px-2.5 py-1 rounded-lg text-xs text-[var(--text-muted)] hover:bg-[var(--control-hover)]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCreatePlanView}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-semibold text-xs"
                      >
                        Create
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl bg-[var(--control-bg)] border border-rose-500/40 space-y-2 text-xs animate-in fade-in">
                    <span className="font-semibold text-rose-500">New Section View</span>
                    <div>
                      <label className="text-[10px] text-[var(--text-muted)]">View Name</label>
                      <input
                        type="text"
                        value={newSectionName}
                        onChange={(e) => setNewSectionName(e.target.value)}
                        className="w-full mt-0.5 px-2 py-1 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-[var(--text-muted)]">Cut Axis</label>
                        <select
                          value={newSectionAxis}
                          onChange={(e) => setNewSectionAxis(e.target.value as 'x' | 'z')}
                          className="w-full mt-0.5 px-2 py-1 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                        >
                          <option value="x">X Axis (Cross)</option>
                          <option value="z">Z Axis (Longitudinal)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-[var(--text-muted)]">Position (m)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={newSectionPos}
                          onChange={(e) => setNewSectionPos(parseFloat(e.target.value) || 0)}
                          className="w-full mt-0.5 px-2 py-1 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddingSection(false)}
                        className="px-2.5 py-1 rounded-lg text-xs text-[var(--text-muted)] hover:bg-[var(--control-hover)]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateSectionView}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-semibold text-xs"
                      >
                        Create
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Center: Interactive 2D Paper Canvas */}
          <div
            id="drawing-board"
            ref={boardRef}
            onMouseDown={handleMouseDownCanvas}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="flex-1 relative bg-slate-950/20 dark:bg-black/40 overflow-hidden flex items-center justify-center cursor-default select-none"
          >
            {/* Canvas Zoom Controls Pill */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-1 p-1 rounded-2xl glass-card bg-white/70 dark:bg-slate-900/80 backdrop-blur-xl border border-[var(--border-subtle)] shadow-lg">
              <button
                type="button"
                onClick={() => setCanvasZoom((z) => Math.min(z * 1.2, 4.0))}
                className="p-1.5 rounded-xl hover:bg-[var(--control-hover)] text-[var(--text-primary)] transition-colors cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCanvasZoom((z) => Math.max(z * 0.8, 0.4))}
                className="p-1.5 rounded-xl hover:bg-[var(--control-hover)] text-[var(--text-primary)] transition-colors cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleFitToPage}
                className="p-1.5 rounded-xl hover:bg-[var(--control-hover)] text-[var(--text-primary)] transition-colors cursor-pointer"
                title="Fit to Page"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <div className="px-2 text-[10px] font-mono font-medium text-[var(--text-secondary)]">
                {Math.round(canvasZoom * 100)}%
              </div>
            </div>

            {/* Physical Scaled Paper Sheet. Nothing to draw until the seeding effect has run
                (sheets starts empty so it can be derived from the current props, not from mount). */}
            {currentSheet && (
            <div
              style={{
                transform: `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${canvasZoom})`,
                transformOrigin: 'center center',
                width: `${sheetDimensions.width}px`,
                height: `${sheetDimensions.height}px`
              }}
              className="relative bg-white text-slate-950 shadow-2xl transition-transform duration-75 border border-slate-300"
            >
              {/* Outer Margin & Drawing Frame (20mm binding edge on left, 10mm others) */}
              <div
                style={{
                  top: '10px',
                  bottom: '10px',
                  left: '20px',
                  right: '10px'
                }}
                className="absolute border border-slate-900 pointer-events-none"
              />

              {/* Title Block (Bottom Right ISO standard 185mm x 55mm) */}
              <div
                style={{
                  bottom: '10px',
                  right: '10px',
                  width: '185px',
                  height: '55px'
                }}
                className="absolute border-2 border-slate-900 bg-slate-50 flex flex-col justify-between p-2 pointer-events-none"
              >
                <div className="border-b border-slate-900 pb-1">
                  <div className="text-[6px] uppercase tracking-wider text-slate-500 font-bold">Project</div>
                  <div className="text-[8px] font-bold text-slate-900 truncate">
                    {currentSheet.projectInfo.projectName}
                  </div>
                </div>

                <div className="border-b border-slate-900 pb-1">
                  <div className="text-[6px] uppercase tracking-wider text-slate-500 font-bold">Drawing Title</div>
                  <div className="text-[9px] font-black text-slate-900 uppercase truncate">
                    {currentSheet.sheetTitle}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <div>
                    <div className="text-[6px] text-slate-500 font-bold">Date &bull; Author</div>
                    <div className="text-[7px] font-bold text-slate-800">
                      {currentSheet.projectInfo.date} &bull; {currentSheet.projectInfo.author}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[6px] text-slate-500 font-bold">Sheet No.</div>
                    <div className="text-[11px] font-black text-slate-950 font-mono">
                      {currentSheet.sheetNumber}
                    </div>
                  </div>
                </div>
              </div>

              {/* Placed Viewports on Sheet */}
              {currentSheet.viewports.map((vp) => {
                const isSelected = selectedViewportId === vp.id;
                const vData = vectorCache.get(vp.viewId);
                // 1:100 means 1 m of model = 10 mm on paper; in project units that is
                // (1000 * metres-per-unit) / scale mm per unit, matching `exportSheetToSvg`.
                const scaleRatio = (1000 * unitScale) / vp.scale;
                const pathData = vData && vData.lines.length > 0
                  ? buildViewportPathData(vData.lines, {
                      centerX: (vData.bounds.minX + vData.bounds.maxX) / 2,
                      centerY: (vData.bounds.minY + vData.bounds.maxY) / 2,
                      viewportCenterX: vp.width / 2,
                      viewportCenterY: vp.height / 2,
                      scaleRatio
                    })
                  : null;

                return (
                  <div
                    key={vp.id}
                    data-qa={`sheet-viewport-${vp.id}`}
                    onMouseDown={(e) => startDragViewport(e, vp)}
                    style={{
                      left: `${vp.x}px`,
                      top: `${vp.y}px`,
                      width: `${vp.width}px`,
                      height: `${vp.height}px`
                    }}
                    className={`absolute cursor-move group transition-shadow ${
                      isSelected
                        ? 'ring-2 ring-blue-500 shadow-md'
                        : 'hover:ring-1 hover:ring-slate-400'
                    }`}
                  >
                    {/* Viewport Boundary Frame */}
                    {vp.showFrame && (
                      <div className="absolute inset-0 border border-dashed border-slate-300 pointer-events-none" />
                    )}

                    {/* Viewport Action Controls (Scale & Delete on Hover/Selection) */}
                    {isSelected && (
                      <div className="absolute -top-7 left-0 right-0 flex items-center justify-between pointer-events-auto">
                        <div className="flex items-center gap-1 bg-slate-900/90 text-white rounded-md px-1.5 py-0.5 text-[8px] font-mono shadow-sm">
                          <Move className="w-2.5 h-2.5" />
                          <span>Drag</span>
                          <span className="text-slate-400">|</span>
                          <select
                            value={vp.scale}
                            onChange={(e) => handleUpdateViewportScale(vp.id, parseInt(e.target.value, 10))}
                            className="bg-transparent text-white text-[8px] outline-none cursor-pointer"
                          >
                            {ARCHITECTURAL_SCALES.map((s) => (
                              <option key={s.value} value={s.value} className="bg-slate-900 text-white">
                                1:{s.value}
                              </option>
                            ))}
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveViewport(vp.id);
                          }}
                          className="p-1 rounded-md bg-rose-600 text-white hover:bg-rose-700 shadow-sm transition-colors cursor-pointer"
                          title="Remove from Sheet"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    )}

                    {/* Rendered 2D Vector Geometry inside Viewport: two batched <path> elements,
                        not one <line> per segment (F-029). Same helper as the SVG export. */}
                    <div className="w-full h-full overflow-hidden pointer-events-none flex items-center justify-center">
                      {pathData ? (
                        <svg
                          width="100%"
                          height="100%"
                          viewBox={`0 0 ${vp.width} ${vp.height}`}
                          className="w-full h-full"
                        >
                          {pathData.projection && (
                            <path
                              d={pathData.projection}
                              fill="none"
                              stroke="slategray"
                              strokeWidth={0.25}
                              strokeLinecap="round"
                              opacity={0.6}
                            />
                          )}
                          {pathData.cut && (
                            <path
                              d={pathData.cut}
                              fill="none"
                              stroke="black"
                              strokeWidth={0.75}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}
                        </svg>
                      ) : (
                        <div className="text-[9px] text-slate-400 italic">No geometry intersects cut plane</div>
                      )}
                    </div>

                    {/* BIM Viewport Title Tag (Detail #, Title, Scale) */}
                    <div
                      style={{
                        top: `${vp.height + 4}px`
                      }}
                      className="absolute left-1 right-0 flex items-center gap-1.5 pointer-events-none"
                    >
                      <div className="w-4 h-4 rounded-full border border-slate-900 bg-white flex items-center justify-center text-[7px] font-bold text-slate-900">
                        {vp.detailNumber}
                      </div>
                      <div className="flex flex-col border-b border-slate-900 flex-1 pb-0.5">
                        <span className="text-[8px] font-bold text-slate-900 uppercase tracking-wider truncate">
                          {vp.viewName}
                        </span>
                        <span className="text-[6px] font-semibold text-slate-600">
                          SCALE 1:{vp.scale}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default DrawingSheetsModal;
