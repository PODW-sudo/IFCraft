---
name: a11y-audit
description: >-
  Use this skill to audit the IFC Editor for WCAG 2.2 AA accessibility compliance,
  focus traps, keyboard navigation in 3D WebGL scenes, interactive target sizes,
  and color contrast.
---

# Accessibility Audit Skill (WCAG 2.2 AA in WebGL & BIM)

Auditing 3D CAD/BIM tools presents unique accessibility challenges because the main canvas renders via WebGL while user controls reside in the DOM.

## WebGL & Canvas Accessibility Checklist

### 1. Canvas Keyboard Traps (WCAG 2.1.2)
- When the 3D viewport canvas has focus, keyboard navigation must NEVER get trapped.
- Users must be able to `Tab` out of the canvas back to the floating tool docks or top navigation.
- Hotkeys within the canvas (e.g. `G` for grab/translate, `R` for rotate, `Space` for select) must not hijack global browser shortcuts.

### 2. Interactive Target Size (WCAG 2.5.8)
- Every clickable button, icon, tab, and input in floating HUDs and toolbars must have an interactive target area of at least **24x24 CSS pixels** (preferably **32x32px** or larger for primary tools).
- Spacing between adjacent icon buttons must be at least 4px to prevent mis-clicks.

### 3. Screen Reader & Spatial Hierarchy (WCAG 1.3.1, 4.1.2)
- The Spatial Hierarchy Tree must use proper ARIA tree roles:
  - `role="tree"` on container
  - `role="treeitem"` on each node
  - `aria-expanded="true|false"` on collapsible parents
  - `aria-selected="true|false"` on active selection
- The 3D canvas element must provide an `aria-label="3D BIM Viewport. Use mouse to orbit and pan. Press Tab to reach tool docks."`

### 4. Color Contrast (WCAG 1.4.3, 1.4.11)
- Text vs background: >= 4.5:1 for normal text, >= 3.0:1 for large/bold text.
- UI components & borders: >= 3.0:1 for active boundaries and states.
- Verified mathematically via `python scripts/gates/verify_contrast.py`.

### 5. Reduced Motion (WCAG 2.3.3)
- Smooth camera orbit animations and drawer transitions must respect `@media (prefers-reduced-motion: reduce)`.
