"""Exclusive single-writer process lock (open issue 3.4 / STEP-03 follow-up).

STEP-03 serialises mutations to one project with an `asyncio.Lock` (`services/atomic_store.py`).
That lock lives inside a single interpreter: it cannot see a second uvicorn process. Two
backends on the same `storage/` directory - a leftover `--reload` parent/child pair, a second
worker, or a developer starting `uvicorn` while the harness already runs one - would interleave
whole-model writes and lose edits exactly like the pre-STEP-03 races.

This module takes an **exclusive OS file lock** on `storage/.server.lock` during the FastAPI
lifespan:

* Windows: `msvcrt.locking(fd, LK_NBLCK, 1)` - a non-blocking byte-range lock.
* POSIX:   `fcntl.flock(fd, LOCK_EX | LOCK_NB)`.

The lock is released when the handle is closed, so a crashed process (or a `kill -9`) unblocks
the next start automatically; no stale PID logic is needed. The file itself is an empty marker
and stays on disk.

Scope notes
-----------
* It is a *process* guard in this module (`_server_lock` singleton), so repeated `acquire()`
  from anywhere in one process - nested `TestClient` contexts, a reloader that re-imports the
  module, two routers - is a no-op. `release()` is reference-counted for the same reason: an
  inner lifespan exit must not drop the lock an outer lifespan still owns.
* It is advisory: a process that never calls `acquire()` is not stopped. That is fine here -
  the only writers are this backend's own processes.
* Tests run in-process, so the suite shares the lock with the app under test and never
  conflicts with itself; the subprocess case in `tests/test_single_writer.py` is the one that
  proves the OS-level exclusion.
"""

from __future__ import annotations

import logging
import os
import threading
from pathlib import Path

from .config import settings

logger = logging.getLogger("ifc_editor.server_lock")

LOCK_FILENAME = ".server.lock"


class ServerAlreadyRunning(RuntimeError):
    """Raised when another live process already owns the single-writer lock.

    Carries the lock path so the startup message can name it without guessing.
    """

    def __init__(self, path: Path) -> None:
        self.path = Path(path)
        super().__init__(
            f"Another IFC Editor backend already holds {self.path}. "
            "Only one writer process may serve a storage directory."
        )


class ServerLock:
    """One exclusive OS lock, owned by this process."""

    def __init__(self, path: Path | None = None) -> None:
        self.path = Path(path) if path is not None else default_lock_path()
        self._handle = None  # type: ignore[assignment]
        self._depth = 0
        self._guard = threading.Lock()

    # -- state ------------------------------------------------------------

    @property
    def held(self) -> bool:
        """True while this process owns the lock."""
        with self._guard:
            return self._depth > 0

    @property
    def is_open(self) -> bool:
        with self._guard:
            return self._handle is not None

    # -- lifecycle --------------------------------------------------------

    def acquire(self) -> None:
        """Take the lock, or raise `ServerAlreadyRunning`.

        Idempotent within the process: a second call only increments the reference count.
        """
        with self._guard:
            if self._depth > 0:
                self._depth += 1
                return

            self.path.parent.mkdir(parents=True, exist_ok=True)
            # `a+b` keeps the marker file from being truncated by a concurrent starter and
            # satisfies `msvcrt.locking`, which requires a writable handle.
            handle = open(self.path, "a+b")
            try:
                _lock_handle(handle)
            except OSError as exc:
                handle.close()
                raise ServerAlreadyRunning(self.path) from exc

            self._handle = handle
            self._depth = 1
            logger.info("Single-writer lock acquired: %s", self.path)

    def release(self) -> None:
        """Drop one reference; the OS lock is released when the last one goes."""
        with self._guard:
            if self._depth == 0:
                return
            self._depth -= 1
            if self._depth > 0:
                return

            handle, self._handle = self._handle, None
            if handle is None:  # pragma: no cover - defensive
                return
            try:
                _unlock_handle(handle)
            except OSError:  # pragma: no cover - the close below releases it anyway
                pass
            finally:
                handle.close()
            logger.info("Single-writer lock released: %s", self.path)


def default_lock_path() -> Path:
    """`storage/.server.lock` - next to the projects it protects."""
    return settings.STORAGE_DIR / LOCK_FILENAME


def _lock_handle(handle) -> None:
    """Non-blocking exclusive lock on byte 0 of an open binary file handle."""
    handle.seek(0)
    if os.name == "nt":  # Windows: byte-range lock, non-blocking
        import msvcrt

        msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
    else:
        import fcntl

        fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)


def _unlock_handle(handle) -> None:
    handle.seek(0)
    if os.name == "nt":
        import msvcrt

        msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
    else:
        import fcntl

        fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


# ---------------------------------------------------------------------------
# Process-wide singleton
# ---------------------------------------------------------------------------

_server_lock: ServerLock | None = None
_singleton_guard = threading.Lock()


def get_server_lock(path: Path | None = None) -> ServerLock:
    """The process-wide lock. A second, different path is refused while the first is held."""
    global _server_lock
    with _singleton_guard:
        if _server_lock is None:
            _server_lock = ServerLock(path)
        elif path is not None and Path(path) != _server_lock.path:
            raise ValueError(
                f"single-writer lock already configured at {_server_lock.path}; "
                f"cannot re-point it at {path}"
            )
        return _server_lock


def acquire_server_lock(path: Path | None = None) -> ServerLock:
    """Acquire the process-wide lock; raises `ServerAlreadyRunning` if another process owns it."""
    lock = get_server_lock(path)
    lock.acquire()
    return lock


def release_server_lock() -> None:
    """Release one reference; safe to call when nothing was acquired."""
    lock = _server_lock
    if lock is not None:
        lock.release()


def reset_server_lock_for_tests() -> None:
    """Drop the singleton without touching a held OS lock (tests only).

    Only valid when the lock is not held; used to simulate a fresh process in-process.
    """
    global _server_lock
    with _singleton_guard:
        if _server_lock is not None and _server_lock.held:
            raise RuntimeError("release the lock before resetting the singleton")
        _server_lock = None


__all__ = [
    "LOCK_FILENAME",
    "ServerAlreadyRunning",
    "ServerLock",
    "acquire_server_lock",
    "default_lock_path",
    "get_server_lock",
    "release_server_lock",
    "reset_server_lock_for_tests",
]
