import logging
from fastapi import APIRouter, HTTPException, Path
from ..models.schemas import (
    CadWallRequest,
    CadSlabRequest,
    CadColumnRequest,
    CadOpeningRequest,
    CadElementResponse,
    CadUndoRedoResponse,
    CadHistoryResponse,
    CadCloneRequest,
    CadMoveRequest,
    CadRotateRequest,
    CadMirrorRequest,
    CadArrayRequest,
    CadAlignRequest,
    CadPinRequest,
    CadGeometryUpdateRequest,
    CadAssignStoreyRequest,
    CadMaterialRequest,
)
from ..services.cad_service import CADService, GeometryNotEditable
from ..services.atomic_store import project_write_lock

logger = logging.getLogger("ifc_editor.api.cad")

#: STEP-20 / F-045: an unhandled CAD/ifcopenshell fault quotes the absolute model path in
#: its message. The client gets this fixed text; the exception goes to the server log.
_CAD_FAILURE_DETAIL = "CAD operation failed. See the server log for details."

cad_router = APIRouter(prefix="/projects/{id}/cad", tags=["cad"])

@cad_router.post("/wall", response_model=CadElementResponse)
async def create_wall(
    id: str = Path(..., description="Project ID"),
    req: CadWallRequest = ...
):
    """Synthesize a parametric IfcWall in the project model."""
    try:
        return await CADService.create_wall(id, req)
    except FileNotFoundError as e:
        # STEP-20 / F-045: fixed message; the path stays in the log.
        logger.warning("Project model file missing: %s", e)
        raise HTTPException(status_code=404, detail="Project model file not found.")
    except Exception as e:
        logger.exception("Failed to create wall: %s", e)
        raise HTTPException(status_code=500, detail=_CAD_FAILURE_DETAIL)

@cad_router.post("/slab", response_model=CadElementResponse)
async def create_slab(
    id: str = Path(..., description="Project ID"),
    req: CadSlabRequest = ...
):
    """Synthesize a parametric IfcSlab in the project model."""
    try:
        return await CADService.create_slab(id, req)
    except FileNotFoundError as e:
        # STEP-20 / F-045: fixed message; the path stays in the log.
        logger.warning("Project model file missing: %s", e)
        raise HTTPException(status_code=404, detail="Project model file not found.")
    except Exception as e:
        logger.exception("Failed to create slab: %s", e)
        raise HTTPException(status_code=500, detail=_CAD_FAILURE_DETAIL)

@cad_router.post("/column", response_model=CadElementResponse)
async def create_column(
    id: str = Path(..., description="Project ID"),
    req: CadColumnRequest = ...
):
    """Synthesize a parametric IfcColumn in the project model."""
    try:
        return await CADService.create_column(id, req)
    except FileNotFoundError as e:
        # STEP-20 / F-045: fixed message; the path stays in the log.
        logger.warning("Project model file missing: %s", e)
        raise HTTPException(status_code=404, detail="Project model file not found.")
    except Exception as e:
        logger.exception("Failed to create column: %s", e)
        raise HTTPException(status_code=500, detail=_CAD_FAILURE_DETAIL)

@cad_router.post("/opening", response_model=CadElementResponse)
async def create_opening(
    id: str = Path(..., description="Project ID"),
    req: CadOpeningRequest = ...
):
    """Cut an IfcOpeningElement void into a host wall and insert a Door or Window."""
    try:
        return await CADService.create_opening(id, req)
    except FileNotFoundError as e:
        # STEP-20 / F-045: fixed message; the path stays in the log.
        logger.warning("Project model file missing: %s", e)
        raise HTTPException(status_code=404, detail="Project model file not found.")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to create opening: %s", e)
        raise HTTPException(status_code=500, detail=_CAD_FAILURE_DETAIL)

@cad_router.post("/undo", response_model=CadUndoRedoResponse)
async def undo_cad(id: str = Path(..., description="Project ID")):
    """Undo the last active CAD transaction."""
    try:
        # STEP-03: the lock spans the whole undo (read the row -> swap the snapshot in ->
        # mark it UNDONE), so a concurrent write cannot land between our snapshot copy and
        # its bookkeeping. STEP-04: the copy/digest work is offloaded inside the service.
        async with project_write_lock(id):
            return await CADService.undo(id)
    except Exception as e:
        logger.exception("Failed to undo transaction: %s", e)
        raise HTTPException(status_code=500, detail=_CAD_FAILURE_DETAIL)

@cad_router.post("/redo", response_model=CadUndoRedoResponse)
async def redo_cad(id: str = Path(..., description="Project ID")):
    """Redo the most recently undone CAD transaction."""
    try:
        # Same single-writer scope as undo. The legacy redo path re-enters the create_*
        # primitives, which is safe: the lock is re-entrant for the same task.
        async with project_write_lock(id):
            return await CADService.redo(id)
    except Exception as e:
        logger.exception("Failed to redo transaction: %s", e)
        raise HTTPException(status_code=500, detail=_CAD_FAILURE_DETAIL)

