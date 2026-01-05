precision highp float;

uniform vec2 u_resolution;
uniform vec4 u_center;
uniform float u_zoom;
uniform float u_rotation;
uniform int u_maxIter;
uniform float u_colorOffset;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
uniform vec3 u_colorC;
uniform vec3 u_colorD;
uniform int u_isRainbow;

// Emulated double-precision addition
vec2 ds_add(vec2 a, vec2 b) {
    float t1 = a.x + b.x;
    float e = t1 - a.x;
    float t2 = ((b.x - e) + (a.x - (t1 - e))) + a.y + b.y;
    return vec2(t1 + t2, t2 - ((t1 + t2) - t1));
}

// HSL to RGB conversion
vec3 hsl2rgb(vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0);
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

// Complex multiplication
vec2 cmul(vec2 a, vec2 b) {
    return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

// Complex division
vec2 cdiv(vec2 a, vec2 b) {
    float denom = b.x * b.x + b.y * b.y;
    return vec2(
        (a.x * b.x + a.y * b.y) / denom,
        (a.y * b.x - a.x * b.y) / denom
    );
}

// Complex square
vec2 csqr(vec2 z) {
    return vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);

    // Apply rotation
    float cosR = cos(u_rotation);
    float sinR = sin(u_rotation);
    vec2 rotatedUV = vec2(
        uv.x * cosR - uv.y * sinR,
        uv.x * sinR + uv.y * cosR
    );

    // Map to fractal space
    float scale = 3.0 / u_zoom;
    vec2 c = vec2(u_center.x + u_center.y, u_center.z + u_center.w) + rotatedUV * scale;

    // Magnet Type 1: z = ((z^2 + c - 1) / (2z + c - 2))^2
    // Fixed point at z = 1
    vec2 z = vec2(0.0);
    int iter = 0;

    for (int i = 0; i < 2000; i++) {
        if (i >= u_maxIter) break;

        float mag2 = z.x * z.x + z.y * z.y;
        if (mag2 > 1000.0) break;

        // Check for convergence to fixed point z = 1
        vec2 diff = z - vec2(1.0, 0.0);
        if (diff.x * diff.x + diff.y * diff.y < 0.0001) break;

        // Numerator: z^2 + c - 1
        vec2 num = csqr(z) + c - vec2(1.0, 0.0);

        // Denominator: 2z + c - 2
        vec2 denom = 2.0 * z + c - vec2(2.0, 0.0);

        // Avoid division by zero
        float denomMag = denom.x * denom.x + denom.y * denom.y;
        if (denomMag < 0.0001) break;

        // z = (num / denom)^2
        vec2 ratio = cdiv(num, denom);
        z = csqr(ratio);

        iter = i;
    }

    // Coloring
    float mag2 = z.x * z.x + z.y * z.y;
    vec2 diff = z - vec2(1.0, 0.0);
    float distToFixed = diff.x * diff.x + diff.y * diff.y;

    if (iter >= u_maxIter - 1 || distToFixed < 0.0001) {
        // Converged to fixed point - color based on convergence speed
        float t = fract(float(iter) * 0.05 + u_colorOffset);
        vec3 color = palette(t) * 0.3;
        gl_FragColor = vec4(color, 1.0);
    } else {
        // Escaped
        float smoothIter = float(iter) + 1.0 - log2(log2(mag2) + 1.0);
        float t = fract(smoothIter * 0.02 + u_colorOffset);
        vec3 color = palette(t);
        gl_FragColor = vec4(color, 1.0);
    }
}
