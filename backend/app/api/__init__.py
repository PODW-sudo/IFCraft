from fastapi import APIRouter
from .health import router as health_router
from .projects import router as projects_router
from .copilot import router as copilot_router
from .federation import router as federation_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(projects_router)
api_router.include_router(copilot_router)
api_router.include_router(federation_router)

__all__ = ["api_router"]

