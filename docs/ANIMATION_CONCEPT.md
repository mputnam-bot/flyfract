# Animation Concept: Buttery Smooth Gestures

## Executive Summary

This document outlines a comprehensive approach to achieving buttery smooth 60fps animation during and after gestures in FlyFract. The goal is to make gesture start/end transitions completely invisible to users across all platforms (Chrome, Safari, mobile, desktop).

---

## Critical Insight: Resolution vs Iterations

### The Root Problem

The current `render()` function causes **visible flicker and quality jumps** because it resizes the canvas based on a quality multiplier during gestures:

```javascript
// CURRENT PROBLEMATIC CODE
const quality = this.quality.getQuality(); // 0.75 during gesture, 1.0 static
const width = Math.floor(this.canvas.clientWidth * dpr * quality);  // Canvas shrinks!
const height = Math.floor(this.canvas.clientHeight * dpr * quality);
```

When gestures start, the canvas physically shrinks to 75% resolution. When gestures end, it grows back. This resize is **immediately visible** to users as flicker.

### The Key Insight

**Users perceive resolution changes immediately but barely notice iteration count changes.**

- **Resolution drop**: Instantly visible - edges become pixelated, text blurs
- **Iteration drop**: Barely noticeable - only affects deep fractal detail that users aren't focusing on during motion

### The Solution: Fixed Resolution, Variable Iterations

```javascript
// RECOMMENDED APPROACH
render() {
    // Canvas ALWAYS at full resolution - never changes during gestures
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.floor(this.canvas.clientWidth * dpr);   // No quality multiplier!
    const height = Math.floor(this.canvas.clientHeight * dpr);

    // Only iterations change based on gesture state
    const maxIter = this.isGesturing ? 100 : 300;

    // ... rest of render
}
```

**Benefits**:
- Zero visible quality change on gesture start/end
- Consistent sharpness during pan/zoom
- Still maintains 60fps (iterations are the GPU bottleneck, not resolution)
- Dramatically simpler implementation

### Why This Works

Fractal rendering performance is dominated by **iteration count**, not pixel count:

| Scenario | Pixels | Iterations | GPU Time |
|----------|--------|------------|----------|
| Current gesture mode | 56% (0.75²) | 65% | ~36% of full |
| Proposed gesture mode | 100% | 33% (100/300) | ~33% of full |

The proposed approach achieves **similar performance** with **zero visible quality loss**.

---

## Current Architecture Analysis

### Overview

The current system has three independent `requestAnimationFrame` loops:

1. **Main Render Loop** (`app.js:tick()`) - Handles frame rendering
2. **Momentum Animation** (`controller.js:startMomentum()`) - Handles pan inertia
3. **Zoom Animator** (`animator.js:tick()`) - Handles double-tap zoom tweens

This fragmentation causes animation stutters due to frame desynchronization.

### Current Render Flow

```
Gesture Event → State Update → needsRender = true → Next RAF → Render
```

**Latency**: 1-16ms between gesture and render (depends on RAF phase)

### Identified Issues

| Issue | Severity | Impact |
|-------|----------|--------|
| Canvas resize on gesture state change | **Critical** | Visible flicker on gesture start/end |
| Three separate RAF chains | Critical | Frame desync, stutters |
| No gesture batching | Medium | Multiple renders per frame |
| Momentum/animator don't cancel | Medium | Conflicting animations |

---

## Target Experience

### Goals

1. **Zero visible transition** when gesture starts or ends
2. **Consistent 60fps** during all interactions
3. **Identical experience** across Chrome, Safari, iOS, Android
4. **Graceful degradation** on lower-end devices (maintain smoothness over quality)
5. **Momentum that feels natural** - no jarring stops or starts

### Success Metrics

- Frame time variance < 2ms during gestures
- No frame drops on gesture start/end
- **No visible resolution change** at any point
- Momentum feels continuous with gesture (no gap)

---

## Proposed Architecture

### 1. Fixed Resolution Rendering (Priority: Critical)

**Problem**: Canvas resizes based on gesture state, causing visible flicker.

**Solution**: Keep canvas at full resolution always; only adjust iterations.

