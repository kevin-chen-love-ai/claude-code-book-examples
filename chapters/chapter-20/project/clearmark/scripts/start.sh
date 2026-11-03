#!/bin/bash

# ClearMark Unified Start Script
# This script provides three startup modes:
# 1. No Docker - Local development mode
# 2. Build Docker images
# 3. Run Docker locally

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging
LOG_DIR="$PROJECT_ROOT/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/start.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}ERROR: $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

info() {
    echo -e "${GREEN}$1${NC}" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

# Function: Start without Docker (local development)
start_no_docker() {
    info "Starting ClearMark in local development mode..."
    
    # Check Python version
    if ! command -v python3 &> /dev/null; then
        error "Python 3 is required but not installed"
    fi
    
    # Check if virtual environment exists
    if [ ! -d "backend/venv" ]; then
        warn "Virtual environment not found. Creating..."
        python3 -m venv backend/venv
        source backend/venv/bin/activate
        pip install --upgrade pip
        pip install -r backend/requirements.txt
    else
        source backend/venv/bin/activate
    fi
    
    # Start PostgreSQL (check if already running)
    if ! docker ps | grep -q clearmark-postgres; then
        info "Starting PostgreSQL..."
        docker compose up -d postgres
        sleep 5
    fi
    
    # Start IOPaint service
    info "Starting IOPaint service..."
    if [ -f "backend/venv/bin/iopaint" ]; then
        iopaint start --model=lama --device=cpu --port=8080 > "$LOG_DIR/iopaint.log" 2>&1 &
        IOPAINT_PID=$!
        echo $IOPAINT_PID > "$LOG_DIR/iopaint.pid"
        info "IOPaint started with PID: $IOPAINT_PID"
        sleep 10
    else
        warn "IOPaint not found in venv. Please install: pip install iopaint"
    fi
    
    # Start proxy
    info "Starting IOPaint proxy..."
    cd backend
    python3 iopaint-proxy.py > "../$LOG_DIR/proxy.log" 2>&1 &
    PROXY_PID=$!
    echo $PROXY_PID > "../$LOG_DIR/proxy.pid"
    cd ..
    info "Proxy started with PID: $PROXY_PID"
    sleep 2
    
    # Start backend API
    info "Starting backend API..."
    cd backend
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload > "../$LOG_DIR/backend.log" 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > "../$LOG_DIR/backend.pid"
    cd ..
    info "Backend started with PID: $BACKEND_PID"
    sleep 3
    
    # Start frontend server (serve from frontend directory)
    info "Starting frontend server..."
    cd frontend
    python3 -m http.server 3000 > "../$LOG_DIR/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > "../$LOG_DIR/frontend.pid"
    cd ..
    info "Frontend started with PID: $FRONTEND_PID (serving from frontend/)"
    
    info ""
    info "All services started successfully!"
    info ""
    info "Service URLs:"
    info "  - Frontend: http://localhost:3000"
    info "  - Backend API: http://localhost:8000"
    info "  - IOPaint: http://localhost:8080"
    info "  - Proxy: http://localhost:5001"
    info ""
    info "Logs: $LOG_DIR/"
    info "PIDs saved in: $LOG_DIR/*.pid"
    info ""
    info "To stop services, run: pkill -f 'iopaint|iopaint-proxy|uvicorn|http.server'"
}

# Function: Build Docker images
build_docker() {
    info "Building Docker images..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker is required but not installed"
    fi
    
    if ! docker compose version &> /dev/null; then
        error "Docker Compose v2 is required but not installed"
    fi
    
    info "Building backend image..."
    docker compose build backend >> "$LOG_FILE" 2>&1 || error "Failed to build backend"
    
    info "Building frontend image..."
    docker compose build frontend >> "$LOG_FILE" 2>&1 || error "Failed to build frontend"
    
    info "Building IOPaint image..."
    docker compose build iopaint >> "$LOG_FILE" 2>&1 || error "Failed to build IOPaint"
    
    info "Building proxy image..."
    docker compose build iopaint-proxy >> "$LOG_FILE" 2>&1 || error "Failed to build proxy"
    
    info "All Docker images built successfully!"
    docker images | grep clearmark
}

# Function: Run Docker containers
run_docker() {
    info "Starting ClearMark with Docker Compose..."
    
    if ! docker compose version &> /dev/null; then
        error "Docker Compose v2 is required but not installed"
    fi
    
    # Create necessary directories
    mkdir -p uploads processed logs
    
    # Start services
    info "Starting all services..."
    docker compose up -d
    
    info "Waiting for services to be healthy..."
    sleep 10
    
    # Check service status
    docker compose ps
    
    info ""
    info "Services started successfully!"
    info ""
    info "Service URLs:"
    info "  - Frontend: http://localhost:3000"
    info "  - Backend API: http://localhost:8000"
    info "  - IOPaint: http://localhost:8080"
    info "  - Proxy: http://localhost:5001"
    info ""
    info "To view logs: docker compose logs -f"
    info "To stop: docker compose down"
}

# Main script
case "${1:-}" in
    "local"|"no-docker")
        start_no_docker
        ;;
    "build")
        build_docker
        ;;
    "docker"|"run"|"")
        run_docker
        ;;
    *)
        echo "Usage: $0 [local|build|docker]"
        echo ""
        echo "Commands:"
        echo "  local, no-docker  - Start services without Docker (development)"
        echo "  build             - Build Docker images"
        echo "  docker, run       - Run services with Docker Compose (default)"
        echo ""
        exit 1
        ;;
esac
