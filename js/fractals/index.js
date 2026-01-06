/**
 * Fractal Manager
 * Registry and manager for all fractal types
 */

import { loadShaderSource, createProgram, getUniformLocations } from '../render/shaders.js';

// Fractal type definitions
export const FRACTAL_TYPES = {
    mandelbrot: {
        id: 'mandelbrot',
        name: 'Mandelbrot',
        shader: 'shaders/mandelbrot.glsl',
        defaultCenter: { x: -0.5, y: 0.0 },
        defaultZoom: 1.0,
        description: 'The classic Mandelbrot set'
    },
    julia: {
        id: 'julia',
        name: 'Julia',
        shader: 'shaders/julia.glsl',
        defaultCenter: { x: 0.0, y: 0.0 },
        defaultZoom: 1.0,
        description: 'Julia set fractals',
        hasParameter: true
    },
    burningship: {
        id: 'burningship',
        name: 'Burning Ship',
        shader: 'shaders/burningship.glsl',
        defaultCenter: { x: -0.4, y: -0.6 },
        defaultZoom: 1.0,
        description: 'The Burning Ship fractal'
    },
    tricorn: {
        id: 'tricorn',
        name: 'Tricorn',
        shader: 'shaders/tricorn.glsl',
        defaultCenter: { x: 0.0, y: 0.0 },
        defaultZoom: 1.0,
        description: 'Tricorn fractal (Mandelbar set)'
    },
    newton: {
        id: 'newton',
        name: 'Newton',
        shader: 'shaders/newton.glsl',
        defaultCenter: { x: 0.0, y: 0.0 },
        defaultZoom: 1.0,
        description: 'Newton\'s method fractal'
    },
    phoenix: {
        id: 'phoenix',
        name: 'Phoenix',
        shader: 'shaders/phoenix.glsl',
        defaultCenter: { x: 0.0, y: 0.0 },
        defaultZoom: 1.0,
        description: 'Phoenix fractal with feedback'
    },
    lyapunov: {
        id: 'lyapunov',
        name: 'Lyapunov',
        shader: 'shaders/lyapunov.glsl',
        defaultCenter: { x: 2.0, y: 2.0 },
        defaultZoom: 0.5,
        description: 'Lyapunov exponent fractal'
    },
    multibrot: {
        id: 'multibrot',
        name: 'Multibrot',
        shader: 'shaders/multibrot.glsl',
        defaultCenter: { x: 0.0, y: 0.0 },
        defaultZoom: 1.0,
        description: 'Higher power Mandelbrot (z^4)'
    },
    magnet: {
        id: 'magnet',
        name: 'Magnet',
        shader: 'shaders/magnet.glsl',
        defaultCenter: { x: 0.0, y: 0.0 },
        defaultZoom: 1.0,
        description: 'Magnet Type 1 fractal'
    },
    celtic: {
        id: 'celtic',
        name: 'Celtic',
        shader: 'shaders/celtic.glsl',
        defaultCenter: { x: -0.5, y: 0.0 },
        defaultZoom: 1.0,
        description: 'Celtic knot Mandelbrot variant'
    }
};

// Julia set presets
export const JULIA_PRESETS = [
    { name: 'Dendrite', c: [-0.8, 0.156], description: 'Tree-like branches' },
    { name: 'Spiral', c: [-0.7269, 0.1889], description: 'Spiral patterns' },
    { name: 'Lightning', c: [-0.4, 0.6], description: 'Electric tendrils' },
    { name: 'Galaxy', c: [0.285, 0.01], description: 'Swirling arms' },
    { name: 'Rabbit', c: [-0.123, 0.745], description: 'Connected blobs' },
    { name: 'San Marco', c: [-0.75, 0.0], description: 'Basilica-like' },
    { name: 'Siegel Disk', c: [-0.390541, -0.586788], description: 'Quasi-crystal' }
];

export class FractalManager {
    constructor(gl, vertexSource) {
        this.gl = gl;
        this.vertexSource = vertexSource;
        this.programs = new Map();
        this.currentType = 'mandelbrot';
        this.juliaPresetIndex = 1; // Start with Spiral
        this.juliaC = JULIA_PRESETS[1].c;

        // Deep zoom shader (separate from regular Mandelbrot)
        this.deepZoomProgram = null;
        this.deepZoomUniforms = null;
        this.useDeepZoom = false;
    }

