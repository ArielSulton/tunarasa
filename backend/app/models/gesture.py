"""
Gesture recognition model for A-Z hand signs
"""

from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from .base import BaseDBModel


class GestureData(BaseDBModel):
    """Gesture recognition data model"""
    
    gesture_id: str = Field(description="Unique gesture identifier")
    session_id: str = Field(description="Associated session ID")
    
    # Hand landmark data
    hand_landmarks: List[List[float]] = Field(description="MediaPipe hand landmarks")
    detected_letter: str = Field(min_length=1, max_length=1, description="Detected A-Z letter")
    
    # Recognition metadata
    confidence: float = Field(ge=0.0, le=1.0, description="Recognition confidence")
    processing_time: float = Field(ge=0.0, description="Processing time in seconds")
    alternative_predictions: List[Dict[str, float]] = Field(default_factory=list)
    
    # Context
    context: Optional[Dict[str, Any]] = Field(default=None, description="Additional context")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Quality metrics
    user_correction: Optional[str] = Field(default=None, description="User correction if any")
    accuracy_validated: bool = Field(default=False, description="Whether accuracy was validated")
    
    class Config:
        schema_extra = {
            "example": {
                "gesture_id": "gesture_123456789",
                "session_id": "550e8400-e29b-41d4-a716-446655440000",
                "hand_landmarks": [[0.1, 0.2], [0.3, 0.4]],
                "detected_letter": "A",
                "confidence": 0.92,
                "processing_time": 0.15,
                "alternative_predictions": [
                    {"letter": "B", "confidence": 0.7},
                    {"letter": "C", "confidence": 0.5}
                ],
                "accuracy_validated": True
            }
        }


class GestureSequence(BaseDBModel):
    """Gesture sequence model for words"""
    
    sequence_id: str = Field(description="Unique sequence identifier")
    session_id: str = Field(description="Associated session ID")
    
    # Sequence data
    individual_gestures: List[str] = Field(description="List of gesture IDs")
    detected_word: str = Field(description="Detected word from sequence")
    individual_letters: List[str] = Field(description="Individual letters in sequence")
    
    # Processing metadata
    confidence: float = Field(ge=0.0, le=1.0, description="Sequence confidence")
    processing_time: float = Field(ge=0.0, description="Processing time in seconds")
    
    # Quality metrics
    user_correction: Optional[str] = Field(default=None, description="User correction")
    accuracy_validated: bool = Field(default=False, description="Whether accuracy was validated")
    
    class Config:
        schema_extra = {
            "example": {
                "sequence_id": "seq_123456789",
                "session_id": "550e8400-e29b-41d4-a716-446655440000",
                "individual_gestures": ["gesture_1", "gesture_2", "gesture_3"],
                "detected_word": "ASL",
                "individual_letters": ["A", "S", "L"],
                "confidence": 0.88,
                "processing_time": 0.45,
                "accuracy_validated": True
            }
        }


class GestureCreate(BaseModel):
    """Schema for creating new gesture record"""
    
    session_id: str
    hand_landmarks: List[List[float]]
    confidence_threshold: float = Field(default=0.7, ge=0.0, le=1.0)
    context: Optional[Dict[str, Any]] = None


class GestureSequenceCreate(BaseModel):
    """Schema for creating gesture sequence"""
    
    session_id: str
    gesture_sequence: List[str]
    timeout_seconds: int = Field(default=5, ge=1, le=30)


class GestureResponse(BaseModel):
    """Schema for gesture API response"""
    
    detected_letter: str
    confidence: float
    processing_time: float
    alternative_predictions: List[Dict[str, float]]
    timestamp: datetime