"""
Admin API endpoints for dashboard and user management
Requires Clerk JWT authentication with admin role
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.db.crud import UserCRUD, ConversationCRUD, MessageCRUD, NoteCRUD, StatsCRUD, RoleCRUD, GenderCRUD
from app.db.models import User, Conversation, Message, Note, Role, Gender
from app.models.user import UserCreate, UserUpdate
from app.models.conversation import ConversationCreate, ConversationUpdate
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


# Admin Dashboard Endpoints

@router.get("/dashboard/stats")
async def get_dashboard_stats(
    request: Request,
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """Get comprehensive dashboard statistics"""
    try:
        # Get basic stats
        stats = await StatsCRUD.get_dashboard_stats(db)
        
        # Add current admin user info
        admin_user = getattr(request.state, 'user', None)
        if admin_user:
            stats["current_admin"] = {
                "id": admin_user.get("id"),
                "email": admin_user.get("email"),
                "name": admin_user.get("full_name")
            }
        
        # Add timestamp
        stats["last_updated"] = datetime.utcnow().isoformat()
        
        return {
            "success": True,
            "data": stats,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting dashboard stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve dashboard statistics"
        )


@router.get("/dashboard/metrics")
async def get_dashboard_metrics(
    request: Request,
    period: str = Query("week", regex="^(day|week|month|year)$"),
    db: AsyncSession = Depends(get_db_session)
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
        
        # Get basic stats for the period
        base_stats = await StatsCRUD.get_dashboard_stats(db)
        
        # TODO: Add time-based filtering to CRUD operations
        # For now, return basic stats with period info
        metrics = {
            "period": period,
            "start_date": start_date.isoformat(),
            "end_date": now.isoformat(),
            "stats": base_stats,
            "growth_rate": 0.0,  # TODO: Calculate actual growth
            "engagement_rate": 0.85  # TODO: Calculate actual engagement
        }
        
        return {
            "success": True,
            "data": metrics,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting dashboard metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve dashboard metrics"
        )


# User Management Endpoints

@router.get("/users")
async def get_all_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """Get all users with pagination"""
    try:
        users = await UserCRUD.get_all(db, skip=skip, limit=limit)
        
        # Convert to dict format
        users_data = []
        for user in users:
            user_dict = {
                "user_id": user.user_id,
                "clerk_user_id": user.clerk_user_id,
                "full_name": user.full_name,
                "role": user.role.role_name if user.role else None,
                "gender": user.gender.gender_name if user.gender else None,
                "created_at": user.created_at.isoformat(),
                "updated_at": user.updated_at.isoformat(),
                "conversation_count": len(user.conversations) if user.conversations else 0
            }
            users_data.append(user_dict)
        
        return {
            "success": True,
            "data": {
                "users": users_data,
                "pagination": {
                    "skip": skip,
                    "limit": limit,
                    "total": len(users_data)
                }
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve users"
        )


@router.get("/users/{user_id}")
async def get_user_by_id(
    user_id: int,
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """Get user by ID with full details"""
    try:
        user = await UserCRUD.get_by_id(db, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Get user conversations
        conversations = await ConversationCRUD.get_by_user(db, user_id, active_only=False)
        
        user_data = {
            "user_id": user.user_id,
            "clerk_user_id": user.clerk_user_id,
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
                    "message_count": len(conv.messages) if conv.messages else 0
                }
                for conv in conversations
            ]
        }
        
        return {
            "success": True,
            "data": user_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user"
        )


@router.put("/users/{user_id}")
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """Update user information"""
    try:
        # Check if user exists
        existing_user = await UserCRUD.get_by_id(db, user_id)
        if not existing_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Update user
        updated_user = await UserCRUD.update(db, user_id, **user_update.dict(exclude_unset=True))
        
        if not updated_user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update user"
            )
        
        user_data = {
            "user_id": updated_user.user_id,
            "clerk_user_id": updated_user.clerk_user_id,
            "full_name": updated_user.full_name,
            "role": updated_user.role.role_name if updated_user.role else None,
            "gender": updated_user.gender.gender_name if updated_user.gender else None,
            "updated_at": updated_user.updated_at.isoformat()
        }
        
        return {
            "success": True,
            "data": user_data,
            "message": "User updated successfully",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user"
        )


# Conversation Management Endpoints

@router.get("/conversations")
async def get_all_conversations(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """Get all conversations with pagination"""
    try:
        # TODO: Implement conversation listing with filtering
        # For now, return basic structure
        conversations_data = {
            "conversations": [],
            "pagination": {
                "skip": skip,
                "limit": limit,
                "total": 0
            }
        }
        
        return {
            "success": True,
            "data": conversations_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting conversations: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve conversations"
        )


@router.get("/conversations/{conversation_id}")
async def get_conversation_details(
    conversation_id: int,
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """Get conversation details with messages and notes"""
    try:
        conversation = await ConversationCRUD.get_by_id(db, conversation_id)
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )
        
        conversation_data = {
            "conversation_id": conversation.conversation_id,
            "is_active": conversation.is_active,
            "user": {
                "user_id": conversation.user.user_id,
                "full_name": conversation.user.full_name,
                "role": conversation.user.role.role_name if conversation.user.role else None
            } if conversation.user else None,
            "created_at": conversation.created_at.isoformat(),
            "updated_at": conversation.updated_at.isoformat(),
            "messages": [
                {
                    "message_id": msg.message_id,
                    "content": msg.message_content,
                    "is_user": msg.is_user,
                    "created_at": msg.created_at.isoformat()
                }
                for msg in (conversation.messages or [])
            ],
            "notes": [
                {
                    "note_id": note.note_id,
                    "content": note.note_content,
                    "url_access": note.url_access,
                    "created_at": note.created_at.isoformat()
                }
                for note in (conversation.notes or [])
            ]
        }
        
        return {
            "success": True,
            "data": conversation_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting conversation {conversation_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve conversation"
        )


# System Management Endpoints

@router.get("/system/health")
async def get_system_health(
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """Get system health status"""
    try:
        # Check database health
        from app.core.database import db_manager
        db_health = await db_manager.health_check()
        
        # Check email service
        email_service = EmailService()
        email_health = await email_service.health_check()
        
        system_health = {
            "database": db_health,
            "email_service": email_health,
            "timestamp": datetime.utcnow().isoformat(),
            "overall_status": "healthy" if db_health.get("status") == "healthy" else "degraded"
        }
        
        return {
            "success": True,
            "data": system_health,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error checking system health: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check system health"
        )


@router.get("/system/roles")
async def get_all_roles(
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """Get all available roles"""
    try:
        roles = await RoleCRUD.get_all(db)
        
        roles_data = [
            {
                "role_id": role.role_id,
                "role_name": role.role_name
            }
            for role in roles
        ]
        
        return {
            "success": True,
            "data": {"roles": roles_data},
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting roles: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve roles"
        )


@router.get("/system/genders")
async def get_all_genders(
    db: AsyncSession = Depends(get_db_session)
) -> Dict[str, Any]:
    """Get all available genders"""
    try:
        genders = await GenderCRUD.get_all(db)
        
        genders_data = [
            {
                "gender_id": gender.gender_id,
                "gender_name": gender.gender_name
            }
            for gender in genders
        ]
        
        return {
            "success": True,
            "data": {"genders": genders_data},
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting genders: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve genders"
        )