/**
 * Error Handler
 * Manages error display and recovery
 */

export class ErrorHandler {
    constructor() {
        this.errorScreen = document.getElementById('error-screen');
        this.errorTitle = document.getElementById('error-title');
        this.errorMessage = document.getElementById('error-message');
    }

    /**
     * Show error screen
     * @param {string} title - Error title
     * @param {string} message - Error message
     */
    show(title, message) {
        // Hide loading screen if visible
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }

        if (this.errorScreen) {
            if (this.errorTitle) {
                this.errorTitle.textContent = title;
            }
            if (this.errorMessage) {
                this.errorMessage.textContent = message;
            }
            this.errorScreen.style.display = 'flex';
        }
    }

    /**
     * Hide error screen
     */
    hide() {
        if (this.errorScreen) {
            this.errorScreen.style.display = 'none';
        }
    }

    /**
     * Show WebGL not supported error
     */
    showWebGLError() {
        this.show(
            'WebGL Not Supported',
            'Your browser or device does not support WebGL, which is required for FlyFract. Please try a different browser or device.'
        );
    }

    /**
     * Show shader compilation error
     */
    showShaderError(error) {
        console.error('Shader error:', error);
        this.show(
            'Rendering Error',
            'Failed to initialize the fractal renderer. Please try refreshing the page.'
        );
    }

    /**
     * Show generic loading error
     */
    showLoadError(error) {
        console.error('Load error:', error);
        this.show(
            'Loading Failed',
            'Failed to load required resources. Please check your connection and try again.'
        );
    }
}

/**
 * Check if WebGL is supported
 * @returns {{ supported: boolean, message?: string }}
 */
export function checkWebGLSupport() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    if (!gl) {
        return {
            supported: false,
            message: 'WebGL is not supported'
        };
    }

    // Check for required precision
    const highp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    if (!highp || highp.precision === 0) {
        return {
            supported: false,
            message: 'High precision floats not supported'
        };
    }

    return { supported: true };
}
