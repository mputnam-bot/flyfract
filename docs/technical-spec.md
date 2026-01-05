# FlyFract - Technical Specification

## 1. Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application Shell                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    UI Layer (DOM)                       │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐  │    │
│  │  │ Fractal  │  │  Color   │  │   Photo  │  │   Info  │  │    │
│  │  │ Selector │  │ Switcher │  │  Button  │  │ Button  │  │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                  │
│  ┌───────────────────────────▼─────────────────────────────┐    │
│  │                  Gesture Controller                     │    │
│  │  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌──────────┐   │    │
│  │  │  Pan    │  │  Pinch  │  │ Double   │  │ Momentum │   │    │
│  │  │ Handler │  │ Handler │  │   Tap    │  │  System  │   │    │
│  │  └─────────┘  └─────────┘  └──────────┘  └──────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                  │
│  ┌───────────────────────────▼─────────────────────────────┐    │
│  │                   Render Controller                     │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │    │
│  │  │ View State  │  │  Quality    │  │  Animation      │  │    │
│  │  │  Manager    │  │  Adapter    │  │  Orchestrator   │  │    │
│  │  │ (Emulated   │  │ (Resolution │  │ (Unified Loop,  │  │    │
│  │  │  Double     │  │  Scaling)   │  │  Iteration      │  │    │
│  │  │  Precision) │  │             │  │  Smoothing)     │  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                  │
│  ┌───────────────────────────▼─────────────────────────────┐    │
│  │                   WebGL Renderer                        │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │    │
│  │  │   Shader    │  │   Color     │  │   Texture       │  │    │
│  │  │   Manager   │  │   Mapper    │  │   Manager       │  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                  │
│  ┌───────────────────────────▼─────────────────────────────┐    │
│  │                     GPU (WebGL)                         │    │
│  │  ┌─────────────────────────────────────────────────────┐│    │
│  │  │              Fragment Shader (Per-Pixel)            ││    │
│  │  │         Fractal Computation + Coloring              ││    │
│  │  └─────────────────────────────────────────────────────┘│    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Single Responsibility**: Each module handles one concern
2. **GPU-First**: All fractal math runs on GPU via WebGL shaders
3. **Event-Driven**: Gestures emit events, render reacts
4. **State Minimalism**: Minimal state, derived on demand
5. **Zero Dependencies**: Vanilla JS, no frameworks, no build step

---

## 2. Tech Stack Decisions

### Core Technology Choices

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Framework** | Vanilla JS (ES6+) | Zero bundle overhead, faster load, simpler debugging |
| **Rendering** | WebGL 1.0 | GPU acceleration essential for 60fps; WebGL 1.0 for max compatibility |
| **Styling** | CSS Custom Properties | Theme switching, minimal CSS, hardware-accelerated animations |
| **Build** | None (or optional ESBuild) | No transpilation needed for modern mobile browsers |
| **State** | Simple object + events | No state library overhead |

### Why Vanilla JS Over Frameworks

1. **Bundle Size**: React/Vue add 30-100KB+ gzipped; we target <150KB total (compressed)
2. **Performance**: No virtual DOM diffing overhead
3. **Simplicity**: Fractal app has minimal UI state
4. **Control**: Direct WebGL integration without framework abstractions
5. **Load Time**: Faster parse/compile, critical for first paint

### Why WebGL Over Canvas 2D

| Factor | Canvas 2D | WebGL |
|--------|-----------|-------|
| Per-pixel computation | CPU-bound, slow | GPU-parallel, fast |
| 60fps on 1080p | Impossible | Achievable |
| Iteration depth | ~50 max | ~1000+ |
| Zoom precision | Float64 in JS | Float32 in shader (with workarounds) |
| Battery efficiency | Poor | Better (GPU optimized for parallel) |

**Decision**: WebGL is non-negotiable for smooth mobile fractal rendering.

### Precision Strategy

WebGL uses 32-bit floats, limiting zoom to ~10^7. Deep zoom (double-precision emulation) was attempted but not successfully implemented due to GLSL compiler optimizations defeating the double-single arithmetic approach.

**Current Status**: Standard 32-bit float precision (zoom limit ~10^7x)

**Future Work**: See `docs/deep-zoom-spec.md` for details on the attempted implementation and potential alternative approaches.

**Note**: The following code was part of the attempted implementation but is not currently active:

```glsl
// Emulated double: value = high + low (stored as vec2)
vec2 ds_add(vec2 a, vec2 b) {
    float t1 = a.x + b.x;
    float e = t1 - a.x;
    float t2 = ((b.x - e) + (a.x - (t1 - e))) + a.y + b.y;
    vec2 r;
    r.x = t1 + t2;
    r.y = t2 - (r.x - t1);
    return r;
}

vec2 ds_mul(vec2 a, vec2 b) {
    float p = a.x * b.x;
    float e = fma(a.x, b.x, -p);
    e += a.x * b.y + a.y * b.x;
    return vec2(p, e);
}

vec2 ds_sub(vec2 a, vec2 b) {
    return ds_add(a, vec2(-b.x, -b.y));
}

// Renormalize to prevent precision loss
vec2 ds_renorm(vec2 a) {
    float t = a.x + a.y;
    float e = a.y - (t - a.x);
    return vec2(t, e);
}
```

**Precision Renormalization**: Call `ds_renorm()` periodically (every 1000 operations) to prevent precision degradation.

---

## 3. Fractal Algorithms

### 3.1 Mandelbrot Set

**Definition**: Points `c` where `z_{n+1} = z_n^2 + c` remains bounded.

```glsl
// Core iteration (simplified)
vec2 z = vec2(0.0);
vec2 c = pixel_coord;
int iterations = 0;

for (int i = 0; i < MAX_ITER; i++) {
    if (dot(z, z) > 4.0) break;
    z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;
    iterations = i;
}
```

