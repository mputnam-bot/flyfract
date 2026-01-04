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
import { Animator, animateZoom } from './core/animator.js';
import { isMobileDevice } from './core/device.js';

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
        this.animator = null;

        this.loadingScreen = new LoadingScreen();
        this.errorHandler = new ErrorHandler();
        this.storage = new StateStorage();

        this.juliaParam = null;

        // Render state
        this.needsRender = true;
        this.isGesturing = false;
        this.quadBuffer = null;
        this.lastFrameTime = 0;
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
            this.animator = new Animator();

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

            // Create Julia parameter indicator
            this.createJuliaIndicator();

            // Initialize gesture controller
            this.setupGestures();

            // Setup touch handler to show UI when hidden (photo mode)
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
        this.uiControls.on('onPrevFractal', () => {
            this.prevFractal();
        });

        this.uiControls.on('onNextFractal', () => {
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
        let hint = '';

        if (fractal.id === 'julia') {
            const preset = this.fractalManager.getCurrentJuliaPreset();
            hint = preset.name;
        }

        this.uiControls.setFractalName(fractal.name, hint);
        this.uiControls.setColorLabel(this.colorManager.getCurrent().name);
    }

    /**
     * Create Julia parameter indicator
     */
    createJuliaIndicator() {
        this.juliaParam = document.createElement('div');
        this.juliaParam.className = 'julia-param';
        document.body.appendChild(this.juliaParam);
    }

    /**
     * Update Julia parameter display
     */
    updateJuliaDisplay() {
        if (!this.juliaParam) return;

        if (this.fractalManager.currentType === 'julia') {
            const preset = this.fractalManager.getCurrentJuliaPreset();
            this.juliaParam.textContent = `${preset.name}: c = ${preset.c[0].toFixed(3)} + ${preset.c[1].toFixed(3)}i`;
            this.juliaParam.classList.add('visible');
        } else {
            this.juliaParam.classList.remove('visible');
        }
    }

    /**
     * Switch to next fractal type
     */
    nextFractal() {
        this.fractalManager.nextType();
        this.resetView();
        this.updateUIState();
        this.updateJuliaDisplay();
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
        this.updateJuliaDisplay();
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
            this.updateJuliaDisplay();
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
                this.viewState.pan(dx, dy);
                this.requestRender();
            },

            onZoom: (scale, x, y) => {
                this.viewState.zoomAt(scale, x, y);
                this.requestRender();
            },

            onRotate: (angle, x, y) => {
                this.viewState.rotate(angle, x, y);
                this.requestRender();
            },

            onDoubleTap: (x, y) => {
                // Animated zoom on double tap
                animateZoom(
                    this.viewState,
                    this.viewState.zoom * 2.5,
                    x, y,
                    300,
                    () => this.requestRender()
                );

                // For Julia sets, also cycle the preset
                if (this.fractalManager.currentType === 'julia') {
                    this.nextJuliaPreset();
                }
            },

            onGestureStart: () => {
                this.isGesturing = true;
                this.quality.onGestureStart();
                this.uiControls.show();
            },

            onGestureEnd: () => {
                this.isGesturing = false;
                this.quality.onGestureEnd();
                this.requestRender();
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
                this.requestRender();
            }, 100);
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);
    }

    /**
     * Setup touch handler for photo mode (show UI when hidden)
     */
    setupPhotoModeTouch() {
        if (isMobileDevice()) {
            let photoModeTouchStart = null;
            let photoModeTouchMoved = false;

            // On mobile, tap to show UI when hidden (but don't interfere with gestures)
            this.canvas.addEventListener('touchstart', (e) => {
                if (this.uiControls && this.uiControls.allHidden && e.touches.length === 1) {
                    photoModeTouchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
                    photoModeTouchMoved = false;
                }
            }, { passive: true });

            this.canvas.addEventListener('touchmove', (e) => {
                if (photoModeTouchStart) {
                    photoModeTouchMoved = true;
                }
            }, { passive: true });

            this.canvas.addEventListener('touchend', (e) => {
                if (this.uiControls && this.uiControls.allHidden && photoModeTouchStart && !photoModeTouchMoved) {
                    const touch = e.changedTouches[0];
                    const dx = touch.clientX - photoModeTouchStart.x;
                    const dy = touch.clientY - photoModeTouchStart.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const time = Date.now() - photoModeTouchStart.time;

                    // Simple tap: small movement, short time
                    if (distance < 10 && time < 300) {
                        this.uiControls.showAll();
                        e.preventDefault();
                    }
                }
                photoModeTouchStart = null;
                photoModeTouchMoved = false;
            }, { passive: false });
        }
    }

    /**
     * Setup mouse movement handler for desktop
     */
    setupMouseMovement() {
        if (!isMobileDevice()) {
            // Show UI controls on mouse movement
            let mouseMoveTimeout;
            this.canvas.addEventListener('mousemove', () => {
                if (this.uiControls) {
                    this.uiControls.show();
                    clearTimeout(mouseMoveTimeout);
                    mouseMoveTimeout = setTimeout(() => {
                        if (this.uiControls && !this.isGesturing) {
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
     * Request a render
     */
    requestRender() {
        this.needsRender = true;
    }

    /**
     * Start the render loop
     */
    startRenderLoop() {
        this.lastFrameTime = performance.now();
        requestAnimationFrame(this.tick.bind(this));
    }

    /**
     * Main render tick
     */
    tick(timestamp) {
        const frameTime = timestamp - this.lastFrameTime;
        this.lastFrameTime = timestamp;

        // Update quality based on frame time
        this.quality.update(frameTime);

        if (this.needsRender || this.isGesturing) {
            this.render();
            this.needsRender = this.isGesturing;
        }

        requestAnimationFrame(this.tick.bind(this));
    }

    /**
     * Render frame
     */
    render() {
        const gl = this.gl;
        const quality = this.quality.getQuality();

        // Get current program
        const { program, uniforms } = this.fractalManager.getCurrent();
        gl.useProgram(program);

        // Resize canvas if needed
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.floor(this.canvas.clientWidth * dpr * quality);
        const height = Math.floor(this.canvas.clientHeight * dpr * quality);

        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
            gl.viewport(0, 0, width, height);
        }

        // Update view state screen size
        this.viewState.setScreenSize(this.canvas.clientWidth, this.canvas.clientHeight);

        // Get uniforms from view state
        const viewUniforms = this.viewState.getUniforms();
        const maxIter = this.viewState.getMaxIterations(this.isGesturing);

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
