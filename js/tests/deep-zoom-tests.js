/**
 * Deep Zoom Tests
 *
 * Run these tests in the browser console after loading the app:
 *   import('/js/tests/deep-zoom-tests.js').then(m => m.runAllTests())
 *
 * Or run individual tests:
 *   import('/js/tests/deep-zoom-tests.js').then(m => m.testReferenceOrbit())
 */

import { ReferenceOrbit, DeepZoomManager } from '../core/reference-orbit.js';

// Test results collector
const results = {
    passed: 0,
    failed: 0,
    tests: []
};

function assert(condition, message) {
    if (condition) {
        results.passed++;
        results.tests.push({ pass: true, message });
        console.log(`✓ ${message}`);
    } else {
        results.failed++;
        results.tests.push({ pass: false, message });
        console.error(`✗ ${message}`);
    }
}

function assertApprox(actual, expected, tolerance, message) {
    const diff = Math.abs(actual - expected);
    assert(diff <= tolerance, `${message} (expected ${expected}, got ${actual}, diff ${diff.toExponential(2)})`);
}

/**
 * Test 1: Reference orbit computation for known points
 */
export function testReferenceOrbit() {
    console.log('\n=== Test: Reference Orbit Computation ===');

    const orbit = new ReferenceOrbit();

    // Test 1a: Point clearly outside the set (should escape quickly)
    orbit.computeSync(2.0, 0, 10, 1000);
    assert(orbit.orbitLength < 10, `Point (2, 0) should escape quickly, got ${orbit.orbitLength} iterations`);

    // Test 1b: Point at origin of Mandelbrot (-0.5, 0) - should NOT escape
    orbit.computeSync(-0.5, 0, 10, 1000);
    assert(orbit.orbitLength >= 500, `Point (-0.5, 0) should not escape quickly, got ${orbit.orbitLength} iterations`);

    // Test 1c: Point in the main cardioid - should NOT escape
    orbit.computeSync(-0.25, 0, 10, 1000);
    assert(orbit.orbitLength >= 500, `Point (-0.25, 0) in cardioid should not escape, got ${orbit.orbitLength} iterations`);

    // Test 1d: Point just outside the set - should escape eventually
    orbit.computeSync(0.5, 0.5, 10, 1000);
    assert(orbit.orbitLength > 0 && orbit.orbitLength < 100,
        `Point (0.5, 0.5) should escape quickly, got ${orbit.orbitLength} iterations`);

    // Test 1e: Verify orbit values are stored correctly
    orbit.computeSync(-0.5, 0, 10, 100);
    assert(orbit.orbitRe[0] === 0, `First orbit point should be z=0, got re=${orbit.orbitRe[0]}`);
    assert(orbit.orbitIm[0] === 0, `First orbit point should be z=0, got im=${orbit.orbitIm[0]}`);

    // After first iteration: z = 0² + (-0.5) = -0.5
    assertApprox(orbit.orbitRe[1], -0.5, 0.0001, 'Second orbit point re should be -0.5');
    assertApprox(orbit.orbitIm[1], 0, 0.0001, 'Second orbit point im should be 0');

    // After second iteration: z = (-0.5)² + (-0.5) = 0.25 - 0.5 = -0.25
    assertApprox(orbit.orbitRe[2], -0.25, 0.0001, 'Third orbit point re should be -0.25');
    assertApprox(orbit.orbitIm[2], 0, 0.0001, 'Third orbit point im should be 0');

    console.log('Reference orbit tests complete\n');
}

/**
 * Test 2: Deep zoom threshold detection
 */
export function testDeepZoomThreshold() {
    console.log('\n=== Test: Deep Zoom Threshold ===');

    // Should NOT use deep zoom at low zoom levels
    assert(!ReferenceOrbit.shouldUseDeepZoom(5), 'zoomLog=5 (32x) should not use deep zoom');
    assert(!ReferenceOrbit.shouldUseDeepZoom(10), 'zoomLog=10 (1Kx) should not use deep zoom');
    assert(!ReferenceOrbit.shouldUseDeepZoom(13), 'zoomLog=13 (8Kx) should not use deep zoom');

    // SHOULD use deep zoom at high zoom levels
    assert(ReferenceOrbit.shouldUseDeepZoom(14), 'zoomLog=14 (16Kx) should use deep zoom');
    assert(ReferenceOrbit.shouldUseDeepZoom(20), 'zoomLog=20 (1Mx) should use deep zoom');
    assert(ReferenceOrbit.shouldUseDeepZoom(50), 'zoomLog=50 should use deep zoom');

    console.log('Deep zoom threshold tests complete\n');
}

/**
 * Test 3: Orbit texture creation
 */
export function testOrbitTexture() {
    console.log('\n=== Test: Orbit Texture Creation ===');

    // This test requires WebGL context
    if (typeof window === 'undefined' || !window.app || !window.app.gl) {
        console.warn('Skipping texture tests - no WebGL context available');
        console.warn('Run this test in the browser after the app loads');
        return;
    }

    const gl = window.app.gl;
    const orbit = new ReferenceOrbit();

    // Compute a test orbit
    orbit.computeSync(-0.5, 0, 20, 500);

    // Try to create texture
    const textureInfo = orbit.createOrbitTexture(gl);

    if (textureInfo === null) {
        console.warn('OES_texture_float not supported - texture test skipped');
        return;
    }

    assert(textureInfo.texture !== null, 'Texture should be created');
    assert(textureInfo.width > 0, `Texture width should be positive, got ${textureInfo.width}`);
    assert(textureInfo.height > 0, `Texture height should be positive, got ${textureInfo.height}`);
    assert(textureInfo.length === orbit.orbitLength,
        `Texture length should match orbit, got ${textureInfo.length} vs ${orbit.orbitLength}`);

    // Clean up
    gl.deleteTexture(textureInfo.texture);

    console.log('Orbit texture tests complete\n');
}

