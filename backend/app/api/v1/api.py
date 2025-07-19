"""
API V1 Router - Updated for new 6-table schema
"""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    question,
    rag,
    health,
    summary,
    admin,
    gesture
)

api_router = APIRouter()

# QR Code and Summary endpoints
api_router.include_router(summary.router, prefix="/summary", tags=["summary"])

# Keep existing functional endpoints
api_router.include_router(question.router, prefix="/question", tags=["question"])
api_router.include_router(rag.router, prefix="/rag", tags=["rag"])
api_router.include_router(health.router, prefix="/health", tags=["health"])

# Admin and gesture endpoints
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(gesture.router, prefix="/gesture", tags=["gesture"])