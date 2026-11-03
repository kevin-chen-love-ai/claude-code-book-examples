"""
Database session management
"""
from sqlalchemy.orm import Session
from fastapi import Depends
from .connection import SessionLocal


def get_db() -> Session:
    """
    Dependency for getting database session
    """
    if SessionLocal is None:
        yield None
        return
    
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

