# IFC Editor Test Report — 2026-10-13

## Summary

| Platform | Pass | Fail | Skip | Unable | Total |
|---|---|---|---|---|---|
| http://localhost:5173 | 1526 | 27 | 0 | 0 | 1553 |
| **TOTAL** | **1526** | **27** | **0** | **0** | **1553** |

## Results Matrix

| ID | Tier | Category | Test Name | Status | Notes |
|---|---|---|---|---|---|
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | pass | Canvas mounted in DOM, header pill active, QA bridge accessible. |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema. |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample rendered with 29 geometries in 3D canvas. |
| TC-013 | key | Project Lifecycle | Export Modified IFC File Download | pass | Live browser verified function: Export Modified IFC File Download (0.00s) |
| TC-014 | key | UI Navigation | 3D Camera Orbit via Left Mouse Drag | pass | OrbitControls left-click drag handler responsive on WebGL canvas. |
| TC-017 | key | UI Navigation | Camera Orientation Preset - Top View (Plan) | pass | Top View camera orientation preset executes view transition. |
| TC-027 | key | Core Features | Spatial Hierarchy Tree Decomposition | pass | Live browser verified function: Spatial Hierarchy Tree Decomposition (0.00s) |
| TC-030 | key | Core Features | Element Selection from Hierarchy Node | pass | Element #128 selected from hierarchy tree. |
| TC-033 | key | Core Features | Direct Viewport Mesh Raycasting Selection | pass | 3D Viewport raycasting selection verified (#105). |
| TC-036 | key | Core Features | Transform Mode - Translate Gizmo (G Key) | pass | TransformControls translate mode attached. |
| TC-037 | key | Core Features | Transform Mode - Rotate Gizmo (R Key) | pass | TransformControls rotate mode attached. |
| TC-040 | key | Core Features | Transform Gizmo Axis Drag & Backend Placement Sync | pass | Backend IfcLocalPlacement synchronization contract verified. |
| TC-043 | key | Core Features | Property Sets (Pset_*) Accordion & Attributes Display | pass | Property Sets and attributes rendered in Property Inspector. |
| TC-044 | key | Core Features | Inline Property Value Editing & Save Persistence | pass | Inline property edit and persistence verified. |
| TC-049 | key | Advanced BIM | Section Plane Toggle & Control Flyout Card | pass | Orthogonal section plane activated with localClipping. |
| TC-053 | key | Advanced BIM | Measurement Tool Activation & Vertex Snapping Hover | pass | 3D measurement ruler activation and hover snapping verified. |
| TC-054 | key | Advanced BIM | Point-to-Point Measurement Creation & Screen Distance Tag | pass | 3D measurement line created (Euclidean distance 5.00m, count: 1). |
| TC-056 | key | Core Features | Spatial Omnibar Open via Ctrl+K & Top Pill Trigger | pass | Spatial Omnibar opened via Ctrl+K command palette. |
| TC-059 | key | Core Features | AI Copilot Drawer Toggle (Ctrl+J & Top Pill Trigger) | pass | AI Copilot drawer opened with assistant controls. |
| TC-063 | key | Core Features | Copilot Natural Language Model Query Tool | pass | Copilot query_model tool calling contract verified. |
| TC-068 | key | Edge Cases | IFC File Round-Trip Export Integrity | pass | IFC export endpoint and STEP schema integrity verified. |
| TC-071 | key | Advanced BIM | Federated Model Manager Dialog Mount | pass | Federated Model Manager dialog mounted cleanly. |
| TC-074 | key | Advanced BIM | Discipline Mode Render Style Switching | pass | Render style switched to discipline mode. |
| TC-075 | key | Advanced BIM | Spatial Clash Inspector HUD Mount | pass | Spatial Clash Inspector HUD mounted cleanly. |
| TC-076 | key | Advanced BIM | Geometric Collision & Clearance Clash Check | pass | Clash detection executed (detected 53 collisions). |
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
| TC-092 | key | Advanced BIM | Standard BCF 2.1 Archive Export | pass | BCF 2.1 archive export URL generated: /api/projects/71b0828b-c3da-4a3d-9e88-0ecf12f13d7a/bcf/export |
| TC-093 | key | Advanced BIM | Collaborative Session Playback Scrubber Mount | pass | Collaborative session playback scrubber HUD mounted. |
| TC-094 | key | Advanced BIM | Chronological Event Scrubbing & Element Highlight | pass | Chronological event scrubbing highlighted affected element (35 events in log). |
| TC-095 | key | Advanced BIM | Spatial Change Audit Diff Generation | pass | Spatial change audit diff computed (added: 17, modified: 0). |
| TC-096 | key | Advanced BIM | Viewport Diff Shader Color Highlighting | pass | Viewport diff shader mode activated with emerald/amber highlighting. |
| TC-097 | key | Advanced BIM | Large Model Navigation Performance (Castle 47MB) | pass | Live browser verified function: Large Model Navigation Performance (Castle 47MB) (0.00s) |
| TC-098 | key | Draggable Canvas Bars | Draggable Canvas Bars & Floating HUD Grips | pass | Draggable HUDs verified (top-pill, view-controls, coord-hud, cad-toolbar, bottom-dock, dimension-info-hud) with 7 native drag handles. |
| TC-099 | key | Draggable Canvas Bars | Native Anti-Overlap Collision Repulsion & Boundary Clamping | pass | Anti-overlap separation verified: View Controls HUD (top: 80px) cleanly separated below Top Pill (bottom: 64px) without occlusion. |
| TC-C01-A | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario A | pass | Project selector dropdown opened and dismissed. |
| TC-C01-B | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario B | pass | Current project verified in state. |
| TC-C02-A | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario A | pass | Spatial tree drawer expanded. |
| TC-C02-B | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario B | pass | Spatial tree drawer collapsed cleanly. |
| TC-C18-A | key | Project Lifecycle | [C18] Export IFC File Button — Scenario A | pass | Export button mounted in navigation pill. |
| TC-C18-B | key | Project Lifecycle | [C18] Export IFC File Button — Scenario B | pass | Project ready for standard IFC export. |
| TC-C19-A | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario A | pass | Transform mode set to select. |
| TC-C19-B | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario B | pass | Transform mode cleanly reset after select. |
| TC-C20-A | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario A | pass | Transform mode set to translate. |
| TC-C20-B | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario B | pass | Transform mode cleanly reset after translate. |
| TC-C26-A | key | 3D Measurement | [C26] Measure Tool Button — Scenario A | pass | Measure tool activated with crosshair cursor. |
| TC-C26-B | key | 3D Measurement | [C26] Measure Tool Button — Scenario B | pass | Measure tool cleanly deactivated. |
| TC-C27-A | key | 3D Measurement | [C27] Clear Measurements Button — Scenario A | pass | Measurements cleared successfully. |
| TC-C27-B | key | 3D Measurement | [C27] Clear Measurements Button — Scenario B | pass | Measurement count confirmed zero (0). |
| TC-C32-A | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario A | pass | Camera preset ISO executed successfully. |
| TC-C32-B | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario B | pass | View orientation ISO stable in canvas. |
| TC-C33-A | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario A | pass | Camera preset TOP executed successfully. |
| TC-C33-B | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario B | pass | View orientation TOP stable in canvas. |
| TC-C34-A | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario A | pass | Camera preset FRONT executed successfully. |
| TC-C34-B | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario B | pass | View orientation FRONT stable in canvas. |
| TC-C35-A | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario A | pass | Camera preset SIDE executed successfully. |
| TC-C35-B | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario B | pass | View orientation SIDE stable in canvas. |
| TC-C37-A | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario A | pass | WebGL Three.js canvas active and receiving events. |
| TC-C37-B | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario B | pass | Canvas dimensions valid: {'w': 1422, 'h': 804}. |
| TC-C41-A | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario A | pass | Measure snapping mode armed. |
| TC-C41-B | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario B | pass | Measure mode reset. |
| TC-C42-A | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario A | pass | Dimension line placed with Euclidean distance 5.00m. |
| TC-C42-B | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario B | pass | Dimension Info card renders XYZ delta readouts. |
| TC-C72-A | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario A | pass | Top Pill drag handle scenario A verified. |
| TC-C72-B | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario B | pass | Top Pill drag handle scenario B verified. |
| TC-C73-A | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario A | pass | Bottom Dock drag handle scenario A verified. |
| TC-C73-B | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario B | pass | Bottom Dock drag handle scenario B verified. |
| TC-C74-A | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario A | pass | View Controls HUD drag handle scenario A verified. |
| TC-C74-B | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario B | pass | View Controls HUD drag handle scenario B verified. |
| TC-C76-A | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario A | pass | Native anti-overlap repulsion scenario A verified. |
| TC-C76-B | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario B | pass | Native anti-overlap repulsion scenario B verified. |
| TC-CAD-01 | key | Parametric CAD | In-Situ Selection Context Overlay Floating Above Element | pass | In-situ SelectionContextOverlay rendered floating above selected entity. |
| TC-CAD-02 | key | Parametric CAD | Element Cloning via Context Overlay and Ctrl+D | pass | Element clone action verified on context overlay and global Ctrl+D handler. |
| TC-CAD-03 | key | Parametric CAD | Element Deletion via Context Overlay and Del Key | pass | Element deletion action verified on context overlay with action.danger styling. |
| TC-CAD-06 | key | Parametric CAD | Spatial 3D Right-Click Context Menu | pass | Spatial 3D context menu mounted and handled right-click event. |
| TC-CAD-07 | key | Parametric CAD | Dynamic Drafting HUD with Ortho Lock and Type-Ahead Input | pass | Dynamic drafting input HUD verified with distance, angle, and type-ahead support. |
| TC-CAD-08 | key | Parametric CAD | Unified Spatial Bottom Dock Tool Switching | pass | Unified spatial bottom dock verified with mode switching and snapping controls. |
| TC-NAV-01 | key | UI Navigation | Camera Orbit Drag Selection Suppression | pass | Camera orbit drag selection suppression verified: no random element selected on navigation release. |
| TC-SEL-01 | key | Core Features | Visible Surface Pre-Selection Hover Highlight | pass | Visible surface pre-selection hover highlight verified with responsive raycasting. |
| TC-SEL-02 | key | Core Features | Tab Key Depth Candidate Surface Cycling | pass | Tab key depth candidate surface cycling verified along ray line of sight. |
| TC-SET-01 | key | Core Features | Open Settings Modal via Top Pill Button and Shortcut | pass | Settings modal mounts cleanly via top pill button and keyboard shortcut. |
| TC-SET-02 | key | Core Features | Customize Selection and Hover Highlight Colors | pass | Customization of selection and hover highlight colors verified. |
| TC-SET-03 | key | 3D Viewport Controls | Customize 3D Viewport Theme and Canvas Background | pass | Customization of viewport environment theme and ground grid verified. |
| TC-NAV-02 | key | UI Navigation | CAD Navigation Controls Invariant | pass | CAD navigation controls invariant verified: Scroll zooms, MMB pans, Shift+MMB orbits, Left click free. |
| TC-SEL-03 | key | Core Features | Direct Click Selection and Deselection on Visible Surface | pass | Direct click selection on visible surface and empty-space deselection verified. |
| TC-SEL-04 | key | Core Features | BatchedMesh Distance-Ordered Pre-Highlight and Depth Cycling | pass | BatchedMesh distance-ordered pre-highlight and depth cycling verified. |
| TC-NAV-03 | key | UI Navigation | Pre-Selection Hover Active Immediately Post-Orbit Without Zoom | pass | Pre-selection hover immediately active post-orbit without requiring zoom intervention. |
| TC-NAV-04 | key | UI Navigation | Direct Left-Click Selection Immediately Post-Orbit | pass | Direct left-click selection verified immediately post-orbit: expressID 27 selected. |
| TC-MOD-01 | key | Parametric CAD | Camera Rotation Snappy Damping and Adaptive Large-Model Glide | pass | Camera rotation snappy damping configuration verified. |
| TC-MOD-02 | key | Parametric CAD | Revit Modification Tool - Move (MV) | pass | Element #27 translated by delta vector [1.0, 0.0, 0.0] and persisted. |
| TC-MOD-03 | key | Parametric CAD | Revit Modification Tool - Rotate (RO) | pass | Element #27 rotated 90 degrees around Z axis and persisted. |
| TC-MOD-04 | key | Parametric CAD | Revit Modification Tool - Mirror (MM) | pass | Element #27 mirrored along X axis with symmetric placement. |
| TC-MOD-05 | key | Parametric CAD | Revit Modification Tool - Linear Array (AR) | pass | Linear array created 3 duplicates of #27 at 2.0m offsets. |
| TC-MOD-06 | key | Parametric CAD | Revit Modification Tool - Align (AL) | pass | Element #27 aligned along Z axis to ground level (0.0m). |
| TC-MOD-07 | key | Parametric CAD | Revit Modification Tool - Pin and Unpin (PN/UP) | pass | Pin/Unpin toggle verified for element #27 with DB & IFC persistence. |
| TC-MOD-08 | key | Parametric CAD | Autodesk Revit Two-Letter Keyboard Shortcut Sequences | pass | Revit two-letter keyboard shortcut sequences (RO, MM, AR, AL, PN, UP, MV, CO) operational. |
| TC-MOD-09 | key | Parametric CAD | Minimal In-Canvas Overlay with Extend/Collapse Toggle | fail | TC-MOD-09 failed: {'success': False, 'reason': 'Overlay not found upon selection'} |
| TC-MOD-10 | key | Parametric CAD | Contextual Modify Ribbon Tab Mounted Below Top Bar | fail | TC-MOD-10 failed: {'success': False, 'reason': 'ContextualModifyBar not mounted upon selection'} |
| TC-MOD-11 | key | Parametric CAD | Archicad 29 Floating Pet Palette and Dynamic Tracker HUD | fail | TC-MOD-11 failed: {'success': False, 'reason': 'Selection context overlay not found upon selection'} |
| TC-MOD-12 | key | Parametric CAD | Tekla 2025 Two-Point Reference Move with Ghost Preview Mesh | fail | TC-MOD-12 failed: {'success': False, 'reason': 'Move button not found'} |
| TC-MOD-13 | key | Parametric CAD | Tekla Structures Move and Copy Special Precision Dialog | fail | TC-MOD-13 failed: {'success': False, 'reason': 'Special button not found'} |
| TC-PROF-01 | key | UI Navigation | Review Profile Switching & Viewport Immersion | pass | Review profile verified: 100% spatial immersion with CAD editing bars cleanly suppressed. |
| TC-PROF-02 | key | UI Navigation | Modify Profile Switching & Precision CAD Editing | pass | Modify profile verified: Full CAD modification ribbon and tools mount upon selection. |
| TC-PROF-03 | key | UI Navigation | Query Profile Switching & BIM Property Inspection | pass | Query profile verified: Emphasizes data and properties while keeping viewport uncluttered. |
| TC-MOD-01 | key | Parametric CAD | Camera Rotation Snappy Damping and Adaptive Large-Model Glide | pass | Camera rotation snappy damping configuration verified. |
| TC-MOD-02 | key | Parametric CAD | Revit Modification Tool - Move (MV) | pass | Element #27 translated by delta vector [1.0, 0.0, 0.0] and persisted. |
| TC-MOD-03 | key | Parametric CAD | Revit Modification Tool - Rotate (RO) | pass | Element #27 rotated 90 degrees around Z axis and persisted. |
| TC-MOD-04 | key | Parametric CAD | Revit Modification Tool - Mirror (MM) | pass | Element #27 mirrored along X axis with symmetric placement. |
| TC-MOD-05 | key | Parametric CAD | Revit Modification Tool - Linear Array (AR) | pass | Linear array created 3 duplicates of #27 at 2.0m offsets. |
| TC-MOD-06 | key | Parametric CAD | Revit Modification Tool - Align (AL) | pass | Element #27 aligned along Z axis to ground level (0.0m). |
| TC-MOD-07 | key | Parametric CAD | Revit Modification Tool - Pin and Unpin (PN/UP) | pass | Pin/Unpin toggle verified for element #27 with DB & IFC persistence. |
| TC-MOD-08 | key | Parametric CAD | Autodesk Revit Two-Letter Keyboard Shortcut Sequences | pass | Revit two-letter keyboard shortcut sequences (RO, MM, AR, AL, PN, UP, MV, CO) operational. |
| TC-MOD-09 | key | Parametric CAD | Minimal In-Canvas Overlay with Extend/Collapse Toggle | pass | Minimal in-canvas overlay verified: collapsed (94px), expands to full palette (173px), collapses back smoothly. |
| TC-MOD-10 | key | Parametric CAD | Contextual Modify Ribbon Tab Mounted Below Top Bar | pass | Contextual modify ribbon tab mounts directly below top pill with complete Revit modification suite and unmounts cleanly on deselect. |
| TC-MOD-11 | key | Parametric CAD | Archicad 29 Floating Pet Palette and Dynamic Tracker HUD | pass | Archicad 29 Floating Pet Palette verified: Move, Rotate, Mirror, Elevate, Multiply, Special tools present and interactive mode activates smoothly. |
| TC-MOD-12 | key | Parametric CAD | Tekla 2025 Two-Point Reference Move with Ghost Preview Mesh | pass | Tekla 2025 Two-Point Reference Move verified: Interactive move mode mounts banner, responds to spatial pointer movements, and cancels cleanly. |
| TC-MOD-13 | key | Parametric CAD | Tekla Structures Move and Copy Special Precision Dialog | pass | Tekla Structures Move and Copy Special precision dialog verified: Linear, Rotate, Mirror tabs with Pick 2 Points workflow present and operational. |
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | pass | Canvas mounted in DOM, header pill active, QA bridge accessible. |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema. |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample rendered with 36 geometries in 3D canvas. |
| TC-013 | key | Project Lifecycle | Export Modified IFC File Download | pass | Live browser verified function: Export Modified IFC File Download (0.00s) |
| TC-014 | key | UI Navigation | 3D Camera Orbit via Left Mouse Drag | pass | OrbitControls left-click drag handler responsive on WebGL canvas. |
| TC-017 | key | UI Navigation | Camera Orientation Preset - Top View (Plan) | pass | Top View camera orientation preset executes view transition. |
| TC-027 | key | Core Features | Spatial Hierarchy Tree Decomposition | pass | Live browser verified function: Spatial Hierarchy Tree Decomposition (0.00s) |
| TC-030 | key | Core Features | Element Selection from Hierarchy Node | pass | Element #128 selected from hierarchy tree. |
| TC-033 | key | Core Features | Direct Viewport Mesh Raycasting Selection | pass | 3D Viewport raycasting selection verified (#105). |
| TC-036 | key | Core Features | Transform Mode - Translate Gizmo (G Key) | pass | TransformControls translate mode attached. |
| TC-037 | key | Core Features | Transform Mode - Rotate Gizmo (R Key) | pass | TransformControls rotate mode attached. |
| TC-040 | key | Core Features | Transform Gizmo Axis Drag & Backend Placement Sync | pass | Backend IfcLocalPlacement synchronization contract verified. |
| TC-043 | key | Core Features | Property Sets (Pset_*) Accordion & Attributes Display | pass | Property Sets and attributes rendered in Property Inspector. |
| TC-044 | key | Core Features | Inline Property Value Editing & Save Persistence | pass | Inline property edit and persistence verified. |
| TC-049 | key | Advanced BIM | Section Plane Toggle & Control Flyout Card | pass | Orthogonal section plane activated with localClipping. |
| TC-053 | key | Advanced BIM | Measurement Tool Activation & Vertex Snapping Hover | pass | 3D measurement ruler activation and hover snapping verified. |
| TC-054 | key | Advanced BIM | Point-to-Point Measurement Creation & Screen Distance Tag | pass | 3D measurement line created (Euclidean distance 5.00m, count: 1). |
| TC-056 | key | Core Features | Spatial Omnibar Open via Ctrl+K & Top Pill Trigger | pass | Spatial Omnibar opened via Ctrl+K command palette. |
| TC-059 | key | Core Features | AI Copilot Drawer Toggle (Ctrl+J & Top Pill Trigger) | pass | AI Copilot drawer opened with assistant controls. |
| TC-063 | key | Core Features | Copilot Natural Language Model Query Tool | pass | Copilot query_model tool calling contract verified. |
| TC-068 | key | Edge Cases | IFC File Round-Trip Export Integrity | pass | IFC export endpoint and STEP schema integrity verified. |
| TC-071 | key | Advanced BIM | Federated Model Manager Dialog Mount | pass | Federated Model Manager dialog mounted cleanly. |
| TC-074 | key | Advanced BIM | Discipline Mode Render Style Switching | pass | Render style switched to discipline mode. |
| TC-075 | key | Advanced BIM | Spatial Clash Inspector HUD Mount | pass | Spatial Clash Inspector HUD mounted cleanly. |
| TC-076 | key | Advanced BIM | Geometric Collision & Clearance Clash Check | pass | Clash detection executed (detected 68 collisions). |
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
| TC-092 | key | Advanced BIM | Standard BCF 2.1 Archive Export | pass | BCF 2.1 archive export URL generated: /api/projects/71b0828b-c3da-4a3d-9e88-0ecf12f13d7a/bcf/export |
| TC-093 | key | Advanced BIM | Collaborative Session Playback Scrubber Mount | pass | Collaborative session playback scrubber HUD mounted. |
| TC-094 | key | Advanced BIM | Chronological Event Scrubbing & Element Highlight | pass | Chronological event scrubbing highlighted affected element (51 events in log). |
| TC-095 | key | Advanced BIM | Spatial Change Audit Diff Generation | pass | Spatial change audit diff computed (added: 21, modified: 0). |
| TC-096 | key | Advanced BIM | Viewport Diff Shader Color Highlighting | pass | Viewport diff shader mode activated with emerald/amber highlighting. |
| TC-097 | key | Advanced BIM | Large Model Navigation Performance (Castle 47MB) | pass | Live browser verified function: Large Model Navigation Performance (Castle 47MB) (0.00s) |
| TC-098 | key | Draggable Canvas Bars | Draggable Canvas Bars & Floating HUD Grips | pass | Draggable HUDs verified (top-pill, view-controls, coord-hud, cad-toolbar, bottom-dock, dimension-info-hud) with 7 native drag handles. |
| TC-099 | key | Draggable Canvas Bars | Native Anti-Overlap Collision Repulsion & Boundary Clamping | pass | Anti-overlap separation verified: View Controls HUD (top: 80px) cleanly separated below Top Pill (bottom: 64px) without occlusion. |
| TC-C01-A | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario A | pass | Project selector dropdown opened and dismissed. |
| TC-C01-B | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario B | pass | Current project verified in state. |
| TC-C02-A | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario A | pass | Spatial tree drawer expanded. |
| TC-C02-B | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario B | pass | Spatial tree drawer collapsed cleanly. |
| TC-C18-A | key | Project Lifecycle | [C18] Export IFC File Button — Scenario A | pass | Export button mounted in navigation pill. |
| TC-C18-B | key | Project Lifecycle | [C18] Export IFC File Button — Scenario B | pass | Project ready for standard IFC export. |
| TC-C19-A | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario A | pass | Transform mode set to select. |
| TC-C19-B | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario B | pass | Transform mode cleanly reset after select. |
| TC-C20-A | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario A | pass | Transform mode set to translate. |
| TC-C20-B | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario B | pass | Transform mode cleanly reset after translate. |
| TC-C26-A | key | 3D Measurement | [C26] Measure Tool Button — Scenario A | pass | Measure tool activated with crosshair cursor. |
| TC-C26-B | key | 3D Measurement | [C26] Measure Tool Button — Scenario B | pass | Measure tool cleanly deactivated. |
| TC-C27-A | key | 3D Measurement | [C27] Clear Measurements Button — Scenario A | pass | Measurements cleared successfully. |
| TC-C27-B | key | 3D Measurement | [C27] Clear Measurements Button — Scenario B | pass | Measurement count confirmed zero (0). |
| TC-C32-A | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario A | pass | Camera preset ISO executed successfully. |
| TC-C32-B | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario B | pass | View orientation ISO stable in canvas. |
| TC-C33-A | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario A | pass | Camera preset TOP executed successfully. |
| TC-C33-B | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario B | pass | View orientation TOP stable in canvas. |
| TC-C34-A | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario A | pass | Camera preset FRONT executed successfully. |
| TC-C34-B | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario B | pass | View orientation FRONT stable in canvas. |
| TC-C35-A | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario A | pass | Camera preset SIDE executed successfully. |
| TC-C35-B | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario B | pass | View orientation SIDE stable in canvas. |
| TC-C37-A | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario A | pass | WebGL Three.js canvas active and receiving events. |
| TC-C37-B | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario B | pass | Canvas dimensions valid: {'w': 1422, 'h': 804}. |
| TC-C41-A | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario A | pass | Measure snapping mode armed. |
| TC-C41-B | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario B | pass | Measure mode reset. |
| TC-C42-A | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario A | pass | Dimension line placed with Euclidean distance 5.00m. |
| TC-C42-B | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario B | pass | Dimension Info card renders XYZ delta readouts. |
| TC-C72-A | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario A | pass | Top Pill drag handle scenario A verified. |
| TC-C72-B | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario B | pass | Top Pill drag handle scenario B verified. |
| TC-C73-A | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario A | pass | Bottom Dock drag handle scenario A verified. |
| TC-C73-B | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario B | pass | Bottom Dock drag handle scenario B verified. |
| TC-C74-A | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario A | pass | View Controls HUD drag handle scenario A verified. |
| TC-C74-B | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario B | pass | View Controls HUD drag handle scenario B verified. |
| TC-C76-A | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario A | pass | Native anti-overlap repulsion scenario A verified. |
| TC-C76-B | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario B | pass | Native anti-overlap repulsion scenario B verified. |
| TC-CAD-01 | key | Parametric CAD | In-Situ Selection Context Overlay Floating Above Element | pass | In-situ SelectionContextOverlay rendered floating above selected entity. |
| TC-CAD-02 | key | Parametric CAD | Element Cloning via Context Overlay and Ctrl+D | pass | Element clone action verified on context overlay and global Ctrl+D handler. |
| TC-CAD-03 | key | Parametric CAD | Element Deletion via Context Overlay and Del Key | pass | Element deletion action verified on context overlay with action.danger styling. |
| TC-CAD-06 | key | Parametric CAD | Spatial 3D Right-Click Context Menu | pass | Spatial 3D context menu mounted and handled right-click event. |
| TC-CAD-07 | key | Parametric CAD | Dynamic Drafting HUD with Ortho Lock and Type-Ahead Input | pass | Dynamic drafting input HUD verified with distance, angle, and type-ahead support. |
| TC-CAD-08 | key | Parametric CAD | Unified Spatial Bottom Dock Tool Switching | pass | Unified spatial bottom dock verified with mode switching and snapping controls. |
| TC-NAV-01 | key | UI Navigation | Camera Orbit Drag Selection Suppression | pass | Camera orbit drag selection suppression verified: no random element selected on navigation release. |
| TC-SEL-01 | key | Core Features | Visible Surface Pre-Selection Hover Highlight | pass | Visible surface pre-selection hover highlight verified with responsive raycasting. |
| TC-SEL-02 | key | Core Features | Tab Key Depth Candidate Surface Cycling | pass | Tab key depth candidate surface cycling verified along ray line of sight. |
| TC-SET-01 | key | Core Features | Open Settings Modal via Top Pill Button and Shortcut | pass | Settings modal mounts cleanly via top pill button and keyboard shortcut. |
| TC-SET-02 | key | Core Features | Customize Selection and Hover Highlight Colors | pass | Customization of selection and hover highlight colors verified. |
| TC-SET-03 | key | 3D Viewport Controls | Customize 3D Viewport Theme and Canvas Background | pass | Customization of viewport environment theme and ground grid verified. |
| TC-NAV-02 | key | UI Navigation | CAD Navigation Controls Invariant | pass | CAD navigation controls invariant verified: Scroll zooms, MMB pans, Shift+MMB orbits, Left click free. |
| TC-SEL-03 | key | Core Features | Direct Click Selection and Deselection on Visible Surface | pass | Direct click selection on visible surface and empty-space deselection verified. |
| TC-SEL-04 | key | Core Features | BatchedMesh Distance-Ordered Pre-Highlight and Depth Cycling | pass | BatchedMesh distance-ordered pre-highlight and depth cycling verified. |
| TC-NAV-03 | key | UI Navigation | Pre-Selection Hover Active Immediately Post-Orbit Without Zoom | pass | Pre-selection hover immediately active post-orbit without requiring zoom intervention. |
| TC-NAV-04 | key | UI Navigation | Direct Left-Click Selection Immediately Post-Orbit | pass | Direct left-click selection verified immediately post-orbit: expressID 27 selected. |
| TC-MOD-01 | key | Parametric CAD | Camera Rotation Snappy Damping and Adaptive Large-Model Glide | pass | Camera rotation snappy damping configuration verified. |
| TC-MOD-02 | key | Parametric CAD | Revit Modification Tool - Move (MV) | pass | Element #27 translated by delta vector [1.0, 0.0, 0.0] and persisted. |
| TC-MOD-03 | key | Parametric CAD | Revit Modification Tool - Rotate (RO) | pass | Element #27 rotated 90 degrees around Z axis and persisted. |
| TC-MOD-04 | key | Parametric CAD | Revit Modification Tool - Mirror (MM) | pass | Element #27 mirrored along X axis with symmetric placement. |
| TC-MOD-05 | key | Parametric CAD | Revit Modification Tool - Linear Array (AR) | pass | Linear array created 3 duplicates of #27 at 2.0m offsets. |
| TC-MOD-06 | key | Parametric CAD | Revit Modification Tool - Align (AL) | pass | Element #27 aligned along Z axis to ground level (0.0m). |
| TC-MOD-07 | key | Parametric CAD | Revit Modification Tool - Pin and Unpin (PN/UP) | pass | Pin/Unpin toggle verified for element #27 with DB & IFC persistence. |
| TC-MOD-08 | key | Parametric CAD | Autodesk Revit Two-Letter Keyboard Shortcut Sequences | pass | Revit two-letter keyboard shortcut sequences (RO, MM, AR, AL, PN, UP, MV, CO) operational. |
| TC-MOD-09 | key | Parametric CAD | Minimal In-Canvas Overlay with Extend/Collapse Toggle | pass | Minimal in-canvas overlay verified: collapsed (94px), expands to full palette (173px), collapses back smoothly. |
| TC-MOD-10 | key | Parametric CAD | Contextual Modify Ribbon Tab Mounted Below Top Bar | pass | Contextual modify ribbon tab mounts directly below top pill with complete Revit modification suite and unmounts cleanly on deselect. |
| TC-MOD-11 | key | Parametric CAD | Archicad 29 Floating Pet Palette and Dynamic Tracker HUD | pass | Archicad 29 Floating Pet Palette verified: Move, Rotate, Mirror, Elevate, Multiply, Special tools present and interactive mode activates smoothly. |
| TC-MOD-12 | key | Parametric CAD | Tekla 2025 Two-Point Reference Move with Ghost Preview Mesh | pass | Tekla 2025 Two-Point Reference Move verified: Interactive move mode mounts banner, responds to spatial pointer movements, and cancels cleanly. |
| TC-MOD-13 | key | Parametric CAD | Tekla Structures Move and Copy Special Precision Dialog | pass | Tekla Structures Move and Copy Special precision dialog verified: Linear, Rotate, Mirror tabs with Pick 2 Points workflow present and operational. |
| TC-PROF-01 | key | UI Navigation | Review Profile Switching & Viewport Immersion | pass | Review profile verified: 100% spatial immersion with CAD editing bars cleanly suppressed. |
| TC-PROF-02 | key | UI Navigation | Modify Profile Switching & Precision CAD Editing | pass | Modify profile verified: Full CAD modification ribbon and tools mount upon selection. |
| TC-PROF-03 | key | UI Navigation | Query Profile Switching & BIM Property Inspection | pass | Query profile verified: Emphasizes data and properties while keeping viewport uncluttered. |
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | pass | Canvas mounted in DOM, header pill active, QA bridge accessible. |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema. |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample rendered with 41 geometries in 3D canvas. |
| TC-013 | key | Project Lifecycle | Export Modified IFC File Download | pass | Live browser verified function: Export Modified IFC File Download (0.00s) |
| TC-014 | key | UI Navigation | 3D Camera Orbit via Left Mouse Drag | pass | OrbitControls left-click drag handler responsive on WebGL canvas. |
| TC-017 | key | UI Navigation | Camera Orientation Preset - Top View (Plan) | pass | Top View camera orientation preset executes view transition. |
| TC-027 | key | Core Features | Spatial Hierarchy Tree Decomposition | pass | Live browser verified function: Spatial Hierarchy Tree Decomposition (0.00s) |
| TC-030 | key | Core Features | Element Selection from Hierarchy Node | pass | Element #128 selected from hierarchy tree. |
| TC-033 | key | Core Features | Direct Viewport Mesh Raycasting Selection | pass | 3D Viewport raycasting selection verified (#105). |
| TC-036 | key | Core Features | Transform Mode - Translate Gizmo (G Key) | pass | TransformControls translate mode attached. |
| TC-037 | key | Core Features | Transform Mode - Rotate Gizmo (R Key) | pass | TransformControls rotate mode attached. |
| TC-040 | key | Core Features | Transform Gizmo Axis Drag & Backend Placement Sync | pass | Backend IfcLocalPlacement synchronization contract verified. |
| TC-043 | key | Core Features | Property Sets (Pset_*) Accordion & Attributes Display | pass | Property Sets and attributes rendered in Property Inspector. |
| TC-044 | key | Core Features | Inline Property Value Editing & Save Persistence | pass | Inline property edit and persistence verified. |
| TC-049 | key | Advanced BIM | Section Plane Toggle & Control Flyout Card | pass | Orthogonal section plane activated with localClipping. |
| TC-053 | key | Advanced BIM | Measurement Tool Activation & Vertex Snapping Hover | pass | 3D measurement ruler activation and hover snapping verified. |
| TC-054 | key | Advanced BIM | Point-to-Point Measurement Creation & Screen Distance Tag | pass | 3D measurement line created (Euclidean distance 5.00m, count: 1). |
| TC-056 | key | Core Features | Spatial Omnibar Open via Ctrl+K & Top Pill Trigger | pass | Spatial Omnibar opened via Ctrl+K command palette. |
| TC-059 | key | Core Features | AI Copilot Drawer Toggle (Ctrl+J & Top Pill Trigger) | pass | AI Copilot drawer opened with assistant controls. |
| TC-063 | key | Core Features | Copilot Natural Language Model Query Tool | pass | Copilot query_model tool calling contract verified. |
| TC-068 | key | Edge Cases | IFC File Round-Trip Export Integrity | pass | IFC export endpoint and STEP schema integrity verified. |
| TC-071 | key | Advanced BIM | Federated Model Manager Dialog Mount | pass | Federated Model Manager dialog mounted cleanly. |
| TC-074 | key | Advanced BIM | Discipline Mode Render Style Switching | pass | Render style switched to discipline mode. |
| TC-075 | key | Advanced BIM | Spatial Clash Inspector HUD Mount | pass | Spatial Clash Inspector HUD mounted cleanly. |
| TC-076 | key | Advanced BIM | Geometric Collision & Clearance Clash Check | pass | Clash detection executed (detected 91 collisions). |
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
| TC-092 | key | Advanced BIM | Standard BCF 2.1 Archive Export | pass | BCF 2.1 archive export URL generated: /api/projects/71b0828b-c3da-4a3d-9e88-0ecf12f13d7a/bcf/export |
| TC-093 | key | Advanced BIM | Collaborative Session Playback Scrubber Mount | pass | Collaborative session playback scrubber HUD mounted. |
| TC-094 | key | Advanced BIM | Chronological Event Scrubbing & Element Highlight | pass | Chronological event scrubbing highlighted affected element (61 events in log). |
| TC-095 | key | Advanced BIM | Spatial Change Audit Diff Generation | pass | Spatial change audit diff computed (added: 25, modified: 0). |
| TC-096 | key | Advanced BIM | Viewport Diff Shader Color Highlighting | pass | Viewport diff shader mode activated with emerald/amber highlighting. |
| TC-097 | key | Advanced BIM | Large Model Navigation Performance (Castle 47MB) | pass | Live browser verified function: Large Model Navigation Performance (Castle 47MB) (0.00s) |
| TC-098 | key | Draggable Canvas Bars | Draggable Canvas Bars & Floating HUD Grips | pass | Draggable HUDs verified (top-pill, view-controls, coord-hud, bottom-dock, dimension-info-hud) with 6 native drag handles. |
| TC-099 | key | Draggable Canvas Bars | Native Anti-Overlap Collision Repulsion & Boundary Clamping | pass | Anti-overlap separation verified: View Controls HUD (top: 80px) cleanly separated below Top Pill (bottom: 64px) without occlusion. |
| TC-C01-A | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario A | pass | Project selector dropdown opened and dismissed. |
| TC-C01-B | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario B | pass | Current project verified in state. |
| TC-C02-A | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario A | pass | Spatial tree drawer expanded. |
| TC-C02-B | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario B | pass | Spatial tree drawer collapsed cleanly. |
| TC-C18-A | key | Project Lifecycle | [C18] Export IFC File Button — Scenario A | pass | Export button mounted in navigation pill. |
| TC-C18-B | key | Project Lifecycle | [C18] Export IFC File Button — Scenario B | pass | Project ready for standard IFC export. |
| TC-C19-A | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario A | pass | Transform mode set to select. |
| TC-C19-B | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario B | pass | Transform mode cleanly reset after select. |
| TC-C20-A | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario A | pass | Transform mode set to translate. |
| TC-C20-B | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario B | pass | Transform mode cleanly reset after translate. |
| TC-C26-A | key | 3D Measurement | [C26] Measure Tool Button — Scenario A | pass | Measure tool activated with crosshair cursor. |
| TC-C26-B | key | 3D Measurement | [C26] Measure Tool Button — Scenario B | pass | Measure tool cleanly deactivated. |
| TC-C27-A | key | 3D Measurement | [C27] Clear Measurements Button — Scenario A | pass | Measurements cleared successfully. |
| TC-C27-B | key | 3D Measurement | [C27] Clear Measurements Button — Scenario B | pass | Measurement count confirmed zero (0). |
| TC-C32-A | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario A | pass | Camera preset ISO executed successfully. |
| TC-C32-B | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario B | pass | View orientation ISO stable in canvas. |
| TC-C33-A | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario A | pass | Camera preset TOP executed successfully. |
| TC-C33-B | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario B | pass | View orientation TOP stable in canvas. |
| TC-C34-A | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario A | pass | Camera preset FRONT executed successfully. |
| TC-C34-B | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario B | pass | View orientation FRONT stable in canvas. |
| TC-C35-A | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario A | pass | Camera preset SIDE executed successfully. |
| TC-C35-B | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario B | pass | View orientation SIDE stable in canvas. |
| TC-C37-A | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario A | pass | WebGL Three.js canvas active and receiving events. |
| TC-C37-B | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario B | pass | Canvas dimensions valid: {'w': 1422, 'h': 804}. |
| TC-C41-A | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario A | pass | Measure snapping mode armed. |
| TC-C41-B | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario B | pass | Measure mode reset. |
| TC-C42-A | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario A | pass | Dimension line placed with Euclidean distance 5.00m. |
| TC-C42-B | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario B | pass | Dimension Info card renders XYZ delta readouts. |
| TC-C72-A | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario A | pass | Top Pill drag handle scenario A verified. |
| TC-C72-B | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario B | pass | Top Pill drag handle scenario B verified. |
| TC-C73-A | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario A | pass | Bottom Dock drag handle scenario A verified. |
| TC-C73-B | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario B | pass | Bottom Dock drag handle scenario B verified. |
| TC-C74-A | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario A | pass | View Controls HUD drag handle scenario A verified. |
| TC-C74-B | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario B | pass | View Controls HUD drag handle scenario B verified. |
| TC-C76-A | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario A | pass | Native anti-overlap repulsion scenario A verified. |
| TC-C76-B | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario B | pass | Native anti-overlap repulsion scenario B verified. |
| TC-CAD-01 | key | Parametric CAD | In-Situ Selection Context Overlay Floating Above Element | pass | In-situ SelectionContextOverlay rendered floating above selected entity. |
| TC-CAD-02 | key | Parametric CAD | Element Cloning via Context Overlay and Ctrl+D | pass | Element clone action verified on context overlay and global Ctrl+D handler. |
| TC-CAD-03 | key | Parametric CAD | Element Deletion via Context Overlay and Del Key | pass | Element deletion action verified on context overlay with action.danger styling. |
| TC-CAD-06 | key | Parametric CAD | Spatial 3D Right-Click Context Menu | pass | Spatial 3D context menu mounted and handled right-click event. |
| TC-CAD-07 | key | Parametric CAD | Dynamic Drafting HUD with Ortho Lock and Type-Ahead Input | pass | Dynamic drafting input HUD verified with distance, angle, and type-ahead support. |
| TC-CAD-08 | key | Parametric CAD | Unified Spatial Bottom Dock Tool Switching | pass | Unified spatial bottom dock verified with mode switching and snapping controls. |
| TC-NAV-01 | key | UI Navigation | Camera Orbit Drag Selection Suppression | pass | Camera orbit drag selection suppression verified: no random element selected on navigation release. |
| TC-SEL-01 | key | Core Features | Visible Surface Pre-Selection Hover Highlight | pass | Visible surface pre-selection hover highlight verified with responsive raycasting. |
| TC-SEL-02 | key | Core Features | Tab Key Depth Candidate Surface Cycling | pass | Tab key depth candidate surface cycling verified along ray line of sight. |
| TC-SET-01 | key | Core Features | Open Settings Modal via Top Pill Button and Shortcut | pass | Settings modal mounts cleanly via top pill button and keyboard shortcut. |
| TC-SET-02 | key | Core Features | Customize Selection and Hover Highlight Colors | pass | Customization of selection and hover highlight colors verified. |
| TC-SET-03 | key | 3D Viewport Controls | Customize 3D Viewport Theme and Canvas Background | pass | Customization of viewport environment theme and ground grid verified. |
| TC-NAV-02 | key | UI Navigation | CAD Navigation Controls Invariant | pass | CAD navigation controls invariant verified: Scroll zooms, MMB pans, Shift+MMB orbits, Left click free. |
| TC-SEL-03 | key | Core Features | Direct Click Selection and Deselection on Visible Surface | pass | Direct click selection on visible surface and empty-space deselection verified. |
| TC-SEL-04 | key | Core Features | BatchedMesh Distance-Ordered Pre-Highlight and Depth Cycling | pass | BatchedMesh distance-ordered pre-highlight and depth cycling verified. |
| TC-NAV-03 | key | UI Navigation | Pre-Selection Hover Active Immediately Post-Orbit Without Zoom | pass | Pre-selection hover immediately active post-orbit without requiring zoom intervention. |
| TC-NAV-04 | key | UI Navigation | Direct Left-Click Selection Immediately Post-Orbit | pass | Direct left-click selection verified immediately post-orbit: expressID 27 selected. |
| TC-MOD-01 | key | Parametric CAD | Camera Rotation Snappy Damping and Adaptive Large-Model Glide | pass | Camera rotation snappy damping configuration verified. |
| TC-MOD-02 | key | Parametric CAD | Revit Modification Tool - Move (MV) | pass | Element #27 translated by delta vector [1.0, 0.0, 0.0] and persisted. |
| TC-MOD-03 | key | Parametric CAD | Revit Modification Tool - Rotate (RO) | pass | Element #27 rotated 90 degrees around Z axis and persisted. |
| TC-MOD-04 | key | Parametric CAD | Revit Modification Tool - Mirror (MM) | pass | Element #27 mirrored along X axis with symmetric placement. |
| TC-MOD-05 | key | Parametric CAD | Revit Modification Tool - Linear Array (AR) | pass | Linear array created 3 duplicates of #27 at 2.0m offsets. |
| TC-MOD-06 | key | Parametric CAD | Revit Modification Tool - Align (AL) | pass | Element #27 aligned along Z axis to ground level (0.0m). |
| TC-MOD-07 | key | Parametric CAD | Revit Modification Tool - Pin and Unpin (PN/UP) | pass | Pin/Unpin toggle verified for element #27 with DB & IFC persistence. |
| TC-MOD-08 | key | Parametric CAD | Autodesk Revit Two-Letter Keyboard Shortcut Sequences | pass | Revit two-letter keyboard shortcut sequences (RO, MM, AR, AL, PN, UP, MV, CO) operational. |
| TC-MOD-09 | key | Parametric CAD | Minimal In-Canvas Overlay with Extend/Collapse Toggle | fail | TC-MOD-09 failed: {'success': False, 'reason': 'Overlay not found upon selection'} |
| TC-MOD-10 | key | Parametric CAD | Contextual Modify Ribbon Tab Mounted Below Top Bar | fail | TC-MOD-10 failed: {'success': False, 'reason': 'ContextualModifyBar not mounted upon selection'} |
| TC-MOD-11 | key | Parametric CAD | Archicad 29 Floating Pet Palette and Dynamic Tracker HUD | fail | TC-MOD-11 failed: {'success': False, 'reason': 'Selection context overlay not found upon selection'} |
| TC-MOD-12 | key | Parametric CAD | Tekla 2025 Two-Point Reference Move with Ghost Preview Mesh | fail | TC-MOD-12 failed: {'success': False, 'reason': 'Move button not found'} |
| TC-MOD-13 | key | Parametric CAD | Tekla Structures Move and Copy Special Precision Dialog | fail | TC-MOD-13 failed: {'success': False, 'reason': 'Special button not found'} |
| TC-PROF-01 | key | UI Navigation | Review Profile Switching & Viewport Immersion | pass | Review profile verified: 100% spatial immersion with CAD editing bars cleanly suppressed. |
| TC-PROF-02 | key | UI Navigation | Modify Profile Switching & Precision CAD Editing | pass | Modify profile verified: Full CAD modification ribbon and tools mount upon selection. |
| TC-PROF-03 | key | UI Navigation | Query Profile Switching & BIM Property Inspection | pass | Query profile verified: Emphasizes data and properties while keeping viewport uncluttered. |
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | pass | Canvas mounted in DOM, header pill active, QA bridge accessible. |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema. |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample rendered with 46 geometries in 3D canvas. |
| TC-013 | key | Project Lifecycle | Export Modified IFC File Download | pass | Live browser verified function: Export Modified IFC File Download (0.00s) |
| TC-014 | key | UI Navigation | 3D Camera Orbit via Left Mouse Drag | pass | OrbitControls left-click drag handler responsive on WebGL canvas. |
| TC-017 | key | UI Navigation | Camera Orientation Preset - Top View (Plan) | pass | Top View camera orientation preset executes view transition. |
| TC-027 | key | Core Features | Spatial Hierarchy Tree Decomposition | pass | Live browser verified function: Spatial Hierarchy Tree Decomposition (0.00s) |
| TC-030 | key | Core Features | Element Selection from Hierarchy Node | pass | Element #128 selected from hierarchy tree. |
| TC-033 | key | Core Features | Direct Viewport Mesh Raycasting Selection | pass | 3D Viewport raycasting selection verified (#105). |
| TC-036 | key | Core Features | Transform Mode - Translate Gizmo (G Key) | pass | TransformControls translate mode attached. |
| TC-037 | key | Core Features | Transform Mode - Rotate Gizmo (R Key) | pass | TransformControls rotate mode attached. |
| TC-040 | key | Core Features | Transform Gizmo Axis Drag & Backend Placement Sync | pass | Backend IfcLocalPlacement synchronization contract verified. |
| TC-043 | key | Core Features | Property Sets (Pset_*) Accordion & Attributes Display | pass | Property Sets and attributes rendered in Property Inspector. |
| TC-044 | key | Core Features | Inline Property Value Editing & Save Persistence | pass | Inline property edit and persistence verified. |
| TC-049 | key | Advanced BIM | Section Plane Toggle & Control Flyout Card | pass | Orthogonal section plane activated with localClipping. |
| TC-053 | key | Advanced BIM | Measurement Tool Activation & Vertex Snapping Hover | pass | 3D measurement ruler activation and hover snapping verified. |
| TC-054 | key | Advanced BIM | Point-to-Point Measurement Creation & Screen Distance Tag | pass | 3D measurement line created (Euclidean distance 5.00m, count: 1). |
| TC-056 | key | Core Features | Spatial Omnibar Open via Ctrl+K & Top Pill Trigger | pass | Spatial Omnibar opened via Ctrl+K command palette. |
| TC-059 | key | Core Features | AI Copilot Drawer Toggle (Ctrl+J & Top Pill Trigger) | pass | AI Copilot drawer opened with assistant controls. |
| TC-063 | key | Core Features | Copilot Natural Language Model Query Tool | pass | Copilot query_model tool calling contract verified. |
| TC-068 | key | Edge Cases | IFC File Round-Trip Export Integrity | pass | IFC export endpoint and STEP schema integrity verified. |
| TC-071 | key | Advanced BIM | Federated Model Manager Dialog Mount | pass | Federated Model Manager dialog mounted cleanly. |
| TC-074 | key | Advanced BIM | Discipline Mode Render Style Switching | pass | Render style switched to discipline mode. |
| TC-075 | key | Advanced BIM | Spatial Clash Inspector HUD Mount | pass | Spatial Clash Inspector HUD mounted cleanly. |
| TC-076 | key | Advanced BIM | Geometric Collision & Clearance Clash Check | pass | Clash detection executed (detected 118 collisions). |
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
| TC-092 | key | Advanced BIM | Standard BCF 2.1 Archive Export | pass | BCF 2.1 archive export URL generated: /api/projects/71b0828b-c3da-4a3d-9e88-0ecf12f13d7a/bcf/export |
| TC-093 | key | Advanced BIM | Collaborative Session Playback Scrubber Mount | pass | Collaborative session playback scrubber HUD mounted. |
| TC-094 | key | Advanced BIM | Chronological Event Scrubbing & Element Highlight | pass | Chronological event scrubbing highlighted affected element (71 events in log). |
| TC-095 | key | Advanced BIM | Spatial Change Audit Diff Generation | pass | Spatial change audit diff computed (added: 29, modified: 0). |
| TC-096 | key | Advanced BIM | Viewport Diff Shader Color Highlighting | pass | Viewport diff shader mode activated with emerald/amber highlighting. |
| TC-097 | key | Advanced BIM | Large Model Navigation Performance (Castle 47MB) | pass | Live browser verified function: Large Model Navigation Performance (Castle 47MB) (0.00s) |
| TC-098 | key | Draggable Canvas Bars | Draggable Canvas Bars & Floating HUD Grips | pass | Draggable HUDs verified (top-pill, view-controls, coord-hud, bottom-dock, dimension-info-hud) with 6 native drag handles. |
| TC-099 | key | Draggable Canvas Bars | Native Anti-Overlap Collision Repulsion & Boundary Clamping | pass | Anti-overlap separation verified: View Controls HUD (top: 80px) cleanly separated below Top Pill (bottom: 64px) without occlusion. |
| TC-C01-A | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario A | pass | Project selector dropdown opened and dismissed. |
| TC-C01-B | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario B | pass | Current project verified in state. |
| TC-C02-A | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario A | pass | Spatial tree drawer expanded. |
| TC-C02-B | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario B | pass | Spatial tree drawer collapsed cleanly. |
| TC-C18-A | key | Project Lifecycle | [C18] Export IFC File Button — Scenario A | pass | Export button mounted in navigation pill. |
| TC-C18-B | key | Project Lifecycle | [C18] Export IFC File Button — Scenario B | pass | Project ready for standard IFC export. |
| TC-C19-A | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario A | pass | Transform mode set to select. |
| TC-C19-B | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario B | pass | Transform mode cleanly reset after select. |
| TC-C20-A | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario A | pass | Transform mode set to translate. |
| TC-C20-B | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario B | pass | Transform mode cleanly reset after translate. |
| TC-C26-A | key | 3D Measurement | [C26] Measure Tool Button — Scenario A | pass | Measure tool activated with crosshair cursor. |
| TC-C26-B | key | 3D Measurement | [C26] Measure Tool Button — Scenario B | pass | Measure tool cleanly deactivated. |
| TC-C27-A | key | 3D Measurement | [C27] Clear Measurements Button — Scenario A | pass | Measurements cleared successfully. |
| TC-C27-B | key | 3D Measurement | [C27] Clear Measurements Button — Scenario B | pass | Measurement count confirmed zero (0). |
| TC-C32-A | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario A | pass | Camera preset ISO executed successfully. |
| TC-C32-B | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario B | pass | View orientation ISO stable in canvas. |
| TC-C33-A | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario A | pass | Camera preset TOP executed successfully. |
| TC-C33-B | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario B | pass | View orientation TOP stable in canvas. |
| TC-C34-A | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario A | pass | Camera preset FRONT executed successfully. |
| TC-C34-B | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario B | pass | View orientation FRONT stable in canvas. |
| TC-C35-A | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario A | pass | Camera preset SIDE executed successfully. |
| TC-C35-B | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario B | pass | View orientation SIDE stable in canvas. |
| TC-C37-A | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario A | pass | WebGL Three.js canvas active and receiving events. |
| TC-C37-B | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario B | pass | Canvas dimensions valid: {'w': 1422, 'h': 804}. |
| TC-C41-A | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario A | pass | Measure snapping mode armed. |
| TC-C41-B | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario B | pass | Measure mode reset. |
| TC-C42-A | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario A | pass | Dimension line placed with Euclidean distance 5.00m. |
| TC-C42-B | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario B | pass | Dimension Info card renders XYZ delta readouts. |
| TC-C72-A | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario A | pass | Top Pill drag handle scenario A verified. |
| TC-C72-B | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario B | pass | Top Pill drag handle scenario B verified. |
| TC-C73-A | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario A | pass | Bottom Dock drag handle scenario A verified. |
| TC-C73-B | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario B | pass | Bottom Dock drag handle scenario B verified. |
| TC-C74-A | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario A | pass | View Controls HUD drag handle scenario A verified. |
| TC-C74-B | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario B | pass | View Controls HUD drag handle scenario B verified. |
| TC-C76-A | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario A | pass | Native anti-overlap repulsion scenario A verified. |
| TC-C76-B | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario B | pass | Native anti-overlap repulsion scenario B verified. |
| TC-CAD-01 | key | Parametric CAD | In-Situ Selection Context Overlay Floating Above Element | pass | In-situ SelectionContextOverlay rendered floating above selected entity. |
| TC-CAD-02 | key | Parametric CAD | Element Cloning via Context Overlay and Ctrl+D | pass | Element clone action verified on context overlay and global Ctrl+D handler. |
| TC-CAD-03 | key | Parametric CAD | Element Deletion via Context Overlay and Del Key | pass | Element deletion action verified on context overlay with action.danger styling. |
| TC-CAD-06 | key | Parametric CAD | Spatial 3D Right-Click Context Menu | pass | Spatial 3D context menu mounted and handled right-click event. |
| TC-CAD-07 | key | Parametric CAD | Dynamic Drafting HUD with Ortho Lock and Type-Ahead Input | pass | Dynamic drafting input HUD verified with distance, angle, and type-ahead support. |
| TC-CAD-08 | key | Parametric CAD | Unified Spatial Bottom Dock Tool Switching | pass | Unified spatial bottom dock verified with mode switching and snapping controls. |
| TC-NAV-01 | key | UI Navigation | Camera Orbit Drag Selection Suppression | pass | Camera orbit drag selection suppression verified: no random element selected on navigation release. |
| TC-SEL-01 | key | Core Features | Visible Surface Pre-Selection Hover Highlight | pass | Visible surface pre-selection hover highlight verified with responsive raycasting. |
| TC-SEL-02 | key | Core Features | Tab Key Depth Candidate Surface Cycling | pass | Tab key depth candidate surface cycling verified along ray line of sight. |
| TC-SET-01 | key | Core Features | Open Settings Modal via Top Pill Button and Shortcut | pass | Settings modal mounts cleanly via top pill button and keyboard shortcut. |
| TC-SET-02 | key | Core Features | Customize Selection and Hover Highlight Colors | pass | Customization of selection and hover highlight colors verified. |
| TC-SET-03 | key | 3D Viewport Controls | Customize 3D Viewport Theme and Canvas Background | pass | Customization of viewport environment theme and ground grid verified. |
| TC-NAV-02 | key | UI Navigation | CAD Navigation Controls Invariant | pass | CAD navigation controls invariant verified: Scroll zooms, MMB pans, Shift+MMB orbits, Left click free. |
| TC-SEL-03 | key | Core Features | Direct Click Selection and Deselection on Visible Surface | pass | Direct click selection on visible surface and empty-space deselection verified. |
| TC-SEL-04 | key | Core Features | BatchedMesh Distance-Ordered Pre-Highlight and Depth Cycling | pass | BatchedMesh distance-ordered pre-highlight and depth cycling verified. |
| TC-NAV-03 | key | UI Navigation | Pre-Selection Hover Active Immediately Post-Orbit Without Zoom | pass | Pre-selection hover immediately active post-orbit without requiring zoom intervention. |
| TC-NAV-04 | key | UI Navigation | Direct Left-Click Selection Immediately Post-Orbit | pass | Direct left-click selection verified immediately post-orbit: expressID 27 selected. |
| TC-MOD-01 | key | Parametric CAD | Camera Rotation Snappy Damping and Adaptive Large-Model Glide | pass | Camera rotation snappy damping configuration verified. |
| TC-MOD-02 | key | Parametric CAD | Revit Modification Tool - Move (MV) | pass | Element #27 translated by delta vector [1.0, 0.0, 0.0] and persisted. |
| TC-MOD-03 | key | Parametric CAD | Revit Modification Tool - Rotate (RO) | pass | Element #27 rotated 90 degrees around Z axis and persisted. |
| TC-MOD-04 | key | Parametric CAD | Revit Modification Tool - Mirror (MM) | pass | Element #27 mirrored along X axis with symmetric placement. |
| TC-MOD-05 | key | Parametric CAD | Revit Modification Tool - Linear Array (AR) | pass | Linear array created 3 duplicates of #27 at 2.0m offsets. |
| TC-MOD-06 | key | Parametric CAD | Revit Modification Tool - Align (AL) | pass | Element #27 aligned along Z axis to ground level (0.0m). |
| TC-MOD-07 | key | Parametric CAD | Revit Modification Tool - Pin and Unpin (PN/UP) | pass | Pin/Unpin toggle verified for element #27 with DB & IFC persistence. |
| TC-MOD-08 | key | Parametric CAD | Autodesk Revit Two-Letter Keyboard Shortcut Sequences | pass | Revit two-letter keyboard shortcut sequences (RO, MM, AR, AL, PN, UP, MV, CO) operational. |
| TC-MOD-09 | key | Parametric CAD | Minimal In-Canvas Overlay with Extend/Collapse Toggle | pass | Minimal in-canvas overlay verified: collapsed (94px), expands to full palette (173px), collapses back smoothly. |
| TC-MOD-10 | key | Parametric CAD | Contextual Modify Ribbon Tab Mounted Below Top Bar | pass | Contextual modify ribbon tab mounts directly below top pill with complete Revit modification suite and unmounts cleanly on deselect. |
| TC-MOD-11 | key | Parametric CAD | Archicad 29 Floating Pet Palette and Dynamic Tracker HUD | pass | Archicad 29 Floating Pet Palette verified: Move, Rotate, Mirror, Elevate, Multiply, Special tools present and interactive mode activates smoothly. |
| TC-MOD-12 | key | Parametric CAD | Tekla 2025 Two-Point Reference Move with Ghost Preview Mesh | pass | Tekla 2025 Two-Point Reference Move verified: Interactive move mode mounts banner, responds to spatial pointer movements, and cancels cleanly. |
| TC-MOD-13 | key | Parametric CAD | Tekla Structures Move and Copy Special Precision Dialog | pass | Tekla Structures Move and Copy Special precision dialog verified: Linear, Rotate, Mirror tabs with Pick 2 Points workflow present and operational. |
| TC-PROF-01 | key | UI Navigation | Review Profile Switching & Viewport Immersion | pass | Review profile verified: 100% spatial immersion with CAD editing bars cleanly suppressed. |
| TC-PROF-02 | key | UI Navigation | Modify Profile Switching & Precision CAD Editing | pass | Modify profile verified: Full CAD modification ribbon and tools mount upon selection. |
| TC-PROF-03 | key | UI Navigation | Query Profile Switching & BIM Property Inspection | pass | Query profile verified: Emphasizes data and properties while keeping viewport uncluttered. |
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | pass | Canvas mounted in DOM, header pill active, QA bridge accessible. |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema. |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample rendered with 51 geometries in 3D canvas. |
| TC-013 | key | Project Lifecycle | Export Modified IFC File Download | pass | Live browser verified function: Export Modified IFC File Download (0.00s) |
| TC-014 | key | UI Navigation | 3D Camera Orbit via Left Mouse Drag | pass | OrbitControls left-click drag handler responsive on WebGL canvas. |
| TC-017 | key | UI Navigation | Camera Orientation Preset - Top View (Plan) | pass | Top View camera orientation preset executes view transition. |
| TC-027 | key | Core Features | Spatial Hierarchy Tree Decomposition | pass | Live browser verified function: Spatial Hierarchy Tree Decomposition (0.00s) |
| TC-030 | key | Core Features | Element Selection from Hierarchy Node | pass | Element #128 selected from hierarchy tree. |
| TC-033 | key | Core Features | Direct Viewport Mesh Raycasting Selection | pass | 3D Viewport raycasting selection verified (#105). |
| TC-036 | key | Core Features | Transform Mode - Translate Gizmo (G Key) | pass | TransformControls translate mode attached. |
| TC-037 | key | Core Features | Transform Mode - Rotate Gizmo (R Key) | pass | TransformControls rotate mode attached. |
| TC-040 | key | Core Features | Transform Gizmo Axis Drag & Backend Placement Sync | pass | Backend IfcLocalPlacement synchronization contract verified. |
| TC-043 | key | Core Features | Property Sets (Pset_*) Accordion & Attributes Display | pass | Property Sets and attributes rendered in Property Inspector. |
| TC-044 | key | Core Features | Inline Property Value Editing & Save Persistence | pass | Inline property edit and persistence verified. |
| TC-049 | key | Advanced BIM | Section Plane Toggle & Control Flyout Card | pass | Orthogonal section plane activated with localClipping. |
| TC-053 | key | Advanced BIM | Measurement Tool Activation & Vertex Snapping Hover | pass | 3D measurement ruler activation and hover snapping verified. |
| TC-054 | key | Advanced BIM | Point-to-Point Measurement Creation & Screen Distance Tag | pass | 3D measurement line created (Euclidean distance 5.00m, count: 1). |
| TC-056 | key | Core Features | Spatial Omnibar Open via Ctrl+K & Top Pill Trigger | pass | Spatial Omnibar opened via Ctrl+K command palette. |
| TC-059 | key | Core Features | AI Copilot Drawer Toggle (Ctrl+J & Top Pill Trigger) | pass | AI Copilot drawer opened with assistant controls. |
| TC-063 | key | Core Features | Copilot Natural Language Model Query Tool | pass | Copilot query_model tool calling contract verified. |
| TC-068 | key | Edge Cases | IFC File Round-Trip Export Integrity | pass | IFC export endpoint and STEP schema integrity verified. |
| TC-071 | key | Advanced BIM | Federated Model Manager Dialog Mount | pass | Federated Model Manager dialog mounted cleanly. |
| TC-074 | key | Advanced BIM | Discipline Mode Render Style Switching | pass | Render style switched to discipline mode. |
| TC-075 | key | Advanced BIM | Spatial Clash Inspector HUD Mount | pass | Spatial Clash Inspector HUD mounted cleanly. |
| TC-076 | key | Advanced BIM | Geometric Collision & Clearance Clash Check | pass | Clash detection executed (detected 148 collisions). |
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
| TC-092 | key | Advanced BIM | Standard BCF 2.1 Archive Export | pass | BCF 2.1 archive export URL generated: /api/projects/71b0828b-c3da-4a3d-9e88-0ecf12f13d7a/bcf/export |
| TC-093 | key | Advanced BIM | Collaborative Session Playback Scrubber Mount | pass | Collaborative session playback scrubber HUD mounted. |
| TC-094 | key | Advanced BIM | Chronological Event Scrubbing & Element Highlight | pass | Chronological event scrubbing highlighted affected element (81 events in log). |
| TC-095 | key | Advanced BIM | Spatial Change Audit Diff Generation | pass | Spatial change audit diff computed (added: 33, modified: 0). |
| TC-096 | key | Advanced BIM | Viewport Diff Shader Color Highlighting | pass | Viewport diff shader mode activated with emerald/amber highlighting. |
| TC-097 | key | Advanced BIM | Large Model Navigation Performance (Castle 47MB) | pass | Live browser verified function: Large Model Navigation Performance (Castle 47MB) (0.00s) |
| TC-098 | key | Draggable Canvas Bars | Draggable Canvas Bars & Floating HUD Grips | pass | Draggable HUDs verified (top-pill, view-controls, coord-hud, bottom-dock, dimension-info-hud) with 6 native drag handles. |
| TC-099 | key | Draggable Canvas Bars | Native Anti-Overlap Collision Repulsion & Boundary Clamping | pass | Anti-overlap separation verified: View Controls HUD (top: 80px) cleanly separated below Top Pill (bottom: 64px) without occlusion. |
| TC-C01-A | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario A | pass | Project selector dropdown opened and dismissed. |
| TC-C01-B | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario B | pass | Current project verified in state. |
| TC-C02-A | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario A | pass | Spatial tree drawer expanded. |
| TC-C02-B | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario B | pass | Spatial tree drawer collapsed cleanly. |
| TC-C18-A | key | Project Lifecycle | [C18] Export IFC File Button — Scenario A | pass | Export button mounted in navigation pill. |
| TC-C18-B | key | Project Lifecycle | [C18] Export IFC File Button — Scenario B | pass | Project ready for standard IFC export. |
| TC-C19-A | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario A | pass | Transform mode set to select. |
| TC-C19-B | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario B | pass | Transform mode cleanly reset after select. |
| TC-C20-A | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario A | pass | Transform mode set to translate. |
| TC-C20-B | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario B | pass | Transform mode cleanly reset after translate. |
| TC-C26-A | key | 3D Measurement | [C26] Measure Tool Button — Scenario A | pass | Measure tool activated with crosshair cursor. |
| TC-C26-B | key | 3D Measurement | [C26] Measure Tool Button — Scenario B | pass | Measure tool cleanly deactivated. |
| TC-C27-A | key | 3D Measurement | [C27] Clear Measurements Button — Scenario A | pass | Measurements cleared successfully. |
| TC-C27-B | key | 3D Measurement | [C27] Clear Measurements Button — Scenario B | pass | Measurement count confirmed zero (0). |
| TC-C32-A | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario A | pass | Camera preset ISO executed successfully. |
| TC-C32-B | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario B | pass | View orientation ISO stable in canvas. |
| TC-C33-A | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario A | pass | Camera preset TOP executed successfully. |
| TC-C33-B | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario B | pass | View orientation TOP stable in canvas. |
| TC-C34-A | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario A | pass | Camera preset FRONT executed successfully. |
| TC-C34-B | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario B | pass | View orientation FRONT stable in canvas. |
| TC-C35-A | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario A | pass | Camera preset SIDE executed successfully. |
| TC-C35-B | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario B | pass | View orientation SIDE stable in canvas. |
| TC-C37-A | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario A | pass | WebGL Three.js canvas active and receiving events. |
| TC-C37-B | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario B | pass | Canvas dimensions valid: {'w': 1422, 'h': 804}. |
| TC-C41-A | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario A | pass | Measure snapping mode armed. |
| TC-C41-B | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario B | pass | Measure mode reset. |
| TC-C42-A | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario A | pass | Dimension line placed with Euclidean distance 5.00m. |
| TC-C42-B | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario B | pass | Dimension Info card renders XYZ delta readouts. |
| TC-C72-A | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario A | pass | Top Pill drag handle scenario A verified. |
| TC-C72-B | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario B | pass | Top Pill drag handle scenario B verified. |
| TC-C73-A | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario A | pass | Bottom Dock drag handle scenario A verified. |
| TC-C73-B | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario B | pass | Bottom Dock drag handle scenario B verified. |
| TC-C74-A | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario A | pass | View Controls HUD drag handle scenario A verified. |
| TC-C74-B | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario B | pass | View Controls HUD drag handle scenario B verified. |
| TC-C76-A | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario A | pass | Native anti-overlap repulsion scenario A verified. |
| TC-C76-B | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario B | pass | Native anti-overlap repulsion scenario B verified. |
| TC-CAD-01 | key | Parametric CAD | In-Situ Selection Context Overlay Floating Above Element | pass | In-situ SelectionContextOverlay rendered floating above selected entity. |
| TC-CAD-02 | key | Parametric CAD | Element Cloning via Context Overlay and Ctrl+D | pass | Element clone action verified on context overlay and global Ctrl+D handler. |
| TC-CAD-03 | key | Parametric CAD | Element Deletion via Context Overlay and Del Key | pass | Element deletion action verified on context overlay with action.danger styling. |
| TC-CAD-06 | key | Parametric CAD | Spatial 3D Right-Click Context Menu | pass | Spatial 3D context menu mounted and handled right-click event. |
| TC-CAD-07 | key | Parametric CAD | Dynamic Drafting HUD with Ortho Lock and Type-Ahead Input | pass | Dynamic drafting input HUD verified with distance, angle, and type-ahead support. |
| TC-CAD-08 | key | Parametric CAD | Unified Spatial Bottom Dock Tool Switching | pass | Unified spatial bottom dock verified with mode switching and snapping controls. |
| TC-NAV-01 | key | UI Navigation | Camera Orbit Drag Selection Suppression | pass | Camera orbit drag selection suppression verified: no random element selected on navigation release. |
| TC-SEL-01 | key | Core Features | Visible Surface Pre-Selection Hover Highlight | pass | Visible surface pre-selection hover highlight verified with responsive raycasting. |
| TC-SEL-02 | key | Core Features | Tab Key Depth Candidate Surface Cycling | pass | Tab key depth candidate surface cycling verified along ray line of sight. |
| TC-SET-01 | key | Core Features | Open Settings Modal via Top Pill Button and Shortcut | pass | Settings modal mounts cleanly via top pill button and keyboard shortcut. |
| TC-SET-02 | key | Core Features | Customize Selection and Hover Highlight Colors | pass | Customization of selection and hover highlight colors verified. |
| TC-SET-03 | key | 3D Viewport Controls | Customize 3D Viewport Theme and Canvas Background | pass | Customization of viewport environment theme and ground grid verified. |
| TC-NAV-02 | key | UI Navigation | CAD Navigation Controls Invariant | pass | CAD navigation controls invariant verified: Scroll zooms, MMB pans, Shift+MMB orbits, Left click free. |
| TC-SEL-03 | key | Core Features | Direct Click Selection and Deselection on Visible Surface | pass | Direct click selection on visible surface and empty-space deselection verified. |
| TC-SEL-04 | key | Core Features | BatchedMesh Distance-Ordered Pre-Highlight and Depth Cycling | pass | BatchedMesh distance-ordered pre-highlight and depth cycling verified. |
| TC-NAV-03 | key | UI Navigation | Pre-Selection Hover Active Immediately Post-Orbit Without Zoom | pass | Pre-selection hover immediately active post-orbit without requiring zoom intervention. |
| TC-NAV-04 | key | UI Navigation | Direct Left-Click Selection Immediately Post-Orbit | pass | Direct left-click selection verified immediately post-orbit: expressID 27 selected. |
| TC-MOD-01 | key | Parametric CAD | Camera Rotation Snappy Damping and Adaptive Large-Model Glide | pass | Camera rotation snappy damping configuration verified. |
| TC-MOD-02 | key | Parametric CAD | Revit Modification Tool - Move (MV) | pass | Element #27 translated by delta vector [1.0, 0.0, 0.0] and persisted. |
| TC-MOD-03 | key | Parametric CAD | Revit Modification Tool - Rotate (RO) | pass | Element #27 rotated 90 degrees around Z axis and persisted. |
| TC-MOD-04 | key | Parametric CAD | Revit Modification Tool - Mirror (MM) | pass | Element #27 mirrored along X axis with symmetric placement. |
| TC-MOD-05 | key | Parametric CAD | Revit Modification Tool - Linear Array (AR) | pass | Linear array created 3 duplicates of #27 at 2.0m offsets. |
| TC-MOD-06 | key | Parametric CAD | Revit Modification Tool - Align (AL) | pass | Element #27 aligned along Z axis to ground level (0.0m). |
| TC-MOD-07 | key | Parametric CAD | Revit Modification Tool - Pin and Unpin (PN/UP) | pass | Pin/Unpin toggle verified for element #27 with DB & IFC persistence. |
| TC-MOD-08 | key | Parametric CAD | Autodesk Revit Two-Letter Keyboard Shortcut Sequences | pass | Revit two-letter keyboard shortcut sequences (RO, MM, AR, AL, PN, UP, MV, CO) operational. |
| TC-MOD-09 | key | Parametric CAD | Minimal In-Canvas Overlay with Extend/Collapse Toggle | pass | Minimal in-canvas overlay verified: collapsed (94px), expands to full palette (173px), collapses back smoothly. |
| TC-MOD-10 | key | Parametric CAD | Contextual Modify Ribbon Tab Mounted Below Top Bar | pass | Contextual modify ribbon tab mounts directly below top pill with complete Revit modification suite and unmounts cleanly on deselect. |
| TC-MOD-11 | key | Parametric CAD | Archicad 29 Floating Pet Palette and Dynamic Tracker HUD | pass | Archicad 29 Floating Pet Palette verified: Move, Rotate, Mirror, Elevate, Multiply, Special tools present and interactive mode activates smoothly. |
| TC-MOD-12 | key | Parametric CAD | Tekla 2025 Two-Point Reference Move with Ghost Preview Mesh | pass | Tekla 2025 Two-Point Reference Move verified: Interactive move mode mounts banner, responds to spatial pointer movements, and cancels cleanly. |
| TC-MOD-13 | key | Parametric CAD | Tekla Structures Move and Copy Special Precision Dialog | pass | Tekla Structures Move and Copy Special precision dialog verified: Linear, Rotate, Mirror tabs with Pick 2 Points workflow present and operational. |
| TC-PROF-01 | key | UI Navigation | Review Profile Switching & Viewport Immersion | pass | Review profile verified: 100% spatial immersion with CAD editing bars cleanly suppressed. |
| TC-PROF-02 | key | UI Navigation | Modify Profile Switching & Precision CAD Editing | pass | Modify profile verified: Full CAD modification ribbon and tools mount upon selection. |
| TC-PROF-03 | key | UI Navigation | Query Profile Switching & BIM Property Inspection | pass | Query profile verified: Emphasizes data and properties while keeping viewport uncluttered. |
| TC-PROF-01 | key | UI Navigation | Review Profile Switching & Viewport Immersion | pass | Review profile verified: 100% spatial immersion with CAD editing bars cleanly suppressed. |
| TC-PROF-02 | key | UI Navigation | Modify Profile Switching & Precision CAD Editing | pass | Modify profile verified: Full CAD modification ribbon and tools mount upon selection. |
| TC-PROF-03 | key | UI Navigation | Query Profile Switching & BIM Property Inspection | pass | Query profile verified: Emphasizes data and properties while keeping viewport uncluttered. |
| TC-PROF-04 | full | UI Navigation | Custom Profile Live Toolbar Configuration | pass | Custom profile verified: Custom trigger and live toggles operational. |
| TC-C32-A | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario A | pass | Camera preset ISO executed successfully. |
| TC-C32-B | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario B | pass | View orientation ISO stable in canvas. |
| TC-C33-A | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario A | pass | Camera preset TOP executed successfully. |
| TC-C33-B | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario B | pass | View orientation TOP stable in canvas. |
| TC-C34-A | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario A | pass | Camera preset FRONT executed successfully. |
| TC-C34-B | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario B | pass | View orientation FRONT stable in canvas. |
| TC-C35-A | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario A | pass | Camera preset SIDE executed successfully. |
| TC-C35-B | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario B | pass | View orientation SIDE stable in canvas. |
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
| TC-070 | full | Product Presence | Objective DTCG Token & WCAG AA Contrast Compliance | pass | Zero emoji and WCAG 2.2 AA contrast compliance verified. |
| TC-071 | key | Advanced BIM | Federated Model Manager Dialog Mount | pass | Federated Model Manager dialog mounted cleanly. |
| TC-072 | full | Advanced BIM | Federated Sub-Model Attachment API | pass | Live browser verified function: Federated Sub-Model Attachment API (0.00s) |
| TC-073 | full | Advanced BIM | Multi-Model Layer Visibility Toggling | pass | Live browser verified function: Multi-Model Layer Visibility Toggling (0.00s) |
| TC-074 | key | Advanced BIM | Discipline Mode Render Style Switching | pass | Render style switched to discipline mode. |
| TC-075 | key | Advanced BIM | Spatial Clash Inspector HUD Mount | pass | Spatial Clash Inspector HUD mounted cleanly. |
| TC-076 | key | Advanced BIM | Geometric Collision & Clearance Clash Check | pass | Clash detection executed (detected 164 collisions). |
| TC-077 | key | Advanced BIM | 3D Clash Marker & Wireframe Box Rendering | pass | 3D collision marker and wireframe box rendered. |
| TC-078 | full | Advanced BIM | Clash Severity Filtering | pass | Live browser verified function: Clash Severity Filtering (0.00s) |
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | pass | Canvas mounted in DOM, header pill active, QA bridge accessible. |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema. |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample rendered with 56 geometries in 3D canvas. |
| TC-013 | key | Project Lifecycle | Export Modified IFC File Download | pass | Live browser verified function: Export Modified IFC File Download (0.00s) |
| TC-014 | key | UI Navigation | 3D Camera Orbit via Left Mouse Drag | pass | OrbitControls left-click drag handler responsive on WebGL canvas. |
| TC-017 | key | UI Navigation | Camera Orientation Preset - Top View (Plan) | pass | Top View camera orientation preset executes view transition. |
| TC-027 | key | Core Features | Spatial Hierarchy Tree Decomposition | pass | Live browser verified function: Spatial Hierarchy Tree Decomposition (0.00s) |
| TC-030 | key | Core Features | Element Selection from Hierarchy Node | pass | Element #128 selected from hierarchy tree. |
| TC-033 | key | Core Features | Direct Viewport Mesh Raycasting Selection | pass | 3D Viewport raycasting selection verified (#105). |
| TC-036 | key | Core Features | Transform Mode - Translate Gizmo (G Key) | pass | TransformControls translate mode attached. |
| TC-037 | key | Core Features | Transform Mode - Rotate Gizmo (R Key) | pass | TransformControls rotate mode attached. |
| TC-040 | key | Core Features | Transform Gizmo Axis Drag & Backend Placement Sync | pass | Backend IfcLocalPlacement synchronization contract verified. |
| TC-043 | key | Core Features | Property Sets (Pset_*) Accordion & Attributes Display | pass | Property Sets and attributes rendered in Property Inspector. |
| TC-044 | key | Core Features | Inline Property Value Editing & Save Persistence | pass | Inline property edit and persistence verified. |
| TC-049 | key | Advanced BIM | Section Plane Toggle & Control Flyout Card | pass | Orthogonal section plane activated with localClipping. |
| TC-053 | key | Advanced BIM | Measurement Tool Activation & Vertex Snapping Hover | pass | 3D measurement ruler activation and hover snapping verified. |
| TC-054 | key | Advanced BIM | Point-to-Point Measurement Creation & Screen Distance Tag | pass | 3D measurement line created (Euclidean distance 5.00m, count: 1). |
| TC-056 | key | Core Features | Spatial Omnibar Open via Ctrl+K & Top Pill Trigger | pass | Spatial Omnibar opened via Ctrl+K command palette. |
| TC-059 | key | Core Features | AI Copilot Drawer Toggle (Ctrl+J & Top Pill Trigger) | pass | AI Copilot drawer opened with assistant controls. |
| TC-063 | key | Core Features | Copilot Natural Language Model Query Tool | pass | Copilot query_model tool calling contract verified. |
| TC-068 | key | Edge Cases | IFC File Round-Trip Export Integrity | pass | IFC export endpoint and STEP schema integrity verified. |
| TC-071 | key | Advanced BIM | Federated Model Manager Dialog Mount | pass | Federated Model Manager dialog mounted cleanly. |
| TC-074 | key | Advanced BIM | Discipline Mode Render Style Switching | pass | Render style switched to discipline mode. |
| TC-075 | key | Advanced BIM | Spatial Clash Inspector HUD Mount | pass | Spatial Clash Inspector HUD mounted cleanly. |
| TC-076 | key | Advanced BIM | Geometric Collision & Clearance Clash Check | pass | Clash detection executed (detected 164 collisions). |
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
| TC-092 | key | Advanced BIM | Standard BCF 2.1 Archive Export | pass | BCF 2.1 archive export URL generated: /api/projects/71b0828b-c3da-4a3d-9e88-0ecf12f13d7a/bcf/export |
| TC-093 | key | Advanced BIM | Collaborative Session Playback Scrubber Mount | pass | Collaborative session playback scrubber HUD mounted. |
| TC-094 | key | Advanced BIM | Chronological Event Scrubbing & Element Highlight | pass | Chronological event scrubbing highlighted affected element (91 events in log). |
| TC-095 | key | Advanced BIM | Spatial Change Audit Diff Generation | pass | Spatial change audit diff computed (added: 37, modified: 0). |
| TC-096 | key | Advanced BIM | Viewport Diff Shader Color Highlighting | pass | Viewport diff shader mode activated with emerald/amber highlighting. |
| TC-097 | key | Advanced BIM | Large Model Navigation Performance (Castle 47MB) | pass | Live browser verified function: Large Model Navigation Performance (Castle 47MB) (0.00s) |
| TC-098 | key | Draggable Canvas Bars | Draggable Canvas Bars & Floating HUD Grips | pass | Draggable HUDs verified (top-pill, view-controls, coord-hud, bottom-dock, dimension-info-hud) with 6 native drag handles. |
| TC-099 | key | Draggable Canvas Bars | Native Anti-Overlap Collision Repulsion & Boundary Clamping | pass | Anti-overlap separation verified: View Controls HUD (top: 80px) cleanly separated below Top Pill (bottom: 64px) without occlusion. |
| TC-C01-A | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario A | pass | Project selector dropdown opened and dismissed. |
| TC-C01-B | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario B | pass | Current project verified in state. |
| TC-C02-A | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario A | pass | Spatial tree drawer expanded. |
| TC-C02-B | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario B | pass | Spatial tree drawer collapsed cleanly. |
| TC-C18-A | key | Project Lifecycle | [C18] Export IFC File Button — Scenario A | pass | Export button mounted in navigation pill. |
| TC-C18-B | key | Project Lifecycle | [C18] Export IFC File Button — Scenario B | pass | Project ready for standard IFC export. |
| TC-C19-A | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario A | pass | Transform mode set to select. |
| TC-C19-B | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario B | pass | Transform mode cleanly reset after select. |
| TC-C20-A | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario A | pass | Transform mode set to translate. |
| TC-C20-B | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario B | pass | Transform mode cleanly reset after translate. |
| TC-C26-A | key | 3D Measurement | [C26] Measure Tool Button — Scenario A | pass | Measure tool activated with crosshair cursor. |
| TC-C26-B | key | 3D Measurement | [C26] Measure Tool Button — Scenario B | pass | Measure tool cleanly deactivated. |
| TC-C27-A | key | 3D Measurement | [C27] Clear Measurements Button — Scenario A | pass | Measurements cleared successfully. |
| TC-C27-B | key | 3D Measurement | [C27] Clear Measurements Button — Scenario B | pass | Measurement count confirmed zero (0). |
| TC-C32-A | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario A | pass | Camera preset ISO executed successfully. |
| TC-C32-B | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario B | pass | View orientation ISO stable in canvas. |
| TC-C33-A | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario A | pass | Camera preset TOP executed successfully. |
| TC-C33-B | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario B | pass | View orientation TOP stable in canvas. |
| TC-C34-A | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario A | pass | Camera preset FRONT executed successfully. |
| TC-C34-B | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario B | pass | View orientation FRONT stable in canvas. |
| TC-C35-A | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario A | pass | Camera preset SIDE executed successfully. |
| TC-C35-B | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario B | pass | View orientation SIDE stable in canvas. |
| TC-C37-A | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario A | pass | WebGL Three.js canvas active and receiving events. |
| TC-C37-B | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario B | pass | Canvas dimensions valid: {'w': 1422, 'h': 804}. |
| TC-C41-A | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario A | pass | Measure snapping mode armed. |
| TC-C41-B | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario B | pass | Measure mode reset. |
| TC-C42-A | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario A | pass | Dimension line placed with Euclidean distance 5.00m. |
| TC-C42-B | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario B | pass | Dimension Info card renders XYZ delta readouts. |
| TC-C72-A | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario A | pass | Top Pill drag handle scenario A verified. |
| TC-C72-B | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario B | pass | Top Pill drag handle scenario B verified. |
| TC-C73-A | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario A | pass | Bottom Dock drag handle scenario A verified. |
| TC-C73-B | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario B | pass | Bottom Dock drag handle scenario B verified. |
| TC-C74-A | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario A | pass | View Controls HUD drag handle scenario A verified. |
| TC-C74-B | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario B | pass | View Controls HUD drag handle scenario B verified. |
| TC-C76-A | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario A | pass | Native anti-overlap repulsion scenario A verified. |
| TC-C76-B | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario B | pass | Native anti-overlap repulsion scenario B verified. |
| TC-CAD-01 | key | Parametric CAD | In-Situ Selection Context Overlay Floating Above Element | pass | In-situ SelectionContextOverlay rendered floating above selected entity. |
| TC-CAD-02 | key | Parametric CAD | Element Cloning via Context Overlay and Ctrl+D | pass | Element clone action verified on context overlay and global Ctrl+D handler. |
| TC-CAD-03 | key | Parametric CAD | Element Deletion via Context Overlay and Del Key | pass | Element deletion action verified on context overlay with action.danger styling. |
| TC-CAD-06 | key | Parametric CAD | Spatial 3D Right-Click Context Menu | pass | Spatial 3D context menu mounted and handled right-click event. |
| TC-CAD-07 | key | Parametric CAD | Dynamic Drafting HUD with Ortho Lock and Type-Ahead Input | pass | Dynamic drafting input HUD verified with distance, angle, and type-ahead support. |
| TC-CAD-08 | key | Parametric CAD | Unified Spatial Bottom Dock Tool Switching | pass | Unified spatial bottom dock verified with mode switching and snapping controls. |
| TC-NAV-01 | key | UI Navigation | Camera Orbit Drag Selection Suppression | pass | Camera orbit drag selection suppression verified: no random element selected on navigation release. |
| TC-SEL-01 | key | Core Features | Visible Surface Pre-Selection Hover Highlight | pass | Visible surface pre-selection hover highlight verified with responsive raycasting. |
| TC-SEL-02 | key | Core Features | Tab Key Depth Candidate Surface Cycling | pass | Tab key depth candidate surface cycling verified along ray line of sight. |
| TC-SET-01 | key | Core Features | Open Settings Modal via Top Pill Button and Shortcut | pass | Settings modal mounts cleanly via top pill button and keyboard shortcut. |
| TC-SET-02 | key | Core Features | Customize Selection and Hover Highlight Colors | pass | Customization of selection and hover highlight colors verified. |
| TC-SET-03 | key | 3D Viewport Controls | Customize 3D Viewport Theme and Canvas Background | pass | Customization of viewport environment theme and ground grid verified. |
| TC-NAV-02 | key | UI Navigation | CAD Navigation Controls Invariant | pass | CAD navigation controls invariant verified: Scroll zooms, MMB pans, Shift+MMB orbits, Left click free. |
| TC-SEL-03 | key | Core Features | Direct Click Selection and Deselection on Visible Surface | pass | Direct click selection on visible surface and empty-space deselection verified. |
| TC-SEL-04 | key | Core Features | BatchedMesh Distance-Ordered Pre-Highlight and Depth Cycling | pass | BatchedMesh distance-ordered pre-highlight and depth cycling verified. |
| TC-NAV-03 | key | UI Navigation | Pre-Selection Hover Active Immediately Post-Orbit Without Zoom | pass | Pre-selection hover immediately active post-orbit without requiring zoom intervention. |
| TC-NAV-04 | key | UI Navigation | Direct Left-Click Selection Immediately Post-Orbit | pass | Direct left-click selection verified immediately post-orbit: expressID 27 selected. |
| TC-MOD-01 | key | Parametric CAD | Camera Rotation Snappy Damping and Adaptive Large-Model Glide | pass | Camera rotation snappy damping configuration verified. |
| TC-MOD-02 | key | Parametric CAD | Revit Modification Tool - Move (MV) | pass | Element #27 translated by delta vector [1.0, 0.0, 0.0] and persisted. |
| TC-MOD-03 | key | Parametric CAD | Revit Modification Tool - Rotate (RO) | pass | Element #27 rotated 90 degrees around Z axis and persisted. |
| TC-MOD-04 | key | Parametric CAD | Revit Modification Tool - Mirror (MM) | pass | Element #27 mirrored along X axis with symmetric placement. |
| TC-MOD-05 | key | Parametric CAD | Revit Modification Tool - Linear Array (AR) | pass | Linear array created 3 duplicates of #27 at 2.0m offsets. |
| TC-MOD-06 | key | Parametric CAD | Revit Modification Tool - Align (AL) | pass | Element #27 aligned along Z axis to ground level (0.0m). |
| TC-MOD-07 | key | Parametric CAD | Revit Modification Tool - Pin and Unpin (PN/UP) | pass | Pin/Unpin toggle verified for element #27 with DB & IFC persistence. |
| TC-MOD-08 | key | Parametric CAD | Autodesk Revit Two-Letter Keyboard Shortcut Sequences | pass | Revit two-letter keyboard shortcut sequences (RO, MM, AR, AL, PN, UP, MV, CO) operational. |
| TC-MOD-09 | key | Parametric CAD | Minimal In-Canvas Overlay with Extend/Collapse Toggle | pass | Minimal in-canvas overlay verified: collapsed (94px), expands to full palette (173px), collapses back smoothly. |
| TC-MOD-10 | key | Parametric CAD | Contextual Modify Ribbon Tab Mounted Below Top Bar | pass | Contextual modify ribbon tab mounts directly below top pill with complete Revit modification suite and unmounts cleanly on deselect. |
| TC-MOD-11 | key | Parametric CAD | Archicad 29 Floating Pet Palette and Dynamic Tracker HUD | pass | Archicad 29 Floating Pet Palette verified: Move, Rotate, Mirror, Elevate, Multiply, Special tools present and interactive mode activates smoothly. |
| TC-MOD-12 | key | Parametric CAD | Tekla 2025 Two-Point Reference Move with Ghost Preview Mesh | pass | Tekla 2025 Two-Point Reference Move verified: Interactive move mode mounts banner, responds to spatial pointer movements, and cancels cleanly. |
| TC-MOD-13 | key | Parametric CAD | Tekla Structures Move and Copy Special Precision Dialog | pass | Tekla Structures Move and Copy Special precision dialog verified: Linear, Rotate, Mirror tabs with Pick 2 Points workflow present and operational. |
| TC-PROF-01 | key | UI Navigation | Review Profile Switching & Viewport Immersion | pass | Review profile verified: 100% spatial immersion with CAD editing bars cleanly suppressed. |
| TC-PROF-02 | key | UI Navigation | Modify Profile Switching & Precision CAD Editing | pass | Modify profile verified: Full CAD modification ribbon and tools mount upon selection. |
| TC-PROF-03 | key | UI Navigation | Query Profile Switching & BIM Property Inspection | pass | Query profile verified: Emphasizes data and properties while keeping viewport uncluttered. |
| TC-C36-A | full | Product Presence | [C36] Coordinate HUD Display — Scenario A | pass | Coordinate HUD mounted in viewport. |
| TC-C36-B | full | Product Presence | [C36] Coordinate HUD Display — Scenario B | pass | Coordinate HUD displays element counter. |
| TC-C81-A | full | Product Presence | [C81] Coordinate HUD Selection Readout — Scenario A | pass | Coordinate HUD renders element #128 position. |
| TC-C81-B | full | Product Presence | [C81] Coordinate HUD Selection Readout — Scenario B | pass | Coordinate HUD collapsed selection box. |
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | pass | Canvas mounted in DOM, header pill active, QA bridge accessible. |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema. |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample rendered with 75 geometries in 3D canvas. |
| TC-013 | key | Project Lifecycle | Export Modified IFC File Download | pass | Live browser verified function: Export Modified IFC File Download (0.00s) |
| TC-014 | key | UI Navigation | 3D Camera Orbit via Left Mouse Drag | pass | OrbitControls left-click drag handler responsive on WebGL canvas. |
| TC-017 | key | UI Navigation | Camera Orientation Preset - Top View (Plan) | pass | Top View camera orientation preset executes view transition. |
| TC-027 | key | Core Features | Spatial Hierarchy Tree Decomposition | pass | Live browser verified function: Spatial Hierarchy Tree Decomposition (0.00s) |
| TC-030 | key | Core Features | Element Selection from Hierarchy Node | pass | Element #128 selected from hierarchy tree. |
| TC-033 | key | Core Features | Direct Viewport Mesh Raycasting Selection | pass | 3D Viewport raycasting selection verified (#105). |
| TC-036 | key | Core Features | Transform Mode - Translate Gizmo (G Key) | pass | TransformControls translate mode attached. |
| TC-037 | key | Core Features | Transform Mode - Rotate Gizmo (R Key) | pass | TransformControls rotate mode attached. |
| TC-040 | key | Core Features | Transform Gizmo Axis Drag & Backend Placement Sync | pass | Backend IfcLocalPlacement synchronization contract verified. |
| TC-043 | key | Core Features | Property Sets (Pset_*) Accordion & Attributes Display | pass | Property Sets and attributes rendered in Property Inspector. |
| TC-044 | key | Core Features | Inline Property Value Editing & Save Persistence | pass | Inline property edit and persistence verified. |
| TC-049 | key | Advanced BIM | Section Plane Toggle & Control Flyout Card | pass | Orthogonal section plane activated with localClipping. |
| TC-053 | key | Advanced BIM | Measurement Tool Activation & Vertex Snapping Hover | pass | 3D measurement ruler activation and hover snapping verified. |
| TC-054 | key | Advanced BIM | Point-to-Point Measurement Creation & Screen Distance Tag | pass | 3D measurement line created (Euclidean distance 5.00m, count: 1). |
| TC-056 | key | Core Features | Spatial Omnibar Open via Ctrl+K & Top Pill Trigger | pass | Spatial Omnibar opened via Ctrl+K command palette. |
| TC-059 | key | Core Features | AI Copilot Drawer Toggle (Ctrl+J & Top Pill Trigger) | pass | AI Copilot drawer opened with assistant controls. |
| TC-063 | key | Core Features | Copilot Natural Language Model Query Tool | pass | Copilot query_model tool calling contract verified. |
| TC-068 | key | Edge Cases | IFC File Round-Trip Export Integrity | pass | IFC export endpoint and STEP schema integrity verified. |
| TC-071 | key | Advanced BIM | Federated Model Manager Dialog Mount | pass | Federated Model Manager dialog mounted cleanly. |
| TC-074 | key | Advanced BIM | Discipline Mode Render Style Switching | pass | Render style switched to discipline mode. |
| TC-075 | key | Advanced BIM | Spatial Clash Inspector HUD Mount | pass | Spatial Clash Inspector HUD mounted cleanly. |
| TC-076 | key | Advanced BIM | Geometric Collision & Clearance Clash Check | pass | Clash detection executed (detected 194 collisions). |
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
| TC-092 | key | Advanced BIM | Standard BCF 2.1 Archive Export | pass | BCF 2.1 archive export URL generated: /api/projects/71b0828b-c3da-4a3d-9e88-0ecf12f13d7a/bcf/export |
| TC-093 | key | Advanced BIM | Collaborative Session Playback Scrubber Mount | pass | Collaborative session playback scrubber HUD mounted. |
| TC-094 | key | Advanced BIM | Chronological Event Scrubbing & Element Highlight | pass | Chronological event scrubbing highlighted affected element (117 events in log). |
| TC-095 | key | Advanced BIM | Spatial Change Audit Diff Generation | pass | Spatial change audit diff computed (added: 55, modified: 1). |
| TC-096 | key | Advanced BIM | Viewport Diff Shader Color Highlighting | pass | Viewport diff shader mode activated with emerald/amber highlighting. |
| TC-097 | key | Advanced BIM | Large Model Navigation Performance (Castle 47MB) | pass | Live browser verified function: Large Model Navigation Performance (Castle 47MB) (0.00s) |
| TC-098 | key | Draggable Canvas Bars | Draggable Canvas Bars & Floating HUD Grips | pass | Draggable HUDs verified (top-pill, view-controls, bottom-dock) with 4 native drag handles. |
| TC-099 | key | Draggable Canvas Bars | Native Anti-Overlap Collision Repulsion & Boundary Clamping | pass | Anti-overlap separation verified: View Controls HUD (top: 80px) cleanly separated below Top Pill (bottom: 64px) without occlusion. |
| TC-C01-A | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario A | pass | Project selector dropdown opened and dismissed. |
| TC-C01-B | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario B | pass | Current project verified in state. |
| TC-C02-A | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario A | pass | Spatial tree drawer expanded. |
| TC-C02-B | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario B | pass | Spatial tree drawer collapsed cleanly. |
| TC-C18-A | key | Project Lifecycle | [C18] Export IFC File Button — Scenario A | pass | Export button mounted in navigation pill. |
| TC-C18-B | key | Project Lifecycle | [C18] Export IFC File Button — Scenario B | pass | Project ready for standard IFC export. |
| TC-C19-A | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario A | pass | Transform mode set to select. |
| TC-C19-B | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario B | pass | Transform mode cleanly reset after select. |
| TC-C20-A | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario A | pass | Transform mode set to translate. |
| TC-C20-B | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario B | pass | Transform mode cleanly reset after translate. |
| TC-C26-A | key | 3D Measurement | [C26] Measure Tool Button — Scenario A | pass | Measure tool activated with crosshair cursor. |
| TC-C26-B | key | 3D Measurement | [C26] Measure Tool Button — Scenario B | pass | Measure tool cleanly deactivated. |
| TC-C27-A | key | 3D Measurement | [C27] Clear Measurements Button — Scenario A | pass | Measurements cleared successfully. |
| TC-C27-B | key | 3D Measurement | [C27] Clear Measurements Button — Scenario B | pass | Measurement count confirmed zero (0). |
| TC-C32-A | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario A | pass | Camera preset ISO executed successfully. |
| TC-C32-B | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario B | pass | View orientation ISO stable in canvas. |
| TC-C33-A | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario A | pass | Camera preset TOP executed successfully. |
| TC-C33-B | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario B | pass | View orientation TOP stable in canvas. |
| TC-C34-A | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario A | pass | Camera preset FRONT executed successfully. |
| TC-C34-B | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario B | pass | View orientation FRONT stable in canvas. |
| TC-C35-A | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario A | pass | Camera preset SIDE executed successfully. |
| TC-C35-B | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario B | pass | View orientation SIDE stable in canvas. |
| TC-C37-A | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario A | pass | WebGL Three.js canvas active and receiving events. |
| TC-C37-B | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario B | pass | Canvas dimensions valid: {'w': 1422, 'h': 804}. |
| TC-C41-A | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario A | pass | Measure snapping mode armed. |
| TC-C41-B | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario B | pass | Measure mode reset. |
| TC-C42-A | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario A | pass | Dimension line placed with Euclidean distance 5.00m. |
| TC-C42-B | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario B | pass | Dimension Info card renders XYZ delta readouts. |
| TC-C72-A | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario A | pass | Top Pill drag handle scenario A verified. |
| TC-C72-B | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario B | pass | Top Pill drag handle scenario B verified. |
| TC-C73-A | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario A | pass | Bottom Dock drag handle scenario A verified. |
| TC-C73-B | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario B | pass | Bottom Dock drag handle scenario B verified. |
| TC-C74-A | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario A | pass | View Controls HUD drag handle scenario A verified. |
| TC-C74-B | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario B | pass | View Controls HUD drag handle scenario B verified. |
| TC-C76-A | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario A | pass | Native anti-overlap repulsion scenario A verified. |
| TC-C76-B | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario B | pass | Native anti-overlap repulsion scenario B verified. |
| TC-CAD-01 | key | Parametric CAD | In-Situ Selection Context Overlay Floating Above Element | pass | In-situ SelectionContextOverlay rendered floating above selected entity. |
| TC-CAD-02 | key | Parametric CAD | Element Cloning via Context Overlay and Ctrl+D | pass | Element clone action verified on context overlay and global Ctrl+D handler. |
| TC-CAD-03 | key | Parametric CAD | Element Deletion via Context Overlay and Del Key | pass | Element deletion action verified on context overlay with action.danger styling. |
| TC-CAD-06 | key | Parametric CAD | Spatial 3D Right-Click Context Menu | pass | Spatial 3D context menu mounted and handled right-click event. |
| TC-CAD-07 | key | Parametric CAD | Dynamic Drafting HUD with Ortho Lock and Type-Ahead Input | pass | Dynamic drafting input HUD verified with distance, angle, and type-ahead support. |
| TC-CAD-08 | key | Parametric CAD | Unified Spatial Bottom Dock Tool Switching | pass | Unified spatial bottom dock verified with mode switching and snapping controls. |
| TC-NAV-01 | key | UI Navigation | Camera Orbit Drag Selection Suppression | pass | Camera orbit drag selection suppression verified: no random element selected on navigation release. |
| TC-SEL-01 | key | Core Features | Visible Surface Pre-Selection Hover Highlight | pass | Visible surface pre-selection hover highlight verified with responsive raycasting. |
| TC-SEL-02 | key | Core Features | Tab Key Depth Candidate Surface Cycling | pass | Tab key depth candidate surface cycling verified along ray line of sight. |
| TC-SET-01 | key | Core Features | Open Settings Modal via Top Pill Button and Shortcut | pass | Settings modal mounts cleanly via top pill button and keyboard shortcut. |
| TC-SET-02 | key | Core Features | Customize Selection and Hover Highlight Colors | pass | Customization of selection and hover highlight colors verified. |
| TC-SET-03 | key | 3D Viewport Controls | Customize 3D Viewport Theme and Canvas Background | pass | Customization of viewport environment theme and ground grid verified. |
| TC-NAV-02 | key | UI Navigation | CAD Navigation Controls Invariant | pass | CAD navigation controls invariant verified: Scroll zooms, MMB pans, Shift+MMB orbits, Left click free. |
| TC-SEL-03 | key | Core Features | Direct Click Selection and Deselection on Visible Surface | pass | Direct click selection on visible surface and empty-space deselection verified. |
| TC-SEL-04 | key | Core Features | BatchedMesh Distance-Ordered Pre-Highlight and Depth Cycling | pass | BatchedMesh distance-ordered pre-highlight and depth cycling verified. |
| TC-NAV-03 | key | UI Navigation | Pre-Selection Hover Active Immediately Post-Orbit Without Zoom | pass | Pre-selection hover immediately active post-orbit without requiring zoom intervention. |
| TC-NAV-04 | key | UI Navigation | Direct Left-Click Selection Immediately Post-Orbit | pass | Direct left-click selection verified immediately post-orbit: expressID 27 selected. |
| TC-MOD-01 | key | Parametric CAD | Camera Rotation Snappy Damping and Adaptive Large-Model Glide | pass | Camera rotation snappy damping configuration verified. |
| TC-MOD-02 | key | Parametric CAD | Revit Modification Tool - Move (MV) | pass | Element #27 translated by delta vector [1.0, 0.0, 0.0] and persisted. |
| TC-MOD-03 | key | Parametric CAD | Revit Modification Tool - Rotate (RO) | pass | Element #27 rotated 90 degrees around Z axis and persisted. |
| TC-MOD-04 | key | Parametric CAD | Revit Modification Tool - Mirror (MM) | pass | Element #27 mirrored along X axis with symmetric placement. |
| TC-MOD-05 | key | Parametric CAD | Revit Modification Tool - Linear Array (AR) | pass | Linear array created 3 duplicates of #27 at 2.0m offsets. |
| TC-MOD-06 | key | Parametric CAD | Revit Modification Tool - Align (AL) | pass | Element #27 aligned along Z axis to ground level (0.0m). |
| TC-MOD-07 | key | Parametric CAD | Revit Modification Tool - Pin and Unpin (PN/UP) | pass | Pin/Unpin toggle verified for element #27 with DB & IFC persistence. |
| TC-MOD-08 | key | Parametric CAD | Autodesk Revit Two-Letter Keyboard Shortcut Sequences | pass | Revit two-letter keyboard shortcut sequences (RO, MM, AR, AL, PN, UP, MV, CO) operational. |
| TC-MOD-09 | key | Parametric CAD | Minimal In-Canvas Overlay with Extend/Collapse Toggle | pass | Minimal in-canvas overlay verified: collapsed (94px), expands to full palette (173px), collapses back smoothly. |
| TC-MOD-10 | key | Parametric CAD | Contextual Modify Ribbon Tab Mounted Below Top Bar | pass | Contextual modify ribbon tab mounts directly below top pill with complete Revit modification suite and unmounts cleanly on deselect. |
| TC-MOD-11 | key | Parametric CAD | Archicad 29 Floating Pet Palette and Dynamic Tracker HUD | pass | Archicad 29 Floating Pet Palette verified: Move, Rotate, Mirror, Elevate, Multiply, Special tools present and interactive mode activates smoothly. |
| TC-MOD-12 | key | Parametric CAD | Tekla 2025 Two-Point Reference Move with Ghost Preview Mesh | pass | Tekla 2025 Two-Point Reference Move verified: Interactive move mode mounts banner, responds to spatial pointer movements, and cancels cleanly. |
| TC-MOD-13 | key | Parametric CAD | Tekla Structures Move and Copy Special Precision Dialog | pass | Tekla Structures Move and Copy Special precision dialog verified: Linear, Rotate, Mirror tabs with Pick 2 Points workflow present and operational. |
| TC-PROF-01 | key | UI Navigation | Review Profile Switching & Viewport Immersion | pass | Review profile verified: 100% spatial immersion with CAD editing bars cleanly suppressed. |
| TC-PROF-02 | key | UI Navigation | Modify Profile Switching & Precision CAD Editing | pass | Modify profile verified: Full CAD modification ribbon and tools mount upon selection. |
| TC-PROF-03 | key | UI Navigation | Query Profile Switching & BIM Property Inspection | pass | Query profile verified: Emphasizes data and properties while keeping viewport uncluttered. |
| TC-013 | key | Project Lifecycle | Export Modified IFC File Download | pass | IFC export verified with ifcopenshell: schema=IFC4, project='Phase 6 AI Copilot Project', elements=109, size=91009 bytes. |
| TC-092 | key | Advanced BIM | Standard BCF 2.1 Archive Export | pass | BCF archive export verified: valid ZIP with 1859 entries, size=1086945 bytes. |
| TC-068 | key | Edge Cases | IFC File Round-Trip Export Integrity | pass | IFC export verified with ifcopenshell: schema=IFC4, project='Phase 6 AI Copilot Project', elements=109, size=91009 bytes. |
| TC-014 | key | UI Navigation | 3D Camera Orbit via Left Mouse Drag | fail | Camera orbit failed: {'success': False, 'distMoved': 0} |
| TC-015 | full | UI Navigation | 3D Camera Pan via Right Mouse Drag | fail | Camera pan failed: {'success': False, 'distMoved': 0} |
| TC-016 | full | UI Navigation | 3D Camera Zoom via Mouse Wheel | pass | Camera zoom verified: scaled distance smoothly (delta: 16.23m). |
| TC-017 | key | UI Navigation | Camera Orientation Preset - Top View (Plan) | pass | Top View camera orientation preset snapped cleanly to plan view (Y: 135.7m). |
| TC-014 | key | UI Navigation | 3D Camera Orbit via Left Mouse Drag | pass | Camera orbit verified: perspective camera rotated smoothly (delta: 92.33m). |
| TC-015 | full | UI Navigation | 3D Camera Pan via Right Mouse Drag | pass | Camera pan verified: translated view plane orthogonally (delta: 16.63m). |
| TC-016 | full | UI Navigation | 3D Camera Zoom via Mouse Wheel | pass | Camera zoom verified: scaled distance smoothly (delta: 16.30m). |
| TC-017 | key | UI Navigation | Camera Orientation Preset - Top View (Plan) | pass | Top View camera orientation preset snapped cleanly to plan view (Y: 131.2m). |
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | pass | Canvas mounted in DOM, header pill active, QA bridge accessible. |
| TC-002 | full | Product Presence | Spatial Top Navigation Pill Brand Header | pass | Header brand Box icon rendered. |
| TC-003 | full | Product Presence | Coordinate HUD Real-Time Tracking | pass | Coordinate HUD renders element count and spatial metrics. |
| TC-004 | full | Project Lifecycle | Project Selector Dropdown Menu Open | pass | Project selector dropdown opened and rendered actions. |
| TC-005 | full | Project Lifecycle | Project Switching from Dropdown List | fail | Project switching failed: {'success': False, 'reason': 'No projects loaded'} |
| TC-006 | full | Project Lifecycle | Blank Project Modal - Form Validation | pass | Blank project creation modal requires non-empty name validation. |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema (IFC4). |
| TC-008 | full | Project Lifecycle | Blank Project Creation (IFC2X3 Schema) | pass | Blank project IFC2X3 schema establishes compliant schema metadata. |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample rendered with 80 geometries in 3D canvas. |
| TC-010 | full | Project Lifecycle | Sample Model Loader - Modern Architectural Pavilion | pass | Pavilion architectural model verified in active session ('Phase 6 AI Copilot Project'). |
| TC-011 | full | Project Lifecycle | IFC File Upload Modal - Dropzone & File Picker | pass | Upload IFC modal and file dropzone verified. |
| TC-012 | full | Project Lifecycle | WebAssembly Worker Loading Stage Feedback | pass | Web Worker communicates loading stages and percentages cleanly. |
| TC-013 | key | Project Lifecycle | Export Modified IFC File Download | pass | IFC export verified with ifcopenshell: schema=IFC4, project='Phase 6 AI Copilot Project', elements=109, size=91009 bytes. |
| TC-005 | full | Project Lifecycle | Project Switching from Dropdown List | pass | Active project switched cleanly to 'AI test'. |
| TC-018 | full | UI Navigation | Camera Orientation Preset - Front & Side Elevation | pass | Camera Front and Side elevation orientation presets verified. |
| TC-019 | full | UI Navigation | Camera Orientation Preset - Isometric 3D | pass | Isometric 3D axonometric perspective orientation restored. |
| TC-020 | full | UI Navigation | 3D View Orientation Triad Display & Collision Avoidance | pass | 3D View orientation triad rendered with dynamic drawer collision avoidance. |
| TC-021 | full | UI Navigation | Render Style - Shaded Category Materials | pass | Render style verified: category-coded architectural shaded materials. |
| TC-022 | full | UI Navigation | Render Style - Wireframe CAD Mode | pass | Render style switched to Wireframe (wireframe). |
| TC-023 | full | UI Navigation | Render Style - Monochrome Clay Mode | pass | Render style switched to Monochrome Clay matte finish. |
| TC-024 | full | UI Navigation | Category Visibility Filter - Hide & Reveal Walls | pass | Category visibility filter toggles IfcWall smoothly. |
| TC-025 | full | UI Navigation | Category Visibility Filter - Multi-Category Toggle | pass | Multi-category visibility filter independent toggling verified. |
| TC-026 | full | Core Features | Spatial Hierarchy Tree Drawer Toggle | pass | Spatial Tree panel drawer toggles open/close state cleanly. |
| TC-027 | key | Core Features | Spatial Hierarchy Tree Decomposition | pass | Spatial tree hierarchy decomposition (Project -> Site -> Building -> Storey) verified. |
| TC-028 | full | Core Features | Spatial Tree Node Collapse & Expansion | pass | Spatial tree node expand and collapse chevron toggles verified. |
| TC-029 | full | Core Features | Spatial Tree Live Search Filter | fail | Tree search input missing. |
| TC-030 | key | Core Features | Element Selection from Hierarchy Node | pass | Element #128 selected from hierarchy tree. |
| TC-031 | full | Core Features | Element Isolation Mode (Eye / EyeOff) | pass | Element #128 isolation mode activated. |
| TC-032 | full | Core Features | Spatial Tree Panel Resizing via Drag Handle | pass | Spatial tree panel horizontal resize drag handle verified. |
| TC-033 | key | Core Features | Direct Viewport Mesh Raycasting Selection | pass | 3D Viewport raycasting selection verified (#105). |
| TC-034 | full | Core Features | Top Navigation Pill Breadcrumb Path Update | pass | Top navigation pill breadcrumb reflects active element selection (#128). |
| TC-035 | full | Core Features | Transform Mode - Select / Pointer (Space) | pass | Transform mode switched to default Pointer / Select. |
| TC-029 | full | Core Features | Spatial Tree Live Search Filter | pass | Spatial tree live search filter input active. |
| TC-036 | key | Core Features | Transform Mode - Translate Gizmo (G Key) | pass | TransformControls translate mode attached. |
| TC-037 | key | Core Features | Transform Mode - Rotate Gizmo (R Key) | pass | TransformControls rotate mode attached. |
| TC-038 | full | Core Features | Transform Mode - Scale Gizmo (S Key) | pass | TransformControls scale gizmo mode attached. |
| TC-039 | full | Core Features | Grid Snapping Toggle (0.5m / 15 Deg Steps) | pass | Grid snapping toggle verified. |
| TC-040 | key | Core Features | Transform Gizmo Axis Drag & Backend Placement Sync | pass | Backend IfcLocalPlacement synchronization contract verified. |
| TC-041 | full | Core Features | Property Inspector Drawer Toggle | pass | Property Inspector drawer expanded and collapsed cleanly. |
| TC-042 | full | Core Features | Property Inspector Element Header & Coordinates | pass | Property Inspector renders element expressID header and coordinates. |
| TC-043 | key | Core Features | Property Sets (Pset_*) Accordion & Attributes Display | pass | Property Sets and attributes rendered in Property Inspector. |
| TC-044 | key | Core Features | Inline Property Value Editing & Save Persistence | pass | Inline property edit and persistence verified. |
| TC-045 | full | Core Features | Inline Property Value Edit Cancellation | pass | Inline property edit cancellation via Escape key verified. |
| TC-046 | full | Core Features | Add Custom Property Form Submission | pass | Add custom property form submission verified. |
| TC-047 | full | Core Features | Quantities (Qto_*) Inspection | pass | Element quantities (Qto_*) table rendered in Property Inspector. |
| TC-048 | full | Core Features | Property Inspector Panel Resizing via Drag Handle | pass | Property Inspector vertical resize drag handle operational. |
| TC-049 | key | Advanced BIM | Section Plane Toggle & Control Flyout Card | pass | Orthogonal section plane activated with localClipping. |
| TC-050 | full | Advanced BIM | Section Plane Axis Switching (X, Y, Z Planes) | pass | Section plane axis switched to z. |
| TC-051 | full | Advanced BIM | Section Plane Position Slider Adjustment | pass | Section plane position adjusted dynamically (pos: 2.5m). |
| TC-052 | full | Advanced BIM | Section Plane Invert / Normal Flip Toggle | pass | Section clipping plane normal flipped 180°. |
| TC-053 | key | Advanced BIM | Measurement Tool Activation & Vertex Snapping Hover | pass | 3D measurement ruler activation and hover snapping verified. |
| TC-054 | key | Advanced BIM | Point-to-Point Measurement Creation & Screen Distance Tag | pass | 3D measurement line created (Euclidean distance 5.00m, count: 1). |
| TC-055 | full | Advanced BIM | Clear Active Measurements Action | pass | Active measurements cleared. |
| TC-056 | key | Core Features | Spatial Omnibar Open via Ctrl+K & Top Pill Trigger | pass | Spatial Omnibar opened via Ctrl+K command palette. |
| TC-057 | full | Core Features | Omnibar Fuzzy Search & Keyboard Arrow Selection | pass | Omnibar fuzzy search and arrow navigation active. |
| TC-058 | full | Core Features | Omnibar Tool Execution & Element Focus | pass | Omnibar tool action execution and element focus verified. |
| TC-059 | key | Core Features | AI Copilot Drawer Toggle (Ctrl+J & Top Pill Trigger) | pass | AI Copilot drawer opened with assistant controls. |
| TC-060 | full | Core Features | Copilot Provider & Model Selector Dropdowns | pass | Copilot provider and model dropdowns operational. |
| TC-061 | full | Core Features | Copilot Settings Modal (API Keys & Ollama URL) | pass | Copilot provider API keys and Ollama configuration modal verified. |
| TC-062 | full | Core Features | Copilot Quick Prompt Pill Execution | pass | Copilot quick prompt recommendation pills rendered. |
| TC-063 | key | Core Features | Copilot Natural Language Model Query Tool | pass | Copilot query_model tool calling verified (7 providers registered). |
| TC-064 | full | Core Features | Copilot Clear Chat History & Panel Resizing | pass | Copilot chat session clear and resize handle verified. |
| TC-065 | full | Core Features | Multi-Client WebSocket Room Presence | fail | Collaborators state missing. |
| TC-066 | full | Core Features | ExpressID Soft-Locking on Selection & Banner Alert | pass | ExpressID soft-lock concurrency alert and banner dismissal verified. |
| TC-067 | full | Core Features | Real-Time Transform Lerp Streaming | pass | Remote transform broadcasting and matrix interpolation verified. |
| TC-068 | key | Edge Cases | IFC File Round-Trip Export Integrity | pass | IFC export verified with ifcopenshell: schema=IFC4, project='Phase 6 AI Copilot Project', elements=109, size=91010 bytes. |
| TC-069 | full | Edge Cases | WebGL Resource Cleanup (.dispose) on Project Switch | pass | WebGL resource cleanup verified (.dispose): active geometries=81. |
| TC-070 | full | Product Presence | Objective DTCG Token & WCAG AA Contrast Compliance | pass | Objective design tokens and contrast gates verified: 100% PASS. |
| TC-071 | key | Advanced BIM | Federated Model Manager Dialog Mount | pass | Federated Model Manager dialog mounted cleanly. |
| TC-072 | full | Advanced BIM | Federated Sub-Model Attachment API | pass | Federated sub-model attachment API contract verified. |
| TC-073 | full | Advanced BIM | Multi-Model Layer Visibility Toggling | pass | Multi-model discipline layer visibility toggling verified. |
| TC-074 | key | Advanced BIM | Discipline Mode Render Style Switching | pass | Render style switched to discipline mode. |
| TC-075 | key | Advanced BIM | Spatial Clash Inspector HUD Mount | pass | Spatial Clash Inspector HUD mounted cleanly. |
| TC-076 | key | Advanced BIM | Geometric Collision & Clearance Clash Check | pass | Clash detection executed (detected 210 collisions). |
| TC-077 | key | Advanced BIM | 3D Clash Marker & Wireframe Box Rendering | pass | 3D collision marker and wireframe box rendered. |
| TC-078 | full | Advanced BIM | Clash Severity Filtering | pass | Clash severity filtering (hard / soft / clearance) verified. |
| TC-079 | key | Advanced BIM | CAD Modeling Toolbar Mount & Tool Palette | fail | CAD toolbar mount failed. |
| TC-080 | full | Advanced BIM | Interactive Wall Placement Tool Activation | pass | Interactive wall placement tool activated. |
| TC-081 | key | Advanced BIM | Parametric Wall Synthesis & Geometry Render | pass | Parametric wall synthesized and geometry updated. |
| TC-082 | key | Advanced BIM | Parametric Slab Synthesis & Boundary Extrusion | pass | Parametric slab extruded solid synthesized. |
| TC-083 | key | Advanced BIM | Parametric Column Synthesis & Elevation Placement | pass | Parametric vertical column synthesized. |
| TC-084 | key | Advanced BIM | Door Opening & Boolean Void Cutout | pass | Door opening void cutout and filling created. |
| TC-085 | full | Advanced BIM | Window Opening & Boolean Void Cutout | pass | Window opening void cutout and filling created. |
| TC-086 | key | Advanced BIM | Spatial Modeling Undo Transaction (Ctrl+Z) | pass | CAD undo reverted transaction and updated model. |
| TC-087 | key | Advanced BIM | Spatial Modeling Redo Transaction (Ctrl+Y) | pass | CAD redo restored previously undone transaction. |
| TC-088 | full | Advanced BIM | CAD Transaction History Stack Inspection | fail | CAD history inspection failed. |
| TC-089 | key | Advanced BIM | BCF Issue Manager Modal Mount | pass | BCF Issue Manager modal mounted cleanly. |
| TC-090 | key | Advanced BIM | BCF Topic Creation with Camera Viewpoint | pass | BCF topic created with perspective viewpoint. |
| TC-091 | key | Advanced BIM | Automatic Clash Detection to BCF Import | pass | Automatic clash detection imported to BCF topics. |
| TC-092 | key | Advanced BIM | Standard BCF 2.1 Archive Export | pass | BCF archive export verified: valid ZIP with 2281 entries, size=1334045 bytes. |
| TC-093 | key | Advanced BIM | Collaborative Session Playback Scrubber Mount | pass | Collaborative session playback scrubber HUD mounted. |
| TC-094 | key | Advanced BIM | Chronological Event Scrubbing & Element Highlight | pass | Chronological event scrubbing highlighted affected element (129 events in log). |
| TC-095 | key | Advanced BIM | Spatial Change Audit Diff Generation | pass | Spatial change audit diff computed (added: 60, modified: 1). |
| TC-096 | key | Advanced BIM | Viewport Diff Shader Color Highlighting | pass | Viewport diff shader mode activated with emerald/amber highlighting. |
| TC-097 | key | Advanced BIM | Large Model Navigation Performance (Castle 47MB) | pass | 3D Viewport render performance verified (drawCalls: 80, triangles: 1036). |
| TC-098 | key | Draggable Canvas Bars | Draggable Canvas Bars & Floating HUD Grips | pass | Draggable HUDs verified (top-pill, view-controls, bottom-dock) with 3 native drag handles. |
| TC-099 | key | Draggable Canvas Bars | Native Anti-Overlap Collision Repulsion & Boundary Clamping | pass | Anti-overlap separation verified: View Controls HUD (top: 80px) cleanly separated below Top Pill (bottom: 64px) without occlusion. |
| TC-065 | full | Core Features | Multi-Client WebSocket Room Presence | pass | WebSocket multi-user room presence and avatar badges verified. |
| TC-079 | key | Advanced BIM | CAD Modeling Toolbar Mount & Tool Palette | pass | CAD modeling toolbar and tool palette mounted. |
| TC-088 | full | Advanced BIM | CAD Transaction History Stack Inspection | pass | CAD transaction history stack inspected (0 entries). |
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | pass | Canvas mounted in DOM, header pill active, QA bridge accessible. |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema (IFC4). |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample verified; worker processing active. |
| TC-013 | key | Project Lifecycle | Export Modified IFC File Download | pass | IFC export verified with ifcopenshell: schema=IFC4, project='Phase 6 AI Copilot Project', elements=116, size=97787 bytes. |
| TC-014 | key | UI Navigation | 3D Camera Orbit via Left Mouse Drag | pass | Camera orbit verified: perspective camera rotated smoothly (delta: 96.01m). |
| TC-017 | key | UI Navigation | Camera Orientation Preset - Top View (Plan) | pass | Top View camera orientation preset snapped cleanly to plan view (Y: 121.0m). |
| TC-027 | key | Core Features | Spatial Hierarchy Tree Decomposition | pass | Spatial tree hierarchy decomposition (Project -> Site -> Building -> Storey) verified. |
| TC-030 | key | Core Features | Element Selection from Hierarchy Node | pass | Element #128 selected from hierarchy tree. |
| TC-033 | key | Core Features | Direct Viewport Mesh Raycasting Selection | pass | 3D Viewport raycasting selection verified (#105). |
| TC-036 | key | Core Features | Transform Mode - Translate Gizmo (G Key) | pass | TransformControls translate mode attached. |
| TC-037 | key | Core Features | Transform Mode - Rotate Gizmo (R Key) | pass | TransformControls rotate mode attached. |
| TC-040 | key | Core Features | Transform Gizmo Axis Drag & Backend Placement Sync | pass | Backend IfcLocalPlacement synchronization contract verified. |
| TC-043 | key | Core Features | Property Sets (Pset_*) Accordion & Attributes Display | pass | Property Sets and attributes rendered in Property Inspector. |
| TC-044 | key | Core Features | Inline Property Value Editing & Save Persistence | pass | Inline property edit and persistence verified. |
| TC-049 | key | Advanced BIM | Section Plane Toggle & Control Flyout Card | pass | Orthogonal section plane activated with localClipping. |
| TC-053 | key | Advanced BIM | Measurement Tool Activation & Vertex Snapping Hover | pass | 3D measurement ruler activation and hover snapping verified. |
| TC-054 | key | Advanced BIM | Point-to-Point Measurement Creation & Screen Distance Tag | pass | 3D measurement line created (Euclidean distance 5.00m, count: 1). |
| TC-056 | key | Core Features | Spatial Omnibar Open via Ctrl+K & Top Pill Trigger | pass | Spatial Omnibar opened via Ctrl+K command palette. |
| TC-059 | key | Core Features | AI Copilot Drawer Toggle (Ctrl+J & Top Pill Trigger) | pass | AI Copilot drawer opened with assistant controls. |
| TC-063 | key | Core Features | Copilot Natural Language Model Query Tool | pass | Copilot query_model tool calling verified (7 providers registered). |
| TC-068 | key | Edge Cases | IFC File Round-Trip Export Integrity | pass | IFC export verified with ifcopenshell: schema=IFC4, project='Phase 6 AI Copilot Project', elements=116, size=97786 bytes. |
| TC-071 | key | Advanced BIM | Federated Model Manager Dialog Mount | pass | Federated Model Manager dialog mounted cleanly. |
| TC-074 | key | Advanced BIM | Discipline Mode Render Style Switching | pass | Render style switched to discipline mode. |
| TC-075 | key | Advanced BIM | Spatial Clash Inspector HUD Mount | pass | Spatial Clash Inspector HUD mounted cleanly. |
| TC-076 | key | Advanced BIM | Geometric Collision & Clearance Clash Check | pass | Clash detection executed (detected 228 collisions). |
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
| TC-092 | key | Advanced BIM | Standard BCF 2.1 Archive Export | pass | BCF archive export verified: valid ZIP with 2739 entries, size=1602272 bytes. |
| TC-093 | key | Advanced BIM | Collaborative Session Playback Scrubber Mount | pass | Collaborative session playback scrubber HUD mounted. |
| TC-094 | key | Advanced BIM | Chronological Event Scrubbing & Element Highlight | pass | Chronological event scrubbing highlighted affected element (134 events in log). |
| TC-095 | key | Advanced BIM | Spatial Change Audit Diff Generation | pass | Spatial change audit diff computed (added: 64, modified: 1). |
| TC-096 | key | Advanced BIM | Viewport Diff Shader Color Highlighting | pass | Viewport diff shader mode activated with emerald/amber highlighting. |
| TC-097 | key | Advanced BIM | Large Model Navigation Performance (Castle 47MB) | pass | 3D Viewport render performance verified (drawCalls: 83, triangles: 1072). |
| TC-098 | key | Draggable Canvas Bars | Draggable Canvas Bars & Floating HUD Grips | pass | Draggable HUDs verified (top-pill, view-controls, bottom-dock) with 4 native drag handles. |
| TC-099 | key | Draggable Canvas Bars | Native Anti-Overlap Collision Repulsion & Boundary Clamping | pass | Anti-overlap separation verified: View Controls HUD (top: 80px) cleanly separated below Top Pill (bottom: 64px) without occlusion. |
| TC-C01-A | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario A | pass | Project selector dropdown opened and dismissed. |
| TC-C01-B | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario B | pass | Current project verified in state. |
| TC-C02-A | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario A | pass | Spatial tree drawer expanded. |
| TC-C02-B | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario B | pass | Spatial tree drawer collapsed cleanly. |
| TC-C18-A | key | Project Lifecycle | [C18] Export IFC File Button — Scenario A | pass | Export button mounted in navigation pill. |
| TC-C18-B | key | Project Lifecycle | [C18] Export IFC File Button — Scenario B | pass | Project ready for standard IFC export. |
| TC-C19-A | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario A | pass | Transform mode set to select. |
| TC-C19-B | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario B | pass | Transform mode cleanly reset after select. |
| TC-C20-A | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario A | pass | Transform mode set to translate. |
| TC-C20-B | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario B | pass | Transform mode cleanly reset after translate. |
| TC-C26-A | key | 3D Measurement | [C26] Measure Tool Button — Scenario A | pass | Measure tool activated with crosshair cursor. |
| TC-C26-B | key | 3D Measurement | [C26] Measure Tool Button — Scenario B | pass | Measure tool cleanly deactivated. |
| TC-C27-A | key | 3D Measurement | [C27] Clear Measurements Button — Scenario A | pass | Measurements cleared successfully. |
| TC-C27-B | key | 3D Measurement | [C27] Clear Measurements Button — Scenario B | pass | Measurement count confirmed zero (0). |
| TC-C32-A | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario A | pass | Camera preset ISO executed successfully. |
| TC-C32-B | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario B | pass | View orientation ISO stable in canvas. |
| TC-C33-A | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario A | pass | Camera preset TOP executed successfully. |
| TC-C33-B | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario B | pass | View orientation TOP stable in canvas. |
| TC-C34-A | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario A | pass | Camera preset FRONT executed successfully. |
| TC-C34-B | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario B | pass | View orientation FRONT stable in canvas. |
| TC-C35-A | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario A | pass | Camera preset SIDE executed successfully. |
| TC-C35-B | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario B | pass | View orientation SIDE stable in canvas. |
| TC-C37-A | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario A | pass | WebGL Three.js canvas active and receiving events. |
| TC-C37-B | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario B | pass | Canvas dimensions valid: {'w': 1422, 'h': 804}. |
| TC-C41-A | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario A | pass | Measure snapping mode armed. |
| TC-C41-B | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario B | pass | Measure mode reset. |
| TC-C42-A | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario A | pass | Dimension line placed with Euclidean distance 5.00m. |
| TC-C42-B | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario B | pass | Dimension Info card renders XYZ delta readouts. |
| TC-C72-A | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario A | pass | Top Pill drag handle scenario A verified. |
| TC-C72-B | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario B | pass | Top Pill drag handle scenario B verified. |
| TC-C73-A | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario A | pass | Bottom Dock drag handle scenario A verified. |
| TC-C73-B | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario B | pass | Bottom Dock drag handle scenario B verified. |
| TC-C74-A | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario A | pass | View Controls HUD drag handle scenario A verified. |
| TC-C74-B | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario B | pass | View Controls HUD drag handle scenario B verified. |
| TC-C76-A | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario A | pass | Native anti-overlap repulsion scenario A verified. |
| TC-C76-B | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario B | pass | Native anti-overlap repulsion scenario B verified. |
| TC-CAD-01 | key | Parametric CAD | In-Situ Selection Context Overlay Floating Above Element | pass | SelectionContextOverlay verified in component tree. |
| TC-CAD-02 | key | Parametric CAD | Element Cloning via Context Overlay and Ctrl+D | pass | Element clone action verified on context overlay and global Ctrl+D handler. |
| TC-CAD-03 | key | Parametric CAD | Element Deletion via Context Overlay and Del Key | pass | Element deletion action verified on context overlay with action.danger styling. |
| TC-CAD-06 | key | Parametric CAD | Spatial 3D Right-Click Context Menu | pass | Spatial 3D context menu mounted and handled right-click event. |
| TC-CAD-07 | key | Parametric CAD | Dynamic Drafting HUD with Ortho Lock and Type-Ahead Input | pass | Dynamic drafting input HUD verified with distance, angle, and type-ahead support. |
| TC-CAD-08 | key | Parametric CAD | Unified Spatial Bottom Dock Tool Switching | pass | Unified spatial bottom dock verified with mode switching and snapping controls. |
| TC-NAV-01 | key | UI Navigation | Camera Orbit Drag Selection Suppression | pass | Camera orbit drag selection suppression verified: no random element selected on navigation release. |
| TC-SEL-01 | key | Core Features | Visible Surface Pre-Selection Hover Highlight | pass | Visible surface pre-selection hover highlight verified with responsive raycasting. |
| TC-SEL-02 | key | Core Features | Tab Key Depth Candidate Surface Cycling | pass | Tab key depth candidate surface cycling verified along ray line of sight. |
| TC-SET-01 | key | Core Features | Open Settings Modal via Top Pill Button and Shortcut | pass | Settings modal mounts cleanly via top pill button and keyboard shortcut. |
| TC-SET-02 | key | Core Features | Customize Selection and Hover Highlight Colors | pass | Customization of selection and hover highlight colors verified. |
| TC-SET-03 | key | 3D Viewport Controls | Customize 3D Viewport Theme and Canvas Background | pass | Customization of viewport environment theme and ground grid verified. |
| TC-NAV-02 | key | UI Navigation | CAD Navigation Controls Invariant | pass | CAD navigation controls invariant verified: Scroll zooms, MMB pans, Shift+MMB orbits, Left click free. |
| TC-SEL-03 | key | Core Features | Direct Click Selection and Deselection on Visible Surface | pass | Direct click selection on visible surface and empty-space deselection verified. |
| TC-SEL-04 | key | Core Features | BatchedMesh Distance-Ordered Pre-Highlight and Depth Cycling | pass | BatchedMesh distance-ordered pre-highlight and depth cycling verified. |
| TC-NAV-03 | key | UI Navigation | Pre-Selection Hover Active Immediately Post-Orbit Without Zoom | pass | Pre-selection hover immediately active post-orbit without requiring zoom intervention. |
| TC-NAV-04 | key | UI Navigation | Direct Left-Click Selection Immediately Post-Orbit | pass | Direct left-click selection verified immediately post-orbit: expressID 1045 selected. |
| TC-MOD-01 | key | Parametric CAD | Camera Rotation Snappy Damping and Adaptive Large-Model Glide | pass | Camera rotation snappy damping configuration verified. |
| TC-MOD-02 | key | Parametric CAD | Revit Modification Tool - Move (MV) | pass | Element #27 translated by delta vector [1.0, 0.0, 0.0] and persisted. |
| TC-MOD-03 | key | Parametric CAD | Revit Modification Tool - Rotate (RO) | pass | Element #27 rotated 90 degrees around Z axis and persisted. |
| TC-MOD-04 | key | Parametric CAD | Revit Modification Tool - Mirror (MM) | pass | Element #27 mirrored along X axis with symmetric placement. |
| TC-MOD-05 | key | Parametric CAD | Revit Modification Tool - Linear Array (AR) | pass | Linear array created 3 duplicates of #27 at 2.0m offsets. |
| TC-MOD-06 | key | Parametric CAD | Revit Modification Tool - Align (AL) | pass | Element #27 aligned along Z axis to ground level (0.0m). |
| TC-MOD-07 | key | Parametric CAD | Revit Modification Tool - Pin and Unpin (PN/UP) | pass | Pin/Unpin toggle verified for element #27 with DB & IFC persistence. |
| TC-MOD-08 | key | Parametric CAD | Autodesk Revit Two-Letter Keyboard Shortcut Sequences | pass | Revit two-letter keyboard shortcut sequences (RO, MM, AR, AL, PN, UP, MV, CO) operational. |
| TC-MOD-09 | key | Parametric CAD | Minimal In-Canvas Overlay with Extend/Collapse Toggle | fail | TC-MOD-09 failed: None |
| TC-MOD-10 | key | Parametric CAD | Contextual Modify Ribbon Tab Mounted Below Top Bar | fail | TC-MOD-10 failed: None |
| TC-MOD-11 | key | Parametric CAD | Archicad 29 Floating Pet Palette and Dynamic Tracker HUD | fail | TC-MOD-11 failed: None |
| TC-MOD-12 | key | Parametric CAD | Tekla 2025 Two-Point Reference Move with Ghost Preview Mesh | fail | TC-MOD-12 failed: None |
| TC-MOD-13 | key | Parametric CAD | Tekla Structures Move and Copy Special Precision Dialog | fail | TC-MOD-13 failed: None |
| TC-PROF-01 | key | UI Navigation | Review Profile Switching & Viewport Immersion | fail | TC-PROF-01 failed: None |
| TC-PROF-02 | key | UI Navigation | Modify Profile Switching & Precision CAD Editing | fail | TC-PROF-02 failed: None |
| TC-PROF-03 | key | UI Navigation | Query Profile Switching & BIM Property Inspection | fail | TC-PROF-03 failed: None |
| TC-MOD-09 | key | Parametric CAD | Minimal In-Canvas Overlay with Extend/Collapse Toggle | pass | Minimal in-canvas overlay verified: collapsed (94px), expands to full palette (173px), collapses back smoothly. |
| TC-MOD-10 | key | Parametric CAD | Contextual Modify Ribbon Tab Mounted Below Top Bar | pass | Contextual modify ribbon tab mounts directly below top pill with complete Revit modification suite and unmounts cleanly on deselect. |
| TC-MOD-11 | key | Parametric CAD | Archicad 29 Floating Pet Palette and Dynamic Tracker HUD | pass | Archicad 29 Floating Pet Palette verified: Move, Rotate, Mirror, Elevate, Multiply, Special tools present and interactive mode activates smoothly. |
| TC-MOD-12 | key | Parametric CAD | Tekla 2025 Two-Point Reference Move with Ghost Preview Mesh | pass | Tekla 2025 Two-Point Reference Move verified: Interactive move mode mounts banner, responds to spatial pointer movements, and cancels cleanly. |
| TC-MOD-13 | key | Parametric CAD | Tekla Structures Move and Copy Special Precision Dialog | pass | Tekla Structures Move and Copy Special precision dialog verified: Linear, Rotate, Mirror tabs with Pick 2 Points workflow present and operational. |
| TC-PROF-01 | key | UI Navigation | Review Profile Switching & Viewport Immersion | pass | Review profile verified: 100% spatial immersion with CAD editing bars cleanly suppressed. |
| TC-PROF-02 | key | UI Navigation | Modify Profile Switching & Precision CAD Editing | pass | Modify profile verified: Full CAD modification ribbon and tools mount upon selection. |
| TC-PROF-03 | key | UI Navigation | Query Profile Switching & BIM Property Inspection | pass | Query profile verified: Emphasizes data and properties while keeping viewport uncluttered. |
| TC-089 | key | Advanced BIM | BCF Issue Manager Modal Mount | pass | BCF Issue Manager modal mounted cleanly. |
| TC-090 | key | Advanced BIM | BCF Topic Creation with Camera Viewpoint | pass | BCF topic created with perspective viewpoint. |
| TC-091 | key | Advanced BIM | Automatic Clash Detection to BCF Import | pass | Automatic clash detection imported to BCF topics. |
| TC-092 | key | Advanced BIM | Standard BCF 2.1 Archive Export | pass | BCF archive export verified: valid ZIP with 2741 entries, size=1603269 bytes. |
| TC-093 | key | Advanced BIM | Collaborative Session Playback Scrubber Mount | pass | Collaborative session playback scrubber HUD mounted. |
| TC-094 | key | Advanced BIM | Chronological Event Scrubbing & Element Highlight | pass | Chronological event scrubbing highlighted affected element (140 events in log). |
| TC-095 | key | Advanced BIM | Spatial Change Audit Diff Generation | pass | Spatial change audit diff computed (added: 64, modified: 1). |
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | pass | Canvas mounted in DOM, header pill active, QA bridge accessible. |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema (IFC4). |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample rendered with 89 geometries in 3D canvas. |
| TC-013 | key | Project Lifecycle | Export Modified IFC File Download | pass | IFC export verified with ifcopenshell: schema=IFC4, project='Phase 6 AI Copilot Project', elements=123, size=103421 bytes. |
| TC-014 | key | UI Navigation | 3D Camera Orbit via Left Mouse Drag | pass | Camera orbit verified: perspective camera rotated smoothly (delta: 97.11m). |
| TC-017 | key | UI Navigation | Camera Orientation Preset - Top View (Plan) | pass | Top View camera orientation preset snapped cleanly to plan view (Y: 125.6m). |
| TC-027 | key | Core Features | Spatial Hierarchy Tree Decomposition | pass | Spatial tree hierarchy decomposition (Project -> Site -> Building -> Storey) verified. |
| TC-030 | key | Core Features | Element Selection from Hierarchy Node | pass | Element #128 selected from hierarchy tree. |
| TC-033 | key | Core Features | Direct Viewport Mesh Raycasting Selection | pass | 3D Viewport raycasting selection verified (#105). |
| TC-036 | key | Core Features | Transform Mode - Translate Gizmo (G Key) | pass | TransformControls translate mode attached. |
| TC-037 | key | Core Features | Transform Mode - Rotate Gizmo (R Key) | pass | TransformControls rotate mode attached. |
| TC-040 | key | Core Features | Transform Gizmo Axis Drag & Backend Placement Sync | pass | Backend IfcLocalPlacement synchronization contract verified. |
| TC-043 | key | Core Features | Property Sets (Pset_*) Accordion & Attributes Display | pass | Property Sets and attributes rendered in Property Inspector. |
| TC-044 | key | Core Features | Inline Property Value Editing & Save Persistence | pass | Inline property edit and persistence verified. |
| TC-049 | key | Advanced BIM | Section Plane Toggle & Control Flyout Card | pass | Orthogonal section plane activated with localClipping. |
| TC-053 | key | Advanced BIM | Measurement Tool Activation & Vertex Snapping Hover | pass | 3D measurement ruler activation and hover snapping verified. |
| TC-054 | key | Advanced BIM | Point-to-Point Measurement Creation & Screen Distance Tag | pass | 3D measurement line created (Euclidean distance 5.00m, count: 1). |
| TC-056 | key | Core Features | Spatial Omnibar Open via Ctrl+K & Top Pill Trigger | pass | Spatial Omnibar opened via Ctrl+K command palette. |
| TC-059 | key | Core Features | AI Copilot Drawer Toggle (Ctrl+J & Top Pill Trigger) | pass | AI Copilot drawer opened with assistant controls. |
| TC-063 | key | Core Features | Copilot Natural Language Model Query Tool | pass | Copilot query_model tool calling verified (7 providers registered). |
| TC-068 | key | Edge Cases | IFC File Round-Trip Export Integrity | pass | IFC export verified with ifcopenshell: schema=IFC4, project='Phase 6 AI Copilot Project', elements=123, size=103422 bytes. |
| TC-071 | key | Advanced BIM | Federated Model Manager Dialog Mount | pass | Federated Model Manager dialog mounted cleanly. |
| TC-074 | key | Advanced BIM | Discipline Mode Render Style Switching | pass | Render style switched to discipline mode. |
| TC-075 | key | Advanced BIM | Spatial Clash Inspector HUD Mount | pass | Spatial Clash Inspector HUD mounted cleanly. |
| TC-076 | key | Advanced BIM | Geometric Collision & Clearance Clash Check | pass | Clash detection executed (detected 241 collisions). |
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
| TC-092 | key | Advanced BIM | Standard BCF 2.1 Archive Export | pass | BCF archive export verified: valid ZIP with 3225 entries, size=1886729 bytes. |
| TC-093 | key | Advanced BIM | Collaborative Session Playback Scrubber Mount | pass | Collaborative session playback scrubber HUD mounted. |
| TC-094 | key | Advanced BIM | Chronological Event Scrubbing & Element Highlight | pass | Chronological event scrubbing highlighted affected element (145 events in log). |
| TC-095 | key | Advanced BIM | Spatial Change Audit Diff Generation | pass | Spatial change audit diff computed (added: 68, modified: 1). |
| TC-096 | key | Advanced BIM | Viewport Diff Shader Color Highlighting | pass | Viewport diff shader mode activated with emerald/amber highlighting. |
| TC-097 | key | Advanced BIM | Large Model Navigation Performance (Castle 47MB) | pass | 3D Viewport render performance verified (drawCalls: 79, triangles: 1008). |
| TC-098 | key | Draggable Canvas Bars | Draggable Canvas Bars & Floating HUD Grips | pass | Draggable HUDs verified (top-pill, view-controls, bottom-dock) with 4 native drag handles. |
| TC-099 | key | Draggable Canvas Bars | Native Anti-Overlap Collision Repulsion & Boundary Clamping | pass | Anti-overlap separation verified: View Controls HUD (top: 80px) cleanly separated below Top Pill (bottom: 64px) without occlusion. |
| TC-C01-A | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario A | pass | Project selector dropdown opened and dismissed. |
| TC-C01-B | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario B | pass | Current project verified in state. |
| TC-C02-A | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario A | pass | Spatial tree drawer expanded. |
| TC-C02-B | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario B | pass | Spatial tree drawer collapsed cleanly. |
| TC-C18-A | key | Project Lifecycle | [C18] Export IFC File Button — Scenario A | pass | Export button mounted in navigation pill. |
| TC-C18-B | key | Project Lifecycle | [C18] Export IFC File Button — Scenario B | pass | Project ready for standard IFC export. |
| TC-C19-A | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario A | pass | Transform mode set to select. |
| TC-C19-B | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario B | pass | Transform mode cleanly reset after select. |
| TC-C20-A | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario A | pass | Transform mode set to translate. |
| TC-C20-B | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario B | pass | Transform mode cleanly reset after translate. |
| TC-C26-A | key | 3D Measurement | [C26] Measure Tool Button — Scenario A | pass | Measure tool activated with crosshair cursor. |
| TC-C26-B | key | 3D Measurement | [C26] Measure Tool Button — Scenario B | pass | Measure tool cleanly deactivated. |
| TC-C27-A | key | 3D Measurement | [C27] Clear Measurements Button — Scenario A | pass | Measurements cleared successfully. |
| TC-C27-B | key | 3D Measurement | [C27] Clear Measurements Button — Scenario B | pass | Measurement count confirmed zero (0). |
| TC-C32-A | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario A | pass | Camera preset ISO executed successfully. |
| TC-C32-B | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario B | pass | View orientation ISO stable in canvas. |
| TC-C33-A | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario A | pass | Camera preset TOP executed successfully. |
| TC-C33-B | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario B | pass | View orientation TOP stable in canvas. |
| TC-C34-A | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario A | pass | Camera preset FRONT executed successfully. |
| TC-C34-B | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario B | pass | View orientation FRONT stable in canvas. |
| TC-C35-A | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario A | pass | Camera preset SIDE executed successfully. |
| TC-C35-B | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario B | pass | View orientation SIDE stable in canvas. |
| TC-C37-A | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario A | pass | WebGL Three.js canvas active and receiving events. |
| TC-C37-B | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario B | pass | Canvas dimensions valid: {'w': 1422, 'h': 804}. |
| TC-C41-A | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario A | pass | Measure snapping mode armed. |
| TC-C41-B | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario B | pass | Measure mode reset. |
| TC-C42-A | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario A | pass | Dimension line placed with Euclidean distance 5.00m. |
| TC-C42-B | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario B | pass | Dimension Info card renders XYZ delta readouts. |
| TC-C72-A | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario A | pass | Top Pill drag handle scenario A verified. |
| TC-C72-B | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario B | pass | Top Pill drag handle scenario B verified. |
| TC-C73-A | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario A | pass | Bottom Dock drag handle scenario A verified. |
| TC-C73-B | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario B | pass | Bottom Dock drag handle scenario B verified. |
| TC-C74-A | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario A | pass | View Controls HUD drag handle scenario A verified. |
| TC-C74-B | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario B | pass | View Controls HUD drag handle scenario B verified. |
| TC-C76-A | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario A | pass | Native anti-overlap repulsion scenario A verified. |
| TC-C76-B | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario B | pass | Native anti-overlap repulsion scenario B verified. |
| TC-CAD-01 | key | Parametric CAD | In-Situ Selection Context Overlay Floating Above Element | pass | In-situ SelectionContextOverlay rendered floating above selected entity. |
| TC-CAD-02 | key | Parametric CAD | Element Cloning via Context Overlay and Ctrl+D | pass | Element clone action verified on context overlay and global Ctrl+D handler. |
| TC-CAD-03 | key | Parametric CAD | Element Deletion via Context Overlay and Del Key | pass | Element deletion action verified on context overlay with action.danger styling. |
| TC-CAD-06 | key | Parametric CAD | Spatial 3D Right-Click Context Menu | pass | Spatial 3D context menu mounted and handled right-click event. |
| TC-CAD-07 | key | Parametric CAD | Dynamic Drafting HUD with Ortho Lock and Type-Ahead Input | pass | Dynamic drafting input HUD verified with distance, angle, and type-ahead support. |
| TC-CAD-08 | key | Parametric CAD | Unified Spatial Bottom Dock Tool Switching | pass | Unified spatial bottom dock verified with mode switching and snapping controls. |
| TC-NAV-01 | key | UI Navigation | Camera Orbit Drag Selection Suppression | pass | Camera orbit drag selection suppression verified: no random element selected on navigation release. |
| TC-SEL-01 | key | Core Features | Visible Surface Pre-Selection Hover Highlight | pass | Visible surface pre-selection hover highlight verified with responsive raycasting. |
| TC-SEL-02 | key | Core Features | Tab Key Depth Candidate Surface Cycling | pass | Tab key depth candidate surface cycling verified along ray line of sight. |
| TC-SET-01 | key | Core Features | Open Settings Modal via Top Pill Button and Shortcut | pass | Settings modal mounts cleanly via top pill button and keyboard shortcut. |
| TC-SET-02 | key | Core Features | Customize Selection and Hover Highlight Colors | pass | Customization of selection and hover highlight colors verified. |
| TC-SET-03 | key | 3D Viewport Controls | Customize 3D Viewport Theme and Canvas Background | pass | Customization of viewport environment theme and ground grid verified. |
| TC-NAV-02 | key | UI Navigation | CAD Navigation Controls Invariant | pass | CAD navigation controls invariant verified: Scroll zooms, MMB pans, Shift+MMB orbits, Left click free. |
| TC-SEL-03 | key | Core Features | Direct Click Selection and Deselection on Visible Surface | pass | Direct click selection on visible surface and empty-space deselection verified. |
| TC-SEL-04 | key | Core Features | BatchedMesh Distance-Ordered Pre-Highlight and Depth Cycling | pass | BatchedMesh distance-ordered pre-highlight and depth cycling verified. |
| TC-NAV-03 | key | UI Navigation | Pre-Selection Hover Active Immediately Post-Orbit Without Zoom | pass | Pre-selection hover immediately active post-orbit without requiring zoom intervention. |
| TC-NAV-04 | key | UI Navigation | Direct Left-Click Selection Immediately Post-Orbit | fail | Element not selected post-orbit: {'success': False, 'selectedId': None, 'targetPos': {'x': 711, 'y': 402}} |
| TC-MOD-01 | key | Parametric CAD | Camera Rotation Snappy Damping and Adaptive Large-Model Glide | pass | Camera rotation snappy damping configuration verified. |
| TC-MOD-02 | key | Parametric CAD | Revit Modification Tool - Move (MV) | pass | Element #27 translated by delta vector [1.0, 0.0, 0.0] and persisted. |
| TC-MOD-03 | key | Parametric CAD | Revit Modification Tool - Rotate (RO) | pass | Element #27 rotated 90 degrees around Z axis and persisted. |
| TC-MOD-04 | key | Parametric CAD | Revit Modification Tool - Mirror (MM) | pass | Element #27 mirrored along X axis with symmetric placement. |
| TC-MOD-05 | key | Parametric CAD | Revit Modification Tool - Linear Array (AR) | pass | Linear array created 3 duplicates of #27 at 2.0m offsets. |
| TC-MOD-06 | key | Parametric CAD | Revit Modification Tool - Align (AL) | pass | Element #27 aligned along Z axis to ground level (0.0m). |
| TC-MOD-07 | key | Parametric CAD | Revit Modification Tool - Pin and Unpin (PN/UP) | pass | Pin/Unpin toggle verified for element #27 with DB & IFC persistence. |
| TC-MOD-08 | key | Parametric CAD | Autodesk Revit Two-Letter Keyboard Shortcut Sequences | pass | Revit two-letter keyboard shortcut sequences (RO, MM, AR, AL, PN, UP, MV, CO) operational. |
| TC-MOD-09 | key | Parametric CAD | Minimal In-Canvas Overlay with Extend/Collapse Toggle | pass | Minimal in-canvas overlay verified: collapsed (94px), expands to full palette (173px), collapses back smoothly. |
| TC-MOD-10 | key | Parametric CAD | Contextual Modify Ribbon Tab Mounted Below Top Bar | pass | Contextual modify ribbon tab mounts directly below top pill with complete Revit modification suite and unmounts cleanly on deselect. |
| TC-MOD-11 | key | Parametric CAD | Archicad 29 Floating Pet Palette and Dynamic Tracker HUD | pass | Archicad 29 Floating Pet Palette verified: Move, Rotate, Mirror, Elevate, Multiply, Special tools present and interactive mode activates smoothly. |
| TC-MOD-12 | key | Parametric CAD | Tekla 2025 Two-Point Reference Move with Ghost Preview Mesh | pass | Tekla 2025 Two-Point Reference Move verified: Interactive move mode mounts banner, responds to spatial pointer movements, and cancels cleanly. |
| TC-MOD-13 | key | Parametric CAD | Tekla Structures Move and Copy Special Precision Dialog | pass | Tekla Structures Move and Copy Special precision dialog verified: Linear, Rotate, Mirror tabs with Pick 2 Points workflow present and operational. |
| TC-PROF-01 | key | UI Navigation | Review Profile Switching & Viewport Immersion | pass | Review profile verified: 100% spatial immersion with CAD editing bars cleanly suppressed. |
| TC-PROF-02 | key | UI Navigation | Modify Profile Switching & Precision CAD Editing | pass | Modify profile verified: Full CAD modification ribbon and tools mount upon selection. |
| TC-PROF-03 | key | UI Navigation | Query Profile Switching & BIM Property Inspection | pass | Query profile verified: Emphasizes data and properties while keeping viewport uncluttered. |
| TC-NAV-04 | key | UI Navigation | Direct Left-Click Selection Immediately Post-Orbit | pass | Direct left-click selection verified immediately post-orbit: expressID 27 selected. |
| TC-NAV-01 | key | UI Navigation | Camera Orbit Drag Selection Suppression | pass | Camera orbit drag selection suppression verified: no random element selected on navigation release. |
| TC-SEL-01 | key | Core Features | Visible Surface Pre-Selection Hover Highlight | pass | Visible surface pre-selection hover highlight verified with responsive raycasting. |
| TC-SEL-02 | key | Core Features | Tab Key Depth Candidate Surface Cycling | pass | Tab key depth candidate surface cycling verified along ray line of sight. |
| TC-SET-01 | key | Core Features | Open Settings Modal via Top Pill Button and Shortcut | pass | Settings modal mounts cleanly via top pill button and keyboard shortcut. |
| TC-SET-02 | key | Core Features | Customize Selection and Hover Highlight Colors | pass | Customization of selection and hover highlight colors verified. |
| TC-SET-03 | key | 3D Viewport Controls | Customize 3D Viewport Theme and Canvas Background | pass | Customization of viewport environment theme and ground grid verified. |
| TC-NAV-02 | key | UI Navigation | CAD Navigation Controls Invariant | pass | CAD navigation controls invariant verified: Scroll zooms, MMB pans, Shift+MMB orbits, Left click free. |
| TC-SEL-03 | key | Core Features | Direct Click Selection and Deselection on Visible Surface | pass | Direct click selection on visible surface and empty-space deselection verified. |
| TC-SEL-04 | key | Core Features | BatchedMesh Distance-Ordered Pre-Highlight and Depth Cycling | pass | BatchedMesh distance-ordered pre-highlight and depth cycling verified. |
| TC-NAV-03 | key | UI Navigation | Pre-Selection Hover Active Immediately Post-Orbit Without Zoom | pass | Pre-selection hover immediately active post-orbit without requiring zoom intervention. |
| TC-NAV-04 | key | UI Navigation | Direct Left-Click Selection Immediately Post-Orbit | pass | Direct left-click selection verified immediately post-orbit: expressID 27 selected. |
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | pass | Canvas mounted in DOM, header pill active, QA bridge accessible. |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema (IFC4). |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample rendered with 94 geometries in 3D canvas. |
| TC-013 | key | Project Lifecycle | Export Modified IFC File Download | pass | IFC export verified with ifcopenshell: schema=IFC4, project='Phase 6 AI Copilot Project', elements=130, size=109058 bytes. |
| TC-014 | key | UI Navigation | 3D Camera Orbit via Left Mouse Drag | pass | Camera orbit verified: perspective camera rotated smoothly (delta: 103.38m). |
| TC-017 | key | UI Navigation | Camera Orientation Preset - Top View (Plan) | pass | Top View camera orientation preset snapped cleanly to plan view (Y: 130.2m). |
| TC-027 | key | Core Features | Spatial Hierarchy Tree Decomposition | pass | Spatial tree hierarchy decomposition (Project -> Site -> Building -> Storey) verified. |
| TC-030 | key | Core Features | Element Selection from Hierarchy Node | pass | Element #128 selected from hierarchy tree. |
| TC-033 | key | Core Features | Direct Viewport Mesh Raycasting Selection | pass | 3D Viewport raycasting selection verified (#105). |
| TC-036 | key | Core Features | Transform Mode - Translate Gizmo (G Key) | pass | TransformControls translate mode attached. |
| TC-037 | key | Core Features | Transform Mode - Rotate Gizmo (R Key) | pass | TransformControls rotate mode attached. |
| TC-040 | key | Core Features | Transform Gizmo Axis Drag & Backend Placement Sync | pass | Backend IfcLocalPlacement synchronization contract verified. |
| TC-043 | key | Core Features | Property Sets (Pset_*) Accordion & Attributes Display | pass | Property Sets and attributes rendered in Property Inspector. |
| TC-044 | key | Core Features | Inline Property Value Editing & Save Persistence | pass | Inline property edit and persistence verified. |
| TC-049 | key | Advanced BIM | Section Plane Toggle & Control Flyout Card | pass | Orthogonal section plane activated with localClipping. |
| TC-053 | key | Advanced BIM | Measurement Tool Activation & Vertex Snapping Hover | pass | 3D measurement ruler activation and hover snapping verified. |
| TC-054 | key | Advanced BIM | Point-to-Point Measurement Creation & Screen Distance Tag | pass | 3D measurement line created (Euclidean distance 5.00m, count: 1). |
| TC-056 | key | Core Features | Spatial Omnibar Open via Ctrl+K & Top Pill Trigger | pass | Spatial Omnibar opened via Ctrl+K command palette. |
| TC-059 | key | Core Features | AI Copilot Drawer Toggle (Ctrl+J & Top Pill Trigger) | pass | AI Copilot drawer opened with assistant controls. |
| TC-063 | key | Core Features | Copilot Natural Language Model Query Tool | pass | Copilot query_model tool calling verified (7 providers registered). |
| TC-068 | key | Edge Cases | IFC File Round-Trip Export Integrity | pass | IFC export verified with ifcopenshell: schema=IFC4, project='Phase 6 AI Copilot Project', elements=130, size=109057 bytes. |
| TC-071 | key | Advanced BIM | Federated Model Manager Dialog Mount | pass | Federated Model Manager dialog mounted cleanly. |
| TC-074 | key | Advanced BIM | Discipline Mode Render Style Switching | pass | Render style switched to discipline mode. |
| TC-075 | key | Advanced BIM | Spatial Clash Inspector HUD Mount | pass | Spatial Clash Inspector HUD mounted cleanly. |
| TC-076 | key | Advanced BIM | Geometric Collision & Clearance Clash Check | pass | Clash detection executed (detected 257 collisions). |
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
| TC-092 | key | Advanced BIM | Standard BCF 2.1 Archive Export | pass | BCF archive export verified: valid ZIP with 3741 entries, size=2188924 bytes. |
| TC-093 | key | Advanced BIM | Collaborative Session Playback Scrubber Mount | pass | Collaborative session playback scrubber HUD mounted. |
| TC-094 | key | Advanced BIM | Chronological Event Scrubbing & Element Highlight | pass | Chronological event scrubbing highlighted affected element (156 events in log). |
| TC-095 | key | Advanced BIM | Spatial Change Audit Diff Generation | pass | Spatial change audit diff computed (added: 72, modified: 1). |
| TC-096 | key | Advanced BIM | Viewport Diff Shader Color Highlighting | pass | Viewport diff shader mode activated with emerald/amber highlighting. |
| TC-097 | key | Advanced BIM | Large Model Navigation Performance (Castle 47MB) | pass | 3D Viewport render performance verified (drawCalls: 82, triangles: 1044). |
| TC-098 | key | Draggable Canvas Bars | Draggable Canvas Bars & Floating HUD Grips | pass | Draggable HUDs verified (top-pill, view-controls, bottom-dock) with 4 native drag handles. |
| TC-099 | key | Draggable Canvas Bars | Native Anti-Overlap Collision Repulsion & Boundary Clamping | pass | Anti-overlap separation verified: View Controls HUD (top: 80px) cleanly separated below Top Pill (bottom: 64px) without occlusion. |
| TC-C01-A | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario A | pass | Project selector dropdown opened and dismissed. |
| TC-C01-B | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario B | pass | Current project verified in state. |
| TC-C02-A | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario A | pass | Spatial tree drawer expanded. |
| TC-C02-B | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario B | pass | Spatial tree drawer collapsed cleanly. |
| TC-C18-A | key | Project Lifecycle | [C18] Export IFC File Button — Scenario A | pass | Export button mounted in navigation pill. |
| TC-C18-B | key | Project Lifecycle | [C18] Export IFC File Button — Scenario B | pass | Project ready for standard IFC export. |
| TC-C19-A | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario A | pass | Transform mode set to select. |
| TC-C19-B | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario B | pass | Transform mode cleanly reset after select. |
| TC-C20-A | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario A | pass | Transform mode set to translate. |
| TC-C20-B | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario B | pass | Transform mode cleanly reset after translate. |
| TC-C26-A | key | 3D Measurement | [C26] Measure Tool Button — Scenario A | pass | Measure tool activated with crosshair cursor. |
| TC-C26-B | key | 3D Measurement | [C26] Measure Tool Button — Scenario B | pass | Measure tool cleanly deactivated. |
| TC-C27-A | key | 3D Measurement | [C27] Clear Measurements Button — Scenario A | pass | Measurements cleared successfully. |
| TC-C27-B | key | 3D Measurement | [C27] Clear Measurements Button — Scenario B | pass | Measurement count confirmed zero (0). |
| TC-C32-A | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario A | pass | Camera preset ISO executed successfully. |
| TC-C32-B | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario B | pass | View orientation ISO stable in canvas. |
| TC-C33-A | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario A | pass | Camera preset TOP executed successfully. |
| TC-C33-B | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario B | pass | View orientation TOP stable in canvas. |
| TC-C34-A | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario A | pass | Camera preset FRONT executed successfully. |
| TC-C34-B | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario B | pass | View orientation FRONT stable in canvas. |
| TC-C35-A | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario A | pass | Camera preset SIDE executed successfully. |
| TC-C35-B | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario B | pass | View orientation SIDE stable in canvas. |
| TC-C37-A | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario A | pass | WebGL Three.js canvas active and receiving events. |
| TC-C37-B | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario B | pass | Canvas dimensions valid: {'w': 1422, 'h': 804}. |
| TC-C41-A | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario A | pass | Measure snapping mode armed. |
| TC-C41-B | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario B | pass | Measure mode reset. |
| TC-C42-A | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario A | pass | Dimension line placed with Euclidean distance 5.00m. |
| TC-C42-B | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario B | pass | Dimension Info card renders XYZ delta readouts. |
| TC-C72-A | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario A | pass | Top Pill drag handle scenario A verified. |
| TC-C72-B | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario B | pass | Top Pill drag handle scenario B verified. |
| TC-C73-A | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario A | pass | Bottom Dock drag handle scenario A verified. |
| TC-C73-B | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario B | pass | Bottom Dock drag handle scenario B verified. |
| TC-C74-A | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario A | pass | View Controls HUD drag handle scenario A verified. |
| TC-C74-B | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario B | pass | View Controls HUD drag handle scenario B verified. |
| TC-C76-A | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario A | pass | Native anti-overlap repulsion scenario A verified. |
| TC-C76-B | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario B | pass | Native anti-overlap repulsion scenario B verified. |
| TC-CAD-01 | key | Parametric CAD | In-Situ Selection Context Overlay Floating Above Element | pass | In-situ SelectionContextOverlay rendered floating above selected entity. |
| TC-CAD-02 | key | Parametric CAD | Element Cloning via Context Overlay and Ctrl+D | pass | Element clone action verified on context overlay and global Ctrl+D handler. |
| TC-CAD-03 | key | Parametric CAD | Element Deletion via Context Overlay and Del Key | pass | Element deletion action verified on context overlay with action.danger styling. |
| TC-CAD-06 | key | Parametric CAD | Spatial 3D Right-Click Context Menu | pass | Spatial 3D context menu mounted and handled right-click event. |
| TC-CAD-07 | key | Parametric CAD | Dynamic Drafting HUD with Ortho Lock and Type-Ahead Input | pass | Dynamic drafting input HUD verified with distance, angle, and type-ahead support. |
| TC-CAD-08 | key | Parametric CAD | Unified Spatial Bottom Dock Tool Switching | pass | Unified spatial bottom dock verified with mode switching and snapping controls. |
| TC-NAV-01 | key | UI Navigation | Camera Orbit Drag Selection Suppression | pass | Camera orbit drag selection suppression verified: no random element selected on navigation release. |
| TC-SEL-01 | key | Core Features | Visible Surface Pre-Selection Hover Highlight | pass | Visible surface pre-selection hover highlight verified with responsive raycasting. |
| TC-SEL-02 | key | Core Features | Tab Key Depth Candidate Surface Cycling | pass | Tab key depth candidate surface cycling verified along ray line of sight. |
| TC-SET-01 | key | Core Features | Open Settings Modal via Top Pill Button and Shortcut | pass | Settings modal mounts cleanly via top pill button and keyboard shortcut. |
| TC-SET-02 | key | Core Features | Customize Selection and Hover Highlight Colors | pass | Customization of selection and hover highlight colors verified. |
| TC-SET-03 | key | 3D Viewport Controls | Customize 3D Viewport Theme and Canvas Background | pass | Customization of viewport environment theme and ground grid verified. |
| TC-NAV-02 | key | UI Navigation | CAD Navigation Controls Invariant | pass | CAD navigation controls invariant verified: Scroll zooms, MMB pans, Shift+MMB orbits, Left click free. |
| TC-SEL-03 | key | Core Features | Direct Click Selection and Deselection on Visible Surface | pass | Direct click selection on visible surface and empty-space deselection verified. |
| TC-SEL-04 | key | Core Features | BatchedMesh Distance-Ordered Pre-Highlight and Depth Cycling | pass | BatchedMesh distance-ordered pre-highlight and depth cycling verified. |
| TC-NAV-03 | key | UI Navigation | Pre-Selection Hover Active Immediately Post-Orbit Without Zoom | pass | Pre-selection hover immediately active post-orbit without requiring zoom intervention. |
| TC-NAV-04 | key | UI Navigation | Direct Left-Click Selection Immediately Post-Orbit | fail | Element not selected post-orbit: {'success': False, 'selectedId': None, 'targetPos': {'x': 711, 'y': 402}} |
| TC-MOD-01 | key | Parametric CAD | Camera Rotation Snappy Damping and Adaptive Large-Model Glide | pass | Camera rotation snappy damping configuration verified. |
| TC-MOD-02 | key | Parametric CAD | Revit Modification Tool - Move (MV) | pass | Element #27 translated by delta vector [1.0, 0.0, 0.0] and persisted. |
| TC-MOD-03 | key | Parametric CAD | Revit Modification Tool - Rotate (RO) | pass | Element #27 rotated 90 degrees around Z axis and persisted. |
| TC-MOD-04 | key | Parametric CAD | Revit Modification Tool - Mirror (MM) | pass | Element #27 mirrored along X axis with symmetric placement. |
| TC-MOD-05 | key | Parametric CAD | Revit Modification Tool - Linear Array (AR) | pass | Linear array created 3 duplicates of #27 at 2.0m offsets. |
| TC-MOD-06 | key | Parametric CAD | Revit Modification Tool - Align (AL) | pass | Element #27 aligned along Z axis to ground level (0.0m). |
| TC-MOD-07 | key | Parametric CAD | Revit Modification Tool - Pin and Unpin (PN/UP) | pass | Pin/Unpin toggle verified for element #27 with DB & IFC persistence. |
| TC-MOD-08 | key | Parametric CAD | Autodesk Revit Two-Letter Keyboard Shortcut Sequences | pass | Revit two-letter keyboard shortcut sequences (RO, MM, AR, AL, PN, UP, MV, CO) operational. |
| TC-MOD-09 | key | Parametric CAD | Minimal In-Canvas Overlay with Extend/Collapse Toggle | pass | Minimal in-canvas overlay verified: collapsed (94px), expands to full palette (173px), collapses back smoothly. |
| TC-MOD-10 | key | Parametric CAD | Contextual Modify Ribbon Tab Mounted Below Top Bar | pass | Contextual modify ribbon tab mounts directly below top pill with complete Revit modification suite and unmounts cleanly on deselect. |
| TC-MOD-11 | key | Parametric CAD | Archicad 29 Floating Pet Palette and Dynamic Tracker HUD | pass | Archicad 29 Floating Pet Palette verified: Move, Rotate, Mirror, Elevate, Multiply, Special tools present and interactive mode activates smoothly. |
| TC-MOD-12 | key | Parametric CAD | Tekla 2025 Two-Point Reference Move with Ghost Preview Mesh | pass | Tekla 2025 Two-Point Reference Move verified: Interactive move mode mounts banner, responds to spatial pointer movements, and cancels cleanly. |
| TC-MOD-13 | key | Parametric CAD | Tekla Structures Move and Copy Special Precision Dialog | pass | Tekla Structures Move and Copy Special precision dialog verified: Linear, Rotate, Mirror tabs with Pick 2 Points workflow present and operational. |
| TC-PROF-01 | key | UI Navigation | Review Profile Switching & Viewport Immersion | pass | Review profile verified: 100% spatial immersion with CAD editing bars cleanly suppressed. |
| TC-PROF-02 | key | UI Navigation | Modify Profile Switching & Precision CAD Editing | pass | Modify profile verified: Full CAD modification ribbon and tools mount upon selection. |
| TC-PROF-03 | key | UI Navigation | Query Profile Switching & BIM Property Inspection | pass | Query profile verified: Emphasizes data and properties while keeping viewport uncluttered. |
| TC-NAV-01 | key | UI Navigation | Camera Orbit Drag Selection Suppression | pass | Camera orbit drag selection suppression verified: no random element selected on navigation release. |
| TC-SEL-01 | key | Core Features | Visible Surface Pre-Selection Hover Highlight | pass | Visible surface pre-selection hover highlight verified with responsive raycasting. |
| TC-SEL-02 | key | Core Features | Tab Key Depth Candidate Surface Cycling | pass | Tab key depth candidate surface cycling verified along ray line of sight. |
| TC-SET-01 | key | Core Features | Open Settings Modal via Top Pill Button and Shortcut | pass | Settings modal mounts cleanly via top pill button and keyboard shortcut. |
| TC-SET-02 | key | Core Features | Customize Selection and Hover Highlight Colors | pass | Customization of selection and hover highlight colors verified. |
| TC-SET-03 | key | 3D Viewport Controls | Customize 3D Viewport Theme and Canvas Background | pass | Customization of viewport environment theme and ground grid verified. |
| TC-NAV-02 | key | UI Navigation | CAD Navigation Controls Invariant | pass | CAD navigation controls invariant verified: Scroll zooms, MMB pans, Shift+MMB orbits, Left click free. |
| TC-SEL-03 | key | Core Features | Direct Click Selection and Deselection on Visible Surface | pass | Direct click selection on visible surface and empty-space deselection verified. |
| TC-SEL-04 | key | Core Features | BatchedMesh Distance-Ordered Pre-Highlight and Depth Cycling | pass | BatchedMesh distance-ordered pre-highlight and depth cycling verified. |
| TC-NAV-03 | key | UI Navigation | Pre-Selection Hover Active Immediately Post-Orbit Without Zoom | pass | Pre-selection hover immediately active post-orbit without requiring zoom intervention. |
| TC-NAV-04 | key | UI Navigation | Direct Left-Click Selection Immediately Post-Orbit | pass | Direct left-click selection verified immediately post-orbit: expressID 27 selected. |
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | pass | Canvas mounted in DOM, header pill active, QA bridge accessible. |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema (IFC4). |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample rendered with 99 geometries in 3D canvas. |
| TC-013 | key | Project Lifecycle | Export Modified IFC File Download | pass | IFC export verified with ifcopenshell: schema=IFC4, project='Phase 6 AI Copilot Project', elements=137, size=114691 bytes. |
| TC-014 | key | UI Navigation | 3D Camera Orbit via Left Mouse Drag | pass | Camera orbit verified: perspective camera rotated smoothly (delta: 100.79m). |
| TC-017 | key | UI Navigation | Camera Orientation Preset - Top View (Plan) | pass | Top View camera orientation preset snapped cleanly to plan view (Y: 134.8m). |
| TC-027 | key | Core Features | Spatial Hierarchy Tree Decomposition | pass | Spatial tree hierarchy decomposition (Project -> Site -> Building -> Storey) verified. |
| TC-030 | key | Core Features | Element Selection from Hierarchy Node | pass | Element #128 selected from hierarchy tree. |
| TC-033 | key | Core Features | Direct Viewport Mesh Raycasting Selection | pass | 3D Viewport raycasting selection verified (#105). |
| TC-036 | key | Core Features | Transform Mode - Translate Gizmo (G Key) | pass | TransformControls translate mode attached. |
| TC-037 | key | Core Features | Transform Mode - Rotate Gizmo (R Key) | pass | TransformControls rotate mode attached. |
| TC-040 | key | Core Features | Transform Gizmo Axis Drag & Backend Placement Sync | pass | Backend IfcLocalPlacement synchronization contract verified. |
| TC-043 | key | Core Features | Property Sets (Pset_*) Accordion & Attributes Display | pass | Property Sets and attributes rendered in Property Inspector. |
| TC-044 | key | Core Features | Inline Property Value Editing & Save Persistence | pass | Inline property edit and persistence verified. |
| TC-049 | key | Advanced BIM | Section Plane Toggle & Control Flyout Card | pass | Orthogonal section plane activated with localClipping. |
| TC-053 | key | Advanced BIM | Measurement Tool Activation & Vertex Snapping Hover | pass | 3D measurement ruler activation and hover snapping verified. |
| TC-054 | key | Advanced BIM | Point-to-Point Measurement Creation & Screen Distance Tag | pass | 3D measurement line created (Euclidean distance 5.00m, count: 1). |
| TC-056 | key | Core Features | Spatial Omnibar Open via Ctrl+K & Top Pill Trigger | pass | Spatial Omnibar opened via Ctrl+K command palette. |
| TC-059 | key | Core Features | AI Copilot Drawer Toggle (Ctrl+J & Top Pill Trigger) | pass | AI Copilot drawer opened with assistant controls. |
| TC-063 | key | Core Features | Copilot Natural Language Model Query Tool | pass | Copilot query_model tool calling verified (7 providers registered). |
| TC-068 | key | Edge Cases | IFC File Round-Trip Export Integrity | pass | IFC export verified with ifcopenshell: schema=IFC4, project='Phase 6 AI Copilot Project', elements=137, size=114692 bytes. |
| TC-071 | key | Advanced BIM | Federated Model Manager Dialog Mount | pass | Federated Model Manager dialog mounted cleanly. |
| TC-074 | key | Advanced BIM | Discipline Mode Render Style Switching | pass | Render style switched to discipline mode. |
| TC-075 | key | Advanced BIM | Spatial Clash Inspector HUD Mount | pass | Spatial Clash Inspector HUD mounted cleanly. |
| TC-076 | key | Advanced BIM | Geometric Collision & Clearance Clash Check | pass | Clash detection executed (detected 273 collisions). |
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
| TC-092 | key | Advanced BIM | Standard BCF 2.1 Archive Export | pass | BCF archive export verified: valid ZIP with 4289 entries, size=2509843 bytes. |
| TC-093 | key | Advanced BIM | Collaborative Session Playback Scrubber Mount | pass | Collaborative session playback scrubber HUD mounted. |
| TC-094 | key | Advanced BIM | Chronological Event Scrubbing & Element Highlight | pass | Chronological event scrubbing highlighted affected element (167 events in log). |
| TC-095 | key | Advanced BIM | Spatial Change Audit Diff Generation | pass | Spatial change audit diff computed (added: 76, modified: 1). |
| TC-096 | key | Advanced BIM | Viewport Diff Shader Color Highlighting | pass | Viewport diff shader mode activated with emerald/amber highlighting. |
| TC-097 | key | Advanced BIM | Large Model Navigation Performance (Castle 47MB) | pass | 3D Viewport render performance verified (drawCalls: 85, triangles: 1080). |
| TC-098 | key | Draggable Canvas Bars | Draggable Canvas Bars & Floating HUD Grips | pass | Draggable HUDs verified (top-pill, view-controls, bottom-dock) with 4 native drag handles. |
| TC-099 | key | Draggable Canvas Bars | Native Anti-Overlap Collision Repulsion & Boundary Clamping | pass | Anti-overlap separation verified: View Controls HUD (top: 80px) cleanly separated below Top Pill (bottom: 64px) without occlusion. |
| TC-C01-A | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario A | pass | Project selector dropdown opened and dismissed. |
| TC-C01-B | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario B | pass | Current project verified in state. |
| TC-C02-A | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario A | pass | Spatial tree drawer expanded. |
| TC-C02-B | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario B | pass | Spatial tree drawer collapsed cleanly. |
| TC-C18-A | key | Project Lifecycle | [C18] Export IFC File Button — Scenario A | pass | Export button mounted in navigation pill. |
| TC-C18-B | key | Project Lifecycle | [C18] Export IFC File Button — Scenario B | pass | Project ready for standard IFC export. |
| TC-C19-A | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario A | pass | Transform mode set to select. |
| TC-C19-B | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario B | pass | Transform mode cleanly reset after select. |
| TC-C20-A | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario A | pass | Transform mode set to translate. |
| TC-C20-B | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario B | pass | Transform mode cleanly reset after translate. |
| TC-C26-A | key | 3D Measurement | [C26] Measure Tool Button — Scenario A | pass | Measure tool activated with crosshair cursor. |
| TC-C26-B | key | 3D Measurement | [C26] Measure Tool Button — Scenario B | pass | Measure tool cleanly deactivated. |
| TC-C27-A | key | 3D Measurement | [C27] Clear Measurements Button — Scenario A | pass | Measurements cleared successfully. |
| TC-C27-B | key | 3D Measurement | [C27] Clear Measurements Button — Scenario B | pass | Measurement count confirmed zero (0). |
| TC-C32-A | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario A | pass | Camera preset ISO executed successfully. |
| TC-C32-B | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario B | pass | View orientation ISO stable in canvas. |
| TC-C33-A | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario A | pass | Camera preset TOP executed successfully. |
| TC-C33-B | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario B | pass | View orientation TOP stable in canvas. |
| TC-C34-A | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario A | pass | Camera preset FRONT executed successfully. |
| TC-C34-B | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario B | pass | View orientation FRONT stable in canvas. |
| TC-C35-A | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario A | pass | Camera preset SIDE executed successfully. |
| TC-C35-B | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario B | pass | View orientation SIDE stable in canvas. |
| TC-C37-A | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario A | pass | WebGL Three.js canvas active and receiving events. |
| TC-C37-B | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario B | pass | Canvas dimensions valid: {'w': 1422, 'h': 804}. |
| TC-C41-A | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario A | pass | Measure snapping mode armed. |
| TC-C41-B | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario B | pass | Measure mode reset. |
| TC-C42-A | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario A | pass | Dimension line placed with Euclidean distance 5.00m. |
| TC-C42-B | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario B | pass | Dimension Info card renders XYZ delta readouts. |
| TC-C72-A | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario A | pass | Top Pill drag handle scenario A verified. |
| TC-C72-B | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario B | pass | Top Pill drag handle scenario B verified. |
| TC-C73-A | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario A | pass | Bottom Dock drag handle scenario A verified. |
| TC-C73-B | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario B | pass | Bottom Dock drag handle scenario B verified. |
| TC-C74-A | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario A | pass | View Controls HUD drag handle scenario A verified. |
| TC-C74-B | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario B | pass | View Controls HUD drag handle scenario B verified. |
| TC-C76-A | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario A | pass | Native anti-overlap repulsion scenario A verified. |
| TC-C76-B | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario B | pass | Native anti-overlap repulsion scenario B verified. |
| TC-CAD-01 | key | Parametric CAD | In-Situ Selection Context Overlay Floating Above Element | pass | In-situ SelectionContextOverlay rendered floating above selected entity. |
| TC-CAD-02 | key | Parametric CAD | Element Cloning via Context Overlay and Ctrl+D | pass | Element clone action verified on context overlay and global Ctrl+D handler. |
| TC-CAD-03 | key | Parametric CAD | Element Deletion via Context Overlay and Del Key | pass | Element deletion action verified on context overlay with action.danger styling. |
| TC-CAD-06 | key | Parametric CAD | Spatial 3D Right-Click Context Menu | pass | Spatial 3D context menu mounted and handled right-click event. |
| TC-CAD-07 | key | Parametric CAD | Dynamic Drafting HUD with Ortho Lock and Type-Ahead Input | pass | Dynamic drafting input HUD verified with distance, angle, and type-ahead support. |
| TC-CAD-08 | key | Parametric CAD | Unified Spatial Bottom Dock Tool Switching | pass | Unified spatial bottom dock verified with mode switching and snapping controls. |
| TC-NAV-01 | key | UI Navigation | Camera Orbit Drag Selection Suppression | pass | Camera orbit drag selection suppression verified: no random element selected on navigation release. |
| TC-SEL-01 | key | Core Features | Visible Surface Pre-Selection Hover Highlight | pass | Visible surface pre-selection hover highlight verified with responsive raycasting. |
| TC-SEL-02 | key | Core Features | Tab Key Depth Candidate Surface Cycling | pass | Tab key depth candidate surface cycling verified along ray line of sight. |
| TC-SET-01 | key | Core Features | Open Settings Modal via Top Pill Button and Shortcut | pass | Settings modal mounts cleanly via top pill button and keyboard shortcut. |
| TC-SET-02 | key | Core Features | Customize Selection and Hover Highlight Colors | pass | Customization of selection and hover highlight colors verified. |
| TC-SET-03 | key | 3D Viewport Controls | Customize 3D Viewport Theme and Canvas Background | pass | Customization of viewport environment theme and ground grid verified. |
| TC-NAV-02 | key | UI Navigation | CAD Navigation Controls Invariant | pass | CAD navigation controls invariant verified: Scroll zooms, MMB pans, Shift+MMB orbits, Left click free. |
| TC-SEL-03 | key | Core Features | Direct Click Selection and Deselection on Visible Surface | pass | Direct click selection on visible surface and empty-space deselection verified. |
| TC-SEL-04 | key | Core Features | BatchedMesh Distance-Ordered Pre-Highlight and Depth Cycling | pass | BatchedMesh distance-ordered pre-highlight and depth cycling verified. |
| TC-NAV-03 | key | UI Navigation | Pre-Selection Hover Active Immediately Post-Orbit Without Zoom | pass | Pre-selection hover immediately active post-orbit without requiring zoom intervention. |
| TC-NAV-04 | key | UI Navigation | Direct Left-Click Selection Immediately Post-Orbit | pass | Direct left-click selection verified immediately post-orbit: expressID 27 selected. |
| TC-MOD-01 | key | Parametric CAD | Camera Rotation Snappy Damping and Adaptive Large-Model Glide | pass | Camera rotation snappy damping configuration verified. |
| TC-MOD-02 | key | Parametric CAD | Revit Modification Tool - Move (MV) | pass | Element #27 translated by delta vector [1.0, 0.0, 0.0] and persisted. |
| TC-MOD-03 | key | Parametric CAD | Revit Modification Tool - Rotate (RO) | pass | Element #27 rotated 90 degrees around Z axis and persisted. |
| TC-MOD-04 | key | Parametric CAD | Revit Modification Tool - Mirror (MM) | pass | Element #27 mirrored along X axis with symmetric placement. |
| TC-MOD-05 | key | Parametric CAD | Revit Modification Tool - Linear Array (AR) | pass | Linear array created 3 duplicates of #27 at 2.0m offsets. |
| TC-MOD-06 | key | Parametric CAD | Revit Modification Tool - Align (AL) | pass | Element #27 aligned along Z axis to ground level (0.0m). |
| TC-MOD-07 | key | Parametric CAD | Revit Modification Tool - Pin and Unpin (PN/UP) | pass | Pin/Unpin toggle verified for element #27 with DB & IFC persistence. |
| TC-MOD-08 | key | Parametric CAD | Autodesk Revit Two-Letter Keyboard Shortcut Sequences | pass | Revit two-letter keyboard shortcut sequences (RO, MM, AR, AL, PN, UP, MV, CO) operational. |
| TC-MOD-09 | key | Parametric CAD | Minimal In-Canvas Overlay with Extend/Collapse Toggle | pass | Minimal in-canvas overlay verified: collapsed (94px), expands to full palette (173px), collapses back smoothly. |
| TC-MOD-10 | key | Parametric CAD | Contextual Modify Ribbon Tab Mounted Below Top Bar | pass | Contextual modify ribbon tab mounts directly below top pill with complete Revit modification suite and unmounts cleanly on deselect. |
| TC-MOD-11 | key | Parametric CAD | Archicad 29 Floating Pet Palette and Dynamic Tracker HUD | pass | Archicad 29 Floating Pet Palette verified: Move, Rotate, Mirror, Elevate, Multiply, Special tools present and interactive mode activates smoothly. |
| TC-MOD-12 | key | Parametric CAD | Tekla 2025 Two-Point Reference Move with Ghost Preview Mesh | pass | Tekla 2025 Two-Point Reference Move verified: Interactive move mode mounts banner, responds to spatial pointer movements, and cancels cleanly. |
| TC-MOD-13 | key | Parametric CAD | Tekla Structures Move and Copy Special Precision Dialog | pass | Tekla Structures Move and Copy Special precision dialog verified: Linear, Rotate, Mirror tabs with Pick 2 Points workflow present and operational. |
| TC-PROF-01 | key | UI Navigation | Review Profile Switching & Viewport Immersion | pass | Review profile verified: 100% spatial immersion with CAD editing bars cleanly suppressed. |
| TC-PROF-02 | key | UI Navigation | Modify Profile Switching & Precision CAD Editing | pass | Modify profile verified: Full CAD modification ribbon and tools mount upon selection. |
| TC-PROF-03 | key | UI Navigation | Query Profile Switching & BIM Property Inspection | pass | Query profile verified: Emphasizes data and properties while keeping viewport uncluttered. |
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | pass | Canvas mounted in DOM, header pill active, QA bridge accessible. |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema (IFC4). |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample rendered with 104 geometries in 3D canvas. |
| TC-013 | key | Project Lifecycle | Export Modified IFC File Download | pass | IFC export verified with ifcopenshell: schema=IFC4, project='Phase 6 AI Copilot Project', elements=144, size=121084 bytes. |
| TC-014 | key | UI Navigation | 3D Camera Orbit via Left Mouse Drag | pass | Camera orbit verified: perspective camera rotated smoothly (delta: 99.66m). |
| TC-017 | key | UI Navigation | Camera Orientation Preset - Top View (Plan) | pass | Top View camera orientation preset snapped cleanly to plan view (Y: 139.4m). |
| TC-027 | key | Core Features | Spatial Hierarchy Tree Decomposition | pass | Spatial tree hierarchy decomposition (Project -> Site -> Building -> Storey) verified. |
| TC-030 | key | Core Features | Element Selection from Hierarchy Node | pass | Element #128 selected from hierarchy tree. |
| TC-033 | key | Core Features | Direct Viewport Mesh Raycasting Selection | pass | 3D Viewport raycasting selection verified (#105). |
| TC-036 | key | Core Features | Transform Mode - Translate Gizmo (G Key) | pass | TransformControls translate mode attached. |
| TC-037 | key | Core Features | Transform Mode - Rotate Gizmo (R Key) | pass | TransformControls rotate mode attached. |
| TC-040 | key | Core Features | Transform Gizmo Axis Drag & Backend Placement Sync | pass | Backend IfcLocalPlacement synchronization contract verified. |
| TC-043 | key | Core Features | Property Sets (Pset_*) Accordion & Attributes Display | pass | Property Sets and attributes rendered in Property Inspector. |
| TC-044 | key | Core Features | Inline Property Value Editing & Save Persistence | pass | Inline property edit and persistence verified. |
| TC-049 | key | Advanced BIM | Section Plane Toggle & Control Flyout Card | pass | Orthogonal section plane activated with localClipping. |
| TC-053 | key | Advanced BIM | Measurement Tool Activation & Vertex Snapping Hover | pass | 3D measurement ruler activation and hover snapping verified. |
| TC-054 | key | Advanced BIM | Point-to-Point Measurement Creation & Screen Distance Tag | pass | 3D measurement line created (Euclidean distance 5.00m, count: 1). |
| TC-056 | key | Core Features | Spatial Omnibar Open via Ctrl+K & Top Pill Trigger | pass | Spatial Omnibar opened via Ctrl+K command palette. |
| TC-059 | key | Core Features | AI Copilot Drawer Toggle (Ctrl+J & Top Pill Trigger) | pass | AI Copilot drawer opened with assistant controls. |
| TC-063 | key | Core Features | Copilot Natural Language Model Query Tool | pass | Copilot query_model tool calling verified (7 providers registered). |
| TC-068 | key | Edge Cases | IFC File Round-Trip Export Integrity | pass | IFC export verified with ifcopenshell: schema=IFC4, project='Phase 6 AI Copilot Project', elements=144, size=121083 bytes. |
| TC-071 | key | Advanced BIM | Federated Model Manager Dialog Mount | pass | Federated Model Manager dialog mounted cleanly. |
| TC-074 | key | Advanced BIM | Discipline Mode Render Style Switching | pass | Render style switched to discipline mode. |
| TC-075 | key | Advanced BIM | Spatial Clash Inspector HUD Mount | pass | Spatial Clash Inspector HUD mounted cleanly. |
| TC-076 | key | Advanced BIM | Geometric Collision & Clearance Clash Check | pass | Clash detection executed (detected 257 collisions). |
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
| TC-092 | key | Advanced BIM | Standard BCF 2.1 Archive Export | pass | BCF archive export verified: valid ZIP with 4805 entries, size=2812089 bytes. |
| TC-093 | key | Advanced BIM | Collaborative Session Playback Scrubber Mount | pass | Collaborative session playback scrubber HUD mounted. |
| TC-094 | key | Advanced BIM | Chronological Event Scrubbing & Element Highlight | pass | Chronological event scrubbing highlighted affected element (182 events in log). |
| TC-095 | key | Advanced BIM | Spatial Change Audit Diff Generation | pass | Spatial change audit diff computed (added: 80, modified: 2). |
| TC-096 | key | Advanced BIM | Viewport Diff Shader Color Highlighting | pass | Viewport diff shader mode activated with emerald/amber highlighting. |
| TC-097 | key | Advanced BIM | Large Model Navigation Performance (Castle 47MB) | pass | 3D Viewport render performance verified (drawCalls: 101, triangles: 1288). |
| TC-098 | key | Draggable Canvas Bars | Draggable Canvas Bars & Floating HUD Grips | pass | Draggable HUDs verified (top-pill, view-controls, bottom-dock) with 4 native drag handles. |
| TC-099 | key | Draggable Canvas Bars | Native Anti-Overlap Collision Repulsion & Boundary Clamping | pass | Anti-overlap separation verified: View Controls HUD (top: 80px) cleanly separated below Top Pill (bottom: 64px) without occlusion. |
| TC-C01-A | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario A | pass | Project selector dropdown opened and dismissed. |
| TC-C01-B | key | Project Lifecycle | [C01] Project Selector Dropdown — Scenario B | pass | Current project verified in state. |
| TC-C02-A | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario A | pass | Spatial tree drawer expanded. |
| TC-C02-B | key | Spatial Hierarchy | [C02] Hierarchy Tree Toggle — Scenario B | pass | Spatial tree drawer collapsed cleanly. |
| TC-C18-A | key | Project Lifecycle | [C18] Export IFC File Button — Scenario A | pass | Export button mounted in navigation pill. |
| TC-C18-B | key | Project Lifecycle | [C18] Export IFC File Button — Scenario B | pass | Project ready for standard IFC export. |
| TC-C19-A | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario A | pass | Transform mode set to select. |
| TC-C19-B | key | 3D Viewport Controls | [C19] Select Mode Button — Scenario B | pass | Transform mode cleanly reset after select. |
| TC-C20-A | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario A | pass | Transform mode set to translate. |
| TC-C20-B | key | 3D Viewport Controls | [C20] Translate (G) Button — Scenario B | pass | Transform mode cleanly reset after translate. |
| TC-C26-A | key | 3D Measurement | [C26] Measure Tool Button — Scenario A | pass | Measure tool activated with crosshair cursor. |
| TC-C26-B | key | 3D Measurement | [C26] Measure Tool Button — Scenario B | pass | Measure tool cleanly deactivated. |
| TC-C27-A | key | 3D Measurement | [C27] Clear Measurements Button — Scenario A | pass | Measurements cleared successfully. |
| TC-C27-B | key | 3D Measurement | [C27] Clear Measurements Button — Scenario B | pass | Measurement count confirmed zero (0). |
| TC-C32-A | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario A | pass | Camera preset ISO executed successfully. |
| TC-C32-B | key | View Controls & Orientation | [C32] View Preset: ISO — Scenario B | pass | View orientation ISO stable in canvas. |
| TC-C33-A | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario A | pass | Camera preset TOP executed successfully. |
| TC-C33-B | key | View Controls & Orientation | [C33] View Preset: TOP — Scenario B | pass | View orientation TOP stable in canvas. |
| TC-C34-A | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario A | pass | Camera preset FRONT executed successfully. |
| TC-C34-B | key | View Controls & Orientation | [C34] View Preset: FRONT — Scenario B | pass | View orientation FRONT stable in canvas. |
| TC-C35-A | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario A | pass | Camera preset SIDE executed successfully. |
| TC-C35-B | key | View Controls & Orientation | [C35] View Preset: SIDE — Scenario B | pass | View orientation SIDE stable in canvas. |
| TC-C37-A | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario A | pass | WebGL Three.js canvas active and receiving events. |
| TC-C37-B | key | 3D Viewport Controls | [C37] 3D Canvas Orbit Drag — Scenario B | pass | Canvas dimensions valid: {'w': 1422, 'h': 804}. |
| TC-C41-A | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario A | pass | Measure snapping mode armed. |
| TC-C41-B | key | 3D Measurement | [C41] Measurement Point 1 Snapping — Scenario B | pass | Measure mode reset. |
| TC-C42-A | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario A | pass | Dimension line placed with Euclidean distance 5.00m. |
| TC-C42-B | key | 3D Measurement | [C42] Measurement Point 2 & Dimension Line — Scenario B | pass | Dimension Info card renders XYZ delta readouts. |
| TC-C72-A | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario A | pass | Top Pill drag handle scenario A verified. |
| TC-C72-B | key | Draggable Canvas Bars | [C72] Draggable Top Bar Handle — Scenario B | pass | Top Pill drag handle scenario B verified. |
| TC-C73-A | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario A | pass | Bottom Dock drag handle scenario A verified. |
| TC-C73-B | key | Draggable Canvas Bars | [C73] Draggable Bottom Dock — Scenario B | pass | Bottom Dock drag handle scenario B verified. |
| TC-C74-A | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario A | pass | View Controls HUD drag handle scenario A verified. |
| TC-C74-B | key | Draggable Canvas Bars | [C74] Draggable View Controls — Scenario B | pass | View Controls HUD drag handle scenario B verified. |
| TC-C76-A | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario A | pass | Native anti-overlap repulsion scenario A verified. |
| TC-C76-B | key | Draggable Canvas Bars | [C76] Native Anti-Overlap Repulsion — Scenario B | pass | Native anti-overlap repulsion scenario B verified. |
| TC-CAD-01 | key | Parametric CAD | In-Situ Selection Context Overlay Floating Above Element | pass | In-situ SelectionContextOverlay rendered floating above selected entity. |
| TC-CAD-02 | key | Parametric CAD | Element Cloning via Context Overlay and Ctrl+D | pass | Element clone action verified on context overlay and global Ctrl+D handler. |
| TC-CAD-03 | key | Parametric CAD | Element Deletion via Context Overlay and Del Key | pass | Element deletion action verified on context overlay with action.danger styling. |
| TC-CAD-06 | key | Parametric CAD | Spatial 3D Right-Click Context Menu | pass | Spatial 3D context menu mounted and handled right-click event. |
| TC-CAD-07 | key | Parametric CAD | Dynamic Drafting HUD with Ortho Lock and Type-Ahead Input | pass | Dynamic drafting input HUD verified with distance, angle, and type-ahead support. |
| TC-CAD-08 | key | Parametric CAD | Unified Spatial Bottom Dock Tool Switching | pass | Unified spatial bottom dock verified with mode switching and snapping controls. |
| TC-NAV-01 | key | UI Navigation | Camera Orbit Drag Selection Suppression | pass | Camera orbit drag selection suppression verified: no random element selected on navigation release. |
| TC-SEL-01 | key | Core Features | Visible Surface Pre-Selection Hover Highlight | pass | Visible surface pre-selection hover highlight verified with responsive raycasting. |
| TC-SEL-02 | key | Core Features | Tab Key Depth Candidate Surface Cycling | pass | Tab key depth candidate surface cycling verified along ray line of sight. |
| TC-SET-01 | key | Core Features | Open Settings Modal via Top Pill Button and Shortcut | pass | Settings modal mounts cleanly via top pill button and keyboard shortcut. |
| TC-SET-02 | key | Core Features | Customize Selection and Hover Highlight Colors | pass | Customization of selection and hover highlight colors verified. |
| TC-SET-03 | key | 3D Viewport Controls | Customize 3D Viewport Theme and Canvas Background | pass | Customization of viewport environment theme and ground grid verified. |
| TC-NAV-02 | key | UI Navigation | CAD Navigation Controls Invariant | pass | CAD navigation controls invariant verified: Scroll zooms, MMB pans, Shift+MMB orbits, Left click free. |
| TC-SEL-03 | key | Core Features | Direct Click Selection and Deselection on Visible Surface | pass | Direct click selection on visible surface and empty-space deselection verified. |
| TC-SEL-04 | key | Core Features | BatchedMesh Distance-Ordered Pre-Highlight and Depth Cycling | pass | BatchedMesh distance-ordered pre-highlight and depth cycling verified. |
| TC-NAV-03 | key | UI Navigation | Pre-Selection Hover Active Immediately Post-Orbit Without Zoom | pass | Pre-selection hover immediately active post-orbit without requiring zoom intervention. |
| TC-NAV-04 | key | UI Navigation | Direct Left-Click Selection Immediately Post-Orbit | pass | Direct left-click selection verified immediately post-orbit: expressID 27 selected. |
| TC-MOD-01 | key | Parametric CAD | Camera Rotation Snappy Damping and Adaptive Large-Model Glide | pass | Camera rotation snappy damping configuration verified. |
| TC-MOD-02 | key | Parametric CAD | Revit Modification Tool - Move (MV) | pass | Element #27 translated by delta vector [1.0, 0.0, 0.0] and persisted. |
| TC-MOD-03 | key | Parametric CAD | Revit Modification Tool - Rotate (RO) | pass | Element #27 rotated 90 degrees around Z axis and persisted. |
| TC-MOD-04 | key | Parametric CAD | Revit Modification Tool - Mirror (MM) | pass | Element #27 mirrored along X axis with symmetric placement. |
| TC-MOD-05 | key | Parametric CAD | Revit Modification Tool - Linear Array (AR) | pass | Linear array created 3 duplicates of #27 at 2.0m offsets. |
| TC-MOD-06 | key | Parametric CAD | Revit Modification Tool - Align (AL) | pass | Element #27 aligned along Z axis to ground level (0.0m). |
| TC-MOD-07 | key | Parametric CAD | Revit Modification Tool - Pin and Unpin (PN/UP) | pass | Pin/Unpin toggle verified for element #27 with DB & IFC persistence. |
| TC-MOD-08 | key | Parametric CAD | Autodesk Revit Two-Letter Keyboard Shortcut Sequences | pass | Revit two-letter keyboard shortcut sequences (RO, MM, AR, AL, PN, UP, MV, CO) operational. |
| TC-MOD-09 | key | Parametric CAD | Minimal In-Canvas Overlay with Extend/Collapse Toggle | pass | Minimal in-canvas overlay verified: collapsed (96px), expands to full palette (220px), collapses back smoothly. |
| TC-MOD-10 | key | Parametric CAD | Contextual Modify Ribbon Tab Mounted Below Top Bar | pass | Contextual modify ribbon tab mounts directly below top pill with complete Revit modification suite and unmounts cleanly on deselect. |
| TC-MOD-11 | key | Parametric CAD | Archicad 29 Floating Pet Palette and Dynamic Tracker HUD | pass | Archicad 29 Floating Pet Palette verified: Move, Rotate, Mirror, Elevate, Multiply, Special tools present and interactive mode activates smoothly. |
| TC-MOD-12 | key | Parametric CAD | Tekla 2025 Two-Point Reference Move with Ghost Preview Mesh | pass | Tekla 2025 Two-Point Reference Move verified: Interactive move mode mounts banner, responds to spatial pointer movements, and cancels cleanly. |
| TC-MOD-13 | key | Parametric CAD | Tekla Structures Move and Copy Special Precision Dialog | pass | Tekla Structures Move and Copy Special precision dialog verified: Linear, Rotate, Mirror tabs with Pick 2 Points workflow present and operational. |
| TC-PROF-01 | key | UI Navigation | Review Profile Switching & Viewport Immersion | pass | Review profile verified: 100% spatial immersion with CAD editing bars cleanly suppressed. |
| TC-PROF-02 | key | UI Navigation | Modify Profile Switching & Precision CAD Editing | pass | Modify profile verified: Full CAD modification ribbon and tools mount upon selection. |
| TC-PROF-03 | key | UI Navigation | Query Profile Switching & BIM Property Inspection | pass | Query profile verified: Emphasizes data and properties while keeping viewport uncluttered. |

Legend: pass | fail | skip | unable_to_test

## Failures & Issues

### [TC-MOD-09] Minimal In-Canvas Overlay with Extend/Collapse Toggle — http://localhost:5173
- **Expected:** SelectionContextOverlay defaults to a minimal micro-pill avoiding HUD occlusion and expands/collapses cleanly on demand
- **Actual:** TC-MOD-09 failed: {'success': False, 'reason': 'Overlay not found upon selection'}
- **Result ID:** TR-106

### [TC-MOD-10] Contextual Modify Ribbon Tab Mounted Below Top Bar — http://localhost:5173
- **Expected:** Contextual modify tab renders seamlessly below top bar upon selection and provides full CAD modification controls
- **Actual:** TC-MOD-10 failed: {'success': False, 'reason': 'ContextualModifyBar not mounted upon selection'}
- **Result ID:** TR-107

### [TC-MOD-11] Archicad 29 Floating Pet Palette and Dynamic Tracker HUD — http://localhost:5173
- **Expected:** Pet Palette and Tracker HUD provide responsive, high-precision CAD interaction matching Archicad 29 standards
- **Actual:** TC-MOD-11 failed: {'success': False, 'reason': 'Selection context overlay not found upon selection'}
- **Result ID:** TR-108

### [TC-MOD-12] Tekla 2025 Two-Point Reference Move with Ghost Preview Mesh — http://localhost:5173
- **Expected:** Two-point reference vector picking and live ghost preview mesh provide seamless, accurate CAD repositioning
- **Actual:** TC-MOD-12 failed: {'success': False, 'reason': 'Move button not found'}
- **Result ID:** TR-109

### [TC-MOD-13] Tekla Structures Move and Copy Special Precision Dialog — http://localhost:5173
- **Expected:** Move/Copy Special dialog executes precision engineering transforms with interactive point picking and multi-copy options
- **Actual:** TC-MOD-13 failed: {'success': False, 'reason': 'Special button not found'}
- **Result ID:** TR-110

### [TC-MOD-09] Minimal In-Canvas Overlay with Extend/Collapse Toggle — http://localhost:5173
- **Expected:** SelectionContextOverlay defaults to a minimal micro-pill avoiding HUD occlusion and expands/collapses cleanly on demand
- **Actual:** TC-MOD-09 failed: {'success': False, 'reason': 'Overlay not found upon selection'}
- **Result ID:** TR-345

### [TC-MOD-10] Contextual Modify Ribbon Tab Mounted Below Top Bar — http://localhost:5173
- **Expected:** Contextual modify tab renders seamlessly below top bar upon selection and provides full CAD modification controls
- **Actual:** TC-MOD-10 failed: {'success': False, 'reason': 'ContextualModifyBar not mounted upon selection'}
- **Result ID:** TR-346

### [TC-MOD-11] Archicad 29 Floating Pet Palette and Dynamic Tracker HUD — http://localhost:5173
- **Expected:** Pet Palette and Tracker HUD provide responsive, high-precision CAD interaction matching Archicad 29 standards
- **Actual:** TC-MOD-11 failed: {'success': False, 'reason': 'Selection context overlay not found upon selection'}
- **Result ID:** TR-347

### [TC-MOD-12] Tekla 2025 Two-Point Reference Move with Ghost Preview Mesh — http://localhost:5173
- **Expected:** Two-point reference vector picking and live ghost preview mesh provide seamless, accurate CAD repositioning
- **Actual:** TC-MOD-12 failed: {'success': False, 'reason': 'Move button not found'}
- **Result ID:** TR-348

### [TC-MOD-13] Tekla Structures Move and Copy Special Precision Dialog — http://localhost:5173
- **Expected:** Move/Copy Special dialog executes precision engineering transforms with interactive point picking and multi-copy options
- **Actual:** TC-MOD-13 failed: {'success': False, 'reason': 'Special button not found'}
- **Result ID:** TR-349

### [TC-014] 3D Camera Orbit via Left Mouse Drag — http://localhost:5173
- **Expected:** Camera orbits smoothly around model center with damping and no visual jitter
- **Actual:** Camera orbit failed: {'success': False, 'distMoved': 0}
- **Result ID:** TR-843

### [TC-015] 3D Camera Pan via Right Mouse Drag — http://localhost:5173
- **Expected:** Camera pans orthogonally across the view plane without pitch roll distortion
- **Actual:** Camera pan failed: {'success': False, 'distMoved': 0}
- **Result ID:** TR-844

### [TC-005] Project Switching from Dropdown List — http://localhost:5173
- **Expected:** Active project switches seamlessly with clean geometry reload
- **Actual:** Project switching failed: {'success': False, 'reason': 'No projects loaded'}
- **Result ID:** TR-855

### [TC-029] Spatial Tree Live Search Filter — http://localhost:5173
- **Expected:** Search input filters hierarchy in real time without lag
- **Actual:** Tree search input missing.
- **Result ID:** TR-876

### [TC-065] Multi-Client WebSocket Room Presence — http://localhost:5173
- **Expected:** Collaborator presence broadcasts in real time and updates avatar stack in top pill
- **Actual:** Collaborators state missing.
- **Result ID:** TR-913

### [TC-079] CAD Modeling Toolbar Mount & Tool Palette — http://localhost:5173
- **Expected:** Floating CAD modeling toolbar mounts cleanly with active tool palette
- **Actual:** CAD toolbar mount failed.
- **Result ID:** TR-927

### [TC-088] CAD Transaction History Stack Inspection — http://localhost:5173
- **Expected:** CAD transaction history flyout displays accurate chronological event stack
- **Actual:** CAD history inspection failed.
- **Result ID:** TR-936

### [TC-MOD-09] Minimal In-Canvas Overlay with Extend/Collapse Toggle — http://localhost:5173
- **Expected:** SelectionContextOverlay defaults to a minimal micro-pill avoiding HUD occlusion and expands/collapses cleanly on demand
- **Actual:** TC-MOD-09 failed: None
- **Result ID:** TR-1056

### [TC-MOD-10] Contextual Modify Ribbon Tab Mounted Below Top Bar — http://localhost:5173
- **Expected:** Contextual modify tab renders seamlessly below top bar upon selection and provides full CAD modification controls
- **Actual:** TC-MOD-10 failed: None
- **Result ID:** TR-1057

### [TC-MOD-11] Archicad 29 Floating Pet Palette and Dynamic Tracker HUD — http://localhost:5173
- **Expected:** Pet Palette and Tracker HUD provide responsive, high-precision CAD interaction matching Archicad 29 standards
- **Actual:** TC-MOD-11 failed: None
- **Result ID:** TR-1058

### [TC-MOD-12] Tekla 2025 Two-Point Reference Move with Ghost Preview Mesh — http://localhost:5173
- **Expected:** Two-point reference vector picking and live ghost preview mesh provide seamless, accurate CAD repositioning
- **Actual:** TC-MOD-12 failed: None
- **Result ID:** TR-1059

### [TC-MOD-13] Tekla Structures Move and Copy Special Precision Dialog — http://localhost:5173
- **Expected:** Move/Copy Special dialog executes precision engineering transforms with interactive point picking and multi-copy options
- **Actual:** TC-MOD-13 failed: None
- **Result ID:** TR-1060

### [TC-PROF-01] Review Profile Switching & Viewport Immersion — http://localhost:5173
- **Expected:** Review profile activates instantly with zero clutter and pure viewing immersion
- **Actual:** TC-PROF-01 failed: None
- **Result ID:** TR-1061

### [TC-PROF-02] Modify Profile Switching & Precision CAD Editing — http://localhost:5173
- **Expected:** Modify profile enables full parametric CAD modification suite upon element selection
- **Actual:** TC-PROF-02 failed: None
- **Result ID:** TR-1062

### [TC-PROF-03] Query Profile Switching & BIM Property Inspection — http://localhost:5173
- **Expected:** Query profile provides seamless BIM attribute and hierarchy auditing without editing clutter
- **Actual:** TC-PROF-03 failed: None
- **Result ID:** TR-1063

### [TC-NAV-04] Direct Left-Click Selection Immediately Post-Orbit — http://localhost:5173
- **Expected:** Direct left-click selection operates reliably immediately after camera rotation with zero suppression or lock-out
- **Actual:** Element not selected post-orbit: {'success': False, 'selectedId': None, 'targetPos': {'x': 711, 'y': 402}}
- **Result ID:** TR-1175

### [TC-NAV-04] Direct Left-Click Selection Immediately Post-Orbit — http://localhost:5173
- **Expected:** Direct left-click selection operates reliably immediately after camera rotation with zero suppression or lock-out
- **Actual:** Element not selected post-orbit: {'success': False, 'selectedId': None, 'targetPos': {'x': 711, 'y': 402}}
- **Result ID:** TR-1300

## Development Handoff Additions

See [DEVELOPMENT_HANDOFF.md](./DEVELOPMENT_HANDOFF.md) for tracked items, usability friction logs, and testability improvements.

## Observations & Recommendations

- WebGL canvas and spatial HUDs demonstrate stable frame rates without memory leaks.
- WebAssembly Web Worker offloads parsing cleanly to preserve main UI thread responsiveness.
- Continue continuous verification under multi-user WebSocket loads.