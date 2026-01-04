/**
 * Animation Orchestrator
 * Unified animation loop that handles momentum, tweens, and rendering
 * in a single requestAnimationFrame loop to prevent frame desynchronization
 */

import { GestureBuffer } from '../gestures/buffer.js';

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

        // Iteration smoothing - prevents visible pop on gesture state change
        this.iterations = {
            current: 300,
            gestureTarget: 100,
            staticTarget: 300,
            transitionSpeed: 0.25  // Reaches target in ~4-5 frames
        };
    }

    /**
     * Get smoothed iteration count
     * Called each frame to get the current iteration target
     */
    getIterations() {
        const target = this.isGesturing ?
            this.iterations.gestureTarget :
            this.iterations.staticTarget;

        // Exponential interpolation for smooth transition
        this.iterations.current += (target - this.iterations.current) * this.iterations.transitionSpeed;

        // Snap when very close to avoid endless tiny updates
        if (Math.abs(this.iterations.current - target) < 5) {
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

        // 4. Single render call if needed
        if (shouldRender && this.renderCallback) {
            this.renderCallback();
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
 */
export function animateZoomWithOrchestrator(orchestrator, viewState, targetZoom, centerX, centerY, duration = 300, onUpdate, onComplete) {
    const startZoom = viewState.zoom;
    const startCenterX = viewState.centerX.hi;
    const startCenterY = viewState.centerY.hi;

    // Calculate target center to keep the zoom point stationary
    const minDim = Math.min(viewState.screenWidth, viewState.screenHeight);
    const screenCenterX = viewState.screenWidth / 2;
    const screenCenterY = viewState.screenHeight / 2;

    const offsetX = (centerX - screenCenterX);
    const offsetY = (centerY - screenCenterY);

    const startScale = 2.0 / startZoom;
    const endScale = 2.0 / targetZoom;

    const fractalX = offsetX * startScale / minDim;
    const fractalY = -offsetY * startScale / minDim;

    const targetCenterX = startCenterX + fractalX * (1 - startScale / endScale);
    const targetCenterY = startCenterY + fractalY * (1 - startScale / endScale);

    return orchestrator.animate({
        from: 0,
        to: 1,
        duration,
        easing: 'easeOutCubic',
        onUpdate: (_, progress) => {
            // Interpolate zoom logarithmically for smooth feel
            const startLog = Math.log2(startZoom);
            const endLog = Math.log2(targetZoom);
            const currentLog = startLog + (endLog - startLog) * progress;

            viewState.zoom = Math.pow(2, currentLog);
            viewState.zoomLog = currentLog;

            // Interpolate center
            viewState.centerX.hi = startCenterX + (targetCenterX - startCenterX) * progress;
            viewState.centerY.hi = startCenterY + (targetCenterY - startCenterY) * progress;

            if (onUpdate) onUpdate();
        },
        onComplete
    });
}
