# FlyFract - Product Specification

---

## 1. Project Overview & Vision

### Vision Statement
FlyFract is a mobile-first web application that transforms fractal mathematics into an immersive, meditative exploration experience. Like Monument Valley's elegant puzzle landscapes, FlyFract makes complex mathematical beauty accessible through intuitive touch gestures and stunning visual design.

### Core Value Proposition
**"Discover infinity at your fingertips."**

FlyFract removes the technical barriers that have traditionally separated users from fractal exploration. No complex parameters, no technical jargon—just pure, fluid navigation through endlessly fascinating geometric patterns. Users can effortlessly fly through infinite detail, zooming from cosmic scales to microscopic textures with natural gestures that feel like magic.

### Design Philosophy
- **Immediate Wonder**: Users should feel awe within the first 3 seconds
- **Intuitive Mastery**: Zero learning curve—gestures work as users expect
- **Visual Poetry**: Every frame should be framable, every moment Instagram-worthy
- **Performance First**: Smooth 60fps even on mid-range mobile devices
- **Progressive Discovery**: Layers of depth for both casual and engaged users

---

## 2. Target Users & Use Cases

### Primary User Personas

#### 1. The Casual Explorer (Primary - 60%)
- **Demographics**: Ages 18-45, smartphone-native, social media active
- **Motivation**: Seeking visually stunning content, stress relief, shareable moments
- **Behavior**: 2-5 minute sessions, often during breaks or while waiting
- **Goals**: Discover beautiful patterns, create shareable screenshots, relax

#### 2. The Math Enthusiast (Secondary - 25%)
- **Demographics**: Ages 16-50, STEM-interested, enjoys mathematical beauty
- **Motivation**: Appreciation for mathematical elegance, educational curiosity
- **Behavior**: Longer sessions (10-15 minutes), deeper exploration, sharing with peers
- **Goals**: Understand fractal properties, explore parameter spaces, learn

#### 3. The Creative Professional (Secondary - 15%)
- **Demographics**: Designers, artists, content creators, ages 25-50
- **Motivation**: Visual inspiration, reference material, background patterns
- **Behavior**: On-demand use, screenshot-heavy, share with creative communities
- **Goals**: Find interesting patterns, export for projects, inspiration

### Primary Use Cases

1. **Quick Mental Break** (Most Common)
   - User opens app during a break
   - Sees mesmerizing fractal loading animation
   - Pinches/zooms to explore for 1-2 minutes
   - Feels refreshed, continues day

2. **Deep Meditation Session**
   - User opens app with intention to relax
   - Selects favorite fractal type
   - Engages in slow, deliberate navigation
   - 5-10 minute immersive experience

3. **Social Sharing**
   - User discovers particularly beautiful region
   - Takes screenshot or records short video
   - Shares to social media with caption
   - Friends engage, driving organic growth

4. **Educational Discovery**
   - Teacher/student opens app for math visualization
   - Explores different fractal types
   - Observes self-similarity and recursive patterns
   - Enhances understanding through visual learning

---

## 3. Recommended Fractals

### Phase 1: Core Fractals (v1 Launch)

#### 1. Mandelbrot Set (Must-Have)
- **Why**: Most iconic, endless variety, universally recognized
- **Visual Appeal**: High contrast colors, deep zoom potential, organic shapes
- **Technical Notes**: Well-optimized algorithms available, GPU-friendly
- **Exploration Style**: Center-based zoom reveals infinite detail

#### 2. Julia Sets (Must-Have)
- **Why**: Complementary to Mandelbrot, offers variety through parameter selection
- **Visual Appeal**: Can be more fluid and organic than Mandelbrot
- **Technical Notes**: Similar optimization to Mandelbrot, can cycle through parameters
- **Exploration Style**: Parameter variation creates dynamic transformations

#### 3. Burning Ship Fractal (High Priority)
- **Why**: Strikingly different aesthetic, more geometric/architectural
- **Visual Appeal**: Angular patterns, great contrast, "architectural" feel
- **Technical Notes**: Similar complexity to Mandelbrot, good performance
- **Exploration Style**: Reveals geometric patterns at different scales

