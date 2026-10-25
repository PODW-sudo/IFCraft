"""Fixtures for the CI performance budget (open issue 2.4).

Run the suite explicitly — the `perf` marker is excluded from the default run by
`backend/pytest.ini` (`addopts = -m "not perf"`), so a bare `pytest backend/tests/perf`
selects nothing:

    .\\backend\\venv\\Scripts\\python.exe -m pytest backend/tests/perf -q -m perf

Two datasets, both driven through the real ASGI app:

* `castle_project` — the tracked 47 MB `backend/app/samples/Ifc2x3_SampleCastle.ifc`
  (3,822 products). Tracked in git, so a fresh clone can run this.
* `synthetic_project` — a 50,000-product IFC4 model generated once per session into
  pytest's temp dir, then uploaded through `POST /api/projects/upload`. Set
  `IFC_PERF_SKIP_SYNTHETIC=1` on a constrained runner to skip it with a clear message.

The token header is supplied by `backend/tests/conftest.py`, which pytest loads for every
directory below it (the `TokenTestClient` patch is installed at its import time, which
happens before this file is imported).
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from starlette.testclient import TestClient

PERF_DIR = Path(__file__).resolve().parent

# Make `perf_support` importable both here and from `scripts/perf_budget.py`, which adds this
# directory to `sys.path` itself. No `__init__.py`: the module must stay a plain import.
if str(PERF_DIR) not in sys.path:
    sys.path.insert(0, str(PERF_DIR))

import perf_support as perf  # noqa: E402

ROOT = perf.repo_root()
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


@pytest.fixture(scope="session")
def client():
    """One app instance for the whole budget run (module import cost excluded from timings)."""
    from backend.app.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def castle_project(client):
    """Upload the tracked 47 MB castle and delete it afterwards (`AutoTest-` prefix)."""
    path = perf.castle_path()
    if not path.exists():
        pytest.skip(
            f"performance fixture missing: {path} — the castle is tracked in git, so a "
            "fresh clone should have it; restore it with `git checkout -- "
            "backend/app/samples/Ifc2x3_SampleCastle.ifc`."
        )

    project = perf.upload_model(client, path, "AutoTest-Perf-Castle-47MB")
    try:
        yield project
    finally:
        perf.delete_project(client, project["id"])


@pytest.fixture(scope="session")
def synthetic_model(tmp_path_factory) -> dict:
    """Generate the 50k-product model once per session (≈6-11 s, well under the 30 s cap)."""
    reason = perf.synthetic_skip_reason()
    if reason:
        pytest.skip(reason)

    target = tmp_path_factory.mktemp("perf-synthetic") / "Synthetic_50k.ifc"
    generated = perf.build_synthetic_model(target, perf.SYNTHETIC_PRODUCT_COUNT)
    try:
        yield generated
    finally:
        # tmp_path_factory cleans up eventually; drop the 5-11 MB file now.
        try:
            target.unlink()
        except OSError:  # pragma: no cover - teardown only
            pass


@pytest.fixture(scope="session")
def synthetic_project(client, synthetic_model):
    """Upload the generated 50k model through the real import route."""
    project = perf.upload_model(
        client,
        synthetic_model["path"],
        f"AutoTest-Perf-Synthetic-{perf.SYNTHETIC_PRODUCT_COUNT // 1000}k",
    )
    project["generation"] = synthetic_model
    try:
        yield project
    finally:
        perf.delete_project(client, project["id"])


@pytest.fixture(scope="session")
def castle_measurements(client, castle_project):
    """Cold tree + concurrent `/health` + warm tree, measured once for the whole session."""
    return perf.measure_dataset(client, castle_project, force_cold=True)


@pytest.fixture(scope="session")
def synthetic_measurements(client, synthetic_project):
    """The same measurement on the federated-scale (50k product) model."""
    return perf.measure_dataset(client, synthetic_project, force_cold=True)
