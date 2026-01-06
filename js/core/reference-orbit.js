/**
 * Reference Orbit Calculator for Perturbation Theory
 *
 * Perturbation theory allows deep zoom by:
 * 1. Computing one reference orbit Z_n at the center using arbitrary precision
 * 2. For each pixel, computing small deltas from the reference using single precision
 *
 * The delta formula is: δ_{n+1} = 2 * Z_n * δ_n + δ_n² + δ_c
 * where δ_c = pixel_c - reference_c
 *
 * This works because Z_n dominates the calculation at deep zoom,
 * and δ values stay small (near machine precision).
 */

import { BigFloat, BigComplex, getPrecisionForZoom } from './bigfloat.js';

// Maximum iterations we'll compute for reference orbit
const MAX_REFERENCE_ITERATIONS = 100000;

// Escape radius squared
const ESCAPE_RADIUS_SQ = 256.0;  // Using 16^2 for stability

// Texture size limits for orbit storage
const MAX_ORBIT_TEXTURE_SIZE = 4096;

export class ReferenceOrbit {
    constructor() {
        // Current reference point (arbitrary precision)
        this.refPoint = null;

        // Reference orbit data (stored as Float32 for GPU transfer)
        // Each iteration stores: [Z_n.re, Z_n.im]
        this.orbitRe = null;
        this.orbitIm = null;
        this.orbitLength = 0;

        // Precomputed 2*Z_n values for the delta formula
        this.orbit2Re = null;
        this.orbit2Im = null;

        // Reference point as hi/lo pairs
        this.refHiLo = null;

        // Computation state
        this.isComputing = false;
        this.computeProgress = 0;

        // Cached zoom level for invalidation
        this.cachedZoomLog = -Infinity;
        this.cachedCenterX = null;
        this.cachedCenterY = null;
    }

    /**
     * Check if reference orbit needs recomputation
     */
    needsUpdate(centerX, centerY, zoomLog, maxIter) {
        // If we have no orbit, definitely need one
        if (!this.orbitRe || this.orbitLength === 0) {
            return true;
        }

        // If center moved significantly (more than pixel-level at current zoom)
        // The threshold gets smaller as we zoom in
        const threshold = Math.pow(2, -zoomLog - 20);  // Sub-pixel movement
        const dx = Math.abs(centerX - this.cachedCenterX);
        const dy = Math.abs(centerY - this.cachedCenterY);

        if (dx > threshold || dy > threshold) {
            return true;
        }

        // If we need more iterations than we computed
        if (maxIter > this.orbitLength * 0.9) {  // 90% threshold for buffer
            return true;
        }

        return false;
    }

