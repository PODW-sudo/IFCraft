/**
 * Property-update request construction and value coercion (STEP-14 / STEP-29 / F-066).
 *
 * The backend has exactly one property-write route:
 *
 *   POST /api/projects/{project_id}/elements/{express_id}/properties
 *   body: { pset_name, property_name, value, value_type }   -> 200
 *
 * `PropertyUpdatePayload` (backend/app/models/schemas.py) requires `property_name`.
 * The legacy `name` field is rejected with 422, and `PATCH` is rejected with 405.
 * Building the request here (instead of inline at the call site) keeps the verb and
 * the field names in one place so they cannot drift apart again.
 */

/** Minimal shape needed to edit one existing property value. */
export interface EditableProperty {
  name: string;
  value: unknown;
  value_type?: string | null;
}

export type PropertyValue = string | number | boolean;

export interface PropertyUpdateBody {
  pset_name: string;
  property_name: string;
  value: PropertyValue;
  value_type: string;
}

export interface PropertyUpdateRequest {
  url: string;
  method: 'POST';
  body: PropertyUpdateBody;
}

/** Default IFC measure type, matching `PropertyUpdatePayload.value_type = "IfcLabel"`. */
export const DEFAULT_VALUE_TYPE = 'IfcLabel';

/** Thrown when the typed text cannot represent the property's IFC measure type. */
export class PropertyValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PropertyValueError';
  }
}

/**
 * Integer-valued IFC measures.
 * Kept explicit so a typo in a type name degrades to a string, not to a truncated number.
 */
const INTEGER_VALUE_TYPES = new Set(['IfcInteger', 'IfcCountMeasure']);

/**
 * Real-valued IFC measures. `IfcReal` is the generic one; the length/area/... measures
 * are retained from the previous inspector behaviour, which coerced them to floats so a
 * `Pset` length edit does not get stored as the label "3.5".
 */
const REAL_VALUE_TYPES = new Set([
  'IfcReal',
  'IfcLengthMeasure',
  'IfcPositiveLengthMeasure',
  'IfcNonNegativeLengthMeasure',
  'IfcAreaMeasure',
  'IfcVolumeMeasure',
  'IfcPlaneAngleMeasure',
  'IfcMassMeasure',
  'IfcTimeMeasure',
  'IfcRatioMeasure',
  'IfcNormalisedRatioMeasure',
  'IfcPositiveRatioMeasure'
]);

/** Strips a schema namespace, e.g. `IFC4.IfcLabel` -> `IfcLabel`. */
function normaliseValueType(valueType?: string | null): string {
  const raw = (valueType ?? '').trim();
  if (!raw) return DEFAULT_VALUE_TYPE;
  const tail = raw.split('.').pop() ?? raw;
  return tail || DEFAULT_VALUE_TYPE;
}

function isRealType(valueType: string): boolean {
  return REAL_VALUE_TYPES.has(valueType) || valueType.endsWith('Measure');
}

/**
 * Coerces user input to the JavaScript type implied by the IFC value type:
 * `IfcBoolean` -> boolean, `IfcInteger` -> integer, `IfcReal`/`*Measure` -> float,
 * anything else -> string (STEP-29 spec 3).
 *
 * Throws `PropertyValueError` instead of returning `NaN`/`null`: `parseInt('abc')` used to
 * serialise as `null` over JSON, which wrote nothing and reported success.
 */
export function coercePropertyValue(raw: unknown, valueType?: string | null): PropertyValue {
  const type = normaliseValueType(valueType);
  const text = raw === null || raw === undefined ? '' : String(raw).trim();

  if (type === 'IfcBoolean') {
    const lowered = text.toLowerCase();
    if (lowered === 'true' || lowered === '1') return true;
    if (lowered === 'false' || lowered === '0') return false;
    throw new PropertyValueError(`Expected true or false for ${type}.`);
  }

  if (INTEGER_VALUE_TYPES.has(type)) {
    if (!/^[+-]?\d+$/.test(text)) {
      throw new PropertyValueError(`Expected a whole number for ${type}.`);
    }
    const parsed = Number(text);
    if (!Number.isSafeInteger(parsed)) {
      throw new PropertyValueError(`Value is out of range for ${type}.`);
    }
    return parsed;
  }

  if (isRealType(type)) {
    if (text === '') {
      throw new PropertyValueError(`Expected a number for ${type}.`);
    }
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) {
      throw new PropertyValueError(`Expected a number for ${type}.`);
    }
    return parsed;
  }

  return text;
}

/**
 * `true` when saving `next` would write the value the element already has, in which case
 * no request is sent (STEP-29 spec 6).
 */
export function isPropertyValueUnchanged(current: unknown, next: PropertyValue): boolean {
  if (current === next) return true;
  if (current === null || current === undefined) {
    return next === '' || (typeof next === 'string' && next.trim() === '');
  }
  if (typeof current === 'boolean' || typeof next === 'boolean') {
    return String(current).toLowerCase() === String(next).toLowerCase();
  }
  if (typeof current === 'number' || typeof next === 'number') {
    const a = Number(current);
    const b = Number(next);
    return Number.isFinite(a) && Number.isFinite(b) && a === b;
  }
  return String(current).trim() === String(next).trim();
}

/**
 * Builds the property-write request for the single backend route.
 *
 * `rawValue` is the text the user typed. When omitted the property's current value is
 * re-coerced, which keeps the builder usable for callers that already hold a typed value.
 */
export function buildPropertyUpdateRequest(
  projectId: string,
  expressId: number,
  psetName: string,
  prop: EditableProperty,
  rawValue?: unknown
): PropertyUpdateRequest {
  const valueType = normaliseValueType(prop.value_type);
  const source = rawValue === undefined ? prop.value : rawValue;

  return {
    url: `/api/projects/${projectId}/elements/${expressId}/properties`,
    method: 'POST',
    body: {
      pset_name: psetName,
      property_name: prop.name,
      value: coercePropertyValue(source, valueType),
      value_type: valueType
    }
  };
}
