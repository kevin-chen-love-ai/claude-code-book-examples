#!/usr/bin/env python3
"""
IOPaint API Proxy Server
This proxy bridges our frontend API calls to IOPaint's Gradio Web UI
"""

from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from PIL import Image
import io
import requests
import base64
import json
import os

app = Flask(__name__)
CORS(app)  # Enable CORS

# Disable proxy for local requests
# Remove proxy environment variables
for proxy_var in ['ALL_PROXY', 'HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'SOCKS_PROXY', 'socks_proxy']:
    if proxy_var in os.environ:
        del os.environ[proxy_var]

# IOPaint Gradio server URL
# Always prioritize environment variable if set
# In Docker Compose, IOPAINT_URL is set to http://iopaint:8080
# Outside Docker, default to localhost
IOPAINT_URL = os.getenv('IOPAINT_URL')

# If not set, detect environment
if not IOPAINT_URL:
    # Check if we're in Docker
    in_docker = False
    try:
        with open('/proc/1/cgroup', 'r') as f:
            if 'docker' in f.read():
                in_docker = True
    except:
        pass
    
    if in_docker:
        # In Docker, try multiple methods to access IOPaint
        # Method 1: Try service name (if IOPaint listens on 0.0.0.0)
        # Method 2: Try host.docker.internal (for macOS/Windows)
        # Method 3: Try direct IP (fallback)
        import socket
        try:
            # Try to resolve iopaint service name
            socket.gethostbyname('iopaint')
            IOPAINT_URL = 'http://iopaint:8080'
        except:
            # Fallback to host.docker.internal
            IOPAINT_URL = 'http://host.docker.internal:8080'
    else:
        # Outside Docker, use localhost
        IOPAINT_URL = 'http://127.0.0.1:8080'

print(f"IOPaint Proxy: Using IOPAINT_URL = {IOPAINT_URL}")
print(f"Environment IOPAINT_URL: {os.getenv('IOPAINT_URL', 'NOT SET')}")

# Create a session with no proxy
no_proxy_session = requests.Session()
no_proxy_session.proxies = {
    'http': None,
    'https': None,
}

def convert_file_to_base64(file):
    """Convert uploaded file to base64 data URL"""
    file.seek(0)
    file_data = file.read()
    file_b64 = base64.b64encode(file_data).decode('utf-8')
    mime_type = file.content_type or 'image/png'
    return f"data:{mime_type};base64,{file_b64}"

@app.route('/health', methods=['GET'])
def health():
    """Health check"""
    try:
        # Check if IOPaint is accessible (using session with no proxy)
        r = no_proxy_session.get(IOPAINT_URL, timeout=3)
        # 502 means Gradio is initializing, but server is running
        # 200 means service is fully ready
        if r.status_code == 200:
            iopaint_status = 'running'
            http_status = 200
        elif r.status_code == 502:
            # Gradio still initializing, but server is up
            iopaint_status = 'initializing'
            http_status = 503
        else:
            iopaint_status = 'error'
            http_status = 503
            
        return jsonify({
            'status': 'ok',
            'service': 'IOPaint Proxy',
            'iopaint_status': iopaint_status,
            'iopaint_http_code': r.status_code,
            'iopaint_url': IOPAINT_URL
        }), http_status
    except requests.exceptions.ConnectionError as e:
        return jsonify({
            'status': 'ok',
            'service': 'IOPaint Proxy',
            'iopaint_status': 'not_running',
            'error': 'Connection refused - IOPaint may not be running'
        }), 503
    except Exception as e:
        return jsonify({
            'status': 'ok',
            'service': 'IOPaint Proxy',
            'iopaint_status': 'not_accessible',
            'error': str(e)
        }), 503

@app.route('/api/v1/inpaint', methods=['POST'])
@app.route('/inpaint', methods=['POST'])
def inpaint():
    """
    Inpainting endpoint
    Converts multipart/form-data to Gradio API format
    """
    try:
        # Check if files are present
        if 'image' not in request.files or 'mask' not in request.files:
            return jsonify({
                'error': 'Missing image or mask file',
                'required': ['image', 'mask']
            }), 400
        
        image_file = request.files['image']
        mask_file = request.files['mask']
        
        # Validate files
        if image_file.filename == '' or mask_file.filename == '':
            return jsonify({'error': 'Empty file provided'}), 400
        
        print(f"Received image: {image_file.filename}, mask: {mask_file.filename}")
        
        # Method 1: Use IOPaint FastAPI endpoint directly
        # IOPaint uses FastAPI with /api/v1/inpaint endpoint
        # It expects JSON with base64-encoded images (data URLs)
        try:
            print(f"Calling IOPaint FastAPI: {IOPAINT_URL}/api/v1/inpaint")
            
            # Reset file pointers and read content
            image_file.seek(0)
            mask_file.seek(0)
            image_data = image_file.read()
            mask_data = mask_file.read()
            
            # Convert to base64 data URLs (IOPaint expects this format)
            image_b64 = base64.b64encode(image_data).decode('utf-8')
            mask_b64 = base64.b64encode(mask_data).decode('utf-8')
            
            # IOPaint FastAPI expects JSON with base64 data URLs
            json_data = {
                'image': f'data:image/png;base64,{image_b64}',
                'mask': f'data:image/png;base64,{mask_b64}'
            }
            
            # Call IOPaint FastAPI endpoint with JSON
            response = no_proxy_session.post(
                f"{IOPAINT_URL}/api/v1/inpaint",
                json=json_data,
                headers={'Content-Type': 'application/json'},
                timeout=120  # Increase timeout for processing
            )
            
            print(f"Response status: {response.status_code}")
            
            if response.status_code == 200:
                # IOPaint returns image bytes directly
                result_image = Image.open(io.BytesIO(response.content))
                output = io.BytesIO()
                result_image.save(output, format='PNG')
                output.seek(0)
                
                print(f"✅ Successfully processed image via IOPaint FastAPI: {result_image.size}")
                return send_file(
                    output,
                    mimetype='image/png',
                    as_attachment=False
                )
            else:
                error_text = response.text[:500] if hasattr(response, 'text') else str(response.content[:500])
                print(f"IOPaint FastAPI failed: {response.status_code} - {error_text}")
                # Don't raise, fall through to error response
                
        except Exception as e:
            print(f"Error calling IOPaint FastAPI: {e}")
            import traceback
            traceback.print_exc()
            # Fall through to error response
        
        # Method 2: Skip CLI method in Docker - we should only use HTTP API
        # Check if we're in Docker
        in_docker = False
        try:
            with open('/proc/1/cgroup', 'r') as f:
                if 'docker' in f.read():
                    in_docker = True
        except:
            pass
        
        # Only try CLI method outside Docker
        if not in_docker:
            try:
                # CLI method code here
                from subprocess import Popen, PIPE
                import tempfile
                import os
                import shutil
                
                # Check if iopaint is available
                iopaint_cmd = shutil.which('iopaint')
                if not iopaint_cmd:
                    # Try to find in venv (multiple possible paths)
                    script_dir = os.path.dirname(os.path.abspath(__file__))
                    possible_paths = [
                        os.path.join(script_dir, 'venv', 'bin', 'iopaint'),
                        os.path.join(script_dir, '..', 'venv', 'bin', 'iopaint'),
                        os.path.join(os.path.dirname(script_dir), 'venv', 'bin', 'iopaint'),
                        'server/venv/bin/iopaint',  # Known path from process list
                        'backend/venv/bin/iopaint',
                    ]
                    for venv_path in possible_paths:
                        if os.path.exists(venv_path):
                            iopaint_cmd = venv_path
                            print(f"Found IOPaint at: {iopaint_cmd}")
                            break
                
                if not iopaint_cmd:
                    raise Exception("IOPaint command not found. Please ensure IOPaint is installed in venv.")
                
                print(f"Using IOPaint CLI: {iopaint_cmd}")
                
                # Save files temporarily
                temp_dir = tempfile.mkdtemp()
                img_path = os.path.join(temp_dir, 'image.png')
                mask_path = os.path.join(temp_dir, 'mask.png')
                # Use directory for output - IOPaint CLI can output to directory or file
                output_dir = os.path.join(temp_dir, 'output')
                os.makedirs(output_dir, exist_ok=True)
                output_path = output_dir  # Use directory as output
                
                # Save image and mask
                image_file.seek(0)
                with open(img_path, 'wb') as f:
                    f.write(image_file.read())
                
                # Process mask to ensure it's in the correct format for IOPaint
                # IOPaint expects: WHITE = areas to inpaint, BLACK = areas to keep
                # Also ensure mask is grayscale (L mode)
                mask_file.seek(0)
                mask_img = Image.open(mask_file)
                
                # Convert to grayscale if needed
                if mask_img.mode != 'L':
                    mask_img = mask_img.convert('L')
                
                # Ensure mask size matches image size
                img_temp = Image.open(img_path)
                if mask_img.size != img_temp.size:
                    mask_img = mask_img.resize(img_temp.size, Image.LANCZOS)
                
                # Save processed mask
                mask_img.save(mask_path, 'PNG')
                
                # Debug: Check mask statistics
                import numpy as np
                mask_array = np.array(mask_img)
                white_pixels = np.sum(mask_array > 200)  # White areas (to inpaint)
                black_pixels = np.sum(mask_array < 50)   # Black areas (to keep)
                print(f"Mask stats: size={mask_img.size}, mode={mask_img.mode}")
                print(f"  White pixels (to inpaint): {white_pixels} ({white_pixels/mask_array.size*100:.1f}%)")
                print(f"  Black pixels (to keep): {black_pixels} ({black_pixels/mask_array.size*100:.1f}%)")
                
                print(f"Processing: {img_path} with mask {mask_path}")
                
                # Call iopaint CLI for batch processing
                # iopaint is a Python script, so we need to use the correct Python interpreter
                # Read the shebang line from iopaint script
                python_interpreter = None
                try:
                    with open(iopaint_cmd, 'r') as f:
                        first_line = f.readline().strip()
                        if first_line.startswith('#!'):
                            python_interpreter = first_line[2:]  # Remove '#!'
                            # Check if the Python interpreter exists
                            if not os.path.exists(python_interpreter):
                                # Try to find Python in the same venv
                                venv_dir = os.path.dirname(os.path.dirname(iopaint_cmd))
                                python_interpreter = os.path.join(venv_dir, 'bin', 'python3')
                                if not os.path.exists(python_interpreter):
                                    python_interpreter = os.path.join(venv_dir, 'bin', 'python')
                except:
                    pass
                
                # If we couldn't find the interpreter, use system python3
                if not python_interpreter or not os.path.exists(python_interpreter):
                    python_interpreter = shutil.which('python3') or '/usr/bin/python3'
                
                # Build command using Python interpreter
                # Use absolute paths
                img_path_abs = os.path.abspath(img_path)
                mask_path_abs = os.path.abspath(mask_path)
                output_path_abs = os.path.abspath(output_path)
                iopaint_cmd_abs = os.path.abspath(iopaint_cmd)
                
                cmd = [
                    python_interpreter,
                    iopaint_cmd_abs,
                    'run',
                    '--model', 'lama',
                    '--device', 'cpu',
                    '--image', img_path_abs,
                    '--mask', mask_path_abs,
                    '--output', output_path_abs
                ]
                
                print(f"Running command: {' '.join(cmd)}")
                print(f"Python interpreter: {python_interpreter}")
                print(f"Working directory: {os.path.dirname(img_path)}")
                
                # Set environment without proxy
                env = os.environ.copy()
                for proxy_var in ['ALL_PROXY', 'HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'SOCKS_PROXY', 'socks_proxy']:
                    if proxy_var in env:
                        del env[proxy_var]
                
                process = Popen(cmd, stdout=PIPE, stderr=PIPE, 
                              cwd=os.path.dirname(img_path),  # Use temp dir as working directory
                              env=env)
                stdout, stderr = process.communicate(timeout=120)
                
                print(f"IOPaint exit code: {process.returncode}")
                if stdout:
                    print(f"Stdout: {stdout.decode()[:200]}")
                if stderr:
                    print(f"Stderr: {stderr.decode()[:200]}")
                
                if process.returncode == 0:
                    # Find the output file - could be a file or directory
                    result_file = None
                    if os.path.isfile(output_path):
                        result_file = output_path
                    elif os.path.isdir(output_path):
                        # If output is a directory, find the result file
                        # IOPaint might create files with original name + "_inpainted"
                        files = [f for f in os.listdir(output_path) if f.endswith(('.png', '.jpg', '.jpeg', '.webp'))]
                        if files:
                            result_file = os.path.join(output_path, files[0])
                        else:
                            # Look for inpainted file
                            inpainted_file = os.path.join(output_path, 'image_inpainted.png')
                            if os.path.exists(inpainted_file):
                                result_file = inpainted_file
                    elif os.path.exists(output_path):
                        # Try as file first
                        try:
                            with open(output_path, 'rb') as test:
                                test.read(1)
                            result_file = output_path
                        except:
                            pass
                    
                    if result_file and os.path.exists(result_file) and os.path.isfile(result_file):
                        # Read and validate result
                        with open(result_file, 'rb') as f:
                            result_data = f.read()
                        
                        # Validate result is not empty
                        if len(result_data) == 0:
                            print("⚠️ Warning: Result file is empty!")
                            raise Exception("Result file is empty")
                        
                        # Check if result is a valid image
                        try:
                            result_img = Image.open(io.BytesIO(result_data))
                            print(f"✅ Success! Result: {result_img.size}, mode={result_img.mode}, size={len(result_data)} bytes")
                            
                            # Verify result is not all black
                            img_array = np.array(result_img.convert('RGB'))
                            avg_brightness = np.mean(img_array)
                            print(f"  Average brightness: {avg_brightness:.1f} (should be > 0 if not black)")
                            
                            if avg_brightness < 1:
                                print("⚠️ Warning: Result appears to be all black!")
                            
                            # Compare with original image to ensure they're different
                            original_img = Image.open(img_path)
                            original_array = np.array(original_img.convert('RGB'))
                            original_brightness = np.mean(original_array)
                            
                            # Check if result is significantly different from original
                            # (simple check: compare average brightness and pixel differences)
                            if np.array_equal(img_array, original_array):
                                print("⚠️ Warning: Result appears to be identical to original image!")
                                raise Exception("Result image is identical to original - processing may have failed")
                            
                            # Calculate pixel difference
                            pixel_diff = np.sum(np.abs(img_array.astype(int) - original_array.astype(int)))
                            print(f"  Pixel difference from original: {pixel_diff}")
                            
                            if pixel_diff < 1000:  # Very small difference
                                print("⚠️ Warning: Result is very similar to original - processing may not have worked")
                                raise Exception("Result image is too similar to original - processing may have failed")
                            
                            print(f"✅ Result is different from original - processing successful")
                            
                        except Exception as e:
                            print(f"⚠️ Warning: Could not validate result image: {e}")
                            # Don't cleanup yet for debugging
                            raise
                        
                        # Cleanup
                        shutil.rmtree(temp_dir)
                        
                        return send_file(
                            io.BytesIO(result_data),
                            mimetype='image/png',
                            as_attachment=False
                        )
                    else:
                        # Try to find any output file in temp directory
                        for root, dirs, files in os.walk(temp_dir):
                            for file in files:
                                if file.endswith(('.png', '.jpg', '.jpeg')) and 'result' in file.lower():
                                    result_file = os.path.join(root, file)
                                    with open(result_file, 'rb') as f:
                                        result_data = f.read()
                                    shutil.rmtree(temp_dir)
                                    return send_file(
                                        io.BytesIO(result_data),
                                        mimetype='image/png',
                                        as_attachment=False
                                    )
                        
                        # If we can't find the output file, try listing temp directory
                        print(f"⚠️ Output file not found at {output_path}")
                        print(f"Temp directory contents: {os.listdir(temp_dir) if os.path.exists(temp_dir) else 'N/A'}")
                        # Don't raise, fall through to error
                else:
                    error_msg = stderr.decode() if stderr else stdout.decode() if stdout else 'Unknown error'
                    print(f"❌ IOPaint CLI error: {error_msg}")
                    # Don't raise, fall through to alternative
                
            except Exception as e:
                print(f"❌ IOPaint CLI error: {e}")
                import traceback
                traceback.print_exc()
                # Fall through to error response - CLI method failed, continue to error response
        
        # If all methods fail
        return jsonify({
            'error': 'Failed to process image',
            'message': 'Could not connect to IOPaint API. Please ensure IOPaint is running.',
            'suggestions': [
                'Check if IOPaint is running: curl http://localhost:8080',
                'Try accessing IOPaint Web UI: http://localhost:8080',
                'Check IOPaint logs for errors'
            ]
        }), 500
        
    except Exception as e:
        print(f"Error in inpaint endpoint: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'message': 'Failed to process image'
        }), 500

if __name__ == '__main__':
    import sys
    
    # Try to find available port
    PORT = 5001  # Use 5001 to avoid macOS AirPlay conflict
    if len(sys.argv) > 1:
        PORT = int(sys.argv[1])
    
    # Final override: always use environment variable if set (for Docker)
    if 'IOPAINT_URL' in os.environ:
        IOPAINT_URL = os.environ['IOPAINT_URL']
    
    print("Starting IOPaint API Proxy Server...")
    print(f"Proxying to IOPaint at: {IOPAINT_URL}")
    print(f"Environment IOPAINT_URL: {os.getenv('IOPAINT_URL', 'NOT SET')}")
    print("Endpoints available:")
    print("  - POST /api/v1/inpaint")
    print("  - POST /inpaint")
    print("  - GET  /health")
    print(f"\nServer running on http://localhost:{PORT}")
    print("Press Ctrl+C to stop")
    
    try:
        app.run(host='0.0.0.0', port=PORT, debug=True)
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"\n❌ Port {PORT} is in use")
            print("Try using a different port:")
            print(f"  python3 iopaint-proxy.py 5002")
            sys.exit(1)
        raise