    /**
     * Compute reference orbit at the given center point
     * @param {number} centerX - Real part of center
     * @param {number} centerY - Imaginary part of center
     * @param {number} zoomLog - Log2 of zoom level
     * @param {number} maxIter - Maximum iterations to compute
     * @param {function} onProgress - Progress callback (0-1)
     * @returns {Promise<void>}
     */
    async compute(centerX, centerY, zoomLog, maxIter, onProgress) {
        if (this.isComputing) {
            return;  // Don't interrupt ongoing computation
        }

        this.isComputing = true;
        this.computeProgress = 0;

        try {
            // Determine precision needed for this zoom level
            const precision = getPrecisionForZoom(zoomLog);

            // Create reference point with appropriate precision
            const c = new BigComplex(centerX, centerY, precision);
            this.refPoint = c;
            this.refHiLo = c.toHiLo();

            // Allocate orbit storage
            const iterLimit = Math.min(maxIter * 2, MAX_REFERENCE_ITERATIONS);  // Extra buffer
            this.orbitRe = new Float32Array(iterLimit);
            this.orbitIm = new Float32Array(iterLimit);
            this.orbit2Re = new Float32Array(iterLimit);
            this.orbit2Im = new Float32Array(iterLimit);

            // Iterate z = z² + c
            let z = new BigComplex(0, 0, precision);
            let iteration = 0;

            // Process in chunks for responsiveness
            const chunkSize = 1000;

            while (iteration < iterLimit) {
                // Process a chunk
                const chunkEnd = Math.min(iteration + chunkSize, iterLimit);

                for (; iteration < chunkEnd; iteration++) {
                    // Store current Z_n
                    const zNums = z.toNumbers();
                    this.orbitRe[iteration] = zNums.re;
                    this.orbitIm[iteration] = zNums.im;
                    this.orbit2Re[iteration] = 2 * zNums.re;
                    this.orbit2Im[iteration] = 2 * zNums.im;

                    // Check escape
                    const magSq = z.magnitudeSquared();
                    if (magSq > ESCAPE_RADIUS_SQ) {
                        break;
                    }

                    // Iterate: z = z² + c
                    z = z.square().add(c);
                }

                // Update progress and yield to event loop
                this.computeProgress = iteration / iterLimit;
                if (onProgress) {
                    onProgress(this.computeProgress);
                }

                // Check if we escaped
                if (z.magnitudeSquared() > ESCAPE_RADIUS_SQ) {
                    break;
                }

                // Yield to keep UI responsive
                if (iteration < iterLimit) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            this.orbitLength = iteration;

            // Cache for invalidation checks
            this.cachedCenterX = centerX;
            this.cachedCenterY = centerY;
            this.cachedZoomLog = zoomLog;

        } finally {
            this.isComputing = false;
            if (onProgress) {
                onProgress(1);
            }
        }
    }

    /**
     * Compute reference orbit synchronously (for small iterations)
     * Faster but blocks the main thread
     */
    computeSync(centerX, centerY, zoomLog, maxIter) {
        // For now, use standard JavaScript numbers for orbit computation
        // The BigFloat implementation has bugs - this simpler approach works for moderate zoom
        // TODO: Fix BigFloat for extreme deep zoom (>10^15)

        const iterLimit = Math.min(maxIter * 2, MAX_REFERENCE_ITERATIONS);
        this.orbitRe = new Float32Array(iterLimit);
        this.orbitIm = new Float32Array(iterLimit);
        this.orbit2Re = new Float32Array(iterLimit);
        this.orbit2Im = new Float32Array(iterLimit);

        // Use standard JS numbers for orbit computation
        const cRe = centerX;
        const cIm = centerY;

        // Store reference point
        this.refHiLo = {
            re: { hi: Math.fround(cRe), lo: cRe - Math.fround(cRe) },
            im: { hi: Math.fround(cIm), lo: cIm - Math.fround(cIm) }
        };

        let zRe = 0;
        let zIm = 0;

        for (let i = 0; i < iterLimit; i++) {
            this.orbitRe[i] = zRe;
            this.orbitIm[i] = zIm;
            this.orbit2Re[i] = 2 * zRe;
            this.orbit2Im[i] = 2 * zIm;

            const magSq = zRe * zRe + zIm * zIm;
            if (magSq > ESCAPE_RADIUS_SQ) {
                this.orbitLength = i;
                console.log(`Reference orbit escaped at iteration ${i}, |z|²=${magSq.toFixed(2)}`);
                break;
            }

            // z = z² + c
            const newRe = zRe * zRe - zIm * zIm + cRe;
            const newIm = 2 * zRe * zIm + cIm;
            zRe = newRe;
            zIm = newIm;
            this.orbitLength = i + 1;
        }

        if (this.orbitLength >= iterLimit) {
            console.log(`Reference orbit did not escape after ${iterLimit} iterations (point likely in set)`);
        }

        this.cachedCenterX = centerX;
        this.cachedCenterY = centerY;
        this.cachedZoomLog = zoomLog;
    }

    /**
     * Get reference data for GPU
     */
    getGPUData() {
        return {
            // Reference point as hi/lo for precision
            refRe: this.refHiLo.re,
            refIm: this.refHiLo.im,

            // Orbit data (truncated to reasonable size for uniforms)
            orbit: {
                re: this.orbitRe,
                im: this.orbitIm,
                re2: this.orbit2Re,
                im2: this.orbit2Im,
                length: this.orbitLength
            }
        };
    }

    /**
     * Create a WebGL texture containing the orbit data
     * Uses RGBA float texture: R=Z_n.re, G=Z_n.im, B=2*Z_n.re, A=2*Z_n.im
     */
    createOrbitTexture(gl) {
        // Check for float texture support
        const ext = gl.getExtension('OES_texture_float');
        if (!ext) {
            console.error('OES_texture_float not supported - cannot create orbit texture!');
            return null;
        }

        if (this.orbitLength <= 0) {
            console.error('Cannot create orbit texture: orbit length is', this.orbitLength);
            return null;
        }

        console.log('Creating orbit texture for', this.orbitLength, 'iterations');

        // Calculate texture dimensions (power of 2 preferred)
        const width = Math.min(MAX_ORBIT_TEXTURE_SIZE, this.orbitLength);
        const height = Math.ceil(this.orbitLength / width);

        // Create texture data (RGBA)
        const data = new Float32Array(width * height * 4);

        for (let i = 0; i < this.orbitLength; i++) {
            const idx = i * 4;
            data[idx + 0] = this.orbitRe[i];      // R = Z_n.re
            data[idx + 1] = this.orbitIm[i];      // G = Z_n.im
            data[idx + 2] = this.orbit2Re[i];     // B = 2*Z_n.re
            data[idx + 3] = this.orbit2Im[i];     // A = 2*Z_n.im
        }

        // Create and configure texture
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            width,
            height,
            0,
            gl.RGBA,
            gl.FLOAT,
            data
        );

        // Set texture parameters (no filtering for data textures)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.bindTexture(gl.TEXTURE_2D, null);

        return {
            texture,
            width,
            height,
            length: this.orbitLength
        };
    }