**Optimizations**:
- **Cardioid/Bulb Check**: Skip main cardioid and period-2 bulb
- **Periodicity Check**: Detect cycles to early-exit
- **Smooth Coloring**: Use fractional escape for gradient continuity

```glsl
// Smooth iteration count
float smooth_iter = float(iterations) - log2(log2(dot(z,z))) + 4.0;
```

### 3.2 Julia Sets

**Definition**: Fixed `c`, iterate `z_{n+1} = z_n^2 + c` for each pixel as initial `z`.

```glsl
vec2 z = pixel_coord;  // Pixel IS the initial z
vec2 c = julia_param;  // Fixed parameter

for (int i = 0; i < MAX_ITER; i++) {
    if (dot(z, z) > 4.0) break;
    z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;
    iterations = i;
}
```

**Curated Julia Parameters** (visually interesting):

| Name | c value | Visual Character |
|------|---------|------------------|
| Dendrite | (-0.8, 0.156) | Tree-like branches |
| Spiral | (-0.7269, 0.1889) | Spiral patterns |
| Lightning | (-0.4, 0.6) | Electric tendrils |
| Galaxy | (0.285, 0.01) | Swirling arms |
| Rabbit | (-0.123, 0.745) | Connected blobs |

### 3.3 Burning Ship Fractal

**Definition**: Like Mandelbrot but with absolute values.

```glsl
vec2 z = vec2(0.0);
vec2 c = pixel_coord;

for (int i = 0; i < MAX_ITER; i++) {
    if (dot(z, z) > 4.0) break;
    z = abs(z);  // Key difference
    z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;
    iterations = i;
}
```

**Note**: Flip Y-axis for "ship" orientation.

### Iteration Depth Strategy

The system uses `AnimationOrchestrator` to manage iteration counts with smooth transitions:

| Device Tier | Gesture Iterations | Static Iterations | Notes |
|-------------|-------------------|-------------------|-------|
| Low | 75 | 200 | Budget devices |
| Mid | 100 | 300 | Standard devices |
| High | 120-150 | 400 | Flagship devices |

**Zoom-Adaptive Scaling**: Additional iterations are added based on zoom level:
- Base iterations + (zoomLog × 12) up to maximum of 1500
- Smooth interpolation prevents visible flickering during transitions
- Iterations smoothly transition between gesture and static states over ~4-5 frames

---

## 4. Touch Gesture System Design

### Gesture State Machine

```
                    ┌─────────────────┐
                    │      IDLE       │
                    └────────┬────────┘
                             │ touch start
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────────┐
        │   PAN    │  │  PINCH   │  │ DOUBLE_TAP   │
        │ (1 touch)│  │(2 touch) │  │   PENDING    │
        └────┬─────┘  └────┬─────┘  └──────┬───────┘
             │              │               │
             │              │               │
             │ add finger   │ remove finger │ timeout/tap
             ▼              ▼               ▼
        ┌──────────┐  ┌──────────┐  ┌──────────────┐
        │  PINCH   │  │   PAN    │  │  ZOOM_ANIM   │
        └────┬─────┘  └────┬─────┘  └──────┬───────┘
             │              │               │
             │ release      │ release       │ complete
             ▼              ▼               ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ MOMENTUM │  │ MOMENTUM │  │   IDLE   │
        └────┬─────┘  └────┬─────┘  └──────────┘
             │              │
             │ decay complete
             ▼              ▼
        ┌──────────┐  ┌──────────┐
        │   IDLE   │  │   IDLE   │
        └──────────┘  └──────────┘
```

### Gesture Conflict Resolution

**Rules**:
1. **Pan → Pinch**: When second finger added during pan, transition to pinch immediately
   - Use current pan center as initial pinch center
   - Reset pinch distance calculation
   
2. **Pinch → Pan**: When one finger lifted during pinch, continue as pan
   - Use remaining finger position as pan start
   - Preserve velocity if available
   
3. **Double-tap during gesture**: Ignore if any gesture in progress
   - Only process double-tap from IDLE state
   - 50ms cooldown after gesture ends before accepting double-tap
   
4. **Touch cancel**: Reset to IDLE, cancel any momentum
   - Handle `touchcancel` events (e.g., incoming call)
   - Clear all gesture state

### Gesture Handler Implementation

```javascript
class GestureController {
    constructor(element, callbacks) {
        this.element = element;
        this.callbacks = callbacks;

        // State
        this.touches = new Map();
        this.state = 'idle';
        this.lastPinchDistance = 0;
        this.lastCenter = { x: 0, y: 0 };
        this.velocity = { x: 0, y: 0 };
        this.lastMoveTime = 0;

        // Double-tap detection
        this.lastTapTime = 0;
        this.lastTapPos = { x: 0, y: 0 };

        this.bindEvents();
    }

    bindEvents() {
        const el = this.element;

        // Passive: false needed for preventDefault
        el.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        el.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        el.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
        el.addEventListener('touchcancel', this.onTouchEnd.bind(this), { passive: false });

        // Prevent default gestures
        el.addEventListener('gesturestart', e => e.preventDefault());
        el.addEventListener('gesturechange', e => e.preventDefault());
    }
}
```

### Pan Handler

```javascript
handlePan(currentTouch) {
    const dx = currentTouch.x - this.lastCenter.x;
    const dy = currentTouch.y - this.lastCenter.y;

    // Calculate velocity for momentum
    const now = performance.now();
    const dt = now - this.lastMoveTime;
    if (dt > 0) {
        this.velocity.x = dx / dt * 16; // Normalize to ~60fps frame
        this.velocity.y = dy / dt * 16;
    }
    this.lastMoveTime = now;

    this.callbacks.onPan(dx, dy);
    this.lastCenter = currentTouch;
}
```

### Pinch-to-Zoom Handler

