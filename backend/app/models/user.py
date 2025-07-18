"""
User model for basic user tracking
"""

from datetime import datetime
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from .base import BaseDBModel


class User(BaseDBModel):
    """Basic user model for session tracking"""
    
    user_id: str = Field(description="Unique user identifier")
    session_id: str = Field(description="Current session ID")
    
    # User preferences
    language: str = Field(default="en", description="User language preference")
    accessibility_features: Dict[str, Any] = Field(default_factory=dict)
    preferences: Dict[str, Any] = Field(default_factory=dict)
    
    # Usage statistics
    total_sessions: int = Field(default=0, description="Total number of sessions")
    total_conversations: int = Field(default=0, description="Total conversations")
    total_gestures: int = Field(default=0, description="Total gestures")
    
    # Activity tracking
    first_visit: datetime = Field(default_factory=datetime.utcnow)
    last_visit: Optional[datetime] = Field(default=None)
    
    class Config:
        schema_extra = {
            "example": {
                "user_id": "user_123456789",
                "session_id": "550e8400-e29b-41d4-a716-446655440000",
                "language": "en",
                "accessibility_features": {
                    "high_contrast": True,
                    "screen_reader": False,
                    "large_text": True
                },
                "total_sessions": 5,
                "total_conversations": 25,
                "total_gestures": 100
            }
        }


class UserCreate(BaseModel):
    """Schema for creating user record"""
    
    session_id: str
    language: str = "en"
    accessibility_features: Dict[str, Any] = Field(default_factory=dict)
    preferences: Dict[str, Any] = Field(default_factory=dict)


class UserUpdate(BaseModel):
    """Schema for updating user"""
    
    language: Optional[str] = None
    accessibility_features: Optional[Dict[str, Any]] = None
    preferences: Optional[Dict[str, Any]] = None
    total_sessions: Optional[int] = None
    total_conversations: Optional[int] = None
    total_gestures: Optional[int] = None
    last_visit: Optional[datetime] = None