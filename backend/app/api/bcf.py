import io
import logging
from fastapi import APIRouter, HTTPException, Path, Response
from fastapi.responses import StreamingResponse

from ..models.schemas import (
    BcfTopicCreateRequest,
    BcfTopicResponse,
    BcfClashImportRequest,
    AuditTimelineItem,
    AuditDiffResponse,
)
from ..services.bcf_service import BCFService
from ..services.project_service import ProjectService

logger = logging.getLogger("ifc_editor.api.bcf")

bcf_router = APIRouter(prefix="/projects/{id}", tags=["bcf", "audit"])

@bcf_router.post("/bcf/topics", response_model=BcfTopicResponse)
async def create_bcf_topic(
    id: str = Path(..., description="Project ID"),
    req: BcfTopicCreateRequest = ...
):
    """Create a new BCF issue topic with camera viewpoint."""
    try:
        return await BCFService.create_topic(id, req)
    except Exception as e:
        logger.exception("Failed to create BCF topic: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@bcf_router.get("/bcf/topics", response_model=list[BcfTopicResponse])
async def list_bcf_topics(id: str = Path(..., description="Project ID")):
    """List all BCF topics for the project."""
    try:
        return await BCFService.list_topics(id)
    except Exception as e:
        logger.exception("Failed to list BCF topics: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@bcf_router.post("/bcf/from-clashes")
async def import_clashes(
    id: str = Path(..., description="Project ID"),
    req: BcfClashImportRequest = ...
):
    """Convert detected geometric clashes into persistent BCF topics."""
    try:
        count = await BCFService.import_clashes_as_topics(id, req.clashes)
        return {"success": True, "imported_topics_count": count}
    except Exception as e:
        logger.exception("Failed to import clashes into BCF: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@bcf_router.get("/bcf/export")
async def export_bcf_zip(id: str = Path(..., description="Project ID")):
    """Download project BCF topics as a standard .bcfzip archive."""
    try:
        zip_bytes = await BCFService.export_bcfzip(id)
        proj = await ProjectService.get_project(id)
        proj_name = proj.name.replace(" ", "_") if proj else "project"
        filename = f"{proj_name}_issues.bcfzip"

        return StreamingResponse(
            io.BytesIO(zip_bytes),
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        logger.exception("Failed to export BCF archive: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@bcf_router.get("/audit/timeline", response_model=list[AuditTimelineItem])
async def get_audit_timeline(id: str = Path(..., description="Project ID")):
    """Fetch collaborative temporal audit events."""
    try:
        return await BCFService.get_audit_timeline(id)
    except Exception as e:
        logger.exception("Failed to get audit timeline: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@bcf_router.get("/audit/diff", response_model=AuditDiffResponse)
async def get_audit_diff(id: str = Path(..., description="Project ID")):
    """Fetch visual spatial diff categorizations (added, modified, deleted)."""
    try:
        return await BCFService.get_audit_diff(id)
    except Exception as e:
        logger.exception("Failed to get audit diff: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
