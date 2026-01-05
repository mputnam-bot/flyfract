/**
 * State Storage
 * Persists user preferences using LocalStorage
 */

import { validateStoredState, VALID_FRACTALS, VALID_COLORS } from './security.js';

export class StateStorage {
    constructor() {
        this.storageKey = 'flyfract-state';
        this.version = 1;
    }

    /**
     * Save state to storage
     * @param {Object} state - State to save
     */
    save(state) {
        try {
            // Validate before saving
            const fractalType = VALID_FRACTALS.includes(state.fractalType)
                ? state.fractalType
                : 'mandelbrot';
            const colorScheme = VALID_COLORS.includes(state.colorScheme)
                ? state.colorScheme
                : 'inferno';

            const data = {
                version: this.version,
                fractalType,
                colorScheme,
                timestamp: Date.now()
            };

            localStorage.setItem(this.storageKey, JSON.stringify(data));
            return true;
        } catch (e) {
            console.warn('Failed to save state:', e);
            return false;
        }
    }

    /**
     * Load state from storage
     * @returns {Object|null} Saved state or null
     */
    load() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (!data) return null;

            // Limit data size to prevent DoS
            if (data.length > 1000) {
                console.warn('Stored data too large, clearing');
                this.clear();
                return null;
            }

            const parsed = JSON.parse(data);

            // Validate the parsed data structure
            const validated = validateStoredState(parsed);
            if (!validated) {
                console.warn('Invalid stored data structure, clearing');
                this.clear();
                return null;
            }

            // Version check
            if (validated.version !== this.version) {
                console.warn('State version mismatch, using defaults');
                this.clear();
                return null;
            }

            return validated;
        } catch (e) {
            console.warn('Failed to load state:', e);
            this.clear(); // Clear corrupted data
            return null;
        }
    }

    /**
     * Clear saved state
     */
    clear() {
        try {
            localStorage.removeItem(this.storageKey);
        } catch (e) {
            console.warn('Failed to clear state:', e);
        }
    }
}
