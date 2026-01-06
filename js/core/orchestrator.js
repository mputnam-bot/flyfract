/**
 * Animation Orchestrator
 * Unified animation loop that handles momentum, tweens, and rendering
 * in a single requestAnimationFrame loop to prevent frame desynchronization
 */

import { GestureBuffer } from '../gestures/buffer.js';
import { isMobileDevice } from './device.js';

export class AnimationOrchestrator {
    constructor() {
        // Animation state
        this.tweens = new Map();
        this.nextTweenId = 0;

        // Momentum state
        this.momentum = null;

        // Gesture buffer for batching inputs
        this.gestureBuffer = new GestureBuffer();

        // Render callback
        this.renderCallback = null;
        this.viewState = null;

        // Loop state
        this.running = false;
        this.lastTime = 0;
        this.needsRender = true;

        // Gesture state tracking
        this.isGesturing = false;

        // Momentum physics
        this.FRICTION = 0.94;
        this.MIN_VELOCITY = 0.5;
        this.MAX_VELOCITY = 100;

        // FPS throttling for mobile static view (saves battery)
        this.isMobile = isMobileDevice();
        this.staticFPSLimit = 30;  // Limit FPS when static on mobile
        this.lastRenderTime = 0;
        this.minFrameInterval = 1000 / this.staticFPSLimit;

        // Iteration smoothing - prevents visible pop on gesture state change
        this.iterations = {
            current: 300,
            gestureTarget: 100,
            staticTarget: 300,
            transitionSpeed: 0.25,  // Reaches target in ~4-5 frames
            zoomScaleFactor: 12,    // Extra iterations per zoom doubling
            maxIterations: 1500     // Hard cap to prevent GPU stalls
        };
    }

    /**
     * Get smoothed iteration count
     * Called each frame to get the current iteration target
     * Factors in zoom level for better detail at deep zooms
     */
    getIterations() {
        const baseTarget = this.isGesturing ?
            this.iterations.gestureTarget :
            this.iterations.staticTarget;

        // Add zoom-adaptive scaling: more iterations at deeper zooms
        // Use smooth calculation instead of Math.floor to prevent flickering
        let zoomBonus = 0;
        if (this.viewState && this.viewState.zoomLog > 0) {
            // Calculate zoom bonus smoothly without discrete jumps
            zoomBonus = this.viewState.zoomLog * this.iterations.zoomScaleFactor;
        }

        const target = Math.min(
            baseTarget + zoomBonus,
            this.iterations.maxIterations
        );

        // Faster transition speed for smoother zoom experience
        const transitionSpeed = this.isGesturing ? 0.35 : 0.2;

        // Exponential interpolation for smooth transition
        this.iterations.current += (target - this.iterations.current) * transitionSpeed;

        // Snap when very close to avoid endless tiny updates
        if (Math.abs(this.iterations.current - target) < 2) {
            this.iterations.current = target;
        }

        return Math.floor(this.iterations.current);
    }

    /**
     * Configure iteration targets (for device-specific tuning)
     */
    setIterationTargets(gestureTarget, staticTarget) {
        this.iterations.gestureTarget = gestureTarget;
        this.iterations.staticTarget = staticTarget;
    }

    /**
     * Initialize the orchestrator with callbacks
     */
    init(viewState, renderCallback) {
        this.viewState = viewState;
        this.renderCallback = renderCallback;
    }