/**
 * Test 4: Deep Zoom Manager integration
 */
export function testDeepZoomManager() {
    console.log('\n=== Test: Deep Zoom Manager ===');

    if (typeof window === 'undefined' || !window.app || !window.app.gl) {
        console.warn('Skipping manager tests - no WebGL context available');
        return;
    }

    const gl = window.app.gl;
    const manager = new DeepZoomManager();
    manager.init(gl);

    // Test update at low zoom (should not enable)
    manager.updateSync(-0.5, 0, 10, 500);
    assert(!manager.isEnabled, 'Manager should not be enabled at zoomLog=10');

    // Test update at high zoom (should enable)
    manager.updateSync(-0.5, 0, 20, 500);
    assert(manager.isEnabled, 'Manager should be enabled at zoomLog=20');
    assert(manager.status === 'ready', `Manager status should be ready, got ${manager.status}`);

    // Test shader data availability
    const shaderData = manager.getShaderData();
    assert(shaderData !== null, 'Shader data should be available');
    assert(shaderData.enabled === true, 'Shader data should indicate enabled');
    assert(shaderData.orbitLength > 0, `Orbit length should be positive, got ${shaderData.orbitLength}`);

    // Clean up
    manager.dispose();

    console.log('Deep zoom manager tests complete\n');
}

/**
 * Test 5: Visual comparison test (manual verification)
 */
export function testVisualComparison() {
    console.log('\n=== Test: Visual Comparison (Manual) ===');

    if (typeof window === 'undefined' || !window.app) {
        console.warn('Skipping visual test - app not available');
        return;
    }

    const app = window.app;

    console.log('This test requires manual verification.');
    console.log('Instructions:');
    console.log('1. The view will zoom to a test location');
    console.log('2. Verify the fractal looks correct (not black, grey, or pixelated)');
    console.log('3. Check that "deep" appears in the zoom indicator');

    // Navigate to a known interesting deep zoom location
    const testLocations = [
        { x: -0.7435669, y: 0.1314023, zoom: 14, name: 'Seahorse Valley' },
        { x: -0.5, y: 0, zoom: 16, name: 'Main bulb edge' },
        { x: -1.25066, y: 0.02012, zoom: 18, name: 'Elephant Valley' },
    ];

    let currentTest = 0;

    function runNextVisualTest() {
        if (currentTest >= testLocations.length) {
            console.log('\nVisual tests complete. Please verify results above.');
            return;
        }

        const loc = testLocations[currentTest];
        console.log(`\nTest ${currentTest + 1}: ${loc.name}`);
        console.log(`  Location: (${loc.x}, ${loc.y})`);
        console.log(`  Zoom: 2^${loc.zoom} = ${Math.pow(2, loc.zoom).toExponential(2)}x`);

        // Set the view
        app.viewState.setView(loc.x, loc.y, Math.pow(2, loc.zoom));
        app.orchestrator.requestRender();

        currentTest++;

        // Wait and run next
        setTimeout(runNextVisualTest, 3000);
    }

    runNextVisualTest();
}

/**
 * Test 6: Performance test
 */
export function testPerformance() {
    console.log('\n=== Test: Performance ===');

    const orbit = new ReferenceOrbit();

    // Test orbit computation speed
    const iterations = 10000;
    const start = performance.now();
    orbit.computeSync(-0.5, 0, 30, iterations);
    const elapsed = performance.now() - start;

    console.log(`Computed ${orbit.orbitLength} iterations in ${elapsed.toFixed(2)}ms`);
    console.log(`Rate: ${(orbit.orbitLength / elapsed * 1000).toFixed(0)} iterations/second`);

    assert(elapsed < 1000, `Orbit computation should be fast (< 1s), took ${elapsed.toFixed(0)}ms`);

    console.log('Performance tests complete\n');
}

/**
 * Run all tests
 */
export function runAllTests() {
    console.log('╔════════════════════════════════════════╗');
    console.log('║     DEEP ZOOM TEST SUITE               ║');
    console.log('╚════════════════════════════════════════╝\n');

    results.passed = 0;
    results.failed = 0;
    results.tests = [];

    try {
        testReferenceOrbit();
        testDeepZoomThreshold();
        testOrbitTexture();
        testDeepZoomManager();
        testPerformance();
        // testVisualComparison(); // Uncomment for manual visual testing
    } catch (error) {
        console.error('Test suite error:', error);
    }

    console.log('\n╔════════════════════════════════════════╗');
    console.log(`║  Results: ${results.passed} passed, ${results.failed} failed`.padEnd(41) + '║');
    console.log('╚════════════════════════════════════════╝');

    return results;
}

// Export for use in console
if (typeof window !== 'undefined') {
    window.deepZoomTests = {
        runAllTests,
        testReferenceOrbit,
        testDeepZoomThreshold,
        testOrbitTexture,
        testDeepZoomManager,
        testVisualComparison,
        testPerformance
    };
    console.log('Deep zoom tests loaded. Run with: deepZoomTests.runAllTests()');
}
