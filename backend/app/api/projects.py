import asyncio
import logging
from functools import partial
from pathlib import Path
from typing import Optional, Any
from fastapi import APIRouter, Header, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse

from ..core.workers import ifc_executor
from ..models.schemas import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    SpatialNode,
    ElementDetails,
    PropertyUpdatePayload,
    TransformPayload
)
from ..services.atomic_store import project_read_lock, project_write_lock
from ..services.project_service import IFCZIP_MAGIC, ProjectService, UploadTooLarge
from ..services.ifc_service import IFCService
from ..services.cad_service import CADService
from ..services.websocket_manager import ws_manager

router = APIRouter(prefix="/projects", tags=["Projects"])

logger = logging.getLogger("ifc_editor.api.projects")

#: STEP-20 / F-045: ifcopenshell and the storage layer quote absolute paths in their
#: exception text. A 500 body gets this fixed sentence; the exception goes to the log.
_IO_FAILURE_DETAIL = "The project model could not be read. See the server log for details."

SAMPLES_METADATA = [
    {
        "id": "ifc2x3_duplex_architecture",
        "name": "Duplex Architecture (IFC2X3)",
        "description": "Full multi-storey duplex villa with 295 architectural elements, detailed walls, doors, windows, stairs, and spaces.",
        "schema_version": "IFC2X3",
        "element_count": 295,
        "file_name": "ifc2x3_duplex_architecture.ifc"
    },
    {
        "id": "building_architecture",
        "name": "Building Architecture (IFC4X3)",
        "description": "Clean modern architectural structure utilizing the latest IFC4X3 international standard schema.",
        "schema_version": "IFC4X3",
        "element_count": 20,
        "file_name": "building_architecture.ifc"
    },
    {
        "id": "duplex_residential",
        "name": "Duplex Residential Villa",
        "description": "2-storey residential building complete with ground floor, first floor, partition walls, floor slabs, structural columns, and property sets.",
        "schema_version": "IFC4",
        "element_count": 23,
        "file_name": "duplex_residential.ifc"
    },
    {
        "id": "office_pavilion",
        "name": "Modern Architectural Pavilion",
        "description": "Open-span commercial pavilion featuring cantilever canopy roof, structural grid columns, and glass enclosure facades.",
        "schema_version": "IFC4",
        "element_count": 12,
        "file_name": "office_pavilion.ifc"
    },
    {
        "id": "sample_castle",
        "name": "Historical Castle Benchmark (IFC2X3)",
        "description": "High-complexity 47MB benchmark model with 3,822 IFC elements for testing spatial performance and navigation.",
        "schema_version": "IFC2X3",
        "element_count": 3822,
        "file_name": "Ifc2x3_SampleCastle.ifc"
    }
]

@router.get("/samples/list", response_model=list[dict])
async def list_sample_models() -> list[dict]:
    """Retrieve bundled architectural sample models."""
    return SAMPLES_METADATA

@router.post("/samples/{sample_id}/load", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def load_sample_project(sample_id: str) -> ProjectResponse:
    """Instantiate a new project from a bundled sample IFC file."""
    sample_meta = next((s for s in SAMPLES_METADATA if s["id"] == sample_id), None)
    if not sample_meta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sample model '{sample_id}' not found."
        )
    
    sample_file = Path(__file__).parent.parent / "samples" / sample_meta["file_name"]
    if not sample_file.exists():
        from ..samples.sample_generator import generate_samples
        generate_samples(sample_file.parent)

    with open(sample_file, "rb") as f:
        content = f.read()

    project = await ProjectService.import_project_from_bytes(
        name=sample_meta["name"],
        description=sample_meta["description"],
        original_filename=sample_meta["file_name"],
        content=content
    )
    return project

@router.get("", response_model=list[ProjectResponse])
async def list_projects() -> list[ProjectResponse]:
    """Retrieve all available IFC projects."""
    return await ProjectService.list_projects()

