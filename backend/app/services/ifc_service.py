import uuid
import math
import logging
from pathlib import Path
from typing import Any, Optional
import ifcopenshell
import ifcopenshell.guid
import ifcopenshell.util.element
import ifcopenshell.util.placement
import ifcopenshell.api

from ..models.schemas import SpatialNode, ElementDetails, PropertySetData, PropertySingle

logger = logging.getLogger("ifc_editor.ifc_service")

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
        
        model.write(str(file_path))
        logger.info("Successfully created blank IFC project at %s", file_path)
        return len(model.by_type("IfcProduct"))

    @staticmethod
    def get_spatial_hierarchy(file_path: Path) -> SpatialNode:
        """Traverse and return the spatial hierarchy tree of the IFC file."""
        if not file_path.exists():
            raise FileNotFoundError(f"IFC file not found: {file_path}")
        
        model = ifcopenshell.open(str(file_path))
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
            
        def build_node(entity: Any) -> SpatialNode:
            node = SpatialNode(
                express_id=entity.id(),
                global_id=entity.GlobalId,
                name=entity.Name or f"{entity.is_a()} #{entity.id()}",
                type=entity.is_a(),
                children=[]
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
            return build_node(projects[0])
        else:
            return SpatialNode(express_id=root_id, global_id=root_guid, name=root_name, type=root_type, children=[])

    @staticmethod
    def get_element_details(file_path: Path, express_id: int) -> ElementDetails:
        """Fetch attributes, Property Sets, and quantities for an IFC entity."""
        if not file_path.exists():
            raise FileNotFoundError(f"IFC file not found: {file_path}")
        
        model = ifcopenshell.open(str(file_path))
        entity = model.by_id(express_id)
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
        Update the 3D placement of an IFC entity from a column-major 4x4 Three.js matrix.
        Extracts translation and orientation vectors and assigns to IfcAxis2Placement3D.
        """
        if not file_path.exists():
            raise FileNotFoundError(f"IFC file not found: {file_path}")
        
        model = ifcopenshell.open(str(file_path))
        entity = model.by_id(express_id)
        if not entity:
            raise ValueError(f"Entity #{express_id} not found.")
        
        # Matrix is column-major:
        # [0, 4,  8, 12]  (Column 0: X vector, Tx)
        # [1, 5,  9, 13]  (Column 1: Y vector, Ty)
        # [2, 6, 10, 14]  (Column 2: Z vector, Tz)
        # [3, 7, 11, 15]
        tx, ty, tz = matrix_16[12], matrix_16[13], matrix_16[14]
        
        # Local X direction (normalized)
        x_dir = (matrix_16[0], matrix_16[1], matrix_16[2])
        x_len = math.sqrt(x_dir[0]**2 + x_dir[1]**2 + x_dir[2]**2) or 1.0
        norm_x = (x_dir[0]/x_len, x_dir[1]/x_len, x_dir[2]/x_len)
        
        # Local Z direction (normalized)
        z_dir = (matrix_16[8], matrix_16[9], matrix_16[10])
        z_len = math.sqrt(z_dir[0]**2 + z_dir[1]**2 + z_dir[2]**2) or 1.0
        norm_z = (z_dir[0]/z_len, z_dir[1]/z_len, z_dir[2]/z_len)
        
        # Create or update placement
        origin = model.create_entity("IfcCartesianPoint", Coordinates=(float(tx), float(ty), float(tz)))
        axis_dir = model.create_entity("IfcDirection", DirectionRatios=(float(norm_z[0]), float(norm_z[1]), float(norm_z[2])))
        ref_dir = model.create_entity("IfcDirection", DirectionRatios=(float(norm_x[0]), float(norm_x[1]), float(norm_x[2])))
        new_axis2 = model.create_entity("IfcAxis2Placement3D", Location=origin, Axis=axis_dir, RefDirection=ref_dir)
        
        if hasattr(entity, "ObjectPlacement") and entity.ObjectPlacement:
            entity.ObjectPlacement.RelativePlacement = new_axis2
        else:
            placement = model.create_entity("IfcLocalPlacement", RelativePlacement=new_axis2)
            entity.ObjectPlacement = placement
            
        model.write(str(file_path))
        logger.info("Updated placement for element #%d in %s", express_id, file_path)
        return True

    @staticmethod
    def update_element_property(
        file_path: Path,
        express_id: int,
        pset_name: str,
        prop_name: str,
        prop_val: Any,
        prop_type: str = "IfcLabel"
    ) -> bool:
        """Add or update a single property in a property set for an IFC entity."""
        if not file_path.exists():
            raise FileNotFoundError(f"IFC file not found: {file_path}")
        
        model = ifcopenshell.open(str(file_path))
        entity = model.by_id(express_id)
        if not entity:
            raise ValueError(f"Entity #{express_id} not found.")
        
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
                HasProperties=[new_prop]
            )
            model.create_entity(
                "IfcRelDefinesByProperties",
                GlobalId=ifcopenshell.guid.new(),
                RelatingPropertyDefinition=target_pset,
                RelatedObjects=[entity]
            )
        else:
            # Update existing property or append new property to existing Pset
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
                
        model.write(str(file_path))
        logger.info("Updated property %s.%s = %s on #%d", pset_name, prop_name, prop_val, express_id)
        return True
