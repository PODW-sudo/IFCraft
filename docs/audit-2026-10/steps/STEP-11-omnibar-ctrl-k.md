# STEP-11 — Make `Ctrl+K` open the command palette

**Status:** not started · **Wave:** D · **Effort:** 0.5 d
**Findings:** F-008 · **Depends on:** — · **Blocks:** STEP-12, STEP-28

## Problem

The advertised power-user entry point does nothing. `Ctrl+K` is handled, `preventDefault()` is
called so the browser does not act either, and then the `else` branch is an empty comment - the
palette never opens. The same component is the only place that listens for the chord, and it
receives no way to open itself. `test_cases.jsonl` TC-056 asserts the shortcut works, so the QA
harness records a real product failure; users simply conclude the shortcut is unassigned.

## Evidence

- `frontend/src/components/omnibar/SpatialOmnibar.tsx:52-65` — the global listener:
  ```ts
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (isOpen) { onClose(); } else {
      // Open
    }
  }
  ```
  `e.preventDefault()` runs in both branches (`:55`), so the keypress is swallowed.
- `frontend/src/components/omnibar/SpatialOmnibar.tsx:20-28` — `SpatialOmnibarProps` has `isOpen`, `onClose`, … and **no** `onOpen`.
- `frontend/src/App.tsx:1795-1803` — the render site passes `isOpen={isOmnibarOpen}` and `onClose={() => setIsOmnibarOpen(false)}`, nothing else.
- `frontend/src/App.tsx:1590` — `onOpenOmnibar={() => setIsOmnibarOpen(true)}` already exists and works for the header button, so the open path is proven; only the chord is dead.
- Measured: `grep -n "onOpen" frontend/src/components/omnibar/SpatialOmnibar.tsx` → no matches.

## Scope

**Change:**

- `frontend/src/utils/omnibarShortcut.ts` — **new** pure module: `resolveOmnibarShortcut(event, isOpen)` returning `'open' | 'close' | 'ignore'`.
- `frontend/src/components/omnibar/SpatialOmnibar.tsx:52-65` — replace the inline branch with the resolver; call `e.preventDefault()` **only** when the result is not `'ignore'`; call `onOpen()` on `'open'`, `onClose()` on `'close'`.
- `frontend/src/components/omnibar/SpatialOmnibar.tsx:20-28` — add `onOpen: () => void` to the props interface (required, not optional, so a future call site cannot silently regress).
- `frontend/src/App.tsx:1795-1803` — pass `onOpen={() => setIsOmnibarOpen(true)}`.

**Do not change:**

- The omnibar's item construction, filtering, `ArrowUp`/`ArrowDown`/`Enter` handling (`:193-208`) or the 15-result cap.
- `App.tsx`'s global `Escape` handler (`:962-1009`), which already defers to `isOmnibarOpen`.
- The header button wiring (`App.tsx:1590`).
- The `Command` + `ESC` hint chip in the dialog header (`:231-234`) - it is cosmetic and correct.
- The 50-geometry indexing cap (`:152`) - that is F-042 / STEP-28.

**Non-goals:**

- Fuzzy matching, recents, command weighting, or a keyboard-shortcut legend in the palette (STEP-28).
- `Ctrl+Shift+P` as an alias, or a two-key Revit-style chord.
- Making the palette work while the drawings/settings/copilot modals are open.
- Any change to `qa_runner.py` or `test_cases.jsonl`.

## Spec

1. `resolveOmnibarShortcut(event, isOpen)` returns `'open'` when `ctrlKey || metaKey` is set, `altKey` is not, `shiftKey` is not, and `event.key` lower-cases to `'k'`, while `isOpen` is `false`.
2. It returns `'close'` for the same chord when `isOpen` is `true`.
3. It returns `'ignore'` in every other case: no `ctrl`/`meta`, `altKey`, `shiftKey`, a different key, or a `'k'` arriving as part of an input-method composition (`event.isComposing === true`).
4. The listener calls `preventDefault()` only for `'open'` / `'close'`. For `'ignore'` the browser keeps its own behaviour (today `Ctrl+Shift+K` is also swallowed, which is a second, smaller bug).
5. `SpatialOmnibar` accepts `onOpen` and calls it exactly once per `'open'` resolution.
6. Pressing `Ctrl+K` with the palette closed, then typing `wall` and pressing `Enter` selects the first match - i.e. the palette is fully usable from the chord alone.
7. Pressing `Ctrl+K` while the palette is open closes it (unchanged behaviour, now covered by a test).
8. `Cmd+K` behaves identically on macOS.

