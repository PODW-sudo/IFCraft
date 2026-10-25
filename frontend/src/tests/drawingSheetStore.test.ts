import { beforeEach, describe, expect, it } from 'vitest';
import {
  DRAWING_SHEETS_STORAGE_VERSION,
  clearPersistedSheets,
  drawingSheetsStorageKey,
  loadPersistedSheets,
  savePersistedSheets,
} from '../services/drawingSheetStore';
import type { BimView, DrawingSheet } from '../types/drawings';

const sheet: DrawingSheet = {
  id: 'sheet-1',
  sheetNumber: 'A-101',
  sheetTitle: 'FLOOR PLANS',
  paperSize: 'A3',
  orientation: 'landscape',
  projectInfo: {
    projectName: 'Test',
    projectNumber: 'P-1',
    client: 'Client',
    author: 'Author',
    date: '2026-10-25',
    revision: 'Rev A',
    status: 'Preliminary',
  },
  viewports: [],
};

const view: BimView = {
  id: 'plan-1',
  name: 'Ground Floor',
  type: 'plan',
  cutPlane: { axis: 'z', position: 0 },
  scale: 100,
  createdAt: '2026-10-25T00:00:00.000Z',
};

describe('drawingSheetStore', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips sheets, custom views and the active sheet per project', () => {
    expect(savePersistedSheets('p1', [sheet], 'sheet-1', [view])).toBe(true);
    const loaded = loadPersistedSheets('p1');
    expect(loaded?.version).toBe(DRAWING_SHEETS_STORAGE_VERSION);
    expect(loaded?.sheets).toEqual([sheet]);
    expect(loaded?.customViews).toEqual([view]);
    expect(loaded?.activeSheetId).toBe('sheet-1');
  });

  it('isolates projects', () => {
    savePersistedSheets('p1', [sheet], 'sheet-1');
    expect(loadPersistedSheets('p2')).toBeNull();
  });

  it('returns null for a missing, corrupt or foreign payload', () => {
    expect(loadPersistedSheets('p1')).toBeNull();
    localStorage.setItem(drawingSheetsStorageKey('p1'), 'not json');
    expect(loadPersistedSheets('p1')).toBeNull();
    localStorage.setItem(
      drawingSheetsStorageKey('p1'),
      JSON.stringify({ version: 99, sheets: [sheet], activeSheetId: 'sheet-1' })
    );
    expect(loadPersistedSheets('p1')).toBeNull();
  });

  it('repairs a dangling active sheet id to the first sheet', () => {
    savePersistedSheets('p1', [sheet], 'missing');
    expect(loadPersistedSheets('p1')?.activeSheetId).toBe('sheet-1');
  });

  it('clears one project only and ignores empty input', () => {
    savePersistedSheets('p1', [sheet], 'sheet-1');
    savePersistedSheets('p2', [sheet], 'sheet-1');
    clearPersistedSheets('p1');
    expect(loadPersistedSheets('p1')).toBeNull();
    expect(loadPersistedSheets('p2')).not.toBeNull();
    expect(savePersistedSheets('p3', [], '')).toBe(false);
    expect(savePersistedSheets(null, [sheet], 'sheet-1')).toBe(false);
  });
});
