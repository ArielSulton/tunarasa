"""
Base model class with common fields
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
import uuid


class BaseDBModel(BaseModel):
    """Base model with common database fields"""
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
        use_enum_values = True
        
    def dict(self, **kwargs):
        """Override dict to handle datetime serialization"""
        d = super().dict(**kwargs)
        
        # Convert datetime objects to ISO string
        for key, value in d.items():
            if isinstance(value, datetime):
                d[key] = value.isoformat()
        
        return d