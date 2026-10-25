"""One-command local performance budget (open issue 2.4) — no browser, no running server.

    .\\backend\\venv\\Scripts\\python.exe scripts/perf_budget.py
    .\\backend\\venv\\Scripts\\python.exe scripts/perf_budget.py --skip-synthetic
    .\\backend\\venv\\Scripts\\python.exe scripts/perf_budget.py --json > perf.json

It starts the real FastAPI app in-process through Starlette's `TestClient` (ASGI, the real
event loop, the bounded IFC pool and the model cache — only the socket is skipped), uploads the
tracked 47 MB castle plus a generated 50k-product model, and prints the same measurements the
CI job asserts:

    cold GET /spatial-tree (castle, 47 MB)          < 15 s
    warm GET /spatial-tree (model-cache hit)        < 300 ms
    GET /health p95 while the cold tree runs        < 200 ms
    synthetic 50k: GET /spatial-tree                < 15 s
    synthetic 50k: GET /health p95 during it        < 1500 ms (see the comment on the
                                                    envelope in perf_support.py)
    model-cache hits increase on the warm read      yes

Exit code 0 when every budget holds, 1 when any does not (so it can gate a pre-push hook or a
manual smoke run), 2 on an unexpected error. Both test projects are named `AutoTest-*` and are
deleted at the end.

Why not a browser: first pixels, orbit fps and hover-raycast latency are the frontend rows of
the budget. They need a real WebGL context, so they stay in the CDP tier
(`scripts/qa_runner.py ... --browser`) and are recorded as an explicit gap here.
"""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
import time
from pathlib import Path


def _repo_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "backend" / "app" / "main.py").exists():
            return parent
    raise SystemExit("Could not locate the repository root (backend/app/main.py missing)")


ROOT = _repo_root()
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

PERF_DIR = ROOT / "backend" / "tests" / "perf"
if str(PERF_DIR) not in sys.path:
    sys.path.insert(0, str(PERF_DIR))

import perf_support as perf  # noqa: E402


def _log(message: str) -> None:
    """Progress/diagnostics go to stderr so `--json` keeps stdout machine-readable."""
    print(message, file=sys.stderr, flush=True)


