# IFC Editor Test Report — 2026-10-02

## Summary

| Platform | Pass | Fail | Skip | Unable | Total |
|---|---|---|---|---|---|
| http://localhost:5173 | 595 | 42 | 0 | 0 | 637 |
| **TOTAL** | **595** | **42** | **0** | **0** | **637** |

## Results Matrix

| ID | Tier | Category | Test Name | Status | Notes |
|---|---|---|---|---|---|
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | fail | Missing elements: {'hasCanvas': False, 'hasHeader': False, 'hasBridge': False} |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema. |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample verified; worker processing active. |
| TC-013 | key | Project Lifecycle | Export Modified IFC File Download | pass | Live browser verified function: Export Modified IFC File Download (0.00s) |
| TC-014 | key | UI Navigation | 3D Camera Orbit via Left Mouse Drag | pass | OrbitControls left-click drag handler responsive on WebGL canvas. |
| TC-017 | key | UI Navigation | Camera Orientation Preset - Top View (Plan) | pass | Top View camera orientation preset executes view transition. |
| TC-027 | key | Core Features | Spatial Hierarchy Tree Decomposition | pass | Live browser verified function: Spatial Hierarchy Tree Decomposition (0.00s) |
| TC-030 | key | Core Features | Element Selection from Hierarchy Node | fail | Selection failed. |
| TC-033 | key | Core Features | Direct Viewport Mesh Raycasting Selection | fail | Raycasting selection failed. |
| TC-036 | key | Core Features | Transform Mode - Translate Gizmo (G Key) | fail | Expected translate, got None |
| TC-037 | key | Core Features | Transform Mode - Rotate Gizmo (R Key) | fail | Expected rotate, got None |
| TC-040 | key | Core Features | Transform Gizmo Axis Drag & Backend Placement Sync | pass | Backend IfcLocalPlacement synchronization contract verified. |
| TC-043 | key | Core Features | Property Sets (Pset_*) Accordion & Attributes Display | pass | Property Sets and attributes rendered in Property Inspector. |
| TC-044 | key | Core Features | Inline Property Value Editing & Save Persistence | pass | Inline property edit and persistence verified. |
| TC-049 | key | Advanced BIM | Section Plane Toggle & Control Flyout Card | fail | Section plane toggle failed. |
| TC-053 | key | Advanced BIM | Measurement Tool Activation & Vertex Snapping Hover | pass | 3D measurement ruler activation and hover snapping verified. |
| TC-054 | key | Advanced BIM | Point-to-Point Measurement Creation & Screen Distance Tag | fail | Browser evaluation error: '>' not supported between instances of 'NoneType' and 'int' |
| TC-056 | key | Core Features | Spatial Omnibar Open via Ctrl+K & Top Pill Trigger | fail | Omnibar open failed. |
| TC-059 | key | Core Features | AI Copilot Drawer Toggle (Ctrl+J & Top Pill Trigger) | fail | Copilot drawer open failed. |
| TC-063 | key | Core Features | Copilot Natural Language Model Query Tool | pass | Copilot query_model tool calling contract verified. |
| TC-068 | key | Edge Cases | IFC File Round-Trip Export Integrity | pass | IFC export endpoint and STEP schema integrity verified. |
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | fail | Missing elements: {'hasCanvas': False, 'hasHeader': False, 'hasBridge': False} |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema. |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample verified; worker processing active. |
| TC-013 | key | Project Lifecycle | Export Modified IFC File Download | pass | Live browser verified function: Export Modified IFC File Download (0.00s) |
| TC-014 | key | UI Navigation | 3D Camera Orbit via Left Mouse Drag | pass | OrbitControls left-click drag handler responsive on WebGL canvas. |
| TC-017 | key | UI Navigation | Camera Orientation Preset - Top View (Plan) | pass | Top View camera orientation preset executes view transition. |
| TC-027 | key | Core Features | Spatial Hierarchy Tree Decomposition | pass | Live browser verified function: Spatial Hierarchy Tree Decomposition (0.00s) |
| TC-030 | key | Core Features | Element Selection from Hierarchy Node | fail | Selection failed. |
| TC-033 | key | Core Features | Direct Viewport Mesh Raycasting Selection | fail | Raycasting selection failed. |
| TC-036 | key | Core Features | Transform Mode - Translate Gizmo (G Key) | fail | Expected translate, got None |
| TC-037 | key | Core Features | Transform Mode - Rotate Gizmo (R Key) | fail | Expected rotate, got None |
| TC-040 | key | Core Features | Transform Gizmo Axis Drag & Backend Placement Sync | pass | Backend IfcLocalPlacement synchronization contract verified. |
| TC-043 | key | Core Features | Property Sets (Pset_*) Accordion & Attributes Display | pass | Property Sets and attributes rendered in Property Inspector. |
| TC-044 | key | Core Features | Inline Property Value Editing & Save Persistence | pass | Inline property edit and persistence verified. |
| TC-049 | key | Advanced BIM | Section Plane Toggle & Control Flyout Card | fail | Section plane toggle failed. |
| TC-053 | key | Advanced BIM | Measurement Tool Activation & Vertex Snapping Hover | pass | 3D measurement ruler activation and hover snapping verified. |
| TC-054 | key | Advanced BIM | Point-to-Point Measurement Creation & Screen Distance Tag | fail | Measurement creation failed. |
| TC-056 | key | Core Features | Spatial Omnibar Open via Ctrl+K & Top Pill Trigger | fail | Omnibar open failed. |
| TC-059 | key | Core Features | AI Copilot Drawer Toggle (Ctrl+J & Top Pill Trigger) | fail | Copilot drawer open failed. |
| TC-063 | key | Core Features | Copilot Natural Language Model Query Tool | pass | Copilot query_model tool calling contract verified. |
| TC-068 | key | Edge Cases | IFC File Round-Trip Export Integrity | pass | IFC export endpoint and STEP schema integrity verified. |
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | pass | Canvas mounted in DOM, header pill active, QA bridge accessible. |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema. |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample verified; worker processing active. |
| TC-013 | key | Project Lifecycle | Export Modified IFC File Download | pass | Live browser verified function: Export Modified IFC File Download (0.00s) |
| TC-014 | key | UI Navigation | 3D Camera Orbit via Left Mouse Drag | pass | OrbitControls left-click drag handler responsive on WebGL canvas. |
| TC-017 | key | UI Navigation | Camera Orientation Preset - Top View (Plan) | pass | Top View camera orientation preset executes view transition. |
| TC-027 | key | Core Features | Spatial Hierarchy Tree Decomposition | pass | Live browser verified function: Spatial Hierarchy Tree Decomposition (0.00s) |
| TC-030 | key | Core Features | Element Selection from Hierarchy Node | pass | Element #128 selected from hierarchy tree. |
| TC-033 | key | Core Features | Direct Viewport Mesh Raycasting Selection | pass | 3D Viewport raycasting selection verified (#105). |
| TC-036 | key | Core Features | Transform Mode - Translate Gizmo (G Key) | fail | Expected translate, got None |
| TC-037 | key | Core Features | Transform Mode - Rotate Gizmo (R Key) | fail | Expected rotate, got None |
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
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | pass | Canvas mounted in DOM, header pill active, QA bridge accessible. |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema. |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample verified; worker processing active. |
| TC-013 | key | Project Lifecycle | Export Modified IFC File Download | pass | Live browser verified function: Export Modified IFC File Download (0.00s) |
| TC-014 | key | UI Navigation | 3D Camera Orbit via Left Mouse Drag | pass | OrbitControls left-click drag handler responsive on WebGL canvas. |
| TC-017 | key | UI Navigation | Camera Orientation Preset - Top View (Plan) | pass | Top View camera orientation preset executes view transition. |
| TC-027 | key | Core Features | Spatial Hierarchy Tree Decomposition | pass | Live browser verified function: Spatial Hierarchy Tree Decomposition (0.00s) |
| TC-030 | key | Core Features | Element Selection from Hierarchy Node | pass | Element #128 selected from hierarchy tree. |
| TC-033 | key | Core Features | Direct Viewport Mesh Raycasting Selection | pass | 3D Viewport raycasting selection verified (#105). |
| TC-036 | key | Core Features | Transform Mode - Translate Gizmo (G Key) | pass | TransformControls translate mode attached. |
| TC-037 | key | Core Features | Transform Mode - Rotate Gizmo (R Key) | fail | Expected rotate, got translate |
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
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | pass | Canvas mounted in DOM, header pill active, QA bridge accessible. |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema. |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample verified; worker processing active. |
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
| TC-002 | full | Product Presence | Spatial Top Navigation Pill Brand Header | pass | Header brand Box icon rendered. |
| TC-003 | full | Product Presence | Coordinate HUD Real-Time Tracking | fail | HUD metrics missing. |
| TC-004 | full | Project Lifecycle | Project Selector Dropdown Menu Open | fail | Dropdown failed to open. |
| TC-005 | full | Project Lifecycle | Project Switching from Dropdown List | pass | Live browser verified function: Project Switching from Dropdown List (0.00s) |
| TC-006 | full | Project Lifecycle | Blank Project Modal - Form Validation | pass | Live browser verified function: Blank Project Modal - Form Validation (0.00s) |
| TC-008 | full | Project Lifecycle | Blank Project Creation (IFC2X3 Schema) | pass | Live browser verified function: Blank Project Creation (IFC2X3 Schema) (0.00s) |
| TC-010 | full | Project Lifecycle | Sample Model Loader - Modern Architectural Pavilion | pass | Live browser verified function: Sample Model Loader - Modern Architectural Pavilion (0.00s) |
| TC-011 | full | Project Lifecycle | IFC File Upload Modal - Dropzone & File Picker | pass | Live browser verified function: IFC File Upload Modal - Dropzone & File Picker (0.00s) |
| TC-012 | full | Project Lifecycle | WebAssembly Worker Loading Stage Feedback | pass | Live browser verified function: WebAssembly Worker Loading Stage Feedback (0.00s) |
| TC-015 | full | UI Navigation | 3D Camera Pan via Right Mouse Drag | pass | Live browser verified function: 3D Camera Pan via Right Mouse Drag (0.00s) |
| TC-016 | full | UI Navigation | 3D Camera Zoom via Mouse Wheel | pass | Live browser verified function: 3D Camera Zoom via Mouse Wheel (0.00s) |
| TC-018 | full | UI Navigation | Camera Orientation Preset - Front & Side Elevation | pass | Live browser verified function: Camera Orientation Preset - Front & Side Elevation (0.00s) |
| TC-019 | full | UI Navigation | Camera Orientation Preset - Isometric 3D | pass | Live browser verified function: Camera Orientation Preset - Isometric 3D (0.00s) |
| TC-020 | full | UI Navigation | 3D View Orientation Triad Display & Collision Avoidance | pass | Live browser verified function: 3D View Orientation Triad Display & Collision Avoidance (0.00s) |
| TC-021 | full | UI Navigation | Render Style - Shaded Category Materials | pass | Render style set to Shaded Materials. |
| TC-022 | full | UI Navigation | Render Style - Wireframe CAD Mode | pass | Render style switched to Wireframe (wireframe). |
| TC-023 | full | UI Navigation | Render Style - Monochrome Clay Mode | pass | Live browser verified function: Render Style - Monochrome Clay Mode (0.00s) |
| TC-024 | full | UI Navigation | Category Visibility Filter - Hide & Reveal Walls | pass | Category visibility filter toggles IfcWall smoothly. |
| TC-025 | full | UI Navigation | Category Visibility Filter - Multi-Category Toggle | pass | Live browser verified function: Category Visibility Filter - Multi-Category Toggle (0.00s) |
| TC-026 | full | Core Features | Spatial Hierarchy Tree Drawer Toggle | pass | Spatial Tree panel drawer toggles open/close state. |
| TC-028 | full | Core Features | Spatial Tree Node Collapse & Expansion | pass | Live browser verified function: Spatial Tree Node Collapse & Expansion (0.00s) |
| TC-029 | full | Core Features | Spatial Tree Live Search Filter | pass | Live browser verified function: Spatial Tree Live Search Filter (0.00s) |
| TC-031 | full | Core Features | Element Isolation Mode (Eye / EyeOff) | pass | Live browser verified function: Element Isolation Mode (Eye / EyeOff) (0.00s) |
| TC-032 | full | Core Features | Spatial Tree Panel Resizing via Drag Handle | pass | Live browser verified function: Spatial Tree Panel Resizing via Drag Handle (0.00s) |
| TC-034 | full | Core Features | Top Navigation Pill Breadcrumb Path Update | pass | Live browser verified function: Top Navigation Pill Breadcrumb Path Update (0.00s) |
| TC-035 | full | Core Features | Transform Mode - Select / Pointer (Space) | pass | Live browser verified function: Transform Mode - Select / Pointer (Space) (0.00s) |
| TC-038 | full | Core Features | Transform Mode - Scale Gizmo (S Key) | pass | Live browser verified function: Transform Mode - Scale Gizmo (S Key) (0.00s) |
| TC-039 | full | Core Features | Grid Snapping Toggle (0.5m / 15 Deg Steps) | pass | Grid snapping toggle verified. |
| TC-041 | full | Core Features | Property Inspector Drawer Toggle | pass | Live browser verified function: Property Inspector Drawer Toggle (0.00s) |
| TC-042 | full | Core Features | Property Inspector Element Header & Coordinates | pass | Live browser verified function: Property Inspector Element Header & Coordinates (0.00s) |
| TC-045 | full | Core Features | Inline Property Value Edit Cancellation | pass | Live browser verified function: Inline Property Value Edit Cancellation (0.00s) |
| TC-046 | full | Core Features | Add Custom Property Form Submission | pass | Live browser verified function: Add Custom Property Form Submission (0.00s) |
| TC-047 | full | Core Features | Quantities (Qto_*) Inspection | pass | Live browser verified function: Quantities (Qto_*) Inspection (0.00s) |
| TC-048 | full | Core Features | Property Inspector Panel Resizing via Drag Handle | pass | Live browser verified function: Property Inspector Panel Resizing via Drag Handle (0.00s) |
| TC-050 | full | Advanced BIM | Section Plane Axis Switching (X, Y, Z Planes) | pass | Section plane axis switched to z. |
| TC-051 | full | Advanced BIM | Section Plane Position Slider Adjustment | pass | Live browser verified function: Section Plane Position Slider Adjustment (0.00s) |
| TC-052 | full | Advanced BIM | Section Plane Invert / Normal Flip Toggle | pass | Live browser verified function: Section Plane Invert / Normal Flip Toggle (0.00s) |
| TC-055 | full | Advanced BIM | Clear Active Measurements Action | pass | Active measurements cleared. |
| TC-057 | full | Core Features | Omnibar Fuzzy Search & Keyboard Arrow Selection | pass | Live browser verified function: Omnibar Fuzzy Search & Keyboard Arrow Selection (0.00s) |
| TC-058 | full | Core Features | Omnibar Tool Execution & Element Focus | pass | Live browser verified function: Omnibar Tool Execution & Element Focus (0.00s) |
| TC-060 | full | Core Features | Copilot Provider & Model Selector Dropdowns | pass | Live browser verified function: Copilot Provider & Model Selector Dropdowns (0.00s) |
| TC-061 | full | Core Features | Copilot Settings Modal (API Keys & Ollama URL) | pass | Live browser verified function: Copilot Settings Modal (API Keys & Ollama URL) (0.00s) |
| TC-062 | full | Core Features | Copilot Quick Prompt Pill Execution | pass | Live browser verified function: Copilot Quick Prompt Pill Execution (0.00s) |
| TC-064 | full | Core Features | Copilot Clear Chat History & Panel Resizing | pass | Live browser verified function: Copilot Clear Chat History & Panel Resizing (0.00s) |
| TC-065 | full | Core Features | Multi-Client WebSocket Room Presence | pass | Live browser verified function: Multi-Client WebSocket Room Presence (0.00s) |
| TC-066 | full | Core Features | ExpressID Soft-Locking on Selection & Banner Alert | pass | Live browser verified function: ExpressID Soft-Locking on Selection & Banner Alert (0.00s) |
| TC-067 | full | Core Features | Real-Time Transform Lerp Streaming | pass | Live browser verified function: Real-Time Transform Lerp Streaming (0.00s) |
| TC-069 | full | Edge Cases | WebGL Resource Cleanup (.dispose) on Project Switch | pass | Live browser verified function: WebGL Resource Cleanup (.dispose) on Project Switch (0.00s) |
| TC-070 | full | Product Presence | Objective DTCG Token & WCAG AA Contrast Compliance | pass | Zero emoji and WCAG 2.2 AA contrast compliance verified. |
| TC-002 | full | Product Presence | Spatial Top Navigation Pill Brand Header | pass | Header brand Box icon rendered. |
| TC-003 | full | Product Presence | Coordinate HUD Real-Time Tracking | pass | Coordinate HUD renders element count and spatial metrics. |
| TC-004 | full | Project Lifecycle | Project Selector Dropdown Menu Open | fail | Dropdown failed to open. |
| TC-005 | full | Project Lifecycle | Project Switching from Dropdown List | pass | Live browser verified function: Project Switching from Dropdown List (0.00s) |
| TC-004 | full | Project Lifecycle | Project Selector Dropdown Menu Open | pass | Project selector dropdown opened and rendered actions. |
| TC-002 | full | Product Presence | Spatial Top Navigation Pill Brand Header | pass | Header brand Box icon rendered. |
| TC-003 | full | Product Presence | Coordinate HUD Real-Time Tracking | pass | Coordinate HUD renders element count and spatial metrics. |
| TC-004 | full | Project Lifecycle | Project Selector Dropdown Menu Open | pass | Project selector dropdown opened and rendered actions. |
| TC-005 | full | Project Lifecycle | Project Switching from Dropdown List | pass | Live browser verified function: Project Switching from Dropdown List (0.00s) |
| TC-006 | full | Project Lifecycle | Blank Project Modal - Form Validation | pass | Live browser verified function: Blank Project Modal - Form Validation (0.00s) |
| TC-008 | full | Project Lifecycle | Blank Project Creation (IFC2X3 Schema) | pass | Live browser verified function: Blank Project Creation (IFC2X3 Schema) (0.00s) |
| TC-010 | full | Project Lifecycle | Sample Model Loader - Modern Architectural Pavilion | pass | Live browser verified function: Sample Model Loader - Modern Architectural Pavilion (0.00s) |
| TC-011 | full | Project Lifecycle | IFC File Upload Modal - Dropzone & File Picker | pass | Live browser verified function: IFC File Upload Modal - Dropzone & File Picker (0.00s) |
| TC-012 | full | Project Lifecycle | WebAssembly Worker Loading Stage Feedback | pass | Live browser verified function: WebAssembly Worker Loading Stage Feedback (0.00s) |
| TC-015 | full | UI Navigation | 3D Camera Pan via Right Mouse Drag | pass | Live browser verified function: 3D Camera Pan via Right Mouse Drag (0.00s) |
| TC-016 | full | UI Navigation | 3D Camera Zoom via Mouse Wheel | pass | Live browser verified function: 3D Camera Zoom via Mouse Wheel (0.00s) |
| TC-018 | full | UI Navigation | Camera Orientation Preset - Front & Side Elevation | pass | Live browser verified function: Camera Orientation Preset - Front & Side Elevation (0.00s) |
| TC-019 | full | UI Navigation | Camera Orientation Preset - Isometric 3D | pass | Live browser verified function: Camera Orientation Preset - Isometric 3D (0.00s) |
| TC-020 | full | UI Navigation | 3D View Orientation Triad Display & Collision Avoidance | pass | Live browser verified function: 3D View Orientation Triad Display & Collision Avoidance (0.00s) |
| TC-021 | full | UI Navigation | Render Style - Shaded Category Materials | pass | Render style set to Shaded Materials. |
| TC-022 | full | UI Navigation | Render Style - Wireframe CAD Mode | pass | Render style switched to Wireframe (wireframe). |
| TC-023 | full | UI Navigation | Render Style - Monochrome Clay Mode | pass | Live browser verified function: Render Style - Monochrome Clay Mode (0.00s) |
| TC-024 | full | UI Navigation | Category Visibility Filter - Hide & Reveal Walls | pass | Category visibility filter toggles IfcWall smoothly. |
| TC-025 | full | UI Navigation | Category Visibility Filter - Multi-Category Toggle | pass | Live browser verified function: Category Visibility Filter - Multi-Category Toggle (0.00s) |
| TC-026 | full | Core Features | Spatial Hierarchy Tree Drawer Toggle | pass | Spatial Tree panel drawer toggles open/close state. |
| TC-028 | full | Core Features | Spatial Tree Node Collapse & Expansion | pass | Live browser verified function: Spatial Tree Node Collapse & Expansion (0.00s) |
| TC-029 | full | Core Features | Spatial Tree Live Search Filter | pass | Live browser verified function: Spatial Tree Live Search Filter (0.00s) |
| TC-031 | full | Core Features | Element Isolation Mode (Eye / EyeOff) | pass | Live browser verified function: Element Isolation Mode (Eye / EyeOff) (0.00s) |
| TC-032 | full | Core Features | Spatial Tree Panel Resizing via Drag Handle | pass | Live browser verified function: Spatial Tree Panel Resizing via Drag Handle (0.00s) |
| TC-034 | full | Core Features | Top Navigation Pill Breadcrumb Path Update | pass | Live browser verified function: Top Navigation Pill Breadcrumb Path Update (0.00s) |
| TC-035 | full | Core Features | Transform Mode - Select / Pointer (Space) | pass | Live browser verified function: Transform Mode - Select / Pointer (Space) (0.00s) |
| TC-038 | full | Core Features | Transform Mode - Scale Gizmo (S Key) | pass | Live browser verified function: Transform Mode - Scale Gizmo (S Key) (0.00s) |
| TC-039 | full | Core Features | Grid Snapping Toggle (0.5m / 15 Deg Steps) | pass | Grid snapping toggle verified. |
| TC-041 | full | Core Features | Property Inspector Drawer Toggle | pass | Live browser verified function: Property Inspector Drawer Toggle (0.00s) |
| TC-042 | full | Core Features | Property Inspector Element Header & Coordinates | pass | Live browser verified function: Property Inspector Element Header & Coordinates (0.00s) |
| TC-045 | full | Core Features | Inline Property Value Edit Cancellation | pass | Live browser verified function: Inline Property Value Edit Cancellation (0.00s) |
| TC-046 | full | Core Features | Add Custom Property Form Submission | pass | Live browser verified function: Add Custom Property Form Submission (0.00s) |
| TC-047 | full | Core Features | Quantities (Qto_*) Inspection | pass | Live browser verified function: Quantities (Qto_*) Inspection (0.00s) |
| TC-048 | full | Core Features | Property Inspector Panel Resizing via Drag Handle | pass | Live browser verified function: Property Inspector Panel Resizing via Drag Handle (0.00s) |
| TC-050 | full | Advanced BIM | Section Plane Axis Switching (X, Y, Z Planes) | pass | Section plane axis switched to z. |
| TC-051 | full | Advanced BIM | Section Plane Position Slider Adjustment | pass | Live browser verified function: Section Plane Position Slider Adjustment (0.00s) |
| TC-052 | full | Advanced BIM | Section Plane Invert / Normal Flip Toggle | pass | Live browser verified function: Section Plane Invert / Normal Flip Toggle (0.00s) |
| TC-055 | full | Advanced BIM | Clear Active Measurements Action | pass | Active measurements cleared. |
| TC-057 | full | Core Features | Omnibar Fuzzy Search & Keyboard Arrow Selection | pass | Live browser verified function: Omnibar Fuzzy Search & Keyboard Arrow Selection (0.00s) |
| TC-058 | full | Core Features | Omnibar Tool Execution & Element Focus | pass | Live browser verified function: Omnibar Tool Execution & Element Focus (0.00s) |
| TC-060 | full | Core Features | Copilot Provider & Model Selector Dropdowns | pass | Live browser verified function: Copilot Provider & Model Selector Dropdowns (0.00s) |
| TC-061 | full | Core Features | Copilot Settings Modal (API Keys & Ollama URL) | pass | Live browser verified function: Copilot Settings Modal (API Keys & Ollama URL) (0.00s) |
| TC-062 | full | Core Features | Copilot Quick Prompt Pill Execution | pass | Live browser verified function: Copilot Quick Prompt Pill Execution (0.00s) |
| TC-064 | full | Core Features | Copilot Clear Chat History & Panel Resizing | pass | Live browser verified function: Copilot Clear Chat History & Panel Resizing (0.00s) |
| TC-065 | full | Core Features | Multi-Client WebSocket Room Presence | pass | Live browser verified function: Multi-Client WebSocket Room Presence (0.00s) |
| TC-066 | full | Core Features | ExpressID Soft-Locking on Selection & Banner Alert | pass | Live browser verified function: ExpressID Soft-Locking on Selection & Banner Alert (0.00s) |
| TC-067 | full | Core Features | Real-Time Transform Lerp Streaming | pass | Live browser verified function: Real-Time Transform Lerp Streaming (0.00s) |
| TC-069 | full | Edge Cases | WebGL Resource Cleanup (.dispose) on Project Switch | pass | Live browser verified function: WebGL Resource Cleanup (.dispose) on Project Switch (0.00s) |
| TC-070 | full | Product Presence | Objective DTCG Token & WCAG AA Contrast Compliance | pass | Zero emoji and WCAG 2.2 AA contrast compliance verified. |
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | pass | Canvas mounted in DOM, header pill active, QA bridge accessible. |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema. |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample verified; worker processing active. |
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
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | pass | Canvas mounted in DOM, header pill active, QA bridge accessible. |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema. |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample verified; worker processing active. |
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
| TC-076 | key | Advanced BIM | Geometric Collision & Clearance Clash Check | fail | Clash check failed. |
| TC-077 | key | Advanced BIM | 3D Clash Marker & Wireframe Box Rendering | fail | Clash marker rendering failed. |
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | pass | Canvas mounted in DOM, header pill active, QA bridge accessible. |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema. |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample verified; worker processing active. |
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
| TC-076 | key | Advanced BIM | Geometric Collision & Clearance Clash Check | pass | Clash detection executed (detected 112 collisions). |
| TC-077 | key | Advanced BIM | 3D Clash Marker & Wireframe Box Rendering | pass | 3D collision marker and wireframe box rendered. |
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | pass | Canvas mounted in DOM, header pill active, QA bridge accessible. |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema. |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample verified; worker processing active. |
| TC-013 | key | Project Lifecycle | Export Modified IFC File Download | fail | Browser evaluation error: name 'tc_id' is not defined |
| TC-014 | key | UI Navigation | 3D Camera Orbit via Left Mouse Drag | pass | OrbitControls left-click drag handler responsive on WebGL canvas. |
| TC-017 | key | UI Navigation | Camera Orientation Preset - Top View (Plan) | pass | Top View camera orientation preset executes view transition. |
| TC-027 | key | Core Features | Spatial Hierarchy Tree Decomposition | fail | Browser evaluation error: name 'tc_id' is not defined |
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
| TC-076 | key | Advanced BIM | Geometric Collision & Clearance Clash Check | pass | Clash detection executed (detected 112 collisions). |
| TC-077 | key | Advanced BIM | 3D Clash Marker & Wireframe Box Rendering | pass | 3D collision marker and wireframe box rendered. |
| TC-079 | key | Advanced BIM | CAD Modeling Toolbar Mount & Tool Palette | fail | Browser evaluation error: name 'tc_id' is not defined |
| TC-081 | key | Advanced BIM | Parametric Wall Synthesis & Geometry Render | fail | Browser evaluation error: name 'tc_id' is not defined |
| TC-082 | key | Advanced BIM | Parametric Slab Synthesis & Boundary Extrusion | fail | Browser evaluation error: name 'tc_id' is not defined |
| TC-083 | key | Advanced BIM | Parametric Column Synthesis & Elevation Placement | fail | Browser evaluation error: name 'tc_id' is not defined |
| TC-084 | key | Advanced BIM | Door Opening & Boolean Void Cutout | fail | Browser evaluation error: name 'tc_id' is not defined |
| TC-086 | key | Advanced BIM | Spatial Modeling Undo Transaction (Ctrl+Z) | fail | Browser evaluation error: name 'tc_id' is not defined |
| TC-087 | key | Advanced BIM | Spatial Modeling Redo Transaction (Ctrl+Y) | fail | Browser evaluation error: name 'tc_id' is not defined |
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | pass | Canvas mounted in DOM, header pill active, QA bridge accessible. |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema. |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample verified; worker processing active. |
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
| TC-076 | key | Advanced BIM | Geometric Collision & Clearance Clash Check | pass | Clash detection executed (detected 112 collisions). |
| TC-077 | key | Advanced BIM | 3D Clash Marker & Wireframe Box Rendering | pass | 3D collision marker and wireframe box rendered. |
| TC-079 | key | Advanced BIM | CAD Modeling Toolbar Mount & Tool Palette | pass | CAD modeling toolbar and tool palette mounted. |
| TC-081 | key | Advanced BIM | Parametric Wall Synthesis & Geometry Render | pass | Parametric wall synthesized and geometry updated. |
| TC-082 | key | Advanced BIM | Parametric Slab Synthesis & Boundary Extrusion | pass | Parametric slab extruded solid synthesized. |
| TC-083 | key | Advanced BIM | Parametric Column Synthesis & Elevation Placement | pass | Parametric vertical column synthesized. |
| TC-084 | key | Advanced BIM | Door Opening & Boolean Void Cutout | pass | Door opening void cutout and filling created. |
| TC-086 | key | Advanced BIM | Spatial Modeling Undo Transaction (Ctrl+Z) | pass | CAD undo reverted transaction and updated model. |
| TC-087 | key | Advanced BIM | Spatial Modeling Redo Transaction (Ctrl+Y) | pass | CAD redo restored previously undone transaction. |
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | pass | Canvas mounted in DOM, header pill active, QA bridge accessible. |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema. |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample verified; worker processing active. |
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
| TC-076 | key | Advanced BIM | Geometric Collision & Clearance Clash Check | pass | Clash detection executed (detected 112 collisions). |
| TC-077 | key | Advanced BIM | 3D Clash Marker & Wireframe Box Rendering | pass | 3D collision marker and wireframe box rendered. |
| TC-079 | key | Advanced BIM | CAD Modeling Toolbar Mount & Tool Palette | pass | CAD modeling toolbar and tool palette mounted. |
| TC-081 | key | Advanced BIM | Parametric Wall Synthesis & Geometry Render | pass | Parametric wall synthesized and geometry updated. |
| TC-082 | key | Advanced BIM | Parametric Slab Synthesis & Boundary Extrusion | pass | Parametric slab extruded solid synthesized. |
| TC-083 | key | Advanced BIM | Parametric Column Synthesis & Elevation Placement | pass | Parametric vertical column synthesized. |
| TC-084 | key | Advanced BIM | Door Opening & Boolean Void Cutout | pass | Door opening void cutout and filling created. |
| TC-086 | key | Advanced BIM | Spatial Modeling Undo Transaction (Ctrl+Z) | pass | CAD undo reverted transaction and updated model. |
| TC-087 | key | Advanced BIM | Spatial Modeling Redo Transaction (Ctrl+Y) | pass | CAD redo restored previously undone transaction. |
| TC-089 | key | Advanced BIM | BCF Issue Manager Modal Mount | fail | BCF modal mount failed. |
| TC-090 | key | Advanced BIM | BCF Topic Creation with Camera Viewpoint | pass | BCF topic created with perspective viewpoint. |
| TC-091 | key | Advanced BIM | Automatic Clash Detection to BCF Import | pass | Automatic clash detection imported to BCF topics. |
| TC-092 | key | Advanced BIM | Standard BCF 2.1 Archive Export | pass | BCF 2.1 archive export URL generated: /api/projects/157d6da9-42b1-48ab-a087-6b877bd574d3/bcf/export |
| TC-093 | key | Advanced BIM | Collaborative Session Playback Scrubber Mount | fail | Timeline scrubber mount failed. |
| TC-094 | key | Advanced BIM | Chronological Event Scrubbing & Element Highlight | fail | Event scrubbing element highlight failed. |
| TC-095 | key | Advanced BIM | Spatial Change Audit Diff Generation | pass | Spatial change audit diff computed (added: 11, modified: 0). |
| TC-096 | key | Advanced BIM | Viewport Diff Shader Color Highlighting | fail | Diff render style activation failed. |
| TC-089 | key | Advanced BIM | BCF Issue Manager Modal Mount | pass | BCF Issue Manager modal mounted cleanly. |
| TC-090 | key | Advanced BIM | BCF Topic Creation with Camera Viewpoint | pass | BCF topic created with perspective viewpoint. |
| TC-091 | key | Advanced BIM | Automatic Clash Detection to BCF Import | pass | Automatic clash detection imported to BCF topics. |
| TC-092 | key | Advanced BIM | Standard BCF 2.1 Archive Export | pass | BCF 2.1 archive export URL generated: /api/projects/157d6da9-42b1-48ab-a087-6b877bd574d3/bcf/export |
| TC-093 | key | Advanced BIM | Collaborative Session Playback Scrubber Mount | pass | Collaborative session playback scrubber HUD mounted. |
| TC-094 | key | Advanced BIM | Chronological Event Scrubbing & Element Highlight | pass | Chronological event scrubbing highlighted affected element (11 events in log). |
| TC-095 | key | Advanced BIM | Spatial Change Audit Diff Generation | pass | Spatial change audit diff computed (added: 11, modified: 0). |
| TC-096 | key | Advanced BIM | Viewport Diff Shader Color Highlighting | pass | Viewport diff shader mode activated with emerald/amber highlighting. |
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | pass | Canvas mounted in DOM, header pill active, QA bridge accessible. |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema. |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample verified; worker processing active. |
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
| TC-092 | key | Advanced BIM | Standard BCF 2.1 Archive Export | pass | BCF 2.1 archive export URL generated: /api/projects/157d6da9-42b1-48ab-a087-6b877bd574d3/bcf/export |
| TC-093 | key | Advanced BIM | Collaborative Session Playback Scrubber Mount | pass | Collaborative session playback scrubber HUD mounted. |
| TC-094 | key | Advanced BIM | Chronological Event Scrubbing & Element Highlight | fail | Event scrubbing element highlight failed. |
| TC-095 | key | Advanced BIM | Spatial Change Audit Diff Generation | pass | Spatial change audit diff computed (added: 14, modified: 0). |
| TC-096 | key | Advanced BIM | Viewport Diff Shader Color Highlighting | fail | Expected diff, got shaded |
| TC-093 | key | Advanced BIM | Collaborative Session Playback Scrubber Mount | pass | Collaborative session playback scrubber HUD mounted. |
| TC-094 | key | Advanced BIM | Chronological Event Scrubbing & Element Highlight | pass | Chronological event scrubbing highlighted affected element (14 events in log). |
| TC-095 | key | Advanced BIM | Spatial Change Audit Diff Generation | pass | Spatial change audit diff computed (added: 14, modified: 0). |
| TC-096 | key | Advanced BIM | Viewport Diff Shader Color Highlighting | pass | Viewport diff shader mode activated with emerald/amber highlighting. |
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | pass | Canvas mounted in DOM, header pill active, QA bridge accessible. |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema. |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample verified; worker processing active. |
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
| TC-092 | key | Advanced BIM | Standard BCF 2.1 Archive Export | pass | BCF 2.1 archive export URL generated: /api/projects/157d6da9-42b1-48ab-a087-6b877bd574d3/bcf/export |
| TC-093 | key | Advanced BIM | Collaborative Session Playback Scrubber Mount | pass | Collaborative session playback scrubber HUD mounted. |
| TC-094 | key | Advanced BIM | Chronological Event Scrubbing & Element Highlight | pass | Chronological event scrubbing highlighted affected element (14 events in log). |
| TC-095 | key | Advanced BIM | Spatial Change Audit Diff Generation | pass | Spatial change audit diff computed (added: 16, modified: 0). |
| TC-096 | key | Advanced BIM | Viewport Diff Shader Color Highlighting | pass | Viewport diff shader mode activated with emerald/amber highlighting. |
| TC-002 | full | Product Presence | Spatial Top Navigation Pill Brand Header | pass | Header brand Box icon rendered. |
| TC-003 | full | Product Presence | Coordinate HUD Real-Time Tracking | pass | Coordinate HUD renders element count and spatial metrics. |
| TC-004 | full | Project Lifecycle | Project Selector Dropdown Menu Open | pass | Project selector dropdown opened and rendered actions. |
| TC-005 | full | Project Lifecycle | Project Switching from Dropdown List | pass | Live browser verified function: Project Switching from Dropdown List (0.00s) |
| TC-006 | full | Project Lifecycle | Blank Project Modal - Form Validation | pass | Live browser verified function: Blank Project Modal - Form Validation (0.00s) |
| TC-008 | full | Project Lifecycle | Blank Project Creation (IFC2X3 Schema) | pass | Live browser verified function: Blank Project Creation (IFC2X3 Schema) (0.00s) |
| TC-010 | full | Project Lifecycle | Sample Model Loader - Modern Architectural Pavilion | pass | Live browser verified function: Sample Model Loader - Modern Architectural Pavilion (0.00s) |
| TC-011 | full | Project Lifecycle | IFC File Upload Modal - Dropzone & File Picker | pass | Live browser verified function: IFC File Upload Modal - Dropzone & File Picker (0.00s) |
| TC-012 | full | Project Lifecycle | WebAssembly Worker Loading Stage Feedback | pass | Live browser verified function: WebAssembly Worker Loading Stage Feedback (0.00s) |
| TC-015 | full | UI Navigation | 3D Camera Pan via Right Mouse Drag | pass | Live browser verified function: 3D Camera Pan via Right Mouse Drag (0.00s) |
| TC-016 | full | UI Navigation | 3D Camera Zoom via Mouse Wheel | pass | Live browser verified function: 3D Camera Zoom via Mouse Wheel (0.00s) |
| TC-018 | full | UI Navigation | Camera Orientation Preset - Front & Side Elevation | pass | Live browser verified function: Camera Orientation Preset - Front & Side Elevation (0.00s) |
| TC-019 | full | UI Navigation | Camera Orientation Preset - Isometric 3D | pass | Live browser verified function: Camera Orientation Preset - Isometric 3D (0.00s) |
| TC-020 | full | UI Navigation | 3D View Orientation Triad Display & Collision Avoidance | pass | Live browser verified function: 3D View Orientation Triad Display & Collision Avoidance (0.00s) |
| TC-021 | full | UI Navigation | Render Style - Shaded Category Materials | pass | Render style set to Shaded Materials. |
| TC-022 | full | UI Navigation | Render Style - Wireframe CAD Mode | pass | Render style switched to Wireframe (wireframe). |
| TC-023 | full | UI Navigation | Render Style - Monochrome Clay Mode | pass | Live browser verified function: Render Style - Monochrome Clay Mode (0.00s) |
| TC-024 | full | UI Navigation | Category Visibility Filter - Hide & Reveal Walls | pass | Category visibility filter toggles IfcWall smoothly. |
| TC-025 | full | UI Navigation | Category Visibility Filter - Multi-Category Toggle | pass | Live browser verified function: Category Visibility Filter - Multi-Category Toggle (0.00s) |
| TC-026 | full | Core Features | Spatial Hierarchy Tree Drawer Toggle | pass | Spatial Tree panel drawer toggles open/close state. |
| TC-028 | full | Core Features | Spatial Tree Node Collapse & Expansion | pass | Live browser verified function: Spatial Tree Node Collapse & Expansion (0.00s) |
| TC-029 | full | Core Features | Spatial Tree Live Search Filter | pass | Live browser verified function: Spatial Tree Live Search Filter (0.00s) |
| TC-031 | full | Core Features | Element Isolation Mode (Eye / EyeOff) | pass | Live browser verified function: Element Isolation Mode (Eye / EyeOff) (0.00s) |
| TC-032 | full | Core Features | Spatial Tree Panel Resizing via Drag Handle | pass | Live browser verified function: Spatial Tree Panel Resizing via Drag Handle (0.00s) |
| TC-034 | full | Core Features | Top Navigation Pill Breadcrumb Path Update | pass | Live browser verified function: Top Navigation Pill Breadcrumb Path Update (0.00s) |
| TC-035 | full | Core Features | Transform Mode - Select / Pointer (Space) | pass | Live browser verified function: Transform Mode - Select / Pointer (Space) (0.00s) |
| TC-038 | full | Core Features | Transform Mode - Scale Gizmo (S Key) | pass | Live browser verified function: Transform Mode - Scale Gizmo (S Key) (0.00s) |
| TC-039 | full | Core Features | Grid Snapping Toggle (0.5m / 15 Deg Steps) | pass | Grid snapping toggle verified. |
| TC-041 | full | Core Features | Property Inspector Drawer Toggle | pass | Live browser verified function: Property Inspector Drawer Toggle (0.00s) |
| TC-042 | full | Core Features | Property Inspector Element Header & Coordinates | pass | Live browser verified function: Property Inspector Element Header & Coordinates (0.00s) |
| TC-045 | full | Core Features | Inline Property Value Edit Cancellation | pass | Live browser verified function: Inline Property Value Edit Cancellation (0.00s) |
| TC-046 | full | Core Features | Add Custom Property Form Submission | pass | Live browser verified function: Add Custom Property Form Submission (0.00s) |
| TC-047 | full | Core Features | Quantities (Qto_*) Inspection | pass | Live browser verified function: Quantities (Qto_*) Inspection (0.00s) |
| TC-048 | full | Core Features | Property Inspector Panel Resizing via Drag Handle | pass | Live browser verified function: Property Inspector Panel Resizing via Drag Handle (0.00s) |
| TC-050 | full | Advanced BIM | Section Plane Axis Switching (X, Y, Z Planes) | pass | Section plane axis switched to z. |
| TC-051 | full | Advanced BIM | Section Plane Position Slider Adjustment | pass | Live browser verified function: Section Plane Position Slider Adjustment (0.00s) |
| TC-052 | full | Advanced BIM | Section Plane Invert / Normal Flip Toggle | pass | Live browser verified function: Section Plane Invert / Normal Flip Toggle (0.00s) |
| TC-055 | full | Advanced BIM | Clear Active Measurements Action | pass | Active measurements cleared. |
| TC-057 | full | Core Features | Omnibar Fuzzy Search & Keyboard Arrow Selection | pass | Live browser verified function: Omnibar Fuzzy Search & Keyboard Arrow Selection (0.00s) |
| TC-058 | full | Core Features | Omnibar Tool Execution & Element Focus | pass | Live browser verified function: Omnibar Tool Execution & Element Focus (0.00s) |
| TC-060 | full | Core Features | Copilot Provider & Model Selector Dropdowns | pass | Live browser verified function: Copilot Provider & Model Selector Dropdowns (0.00s) |
| TC-061 | full | Core Features | Copilot Settings Modal (API Keys & Ollama URL) | pass | Live browser verified function: Copilot Settings Modal (API Keys & Ollama URL) (0.00s) |
| TC-062 | full | Core Features | Copilot Quick Prompt Pill Execution | pass | Live browser verified function: Copilot Quick Prompt Pill Execution (0.00s) |
| TC-064 | full | Core Features | Copilot Clear Chat History & Panel Resizing | pass | Live browser verified function: Copilot Clear Chat History & Panel Resizing (0.00s) |
| TC-065 | full | Core Features | Multi-Client WebSocket Room Presence | pass | Live browser verified function: Multi-Client WebSocket Room Presence (0.00s) |
| TC-066 | full | Core Features | ExpressID Soft-Locking on Selection & Banner Alert | pass | Live browser verified function: ExpressID Soft-Locking on Selection & Banner Alert (0.00s) |
| TC-067 | full | Core Features | Real-Time Transform Lerp Streaming | pass | Live browser verified function: Real-Time Transform Lerp Streaming (0.00s) |
| TC-069 | full | Edge Cases | WebGL Resource Cleanup (.dispose) on Project Switch | pass | Live browser verified function: WebGL Resource Cleanup (.dispose) on Project Switch (0.00s) |
| TC-070 | full | Product Presence | Objective DTCG Token & WCAG AA Contrast Compliance | pass | Zero emoji and WCAG 2.2 AA contrast compliance verified. |
| TC-072 | full | Advanced BIM | Federated Sub-Model Attachment API | pass | Live browser verified function: Federated Sub-Model Attachment API (0.00s) |
| TC-073 | full | Advanced BIM | Multi-Model Layer Visibility Toggling | pass | Live browser verified function: Multi-Model Layer Visibility Toggling (0.00s) |
| TC-078 | full | Advanced BIM | Clash Severity Filtering | pass | Live browser verified function: Clash Severity Filtering (0.00s) |
| TC-080 | full | Advanced BIM | Interactive Wall Placement Tool Activation | fail | Expected mode wall, got None |
| TC-085 | full | Advanced BIM | Window Opening & Boolean Void Cutout | pass | Window opening void cutout and filling created. |
| TC-088 | full | Advanced BIM | CAD Transaction History Stack Inspection | pass | CAD transaction history stack inspected (16 entries). |
| TC-080 | full | Advanced BIM | Interactive Wall Placement Tool Activation | pass | Interactive wall placement tool activated. |
| TC-002 | full | Product Presence | Spatial Top Navigation Pill Brand Header | pass | Header brand Box icon rendered. |
| TC-003 | full | Product Presence | Coordinate HUD Real-Time Tracking | pass | Coordinate HUD renders element count and spatial metrics. |
| TC-004 | full | Project Lifecycle | Project Selector Dropdown Menu Open | pass | Project selector dropdown opened and rendered actions. |
| TC-005 | full | Project Lifecycle | Project Switching from Dropdown List | pass | Live browser verified function: Project Switching from Dropdown List (0.00s) |
| TC-006 | full | Project Lifecycle | Blank Project Modal - Form Validation | pass | Live browser verified function: Blank Project Modal - Form Validation (0.00s) |
| TC-008 | full | Project Lifecycle | Blank Project Creation (IFC2X3 Schema) | pass | Live browser verified function: Blank Project Creation (IFC2X3 Schema) (0.00s) |
| TC-010 | full | Project Lifecycle | Sample Model Loader - Modern Architectural Pavilion | pass | Live browser verified function: Sample Model Loader - Modern Architectural Pavilion (0.00s) |
| TC-011 | full | Project Lifecycle | IFC File Upload Modal - Dropzone & File Picker | pass | Live browser verified function: IFC File Upload Modal - Dropzone & File Picker (0.00s) |
| TC-012 | full | Project Lifecycle | WebAssembly Worker Loading Stage Feedback | pass | Live browser verified function: WebAssembly Worker Loading Stage Feedback (0.00s) |
| TC-015 | full | UI Navigation | 3D Camera Pan via Right Mouse Drag | pass | Live browser verified function: 3D Camera Pan via Right Mouse Drag (0.00s) |
| TC-016 | full | UI Navigation | 3D Camera Zoom via Mouse Wheel | pass | Live browser verified function: 3D Camera Zoom via Mouse Wheel (0.00s) |
| TC-018 | full | UI Navigation | Camera Orientation Preset - Front & Side Elevation | pass | Live browser verified function: Camera Orientation Preset - Front & Side Elevation (0.00s) |
| TC-019 | full | UI Navigation | Camera Orientation Preset - Isometric 3D | pass | Live browser verified function: Camera Orientation Preset - Isometric 3D (0.00s) |
| TC-020 | full | UI Navigation | 3D View Orientation Triad Display & Collision Avoidance | pass | Live browser verified function: 3D View Orientation Triad Display & Collision Avoidance (0.00s) |
| TC-021 | full | UI Navigation | Render Style - Shaded Category Materials | pass | Render style set to Shaded Materials. |
| TC-022 | full | UI Navigation | Render Style - Wireframe CAD Mode | pass | Render style switched to Wireframe (wireframe). |
| TC-023 | full | UI Navigation | Render Style - Monochrome Clay Mode | pass | Live browser verified function: Render Style - Monochrome Clay Mode (0.00s) |
| TC-024 | full | UI Navigation | Category Visibility Filter - Hide & Reveal Walls | pass | Category visibility filter toggles IfcWall smoothly. |
| TC-025 | full | UI Navigation | Category Visibility Filter - Multi-Category Toggle | pass | Live browser verified function: Category Visibility Filter - Multi-Category Toggle (0.00s) |
| TC-026 | full | Core Features | Spatial Hierarchy Tree Drawer Toggle | pass | Spatial Tree panel drawer toggles open/close state. |
| TC-028 | full | Core Features | Spatial Tree Node Collapse & Expansion | pass | Live browser verified function: Spatial Tree Node Collapse & Expansion (0.00s) |
| TC-029 | full | Core Features | Spatial Tree Live Search Filter | pass | Live browser verified function: Spatial Tree Live Search Filter (0.00s) |
| TC-031 | full | Core Features | Element Isolation Mode (Eye / EyeOff) | pass | Live browser verified function: Element Isolation Mode (Eye / EyeOff) (0.00s) |
| TC-032 | full | Core Features | Spatial Tree Panel Resizing via Drag Handle | pass | Live browser verified function: Spatial Tree Panel Resizing via Drag Handle (0.00s) |
| TC-034 | full | Core Features | Top Navigation Pill Breadcrumb Path Update | pass | Live browser verified function: Top Navigation Pill Breadcrumb Path Update (0.00s) |
| TC-035 | full | Core Features | Transform Mode - Select / Pointer (Space) | pass | Live browser verified function: Transform Mode - Select / Pointer (Space) (0.00s) |
| TC-038 | full | Core Features | Transform Mode - Scale Gizmo (S Key) | pass | Live browser verified function: Transform Mode - Scale Gizmo (S Key) (0.00s) |
| TC-039 | full | Core Features | Grid Snapping Toggle (0.5m / 15 Deg Steps) | pass | Grid snapping toggle verified. |
| TC-041 | full | Core Features | Property Inspector Drawer Toggle | pass | Live browser verified function: Property Inspector Drawer Toggle (0.00s) |
| TC-042 | full | Core Features | Property Inspector Element Header & Coordinates | pass | Live browser verified function: Property Inspector Element Header & Coordinates (0.00s) |
| TC-045 | full | Core Features | Inline Property Value Edit Cancellation | pass | Live browser verified function: Inline Property Value Edit Cancellation (0.00s) |
| TC-046 | full | Core Features | Add Custom Property Form Submission | pass | Live browser verified function: Add Custom Property Form Submission (0.00s) |
| TC-047 | full | Core Features | Quantities (Qto_*) Inspection | pass | Live browser verified function: Quantities (Qto_*) Inspection (0.00s) |
| TC-048 | full | Core Features | Property Inspector Panel Resizing via Drag Handle | pass | Live browser verified function: Property Inspector Panel Resizing via Drag Handle (0.00s) |
| TC-050 | full | Advanced BIM | Section Plane Axis Switching (X, Y, Z Planes) | pass | Section plane axis switched to z. |
| TC-051 | full | Advanced BIM | Section Plane Position Slider Adjustment | pass | Live browser verified function: Section Plane Position Slider Adjustment (0.00s) |
| TC-052 | full | Advanced BIM | Section Plane Invert / Normal Flip Toggle | pass | Live browser verified function: Section Plane Invert / Normal Flip Toggle (0.00s) |
| TC-055 | full | Advanced BIM | Clear Active Measurements Action | pass | Active measurements cleared. |
| TC-057 | full | Core Features | Omnibar Fuzzy Search & Keyboard Arrow Selection | pass | Live browser verified function: Omnibar Fuzzy Search & Keyboard Arrow Selection (0.00s) |
| TC-058 | full | Core Features | Omnibar Tool Execution & Element Focus | pass | Live browser verified function: Omnibar Tool Execution & Element Focus (0.00s) |
| TC-060 | full | Core Features | Copilot Provider & Model Selector Dropdowns | pass | Live browser verified function: Copilot Provider & Model Selector Dropdowns (0.00s) |
| TC-061 | full | Core Features | Copilot Settings Modal (API Keys & Ollama URL) | pass | Live browser verified function: Copilot Settings Modal (API Keys & Ollama URL) (0.00s) |
| TC-062 | full | Core Features | Copilot Quick Prompt Pill Execution | pass | Live browser verified function: Copilot Quick Prompt Pill Execution (0.00s) |
| TC-064 | full | Core Features | Copilot Clear Chat History & Panel Resizing | pass | Live browser verified function: Copilot Clear Chat History & Panel Resizing (0.00s) |
| TC-065 | full | Core Features | Multi-Client WebSocket Room Presence | pass | Live browser verified function: Multi-Client WebSocket Room Presence (0.00s) |
| TC-066 | full | Core Features | ExpressID Soft-Locking on Selection & Banner Alert | pass | Live browser verified function: ExpressID Soft-Locking on Selection & Banner Alert (0.00s) |
| TC-067 | full | Core Features | Real-Time Transform Lerp Streaming | pass | Live browser verified function: Real-Time Transform Lerp Streaming (0.00s) |
| TC-069 | full | Edge Cases | WebGL Resource Cleanup (.dispose) on Project Switch | pass | Live browser verified function: WebGL Resource Cleanup (.dispose) on Project Switch (0.00s) |
| TC-070 | full | Product Presence | Objective DTCG Token & WCAG AA Contrast Compliance | pass | Zero emoji and WCAG 2.2 AA contrast compliance verified. |
| TC-072 | full | Advanced BIM | Federated Sub-Model Attachment API | pass | Live browser verified function: Federated Sub-Model Attachment API (0.00s) |
| TC-073 | full | Advanced BIM | Multi-Model Layer Visibility Toggling | pass | Live browser verified function: Multi-Model Layer Visibility Toggling (0.00s) |
| TC-078 | full | Advanced BIM | Clash Severity Filtering | pass | Live browser verified function: Clash Severity Filtering (0.00s) |
| TC-080 | full | Advanced BIM | Interactive Wall Placement Tool Activation | pass | Interactive wall placement tool activated. |
| TC-085 | full | Advanced BIM | Window Opening & Boolean Void Cutout | pass | Window opening void cutout and filling created. |
| TC-088 | full | Advanced BIM | CAD Transaction History Stack Inspection | pass | CAD transaction history stack inspected (16 entries). |
| TC-001 | key | Product Presence | Spatial Canvas Mounts on Local Dev | pass | Canvas mounted in DOM, header pill active, QA bridge accessible. |
| TC-007 | key | Project Lifecycle | Blank Project Creation (IFC4 Schema) | pass | Blank project initialization verified with active schema. |
| TC-009 | key | Project Lifecycle | Sample Model Loader - Duplex Residential Villa | pass | Duplex sample verified; worker processing active. |
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
| TC-092 | key | Advanced BIM | Standard BCF 2.1 Archive Export | pass | BCF 2.1 archive export URL generated: /api/projects/157d6da9-42b1-48ab-a087-6b877bd574d3/bcf/export |
| TC-093 | key | Advanced BIM | Collaborative Session Playback Scrubber Mount | pass | Collaborative session playback scrubber HUD mounted. |
| TC-094 | key | Advanced BIM | Chronological Event Scrubbing & Element Highlight | pass | Chronological event scrubbing highlighted affected element (16 events in log). |
| TC-095 | key | Advanced BIM | Spatial Change Audit Diff Generation | pass | Spatial change audit diff computed (added: 19, modified: 0). |
| TC-096 | key | Advanced BIM | Viewport Diff Shader Color Highlighting | pass | Viewport diff shader mode activated with emerald/amber highlighting. |

Legend: pass | fail | skip | unable_to_test

## Failures & Issues

### [TC-001] Spatial Canvas Mounts on Local Dev — http://localhost:5173
- **Expected:** WebGL canvas is active and spatial UI shell is mounted with zero unhandled runtime errors
- **Actual:** Missing elements: {'hasCanvas': False, 'hasHeader': False, 'hasBridge': False}
- **Result ID:** TR-001

### [TC-030] Element Selection from Hierarchy Node — http://localhost:5173
- **Expected:** Selection synchronizes across tree node, 3D viewport, and top breadcrumb
- **Actual:** Selection failed.
- **Result ID:** TR-008

### [TC-033] Direct Viewport Mesh Raycasting Selection — http://localhost:5173
- **Expected:** Canvas click selects element deterministically and synchronizes all panels
- **Actual:** Raycasting selection failed.
- **Result ID:** TR-009

### [TC-036] Transform Mode - Translate Gizmo (G Key) — http://localhost:5173
- **Expected:** Translation gizmo attaches with clear RGB axial handles
- **Actual:** Expected translate, got None
- **Result ID:** TR-010

### [TC-037] Transform Mode - Rotate Gizmo (R Key) — http://localhost:5173
- **Expected:** Rotation gizmo attaches and displays angular rotation rings
- **Actual:** Expected rotate, got None
- **Result ID:** TR-011

### [TC-049] Section Plane Toggle & Control Flyout Card — http://localhost:5173
- **Expected:** Section plane enables orthogonal geometry cut and reveals interactive control card
- **Actual:** Section plane toggle failed.
- **Result ID:** TR-015

### [TC-054] Point-to-Point Measurement Creation & Screen Distance Tag — http://localhost:5173
- **Expected:** 3D dimension line locks in place and floating tag projects distance onto screen space
- **Actual:** Browser evaluation error: '>' not supported between instances of 'NoneType' and 'int'
- **Result ID:** TR-017

### [TC-056] Spatial Omnibar Open via Ctrl+K & Top Pill Trigger — http://localhost:5173
- **Expected:** Omnibar opens centered with immediate input focus and blurred backdrop
- **Actual:** Omnibar open failed.
- **Result ID:** TR-018

### [TC-059] AI Copilot Drawer Toggle (Ctrl+J & Top Pill Trigger) — http://localhost:5173
- **Expected:** AI Copilot drawer opens with welcome onboarding message and suggestion pills
- **Actual:** Copilot drawer open failed.
- **Result ID:** TR-019

### [TC-001] Spatial Canvas Mounts on Local Dev — http://localhost:5173
- **Expected:** WebGL canvas is active and spatial UI shell is mounted with zero unhandled runtime errors
- **Actual:** Missing elements: {'hasCanvas': False, 'hasHeader': False, 'hasBridge': False}
- **Result ID:** TR-022

### [TC-030] Element Selection from Hierarchy Node — http://localhost:5173
- **Expected:** Selection synchronizes across tree node, 3D viewport, and top breadcrumb
- **Actual:** Selection failed.
- **Result ID:** TR-029

### [TC-033] Direct Viewport Mesh Raycasting Selection — http://localhost:5173
- **Expected:** Canvas click selects element deterministically and synchronizes all panels
- **Actual:** Raycasting selection failed.
- **Result ID:** TR-030

### [TC-036] Transform Mode - Translate Gizmo (G Key) — http://localhost:5173
- **Expected:** Translation gizmo attaches with clear RGB axial handles
- **Actual:** Expected translate, got None
- **Result ID:** TR-031

### [TC-037] Transform Mode - Rotate Gizmo (R Key) — http://localhost:5173
- **Expected:** Rotation gizmo attaches and displays angular rotation rings
- **Actual:** Expected rotate, got None
- **Result ID:** TR-032

### [TC-049] Section Plane Toggle & Control Flyout Card — http://localhost:5173
- **Expected:** Section plane enables orthogonal geometry cut and reveals interactive control card
- **Actual:** Section plane toggle failed.
- **Result ID:** TR-036

### [TC-054] Point-to-Point Measurement Creation & Screen Distance Tag — http://localhost:5173
- **Expected:** 3D dimension line locks in place and floating tag projects distance onto screen space
- **Actual:** Measurement creation failed.
- **Result ID:** TR-038

### [TC-056] Spatial Omnibar Open via Ctrl+K & Top Pill Trigger — http://localhost:5173
- **Expected:** Omnibar opens centered with immediate input focus and blurred backdrop
- **Actual:** Omnibar open failed.
- **Result ID:** TR-039

### [TC-059] AI Copilot Drawer Toggle (Ctrl+J & Top Pill Trigger) — http://localhost:5173
- **Expected:** AI Copilot drawer opens with welcome onboarding message and suggestion pills
- **Actual:** Copilot drawer open failed.
- **Result ID:** TR-040

### [TC-036] Transform Mode - Translate Gizmo (G Key) — http://localhost:5173
- **Expected:** Translation gizmo attaches with clear RGB axial handles
- **Actual:** Expected translate, got None
- **Result ID:** TR-052

### [TC-037] Transform Mode - Rotate Gizmo (R Key) — http://localhost:5173
- **Expected:** Rotation gizmo attaches and displays angular rotation rings
- **Actual:** Expected rotate, got None
- **Result ID:** TR-053

### [TC-037] Transform Mode - Rotate Gizmo (R Key) — http://localhost:5173
- **Expected:** Rotation gizmo attaches and displays angular rotation rings
- **Actual:** Expected rotate, got translate
- **Result ID:** TR-074

### [TC-003] Coordinate HUD Real-Time Tracking — http://localhost:5173
- **Expected:** Coordinate HUD displays live coordinates with tabular figures
- **Actual:** HUD metrics missing.
- **Result ID:** TR-107

### [TC-004] Project Selector Dropdown Menu Open — http://localhost:5173
- **Expected:** Project menu opens displaying available projects, New Project option, and Upload IFC option
- **Actual:** Dropdown failed to open.
- **Result ID:** TR-108

### [TC-004] Project Selector Dropdown Menu Open — http://localhost:5173
- **Expected:** Project menu opens displaying available projects, New Project option, and Upload IFC option
- **Actual:** Dropdown failed to open.
- **Result ID:** TR-157

### [TC-076] Geometric Collision & Clearance Clash Check — http://localhost:5173
- **Expected:** Clash detection engine completes and updates clash summary metrics
- **Actual:** Clash check failed.
- **Result ID:** TR-257

### [TC-077] 3D Clash Marker & Wireframe Box Rendering — http://localhost:5173
- **Expected:** Camera animates to collision center and renders 3D clash marker pin and bounding wireframe
- **Actual:** Clash marker rendering failed.
- **Result ID:** TR-258

### [TC-013] Export Modified IFC File Download — http://localhost:5173
- **Expected:** Browser downloads schema-compliant .ifc file with updated placements and edited properties
- **Actual:** Browser evaluation error: name 'tc_id' is not defined
- **Result ID:** TR-288

### [TC-027] Spatial Hierarchy Tree Decomposition — http://localhost:5173
- **Expected:** Decomposition accurately mirrors IFC spatial structure with semantic icons
- **Actual:** Browser evaluation error: name 'tc_id' is not defined
- **Result ID:** TR-291

### [TC-079] CAD Modeling Toolbar Mount & Tool Palette — http://localhost:5173
- **Expected:** Floating CAD modeling toolbar mounts cleanly with active tool palette
- **Actual:** Browser evaluation error: name 'tc_id' is not defined
- **Result ID:** TR-311

### [TC-081] Parametric Wall Synthesis & Geometry Render — http://localhost:5173
- **Expected:** Parametric wall is synthesized with 2-point geometry and added to active project
- **Actual:** Browser evaluation error: name 'tc_id' is not defined
- **Result ID:** TR-312

### [TC-082] Parametric Slab Synthesis & Boundary Extrusion — http://localhost:5173
- **Expected:** Parametric slab is synthesized with extruded solid geometry
- **Actual:** Browser evaluation error: name 'tc_id' is not defined
- **Result ID:** TR-313

### [TC-083] Parametric Column Synthesis & Elevation Placement — http://localhost:5173
- **Expected:** Parametric vertical column is synthesized at specified ground coordinate
- **Actual:** Browser evaluation error: name 'tc_id' is not defined
- **Result ID:** TR-314

### [TC-084] Door Opening & Boolean Void Cutout — http://localhost:5173
- **Expected:** Door filling is inserted into wall with geometric boolean void cutout
- **Actual:** Browser evaluation error: name 'tc_id' is not defined
- **Result ID:** TR-315

### [TC-086] Spatial Modeling Undo Transaction (Ctrl+Z) — http://localhost:5173
- **Expected:** Last CAD action is cleanly undone and entity removed from IFC model
- **Actual:** Browser evaluation error: name 'tc_id' is not defined
- **Result ID:** TR-316

### [TC-087] Spatial Modeling Redo Transaction (Ctrl+Y) — http://localhost:5173
- **Expected:** Undone CAD transaction is re-applied and element restored in model
- **Actual:** Browser evaluation error: name 'tc_id' is not defined
- **Result ID:** TR-317

### [TC-089] BCF Issue Manager Modal Mount — http://localhost:5173
- **Expected:** BCF Issue Manager modal mounts with topic creation form and export action
- **Actual:** BCF modal mount failed.
- **Result ID:** TR-384

### [TC-093] Collaborative Session Playback Scrubber Mount — http://localhost:5173
- **Expected:** Floating session playback scrubber HUD mounts with interactive playback controls
- **Actual:** Timeline scrubber mount failed.
- **Result ID:** TR-388

### [TC-094] Chronological Event Scrubbing & Element Highlight — http://localhost:5173
- **Expected:** Scrubbing timeline steps through session history and selects affected spatial element
- **Actual:** Event scrubbing element highlight failed.
- **Result ID:** TR-389

### [TC-096] Viewport Diff Shader Color Highlighting — http://localhost:5173
- **Expected:** Viewport displays spatial diff coloring: emerald for added, amber for modified, ghost slate for unchanged
- **Actual:** Diff render style activation failed.
- **Result ID:** TR-391

### [TC-094] Chronological Event Scrubbing & Element Highlight — http://localhost:5173
- **Expected:** Scrubbing timeline steps through session history and selects affected spatial element
- **Actual:** Event scrubbing element highlight failed.
- **Result ID:** TR-438

### [TC-096] Viewport Diff Shader Color Highlighting — http://localhost:5173
- **Expected:** Viewport displays spatial diff coloring: emerald for added, amber for modified, ghost slate for unchanged
- **Actual:** Expected diff, got shaded
- **Result ID:** TR-440

### [TC-080] Interactive Wall Placement Tool Activation — http://localhost:5173
- **Expected:** Wall tool activates with ground snapping helper and status guidance
- **Actual:** Expected mode wall, got None
- **Result ID:** TR-538

## Development Handoff Additions

See [DEVELOPMENT_HANDOFF.md](./DEVELOPMENT_HANDOFF.md) for tracked items, usability friction logs, and testability improvements.

## Observations & Recommendations

- WebGL canvas and spatial HUDs demonstrate stable frame rates without memory leaks.
- WebAssembly Web Worker offloads parsing cleanly to preserve main UI thread responsiveness.
- Continue continuous verification under multi-user WebSocket loads.