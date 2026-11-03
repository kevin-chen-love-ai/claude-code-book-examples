"""
Authentication schemas
"""
from typing import Optional
from pydantic import BaseModel, EmailStr
from .base import BaseSchema


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class ChangePassword(BaseModel):
    current_password: str
    new_password: str


class UpdateProfile(BaseModel):
    full_name: str


class UserResponse(BaseSchema):
    id: str
    email: str
    user_metadata: dict


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

