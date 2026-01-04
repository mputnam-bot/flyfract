/**
 * Animation System
 * Smooth tweening for view transitions
 */

export class Animator {
    constructor() {
        this.animations = new Map();
        this.nextId = 0;
        this.running = false;
    }

    /**
     * Start the animation loop
     */
    start() {
        if (this.running) return;
        this.running = true;
        this.tick();
    }

    /**
     * Stop the animation loop
     */
    stop() {
        this.running = false;
    }

    /**
     * Animation tick
     */
    tick() {
        if (!this.running) return;

        const now = performance.now();
        const toRemove = [];

        for (const [id, anim] of this.animations) {
            const elapsed = now - anim.startTime;
            const progress = Math.min(1, elapsed / anim.duration);
            const easedProgress = this.ease(progress, anim.easing);

            // Calculate current value
            const current = anim.from + (anim.to - anim.from) * easedProgress;

            // Call update callback
            anim.onUpdate(current, easedProgress);

            // Check if complete
            if (progress >= 1) {
                if (anim.onComplete) {
                    anim.onComplete();
                }
                toRemove.push(id);
            }
        }

        // Remove completed animations
        for (const id of toRemove) {
            this.animations.delete(id);
        }

        requestAnimationFrame(() => this.tick());
    }

    /**
     * Create a new animation
     * @param {Object} options - Animation options
     * @returns {number} Animation ID
     */
    animate(options) {
        const id = this.nextId++;
        const anim = {
            from: options.from ?? 0,
            to: options.to ?? 1,
            duration: options.duration ?? 300,
            easing: options.easing ?? 'easeOutCubic',
            onUpdate: options.onUpdate ?? (() => {}),
            onComplete: options.onComplete,
            startTime: performance.now()
        };

        this.animations.set(id, anim);

        if (!this.running) {
            this.start();
        }

        return id;
    }

    /**
     * Cancel an animation
     */
    cancel(id) {
        this.animations.delete(id);
    }

    /**
     * Cancel all animations
     */
    cancelAll() {
        this.animations.clear();
    }

    /**
     * Check if any animations are running
     */
    isAnimating() {
        return this.animations.size > 0;
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
 * Animate zoom with smooth interpolation
 */
export function animateZoom(viewState, targetZoom, centerX, centerY, duration = 300, onUpdate, onComplete) {
    const animator = new Animator();
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

    animator.animate({
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

    return animator;
}
