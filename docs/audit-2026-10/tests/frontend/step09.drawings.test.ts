import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * STEP-09 — Drawing sheets must be correct.
 *
 * Findings: F-010 (delete-first-sheet), F-028 (views frozen at mount / hard-coded +1.2 m cut),
 *           F-030 (scale does not fit the model, print is not to scale)
 *
 * Bugs (verified 2026-10-24 by reading the source):
 *   1. frontend/src/components/drawings/DrawingSheetsModal.tsx:255-259
 *        setSheets((prev) => prev.filter((s) => s.id !== id));
 *        setActiveSheetId(sheets[0].id);      <-- stale pre-delete array
 *      Deleting the first sheet leaves activeSheetId pointing at a deleted sheet, so every
 *      subsequent sheet edit silently matches nothing.
 *   2. frontend/src/components/drawings/DrawingSheetsModal.tsx:78-90 / :129
 *      `views` and `projectName` are captured in useState initialisers, i.e. at mount, when
 *      storeys is still [] and currentProject is null. They are never re-derived.
 *   3. frontend/src/hooks/useSpatialSelection.ts:75
 *        list.push({ id: node.express_id, name: node.name, elevation: 0.0 });
 *      The elevation is hard-coded; the worker never parses IfcBuildingStorey.Elevation
 *      (frontend/src/workers/ifcWorker.ts:222-227). Every plan is therefore cut at +1.2 m.
 *
 * These assertions are source-level contracts so they run in the existing node test
 * environment. STEP-27 adds jsdom for rendered assertions.
 */

const MODAL_SRC = resolve(__dirname, '../components/drawings/DrawingSheetsModal.tsx');
const SELECTION_SRC = resolve(__dirname, '../hooks/useSpatialSelection.ts');
const WORKER_SRC = resolve(__dirname, '../workers/ifcWorker.ts');

const readModal = () => readFileSync(MODAL_SRC, 'utf8');
const readSelection = () => readFileSync(SELECTION_SRC, 'utf8');
const readWorker = () => readFileSync(WORKER_SRC, 'utf8');

describe('STEP-09 · Drawing sheets', () => {
  it('the sheet composer exists', () => {
    expect(existsSync(MODAL_SRC)).toBe(true);
  });

  describe('F-010 · deleting a sheet', () => {
    it('does not derive the next active sheet from the stale array', () => {
      const src = readModal();
      const deleteBlock = src.slice(src.indexOf('handleDeleteSheet'));
      const body = deleteBlock.slice(0, 500);

      // The active id must be derived from the filtered list, not from the pre-delete one.
      expect(body).not.toMatch(/setActiveSheetId\(\s*sheets\[0\]\.id\s*\)/);
      expect(body).toMatch(/setActiveSheetId\(\s*next\[0\]/);
    });

    it('clears the selected viewport when the sheet it belonged to is deleted', () => {
      const src = readModal();
      const body = src.slice(src.indexOf('handleDeleteSheet'), src.indexOf('handleDeleteSheet') + 800);
      expect(body).toMatch(/setSelectedViewportId\(\s*null\s*\)/);
    });
  });

  describe('F-028 · views must follow the loaded model', () => {
    it('does not freeze the view list in a useState initialiser', () => {
      const src = readModal();
      // A `useState(() => ...)` that closes over `storeys` captures them once, at mount.
      expect(src).not.toMatch(/useState\(\s*\(\)\s*=>\s*\{[^}]*storeys/);
    });

    it('re-derives the views when the storeys change', () => {
      const src = readModal();
      expect(src).toMatch(/useEffect\(/);
      expect(src).toMatch(/\[storeys/);
    });

    it('does not hard-code the title block project name', () => {
      const src = readModal();
      expect(src).not.toMatch(/projectName\s*:\s*['"]BIM Project['"]/);
    });

    it('the worker parses the storey elevation', () => {
      const src = readWorker();
      expect(src).toMatch(/Elevation/);
    });

    it('the storey list uses the parsed elevation instead of a constant', () => {
      const src = readSelection();
      expect(src).not.toMatch(/elevation:\s*0\.0\s*[,}]/);
      expect(src).toMatch(/elevation:\s*node\./);
    });
  });

  describe('F-030 · scale and print', () => {
    it('the engine exposes a scale-fitting helper', () => {
      const engine = resolve(__dirname, '../services/drawingEngine.ts');
      expect(existsSync(engine)).toBe(true);
      const src = readFileSync(engine, 'utf8');
      expect(src).toMatch(/chooseSheetScale|fitScaleToBounds|scaleToFit/);
    });

    it('the print document uses a real page size', () => {
      const src = readModal();
      const printBlock = src.slice(src.indexOf('printSheet'));
      expect(printBlock).toMatch(/@page/);
      expect(printBlock).not.toMatch(/@page\s*\{[^}]*size:\s*auto/);
    });

    it('the print document passes millimetre page dimensions', () => {
      const src = readModal();
      const printBlock = src.slice(src.indexOf('printSheet'));
      expect(printBlock).toMatch(/size:\s*\$\{[^}]+\}mm/);
    });
  });
});
