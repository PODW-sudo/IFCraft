"""STEP-26: repository hygiene gate must pass.

Runs the deterministic hygiene gate as a subprocess so the gate's own exit code is
the assertion (it is the executable specification), and imports qa_runner to cover
the AutoTest- project-name contract that makes F-053 non-recurring.
"""

from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
GATE = ROOT / "scripts" / "gates" / "check_repo_hygiene.py"
QA_RUNNER = ROOT / "scripts" / "qa_runner.py"


def test_repo_hygiene_gate_passes() -> None:
    result = subprocess.run(
        [sys.executable, str(GATE)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        "Repository hygiene gate failed.\n"
        f"--- stdout ---\n{result.stdout}\n--- stderr ---\n{result.stderr}"
    )
    assert "ALL HYGIENE CHECKS PASSED" in result.stdout


def _load_qa_runner():
    spec = importlib.util.spec_from_file_location("qa_runner_step26", QA_RUNNER)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize(
    "name, expected",
    [
        ("AutoTest-20261024T101500-TC-001", True),
        ("AutoTest-anything", True),
        ("AutoTest-", True),
        ("AutoTest", False),
        ("autoTest-x", False),
        ("Phase 6 AI Copilot Project", False),
        ("Debug Test", False),
        ("asd", False),
        ("Phase 1 Test Villa", False),
        ("Historical Castle Benchmark (IFC2X3)", False),
    ],
)
def test_is_autotest_project_name(name: str, expected: bool) -> None:
    qa_runner = _load_qa_runner()
    assert qa_runner.is_autotest_project_name(name) is expected
