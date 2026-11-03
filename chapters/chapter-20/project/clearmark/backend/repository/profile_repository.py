"""
Profile repository - Data Access Object for Profile model
"""
import uuid
from typing import Optional
from sqlalchemy.orm import Session

from models.profile import Profile


class ProfileRepository:
    """Data access layer for Profile"""
    
    @staticmethod
    def find_by_id(db: Session, profile_id: str) -> Optional[Profile]:
        """Find profile by ID"""
        # Profile ID is UUID as string
        return db.query(Profile).filter(Profile.id == profile_id).first()
    
    @staticmethod
    def create(db: Session, profile: Profile) -> Profile:
        """Create a new profile"""
        db.add(profile)
        db.commit()
        db.refresh(profile)
        return profile
    
    @staticmethod
    def update(db: Session, profile: Profile) -> Profile:
        """Update an existing profile"""
        db.commit()
        db.refresh(profile)
        return profile
    
    @staticmethod
    def delete(db: Session, profile: Profile) -> None:
        """Delete a profile"""
        db.delete(profile)
        db.commit()

