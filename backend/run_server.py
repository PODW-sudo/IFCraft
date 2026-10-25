"""Windows-safe uvicorn launcher for the IFC Editor backend.

Why this exists
---------------
On Windows, asyncio defaults to the Proactor event loop. With uvicorn + WebSockets we observed
`OSError: [WinError 64] The specified network name is no longer available` from the Proactor
accept loop after a WebSocket disconnected (including an idle-socket heartbeat close). The
process stayed alive but stopped accepting TCP connections, so the frontend saw
`502 Bad Gateway` on `/api/bootstrap/token` while the single-writer lock was still held.

The Selector event loop does not use the IOCP accept path and does not exhibit that failure.
This app needs no subprocess support, which is the main Selector limitation on Windows.

Usage (from the backend directory):
    .\\venv\\Scripts\\python.exe run_server.py
    .\\venv\\Scripts\\python.exe run_server.py --port 8000 --reload

The UI pipeline / CI may still use `uvicorn app.main:app`; this launcher is the recommended
local start path on Windows.
"""

from __future__ import annotations

import argparse
import asyncio
import sys


def _configure_event_loop() -> None:
    if sys.platform == "win32":
        # Must be set before uvicorn creates its loop.
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the IFC Editor backend on a stable event loop")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--reload", action="store_true", help="Dev only; restarts on file changes")
    args = parser.parse_args()

    _configure_event_loop()

    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        loop="asyncio",
        workers=1,
        log_level="info",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
