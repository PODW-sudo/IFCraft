/**
 * Per-project persistence for the drawing-sheet composer (F-050 / STEP-09 residual).
 *
 * Sheets and custom views used to be session state: closing the modal or reloading the
 * browser lost every sheet number, title-block edit and viewport arrangement.
 *
 * Storage is deliberately local (localStorage) and versioned:
 *   - one key per project id, so switching projects cannot leak another project's sheets;
 *   - a corrupt/foreign payload is ignored (returns null) rather than crashing the modal;
 *   - geometry/vector data is NOT stored, only layout + metadata, so a model reload
 *     recomputes the cuts from the new geometry.
 */

import type { BimView, DrawingSheet } from '../types/drawings';

export const DRAWING_SHEETS_STORAGE_VERSION = 1;

export interface PersistedSheetState {
  version: number;
  sheets: DrawingSheet[];
  customViews: BimView[];
  activeSheetId: string;
  savedAt: string;
}

export function drawingSheetsStorageKey(projectId: string): string {
  return `ifc_editor_drawing_sheets_v${DRAWING_SHEETS_STORAGE_VERSION}_${projectId}`;
}

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadPersistedSheets(projectId: string | null | undefined): PersistedSheetState | null {
  if (!projectId) return null;
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(drawingSheetsStorageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedSheetState>;
    if (
      parsed.version !== DRAWING_SHEETS_STORAGE_VERSION ||
      !Array.isArray(parsed.sheets) ||
      parsed.sheets.length === 0 ||
      !parsed.sheets.every((sheet) => sheet && typeof sheet.id === 'string')
    ) {
      return null;
    }
    return {
      version: DRAWING_SHEETS_STORAGE_VERSION,
      sheets: parsed.sheets,
      customViews: Array.isArray(parsed.customViews) ? parsed.customViews : [],
      activeSheetId:
        typeof parsed.activeSheetId === 'string' && parsed.sheets.some((s) => s.id === parsed.activeSheetId)
          ? parsed.activeSheetId
          : parsed.sheets[0].id,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
    };
  } catch {
    return null;
  }
}

export function savePersistedSheets(
  projectId: string | null | undefined,
  sheets: DrawingSheet[],
  activeSheetId: string,
  customViews: BimView[] = []
): boolean {
  if (!projectId || sheets.length === 0) return false;
  const store = storage();
  if (!store) return false;
  try {
    const payload: PersistedSheetState = {
      version: DRAWING_SHEETS_STORAGE_VERSION,
      sheets,
      customViews,
      activeSheetId,
      savedAt: new Date().toISOString(),
    };
    store.setItem(drawingSheetsStorageKey(projectId), JSON.stringify(payload));
    return true;
  } catch {
    // Quota or a disabled storage backend: losing persistence is better than blocking the editor.
    return false;
  }
}

export function clearPersistedSheets(projectId: string | null | undefined): void {
  if (!projectId) return;
  try {
    storage()?.removeItem(drawingSheetsStorageKey(projectId));
  } catch {
    // ignore
  }
}
