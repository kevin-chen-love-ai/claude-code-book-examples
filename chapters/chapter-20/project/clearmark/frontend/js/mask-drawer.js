// Mask Drawing Canvas Handler
class MaskDrawer {
    constructor(canvasId, imageSrc) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        this.brushSize = 20;
        this.mode = 'draw'; // 'draw' or 'erase'
        this.image = new Image();
        this.imageLoaded = false;
        this.lastX = 0;
        this.lastY = 0;

        // Create separate canvas for mask layer
        this.maskCanvas = document.createElement('canvas');
        this.maskCtx = this.maskCanvas.getContext('2d');

        // Undo/Redo history
        this.history = []; // Array of mask canvas states (ImageData)
        this.historyIndex = -1; // Current position in history
        this.maxHistorySize = 50; // Limit history size

        this.setupCanvas(imageSrc);
        this.setupEventListeners();
        this.updateCursor();
    }

    setupCanvas(imageSrc) {
        this.image.onload = () => {
            // Calculate display size to fill container while maintaining aspect ratio
            const container = this.canvas.parentElement;
            const containerWidth = container.clientWidth;
            const containerHeight = window.innerHeight * 0.7; // Use 70% of viewport height

            const imageAspect = this.image.width / this.image.height;
            const containerAspect = containerWidth / containerHeight;

            let displayWidth, displayHeight;

            if (imageAspect > containerAspect) {
                // Image is wider - fit to width
                displayWidth = containerWidth;
                displayHeight = displayWidth / imageAspect;
            } else {
                // Image is taller - fit to height
                displayHeight = containerHeight;
                displayWidth = displayHeight * imageAspect;
            }

            // Set canvas display size (CSS) - fill container
            this.canvas.style.width = displayWidth + 'px';
            this.canvas.style.height = displayHeight + 'px';
            this.canvas.style.maxWidth = '100%';
            this.canvas.style.maxHeight = '100%';
            this.canvas.style.margin = '0 auto';
            this.canvas.style.display = 'block';
            this.canvas.style.objectFit = 'contain';

            // Set canvas internal size to match image (for high quality)
            this.canvas.width = this.image.width;
            this.canvas.height = this.image.height;

            // Set mask canvas size
            this.maskCanvas.width = this.image.width;
            this.maskCanvas.height = this.image.height;

            // Initialize history with empty mask
            this.saveState();

            // Draw initial state
            this.redraw();

            this.imageLoaded = true;
        };

        this.image.src = imageSrc;
    }

    redraw() {
        // Clear main canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw original image
        this.ctx.drawImage(this.image, 0, 0);

        // Draw mask overlay on top
        this.ctx.drawImage(this.maskCanvas, 0, 0);
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseleave', () => this.stopDrawing());

        // Update cursor when entering canvas
        this.canvas.addEventListener('mouseenter', () => this.updateCursor());

        // Touch events for mobile
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const mouseEvent = new MouseEvent('mouseup', {});
            this.canvas.dispatchEvent(mouseEvent);
        });
    }

    updateCursor() {
        // Create custom brush cursor with feathered black dot
        const size = Math.min(this.brushSize, 50); // Cap display size at 50px
        const cursorSize = Math.max(size, 12);

        // Create SVG cursor with radial gradient for feathering effect
        const svg = `
            <svg width="${cursorSize}" height="${cursorSize}" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <radialGradient id="brush-gradient">
                        <stop offset="0%" style="stop-color:black;stop-opacity:1" />
                        <stop offset="60%" style="stop-color:black;stop-opacity:0.8" />
                        <stop offset="80%" style="stop-color:black;stop-opacity:0.4" />
                        <stop offset="100%" style="stop-color:black;stop-opacity:0" />
                    </radialGradient>
                </defs>
                <circle cx="${cursorSize/2}" cy="${cursorSize/2}" r="${(cursorSize-2)/2}"
                    fill="url(#brush-gradient)"/>
            </svg>
        `;

        const encodedSvg = 'data:image/svg+xml;base64,' + btoa(svg);
        this.canvas.style.cursor = `url('${encodedSvg}') ${cursorSize/2} ${cursorSize/2}, crosshair`;
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    startDrawing(e) {
        if (!this.imageLoaded) return;
        
        // Save state when starting a new drawing stroke
        // Only save if this is a new stroke (not continuing previous stroke)
        if (!this.isDrawing) {
            // Save current state before starting new stroke (only if at end of history)
            if (this.historyIndex === this.history.length - 1) {
                this.saveState();
            }
        }
        
        this.isDrawing = true;
        const pos = this.getMousePos(e);
        this.lastX = pos.x;
        this.lastY = pos.y;
        this.drawAt(pos.x, pos.y);
    }

    draw(e) {
        if (!this.isDrawing || !this.imageLoaded) return;
        const pos = this.getMousePos(e);

        // Draw smooth line from last position to current position
        this.drawLine(this.lastX, this.lastY, pos.x, pos.y);

        this.lastX = pos.x;
        this.lastY = pos.y;
    }

    drawLine(x1, y1, x2, y2) {
        const radius = this.brushSize / 2;

        if (this.mode === 'draw') {
            // Draw red mask overlay
            this.maskCtx.globalCompositeOperation = 'source-over';
            this.maskCtx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            this.maskCtx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        } else {
            // Erase mode: only remove mask pixels, not original image
            this.maskCtx.globalCompositeOperation = 'destination-out';
            this.maskCtx.fillStyle = 'rgba(255, 255, 255, 1)';
            this.maskCtx.strokeStyle = 'rgba(255, 255, 255, 1)';
        }

        // Draw circle at start point
        this.maskCtx.beginPath();
        this.maskCtx.arc(x1, y1, radius, 0, Math.PI * 2);
        this.maskCtx.fill();

        // Draw line between points if they are far enough apart
        const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        if (distance > 1) {
            this.maskCtx.beginPath();
            this.maskCtx.lineWidth = this.brushSize;
            this.maskCtx.lineCap = 'round';
            this.maskCtx.lineJoin = 'round';
            this.maskCtx.moveTo(x1, y1);
            this.maskCtx.lineTo(x2, y2);
            this.maskCtx.stroke();
        }

        // Draw circle at end point
        this.maskCtx.beginPath();
        this.maskCtx.arc(x2, y2, radius, 0, Math.PI * 2);
        this.maskCtx.fill();

        // Redraw main canvas with updated mask
        this.redraw();
    }
    
    // Save current mask state to history
    saveState() {
        // Remove any states after current index (when we're not at the end)
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        // Save current mask state
        const imageData = this.maskCtx.getImageData(0, 0, this.maskCanvas.width, this.maskCanvas.height);
        this.history.push(imageData);
        this.historyIndex = this.history.length - 1;
        
        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            this.historyIndex--;
        }
        
        // Update button states
        this.updateHistoryButtons();
    }
    
    // Restore mask state from history
    restoreState(imageData) {
        this.maskCtx.putImageData(imageData, 0, 0);
        this.redraw();
        this.updateHistoryButtons();
    }
    
    // Update undo/redo button states
    updateHistoryButtons() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        
        if (undoBtn) {
            undoBtn.disabled = this.historyIndex <= 0;
            undoBtn.classList.toggle('disabled', this.historyIndex <= 0);
        }
        
        if (redoBtn) {
            redoBtn.disabled = this.historyIndex >= this.history.length - 1;
            redoBtn.classList.toggle('disabled', this.historyIndex >= this.history.length - 1);
        }
    }
    
    // Undo last action
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const state = this.history[this.historyIndex];
            this.restoreState(state);
            return true;
        }
        return false;
    }
    
    // Redo last undone action
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const state = this.history[this.historyIndex];
            this.restoreState(state);
            return true;
        }
        return false;
    }

    drawAt(x, y) {
        this.lastX = x;
        this.lastY = y;
        const radius = this.brushSize / 2;

        if (this.mode === 'draw') {
            this.maskCtx.globalCompositeOperation = 'source-over';
            this.maskCtx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        } else {
            this.maskCtx.globalCompositeOperation = 'destination-out';
            this.maskCtx.fillStyle = 'rgba(255, 255, 255, 1)';
        }

        this.maskCtx.beginPath();
        this.maskCtx.arc(x, y, radius, 0, Math.PI * 2);
        this.maskCtx.fill();

        // Redraw main canvas
        this.redraw();
    }

    stopDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
            // Save state when drawing stops
            this.saveState();
            this.lastX = 0;
            this.lastY = 0;
        }
    }

    setBrushSize(size) {
        this.brushSize = size;
        this.updateCursor();
    }

    setMode(mode) {
        this.mode = mode;
        this.updateCursor();
    }

    clearMask() {
        if (!this.imageLoaded) return;

        // Clear mask canvas (no confirmation needed)
        this.maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);

        // Save state after clearing
        this.saveState();

        // Redraw to show original image without mask
        this.redraw();
    }

    getMaskImage() {
        // Create a mask canvas with black background and white mask areas
        // IOPaint expects: WHITE = areas to inpaint (remove/fix), BLACK = areas to keep
        const outputMask = document.createElement('canvas');
        outputMask.width = this.canvas.width;
        outputMask.height = this.canvas.height;
        const outputCtx = outputMask.getContext('2d');

        // Draw black background (areas to keep)
        outputCtx.fillStyle = 'black';
        outputCtx.fillRect(0, 0, outputMask.width, outputMask.height);

        // Get the mask canvas image data
        const imageData = this.maskCtx.getImageData(0, 0, this.maskCanvas.width, this.maskCanvas.height);
        const data = imageData.data;

        // Process pixel by pixel to find red overlay areas
        // Red overlay areas = watermark areas = should be WHITE in final mask (to inpaint)
        for (let y = 0; y < this.maskCanvas.height; y++) {
            for (let x = 0; x < this.maskCanvas.width; x++) {
                const pixelIndex = (y * this.maskCanvas.width + x) * 4;
                const r = data[pixelIndex];
                const g = data[pixelIndex + 1];
                const b = data[pixelIndex + 2];
                const a = data[pixelIndex + 3];

                // Check if pixel has red overlay (marking watermark to remove/inpaint)
                // If red overlay exists, mark as WHITE (area to inpaint)
                if (r > 200 && g < 100 && b < 100 && a > 100) {
                    outputCtx.fillStyle = 'white';
                    outputCtx.fillRect(x, y, 1, 1);
                }
            }
        }

        return outputMask.toDataURL('image/png');
    }

    exportMask() {
        return this.getMaskImage();
    }
}