    /**
     * Start the main animation loop
     */
    start() {
        if (this.running) return;
        this.running = true;
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.tick(t));
    }

    /**
     * Stop the animation loop
     */
    stop() {
        this.running = false;
    }

    /**
     * Main tick function - single RAF loop for everything
     */
    tick(timestamp) {
        if (!this.running) return;

        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        let shouldRender = this.needsRender;
        const isAnimating = this.momentum !== null || this.tweens.size > 0;

        // 1. Flush buffered gesture inputs atomically
        if (this.gestureBuffer.hasPending() && this.viewState) {
            this.gestureBuffer.flush(this.viewState);
            shouldRender = true;
        }

        // 2. Process momentum
        if (this.momentum) {
            this.updateMomentum();
            shouldRender = true;
        }

        // 3. Process active tweens
        const completedTweens = [];
        for (const [id, tween] of this.tweens) {
            const elapsed = timestamp - tween.startTime;
            const progress = Math.min(1, elapsed / tween.duration);
            const easedProgress = this.ease(progress, tween.easing);

            // Calculate current value
            const current = tween.from + (tween.to - tween.from) * easedProgress;

            // Call update callback
            tween.onUpdate(current, easedProgress);
            shouldRender = true;

            // Check if complete
            if (progress >= 1) {
                if (tween.onComplete) {
                    tween.onComplete();
                }
                completedTweens.push(id);
            }
        }

        // Remove completed tweens
        for (const id of completedTweens) {
            this.tweens.delete(id);
        }

        // 4. FPS throttling for mobile static view (saves battery)
        // Only throttle when: mobile + static + not gesturing + not animating
        if (shouldRender && this.isMobile && !this.isGesturing && !isAnimating) {
            const timeSinceLastRender = timestamp - this.lastRenderTime;
            if (timeSinceLastRender < this.minFrameInterval) {
                shouldRender = false;
            }
        }

        // 5. Single render call if needed
        if (shouldRender && this.renderCallback) {
            this.renderCallback();
            this.lastRenderTime = timestamp;
        }

        // Reset render flag unless gesturing
        this.needsRender = this.isGesturing;

        // Continue loop
        requestAnimationFrame((t) => this.tick(t));
    }

    /**
     * Update momentum physics
     */
    updateMomentum() {
        if (!this.momentum || !this.viewState) return;

        const { vx, vy } = this.momentum;

        // Apply pan
        this.viewState.pan(vx, vy);

        // Apply friction
        this.momentum.vx *= this.FRICTION;
        this.momentum.vy *= this.FRICTION;

        // Check if should stop
        if (Math.abs(this.momentum.vx) < this.MIN_VELOCITY &&
            Math.abs(this.momentum.vy) < this.MIN_VELOCITY) {
            this.momentum = null;
            // Gesture end callback if provided
            if (this.onGestureEnd) {
                this.onGestureEnd();
            }
        }
    }

    /**
     * Start momentum animation (called from gesture controller)
     */
    startMomentum(velocityX, velocityY, onEnd) {
        // Clamp velocities
        const vx = Math.max(-this.MAX_VELOCITY, Math.min(this.MAX_VELOCITY, velocityX));
        const vy = Math.max(-this.MAX_VELOCITY, Math.min(this.MAX_VELOCITY, velocityY));

        this.momentum = { vx, vy };
        this.onGestureEnd = onEnd;
    }

    /**
     * Stop momentum immediately
     */
    stopMomentum() {
        this.momentum = null;
    }

    /**
     * Create a new tween animation
     */
    animate(options) {
        const id = this.nextTweenId++;
        const tween = {
            from: options.from ?? 0,
            to: options.to ?? 1,
            duration: options.duration ?? 300,
            easing: options.easing ?? 'easeOutCubic',
            onUpdate: options.onUpdate ?? (() => {}),
            onComplete: options.onComplete,
            startTime: performance.now()
        };

        this.tweens.set(id, tween);
        return id;
    }

    /**
     * Cancel a specific tween
     */
    cancelTween(id) {
        this.tweens.delete(id);
    }

    /**
     * Cancel all tweens
     */
    cancelAllTweens() {
        this.tweens.clear();
    }

    /**
     * Request a render on next frame
     */
    requestRender() {
        this.needsRender = true;
    }

    /**
     * Buffer a pan gesture (applied atomically on next tick)
     */
    bufferPan(dx, dy) {
        this.gestureBuffer.addPan(dx, dy);
    }

    /**
     * Buffer a zoom gesture (applied atomically on next tick)
     */
    bufferZoom(scale, cx, cy) {
        this.gestureBuffer.addZoom(scale, cx, cy);
    }

    /**
     * Buffer a rotation gesture (applied atomically on next tick)
     */
    bufferRotation(angle, cx, cy) {
        this.gestureBuffer.addRotation(angle, cx, cy);
    }

    /**
     * Set gesture state
     */
    setGesturing(isGesturing) {
        this.isGesturing = isGesturing;
        if (isGesturing) {
            // Cancel momentum when new gesture starts
            this.momentum = null;
        }
    }

    /**
     * Check if any animation is active
     */
    isAnimating() {
        return this.momentum !== null || this.tweens.size > 0;
    }

    /**
     * Easing functions
     */
    ease(t, type) {
        switch (type) {
            case 'linear':
                return t;

            case 'easeInQuad':
                return t * t;

            case 'easeOutQuad':
                return t * (2 - t);

            case 'easeInOutQuad':
                return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

            case 'easeInCubic':
                return t * t * t;

            case 'easeOutCubic':
                return (--t) * t * t + 1;

            case 'easeInOutCubic':
                return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;

            case 'easeOutExpo':
                return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

            case 'easeOutBack':
                const c1 = 1.70158;
                const c3 = c1 + 1;
                return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);

            default:
                return t;
        }
    }
}

