"""
Messages model for individual chat messages
"""

from typing import Optional
from pydantic import BaseModel, Field
from .base import BaseDBModel


class Message(BaseDBModel):
    """Message model for individual chat messages"""
    
    message_id: int = Field(description="Unique message identifier (serial primary key)")
    conversation_id: int = Field(description="Foreign key to conversations table")
    sender_type: str = Field(max_length=50, description="Message sender type (user/ai)")
    content: str = Field(description="Message content")
    gesture_data: Optional[str] = Field(default=None, description="JSON gesture data if from gesture")
    
    class Config:
        json_schema_extra = {
            "example": {
                "message_id": 1,
                "conversation_id": 1,
                "sender_type": "user",
                "content": "How do I sign the letter A?",
                "gesture_data": None
            }
        }


class MessageCreate(BaseModel):
    """Schema for creating new message"""
    
    conversation_id: int
    sender_type: str = Field(max_length=50)
    content: str
    gesture_data: Optional[str] = None


class MessageUpdate(BaseModel):
    """Schema for updating message"""
    
    content: Optional[str] = None
    gesture_data: Optional[str] = None