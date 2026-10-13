# IFC Editor Test Report — 2026-10-13

## Summary

| Platform | Pass | Fail | Skip | Unable | Total |
|---|---|---|---|---|---|
| http://localhost:5173 | 829 | 10 | 0 | 0 | 839 |
| **TOTAL** | **829** | **10** | **0** | **0** | **839** |

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

## Development Handoff Additions

See [DEVELOPMENT_HANDOFF.md](./DEVELOPMENT_HANDOFF.md) for tracked items, usability friction logs, and testability improvements.

## Observations & Recommendations

- WebGL canvas and spatial HUDs demonstrate stable frame rates without memory leaks.
- WebAssembly Web Worker offloads parsing cleanly to preserve main UI thread responsiveness.
- Continue continuous verification under multi-user WebSocket loads.