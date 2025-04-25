// shaders/lineFadeVertex.glsl

uniform float minFadeHeight;
uniform float maxFadeHeight;

varying vec3 vWorldPosition;
varying float vHeightRatio;

void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vHeightRatio = smoothstep(minFadeHeight, maxFadeHeight, vWorldPosition.y);

    gl_Position = projectionMatrix * viewMatrix * worldPosition;
} 