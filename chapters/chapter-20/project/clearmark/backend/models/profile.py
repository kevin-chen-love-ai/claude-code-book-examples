"""
Profile model
"""
from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from .base import Base


class Profile(Base):
    __tablename__ = "profiles"

    # Supabase profiles table structure:
    # - id: UUID (references auth.users.id)
    # - full_name: TEXT
    # - avatar_url: TEXT
    # - is_admin: BOOLEAN
    # - created_at: TIMESTAMP WITH TIME ZONE
    # - updated_at: TIMESTAMP WITH TIME ZONE
    
    id = Column(UUID(as_uuid=False), primary_key=True)  # UUID as string
    full_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    is_admin = Column(Boolean, default=False, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

