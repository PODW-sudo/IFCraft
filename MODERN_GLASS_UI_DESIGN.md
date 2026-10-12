# Modern Glass UI Design Implementation Specification
**Document ID:** `DOC-UI-MODERN-GLASS-001`  
**Status:** Approved & Implemented  
**Theme:** Modern Glass — Soft / Elegant  
**Application:** IFC Editor (CAD & Spatial BIM Workstation)

---

## 1. Executive Summary

This document specifies the **"Modern Glass — Soft / Elegant"** user interface layout and visual design system for the IFC Editor. 

Departing from conventional 3-pane CAD dark-mode frames, this design implements an **immersive, 100% edge-to-edge spatial 3D canvas** overlaid with **floating, translucent frosted glass HUDs and panels**. The architecture delivers high visual refinement, numerical CAD precision, and fluid spatial interactivity.

```
+-----------------------------------------------------------------------------------------------+
| [Cube Logo] IFC Viewer [MODERN GLASS]      [ Q Search in model... ]     [Classic CAD] [O] [DD]| <- Top Header (Floating Frosted Glass)
+-----------------------------------------------------------------------------------------------+
|                                                                                               |
|  +----+  +---------------------+                                       +-------------------+  |
|  | [B]|  | Model               |                                       | Element Properties|  |
|  |Modl|  |                     |                                       |                   |  |
|  |    |  | [=] Office_Bldg.ifc |                        +-------+      | [B] IfcWall [Wall]|  |
|  | [Q]|  |                     |                        |  TOP  |      | Name: Basic Wall  |  |
|  |Srch|  | v Building (1,248)  |                        |FRONT|R|      | GlobalId: 2r3f... |  |
|  |    |  |   > Site (1)        |                        +-------+      | Material: Concrete|  |
|  | [R]|  |   > Building (1)    |                       (3D ViewCube)   |                   |  |
|  |Meas|  |   > Storey (6)      |                                       | v Dimensions      |  |
|  |    |  |                     |              3D VIEWPORT              |   Length: 12.450m |  |
|  | [X]|  | > Spaces (342)      |         (100% Full-Screen             |   Height:  3.000m |  |
|  |Clsh|  |                     |           Underneath All Panels)      |   Thick:   0.300m |  |
|  |    |  | v Elements (906)    |                                       |                   |  |
|  | [*]|  |   > Walls (432)     |                                       | v Location        |  |
|  |Setg|  |   > Floors (178)    |                                       |   Storey: Storey02|  |
|  |    |  |   > Columns (64)    |                                       |   Elev:    6.000m |  |
|  +----+  +----------+----------+                                       +---------+---------+  |
|   (Nav)   (Tree Dock|<->Handle)                                        (<-Handle>|Props)      |
|                                                                                               |
|       Z                       +----------------------------------+                            |
|       |                       | (o)  <->  [R]  [+]  [X]  [L] [*] |                            |
|       +--- Y                  +----------------------------------+                            |
|      /                         (Floating Frosted Bottom Tool Dock)                            |
|     X                                                                                         |
|  (Triad)                                                                                      |
+-----------------------------------------------------------------------------------------------+
```

---

## 2. Core Architectural Pillars

### 2.1. 100% Full-Screen Viewport Underneath (`inset-0`)
- The Three.js WebGL canvas spans the entire screen window edge-to-edge behind all other interface elements (`position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0`).
- The camera aspect ratio is calculated across the full window, presenting architectural models with expansive scale and depth.
- Orbit, turntable rotation, pan, and zoom operations operate across the entire surface.
- Model geometries, terraces, structural columns, and shadows are visible through the translucent frosted panels via CSS backdrop-filter effects.

### 2.2. Floating Frosted Glass Surfaces (Glassmorphism)
- All panels and toolbars float above the canvas on layer `z-index: 20` and `z-index: 30`.
- Surfaces utilize translucent white fills (`rgba(255, 255, 255, 0.45)` to `rgba(255, 255, 255, 0.65)`), intense backdrop blur (`backdrop-blur-2xl`, 24px–32px), inner border highlights (`border-white/60`), and diffused ambient drop shadows (`rgba(15, 23, 42, 0.08)`).
- Eliminates visual clutter while maintaining high tactile depth and clarity.

### 2.3. Dynamic Resizability & Ergonomics
- **Model Tree Panel:** Equipped with a right-edge resize handle (`ResizeHandle`, min: 220px, max: 550px, initial: 290px). Double-click resets width.
- **Element Properties Panel:** Equipped with a left-edge resize handle (`ResizeHandle`, min: 260px, max: 600px, initial: 340px). Double-click resets width.
- **60fps Drag Tracking:** CSS transition duration is automatically disabled during active drag operations (`isDragging ? '' : 'transition-[width] duration-150'`) to ensure instantaneous, lag-free mouse following.
- **Collapsible Docks:** Both panels include 1-click collapse toggles into compact 64px icon pillars.

### 2.4. Non-Colliding Viewport Overlays
- **3D ViewCube:** Positioned at `top: 80px` and dynamically offset horizontally based on the right panel's active width (`right: rightOffset + 16px`). Clicking faces ("Top", "Front", "Right", "Iso") animates camera angles.
- **XYZ Coordinate Triad:** Positioned at `bottom: 24px` and dynamically offset based on the left panel's active width (`left: leftOffset + 16px`), ensuring origin coordinates are never hidden behind navigation bars.
- **Floating Action Pill Toolbar:** Centered at `bottom: 24px`, featuring Orbit (active blue pill), Pan, Measure, Zoom Extents, Section Cut, Isolate, Share, and Tool Settings.