## TDD

### 1. Add the failing test

**File:** `frontend/src/tests/step11.omnibarCtrlK.test.ts`
**Command:** `pnpm exec vitest run src/tests/step11.omnibarCtrlK.test.ts` (from `frontend/`)

Pure-logic test. The "dialog actually opens in the DOM" assertion is a component test and needs
the jsdom + `@testing-library/react` infrastructure from **STEP-27**; it is not in this file.
Note: the audit package's `tests/frontend/step11.omnibarCtrlK.test.ts` uses the same name - copy
this version in, it is the one that matches the module this step introduces.

<details>

```ts
import { describe, it, expect } from 'vitest';
import { resolveOmnibarShortcut } from '../utils/omnibarShortcut';

const ev = (over: Partial<{ key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean; isComposing: boolean }> = {}) => ({
  key: 'k',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  isComposing: false,
  ...over
});

describe('STEP-11 Ctrl+K command palette', () => {
  it('opens the palette when closed', () => {
    expect(resolveOmnibarShortcut(ev({ ctrlKey: true }), false)).toBe('open');
  });

  it('closes the palette when open', () => {
    expect(resolveOmnibarShortcut(ev({ ctrlKey: true }), true)).toBe('close');
  });

  it('accepts Cmd+K and an upper-case K', () => {
    expect(resolveOmnibarShortcut(ev({ metaKey: true }), false)).toBe('open');
    expect(resolveOmnibarShortcut(ev({ ctrlKey: true, key: 'K' }), false)).toBe('open');
  });

  it('ignores alt, shift, other keys and bare K', () => {
    expect(resolveOmnibarShortcut(ev({ ctrlKey: true, altKey: true }), false)).toBe('ignore');
    expect(resolveOmnibarShortcut(ev({ ctrlKey: true, shiftKey: true }), false)).toBe('ignore');
    expect(resolveOmnibarShortcut(ev({ ctrlKey: true, key: 'j' }), false)).toBe('ignore');
    expect(resolveOmnibarShortcut(ev({}), false)).toBe('ignore');
  });

  it('ignores a K that arrives during IME composition', () => {
    expect(resolveOmnibarShortcut(ev({ ctrlKey: true, isComposing: true }), false)).toBe('ignore');
  });
});
```

</details>

### 2. Watch it fail

```
FAIL  src/tests/step11.omnibarCtrlK.test.ts
Error: Failed to resolve import "../utils/omnibarShortcut" from
"src/tests/step11.omnibarCtrlK.test.ts". Does the file exist?
```

With the module present but ported literally from today's component (the `else` branch dropped),
the first assertion fails:

```
AssertionError: expected 'ignore' to be 'open'
```

That is the vacuous-test trap for this step: a resolver that returns `'ignore'` for everything
passes four of five tests. The first two tests must exist to stop it.

### 3. Implement

1. Create `frontend/src/utils/omnibarShortcut.ts`:

   ```ts
   export type OmnibarShortcutAction = 'open' | 'close' | 'ignore';

   export interface ShortcutEventLike {
     key: string;
     ctrlKey: boolean;
     metaKey: boolean;
     altKey: boolean;
     shiftKey: boolean;
     isComposing?: boolean;
   }

   export function resolveOmnibarShortcut(
     event: ShortcutEventLike,
     isOpen: boolean
   ): OmnibarShortcutAction {
     if (event.isComposing) return 'ignore';
     if (!(event.ctrlKey || event.metaKey)) return 'ignore';
     if (event.altKey || event.shiftKey) return 'ignore';
     if (event.key.toLowerCase() !== 'k') return 'ignore';
     return isOpen ? 'close' : 'open';
   }
   ```

2. `SpatialOmnibar.tsx:20-28` — add `onOpen: () => void;` and destructure it at `:39-47`.
3. `SpatialOmnibar.tsx:52-65` — rewrite the handler:

   ```ts
   const action = resolveOmnibarShortcut(e, isOpen);
   if (action === 'ignore') return;
   e.preventDefault();
   if (action === 'open') onOpen(); else onClose();
   ```
   Keep `onOpen` in the dependency array.
4. `App.tsx:1795-1803` — add `onOpen={() => setIsOmnibarOpen(true)}`.
5. Re-run the test.

### 4. Watch it pass

