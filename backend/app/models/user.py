"""
User model matching the new 6-table schema
"""

from typing import Optional

from pydantic import BaseModel, Field

from .base import BaseDBModel


class User(BaseDBModel):
    """User model matching new schema structure"""

    user_id: int = Field(description="Unique user identifier (serial primary key)")
    supabase_user_id: Optional[str] = Field(
        default=None, description="Supabase user ID for authenticated users"
    )
    full_name: Optional[str] = Field(
        default=None, max_length=255, description="User full name"
    )
    role_id: int = Field(description="Foreign key to roles table")

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": 1,
                "supabase_user_id": "123e4567-e89b-12d3-a456-426614174000",
                "full_name": "John Doe",
                "role_id": 1,
            }
        }


class UserCreate(BaseModel):
    """Schema for creating user record"""

    supabase_user_id: Optional[str] = None
    full_name: Optional[str] = Field(default=None, max_length=255)
    role_id: int


class UserUpdate(BaseModel):
    """Schema for updating user"""

    supabase_user_id: Optional[str] = None
    full_name: Optional[str] = Field(default=None, max_length=255)
    role_id: Optional[int] = None
