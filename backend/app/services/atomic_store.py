"""Atomic, serialised writes for project IFC models (STEP-03 / F-002, F-026).

Two guarantees live here:

1. **Nothing is ever written in place.** `atomic_write_model` serialises the model into a
   temp file in the *same directory*, `fsync`s it and `os.replace`s it over `model.ifc`,
   which is atomic on NTFS and POSIX. A crash or an exception mid-serialisation leaves the
   previous `model.ifc` byte-identical and removes the temp file, so a truncated model can
   never reach the user.

2. **Writes are serialised per project.** `project_write_lock(project_id)` hands out one
   `asyncio.Lock` per project id from a bounded registry, so two concurrent editors of the
   same project cannot each load the whole model, mutate their own snapshot and clobber the
   other's edit (the lost update reproduced in `CADService.update_geometry`). Different
   projects never block each other.

Lock ordering
-------------
There is exactly one tier of locks — the per-project `asyncio.Lock` — and it is always
acquired at the outermost `async def` entry point, before any model is opened, and held
across the `run_ifc(...)` offload. Rules:

* Never acquire a `project_write_lock` while holding another project's lock. Nothing in
  the codebase does: every path touches one project.
* Never `await` the lock from inside a thread-pool worker (`asyncio.Lock` is bound to the
  event loop). Offload *after* acquiring, never before.
* Nested acquisition by the same coroutine chain (e.g. `redo()` → `create_wall()`) is
  detected via a `ContextVar` and becomes a no-op instead of a deadlock. This is
  re-entrancy for the *same task only*; another task always queues.
* `refresh_project_metrics` takes the same lock, so the post-write metrics parse cannot
  race a concurrent writer replacing the file under it.

Cache interaction (STEP-04)
---------------------------
`model_cache.invalidate(project_id)` is called before *and* after the replace. Before,
so a cached reader's handle is dropped (Windows refuses `os.replace` over a file another
handle holds open); after, so the next read re-opens the new bytes.

Residual risks (also recorded in the step notes)
------------------------------------------------
* The lock is in-process. A second uvicorn worker would need a file lock
  (`msvcrt.locking` / `portalocker`) or a single-writer service.
* The DB row and the model file are not transactional together; a crash between
  `os.replace` and the `cad_transactions` insert leaves an undo stack that is one entry
  short. STEP-19's `refresh_project_metrics` reconciles the derived columns only.
"""

from __future__ import annotations

import asyncio
import logging
import os
import tempfile
import time
from collections import OrderedDict
from contextlib import asynccontextmanager
from contextvars import ContextVar
from pathlib import Path
from typing import Any, AsyncIterator, Callable

from .model_cache import model_cache

logger = logging.getLogger("ifc_editor.atomic_store")

#: Bound on the per-project lock registry. 128 live projects' locks is far beyond the
#: single-editor reality; eviction only ever removes an *unheld* lock.
LOCK_REGISTRY_MAX = 128

#: `os.replace` can hit a transient `PermissionError` on Windows (antivirus, a reader that
#: has not released its handle yet). Retry briefly before failing the request.
REPLACE_ATTEMPTS = 3
REPLACE_BACKOFF_S = 0.05

_locks: "OrderedDict[str, asyncio.Lock]" = OrderedDict()

#: Projects whose lock the *current task* already holds. Makes the lock re-entrant for
#: same-task nesting (undo/redo call the create_* primitives) without weakening the
#: cross-task guarantee.
_held: ContextVar[frozenset[str]] = ContextVar(
    "ifc_editor_held_project_locks", default=frozenset()
)


# ---------------------------------------------------------------------------
# Per-project lock registry
# ---------------------------------------------------------------------------
def _lock_in_use(lock: asyncio.Lock) -> bool:
    if lock.locked():
        return True
    # `_waiters` is created lazily by asyncio; a non-empty deque means someone is queued.
    return bool(getattr(lock, "_waiters", None))


def _evict_locks() -> None:
    """Keep the registry bounded without ever dropping a held or awaited lock."""
    while len(_locks) > LOCK_REGISTRY_MAX:
        for key in list(_locks):
            if _lock_in_use(_locks[key]):
                continue
            del _locks[key]
            break
        else:
            # Every lock is live; exceeding the bound is safer than breaking exclusion.
            logger.warning(
                "Project lock registry at %d entries: all locks are in use", len(_locks)
            )
            return


