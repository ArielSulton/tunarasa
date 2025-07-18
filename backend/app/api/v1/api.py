"""
API V1 Router
"""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    gesture,
    question,
    admin,
    rag,
    session,
    health
)

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(gesture.router, prefix="/gesture", tags=["gesture"])
api_router.include_router(question.router, prefix="/question", tags=["question"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(rag.router, prefix="/rag", tags=["rag"])
api_router.include_router(session.router, prefix="/session", tags=["session"])
api_router.include_router(health.router, prefix="/health", tags=["health"])