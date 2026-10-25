/**
 * STEP-29 — Property Inspector edits must actually persist (F-066).
 *
 * The canonical upstream test for this step is a backend contract test
 * (`docs/audit-2026-10/tests/backend/test_step29_property_edit_persistence.py`) whose first
 * assertion parses the inspector call site. That assertion is ported here so the client
 * contract is guarded by the frontend suite as well, together with the pure request
 * builder and the row-level failure behaviour the backend test could only document.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  buildPropertyUpdateRequest,
  coercePropertyValue,
  isPropertyValueUnchanged,
  PropertyValueError
} from '../services/propertyUpdate';
import type { ElementDetails, PropertySingle } from '../types/ifc';

const apiMocks = vi.hoisted(() => ({
  updateElementProperty: vi.fn(),
  getElementDetails: vi.fn()
}));

vi.mock('../services/api', () => ({
  updateElementProperty: apiMocks.updateElementProperty,
  getElementDetails: apiMocks.getElementDetails
}));

// `?raw` keeps the contract check free of node typings (the app tsconfig has no @types/node).
const inspectorSources = import.meta.glob('../components/properties/GlassPropertyInspector.tsx', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

const INSPECTOR_SRC = inspectorSources['../components/properties/GlassPropertyInspector.tsx'];

const detailsFor = (expressId: number): ElementDetails => ({
  express_id: expressId,
  global_id: `guid-${expressId}`,
  name: `Element ${expressId}`,
  type: 'IfcWall',
  psets: [
    {
      name: 'Pset_WallCommon',
      properties: [{ name: 'FireRating', value: 'REI30', value_type: 'IfcLabel' }]
    }
  ],
  quantities: {}
});

/** The `<GlassPropertyInspector>` is imported lazily so the source contract can be read first. */
async function renderInspector(props: {
  expressId: number;
  details?: ElementDetails | null;
  onPropertyUpdated?: (id: number) => void;
}) {
  const { GlassPropertyInspector } = await import('../components/properties/GlassPropertyInspector');
  return render(
    <GlassPropertyInspector
      projectId="p1"
      expressId={props.expressId}
      isOpen
      onClose={() => {}}
      details={props.details}
      onPropertyUpdated={props.onPropertyUpdated}
    />
  );
}

function clickEdit() {
  const btn = document.querySelector('[data-qa="property-edit-btn"]');
  expect(btn).not.toBeNull();
  fireEvent.click(btn as Element);
}

function typeAndSave(value: string) {
  const input = document.querySelector('[data-qa="property-edit-input"]') as HTMLInputElement;
  expect(input).not.toBeNull();
  fireEvent.change(input, { target: { value } });
  fireEvent.click(document.querySelector('[data-qa="property-save-btn"]') as Element);
}

beforeEach(() => {
  apiMocks.updateElementProperty.mockReset();
  apiMocks.getElementDetails.mockReset();
});