```javascript
class RenderController {
    constructor() {
        this.gestureIterations = 100;    // Fast response during gestures
        this.staticIterations = 300;      // Full detail when static
        this.currentIterations = 300;
        this.iterationTransitionSpeed = 0.2;
    }

    getIterations(isGesturing) {
        const target = isGesturing ? this.gestureIterations : this.staticIterations;

        // Smooth transition to avoid any visual pop
        this.currentIterations += (target - this.currentIterations) * this.iterationTransitionSpeed;

        return Math.floor(this.currentIterations);
    }

    render() {
        const gl = this.gl;

        // ALWAYS full resolution - no quality multiplier
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.floor(this.canvas.clientWidth * dpr);
        const height = Math.floor(this.canvas.clientHeight * dpr);

        // Only resize if screen size actually changed (orientation, window resize)
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
            gl.viewport(0, 0, width, height);
        }

        // Iterations are the ONLY thing that changes based on gesture state
        const maxIter = this.getIterations(this.isGesturing);

        gl.uniform1i(uniforms.u_maxIter, maxIter);

        // ... rest of render unchanged
    }
}
```

**Key Changes**:
- Remove `quality.getQuality()` from canvas size calculation
- Canvas size only changes on actual screen resize
- Iteration count smoothly transitions between gesture/static values

**Benefits**:
- Eliminates the primary source of visible flicker
- Simpler code (remove quality adaptation for resolution)
- Consistent visual quality throughout interaction

### 2. Unified Animation Loop

**Problem**: Three RAF loops cause frame desynchronization.

**Solution**: Single master loop that orchestrates all animations.

```javascript
class AnimationOrchestrator {
    constructor() {
        this.animations = new Map();      // Active tweens
        this.momentum = null;             // Current momentum state
        this.renderCallback = null;       // Render function
        this.running = false;
    }

    tick(timestamp) {
        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        // 1. Process momentum (if active)
        if (this.momentum) {
            this.updateMomentum(dt);
        }

        // 2. Process active tweens
        for (const [id, anim] of this.animations) {
            this.updateAnimation(anim, timestamp);
            if (anim.complete) this.animations.delete(id);
        }

        // 3. Single render call
        if (this.needsRender()) {
            this.renderCallback();
        }

        requestAnimationFrame(this.tick.bind(this));
    }
}
```

**Benefits**:
- Single RAF means consistent frame pacing
- Momentum and tweens processed in same frame
- Single render per frame regardless of input frequency

### 3. Gesture-Render Decoupling

**Problem**: Gestures directly modify state, causing immediate renders.

**Solution**: Buffer gesture inputs and apply once per frame.

```javascript
class GestureBuffer {
    constructor() {
        this.pendingPan = { dx: 0, dy: 0 };
        this.pendingZoom = { scale: 1, cx: 0, cy: 0 };
        this.pendingRotation = 0;
    }

    addPan(dx, dy) {
        this.pendingPan.dx += dx;
        this.pendingPan.dy += dy;
    }

    addZoom(scale, cx, cy) {
        this.pendingZoom.scale *= scale;
        this.pendingZoom.cx = cx;
        this.pendingZoom.cy = cy;
    }

    flush(viewState) {
        // Apply accumulated gestures atomically
        if (this.pendingPan.dx !== 0 || this.pendingPan.dy !== 0) {
            viewState.pan(this.pendingPan.dx, this.pendingPan.dy);
        }
        if (this.pendingZoom.scale !== 1) {
            viewState.zoomAt(this.pendingZoom.scale,
                           this.pendingZoom.cx,
                           this.pendingZoom.cy);
        }
        if (this.pendingRotation !== 0) {
            viewState.rotate(this.pendingRotation);
        }
        this.reset();
    }

    reset() {
        this.pendingPan = { dx: 0, dy: 0 };
        this.pendingZoom = { scale: 1, cx: 0, cy: 0 };
        this.pendingRotation = 0;
    }
}
```

**Benefits**:
- Multiple gesture events → single state update
- Predictable frame timing
- Easier to implement gesture prediction

### 4. Iteration Count Smoothing

**Problem**: Even iteration changes can be slightly noticeable if abrupt.

**Solution**: Smooth iteration transitions over a few frames.

