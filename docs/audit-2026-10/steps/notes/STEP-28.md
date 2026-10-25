# STEP-28 — handoff notes (onboarding, shortcuts, save indicator, touch targets)

## 2026-10-25 - Shortcuts were undiscoverable, first run was CAD authoring, saves were invisible
- **Type:** Enhancement (F-042, F-048, F-049 guard, F-050, F-051, F-052, F-040 folded in)
- **Platform:** http://localhost:5173
- **Related tests:** `src/tests/step28.ergonomics.test.tsx` (20 new), `src/tests/step25.importGraph.test.ts`
- **Severity:** P1
- **Observed:** ~14 keyboard bindings lived in five handlers and were documented nowhere; a first run
  defaulted to `modify` (CAD ribbon, no model); nothing reported whether an element write succeeded
  (`useGizmoTransform` only `console.error`-ed); the omnibar silently capped the model at 50 elements
  and the result list at 15; the three hand-rolled modals had no `role="dialog"`, no focus move, no
  focus trap and no focus restore; compact dock/header icon buttons were 22-26 px; touch orbit was
  OrbitControls' untested default.
- **Expected:** One registry that drives both dispatch and a legend; `query` as the first-run profile
  behind a one-line dismissible card; a `role="status"` save pill fed by every element write; the whole
  model indexed with a labelled "+N more" cap; focus-managed dialogs; 44 px targets on coarse pointers
  only; one-finger orbit + two-finger dolly/pan.
- **Evidence:** 20/20 STEP-28 tests pass; full suite `22 files / 154 tests` green;
  `pnpm exec tsc -b --noEmit` silent. Pre-implementation failures reproduced from the step document
  (`Failed to resolve import "../services/shortcuts"`, then the `resolveInitialProfile`/44 px/250-element
  assertions).
- **Suggested fix:** Landed — see the file list below.
- **Status:** Open (only because the two deferred integration edits below are still outstanding; the
  components are inert until they are wired)

### New files

| File | Purpose |
|---|---|
| `frontend/src/services/shortcuts.ts` | `SHORTCUTS` registry, `findShortcut`, `isEditableTarget`, `formatShortcut`, `isMacPlatform` |
| `frontend/src/components/nav/ShortcutLegend.tsx` | `role="dialog"` legend, grouped, closes on Escape / backdrop |
| `frontend/src/services/saveStatus.ts` | store + `withSaveStatus()` + `SAVED_VISIBLE_MS` |
| `frontend/src/hooks/useSaveStatus.ts` | `useSyncExternalStore` + 4 s `saved → idle` decay |
| `frontend/src/components/nav/SaveStatusIndicator.tsx` | `role="status"` pill, `data-qa="save-status"` |
| `frontend/src/services/onboarding.ts` | `ONBOARDING_KEY`, `hasCompletedOnboarding`, `completeOnboarding`, `resolveInitialProfile` |
| `frontend/src/components/onboarding/OnboardingCard.tsx` | first-run card, `data-qa="onboarding-card"` |
| `frontend/src/services/omnibarIndex.ts` | `buildOmnibarItems`, `filterOmnibarItems`, `MAX_VISIBLE_RESULTS` |
| `frontend/src/hooks/useFocusTrap.ts` | `{ ref, onKeyDown }`, focus-in / Tab wrap / focus-restore |
| `frontend/src/utils/viewportControls.ts` | `buildOrbitControlConfig()` (mouse + touch) |
| `frontend/src/utils/touchTargets.ts` | `MIN_TOUCH_TARGET_PX`, `withTouchTarget()` |

### Modified files

`components/nav/GlassHeader.tsx` (`onOpenShortcuts`, `showSaveStatus`, help button, save pill),
`components/omnibar/SpatialOmnibar.tsx` (index helpers + overflow footer),
`components/modals/{Settings,Upload,NewProject}Modal.tsx` (focus trap + dialog semantics),
`components/cad/GlassContextualModifyDock.tsx` + `components/dock/GlassBottomDock.tsx` (44 px floor +
`data-touch-target`), `services/api.ts` (12 mutators through `withSaveStatus`), `hooks/useGizmoTransform.ts`
(placement write reports failure), `src/index.css` (coarse/fine pointer rules),
`src/tests/step25.importGraph.test.ts` (five temporary allow-list entries — see Deviations).

---

## Deferred App.tsx wiring (integration lane) — verbatim

`App.tsx` is being edited by another lane, so nothing below was applied. Line numbers drift; anchor on
the quoted code, not the numbers. All snippets are self-contained.

### 1. Imports

```tsx
import { findShortcut, isEditableTarget } from './services/shortcuts';
import { hasCompletedOnboarding, resolveInitialProfile } from './services/onboarding';
import { ShortcutLegend } from './components/nav/ShortcutLegend';
import { OnboardingCard } from './components/onboarding/OnboardingCard';
```

