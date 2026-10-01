import json
import uuid
import shutil
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from ..core.config import settings
from ..core.database import get_db_connection
from ..models.schemas import ProjectCreate, ProjectUpdate, ProjectResponse
from .ifc_service import IFCService

logger = logging.getLogger("ifc_editor.project_service")

class ProjectService:
    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    @classmethod
    async def create_project(cls, data: ProjectCreate) -> ProjectResponse:
        """Create a new blank IFC project and record it in database."""
        project_id = str(uuid.uuid4())
        project_dir = settings.PROJECTS_DIR / project_id
        project_dir.mkdir(parents=True, exist_ok=True)
        
        file_name = "model.ifc"
        ifc_path = project_dir / file_name
        
        # Create empty IFC model with spatial hierarchy
        element_count = IFCService.create_blank_project(
            file_path=ifc_path,
            project_name=data.name,
            schema_name=data.schema_version
        )
        file_size = ifc_path.stat().st_size
        now = cls._now_iso()
        
        async with get_db_connection() as db:
            await db.execute("""
                INSERT INTO projects (
                    id, name, description, schema_version, file_name, file_size, element_count, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                project_id, data.name, data.description, data.schema_version,
                file_name, file_size, element_count, now, now
            ))
            await db.commit()
            
        logger.info("Created project '%s' (ID: %s)", data.name, project_id)
        return ProjectResponse(
            id=project_id,
            name=data.name,
            description=data.description,
            schema_version=data.schema_version,
            file_name=file_name,
            file_size=file_size,
            element_count=element_count,
            created_at=now,
            updated_at=now
        )

    @classmethod
    async def import_project_from_bytes(
        cls,
        name: str,
        description: Optional[str],
        original_filename: str,
        content: bytes
    ) -> ProjectResponse:
        """Import an uploaded IFC file and record it in database."""
        project_id = str(uuid.uuid4())
        project_dir = settings.PROJECTS_DIR / project_id
        project_dir.mkdir(parents=True, exist_ok=True)
        
        saved_file_name = "model.ifc"
        ifc_path = project_dir / saved_file_name
        
        # Write bytes
        with open(ifc_path, "wb") as f:
            f.write(content)
            
        # Validate and extract metrics with IfcOpenShell
        metrics = IFCService.validate_ifc(ifc_path)
        schema = metrics["schema"]
        element_count = metrics["element_count"]
        file_size = len(content)
        now = cls._now_iso()
        
        async with get_db_connection() as db:
            await db.execute("""
                INSERT INTO projects (
                    id, name, description, schema_version, file_name, file_size, element_count, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                project_id, name, description, schema,
                saved_file_name, file_size, element_count, now, now
            ))
            await db.commit()
            
        logger.info("Imported project '%s' from %s (ID: %s)", name, original_filename, project_id)
        return ProjectResponse(
            id=project_id,
            name=name,
            description=description,
            schema_version=schema,
            file_name=saved_file_name,
            file_size=file_size,
            element_count=element_count,
            created_at=now,
            updated_at=now
        )

    @classmethod
    async def list_projects(cls) -> list[ProjectResponse]:
        """List all projects ordered by most recent."""
        async with get_db_connection() as db:
            cursor = await db.execute("SELECT * FROM projects ORDER BY updated_at DESC")
            rows = await cursor.fetchall()
            return [
                ProjectResponse(
                    id=row["id"],
                    name=row["name"],
                    description=row["description"],
                    schema_version=row["schema_version"],
                    file_name=row["file_name"],
                    file_size=row["file_size"],
                    element_count=row["element_count"],
                    created_at=row["created_at"],
                    updated_at=row["updated_at"]
                ) for row in rows
            ]

    @classmethod
    async def get_project(cls, project_id: str) -> Optional[ProjectResponse]:
        """Fetch project details by ID."""
        async with get_db_connection() as db:
            cursor = await db.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
            row = await cursor.fetchone()
            if not row:
                return None
            return ProjectResponse(
                id=row["id"],
                name=row["name"],
                description=row["description"],
                schema_version=row["schema_version"],
                file_name=row["file_name"],
                file_size=row["file_size"],
                element_count=row["element_count"],
                created_at=row["created_at"],
                updated_at=row["updated_at"]
            )

    @classmethod
    def get_project_file_path(cls, project_id: str) -> Path:
        """Get the absolute path to the project's model.ifc."""
        return settings.PROJECTS_DIR / project_id / "model.ifc"

    @classmethod
    async def update_project(cls, project_id: str, data: ProjectUpdate) -> Optional[ProjectResponse]:
        """Update project name or description."""
        existing = await cls.get_project(project_id)
        if not existing:
            return None
            
        new_name = data.name if data.name is not None else existing.name
        new_desc = data.description if data.description is not None else existing.description
        now = cls._now_iso()
        
        async with get_db_connection() as db:
            await db.execute("""
                UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?
            """, (new_name, new_desc, now, project_id))
            await db.commit()
            
        return await cls.get_project(project_id)

    @classmethod
    async def delete_project(cls, project_id: str) -> bool:
        """Delete project from database and remove directory storage."""
        async with get_db_connection() as db:
            cursor = await db.execute("DELETE FROM projects WHERE id = ?", (project_id,))
            await db.commit()
            if cursor.rowcount == 0:
                return False
                
        # Remove directory
        p_dir = settings.PROJECTS_DIR / project_id
        if p_dir.exists():
            shutil.rmtree(p_dir, ignore_errors=True)
            
        logger.info("Deleted project %s and cleaned up storage.", project_id)
        return True

    @classmethod
    async def record_edit(
        cls,
        project_id: str,
        user_id: str,
        user_name: str,
        action_type: str,
        express_id: Optional[int],
        entity_type: Optional[str],
        payload: dict
    ) -> None:
        """Record an edit action in audit log and touch project updated_at."""
        now = cls._now_iso()
        async with get_db_connection() as db:
            await db.execute("""
                INSERT INTO edit_history (
                    project_id, user_id, user_name, action_type, express_id, entity_type, payload, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                project_id, user_id, user_name, action_type, express_id, entity_type,
                json.dumps(payload), now
            ))
            # Also update project file size and element count
            ifc_path = cls.get_project_file_path(project_id)
            if ifc_path.exists():
                file_size = ifc_path.stat().st_size
                await db.execute("""
                    UPDATE projects SET file_size = ?, updated_at = ? WHERE id = ?
                """, (file_size, now, project_id))
            else:
                await db.execute("UPDATE projects SET updated_at = ? WHERE id = ?", (now, project_id))
            await db.commit()
