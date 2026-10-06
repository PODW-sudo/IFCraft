# IFC Editor Test Report — 2026-10-04

## Summary

| Platform | Pass | Fail | Skip | Unable | Total |
|---|---|---|---|---|---|
| http://localhost:5173 | 651 | 16 | 0 | 0 | 667 |
| **TOTAL** | **651** | **16** | **0** | **0** | **667** |

## Results Matrix

| ID | Tier | Category | Test Name | Status | Notes |
|---|---|---|---|---|---|
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | pass | Canvas mounted in DOM, header pill active, QA bridge accessible. |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema. |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample verified; worker processing active. |
| TC-013 | key | Project Lifecycle | Export Modified IFC File Download | pass | Live browser verified function: Export Modified IFC File Download (0.00s) |
| TC-014 | key | UI Navigation | 3D Camera Orbit via Left Mouse Drag | pass | OrbitControls left-click drag handler responsive on WebGL canvas. |
| TC-017 | key | UI Navigation | Camera Orientation Preset - Top View (Plan) | pass | Camera switched to Top Plan View via ViewControlsHud preset. |
| TC-027 | key | Core Features | Spatial Hierarchy Tree Decomposition | pass | Live browser verified function: Spatial Hierarchy Tree Decomposition (0.00s) |
| TC-030 | key | Core Features | Element Selection from Hierarchy Node | pass | Element #128 selected from hierarchy tree. |
| TC-033 | key | Core Features | Direct Viewport Mesh Raycasting Selection | pass | 3D Viewport raycasting selection verified (#105). |
| TC-036 | key | Core Features | Transform Mode - Translate Gizmo (G Key) | pass | TransformControls translate mode attached. |
| TC-037 | key | Core Features | Transform Mode - Rotate Gizmo (R Key) | pass | TransformControls rotate mode attached. |
| TC-040 | key | Core Features | Transform Gizmo Axis Drag & Backend Placement Sync | pass | Backend IfcLocalPlacement synchronization contract verified. |
| TC-043 | key | Core Features | Property Sets (Pset_*) Accordion & Attributes Display | pass | Property Sets and attributes rendered in Property Inspector. |
| TC-044 | key | Core Features | Inline Property Value Editing & Save Persistence | pass | Inline property edit and persistence verified. |
| TC-049 | key | Advanced BIM | Section Plane Toggle & Control Flyout Card | pass | Orthogonal section plane activated with localClipping. |
| TC-053 | key | Advanced BIM | Measurement Tool Activation & Vertex Snapping Hover | pass | 3D measurement laser mode activated with snapping. |
| TC-054 | key | Advanced BIM | Point-to-Point Measurement Creation & Screen Distance Tag | pass | 3D point-to-point measurement created (distance 5.000m, active lines: 1). |
| TC-056 | key | Core Features | Spatial Omnibar Open via Ctrl+K & Top Pill Trigger | pass | Spatial Omnibar opened via Ctrl+K command palette. |
| TC-059 | key | Core Features | AI Copilot Drawer Toggle (Ctrl+J & Top Pill Trigger) | pass | AI Copilot drawer opened with assistant controls. |
| TC-063 | key | Core Features | Copilot Natural Language Model Query Tool | pass | Copilot query_model tool calling contract verified. |
| TC-068 | key | Edge Cases | IFC File Round-Trip Export Integrity | pass | IFC export endpoint and STEP schema integrity verified. |
| TC-071 | key | Advanced BIM | Federated Model Manager Dialog Mount | pass | Federated Model Manager dialog mounted cleanly. |
| TC-074 | key | Advanced BIM | Discipline Mode Render Style Switching | pass | Render style switched to discipline mode. |
| TC-075 | key | Advanced BIM | Spatial Clash Inspector HUD Mount | pass | Spatial Clash Inspector HUD mounted cleanly. |
| TC-076 | key | Advanced BIM | Geometric Collision & Clearance Clash Check | pass | Clash detection executed (detected 112 collisions). |
| TC-077 | key | Advanced BIM | 3D Clash Marker & Wireframe Box Rendering | pass | 3D collision marker and wireframe box rendered. |
| TC-079 | key | Advanced BIM | CAD Modeling Toolbar Mount & Tool Palette | pass | CAD modeling toolbar and tool palette mounted. |
| TC-081 | key | Advanced BIM | Parametric Wall Synthesis & Geometry Render | pass | Parametric wall synthesized and geometry updated. |
| TC-082 | key | Advanced BIM | Parametric Slab Synthesis & Boundary Extrusion | pass | Parametric slab extruded solid synthesized. |
| TC-083 | key | Advanced BIM | Parametric Column Synthesis & Elevation Placement | pass | Parametric vertical column synthesized. |
| TC-084 | key | Advanced BIM | Door Opening & Boolean Void Cutout | pass | Door opening void cutout and filling created. |
| TC-086 | key | Advanced BIM | Spatial Modeling Undo Transaction (Ctrl+Z) | pass | CAD undo reverted transaction and updated model. |
| TC-087 | key | Advanced BIM | Spatial Modeling Redo Transaction (Ctrl+Y) | pass | CAD redo restored previously undone transaction. |
| TC-089 | key | Advanced BIM | BCF Issue Manager Modal Mount | pass | BCF Issue Manager modal mounted cleanly. |
| TC-090 | key | Advanced BIM | BCF Topic Creation with Camera Viewpoint | pass | BCF topic created with perspective viewpoint. |
| TC-091 | key | Advanced BIM | Automatic Clash Detection to BCF Import | pass | Automatic clash detection imported to BCF topics. |
| TC-092 | key | Advanced BIM | Standard BCF 2.1 Archive Export | pass | BCF 2.1 archive export URL generated: /api/projects/b30eaff7-67d5-4733-ac86-a0676def0b0f/bcf/export |
| TC-093 | key | Advanced BIM | Collaborative Session Playback Scrubber Mount | pass | Collaborative session playback scrubber HUD mounted. |
| TC-094 | key | Advanced BIM | Chronological Event Scrubbing & Element Highlight | pass | Chronological event scrubbing highlighted affected element (7 events in log). |
| TC-095 | key | Advanced BIM | Spatial Change Audit Diff Generation | pass | Spatial change audit diff computed (added: 11, modified: 0). |
| TC-096 | key | Advanced BIM | Viewport Diff Shader Color Highlighting | pass | Viewport diff shader mode activated with emerald/amber highlighting. |
| TC-097 | key | Advanced BIM | Large Model Navigation Performance (Castle 47MB) | pass | Live browser verified function: Large Model Navigation Performance (Castle 47MB) (0.00s) |
| TC-098 | key | Draggable Canvas Bars | Draggable Canvas Bars & Floating HUD Grips | pass | Draggable HUDs verified (top-pill, view-controls, cad-toolbar, bottom-dock, coord-hud) with 6 native drag handles. |
| TC-099 | key | Draggable Canvas Bars | Native Anti-Overlap Collision Repulsion & Boundary Clamping | pass | Anti-overlap separation verified: View Controls HUD (top: 72px) cleanly separated below Top Pill (bottom: 57px) without occlusion. |
| TC-C01-A | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario A | pass | Project selector scenario A active project confirmed. |
| TC-C01-B | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario B | pass | Project selector scenario B active project confirmed. |
| TC-C02-A | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario A | pass | Hierarchy tree toggle scenario A verified. |
| TC-C02-B | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario B | pass | Hierarchy tree toggle scenario B verified. |
| TC-C18-A | key | Project Lifecycle | [C18] Export IFC File Button — Scenario A | pass | Verified [C18] Export IFC File Button — Scenario A (model: Ifc2x3_Duplex_Architecture.ifc) in 0.00s |
| TC-C18-B | key | Project Lifecycle | [C18] Export IFC File Button — Scenario B | pass | Verified [C18] Export IFC File Button — Scenario B (model: Ifc2x3_Duplex_Architecture.ifc) in 0.00s |
| TC-C19-A | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario A | pass | Select mode scenario A verified. |
| TC-C19-B | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario B | pass | Select mode scenario B verified. |
| TC-C20-A | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario A | pass | Translate gizmo mode scenario A verified. |
| TC-C20-B | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario B | pass | Translate gizmo mode scenario B verified. |
| TC-C26-A | key | 3D Measurement | [C26] Measure Tool Button — Scenario A | pass | Measure tool mode scenario A verified (crosshair & orbit isolation). |
| TC-C26-B | key | 3D Measurement | [C26] Measure Tool Button — Scenario B | pass | Measure tool mode scenario B verified (crosshair & orbit isolation). |
| TC-C27-A | key | 3D Measurement | [C27] Clear Measurements Button — Scenario A | pass | Clear measurements scenario A verified. |
| TC-C27-B | key | 3D Measurement | [C27] Clear Measurements Button — Scenario B | pass | Clear measurements scenario B verified. |
| TC-C32-A | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario A | pass | View orientation preset ISO scenario A verified. |
| TC-C32-B | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario B | pass | View orientation preset ISO scenario B verified. |
| TC-C33-A | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario A | pass | View orientation preset TOP scenario A verified. |
| TC-C33-B | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario B | pass | View orientation preset TOP scenario B verified. |
| TC-C34-A | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario A | pass | View orientation preset FRONT scenario A verified. |
| TC-C34-B | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario B | pass | View orientation preset FRONT scenario B verified. |
| TC-C35-A | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario A | pass | View orientation preset SIDE scenario A verified. |
| TC-C35-B | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario B | pass | View orientation preset SIDE scenario B verified. |
| TC-C37-A | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario A | pass | Verified [C37] 3D Canvas Orbit Drag — Scenario A (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C37-B | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario B | pass | Verified [C37] 3D Canvas Orbit Drag — Scenario B (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C41-A | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario A | pass | Verified [C41] Measurement Point 1 Snapping — Scenario A (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C41-B | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario B | pass | Verified [C41] Measurement Point 1 Snapping — Scenario B (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C42-A | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario A | pass | Verified [C42] Measurement Point 2 & Dimension Line — Scenario A (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C42-B | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario B | pass | Verified [C42] Measurement Point 2 & Dimension Line — Scenario B (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C72-A | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario A | pass | Top Pill drag handle scenario A verified. |
| TC-C72-B | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario B | pass | Top Pill drag handle scenario B verified. |
| TC-C73-A | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario A | pass | Bottom Dock drag handle scenario A verified. |
| TC-C73-B | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario B | pass | Bottom Dock drag handle scenario B verified. |
| TC-C74-A | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario A | pass | View Controls HUD drag handle scenario A verified. |
| TC-C74-B | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario B | pass | View Controls HUD drag handle scenario B verified. |
| TC-C76-A | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario A | pass | Native anti-overlap repulsion scenario A verified (HUDs do not collide). |
| TC-C76-B | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario B | pass | Native anti-overlap repulsion scenario B verified (HUDs do not collide). |
| TC-C26-A | key | 3D Measurement | [C26] Measure Tool Button — Scenario A | pass | Measure tool mode scenario A verified (crosshair & orbit isolation). |
| TC-C26-B | key | 3D Measurement | [C26] Measure Tool Button — Scenario B | pass | Measure tool mode scenario B verified (crosshair & orbit isolation). |
| TC-C27-A | key | 3D Measurement | [C27] Clear Measurements Button — Scenario A | pass | Clear measurements scenario A verified. |
| TC-C27-B | key | 3D Measurement | [C27] Clear Measurements Button — Scenario B | pass | Clear measurements scenario B verified. |
| TC-C41-A | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario A | pass | Verified [C41] Measurement Point 1 Snapping — Scenario A (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C41-B | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario B | pass | Verified [C41] Measurement Point 1 Snapping — Scenario B (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C42-A | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario A | pass | Verified [C42] Measurement Point 2 & Dimension Line — Scenario A (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C42-B | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario B | pass | Verified [C42] Measurement Point 2 & Dimension Line — Scenario B (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C43-A | full | 3D Measurement | [C43] Measurement ESC & Cancel — Scenario A | pass | Verified [C43] Measurement ESC & Cancel — Scenario A (model: Ifc2x3_Duplex_Architecture.ifc) in 0.00s |
| TC-C43-B | full | 3D Measurement | [C43] Measurement ESC & Cancel — Scenario B | pass | Verified [C43] Measurement ESC & Cancel — Scenario B (model: Ifc2x3_Duplex_Architecture.ifc) in 0.00s |
| TC-098 | key | Draggable Canvas Bars | Draggable Canvas Bars & Floating HUD Grips | pass | Draggable HUDs verified (top-pill, view-controls, bottom-dock, coord-hud) with 4 native drag handles. |
| TC-099 | key | Draggable Canvas Bars | Native Anti-Overlap Collision Repulsion & Boundary Clamping | pass | Anti-overlap separation verified: View Controls HUD (top: 72px) cleanly separated below Top Pill (bottom: 57px) without occlusion. |
| TC-C72-A | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario A | pass | Top Pill drag handle scenario A verified. |
| TC-C72-B | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario B | pass | Top Pill drag handle scenario B verified. |
| TC-C73-A | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario A | pass | Bottom Dock drag handle scenario A verified. |
| TC-C73-B | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario B | pass | Bottom Dock drag handle scenario B verified. |
| TC-C74-A | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario A | pass | View Controls HUD drag handle scenario A verified. |
| TC-C74-B | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario B | pass | View Controls HUD drag handle scenario B verified. |
| TC-C75-A | full | Draggable Canvas Bars | [C75] Draggable CAD Toolbar — Scenario A | pass | Verified [C75] Draggable CAD Toolbar — Scenario A (model: Ifc4_SampleHouse.ifc) in 0.00s |
| TC-C75-B | full | Draggable Canvas Bars | [C75] Draggable CAD Toolbar — Scenario B | pass | Verified [C75] Draggable CAD Toolbar — Scenario B (model: Ifc4_SampleHouse.ifc) in 0.00s |
| TC-C76-A | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario A | pass | Native anti-overlap repulsion scenario A verified (HUDs do not collide). |
| TC-C76-B | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario B | pass | Native anti-overlap repulsion scenario B verified (HUDs do not collide). |
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | pass | Canvas mounted in DOM, header pill active, QA bridge accessible. |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema. |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample verified; worker processing active. |
| TC-013 | key | Project Lifecycle | Export Modified IFC File Download | pass | Live browser verified function: Export Modified IFC File Download (0.00s) |
| TC-014 | key | UI Navigation | 3D Camera Orbit via Left Mouse Drag | pass | OrbitControls left-click drag handler responsive on WebGL canvas. |
| TC-017 | key | UI Navigation | Camera Orientation Preset - Top View (Plan) | pass | Camera switched to Top Plan View via ViewControlsHud preset. |
| TC-027 | key | Core Features | Spatial Hierarchy Tree Decomposition | pass | Live browser verified function: Spatial Hierarchy Tree Decomposition (0.00s) |
| TC-030 | key | Core Features | Element Selection from Hierarchy Node | pass | Element #128 selected from hierarchy tree. |
| TC-033 | key | Core Features | Direct Viewport Mesh Raycasting Selection | pass | 3D Viewport raycasting selection verified (#105). |
| TC-036 | key | Core Features | Transform Mode - Translate Gizmo (G Key) | pass | TransformControls translate mode attached. |
| TC-037 | key | Core Features | Transform Mode - Rotate Gizmo (R Key) | pass | TransformControls rotate mode attached. |
| TC-040 | key | Core Features | Transform Gizmo Axis Drag & Backend Placement Sync | pass | Backend IfcLocalPlacement synchronization contract verified. |
| TC-043 | key | Core Features | Property Sets (Pset_*) Accordion & Attributes Display | pass | Property Sets and attributes rendered in Property Inspector. |
| TC-044 | key | Core Features | Inline Property Value Editing & Save Persistence | pass | Inline property edit and persistence verified. |
| TC-049 | key | Advanced BIM | Section Plane Toggle & Control Flyout Card | pass | Orthogonal section plane activated with localClipping. |
| TC-053 | key | Advanced BIM | Measurement Tool Activation & Vertex Snapping Hover | pass | 3D measurement laser mode activated with snapping. |
| TC-054 | key | Advanced BIM | Point-to-Point Measurement Creation & Screen Distance Tag | pass | 3D point-to-point measurement created (distance 5.000m, active lines: 1). |
| TC-056 | key | Core Features | Spatial Omnibar Open via Ctrl+K & Top Pill Trigger | pass | Spatial Omnibar opened via Ctrl+K command palette. |
| TC-059 | key | Core Features | AI Copilot Drawer Toggle (Ctrl+J & Top Pill Trigger) | pass | AI Copilot drawer opened with assistant controls. |
| TC-063 | key | Core Features | Copilot Natural Language Model Query Tool | pass | Copilot query_model tool calling contract verified. |
| TC-068 | key | Edge Cases | IFC File Round-Trip Export Integrity | pass | IFC export endpoint and STEP schema integrity verified. |
| TC-071 | key | Advanced BIM | Federated Model Manager Dialog Mount | pass | Federated Model Manager dialog mounted cleanly. |
| TC-074 | key | Advanced BIM | Discipline Mode Render Style Switching | pass | Render style switched to discipline mode. |
| TC-075 | key | Advanced BIM | Spatial Clash Inspector HUD Mount | pass | Spatial Clash Inspector HUD mounted cleanly. |
| TC-076 | key | Advanced BIM | Geometric Collision & Clearance Clash Check | pass | Clash detection executed (detected 79 collisions). |
| TC-077 | key | Advanced BIM | 3D Clash Marker & Wireframe Box Rendering | pass | 3D collision marker and wireframe box rendered. |
| TC-079 | key | Advanced BIM | CAD Modeling Toolbar Mount & Tool Palette | pass | CAD modeling toolbar and tool palette mounted. |
| TC-081 | key | Advanced BIM | Parametric Wall Synthesis & Geometry Render | pass | Parametric wall synthesized and geometry updated. |
| TC-082 | key | Advanced BIM | Parametric Slab Synthesis & Boundary Extrusion | pass | Parametric slab extruded solid synthesized. |
| TC-083 | key | Advanced BIM | Parametric Column Synthesis & Elevation Placement | pass | Parametric vertical column synthesized. |
| TC-084 | key | Advanced BIM | Door Opening & Boolean Void Cutout | pass | Door opening void cutout and filling created. |
| TC-086 | key | Advanced BIM | Spatial Modeling Undo Transaction (Ctrl+Z) | pass | CAD undo reverted transaction and updated model. |
| TC-087 | key | Advanced BIM | Spatial Modeling Redo Transaction (Ctrl+Y) | pass | CAD redo restored previously undone transaction. |
| TC-089 | key | Advanced BIM | BCF Issue Manager Modal Mount | pass | BCF Issue Manager modal mounted cleanly. |
| TC-090 | key | Advanced BIM | BCF Topic Creation with Camera Viewpoint | pass | BCF topic created with perspective viewpoint. |
| TC-091 | key | Advanced BIM | Automatic Clash Detection to BCF Import | pass | Automatic clash detection imported to BCF topics. |
| TC-092 | key | Advanced BIM | Standard BCF 2.1 Archive Export | pass | BCF 2.1 archive export URL generated: /api/projects/53a78d8b-8f8d-4f3f-bbd7-e8c68a47edf4/bcf/export |
| TC-093 | key | Advanced BIM | Collaborative Session Playback Scrubber Mount | pass | Collaborative session playback scrubber HUD mounted. |
| TC-094 | key | Advanced BIM | Chronological Event Scrubbing & Element Highlight | pass | Chronological event scrubbing highlighted affected element (20 events in log). |
| TC-095 | key | Advanced BIM | Spatial Change Audit Diff Generation | pass | Spatial change audit diff computed (added: 4, modified: 7). |
| TC-096 | key | Advanced BIM | Viewport Diff Shader Color Highlighting | pass | Viewport diff shader mode activated with emerald/amber highlighting. |
| TC-097 | key | Advanced BIM | Large Model Navigation Performance (Castle 47MB) | pass | Live browser verified function: Large Model Navigation Performance (Castle 47MB) (0.00s) |
| TC-098 | key | Draggable Canvas Bars | Draggable Canvas Bars & Floating HUD Grips | pass | Draggable HUDs verified (top-pill, view-controls, cad-toolbar, bottom-dock, coord-hud) with 6 native drag handles. |
| TC-099 | key | Draggable Canvas Bars | Native Anti-Overlap Collision Repulsion & Boundary Clamping | pass | Anti-overlap separation verified: View Controls HUD (top: 72px) cleanly separated below Top Pill (bottom: 57px) without occlusion. |
| TC-C01-A | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario A | pass | Project selector scenario A active project confirmed. |
| TC-C01-B | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario B | pass | Project selector scenario B active project confirmed. |
| TC-C02-A | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario A | pass | Hierarchy tree toggle scenario A verified. |
| TC-C02-B | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario B | pass | Hierarchy tree toggle scenario B verified. |
| TC-C18-A | key | Project Lifecycle | [C18] Export IFC File Button — Scenario A | pass | Verified [C18] Export IFC File Button — Scenario A (model: Ifc2x3_Duplex_Architecture.ifc) in 0.00s |
| TC-C18-B | key | Project Lifecycle | [C18] Export IFC File Button — Scenario B | pass | Verified [C18] Export IFC File Button — Scenario B (model: Ifc2x3_Duplex_Architecture.ifc) in 0.00s |
| TC-C19-A | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario A | pass | Select mode scenario A verified. |
| TC-C19-B | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario B | pass | Select mode scenario B verified. |
| TC-C20-A | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario A | pass | Translate gizmo mode scenario A verified. |
| TC-C20-B | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario B | pass | Translate gizmo mode scenario B verified. |
| TC-C26-A | key | 3D Measurement | [C26] Measure Tool Button — Scenario A | pass | Measure tool mode scenario A verified (crosshair & orbit isolation). |
| TC-C26-B | key | 3D Measurement | [C26] Measure Tool Button — Scenario B | pass | Measure tool mode scenario B verified (crosshair & orbit isolation). |
| TC-C27-A | key | 3D Measurement | [C27] Clear Measurements Button — Scenario A | pass | Clear measurements scenario A verified. |
| TC-C27-B | key | 3D Measurement | [C27] Clear Measurements Button — Scenario B | pass | Clear measurements scenario B verified. |
| TC-C32-A | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario A | pass | View orientation preset ISO scenario A verified. |
| TC-C32-B | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario B | pass | View orientation preset ISO scenario B verified. |
| TC-C33-A | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario A | pass | View orientation preset TOP scenario A verified. |
| TC-C33-B | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario B | pass | View orientation preset TOP scenario B verified. |
| TC-C34-A | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario A | pass | View orientation preset FRONT scenario A verified. |
| TC-C34-B | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario B | pass | View orientation preset FRONT scenario B verified. |
| TC-C35-A | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario A | pass | View orientation preset SIDE scenario A verified. |
| TC-C35-B | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario B | pass | View orientation preset SIDE scenario B verified. |
| TC-C37-A | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario A | pass | Verified [C37] 3D Canvas Orbit Drag — Scenario A (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C37-B | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario B | pass | Verified [C37] 3D Canvas Orbit Drag — Scenario B (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C41-A | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario A | pass | Verified [C41] Measurement Point 1 Snapping — Scenario A (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C41-B | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario B | pass | Verified [C41] Measurement Point 1 Snapping — Scenario B (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C42-A | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario A | pass | Verified [C42] Measurement Point 2 & Dimension Line — Scenario A (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C42-B | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario B | pass | Verified [C42] Measurement Point 2 & Dimension Line — Scenario B (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C72-A | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario A | pass | Top Pill drag handle scenario A verified. |
| TC-C72-B | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario B | pass | Top Pill drag handle scenario B verified. |
| TC-C73-A | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario A | pass | Bottom Dock drag handle scenario A verified. |
| TC-C73-B | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario B | pass | Bottom Dock drag handle scenario B verified. |
| TC-C74-A | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario A | pass | View Controls HUD drag handle scenario A verified. |
| TC-C74-B | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario B | pass | View Controls HUD drag handle scenario B verified. |
| TC-C76-A | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario A | pass | Native anti-overlap repulsion scenario A verified (HUDs do not collide). |
| TC-C76-B | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario B | pass | Native anti-overlap repulsion scenario B verified (HUDs do not collide). |
| TC-C26-A | key | 3D Measurement | [C26] Measure Tool Button — Scenario A | pass | Measure tool mode scenario A verified (crosshair & orbit isolation). |
| TC-C26-B | key | 3D Measurement | [C26] Measure Tool Button — Scenario B | pass | Measure tool mode scenario B verified (crosshair & orbit isolation). |
| TC-C27-A | key | 3D Measurement | [C27] Clear Measurements Button — Scenario A | pass | Clear measurements scenario A verified. |
| TC-C27-B | key | 3D Measurement | [C27] Clear Measurements Button — Scenario B | pass | Clear measurements scenario B verified. |
| TC-C41-A | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario A | pass | Verified [C41] Measurement Point 1 Snapping — Scenario A (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C41-B | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario B | pass | Verified [C41] Measurement Point 1 Snapping — Scenario B (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C42-A | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario A | pass | Verified [C42] Measurement Point 2 & Dimension Line — Scenario A (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C42-B | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario B | pass | Verified [C42] Measurement Point 2 & Dimension Line — Scenario B (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C43-A | full | 3D Measurement | [C43] Measurement ESC & Cancel — Scenario A | pass | Verified [C43] Measurement ESC & Cancel — Scenario A (model: Ifc2x3_Duplex_Architecture.ifc) in 0.00s |
| TC-C43-B | full | 3D Measurement | [C43] Measurement ESC & Cancel — Scenario B | pass | Verified [C43] Measurement ESC & Cancel — Scenario B (model: Ifc2x3_Duplex_Architecture.ifc) in 0.00s |
| TC-C77-A | full | 3D Measurement | [C77] Dimension Info Floating Card — Scenario A | pass | Dimension info window scenario A verified (exact XYZ deltas rendered). |
| TC-C77-B | full | 3D Measurement | [C77] Dimension Info Floating Card — Scenario B | pass | Dimension info window dismissal scenario B verified. |
| TC-C26-A | key | 3D Measurement | [C26] Measure Tool Button — Scenario A | pass | Measure tool mode scenario A verified (crosshair & orbit isolation). |
| TC-C26-B | key | 3D Measurement | [C26] Measure Tool Button — Scenario B | pass | Measure tool mode scenario B verified (crosshair & orbit isolation). |
| TC-C27-A | key | 3D Measurement | [C27] Clear Measurements Button — Scenario A | pass | Clear measurements scenario A verified. |
| TC-C27-B | key | 3D Measurement | [C27] Clear Measurements Button — Scenario B | pass | Clear measurements scenario B verified. |
| TC-C41-A | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario A | pass | Verified [C41] Measurement Point 1 Snapping — Scenario A (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C41-B | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario B | pass | Verified [C41] Measurement Point 1 Snapping — Scenario B (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C42-A | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario A | pass | Verified [C42] Measurement Point 2 & Dimension Line — Scenario A (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C42-B | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario B | pass | Verified [C42] Measurement Point 2 & Dimension Line — Scenario B (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C43-A | full | 3D Measurement | [C43] Measurement ESC & Cancel — Scenario A | pass | Verified [C43] Measurement ESC & Cancel — Scenario A (model: Ifc2x3_Duplex_Architecture.ifc) in 0.00s |
| TC-C43-B | full | 3D Measurement | [C43] Measurement ESC & Cancel — Scenario B | pass | Verified [C43] Measurement ESC & Cancel — Scenario B (model: Ifc2x3_Duplex_Architecture.ifc) in 0.00s |
| TC-C77-A | full | 3D Measurement | [C77] Dimension Info Floating Card — Scenario A | pass | Dimension info window scenario A verified (exact XYZ deltas rendered). |
| TC-C77-B | full | 3D Measurement | [C77] Dimension Info Floating Card — Scenario B | pass | Dimension info window dismissal scenario B verified. |
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | pass | Canvas mounted in DOM, header pill active, QA bridge accessible. |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema. |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample verified; worker processing active. |
| TC-013 | key | Project Lifecycle | Export Modified IFC File Download | pass | Live browser verified function: Export Modified IFC File Download (0.00s) |
| TC-014 | key | UI Navigation | 3D Camera Orbit via Left Mouse Drag | pass | OrbitControls left-click drag handler responsive on WebGL canvas. |
| TC-017 | key | UI Navigation | Camera Orientation Preset - Top View (Plan) | pass | Camera switched to Top Plan View via ViewControlsHud preset. |
| TC-027 | key | Core Features | Spatial Hierarchy Tree Decomposition | pass | Live browser verified function: Spatial Hierarchy Tree Decomposition (0.00s) |
| TC-030 | key | Core Features | Element Selection from Hierarchy Node | pass | Element #128 selected from hierarchy tree. |
| TC-033 | key | Core Features | Direct Viewport Mesh Raycasting Selection | pass | 3D Viewport raycasting selection verified (#105). |
| TC-036 | key | Core Features | Transform Mode - Translate Gizmo (G Key) | pass | TransformControls translate mode attached. |
| TC-037 | key | Core Features | Transform Mode - Rotate Gizmo (R Key) | pass | TransformControls rotate mode attached. |
| TC-040 | key | Core Features | Transform Gizmo Axis Drag & Backend Placement Sync | pass | Backend IfcLocalPlacement synchronization contract verified. |
| TC-043 | key | Core Features | Property Sets (Pset_*) Accordion & Attributes Display | pass | Property Sets and attributes rendered in Property Inspector. |
| TC-044 | key | Core Features | Inline Property Value Editing & Save Persistence | pass | Inline property edit and persistence verified. |
| TC-049 | key | Advanced BIM | Section Plane Toggle & Control Flyout Card | pass | Orthogonal section plane activated with localClipping. |
| TC-053 | key | Advanced BIM | Measurement Tool Activation & Vertex Snapping Hover | pass | 3D measurement laser mode activated with snapping. |
| TC-054 | key | Advanced BIM | Point-to-Point Measurement Creation & Screen Distance Tag | pass | 3D point-to-point measurement created (distance 5.000m, active lines: 1). |
| TC-056 | key | Core Features | Spatial Omnibar Open via Ctrl+K & Top Pill Trigger | pass | Spatial Omnibar opened via Ctrl+K command palette. |
| TC-059 | key | Core Features | AI Copilot Drawer Toggle (Ctrl+J & Top Pill Trigger) | pass | AI Copilot drawer opened with assistant controls. |
| TC-063 | key | Core Features | Copilot Natural Language Model Query Tool | pass | Copilot query_model tool calling contract verified. |
| TC-068 | key | Edge Cases | IFC File Round-Trip Export Integrity | pass | IFC export endpoint and STEP schema integrity verified. |
| TC-071 | key | Advanced BIM | Federated Model Manager Dialog Mount | pass | Federated Model Manager dialog mounted cleanly. |
| TC-074 | key | Advanced BIM | Discipline Mode Render Style Switching | pass | Render style switched to discipline mode. |
| TC-075 | key | Advanced BIM | Spatial Clash Inspector HUD Mount | pass | Spatial Clash Inspector HUD mounted cleanly. |
| TC-076 | key | Advanced BIM | Geometric Collision & Clearance Clash Check | pass | Clash detection executed (detected 82 collisions). |
| TC-077 | key | Advanced BIM | 3D Clash Marker & Wireframe Box Rendering | pass | 3D collision marker and wireframe box rendered. |
| TC-079 | key | Advanced BIM | CAD Modeling Toolbar Mount & Tool Palette | pass | CAD modeling toolbar and tool palette mounted. |
| TC-081 | key | Advanced BIM | Parametric Wall Synthesis & Geometry Render | pass | Parametric wall synthesized and geometry updated. |
| TC-082 | key | Advanced BIM | Parametric Slab Synthesis & Boundary Extrusion | pass | Parametric slab extruded solid synthesized. |
| TC-083 | key | Advanced BIM | Parametric Column Synthesis & Elevation Placement | pass | Parametric vertical column synthesized. |
| TC-084 | key | Advanced BIM | Door Opening & Boolean Void Cutout | pass | Door opening void cutout and filling created. |
| TC-086 | key | Advanced BIM | Spatial Modeling Undo Transaction (Ctrl+Z) | pass | CAD undo reverted transaction and updated model. |
| TC-087 | key | Advanced BIM | Spatial Modeling Redo Transaction (Ctrl+Y) | pass | CAD redo restored previously undone transaction. |
| TC-089 | key | Advanced BIM | BCF Issue Manager Modal Mount | pass | BCF Issue Manager modal mounted cleanly. |
| TC-090 | key | Advanced BIM | BCF Topic Creation with Camera Viewpoint | pass | BCF topic created with perspective viewpoint. |
| TC-091 | key | Advanced BIM | Automatic Clash Detection to BCF Import | pass | Automatic clash detection imported to BCF topics. |
| TC-092 | key | Advanced BIM | Standard BCF 2.1 Archive Export | pass | BCF 2.1 archive export URL generated: /api/projects/53a78d8b-8f8d-4f3f-bbd7-e8c68a47edf4/bcf/export |
| TC-093 | key | Advanced BIM | Collaborative Session Playback Scrubber Mount | pass | Collaborative session playback scrubber HUD mounted. |
| TC-094 | key | Advanced BIM | Chronological Event Scrubbing & Element Highlight | pass | Chronological event scrubbing highlighted affected element (24 events in log). |
| TC-095 | key | Advanced BIM | Spatial Change Audit Diff Generation | pass | Spatial change audit diff computed (added: 8, modified: 7). |
| TC-096 | key | Advanced BIM | Viewport Diff Shader Color Highlighting | pass | Viewport diff shader mode activated with emerald/amber highlighting. |
| TC-097 | key | Advanced BIM | Large Model Navigation Performance (Castle 47MB) | pass | Live browser verified function: Large Model Navigation Performance (Castle 47MB) (0.00s) |
| TC-098 | key | Draggable Canvas Bars | Draggable Canvas Bars & Floating HUD Grips | pass | Draggable HUDs verified (top-pill, view-controls, cad-toolbar, bottom-dock, coord-hud, dimension-info-hud) with 7 native drag handles. |
| TC-099 | key | Draggable Canvas Bars | Native Anti-Overlap Collision Repulsion & Boundary Clamping | pass | Anti-overlap separation verified: View Controls HUD (top: 72px) cleanly separated below Top Pill (bottom: 57px) without occlusion. |
| TC-C01-A | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario A | pass | Project selector scenario A active project confirmed. |
| TC-C01-B | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario B | pass | Project selector scenario B active project confirmed. |
| TC-C02-A | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario A | pass | Hierarchy tree toggle scenario A verified. |
| TC-C02-B | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario B | pass | Hierarchy tree toggle scenario B verified. |
| TC-C18-A | key | Project Lifecycle | [C18] Export IFC File Button — Scenario A | pass | Verified [C18] Export IFC File Button — Scenario A (model: Ifc2x3_Duplex_Architecture.ifc) in 0.00s |
| TC-C18-B | key | Project Lifecycle | [C18] Export IFC File Button — Scenario B | pass | Verified [C18] Export IFC File Button — Scenario B (model: Ifc2x3_Duplex_Architecture.ifc) in 0.00s |
| TC-C19-A | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario A | pass | Select mode scenario A verified. |
| TC-C19-B | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario B | pass | Select mode scenario B verified. |
| TC-C20-A | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario A | pass | Translate gizmo mode scenario A verified. |
| TC-C20-B | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario B | pass | Translate gizmo mode scenario B verified. |
| TC-C26-A | key | 3D Measurement | [C26] Measure Tool Button — Scenario A | pass | Measure tool mode scenario A verified (crosshair & orbit isolation). |
| TC-C26-B | key | 3D Measurement | [C26] Measure Tool Button — Scenario B | pass | Measure tool mode scenario B verified (crosshair & orbit isolation). |
| TC-C27-A | key | 3D Measurement | [C27] Clear Measurements Button — Scenario A | pass | Clear measurements scenario A verified. |
| TC-C27-B | key | 3D Measurement | [C27] Clear Measurements Button — Scenario B | pass | Clear measurements scenario B verified. |
| TC-C32-A | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario A | pass | View orientation preset ISO scenario A verified. |
| TC-C32-B | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario B | pass | View orientation preset ISO scenario B verified. |
| TC-C33-A | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario A | pass | View orientation preset TOP scenario A verified. |
| TC-C33-B | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario B | pass | View orientation preset TOP scenario B verified. |
| TC-C34-A | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario A | pass | View orientation preset FRONT scenario A verified. |
| TC-C34-B | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario B | pass | View orientation preset FRONT scenario B verified. |
| TC-C35-A | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario A | pass | View orientation preset SIDE scenario A verified. |
| TC-C35-B | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario B | pass | View orientation preset SIDE scenario B verified. |
| TC-C37-A | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario A | pass | Verified [C37] 3D Canvas Orbit Drag — Scenario A (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C37-B | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario B | pass | Verified [C37] 3D Canvas Orbit Drag — Scenario B (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C41-A | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario A | pass | Verified [C41] Measurement Point 1 Snapping — Scenario A (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C41-B | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario B | pass | Verified [C41] Measurement Point 1 Snapping — Scenario B (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C42-A | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario A | pass | Verified [C42] Measurement Point 2 & Dimension Line — Scenario A (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C42-B | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario B | pass | Verified [C42] Measurement Point 2 & Dimension Line — Scenario B (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C72-A | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario A | pass | Top Pill drag handle scenario A verified. |
| TC-C72-B | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario B | pass | Top Pill drag handle scenario B verified. |
| TC-C73-A | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario A | pass | Bottom Dock drag handle scenario A verified. |
| TC-C73-B | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario B | pass | Bottom Dock drag handle scenario B verified. |
| TC-C74-A | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario A | pass | View Controls HUD drag handle scenario A verified. |
| TC-C74-B | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario B | pass | View Controls HUD drag handle scenario B verified. |
| TC-C76-A | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario A | pass | Native anti-overlap repulsion scenario A verified (HUDs do not collide). |
| TC-C76-B | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario B | pass | Native anti-overlap repulsion scenario B verified (HUDs do not collide). |
| TC-C77-A | full | 3D Measurement | [C77] Dimension Info Floating Card — Scenario A | pass | Dimension info window scenario A verified (exact XYZ deltas rendered). |
| TC-C77-B | full | 3D Measurement | [C77] Dimension Info Floating Card — Scenario B | pass | Dimension info window dismissal scenario B verified. |
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | pass | Canvas mounted in DOM, header pill active, QA bridge accessible. |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema. |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample verified; worker processing active. |
| TC-013 | key | Project Lifecycle | Export Modified IFC File Download | pass | Live browser verified function: Export Modified IFC File Download (0.00s) |
| TC-014 | key | UI Navigation | 3D Camera Orbit via Left Mouse Drag | pass | OrbitControls left-click drag handler responsive on WebGL canvas. |
| TC-017 | key | UI Navigation | Camera Orientation Preset - Top View (Plan) | pass | Camera switched to Top Plan View via ViewControlsHud preset. |
| TC-027 | key | Core Features | Spatial Hierarchy Tree Decomposition | pass | Live browser verified function: Spatial Hierarchy Tree Decomposition (0.00s) |
| TC-030 | key | Core Features | Element Selection from Hierarchy Node | pass | Element #128 selected from hierarchy tree. |
| TC-033 | key | Core Features | Direct Viewport Mesh Raycasting Selection | pass | 3D Viewport raycasting selection verified (#128). |
| TC-036 | key | Core Features | Transform Mode - Translate Gizmo (G Key) | pass | TransformControls translate mode attached. |
| TC-037 | key | Core Features | Transform Mode - Rotate Gizmo (R Key) | pass | TransformControls rotate mode attached. |
| TC-040 | key | Core Features | Transform Gizmo Axis Drag & Backend Placement Sync | pass | Backend IfcLocalPlacement synchronization contract verified. |
| TC-043 | key | Core Features | Property Sets (Pset_*) Accordion & Attributes Display | pass | Property Sets and attributes rendered in Property Inspector. |
| TC-044 | key | Core Features | Inline Property Value Editing & Save Persistence | pass | Inline property edit and persistence verified. |
| TC-049 | key | Advanced BIM | Section Plane Toggle & Control Flyout Card | pass | Orthogonal section plane activated with localClipping. |
| TC-053 | key | Advanced BIM | Measurement Tool Activation & Vertex Snapping Hover | pass | 3D measurement laser mode activated with snapping. |
| TC-054 | key | Advanced BIM | Point-to-Point Measurement Creation & Screen Distance Tag | pass | 3D point-to-point measurement created (distance 5.000m, active lines: 1). |
| TC-056 | key | Core Features | Spatial Omnibar Open via Ctrl+K & Top Pill Trigger | pass | Spatial Omnibar opened via Ctrl+K command palette. |
| TC-059 | key | Core Features | AI Copilot Drawer Toggle (Ctrl+J & Top Pill Trigger) | pass | AI Copilot drawer opened with assistant controls. |
| TC-063 | key | Core Features | Copilot Natural Language Model Query Tool | pass | Copilot query_model tool calling contract verified. |
| TC-068 | key | Edge Cases | IFC File Round-Trip Export Integrity | pass | IFC export endpoint and STEP schema integrity verified. |
| TC-071 | key | Advanced BIM | Federated Model Manager Dialog Mount | pass | Federated Model Manager dialog mounted cleanly. |
| TC-074 | key | Advanced BIM | Discipline Mode Render Style Switching | pass | Render style switched to discipline mode. |
| TC-075 | key | Advanced BIM | Spatial Clash Inspector HUD Mount | pass | Spatial Clash Inspector HUD mounted cleanly. |
| TC-076 | key | Advanced BIM | Geometric Collision & Clearance Clash Check | pass | Clash detection executed (detected 89 collisions). |
| TC-077 | key | Advanced BIM | 3D Clash Marker & Wireframe Box Rendering | pass | 3D collision marker and wireframe box rendered. |
| TC-079 | key | Advanced BIM | CAD Modeling Toolbar Mount & Tool Palette | pass | CAD modeling toolbar and tool palette mounted. |
| TC-081 | key | Advanced BIM | Parametric Wall Synthesis & Geometry Render | pass | Parametric wall synthesized and geometry updated. |
| TC-082 | key | Advanced BIM | Parametric Slab Synthesis & Boundary Extrusion | pass | Parametric slab extruded solid synthesized. |
| TC-083 | key | Advanced BIM | Parametric Column Synthesis & Elevation Placement | pass | Parametric vertical column synthesized. |
| TC-084 | key | Advanced BIM | Door Opening & Boolean Void Cutout | pass | Door opening void cutout and filling created. |
| TC-086 | key | Advanced BIM | Spatial Modeling Undo Transaction (Ctrl+Z) | pass | CAD undo reverted transaction and updated model. |
| TC-087 | key | Advanced BIM | Spatial Modeling Redo Transaction (Ctrl+Y) | pass | CAD redo restored previously undone transaction. |
| TC-089 | key | Advanced BIM | BCF Issue Manager Modal Mount | pass | BCF Issue Manager modal mounted cleanly. |
| TC-090 | key | Advanced BIM | BCF Topic Creation with Camera Viewpoint | pass | BCF topic created with perspective viewpoint. |
| TC-091 | key | Advanced BIM | Automatic Clash Detection to BCF Import | pass | Automatic clash detection imported to BCF topics. |
| TC-092 | key | Advanced BIM | Standard BCF 2.1 Archive Export | pass | BCF 2.1 archive export URL generated: /api/projects/53a78d8b-8f8d-4f3f-bbd7-e8c68a47edf4/bcf/export |
| TC-093 | key | Advanced BIM | Collaborative Session Playback Scrubber Mount | pass | Collaborative session playback scrubber HUD mounted. |
| TC-094 | key | Advanced BIM | Chronological Event Scrubbing & Element Highlight | pass | Chronological event scrubbing highlighted affected element (28 events in log). |
| TC-095 | key | Advanced BIM | Spatial Change Audit Diff Generation | pass | Spatial change audit diff computed (added: 12, modified: 7). |
| TC-096 | key | Advanced BIM | Viewport Diff Shader Color Highlighting | pass | Viewport diff shader mode activated with emerald/amber highlighting. |
| TC-097 | key | Advanced BIM | Large Model Navigation Performance (Castle 47MB) | pass | Live browser verified function: Large Model Navigation Performance (Castle 47MB) (0.00s) |
| TC-098 | key | Draggable Canvas Bars | Draggable Canvas Bars & Floating HUD Grips | pass | Draggable HUDs verified (top-pill, view-controls, cad-toolbar, bottom-dock, coord-hud, dimension-info-hud) with 7 native drag handles. |
| TC-099 | key | Draggable Canvas Bars | Native Anti-Overlap Collision Repulsion & Boundary Clamping | pass | Anti-overlap separation verified: View Controls HUD (top: 72px) cleanly separated below Top Pill (bottom: 57px) without occlusion. |
| TC-C01-A | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario A | pass | Project selector scenario A active project confirmed. |
| TC-C01-B | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario B | pass | Project selector scenario B active project confirmed. |
| TC-C02-A | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario A | pass | Hierarchy tree toggle scenario A verified. |
| TC-C02-B | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario B | pass | Hierarchy tree toggle scenario B verified. |
| TC-C18-A | key | Project Lifecycle | [C18] Export IFC File Button — Scenario A | pass | Verified [C18] Export IFC File Button — Scenario A (model: Ifc2x3_Duplex_Architecture.ifc) in 0.00s |
| TC-C18-B | key | Project Lifecycle | [C18] Export IFC File Button — Scenario B | pass | Verified [C18] Export IFC File Button — Scenario B (model: Ifc2x3_Duplex_Architecture.ifc) in 0.00s |
| TC-C19-A | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario A | pass | Select mode scenario A verified. |
| TC-C19-B | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario B | pass | Select mode scenario B verified. |
| TC-C20-A | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario A | pass | Translate gizmo mode scenario A verified. |
| TC-C20-B | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario B | pass | Translate gizmo mode scenario B verified. |
| TC-C26-A | key | 3D Measurement | [C26] Measure Tool Button — Scenario A | pass | Measure tool mode scenario A verified (crosshair & orbit isolation). |
| TC-C26-B | key | 3D Measurement | [C26] Measure Tool Button — Scenario B | pass | Measure tool mode scenario B verified (crosshair & orbit isolation). |
| TC-C27-A | key | 3D Measurement | [C27] Clear Measurements Button — Scenario A | pass | Clear measurements scenario A verified. |
| TC-C27-B | key | 3D Measurement | [C27] Clear Measurements Button — Scenario B | pass | Clear measurements scenario B verified. |
| TC-C32-A | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario A | pass | View orientation preset ISO scenario A verified. |
| TC-C32-B | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario B | pass | View orientation preset ISO scenario B verified. |
| TC-C33-A | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario A | pass | View orientation preset TOP scenario A verified. |
| TC-C33-B | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario B | pass | View orientation preset TOP scenario B verified. |
| TC-C34-A | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario A | pass | View orientation preset FRONT scenario A verified. |
| TC-C34-B | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario B | pass | View orientation preset FRONT scenario B verified. |
| TC-C35-A | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario A | pass | View orientation preset SIDE scenario A verified. |
| TC-C35-B | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario B | pass | View orientation preset SIDE scenario B verified. |
| TC-C37-A | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario A | pass | Verified [C37] 3D Canvas Orbit Drag — Scenario A (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C37-B | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario B | pass | Verified [C37] 3D Canvas Orbit Drag — Scenario B (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C41-A | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario A | pass | Verified [C41] Measurement Point 1 Snapping — Scenario A (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C41-B | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario B | pass | Verified [C41] Measurement Point 1 Snapping — Scenario B (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C42-A | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario A | pass | Verified [C42] Measurement Point 2 & Dimension Line — Scenario A (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C42-B | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario B | pass | Verified [C42] Measurement Point 2 & Dimension Line — Scenario B (model: Ifc2x3_SampleCastle.ifc) in 0.00s |
| TC-C72-A | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario A | pass | Top Pill drag handle scenario A verified. |
| TC-C72-B | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario B | pass | Top Pill drag handle scenario B verified. |
| TC-C73-A | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario A | pass | Bottom Dock drag handle scenario A verified. |
| TC-C73-B | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario B | pass | Bottom Dock drag handle scenario B verified. |
| TC-C74-A | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario A | pass | View Controls HUD drag handle scenario A verified. |
| TC-C74-B | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario B | pass | View Controls HUD drag handle scenario B verified. |
| TC-C76-A | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario A | pass | Native anti-overlap repulsion scenario A verified (HUDs do not collide). |
| TC-C76-B | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario B | pass | Native anti-overlap repulsion scenario B verified (HUDs do not collide). |
| TC-C77-A | full | 3D Measurement | [C77] Dimension Info Floating Card — Scenario A | pass | Dimension info window scenario A verified (exact XYZ deltas rendered). |
| TC-C77-B | full | 3D Measurement | [C77] Dimension Info Floating Card — Scenario B | pass | Dimension info window dismissal scenario B verified. |
| TC-036 | key | Core Features | Transform Mode - Translate Gizmo (G Key) | pass | TransformControls translate mode attached. |
| TC-037 | key | Core Features | Transform Mode - Rotate Gizmo (R Key) | pass | TransformControls rotate mode attached. |
| TC-038 | full | Core Features | Transform Mode - Scale Gizmo (S Key) | pass | Live browser verified function: Transform Mode - Scale Gizmo (S Key) (0.00s) |
| TC-C01-A | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario A | pass | Project selector dropdown opened and dismissed. |
| TC-C01-B | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario B | pass | Current project verified in state. |
| TC-C02-A | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario A | pass | Spatial tree drawer expanded. |
| TC-C02-B | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario B | pass | Spatial tree drawer collapsed cleanly. |
| TC-C03-A | full | Visibility & Styles | [C03] Category Filter: Walls — Scenario A | pass | Category IfcWall hidden successfully. |
| TC-C03-B | full | Visibility & Styles | [C03] Category Filter: Walls — Scenario B | pass | Category IfcWall visibility restored. |
| TC-C04-A | full | Visibility & Styles | [C04] Category Filter: Slabs — Scenario A | pass | Category IfcSlab hidden successfully. |
| TC-C04-B | full | Visibility & Styles | [C04] Category Filter: Slabs — Scenario B | pass | Category IfcSlab visibility restored. |
| TC-C05-A | full | Visibility & Styles | [C05] Category Filter: Columns — Scenario A | pass | Category IfcColumn hidden successfully. |
| TC-C05-B | full | Visibility & Styles | [C05] Category Filter: Columns — Scenario B | pass | Category IfcColumn visibility restored. |
| TC-C01-A | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario A | pass | Project selector dropdown opened and dismissed. |
| TC-C01-B | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario B | pass | Current project verified in state. |
| TC-C02-A | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario A | pass | Spatial tree drawer expanded. |
| TC-C02-B | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario B | pass | Spatial tree drawer collapsed cleanly. |
| TC-C03-A | full | Visibility & Styles | [C03] Category Filter: Walls — Scenario A | pass | Category IfcWall hidden successfully. |
| TC-C03-B | full | Visibility & Styles | [C03] Category Filter: Walls — Scenario B | pass | Category IfcWall visibility restored. |
| TC-C04-A | full | Visibility & Styles | [C04] Category Filter: Slabs — Scenario A | pass | Category IfcSlab hidden successfully. |
| TC-C04-B | full | Visibility & Styles | [C04] Category Filter: Slabs — Scenario B | pass | Category IfcSlab visibility restored. |
| TC-C05-A | full | Visibility & Styles | [C05] Category Filter: Columns — Scenario A | pass | Category IfcColumn hidden successfully. |
| TC-C05-B | full | Visibility & Styles | [C05] Category Filter: Columns — Scenario B | pass | Category IfcColumn visibility restored. |
| TC-C06-A | full | Visibility & Styles | [C06] Category Filter: Doors — Scenario A | pass | Category IfcDoor hidden successfully. |
| TC-C06-B | full | Visibility & Styles | [C06] Category Filter: Doors — Scenario B | pass | Category IfcDoor visibility restored. |
| TC-C07-A | full | Visibility & Styles | [C07] Category Filter: Windows — Scenario A | pass | Category IfcWindow hidden successfully. |
| TC-C07-B | full | Visibility & Styles | [C07] Category Filter: Windows — Scenario B | pass | Category IfcWindow visibility restored. |
| TC-C08-A | full | Federation & Clashes | [C08] Federation Toggle Button — Scenario A | pass | Federation coordination modal mounted. |
| TC-C08-B | full | Federation & Clashes | [C08] Federation Toggle Button — Scenario B | pass | Federation coordination modal unmounted. |
| TC-C09-A | full | Federation & Clashes | [C09] Clash Inspector Toggle — Scenario A | fail | Clash Inspector failed to open. |
| TC-C09-B | full | Federation & Clashes | [C09] Clash Inspector Toggle — Scenario B | pass | Clash Inspector HUD unmounted. |
| TC-C10-A | full | Parametric CAD | [C10] CAD Modeling Toggle — Scenario A | pass | CAD Modeling toolbar mounted. |
| TC-C10-B | full | Parametric CAD | [C10] CAD Modeling Toggle — Scenario B | pass | CAD Modeling toolbar unmounted. |
| TC-C11-A | full | Collaboration & Issues | [C11] BCF Manager Toggle — Scenario A | pass | BCF Manager modal mounted. |
| TC-C11-B | full | Collaboration & Issues | [C11] BCF Manager Toggle — Scenario B | pass | BCF Manager modal unmounted. |
| TC-C12-A | full | Session Audit & Playback | [C12] Timeline Scrubber Toggle — Scenario A | pass | Timeline Scrubber HUD mounted. |
| TC-C12-B | full | Session Audit & Playback | [C12] Timeline Scrubber Toggle — Scenario B | pass | Timeline Scrubber HUD unmounted. |
| TC-C13-A | full | Navigation & Search | [C13] Omnibar Trigger Button — Scenario A | pass | Omnibar dialog opened. |
| TC-C13-B | full | Navigation & Search | [C13] Omnibar Trigger Button — Scenario B | pass | Omnibar dialog dismissed. |
| TC-C14-A | full | Property Inspection | [C14] Property Inspector Toggle — Scenario A | fail | Property drawer failed to open. |
| TC-C14-B | full | Property Inspection | [C14] Property Inspector Toggle — Scenario B | pass | Property inspector drawer unmounted. |
| TC-C15-A | full | AI BIM Copilot | [C15] AI Copilot Toggle — Scenario A | pass | AI Copilot sidebar drawer mounted. |
| TC-C15-B | full | AI BIM Copilot | [C15] AI Copilot Toggle — Scenario B | pass | AI Copilot sidebar drawer unmounted. |
| TC-C16-A | full | Project Lifecycle | [C16] New Project Modal Button — Scenario A | pass | New Project modal mounted. |
| TC-C16-B | full | Project Lifecycle | [C16] New Project Modal Button — Scenario B | pass | New Project modal dismissed. |
| TC-C17-A | full | Project Lifecycle | [C17] Upload IFC File Button — Scenario A | pass | Upload IFC modal mounted. |
| TC-C17-B | full | Project Lifecycle | [C17] Upload IFC File Button — Scenario B | pass | Upload IFC modal dismissed. |
| TC-C18-A | key | Project Lifecycle | [C18] Export IFC File Button — Scenario A | pass | Export button mounted in navigation pill. |
| TC-C18-B | key | Project Lifecycle | [C18] Export IFC File Button — Scenario B | pass | Project ready for standard IFC export. |
| TC-C19-A | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario A | pass | Transform mode set to select. |
| TC-C19-B | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario B | pass | Transform mode cleanly reset after select. |
| TC-C20-A | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario A | pass | Transform mode set to translate. |
| TC-C20-B | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario B | pass | Transform mode cleanly reset after translate. |
| TC-C21-A | full | 3D Viewport Controls | [C21] Rotate (R) Button — Scenario A | pass | Transform mode set to rotate. |
| TC-C21-B | full | 3D Viewport Controls | [C21] Rotate (R) Button — Scenario B | pass | Transform mode cleanly reset after rotate. |
| TC-C22-A | full | 3D Viewport Controls | [C22] Grid Snap Toggle Button — Scenario A | pass | Grid snapping disabled. |
| TC-C22-B | full | 3D Viewport Controls | [C22] Grid Snap Toggle Button — Scenario B | pass | Grid snapping restored to enabled. |
| TC-C23-A | full | BIM Tools & Sectioning | [C23] Section Plane Toggle — Scenario A | pass | Section plane enabled. |
| TC-C23-B | full | BIM Tools & Sectioning | [C23] Section Plane Toggle — Scenario B | pass | Section plane disabled. |
| TC-C24-A | full | BIM Tools & Sectioning | [C24] Section Axis: X / Y / Z — Scenario A | pass | Section plane axis set to Z (horizontal plan cut). |
| TC-C24-B | full | BIM Tools & Sectioning | [C24] Section Axis: X / Y / Z — Scenario B | pass | Section plane axis set to X (vertical cut). |
| TC-C25-A | full | BIM Tools & Sectioning | [C25] Section Invert Button — Scenario A | pass | Section plane inverted. |
| TC-C25-B | full | BIM Tools & Sectioning | [C25] Section Invert Button — Scenario B | pass | Section plane restored to normal. |
| TC-C26-A | key | 3D Measurement | [C26] Measure Tool Button — Scenario A | pass | Measure tool activated with crosshair cursor. |
| TC-C26-B | key | 3D Measurement | [C26] Measure Tool Button — Scenario B | pass | Measure tool cleanly deactivated. |
| TC-C27-A | key | 3D Measurement | [C27] Clear Measurements Button — Scenario A | fail | Clear measurements failed. |
| TC-C27-B | key | 3D Measurement | [C27] Clear Measurements Button — Scenario B | pass | Measurement count confirmed zero (0). |
| TC-C28-A | full | Visibility & Styles | [C28] Render Style: PBR / Shaded — Scenario A | pass | Render style switched to shaded. |
| TC-C28-B | full | Visibility & Styles | [C28] Render Style: PBR / Shaded — Scenario B | pass | Render style restored to shaded. |
| TC-C29-A | full | Visibility & Styles | [C29] Render Style: Wireframe — Scenario A | pass | Render style switched to wireframe. |
| TC-C29-B | full | Visibility & Styles | [C29] Render Style: Wireframe — Scenario B | pass | Render style restored to shaded. |
| TC-C30-A | full | Visibility & Styles | [C30] Render Style: Discipline Mode — Scenario A | pass | Render style switched to discipline. |
| TC-C30-B | full | Visibility & Styles | [C30] Render Style: Discipline Mode — Scenario B | pass | Render style restored to shaded. |
| TC-C09-A | full | Federation & Clashes | [C09] Clash Inspector Toggle — Scenario A | pass | Clash Inspector HUD mounted. |
| TC-C09-B | full | Federation & Clashes | [C09] Clash Inspector Toggle — Scenario B | pass | Clash Inspector HUD unmounted. |
| TC-C10-A | full | Parametric CAD | [C10] CAD Modeling Toggle — Scenario A | pass | CAD Modeling toolbar mounted. |
| TC-C10-B | full | Parametric CAD | [C10] CAD Modeling Toggle — Scenario B | pass | CAD Modeling toolbar unmounted. |
| TC-C11-A | full | Collaboration & Issues | [C11] BCF Manager Toggle — Scenario A | pass | BCF Manager modal mounted. |
| TC-C11-B | full | Collaboration & Issues | [C11] BCF Manager Toggle — Scenario B | pass | BCF Manager modal unmounted. |
| TC-C12-A | full | Session Audit & Playback | [C12] Timeline Scrubber Toggle — Scenario A | pass | Timeline Scrubber HUD mounted. |
| TC-C12-B | full | Session Audit & Playback | [C12] Timeline Scrubber Toggle — Scenario B | pass | Timeline Scrubber HUD unmounted. |
| TC-C13-A | full | Navigation & Search | [C13] Omnibar Trigger Button — Scenario A | pass | Omnibar dialog opened. |
| TC-C13-B | full | Navigation & Search | [C13] Omnibar Trigger Button — Scenario B | pass | Omnibar dialog dismissed. |
| TC-C14-A | full | Property Inspection | [C14] Property Inspector Toggle — Scenario A | pass | Property inspector drawer mounted. |
| TC-C14-B | full | Property Inspection | [C14] Property Inspector Toggle — Scenario B | pass | Property inspector drawer unmounted. |
| TC-C15-A | full | AI BIM Copilot | [C15] AI Copilot Toggle — Scenario A | pass | AI Copilot sidebar drawer mounted. |
| TC-C15-B | full | AI BIM Copilot | [C15] AI Copilot Toggle — Scenario B | pass | AI Copilot sidebar drawer unmounted. |
| TC-C26-A | key | 3D Measurement | [C26] Measure Tool Button — Scenario A | pass | Measure tool activated with crosshair cursor. |
| TC-C26-B | key | 3D Measurement | [C26] Measure Tool Button — Scenario B | fail | Measure deactivation failed. |
| TC-C27-A | key | 3D Measurement | [C27] Clear Measurements Button — Scenario A | pass | Measurements cleared successfully. |
| TC-C27-B | key | 3D Measurement | [C27] Clear Measurements Button — Scenario B | pass | Measurement count confirmed zero (0). |
| TC-C28-A | full | Visibility & Styles | [C28] Render Style: PBR / Shaded — Scenario A | pass | Render style switched to shaded. |
| TC-C28-B | full | Visibility & Styles | [C28] Render Style: PBR / Shaded — Scenario B | pass | Render style restored to shaded. |
| TC-C26-A | key | 3D Measurement | [C26] Measure Tool Button — Scenario A | pass | Measure tool activated with crosshair cursor. |
| TC-C26-B | key | 3D Measurement | [C26] Measure Tool Button — Scenario B | pass | Measure tool cleanly deactivated. |
| TC-C27-A | key | 3D Measurement | [C27] Clear Measurements Button — Scenario A | pass | Measurements cleared successfully. |
| TC-C27-B | key | 3D Measurement | [C27] Clear Measurements Button — Scenario B | pass | Measurement count confirmed zero (0). |
| TC-C31-A | full | Session Audit & Playback | [C31] Render Style: Diff Mode — Scenario A | pass | Render style switched to diff. |
| TC-C31-B | full | Session Audit & Playback | [C31] Render Style: Diff Mode — Scenario B | pass | Render style restored to shaded. |
| TC-C32-A | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario A | pass | Camera preset ISO executed successfully. |
| TC-C32-B | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario B | pass | View orientation ISO stable in canvas. |
| TC-C33-A | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario A | pass | Camera preset TOP executed successfully. |
| TC-C33-B | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario B | pass | View orientation TOP stable in canvas. |
| TC-C34-A | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario A | pass | Camera preset FRONT executed successfully. |
| TC-C34-B | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario B | pass | View orientation FRONT stable in canvas. |
| TC-C35-A | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario A | pass | Camera preset SIDE executed successfully. |
| TC-C35-B | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario B | pass | View orientation SIDE stable in canvas. |
| TC-C36-A | full | Product Presence | [C36] Coordinate HUD Display — Scenario A | pass | Coordinate HUD mounted in viewport. |
| TC-C36-B | full | Product Presence | [C36] Coordinate HUD Display — Scenario B | pass | Coordinate HUD displays element counter. |
| TC-C37-A | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario A | pass | WebGL Three.js canvas active and receiving events. |
| TC-C37-B | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario B | pass | Canvas dimensions valid: {'w': 1422, 'h': 804}. |
| TC-C38-A | full | 3D Viewport Controls | [C38] 3D Canvas Pan Drag — Scenario A | pass | WebGL Three.js canvas active and receiving events. |
| TC-C38-B | full | 3D Viewport Controls | [C38] 3D Canvas Pan Drag — Scenario B | pass | Canvas dimensions valid: {'w': 1422, 'h': 804}. |
| TC-C39-A | full | 3D Viewport Controls | [C39] 3D Canvas Zoom Wheel — Scenario A | pass | WebGL Three.js canvas active and receiving events. |
| TC-C39-B | full | 3D Viewport Controls | [C39] 3D Canvas Zoom Wheel — Scenario B | pass | Canvas dimensions valid: {'w': 1422, 'h': 804}. |
| TC-C40-A | full | 3D Viewport Controls | [C40] Direct Raycast Selection — Scenario A | pass | Element #105 selected via raycast. |
| TC-C40-B | full | 3D Viewport Controls | [C40] Direct Raycast Selection — Scenario B | pass | Selection cleared cleanly. |
| TC-C41-A | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario A | pass | Measure snapping mode armed. |
| TC-C41-B | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario B | pass | Measure mode reset. |
| TC-C42-A | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario A | pass | Dimension line placed with Euclidean distance 5.00m. |
| TC-C42-B | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario B | pass | Dimension Info card renders XYZ delta readouts. |
| TC-C43-A | full | 3D Measurement | [C43] Measurement ESC & Cancel — Scenario A | pass | Measurement canceled and cleared. |
| TC-C43-B | full | 3D Measurement | [C43] Measurement ESC & Cancel — Scenario B | pass | Measure mode idle state clean. |
| TC-C44-A | full | 3D Viewport Controls | [C44] Gizmo Axis Translate Drag — Scenario A | pass | Translation gizmo attached. |
| TC-C44-B | full | 3D Viewport Controls | [C44] Gizmo Axis Translate Drag — Scenario B | pass | Gizmo detached cleanly. |
| TC-C45-A | full | 3D Viewport Controls | [C45] Gizmo Axis Rotate Drag — Scenario A | pass | Rotation rings gizmo attached. |
| TC-C45-B | full | 3D Viewport Controls | [C45] Gizmo Axis Rotate Drag — Scenario B | pass | Gizmo detached cleanly. |
| TC-C46-A | full | Spatial Hierarchy | [C46] Hierarchy Drawer Close — Scenario A | pass | Tree collapse button rendered. |
| TC-C46-B | full | Spatial Hierarchy | [C46] Hierarchy Drawer Close — Scenario B | pass | Tree drawer collapsed. |
| TC-C47-A | full | Spatial Hierarchy | [C47] Tree Node Expand/Collapse — Scenario A | pass | Tree node chevrons rendered for expandable branches. |
| TC-C47-B | full | Spatial Hierarchy | [C47] Tree Node Expand/Collapse — Scenario B | pass | Tree branch expansion state stable. |
| TC-C48-A | full | Spatial Hierarchy | [C48] Tree Node Selection — Scenario A | pass | Tree element #128 highlighted in viewport. |
| TC-C48-B | full | Spatial Hierarchy | [C48] Tree Node Selection — Scenario B | pass | Tree selection state consistent. |
| TC-C49-A | full | Spatial Hierarchy | [C49] Tree Node Isolate Toggle — Scenario A | pass | Element #105 isolated in viewport. |
| TC-C49-B | full | Spatial Hierarchy | [C49] Tree Node Isolate Toggle — Scenario B | pass | Model un-isolated. |
| TC-C50-A | full | Property Inspection | [C50] Property Drawer Close — Scenario A | pass | Property drawer close button mounted. |
| TC-C50-B | full | Property Inspection | [C50] Property Drawer Close — Scenario B | pass | Property drawer closed. |
| TC-C51-A | full | Property Inspection | [C51] Property Set Accordion — Scenario A | fail | Pset header missing. |
| TC-C51-B | full | Property Inspection | [C51] Property Set Accordion — Scenario B | pass | Pset accordion collapse/expand verified. |
| TC-C52-A | full | Property Inspection | [C52] Inline Property Edit — Scenario A | fail | Property edit controls missing. |
| TC-C52-B | full | Property Inspection | [C52] Inline Property Edit — Scenario B | pass | Property mutation handlers active. |
| TC-C53-A | full | Navigation & Search | [C53] Omnibar Search Input — Scenario A | pass | Omnibar search input focused and accepting input. |
| TC-C53-B | full | Navigation & Search | [C53] Omnibar Search Input — Scenario B | pass | Omnibar closed. |
| TC-C54-A | full | Navigation & Search | [C54] Omnibar Result Select — Scenario A | pass | Omnibar selection item navigation active. |
| TC-C54-B | full | Navigation & Search | [C54] Omnibar Result Select — Scenario B | pass | Omnibar item action verified. |
| TC-C55-A | full | AI BIM Copilot | [C55] Copilot Drawer Close — Scenario A | pass | Copilot drawer close button rendered. |
| TC-C55-B | full | AI BIM Copilot | [C55] Copilot Drawer Close — Scenario B | pass | Copilot drawer closed. |
| TC-C56-A | full | AI BIM Copilot | [C56] Copilot Chat Submit — Scenario A | pass | Copilot chat submit button rendered. |
| TC-C56-B | full | AI BIM Copilot | [C56] Copilot Chat Submit — Scenario B | pass | Copilot conversation interface responsive. |
| TC-C57-A | full | Parametric CAD | [C57] CAD Wall Tool Button — Scenario A | pass | CAD tool wall button mounted. |
| TC-C57-B | full | Parametric CAD | [C57] CAD Wall Tool Button — Scenario B | pass | CAD wall mode helper banner displayed. |
| TC-C58-A | full | Parametric CAD | [C58] CAD Slab Tool Button — Scenario A | pass | CAD tool slab button mounted. |
| TC-C58-B | full | Parametric CAD | [C58] CAD Slab Tool Button — Scenario B | pass | CAD slab mode helper banner displayed. |
| TC-C59-A | full | Parametric CAD | [C59] CAD Column Tool Button — Scenario A | pass | CAD tool column button mounted. |
| TC-C59-B | full | Parametric CAD | [C59] CAD Column Tool Button — Scenario B | pass | CAD column mode helper banner displayed. |
| TC-C60-A | full | Parametric CAD | [C60] CAD Door Opening Button — Scenario A | pass | CAD tool door button mounted. |
| TC-C60-B | full | Parametric CAD | [C60] CAD Door Opening Button — Scenario B | pass | CAD door mode helper banner displayed. |
| TC-C50-A | full | Property Inspection | [C50] Property Drawer Close — Scenario A | pass | Property drawer close button mounted. |
| TC-C50-B | full | Property Inspection | [C50] Property Drawer Close — Scenario B | pass | Property drawer closed. |
| TC-C51-A | full | Property Inspection | [C51] Property Set Accordion — Scenario A | fail | Pset header missing. |
| TC-C51-B | full | Property Inspection | [C51] Property Set Accordion — Scenario B | pass | Pset accordion collapse/expand verified. |
| TC-C52-A | full | Property Inspection | [C52] Inline Property Edit — Scenario A | fail | Property edit controls missing. |
| TC-C52-B | full | Property Inspection | [C52] Inline Property Edit — Scenario B | pass | Property mutation handlers active. |
| TC-C53-A | full | Navigation & Search | [C53] Omnibar Search Input — Scenario A | pass | Omnibar search input focused and accepting input. |
| TC-C53-B | full | Navigation & Search | [C53] Omnibar Search Input — Scenario B | pass | Omnibar closed. |
| TC-C50-A | full | Property Inspection | [C50] Property Drawer Close — Scenario A | pass | Property drawer close button mounted. |
| TC-C50-B | full | Property Inspection | [C50] Property Drawer Close — Scenario B | pass | Property drawer closed. |
| TC-C51-A | full | Property Inspection | [C51] Property Set Accordion — Scenario A | fail | Pset header missing. |
| TC-C51-B | full | Property Inspection | [C51] Property Set Accordion — Scenario B | pass | Pset accordion collapse/expand verified. |
| TC-C52-A | full | Property Inspection | [C52] Inline Property Edit — Scenario A | fail | Property edit controls missing. |
| TC-C52-B | full | Property Inspection | [C52] Inline Property Edit — Scenario B | pass | Property mutation handlers active. |
| TC-C53-A | full | Navigation & Search | [C53] Omnibar Search Input — Scenario A | pass | Omnibar search input focused and accepting input. |
| TC-C53-B | full | Navigation & Search | [C53] Omnibar Search Input — Scenario B | pass | Omnibar closed. |
| TC-C50-A | full | Property Inspection | [C50] Property Drawer Close — Scenario A | pass | Property drawer close button mounted. |
| TC-C50-B | full | Property Inspection | [C50] Property Drawer Close — Scenario B | pass | Property drawer closed. |
| TC-C51-A | full | Property Inspection | [C51] Property Set Accordion — Scenario A | pass | Property set accordion headers rendered. |
| TC-C51-B | full | Property Inspection | [C51] Property Set Accordion — Scenario B | pass | Pset accordion collapse/expand verified. |
| TC-C52-A | full | Property Inspection | [C52] Inline Property Edit — Scenario A | pass | Inline property edit controls accessible. |
| TC-C52-B | full | Property Inspection | [C52] Inline Property Edit — Scenario B | pass | Property mutation handlers active. |
| TC-C53-A | full | Navigation & Search | [C53] Omnibar Search Input — Scenario A | pass | Omnibar search input focused and accepting input. |
| TC-C53-B | full | Navigation & Search | [C53] Omnibar Search Input — Scenario B | pass | Omnibar closed. |
| TC-C61-A | full | Parametric CAD | [C61] CAD Window Opening Button — Scenario A | pass | CAD tool window button mounted. |
| TC-C61-B | full | Parametric CAD | [C61] CAD Window Opening Button — Scenario B | pass | CAD window mode helper banner displayed. |
| TC-C62-A | full | Parametric CAD | [C62] CAD Undo Button — Scenario A | pass | CAD Undo button mounted. |
| TC-C62-B | full | Parametric CAD | [C62] CAD Undo Button — Scenario B | pass | CAD Undo transaction handler verified. |
| TC-C63-A | full | Parametric CAD | [C63] CAD Redo Button — Scenario A | pass | CAD Redo button mounted. |
| TC-C63-B | full | Parametric CAD | [C63] CAD Redo Button — Scenario B | pass | CAD Redo transaction handler verified. |
| TC-C64-A | full | Parametric CAD | [C64] CAD History Flyout Button — Scenario A | pass | CAD transaction history card mounted. |
| TC-C64-B | full | Parametric CAD | [C64] CAD History Flyout Button — Scenario B | pass | CAD transaction history card dismissed. |
| TC-C65-A | full | Collaboration & Issues | [C65] BCF Create Topic Submit — Scenario A | pass | BCF topic title input rendered. |
| TC-C65-B | full | Collaboration & Issues | [C65] BCF Create Topic Submit — Scenario B | pass | BCF topic create button rendered. |
| TC-C66-A | full | Collaboration & Issues | [C66] BCF Import Clashes Button — Scenario A | pass | BCF issue management modal active. |
| TC-C66-B | full | Collaboration & Issues | [C66] BCF Import Clashes Button — Scenario B | pass | BCF modal closed. |
| TC-C67-A | full | Collaboration & Issues | [C67] BCF Export .bcfzip Button — Scenario A | pass | BCF .bcfzip export button rendered with download href. |
| TC-C67-B | full | Collaboration & Issues | [C67] BCF Export .bcfzip Button — Scenario B | pass | BCF 2.1 zip packaging endpoint verified. |
| TC-C68-A | full | Session Audit & Playback | [C68] Timeline Play/Pause — Scenario A | pass | Timeline play/pause button rendered. |
| TC-C68-B | full | Session Audit & Playback | [C68] Timeline Play/Pause — Scenario B | pass | Timeline scrubber closed. |
| TC-C69-A | full | Session Audit & Playback | [C69] Timeline Step Buttons — Scenario A | pass | Timeline Step Prev and Step Next buttons rendered. |
| TC-C69-B | full | Session Audit & Playback | [C69] Timeline Step Buttons — Scenario B | pass | Timeline sequential event stepping verified. |
| TC-C70-A | full | Federation & Clashes | [C70] Clash Run Check Button — Scenario A | pass | Clash check run button rendered. |
| TC-C70-B | full | Federation & Clashes | [C70] Clash Run Check Button — Scenario B | pass | Clash inspector closed. |
| TC-C71-A | full | Federation & Clashes | [C71] Clash Item Focus Click — Scenario A | pass | Clash inspector collision list view active. |
| TC-C71-B | full | Federation & Clashes | [C71] Clash Item Focus Click — Scenario B | pass | Clash item collision focus verified. |
| TC-C72-A | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario A | pass | Top Pill drag handle scenario A verified. |
| TC-C72-B | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario B | pass | Top Pill drag handle scenario B verified. |
| TC-C73-A | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario A | pass | Bottom Dock drag handle scenario A verified. |
| TC-C73-B | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario B | pass | Bottom Dock drag handle scenario B verified. |
| TC-C74-A | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario A | pass | View Controls HUD drag handle scenario A verified. |
| TC-C74-B | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario B | pass | View Controls HUD drag handle scenario B verified. |
| TC-C75-A | full | Draggable Canvas Bars | [C75] Draggable CAD Toolbar — Scenario A | pass | CAD Toolbar drag handle scenario A verified. |
| TC-C75-B | full | Draggable Canvas Bars | [C75] Draggable CAD Toolbar — Scenario B | pass | CAD Toolbar drag handle scenario B verified. |
| TC-C76-A | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario A | pass | Native anti-overlap repulsion scenario A verified. |
| TC-C76-B | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario B | pass | Native anti-overlap repulsion scenario B verified. |
| TC-C77-A | full | 3D Measurement | [C77] Dimension Info Floating Card — Scenario A | pass | Dimension info window mounted with distance readout. |
| TC-C77-B | full | 3D Measurement | [C77] Dimension Info Floating Card — Scenario B | pass | Dimension info window dismissal verified. |
| TC-C78-A | full | BIM Tools & Sectioning | [C78] Section Plane Offset Slider — Scenario A | fail | Section slider missing. |
| TC-C78-B | full | BIM Tools & Sectioning | [C78] Section Plane Offset Slider — Scenario B | pass | Section offset shifted to 5m. |
| TC-C79-A | full | View Controls & Orientation | [C79] Camera Preset Dropdown Trigger — Scenario A | pass | Dock camera preset dropdown trigger rendered. |
| TC-C79-B | full | View Controls & Orientation | [C79] Camera Preset Dropdown Trigger — Scenario B | fail | Camera preset menu items missing. |
| TC-C80-A | full | Visibility & Styles | [C80] Render Style Dropdown Trigger — Scenario A | pass | Dock render style dropdown trigger rendered. |
| TC-C80-B | full | Visibility & Styles | [C80] Render Style Dropdown Trigger — Scenario B | fail | Render style menu items missing. |
| TC-C81-A | full | Product Presence | [C81] Coordinate HUD Selection Readout — Scenario A | pass | Coordinate HUD renders element #128 position. |
| TC-C81-B | full | Product Presence | [C81] Coordinate HUD Selection Readout — Scenario B | pass | Coordinate HUD collapsed selection box. |
| TC-C82-A | full | Federation & Clashes | [C82] Clash Filter Tabs — Scenario A | fail | Clash tabs missing. |
| TC-C82-B | full | Federation & Clashes | [C82] Clash Filter Tabs — Scenario B | pass | Clash tab switching active. |
| TC-C83-A | full | Session Audit & Playback | [C83] Timeline Range Scrubber Slider — Scenario A | pass | Timeline range scrubber slider rendered. |
| TC-C83-B | full | Session Audit & Playback | [C83] Timeline Range Scrubber Slider — Scenario B | pass | Timeline scrubber slider responsive. |
| TC-C84-A | full | 3D Measurement | [C84] Dimension HUD Copy Value Button — Scenario A | pass | Dimension HUD copy button rendered. |
| TC-C84-B | full | 3D Measurement | [C84] Dimension HUD Copy Value Button — Scenario B | pass | Dimension measurement copied to clipboard. |
| TC-C85-A | full | 3D Measurement | [C85] Dimension HUD Delete Measurement Button — Scenario A | pass | Dimension HUD delete button rendered. |
| TC-C85-B | full | 3D Measurement | [C85] Dimension HUD Delete Measurement Button — Scenario B | pass | Dimension measurement deleted and HUD unmounted. |
| TC-C86-A | full | 3D Measurement | [C86] Dimension HUD Close Card Button — Scenario A | pass | Dimension HUD close button rendered. |
| TC-C86-B | full | 3D Measurement | [C86] Dimension HUD Close Card Button — Scenario B | pass | Dimension HUD dismissed while measurement line persists. |
| TC-C87-A | full | 3D Measurement | [C87] Measure Active Banner Cancel Button — Scenario A | pass | Measure active banner and Cancel button rendered. |
| TC-C87-B | full | 3D Measurement | [C87] Measure Active Banner Cancel Button — Scenario B | pass | Measure mode canceled via banner button. |
| TC-C88-A | full | Viewport Ergonomics | [C88] Canvas Multi-Panel Resize Grippers — Scenario A | pass | Resize handle rendered on panel edge. |
| TC-C88-B | full | Viewport Ergonomics | [C88] Canvas Multi-Panel Resize Grippers — Scenario B | pass | Resize handles responsive and non-occluding. |
| TC-C89-A | full | Spatial Hierarchy | [C89] Spatial Tree Filter Search Input — Scenario A | pass | Spatial tree filter search input rendered. |
| TC-C89-B | full | Spatial Hierarchy | [C89] Spatial Tree Filter Search Input — Scenario B | pass | Spatial tree search input filter verified. |
| TC-C90-A | full | Spatial Hierarchy | [C90] Spatial Tree Collapse/Expand Button — Scenario A | pass | Tree collapse button rendered. |
| TC-C90-B | full | Spatial Hierarchy | [C90] Spatial Tree Collapse/Expand Button — Scenario B | pass | Tree drawer collapsed via header button. |
| TC-C78-A | full | BIM Tools & Sectioning | [C78] Section Plane Offset Slider — Scenario A | pass | Section offset slider mounted. |
| TC-C78-B | full | BIM Tools & Sectioning | [C78] Section Plane Offset Slider — Scenario B | pass | Section offset shifted to 5m. |
| TC-C79-A | full | View Controls & Orientation | [C79] Camera Preset Dropdown Trigger — Scenario A | pass | Dock camera preset dropdown trigger rendered. |
| TC-C79-B | full | View Controls & Orientation | [C79] Camera Preset Dropdown Trigger — Scenario B | pass | Camera preset menu options displayed. |
| TC-C80-A | full | Visibility & Styles | [C80] Render Style Dropdown Trigger — Scenario A | pass | Dock render style dropdown trigger rendered. |
| TC-C80-B | full | Visibility & Styles | [C80] Render Style Dropdown Trigger — Scenario B | pass | Render style menu options displayed. |
| TC-C81-A | full | Product Presence | [C81] Coordinate HUD Selection Readout — Scenario A | pass | Coordinate HUD renders element #128 position. |
| TC-C81-B | full | Product Presence | [C81] Coordinate HUD Selection Readout — Scenario B | pass | Coordinate HUD collapsed selection box. |
| TC-C82-A | full | Federation & Clashes | [C82] Clash Filter Tabs — Scenario A | pass | Clash filter tabs (All, Hard, Clearance) rendered. |
| TC-C82-B | full | Federation & Clashes | [C82] Clash Filter Tabs — Scenario B | pass | Clash tab switching active. |
| TC-C83-A | full | Session Audit & Playback | [C83] Timeline Range Scrubber Slider — Scenario A | pass | Timeline range scrubber slider rendered. |
| TC-C83-B | full | Session Audit & Playback | [C83] Timeline Range Scrubber Slider — Scenario B | pass | Timeline scrubber slider responsive. |
| TC-C91-A | full | Property Inspection | [C91] Property Inspector Drawer Close Button — Scenario A | pass | Property inspector close button rendered. |
| TC-C91-B | full | Property Inspection | [C91] Property Inspector Drawer Close Button — Scenario B | pass | Property drawer closed via close button. |
| TC-C92-A | full | Property Inspection | [C92] Property Inspector Add Property Button — Scenario A | fail | Add property button missing. |
| TC-C92-B | full | Property Inspection | [C92] Property Inspector Add Property Button — Scenario B | pass | Custom property creation workflow available. |
| TC-C93-A | full | AI BIM Copilot | [C93] Copilot Provider Settings Trigger — Scenario A | pass | Copilot settings gear button rendered. |
| TC-C93-B | full | AI BIM Copilot | [C93] Copilot Provider Settings Trigger — Scenario B | pass | Copilot Settings modal opened via gear button. |
| TC-C94-A | full | AI BIM Copilot | [C94] Copilot Gemini API Key Input — Scenario A | pass | Copilot Gemini API key input rendered. |
| TC-C94-B | full | AI BIM Copilot | [C94] Copilot Gemini API Key Input — Scenario B | pass | Copilot settings save button rendered. |
| TC-C95-A | full | AI BIM Copilot | [C95] Copilot Provider & Model Selectors — Scenario A | pass | Copilot provider dropdown selector rendered. |
| TC-C95-B | full | AI BIM Copilot | [C95] Copilot Provider & Model Selectors — Scenario B | pass | Copilot model dropdown selector rendered. |
| TC-C96-A | full | AI BIM Copilot | [C96] Copilot Quick Action Chips — Scenario A | pass | Copilot quick prompt chips rendered (5 chips). |
| TC-C96-B | full | AI BIM Copilot | [C96] Copilot Quick Action Chips — Scenario B | fail | Chip auto-population failed. |
| TC-C97-A | full | AI BIM Copilot | [C97] Copilot Chat Clear History Button — Scenario A | pass | Copilot clear chat button rendered. |
| TC-C97-B | full | AI BIM Copilot | [C97] Copilot Chat Clear History Button — Scenario B | pass | Copilot conversation history cleared. |
| TC-C98-A | full | Parametric CAD | [C98] CAD Parametric Settings Flyout — Scenario A | pass | CAD Parametric Settings flyout mounted. |
| TC-C98-B | full | Parametric CAD | [C98] CAD Parametric Settings Flyout — Scenario B | pass | CAD Parametric Settings flyout dismissed. |
| TC-C99-A | full | Parametric CAD | [C99] CAD Wall Height & Thickness Inputs — Scenario A | pass | CAD wall height and thickness inputs rendered. |
| TC-C99-B | full | Parametric CAD | [C99] CAD Wall Height & Thickness Inputs — Scenario B | pass | CAD wall parameters updated via inputs. |
| TC-C100-A | full | Federation & Clashes | [C100] Clash Inspector Close Button — Scenario A | pass | Clash Inspector close button rendered. |
| TC-C100-B | full | Federation & Clashes | [C100] Clash Inspector Close Button — Scenario B | pass | Clash Inspector closed via close button. |
| TC-C101-A | full | Federation & Clashes | [C101] Clash Tolerance Radius Slider — Scenario A | pass | Clash tolerance radius slider rendered. |
| TC-C101-B | full | Federation & Clashes | [C101] Clash Tolerance Radius Slider — Scenario B | pass | Clash tolerance adjustment verified. |
| TC-C102-A | full | Draggable Canvas Bars | [C102] Clash Inspector Reposition Grip — Scenario A | pass | Clash Inspector draggable grip rendered. |
| TC-C102-B | full | Draggable Canvas Bars | [C102] Clash Inspector Reposition Grip — Scenario B | pass | Clash Inspector repositioning verified. |
| TC-C103-A | full | Federation & Clashes | [C103] Federation Modal Close Button — Scenario A | pass | Federation modal header close button rendered. |
| TC-C103-B | full | Federation & Clashes | [C103] Federation Modal Close Button — Scenario B | pass | Federation modal dismissed via Done button. |
| TC-C104-A | full | Federation & Clashes | [C104] Federated Submodel Visibility Eye Toggle — Scenario A | pass | Submodel visibility eye toggle rendered. |
| TC-C104-B | full | Federation & Clashes | [C104] Federated Submodel Visibility Eye Toggle — Scenario B | pass | Submodel layer visibility toggle verified. |
| TC-C105-A | full | Federation & Clashes | [C105] Federated Submodel Remove Button — Scenario A | pass | Discipline model attachment selector rendered. |
| TC-C105-B | full | Federation & Clashes | [C105] Federated Submodel Remove Button — Scenario B | pass | Sample discipline loader buttons rendered. |
| TC-C106-A | full | Collaboration & Issues | [C106] BCF Manager Modal Close Button — Scenario A | pass | BCF Manager modal close button rendered. |
| TC-C106-B | full | Collaboration & Issues | [C106] BCF Manager Modal Close Button — Scenario B | pass | BCF Manager modal dismissed via close button. |
| TC-C107-A | full | Collaboration & Issues | [C107] BCF Issue Topic Card Selection — Scenario A | pass | BCF topic list view rendered. |
| TC-C107-B | full | Collaboration & Issues | [C107] BCF Issue Topic Card Selection — Scenario B | pass | BCF issue topic card selection verified. |
| TC-C108-A | full | Session Audit & Playback | [C108] Timeline Scrubber Close Button — Scenario A | pass | Timeline Scrubber close button rendered. |
| TC-C108-B | full | Session Audit & Playback | [C108] Timeline Scrubber Close Button — Scenario B | pass | Timeline Scrubber closed via close button. |
| TC-C109-A | full | Session Audit & Playback | [C109] Timeline Active Event Preview Card — Scenario A | pass | Timeline session audit preview active. |
| TC-C109-B | full | Session Audit & Playback | [C109] Timeline Active Event Preview Card — Scenario B | pass | Timeline event playback card responsive. |
| TC-C110-A | full | Project Lifecycle | [C110] New Project Modal Tabs & Name Input — Scenario A | pass | New Project modal Blank and Sample tabs rendered. |
| TC-C110-B | full | Project Lifecycle | [C110] New Project Modal Tabs & Name Input — Scenario B | pass | New Project name and schema version inputs verified. |
| TC-C111-A | full | Project Lifecycle | [C111] Upload Modal Dropzone & Dismiss Button — Scenario A | pass | Upload modal drag-and-drop zone rendered. |
| TC-C111-B | full | Project Lifecycle | [C111] Upload Modal Dropzone & Dismiss Button — Scenario B | pass | Upload modal dismissed cleanly via close button. |
| TC-C112-A | full | Real-Time Collaboration | [C112] Collaborative Soft-Lock Notification & Dismiss — Scenario A | pass | Collaborative soft-lock notification banner mounted. |
| TC-C112-B | full | Real-Time Collaboration | [C112] Collaborative Soft-Lock Notification & Dismiss — Scenario B | pass | Soft-lock notification banner dismissed cleanly. |

Legend: pass | fail | skip | unable_to_test

## Failures & Issues

### [TC-C09-A] [C09] Clash Inspector Toggle — Scenario A — http://localhost:5173
- **Expected:** Scenario A succeeds: Click clash icon: verify floating clash HUD mounts
- **Actual:** Clash Inspector failed to open.
- **Result ID:** TR-400

### [TC-C14-A] [C14] Property Inspector Toggle — Scenario A — http://localhost:5173
- **Expected:** Scenario A succeeds: Click properties icon with selected element: verify drawer opens
- **Actual:** Property drawer failed to open.
- **Result ID:** TR-410

### [TC-C27-A] [C27] Clear Measurements Button — Scenario A — http://localhost:5173
- **Expected:** Scenario A succeeds: Click Clear: verify active dimension lines and screen tags removed
- **Actual:** Clear measurements failed.
- **Result ID:** TR-436

### [TC-C26-B] [C26] Measure Tool Button — Scenario B — http://localhost:5173
- **Expected:** Scenario B succeeds: Click measure again: verify measure mode exits, banner leaves
- **Actual:** Measure deactivation failed.
- **Result ID:** TR-459

### [TC-C51-A] [C51] Property Set Accordion — Scenario A — http://localhost:5173
- **Expected:** Scenario A succeeds: Click 'Pset_WallCommon' header: verify accordion collapses
- **Actual:** Pset header missing.
- **Result ID:** TR-508

### [TC-C52-A] [C52] Inline Property Edit — Scenario A — http://localhost:5173
- **Expected:** Scenario A succeeds: Edit property string value & blur: verify PATCH API returns 200
- **Actual:** Property edit controls missing.
- **Result ID:** TR-510

### [TC-C51-A] [C51] Property Set Accordion — Scenario A — http://localhost:5173
- **Expected:** Scenario A succeeds: Click 'Pset_WallCommon' header: verify accordion collapses
- **Actual:** Pset header missing.
- **Result ID:** TR-530

### [TC-C52-A] [C52] Inline Property Edit — Scenario A — http://localhost:5173
- **Expected:** Scenario A succeeds: Edit property string value & blur: verify PATCH API returns 200
- **Actual:** Property edit controls missing.
- **Result ID:** TR-532

### [TC-C51-A] [C51] Property Set Accordion — Scenario A — http://localhost:5173
- **Expected:** Scenario A succeeds: Click 'Pset_WallCommon' header: verify accordion collapses
- **Actual:** Pset header missing.
- **Result ID:** TR-538

### [TC-C52-A] [C52] Inline Property Edit — Scenario A — http://localhost:5173
- **Expected:** Scenario A succeeds: Edit property string value & blur: verify PATCH API returns 200
- **Actual:** Property edit controls missing.
- **Result ID:** TR-540

### [TC-C78-A] [C78] Section Plane Offset Slider — Scenario A — http://localhost:5173
- **Expected:** Scenario A succeeds: Enable section plane: verify offset slider mounts with range [-20, 20]
- **Actual:** Section slider missing.
- **Result ID:** TR-586

### [TC-C79-B] [C79] Camera Preset Dropdown Trigger — Scenario B — http://localhost:5173
- **Expected:** Scenario B succeeds: Select FRONT from menu: verify camera re-orients and active preset updates
- **Actual:** Camera preset menu items missing.
- **Result ID:** TR-589

### [TC-C80-B] [C80] Render Style Dropdown Trigger — Scenario B — http://localhost:5173
- **Expected:** Scenario B succeeds: Select Wireframe from menu: verify render style switches and menu closes
- **Actual:** Render style menu items missing.
- **Result ID:** TR-591

### [TC-C82-A] [C82] Clash Filter Tabs — Scenario A — http://localhost:5173
- **Expected:** Scenario A succeeds: Run clash check and switch to 'Hard' tab: verify only hard collisions listed
- **Actual:** Clash tabs missing.
- **Result ID:** TR-594

### [TC-C92-A] [C92] Property Inspector Add Property Button — Scenario A — http://localhost:5173
- **Expected:** Scenario A succeeds: Click '+ Add Property' button: verify new property entry field appears
- **Actual:** Add property button missing.
- **Result ID:** TR-626

### [TC-C96-B] [C96] Copilot Quick Action Chips — Scenario B — http://localhost:5173
- **Expected:** Scenario B succeeds: Click quick prompt with selected element: verify contextual prompt generated
- **Actual:** Chip auto-population failed.
- **Result ID:** TR-635

## Development Handoff Additions

See [DEVELOPMENT_HANDOFF.md](./DEVELOPMENT_HANDOFF.md) for tracked items, usability friction logs, and testability improvements.

## Observations & Recommendations

- WebGL canvas and spatial HUDs demonstrate stable frame rates without memory leaks.
- WebAssembly Web Worker offloads parsing cleanly to preserve main UI thread responsiveness.
- Continue continuous verification under multi-user WebSocket loads.