```javascript
handlePinch(touch1, touch2) {
    // Calculate center point
    const center = {
        x: (touch1.x + touch2.x) / 2,
        y: (touch1.y + touch2.y) / 2
    };

    // Calculate distance
    const dx = touch2.x - touch1.x;
    const dy = touch2.y - touch1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (this.lastPinchDistance > 0) {
        const scale = distance / this.lastPinchDistance;

        // Zoom centered on pinch midpoint
        this.callbacks.onZoom(scale, center.x, center.y);
    }

    this.lastPinchDistance = distance;
    this.lastCenter = center;
}
```

### Momentum System

```javascript
startMomentum() {
    const friction = 0.95;
    const minVelocity = 0.5;

    const animate = () => {
        if (Math.abs(this.velocity.x) < minVelocity &&
            Math.abs(this.velocity.y) < minVelocity) {
            this.state = 'idle';
            this.callbacks.onMomentumEnd();
            return;
        }

        this.callbacks.onPan(this.velocity.x, this.velocity.y);

        this.velocity.x *= friction;
        this.velocity.y *= friction;

        this.momentumFrame = requestAnimationFrame(animate);
    };

    this.state = 'momentum';
    animate();
}
```

### Double-Tap Detection

```javascript
checkDoubleTap(touch) {
    const now = performance.now();
    const timeDelta = now - this.lastTapTime;
    const posDelta = Math.hypot(
        touch.x - this.lastTapPos.x,
        touch.y - this.lastTapPos.y
    );

    // 300ms window, 30px tolerance
    if (timeDelta < 300 && posDelta < 30) {
        this.callbacks.onDoubleTap(touch.x, touch.y);
        this.lastTapTime = 0; // Reset
        return true;
    }

    this.lastTapTime = now;
    this.lastTapPos = { x: touch.x, y: touch.y };
    return false;
}
```

---

## 5. Performance Optimization Strategy

### Rendering Pipeline Optimizations

#### 1. Adaptive Quality System

```javascript
class QualityAdapter {
    constructor() {
        this.quality = 1.0;
        this.targetQuality = 1.0;
        this.isGesturing = false;
        this.frameTimeHistory = [];
        this.gestureQuality = 0.75;  // Quality during gestures
        this.staticQuality = 1.0;     // Quality when static
        this.recoveryRate = 0.05;     // Quality recovery rate
    }

    // Called each frame
    update(frameTime) {
        this.frameTimeHistory.push(frameTime);
        if (this.frameTimeHistory.length > 10) {
            this.frameTimeHistory.shift();
        }

        if (!this.isGesturing) {
            // Gradually recover quality
            if (this.quality < this.targetQuality) {
                this.quality = Math.min(this.targetQuality, this.quality + this.recoveryRate);
            }

            // Adaptive quality based on frame time (target 16.67ms for 60fps)
            const avgFrameTime = this.getAverageFrameTime();
            if (avgFrameTime > 25 && this.quality > 0.25) {
                this.quality *= 0.95;  // Reduce if struggling
            } else if (avgFrameTime < 10 && this.quality < this.staticQuality) {
                this.quality *= 1.05;  // Increase if performing well
            }
            this.quality = Math.max(0.25, Math.min(1.0, this.quality));
        }
        return this.quality;
    }

    onGestureStart() {
        this.isGesturing = true;
        this.targetQuality = this.gestureQuality;
        this.quality = this.gestureQuality;
    }

    onGestureEnd() {
        this.isGesturing = false;
        this.targetQuality = this.staticQuality;
    }
}
```

**Note**: The system uses `AnimationOrchestrator` for unified animation management and `QualityAdapter` for adaptive quality. The orchestrator handles iteration smoothing to prevent flickering, while QualityAdapter manages resolution scaling based on frame time.

#### 2. Resolution Scaling

```javascript
// Resolution is dynamically adjusted by QualityAdapter based on performance
// Canvas resolution = clientWidth * devicePixelRatio * qualityFactor
// devicePixelRatio is capped at 2.0 for performance
// QualityAdapter adjusts qualityFactor (0.25 to 1.0) based on frame time
// Note: Current implementation uses fixed resolution during gestures to prevent flicker
// Only iterations change during gestures, not resolution
```

#### 3. Animation Orchestrator

The `AnimationOrchestrator` provides a unified animation loop that:
- Handles all animations (zoom tweens, momentum, iteration transitions) in a single RAF loop
- Smoothly interpolates iteration counts between gesture and static states
- Buffers gesture inputs for atomic application per frame
- Prevents frame desynchronization by coordinating all updates

### Memory Management

#### Texture and Buffer Reuse

```javascript
class ResourcePool {
    constructor(gl) {
        this.gl = gl;
        this.textures = [];
        this.framebuffers = [];
    }

    getTexture(width, height) {
        // Reuse existing texture of same size
        const existing = this.textures.find(t =>
            t.width === width && t.height === height && !t.inUse
        );

        if (existing) {
            existing.inUse = true;
            return existing;
        }

        // Create new
        const tex = this.createTexture(width, height);
        tex.inUse = true;
        this.textures.push(tex);
        return tex;
    }

    releaseTexture(tex) {
        tex.inUse = false;
    }
}
```

### Battery Optimization

1. **Render on Demand**: Only render when view changes
2. **Idle Detection**: Reduce quality/stop refinement when idle
3. **Throttle During Low Battery**: Detect via Battery API (where available)

```javascript
class BatteryAwareRenderer {
    async init() {
        if ('getBattery' in navigator) {
            this.battery = await navigator.getBattery();
            this.battery.addEventListener('levelchange', () => this.adjustForBattery());
            this.adjustForBattery();
        }
    }

    adjustForBattery() {
        if (this.battery && this.battery.level < 0.2 && !this.battery.charging) {
            this.maxIterations *= 0.5;
            this.targetFPS = 30;
        }
    }
}
```

