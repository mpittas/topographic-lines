// shaders/lineFadeFragment.glsl

uniform vec3 baseColor;
uniform vec3 u_fogColor;
uniform float minFadeHeight; // Bottom height (fully faded)
uniform float maxFadeHeight; // Top height (fully visible)
uniform float u_opacity;     // Global line opacity
uniform float u_edgeFadeIntensity; // Controls how far inwards the fade reaches (0=none, 1=full fade to center)
uniform float u_terrainHalfSize; // Half the width/depth of the terrain

varying vec3 vWorldPosition;
varying float vHeightRatio; // Currently unused but kept for potential future use

void main() {
    // Height fade factor: 1 = opaque (at max height), 0 = transparent (at min height)
    float heightFadeFactor = smoothstep(minFadeHeight, maxFadeHeight, vWorldPosition.y);

    // Calculate distance from the center in the XZ plane
    float distXZ = length(vWorldPosition.xz);

    // Calculate the distance from the center where the fade starts
    // When intensity is 0, fade starts at the edge (terrainHalfSize)
    // When intensity is 1, fade starts at the center (0)
    float fadeStartDist = u_terrainHalfSize * (1.0 - u_edgeFadeIntensity);

    // Calculate edge fade factor (0 = no fade, 1 = full fade)
    // Smoothly transition from fadeStartDist to the edge (terrainHalfSize)
    float edgeFadeFactor = smoothstep(fadeStartDist, u_terrainHalfSize, distXZ);
    edgeFadeFactor = clamp(edgeFadeFactor, 0.0, 1.0);

    // Calculate final alpha based on height and edge fade
    float finalAlpha = heightFadeFactor * u_opacity * (1.0 - edgeFadeFactor);

    // Calculate final color (mix base color with fog color based on edge fade)
    vec3 finalColor = mix(baseColor, u_fogColor, edgeFadeFactor);

    gl_FragColor = vec4(finalColor, finalAlpha);
} 