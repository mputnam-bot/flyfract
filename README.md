# FlyFract

**Explore infinite fractal beauty with intuitive touch gestures**

FlyFract is a mobile-first web application that transforms fractal mathematics into an immersive, meditative exploration experience. Discover infinity at your fingertips with smooth, real-time rendering powered by WebGL.  This was implemented as a test of coding with Cursor and Claude Code with Opus 4.5 - please forgive errors and omissions.

![FlyFract](thumbnails/mandelbrot.jpeg)

## Features

- **7 Fractal Types**: Explore Mandelbrot, Julia Sets, Burning Ship, Tricorn, Newton, Phoenix, and Lyapunov fractals
- **Mobile-First Design**: Optimized for touch interactions with intuitive pan, zoom, and rotate gestures
- **High Performance**: GPU-accelerated rendering using WebGL for smooth 60fps on mobile devices
- **Progressive Web App**: Installable on mobile devices with offline capability
- **Multiple Color Schemes**: Beautiful color palettes including Inferno, Ocean, Ice, Monochrome and more
- **Smooth Navigation**: Emulated double-precision arithmetic for deep zoom capabilities
- **Photo Mode**: Hide UI elements for clean, distraction-free viewing

## Live Demo

Visit [flyfract.com](https://flyfract.com) to explore fractals in your browser.

## Technology Stack

- **WebGL**: GPU-accelerated rendering using GLSL shaders
- **Vanilla JavaScript**: No frameworks, pure ES6 modules
- **PWA**: Progressive Web App with service worker support
- **Mobile-Optimized**: Touch gesture handling, responsive design

## Installation

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/mputnam-bot/flyfract.git
cd flyfract
```

2. Serve the files using a local web server (required for ES modules):

```bash
# Using Python 3
python3 -m http.server 8000

# Using Node.js (http-server)
npx http-server

# Using PHP
php -S localhost:8000
```

3. Open your browser and navigate to `http://localhost:8000`

**Note**: Due to ES6 modules and WebGL requirements, the app must be served over HTTP/HTTPS (not `file://`).

## Usage

### Touch Gestures (Mobile)

- **Pan**: Drag with one finger to move around the fractal
- **Zoom**: Pinch to zoom in/out, or double-tap to zoom in
- **Rotate**: Use two fingers to rotate the view (Julia sets and others)

### Keyboard Controls (Desktop)

- **Arrow Keys**: Pan the view
- **+/-**: Zoom in/out
- **F**: Switch to next fractal type
- **C**: Switch to next color scheme
- **R**: Reset view to default
- **P**: Toggle UI visibility (photo mode)

## Supported Fractals

- **Mandelbrot Set**: The classic fractal with infinite detail
- **Julia Sets**: Dynamic variations based on parameter selection
- **Burning Ship**: Geometric, architectural patterns
- **Tricorn**: Symmetric variation of the Mandelbrot set
- **Newton Fractals**: Colorful root-finding visualization
- **Phoenix Fractal**: Complex dynamic system patterns
- **Lyapunov Fractal**: Stability visualization

## Browser Support

- **Chrome/Edge**: Full support (recommended)
- **Safari**: Full support (iOS 11+)
- **Firefox**: Full support
- **Opera**: Full support

Requires WebGL 1.0 support and high-precision floating-point in fragment shaders.

## Project Structure

```
flyfract/
├── js/
│   ├── app.js              # Main application entry point
│   ├── core/               # Core utilities (state, storage, animations)
│   ├── fractals/           # Fractal type definitions
│   ├── gestures/           # Touch/mouse gesture handling
│   ├── render/             # WebGL rendering pipeline
│   └── ui/                 # User interface controls
├── shaders/                # GLSL shader files
├── css/                    # Stylesheets
├── docs/                   # Documentation
└── thumbnails/             # Fractal preview images
```

## Documentation

Comprehensive documentation is available in the `docs/` directory:

- [Product Specification](docs/PRODUCT_SPEC.md) - Feature requirements and user personas
- [Technical Specification](docs/TECHNICAL_SPEC.md) - Implementation details and architecture
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md) - Development roadmap
- [Color Palettes](docs/COLOR_PALETTES.md) - Available color schemes

## Performance

FlyFract is optimized for mobile performance:

- Adaptive quality management based on device capabilities
- Resolution scaling for smooth 60fps on lower-end devices
- Efficient WebGL shader implementations
- Optimized touch event handling

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Author

**Mike Putnam**
- Email: mputnam@gmail.com
- GitHub: [@mputnam-bot](https://github.com/mputnam-bot)

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Inspired by the mathematical beauty of fractals
- Built with modern web standards and WebGL
- Created as an exploration of AI-assisted mobile-first development

---

*Last updated: January 05, 2026*

