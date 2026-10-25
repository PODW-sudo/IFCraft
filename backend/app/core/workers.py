"""Bounded thread pool for IfcOpenShell work (STEP-04 / F-004).

`ifcopenshell` is a synchronous C++ library: opening a model parses the whole file,
`model.write` serialises it again, and `geom.create_shape` triangulates. Running any of
that in an `async def` body freezes the event loop, so every other request and every
WebSocket frame stalls for the duration (measured: `/health` took 1.4 s while a
spatial-tree request parsed a 31 MB model, 8.2 s on the 49 MB castle).

The pool is deliberately **bounded at 2**, not `min(32, cpu+4)`: one open model can be
hundreds of megabytes, so 32 concurrent parses would exhaust the host's memory. Two
workers keep a large-model read and one mutation in flight without that risk; queueing
is cheap because every task is short-lived by design.

Use `run_ifc(...)` from a coroutine:

    model = await run_ifc(IFCService.get_spatial_hierarchy, file_path)

Do **not** call `run_ifc` from inside a thread (it needs a running event loop), and do
not spawn nested `run_ifc` calls from an executor worker: with two workers that can
deadlock under load.
"""

from __future__ import annotations

import asyncio
import functools
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, TypeVar

IFC_EXECUTOR_MAX_WORKERS = 2

#: Module-level pool, created once per process. Never shut down by the app lifespan:
#: the TestClient/serve contexts come and go, the process does not.
ifc_executor = ThreadPoolExecutor(
    max_workers=IFC_EXECUTOR_MAX_WORKERS,
    thread_name_prefix="ifc",
)

T = TypeVar("T")


async def run_ifc(
    fn: Callable[..., T], *args: Any, **kwargs: Any
) -> T:
    """Run blocking IFC work on the bounded pool and await its result.

    Equivalent to `await asyncio.to_thread(...)`, except that the executor is explicit
    and bounded, so at most two parses/triangulations are ever in flight.
    """
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        ifc_executor, functools.partial(fn, *args, **kwargs)
    )


def executor_stats() -> dict[str, int]:
    """Snapshot of the IFC pool's capacity and backlog (STEP-04 observability, item 2.5).

    `queued` is the number of submitted callables that no worker has picked up yet, i.e.
    the depth of the executor's work queue. With `max_workers=2`, a value above zero while
    the API feels slow means a clash check and a spatial-tree read are contending for the
    same two slots — the throughput ceiling recorded in the audit (open issue 2.5).

    The queue is private API (`ThreadPoolExecutor._work_queue` is a `queue.SimpleQueue`),
    so every access is guarded and a future rename degrades to `queued: 0` rather than
    breaking `/health`. Cheap and non-blocking: `SimpleQueue.qsize()` is an approximation
    by design and never waits on the queue's internal lock for long.
    """
    max_workers = int(getattr(ifc_executor, "_max_workers", IFC_EXECUTOR_MAX_WORKERS) or 0)

    queued = 0
    work_queue = getattr(ifc_executor, "_work_queue", None)
    qsize = getattr(work_queue, "qsize", None)
    if callable(qsize):
        try:
            queued = max(0, int(qsize()))
        except (AttributeError, NotImplementedError, OSError, ValueError):
            # CPython raises NotImplementedError on some platforms for SimpleQueue.qsize;
            # monitoring must never take the health endpoint down.
            queued = 0

    return {"max_workers": max_workers, "queued": queued}
