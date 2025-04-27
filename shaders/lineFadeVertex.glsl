// shaders/lineFadeVertex.glsl

uniform float minFadeHeight;
uniform float maxFadeHeight;
uniform vec3 u_hoverPoint; // World coordinates of hover point
uniform float u_time;      // Time for animation

varying vec3 vWorldPosition;
varying float vHeightRatio;

// Constants for hover effect
const float HOVER_RADIUS = 150.0;   // Radius of the hover effect
const float HOVER_AMPLITUDE = 4.5; // Max vertical displacement
const float HOVER_SPEED = 1.0;     // Speed of the wiggle animation
const float HOVER_FREQUENCY = 0.2; // Spatial frequency of the wiggle

void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vHeightRatio = smoothstep(minFadeHeight, maxFadeHeight, vWorldPosition.y);

    // --- Hover Effect --- 
    // Calculate distance to hover point in XZ plane
    float distToHoverXZ = length(vWorldPosition.xz - u_hoverPoint.xz);
    
    // Calculate effect strength (1 at center, 0 at radius)
    float hoverEffectStrength = smoothstep(HOVER_RADIUS, 0.0, distToHoverXZ);
    hoverEffectStrength = clamp(hoverEffectStrength, 0.0, 1.0);

    // Calculate vertical offset based on time and distance
    float hoverOffset = sin(distToHoverXZ * HOVER_FREQUENCY + u_time * HOVER_SPEED) 
                      * HOVER_AMPLITUDE 
                      * hoverEffectStrength;

    // Apply the offset to the world position
    worldPosition.y += hoverOffset;
    // Update varying for fragment shader if it uses world position y
    vWorldPosition.y += hoverOffset; 

    // Standard projection
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
} 