```javascript
class IterationController {
    constructor() {
        this.current = 300;
        this.gestureTarget = 100;      // During gestures
        this.staticTarget = 300;       // When static
        this.transitionSpeed = 0.25;   // Reaches target in ~4-5 frames
    }

    update(isGesturing) {
        const target = isGesturing ? this.gestureTarget : this.staticTarget;

        // Exponential interpolation
        this.current += (target - this.current) * this.transitionSpeed;

        // Snap when very close
        if (Math.abs(this.current - target) < 5) {
            this.current = target;
        }

        return Math.floor(this.current);
    }
}
```

**Transition Curve** (gesture start):
```
Frame 0: 300 → target 100
Frame 1: 250
Frame 2: 212
Frame 3: 184
Frame 4: 163
Frame 5: 147
Frame 6: 135
Frame 7: 126
Frame 8: 120
Frame 9: 115
Frame 10: ~105 (approaching target)
```

**Benefits**:
- Even smoother experience
- No abrupt changes ever
- Configurable transition speed

### 5. Momentum Continuity

**Problem**: Gap between last gesture frame and first momentum frame.

**Solution**: Momentum starts immediately in same RAF cycle as gesture end.

```javascript
// In GestureController
onTouchEnd(e) {
    // ... existing code ...

    if (shouldStartMomentum) {
        // DON'T start new RAF - signal to orchestrator
        this.orchestrator.startMomentum({
            velocityX: this.velocity.x,
            velocityY: this.velocity.y,
            friction: 0.94
        });
    }

    // Gesture end callback happens AFTER momentum setup
    this.callbacks.onGestureEnd();
}

// In AnimationOrchestrator
startMomentum(config) {
    this.momentum = {
        vx: config.velocityX,
        vy: config.velocityY,
        friction: config.friction,
        active: true
    };
    // Will be processed in next tick() naturally
}
```

**Benefits**:
- Zero-frame gap between gesture and momentum
- Momentum processed in unified loop
- Natural velocity handoff

### 6. Emergency Quality Fallback (Low-End Devices Only)

For extremely low-end devices that can't maintain 60fps even with reduced iterations:

```javascript
class EmergencyQuality {
    constructor() {
        this.frameTimeHistory = [];
        this.resolutionScale = 1.0;
        this.emergencyThreshold = 25; // ms (40fps)
    }

    update(frameTime) {
        this.frameTimeHistory.push(frameTime);
        if (this.frameTimeHistory.length > 30) {
            this.frameTimeHistory.shift();
        }

        const avgFrameTime = this.getAverage();

        // Only reduce resolution as absolute last resort
        if (avgFrameTime > this.emergencyThreshold && this.resolutionScale > 0.5) {
            this.resolutionScale *= 0.95;
            console.warn('Emergency quality reduction:', this.resolutionScale);
        }

        // Recover very slowly to avoid oscillation
        if (avgFrameTime < 14 && this.resolutionScale < 1.0) {
            this.resolutionScale = Math.min(1.0, this.resolutionScale * 1.01);
        }

        return this.resolutionScale;
    }
}
```

**Note**: This is a fallback for devices that truly can't keep up. Most devices should never trigger this.

---

## Platform-Specific Considerations

### Chrome (Desktop & Android)

**Strengths**:
- Consistent RAF timing
- Excellent WebGL performance
- Predictable touch events

**Considerations**:
- Trackpad wheel events have different deltaY than mouse
- High-DPR displays (2x-3x) handled by DPR cap

**Recommendations**:
```javascript
// Detect trackpad vs mouse wheel
const isTrackpad = Math.abs(e.deltaY) < 50 && !Number.isInteger(e.deltaY);
const zoomFactor = isTrackpad ? 1 + e.deltaY * 0.002 : (e.deltaY > 0 ? 0.9 : 1.1);
```

### Safari (Desktop & iOS)

**Strengths**:
- Native gesture recognition
- Smooth momentum scrolling

**Considerations**:
- `gesturestart/change/end` events fire alongside touch events
- WebGL context loss more frequent under memory pressure
- `-webkit-overflow-scrolling: touch` can interfere

**Recommendations**:
```javascript
// Prevent Safari gesture conflicts
element.addEventListener('gesturestart', e => e.preventDefault());
element.addEventListener('gesturechange', e => e.preventDefault());
element.addEventListener('gestureend', e => e.preventDefault());

// Handle context loss gracefully
canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    this.pauseRendering();
});
canvas.addEventListener('webglcontextrestored', () => {
    this.rebuildContext();
    this.resumeRendering();
});
```

