"""
User session model for tracking user interactions
"""

from datetime import datetime
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from .base import BaseDBModel


class UserSession(BaseDBModel):
    """User session model"""
    
    session_id: str = Field(description="Unique session identifier")
    client_ip: str = Field(description="Client IP address")
    user_agent: Optional[str] = Field(default=None, description="User agent string")
    platform: Optional[str] = Field(default=None, description="Platform/device type")
    language: str = Field(default="en", description="User language preference")
    
    # Session status
    status: str = Field(default="active", description="Session status")
    last_activity: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime = Field(description="Session expiration time")
    
    # Accessibility features
    accessibility_features: Dict[str, Any] = Field(default_factory=dict)
    preferences: Dict[str, Any] = Field(default_factory=dict)
    
    # Usage statistics
    conversation_count: int = Field(default=0, description="Number of conversations")
    gesture_count: int = Field(default=0, description="Number of gestures processed")
    total_processing_time: float = Field(default=0.0, description="Total processing time")
    
    class Config:
        schema_extra = {
            "example": {
                "session_id": "550e8400-e29b-41d4-a716-446655440000",
                "client_ip": "192.168.1.100",
                "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "platform": "web",
                "language": "en",
                "status": "active",
                "accessibility_features": {
                    "high_contrast": True,
                    "screen_reader": False,
                    "large_text": True
                },
                "conversation_count": 5,
                "gesture_count": 25
            }
        }


class SessionCreate(BaseModel):
    """Schema for creating new session"""
    
    user_agent: Optional[str] = None
    platform: Optional[str] = None
    language: str = "en"
    accessibility_features: Dict[str, Any] = Field(default_factory=dict)


class SessionUpdate(BaseModel):
    """Schema for updating session"""
    
    last_activity: Optional[datetime] = None
    accessibility_features: Optional[Dict[str, Any]] = None
    preferences: Optional[Dict[str, Any]] = None
    conversation_count: Optional[int] = None
    gesture_count: Optional[int] = None
    total_processing_time: Optional[float] = None