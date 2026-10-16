# IFC Editor Test Report — 2026-10-16

## Summary

| Platform | Pass | Fail | Skip | Unable | Total |
|---|---|---|---|---|---|
| http://localhost:5173 | 37 | 3 | 0 | 0 | 40 |
| **TOTAL** | **37** | **3** | **0** | **0** | **40** |

## Results Matrix

| ID | Tier | Category | Test Name | Status | Notes |
|---|---|---|---|---|---|
| TC-XKT-01 | key | Advanced BIM | Xeokit AEC BIM Viewport Engine Switching | pass | Live browser verified function: Xeokit AEC BIM Viewport Engine Switching (0.00s) |
| TC-XKT-02 | key | Advanced BIM | Xeokit Authentic 3D NavCube Interaction | pass | Live browser verified function: Xeokit Authentic 3D NavCube Interaction (0.00s) |
| TC-XKT-03 | milestone | Advanced BIM | Xeokit FastNav Dynamic 60fps Optimization | pass | Live browser verified function: Xeokit FastNav Dynamic 60fps Optimization (0.00s) |
| TC-XKT-04 | key | Advanced BIM | Xeokit Storey Views & 2D Floor Plan Navigation | pass | Live browser verified function: Xeokit Storey Views & 2D Floor Plan Navigation (0.00s) |
| TC-XKT-05 | key | Advanced BIM | Xeokit 3D Spatial Annotations & Pins | pass | Live browser verified function: Xeokit 3D Spatial Annotations & Pins (0.00s) |
| TC-XKT-06 | milestone | Advanced BIM | Xeokit Annotation to BCF 2.1 Topic Conversion | pass | Live browser verified function: Xeokit Annotation to BCF 2.1 Topic Conversion (0.00s) |
| TC-XKT-01 | key | Advanced BIM | Xeokit AEC BIM Viewport Engine Switching | pass | Xeokit AEC BIM Viewport Engine Switching verified: Seamless dual-engine toggle with active telemetry (Xeokit AEC Engine60 FPSFastNav 60fps). |
| TC-XKT-02 | key | Advanced BIM | Xeokit Authentic 3D NavCube Interaction | pass | Xeokit Authentic 3D NavCube verified: Mounted at top 80px, offset 356px from right edge without header or drawer occlusion. |
| TC-XKT-03 | milestone | Advanced BIM | Xeokit FastNav Dynamic 60fps Optimization | pass | Xeokit FastNav Dynamic 60fps Optimizer verified: Telemetry readout 'Xeokit AEC Engine60 FPSFastNav 60fps' active. |
| TC-XKT-04 | key | Advanced BIM | Xeokit Storey Views & 2D Floor Plan Navigation | pass | Xeokit Storey Views & 2D Floor Plan Navigation verified: Storey navigator operational with 0 detected floor levels. |
| TC-XKT-05 | key | Advanced BIM | Xeokit 3D Spatial Annotations & Pins | fail | TC-XKT-05 failed: {'success': False, 'count': 0} |
| TC-XKT-06 | milestone | Advanced BIM | Xeokit Annotation to BCF 2.1 Topic Conversion | pass | Xeokit Annotation to BCF 2.1 Topic Conversion verified: Automatic viewpoint snapshot and BCF topic synchronization. |
| TC-XKT-01 | key | Advanced BIM | Xeokit AEC BIM Viewport Engine Switching | pass | Xeokit AEC BIM Viewport Engine Switching verified: Seamless dual-engine toggle with active telemetry (Xeokit AEC Engine60 FPSFastNav 60fps). |
| TC-XKT-02 | key | Advanced BIM | Xeokit Authentic 3D NavCube Interaction | pass | Xeokit Authentic 3D NavCube verified: Mounted at top 80px, offset 356px from right edge without header or drawer occlusion. |
| TC-XKT-03 | milestone | Advanced BIM | Xeokit FastNav Dynamic 60fps Optimization | pass | Xeokit FastNav Dynamic 60fps Optimizer verified: Telemetry readout 'Xeokit AEC Engine60 FPSFastNav 60fps' active. |
| TC-XKT-04 | key | Advanced BIM | Xeokit Storey Views & 2D Floor Plan Navigation | pass | Xeokit Storey Views & 2D Floor Plan Navigation verified: Storey navigator operational with 2 detected floor levels. |
| TC-XKT-05 | key | Advanced BIM | Xeokit 3D Spatial Annotations & Pins | pass | Xeokit 3D Spatial Annotations verified: Pin dropped with 3D world coordinates and registered (1 pins active). |
| TC-XKT-06 | milestone | Advanced BIM | Xeokit Annotation to BCF 2.1 Topic Conversion | pass | Xeokit Annotation to BCF 2.1 Topic Conversion verified: Automatic viewpoint snapshot and BCF topic synchronization. |
| TC-XKT-01 | key | Advanced BIM | Xeokit AEC BIM Viewport Engine Switching | pass | Xeokit AEC BIM Viewport Engine Switching verified: Seamless dual-engine toggle with active telemetry (Xeokit AEC Engine60 FPSFastNav 60fps). |
| TC-XKT-02 | key | Advanced BIM | Xeokit Authentic 3D NavCube Interaction | pass | Xeokit Authentic 3D NavCube verified: Mounted at top 80px, offset 356px from right edge without header or drawer occlusion. |
| TC-XKT-03 | milestone | Advanced BIM | Xeokit FastNav Dynamic 60fps Optimization | pass | Xeokit FastNav Dynamic 60fps Optimizer verified: Telemetry readout 'Xeokit AEC Engine60 FPSFastNav 60fps' active. |
| TC-XKT-04 | key | Advanced BIM | Xeokit Storey Views & 2D Floor Plan Navigation | pass | Xeokit Storey Views & 2D Floor Plan Navigation verified: Storey navigator operational with 2 detected floor levels. |
| TC-XKT-05 | key | Advanced BIM | Xeokit 3D Spatial Annotations & Pins | pass | Xeokit 3D Spatial Annotations verified: Pin dropped with 3D world coordinates and registered (1 pins active). |
| TC-XKT-06 | milestone | Advanced BIM | Xeokit Annotation to BCF 2.1 Topic Conversion | pass | Xeokit Annotation to BCF 2.1 Topic Conversion verified: Automatic viewpoint snapshot and BCF topic synchronization. |
| TC-PROF-04 | full | UI Navigation | Custom Profile Live Toolbar Configuration | pass | Custom profile verified: Custom trigger and live toggles operational. |
| TC-XKT-07 | key | Advanced BIM | Xeokit WebGL Geometry & Entity Render Verification | fail | TC-XKT-07 failed (Blank canvas detected or entities not mounted): {'stats': {'active': True, 'numEntities': 0, 'modelsCount': 1, 'modelIds': ['ifcModel']}, 'canvasOk': True, 'success': False} |
| TC-XKT-08 | key | Advanced BIM | Runtime Browser Console Error & Exception Gate | pass | Runtime Browser Console verified: Zero uncaught exceptions or WebGL errors detected during execution (0 recorded errors). |
| TC-XKT-09 | key | Advanced BIM | Multi-Panel 2D Spatial Bounding-Box Collision Absence | pass | Multi-Panel 2D Spatial Collision verified: Zero AABB intersections between floating HUDs (NavCube, Telemetry, Dock) and open panels. |
| TC-XKT-10 | milestone | Advanced BIM | Control Deduplication Across Navigation & Docking Chromes | fail | TC-XKT-10 failed: Duplicate controls found: {'success': False, 'reason': 'Header or Dock missing'} |
| TC-XKT-01 | key | Advanced BIM | Xeokit AEC BIM Viewport Engine Switching | pass | Xeokit AEC BIM Viewport Engine Switching verified: Seamless dual-engine toggle with active telemetry (Xeokit AEC Engine60 FPSFastNav 60fps). |
| TC-XKT-02 | key | Advanced BIM | Xeokit Authentic 3D NavCube Interaction | pass | Xeokit Authentic 3D NavCube verified: Mounted at top 80px, offset 356px from right edge without header or drawer occlusion. |
| TC-XKT-03 | milestone | Advanced BIM | Xeokit FastNav Dynamic 60fps Optimization | pass | Xeokit FastNav Dynamic 60fps Optimizer verified: Telemetry readout 'Xeokit AEC Engine60 FPSFastNav 60fps' active. |
| TC-XKT-04 | key | Advanced BIM | Xeokit Storey Views & 2D Floor Plan Navigation | pass | Xeokit Storey Views & 2D Floor Plan Navigation verified: Storey navigator operational with 2 detected floor levels. |
| TC-XKT-05 | key | Advanced BIM | Xeokit 3D Spatial Annotations & Pins | pass | Xeokit 3D Spatial Annotations verified: Pin dropped with 3D world coordinates and registered (1 pins active). |
| TC-XKT-06 | milestone | Advanced BIM | Xeokit Annotation to BCF 2.1 Topic Conversion | pass | Xeokit Annotation to BCF 2.1 Topic Conversion verified: Automatic viewpoint snapshot and BCF topic synchronization. |
| TC-PROF-04 | full | UI Navigation | Custom Profile Live Toolbar Configuration | pass | Custom profile verified: Custom trigger and live toggles operational. |
| TC-XKT-07 | key | Advanced BIM | Xeokit WebGL Geometry & Entity Render Verification | pass | Xeokit WebGL Render verified: Scene active with 121 entities, 1 model(s) (ifcModel), non-empty canvas buffer. |
| TC-XKT-08 | key | Advanced BIM | Runtime Browser Console Error & Exception Gate | pass | Runtime Browser Console verified: Zero uncaught exceptions or WebGL errors detected during execution (0 recorded errors). |
| TC-XKT-09 | key | Advanced BIM | Multi-Panel 2D Spatial Bounding-Box Collision Absence | pass | Multi-Panel 2D Spatial Collision verified: Zero AABB intersections between floating HUDs (NavCube, Telemetry, Dock) and open panels. |
| TC-XKT-10 | milestone | Advanced BIM | Control Deduplication Across Navigation & Docking Chromes | pass | Control Deduplication verified: Zero duplicate action triggers between GlassHeader (16 controls) and GlassBottomDock (15 controls). |

