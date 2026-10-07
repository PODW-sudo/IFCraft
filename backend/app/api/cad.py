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
    CadGeometryUpdateRequest,
    CadAssignStoreyRequest,
    CadMaterialRequest,
)
from ..services.cad_service import CADService

logger = logging.getLogger("ifc_editor.api.cad")

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
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Failed to create wall: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@cad_router.post("/slab", response_model=CadElementResponse)
async def create_slab(
    id: str = Path(..., description="Project ID"),
    req: CadSlabRequest = ...
):
    """Synthesize a parametric IfcSlab in the project model."""
    try:
        return await CADService.create_slab(id, req)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Failed to create slab: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@cad_router.post("/column", response_model=CadElementResponse)
async def create_column(
    id: str = Path(..., description="Project ID"),
    req: CadColumnRequest = ...
):
    """Synthesize a parametric IfcColumn in the project model."""
    try:
        return await CADService.create_column(id, req)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Failed to create column: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@cad_router.post("/opening", response_model=CadElementResponse)
async def create_opening(
    id: str = Path(..., description="Project ID"),
    req: CadOpeningRequest = ...
):
    """Cut an IfcOpeningElement void into a host wall and insert a Door or Window."""
    try:
        return await CADService.create_opening(id, req)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to create opening: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@cad_router.post("/undo", response_model=CadUndoRedoResponse)
async def undo_cad(id: str = Path(..., description="Project ID")):
    """Undo the last active CAD transaction."""
    try:
        return await CADService.undo(id)
    except Exception as e:
        logger.exception("Failed to undo transaction: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@cad_router.post("/redo", response_model=CadUndoRedoResponse)
async def redo_cad(id: str = Path(..., description="Project ID")):
    """Redo the most recently undone CAD transaction."""
    try:
        return await CADService.redo(id)
    except Exception as e:
        logger.exception("Failed to redo transaction: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@cad_router.get("/history", response_model=CadHistoryResponse)
async def get_history(id: str = Path(..., description="Project ID")):
    """Get CAD transaction history and undo/redo availability."""
    try:
        return await CADService.get_history(id)
    except Exception as e:
        logger.exception("Failed to fetch CAD history: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@cad_router.delete("/elements/{express_id}")
async def delete_element(
    id: str = Path(..., description="Project ID"),
    express_id: int = Path(..., description="Element Express ID")
):
    """Delete an element from the IFC project model."""
    try:
        return await CADService.delete_element(id, express_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Failed to delete element #%d: %s", express_id, e)
        raise HTTPException(status_code=500, detail=str(e))

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
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Failed to clone element #%d: %s", express_id, e)
        raise HTTPException(status_code=500, detail=str(e))

@cad_router.patch("/elements/{express_id}/geometry")
async def update_element_geometry(
    id: str = Path(..., description="Project ID"),
    express_id: int = Path(..., description="Element Express ID"),
    req: CadGeometryUpdateRequest = ...
):
    """Update parametric dimensions of an element."""
    try:
        return await CADService.update_geometry(id, express_id, req)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Failed to update geometry of #%d: %s", express_id, e)
        raise HTTPException(status_code=500, detail=str(e))

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
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Failed to assign storey for #%d: %s", express_id, e)
        raise HTTPException(status_code=500, detail=str(e))

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
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Failed to assign material for #%d: %s", express_id, e)
        raise HTTPException(status_code=500, detail=str(e))
