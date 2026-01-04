# Security Review: FlyFract

## Overview

This document outlines security considerations, implemented protections, and recommendations for the FlyFract web application. FlyFract is a client-side WebGL fractal explorer with PWA capabilities.

**Application Type**: Static web application (no backend)
**Risk Profile**: Low (no user accounts, no sensitive data, no server-side processing)
**Last Review Date**: 2026-01-04

---

## Table of Contents

1. [Threat Model](#threat-model)
2. [Current Security Posture](#current-security-posture)
3. [Content Security Policy](#content-security-policy)
4. [WebGL Security](#webgl-security)
5. [Service Worker Security](#service-worker-security)
6. [Client-Side Storage](#client-side-storage)
7. [Input Validation](#input-validation)
8. [Third-Party Dependencies](#third-party-dependencies)
9. [HTTPS and Transport Security](#https-and-transport-security)
10. [Recommendations](#recommendations)
11. [Checklist](#security-checklist)

---

## Threat Model

### Assets

| Asset | Sensitivity | Description |
|-------|-------------|-------------|
| User preferences | Low | Fractal type, color scheme stored in localStorage |
| Application code | Low | Client-side JavaScript, shaders |
| Cached resources | Low | Service worker cached assets |

### Threat Actors

| Actor | Motivation | Capability |
|-------|------------|------------|
| Script kiddies | Defacement, pranks | Low |
| Malicious advertisers | Ad injection | Medium |
| Network attackers | MITM, data interception | Medium |

### Attack Vectors

| Vector | Likelihood | Impact | Mitigation |
|--------|------------|--------|------------|
| XSS via URL parameters | Low | Medium | Input validation, CSP |
| Malicious service worker | Very Low | High | HTTPS only, scope restrictions |
| WebGL shader injection | Very Low | Low | No user-provided shaders |
| localStorage tampering | Low | Low | Non-sensitive data only |
| Supply chain attack | Low | High | No external dependencies |

---

## Current Security Posture

### Strengths

1. **No external dependencies** - All code is first-party, eliminating supply chain risks
2. **No backend** - No server-side vulnerabilities possible
3. **No user data collection** - No PII, no accounts, no tracking
4. **Static hosting** - Simple deployment with minimal attack surface
5. **Modern JavaScript** - ES modules with strict mode

### Areas for Improvement

1. Content Security Policy not yet implemented
2. Subresource Integrity (SRI) not applicable (no CDN resources)
3. Security headers depend on hosting configuration

---

## Content Security Policy

### Recommended CSP Header

```
Content-Security-Policy:
    default-src 'self';
    script-src 'self';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob:;
    font-src 'self';
    connect-src 'self';
    worker-src 'self';
    frame-ancestors 'none';
    form-action 'none';
    base-uri 'self';
    object-src 'none';
```

### CSP Directive Rationale

| Directive | Value | Rationale |
|-----------|-------|-----------|
| `default-src` | `'self'` | Restrict all resources to same origin |
| `script-src` | `'self'` | No inline scripts, no external scripts |
| `style-src` | `'self' 'unsafe-inline'` | Allow inline styles for dynamic UI |
| `img-src` | `'self' data: blob:` | Allow thumbnails and generated images |
| `connect-src` | `'self'` | No external API calls |
| `worker-src` | `'self'` | Service worker from same origin only |
| `frame-ancestors` | `'none'` | Prevent clickjacking |
| `object-src` | `'none'` | Block plugins (Flash, Java) |

### Implementation

Add to server configuration or `<meta>` tag in `index.html`:

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; worker-src 'self'; frame-ancestors 'none'; object-src 'none';">
```

---

## WebGL Security

### Current Implementation

FlyFract uses WebGL for GPU-accelerated fractal rendering. Security considerations:

### Shader Security

| Concern | Status | Notes |
|---------|--------|-------|
| User-provided shaders | Not applicable | All shaders are static, bundled with app |
| Shader source exposure | Acceptable | Shaders are visible in DevTools (expected) |
| GPU resource exhaustion | Mitigated | Iteration limits, quality adaptation |

### WebGL Best Practices Implemented

1. **Context loss handling** - Graceful recovery from `webglcontextlost` events
2. **Resource limits** - Maximum iterations capped at 1000
3. **No sensitive data in GPU** - Only mathematical coordinates rendered

### Potential Concerns

1. **GPU fingerprinting** - WebGL can be used for device fingerprinting
   - Mitigation: We don't perform fingerprinting; users concerned about this should use browser privacy features

2. **Denial of Service** - Complex fractals could freeze browser
   - Mitigation: Adaptive quality system reduces iterations during gestures

### WebGL Context Attributes

```javascript
const contextAttributes = {
    alpha: false,           // No transparency needed
    antialias: false,       // Disabled for performance
    depth: false,           // 2D rendering only
    stencil: false,         // Not used
    preserveDrawingBuffer: false,  // Better performance
    powerPreference: 'high-performance'
};
```

---

## Service Worker Security

### Scope and Registration

```javascript
// Current registration
navigator.serviceWorker.register('/sw.js', { scope: '/' });
```

### Security Considerations

| Concern | Status | Mitigation |
|---------|--------|------------|
| HTTPS requirement | Required | SW only registers over HTTPS (or localhost) |
| Scope restriction | Implemented | Scope limited to application root |
| Update mechanism | Implemented | `skipWaiting()` and `clients.claim()` |
| Cache poisoning | Low risk | Only caches same-origin resources |

### Cache Strategy Security

```javascript
// Only cache known, same-origin resources
const CACHE_WHITELIST = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/app.js',
    // ... other first-party resources
];
```

### Recommendations

1. Implement cache versioning to force updates
2. Add integrity checks for cached resources (optional for same-origin)
3. Clear old caches on service worker update

---

## Client-Side Storage

### localStorage Usage

| Key | Data Stored | Sensitivity |
|-----|-------------|-------------|
| `flyfract-state` | Fractal type, color scheme | Non-sensitive |

### Security Measures

1. **No sensitive data** - Only UI preferences stored
2. **JSON parsing** - Use `JSON.parse()` with try-catch
3. **Size limits** - Minimal data stored (~100 bytes)

### Current Implementation

```javascript
// Safe localStorage access pattern
load() {
    try {
        const data = localStorage.getItem(this.key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.warn('Failed to load state:', e);
        return null;
    }
}
```

### Recommendations

1. Validate loaded data structure before use
2. Consider sessionStorage for ephemeral data
3. Implement data migration for schema changes

---

## Input Validation

### URL Parameters

FlyFract may accept URL parameters for sharing views. Security considerations:

| Parameter | Validation Required | Current Status |
|-----------|---------------------|----------------|
| `x`, `y` (coordinates) | Numeric range check | Recommended |
| `zoom` | Numeric, positive | Recommended |
| `fractal` | Enum whitelist | Recommended |
| `color` | Enum whitelist | Recommended |

### Recommended Validation

```javascript
function validateURLParams(params) {
    const validated = {};

    // Coordinate validation
    if (params.x !== undefined) {
        const x = parseFloat(params.x);
        if (!isNaN(x) && isFinite(x) && x >= -10 && x <= 10) {
            validated.x = x;
        }
    }

    // Zoom validation (must be positive, reasonable range)
    if (params.zoom !== undefined) {
        const zoom = parseFloat(params.zoom);
        if (!isNaN(zoom) && zoom > 0 && zoom < 1e15) {
            validated.zoom = zoom;
        }
    }

    // Fractal type validation (whitelist)
    const validFractals = ['mandelbrot', 'julia', 'burningship', 'tricorn', 'newton', 'phoenix', 'lyapunov'];
    if (validFractals.includes(params.fractal)) {
        validated.fractal = params.fractal;
    }

    return validated;
}
```

### DOM Security

1. **No innerHTML with user data** - Use `textContent` for dynamic text
2. **No eval()** - All code is static
3. **No document.write()** - Modern DOM APIs only

---

## Third-Party Dependencies

### Current Dependencies

| Dependency | Version | Source | Risk |
|------------|---------|--------|------|
| None | N/A | N/A | None |

### Recommendations

1. **Maintain zero dependencies** when possible
2. If dependencies are added:
   - Use lockfiles (`package-lock.json`)
   - Enable npm audit in CI/CD
   - Use Subresource Integrity (SRI) for CDN resources
   - Regular dependency updates

---

## HTTPS and Transport Security

### Requirements

| Requirement | Status | Notes |
|-------------|--------|-------|
| HTTPS | Required | Service worker requires secure context |
| HSTS | Recommended | Configure on hosting platform |
| Certificate | Required | Valid TLS certificate |

### Recommended Security Headers

Configure on your hosting platform (Netlify, Vercel, Cloudflare, etc.):

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()
```

### Header Rationale

| Header | Purpose |
|--------|---------|
| `Strict-Transport-Security` | Force HTTPS, prevent downgrade attacks |
| `X-Content-Type-Options` | Prevent MIME sniffing |
| `X-Frame-Options` | Prevent clickjacking (legacy browsers) |
| `X-XSS-Protection` | Disabled (can cause issues, CSP is better) |
| `Referrer-Policy` | Limit referrer information leakage |
| `Permissions-Policy` | Disable unnecessary browser features |

---

## Recommendations

### Priority 1 (Implement Before Production)

- [x] Add Content Security Policy meta tag or header
- [ ] Configure HTTPS with valid certificate (hosting platform)
- [x] Add security headers on hosting platform

### Priority 2 (Implement Soon)

- [x] Add URL parameter validation for share links
- [x] Implement localStorage data validation
- [x] Add error boundaries for WebGL failures

### Priority 3 (Nice to Have)

- [ ] Add Subresource Integrity if using CDN resources in future
- [x] Implement feature policy for unused APIs (Permissions-Policy header)
- [x] Add security.txt file for vulnerability reporting

---

## Security Checklist

### Development

- [x] No eval() or Function() constructor
- [x] No innerHTML with dynamic content
- [x] No external scripts or stylesheets (except Vercel analytics)
- [x] Strict mode enabled (ES modules)
- [x] Error handling for all async operations
- [x] Input validation for URL parameters
- [x] localStorage data validation
- [x] Global error boundary implemented

### Deployment

- [ ] HTTPS enabled (hosting platform)
- [x] Security headers configured (vercel.json, _headers)
- [x] CSP implemented (meta tag)
- [x] Service worker scope restricted

### Maintenance

- [ ] Regular browser compatibility testing
- [ ] Monitor for WebGL security advisories
- [ ] Review service worker cache strategy
- [ ] Test on various devices and browsers

---

## Incident Response

### If a Vulnerability is Discovered

1. **Assessment** - Determine severity and scope
2. **Mitigation** - Deploy fix or disable affected feature
3. **Communication** - Update users if data was exposed (unlikely for this app)
4. **Post-mortem** - Document and prevent recurrence

### Contact

For security concerns, please open an issue on the project repository or contact the maintainers directly.

---

## References

- [OWASP Web Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)
- [Content Security Policy Reference](https://content-security-policy.com/)
- [WebGL Security](https://www.khronos.org/webgl/security/)
- [Service Worker Security](https://w3c.github.io/ServiceWorker/#security-considerations)

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-04 | 1.0 | Initial security review |
