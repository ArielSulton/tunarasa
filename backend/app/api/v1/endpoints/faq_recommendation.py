"""
FAQ Recommendation API endpoints for Tunarasa Backend
Provides endpoints for institution-specific FAQ clustering and recommendations
"""

import logging
from typing import Any, Dict, List, Optional

from app.services.faq_recommendation_service import faq_recommendation_service
from app.services.metrics_service import metrics_service
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()


class FAQRecommendationResponse(BaseModel):
    """Response model for FAQ recommendations"""

    success: bool
    institution_id: int
    data_source: str  # "database" or "fallback"
    total_questions: int
    cluster_count: int
    avg_questions_per_cluster: float
    silhouette_score: float
    processing_time_seconds: float
    recommendations: List[Dict[str, Any]]
    generated_at: float


class ClusterMetricsResponse(BaseModel):
    """Response model for clustering quality metrics"""

    institution_id: int
    cluster_count: int
    avg_questions_per_cluster: float
    silhouette_score: float
    data_source: str
    last_updated: Optional[float]


class ErrorResponse(BaseModel):
    """Error response model"""

    success: bool
    error: str
    institution_id: int
    processing_time_seconds: float
    fallback_recommendations: Optional[List[Dict[str, Any]]] = None


@router.get(
    "/recommendations/{institution_id}", response_model=FAQRecommendationResponse
)
async def get_faq_recommendations(
    institution_id: int,
    force_refresh: bool = Query(False, description="Force refresh clustering cache"),
):
    """
    Get FAQ recommendations for a specific institution

    Uses database-first approach:
    1. Fetches questions from qa_logs table for the institution
    2. If insufficient data, uses relevant fallback clustering with dummy data
    3. Returns clustered FAQ recommendations with quality metrics
    """
    try:
        logger.info(f"Getting FAQ recommendations for institution {institution_id}")

        result = await faq_recommendation_service.get_faq_recommendations(
            institution_id=institution_id, force_refresh=force_refresh
        )

        if result.get("success", False):
            return FAQRecommendationResponse(**result)
        else:
            # Handle error case with fallback recommendations
            raise HTTPException(
                status_code=500,
                detail={
                    "message": result.get("error", "Unknown error occurred"),
                    "fallback_recommendations": result.get(
                        "fallback_recommendations", []
                    ),
                    "processing_time": result.get("processing_time_seconds", 0),
                },
            )

    except Exception as e:
        logger.error(
            f"Error in get_faq_recommendations for institution {institution_id}: {e}"
        )

        # Record error metric
        metrics_service.record_faq_clustering_error(institution_id, type(e).__name__)

        raise HTTPException(
            status_code=500, detail=f"Failed to get FAQ recommendations: {str(e)}"
        )


@router.post("/refresh/{institution_id}")
async def refresh_faq_recommendations(institution_id: int):
    """
    Force refresh FAQ recommendations for specific institution
    Useful for manual refresh or when new questions are added to the database
    """
    try:
        logger.info(
            f"Force refreshing FAQ recommendations for institution {institution_id}"
        )

        result = await faq_recommendation_service.refresh_recommendations(
            institution_id
        )

        if result.get("success", False):
            return {
                "success": True,
                "message": f"Successfully refreshed recommendations for institution {institution_id}",
                "data": result,
            }
        else:
            raise HTTPException(
                status_code=500,
                detail={
                    "message": f"Failed to refresh recommendations: {result.get('error', 'Unknown error')}",
                    "processing_time": result.get("processing_time_seconds", 0),
                },
            )

    except Exception as e:
        logger.error(
            f"Error refreshing recommendations for institution {institution_id}: {e}"
        )

        # Record error metric
        metrics_service.record_faq_clustering_error(institution_id, type(e).__name__)

        raise HTTPException(
            status_code=500, detail=f"Failed to refresh FAQ recommendations: {str(e)}"
        )


@router.get("/metrics/{institution_id}", response_model=Dict[str, Any])
async def get_clustering_metrics(institution_id: int):
    """
    Get clustering quality metrics for specific institution
    Returns metrics that can be used for monitoring and dashboard visualization
    """
    try:
        logger.info(f"Getting clustering metrics for institution {institution_id}")

        metrics = faq_recommendation_service.get_recommendation_metrics(institution_id)

        return {
            "success": True,
            "institution_id": institution_id,
            "metrics": metrics,
            "description": "Clustering quality metrics for FAQ recommendations",
        }

    except Exception as e:
        logger.error(
            f"Error getting clustering metrics for institution {institution_id}: {e}"
        )

        raise HTTPException(
            status_code=500, detail=f"Failed to get clustering metrics: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """
    Health check endpoint for FAQ recommendation service
    """
    try:
        # Test if the service is properly initialized
        service_status = {
            "clustering_service_initialized": bool(
                faq_recommendation_service.clustering_service
            ),
            "metrics_service_initialized": bool(metrics_service),
            "minimum_questions_threshold": faq_recommendation_service.minimum_questions_for_db,
        }

        return {
            "success": True,
            "service": "FAQ Recommendation API",
            "status": "healthy",
            "service_status": service_status,
        }

    except Exception as e:
        logger.error(f"Health check failed: {e}")

        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")


@router.get("/dummy-categories")
async def get_dummy_categories():
    """
    Get available dummy FAQ categories for fallback clustering
    Useful for understanding what types of questions are available
    """
    try:
        dummy_faqs = faq_recommendation_service.get_dummy_faqs_by_category()

        categories_info = {}
        for category, questions in dummy_faqs.items():
            categories_info[category] = {
                "question_count": len(questions),
                "sample_questions": questions[:3],  # First 3 questions as samples
                "description": f"Indonesian government services - {category}",
            }

        return {
            "success": True,
            "total_categories": len(dummy_faqs),
            "categories": categories_info,
            "description": "Available dummy FAQ categories for fallback clustering",
        }

    except Exception as e:
        logger.error(f"Error getting dummy categories: {e}")

        raise HTTPException(
            status_code=500, detail=f"Failed to get dummy categories: {str(e)}"
        )


@router.get("/institutions/{institution_id}/question-count")
async def get_institution_question_count(institution_id: int):
    """
    Get the number of questions available in database for specific institution
    Helps determine if DB-first approach will be used or fallback clustering
    """
    try:
        logger.info(f"Getting question count for institution {institution_id}")

        # Get questions from database
        db_questions = await faq_recommendation_service.get_questions_from_database(
            institution_id
        )

        will_use_db = (
            len(db_questions) >= faq_recommendation_service.minimum_questions_for_db
        )

        return {
            "success": True,
            "institution_id": institution_id,
            "question_count": len(db_questions),
            "minimum_required": faq_recommendation_service.minimum_questions_for_db,
            "will_use_database": will_use_db,
            "data_source": "database" if will_use_db else "fallback",
            "recommendation": (
                "Sufficient questions for database clustering"
                if will_use_db
                else "Will use fallback clustering with relevant dummy data"
            ),
        }

    except Exception as e:
        logger.error(
            f"Error getting question count for institution {institution_id}: {e}"
        )

        raise HTTPException(
            status_code=500, detail=f"Failed to get question count: {str(e)}"
        )
