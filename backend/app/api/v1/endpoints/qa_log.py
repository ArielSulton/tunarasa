"""
QA Log API Endpoints

Endpoints for logging and managing Q&A interactions
Supports both direct logging and admin validation workflows
"""

from datetime import datetime
from typing import Any, Dict, Optional

from app.services.qa_logging_service import QALoggingService, get_qa_logging_service
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v1/qa-log", tags=["qa-logging"])


# Request Models
class QALogRequest(BaseModel):
    """Request model for logging QA interactions"""

    session_id: str = Field(..., description="Session identifier")
    question: str = Field(..., description="User question")
    answer: str = Field(..., description="System answer")
    confidence: Optional[int] = Field(None, description="Confidence score (0-100)")
    response_time: Optional[int] = Field(
        None, description="Response time in milliseconds"
    )
    gesture_input: Optional[str] = Field(None, description="Original gesture input")
    context_used: Optional[str] = Field(None, description="Context information")
    evaluation_score: Optional[int] = Field(
        None, description="Quality evaluation score (0-100)"
    )
    service_mode: str = Field(default="full_llm_bot", description="Service mode")
    responded_by: str = Field(default="llm", description="Who responded (llm/admin)")
    admin_id: Optional[int] = Field(None, description="Admin ID if responded by admin")
    llm_recommendation_used: bool = Field(
        default=False, description="LLM recommendation used"
    )
    institution_id: int = Field(default=1, description="Institution ID")
    conversation_id: Optional[int] = Field(None, description="Related conversation ID")


class AdminValidationLogRequest(BaseModel):
    """Request model for admin validation QA logging"""

    session_id: str
    question: str
    answer: str
    service_mode: str = "bot_with_admin_validation"
    responded_by: str = "llm"
    conversation_id: Optional[int] = None
    institution_id: int = 1
    llm_recommendation_used: bool = False
    confidence: int = 75


class GestureLogRequest(BaseModel):
    """Request model for gesture-based QA logging"""

    session_id: str
    gesture_input: str
    question: str
    answer: str
    confidence: Optional[int] = None
    response_time: Optional[int] = None
    institution_id: int = 1


# Response Models
class QALogResponse(BaseModel):
    """Response model for QA log operations"""

    success: bool
    qa_log_id: Optional[int] = None
    message: str


@router.post("/log", response_model=QALogResponse)
async def log_qa_interaction(
    request: QALogRequest,
    qa_service: QALoggingService = Depends(get_qa_logging_service),
):
    """
    Log a Q&A interaction

    This endpoint logs any Q&A interaction to the database with comprehensive tracking.
    Supports both LLM and admin responses.
    """
    try:
        qa_log_id = await qa_service.log_qa_interaction(
            session_id=request.session_id,
            question=request.question,
            answer=request.answer,
            confidence=request.confidence,
            response_time=request.response_time,
            gesture_input=request.gesture_input,
            context_used=request.context_used,
            evaluation_score=request.evaluation_score,
            service_mode=request.service_mode,
            responded_by=request.responded_by,
            admin_id=request.admin_id,
            llm_recommendation_used=request.llm_recommendation_used,
            institution_id=request.institution_id,
            conversation_id=request.conversation_id,
        )

        if qa_log_id:
            return QALogResponse(
                success=True,
                qa_log_id=qa_log_id,
                message="QA interaction logged successfully",
            )
        else:
            return QALogResponse(success=False, message="Failed to log QA interaction")

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to log QA interaction: {str(e)}"
        )


@router.post("/admin-validation", response_model=QALogResponse)
async def log_admin_validation_qa(
    request: AdminValidationLogRequest,
    qa_service: QALoggingService = Depends(get_qa_logging_service),
):
    """
    Log a Q&A interaction in admin validation mode

    This endpoint is specifically for bot_with_admin_validation service mode.
    It logs the initial LLM response that's pending admin approval.
    """
    try:
        qa_log_id = await qa_service.log_qa_interaction(
            session_id=request.session_id,
            question=request.question,
            answer=request.answer,
            confidence=request.confidence,
            service_mode=request.service_mode,
            responded_by=request.responded_by,
            conversation_id=request.conversation_id,
            institution_id=request.institution_id,
            llm_recommendation_used=request.llm_recommendation_used,
        )

        if qa_log_id:
            return QALogResponse(
                success=True,
                qa_log_id=qa_log_id,
                message="Admin validation QA logged successfully",
            )
        else:
            return QALogResponse(
                success=False, message="Failed to log admin validation QA"
            )

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to log admin validation QA: {str(e)}"
        )


@router.post("/gesture", response_model=QALogResponse)
async def log_gesture_qa(
    request: GestureLogRequest,
    qa_service: QALoggingService = Depends(get_qa_logging_service),
):
    """
    Log a gesture-based Q&A interaction

    This endpoint logs Q&A interactions that originated from gesture input.
    """
    try:
        qa_log_id = await qa_service.log_gesture_interaction(
            session_id=request.session_id,
            gesture_input=request.gesture_input,
            question=request.question,
            answer=request.answer,
            confidence=request.confidence,
            response_time=request.response_time,
            institution_id=request.institution_id,
        )

        if qa_log_id:
            return QALogResponse(
                success=True,
                qa_log_id=qa_log_id,
                message="Gesture QA interaction logged successfully",
            )
        else:
            return QALogResponse(
                success=False, message="Failed to log gesture QA interaction"
            )

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to log gesture QA: {str(e)}"
        )


@router.get("/institution/{institution_id}", response_model=Dict[str, Any])
async def get_qa_logs_for_institution(
    institution_id: int,
    limit: int = 100,
    offset: int = 0,
    min_confidence: Optional[int] = None,
    qa_service: QALoggingService = Depends(get_qa_logging_service),
):
    """
    Get QA logs for a specific institution

    This endpoint retrieves QA logs for FAQ clustering and analysis.
    Used by the FAQ recommendation system to get real user data.
    """
    try:
        qa_logs = await qa_service.get_qa_logs_for_institution(
            institution_id=institution_id,
            limit=limit,
            offset=offset,
            min_confidence=min_confidence,
        )

        return {
            "success": True,
            "institution_id": institution_id,
            "total_logs": len(qa_logs),
            "qa_logs": qa_logs,
            "filters": {
                "limit": limit,
                "offset": offset,
                "min_confidence": min_confidence,
            },
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get QA logs for institution {institution_id}: {str(e)}",
        )


@router.get("/health")
async def qa_log_health_check():
    """Health check endpoint for QA logging service"""
    return {
        "success": True,
        "service": "qa-logging",
        "status": "healthy",
        "timestamp": datetime.utcnow(),
        "endpoints": [
            "/api/v1/qa-log/log",
            "/api/v1/qa-log/admin-validation",
            "/api/v1/qa-log/gesture",
            "/api/v1/qa-log/institution/{institution_id}",
        ],
    }
