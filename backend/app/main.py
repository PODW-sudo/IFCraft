import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.database import init_db
from .core.security import require_api_token
from .core.server_lock import (
    ServerAlreadyRunning,
    acquire_server_lock,
    default_lock_path,
    release_server_lock,
)
from .api import api_router
from .api.bootstrap import router as bootstrap_router
from .api.health import router as health_router
from .api.websocket import router as ws_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("ifc_editor")

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup and shutdown lifecycle handler.

    The first thing startup does is claim the single-writer OS lock (open issue 3.4): the
    SQLite database and every `storage/projects/*/model.ifc` are only safe with one writer
    process, and the in-process asyncio lock from STEP-03 cannot see a second uvicorn. A
    second backend fails startup loudly instead of interleaving writes.
    """
    logger.info("Starting IFC Editor API v%s...", settings.VERSION)
    if settings.ENFORCE_SINGLE_WRITER:
        try:
            acquire_server_lock()
        except ServerAlreadyRunning:
            logger.critical(
                "Another IFC Editor backend is already running and holds %s. "
                "Refusing to start a second writer process.",
                default_lock_path(),
            )
            raise
    else:
        logger.warning(
            "ENFORCE_SINGLE_WRITER is disabled - no OS lock on %s; "
            "run exactly one backend process.",
            default_lock_path(),
        )
    try:
        await init_db()
        logger.info("Storage directory: %s", settings.STORAGE_DIR)
        yield
    finally:
        logger.info("Shutting down IFC Editor API...")
        release_server_lock()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="High-performance, real-time collaborative OpenBIM IFC Editor backend powered by FastAPI & IfcOpenShell.",
    lifespan=lifespan
)

# CORS Middleware (STEP-05 / F-003)
#
# `allow_credentials=False` is intentional and load-bearing: the app uses no cookies, and it
# was `allow_credentials=True` combined with a `"*"` origin that let any website read this
# local API. Origins are an explicit allow-list now (see core/config.py).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(health_router)              # /health        - public (harness, CI, uptime)
app.include_router(bootstrap_router, prefix=settings.API_V1_PREFIX)  # /api/bootstrap/token - public, Origin-gated
app.include_router(
    api_router,
    prefix=settings.API_V1_PREFIX,
    dependencies=[Depends(require_api_token)],  # /api/...      - token required
)
app.include_router(ws_router)                  # /ws/rooms/{project_id} - Origin checked in the handler

@app.get("/")
async def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs_url": "/docs",
        "api_v1": settings.API_V1_PREFIX,
        "status": "online"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
