"""
Post service - business logic for blog posts
"""
import uuid
from typing import List, Optional
from sqlalchemy.orm import Session

from repository.post_repository import PostRepository
from repository.profile_repository import ProfileRepository
from models.post import Post
from models.profile import Profile
from schemas.post import PostCreate, PostUpdate, PostResponse
from utils.exceptions import NotFoundError, PermissionDeniedError


class PostService:
    """Post business logic"""
    
    @staticmethod
    def get_all_posts(db: Session, published_only: bool = True, author_id: Optional[str] = None) -> List[PostResponse]:
        """Get all posts"""
        query = db.query(Post)
        if published_only:
            query = query.filter(Post.published == True)
        
        # Filter by author if provided
        if author_id:
            try:
                # Validate UUID format but compare as string
                uuid.UUID(author_id)  # Validate format
                query = query.filter(Post.author_id == author_id)  # Compare as string
            except ValueError:
                # Invalid UUID, return empty list
                return []
        
        posts = query.order_by(Post.created_at.desc()).all()
        
        result = []
        for post in posts:
            # Get author name
            author = db.query(Profile).filter(Profile.id == post.author_id).first()
            
            result.append(PostResponse(
                id=str(post.id),
                title=post.title,
                slug=getattr(post, 'slug', None),
                content=post.content,
                excerpt=post.excerpt,
                tags=post.tags or [],
                featured_image=post.featured_image,
                author_id=str(post.author_id),
                author_name=author.full_name if author else None,
                published=post.published,
                created_at=post.created_at,
                updated_at=post.updated_at
            ))
        
        return result
    
    @staticmethod
    def get_post_by_id(post_id: str, db: Session) -> PostResponse:
        """Get single post by ID"""
        try:
            uuid.UUID(post_id)  # Validate format
        except ValueError:
            raise NotFoundError("Post")
        
        post = db.query(Post).filter(Post.id == post_id).first()  # Compare as string
        if not post:
            raise NotFoundError("Post")
        
        # Get author name
        author = db.query(Profile).filter(Profile.id == post.author_id).first()
        
        return PostResponse(
            id=str(post.id),
            title=post.title,
            slug=getattr(post, 'slug', None),
            content=post.content,
            excerpt=post.excerpt,
            tags=post.tags or [],
            featured_image=post.featured_image,
            author_id=str(post.author_id),
            author_name=author.full_name if author else None,
            published=post.published,
            created_at=post.created_at,
            updated_at=post.updated_at
        )
    
    @staticmethod
    def create_post(post_data: PostCreate, author_id: str, db: Session) -> PostResponse:
        """Create a new post"""
        post_id = str(uuid.uuid4())
        # Validate UUID format
        try:
            uuid.UUID(author_id)
        except ValueError:
            raise ValueError(f"Invalid author_id format: {author_id}")
        
        # Generate slug if not provided
        import re
        slug = post_data.slug or re.sub(r'[^\w\s-]', '', post_data.title.lower()).strip()
        slug = re.sub(r'[-\s]+', '-', slug)
        
        post = Post(
            id=post_id,
            title=post_data.title,
            slug=slug,
            content=post_data.content,
            excerpt=post_data.excerpt or post_data.content[:200] if post_data.content else None,
            tags=post_data.tags or [],
            featured_image=post_data.featured_image,
            author_id=author_id,  # Keep as string
            published=post_data.published
        )
        
        db.add(post)
        db.commit()
        db.refresh(post)
        
        # Get author name
        author = db.query(Profile).filter(Profile.id == author_id).first()
        
        return PostResponse(
            id=str(post.id),
            title=post.title,
            slug=getattr(post, 'slug', None),
            content=post.content,
            excerpt=post.excerpt,
            tags=post.tags or [],
            featured_image=post.featured_image,
            author_id=str(post.author_id),
            author_name=author.full_name if author else None,
            published=post.published,
            created_at=post.created_at,
            updated_at=post.updated_at
        )
    
    @staticmethod
    def update_post(
        post_id: str,
        post_data: PostUpdate,
        user_id: str,
        db: Session
    ) -> PostResponse:
        """Update a post"""
        try:
            uuid.UUID(post_id)  # Validate format
            uuid.UUID(user_id)  # Validate format
        except ValueError:
            raise NotFoundError("Post")
        
        post = db.query(Post).filter(Post.id == post_id).first()  # Compare as string
        if not post:
            raise NotFoundError("Post")
        
        # Check if user is the author
        # Convert both to string for comparison (post.author_id might be UUID or string)
        post_author_id_str = str(post.author_id)
        user_id_str = str(user_id)

        if post_author_id_str != user_id_str:
            # Debug logging
            print(f"DEBUG: Permission check failed - post.author_id: {post_author_id_str} ({type(post.author_id)}), user_id: {user_id_str} ({type(user_id)})")
            raise PermissionDeniedError("Not authorized to update this post")
        
        # Update fields
        if post_data.title is not None:
            post.title = post_data.title
        if post_data.slug is not None:
            post.slug = post_data.slug
        elif post_data.title is not None:
            # Generate slug from title if title changed but slug not provided
            import re
            slug = re.sub(r'[^\w\s-]', '', post_data.title.lower()).strip()
            slug = re.sub(r'[-\s]+', '-', slug)
            post.slug = slug
        if post_data.content is not None:
            post.content = post_data.content
        if post_data.excerpt is not None:
            post.excerpt = post_data.excerpt
        if post_data.tags is not None:
            post.tags = post_data.tags
        if post_data.featured_image is not None:
            post.featured_image = post_data.featured_image
        if post_data.published is not None:
            post.published = post_data.published
        
        db.commit()
        db.refresh(post)
        
        # Get author name
        author = db.query(Profile).filter(Profile.id == post.author_id).first()
        
        return PostResponse(
            id=str(post.id),
            title=post.title,
            slug=getattr(post, 'slug', None),
            content=post.content,
            excerpt=post.excerpt,
            tags=post.tags or [],
            featured_image=post.featured_image,
            author_id=str(post.author_id),
            author_name=author.full_name if author else None,
            published=post.published,
            created_at=post.created_at,
            updated_at=post.updated_at
        )
    
    @staticmethod
    def delete_post(post_id: str, user_id: str, db: Session) -> dict:
        """Delete a post"""
        try:
            uuid.UUID(post_id)  # Validate format
            uuid.UUID(user_id)  # Validate format
        except ValueError:
            raise NotFoundError("Post")
        
        post = db.query(Post).filter(Post.id == post_id).first()  # Compare as string
        if not post:
            raise NotFoundError("Post")
        
        # Check if user is the author
        # Convert both to string for comparison (post.author_id might be UUID or string)
        post_author_id_str = str(post.author_id)
        user_id_str = str(user_id)

        if post_author_id_str != user_id_str:
            print(f"DEBUG: Permission check failed - post.author_id: {post_author_id_str} ({type(post.author_id)}), user_id: {user_id_str} ({type(user_id)})")
            raise PermissionDeniedError("Not authorized to delete this post")
        
        db.delete(post)
        db.commit()
        
        return {"message": "Post deleted successfully"}

