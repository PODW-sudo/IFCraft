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

@router.delete("/{project_id}/elements/{express_id}", status_code=status.HTTP_200_OK)
async def delete_element(project_id: str, express_id: int) -> dict[str, Any]:
    """Delete an element from the IFC project model."""
    from ..services.cad_service import CADService
    try:
        return await CADService.delete_element(project_id, express_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete element #{express_id}: {str(e)}"
        )
