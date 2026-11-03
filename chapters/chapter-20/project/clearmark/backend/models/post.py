"""
Post model
"""
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, ARRAY
from sqlalchemy.sql import func
import uuid
from .base import Base


class Post(Base):
    __tablename__ = "posts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True)
    content = Column(Text, nullable=False)
    excerpt = Column(Text)
    tags = Column(ARRAY(String), default=list)
    featured_image = Column(String)
    author_id = Column(String(36), ForeignKey('profiles.id', ondelete='CASCADE'), nullable=False, index=True)
    published = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