### Frame Budget Breakdown (16.67ms target)

| Phase | Budget | Description |
|-------|--------|-------------|
| Gesture Processing | 1ms | Touch event handling |
| State Update | 0.5ms | View matrix calculation |
| GL State Setup | 1ms | Uniform updates |
| GPU Render | 12ms | Fragment shader execution |
| Composite | 2ms | Browser compositing |
| **Buffer** | 0.17ms | Margin for variance |

---

## 6. File Structure

```
flyfract/
├── index.html              # Entry point, minimal HTML shell
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker for offline
│
├── css/
│   └── styles.css          # All styles (< 5KB)
│
├── js/
│   ├── app.js              # Main entry, orchestration
│   │
│   ├── core/
│   │   ├── state.js        # View state management
│   │   ├── events.js       # Custom event system
│   │   └── storage.js      # LocalStorage persistence
│   │
│   ├── gestures/
│   │   ├── controller.js   # Unified gesture handler (touch + mouse)
│   │   └── buffer.js       # Gesture input buffering
│   │
│   ├── render/
│   │   ├── webgl.js        # WebGL context management
│   │   ├── shaders.js      # Shader compilation/linking
│   │   ├── pipeline.js     # Render orchestration
│   │   ├── quality.js      # Adaptive quality (QualityAdapter)
│   │   └── colors.js       # Color map management
│   │
│   ├── fractals/
│   │   └── index.js        # FractalManager (all 10 fractals)
│   │
│   ├── core/
│   │   ├── state.js        # ViewState (emulated double precision)
│   │   ├── orchestrator.js # AnimationOrchestrator (unified loop)
│   │   ├── device.js       # Device detection and tier classification
│   │   ├── animator.js     # Animation tweening
│   │   ├── storage.js      # State persistence
│   │   ├── loading.js      # Loading screen
│   │   ├── errors.js       # Error handling
│   │   └── security.js     # Input validation
│   │
│   └── ui/
│       └── controls.js     # UIControls (fractal selector, color selector, photo, info)
│
├── shaders/
│   ├── vertex.glsl         # Simple fullscreen quad (shared by all fractals)
│   ├── mandelbrot.glsl     # Mandelbrot fragment shader
│   ├── julia.glsl          # Julia fragment shader
│   ├── burningship.glsl    # Burning Ship fragment shader
│   ├── tricorn.glsl        # Tricorn fragment shader
│   ├── newton.glsl         # Newton fragment shader
│   ├── phoenix.glsl        # Phoenix fragment shader
│   ├── lyapunov.glsl       # Lyapunov fragment shader
│   ├── multibrot.glsl      # Multibrot fragment shader
│   ├── magnet.glsl         # Magnet Type 1 fragment shader
│   └── celtic.glsl         # Celtic fragment shader
│   ├── magnet.glsl         # Magnet Type 1 fragment shader
│   └── celtic.glsl         # Celtic fragment shader
│
│   Note: Deep zoom (double-precision) was attempted but not successfully implemented.
│   See docs/deep-zoom-spec.md for details.
│
└── assets/
    ├── icons/              # PWA icons
    └── colormaps/          # Color gradient textures (optional)
```

### Module Loading Strategy

**Shader Loading**: Use `fetch()` to load GLSL files as text:

```javascript
async function loadShader(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load shader: ${url}`);
    return response.text();
}

// Usage
const vertexSource = await loadShader('shaders/vertex.glsl');
const fragmentSource = await loadShader('shaders/mandelbrot.glsl');
```

**JavaScript Module Loading**: Use native ES modules with no bundler:

```html
<script type="module" src="js/app.js"></script>
```

```javascript
// app.js
import { GestureController } from './gestures/controller.js';
import { WebGLRenderer } from './render/webgl.js';
import { ViewState } from './core/state.js';
// ...
```

**Fullscreen Quad Setup**:

```javascript
// Create vertex buffer for fullscreen quad
function createFullscreenQuad(gl) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    // Quad vertices: (-1, -1) to (1, 1)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,  1, -1,  -1, 1,  1, 1
    ]), gl.STATIC_DRAW);
    return buffer;
}
```

For production, optionally concatenate/minify with esbuild:
```bash
esbuild js/app.js --bundle --minify --outfile=dist/app.min.js
```

---

## 7. Rendering Pipeline

### Pipeline Stages

```
┌────────────────────────────────────────────────────────────────┐
│                      RENDERING PIPELINE                        │
└────────────────────────────────────────────────────────────────┘

1. INPUT STAGE
   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │   Gesture   │────▶│    View     │────▶│   Quality   │
   │    Event    │     │   State     │     │   Adapter   │
   └─────────────┘     └─────────────┘     └─────────────┘
                              │
                              ▼
2. PREPARATION STAGE
   ┌─────────────────────────────────────────────────────────┐
   │                  Uniform Calculation                    │
   │  • center (emulated double)                             │
   │  • zoom scale                                           │
   │  • iteration count                                      │
   │  • color offset                                         │
   │  • aspect ratio                                         │
   └─────────────────────────────────────────────────────────┘
                              │
                              ▼
3. SHADER EXECUTION (GPU)
   ┌─────────────────────────────────────────────────────────┐
   │              Fragment Shader (per pixel)                │
   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
   │  │ Coord       │  │  Fractal    │  │   Color     │      │
   │  │ Transform   │──│  Iteration  │──│   Mapping   │      │
   │  └─────────────┘  └─────────────┘  └─────────────┘      │
   └─────────────────────────────────────────────────────────┘
                              │
                              ▼
4. OUTPUT STAGE
   ┌─────────────────────────────────────────────────────────┐
   │                  Framebuffer / Screen                   │
   └─────────────────────────────────────────────────────────┘
                              │
                              ▼
