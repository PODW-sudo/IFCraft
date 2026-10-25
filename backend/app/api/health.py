"""Public health endpoint.

Shape history
-------------
* The original payload answered "is the process up and can it reach SQLite".
* STEP-04 added the bounded IFC pool and the model cache; open issue 2.5 asked for both
  to be observable without a browser or a profiler, so the payload now also carries
  `ifc` (executor capacity/backlog), `model_cache` (LRU occupancy and hit ratio) and
  `locks` (per-project lock registry size).

Constraints kept from STEP-04/STEP-05
-------------------------------------
* **Public.** The route is mounted without the `/api` token dependency; the QA harness,
  uptime checks and CI read it without credentials.
* **O(1) with respect to project size.** No model is opened, parsed or stat'ed here: the
  IFC figures come from `ThreadPoolExecutor` counters, the cache figures from its
  in-memory dict, and the lock figure from a dict length. A large project must not make
  `/health` slow; `backend/tests/perf` asserts p95 < 200 ms while the 47 MB castle is
  being parsed, and a documented envelope at 50k products.
* **Never authoritative for liveness of the DB.** `database_ok` stays a soft signal
  (`degraded`, HTTP 200) so a DB hiccup does not page anyone as an outage.
"""

from datetime import datetime, timezone

import ifcopenshell
from fastapi import APIRouter

from ..core.config import settings
from ..core.database import get_db_connection
from ..core.workers import executor_stats
from ..models.schemas import HealthStatus
from ..services.atomic_store import lock_registry_size
from ..services.model_cache import model_cache

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthStatus)
async def health_check() -> HealthStatus:
    """Return backend operational status, pool/cache telemetry, and DB connection state."""
    db_ok = False
    project_count = 0

    try:
        async with get_db_connection() as db:
            cursor = await db.execute("SELECT COUNT(*) AS count FROM projects")
            row = await cursor.fetchone()
            if row:
                project_count = row["count"]
                db_ok = True
    except Exception:
        db_ok = False

    return HealthStatus(
        status="ok" if db_ok else "degraded",
        version=settings.VERSION,
        ifcopenshell_version=ifcopenshell.__version__,
        database_ok=db_ok,
        project_count=project_count,
        timestamp=datetime.now(timezone.utc).isoformat(),
        ifc=executor_stats(),
        model_cache=model_cache.stats(),
        locks={"registry_size": lock_registry_size()},
    )
