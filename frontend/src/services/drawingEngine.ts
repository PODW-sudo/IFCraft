import * as THREE from 'three';
import type { GeometryData } from '../types/ifc';
import type {
  BimView,
  DrawingSheet,
  DrawingViewVectorData,
  VectorLineSegment,
  PaperSize,
  PaperOrientation
} from '../types/drawings';
import { PAPER_DIMENSIONS_MM } from '../types/drawings';
import { normalizeUnitScale } from './drawingSheets';

// Sheet-scale fitting lives in `drawingSheets.ts` (pure, unit-tested there); re-exported here
// because callers of the drawing engine already import their helpers from this module.
export { chooseSheetScale, chooseSheetScaleForView } from './drawingSheets';
// Native (non-passive) wheel zoom for the preview board. See `services/wheelZoom.ts`.
export { createWheelZoom } from './wheelZoom';

/**
 * Extracts 2D plan cut and projection lines from 3D IFC geometries at a given elevation.
 * Standard BIM cut plane is at +1.2m above finished floor level.
 */
export function extractPlanViewVectorData(
  geometries: GeometryData[],
  cutElevation: number,
  viewId: string,
  viewDepth: number = 3.5
): DrawingViewVectorData {
  const lines: VectorLineSegment[] = [];
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;

  const p1 = new THREE.Vector3();
  const p2 = new THREE.Vector3();
  const p3 = new THREE.Vector3();
  const mat = new THREE.Matrix4();

  const minFloor = cutElevation - viewDepth;

  for (let g = 0; g < geometries.length; g++) {
    const geom = geometries[g];
    const positions = geom.positions;
    const indices = geom.indices;
    if (!positions || positions.length === 0) continue;

    const hasMatrix = geom.matrix && geom.matrix.length === 16;
    if (hasMatrix) {
      mat.fromArray(geom.matrix!);
    }

    const isCutCandidate = geom.type.includes('Wall') || geom.type.includes('Column') || geom.type.includes('Window') || geom.type.includes('Door');

    const indexCount = indices && indices.length > 0 ? indices.length : positions.length / 3;

    for (let i = 0; i < indexCount; i += 3) {
      let i1: number, i2: number, i3: number;
      if (indices && indices.length > 0) {
        i1 = indices[i] * 3;
        i2 = indices[i + 1] * 3;
        i3 = indices[i + 2] * 3;
      } else {
        i1 = i * 3;
        i2 = (i + 1) * 3;
        i3 = (i + 2) * 3;
      }

      p1.set(positions[i1], positions[i1 + 1], positions[i1 + 2]);
      p2.set(positions[i2], positions[i2 + 1], positions[i2 + 2]);
      p3.set(positions[i3], positions[i3 + 1], positions[i3 + 2]);

      if (hasMatrix) {
        p1.applyMatrix4(mat);
        p2.applyMatrix4(mat);
        p3.applyMatrix4(mat);
      }

      // Check for horizontal plane intersection at y = cutElevation
      const y1 = p1.y;
      const y2 = p2.y;
      const y3 = p3.y;

      const minY = Math.min(y1, y2, y3);
      const maxY = Math.max(y1, y2, y3);

      if (minY <= cutElevation && maxY >= cutElevation) {
        const seg = intersectTriangleWithPlane(p1, p2, p3, cutElevation, 'y');
        if (seg) {
          lines.push({
            x1: seg.x1,
            y1: seg.z1,
            x2: seg.x2,
            y2: seg.z2,
            isCut: isCutCandidate,
            category: geom.type
          });

          minX = Math.min(minX, seg.x1, seg.x2);
          minZ = Math.min(minZ, seg.z1, seg.z2);
          maxX = Math.max(maxX, seg.x1, seg.x2);
          maxZ = Math.max(maxZ, seg.z1, seg.z2);
        }
      } else if (maxY < cutElevation && minY >= minFloor) {
        // Background projection lines (projected downwards onto 2D plan)
        // Sample triangle outline periodically to keep vector payload lightweight
        if (i % 6 === 0) {
          lines.push({
            x1: p1.x,
            y1: p1.z,
            x2: p2.x,
            y2: p2.z,
            isCut: false,
            category: geom.type
          });
          minX = Math.min(minX, p1.x, p2.x);
          minZ = Math.min(minZ, p1.z, p2.z);
          maxX = Math.max(maxX, p1.x, p2.x);
          maxZ = Math.max(maxZ, p1.z, p2.z);
        }
      }
    }
  }

  // Fallback bounds if empty
  if (!isFinite(minX)) {
    minX = -10;
    minZ = -10;
    maxX = 10;
    maxZ = 10;
  }

  return {
    viewId,
    lines,
    bounds: { minX, minY: minZ, maxX, maxY: maxZ }
  };
}

