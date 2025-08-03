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
    title: Optional[str] = Field(
        default=None, description="Title of the note"
    )  # New column title
    url_access: Optional[str] = Field(
        default=None, description="QR code data for accessibility"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "note_id": 1,
                "conversation_id": 1,
                "note_content": "Summary: Learned how to sign letters A, B, C",
                "title": "Sign Language - A, B, C",
                "url_access": "https://example.com/qr/note/1",
            }
        }


class NoteCreate(BaseModel):
    """Schema for creating new note"""

    conversation_id: int
    note_content: str
    title: Optional[str] = None  # Add title for creation
    url_access: Optional[str] = None


class NoteUpdate(BaseModel):
    """Schema for updating note"""

    note_content: Optional[str] = None
    title: Optional[str] = None  # Allow updating the title
    url_access: Optional[str] = None
