// --- Configuration Object ---
// Store base values that randomization will modify slightly
export const baseConfig = {
    terrainMaxHeight: 200, // Adjusted base for 100-300 range
    noiseScale: 110, // Adjusted base for 70-150 range
    minTerrainHeightFactor: 0.3,
    contourInterval: 5, // Adjusted base for 2-8 range
};

// Randomization ranges (percentage for height/scale, absolute for height factor)
export const randomRanges = {
    heightRange: 100,    // +/- % for terrainMaxHeight (100-300)
    noiseRange: 36,     // +/- % for noiseScale (approx 70-150)
    minHeightRange: 0.05, // +/- absolute for minTerrainHeightFactor
    intervalRange: 7,    // Max random interval (1 to N) - will use 2-8 range directly
    enableIntervalRandomization: true // Enable interval randomization
};

// Main configuration object, initialized with base values
// Some values will be randomized on generation, others controlled by GUI
export const config = {
    // Terrain Shape (These will be slightly randomized on generation)
    terrainSize: 1000,
    terrainSegments: 200, // Reduced for performance
    terrainMaxHeight: baseConfig.terrainMaxHeight,
    noiseScale: baseConfig.noiseScale,
    minTerrainHeightFactor: baseConfig.minTerrainHeightFactor,
    plateauVolume: 0.0, // 0.0 = no plateau, 1.0 = max plateau

    // Contours (Interval can be randomized or set manually)
    contourInterval: baseConfig.contourInterval,
    contourColor: '#f09393',
    backgroundColor: '#f0efe6',

    // Fading (Fixed values)
    minFadeDistance: 200,
    maxFadeDistance: 640,
    fogIntensity: 0.8, // 0 = off, 1 = full

    // Camera / Controls (Zoom limits fixed)
    minZoomDistance: 380,
    maxZoomDistance: 740,
    enableZoom: true,
    enableRotate: true,
    enableVerticalRotate: false,
    fixedVerticalAngle: Math.PI / 3,

    // Debugging
    showTerrainBorder: false
};

// --- Derived Configuration ---
// We might need to update this dynamically if related config values change.
// For now, calculate initial value. The animation loop recalculates fade based on current config.
export let fadeRange = config.maxFadeDistance - config.minFadeDistance;

// --- Pre-create colors ---
// These will be updated when config changes
export let baseContourColor = null; // Initialized in main after THREE is loaded
export let fadeToBgColor = null;    // Initialized in main after THREE is loaded

// Function to update derived values when config changes
export function updateDerivedConfig() {
    fadeRange = config.maxFadeDistance - config.minFadeDistance;
    // Color updates happen elsewhere as they need THREE.Color
}