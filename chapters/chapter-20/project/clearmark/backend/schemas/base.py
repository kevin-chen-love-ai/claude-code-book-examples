"""
Base schema definitions
"""
from pydantic import BaseModel


class BaseSchema(BaseModel):
    """Base schema with common configuration"""
    
    class Config:
        from_attributes = True  # Pydantic v2: allow_attributes or from_attributes
        populate_by_name = True

