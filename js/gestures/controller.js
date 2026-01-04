/**
 * Gesture Controller
 * Unified touch gesture handling for pan, pinch, and double-tap
 */

export class GestureController {
    constructor(element, callbacks) {
        this.element = element;
        this.callbacks = callbacks;

        // Touch tracking
        this.touches = new Map();
        this.state = 'idle'; // 'idle', 'pan', 'pinch', 'momentum'

        // Pan state
        this.lastCenter = { x: 0, y: 0 };
        this.velocity = { x: 0, y: 0 };
        this.lastMoveTime = 0;

        // Pinch state
        this.lastPinchDistance = 0;
        this.lastPinchCenter = { x: 0, y: 0 };

        // Double-tap detection
        this.lastTapTime = 0;
        this.lastTapPos = { x: 0, y: 0 };
        this.doubleTapCooldown = false;

        // Momentum animation
        this.momentumFrame = null;

        this.bindEvents();
    }

    bindEvents() {
        const el = this.element;
        const opts = { passive: false };

        el.addEventListener('touchstart', this.onTouchStart.bind(this), opts);
        el.addEventListener('touchmove', this.onTouchMove.bind(this), opts);
        el.addEventListener('touchend', this.onTouchEnd.bind(this), opts);
        el.addEventListener('touchcancel', this.onTouchCancel.bind(this), opts);

        // Prevent Safari gestures
        el.addEventListener('gesturestart', e => e.preventDefault(), opts);
        el.addEventListener('gesturechange', e => e.preventDefault(), opts);
        el.addEventListener('gestureend', e => e.preventDefault(), opts);
    }

    onTouchStart(e) {
        e.preventDefault();

        // Cancel momentum if running
        if (this.momentumFrame) {
            cancelAnimationFrame(this.momentumFrame);
            this.momentumFrame = null;
        }

        // Track touches
        for (const touch of e.changedTouches) {
            this.touches.set(touch.identifier, {
                x: touch.clientX,
                y: touch.clientY
            });
        }

        const touchCount = this.touches.size;

        if (touchCount === 1) {
            // Single touch - prepare for pan or double-tap
            const touch = Array.from(this.touches.values())[0];
            this.lastCenter = { ...touch };
            this.lastMoveTime = performance.now();
            this.velocity = { x: 0, y: 0 };
            this.state = 'pan';

            if (this.callbacks.onGestureStart) {
                this.callbacks.onGestureStart();
            }

        } else if (touchCount === 2) {
            // Two touches - switch to pinch
            this.state = 'pinch';
            this.initPinch();
        }
    }

    onTouchMove(e) {
        e.preventDefault();

        // Update touch positions
        for (const touch of e.changedTouches) {
            if (this.touches.has(touch.identifier)) {
                this.touches.set(touch.identifier, {
                    x: touch.clientX,
                    y: touch.clientY
                });
            }
        }

        if (this.state === 'pan' && this.touches.size === 1) {
            this.handlePan();
        } else if (this.state === 'pinch' && this.touches.size === 2) {
            this.handlePinch();
        }
    }

    onTouchEnd(e) {
        e.preventDefault();

        const wasPan = this.state === 'pan' && this.touches.size === 1;

        // Check for tap before removing touch
        if (this.touches.size === 1 && e.changedTouches.length === 1) {
            const touch = e.changedTouches[0];
            const startPos = this.touches.get(touch.identifier);

            if (startPos) {
                const dx = touch.clientX - startPos.x;
                const dy = touch.clientY - startPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // If touch didn't move much, it's a tap
                if (distance < 10) {
                    this.handleTap(touch.clientX, touch.clientY);
                }
            }
        }

        // Remove ended touches
        for (const touch of e.changedTouches) {
            this.touches.delete(touch.identifier);
        }

        const touchCount = this.touches.size;

        if (touchCount === 0) {
            // All touches ended
            if (wasPan && (Math.abs(this.velocity.x) > 1 || Math.abs(this.velocity.y) > 1)) {
                this.startMomentum();
            } else {
                this.endGesture();
            }
        } else if (touchCount === 1 && this.state === 'pinch') {
            // Dropped from pinch to pan
            const touch = Array.from(this.touches.values())[0];
            this.lastCenter = { ...touch };
            this.lastMoveTime = performance.now();
            this.state = 'pan';
        }
    }

