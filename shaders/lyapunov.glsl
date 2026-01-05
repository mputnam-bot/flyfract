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
uniform int u_isRainbow;    // 1 if rainbow mode, 0 otherwise

// HSL to RGB conversion
vec3 hsl2rgb(vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0);
    return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
}

// Color palette - procedural cosine gradient or rainbow
vec3 palette(float t) {
    if (u_isRainbow == 1) {
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

    // Calculate parameters a and b from screen position
    // Lyapunov uses logistic map: x_{n+1} = r * x_n * (1 - x_n)
    // where r alternates between a and b based on sequence
    vec2 params = vec2(u_center.x + u_center.y, u_center.z + u_center.w) + rotatedUV * scale;
    
    // Clamp parameters to valid range [0, 4]
    float a = clamp(params.x, 0.0, 4.0);
    float b = clamp(params.y, 0.0, 4.0);

    // Sequence pattern: ABABAB... (alternating)
    float x = 0.5; // Initial value
    float sum = 0.0;
    int count = 0;
    
    // Limit iterations to prevent crashes (Lyapunov doesn't need as many as other fractals)
    int maxIterations = u_maxIter > 500 ? 500 : u_maxIter;

    for (int i = 0; i < 500; i++) {
        if (i >= maxIterations) break;

        // Determine which parameter to use based on sequence (alternating)
        float r = mod(float(i), 2.0) < 1.0 ? a : b;

        // Logistic map: x_{n+1} = r * x_n * (1 - x_n)
        x = r * x * (1.0 - x);

        // Clamp x to [0, 1] to avoid numerical issues
        x = clamp(x, 0.0, 1.0);

        // Compute Lyapunov exponent: sum of log|r * (1 - 2*x)|
        // Skip initial transient to let system settle
        if (i > 50) {
            float derivative = abs(r * (1.0 - 2.0 * x));
            // Avoid log(0) and log of very small numbers that could cause NaN
            // Also avoid very large values that could cause infinity
            if (derivative > 0.001 && derivative < 1000.0) {
                float logVal = log(derivative);
                // Check for valid log value (not NaN or infinity)
                // NaN check: value != itself, Infinity check: abs(value) > large number
                if (logVal == logVal && abs(logVal) < 100.0) {
                    sum += logVal;
                    count++;
                }
            }
        }
    }

    // Lyapunov exponent = average of log|derivative|
    float lyapunov = count > 0 ? sum / float(count) : -10.0;
    
    // Clamp lyapunov to reasonable range to avoid rendering issues
    lyapunov = clamp(lyapunov, -5.0, 5.0);

    // Color based on Lyapunov exponent
    // Negative = stable (black), positive = chaotic (colored)
    // Map lyapunov from roughly [-2, 2] to [0, 1] for coloring
    float normalized = (lyapunov + 2.0) * 0.25; // Map [-2, 2] to [0, 1]
    normalized = clamp(normalized, 0.0, 1.0);
    
    if (lyapunov < -0.1) {
        // Very stable region - dark
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else if (lyapunov < 0.0) {
        // Slightly stable - dark gray
        float gray = (lyapunov + 0.1) * 10.0; // Map [-0.1, 0] to [0, 1]
        gl_FragColor = vec4(gray * 0.3, gray * 0.3, gray * 0.3, 1.0);
    } else {
        // Chaotic region - full color based on exponent value
        float t = fract(normalized * 2.0 + u_colorOffset);
        vec3 color = palette(t);
        gl_FragColor = vec4(color, 1.0);
    }
}