@cad_router.get("/history", response_model=CadHistoryResponse)
async def get_history(id: str = Path(..., description="Project ID")):
    """Get CAD transaction history and undo/redo availability."""
    try:
        return await CADService.get_history(id)
    except Exception as e:
        logger.exception("Failed to fetch CAD history: %s", e)
        raise HTTPException(status_code=500, detail=_CAD_FAILURE_DETAIL)

@cad_router.delete("/elements/{express_id}")
async def delete_element(
    id: str = Path(..., description="Project ID"),
    express_id: int = Path(..., description="Element Express ID")
):
    """Delete an element from the IFC project model."""
    try:
        return await CADService.delete_element(id, express_id)
    except FileNotFoundError as e:
        # STEP-20 / F-045: fixed message; the path stays in the log.
        logger.warning("Project model file missing: %s", e)
        raise HTTPException(status_code=404, detail="Project model file not found.")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Failed to delete element #%d: %s", express_id, e)
        raise HTTPException(status_code=500, detail=_CAD_FAILURE_DETAIL)

@cad_router.post("/elements/{express_id}/clone", response_model=CadElementResponse)
async def clone_element(
    id: str = Path(..., description="Project ID"),
    express_id: int = Path(..., description="Element Express ID"),
    req: CadCloneRequest = ...
):
    """Clone an element with an offset delta vector."""
    try:
        return await CADService.clone_element(id, express_id, req)
    except FileNotFoundError as e:
        # STEP-20 / F-045: fixed message; the path stays in the log.
        logger.warning("Project model file missing: %s", e)
        raise HTTPException(status_code=404, detail="Project model file not found.")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Failed to clone element #%d: %s", express_id, e)
        raise HTTPException(status_code=500, detail=_CAD_FAILURE_DETAIL)

@cad_router.patch("/elements/{express_id}/geometry")
async def update_element_geometry(
    id: str = Path(..., description="Project ID"),
    express_id: int = Path(..., description="Element Express ID"),
    req: CadGeometryUpdateRequest = ...
):
    """Update parametric dimensions of an element."""
    try:
        return await CADService.update_geometry(id, express_id, req)
    except GeometryNotEditable as e:
        raise HTTPException(
            status_code=409,
            detail={"code": "unsupported_geometry", "message": str(e)},
        )
    except FileNotFoundError as e:
        # STEP-20 / F-045: fixed message; the path stays in the log.
        logger.warning("Project model file missing: %s", e)
        raise HTTPException(status_code=404, detail="Project model file not found.")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Failed to update geometry of #%d: %s", express_id, e)
        raise HTTPException(status_code=500, detail=_CAD_FAILURE_DETAIL)

@cad_router.post("/elements/{express_id}/assign-storey")
async def assign_element_storey(
    id: str = Path(..., description="Project ID"),
    express_id: int = Path(..., description="Element Express ID"),
    req: CadAssignStoreyRequest = ...
):
    """Reassign element spatial container to target storey."""
    try:
        return await CADService.assign_storey(id, express_id, req)
    except FileNotFoundError as e:
        # STEP-20 / F-045: fixed message; the path stays in the log.
        logger.warning("Project model file missing: %s", e)
        raise HTTPException(status_code=404, detail="Project model file not found.")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to assign storey for #%d: %s", express_id, e)
        raise HTTPException(status_code=500, detail=_CAD_FAILURE_DETAIL)

@cad_router.post("/elements/{express_id}/material")
async def assign_element_material(
    id: str = Path(..., description="Project ID"),
    express_id: int = Path(..., description="Element Express ID"),
    req: CadMaterialRequest = ...
):
    """Assign or override material and surface style."""
    try:
        return await CADService.assign_material(id, express_id, req)
    except FileNotFoundError as e:
        # STEP-20 / F-045: fixed message; the path stays in the log.
        logger.warning("Project model file missing: %s", e)
        raise HTTPException(status_code=404, detail="Project model file not found.")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Failed to assign material for #%d: %s", express_id, e)
        raise HTTPException(status_code=500, detail=_CAD_FAILURE_DETAIL)

@cad_router.post("/elements/{express_id}/move", response_model=CadElementResponse)
async def move_element(
    id: str = Path(..., description="Project ID"),
    express_id: int = Path(..., description="Element Express ID"),
    req: CadMoveRequest = ...
):
    """Translate an element by offset delta vector [dx, dy, dz]."""
    try:
        return await CADService.move_element(id, express_id, req)
    except FileNotFoundError as e:
        # STEP-20 / F-045: fixed message; the path stays in the log.
        logger.warning("Project model file missing: %s", e)
        raise HTTPException(status_code=404, detail="Project model file not found.")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to move element #%d: %s", express_id, e)
        raise HTTPException(status_code=500, detail=_CAD_FAILURE_DETAIL)

