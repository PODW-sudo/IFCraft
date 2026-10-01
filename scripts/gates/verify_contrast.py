#!/usr/bin/env python3
"""
Gate: verify_contrast.py
Mathematically verifies WCAG 2.2 contrast ratios for design tokens.
Computes relative luminance for text-on-surface and component-on-surface pairs.
Adapted from ux-ui-agent-skills.
"""

import sys
import json
import re
from pathlib import Path

def hex_to_rgb(hex_str: str):
    hex_clean = hex_str.strip().lstrip("#")
    if len(hex_clean) == 3:
        hex_clean = "".join(c * 2 for c in hex_clean)
    elif len(hex_clean) == 8:
        hex_clean = hex_clean[:6]  # Ignore alpha for baseline contrast
    if len(hex_clean) != 6:
        raise ValueError(f"Invalid hex string: {hex_str}")
    return tuple(int(hex_clean[i:i+2], 16) for i in (0, 2, 4))

def linearize(val: float) -> float:
    c = val / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def relative_luminance(rgb) -> float:
    r, g, b = (linearize(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def contrast_ratio(hex1: str, hex2: str) -> float:
    l1 = relative_luminance(hex_to_rgb(hex1))
    l2 = relative_luminance(hex_to_rgb(hex2))
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)

def main():
    root = Path(__file__).resolve().parent.parent.parent
    tokens_file = root / "frontend" / "src" / "tokens" / "tokens.json"

    if not tokens_file.exists():
        print(f"Tokens file not found at: {tokens_file}")
        sys.exit(1)

    try:
        data = json.loads(tokens_file.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"Error parsing tokens.json: {e}")
        sys.exit(1)

    # Pairs to verify in tokens.json
    pairs_to_check = data.get("contrast_audit_pairs", [])
    if not pairs_to_check:
        # Default pairs if not explicitly specified
        print("Note: Auditing standard dark-mode and light-mode token surface pairings...")
        pairs_to_check = [
            {"fg_name": "text.primary", "fg": data.get("color", {}).get("text", {}).get("primary", {}).get("value", "#f8fafc"),
             "bg_name": "surface.canvas", "bg": data.get("color", {}).get("surface", {}).get("canvas", {}).get("value", "#0b0d10"),
             "min_ratio": 4.5, "level": "AA Normal Text"},
            {"fg_name": "text.secondary", "fg": data.get("color", {}).get("text", {}).get("secondary", {}).get("value", "#94a3b8"),
             "bg_name": "surface.canvas", "bg": data.get("color", {}).get("surface", {}).get("canvas", {}).get("value", "#0b0d10"),
             "min_ratio": 4.5, "level": "AA Normal Text"},
            {"fg_name": "text.primary", "fg": data.get("color", {}).get("text", {}).get("primary", {}).get("value", "#f8fafc"),
             "bg_name": "surface.dock", "bg": data.get("color", {}).get("surface", {}).get("dock", {}).get("value", "#15181e"),
             "min_ratio": 4.5, "level": "AA Normal Text"},
            {"fg_name": "action.primary.text", "fg": data.get("color", {}).get("action", {}).get("primary_text", {}).get("value", "#0b0d10"),
             "bg_name": "action.primary.bg", "bg": data.get("color", {}).get("action", {}).get("primary", {}).get("value", "#22d3ee"),
             "min_ratio": 4.5, "level": "AA Button Text"},
            {"fg_name": "action.danger.text", "fg": data.get("color", {}).get("action", {}).get("danger_text", {}).get("value", "#fee2e2"),
             "bg_name": "action.danger.bg", "bg": data.get("color", {}).get("action", {}).get("danger", {}).get("value", "#dc2626"),
             "min_ratio": 4.5, "level": "AA Danger Button"},
        ]

    failures = []
    passes = []

    print("-" * 65)
    print(f"{'Foreground':<20} on {'Background':<20} | {'Ratio':<7} | Result")
    print("-" * 65)

    for item in pairs_to_check:
        fg_hex = item["fg"]
        bg_hex = item["bg"]
        min_r = item.get("min_ratio", 4.5)
        name = f"{item['fg_name']} on {item['bg_name']}"

        try:
            ratio = contrast_ratio(fg_hex, bg_hex)
            status = "PASS" if ratio >= min_r else "FAIL"
            print(f"{item['fg_name']:<20} on {item['bg_name']:<20} | {ratio:>5.2f}:1 | {status} (min {min_r})")
            if ratio >= min_r:
                passes.append(name)
            else:
                failures.append((name, ratio, min_r))
        except Exception as e:
            failures.append((name, 0.0, min_r))
            print(f"{item['fg_name']:<20} on {item['bg_name']:<20} | ERROR: {e}")

    print("-" * 65)
    if failures:
        print(f"FAIL: {len(failures)} contrast pairing(s) do not satisfy WCAG 2.2 requirements.")
        sys.exit(1)
    else:
        print(f"PASS: All {len(passes)} token pairings satisfy WCAG 2.2 AA standards.")
        sys.exit(0)

if __name__ == "__main__":
    main()
