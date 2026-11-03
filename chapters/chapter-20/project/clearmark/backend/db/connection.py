"""
Database connection setup for Supabase PostgreSQL
"""
import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / '.env'
    load_dotenv(dotenv_path=env_path)
except ImportError:
    pass  # python-dotenv not installed, skip

# Get DATABASE_URL from environment variable
# Format: postgresql://db-user:your-db-password@db-host:5432/db-name
# You can find this in Supabase Dashboard -> Settings -> Database -> Connection string
# Use Connection Pooling mode (Transaction or Session mode)
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    import warnings
    warnings.warn(
        "DATABASE_URL environment variable is not set. "
        "Please set DATABASE_URL to your Supabase PostgreSQL connection string. "
        "You can find it in Supabase Dashboard -> Settings -> Database -> Connection string. "
        "Example: postgresql://db-user:your-db-password@db-host:5432/db-name"
    )
    # Set a dummy URL to prevent immediate failure - get_db will handle None
    DATABASE_URL = None
    engine = None
    SessionLocal = None
else:
    try:
        # Create engine for Supabase PostgreSQL connection
        # Use connection pooling for better performance
        engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,  # Verify connections before using them
            pool_recycle=300,    # Recycle connections after 5 minutes
        )
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    except Exception as e:
        import warnings
        warnings.warn(f"Failed to create database engine: {e}")
        engine = None
        SessionLocal = None

# Create engine for Supabase PostgreSQL connection
# Use connection pooling for better performance
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Verify connections before using them
    pool_recycle=300,    # Recycle connections after 5 minutes
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

