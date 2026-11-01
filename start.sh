#!/usr/bin/env bash
# Startup script for Private Legal Document Triage Agent

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/services/api"
FRONTEND_DIR="$PROJECT_ROOT/apps/app"

echo "=========================================================="
echo " Starting Private Legal Document Triage Agent..."
echo "=========================================================="

# Check if Ollama is running
if curl -s http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
    echo "✓ Ollama is running on http://127.0.0.1:11434"
else
    echo "⚠ Notice: Ollama does not appear to be running on port 11434."
    echo "  You can start it in a separate terminal with: ollama serve"
fi

# Function to stop background processes on exit
cleanup() {
    echo ""
    echo "Shutting down servers..."
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Start Backend API
echo "Starting FastAPI backend on http://127.0.0.1:8000 ..."
cd "$BACKEND_DIR"
python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

# Wait for backend to be ready
echo "Waiting for backend to initialize..."
sleep 2

# Start Frontend Next.js
echo "Starting Next.js frontend on http://localhost:3000 ..."
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "=========================================================="
echo " Web application is ready!"
echo " Open your browser at: http://localhost:3000"
echo " Backend API running at: http://127.0.0.1:8000"
echo " Press Ctrl+C to stop both servers."
echo "=========================================================="
echo ""

# Wait for both processes
wait