/**
 * Extracts 2D section cut and elevation projection lines along X or Z axis.
 */
export function extractSectionViewVectorData(
  geometries: GeometryData[],
  axis: 'x' | 'z',
  position: number,
  viewId: string,
  viewDepth: number = 20
): DrawingViewVectorData {
  const lines: VectorLineSegment[] = [];
  let minU = Infinity;
  let minY = Infinity;
  let maxU = -Infinity;
  let maxY = -Infinity;

  const p1 = new THREE.Vector3();
  const p2 = new THREE.Vector3();
  const p3 = new THREE.Vector3();
  const mat = new THREE.Matrix4();

  for (let g = 0; g < geometries.length; g++) {
    const geom = geometries[g];
    const positions = geom.positions;
    const indices = geom.indices;
    if (!positions || positions.length === 0) continue;

    const hasMatrix = geom.matrix && geom.matrix.length === 16;
    if (hasMatrix) {
      mat.fromArray(geom.matrix!);
    }

    const indexCount = indices && indices.length > 0 ? indices.length : positions.length / 3;

    for (let i = 0; i < indexCount; i += 3) {
      let i1: number, i2: number, i3: number;
      if (indices && indices.length > 0) {
        i1 = indices[i] * 3;
        i2 = indices[i + 1] * 3;
        i3 = indices[i + 2] * 3;
      } else {
        i1 = i * 3;
        i2 = (i + 1) * 3;
        i3 = (i + 2) * 3;
      }

      p1.set(positions[i1], positions[i1 + 1], positions[i1 + 2]);
      p2.set(positions[i2], positions[i2 + 1], positions[i2 + 2]);
      p3.set(positions[i3], positions[i3 + 1], positions[i3 + 2]);

      if (hasMatrix) {
        p1.applyMatrix4(mat);
        p2.applyMatrix4(mat);
        p3.applyMatrix4(mat);
      }

      const coord1 = axis === 'z' ? p1.z : p1.x;
      const coord2 = axis === 'z' ? p2.z : p2.x;
      const coord3 = axis === 'z' ? p3.z : p3.x;

      const minCoord = Math.min(coord1, coord2, coord3);
      const maxCoord = Math.max(coord1, coord2, coord3);

      if (minCoord <= position && maxCoord >= position) {
        // Intersects section cut plane
        const seg = intersectTriangleWithPlane(p1, p2, p3, position, axis);
        if (seg) {
          const u1 = axis === 'z' ? seg.x1 : seg.z1;
          const u2 = axis === 'z' ? seg.x2 : seg.z2;
          lines.push({
            x1: u1,
            y1: seg.y1,
            x2: u2,
            y2: seg.y2,
            isCut: true,
            category: geom.type
          });

          minU = Math.min(minU, u1, u2);
          minY = Math.min(minY, seg.y1, seg.y2);
          maxU = Math.max(maxU, u1, u2);
          maxY = Math.max(maxY, seg.y1, seg.y2);
        }
      } else if (Math.abs(minCoord - position) <= viewDepth) {
        // Background visible elevation geometry
        if (i % 6 === 0) {
          const u1 = axis === 'z' ? p1.x : p1.z;
          const u2 = axis === 'z' ? p2.x : p2.z;
          lines.push({
            x1: u1,
            y1: p1.y,
            x2: u2,
            y2: p2.y,
            isCut: false,
            category: geom.type
          });
          minU = Math.min(minU, u1, u2);
          minY = Math.min(minY, p1.y, p2.y);
          maxU = Math.max(maxU, u1, u2);
          maxY = Math.max(maxY, p1.y, p2.y);
        }
      }
    }
  }

  if (!isFinite(minU)) {
    minU = -10;
    minY = 0;
    maxU = 10;
    maxY = 10;
  }

  return {
    viewId,
    lines,
    bounds: { minX: minU, minY, maxX: maxU, maxY }
  };
}

/**
 * Computes intersection line between a 3D triangle and an axis-aligned plane.
 */
