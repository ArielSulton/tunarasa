"""
Role model for user role management
"""

from typing import Optional
from pydantic import BaseModel, Field
from .base import BaseDBModel


class Role(BaseDBModel):
    """Role model for user types"""
    
    role_id: int = Field(description="Unique role identifier")
    role_name: str = Field(max_length=50, description="Role name")
    description: Optional[str] = Field(default=None, max_length=255, description="Role description")
    
    class Config:
        json_schema_extra = {
            "example": {
                "role_id": 1,
                "role_name": "admin",
                "description": "System administrator with full access"
            }
        }


class RoleCreate(BaseModel):
    """Schema for creating new role"""
    
    role_name: str = Field(max_length=50)
    description: Optional[str] = Field(default=None, max_length=255)


class RoleUpdate(BaseModel):
    """Schema for updating role"""
    
    role_name: Optional[str] = Field(default=None, max_length=50)
    description: Optional[str] = Field(default=None, max_length=255)