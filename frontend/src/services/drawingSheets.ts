import type { BimView, DrawingSheet, DrawingViewVectorData } from '../types/drawings';
import { ARCHITECTURAL_SCALES } from '../types/drawings';

/**
 * Pure helpers for the Sheet Composer (STEP-09).
 *
 * Everything in this module is a pure function of its arguments so it can be unit-tested without a
 * browser, React or Three.js. The component (`DrawingSheetsModal`) derives its views, its sheet
 * scale and its `activeSheetId` transitions from here instead of from mount-time `useState`
 * initialisers.
 *
 * Unit contract (mirrors the backend `SpatialNode` payload):
 * - `elevation` is in **project units** (millimetres for a typical Revit export),
 * - `unitScale` is **metres per project unit** (`0.001` for a mm file, `1` for a metre file).
 */

export interface StoreyLike {
  id: number;
  name: string;
  elevation?: number | null;
}

export interface Bounds2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ViewportSizeMm {
  width: number;
  height: number;
}

/** Height of the standard plan cut plane above finished floor level, in metres. */
export const PLAN_CUT_HEIGHT_M = 1.2;

/** Fraction of the viewport a drawing may occupy; the rest is breathing room around it. */
const VIEWPORT_FIT_FACTOR = 0.9;

/**
 * Normalises a `unitScale` to something usable: metres per project unit, positive and finite.
 * A missing / zero / negative / non-finite value falls back to `1` (metre file) so callers never
 * have to branch on it.
 */
export function normalizeUnitScale(unitScale?: number | null): number {
  if (typeof unitScale !== 'number' || !Number.isFinite(unitScale) || unitScale <= 0) return 1;
  return unitScale;
}

/**
 * One plan view per storey, in input order.
 *
 * The cut plane sits 1.2 m above the storey elevation, converted from metres into project units so
 * a millimetre model cuts 1200 units above the slab instead of 1.2 units.
 * With no storeys loaded (model not parsed yet) a single labelled fallback view is returned so the
 * sheet composer is never empty.
 */
export function buildPlanViewsFromStoreys(
  storeys: StoreyLike[],
  unitScale?: number | null,
  createdAt: string = new Date().toISOString()
): BimView[] {
  const scale = normalizeUnitScale(unitScale);
  const cutOffset = PLAN_CUT_HEIGHT_M / scale;

  if (storeys.length === 0) {
    return [
      {
        id: 'plan-default',
        name: scale === 1 ? 'Ground Floor Plan (+1.2m)' : 'Ground Floor Plan',
        type: 'plan',
        elevation: 0,
        cutPlane: { axis: 'y', position: cutOffset },
        scale: 100,
        createdAt
      }
    ];
  }

  return storeys.map((storey, idx) => {
    const elevation = typeof storey.elevation === 'number' && Number.isFinite(storey.elevation)
      ? storey.elevation
      : 0;
    return {
      id: `plan-storey-${storey.id}`,
      name: storey.name ? `${storey.name} Plan` : `Level ${idx} Plan`,
      type: 'plan' as const,
      storeyId: storey.id,
      elevation,
      cutPlane: { axis: 'y' as const, position: elevation + cutOffset },
      scale: 100,
      createdAt
    };
  });
}

/**
 * Smallest architectural scale whose drawn extent still fits inside `viewportMm` with a 10 % margin
 * (so a 30 m building no longer gets clipped in a 175 mm viewport at 1:100).
 *
 * Drawn length in millimetres = `(max - min) * 1000 * unitScale / scale`.
 * When even the largest scale does not fit, the largest available scale is returned.
 */
export function chooseSheetScale(
  bounds: Bounds2D | null | undefined,
  viewportMm: ViewportSizeMm,
  unitScale?: number | null
): number {
  const largest = ARCHITECTURAL_SCALES[ARCHITECTURAL_SCALES.length - 1].value;
  if (!bounds || !Number.isFinite(bounds.maxX) || !Number.isFinite(bounds.maxY)
    || !Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY)) {
    return 100;
  }
  if (viewportMm.width <= 0 || viewportMm.height <= 0) return 100;

  const scale = normalizeUnitScale(unitScale);
  // Project-unit extent -> millimetres on paper per 1:1.
  const extentMmW = Math.abs(bounds.maxX - bounds.minX) * 1000 * scale;
  const extentMmH = Math.abs(bounds.maxY - bounds.minY) * 1000 * scale;

  const maxW = viewportMm.width * VIEWPORT_FIT_FACTOR;
  const maxH = viewportMm.height * VIEWPORT_FIT_FACTOR;

  for (const candidate of ARCHITECTURAL_SCALES) {
    if (extentMmW / candidate.value <= maxW && extentMmH / candidate.value <= maxH) {
      return candidate.value;
    }
  }
  return largest;
}

/** Convenience wrapper: choose a scale straight from a cached view's bounds. */
export function chooseSheetScaleForView(
  data: DrawingViewVectorData | null | undefined,
  viewportMm: ViewportSizeMm,
  unitScale?: number | null
): number {
  if (!data) return 100;
  return chooseSheetScale(data.bounds, viewportMm, unitScale);
}

export interface SheetState {
  sheets: DrawingSheet[];
  activeSheetId: string;
}

/**
 * Removes a sheet and resolves `activeSheetId` in the same step, so the id can never point at the
 * sheet that was just deleted (F-010).
 *
 * - deleting a non-active sheet keeps the current selection,
 * - deleting the active sheet selects the surviving sheet at the same index (or the new last one),
 * - deleting the only remaining sheet is a no-op.
 */
export function deleteSheetState(
  sheets: DrawingSheet[],
  activeSheetId: string,
  targetId: string
): SheetState {
  const index = sheets.findIndex((s) => s.id === targetId);
  if (index === -1 || sheets.length <= 1) {
    return { sheets, activeSheetId };
  }

  const remaining = sheets.filter((_, i) => i !== index);
  if (activeSheetId !== targetId) {
    return { sheets: remaining, activeSheetId };
  }

  const nextIndex = Math.min(index, remaining.length - 1);
  return { sheets: remaining, activeSheetId: remaining[nextIndex].id };
}