describe('STEP-29 inspector call-site contract', () => {
  it('sends every /properties request with POST and property_name', () => {
    expect(INSPECTOR_SRC, 'inspector source not found').toBeTruthy();

    // Port of test_frontend_edit_request_matches_the_backend_contract.
    const calls: string[] = [];
    for (const match of INSPECTOR_SRC.matchAll(/fetch\(\s*`[^`]*?\/properties`/g)) {
      const start = match.index ?? 0;
      const end = INSPECTOR_SRC.indexOf('});', start);
      expect(end, 'could not delimit a fetch() call').toBeGreaterThan(-1);
      calls.push(INSPECTOR_SRC.slice(start, end + 3));
    }

    for (const [index, call] of calls.entries()) {
      const method = /method:\s*'([A-Z]+)'/.exec(call);
      expect(method, `fetch call #${index} has no explicit method`).not.toBeNull();
      expect(method![1], `fetch call #${index} must be POST; the route is POST-only (405)`).toBe('POST');

      const body = /body:\s*JSON\.stringify\(\s*\{(.*?)\}\s*\)/s.exec(call);
      expect(body, `fetch call #${index} has no JSON body`).not.toBeNull();
      expect(body![1], `fetch call #${index} must send property_name (422 otherwise)`).toContain(
        'property_name'
      );
    }
  });

  it('never sends PATCH and routes the edit through the shared request builder', () => {
    expect(INSPECTOR_SRC).not.toContain("'PATCH'");
    expect(INSPECTOR_SRC).toContain('buildPropertyUpdateRequest(');
    expect(INSPECTOR_SRC).toContain('api.updateElementProperty(');
    // The unchanged-value guard must run before the write is issued.
    expect(INSPECTOR_SRC.indexOf('isPropertyValueUnchanged(')).toBeGreaterThan(-1);
    expect(INSPECTOR_SRC.indexOf('isPropertyValueUnchanged(')).toBeLessThan(
      INSPECTOR_SRC.indexOf('await api.updateElementProperty(')
    );
  });

  it('surfaces write failures instead of only console.error', () => {
    expect(INSPECTOR_SRC).not.toContain("console.error('Failed to save property:'");
    expect(INSPECTOR_SRC).not.toContain("console.error('Failed to add property:'");
    expect(INSPECTOR_SRC).toContain('property-row-error');
  });
});

describe('STEP-29 property payload', () => {
  it('coerces the typed text to the IFC value type', () => {
    expect(coercePropertyValue('true', 'IfcBoolean')).toBe(true);
    expect(coercePropertyValue('False', 'IfcBoolean')).toBe(false);
    expect(coercePropertyValue('42', 'IfcInteger')).toBe(42);
    expect(coercePropertyValue('3.5', 'IfcReal')).toBe(3.5);
    expect(coercePropertyValue('REI60', 'IfcLabel')).toBe('REI60');
    expect(coercePropertyValue('REI60', undefined)).toBe('REI60');
  });

  it('rejects input it cannot coerce instead of sending null', () => {
    expect(() => coercePropertyValue('abc', 'IfcInteger')).toThrow(PropertyValueError);
    expect(() => coercePropertyValue('', 'IfcReal')).toThrow(PropertyValueError);
    expect(() => coercePropertyValue('maybe', 'IfcBoolean')).toThrow(PropertyValueError);
  });

  it('builds a POST body with property_name and value_type', () => {
    const prop: PropertySingle = { name: 'FireRating', value: 'REI30', value_type: 'IfcLabel' };
    const req = buildPropertyUpdateRequest('p1', 205, 'Pset_WallCommon', prop, 'REI60');

    expect(req.method).toBe('POST');
    expect(req.url).toBe('/api/projects/p1/elements/205/properties');
    expect(req.body).toEqual({
      pset_name: 'Pset_WallCommon',
      property_name: 'FireRating',
      value: 'REI60',
      value_type: 'IfcLabel'
    });
    expect(req.body).not.toHaveProperty('name');
  });

  it('reuses the property value type and defaults to IfcLabel', () => {
    const boolean = buildPropertyUpdateRequest('p1', 7, 'Pset_X', {
      name: 'IsExternal',
      value: false,
      value_type: 'IfcBoolean'
    });
    expect(boolean.body.value).toBe(false);
    expect(boolean.body.value_type).toBe('IfcBoolean');

    const untyped = buildPropertyUpdateRequest('p1', 7, 'Pset_X', { name: 'Note', value: 'n/a' });
    expect(untyped.body.value_type).toBe('IfcLabel');
  });

  it('detects an unchanged value', () => {
    expect(isPropertyValueUnchanged('REI30', 'REI30')).toBe(true);
    expect(isPropertyValueUnchanged('REI30 ', 'REI30')).toBe(true);
    expect(isPropertyValueUnchanged(42, 42)).toBe(true);
    expect(isPropertyValueUnchanged(true, true)).toBe(true);
    expect(isPropertyValueUnchanged('REI30', 'REI60')).toBe(false);
    expect(isPropertyValueUnchanged(false, true)).toBe(false);
    expect(isPropertyValueUnchanged(3.5, 3.6)).toBe(false);
  });
});

describe('STEP-29 inspector behaviour', () => {
  it('issues no element GET when details are provided and writes a POST body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    apiMocks.updateElementProperty.mockResolvedValue(undefined);
    const onPropertyUpdated = vi.fn();

    await renderInspector({ expressId: 205, details: detailsFor(205), onPropertyUpdated });
    expect(fetchSpy).not.toHaveBeenCalled();

    clickEdit();
    typeAndSave('REI60');

    await waitFor(() => expect(apiMocks.updateElementProperty).toHaveBeenCalledTimes(1));
    expect(apiMocks.updateElementProperty).toHaveBeenCalledWith('p1', 205, {
      pset_name: 'Pset_WallCommon',
      property_name: 'FireRating',
      value: 'REI60',
      value_type: 'IfcLabel'
    });
    await waitFor(() => expect(onPropertyUpdated).toHaveBeenCalledWith(205));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sends no request when the value is unchanged', async () => {
    await renderInspector({ expressId: 205, details: detailsFor(205) });

    clickEdit();
    typeAndSave('REI30');

    await waitFor(() => expect(document.querySelector('[data-qa="property-edit-input"]')).toBeNull());
    expect(apiMocks.updateElementProperty).not.toHaveBeenCalled();
  });

  it('reverts the value and shows a persistent inline error when the save fails', async () => {
    apiMocks.updateElementProperty.mockRejectedValue(
      new Error('Failed to update property: 422 Unprocessable Entity')
    );

    await renderInspector({ expressId: 205, details: detailsFor(205) });

    clickEdit();
    typeAndSave('REI60');

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Failed to update property: 422');
    // The editor stays open with the typed text intact (spec 10)...
    expect(screen.getByDisplayValue('REI60')).toBeInTheDocument();
    expect(document.querySelector('[data-qa="property-row-error"]')).not.toBeNull();

    // ...and the optimistic value was reverted underneath it.
    fireEvent.click(document.querySelector('[data-qa="property-cancel-btn"]') as Element);
    expect(screen.getByText('REI30')).toBeInTheDocument();
    expect(screen.queryByText('REI60')).toBeNull();
  });

  it('never renders details belonging to another express id', async () => {
    await renderInspector({ expressId: 999, details: detailsFor(205) });

    expect(screen.queryByText('Element 205')).toBeNull();
    expect(screen.queryByText('REI30')).toBeNull();
    expect(screen.getByText(/Loading metadata/)).toBeInTheDocument();
  });
});
