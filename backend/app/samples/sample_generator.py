import numpy as np
from pathlib import Path
import ifcopenshell
import ifcopenshell.api
from ..services.ifc_service import IFCService

def generate_samples(samples_dir: Path):
    samples_dir.mkdir(parents=True, exist_ok=True)

    # 1. Duplex Residential (2 Storeys)
    duplex_path = samples_dir / "duplex_residential.ifc"
    IFCService.create_blank_project(duplex_path, "Duplex Residential Villa", "IFC4")
    model = ifcopenshell.open(str(duplex_path))

    model3d = model.by_type("IfcGeometricRepresentationContext")[0]
    body = ifcopenshell.api.run("context.add_context", model, context_type="Model", context_identifier="Body", target_view="MODEL_VIEW", parent=model3d)

    def create_box_mesh(dx: float, dy: float, dz: float):
        verts = [
            (0.0, 0.0, 0.0), (dx, 0.0, 0.0), (dx, dy, 0.0), (0.0, dy, 0.0),
            (0.0, 0.0, dz),  (dx, 0.0, dz),  (dx, dy, dz),  (0.0, dy, dz)
        ]
        faces = [
            (0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (2, 3, 7, 6), (0, 4, 7, 3), (1, 2, 6, 5)
        ]
        return ifcopenshell.api.run("geometry.add_mesh_representation", model, context=body, vertices=[verts], faces=[faces])

    building = model.by_type("IfcBuilding")[0]
    existing_storey = model.by_type("IfcBuildingStorey")[0]
    existing_storey.Name = "Level 01 - Ground Floor"
    existing_storey.Elevation = 0.0

    storey_2 = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcBuildingStorey", name="Level 02 - First Floor")
    storey_2.Elevation = 3.2
    ifcopenshell.api.run("aggregate.assign_object", model, relating_object=building, products=[storey_2])

    storeys = [(existing_storey, 0.0, "L1"), (storey_2, 3.2, "L2")]

    length, width, height = 12.0, 9.0, 3.0
    wall_t = 0.25

    for st, elev, prefix in storeys:
        # Slab
        slab = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcSlab", name=f"{prefix} Floor Slab")
        s_rep = create_box_mesh(length, width, 0.3)
        ifcopenshell.api.run("geometry.assign_representation", model, product=slab, representation=s_rep)
        m_s = np.identity(4)
        m_s[2, 3] = elev - 0.3
        ifcopenshell.api.run("geometry.edit_object_placement", model, product=slab, matrix=m_s)
        ifcopenshell.api.run("spatial.assign_container", model, relating_structure=st, products=[slab])

        # South Wall
        ws = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcWall", name=f"{prefix} South Facade Wall")
        r_ws = ifcopenshell.api.run("geometry.add_wall_representation", model, context=body, length=length, height=height, thickness=wall_t)
        ifcopenshell.api.run("geometry.assign_representation", model, product=ws, representation=r_ws)
        ms = np.identity(4)
        ms[2, 3] = elev
        ifcopenshell.api.run("geometry.edit_object_placement", model, product=ws, matrix=ms)
        ifcopenshell.api.run("spatial.assign_container", model, relating_structure=st, products=[ws])

        # North Wall
        wn = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcWall", name=f"{prefix} North Facade Wall")
        r_wn = ifcopenshell.api.run("geometry.add_wall_representation", model, context=body, length=length, height=height, thickness=wall_t)
        ifcopenshell.api.run("geometry.assign_representation", model, product=wn, representation=r_wn)
        mn = np.identity(4)
        mn[1, 3] = width - wall_t
        mn[2, 3] = elev
        ifcopenshell.api.run("geometry.edit_object_placement", model, product=wn, matrix=mn)
        ifcopenshell.api.run("spatial.assign_container", model, relating_structure=st, products=[wn])

        # West Wall
        ww = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcWall", name=f"{prefix} West Facade Wall")
        r_ww = ifcopenshell.api.run("geometry.add_wall_representation", model, context=body, length=width, height=height, thickness=wall_t)
        ifcopenshell.api.run("geometry.assign_representation", model, product=ww, representation=r_ww)
        mw = np.array([[0, -1, 0, wall_t], [1, 0, 0, 0], [0, 0, 1, elev], [0, 0, 0, 1]], dtype=float)
        ifcopenshell.api.run("geometry.edit_object_placement", model, product=ww, matrix=mw)
        ifcopenshell.api.run("spatial.assign_container", model, relating_structure=st, products=[ww])

        # East Wall
        we = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcWall", name=f"{prefix} East Facade Wall")
        r_we = ifcopenshell.api.run("geometry.add_wall_representation", model, context=body, length=width, height=height, thickness=wall_t)
        ifcopenshell.api.run("geometry.assign_representation", model, product=we, representation=r_we)
        me = np.array([[0, -1, 0, length], [1, 0, 0, 0], [0, 0, 1, elev], [0, 0, 0, 1]], dtype=float)
        ifcopenshell.api.run("geometry.edit_object_placement", model, product=we, matrix=me)
        ifcopenshell.api.run("spatial.assign_container", model, relating_structure=st, products=[we])

        # Interior Partition Wall
        wi = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcWall", name=f"{prefix} Interior Partition Wall")
        r_wi = ifcopenshell.api.run("geometry.add_wall_representation", model, context=body, length=width - wall_t*2, height=height, thickness=0.15)
        ifcopenshell.api.run("geometry.assign_representation", model, product=wi, representation=r_wi)
        mi = np.array([[0, -1, 0, length/2], [1, 0, 0, wall_t], [0, 0, 1, elev], [0, 0, 0, 1]], dtype=float)
        ifcopenshell.api.run("geometry.edit_object_placement", model, product=wi, matrix=mi)
        ifcopenshell.api.run("spatial.assign_container", model, relating_structure=st, products=[wi])

        # Columns
        for ci, (cx, cy) in enumerate([(0.0, 0.0), (length - 0.4, 0.0), (0.0, width - 0.4), (length - 0.4, width - 0.4)]):
            col = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcColumn", name=f"{prefix} Structural Column C{ci+1}")
            c_rep = create_box_mesh(0.4, 0.4, height)
            ifcopenshell.api.run("geometry.assign_representation", model, product=col, representation=c_rep)
            mc = np.identity(4)
            mc[0, 3] = cx
            mc[1, 3] = cy
            mc[2, 3] = elev
            ifcopenshell.api.run("geometry.edit_object_placement", model, product=col, matrix=mc)
            ifcopenshell.api.run("spatial.assign_container", model, relating_structure=st, products=[col])

    # Roof slab
    roof = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcSlab", name="Roof Slab")
    r_rep = create_box_mesh(length + 0.6, width + 0.6, 0.3)
    ifcopenshell.api.run("geometry.assign_representation", model, product=roof, representation=r_rep)
    m_roof = np.identity(4)
    m_roof[0, 3] = -0.3
    m_roof[1, 3] = -0.3
    m_roof[2, 3] = 6.4
    ifcopenshell.api.run("geometry.edit_object_placement", model, product=roof, matrix=m_roof)
    ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey_2, products=[roof])

    model.write(str(duplex_path))

    # 2. Modern Office Pavilion (Open-plan 1 Storey)
    pavilion_path = samples_dir / "office_pavilion.ifc"
    IFCService.create_blank_project(pavilion_path, "Modern Architectural Pavilion", "IFC4")
    model_p = ifcopenshell.open(str(pavilion_path))

    m3d_p = model_p.by_type("IfcGeometricRepresentationContext")[0]
    body_p = ifcopenshell.api.run("context.add_context", model_p, context_type="Model", context_identifier="Body", target_view="MODEL_VIEW", parent=m3d_p)

    def create_box_mesh_p(dx: float, dy: float, dz: float):
        verts = [
            (0.0, 0.0, 0.0), (dx, 0.0, 0.0), (dx, dy, 0.0), (0.0, dy, 0.0),
            (0.0, 0.0, dz),  (dx, 0.0, dz),  (dx, dy, dz),  (0.0, dy, dz)
        ]
        faces = [
            (0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (2, 3, 7, 6), (0, 4, 7, 3), (1, 2, 6, 5)
        ]
        return ifcopenshell.api.run("geometry.add_mesh_representation", model_p, context=body_p, vertices=[verts], faces=[faces])

    storey_p = model_p.by_type("IfcBuildingStorey")[0]
    storey_p.Name = "Level 01 - Main Gallery"

    p_len, p_wid, p_ht = 18.0, 12.0, 4.0

    # Ground floor slab
    slab_p = ifcopenshell.api.run("root.create_entity", model_p, ifc_class="IfcSlab", name="Gallery Ground Floor")
    sp_rep = create_box_mesh_p(p_len, p_wid, 0.4)
    ifcopenshell.api.run("geometry.assign_representation", model_p, product=slab_p, representation=sp_rep)
    m_sp = np.identity(4)
    m_sp[2, 3] = -0.4
    ifcopenshell.api.run("geometry.edit_object_placement", model_p, product=slab_p, matrix=m_sp)
    ifcopenshell.api.run("spatial.assign_container", model_p, relating_structure=storey_p, products=[slab_p])

    # Cantilevered roof slab
    roof_p = ifcopenshell.api.run("root.create_entity", model_p, ifc_class="IfcSlab", name="Cantilevered Canopy Roof")
    rp_rep = create_box_mesh_p(p_len + 2.0, p_wid + 2.0, 0.4)
    ifcopenshell.api.run("geometry.assign_representation", model_p, product=roof_p, representation=rp_rep)
    m_rp = np.identity(4)
    m_rp[0, 3] = -1.0
    m_rp[1, 3] = -1.0
    m_rp[2, 3] = p_ht
    ifcopenshell.api.run("geometry.edit_object_placement", model_p, product=roof_p, matrix=m_rp)
    ifcopenshell.api.run("spatial.assign_container", model_p, relating_structure=storey_p, products=[roof_p])

    # 6 Columns on grid
    col_x = [0.0, p_len / 2 - 0.25, p_len - 0.5]
    col_y = [0.0, p_wid - 0.5]
    for ci, cx in enumerate(col_x):
        for cj, cy in enumerate(col_y):
            col_p = ifcopenshell.api.run("root.create_entity", model_p, ifc_class="IfcColumn", name=f"Pavilion Column C{ci+1}_{cj+1}")
            cp_rep = create_box_mesh_p(0.5, 0.5, p_ht)
            ifcopenshell.api.run("geometry.assign_representation", model_p, product=col_p, representation=cp_rep)
            m_cp = np.identity(4)
            m_cp[0, 3] = cx
            m_cp[1, 3] = cy
            ifcopenshell.api.run("geometry.edit_object_placement", model_p, product=col_p, matrix=m_cp)
            ifcopenshell.api.run("spatial.assign_container", model_p, relating_structure=storey_p, products=[col_p])

    # 2 Glass enclosure walls
    wall_north = ifcopenshell.api.run("root.create_entity", model_p, ifc_class="IfcWall", name="North Glass Facade Wall")
    rep_wn = ifcopenshell.api.run("geometry.add_wall_representation", model_p, context=body_p, length=p_len, height=p_ht, thickness=0.2)
    ifcopenshell.api.run("geometry.assign_representation", model_p, product=wall_north, representation=rep_wn)
    m_wn = np.identity(4)
    m_wn[1, 3] = p_wid - 0.2
    ifcopenshell.api.run("geometry.edit_object_placement", model_p, product=wall_north, matrix=m_wn)
    ifcopenshell.api.run("spatial.assign_container", model_p, relating_structure=storey_p, products=[wall_north])

    wall_south = ifcopenshell.api.run("root.create_entity", model_p, ifc_class="IfcWall", name="South Glass Facade Wall")
    rep_ws = ifcopenshell.api.run("geometry.add_wall_representation", model_p, context=body_p, length=p_len, height=p_ht, thickness=0.2)
    ifcopenshell.api.run("geometry.assign_representation", model_p, product=wall_south, representation=rep_ws)
    ifcopenshell.api.run("geometry.edit_object_placement", model_p, product=wall_south, matrix=np.identity(4))
    ifcopenshell.api.run("spatial.assign_container", model_p, relating_structure=storey_p, products=[wall_south])

    model_p.write(str(pavilion_path))

if __name__ == "__main__":
    generate_samples(Path(__file__).parent)
    print("Sample IFC files generated successfully!")
