import uuid
import logging
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse

from ..core.config import settings
from ..core.database import get_db_connection
from ..models.schemas import (
    SubModelResponse,
    ClashCheckRequest,
    ClashCheckResponse
)
from ..services.ifc_service import IFCService
from ..services.clash_service import ClashService
from ..services.project_service import ProjectService

logger = logging.getLogger("ifc_editor.federation_api")

router = APIRouter(prefix="/projects/{project_id}", tags=["Federation & Clashes"])

@router.get("/models", response_model=list[SubModelResponse])
async def list_sub_models(project_id: str) -> list[SubModelResponse]:
    """List all federated sub-models attached to a project."""
    project = await ProjectService.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Project {project_id} not found.")

    async with get_db_connection() as db:
        cursor = await db.execute(
            "SELECT id, project_id, name, discipline, file_name, file_size, element_count, created_at FROM project_models WHERE project_id = ? ORDER BY created_at ASC",
            (project_id,)
        )
        rows = await cursor.fetchall()
        return [SubModelResponse(**dict(r)) for r in rows]

@router.post("/models", response_model=SubModelResponse, status_code=status.HTTP_201_CREATED)
async def upload_sub_model(
    project_id: str,
    file: UploadFile = File(...),
    discipline: str = Form("ARCH"),
    name: Optional[str] = Form(None)
) -> SubModelResponse:
    """Upload and attach a discipline sub-model to a federated project."""
    project = await ProjectService.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Project {project_id} not found.")

    if not file.filename.lower().endswith((".ifc", ".ifczip")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file must be .ifc or .ifczip.")

    models_dir = settings.PROJECTS_DIR / project_id / "models"
    models_dir.mkdir(parents=True, exist_ok=True)

    submodel_id = str(uuid.uuid4())
    stored_filename = f"{submodel_id}_{file.filename}"
    file_path = models_dir / stored_filename

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    try:
        metrics = IFCService.validate_ifc(file_path)
    except Exception as e:
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Invalid IFC file: {e}")

    model_name = name or Path(file.filename).stem
    file_size = len(content)
    element_count = metrics["element_count"]
    now = ProjectService._now_iso()

    async with get_db_connection() as db:
        await db.execute("""
            INSERT INTO project_models (id, project_id, name, discipline, file_name, file_size, element_count, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (submodel_id, project_id, model_name, discipline.upper(), stored_filename, file_size, element_count, now))
        await db.commit()

    logger.info("Attached federated sub-model '%s' (%s) to project %s", model_name, discipline, project_id)

    return SubModelResponse(
        id=submodel_id,
        project_id=project_id,
        name=model_name,
        discipline=discipline.upper(),
        file_name=stored_filename,
        file_size=file_size,
        element_count=element_count,
        created_at=now
    )

@router.delete("/models/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sub_model(project_id: str, model_id: str) -> None:
    """Remove a federated sub-model from the project."""
    async with get_db_connection() as db:
        cursor = await db.execute(
            "SELECT file_name FROM project_models WHERE id = ? AND project_id = ?",
            (model_id, project_id)
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sub-model not found.")

        file_path = settings.PROJECTS_DIR / project_id / "models" / row["file_name"]
        if file_path.exists():
            file_path.unlink()

        await db.execute("DELETE FROM project_models WHERE id = ?", (model_id,))
        await db.commit()

@router.get("/models/{model_id}/download")
async def download_sub_model(project_id: str, model_id: str) -> FileResponse:
    """Download a sub-model IFC file."""
    async with get_db_connection() as db:
        cursor = await db.execute(
            "SELECT name, file_name FROM project_models WHERE id = ? AND project_id = ?",
            (model_id, project_id)
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sub-model not found.")

        file_path = settings.PROJECTS_DIR / project_id / "models" / row["file_name"]
        if not file_path.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model file missing on disk.")

        return FileResponse(
            path=str(file_path),
            filename=f"{row['name'].replace(' ', '_')}.ifc",
            media_type="application/octet-stream"
        )

@router.post("/clashes/check", response_model=ClashCheckResponse)
async def check_clashes(project_id: str, req: ClashCheckRequest) -> ClashCheckResponse:
    """Run geometric collision and clearance clash detection on project models."""
    project = await ProjectService.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Project {project_id} not found.")

    try:
        return await ClashService.compute_clashes(
            project_id=project_id,
            tolerance=req.tolerance,
            model_ids=req.model_ids
        )
    except Exception as e:
        logger.exception("Clash check failed: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Clash check failed: {e}")
