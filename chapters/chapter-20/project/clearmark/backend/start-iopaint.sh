#!/bin/sh
set -e

# Set Gradio to listen on all interfaces
export GRADIO_SERVER_NAME=0.0.0.0

# Start IOPaint
exec iopaint start --model ${MODEL:-lama} --device ${DEVICE:-cpu} --port ${PORT:-8080}

