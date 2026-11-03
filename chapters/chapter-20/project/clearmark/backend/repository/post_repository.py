"""
Post repository - Data Access Object for Post model
"""
import uuid
from typing import List, Optional
from sqlalchemy.orm import Session

from models.post import Post


class PostRepository:
    """Data access layer for Post"""
    
    @staticmethod
    def find_all(
        db: Session, 
        published_only: bool = False,
        skip: int = 0,
        limit: int = 100
    ) -> List[Post]:
        """Find all posts"""
        query = db.query(Post)
        if published_only:
            query = query.filter(Post.published == True)
        return query.order_by(Post.created_at.desc()).offset(skip).limit(limit).all()
    
    @staticmethod
    def find_by_id(db: Session, post_id: str) -> Optional[Post]:
        """Find post by ID"""
        try:
            post_uuid = uuid.UUID(post_id)
            return db.query(Post).filter(Post.id == post_uuid).first()
        except ValueError:
            return None
    
    @staticmethod
    def find_by_author(db: Session, author_id: str) -> List[Post]:
        """Find posts by author ID"""
        try:
            author_uuid = uuid.UUID(author_id)
            return db.query(Post).filter(Post.author_id == author_uuid).all()
        except ValueError:
            return []
    
    @staticmethod
    def create(db: Session, post: Post) -> Post:
        """Create a new post"""
        db.add(post)
        db.commit()
        db.refresh(post)
        return post
    
    @staticmethod
    def update(db: Session, post: Post) -> Post:
        """Update an existing post"""
        db.commit()
        db.refresh(post)
        return post
    
    @staticmethod
    def delete(db: Session, post: Post) -> None:
        """Delete a post"""
        db.delete(post)
        db.commit()