### Phase 2: Expansion Fractals (Post-v1)

All 10 fractals are currently implemented:
1. Mandelbrot Set ✅
2. Julia Sets ✅
3. Burning Ship Fractal ✅
4. Tricorn ✅
5. Newton Fractals ✅
6. Phoenix Fractal ✅
7. Lyapunov Fractal ✅
8. Multibrot ✅
9. Magnet ✅
10. Celtic ✅

Future expansion possibilities:
- **Barnsley Fern** - Different type (IFS), organic shapes
- **Sierpinski Triangle/Carpet** - Classic, geometric
- **Koch Snowflake** - Recognizable, educational

### Fractal Selection Criteria
- **Performance**: Must render smoothly on mobile devices (target: 60fps)
- **Visual Variety**: Different aesthetic from other fractals in set
- **Exploration Depth**: Offers interesting regions at multiple zoom levels
- **Touch-Friendliness**: Gestures reveal interesting properties naturally

---

## 4. Core Features (Prioritized for v1)

### P0 - Critical (Must Have for Launch)

#### 4.1 Intuitive Touch Navigation
- **Pinch-to-Zoom**: Smooth, responsive zoom in/out (supports deep zoom with emulated double precision)
- **Pan/Drag**: Natural dragging to explore different regions
- **Double-Tap**: Quick zoom to interesting region (2.5x zoom centered on tap)
- **Rotate**: Two-finger rotation gesture (desktop: right-click drag)
- **Performance**: 60fps maintained during all gestures via AnimationOrchestrator
- **Desktop Support**: Full mouse and keyboard controls (arrow keys, +/- zoom, F/C/R/P keys)

#### 4.2 Beautiful Visual Rendering
- **High-Quality Colors**: Smooth gradients, visually pleasing color maps
- **Adaptive Quality**: Auto-adjust iteration depth for performance
- **Anti-Aliasing**: Smooth edges, no pixelation artifacts
- **Loading States**: Elegant loading animations, no jarring transitions

#### 4.3 Fractal Selection
- **Button-Based Selector**: Tap button to cycle through fractal types
- **Preview Thumbnails**: Visual thumbnail preview for each fractal type
- **Current Fractal Indicator**: Shows current fractal name and thumbnail icon
- **10 Fractal Types**: Mandelbrot, Julia Sets, Burning Ship, Tricorn, Newton, Phoenix, Lyapunov, Multibrot, Magnet, Celtic

#### 4.4 Zoom Level Indicator
- **Status**: Not currently implemented in the UI (may be added in future versions)

### P1 - Important (Should Have for Launch)

#### 4.5 Photo Mode
- **Hide UI**: Photo button to hide all UI elements for clean viewing
- **Touch to Restore**: Tap screen to restore UI after hiding
- **Screenshot Ready**: Allows users to take screenshots without UI elements

#### 4.6 Color Scheme Selection
- **8 Color Palettes**: Cosmic, Inferno (default), Ocean, Electric, Rainbow, Fire, Ice, Monochrome
- **Quick Switcher**: Tap button to cycle through color schemes
- **State Persistence**: Current color scheme saved and restored on next visit
- **First-Time Default**: New users see Mandelbrot fractal with Inferno color scheme

#### 4.7 Reset/Home Functionality
- **Keyboard Shortcut**: R key resets view to default for current fractal (desktop only)
- **UI Button**: Not currently implemented (may be added in future versions)

#### 4.8 Performance Optimization
- **AnimationOrchestrator**: Unified animation loop handles all animations, momentum, and rendering
- **Iteration Smoothing**: Smooth transitions between gesture and static iteration counts (prevents flickering)
- **Device-Based Iterations**: Iteration counts based on device tier (low/mid/high) via device detection
- **QualityAdapter**: Adjusts rendering quality based on frame time (currently used for resolution scaling)
- **Fixed Resolution Approach**: Canvas resolution remains constant during gestures; only iterations change (eliminates visible flicker)
- **Gesture Buffering**: Gesture inputs are buffered and applied atomically per frame
- **Memory Management**: Efficient handling of zoom level changes

