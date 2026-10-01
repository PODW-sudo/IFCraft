#!/usr/bin/env python3
"""
Master Quality Gate Runner: run_gates.py
Executes all deterministic quality gates:
1. check_no_emoji.py (Zero emoji doctrine)
2. lint_hardcodes.py (Token usage enforcement)
3. lint_intent.py (Semantic action intent mapping)
4. verify_contrast.py (WCAG 2.2 AA token contrast)
"""

import sys
import subprocess
from pathlib import Path

GATES = [
    ("Zero Emoji Gate", "check_no_emoji.py"),
    ("Hardcode Linter", "lint_hardcodes.py"),
    ("Semantic Intent Linter", "lint_intent.py"),
    ("Token Contrast Verifier", "verify_contrast.py")
]

def main():
    root = Path(__file__).resolve().parent
    print("=" * 65)
    print("       IFC EDITOR — OBJECTIVE QUALITY GATES (UX/UI)")
    print("=" * 65)

    results = []
    has_failure = False

    for name, script_name in GATES:
        script_path = root / script_name
        print(f"\n--- Running: {name} ({script_name}) ---")
        res = subprocess.run([sys.executable, str(script_path)], capture_output=True, text=True)

        if res.stdout:
            print(res.stdout.strip())
        if res.stderr:
            print(res.stderr.strip())

        passed = (res.returncode == 0)
        results.append((name, passed))
        if not passed:
            has_failure = True

    print("\n" + "=" * 65)
    print("                    GATE RUN SUMMARY")
    print("=" * 65)
    for name, passed in results:
        status_str = "[ PASS ]" if passed else "[ FAIL ]"
        print(f"{status_str:<10} | {name}")
    print("=" * 65)

    if has_failure:
        print("\nOVERALL STATUS: FAILED (Review gate violations above and resolve before shipping)")
        sys.exit(1)
    else:
        print("\nOVERALL STATUS: ALL GATES PASSED (Objective quality standards satisfied)")
        sys.exit(0)

if __name__ == "__main__":
    main()
