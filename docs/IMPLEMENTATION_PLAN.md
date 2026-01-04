# FlyFract - Implementation Plan

## Overview

This document breaks down the FlyFract implementation into three phases, with specific, actionable tasks for each phase. The plan is designed to deliver a working MVP quickly, then enhance and polish the experience.

**Total Estimated Time**: 8-12 hours (realistic estimate with buffer)

---

## Phase 1: MVP - Basic Fractal Explorer (3-4 hours)

**Goal**: Get a single fractal type rendering smoothly with basic touch navigation working.

### 1.1 Project Setup (15 minutes)

- [x] Create project directory structure:
  ```
  flyfract/
  ├── index.html
  ├── manifest.json
  ├── css/
  │   └── styles.css
  ├── js/
  │   ├── app.js
  │   ├── core/
  │   ├── gestures/
  │   ├── render/
  │   └── fractals/
  └── shaders/
  ```
- [ ] Create `index.html` with:
  - Mobile viewport meta tag
  - Fullscreen canvas element
  - Module script tag for `app.js`
  - Basic PWA manifest link
- [ ] Create `manifest.json` with basic PWA configuration
- [ ] Create `css/styles.css` with:
  - Full viewport reset
  - Canvas fullscreen positioning
  - Touch-action: none
  - Safe area insets for notch

### 1.2 WebGL Foundation (30 minutes)

- [ ] Create `js/render/webgl.js`:
  - WebGL context initialization with error handling
  - Canvas resize handler
  - Device pixel ratio detection (cap at 2x for iOS)
  - Context loss handling
- [ ] Create `js/render/shaders.js`:
  - Shader compilation function
  - Shader linking function
  - Error logging for shader compilation
- [ ] Create `shaders/vertex.glsl`:
  - Simple fullscreen quad vertex shader
  - Pass UV coordinates to fragment shader
- [ ] Create `shaders/common.glsl`:
  - Complete emulated double-precision functions:
    - `ds_add()` - addition
    - `ds_mul()` - multiplication
    - `ds_sub()` - subtraction
    - `ds_renorm()` - renormalization
  - Basic color palette function (procedural, Phase 1)
- [ ] Test: Canvas renders with solid color

### 1.3 Mandelbrot Shader (45 minutes)

- [ ] Create `shaders/mandelbrot.glsl`:
  - Implement core Mandelbrot iteration loop
  - Add escape radius check (dot(z,z) > 4.0)
  - Implement smooth coloring using log2(log2(dot(z,z)))
  - Add cardioid/bulb early exit optimization
  - Use emulated double precision for center coordinates
- [ ] Create `js/fractals/mandelbrot.js`:
  - Mandelbrot-specific configuration
  - Default view parameters (center: -0.743643887, 0.131825904, zoom: 1.0) - Seahorse Valley
  - Max iteration calculation based on zoom level
- [ ] Create `js/render/pipeline.js`:
  - Render loop using requestAnimationFrame
  - Uniform update function (center, zoom, maxIter, resolution)
  - Fullscreen quad drawing
- [ ] Test: Mandelbrot set renders correctly at default view

### 1.4 View State Management (20 minutes)

- [ ] Create `js/core/state.js`:
  - ViewState class with center (emulated double) and zoom (log scale)
  - Use emulated doubles for ALL center calculations (not just hi component)
  - `pan(dx, dy)` method to convert screen deltas to fractal space
  - `zoomAt(factor, screenX, screenY)` method for zoom centered on point
  - `getUniforms()` method to prepare shader uniforms
  - Periodic renormalization to prevent precision loss
- [ ] Integrate ViewState with render pipeline
- [ ] Test: View state updates correctly, precision maintained at deep zoom

### 1.5 Basic Touch Gestures (40 minutes)

- [ ] Create `js/gestures/controller.js`:
  - GestureController class
  - Touch event binding (touchstart, touchmove, touchend, touchcancel)
  - Prevent default browser gestures
  - Touch state tracking (Map of touch IDs)
  - Gesture conflict resolution:
    - Pan → Pinch transition (when second finger added)
    - Pinch → Pan transition (when one finger lifted)
    - Double-tap cooldown (50ms after gesture ends)
    - Touch cancel handling
- [ ] Create `js/gestures/pan.js`:
  - Single-touch pan detection
  - Calculate screen delta (dx, dy)
  - Call ViewState.pan() with converted coordinates
- [ ] Create `js/gestures/pinch.js`:
  - Two-touch pinch detection
  - Calculate pinch center point
  - Calculate scale factor from distance change
  - Call ViewState.zoomAt() with scale and center
- [ ] Integrate gestures with ViewState and render pipeline
- [ ] Test: Pan and pinch gestures work smoothly

### 1.6 Adaptive Quality (20 minutes)