### P2 - Nice to Have (Post-Launch or v1.1)

#### 4.9 Favorite Locations
- **Save Spots**: Bookmark interesting zoom regions
- **Quick Navigation**: Return to favorites easily
- **Visual Gallery**: Grid view of saved locations

#### 4.10 Animation Modes
- **Auto-Fly**: Automatic camera movement through interesting regions
- **Parameter Animation**: Smooth transitions through Julia set parameters
- **Cinematic Mode**: Curated flight paths

#### 4.11 Advanced Controls (Hidden/Toggle)
- **Iteration Depth**: Manual control for power users
- **Color Offset**: Fine-tune color schemes
- **Export Options**: High-res export for creatives

---

## 5. User Experience Flow

### First-Time User Journey

#### Entry Point (0-3 seconds)
1. User opens web app or bookmarks
2. **Loading Experience**: 
   - Show elegant loading animation (pulsing fractal preview or CSS animation)
   - Display progress during shader compilation (if >500ms)
   - Graceful error message if WebGL unavailable
3. **Immediate Impact**: Beautiful fractal renders with visually stunning default view (Mandelbrot with Inferno color scheme)
4. **Visual Hook**: Default view is pre-selected interesting region (see Technical Spec for coordinates)
5. **No Tutorial**: Interface is self-evident—user immediately understands they can interact

#### Discovery Phase (3-30 seconds)
1. **Natural Gesture**: User instinctively pinches or drags
2. **Instant Feedback**: Smooth response, no lag, fractal updates fluidly
3. **Awe Moment**: User realizes infinite detail—zooming reveals more beauty
4. **Pattern Recognition**: User notices self-similarity, feels wonder

#### Exploration Phase (30 seconds - 5 minutes)
1. **Active Navigation**: User explores different regions
2. **Fractal Switching**: User discovers fractal selector, tries different types
3. **Color Experimentation**: User explores different color schemes
4. **Sharing Moment**: User finds something beautiful, captures screenshot

#### Return User Journey
1. **Quick Launch**: Fast loading, remembers last viewed fractal
2. **Immediate Resume**: Can continue exploration from where they left off
3. **New Discoveries**: Explores different fractals or regions

### Interaction Details

#### Touch Gesture Map
- **Single Finger Drag**: Pan across fractal
- **Two Finger Pinch**: Zoom in/out
- **Two Finger Rotate**: Rotate the view
- **Double Tap**: Quick zoom (2.5x centered on tap location)
- **Tap Photo Button**: Hide/show UI (photo mode)
- **Tap Info Button**: Show gesture instructions
- **Tap Fractal/Color Buttons**: Cycle through options

#### Visual Feedback
- **Gesture Start**: Subtle visual cue (e.g., slight brightness change)
- **During Gesture**: Smooth, responsive updates
- **Gesture End**: Graceful settling (no abrupt stops)
- **Loading**: Elegant progress indicators (e.g., pulsing fractal preview)

#### State Management
- **Current Fractal Type**: Persist across sessions (LocalStorage) - restored on next visit
- **Color Preference**: Remember user's favorite color scheme (LocalStorage) - restored on next visit
- **First-Time Defaults**: New users see Mandelbrot fractal with Inferno color scheme
- **Performance Settings**: Auto-detect device capabilities (not persisted) - uses device memory for tier detection

---

## 6. Success Metrics

### Engagement Metrics
- **Session Duration**: Target: Average 2-3 minutes (indicating engagement)
- **Return Rate**: 40%+ users return within 7 days
- **Exploration Depth**: Average zoom level reached (target: >10^6x)
- **Fractal Switching**: Users try 2+ different fractals per session

### Performance Metrics
- **Frame Rate**: 95th percentile maintains 60fps during gestures
- **Load Time**: Initial render < 2 seconds on 4G connection
- **Gesture Responsiveness**: Touch-to-visual-update latency < 16ms
- **Memory Usage**: Peak memory < 150MB on mid-range devices

