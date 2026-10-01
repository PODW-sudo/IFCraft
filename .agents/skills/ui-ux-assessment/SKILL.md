---
name: ui-ux-assessment
description: >-
  Use this skill to perform a comprehensive 5-tier evaluation of the IFC Editor user interface
  and user experience, assessing viewport ergonomics, information architecture, data density,
  command accessibility, and multi-user collaboration.
---

# UI/UX Assessment Runbook (Spatial CAD & BIM)

This skill provides a systematic rubric for auditing 3D architectural/BIM editors to move beyond generic SaaS layouts.

## The 5-Tier Assessment Rubric

### Tier 1: Viewport & Spatial Immersion (Weight: 35%)
- **Canvas-to-Chrome Ratio**: Does the 3D viewport occupy at least 80–90% of screen real estate? Or do fixed sidebars shrink the model into an awkward letterbox?
- **Floating Tooling**: Are tools and inspection palettes floating, draggable, or collapsible?
- **Gizmo Legibility**: Are `TransformControls` (Translate, Rotate, Scale) clearly legible against both light and dark IFC element geometry?
- **Camera Ergonomics**: Is view manipulation fluid, with intuitive orbit, pan, zoom, and persistent orientation gizmo?
- **Clipping & Measurement HUD**: Do section planes and point-to-point measurement callouts render unobtrusively on canvas without blocking interactions?

### Tier 2: Information Architecture & Spatial Navigation (Weight: 25%)
- **Hierarchy Traversal**: Does the spatial tree support high-speed search, filtering by IFC entity class (`IfcWall`, `IfcDoor`), and instant isolation/hiding?
- **Context Preservation**: When selecting an element in 3D, does the spatial tree automatically scroll to and highlight the node?
- **Breadcrumbs**: Can the user instantly see their spatial path (`Project > Site > Building > Storey > Element`) without looking at a deep nested tree?

### Tier 3: Numerical Precision & Data Density (Weight: 20%)
- **CAD Coordinate Precision**: Are X, Y, Z coordinates and rotation angles formatted in clean, monospaced tabular fonts (e.g. `X: +12.450 m`)?
- **Property Inspector Organization**: Are property sets (`IfcPropertySet`) and quantities cleanly partitioned into scannable disclosure groups rather than an endless list of unstyled inputs?
- **Inline Editing Feedback**: Does inline editing give clear commit (`Enter`), cancel (`Escape`), and save-status indicators?

### Tier 4: Command & Copilot Flow (Weight: 10%)
- **Keyboard-First Workflow**: Is there a command palette (`Ctrl+K`) for switching projects, selecting elements, toggling tools, and triggering operations?
- **Copilot Integration**: Does the AI copilot slide out without pushing or resizing the 3D canvas? Can copilot modifications be inspected with visual diffs?

### Tier 5: Multi-User Awareness & Concurrency (Weight: 10%)
- **Soft Lock Feedback**: When an element is selected by another user, is the lock state immediately apparent (color-coded bounding box, avatar badge)?
- **Presence Indicators**: Are active collaborators clearly displayed without cluttering the top bar?

## Audit Scoring Guide
- **Grade S (World-Class CAD)**: Exceeds 90 points across all tiers. Viewport-first, fluid floating HUDs, instant keyboard access.
- **Grade A (Professional BIM Tool)**: 80–89 points. High density, clean tokens, minor polish gaps.
- **Grade B (Usable but Boilerplate)**: 65–79 points. Standard 3-pane layout, basic Tailwind dark mode, functional but generic.
- **Grade F (AI-Slop / Clone)**: Below 65 points. Heavy sidebars, hardcoded styles, emojis, generic cards, no focal points.