    onTouchCancel(e) {
        e.preventDefault();

        // Clear all touches
        this.touches.clear();
        this.state = 'idle';
        this.velocity = { x: 0, y: 0 };

        if (this.momentumFrame) {
            cancelAnimationFrame(this.momentumFrame);
            this.momentumFrame = null;
        }

        if (this.callbacks.onGestureEnd) {
            this.callbacks.onGestureEnd();
        }
    }

    initPinch() {
        const touches = Array.from(this.touches.values());
        if (touches.length < 2) return;

        const [t1, t2] = touches;

        this.lastPinchCenter = {
            x: (t1.x + t2.x) / 2,
            y: (t1.y + t2.y) / 2
        };

        const dx = t2.x - t1.x;
        const dy = t2.y - t1.y;
        this.lastPinchDistance = Math.sqrt(dx * dx + dy * dy);
    }

    handlePan() {
        const touch = Array.from(this.touches.values())[0];
        if (!touch) return;

        const dx = touch.x - this.lastCenter.x;
        const dy = touch.y - this.lastCenter.y;

        // Calculate velocity for momentum
        const now = performance.now();
        const dt = now - this.lastMoveTime;
        if (dt > 0 && dt < 100) {
            // Smooth velocity calculation
            const newVelX = (dx / dt) * 16;
            const newVelY = (dy / dt) * 16;
            this.velocity.x = this.velocity.x * 0.5 + newVelX * 0.5;
            this.velocity.y = this.velocity.y * 0.5 + newVelY * 0.5;
        }
        this.lastMoveTime = now;

        if (this.callbacks.onPan) {
            this.callbacks.onPan(dx, dy);
        }

        this.lastCenter = { ...touch };
    }

    handlePinch() {
        const touches = Array.from(this.touches.values());
        if (touches.length < 2) return;

        const [t1, t2] = touches;

        // Calculate new center
        const center = {
            x: (t1.x + t2.x) / 2,
            y: (t1.y + t2.y) / 2
        };

        // Calculate new distance
        const dx = t2.x - t1.x;
        const dy = t2.y - t1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (this.lastPinchDistance > 0) {
            // Calculate scale and pan
            const scale = distance / this.lastPinchDistance;
            const panX = center.x - this.lastPinchCenter.x;
            const panY = center.y - this.lastPinchCenter.y;

            // Apply pan first
            if (this.callbacks.onPan && (Math.abs(panX) > 0.5 || Math.abs(panY) > 0.5)) {
                this.callbacks.onPan(panX, panY);
            }

            // Then apply zoom
            if (this.callbacks.onZoom && Math.abs(scale - 1) > 0.001) {
                this.callbacks.onZoom(scale, center.x, center.y);
            }
        }

        this.lastPinchDistance = distance;
        this.lastPinchCenter = center;
    }

    handleTap(x, y) {
        const now = performance.now();
        const timeDelta = now - this.lastTapTime;
        const dx = x - this.lastTapPos.x;
        const dy = y - this.lastTapPos.y;
        const posDelta = Math.sqrt(dx * dx + dy * dy);

        // Double-tap detection: 300ms window, 40px tolerance
        if (timeDelta < 300 && posDelta < 40 && !this.doubleTapCooldown) {
            if (this.callbacks.onDoubleTap) {
                this.callbacks.onDoubleTap(x, y);
            }
            this.lastTapTime = 0;

            // Set cooldown to prevent triple-tap
            this.doubleTapCooldown = true;
            setTimeout(() => {
                this.doubleTapCooldown = false;
            }, 300);
        } else {
            this.lastTapTime = now;
            this.lastTapPos = { x, y };
        }
    }

    startMomentum() {
        this.state = 'momentum';

        const friction = 0.94;
        const minVelocity = 0.5;

        const animate = () => {
            if (Math.abs(this.velocity.x) < minVelocity &&
                Math.abs(this.velocity.y) < minVelocity) {
                this.endGesture();
                return;
            }

            if (this.callbacks.onPan) {
                this.callbacks.onPan(this.velocity.x, this.velocity.y);
            }

            this.velocity.x *= friction;
            this.velocity.y *= friction;

            this.momentumFrame = requestAnimationFrame(animate);
        };

        this.momentumFrame = requestAnimationFrame(animate);
    }

    endGesture() {
        this.state = 'idle';
        this.momentumFrame = null;

        if (this.callbacks.onGestureEnd) {
            this.callbacks.onGestureEnd();
        }
    }

    /**
     * Check if a gesture is currently active
     */
    isGesturing() {
        return this.state !== 'idle';
    }
}
