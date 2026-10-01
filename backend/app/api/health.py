from datetime import datetime, timezone
from fastapi import APIRouter
import ifcopenshell

from ..core.config import settings
from ..core.database import get_db_connection
from ..models.schemas import HealthStatus

router = APIRouter(tags=["Health"])

@router.get("/health", response_model=HealthStatus)
async def health_check() -> HealthStatus:
    """Return backend operational status, IfcOpenShell info, and DB connection state."""
    db_ok = False
    project_count = 0
    
    try:
        async with get_db_connection() as db:
            cursor = await db.execute("SELECT COUNT(*) AS count FROM projects")
            row = await cursor.fetchone()
            if row:
                project_count = row["count"]
                db_ok = True
    except Exception:
        db_ok = False
        
    return HealthStatus(
        status="ok" if db_ok else "degraded",
        version=settings.VERSION,
        ifcopenshell_version=ifcopenshell.__version__,
        database_ok=db_ok,
        project_count=project_count,
        timestamp=datetime.now(timezone.utc).isoformat()
    )
