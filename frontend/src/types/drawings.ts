export type BimViewType = 'plan' | 'section' | 'elevation' | 'detail';

export interface BimCutPlane {
  axis: 'x' | 'y' | 'z';
  position: number;
  inverted?: boolean;
}

export interface BimView {
  id: string;
  name: string;
  type: BimViewType;
  storeyId?: string | number;
  elevation?: number;
  cutPlane: BimCutPlane;
  scale: number; // e.g. 50, 100, 200
  createdAt: string;
}

export type PaperSize = 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'ArchD' | 'ArchE';
export type PaperOrientation = 'landscape' | 'portrait';

export interface PaperFormat {
  width: number;
  height: number;
  title: string;
}

export const PAPER_DIMENSIONS_MM: Record<PaperSize, PaperFormat> = {
  A0: { width: 1189, height: 841, title: 'ISO A0 (1189 x 841 mm)' },
  A1: { width: 841, height: 594, title: 'ISO A1 (841 x 594 mm)' },
  A2: { width: 594, height: 420, title: 'ISO A2 (594 x 420 mm)' },
  A3: { width: 420, height: 297, title: 'ISO A3 (420 x 297 mm)' },
  A4: { width: 297, height: 210, title: 'ISO A4 (297 x 210 mm)' },
  ArchD: { width: 914, height: 610, title: 'ANSI Arch D (36 x 24 in)' },
  ArchE: { width: 1219, height: 914, title: 'ANSI Arch E (48 x 36 in)' }
};

export interface SheetViewport {
  id: string;
  viewId: string;
  viewName: string;
  viewType: BimViewType;
  x: number; // mm on sheet from left
  y: number; // mm on sheet from top
  width: number; // mm on sheet
  height: number; // mm on sheet
  scale: number; // e.g. 100 for 1:100
  detailNumber: number;
  showTitle?: boolean;
  showFrame?: boolean;
}

export interface SheetProjectInfo {
  projectName: string;
  projectNumber: string;
  client: string;
  author: string;
  date: string;
  revision: string;
  status: string;
}

export interface DrawingSheet {
  id: string;
  sheetNumber: string; // e.g. "A-101"
  sheetTitle: string; // e.g. "GROUND FLOOR PLAN & SECTION A-A"
  paperSize: PaperSize;
  orientation: PaperOrientation;
  projectInfo: SheetProjectInfo;
  viewports: SheetViewport[];
}

export interface VectorLineSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isCut: boolean; // true = bold cut line (poché boundary), false = light projection line
  category?: string;
}

export interface DrawingViewVectorData {
  viewId: string;
  lines: VectorLineSegment[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

export const ARCHITECTURAL_SCALES = [
  { value: 20, label: '1:20 (Detail)' },
  { value: 50, label: '1:50 (Component)' },
  { value: 100, label: '1:100 (Floor Plan / Section)' },
  { value: 200, label: '1:200 (General Layout)' },
  { value: 500, label: '1:500 (Site / Overview)' }
] as const;
