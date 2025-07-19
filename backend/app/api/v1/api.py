"""
API V1 Router - Updated for new 6-table schema
"""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    users,
    conversations,
    messages,
    question,
    rag,
    health,
    summary
)

api_router = APIRouter()

# Include new schema endpoint routers
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(conversations.router, prefix="/conversations", tags=["conversations"])
api_router.include_router(messages.router, prefix="/messages", tags=["messages"])

# QR Code and Summary endpoints
api_router.include_router(summary.router, prefix="/summary", tags=["summary"])

# Keep existing functional endpoints
api_router.include_router(question.router, prefix="/question", tags=["question"])
api_router.include_router(rag.router, prefix="/rag", tags=["rag"])
api_router.include_router(health.router, prefix="/health", tags=["health"])

# Note: admin, session, and gesture endpoints removed as they're not part of new schema