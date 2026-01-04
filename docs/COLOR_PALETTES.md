# FlyFract Color Palettes

FlyFract supports **9 color palettes** that transform the fractal visualization with different color schemes. All palettes use a procedural cosine gradient formula: `a + b * cos(2π(c*t + d))`

## Available Palettes

### 1. **Cosmic** (Default)
- **ID**: `cosmic`
- **Description**: Classic blue-to-purple-to-gold gradient, reminiscent of deep space
- **Best for**: General exploration, default experience
- **Color Range**: Deep blue → Purple → Magenta → Gold → White-yellow

### 2. **Inferno**
- **ID**: `inferno`
- **Description**: Fiery orange-red gradient, like flames
- **Best for**: Dramatic, high-contrast views
- **Color Range**: Black → Purple → Orange → Yellow → White

### 3. **Ocean**
- **ID**: `ocean`
- **Description**: Cool blue-green gradient, like underwater depths
- **Best for**: Calming, meditative exploration
- **Color Range**: Deep blue → Cyan → Light blue → White

### 4. **Electric**
- **ID**: `electric`
- **Description**: Vibrant cyan-green-yellow gradient, electric and energetic
- **Best for**: High-energy, vibrant visuals
- **Color Range**: Purple → Cyan → Green → Yellow

### 5. **Rainbow**
- **ID**: `rainbow`
- **Description**: Full spectrum rainbow gradient
- **Best for**: Colorful, vibrant exploration
- **Color Range**: Full spectrum from red to violet

### 6. **Fire**
- **ID**: `fire`
- **Description**: Warm red-orange-yellow gradient, like flames
- **Best for**: Warm, energetic visuals
- **Color Range**: Black → Red → Orange → Yellow

### 7. **Ice**
- **ID**: `ice`
- **Description**: Cool blue-white gradient, like ice and snow
- **Best for**: Cool, serene visuals
- **Color Range**: Dark blue → Light blue → Cyan → White

### 8. **Monochrome** (Mono)
- **ID**: `monochrome`
- **Description**: Grayscale gradient, black to white
- **Best for**: Classic, minimalist aesthetic, color-blind friendly
- **Color Range**: Black → Gray → White

### 9. **Rainbow** (Alternative)
- **ID**: `rainbow`
- **Description**: Full spectrum rainbow
- **Note**: Currently defined but may be similar to other schemes

## Technical Details

Each palette is defined by four vectors (a, b, c, d) that control the cosine gradient:

```javascript
vec3 palette(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);  // Base offset
    vec3 b = vec3(0.5, 0.5, 0.5);  // Amplitude
    vec3 c = vec3(1.0, 1.0, 1.0);  // Frequency
    vec3 d = vec3(0.00, 0.33, 0.67); // Phase shift
    return a + b * cos(6.28318 * (c * t + d));
}
```

The `t` parameter comes from the smooth iteration count of the fractal, creating smooth color transitions based on how quickly points escape the set.

## Usage

Users can cycle through palettes by tapping the color scheme button in the UI. The current palette is saved to LocalStorage and restored on next visit.

## Color-Blind Accessibility

The **Monochrome** palette is specifically designed to be color-blind friendly, using only luminance differences rather than hue. This ensures all users can distinguish fractal features regardless of color vision.

---

*For visual previews, see the running application or check the `js/render/colors.js` file for the complete palette definitions.*

