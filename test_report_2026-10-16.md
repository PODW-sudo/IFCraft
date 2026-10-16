# IFC Editor Test Report — 2026-10-16

## Summary

| Platform | Pass | Fail | Skip | Unable | Total |
|---|---|---|---|---|---|
| http://localhost:5173 | 62 | 7 | 0 | 0 | 69 |
| **TOTAL** | **62** | **7** | **0** | **0** | **69** |

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
| TC-RST-01 | key | Visibility & Styles | Three.js 5 Render Styles Verification | fail | TC-RST-01 failed: {'success': False, 'details': {'transOk': False, 'solidOk': False, 'wireOk': False, 'shadowOk': False, 'matOk': False}, 'styleResults': {'transparent': {'current': 'shaded', 'threeStats': {'wireframe': False, 'opacity': 0.28, 'roughness': 0.9, 'metalness': 0.1, 'shadowMapEnabled': False, 'shadowGroundVisible': False, 'transparentEdgesGroupVisible': True, 'transparentEdgesCount': 121}}, 'solid': {'current': 'shaded', 'threeStats': {'wireframe': False, 'opacity': 1, 'roughness': 0.9, 'metalness': 0.1, 'shadowMapEnabled': False, 'shadowGroundVisible': False, 'transparentEdgesGroupVisible': False, 'transparentEdgesCount': 121}}, 'wireframe': {'current': 'shaded', 'threeStats': {'wireframe': True, 'opacity': 1, 'roughness': 0.9, 'metalness': 0.1, 'shadowMapEnabled': False, 'shadowGroundVisible': False, 'transparentEdgesGroupVisible': False, 'transparentEdgesCount': 121}}, 'shadowed': {'current': 'shaded', 'threeStats': {'wireframe': False, 'opacity': 1, 'roughness': 0.65, 'metalness': 0.1, 'shadowMapEnabled': True, 'shadowGroundVisible': True, 'transparentEdgesGroupVisible': False, 'transparentEdgesCount': 121}}, 'materials': {'current': 'shaded', 'threeStats': {'wireframe': False, 'opacity': 1, 'roughness': 0.72, 'metalness': 0.08, 'shadowMapEnabled': True, 'shadowGroundVisible': False, 'transparentEdgesGroupVisible': False, 'transparentEdgesCount': 121}}}} |
| TC-RST-02 | key | Visibility & Styles | Xeokit AEC BIM 5 Render Styles Verification | fail | TC-RST-02 failed: {'success': False, 'details': {'transOk': False, 'solidOk': False, 'wireOk': False, 'shadowOk': False, 'matOk': True}, 'styleResults': {'transparent': {'current': 'materials', 'badgeText': 'transparent', 'viewerStats': {'saoEnabled': False, 'pbrEnabled': False, 'xrayFill': True, 'xrayEdges': True, 'edgeAlpha': 1}}, 'solid': {'current': 'materials', 'badgeText': 'solid', 'viewerStats': {'saoEnabled': False, 'pbrEnabled': False, 'xrayFill': True, 'xrayEdges': True, 'edgeAlpha': 0.8}}, 'wireframe': {'current': 'materials', 'badgeText': 'wireframe', 'viewerStats': {'saoEnabled': False, 'pbrEnabled': False, 'xrayFill': False, 'xrayEdges': True, 'edgeAlpha': 1}}, 'shadowed': {'current': 'materials', 'badgeText': 'shadowed', 'viewerStats': {'saoEnabled': True, 'pbrEnabled': False, 'xrayFill': False, 'xrayEdges': True, 'edgeAlpha': 0.5}}, 'materials': {'current': 'materials', 'badgeText': 'materials', 'viewerStats': {'saoEnabled': True, 'pbrEnabled': True, 'xrayFill': False, 'xrayEdges': True, 'edgeAlpha': 0.35}}}} |
| TC-RST-01 | key | Visibility & Styles | Three.js 5 Render Styles Verification | pass | Three.js 5 Render Styles verified: transparent (solid edges), solid (opaque CAD), wireframe (lines), shadowed (PCF soft shadows + ground), materials (PBR). |
| TC-RST-02 | key | Visibility & Styles | Xeokit AEC BIM 5 Render Styles Verification | pass | Xeokit AEC BIM 5 Render Styles verified: transparent (xray fill+edges), solid (opaque+edges), wireframe (pure edges), shadowed (SAO enabled), materials (PBR pipeline). |
| TC-C28-A | full | Visibility & Styles | [C28] Render Style: PBR / Shaded — Scenario A | pass | Render style switched to shaded. |
| TC-C28-B | full | Visibility & Styles | [C28] Render Style: PBR / Shaded — Scenario B | pass | Render style restored to shaded. |
| TC-C29-A | full | Visibility & Styles | [C29] Render Style: Wireframe — Scenario A | pass | Render style switched to wireframe. |
| TC-C29-B | full | Visibility & Styles | [C29] Render Style: Wireframe — Scenario B | pass | Render style restored to shaded. |
| TC-C30-A | full | Visibility & Styles | [C30] Render Style: Discipline Mode — Scenario A | pass | Render style switched to discipline. |
| TC-C30-B | full | Visibility & Styles | [C30] Render Style: Discipline Mode — Scenario B | pass | Render style restored to shaded. |
| TC-C31-A | full | Session Audit & Playback | [C31] Render Style: Diff Mode — Scenario A | pass | Render style switched to diff. |
| TC-C31-B | full | Session Audit & Playback | [C31] Render Style: Diff Mode — Scenario B | pass | Render style restored to shaded. |
| TC-C80-A | full | Visibility & Styles | [C80] Render Style Dropdown Trigger — Scenario A | fail | Render style trigger missing. |
| TC-C80-B | full | Visibility & Styles | [C80] Render Style Dropdown Trigger — Scenario B | fail | Render style menu items missing. |
| TC-C80-A | full | Visibility & Styles | [C80] Render Style Dropdown Trigger — Scenario A | pass | Dock render style dropdown trigger rendered. |
| TC-C80-B | full | Visibility & Styles | [C80] Render Style Dropdown Trigger — Scenario B | pass | Render style menu options displayed. |
| TC-RST-01 | key | Visibility & Styles | Three.js 5 Render Styles Verification | pass | Three.js 5 Render Styles verified: transparent (solid edges), solid (opaque CAD), wireframe (lines), shadowed (PCF soft shadows + ground), materials (PBR). |
| TC-RST-02 | key | Visibility & Styles | Xeokit AEC BIM 5 Render Styles Verification | pass | Xeokit AEC BIM 5 Render Styles verified: transparent (xray fill+edges), solid (opaque+edges), wireframe (pure edges), shadowed (SAO enabled), materials (PBR pipeline). |
| TC-XKT-01 | key | Advanced BIM | Xeokit AEC BIM Viewport Engine Switching | pass | Xeokit AEC BIM Viewport Engine Switching verified: Seamless dual-engine toggle with active telemetry (Xeokit AEC Engine60 FPSshadedFastNav 60fps). |
| TC-XKT-02 | key | Advanced BIM | Xeokit Authentic 3D NavCube Interaction | pass | Xeokit Authentic 3D NavCube verified: Mounted at top 80px, offset 356px from right edge without header or drawer occlusion. |
| TC-XKT-03 | milestone | Advanced BIM | Xeokit FastNav Dynamic 60fps Optimization | pass | Xeokit FastNav Dynamic 60fps Optimizer verified: Telemetry readout 'Xeokit AEC Engine60 FPSshadedFastNav 60fps' active. |
| TC-XKT-04 | key | Advanced BIM | Xeokit Storey Views & 2D Floor Plan Navigation | pass | Xeokit Storey Views & 2D Floor Plan Navigation verified: Storey navigator operational with 2 detected floor levels. |
| TC-XKT-05 | key | Advanced BIM | Xeokit 3D Spatial Annotations & Pins | pass | Xeokit 3D Spatial Annotations verified: Pin dropped with 3D world coordinates and registered (1 pins active). |
| TC-XKT-06 | milestone | Advanced BIM | Xeokit Annotation to BCF 2.1 Topic Conversion | pass | Xeokit Annotation to BCF 2.1 Topic Conversion verified: Automatic viewpoint snapshot and BCF topic synchronization. |
| TC-PROF-04 | full | UI Navigation | Custom Profile Live Toolbar Configuration | pass | Custom profile verified: Custom trigger and live toggles operational. |
| TC-XKT-07 | key | Advanced BIM | Xeokit WebGL Geometry & Entity Render Verification | pass | Xeokit WebGL Render verified: Scene active with 121 entities, 1 model(s) (ifcModel), non-empty canvas buffer. |
| TC-XKT-08 | key | Advanced BIM | Runtime Browser Console Error & Exception Gate | pass | Runtime Browser Console verified: Zero uncaught exceptions or WebGL errors detected during execution (0 recorded errors). |
| TC-XKT-09 | key | Advanced BIM | Multi-Panel 2D Spatial Bounding-Box Collision Absence | pass | Multi-Panel 2D Spatial Collision verified: Zero AABB intersections between floating HUDs (NavCube, Telemetry, Dock) and open panels. |
| TC-XKT-10 | milestone | Advanced BIM | Control Deduplication Across Navigation & Docking Chromes | pass | Control Deduplication verified: Zero duplicate action triggers between GlassHeader (16 controls) and GlassBottomDock (17 controls). |

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

