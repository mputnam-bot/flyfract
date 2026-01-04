/**
 * Loading Screen Manager
 * Handles loading states and progress display
 */

export class LoadingScreen {
    constructor() {
        this.element = document.getElementById('loading-screen');
        this.progressBar = document.getElementById('loading-progress-bar');
        this.startTime = performance.now();
    }

    /**
     * Show the loading screen
     */
    show() {
        if (this.element) {
            this.element.style.display = 'flex';
            this.element.classList.remove('hidden');
        }
    }

    /**
     * Update progress bar
     * @param {number} percent - Progress percentage (0-100)
     */
    updateProgress(percent) {
        if (this.progressBar) {
            this.progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
        }
    }

    /**
     * Hide the loading screen with animation
     */
    hide() {
        if (this.element) {
            this.element.classList.add('hidden');

            // Remove from DOM after animation
            setTimeout(() => {
                this.element.style.display = 'none';
            }, 300);
        }
    }

    /**
     * Get loading duration
     */
    getDuration() {
        return performance.now() - this.startTime;
    }
}
