#!/bin/sh
set -e

echo "Cleaning up broken numpy installation..."
rm -rf /usr/local/lib/python3.11/site-packages/~umpy* 2>/dev/null || true
pip uninstall -y numpy 2>/dev/null || true

echo "Installing numpy..."
pip install --force-reinstall numpy==1.24.3 --quiet

echo "Installing rembg..."
pip install rembg==2.0.50 --quiet

echo "Verifying rembg installation..."
python -c "import rembg; print('rembg imported successfully')" || {
    echo "ERROR: rembg import failed"
    exit 1
}

echo "Starting uvicorn..."
exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}

