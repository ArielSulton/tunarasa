"""
Messages model for individual chat messages
"""

from typing import Optional

from pydantic import BaseModel, Field

from .base import BaseDBModel


class Message(BaseDBModel):
    """Message model for individual chat messages"""

    message_id: int = Field(
        description="Unique message identifier (serial primary key)"
    )
    conversation_id: int = Field(description="Foreign key to conversations table")
    message_content: str = Field(description="Message content")
    is_user: bool = Field(
        default=False, description="True if message is from user, False if from AI"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "message_id": 1,
                "conversation_id": 1,
                "message_content": "How do I sign the letter A?",
                "is_user": True,
            }
        }


class MessageCreate(BaseModel):
    """Schema for creating new message"""

    conversation_id: int
    message_content: str
    is_user: bool = False


class MessageUpdate(BaseModel):
    """Schema for updating message"""

    message_content: Optional[str] = None
    is_user: Optional[bool] = None
