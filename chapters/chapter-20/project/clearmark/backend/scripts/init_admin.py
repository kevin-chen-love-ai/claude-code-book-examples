"""
Initialize admin user in the database
"""
import sys
import os
from sqlalchemy.orm import Session
from datetime import datetime
import uuid

# Add parent directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)

# Try different import paths
try:
    from backend.db.connection import SessionLocal
    from backend.models.profile import Profile
    from backend.utils.security import get_password_hash
except ImportError:
    try:
        from db.connection import SessionLocal
        from models.profile import Profile
        from utils.security import get_password_hash
    except ImportError:
        # Add backend directory to path if needed
        backend_dir = os.path.join(os.path.dirname(current_dir), 'backend')
        if backend_dir not in sys.path:
            sys.path.insert(0, backend_dir)
        from db.connection import SessionLocal
        from models.profile import Profile
        from utils.security import get_password_hash

# Default admin credentials
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "your-admin-password")
ADMIN_NAME = os.getenv("ADMIN_NAME", "Admin User")


def init_admin(db: Session):
    """Initialize admin user in the database"""
    print("======================================")
    print("Admin User Initialization")
    print("======================================")
    print()

    # Check if admin already exists
    existing_admin = db.query(Profile).filter(
        (Profile.email == ADMIN_EMAIL) | (Profile.is_admin == 'true')
    ).first()

    if existing_admin:
        if existing_admin.email == ADMIN_EMAIL:
            print(f"⚠️  Admin user already exists: {existing_admin.email}")
        else:
            print(f"⚠️  Admin user already exists: {existing_admin.email}")
        
        # Update admin status if needed
        if existing_admin.is_admin != 'true':
            existing_admin.is_admin = 'true'
            db.commit()
            print(f"✅ Updated user {existing_admin.email} to admin")
        else:
            print(f"   User {existing_admin.email} is already an admin")
        return

    print(f"📝 Creating admin user...")
    print(f"   Email: {ADMIN_EMAIL}")
    print(f"   Name: {ADMIN_NAME}")

    # Create admin user
    admin_id = str(uuid.uuid4())
    password_hash = get_password_hash(ADMIN_PASSWORD)

    admin_profile = Profile(
        id=admin_id,
        email=ADMIN_EMAIL,
        full_name=ADMIN_NAME,
        password_hash=password_hash,
        provider='email',
        is_admin='true',
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )

    try:
        db.add(admin_profile)
        db.commit()
        db.refresh(admin_profile)
        print(f"✅ Admin user created successfully!")
        print(f"   ID: {admin_id}")
        print(f"   Email: {ADMIN_EMAIL}")
        print(f"   Password: {ADMIN_PASSWORD}")
        print()
        print("⚠️  IMPORTANT: Change the default password after first login!")
    except Exception as e:
        db.rollback()
        print(f"❌ Failed to create admin user: {e}")
        raise


if __name__ == "__main__":
    print()
    print("======================================")
    print("Admin User Initialization Script")
    print("======================================")
    print()
    print(f"Admin Email: {ADMIN_EMAIL}")
    print(f"Admin Password: {ADMIN_PASSWORD}")
    print(f"Admin Name: {ADMIN_NAME}")
    print()
    print("To customize, set environment variables:")
    print("  ADMIN_EMAIL=your@email.com")
    print("  ADMIN_PASSWORD=your_password")
    print("  ADMIN_NAME=Your Name")
    print()

    db = SessionLocal()
    try:
        init_admin(db)
    except Exception as e:
        print(f"❌ Error initializing admin: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()
        print()
        print("======================================")
