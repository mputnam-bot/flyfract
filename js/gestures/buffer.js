/**
 * Gesture Buffer
 * Accumulates gesture inputs and applies them once per frame
 * This prevents multiple renders when gesture events arrive at high frequency
 */

export class GestureBuffer {
    constructor() {
        this.reset();
    }

    /**
     * Reset all pending gestures
     */
    reset() {
        this.pendingPan = { dx: 0, dy: 0 };
        this.pendingZoom = { scale: 1, cx: 0, cy: 0, hasZoom: false };
        this.pendingRotation = { angle: 0, cx: 0, cy: 0, hasRotation: false };
        this.hasPendingChanges = false;
    }

    /**
     * Add a pan gesture
     */
    addPan(dx, dy) {
        this.pendingPan.dx += dx;
        this.pendingPan.dy += dy;
        this.hasPendingChanges = true;
    }

    /**
     * Add a zoom gesture
     * Multiple zooms accumulate multiplicatively
     */
    addZoom(scale, cx, cy) {
        if (this.pendingZoom.hasZoom) {
            // Accumulate zoom multiplicatively
            this.pendingZoom.scale *= scale;
            // Use latest center (most recent finger position)
            this.pendingZoom.cx = cx;
            this.pendingZoom.cy = cy;
        } else {
            this.pendingZoom.scale = scale;
            this.pendingZoom.cx = cx;
            this.pendingZoom.cy = cy;
            this.pendingZoom.hasZoom = true;
        }
        this.hasPendingChanges = true;
    }

    /**
     * Add a rotation gesture
     */
    addRotation(angle, cx, cy) {
        this.pendingRotation.angle += angle;
        this.pendingRotation.cx = cx;
        this.pendingRotation.cy = cy;
        this.pendingRotation.hasRotation = true;
        this.hasPendingChanges = true;
    }

    /**
     * Check if there are pending changes
     */
    hasPending() {
        return this.hasPendingChanges;
    }

    /**
     * Flush all pending gestures to the view state
     * Returns true if any changes were applied
     */
    flush(viewState) {
        if (!this.hasPendingChanges) {
            return false;
        }

        // Apply pan first (so zoom centers are correct)
        if (this.pendingPan.dx !== 0 || this.pendingPan.dy !== 0) {
            viewState.pan(this.pendingPan.dx, this.pendingPan.dy);
        }

        // Apply rotation
        if (this.pendingRotation.hasRotation) {
            viewState.rotate(
                this.pendingRotation.angle,
                this.pendingRotation.cx,
                this.pendingRotation.cy
            );
        }

        // Apply zoom last (so it zooms toward correct point)
        if (this.pendingZoom.hasZoom) {
            viewState.zoomAt(
                this.pendingZoom.scale,
                this.pendingZoom.cx,
                this.pendingZoom.cy
            );
        }

        this.reset();
        return true;
    }
}
