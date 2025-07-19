"""
Conversation model matching the new 6-table schema
"""

from typing import Optional
from pydantic import BaseModel, Field
from .base import BaseDBModel


class Conversation(BaseDBModel):
    """Conversation model for chat sessions"""
    
    conversation_id: int = Field(description="Unique conversation identifier (serial primary key)")
    is_active: bool = Field(default=True, description="Whether conversation is active")
    user_id: int = Field(description="Foreign key to users table")
    
    class Config:
        json_schema_extra = {
            "example": {
                "conversation_id": 1,
                "is_active": True,
                "user_id": 1
            }
        }


class ConversationCreate(BaseModel):
    """Schema for creating new conversation"""
    
    user_id: int
    is_active: bool = True


class ConversationUpdate(BaseModel):
    """Schema for updating conversation"""
    
    is_active: Optional[bool] = None