### iOS Safari (Mobile)

**Strengths**:
- 120Hz ProMotion on newer devices
- Excellent touch latency

**Considerations**:
- 100vh includes address bar (use `-webkit-fill-available`)
- Double-tap zoom must be prevented
- Safe area insets for notch
- DPR can be 3x (cap at 2x for performance)

**Recommendations**:
```javascript
// Detect ProMotion and adjust iteration targets
const isProMotion = window.matchMedia('(min-resolution: 3dppx)').matches
                    && /iPhone/.test(navigator.userAgent);
// ProMotion devices can handle more iterations during gestures
const gestureIterations = isProMotion ? 150 : 100;
```

### Android Chrome (Mobile)

**Strengths**:
- Wide device compatibility
- Good touch event support

**Considerations**:
- Huge device variance (flagships to budget)
- Some devices have 90Hz or 120Hz displays
- Touch sampling rates vary

**Recommendations**:
```javascript
// Detect device tier and adjust iterations accordingly
const deviceMemory = navigator.deviceMemory || 4;
const gestureIterations = deviceMemory >= 6 ? 150 : deviceMemory >= 4 ? 100 : 75;
const staticIterations = deviceMemory >= 6 ? 400 : deviceMemory >= 4 ? 300 : 200;
```

---

## Implementation Plan

### Phase 1: Fixed Resolution Rendering (Priority: Critical)

**This is the single most impactful change.**

1. Remove `quality.getQuality()` from canvas dimension calculation in `render()`
2. Canvas dimensions only based on `clientWidth * dpr` and `clientHeight * dpr`
3. Move quality adaptation to iterations only
4. Test on multiple devices to verify no flicker

**Code Changes**:
```javascript
// In app.js render()
// REMOVE this:
const quality = this.quality.getQuality();
const width = Math.floor(this.canvas.clientWidth * dpr * quality);

// REPLACE with:
const width = Math.floor(this.canvas.clientWidth * dpr);

// Iterations now handle performance:
const maxIter = this.isGesturing ? 100 : 300;
```

**Estimated Complexity**: Low
**Risk**: Low (simpler code)
**Testing**: Visual inspection for flicker, frame time monitoring

### Phase 2: Unified Animation Loop (Priority: High)

1. Create `AnimationOrchestrator` class
2. Move momentum from `GestureController` to orchestrator
3. Move tweens from `Animator` to orchestrator
4. Update `app.js` to use single tick function
5. Verify frame timing consistency

**Estimated Complexity**: Medium
**Risk**: Medium (architecture change)
**Testing**: Frame time logging, momentum smoothness

### Phase 3: Gesture Buffering (Priority: Medium)

1. Create `GestureBuffer` class
2. Modify gesture callbacks to buffer instead of direct update
3. Flush buffer in orchestrator tick
4. Handle edge cases (gesture cancel, rapid switching)

**Estimated Complexity**: Low-Medium
**Risk**: Low
**Testing**: Rapid gesture sequences, multi-touch transitions

### Phase 4: Iteration Smoothing (Priority: Medium)

1. Add `IterationController` class
2. Smooth transitions between gesture/static iteration counts
3. Configure per-device iteration targets
4. Test at various zoom levels

**Estimated Complexity**: Low
**Risk**: Low
**Testing**: Deep zoom exploration, gesture spam

### Phase 5: Platform Polish (Priority: Low)

1. Safari gesture event handling
2. iOS ProMotion detection
3. Android device tier detection
4. Emergency quality fallback for low-end devices

**Estimated Complexity**: Medium
**Risk**: Low (isolated changes)
**Testing**: Device matrix testing

---

## Technical Specifications

### Frame Budget

```
Target: 60fps = 16.67ms per frame

Budget Allocation:
├── Input Processing:     1ms
├── State Updates:        1ms
├── Uniform Setup:        0.5ms
├── GPU Render:           13ms (target)
├── Buffer Swap:          1ms
└── Headroom:             0.17ms

If GPU render exceeds 13ms → reduce iterations (not resolution)
```

### Iteration Levels

