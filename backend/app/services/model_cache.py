"""Bounded LRU cache of open IfcOpenShell models (STEP-04 / F-004).

Before this module every read endpoint parsed the whole file per request: a click on an
element re-opened and re-parsed a 49 MB model, and the spatial tree did it again on
every reload. The cache keeps the parsed `ifcopenshell.file` alive between requests and
re-opens it only when the file on disk actually changed.

Correctness rules
-----------------
* The key is `(project_id, st_mtime_ns, st_size)` — not just the project id — so an
  external edit (a user copying a model in, a restored snapshot) is picked up
  automatically. `st_mtime_ns` has nanosecond resolution on NTFS, so a write that keeps
  the size identical still invalidates.
* `invalidate()` is called by `atomic_store.atomic_write_model` / `atomic_copy_file`
  **before and after** every replace: before, so a cached reader's file handle can be
  released (on Windows `os.replace` fails when the target is held open), after, so the
  next read re-opens the new bytes.
* Only read paths use this cache. Writers always `ifcopenshell.open()` a private model;
  a cached object is never mutated, which is what keeps a failed write from leaving a
  dirty model behind in the cache.
* `ifcopenshell.file` is not documented as thread-safe, so callers must also hold the
  per-project lock (`atomic_store.project_write_lock`) around both the cache lookup and
  the use of the returned model. The cache's own lock only protects its dict.
* `max_models=0` disables caching entirely (the documented rollback: keep the thread
  offload, drop the cache).
"""

from __future__ import annotations

import logging
import threading
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Optional

import ifcopenshell

logger = logging.getLogger("ifc_editor.model_cache")

#: LRU bound. Four models is enough for a couple of projects plus a federated comparison
#: without risking the host's RAM.
MAX_CACHED_MODELS = 4

#: Belt-and-braces byte budget for the sum of the cached files.
MAX_CACHED_MODEL_BYTES = 768 * 1024 * 1024

ModelKey = tuple[int, int]


@dataclass
class _Entry:
    model: Any
    key: ModelKey
    file_bytes: int


class ModelCache:
    """A small LRU of open models, keyed by project id and file identity."""

    def __init__(
        self,
        max_models: int = MAX_CACHED_MODELS,
        max_bytes: int = MAX_CACHED_MODEL_BYTES,
    ) -> None:
        self._max_models = max(0, int(max_models))
        self._max_bytes = max(0, int(max_bytes))
        self._entries: "OrderedDict[str, _Entry]" = OrderedDict()
        self._lock = threading.RLock()
        self.hits = 0
        self.misses = 0
        self.evictions = 0

    # -- lookup ---------------------------------------------------------
    @staticmethod
    def _file_key(path: Path) -> ModelKey:
        stat = Path(path).stat()
        return (stat.st_mtime_ns, stat.st_size)

    def get(
        self,
        project_id: str,
        path: Path,
        *,
        loader: Optional[Callable[[str], Any]] = None,
    ) -> Any:
        """Return a cached model for `path`, re-opening it when the file changed.

        Must be called from inside the bounded IFC pool (never on the event loop).
        """
        path = Path(path)
        key = self._file_key(path)
        pid = str(project_id)

        if self._max_models == 0:
            return (loader or ifcopenshell.open)(str(path))

        with self._lock:
            entry = self._entries.get(pid)
            if entry is not None and entry.key == key:
                self._entries.move_to_end(pid)
                self.hits += 1
                return entry.model

        # Open outside the lock: a parse can take seconds and must not serialise other
        # projects' lookups. Two threads opening the same cold project is harmless.
        model = (loader or ifcopenshell.open)(str(path))

        with self._lock:
            self._entries[pid] = _Entry(model=model, key=key, file_bytes=key[1])
            self._entries.move_to_end(pid)
            self.misses += 1
            self._evict()
        return model

    def invalidate(self, project_id: str) -> None:
        """Drop the entry for a project (call before and after every file replace)."""
        pid = str(project_id)
        with self._lock:
            self._entries.pop(pid, None)

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()

    # -- diagnostics ----------------------------------------------------
    def __len__(self) -> int:
        with self._lock:
            return len(self._entries)

    def stats(self) -> dict[str, int]:
        with self._lock:
            return {
                "entries": len(self._entries),
                "max_models": self._max_models,
                "bytes": sum(e.file_bytes for e in self._entries.values()),
                "max_bytes": self._max_bytes,
                "hits": self.hits,
                "misses": self.misses,
                "evictions": self.evictions,
            }

    def _evict(self) -> None:
        """Evict least-recently-used entries until the model and byte budgets hold."""
        while len(self._entries) > 1 and (
            len(self._entries) > self._max_models
            or sum(e.file_bytes for e in self._entries.values()) > self._max_bytes
        ):
            pid, _entry = self._entries.popitem(last=False)
            self.evictions += 1
            logger.debug("Evicted cached model for project %s", pid)


#: Process-wide cache used by the read paths.
model_cache = ModelCache()
