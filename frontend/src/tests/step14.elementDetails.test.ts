import { describe, it, expect } from 'vitest';
import { ElementDetailsLoader } from '../services/elementDetailsLoader';
import { buildPropertyUpdateRequest } from '../services/propertyUpdate';
import type { ElementDetails, PropertySingle } from '../types/ifc';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const detailsFor = (expressId: number): ElementDetails => ({
  express_id: expressId,
  global_id: `guid-${expressId}`,
  name: `Element ${expressId}`,
  type: 'IfcWall',
  psets: [],
  quantities: {}
});

describe('STEP-14 element details ordering', () => {
  it('applies only the most recent selection when responses land out of order', async () => {
    const pending = new Map<number, ReturnType<typeof deferred<ElementDetails>>>();
    const loader = new ElementDetailsLoader((_projectId, expressId) => {
      const d = deferred<ElementDetails>();
      pending.set(expressId, d);
      return d.promise;
    });

    const first = loader.select('p1', 101);
    const second = loader.select('p1', 102);

    // B answers first, A answers afterwards - the classic race.
    pending.get(102)!.resolve(detailsFor(102));
    const secondResult = await second;
    pending.get(101)!.resolve(detailsFor(101));
    const firstResult = await first;

    expect(secondResult.superseded).toBe(false);
    expect(secondResult.expressId).toBe(102);
    expect(secondResult.details?.name).toBe('Element 102');

    expect(firstResult.superseded).toBe(true); // must not be applied
  });

  it('supersedes an in-flight request when the selection is cleared', async () => {
    const d = deferred<ElementDetails>();
    const loader = new ElementDetailsLoader(() => d.promise);

    const pendingResult = loader.select('p1', 101);
    const clearedResult = await loader.select('p1', null);
    d.resolve(detailsFor(101));

    expect(clearedResult).toEqual({ expressId: null, details: null, error: null, superseded: false });
    expect((await pendingResult).superseded).toBe(true);
  });

  it('supersedes a duplicate request for the same element', async () => {
    const calls: Array<ReturnType<typeof deferred<ElementDetails>>> = [];
    const loader = new ElementDetailsLoader(() => {
      const d = deferred<ElementDetails>();
      calls.push(d);
      return d.promise;
    });

    const a = loader.select('p1', 101);
    const b = loader.select('p1', 101);
    calls[0].resolve(detailsFor(101));
    calls[1].resolve(detailsFor(101));

    expect((await a).superseded).toBe(true);
    expect((await b).superseded).toBe(false);
  });

  it('reports a fetch failure without rejecting', async () => {
    const loader = new ElementDetailsLoader(() => Promise.reject(new Error('500 boom')));

    const result = await loader.select('p1', 101);

    expect(result.superseded).toBe(false);
    expect(result.details).toBeNull();
    expect(result.error).toContain('500 boom');
  });
});

describe('STEP-14 property update request', () => {
  const prop: PropertySingle = { name: 'FireRating', value: 'REI30', value_type: 'IfcLabel' };

  it('uses POST on the properties route', () => {
    const req = buildPropertyUpdateRequest('p1', 205, 'Pset_WallCommon', prop);

    expect(req.method).toBe('POST');
    expect(req.url.endsWith('/api/projects/p1/elements/205/properties')).toBe(true);
  });

  it('sends property_name and value_type, never the legacy name field', () => {
    const req = buildPropertyUpdateRequest('p1', 205, 'Pset_WallCommon', prop);

    expect(req.body).toMatchObject({
      pset_name: 'Pset_WallCommon',
      property_name: 'FireRating',
      value: 'REI30',
      value_type: 'IfcLabel'
    });
    expect(req.body).not.toHaveProperty('name');
  });

  it('defaults the value type when the property has none', () => {
    const req = buildPropertyUpdateRequest('p1', 7, 'Pset_X', { name: 'Note', value: 'n/a' });
    expect(req.body.value_type).toBe('IfcLabel');
  });
});
