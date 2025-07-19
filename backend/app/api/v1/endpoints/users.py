"""
User management endpoints for new schema
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.models import User, UserCreate, UserUpdate
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


class UserService:
    """User service for database operations"""
    
    async def create_user(self, user_data: UserCreate) -> User:
        """Create new user"""
        try:
            # In a real implementation, this would insert into database
            # For now, return mock user data
            user = User(
                user_id=1,
                clerk_user_id=user_data.clerk_user_id,
                full_name=user_data.full_name,
                role_id=user_data.role_id,
                gender_id=user_data.gender_id
            )
            return user
        except Exception as e:
            logger.error(f"Failed to create user: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user"
            )
    
    async def get_user(self, user_id: int) -> User:
        """Get user by ID"""
        try:
            # Mock user data - in real implementation, query database
            user = User(
                user_id=user_id,
                clerk_user_id=12345,
                full_name="John Doe",
                role_id=1,
                gender_id=1
            )
            return user
        except Exception as e:
            logger.error(f"Failed to get user {user_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
    
    async def update_user(self, user_id: int, user_data: UserUpdate) -> User:
        """Update user"""
        try:
            # Mock implementation - in real app, update database
            user = await self.get_user(user_id)
            
            if user_data.clerk_user_id is not None:
                user.clerk_user_id = user_data.clerk_user_id
            if user_data.full_name is not None:
                user.full_name = user_data.full_name
            if user_data.role_id is not None:
                user.role_id = user_data.role_id
            if user_data.gender_id is not None:
                user.gender_id = user_data.gender_id
            
            return user
        except Exception as e:
            logger.error(f"Failed to update user {user_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update user"
            )


# Initialize user service
user_service = UserService()


@router.post("/", response_model=User, status_code=status.HTTP_201_CREATED)
async def create_user(user_data: UserCreate):
    """Create new user"""
    return await user_service.create_user(user_data)


@router.get("/{user_id}", response_model=User)
async def get_user(user_id: int):
    """Get user by ID"""
    return await user_service.get_user(user_id)


@router.put("/{user_id}", response_model=User)
async def update_user(user_id: int, user_data: UserUpdate):
    """Update user"""
    return await user_service.update_user(user_id, user_data)