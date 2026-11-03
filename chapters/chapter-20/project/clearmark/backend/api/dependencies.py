"""
API dependencies - authentication and authorization
"""
import uuid
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from db import get_db
from models.profile import Profile
from utils.security import verify_token
from utils.exceptions import AuthenticationError


security = HTTPBearer()


class SimpleUser:
    """Simple user object for current user"""
    def __init__(self, id: str, email: str):
        self.id = id
        self.email = email


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> SimpleUser:
    """Verify JWT token and get current user"""
    token = credentials.credentials
    payload = verify_token(token)
    
    if payload is None:
        raise AuthenticationError("Invalid token")
    
    user_id: str = payload.get("sub")
    if user_id is None:
        raise AuthenticationError("Token missing user ID")
    
    # Verify user exists in database
    # Profile ID is UUID as string
    user = db.query(Profile).filter(Profile.id == user_id).first()
    if not user:
        raise AuthenticationError("User not found")
    
    return SimpleUser(id=user_id, email=payload.get("email", ""))

