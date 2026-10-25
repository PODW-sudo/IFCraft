import io
import json
import math
import uuid
import zipfile
import zlib
import logging
from xml.sax.saxutils import escape as xml_escape
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
import ifcopenshell

from ..core.database import get_db_connection
from ..models.schemas import (
    BcfTopicCreateRequest,
    BcfTopicResponse,
    ClashItem,
    AuditTimelineItem,
    AuditDiffResponse,
)
from .project_service import ProjectService
from .ifc_service import open_model_for_read
from .atomic_store import project_read_lock
from ..core.workers import run_ifc

logger = logging.getLogger("ifc_editor.bcf_service")


def _map_express_ids_to_guids(file_path: Path, topics: list[Any]) -> dict[str, str]:
    """Resolve BCF `selected_elements` express ids to IFC GlobalIds (IFC pool)."""
    guid_map: dict[str, str] = {}
    model = open_model_for_read(file_path)
    for topic in topics:
        for elem in (topic.selected_elements or []):
            str_elem = str(elem)
            if str_elem.isdigit() or isinstance(elem, int):
                try:
                    ent = model.by_id(int(elem))
                    if ent and hasattr(ent, "GlobalId"):
                        guid_map[str_elem] = ent.GlobalId
                except Exception:
                    pass
    return guid_map


def _count_products(file_path: Path) -> int:
    """Number of IfcProduct instances in the model (IFC pool; STEP-04)."""
    return len(open_model_for_read(file_path).by_type("IfcProduct"))


# ---------------------------------------------------------------------------
# STEP-19: audit classification and stable IDs.
#
# `hash(r["id"]) % 1000000` (the old CAD timeline id) is salted per process, so a
# bookmark or a cached id pointed at a different event after every restart (F-022).
# The ids below are derived with crc32, which is identical in every process.
# ---------------------------------------------------------------------------

ADDED_ACTIONS = frozenset({
    "create_wall", "create_slab", "create_column", "create_door", "create_window",
    "create_opening", "clone_element", "array_element", "generate_building",
})
MODIFIED_ACTIONS = frozenset({
    "move_element", "rotate_element", "align_element",
    "transform", "transform_element", "update_property", "update_placement",
})


def stable_audit_id(namespace: str, key: str) -> int:
    """Process-independent positive integer id for a derived audit row."""
    return zlib.crc32(f"{namespace}:{key}".encode("utf-8")) & 0x7FFFFFFF


def classify_change(
    action_type: str,
    status: str = "ACTIVE",
    parameters: Optional[dict] = None,
) -> str:
    """Map a transaction/edit action onto "added" | "modified" | "deleted".

    An unrecognised action is *modified*, never *added*: an unknown action must not
    inflate the "new geometry" bucket (spec 6). `status` is accepted for symmetry with
    the call sites; `UNDONE` rows are filtered before classification.
    """
    action = (action_type or "").strip().lower()
    if action in ADDED_ACTIONS:
        return "added"
    if action == "mirror_element":
        return "added" if (parameters or {}).get("is_copy") else "modified"
    if action == "delete_element":
        return "deleted"
    if action in MODIFIED_ACTIONS:
        return "modified"
    return "modified"