5. POST-RENDER
   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │  Schedule   │     │   Update    │     │  Animation   │
   │ Next Frame  │     │     UI      │     │ Orchestrator │
   │ (via RAF)   │     │   State     │     │   Tick       │
   └─────────────┘     └─────────────┘     └─────────────┘
```

### View State Structure

```javascript
class ViewState {
    constructor() {
        // High precision center (for deep zoom)
        this.centerX = { hi: -0.5, lo: 0.0 };  // Emulated double
        this.centerY = { hi: 0.0, lo: 0.0 };

        // Zoom as log scale for smooth interpolation
        this.zoomLog = 0;  // zoom = 2^zoomLog

        // Derived
        this.zoom = 1.0;
        this.aspectRatio = 1.0;
    }

    get zoomLevel() {
        return Math.pow(2, this.zoomLog);
    }

    pan(dx, dy) {
        // Convert screen delta to fractal space
        const scale = 2.0 / (this.zoom * Math.min(window.innerWidth, window.innerHeight));
        this.centerX.hi += dx * scale;
        this.centerY.hi -= dy * scale;  // Y inverted
        // Renormalize emulated double periodically
    }

    zoomAt(factor, screenX, screenY) {
        // Zoom centered on screen point
        const oldZoom = this.zoom;
        this.zoomLog += Math.log2(factor);
        this.zoom = Math.pow(2, this.zoomLog);

        // Adjust center to keep point under finger stationary
        const scale = 2.0 / (oldZoom * Math.min(window.innerWidth, window.innerHeight));
        const fx = (screenX - window.innerWidth / 2) * scale;
        const fy = -(screenY - window.innerHeight / 2) * scale;

        this.centerX.hi += fx * (1 - 1/factor);
        this.centerY.hi += fy * (1 - 1/factor);
    }
}
```

### Shader Uniforms

```glsl
// Vertex shader uniforms
uniform vec2 u_resolution;

// Fragment shader uniforms
uniform vec4 u_center;      // (centerX.hi, centerX.lo, centerY.hi, centerY.lo)
uniform float u_zoom;
uniform int u_maxIter;
uniform float u_colorOffset;
uniform sampler2D u_colorMap;  // Optional: 1D color gradient texture
uniform vec2 u_juliaC;         // Julia set parameter (if applicable)
```

### Render Loop

```javascript
class RenderPipeline {
    constructor(gl, state) {
        this.gl = gl;
        this.state = state;
        this.needsRender = true;
        this.isGesturing = false;
    }

    requestRender() {
        this.needsRender = true;
    }

    tick(timestamp) {
        if (this.needsRender) {
            const quality = this.qualityAdapter.getQuality(this.isGesturing);
            this.render(quality);
            this.needsRender = this.isGesturing;  // Continue if gesturing
        }

        requestAnimationFrame(this.tick.bind(this));
    }

    render(quality) {
        const gl = this.gl;
        const canvas = gl.canvas;

        // Resize if needed
        const width = Math.floor(canvas.clientWidth * quality * devicePixelRatio);
        const height = Math.floor(canvas.clientHeight * quality * devicePixelRatio);

        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
            gl.viewport(0, 0, width, height);
        }

        // Update uniforms
        this.updateUniforms();

        // Draw fullscreen quad
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
}
```

---

## 8. Mobile-First Considerations

### Viewport & Layout

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0,
      maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
```

```css
/* Full viewport canvas */
html, body {
    margin: 0;
    padding: 0;
    overflow: hidden;
    touch-action: none;  /* Disable browser gestures */
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
}

canvas {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}

/* Safe area handling (notch) */
.ui-controls {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
}
```

### Touch Event Handling

```javascript
// Prevent all default touch behaviors
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

// Handle iOS Safari bounce
document.body.addEventListener('touchmove', e => {
    if (e.target === document.body) {
        e.preventDefault();
    }
}, { passive: false });

// Prevent double-tap zoom
let lastTouchEnd = 0;
document.addEventListener('touchend', e => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, { passive: false });
```

### iOS Safari Specific

```javascript
// Detect iOS Safari
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

if (isIOS) {
    // iOS has issues with high-DPR WebGL
    // Limit to 2x even on 3x devices
    devicePixelRatio = Math.min(window.devicePixelRatio, 2);

    // Handle orientation change
    window.addEventListener('orientationchange', () => {
        // Wait for resize to complete
        setTimeout(() => {
            renderer.resize();
        }, 100);
    });
}
```

### Android Chrome Specific

```javascript
// Handle back button
window.addEventListener('popstate', e => {
    // Prevent navigation, maybe reset view instead
    e.preventDefault();
    history.pushState(null, '', location.href);
    viewState.reset();
});

// Push initial state
history.pushState(null, '', location.href);
```

### Device-Based Performance Optimization

The system uses device detection to determine appropriate iteration counts:

```javascript
export function getDeviceTier() {
    const memory = navigator.deviceMemory || 4;
    if (memory >= 6) return 'high';
    if (memory >= 4) return 'mid';
    return 'low';
}

export function getIterationTargets() {
    const tier = getDeviceTier();
    switch (tier) {
        case 'high':
            return { gesture: 150, static: 400 };
        case 'mid':
            return { gesture: 100, static: 300 };
        case 'low':
        default:
            return { gesture: 75, static: 200 };
    }
}
```

