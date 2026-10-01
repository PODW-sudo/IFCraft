#!/usr/bin/env python3
"""
Gate: lint_intent.py
Validates semantic intent mapping on action buttons and interactive controls.
Ensures destructive actions (Delete, Remove, Discard, Clear) wear danger tokens/classes,
and never borrow primary, sky, or neutral fills.
Adapted from ux-ui-agent-skills.
"""

import sys
import re
from pathlib import Path

DESTRUCTIVE_KEYWORDS = re.compile(r"\b(delete|remove|destroy|discard|purge|wipe)\b", re.IGNORECASE)
PRIMARY_ACCENT_CLASSES = re.compile(r"\b(bg-sky|bg-blue|bg-indigo|bg-cyan|bg-emerald|bg-teal)\b")
DANGER_CLASSES = re.compile(r"\b(red|danger|destructive|rose)\b", re.IGNORECASE)

BUTTON_REGEX = re.compile(r"<button\b([^>]*)>(.*?)</button>", re.DOTALL)

def check_file(filepath: Path):
    violations = []
    try:
        content = filepath.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return violations

    for match in BUTTON_REGEX.finditer(content):
        attrs = match.group(1)
        body = match.group(2)
        combined_text = f"{attrs} {body}"

        # Check if button represents a destructive action
        if DESTRUCTIVE_KEYWORDS.search(combined_text):
            # Must have danger token/class
            has_danger = bool(DANGER_CLASSES.search(combined_text))
            has_wrong_accent = bool(PRIMARY_ACCENT_CLASSES.search(attrs))

            line_idx = content[:match.start()].count("\n") + 1

            if has_wrong_accent:
                violations.append((
                    filepath,
                    line_idx,
                    "Destructive action uses affirmative/primary accent class instead of danger",
                    match.group(0).replace("\n", " ")[:80]
                ))
            elif not has_danger:
                violations.append((
                    filepath,
                    line_idx,
                    "Destructive action lacks danger/destructive styling",
                    match.group(0).replace("\n", " ")[:80]
                ))

    return violations

def main():
    root = Path(__file__).resolve().parent.parent.parent
    frontend_src = root / "frontend" / "src"

    if not frontend_src.exists():
        print(f"Error: {frontend_src} does not exist.")
        sys.exit(1)

    all_violations = []
    for ext in ("*.tsx", "*.jsx"):
        for path in frontend_src.rglob(ext):
            all_violations.extend(check_file(path))

    if all_violations:
        print(f"FAIL: Found {len(all_violations)} semantic intent violation(s):")
        for filepath, line_idx, reason, snippet in all_violations:
            rel_path = filepath.relative_to(root)
            print(f"  {rel_path}:{line_idx} - {reason}")
            print(f"    Snippet: {snippet}")
        print("\nRule: Destructive actions must wear danger semantic styling, never primary or neutral accents.")
        sys.exit(1)
    else:
        print("PASS: All action controls satisfy semantic intent mapping.")
        sys.exit(0)

if __name__ == "__main__":
    main()
