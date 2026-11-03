"""
Authentication service - business logic for authentication
"""
import uuid
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from repository.profile_repository import ProfileRepository
from models.profile import Profile
from utils.security import get_password_hash, verify_password, create_access_token
from schemas.auth import UserRegister, UserLogin, UserResponse, TokenResponse, ChangePassword, UpdateProfile


class AuthService:
    """Authentication business logic"""
    
    @staticmethod
    def register_user(user_data: UserRegister, db: Session) -> TokenResponse:
        """Register a new user"""
        # Check if user already exists
        existing = ProfileRepository.find_by_email(db, user_data.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists"
            )
        
        # Create new user
        user_id = str(uuid.uuid4())
        password_hash = get_password_hash(user_data.password)

        profile = Profile(
            id=user_id,
            email=user_data.email,
            full_name=user_data.full_name or "",
            password_hash=password_hash,
            provider='email'
        )
        
        profile = ProfileRepository.create(db, profile)
        
        # Create access token
        access_token = create_access_token(data={"sub": user_id, "email": user_data.email})
        
        # Check if user is admin
        is_admin = getattr(profile, 'is_admin', 'false') == 'true' or getattr(profile, 'is_admin', False) == True
        
        provider = getattr(profile, 'provider', 'email') or 'email'
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse(
                id=str(profile.id),
                email=profile.email,
                user_metadata={
                    "full_name": profile.full_name or "",
                    "is_admin": is_admin,
                    "provider": provider
                }
            )
        )
    
    @staticmethod
    def login_user(credentials: UserLogin, db: Session) -> TokenResponse:
        """Login user"""
        # Get user from database
        user = ProfileRepository.find_by_email(db, credentials.email)
        if not user or not user.password_hash:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        # Verify password
        if not verify_password(credentials.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        # Create access token
        access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
        
        # Check if user is admin
        is_admin = getattr(user, 'is_admin', 'false') == 'true' or getattr(user, 'is_admin', False) == True
        provider = getattr(user, 'provider', 'email') or 'email'
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse(
                id=str(user.id),
                email=user.email,
                user_metadata={
                    "full_name": user.full_name or "",
                    "is_admin": is_admin,
                    "provider": provider
                }
            )
        )
    
    @staticmethod
    def get_current_user_info(user_id: str, db: Session) -> UserResponse:
        """Get current user information"""
        profile = ProfileRepository.find_by_id(db, user_id)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Check if user is admin
        is_admin = getattr(profile, 'is_admin', 'false') == 'true' or getattr(profile, 'is_admin', False) == True
        provider = getattr(profile, 'provider', 'email') or 'email'
        
        # For Supabase, email is in auth.users, not profiles table
        email = getattr(profile, 'email', '') or ''
        
        # Try to get email from auth.users if available (for Supabase)
        if not email:
            try:
                from sqlalchemy import text
                result = db.execute(
                    text("SELECT email FROM auth.users WHERE id = :user_id"),
                    {"user_id": user_id}
                ).first()
                if result:
                    email = result.email
            except Exception:
                # If we can't get email from auth.users, leave it empty
                pass
        
        return UserResponse(
            id=str(profile.id),
            email=email,
            user_metadata={
                "full_name": profile.full_name or "",
                "is_admin": is_admin,
                "provider": provider
            }
        )

    @staticmethod
    def update_profile(user_id: str, profile_data: UpdateProfile, db: Session) -> UserResponse:
        """Update user profile"""
        # Get user from database
        profile = ProfileRepository.find_by_id(db, user_id)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Update profile fields
        profile.full_name = profile_data.full_name
        db.commit()
        db.refresh(profile)

        # Check if user is admin
        is_admin = getattr(profile, 'is_admin', 'false') == 'true' or getattr(profile, 'is_admin', False) == True
        provider = getattr(profile, 'provider', 'email') or 'email'

        # For Supabase, email is in auth.users, not profiles table
        # We'll get it from the JWT token or query auth.users if needed
        # For now, we'll use empty string if not available from profile
        email = getattr(profile, 'email', '') or ''
        
        # Try to get email from auth.users if available (for Supabase)
        if not email:
            try:
                from sqlalchemy import text
                result = db.execute(
                    text("SELECT email FROM auth.users WHERE id = :user_id"),
                    {"user_id": user_id}
                ).first()
                if result:
                    email = result.email
            except Exception:
                # If we can't get email from auth.users, leave it empty
                # The frontend will handle it
                pass

        return UserResponse(
            id=str(profile.id),
            email=email,
            user_metadata={
                "full_name": profile.full_name or "",
                "is_admin": is_admin,
                "provider": provider
            }
        )

    @staticmethod
    def change_password(user_id: str, password_data: ChangePassword, db: Session) -> dict:
        """Change user password"""
        # Get user from database
        profile = ProfileRepository.find_by_id(db, user_id)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Verify current password
        if not profile.password_hash or not verify_password(password_data.current_password, profile.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )

        # Update password
        new_password_hash = get_password_hash(password_data.new_password)
        profile.password_hash = new_password_hash
        db.commit()

        return {"message": "Password changed successfully"}