**Note**: Performance tier detection is simplified and uses device memory as the primary indicator. The system does not use complex performance monitoring or tier-based resolution scaling as originally planned.

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = debugInfo ?
        gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : '';

    // Check for known high-performance GPUs
    const highPerf = ['apple gpu', 'adreno 6', 'mali-g7'];
    const lowPerf = ['adreno 3', 'mali-4', 'powervr'];

    const rendererLower = renderer.toLowerCase();

    if (highPerf.some(g => rendererLower.includes(g))) return 'high';
    if (lowPerf.some(g => rendererLower.includes(g))) return 'low';

    // Estimate based on device memory (Chrome only)
    if (navigator.deviceMemory) {
        if (navigator.deviceMemory >= 4) return 'high';
        if (navigator.deviceMemory <= 2) return 'low';
    }

    return 'medium';
}
```

### Default Settings by Tier (Actual Implementation)

| Setting | Low | Mid | High |
|---------|-----|-----|------|
| Gesture Iterations | 75 | 100 | 120-150 |
| Static Iterations | 200 | 300 | 400 |
| Quality Adaptation | Dynamic via QualityAdapter | Dynamic via QualityAdapter | Dynamic via QualityAdapter |

**Note**: The system uses simplified device tier detection (based on memory) and adaptive quality management via QualityAdapter. Progressive refinement and tier-based resolution scaling were removed in favor of a simpler, more maintainable approach.

### PWA Configuration

```json
// manifest.json
{
    "name": "FlyFract",
    "short_name": "FlyFract",
    "description": "Explore infinite fractal beauty",
    "start_url": "/",
    "display": "fullscreen",
    "orientation": "any",
    "background_color": "#000000",
    "theme_color": "#000000",
    "icons": [
        { "src": "/assets/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
        { "src": "/assets/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
    ]
}
```

```javascript
// Service Worker (sw.js) - Basic caching
const CACHE_NAME = 'flyfract-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/app.js',
    // ... all JS modules
];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});

