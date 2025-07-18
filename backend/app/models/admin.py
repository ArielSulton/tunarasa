"""
Admin model for system administration
"""

from datetime import datetime
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field, EmailStr
from .base import BaseDBModel


class Admin(BaseDBModel):
    """Admin user model"""
    
    admin_id: str = Field(description="Unique admin identifier")
    email: EmailStr = Field(description="Admin email address")
    full_name: str = Field(min_length=1, max_length=100, description="Admin full name")
    
    # Authentication
    clerk_user_id: Optional[str] = Field(default=None, description="Clerk user ID")
    role: str = Field(default="admin", description="Admin role")
    permissions: List[str] = Field(default_factory=list, description="Admin permissions")
    
    # Status
    is_active: bool = Field(default=True, description="Admin account status")
    last_login: Optional[datetime] = Field(default=None, description="Last login timestamp")
    
    # Invitation
    invited_by: Optional[str] = Field(default=None, description="ID of admin who sent invitation")
    invitation_token: Optional[str] = Field(default=None, description="Invitation token")
    invitation_expires: Optional[datetime] = Field(default=None, description="Invitation expiration")
    invitation_accepted: bool = Field(default=False, description="Invitation acceptance status")
    
    class Config:
        schema_extra = {
            "example": {
                "admin_id": "admin_123456789",
                "email": "admin@tunarasa.com",
                "full_name": "John Doe",
                "role": "admin",
                "permissions": ["read", "write", "admin"],
                "is_active": True,
                "invitation_accepted": True
            }
        }


class AdminCreate(BaseModel):
    """Schema for creating new admin"""
    
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=100)
    role: str = "admin"
    permissions: List[str] = Field(default_factory=lambda: ["read", "write"])


class AdminUpdate(BaseModel):
    """Schema for updating admin"""
    
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    role: Optional[str] = None
    permissions: Optional[List[str]] = None
    is_active: Optional[bool] = None


class AdminInvitation(BaseModel):
    """Schema for admin invitation"""
    
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=100)
    role: str = "admin"
    permissions: List[str] = Field(default_factory=lambda: ["read", "write"])
    invitation_message: Optional[str] = Field(default=None, max_length=500)


class AdminStats(BaseModel):
    """Admin statistics model"""
    
    total_sessions: int = Field(description="Total number of sessions")
    total_conversations: int = Field(description="Total number of conversations")
    total_gestures: int = Field(description="Total number of gestures")
    active_sessions: int = Field(description="Number of active sessions")
    
    # Performance metrics
    avg_response_time: float = Field(description="Average response time")
    avg_gesture_accuracy: float = Field(description="Average gesture accuracy")
    
    # System health
    system_health: Dict[str, Any] = Field(description="System health status")
    
    class Config:
        schema_extra = {
            "example": {
                "total_sessions": 1250,
                "total_conversations": 5430,
                "total_gestures": 12500,
                "active_sessions": 45,
                "avg_response_time": 0.85,
                "avg_gesture_accuracy": 0.92,
                "system_health": {
                    "database": "healthy",
                    "redis": "healthy",
                    "external_services": "healthy"
                }
            }
        }