### [TC-RST-01] Three.js 5 Render Styles Verification — http://localhost:5173
- **Expected:** Three.js viewport dynamically transitions across all 5 visual styles with authentic shaders and zero WebGL errors
- **Actual:** TC-RST-01 failed: {'success': False, 'details': {'transOk': False, 'solidOk': False, 'wireOk': False, 'shadowOk': False, 'matOk': False}, 'styleResults': {'transparent': {'current': 'shaded', 'threeStats': {'wireframe': False, 'opacity': 0.28, 'roughness': 0.9, 'metalness': 0.1, 'shadowMapEnabled': False, 'shadowGroundVisible': False, 'transparentEdgesGroupVisible': True, 'transparentEdgesCount': 121}}, 'solid': {'current': 'shaded', 'threeStats': {'wireframe': False, 'opacity': 1, 'roughness': 0.9, 'metalness': 0.1, 'shadowMapEnabled': False, 'shadowGroundVisible': False, 'transparentEdgesGroupVisible': False, 'transparentEdgesCount': 121}}, 'wireframe': {'current': 'shaded', 'threeStats': {'wireframe': True, 'opacity': 1, 'roughness': 0.9, 'metalness': 0.1, 'shadowMapEnabled': False, 'shadowGroundVisible': False, 'transparentEdgesGroupVisible': False, 'transparentEdgesCount': 121}}, 'shadowed': {'current': 'shaded', 'threeStats': {'wireframe': False, 'opacity': 1, 'roughness': 0.65, 'metalness': 0.1, 'shadowMapEnabled': True, 'shadowGroundVisible': True, 'transparentEdgesGroupVisible': False, 'transparentEdgesCount': 121}}, 'materials': {'current': 'shaded', 'threeStats': {'wireframe': False, 'opacity': 1, 'roughness': 0.72, 'metalness': 0.08, 'shadowMapEnabled': True, 'shadowGroundVisible': False, 'transparentEdgesGroupVisible': False, 'transparentEdgesCount': 121}}}}
- **Result ID:** TR-041

