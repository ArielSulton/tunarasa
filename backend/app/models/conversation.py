"""
Conversation model matching the new 6-table schema
"""

from typing import Optional
from pydantic import BaseModel, Field
from .base import BaseDBModel


class Conversation(BaseDBModel):
    """Conversation model for chat sessions"""
    
    conversation_id: int = Field(description="Unique conversation identifier (serial primary key)")
    user_id: int = Field(description="Foreign key to users table")
    title: Optional[str] = Field(default=None, max_length=255, description="Conversation title")
    
    class Config:
        json_schema_extra = {
            "example": {
                "conversation_id": 1,
                "user_id": 1,
                "title": "ASL Learning Session"
            }
        }


class ConversationCreate(BaseModel):
    """Schema for creating new conversation"""
    
    user_id: int
    title: Optional[str] = Field(default=None, max_length=255)


class ConversationUpdate(BaseModel):
    """Schema for updating conversation"""
    
    title: Optional[str] = Field(default=None, max_length=255)