function intersectTriangleWithPlane(
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  p3: THREE.Vector3,
  planeVal: number,
  axis: 'x' | 'y' | 'z'
): { x1: number; y1: number; z1: number; x2: number; y2: number; z2: number } | null {
  const pts = [p1, p2, p3];
  const intersections: THREE.Vector3[] = [];

  for (let i = 0; i < 3; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 3];
    const va = axis === 'x' ? a.x : axis === 'y' ? a.y : a.z;
    const vb = axis === 'x' ? b.x : axis === 'y' ? b.y : b.z;

    if ((va <= planeVal && vb >= planeVal) || (vb <= planeVal && va >= planeVal)) {
      if (Math.abs(va - vb) > 0.000001) {
        const t = (planeVal - va) / (vb - va);
        const hit = new THREE.Vector3().lerpVectors(a, b, t);
        intersections.push(hit);
      }
    }
  }

  if (intersections.length >= 2) {
    return {
      x1: intersections[0].x,
      y1: intersections[0].y,
      z1: intersections[0].z,
      x2: intersections[1].x,
      y2: intersections[1].y,
      z2: intersections[1].z
    };
  }

  return null;
}

/**
 * Gets sheet physical dimensions in millimeters.
 */
export function getSheetDimensions(size: PaperSize, orientation: PaperOrientation): { width: number; height: number } {
  const format = PAPER_DIMENSIONS_MM[size] || PAPER_DIMENSIONS_MM.A3;
  if (orientation === 'portrait') {
    return {
      width: Math.min(format.width, format.height),
      height: Math.max(format.width, format.height)
    };
  }
  return {
    width: Math.max(format.width, format.height),
    height: Math.min(format.width, format.height)
  };
}

/**
 * Affine transform from view/model space (project units) to viewport-local sheet millimetres.
 * `scaleRatio` is millimetres on paper per project unit, i.e. `1000 * unitScale / scale`.
 */
export interface ViewportTransform {
  centerX: number;
  centerY: number;
  viewportCenterX: number;
  viewportCenterY: number;
  scaleRatio: number;
}

/**
 * Batches line segments into two SVG path strings (cut boundary + background projection).
 * One `<path>` per kind instead of one DOM node per segment: the export path and the sheet preview
 * both use this, so they can never disagree about the same vector data.
 */
export function buildViewportPathData(
  lines: VectorLineSegment[],
  t: ViewportTransform,
  precision = 2
): { cut: string; projection: string } {
  let cut = '';
  let projection = '';

  for (const l of lines) {
    // Invert Y because CAD plans have Y going up while SVG has Y going down.
    const sx1 = t.viewportCenterX + (l.x1 - t.centerX) * t.scaleRatio;
    const sy1 = t.viewportCenterY - (l.y1 - t.centerY) * t.scaleRatio;
    const sx2 = t.viewportCenterX + (l.x2 - t.centerX) * t.scaleRatio;
    const sy2 = t.viewportCenterY - (l.y2 - t.centerY) * t.scaleRatio;

    const cmd = `M ${sx1.toFixed(precision)} ${sy1.toFixed(precision)} L ${sx2.toFixed(precision)} ${sy2.toFixed(precision)} `;
    if (l.isCut) cut += cmd;
    else projection += cmd;
  }

  return { cut, projection };
}

/**
 * Ids that must be (re)computed for `next`, in `next` order: not cached yet, or their cut plane
 * moved since `previous`. Everything else keeps its cached geometry, so a geometry reload does not
 * throw away work and a single moved view does not rebuild the whole sheet.
 */
export function recomputeViewIds(
  previous: BimView[] | null,
  next: BimView[],
  cached: Map<string, DrawingViewVectorData>
): string[] {
  const priorById = new Map((previous ?? []).map((v) => [v.id, v]));

  return next
    .filter((v) => {
      if (!cached.has(v.id)) return true;
      const prior = priorById.get(v.id);
      if (!prior) return true;
      return (
        prior.cutPlane.axis !== v.cutPlane.axis ||
        prior.cutPlane.position !== v.cutPlane.position
      );
    })
    .map((v) => v.id);
}

/**
 * Compiles a full DrawingSheet with views and title block into a standalone architectural SVG.
 *
 * `unitScale` is metres per project unit (`0.001` for a millimetre IFC file, `1` for a metre file);
 * it defaults to `1` so existing callers keep working.
 */
