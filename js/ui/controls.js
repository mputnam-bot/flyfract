/**
 * UI Controls Manager
 * Handles all UI elements and their interactions
 */

import { isMobileDevice } from '../core/device.js';

export class UIControls {
    constructor() {
        this.elements = {};
        this.visible = true;
        this.hideTimeout = null;
        this.callbacks = {};
    }

    /**
     * Initialize UI elements
     */
    init() {
        // Create UI container
        this.container = document.createElement('div');
        this.container.id = 'ui-controls';
        this.container.className = 'ui-controls';
        document.body.appendChild(this.container);

        // Create fractal selector
        this.createFractalSelector();

        // Create color selector
        this.createColorSelector();

        // Create info button
        this.createInfoButton();

        // Auto-hide UI after inactivity
        this.setupAutoHide();
    }

    /**
     * Create fractal type selector
     */
    createFractalSelector() {
        const selector = document.createElement('div');
        selector.className = 'fractal-selector';
        selector.innerHTML = `
            <button class="selector-btn prev" aria-label="Previous fractal">
                <svg viewBox="0 0 24 24" width="20" height="20">
                    <path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                </svg>
            </button>
            <div class="selector-label">
                <span class="fractal-name">Mandelbrot</span>
                <span class="fractal-hint">swipe to change</span>
            </div>
            <button class="selector-btn next" aria-label="Next fractal">
                <svg viewBox="0 0 24 24" width="20" height="20">
                    <path fill="currentColor" d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/>
                </svg>
            </button>
        `;

        this.container.appendChild(selector);
        this.elements.fractalSelector = selector;
        this.elements.fractalName = selector.querySelector('.fractal-name');
        this.elements.fractalHint = selector.querySelector('.fractal-hint');

        // Event listeners
        selector.querySelector('.prev').addEventListener('click', () => {
            if (this.callbacks.onPrevFractal) this.callbacks.onPrevFractal();
        });

        selector.querySelector('.next').addEventListener('click', () => {
            if (this.callbacks.onNextFractal) this.callbacks.onNextFractal();
        });
    }

    /**
     * Create color scheme selector
     */
    createColorSelector() {
        const selector = document.createElement('div');
        selector.className = 'color-selector';
        selector.innerHTML = `
            <button class="color-btn" aria-label="Change color scheme">
                <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                </svg>
            </button>
            <span class="color-label">Cosmic</span>
        `;

        this.container.appendChild(selector);
        this.elements.colorSelector = selector;
        this.elements.colorLabel = selector.querySelector('.color-label');

        selector.querySelector('.color-btn').addEventListener('click', () => {
            if (this.callbacks.onColorChange) this.callbacks.onColorChange();
        });
    }

    /**
     * Create info/help button
     */
    createInfoButton() {
        const btn = document.createElement('button');
        btn.className = 'info-btn';
        btn.setAttribute('aria-label', 'Info');
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
        `;

        this.container.appendChild(btn);
        this.elements.infoBtn = btn;

        btn.addEventListener('click', () => {
            this.showInfo();
        });
    }

    /**
     * Update fractal name display
     */
    setFractalName(name, hint = '') {
        if (this.elements.fractalName) {
            this.elements.fractalName.textContent = name;
        }
        if (this.elements.fractalHint && hint) {
            this.elements.fractalHint.textContent = hint;
        }
    }

    /**
     * Update color scheme label
     */
    setColorLabel(name) {
        if (this.elements.colorLabel) {
            this.elements.colorLabel.textContent = name;
        }
    }

    /**
     * Show UI controls
     */
    show() {
        this.container.classList.remove('hidden');
        this.visible = true;
        this.resetAutoHide();
    }

    /**
     * Hide UI controls
     */
    hide() {
        this.container.classList.add('hidden');
        this.visible = false;
    }

    /**
     * Toggle UI visibility
     */
    toggle() {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Setup auto-hide behavior
     */
    setupAutoHide() {
        // Show UI on tap (will be called from gesture controller)
        this.resetAutoHide();
    }

    /**
     * Reset auto-hide timer
     */
    resetAutoHide() {
        clearTimeout(this.hideTimeout);
        // Desktop: longer timeout, mobile: shorter timeout
        const timeout = isMobileDevice() ? 4000 : 8000;
        this.hideTimeout = setTimeout(() => {
            this.hide();
        }, timeout);
    }

    /**
     * Register callbacks
     */
    on(event, callback) {
        this.callbacks[event] = callback;
    }

    /**
     * Show info overlay
     */
    showInfo() {
        const isMobile = isMobileDevice();
        
        // Create info overlay if it doesn't exist
        if (!this.infoOverlay) {
            this.infoOverlay = document.createElement('div');
            this.infoOverlay.className = 'info-overlay';
            
            // Different instructions for mobile vs desktop
            const controlsHTML = isMobile ? `
                <div class="control-item">
                    <span class="icon">👆</span>
                    <span>Drag to pan</span>
                </div>
                <div class="control-item">
                    <span class="icon">🤏</span>
                    <span>Pinch to zoom</span>
                </div>
                <div class="control-item">
                    <span class="icon">🔄</span>
                    <span>Rotate two fingers to rotate</span>
                </div>
                <div class="control-item">
                    <span class="icon">👆👆</span>
                    <span>Double-tap to zoom in</span>
                </div>
            ` : `
                <div class="control-item">
                    <span class="icon">🖱️</span>
                    <span>Click and drag to pan</span>
                </div>
                <div class="control-item">
                    <span class="icon">🖱️</span>
                    <span>Scroll wheel to zoom</span>
                </div>
                <div class="control-item">
                    <span class="icon">🖱️🖱️</span>
                    <span>Double-click to zoom in</span>
                </div>
            `;
            
            this.infoOverlay.innerHTML = `
                <div class="info-content">
                    <h2>FlyFract</h2>
                    <p>Explore infinite fractal beauty</p>
                    <div class="info-controls">
                        ${controlsHTML}
                    </div>
                    <button class="close-btn">Got it</button>
                </div>
            `;
            document.body.appendChild(this.infoOverlay);

            this.infoOverlay.querySelector('.close-btn').addEventListener('click', () => {
                this.hideInfo();
            });

            this.infoOverlay.addEventListener('click', (e) => {
                if (e.target === this.infoOverlay) {
                    this.hideInfo();
                }
            });
        }

        this.infoOverlay.classList.add('visible');
    }

    /**
     * Hide info overlay
     */
    hideInfo() {
        if (this.infoOverlay) {
            this.infoOverlay.classList.remove('visible');
        }
    }
}