    /**
     * Load and compile all fractal shaders
     */
    async loadAll(onProgress) {
        const types = Object.keys(FRACTAL_TYPES);
        // +1 for deep zoom shader
        const total = types.length + 1;
        let loaded = 0;

        const uniformList = [
            'u_resolution',
            'u_center',
            'u_zoom',
            'u_rotation',
            'u_maxIter',
            'u_colorOffset',
            'u_juliaC',
            'u_colorA',
            'u_colorB',
            'u_colorC',
            'u_colorD',
            'u_isRainbow'
        ];

        // Deep zoom shader has additional uniforms
        const deepZoomUniformList = [
            ...uniformList,
            'u_deepZoomEnabled',
            'u_refPoint',
            'u_orbitTexture',
            'u_orbitTextureSize',
            'u_orbitLength'
        ];

        for (const type of types) {
            try {
                const fractal = FRACTAL_TYPES[type];
                const fragmentSource = await loadShaderSource(fractal.shader);
                const program = createProgram(this.gl, this.vertexSource, fragmentSource);
                const uniforms = getUniformLocations(this.gl, program, uniformList);
                this.programs.set(type, { program, uniforms });

                loaded++;
                if (onProgress) {
                    onProgress(loaded / total);
                }
            } catch (error) {
                console.error(`Failed to load shader for ${type}:`, error);
                throw new Error(`Failed to load shader for ${type}: ${error.message}`);
            }
        }

        // Load deep zoom shader
        try {
            console.log('Loading deep zoom shader...');
            const deepFragmentSource = await loadShaderSource('shaders/mandelbrot_deep.glsl');
            console.log('Deep zoom shader source loaded, length:', deepFragmentSource.length);

            this.deepZoomProgram = createProgram(this.gl, this.vertexSource, deepFragmentSource);
            console.log('Deep zoom program created:', this.deepZoomProgram);

            this.deepZoomUniforms = getUniformLocations(this.gl, this.deepZoomProgram, deepZoomUniformList);
            console.log('Deep zoom uniforms:', Object.keys(this.deepZoomUniforms).filter(k => this.deepZoomUniforms[k] !== null));

            console.log('%c Deep zoom shader compiled successfully!', 'background: green; color: white;');

            loaded++;
            if (onProgress) {
                onProgress(loaded / total);
            }
        } catch (error) {
            console.error('%c Failed to load deep zoom shader!', 'background: red; color: white;');
            console.error('Error:', error.message);
            console.error('Stack:', error.stack);
            // Don't throw - app can work without deep zoom
            this.deepZoomProgram = null;
            this.deepZoomUniforms = null;
        }
    }

    /**
     * Get current program and uniforms
     * Returns deep zoom shader if enabled and available for Mandelbrot
     */
    getCurrent() {
        // Use deep zoom shader for Mandelbrot when enabled
        if (this.useDeepZoom && this.currentType === 'mandelbrot' && this.deepZoomProgram) {
            return {
                program: this.deepZoomProgram,
                uniforms: this.deepZoomUniforms,
                isDeepZoom: true
            };
        }
        return this.programs.get(this.currentType);
    }

    /**
     * Check if deep zoom is available
     */
    hasDeepZoom() {
        return this.deepZoomProgram !== null;
    }

    /**
     * Enable or disable deep zoom mode
     */
    setDeepZoom(enabled) {
        this.useDeepZoom = enabled && this.hasDeepZoom();
        return this.useDeepZoom;
    }

    /**
     * Check if deep zoom should be used for current fractal type
     */
    supportsDeepZoom() {
        // Currently only Mandelbrot supports deep zoom
        return this.currentType === 'mandelbrot' && this.hasDeepZoom();
    }

    /**
     * Get current fractal type definition
     */
    getCurrentType() {
        return FRACTAL_TYPES[this.currentType];
    }

    /**
     * Switch to a different fractal type
     */
    setType(type) {
        if (FRACTAL_TYPES[type] && this.programs.has(type)) {
            this.currentType = type;
            return true;
        }
        return false;
    }

    /**
     * Get default view for current fractal
     */
    getDefaultView() {
        const fractal = FRACTAL_TYPES[this.currentType];
        return {
            centerX: fractal.defaultCenter.x,
            centerY: fractal.defaultCenter.y,
            zoom: fractal.defaultZoom
        };
    }

    /**
     * Cycle to next fractal type
     */
    nextType() {
        const types = Object.keys(FRACTAL_TYPES);
        const currentIndex = types.indexOf(this.currentType);
        const nextIndex = (currentIndex + 1) % types.length;
        this.currentType = types[nextIndex];
        return this.currentType;
    }

    /**
     * Cycle to previous fractal type
     */
    prevType() {
        const types = Object.keys(FRACTAL_TYPES);
        const currentIndex = types.indexOf(this.currentType);
        const prevIndex = (currentIndex - 1 + types.length) % types.length;
        this.currentType = types[prevIndex];
        return this.currentType;
    }

    /**
     * Cycle Julia set parameter
     */
    nextJuliaPreset() {
        this.juliaPresetIndex = (this.juliaPresetIndex + 1) % JULIA_PRESETS.length;
        this.juliaC = JULIA_PRESETS[this.juliaPresetIndex].c;
        return JULIA_PRESETS[this.juliaPresetIndex];
    }

    /**
     * Get current Julia preset
     */
    getCurrentJuliaPreset() {
        return JULIA_PRESETS[this.juliaPresetIndex];
    }

    /**
     * Set Julia parameter directly
     */
    setJuliaC(real, imag) {
        this.juliaC = [real, imag];
    }

    /**
     * Get all fractal types for UI
     */
    getAllTypes() {
        return Object.values(FRACTAL_TYPES);
    }
}
