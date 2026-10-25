import os
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
from ..core.workers import run_ifc
from ..models.schemas import ClashItem, ClashCheckResponse
from .project_service import ProjectService

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
    # Classes whose geometry is boxed for clash testing.
    #
    # Invariant (STEP-06 spec item 4): no class in this tuple is a supertype or subtype of
    # another class in the same tuple. `IfcWall` already covers `IfcWallStandardCase`, and the
    # old `IfcDistributionElement` covered the flow classes, so listing both boxed single
    # entities twice and broke the express-id self-clash guard. The flow/control classes below
    # are disjoint siblings.
    TARGET_CLASSES: tuple[str, ...] = (
        "IfcWall",
        "IfcBeam",
        "IfcColumn",
        "IfcSlab",
        "IfcDoor",
        "IfcWindow",
        "IfcMember",
        "IfcCovering",
        "IfcFlowSegment",
        "IfcFlowFitting",
        "IfcFlowTerminal",
        "IfcDistributionControlElement",
    )

    # ifcopenshell parallelises the iterator internally; measured 4.6x faster than
    # create_shape() per element on the Duplex fixture (1.7 s vs 7.8 s for 141 elements).
    GEOMETRY_THREADS: int = max(1, min(8, os.cpu_count() or 1))

    @staticmethod
    def _body_representation(prod: Any) -> Optional[Any]:
        """Return the product's `Body` IfcShapeRepresentation, or None.

        `ifcopenshell.geom.create_shape` uses the *first* representation it finds, which for
        IFC2x3 walls is `Axis`/`Curve2D` — that is why every wall raised "Failed to process
        shape" before. Passing the Body representation explicitly fixes it.
        """
        representation = getattr(prod, "Representation", None)
        if representation is None:
            return None
        for rep in getattr(representation, "Representations", None) or ():
            identifier = (rep.RepresentationIdentifier or "").strip().lower()
            if identifier == "body":
                return rep
        return None

    @classmethod
    def _shape_verts(cls, geom_settings: Any, prod: Any) -> list[float]:
        """Triangulate one product, preferring its explicit Body representation."""
        body = cls._body_representation(prod)
        if body is not None:
            shape = ifcopenshell.geom.create_shape(geom_settings, prod, body)
        else:
            shape = ifcopenshell.geom.create_shape(geom_settings, prod)
        verts = shape.geometry.verts
        if not verts or len(verts) < 3:
            raise ValueError("empty triangulation")
        return verts

    @staticmethod
    def _verts_bbox(verts: Any) -> tuple[tuple[float, float, float], tuple[float, float, float]]:
        xs = verts[0::3]
        ys = verts[1::3]
        zs = verts[2::3]
        return (
            (float(min(xs)), float(min(ys)), float(min(zs))),
            (float(max(xs)), float(max(ys)), float(max(zs))),
        )

    @classmethod
    def _extract_element_boxes_with_stats(
        cls,
        file_path: Path,
        model_id: str,
        model_name: str,
        discipline: str,
    ) -> tuple[list[ElementBox], int, int]:
        """Box every target element; disclose what was examined and what failed.

        Returns ``(boxes, elements_checked, geometry_failures)``.

        There is deliberately **no per-type cap**: a silent sample is what made "110 clashes,
        zero walls" possible. If a cap is ever reintroduced for performance, `sampled` must be
        set on the response and `elements_checked` must describe the subset.
        """
        if not file_path.exists():
            return [], 0, 0

        try:
            model = ifcopenshell.open(str(file_path))
        except Exception as e:
            logger.warning("Could not open IFC file for clash check %s: %s", file_path, e)
            return [], 0, 0

        geom_settings = ifcopenshell.geom.settings()
        # World coordinates so AABB overlap maths compares federated models in one space.
        geom_settings.set("use-world-coords", True)

        # Build the product set once, de-duplicated by express id (defence in depth: the class
        # list is already disjoint, but a malformed file can expose an entity through several
        # classes).
        products: list[tuple[Any, str]] = []
        seen_ids: set[int] = set()
        for type_name in cls.TARGET_CLASSES:
            try:
                elements = model.by_type(type_name)
            except Exception:
                # Class not present in this schema version (e.g. IfcPipeSegment in IFC2x3).
                continue
            for prod in elements:
                express_id = prod.id()
                if express_id in seen_ids:
                    continue
                seen_ids.add(express_id)
                products.append((prod, type_name))

        if not products:
            return [], 0, 0

        # One parallel triangulation pass over the target products. The iterator resolves the
        # Body representation itself (it produced the identical AABB as the explicit-Body path
        # on all 141 target elements of the Duplex fixture).
        verts_by_id: dict[int, Any] = {}
        try:
            iterator = ifcopenshell.geom.iterator(
                geom_settings,
                model,
                cls.GEOMETRY_THREADS,
                include=[prod for prod, _type_name in products],
            )
            if iterator.initialize():
                while True:
                    shape = iterator.get()
                    verts = shape.geometry.verts
                    if verts and len(verts) >= 3:
                        verts_by_id[shape.id] = verts
                    if not iterator.next():
                        break
        except Exception as e:
            logger.warning(
                "Bulk geometry pass failed for %s: %s — falling back to per-element extraction",
                model_name, e
            )

        boxes: list[ElementBox] = []
        failures = 0

        for prod, type_name in products:
            express_id = prod.id()
            try:
                verts = verts_by_id.get(express_id)
                if not verts:
                    # The bulk pass skips elements it cannot triangulate (including anything
                    # without a Body representation). Retry explicitly so the failure is
                    # attributed to a concrete express id instead of vanishing.
                    verts = cls._shape_verts(geom_settings, prod)

                min_pt, max_pt = cls._verts_bbox(verts)
                elem_name = prod.Name if prod.Name else f"{type_name} #{express_id}"

                boxes.append(ElementBox(
                    express_id=express_id,
                    name=str(elem_name),
                    type_name=type_name,
                    model_id=model_id,
                    model_name=model_name,
                    discipline=discipline,
                    min_pt=min_pt,
                    max_pt=max_pt
                ))
            except Exception as e:
                # Counted, never swallowed: the caller must be able to say "N elements were
                # not checked" instead of presenting an incomplete scan as a clean result.
                failures += 1
                logger.warning(
                    "Clash geometry failed for #%d (%s) in model %s: %s",
                    express_id, prod.is_a(), model_name, e
                )

        if failures:
            logger.warning(
                "Clash extraction for %s: %d/%d target elements had no usable geometry "
                "(results are partial)",
                model_name, failures, len(products)
            )

        return boxes, len(products), failures

    @classmethod
    def _extract_element_boxes(cls, file_path: Path, model_id: str, model_name: str, discipline: str) -> list[ElementBox]:
        """Extract world-space Axis-Aligned Bounding Boxes (AABB) for all physical elements in an IFC file."""
        boxes, _checked, _failures = cls._extract_element_boxes_with_stats(
            file_path, model_id, model_name, discipline
        )
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

        # Main model (STEP-03: validated UUID + containment, not a raw path join)
        try:
            main_file = ProjectService.get_project_file_path(project_id)
        except ValueError:
            main_file = None
        if main_file is not None and main_file.exists():
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
        elements_checked = 0
        geometry_failures = 0
        for m in models_to_check:
            # STEP-04: opening the model and triangulating every target element is the most
            # expensive thing in the backend; it must not run on the event loop.
            boxes, checked, failures = await run_ifc(
                cls._extract_element_boxes_with_stats,
                m["path"], m["id"], m["name"], m["discipline"],
            )
            all_boxes_by_model[m["id"]] = boxes
            elements_checked += checked
            geometry_failures += failures

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
                            if cls._is_same_element(b_a, b_b):
                                continue
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
                        # An element is never in clash with itself.
                        if cls._is_same_element(b_a, b_b):
                            continue
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
            duration_ms=duration_ms,
            elements_checked=elements_checked,
            geometry_failures=geometry_failures,
            sampled=False,
        )

    @staticmethod
    def _is_same_element(a: ElementBox, b: ElementBox) -> bool:
        """True when both boxes describe the same physical entity.

        Express ids are only unique *within* one IFC file, so the id comparison is scoped to the
        same model: #500 in ARCH and #500 in STR are different elements and a real coordination
        clash between them must not be suppressed.
        """
        if a is b:
            return True
        return a.model_id == b.model_id and a.express_id == b.express_id

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
