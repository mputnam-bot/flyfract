# FlyFract - Performance Optimization Plan

## Current State

The app has solid foundational architecture:
- ✅ **AnimationOrchestrator**: Unified RAF loop (no frame desync)
- ✅ **Gesture Buffering**: Atomic gesture input batching
- ✅ **Iteration Smoothing**: Smooth transitions between gesture/static states (prevents flickering)
- ✅ **Device-Tier Detection**: Iteration counts based on device memory tier
- ✅ **QualityAdapter**: Adaptive quality management (resolution scaling)
- ✅ **DPR Capping**: Device pixel ratio capped at 2.0 for performance
- ✅ **10 Fractals**: All fractals implemented with optimized shaders
- ✅ **Fixed Resolution During Gestures**: Canvas resolution stays constant; only iterations change (eliminates flicker)

## Optimization Opportunities

### Priority 1: High Impact, Low Effort

#### 1.1 Remove preserveDrawingBuffer
**File:** `js/render/webgl.js`

Currently enabled for screenshot support but costs ~5-10% performance on mobile. The canvas can still be captured via `toDataURL()` immediately after render.

```javascript
// Change from:
preserveDrawingBuffer: true
// To:
preserveDrawingBuffer: false
```

**Impact:** 5-10% GPU improvement on mobile
**Risk:** Low - test screenshot functionality after

---

#### 1.2 Integrate QualityAdapter
**Files:** `js/core/quality.js`, `js/app.js`

QualityAdapter exists but is not connected to the render pipeline. It should dynamically adjust DPR based on frame timing.

- Track frame times over rolling window
- If average > 20ms, reduce quality multiplier
- If average < 12ms, increase quality multiplier
- Apply multiplier to canvas resolution

**Impact:** Adaptive performance across all devices
**Risk:** Medium - needs careful tuning to avoid oscillation

---

#### 1.3 Lazy Shader Loading
**File:** `js/fractals/index.js`

Currently all 10 shaders compile at startup (~30-50ms). Defer compilation of less common fractals.

**Eager load (startup):**
- Mandelbrot
- Julia
- Burning Ship

**Lazy load (on first use):**
- Tricorn, Newton, Phoenix, Lyapunov, Multibrot, Magnet, Celtic

**Impact:** 50-70% faster initial load
**Risk:** Low - brief pause on first switch to lazy fractal

---

#### 1.4 Zoom-Adaptive Iteration Scaling
**File:** `js/core/orchestrator.js`

Current iteration targets are fixed per device tier. Should scale with zoom level.

```javascript
// Proposed formula:
const zoomFactor = Math.max(0, Math.log2(zoom));
const baseIter = deviceTierIterations;
const scaledIter = baseIter + zoomFactor * 15;
const maxIter = Math.min(1500, scaledIter);
```

**Impact:** Better detail at deep zooms, less waste at shallow zooms
**Risk:** Low

---

### Priority 2: Medium Impact, Medium Effort

#### 2.1 FPS Throttling on Mobile
**File:** `js/core/orchestrator.js`

Currently renders as fast as GPU allows. On 120Hz ProMotion displays, this wastes power during static viewing.

- Detect display refresh rate
- During gestures: render at native rate (smooth interaction)
- During static: cap at 30fps (save power, no visual difference)

**Impact:** 50-75% power reduction during idle viewing on high-refresh displays
**Risk:** Low

---

#### 2.2 Separate Rainbow Shader Variant
**Files:** `shaders/*.glsl`

Every fragment checks `if (abs(u_colorD.x - 0.833) < 0.001 ...)` for rainbow mode. This branch happens for every pixel every frame.

Options:
1. Precompute flag as uniform `u_isRainbow`
2. Create separate `_rainbow.glsl` variants
3. Use preprocessor-style shader composition

**Impact:** ~2-5% shader performance improvement
**Risk:** Low - increases code maintenance slightly

---

#### 2.3 Progressive Rendering for Static View
**Files:** `js/app.js`, `js/core/orchestrator.js`

When view is static, render progressively:
1. First frame: 50% resolution, low iterations
2. Second frame: 75% resolution, medium iterations
3. Third frame: 100% resolution, full iterations