class BCFService:
    @classmethod
    async def create_topic(
        cls, project_id: str, req: BcfTopicCreateRequest, author: str = "User"
    ) -> BcfTopicResponse:
        """Create and store a BCF 2.1 topic."""
        topic_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        pos_json = json.dumps(req.camera_position) if req.camera_position else None
        target_json = json.dumps(req.camera_target) if req.camera_target else None
        elems_json = json.dumps(req.selected_elements) if req.selected_elements else json.dumps([])

        async with get_db_connection() as db:
            await db.execute(
                """
                INSERT INTO bcf_topics (
                    id, project_id, title, description, topic_type, topic_status,
                    priority, creation_author, camera_position, camera_target,
                    selected_elements, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    topic_id,
                    project_id,
                    req.title,
                    req.description or "",
                    req.topic_type,
                    req.topic_status,
                    req.priority,
                    author,
                    pos_json,
                    target_json,
                    elems_json,
                    now,
                    now,
                ),
            )
            await db.commit()

        logger.info("Created BCF topic %s: %s", topic_id, req.title)
        return BcfTopicResponse(
            id=topic_id,
            project_id=project_id,
            title=req.title,
            description=req.description or "",
            topic_type=req.topic_type,
            topic_status=req.topic_status,
            priority=req.priority,
            creation_author=author,
            camera_position=req.camera_position,
            camera_target=req.camera_target,
            selected_elements=req.selected_elements or [],
            created_at=now,
            updated_at=now,
        )

    @classmethod
    async def list_topics(cls, project_id: str) -> list[BcfTopicResponse]:
        """Fetch all BCF topics for a given project."""
        async with get_db_connection() as db:
            cursor = await db.execute(
                """
                SELECT id, project_id, title, description, topic_type, topic_status,
                       priority, creation_author, camera_position, camera_target,
                       selected_elements, created_at, updated_at
                FROM bcf_topics
                WHERE project_id = ?
                ORDER BY created_at DESC
                """,
                (project_id,),
            )
            rows = await cursor.fetchall()

            topics: list[BcfTopicResponse] = []
            for r in rows:
                pos = json.loads(r["camera_position"]) if r["camera_position"] else None
                tgt = json.loads(r["camera_target"]) if r["camera_target"] else None
                elems = json.loads(r["selected_elements"]) if r["selected_elements"] else []
                topics.append(
                    BcfTopicResponse(
                        id=r["id"],
                        project_id=r["project_id"],
                        title=r["title"],
                        description=r["description"] or "",
                        topic_type=r["topic_type"],
                        topic_status=r["topic_status"],
                        priority=r["priority"],
                        creation_author=r["creation_author"],
                        camera_position=pos,
                        camera_target=tgt,
                        selected_elements=elems,
                        created_at=r["created_at"],
                        updated_at=r["updated_at"],
                    )
                )
            return topics

    @classmethod
    async def import_clashes_as_topics(
        cls, project_id: str, clashes: list[ClashItem]
    ) -> int:
        """Convert a list of detected geometric clashes into persistent BCF topics."""
        count = 0
        for clash in clashes:
            cx, cy, cz = clash.intersection_center
            cam_pos = [cx + 3.0, cy + 2.0, cz + 3.0]
            cam_tgt = [cx, cy, cz]
            title = f"Clash: {clash.element_a_type} #{clash.element_a_id} vs {clash.element_b_type} #{clash.element_b_id}"
            desc = (
                f"Geometric intersection detected between {clash.model_a_name} ({clash.discipline_a}) "
                f"and {clash.model_b_name} ({clash.discipline_b}). Penetration distance: {clash.distance:.3f}m."
            )
            prio = "High" if clash.severity == "hard" else "Normal"

            req = BcfTopicCreateRequest(
                title=title,
                description=desc,
                topic_type="Clash",
                topic_status="Open",
                priority=prio,
                camera_position=cam_pos,
                camera_target=cam_tgt,
                selected_elements=[clash.element_a_id, clash.element_b_id],
            )
            await cls.create_topic(project_id, req, author="ClashEngine")
            count += 1
        return count

    @classmethod
    async def export_bcfzip(cls, project_id: str) -> bytes:
        """Generate standard BCF 2.1 archive (.bcfzip) in memory and return bytes."""
        topics = await cls.list_topics(project_id)
        buf = io.BytesIO()

        # Map integer express IDs to authentic 22-char IFC Base64 GlobalIds
        # (STEP-04: the parse and the lookups run on the bounded IFC pool).
        guid_map: dict[str, str] = {}
        try:
            file_path = ProjectService.get_project_file_path(project_id)
            if file_path.exists():
                async with project_read_lock(project_id):
                    guid_map = await run_ifc(_map_express_ids_to_guids, file_path, topics)
        except Exception as e:
            logger.warning("Could not map express IDs to GlobalIds for BCF: %s", e)

        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            # 1. bcf.version specification file
            ver_content = '<?xml version="1.0" encoding="UTF-8"?>\n<Version VersionId="2.1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" />'
            z.writestr("bcf.version", ver_content)

            # 2. Iterate each topic
            for topic in topics:
                folder = topic.id

                # Generate markup.bcf with XML-escaped user content
                title_esc = xml_escape(str(topic.title or ""))
                desc_esc = xml_escape(str(topic.description or ""))
                type_esc = xml_escape(str(topic.topic_type or ""))
                status_esc = xml_escape(str(topic.topic_status or ""))
                author_esc = xml_escape(str(topic.creation_author or ""))
                priority_esc = xml_escape(str(topic.priority or ""))

                markup_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Markup xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <Header>
        <File IfcProject="{xml_escape(str(project_id))}" Date="{topic.created_at}" />
    </Header>
    <Topic Guid="{topic.id}" TopicType="{type_esc}" TopicStatus="{status_esc}">
        <Title>{title_esc}</Title>
        <Priority>{priority_esc}</Priority>
        <CreationDate>{topic.created_at}</CreationDate>
        <CreationAuthor>{author_esc}</CreationAuthor>
        <Description>{desc_esc}</Description>
    </Topic>
    <Viewpoints Guid="{uuid.uuid4()}">
        <Viewpoint>viewpoint.bcfv</Viewpoint>
    </Viewpoints>
</Markup>"""
                z.writestr(f"{folder}/markup.bcf", markup_xml)

                # Compute perspective camera direction
                pos = topic.camera_position or [10.0, 10.0, 10.0]
                tgt = topic.camera_target or [0.0, 0.0, 0.0]
                dx = tgt[0] - pos[0]
                dy = tgt[1] - pos[1]
                dz = tgt[2] - pos[2]
                length = math.sqrt(dx * dx + dy * dy + dz * dz) or 1.0
                dir_x, dir_y, dir_z = dx / length, dy / length, dz / length

                # Selected components XML (resolving 22-char Base64 IfcGuid strings)
                comp_xml = "".join(
                    f'<Component IfcGuid="{xml_escape(guid_map.get(str(elem_id), str(elem_id)))}" />'
                    for elem_id in (topic.selected_elements or [])
                )

                viewpoint_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<VisualizationInfo xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Guid="{uuid.uuid4()}">
    <PerspectiveCamera>
        <CameraViewPoint><X>{pos[0]:.4f}</X><Y>{pos[1]:.4f}</Y><Z>{pos[2]:.4f}</Z></CameraViewPoint>
        <CameraDirection><X>{dir_x:.4f}</X><Y>{dir_y:.4f}</Y><Z>{dir_z:.4f}</Z></CameraDirection>
        <CameraUpVector><X>0.0</X><Y>1.0</Y><Z>0.0</Z></CameraUpVector>
        <FieldOfView>45.0</FieldOfView>
    </PerspectiveCamera>
    <Components>
        <Selection>
            {comp_xml}
        </Selection>
    </Components>
</VisualizationInfo>"""
                z.writestr(f"{folder}/viewpoint.bcfv", viewpoint_xml)

        buf.seek(0)
        return buf.getvalue()

    @classmethod
    async def get_audit_timeline(cls, project_id: str) -> list[AuditTimelineItem]:
        """Fetch unified chronological audit events from edit_history and cad_transactions."""
        items: list[AuditTimelineItem] = []

        async with get_db_connection() as db:
            # 1. Edit History events
            cursor = await db.execute(
                """
                SELECT id, project_id, user_id, user_name, action_type, express_id, entity_type, payload, timestamp
                FROM edit_history
                WHERE project_id = ?
                ORDER BY id ASC
                """,
                (project_id,),
            )
            rows = await cursor.fetchall()
            for r in rows:
                try:
                    payload = json.loads(r["payload"])
                except Exception:
                    payload = {}
                items.append(
                    AuditTimelineItem(
                        id=r["id"],
                        project_id=r["project_id"],
                        user_id=r["user_id"],
                        user_name=r["user_name"],
                        action_type=r["action_type"],
                        express_id=r["express_id"],
                        entity_type=r["entity_type"],
                        payload=payload,
                        timestamp=r["timestamp"],
                        # Edit-history rows have no status of their own: they are history.
                        status="ACTIVE",
                        change_kind=classify_change(r["action_type"], "ACTIVE", payload),
                    )
                )

            # 2. CAD Transactions
            cad_cursor = await db.execute(
                """
                SELECT id, project_id, action_type, express_id, entity_type, parameters, status, created_at
                FROM cad_transactions
                WHERE project_id = ?
                ORDER BY created_at ASC
                """,
                (project_id,),
            )
            cad_rows = await cad_cursor.fetchall()
            for r in cad_rows:
                try:
                    params = json.loads(r["parameters"])
                except Exception:
                    params = {}
                items.append(
                    AuditTimelineItem(
                        # crc32 of the transaction id: identical in every process (spec 1-4).
                        id=stable_audit_id("cad", r["id"]),
                        project_id=r["project_id"],
                        user_id="cad_user",
                        user_name="CAD Operator",
                        action_type=r["action_type"],
                        express_id=r["express_id"],
                        entity_type=r["entity_type"],
                        payload=params,
                        timestamp=r["created_at"],
                        # Without the transaction's own status an UNDONE row looked applied.
                        status=r["status"],
                        change_kind=classify_change(r["action_type"], r["status"], params),
                    )
                )

        # Sort combined timeline chronologically. `id` breaks timestamp ties, so the
        # sequence is a total order and two calls over unchanged data agree (spec 9).
        items.sort(key=lambda x: (x.timestamp, x.id))
        return items

    @classmethod
    async def get_audit_diff(cls, project_id: str) -> AuditDiffResponse:
        """
        Compute visual spatial diff buckets (added, modified, deleted).

        The classification is derived from the *latest* state of each element:
        CAD transactions ordered oldest-first overwrite the previous verdict, so the
        newest ACTIVE row wins. UNDONE transactions are skipped entirely - they no
        longer describe the model, which is the only rule that is right for both an
        undone create and an undone move (spec 8). Edit-history rows only fill gaps
        (`setdefault`) so an audit-log line cannot override a CAD state decision.
        """
        latest: dict[int, str] = {}

        async with get_db_connection() as db:
            # Check CAD transactions, oldest first, so the newest row wins.
            cad_cursor = await db.execute(
                """
                SELECT express_id, action_type, status, parameters
                FROM cad_transactions
                WHERE project_id = ?
                ORDER BY created_at ASC, rowid ASC
                """,
                (project_id,),
            )
            for r in await cad_cursor.fetchall():
                exp_id = r["express_id"]
                if exp_id is None or r["status"] == "UNDONE":
                    continue
                try:
                    params = json.loads(r["parameters"]) if r["parameters"] else {}
                except Exception:
                    params = {}
                latest[int(exp_id)] = classify_change(r["action_type"], r["status"], params)

            # Check edit history; it never overrides a CAD verdict.
            hist_cursor = await db.execute(
                """
                SELECT express_id, action_type, payload
                FROM edit_history
                WHERE project_id = ?
                ORDER BY id ASC
                """,
                (project_id,),
            )
            for r in await hist_cursor.fetchall():
                exp_id = r["express_id"]
                if not exp_id:
                    continue
                try:
                    payload = json.loads(r["payload"]) if r["payload"] else {}
                except Exception:
                    payload = {}
                latest.setdefault(int(exp_id), classify_change(r["action_type"], "ACTIVE", payload))

        added = {exp for exp, kind in latest.items() if kind == "added"}
        modified = {exp for exp, kind in latest.items() if kind == "modified"}
        deleted = {exp for exp, kind in latest.items() if kind == "deleted"}

        # Total elements in project model
        file_path = ProjectService.get_project_file_path(project_id)
        total_elements = 0
        if file_path.exists():
            try:
                async with project_read_lock(project_id):
                    total_elements = await run_ifc(_count_products, file_path)
            except Exception:
                total_elements = len(added)

        return AuditDiffResponse(
            total_elements=total_elements,
            added=sorted(list(added)),
            modified=sorted(list(modified)),
            deleted=sorted(list(deleted)),
        )
