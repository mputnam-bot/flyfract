/**
 * Mandelbrot Deep Zoom Shader using Perturbation Theory
 *
 * Instead of computing z = z² + c directly (which loses precision at deep zoom),
 * we compute small deltas relative to a pre-computed reference orbit:
 *
 *   δ_{n+1} = 2 * Z_n * δ_n + δ_n² + δ_c
 *
 * Where:
 *   Z_n = reference orbit value at iteration n (from texture)
 *   δ_n = current pixel's delta from reference
 *   δ_c = pixel's c value minus reference c (constant per pixel)
 *
 * This keeps all GPU math in single precision while achieving unlimited zoom depth.
 */

precision highp float;

// Standard uniforms
uniform vec2 u_resolution;
uniform float u_zoom;
uniform float u_rotation;
uniform int u_maxIter;
uniform float u_colorOffset;

// Color scheme uniforms
uniform vec3 u_colorA;
uniform vec3 u_colorB;
uniform vec3 u_colorC;
uniform vec3 u_colorD;
uniform int u_isRainbow;

// Deep zoom uniforms
uniform int u_deepZoomEnabled;  // 1 if enabled, 0 otherwise (using int for WebGL 1.0 compatibility)
uniform vec4 u_refPoint;       // (ref.re.hi, ref.re.lo, ref.im.hi, ref.im.lo)
uniform vec4 u_center;         // (center.re.hi, center.re.lo, center.im.hi, center.im.lo)
uniform sampler2D u_orbitTexture;
uniform vec2 u_orbitTextureSize;  // (width, height)
uniform int u_orbitLength;

// Escape radius squared (larger than standard 4 for stability)
const float ESCAPE_RADIUS_SQ = 256.0;

// Glitch threshold - if delta gets too large, we have a glitch
const float GLITCH_THRESHOLD = 1e-3;

// HSL to RGB conversion
vec3 hsl2rgb(vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
}

// Color palette
vec3 palette(float t) {
    if (u_isRainbow == 1) {
        float hue = fract(t);
        return hsl2rgb(vec3(hue, 1.0, 0.5));
    }
    return u_colorA + u_colorB * cos(6.28318 * (u_colorC * t + u_colorD));
}

// Lookup reference orbit value at iteration n
// Returns vec4(Z_n.re, Z_n.im, 2*Z_n.re, 2*Z_n.im)
vec4 getOrbitValue(int n) {
    float fn = float(n);
    float texWidth = u_orbitTextureSize.x;
    float texHeight = u_orbitTextureSize.y;

    // Calculate texture coordinates
    float x = mod(fn, texWidth);
    float y = floor(fn / texWidth);

    // Normalize to [0, 1] with half-pixel offset for texel center
    vec2 uv = (vec2(x, y) + 0.5) / vec2(texWidth, texHeight);

    return texture2D(u_orbitTexture, uv);
}

// Complex multiplication: (a + bi)(c + di) = (ac - bd) + (ad + bc)i
vec2 cmul(vec2 a, vec2 b) {
    return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

// Complex squaring: (a + bi)² = (a² - b²) + 2abi
vec2 csqr(vec2 z) {
    return vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y);
}

// Standard Mandelbrot iteration (for when deep zoom is disabled)
void standardMandelbrot(vec2 c, out int iter, out vec2 z) {
    z = vec2(0.0);
    iter = 0;

    for (int i = 0; i < 2000; i++) {
        if (i >= u_maxIter) break;

        float zx2 = z.x * z.x;
        float zy2 = z.y * z.y;

        if (zx2 + zy2 > 4.0) break;

        z = vec2(zx2 - zy2 + c.x, 2.0 * z.x * z.y + c.y);
        iter = i;
    }
}

