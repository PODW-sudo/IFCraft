from typing import Any, Optional
from pydantic import BaseModel, Field, ConfigDict

class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)

class ProjectCreate(ProjectBase):
    schema_version: str = Field("IFC4", description="IFC Schema: IFC2X3, IFC4, or IFC4X3")

class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)

class ProjectResponse(ProjectBase):
    id: str
    schema_version: str
    file_name: str
    file_size: int
    element_count: int
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)

class SpatialNode(BaseModel):
    express_id: int
    global_id: str
    name: str
    type: str
    children: list["SpatialNode"] = []

SpatialNode.model_rebuild()

class PropertySingle(BaseModel):
    name: str
    value: Any
    value_type: str = "IfcLabel"

class PropertySetData(BaseModel):
    name: str
    properties: list[PropertySingle] = []

class ElementDetails(BaseModel):
    express_id: int
    global_id: str
    name: str
    type: str
    psets: list[PropertySetData] = []
    quantities: dict[str, Any] = {}

class PropertyUpdatePayload(BaseModel):
    pset_name: str = Field(..., min_length=1)
    property_name: str = Field(..., min_length=1)
    value: Any
    value_type: str = Field("IfcLabel", description="IfcLabel, IfcText, IfcReal, IfcInteger, IfcBoolean")

class TransformPayload(BaseModel):
    # 4x4 Transformation matrix (16 floats in column-major order)
    matrix: list[float] = Field(..., min_length=16, max_length=16)

class SessionPresence(BaseModel):
    id: str
    project_id: str
    user_name: str
    user_color: str
    last_active: str

class EditHistoryRecord(BaseModel):
    id: int
    project_id: str
    user_id: str
    user_name: str
    action_type: str
    express_id: Optional[int] = None
    entity_type: Optional[str] = None
    payload: dict[str, Any]
    timestamp: str

class HealthStatus(BaseModel):
    status: str
    version: str
    ifcopenshell_version: str
    database_ok: bool
    project_count: int
    timestamp: str