```
 ✓ src/tests/step11.omnibarCtrlK.test.ts (5 tests) 4ms
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

Manual: with the app loaded, press `Ctrl+K` → palette appears with the input focused; type
`wall` → results narrow; `Enter` selects; `Ctrl+K` again closes it; `Ctrl+Shift+K` does not open
it and the browser keeps the chord.

### 5. Regression guard

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/ -q
pnpm exec vitest run          # from frontend/
pnpm exec tsc -b --noEmit     # from frontend/
```

The `tsc` run is the guard for the new **required** prop: if any other render site of
`SpatialOmnibar` exists it will fail to compile. There is exactly one (`App.tsx:1795`).

## Acceptance criteria

- [ ] `Ctrl+K` opens the palette from the viewport, the tree and the property inspector (i.e. it is a global listener, not canvas-scoped).
- [ ] `Ctrl+K` while open closes it.
- [ ] `Cmd+K` works on macOS; `Ctrl+Shift+K` and `Alt+Ctrl+K` are not intercepted.
- [ ] `preventDefault()` is not called for ignored chords (verify with a keydown spy asserting `defaultPrevented === false`).
- [ ] Header palette button still opens the palette (no regression from the new required prop).
- [ ] `pnpm exec tsc -b --noEmit` clean, `pnpm exec vitest run` green.

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| A required `onOpen` prop breaks another call site | Only one call site exists; `tsc -b` catches any future one | Make the prop optional with a no-op default |
| `Ctrl+K` now fires while typing in a search input (it did not "work" there before either) | Chord is intentional in every command-palette UX; the palette input is where the user lands | Add `if (target.tagName === 'INPUT') return;` in the listener - one line |
| Users on layouts where `K` needs a modifier (e.g. AZERTY `Ctrl+K` is fine, but Dvorak users differ) | `event.key` (not `code`) is used, so the physical-key assumption problem is avoided | Add `Ctrl+Shift+P` as an alias - out of scope here |
| The QA harness's TC-056 may expect a specific `data-qa` attribute on open | `data-qa="omnibar-dialog"` already exists (`:215`); do not rename it | n/a |

## Notes

- The shortcut is registered by the palette component itself, which is *always mounted*
  (`App.tsx:1795` renders it unconditionally, and it returns a Radix portal whose `open` prop
  controls visibility). That is why the listener exists even when the palette is closed - do not
  "fix" this by moving the listener into a conditional mount.
- `isOpen` is in the effect's dependency array (`:65`); without the resolver the captured value
  would still be correct, but keep it there - the resolver needs the live value.
- **Not verified:** whether any browser or extension reserves `Ctrl+K` (Chrome's address-bar search
  is `Ctrl+K` on some platforms). If a conflict shows up in practice, `preventDefault()` is already
  the right answer and the browser will yield. Not measured in a live browser.

### Implementation log — 2026-10-25

- **Status: component + pure module landed; TC-056 still fails until App passes `onOpen`.**
  `frontend/src/utils/omnibarShortcut.ts` (new) implements `resolveOmnibarShortcut`;
  `frontend/src/tests/step11.omnibarCtrlK.test.ts` — 5/5 passing (was: unresolved import).
  `SpatialOmnibar.tsx:52-65` now resolves the chord first, returns early on `'ignore'` **before**
  `preventDefault()`, and calls `onOpen()` / `onClose()`.
- **Deviation (deliberate, constrained):** `onOpen` is declared **optional** on
  `SpatialOmnibarProps` and invoked as `onOpen?.()`. The step asks for a required prop, but
  `App.tsx` is owned by the integration lane and a required prop with no caller is a `TS2741`
  build break. The one-line App wiring, the follow-up diff that makes the prop required, and the
  manual acceptance script are in `docs/audit-2026-10/steps/notes/STEP-11.md`.
- **The audit-package test file was not adopted, for two objective reasons:** it does not parse
  (its header comment contains `else { /* Open */ }`, whose `*/` closes the outer comment →
  esbuild `PARSE_ERROR Unexpected token`, so it reports "no tests" rather than a failing
  assertion), and its assertions pin the pre-resolver shape (inline
  `e.key.toLowerCase() === 'k'` plus an `App.tsx` `onOpen` prop). This step's own note above says
  the TDD-listed version is the one that matches the module, so that is the file shipped in
  `src/tests/`. The audit copy is untouched in `docs/audit-2026-10/tests/frontend/`.

