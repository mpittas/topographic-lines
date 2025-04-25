// shaders/lineFadeFragment.glsl

uniform vec3 baseColor;
uniform vec3 fogColor; // Use background color as fade target
// uniform vec3 cameraPosition; // No longer needed for height-based fade
uniform float minFadeHeight; // Bottom height (fully faded)
uniform float maxFadeHeight; // Top height (fully visible)
uniform float u_opacity; // Added opacity uniform

varying vec3 vWorldPosition;
varying float vHeightRatio;

void main() {
    // Fade factor: 1 = opaque (at max height), 0 = transparent (at min height)
    float fadeFactor = smoothstep(minFadeHeight, maxFadeHeight, vWorldPosition.y);

    // The color should just be the base color
    vec3 finalColor = baseColor;

    // Multiply final alpha by the opacity uniform
    // The final alpha is the height fade factor multiplied by the global opacity
    gl_FragColor = vec4(finalColor, fadeFactor * u_opacity);
} 