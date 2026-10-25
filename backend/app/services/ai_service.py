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
from ..core.net_guard import UrlNotAllowed, validate_outbound_url
from ..core.workers import run_ifc
from ..services.ifc_service import IFCService, open_model_for_read
from ..services.project_service import ProjectService
from .atomic_store import atomic_write_model, project_read_lock, project_write_lock
from .cad_service import CADService
from ..models.schemas import (
    ChatMessage,
    ToolCall,
    CopilotChatRequest,
    CopilotChatResponse,
    CopilotToolError,
    PendingToolCall,
)

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
# Tool capabilities
# ---------------------------------------------------------------------------

# Tools that mutate the project model. Nothing in this set may run unless the caller
# set `confirm_writes` on the request: the copilot proposes, the user confirms.
WRITE_TOOLS: frozenset[str] = frozenset({
    "generate_building",
    "transform_element",
    "update_property",
})

# Declared metadata for every advertised tool, so a capability question is answered by
# data rather than by a hard-coded name check at the call site.
TOOL_SPECS: dict[str, dict[str, Any]] = {
    spec["function"]["name"]: {
        "writes_model": spec["function"]["name"] in WRITE_TOOLS,
        "description": spec["function"]["description"],
    }
    for spec in OPENAI_TOOLS
}

# Ceiling on provider rounds per chat request: round 1 asks, round 2 is the single
# tool-feedback follow-up. Unbounded iteration against a paid API is a cost risk.
MAX_TOOL_ROUNDS = 2

# Pre-execution placeholder the provider callers emit when a model returned tool calls
# without prose. It must never be the whole reply to a failed tool.
_TOOL_PLACEHOLDER_RE = re.compile(r"^Executing \d+ tool operation\(s\)\.\.\.$")

# ---------------------------------------------------------------------------
# Unit helpers
# ---------------------------------------------------------------------------

def _unit_scale(model) -> float:
    """Project units per metre. 1.0 for metres, 0.001 for millimetres.

    Delegates to ifcopenshell so conversion-based units (feet, inches) are handled too.
    """
    import ifcopenshell.util.unit as unit_util
    return float(unit_util.calculate_unit_scale(model))


def _message_view(message: Any) -> dict[str, Any]:
    """Normalise a conversation turn to a plain provider message dict.

    A conversation starts as ``list[ChatMessage]``, but the tool-feedback round appends
    ``role="tool"`` turns carrying ``tool_call_id`` / ``tool_calls`` - fields ChatMessage
    cannot express. Normalising once lets every provider caller see one shape.
    """
    if isinstance(message, dict):
        return dict(message)
    return {"role": message.role, "content": message.content}


# ---------------------------------------------------------------------------
# Intent matching (deterministic engine)
# ---------------------------------------------------------------------------
#
# Natural language on a chat surface must be matched on *tokens*, never on substrings:
# `"move" in "remove element 5"` is True, and `"house" in "what is a house?"` generated a
# building for a question. Both defects came from the same unanchored `.in` test, so the
# rules live here once and every intent goes through them.

INTERROGATIVE_LEADERS: frozenset[str] = frozenset({
    "what", "why", "how", "who", "when", "where", "which",
    "is", "are", "does", "do", "can", "could", "should",
    "explain", "tell", "describe", "list",
})

BUILDING_VERBS: tuple[str, ...] = ("generate", "create", "make", "build", "add", "construct")
TRANSFORM_VERBS: tuple[str, ...] = ("move", "translate", "rotate", "shift", "offset", "transform", "nudge")
DELETE_VERBS: tuple[str, ...] = ("delete", "remove", "erase", "purge")

_BUILDING_NOUN_RE = re.compile(r"\b(building|house|tower|block|pavilion)\b")


def _has_verb(text: str, verbs: tuple[str, ...]) -> bool:
    """True when one of ``verbs`` appears in ``text`` as a whole word."""
    return re.search(rf"\b(?:{'|'.join(verbs)})\b", text) is not None


def _is_interrogative(text: str) -> bool:
    """True for a message that asks rather than instructs.

    A question never writes to the model, whatever nouns it contains. Decided by the first
    word (the grammatical mood marker) or a trailing question mark.
    """
    stripped = text.strip()
    if not stripped:
        return False
    if stripped.endswith("?"):
        return True
    first_word = re.split(r"[\s,.;:!]+", stripped, maxsplit=1)[0].strip("'\"()[]")
    return first_word.lower() in INTERROGATIVE_LEADERS


def _match_building_intent(text: str) -> bool:
    """Building generation needs an imperative verb *and* a building noun, and not a question."""
    return (
        not _is_interrogative(text)
        and _has_verb(text, BUILDING_VERBS)
        and _BUILDING_NOUN_RE.search(text) is not None
    )


def _describe_write(name: str, args: dict[str, Any]) -> str:
    """Plain-language description of a withheld write, built from its own arguments.

    The user is being asked to approve a specific change, so the confirmation prompt must
    name the element and the numbers - not just the tool.
    """
    if name == "generate_building":
        return (
            f"generate a {args.get('num_storeys', 1)}-storey building "
            f"{args.get('length', 10.0)}m x {args.get('width', 8.0)}m"
        )
    if name == "transform_element":
        deltas = ", ".join(
            f"{axis}={args.get(axis)}"
            for axis in ("dx", "dy", "dz", "rx", "ry", "rz")
            if args.get(axis)
        )
        return f"transform element #{args.get('element_id')} ({deltas or 'no delta'})"
    if name == "update_property":
        return (
            f"set {args.get('pset_name')}.{args.get('property_name')} = "
            f"{args.get('value')!r} on element #{args.get('element_id')}"
        )
    return f"run {name}"


# ---------------------------------------------------------------------------
# Parametric building generation rules
# ---------------------------------------------------------------------------

#: Smallest floor plate, in metres, that justifies interior structural columns.
MIN_BUILDING_FOR_COLUMNS_M = (6.0, 5.0)  # (length, width)

#: Interior bay fractions along each plan axis. A 2x2 grid => 4 columns per storey.
COLUMN_GRID_FRACTIONS = (0.35, 0.65)


