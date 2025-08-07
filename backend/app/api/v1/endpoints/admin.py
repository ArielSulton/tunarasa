"""
Admin API endpoints for dashboard and user management
Requires Supabase JWT authentication with admin role
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict

from app.core.database import get_db_session
from app.db.crud import ConversationCRUD, GenderCRUD, RoleCRUD, StatsCRUD, UserCRUD
from app.db.models import Conversation, Message
from app.middleware.admin_validation import (
    AdminValidationSettings,
    get_admin_validation_service,
)
from app.models.user import UserUpdate
from app.services.deepeval_monitoring import (
    LLMConversation,
    get_deepeval_monitoring_service,
)
from app.services.llm_recommendation_service import (
    analyze_and_recommend,
    get_llm_recommendation_service,
)
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


# Admin Dashboard Endpoints


@router.get("/dashboard/stats")
async def get_dashboard_stats(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """Get comprehensive dashboard statistics"""
    try:
        # Get basic stats
        stats = await StatsCRUD.get_dashboard_stats(db)

        # Add current admin user info
        admin_user = getattr(request.state, "user", None)
        if admin_user:
            stats["current_admin"] = {
                "id": admin_user.get("id"),
                "email": admin_user.get("email"),
                "name": admin_user.get("full_name"),
            }

        # Add timestamp
        stats["last_updated"] = datetime.utcnow().isoformat()

        return {
            "success": True,
            "data": stats,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Error getting dashboard stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve dashboard statistics",
        )


@router.get("/dashboard/metrics")
async def get_dashboard_metrics(
    request: Request,
    period: str = Query("week", pattern="^(day|week|month|year)$"),
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    """Get dashboard metrics for specified time period"""
    try:
        # Calculate date range based on period
        now = datetime.utcnow()
        if period == "day":
            start_date = now - timedelta(days=1)
        elif period == "week":
            start_date = now - timedelta(weeks=1)
        elif period == "month":
            start_date = now - timedelta(days=30)
        else:  # year
            start_date = now - timedelta(days=365)

        # Get time-filtered stats for the current period
        current_stats = await StatsCRUD.get_time_filtered_stats(db, start_date, now)

        # Calculate previous period for growth comparison
        period_duration = now - start_date
        previous_start_date = start_date - period_duration
        previous_stats = await StatsCRUD.get_time_filtered_stats(
            db, previous_start_date, start_date
        )

        # Calculate growth rate by comparing current vs previous period
        current_sessions = current_stats.get("total_sessions", 0)
        previous_sessions = previous_stats.get("total_sessions", 0)

        growth_rate = 0.0
        if previous_sessions > 0:
            growth_rate = (current_sessions - previous_sessions) / previous_sessions
        elif current_sessions > 0:
            growth_rate = 1.0  # 100% growth if no previous data but current data exists

        # Clamp growth rate to reasonable bounds
        growth_rate = min(max(-1.0, growth_rate), 5.0)  # Between -100% and +500%

        # Calculate engagement rate based on time-filtered Q&A activity
        current_questions = current_stats.get("total_questions", 0)
        current_conversations = current_stats.get(
            "total_conversations", 1
        )  # Use conversations instead of sessions

        # Engagement rate = questions per conversation (normalized to 0-1 scale)
        questions_per_conversation = (
            current_questions / current_conversations
            if current_conversations > 0
            else 0
        )
        engagement_rate = min(
            questions_per_conversation / 5.0, 1.0
        )  # Normalize assuming 5 questions = 100% engagement

        # Compare engagement with previous period
        previous_questions = previous_stats.get("total_questions", 0)
        previous_conversations = previous_stats.get("total_conversations", 1)
        previous_engagement = (
            (previous_questions / previous_conversations)
            if previous_conversations > 0
            else 0
        )
        engagement_growth = 0.0
        if previous_engagement > 0:
            engagement_growth = (
                questions_per_conversation - previous_engagement
            ) / previous_engagement
        metrics = {
            "period": period,
            "start_date": start_date.isoformat(),
            "end_date": now.isoformat(),
            "current_period": current_stats,
            "previous_period": previous_stats,
            "growth_rate": round(growth_rate, 3),
            "engagement_rate": round(engagement_rate, 3),
            "engagement_growth": round(engagement_growth, 3),
            "questions_per_conversation": round(questions_per_conversation, 2),
            "comparison": {
                "sessions": {
                    "current": current_sessions,
                    "previous": previous_sessions,
                    "change": current_sessions - previous_sessions,
                },
                "questions": {
                    "current": current_questions,
                    "previous": previous_questions,
                    "change": current_questions - previous_questions,
                },
            },
        }

        return {
            "success": True,
            "data": metrics,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Error getting dashboard metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve dashboard metrics",
        )


# User Management Endpoints


@router.get("/users")
async def get_all_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    """Get all users with pagination"""
    try:
        users = await UserCRUD.get_all(db, skip=skip, limit=limit)

        # Convert to dict format
        users_data = []
        for user in users:
            user_dict = {
                "user_id": user.user_id,
                "supabase_user_id": user.supabase_user_id,
                "full_name": user.full_name,
                "role": user.role.role_name if user.role else None,
                "gender": user.gender.gender_name if user.gender else None,
                "created_at": user.created_at.isoformat(),
                "updated_at": user.updated_at.isoformat(),
                "conversation_count": (
                    len(user.conversations) if user.conversations else 0
                ),
            }
            users_data.append(user_dict)

        return {
            "success": True,
            "data": {
                "users": users_data,
                "pagination": {"skip": skip, "limit": limit, "total": len(users_data)},
            },
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Error getting users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve users",
        )


@router.get("/users/{user_id}")
async def get_user_by_id(
    user_id: int, db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """Get user by ID with full details"""
    try:
        user = await UserCRUD.get_by_id(db, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        # Get user conversations
        conversations = await ConversationCRUD.get_by_user(
            db, user_id, active_only=False
        )

        user_data = {
            "user_id": user.user_id,
            "supabase_user_id": user.supabase_user_id,
            "full_name": user.full_name,
            "role": user.role.role_name if user.role else None,
            "gender": user.gender.gender_name if user.gender else None,
            "created_at": user.created_at.isoformat(),
            "updated_at": user.updated_at.isoformat(),
            "conversations": [
                {
                    "conversation_id": conv.conversation_id,
                    "is_active": conv.is_active,
                    "created_at": conv.created_at.isoformat(),
                    "message_count": len(conv.messages) if conv.messages else 0,
                }
                for conv in conversations
            ],
        }

        return {
            "success": True,
            "data": user_data,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user",
        )


@router.put("/users/{user_id}")
async def update_user(
    user_id: int, user_update: UserUpdate, db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """Update user information"""
    try:
        # Check if user exists
        existing_user = await UserCRUD.get_by_id(db, user_id)
        if not existing_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        # Update user
        updated_user = await UserCRUD.update(
            db, user_id, **user_update.dict(exclude_unset=True)
        )

        if not updated_user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update user",
            )

        user_data = {
            "user_id": updated_user.user_id,
            "supabase_user_id": updated_user.supabase_user_id,
            "full_name": updated_user.full_name,
            "role": updated_user.role.role_name if updated_user.role else None,
            "gender": updated_user.gender.gender_name if updated_user.gender else None,
            "updated_at": updated_user.updated_at.isoformat(),
        }

        return {
            "success": True,
            "data": user_data,
            "message": "User updated successfully",
            "timestamp": datetime.utcnow().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user",
        )


# Conversation Management Endpoints


@router.get("/conversations")
async def get_all_conversations(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    """Get all conversations with pagination"""
    try:
        # Implement conversation listing with filtering
        from sqlalchemy import desc
        from sqlalchemy.orm import selectinload

        # Build base query
        query = db.query(Conversation)

        if active_only:
            query = query.filter(Conversation.is_active)

        # Get total count for pagination
        total_count = query.count()

        # Apply pagination and ordering
        conversations = (
            query.options(
                selectinload(Conversation.messages).selectinload(Message.user),
                selectinload(Conversation.assigned_admin),
            )
            .order_by(desc(Conversation.last_message_at))
            .offset(skip)
            .limit(limit)
            .all()
        )

        # Format conversation data
        conversation_list = []
        for conv in conversations:
            last_message = conv.messages[-1] if conv.messages else None
            conversation_data = {
                "conversation_id": conv.conversation_id,
                "session_id": conv.session_id,
                "service_mode": conv.service_mode,
                "status": conv.status,
                "priority": conv.priority,
                "message_count": len(conv.messages),
                "last_message_at": (
                    conv.last_message_at.isoformat() if conv.last_message_at else None
                ),
                "last_message_preview": (
                    last_message.message_content[:100] + "..."
                    if last_message and len(last_message.message_content) > 100
                    else last_message.message_content if last_message else None
                ),
                "assigned_admin": (
                    {
                        "user_id": conv.assigned_admin.user_id,
                        "full_name": conv.assigned_admin.full_name,
                        "email": conv.assigned_admin.email,
                    }
                    if conv.assigned_admin
                    else None
                ),
                "created_at": conv.created_at.isoformat(),
                "updated_at": conv.updated_at.isoformat(),
            }
            conversation_list.append(conversation_data)

        conversations_data = {
            "conversations": conversation_list,
            "pagination": {
                "skip": skip,
                "limit": limit,
                "total": total_count,
                "has_more": skip + limit < total_count,
            },
            "filters_applied": {"active_only": active_only},
        }

        return {
            "success": True,
            "data": conversations_data,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Error getting conversations: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve conversations",
        )


@router.get("/conversations/{conversation_id}")
async def get_conversation_details(
    conversation_id: int, db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """Get conversation details with messages and notes"""
    try:
        conversation = await ConversationCRUD.get_by_id(db, conversation_id)
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found"
            )

        conversation_data = {
            "conversation_id": conversation.conversation_id,
            "is_active": conversation.is_active,
            "user": (
                {
                    "user_id": conversation.user.user_id,
                    "full_name": conversation.user.full_name,
                    "role": (
                        conversation.user.role.role_name
                        if conversation.user.role
                        else None
                    ),
                }
                if conversation.user
                else None
            ),
            "created_at": conversation.created_at.isoformat(),
            "updated_at": conversation.updated_at.isoformat(),
            "messages": [
                {
                    "message_id": msg.message_id,
                    "content": msg.message_content,
                    "is_user": msg.is_user,
                    "created_at": msg.created_at.isoformat(),
                }
                for msg in (conversation.messages or [])
            ],
            "notes": [
                {
                    "note_id": note.note_id,
                    "content": note.note_content,
                    "url_access": note.url_access,
                    "created_at": note.created_at.isoformat(),
                }
                for note in (conversation.notes or [])
            ],
        }

        return {
            "success": True,
            "data": conversation_data,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting conversation {conversation_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve conversation",
        )


# System Management Endpoints


@router.get("/system/health")
async def get_system_health(
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    """Get system health status"""
    try:
        # Check database health
        from app.core.database import db_manager

        db_health = await db_manager.health_check()

        # Check email service

        system_health = {
            "database": db_health,
            "timestamp": datetime.utcnow().isoformat(),
            "overall_status": (
                "healthy" if db_health.get("status") == "healthy" else "degraded"
            ),
        }

        return {
            "success": True,
            "data": system_health,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Error checking system health: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check system health",
        )


@router.get("/system/roles")
async def get_all_roles(db: AsyncSession = Depends(get_db_session)) -> Dict[str, Any]:
    """Get all available roles"""
    try:
        roles = await RoleCRUD.get_all(db)

        roles_data = [
            {"role_id": role.role_id, "role_name": role.role_name} for role in roles
        ]

        return {
            "success": True,
            "data": {"roles": roles_data},
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Error getting roles: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve roles",
        )


@router.get("/system/genders")
async def get_all_genders(db: AsyncSession = Depends(get_db_session)) -> Dict[str, Any]:
    """Get all available genders"""
    try:
        genders = await GenderCRUD.get_all(db)

        genders_data = [
            {"gender_id": gender.gender_id, "gender_name": gender.gender_name}
            for gender in genders
        ]

        return {
            "success": True,
            "data": {"genders": genders_data},
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Error getting genders: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve genders",
        )


# Validation System Endpoints


@router.post("/validation/validate")
async def validate_admin_settings(
    request: Request,
    settings: AdminValidationSettings,
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    """Validate admin settings and return comprehensive results"""
    try:
        validation_service = get_admin_validation_service()

        # Convert settings to dict for validation
        settings_dict = settings.dict()

        # Perform comprehensive validation
        validation_results = await validation_service.validate_admin_request(
            request, "validate_settings", settings_dict
        )

        # Calculate overall score
        (
            overall_score,
            summary,
        ) = await validation_service.calculate_overall_validation_score(
            validation_results
        )

        # Format results for response
        formatted_results = [result.to_dict() for result in validation_results]

        return {
            "success": True,
            "data": {
                "validation_results": formatted_results,
                "overall_score": overall_score,
                "summary": summary,
                "settings_validated": settings_dict,
            },
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Settings validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Validation failed: {str(e)}",
        )


@router.post("/validation/settings")
async def update_validation_settings(
    request: Request,
    settings: AdminValidationSettings,
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    """Update and save admin validation settings"""
    try:
        validation_service = get_admin_validation_service()

        # Validate settings first
        validation_results = await validation_service.validate_admin_request(
            request, "update_settings", settings.dict()
        )

        # Check for critical issues
        await validation_service.enforce_validation_rules(
            validation_results, strict_mode=True
        )

        # Update blocked keywords if provided
        if settings.blocked_keywords:
            await validation_service.update_blocked_keywords(settings.blocked_keywords)

        # Save settings to database using a simple key-value approach
        # Note: In production, you might want a dedicated AppSettings model
        import json

        # Create a settings record in the database
        # For now, we'll use a simple approach by storing in JSON format
        settings_data = {
            "admin_validation_settings": settings.dict(),
            "updated_at": datetime.utcnow().isoformat(),
            "updated_by": "admin_user",  # In production, get from authenticated user
        }

        # Store settings (this could be enhanced with a proper settings model)
        # For now, we'll log the settings update
        import logging

        logger = logging.getLogger(__name__)
        logger.info(
            f"Admin validation settings updated: {json.dumps(settings_data, indent=2)}"
        )

        # In a production system, you would save to database like:
        # await db.execute(
        #     "INSERT INTO app_settings (setting_key, setting_value, updated_at) "
        #     "VALUES ('admin_validation_settings', :settings, :timestamp) "
        #     "ON CONFLICT (setting_key) DO UPDATE SET "
        #     "setting_value = :settings, updated_at = :timestamp",
        #     {"settings": json.dumps(settings.dict()), "timestamp": datetime.utcnow()}
        # )
        # await db.commit()

        (
            overall_score,
            summary,
        ) = await validation_service.calculate_overall_validation_score(
            validation_results
        )

        return {
            "success": True,
            "data": {
                "message": "Validation settings updated successfully",
                "validation_score": overall_score,
                "summary": summary,
                "settings": settings.dict(),
            },
            "timestamp": datetime.utcnow().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update validation settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update settings: {str(e)}",
        )


@router.get("/validation/status")
async def get_validation_status(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """Get current validation system status"""
    try:
        validation_service = get_admin_validation_service()

        # Get current validation status
        status_results = await validation_service.validate_admin_request(
            request, "status_check"
        )

        (
            overall_score,
            summary,
        ) = await validation_service.calculate_overall_validation_score(status_results)

        # Additional system status checks
        system_status = {
            "redis_connected": validation_service.redis_client is not None,
            "validation_cache_size": len(validation_service._validation_cache),
            "blocked_keywords_count": len(validation_service._blocked_keywords),
            "last_update": datetime.utcnow().isoformat(),
        }

        return {
            "success": True,
            "data": {
                "validation_score": overall_score,
                "summary": summary,
                "system_status": system_status,
                "validation_results": [r.to_dict() for r in status_results],
            },
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Failed to get validation status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve validation status",
        )


@router.get("/validation/blocked-keywords")
async def get_blocked_keywords(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """Get current blocked keywords list"""
    try:
        validation_service = get_admin_validation_service()

        keywords_list = list(validation_service._blocked_keywords)

        return {
            "success": True,
            "data": {
                "blocked_keywords": keywords_list,
                "count": len(keywords_list),
                "last_updated": datetime.utcnow().isoformat(),
            },
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Failed to get blocked keywords: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve blocked keywords",
        )


@router.post("/validation/blocked-keywords")
async def update_blocked_keywords(
    request: Request,
    keywords_data: Dict[str, str],
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    """Update blocked keywords list"""
    try:
        validation_service = get_admin_validation_service()

        keywords = keywords_data.get("keywords", "")

        # Update keywords
        await validation_service.update_blocked_keywords(keywords)

        return {
            "success": True,
            "data": {
                "message": "Blocked keywords updated successfully",
                "keywords_count": len(validation_service._blocked_keywords),
                "updated_at": datetime.utcnow().isoformat(),
            },
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Failed to update blocked keywords: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update blocked keywords: {str(e)}",
        )


# DeepEval Monitoring Endpoints (for Grafana integration)


@router.get("/monitoring/llm-quality")
async def get_llm_quality_metrics(
    request: Request,
    period: str = Query("24h", pattern="^(1h|24h|7d|30d)$"),
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    """Get LLM quality metrics for Grafana dashboard"""
    try:
        monitoring_service = get_deepeval_monitoring_service()

        # Get evaluation summary for the specified period
        summary = await monitoring_service.get_evaluation_summary(period)

        # Format metrics for Grafana/Prometheus
        metrics = {
            "period": period,
            "timestamp": datetime.utcnow().isoformat(),
            "overall_metrics": {
                "total_evaluations": summary.get("total_evaluations", 0),
                "average_score": summary.get("overall_average_score", 0.0),
                "pass_rate": summary.get("overall_pass_rate", 0.0),
            },
            "category_metrics": summary.get("category_statistics", {}),
            "performance_metrics": summary.get("performance_metrics", {}),
            "quality_indicators": {
                "excellent_rate": 0.0,
                "good_rate": 0.0,
                "needs_improvement_rate": 0.0,
            },
        }

        # Calculate quality distribution
        category_stats = summary.get("category_statistics", {})
        if category_stats:
            total_categories = len(category_stats)
            excellent_count = sum(
                1
                for stats in category_stats.values()
                if stats.get("average_score", 0) >= 0.9
            )
            good_count = sum(
                1
                for stats in category_stats.values()
                if 0.7 <= stats.get("average_score", 0) < 0.9
            )

            metrics["quality_indicators"] = {
                "excellent_rate": (
                    excellent_count / total_categories if total_categories > 0 else 0.0
                ),
                "good_rate": (
                    good_count / total_categories if total_categories > 0 else 0.0
                ),
                "needs_improvement_rate": (
                    (total_categories - excellent_count - good_count) / total_categories
                    if total_categories > 0
                    else 0.0
                ),
            }

        return {
            "success": True,
            "data": metrics,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Failed to get LLM quality metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve LLM quality metrics",
        )


@router.get("/monitoring/conversation/{conversation_id}")
async def get_conversation_evaluation(
    request: Request, conversation_id: str, db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """Get evaluation results for specific conversation"""
    try:
        monitoring_service = get_deepeval_monitoring_service()

        # Get cached evaluation for conversation
        evaluation_data = await monitoring_service.get_conversation_evaluation(
            conversation_id
        )

        if not evaluation_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Evaluation not found for this conversation",
            )

        return {
            "success": True,
            "data": evaluation_data,
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


@router.post("/monitoring/evaluate")
async def evaluate_conversation(
    request: Request,
    evaluation_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    """Manually trigger evaluation for a conversation"""
    try:
        monitoring_service = get_deepeval_monitoring_service()

        # Extract conversation data
        conversation = LLMConversation(
            conversation_id=evaluation_data.get("conversation_id"),
            user_question=evaluation_data.get("user_question"),
            llm_response=evaluation_data.get("llm_response"),
            context_documents=evaluation_data.get("context_documents", []),
            response_time=evaluation_data.get("response_time", 0.0),
            model_used=evaluation_data.get("model_used", "unknown"),
            confidence_score=evaluation_data.get("confidence_score"),
            session_id=evaluation_data.get("session_id"),
            user_id=evaluation_data.get("user_id"),
        )

        # Perform evaluation
        results = await monitoring_service.evaluate_conversation(conversation)

        return {
            "success": True,
            "data": {
                "conversation_id": conversation.conversation_id,
                "evaluation_results": [result.to_dict() for result in results],
                "evaluated_at": datetime.utcnow().isoformat(),
            },
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Failed to evaluate conversation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Evaluation failed: {str(e)}",
        )


@router.get("/monitoring/quality-report")
async def get_quality_report(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """Get comprehensive quality report for monitoring"""
    try:
        monitoring_service = get_deepeval_monitoring_service()

        # Generate quality report
        report = await monitoring_service.generate_quality_report()

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


@router.get("/monitoring/prometheus-metrics")
async def get_prometheus_metrics(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> str:
    """Get metrics in Prometheus format for Grafana integration"""
    try:
        monitoring_service = get_deepeval_monitoring_service()

        # Get current performance metrics
        performance_metrics = monitoring_service.performance_metrics

        # Generate Prometheus metrics format
        metrics_lines = []
        metrics_lines.append(
            "# HELP tunarasa_llm_quality_score LLM quality scores by category"
        )
        metrics_lines.append("# TYPE tunarasa_llm_quality_score gauge")

        for category, metrics in performance_metrics.items():
            avg_score = metrics.get("average_score", 0.0)
            pass_rate = metrics.get("pass_rate", 0.0)
            total_evals = metrics.get("total_evaluations", 0)

            metrics_lines.append(
                f'tunarasa_llm_quality_score{{category="{category}",metric="average"}} {avg_score}'
            )
            metrics_lines.append(
                f'tunarasa_llm_quality_score{{category="{category}",metric="pass_rate"}} {pass_rate}'
            )
            metrics_lines.append(
                f'tunarasa_llm_evaluations_total{{category="{category}"}} {total_evals}'
            )

        # Add overall system metrics
        metrics_lines.append("# HELP tunarasa_system_status System status indicators")
        metrics_lines.append("# TYPE tunarasa_system_status gauge")
        metrics_lines.append('tunarasa_system_status{component="deepeval_service"} 1')
        metrics_lines.append(
            f'tunarasa_system_status{{component="redis_cache"}} {1 if monitoring_service.redis_client else 0}'
        )

        # Add timestamp
        current_timestamp = int(datetime.utcnow().timestamp() * 1000)
        metrics_lines.append(f"tunarasa_last_update_timestamp {current_timestamp}")

        prometheus_output = "\n".join(metrics_lines)

        return prometheus_output

    except Exception as e:
        logger.error(f"Failed to generate Prometheus metrics: {e}")
        return f"# Error generating metrics: {str(e)}"


@router.get("/monitoring/health")
async def get_monitoring_health(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """Get monitoring system health status"""
    try:
        monitoring_service = get_deepeval_monitoring_service()

        # Check service components
        health_status = {
            "deepeval_service": "healthy",
            "redis_connection": (
                "healthy" if monitoring_service.redis_client else "unhealthy"
            ),
            "metrics_available": len(monitoring_service.performance_metrics) > 0,
            "last_evaluation": None,
        }

        # Get last evaluation timestamp
        if monitoring_service.evaluation_history:
            last_eval = max(
                monitoring_service.evaluation_history, key=lambda x: x.timestamp
            )
            health_status["last_evaluation"] = last_eval.timestamp.isoformat()

        # Overall health
        overall_healthy = all(
            [
                health_status["deepeval_service"] == "healthy",
                health_status["redis_connection"] == "healthy",
                health_status["metrics_available"],
            ]
        )

        return {
            "success": True,
            "data": {
                "overall_status": "healthy" if overall_healthy else "degraded",
                "components": health_status,
                "timestamp": datetime.utcnow().isoformat(),
            },
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Failed to get monitoring health: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check monitoring health",
        )


# LLM Recommendation Endpoints


@router.get("/llm/evaluation-summary")
async def get_llm_evaluation_summary(
    request: Request,
    period: str = Query("24h", description="Time period (1h, 24h, 7d, 30d)"),
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    """Get LLM evaluation summary with recommendations"""
    try:
        # Parse period to hours
        period_map = {"1h": 1, "24h": 24, "7d": 168, "30d": 720}
        hours = period_map.get(period, 24)

        recommendation_service = get_llm_recommendation_service()
        summary = await recommendation_service.get_recommendations_summary(hours)

        return {
            "success": True,
            "data": summary,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Failed to get LLM evaluation summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get evaluation summary: {str(e)}",
        )


@router.get("/llm/quality-report")
async def get_llm_quality_report(
    request: Request, db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """Get comprehensive LLM quality report with recommendations"""
    try:
        recommendation_service = get_llm_recommendation_service()

        # Generate quality report based on recent data
        summary = await recommendation_service.get_recommendations_summary(24)

        # Extract quality report from summary
        quality_report = {
            "report_generated_at": summary.get("generated_at"),
            "overall_quality_score": summary.get("overall_quality_score", 0.0),
            "overall_pass_rate": summary.get("key_metrics", {})
            .get("quality_distribution", {})
            .get("excellent", 0)
            / max(summary.get("total_qa_analyzed", 1), 1),
            "category_quality_scores": {},
            "recommendations": summary.get("recommendations", []),
            "total_categories_evaluated": len(summary.get("recommendations", [])),
        }

        # Add category scores based on recommendations
        for rec in summary.get("recommendations", []):
            category = rec.get("category_affected", "unknown")
            if category not in quality_report["category_quality_scores"]:
                quality_report["category_quality_scores"][category] = {
                    "average_score": rec.get("confidence", 0.5),
                    "pass_rate": 1.0
                    - rec.get("confidence", 0.5),  # Invert confidence for pass rate
                    "quality_level": (
                        "Good"
                        if rec.get("confidence", 0.5) > 0.7
                        else "Needs Improvement"
                    ),
                    "total_evaluations": summary.get("total_qa_analyzed", 0),
                }

        return {
            "success": True,
            "data": quality_report,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Failed to get LLM quality report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get quality report: {str(e)}",
        )


@router.post("/llm/analyze-batch")
async def analyze_llm_batch(
    request: Request,
    qa_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db_session),
) -> Dict[str, Any]:
    """Analyze batch of Q&A data and provide recommendations"""
    try:
        # Extract data from request
        questions = qa_data.get("questions", [])
        answers = qa_data.get("answers", [])
        contexts = qa_data.get("contexts", [])
        confidences = qa_data.get("confidences", [])
        response_times = qa_data.get("response_times", [])
        session_ids = qa_data.get("session_ids", [])

        if not questions or not answers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Questions and answers are required",
            )

        if len(questions) != len(answers):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Number of questions and answers must match",
            )

        # Analyze and get recommendations
        result = await analyze_and_recommend(
            questions=questions,
            answers=answers,
            contexts=contexts,
            confidences=confidences,
            response_times=response_times,
            session_ids=session_ids,
        )

        return {
            "success": True,
            "data": result,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to analyze LLM batch: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze batch: {str(e)}",
        )


@router.get("/llm/recommendations/{recommendation_id}")
async def get_recommendation_details(
    request: Request, recommendation_id: str, db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """Get detailed information about a specific recommendation"""
    try:
        recommendation_service = get_llm_recommendation_service()

        # For now, return cached recommendations
        # In a full implementation, this would fetch by ID from database
        summary = await recommendation_service.get_recommendations_summary(24)
        recommendations = summary.get("recommendations", [])

        # Find recommendation by type (using type as ID for now)
        recommendation = None
        for rec in recommendations:
            if rec.get("type") == recommendation_id:
                recommendation = rec
                break

        if not recommendation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Recommendation not found"
            )

        return {
            "success": True,
            "data": {
                "recommendation": recommendation,
                "related_metrics": summary.get("key_metrics", {}),
                "implementation_guide": {
                    "steps": recommendation.get("suggested_actions", []),
                    "effort": recommendation.get("implementation_effort", "medium"),
                    "expected_impact": recommendation.get("expected_improvement", 0.0),
                },
            },
            "timestamp": datetime.utcnow().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get recommendation details: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get recommendation details: {str(e)}",
        )
