import re
import json
import math
import uuid
import logging
from typing import Any, Optional
from pathlib import Path
import httpx
import numpy as np
import ifcopenshell
import ifcopenshell.api

from ..core.config import settings
from ..services.ifc_service import IFCService
from ..services.project_service import ProjectService
from ..models.schemas import ChatMessage, ToolCall, CopilotChatRequest, CopilotChatResponse

logger = logging.getLogger("ifc_editor.ai_service")

# ---------------------------------------------------------------------------
# Tool Declarations (Standard OpenAI / Anthropic / Gemini formats)
# ---------------------------------------------------------------------------

OPENAI_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "generate_building",
            "description": "Parametrically generate architectural building elements (storeys, slabs, perimeter walls, and columns) in the active IFC project.",
            "parameters": {
                "type": "object",
                "properties": {
                    "length": {"type": "number", "description": "Building length in meters (along X axis)", "default": 10.0},
                    "width": {"type": "number", "description": "Building width in meters (along Y axis)", "default": 8.0},
                    "num_storeys": {"type": "integer", "description": "Number of above-ground storeys/levels", "default": 1},
                    "storey_height": {"type": "number", "description": "Floor-to-floor height in meters", "default": 3.0},
                    "building_name": {"type": "string", "description": "Optional name for the building", "default": "Architectural Model"}
                },
                "required": ["length", "width"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "transform_element",
            "description": "Translate or rotate an existing IFC element in 3D space by relative delta offsets.",
            "parameters": {
                "type": "object",
                "properties": {
                    "element_id": {"type": "integer", "description": "Express ID of the element to transform"},
                    "dx": {"type": "number", "description": "Delta translation along X in meters", "default": 0.0},
                    "dy": {"type": "number", "description": "Delta translation along Y in meters", "default": 0.0},
                    "dz": {"type": "number", "description": "Delta translation along Z in meters", "default": 0.0},
                    "rx": {"type": "number", "description": "Delta rotation around X in degrees", "default": 0.0},
                    "ry": {"type": "number", "description": "Delta rotation around Y in degrees", "default": 0.0},
                    "rz": {"type": "number", "description": "Delta rotation around Z in degrees", "default": 0.0}
                },
                "required": ["element_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_property",
            "description": "Add or update a property set attribute (Pset) on a specific IFC element.",
            "parameters": {
                "type": "object",
                "properties": {
                    "element_id": {"type": "integer", "description": "Express ID of the element"},
                    "pset_name": {"type": "string", "description": "Name of the Property Set, e.g. 'Pset_WallCommon'"},
                    "property_name": {"type": "string", "description": "Property name, e.g. 'IsExternal', 'LoadBearing', 'FireRating'"},
                    "value": {"description": "Property value (boolean, string, or number)"}
                },
                "required": ["element_id", "pset_name", "property_name", "value"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "query_model",
            "description": "Query information, element counts, hierarchy, or properties from the IFC model.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query_type": {
                        "type": "string",
                        "enum": ["summary", "count_by_type", "list_elements", "element_info"],
                        "description": "Type of query to perform",
                        "default": "summary"
                    },
                    "filters": {
                        "type": "object",
                        "description": "Optional filters such as ifc_class (e.g. 'IfcWall') or express_id",
                        "properties": {
                            "ifc_class": {"type": "string"},
                            "express_id": {"type": "integer"}
                        }
                    }
                }
            }
        }
    }
]

# ---------------------------------------------------------------------------
# AIService implementation
# ---------------------------------------------------------------------------

class AIService:
    @staticmethod
    def get_supported_providers() -> list[dict[str, Any]]:
        return [
            {
                "id": "gemini",
                "name": "Google Gemini",
                "models": ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"],
                "default_model": "gemini-2.5-flash",
                "requires_api_key": True,
                "has_server_key": bool(settings.GEMINI_API_KEY)
            },
            {
                "id": "claude",
                "name": "Anthropic Claude",
                "models": ["claude-3-7-sonnet", "claude-3-5-sonnet"],
                "default_model": "claude-3-7-sonnet",
                "requires_api_key": True,
                "has_server_key": bool(settings.ANTHROPIC_API_KEY)
            },
            {
                "id": "openai",
                "name": "OpenAI",
                "models": ["gpt-4.5", "gpt-4o", "o3-mini"],
                "default_model": "gpt-4o",
                "requires_api_key": True,
                "has_server_key": bool(settings.OPENAI_API_KEY)
            },
            {
                "id": "ollama",
                "name": "Ollama / Local LLM",
                "models": ["llama3.1", "qwen2.5-coder", "mistral"],
                "default_model": "llama3.1",
                "default_base_url": "http://localhost:11434/v1",
                "requires_api_key": False,
                "has_server_key": True
            },
            {
                "id": "local",
                "name": "Built-in Assistant (Zero Key / Offline)",
                "models": ["deterministic-engine"],
                "default_model": "deterministic-engine",
                "requires_api_key": False,
                "has_server_key": True
            }
        ]

    # -----------------------------------------------------------------------
    # Tool Execution Handlers
    # -----------------------------------------------------------------------

    @classmethod
    async def execute_tool(cls, project_id: str, name: str, args: dict[str, Any]) -> dict[str, Any]:
        """Execute a tool against the project model and return result."""
        file_path = ProjectService.get_project_file_path(project_id)
        if not file_path.exists():
            return {"error": f"Project file {file_path} not found."}

        try:
            if name == "generate_building":
                return await cls._exec_generate_building(project_id, file_path, args)
            elif name == "transform_element":
                return await cls._exec_transform_element(project_id, file_path, args)
            elif name == "update_property":
                return await cls._exec_update_property(project_id, file_path, args)
            elif name == "query_model":
                return await cls._exec_query_model(project_id, file_path, args)
            else:
                return {"error": f"Unknown tool name: {name}"}
        except Exception as e:
            logger.exception("Error executing tool %s: %s", name, e)
            return {"error": str(e)}

    @classmethod
    async def _exec_generate_building(cls, project_id: str, file_path: Path, args: dict[str, Any]) -> dict[str, Any]:
        length = float(args.get("length", 10.0))
        width = float(args.get("width", 8.0))
        num_storeys = int(args.get("num_storeys", 1))
        storey_height = float(args.get("storey_height", 3.0))
        building_name = args.get("building_name", "Parametric Building")

        model = ifcopenshell.open(str(file_path))

        # Ensure Model 3D Context and Body SubContext exist
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
                "context.add_context", model,
                context_type="Model",
                context_identifier="Body",
                target_view="MODEL_VIEW",
                parent=model3d
            )

        # Helper to create box mesh representation
        def create_box_mesh(dx: float, dy: float, dz: float):
            verts = [
                (0.0, 0.0, 0.0), (dx, 0.0, 0.0), (dx, dy, 0.0), (0.0, dy, 0.0),
                (0.0, 0.0, dz),  (dx, 0.0, dz),  (dx, dy, dz),  (0.0, dy, dz)
            ]
            faces = [
                (0, 3, 2, 1), # bottom
                (4, 5, 6, 7), # top
                (0, 1, 5, 4), # front
                (2, 3, 7, 6), # back
                (0, 4, 7, 3), # left
                (1, 2, 6, 5)  # right
            ]
            return ifcopenshell.api.run("geometry.add_mesh_representation", model, context=body, vertices=[verts], faces=[faces])

        existing_storeys = model.by_type("IfcBuildingStorey")
        building = model.by_type("IfcBuilding")[0] if model.by_type("IfcBuilding") else None

        generated_elements_count = 0
        wall_thickness = 0.25
        col_size = 0.35

        for level_idx in range(num_storeys):
            elevation = level_idx * storey_height
            level_name = f"Level {level_idx + 1:02d}"

            if level_idx < len(existing_storeys):
                storey = existing_storeys[level_idx]
            else:
                storey = ifcopenshell.api.run(
                    "root.create_entity", model,
                    ifc_class="IfcBuildingStorey",
                    name=level_name
                )
                storey.Elevation = elevation
                if building:
                    ifcopenshell.api.run("aggregate.assign_object", model, relating_object=building, products=[storey])

            # 1. Floor Slab
            slab = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcSlab", name=f"{level_name} Floor Slab")
            slab_rep = create_box_mesh(length, width, 0.3)
            ifcopenshell.api.run("geometry.assign_representation", model, product=slab, representation=slab_rep)
            mat_slab = np.identity(4)
            mat_slab[2, 3] = elevation - 0.3
            ifcopenshell.api.run("geometry.edit_object_placement", model, product=slab, matrix=mat_slab)
            ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey, products=[slab])
            generated_elements_count += 1

            # 2. Perimeter Walls
            # South Wall (along X, y=0)
            w_south = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcWall", name=f"{level_name} South Wall")
            rep_s = ifcopenshell.api.run("geometry.add_wall_representation", model, context=body, length=length, height=storey_height, thickness=wall_thickness)
            ifcopenshell.api.run("geometry.assign_representation", model, product=w_south, representation=rep_s)
            ms = np.identity(4)
            ms[2, 3] = elevation
            ifcopenshell.api.run("geometry.edit_object_placement", model, product=w_south, matrix=ms)
            ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey, products=[w_south])

            # North Wall (along X, y=width - thickness)
            w_north = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcWall", name=f"{level_name} North Wall")
            rep_n = ifcopenshell.api.run("geometry.add_wall_representation", model, context=body, length=length, height=storey_height, thickness=wall_thickness)
            ifcopenshell.api.run("geometry.assign_representation", model, product=w_north, representation=rep_n)
            mn = np.identity(4)
            mn[1, 3] = width - wall_thickness
            mn[2, 3] = elevation
            ifcopenshell.api.run("geometry.edit_object_placement", model, product=w_north, matrix=mn)
            ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey, products=[w_north])

            # West Wall (along Y, x=0)
            w_west = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcWall", name=f"{level_name} West Wall")
            rep_w = ifcopenshell.api.run("geometry.add_wall_representation", model, context=body, length=width, height=storey_height, thickness=wall_thickness)
            ifcopenshell.api.run("geometry.assign_representation", model, product=w_west, representation=rep_w)
            mw = np.array([
                [0.0, -1.0, 0.0, wall_thickness],
                [1.0,  0.0, 0.0, 0.0],
                [0.0,  0.0, 1.0, elevation],
                [0.0,  0.0, 0.0, 1.0]
            ])
            ifcopenshell.api.run("geometry.edit_object_placement", model, product=w_west, matrix=mw)
            ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey, products=[w_west])

            # East Wall (along Y, x=length)
            w_east = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcWall", name=f"{level_name} East Wall")
            rep_e = ifcopenshell.api.run("geometry.add_wall_representation", model, context=body, length=width, height=storey_height, thickness=wall_thickness)
            ifcopenshell.api.run("geometry.assign_representation", model, product=w_east, representation=rep_e)
            me = np.array([
                [0.0, -1.0, 0.0, length],
                [1.0,  0.0, 0.0, 0.0],
                [0.0,  0.0, 1.0, elevation],
                [0.0,  0.0, 0.0, 1.0]
            ])
            ifcopenshell.api.run("geometry.edit_object_placement", model, product=w_east, matrix=me)
            ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey, products=[w_east])
            generated_elements_count += 4

            # 3. Corner Columns
            corners = [
                (0.0, 0.0),
                (length - col_size, 0.0),
                (0.0, width - col_size),
                (length - col_size, width - col_size)
            ]
            for c_i, (cx, cy) in enumerate(corners):
                col = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcColumn", name=f"{level_name} Column C{c_i+1}")
                col_rep = create_box_mesh(col_size, col_size, storey_height)
                ifcopenshell.api.run("geometry.assign_representation", model, product=col, representation=col_rep)
                mc = np.identity(4)
                mc[0, 3] = cx
                mc[1, 3] = cy
                mc[2, 3] = elevation
                ifcopenshell.api.run("geometry.edit_object_placement", model, product=col, matrix=mc)
                ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey, products=[col])
                generated_elements_count += 1

        model.write(str(file_path))

        # Record edit and touch DB
        await ProjectService.record_edit(
            project_id=project_id,
            user_id="ai-copilot",
            user_name="AI Copilot",
            action_type="generate_building",
            express_id=None,
            entity_type="IfcBuilding",
            payload={"length": length, "width": width, "storeys": num_storeys, "elements": generated_elements_count}
        )

        return {
            "success": True,
            "summary": f"Generated {num_storeys}-storey building ({length}m x {width}m x {storey_height}m per floor) with {generated_elements_count} elements.",
            "num_storeys": num_storeys,
            "element_count": generated_elements_count,
            "length": length,
            "width": width
        }

    @classmethod
    async def _exec_transform_element(cls, project_id: str, file_path: Path, args: dict[str, Any]) -> dict[str, Any]:
        element_id = int(args["element_id"])
        dx = float(args.get("dx", 0.0))
        dy = float(args.get("dy", 0.0))
        dz = float(args.get("dz", 0.0))
        rx = float(args.get("rx", 0.0))
        ry = float(args.get("ry", 0.0))
        rz = float(args.get("rz", 0.0))

        current_matrix_16 = IFCService.get_element_placement_matrix(file_path, element_id)

        # Convert column-major 16-element array to 4x4 numpy matrix
        M = np.array(current_matrix_16).reshape((4, 4), order="F")

        # Delta translation
        T = np.identity(4)
        T[0, 3] = dx
        T[1, 3] = dy
        T[2, 3] = dz

        # Delta rotations in degrees
        rad_x = math.radians(rx)
        rad_y = math.radians(ry)
        rad_z = math.radians(rz)

        Rx = np.array([
            [1.0, 0.0, 0.0, 0.0],
            [0.0, math.cos(rad_x), -math.sin(rad_x), 0.0],
            [0.0, math.sin(rad_x), math.cos(rad_x), 0.0],
            [0.0, 0.0, 0.0, 1.0]
        ])
        Ry = np.array([
            [math.cos(rad_y), 0.0, math.sin(rad_y), 0.0],
            [0.0, 1.0, 0.0, 0.0],
            [-math.sin(rad_y), 0.0, math.cos(rad_y), 0.0],
            [0.0, 0.0, 0.0, 1.0]
        ])
        Rz = np.array([
            [math.cos(rad_z), -math.sin(rad_z), 0.0, 0.0],
            [math.sin(rad_z), math.cos(rad_z), 0.0, 0.0],
            [0.0, 0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, 1.0]
        ])
        R = Rz @ Ry @ Rx

        # Apply transformation
        M_new = T @ R @ M
        new_matrix_16 = M_new.flatten(order="F").tolist()

        IFCService.update_element_placement(file_path, element_id, new_matrix_16)

        await ProjectService.record_edit(
            project_id=project_id,
            user_id="ai-copilot",
            user_name="AI Copilot",
            action_type="transform_element",
            express_id=element_id,
            entity_type="IfcProduct",
            payload={"matrix": new_matrix_16, "delta": {"dx": dx, "dy": dy, "dz": dz, "rx": rx, "ry": ry, "rz": rz}}
        )

        return {
            "success": True,
            "element_id": element_id,
            "summary": f"Transformed element #{element_id} by delta (dx={dx}m, dy={dy}m, dz={dz}m, rx={rx}°, ry={ry}°, rz={rz}°).",
            "new_position": [float(M_new[0, 3]), float(M_new[1, 3]), float(M_new[2, 3])],
            "matrix": new_matrix_16
        }

    @classmethod
    async def _exec_update_property(cls, project_id: str, file_path: Path, args: dict[str, Any]) -> dict[str, Any]:
        element_id = int(args["element_id"])
        pset_name = str(args["pset_name"])
        property_name = str(args["property_name"])
        value = args["value"]

        # Infer IFC property type
        if isinstance(value, bool):
            prop_type = "IfcBoolean"
        elif isinstance(value, int):
            prop_type = "IfcInteger"
        elif isinstance(value, float):
            prop_type = "IfcReal"
        else:
            prop_type = "IfcLabel"
            value = str(value)

        IFCService.update_element_property(file_path, element_id, pset_name, property_name, value, prop_type)

        await ProjectService.record_edit(
            project_id=project_id,
            user_id="ai-copilot",
            user_name="AI Copilot",
            action_type="update_property",
            express_id=element_id,
            entity_type="IfcProduct",
            payload={"pset_name": pset_name, "property_name": property_name, "value": value}
        )

        return {
            "success": True,
            "element_id": element_id,
            "pset_name": pset_name,
            "property_name": property_name,
            "value": value,
            "summary": f"Updated property {pset_name}.{property_name} = {value} on element #{element_id}."
        }

    @classmethod
    async def _exec_query_model(cls, project_id: str, file_path: Path, args: dict[str, Any]) -> dict[str, Any]:
        query_type = args.get("query_type", "summary")
        filters = args.get("filters", {}) or {}

        model = ifcopenshell.open(str(file_path))
        project = model.by_type("IfcProject")[0] if model.by_type("IfcProject") else None

        if query_type == "summary":
            counts = {}
            for entity in model:
                cls_name = entity.is_a()
                counts[cls_name] = counts.get(cls_name, 0) + 1

            storeys = [s.Name for s in model.by_type("IfcBuildingStorey")]
            return {
                "success": True,
                "project_name": project.Name if project else "Unnamed",
                "schema": model.schema,
                "storeys": storeys,
                "total_entities": len(model),
                "type_breakdown": {k: v for k, v in counts.items() if k.startswith("Ifc") and v > 0},
                "summary": f"Model contains {len(model)} entities across {len(storeys)} storeys ({', '.join(storeys) or 'None'})."
            }

        elif query_type == "count_by_type":
            target_class = filters.get("ifc_class")
            if target_class:
                matches = model.by_type(target_class)
                return {
                    "success": True,
                    "ifc_class": target_class,
                    "count": len(matches),
                    "summary": f"Found {len(matches)} instance(s) of {target_class}."
                }
            else:
                counts = {}
                for entity in model:
                    if entity.is_a().startswith("Ifc") and not entity.is_a().startswith("IfcRel") and not entity.is_a().startswith("IfcCartesian"):
                        counts[entity.is_a()] = counts.get(entity.is_a(), 0) + 1
                return {
                    "success": True,
                    "counts": counts,
                    "summary": f"Counted {sum(counts.values())} spatial and product elements."
                }

        elif query_type == "list_elements":
            target_class = filters.get("ifc_class", "IfcProduct")
            elements = model.by_type(target_class)
            element_list = [
                {
                    "express_id": e.id(),
                    "name": getattr(e, "Name", None) or f"{e.is_a()} #{e.id()}",
                    "type": e.is_a()
                }
                for e in elements[:100] # Limit to first 100
            ]
            return {
                "success": True,
                "count": len(elements),
                "elements": element_list,
                "summary": f"Listed {len(element_list)} of {len(elements)} elements of type {target_class}."
            }

        elif query_type == "element_info":
            express_id = filters.get("express_id")
            if not express_id:
                return {"error": "express_id filter is required for element_info."}
            details = IFCService.get_element_details(file_path, int(express_id))
            return {
                "success": True,
                "element": details.model_dump(),
                "summary": f"Details for element #{express_id}: {details.name} ({details.type})."
            }

        return {"error": f"Unsupported query_type: {query_type}"}

    # -----------------------------------------------------------------------
    # Multi-Provider Dispatcher
    # -----------------------------------------------------------------------

    @staticmethod
    def _convert_schema_to_gemini(schema: Any) -> Any:
        """Recursively convert JSON Schema types to Gemini uppercase Type enums."""
        if not isinstance(schema, dict):
            return schema
        new_schema = {}
        type_mapping = {
            "string": "STRING",
            "number": "NUMBER",
            "integer": "INTEGER",
            "boolean": "BOOLEAN",
            "array": "ARRAY",
            "object": "OBJECT"
        }
        for k, v in schema.items():
            if k == "type" and isinstance(v, str):
                new_schema["type"] = type_mapping.get(v.lower(), v.upper())
            elif k == "properties" and isinstance(v, dict):
                new_schema["properties"] = {
                    pk: AIService._convert_schema_to_gemini(pv)
                    for pk, pv in v.items()
                }
            elif k == "items" and isinstance(v, dict):
                new_schema["items"] = AIService._convert_schema_to_gemini(v)
            else:
                new_schema[k] = v
        return new_schema

    @classmethod
    async def chat(cls, request: CopilotChatRequest) -> CopilotChatResponse:
        provider = request.provider.lower()
        api_key = request.api_key or ""
        
        # Fallback to server-side .env keys if client did not supply a key
        if not api_key:
            if provider == "gemini":
                api_key = settings.GEMINI_API_KEY
            elif provider == "openai":
                api_key = settings.OPENAI_API_KEY
            elif provider == "claude":
                api_key = settings.ANTHROPIC_API_KEY

        model = request.model or ""
        messages = request.messages
        project_id = request.project_id
        selected_id = request.selected_express_id

        # If an external cloud provider was selected but no key is present, provide structured guidance
        if provider in ("gemini", "claude", "openai") and not api_key:
            provider_names = {"gemini": "Google Gemini", "claude": "Anthropic Claude", "openai": "OpenAI"}
            disp_name = provider_names.get(provider, provider.title())
            return CopilotChatResponse(
                message=ChatMessage(
                    role="assistant",
                    content=(
                        f"**API Key Required for {disp_name}**\n\n"
                        f"No API key was detected for **{disp_name}**. To enable real AI assistance:\n\n"
                        f"1. Click the **Settings (gear icon)** at the top-right of this panel to paste your API key, or\n"
                        f"2. Add `{provider.upper()}_API_KEY=your_key_here` to your backend `.env` file.\n\n"
                        f"*Tip: You can switch the provider to **Built-in Assistant (Zero Key)** in the dropdown to generate buildings, transform elements, and query models completely offline.*"
                    )
                ),
                tool_calls=[],
                project_updated=False
            )

        tool_calls: list[ToolCall] = []
        assistant_content = ""
        project_modified = False

        # Route to provider or deterministic fallback
        if provider == "gemini" and api_key:
            assistant_content, raw_calls = await cls._call_gemini(api_key, model or "gemini-2.5-flash", messages, selected_id)
        elif provider == "claude" and api_key:
            assistant_content, raw_calls = await cls._call_anthropic(api_key, model or "claude-3-7-sonnet", messages, selected_id)
        elif provider == "openai" and api_key:
            assistant_content, raw_calls = await cls._call_openai(api_key, model or "gpt-4o", messages, request.base_url or "https://api.openai.com/v1", selected_id)
        elif provider == "ollama":
            base_url = request.base_url or "http://localhost:11434/v1"
            assistant_content, raw_calls = await cls._call_openai("ollama", model or "llama3.1", messages, base_url, selected_id)
        else:
            # Deterministic local engine (Zero-Key / Offline / Test)
            assistant_content, raw_calls = await cls._call_local_deterministic(messages, selected_id)

        # Execute any triggered tool calls
        for raw in raw_calls:
            call_id = raw.get("id", f"call_{uuid.uuid4().hex[:8]}")
            name = raw.get("name", "")
            args = raw.get("arguments", {})

            result = await cls.execute_tool(project_id, name, args)
            tool_calls.append(ToolCall(
                id=call_id,
                name=name,
                arguments=args,
                result=result
            ))

            if name in ("generate_building", "transform_element", "update_property") and result.get("success"):
                project_modified = True

        return CopilotChatResponse(
            message=ChatMessage(role="assistant", content=assistant_content),
            tool_calls=tool_calls,
            project_updated=project_modified
        )

    # -----------------------------------------------------------------------
    # Provider Callers
    # -----------------------------------------------------------------------

    @classmethod
    async def _call_gemini(cls, api_key: str, model: str, messages: list[ChatMessage], selected_id: Optional[int]) -> tuple[str, list[dict[str, Any]]]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        
        # Build Gemini contents format
        contents = []
        for m in messages:
            contents.append({
                "role": "model" if m.role == "assistant" else "user",
                "parts": [{"text": m.content}]
            })

        # Append current selection context if present
        if selected_id and contents:
            contents[-1]["parts"].append({"text": f"\n[Context: The user currently has element express_id={selected_id} selected in the 3D viewport.]"})

        # Gemini function declarations with uppercase types for Gemini v1beta REST API
        gemini_tools = [{
            "function_declarations": [
                {
                    "name": t["function"]["name"],
                    "description": t["function"]["description"],
                    "parameters": cls._convert_schema_to_gemini(t["function"]["parameters"])
                }
                for t in OPENAI_TOOLS
            ]
        }]

        payload = {
            "contents": contents,
            "tools": gemini_tools
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(f"Gemini API returned error {resp.status_code}: {resp.text}")
            data = resp.json()

        text = ""
        calls = []
        try:
            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                for part in parts:
                    if "text" in part:
                        text += part["text"]
                    fc = part.get("functionCall") or part.get("function_call")
                    if fc:
                        calls.append({
                            "id": f"call_{uuid.uuid4().hex[:8]}",
                            "name": fc["name"],
                            "arguments": fc.get("args", {})
                        })
        except Exception as e:
            logger.warning("Error parsing Gemini response: %s", e)

        if not text and calls:
            text = f"Executing {len(calls)} tool operation(s)..."

        return text, calls

    @classmethod
    async def _call_openai(cls, api_key: str, model: str, messages: list[ChatMessage], base_url: str, selected_id: Optional[int]) -> tuple[str, list[dict[str, Any]]]:
        url = f"{base_url.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        openai_msgs = [{"role": m.role, "content": m.content} for m in messages]
        if selected_id and openai_msgs:
            openai_msgs[-1]["content"] += f"\n[Context: Currently selected 3D element express_id={selected_id}]"

        payload = {
            "model": model,
            "messages": openai_msgs,
            "tools": OPENAI_TOOLS,
            "tool_choice": "auto"
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code != 200:
                raise RuntimeError(f"OpenAI API returned error {resp.status_code}: {resp.text}")
            data = resp.json()

        text = ""
        calls = []
        choice = data.get("choices", [{}])[0].get("message", {})
        text = choice.get("content") or ""
        if "tool_calls" in choice and choice["tool_calls"]:
            for tc in choice["tool_calls"]:
                fn = tc.get("function", {})
                args = json.loads(fn.get("arguments", "{}"))
                calls.append({
                    "id": tc.get("id", f"call_{uuid.uuid4().hex[:8]}"),
                    "name": fn.get("name"),
                    "arguments": args
                })

        if not text and calls:
            text = f"Executing {len(calls)} tool operation(s)..."

        return text, calls

    @classmethod
    async def _call_anthropic(cls, api_key: str, model: str, messages: list[ChatMessage], selected_id: Optional[int]) -> tuple[str, list[dict[str, Any]]]:
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }

        # Convert to Anthropic format
        anthropic_tools = [
            {
                "name": t["function"]["name"],
                "description": t["function"]["description"],
                "input_schema": t["function"]["parameters"]
            }
            for t in OPENAI_TOOLS
        ]

        claude_msgs = []
        for m in messages:
            if m.role in ("user", "assistant"):
                claude_msgs.append({"role": m.role, "content": m.content})

        if selected_id and claude_msgs:
            claude_msgs[-1]["content"] += f"\n[Context: Currently selected 3D element express_id={selected_id}]"

        payload = {
            "model": model,
            "max_tokens": 2048,
            "tools": anthropic_tools,
            "messages": claude_msgs
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code != 200:
                raise RuntimeError(f"Anthropic API returned error {resp.status_code}: {resp.text}")
            data = resp.json()

        text = ""
        calls = []
        for content_block in data.get("content", []):
            if content_block.get("type") == "text":
                text += content_block.get("text", "")
            elif content_block.get("type") == "tool_use":
                calls.append({
                    "id": content_block.get("id"),
                    "name": content_block.get("name"),
                    "arguments": content_block.get("input", {})
                })

        if not text and calls:
            text = f"Executing {len(calls)} tool operation(s)..."

        return text, calls

    # -----------------------------------------------------------------------
    # Local Deterministic Fallback Engine (Zero-Key / Offline)
    # -----------------------------------------------------------------------

    @classmethod
    async def _call_local_deterministic(cls, messages: list[ChatMessage], selected_id: Optional[int]) -> tuple[str, list[dict[str, Any]]]:
        """
        High-precision intent matcher that parses natural language and generates tool calls
        without requiring an external API key or network access.
        """
        user_msg = ""
        for m in reversed(messages):
            if m.role == "user":
                user_msg = m.content.strip().lower()
                break

        calls = []
        text = ""

        # 1. Building Generation Intent
        # Examples: "generate a 2 storey building", "create 12x8 building", "generate building 15m by 10m 3 floors"
        if any(kw in user_msg for kw in ["generate building", "create building", "make building", "build a building", "generate a building", "storey building", "floor building", "house"]):
            length = 10.0
            width = 8.0
            num_storeys = 1
            storey_height = 3.0

            # Match dimensions: "12x8" or "12 x 8" or "12m by 8m"
            dim_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:m)?\s*(?:x|by)\s*(\d+(?:\.\d+)?)\s*(?:m)?", user_msg)
            if dim_match:
                length = float(dim_match.group(1))
                width = float(dim_match.group(2))

            # Match storeys: "2 storey", "2-storey", "3 storeys", "2 floors"
            storey_match = re.search(r"(\d+)\s*[-–]?\s*(?:storey|storeys|floor|floors|levels|level)", user_msg)
            if storey_match:
                num_storeys = int(storey_match.group(1))

            calls.append({
                "id": f"call_{uuid.uuid4().hex[:8]}",
                "name": "generate_building",
                "arguments": {
                    "length": length,
                    "width": width,
                    "num_storeys": num_storeys,
                    "storey_height": storey_height,
                    "building_name": "Parametric Model"
                }
            })
            text = f"I am generating a {num_storeys}-storey building with dimensions {length}m x {width}m (floor height: {storey_height}m) complete with perimeter walls, floor slabs, and structural columns."

        # 2. Transformation Intent
        # Examples: "move element 21 by 2 meters on x", "translate selected element by dx: 2, dz: 1", "rotate 45 degrees"
        elif any(kw in user_msg for kw in ["move", "translate", "rotate", "shift", "offset", "transform"]):
            target_id = selected_id
            id_match = re.search(r"(?:element|id|#)\s*(\d+)", user_msg)
            if id_match:
                target_id = int(id_match.group(1))

            if target_id is None:
                text = "Please select an element in the 3D viewport or specify an element ID (e.g. 'move element #21 by 2 meters along X')."
            else:
                dx, dy, dz = 0.0, 0.0, 0.0
                rx, ry, rz = 0.0, 0.0, 0.0

                # Match X translation: "dx 3", "x: 3", or "3m on x", "3 meters along x"
                x_match = re.search(r"\b(?:x|dx)\b\s*(?:by|:|is|=|\+)?\s*(-?\d+(?:\.\d+)?)", user_msg)
                if x_match:
                    dx = float(x_match.group(1))
                else:
                    x_alt = re.search(r"(-?\d+(?:\.\d+)?)\s*(?:m|meter|meters)?\s*(?:along|on)?\s*\bx\b", user_msg)
                    if x_alt:
                        dx = float(x_alt.group(1))

                # Match Y translation: "dy 2", "y: 2", or "2m on y", "2 meters along y"
                y_match = re.search(r"\b(?:y|dy)\b\s*(?:by|:|is|=|\+)?\s*(-?\d+(?:\.\d+)?)", user_msg)
                if y_match:
                    dy = float(y_match.group(1))
                else:
                    y_alt = re.search(r"(-?\d+(?:\.\d+)?)\s*(?:m|meter|meters)?\s*(?:along|on)?\s*\by\b", user_msg)
                    if y_alt:
                        dy = float(y_alt.group(1))

                # Match Z translation: "dz 1.5", "z: 1.5", or "1.5m on z", or "1.5m up", "2m down"
                z_match = re.search(r"\b(?:z|dz)\b\s*(?:by|:|is|=|\+)?\s*(-?\d+(?:\.\d+)?)", user_msg)
                if z_match:
                    dz = float(z_match.group(1))
                else:
                    z_alt = re.search(r"(-?\d+(?:\.\d+)?)\s*(?:m|meter|meters)?\s*(?:along|on)?\s*\bz\b", user_msg)
                    if z_alt:
                        dz = float(z_alt.group(1))
                    elif "up" in user_msg:
                        val_match = re.search(r"(-?\d+(?:\.\d+)?)\s*(?:m|meter|meters)?\s*up", user_msg)
                        dz = float(val_match.group(1)) if val_match else 1.0
                    elif "down" in user_msg:
                        val_match = re.search(r"(-?\d+(?:\.\d+)?)\s*(?:m|meter|meters)?\s*down", user_msg)
                        dz = -float(val_match.group(1)) if val_match else -1.0

                # Match rotation
                rot_match = re.search(r"rotate\s*(?:by)?\s*(-?\d+(?:\.\d+)?)\s*(?:deg|degrees)?", user_msg)
                if rot_match:
                    rz = float(rot_match.group(1))

                calls.append({
                    "id": f"call_{uuid.uuid4().hex[:8]}",
                    "name": "transform_element",
                    "arguments": {
                        "element_id": target_id,
                        "dx": dx, "dy": dy, "dz": dz,
                        "rx": rx, "ry": ry, "rz": rz
                    }
                })
                text = f"Transforming element #{target_id} with offsets: dx={dx}m, dy={dy}m, dz={dz}m, rz={rz}°."

        # 3. Property Update Intent
        # Examples: "set property isexternal to true on element 21", "change loadbearing to false"
        elif any(kw in user_msg for kw in ["property", "pset", "set isexternal", "set loadbearing", "change name"]):
            target_id = selected_id
            id_match = re.search(r"(?:element|id|#)\s*(\d+)", user_msg)
            if id_match:
                target_id = int(id_match.group(1))

            if target_id is None:
                text = "Please select an element in the 3D viewport or specify an element ID to modify its properties."
            else:
                pset_name = "Pset_WallCommon"
                prop_name = "IsExternal"
                val: Any = True

                if "isexternal" in user_msg:
                    prop_name = "IsExternal"
                    val = False if "false" in user_msg else True
                elif "loadbearing" in user_msg:
                    prop_name = "LoadBearing"
                    val = False if "false" in user_msg else True
                elif "firerating" in user_msg:
                    prop_name = "FireRating"
                    rating_match = re.search(r"firerating\s*(?:to|is|=)?\s*([a-zA-Z0-9_\-]+)", user_msg)
                    val = rating_match.group(1) if rating_match else "FR-60"

                calls.append({
                    "id": f"call_{uuid.uuid4().hex[:8]}",
                    "name": "update_property",
                    "arguments": {
                        "element_id": target_id,
                        "pset_name": pset_name,
                        "property_name": prop_name,
                        "value": val
                    }
                })
                text = f"Updating property {pset_name}.{prop_name} = {val} on element #{target_id}."

        # 4. Query Intent
        # Examples: "count elements", "how many walls", "summarize model", "model info"
        elif any(kw in user_msg for kw in ["count", "how many", "summary", "summarize", "list", "query", "info"]):
            if "wall" in user_msg:
                q_type = "count_by_type"
                filters = {"ifc_class": "IfcWall"}
            elif "slab" in user_msg:
                q_type = "count_by_type"
                filters = {"ifc_class": "IfcSlab"}
            elif "column" in user_msg:
                q_type = "count_by_type"
                filters = {"ifc_class": "IfcColumn"}
            elif "list" in user_msg:
                q_type = "list_elements"
                filters = {"ifc_class": "IfcProduct"}
            else:
                q_type = "summary"
                filters = {}

            calls.append({
                "id": f"call_{uuid.uuid4().hex[:8]}",
                "name": "query_model",
                "arguments": {
                    "query_type": q_type,
                    "filters": filters
                }
            })
            text = f"Querying model metrics with type '{q_type}'..."

        # Default fallback conversational response
        else:
            text = (
                "I am your OpenBIM AI Copilot. You can ask me to:\n"
                "- **Generate Buildings**: 'Create a 2-storey building 12m x 8m'\n"
                "- **Transform Elements**: 'Move element #21 by 2 meters along X' or 'Move selected 1m up'\n"
                "- **Update Properties**: 'Set IsExternal to True on selected wall'\n"
                "- **Query Models**: 'Count all walls in model' or 'Summarize project storeys'"
            )

        return text, calls
