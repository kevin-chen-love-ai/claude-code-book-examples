"""
UsageStat model
"""
from sqlalchemy import Column, String, Integer, BigInteger, DateTime, ForeignKey
from sqlalchemy.sql import func
import uuid
from .base import Base


class UsageStat(Base):
    __tablename__ = "usage_stats"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey('profiles.id', ondelete='CASCADE'), nullable=False, index=True)
    date = Column(DateTime(timezone=True), nullable=False, index=True)
    images_processed = Column(Integer, default=0)
    videos_processed = Column(Integer, default=0)
    storage_used = Column(BigInteger, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