@cad_router.post("/elements/{express_id}/rotate", response_model=CadElementResponse)
async def rotate_element(
    id: str = Path(..., description="Project ID"),
    express_id: int = Path(..., description="Element Express ID"),
    req: CadRotateRequest = ...
):
    """Rotate an element around local origin along axis ('x', 'y', 'z')."""
    try:
        return await CADService.rotate_element(id, express_id, req)
    except FileNotFoundError as e:
        # STEP-20 / F-045: fixed message; the path stays in the log.
        logger.warning("Project model file missing: %s", e)
        raise HTTPException(status_code=404, detail="Project model file not found.")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to rotate element #%d: %s", express_id, e)
        raise HTTPException(status_code=500, detail=_CAD_FAILURE_DETAIL)

@cad_router.post("/elements/{express_id}/mirror", response_model=CadElementResponse)
async def mirror_element(
    id: str = Path(..., description="Project ID"),
    express_id: int = Path(..., description="Element Express ID"),
    req: CadMirrorRequest = ...
):
    """Mirror an element across axis, either in-place or creating duplicate."""
    try:
        return await CADService.mirror_element(id, express_id, req)
    except FileNotFoundError as e:
        # STEP-20 / F-045: fixed message; the path stays in the log.
        logger.warning("Project model file missing: %s", e)
        raise HTTPException(status_code=404, detail="Project model file not found.")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to mirror element #%d: %s", express_id, e)
        raise HTTPException(status_code=500, detail=_CAD_FAILURE_DETAIL)

@cad_router.post("/elements/{express_id}/array", response_model=list[CadElementResponse])
async def array_element(
    id: str = Path(..., description="Project ID"),
    express_id: int = Path(..., description="Element Express ID"),
    req: CadArrayRequest = ...
):
    """Create a linear array of N elements spaced by delta vector."""
    try:
        return await CADService.array_element(id, express_id, req)
    except FileNotFoundError as e:
        # STEP-20 / F-045: fixed message; the path stays in the log.
        logger.warning("Project model file missing: %s", e)
        raise HTTPException(status_code=404, detail="Project model file not found.")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to array element #%d: %s", express_id, e)
        raise HTTPException(status_code=500, detail=_CAD_FAILURE_DETAIL)

@cad_router.post("/elements/{express_id}/align", response_model=CadElementResponse)
async def align_element(
    id: str = Path(..., description="Project ID"),
    express_id: int = Path(..., description="Element Express ID"),
    req: CadAlignRequest = ...
):
    """Align an element along an axis to target elevation, origin, or reference element."""
    try:
        return await CADService.align_element(id, express_id, req)
    except FileNotFoundError as e:
        # STEP-20 / F-045: fixed message; the path stays in the log.
        logger.warning("Project model file missing: %s", e)
        raise HTTPException(status_code=404, detail="Project model file not found.")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to align element #%d: %s", express_id, e)
        raise HTTPException(status_code=500, detail=_CAD_FAILURE_DETAIL)

@cad_router.post("/elements/{express_id}/pin")
async def pin_element(
    id: str = Path(..., description="Project ID"),
    express_id: int = Path(..., description="Element Express ID"),
    req: CadPinRequest = ...
):
    """Pin or unpin an element to prevent accidental transforms or deletions."""
    try:
        return await CADService.pin_element(id, express_id, req)
    except FileNotFoundError as e:
        # STEP-20 / F-045: fixed message; the path stays in the log.
        logger.warning("Project model file missing: %s", e)
        raise HTTPException(status_code=404, detail="Project model file not found.")
    except Exception as e:
        logger.exception("Failed to pin element #%d: %s", express_id, e)
        raise HTTPException(status_code=500, detail=_CAD_FAILURE_DETAIL)

@cad_router.get("/elements/{express_id}/pinned")
async def is_element_pinned(
    id: str = Path(..., description="Project ID"),
    express_id: int = Path(..., description="Element Express ID")
):
    """Check if an element is pinned."""
    is_pinned = await CADService.is_element_pinned(id, express_id)
    return {"express_id": express_id, "is_pinned": is_pinned}

@cad_router.get("/pinned")
async def get_pinned_elements(
    id: str = Path(..., description="Project ID")
):
    """Get all pinned element Express IDs in the project."""
    pinned_ids = await CADService.get_pinned_elements(id)
    return {"project_id": id, "pinned_ids": pinned_ids}