def _run(client, *, include_synthetic: bool) -> tuple[list[dict], bool]:
    """Measure every dataset; return the report rows and an overall pass flag."""
    rows: list[dict] = []
    ok = True

    def record(label: str, measured: str, budget: str, passed: bool) -> None:
        nonlocal ok
        ok = ok and passed
        rows.append(
            {"label": label, "measured": measured, "budget": budget, "pass": passed}
        )

    # -- castle ------------------------------------------------------------
    castle = perf.castle_path()
    if not castle.exists():
        _log(f"[perf] SKIP castle: {castle} is missing (it is tracked; git checkout it)")
    else:
        size_mb = castle.stat().st_size / 1e6
        _log(f"[perf] uploading the tracked castle ({size_mb:.0f} MB)...")
        project = perf.upload_model(client, castle, "AutoTest-Perf-Castle-47MB")
        try:
            _log(f"[perf] cold GET /spatial-tree ({project['upload_s']} s upload)...")
            measured = perf.measure_dataset(client, project, force_cold=True)
            cold_s = measured["tree_s"] or 0.0
            record(
                "castle 47 MB: cold GET /spatial-tree",
                f"{cold_s:.2f} s",
                f"< {perf.CASTLE_BUDGET_COLD_TREE_S:.1f} s",
                cold_s < perf.CASTLE_BUDGET_COLD_TREE_S,
            )
            record(
                "castle 47 MB: warm GET /spatial-tree",
                f"{measured['warm_tree_ms']:.0f} ms",
                f"< {perf.CASTLE_BUDGET_WARM_TREE_MS:.0f} ms",
                measured["warm_tree_ms"] < perf.CASTLE_BUDGET_WARM_TREE_MS,
            )
            p95 = measured["health_p95_ms"] or 0.0
            record(
                f"castle 47 MB: /health p95 ({measured['health_samples']} samples)",
                f"{p95:.0f} ms",
                f"< {perf.HEALTH_BUDGET_P95_MS:.0f} ms",
                p95 < perf.HEALTH_BUDGET_P95_MS,
            )
            record(
                "castle 47 MB: model-cache hit on warm read",
                f"+{measured['cache_hits_delta']} hit(s), +{measured['cache_misses_delta']} miss(es)",
                "hit >= 1",
                measured["cache_hits_delta"] >= 1 and measured["cache_misses_delta"] >= 1,
            )
            _log(
                f"[perf] castle: cold={cold_s:.2f} s warm={measured['warm_tree_ms']:.0f} ms "
                f"/health p95={p95:.0f} ms (max {measured['health_max_ms']:.0f}) "
                f"cache={measured['cache_after']['hits']}h/{measured['cache_after']['misses']}m"
            )
        finally:
            perf.delete_project(client, project["id"])

    # -- synthetic 50k -----------------------------------------------------
    if not include_synthetic:
        _log("[perf] SKIP synthetic 50k: --skip-synthetic / IFC_PERF_SKIP_SYNTHETIC is set")
        return rows, ok

    with tempfile.TemporaryDirectory(prefix="ifc-perf-") as tmp:
        target = Path(tmp) / "Synthetic_50k.ifc"
        _log(
            f"[perf] generating {perf.SYNTHETIC_PRODUCT_COUNT:,} IfcBuildingElementProxy "
            "products..."
        )
        generated = perf.build_synthetic_model(target, perf.SYNTHETIC_PRODUCT_COUNT)
        generation_s = generated["total_s"]
        record(
            "synthetic 50k: fixture generation",
            f"{generation_s:.2f} s",
            f"< {perf.SYNTHETIC_BUDGET_GENERATION_S:.0f} s",
            generation_s < perf.SYNTHETIC_BUDGET_GENERATION_S,
        )
        _log(
            f"[perf] generated {generated['entity_count']:,} entities / "
            f"{generated['file_bytes'] / 1e6:.1f} MB in {generation_s:.2f} s; uploading..."
        )
        project = perf.upload_model(
            client, target, f"AutoTest-Perf-Synthetic-{perf.SYNTHETIC_PRODUCT_COUNT // 1000}k"
        )
        try:
            measured = perf.measure_dataset(client, project, force_cold=True)
            cold_s = measured["tree_s"] or 0.0
            record(
                "synthetic 50k: cold GET /spatial-tree",
                f"{cold_s:.2f} s",
                f"< {perf.SYNTHETIC_BUDGET_TREE_S:.1f} s",
                cold_s < perf.SYNTHETIC_BUDGET_TREE_S,
            )
            p95 = measured["health_p95_ms"] or 0.0
            record(
                f"synthetic 50k: /health p95 ({measured['health_samples']} samples)",
                f"{p95:.0f} ms",
                f"< {perf.SYNTHETIC_HEALTH_BUDGET_P95_MS:.0f} ms",
                p95 < perf.SYNTHETIC_HEALTH_BUDGET_P95_MS,
            )
            record(
                "synthetic 50k: warm GET /spatial-tree",
                f"{measured['warm_tree_ms']:.0f} ms",
                "reported",
                True,
            )
            _log(
                f"[perf] synthetic: cold={cold_s:.2f} s warm={measured['warm_tree_ms']:.0f} ms "
                f"/health p95={p95:.0f} ms (max {measured['health_max_ms']:.0f}) "
                f"cache={measured['cache_after']['hits']}h/{measured['cache_after']['misses']}m"
            )
        finally:
            perf.delete_project(client, project["id"])

    return rows, ok


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Measure the ROADMAP performance budget in-process (no browser).",
    )
    parser.add_argument(
        "--skip-synthetic",
        action="store_true",
        help="skip the generated 50k-product model (same as IFC_PERF_SKIP_SYNTHETIC=1)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="print the report as JSON instead of a table",
    )
    args = parser.parse_args(argv)

    if args.skip_synthetic:
        import os

        os.environ[perf.SKIP_SYNTHETIC_ENV] = "1"

    from starlette.testclient import TestClient

    from backend.app.core.config import settings
    from backend.app.core.security import TOKEN_HEADER
    from backend.app.main import app

    started = time.perf_counter()
    # The standalone runner builds the client itself, so it supplies the installation token
    # explicitly (the pytest suite gets it from backend/tests/conftest.py's client patch).
    with TestClient(app, headers={TOKEN_HEADER: settings.API_TOKEN}) as client:
        rows, ok = _run(client, include_synthetic=not args.skip_synthetic)
    elapsed = time.perf_counter() - started

    if args.json:
        print(json.dumps({"ok": ok, "rows": rows, "elapsed_s": round(elapsed, 2)}, indent=2))
    else:
        print("\nIFC Editor performance budget")
        print(f"  {'metric':<44} {'measured':>12}  {'budget':>10}  result")
        print("  " + "-" * 82)
        for row in rows:
            print(
                perf.format_row(
                    row["label"], row["measured"], row["budget"], row["pass"]
                )
            )
        print("  " + "-" * 82)
        print(f"  {'total':<44} {elapsed:>10.1f} s")
        print(
            "\n  Not asserted here (needs a real WebGL context): first pixels, orbit fps,\n"
            "  hover raycast latency. Those rows live in the CDP browser tier:\n"
            "    python scripts/qa_runner.py run --tier key --browser"
        )
        print("\nPERF BUDGET " + ("PASSED" if ok else "FAILED"))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
