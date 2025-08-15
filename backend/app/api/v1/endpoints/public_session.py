"""
Public Session Tracking API endpoints (no auth required)
Handles session metrics for Grafana dashboards
"""

import logging
from datetime import datetime, timezone
from typing import List

from app.services.metrics_service import metrics_service
from fastapi import APIRouter
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(tags=["public-session"])


class PublicSessionRequest(BaseModel):
    """Request model for public session tracking"""

    session_ids: List[str] = Field(
        description="List of currently active session IDs",
        example=["admin_session_123", "guest_session_456"],
    )


@router.post("/track-sessions")
async def track_active_sessions(request: PublicSessionRequest):
    """
    Track active sessions from frontend (no auth required)
    Updates the active sessions count for Grafana dashboards
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
            f"Tracked active sessions: {active_count} (IDs: {list(current_session_ids)})"
        )

        return {
            "success": True,
            "active_sessions": active_count,
            "tracked_sessions": list(current_session_ids),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        logger.error(f"Error tracking active sessions: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


@router.post("/start-session/{session_id}")
async def start_public_session(session_id: str):
    """
    Start a public session (no auth required)
    For guest users and admin tracking
    """
    try:
        # Add the session
        metrics_service.add_active_session(session_id)

        active_count = metrics_service.get_active_sessions_count()

        logger.info(f"Started public session: {session_id} (total: {active_count})")

        return {
            "success": True,
            "session_id": session_id,
            "active_sessions": active_count,
            "message": f"Session started: {session_id}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        logger.error(f"Error starting public session {session_id}: {e}", exc_info=True)
        return {
            "success": False,
            "session_id": session_id,
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


@router.delete("/end-session/{session_id}")
async def end_public_session(session_id: str):
    """
    End a public session (no auth required)
    """
    try:
        # Remove the session
        metrics_service.remove_active_session(session_id)

        active_count = metrics_service.get_active_sessions_count()

        logger.info(f"Ended public session: {session_id} (remaining: {active_count})")

        return {
            "success": True,
            "session_id": session_id,
            "active_sessions": active_count,
            "message": f"Session ended: {session_id}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        logger.error(f"Error ending public session {session_id}: {e}", exc_info=True)
        return {
            "success": False,
            "session_id": session_id,
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


@router.get("/session-count")
async def get_session_count():
    """
    Get current active session count (no auth required)
    Public endpoint for metrics monitoring
    """
    try:
        active_count = metrics_service.get_active_sessions_count()

        return {
            "success": True,
            "active_sessions": active_count,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        logger.error(f"Error getting session count: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