def project_lock(project_id: str) -> asyncio.Lock:
    """Return the (created-on-demand) lock for a project."""
    key = str(project_id)
    lock = _locks.get(key)
    if lock is None:
        lock = asyncio.Lock()
        _locks[key] = lock
        _evict_locks()
        return lock
    _locks.move_to_end(key)
    return lock


def lock_registry_size() -> int:
    """Number of locks currently registered (diagnostics/tests)."""
    return len(_locks)


@asynccontextmanager
async def project_write_lock(project_id: str) -> AsyncIterator[None]:
    """Serialise every model write (and the reads that share the file) for a project."""
    key = str(project_id)
    held = _held.get()
    if key in held:
        # Same-task re-entry (redo → create_wall): the outer scope already excludes others.
        yield
        return

    lock = project_lock(key)
    async with lock:
        token = _held.set(held | {key})
        try:
            yield
        finally:
            _held.reset(token)


@asynccontextmanager
async def project_read_lock(project_id: str) -> AsyncIterator[None]:
    """The same lock, named for read paths.

    `ifcopenshell.file` is not documented as thread-safe, so a read that touches a cached
    model takes the project lock too: one lock covers read and write sections per project.
    """
    async with project_write_lock(project_id):
        yield


# ---------------------------------------------------------------------------
# Atomic replacement
# ---------------------------------------------------------------------------
def _project_id_for(path: Path) -> str:
    """`storage/projects/{project_id}/model.ifc` → the project id."""
    return Path(path).parent.name


def _fsync_file(path: Path) -> None:
    try:
        with open(path, "rb+") as handle:
            handle.flush()
            os.fsync(handle.fileno())
    except OSError as exc:  # pragma: no cover - platform dependent
        logger.warning("Could not fsync %s: %s", path, exc)


def _replace_with_retry(tmp: Path, target: Path) -> None:
    last_error: OSError | None = None
    for attempt in range(1, REPLACE_ATTEMPTS + 1):
        try:
            os.replace(tmp, target)
            return
        except OSError as exc:
            last_error = exc
            logger.warning(
                "os.replace onto %s failed (attempt %d/%d): %s",
                target, attempt, REPLACE_ATTEMPTS, exc,
            )
            if attempt < REPLACE_ATTEMPTS:
                time.sleep(REPLACE_BACKOFF_S * attempt)
    assert last_error is not None
    raise last_error


def _atomic_replace(path: Path, writer: Callable[[Path], None]) -> None:
    """Write via `writer(tmp)` then rename `tmp` over `path`. Original untouched on error."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    fd, tmp_name = tempfile.mkstemp(dir=str(path.parent), prefix=f"{path.name}.", suffix=".tmp")
    os.close(fd)
    tmp = Path(tmp_name)
    try:
        writer(tmp)
        _fsync_file(tmp)
        _replace_with_retry(tmp, path)
    finally:
        if tmp.exists():
            try:
                tmp.unlink()
            except OSError as exc:  # pragma: no cover - defensive
                logger.warning("Could not remove temp file %s: %s", tmp, exc)


def atomic_write_model(model: Any, path: Path) -> None:
    """Serialise `model` to `path` atomically, then drop the cached read model."""
    path = Path(path)
    project_id = _project_id_for(path)

    # Release any cached handle first: on Windows the replace fails while a reader holds
    # the target open, and a cached model is by definition the stale one.
    model_cache.invalidate(project_id)
    _atomic_replace(path, lambda tmp: model.write(str(tmp)))
    model_cache.invalidate(project_id)


def atomic_write_bytes(content: bytes, path: Path) -> None:
    """Write raw bytes to `path` atomically (uploads, sub-models)."""
    path = Path(path)
    project_id = _project_id_for(path)
    model_cache.invalidate(project_id)

    def _write(tmp: Path) -> None:
        with open(tmp, "wb") as handle:
            handle.write(content)
            handle.flush()

    _atomic_replace(path, _write)
    model_cache.invalidate(project_id)


def atomic_copy_file(source: Path, path: Path) -> None:
    """Copy `source` over `path` atomically (undo/redo snapshot restore)."""
    source = Path(source)
    path = Path(path)
    project_id = _project_id_for(path)
    model_cache.invalidate(project_id)

    def _copy(tmp: Path) -> None:
        with open(source, "rb") as src, open(tmp, "wb") as dst:
            while True:
                chunk = src.read(1024 * 1024)
                if not chunk:
                    break
                dst.write(chunk)
            dst.flush()

    _atomic_replace(path, _copy)
    model_cache.invalidate(project_id)
