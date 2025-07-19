"""
Gender model for user profile management
"""

from typing import Optional
from pydantic import BaseModel, Field
from .base import BaseDBModel


class Gender(BaseDBModel):
    """Gender model for user profile"""
    
    gender_id: int = Field(description="Unique gender identifier")
    gender_name: str = Field(max_length=50, description="Gender name")
    
    class Config:
        json_schema_extra = {
            "example": {
                "gender_id": 1,
                "gender_name": "male"
            }
        }


class GenderCreate(BaseModel):
    """Schema for creating new gender"""
    
    gender_name: str = Field(max_length=50)


class GenderUpdate(BaseModel):
    """Schema for updating gender"""
    
    gender_name: Optional[str] = Field(default=None, max_length=50)