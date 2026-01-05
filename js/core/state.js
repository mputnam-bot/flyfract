/**
 * View State Management
 * Handles fractal coordinates, zoom level, and transformations
 */

export class ViewState {
    constructor() {
        // Center coordinates using emulated double precision
        // Each component stored as { hi, lo } for extended precision
        this.centerX = this.dsSplit(-0.5);
        this.centerY = this.dsSplit(0.0);

        // Zoom stored as log2 for smooth interpolation
        this.zoomLog = 0;

        // Derived zoom value
        this.zoom = 1.0;

        // Rotation angle in radians
        this.rotation = 0.0;

        // Screen dimensions (updated on resize)
        this.screenWidth = window.innerWidth;
        this.screenHeight = window.innerHeight;

        // Color offset for animation
        this.colorOffset = 0.0;
    }

    /**
     * Get the actual zoom level
     */
    get zoomLevel() {
        return Math.pow(2, this.zoomLog);
    }

    /**
     * Update screen dimensions
     */
    setScreenSize(width, height) {
        this.screenWidth = width;
        this.screenHeight = height;
    }

    /**
     * Convert screen delta to fractal space and pan
     * @param {number} dx - Screen X delta
     * @param {number} dy - Screen Y delta
     */
    pan(dx, dy) {
        const minDim = Math.min(this.screenWidth, this.screenHeight);
        const scale = 2.0 / (this.zoom * minDim);

        // Apply inverse rotation to screen delta to get fractal space delta
        // This ensures panning is relative to the rotated view
        const cosR = Math.cos(-this.rotation); // Inverse rotation
        const sinR = Math.sin(-this.rotation);
        
        const rotatedDX = dx * cosR - dy * sinR;
        const rotatedDY = dx * sinR + dy * cosR;

        // Update center (X increases right, Y increases up in fractal space)
        const fractalDX = -rotatedDX * scale;
        const fractalDY = rotatedDY * scale;

        // Add to emulated double (split delta to preserve precision)
        this.centerX = this.dsAdd(this.centerX, this.dsSplit(fractalDX));
        this.centerY = this.dsAdd(this.centerY, this.dsSplit(fractalDY));

        // Renormalize periodically
        this.centerX = this.dsRenorm(this.centerX);
        this.centerY = this.dsRenorm(this.centerY);
    }

    /**
     * Rotate the view
     * @param {number} angle - Rotation angle in radians
     * @param {number} screenX - Screen X coordinate of rotation center
     * @param {number} screenY - Screen Y coordinate of rotation center
     */
    rotate(angle, screenX, screenY) {
        this.rotation += angle;
        // Keep rotation in [0, 2π] range
        this.rotation = ((this.rotation % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
    }

    /**
     * Zoom centered on a screen point
     * @param {number} factor - Zoom factor (>1 = zoom in)
     * @param {number} screenX - Screen X coordinate
     * @param {number} screenY - Screen Y coordinate
     */
    zoomAt(factor, screenX, screenY) {
        const oldZoom = this.zoom;
        const minDim = Math.min(this.screenWidth, this.screenHeight);

        // Update zoom
        this.zoomLog += Math.log2(factor);
        // Clamp zoom to reasonable range (0.001x to 10^12x)
        // Allow zooming out to see more of the fractal (negative zoomLog = zoom < 1x)
        this.zoomLog = Math.max(-10, Math.min(40, this.zoomLog));
        this.zoom = Math.pow(2, this.zoomLog);

        // Calculate the point in fractal space that should stay fixed
        const scale = 2.0 / (oldZoom * minDim);
        const fx = (screenX - this.screenWidth / 2) * scale;
        const fy = -(screenY - this.screenHeight / 2) * scale;

        // Adjust center to keep that point stationary (split delta to preserve precision)
        const adjust = 1 - 1 / factor;
        this.centerX = this.dsAdd(this.centerX, this.dsSplit(fx * adjust));
        this.centerY = this.dsAdd(this.centerY, this.dsSplit(fy * adjust));

        // Renormalize
        this.centerX = this.dsRenorm(this.centerX);
        this.centerY = this.dsRenorm(this.centerY);
    }

    /**
     * Reset to default view
     */
    reset() {
        this.centerX = this.dsSplit(-0.5);
        this.centerY = this.dsSplit(0.0);
        this.zoomLog = 0;
        this.zoom = 1.0;
        this.rotation = 0.0;
    }

    /**
     * Set view to specific coordinates
     * Uses dsSplit to preserve precision beyond float32 limits
     */
    setView(centerX, centerY, zoom) {
        this.centerX = this.dsSplit(centerX);
        this.centerY = this.dsSplit(centerY);
        this.zoom = zoom;
        this.zoomLog = Math.log2(zoom);
        this.rotation = 0.0;
    }

    /**
     * Get uniforms for shader
     */
    getUniforms() {
        return {
            center: [
                this.centerX.hi,
                this.centerX.lo,
                this.centerY.hi,
                this.centerY.lo
            ],
            zoom: this.zoom,
            rotation: this.rotation,
            colorOffset: this.colorOffset
        };
    }

    /**
     * Calculate max iterations based on zoom level
     */
    getMaxIterations(isGesturing = false) {
        // When zoomed out (negative zoomLog), use fewer iterations
        // When zoomed in (positive zoomLog), use more iterations
        const baseIter = 100 + Math.floor(Math.max(0, this.zoomLog) * 25);
        const maxIter = Math.min(1000, baseIter);

        // Reduce iterations during gestures for performance
        // Less aggressive reduction to preserve detail
        if (isGesturing) {
            return Math.max(50, Math.floor(maxIter * 0.65));
        }

        return maxIter;
    }

    // ========== Emulated Double Precision Helpers ==========

    /**
     * Split a JavaScript double into hi+lo float32 components
     * This is critical for deep zoom - it captures precision that would
     * otherwise be lost when passing to WebGL as float32
     */
    dsSplit(x) {
        const hi = Math.fround(x);  // Convert to float32 (loses precision)
        const lo = x - hi;          // Capture what was lost (fits in float32)
        return { hi, lo };
    }

    /**
     * Add two emulated doubles
     */
    dsAdd(a, b) {
        const t1 = a.hi + b.hi;
        const e = t1 - a.hi;
        const t2 = ((b.hi - e) + (a.hi - (t1 - e))) + a.lo + b.lo;
        const hi = t1 + t2;
        const lo = t2 - (hi - t1);
        return { hi, lo };
    }

    /**
     * Renormalize emulated double to prevent precision loss
     */
    dsRenorm(a) {
        const t = a.hi + a.lo;
        const e = a.lo - (t - a.hi);
        return { hi: t, lo: e };
    }
}
