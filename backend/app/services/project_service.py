import io
import json
import uuid
import shutil
import logging
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from ..core.config import settings
from ..core.database import get_db_connection
from ..core.workers import run_ifc
from ..models.schemas import ProjectCreate, ProjectUpdate, ProjectResponse
from .atomic_store import atomic_write_bytes, project_write_lock
from .ifc_service import IFCService
from .model_cache import model_cache

logger = logging.getLogger("ifc_editor.project_service")

# STEP-18: mirrors `SchemaVersion` in models/schemas.py. Pydantic already rejects an
# unknown schema at the HTTP boundary; this is the service-boundary guard for direct
# callers (and the reason `create_project` cannot leave an orphan directory behind).
ALLOWED_SCHEMA_VERSIONS = ("IFC2X3", "IFC4", "IFC4X3")

IFCZIP_MAGIC = b"PK\x03\x04"
MAX_IFCZIP_MEMBERS = 32
MAX_IFCZIP_MEMBER_BYTES = 512 * 1024 * 1024
MAX_IFCZIP_COMPRESSION_RATIO = 200
_IFCZIP_READ_CHUNK = 1024 * 1024


class UploadTooLarge(ValueError):
    """Raised when an upload or its expanded contents exceed the configured limits."""


def extract_ifc_from_ifczip(content: bytes) -> bytes:
    """Extract the single IFC member of a .ifczip archive, with bounded extraction.

    The archive is treated as untrusted: member count, declared uncompressed size,
    declared compression ratio and the actual number of bytes read are all bounded,
    so a forged central directory cannot be used to exhaust memory.
    """
    try:
        zf = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile as e:
        raise ValueError(f"invalid .ifczip archive: {e}") from e

    with zf:
        files = [i for i in zf.infolist() if not i.is_dir()]
        if len(files) > MAX_IFCZIP_MEMBERS:
            raise ValueError(
                f"ifczip archive contains too many members ({len(files)} > {MAX_IFCZIP_MEMBERS})"
            )

        ifcs = [i for i in files if i.filename.lower().endswith(".ifc")]
        if not ifcs:
            raise ValueError("ifczip archive contains no .ifc file")
        if len(ifcs) > 1:
            raise ValueError("ifczip archive contains more than one .ifc file")

        member = ifcs[0]
        if member.file_size > MAX_IFCZIP_MEMBER_BYTES:
            raise UploadTooLarge(
                "Extracted .ifc file exceeds the maximum allowed size of "
                f"{MAX_IFCZIP_MEMBER_BYTES // (1024 * 1024)} MB."
            )
        if member.compress_size and member.file_size / member.compress_size > MAX_IFCZIP_COMPRESSION_RATIO:
            raise UploadTooLarge(
                "Rejected .ifczip archive: member compression ratio exceeds the allowed maximum "
                f"of {MAX_IFCZIP_COMPRESSION_RATIO}:1."
            )

        # Hard cap: never trust the declared file_size from the central directory.
        buf = bytearray()
        try:
            with zf.open(member) as src:
                while True:
                    chunk = src.read(_IFCZIP_READ_CHUNK)
                    if not chunk:
                        break
                    buf.extend(chunk)
                    if len(buf) > MAX_IFCZIP_MEMBER_BYTES:
                        raise UploadTooLarge(
                            "Extracted .ifc file exceeds the maximum allowed size of "
                            f"{MAX_IFCZIP_MEMBER_BYTES // (1024 * 1024)} MB."
                        )
        except zipfile.BadZipFile as e:
            raise ValueError(f"invalid .ifczip archive: {e}") from e
        data = bytes(buf)

    if b"ISO-10303-21" not in data[:512]:
        raise ValueError("extracted .ifc file is not a STEP file")

    return data