def column_grid(length: float, width: float, col_size: float = 0.35) -> list[tuple[float, float]]:
    """Interior structural column positions for a rectangular floor plate.

    Rule: a building whose floor plate is at least ``MIN_BUILDING_FOR_COLUMNS_M`` (6.0 m x 5.0 m)
    receives a 2x2 interior grid - one column at every combination of the
    ``COLUMN_GRID_FRACTIONS`` (0.35 and 0.65) along X and Y - i.e. 4 columns per storey.
    Anything smaller receives no columns.

    The result is a pure function of (length, width, col_size): no randomness, no state.
    (It returned 1-2 columns per storey between 2026-10-12 and 2026-10-24 - see STEP-07.)
    """
    if length < MIN_BUILDING_FOR_COLUMNS_M[0] or width < MIN_BUILDING_FOR_COLUMNS_M[1]:
        return []
    return [
        (length * fx - col_size / 2.0, width * fy - col_size / 2.0)
        for fx in COLUMN_GRID_FRACTIONS
        for fy in COLUMN_GRID_FRACTIONS
    ]


# ---------------------------------------------------------------------------
# AIService implementation
# ---------------------------------------------------------------------------

def _validated_local_base_url(base_url: Optional[str], *, default: str = "") -> str:
    """Validate a caller-supplied base URL for a local provider (STEP-20 / F-019).

    `custom` and `ollama` legitimately point at a server on the same machine or LAN, so
    private addresses are permitted — link-local, multicast, reserved and unspecified
    addresses are not, and a URL with userinfo or a non-HTTP scheme never is.

    Raises `UrlNotAllowed` (a `ValueError`) so the API layer answers `400` before any
    socket is opened, instead of `200` with an error string.
    """
    candidate = (base_url or "").strip() or default
    try:
        return validate_outbound_url(candidate, allow_private=True)
    except UrlNotAllowed as exc:
        raise UrlNotAllowed(f"base_url not allowed: {exc}") from exc


