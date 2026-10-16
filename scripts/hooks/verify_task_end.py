#!/usr/bin/env python3
"""
scripts/hooks/verify_task_end.py
Antigravity Task-End Verification Lifecycle Hook (Stop event).

Fires when the agent completes its tool loop (terminationReason == "NO_TOOL_CALL").
Audits the workspace for:
1. TypeScript strict type safety (pnpm exec tsc -b)
2. Objective UX/UI quality gates (run_gates.py: Zero Emoji, DTCG Tokens, Intent, APCA Contrast, Spatial Collision)
3. Agent QA Harness integrity (qa_runner.py check)

If any mistakes are detected, blocks premature termination (decision="continue")
with concrete diagnosis and actionable prevention guidance.
If all gates pass cleanly, allows termination (decision="allow").
"""

import sys
import os
import json
import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
FRONTEND_DIR = ROOT_DIR / "frontend"
PYTHON_EXE = ROOT_DIR / "backend" / "venv" / "Scripts" / "python.exe"
if not PYTHON_EXE.exists():
    PYTHON_EXE = Path(sys.executable)

def find_pnpm_cmd() -> str:
    """Finds pnpm command for Windows or Unix."""
    if os.name == "nt":
        # Check standard global pnpm.cmd locations or PATH
        for candidate in ["pnpm.cmd", "pnpm.exe", "pnpm"]:
            return candidate
    return "pnpm"

def run_typescript_check() -> tuple[bool, str, str]:
    """Runs TypeScript strict compilation in frontend."""
    pnpm = find_pnpm_cmd()
    try:
        proc = subprocess.run(
            [pnpm, "exec", "tsc", "-b"],
            cwd=str(FRONTEND_DIR),
            capture_output=True,
            text=True,
            timeout=35,
            shell=(os.name == "nt")
        )
        if proc.returncode == 0:
            return True, "TypeScript Strict Check: 0 type errors.", ""
        output = (proc.stdout + "\n" + proc.stderr).strip()
        lines = [l for l in output.splitlines() if "error TS" in l]
        summary = "\n".join(lines[:8]) if lines else output[:400]
        prevention = "Always run 'pnpm exec tsc -b' before concluding tasks. Ensure all props, types, and event signatures conform to defined interfaces."
        return False, f"TypeScript compiler detected {len(lines) or 'type'} error(s):\n{summary}", prevention
    except Exception as e:
        return False, f"Failed to execute TypeScript compiler: {e}", "Ensure frontend dependencies are installed via pnpm install."

def run_objective_gates() -> tuple[bool, str, str]:
    """Runs all objective UX/UI quality gates."""
    gates_script = ROOT_DIR / "scripts" / "gates" / "run_gates.py"
    if not gates_script.exists():
        return False, "Quality gates script scripts/gates/run_gates.py not found.", "Restore scripts/gates/run_gates.py."

    try:
        proc = subprocess.run(
            [str(PYTHON_EXE), str(gates_script)],
            cwd=str(ROOT_DIR),
            capture_output=True,
            text=True,
            timeout=30
        )
        if proc.returncode == 0:
            return True, "Objective Quality Gates: All 5 gates PASSED.", ""
        output = (proc.stdout + "\n" + proc.stderr).strip()
        prevention = "Adhere to the Zero Emoji doctrine, Design Token Community Group (DTCG) token usage, APCA contrast, and spatial AABB collision boundaries."
        return False, f"UX/UI Quality Gates failed:\n{output}", prevention
    except Exception as e:
        return False, f"Failed to run objective quality gates: {e}", "Ensure python venv has required packages."

def run_harness_check() -> tuple[bool, str, str]:
    """Runs QA test harness validator."""
    qa_script = ROOT_DIR / "scripts" / "qa_runner.py"
    if not qa_script.exists():
        return False, "QA runner scripts/qa_runner.py not found.", "Restore scripts/qa_runner.py."

    try:
        proc = subprocess.run(
            [str(PYTHON_EXE), str(qa_script), "check"],
            cwd=str(ROOT_DIR),
            capture_output=True,
            text=True,
            timeout=15
        )
        if proc.returncode == 0:
            return True, "Agent QA Harness: Specifications and test cases valid.", ""
        output = (proc.stdout + "\n" + proc.stderr).strip()
        prevention = "Update test_cases.jsonl with proper IDs, steps, preconditions, and tiers whenever adding or modifying features."
        return False, f"Agent QA Harness validation failed:\n{output}", prevention
    except Exception as e:
        return False, f"Failed to validate QA harness: {e}", "Ensure test_cases.jsonl is formatted correctly as JSON Lines."

import threading

def read_stdin_with_timeout(timeout: float = 0.8) -> str:
    """Reads stdin with timeout to prevent blocking when executed without piped input."""
    if sys.stdin.isatty():
        return ""
    buffer = []
    def _reader():
        try:
            buffer.append(sys.stdin.read())
        except Exception:
            pass
    t = threading.Thread(target=_reader, daemon=True)
    t.start()
    t.join(timeout=timeout)
    return buffer[0] if buffer else ""

def main():
    # Read hook context from stdin safely
    context = {}
    try:
        raw_input = read_stdin_with_timeout(0.8).strip()
        if raw_input:
            context = json.loads(raw_input)
    except Exception:
        pass

    term_reason = context.get("terminationReason", "NO_TOOL_CALL")

    # If execution stopped due to user cancellation, token budget, or fatal system error, do not block
    if term_reason not in ("NO_TOOL_CALL", ""):
        print(json.dumps({"decision": "allow"}), flush=True)
        os._exit(0)

    mistakes = []
    preventions = []

    # 1. TypeScript Strict Verification
    ts_ok, ts_msg, ts_prev = run_typescript_check()
    if not ts_ok:
        mistakes.append(ts_msg)
        if ts_prev:
            preventions.append(ts_prev)

    # 2. Objective Quality Gates (Zero Emoji, Hardcodes, Intent, Contrast, Spatial Overlap)
    gates_ok, gates_msg, gates_prev = run_objective_gates()
    if not gates_ok:
        mistakes.append(gates_msg)
        if gates_prev:
            preventions.append(gates_prev)

    # 3. Harness Verification
    harness_ok, harness_msg, harness_prev = run_harness_check()
    if not harness_ok:
        mistakes.append(harness_msg)
        if harness_prev:
            preventions.append(harness_prev)

    # Evaluate decision
    if mistakes:
        issues_formatted = "\n\n".join(f"[{i+1}] {m}" for i, m in enumerate(mistakes))
        prev_formatted = "\n".join(f"- {p}" for p in set(preventions))
        reason = (
            f"Task-End Verification Hook detected {len(mistakes)} mistake(s) before conclusion:\n\n"
            f"{issues_formatted}\n\n"
            f"Actionable Prevention Guidance:\n"
            f"{prev_formatted}\n\n"
            f"Please address and resolve these issues before completing the task."
        )
        response = {
            "decision": "continue",
            "reason": reason
        }
    else:
        response = {
            "decision": "allow"
        }

    print(json.dumps(response), flush=True)
    os._exit(0)

if __name__ == "__main__":
    main()
