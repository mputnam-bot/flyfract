/**
 * Shader Manager
 * Handles shader loading, compilation, and program linking
 */

/**
 * Load shader source from URL
 * @param {string} url - Shader file URL
 * @returns {Promise<string>} Shader source code
 */
export async function loadShaderSource(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load shader: ${url}`);
    }
    return response.text();
}

/**
 * Compile a shader
 * @param {WebGLRenderingContext} gl
 * @param {string} source - Shader source code
 * @param {number} type - gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
 * @returns {WebGLShader}
 */
export function compileShader(gl, source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const error = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        const typeName = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
        console.error(`Shader compilation error (${typeName}):`, error);
        throw new Error(`Shader compilation failed: ${error}`);
    }

    return shader;
}

/**
 * Link shaders into a program
 * @param {WebGLRenderingContext} gl
 * @param {WebGLShader} vertexShader
 * @param {WebGLShader} fragmentShader
 * @returns {WebGLProgram}
 */
export function linkProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const error = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error(`Program linking failed: ${error}`);
    }

    return program;
}

/**
 * Create a shader program from source
 * @param {WebGLRenderingContext} gl
 * @param {string} vertexSource
 * @param {string} fragmentSource
 * @returns {WebGLProgram}
 */
export function createProgram(gl, vertexSource, fragmentSource) {
    const vertexShader = compileShader(gl, vertexSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, fragmentSource, gl.FRAGMENT_SHADER);
    return linkProgram(gl, vertexShader, fragmentShader);
}

/**
 * Get uniform locations for a program
 * @param {WebGLRenderingContext} gl
 * @param {WebGLProgram} program
 * @param {string[]} names
 * @returns {Object} Map of uniform names to locations
 */
export function getUniformLocations(gl, program, names) {
    const locations = {};
    for (const name of names) {
        locations[name] = gl.getUniformLocation(program, name);
    }
    return locations;
}

/**
 * Get attribute locations for a program
 * @param {WebGLRenderingContext} gl
 * @param {WebGLProgram} program
 * @param {string[]} names
 * @returns {Object} Map of attribute names to locations
 */
export function getAttributeLocations(gl, program, names) {
    const locations = {};
    for (const name of names) {
        locations[name] = gl.getAttribLocation(program, name);
    }
    return locations;
}
