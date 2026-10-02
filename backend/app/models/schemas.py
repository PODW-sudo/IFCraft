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

class ChatMessage(BaseModel):
    role: str = Field(..., description="'user', 'assistant', or 'system'")
    content: str = Field(..., description="Message text content")

class ToolCall(BaseModel):
    id: str
    name: str
    arguments: dict[str, Any]
    result: Optional[dict[str, Any]] = None

class CopilotChatRequest(BaseModel):
    project_id: str
    messages: list[ChatMessage]
    provider: str = Field("gemini", description="'gemini', 'claude', 'openai', 'ollama', or 'local'")
    model: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    selected_express_id: Optional[int] = None

class CopilotChatResponse(BaseModel):
    message: ChatMessage
    tool_calls: list[ToolCall] = []
    project_updated: bool = False

# ---------------------------------------------------------------------------
# Phase 10: Federated Coordination & Clash Detection Schemas
# ---------------------------------------------------------------------------

class SubModelResponse(BaseModel):
    id: str
    project_id: str
    name: str
    discipline: str = "ARCH"  # ARCH, STRUCT, MEP, CIVIL, OTHER
    file_name: str
    file_size: int
    element_count: int
    created_at: str

    model_config = ConfigDict(from_attributes=True)

class ClashItem(BaseModel):
    id: str
    element_a_id: int
    element_a_name: str
    element_a_type: str
    model_a_id: str
    model_a_name: str
    discipline_a: str

    element_b_id: int
    element_b_name: str
    element_b_type: str
    model_b_id: str
    model_b_name: str
    discipline_b: str

    severity: str = "hard"  # hard, clearance
    distance: float = 0.0  # penetration depth or clearance distance
    intersection_center: list[float] = [0.0, 0.0, 0.0]  # [x, y, z]
    box_min: list[float] = [0.0, 0.0, 0.0]
    box_max: list[float] = [0.0, 0.0, 0.0]

class ClashCheckRequest(BaseModel):
    tolerance: float = Field(0.01, description="Tolerance margin in meters (default 0.01m = 1cm)")
    model_ids: Optional[list[str]] = Field(None, description="Subset of model IDs to check, or all if omitted")

class ClashCheckResponse(BaseModel):
    total_clashes: int
    hard_clashes: int
    clearance_clashes: int
    tolerance: float
    clashes: list[ClashItem]
    duration_ms: float

# ===========================================================================
# CAD Modeling & Parametric Synthesis Schemas (Phase 11)
# ===========================================================================

class CadWallRequest(BaseModel):
    start: list[float] = Field(description="Start [x, y] or [x, y, z] in meters")
    end: list[float] = Field(description="End [x, y] or [x, y, z] in meters")
    elevation: float = Field(0.0, description="Base elevation in meters")
    height: float = Field(3.0, description="Wall height in meters")
    thickness: float = Field(0.2, description="Wall thickness in meters")
    name: Optional[str] = "Parametric Wall"
    storey_id: Optional[int] = None

class CadSlabRequest(BaseModel):
    boundary: list[list[float]] = Field(description="List of 2D or 3D vertices [[x1, y1], [x2, y2], ...]")
    elevation: float = Field(0.0, description="Base elevation in meters")
    thickness: float = Field(0.3, description="Slab thickness in meters")
    name: Optional[str] = "Parametric Slab"
    storey_id: Optional[int] = None

class CadColumnRequest(BaseModel):
    position: list[float] = Field(description="Position [x, y] or [x, y, z] in meters")
    elevation: float = Field(0.0, description="Base elevation in meters")
    height: float = Field(3.0, description="Column height in meters")
    width: float = Field(0.35, description="Column width (X) in meters")
    depth: float = Field(0.35, description="Column depth (Y) in meters")
    name: Optional[str] = "Parametric Column"
    storey_id: Optional[int] = None

class CadOpeningRequest(BaseModel):
    host_wall_id: int = Field(description="Express ID of the host wall")
    opening_type: str = Field("door", description="'door' or 'window'")
    offset_along_wall: float = Field(1.0, description="Offset along wall centerline from start point in meters")
    sill_height: float = Field(0.0, description="Height above wall base in meters (0 for door, e.g. 0.9 for window)")
    width: float = Field(0.9, description="Opening width in meters")
    height: float = Field(2.1, description="Opening height in meters")
    thickness: Optional[float] = Field(None, description="Opening thickness (defaults to host wall thickness + 0.1)")
    name: Optional[str] = None

class CadElementResponse(BaseModel):
    success: bool
    express_id: int
    global_id: str
    entity_type: str
    name: str
    transaction_id: str
    opening_express_id: Optional[int] = None
    message: str = "Element synthesized successfully"

class CadUndoRedoResponse(BaseModel):
    success: bool
    transaction_id: str
    action: str
    affected_express_id: int
    can_undo: bool
    can_redo: bool
    message: str

class CadHistoryItem(BaseModel):
    id: str
    action_type: str
    express_id: int
    entity_type: str
    parameters: dict[str, Any]
    status: str
    created_at: str

class CadHistoryResponse(BaseModel):
    history: list[CadHistoryItem]
    can_undo: bool
    can_redo: bool

# ===========================================================================
# BCF 2.1 & Temporal Audit Schemas (Phase 12)
# ===========================================================================

class BcfTopicCreateRequest(BaseModel):
    title: str = Field(description="Issue topic title")
    description: Optional[str] = Field("", description="Detailed issue description")
    topic_type: str = Field("Clash", description="Topic type: Clash, Request, Issue, Remark")
    topic_status: str = Field("Open", description="Topic status: Open, In Progress, Resolved, Closed")
    priority: str = Field("Normal", description="Priority: Low, Normal, High, Critical")
    camera_position: Optional[list[float]] = Field(None, description="Camera 3D viewpoint [x, y, z]")
    camera_target: Optional[list[float]] = Field(None, description="Camera look-at target [x, y, z]")
    selected_elements: Optional[list[int]] = Field(None, description="Associated IFC Express IDs")

class BcfTopicResponse(BaseModel):
    id: str
    project_id: str
    title: str
    description: str
    topic_type: str
    topic_status: str
    priority: str
    creation_author: str
    camera_position: Optional[list[float]] = None
    camera_target: Optional[list[float]] = None
    selected_elements: list[int] = []
    created_at: str
    updated_at: str

class BcfClashImportRequest(BaseModel):
    clashes: list[ClashItem] = Field(description="Clash detection items to convert to BCF topics")

class AuditTimelineItem(BaseModel):
    id: int
    project_id: str
    user_id: str
    user_name: str
    action_type: str
    express_id: Optional[int] = None
    entity_type: Optional[str] = None
    payload: dict[str, Any]
    timestamp: str

class AuditDiffResponse(BaseModel):
    total_elements: int
    added: list[int]
    modified: list[int]
    deleted: list[int]


