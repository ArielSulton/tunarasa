"""
Gesture Text Processing API endpoints
Handles text input from frontend gesture recognition and processes with RAG
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.services.langchain_service import process_question_simple
from app.services.document_manager import get_document_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/gesture", tags=["gesture"])


class GestureTextRequest(BaseModel):
    """Request model for gesture-to-text processing"""
    
    text: str = Field(description="Text converted from gesture recognition")
    session_id: Optional[str] = Field(default=None, description="Optional session identifier")
    language: str = Field(default="id", description="Response language (id/en)")
    gesture_confidence: Optional[float] = Field(default=None, description="Original gesture recognition confidence")
    
    class Config:
        json_schema_extra = {
            "example": {
                "text": "cara membuat KTP baru",
                "session_id": "anonymous_session_123",
                "language": "id",
                "gesture_confidence": 0.85
            }
        }


class GestureTextResponse(BaseModel):
    """Response model for gesture text processing"""
    
    success: bool
    question: str
    answer: str
    confidence: float
    sources: List[Dict[str, Any]] = []
    processing_time: float
    message: Optional[str] = None
    timestamp: str


@router.post("/ask", response_model=GestureTextResponse)
async def process_gesture_text(
    request: GestureTextRequest
) -> GestureTextResponse:
    """
    Process text from gesture recognition and return RAG-based answer
    """
    try:
        # Generate session ID if not provided
        session_id = request.session_id or f"gesture_session_{datetime.utcnow().timestamp()}"
        
        # Process question using existing RAG system
        qa_result = await process_question_simple(
            question=request.text,
            session_id=session_id,
            language=request.language,
            conversation_mode="casual"
        )
        
        # Get document manager for additional context if needed
        doc_manager = get_document_manager()
        search_result = await doc_manager.search_documents(
            query=request.text,
            language=request.language,
            max_results=3,
            similarity_threshold=0.7
        )
        
        sources = search_result.get("results", []) if search_result["success"] else []
        
        # Log gesture text processing
        logger.info(f"Gesture text processed: '{request.text}' (gesture_confidence: {request.gesture_confidence})")
        
        return GestureTextResponse(
            success=True,
            question=request.text,
            answer=qa_result.get("answer", "Maaf, saya tidak dapat memahami pertanyaan Anda."),
            confidence=qa_result.get("confidence", 0.0),
            sources=sources,
            processing_time=qa_result.get("processing_time", 0.0),
            message="Gesture text processed successfully",
            timestamp=datetime.utcnow().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Error processing gesture text: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process gesture text"
        )


@router.get("/health")
async def gesture_health_check() -> Dict[str, Any]:
    """Health check for gesture service"""
    return {
        "success": True,
        "service": "gesture_text_processing",
        "status": "healthy",
        "message": "Ready to process gesture text",
        "timestamp": datetime.utcnow().isoformat()
    }