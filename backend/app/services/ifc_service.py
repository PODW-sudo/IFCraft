import uuid
import math
import logging
from pathlib import Path
from typing import Any, Optional
import ifcopenshell
import ifcopenshell.guid
import ifcopenshell.util.element
import ifcopenshell.util.placement
import ifcopenshell.util.unit
import ifcopenshell.api

from ..models.schemas import SpatialNode, ElementDetails, PropertySetData, PropertySingle
from .atomic_store import atomic_write_model
from .model_cache import model_cache

logger = logging.getLogger("ifc_editor.ifc_service")


def open_model_for_read(file_path: Path):
    """Open a project model for a *read* path, served from the STEP-04 model cache.

    The cache key is the project directory name plus the file's `(mtime_ns, size)`, so a
    write through `atomic_write_model` invalidates it and the next read re-parses. A path
    that is not a project model (an undo snapshot, a test fixture) still works: it is just
    cached under its parent directory name and verified by the same stat key.

    Callers must hold the per-project read lock (`atomic_store.project_read_lock`) and run
    inside the bounded IFC pool — `ifcopenshell.file` is not thread-safe.
    """
    file_path = Path(file_path)
    return model_cache.get(file_path.parent.name, file_path)

# ---------------------------------------------------------------------------
# STEP-18: IfcValue allowlist and coercion.
#
# `value_type` used to be taken verbatim from the client and handed to
# `model.create_entity(prop_type, value)`, i.e. used as an *entity class name*: an
# `IfcWall` (with a bogus GlobalId) could be nested inside an IfcPropertySingleValue,
# and a type/value mismatch either raised `RuntimeError: Attribute not set` (a 500) or
# silently wrote `$` (an IfcBoolean that is simply absent). This block is the fix.
# ---------------------------------------------------------------------------

IFC_VALUE_TYPES: frozenset[str] = frozenset({
    "IfcLabel", "IfcText", "IfcIdentifier",
    "IfcReal", "IfcInteger", "IfcBoolean", "IfcLogical",
    "IfcCountMeasure", "IfcTimeStamp",
    "IfcLengthMeasure", "IfcPositiveLengthMeasure",
    "IfcAreaMeasure", "IfcVolumeMeasure", "IfcMassMeasure",
    "IfcPlaneAngleMeasure", "IfcRatioMeasure", "IfcPositiveRatioMeasure",
    "IfcNormalisedRatioMeasure", "IfcThermalTransmittanceMeasure",
    "IfcPowerMeasure", "IfcTimeMeasure",
})

_TEXT_VALUE_TYPES = frozenset({"IfcLabel", "IfcText", "IfcIdentifier"})
_BOOLEAN_VALUE_TYPES = frozenset({"IfcBoolean", "IfcLogical"})
_INTEGER_VALUE_TYPES = frozenset({"IfcInteger", "IfcCountMeasure", "IfcTimeStamp"})
_TRUE_TOKENS = frozenset({"true", "yes", "y", "t", "1"})
_FALSE_TOKENS = frozenset({"false", "no", "n", "f", "0"})
_CONTAINER_TYPES = (dict, list, tuple, set, frozenset)


