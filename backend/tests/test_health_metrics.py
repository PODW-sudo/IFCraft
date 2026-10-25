"""Open issue 2.5 — cache/queue observability on `/health`.

The audit's open item was "2-worker IFC pool is a throughput ceiling ... consider ... an
explicit queue metric" and "add cache/queue metrics to `/health`". This suite pins the
contract so a later refactor cannot quietly drop the fields:

* `GET /health` stays **public** (no API token) and keeps the pre-existing status/shape keys.
* It reports `ifc.max_workers`, `ifc.queued`, the seven `model_cache` counters and
  `locks.registry_size`.
* `executor_stats()` reads the real executor's work queue, including a non-zero backlog.

The "must not parse a model" half of the requirement is enforced by
`backend/tests/perf/test_performance_budget.py::test_castle_health_p95_within_budget_during_cold_tree`
(p95 < 200 ms while a 47 MB parse is in flight), which is the assertion that actually catches
an accidental model open in `/health`.
"""

from __future__ import annotations

import threading
import time

from starlette.testclient import TestClient

from backend.app.main import app

#: `/health` is mounted outside the `/api` token dependency (STEP-05 contract).
NO_TOKEN = {"X-No-API-Token": "1"}

MODEL_CACHE_KEYS = {
    "models",
    "entries",  # alias kept for STEP-04 callers
    "max_models",
    "bytes",
    "max_bytes",
    "hits",
    "misses",
    "evictions",
}


def test_health_payload_reports_pool_cache_and_locks():
    """One request, every documented key, with sane types."""
    with TestClient(app) as client:
        response = client.get("/health", headers=NO_TOKEN, timeout=30)

    assert response.status_code == 200, response.text
    payload = response.json()

    # Pre-existing shape (the harness, CI and any uptime check read these).
    for key in (
        "status",
        "version",
        "ifcopenshell_version",
        "database_ok",
        "project_count",
        "timestamp",
    ):
        assert key in payload, f"/health lost the pre-existing field {key!r}: {sorted(payload)}"
    assert payload["status"] in {"ok", "degraded"}, payload["status"]

    # Open issue 2.5 additions.
    assert "ifc" in payload and "model_cache" in payload and "locks" in payload, sorted(payload)

    assert set(payload["ifc"]) >= {"max_workers", "queued"}, payload["ifc"]
    assert isinstance(payload["ifc"]["max_workers"], int) and payload["ifc"]["max_workers"] >= 1
    assert isinstance(payload["ifc"]["queued"], int) and payload["ifc"]["queued"] >= 0

    assert set(payload["model_cache"]) >= MODEL_CACHE_KEYS, (
        f"model_cache is missing {sorted(MODEL_CACHE_KEYS - set(payload['model_cache']))}"
    )
    for key in ("models", "max_models", "bytes", "max_bytes", "hits", "misses", "evictions"):
        assert isinstance(payload["model_cache"][key], int), (key, payload["model_cache"])

    assert set(payload["locks"]) >= {"registry_size"}, payload["locks"]
    assert isinstance(payload["locks"]["registry_size"], int)
    assert payload["locks"]["registry_size"] >= 0


def test_health_stays_public_without_a_token():
    """The observability fields must not have pulled `/health` behind the token."""
    with TestClient(app) as client:
        response = client.get("/health", headers=NO_TOKEN, timeout=30)
    assert response.status_code == 200, (
        f"/health answered {response.status_code} without a token; it must stay public for "
        "the harness and uptime checks"
    )


def test_executor_stats_matches_the_real_pool():
    """`executor_stats()` must describe the live executor, not a constant."""
    from backend.app.core.workers import IFC_EXECUTOR_MAX_WORKERS, executor_stats, ifc_executor

    stats = executor_stats()
    assert stats == {
        "max_workers": IFC_EXECUTOR_MAX_WORKERS,
        "queued": stats["queued"],
    }, stats
    assert stats["max_workers"] == ifc_executor._max_workers
    assert stats["queued"] >= 0


def test_executor_stats_reports_a_backlog_when_the_pool_is_saturated():
    """With both workers busy, a further submission must show up as `queued`."""
    from backend.app.core.workers import executor_stats, ifc_executor

    release = threading.Event()
    entered: list[str] = []
    entered_lock = threading.Lock()

    def occupy() -> None:
        with entered_lock:
            entered.append(threading.current_thread().name)
        release.wait(timeout=30)

    busy = [ifc_executor.submit(occupy) for _ in range(2)]
    queued = []
    try:
        # The pool has exactly two worker threads: once both have entered `occupy`, no
        # further submission can start. Polling a counter avoids a Barrier generation race.
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline and len(entered) < 2:
            time.sleep(0.01)
        assert len(entered) == 2, (
            f"could not occupy both IFC workers (entered={entered}); the pool reported "
            f"{executor_stats()}"
        )

        queued = [ifc_executor.submit(occupy) for _ in range(2)]

        deadline = time.monotonic() + 5
        while time.monotonic() < deadline and executor_stats()["queued"] < 2:
            time.sleep(0.01)

        stats = executor_stats()
        assert stats["queued"] >= 2, (
            "executor_stats()['queued'] stayed at "
            f"{stats['queued']} with 2 workers busy and 2 callables waiting; /health would "
            "report an idle pool while requests pile up"
        )
    finally:
        release.set()
        for future in busy + queued:
            try:
                future.result(timeout=30)
            except Exception:  # pragma: no cover - teardown only
                pass

    # Back to idle: the backlog drains and the counter returns to zero.
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline and executor_stats()["queued"] != 0:
        time.sleep(0.01)
    assert executor_stats()["queued"] == 0, executor_stats()


def test_model_cache_stats_exposes_the_documented_budget_counters():
    """`stats()` reports occupancy, both budgets, and hit/miss/eviction counters."""
    from backend.app.services.model_cache import model_cache

    stats = model_cache.stats()
    assert set(stats) >= MODEL_CACHE_KEYS, sorted(set(stats))
    assert stats["models"] == stats["entries"]
    assert stats["max_models"] >= 1
    assert stats["max_bytes"] >= 1
    for key in ("models", "bytes", "hits", "misses", "evictions"):
        assert stats[key] >= 0, (key, stats)
