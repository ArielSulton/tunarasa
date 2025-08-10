"""
Session Management API endpoints
Handles frontend session tracking and active users metrics
"""

import logging
from datetime import datetime
from typing import List, Optional

from app.middleware.response_middleware import ResponseFactory, create_response_factory
from app.models.api_response import ApiResponse
from app.services.metrics_service import metrics_service
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(tags=["session"])


class SessionUpdateRequest(BaseModel):
    """Request model for updating active sessions"""

    session_ids: List[str] = Field(
        description="List of currently active session IDs",
        example=["admin_session_123", "guest_session_456"],
    )
    active_users: Optional[int] = Field(
        default=None, ge=0, description="Number of active users (optional)"
    )


class SessionMetricsData(BaseModel):
    """Response data for session metrics"""

    active_sessions: int = Field(description="Number of active sessions")
    updated_at: datetime = Field(description="Last update timestamp")
    message: str = Field(description="Update result message")


@router.post("/update-active", response_model=ApiResponse[SessionMetricsData])
async def update_active_sessions(
    request: SessionUpdateRequest,
    response_factory: ResponseFactory = Depends(create_response_factory),
) -> ApiResponse[SessionMetricsData]:
    """
    Update active sessions count from frontend
    This endpoint allows frontend to report current active sessions
    """
    try:
        # Convert to set for efficient operations
        current_session_ids = set(request.session_ids)

        # Cleanup expired sessions and update with current ones
        metrics_service.cleanup_expired_sessions(current_session_ids)

        # Add any new sessions
        for session_id in current_session_ids:
            metrics_service.add_active_session(session_id)

        # Get updated count
        active_count = metrics_service.get_active_sessions_count()

        logger.info(
            f"Updated active sessions: {active_count} (IDs: {list(current_session_ids)})"
        )

        response_data = SessionMetricsData(
            active_sessions=active_count,
            updated_at=datetime.utcnow(),
            message=f"Successfully updated {active_count} active sessions",
        )

        return response_factory.success(
            data=response_data, message="Active sessions updated successfully"
        )

    except Exception as e:
        logger.error(f"Error updating active sessions: {e}", exc_info=True)
        return response_factory.error(
            code="SESSION_UPDATE_ERROR",
            message="Failed to update active sessions",
            details={"error_type": type(e).__name__},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@router.get("/metrics", response_model=ApiResponse[SessionMetricsData])
async def get_session_metrics(
    response_factory: ResponseFactory = Depends(create_response_factory),
) -> ApiResponse[SessionMetricsData]:
    """
    Get current session metrics
    Returns the current number of active sessions
    """
    try:
        active_count = metrics_service.get_active_sessions_count()

        response_data = SessionMetricsData(
            active_sessions=active_count,
            updated_at=datetime.utcnow(),
            message=f"Current active sessions: {active_count}",
        )

        return response_factory.success(
            data=response_data, message="Session metrics retrieved successfully"
        )

    except Exception as e:
        logger.error(f"Error getting session metrics: {e}", exc_info=True)
        return response_factory.error(
            code="SESSION_METRICS_ERROR",
            message="Failed to get session metrics",
            details={"error_type": type(e).__name__},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@router.post("/start/{session_id}", response_model=ApiResponse[SessionMetricsData])
async def start_session(
    session_id: str,
    response_factory: ResponseFactory = Depends(create_response_factory),
) -> ApiResponse[SessionMetricsData]:
    """
    Start a new user session
    Adds session to active sessions tracking
    """
    try:
        # Add the session
        metrics_service.add_active_session(session_id)

        # Record session creation
        metrics_service.record_session_metrics(duration=0, question_count=0)

        active_count = metrics_service.get_active_sessions_count()

        logger.info(f"Started new session: {session_id} (total: {active_count})")

        response_data = SessionMetricsData(
            active_sessions=active_count,
            updated_at=datetime.utcnow(),
            message=f"Session started: {session_id}",
        )

        return response_factory.success(
            data=response_data, message="Session started successfully"
        )

    except Exception as e:
        logger.error(f"Error starting session {session_id}: {e}", exc_info=True)
        return response_factory.error(
            code="SESSION_START_ERROR",
            message="Failed to start session",
            details={"session_id": session_id, "error_type": type(e).__name__},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@router.delete("/end/{session_id}", response_model=ApiResponse[SessionMetricsData])
async def end_session(
    session_id: str,
    response_factory: ResponseFactory = Depends(create_response_factory),
) -> ApiResponse[SessionMetricsData]:
    """
    End a user session
    Removes session from active sessions tracking
    """
    try:
        # Remove the session
        metrics_service.remove_active_session(session_id)

        active_count = metrics_service.get_active_sessions_count()

        logger.info(f"Ended session: {session_id} (remaining: {active_count})")

        response_data = SessionMetricsData(
            active_sessions=active_count,
            updated_at=datetime.utcnow(),
            message=f"Session ended: {session_id}",
        )

        return response_factory.success(
            data=response_data, message="Session ended successfully"
        )

    except Exception as e:
        logger.error(f"Error ending session {session_id}: {e}", exc_info=True)
        return response_factory.error(
            code="SESSION_END_ERROR",
            message="Failed to end session",
            details={"session_id": session_id, "error_type": type(e).__name__},
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
