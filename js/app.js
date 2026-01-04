/**
 * FlyFract - Mobile Web Fractal Explorer
 * Main Application Entry Point
 */

import { WebGLContext, checkWebGLSupport } from './render/webgl.js';
import { loadShaderSource } from './render/shaders.js';
import { RenderPipeline } from './render/pipeline.js';
import { QualityAdapter } from './render/quality.js';
import { ViewState } from './core/state.js';
import { GestureController } from './gestures/controller.js';
import { LoadingScreen } from './core/loading.js';
import { ErrorHandler, checkWebGLSupport as checkSupport } from './core/errors.js';
import { StateStorage } from './core/storage.js';

class FlyFractApp {
    constructor() {
        this.canvas = null;
        this.glContext = null;
        this.pipeline = null;
        this.viewState = null;
        this.gestures = null;
        this.quality = null;

        this.loadingScreen = new LoadingScreen();
        this.errorHandler = new ErrorHandler();
        this.storage = new StateStorage();

        this.zoomIndicator = document.getElementById('zoom-indicator');
        this.zoomTimeout = null;
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            // Show loading screen
            this.loadingScreen.show();
            this.loadingScreen.updateProgress(10);

            // Check WebGL support
            const support = checkSupport();
            if (!support.supported) {
                this.errorHandler.showWebGLError();
                return;
            }

            this.loadingScreen.updateProgress(20);

            // Get canvas
            this.canvas = document.getElementById('fractal-canvas');
            if (!this.canvas) {
                throw new Error('Canvas element not found');
            }

            // Initialize WebGL context
            this.glContext = new WebGLContext(this.canvas);
            const gl = this.glContext.init();

            if (!gl) {
                this.errorHandler.showWebGLError();
                return;
            }

            this.loadingScreen.updateProgress(30);

            // Load shaders
            const [vertexSource, fragmentSource] = await Promise.all([
                loadShaderSource('shaders/vertex.glsl'),
                loadShaderSource('shaders/mandelbrot.glsl')
            ]);

            this.loadingScreen.updateProgress(60);

            // Initialize view state
            this.viewState = new ViewState();

            // Load saved state
            const savedState = this.storage.load();
            if (savedState) {
                // Could restore color scheme, etc.
                console.log('Restored saved state');
            }

            // Initialize quality adapter
            this.quality = new QualityAdapter();

            // Initialize render pipeline
            this.pipeline = new RenderPipeline(gl, this.viewState, this.quality);
            await this.pipeline.init(vertexSource, fragmentSource);

            this.loadingScreen.updateProgress(80);

            // Setup zoom indicator callback
            this.pipeline.onZoomChange = (zoomText) => {
                this.updateZoomIndicator(zoomText);
            };

            // Initialize gesture controller
            this.setupGestures();

            // Setup window resize handler
            this.setupResizeHandler();

            // Prevent default touch behaviors
            this.preventDefaults();

            this.loadingScreen.updateProgress(100);

            // Start render loop
            this.pipeline.start();

            // Hide loading screen
            setTimeout(() => {
                this.loadingScreen.hide();
            }, 200);

            console.log(`FlyFract initialized in ${this.loadingScreen.getDuration().toFixed(0)}ms`);

        } catch (error) {
            console.error('Initialization error:', error);
            this.errorHandler.showLoadError(error);
        }
    }

    /**
     * Setup gesture handling
     */
    setupGestures() {
        this.gestures = new GestureController(this.canvas, {
            onPan: (dx, dy) => {
                this.viewState.pan(dx, dy);
                this.pipeline.requestRender();
            },

            onZoom: (scale, x, y) => {
                this.viewState.zoomAt(scale, x, y);
                this.pipeline.requestRender();
            },

            onDoubleTap: (x, y) => {
                // Zoom in 2x on double tap
                this.viewState.zoomAt(2.0, x, y);
                this.pipeline.requestRender();
            },

            onGestureStart: () => {
                this.pipeline.setGesturing(true);
            },

            onGestureEnd: () => {
                this.pipeline.setGesturing(false);
                // Trigger a final high-quality render
                this.pipeline.requestRender();
            }
        });
    }

    /**
     * Setup window resize handler
     */
    setupResizeHandler() {
        let resizeTimeout;

        const handleResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.viewState.setScreenSize(window.innerWidth, window.innerHeight);
                this.pipeline.requestRender();
            }, 100);
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);
    }

    /**
     * Prevent default touch behaviors
     */
    preventDefaults() {
        // Prevent pull-to-refresh and overscroll
        document.addEventListener('touchmove', (e) => {
            if (e.target === this.canvas || e.target === document.body) {
                e.preventDefault();
            }
        }, { passive: false });

        // Prevent double-tap zoom
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, { passive: false });

        // Handle Android back button
        if (history.pushState) {
            history.pushState(null, '', location.href);
            window.addEventListener('popstate', () => {
                history.pushState(null, '', location.href);
                // Reset view on back button
                this.viewState.reset();
                this.pipeline.requestRender();
            });
        }
    }

    /**
     * Update zoom level indicator
     */
    updateZoomIndicator(zoomText) {
        if (!this.zoomIndicator) return;

        this.zoomIndicator.textContent = zoomText;
        this.zoomIndicator.classList.add('visible');

        // Hide after delay
        clearTimeout(this.zoomTimeout);
        this.zoomTimeout = setTimeout(() => {
            this.zoomIndicator.classList.remove('visible');
        }, 2000);
    }
}

// Start app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new FlyFractApp();
    app.init();
});
