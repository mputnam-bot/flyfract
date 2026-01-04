precision highp float;

uniform vec2 u_resolution;
uniform vec4 u_center;     // (centerX.hi, centerX.lo, centerY.hi, centerY.lo)
uniform float u_zoom;
uniform float u_rotation;  // Rotation angle in radians
uniform int u_maxIter;
uniform float u_colorOffset;
uniform vec2 u_juliaC;     // Julia set parameter
uniform vec3 u_colorA;      // Color scheme parameter A
uniform vec3 u_colorB;      // Color scheme parameter B
uniform vec3 u_colorC;      // Color scheme parameter C
uniform vec3 u_colorD;      // Color scheme parameter D

// Color palette - procedural cosine gradient
vec3 palette(float t) {
    return u_colorA + u_colorB * cos(6.28318 * (u_colorC * t + u_colorD));
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

    // Map to fractal space
    float scale = 2.0 / u_zoom;

    // For Julia set: z starts at pixel position, c is fixed parameter
    vec2 z = vec2(u_center.x + u_center.y, u_center.z + u_center.w) + rotatedUV * scale;
    vec2 c = u_juliaC;

    // Julia set iteration
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
        // Smooth coloring
        float zn = z.x * z.x + z.y * z.y;
        float nu = log2(log2(zn) * 0.5);
        float smoothIter = float(iter) + 1.0 - nu;

        float t = fract(smoothIter * 0.02 + u_colorOffset);
        vec3 color = palette(t);

        gl_FragColor = vec4(color, 1.0);
    }
}
