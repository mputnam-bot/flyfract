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