def _coerce_value(prop_type: str, value: Any, prop_name: str = "value") -> Any:
    """Coerce a client value to the Python type `prop_type` requires, or raise ValueError.

    Coercion is by family (STEP-18 spec 5): text -> str, integer measures -> int,
    real/measures -> float, IfcBoolean/IfcLogical -> a *real* bool. Guards the type's
    own constraints too (IfcPositive* > 0, IfcNormalisedRatioMeasure in [0, 1]).

    A rejected value raises ValueError (mapped to HTTP 422) instead of the
    `RuntimeError: Attribute not set` 500 or the silent `$` write it replaces.
    """
    if prop_type in _TEXT_VALUE_TYPES:
        if value is None or isinstance(value, (bool,) + _CONTAINER_TYPES):
            raise ValueError(
                f"{prop_name}: expected str for {prop_type}, got {value!r}"
            )
        return str(value)

    if prop_type in _BOOLEAN_VALUE_TYPES:
        if isinstance(value, bool):
            return value
        if isinstance(value, int) and value in (0, 1):
            return bool(value)
        if isinstance(value, str):
            token = value.strip().lower()
            if token in _TRUE_TOKENS:
                return True
            if token in _FALSE_TOKENS:
                return False
        raise ValueError(f"{prop_name}: expected bool for {prop_type}, got {value!r}")

    if prop_type in _INTEGER_VALUE_TYPES:
        if isinstance(value, bool) or value is None or isinstance(value, _CONTAINER_TYPES):
            raise ValueError(f"{prop_name}: expected int for {prop_type}, got {value!r}")
        if isinstance(value, int):
            return value
        if isinstance(value, float):
            if value.is_integer():
                return int(value)
            raise ValueError(f"{prop_name}: expected int for {prop_type}, got {value!r}")
        if isinstance(value, str):
            token = value.strip()
            try:
                return int(token)
            except ValueError:
                pass
            try:
                as_float = float(token)
            except ValueError:
                raise ValueError(
                    f"{prop_name}: expected int for {prop_type}, got {value!r}"
                ) from None
            if as_float.is_integer():
                return int(as_float)
        raise ValueError(f"{prop_name}: expected int for {prop_type}, got {value!r}")

    # IfcReal and every Ifc*Measure.
    if isinstance(value, bool) or value is None or isinstance(value, _CONTAINER_TYPES):
        raise ValueError(f"{prop_name}: expected float for {prop_type}, got {value!r}")
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise ValueError(
            f"{prop_name}: expected float for {prop_type}, got {value!r}"
        ) from None
    if not math.isfinite(number):
        raise ValueError(f"{prop_name}: expected a finite float for {prop_type}, got {value!r}")
    if prop_type.startswith("IfcPositive") and number <= 0:
        raise ValueError(f"{prop_name}: {prop_type} must be greater than 0, got {number!r}")
    if prop_type == "IfcNormalisedRatioMeasure" and not 0.0 <= number <= 1.0:
        raise ValueError(
            f"{prop_name}: IfcNormalisedRatioMeasure must be between 0 and 1, got {number!r}"
        )
    return number


def _schema_declaration(model: Any, name: str) -> Optional[Any]:
    """`declaration_by_name` against the model's schema, or None when it does not exist."""
    try:
        schema = ifcopenshell.ifcopenshell_wrapper.schema_by_name(model.schema)
        return schema.declaration_by_name(name)
    except Exception:
        return None


def is_value_type_declaration(model: Any, name: str) -> bool:
    """True only for an IfcValue *type* declaration in this model's schema.

    Entities (IfcWall) and unknown names are rejected: `create_entity` would happily
    nest an entity inside NominalValue, which no receiver accepts (spec 4).
    """
    declaration = _schema_declaration(model, name)
    if declaration is None:
        return False
    return isinstance(declaration, ifcopenshell.ifcopenshell_wrapper.type_declaration)


def _owner_history_is_mandatory(model: Any, entity_name: str) -> bool:
    """True when `entity_name` has a non-optional OwnerHistory attribute in this schema.

    IFC2X3 requires it on IfcPropertySet/IfcRelDefinesByProperties; IFC4/IFC4X3 make it
    OPTIONAL, so writing one there is unnecessary churn (spec 9).
    """
    declaration = _schema_declaration(model, entity_name)
    if declaration is None:
        return False
    try:
        for attribute in declaration.all_attributes():
            if attribute.name() == "OwnerHistory":
                return not attribute.optional()
    except Exception:
        return False
    return False