- [ ] Create `js/render/quality.js`:
  - QualityAdapter class
  - Track gesture state (isGesturing flag)
  - Reduce quality to 0.5 during gestures
  - Gradually recover quality after gesture ends
  - Frame time monitoring (optional for Phase 1)
- [ ] Integrate quality adapter with render pipeline:
  - Scale canvas resolution by quality factor
  - Reduce max iterations during gestures
- [ ] Test: Smooth 60fps during gestures, quality recovers after

### 1.8 Loading Experience (15 minutes)

- [ ] Create loading screen HTML/CSS:
  - Elegant loading animation (pulsing fractal preview or CSS gradient)
  - Progress bar for shader loading
  - Error message container
- [ ] Create `js/core/loading.js`:
  - LoadingScreen class
  - Show/hide with fade animations
  - Progress update during shader loading
  - Error message display
- [ ] Integrate with app initialization:
  - Show loading screen on start
  - Update progress during shader fetch/compile
  - Hide when first frame renders
- [ ] Test: Loading experience is smooth and informative

### 1.9 Error Handling (20 minutes)

- [ ] Create `js/core/errors.js`:
  - WebGL capability detection
  - Context loss detection and recovery
  - Shader compilation error handling
  - User-friendly error messages
- [ ] Add error handling to WebGL initialization:
  - Check WebGL support before attempting context creation
  - Show error message if unsupported
  - Handle context loss events
- [ ] Add error handling to shader compilation:
  - Catch and log shader errors
  - Show user-friendly message
- [ ] Test: Error states handled gracefully

### 1.10 State Persistence (15 minutes)

- [ ] Create `js/core/storage.js`:
  - StateStorage class using LocalStorage
  - Save/load state (fractal type, color scheme)
  - Version checking for state migration
  - Error handling (graceful degradation if storage fails)
- [ ] Integrate with app:
  - Load saved state on startup
  - Save state on fractal/color changes
  - Optional: Save last view (user preference)
- [ ] Test: State persists across page reloads

### 1.11 App Orchestration (15 minutes)

- [ ] Create `js/app.js`:
  - Check WebGL support (show error if unavailable)
  - Show loading screen
  - Load shaders with progress updates
  - Initialize WebGL context (with error handling)
  - Load saved state (or use defaults)
  - Initialize ViewState with default/saved view
  - Initialize GestureController
  - Initialize RenderPipeline
  - Wire up gesture callbacks to ViewState updates
  - Start render loop
  - Hide loading screen when ready
- [ ] Test: Full app works end-to-end with all error cases

**Phase 1 Deliverable**: Working Mandelbrot explorer with smooth pan/zoom, loading experience, error handling, and state persistence.

---

## Phase 2: Enhancement - Multiple Fractals & Polish (3-4 hours)

**Goal**: Add multiple fractal types, color schemes, and smooth animations.

### 2.1 Multiple Fractal Types (60 minutes)

- [x] Create `shaders/julia.glsl`:
  - Julia set iteration (z starts at pixel, c is uniform parameter)
  - Same optimizations as Mandelbrot
  - Support for u_juliaC uniform parameter
- [x] Julia set configuration:
  - Curated parameter presets in FractalManager (Dendrite, Spiral, Lightning, Galaxy, Rabbit, San Marco, Siegel Disk)
  - Default parameter: Spiral (-0.7269, 0.1889) - most visually striking
  - Parameter cycling via double-tap gesture
- [x] Create `shaders/burningship.glsl`:
  - Burning Ship iteration (abs(z) before squaring)
  - Y-axis flip for correct orientation
- [x] Create `shaders/tricorn.glsl`, `shaders/newton.glsl`, `shaders/phoenix.glsl`, `shaders/lyapunov.glsl`:
  - All 7 fractals implemented
- [x] Create `js/fractals/index.js`:
  - FractalManager registry/manager
  - Switch between fractal types
  - Maintain view state per fractal type
- [x] Update render pipeline to support fractal switching
- [x] Test: All 7 fractals render correctly (Mandelbrot, Julia, Burning Ship, Tricorn, Newton, Phoenix, Lyapunov)

### 2.2 Fractal Selector UI (30 minutes)

- [x] Create `js/ui/controls.js`:
  - Unified UI controls manager (not separate selector component)
  - Button-based fractal selector (not swipeable cards)
  - Show/hide animations
  - Touch event delegation
- [x] Add CSS for selector:
  - Button styling with thumbnails
  - Active indicator (shows current fractal name and thumbnail)
- [x] Integrate selector with fractal manager
- [x] Test: Cycling between fractals works smoothly (tap button to cycle through types)

### 2.3 Color Schemes (45 minutes)

- [x] Create `js/render/colors.js`:
  - ColorManager class with cosine gradient interpolation
  - 8 predefined palettes (cosmic, inferno, ocean, electric, rainbow, fire, ice, monochrome)
  - Generate GLSL color function from scheme
  - Color offset for animation
