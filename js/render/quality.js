/**
 * Adaptive Quality Manager
 * Dynamically adjusts rendering quality for smooth performance
 */

export class QualityAdapter {
    constructor() {
        // Quality level (0.25 to 1.0)
        this.quality = 1.0;
        this.targetQuality = 1.0;

        // Gesture state
        this.isGesturing = false;

        // Frame time tracking
        this.frameTimeHistory = [];
        this.maxHistoryLength = 10;

        // Quality settings
        this.gestureQuality = 0.75;   // Quality during gestures (increased for better detail)
        this.staticQuality = 1.0;      // Quality when static
        this.recoveryRate = 0.05;      // How fast quality recovers
    }

    /**
     * Called when gesture starts
     */
    onGestureStart() {
        this.isGesturing = true;
        this.targetQuality = this.gestureQuality;
        this.quality = this.gestureQuality;
    }

    /**
     * Called when gesture ends
     */
    onGestureEnd() {
        this.isGesturing = false;
        this.targetQuality = this.staticQuality;
    }

    /**
     * Update quality based on frame time
     * @param {number} frameTime - Time for last frame in ms
     */
    update(frameTime) {
        // Track frame times
        this.frameTimeHistory.push(frameTime);
        if (this.frameTimeHistory.length > this.maxHistoryLength) {
            this.frameTimeHistory.shift();
        }

        if (!this.isGesturing) {
            // Gradually recover quality
            if (this.quality < this.targetQuality) {
                this.quality = Math.min(this.targetQuality, this.quality + this.recoveryRate);
            }

            // Adaptive quality based on frame time (target 16.67ms for 60fps)
            const avgFrameTime = this.getAverageFrameTime();

            if (avgFrameTime > 25 && this.quality > 0.25) {
                // Too slow, reduce quality
                this.quality *= 0.95;
            } else if (avgFrameTime < 10 && this.quality < this.staticQuality) {
                // Fast enough, can increase quality
                this.quality *= 1.05;
            }

            this.quality = Math.max(0.25, Math.min(1.0, this.quality));
        }

        return this.quality;
    }

    /**
     * Get current quality level
     */
    getQuality() {
        return this.quality;
    }

    /**
     * Get average frame time
     */
    getAverageFrameTime() {
        if (this.frameTimeHistory.length === 0) return 16.67;
        return this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length;
    }

    /**
     * Get estimated FPS
     */
    getFPS() {
        const avgFrameTime = this.getAverageFrameTime();
        return avgFrameTime > 0 ? 1000 / avgFrameTime : 60;
    }
}
