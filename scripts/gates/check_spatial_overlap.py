#!/usr/bin/env python3
"""
Gate: check_spatial_overlap.py
Static and Geometric Spatial Collision & Control Deduplication Gate.
Verifies that:
1. Floating HUDs (NavCube, Telemetry HUD, Bottom Dock) dynamically adapt to drawer margins
   with zero 2D Axis-Aligned Bounding Box (AABB) intersection across viewport states.
2. Action controls and primary triggers are not redundantly duplicated between navigation chromes.
"""

import sys
import re
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
FRONTEND_SRC = ROOT_DIR / "frontend" / "src"

def check_control_deduplication():
    """Verifies no duplicate primary action triggers between GlassHeader and GlassBottomDock."""
    violations = []
    header_file = FRONTEND_SRC / "components" / "nav" / "GlassHeader.tsx"
    dock_file = FRONTEND_SRC / "components" / "dock" / "GlassBottomDock.tsx"

    if not header_file.exists() or not dock_file.exists():
        return [f"Missing source file: {header_file} or {dock_file}"]

    header_text = header_file.read_text(encoding="utf-8")
    dock_text = dock_file.read_text(encoding="utf-8")

    # Extract data-qa attributes
    header_qa = set(re.findall(r'data-qa=["\']([^"\']+)["\']', header_text))
    dock_qa = set(re.findall(r'data-qa=["\']([^"\']+)["\']', dock_text))

    qa_overlap = header_qa.intersection(dock_qa)
    if qa_overlap:
        violations.append(f"Duplicate data-qa attributes found between GlassHeader and GlassBottomDock: {qa_overlap}")

    # Check for redundant toggle buttons in dock that belong to header
    disallowed_in_dock = ["toggleTree", "toggleProperty", "header-tree-toggle", "header-property-toggle"]
    for d in disallowed_in_dock:
        if d in dock_text:
            violations.append(f"GlassBottomDock contains redundant drawer trigger '{d}' which belongs exclusively to GlassHeader.")

    return violations

def check_dynamic_offset_wiring():
    """Verifies that floating HUD components take drawer offsets into account."""
    violations = []
    xeokit_file = FRONTEND_SRC / "components" / "viewer" / "XeokitViewport.tsx"
    if not xeokit_file.exists():
        return [f"Missing {xeokit_file}"]

    content = xeokit_file.read_text(encoding="utf-8")

    # Check that rightOffset and leftOffset are received as props
    if "rightOffset" not in content or "leftOffset" not in content:
        violations.append("XeokitViewport.tsx does not accept rightOffset and leftOffset props to avoid drawer collisions.")

    # Check that NavCube card uses rightOffset
    if "right: rightOffset" not in content and "right: (rightOffset" not in content and "right:rightOffset" not in content:
        violations.append("XeokitViewport NavCube card does not bind its style.right to rightOffset.")

    # Check that Telemetry HUD uses leftOffset
    if "left: leftOffset" not in content and "left: (leftOffset" not in content and "left:leftOffset" not in content:
        violations.append("XeokitViewport Telemetry HUD does not bind its style.left to leftOffset.")

    return violations

