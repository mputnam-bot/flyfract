/**
 * State Storage
 * Persists user preferences using LocalStorage
 */

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
            const data = {
                version: this.version,
                fractalType: state.fractalType || 'mandelbrot',
                colorScheme: state.colorScheme || 'cosmic',
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

            const parsed = JSON.parse(data);

            // Version check
            if (parsed.version !== this.version) {
                console.warn('State version mismatch, using defaults');
                this.clear();
                return null;
            }

            return parsed;
        } catch (e) {
            console.warn('Failed to load state:', e);
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