### User Satisfaction Metrics
- **Share Rate**: 15%+ of sessions include a screenshot/share
- **Bounce Rate**: < 30% users leave before first interaction
- **Error Rate**: < 1% critical errors (crashes, render failures)
- **Accessibility**: Works on devices from last 5 years

### Growth Metrics (Post-Launch)
- **Organic Sharing**: Screenshots shared to social media
- **Viral Coefficient**: Users sharing with friends
- **Bookmark Rate**: Users adding to home screen
- **Return User Growth**: Month-over-month returning user growth

### Qualitative Metrics
- **User Feedback**: "Magical," "Meditative," "Beautiful" sentiment in reviews
- **Press Coverage**: Featured in design/tech blogs
- **Educational Use**: Adoption in educational contexts

---

## 7. Technical Constraints

### Mobile Web Limitations
- **No Native App**: Web-based, must work in mobile browsers
- **Limited GPU Access**: WebGL available but with restrictions
- **Memory Constraints**: Mobile devices have limited RAM (2-4GB typical)
- **Battery Life**: Intensive computation drains battery—must optimize
- **Network Variability**: Must work offline after initial load (service worker)
- **Browser Fragmentation**: Support iOS Safari, Chrome Android, Samsung Internet

### Performance Targets
- **Target Devices**: iPhone 8+, Android devices from 2018+
- **Frame Rate**: Minimum 30fps, target 60fps
- **Resolution**: Adaptive—lower on older devices, higher on newer
- **Initial Bundle Size**: < 150KB (compressed) for fast first paint (target, actual may vary)
- **Total Assets**: < 2MB for full experience

### Platform-Specific Constraints
- **iOS Safari**: 
  - Limited WebGL features, touch event quirks
  - Must handle safe area insets (notch)
- **Android Chrome**:
  - Better WebGL support
  - Handle back button (prevent accidental navigation)
- **Progressive Web App**:
  - Service worker for offline capability
  - Install prompt for home screen addition

### Browser Support Matrix
- **Required**: iOS Safari 12+, Chrome Android 70+, Samsung Internet 10+
- **Optional**: Older browsers with graceful degradation
- **No Support**: Internet Explorer (any version)

### Accessibility Constraints
- **Touch Only**: Primary interaction is touch-based (no mouse/keyboard requirement)
- **No Audio**: Silent experience (no sound required)
- **Color Blindness**: At least one color-blind friendly palette included (high contrast, pattern-based)
- **Performance**: Should work on slower devices (with quality reduction)
- **Error Messages**: User-friendly error messages for WebGL failures, with graceful degradation

---

## 8. Out of Scope (v1)

### Explicitly Excluded Features

#### Advanced Fractal Types
- **3D Fractals**: Mandelbulb, Quaternion sets (too computationally intensive)
- **Custom Formula Entry**: User-defined fractal formulas (too complex for v1)
- **IFS Fractals**: Different rendering technique, defer to v2
- **Real-time Parameter Modification**: Advanced Julia set parameter tweaking

#### Social Features
- **User Accounts**: No login, registration, or user profiles
- **Sharing Platform**: No built-in gallery or social feed
- **Collaborative Exploration**: No multi-user features
- **Comments/Ratings**: No user-generated content beyond sharing

#### Advanced Controls
- **Manual Iteration Depth**: Hidden from users (auto-optimized)
- **Custom Color Editors**: No fine-grained color control
- **Export Formats**: Only screenshots (no video export, no SVG export)
- **Batch Operations**: No batch rendering or processing

#### Monetization
- **No Ads**: Clean, ad-free experience (monetization strategy TBD for future)
- **No Premium Tiers**: All features available to all users
- **No In-App Purchases**: Not applicable for v1

#### Technical Features
- **Multi-threading**: Web Workers complexity deferred
- **Advanced Caching**: Basic service worker, not full offline mode
- **Analytics Integration**: Minimal analytics (privacy-first)
- **A/B Testing**: Not in scope for v1

### Future Considerations (Post-v1)
- Video recording of exploration paths
- AR/VR modes
- Educational mode with explanations
- Custom fractal formula editor
- Community gallery of interesting locations
- Advanced animation and auto-flight modes
- Desktop web version (different interaction model)

