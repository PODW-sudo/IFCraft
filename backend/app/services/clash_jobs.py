"""Bounded, in-memory background jobs for the clash check (audit issue 2.1).

The synchronous `POST /api/projects/{id}/clashes/check` still exists and is unchanged; this
module adds the additive job API so a large model can be scanned without holding an HTTP
request (or the browser) hostage:

    POST /api/projects/{id}/clashes/jobs              -> 202 {"job_id", "status": "queued"}
    GET  /api/projects/{id}/clashes/jobs/{job_id}     -> status/progress/result/error

Design notes
------------
* **Bounded.** At most `MAX_JOBS` records exist; finished jobs older than `RESULT_TTL_SECONDS`
  are dropped first, then the oldest *terminal* job is evicted to make room. If every slot is
  occupied by a queued/running job the registry refuses the start (503) instead of growing
  without limit.
* **One job per project.** A second start while one is queued/running raises `ClashJobBusy`
  (409). Two concurrent scans of the same project would each parse the same files for no gain
  and compete for the 2-worker IFC pool.
* **Off the event loop.** The heavy work already runs on the bounded IFC pool inside
  `ClashService.compute_clashes` (`run_ifc`); the job is an `asyncio.Task` that awaits it.
* **Thread-safe progress.** `compute_clashes` reports element progress from an IFC worker
  thread, so every mutation of a job record happens under a plain `threading.Lock` - never
  `asyncio` primitives from a worker thread.
* **Process-local.** Jobs do not survive a restart and are not shared between workers. That is
  acceptable for a single-process desktop editor; a multi-worker deployment would need a shared
  store and is explicitly out of scope here.
"""

from __future__ import annotations

import asyncio
import logging
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Optional

from ..models.schemas import ClashCheckResponse, ClashJobProgress, ClashJobStatusResponse
from .clash_service import ClashService

logger = logging.getLogger("ifc_editor.clash_jobs")

#: Hard cap on retained job records.
MAX_JOBS = 16
#: How long a finished job (and its result) stays addressable.
RESULT_TTL_SECONDS = 3600.0

QUEUED = "queued"
RUNNING = "running"
SUCCEEDED = "succeeded"
FAILED = "failed"

TERMINAL_STATUSES = frozenset({SUCCEEDED, FAILED})


class ClashJobBusy(RuntimeError):
    """A clash job is already queued/running for this project (HTTP 409)."""


class ClashJobCapacity(RuntimeError):
    """Every record slot is held by a live job (HTTP 503)."""


@dataclass
class ClashJob:
    job_id: str
    project_id: str
    status: str = QUEUED
    phase: str = QUEUED
    checked: int = 0
    total: int = 0
    result: Optional[ClashCheckResponse] = None
    error: Optional[str] = None
    created_at: float = field(default_factory=time.monotonic)
    finished_at: Optional[float] = None

    #: Guards every mutable field below; `progress()` is called from an IFC worker thread.
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False, compare=False)
    #: Kept so the task is not garbage-collected mid-flight.
    task: Optional["asyncio.Task[None]"] = field(default=None, repr=False, compare=False)

    # -- transitions --------------------------------------------------------
    def mark_running(self) -> None:
        with self._lock:
            if self.status == QUEUED:
                self.status = RUNNING

    def report_progress(self, phase: str, checked: int, total: int) -> None:
        """Record a progress update.

        Called from the IFC pool thread *and* from the event loop. Counters are cumulative work
        units, so they are clamped to never move backwards even if a callback arrives out of
        order; a phase change starts the label but keeps the counter monotonic.
        """
        with self._lock:
            if self.status in TERMINAL_STATUSES:
                return
            self.phase = phase
            self.checked = max(self.checked, int(checked))
            self.total = max(self.total, int(total))

    def succeed(self, result: ClashCheckResponse) -> None:
        with self._lock:
            self.result = result
            self.error = None
            self.status = SUCCEEDED
            self.phase = "done"
            # The whole job is complete; settle the counters on their final values.
            self.checked = max(self.checked, self.total)
            self.finished_at = time.monotonic()

    def fail(self, message: str) -> None:
        with self._lock:
            self.error = message
            self.status = FAILED
            self.phase = "failed"
            self.finished_at = time.monotonic()

    # -- read ---------------------------------------------------------------
    def is_terminal(self) -> bool:
        with self._lock:
            return self.status in TERMINAL_STATUSES

    def snapshot(self) -> ClashJobStatusResponse:
        with self._lock:
            return ClashJobStatusResponse(
                job_id=self.job_id,
                status=self.status,
                progress=ClashJobProgress(
                    phase=self.phase, checked=self.checked, total=self.total
                ),
                result=self.result,
                error=self.error,
            )


