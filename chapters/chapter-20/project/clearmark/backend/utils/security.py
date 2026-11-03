"""
Security utilities: password hashing and JWT tokens
"""
import os
import bcrypt
from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
import requests
from pathlib import Path

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / '.env'
    load_dotenv(dotenv_path=env_path)
except ImportError:
    pass  # python-dotenv not installed, skip

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")  # Supabase JWT secret for verifying tokens


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except:
        # Fallback to direct bcrypt if passlib fails
        password_bytes = plain_password.encode('utf-8')[:72]
        return bcrypt.checkpw(password_bytes, hashed_password.encode('utf-8'))


def get_password_hash(password: str) -> str:
    """Hash password"""
    # Direct bcrypt hashing to avoid passlib issues
    password_bytes = password.encode('utf-8')[:72]  # bcrypt max 72 bytes
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> dict | None:
    """Verify JWT token - supports both backend tokens and Supabase tokens"""
    if not token:
        return None
    
    # First try to verify as backend token (using SECRET_KEY)
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        pass
    
    # If that fails, try to verify as Supabase token
    # Supabase tokens use RS256 algorithm and Supabase's JWT secret
    if SUPABASE_JWT_SECRET:
        try:
            # Supabase tokens can use HS256 or RS256
            # Try HS256 first (most common for Supabase)
            payload = jwt.decode(
                token, 
                SUPABASE_JWT_SECRET, 
                algorithms=["HS256", "RS256"],
                options={"verify_signature": True}
            )
            return payload
        except JWTError:
            pass
    
    # If SUPABASE_JWT_SECRET is not set, try to verify without signature verification
    # This is a fallback for development - Supabase tokens contain user info in payload
    if not SUPABASE_JWT_SECRET:
        try:
            # Decode without verification (for development only)
            # PyJWT 2.x requires 'key' parameter even when verify_signature is False
            # We pass an empty string as key since we're not verifying
            payload = jwt.decode(
                token,
                key="",
                algorithms=["HS256"],
                options={"verify_signature": False}
            )
            # Basic validation - check if it has required fields
            if payload.get("sub") or payload.get("user_id"):
                return payload
        except JWTError:
            pass
    
    # If all verification methods fail, try to get user info from Supabase API
    # This is a more reliable way for Supabase tokens
    if SUPABASE_URL and SUPABASE_ANON_KEY:
        try:
            # Use Supabase REST API to verify the token
            headers = {
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_ANON_KEY
            }
            response = requests.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers=headers,
                timeout=5
            )
            if response.status_code == 200:
                user_data = response.json()
                # Convert Supabase user data to JWT-like payload
                payload = {
                    "sub": user_data.get("id", ""),
                    "email": user_data.get("email", ""),
                    "user_metadata": user_data.get("user_metadata", {}),
                    "aud": "authenticated",
                    "role": user_data.get("role", "authenticated")
                }
                return payload
        except Exception:
            pass
    
    return None

