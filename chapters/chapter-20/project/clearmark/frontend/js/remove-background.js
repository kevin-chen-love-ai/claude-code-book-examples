// Remove Background Handler using rembg API
let currentImageFile = null;
let processedImageUrl = null;
let isProcessing = false;

// Backend API endpoint
// Try to detect API URL from environment or use default
function getAPIBaseURL() {
    // Check if API URL is set in meta tag or window config
    const apiUrlMeta = document.querySelector('meta[name="api-url"]');
    if (apiUrlMeta) {
        return apiUrlMeta.getAttribute('content');
    }
    
    // Check window.config
    if (window.config && window.config.API_URL) {
        return window.config.API_URL;
    }
    
    // Check window.env
    if (window.env && window.env.API_URL) {
        return window.env.API_URL;
    }
    
    // Default: use same origin for production, localhost:8000 for development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:8000';
    }
    
    // For production, assume API is on same origin
    return window.location.origin;
}

const API_BASE_URL = getAPIBaseURL();

// Check API health on page load
async function checkAPIHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/remove-background/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000) // 3 second timeout
        });
        if (response.ok) {
            const health = await response.json();
            console.log('Remove background API is available:', health);
            return health.status === 'ok';
        }
    } catch (error) {
        // Silently handle health check failures (network issues, etc.)
        // Don't show notification to avoid user confusion
        // Remove background API is independent and doesn't need IOPaint proxy
        console.warn('Remove background API health check failed (this is OK if backend is starting):', error.message);
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
        
        // Display original image
        const originalImage = document.getElementById('originalImage');
        if (originalImage) {
            originalImage.src = imageUrl;
        }
        
        // Scroll to process section
        document.getElementById('processSection').scrollIntoView({ behavior: 'smooth' });
    };

    reader.readAsDataURL(file);
}

async function processImage() {
    if (isProcessing) {
        showNotification('Processing already in progress. Please wait...', 'info');
        return;
    }

    if (!currentImageFile) {
        showNotification('Please upload an image first', 'error');
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
        document.getElementById('processStatus').innerHTML = `
            <span class="status-dot"></span>
            <span>Removing background...</span>
        `;
    }

    try {
        // Prepare form data
        const formData = new FormData();
        formData.append('file', currentImageFile);
        
        // Update progress
        document.getElementById('progressFill').style.width = '50%';
        
        // Call Remove Background API
        console.log('Calling remove background API: /api/v1/remove-background');
        
        const response = await fetch(`${API_BASE_URL}/api/v1/remove-background`, {
            method: 'POST',
            body: formData,
        });
        
        if (!response.ok) {
            // Try to get error message from response
            let errorText = '';
            try {
                const errorData = await response.text();
                if (errorData) {
                    try {
                        const errorJson = JSON.parse(errorData);
                        errorText = errorJson.detail || errorJson.error || errorJson.message || errorData.substring(0, 200);
                    } catch (e) {
                        errorText = errorData.substring(0, 200);
                    }
                }
            } catch (e) {
                // Ignore
            }
            
            throw new Error(`API returned ${response.status} ${response.statusText}${errorText ? ': ' + errorText : ''}`);
        }
        
        console.log('✅ Successfully connected to remove background API');
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        // Update progress
        document.getElementById('progressFill').style.width = '80%';
        
        // Get processed image
        const resultBlob = await response.blob();
        
        // Validate result is an image
        if (!resultBlob.type.startsWith('image/')) {
            throw new Error('Invalid response: expected image, got ' + resultBlob.type);
        }
        
        // Create object URL for processed image
        processedImageUrl = URL.createObjectURL(resultBlob);
        
        // Update progress
        document.getElementById('progressFill').style.width = '100%';
        
        // Update status
        if (statusContainer) {
            document.getElementById('processStatus').innerHTML = `
                <span class="status-dot" style="background-color: #10b981;"></span>
                <span>Background removed successfully!</span>
            `;
        }
        
        // Show comparison view
        const compareView = document.getElementById('compareView');
        if (compareView) {
            compareView.style.display = 'flex';
            
            // Set original image
            const originalImageResult = document.getElementById('originalImageResult');
            if (originalImageResult) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    originalImageResult.src = e.target.result;
                };
                reader.readAsDataURL(currentImageFile);
            }
            
            // Set processed image
            const processedImage = document.getElementById('processedImage');
            if (processedImage) {
                processedImage.src = processedImageUrl;
            }
        }
        
        // Show action buttons
        const actionButtons = document.getElementById('actionButtons');
        if (actionButtons) {
            actionButtons.style.display = 'flex';
        }
        
        // Hide progress bar after a delay
        setTimeout(() => {
            document.getElementById('progressBar').style.display = 'none';
        }, 1000);
        
        // Scroll to result
        if (compareView) {
            compareView.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        
        showNotification('Background removed successfully!', 'success');
        
    } catch (error) {
        console.error('Error processing image:', error);
        showNotification(`Error: ${error.message}`, 'error');
        
        // Update status
        if (statusContainer) {
            document.getElementById('processStatus').innerHTML = `
                <span class="status-dot" style="background-color: #ef4444;"></span>
                <span>Error: ${error.message}</span>
            `;
        }
        
        // Hide progress bar
        document.getElementById('progressBar').style.display = 'none';
    } finally {
        isProcessing = false;
        processBtn.disabled = false;
        processBtn.textContent = 'Remove Background';
    }
}

function downloadImage() {
    if (!processedImageUrl) {
        showNotification('No processed image available', 'error');
        return;
    }
    
    // Create download link
    const link = document.createElement('a');
    link.href = processedImageUrl;
    link.download = `removed_background_${currentImageFile.name.replace(/\.[^/.]+$/, '')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('Image downloaded!', 'success');
}

function resetUpload() {
    // Reset all state
    currentImageFile = null;
    processedImageUrl = null;
    isProcessing = false;
    
    // Clear file input
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.value = '';
    }
    
    // Hide process section
    document.getElementById('processSection').style.display = 'none';
    
    // Hide comparison view
    const compareView = document.getElementById('compareView');
    if (compareView) {
        compareView.style.display = 'none';
    }
    
    // Hide action buttons
    const actionButtons = document.getElementById('actionButtons');
    if (actionButtons) {
        actionButtons.style.display = 'none';
    }
    
    // Hide progress bar
    document.getElementById('progressBar').style.display = 'none';
    
    // Reset status
    const statusContainer = document.getElementById('processStatusContainer');
    if (statusContainer) {
        statusContainer.style.display = 'none';
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    showNotification('Ready for new upload', 'info');
}