### 2. New state (next to `const [isDrawingSheetsOpen, setIsDrawingSheetsOpen] = useState(false);`)

```tsx
  const [isShortcutLegendOpen, setIsShortcutLegendOpen] = useState(false);
```

### 3. First-run profile — replace the `'modify'` fallback in the `activeProfile` initialiser

Before: `return 'modify';`. After:

```tsx
  const [activeProfile, setActiveProfile] = useState<UiProfile>(() => {
    try {
      const saved = localStorage.getItem('ifc_editor_ui_profile');
      if (saved === 'review' || saved === 'modify' || saved === 'query' || saved === 'custom') {
        return resolveInitialProfile(saved as UiProfile);
      }
    } catch {}
    return resolveInitialProfile(null);
  });
```

### 4. Shortcut dispatch — replaces the whole `g` / `Shift+S` effect

Delete the effect that currently starts `const isInput = active && (active.tagName === 'INPUT' || …)` and
replace it with:

```tsx
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F-040: never fire while the user is typing (INPUT/TEXTAREA/SELECT/contenteditable) …
      if (isEditableTarget(e.target)) return;
      // … and never swallow `g` while a two-letter Revit sequence is in flight (`ro`, `mm`, `ar` …).
      if (revitKeyBufferRef.current !== '') return;

      const shortcut = findShortcut(e, { hasSelection: selectedExpressID !== null });
      if (!shortcut) return;

      switch (shortcut.id) {
        case 'viewport.toggleGrid':
          e.preventDefault();
          handleToggleGrid();
          break;
        case 'drawing.sheets':
          e.preventDefault();
          setIsDrawingSheetsOpen((prev) => !prev);
          break;
        case 'help.shortcuts':
          e.preventDefault();
          setIsShortcutLegendOpen((prev) => !prev);
          break;
        default:
          // Ctrl+Z / Ctrl+Y / Delete / Ctrl+D / Ctrl+, / Ctrl+R / Tab / Escape are dispatched by
          // the dedicated handlers below and by ThreeViewport - never preventDefault here.
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleGrid, selectedExpressID]);
```

> If `tsc`/oxlint objects to `revitKeyBufferRef` being referenced above its declaration (it is declared
> next to the CAD handler today), move `revitKeyBufferRef` + `revitKeyTimerRef` up with the other refs —
> the value is only read inside the listener, so nothing else changes.

### 5. Escape guard — route its matcher through the registry and let the legend close first

```tsx
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const matched = findShortcut(e, { hasSelection: selectedExpressID !== null });
      if (matched?.id === 'app.escape') {
        // If modals, the legend or the command palette are open, let their own handlers manage dismissal
        if (isOmnibarOpen || isUploadModalOpen || isNewProjectModalOpen || isBcfOpen || isFederationOpen || isSettingsOpen || isDrawingSheetsOpen || isShortcutLegendOpen) {
          if (isSettingsOpen) setIsSettingsOpen(false);
          if (isDrawingSheetsOpen) setIsDrawingSheetsOpen(false);
          if (isShortcutLegendOpen) setIsShortcutLegendOpen(false);
          return;
        }
```

…the rest of the priority chain stays byte-identical. Add `isShortcutLegendOpen` to that effect's
dependency array.

### 6. Header props (next to `onOpenOmnibar`)

```tsx
          onOpenOmnibar={() => setIsOmnibarOpen(true)}
          onOpenShortcuts={() => setIsShortcutLegendOpen(true)}
          onOpenSettingsModal={() => setIsSettingsOpen(true)}
```

### 7. Onboarding card — inside the existing empty-state overlay, above "Spatial Canvas Ready"

```tsx
      {/* Empty State Overlay */}
      {geometries.length === 0 && !isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none z-10">
          {/* STEP-28 F-051: first-run card (once, dismissible). The panel below is the
              "no geometry in this project" state and stays. */}
          {!hasCompletedOnboarding() && (
            <OnboardingCard
              onUpload={() => setIsUploadModalOpen(true)}
              onOpenSample={() => setIsNewProjectModalOpen(true)}
            />
          )}
          <div className="p-6 rounded-2xl bg-[var(--dock-translucent)] border border-[var(--border-subtle)] text-center max-w-sm pointer-events-auto backdrop-blur-2xl shadow-[var(--shadow-hud)]">
            {/* … existing "Spatial Canvas Ready" panel, unchanged … */}
          </div>
        </div>
      )}
```

### 8. Shortcut legend render (next to `<SpatialOmnibar … />`)

```tsx
      <ShortcutLegend isOpen={isShortcutLegendOpen} onClose={() => setIsShortcutLegendOpen(false)} />
```

### 9. Omnibar props — **no change required**

