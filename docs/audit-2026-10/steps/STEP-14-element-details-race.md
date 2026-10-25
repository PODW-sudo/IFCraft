# STEP-14 — Fix the element-details request race

**Status:** not started · **Wave:** B · **Effort:** 1 d
**Findings:** F-016, F-036 · **Depends on:** — · **Blocks:** —

## Problem

Click element A, then click element B quickly: two `GET /elements/{id}` requests are in flight,
the slower one can land last, and the inspector displays **A's** properties while **B** is
selected. Every edit the user then makes is written to B while they are reading A's numbers - a
silent data-integrity error on a contractual document. The panel also issues a second, identical
fetch for details `App` already holds, and the edit path itself is broken twice over: it sends
`PATCH` to a `POST`-only route and names the property `name` where the schema requires
`property_name`, so a property edit from the inspector cannot succeed at all.

## Evidence

- `frontend/src/hooks/useSpatialSelection.ts:47-67` — the details effect. The only guard is
  `let isMounted = true;` (`:58`), cleared on cleanup (`:66`). It prevents a state update after
  unmount, **not** out-of-order responses: whichever `fetch` resolves last wins.
- `frontend/src/hooks/useSpatialSelection.ts:59-61` — `api.getElementDetails(currentProject.id, selectedExpressID).then((data) => { if (isMounted) setSelectedElementDetails(data); })` - the response is never checked against the express id it belongs to.
- `frontend/src/components/properties/GlassPropertyInspector.tsx:90-115` — the inspector runs its own `fetch('/api/projects/${projectId}/elements/${expressId}')` (`:100`) with the same missing guard, duplicating the request `App` already made.
- `frontend/src/App.tsx:1665-1674` — `<GlassPropertyInspector projectId expressId isOpen onClose transformInfo onWidthChange />`. It receives neither the already-loaded `selectedElementDetails` nor an `onPropertyUpdated` handler, even though `selectedElementDetails` is in scope (used at `:1619`) and the prop exists (`GlassPropertyInspector.tsx:25`).
- `frontend/src/components/properties/GlassPropertyInspector.tsx:143-151` — the edit request:
  ```ts
  const res = await fetch(`/api/projects/${projectId}/elements/${expressId}/properties`, {
    method: 'PATCH',
    body: JSON.stringify({ pset_name: psetName, name: prop.name, value: parsedValue })
  });
  ```
