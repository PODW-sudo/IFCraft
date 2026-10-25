# STEP-11 — handoff notes (Ctrl+K opens the command palette)

## 2026-10-25 - Ctrl+K / Cmd+K resolves to an explicit open action instead of an empty branch
- **Type:** Bug
- **Platform:** http://localhost:5173
- **Related tests:** TC-056, TC-057
- **Severity:** P1
- **Observed:** The global keydown listener in `SpatialOmnibar` called `e.preventDefault()` for
  `Ctrl/Cmd+K` and then fell into an empty `else { // Open }` branch: the palette never opened and
  the browser never got the chord either. `Ctrl+Shift+K` / `Ctrl+Alt+K` were swallowed too.
- **Expected:** The chord opens the palette when closed, closes it when open, and every other
  chord (extra modifiers, other keys, IME composition) is left to the browser.
- **Evidence:** `frontend/src/tests/step11.omnibarCtrlK.test.ts` (5 tests, passing).
  Before: failed to resolve `../utils/omnibarShortcut`.
- **Suggested fix:** Landed. New pure `frontend/src/utils/omnibarShortcut.ts`
  (`resolveOmnibarShortcut(event, isOpen): 'open' | 'close' | 'ignore'`). The listener now returns
  early on `'ignore'` **before** `preventDefault()`, calls `onOpen()` on `'open'` and `onClose()`
  on `'close'`. `SpatialOmnibar` accepts `onOpen`.
- **Status:** Open (code landed; the App wiring below is still required before TC-056 passes)

## Deferred App wiring (integration lane) — required for TC-056

### 1. `frontend/src/App.tsx:1795-1803` — pass the open path (one line)

```tsx
      {/* 8. Command Palette / Spatial Omnibar (Ctrl+K) */}
      <SpatialOmnibar
        isOpen={isOmnibarOpen}
        onClose={() => setIsOmnibarOpen(false)}
        // STEP-11: add exactly this line
        onOpen={() => setIsOmnibarOpen(true)}
        geometries={geometries}
        spatialTree={spatialTree}
        onSelectElement={handleSelectElement}
        onTriggerTool={handleTriggerTool}
        onUpdateUiStyleMode={handleUpdateUiStyleMode}
      />
```

`setIsOmnibarOpen` is already App state (`App.tsx:141`), and the header button already uses the
same expression (`App.tsx:1590`: `onOpenOmnibar={() => setIsOmnibarOpen(true)}`).

### 2. Then tighten the prop to **required** (`frontend/src/components/omnibar/SpatialOmnibar.tsx`)

This lane was forbidden to edit `App.tsx`, so `onOpen` had to be declared optional to keep
`tsc -b` green (a required prop with no caller is a `TS2741` build break). After the wiring above,
apply both edits and re-run `pnpm exec tsc -b --noEmit`:

```diff
-  onOpen?: () => void;
+  onOpen: () => void;
```
```diff
-        onOpen?.();
+        onOpen();
```
and drop the "optional only because..." comment above the prop. `tsc` then guarantees no future
call site can silently regress the chord (the spec's rationale for making it required).

### 3. Manual acceptance (cannot be asserted without the wiring)
With the app loaded: `Ctrl+K` opens the palette with the input focused from the viewport, the
tree and the property inspector; type `wall` → results narrow; `Enter` selects; `Ctrl+K` again
closes; `Ctrl+Shift+K` does not open it **and** the browser keeps the chord
(`defaultPrevented === false`). `Cmd+K` on macOS behaves identically.

## Deviations from the step document

1. **`onOpen` is optional (with a safe no-op via `onOpen?.()`), not required.** The step says
   "required, not optional"; that is a compile error while `App.tsx` is off-limits. Item 2 above
   restores it. Recorded here rather than done partially.
2. **The audit package's `tests/frontend/step11.omnibarCtrlK.test.ts` was not adopted.** Two
   independent reasons:
   - It does not parse. Its header block comment contains `else { /* Open */ }`, whose `*/` closes
     the outer comment early → `[PARSE_ERROR] Unexpected token` from Vite/esbuild, so the file
     reports "no tests" rather than failing an assertion.
   - Its assertions pin the *old* implementation shape: `App` must pass
     `onOpen={() => setIsOmnibarOpen(true)}` (an `App.tsx` edit this lane may not make) and the
     component must keep the literal `e.key.toLowerCase() === 'k'` inline with `preventDefault`
     nearby — which the spec's `resolveOmnibarShortcut` extraction removes.
   The step document itself says the TDD-listed version "is the one that matches the module this
   step introduces", so that is the file in `src/tests/`. The audit copy is unchanged in
   `docs/audit-2026-10/tests/frontend/` for the integration lane to fix or retire.

## Notes / residual risks

- The listener stays in the always-mounted component (`App.tsx:1795` renders it unconditionally);
  do not move it behind a conditional mount.
- `isOpen` remains in the effect's dependency array so the resolver sees the live value; `onOpen`
  was added to it as well.
- `Ctrl+K` still fires while typing in the tree's filter input. That is intentional for a command
  palette (the user lands in the palette input). If it is judged wrong later, the one-line guard
  is `if (target.tagName === 'INPUT') return;` before the resolver.
- Not verified in a live browser: whether a browser/extension reserves `Ctrl+K`. The chord is
  only swallowed when the palette actually reacts, so a conflict degrades to "nothing happens"
  rather than a dead key.
