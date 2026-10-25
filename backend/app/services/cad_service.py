import hashlib
import shutil
import uuid
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
import numpy as np
import ifcopenshell
import ifcopenshell.api
import ifcopenshell.geom
import ifcopenshell.api.root
import ifcopenshell.api.geometry
import ifcopenshell.api.feature
import ifcopenshell.api.spatial
import ifcopenshell.util.placement
import ifcopenshell.util.element
import ifcopenshell.util.unit

import math
from ..core.database import get_db_connection
from ..models.schemas import (
    CadWallRequest,
    CadSlabRequest,
    CadColumnRequest,
    CadOpeningRequest,
    CadElementResponse,
    CadUndoRedoResponse,
    CadHistoryItem,
    CadHistoryResponse,
    CadCloneRequest,
    CadMoveRequest,
    CadRotateRequest,
    CadMirrorRequest,
    CadArrayRequest,
    CadAlignRequest,
    CadPinRequest,
    CadGeometryUpdateRequest,
    CadAssignStoreyRequest,
    CadMaterialRequest,
)
from .project_service import ProjectService
from .ifc_service import IFCService
from .atomic_store import atomic_copy_file, atomic_write_model, project_write_lock
from ..core.workers import run_ifc

logger = logging.getLogger("ifc_editor.cad_service")


class GeometryNotEditable(Exception):
    """Raised when an element's representation cannot be resized parametrically."""


