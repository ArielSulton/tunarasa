"""
Admin FAQ Management API endpoints
Provides admin-only endpoints for managing FAQ clustering and recommendations
"""

import logging
from datetime import datetime
from typing import Any, Dict, List

from app.api.middleware.auth import get_current_admin_user
from app.services.faq_recommendation_service import faq_recommendation_service
from app.services.metrics_service import metrics_service
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()


class FAQAdminStatsResponse(BaseModel):
    """Admin statistics for FAQ system"""

    total_institutions: int
    active_clustering_operations: int
    total_recommendations_served_24h: int
    average_clustering_quality: float
    data_source_distribution: Dict[str, int]
    error_rate_24h: float
    top_performing_institutions: List[Dict[str, Any]]
    recent_clustering_operations: List[Dict[str, Any]]


class BulkRefreshRequest(BaseModel):
    """Request model for bulk refresh operations"""

    institution_ids: List[int]
    force_refresh: bool = True
    notify_completion: bool = False


class ClusteringParametersRequest(BaseModel):
    """Request model for updating clustering parameters"""

    institution_id: int
    min_cluster_size: int = 3
    max_clusters: int = 15
    similarity_threshold: float = 0.5
    minimum_questions_for_db: int = 20


@router.get("/stats", response_model=FAQAdminStatsResponse)
async def get_admin_faq_stats(admin_user=Depends(get_current_admin_user)):
    """
    Get comprehensive FAQ system statistics for admin dashboard
    Requires admin authentication
    """
    try:
        logger.info(f"Admin {admin_user['email']} requesting FAQ stats")

        # Get comprehensive stats from metrics service
        stats = await faq_recommendation_service.get_admin_statistics()

        return FAQAdminStatsResponse(**stats)

    except Exception as e:
        logger.error(f"Error getting admin FAQ stats: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get FAQ statistics: {str(e)}"
        )


