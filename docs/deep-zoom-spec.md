# FlyFract - Deep Zoom Implementation Spec

## Status: IMPLEMENTED (Perturbation Theory)

Deep zoom is now implemented using perturbation theory, which avoids the GLSL compiler optimization issues that defeated the double-single (DS) arithmetic approach.

### Current Implementation

The perturbation theory approach works by:
1. Computing a reference orbit at the center point using arbitrary precision (CPU)
2. GPU computes small deltas from the reference using single precision
3. This allows zoom depths far beyond single-precision limits

**Files added:**
- `js/core/bigfloat.js` - Arbitrary precision floating point library
- `js/core/reference-orbit.js` - Reference orbit computation and management
- `shaders/mandelbrot_deep.glsl` - Perturbation theory shader

**Deep zoom activates automatically at zoomLog > 20 (approximately 10^6x zoom).**

### How It Works

#### 1. BigFloat Arbitrary Precision (bigfloat.js)

Custom arbitrary precision floating point using:
- Mantissa stored as array of float64 limbs (~26 bits each)
- Separate exponent for scale
- Supports add, subtract, multiply operations
- `BigComplex` class for complex number operations

Precision automatically scales with zoom level (4-16 limbs = 104-416 bits).

#### 2. Reference Orbit Computation (reference-orbit.js)

The `ReferenceOrbit` class:
- Computes Mandelbrot orbit Z_n at center point using BigFloat
- Stores orbit values as Float32 for GPU transfer
- Creates float texture containing: [Z_n.re, Z_n.im, 2*Z_n.re, 2*Z_n.im]
- `DeepZoomManager` handles caching and texture management

#### 3. Perturbation Shader (mandelbrot_deep.glsl)

Instead of computing z = z² + c directly, uses:
```
δ_{n+1} = 2 * Z_n * δ_n + δ_n² + δ_c
```
Where:
- Z_n = reference orbit value from texture
- δ_n = pixel's delta from reference (single precision)
- δ_c = pixel_c - reference_c

**Glitch Detection:** If δ becomes large relative to Z_n, falls back to direct iteration.

### Performance Optimizations

1. **Deferred Computation**: Reference orbit only computed after gestures end
2. **Throttled Updates**: Minimum 100-200ms between orbit updates
3. **Gesture Fallback**: Uses standard shader during pinch/pan for smoothness
4. **Mobile Aware**: Longer throttle times on mobile devices

### Supported Fractals

Currently only Mandelbrot supports deep zoom. Other fractals would need their own perturbation formulas.

### Zoom Limits

- Standard precision: ~10^6x (zoomLog ≈ 20)
- Deep zoom: ~10^30x (zoomLog ≈ 100, depends on precision)
- Theoretical: Limited by BigFloat precision, not GPU

---

## Previous Attempt (Double-Single Arithmetic)

---

## What We Tried

### Approach: Double-Single (DS) Emulated Precision

The idea was to emulate ~48-bit precision using two 32-bit floats (hi, lo) where `true_value = hi + lo`. This is a well-known technique (Dekker/Knuth algorithms) that works in CPU code.

### Implementation

1. **DS Arithmetic Library** (`shaders/lib/double.glsl`)
   - `ds_set()` - Create DS from float
   - `ds_add()` - Add two DS numbers using Knuth's two-sum algorithm
   - `ds_sub()` - Subtraction
   - `ds_mul()` - Multiplication using Dekker's algorithm with Veltkamp splitting
   - `ds_float()` - Convert back to float

2. **JavaScript Side** (`js/core/state.js`)
   - `dsSplit(x)` - Split JS double into hi/lo using `Math.fround()`
   - Center coordinates stored as `{hi, lo}` pairs
   - Passed to shader as `vec4(x.hi, x.lo, y.hi, y.lo)`

3. **DP Shader Variants**
   - Created `*_dp.glsl` variants for 7 fractals
   - Used DS arithmetic for all iteration math
   - DS library injected via shader preprocessor

### Anti-Optimization Attempts