class CADService:
    #: Actions whose inverse the legacy path cannot reconstruct from `parameters`. Rows written
    #: before snapshots existed (or whose pre-image was pruned) must report "no restorable
    #: pre-image" instead of falling into the create_* branch, which *removes* the element.
    NON_INVERTIBLE_ACTIONS = frozenset({
        "update_geometry", "assign_storey", "assign_material",
        "ai_transform", "ai_update_property", "ai_generate_building",
    })

    # ------------------------------------------------------------------
    # Undo snapshot plumbing (STEP-10)
    #
    # Every model mutation that records a `cad_transactions` row goes through the
    # same triple:
    #
    #     trans_id, pre_snapshot = cls.begin_snapshot(project_id)
    #     atomic_write_model(model, file_path)          # STEP-03 single write path
    #     await cls.record_transaction(project_id, trans_id, ...)
    #
    # STEP-03 note: `model.write(...)` no longer exists anywhere in this service - every
    # write goes through `atomic_store.atomic_write_model` (temp file + fsync + os.replace,
    # cache invalidation, retry on a Windows handle conflict). The pre-image copy still
    # happens immediately before that replace, so undo/redo semantics are unchanged
    # (F-002: two write paths was the defect, not two helper names). Do not add a
    # mutation writer that bypasses it.
    #
    # Snapshot layout: storage/projects/{project_id}/undo/{transaction_id}.ifc
    # (pre-image) and .../undo/post/{transaction_id}.ifc (post-image, captured lazily on
    # undo so redo does not double every commit). Paths are stored in the row's
    # `parameters` JSON under `pre_snapshot` / `post_snapshot`, relative to the
    # project directory, so a moved storage root keeps working.
    #
    # Pre- and post-images have *separate* budgets (STEP-10 open issue: one shared
    # 20-file budget halved the usable undo depth to ~10 actions, because every undone
    # action added a post-image to the same directory). 20 pre-images / 200 MB keeps
    # ~20 actions undoable; post-images get 10 files / 100 MB of their own.
    # Legacy post-images written as `undo/{id}.post.ifc` still resolve and still count
    # against the pre-image budget (they are in the same directory).
    # ------------------------------------------------------------------
    UNDO_SNAPSHOT_ENABLED = True
    UNDO_SNAPSHOT_MAX_FILES = 20
    UNDO_SNAPSHOT_MAX_BYTES = 200 * 1024 * 1024
    UNDO_POST_SUBDIR = "post"
    UNDO_POST_MAX_FILES = 10
    UNDO_POST_MAX_BYTES = 100 * 1024 * 1024

    @staticmethod
    def _try_by_id(model: Any, express_id: Any) -> Optional[Any]:
        """Return the entity, or ``None`` when it is missing.

        ifcopenshell 0.9 raises ``RuntimeError`` from ``by_id`` for a missing express id,
        so `if model.by_id(x):` never guarded anything - it crashed instead (F-007).
        """
        if model is None or express_id is None:
            return None
        try:
            return model.by_id(int(express_id))
        except Exception:
            return None

    @staticmethod
    def _snapshot_dir(project_id: str, *, post: bool = False) -> Path:
        """Per-project undo snapshot directory, next to ``model.ifc``.

        Pre-images live in ``undo/``; redo post-images in ``undo/post/`` so the two
        retention budgets cannot evict each other (STEP-10 open issue).
        """
        base = ProjectService.get_project_file_path(project_id).parent / "undo"
        return base / CADService.UNDO_POST_SUBDIR if post else base

    @staticmethod
    def _file_digest(path: Path) -> str:
        digest = hashlib.sha256()
        with open(path, "rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    @classmethod
    def _take_snapshot(
        cls, project_id: str, transaction_id: str, *, post: bool = False
    ) -> Optional[str]:
        """Copy ``model.ifc`` to ``undo/{transaction_id}.ifc`` (or ``undo/post/...``).

        Must be called *before* the file is replaced. Returns the project-relative path
        (``undo/<name>.ifc`` or ``undo/post/<name>.ifc``) or ``None`` when snapshotting is
        disabled/unavailable.
        """
        file_path = ProjectService.get_project_file_path(project_id)
        if not cls.UNDO_SNAPSHOT_ENABLED or not file_path.exists():
            return None

        target: Optional[Path] = None
        try:
            snapshot_dir = cls._snapshot_dir(project_id, post=post)
            snapshot_dir.mkdir(parents=True, exist_ok=True)
            target = snapshot_dir / f"{transaction_id}.ifc"
            # copyfile, not copy2: the mtime must be "now" so pruning is oldest-first.
            shutil.copyfile(file_path, target)
        except OSError as exc:
            logger.warning("Could not write undo snapshot %s: %s", target, exc)
            return None

        cls._prune_snapshots(project_id, post=post)
        return f"undo/{target.relative_to(cls._snapshot_dir(project_id)).as_posix()}"

    @classmethod
    def _prune_snapshots(cls, project_id: str, *, post: bool = False) -> None:
        """Enforce one budget (oldest evicted first).

        Pre-images: 20 files / 200 MB. Post-images (``undo/post/``): 10 files / 100 MB.
        Each directory is pruned only against its own limits, so a long undo streak
        cannot evict the pre-images that still make older actions undoable.
        """
        if post:
            max_files = cls.UNDO_POST_MAX_FILES
            max_bytes = cls.UNDO_POST_MAX_BYTES
        else:
            max_files = cls.UNDO_SNAPSHOT_MAX_FILES
            max_bytes = cls.UNDO_SNAPSHOT_MAX_BYTES

        snapshot_dir = cls._snapshot_dir(project_id, post=post)
        if not snapshot_dir.is_dir():
            return

        entries: list[tuple[float, int, Path]] = []
        for path in snapshot_dir.glob("*.ifc"):
            if not path.is_file():
                continue
            try:
                stat = path.stat()
            except OSError:
                continue
            entries.append((stat.st_mtime, stat.st_size, path))
        entries.sort(key=lambda entry: (entry[0], entry[2].name))

        total_bytes = sum(size for _mtime, size, _path in entries)
        while entries and (len(entries) > max_files or total_bytes > max_bytes):
            _mtime, size, victim = entries.pop(0)
            try:
                victim.unlink()
            except OSError as exc:
                logger.warning("Could not evict undo snapshot %s: %s", victim, exc)
            total_bytes -= size

    @classmethod
    def _resolve_snapshot_path(cls, project_id: str, stored: Any) -> Optional[Path]:
        """Resolve a stored ``pre_snapshot``/``post_snapshot`` value to an existing file."""
        if not isinstance(stored, str) or not stored.strip():
            return None
        candidate = Path(stored)
        if not candidate.is_absolute():
            candidate = ProjectService.get_project_file_path(project_id).parent / candidate
        return candidate if candidate.is_file() else None

    @staticmethod
    def _parse_parameters(raw: Any) -> dict[str, Any]:
        """Parse a row's ``parameters`` JSON; old/unparseable rows degrade to ``{}``."""
        if not raw:
            return {}
        if isinstance(raw, dict):
            return dict(raw)
        try:
            parsed = json.loads(raw)
        except Exception:
            return {}
        return parsed if isinstance(parsed, dict) else {}

    @classmethod
    def begin_snapshot(cls, project_id: str) -> tuple[str, Optional[str]]:
        """Reserve a transaction id and capture the model as its undo pre-image.

        STEP-02 seam: call this immediately before the write path touches ``model.ifc``
        and pass both results to :meth:`record_transaction`.
        """
        transaction_id = str(uuid.uuid4())
        return transaction_id, cls._take_snapshot(project_id, transaction_id)

    @classmethod
    def discard_snapshot(cls, project_id: str, snapshot_path: Optional[str]) -> None:
        """Delete a pre-image whose mutation failed, so ``undo/`` holds no orphans."""
        resolved = cls._resolve_snapshot_path(project_id, snapshot_path)
        if resolved is None:
            return
        try:
            resolved.unlink()
        except OSError as exc:
            logger.warning("Could not discard undo snapshot %s: %s", resolved, exc)

    @classmethod
    async def record_transaction(
        cls,
        project_id: str,
        transaction_id: str,
        action_type: str,
        express_id: int,
        entity_type: str,
        parameters: Optional[dict[str, Any]] = None,
        pre_snapshot: Optional[str] = None,
    ) -> None:
        """Insert the ACTIVE ``cad_transactions`` row for a committed mutation.

        Only place in the service that inserts CAD transaction rows. ``parameters`` keeps
        the existing per-action keys (``old_matrix``, ``created_ids``, the request dump ...)
        and gains ``pre_snapshot`` / ``post_snapshot``; existing rows therefore still parse
        (``get_history``) and the legacy inverse logic still works for them.
        """
        payload = dict(parameters or {})
        if pre_snapshot:
            payload["pre_snapshot"] = pre_snapshot
        now = datetime.now(timezone.utc).isoformat()
        async with get_db_connection() as db:
            await db.execute(
                """
                INSERT INTO cad_transactions (id, project_id, action_type, express_id, entity_type, parameters, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
                """,
                (transaction_id, project_id, action_type, express_id, entity_type, json.dumps(payload), now)
            )
            await db.commit()

    @staticmethod
    async def _stack_state(db: Any, project_id: str) -> tuple[bool, bool]:
        """``(can_undo, can_redo)`` for a project, computed inside an open connection."""
        c_active = await db.execute(
            "SELECT COUNT(*) FROM cad_transactions WHERE project_id = ? AND status = 'ACTIVE'",
            (project_id,),
        )
        can_undo = (await c_active.fetchone())[0] > 0
        c_undone = await db.execute(
            "SELECT COUNT(*) FROM cad_transactions WHERE project_id = ? AND status = 'UNDONE'",
            (project_id,),
        )
        can_redo = (await c_undone.fetchone())[0] > 0
        return can_undo, can_redo

    @staticmethod
    def _ensure_contexts(model: Any) -> tuple[Any, Any]:
        """Ensure Model 3D Context and Body SubContext exist and return (model3d, body)."""
        model_contexts = [c for c in model.by_type("IfcGeometricRepresentationContext") if getattr(c, "ContextType", None) == "Model"]
        if model_contexts:
            model3d = model_contexts[0]
        else:
            model3d = ifcopenshell.api.run("context.add_context", model, context_type="Model")

        body_contexts = [c for c in model.by_type("IfcGeometricRepresentationSubContext") if getattr(c, "ContextIdentifier", None) == "Body"]
        if body_contexts:
            body = body_contexts[0]
        else:
            body = ifcopenshell.api.run(
                "context.add_context",
                model,
                context_type="Model",
                context_identifier="Body",
                target_view="MODEL_VIEW",
                parent=model3d
            )
        return model3d, body

    @staticmethod
    def _get_target_storey(model: Any, storey_id: Optional[int] = None) -> Any:
        """Find or create target IfcBuildingStorey for element containment."""
        if storey_id is not None:
            storey = model.by_id(storey_id)
            if storey and storey.is_a("IfcBuildingStorey"):
                return storey

        storeys = model.by_type("IfcBuildingStorey")
        if storeys:
            return storeys[0]

        buildings = model.by_type("IfcBuilding")
        building = buildings[0] if buildings else None

        storey = ifcopenshell.api.run(
            "root.create_entity",
            model,
            ifc_class="IfcBuildingStorey",
            name="Ground Floor"
        )
        storey.Elevation = 0.0
        if building:
            ifcopenshell.api.run("aggregate.assign_object", model, relating_object=building, products=[storey])
        return storey

    @staticmethod
    def _storey_datum_units(storey: Any) -> float:
        """Storey datum in project units: its placement Z, else ``IfcBuildingStorey.Elevation``.

        Both are IfcLengthMeasure values in the model's length unit, which is the same frame
        ``get_local_placement`` reports for the host wall, so the two can be compared directly.
        """
        placement = getattr(storey, "ObjectPlacement", None)
        if placement is not None:
            try:
                return float(ifcopenshell.util.placement.get_local_placement(placement)[2, 3])
            except Exception:
                pass
        try:
            return float(storey.Elevation) if storey.Elevation is not None else 0.0
        except Exception:
            return 0.0

    @classmethod
    def _nearest_storey(cls, model: Any, wall: Any) -> Optional[Any]:
        """The ``IfcBuildingStorey`` whose datum is nearest the wall base, or ``None``."""
        storeys = list(model.by_type("IfcBuildingStorey"))
        if not storeys:
            return None
        try:
            wall_base = float(
                ifcopenshell.util.placement.get_local_placement(wall.ObjectPlacement)[2, 3]
            )
        except Exception as exc:
            logger.warning("Could not read the base elevation of wall #%d: %s", wall.id(), exc)
            return None
        return min(storeys, key=lambda storey: abs(cls._storey_datum_units(storey) - wall_base))

    @classmethod
    def _resolve_filling_storey(cls, model: Any, wall: Any) -> Any:
        """Storey a door/window filling created on ``wall`` belongs to.

        STEP-22: the host wall's own storey wins, so a first-floor door is not filed on the
        ground floor. audit 1.6: a wall assigned straight to the ``IfcBuilding`` has no
        storey container, so match the storey nearest the wall base instead of falling back
        to ``storeys[0]`` - wrong whenever the first storey is a basement. Only a model with
        no storeys at all uses the ``_get_target_storey`` fallback (which creates one).
        """
        container: Optional[Any] = None
        try:
            container = ifcopenshell.util.element.get_container(wall)
        except Exception as exc:
            logger.warning("Could not resolve the spatial container of wall #%d: %s", wall.id(), exc)

        if container is not None and container.is_a("IfcBuildingStorey"):
            return container

        nearest = cls._nearest_storey(model, wall)
        if nearest is not None:
            if container is not None and container.is_a("IfcBuilding"):
                logger.info(
                    "Wall #%d is contained in IfcBuilding #%d rather than a storey; filing its "
                    "filling in the nearest storey #%d.", wall.id(), container.id(), nearest.id(),
                )
            else:
                logger.warning(
                    "Host wall #%d has no IfcBuildingStorey container; filing its filling in the "
                    "nearest storey #%d.", wall.id(), nearest.id(),
                )
            return nearest

        logger.warning(
            "Host wall #%d has no storey to file a filling in; falling back to the first "
            "(or a newly created) storey.", wall.id(),
        )
        return cls._get_target_storey(model)

    @staticmethod
    def _create_box_mesh(model: Any, body: Any, dx: float, dy: float, dz: float) -> Any:
        """Helper to create a closed 6-sided box mesh representation.

        Dimensions are **project units**. ifcopenshell's ``add_mesh_representation``
        divides its input by the model unit scale by default (it assumes SI), so
        ``unit_scale=1.0`` is passed explicitly: callers convert metres -> project units
        themselves (``dx / unit_scale``). Without that the conversion happens twice on a
        MILLI model, and creation and resize disagree.
        """
        verts = [
            (0.0, 0.0, 0.0), (dx, 0.0, 0.0), (dx, dy, 0.0), (0.0, dy, 0.0),
            (0.0, 0.0, dz),  (dx, 0.0, dz),  (dx, dy, dz),  (0.0, dy, dz)
        ]
        faces = [
            (0, 3, 2, 1),  # bottom
            (4, 5, 6, 7),  # top
            (0, 1, 5, 4),  # front
            (2, 3, 7, 6),  # back
            (0, 4, 7, 3),  # left
            (1, 2, 6, 5)   # right
        ]
        return ifcopenshell.api.run(
            "geometry.add_mesh_representation",
            model,
            context=body,
            vertices=[verts],
            faces=[faces],
            unit_scale=1.0,
        )

    @classmethod
    async def create_wall(cls, project_id: str, req: CadWallRequest) -> CadElementResponse:
        """Create a parametric 2-point IfcWall."""
        file_path = ProjectService.get_project_file_path(project_id)
        if not file_path.exists():
            raise FileNotFoundError(f"Project file {file_path} not found.")

        def _work() -> dict[str, Any]:
            """Open, mutate, atomically write. Runs on the bounded IFC pool (STEP-04)."""
            model = ifcopenshell.open(str(file_path))
            _, body = cls._ensure_contexts(model)
            storey = cls._get_target_storey(model, req.storey_id)

            wall = ifcopenshell.api.run(
                "root.create_entity",
                model,
                ifc_class="IfcWall",
                name=req.name or "Parametric Wall"
            )

            p1 = (float(req.start[0]), float(req.start[1]))
            p2 = (float(req.end[0]), float(req.end[1]))

            wall_rep = ifcopenshell.api.run(
                "geometry.create_2pt_wall",
                model,
                element=wall,
                context=body,
                p1=p1,
                p2=p2,
                elevation=float(req.elevation),
                height=float(req.height),
                thickness=float(req.thickness)
            )
            # ifcopenshell >= 0.9 returns the representation instead of assigning it, which left
            # every API-created wall with Representation = None (no geometry at all).
            if getattr(wall, "Representation", None) is None:
                ifcopenshell.api.run(
                    "geometry.assign_representation", model, product=wall, representation=wall_rep
                )

            ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey, products=[wall])
            trans_id, pre_snapshot = cls.begin_snapshot(project_id)
            atomic_write_model(model, file_path)
            return {
                "express_id": wall.id(),
                "global_id": wall.GlobalId,
                "name": wall.Name or "Parametric Wall",
                "transaction_id": trans_id,
                "pre_snapshot": pre_snapshot,
                # audit 2.2: the model is open, so the metrics refresh needs no re-parse.
                "element_count": len(model.by_type("IfcProduct")),
            }

        # STEP-03: the lock is taken before the model is opened and held across the whole
        # write, so concurrent edits to this project serialise (no lost updates).
        async with project_write_lock(project_id):
            created = await run_ifc(_work)
            # STEP-19 / audit 2.2: keep the project row (element_count/updated_at) truthful
            # without opening the model again. Inside the lock, so the supplied count still
            # describes the file on disk when the UPDATE lands.
            await ProjectService.refresh_project_metrics(
                project_id, element_count=created["element_count"]
            )

        logger.info("Created IfcWall #%d in project %s", created["express_id"], project_id)

        # Record transaction
        await cls.record_transaction(
            project_id, created["transaction_id"], "create_wall", created["express_id"], "IfcWall",
            req.model_dump(), created["pre_snapshot"],
        )

        return CadElementResponse(
            success=True,
            express_id=created["express_id"],
            global_id=created["global_id"],
            entity_type="IfcWall",
            name=created["name"],
            transaction_id=created["transaction_id"],
            message="Parametric wall created successfully"
        )

    @classmethod
    async def create_slab(cls, project_id: str, req: CadSlabRequest) -> CadElementResponse:
        """Create a parametric IfcSlab."""
        file_path = ProjectService.get_project_file_path(project_id)
        if not file_path.exists():
            raise FileNotFoundError(f"Project file {file_path} not found.")

        def _work() -> dict[str, Any]:
            model = ifcopenshell.open(str(file_path))
            _, body = cls._ensure_contexts(model)
            storey = cls._get_target_storey(model, req.storey_id)
            unit_scale = ifcopenshell.util.unit.calculate_unit_scale(model) or 1.0

            slab = ifcopenshell.api.run(
                "root.create_entity",
                model,
                ifc_class="IfcSlab",
                name=req.name or "Parametric Slab"
            )

            # Compute bounding dimensions from vertices
            xs = [pt[0] for pt in req.boundary]
            ys = [pt[1] for pt in req.boundary]
            min_x, max_x = min(xs), max(xs)
            min_y, max_y = min(ys), max(ys)
            dx = max(max_x - min_x, 1.0)
            dy = max(max_y - min_y, 1.0)
            dz = float(req.thickness)

            # _create_box_mesh takes project units (it pins unit_scale=1.0), so convert
            # metres here exactly like the resize branch does - one convention, both paths.
            rep = cls._create_box_mesh(
                model, body, dx / unit_scale, dy / unit_scale, dz / unit_scale
            )
            ifcopenshell.api.run("geometry.assign_representation", model, product=slab, representation=rep)

            # The placement matrix stays in SI metres - edit_object_placement converts it.
            mat = np.identity(4)
            mat[0, 3] = min_x
            mat[1, 3] = min_y
            mat[2, 3] = float(req.elevation) - dz
            ifcopenshell.api.run("geometry.edit_object_placement", model, product=slab, matrix=mat)

            ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey, products=[slab])
            trans_id, pre_snapshot = cls.begin_snapshot(project_id)
            atomic_write_model(model, file_path)
            return {
                "express_id": slab.id(),
                "global_id": slab.GlobalId,
                "name": slab.Name or "Parametric Slab",
                "transaction_id": trans_id,
                "pre_snapshot": pre_snapshot,
                # audit 2.2: count from the open model instead of a second parse.
                "element_count": len(model.by_type("IfcProduct")),
            }

        async with project_write_lock(project_id):
            created = await run_ifc(_work)
            # STEP-19 / audit 2.2: no re-parse; the count came from the model just written.
            await ProjectService.refresh_project_metrics(
                project_id, element_count=created["element_count"]
            )

        logger.info("Created IfcSlab #%d in project %s", created["express_id"], project_id)

        await cls.record_transaction(
            project_id, created["transaction_id"], "create_slab", created["express_id"], "IfcSlab",
            req.model_dump(), created["pre_snapshot"],
        )

        return CadElementResponse(
            success=True,
            express_id=created["express_id"],
            global_id=created["global_id"],
            entity_type="IfcSlab",
            name=created["name"],
            transaction_id=created["transaction_id"],
            message="Parametric slab created successfully"
        )

    @classmethod
    async def create_column(cls, project_id: str, req: CadColumnRequest) -> CadElementResponse:
        """Create a parametric vertical IfcColumn."""
        file_path = ProjectService.get_project_file_path(project_id)
        if not file_path.exists():
            raise FileNotFoundError(f"Project file {file_path} not found.")

        def _work() -> dict[str, Any]:
            model = ifcopenshell.open(str(file_path))
            _, body = cls._ensure_contexts(model)
            storey = cls._get_target_storey(model, req.storey_id)
            unit_scale = ifcopenshell.util.unit.calculate_unit_scale(model) or 1.0

            column = ifcopenshell.api.run(
                "root.create_entity",
                model,
                ifc_class="IfcColumn",
                name=req.name or "Parametric Column"
            )

            dx = float(req.width)
            dy = float(req.depth)
            dz = float(req.height)

            # _create_box_mesh takes project units (it pins unit_scale=1.0), so convert
            # metres here exactly like the resize branch does - one convention, both paths.
            rep = cls._create_box_mesh(
                model, body, dx / unit_scale, dy / unit_scale, dz / unit_scale
            )
            ifcopenshell.api.run("geometry.assign_representation", model, product=column, representation=rep)

            # The placement matrix stays in SI metres - edit_object_placement converts it,
            # so the offsets below must not be divided by unit_scale as well.
            mat = np.identity(4)
            mat[0, 3] = float(req.position[0]) - (dx / 2.0)
            mat[1, 3] = float(req.position[1]) - (dy / 2.0)
            mat[2, 3] = float(req.elevation)
            ifcopenshell.api.run("geometry.edit_object_placement", model, product=column, matrix=mat)

            ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey, products=[column])
            trans_id, pre_snapshot = cls.begin_snapshot(project_id)
            atomic_write_model(model, file_path)
            return {
                "express_id": column.id(),
                "global_id": column.GlobalId,
                "name": column.Name or "Parametric Column",
                "transaction_id": trans_id,
                "pre_snapshot": pre_snapshot,
                # audit 2.2: count from the open model instead of a second parse.
                "element_count": len(model.by_type("IfcProduct")),
            }

        async with project_write_lock(project_id):
            created = await run_ifc(_work)
            # STEP-19 / audit 2.2: no re-parse; the count came from the model just written.
            await ProjectService.refresh_project_metrics(
                project_id, element_count=created["element_count"]
            )

        logger.info("Created IfcColumn #%d in project %s", created["express_id"], project_id)

        await cls.record_transaction(
            project_id, created["transaction_id"], "create_column", created["express_id"], "IfcColumn",
            req.model_dump(), created["pre_snapshot"],
        )

        return CadElementResponse(
            success=True,
            express_id=created["express_id"],
            global_id=created["global_id"],
            entity_type="IfcColumn",
            name=created["name"],
            transaction_id=created["transaction_id"],
            message="Parametric column created successfully"
        )

    @classmethod
    async def create_opening(cls, project_id: str, req: CadOpeningRequest) -> CadElementResponse:
        """
        Create an IfcOpeningElement boolean void in a host IfcWall,
        and insert a filling element (IfcDoor or IfcWindow).
        """
        file_path = ProjectService.get_project_file_path(project_id)
        if not file_path.exists():
            raise FileNotFoundError(f"Project file {file_path} not found.")

        def _work() -> dict[str, Any]:
            model = ifcopenshell.open(str(file_path))
            _, body = cls._ensure_contexts(model)

            wall = model.by_id(req.host_wall_id)
            if not wall or not wall.is_a("IfcWall"):
                raise ValueError(f"Host wall #{req.host_wall_id} not found in model.")

            # The filling belongs in the host wall's storey, not in the first storey of the model
            # (STEP-22), and a wall assigned straight to the building resolves to the nearest
            # storey by elevation rather than storeys[0] (audit 1.6).
            storey = cls._resolve_filling_storey(model, wall)

            # Retrieve wall placement
            try:
                wall_mat = ifcopenshell.util.placement.get_local_placement(wall.ObjectPlacement)
            except Exception:
                wall_mat = np.identity(4)

            is_door = req.opening_type.lower() == "door"
            op_thickness = float(req.thickness) if req.thickness else 0.40
            fill_thickness = 0.06 if is_door else 0.08

            # 1. Create Opening Element
            opening = ifcopenshell.api.run(
                "root.create_entity",
                model,
                ifc_class="IfcOpeningElement",
                name=f"Opening #{wall.id()}"
            )
            op_rep = ifcopenshell.api.run(
                "geometry.add_wall_representation",
                model,
                context=body,
                length=float(req.width),
                height=float(req.height),
                thickness=op_thickness
            )
            ifcopenshell.api.run("geometry.assign_representation", model, product=opening, representation=op_rep)

            # Position opening relative to host wall
            mat_op = np.copy(wall_mat)
            mat_op[:3, 3] += (
                wall_mat[:3, 0] * float(req.offset_along_wall)
                - wall_mat[:3, 1] * 0.05
                + np.array([0.0, 0.0, float(req.sill_height)])
            )
            ifcopenshell.api.run("geometry.edit_object_placement", model, product=opening, matrix=mat_op)
            ifcopenshell.api.run("feature.add_feature", model, feature=opening, element=wall)

            # 2. Create Filling Element (Door or Window)
            fill_class = "IfcDoor" if is_door else "IfcWindow"
            filling_name = req.name or (f"Door on Wall #{wall.id()}" if is_door else f"Window on Wall #{wall.id()}")
            filling = ifcopenshell.api.run(
                "root.create_entity",
                model,
                ifc_class=fill_class,
                name=filling_name
            )
            fill_rep = ifcopenshell.api.run(
                "geometry.add_wall_representation",
                model,
                context=body,
                length=float(req.width) * 0.98,
                height=float(req.height) * 0.98,
                thickness=fill_thickness
            )
            ifcopenshell.api.run("geometry.assign_representation", model, product=filling, representation=fill_rep)

            mat_fill = np.copy(mat_op)
            mat_fill[:3, 3] += wall_mat[:3, 1] * 0.06
            ifcopenshell.api.run("geometry.edit_object_placement", model, product=filling, matrix=mat_fill)
            ifcopenshell.api.run("feature.add_filling", model, opening=opening, element=filling)
            ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey, products=[filling])

            trans_id, pre_snapshot = cls.begin_snapshot(project_id)
            atomic_write_model(model, file_path)
            return {
                "express_id": filling.id(),
                "global_id": filling.GlobalId,
                "name": filling_name,
                "opening_id": opening.id(),
                "fill_class": fill_class,
                "transaction_id": trans_id,
                "pre_snapshot": pre_snapshot,
                # audit 2.2: opening + filling were just created; count from the open model.
                "element_count": len(model.by_type("IfcProduct")),
            }

        async with project_write_lock(project_id):
            created = await run_ifc(_work)
            # STEP-19 / audit 2.2: no re-parse; the count came from the model just written.
            await ProjectService.refresh_project_metrics(
                project_id, element_count=created["element_count"]
            )

        fill_class = created["fill_class"]
        logger.info(
            "Created %s #%d with Opening #%d in project %s",
            fill_class, created["express_id"], created["opening_id"], project_id,
        )

        params = req.model_dump()
        params["opening_id"] = created["opening_id"]

        await cls.record_transaction(
            project_id, created["transaction_id"], f"create_{req.opening_type.lower()}",
            created["express_id"], fill_class, params, created["pre_snapshot"],
        )

        return CadElementResponse(
            success=True,
            express_id=created["express_id"],
            global_id=created["global_id"],
            entity_type=fill_class,
            name=created["name"],
            transaction_id=created["transaction_id"],
            opening_express_id=created["opening_id"],
            message=f"{fill_class} with void cutout created successfully"
        )

    @classmethod
    def _apply_legacy_undo(
        cls, file_path: Path, action_type: str, express_id: int, params: dict[str, Any]
    ) -> bool:
        """Best-effort inverse for rows written before snapshots existed (no ``pre_snapshot``).

        Returns True only when the model file was actually rewritten; anything it cannot
        invert (notably ``delete_element``) returns False so undo reports failure instead of
        lying, and a missing entity is a ``None`` rather than the RuntimeError that used to
        turn Ctrl+Z into an HTTP 500.
        """
        if action_type in cls.NON_INVERTIBLE_ACTIONS:
            # audit 5.8: a resize / storey / material / AI write has no parameter-level
            # inverse here, and the generic branch below would delete the element.
            logger.warning(
                "Cannot invert %s for #%d without a pre-image snapshot", action_type, express_id
            )
            return False

        try:
            model = ifcopenshell.open(str(file_path))
        except Exception as exc:
            logger.warning("Legacy undo could not open %s: %s", file_path, exc)
            return False

        entity = cls._try_by_id(model, express_id)

        def _remove(target: Any) -> bool:
            if target is None:
                return False
            try:
                ifcopenshell.api.run("root.remove_product", model, product=target)
            except Exception:
                try:
                    model.remove(target)
                except Exception:
                    return False
            return True

        if action_type in ("move_element", "rotate_element", "align_element") or (
            action_type == "mirror_element" and not params.get("is_copy", False)
        ):
            if entity is None or "old_matrix" not in params:
                return False
            ifcopenshell.api.run(
                "geometry.edit_object_placement",
                model, product=entity, matrix=np.array(params["old_matrix"]),
            )
            atomic_write_model(model, file_path)
            logger.info("Undone %s for #%d: restored placement matrix", action_type, express_id)
            return True

        if action_type == "array_element":
            removed_any = False
            for cid in params.get("created_ids") or []:
                if _remove(cls._try_by_id(model, cid)):
                    removed_any = True
            if not removed_any:
                return False
            atomic_write_model(model, file_path)
            logger.info("Undone array_element: removed %s", params.get("created_ids") or [])
            return True

        if action_type == "clone_element" or (
            action_type == "mirror_element" and params.get("is_copy", False)
        ):
            if not _remove(entity):
                return False
            atomic_write_model(model, file_path)
            logger.info("Undone clone/mirror #%d", express_id)
            return True

        if action_type == "delete_element":
            # Nothing to rebuild without the pre-image; never pretend otherwise.
            return False

        # create_* and anything else additive: the action added the entity, so drop it again.
        opening = cls._try_by_id(model, params.get("opening_id")) if params.get("opening_id") else None
        if opening is not None:
            _remove(opening)
        if not _remove(entity):
            return False
        atomic_write_model(model, file_path)
        logger.info("Undone %s #%d", action_type, express_id)
        return True

    @classmethod
    def _apply_matrix_redo(
        cls, file_path: Path, express_id: int, new_matrix: Any
    ) -> bool:
        """Legacy redo: re-apply a stored placement matrix atomically (IFC pool)."""
        model = ifcopenshell.open(str(file_path))
        entity = cls._try_by_id(model, express_id)
        if entity is None:
            return False
        ifcopenshell.api.run(
            "geometry.edit_object_placement", model, product=entity, matrix=np.array(new_matrix)
        )
        atomic_write_model(model, file_path)
        return True

    @classmethod
    def _restore_pre_image(
        cls, project_id: str, transaction_id: str, pre_snapshot: Path, file_path: Path
    ) -> tuple[Optional[str], bool]:
        """Put ``pre_snapshot`` back as the model, keeping the current bytes as a post-image.

        Runs on the IFC thread pool: a 50 MB copy plus two SHA-256 digests is not something
        the event loop should do. ``atomic_copy_file`` renames the snapshot into place, so a
        crash mid-restore cannot truncate the model, and it drops the STEP-04 cache entry.
        """
        post_snapshot = cls._take_snapshot(project_id, transaction_id, post=True)
        digest_before = cls._file_digest(file_path)
        atomic_copy_file(pre_snapshot, file_path)
        changed = cls._file_digest(file_path) != digest_before
        return post_snapshot, changed

    @classmethod
    def _restore_post_image(cls, post_snapshot: Path, file_path: Path) -> bool:
        """Re-apply a redo post-image atomically. Returns True when the bytes changed."""
        digest_before = cls._file_digest(file_path)
        atomic_copy_file(post_snapshot, file_path)
        return cls._file_digest(file_path) != digest_before

    @classmethod
    async def undo(cls, project_id: str) -> CadUndoRedoResponse:
        """Undo the most recent ACTIVE transaction by restoring its pre-image snapshot.

        Restoring the file (rather than inverting the action) is what preserves express ids,
        which BCF viewpoints, pins, measurements and the audit log all reference.

        Never raises for a missing entity or a missing snapshot: an undo that cannot change
        the model answers ``success=False`` with HTTP 200 so the client's undo stack can
        never wedge on the same crashing row (F-007).
        """
        file_path = ProjectService.get_project_file_path(project_id)
        async with get_db_connection() as db:
            cursor = await db.execute(
                """
                SELECT id, action_type, express_id, entity_type, parameters
                FROM cad_transactions
                WHERE project_id = ? AND status = 'ACTIVE'
                ORDER BY created_at DESC, rowid DESC LIMIT 1
                """,
                (project_id,)
            )
            row = await cursor.fetchone()
            if not row:
                can_undo, can_redo = await cls._stack_state(db, project_id)
                return CadUndoRedoResponse(
                    success=False,
                    transaction_id="",
                    action="none",
                    affected_express_id=0,
                    can_undo=can_undo,
                    can_redo=can_redo,
                    message="No active transactions to undo"
                )

            trans_id = row["id"]
            action_type = row["action_type"]
            express_id = int(row["express_id"] or 0)
            params = cls._parse_parameters(row["parameters"])

            if not file_path.exists():
                can_undo, can_redo = await cls._stack_state(db, project_id)
                return CadUndoRedoResponse(
                    success=False,
                    transaction_id=trans_id,
                    action=action_type,
                    affected_express_id=express_id,
                    can_undo=can_undo,
                    can_redo=can_redo,
                    message=f"Cannot undo {action_type}: the project model file is missing"
                )

            pre_snapshot = cls._resolve_snapshot_path(project_id, params.get("pre_snapshot"))
            post_snapshot: Optional[str] = None
            changed = False
            failure: Optional[str] = None

            if pre_snapshot is not None:
                # Keep the state we are leaving behind as this action's post-image, then
                # swap the pre-image in — both on the IFC pool, under the project lock the
                # route holds (STEP-03/STEP-04).
                post_snapshot, changed = await run_ifc(
                    cls._restore_pre_image, project_id, trans_id, pre_snapshot, file_path
                )
                if changed:
                    if post_snapshot:
                        params["post_snapshot"] = post_snapshot
                    logger.info(
                        "Undone %s for #%d: restored snapshot %s", action_type, express_id, pre_snapshot.name
                    )
                else:
                    # A no-op must not claim success, and must not consume the row.
                    if post_snapshot:
                        cls.discard_snapshot(project_id, post_snapshot)
                    failure = f"Undo of {action_type} made no change to the model"
                    logger.warning(
                        "Undo of %s for #%d restored an identical model; nothing changed",
                        action_type, express_id,
                    )
            else:
                # Row written before snapshots existed (or its snapshot was pruned).
                changed = await run_ifc(
                    cls._apply_legacy_undo, file_path, action_type, express_id, params
                )
                if not changed:
                    failure = (
                        f"Cannot undo {action_type} for #{express_id}: no restorable pre-image "
                        f"for transaction {trans_id}"
                    )
                    logger.warning("Undo of %s for #%d has no usable pre-image", action_type, express_id)

            if changed:
                await db.execute(
                    "UPDATE cad_transactions SET status = 'UNDONE', parameters = ? WHERE id = ?",
                    (json.dumps(params), trans_id)
                )
                await db.commit()
                # STEP-19: the model changed, so the project row must follow it.
                await ProjectService.refresh_project_metrics(project_id)

            can_undo, can_redo = await cls._stack_state(db, project_id)

            if not changed:
                return CadUndoRedoResponse(
                    success=False,
                    transaction_id=trans_id,
                    action=action_type,
                    affected_express_id=express_id,
                    can_undo=can_undo,
                    can_redo=can_redo,
                    message=failure or f"Nothing to undo for {action_type}",
                )

        return CadUndoRedoResponse(
            success=True,
            transaction_id=trans_id,
            action=action_type,
            affected_express_id=express_id,
            can_undo=can_undo,
            can_redo=can_redo,
            message=f"Successfully undone {action_type} for #{express_id}"
        )

    @classmethod
    async def redo(cls, project_id: str) -> CadUndoRedoResponse:
        """Redo the most recently UNDONE transaction by restoring its post-image snapshot.

        Rows written before snapshots existed fall back to the legacy re-synthesize path.
        Redo never creates a second ACTIVE row for the same action (Spec 5).
        """
        file_path = ProjectService.get_project_file_path(project_id)
        async with get_db_connection() as db:
            cursor = await db.execute(
                """
                SELECT id, action_type, express_id, entity_type, parameters
                FROM cad_transactions
                WHERE project_id = ? AND status = 'UNDONE'
                ORDER BY created_at DESC, rowid DESC LIMIT 1
                """,
                (project_id,)
            )
            row = await cursor.fetchone()
            if not row:
                can_undo, can_redo = await cls._stack_state(db, project_id)
                return CadUndoRedoResponse(
                    success=False,
                    transaction_id="",
                    action="none",
                    affected_express_id=0,
                    can_undo=can_undo,
                    can_redo=can_redo,
                    message="No undone transactions to redo"
                )

            trans_id = row["id"]
            action_type = row["action_type"]
            express_id = int(row["express_id"] or 0)
            params = cls._parse_parameters(row["parameters"])

        post_snapshot = cls._resolve_snapshot_path(project_id, params.get("post_snapshot"))
        if post_snapshot is not None and file_path.exists():
            changed = await run_ifc(cls._restore_post_image, post_snapshot, file_path)
            async with get_db_connection() as db:
                if changed:
                    # Same row, back to ACTIVE: one action, one row (Spec 5).
                    await db.execute("UPDATE cad_transactions SET status = 'ACTIVE' WHERE id = ?", (trans_id,))
                    await db.commit()
                    # STEP-19: restored post-image changes the model on disk.
                    await ProjectService.refresh_project_metrics(project_id)
                can_undo, can_redo = await cls._stack_state(db, project_id)
            if not changed:
                return CadUndoRedoResponse(
                    success=False,
                    transaction_id=trans_id,
                    action=action_type,
                    affected_express_id=express_id,
                    can_undo=can_undo,
                    can_redo=can_redo,
                    message=f"Redo of {action_type} made no change to the model",
                )
            logger.info("Redone %s for #%d: restored snapshot %s", action_type, express_id, post_snapshot.name)
            return CadUndoRedoResponse(
                success=True,
                transaction_id=trans_id,
                action=action_type,
                affected_express_id=express_id,
                can_undo=can_undo,
                can_redo=can_redo,
                message=f"Successfully redone {action_type} for #{express_id}",
            )

        # ---- Legacy path: rows without a post-image (pre-snapshot installs) ----
        params.pop("pre_snapshot", None)
        params.pop("post_snapshot", None)
        new_res: Optional[CadElementResponse] = None
        applied = False
        affected_id = express_id

        if action_type in ("move_element", "rotate_element", "align_element") or (action_type == "mirror_element" and not params.get("is_copy", False)):
            if file_path.exists() and "new_matrix" in params:
                applied = await run_ifc(
                    cls._apply_matrix_redo, file_path, express_id, params["new_matrix"]
                )
                if applied:
                    logger.info("Redone %s for #%d: applied new placement matrix", action_type, express_id)
            async with get_db_connection() as db:
                if applied:
                    await db.execute("UPDATE cad_transactions SET status = 'ACTIVE' WHERE id = ?", (trans_id,))
                    await db.commit()
                    # STEP-19: legacy redo re-applied a placement; refresh the metrics.
                    await ProjectService.refresh_project_metrics(project_id)
        else:
            try:
                if action_type == "create_wall":
                    req_wall = CadWallRequest(**params)
                    new_res = await cls.create_wall(project_id, req_wall)
                elif action_type == "create_slab":
                    req_slab = CadSlabRequest(**params)
                    new_res = await cls.create_slab(project_id, req_slab)
                elif action_type == "create_column":
                    req_col = CadColumnRequest(**params)
                    new_res = await cls.create_column(project_id, req_col)
                elif action_type in ("create_door", "create_window"):
                    req_op = CadOpeningRequest(**params)
                    new_res = await cls.create_opening(project_id, req_op)
                elif action_type == "clone_element":
                    req_clone = CadCloneRequest(**params)
                    new_res = await cls.clone_element(project_id, express_id, req_clone)
                elif action_type == "array_element":
                    req_arr = CadArrayRequest(count=params["count"], delta=params["delta"])
                    arr_res = await cls.array_element(project_id, params["source_express_id"], req_arr)
                    new_res = arr_res[0] if arr_res else None
                elif action_type == "mirror_element" and params.get("is_copy", False):
                    req_mir = CadMirrorRequest(axis=params["axis"], is_copy=True)
                    new_res = await cls.mirror_element(project_id, params["source_express_id"], req_mir)
            except Exception as exc:
                logger.warning("Legacy redo of %s for #%d failed: %s", action_type, express_id, exc)
                new_res = None

            if new_res is not None:
                applied = True
                affected_id = new_res.express_id
                # create_* inserted a new ACTIVE transaction; drop the undone placeholder.
                async with get_db_connection() as db:
                    await db.execute("DELETE FROM cad_transactions WHERE id = ?", (trans_id,))
                    await db.commit()

        async with get_db_connection() as db:
            can_undo, can_redo = await cls._stack_state(db, project_id)

        if not applied:
            return CadUndoRedoResponse(
                success=False,
                transaction_id=trans_id,
                action=action_type,
                affected_express_id=express_id,
                can_undo=can_undo,
                can_redo=can_redo,
                message=f"Cannot redo {action_type} for #{express_id}: no restorable post-image",
            )

        return CadUndoRedoResponse(
            success=True,
            transaction_id=new_res.transaction_id if new_res else trans_id,
            action=action_type,
            affected_express_id=affected_id,
            can_undo=can_undo,
            can_redo=can_redo,
            message=f"Successfully redone {action_type}, element #{affected_id}"
        )

    @classmethod
    async def get_history(cls, project_id: str) -> CadHistoryResponse:
        """Fetch CAD transaction history and stack state."""
        async with get_db_connection() as db:
            cursor = await db.execute(
                """
                SELECT id, action_type, express_id, entity_type, parameters, status, created_at
                FROM cad_transactions
                WHERE project_id = ?
                ORDER BY created_at DESC LIMIT 50
                """,
                (project_id,)
            )
            rows = await cursor.fetchall()

            history: list[CadHistoryItem] = []
            for r in rows:
                try:
                    p = json.loads(r["parameters"])
                except Exception:
                    p = {}
                history.append(CadHistoryItem(
                    id=r["id"],
                    action_type=r["action_type"],
                    express_id=r["express_id"],
                    entity_type=r["entity_type"],
                    parameters=p,
                    status=r["status"],
                    created_at=r["created_at"]
                ))

            c_active = await db.execute("SELECT COUNT(*) FROM cad_transactions WHERE project_id = ? AND status = 'ACTIVE'", (project_id,))
            can_undo = (await c_active.fetchone())[0] > 0
            c_undone = await db.execute("SELECT COUNT(*) FROM cad_transactions WHERE project_id = ? AND status = 'UNDONE'", (project_id,))
            can_redo = (await c_undone.fetchone())[0] > 0

        return CadHistoryResponse(
            history=history,
            can_undo=can_undo,
            can_redo=can_redo
        )

    @classmethod
    async def delete_element(cls, project_id: str, express_id: int) -> dict[str, Any]:
        """Delete an IFC product element from the model and record undoable transaction."""
        file_path = ProjectService.get_project_file_path(project_id)
        if not file_path.exists():
            raise FileNotFoundError(f"Project file {file_path} not found.")

        if await cls.is_element_pinned(project_id, express_id):
            raise ValueError(f"Element #{express_id} is pinned. Unpin (UP) before deleting.")

        def _work() -> dict[str, Any]:
            model = ifcopenshell.open(str(file_path))
            entity = cls._try_by_id(model, express_id)
            if entity is None:
                raise ValueError(f"Entity #{express_id} not found in model.")

            entity_type = entity.is_a()
            entity_name = getattr(entity, "Name", None) or f"{entity_type} #{express_id}"

            # Pre-image must be captured before the first product is removed.
            trans_id, pre_snapshot = cls.begin_snapshot(project_id)

            # If it's a wall with openings/fillings or opening with filling, clean up
            if hasattr(entity, "HasOpenings") and entity.HasOpenings:
                for rel in list(entity.HasOpenings):
                    opening = rel.RelatedOpeningElement
                    if opening:
                        if hasattr(opening, "HasFillings") and opening.HasFillings:
                            for rel_fill in list(opening.HasFillings):
                                fill = getattr(rel_fill, "RelatedBuildingElement", None)
                                if fill:
                                    try:
                                        ifcopenshell.api.run("root.remove_product", model, product=fill)
                                    except Exception:
                                        model.remove(fill)
                        try:
                            ifcopenshell.api.run("root.remove_product", model, product=opening)
                        except Exception:
                            model.remove(opening)

            try:
                ifcopenshell.api.run("root.remove_product", model, product=entity)
            except Exception:
                model.remove(entity)

            atomic_write_model(model, file_path)
            return {
                "entity_type": entity_type,
                "entity_name": entity_name,
                "transaction_id": trans_id,
                "pre_snapshot": pre_snapshot,
                # audit 2.2: the removal count comes from the model being written.
                "element_count": len(model.by_type("IfcProduct")),
            }

        async with project_write_lock(project_id):
            deleted = await run_ifc(_work)
            # STEP-19 / audit 2.2: no re-parse; the count came from the model just written.
            await ProjectService.refresh_project_metrics(
                project_id, element_count=deleted["element_count"]
            )

        logger.info("Deleted %s #%d in project %s", deleted["entity_type"], express_id, project_id)

        await cls.record_transaction(
            project_id, deleted["transaction_id"], "delete_element", express_id,
            deleted["entity_type"], {"name": deleted["entity_name"]}, deleted["pre_snapshot"],
        )

        return {
            "success": True,
            "express_id": express_id,
            "entity_type": deleted["entity_type"],
            "message": f"Successfully deleted {deleted['entity_type']} #{express_id}",
            "transaction_id": deleted["transaction_id"]
        }

    @classmethod
    async def clone_element(cls, project_id: str, express_id: int, req: CadCloneRequest) -> CadElementResponse:
        """Duplicate an IFC element with a translation delta offset."""
        file_path = ProjectService.get_project_file_path(project_id)
        if not file_path.exists():
            raise FileNotFoundError(f"Project file {file_path} not found.")

        def _work() -> dict[str, Any]:
            model = ifcopenshell.open(str(file_path))
            entity = cls._try_by_id(model, express_id)
            if not entity:
                raise ValueError(f"Entity #{express_id} not found in model.")

            entity_type = entity.is_a()
            new_name = f"{getattr(entity, 'Name', '') or entity_type} (Copy)"
            _, body = cls._ensure_contexts(model)
            storey = cls._get_target_storey(model, req.storey_id)

            cloned = ifcopenshell.api.run(
                "root.create_entity",
                model,
                ifc_class=entity_type,
                name=new_name
            )

            if hasattr(entity, "Representation") and entity.Representation:
                try:
                    ifcopenshell.api.run(
                        "geometry.assign_representation",
                        model,
                        product=cloned,
                        representation=entity.Representation
                    )
                except Exception:
                    pass

            mat = np.identity(4)
            try:
                mat = ifcopenshell.util.placement.get_local_placement(entity.ObjectPlacement)
            except Exception:
                pass

            mat[0, 3] += float(req.delta[0])
            mat[1, 3] += float(req.delta[1])
            mat[2, 3] += float(req.delta[2])

            ifcopenshell.api.run("geometry.edit_object_placement", model, product=cloned, matrix=mat)
            ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey, products=[cloned])

            trans_id, pre_snapshot = cls.begin_snapshot(project_id)
            atomic_write_model(model, file_path)
            return {
                "express_id": cloned.id(),
                "global_id": cloned.GlobalId,
                "entity_type": entity_type,
                "name": new_name,
                "transaction_id": trans_id,
                "pre_snapshot": pre_snapshot,
                # audit 2.2: one more product; read it from the open model.
                "element_count": len(model.by_type("IfcProduct")),
            }

        async with project_write_lock(project_id):
            created = await run_ifc(_work)
            # STEP-19 / audit 2.2: no re-parse; the count came from the model just written.
            await ProjectService.refresh_project_metrics(
                project_id, element_count=created["element_count"]
            )

        logger.info(
            "Cloned %s #%d to new element #%d", created["entity_type"], express_id, created["express_id"]
        )

        await cls.record_transaction(
            project_id, created["transaction_id"], "clone_element", created["express_id"],
            created["entity_type"], req.model_dump(), created["pre_snapshot"],
        )

        return CadElementResponse(
            success=True,
            express_id=created["express_id"],
            global_id=created["global_id"],
            entity_type=created["entity_type"],
            name=created["name"],
            transaction_id=created["transaction_id"],
            message=f"Element #{express_id} duplicated successfully as #{created['express_id']}"
        )

    # ------------------------------------------------------------------
    # Parametric resize helpers (STEP-21)
    # ------------------------------------------------------------------
    @staticmethod
    def _find_body_extruded_solid(entity: Any) -> Optional[tuple[Any, Any]]:
        """Return ``(solid, representation)`` when the Body is one IfcExtrudedAreaSolid."""
        representation = getattr(entity, "Representation", None)
        if representation is None:
            return None
        for rep in getattr(representation, "Representations", None) or []:
            if getattr(rep, "RepresentationIdentifier", None) != "Body":
                continue
            items = list(getattr(rep, "Items", None) or [])
            if len(items) != 1 or not items[0].is_a("IfcExtrudedAreaSolid"):
                return None
            return items[0], rep
        return None

    @staticmethod
    def _profile_thickness_units(solid: Any) -> Optional[float]:
        """Thickness of a swept profile expressed in project units, or None if unknown."""
        profile = getattr(solid, "SweptArea", None)
        if profile is None:
            return None
        if profile.is_a("IfcRectangleProfileDef"):
            return float(profile.YDim)
        curve = getattr(profile, "OuterCurve", None)
        if curve is not None and curve.is_a("IfcIndexedPolyCurve"):
            coords = curve.Points.CoordList
            if not coords:
                return None
            ys = [float(point[1]) for point in coords]
            return max(ys) - min(ys)
        return None

    @staticmethod
    def _body_representation_items(entity: Any) -> list[Any]:
        """All items of every Body representation on ``entity``."""
        items: list[Any] = []
        for rep in (getattr(getattr(entity, "Representation", None), "Representations", None) or []):
            if getattr(rep, "RepresentationIdentifier", None) != "Body":
                continue
            items.extend(list(getattr(rep, "Items", None) or []))
        return items

    @classmethod
    def _representation_coord_spans(cls, entity: Any) -> Optional[tuple[float, float, float]]:
        """(X, Y, Z) spans of a single-item Body, in *project units*.

        Reads the stored representation rather than a tessellation so an omitted dimension
        can be reused exactly (a 0.4 m column stays 0.4 m, not 0.39999...).
        """
        items = cls._body_representation_items(entity)
        if len(items) != 1:
            return None
        item = items[0]

        if item.is_a("IfcExtrudedAreaSolid"):
            profile = getattr(item, "SweptArea", None)
            depth = getattr(item, "Depth", None)
            if profile is None or depth is None:
                return None
            direction = getattr(item, "ExtrudedDirection", None)
            ratios = tuple(round(float(v), 6) for v in getattr(direction, "DirectionRatios", ()))
            if ratios != (0.0, 0.0, 1.0):
                # The Z span of a skewed extrusion is not its Depth.
                return None
            if profile.is_a("IfcRectangleProfileDef"):
                spans = (float(profile.XDim), float(profile.YDim), float(depth))
            elif getattr(profile, "OuterCurve", None) is not None and profile.OuterCurve.is_a(
                "IfcIndexedPolyCurve"
            ):
                points = list(profile.OuterCurve.Points.CoordList or [])
                if not points:
                    return None
                xs = [float(p[0]) for p in points]
                ys = [float(p[1]) for p in points]
                spans = (max(xs) - min(xs), max(ys) - min(ys), float(depth))
            else:
                return None
            return spans if all(span > 0 for span in spans) else None

        # Mesh bodies (what _create_box_mesh writes): local coordinates in project units.
        container = getattr(item, "Coordinates", None)
        coords = list(getattr(container, "CoordList", None) or [])
        if not coords:
            return None
        xs = [float(c[0]) for c in coords]
        ys = [float(c[1]) for c in coords]
        zs = [float(c[2]) for c in coords]
        spans = (max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs))
        return spans if all(span > 0 for span in spans) else None

    @classmethod
    def _body_extents_metres(
        cls, entity: Any, unit_scale: float = 1.0
    ) -> Optional[tuple[float, float, float]]:
        """Current (width, depth, height) of an element's Body in metres, or ``None``.

        Used to preserve the dimensions of a partial column resize. Project-unit
        coordinates are scaled by ``unit_scale``; the tessellation fallback is already in
        SI metres and is requested in local coordinates, so an element placement cannot
        inflate the measured extents.
        """
        scale = float(unit_scale) if unit_scale else 1.0
        if scale <= 0:
            return None

        spans = cls._representation_coord_spans(entity)
        if spans is not None:
            return tuple(span * scale for span in spans)  # type: ignore[return-value]

        items = cls._body_representation_items(entity)
        if len(items) != 1:
            return None
        try:
            settings = ifcopenshell.geom.settings()
            settings.set("use-world-coords", False)
            shape = ifcopenshell.geom.create_shape(settings, entity)
            verts = np.asarray(shape.geometry.verts, dtype=float)
        except Exception as exc:
            logger.warning(
                "Could not measure Body extents of %s: %s",
                getattr(entity, "is_a", lambda: "entity")(), exc,
            )
            return None
        if verts.size == 0:
            return None
        points = verts.reshape(-1, 3)
        measured = tuple(
            float(points[:, axis].max() - points[:, axis].min()) for axis in range(3)
        )
        return measured if all(span > 0 for span in measured) else None  # type: ignore[return-value]

    @classmethod
    def _resize_extruded_solid(
        cls,
        solid: Any,
        *,
        new_height: Optional[float] = None,
        new_thickness: Optional[float] = None,
        unit_scale: float = 1.0,
    ) -> None:
        """Resize ``solid`` in place. Validates every requested dimension before assigning."""
        scale = float(unit_scale) if unit_scale else 1.0
        if scale <= 0:
            raise GeometryNotEditable(f"invalid model unit scale {unit_scale!r}")

        depth = None
        y_dim = None
        coords = None

        if new_height is not None:
            height = float(new_height)
            if height <= 0:
                raise GeometryNotEditable(f"height must be positive (got {height})")
            ratios = tuple(round(float(v), 6) for v in solid.ExtrudedDirection.DirectionRatios)
            if ratios != (0.0, 0.0, 1.0):
                raise GeometryNotEditable(
                    f"extrusion is not vertical (direction {ratios}); only Z-extruded solids can be resized"
                )
            depth = height / scale

        if new_thickness is not None:
            thickness = float(new_thickness)
            if thickness <= 0:
                raise GeometryNotEditable(f"thickness must be positive (got {thickness})")
            profile = getattr(solid, "SweptArea", None)
            if profile is None:
                raise GeometryNotEditable("swept solid has no profile")
            if profile.is_a("IfcRectangleProfileDef"):
                y_dim = thickness / scale
            elif profile.is_a("IfcArbitraryClosedProfileDef") and profile.OuterCurve.is_a(
                "IfcIndexedPolyCurve"
            ):
                current = profile.OuterCurve.Points.CoordList
                if not current:
                    raise GeometryNotEditable("profile has no outline coordinates")
                ys = [float(point[1]) for point in current]
                y_min, y_max = min(ys), max(ys)
                if y_max - y_min <= 0:
                    raise GeometryNotEditable("profile has no thickness")
                ratio = (thickness / scale) / (y_max - y_min)
                coords = tuple(
                    (float(point[0]), y_min + (float(point[1]) - y_min) * ratio)
                    for point in current
                )
            else:
                raise GeometryNotEditable(
                    f"profile {profile.is_a()} is not resizable by thickness"
                )

        # Everything validated: now mutate.
        if depth is not None:
            solid.Depth = depth
        if y_dim is not None:
            solid.SweptArea.YDim = y_dim
        if coords is not None:
            solid.SweptArea.OuterCurve.Points.CoordList = coords

    @staticmethod
    def _replace_body_representation(model: Any, entity: Any, new_rep: Any) -> None:
        """Replace the Body representation instead of appending a second one.

        ifcopenshell 0.9 ``geometry.assign_representation`` appends to an existing
        IfcProductDefinitionShape, so a rebuilt mesh silently kept the old (first) body.
        """
        pds = getattr(entity, "Representation", None)
        if pds is not None and pds.is_a("IfcProductDefinitionShape"):
            kept = [
                rep
                for rep in pds.Representations
                if getattr(rep, "RepresentationIdentifier", None) != "Body"
            ]
            pds.Representations = tuple(kept + [new_rep])
            return
        ifcopenshell.api.run(
            "geometry.assign_representation", model, product=entity, representation=new_rep
        )

    @classmethod
    def _verify_persisted_geometry(
        cls,
        file_path: Path,
        express_id: int,
        *,
        new_height: Optional[float] = None,
        new_thickness: Optional[float] = None,
        box_extents: Optional[tuple[float, float, float]] = None,
        unit_scale: float = 1.0,
    ) -> None:
        """Re-read the written model and refuse to report success for a no-op."""
        model = ifcopenshell.open(str(file_path))
        entity = model.by_id(express_id)
        scale = float(unit_scale) if unit_scale else 1.0

        if box_extents is not None:
            entity_rep = getattr(entity, "Representation", None)
            body_items = [
                item
                for rep in (getattr(entity_rep, "Representations", None) or [])
                if getattr(rep, "RepresentationIdentifier", None) == "Body"
                for item in (getattr(rep, "Items", None) or [])
            ]
            if entity is None or len(body_items) != 1:
                raise RuntimeError(
                    f"geometry did not persist: #{express_id} has {len(body_items)} body items"
                )
            coords = getattr(getattr(body_items[0], "Coordinates", None), "CoordList", None)
            if coords:
                for axis, label in enumerate(("width", "depth", "height")):
                    span = (
                        max(float(c[axis]) for c in coords) - min(float(c[axis]) for c in coords)
                    )
                    expected = float(box_extents[axis]) / scale
                    if abs(span - expected) > 1e-6:
                        raise RuntimeError(
                            f"geometry did not persist: body {label} is {span}, expected {expected}"
                        )
            return

        found = cls._find_body_extruded_solid(entity) if entity is not None else None
        if found is None:
            raise RuntimeError(
                f"geometry did not persist: #{express_id} has no single extruded body after write"
            )
        solid, _ = found
        if new_height is not None:
            expected = float(new_height) / scale
            if abs(float(solid.Depth) - expected) > 1e-6:
                raise RuntimeError(
                    f"geometry did not persist: Depth is {solid.Depth}, expected {expected}"
                )
        if new_thickness is not None:
            expected = float(new_thickness) / scale
            actual = cls._profile_thickness_units(solid)
            if actual is None or abs(actual - expected) > 1e-6:
                raise RuntimeError(
                    f"geometry did not persist: profile thickness is {actual}, expected {expected}"
                )

    #: Opening geometry tolerance, in metres (0.1 mm). Below it a clamp is not worth a model
    #: write, and a void that starts *above* the new wall top cannot be clamped at all.
    OPENING_TOLERANCE_M = 1e-4

    @classmethod
    def _clamp_openings_to_wall(
        cls,
        wall: Any,
        *,
        new_height: Optional[float],
        new_thickness: Optional[float],
        unit_scale: float,
    ) -> list[str]:
        """Keep every void in ``wall`` inside the resized wall (audit 1.4).

        A host resize edited the wall extrusion only: shortening a wall below a door left a
        void sticking out of the wall top, and thinning a wall left the void wider than the
        wall - both invalid IFC and wrong in every schedule, cut and export.

        Best-effort by design: each opening is clamped on its own, every failure becomes a
        human-readable warning in the response, and *no* opening failure may fail the resize
        (the wall edit is already the user's decision). Returns the warning strings.
        """
        warnings: list[str] = []
        if new_height is None and new_thickness is None:
            return warnings

        scale = float(unit_scale) if unit_scale else 1.0

        def metres(value_units: Any) -> float:
            return float(value_units) * scale

        try:
            relations = list(getattr(wall, "HasOpenings", None) or [])
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Could not inspect the openings of wall #%d: %s", wall.id(), exc)
            return [f"Could not inspect the openings of wall #{wall.id()}: {exc}"]

        if not relations:
            return warnings

        wall_base_m: Optional[float] = None
        if new_height is not None:
            try:
                wall_base_m = metres(
                    ifcopenshell.util.placement.get_local_placement(wall.ObjectPlacement)[2, 3]
                )
            except Exception as exc:
                warnings.append(
                    f"Could not measure the base of wall #{wall.id()} ({exc}); "
                    "its openings were not revalidated."
                )

        wall_top_m = (
            wall_base_m + float(new_height)
            if wall_base_m is not None and new_height is not None
            else None
        )

        for rel in relations:
            opening = getattr(rel, "RelatedOpeningElement", None)
            if opening is None:
                continue
            label = f"Opening #{opening.id()}"

            found = cls._find_body_extruded_solid(opening)
            if found is None:
                warnings.append(
                    f"{label} is not a single extruded void, so it was left unchanged and "
                    "was not revalidated against the resized wall."
                )
                continue
            solid, _rep = found

            if wall_top_m is not None:
                try:
                    base_m = metres(
                        ifcopenshell.util.placement.get_local_placement(opening.ObjectPlacement)[2, 3]
                    )
                    depth_m = metres(solid.Depth)
                    top_m = base_m + depth_m
                    if top_m > wall_top_m + cls.OPENING_TOLERANCE_M:
                        remaining_m = wall_top_m - base_m
                        if remaining_m <= cls.OPENING_TOLERANCE_M:
                            warnings.append(
                                f"{label} starts at {base_m:.3f} m, at or above the new wall top "
                                f"({wall_top_m:.3f} m); it was left unchanged - lower it or "
                                "restore the wall height."
                            )
                        else:
                            cls._resize_extruded_solid(
                                solid, new_height=remaining_m, unit_scale=scale
                            )
                            warnings.append(
                                f"{label} was {depth_m:.3f} m tall from {base_m:.3f} m and would "
                                f"have crossed the {wall_top_m:.3f} m wall top; its height was "
                                f"reduced to {remaining_m:.3f} m."
                            )
                except GeometryNotEditable as exc:
                    warnings.append(
                        f"{label} could not be shortened to fit the resized wall: {exc}"
                    )
                except Exception as exc:  # pragma: no cover - defensive
                    warnings.append(
                        f"{label} could not be revalidated against the resized wall: {exc}"
                    )

            if new_thickness is not None:
                try:
                    thickness_units = cls._profile_thickness_units(solid)
                    if thickness_units is not None:
                        thickness_m = metres(thickness_units)
                        if thickness_m > float(new_thickness) + cls.OPENING_TOLERANCE_M:
                            cls._resize_extruded_solid(
                                solid, new_thickness=float(new_thickness), unit_scale=scale
                            )
                            warnings.append(
                                f"{label} was {thickness_m:.3f} m thick in a wall that is now "
                                f"{float(new_thickness):.3f} m thick; the void was clamped to the "
                                "wall thickness."
                            )
                except GeometryNotEditable as exc:
                    warnings.append(
                        f"{label} could not be narrowed to the new wall thickness: {exc}"
                    )
                except Exception as exc:  # pragma: no cover - defensive
                    warnings.append(
                        f"{label} thickness could not be revalidated against the resized wall: {exc}"
                    )

        return warnings

    @classmethod
    async def update_geometry(cls, project_id: str, express_id: int, req: CadGeometryUpdateRequest) -> dict[str, Any]:
        """Parametrically resize an element's representation, then update its dimensions.

        audit 1.4: after a wall height/thickness change, every void in that wall is clamped
        back inside it, and anything that could not be clamped is reported in
        ``warnings`` instead of failing the resize. audit 5.8: the whole edit is one
        undoable transaction (``begin_snapshot`` before the first write).
        """
        file_path = ProjectService.get_project_file_path(project_id)
        if not file_path.exists():
            raise FileNotFoundError(f"Project file {file_path} not found.")

        def _work() -> dict[str, Any]:
            model = ifcopenshell.open(str(file_path))
            entity = model.by_id(express_id)
            if not entity:
                raise ValueError(f"Entity #{express_id} not found in model.")

            _, body = cls._ensure_contexts(model)
            unit_scale = ifcopenshell.util.unit.calculate_unit_scale(model) or 1.0
            entity_type = entity.is_a()

            is_wall = entity.is_a("IfcWall")
            is_column = entity.is_a("IfcColumn")

            # Reject edits this element cannot express before touching the model at all.
            if is_wall and (req.width is not None or req.depth is not None):
                raise GeometryNotEditable(
                    f"IfcWall #{express_id} supports height/thickness/elevation edits only"
                )
            if not is_wall and not is_column and any(
                value is not None for value in (req.height, req.thickness, req.width, req.depth)
            ):
                raise GeometryNotEditable(
                    f"{entity.is_a()} #{express_id} does not support parametric dimension edits"
                )

            resized_height: Optional[float] = None
            resized_thickness: Optional[float] = None
            resized_box: Optional[tuple[float, float, float]] = None

            if is_wall and (req.height is not None or req.thickness is not None):
                found = cls._find_body_extruded_solid(entity)
                if found is None:
                    raise GeometryNotEditable(
                        f"IfcWall #{express_id} body is not a single IfcExtrudedAreaSolid; "
                        "this representation cannot be resized parametrically"
                    )
                solid, _rep = found
                cls._resize_extruded_solid(
                    solid,
                    new_height=req.height,
                    new_thickness=req.thickness,
                    unit_scale=unit_scale,
                )
                resized_height = req.height
                resized_thickness = req.thickness
            elif is_column and (
                req.width is not None or req.depth is not None or req.height is not None
            ):
                # A partial update must change exactly the requested dimension: read the
                # current extents first and reuse them for whatever the caller omitted
                # ({"height": 4.0} on a 0.4x0.4x3.0 column used to rebuild 0.35x0.35x4.0).
                current: Optional[tuple[float, float, float]] = None
                if req.width is None or req.depth is None or req.height is None:
                    current = cls._body_extents_metres(entity, unit_scale)
                    if current is None:
                        raise GeometryNotEditable(
                            f"IfcColumn #{express_id} body geometry cannot be measured; "
                            "send width, depth and height together to resize it"
                        )
                w = float(req.width) if req.width is not None else current[0]  # type: ignore[index]
                d = float(req.depth) if req.depth is not None else current[1]  # type: ignore[index]
                h = float(req.height) if req.height is not None else current[2]  # type: ignore[index]
                for label, value in (("width", w), ("depth", d), ("height", h)):
                    if value <= 0:
                        raise GeometryNotEditable(f"{label} must be positive (got {value})")
                # _create_box_mesh writes raw numbers into the file, so convert metres -> project units.
                rep = cls._create_box_mesh(
                    model, body, w / unit_scale, d / unit_scale, h / unit_scale
                )
                cls._replace_body_representation(model, entity, rep)
                resized_box = (w, d, h)

            # audit 1.4: a shorter/thinner wall must not leave a void sticking out of it. This
            # runs after the wall extrusion is resized and before the single write below, so
            # the wall and its openings always land in the same atomic commit.
            warnings: list[str] = []
            if is_wall and (req.height is not None or req.thickness is not None):
                warnings = cls._clamp_openings_to_wall(
                    entity,
                    new_height=req.height,
                    new_thickness=req.thickness,
                    unit_scale=unit_scale,
                )
                for warning in warnings:
                    logger.warning("Wall #%d resize: %s", express_id, warning)

            if req.elevation is not None:
                try:
                    # edit_object_placement expects an SI (metre) matrix, so the requested elevation
                    # is passed through unchanged; it is written as elevation / unit_scale.
                    mat = ifcopenshell.util.placement.get_local_placement(entity.ObjectPlacement)
                    mat[2, 3] = float(req.elevation)
                    ifcopenshell.api.run("geometry.edit_object_placement", model, product=entity, matrix=mat)
                except Exception as exc:
                    raise GeometryNotEditable(
                        f"elevation edit failed for #{express_id}: {exc}"
                    ) from exc

            # audit 5.8: geometry edits were the only mutation left out of the undo stack, so
            # Ctrl+Z skipped over a resize. The pre-image is taken before the first write.
            trans_id, pre_snapshot = cls.begin_snapshot(project_id)
            try:
                atomic_write_model(model, file_path)

                # Properties are written only after the geometry is committed, and only for what changed.
                # Each call re-opens the model from disk (never the stale handle above), which is what
                # makes the F-002 lost update impossible: the property write cannot be clobbered by a
                # later write from this snapshot.
                if is_wall or is_column:
                    if req.height is not None:
                        IFCService.update_element_property(
                            file_path, express_id, "Dimensions", "Height", float(req.height), "IfcLengthMeasure"
                        )
                    if is_wall and req.thickness is not None:
                        IFCService.update_element_property(
                            file_path, express_id, "Dimensions", "Thickness", float(req.thickness), "IfcLengthMeasure"
                        )

                if resized_height is not None or resized_thickness is not None or resized_box is not None:
                    cls._verify_persisted_geometry(
                        file_path,
                        express_id,
                        new_height=resized_height,
                        new_thickness=resized_thickness,
                        box_extents=resized_box,
                        unit_scale=unit_scale,
                    )
            except Exception:
                # STEP-10 seam: a failed edit must not leave a pre-image behind.
                cls.discard_snapshot(project_id, pre_snapshot)
                raise

            return {
                "entity_type": entity_type,
                "transaction_id": trans_id,
                "pre_snapshot": pre_snapshot,
                "warnings": warnings,
            }

        async with project_write_lock(project_id):
            result = await run_ifc(_work)

        params = {
            "height": req.height,
            "thickness": req.thickness,
            "elevation": req.elevation,
            "warnings": result["warnings"],
        }
        await cls.record_transaction(
            project_id, result["transaction_id"], "update_geometry", express_id,
            result["entity_type"], params, result["pre_snapshot"],
        )
        # STEP-19 / audit 2.2: a resize never changes the product count - no re-parse.
        await ProjectService.refresh_project_metrics(project_id, count_unchanged=True)

        logger.info("Updated geometry parameters for #%d", express_id)

        return {
            "success": True,
            "express_id": express_id,
            "updated": True,
            "transaction_id": result["transaction_id"],
            "warnings": result["warnings"],
        }

    @classmethod
    async def assign_storey(cls, project_id: str, express_id: int, req: CadAssignStoreyRequest) -> dict[str, Any]:
        """Reassign spatial container of element to another IfcBuildingStorey.

        audit 5.8: a storey move is a model mutation, so it is one undoable transaction
        (``assign_storey``) instead of an untracked write Ctrl+Z skips over.
        """
        file_path = ProjectService.get_project_file_path(project_id)
        if not file_path.exists():
            raise FileNotFoundError(f"Project file {file_path} not found.")

        def _work() -> dict[str, Any]:
            model = ifcopenshell.open(str(file_path))
            entity = model.by_id(express_id)
            if not entity:
                raise ValueError(f"Entity #{express_id} not found in model.")

            storey = model.by_id(req.storey_id)
            if not storey or not storey.is_a("IfcBuildingStorey"):
                raise ValueError(f"Target storey #{req.storey_id} not found or is not an IfcBuildingStorey.")

            entity_type = entity.is_a()
            previous = ifcopenshell.util.element.get_container(entity)
            trans_id, pre_snapshot = cls.begin_snapshot(project_id)
            try:
                ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey, products=[entity])
                atomic_write_model(model, file_path)
            except Exception:
                cls.discard_snapshot(project_id, pre_snapshot)
                raise
            return {
                "storey_name": str(getattr(storey, "Name", "Storey")),
                "entity_type": entity_type,
                "previous_storey_id": previous.id() if previous is not None else None,
                "transaction_id": trans_id,
                "pre_snapshot": pre_snapshot,
            }

        async with project_write_lock(project_id):
            assigned = await run_ifc(_work)

        await cls.record_transaction(
            project_id, assigned["transaction_id"], "assign_storey", express_id,
            assigned["entity_type"],
            {
                "storey_id": req.storey_id,
                "storey_name": assigned["storey_name"],
                "previous_storey_id": assigned["previous_storey_id"],
            },
            assigned["pre_snapshot"],
        )
        # STEP-19 / audit 2.2: containment does not change the product count - no re-parse.
        await ProjectService.refresh_project_metrics(project_id, count_unchanged=True)
        logger.info(
            "Assigned element #%d to storey #%d (%s)", express_id, req.storey_id, assigned["storey_name"]
        )

        return {
            "success": True,
            "express_id": express_id,
            "storey_id": req.storey_id,
            "storey_name": assigned["storey_name"]
        }

    @classmethod
    async def assign_material(cls, project_id: str, express_id: int, req: CadMaterialRequest) -> dict[str, Any]:
        """Assign or override architectural material and color appearance for an element.

        audit 5.8: material/colour assignment is a model mutation and therefore one undoable
        transaction (``assign_material``), like every other write path.
        """
        file_path = ProjectService.get_project_file_path(project_id)
        if not file_path.exists():
            raise FileNotFoundError(f"Project file {file_path} not found.")

        def _work() -> dict[str, Any]:
            model = ifcopenshell.open(str(file_path))
            entity = model.by_id(express_id)
            if not entity:
                raise ValueError(f"Entity #{express_id} not found in model.")
            entity_type = entity.is_a()

            trans_id, pre_snapshot = cls.begin_snapshot(project_id)
            try:
                # Each property write re-opens the model and replaces the file atomically, so the
                # three values below accumulate instead of the last write winning (F-002).
                IFCService.update_element_property(file_path, express_id, "Materials", "MaterialName", req.material_name, "IfcLabel")
                if req.color_hex:
                    IFCService.update_element_property(file_path, express_id, "Materials", "SurfaceColor", req.color_hex, "IfcLabel")
                if req.transparency is not None:
                    IFCService.update_element_property(file_path, express_id, "Materials", "Transparency", float(req.transparency), "IfcReal")
            except Exception:
                cls.discard_snapshot(project_id, pre_snapshot)
                raise
            return {
                "entity_type": entity_type,
                "transaction_id": trans_id,
                "pre_snapshot": pre_snapshot,
            }

        async with project_write_lock(project_id):
            assigned = await run_ifc(_work)

        await cls.record_transaction(
            project_id, assigned["transaction_id"], "assign_material", express_id,
            assigned["entity_type"],
            {
                "material_name": req.material_name,
                "color_hex": req.color_hex,
                "transparency": req.transparency,
            },
            assigned["pre_snapshot"],
        )
        # STEP-19 / audit 2.2: a material write cannot change the product count - no re-parse.
        await ProjectService.refresh_project_metrics(project_id, count_unchanged=True)

        return {
            "success": True,
            "express_id": express_id,
            "material": req.material_name,
            "color": req.color_hex,
            "transparency": req.transparency
        }

    @classmethod
    async def is_element_pinned(cls, project_id: str, express_id: int) -> bool:
        """Check whether element is pinned (locked against accidental edits/deletions)."""
        async with get_db_connection() as db:
            cursor = await db.execute(
                "SELECT 1 FROM pinned_elements WHERE project_id = ? AND express_id = ?",
                (project_id, express_id)
            )
            row = await cursor.fetchone()
            if row:
                return True
        return False

    @classmethod
    async def get_pinned_elements(cls, project_id: str) -> list[int]:
        """Fetch all pinned express IDs for a project."""
        async with get_db_connection() as db:
            cursor = await db.execute(
                "SELECT express_id FROM pinned_elements WHERE project_id = ?",
                (project_id,)
            )
            rows = await cursor.fetchall()
            return [row[0] for row in rows]

    @classmethod
    async def pin_element(cls, project_id: str, express_id: int, req: CadPinRequest) -> dict[str, Any]:
        """Pin or unpin an element.

        Deliberately **not** an undoable transaction: pinning is a database annotation plus a
        non-geometric ``Constraints.Pinned`` flag, and Ctrl+Z must never spend a model restore
        (a whole 49 MB pre-image) on it. The ``pinned_elements`` row is the source of truth
        for locking; the IFC property is a persistence convenience.
        """
        file_path = ProjectService.get_project_file_path(project_id)
        if not file_path.exists():
            raise FileNotFoundError(f"Project file {file_path} not found.")

        async with get_db_connection() as db:
            if req.is_pinned:
                now = datetime.now(timezone.utc).isoformat()
                await db.execute(
                    "INSERT OR REPLACE INTO pinned_elements (project_id, express_id, created_at) VALUES (?, ?, ?)",
                    (project_id, express_id, now)
                )
            else:
                await db.execute(
                    "DELETE FROM pinned_elements WHERE project_id = ? AND express_id = ?",
                    (project_id, express_id)
                )
            await db.commit()

        # Persist Constraints.Pinned property in IFC (off the event loop; the property write is
        # atomic and collects the project lock itself through this same coroutine's scope).
        async with project_write_lock(project_id):
            try:
                await run_ifc(
                    IFCService.update_element_property,
                    file_path, express_id, "Constraints", "Pinned", req.is_pinned, "IfcBoolean",
                )
            except Exception as e:
                logger.warning("Could not persist Constraints.Pinned in IFC: %s", e)

        return {
            "success": True,
            "express_id": express_id,
            "is_pinned": req.is_pinned,
            "message": f"Element #{express_id} {'pinned' if req.is_pinned else 'unpinned'} successfully"
        }

    @classmethod
    async def move_element(cls, project_id: str, express_id: int, req: CadMoveRequest) -> CadElementResponse:
        """Translate an existing element in 3D space by delta [dx, dy, dz]."""
        if await cls.is_element_pinned(project_id, express_id):
            raise ValueError(f"Element #{express_id} is pinned. Unpin (UP) before moving.")

        file_path = ProjectService.get_project_file_path(project_id)
        if not file_path.exists():
            raise FileNotFoundError(f"Project file {file_path} not found.")

        def _work() -> dict[str, Any]:
            model = ifcopenshell.open(str(file_path))
            entity = cls._try_by_id(model, express_id)
            if not entity:
                raise ValueError(f"Entity #{express_id} not found in model.")

            mat = np.identity(4)
            try:
                mat = ifcopenshell.util.placement.get_local_placement(entity.ObjectPlacement)
            except Exception as e:
                raise ValueError(f"Cannot get local placement for entity #{express_id}: {e}")

            old_mat = mat.copy()
            mat[0, 3] += float(req.delta[0])
            mat[1, 3] += float(req.delta[1])
            mat[2, 3] += float(req.delta[2])

            ifcopenshell.api.run("geometry.edit_object_placement", model, product=entity, matrix=mat)
            trans_id, pre_snapshot = cls.begin_snapshot(project_id)
            atomic_write_model(model, file_path)
            return {
                "global_id": entity.GlobalId,
                "entity_type": entity.is_a(),
                "name": getattr(entity, "Name", "") or entity.is_a(),
                "transaction_id": trans_id,
                "pre_snapshot": pre_snapshot,
                "old_matrix": old_mat.tolist(),
                "new_matrix": mat.tolist(),
            }

        async with project_write_lock(project_id):
            moved = await run_ifc(_work)

        logger.info("Moved %s #%d by delta %s", moved["entity_type"], express_id, req.delta)

        params = {
            "delta": req.delta,
            "old_matrix": moved["old_matrix"],
            "new_matrix": moved["new_matrix"],
        }
        await cls.record_transaction(
            project_id, moved["transaction_id"], "move_element", express_id,
            moved["entity_type"], params, moved["pre_snapshot"],
        )
        # STEP-19 / audit 2.2: a transform cannot change the product count, so the refresh
        # only touches file_size/updated_at - no re-parse of a 49 MB model per gizmo commit.
        await ProjectService.refresh_project_metrics(project_id, count_unchanged=True)

        return CadElementResponse(
            success=True,
            express_id=express_id,
            global_id=moved["global_id"],
            entity_type=moved["entity_type"],
            name=moved["name"],
            transaction_id=moved["transaction_id"],
            message=f"Element #{express_id} moved by {req.delta}"
        )

    @classmethod
    async def rotate_element(cls, project_id: str, express_id: int, req: CadRotateRequest) -> CadElementResponse:
        """Rotate an existing element around its local origin along axis ('x', 'y', 'z')."""
        if await cls.is_element_pinned(project_id, express_id):
            raise ValueError(f"Element #{express_id} is pinned. Unpin (UP) before rotating.")

        file_path = ProjectService.get_project_file_path(project_id)
        if not file_path.exists():
            raise FileNotFoundError(f"Project file {file_path} not found.")

        def _work() -> dict[str, Any]:
            model = ifcopenshell.open(str(file_path))
            entity = cls._try_by_id(model, express_id)
            if not entity:
                raise ValueError(f"Entity #{express_id} not found in model.")

            mat = np.identity(4)
            try:
                mat = ifcopenshell.util.placement.get_local_placement(entity.ObjectPlacement)
            except Exception as e:
                raise ValueError(f"Cannot get local placement for entity #{express_id}: {e}")

            old_mat = mat.copy()
            theta = math.radians(req.angle_degrees)
            cos_t = math.cos(theta)
            sin_t = math.sin(theta)

            axis = req.axis.lower()
            if axis == "z":
                R = np.array([
                    [cos_t, -sin_t, 0.0],
                    [sin_t,  cos_t, 0.0],
                    [0.0,    0.0,   1.0]
                ])
            elif axis == "x":
                R = np.array([
                    [1.0, 0.0,    0.0],
                    [0.0, cos_t, -sin_t],
                    [0.0, sin_t,  cos_t]
                ])
            elif axis == "y":
                R = np.array([
                    [ cos_t, 0.0, sin_t],
                    [ 0.0,   1.0, 0.0],
                    [-sin_t, 0.0, cos_t]
                ])
            else:
                raise ValueError(f"Invalid rotation axis '{req.axis}'. Expected 'x', 'y', or 'z'.")

            # Rotate orientation columns while preserving origin position
            mat[:3, :3] = R @ mat[:3, :3]

            ifcopenshell.api.run("geometry.edit_object_placement", model, product=entity, matrix=mat)
            trans_id, pre_snapshot = cls.begin_snapshot(project_id)
            atomic_write_model(model, file_path)
            return {
                "global_id": entity.GlobalId,
                "entity_type": entity.is_a(),
                "name": getattr(entity, "Name", "") or entity.is_a(),
                "transaction_id": trans_id,
                "pre_snapshot": pre_snapshot,
                "old_matrix": old_mat.tolist(),
                "new_matrix": mat.tolist(),
            }

        async with project_write_lock(project_id):
            rotated = await run_ifc(_work)

        logger.info(
            "Rotated %s #%d by %s deg along %s",
            rotated["entity_type"], express_id, req.angle_degrees, req.axis,
        )

        params = {
            "angle_degrees": req.angle_degrees,
            "axis": req.axis,
            "old_matrix": rotated["old_matrix"],
            "new_matrix": rotated["new_matrix"],
        }
        await cls.record_transaction(
            project_id, rotated["transaction_id"], "rotate_element", express_id,
            rotated["entity_type"], params, rotated["pre_snapshot"],
        )
        # STEP-19 / audit 2.2: a transform cannot change the product count, so the refresh
        # only touches file_size/updated_at - no re-parse of a 49 MB model per gizmo commit.
        await ProjectService.refresh_project_metrics(project_id, count_unchanged=True)

        return CadElementResponse(
            success=True,
            express_id=express_id,
            global_id=rotated["global_id"],
            entity_type=rotated["entity_type"],
            name=rotated["name"],
            transaction_id=rotated["transaction_id"],
            message=f"Element #{express_id} rotated {req.angle_degrees}° along {req.axis.upper()}"
        )

    @classmethod
    async def mirror_element(cls, project_id: str, express_id: int, req: CadMirrorRequest) -> CadElementResponse:
        """Mirror element across specified axis. If is_copy is True, clones first."""
        if not req.is_copy and await cls.is_element_pinned(project_id, express_id):
            raise ValueError(f"Element #{express_id} is pinned. Unpin (UP) before mirroring.")

        file_path = ProjectService.get_project_file_path(project_id)
        if not file_path.exists():
            raise FileNotFoundError(f"Project file {file_path} not found.")

        def _work() -> dict[str, Any]:
            model = ifcopenshell.open(str(file_path))
            entity = cls._try_by_id(model, express_id)
            if not entity:
                raise ValueError(f"Entity #{express_id} not found in model.")

            entity_type = entity.is_a()
            target_entity = entity
            old_mat = np.identity(4)

            try:
                old_mat = ifcopenshell.util.placement.get_local_placement(entity.ObjectPlacement)
            except Exception:
                pass

            if req.is_copy:
                cloned = ifcopenshell.api.run("root.create_entity", model, ifc_class=entity_type, name=f"{getattr(entity, 'Name', '') or entity_type} (Mirrored)")
                if hasattr(entity, "Representation") and entity.Representation:
                    try:
                        ifcopenshell.api.run("geometry.assign_representation", model, product=cloned, representation=entity.Representation)
                    except Exception:
                        pass
                try:
                    for rel in getattr(entity, "ContainedInStructure", []):
                        ifcopenshell.api.run("spatial.assign_container", model, relating_structure=rel.RelatingStructure, products=[cloned])
                except Exception:
                    pass
                target_entity = cloned

            mat = old_mat.copy()
            axis = req.axis.lower()
            if axis == "x":
                # Reflection across YZ plane (invert X)
                R = np.array([
                    [-1.0, 0.0, 0.0],
                    [0.0, 1.0, 0.0],
                    [0.0, 0.0, 1.0]
                ])
                mat[:3, :3] = R @ mat[:3, :3]
                if req.is_copy:
                    mat[0, 3] += 1.0
            elif axis == "y":
                # Reflection across XZ plane (invert Y)
                R = np.array([
                    [1.0, 0.0, 0.0],
                    [-0.0, -1.0, 0.0],
                    [0.0, 0.0, 1.0]
                ])
                mat[:3, :3] = R @ mat[:3, :3]
                if req.is_copy:
                    mat[1, 3] += 1.0
            elif axis == "z":
                # Reflection across XY plane (invert Z)
                R = np.array([
                    [1.0, 0.0, 0.0],
                    [0.0, 1.0, 0.0],
                    [0.0, 0.0, -1.0]
                ])
                mat[:3, :3] = R @ mat[:3, :3]
                if req.is_copy:
                    mat[2, 3] += 1.0

            ifcopenshell.api.run("geometry.edit_object_placement", model, product=target_entity, matrix=mat)
            trans_id, pre_snapshot = cls.begin_snapshot(project_id)
            atomic_write_model(model, file_path)
            return {
                "express_id": target_entity.id(),
                "global_id": target_entity.GlobalId,
                "entity_type": entity_type,
                "name": getattr(target_entity, "Name", "") or entity_type,
                "transaction_id": trans_id,
                "pre_snapshot": pre_snapshot,
                "old_matrix": old_mat.tolist(),
                "new_matrix": mat.tolist(),
                # audit 2.2: only meaningful for a mirror copy (is_copy=True), but reading it
                # from the open model costs nothing and keeps the count truthful either way.
                "element_count": len(model.by_type("IfcProduct")),
            }

        async with project_write_lock(project_id):
            mirrored = await run_ifc(_work)

        params = {
            "axis": req.axis,
            "is_copy": req.is_copy,
            "source_express_id": express_id,
            "old_matrix": mirrored["old_matrix"],
            "new_matrix": mirrored["new_matrix"],
        }
        await cls.record_transaction(
            project_id, mirrored["transaction_id"], "mirror_element", mirrored["express_id"],
            mirrored["entity_type"], params, mirrored["pre_snapshot"],
        )
        # STEP-19 / audit 2.2: an in-place mirror cannot change the product count, so the
        # refresh only touches file_size/updated_at. A mirrored *copy* does add one product,
        # and the count comes from the model that was just written - still no re-parse.
        if req.is_copy:
            await ProjectService.refresh_project_metrics(
                project_id, element_count=mirrored["element_count"]
            )
        else:
            await ProjectService.refresh_project_metrics(project_id, count_unchanged=True)

        return CadElementResponse(
            success=True,
            express_id=mirrored["express_id"],
            global_id=mirrored["global_id"],
            entity_type=mirrored["entity_type"],
            name=mirrored["name"],
            transaction_id=mirrored["transaction_id"],
            message=f"Element #{express_id} mirrored {'as new copy #' + str(mirrored['express_id']) if req.is_copy else 'in place'}"
        )

    @classmethod
    async def array_element(cls, project_id: str, express_id: int, req: CadArrayRequest) -> list[CadElementResponse]:
        """Create a linear array of N elements spaced by delta [dx, dy, dz]."""
        file_path = ProjectService.get_project_file_path(project_id)
        if not file_path.exists():
            raise FileNotFoundError(f"Project file {file_path} not found.")

        def _work() -> dict[str, Any]:
            model = ifcopenshell.open(str(file_path))
            entity = cls._try_by_id(model, express_id)
            if not entity:
                raise ValueError(f"Entity #{express_id} not found in model.")

            entity_type = entity.is_a()
            base_name = getattr(entity, "Name", "") or entity_type

            base_mat = np.identity(4)
            try:
                base_mat = ifcopenshell.util.placement.get_local_placement(entity.ObjectPlacement)
            except Exception:
                pass

            container = None
            for rel in getattr(entity, "ContainedInStructure", []):
                container = rel.RelatingStructure
                break

            created_rows: list[tuple[int, str, str]] = []

            for i in range(1, req.count):
                clone_name = f"{base_name} (Array {i+1}/{req.count})"
                cloned = ifcopenshell.api.run("root.create_entity", model, ifc_class=entity_type, name=clone_name)
                if hasattr(entity, "Representation") and entity.Representation:
                    try:
                        ifcopenshell.api.run("geometry.assign_representation", model, product=cloned, representation=entity.Representation)
                    except Exception:
                        pass

                c_mat = base_mat.copy()
                c_mat[0, 3] += float(req.delta[0]) * i
                c_mat[1, 3] += float(req.delta[1]) * i
                c_mat[2, 3] += float(req.delta[2]) * i

                ifcopenshell.api.run("geometry.edit_object_placement", model, product=cloned, matrix=c_mat)
                if container:
                    try:
                        ifcopenshell.api.run("spatial.assign_container", model, relating_structure=container, products=[cloned])
                    except Exception:
                        pass

                created_rows.append((cloned.id(), cloned.GlobalId, clone_name))

            trans_id, pre_snapshot = cls.begin_snapshot(project_id)
            atomic_write_model(model, file_path)
            return {
                "entity_type": entity_type,
                "transaction_id": trans_id,
                "pre_snapshot": pre_snapshot,
                "created": created_rows,
                # audit 2.2: N products were just added; count from the open model.
                "element_count": len(model.by_type("IfcProduct")),
            }

        async with project_write_lock(project_id):
            arrayed = await run_ifc(_work)
            # STEP-19 / audit 2.2: no re-parse; the count came from the model just written.
            await ProjectService.refresh_project_metrics(
                project_id, element_count=arrayed["element_count"]
            )

        created_ids = [row[0] for row in arrayed["created"]]
        created_responses = [
            CadElementResponse(
                success=True,
                express_id=express_id_,
                global_id=global_id,
                entity_type=arrayed["entity_type"],
                name=clone_name,
                transaction_id=arrayed["transaction_id"],
                message=f"Array element #{express_id_} created at offset step {i + 1}",
            )
            for i, (express_id_, global_id, clone_name) in enumerate(arrayed["created"])
        ]
        logger.info(
            "Arrayed %s #%d into %d total elements (created IDs %s)",
            arrayed["entity_type"], express_id, req.count, created_ids,
        )

        params = {
            "source_express_id": express_id,
            "count": req.count,
            "delta": req.delta,
            "created_ids": created_ids,
        }

        await cls.record_transaction(
            project_id, arrayed["transaction_id"], "array_element", express_id,
            arrayed["entity_type"], params, arrayed["pre_snapshot"],
        )

        return created_responses

    @classmethod
    async def align_element(cls, project_id: str, express_id: int, req: CadAlignRequest) -> CadElementResponse:
        """Align an element along an axis ('x', 'y', 'z') with a target value or another element."""
        if await cls.is_element_pinned(project_id, express_id):
            raise ValueError(f"Element #{express_id} is pinned. Unpin (UP) before aligning.")

        file_path = ProjectService.get_project_file_path(project_id)
        if not file_path.exists():
            raise FileNotFoundError(f"Project file {file_path} not found.")

        def _work() -> dict[str, Any]:
            model = ifcopenshell.open(str(file_path))
            entity = cls._try_by_id(model, express_id)
            if not entity:
                raise ValueError(f"Entity #{express_id} not found in model.")

            mat = np.identity(4)
            try:
                mat = ifcopenshell.util.placement.get_local_placement(entity.ObjectPlacement)
            except Exception as e:
                raise ValueError(f"Cannot get placement for entity #{express_id}: {e}")

            old_mat = mat.copy()
            axis_idx = {"x": 0, "y": 1, "z": 2}.get(req.axis.lower(), 2)

            target_coord = 0.0
            if req.align_type == "reference" and req.target_express_id:
                ref_entity = cls._try_by_id(model, req.target_express_id)
                if not ref_entity:
                    raise ValueError(f"Reference entity #{req.target_express_id} not found.")
                ref_mat = ifcopenshell.util.placement.get_local_placement(ref_entity.ObjectPlacement)
                target_coord = float(ref_mat[axis_idx, 3])
            elif req.target_value is not None:
                target_coord = float(req.target_value)
            elif req.align_type == "origin":
                target_coord = 0.0

            mat[axis_idx, 3] = target_coord

            ifcopenshell.api.run("geometry.edit_object_placement", model, product=entity, matrix=mat)
            trans_id, pre_snapshot = cls.begin_snapshot(project_id)
            atomic_write_model(model, file_path)
            return {
                "global_id": entity.GlobalId,
                "entity_type": entity.is_a(),
                "name": getattr(entity, "Name", "") or entity.is_a(),
                "transaction_id": trans_id,
                "pre_snapshot": pre_snapshot,
                "old_matrix": old_mat.tolist(),
                "new_matrix": mat.tolist(),
                "target_coord": target_coord,
            }

        async with project_write_lock(project_id):
            aligned = await run_ifc(_work)

        params = {
            "axis": req.axis,
            "align_type": req.align_type,
            "target_value": aligned["target_coord"],
            "old_matrix": aligned["old_matrix"],
            "new_matrix": aligned["new_matrix"],
        }
        await cls.record_transaction(
            project_id, aligned["transaction_id"], "align_element", express_id,
            aligned["entity_type"], params, aligned["pre_snapshot"],
        )
        # STEP-19 / audit 2.2: a transform cannot change the product count, so the refresh
        # only touches file_size/updated_at - no re-parse of a 49 MB model per gizmo commit.
        await ProjectService.refresh_project_metrics(project_id, count_unchanged=True)

        return CadElementResponse(
            success=True,
            express_id=express_id,
            global_id=aligned["global_id"],
            entity_type=aligned["entity_type"],
            name=aligned["name"],
            transaction_id=aligned["transaction_id"],
            message=f"Element #{express_id} aligned along {req.axis.upper()} to {aligned['target_coord']:.3f}m"
        )

