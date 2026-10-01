---
name: bim-ui-redesign
description: >-
  Use this skill to guide the redesign of the IFC Editor into a modern, minimalist spatial canvas.
  Replaces copied 3-pane layouts with a 100% immersive 3D viewport, floating matte/frosted HUDs,
  contextual hover toolbars, spatial breadcrumbs, and a keyboard-driven command palette (Ctrl+K).
---

# BIM UI Redesign Blueprint: Minimalist Spatial Canvas

This design blueprint details the transformation of the IFC Editor away from conventional boilerplate layouts into an elite, viewport-first spatial engineering workstation.

```
+-----------------------------------------------------------------------------------+
|  [Logo] Project: Villa IFC4 [v]    (Breadcrumbs: Site > Building > Storey 2)   [Users] | <- Floating Top HUD (Pill)
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [Spatial Tree Dock]                                             [Inspector Dock] |
|  - Floating Drawer                                               - Floating Drawer|
|  - 1-click collapse                                              - 1-click collapse
|  - Glassmorphic / matte                                          - High-density   |
|                                                                                   |
|                                  3D VIEWPORT                                      |
|                                (100% of Screen)                                   |
|                                                                                   |
|                          +---------------------------+                            |
|                          | [Select][Move][Rot][Sect] | <- Contextual Floating     |
|                          | [Measure] [Snap] [Copilot]|    Bottom Dock             |
|                          +---------------------------+                            |
|                                                                                   |
|  [Coordinate Readout HUD]                                  [View Orientation Cube]|
|  X: +14.200m  Y: +3.400m  Z: +0.000m                                              |
+-----------------------------------------------------------------------------------+
```

## Architectural Tenets of Option C: Spatial Canvas

### 1. 100% Viewport Immersion
- The 3D Three.js canvas spans the entire screen window edge-to-edge.
- Side panels are no longer layout-pushing grid columns. Instead, they are **floating overlay docks** that can be pinned, collapsed into sleek icon tabs, or dragged.
- The 3D model is always center stage, never squished or resized when panels open.

### 2. Floating Top Pill Navigation
- Replaces the heavy 56px top bar with an unobtrusive, floating frosted-glass pill bar:
  - Brand & active project selector with subtle status pill.
  - Active spatial breadcrumb trail (`Site > Level 1 > Wall #4012`) allowing rapid up-hierarchy navigation.
  - Real-time collaborator avatars.
  - Fast action triggers (Upload, Export, Settings).

### 3. Contextual Floating Tool Dock (Bottom Center)
- Centered dock elevated over the bottom of the viewport:
  - Transform modes (Select, Translate, Rotate, Scale) with visual active indicator.
  - BIM Inspection tools (Orthogonal Sectioning, Point-to-Point Laser Ruler).
  - Rendering styles (Shaded, Wireframe, Monochrome Clay, Normal Vectors).
  - Snap toggle with visual grid badge.
  - AI Copilot summon button with keyboard shortcut hint (`Ctrl+J`).

### 4. Spatial Omnibar & Command Palette (`Ctrl+K`)
- An instant modal omnibar to search and perform any action without touching a mouse:
  - Search IFC classes (`wall`, `slab`, `column`, `door`).
  - Search by expressID (`#421`).
  - Jump to storeys (`Level 1`, `Ground Floor`).
  - Run tools (`measure`, `section plane`, `export ifc`, `copilot prompt`).

### 5. High-Precision Numerical HUD
- Bottom-left heads-up display showing active coordinates, delta vectors, and polycount stats.
- Tabular monospaced figures (`font-variant-numeric: tabular-nums`) preventing layout jitter during live gizmo dragging.

### 6. Design Token Integration
- All floating surfaces, borders, typography, and controls map strictly to `frontend/src/tokens/tokens.json`.
- Zero hardcoded colors. Zero arbitrary margins.
