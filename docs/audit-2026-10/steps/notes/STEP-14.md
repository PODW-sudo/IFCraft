## 2026-10-25 - Element-details request race: stale panel for the wrong element

- **Type:** Bug
- **Platform:** http://localhost:5173
- **Related tests:** F-016 / F-036 (STEP-14); `frontend/src/tests/step14.elementDetails.test.ts`,
  `frontend/src/tests/step29.propertyEditPersistence.test.tsx`
- **Severity:** P1
- **Observed:** With two selections in flight, whichever `GET /elements/{id}` resolved last won, so
  the inspector could show element **A**'s properties while **B** was selected - and every edit then
  wrote to B while the user was reading A's numbers. The same panel also issued a second, identical
  `GET` for details `App` already held in `selectedElementDetails`.
- **Expected:** Only the response for the most recent selection is applied; a cleared selection drops
  the panel immediately; a failed fetch never rejects into an unhandled rejection; exactly one
  details request per click; the panel never renders details whose `express_id` differs from the
  selected `expressId`.
- **Evidence:** `ElementDetailsLoader` unit tests (out-of-order resolve, clear-while-in-flight,
  duplicate selection, rejection) - 7/7 green. Component test asserts zero `fetch` calls when
  `details` is passed and that details for express 205 are never rendered while 999 is selected.
- **Suggested fix:** Done on the frontend:
  - `frontend/src/services/elementDetailsLoader.ts` (new): `ElementDetailsLoader` with a monotonic
    `seq`; `select(projectId, expressId)` resolves `{ expressId, details, error, superseded }` and
    never rejects; `select(projectId, null)` returns the cleared result and supersedes in-flight work.
  - `frontend/src/hooks/useSpatialSelection.ts`: the details effect and the pin refresh both go
    through one loader (ref-held, injectable via the `elementDetailsLoader` option) and apply a result
    only when `superseded === false`; `isMounted` retained for the unmount case. New returns:
    `detailsError`, `isDetailsLoading`, `reloadElementDetails(id)`, `reloadSelectedElementDetails()`,
    `elementDetailsLoader`.
  - `frontend/src/services/api.ts`: `updateElementProperty()` (POST, `property_name`, `value_type`).
  - `frontend/src/components/properties/GlassPropertyInspector.tsx`: accepts `details`,
    `detailsLoading`, `onSaveError`; issues **no** GET when `details` is provided (even `null`);
    renders only `details.express_id === expressId`; `onPropertyUpdated` is now
    `(expressId: number) => void` and fires after a successful save.
- **Status:** Open - **one deferred item: `App.tsx` wiring** (that file is owned by another change
  set; do not edit it from this lane). Everything else is implemented and tested.

### Deferred App.tsx wiring (exact snippet)

`frontend/src/App.tsx`, hook destructuring (currently ~lines 241-275). Add the three new fields:

```tsx
  const {
    selectedExpressID,
    setSelectedExpressID,
    isolatedExpressID,
    setIsolatedExpressID,
    hiddenCategories,

    toggleCategoryVisibility,
    pinnedExpressIds,
    setPinnedExpressIds,
    pinnedExpressIdsRef,
    selectedElementDetails,
    setSelectedElementDetails,
    storeys,
    focusTrigger,
    setFocusTrigger,

    handleSelectElement,
    handleTogglePin,
    // ADD (STEP-14):
    isDetailsLoading,
    reloadElementDetails
  } = useSpatialSelection({
```

`frontend/src/App.tsx`, the inspector call site (currently ~lines 1665-1674):

```tsx
            {isPropertyOpen && (
              <GlassPropertyInspector
                projectId={currentProject?.id || null}
                expressId={selectedExpressID}
                isOpen={isPropertyOpen}
                onClose={() => setIsPropertyOpen(false)}
                transformInfo={transformInfo}
                onWidthChange={handlePropertyWidthChange}
                /* ADD (STEP-14): stop the duplicate fetch and refresh after a save */
                details={selectedElementDetails}
                detailsLoading={isDetailsLoading}
                onPropertyUpdated={(id) => {
                  void reloadElementDetails(id);
                  refreshAuditData();
                }}
              />
            )}
```

Notes for whoever wires it:
- `reloadElementDetails(id)` already writes the refreshed object into `selectedElementDetails`
  through the shared loader, so do **not** call `setSelectedElementDetails` again.
- `refreshAuditData` is the existing `useCallback` in `App.tsx` (~line 1025) used by the audit
  timeline; reusing it keeps the timeline consistent with the file after a property save.
- Until this lands the inspector keeps its standalone, sequence-guarded fetch: behaviour is correct,
  but the duplicate `GET` per click remains. Passing `details={undefined}` explicitly restores the
  old per-call-site behaviour if the wiring ever needs to be rolled back.
- If any other surface needs element details, pass the hook's `elementDetailsLoader` to it (or into
  `useSpatialSelection({ elementDetailsLoader })`) - two loader instances would each have their own
  ordering and reintroduce the race.
- `detailsError` is also returned by the hook if a panel-level failure status line is wanted.
- `onSaveError` (new, optional) is available for a shell-level toast; the inspector already shows an
  inline `role="alert"` error on the edited row, so leaving it unset is fine.

### Open acceptance criteria / not verified here

- Manual: 3 s latency on `GET /elements/*`, click A then B 10x, panel must always end on B. No
  browser session was available in this lane; the unit/component tests cover the ordering contract.
- Network: "exactly one `GET /elements/{id}` per click" is only true **after** the `App.tsx` wiring
  above (the inspector's standalone path is still active until then).
