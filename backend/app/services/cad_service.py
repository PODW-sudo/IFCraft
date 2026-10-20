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
                    if action_type in ("move_element", "rotate_element", "align_element") or (action_type == "mirror_element" and not params.get("is_copy", False)):
                        if "old_matrix" in params:
                            old_mat = np.array(params["old_matrix"])
                            ifcopenshell.api.run("geometry.edit_object_placement", model, product=entity, matrix=old_mat)
                            model.write(str(file_path))
                            logger.info("Undone %s for #%d: restored placement matrix", action_type, express_id)
                    elif action_type == "array_element":
                        for cid in params.get("created_ids", []):
                            ce = model.by_id(cid)
                            if ce:
                                try:
                                    ifcopenshell.api.run("root.remove_product", model, product=ce)
                                except Exception:
                                    model.remove(ce)
                        model.write(str(file_path))
                        logger.info("Undone array_element: removed %s", params.get("created_ids", []))
                    elif action_type == "clone_element" or (action_type == "mirror_element" and params.get("is_copy", False)):
                        try:
                            ifcopenshell.api.run("root.remove_product", model, product=entity)
                        except Exception:
                            model.remove(entity)
                        model.write(str(file_path))
                        logger.info("Undone clone/mirror #%d", express_id)
                    else:
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
            express_id = row["express_id"]
            params = json.loads(row["parameters"])

        # Re-synthesize or re-apply based on action_type
        new_res: Optional[CadElementResponse] = None
        if action_type in ("move_element", "rotate_element", "align_element") or (action_type == "mirror_element" and not params.get("is_copy", False)):
            file_path = ProjectService.get_project_file_path(project_id)
            if file_path.exists():
                model = ifcopenshell.open(str(file_path))
                entity = model.by_id(express_id)
                if entity and "new_matrix" in params:
                    new_mat = np.array(params["new_matrix"])
                    ifcopenshell.api.run("geometry.edit_object_placement", model, product=entity, matrix=new_mat)
                    model.write(str(file_path))
                    logger.info("Redone %s for #%d: applied new placement matrix", action_type, express_id)
            async with get_db_connection() as db:
                await db.execute("UPDATE cad_transactions SET status = 'ACTIVE' WHERE id = ?", (trans_id,))
                await db.commit()
            affected_id = express_id
        else:
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

            affected_id = new_res.express_id if new_res else 0

            # Delete the undone entry since create_* inserted a new ACTIVE transaction
            async with get_db_connection() as db:
                await db.execute("DELETE FROM cad_transactions WHERE id = ?", (trans_id,))
                await db.commit()

        async with get_db_connection() as db:
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

        model = ifcopenshell.open(str(file_path))
        entity = model.by_id(express_id)
        if not entity:
            raise ValueError(f"Entity #{express_id} not found in model.")

        if await cls.is_element_pinned(project_id, express_id):
            raise ValueError(f"Element #{express_id} is pinned. Unpin (UP) before deleting.")

        entity_type = entity.is_a()
        entity_name = getattr(entity, "Name", None) or f"{entity_type} #{express_id}"

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

        model.write(str(file_path))
        logger.info("Deleted %s #%d in project %s", entity_type, express_id, project_id)

        trans_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        async with get_db_connection() as db:
            await db.execute(
                """
                INSERT INTO cad_transactions (id, project_id, action_type, express_id, entity_type, parameters, status, created_at)
                VALUES (?, ?, 'delete_element', ?, ?, ?, 'ACTIVE', ?)
                """,
                (trans_id, project_id, express_id, entity_type, json.dumps({"name": entity_name}), now)
            )
            await db.commit()

        return {
            "success": True,
            "express_id": express_id,
            "entity_type": entity_type,
            "message": f"Successfully deleted {entity_type} #{express_id}",
            "transaction_id": trans_id
        }

    @classmethod
    async def clone_element(cls, project_id: str, express_id: int, req: CadCloneRequest) -> CadElementResponse:
        """Duplicate an IFC element with a translation delta offset."""
        file_path = ProjectService.get_project_file_path(project_id)
        if not file_path.exists():
            raise FileNotFoundError(f"Project file {file_path} not found.")

        model = ifcopenshell.open(str(file_path))
        entity = model.by_id(express_id)
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

        model.write(str(file_path))
        logger.info("Cloned %s #%d to new element #%d", entity_type, express_id, cloned.id())

        trans_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        async with get_db_connection() as db:
            await db.execute(
                """
                INSERT INTO cad_transactions (id, project_id, action_type, express_id, entity_type, parameters, status, created_at)
                VALUES (?, ?, 'clone_element', ?, ?, ?, 'ACTIVE', ?)
                """,
                (trans_id, project_id, cloned.id(), entity_type, req.model_dump_json(), now)
            )
            await db.commit()

        return CadElementResponse(
            success=True,
            express_id=cloned.id(),
            global_id=cloned.GlobalId,
            entity_type=entity_type,
            name=new_name,
            transaction_id=trans_id,
            message=f"Element #{express_id} duplicated successfully as #{cloned.id()}"
        )

    @classmethod
    async def update_geometry(cls, project_id: str, express_id: int, req: CadGeometryUpdateRequest) -> dict[str, Any]:
        """Parametrically update element dimensions (height, thickness, elevation)."""
        file_path = ProjectService.get_project_file_path(project_id)
        if not file_path.exists():
            raise FileNotFoundError(f"Project file {file_path} not found.")

        model = ifcopenshell.open(str(file_path))
        entity = model.by_id(express_id)
        if not entity:
            raise ValueError(f"Entity #{express_id} not found in model.")

        _, body = cls._ensure_contexts(model)

        if entity.is_a("IfcWall"):
            if req.height is not None:
                IFCService.update_element_property(file_path, express_id, "Dimensions", "Height", float(req.height), "IfcLengthMeasure")
            if req.thickness is not None:
                IFCService.update_element_property(file_path, express_id, "Dimensions", "Thickness", float(req.thickness), "IfcLengthMeasure")
            # Re-read model
            model = ifcopenshell.open(str(file_path))
            entity = model.by_id(express_id)
        elif entity.is_a("IfcColumn"):
            w = float(req.width) if req.width is not None else 0.35
            d = float(req.depth) if req.depth is not None else 0.35
            h = float(req.height) if req.height is not None else 3.0
            rep = cls._create_box_mesh(model, body, w, d, h)
            ifcopenshell.api.run("geometry.assign_representation", model, product=entity, representation=rep)
            IFCService.update_element_property(file_path, express_id, "Dimensions", "Height", h, "IfcLengthMeasure")

        if req.elevation is not None:
            try:
                mat = ifcopenshell.util.placement.get_local_placement(entity.ObjectPlacement)
                mat[2, 3] = float(req.elevation)
                ifcopenshell.api.run("geometry.edit_object_placement", model, product=entity, matrix=mat)
            except Exception:
                pass

        model.write(str(file_path))
        logger.info("Updated geometry parameters for #%d", express_id)

        return {"success": True, "express_id": express_id, "updated": True}

    @classmethod
    async def assign_storey(cls, project_id: str, express_id: int, req: CadAssignStoreyRequest) -> dict[str, Any]:
        """Reassign spatial container of element to another IfcBuildingStorey."""
        file_path = ProjectService.get_project_file_path(project_id)
        if not file_path.exists():
            raise FileNotFoundError(f"Project file {file_path} not found.")

        model = ifcopenshell.open(str(file_path))
        entity = model.by_id(express_id)
        if not entity:
            raise ValueError(f"Entity #{express_id} not found in model.")

        storey = model.by_id(req.storey_id)
        if not storey or not storey.is_a("IfcBuildingStorey"):
            raise ValueError(f"Target storey #{req.storey_id} not found or is not an IfcBuildingStorey.")

        ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey, products=[entity])
        model.write(str(file_path))
        logger.info("Assigned element #%d to storey #%d (%s)", express_id, req.storey_id, getattr(storey, "Name", ""))

        return {
            "success": True,
            "express_id": express_id,
            "storey_id": req.storey_id,
            "storey_name": str(getattr(storey, "Name", "Storey"))
        }

    @classmethod
    async def assign_material(cls, project_id: str, express_id: int, req: CadMaterialRequest) -> dict[str, Any]:
        """Assign or override architectural material and color appearance for an element."""
        file_path = ProjectService.get_project_file_path(project_id)
        if not file_path.exists():
            raise FileNotFoundError(f"Project file {file_path} not found.")

        model = ifcopenshell.open(str(file_path))
        entity = model.by_id(express_id)
        if not entity:
            raise ValueError(f"Entity #{express_id} not found in model.")

        IFCService.update_element_property(file_path, express_id, "Materials", "MaterialName", req.material_name, "IfcLabel")
        if req.color_hex:
            IFCService.update_element_property(file_path, express_id, "Materials", "SurfaceColor", req.color_hex, "IfcLabel")
        if req.transparency is not None:
            IFCService.update_element_property(file_path, express_id, "Materials", "Transparency", float(req.transparency), "IfcReal")

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
        """Pin or unpin an element."""
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

        # Persist Constraints.Pinned property in IFC
        try:
            IFCService.update_element_property(
                file_path, express_id, "Constraints", "Pinned", req.is_pinned, "IfcBoolean"
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

        model = ifcopenshell.open(str(file_path))
        entity = model.by_id(express_id)
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
        model.write(str(file_path))
        logger.info("Moved %s #%d by delta %s", entity.is_a(), express_id, req.delta)

        trans_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        params = {
            "delta": req.delta,
            "old_matrix": old_mat.tolist(),
            "new_matrix": mat.tolist(),
        }
        async with get_db_connection() as db:
            await db.execute(
                """
                INSERT INTO cad_transactions (id, project_id, action_type, express_id, entity_type, parameters, status, created_at)
                VALUES (?, ?, 'move_element', ?, ?, ?, 'ACTIVE', ?)
                """,
                (trans_id, project_id, express_id, entity.is_a(), json.dumps(params), now)
            )
            await db.commit()

        return CadElementResponse(
            success=True,
            express_id=express_id,
            global_id=entity.GlobalId,
            entity_type=entity.is_a(),
            name=getattr(entity, "Name", "") or entity.is_a(),
            transaction_id=trans_id,
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

        model = ifcopenshell.open(str(file_path))
        entity = model.by_id(express_id)
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
        model.write(str(file_path))
        logger.info("Rotated %s #%d by %s deg along %s", entity.is_a(), express_id, req.angle_degrees, req.axis)

        trans_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        params = {
            "angle_degrees": req.angle_degrees,
            "axis": req.axis,
            "old_matrix": old_mat.tolist(),
            "new_matrix": mat.tolist(),
        }
        async with get_db_connection() as db:
            await db.execute(
                """
                INSERT INTO cad_transactions (id, project_id, action_type, express_id, entity_type, parameters, status, created_at)
                VALUES (?, ?, 'rotate_element', ?, ?, ?, 'ACTIVE', ?)
                """,
                (trans_id, project_id, express_id, entity.is_a(), json.dumps(params), now)
            )
            await db.commit()

        return CadElementResponse(
            success=True,
            express_id=express_id,
            global_id=entity.GlobalId,
            entity_type=entity.is_a(),
            name=getattr(entity, "Name", "") or entity.is_a(),
            transaction_id=trans_id,
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

        model = ifcopenshell.open(str(file_path))
        entity = model.by_id(express_id)
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
        model.write(str(file_path))

        trans_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        params = {
            "axis": req.axis,
            "is_copy": req.is_copy,
            "source_express_id": express_id,
            "old_matrix": old_mat.tolist(),
            "new_matrix": mat.tolist(),
        }
        async with get_db_connection() as db:
            await db.execute(
                """
                INSERT INTO cad_transactions (id, project_id, action_type, express_id, entity_type, parameters, status, created_at)
                VALUES (?, ?, 'mirror_element', ?, ?, ?, 'ACTIVE', ?)
                """,
                (trans_id, project_id, target_entity.id(), entity_type, json.dumps(params), now)
            )
            await db.commit()

        return CadElementResponse(
            success=True,
            express_id=target_entity.id(),
            global_id=target_entity.GlobalId,
            entity_type=entity_type,
            name=getattr(target_entity, "Name", "") or entity_type,
            transaction_id=trans_id,
            message=f"Element #{express_id} mirrored {'as new copy #' + str(target_entity.id()) if req.is_copy else 'in place'}"
        )

    @classmethod
    async def array_element(cls, project_id: str, express_id: int, req: CadArrayRequest) -> list[CadElementResponse]:
        """Create a linear array of N elements spaced by delta [dx, dy, dz]."""
        file_path = ProjectService.get_project_file_path(project_id)
        if not file_path.exists():
            raise FileNotFoundError(f"Project file {file_path} not found.")

        model = ifcopenshell.open(str(file_path))
        entity = model.by_id(express_id)
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

        created_responses: list[CadElementResponse] = []
        created_ids: list[int] = []

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

            created_ids.append(cloned.id())
            created_responses.append(
                CadElementResponse(
                    success=True,
                    express_id=cloned.id(),
                    global_id=cloned.GlobalId,
                    entity_type=entity_type,
                    name=clone_name,
                    transaction_id="",
                    message=f"Array element #{cloned.id()} created at offset step {i}"
                )
            )

        model.write(str(file_path))
        logger.info("Arrayed %s #%d into %d total elements (created IDs %s)", entity_type, express_id, req.count, created_ids)

        trans_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        params = {
            "source_express_id": express_id,
            "count": req.count,
            "delta": req.delta,
            "created_ids": created_ids,
        }
        for resp in created_responses:
            resp.transaction_id = trans_id

        async with get_db_connection() as db:
            await db.execute(
                """
                INSERT INTO cad_transactions (id, project_id, action_type, express_id, entity_type, parameters, status, created_at)
                VALUES (?, ?, 'array_element', ?, ?, ?, 'ACTIVE', ?)
                """,
                (trans_id, project_id, express_id, entity_type, json.dumps(params), now)
            )
            await db.commit()

        return created_responses

    @classmethod
    async def align_element(cls, project_id: str, express_id: int, req: CadAlignRequest) -> CadElementResponse:
        """Align an element along an axis ('x', 'y', 'z') with a target value or another element."""
        if await cls.is_element_pinned(project_id, express_id):
            raise ValueError(f"Element #{express_id} is pinned. Unpin (UP) before aligning.")

        file_path = ProjectService.get_project_file_path(project_id)
        if not file_path.exists():
            raise FileNotFoundError(f"Project file {file_path} not found.")

        model = ifcopenshell.open(str(file_path))
        entity = model.by_id(express_id)
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
            ref_entity = model.by_id(req.target_express_id)
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
        model.write(str(file_path))

        trans_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        params = {
            "axis": req.axis,
            "align_type": req.align_type,
            "target_value": target_coord,
            "old_matrix": old_mat.tolist(),
            "new_matrix": mat.tolist(),
        }
        async with get_db_connection() as db:
            await db.execute(
                """
                INSERT INTO cad_transactions (id, project_id, action_type, express_id, entity_type, parameters, status, created_at)
                VALUES (?, ?, 'align_element', ?, ?, ?, 'ACTIVE', ?)
                """,
                (trans_id, project_id, express_id, entity.is_a(), json.dumps(params), now)
            )
            await db.commit()

        return CadElementResponse(
            success=True,
            express_id=express_id,
            global_id=entity.GlobalId,
            entity_type=entity.is_a(),
            name=getattr(entity, "Name", "") or entity.is_a(),
            transaction_id=trans_id,
            message=f"Element #{express_id} aligned along {req.axis.upper()} to {target_coord:.3f}m"
        )

