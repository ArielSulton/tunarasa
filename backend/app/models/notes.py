"""
Notes model for conversation notes with QR codes
"""

from typing import Optional
from pydantic import BaseModel, Field
from .base import BaseDBModel


class Note(BaseDBModel):
    """Note model for conversation notes"""
    
    note_id: int = Field(description="Unique note identifier (serial primary key)")
    conversation_id: int = Field(description="Foreign key to conversations table")
    note_content: str = Field(description="Note content")
    qr_code_data: Optional[str] = Field(default=None, description="QR code data for accessibility")
    
    class Config:
        json_schema_extra = {
            "example": {
                "note_id": 1,
                "conversation_id": 1,
                "note_content": "Summary: Learned how to sign letters A, B, C",
                "qr_code_data": "https://example.com/qr/note/1"
            }
        }


class NoteCreate(BaseModel):
    """Schema for creating new note"""
    
    conversation_id: int
    note_content: str
    qr_code_data: Optional[str] = None


class NoteUpdate(BaseModel):
    """Schema for updating note"""
    
    note_content: Optional[str] = None
    qr_code_data: Optional[str] = None