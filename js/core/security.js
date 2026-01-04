/**
 * Security Utilities
 * Input validation and sanitization for FlyFract
 */

// Valid fractal types (whitelist)
const VALID_FRACTALS = ['mandelbrot', 'julia', 'burningship', 'tricorn', 'newton', 'phoenix', 'lyapunov'];

// Valid color schemes (whitelist)
const VALID_COLORS = ['cosmic', 'fire', 'ocean', 'forest', 'sunset', 'neon', 'grayscale', 'rainbow'];

/**
 * Validate and sanitize URL parameters for share links
 * @param {URLSearchParams} params - URL search parameters
 * @returns {Object} Validated parameters (only safe values included)
 */
export function validateURLParams(params) {
    const validated = {};

    // Validate X coordinate
    if (params.has('x')) {
        const x = parseFloat(params.get('x'));
        if (isFinite(x) && x >= -10 && x <= 10) {
            validated.x = x;
        }
    }

    // Validate Y coordinate
    if (params.has('y')) {
        const y = parseFloat(params.get('y'));
        if (isFinite(y) && y >= -10 && y <= 10) {
            validated.y = y;
        }
    }

    // Validate zoom (must be positive, within reasonable range)
    if (params.has('zoom')) {
        const zoom = parseFloat(params.get('zoom'));
        if (isFinite(zoom) && zoom > 0 && zoom < 1e15) {
            validated.zoom = zoom;
        }
    }

    // Validate fractal type (whitelist only)
    if (params.has('fractal')) {
        const fractal = params.get('fractal').toLowerCase();
        if (VALID_FRACTALS.includes(fractal)) {
            validated.fractal = fractal;
        }
    }

    // Validate color scheme (whitelist only)
    if (params.has('color')) {
        const color = params.get('color').toLowerCase();
        if (VALID_COLORS.includes(color)) {
            validated.color = color;
        }
    }

    // Validate rotation (0 to 2*PI)
    if (params.has('rotation')) {
        const rotation = parseFloat(params.get('rotation'));
        if (isFinite(rotation) && rotation >= 0 && rotation <= Math.PI * 2) {
            validated.rotation = rotation;
        }
    }

    return validated;
}

/**
 * Parse URL parameters safely
 * @returns {Object} Validated URL parameters
 */
export function getValidatedURLParams() {
    try {
        const params = new URLSearchParams(window.location.search);
        return validateURLParams(params);
    } catch (e) {
        console.warn('Failed to parse URL parameters:', e);
        return {};
    }
}

/**
 * Validate stored state data structure
 * @param {Object} data - Data loaded from localStorage
 * @returns {Object|null} Validated data or null if invalid
 */
export function validateStoredState(data) {
    // Must be an object
    if (!data || typeof data !== 'object') {
        return null;
    }

    const validated = {};

    // Validate version (must be a positive integer)
    if (typeof data.version === 'number' && Number.isInteger(data.version) && data.version > 0) {
        validated.version = data.version;
    } else {
        return null; // Version is required
    }

    // Validate fractal type
    if (typeof data.fractalType === 'string' && VALID_FRACTALS.includes(data.fractalType)) {
        validated.fractalType = data.fractalType;
    } else {
        validated.fractalType = 'mandelbrot'; // Default
    }

    // Validate color scheme
    if (typeof data.colorScheme === 'string' && VALID_COLORS.includes(data.colorScheme)) {
        validated.colorScheme = data.colorScheme;
    } else {
        validated.colorScheme = 'cosmic'; // Default
    }

    // Validate timestamp (must be a reasonable date)
    if (typeof data.timestamp === 'number' && data.timestamp > 0 && data.timestamp < Date.now() + 86400000) {
        validated.timestamp = data.timestamp;
    }

    return validated;
}

/**
 * Sanitize a string for safe display (prevent XSS)
 * @param {string} str - Input string
 * @returns {string} Sanitized string
 */
export function sanitizeString(str) {
    if (typeof str !== 'string') {
        return '';
    }
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

/**
 * Validate a numeric value is within bounds
 * @param {number} value - Value to validate
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @param {number} defaultValue - Default if invalid
 * @returns {number} Validated value or default
 */
export function validateNumber(value, min, max, defaultValue) {
    const num = parseFloat(value);
    if (isFinite(num) && num >= min && num <= max) {
        return num;
    }
    return defaultValue;
}

// Export constants for use elsewhere
export { VALID_FRACTALS, VALID_COLORS };
