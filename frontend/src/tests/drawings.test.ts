import { describe, it, expect } from 'vitest';
import type { GeometryData } from '../types/ifc';
import type { DrawingSheet } from '../types/drawings';
import {
  extractPlanViewVectorData,
  extractSectionViewVectorData,
  getSheetDimensions,
  exportSheetToSvg
} from '../services/drawingEngine';

describe('BIM Drawing Engine', () => {
  // Mock wall box geometry: 10m long (X: 0 to 10), 0.3m thick (Z: 0 to 0.3), 3m high (Y: 0 to 3)
  const mockWallGeometry: GeometryData = {
    expressID: 101,
    type: 'IfcWallStandardCase',
    matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    color: [0.8, 0.8, 0.8, 1.0],
    positions: new Float32Array([
      // Front face
      0, 0, 0,
      10, 0, 0,
      10, 3, 0,
      0, 0, 0,
      10, 3, 0,
      0, 3, 0,
      // Back face
      0, 0, 0.3,
      10, 0, 0.3,
      10, 3, 0.3,
      0, 0, 0.3,
      10, 3, 0.3,
      0, 3, 0.3
    ]),
    normals: new Float32Array(36),
    indices: new Uint32Array([
      0, 1, 2, 3, 4, 5,
      6, 7, 8, 9, 10, 11
    ])
  };

  it('extracts horizontal plan cut lines at +1.2m elevation', () => {
    const planData = extractPlanViewVectorData([mockWallGeometry], 1.2, 'test-plan-1');

    expect(planData.viewId).toBe('test-plan-1');
    expect(planData.lines.length).toBeGreaterThan(0);

    const cutLines = planData.lines.filter((l) => l.isCut);
    expect(cutLines.length).toBeGreaterThan(0);

    // Wall X coordinates span from 0 to 10
    expect(planData.bounds.minX).toBeCloseTo(0);
    expect(planData.bounds.maxX).toBeCloseTo(10);
  });

  it('extracts vertical cross section cut lines along X=5.0m', () => {
    const sectionData = extractSectionViewVectorData([mockWallGeometry], 'x', 5.0, 'test-section-1');

    expect(sectionData.viewId).toBe('test-section-1');
    expect(sectionData.lines.length).toBeGreaterThan(0);

    const cutLines = sectionData.lines.filter((l) => l.isCut);
    expect(cutLines.length).toBeGreaterThan(0);

    // Height spans up to 3m
    expect(sectionData.bounds.maxY).toBeCloseTo(3.0);
  });

  it('computes correct paper dimensions for ISO and ANSI paper standards', () => {
    const a3Landscape = getSheetDimensions('A3', 'landscape');
    expect(a3Landscape.width).toBe(420);
    expect(a3Landscape.height).toBe(297);

    const a3Portrait = getSheetDimensions('A3', 'portrait');
    expect(a3Portrait.width).toBe(297);
    expect(a3Portrait.height).toBe(420);

    const a1Landscape = getSheetDimensions('A1', 'landscape');
    expect(a1Landscape.width).toBe(841);
    expect(a1Landscape.height).toBe(594);

    const archD = getSheetDimensions('ArchD', 'landscape');
    expect(archD.width).toBe(914);
    expect(archD.height).toBe(610);
  });

  it('compiles standalone architectural SVG sheet with title block and scaled viewports', () => {
    const planData = extractPlanViewVectorData([mockWallGeometry], 1.2, 'v1');

    const sheet: DrawingSheet = {
      id: 'sheet-1',
      sheetNumber: 'A-101',
      sheetTitle: 'GROUND FLOOR PLAN',
      paperSize: 'A3',
      orientation: 'landscape',
      projectInfo: {
        projectName: 'Villa Savoye BIM',
        projectNumber: 'PRJ-2026-99',
        client: 'Architectural Heritage',
        author: 'Corbusier Studio',
        date: '2026-10-22',
        revision: 'Rev 0',
        status: 'For Approval'
      },
      viewports: [
        {
          id: 'vp-1',
          viewId: 'v1',
          viewName: 'Ground Floor Plan',
          viewType: 'plan',
          x: 35,
          y: 30,
          width: 180,
          height: 120,
          scale: 100,
          detailNumber: 1,
          showTitle: true,
          showFrame: true
        }
      ]
    };

    const viewDataMap = new Map();
    viewDataMap.set('v1', planData);

    const svg = exportSheetToSvg(sheet, viewDataMap);

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="420mm"');
    expect(svg).toContain('height="297mm"');
    expect(svg).toContain('A-101');
    expect(svg).toContain('GROUND FLOOR PLAN');
    expect(svg).toContain('Villa Savoye BIM');
    expect(svg).toContain('SCALE 1:100');
    expect(svg).toContain('id="viewport-vp-1"');
    expect(svg).toContain('id="title-block"');
  });
});
