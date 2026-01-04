precision highp float;

uniform vec2 u_resolution;
uniform vec4 u_center;     // (centerX.hi, centerX.lo, centerY.hi, centerY.lo)
uniform float u_zoom;
uniform int u_maxIter;
uniform float u_colorOffset;

// Emulated double-precision addition
vec2 ds_add(vec2 a, vec2 b) {
    float t1 = a.x + b.x;
    float e = t1 - a.x;
    float t2 = ((b.x - e) + (a.x - (t1 - e))) + a.y + b.y;
    return vec2(t1 + t2, t2 - ((t1 + t2) - t1));
}

// Color palette - procedural cosine gradient
vec3 palette(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.00, 0.33, 0.67);
    return a + b * cos(6.28318 * (c * t + d));
}

void main() {
    // Convert pixel coordinates to normalized coordinates
    vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);

    // Map to fractal space
    float scale = 2.0 / u_zoom;

    // Calculate c using emulated double precision for center
    vec2 c = vec2(u_center.x + u_center.y, u_center.z + u_center.w) + uv * scale;

    // Cardioid check for early exit (main bulb optimization)
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

    // Mandelbrot iteration
    vec2 z = vec2(0.0);
    int iter = 0;

    for (int i = 0; i < 2000; i++) {
        if (i >= u_maxIter) break;

        float zx2 = z.x * z.x;
        float zy2 = z.y * z.y;

        if (zx2 + zy2 > 4.0) break;

        z = vec2(zx2 - zy2 + c.x, 2.0 * z.x * z.y + c.y);
        iter = i;
    }

    // Coloring
    if (iter >= u_maxIter - 1) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else {
        // Smooth coloring using escape time algorithm
        float zn = z.x * z.x + z.y * z.y;
        float nu = log2(log2(zn) * 0.5);
        float smoothIter = float(iter) + 1.0 - nu;

        float t = fract(smoothIter * 0.02 + u_colorOffset);
        vec3 color = palette(t);

        gl_FragColor = vec4(color, 1.0);
    }
}
