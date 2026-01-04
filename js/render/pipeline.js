/**
 * Render Pipeline
 * Orchestrates the fractal rendering process
 */

import { createProgram, getUniformLocations, getAttributeLocations } from './shaders.js';

export class RenderPipeline {
    constructor(gl, viewState, qualityAdapter) {
        this.gl = gl;
        this.viewState = viewState;
        this.qualityAdapter = qualityAdapter;

        this.program = null;
        this.uniforms = null;
        this.attributes = null;
        this.quadBuffer = null;

        this.needsRender = true;
        this.isGesturing = false;
        this.lastFrameTime = 0;

        // Zoom indicator callback
        this.onZoomChange = null;
    }

    /**
     * Initialize the pipeline with shaders
     */
    async init(vertexSource, fragmentSource) {
        const gl = this.gl;

        // Create shader program
        this.program = createProgram(gl, vertexSource, fragmentSource);

        // Get uniform locations
        this.uniforms = getUniformLocations(gl, this.program, [
            'u_resolution',
            'u_center',
            'u_zoom',
            'u_maxIter',
            'u_colorOffset'
        ]);

        // Get attribute locations
        this.attributes = getAttributeLocations(gl, this.program, ['a_position']);

        // Create fullscreen quad
        this.createQuad();

        // Use the program
        gl.useProgram(this.program);
    }

    /**
     * Create fullscreen quad vertex buffer
     */
    createQuad() {
        const gl = this.gl;

        this.quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);

        // Fullscreen quad: two triangles covering -1 to 1
        const vertices = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
             1,  1
        ]);

        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        // Setup vertex attribute
        gl.enableVertexAttribArray(this.attributes.a_position);
        gl.vertexAttribPointer(this.attributes.a_position, 2, gl.FLOAT, false, 0, 0);
    }

    /**
     * Request a render on next frame
     */
    requestRender() {
        this.needsRender = true;
    }

    /**
     * Set gesture state
     */
    setGesturing(isGesturing) {
        this.isGesturing = isGesturing;

        if (isGesturing) {
            this.qualityAdapter.onGestureStart();
        } else {
            this.qualityAdapter.onGestureEnd();
        }

        this.requestRender();
    }

    /**
     * Main render loop tick
     */
    tick(timestamp) {
        const frameTime = timestamp - this.lastFrameTime;
        this.lastFrameTime = timestamp;

        // Update quality based on frame time
        this.qualityAdapter.update(frameTime);

        if (this.needsRender || this.isGesturing) {
            this.render();

            // During gestures, always render next frame
            // When static, wait for explicit render request
            this.needsRender = this.isGesturing;
        }

        requestAnimationFrame(this.tick.bind(this));
    }

    /**
     * Start the render loop
     */
    start() {
        this.lastFrameTime = performance.now();
        requestAnimationFrame(this.tick.bind(this));
    }

    /**
     * Perform a render
     */
    render() {
        const gl = this.gl;
        const quality = this.qualityAdapter.getQuality();

        // Get canvas size
        const canvas = gl.canvas;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.floor(canvas.clientWidth * dpr * quality);
        const height = Math.floor(canvas.clientHeight * dpr * quality);

        // Resize canvas if needed
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
            gl.viewport(0, 0, width, height);
        }

        // Update view state screen size
        this.viewState.setScreenSize(canvas.clientWidth, canvas.clientHeight);

        // Get uniforms from view state
        const viewUniforms = this.viewState.getUniforms();
        const maxIter = this.viewState.getMaxIterations(this.isGesturing);

        // Set uniforms
        gl.uniform2f(this.uniforms.u_resolution, width, height);
        gl.uniform4f(
            this.uniforms.u_center,
            viewUniforms.center[0],
            viewUniforms.center[1],
            viewUniforms.center[2],
            viewUniforms.center[3]
        );
        gl.uniform1f(this.uniforms.u_zoom, viewUniforms.zoom);
        gl.uniform1i(this.uniforms.u_maxIter, maxIter);
        gl.uniform1f(this.uniforms.u_colorOffset, viewUniforms.colorOffset);

        // Draw
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // Update zoom indicator
        if (this.onZoomChange) {
            this.onZoomChange(this.viewState.formatZoom());
        }
    }
}
