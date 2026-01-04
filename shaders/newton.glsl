precision highp float;

uniform vec2 u_resolution;
uniform vec4 u_center;     // (centerX.hi, centerX.lo, centerY.hi, centerY.lo)
uniform float u_zoom;
uniform float u_rotation;  // Rotation angle in radians
uniform int u_maxIter;
uniform float u_colorOffset;
uniform vec3 u_colorA;      // Color scheme parameter A
uniform vec3 u_colorB;      // Color scheme parameter B
uniform vec3 u_colorC;      // Color scheme parameter C
uniform vec3 u_colorD;      // Color scheme parameter D

// HSL to RGB conversion
vec3 hsl2rgb(vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0);
    return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
}

// Color palette - procedural cosine gradient or rainbow
vec3 palette(float t) {
    // Check if this is rainbow scheme (d values indicate rainbow)
    if (abs(u_colorD.x - 0.833) < 0.001 && abs(u_colorD.y - 0.167) < 0.001 && abs(u_colorD.z - 0.5) < 0.001) {
        // True rainbow: cycle through hue 0-360 (ROYGBIV)
        float hue = fract(t);
        return hsl2rgb(vec3(hue, 1.0, 0.5));
    }
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

    // Calculate initial z
    vec2 z = vec2(u_center.x + u_center.y, u_center.z + u_center.w) + rotatedUV * scale;

    // Newton's method for z^3 - 1 = 0
    // f(z) = z^3 - 1, f'(z) = 3z^2
    // z_new = z - f(z)/f'(z) = z - (z^3 - 1)/(3z^2)
    int iter = 0;
    float minDist = 1e10;

    for (int i = 0; i < 2000; i++) {
        if (i >= u_maxIter) break;

        // Check convergence to roots
        vec2 root1 = vec2(1.0, 0.0);
        vec2 root2 = vec2(-0.5, 0.8660254);  // e^(2πi/3)
        vec2 root3 = vec2(-0.5, -0.8660254); // e^(-2πi/3)

        float dist1 = length(z - root1);
        float dist2 = length(z - root2);
        float dist3 = length(z - root3);

        minDist = min(minDist, min(dist1, min(dist2, dist3)));

        // If very close to a root, we've converged
        if (minDist < 0.0001) break;

        // Compute z^2 and z^3
        float zx2 = z.x * z.x;
        float zy2 = z.y * z.y;
        vec2 z2 = vec2(zx2 - zy2, 2.0 * z.x * z.y);
        vec2 z3 = vec2(z2.x * z.x - z2.y * z.y, z2.x * z.y + z2.y * z.x);

        // f(z) = z^3 - 1
        vec2 fz = vec2(z3.x - 1.0, z3.y);

        // f'(z) = 3z^2
        vec2 fprime = vec2(3.0 * z2.x, 3.0 * z2.y);

        // Avoid division by zero
        float denom = fprime.x * fprime.x + fprime.y * fprime.y;
        if (denom < 1e-10) break;

        // Newton step: z_new = z - f(z)/f'(z)
        vec2 dz = vec2(
            (fz.x * fprime.x + fz.y * fprime.y) / denom,
            (fz.y * fprime.x - fz.x * fprime.y) / denom
        );
        z = z - dz;

        iter = i;
    }

    // Color based on which root converged to and iteration count
    vec2 root1 = vec2(1.0, 0.0);
    vec2 root2 = vec2(-0.5, 0.8660254);
    vec2 root3 = vec2(-0.5, -0.8660254);

    float dist1 = length(z - root1);
    float dist2 = length(z - root2);
    float dist3 = length(z - root3);

    float t;
    if (dist1 < dist2 && dist1 < dist3) {
        t = fract(float(iter) * 0.1 + u_colorOffset);
    } else if (dist2 < dist3) {
        t = fract(float(iter) * 0.1 + 0.33 + u_colorOffset);
    } else {
        t = fract(float(iter) * 0.1 + 0.67 + u_colorOffset);
    }

    vec3 color = palette(t);
    gl_FragColor = vec4(color, 1.0);
}

