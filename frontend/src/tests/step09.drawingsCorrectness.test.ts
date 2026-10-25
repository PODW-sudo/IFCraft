import { describe, it, expect } from 'vitest';
import {
  buildPlanViewsFromStoreys,
  chooseSheetScale,
  deleteSheetState
} from '../services/drawingSheets';
import { buildPrintDocument } from '../services/drawingEngine';
import type { DrawingSheet } from '../types/drawings';

/**
 * STEP-09 — Drawing correctness (F-010, F-028, F-030).
 *
 * Pure-logic contract for the three new helpers in `services/drawingSheets.ts` plus the
 * print-document split in `services/drawingEngine.ts`. Runs in the node/jsdom test environment
 * with no browser and no React.
 */

const storeysMm = [
  { id: 11, name: 'Ground Floor', elevation: 0 },
  { id: 12, name: 'Level 2', elevation: 3000 },
  { id: 13, name: 'Roof', elevation: 6000 }
];

const sheet = (id: string, number: string): DrawingSheet => ({
  id,
  sheetNumber: number,
  sheetTitle: `TITLE ${number}`,
  paperSize: 'A3',
  orientation: 'landscape',
  projectInfo: {
    projectName: 'Villa',
    projectNumber: 'PRJ-1',
    client: 'Client',
    author: 'Author',
    date: '2026-10-24',
    revision: 'Rev A',
    status: 'Preliminary'
  },
  viewports: []
});

describe('STEP-09 plan view derivation', () => {
  it('derives one plan per storey with the cut 1.2 m above the storey, in project units', () => {
    const views = buildPlanViewsFromStoreys(storeysMm, 0.001);

    expect(views).toHaveLength(3);
    expect(views.map((v) => v.name)).toEqual(['Ground Floor Plan', 'Level 2 Plan', 'Roof Plan']);
    expect(views.map((v) => v.cutPlane.position)).toEqual([1200, 4200, 7200]);
    expect(views.every((v) => v.type === 'plan')).toBe(true);
    expect(views.every((v) => v.id.startsWith('plan-storey-'))).toBe(true);
  });

  it('still cuts at +1.2 m on a metre-unit model and keeps a labelled fallback view', () => {
    const metreViews = buildPlanViewsFromStoreys([{ id: 1, name: 'Level 1', elevation: 0 }], 1);
    expect(metreViews[0].cutPlane.position).toBeCloseTo(1.2);

    const fallback = buildPlanViewsFromStoreys([], 0.001);
    expect(fallback).toHaveLength(1);
    expect(fallback[0].id).toBe('plan-default');
    expect(fallback[0].cutPlane.position).toBeCloseTo(1200);
  });
});

describe('STEP-09 sheet scale', () => {
  it('picks a scale that fits a 30 m wide building into a 175 x 120 mm viewport at 1:200', () => {
    const bounds = { minX: 0, minY: 0, maxX: 30000, maxY: 20000 }; // mm units
    expect(chooseSheetScale(bounds, { width: 175, height: 120 }, 0.001)).toBe(200);
  });

  it('falls back to the largest available scale when nothing fits', () => {
    const huge = { minX: 0, minY: 0, maxX: 500000, maxY: 400000 }; // 500 m
    expect(chooseSheetScale(huge, { width: 175, height: 120 }, 0.001)).toBe(500);
  });
});

describe('STEP-09 sheet deletion', () => {
  const sheets = [sheet('s1', 'A-101'), sheet('s2', 'A-102'), sheet('s3', 'A-103')];

  it('never leaves activeSheetId pointing at the deleted sheet', () => {
    const next = deleteSheetState(sheets, 's1', 's1');

    expect(next.sheets.map((s) => s.id)).toEqual(['s2', 's3']);
    expect(next.activeSheetId).not.toBe('s1');
    expect(next.sheets.some((s) => s.id === next.activeSheetId)).toBe(true);
    expect(next.activeSheetId).toBe('s2');
  });

  it('keeps the current sheet when a different sheet is deleted', () => {
    const next = deleteSheetState(sheets, 's3', 's2');
    expect(next.activeSheetId).toBe('s3');
    expect(next.sheets.map((s) => s.id)).toEqual(['s1', 's3']);
  });

  it('refuses to delete the last remaining sheet', () => {
    const only = [sheet('s1', 'A-101')];
    const next = deleteSheetState(only, 's1', 's1');
    expect(next.sheets).toHaveLength(1);
    expect(next.activeSheetId).toBe('s1');
  });
});

describe('STEP-09 print document', () => {
  it('declares the real paper size instead of size: auto', () => {
    const html = buildPrintDocument('<svg xmlns="http://www.w3.org/2000/svg"></svg>', {
      width: 420,
      height: 297
    });

    expect(html).toContain('size: 420mm 297mm');
    expect(html).not.toContain('size: auto');
    expect(html).not.toContain('100vw');
  });
});
