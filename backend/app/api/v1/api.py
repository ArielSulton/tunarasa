"""
API V1 Router - Updated for new 6-table schema
"""

from app.api.v1.endpoints import (
    admin,
    admin_faq,
    conversation,
    faq_clustering,
    faq_recommendation,
    gesture,
    health,
    institutions,
    metrics,
    monitoring,
    public_session,
    qa_log,
    rag,
    rag_processing,
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
api_router.include_router(
    rag_processing.router, prefix="/rag-processing", tags=["rag-processing"]
)
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

# FAQ clustering and recommendation endpoints
api_router.include_router(
    faq_clustering.router, prefix="/faq-clustering", tags=["faq-clustering"]
)
api_router.include_router(
    faq_recommendation.router, prefix="/faq", tags=["faq-recommendations"]
)

# Admin FAQ management endpoints (requires authentication)
api_router.include_router(admin_faq.router, prefix="/admin/faq", tags=["admin-faq"])

# QA logging endpoints (for fixing empty qa_logs table)
api_router.include_router(qa_log.router, tags=["qa-logging"])

# Institution management endpoints (public and admin)
api_router.include_router(
    institutions.router, prefix="/institutions", tags=["institutions"]
)

# Prometheus metrics endpoint for Grafana
api_router.include_router(metrics.router, tags=["metrics"])