---

## 3. Design Tokens & Styling Constants

### 3.1. DTCG Design Tokens (`frontend/src/tokens/tokens.css`)

```css
/* Modern Glass — Soft / Elegant Theme Tokens */
:root {
  --glass-bg-canvas: #a5b9ce;
  --glass-bg-gradient: radial-gradient(at 15% 15%, rgba(224, 242, 254, 0.8) 0px, transparent 60%),
    radial-gradient(at 85% 20%, rgba(241, 245, 249, 0.9) 0px, transparent 55%),
    radial-gradient(at 50% 90%, rgba(219, 234, 254, 0.7) 0px, transparent 65%),
    linear-gradient(135deg, #a5b9ce 0%, #cbd8e6 40%, #e2e8f0 100%);
  --glass-surface-panel: rgba(255, 255, 255, 0.50);
  --glass-surface-card: rgba(255, 255, 255, 0.45);
  --glass-border: rgba(255, 255, 255, 0.60);
  --glass-shadow: 0 12px 36px 0 rgba(15, 23, 42, 0.08);
}
```

### 3.2. Geometric & Typography Hierarchy
- **Outer Panel Containers:** `rounded-3xl` (24px radius).
- **Inner Cards & Group Tiles:** `rounded-2xl` (16px radius).
- **Controls & Tree Items:** `rounded-xl` (12px radius).
- **Floating Toolbars & Search Capsule:** `rounded-full` (capsule pill).
- **Badges & Counts:** `rounded-md` / `rounded-full`.
- **Numerical Tabular Figures:** `font-mono tabular-nums` for dimensions, elevations, and polycounts.

---

## 4. Component Manifest

| Component | File Path | Responsibilities |
| :--- | :--- | :--- |
| **Root Assembly** | [`ModernGlassMockup.tsx`](file:///C:/Users/waleg/Documents/IFC%20Editor/frontend/src/components/mockup/ModernGlassMockup.tsx) | Coordinates full-screen viewport, floating overlay container, and tracks layout offsets. |
| **3D Viewport** | [`ModernGlassCanvas.tsx`](file:///C:/Users/waleg/Documents/IFC%20Editor/frontend/src/components/mockup/ModernGlassCanvas.tsx) | Full-screen Three.js WebGL scene, architectural lighting, ViewCube, XYZ triad, and bottom pill dock. |
| **3D ViewCube** | [`ModernGlassViewCube.tsx`](file:///C:/Users/waleg/Documents/IFC%20Editor/frontend/src/components/mockup/ModernGlassViewCube.tsx) | Isometric orientation cube with frosted faces; triggers smooth camera orientation transitions. |
| **Top Header** | [`ModernGlassHeader.tsx`](file:///C:/Users/waleg/Documents/IFC%20Editor/frontend/src/components/mockup/ModernGlassHeader.tsx) | 3D cube brand logo, "IFC Viewer" typography, centered frosted search input, and avatar controls. |
| **Navigation Rail**| [`ModernGlassNavRail.tsx`](file:///C:/Users/waleg/Documents/IFC%20Editor/frontend/src/components/mockup/ModernGlassNavRail.tsx) | Slim vertical dock hosting Model, Search, Measure, Clash, and Settings tools with active indicator. |
| **Spatial Tree** | [`ModernGlassTree.tsx`](file:///C:/Users/waleg/Documents/IFC%20Editor/frontend/src/components/mockup/ModernGlassTree.tsx) | Resizable hierarchy tree with category count badges, collapse toggles, and element selection. |
| **Properties** | [`ModernGlassProperties.tsx`](file:///C:/Users/waleg/Documents/IFC%20Editor/frontend/src/components/mockup/ModernGlassProperties.tsx) | Resizable inspector displaying element metadata, collapsible dimensions, and location readouts. |

---

## 5. Live Verification & Testing

### 5.1. Accessing the Modern Glass UI
- Direct URL: **`http://localhost:5173/?mockup=modern-glass`**
- Application Header: Click the **"Modern Glass"** pill button in the top navigation bar of `http://localhost:5173`.
- Return to Classic CAD: Click **"Classic CAD"** at the top right of the Modern Glass header.

### 5.2. Automated Quality Gates Pass
- **Zero Emoji Gate (`check_no_emoji.py`):** PASS (0 emojis).
- **Hardcode Linter (`lint_hardcodes.py`):** PASS (0 raw color literals).
- **Semantic Intent Linter (`lint_intent.py`):** PASS (All actions conform to intent tokens).
- **Token Contrast Verifier (`verify_contrast.py`):** PASS (WCAG 2.2 AA compliant).
- **TypeScript & Vite Build (`tsc -b && vite build`):** PASS (0 type errors, clean bundle).
- **Automated CDP Drag Test:** PASS (Panel dynamically resized from 288px to 368px in headless Chrome).

---

## 6. Document History

| Version | Date | Changes | Author |
| :--- | :--- | :--- | :--- |
| **1.0.0** | 2026-10-11 | Initial design specification and component mockup creation. | Antigravity AI |
| **2.0.0** | 2026-10-12 | Refactored layout to 100% full-screen canvas underneath floating transparent glass panels; implemented resizable splitters. | Antigravity AI |
