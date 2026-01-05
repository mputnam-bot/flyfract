# FlyFract - Deep Zoom Implementation Spec

## Current State Analysis

FlyFract already has **partial** double-precision infrastructure:

### What's Already Done ✓
- `u_center` is a `vec4` with `(centerX.hi, centerX.lo, centerY.hi, centerY.lo)`
- `state.js` stores center as `{ hi, lo }` objects  
- `state.js` has `dsAdd()` and `dsRenorm()` helper methods
- Pipeline passes the vec4 correctly to shaders

### What's Broken ✗
The double precision is **immediately discarded** in all shaders:

```glsl
// mandelbrot.glsl line 56 - THIS LOSES ALL PRECISION
vec2 c = vec2(u_center.x + u_center.y, u_center.z + u_center.w) + rotatedUV * scale;
```

Adding `hi + lo` collapses back to single float. Same issue in:
- `julia.glsl` line 48
- Likely all other shaders

Additionally:
- `u_zoom` is single float (bottleneck at extreme zoom)
- Iteration loop uses single-precision math
- The `ds_add` function in mandelbrot.glsl is defined but never actually used in the iteration

## Goal
Fix the implementation to actually USE double precision throughout, enabling zoom to ~10^14.

---

## Implementation Plan

### Step 1: Create Shared Double-Precision Library

Create `shaders/doublePrecision.glsl` with complete DS arithmetic:

```glsl
// Double-single arithmetic library
// Each double-single is a vec2 where true_value = x + y (hi + lo)

// Create DS from float
vec2 ds_set(float a) {
    return vec2(a, 0.0);
}

// Negate
vec2 ds_neg(vec2 a) {
    return vec2(-a.x, -a.y);
}

// Quick two-sum (requires |a| >= |b|)
vec2 ds_quick_two_sum(float a, float b) {
    float s = a + b;
    float e = b - (s - a);
    return vec2(s, e);
}

// Full two-sum
vec2 ds_two_sum(float a, float b) {
    float s = a + b;
    float v = s - a;
    float e = (a - (s - v)) + (b - v);
    return vec2(s, e);
}

// Double-single addition
vec2 ds_add(vec2 a, vec2 b) {
    vec2 s = ds_two_sum(a.x, b.x);
    vec2 t = ds_two_sum(a.y, b.y);
    s.y += t.x;
    s = ds_quick_two_sum(s.x, s.y);
    s.y += t.y;
    s = ds_quick_two_sum(s.x, s.y);
    return s;
}

// Double-single subtraction
vec2 ds_sub(vec2 a, vec2 b) {
    return ds_add(a, ds_neg(b));
}

// Split float for exact multiplication
vec2 ds_split(float a) {
    const float SPLIT = 4097.0; // 2^12 + 1
    float t = a * SPLIT;
    float hi = t - (t - a);
    float lo = a - hi;
    return vec2(hi, lo);
}

// Double-single multiplication
vec2 ds_mul(vec2 a, vec2 b) {
    vec2 p = ds_split(a.x);
    vec2 q = ds_split(b.x);
    float p_hh = p.x * q.x;
    float p_hl = p.x * q.y;
    float p_lh = p.y * q.x;
    float p_ll = p.y * q.y;
    vec2 r = ds_quick_two_sum(p_hh, p_hl + p_lh);
    r.y += p_ll + a.x * b.y + a.y * b.x;
    r = ds_quick_two_sum(r.x, r.y);
    return r;
}

// Compare (returns true if a > b)
bool ds_gt(vec2 a, vec2 b) {
    return a.x > b.x || (a.x == b.x && a.y > b.y);
}

// Get float approximation (for escape check, coloring)
float ds_to_float(vec2 a) {
    return a.x + a.y;
}
```

### Step 2: Update Uniforms

Change `u_zoom` to double-single:

```glsl
// Before
uniform float u_zoom;

// After
uniform vec2 u_zoom;  // (hi, lo)
```

Update `pipeline.js` to pass zoom as vec2:
```javascript
// In pipeline.js render(), add uniform location for u_zoom as vec2
gl.uniform2f(this.uniforms.u_zoom, viewUniforms.zoom[0], viewUniforms.zoom[1]);
```

Update `state.js` to return zoom as array:
```javascript
getUniforms() {
    return {
        center: [
            this.centerX.hi,
            this.centerX.lo,
            this.centerY.hi,
            this.centerY.lo
        ],
        zoom: [this.zoom, 0.0],  // For now; can add lo component later
        rotation: this.rotation,
        colorOffset: this.colorOffset
    };
}
```

### Step 3: Fix mandelbrot.glsl Main Function

Replace the broken coordinate calculation and iteration:

