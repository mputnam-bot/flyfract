/**
 * Gesture Controller
 * Unified touch and mouse gesture handling for pan, pinch/zoom, and double-tap/click
 */

import { isMobileDevice } from '../core/device.js';

export class GestureController {
    constructor(element, callbacks, orchestrator = null) {
        this.element = element;
        this.callbacks = callbacks;
        this.orchestrator = orchestrator;
        this.isMobile = isMobileDevice();

        // Touch tracking
        this.touches = new Map();
        this.state = 'idle'; // 'idle', 'pan', 'pinch', 'momentum'
        this.gestureStarted = false; // Track if gesture has actually started (movement detected)

        // Pan state
        this.lastCenter = { x: 0, y: 0 };
        this.velocity = { x: 0, y: 0 };
        this.lastMoveTime = 0;

        // Pinch state
        this.lastPinchDistance = 0;
        this.lastPinchCenter = { x: 0, y: 0 };
        this.lastPinchAngle = 0;

        // Double-tap/click detection
        this.lastTapTime = 0;
        this.lastTapPos = { x: 0, y: 0 };
        this.doubleTapCooldown = false;

        // Momentum animation (only used as fallback if no orchestrator)
        this.momentumFrame = null;

        // Mouse state
        this.isMouseDown = false;
        this.mouseButton = 0; // 0 = left, 2 = right
        this.mouseDownPos = { x: 0, y: 0 }; // Store initial mouse down position for click detection

        // Safari/Mac trackpad gesture state
        this.lastGestureRotation = 0;
        this.lastGestureScale = 1;

        this.bindEvents();
    }

    /**
     * Set the orchestrator (can be set after construction)
     */
    setOrchestrator(orchestrator) {
        this.orchestrator = orchestrator;
    }

