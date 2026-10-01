import logging
from fastapi import APIRouter, HTTPException, status
from ..models.schemas import CopilotChatRequest, CopilotChatResponse
from ..services.ai_service import AIService

logger = logging.getLogger("ifc_editor.copilot_api")
router = APIRouter(prefix="/copilot", tags=["AI Copilot"])

@router.get("/providers", response_model=list[dict])
async def get_providers():
    """List supported AI Copilot providers and their models."""
    return AIService.get_supported_providers()

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