@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(data: ProjectCreate) -> ProjectResponse:
    """Create a new blank IFC project with Site, Building, and Storey hierarchy."""
    return await ProjectService.create_project(data)

MAX_UPLOAD_SIZE = 250 * 1024 * 1024  # 250 MB

@router.post("/upload", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def upload_project(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None)
) -> ProjectResponse:
    """Upload an existing IFC file and import into the project database."""
    safe_filename = Path(file.filename or "upload.ifc").name
    if not safe_filename.lower().endswith((".ifc", ".ifczip")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must have .ifc or .ifczip extension."
        )
    
    # Chunked read to prevent unbounded memory allocation
    chunk_size = 1024 * 1024  # 1MB
    bytes_read = 0
    chunks = []
    
    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        bytes_read += len(chunk)
        if bytes_read > MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Uploaded file exceeds maximum allowed size of {MAX_UPLOAD_SIZE // (1024 * 1024)} MB."
            )
        chunks.append(chunk)
        
    content = b"".join(chunks)

    # Magic header check for plain .ifc files (STEP format: ISO-10303-21).
    # A ZIP payload is detected by its magic bytes regardless of the declared
    # extension and is validated after extraction instead.
    if safe_filename.lower().endswith(".ifc") and not content.startswith(IFCZIP_MAGIC):
        prefix = content[:512].decode("utf-8", errors="ignore").strip()
        if "ISO-10303-21" not in prefix:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid IFC file: Missing ISO-10303-21 STEP header."
            )
    
    project_name = name or Path(safe_filename).stem
    
    try:
        project = await ProjectService.import_project_from_bytes(
            name=project_name,
            description=description,
            original_filename=safe_filename,
            content=content
        )
        return project
    except UploadTooLarge as e:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to parse and import IFC file: {str(e)}"
        )

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str) -> ProjectResponse:
    """Retrieve project metadata by project ID."""
    project = await ProjectService.get_project(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found."
        )
    return project

@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, data: ProjectUpdate) -> ProjectResponse:
    """Update project name or description."""
    updated = await ProjectService.update_project(project_id, data)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found."
        )
    return updated

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: str) -> None:
    """Delete a project and purge its model storage."""
    deleted = await ProjectService.delete_project(project_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found."
        )

@router.get("/{project_id}/download")
async def download_ifc_file(project_id: str) -> FileResponse:
    """Download the current valid IFC model file for a project."""
    project = await ProjectService.get_project(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found."
        )
    
    file_path = ProjectService.get_project_file_path(project_id)
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project IFC file is missing."
        )
        
    return FileResponse(
        path=str(file_path),
        filename=f"{project.name.replace(' ', '_')}.ifc",
        media_type="application/octet-stream"
    )

@router.get("/{project_id}/spatial-tree", response_model=SpatialNode)
async def get_spatial_tree(project_id: str) -> SpatialNode:
    """Extract and return the spatial hierarchy tree (Project -> Site -> Building -> Storey -> Elements)."""
    project = await ProjectService.get_project(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found."
        )
    
    file_path = ProjectService.get_project_file_path(project_id)
    try:
        # STEP-04: the parse must not run on the event loop (a 49 MB model froze every
        # other request for 9 s). It goes through the bounded IFC pool; the per-project
        # read lock serialises it against writers and against other readers of the same
        # cached `ifcopenshell.file`.
        async with project_read_lock(project_id):
            return await asyncio.get_running_loop().run_in_executor(
                ifc_executor, partial(IFCService.get_spatial_hierarchy, file_path)
            )
    except Exception as e:
        # STEP-20: the exception can quote the model path; log it, do not publish it.
        logger.exception("Failed to traverse spatial hierarchy for %s: %s", project_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=_IO_FAILURE_DETAIL
        )