`SpatialOmnibar` kept its exact prop contract (`isOpen`, `onClose`, `onOpen`, `geometries`, `spatialTree`,
`onSelectElement`, `onTriggerTool`, `onUpdateUiStyleMode`) and its internal
`resolveOmnibarShortcut` Ctrl+K listener. The existing `App.tsx` block works as-is.

### 10. Remove the five temporary allow-list entries

`src/tests/step25.importGraph.test.ts` → `KNOWN_UNREACHABLE_OUTSIDE_STEP25`: delete the five STEP-28
entries in the same change. The test then proves the wiring is complete.

---

## Deferred ThreeViewport.tsx patch (integration lane) — verbatim

### 1. Import

```tsx
import { buildOrbitControlConfig } from '../../utils/viewportControls';
```

### 2. Scene-init effect — replace the inline `controls.mouseButtons` literal

Before (in the `// 1. Initialize Scene & Renderer` effect):

```tsx
    controls.mouseButtons = {
      LEFT: -1 as any,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: -1 as any
    };
```

After:

```tsx
    // STEP-28 / F-052: mouse + touch navigation from one tested config. LEFT/RIGHT stay disabled so
    // a left click remains available to selection and CAD commands; one finger orbits, two dolly+pan.
    const orbitControlConfig = buildOrbitControlConfig();
    controls.mouseButtons = orbitControlConfig.mouseButtons;
    controls.touches = orbitControlConfig.touches;
```

Leave the `handleDomPointerDown` / `handleDomPointerUp` Shift-swap immediately below it untouched — it
only mutates `mouseButtons.MIDDLE` (spec 5.3).

### 3. The `isMeasureActive` effect (second copy of the same literal)

```tsx
      // Revit / Blender navigation invariant: Left click is 100% free, MMB pans/drags, Shift+MMB rotates
      controls.mouseButtons = buildOrbitControlConfig().mouseButtons;
```

(Replacing the identical `{ LEFT: -1 as any, MIDDLE: THREE.MOUSE.PAN, RIGHT: -1 as any }` literal keeps
the two call sites from drifting again; `touches` is already assigned in the init effect.)

---

## Deviations from the step document

1. **The TDD test's dock guard reads `components/cad/GlassContextualModifyDock.tsx`, not
   `GlassBottomDock.tsx`.** `dockSource` is the *modify* dock, so `examined >= 8` is satisfied there. Both
   docks were fixed (17 + 27 buttons); `GlassBottomDock` is the one Spec 4.2 names.
2. **44 px floor is scoped through CSS, not through conditional classes.** The test requires the literal
   `min-h-11` token, but an unconditional `min-height: 44px` would widen the desktop dock (spec 4.4).
   `index.css` therefore adds `@media (pointer: coarse) { [data-touch-target] { min-height: 44px;
   min-width: 44px } }` and `@media (pointer: fine) { .min-h-11.min-w-11 { min-height: 26px;
   min-width: 26px } }` (un-layered CSS beats Tailwind's `@layer utilities`, so this works without
   `!important`). The old explicit `min-w-[26px] min-h-[26px]` on the modify dock became the pair above,
   so the fine-pointer box is 26 px as before.
3. **`api.updateElementProperty` is wrapped too (12 writes, not 11).** The step says to wrap "the two raw
   `fetch()` calls in `GlassPropertyInspector.tsx`"; the only raw `fetch` there is the details *GET*.
   The property write goes through `api.updateElementProperty`, and the acceptance item "a successful
   property edit shows `Saved`" requires it.
4. **`Ctrl+Shift+Z` is not in `SHORTCUTS`.** `element.undo` declares `shift: false` and `element.redo` is
   `Ctrl+Y`; `App.tsx`'s legacy branch keeps `Ctrl+Shift+Z`. The legend does not claim it.
5. **The `?` legend entry is labelled "Open this shortcut legend".** The dialog title is "Keyboard
   shortcuts" and the test asserts each label appears exactly once, so the label must differ.
6. **`step25.importGraph.test.ts` gained five allow-list entries** (ShortcutLegend, OnboardingCard,
   onboarding.ts, shortcuts.ts, viewportControls.ts) because they are unreachable until the App /
   ThreeViewport edits above land. Remove them there (item 10).
7. **Not verified in this lane:** computed 44 px boxes in DevTools coarse-pointer emulation, one-finger
   orbit on real hardware, `?`-opens-the-legend, the first-run card appearing once, and `Saved` within
   1 s of a property edit. All need the App/ThreeViewport wiring plus a live browser; recommend
   `qa_runner.py run --range TC-001:TC-015 --browser` at 1280×800 and in iPad emulation once the
   integration lane is done. `run_gates.py` / `check_spatial_overlap.py` were **not** run here (a new
   `data-qa` value `pill-shortcuts-help` was added to the header — unique, verified by grep).
