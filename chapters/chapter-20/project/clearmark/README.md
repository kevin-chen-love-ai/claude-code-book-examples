# ClearMark - AI Watermark Removal Platform

A modern web platform for AI-powered watermark removal using IOPaint technology, with user authentication, blog management, and Docker deployment support.

## Features

### Core Features
- 🎨 **Interactive Mask Drawing**: Draw masks directly on images to mark watermarks
- 🚀 **AI-Powered Removal**: Uses IOPaint API for advanced inpainting
- 📸 **Image Upload**: Support for JPG, PNG, WEBP formats (max 10MB)
- 🔄 **Real-time Processing**: Progress tracking and status updates
- 📊 **Before/After Comparison**: Side-by-side comparison view
- 💾 **Download Results**: Easy download of processed images

### Additional Features
- 👤 **User Authentication**: Email/password registration/login, Google and Facebook OAuth
- 📝 **Blog Management**: Create, edit, and manage blog posts with Markdown support
- 🐳 **Docker Deployment**: Complete containerized deployment with Docker Compose
- 🔒 **HTTPS Support**: Caddy for automatic HTTPS and reverse proxy
- 📊 **API Testing**: Comprehensive test suite for all API endpoints

## Project Structure

```
clearmark/
├── frontend/              # Frontend static assets (HTML, CSS, JS, Components)
│   ├── index.html         # Home page with watermark removal
│   ├── blog.html          # Blog page
│   ├── login.html         # Login page
│   ├── about.html         # About page
│   ├── css/
│   │   └── styles.css    # Main stylesheet
│   ├── js/
│   │   ├── auth.js       # Authentication logic
│   │   ├── blog.js       # Blog management
│   │   ├── common.js     # Common utilities
│   │   ├── mask-drawer.js # Mask drawing canvas
│   │   └── watermark-removal.js  # IOPaint API integration
│   └── components/        # Reusable HTML components
│       ├── header.html
│       └── footer.html
├── backend/               # Backend Python code
│   ├── main.py           # FastAPI backend
│   ├── api/              # API layer (routes)
│   ├── service/          # Business logic layer
│   ├── models/           # Data models layer
│   ├── repository/       # Data access layer
│   ├── schemas/          # Pydantic schemas
│   ├── db/               # Database utilities
│   ├── utils/            # Utility functions
│   ├── iopaint-proxy.py # IOPaint proxy service
│   └── requirements.txt # Python dependencies
├── scripts/
│   ├── start.sh          # Unified startup script
│   └── test/
│       └── test-full.sh  # End-to-end API test
├── logs/                 # Application logs
├── docs/
│   └── SUPABASE_INIT_STEPS.md
├── docker-compose.yml     # Docker Compose configuration
├── Caddyfile             # Caddy configuration
└── README.md             # This file
```

## Quick Start

### Option 1: Docker (Recommended)

```bash
# Start all services
./scripts/start.sh docker

# Or use Docker Compose directly
docker compose up -d
```

Services will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- IOPaint: http://localhost:8080
- Proxy: http://localhost:5001

### Option 2: Local Development (No Docker)

```bash
# Start services locally
./scripts/start.sh local

# This will:
# 1. Start PostgreSQL (Docker)
# 2. Start IOPaint service
# 3. Start IOPaint proxy
# 4. Start backend API
# 5. Start frontend server
```

### Option 3: Build Docker Images

```bash
# Build Docker images
./scripts/start.sh build
```

## Setup Instructions

### Prerequisites

- Docker and Docker Compose (for Docker deployment)
- Python 3.11+ (for local development)
- PostgreSQL 15+ (or use Docker)

### Environment Variables

Create a `.env` file in the project root:

```bash
# Database Configuration
POSTGRES_DB=clearmark
POSTGRES_USER=clearmark
POSTGRES_PASSWORD=your-db-password
DATABASE_URL=postgresql://db-user:your-db-password@db-host:5432/db-name

# Supabase Configuration (Optional)
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_KEY=your-supabase-service-role-key
USE_LOCAL_DB=false

# API Configuration
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
IOPAINT_URL=http://iopaint:8080
```

### Database Setup

#### Supabase Setup (Current Configuration)

1. **Login to Supabase Dashboard**: https://app.supabase.com
2. **Select Project**: your-project-ref
3. **Go to SQL Editor**
4. **Run Migration Script**: Copy and execute `backend/supabase-migrations.sql`

This will create all required tables, indexes, RLS policies, and triggers.

Detailed steps: see `docs/SUPABASE_INIT_STEPS.md`.

#### Local PostgreSQL Setup (For Debugging)

If you want to use local PostgreSQL instead, set `USE_LOCAL_DB=true` in `.env`:

```bash
# Using Docker
docker compose exec postgres psql -U clearmark -d clearmark -f /docker-entrypoint-initdb.d/init.sql

# Or manually
psql -U clearmark -d clearmark < backend/local-db-init.sql
```

### Caddy Configuration

Edit `Caddyfile` and replace `yourdomain.com` with your actual domain name for production deployment.

## API Documentation

### Authentication Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires authentication)

### Blog Endpoints

- `GET /api/posts` - Get all posts (public)
- `GET /api/posts/{post_id}` - Get single post (public)
- `POST /api/posts` - Create post (authenticated)
- `PUT /api/posts/{post_id}` - Update post (authenticated, author only)
- `DELETE /api/posts/{post_id}` - Delete post (authenticated, author only)

### Health Check

- `GET /health` - Service health check

## Testing

### Run Test Suite

```bash
# Run the end-to-end API test
./scripts/test/test-full.sh
```

## Deployment

### Docker Deployment

1. Build images: `./scripts/start.sh build`
2. Start services: `./scripts/start.sh docker`
3. Configure Caddy: Edit `Caddyfile` with your domain
4. Enable HTTPS: Caddy will automatically obtain SSL certificates

### Production Checklist

- [ ] Set production environment variables
- [ ] Configure domain DNS
- [ ] Enable Supabase OAuth providers (if using Supabase)
- [ ] Set up monitoring
- [ ] Configure backups
- [ ] Set up logging aggregation
- [ ] Configure rate limiting
- [ ] Set up health checks
- [ ] Set up alerting

## Troubleshooting

### Service Won't Start

```bash
# Check service status
docker compose ps

# View logs
docker compose logs -f backend
```

### API Connection Errors

- Check if backend is running: `curl http://localhost:8000/health`
- Verify environment variables
- Check logs in `logs/` directory

### IOPaint Not Responding

- Check IOPaint container logs: `docker compose logs iopaint`
- Verify model is downloaded (first run takes time)
- Check proxy connection: `curl http://localhost:5001/health`

## Development

### Local Development Setup

1. Install dependencies:
```bash
python3 -m venv backend/venv
source backend/venv/bin/activate
pip install -r backend/requirements.txt
```

2. Start services:
```bash
./scripts/start.sh local
```

### Code Structure

- `backend/main.py`: FastAPI application with all endpoints
- `backend/models/`: SQLAlchemy database models
- `backend/db/`: Database utilities and password hashing
- `frontend/js/`: Frontend JavaScript files
- `frontend/css/`: Stylesheets

## Logs

All logs are stored in the `logs/` directory:

- `logs/backend.log`: Backend API logs
- `logs/iopaint.log`: IOPaint service logs
- `logs/proxy.log`: Proxy service logs
- `logs/frontend.log`: Frontend server logs
- `logs/start.log`: Startup script logs

## Support

For issues and questions:
- Check logs in `logs/` directory
- Check service status: `docker compose ps`
- Review backend logs: `docker compose logs -f backend`