class ClashJobRegistry:
    """Process-local registry. Use the module-level `registry` below."""

    def __init__(
        self,
        max_jobs: int = MAX_JOBS,
        result_ttl_seconds: float = RESULT_TTL_SECONDS,
    ) -> None:
        self._max_jobs = max_jobs
        self._result_ttl = result_ttl_seconds
        self._jobs: dict[str, ClashJob] = {}
        self._lock = threading.RLock()

    # -- housekeeping -------------------------------------------------------
    def _drop_expired_locked(self, now: float) -> None:
        """Forget terminal jobs whose results are older than the retention window."""
        expired = [
            job_id
            for job_id, job in self._jobs.items()
            if job.status in TERMINAL_STATUSES
            and job.finished_at is not None
            and now - job.finished_at > self._result_ttl
        ]
        for job_id in expired:
            self._jobs.pop(job_id, None)

    def _make_room_locked(self) -> None:
        """Evict the oldest terminal job; raise when every slot is held by a live job."""
        while len(self._jobs) >= self._max_jobs:
            terminal = [
                job for job in self._jobs.values() if job.status in TERMINAL_STATUSES
            ]
            if not terminal:
                raise ClashJobCapacity(
                    f"all {self._max_jobs} clash job slots are held by running jobs"
                )
            oldest = min(terminal, key=lambda job: job.finished_at or job.created_at)
            self._jobs.pop(oldest.job_id, None)

    # -- API ----------------------------------------------------------------
    def start(
        self,
        project_id: str,
        tolerance: float,
        model_ids: Optional[list[str]] = None,
    ) -> ClashJob:
        """Create a job and schedule it. Must be called from the running event loop."""
        loop = asyncio.get_running_loop()
        now = time.monotonic()
        with self._lock:
            for existing in self._jobs.values():
                if existing.project_id == project_id and existing.status not in TERMINAL_STATUSES:
                    raise ClashJobBusy(
                        f"a clash job is already {existing.status} for project {project_id}"
                    )
            self._drop_expired_locked(now)
            self._make_room_locked()

            job = ClashJob(job_id=uuid.uuid4().hex, project_id=project_id)
            self._jobs[job.job_id] = job

        job.task = loop.create_task(
            self._run(job, tolerance, model_ids), name=f"clash-job-{job.job_id}"
        )
        return job

    def get(self, project_id: str, job_id: str) -> Optional[ClashJob]:
        """Return the job only when it belongs to `project_id` (otherwise 404)."""
        with self._lock:
            # Enforce the result TTL even when no new job is started.
            self._drop_expired_locked(time.monotonic())
            job = self._jobs.get(job_id)
            if job is None or job.project_id != project_id:
                return None
            return job

    def reset(self) -> None:
        """Test seam: forget every job (does not cancel tasks)."""
        with self._lock:
            self._jobs.clear()

    def __len__(self) -> int:  # pragma: no cover - diagnostics / tests
        with self._lock:
            return len(self._jobs)

    # -- execution ----------------------------------------------------------
    async def _run(
        self,
        job: ClashJob,
        tolerance: float,
        model_ids: Optional[list[str]],
    ) -> None:
        job.mark_running()
        try:
            result = await ClashService.compute_clashes(
                project_id=job.project_id,
                tolerance=tolerance,
                model_ids=model_ids,
                progress=job.report_progress,
            )
        except asyncio.CancelledError:  # pragma: no cover - process shutdown
            job.fail("Clash check was cancelled.")
            raise
        except Exception as e:
            # STEP-20: exception text can quote model paths; keep it in the log and expose the
            # failure class so the UI can say something truthful without leaking paths.
            logger.exception("Background clash job %s failed: %s", job.job_id, e)
            job.fail(
                f"Clash check failed ({type(e).__name__}). "
                "See the server log for details."
            )
        else:
            job.succeed(result)


#: The single registry the API talks to.
registry = ClashJobRegistry()

__all__ = [
    "ClashJob",
    "ClashJobBusy",
    "ClashJobCapacity",
    "ClashJobRegistry",
    "FAILED",
    "MAX_JOBS",
    "QUEUED",
    "RESULT_TTL_SECONDS",
    "RUNNING",
    "SUCCEEDED",
    "TERMINAL_STATUSES",
    "registry",
]