def _ensure_owner_history(model: Any) -> Optional[Any]:
    """Reuse the model's IfcOwnerHistory, or create one when the model has none.

    Never creates a second IfcOwnerHistory for a model that already has one: an extra
    owner-history entity is churn in a contractual IFC file, and the pre-existing one is
    already the authoring tool's identity.
    """
    existing = model.by_type("IfcOwnerHistory")
    if existing:
        return existing[0]

    try:
        person = model.create_entity("IfcPerson", FamilyName="Editor", GivenName="IFC")
        org = model.create_entity("IfcOrganization", Name="IFC Editor OpenBIM")
        person_org = model.create_entity(
            "IfcPersonAndOrganization", ThePerson=person, TheOrganization=org
        )
        app = model.create_entity(
            "IfcApplication",
            ApplicationDeveloper=org,
            Version="1.0.0",
            ApplicationFullName="IFC Editor",
            ApplicationIdentifier="IFCEditor",
        )
        return model.create_entity(
            "IfcOwnerHistory",
            OwningUser=person_org,
            OwningApplication=app,
            ChangeAction="ADDED",
            CreationDate=1700000000,
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Could not create IfcOwnerHistory: %s", exc)
        return None


def _owner_history_kwargs(model: Any, entity_name: str) -> dict[str, Any]:
    """``{"OwnerHistory": ...}`` only where the schema makes the attribute mandatory."""
    if not _owner_history_is_mandatory(model, entity_name):
        return {}
    owner_history = _ensure_owner_history(model)
    if owner_history is None:
        return {}
    return {"OwnerHistory": owner_history}

class IFCService:
    @staticmethod
    def validate_ifc(file_path: Path) -> dict[str, Any]:
        """Validate an IFC file and return summary metrics."""
        if not file_path.exists():
            raise FileNotFoundError(f"IFC file not found: {file_path}")
        
        ifc_file = ifcopenshell.open(str(file_path))
        schema = ifc_file.schema
        
        products = ifc_file.by_type("IfcProduct")
        projects = ifc_file.by_type("IfcProject")
        project_name = projects[0].Name if projects and projects[0].Name else "Unnamed Project"
        
        return {
            "schema": schema,
            "project_name": str(project_name),
            "element_count": len(products),
            "file_size": file_path.stat().st_size
        }

    @staticmethod
    def create_blank_project(file_path: Path, project_name: str, schema_name: str = "IFC4") -> int:
        """Create a blank, valid IFC building model from scratch."""
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Initialize file with chosen schema
        model = ifcopenshell.file(schema=schema_name)
        
        # Owner history setup
        person = model.create_entity("IfcPerson", FamilyName="Editor", GivenName="IFC")
        org = model.create_entity("IfcOrganization", Name="IFC Editor OpenBIM")
        person_org = model.create_entity("IfcPersonAndOrganization", ThePerson=person, TheOrganization=org)
        app = model.create_entity("IfcApplication", ApplicationDeveloper=org, Version="1.0.0", ApplicationFullName="IFC Editor", ApplicationIdentifier="IFCEditor")
        owner_history = model.create_entity(
            "IfcOwnerHistory",
            OwningUser=person_org,
            OwningApplication=app,
            ChangeAction="ADDED",
            CreationDate=1700000000
        )
        
        # Units setup (SI Units: meter, square meter, cubic meter)
        unit_length = model.create_entity("IfcSIUnit", UnitType="LENGTHUNIT", Name="METRE")
        unit_area = model.create_entity("IfcSIUnit", UnitType="AREAUNIT", Name="SQUARE_METRE")
        unit_vol = model.create_entity("IfcSIUnit", UnitType="VOLUMEUNIT", Name="CUBIC_METRE")
        unit_assignment = model.create_entity("IfcUnitAssignment", Units=[unit_length, unit_area, unit_vol])
        
        # Geometric representation context
        origin_3d = model.create_entity("IfcCartesianPoint", Coordinates=(0.0, 0.0, 0.0))
        axis_z = model.create_entity("IfcDirection", DirectionRatios=(0.0, 0.0, 1.0))
        axis_x = model.create_entity("IfcDirection", DirectionRatios=(1.0, 0.0, 0.0))
        axis2_placement_3d = model.create_entity("IfcAxis2Placement3D", Location=origin_3d, Axis=axis_z, RefDirection=axis_x)
        
        context_3d = model.create_entity(
            "IfcGeometricRepresentationContext",
            ContextType="Model",
            CoordinateSpaceDimension=3,
            Precision=1.0e-5,
            WorldCoordinateSystem=axis2_placement_3d
        )
        
        # Hierarchy: Project -> Site -> Building -> Storey
        project = model.create_entity(
            "IfcProject",
            GlobalId=ifcopenshell.guid.new(),
            OwnerHistory=owner_history,
            Name=project_name,
            Description="Created with IFC Editor",
            RepresentationContexts=[context_3d],
            UnitsInContext=unit_assignment
        )
        
        site_placement = model.create_entity("IfcLocalPlacement", RelativePlacement=axis2_placement_3d)
        site = model.create_entity(
            "IfcSite",
            GlobalId=ifcopenshell.guid.new(),
            OwnerHistory=owner_history,
            Name="Site 01",
            ObjectPlacement=site_placement,
            CompositionType="ELEMENT"
        )
        
        building_placement = model.create_entity("IfcLocalPlacement", PlacementRelTo=site_placement, RelativePlacement=axis2_placement_3d)
        building = model.create_entity(
            "IfcBuilding",
            GlobalId=ifcopenshell.guid.new(),
            OwnerHistory=owner_history,
            Name="Building A",
            ObjectPlacement=building_placement,
            CompositionType="ELEMENT"
        )
        
        storey_placement = model.create_entity("IfcLocalPlacement", PlacementRelTo=building_placement, RelativePlacement=axis2_placement_3d)
        storey = model.create_entity(
            "IfcBuildingStorey",
            GlobalId=ifcopenshell.guid.new(),
            OwnerHistory=owner_history,
            Name="Level 01",
            ObjectPlacement=storey_placement,
            Elevation=0.0,
            CompositionType="ELEMENT"
        )
        
        # Aggregations
        model.create_entity("IfcRelAggregates", GlobalId=ifcopenshell.guid.new(), RelatingObject=project, RelatedObjects=[site])
        model.create_entity("IfcRelAggregates", GlobalId=ifcopenshell.guid.new(), RelatingObject=site, RelatedObjects=[building])
        model.create_entity("IfcRelAggregates", GlobalId=ifcopenshell.guid.new(), RelatingObject=building, RelatedObjects=[storey])
        
        atomic_write_model(model, file_path)
        logger.info("Successfully created blank IFC project at %s", file_path)
        return len(model.by_type("IfcProduct"))

    @staticmethod
    def get_spatial_hierarchy(file_path: Path) -> SpatialNode:
        """Traverse and return the spatial hierarchy tree of the IFC file."""
        if not file_path.exists():
            raise FileNotFoundError(f"IFC file not found: {file_path}")
        
        model = open_model_for_read(file_path)
        projects = model.by_type("IfcProject")
        
        if not projects:
            root_id = 0
            root_guid = str(uuid.uuid4())
            root_name = "Root"
            root_type = "IfcProject"
        else:
            p = projects[0]
            root_id = p.id()
            root_guid = p.GlobalId
            root_name = p.Name or "Project"
            root_type = p.is_a()
            
        # STEP-09: metres per project unit (0.001 for a millimetre file). The spatial tree
        # must publish it once, on the root, so the drawing engine can turn a storey
        # elevation in project units into a real cut height.
        try:
            unit_scale = float(ifcopenshell.util.unit.calculate_unit_scale(model))
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Could not read the model's unit scale: %s", exc)
            unit_scale = 1.0

        def build_node(entity: Any, *, is_root: bool = False) -> SpatialNode:
            # Storeys expose their elevation in PROJECT units; every storey carries the
            # field (0.0 when the attribute is absent) so consumers have one shape.
            is_storey = entity.is_a("IfcBuildingStorey")
            node = SpatialNode(
                express_id=entity.id(),
                global_id=entity.GlobalId,
                name=entity.Name or f"{entity.is_a()} #{entity.id()}",
                type=entity.is_a(),
                children=[],
                elevation=float(entity.Elevation or 0.0) if is_storey else None,
                unit_scale=unit_scale if is_root else None,
            )
            
            # Decompositions (Project -> Site -> Building -> Storey)
            if hasattr(entity, "IsDecomposedBy"):
                for rel in entity.IsDecomposedBy:
                    for child in rel.RelatedObjects:
                        node.children.append(build_node(child))
            
            # Contained spatial elements (Storey -> Walls, Columns, Slabs, etc.)
            if hasattr(entity, "ContainsElements"):
                for rel in entity.ContainsElements:
                    for child in rel.RelatedElements:
                        node.children.append(SpatialNode(
                            express_id=child.id(),
                            global_id=child.GlobalId,
                            name=child.Name or f"{child.is_a()} #{child.id()}",
                            type=child.is_a(),
                            children=[]
                        ))
            return node

        if projects:
            return build_node(projects[0], is_root=True)
        else:
            return SpatialNode(
                express_id=root_id,
                global_id=root_guid,
                name=root_name,
                type=root_type,
                children=[],
                unit_scale=unit_scale,
            )

    @staticmethod
    def get_element_details(file_path: Path, express_id: int) -> ElementDetails:
        """Fetch attributes, Property Sets, and quantities for an IFC entity."""
        if not file_path.exists():
            raise FileNotFoundError(f"IFC file not found: {file_path}")
        
        model = open_model_for_read(file_path)
        entity = model.by_id(express_id)
        # A placement/axis/representation instance is a valid express id but is not a product:
        # it has no GlobalId, so serialising it used to raise AttributeError -> 500. A request
        # for a non-product element is a 404, not a server fault.
        if entity is None or not entity.is_a("IfcProduct"):
            raise ValueError(f"Element #{express_id} is not an IFC product")
        if not entity:
            raise ValueError(f"Entity with expressID {express_id} not found in model.")
        
        psets: list[PropertySetData] = []
        quantities: dict[str, Any] = {}
        
        # Extract property sets via IsDefinedBy
        if hasattr(entity, "IsDefinedBy"):
            for rel in entity.IsDefinedBy:
                if rel.is_a("IfcRelDefinesByProperties"):
                    prop_def = rel.RelatingPropertyDefinition
                    if prop_def.is_a("IfcPropertySet"):
                        pset_obj = PropertySetData(name=prop_def.Name, properties=[])
                        if hasattr(prop_def, "HasProperties"):
                            for prop in prop_def.HasProperties:
                                if prop.is_a("IfcPropertySingleValue"):
                                    nom_val = prop.NominalValue.wrappedValue if prop.NominalValue else None
                                    val_type = prop.NominalValue.is_a() if prop.NominalValue else "IfcLabel"
                                    pset_obj.properties.append(PropertySingle(
                                        name=prop.Name,
                                        value=nom_val,
                                        value_type=val_type
                                    ))
                        psets.append(pset_obj)
                    elif prop_def.is_a("IfcElementQuantity"):
                        if hasattr(prop_def, "Quantities"):
                            for q in prop_def.Quantities:
                                if hasattr(q, "VolumeValue"):
                                    quantities[q.Name] = q.VolumeValue
                                elif hasattr(q, "AreaValue"):
                                    quantities[q.Name] = q.AreaValue
                                elif hasattr(q, "LengthValue"):
                                    quantities[q.Name] = q.LengthValue
                                elif hasattr(q, "CountValue"):
                                    quantities[q.Name] = q.CountValue
                                    
        return ElementDetails(
            express_id=entity.id(),
            global_id=entity.GlobalId,
            name=entity.Name or f"{entity.is_a()} #{entity.id()}",
            type=entity.is_a(),
            psets=psets,
            quantities=quantities
        )

    @staticmethod
    def update_element_placement(file_path: Path, express_id: int, matrix_16: list[float]) -> bool:
        """
        Update the 3D placement of an IFC entity from a column-major 4x4 WORLD matrix.

        Unit contract: the translation column (indices 12-14) is in **SI metres**, matching the
        `is_si=True` flag passed to `geometry.edit_object_placement` below (ifcopenshell converts
        metres to project units, e.g. millimetres, itself). Callers holding a matrix in project
        units - such as `get_element_placement_matrix` - must scale the translation by
        `ifcopenshell.util.unit.calculate_unit_scale(model)` before calling.

        The matrix is a world matrix; ifcopenshell resolves the parent `PlacementRelTo` frame.
        Falls back to a direct relative placement if the API call fails.
        """
        if not file_path.exists():
            raise FileNotFoundError(f"IFC file not found: {file_path}")
        
        model = ifcopenshell.open(str(file_path))
        entity = model.by_id(express_id)
        if not entity:
            raise ValueError(f"Entity #{express_id} not found.")
        
        import numpy as np
        # Convert column-major 16-element Three.js matrix to 4x4 row-major transform
        mat4 = np.array(matrix_16, dtype=float).reshape((4, 4), order='F')
        
        try:
            # Preferred: buildingSMART / ifcopenshell API preserving parent PlacementRelTo chains
            ifcopenshell.api.run("geometry.edit_object_placement", model, product=entity, matrix=mat4, is_si=True)
        except Exception as api_err:
            logger.warning("geometry.edit_object_placement fallback for entity #%d: %s", express_id, api_err)
            # Fallback manual placement creation
            tx, ty, tz = matrix_16[12], matrix_16[13], matrix_16[14]
            
            x_dir = (matrix_16[0], matrix_16[1], matrix_16[2])
            x_len = math.sqrt(x_dir[0]**2 + x_dir[1]**2 + x_dir[2]**2) or 1.0
            norm_x = (x_dir[0]/x_len, x_dir[1]/x_len, x_dir[2]/x_len)
            
            z_dir = (matrix_16[8], matrix_16[9], matrix_16[10])
            z_len = math.sqrt(z_dir[0]**2 + z_dir[1]**2 + z_dir[2]**2) or 1.0
            norm_z = (z_dir[0]/z_len, z_dir[1]/z_len, z_dir[2]/z_len)
            
            origin = model.create_entity("IfcCartesianPoint", Coordinates=(float(tx), float(ty), float(tz)))
            axis_dir = model.create_entity("IfcDirection", DirectionRatios=(float(norm_z[0]), float(norm_z[1]), float(norm_z[2])))
            ref_dir = model.create_entity("IfcDirection", DirectionRatios=(float(norm_x[0]), float(norm_x[1]), float(norm_x[2])))
            new_axis2 = model.create_entity("IfcAxis2Placement3D", Location=origin, Axis=axis_dir, RefDirection=ref_dir)
            
            if hasattr(entity, "ObjectPlacement") and entity.ObjectPlacement:
                entity.ObjectPlacement.RelativePlacement = new_axis2
            else:
                placement = model.create_entity("IfcLocalPlacement", RelativePlacement=new_axis2)
                entity.ObjectPlacement = placement
            
        atomic_write_model(model, file_path)
        logger.info("Updated placement for element #%d in %s", express_id, file_path)
        return True

    @staticmethod
    def get_element_placement_matrix(file_path: Path, express_id: int) -> list[float]:
        """Column-major 4x4 WORLD matrix for an element, in PROJECT UNITS.

        The full `IfcLocalPlacement.PlacementRelTo` chain is resolved, so the translation is the
        element's world position rather than its local offset. Callers that need SI must convert
        with `ifcopenshell.util.unit.calculate_unit_scale(model)` (project units per metre).

        Returns the identity for a missing file or an element with no placement.
        """
        identity = [1.0, 0.0, 0.0, 0.0,  0.0, 1.0, 0.0, 0.0,  0.0, 0.0, 1.0, 0.0,  0.0, 0.0, 0.0, 1.0]
        if not file_path.exists():
            return identity
        model = open_model_for_read(file_path)
        entity = model.by_id(express_id)
        if not entity or not getattr(entity, "ObjectPlacement", None):
            return identity

        matrix = ifcopenshell.util.placement.get_local_placement(entity.ObjectPlacement)
        return [float(v) for v in matrix.flatten(order="F")]

    @staticmethod
    def update_element_property(
        file_path: Path,
        express_id: int,
        pset_name: str,
        prop_name: str,
        prop_val: Any,
        prop_type: str = "IfcLabel"
    ) -> bool:
        """Add or update a single property in a property set for an IFC entity.

        Validation happens in this order, before anything is created or written
        (STEP-18 spec 3-6):

        1. the entity exists;
        2. `prop_type` is in `IFC_VALUE_TYPES`;
        3. `prop_type` is a *type* declaration in this model's schema (not an entity);
        4. the value coerces to the type's Python representation.

        Only then is `NominalValue` created, so a rejected edit leaves `model.ifc`
        byte-identical. New IFC2X3 psets carry the mandatory `OwnerHistory` (F-015).
        """
        if not file_path.exists():
            raise FileNotFoundError(f"IFC file not found: {file_path}")

        model = ifcopenshell.open(str(file_path))
        entity = model.by_id(express_id)
        if not entity:
            raise ValueError(f"Entity #{express_id} not found.")

        # 1. The allowlist guard is duplicated from the Pydantic Literal on purpose: the
        #    service is called directly by cad_service/ai_service, which never validate.
        if prop_type not in IFC_VALUE_TYPES:
            raise ValueError(
                f"{prop_name}: unsupported value_type {prop_type!r}; expected one of "
                f"{sorted(IFC_VALUE_TYPES)}"
            )

        # 2. IfcWall/IfcSlab are entities, not IfcValue members - refuse them explicitly.
        if not is_value_type_declaration(model, prop_type):
            raise ValueError(
                f"{prop_name}: {prop_type!r} is not an IfcValue type in schema {model.schema}"
            )

        # 3. From here on the value is a plain Python type `create_entity` cannot drop.
        prop_val = _coerce_value(prop_type, prop_val, prop_name)

        # Find existing Pset
        target_pset = None
        if hasattr(entity, "IsDefinedBy"):
            for rel in entity.IsDefinedBy:
                if rel.is_a("IfcRelDefinesByProperties"):
                    prop_def = rel.RelatingPropertyDefinition
                    if prop_def.is_a("IfcPropertySet") and prop_def.Name == pset_name:
                        target_pset = prop_def
                        break

        # If Pset not found, create new Pset and relate to entity
        if target_pset is None:
            new_prop = model.create_entity(
                "IfcPropertySingleValue",
                Name=prop_name,
                NominalValue=model.create_entity(prop_type, prop_val)
            )
            target_pset = model.create_entity(
                "IfcPropertySet",
                GlobalId=ifcopenshell.guid.new(),
                Name=pset_name,
                HasProperties=[new_prop],
                **_owner_history_kwargs(model, "IfcPropertySet"),
            )
            model.create_entity(
                "IfcRelDefinesByProperties",
                GlobalId=ifcopenshell.guid.new(),
                RelatingPropertyDefinition=target_pset,
                RelatedObjects=[entity],
                **_owner_history_kwargs(model, "IfcRelDefinesByProperties"),
            )
        else:
            # Update existing property or append new property to existing Pset.
            # A reused pset keeps its own OwnerHistory untouched (spec 9).
            found_prop = False
            if hasattr(target_pset, "HasProperties"):
                for prop in target_pset.HasProperties:
                    if prop.is_a("IfcPropertySingleValue") and prop.Name == prop_name:
                        prop.NominalValue = model.create_entity(prop_type, prop_val)
                        found_prop = True
                        break
            if not found_prop:
                new_prop = model.create_entity(
                    "IfcPropertySingleValue",
                    Name=prop_name,
                    NominalValue=model.create_entity(prop_type, prop_val)
                )
                curr_props = list(target_pset.HasProperties) if hasattr(target_pset, "HasProperties") else []
                curr_props.append(new_prop)
                target_pset.HasProperties = curr_props

        atomic_write_model(model, file_path)
        logger.info("Updated property %s.%s = %s on #%d", pset_name, prop_name, prop_val, express_id)
        return True