// Perturbation theory iteration with glitch detection and rebasing
// pixelC is the actual c value for this pixel (used for glitch recovery)
void perturbationMandelbrot(vec2 deltaC, vec2 pixelC, out int iter, out vec2 finalZ) {
    // δ_0 = 0 (we start at the reference point)
    vec2 delta = vec2(0.0);
    iter = 0;
    finalZ = vec2(0.0);

    // Maximum iterations is limited by orbit length
    // Note: GLSL ES 1.0 doesn't have min() for ints, so we use a ternary
    int maxN = (u_maxIter < u_orbitLength - 1) ? u_maxIter : (u_orbitLength - 1);

    for (int n = 0; n < 2000; n++) {
        if (n >= maxN) break;

        // Get reference orbit values: (Z_n.re, Z_n.im, 2*Z_n.re, 2*Z_n.im)
        vec4 orbitVal = getOrbitValue(n);
        vec2 Zn = orbitVal.xy;       // Z_n
        vec2 twoZn = orbitVal.zw;    // 2 * Z_n

        // Current approximation: z = Z_n + δ_n
        vec2 z = Zn + delta;

        // Check escape
        float magSq = dot(z, z);
        if (magSq > ESCAPE_RADIUS_SQ) {
            finalZ = z;
            break;
        }

        // Glitch detection: if |δ_n| becomes comparable to |Z_n|, we lose precision
        // This happens when the pixel's orbit diverges significantly from the reference
        float deltaMagSq = dot(delta, delta);
        float zMagSq = dot(Zn, Zn);

        // Glitch threshold: if δ² > Z² * threshold, we have a problem
        // Use a very small threshold to catch glitches early
        if (zMagSq > 1e-20 && deltaMagSq > zMagSq * 1e-4) {
            // Glitch detected!
            // Fall back to standard iteration using current z and the pixel's actual c value
            // This sacrifices some precision but avoids glitch artifacts

            for (int m = 0; m < 2000; m++) {
                if (n + m >= u_maxIter) break;

                float zMagSqInner = dot(z, z);
                if (zMagSqInner > ESCAPE_RADIUS_SQ) {
                    finalZ = z;
                    iter = n + m;
                    return;
                }

                // Standard Mandelbrot iteration: z = z² + c
                z = csqr(z) + pixelC;
                iter = n + m + 1;
            }

            finalZ = z;
            return;
        }

        // Perturbation formula: δ_{n+1} = 2 * Z_n * δ_n + δ_n² + δ_c
        vec2 deltaSq = csqr(delta);
        vec2 twoZnTimesDelta = cmul(twoZn, delta);
        delta = twoZnTimesDelta + deltaSq + deltaC;

        iter = n + 1;
        finalZ = z;
    }
}

void main() {
    // Convert pixel coordinates to normalized coordinates
    vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);

    // Apply rotation
    float cosR = cos(u_rotation);
    float sinR = sin(u_rotation);
    vec2 rotatedUV = vec2(
        uv.x * cosR - uv.y * sinR,
        uv.x * sinR + uv.y * cosR
    );

    // Scale to fractal space
    float scale = 2.0 / u_zoom;

    int iter;
    vec2 finalZ;

    if (u_deepZoomEnabled == 1 && u_orbitLength > 0) {
        // Deep zoom mode: use perturbation theory

        // Calculate pixel's c value relative to center
        // Center is stored as hi+lo for precision
        vec2 centerHi = vec2(u_center.x, u_center.z);
        vec2 centerLo = vec2(u_center.y, u_center.w);
        vec2 center = centerHi + centerLo;

        vec2 pixelC = center + rotatedUV * scale;

        // Calculate deltaC = pixelC - refPoint
        vec2 refHi = vec2(u_refPoint.x, u_refPoint.z);
        vec2 refLo = vec2(u_refPoint.y, u_refPoint.w);
        vec2 refPoint = refHi + refLo;

        vec2 deltaC = pixelC - refPoint;

        // Run perturbation iteration (pass pixelC for glitch recovery)
        perturbationMandelbrot(deltaC, pixelC, iter, finalZ);
    } else {
        // Standard mode: direct computation
        vec2 centerHi = vec2(u_center.x, u_center.z);
        vec2 centerLo = vec2(u_center.y, u_center.w);
        vec2 c = (centerHi + centerLo) + rotatedUV * scale;

        // Cardioid check for early exit
        float cx = c.x - 0.25;
        float cy2 = c.y * c.y;
        float q = cx * cx + cy2;
        if (q * (q + cx) < 0.25 * cy2) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            return;
        }

        // Period-2 bulb check
        float cx2 = c.x + 1.0;
        if (cx2 * cx2 + cy2 < 0.0625) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            return;
        }

        standardMandelbrot(c, iter, finalZ);
    }

    // Coloring
    if (iter >= u_maxIter - 1) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else {
        // Smooth coloring using escape time algorithm
        float zn = dot(finalZ, finalZ);
        float nu = log2(log2(max(zn, 1.0)) * 0.5);
        float smoothIter = float(iter) + 1.0 - nu;

        float t = fract(smoothIter * 0.02 + u_colorOffset);
        vec3 color = palette(t);

        gl_FragColor = vec4(color, 1.0);
    }
}