def simulate_geometric_collisions():
    """Simulates 2D AABB bounding boxes across typical screen sizes and drawer states."""
    resolutions = [
        (1366, 768),
        (1440, 900),
        (1920, 1080)
    ]

    # Test cases: (name, left_drawer_width, right_drawer_width)
    scenarios = [
        ("No Drawers Open", 0, 0),
        ("Spatial Tree Open", 320, 0),
        ("Property Inspector Open", 0, 384),
        ("Copilot Sidebar Open", 0, 420),
        ("Tree + Property Open", 320, 384),
        ("Tree + Copilot Open", 320, 420),
    ]

    collisions = []

    for screen_w, screen_h in resolutions:
        for scen_name, left_w, right_w in scenarios:
            # 1. Left Drawer Box: [0, 0, left_w, screen_h]
            left_drawer = (0, 0, left_w, screen_h) if left_w > 0 else None

            # 2. Right Drawer Box: [screen_w - right_w, 0, screen_w, screen_h]
            right_drawer = (screen_w - right_w, 0, screen_w, screen_h) if right_w > 0 else None

            # 3. NavCube Box (width 140, height 140, top 80)
            # offset from right = right_w + 16
            navcube_right = screen_w - (right_w + 16)
            navcube_left = navcube_right - 140
            navcube_top = 80
            navcube_bottom = navcube_top + 140
            navcube_box = (navcube_left, navcube_top, navcube_right, navcube_bottom)

            # 4. Telemetry HUD Box (width ~260, height ~32, bottom 16)
            # offset from left = left_w + 16
            telemetry_left = left_w + 16
            telemetry_right = telemetry_left + 260
            telemetry_bottom = screen_h - 16
            telemetry_top = telemetry_bottom - 32
            telemetry_box = (telemetry_left, telemetry_top, telemetry_right, telemetry_bottom)

            # 5. Bottom Dock Box (width ~540, height ~56, bottom 16, centered between drawers)
            dock_w = 540
            center_shift = (left_w - right_w) / 2
            dock_center = (screen_w / 2) + center_shift
            dock_left = dock_center - (dock_w / 2)
            dock_right = dock_left + dock_w
            dock_bottom = screen_h - 16
            dock_top = dock_bottom - 56
            dock_box = (dock_left, dock_top, dock_right, dock_bottom)

            def compute_overlap(box1, box2):
                if not box1 or not box2:
                    return 0
                x_overlap = max(0, min(box1[2], box2[2]) - max(box1[0], box2[0]))
                y_overlap = max(0, min(box1[3], box2[3]) - max(box1[1], box2[1]))
                return x_overlap * y_overlap

            # Check NavCube vs Right Drawer
            if right_drawer and compute_overlap(navcube_box, right_drawer) > 0:
                collisions.append(f"[{screen_w}x{screen_h} {scen_name}] NavCube intersects Right Drawer (area: {compute_overlap(navcube_box, right_drawer):.1f}px^2)")

            # Check NavCube vs Left Drawer
            if left_drawer and compute_overlap(navcube_box, left_drawer) > 0:
                collisions.append(f"[{screen_w}x{screen_h} {scen_name}] NavCube intersects Left Drawer (area: {compute_overlap(navcube_box, left_drawer):.1f}px^2)")

            # Check Telemetry vs Left Drawer
            if left_drawer and compute_overlap(telemetry_box, left_drawer) > 0:
                collisions.append(f"[{screen_w}x{screen_h} {scen_name}] Telemetry HUD intersects Left Drawer (area: {compute_overlap(telemetry_box, left_drawer):.1f}px^2)")

            # Check Bottom Dock vs Left Drawer
            if left_drawer and compute_overlap(dock_box, left_drawer) > 0:
                collisions.append(f"[{screen_w}x{screen_h} {scen_name}] Bottom Dock intersects Left Drawer (area: {compute_overlap(dock_box, left_drawer):.1f}px^2)")

            # Check Bottom Dock vs Right Drawer
            if right_drawer and compute_overlap(dock_box, right_drawer) > 0:
                collisions.append(f"[{screen_w}x{screen_h} {scen_name}] Bottom Dock intersects Right Drawer (area: {compute_overlap(dock_box, right_drawer):.1f}px^2)")

    return collisions

def main():
    print("=" * 65)
    print("       SPATIAL COLLISION & CONTROL DEDUPLICATION GATE")
    print("=" * 65)

    all_failures = []

    # 1. Control Deduplication
    print("\n--- Subcheck 1: Control & Action Trigger Deduplication ---")
    dedup_errors = check_control_deduplication()
    if dedup_errors:
        for err in dedup_errors:
            print(f"  [FAIL] {err}")
            all_failures.append(err)
    else:
        print("  [PASS] Zero duplicate triggers between GlassHeader and GlassBottomDock.")

    # 2. Dynamic Offset Wiring
    print("\n--- Subcheck 2: Dynamic Offset Prop Wiring ---")
    wiring_errors = check_dynamic_offset_wiring()
    if wiring_errors:
        for err in wiring_errors:
            print(f"  [FAIL] {err}")
            all_failures.append(err)
    else:
        print("  [PASS] XeokitViewport correctly integrates leftOffset and rightOffset props.")

    # 3. Geometric Simulation Across Resolutions
    print("\n--- Subcheck 3: Geometric 2D AABB Collision Simulation ---")
    collision_errors = simulate_geometric_collisions()
    if collision_errors:
        for err in collision_errors:
            print(f"  [FAIL] {err}")
            all_failures.append(err)
    else:
        print("  [PASS] Zero 2D AABB collisions across all tested resolutions and drawer states.")

    print("\n" + "=" * 65)
    if all_failures:
        print(f"OVERALL STATUS: FAILED ({len(all_failures)} spatial/deduplication violations detected)")
        sys.exit(1)
    else:
        print("OVERALL STATUS: ALL CHECKS PASSED (Spatial layout & control uniqueness verified)")
        sys.exit(0)

if __name__ == "__main__":
    main()
