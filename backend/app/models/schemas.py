from typing import Any, Literal, Optional
from pydantic import BaseModel, Field, ConfigDict

# STEP-18: the only schemas `ifcopenshell.file(schema=...)` can be constructed with here.
# A free-form string let `POST /api/projects {"schema_version": "IFC9"}` create a storage
# directory before ifcopenshell raised, leaving an orphan (F-043).
SchemaVersion = Literal["IFC2X3", "IFC4", "IFC4X3"]

class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)

class ProjectCreate(ProjectBase):
    schema_version: SchemaVersion = Field("IFC4", description="IFC Schema: IFC2X3, IFC4, or IFC4X3")

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
    # STEP-09: storey elevation in PROJECT units (millimetres on a mm file) so drawings can
    # cut a plan at the right height. `None` for non-storey nodes.
    elevation: Optional[float] = None
    # STEP-09: metres per project unit (0.001 for a millimetre file). Root node only.
    unit_scale: Optional[float] = None

SpatialNode.model_rebuild()

# STEP-18: the IfcValue select members this app may write as an `IfcPropertySingleValue`
# NominalValue. This is a *value* type allowlist - entity names such as IfcWall are not
# IfcValue members and must be refused (F-014/F-064).
IFCValueType = Literal[
    "IfcLabel", "IfcText", "IfcIdentifier",
    "IfcReal", "IfcInteger", "IfcBoolean", "IfcLogical",
    "IfcCountMeasure", "IfcTimeStamp",
    "IfcLengthMeasure", "IfcPositiveLengthMeasure",
    "IfcAreaMeasure", "IfcVolumeMeasure", "IfcMassMeasure",
    "IfcPlaneAngleMeasure", "IfcRatioMeasure", "IfcPositiveRatioMeasure",
    "IfcNormalisedRatioMeasure", "IfcThermalTransmittanceMeasure",
    "IfcPowerMeasure", "IfcTimeMeasure",
]

class PropertySingle(BaseModel):
    name: str
    value: Any
    value_type: IFCValueType = "IfcLabel"

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
    value_type: IFCValueType = Field(
        "IfcLabel",
        description="An IfcValue select member (e.g. IfcLabel, IfcReal, IfcBoolean, IfcLengthMeasure)",
    )

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
    # Open issue 2.5: cheap cache/queue observability. Every one of these is an in-memory
    # snapshot — `/health` must never parse a model or touch storage to fill them.
    ifc: dict[str, Any] = Field(default_factory=dict)
    model_cache: dict[str, Any] = Field(default_factory=dict)
    locks: dict[str, Any] = Field(default_factory=dict)

class ChatMessage(BaseModel):
    role: str = Field(..., description="'user', 'assistant', or 'system'")
    content: str = Field(..., description="Message text content")

class ToolCall(BaseModel):
    id: str
    name: str
    arguments: dict[str, Any]
    result: Optional[dict[str, Any]] = None

class PendingToolCall(BaseModel):
    """A model-writing tool call the service refused to execute without confirmation."""
    name: str
    arguments: dict[str, Any]

class CopilotToolError(BaseModel):
    """A tool that ran and failed, surfaced to the client instead of being swallowed."""
    tool: str
    message: str

class CopilotChatRequest(BaseModel):
    project_id: str
    messages: list[ChatMessage]
    provider: str = Field("gemini", description="'gemini', 'claude', 'openai', 'openrouter', 'custom', 'ollama', or 'local'")
    model: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    selected_express_id: Optional[int] = None
    confirm_writes: bool = Field(
        False,
        description="Must be true before any model-writing tool (generate/transform/update) is executed."
    )

class CopilotChatResponse(BaseModel):
    message: ChatMessage
    tool_calls: list[ToolCall] = []
    project_updated: bool = False
    requires_confirmation: bool = False
    pending_tool_calls: list[PendingToolCall] = []
    errors: list[CopilotToolError] = []

class CopilotModelsRequest(BaseModel):
    provider: str = Field("gemini", description="'gemini', 'claude', 'openai', 'openrouter', 'custom', 'ollama', or 'local'")
    api_key: Optional[str] = None
    base_url: Optional[str] = None

