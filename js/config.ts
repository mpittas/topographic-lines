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

// Main scene configuration with derived/visual settings
export const config = {
    terrainSize: 1000,
    terrainSegments: 200,
    terrainMaxHeight: baseConfig.terrainMaxHeight,
    noiseScale: baseConfig.noiseScale,
    minTerrainHeightFactor: baseConfig.minTerrainHeightFactor,
    plateauVolume: 0.0,

    contourInterval: baseConfig.contourInterval,
    contourColor: '#f09393',
    backgroundColor: '#f0efe6',

    minFadeDistance: 200,
    maxFadeDistance: 640,
    fogIntensity: 0.8,

    minZoomDistance: 380,
    maxZoomDistance: 540,
    enableZoom: true,
    enableRotate: true,
    enableVerticalRotate: false,
    fixedVerticalAngle: Math.PI / 3,

    showTerrainBorder: false
};

export let fadeRange = config.maxFadeDistance - config.minFadeDistance;

export let baseContourColor = null;
export let fadeToBgColor = null;

// Updates computed values that depend on config parameters
export function updateDerivedConfig() {
    fadeRange = config.maxFadeDistance - config.minFadeDistance;
}