class ProjectService:
    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    @classmethod
    async def create_project(cls, data: ProjectCreate) -> ProjectResponse:
        """Create a new blank IFC project and record it in database.

        Validation happens *before* the storage directory is created, and any failure
        after it removes the directory again, so a rejected request leaves neither a row
        nor an orphan folder under `storage/projects/` (F-043).
        """
        if data.schema_version not in ALLOWED_SCHEMA_VERSIONS:
            raise ValueError(
                f"Unsupported schema_version {data.schema_version!r}; expected one of "
                f"{', '.join(ALLOWED_SCHEMA_VERSIONS)}"
            )

        project_id = str(uuid.uuid4())
        project_dir = settings.PROJECTS_DIR / project_id
        project_dir.mkdir(parents=True, exist_ok=True)

        file_name = "model.ifc"
        ifc_path = project_dir / file_name

        try:
            # Create empty IFC model with spatial hierarchy. The writer serialises the model
            # and renames it into place (STEP-03), and the parse/serialise pair runs on the
            # bounded IFC pool rather than the event loop (STEP-04).
            element_count = await run_ifc(
                IFCService.create_blank_project,
                file_path=ifc_path,
                project_name=data.name,
                schema_name=data.schema_version,
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
        except Exception:
            # project_id is a fresh uuid4, so nothing else can be writing here.
            shutil.rmtree(project_dir, ignore_errors=True)
            raise

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
        # Unpack archives before anything is written: a rejected archive must not
        # leave a project row or directory behind. STEP-04: decompression is CPU work and
        # is bounded, so it runs on the IFC pool rather than the event loop.
        if content.startswith(IFCZIP_MAGIC):
            content = await run_ifc(extract_ifc_from_ifczip, content)

        project_id = str(uuid.uuid4())
        project_dir = settings.PROJECTS_DIR / project_id
        project_dir.mkdir(parents=True, exist_ok=True)
        
        saved_file_name = "model.ifc"
        ifc_path = project_dir / saved_file_name

        # STEP-03: a fresh upload replaces nothing, but it must still be atomic and cached
        # readers must not see a half-written file. STEP-04: the validation parse (~seconds
        # on a large model) runs on the bounded IFC pool, not on the event loop.
        async with project_write_lock(project_id):
            await run_ifc(atomic_write_bytes, content, ifc_path)

            # Validate and extract metrics with IfcOpenShell
            metrics = await run_ifc(IFCService.validate_ifc, ifc_path)
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
        """Get the absolute path to the project's model.ifc.

        STEP-03 / F-026: `project_id` arrives straight from the URL, so it used to be an
        unconstrained path segment (`".."` resolved to `storage/model.ifc`). It must be a
        UUID, and the resolved path must stay inside `settings.PROJECTS_DIR`; anything else
        raises `ValueError` *before* a caller opens, writes or deletes anything.
        """
        try:
            parsed = uuid.UUID(str(project_id))
        except (ValueError, AttributeError, TypeError) as exc:
            raise ValueError(f"invalid project id {project_id!r}: expected a UUID") from exc
        # STEP-20: require the dashed canonical spelling. `uuid.UUID` also accepts a bare
        # 32-hex-digit string, so `0000...0000` would otherwise address a directory whose
        # name is not how the id is stored.
        if str(parsed) != str(project_id).strip().lower():
            raise ValueError(f"invalid project id {project_id!r}: expected a canonical UUID")

        root = settings.PROJECTS_DIR.resolve()
        path = (root / str(project_id) / "model.ifc").resolve()
        if not path.is_relative_to(root):
            raise ValueError("project path escapes the storage root")
        return path

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
                
        # Remove directory. The project lock is taken so an in-flight mutation (which holds it
        # for its whole open/mutate/replace) cannot recreate the directory we just removed.
        model_cache.invalidate(project_id)
        p_dir = cls.get_project_file_path(project_id).parent
        async with project_write_lock(project_id):
            if p_dir.exists():
                shutil.rmtree(p_dir, ignore_errors=True)
            
        logger.info("Deleted project %s and cleaned up storage.", project_id)
        return True

    @classmethod
    async def refresh_project_metrics(
        cls,
        project_id: str,
        *,
        element_count: Optional[int] = None,
        count_unchanged: bool = False,
    ) -> None:
        """Refresh ``file_size`` / ``element_count`` / ``updated_at`` for a project row.

        STEP-19 / F-023: the project row never moved after a CAD edit, so a 12-element
        model still reported 12 after the user added forty walls. This is the single
        place that writes those three columns - do not add a second
        `UPDATE projects SET element_count` anywhere else.

        Cost (audit 2.2): a full ``IFCService.validate_ifc`` parse per write cost 73 ms on
        a 12-element model and seconds on a 49 MB one, which every gizmo commit paid.
        Callers that already have the model open pass the count instead:

        * ``element_count=N``  - the caller read ``IfcProduct`` from the model it just
          wrote; no parse at all.
        * ``count_unchanged=True`` - the write cannot have added or removed a product
          (a transform, a resize, a storey/material change); the column is left as-is.
        * neither - a real parse. Reserved for import, undo/redo restores and any caller
          that genuinely does not know the count (e.g. ``record_edit`` from an HTTP route).

        The column write still happens under the per-project lock (file_size is read
        there), so a concurrent writer cannot replace `model.ifc` between the stat and
        the UPDATE. A corrupt or unreadable model still updates `file_size`/`updated_at`
        so the user sees that something changed; the parse failure is logged, not raised.
        """
        ifc_path = cls.get_project_file_path(project_id)
        if not ifc_path.exists():
            return

        resolved_count: Optional[int] = None
        if element_count is not None:
            resolved_count = int(element_count)

        async with project_write_lock(project_id):
            if resolved_count is None and not count_unchanged:
                try:
                    metrics = await run_ifc(IFCService.validate_ifc, ifc_path)
                    resolved_count = int(metrics["element_count"])
                except Exception as exc:
                    logger.warning("Could not recompute metrics for project %s: %s", project_id, exc)
                    resolved_count = None

            now = cls._now_iso()
            file_size = ifc_path.stat().st_size
            async with get_db_connection() as db:
                if resolved_count is None:
                    await db.execute(
                        "UPDATE projects SET file_size = ?, updated_at = ? WHERE id = ?",
                        (file_size, now, project_id),
                    )
                else:
                    await db.execute(
                        "UPDATE projects SET file_size = ?, element_count = ?, updated_at = ? WHERE id = ?",
                        (file_size, resolved_count, now, project_id),
                    )
                await db.commit()

    @classmethod
    async def record_edit(
        cls,
        project_id: str,
        user_id: str,
        user_name: str,
        action_type: str,
        express_id: Optional[int],
        entity_type: Optional[str],
        payload: dict,
        *,
        element_count: Optional[int] = None,
        count_unchanged: bool = False,
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
            await db.commit()

        # STEP-19: one writer for the derived project metrics (file_size, element_count,
        # updated_at). Recomputing here keeps the row truthful after a property or
        # placement edit, and means CADService has exactly one function to call too.
        # audit 2.2: an edit that cannot change the product count passes
        # `count_unchanged=True` (or the count it already knows) so the refresh does not
        # re-parse the whole model.
        await cls.refresh_project_metrics(
            project_id, element_count=element_count, count_unchanged=count_unchanged
        )
