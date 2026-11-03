"""
Post schemas
"""
from typing import Optional, List
from datetime import datetime
from .base import BaseSchema


class PostCreate(BaseSchema):
    title: str
    slug: Optional[str] = None
    content: str
    excerpt: Optional[str] = None
    tags: Optional[List[str]] = []
    featured_image: Optional[str] = None
    published: bool = False


class PostUpdate(BaseSchema):
    title: Optional[str] = None
    slug: Optional[str] = None
    content: Optional[str] = None
    excerpt: Optional[str] = None
    tags: Optional[List[str]] = None
    featured_image: Optional[str] = None
    published: Optional[bool] = None


class PostResponse(BaseSchema):
    id: str
    title: str
    slug: Optional[str]
    content: str
    excerpt: Optional[str]
    tags: List[str]
    featured_image: Optional[str]
    author_id: str
    author_name: Optional[str]
    published: bool
    created_at: datetime
    updated_at: datetime

