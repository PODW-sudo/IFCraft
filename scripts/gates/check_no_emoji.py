#!/usr/bin/env python3
"""
Gate: check_no_emoji.py
Scans source files for emojis and decorative pictographs.
Adapted from ux-ui-agent-skills quality gates.
"""

import sys
import re
from pathlib import Path

# Regex pattern covering emoji and pictograph ranges
EMOJI_PATTERN = re.compile(
    "["
    "\U0001F600-\U0001F64F"  # Emoticons
    "\U0001F300-\U0001F5FF"  # Misc Symbols and Pictographs
    "\U0001F680-\U0001F6FF"  # Transport & Map
    "\U0001F1E0-\U0001F1FF"  # Flags
    "\U00002702-\U000027B0"  # Dingbats
    "\U00002600-\U000026FF"  # Misc symbols (sun, umbrella, warning triangle, etc)
    "\U0001F900-\U0001F9FF"  # Supplemental Symbols
    "\U0001FA70-\U0001FAFF"  # Extended Pictographs
    "]+",
    flags=re.UNICODE
)

EXTENSIONS = {".tsx", ".ts", ".jsx", ".js", ".css", ".html"}
IGNORE_DIRS = {"node_modules", "dist", ".git", "venv", ".pytest_cache"}

def check_file(filepath: Path):
    violations = []
    try:
        content = filepath.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return violations

    for line_idx, line in enumerate(content.splitlines(), start=1):
        matches = list(EMOJI_PATTERN.finditer(line))
        for match in matches:
            emoji_str = match.group()
            violations.append((filepath, line_idx, emoji_str, line.strip()))
    return violations

def main():
    root = Path(__file__).resolve().parent.parent.parent
    frontend_src = root / "frontend" / "src"

    if not frontend_src.exists():
        print(f"Error: Directory {frontend_src} does not exist.")
        sys.exit(1)

    all_violations = []
    for path in frontend_src.rglob("*"):
        if any(ignored in path.parts for ignored in IGNORE_DIRS):
            continue
        if path.suffix in EXTENSIONS:
            all_violations.extend(check_file(path))

    if all_violations:
        print(f"FAIL: Found {len(all_violations)} emoji/pictograph violation(s):")
        for filepath, line_idx, emoji_str, line in all_violations:
            rel_path = filepath.relative_to(root)
            print(f"  {rel_path}:{line_idx} - Found '{emoji_str}' in line: {line[:80]}")
        print("\nRule: Zero emojis in UI/code. Replace with Lucide icons or technical labels.")
        sys.exit(1)
    else:
        print("PASS: Zero emojis detected across frontend source files.")
        sys.exit(0)

if __name__ == "__main__":
    main()