# STEP-04: element inspection is served from the warm model cache with the parse/inspection
# call offloaded via run_in_executor onto the bounded IFC pool (2 workers), never inline in
# this coroutine. A click in the viewport must not freeze every other request.
@router.get("/{project_id}/elements/{express_id}", response_model=ElementDetails)
async def get_element_details(project_id: str, express_id: int) -> ElementDetails:
    """Fetch attributes, Property Sets, and quantities for a single IFC element."""
    project = await ProjectService.get_project(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found."
        )
        
    file_path = ProjectService.get_project_file_path(project_id)
    try:
        # STEP-04: served from the warm model cache on the bounded IFC pool (element
        # inspection used to re-parse the whole file on the event loop on every click).
        async with project_read_lock(project_id):
            return await asyncio.get_running_loop().run_in_executor(
                ifc_executor, partial(IFCService.get_element_details, file_path, express_id)
            )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except RuntimeError as re_err:
        # ifcopenshell 0.9 raises RuntimeError ("Instance #27 not found") from by_id for a
        # missing express id instead of returning None, so a deleted (or undone) element
        # surfaced as a 500. This is a read-only lookup: a missing instance is a 404.
        # The definitive fix belongs in IFCService.get_element_details (_try_by_id); that
        # file is owned by another lane, so the mapping lives here for now.
        if "not found" in str(re_err).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(re_err))
        logger.exception("Failed to inspect element #%d in %s", express_id, project_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=_IO_FAILURE_DETAIL
        )
    except Exception as e:
        logger.exception("Failed to inspect element #%d in %s: %s", express_id, project_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=_IO_FAILURE_DETAIL
        )

@router.post("/{project_id}/elements/{express_id}/placement", status_code=status.HTTP_200_OK)
async def update_element_placement(
    project_id: str,
    express_id: int,
    payload: TransformPayload,
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> dict[str, Any]:
    """Update an element's spatial placement in the IFC model using a 4x4 transform matrix."""
    project = await ProjectService.get_project(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found."
        )
        
    file_path = ProjectService.get_project_file_path(project_id)

    # STEP-02 spec 4 / F-018: an unlocked REST write is equivalent to no lock at all.
    # The WS commit path already enforces the soft lock; a REST caller must not overwrite an
    # element another session holds. `rooms.get` is deliberately non-creating, and the lock
    # check runs before begin_snapshot() so a 409 writes nothing.
    room = ws_manager.rooms.get(project_id)
    if x_user_id and room is not None:
        room.cleanup_stale_locks()
        lock = room.locks.get(express_id)
        if lock and lock.get("user_id") != x_user_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Element #{express_id} is locked by "
                    f"{lock.get('user_name', 'another user')}."
                ),
            )

    # STEP-10: a gizmo drag through this route is a model mutation, so it has to be
    # recorded as a cad_transaction - otherwise Ctrl+Z cannot reach it at all (F-018 half).
    # begin_snapshot() -> write -> record_transaction() is the same shared commit helper
    # that cad_service uses; STEP-02 collapses the triple into its single write path.
    #
    # STEP-03: the whole triple runs under the per-project write lock, so two concurrent
    # drags serialise instead of each writing its own snapshot of the model. STEP-04: the
    # snapshot copy and the open/mutate/write pair run on the bounded IFC pool.
    loop = asyncio.get_running_loop()
    transaction_id: Optional[str] = None
    pre_snapshot: Optional[str] = None
    async with project_write_lock(project_id):
        try:
            transaction_id, pre_snapshot = await loop.run_in_executor(
                ifc_executor, partial(CADService.begin_snapshot, project_id)
            )
            await loop.run_in_executor(
                ifc_executor,
                partial(IFCService.update_element_placement, file_path, express_id, payload.matrix),
            )
            await ProjectService.record_edit(
                project_id=project_id,
                user_id="api-user",
                user_name="API User",
                action_type="transform",
                express_id=express_id,
                entity_type="IfcProduct",
                payload={"matrix": payload.matrix}
            )
            await CADService.record_transaction(
                project_id=project_id,
                transaction_id=transaction_id,
                action_type="update_placement",
                express_id=express_id,
                entity_type="IfcProduct",
                parameters={"matrix": payload.matrix, "source": "rest"},
                pre_snapshot=pre_snapshot,
            )
        except Exception as e:
            CADService.discard_snapshot(project_id, pre_snapshot)
            logger.exception("Failed to update placement for #%d: %s", express_id, e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=_IO_FAILURE_DETAIL
            )

    return {"status": "success", "express_id": express_id, "updated": True}

