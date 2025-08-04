"""
User model matching the new 6-table schema
"""

from typing import Optional

from pydantic import BaseModel, Field

from .base import BaseDBModel


class User(BaseDBModel):
    """User model matching new schema structure"""

    user_id: int = Field(description="Unique user identifier (serial primary key)")
    clerk_user_id: Optional[int] = Field(
        default=None, description="Clerk user ID for admin users"
    )
    full_name: Optional[str] = Field(
        default=None, max_length=255, description="User full name"
    )
    role_id: int = Field(description="Foreign key to roles table")
    gender_id: int = Field(description="Foreign key to genders table")

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": 1,
                "clerk_user_id": 12345,
                "full_name": "John Doe",
                "role_id": 1,
                "gender_id": 1,
            }
        }


class UserCreate(BaseModel):
    """Schema for creating user record"""

    clerk_user_id: Optional[int] = None
    full_name: Optional[str] = Field(default=None, max_length=255)
    role_id: int
    gender_id: int


class UserUpdate(BaseModel):
    """Schema for updating user"""

    clerk_user_id: Optional[int] = None
    full_name: Optional[str] = Field(default=None, max_length=255)
    role_id: Optional[int] = None
    gender_id: Optional[int] = None