class CopilotModelsResponse(BaseModel):
    provider: str
    models: list[str]
    default_model: str
    source: str = "fallback"  # 'api' or 'fallback'
    connected: bool = False
    error: Optional[str] = None


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

    # --- Completeness signal (STEP-06 / finding F-005) ---
    # A clash report that does not say what it examined lets a partial scan be read as a
    # coordination result. These three fields are the disclosure contract.
    elements_checked: int = Field(
        0,
        description=(
            "Unique target elements considered by the check (deduplicated by express id). "
            "This includes elements counted in geometry_failures."
        )
    )
    geometry_failures: int = Field(
        0,
        description="Number of target elements whose geometry could not be built (never checked)"
    )
    sampled: bool = Field(
        False,
        description="True when only a subset of the model was examined (a cap was applied)"
    )

# --- Background clash jobs (audit 2.1) -------------------------------------
# The synchronous `POST /clashes/check` contract is unchanged. This is an additive,
# in-memory job API for long scans so the event loop and the browser are never blocked.

class ClashJobProgress(BaseModel):
    #: `queued` | `extracting` | `comparing`. Additive to the two documented counters so the
    #: UI can label what `checked`/`total` are counting.
    phase: str = "queued"
    #: Cumulative work units completed (elements boxed, then element pairs compared).
    checked: int = 0
    #: Cumulative work units for the whole job. Grows when another model is opened.
    total: int = 0

class ClashJobStartResponse(BaseModel):
    job_id: str
    status: str = "queued"

class ClashJobStatusResponse(BaseModel):
    job_id: str
    status: str  # queued | running | succeeded | failed
    progress: ClashJobProgress = Field(default_factory=ClashJobProgress)
    result: Optional[ClashCheckResponse] = None
    error: Optional[str] = None

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

class CadCloneRequest(BaseModel):
    delta: list[float] = Field(default=[1.0, 0.0, 0.0], description="Translation delta offset [dx, dy, dz] in meters")
    storey_id: Optional[int] = None

class CadMoveRequest(BaseModel):
    delta: list[float] = Field(default=[0.0, 0.0, 0.0], description="Translation delta offset [dx, dy, dz] in meters")

class CadRotateRequest(BaseModel):
    angle_degrees: float = Field(default=90.0, description="Rotation angle in degrees")
    axis: str = Field(default="z", description="Rotation axis: 'x', 'y', or 'z'")

class CadMirrorRequest(BaseModel):
    axis: str = Field(default="x", description="Mirror axis: 'x' or 'z'")
    is_copy: bool = Field(default=False, description="If True, create a mirrored duplicate; if False, mirror/flip in-place")

class CadArrayRequest(BaseModel):
    count: int = Field(default=3, ge=2, le=50, description="Total number of elements in array (including original)")
    delta: list[float] = Field(default=[2.0, 0.0, 0.0], description="Offset spacing [dx, dy, dz] per copy in meters")

class CadAlignRequest(BaseModel):
    align_type: str = Field(default="origin", description="Alignment type: 'origin', 'storey', 'reference'")
    target_express_id: Optional[int] = Field(default=None, description="Reference element Express ID when align_type is 'reference'")
    axis: str = Field(default="z", description="Axis to align along ('x', 'y', 'z')")
    target_value: Optional[float] = Field(default=None, description="Explicit coordinate value to align to")

class CadPinRequest(BaseModel):
    is_pinned: bool = Field(default=True, description="Pin / lock status")

class CadGeometryUpdateRequest(BaseModel):
    height: Optional[float] = Field(None, description="Updated height in meters")
    thickness: Optional[float] = Field(None, description="Updated thickness in meters")
    width: Optional[float] = Field(None, description="Updated width in meters")
    depth: Optional[float] = Field(None, description="Updated depth in meters")
    elevation: Optional[float] = Field(None, description="Updated base elevation in meters")

class CadAssignStoreyRequest(BaseModel):
    storey_id: int = Field(description="Target IfcBuildingStorey Express ID")

class CadMaterialRequest(BaseModel):
    material_name: str = Field(description="Architectural material name: Concrete, Wood, Glass, Steel, Brick, Plaster")
    color_hex: Optional[str] = Field(None, description="Color hex code e.g. #94A3B8")
    transparency: Optional[float] = Field(0.0, description="Transparency (0.0 to 1.0)")

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
    # STEP-19: CAD rows carry the transaction's own status, edit-history rows are ACTIVE.
    # Without it an UNDONE transaction is indistinguishable from an applied one (F-022).
    status: str = "ACTIVE"
    # STEP-19: derived from the shared classifier - "added" | "modified" | "deleted".
    change_kind: str = "added"

class AuditDiffResponse(BaseModel):
    total_elements: int
    added: list[int]
    modified: list[int]
    deleted: list[int]


