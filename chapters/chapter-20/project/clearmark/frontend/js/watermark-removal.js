// Watermark Removal Handler using IOPaint API
let maskDrawer = null;
let currentImageFile = null;
let processedImageUrl = null;
let isProcessing = false;

// IOPaint API endpoint (adjust according to your setup)
// Using proxy server to bridge Gradio API format
// In production, use relative path to go through Caddy reverse proxy
// In development, use localhost
const IOPAINT_API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:5001'  // Development: direct connection
    : '/iopaint';  // Production: through Caddy reverse proxy
// Original IOPaint URL (for health check)
const IOPAINT_ORIGINAL_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8080'  // Development
    : '/iopaint';  // Production: through Caddy

// Check API health on page load
async function checkAPIHealth() {
    try {
        // Check proxy server health
        const response = await fetch(`${IOPAINT_API_URL}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000) // 3 second timeout
        });
        if (response.ok) {
            const health = await response.json();
            console.log('Proxy server is available:', health);
            
            // Check IOPaint status through proxy
            if (health.iopaint_status === 'running') {
                console.log('✅ IOPaint is running');
                return true;
            } else {
                // Only show detailed warnings in development environment
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                    showNotification('Warning: IOPaint service is not running. Please start the service first.', 'warning');
                }
                return false;
            }
        }
    } catch (error) {
        console.warn('API health check failed:', error);
        // Only show detailed warnings in development environment, silent in production
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            showNotification('Warning: Processing service is not running. Please start IOPaint and proxy server.', 'warning');
        }
        return false;
    }
    return false;
}

// Initialize file input handler
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');

    // Drag and drop handlers
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('active');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('active');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('active');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    });

    // File input change handler
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });

    // Check API health on load
    checkAPIHealth();
});

function handleFileUpload(file) {
    // Validate file type
    if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/)) {
        showNotification('Please upload a valid image file (JPG, PNG, WEBP)', 'error');
        return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
        showNotification('File size must be less than 10MB', 'error');
        return;
    }

    // Show loading state
    showNotification('Loading image...', 'info');

    currentImageFile = file;
    const reader = new FileReader();

    reader.onload = (e) => {
        const imageUrl = e.target.result;
        
        // Show process section
        document.getElementById('processSection').style.display = 'block';
        
        // Initialize mask drawer
        initializeMaskDrawer(imageUrl);
        
        // Scroll to process section
        document.getElementById('processSection').scrollIntoView({ behavior: 'smooth' });
    };

    reader.readAsDataURL(file);
}

function initializeMaskDrawer(imageUrl) {
    const canvas = document.getElementById('maskCanvas');
    
    // Wait for canvas to be visible
    setTimeout(() => {
        maskDrawer = new MaskDrawer('maskCanvas', imageUrl);
        
        // Hide status initially - only show when processing starts
        const statusContainer = document.getElementById('processStatusContainer');
        if (statusContainer) {
            statusContainer.style.display = 'none';
        }
    }, 100);
}

function switchMode(mode) {
    if (!maskDrawer) return;
    
    maskDrawer.setMode(mode);
    
    // Update button states
    document.getElementById('drawBtn').classList.toggle('active', mode === 'draw');
    document.getElementById('eraseBtn').classList.toggle('active', mode === 'erase');
}

function updateBrushSize(value) {
    if (!maskDrawer) return;
    
    maskDrawer.setBrushSize(parseInt(value));
    document.getElementById('brushSizeValue').textContent = value;
}

function clearMask() {
    if (!maskDrawer) return;
    
    // Clear mask directly without confirmation
    maskDrawer.clearMask();
    showNotification('Mask cleared', 'info');
}

function undoMask() {
    if (!maskDrawer) return;
    
    if (maskDrawer.undo()) {
        showNotification('Undone', 'info');
    } else {
        showNotification('Nothing to undo', 'info');
    }
}

function redoMask() {
    if (!maskDrawer) return;
    
    if (maskDrawer.redo()) {
        showNotification('Redone', 'info');
    } else {
        showNotification('Nothing to redo', 'info');
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl+Z or Cmd+Z for undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoMask();
    }
    // Ctrl+Shift+Z or Cmd+Shift+Z for redo
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' && e.shiftKey || e.key === 'y')) {
        e.preventDefault();
        redoMask();
    }
});

async function processImage() {
    if (isProcessing) {
        showNotification('Processing already in progress. Please wait...', 'info');
        return;
    }

    if (!maskDrawer || !currentImageFile) {
        showNotification('Please upload an image and draw a mask first', 'error');
        return;
    }

    // Check if mask has any drawing
    const maskDataUrl = maskDrawer.exportMask();
    const hasMask = await checkMaskHasContent(maskDataUrl);
    
    if (!hasMask) {
        showNotification('Please draw a mask on the watermark area first', 'error');
        return;
    }

    isProcessing = true;
    const processBtn = document.getElementById('processBtn');
    processBtn.disabled = true;
    processBtn.textContent = 'Processing...';
    
    // Show progress
    document.getElementById('progressBar').style.display = 'block';
    document.getElementById('progressFill').style.width = '30%';
    
    // Show and update status
    const statusContainer = document.getElementById('processStatusContainer');
    if (statusContainer) {
        statusContainer.style.display = 'block';
    }
    document.getElementById('processStatus').innerHTML = `
        <span class="status-dot"></span>
        <span>Processing with IOPaint...</span>
    `;

    try {
        // Convert mask to blob
        const maskBlob = await dataURLtoBlob(maskDataUrl);
        
        // Prepare form data
        const formData = new FormData();
        formData.append('image', currentImageFile);
        formData.append('mask', maskBlob, 'mask.png');
        
        // Update progress
        document.getElementById('progressFill').style.width = '50%';
        
        // Call Proxy API (which bridges to IOPaint)
        // Proxy server handles the conversion from standard API to IOPaint CLI
        console.log('Calling proxy API: /api/v1/inpaint');
        
        const response = await fetch(`${IOPAINT_API_URL}/api/v1/inpaint`, {
            method: 'POST',
            body: formData,
            // Don't set Content-Type header - let browser set it with boundary for multipart/form-data
        });
        
        if (!response.ok) {
            // Try to get error message from response
            let errorText = '';
            try {
                const errorData = await response.text();
                if (errorData) {
                    try {
                        const errorJson = JSON.parse(errorData);
                        errorText = errorJson.error || errorJson.message || errorData.substring(0, 200);
                    } catch (e) {
                        errorText = errorData.substring(0, 200);
                    }
                }
            } catch (e) {
                // Ignore
            }
            
            throw new Error(`API returned ${response.status} ${response.statusText}${errorText ? ': ' + errorText : ''}`);
        }
        
        console.log('✅ Successfully connected to proxy API');
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        // Update progress
        document.getElementById('progressFill').style.width = '80%';
        
        // Get processed image
        const resultBlob = await response.blob();
        
        // Validate result is an image
        if (resultBlob.size === 0) {
            throw new Error('API returned empty result');
        }
        
        console.log('Result blob size:', resultBlob.size, 'bytes');
        console.log('Result blob type:', resultBlob.type);
        
        // Check if response is actually an image
        const contentType = response.headers.get('content-type');
        console.log('Content-Type header:', contentType);
        
        if (contentType && !contentType.startsWith('image/')) {
            // Might be JSON error message
            const errorText = await resultBlob.text();
            try {
                const errorJson = JSON.parse(errorText);
                throw new Error(errorJson.error || errorJson.message || 'API returned error: ' + errorText);
            } catch (e) {
                throw new Error('API returned non-image response: ' + errorText.substring(0, 200));
            }
        }
        
        // Verify the blob is actually an image by creating an image object
        const testImg = new Image();
        const testUrl = URL.createObjectURL(resultBlob);
        await new Promise((resolve, reject) => {
            testImg.onload = () => {
                console.log('✅ Result is a valid image:', testImg.width, 'x', testImg.height);
                URL.revokeObjectURL(testUrl);
                resolve();
            };
            testImg.onerror = () => {
                URL.revokeObjectURL(testUrl);
                reject(new Error('Result blob is not a valid image'));
            };
            testImg.src = testUrl;
        });
        
        processedImageUrl = URL.createObjectURL(resultBlob);
        console.log('✅ Processed image URL created:', processedImageUrl);
        
        // Display results
        document.getElementById('progressFill').style.width = '100%';
        const originalImageUrl = URL.createObjectURL(currentImageFile);
        document.getElementById('originalImage').src = originalImageUrl;
        document.getElementById('processedImage').src = processedImageUrl;
        
        // Log for debugging
        console.log('Original image URL:', originalImageUrl);
        console.log('Processed image URL:', processedImageUrl);
        document.getElementById('compareView').style.display = 'grid';
        document.getElementById('actionButtons').style.display = 'flex';
        document.getElementById('progressBar').style.display = 'none';
        
        // Update status
        document.getElementById('processStatus').innerHTML = `
            <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--success); display: inline-block;"></span>
            <span>Processing complete</span>
        `;
        
        showNotification('Image processed successfully!', 'success');
        
    } catch (error) {
        console.error('Processing error:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        
        let errorMessage = 'Failed to process image.';
        
        // Network errors
        if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
            errorMessage = 'Cannot connect to processing service.';
            errorMessage += '\n\nPlease ensure the following services are running:';
            errorMessage += '\n\n1. Start IOPaint service (port 8080):';
            errorMessage += '\n   cd backend && source venv/bin/activate && iopaint start --model=lama --device=cpu --port=8080';
            errorMessage += '\n\n2. Start proxy server (port 5001):';
            errorMessage += '\n   cd backend && python3 iopaint-proxy.py 5001';
            errorMessage += '\n\nOr use the start script:';
            errorMessage += '\n   ./scripts/start.sh';
        } 
        // Timeout errors
        else if (error.message.includes('timeout') || error.message.includes('AbortSignal')) {
            errorMessage = 'Request timeout. The image may be too large or the service is responding slowly.';
        }
        // API errors
        else if (error.message.includes('All API endpoints failed')) {
            errorMessage = 'All API endpoints failed to connect.';
            errorMessage += '\nPlease check if IOPaint service is running.';
            errorMessage += '\nStart command: iopaint start --model=lama --device=cpu --port=8080';
        }
        // Empty response
        else if (error.message.includes('empty result') || error.message.includes('empty response')) {
            errorMessage = 'API returned empty result. The service may not be configured correctly.';
        }
        // Other errors
        else {
            errorMessage += error.message || 'Unknown error.';
        }
        
        // Show detailed error in console
        console.error('Detailed error information:', errorMessage);
        
        // Show notification with formatted message
        showNotification(errorMessage.replace(/\n/g, ' '), 'error');
        
        document.getElementById('progressBar').style.display = 'none';
        
        // Show status container if not already shown
        const statusContainer = document.getElementById('processStatusContainer');
        if (statusContainer) {
            statusContainer.style.display = 'block';
        }
        
        document.getElementById('processStatus').innerHTML = `
            <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--error); display: inline-block;"></span>
            <span>Processing failed - Please check browser console for detailed information</span>
        `;
    } finally {
        isProcessing = false;
        processBtn.disabled = false;
        processBtn.textContent = 'Process Image';
    }
}

// Check if mask has content (not just black background)
// Mask format: WHITE = areas to inpaint, BLACK = areas to keep
async function checkMaskHasContent(maskDataUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // Check if there are any white pixels (mask areas to inpaint)
            // White pixels = watermark areas to be removed
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                // If pixel is white (all 255 or close to 255), it's part of the mask to inpaint
                if (r > 200 && g > 200 && b > 200) {
                    resolve(true);
                    return;
                }
            }
            resolve(false);
        };
        img.src = maskDataUrl;
    });
}

// Show notification toast
function showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.getElementById('notification');
    if (existing) {
        existing.remove();
    }
    
    const notification = document.createElement('div');
    notification.id = 'notification';
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

function dataURLtoBlob(dataurl) {
    return new Promise((resolve) => {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        resolve(new Blob([u8arr], { type: mime }));
    });
}

function downloadImage() {
    if (!processedImageUrl) {
        showNotification('No processed image available', 'error');
        return;
    }

    try {
        const link = document.createElement('a');
        link.href = processedImageUrl;
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `clearmark_${timestamp}_${currentImageFile.name}`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('Image downloaded successfully!', 'success');
    } catch (error) {
        console.error('Download error:', error);
        showNotification('Failed to download image', 'error');
    }
}

function resetUpload() {
    // Reset all state
    currentImageFile = null;
    processedImageUrl = null;
    maskDrawer = null;
    
    // Hide process section
    document.getElementById('processSection').style.display = 'none';
    document.getElementById('compareView').style.display = 'none';
    document.getElementById('actionButtons').style.display = 'none';
    document.getElementById('progressBar').style.display = 'none';
    
    // Hide status container
    const statusContainer = document.getElementById('processStatusContainer');
    if (statusContainer) {
        statusContainer.style.display = 'none';
    }
    
    // Reset file input
    document.getElementById('fileInput').value = '';
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
