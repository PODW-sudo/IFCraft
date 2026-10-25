"""Open issue 3.4 (STEP-03 follow-up) - single-writer guard.

STEP-03's `project_write_lock` is an `asyncio.Lock`: it serialises writers inside one
interpreter and is blind to a second uvicorn process. `core/server_lock.py` adds an exclusive
OS file lock (`msvcrt.locking` on Windows, `fcntl.flock` elsewhere) on `storage/.server.lock`
and the FastAPI lifespan refuses to start when another live process owns it.

What this suite pins:

* same-process `acquire()` is idempotent (nested `TestClient` contexts, module re-import) and
  `release()` is reference-counted, so an inner exit cannot drop an outer lifespan's lock;
* a *real second process* is refused - the exclusion is enforced by the OS, not by a flag;
* releasing allows a re-acquire, and a failed acquire leaves no handle behind;
* the lifespan fails startup with `ServerAlreadyRunning` while a foreign process holds the
  lock, and `ENFORCE_SINGLE_WRITER = False` is the documented escape hatch.

The subprocess cases are skipped on a platform that has neither `msvcrt` nor `fcntl` (there
are none in practice, but the guard keeps the suite portable).
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest
from starlette.testclient import TestClient

from backend.app.core import server_lock
from backend.app.core.config import settings
from backend.app.core.server_lock import (
    ServerAlreadyRunning,
    ServerLock,
    acquire_server_lock,
    release_server_lock,
    reset_server_lock_for_tests,
)
from backend.app.main import app

ROOT = Path(__file__).resolve().parents[2]
LOCK_API_AVAILABLE = os.name in ("nt", "posix")

pytestmark = pytest.mark.skipif(
    not LOCK_API_AVAILABLE, reason="needs msvcrt.locking (Windows) or fcntl.flock (POSIX)"
)

#: Child that takes the lock, reports readiness and holds it until stdin closes.
HOLDER_SCRIPT = """
import sys
sys.path.insert(0, sys.argv[1])
from pathlib import Path
from backend.app.core.server_lock import acquire_server_lock, release_server_lock

acquire_server_lock(Path(sys.argv[2]))
print("ACQUIRED", flush=True)
sys.stdin.readline()
release_server_lock()
"""

#: Child that *tries* the lock once and exits 3 when it is already held.
TRY_SCRIPT = """
import sys
sys.path.insert(0, sys.argv[1])
from pathlib import Path
from backend.app.core.server_lock import ServerAlreadyRunning, acquire_server_lock

try:
    acquire_server_lock(Path(sys.argv[2]))
except ServerAlreadyRunning:
    raise SystemExit(3)
