"""Audit 2.1 - clash checks must not block: bounded background jobs with progress.

Contract under test
-------------------
    POST /api/projects/{id}/clashes/jobs            -> 202 {"job_id", "status": "queued"}
    GET  /api/projects/{id}/clashes/jobs/{job_id}   -> status/progress/result/error

The synchronous `POST /clashes/check` route is deliberately **not** changed; the existing
suites (`test_cad_and_clash.py`, `test_step06_clash_correctness.py`) keep exercising it.

Measured on the Duplex fixture (57 walls / 141 target elements): the job reaches `succeeded`
in about the same time as the synchronous check (~1.5 s) but the HTTP request returns in
milliseconds, and `progress` advances from `extracting` to `comparing`.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

import pytest
from starlette.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.main import app  # noqa: E402
from backend.app.services import clash_jobs  # noqa: E402
from backend.app.services.clash_service import ClashService  # noqa: E402

#: Poll fast enough to observe both progress phases on a ~1.5 s scan.
POLL_INTERVAL_S = 0.02
POLL_TIMEOUT_S = 180.0


def _poll(client: TestClient, project_id: str, job_id: str) -> tuple[dict, list[dict], float]:
    """Poll until the job is terminal; return (final_payload, all_payloads, seconds)."""
    started = time.perf_counter()
    snapshots: list[dict] = []
    while True:
        res = client.get(f"/api/projects/{project_id}/clashes/jobs/{job_id}")
        assert res.status_code == 200, res.text
        payload = res.json()
        snapshots.append(payload)
        if payload["status"] in ("succeeded", "failed"):
            return payload, snapshots, time.perf_counter() - started
        if time.perf_counter() - started > POLL_TIMEOUT_S:
            raise AssertionError(f"clash job {job_id} did not finish: {payload}")
        time.sleep(POLL_INTERVAL_S)


@pytest.fixture(scope="module")
def api():
    """Two real projects (so cross-project 404 is testable) on one TestClient context."""
    clash_jobs.registry.reset()
    with TestClient(app) as client:
        project_ids: list[str] = []
        for sample in ("ifc2x3_duplex_architecture", "office_pavilion"):
            res = client.post(f"/api/projects/samples/{sample}/load")
            assert res.status_code == 201, res.text
            project_ids.append(res.json()["id"])
        try:
            yield client, project_ids
        finally:
            for project_id in project_ids:
                client.delete(f"/api/projects/{project_id}")
            clash_jobs.registry.reset()


@pytest.fixture(autouse=True)
def _clean_registry():
    clash_jobs.registry.reset()
    yield
    clash_jobs.registry.reset()


@pytest.fixture
def duplex_project(api):
    client, project_ids = api
    return client, project_ids[0]


@pytest.fixture
def slow_extractor(monkeypatch):
    """Delay box extraction so a second start overlaps a live job deterministically."""
    original = ClashService._extract_element_boxes_with_stats

    def slow(_cls, *args, **kwargs):
        time.sleep(0.4)
        return original(*args, **kwargs)

    monkeypatch.setattr(
        ClashService, "_extract_element_boxes_with_stats", classmethod(slow)
    )
    return original


def test_job_reaches_succeeded_with_progress(duplex_project):
    """Start -> poll to `succeeded`, with the same response shape as the synchronous route."""
    client, project_id = duplex_project

    started = time.perf_counter()
    res = client.post(
        f"/api/projects/{project_id}/clashes/jobs", json={"tolerance": 0.05}
    )
    handshake = time.perf_counter() - started
    assert res.status_code == 202, res.text
    body = res.json()
    assert body["status"] in ("queued", "running"), body
    job_id = body["job_id"]
    assert job_id

    # The whole point of 2.1: the request must not wait for the scan.
    assert handshake < 5.0, f"job start took {handshake:.2f}s"

    final, snapshots, elapsed = _poll(client, project_id, job_id)
    assert final["status"] == "succeeded", final
    assert final["error"] is None

    result = final["result"]
    assert result is not None
    # Same contract as the synchronous endpoint, including the STEP-06 completeness fields.
    for field in (
        "total_clashes",
        "hard_clashes",
        "clearance_clashes",
        "tolerance",
        "clashes",
        "duration_ms",
        "elements_checked",
        "geometry_failures",
        "sampled",
    ):
        assert field in result, f"job result missing {field}: {sorted(result)}"
    assert result["elements_checked"] > 0
    assert result["sampled"] is False
    assert isinstance(result["clashes"], list)

    progress = final["progress"]
    assert progress["checked"] == progress["total"]
    assert progress["checked"] > 0
    assert progress["phase"] == "done"

    # Progress must only move forwards, in both counters.
    checked_series = [s["progress"]["checked"] for s in snapshots]
    total_series = [s["progress"]["total"] for s in snapshots]
    assert checked_series == sorted(checked_series), checked_series
    assert total_series == sorted(total_series), total_series

    phases = {s["progress"]["phase"] for s in snapshots}
    assert "extracting" in phases, phases
    # `comparing` is only observable if a poll lands during the pair loop; the final snapshot
    # always reports the terminal phase, so accept either it or a fast scan.
    assert phases & {"comparing", "done"}, phases

    # Reported for the deliverable: job completion time on the Duplex fixture.
    print(
        f"\n[2.1] Duplex clash job: start={handshake * 1000:.1f} ms "
        f"completion={elapsed:.2f} s ({len(snapshots)} polls)"
    )


def test_unknown_job_id_is_404(duplex_project):
    client, project_id = duplex_project
    res = client.get(f"/api/projects/{project_id}/clashes/jobs/does-not-exist")
    assert res.status_code == 404, res.text


def test_job_from_another_project_is_404(api, slow_extractor):
    client, project_ids = api
    first_project, second_project = project_ids

    res = client.post(
        f"/api/projects/{first_project}/clashes/jobs", json={"tolerance": 0.05}
    )
    assert res.status_code == 202, res.text
    job_id = res.json()["job_id"]

    # A job id is only addressable under its own project.
    other = client.get(f"/api/projects/{second_project}/clashes/jobs/{job_id}")
    assert other.status_code == 404, other.text

    final, _snapshots, _elapsed = _poll(client, first_project, job_id)
    assert final["status"] == "succeeded", final


def test_concurrent_start_for_same_project_is_409(duplex_project, slow_extractor):
    client, project_id = duplex_project
    url = f"/api/projects/{project_id}/clashes/jobs"

    first = client.post(url, json={"tolerance": 0.05})
    assert first.status_code == 202, first.text
    job_id = first.json()["job_id"]

    second = client.post(url, json={"tolerance": 0.05})
    assert second.status_code == 409, second.text
    assert "already running" in second.json()["detail"].lower()

    final, _snapshots, _elapsed = _poll(client, project_id, job_id)
    assert final["status"] == "succeeded", final

    # Once the first job is terminal a new one is allowed again.
    third = client.post(url, json={"tolerance": 0.05})
    assert third.status_code == 202, third.text
    final_third, _snapshots, _elapsed = _poll(client, project_id, third.json()["job_id"])
    assert final_third["status"] == "succeeded", final_third


def test_failed_job_reports_an_error(duplex_project, monkeypatch):
    client, project_id = duplex_project

    def boom(*_args, **_kwargs):
        raise RuntimeError("synthetic extraction failure")

    monkeypatch.setattr(
        ClashService, "_extract_element_boxes_with_stats", classmethod(boom)
    )

    res = client.post(
        f"/api/projects/{project_id}/clashes/jobs", json={"tolerance": 0.05}
    )
    assert res.status_code == 202, res.text
    final, _snapshots, _elapsed = _poll(client, project_id, res.json()["job_id"])

    assert final["status"] == "failed", final
    assert final["result"] is None
    assert final["error"], "a failed job must carry a message for the UI"
    assert "RuntimeError" in final["error"], final["error"]
    # STEP-20: no model paths leak through the job error.
    assert str(ROOT) not in final["error"]


def test_registry_is_bounded_and_evicts_terminal_jobs(duplex_project, monkeypatch):
    """16 records max: finished jobs are evicted oldest-first, live jobs are never dropped."""
    client, project_id = duplex_project

    # Keep the scans tiny: one box, no pairs. This test is about the registry, not the IFC work.
    from backend.app.services.clash_service import ElementBox

    def small(*_args, **_kwargs):
        return (
            [
                ElementBox(
                    express_id=1,
                    name="Wall",
                    type_name="IfcWall",
                    model_id="main",
                    model_name="Test",
                    discipline="ARCH",
                    min_pt=(0.0, 0.0, 0.0),
                    max_pt=(1.0, 1.0, 1.0),
                )
            ],
            1,
            0,
        )

    monkeypatch.setattr(
        ClashService, "_extract_element_boxes_with_stats", classmethod(small)
    )

    url = f"/api/projects/{project_id}/clashes/jobs"
    job_ids: list[str] = []
    for _ in range(clash_jobs.MAX_JOBS + 4):
        res = client.post(url, json={"tolerance": 0.05})
        assert res.status_code == 202, res.text
        job_id = res.json()["job_id"]
        job_ids.append(job_id)
        final, _snapshots, _elapsed = _poll(client, project_id, job_id)
        assert final["status"] == "succeeded", final

    assert len(clash_jobs.registry) == clash_jobs.MAX_JOBS
    # The four oldest results were evicted...
    for expired in job_ids[:4]:
        res = client.get(f"{url}/{expired}")
        assert res.status_code == 404, f"oldest job {expired} was not evicted"
    # ...and the newest one is still addressable.
    res = client.get(f"{url}/{job_ids[-1]}")
    assert res.status_code == 200, res.text