@router.post("/bulk-refresh")
async def bulk_refresh_recommendations(
    request: BulkRefreshRequest, admin_user=Depends(get_current_admin_user)
):
    """
    Bulk refresh FAQ recommendations for multiple institutions
    Useful for admin maintenance operations
    """
    try:
        logger.info(
            f"Admin {admin_user['email']} initiating bulk refresh for institutions: {request.institution_ids}"
        )

        results = []
        for institution_id in request.institution_ids:
            try:
                result = await faq_recommendation_service.refresh_recommendations(
                    institution_id, force_refresh=request.force_refresh
                )
                results.append(
                    {
                        "institution_id": institution_id,
                        "success": result.get("success", False),
                        "processing_time": result.get("processing_time_seconds", 0),
                        "cluster_count": result.get("cluster_count", 0),
                        "data_source": result.get("data_source", "unknown"),
                    }
                )

                # Record admin action
                metrics_service.record_faq_clustering_operation(
                    institution_id=institution_id,
                    data_source="admin_refresh",
                    duration_seconds=result.get("processing_time_seconds", 0),
                    success=result.get("success", False),
                )

            except Exception as e:
                logger.error(f"Failed to refresh institution {institution_id}: {e}")
                results.append(
                    {
                        "institution_id": institution_id,
                        "success": False,
                        "error": str(e),
                    }
                )

        successful_refreshes = sum(1 for r in results if r.get("success", False))

        return {
            "success": True,
            "total_requested": len(request.institution_ids),
            "successful_refreshes": successful_refreshes,
            "failed_refreshes": len(request.institution_ids) - successful_refreshes,
            "results": results,
            "initiated_by": admin_user["email"],
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Error in bulk refresh: {e}")
        raise HTTPException(status_code=500, detail=f"Bulk refresh failed: {str(e)}")


@router.get("/institutions/{institution_id}/detailed-metrics")
async def get_institution_detailed_metrics(
    institution_id: int,
    days: int = Query(7, ge=1, le=30),
    admin_user=Depends(get_current_admin_user),
):
    """
    Get detailed metrics for specific institution over time period
    """
    try:
        logger.info(
            f"Admin {admin_user['email']} requesting detailed metrics for institution {institution_id}"
        )

        # Get detailed metrics including historical data
        metrics = await faq_recommendation_service.get_detailed_institution_metrics(
            institution_id=institution_id, days=days
        )

        return {
            "success": True,
            "institution_id": institution_id,
            "period_days": days,
            "metrics": metrics,
            "generated_at": datetime.utcnow().isoformat(),
            "requested_by": admin_user["email"],
        }

    except Exception as e:
        logger.error(
            f"Error getting detailed metrics for institution {institution_id}: {e}"
        )
        raise HTTPException(
            status_code=500, detail=f"Failed to get detailed metrics: {str(e)}"
        )


@router.post("/institutions/{institution_id}/parameters")
async def update_clustering_parameters(
    institution_id: int,
    request: ClusteringParametersRequest,
    admin_user=Depends(get_current_admin_user),
):
    """
    Update clustering parameters for specific institution
    """
    try:
        logger.info(
            f"Admin {admin_user['email']} updating clustering parameters for institution {institution_id}"
        )

        # Validate parameters
        if request.min_cluster_size < 2 or request.min_cluster_size > 10:
            raise HTTPException(
                status_code=400, detail="min_cluster_size must be between 2 and 10"
            )

        if request.max_clusters < 3 or request.max_clusters > 50:
            raise HTTPException(
                status_code=400, detail="max_clusters must be between 3 and 50"
            )

        if request.similarity_threshold < 0.1 or request.similarity_threshold > 0.9:
            raise HTTPException(
                status_code=400,
                detail="similarity_threshold must be between 0.1 and 0.9",
            )

        # Update parameters (this would be stored in database in full implementation)
        await faq_recommendation_service.update_clustering_parameters(
            institution_id=institution_id,
            parameters={
                "min_cluster_size": request.min_cluster_size,
                "max_clusters": request.max_clusters,
                "similarity_threshold": request.similarity_threshold,
                "minimum_questions_for_db": request.minimum_questions_for_db,
            },
            updated_by=admin_user["id"],
        )

        return {
            "success": True,
            "institution_id": institution_id,
            "updated_parameters": request.dict(),
            "updated_by": admin_user["email"],
            "timestamp": datetime.utcnow().isoformat(),
            "requires_refresh": True,
            "message": "Parameters updated successfully. Refresh recommendations to apply changes.",
        }

    except Exception as e:
        logger.error(f"Error updating clustering parameters: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to update parameters: {str(e)}"
        )


@router.get("/system/health-check")
async def admin_system_health_check(admin_user=Depends(get_current_admin_user)):
    """
    Comprehensive system health check for FAQ clustering system
    """
    try:
        logger.info(f"Admin {admin_user['email']} requesting system health check")

        health_status = await faq_recommendation_service.comprehensive_health_check()

        return {
            "success": True,
            "timestamp": datetime.utcnow().isoformat(),
            "checked_by": admin_user["email"],
            "health_status": health_status,
        }

    except Exception as e:
        logger.error(f"Error in admin health check: {e}")
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")


@router.post("/system/clear-cache")
async def clear_system_cache(admin_user=Depends(get_current_admin_user)):
    """
    Clear all FAQ recommendation caches
    Use with caution as this will force all institutions to recalculate recommendations
    """
    try:
        logger.warning(
            f"Admin {admin_user['email']} clearing FAQ recommendation caches"
        )

        result = await faq_recommendation_service.clear_all_caches()

        return {
            "success": True,
            "cleared_caches": result.get("cleared_count", 0),
            "cleared_by": admin_user["email"],
            "timestamp": datetime.utcnow().isoformat(),
            "warning": "All institutions will need to recalculate recommendations on next request",
        }

    except Exception as e:
        logger.error(f"Error clearing caches: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear caches: {str(e)}")


@router.get("/analytics/usage-report")
async def get_usage_analytics_report(
    start_date: str = Query(..., description="Start date in YYYY-MM-DD format"),
    end_date: str = Query(..., description="End date in YYYY-MM-DD format"),
    admin_user=Depends(get_current_admin_user),
):
    """
    Generate comprehensive usage analytics report for FAQ system
    """
    try:
        logger.info(
            f"Admin {admin_user['email']} requesting usage report from {start_date} to {end_date}"
        )

        # Parse dates
        try:
            start_dt = datetime.fromisoformat(start_date)
            end_dt = datetime.fromisoformat(end_date)
        except ValueError:
            raise HTTPException(
                status_code=400, detail="Invalid date format. Use YYYY-MM-DD"
            )

        # Validate date range
        if end_dt <= start_dt:
            raise HTTPException(
                status_code=400, detail="End date must be after start date"
            )

        if (end_dt - start_dt).days > 90:
            raise HTTPException(
                status_code=400, detail="Date range cannot exceed 90 days"
            )

        report = await faq_recommendation_service.generate_usage_report(
            start_date=start_dt, end_date=end_dt
        )

        return {
            "success": True,
            "report_period": {
                "start_date": start_date,
                "end_date": end_date,
                "days": (end_dt - start_dt).days,
            },
            "report": report,
            "generated_by": admin_user["email"],
            "generated_at": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Error generating usage report: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to generate report: {str(e)}"
        )