The core problem: GLSL compilers aggressively optimize floating-point operations, breaking error-free transformations. For example, `(a + b) - a` may be optimized to just `b`, destroying the error capture.

We tried several approaches to prevent optimization:

1. **Explicit `highp` qualifiers** - No effect
2. **`min(x, x)` pattern** - Compiler optimized away
3. **`gl_FragCoord` dependency** - `x * sign(gl_FragCoord.x + 1.0)` - Still didn't work
4. **DS multiplication for screen offset** - Used `ds_mul(ds_set(uv), ds_scale)` instead of `ds_set(uv * scale)`

None of these prevented the pixelation at ~100Kx zoom.

---

## Why It Failed

### Root Cause: GLSL Compiler Optimization

GLSL ES (WebGL) compilers are designed to aggressively optimize shader code. The error-free transformations that DS arithmetic depends on require specific operation ordering:

```glsl
float s = a + b;
float v = s - a;
float e = (a - (s - v)) + (b - v);  // Captures rounding error
```

If the compiler simplifies `s - a` to `b` or folds operations, the error term `e` becomes zero, and DS arithmetic provides no benefit over regular floats.

### Evidence

- "deep" indicator appeared at 32Kx (DP shader was loading)
- Fractal rendered (shader compiled successfully)
- But pixelation was identical to single-precision shader
- This confirms the DS math was executing but not providing precision benefit

### GPU/Driver Variance

Different GPUs have different GLSL compilers with varying optimization behaviors. What works on one GPU may not work on another.

---

## Lessons Learned

1. **DS arithmetic in GLSL is unreliable** - Without a `precise` qualifier (not available in GLSL ES/WebGL), there's no way to guarantee operation ordering.

2. **WebGL 1.0 limitations** - No native double precision, no `precise` qualifier, limited control over compiler behavior.

3. **The standard solution is Perturbation Theory** - Professional Mandelbrot viewers (like Kalles Fraktaler) use perturbation theory for deep zoom:
   - Compute one reference orbit at arbitrary precision on CPU
   - GPU computes small deltas from reference using single precision
   - Can achieve 10^100+ zoom with single-precision GPU math

4. **Alternative: WebGPU** - WebGPU may offer better control over shader compilation, but has limited browser support.

---

## Potential Future Approaches

### 1. Perturbation Theory (Recommended)

```
CPU: Compute reference orbit at full precision (BigFloat/arbitrary precision)
GPU: For each pixel, compute delta from reference
     delta_n+1 = 2 * Z_n * delta_n + delta_n^2 + delta_c
     (all single precision, Z_n from CPU reference)
```

Pros:
- Works with single-precision GPU
- Enables essentially unlimited zoom depth
- Well-documented algorithm

Cons:
- Significant implementation complexity
- Need arbitrary precision math library (e.g., decimal.js)
- Reference orbit computation on CPU can be slow

### 2. WebGPU with Explicit Control

When WebGPU has broader support, it may offer:
- Better shader compilation control
- Potentially native f64 support on some hardware
- More predictable behavior

### 3. WASM + Software Rendering

For extreme deep zoom:
- Compute fractal on CPU using WASM with arbitrary precision
- Render to canvas
- Much slower but unlimited precision

---

## Files Created (Now Removed)

The following files were created during the implementation attempt and have been removed:

- `shaders/lib/double.glsl`
- `shaders/mandelbrot_dp.glsl`
- `shaders/julia_dp.glsl`
- `shaders/burningship_dp.glsl`
- `shaders/tricorn_dp.glsl`
- `shaders/celtic_dp.glsl`
- `shaders/phoenix_dp.glsl`
- `shaders/multibrot_dp.glsl`

---

## Current Zoom Limits

Without deep zoom, the practical limit is approximately:
- **~100,000x (10^5)** - Pixelation becomes noticeable
- **~1,000,000x (10^6)** - Severe pixelation, unusable

This is inherent to 32-bit float precision and cannot be improved without one of the approaches listed above.
