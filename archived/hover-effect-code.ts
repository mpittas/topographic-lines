// Archived hover effect code from js/main.ts
// Note: This code requires THREE to be imported and assumes certain variables
// like renderer, sceneCamera, terrainMesh, config, Styles, contourLinesGroup exist.

import * as THREE from 'three'; // Assuming THREE is needed

// --- Declare missing types/variables (replace with actual imports/declarations if used) ---
declare const renderer: THREE.WebGLRenderer;
declare const sceneCamera: THREE.Camera;
declare const terrainMesh: THREE.Mesh | null;
declare const config: any; // Replace 'any' with actual config type if available
declare const Styles: any; // Replace 'any' with actual Styles type if available
declare const contourLinesGroup: THREE.Group;
// ---

// --- Hover Effect Variables ---
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(); // Normalized device coordinates (-1 to +1)
let hoverPoint = new THREE.Vector3(0, -9999, 0); // World coordinates of hover intersection, default far away
// let lastHoverPoint = new THREE.Vector3().copy(hoverPoint); // Potentially unused
const hoverLerpFactor = 0.1; // Smoothing factor for hover point movement

// --- Temp Variables (might be used elsewhere too) ---
// const tempVec3 = new THREE.Vector3();
// const tempColor = new THREE.Color();


// --- Add Event Listeners (originally in init()) ---
/*
if (renderer) { // Ensure renderer is initialized
    renderer.domElement.addEventListener('mousemove', onMouseMove, false);
    renderer.domElement.addEventListener('mouseleave', onMouseLeave, false);
}
*/

// --- Mouse Event Handlers ---
function onMouseMove(event: MouseEvent): void {
    // This assumes 'window' is available
    // Calculate mouse position in normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function onMouseLeave(): void {
    // Reset hover point gradually when mouse leaves
    // The target point might need adjustment based on desired 'off' state
    hoverPoint.set(0, -9999, 0);
}

// --- Update Logic (originally in animate()) ---
function updateHoverEffect(elapsedTime: number): void {
    // Assumes sceneCamera and terrainMesh are accessible
    if (sceneCamera && terrainMesh) {
        raycaster.setFromCamera(mouse, sceneCamera);
        const intersects = raycaster.intersectObject(terrainMesh);

        if (intersects.length > 0) {
            // Smoothly interpolate to the new hover point
            hoverPoint.lerp(intersects[0].point, hoverLerpFactor);
        } else {
             // Smoothly interpolate back to the 'off-screen' position
            hoverPoint.lerp(new THREE.Vector3(0, -9999, 0), hoverLerpFactor * 0.5); // Slower return
        }
    }

    // Update uniforms for FADING_LINES shader
    // Assumes contourLinesGroup, config, Styles are accessible
    if (contourLinesGroup && sceneCamera) {
        if (config.style === Styles.FADING_LINES &&
            contourLinesGroup.userData.sharedMaterial instanceof THREE.ShaderMaterial) {
            const shaderMaterial = contourLinesGroup.userData.sharedMaterial;
            // Check if uniforms exist before updating
            if (shaderMaterial.uniforms.u_hoverPoint) {
                shaderMaterial.uniforms.u_hoverPoint.value.copy(hoverPoint);
            }
            if (shaderMaterial.uniforms.u_time) {
                shaderMaterial.uniforms.u_time.value = elapsedTime;
            }
        }
    }
}

// --- Cleanup Logic (originally in cleanup()) ---
function removeHoverListeners(): void {
    // Assumes renderer is accessible
    if (renderer) {
        try {
             renderer.domElement.removeEventListener('mousemove', onMouseMove);
             renderer.domElement.removeEventListener('mouseleave', onMouseLeave);
        } catch (e) {
            console.error("Error removing hover listeners:", e);
        }
    }
}

// Example usage in animate loop:
/*
function animate(): void {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    // ... other updates (controls etc) ...

    updateHoverEffect(elapsedTime); // Call the hover update logic

    // ... rendering ...
}
*/

// Example usage in main init/cleanup:
/*
function init() {
    // ... other init ...
    // Add listeners after renderer is created
    if (renderer) {
        renderer.domElement.addEventListener('mousemove', onMouseMove, false);
        renderer.domElement.addEventListener('mouseleave', onMouseLeave, false);
    }
    // ...
}

function cleanup() {
    // ... other cleanup ...
    removeHoverListeners();
    // ...
}
window.addEventListener('beforeunload', cleanup); // Or similar cleanup trigger
*/ 