import uuid
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
import numpy as np
import ifcopenshell
import ifcopenshell.api
import ifcopenshell.api.root
import ifcopenshell.api.geometry
import ifcopenshell.api.feature
import ifcopenshell.api.spatial
import ifcopenshell.util.placement

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
)
from .project_service import ProjectService

logger = logging.getLogger("ifc_editor.cad_service")

class CADService:
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
    def _create_box_mesh(model: Any, body: Any, dx: float, dy: float, dz: float) -> Any:
        """Helper to create a closed 6-sided box mesh representation."""
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
        return ifcopenshell.api.run("geometry.add_mesh_representation", model, context=body, vertices=[verts], faces=[faces])

    @classmethod
    async def create_wall(cls, project_id: str, req: CadWallRequest) -> CadElementResponse:
        """Create a parametric 2-point IfcWall."""
        file_path = ProjectService.get_project_file_path(project_id)
        if not file_path.exists():
            raise FileNotFoundError(f"Project file {file_path} not found.")

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

        ifcopenshell.api.run(
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

        ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey, products=[wall])
        model.write(str(file_path))
        logger.info("Created IfcWall #%d in project %s", wall.id(), project_id)

        # Record transaction
        trans_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        async with get_db_connection() as db:
            await db.execute(
                """
                INSERT INTO cad_transactions (id, project_id, action_type, express_id, entity_type, parameters, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
                """,
                (trans_id, project_id, "create_wall", wall.id(), "IfcWall", req.model_dump_json(), now)
            )
            await db.commit()

        return CadElementResponse(
            success=True,
            express_id=wall.id(),
            global_id=wall.GlobalId,
            entity_type="IfcWall",
            name=wall.Name or "Parametric Wall",
            transaction_id=trans_id,
            message="Parametric wall created successfully"
        )

    @classmethod
    async def create_slab(cls, project_id: str, req: CadSlabRequest) -> CadElementResponse:
        """Create a parametric IfcSlab."""
        file_path = ProjectService.get_project_file_path(project_id)
        if not file_path.exists():
            raise FileNotFoundError(f"Project file {file_path} not found.")

        model = ifcopenshell.open(str(file_path))
        _, body = cls._ensure_contexts(model)
        storey = cls._get_target_storey(model, req.storey_id)

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

        rep = cls._create_box_mesh(model, body, dx, dy, dz)
        ifcopenshell.api.run("geometry.assign_representation", model, product=slab, representation=rep)

        mat = np.identity(4)
        mat[0, 3] = min_x
        mat[1, 3] = min_y
        mat[2, 3] = float(req.elevation) - dz
        ifcopenshell.api.run("geometry.edit_object_placement", model, product=slab, matrix=mat)

        ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey, products=[slab])
        model.write(str(file_path))
        logger.info("Created IfcSlab #%d in project %s", slab.id(), project_id)

        trans_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        async with get_db_connection() as db:
            await db.execute(
                """
                INSERT INTO cad_transactions (id, project_id, action_type, express_id, entity_type, parameters, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
                """,
                (trans_id, project_id, "create_slab", slab.id(), "IfcSlab", req.model_dump_json(), now)
            )
            await db.commit()

        return CadElementResponse(
            success=True,
            express_id=slab.id(),
            global_id=slab.GlobalId,
            entity_type="IfcSlab",
            name=slab.Name or "Parametric Slab",
            transaction_id=trans_id,
            message="Parametric slab created successfully"
        )

    @classmethod
    async def create_column(cls, project_id: str, req: CadColumnRequest) -> CadElementResponse:
        """Create a parametric vertical IfcColumn."""
        file_path = ProjectService.get_project_file_path(project_id)
        if not file_path.exists():
            raise FileNotFoundError(f"Project file {file_path} not found.")

        model = ifcopenshell.open(str(file_path))
        _, body = cls._ensure_contexts(model)
        storey = cls._get_target_storey(model, req.storey_id)

        column = ifcopenshell.api.run(
            "root.create_entity",
            model,
            ifc_class="IfcColumn",
            name=req.name or "Parametric Column"
        )

        dx = float(req.width)
        dy = float(req.depth)
        dz = float(req.height)

        rep = cls._create_box_mesh(model, body, dx, dy, dz)
        ifcopenshell.api.run("geometry.assign_representation", model, product=column, representation=rep)

        mat = np.identity(4)
        mat[0, 3] = float(req.position[0]) - (dx / 2.0)
        mat[1, 3] = float(req.position[1]) - (dy / 2.0)
        mat[2, 3] = float(req.elevation)
        ifcopenshell.api.run("geometry.edit_object_placement", model, product=column, matrix=mat)

        ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey, products=[column])
        model.write(str(file_path))
        logger.info("Created IfcColumn #%d in project %s", column.id(), project_id)

        trans_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        async with get_db_connection() as db:
            await db.execute(
                """
                INSERT INTO cad_transactions (id, project_id, action_type, express_id, entity_type, parameters, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
                """,
                (trans_id, project_id, "create_column", column.id(), "IfcColumn", req.model_dump_json(), now)
            )
            await db.commit()

        return CadElementResponse(
            success=True,
            express_id=column.id(),
            global_id=column.GlobalId,
            entity_type="IfcColumn",
            name=column.Name or "Parametric Column",
            transaction_id=trans_id,
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

        model = ifcopenshell.open(str(file_path))
        _, body = cls._ensure_contexts(model)

        wall = model.by_id(req.host_wall_id)
        if not wall or not wall.is_a("IfcWall"):
            raise ValueError(f"Host wall #{req.host_wall_id} not found in model.")

        storey = cls._get_target_storey(model)

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

        model.write(str(file_path))
        logger.info("Created %s #%d with Opening #%d on Wall #%d", fill_class, filling.id(), opening.id(), wall.id())

        trans_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        params = req.model_dump()
        params["opening_id"] = opening.id()

        async with get_db_connection() as db:
            await db.execute(
                """
                INSERT INTO cad_transactions (id, project_id, action_type, express_id, entity_type, parameters, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
                """,
                (trans_id, project_id, f"create_{req.opening_type.lower()}", filling.id(), fill_class, json.dumps(params), now)
            )
            await db.commit()

        return CadElementResponse(
            success=True,
            express_id=filling.id(),
            global_id=filling.GlobalId,
            entity_type=fill_class,
            name=filling_name,
            transaction_id=trans_id,
            opening_express_id=opening.id(),
            message=f"{fill_class} with void cutout created successfully"
        )

    @classmethod
    async def undo(cls, project_id: str) -> CadUndoRedoResponse:
        """Undo the last active CAD transaction."""
        async with get_db_connection() as db:
            cursor = await db.execute(
                """
                SELECT id, action_type, express_id, entity_type, parameters
                FROM cad_transactions
                WHERE project_id = ? AND status = 'ACTIVE'
                ORDER BY created_at DESC LIMIT 1
                """,
                (project_id,)
            )
            row = await cursor.fetchone()
            if not row:
                return CadUndoRedoResponse(
                    success=False,
                    transaction_id="",
                    action="none",
                    affected_express_id=0,
                    can_undo=False,
                    can_redo=True,
                    message="No active transactions to undo"
                )

            trans_id = row["id"]
            action_type = row["action_type"]
            express_id = row["express_id"]
            entity_type = row["entity_type"]
            params = json.loads(row["parameters"])

            file_path = ProjectService.get_project_file_path(project_id)
            if file_path.exists():
                model = ifcopenshell.open(str(file_path))
                entity = model.by_id(express_id)
                if entity:
                    # If this is an opening filling, also remove the opening
                    if "opening_id" in params:
                        op_entity = model.by_id(params["opening_id"])
                        if op_entity:
                            try:
                                ifcopenshell.api.run("root.remove_product", model, product=op_entity)
                            except Exception:
                                model.remove(op_entity)
                    try:
                        ifcopenshell.api.run("root.remove_product", model, product=entity)
                    except Exception:
                        model.remove(entity)
                    model.write(str(file_path))
                    logger.info("Undone %s #%d in project %s", entity_type, express_id, project_id)

            await db.execute(
                "UPDATE cad_transactions SET status = 'UNDONE' WHERE id = ?",
                (trans_id,)
            )
            await db.commit()

            # Check counts
            c_active = await db.execute("SELECT COUNT(*) FROM cad_transactions WHERE project_id = ? AND status = 'ACTIVE'", (project_id,))
            can_undo = (await c_active.fetchone())[0] > 0
            c_undone = await db.execute("SELECT COUNT(*) FROM cad_transactions WHERE project_id = ? AND status = 'UNDONE'", (project_id,))
            can_redo = (await c_undone.fetchone())[0] > 0

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
        """Redo the most recently undone CAD transaction."""
        async with get_db_connection() as db:
            cursor = await db.execute(
                """
                SELECT id, action_type, express_id, entity_type, parameters
                FROM cad_transactions
                WHERE project_id = ? AND status = 'UNDONE'
                ORDER BY created_at DESC LIMIT 1
                """,
                (project_id,)
            )
            row = await cursor.fetchone()
            if not row:
                return CadUndoRedoResponse(
                    success=False,
                    transaction_id="",
                    action="none",
                    affected_express_id=0,
                    can_undo=True,
                    can_redo=False,
                    message="No undone transactions to redo"
                )

            trans_id = row["id"]
            action_type = row["action_type"]
            params = json.loads(row["parameters"])

        # Re-synthesize based on action_type
        new_res: Optional[CadElementResponse] = None
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

        affected_id = new_res.express_id if new_res else 0

        # Delete the undone entry since create_* inserted a new ACTIVE transaction
        async with get_db_connection() as db:
            await db.execute("DELETE FROM cad_transactions WHERE id = ?", (trans_id,))
            await db.commit()

            c_active = await db.execute("SELECT COUNT(*) FROM cad_transactions WHERE project_id = ? AND status = 'ACTIVE'", (project_id,))
            can_undo = (await c_active.fetchone())[0] > 0
            c_undone = await db.execute("SELECT COUNT(*) FROM cad_transactions WHERE project_id = ? AND status = 'UNDONE'", (project_id,))
            can_redo = (await c_undone.fetchone())[0] > 0

        return CadUndoRedoResponse(
            success=True,
            transaction_id=new_res.transaction_id if new_res else trans_id,
            action=action_type,
            affected_express_id=affected_id,
            can_undo=can_undo,
            can_redo=can_redo,
            message=f"Successfully redone {action_type}, new element #{affected_id}"
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
