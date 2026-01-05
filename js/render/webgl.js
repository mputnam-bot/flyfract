/**
 * WebGL Context Manager
 * Handles WebGL initialization, context loss, and canvas management
 */

export class WebGLContext {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = null;
        this.isContextLost = false;
        this.onContextRestored = null;

        // Limit DPR for performance (especially on iOS)
        this.maxDPR = 2.0;
        this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDPR);
    }

    /**
     * Initialize WebGL context
     * @returns {WebGLRenderingContext|null}
     */
    init() {
        const contextOptions = {
            alpha: false,
            antialias: false,
            depth: false,
            stencil: false,
            preserveDrawingBuffer: false, // Disabled for performance; screenshots still work if taken immediately after render
            powerPreference: 'high-performance'
        };

        this.gl = this.canvas.getContext('webgl', contextOptions) ||
                  this.canvas.getContext('experimental-webgl', contextOptions);

        if (!this.gl) {
            return null;
        }

        this.setupContextLossHandling();
        this.resize();

        return this.gl;
    }

    /**
     * Setup context loss/restore handlers
     */
    setupContextLossHandling() {
        this.canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            this.isContextLost = true;
            console.warn('WebGL context lost');
        });

        this.canvas.addEventListener('webglcontextrestored', () => {
            this.isContextLost = false;
            console.log('WebGL context restored');
            if (this.onContextRestored) {
                this.onContextRestored();
            }
        });
    }

    /**
     * Resize canvas to match display size
     * @param {number} quality - Quality multiplier (0.25 to 1.0)
     * @returns {boolean} True if size changed
     */
    resize(quality = 1.0) {
        const displayWidth = Math.floor(this.canvas.clientWidth * this.dpr * quality);
        const displayHeight = Math.floor(this.canvas.clientHeight * this.dpr * quality);

        if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;
            this.gl.viewport(0, 0, displayWidth, displayHeight);
            return true;
        }

        return false;
    }

    /**
     * Get current canvas dimensions
     */
    getSize() {
        return {
            width: this.canvas.width,
            height: this.canvas.height
        };
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
            message: 'WebGL is not supported on your device. Please try a different browser or device.'
        };
    }

    // Check for highp float support in fragment shaders
    const highp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    if (!highp || highp.precision === 0) {
        return {
            supported: false,
            message: 'Your device does not support high-precision floating point in shaders.'
        };
    }

    return { supported: true };
}
