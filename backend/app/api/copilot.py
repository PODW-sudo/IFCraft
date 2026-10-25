import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from ..models.schemas import (
    CopilotChatRequest,
    CopilotChatResponse,
    CopilotModelsRequest,
    CopilotModelsResponse
)
from ..core.rate_limit import enforce_ai_rate_limit
from ..services.ai_service import AIService

logger = logging.getLogger("ifc_editor.copilot_api")
router = APIRouter(prefix="/copilot", tags=["AI Copilot"])

#: Open issue 3.1: these three routes call a provider (and therefore spend the server's
#: quota), so they - and only they - carry the sliding-window limiter. `/providers` is a
#: static in-process list and stays unmetered.
PROVIDER_SPEND_LIMIT = [Depends(enforce_ai_rate_limit)]

@router.get("/providers", response_model=list[dict])
async def get_providers():
    """List supported AI Copilot providers and their models."""
    return AIService.get_supported_providers()

@router.post("/models", response_model=CopilotModelsResponse, dependencies=PROVIDER_SPEND_LIMIT)
async def get_models_post(request: CopilotModelsRequest):
    """Dynamically discover available models for a provider and API key."""
    return await _discover_models(request.provider, request.api_key, request.base_url)

@router.get("/models", response_model=CopilotModelsResponse, dependencies=PROVIDER_SPEND_LIMIT)
async def get_models_get(
    provider: str = "gemini",
    api_key: Optional[str] = None,
    base_url: Optional[str] = None
):
    """Dynamically discover available models for a provider via query params."""
    return await _discover_models(provider, api_key, base_url)


async def _discover_models(
    provider: str, api_key: Optional[str], base_url: Optional[str]
) -> CopilotModelsResponse:
    """Run model discovery, mapping an out-of-policy URL to `400` (STEP-20 spec 4).

    Without this the `UrlNotAllowed` raised by the outbound guard would surface as an
    unhandled `500`; the contract is a `400` whose `detail` begins `base_url not allowed:`.
    """
    try:
        return await AIService.fetch_dynamic_models(
            provider=provider,
            api_key=api_key,
            base_url=base_url
        )
    except ValueError as e:
        logger.warning("Copilot model discovery rejected a request: %s", e)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/chat", response_model=CopilotChatResponse, dependencies=PROVIDER_SPEND_LIMIT)
async def copilot_chat(request: CopilotChatRequest):
    """Process a chat interaction with the AI Copilot, executing tools as needed."""
    try:
        response = await AIService.chat(request)
        return response
    except ValueError as e:
        # STEP-20: an out-of-policy `base_url` (UrlNotAllowed) and any other request-level
        # rejection is the caller's fault, not a server fault.
        logger.warning("AI Copilot rejected a request: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except RuntimeError as e:
        # STEP-20 / F-019: the message already carries only the provider and status code;
        # the upstream body is logged at DEBUG inside the transport, never relayed.
        logger.exception("AI Copilot chat failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI Copilot execution error: {str(e)}"
        )
    except Exception as e:
        # Anything unexpected may carry a filesystem path (spec 11); keep it in the log.
        logger.exception("AI Copilot chat failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI Copilot execution error. See the server log for details."
        )