- `backend/app/api/projects.py:293` — `@router.post("/{project_id}/elements/{express_id}/properties", ...)`. There is no `PATCH` route for this path (grep across `backend/app/api/*.py` → one match, the `POST` above).
- `backend/app/models/schemas.py:52-57` — `PropertyUpdatePayload` requires `property_name` (min length 1) and takes `value_type` (default `IfcLabel`).
- Measured (`TestClient` against a temporary storage root + database; the user's `storage/` was not touched, project count unchanged):

  ```
  POST /elements/27/properties  {"pset_name":"Pset_AutoTest","property_name":"FireRating","value":"REI60","value_type":"IfcLabel"}
      -> 200, and GET /elements/27 then reports {'name': 'FireRating', 'value': 'REI60', 'value_type': 'IfcLabel'}
  PATCH /elements/27/properties  {"pset_name":"Pset_AutoTest","name":"FireRating","value":"X"}
      -> 405 Method Not Allowed
  POST  /elements/27/properties  {"pset_name":"Pset_AutoTest","name":"FireRating","value":"X"}
      -> 422 {"detail":[{"type":"missing","loc":["body","property_name"],"msg":"Field required",...}]}
  ```

  i.e. the inline edit in the inspector fails twice over: wrong verb **and** wrong field name.
- The add-property path in the same file is correct: `GlassPropertyInspector.tsx:196-205` uses `POST` and `property_name`/`value_type`. The bug is only in the inline edit.
- Measured: `grep -rn "method: 'PATCH'" frontend/src` → 1 match (`GlassPropertyInspector.tsx:145`).
- Measured: `grep -rn "onPropertyUpdated" frontend/src` → declarations and calls inside `GlassPropertyInspector.tsx` only; **no** provider in `App.tsx`.

## Scope

**Change:**

- `frontend/src/services/elementDetailsLoader.ts` — **new** pure module: `ElementDetailsLoader` (sequence-guarded, single-flight per selection).
- `frontend/src/services/propertyUpdate.ts` — **new** pure module: `buildPropertyUpdateRequest`.
- `frontend/src/services/api.ts` — add `updateElementProperty(projectId, expressId, payload)` next to `getElementDetails` (`:116-123`).
- `frontend/src/hooks/useSpatialSelection.ts:47-67` — use the loader; keep the last applied result only when `superseded === false`.
- `frontend/src/components/properties/GlassPropertyInspector.tsx:90-115` — accept `details` / `detailsLoading` props; **do not fetch** when they are provided; keep the internal loader only for the standalone case (guarded by the same module).
- `frontend/src/components/properties/GlassPropertyInspector.tsx:129-180` — build the request with `buildPropertyUpdateRequest` (`POST` + `property_name` + `value_type`).
- `frontend/src/App.tsx:1665-1674` — pass `details={selectedElementDetails}`, `detailsLoading={...}` and `onPropertyUpdated={(id) => { void reloadDetails(id); refreshAuditData(); }}`.

**Do not change:**

- `ElementDetails` / `PropertySingle` shapes (`backend/app/models/schemas.py:35-50`, `frontend/src/types/ifc.ts`).
- The add-property flow (`GlassPropertyInspector.tsx:182-224`) - it is already correct; only extract the URL/method if it falls out for free.
- The backend property endpoint's semantics. `value_type` coercion and `OwnerHistory` are STEP-18 (F-014, F-015, F-064).
- `useSpatialSelection.handleSelectElement`'s soft-lock logic (`:84-117`).
- Pinning (`handleTogglePin`, `:119-142`) beyond routing its re-fetch through the loader.

**Non-goals:**

- Prefetching or caching element details for hover.
- A virtualised property list, pset grouping UX, or a search redesign (`psetSearch` already exists at `:51`).
- Optimistic property editing with offline queueing.
- Migrating `fetch` calls in this component to `api.ts` wholesale.

## Spec

1. `ElementDetailsLoader.select(projectId, expressId)` starts a request and returns a promise resolving to `{ expressId, details, error, superseded }`. The result with `superseded === false` is always the one for the most recent `select` call, regardless of network completion order.
2. A result for a superseded request resolves with `superseded: true` and its own `details`; the caller must not apply it.
3. `select(projectId, null)` resolves immediately with `{ expressId: null, details: null, error: null, superseded: false }` and marks any in-flight request superseded.
4. A rejected fetch resolves with `{ details: null, error: '<message>', superseded: false }` - the loader never rejects, so a failed fetch cannot produce an unhandled rejection.
5. Selecting the same element again (e.g. after a save) supersedes the earlier in-flight request for that element; there is no "same id, so ignore" shortcut.
6. `buildPropertyUpdateRequest(projectId, expressId, psetName, prop)` returns `{ url, method: 'POST', body }` where `url` ends with `/api/projects/{projectId}/elements/{expressId}/properties`, `body.property_name === prop.name`, `body.pset_name === psetName`, and `body.value_type === (prop.value_type || 'IfcLabel')`. `body.name` must be absent.
7. The inspector renders exactly one property set of data per selected element: with `details` provided as a prop it issues **zero** `GET /elements/{id}` requests.
8. The inspector never displays details whose `express_id` differs from the current `expressId` prop, even transiently.
9. Saving an edit calls `onPropertyUpdated(expressId)`; `App` responds by re-fetching that element through the loader and refreshing the audit data, so the panel and the audit view agree with the file.
10. A failed edit shows a visible error (not only `console.error`) and leaves the field in edit mode with the user's text intact.

## TDD

### 1. Add the failing test

**File:** `frontend/src/tests/step14.elementDetails.test.ts`
**Command:** `pnpm exec vitest run src/tests/step14.elementDetails.test.ts` (from `frontend/`)

Pure-logic test; no jsdom. The component-level assertion "the inspector renders A's data while B
is selected" and "zero requests when `details` is a prop" need jsdom +
`@testing-library/react` from **STEP-27**; they are described in Acceptance criteria, not in this
file.

<details>

```ts
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
```

</details>

### 2. Watch it fail

```
FAIL  src/tests/step14.elementDetails.test.ts
Error: Failed to resolve import "../services/elementDetailsLoader" from
"src/tests/step14.elementDetails.test.ts". Does the file exist?
```

With the loader present but implemented exactly like today's hook (no sequence check), the first
test fails - which is the whole point:

```
AssertionError: expected false to be true
  → firstResult.superseded should be true: the stale response was applied
```

With `buildPropertyUpdateRequest` returning the current inspector body, the verb test fails:

```
AssertionError: expected 'PATCH' to be 'POST'
```

### 3. Implement

1. Create `frontend/src/services/elementDetailsLoader.ts`:

   ```ts
   import type { ElementDetails } from '../types/ifc';

   export type DetailsFetcher = (projectId: string, expressId: number) => Promise<ElementDetails>;

   export interface DetailsResult {
     expressId: number | null;
     details: ElementDetails | null;
     error: string | null;
     superseded: boolean;
   }

   export class ElementDetailsLoader {
     private seq = 0;
     constructor(private readonly fetchDetails: DetailsFetcher) {}

     async select(projectId: string, expressId: number | null): Promise<DetailsResult> {
       const mySeq = ++this.seq;
       if (expressId === null) {
         return { expressId: null, details: null, error: null, superseded: false };
       }
       try {
         const details = await this.fetchDetails(projectId, expressId);
         return { expressId, details, error: null, superseded: mySeq !== this.seq };
       } catch (err) {
         return {
           expressId,
           details: null,
           error: err instanceof Error ? err.message : String(err),
           superseded: mySeq !== this.seq
         };
       }
     }
   }
   ```

2. Create `frontend/src/services/propertyUpdate.ts` returning `{ url, method: 'POST' as const, body }`;
   it must not read `prop.value_type` through optional chaining without a fallback (Spec 6).
3. `api.ts:116-123` — add:

   ```ts
   export async function updateElementProperty(
     projectId: string,
     expressId: number,
     payload: { pset_name: string; property_name: string; value: unknown; value_type?: string }
   ): Promise<void> {
     const res = await fetch(`${BASE_URL}/projects/${projectId}/elements/${expressId}/properties`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ value_type: 'IfcLabel', ...payload })
     });
     if (!res.ok) throw new Error(`Failed to update property: ${res.statusText}`);
   }
   ```

4. `useSpatialSelection.ts:47-67` — hold `const loaderRef = useRef(new ElementDetailsLoader(api.getElementDetails))`;
   in the effect, `void loaderRef.current.select(currentProject.id, selectedExpressID).then((r) => { if (!r.superseded) { setSelectedElementDetails(r.details); setDetailsError(r.error); } });`
   The `isMounted` guard can stay for the unmount case, but it is no longer the ordering mechanism.
5. `handleTogglePin` (`:133-136`) — route its refresh through the same loader instead of a direct
   `api.getElementDetails` call, so a pin refresh cannot resurrect a stale panel.
6. `GlassPropertyInspector.tsx:20-38` — add `details?: ElementDetails | null`, `detailsLoading?: boolean`,
   `onSaveError?: (msg: string) => void`. Initialise internal state from `details` and keep it in sync
   with an effect; when `details !== undefined`, skip the fetch at `:90-115` entirely.
7. `GlassPropertyInspector.tsx:129-180` — replace the inline `fetch` with
   `api.updateElementProperty(projectId, expressId, buildPropertyUpdateRequest(...).body)`, keep the
   optimistic local state update, and on failure keep `editingKey` set and call `onSaveError`.
8. `App.tsx:1665-1674` — pass the three new props; `onPropertyUpdated={(id) => { void handleReloadDetails(id); refreshAuditData(); }}`
   where `handleReloadDetails` calls the shared loader and `setSelectedElementDetails`.
9. Re-run the test.

### 4. Watch it pass

```
 ✓ src/tests/step14.elementDetails.test.ts (7 tests) 8ms
 Test Files  1 passed (1)
      Tests  7 passed (7)
```

Manual (slow-network profile, 3G throttling in devtools makes the race reproducible):

1. Click wall A. Immediately click wall B. Repeat 10 times. The panel must never show A's `Name` while B is selected (the panel header shows the express id).
2. Edit `FireRating` on B → save. The request is `POST …/properties` with `property_name`; the value updates, and the audit timeline refreshes.
3. `Ctrl+Shift+I` network tab while selecting: exactly **one** `GET /elements/{id}` per click (today: two).

### 5. Regression guard

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/ -q
pnpm exec vitest run          # from frontend/
pnpm exec tsc -b --noEmit     # from frontend/
```

`backend/tests/test_phase3.py` and `test_phase7.py` exercise element details and property
endpoints; they must stay green. If the property path changes shape, update them - do not relax
them.

## Acceptance criteria

- [ ] With a 3 s artificial latency on `GET /elements/*`, clicking A then B always ends with B's data displayed (10/10 attempts).
- [ ] A response for a superseded selection never mutates the inspector (unit test + manual).
- [ ] Clicking an element issues exactly one details request, not two.
- [ ] Property edit: the network panel shows `POST`, status 200, body contains `property_name` and `value_type`.
- [ ] A rejected edit leaves the editor open with the typed text and shows an error message.
- [ ] After saving, `onPropertyUpdated` fires and the audit timeline reflects the change without a page reload.
- [ ] Clearing the selection clears the panel immediately, even with a request in flight.
- [ ] `pnpm exec vitest run`, `pnpm exec tsc -b --noEmit` green.

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| Two sources of truth for details (App + inspector) drift while both exist | Spec 7 removes the inspector's fetch when props are provided; keep the internal path only for standalone use | Pass `details={undefined}` to restore the old behaviour per-call-site |
| Fixing the edit verb changes the audit row shape (STEP-19 reads `update_property`) | Keep `action_type` unchanged on the backend; only the client verb/body change | Revert the inspector to `fetch` with `PATCH` - restores the 405 |
| `value_type` from the file may be a measure type the backend cannot coerce | STEP-18 owns coercion; this step passes the type through unchanged | Always send `IfcLabel` |
| The loader's `seq` field is per-instance; two instances would each have their own ordering | App and hook must share **one** loader instance; the hook exposes it via a ref and passes it down | Create the loader once in `App` and thread it explicitly |
| Extra re-render per details response | Results are applied only when not superseded, so at most one render per selection | n/a |

## Notes

- **Newly discovered while writing this step (not in `FINDINGS.md`):** the inspector's inline edit
  is unreachable by construction - `PATCH` to a `POST`-only route
  (`GlassPropertyInspector.tsx:145` vs `projects.py:293`) answered **405**, and a body missing the
  required `property_name` (`schemas.py:52-57`) answered **422** `Field required`. Both were
  reproduced with `TestClient` against a temporary storage root (see Evidence), and the correct
  `POST` shape was confirmed to return 200 and to be readable back from `GET /elements/{id}`. Include
  this in the step: it is the same panel, and fixing the race while leaving edits impossible would be
  pointless. Consider filing it as `F-066` in the register.
- The add-property flow (`GlassPropertyInspector.tsx:182-224`) already uses the correct verb and
  field names and was confirmed working by the same probe - do not "fix" it.
- **Verified by reading, not by running.** No browser session and no network capture was made for
  this step. The 405 claim follows from the single `@router.post` registration for
  `/projects/{project_id}/elements/{express_id}/properties`; confirm with one request before relying
  on it in a demo.
- The `isMounted` pattern at `useSpatialSelection.ts:58` is not wrong - it just solves a different
  problem (setState after unmount). Do not delete it; the sequence guard does not cover unmount.
- `psetSearch` (`:51`) filters client-side over `details`; because the panel will now receive details
  from `App`, the filter's dependency on `details` stays the same.
- **Design question:** the inspector's error state (inline vs toast) should be decided with
  @designer; the requirement here is only that the failure is visible and the typed value is not
  lost.

### Implementation note (2026-10-25)

- **Loader** — `frontend/src/services/elementDetailsLoader.ts`: `ElementDetailsLoader` with a
  monotonic `seq`. `select()` never rejects (failures resolve with `error`), a superseded result
  still carries its own `details` so callers can detect and drop it, `select(projectId, null)`
  resolves with the cleared result and supersedes anything in flight, and a repeat selection of the
  same id deliberately supersedes the earlier request (no "same id, skip" shortcut). Exactly the
  spec'd semantics — the Step 14 test file passes unmodified.
- **Hook** — `useSpatialSelection.ts`: one shared loader per hook (injectable via the new
  `elementDetailsLoader` option) held in a ref; the details effect and the pin refresh both go
  through it and apply only `superseded === false`. `isMounted` was kept — it guards unmount, which
  the sequence guard does not. New returns: `detailsError`, `isDetailsLoading`,
  `reloadElementDetails(id)`, `reloadSelectedElementDetails()`, `elementDetailsLoader`. Clearing the
  selection calls `loader.select(null, null)` and drops the panel immediately.
- **Inspector** — `GlassPropertyInspector.tsx`: new props `details?: ElementDetails | null`,
  `detailsLoading?: boolean`, `onSaveError?: (msg: string) => void`;
  `onPropertyUpdated` is now `(expressId: number) => void`. With `details` provided (even `null`) it
  issues **zero** GETs; the internal loader survives only for standalone use and is sequence-guarded
  by the same class. Rendering is guarded by `details.express_id === expressId`, so a stale object -
  from the prop, or from the optimistic local overlay - is never painted for a different element;
  a mismatch shows the loading skeleton instead.
- **Edit** — routed through `api.updateElementProperty` (new, next to `getElementDetails`) with the
  body from `buildPropertyUpdateRequest` (STEP-29). Optimistic update, revert on failure, inline row
  error that persists until the next attempt, editor kept open with the typed text, no request for an
  unchanged value.
- **App wiring deliberately not done** by this lane (App.tsx is owned by another change set). The
  exact snippet is in `docs/audit-2026-10/steps/notes/STEP-14.md`; until it lands the inspector falls
  back to its standalone fetch, so the *behaviour* is already correct but the duplicate GET is only
  removed once `details` is passed. That is the one open acceptance criterion.
- Manual checks (3G throttling, click A then B 10×, network tab, save through the panel) were **not**
  run — no browser session in this lane. Covered by unit/component tests instead:
  `pnpm exec vitest run src/tests/step14.elementDetails.test.ts src/tests/step29.propertyEditPersistence.test.tsx`
  → 19 passed.
