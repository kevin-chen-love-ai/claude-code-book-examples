"""
Make a user admin by email
"""
import sys
import os
from sqlalchemy.orm import Session
from sqlalchemy import text

# Add parent directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)

# Try different import paths
try:
    from backend.db.connection import SessionLocal
    from backend.models.profile import Profile
except ImportError:
    try:
        from db.connection import SessionLocal
        from models.profile import Profile
    except ImportError:
        # Add backend directory to path if needed
        backend_dir = os.path.join(os.path.dirname(current_dir), 'backend')
        if backend_dir not in sys.path:
            sys.path.insert(0, backend_dir)
        from db.connection import SessionLocal
        from models.profile import Profile


def make_admin_by_email(email: str, db: Session):
    """Make a user admin by email"""
    print("======================================")
    print("Make User Admin")
    print("======================================")
    print()
    print(f"Looking for user: {email}")
    print()

    # Since we're using Supabase, email is in auth.users, not profiles
    # We need to query auth.users table via raw SQL
    user = None
    
    try:
        # Query auth.users to find the user_id by email
        result = db.execute(
            text("SELECT id FROM auth.users WHERE email = :email"),
            {"email": email}
        ).first()
        
        if not result:
            print(f"❌ User not found in auth.users: {email}")
            print()
            print("Let's check all profiles:")
            all_users = db.query(Profile).all()
            if all_users:
                for u in all_users:
                    admin_status = "Admin" if (u.is_admin == True or u.is_admin == 'true' or u.is_admin == True) else "User"
                    # Try to get email from auth.users
                    try:
                        user_result = db.execute(
                            text("SELECT email FROM auth.users WHERE id = :user_id"),
                            {"user_id": u.id}
                        ).first()
                        user_email = user_result.email if user_result else f"ID: {u.id}"
                    except:
                        user_email = f"ID: {u.id}"
                    print(f"  - {user_email} (ID: {u.id}, Status: {admin_status}, Name: {u.full_name or 'N/A'})")
            else:
                print("  No users found in profiles table")
            return False
        
        user_id = result.id
        print(f"   Found user ID: {user_id}")
        
        # Try to get user email and name from auth.users
        user_info = db.execute(
            text("SELECT email, raw_user_meta_data FROM auth.users WHERE id = :user_id"),
            {"user_id": user_id}
        ).first()
        
        user_email = user_info.email if user_info else email
        user_name = None
        if user_info and user_info.raw_user_meta_data:
            user_name = user_info.raw_user_meta_data.get('full_name') if isinstance(user_info.raw_user_meta_data, dict) else None
        
        # Now find the profile
        user = db.query(Profile).filter(Profile.id == user_id).first()
        
        if not user:
            print(f"⚠️  Profile not found for user ID: {user_id}")
            print("   Creating profile for user...")
            # Create profile if it doesn't exist
            user = Profile(
                id=user_id,
                full_name=user_name or "",
                avatar_url=None,
                is_admin=True,  # Set as admin directly
                created_at=None,  # Will use default
                updated_at=None   # Will use default
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"✅ Profile created for user: {user_email}")
        else:
            print(f"   Found profile for user: {user_email}")
            
    except Exception as e:
        print(f"❌ Error querying auth.users: {e}")
        print("   Trying alternative approach: checking all profiles...")
        # Fallback: list all users and match by email
        all_users = db.query(Profile).all()
        if all_users:
            for u in all_users:
                try:
                    user_result = db.execute(
                        text("SELECT email FROM auth.users WHERE id = :user_id"),
                        {"user_id": u.id}
                    ).first()
                    if user_result and user_result.email and email.lower() in user_result.email.lower():
                        user = u
                        print(f"   Found user by matching email: {user_result.email}")
                        break
                except Exception as ex:
                    print(f"   Error checking user {u.id}: {ex}")
                    pass
        
        if not user:
            print(f"❌ User not found: {email}")
            return False

    # Check current admin status
    is_currently_admin = user.is_admin == True or user.is_admin == 'true' or user.is_admin == True
    
    if is_currently_admin:
        print(f"⚠️  User {email} is already an admin")
        print(f"   ID: {user.id}")
        print(f"   Name: {user.full_name or 'N/A'}")
        return True

    # Update to admin
    print(f"📝 Updating user to admin...")
    print(f"   Email: {user.email or email}")
    print(f"   ID: {user.id}")
    print(f"   Name: {user.full_name or 'N/A'}")
    
    user.is_admin = True
    try:
        db.commit()
        db.refresh(user)
        print()
        print(f"✅ User {email} is now an admin!")
        return True
    except Exception as e:
        db.rollback()
        print(f"❌ Failed to update user: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    import sys
    
    # Get email from command line argument or use default
    if len(sys.argv) > 1:
        email = sys.argv[1]
    else:
        email = "reader@example.com"
    
    print()
    print("======================================")
    print("Make User Admin Script")
    print("======================================")
    print()
    print(f"Target Email: {email}")
    print()
    print("Usage: python make_admin.py <email>")
    print()

    db = SessionLocal()
    try:
        success = make_admin_by_email(email, db)
        if success:
            print()
            print("======================================")
        else:
            sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        sys.exit(1)
    finally:
        db.close()

