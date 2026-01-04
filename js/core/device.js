/**
 * Device Detection Utility
 * Detects device type and capabilities
 */

export function isMobileDevice() {
    // Check for touch capability
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Check user agent for mobile devices
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
    const isMobileUA = mobileRegex.test(userAgent);

    // Check screen size (mobile typically < 768px width)
    const isSmallScreen = window.innerWidth < 768;

    // Consider it mobile if it has touch AND (matches mobile UA OR small screen)
    return hasTouch && (isMobileUA || isSmallScreen);
}

export function isDesktopDevice() {
    return !isMobileDevice();
}

export function getDeviceType() {
    return isMobileDevice() ? 'mobile' : 'desktop';
}

/**
 * Detect device memory (GB)
 * Returns 4 if navigator.deviceMemory is not available
 */
export function getDeviceMemory() {
    return navigator.deviceMemory || 4;
}

/**
 * Detect if device has ProMotion (120Hz) display
 * This is a heuristic based on high-DPR iPhones
 */
export function hasProMotion() {
    const isHighDPR = window.devicePixelRatio >= 3;
    const isIPhone = /iPhone/.test(navigator.userAgent);
    return isHighDPR && isIPhone;
}

/**
 * Get device tier based on memory and capabilities
 * Returns 'low', 'mid', or 'high'
 */
export function getDeviceTier() {
    const memory = getDeviceMemory();

    if (memory >= 6) {
        return 'high';
    } else if (memory >= 4) {
        return 'mid';
    } else {
        return 'low';
    }
}

/**
 * Get recommended iteration targets based on device tier
 * Returns { gesture: number, static: number }
 */
export function getIterationTargets() {
    const tier = getDeviceTier();
    const isProMotion = hasProMotion();

    switch (tier) {
        case 'high':
            return {
                gesture: isProMotion ? 150 : 120,
                static: 400
            };
        case 'mid':
            return {
                gesture: 100,
                static: 300
            };
        case 'low':
        default:
            return {
                gesture: 75,
                static: 200
            };
    }
}

