import time
import uuid
import logging
from pathlib import Path
from typing import Optional, Any
from dataclasses import dataclass

import ifcopenshell
import ifcopenshell.geom

from ..core.config import settings
from ..core.database import get_db_connection
from ..models.schemas import ClashItem, ClashCheckResponse

logger = logging.getLogger("ifc_editor.clash_service")

@dataclass
class ElementBox:
    express_id: int
    name: str
    type_name: str
    model_id: str
    model_name: str
    discipline: str
    min_pt: tuple[float, float, float]
    max_pt: tuple[float, float, float]

class ClashService:
    @staticmethod
    def _extract_element_boxes(file_path: Path, model_id: str, model_name: str, discipline: str) -> list[ElementBox]:
        """Extract world-space Axis-Aligned Bounding Boxes (AABB) for all physical elements in an IFC file."""
        if not file_path.exists():
            return []

        try:
            model = ifcopenshell.open(str(file_path))
        except Exception as e:
            logger.warning("Could not open IFC file for clash check %s: %s", file_path, e)
            return []

        geom_settings = ifcopenshell.geom.settings()
        geom_settings.set(geom_settings.USE_WORLD_COORDS, True)

        target_types = [
            "IfcWall", "IfcWallStandardCase", "IfcBeam", "IfcColumn", "IfcSlab",
            "IfcPipeSegment", "IfcDuctSegment", "IfcFlowFitting", "IfcDoor", "IfcWindow",
            "IfcMember", "IfcCovering", "IfcDistributionElement", "IfcFlowSegment"
        ]
        boxes: list[ElementBox] = []

        for t in target_types:
            try:
                elements = model.by_type(t)
            except Exception:
                continue
            # Sample up to 25 elements per category for responsive real-time clash check
            for prod in elements[:25]:
                try:
                    shape = ifcopenshell.geom.create_shape(geom_settings, prod)
                    verts = shape.geometry.verts
                    if not verts or len(verts) < 3:
                        continue

                    xs = verts[0::3]
                    ys = verts[1::3]
                    zs = verts[2::3]

                    min_pt = (float(min(xs)), float(min(ys)), float(min(zs)))
                    max_pt = (float(max(xs)), float(max(ys)), float(max(zs)))

                    elem_name = prod.Name if prod.Name else f"{t} #{prod.id()}"

                    boxes.append(ElementBox(
                        express_id=prod.id(),
                        name=str(elem_name),
                        type_name=t,
                        model_id=model_id,
                        model_name=model_name,
                        discipline=discipline,
                        min_pt=min_pt,
                        max_pt=max_pt
                    ))
                except Exception:
                    continue
                continue

        return boxes

    @classmethod
    async def compute_clashes(
        cls,
        project_id: str,
        tolerance: float = 0.01,
        model_ids: Optional[list[str]] = None
    ) -> ClashCheckResponse:
        """
        Run geometric collision / clash detection across federated discipline models.
        """
        start_time = time.perf_counter()

        # 1. Gather all models in project
        models_to_check: list[dict[str, Any]] = []

        # Main model
        main_file = settings.PROJECTS_DIR / project_id / "model.ifc"
        if main_file.exists():
            models_to_check.append({
                "id": "main",
                "name": "Main Project Model",
                "discipline": "ARCH",
                "path": main_file
            })

        # Sub-models from database
        async with get_db_connection() as db:
            cursor = await db.execute(
                "SELECT id, name, discipline, file_name FROM project_models WHERE project_id = ?",
                (project_id,)
            )
            rows = await cursor.fetchall()
            for row in rows:
                sub_file = settings.PROJECTS_DIR / project_id / "models" / row["file_name"]
                models_to_check.append({
                    "id": row["id"],
                    "name": row["name"],
                    "discipline": row["discipline"],
                    "path": sub_file
                })

        # Filter by requested model_ids if specified
        if model_ids:
            models_to_check = [m for m in models_to_check if m["id"] in model_ids]

        # 2. Extract bounding boxes for all target models
        all_boxes_by_model: dict[str, list[ElementBox]] = {}
        for m in models_to_check:
            boxes = cls._extract_element_boxes(m["path"], m["id"], m["name"], m["discipline"])
            all_boxes_by_model[m["id"]] = boxes

        clashes: list[ClashItem] = []
        model_id_list = list(all_boxes_by_model.keys())

        # 3. Collision testing
        # If multiple models exist, prioritize cross-model clashes
        if len(model_id_list) > 1:
            for i in range(len(model_id_list)):
                id_a = model_id_list[i]
                boxes_a = all_boxes_by_model[id_a]
                for j in range(i + 1, len(model_id_list)):
                    id_b = model_id_list[j]
                    boxes_b = all_boxes_by_model[id_b]

                    for b_a in boxes_a:
                        for b_b in boxes_b:
                            clash = cls._check_intersection(b_a, b_b, tolerance)
                            if clash:
                                clashes.append(clash)
        else:
            # Single model: detect internal collisions between disparate physical types
            # (e.g. wall intersecting with beam, column intersecting with wall without void)
            if model_id_list:
                boxes = all_boxes_by_model[model_id_list[0]]
                for i in range(len(boxes)):
                    b_a = boxes[i]
                    for j in range(i + 1, len(boxes)):
                        b_b = boxes[j]
                        # Don't flag adjacent walls as clashes unless significant penetration
                        if b_a.type_name == b_b.type_name:
                            continue
                        clash = cls._check_intersection(b_a, b_b, tolerance)
                        if clash:
                            clashes.append(clash)

        hard_count = sum(1 for c in clashes if c.severity == "hard")
        clearance_count = sum(1 for c in clashes if c.severity == "clearance")
        duration_ms = round((time.perf_counter() - start_time) * 1000.0, 2)

        return ClashCheckResponse(
            total_clashes=len(clashes),
            hard_clashes=hard_count,
            clearance_clashes=clearance_count,
            tolerance=tolerance,
            clashes=clashes,
            duration_ms=duration_ms
        )

    @staticmethod
    def _check_intersection(a: ElementBox, b: ElementBox, tolerance: float) -> Optional[ClashItem]:
        """Test AABB overlap with tolerance buffer."""
        # Intersection bounds
        inter_min_x = max(a.min_pt[0], b.min_pt[0])
        inter_max_x = min(a.max_pt[0], b.max_pt[0])
        inter_min_y = max(a.min_pt[1], b.min_pt[1])
        inter_max_y = min(a.max_pt[1], b.max_pt[1])
        inter_min_z = max(a.min_pt[2], b.min_pt[2])
        inter_max_z = min(a.max_pt[2], b.max_pt[2])

        dx = inter_max_x - inter_min_x
        dy = inter_max_y - inter_min_y
        dz = inter_max_z - inter_min_z

        # Overlap requires positive extent in all 3 dimensions
        if dx > -tolerance and dy > -tolerance and dz > -tolerance:
            # Calculate penetration depth
            penetration = min(max(dx, 0.0), max(dy, 0.0), max(dz, 0.0))
            severity = "hard" if (dx > tolerance and dy > tolerance and dz > tolerance) else "clearance"

            center = [
                float((inter_min_x + inter_max_x) / 2.0),
                float((inter_min_y + inter_max_y) / 2.0),
                float((inter_min_z + inter_max_z) / 2.0)
            ]

            return ClashItem(
                id=f"clash_{uuid.uuid4().hex[:8]}",
                element_a_id=a.express_id,
                element_a_name=a.name,
                element_a_type=a.type_name,
                model_a_id=a.model_id,
                model_a_name=a.model_name,
                discipline_a=a.discipline,
                element_b_id=b.express_id,
                element_b_name=b.name,
                element_b_type=b.type_name,
                model_b_id=b.model_id,
                model_b_name=b.model_name,
                discipline_b=b.discipline,
                severity=severity,
                distance=round(penetration, 4),
                intersection_center=center,
                box_min=[float(inter_min_x), float(inter_min_y), float(inter_min_z)],
                box_max=[float(inter_max_x), float(inter_max_y), float(inter_max_z)]
            )

        return None
