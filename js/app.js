/**
 * FlyFract - Mobile Web Fractal Explorer
 * Main Application Entry Point (Phase 2)
 */

import { WebGLContext } from './render/webgl.js';
import { loadShaderSource, getUniformLocations, getAttributeLocations } from './render/shaders.js';
import { QualityAdapter } from './render/quality.js';
import { ViewState } from './core/state.js';
import { GestureController } from './gestures/controller.js';
import { LoadingScreen } from './core/loading.js';
import { ErrorHandler, checkWebGLSupport } from './core/errors.js';
import { StateStorage } from './core/storage.js';
import { FractalManager, FRACTAL_TYPES, JULIA_PRESETS } from './fractals/index.js';
import { ColorManager, COLOR_SCHEMES } from './render/colors.js';
import { UIControls } from './ui/controls.js';
import { AnimationOrchestrator, animateZoomWithOrchestrator } from './core/orchestrator.js';
import { isMobileDevice, getIterationTargets, getDeviceTier } from './core/device.js';

class FlyFractApp {
    constructor() {
        this.canvas = null;
        this.gl = null;
        this.glContext = null;

        this.viewState = null;
        this.gestures = null;
        this.quality = null;
        this.fractalManager = null;
        this.colorManager = null;
        this.uiControls = null;
        this.orchestrator = null;

        this.loadingScreen = new LoadingScreen();
        this.errorHandler = new ErrorHandler();
        this.storage = new StateStorage();


        // Render state
        this.isGesturing = false;
        this.quadBuffer = null;
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            // Show loading screen
            this.loadingScreen.show();
            this.loadingScreen.updateProgress(5);

            // Check WebGL support
            const support = checkWebGLSupport();
            if (!support.supported) {
                this.errorHandler.showWebGLError();
                return;
            }

            this.loadingScreen.updateProgress(10);

            // Get canvas
            this.canvas = document.getElementById('fractal-canvas');
            if (!this.canvas) {
                throw new Error('Canvas element not found');
            }

            // Initialize WebGL context
            this.glContext = new WebGLContext(this.canvas);
            this.gl = this.glContext.init();

            if (!this.gl) {
                this.errorHandler.showWebGLError();
                return;
            }

            this.loadingScreen.updateProgress(20);

            // Load vertex shader (shared by all fractals)
            const vertexSource = await loadShaderSource('shaders/vertex.glsl');

            this.loadingScreen.updateProgress(30);

            // Initialize fractal manager and load all shaders
            this.fractalManager = new FractalManager(this.gl, vertexSource);
            await this.fractalManager.loadAll((progress) => {
                this.loadingScreen.updateProgress(30 + progress * 40);
            });

            this.loadingScreen.updateProgress(70);

            // Initialize managers
            this.viewState = new ViewState();
            this.quality = new QualityAdapter();
            this.colorManager = new ColorManager();
            this.orchestrator = new AnimationOrchestrator();

            // Configure iteration targets based on device tier
            const iterationTargets = getIterationTargets();
            this.orchestrator.setIterationTargets(
                iterationTargets.gesture,
                iterationTargets.static
            );
            console.log(`Device tier: ${getDeviceTier()}, iterations: gesture=${iterationTargets.gesture}, static=${iterationTargets.static}`);

            // Load saved state
            const savedState = this.storage.load();
            if (savedState) {
                if (savedState.fractalType && FRACTAL_TYPES[savedState.fractalType]) {
                    this.fractalManager.setType(savedState.fractalType);
                }
                if (savedState.colorScheme && COLOR_SCHEMES[savedState.colorScheme]) {
                    this.colorManager.setScheme(savedState.colorScheme);
                }
            }

            // Set default view for current fractal
            this.resetView();

            // Create fullscreen quad
            this.createQuad();

            this.loadingScreen.updateProgress(80);

            // Initialize UI
            this.uiControls = new UIControls();
            this.uiControls.init();
            this.setupUICallbacks();
            this.updateUIState();

            // Julia parameter indicator removed - no longer showing equations

            // Initialize gesture controller
            this.setupGestures();

            // Setup handlers to show UI when hidden (photo mode) - works on both mobile and desktop
            this.setupPhotoModeTouch();

            // Setup window resize handler
            this.setupResizeHandler();

            // Setup mouse movement handler for desktop
            this.setupMouseMovement();

            // Prevent default touch behaviors
            this.preventDefaults();

            this.loadingScreen.updateProgress(100);

            // Start render loop
            this.startRenderLoop();

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
     * Create fullscreen quad vertex buffer
     */
    createQuad() {
        const gl = this.gl;
        this.quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);

        const vertices = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
             1,  1
        ]);

        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    }

    /**
     * Setup UI callbacks
     */
    setupUICallbacks() {
        this.uiControls.on('onFractalChange', () => {
            this.nextFractal();
        });

        this.uiControls.on('onColorChange', () => {
            this.nextColor();
        });
    }

    /**
     * Update UI to reflect current state
     */
    updateUIState() {
        const fractal = this.fractalManager.getCurrentType();
        this.uiControls.setFractalName(fractal.name, fractal.id);
        this.uiControls.setColorLabel(this.colorManager.getCurrent().name);
    }

    /**
     * Julia parameter indicator removed - no longer showing equations
     */

    /**
     * Switch to next fractal type
     */
    nextFractal() {
        this.fractalManager.nextType();
        this.resetView();
        this.updateUIState();
        this.saveState();
        this.requestRender();
    }

    /**
     * Switch to previous fractal type
     */
    prevFractal() {
        this.fractalManager.prevType();
        this.resetView();
        this.updateUIState();
        this.saveState();
        this.requestRender();
    }

    /**
     * Cycle to next color scheme
     */
    nextColor() {
        this.colorManager.nextScheme();
        this.updateUIState();
        this.saveState();
        this.requestRender();
    }

    /**
     * Cycle Julia preset
     */
    nextJuliaPreset() {
        if (this.fractalManager.currentType === 'julia') {
            this.fractalManager.nextJuliaPreset();
            this.updateUIState();
            this.requestRender();
        }
    }

    /**
     * Reset view to default for current fractal
     */
    resetView() {
        const defaultView = this.fractalManager.getDefaultView();
        this.viewState.setView(defaultView.centerX, defaultView.centerY, defaultView.zoom);
    }

    /**
     * Save current state
     */
    saveState() {
        this.storage.save({
            fractalType: this.fractalManager.currentType,
            colorScheme: this.colorManager.currentScheme
        });
    }

    /**
     * Setup gesture handling
     */
    setupGestures() {
        this.gestures = new GestureController(this.canvas, {
            onPan: (dx, dy) => {
                // Buffer gestures for atomic application on next tick
                this.orchestrator.bufferPan(dx, dy);
            },

            onZoom: (scale, x, y) => {
                // Buffer gestures for atomic application on next tick
                this.orchestrator.bufferZoom(scale, x, y);
            },

            onRotate: (angle, x, y) => {
                // Buffer gestures for atomic application on next tick
                this.orchestrator.bufferRotation(angle, x, y);
            },

            onDoubleTap: (x, y) => {
                // Animated zoom on double tap using unified orchestrator
                animateZoomWithOrchestrator(
                    this.orchestrator,
                    this.viewState,
                    this.viewState.zoom * 2.5,
                    x, y,
                    300,
                    () => this.orchestrator.requestRender()
                );

                // For Julia sets, also cycle the preset
                if (this.fractalManager.currentType === 'julia') {
                    this.nextJuliaPreset();
                }
            },

            onGestureStart: () => {
                this.isGesturing = true;
                this.orchestrator.setGesturing(true);
                this.quality.onGestureStart();
                // Show UI if it was hidden (photo mode)
                if (this.uiControls && this.uiControls.allHidden) {
                    this.uiControls.showAll();
                } else {
                    this.uiControls.show();
                }
            },

            onGestureEnd: () => {
                this.isGesturing = false;
                this.orchestrator.setGesturing(false);
                this.quality.onGestureEnd();
                this.orchestrator.requestRender();
            }
        }, this.orchestrator);

        // Set the orchestrator on gestures controller
        this.gestures.setOrchestrator(this.orchestrator);
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
                this.requestRender();
            }, 100);
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);
    }

    /**
     * Setup handlers for photo mode (show UI when hidden)
     * Works on both mobile and desktop
     */
    setupPhotoModeTouch() {
        // Show UI on any interaction when hidden
        const showUIIfHidden = () => {
            if (this.uiControls && this.uiControls.allHidden) {
                this.uiControls.showAll();
            }
        };

        // Mobile: show on touch
        this.canvas.addEventListener('touchstart', (e) => {
            if (this.uiControls && this.uiControls.allHidden) {
                showUIIfHidden();
            }
        }, { passive: true });

        // Desktop: show on mouse click or mousedown (for panning)
        // Note: mousedown is handled by gesture controller which calls onGestureStart
        // This handler is a backup for clicks that don't trigger gestures
        this.canvas.addEventListener('mousedown', (e) => {
            // Only show if clicking on canvas, not on UI buttons
            const target = e.target;
            const isUIButton = target.closest('.photo-btn, .info-btn, .fractal-selector, .color-selector, .close-btn');
            if (target === this.canvas && !isUIButton && this.uiControls && this.uiControls.allHidden) {
                showUIIfHidden();
            }
        });
        
        // Also handle click event for desktop (more reliable than mousedown for some cases)
        this.canvas.addEventListener('click', (e) => {
            const target = e.target;
            const isUIButton = target.closest('.photo-btn, .info-btn, .fractal-selector, .color-selector, .close-btn');
            if (target === this.canvas && !isUIButton && this.uiControls && this.uiControls.allHidden) {
                showUIIfHidden();
            }
        });

        // Mouse movement alone should NOT show UI in photo mode
        // Only actual interactions (click, drag, scroll) should show UI
    }

    /**
     * Setup mouse movement handler for desktop
     */
    setupMouseMovement() {
        if (!isMobileDevice()) {
            // Show UI controls on mouse movement (but NOT in photo mode)
            let mouseMoveTimeout;
            this.canvas.addEventListener('mousemove', () => {
                if (this.uiControls) {
                    // Don't show UI if in photo mode (allHidden)
                    if (this.uiControls.allHidden) {
                        return; // Don't show UI on mouse movement in photo mode
                    }
                    
                    // Normal auto-hide behavior when not in photo mode
                    this.uiControls.show();
                    clearTimeout(mouseMoveTimeout);
                    mouseMoveTimeout = setTimeout(() => {
                        if (this.uiControls && !this.isGesturing && !this.uiControls.allHidden) {
                            this.uiControls.hide();
                        }
                    }, 3000);
                }
            });
        }
    }

    /**
     * Prevent default touch behaviors (mobile only)
     */
    preventDefaults() {
        // Only prevent defaults on mobile devices
        if (!isMobileDevice()) {
            // On desktop, only handle Android back button
            if (history.pushState) {
                history.pushState(null, '', location.href);
                window.addEventListener('popstate', () => {
                    history.pushState(null, '', location.href);
                    this.resetView();
                    this.requestRender();
                });
            }
            return;
        }

        // Mobile: Prevent pull-to-refresh and overscroll
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
                this.resetView();
                this.requestRender();
            });
        }
    }

    /**
     * Request a render (legacy - now delegates to orchestrator)
     */
    requestRender() {
        this.orchestrator.requestRender();
    }

    /**
     * Start the unified render loop via orchestrator
     */
    startRenderLoop() {
        // Initialize orchestrator with view state and render callback
        this.orchestrator.init(this.viewState, () => this.render());
        this.orchestrator.start();
    }

    /**
     * Render frame
     */
    render() {
        const gl = this.gl;

        // Get current program
        const { program, uniforms } = this.fractalManager.getCurrent();
        gl.useProgram(program);

        // Canvas ALWAYS at full resolution - never changes during gestures
        // This eliminates visible flicker on gesture start/end
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.floor(this.canvas.clientWidth * dpr);
        const height = Math.floor(this.canvas.clientHeight * dpr);

        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
            gl.viewport(0, 0, width, height);
        }

        // Update view state screen size
        this.viewState.setScreenSize(this.canvas.clientWidth, this.canvas.clientHeight);

        // Get uniforms from view state
        const viewUniforms = this.viewState.getUniforms();

        // Use orchestrator's smoothed iterations for invisible gesture transitions
        // This smoothly interpolates between gesture and static iteration counts
        const maxIter = this.orchestrator.getIterations();

        // Set uniforms
        gl.uniform2f(uniforms.u_resolution, width, height);
        gl.uniform4f(
            uniforms.u_center,
            viewUniforms.center[0],
            viewUniforms.center[1],
            viewUniforms.center[2],
            viewUniforms.center[3]
        );
        gl.uniform1f(uniforms.u_zoom, viewUniforms.zoom);
        if (uniforms.u_rotation !== undefined) {
            gl.uniform1f(uniforms.u_rotation, viewUniforms.rotation);
        }
        gl.uniform1i(uniforms.u_maxIter, maxIter);
        gl.uniform1f(uniforms.u_colorOffset, this.colorManager.colorOffset);

        // Color scheme uniforms
        const colorScheme = this.colorManager.getCurrent();
        if (uniforms.u_colorA) {
            gl.uniform3f(uniforms.u_colorA, colorScheme.a[0], colorScheme.a[1], colorScheme.a[2]);
        }
        if (uniforms.u_colorB) {
            gl.uniform3f(uniforms.u_colorB, colorScheme.b[0], colorScheme.b[1], colorScheme.b[2]);
        }
        if (uniforms.u_colorC) {
            gl.uniform3f(uniforms.u_colorC, colorScheme.c[0], colorScheme.c[1], colorScheme.c[2]);
        }
        if (uniforms.u_colorD) {
            gl.uniform3f(uniforms.u_colorD, colorScheme.d[0], colorScheme.d[1], colorScheme.d[2]);
        }

        // Julia set specific uniform
        if (uniforms.u_juliaC) {
            const juliaC = this.fractalManager.juliaC;
            gl.uniform2f(uniforms.u_juliaC, juliaC[0], juliaC[1]);
        }

        // Setup vertex attribute
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        const posLoc = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        // Draw
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // Zoom indicator removed - replaced with photo button
    }
}

// Start app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new FlyFractApp();
    app.init();
});