| State | Iterations | Purpose |
|-------|------------|---------|
| Gesture (low-end) | 75 | Budget devices during interaction |
| Gesture (mid-range) | 100 | Standard devices during interaction |
| Gesture (high-end) | 150 | Flagship devices during interaction |
| Static (low-end) | 200 | Budget devices at rest |
| Static (mid-range) | 300 | Standard devices at rest |
| Static (high-end) | 400 | Flagship devices at rest |

### Resolution Policy

| Scenario | Resolution | Notes |
|----------|------------|-------|
| Normal operation | 100% | Always full resolution |
| Gesture active | 100% | No change |
| Emergency fallback | 50-100% | Only on devices that can't maintain 40fps |

### Momentum Physics

```javascript
const FRICTION = 0.94;           // Per-frame multiplier
const MIN_VELOCITY = 0.5;        // px/frame to stop
const MAX_VELOCITY = 100;        // px/frame cap
const VELOCITY_SMOOTHING = 0.5;  // Blend factor for new samples
```

### Transition Timings

| Transition | Duration | Curve |
|------------|----------|-------|
| Iteration drop | ~80ms | Exponential (fast) |
| Iteration recovery | ~150ms | Exponential (slow) |
| Double-tap zoom | 300ms | easeOutCubic |

---

## Success Criteria

### Quantitative

- [ ] Average frame time < 16ms on mid-range devices
- [ ] Frame time variance < 2ms during gestures
- [ ] Zero dropped frames on gesture start/end (60fps devices)
- [ ] **Zero canvas resizes** during normal operation
- [ ] Momentum velocity error < 5% from gesture velocity

### Qualitative

- [ ] **No visible quality change** on gesture start
- [ ] **No visible quality change** on gesture end
- [ ] Momentum feels like natural continuation of gesture
- [ ] Double-tap zoom feels smooth, not jerky
- [ ] Pinch-zoom tracks fingers precisely
- [ ] Rotation feels 1:1 with finger movement

### Platform Parity

- [ ] Chrome desktop matches Safari desktop
- [ ] iOS Safari matches Android Chrome
- [ ] High-refresh displays feel smoother (not same as 60Hz)

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Low iterations cause visual artifacts | Low | Set minimum at 75; users don't focus on detail during motion |
| Unified loop increases complexity | Medium | Thorough testing, phased rollout |
| Low-end devices still stutter | Medium | Emergency resolution fallback as last resort |
| Safari-specific bugs | Medium | Platform detection, fallbacks |

---

## Appendix: Why Resolution Changes Are Visible

### Visual Science

When resolution changes:
1. **Edge aliasing changes** - Users perceive this as "shimmer" or "flicker"
2. **Subpixel rendering changes** - Text and fine details shift position
3. **Canvas scaling changes** - Browser's upscaling algorithm is visible

When iterations change:
1. **Deep detail changes** - Only affects the "infinite" detail at fractal edges
2. **During motion, detail is blurred anyway** - Motion blur masks iteration differences
3. **User attention is on the pan/zoom target** - Not examining fine detail

### Performance Reality

Resolution affects GPU in two ways:
1. **Fragment shader invocations** = width × height (quadratic)
2. **Memory bandwidth** = proportional to pixel count

Iterations affect GPU:
1. **Loop iterations per pixel** (linear per pixel)
2. **No memory bandwidth impact**

For fractal rendering, **iterations dominate** because the escape-time algorithm is computationally expensive. Reducing iterations from 300 to 100 saves ~67% of GPU work. Reducing resolution from 100% to 75% saves ~44% of work but causes visible artifacts.

---

## Conclusion

The single most impactful change is **removing resolution scaling and using iteration-only performance adaptation**. This eliminates the visible flicker that occurs on gesture start/end while maintaining 60fps performance.

**Recommended priority**:
1. **Phase 1: Fixed Resolution** (Critical - eliminates flicker)
2. Phase 2: Unified Animation Loop (High - eliminates frame desync)
3. Phase 3: Gesture Buffering (Medium - improves consistency)
4. Phase 4: Iteration Smoothing (Medium - extra polish)
5. Phase 5: Platform Polish (Low - edge cases)

The key insight is: **users see resolution changes but don't see iteration changes during motion**. Leverage this to maintain visual quality while achieving performance targets.