- [x] Update shaders to use color scheme:
  - Scheme-based function implemented
  - Support u_colorOffset uniform
- [x] Color selector UI:
  - Integrated into `js/ui/controls.js` (not separate component)
  - Quick access button (tap to cycle)
  - Visual label showing current scheme name
- [x] Add CSS for color switcher
- [x] Test: Color schemes apply correctly and look good

### 2.4 Smooth Animations (30 minutes)

- [x] Create `js/core/animator.js`:
  - Animation tween system (ease-in-out)
  - Interpolate view state (center, zoom)
  - Request animation frame integration
- [x] Create `js/core/orchestrator.js`:
  - Animation orchestrator for coordinated animations
- [x] Implement double-tap zoom:
  - Double-tap detection in GestureController
  - Animate zoom to 2x centered on tap point
  - Smooth zoom animation (300ms)
  - Respect cooldown
- [ ] Add momentum scrolling (P1 feature):
  - ~~Create `js/gestures/momentum.js`~~ (Not implemented - may be added in future)
  - ~~Track velocity during pan~~ (Not implemented)
  - ~~Apply friction decay after release~~ (Not implemented)
  - ~~Smooth momentum animation~~ (Not implemented)
- [x] Test: Animations feel smooth and natural

### 2.5 Zoom Level Indicator (15 minutes)

- [ ] Create `js/ui/zoom.js`:
  - ZoomIndicator component
  - Format zoom level in scientific notation with × symbol (e.g., "1.2×10^8")
  - Handle edge cases (zoom = 1, very large numbers)
  - Update on view state changes
- [ ] Add CSS for zoom indicator:
  - Non-intrusive positioning (top-right corner, respecting safe area)
  - Subtle styling, fades when not changing
- [ ] Integrate with ViewState
- [ ] Test: Zoom level displays correctly in all cases

**Phase 2 Deliverable**: Full-featured fractal explorer with multiple types, color schemes, and smooth interactions.

---

## Phase 3: Polish - UI Controls & Optimization (2-3 hours)

**Goal**: Add remaining UI features, preset locations, and performance optimizations.

### 3.1 Advanced UI Controls (30 minutes)

- [ ] Create reset/home button: (Not currently implemented)
  - ~~`js/ui/reset.js` component~~ (Not implemented)
  - Reset to default view for current fractal (ViewState.reset() exists but no UI button)
  - Optional confirmation (prevent accidental resets)
- [x] Create photo mode button:
  - Integrated into `js/ui/controls.js`
  - Hide all UI for clean viewing (allows users to take screenshots)
  - Touch screen to restore UI
- [x] Create info/help button:
  - Integrated into `js/ui/controls.js`
  - Shows instructions overlay with gesture controls
- [ ] Create share/screenshot functionality: (Not currently implemented)
  - ~~`js/ui/share.js` component~~ (Not implemented)
  - ~~Canvas to blob conversion~~ (Not implemented)
  - ~~Native share sheet integration~~ (Not implemented)
- [x] Add CSS for new UI controls:
  - Button styling
  - Positioning and safe area handling
  - Hover/tap states
- [x] Test: All UI controls work on iOS and Android

### 3.2 Preset Locations (20 minutes)

- [ ] Create `js/core/presets.js`:
  - Preset location data structure
  - Interesting coordinates for each fractal type:
    - Mandelbrot: Seahorse Valley, Elephant Valley, Mini Mandelbrot
    - Julia: Curated parameter sets
    - Burning Ship: Interesting regions
  - Preset navigation function
- [ ] Create preset selector UI:
  - Quick access menu
  - Visual preview thumbnails
  - Smooth transition to preset location
- [ ] Integrate with ViewState and fractal manager
- [ ] Test: Presets load correctly and look good

### 3.3 Performance Optimization (30 minutes)

- [ ] Implement progressive refinement: (REMOVED - Simplified to adaptive quality only)
  - ~~Create `js/render/progressive.js`~~ (Not implemented)
  - ~~Multi-pass rendering (low-res → high-res)~~ (Not implemented)
  - Note: System uses QualityAdapter for adaptive quality instead
- [x] Add device tier detection:
  - Create `js/core/device.js` (Simplified device detection)
  - Detect device memory (if available)
  - Get iteration targets based on device tier
- [x] Optimize shader compilation:
  - Cache compiled shaders (FractalManager caches programs)
  - Reuse shader programs across fractals where possible
- [x] Memory management:
  - Efficient WebGL context management
- [x] Test: Performance is smooth on low-end devices

### 3.4 Mobile Platform Polish (20 minutes)

- [ ] iOS Safari specific fixes:
  - Handle orientation changes properly
  - Prevent bounce scrolling
  - Handle safe area insets
  - Test on actual iOS device
