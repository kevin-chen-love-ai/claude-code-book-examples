"""
Post routes
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db import get_db
from service.post_service import PostService
from api.dependencies import get_current_user, SimpleUser
from schemas.post import PostCreate, PostUpdate, PostResponse
from utils.exceptions import NotFoundError, PermissionDeniedError

router = APIRouter(prefix="/api/posts", tags=["posts"])
security = HTTPBearer(auto_error=False)


@router.get("", response_model=List[PostResponse])
async def get_posts(
    published: bool = Query(True, description="Filter by published status"),
    author_id: str = Query(None, description="Filter by author ID"),
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
    db: Session = Depends(get_db)
):
    """Get all posts"""
    if not db:
        # Return empty list if database is not available (graceful degradation)
        return []
    
    try:
        # Use author_id if provided, otherwise return all posts (for published posts, no auth needed)
        # For author-specific queries, user must be authenticated
        filter_author_id = author_id
        
        # If author_id is provided, user must be authenticated and it must be their own ID
        if author_id:
            if not credentials:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required to view your posts"
                )
            current_user = get_current_user(credentials, db)
            if current_user.id != author_id:
                # Only allow users to see their own posts
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only view your own posts"
                )
        
        return PostService.get_all_posts(db, published_only=published, author_id=filter_author_id)
    except HTTPException:
        raise
    except Exception as e:
        # Check if it's a database connection error
        error_str = str(e).lower()
        if 'connection' in error_str or 'network' in error_str or 'unreachable' in error_str or 'operationalerror' in error_str:
            # Database connection failed - return empty list gracefully
            return []
        # For other errors, raise HTTP exception
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch posts: {str(e)}"
        )


@router.get("/{post_id}", response_model=PostResponse)
async def get_post(post_id: str, db: Session = Depends(get_db)):
    """Get single post"""
    if not db:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    try:
        return PostService.get_post_by_id(post_id, db)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e.detail)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch post: {str(e)}"
        )


@router.post("", response_model=PostResponse)
async def create_post(
    post: PostCreate,
    current_user: SimpleUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create post"""
    if not db:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    try:
        return PostService.create_post(post, current_user.id, db)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create post: {str(e)}"
        )


@router.put("/{post_id}", response_model=PostResponse)
async def update_post(
    post_id: str,
    post: PostUpdate,
    current_user: SimpleUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update post"""
    if not db:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    try:
        return PostService.update_post(post_id, post, current_user.id, db)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e.detail)
        )
    except PermissionDeniedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e.detail)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to update post: {str(e)}"
        )


@router.delete("/{post_id}")
async def delete_post(
    post_id: str,
    current_user: SimpleUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete post"""
    if not db:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not available"
        )
    
    try:
        return PostService.delete_post(post_id, current_user.id, db)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e.detail)
        )
    except PermissionDeniedError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e.detail)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to delete post: {str(e)}"
        )