---

## 9. Design Principles & Guidelines

### Visual Design
- **Minimal UI**: UI elements fade when not in use, full-screen fractal focus
- **Elegant Typography**: Clean, readable, unobtrusive (system fonts preferred)
- **Consistent Spacing**: Generous whitespace, clear visual hierarchy
- **Color Harmony**: UI colors complement fractal visuals, never clash

### Interaction Design
- **Predictable**: Gestures work exactly as users expect
- **Forgiving**: Easy to undo mistakes, hard to get "lost"
- **Responsive**: Every touch gets immediate visual feedback
- **Delightful**: Micro-interactions add polish (e.g., smooth transitions)

### Content Strategy
- **No Tutorials**: Self-explanatory interface
- **No Help Text**: Gestures are intuitive enough
- **Minimal Copy**: Only essential labels
- **Visual Language**: Icons and visuals over text

---

## 10. Launch Criteria

### Definition of Done (v1)
- [ ] All P0 features implemented and tested
- [ ] 95%+ of target devices achieve 60fps during normal use
- [ ] Works on iOS Safari and Chrome Android (primary targets)
- [ ] All P1 features implemented (stretch goal)
- [ ] Load time < 2 seconds on 4G
- [ ] No critical bugs in final testing
- [ ] Error handling and graceful degradation implemented
- [ ] Loading experience with progress feedback
- [ ] State persistence working (fractal type, color preference)
- [ ] Privacy policy and terms (if needed)
- [ ] Basic analytics in place (privacy-first, minimal events)

### Beta Testing
- **Internal Testing**: Team uses on various devices for 1 week
- **External Beta**: 10-20 users test for usability and performance
- **Iteration**: Fix critical issues before public launch

---

## 11. Error States & Edge Cases

### Error Handling Strategy

#### WebGL Unavailable
- **Detection**: Check WebGL support on load
- **User Message**: "Your device doesn't support WebGL. Please try a different browser or device."
- **Fallback**: None (WebGL is required for core functionality)

#### WebGL Context Lost
- **Detection**: Listen for `webglcontextlost` event
- **Recovery**: Attempt to restore context automatically
- **User Message**: "Rendering paused. Tap to retry." (if recovery fails)

#### Shader Compilation Failure
- **Detection**: Check shader compilation status
- **User Message**: "Unable to initialize graphics. Please refresh the page."
- **Logging**: Log shader errors to console for debugging

#### Network Errors (Service Worker)
- **Detection**: Service worker fetch failures
- **Fallback**: Use cached assets, show offline indicator if needed

### Edge Cases

#### Gesture Conflicts
- **Pan → Pinch**: Transition smoothly when second finger added
- **Pinch → Pan**: Continue pan when one finger lifted
- **Double-tap during gesture**: Ignore if gesture in progress

#### Deep Zoom Precision Loss
- **Detection**: Monitor precision degradation
- **Handling**: Renormalize emulated doubles periodically
- **User Experience**: Seamless (no visible artifacts)

#### Orientation Changes
- **Handling**: Resize canvas, maintain view state
- **Timing**: Wait for orientation change to complete (100ms delay)

## Document History

- **Version 1.1**: Updated with error handling, loading experience, and consistency fixes
- **Version 1.0**: Initial product specification
- **Last Updated**: [Current Date]
- **Owner**: Product Team
- **Status**: Draft → Review → Approved

---

## Appendix: Competitive Analysis

### Similar Products (Reference Only)
- **Mandelbrot Explorer Apps**: Various apps exist but lack mobile-first focus
- **Fractal Zoom Videos**: YouTube videos popular but not interactive
- **Monument Valley**: Reference for intuitive touch design and visual beauty
- **Abstract Visualizers**: Music visualizers, meditation apps—reference for engagement

### Differentiation
- **Mobile-First**: Built specifically for touch, not adapted from desktop
- **Zero Learning Curve**: More intuitive than existing fractal explorers
- **Visual Focus**: Prioritizes beauty and smoothness over features
- **Web-Based**: No app store friction, instant access

