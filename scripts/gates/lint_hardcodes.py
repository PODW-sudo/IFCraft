#!/usr/bin/env python3
"""
Gate: lint_hardcodes.py
Detects raw hardcoded color literals (#hex, rgb(), hsl()) in frontend components.
Enforces the use of DTCG design tokens and Tailwind semantic variables.
Adapted from ux-ui-agent-skills.
"""

import sys
import re
from pathlib import Path

# Match hex colors #fff, #ffffff, #ffffff88
HEX_COLOR_PATTERN = re.compile(r"(?<!&)#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b")
# Match rgb/rgba colors
RGB_COLOR_PATTERN = re.compile(r"\brgba?\s*\([^)]+\)")
# Match hsl/hsla colors
HSL_COLOR_PATTERN = re.compile(r"\bhsla?\s*\([^)]+\)")

IGNORE_FILES = {
    "tokens.json",
    "tokens.css",
    "index.css",
    "collaboration.ts",
    "vite-env.d.ts",
    "settings.ts"
}

IGNORE_DIRS = {
    "node_modules",
    "dist",
    ".git",
    "venv",
    ".pytest_cache"
}

VALID_EXTENSIONS = {".tsx", ".ts", ".jsx", ".js", ".html", ".css"}

# Known token files or definition points
TOKEN_PATHS = {"tokens"}

def check_file(filepath: Path):
    violations = []
    if filepath.name in IGNORE_FILES or filepath.suffix.lower() not in VALID_EXTENSIONS:
        return violations
    if any(part in TOKEN_PATHS for part in filepath.parts):
        return violations

    try:
        content = filepath.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return violations

    for line_idx, line in enumerate(content.splitlines(), start=1):
        # Ignore comments
        stripped = line.strip()
        if stripped.startswith("//") or stripped.startswith("/*") or stripped.startswith("*"):
            continue

        for m in HEX_COLOR_PATTERN.finditer(line):
            val = m.group()
            # Ignore URL fragment identifiers like href="#id" or expressIDs like #1234
            # If preceding character is quote and following is quote or paren
            if not line[m.start():].startswith("#i-") and not re.match(r"^#\d+\b", val):
                violations.append((filepath, line_idx, val, line.strip()))

        for m in RGB_COLOR_PATTERN.finditer(line):
            val = m.group()
            violations.append((filepath, line_idx, val, line.strip()))

        for m in HSL_COLOR_PATTERN.finditer(line):
            val = m.group()
            violations.append((filepath, line_idx, val, line.strip()))

    return violations

def main():
    root = Path(__file__).resolve().parent.parent.parent
    frontend_src = root / "frontend" / "src"

    if not frontend_src.exists():
        print(f"Error: {frontend_src} does not exist.")
        sys.exit(1)

    all_violations = []
    for ext in ("*.tsx", "*.ts", "*.jsx", "*.js", "*.css"):
        for path in frontend_src.rglob(ext):
            if any(ignored in path.parts for ignored in IGNORE_DIRS):
                continue
            all_violations.extend(check_file(path))

    if all_violations:
        print(f"FAIL: Found {len(all_violations)} hardcoded color literal(s):")
        # Show sample of first 15 violations
        for filepath, line_idx, val, line in all_violations[:15]:
            rel_path = filepath.relative_to(root)
            print(f"  {rel_path}:{line_idx} - Literal: '{val}' in: {line[:80]}")
        if len(all_violations) > 15:
            print(f"  ... and {len(all_violations) - 15} more.")
        print("\nRule: Colors must use tokens (e.g., var(--color-surface-base), text-slate-200) instead of raw literals.")
        sys.exit(1)
    else:
        print("PASS: Zero unauthorized hardcoded color literals found.")
        sys.exit(0)

if __name__ == "__main__":
    main()
