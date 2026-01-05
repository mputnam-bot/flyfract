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
        const errorMessage = error?.message || String(error) || 'Unknown error';
        const detailedMessage = errorMessage.includes('Failed to fetch') || errorMessage.includes('404') 
            ? `Failed to load resource: ${errorMessage}. Make sure you're running a local server (not opening the file directly).`
            : errorMessage.includes('shader')
            ? `Shader error: ${errorMessage}`
            : errorMessage.includes('module')
            ? `Module loading error: ${errorMessage}. Check browser console for details.`
            : `Error: ${errorMessage}. Check browser console (F12) for more details.`;
        
        this.show(
            'Loading Failed',
            detailedMessage
        );
    }

    /**
     * Show WebGL context lost error
     */
    showContextLostError() {
        this.show(
            'Graphics Context Lost',
            'The graphics system was interrupted. This usually happens when switching apps or tabs. The page will attempt to recover automatically.'
        );
    }

    /**
     * Show security error (e.g., blocked by CSP)
     */
    showSecurityError(error) {
        console.error('Security error:', error);
        this.show(
            'Security Error',
            'A security policy prevented the application from loading. Please contact support if this persists.'
        );
    }
}

/**
 * Setup global error boundary
 * Catches unhandled errors and provides graceful degradation
 */
export function setupGlobalErrorBoundary(errorHandler) {
    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);

        // Don't show error UI for minor issues
        if (event.reason?.message?.includes('localStorage')) {
            // Storage errors are non-fatal
            event.preventDefault();
            return;
        }

        // Check for CSP violations
        if (event.reason?.message?.includes('Content Security Policy')) {
            errorHandler.showSecurityError(event.reason);
            event.preventDefault();
            return;
        }
    });

    // Catch global errors
    window.addEventListener('error', (event) => {
        console.error('Global error:', event.error);

        // Shader compilation errors
        if (event.message?.includes('shader') || event.message?.includes('GLSL')) {
            errorHandler.showShaderError(event.error);
            event.preventDefault();
            return;
        }
    });

    // Catch CSP violations
    document.addEventListener('securitypolicyviolation', (event) => {
        console.error('CSP violation:', {
            blockedURI: event.blockedURI,
            violatedDirective: event.violatedDirective,
            originalPolicy: event.originalPolicy
        });

        // Only show error for critical violations
        if (event.violatedDirective.includes('script-src')) {
            errorHandler.showSecurityError(new Error(`Script blocked: ${event.blockedURI}`));
        }
    });
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