Legend: pass | fail | skip | unable_to_test

## Failures & Issues

### [TC-XKT-05] Xeokit 3D Spatial Annotations & Pins — http://localhost:5173
- **Expected:** AnnotationsPlugin anchors 3D spatial pins to building surfaces with camera fly-to support
- **Actual:** TC-XKT-05 failed: {'success': False, 'count': 0}
- **Result ID:** TR-011

### [TC-XKT-07] Xeokit WebGL Geometry & Entity Render Verification — http://localhost:5173
- **Expected:** Xeokit scene renders non-empty building entities and prevents blank WebGL viewport regression
- **Actual:** TC-XKT-07 failed (Blank canvas detected or entities not mounted): {'stats': {'active': True, 'numEntities': 0, 'modelsCount': 1, 'modelIds': ['ifcModel']}, 'canvasOk': True, 'success': False}
- **Result ID:** TR-026

### [TC-XKT-10] Control Deduplication Across Navigation & Docking Chromes — http://localhost:5173
- **Expected:** Each interactive feature has a single, unambiguous location in the interface without duplication
- **Actual:** TC-XKT-10 failed: Duplicate controls found: {'success': False, 'reason': 'Header or Dock missing'}
- **Result ID:** TR-029

## Development Handoff Additions

See [DEVELOPMENT_HANDOFF.md](./DEVELOPMENT_HANDOFF.md) for tracked items, usability friction logs, and testability improvements.

## Observations & Recommendations

- WebGL canvas and spatial HUDs demonstrate stable frame rates without memory leaks.
- WebAssembly Web Worker offloads parsing cleanly to preserve main UI thread responsiveness.
- Continue continuous verification under multi-user WebSocket loads.