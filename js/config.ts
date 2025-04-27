// Base terrain generation parameters that can be randomized
export const baseConfig = {
    terrainMaxHeight: 200,
    noiseScale: 110,
    minTerrainHeightFactor: 0.3,
    contourInterval: 5,
};

export const randomRanges = {
    heightRange: 100,
    noiseRange: 36,
    minHeightRange: 0.05,
    intervalRange: 7,
    enableIntervalRandomization: true
};

export const Styles = {
    FILLED_MOUNTAIN: 'Filled Mountain',
    LINES_ONLY: 'Lines Only',
    FADING_LINES: 'Fading Lines'
};

// Main scene configuration with derived/visual settings
export const config = {
    terrainSize: 1500,
    terrainSegments: 200,
    terrainMaxHeight: baseConfig.terrainMaxHeight,
    noiseScale: baseConfig.noiseScale,
    minTerrainHeightFactor: baseConfig.minTerrainHeightFactor,
    plateauVolume: 0.0,

    contourInterval: baseConfig.contourInterval,
    contourColor: '#f5b7bc',
    backgroundColor: '#f2e5ea',
    lineOpacity: 1.0,
    fillOpacity: 0.4,

    minFadeDistance: 500,
    maxFadeDistance: 640,
    fogIntensity: 0.5,

    minZoomDistance: 380,
    maxZoomDistance: 740,
    enableZoom: true,
    enableRotate: true,
    enableVerticalRotate: false,
    fixedVerticalAngle: Math.PI / 3,
    cameraMinPitchAngle: 0.1,   // Minimum angle above horizon (radians)

    showTerrainBorder: false,
    style: Styles.FADING_LINES // Default style
};

export let fadeRange = config.maxFadeDistance - config.minFadeDistance;

export let baseContourColor = null;
export let fadeToBgColor = null;

// Updates computed values that depend on config parameters
export function updateDerivedConfig() {
    fadeRange = config.maxFadeDistance - config.minFadeDistance;
}