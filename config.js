// --- Configuration Object ---
// Store base values that randomization will modify slightly
export const baseConfig = {
    terrainMaxHeight: 130,
    noiseScale: 100,
    minTerrainHeightFactor: 0.3,
    contourInterval: 4,
};

// Randomization ranges (percentage for height/scale, absolute for height factor)
export const randomRanges = {
    heightRange: 30,    // +/- % for terrainMaxHeight
    noiseRange: 15,     // +/- % for noiseScale
    minHeightRange: 0.05, // +/- absolute for minTerrainHeightFactor
    intervalRange: 8,    // Max random interval (1 to N)
    enableIntervalRandomization: false // Control if interval is randomized (set manually in GUI for now)
};

// Main configuration object, initialized with base values
// Some values will be randomized on generation, others controlled by GUI
export const config = {
    // Terrain Shape (These will be slightly randomized on generation)
    terrainSize: 1000,
    terrainSegments: 500,
    terrainMaxHeight: baseConfig.terrainMaxHeight,
    noiseScale: baseConfig.noiseScale,
    minTerrainHeightFactor: baseConfig.minTerrainHeightFactor,

    // Contours (Interval can be randomized or set manually)
    contourInterval: baseConfig.contourInterval,
    contourColor: '#d95f20',
    backgroundColor: '#f0efe6',

    // Fading (Fixed values)
    minFadeDistance: 200,
    maxFadeDistance: 640,

    // Camera / Controls (Zoom limits fixed)
    minZoomDistance: 280,
    maxZoomDistance: 540,
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