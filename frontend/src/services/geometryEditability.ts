/**
 * STEP-21 / issue 1.3 — which selections can take a parametric geometry edit?
 *
 * The backend refuses height/thickness/width/depth edits unless the element is an
 * `IfcWall` (any subtype) or an `IfcColumn`; everything else answers
 * `409 {"detail": {"code": "unsupported_geometry", ...}}`. Elevation is a placement edit and
 * stays available for every type.
 *
 * Keeping the rule here (instead of inline in the dock) means the UI and its tests share one
 * definition, and it can be widened without touching JSX.
 */

/** Shown next to greyed-out dimension fields; short enough for the dock pill. */
export const NON_RESIZABLE_GEOMETRY_HINT = 'Not resizable — walls & columns only';

/** Tooltip copy with the full reason. */
export const NON_RESIZABLE_GEOMETRY_TITLE =
  'Height and thickness edits are supported for walls and columns only';

export interface GeometryEditability {
  /** True when height/thickness edits will be accepted. */
  resizable: boolean;
  canEditHeight: boolean;
  canEditThickness: boolean;
  /** Short hint for the dock; `null` when the fields are editable. */
  hint: string | null;
  /** Tooltip for a disabled field; `null` when the fields are editable. */
  title: string | null;
}

function normalizeType(entityType: string | null | undefined): string {
  return typeof entityType === 'string' ? entityType.trim() : '';
}

function isColumnType(entityType: string): boolean {
  // `IfcColumnStandardCase` is still a column subtype in IFC4.
  return entityType === 'IfcColumn' || entityType === 'IfcColumnStandardCase';
}

function isWallType(entityType: string): boolean {
  // `IfcWallElementedCase` / `IfcWallStandardCase` are wall subtypes in IFC4.
  return entityType.startsWith('IfcWall');
}

export function describeGeometryEditability(
  entityType: string | null | undefined
): GeometryEditability {
  const type = normalizeType(entityType);
  const resizable = isWallType(type) || isColumnType(type);
  return {
    resizable,
    canEditHeight: resizable,
    // The backend widens an `IfcWall` profile; columns are rebuilt from width/depth/height.
    canEditThickness: isWallType(type),
    hint: resizable ? null : NON_RESIZABLE_GEOMETRY_HINT,
    title: resizable ? null : NON_RESIZABLE_GEOMETRY_TITLE
  };
}
