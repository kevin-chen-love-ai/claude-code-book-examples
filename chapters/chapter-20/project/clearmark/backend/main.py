"""
ClearMark Backend API - Main Application Entry Point
FastAPI application with three-layer architecture:
- API Layer: Routes and HTTP handling
- Service Layer: Business logic
- Model Layer: Data models and access
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import health, auth, posts, remove_background

# Initialize FastAPI
app = FastAPI(
    title="ClearMark API",
    description="AI Watermark Removal Platform API",
    version="1.0.0"
)

# CORS configuration
# Allow requests from common development origins and production
# Note: Cannot use allow_origins=["*"] with allow_credentials=True
# So we explicitly list all allowed origins
# Render deployment URL can be added via environment variable
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost",
    "http://127.0.0.1",
]

# Add Render frontend URL from environment variable if set
RENDER_FRONTEND_URL = os.getenv("RENDER_FRONTEND_URL", "")
if RENDER_FRONTEND_URL:
    ALLOWED_ORIGINS.append(RENDER_FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Note: Database tables are managed via Supabase migration scripts
# See backend/supabase-migrations.sql for table definitions

# Register routes
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(posts.router)
app.include_router(remove_background.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