- [ ] Android Chrome specific fixes:
  - Handle back button (prevent navigation)
  - Test on actual Android device
- [ ] PWA enhancements:
  - Complete service worker (`sw.js`): (Service worker not currently implemented)
    - Cache all assets (HTML, CSS, JS, shaders)
    - Cache versioning for updates
    - Offline fallback page
    - Update strategy (show "New version available" prompt)
  - [x] Add app icons: (Icons referenced in manifest.json)
    - 192x192, 512x512 (referenced in manifest)
    - 180x180 (Apple touch icon - referenced in manifest)
    - favicon.ico (favicon.svg exists)
  - [ ] Test install prompt (show after user engagement, not immediately)
- [x] Test: Works correctly on target devices (Basic functionality tested)

### 3.5 Final Testing & Bug Fixes (20 minutes)

- [ ] Cross-device testing:
  - Test on iPhone (Safari)
  - Test on Android (Chrome)
  - Test on tablet (iPad)
- [ ] Performance profiling:
  - Measure FPS during gestures
  - Check memory usage
  - Verify 60fps target on mid-range devices
- [ ] Bug fixes:
  - Fix any gesture edge cases
  - Fix rendering artifacts
  - Fix UI layout issues
- [ ] Final polish:
  - Smooth out any janky animations
  - Verify color schemes look good
  - Check zoom level formatting

**Phase 3 Deliverable**: Production-ready fractal explorer with all features and optimizations.

---

## Implementation Notes

### Development Workflow

1. **Start with Phase 1**: Get basic rendering working before adding features
2. **Test frequently**: Test on actual mobile devices, not just desktop browser
3. **Iterate on gestures**: Gesture feel is critical—spend time getting it right
4. **Performance first**: Monitor FPS throughout development, not just at the end

### Key Technical Decisions

- **Vanilla JS**: No framework overhead for maximum performance
- **WebGL 1.0**: Maximum compatibility while maintaining GPU acceleration
- **Emulated Double Precision**: Enables deep zoom (10^12x for v1) despite WebGL float32 limits
- **Adaptive Quality**: Essential for smooth 60fps during gestures
- **Shader Loading**: Use fetch() to load .glsl files (no build step required)
- **State Persistence**: LocalStorage for fractal type and color scheme (privacy-first)

### Testing Checklist

After each phase, verify:
- [ ] Renders correctly on target devices
- [ ] Gestures feel smooth and responsive
- [ ] No visual artifacts or glitches
- [ ] Performance meets 60fps target (or graceful degradation)
- [ ] UI is intuitive and doesn't obstruct fractal view

### Known Challenges

1. **Precision at Deep Zoom**: Emulated double precision adds complexity but is necessary
   - Solution: Complete math library (ds_add, ds_mul, ds_sub, ds_renorm)
   - Periodic renormalization prevents precision loss
2. **Gesture Conflicts**: Need careful handling of multi-touch vs single-touch
   - Solution: Defined transition rules (Pan↔Pinch, double-tap cooldown)
3. **iOS Safari Quirks**: May need platform-specific workarounds
   - Solution: DPR capping, orientation change handling, safe area insets
4. **Performance on Low-End Devices**: Adaptive quality is critical
   - Solution: Performance tier detection, automatic quality adjustment
5. **Loading Time**: Shader compilation can take 100-500ms
   - Solution: Loading screen with progress feedback
6. **Error Recovery**: WebGL context loss needs graceful handling
   - Solution: Automatic retry with user feedback

### Future Enhancements (Post-v1)

- Video recording of exploration paths
- More fractal types (Newton, Tricorn, IFS fractals)
- Advanced animation modes (auto-fly, parameter animation)
- Favorite locations with gallery view
- Educational mode with explanations
- Desktop web version

---

## Time Estimates Summary

| Phase | Estimated Time | Key Deliverable |
|-------|---------------|----------------|
| Phase 1 | 3-4 hours | Working Mandelbrot with pan/zoom, loading, errors, persistence |
| Phase 2 | 3-4 hours | Multiple fractals, colors, animations |
| Phase 3 | 2-3 hours | UI controls, presets, optimization, PWA |
| **Total** | **8-12 hours** | Production-ready MVP |

**Note**: Time estimates include buffer for debugging and iteration. Actual time may vary based on experience level.

---

## Success Criteria

The implementation is complete when:

1. ✅ All three fractal types render correctly
2. ✅ Pan and pinch gestures are smooth (60fps)
3. ✅ Color schemes apply correctly
4. ✅ UI controls are functional and unobtrusive
5. ✅ Works on iOS Safari and Android Chrome
6. ✅ Performance is acceptable on mid-range devices
7. ✅ No critical bugs or rendering artifacts

---

*Last Updated: [Current Date]*
*Version: 1.1 - Updated with gap analysis fixes, realistic time estimates, and complete implementation details*