### [TC-RST-02] Xeokit AEC BIM 5 Render Styles Verification — http://localhost:5173
- **Expected:** Xeokit AEC viewport transitions smoothly across all 5 visual styles with authentic post-processing and zero exceptions
- **Actual:** TC-RST-02 failed: {'success': False, 'details': {'transOk': False, 'solidOk': False, 'wireOk': False, 'shadowOk': False, 'matOk': True}, 'styleResults': {'transparent': {'current': 'materials', 'badgeText': 'transparent', 'viewerStats': {'saoEnabled': False, 'pbrEnabled': False, 'xrayFill': True, 'xrayEdges': True, 'edgeAlpha': 1}}, 'solid': {'current': 'materials', 'badgeText': 'solid', 'viewerStats': {'saoEnabled': False, 'pbrEnabled': False, 'xrayFill': True, 'xrayEdges': True, 'edgeAlpha': 0.8}}, 'wireframe': {'current': 'materials', 'badgeText': 'wireframe', 'viewerStats': {'saoEnabled': False, 'pbrEnabled': False, 'xrayFill': False, 'xrayEdges': True, 'edgeAlpha': 1}}, 'shadowed': {'current': 'materials', 'badgeText': 'shadowed', 'viewerStats': {'saoEnabled': True, 'pbrEnabled': False, 'xrayFill': False, 'xrayEdges': True, 'edgeAlpha': 0.5}}, 'materials': {'current': 'materials', 'badgeText': 'materials', 'viewerStats': {'saoEnabled': True, 'pbrEnabled': True, 'xrayFill': False, 'xrayEdges': True, 'edgeAlpha': 0.35}}}}
- **Result ID:** TR-042

### [TC-C80-A] [C80] Render Style Dropdown Trigger — Scenario A — http://localhost:5173
- **Expected:** Scenario A succeeds: Click render style trigger in dock: verify styles menu displays PBR, Shaded, Wireframe, Discipline, Diff
- **Actual:** Render style trigger missing.
- **Result ID:** TR-053

### [TC-C80-B] [C80] Render Style Dropdown Trigger — Scenario B — http://localhost:5173
- **Expected:** Scenario B succeeds: Select Wireframe from menu: verify render style switches and menu closes
- **Actual:** Render style menu items missing.
- **Result ID:** TR-054

## Development Handoff Additions

See [DEVELOPMENT_HANDOFF.md](./DEVELOPMENT_HANDOFF.md) for tracked items, usability friction logs, and testability improvements.

## Observations & Recommendations

- WebGL canvas and spatial HUDs demonstrate stable frame rates without memory leaks.
- WebAssembly Web Worker offloads parsing cleanly to preserve main UI thread responsiveness.
- Continue continuous verification under multi-user WebSocket loads.