self.addEventListener('fetch', e => {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
```

---

## 9. Loading & Initialization Strategy

### Loading Sequence

```
1. HTML Loads
   ↓
2. Check WebGL Support
   ↓ (if supported)
3. Show Loading Screen (CSS animation)
   ↓
4. Load Shaders (fetch .glsl files)
   ↓
5. Compile Shaders (with progress if >500ms)
   ↓
6. Initialize WebGL Context
   ↓
7. Load Saved State (LocalStorage)
   ↓
8. Render Default View
   ↓
9. Hide Loading Screen
```

### Loading Screen Implementation

```javascript
class LoadingScreen {
    constructor() {
        this.element = document.getElementById('loading-screen');
        this.progressBar = document.getElementById('loading-progress');
        this.startTime = performance.now();
    }

    show() {
        this.element.style.display = 'flex';
        // CSS animation: pulsing fractal preview or gradient
    }

    updateProgress(percent) {
        if (this.progressBar) {
            this.progressBar.style.width = `${percent}%`;
        }
    }

    hide() {
        // Fade out animation
        this.element.style.opacity = '0';
        setTimeout(() => {
            this.element.style.display = 'none';
        }, 300);
    }

    showError(message) {
        this.element.innerHTML = `
            <div class="error-message">
                <h2>Unable to Load</h2>
                <p>${message}</p>
                <button onclick="location.reload()">Retry</button>
            </div>
        `;
    }
}
```

### Shader Loading with Progress

```javascript
async function loadShadersWithProgress(callback) {
    const shaders = [
        'shaders/vertex.glsl',
        'shaders/common.glsl',
        'shaders/mandelbrot.glsl'
    ];
    
    const total = shaders.length;
    let loaded = 0;
    
    const sources = await Promise.all(
        shaders.map(async (url) => {
            const source = await fetch(url).then(r => r.text());
            loaded++;
            callback(loaded / total * 100);
            return source;
        })
    );
    
    return {
        vertex: sources[0],
        common: sources[1],
        fragment: sources[2]
    };
}
```

### Default View Selection

Use coordinates from Appendix B based on fractal type:
- **Mandelbrot**: Seahorse Valley (-0.743643887, 0.131825904) at zoom 1.0
- **Julia**: Spiral parameter (-0.7269, 0.1889) at center (0, 0)
- **Burning Ship**: (-1.75, -0.02) at zoom 1.0

---

## 10. Error Handling & Recovery

### WebGL Capability Detection

```javascript
function checkWebGLSupport() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) {
        return {
            supported: false,
            message: 'WebGL is not supported on your device. Please try a different browser.'
        };
    }
    
    // Check for required extensions
    const requiredExtensions = ['OES_texture_float'];
    const missing = requiredExtensions.filter(ext => !gl.getExtension(ext));
    
    if (missing.length > 0) {
        return {
            supported: false,
            message: `Required WebGL features not available: ${missing.join(', ')}`
        };
    }
    
    return { supported: true };
}
```

### Context Loss Handling

```javascript
class WebGLContextManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = null;
        this.recoveryAttempts = 0;
        this.maxRecoveryAttempts = 3;
        
        this.setupContextLossHandling();
    }
    
    setupContextLossHandling() {
        this.canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            console.warn('WebGL context lost');
            this.handleContextLoss();
        });
        
        this.canvas.addEventListener('webglcontextrestored', () => {
            console.log('WebGL context restored');
            this.handleContextRestored();
        });
    }
    
    handleContextLoss() {
        // Stop rendering
        this.gl = null;
        
        // Show user message
        this.showContextLossMessage();
        
        // Attempt recovery after delay
        setTimeout(() => {
            this.attemptRecovery();
        }, 1000);
    }
    
    attemptRecovery() {
        if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
            this.showPermanentError();
            return;
        }
        
        this.recoveryAttempts++;
        const gl = this.canvas.getContext('webgl');
        
        if (gl) {
            this.gl = gl;
            this.recoveryAttempts = 0;
            // Reinitialize shaders and state
            this.onContextRestored();
        } else {
            // Retry after delay
            setTimeout(() => this.attemptRecovery(), 2000);
        }
    }
    
    showContextLossMessage() {
        // Show non-blocking message: "Rendering paused. Tap to retry."
    }
}
```

### Shader Compilation Error Handling

```javascript
function compileShader(gl, source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const error = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        
        // Log detailed error for debugging
        console.error(`Shader compilation error (${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'}):`, error);
        console.error('Shader source:', source);
        
        throw new Error(`Shader compilation failed: ${error}`);
    }
    
    return shader;
}
```

### Error Recovery Strategies

1. **Context Loss**: Automatic retry (up to 3 attempts), then show retry button
2. **Shader Compilation Failure**: Show error message, suggest refresh
3. **Network Errors**: Use cached assets via service worker
4. **Memory Issues**: Reduce quality/iterations automatically

---

## 11. Color Schemes

### Predefined Palettes

```javascript
const COLOR_SCHEMES = {
    cosmic: {
        name: 'Cosmic',
        // HSL interpolation points
        stops: [
            { pos: 0.0, h: 240, s: 100, l: 10 },   // Deep blue
            { pos: 0.25, h: 280, s: 100, l: 40 },  // Purple
            { pos: 0.5, h: 320, s: 100, l: 60 },   // Magenta
            { pos: 0.75, h: 40, s: 100, l: 70 },   // Gold
            { pos: 1.0, h: 60, s: 100, l: 95 },    // White-yellow
        ]
    },
    inferno: {
        name: 'Inferno',
        stops: [
            { pos: 0.0, h: 0, s: 0, l: 0 },
            { pos: 0.25, h: 300, s: 100, l: 20 },
            { pos: 0.5, h: 20, s: 100, l: 50 },
            { pos: 0.75, h: 50, s: 100, l: 70 },
            { pos: 1.0, h: 60, s: 100, l: 100 },
        ]
    },
    ocean: {
        name: 'Ocean',
        stops: [
            { pos: 0.0, h: 220, s: 100, l: 5 },
            { pos: 0.33, h: 200, s: 100, l: 30 },
            { pos: 0.66, h: 180, s: 80, l: 60 },
            { pos: 1.0, h: 170, s: 60, l: 90 },
        ]
    },
    monochrome: {
        name: 'Monochrome',
        stops: [
            { pos: 0.0, h: 0, s: 0, l: 0 },
            { pos: 1.0, h: 0, s: 0, l: 100 },
        ]
    },
    electric: {
        name: 'Electric',
        stops: [
            { pos: 0.0, h: 260, s: 100, l: 5 },
            { pos: 0.25, h: 280, s: 100, l: 50 },
            { pos: 0.5, h: 180, s: 100, l: 50 },
            { pos: 0.75, h: 120, s: 100, l: 50 },
            { pos: 1.0, h: 60, s: 100, l: 95 },
        ]
    }
};
```

### GLSL Color Function Generation

**Color Scheme to GLSL Conversion**:

JavaScript color schemes (HSL stops) are converted to GLSL functions at runtime:

```javascript
function generateColorFunction(scheme) {
    // Convert HSL stops to GLSL interpolation
    const stops = scheme.stops;
    let glsl = 'vec3 getColor(float t, float offset) {\n';
    glsl += '    t = fract(t + offset);\n';
    glsl += '    // HSL interpolation between stops\n';
    
    // Generate interpolation code for each stop pair
    for (let i = 0; i < stops.length - 1; i++) {
        const s1 = stops[i];
        const s2 = stops[i + 1];
        glsl += `    if (t >= ${s1.pos} && t < ${s2.pos}) {\n`;
        glsl += `        float localT = (t - ${s1.pos}) / (${s2.pos} - ${s1.pos});\n`;
        glsl += `        // Interpolate HSL: (${s1.h}, ${s1.s}, ${s1.l}) to (${s2.h}, ${s2.s}, ${s2.l})\n`;
        glsl += `        // ... HSL interpolation code ...\n`;
        glsl += '    }\n';
    }
    
    glsl += '    return vec3(0.0); // fallback\n';
    glsl += '}\n';
    return glsl;
}
```

**Simplified Procedural Version** (for Phase 1):

```glsl
vec3 getColor(float t, float offset) {
    t = fract(t + offset);  // Apply offset and wrap

    // Procedural color using cosine interpolation
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.00, 0.33, 0.67);

    return a + b * cos(6.28318 * (c * t + d));
}
```

**Note**: Full HSL interpolation from schemes will be implemented in Phase 2. Phase 1 uses simplified procedural colors.

---

## 12. Implementation Phases

### Phase 1: Core MVP
- [ ] WebGL setup with fullscreen quad
- [ ] Mandelbrot shader with smooth coloring
- [ ] Pan gesture handling
- [ ] Pinch-to-zoom gesture handling
- [ ] Basic adaptive quality (gesture vs static)
- [ ] Mobile viewport setup

### Phase 2: Polish
- [ ] Julia sets + parameter presets
- [ ] Burning Ship fractal
- [ ] Fractal selector UI
- [ ] Color scheme switching
- [ ] Zoom level indicator
- [ ] Momentum scrolling
- [ ] Double-tap to zoom

### Phase 3: Production
- [x] Animation Orchestrator (unified animation loop)
- [x] Performance tier detection (simplified, based on device memory)
- [x] PWA setup (manifest.json configured, service worker not yet implemented)
- [ ] Screenshot capture (not implemented)
- [ ] Share functionality (not implemented)
- [x] iOS/Android edge cases (basic handling)
- [x] Performance testing on target devices (basic validation)

---

## 13. Testing Strategy

### Device Testing Matrix

| Device | OS | Priority | Notes |
|--------|-----|----------|-------|
| iPhone 12/13/14 | iOS 15+ | High | Primary target |
| iPhone SE 2 | iOS 15+ | High | Lower-end iOS |
| Pixel 5/6 | Android 12+ | High | Reference Android |
| Samsung Galaxy S21 | Android 11+ | High | Popular flagship |
| Samsung Galaxy A52 | Android 11+ | Medium | Mid-range Android |
| iPad Air | iPadOS 15+ | Medium | Tablet |

### Performance Benchmarks

**Performance Targets**:
- Smooth 60fps during gestures (maintained via adaptive quality)
- Frame time: Target <16.67ms for 60fps
- QualityAdapter adjusts resolution dynamically to maintain performance

**Note**: The system uses `AnimationOrchestrator` for unified animation management and `QualityAdapter` for adaptive quality. The orchestrator handles iteration smoothing and gesture buffering, while QualityAdapter manages resolution scaling. No separate PerformanceMonitor class exists.

---

## 14. State Persistence

### LocalStorage Strategy

```javascript
class StateStorage {
    constructor() {
        this.storageKey = 'flyfract-state';
        this.version = 1; // Increment on schema changes
    }
    
