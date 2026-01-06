/**
 * FlyFract - Mobile Web Fractal Explorer
 * Main Application Entry Point (Phase 2)
 */

console.log('app.js module loading...');

import { WebGLContext } from './render/webgl.js';
import { loadShaderSource } from './render/shaders.js';
import { QualityAdapter } from './render/quality.js';
import { ViewState } from './core/state.js';
import { GestureController } from './gestures/controller.js';
import { LoadingScreen } from './core/loading.js';
import { ErrorHandler, checkWebGLSupport, setupGlobalErrorBoundary } from './core/errors.js';
import { StateStorage } from './core/storage.js';
import { FractalManager, FRACTAL_TYPES, JULIA_PRESETS } from './fractals/index.js';
import { ColorManager, COLOR_SCHEMES } from './render/colors.js';
import { UIControls } from './ui/controls.js';
import { AnimationOrchestrator, animateZoomWithOrchestrator } from './core/orchestrator.js';
import { isMobileDevice, getIterationTargets, getDeviceTier } from './core/device.js';
import { DeepZoomManager, ReferenceOrbit } from './core/reference-orbit.js';

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
        this.deepZoomManager = null;

        this.loadingScreen = new LoadingScreen();
        this.errorHandler = new ErrorHandler();
        this.storage = new StateStorage();

        // Setup global error boundary for security and stability
        setupGlobalErrorBoundary(this.errorHandler);


        // Render state
        this.isGesturing = false;
        this.quadBuffer = null;

        // Deep zoom state
        this.deepZoomPendingUpdate = false;
        this.lastDeepZoomUpdate = 0;

        // Zoom indicator element
        this.zoomIndicator = null;
    }

    /**
     * Initialize the application
     */
    async init() {
        // Add timeout to detect hanging initialization
        let initTimeout = setTimeout(() => {
            console.error('Initialization timeout - taking longer than 30 seconds');
            this.errorHandler.show(
                'Initialization Timeout',
                'The app is taking longer than expected to load. Check the browser console (F12) for errors. This might be due to shader compilation issues or network problems.'
            );
        }, 30000);
        
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

            // Get zoom indicator element
            this.zoomIndicator = document.getElementById('zoom-indicator');

            // Initialize WebGL context
            this.glContext = new WebGLContext(this.canvas);
            this.gl = this.glContext.init();

            if (!this.gl) {
                this.errorHandler.showWebGLError();
                return;
            }

            this.loadingScreen.updateProgress(20);

            // Load vertex shader (shared by all fractals)
            console.log('Loading vertex shader...');
            const vertexSource = await loadShaderSource('shaders/vertex.glsl');
            console.log('Vertex shader loaded');

            this.loadingScreen.updateProgress(30);

            // Initialize fractal manager and load all shaders
            console.log('Initializing fractal manager...');
            this.fractalManager = new FractalManager(this.gl, vertexSource);
            console.log('Loading all fractal shaders...');
            await this.fractalManager.loadAll((progress) => {
                this.loadingScreen.updateProgress(30 + progress * 40);
            });
            console.log('All shaders loaded');

            this.loadingScreen.updateProgress(70);

            // Initialize managers
            console.log('Initializing managers...');
            this.viewState = new ViewState();
            this.quality = new QualityAdapter();
            this.colorManager = new ColorManager();
            this.orchestrator = new AnimationOrchestrator();

            // Initialize deep zoom manager
            this.deepZoomManager = new DeepZoomManager();
            this.deepZoomManager.init(this.gl);

            // Log deep zoom status prominently
            if (this.fractalManager.hasDeepZoom()) {
                console.log('%c Deep zoom ENABLED - shader loaded successfully', 'background: green; color: white; padding: 2px 5px;');
            } else {
                console.error('%c Deep zoom DISABLED - shader failed to load! Check errors above.', 'background: red; color: white; padding: 2px 5px;');
            }

            console.log('Managers initialized');

            // Configure iteration targets based on device tier
            const iterationTargets = getIterationTargets();
            this.orchestrator.setIterationTargets(
                iterationTargets.gesture,
                iterationTargets.static
            );
            console.log(`Device tier: ${getDeviceTier()}, iterations: gesture=${iterationTargets.gesture}, static=${iterationTargets.static}`);

            // Load saved state (or use defaults for first-time users)
            const savedState = this.storage.load();
            if (savedState) {
                // Restore user's last selections
                if (savedState.fractalType && FRACTAL_TYPES[savedState.fractalType]) {
                    this.fractalManager.setType(savedState.fractalType);
                }
                if (savedState.colorScheme && COLOR_SCHEMES[savedState.colorScheme]) {
                    this.colorManager.setScheme(savedState.colorScheme);
                }
            } else {
                // First-time user: default to Mandelbrot and Inferno
                this.fractalManager.setType('mandelbrot');
                this.colorManager.setScheme('inferno');
            }

            // Set default view for current fractal
            console.log('Resetting view...');
            this.resetView();

            // Create fullscreen quad
            console.log('Creating quad buffer...');
            this.createQuad();

            this.loadingScreen.updateProgress(80);

            // Initialize UI
            console.log('Initializing UI...');
            this.uiControls = new UIControls();
            this.uiControls.init();
            this.setupUICallbacks();
            this.updateUIState();

            // Handle photo mode changes for zoom indicator
            this.uiControls.onPhotoModeChange = (isPhotoMode) => {
                if (this.zoomIndicator) {
                    if (isPhotoMode) {
                        this.zoomIndicator.classList.add('hidden');
                    } else {
                        this.zoomIndicator.classList.remove('hidden');
                    }
                }
            };

            console.log('UI initialized');

            // Julia parameter indicator removed - no longer showing equations

            // Initialize gesture controller
            this.setupGestures();

            // Setup handlers to show UI when hidden (photo mode) - works on both mobile and desktop
            this.setupPhotoModeTouch();

            // Setup window resize handler
            this.setupResizeHandler();

            // Setup mouse movement handler for desktop
            this.setupMouseMovement();

            // Setup keyboard controls for desktop
            this.setupKeyboardControls();

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
            
            // Clear timeout on successful initialization
            clearTimeout(initTimeout);

        } catch (error) {
            console.error('Initialization error:', error);
            console.error('Error stack:', error.stack);
            clearTimeout(initTimeout);
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
     * Setup keyboard controls for desktop
     * Arrow Keys: Pan, +/-: Zoom, F: Fractal, C: Color, R: Reset, P: Photo mode
     */
    setupKeyboardControls() {
        if (isMobileDevice()) return;

        const PAN_AMOUNT = 50; // pixels per keypress
        const ZOOM_FACTOR = 1.2;

        document.addEventListener('keydown', (e) => {
            // Ignore if user is typing in an input field
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            // Get screen center for zoom operations
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;

            switch (e.key) {
                // Arrow keys - Pan
                case 'ArrowUp':
                    e.preventDefault();
                    this.viewState.pan(0, -PAN_AMOUNT);
                    this.requestRender();
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.viewState.pan(0, PAN_AMOUNT);
                    this.requestRender();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.viewState.pan(-PAN_AMOUNT, 0);
                    this.requestRender();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.viewState.pan(PAN_AMOUNT, 0);
                    this.requestRender();
                    break;

                // +/= key - Zoom in
                case '+':
                case '=':
                    e.preventDefault();
                    this.viewState.zoomAt(ZOOM_FACTOR, centerX, centerY);
                    this.requestRender();
                    break;

                // - key - Zoom out
                case '-':
                case '_':
                    e.preventDefault();
                    this.viewState.zoomAt(1 / ZOOM_FACTOR, centerX, centerY);
                    this.requestRender();
                    break;

                // F - Next fractal
                case 'f':
                case 'F':
                    e.preventDefault();
                    this.nextFractal();
                    break;

                // C - Next color scheme
                case 'c':
                case 'C':
                    e.preventDefault();
                    this.nextColor();
                    break;

                // R - Reset view
                case 'r':
                case 'R':
                    e.preventDefault();
                    this.resetView();
                    this.requestRender();
                    break;

                // P - Toggle photo mode (hide/show UI)
                case 'p':
                case 'P':
                    e.preventDefault();
                    if (this.uiControls.allHidden) {
                        this.uiControls.showAll();
                    } else {
                        this.uiControls.hideAll();
                    }
                    break;
            }
        });
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
     * Check if deep zoom should be enabled and update reference orbit if needed
     */
    updateDeepZoom() {
        const zoomLog = this.viewState.zoomLog;
        const shouldUseDeep = ReferenceOrbit.shouldUseDeepZoom(zoomLog) &&
                             this.fractalManager.supportsDeepZoom();

        // During gestures, don't use deep zoom to maintain smoothness
        // The standard shader will pixelate at deep zoom, but that's acceptable
        // during interactive manipulation
        if (this.isGesturing) {
            this.fractalManager.setDeepZoom(false);
            this.deepZoomPendingUpdate = shouldUseDeep;  // Remember to update after gesture
            return;
        }

        // Enable/disable deep zoom in fractal manager
        this.fractalManager.setDeepZoom(shouldUseDeep);

        if (!shouldUseDeep) {
            this.deepZoomPendingUpdate = false;
            return;
        }

        // Get center coordinates
        const centerX = this.viewState.centerX.hi + this.viewState.centerX.lo;
        const centerY = this.viewState.centerY.hi + this.viewState.centerY.lo;
        const maxIter = this.orchestrator.getIterations();

        // Check if we need to update the reference orbit
        const now = performance.now();
        const needsUpdate = this.deepZoomManager.referenceOrbit.needsUpdate(
            centerX, centerY, zoomLog, maxIter
        );

        if (needsUpdate || this.deepZoomPendingUpdate) {
            // Throttle updates to avoid excessive computation
            // Use longer throttle for mobile devices
            const throttleTime = isMobileDevice() ? 200 : 100;

            if (now - this.lastDeepZoomUpdate > throttleTime) {
                console.log(`Computing reference orbit at zoom 2^${zoomLog.toFixed(1)}`);

                // Use sync update - it's fast enough for typical zoom levels
                // For very deep zoom (zoomLog > 50), we could use async
                this.deepZoomManager.updateSync(centerX, centerY, zoomLog, maxIter);
                this.lastDeepZoomUpdate = now;
                this.deepZoomPendingUpdate = false;

                console.log(`Reference orbit computed: ${this.deepZoomManager.referenceOrbit.orbitLength} iterations`);
            }
        }
    }

    /**
     * Render frame
     */
    render() {
        const frameStart = performance.now();
        const gl = this.gl;

        // Update deep zoom state if needed
        this.updateDeepZoom();

        // Get current program (may be deep zoom shader if enabled)
        const current = this.fractalManager.getCurrent();
        const { program, uniforms, isDeepZoom } = current;
        gl.useProgram(program);

        // Adaptive quality: scale resolution based on performance
        const qualityMultiplier = this.quality.getQuality();
        const dpr = Math.min(window.devicePixelRatio || 1, 2) * qualityMultiplier;
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

        // Set standard uniforms
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
        // Rainbow mode flag - avoids per-pixel float comparisons in shader
        if (uniforms.u_isRainbow !== undefined) {
            gl.uniform1i(uniforms.u_isRainbow, colorScheme.id === 'rainbow' ? 1 : 0);
        }

        // Julia set specific uniform
        if (uniforms.u_juliaC) {
            const juliaC = this.fractalManager.juliaC;
            gl.uniform2f(uniforms.u_juliaC, juliaC[0], juliaC[1]);
        }

        // Deep zoom specific uniforms
        if (isDeepZoom && this.deepZoomManager.isEnabled) {
            const deepData = this.deepZoomManager.getShaderData();

            if (deepData && deepData.enabled && deepData.orbitTexture) {
                // Enable deep zoom in shader
                gl.uniform1i(uniforms.u_deepZoomEnabled, 1);

                // Reference point (hi/lo precision)
                gl.uniform4f(
                    uniforms.u_refPoint,
                    deepData.refRe.hi,
                    deepData.refRe.lo,
                    deepData.refIm.hi,
                    deepData.refIm.lo
                );

                // Orbit texture
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, deepData.orbitTexture.texture);
                gl.uniform1i(uniforms.u_orbitTexture, 0);
                gl.uniform2f(
                    uniforms.u_orbitTextureSize,
                    deepData.orbitTexture.width,
                    deepData.orbitTexture.height
                );
                gl.uniform1i(uniforms.u_orbitLength, deepData.orbitLength);

                // Debug logging (remove after fixing)
                if (!this._deepZoomLoggedOnce) {
                    console.log('Deep zoom active:', {
                        orbitLength: deepData.orbitLength,
                        textureSize: [deepData.orbitTexture.width, deepData.orbitTexture.height],
                        refPoint: [deepData.refRe.hi, deepData.refIm.hi]
                    });
                    this._deepZoomLoggedOnce = true;
                }
            } else {
                // Data not ready - fall back to standard
                gl.uniform1i(uniforms.u_deepZoomEnabled, 0);
                if (!this._deepZoomWarningLogged) {
                    console.warn('Deep zoom shader active but data not ready:', {
                        hasDeepData: !!deepData,
                        enabled: deepData?.enabled,
                        hasTexture: !!deepData?.orbitTexture
                    });
                    this._deepZoomWarningLogged = true;
                }
            }
        } else if (uniforms.u_deepZoomEnabled !== undefined) {
            // Explicitly disable deep zoom if uniform exists
            gl.uniform1i(uniforms.u_deepZoomEnabled, 0);
        }

        // Setup vertex attribute
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        const posLoc = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        // Draw
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // Track frame time for adaptive quality
        const frameTime = performance.now() - frameStart;
        this.quality.update(frameTime);

        // Update zoom indicator
        this.updateZoomIndicator(isDeepZoom);
    }

    /**
     * Format zoom level for display (e.g., "1x", "200Kx", "1.5Mx", "2.3Bx")
     */
    formatZoom(zoom) {
        if (zoom < 1) {
            // Zoom out - show as decimal
            if (zoom >= 0.001) {
                return `${zoom.toFixed(3)}x`;
            }
            // Very small zoom values
            const exp = Math.floor(Math.log10(zoom));
            const mantissa = zoom / Math.pow(10, exp);
            return `${mantissa.toFixed(2)}×10^${exp}`;
        }

        // Zoom in
        if (zoom < 1000) {
            return `${zoom.toFixed(1)}x`;
        } else if (zoom < 1000000) {
            return `${(zoom / 1000).toFixed(0)}Kx`;
        } else if (zoom < 1000000000) {
            return `${(zoom / 1000000).toFixed(1)}Mx`;
        } else if (zoom < 1000000000000) {
            return `${(zoom / 1000000000).toFixed(1)}Bx`;
        } else {
            // Very large zoom values - use scientific notation
            const exp = Math.floor(Math.log10(zoom));
            const mantissa = zoom / Math.pow(10, exp);
            return `${mantissa.toFixed(1)}×10^${exp}x`;
        }
    }

    /**
     * Update zoom indicator display
     */
    updateZoomIndicator(isDeepZoom = false) {
        if (!this.zoomIndicator) return;

        // Hide zoom indicator in photo mode (when all UI is hidden)
        if (this.uiControls && this.uiControls.allHidden) {
            this.zoomIndicator.classList.add('hidden');
            return;
        }

        const zoom = this.viewState.zoom;
        const formatted = this.formatZoom(zoom);
        const text = isDeepZoom ? `${formatted} deep` : formatted;
        
        this.zoomIndicator.textContent = text;
        
        // Show indicator (remove hidden class if present)
        this.zoomIndicator.classList.remove('hidden');
    }
}

// Start app when DOM is ready
console.log('app.js module loaded, checking DOM state...');
const startApp = () => {
    console.log('Starting app, creating FlyFractApp...');
    const app = new FlyFractApp();
    window.app = app; // Expose for debugging and thumbnail generation
    console.log('App created, calling init()...');
    app.init();
};

if (document.readyState === 'loading') {
    console.log('DOM still loading, waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOMContentLoaded fired');
        startApp();
    });
} else {
    console.log('DOM already ready, starting app immediately');
    startApp();
}
