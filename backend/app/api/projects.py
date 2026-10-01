from pathlib import Path
from typing import Optional, Any
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse

from ..models.schemas import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    SpatialNode,
    ElementDetails,
    PropertyUpdatePayload,
    TransformPayload
)
from ..services.project_service import ProjectService
from ..services.ifc_service import IFCService

router = APIRouter(prefix="/projects", tags=["Projects"])

@router.get("", response_model=list[ProjectResponse])
async def list_projects() -> list[ProjectResponse]:
    """Retrieve all available IFC projects."""
    return await ProjectService.list_projects()

@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(data: ProjectCreate) -> ProjectResponse:
    """Create a new blank IFC project with Site, Building, and Storey hierarchy."""
    return await ProjectService.create_project(data)

@router.post("/upload", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def upload_project(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None)
) -> ProjectResponse:
    """Upload an existing IFC file and import into the project database."""
    if not file.filename.lower().endswith((".ifc", ".ifczip")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must have .ifc or .ifczip extension."
        )
    
    project_name = name or Path(file.filename).stem
    content = await file.read()
    
    try:
        project = await ProjectService.import_project_from_bytes(
            name=project_name,
            description=description,
            original_filename=file.filename,
            content=content
        )
        return project
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
            detail="Project IFC file is missing on server storage."
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
        return IFCService.get_spatial_hierarchy(file_path)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to traverse spatial hierarchy: {str(e)}"
        )

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
        return IFCService.get_element_details(file_path, express_id)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to inspect element #{express_id}: {str(e)}"
        )

@router.post("/{project_id}/elements/{express_id}/placement", status_code=status.HTTP_200_OK)
async def update_element_placement(
    project_id: str,
    express_id: int,
    payload: TransformPayload
) -> dict[str, Any]:
    """Update an element's spatial placement in the IFC model using a 4x4 transform matrix."""
    project = await ProjectService.get_project(project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found."
        )
        
    file_path = ProjectService.get_project_file_path(project_id)
    try:
        IFCService.update_element_placement(file_path, express_id, payload.matrix)
        await ProjectService.record_edit(
            project_id=project_id,
            user_id="api-user",
            user_name="API User",
            action_type="transform",
            express_id=express_id,
            entity_type="IfcProduct",
            payload={"matrix": payload.matrix}
        )
        return {"status": "success", "express_id": express_id, "updated": True}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update placement for #{express_id}: {str(e)}"
        )

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
    try:
        IFCService.update_element_property(
            file_path=file_path,
            express_id=express_id,
            pset_name=payload.pset_name,
            prop_name=payload.property_name,
            prop_val=payload.value,
            prop_type=payload.value_type
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
        return {"status": "success", "express_id": express_id, "updated": True}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update property for #{express_id}: {str(e)}"
        )
