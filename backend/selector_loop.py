"""A uvicorn loop factory that always returns the Selector event loop on Windows.

uvicorn >= 0.36 ignores the asyncio event-loop policy: `uvicorn.loops.asyncio.asyncio_loop_factory`
returns `ProactorEventLoop` whenever it is not running in subprocess mode. The Proactor accept
path can fail with `WinError 64` after a WebSocket disconnects and then silently stops accepting
connections (the process stays alive and keeps the writer lock). Passing this factory as
`loop="selector_loop:selector_loop_factory"` avoids that path.

The app does not need subprocess support, which is the main Selector-loop limitation on Windows.
"""

from __future__ import annotations

import asyncio


def selector_loop_factory(use_subprocess: bool = False) -> asyncio.AbstractEventLoop:
    # `use_subprocess` is accepted for uvicorn's factory signature; Selector is fine for a
    # single-process server, which is the only mode this app supports.
    # uvicorn passes this to `asyncio.Runner(loop_factory=...)`, which expects an *instance*.
    print("[ifc] event loop factory: SelectorEventLoop", flush=True)
    return asyncio.SelectorEventLoop()