```glsl
void main() {
    vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);

    // Apply rotation
    float cosR = cos(u_rotation);
    float sinR = sin(u_rotation);
    vec2 rotatedUV = vec2(
        uv.x * cosR - uv.y * sinR,
        uv.x * sinR + uv.y * cosR
    );

    // Calculate scale in double precision
    // scale = 2.0 / zoom
    vec2 ds_two = ds_set(2.0);
    vec2 ds_zoom = u_zoom;  // Already vec2
    vec2 ds_scale = vec2(ds_two.x / ds_zoom.x, 0.0); // Approximate for now
    
    // Actually: for proper division we'd need ds_div, but since zoom.lo is 0,
    // we can simplify: scale = 2.0 / zoom.hi (single precision is fine for scale)
    float scale = 2.0 / u_zoom.x;

    // Build c in double precision
    // c = center + rotatedUV * scale
    vec2 cx = vec2(u_center.x, u_center.y);  // centerX as DS
    vec2 cy = vec2(u_center.z, u_center.w);  // centerY as DS
    
    // Add the screen offset (this part can stay single precision - it's small)
    cx = ds_add(cx, ds_set(rotatedUV.x * scale));
    cy = ds_add(cy, ds_set(rotatedUV.y * scale));

    // [Keep cardioid/period-2 checks using float approximation]
    float cx_approx = ds_to_float(cx);
    float cy_approx = ds_to_float(cy);
    // ... existing cardioid check code using cx_approx, cy_approx ...

    // Mandelbrot iteration in double precision
    vec2 zx = ds_set(0.0);
    vec2 zy = ds_set(0.0);
    int iter = 0;

    for (int i = 0; i < 2000; i++) {
        if (i >= u_maxIter) break;

        // zx² and zy²
        vec2 zx2 = ds_mul(zx, zx);
        vec2 zy2 = ds_mul(zy, zy);

        // Escape check (use float approximation - good enough)
        float mag2 = ds_to_float(zx2) + ds_to_float(zy2);
        if (mag2 > 4.0) break;

        // z = z² + c
        // new_zx = zx² - zy² + cx
        // new_zy = 2*zx*zy + cy
        vec2 new_zx = ds_add(ds_sub(zx2, zy2), cx);
        vec2 two_zx = ds_add(zx, zx);  // 2*zx
        vec2 new_zy = ds_add(ds_mul(two_zx, zy), cy);
        
        zx = new_zx;
        zy = new_zy;
        iter = i;
    }

    // Coloring (use float approximations)
    if (iter >= u_maxIter - 1) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else {
        float zn = ds_to_float(ds_mul(zx, zx)) + ds_to_float(ds_mul(zy, zy));
        float nu = log2(log2(zn) * 0.5);
        float smoothIter = float(iter) + 1.0 - nu;

        float t = fract(smoothIter * 0.02 + u_colorOffset);
        vec3 color = palette(t);

        gl_FragColor = vec4(color, 1.0);
    }
}
```

### Step 4: Apply Same Pattern to All Shaders

Update each shader in `/shaders/`:
- julia.glsl
- burningship.glsl  
- tricorn.glsl
- celtic.glsl
- phoenix.glsl
- multibrot.glsl
- newton.glsl
- magnet.glsl
- lyapunov.glsl

Each needs:
1. Include/paste DS functions at top
2. Change `u_zoom` to `uniform vec2 u_zoom`
3. Use DS arithmetic for coordinate calculation
4. Use DS arithmetic in iteration loop
5. Use float approximations only for escape checks and coloring

### Step 5: Update Pipeline Uniform Handling

In `pipeline.js`, update the uniform locations array:
```javascript
this.uniforms = getUniformLocations(gl, this.program, [
    'u_resolution',
    'u_center',
    'u_zoom',      // Now vec2 instead of float
    'u_maxIter',
    'u_colorOffset',
    'u_rotation',
    // ... color uniforms
]);
```

And the render call:
```javascript
gl.uniform2f(this.uniforms.u_zoom, viewUniforms.zoom, 0.0);
// Or if zoom becomes DS in state.js:
// gl.uniform2f(this.uniforms.u_zoom, viewUniforms.zoom[0], viewUniforms.zoom[1]);
```

---

## Testing Plan

1. **Baseline**: Note current max usable zoom before pixelation (~10^5-10^6)
2. **After fix**: Should be smooth to ~10^12-10^14
3. **Performance**: Expect 2-3x slowdown in iteration-heavy areas
4. **Regression**: Test all 10 fractal types still work
5. **Edge cases**: 
   - Zoom all the way out (zoom < 1)
   - Pan at extreme zoom
   - Rotation at extreme zoom

## Files to Modify

| File | Changes |
|------|---------|
| `shaders/doublePrecision.glsl` | New file - DS library |
| `shaders/mandelbrot.glsl` | Full DS iteration |
| `shaders/julia.glsl` | Full DS iteration |
| `shaders/*.glsl` (8 more) | Full DS iteration |
| `js/render/pipeline.js` | Change u_zoom to vec2 |
| `js/core/state.js` | Return zoom as array (optional) |

## Performance Optimization (Future)

If performance is unacceptable, add adaptive precision:
```glsl
uniform bool u_useDoublePrecision;

// In iteration loop:
if (u_useDoublePrecision) {
    // DS math
} else {
    // Fast single-precision path
}
```

Trigger single precision when `zoomLog < 15` (zoom < ~32000x).

---

## Resources
- [GLSL Emulated Double Precision](https://blog.cyclemap.link/2011-06-09-glsl-part2-emu/)
- [double.js reference](https://github.com/munrocket/double.js)
- [Extended-Precision Floating-Point Numbers for GPU Computation](https://andrewthall.org/papers/df64_qf128.pdf) - Thall