export function exportSheetToSvg(
  sheet: DrawingSheet,
  viewDataMap: Map<string, DrawingViewVectorData>,
  unitScale?: number | null
): string {
  const { width, height } = getSheetDimensions(sheet.paperSize, sheet.orientation);

  // Margins in mm: Left margin 20mm for binding, others 10mm
  const marginL = 20;
  const marginR = 10;
  const marginT = 10;
  const marginB = 10;

  const innerW = width - marginL - marginR;
  const innerH = height - marginT - marginB;

  // Title block dimensions (Standard ISO 185mm wide x 55mm high in bottom-right corner)
  const tbW = Math.min(185, innerW * 0.45);
  const tbH = Math.min(55, innerH * 0.35);
  const tbX = width - marginR - tbW;
  const tbY = height - marginB - tbH;

  const info = sheet.projectInfo;
  const metresPerUnit = normalizeUnitScale(unitScale);

  let viewportsSvg = '';

  sheet.viewports.forEach((vp) => {
    const data = viewDataMap.get(vp.viewId);
    // 1:100 means 1 m of model = 10 mm on paper; in project units that is
    // 1000 * (metres per unit) / scale mm per unit (mm file: 1 unit -> 1 mm at 1:100).
    const scaleRatio = (1000 * metresPerUnit) / vp.scale;

    // Viewport position on sheet in mm
    const vx = vp.x;
    const vy = vp.y;
    const vw = vp.width;
    const vh = vp.height;

    let pathCut = '';
    let pathProj = '';

    if (data && data.lines.length > 0) {
      const centerX = (data.bounds.minX + data.bounds.maxX) / 2;
      const centerY = (data.bounds.minY + data.bounds.maxY) / 2;

      const batched = buildViewportPathData(data.lines, {
        centerX,
        centerY,
        viewportCenterX: vx + vw / 2,
        viewportCenterY: vy + vh / 2,
        scaleRatio
      });
      pathCut = batched.cut;
      pathProj = batched.projection;
    }

    // Viewport title callout bubble (Standard BIM: detail # in circle, title text, scale text)
    const calloutY = vy + vh + 12;
    const calloutBubbleX = vx + 10;

    viewportsSvg += `
      <!-- Viewport Frame -->
      <g id="viewport-${vp.id}">
        <clipPath id="clip-${vp.id}">
          <rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" />
        </clipPath>
        
        <rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" 
          fill="none" stroke="${vp.showFrame ? 'lightgray' : 'none'}" stroke-width="0.3" stroke-dasharray="2,2" />

        <g clip-path="url(#clip-${vp.id})">
          <!-- Background Projection Lines -->
          <path d="${pathProj}" fill="none" stroke="slategray" stroke-width="0.2" opacity="0.65" />
          <!-- Heavy Cut Lines (Poche) -->
          <path d="${pathCut}" fill="none" stroke="black" stroke-width="0.6" stroke-linecap="round" stroke-linejoin="round" />
        </g>

        <!-- Viewport Title Callout -->
        <g id="title-${vp.id}" font-family="system-ui, -apple-system, sans-serif">
          <circle cx="${calloutBubbleX}" cy="${calloutY}" r="5" fill="white" stroke="black" stroke-width="0.5" />
          <text x="${calloutBubbleX}" y="${calloutY + 1.6}" font-size="3.6" font-weight="700" text-anchor="middle" fill="black">${vp.detailNumber}</text>
          
          <line x1="${calloutBubbleX + 7}" y1="${calloutY}" x2="${vx + vw}" y2="${calloutY}" stroke="black" stroke-width="0.4" />
          
          <text x="${calloutBubbleX + 8}" y="${calloutY - 2}" font-size="3.8" font-weight="700" fill="black" letter-spacing="0.2">${escapeXml(vp.viewName.toUpperCase())}</text>
          <text x="${calloutBubbleX + 8}" y="${calloutY + 4.5}" font-size="2.6" font-weight="500" fill="dimgray">SCALE 1:${vp.scale}</text>
        </g>
      </g>
    `;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     width="${width}mm" 
     height="${height}mm" 
     viewBox="0 0 ${width} ${height}">
  <style>
    .sheet-bg { fill: white; }
    .border-outer { stroke: black; stroke-width: 0.6; fill: none; }
    .border-inner { stroke: black; stroke-width: 0.35; fill: none; }
    .grid-coord { font-family: system-ui, -apple-system, sans-serif; font-size: 3mm; fill: dimgray; font-weight: 600; text-anchor: middle; }
    .tb-line { stroke: black; stroke-width: 0.35; }
    .tb-label { font-family: system-ui, -apple-system, sans-serif; font-size: 2.2mm; fill: dimgray; font-weight: 500; }
    .tb-val { font-family: system-ui, -apple-system, sans-serif; font-size: 2.9mm; fill: black; font-weight: 700; }
    .tb-title { font-family: system-ui, -apple-system, sans-serif; font-size: 4.2mm; fill: black; font-weight: 800; }
    .tb-sheet-num { font-family: system-ui, -apple-system, sans-serif; font-size: 6.5mm; fill: black; font-weight: 900; }
  </style>

  <!-- Sheet Paper Background -->
  <rect width="${width}" height="${height}" class="sheet-bg" />

  <!-- Sheet Border Lines (Outer & Inner Drawing Frame) -->
  <rect x="5" y="5" width="${width - 10}" height="${height - 10}" class="border-outer" />
  <rect x="${marginL}" y="${marginT}" width="${innerW}" height="${innerH}" class="border-inner" />

  <!-- Title Block Frame (Bottom Right ISO standard) -->
  <g id="title-block">
    <rect x="${tbX}" y="${tbY}" width="${tbW}" height="${tbH}" fill="white" stroke="black" stroke-width="0.5" />
    
    <!-- Title Block Horizontal Dividers -->
    <line x1="${tbX}" y1="${tbY + 16}" x2="${tbX + tbW}" y2="${tbY + 16}" class="tb-line" />
    <line x1="${tbX}" y1="${tbY + 36}" x2="${tbX + tbW}" y2="${tbY + 36}" class="tb-line" />
    
    <!-- Title Block Vertical Dividers -->
    <line x1="${tbX + tbW * 0.6}" y1="${tbY + 36}" x2="${tbX + tbW * 0.6}" y2="${tbY + tbH}" class="tb-line" />
    
    <!-- Row 1: Project Metadata -->
    <text x="${tbX + 4}" y="${tbY + 5}" class="tb-label">PROJECT</text>
    <text x="${tbX + 4}" y="${tbY + 11}" class="tb-val">${escapeXml(info.projectName)}</text>
    
    <!-- Row 2: Sheet Title -->
    <text x="${tbX + 4}" y="${tbY + 21}" class="tb-label">DRAWING TITLE</text>
    <text x="${tbX + 4}" y="${tbY + 30}" class="tb-title">${escapeXml(sheet.sheetTitle)}</text>
    
    <!-- Row 3: Details (Author, Date, Scale) -->
    <text x="${tbX + 4}" y="${tbY + 41}" class="tb-label">DATE / AUTHOR</text>
    <text x="${tbX + 4}" y="${tbY + 48}" class="tb-val">${escapeXml(info.date)} &bull; ${escapeXml(info.author)}</text>
    
    <!-- Row 3 Right: Sheet Number -->
    <text x="${tbX + tbW * 0.6 + 4}" y="${tbY + 41}" class="tb-label">SHEET NO.</text>
    <text x="${tbX + tbW * 0.6 + 4}" y="${tbY + 50}" class="tb-sheet-num">${escapeXml(sheet.sheetNumber)}</text>
  </g>

  <!-- Viewports Content -->
  ${viewportsSvg}
</svg>`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Triggers a browser download of the generated SVG sheet.
 */
export function downloadSvgFile(filename: string, svgContent: string): void {
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface PrintPageSize {
  /** Paper width in millimetres. */
  width: number;
  /** Paper height in millimetres. */
  height: number;
}

/** A3 landscape: the Sheet Composer's default paper, used when a caller does not pass a size. */
export const DEFAULT_PRINT_PAGE_SIZE: PrintPageSize = { width: 420, height: 297 };

/**
 * Opens browser print dialog for the generated SVG sheet at its real paper size.
 */
export function printSheet(svgContent: string, pageSize: PrintPageSize = DEFAULT_PRINT_PAGE_SIZE): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(buildPrintDocument(svgContent, pageSize));
  printWindow.document.close();
}

/**
 * Builds the print-ready HTML document for a sheet SVG.
 *
 * The `@page` rule carries the sheet's physical size in millimetres and the `<svg>` is addressed at
 * that same natural size, so the browser prints at scale instead of stretching the drawing to the
 * default Letter page (`size: auto` + `100vw` was printed neither A3 nor 1:100).
 *
 * Declared after `printSheet` on purpose: `printSheet` is the only importer and function
 * declarations hoist, which keeps the print dialog plumbing and the print CSS adjacent to read.
 */
export function buildPrintDocument(svgContent: string, pageSize: PrintPageSize = DEFAULT_PRINT_PAGE_SIZE): string {
  const width = pageSize.width;
  const height = pageSize.height;

  return `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Print Drawing Sheet</title>
        <style>
          @page { size: ${width}mm ${height}mm; margin: 0; }
          html, body { margin: 0; padding: 0; background: white; }
          svg { display: block; width: ${width}mm; height: ${height}mm; }
        </style>
      </head>
      <body>
        ${svgContent}
        <script>
          window.onload = () => {
            window.print();
            window.onafterprint = () => window.close();
          };
        </script>
      </body>
    </html>`;
}