@router.post("/{project_id}/elements/{express_id}/properties", status_code=status.HTTP_200_OK)
async def update_element_properties(
    project_id: str,
    express_id: int,
    payload: PropertyUpdatePayload
) -> dict[str, Any]:
    """Add or update an IFC Property in a Property Set for an element."""
    project = await ProjectService.get_project(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found."
        )
        
    file_path = ProjectService.get_project_file_path(project_id)
    # STEP-10: property edits are undoable through the same cad_transactions stack as the
    # CAD primitives. The pre-image makes Spec 7 exact: the previous value is restored, or
    # the property is removed again if it did not exist before.
    # STEP-03/04: lock + bounded pool around the snapshot and the property write.
    loop = asyncio.get_running_loop()
    transaction_id: Optional[str] = None
    pre_snapshot: Optional[str] = None
    async with project_write_lock(project_id):
        try:
            transaction_id, pre_snapshot = await loop.run_in_executor(
                ifc_executor, partial(CADService.begin_snapshot, project_id)
            )
            await loop.run_in_executor(
                ifc_executor,
                partial(
                    IFCService.update_element_property,
                    file_path=file_path,
                    express_id=express_id,
                    pset_name=payload.pset_name,
                    prop_name=payload.property_name,
                    prop_val=payload.value,
                    prop_type=payload.value_type,
                ),
            )
            await ProjectService.record_edit(
                project_id=project_id,
                user_id="api-user",
                user_name="API User",
                action_type="update_property",
                express_id=express_id,
                entity_type="IfcPropertySet",
                payload={
                    "pset_name": payload.pset_name,
                    "property_name": payload.property_name,
                    "value": payload.value,
                    "value_type": payload.value_type
                }
            )
            await CADService.record_transaction(
                project_id=project_id,
                transaction_id=transaction_id,
                action_type="update_property",
                express_id=express_id,
                entity_type="IfcPropertySet",
                parameters={
                    "pset_name": payload.pset_name,
                    "property_name": payload.property_name,
                    "value": payload.value,
                    "value_type": payload.value_type,
                },
                pre_snapshot=pre_snapshot,
            )
        except ValueError as e:
            # STEP-18: a rejected value_type / uncoercible value is the client's mistake,
            # not a server fault - 422 with the reason, and the model file is untouched
            # because IFCService validates before it writes.
            CADService.discard_snapshot(project_id, pre_snapshot)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(e)
            )
        except Exception as e:
            CADService.discard_snapshot(project_id, pre_snapshot)
            logger.exception("Failed to update property for #%d: %s", express_id, e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=_IO_FAILURE_DETAIL
            )

    return {"status": "success", "express_id": express_id, "updated": True}

@router.delete("/{project_id}/elements/{express_id}", status_code=status.HTTP_200_OK)
async def delete_element(project_id: str, express_id: int) -> dict[str, Any]:
    """Delete an element from the IFC project model."""
    from ..services.cad_service import CADService
    try:
        return await CADService.delete_element(project_id, express_id)
    except FileNotFoundError as e:
        # STEP-20: the message quotes the model path.
        logger.warning("Project model file missing: %s", e)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project model file not found."
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.exception("Failed to delete element #%d: %s", express_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=_IO_FAILURE_DETAIL
        )
