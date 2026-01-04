/**
 * Color Scheme Manager
 * Handles fractal coloring palettes
 */

// Predefined color schemes using cosine gradient parameters
// Each scheme defines: a, b, c, d vectors for: a + b * cos(2π(c*t + d))
export const COLOR_SCHEMES = {
    cosmic: {
        id: 'cosmic',
        name: 'Cosmic',
        a: [0.5, 0.5, 0.5],
        b: [0.5, 0.5, 0.5],
        c: [1.0, 1.0, 1.0],
        d: [0.00, 0.33, 0.67]
    },
    inferno: {
        id: 'inferno',
        name: 'Inferno',
        a: [0.5, 0.5, 0.5],
        b: [0.5, 0.5, 0.5],
        c: [1.0, 1.0, 0.5],
        d: [0.00, 0.10, 0.20]
    },
    ocean: {
        id: 'ocean',
        name: 'Ocean',
        a: [0.5, 0.5, 0.5],
        b: [0.5, 0.5, 0.5],
        c: [1.0, 1.0, 1.0],
        d: [0.30, 0.20, 0.20]
    },
    electric: {
        id: 'electric',
        name: 'Electric',
        a: [0.5, 0.5, 0.5],
        b: [0.5, 0.5, 0.5],
        c: [1.0, 1.0, 1.0],
        d: [0.80, 0.90, 0.30]
    },
    rainbow: {
        id: 'rainbow',
        name: 'Rainbow',
        a: [0.5, 0.5, 0.5],
        b: [0.5, 0.5, 0.5],
        c: [1.0, 1.0, 1.0],
        d: [0.00, 0.10, 0.20]
    },
    fire: {
        id: 'fire',
        name: 'Fire',
        a: [0.5, 0.5, 0.5],
        b: [0.5, 0.5, 0.5],
        c: [1.0, 0.7, 0.4],
        d: [0.00, 0.15, 0.20]
    },
    ice: {
        id: 'ice',
        name: 'Ice',
        a: [0.5, 0.5, 0.5],
        b: [0.5, 0.5, 0.5],
        c: [0.4, 0.7, 1.0],
        d: [0.20, 0.25, 0.30]
    },
    monochrome: {
        id: 'monochrome',
        name: 'Mono',
        a: [0.5, 0.5, 0.5],
        b: [0.5, 0.5, 0.5],
        c: [1.0, 1.0, 1.0],
        d: [0.00, 0.00, 0.00]
    }
};

export class ColorManager {
    constructor() {
        this.currentScheme = 'cosmic';
        this.colorOffset = 0.0;
        this.animating = false;
    }

    /**
     * Get current color scheme
     */
    getCurrent() {
        return COLOR_SCHEMES[this.currentScheme];
    }

    /**
     * Set color scheme by id
     */
    setScheme(id) {
        if (COLOR_SCHEMES[id]) {
            this.currentScheme = id;
            return true;
        }
        return false;
    }

    /**
     * Cycle to next color scheme
     */
    nextScheme() {
        const schemes = Object.keys(COLOR_SCHEMES);
        const currentIndex = schemes.indexOf(this.currentScheme);
        const nextIndex = (currentIndex + 1) % schemes.length;
        this.currentScheme = schemes[nextIndex];
        return this.getCurrent();
    }

    /**
     * Get all color schemes for UI
     */
    getAllSchemes() {
        return Object.values(COLOR_SCHEMES);
    }

    /**
     * Set color offset for animation
     */
    setOffset(offset) {
        this.colorOffset = offset;
    }

    /**
     * Animate color offset
     */
    animateOffset(delta) {
        this.colorOffset = (this.colorOffset + delta) % 1.0;
    }

    /**
     * Generate GLSL code for current color scheme
     * This can be used to create dynamic shaders if needed
     */
    generateGLSL() {
        const scheme = this.getCurrent();
        return `
vec3 palette(float t) {
    vec3 a = vec3(${scheme.a.join(', ')});
    vec3 b = vec3(${scheme.b.join(', ')});
    vec3 c = vec3(${scheme.c.join(', ')});
    vec3 d = vec3(${scheme.d.join(', ')});
    return a + b * cos(6.28318 * (c * t + d));
}`;
    }
}
