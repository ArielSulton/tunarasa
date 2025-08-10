"""
API V1 Router - Updated for new 6-table schema
"""

from app.api.v1.endpoints import (
    admin,
    conversation,
    gesture,
    health,
    monitoring,
    public_session,
    rag,
    session,
    summary,
)
from fastapi import APIRouter

api_router = APIRouter()

# QR Code and Summary endpoints
api_router.include_router(summary.router, prefix="/summary", tags=["summary"])

# Conversation management endpoints
api_router.include_router(
    conversation.router, prefix="/conversation", tags=["conversation"]
)

# Keep existing functional endpoints
api_router.include_router(rag.router, prefix="/rag", tags=["rag"])
api_router.include_router(health.router, prefix="/health", tags=["health"])

# Admin and gesture endpoints
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(gesture.router, prefix="/gesture", tags=["gesture"])

# Monitoring endpoints
api_router.include_router(monitoring.router, prefix="/monitoring", tags=["monitoring"])

# Session management endpoints
api_router.include_router(session.router, prefix="/session", tags=["session"])

# Public session tracking endpoints (no auth required)
api_router.include_router(
    public_session.router, prefix="/public-session", tags=["public-session"]
)