/**
 * Animate zoom with smooth interpolation (uses orchestrator)
 * Zooms in and recenters the view so the tapped point ends up at the screen center
 */
export function animateZoomWithOrchestrator(orchestrator, viewState, targetZoom, tapX, tapY, duration = 300, onUpdate, onComplete) {
    const startZoom = viewState.zoom;
    const startCenterX = viewState.centerX;
    const startCenterY = viewState.centerY;
    const minDim = Math.min(viewState.screenWidth, viewState.screenHeight);
    const screenCenterX = viewState.screenWidth / 2;
    const screenCenterY = viewState.screenHeight / 2;
    
    // Calculate the fractal-space point that corresponds to the tap location at start zoom
    const startScale = 2.0 / (startZoom * minDim);
    const fractalX = (tapX - screenCenterX) * startScale;
    const fractalY = -(tapY - screenCenterY) * startScale;
    
    // The absolute fractal coordinate of the tapped point
    const tappedFractalX = startCenterX.hi + fractalX;
    const tappedFractalY = startCenterY.hi + fractalY;
    
    // At target zoom, we want this fractal point to be at screen center
    // At screen center, the fractal offset is 0, so the center should be the tapped point
    const targetCenterXHi = tappedFractalX;
    const targetCenterYHi = tappedFractalY;
    
    const startLog = Math.log2(startZoom);
    const endLog = Math.log2(targetZoom);

    return orchestrator.animate({
        from: 0,
        to: 1,
        duration,
        easing: 'easeOutCubic',
        onUpdate: (_, progress) => {
            // Interpolate zoom logarithmically for smooth feel
            const currentLog = startLog + (endLog - startLog) * progress;
            const currentZoom = Math.pow(2, currentLog);
            
            viewState.zoom = currentZoom;
            viewState.zoomLog = currentLog;

            // Interpolate center smoothly (preserving double-precision structure)
            // This will move the tapped point toward the screen center as we zoom
            const currentCenterXHi = startCenterX.hi + (targetCenterXHi - startCenterX.hi) * progress;
            const currentCenterYHi = startCenterY.hi + (targetCenterYHi - startCenterY.hi) * progress;
            
            // Update center using dsSplit to preserve precision
            viewState.centerX = viewState.dsSplit(currentCenterXHi);
            viewState.centerY = viewState.dsSplit(currentCenterYHi);
            
            // Renormalize periodically
            viewState.centerX = viewState.dsRenorm(viewState.centerX);
            viewState.centerY = viewState.dsRenorm(viewState.centerY);

            if (onUpdate) onUpdate();
        },
        onComplete
    });
}
