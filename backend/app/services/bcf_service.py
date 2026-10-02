import io
import json
import math
import uuid
import zipfile
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from ..core.database import get_db_connection
from ..models.schemas import (
    BcfTopicCreateRequest,
    BcfTopicResponse,
    ClashItem,
    AuditTimelineItem,
    AuditDiffResponse,
)
from .project_service import ProjectService

logger = logging.getLogger("ifc_editor.bcf_service")

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

        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            # 1. bcf.version specification file
            ver_content = '<?xml version="1.0" encoding="UTF-8"?>\n<Version VersionId="2.1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" />'
            z.writestr("bcf.version", ver_content)

            # 2. Iterate each topic
            for topic in topics:
                folder = topic.id

                # Generate markup.bcf
                markup_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Markup xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <Header>
        <File IfcProject="{project_id}" Date="{topic.created_at}" />
    </Header>
    <Topic Guid="{topic.id}" TopicType="{topic.topic_type}" TopicStatus="{topic.topic_status}">
        <Title>{topic.title}</Title>
        <Priority>{topic.priority}</Priority>
        <CreationDate>{topic.created_at}</CreationDate>
        <CreationAuthor>{topic.creation_author}</CreationAuthor>
        <Description>{topic.description}</Description>
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

                # Selected components XML
                comp_xml = "".join(
                    f'<Component IfcGuid="{elem_id}" />'
                    for elem_id in topic.selected_elements
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
                        id=hash(r["id"]) % 1000000,
                        project_id=r["project_id"],
                        user_id="cad_user",
                        user_name="CAD Operator",
                        action_type=r["action_type"],
                        express_id=r["express_id"],
                        entity_type=r["entity_type"],
                        payload=params,
                        timestamp=r["created_at"],
                    )
                )

        # Sort combined timeline chronologically
        items.sort(key=lambda x: x.timestamp)
        return items

    @classmethod
    async def get_audit_diff(cls, project_id: str) -> AuditDiffResponse:
        """
        Compute visual spatial diff buckets (added, modified, deleted)
        by aggregating CAD transactions and edit events.
        """
        added: set[int] = set()
        modified: set[int] = set()
        deleted: set[int] = set()

        async with get_db_connection() as db:
            # Check CAD transactions
            cad_cursor = await db.execute(
                "SELECT express_id, action_type, status FROM cad_transactions WHERE project_id = ?",
                (project_id,),
            )
            for r in await cad_cursor.fetchall():
                exp_id = r["express_id"]
                if r["status"] == "ACTIVE":
                    added.add(exp_id)
                elif r["status"] == "UNDONE":
                    deleted.add(exp_id)

            # Check edit history
            hist_cursor = await db.execute(
                "SELECT express_id, action_type FROM edit_history WHERE project_id = ?",
                (project_id,),
            )
            for r in await hist_cursor.fetchall():
                exp_id = r["express_id"]
                if not exp_id:
                    continue
                act = r["action_type"].lower()
                if "transform" in act or "property" in act or "update" in act:
                    if exp_id not in added:
                        modified.add(exp_id)
                elif "delete" in act or "remove" in act:
                    deleted.add(exp_id)
                    added.discard(exp_id)
                    modified.discard(exp_id)

        # Total elements in project model
        file_path = ProjectService.get_project_file_path(project_id)
        total_elements = 0
        if file_path.exists():
            try:
                import ifcopenshell
                m = ifcopenshell.open(str(file_path))
                total_elements = len(m.by_type("IfcProduct"))
            except Exception:
                total_elements = len(added)

        return AuditDiffResponse(
            total_elements=total_elements,
            added=sorted(list(added)),
            modified=sorted(list(modified)),
            deleted=sorted(list(deleted)),
        )
