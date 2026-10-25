import uuid
import logging
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse

from ..core.config import settings
from ..core.database import get_db_connection
from ..core.workers import run_ifc
from ..models.schemas import (
    SubModelResponse,
    ClashCheckRequest,
    ClashCheckResponse,
    ClashJobStartResponse,
    ClashJobStatusResponse,
)
from ..services.atomic_store import atomic_write_bytes
from ..services.clash_jobs import (
    ClashJobBusy,
    ClashJobCapacity,
    registry as clash_jobs,
)
from ..services.ifc_service import IFCService
from ..services.clash_service import ClashService
from ..services.project_service import (
    IFCZIP_MAGIC,
    ProjectService,
    UploadTooLarge,
    extract_ifc_from_ifczip,
)

logger = logging.getLogger("ifc_editor.federation_api")

router = APIRouter(prefix="/projects/{project_id}", tags=["Federation & Clashes"])

#: Size of one read from the upload stream. The body is bounded by
#: `settings.MAX_SUBMODEL_BYTES`, not by this chunk.
_UPLOAD_CHUNK_BYTES = 1024 * 1024


def _require_uuid(project_id: str) -> None:
    """Reject a non-UUID `project_id` before it is used as a path component.

    STEP-20 / F-026: these routes build `PROJECTS_DIR / project_id / "models" / ...`
    themselves instead of going through `ProjectService.get_project_file_path`, so they
    need the same guarantee at the entry point. The DB lookup already 404s for an
    unknown id; this closes the primitive even if a row is ever inserted by another
    path.
    """
    try:
        uuid.UUID(str(project_id))
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")


@router.get("/models", response_model=list[SubModelResponse])
async def list_sub_models(project_id: str) -> list[SubModelResponse]:
    """List all federated sub-models attached to a project."""
    _require_uuid(project_id)
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
    _require_uuid(project_id)
    project = await ProjectService.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Project {project_id} not found.")

    if not file.filename.lower().endswith((".ifc", ".ifczip")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file must be .ifc or .ifczip.")

    models_dir = settings.PROJECTS_DIR / project_id / "models"

    safe_filename = Path(file.filename or "submodel.ifc").name

    # STEP-20 / F-027: `await file.read()` buffered an unbounded body in RAM, so one
    # request could exhaust the host. Read in fixed chunks and stop the moment the cap is
    # crossed - nothing has been written to disk at this point, so there is no partial
    # file to clean up.
    max_bytes = settings.MAX_SUBMODEL_BYTES
    buffer = bytearray()
    while True:
        chunk = await file.read(_UPLOAD_CHUNK_BYTES)
        if not chunk:
            break
        buffer.extend(chunk)
        if len(buffer) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Sub-model exceeds the maximum allowed size.",
            )
    content = bytes(buffer)

    # .ifczip is detected by magic bytes, not by the declared extension: the
    # stored artefact must be the extracted STEP, never the archive.
    if content.startswith(IFCZIP_MAGIC):
        try:
            # STEP-04: extraction is CPU work; keep it off the event loop.
            content = await run_ifc(extract_ifc_from_ifczip, content)
        except UploadTooLarge as e:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(e))
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Invalid IFC file: {e}")
        safe_filename = f"{Path(safe_filename).stem}.ifc"

    models_dir.mkdir(parents=True, exist_ok=True)

    submodel_id = str(uuid.uuid4())
    stored_filename = f"{submodel_id}_{safe_filename}"
    file_path = models_dir / stored_filename

    # STEP-03: the sub-model is written atomically. STEP-04: the validation parse (~seconds
    # on a large model) runs on the bounded IFC pool instead of blocking every request.
    await run_ifc(atomic_write_bytes, content, file_path)

    try:
        metrics = await run_ifc(IFCService.validate_ifc, file_path)
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
    _require_uuid(project_id)
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
    _require_uuid(project_id)
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
        # STEP-20: clash failures quote model paths (spec 11); keep them in the log.
        logger.exception("Clash check failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Clash check failed. See the server log for details.",
        )


@router.post(
    "/clashes/jobs",
    response_model=ClashJobStartResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_clash_job(project_id: str, req: ClashCheckRequest) -> ClashJobStartResponse:
    """Start a background clash check and return its id immediately (audit issue 2.1).

    The synchronous `POST /clashes/check` above is unchanged and remains the contract the QA
    harness and existing tests use; this route exists so the UI never waits 47 s on one request.
    """
    _require_uuid(project_id)
    project = await ProjectService.get_project(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Project {project_id} not found.")

    try:
        job = clash_jobs.start(
            project_id=project_id,
            tolerance=req.tolerance,
            model_ids=req.model_ids,
        )
    except ClashJobBusy as e:
        logger.info("Refused duplicate clash job for %s: %s", project_id, e)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A clash check is already running for this project.",
        )
    except ClashJobCapacity:
        logger.warning("Clash job registry is full; refusing start for %s", project_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Too many clash checks are running. Retry shortly.",
        )

    return ClashJobStartResponse(job_id=job.job_id, status=job.status)


@router.get("/clashes/jobs/{job_id}", response_model=ClashJobStatusResponse)
async def get_clash_job(project_id: str, job_id: str) -> ClashJobStatusResponse:
    """Poll a background clash check. Unknown ids and ids from another project are both 404."""
    _require_uuid(project_id)
    job = clash_jobs.get(project_id, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clash job not found.")
    return job.snapshot()