class AIService:
    @classmethod
    def get_supported_providers(cls) -> list[dict[str, Any]]:
        return [
            {
                "id": "gemini",
                "name": "Google Gemini",
                "models": ["gemini-3.8-flash", "gemini-3.8-pro", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
                "default_model": "gemini-3.8-flash",
                "requires_api_key": True,
                "has_server_key": bool(settings.GEMINI_API_KEY)
            },
            {
                "id": "claude",
                "name": "Anthropic Claude",
                "models": ["claude-3-7-sonnet", "claude-3-5-sonnet", "claude-3-5-haiku"],
                "default_model": "claude-3-7-sonnet",
                "requires_api_key": True,
                "has_server_key": bool(settings.ANTHROPIC_API_KEY)
            },
            {
                "id": "openai",
                "name": "OpenAI",
                "models": ["gpt-4o", "gpt-4o-mini", "o3-mini", "o1", "gpt-4.5-preview"],
                "default_model": "gpt-4o",
                "requires_api_key": True,
                "has_server_key": bool(settings.OPENAI_API_KEY)
            },
            {
                "id": "openrouter",
                "name": "OpenRouter",
                "models": [
                    "anthropic/claude-3.7-sonnet",
                    "openai/gpt-4o",
                    "google/gemini-2.0-flash-001",
                    "deepseek/deepseek-chat",
                    "meta-llama/llama-3.3-70b-instruct",
                    "qwen/qwen-2.5-72b-instruct"
                ],
                "default_model": "anthropic/claude-3.7-sonnet",
                "default_base_url": "https://openrouter.ai/api/v1",
                "requires_api_key": True,
                "has_server_key": bool(settings.OPENROUTER_API_KEY)
            },
            {
                "id": "custom",
                "name": "Custom Provider (OpenAI Compatible)",
                "models": ["custom-model"],
                "default_model": "custom-model",
                "default_base_url": "http://localhost:8000/v1",
                "requires_api_key": False,
                "has_server_key": False
            },
            {
                "id": "ollama",
                "name": "Ollama / Local LLM",
                "models": ["llama3.2", "llama3.1", "qwen2.5-coder", "mistral", "deepseek-r1"],
                "default_model": "llama3.2",
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

    @classmethod
    async def fetch_dynamic_models(
        cls,
        provider: str,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None
    ) -> dict[str, Any]:
        """Fetch live list of available models for a given provider, and verify connection status."""
        providers = cls.get_supported_providers()
        prov_def = next((p for p in providers if p["id"] == provider), None)
        if not prov_def:
            return {
                "provider": provider,
                "models": [],
                "default_model": "",
                "source": "fallback",
                "connected": False,
                "error": f"Unknown provider: {provider}"
            }

        fallback_models = list(prov_def["models"])
        default_model = prov_def["default_model"]

        if provider == "local":
            return {
                "provider": provider,
                "models": ["deterministic-engine"],
                "default_model": "deterministic-engine",
                "source": "api",
                "connected": True,
                "error": None
            }

        effective_key = (api_key or "").strip()
        if not effective_key:
            if provider == "gemini":
                effective_key = settings.GEMINI_API_KEY
            elif provider == "claude":
                effective_key = settings.ANTHROPIC_API_KEY
            elif provider == "openai":
                effective_key = settings.OPENAI_API_KEY
            elif provider == "openrouter":
                effective_key = settings.OPENROUTER_API_KEY

        # If provider requires an API key and none is present
        if prov_def.get("requires_api_key") and not effective_key:
            return {
                "provider": provider,
                "models": fallback_models,
                "default_model": default_model,
                "source": "fallback",
                "connected": False,
                "error": f"API key required for {prov_def['name']}"
            }

        # STEP-20 / F-019: `custom` and `ollama` are the only providers that accept a
        # caller-supplied base URL. Validate it here, *outside* the broad `except` below,
        # so an unsafe URL is a 400 with no outbound request rather than a 200 whose
        # `error` string describes a host we reached.
        local_base: Optional[str] = None
        if provider == "custom":
            local_base = _validated_local_base_url(base_url)
        elif provider == "ollama":
            local_base = _validated_local_base_url(
                base_url, default="http://localhost:11434/v1"
            )

        try:
            if provider == "gemini":
                models, err = await cls._fetch_gemini_models(effective_key)
                if models:
                    return {
                        "provider": provider,
                        "models": models,
                        "default_model": "gemini-3.8-flash" if "gemini-3.8-flash" in models else models[0],
                        "source": "api",
                        "connected": True,
                        "error": None
                    }
                return {
                    "provider": provider,
                    "models": fallback_models,
                    "default_model": default_model,
                    "source": "fallback",
                    "connected": False,
                    "error": err or "Failed to discover Gemini models"
                }

            elif provider == "claude":
                models, err = await cls._fetch_claude_models(effective_key)
                if models:
                    return {
                        "provider": provider,
                        "models": models,
                        "default_model": "claude-3-7-sonnet" if "claude-3-7-sonnet" in models else models[0],
                        "source": "api",
                        "connected": True,
                        "error": None
                    }
                return {
                    "provider": provider,
                    "models": fallback_models,
                    "default_model": default_model,
                    "source": "fallback",
                    "connected": False,
                    "error": err or "Failed to discover Anthropic Claude models"
                }

            elif provider == "openai":
                # STEP-20: the cloud endpoint is server-fixed; `base_url` from the client
                # is ignored (a caller that needs another endpoint uses `custom`).
                effective_base = settings.AI_CLOUD_HOSTS["openai"]
                models, err = await cls._fetch_openai_models(effective_key, effective_base)
                if models:
                    return {
                        "provider": provider,
                        "models": models,
                        "default_model": "gpt-4o" if "gpt-4o" in models else models[0],
                        "source": "api",
                        "connected": True,
                        "error": None
                    }
                return {
                    "provider": provider,
                    "models": fallback_models,
                    "default_model": default_model,
                    "source": "fallback",
                    "connected": False,
                    "error": err or "Failed to discover OpenAI models"
                }

            elif provider == "openrouter":
                models, err = await cls._fetch_openrouter_models(effective_key)
                if models:
                    return {
                        "provider": provider,
                        "models": models,
                        "default_model": "anthropic/claude-3.7-sonnet" if "anthropic/claude-3.7-sonnet" in models else models[0],
                        "source": "api",
                        "connected": True,
                        "error": None
                    }
                return {
                    "provider": provider,
                    "models": fallback_models,
                    "default_model": default_model,
                    "source": "fallback",
                    "connected": False,
                    "error": err or "Failed to discover OpenRouter models"
                }

            elif provider == "custom":
                effective_base = local_base or ""
                models, err = await cls._fetch_custom_models(effective_key, effective_base)
                if models:
                    return {
                        "provider": provider,
                        "models": models,
                        "default_model": models[0],
                        "source": "api",
                        "connected": True,
                        "error": None
                    }
                return {
                    "provider": provider,
                    "models": fallback_models,
                    "default_model": default_model,
                    "source": "fallback",
                    "connected": False,
                    "error": err or f"Cannot connect to custom provider at {effective_base}"
                }

            elif provider == "ollama":
                effective_base = local_base or "http://localhost:11434/v1"
                models, err = await cls._fetch_ollama_models(effective_base)
                if models:
                    return {
                        "provider": provider,
                        "models": models,
                        "default_model": models[0],
                        "source": "api",
                        "connected": True,
                        "error": None
                    }
                return {
                    "provider": provider,
                    "models": fallback_models,
                    "default_model": default_model,
                    "source": "fallback",
                    "connected": False,
                    "error": err or f"Cannot connect to Ollama at {effective_base}"
                }

        except Exception as e:
            logger.warning("Dynamic model discovery failed for provider %s: %s", provider, e)
            return {
                "provider": provider,
                "models": fallback_models,
                "default_model": default_model,
                "source": "fallback",
                "connected": False,
                "error": str(e)
            }

        return {
            "provider": provider,
            "models": fallback_models,
            "default_model": default_model,
            "source": "fallback",
            "connected": False,
            "error": "Could not verify provider connection"
        }

    @classmethod
    async def _fetch_gemini_models(cls, api_key: str) -> tuple[list[str], Optional[str]]:
        url = "https://generativelanguage.googleapis.com/v1beta/models"
        headers = {"x-goog-api-key": api_key}
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 400:
                    return [], "Invalid Gemini API key (400 Bad Request)"
                if resp.status_code == 403:
                    return [], "Gemini API key forbidden or quota exceeded (403)"
                if resp.status_code != 200:
                    return [], f"Gemini API returned HTTP {resp.status_code}"
                data = resp.json()
                raw_models = data.get("models", [])

                candidates: list[str] = []
                for m in raw_models:
                    methods = m.get("supportedGenerationMethods", [])
                    if "generateContent" not in methods:
                        continue
                    clean_name = m.get("name", "").removeprefix("models/").strip()
                    if not clean_name or clean_name in ("gemini-2.5-flash", "gemini-2.0-flash-exp"):
                        continue
                    if any(x in clean_name.lower() for x in ("embedding", "aqa", "imagen", "robotics", "computer-use")):
                        continue
                    candidates.append(clean_name)

                def gemini_priority(name: str) -> tuple[int, str]:
                    if name == "gemini-3.8-flash":
                        return (0, name)
                    if name == "gemini-3.8-pro":
                        return (1, name)
                    if "3.8" in name:
                        return (2, name)
                    if "2.5-pro" in name:
                        return (3, name)
                    if "2.0-flash" in name:
                        return (4, name)
                    if "1.5-pro" in name:
                        return (5, name)
                    if "1.5-flash" in name:
                        return (6, name)
                    return (10, name)

                candidates.sort(key=gemini_priority)
                return candidates, None
        except Exception as e:
            return [], f"Cannot connect to Gemini: {str(e)}"

    @classmethod
    async def _fetch_openai_models(cls, api_key: str, base_url: str) -> tuple[list[str], Optional[str]]:
        # STEP-20: the endpoint is validated before the request. It is server-fixed for
        # this provider (`settings.AI_CLOUD_HOSTS`), so the private allowance is inert
        # here - it only keeps a corporate proxy that resolves the cloud host internally
        # working.
        try:
            clean_base = validate_outbound_url(base_url, allow_private=True)
        except UrlNotAllowed as exc:
            return [], f"base_url not allowed: {exc}"
        url = f"{clean_base}/models"
        headers = {"Authorization": f"Bearer {api_key}"}
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 401:
                    return [], "Invalid OpenAI API key (401 Unauthorized)"
                if resp.status_code == 403:
                    return [], "OpenAI API access forbidden (403)"
                if resp.status_code != 200:
                    return [], f"OpenAI API returned HTTP {resp.status_code}"
                data = resp.json()
                raw_list = data.get("data", [])
                valid_models = []
                for item in raw_list:
                    mid = item.get("id", "")
                    if any(mid.startswith(p) for p in ("gpt-4", "gpt-3.5", "o1", "o3", "chatgpt")):
                        if not any(x in mid.lower() for x in ("realtime", "audio", "transcription", "tts", "embedding", "moderation")):
                            valid_models.append(mid)

                priority_names = ["gpt-4o", "gpt-4o-mini", "o3-mini", "o1", "gpt-4.5-preview"]
                sorted_models = [m for m in priority_names if m in valid_models]
                for m in sorted(valid_models):
                    if m not in sorted_models:
                        sorted_models.append(m)
                return sorted_models, None
        except Exception as e:
            return [], f"Cannot connect to OpenAI: {str(e)}"

    @classmethod
    async def _fetch_claude_models(cls, api_key: str) -> tuple[list[str], Optional[str]]:
        url = "https://api.anthropic.com/v1/models"
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01"
        }
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 401:
                    return [], "Invalid Anthropic API key (401 Unauthorized)"
                if resp.status_code == 403:
                    return [], "Anthropic account access forbidden or inactive (403)"
                if resp.status_code != 200:
                    return [], f"Anthropic API returned HTTP {resp.status_code}"
                data = resp.json()
                raw_list = data.get("data", [])
                model_ids = [item.get("id", "") for item in raw_list if item.get("id")]
                aliases = ["claude-3-7-sonnet", "claude-3-5-sonnet", "claude-3-5-haiku"]
                res = [a for a in aliases if any(a in m for m in model_ids) or a in model_ids]
                for m in model_ids:
                    if m not in res:
                        res.append(m)
                return (res if res else model_ids), None
        except Exception as e:
            return [], f"Cannot connect to Anthropic: {str(e)}"

    @classmethod
    async def _fetch_openrouter_models(cls, api_key: str) -> tuple[list[str], Optional[str]]:
        url = "https://openrouter.ai/api/v1/models"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "HTTP-Referer": "http://localhost:5173",
            "X-Title": "IFC Editor"
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 401:
                    return [], "Invalid OpenRouter API key (401 Unauthorized)"
                if resp.status_code == 403:
                    return [], "OpenRouter account forbidden or insufficient credits (403)"
                if resp.status_code != 200:
                    return [], f"OpenRouter API returned HTTP {resp.status_code}"
                data = resp.json()
                raw_list = data.get("data", [])
                all_ids = [item.get("id", "") for item in raw_list if item.get("id")]

                priority_list = [
                    "anthropic/claude-3.7-sonnet",
                    "anthropic/claude-3.5-sonnet",
                    "openai/gpt-4o",
                    "openai/gpt-4o-mini",
                    "google/gemini-2.0-flash-001",
                    "google/gemini-2.5-pro",
                    "deepseek/deepseek-chat",
                    "deepseek/deepseek-r1",
                    "meta-llama/llama-3.3-70b-instruct",
                    "qwen/qwen-2.5-72b-instruct"
                ]
                sorted_models = [m for m in priority_list if m in all_ids]
                for m in all_ids:
                    if m not in sorted_models:
                        sorted_models.append(m)
                return (sorted_models if sorted_models else all_ids), None
        except Exception as e:
            return [], f"Cannot connect to OpenRouter: {str(e)}"

    @classmethod
    async def _fetch_custom_models(cls, api_key: Optional[str], base_url: str) -> tuple[list[str], Optional[str]]:
        # STEP-20: refuse an out-of-policy endpoint before opening a socket. The caller
        # only reaches this line through `_validated_local_base_url`, so this is the
        # second, independent gate (a direct caller cannot skip the policy).
        try:
            clean_base = validate_outbound_url(base_url, allow_private=True)
        except UrlNotAllowed as exc:
            return [], f"base_url not allowed: {exc}"
        url = f"{clean_base}/models"
        headers: dict[str, str] = {}
        if api_key and api_key.strip():
            headers["Authorization"] = f"Bearer {api_key.strip()}"
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 401:
                    return [], "Custom provider authorization failed (401 Unauthorized)"
                if resp.status_code == 403:
                    return [], "Custom provider access forbidden (403)"
                if resp.status_code == 200:
                    data = resp.json()
                    raw_list = data.get("data", [])
                    if isinstance(raw_list, list):
                        ids = [item.get("id", "") for item in raw_list if isinstance(item, dict) and item.get("id")]
                        if ids:
                            return ids, None
                    return ["custom-model"], None
                if resp.status_code == 404:
                    # Endpoint exists but doesn't implement /models
                    return ["custom-model"], None
                return [], f"Custom provider returned HTTP {resp.status_code}"
        except httpx.ConnectError:
            return [], f"Cannot connect to custom server at {base_url} (Connection refused)"
        except httpx.TimeoutException:
            return [], f"Connection timed out reaching {base_url}"
        except Exception as e:
            return [], f"Custom provider error: {str(e)}"

    @classmethod
    async def _fetch_ollama_models(cls, base_url: str) -> tuple[list[str], Optional[str]]:
        # STEP-20: same policy gate as `_fetch_custom_models`; loopback stays reachable.
        try:
            clean_base = validate_outbound_url(base_url, allow_private=True)
        except UrlNotAllowed as exc:
            return [], f"base_url not allowed: {exc}"
        root_url = clean_base[:-3] if clean_base.endswith("/v1") else clean_base
        models: list[str] = []
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                try:
                    resp = await client.get(f"{root_url}/api/tags")
                    if resp.status_code == 200:
                        for m in resp.json().get("models", []):
                            name = m.get("name", "")
                            if name:
                                models.append(name)
                except Exception:
                    pass

                if not models:
                    try:
                        resp = await client.get(f"{clean_base}/models")
                        if resp.status_code == 200:
                            for m in resp.json().get("data", []):
                                mid = m.get("id", "")
                                if mid:
                                    models.append(mid)
                    except Exception:
                        pass
            if models:
                return models, None
            return [], f"No Ollama models found at {base_url}"
        except Exception as e:
            return [], f"Cannot connect to Ollama at {base_url}: {str(e)}"


    # -----------------------------------------------------------------------
    # Tool Execution Handlers
    # -----------------------------------------------------------------------

    @classmethod
    async def execute_tool(cls, project_id: str, name: str, args: dict[str, Any]) -> dict[str, Any]:
        """Execute a tool against the project model and return result."""
        try:
            file_path = ProjectService.get_project_file_path(project_id)
        except ValueError:
            # STEP-20: a non-UUID id is the caller's mistake; report it like a missing
            # model rather than letting the containment check surface as a 500.
            logger.warning("Rejected tool call %s for invalid project id %r", name, project_id)
            return {"error": "Project model file not found."}

        if not file_path.exists():
            # STEP-20 / F-045: the client-visible result must not describe where the
            # server keeps its models; the path goes to the log only.
            logger.debug("Project model file missing for %s: %s", project_id, file_path)
            return {"error": "Project model file not found."}

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
        """Generate a parametric building; the write is serialised and off the event loop.

        STEP-03: the whole open/mutate/write runs under the per-project write lock.
        STEP-04: it runs on the bounded IFC pool, never on the event loop.
        """
        async with project_write_lock(project_id):
            counts = await run_ifc(cls._generate_building_sync, project_id, file_path, args)

        element_count = counts["element_count"]

        # audit 5.8: an AI write is a model mutation, so it is undoable like any other. The
        # transaction row goes in before the audit-log line so a failure can never leave a
        # model change that Ctrl+Z cannot reach.
        await CADService.record_transaction(
            project_id, counts["transaction_id"], "ai_generate_building",
            counts["building_id"], "IfcBuilding",
            {
                "length": counts["length"],
                "width": counts["width"],
                "num_storeys": counts["num_storeys"],
                "storey_height": counts["storey_height"],
                "source": "ai-copilot",
            },
            counts["pre_snapshot"],
        )

        # Record edit and touch DB (audit 2.2: the count came from the model just written, so
        # the refresh does not re-parse the whole file).
        await ProjectService.record_edit(
            project_id=project_id,
            user_id="ai-copilot",
            user_name="AI Copilot",
            action_type="generate_building",
            express_id=None,
            entity_type="IfcBuilding",
            payload={
                "length": counts["length"],
                "width": counts["width"],
                "storeys": counts["num_storeys"],
                "elements": element_count,
            },
            element_count=counts["product_count"],
        )

        # Prose is built from what was actually placed: no column claim for a building with none.
        summary_parts = [
            f"{counts['num_storeys']}-storey building ({counts['length']}m x {counts['width']}m x {counts['storey_height']}m per floor)",
            f"{counts['wall_count']} perimeter walls",
            f"{counts['slab_count']} floor slabs",
        ]
        if counts["column_count"]:
            summary_parts.append(f"{counts['column_count']} structural columns")

        return {
            "success": True,
            "summary": "Generated " + ", ".join(summary_parts) + f". Element count: {element_count}.",
            "num_storeys": counts["num_storeys"],
            "element_count": element_count,
            "length": counts["length"],
            "width": counts["width"]
        }

    @classmethod
    def _generate_building_sync(cls, project_id: str, file_path: Path, args: dict[str, Any]) -> dict[str, Any]:
        # Sanitize & clamp parameters to prevent denial-of-service / memory exhaustion
        length = max(1.0, min(float(args.get("length", 10.0)), 500.0))
        width = max(1.0, min(float(args.get("width", 8.0)), 500.0))
        num_storeys = max(1, min(int(args.get("num_storeys", 1)), 50))
        storey_height = max(1.5, min(float(args.get("storey_height", 3.0)), 20.0))
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
        wall_count = 0
        slab_count = 0
        column_count = 0
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

            # 1. Floor Slab (Ground floor plinth underneath; upper floor slabs cleanly inside perimeter walls)
            slab = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcSlab", name=f"{level_name} Floor Slab")
            if level_idx == 0:
                slab_rep = create_box_mesh(length, width, 0.3)
                mat_slab = np.identity(4)
                mat_slab[2, 3] = elevation - 0.3
            else:
                slab_dx = max(0.1, length - 2.0 * wall_thickness)
                slab_dy = max(0.1, width - 2.0 * wall_thickness)
                slab_rep = create_box_mesh(slab_dx, slab_dy, 0.3)
                mat_slab = np.identity(4)
                mat_slab[0, 3] = wall_thickness
                mat_slab[1, 3] = wall_thickness
                mat_slab[2, 3] = elevation - 0.3
            ifcopenshell.api.run("geometry.assign_representation", model, product=slab, representation=slab_rep)
            ifcopenshell.api.run("geometry.edit_object_placement", model, product=slab, matrix=mat_slab)
            ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey, products=[slab])
            generated_elements_count += 1
            slab_count += 1

            # 2. Perimeter Walls (Clean butt-joints without overlapping corner volumes or coplanar Z-fighting)
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

            # West Wall (along Y, fitted cleanly between South and North walls: Y from wall_thickness to width - wall_thickness)
            side_wall_len = max(0.1, width - 2.0 * wall_thickness)
            w_west = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcWall", name=f"{level_name} West Wall")
            rep_w = ifcopenshell.api.run("geometry.add_wall_representation", model, context=body, length=side_wall_len, height=storey_height, thickness=wall_thickness)
            ifcopenshell.api.run("geometry.assign_representation", model, product=w_west, representation=rep_w)
            mw = np.array([
                [0.0, -1.0, 0.0, wall_thickness],
                [1.0,  0.0, 0.0, wall_thickness],
                [0.0,  0.0, 1.0, elevation],
                [0.0,  0.0, 0.0, 1.0]
            ])
            ifcopenshell.api.run("geometry.edit_object_placement", model, product=w_west, matrix=mw)
            ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey, products=[w_west])

            # East Wall (along Y, fitted cleanly between South and North walls: Y from wall_thickness to width - wall_thickness)
            w_east = ifcopenshell.api.run("root.create_entity", model, ifc_class="IfcWall", name=f"{level_name} East Wall")
            rep_e = ifcopenshell.api.run("geometry.add_wall_representation", model, context=body, length=side_wall_len, height=storey_height, thickness=wall_thickness)
            ifcopenshell.api.run("geometry.assign_representation", model, product=w_east, representation=rep_e)
            me = np.array([
                [0.0, -1.0, 0.0, length],
                [1.0,  0.0, 0.0, wall_thickness],
                [0.0,  0.0, 1.0, elevation],
                [0.0,  0.0, 0.0, 1.0]
            ])
            ifcopenshell.api.run("geometry.edit_object_placement", model, product=w_east, matrix=me)
            ifcopenshell.api.run("spatial.assign_container", model, relating_structure=storey, products=[w_east])
            generated_elements_count += 4
            wall_count += 4

            # 3. Interior Structural Columns (supporting floor spans, positioned in interior bays without clashing with perimeter walls)
            # The grid is a documented pure rule - see column_grid() / MIN_BUILDING_FOR_COLUMNS_M.
            col_positions = column_grid(length, width, col_size)

            for c_i, (cx, cy) in enumerate(col_positions):
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
                column_count += 1

        # audit 5.8: an AI generate is a model mutation, so it gets the same
        # begin_snapshot -> write -> record_transaction seam as every CAD edit. The pre-image
        # has to be taken before the single atomic write below.
        trans_id, pre_snapshot = CADService.begin_snapshot(project_id)
        try:
            atomic_write_model(model, file_path)
        except Exception:
            CADService.discard_snapshot(project_id, pre_snapshot)
            raise

        # A cad_transactions row needs an express id; the generated building is the subject.
        building_id = building.id() if building is not None else (
            model.by_type("IfcProject")[0].id() if model.by_type("IfcProject") else 0
        )

        # Report the file's actual contents rather than a running counter, so the number shown to
        # the user can never drift from the model on disk (spec 5 of STEP-07).
        element_count = (
            len(model.by_type("IfcWall"))
            + len(model.by_type("IfcSlab"))
            + len(model.by_type("IfcColumn"))
        )

        return {
            "element_count": element_count,
            "product_count": len(model.by_type("IfcProduct")),
            "wall_count": wall_count,
            "slab_count": slab_count,
            "column_count": column_count,
            "num_storeys": num_storeys,
            "storey_height": storey_height,
            "length": length,
            "width": width,
            "building_id": building_id,
            "transaction_id": trans_id,
            "pre_snapshot": pre_snapshot,
        }

    @classmethod
    async def _exec_transform_element(cls, project_id: str, file_path: Path, args: dict[str, Any]) -> dict[str, Any]:
        """Apply a delta transform to an element.

        STEP-03/STEP-04: the read-matrix -> compose -> write sequence runs under the
        per-project write lock on the bounded IFC pool, so it cannot lose a concurrent edit
        and cannot stall the event loop. The STEP-01/STEP-07 unit maths is untouched.
        """
        async with project_write_lock(project_id):
            result = await run_ifc(cls._transform_element_sync, project_id, file_path, args)

        # audit 5.8: an AI transform is undoable. A no-op transform writes nothing and
        # records nothing (no row, no snapshot).
        if result["transaction_id"]:
            await CADService.record_transaction(
                project_id, result["transaction_id"], "ai_transform", result["element_id"],
                "IfcProduct",
                {
                    "delta": result["delta"],
                    "matrix": result["matrix"],
                    "source": "ai-copilot",
                },
                result["pre_snapshot"],
            )

        await ProjectService.record_edit(
            project_id=project_id,
            user_id="ai-copilot",
            user_name="AI Copilot",
            action_type="transform_element",
            express_id=result["element_id"],
            entity_type="IfcProduct",
            payload={"matrix": result["matrix"], "delta": result["delta"]},
            # audit 2.2: a transform cannot change the product count - no re-parse.
            count_unchanged=True,
        )

        return {
            "success": True,
            "element_id": result["element_id"],
            "summary": result["summary"],
            "new_position": result["new_position"],
            "matrix": result["matrix"],
        }

    @classmethod
    def _transform_element_sync(cls, project_id: str, file_path: Path, args: dict[str, Any]) -> dict[str, Any]:
        element_id = int(args["element_id"])
        dx = float(args.get("dx", 0.0))
        dy = float(args.get("dy", 0.0))
        dz = float(args.get("dz", 0.0))
        rx = float(args.get("rx", 0.0))
        ry = float(args.get("ry", 0.0))
        rz = float(args.get("rz", 0.0))

        current_matrix_16 = IFCService.get_element_placement_matrix(file_path, element_id)

        # Convert column-major 16-element array to 4x4 numpy matrix.
        # This is the element's WORLD matrix expressed in PROJECT UNITS (e.g. millimetres).
        M = np.array(current_matrix_16).reshape((4, 4), order="F")

        # Project units per metre (1.0 for metres, 0.001 for millimetres). The AI tool schema and
        # the prompt both document dx/dy/dz in METRES, so convert before composing.
        scale = _unit_scale(open_model_for_read(file_path))

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

        # Rotate about the element's own origin: only the orientation block changes, so a pure
        # rotation cannot translate the element (cad_service.py uses the same pattern).
        M_new = M.copy()
        M_new[:3, :3] = R[:3, :3] @ M[:3, :3]

        # Translate in world space. dx/dy/dz are metres; the matrix is in project units.
        M_new[0, 3] += dx / scale
        M_new[1, 3] += dy / scale
        M_new[2, 3] += dz / scale

        # IFCService.update_element_placement declares is_si=True, i.e. it expects a world matrix
        # whose translation is in SI METRES. Convert project units -> metres for the writer.
        M_for_writer = M_new.copy()
        M_for_writer[0, 3] *= scale
        M_for_writer[1, 3] *= scale
        M_for_writer[2, 3] *= scale
        new_matrix_16 = M_for_writer.flatten(order="F").tolist()

        is_noop = not any((dx, dy, dz, rx, ry, rz))
        trans_id: Optional[str] = None
        pre_snapshot: Optional[str] = None
        if not is_noop:
            # audit 5.8: pre-image first, so Ctrl+Z can restore the previous placement. Runs
            # inside the IFC pool under the caller's project lock, like every other snapshot.
            trans_id, pre_snapshot = CADService.begin_snapshot(project_id)
            try:
                IFCService.update_element_placement(file_path, element_id, new_matrix_16)
            except Exception:
                CADService.discard_snapshot(project_id, pre_snapshot)
                raise

        return {
            "element_id": element_id,
            "summary": f"Transformed element #{element_id} by delta (dx={dx}m, dy={dy}m, dz={dz}m, rx={rx}°, ry={ry}°, rz={rz}°).",
            "new_position": [float(M_new[0, 3]), float(M_new[1, 3]), float(M_new[2, 3])],
            "matrix": new_matrix_16,
            "delta": {"dx": dx, "dy": dy, "dz": dz, "rx": rx, "ry": ry, "rz": rz},
            "transaction_id": trans_id,
            "pre_snapshot": pre_snapshot,
        }

    @classmethod
    def _update_property_with_snapshot(
        cls,
        project_id: str,
        file_path: Path,
        element_id: int,
        pset_name: str,
        property_name: str,
        value: Any,
        prop_type: str,
    ) -> dict[str, Any]:
        """Write one property with an undo pre-image (audit 5.8), on the IFC pool."""
        trans_id, pre_snapshot = CADService.begin_snapshot(project_id)
        try:
            IFCService.update_element_property(
                file_path, element_id, pset_name, property_name, value, prop_type
            )
        except Exception:
            CADService.discard_snapshot(project_id, pre_snapshot)
            raise
        return {"transaction_id": trans_id, "pre_snapshot": pre_snapshot}

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

        async with project_write_lock(project_id):
            write = await run_ifc(
                cls._update_property_with_snapshot,
                project_id, file_path, element_id, pset_name, property_name, value, prop_type,
            )

        # audit 5.8: an AI property write is undoable, like the REST property route (STEP-10).
        await CADService.record_transaction(
            project_id, write["transaction_id"], "ai_update_property", element_id,
            "IfcProduct",
            {
                "pset_name": pset_name,
                "property_name": property_name,
                "value": value,
                "source": "ai-copilot",
            },
            write["pre_snapshot"],
        )

        await ProjectService.record_edit(
            project_id=project_id,
            user_id="ai-copilot",
            user_name="AI Copilot",
            action_type="update_property",
            express_id=element_id,
            entity_type="IfcProduct",
            payload={"pset_name": pset_name, "property_name": property_name, "value": value},
            # audit 2.2: a property write cannot change the product count - no re-parse.
            count_unchanged=True,
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
        """Read-only model query, served from the warm cache on the bounded IFC pool."""
        async with project_read_lock(project_id):
            return await run_ifc(cls._query_model_sync, file_path, args)

    @classmethod
    def _query_model_sync(cls, file_path: Path, args: dict[str, Any]) -> dict[str, Any]:
        query_type = args.get("query_type", "summary")
        filters = args.get("filters", {}) or {}

        model = open_model_for_read(file_path)
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
            elif provider == "openrouter":
                api_key = settings.OPENROUTER_API_KEY

        model = request.model or ""
        messages = request.messages
        project_id = request.project_id
        selected_id = request.selected_express_id

        # If an external cloud provider was selected but no key is present, provide structured guidance
        if provider in ("gemini", "claude", "openai", "openrouter") and not api_key:
            provider_names = {
                "gemini": "Google Gemini",
                "claude": "Anthropic Claude",
                "openai": "OpenAI",
                "openrouter": "OpenRouter"
            }
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
        requires_confirmation = False
        pending_tool_calls: list[PendingToolCall] = []
        errors: list[CopilotToolError] = []

        # STEP-20 / F-019: the local providers take a caller-supplied `base_url`, so it is
        # validated once, before the first provider round can open a socket. Raises
        # `UrlNotAllowed` (a ValueError) -> the route answers 400.
        local_base: Optional[str] = None
        if provider == "custom":
            local_base = _validated_local_base_url(
                request.base_url, default="http://localhost:8000/v1"
            )
        elif provider == "ollama":
            local_base = _validated_local_base_url(
                request.base_url, default="http://localhost:11434/v1"
            )

        # Provider-round dispatch. The transport stays in the `_call_*` helpers; this closure
        # only decides which one runs, so the tool-feedback loop can reuse it verbatim.
        async def dispatch(turns: list[Any]) -> tuple[str, list[dict[str, Any]]]:
            if provider == "gemini" and api_key:
                gemini_model = (model or "gemini-3.8-flash").removeprefix("models/").strip()
                if gemini_model in ("gemini-2.5-flash", "gemini-2.0-flash-exp"):
                    gemini_model = "gemini-3.8-flash"
                return await cls._call_gemini(api_key, gemini_model, turns, selected_id)
            elif provider == "claude" and api_key:
                return await cls._call_anthropic(api_key, model or "claude-3-7-sonnet", turns, selected_id)
            elif provider == "openai" and api_key:
                # STEP-20 / F-019: the cloud endpoint comes from config, never from the
                # request, so a caller cannot redirect a paid key at an arbitrary host.
                return await cls._call_openai(
                    api_key, model or "gpt-4o", turns,
                    settings.AI_CLOUD_HOSTS["openai"], selected_id,
                )
            elif provider == "openrouter" and api_key:
                openrouter_base = settings.AI_CLOUD_HOSTS["openrouter"]
                extra_headers = {
                    "HTTP-Referer": "http://localhost:5173",
                    "X-Title": "IFC Editor"
                }
                return await cls._call_openai(
                    api_key,
                    model or "anthropic/claude-3.7-sonnet",
                    turns,
                    openrouter_base,
                    selected_id,
                    extra_headers=extra_headers
                )
            elif provider == "custom":
                custom_base = local_base or "http://localhost:8000/v1"
                return await cls._call_openai(
                    api_key, model or "custom-model", turns, custom_base, selected_id,
                )
            elif provider == "ollama":
                base_url = local_base or "http://localhost:11434/v1"
                return await cls._call_openai("ollama", model or "llama3.2", turns, base_url, selected_id)
            # Deterministic local engine (Zero-Key / Offline / Test)
            return await cls._call_local_deterministic(turns, selected_id)

        # Normalised once: the tool-feedback round appends plain dict turns, and every
        # provider caller (plus the deterministic engine) reads that single shape.
        conversation: list[Any] = [_message_view(m) for m in messages]

        withheld: list[tuple[str, str, dict[str, Any]]] = []
        rounds = 0

        while True:
            rounds += 1
            assistant_content, raw_calls = await dispatch(conversation)

            executed: list[tuple[str, str, dict[str, Any], dict[str, Any]]] = []
            withheld = []

            for raw in raw_calls:
                call_id = raw.get("id") or f"call_{uuid.uuid4().hex[:8]}"
                name = raw.get("name", "")
                args = raw.get("arguments", {}) or {}

                # Spec 5: a model-writing tool never runs without explicit confirmation.
                if name in WRITE_TOOLS and not request.confirm_writes:
                    withheld.append((call_id, name, args))
                    continue

                result = await cls.execute_tool(project_id, name, args)
                tool_calls.append(ToolCall(
                    id=call_id,
                    name=name,
                    arguments=args,
                    result=result
                ))
                executed.append((call_id, name, args, result))

                if name in WRITE_TOOLS and isinstance(result, dict) and result.get("success"):
                    project_modified = True

                # Spec 9: a failed tool must not read as success.
                if isinstance(result, dict) and result.get("error"):
                    errors.append(CopilotToolError(tool=name, message=str(result["error"])))
                    project_modified = False

            # Spec 11: the deterministic engine has no model to paraphrase the result, so the
            # reply is the executed tool's own summary rather than a pre-execution template.
            if (
                provider == "local"
                and len(tool_calls) == 1
                and tool_calls[0].name == "query_model"
                and isinstance(tool_calls[0].result, dict)
            ):
                summary = tool_calls[0].result.get("summary")
                if isinstance(summary, str) and summary:
                    assistant_content = summary

            if withheld:
                requires_confirmation = True
                pending_tool_calls = [
                    PendingToolCall(name=name, arguments=args) for _id, name, args in withheld
                ]

            # Spec 10: one follow-up round, carrying the executed results back to the model.
            if (
                not raw_calls
                or withheld
                or not executed
                or rounds >= MAX_TOOL_ROUNDS
                or provider == "local"
            ):
                break

            conversation = conversation + [{
                "role": "assistant",
                "content": assistant_content or "",
                "tool_calls": [
                    {
                        "id": call_id,
                        "type": "function",
                        "function": {"name": name, "arguments": json.dumps(args, default=str)},
                    }
                    for call_id, name, args, _result in executed
                ],
            }] + [
                {
                    "role": "tool",
                    "tool_call_id": call_id,
                    "content": json.dumps(result, default=str),
                }
                for call_id, _name, _args, result in executed
            ]

        if requires_confirmation:
            intent_lines = "\n".join(f"- {_describe_write(name, args)}" for _id, name, args in withheld)
            note = (
                "**Confirmation required.** This request would change the model, so nothing has "
                "been written yet:\n"
                f"{intent_lines}\n\n"
                "Confirm to apply it, or rephrase if that is not what you meant."
            )
            assistant_content = f"{assistant_content}\n\n{note}" if assistant_content.strip() else note

        if errors:
            project_modified = False
            # A bare "Executing N tool operation(s)..." is not an answer to a failure.
            if _TOOL_PLACEHOLDER_RE.match(assistant_content.strip()):
                assistant_content = ""
            detail = "\n".join(f"- `{e.tool}`: {e.message}" for e in errors)
            note = f"**Tool failure.** The requested change was not applied:\n{detail}"
            assistant_content = f"{assistant_content}\n\n{note}" if assistant_content.strip() else note

        return CopilotChatResponse(
            message=ChatMessage(role="assistant", content=assistant_content),
            tool_calls=tool_calls,
            project_updated=project_modified,
            requires_confirmation=requires_confirmation,
            pending_tool_calls=pending_tool_calls,
            errors=errors,
        )

    # -----------------------------------------------------------------------
    # Provider Callers
    # -----------------------------------------------------------------------

    @classmethod
    async def _call_gemini(cls, api_key: str, model: str, messages: list[ChatMessage], selected_id: Optional[int]) -> tuple[str, list[dict[str, Any]]]:
        clean_model = (model or "gemini-3.8-flash").removeprefix("models/").strip()
        if clean_model in ("gemini-2.5-flash", "gemini-2.0-flash-exp"):
            logger.info("Migrating deprecated model %s to gemini-3.8-flash", clean_model)
            clean_model = "gemini-3.8-flash"

        # STEP-20 / F-020: the key travels in a header, never in the query string.
        # `httpx` logs the request URL at INFO; a `?key=` would be written to every
        # access log, proxy log and exception trace that touches the URL.
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{clean_model}:generateContent"
        headers = {"x-goog-api-key": api_key, "Content-Type": "application/json"}

        
        # Build Gemini contents format
        contents = []
        for m in messages:
            view = _message_view(m)
            contents.append({
                "role": "model" if view.get("role") == "assistant" else "user",
                "parts": [{"text": view.get("content") or ""}]
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
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code != 200:
                # STEP-20 / F-019: the upstream body stays in the server log. Relaying it
                # turned the copilot into a read-only proxy for whatever host it reached.
                logger.debug(
                    "Gemini error body (truncated): %s", (resp.text or "")[:512]
                )
                raise RuntimeError(f"Gemini API returned error {resp.status_code}")
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
    async def _call_openai(
        cls,
        api_key: str,
        model: str,
        messages: list[ChatMessage],
        base_url: str,
        selected_id: Optional[int],
        extra_headers: Optional[dict[str, str]] = None
    ) -> tuple[str, list[dict[str, Any]]]:
        url = f"{base_url.rstrip('/')}/chat/completions"
        headers: dict[str, str] = {
            "Content-Type": "application/json"
        }
        if api_key and api_key.strip():
            headers["Authorization"] = f"Bearer {api_key.strip()}"
        if extra_headers:
            headers.update(extra_headers)

        openai_msgs = [_message_view(m) for m in messages]
        if selected_id and openai_msgs and openai_msgs[-1].get("role") == "user":
            openai_msgs[-1]["content"] = (openai_msgs[-1].get("content") or "") + f"\n[Context: Currently selected 3D element express_id={selected_id}]"

        payload = {
            "model": model,
            "messages": openai_msgs,
            "tools": OPENAI_TOOLS,
            "tool_choice": "auto"
        }

        async with httpx.AsyncClient(timeout=35.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code != 200:
                # STEP-20 / F-019: status code only, body to the DEBUG log (truncated).
                logger.debug(
                    "OpenAI error body (truncated): %s", (resp.text or "")[:512]
                )
                raise RuntimeError(f"OpenAI API returned error {resp.status_code}")
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
            view = _message_view(m)
            role = view.get("role")
            content = view.get("content") or ""
            if role in ("user", "assistant"):
                claude_msgs.append({"role": role, "content": content})
            elif role == "tool":
                # Anthropic has no bare tool-result turn in this transport; carry the result
                # as user-visible context instead of dropping it.
                claude_msgs.append({"role": "user", "content": f"Tool result: {content}"})

        if selected_id and claude_msgs and claude_msgs[-1]["role"] == "user":
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
                # STEP-20 / F-019: status code only, body to the DEBUG log (truncated).
                logger.debug(
                    "Anthropic error body (truncated): %s", (resp.text or "")[:512]
                )
                raise RuntimeError(f"Anthropic API returned error {resp.status_code}")
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
            view = _message_view(m)
            if view.get("role") == "user":
                user_msg = (view.get("content") or "").strip().lower()
                break

        calls = []
        text = ""

        # 1. Building Generation Intent
        # Examples: "generate a 2 storey building", "create 12x8 building", "generate building 15m by 10m 3 floors"
        # Anchored (STEP-17): an imperative verb AND a building noun, and never a question.
        # "what is a house?" is a question, so it must not build a house.
        if _match_building_intent(user_msg):
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
            # Claims below are derived from the same documented rule the executor uses, so the
            # copilot never promises structural columns a small building will not receive.
            column_total = len(column_grid(length, width)) * num_storeys
            text = (
                f"I am generating a {num_storeys}-storey building with dimensions {length}m x {width}m "
                f"(floor height: {storey_height}m) complete with perimeter walls and floor slabs"
                + (f", and {column_total} structural columns." if column_total else ".")
            )

        # 2. Transformation Intent
        # Examples: "move element 21 by 2 meters on x", "translate selected element by dx: 2, dz: 1", "rotate 45 degrees"
        # Word-boundary match (STEP-17): `"move" in "remove element 5"` is True, so a substring
        # test turned a deletion request into a 13 km displacement on a millimetre model.
        elif not _is_interrogative(user_msg) and _has_verb(user_msg, TRANSFORM_VERBS):
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

        # 3. Deletion Intent - explicitly unavailable (STEP-17, spec 3)
        # Deletion from the copilot needs the confirmation + undo flow (STEP-10). Until then it
        # must answer with a message and produce NO tool call, rather than matching some other
        # verb and mutating the model by accident.
        elif _has_verb(user_msg, DELETE_VERBS):
            text = (
                "Deleting elements from the copilot is not enabled yet: it needs the confirmation "
                "and undo flow. Use the Delete key in the viewport, or the CAD delete command, so "
                "the action is reversible."
            )

        # 4. Property Update Intent
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

        # 5. Query Intent
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