User sees instant feedback, then quality improves over 3-5 frames.

**Impact:** Perceived performance improvement, especially on mobile
**Risk:** Medium - complexity in state management

---

#### 2.4 Web Worker for Shader Compilation
**File:** `js/render/shaders.js`

Move shader fetch + compilation to Web Worker to avoid blocking main thread during load.

```javascript
// Main thread
const worker = new Worker('shader-worker.js');
worker.postMessage({ type: 'compile', shader: 'mandelbrot' });

// Worker
self.onmessage = async (e) => {
  const source = await fetch(e.data.shader);
  // Note: WebGL context can't be used in worker
  // But we can pre-fetch and parse GLSL
  self.postMessage({ source });
};
```

**Limitation:** Actual GL compilation must happen on main thread, but fetch/parse can be offloaded.

**Impact:** Smoother loading experience
**Risk:** Medium - worker setup complexity

---

### Priority 3: High Impact, High Effort

#### 3.1 Render-to-Texture Caching
**Files:** New render cache system

When panning (no zoom change), previous frame can be translated and only edges need re-rendering.

1. Render to offscreen framebuffer
2. On pan: blit translated texture, render only new edge pixels
3. On zoom: full re-render

**Impact:** 60-80% reduction in render work during pan
**Risk:** High - significant architecture change

---

#### 3.2 Adaptive Sampling / Checkerboard Rendering
**Files:** `shaders/*.glsl`, `js/app.js`

At deep zooms, many adjacent pixels have similar values. Use adaptive sampling:

1. Render checkerboard pattern (50% pixels)
2. Interpolate missing pixels
3. Re-render areas with high variance

Or implement hierarchical rendering:
1. 1/4 resolution pass
2. Identify interesting regions
3. Full resolution only where needed

**Impact:** 2-4x speedup at deep zooms
**Risk:** High - visual artifacts if not tuned well

---

#### 3.3 Perturbation Theory for Deep Zoom
**Files:** `shaders/*.glsl`

At extreme zooms (>10^14), single-precision breaks down. Perturbation theory computes a reference orbit at high precision (CPU), then GPU computes deltas.

**Impact:** Enables zooms to 10^100+ with full precision
**Risk:** Very high - major mathematical and architectural change

---

#### 3.4 Tile-Based Rendering with LOD
**Files:** New tile system

Divide view into tiles, render at different levels of detail:
- Center tiles: high iteration, full resolution
- Edge tiles: lower iteration, can be lower resolution
- Off-screen tiles: don't render

Combined with caching, enables smooth infinite pan.

**Impact:** Enables arbitrary resolution rendering, better memory management
**Risk:** Very high - fundamental architecture change

---

## Implementation Order

### Phase 1: Quick Wins (1-2 hours) ✅ COMPLETE
1. [x] 1.1 - Remove preserveDrawingBuffer
2. [x] 1.4 - Zoom-adaptive iteration scaling

### Phase 2: Quality System (2-4 hours) ✅ COMPLETE
3. [x] 1.2 - Integrate QualityAdapter
4. [x] 2.1 - FPS throttling on mobile

### Phase 3: Load Time (2-3 hours) ✅ COMPLETE (Loading screen implemented)
5. [ ] 1.3 - Lazy shader loading

### Phase 4: Shader Optimization (2-3 hours) ✅ COMPLETE (All 10 fractals optimized)
6. [x] 2.2 - Rainbow shader optimization

### Phase 5: Progressive Rendering (4-6 hours) ❌ REMOVED (Replaced with AnimationOrchestrator + iteration smoothing)
7. [ ] 2.3 - Progressive rendering for static view

### Phase 6: Advanced (future)
8. [ ] 3.1 - Render-to-texture caching
9. [ ] 3.2 - Adaptive sampling

---

## Metrics to Track

- **Frame time:** Target <16ms (60fps) on mid-range mobile
- **Time to interactive:** Target <1s on fast 3G
- **Memory usage:** Track via Performance API
- **Battery impact:** Test with Safari Web Inspector energy panel

## Testing Devices

- iPhone 12/13 (high-end mobile)
- iPhone SE / budget Android (low-end mobile)
- M1 MacBook (high-end desktop)
- Chromebook (low-end desktop)