    save(state) {
        const data = {
            version: this.version,
            fractalType: state.fractalType,
            colorScheme: state.colorScheme,
            // Optional: last view (can be large, so make optional)
            lastView: state.saveLastView ? {
                centerX: state.centerX,
                centerY: state.centerY,
                zoom: state.zoom
            } : null,
            timestamp: Date.now()
        };
        
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to save state:', e);
            // Graceful degradation: continue without saving
        }
    }
    
    load() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (!data) return null;
            
            const parsed = JSON.parse(data);
            
            // Version check: migrate or ignore if version mismatch
            if (parsed.version !== this.version) {
                console.warn('State version mismatch, ignoring saved state');
                return null;
            }
            
            return parsed;
        } catch (e) {
            console.warn('Failed to load state:', e);
            return null;
        }
    }
    
    clear() {
        localStorage.removeItem(this.storageKey);
    }
}
```

### Persisted Data

- **Fractal Type**: Current fractal (mandelbrot, julia, burningship, tricorn, newton, phoenix, lyapunov, multibrot, magnet, celtic)
- **Color Scheme**: Selected color scheme name
- **Last View** (optional): User preference to restore last position
  - Only saved if user explicitly enables (privacy consideration)
  - Cleared if zoom level changes significantly

### State Restoration

```javascript
async function initializeApp() {
    const storage = new StateStorage();
    const savedState = storage.load();
    
    const initialState = savedState ? {
        fractalType: savedState.fractalType || 'mandelbrot',
        colorScheme: savedState.colorScheme || 'cosmic',
        // Use saved view if available and valid
        view: savedState.lastView || getDefaultView('mandelbrot')
    } : {
        fractalType: 'mandelbrot',
        colorScheme: 'cosmic',
        view: getDefaultView('mandelbrot')
    };
    
    // Initialize app with state
    return initialState;
}
```

---

## Appendix A: Shader Code Reference

### Vertex Shader (vertex.glsl)

```glsl
#version 100
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
}
```

### Mandelbrot Fragment Shader (mandelbrot.glsl)

```glsl
#version 100
precision highp float;

varying vec2 v_uv;

uniform vec2 u_resolution;
uniform vec4 u_center;     // hi.x, lo.x, hi.y, lo.y
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

vec3 palette(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.00, 0.33, 0.67);
    return a + b * cos(6.28318 * (c * t + d));
}

void main() {
    vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);

    // Map to fractal space
    float scale = 2.0 / u_zoom;
    vec2 c = vec2(u_center.x, u_center.z) + uv * scale;

    // Cardioid/bulb check for early exit
    float q = (c.x - 0.25) * (c.x - 0.25) + c.y * c.y;
    if (q * (q + (c.x - 0.25)) < 0.25 * c.y * c.y) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    vec2 z = vec2(0.0);
    int iter = 0;

    for (int i = 0; i < 1000; i++) {
        if (i >= u_maxIter) break;
        if (dot(z, z) > 4.0) break;

        z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
        iter = i;
    }

    if (iter == u_maxIter - 1) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else {
        // Smooth coloring
        float smoothIter = float(iter) - log2(log2(dot(z, z))) + 4.0;
        float t = fract(smoothIter * 0.02 + u_colorOffset);
        gl_FragColor = vec4(palette(t), 1.0);
    }
}
```

---

## Appendix B: Interesting Coordinates

### Default View Coordinates (First Load)

**Mandelbrot Set** (Default):
- **Center**: (-0.743643887, 0.131825904) - Seahorse Valley
- **Zoom**: 1.0 (full view) or 100x for more detail
- **Why**: Visually interesting, shows spiral patterns immediately

**Julia Set** (Default):
- **Parameter**: (-0.7269, 0.1889) - Spiral
- **Center**: (0.0, 0.0)
- **Zoom**: 1.0
- **Why**: Most visually striking preset, immediately engaging

**Burning Ship** (Default):
- **Center**: (-1.75, -0.02)
- **Zoom**: 1.0
- **Why**: Shows characteristic "ship" shape clearly

### Mandelbrot Deep Zoom Locations

| Name | Center X | Center Y | Zoom | Notes |
|------|----------|----------|------|-------|
| Seahorse Valley | -0.743643887 | 0.131825904 | 1e6 | Spiral patterns |
| Elephant Valley | 0.281717921 | 0.5771052841 | 1e8 | Trunk-like shapes |
| Double Spiral | -0.745428 | 0.113009 | 1e5 | Twin spirals |
| Mini Mandelbrot | -1.768778833 | -0.001738996 | 1e10 | Self-similarity |

### Julia Set Showcase

| Name | c Real | c Imag | Notes |
|------|--------|--------|-------|
| Dendrite | -0.8 | 0.156 | Tree-like branches (most striking) |
| Spiral | -0.7269 | 0.1889 | Spiral patterns (default) |
| Lightning | -0.4 | 0.6 | Electric tendrils |
| Galaxy | 0.285 | 0.01 | Swirling arms |
| Douady Rabbit | -0.123 | 0.745 | Three-lobed |
| San Marco | -0.75 | 0.0 | Basilica-like |
| Siegel Disk | -0.390541 | -0.586788 | Quasi-crystal |
