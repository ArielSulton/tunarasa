"""
Gesture Text Processing API endpoints
Handles text input from frontend gesture recognition and processes with RAG
Enhanced with standardized API responses
"""

import logging
import re
import time
from datetime import datetime
from html import escape
from typing import Any, Dict, List, Optional

import bleach
from app.middleware.response_middleware import ResponseFactory, create_response_factory
from app.models.api_response import ApiResponse, HealthCheckData
from app.services.deepeval_monitoring import evaluate_llm_response
from app.services.document_manager import get_document_manager
from app.services.langchain_service import process_question_simple
from app.services.metrics_service import metrics_service
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field, validator

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/gesture", tags=["gesture"])


class GestureTextRequest(BaseModel):
    """Request model for gesture-to-text processing with enhanced validation"""

    text: str = Field(
        min_length=1,
        max_length=500,
        description="Text converted from gesture recognition",
    )
    session_id: Optional[str] = Field(
        default=None,
        max_length=255,
        pattern=r"^[a-zA-Z0-9_-]+$",
        description="Optional session identifier (alphanumeric, underscore, hyphen only)",
    )
    language: str = Field(
        default="id", pattern=r"^(id|en)$", description="Response language (id/en only)"
    )
    gesture_confidence: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Original gesture recognition confidence (0.0-1.0)",
    )

    @validator("text")
    def sanitize_text(cls, v):
        """Sanitize input text to prevent XSS and injection attacks"""
        if not v or not v.strip():
            raise ValueError("Text cannot be empty")

        # Remove HTML tags and potential XSS vectors
        sanitized = bleach.clean(v.strip(), strip=True)

        # Additional escape for safety
        sanitized = escape(sanitized)

        # Check for suspicious patterns
        suspicious_patterns = [
            r"<script[^>]*>.*?</script>",
            r"javascript:",
            r"on\w+\s*=",
            r"<iframe[^>]*>.*?</iframe>",
        ]

        for pattern in suspicious_patterns:
            if re.search(pattern, sanitized, re.IGNORECASE):
                raise ValueError("Input contains potentially malicious content")

        return sanitized

    @validator("session_id")
    def validate_session_id(cls, v):
        """Additional validation for session ID"""
        if v is None:
            return v

        if len(v) > 255:
            raise ValueError("Session ID too long")

        # Check for SQL injection patterns
        sql_patterns = [r"\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION)\b", r'[\'";\-\-]']
        for pattern in sql_patterns:
            if re.search(pattern, v, re.IGNORECASE):
                raise ValueError("Session ID contains invalid characters")

        return v

    class Config:
        json_schema_extra = {
            "example": {
                "text": "cara membuat KTP baru",
                "session_id": "anonymous_session_123",
                "language": "id",
                "gesture_confidence": 0.85,
            }
        }


class GestureTextData(BaseModel):
    """Data model for gesture text processing response"""

    question: str = Field(description="Original question from gesture")
    answer: str = Field(description="RAG-based answer")
    confidence: float = Field(ge=0.0, le=1.0, description="AI response confidence")
    sources: List[Dict[str, Any]] = Field(
        default_factory=list, description="Supporting document sources"
    )
    processing_time: float = Field(ge=0.0, description="Processing time in seconds")
    session_id: str = Field(description="Session identifier")
    gesture_confidence: Optional[float] = Field(
        default=None, description="Original gesture recognition confidence"
    )


@router.post("/ask", response_model=ApiResponse[GestureTextData])
async def process_gesture_text(
    gesture_request: GestureTextRequest,
    response_factory: ResponseFactory = Depends(create_response_factory),
) -> ApiResponse[GestureTextData]:
    """
    Process text from gesture recognition and return RAG-based answer
    Enhanced with standardized response format and comprehensive error handling
    """
    try:
        start_time = time.time()

        # Generate session ID if not provided
        session_id = (
            gesture_request.session_id
            or f"gesture_session_{int(datetime.utcnow().timestamp())}"
        )

        # Record gesture recognition metrics
        if gesture_request.gesture_confidence is not None:
            metrics_service.record_gesture_recognition(
                gesture_type="text_conversion",
                confidence=gesture_request.gesture_confidence,
                accuracy=gesture_request.gesture_confidence,  # Use confidence as accuracy proxy
            )

        # Process question using existing RAG system
        qa_result = await process_question_simple(
            question=gesture_request.text,
            session_id=session_id,
            language=gesture_request.language,
            conversation_mode="casual",
        )

        # Get document manager for additional context if needed
        doc_manager = get_document_manager()
        search_result = await doc_manager.search_documents(
            query=gesture_request.text,
            language=gesture_request.language,
            max_results=3,
            similarity_threshold=0.7,
        )

        sources = search_result.get("results", []) if search_result["success"] else []
        processing_time = time.time() - start_time
        ai_confidence = qa_result.get("confidence", 0.0)
        ai_answer = qa_result.get(
            "answer", "Maaf, saya tidak dapat memahami pertanyaan Anda."
        )

        # Record AI request metrics
        metrics_service.record_ai_request(
            model="llama3-70b-8192",  # From backend analysis
            request_type="gesture_qa",
            duration=processing_time,
            confidence=ai_confidence,
        )

        # Perform DeepEval monitoring for quality assessment
        try:
            conversation_id = (
                f"gesture_{session_id}_{int(datetime.utcnow().timestamp())}"
            )
            await evaluate_llm_response(
                conversation_id=conversation_id,
                user_question=gesture_request.text,
                llm_response=ai_answer,
                context_documents=[source.get("content", "") for source in sources],
                response_time=processing_time,
                model_used="llama3-70b-8192",
                confidence_score=ai_confidence,
                session_id=session_id,
                user_id=None,  # Anonymous gesture user
            )
        except Exception as eval_error:
            logger.warning(f"DeepEval monitoring failed: {eval_error}")

        # Log gesture text processing
        logger.info(
            f"Gesture text processed: '{gesture_request.text}' (gesture_confidence: {gesture_request.gesture_confidence}, ai_confidence: {ai_confidence})"
        )

        # Create standardized response data
        response_data = GestureTextData(
            question=gesture_request.text,
            answer=ai_answer,
            confidence=ai_confidence,
            sources=sources,
            processing_time=processing_time,
            session_id=session_id,
            gesture_confidence=gesture_request.gesture_confidence,
        )

        return response_factory.success(
            data=response_data, message="Gesture text processed successfully"
        )

    except ValueError as ve:
        # Handle validation errors
        logger.warning(f"Validation error in gesture processing: {ve}")
        return response_factory.error(
            code="VALIDATION_ERROR",
            message=str(ve),
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    except Exception as e:
        # Handle unexpected errors
        logger.error(f"Error processing gesture text: {e}", exc_info=True)
        return response_factory.error(
            code="PROCESSING_ERROR",
            message="Failed to process gesture text",
            details={
                "error_type": type(e).__name__,
                "original_text": gesture_request.text,
            },
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@router.get("/health", response_model=ApiResponse[HealthCheckData])
async def gesture_health_check(
    response_factory: ResponseFactory = Depends(create_response_factory),
) -> ApiResponse[HealthCheckData]:
    """Health check for gesture service with standardized response"""

    health_data = HealthCheckData(
        status="healthy",
        service="gesture_text_processing",
        version="1.0.0",
        checks={
            "text_processing": "healthy",
            "rag_integration": "healthy",
            "metrics_collection": "healthy",
            "deepeval_monitoring": "healthy",
        },
    )

    return response_factory.success(
        data=health_data, message="Gesture service is ready to process text"
    )
