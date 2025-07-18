"""
Conversation model for Q&A interactions
"""

from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from .base import BaseDBModel


class Conversation(BaseDBModel):
    """Conversation model for user Q&A"""
    
    conversation_id: str = Field(description="Unique conversation identifier")
    session_id: str = Field(description="Associated session ID")
    
    # Question and answer
    question: str = Field(min_length=1, max_length=500, description="User question")
    answer: str = Field(description="AI-generated answer")
    
    # Processing metadata
    confidence: float = Field(ge=0.0, le=1.0, description="Answer confidence score")
    processing_time: float = Field(ge=0.0, description="Processing time in seconds")
    sources: List[str] = Field(default_factory=list, description="Source documents")
    
    # Context
    context: Optional[Dict[str, Any]] = Field(default=None, description="Additional context")
    language: str = Field(default="en", description="Language of interaction")
    
    # Quality metrics
    user_feedback: Optional[str] = Field(default=None, description="User feedback")
    rating: Optional[int] = Field(default=None, ge=1, le=5, description="User rating")
    
    class Config:
        schema_extra = {
            "example": {
                "conversation_id": "conv_123456789",
                "session_id": "550e8400-e29b-41d4-a716-446655440000",
                "question": "How do I sign the letter A?",
                "answer": "To sign the letter A, make a fist with your dominant hand and place your thumb against the side of your index finger.",
                "confidence": 0.95,
                "processing_time": 1.2,
                "sources": ["ASL Dictionary", "Sign Language Guide"],
                "language": "en",
                "rating": 5
            }
        }


class ConversationCreate(BaseModel):
    """Schema for creating new conversation"""
    
    session_id: str
    question: str = Field(min_length=1, max_length=500)
    context: Optional[Dict[str, Any]] = None
    language: str = "en"


class ConversationUpdate(BaseModel):
    """Schema for updating conversation"""
    
    user_feedback: Optional[str] = None
    rating: Optional[int] = Field(default=None, ge=1, le=5)


class ConversationResponse(BaseModel):
    """Schema for conversation API response"""
    
    conversation_id: str
    answer: str
    confidence: float
    processing_time: float
    sources: List[str]
    timestamp: datetime