import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, status
from ..models.schemas import (
    CopilotChatRequest,
    CopilotChatResponse,
    CopilotModelsRequest,
    CopilotModelsResponse
)
from ..services.ai_service import AIService

logger = logging.getLogger("ifc_editor.copilot_api")
router = APIRouter(prefix="/copilot", tags=["AI Copilot"])

@router.get("/providers", response_model=list[dict])
async def get_providers():
    """List supported AI Copilot providers and their models."""
    return AIService.get_supported_providers()

@router.post("/models", response_model=CopilotModelsResponse)
async def get_models_post(request: CopilotModelsRequest):
    """Dynamically discover available models for a provider and API key."""
    return await AIService.fetch_dynamic_models(
        provider=request.provider,
        api_key=request.api_key,
        base_url=request.base_url
    )

@router.get("/models", response_model=CopilotModelsResponse)
async def get_models_get(
    provider: str = "gemini",
    api_key: Optional[str] = None,
    base_url: Optional[str] = None
):
    """Dynamically discover available models for a provider via query params."""
    return await AIService.fetch_dynamic_models(
        provider=provider,
        api_key=api_key,
        base_url=base_url
    )


@router.post("/chat", response_model=CopilotChatResponse)
async def copilot_chat(request: CopilotChatRequest):
    """Process a chat interaction with the AI Copilot, executing tools as needed."""
    try:
        response = await AIService.chat(request)
        return response
    except Exception as e:
        logger.exception("AI Copilot chat failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI Copilot execution error: {str(e)}"
        )