raise SystemExit(0)
"""


@pytest.fixture(autouse=True)
def clean_singleton():
    """Every test starts from "no lock in this process" and leaves nothing behind."""
    reset_server_lock_for_tests()
    yield
    while server_lock._server_lock is not None and server_lock._server_lock.held:
        release_server_lock()
    reset_server_lock_for_tests()


def _spawn(script: str, lock_path: Path, *, with_stdin: bool = False) -> subprocess.Popen:
    return subprocess.Popen(
        [sys.executable, "-c", script, str(ROOT), str(lock_path)],
        stdin=subprocess.PIPE if with_stdin else subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )


def _start_holder(lock_path: Path) -> subprocess.Popen:
    """Start the holding child and wait for its READY line (or its death)."""
    process = _spawn(HOLDER_SCRIPT, lock_path, with_stdin=True)
    line = process.stdout.readline()
    if line.strip() != "ACQUIRED":
        stderr = process.stderr.read()
        process.kill()
        process.wait(timeout=10)
        pytest.fail(f"holder child did not acquire the lock: {line!r} / {stderr}")
    return process


def _stop_holder(process: subprocess.Popen) -> None:
    try:
        if process.stdin:
            process.stdin.close()
        process.wait(timeout=15)
    finally:
        if process.poll() is None:  # pragma: no cover - last-resort cleanup
            process.kill()
            process.wait(timeout=15)


# ---------------------------------------------------------------------------
# In-process semantics
# ---------------------------------------------------------------------------

def test_same_process_acquire_is_idempotent(tmp_path):
    lock = ServerLock(tmp_path / ".server.lock")

    lock.acquire()
    lock.acquire()  # no exception, no second OS lock
    assert lock.held
    assert lock.is_open

    lock.release()  # refcount 2 -> 1: still held
    assert lock.held

    lock.release()  # refcount 1 -> 0: released
    assert not lock.held
    assert not lock.is_open


def test_release_allows_reacquire(tmp_path):
    path = tmp_path / ".server.lock"
    lock = ServerLock(path)

    lock.acquire()
    lock.release()
    assert not lock.held

    lock.acquire()
    try:
        assert lock.held
    finally:
        lock.release()

    assert path.exists(), "the marker file stays on disk; only the lock is released"


def test_release_without_acquire_is_a_noop(tmp_path):
    lock = ServerLock(tmp_path / ".server.lock")
    lock.release()  # must not raise
    assert not lock.held


def test_acquire_creates_the_parent_directory(tmp_path):
    path = tmp_path / "nested" / "storage" / ".server.lock"
    lock = ServerLock(path)
    lock.acquire()
    try:
        assert path.exists()
    finally:
        lock.release()


# ---------------------------------------------------------------------------
# Cross-process exclusion
# ---------------------------------------------------------------------------

def test_second_process_is_refused_while_the_lock_is_held(tmp_path):
    lock_path = tmp_path / ".server.lock"
    acquire_server_lock(lock_path)
    try:
        child = _spawn(TRY_SCRIPT, lock_path)
        _, stderr = child.communicate(timeout=60)
    finally:
        release_server_lock()

    assert child.returncode == 3, (
        f"second process was not refused (exit {child.returncode}): {stderr}"
    )


def test_second_process_succeeds_after_release(tmp_path):
    lock_path = tmp_path / ".server.lock"
    acquire_server_lock(lock_path)
    release_server_lock()

    child = _spawn(TRY_SCRIPT, lock_path)
    _, stderr = child.communicate(timeout=60)

    assert child.returncode == 0, f"released lock was still exclusive: {stderr}"


# ---------------------------------------------------------------------------
# Lifespan wiring
# ---------------------------------------------------------------------------

def test_lifespan_refuses_to_start_when_another_process_holds_the_lock(tmp_path, monkeypatch):
    """A second backend must fail startup, loudly, instead of interleaving model writes."""
    lock_path = tmp_path / ".server.lock"
    monkeypatch.setattr(
        server_lock, "_server_lock", ServerLock(lock_path), raising=False
    )

    holder = _start_holder(lock_path)
    try:
        with pytest.raises(ServerAlreadyRunning) as excinfo:
            with TestClient(app):
                pytest.fail("the app started despite a foreign lock holder")
    finally:
        _stop_holder(holder)

    assert str(lock_path) in str(excinfo.value)
    # A failed acquire must not leave this process holding (or looking like it holds) the lock.
    assert not server_lock._server_lock.held


def test_enforce_single_writer_false_is_the_escape_hatch(tmp_path, monkeypatch):
    """The documented opt-out keeps the old behaviour (one process, manually policed)."""
    lock_path = tmp_path / ".server.lock"
    monkeypatch.setattr(
        server_lock, "_server_lock", ServerLock(lock_path), raising=False
    )
    monkeypatch.setattr(settings, "ENFORCE_SINGLE_WRITER", False)

    holder = _start_holder(lock_path)
    try:
        with TestClient(app) as client:
            assert client.get("/health").status_code == 200
    finally:
        _stop_holder(holder)


def test_default_lock_path_sits_next_to_the_projects():
    assert server_lock.default_lock_path() == settings.STORAGE_DIR / ".server.lock"
    assert settings.ENFORCE_SINGLE_WRITER is True
