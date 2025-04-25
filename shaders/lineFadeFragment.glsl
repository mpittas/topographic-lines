// shaders/lineFadeFragment.glsl

uniform vec3 baseColor;
uniform vec3 u_fogColor; // Renamed
uniform vec3 u_cameraPosition;
uniform float minFadeHeight; // Bottom height (fully faded)
uniform float maxFadeHeight; // Top height (fully visible)
uniform float u_opacity; // Added opacity uniform
uniform float u_fogNear;
uniform float u_fogFar;

varying vec3 vWorldPosition;
varying float vHeightRatio; // Still needed if we use it for height fade alpha?

void main() {
    // Height fade factor: 1 = opaque (at max height), 0 = transparent (at min height)
    float heightFadeFactor = smoothstep(minFadeHeight, maxFadeHeight, vWorldPosition.y);

    // Distance calculation
    float dist = length(vWorldPosition - u_cameraPosition);

    // Distance fog factor: 0 = close (opaque), 1 = far (fully fogged)
    float distFogFactor = smoothstep(u_fogNear, u_fogFar, dist);
    distFogFactor = clamp(distFogFactor, 0.0, 1.0);

    // Calculate final alpha
    // Alpha = (height factor) * (global opacity) * (1.0 - distance factor)
    float finalAlpha = heightFadeFactor * u_opacity * (1.0 - distFogFactor);

    // Calculate final color (mix base color with fog color based on distance)
    vec3 finalColor = mix(baseColor, u_fogColor, distFogFactor);

    gl_FragColor = vec4(finalColor, finalAlpha);
} 