    bindEvents() {
        const el = this.element;
        const opts = { passive: false };

        // Touch events (mobile)
        el.addEventListener('touchstart', this.onTouchStart.bind(this), opts);
        el.addEventListener('touchmove', this.onTouchMove.bind(this), opts);
        el.addEventListener('touchend', this.onTouchEnd.bind(this), opts);
        el.addEventListener('touchcancel', this.onTouchCancel.bind(this), opts);

        // Safari/Mac trackpad gesture events (rotation and pinch)
        el.addEventListener('gesturestart', this.onGestureStart.bind(this), opts);
        el.addEventListener('gesturechange', this.onGestureChange.bind(this), opts);
        el.addEventListener('gestureend', this.onGestureEnd.bind(this), opts);

        // Mouse events (desktop)
        if (!this.isMobile) {
            const mouseOpts = { passive: false, capture: true };
            el.addEventListener('mousedown', this.onMouseDown.bind(this), mouseOpts);
            el.addEventListener('mousemove', this.onMouseMove.bind(this), mouseOpts);
            el.addEventListener('mouseup', this.onMouseUp.bind(this), mouseOpts);
            el.addEventListener('mouseleave', this.onMouseLeave.bind(this), mouseOpts);
            el.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
            el.addEventListener('dblclick', this.onDoubleClick.bind(this));
            
            // Prevent context menu on right click
            el.addEventListener('contextmenu', e => e.preventDefault());
        }
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
            this.gestureStarted = false; // Reset - gesture starts on first movement

            // Don't call onGestureStart here - wait for actual movement
            // This prevents quality degradation when just touching without moving

        } else if (touchCount === 2) {
            // Two touches - switch to pinch
            this.state = 'pinch';
            this.initPinch();
            // For pinch, start gesture immediately since two fingers = intentional gesture
            if (this.callbacks.onGestureStart && !this.gestureStarted) {
                this.gestureStarted = true;
                this.callbacks.onGestureStart();
            }
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
            // Start gesture on first actual movement (not just touch)
            if (!this.gestureStarted && this.callbacks.onGestureStart) {
                this.gestureStarted = true;
                this.callbacks.onGestureStart();
            }
            this.handlePan();
        } else if (this.state === 'pinch' && this.touches.size === 2) {
            // Start gesture on first pinch movement if not already started
            if (!this.gestureStarted && this.callbacks.onGestureStart) {
                this.gestureStarted = true;
                this.callbacks.onGestureStart();
            }
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
        this.gestureStarted = false;

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
        this.lastPinchAngle = Math.atan2(dy, dx);
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
        
        // Calculate new angle
        const angle = Math.atan2(dy, dx);

        if (this.lastPinchDistance > 0) {
            // Calculate scale and pan
            const scale = distance / this.lastPinchDistance;
            const panX = center.x - this.lastPinchCenter.x;
            const panY = center.y - this.lastPinchCenter.y;

            // Calculate rotation delta
            let rotationDelta = angle - this.lastPinchAngle;
            // Normalize to [-π, π]
            if (rotationDelta > Math.PI) rotationDelta -= 2 * Math.PI;
            if (rotationDelta < -Math.PI) rotationDelta += 2 * Math.PI;

            // Apply pan first
            if (this.callbacks.onPan && (Math.abs(panX) > 0.5 || Math.abs(panY) > 0.5)) {
                this.callbacks.onPan(panX, panY);
            }

            // Apply rotation if significant
            if (this.callbacks.onRotate && Math.abs(rotationDelta) > 0.01) {
                this.callbacks.onRotate(rotationDelta, center.x, center.y);
            }

            // Apply zoom centered on the pinch center (midpoint between two fingers)
            // This ensures the zoom happens at the location where the user is pinching,
            // not at the center of the screen
            if (this.callbacks.onZoom && Math.abs(scale - 1) > 0.001) {
                this.callbacks.onZoom(scale, center.x, center.y);
            }
        }

        this.lastPinchDistance = distance;
        this.lastPinchCenter = center;
        this.lastPinchAngle = angle;
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

        // Use orchestrator if available (unified animation loop)
        if (this.orchestrator) {
            this.orchestrator.startMomentum(
                this.velocity.x,
                this.velocity.y,
                () => this.endGesture()
            );
            return;
        }

        // Fallback: run our own RAF loop (for backwards compatibility)
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
        this.gestureStarted = false; // Reset gesture state

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

    // ========== Mouse Event Handlers (Desktop) ==========

    onMouseDown(e) {
        e.preventDefault();
        e.stopPropagation();
        this.isMouseDown = true;
        this.mouseButton = e.button;

        // Cancel momentum if running
        if (this.momentumFrame) {
            cancelAnimationFrame(this.momentumFrame);
            this.momentumFrame = null;
        }

        // Left button = pan, Right button = rotate
        if (e.button === 0) { // Left button - pan
            this.mouseDownPos = { x: e.clientX, y: e.clientY };
            this.lastCenter = { x: e.clientX, y: e.clientY };
            this.lastMoveTime = performance.now();
            this.velocity = { x: 0, y: 0 };
            this.state = 'pan';
            this.gestureStarted = false; // Reset - gesture starts on first movement

            // Don't call onGestureStart here - wait for actual movement
        } else if (e.button === 2) { // Right button - rotate
            this.mouseDownPos = { x: e.clientX, y: e.clientY };
            this.lastCenter = { x: e.clientX, y: e.clientY };
            this.state = 'rotate';
            this.gestureStarted = false; // Reset - gesture starts on first movement

            // Don't call onGestureStart here - wait for actual movement
        }
    }

    onMouseMove(e) {
        if (!this.isMouseDown) return;
        if (this.state !== 'pan' && this.state !== 'rotate') return;

        e.preventDefault();
        e.stopPropagation();

        const dx = e.clientX - this.lastCenter.x;
        const dy = e.clientY - this.lastCenter.y;

        if (this.state === 'pan') {
            // Start gesture on first actual movement (not just mouse down)
            if (!this.gestureStarted && this.callbacks.onGestureStart) {
                this.gestureStarted = true;
                this.callbacks.onGestureStart();
            }

            // Calculate velocity for momentum
            const now = performance.now();
            const dt = now - this.lastMoveTime;
            if (dt > 0 && dt < 100) {
                const newVelX = (dx / dt) * 16;
                const newVelY = (dy / dt) * 16;
                this.velocity.x = this.velocity.x * 0.5 + newVelX * 0.5;
                this.velocity.y = this.velocity.y * 0.5 + newVelY * 0.5;
            }
            this.lastMoveTime = now;

            if (this.callbacks.onPan) {
                this.callbacks.onPan(dx, dy);
            }
        } else if (this.state === 'rotate') {
            // Start gesture on first actual rotation movement
            if (!this.gestureStarted && this.callbacks.onGestureStart) {
                this.gestureStarted = true;
                this.callbacks.onGestureStart();
            }
            // Rotate based on vertical drag
            // Drag up = clockwise (positive angle), drag down = counter-clockwise (negative)
            const rotationSensitivity = 0.01; // radians per pixel
            const angle = -dy * rotationSensitivity; // negative because screen Y is inverted

            if (this.callbacks.onRotate) {
                // Rotate around screen center
                const centerX = window.innerWidth / 2;
                const centerY = window.innerHeight / 2;
                this.callbacks.onRotate(angle, centerX, centerY);
            }
        }

        this.lastCenter = { x: e.clientX, y: e.clientY };
    }

    onMouseUp(e) {
        if (!this.isMouseDown) return;

        e.preventDefault();
        e.stopPropagation();
        
        const wasPanning = this.state === 'pan';
        const wasRotating = this.state === 'rotate';
        this.isMouseDown = false;

        if (wasPanning) {
            // Check if it was a click (didn't move much)
            // Use the initial mouse down position, not the last move position
            const dx = e.clientX - this.mouseDownPos.x;
            const dy = e.clientY - this.mouseDownPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 5) {
                // It was a click, check for double-click
                this.handleTap(e.clientX, e.clientY);
            } else if (Math.abs(this.velocity.x) > 1 || Math.abs(this.velocity.y) > 1) {
                // Had velocity, start momentum
                this.startMomentum();
            } else {
                this.endGesture();
            }
        } else if (wasRotating) {
            // Rotation complete, no momentum for rotation
            this.endGesture();
        } else {
            this.endGesture();
        }
    }

