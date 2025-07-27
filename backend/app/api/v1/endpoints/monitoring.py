"""
Monitoring and metrics endpoints for Tunarasa
Provides Prometheus metrics and DeepEval monitoring data
"""

import logging
from datetime import datetime
from typing import Any, Dict, Optional

from app.core.config import settings
from app.services.deepeval_monitoring import get_deepeval_monitoring_service
from app.services.metrics_service import metrics_service
from fastapi import APIRouter, HTTPException, Response, status
from fastapi.responses import PlainTextResponse
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/monitoring", tags=["monitoring"])


@router.get("/health")
async def monitoring_health_check() -> Dict[str, Any]:
    """Health check for monitoring service"""
    return {
        "success": True,
        "service": "monitoring",
        "status": "healthy",
        "message": "Monitoring services operational",
        "services": {
            "prometheus_metrics": True,
            "deepeval_monitoring": True,
            "system_metrics": True,
        },
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/prometheus-metrics", response_class=PlainTextResponse)
async def get_prometheus_metrics():
    """
    Expose Prometheus metrics in the standard format
    This endpoint provides all collected metrics for Prometheus scraping
    """
    try:
        # Generate metrics in Prometheus format
        metrics_data = generate_latest()
        return Response(content=metrics_data, media_type=CONTENT_TYPE_LATEST)
    except Exception as e:
        logger.error(f"Failed to generate Prometheus metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate metrics",
        )


@router.get("/deepeval/summary")
async def get_deepeval_summary(time_period: str = "24h") -> Dict[str, Any]:
    """
    Get DeepEval monitoring summary for specified time period
    """
    try:
        deepeval_service = get_deepeval_monitoring_service()
        summary = await deepeval_service.get_evaluation_summary(time_period)

        return {
            "success": True,
            "data": summary,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Failed to get DeepEval summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve DeepEval summary",
        )


@router.get("/deepeval/conversation/{conversation_id}")
async def get_conversation_evaluation(conversation_id: str) -> Dict[str, Any]:
    """
    Get evaluation results for a specific conversation
    """
    try:
        deepeval_service = get_deepeval_monitoring_service()
        evaluation = await deepeval_service.get_conversation_evaluation(conversation_id)

        if evaluation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation evaluation not found",
            )

        return {
            "success": True,
            "data": evaluation,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get conversation evaluation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve conversation evaluation",
        )


@router.get("/deepeval/quality-report")
async def get_quality_report() -> Dict[str, Any]:
    """
    Generate comprehensive quality report from DeepEval monitoring
    """
    try:
        deepeval_service = get_deepeval_monitoring_service()
        report = await deepeval_service.generate_quality_report()

        return {
            "success": True,
            "data": report,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Failed to generate quality report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate quality report",
        )


@router.get("/system/metrics")
async def get_system_metrics() -> Dict[str, Any]:
    """
    Get current system metrics summary
    """
    try:
        system_metrics = metrics_service.get_system_metrics()

        return {
            "success": True,
            "data": system_metrics,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Failed to get system metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve system metrics",
        )


@router.get("/system/status")
async def get_system_status() -> Dict[str, Any]:
    """
    Get comprehensive system status including all services
    """
    try:
        # Get basic system metrics
        system_metrics = metrics_service.get_system_metrics()

        # Get DeepEval service status
        # deepeval_service = get_deepeval_monitoring_service()  # Currently unused

        # Calculate system health score
        health_score = 1.0
        issues = []

        # Check gesture recognition accuracy
        gesture_accuracy = system_metrics.get("gesture_accuracy", 0.0)
        if gesture_accuracy < 0.7:
            health_score *= 0.9
            issues.append("Low gesture recognition accuracy")

        # Check AI confidence
        ai_confidence = system_metrics.get("ai_confidence", 0.0)
        if ai_confidence < 0.7:
            health_score *= 0.9
            issues.append("Low AI response confidence")

        # Check active sessions
        active_sessions = system_metrics.get("active_sessions", 0)
        if active_sessions < 0:
            health_score *= 0.8
            issues.append("Invalid session count")

        status = {
            "overall_health_score": health_score,
            "status": (
                "healthy"
                if health_score >= 0.8
                else "degraded" if health_score >= 0.6 else "unhealthy"
            ),
            "issues": issues,
            "services": {
                "prometheus_metrics": True,
                "deepeval_monitoring": True,
                "gesture_recognition": gesture_accuracy >= 0.7,
                "ai_services": ai_confidence >= 0.7,
                "database": system_metrics.get("database_connections", 0) > 0,
            },
            "metrics": system_metrics,
            "environment": settings.ENVIRONMENT,
            "version": "0.4.0",
        }

        return {
            "success": True,
            "data": status,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Failed to get system status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve system status",
        )


@router.post("/test/record-metrics")
async def record_test_metrics(
    metric_type: str, value: float, labels: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """
    Test endpoint to record sample metrics for monitoring validation
    """
    try:
        if metric_type == "gesture":
            metrics_service.record_gesture_recognition(
                gesture_type=labels.get("gesture_type", "test"),
                confidence=value,
                accuracy=labels.get("accuracy", 0.8) if labels else 0.8,
            )
        elif metric_type == "ai":
            metrics_service.record_ai_request(
                model=labels.get("model", "test-model") if labels else "test-model",
                request_type=labels.get("request_type", "test") if labels else "test",
                duration=value,
                confidence=labels.get("confidence", 0.8) if labels else 0.8,
            )
        elif metric_type == "deepeval":
            metrics_service.record_deepeval_score(
                metric_type=labels.get("category", "test") if labels else "test",
                score=value,
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown metric type: {metric_type}",
            )

        return {
            "success": True,
            "message": f"Test metric recorded: {metric_type} = {value}",
            "labels": labels or {},
            "timestamp": datetime.utcnow().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to record test metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record test metrics",
        )
