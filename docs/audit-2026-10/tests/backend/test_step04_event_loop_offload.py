"""
STEP-04 — IfcOpenShell work must not run on the event loop.

Finding: F-004
Code under test:
  backend/app/api/projects.py:220-238   (GET /{project_id}/spatial-tree)
  backend/app/api/projects.py:239-258   (GET /{project_id}/elements/{express_id})
  backend/app/api/projects.py:293-336   (POST /{project_id}/elements/{express_id}/properties)
  backend/app/services/cad_service.py   (all mutating methods)
  backend/app/services/project_service.py:84-85 (validate_ifc during upload)

MEASURED (2026-10-24, 49 MB castle):
  GET /spatial-tree                 -> 9,352 ms
  concurrent GET /health latency    -> 45 ms baseline, 8,231 ms peak

HOW TO RUN
    Copy this file into backend/tests/ then:
    .\\backend\\venv\\Scripts\\python.exe -m pytest backend/tests/test_step04_event_loop_offload.py -v
"""

import os
import sys
import threading
import time
from pathlib import Path

import pytest
from starlette.testclient import TestClient


def _repo_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "backend" / "app" / "main.py").exists():
            return parent
    raise RuntimeError("Could not locate repository root")


ROOT = _repo_root()
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.main import app  # noqa: E402

# An 8.5 MB IFC2X3 model. Big enough that a full ifcopenshell parse takes seconds.
# Untracked since STEP-26 (repo hygiene); override with IFC_FIXTURES_DIR if it lives elsewhere.
FIXTURES_DIR = Path(os.environ.get("IFC_FIXTURES_DIR", ROOT / "modelsfortests"))
LARGE_FIXTURE = FIXTURES_DIR / "Ifc2x3_Duplex_Plumbing.ifc"

HEALTH_LATENCY_BUDGET_MS = 200
TREE_REQUEST_TIMEOUT_S = 120


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def large_project(client):
    if not LARGE_FIXTURE.exists():
        pytest.skip(f"fixture missing: {LARGE_FIXTURE}")

    with LARGE_FIXTURE.open("rb") as fh:
        res = client.post(
            "/api/projects/upload",
            files={"file": (LARGE_FIXTURE.name, fh.read(), "application/octet-stream")},
            data={"name": "AutoTest-Step04-LargeModel"},
        )
    assert res.status_code == 201, f"upload failed: {res.status_code} {res.text}"
    project_id = res.json()["id"]
    yield project_id
    client.delete(f"/api/projects/{project_id}")


def _measure_health_latency_during(client, url, samples=10, interval_s=0.25):
    """Fire a slow request in a thread and sample /health latency while it runs."""
    latencies = []
    error = []

    def run_slow_request():
        try:
            client.get(url, timeout=TREE_REQUEST_TIMEOUT_S)
        except Exception as exc:  # pragma: no cover - diagnostics only
            error.append(repr(exc))

    worker = threading.Thread(target=run_slow_request, daemon=True)
    worker.start()
    time.sleep(0.2)  # let the slow request reach the server

    for _ in range(samples):
        start = time.perf_counter()
        resp = client.get("/health")
        latencies.append((time.perf_counter() - start) * 1000.0)
        assert resp.status_code == 200
        time.sleep(interval_s)

    worker.join(timeout=TREE_REQUEST_TIMEOUT_S)
    return latencies, error


def test_health_stays_responsive_during_a_spatial_tree_request(client, large_project):
    """Opening a model must not freeze the whole API.

    While `GET /spatial-tree` parses the model, every other request — including WebSocket
    traffic for other users — must stay responsive.
    """
    url = f"/api/projects/{large_project}/spatial-tree"
    latencies, error = _measure_health_latency_during(client, url)

    assert not error, f"the spatial-tree request errored: {error}"

    worst = max(latencies)
    assert worst < HEALTH_LATENCY_BUDGET_MS, (
        f"/health took up to {worst:.0f} ms while a spatial-tree request was in flight "
        f"(budget {HEALTH_LATENCY_BUDGET_MS} ms). "
        f"All samples: {[round(l) for l in latencies]}. "
        "Blocking ifcopenshell calls must be moved off the event loop with asyncio.to_thread."
    )


def test_health_stays_responsive_during_an_element_details_request(client, large_project):
    """The same applies to element inspection, which the property inspector calls on selection."""
    tree = client.get(f"/api/projects/{large_project}/spatial-tree")
    assert tree.status_code == 200, tree.text

    express_id = None

    def walk(node):
        nonlocal express_id
        if express_id is None and node.get("type") == "IfcWall":
            express_id = node["express_id"]
        for child in node.get("children") or []:
            walk(child)

    walk(tree.json())
    assert express_id is not None, "no wall found in the spatial tree"

    url = f"/api/projects/{large_project}/elements/{express_id}"
    latencies, error = _measure_health_latency_during(client, url, samples=6)

    assert not error, f"the element-details request errored: {error}"
    worst = max(latencies)
    assert worst < HEALTH_LATENCY_BUDGET_MS, (
        f"/health took up to {worst:.0f} ms while an element-details request was in flight "
        f"(budget {HEALTH_LATENCY_BUDGET_MS} ms). Samples: {[round(l) for l in latencies]}"
    )


def test_no_blocking_ifcopenshell_calls_on_the_event_loop():
    """Static guard: the heavy read endpoints must offload to a thread.

    `asyncio.to_thread` is currently used in only 3 of ~35 call sites.
    """
    api_source = (ROOT / "backend" / "app" / "api" / "projects.py").read_text(encoding="utf-8")

    for marker in ("get_spatial_hierarchy", "get_element_details", "update_element_property"):
        idx = api_source.find(marker)
        assert idx != -1, f"expected to find {marker} in projects.py"
        # Look at the 400 characters preceding the call site for a thread offload.
        window = api_source[max(0, idx - 400):idx]
        assert "to_thread" in window or "run_in_executor" in window, (
            f"`{marker}` is called without an asyncio.to_thread / run_in_executor offload. "
            "Blocking ifcopenshell work on the event loop freezes every other request."
        )