    /**
     * Check if we should use deep zoom mode
     * Deep zoom is beneficial when standard precision breaks down
     */
    static shouldUseDeepZoom(zoomLog) {
        // Standard float32 precision breaks down earlier than theoretical limits
        // because the hi/lo emulation in the standard shader doesn't fully work
        // (adding hi+lo in float32 loses precision immediately)
        // Activate deep zoom at ~10Kx to catch issues before they're visible
        // zoomLog of 13 = 2^13 ≈ 8Kx, zoomLog of 14 = 2^14 ≈ 16Kx
        return zoomLog > 13;
    }

    /**
     * Calculate the delta_c for a pixel relative to reference point
     * Returns hi/lo pair for the delta
     */
    static calculateDeltaC(pixelX, pixelY, refX, refY) {
        const deltaX = pixelX - refX;
        const deltaY = pixelY - refY;

        // Split into hi/lo for precision
        return {
            re: {
                hi: Math.fround(deltaX),
                lo: deltaX - Math.fround(deltaX)
            },
            im: {
                hi: Math.fround(deltaY),
                lo: deltaY - Math.fround(deltaY)
            }
        };
    }
}

/**
 * Manager for reference orbit computation and caching
 */
export class DeepZoomManager {
    constructor() {
        this.referenceOrbit = new ReferenceOrbit();
        this.orbitTexture = null;
        this.isEnabled = false;
        this.gl = null;

        // Status for UI feedback
        this.status = 'idle';  // 'idle', 'computing', 'ready', 'error'
        this.progress = 0;
    }

    /**
     * Initialize with WebGL context
     */
    init(gl) {
        this.gl = gl;

        // Check for required extensions
        const floatTexture = gl.getExtension('OES_texture_float');
        if (floatTexture) {
            console.log('OES_texture_float extension available - deep zoom textures enabled');
        } else {
            console.error('OES_texture_float NOT available - deep zoom will NOT work!');
        }
    }

    /**
     * Update reference orbit if needed
     * Call this before rendering when zoom/center changes
     */
    async update(centerX, centerY, zoomLog, maxIter) {
        // Check if we should be using deep zoom
        const shouldUseDeep = ReferenceOrbit.shouldUseDeepZoom(zoomLog);

        if (!shouldUseDeep) {
            this.isEnabled = false;
            this.status = 'idle';
            return;
        }

        this.isEnabled = true;

        // Check if we need to recompute
        if (!this.referenceOrbit.needsUpdate(centerX, centerY, zoomLog, maxIter)) {
            this.status = 'ready';
            return;
        }

        // Compute new reference orbit
        this.status = 'computing';
        this.progress = 0;

        try {
            await this.referenceOrbit.compute(
                centerX, centerY, zoomLog, maxIter,
                (p) => { this.progress = p; }
            );

            // Create/update texture
            if (this.gl) {
                if (this.orbitTexture) {
                    this.gl.deleteTexture(this.orbitTexture.texture);
                }
                this.orbitTexture = this.referenceOrbit.createOrbitTexture(this.gl);
            }

            this.status = 'ready';
        } catch (error) {
            console.error('Deep zoom computation error:', error);
            this.status = 'error';
            this.isEnabled = false;
        }
    }

    /**
     * Synchronous update (blocks UI but faster for small iterations)
     */
    updateSync(centerX, centerY, zoomLog, maxIter) {
        const shouldUseDeep = ReferenceOrbit.shouldUseDeepZoom(zoomLog);

        if (!shouldUseDeep) {
            this.isEnabled = false;
            this.status = 'idle';
            return;
        }

        this.isEnabled = true;

        if (!this.referenceOrbit.needsUpdate(centerX, centerY, zoomLog, maxIter)) {
            this.status = 'ready';
            return;
        }

        this.status = 'computing';
        this.referenceOrbit.computeSync(centerX, centerY, zoomLog, maxIter);

        if (this.gl) {
            if (this.orbitTexture) {
                this.gl.deleteTexture(this.orbitTexture.texture);
            }
            this.orbitTexture = this.referenceOrbit.createOrbitTexture(this.gl);
        }

        this.status = 'ready';
    }

    /**
     * Get data for shader uniforms
     */
    getShaderData() {
        if (!this.isEnabled || this.status !== 'ready') {
            return null;
        }

        const gpuData = this.referenceOrbit.getGPUData();

        return {
            enabled: true,
            refRe: gpuData.refRe,
            refIm: gpuData.refIm,
            orbitTexture: this.orbitTexture,
            orbitLength: gpuData.orbit.length
        };
    }

    /**
     * Clean up resources
     */
    dispose() {
        if (this.gl && this.orbitTexture) {
            this.gl.deleteTexture(this.orbitTexture.texture);
            this.orbitTexture = null;
        }
    }
}
