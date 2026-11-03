"""
Task model
"""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.types import JSON
from sqlalchemy.sql import func
import uuid
from .base import Base


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey('profiles.id', ondelete='SET NULL'), index=True)
    task_type = Column(String, nullable=False)
    status = Column(String, nullable=False, default='pending', index=True)
    original_file_url = Column(String)
    processed_file_url = Column(String)
    thumbnail_url = Column(String)
    task_metadata = Column(JSON)
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