    onMouseLeave(e) {
        // Treat mouse leave as mouse up
        if (this.isMouseDown) {
            this.onMouseUp(e);
        }
    }

    onWheel(e) {
        e.preventDefault();

        // Trigger gesture start immediately (for showing UI in photo mode)
        if (this.state === 'idle' && this.callbacks.onGestureStart) {
            this.callbacks.onGestureStart();
        }

        let zoomFactor;

        // Chrome/Mac trackpad pinch: ctrlKey is true, deltaY is the pinch amount
        if (e.ctrlKey) {
            // Trackpad pinch - use continuous zoom based on delta
            // deltaY is negative for pinch-out (zoom in), positive for pinch-in (zoom out)
            const pinchSensitivity = 0.01;
            zoomFactor = 1 - (e.deltaY * pinchSensitivity);
            // Clamp to reasonable range
            zoomFactor = Math.max(0.5, Math.min(2, zoomFactor));
        } else {
            // Regular scroll wheel - use discrete zoom steps
            // Negative deltaY = scroll up = zoom in
            // Positive deltaY = scroll down = zoom out
            zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        }

        // Zoom centered on mouse position
        if (this.callbacks.onZoom) {
            this.callbacks.onZoom(zoomFactor, e.clientX, e.clientY);
        }

        // End gesture after a short delay
        clearTimeout(this.wheelTimeout);
        this.wheelTimeout = setTimeout(() => {
            if (this.callbacks.onGestureEnd) {
                this.callbacks.onGestureEnd();
            }
            this.state = 'idle';
        }, 150);
    }

    onDoubleClick(e) {
        e.preventDefault();

        // Zoom in centered on click position
        if (this.callbacks.onDoubleTap) {
            this.callbacks.onDoubleTap(e.clientX, e.clientY);
        }
    }

    // ========== Safari/Mac Trackpad Gesture Handlers ==========

    onGestureStart(e) {
        e.preventDefault();

        // Reset tracking values
        this.lastGestureRotation = e.rotation || 0;
        this.lastGestureScale = e.scale || 1;

        if (this.callbacks.onGestureStart) {
            this.callbacks.onGestureStart();
        }
    }

    onGestureChange(e) {
        e.preventDefault();

        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        // Handle rotation (degrees to radians)
        if (e.rotation !== undefined) {
            const rotationDelta = e.rotation - this.lastGestureRotation;
            const angleRadians = (rotationDelta * Math.PI) / 180;

            if (Math.abs(angleRadians) > 0.001 && this.callbacks.onRotate) {
                this.callbacks.onRotate(angleRadians, centerX, centerY);
            }

            this.lastGestureRotation = e.rotation;
        }

        // Handle pinch zoom
        if (e.scale !== undefined) {
            const scaleDelta = e.scale / this.lastGestureScale;

            if (Math.abs(scaleDelta - 1) > 0.001 && this.callbacks.onZoom) {
                this.callbacks.onZoom(scaleDelta, centerX, centerY);
            }

            this.lastGestureScale = e.scale;
        }
    }

    onGestureEnd(e) {
        e.preventDefault();

        // Reset tracking values
        this.lastGestureRotation = 0;
        this.lastGestureScale = 1;

        if (this.callbacks.onGestureEnd) {
            this.callbacks.onGestureEnd();
        }
    }
}
