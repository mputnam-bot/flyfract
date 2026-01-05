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
    if (abs(u_colorD.x - 0.833) < 0.001 && abs(u_colorD.y - 0.167) < 0.001 && abs(u_colorD.z - 0.5) < 0.001) {
        float hue = fract(t);
        return hsl2rgb(vec3(hue, 1.0, 0.5));
    }
    return u_colorA + u_colorB * cos(6.28318 * (u_colorC * t + u_colorD));
}

// Complex multiplication
vec2 cmul(vec2 a, vec2 b) {
    return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

// Complex power z^4 using repeated squaring
vec2 cpow4(vec2 z) {
    vec2 z2 = cmul(z, z);
    return cmul(z2, z2);
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
    float scale = 2.0 / u_zoom;
    vec2 c = vec2(u_center.x + u_center.y, u_center.z + u_center.w) + rotatedUV * scale;

    // Multibrot iteration: z = z^4 + c
    vec2 z = vec2(0.0);
    int iter = 0;

    for (int i = 0; i < 2000; i++) {
        if (i >= u_maxIter) break;

        float zx2 = z.x * z.x;
        float zy2 = z.y * z.y;

        if (zx2 + zy2 > 4.0) break;

        // z^4 + c
        z = cpow4(z) + c;
        iter = i;
    }

    // Coloring
    if (iter >= u_maxIter - 1) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else {
        float zn = z.x * z.x + z.y * z.y;
        float nu = log2(log2(zn) * 0.5) / 2.0; // Divide by log2(power) = log2(4) = 2
        float smoothIter = float(iter) + 1.0 - nu;

        float t = fract(smoothIter * 0.02 + u_colorOffset);
        vec3 color = palette(t);

        gl_FragColor = vec4(color, 1.0);
    }
}
