import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; // Added import for OrbitControls
import { config, baseConfig, randomRanges, updateDerivedConfig, baseContourColor as configBaseContourColor, fadeToBgColor as configFadeToBgColor } from './config';
import { generateTerrain, generateContourLines, createTerrainBorder, randomizeTerrainSettings } from './terrain';
import { initScene, updateFog, updateControls, disposeScene } from './scene';
import { setupGUI, updateGUI } from './gui';

// --- Global Variables (Module Scope) ---
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let terrainMesh: THREE.Mesh | null;
let terrainBorder: THREE.Line | null;
let contourLinesGroup: THREE.Group;

// --- Color Management ---
// Use the exported variables from config.js but manage the THREE.Color instances here
let baseContourColor = new THREE.Color(config.contourColor);
let fadeToBgColor = new THREE.Color(config.backgroundColor);

// --- Initialization ---
function init(): void {
    // Initialize Scene, Camera, Renderer, Controls
    const sceneElements = initScene(document.body); // Pass body as container
    scene = sceneElements.scene;
    camera = sceneElements.camera;
    renderer = sceneElements.renderer;
    controls = sceneElements.controls;

    // Initial Generation (with initial randomization)
    updateVisualization(); // This now handles randomization, terrain, contours, border

    // Hide info message after initial load
    const infoElement = document.getElementById('info');
    if (infoElement) infoElement.style.display = 'none';

    // Setup dat.GUI, passing necessary callbacks and getters
    setupGUI(
        updateVisualization, // Callback for generating new terrain
        exportToPNG,         // Callback for exporting
        () => terrainBorder,  // Getter function for the terrain border object
        handleContourColorChange, // Callback for contour color changes
        handleBackgroundColorChange, // Callback for background color changes
        contourLinesGroup // Pass the contourLinesGroup
    );

    // Start Animation Loop
    animate();
}

// --- Update Visualization ---
// This function is called by GUI buttons/controls or initially
function updateVisualization(): void {
    console.log("Updating visualization...");

    // 1. Randomize Settings (modifies the config object)
    randomizeTerrainSettings();

    // 2. Update derived config values based on potentially randomized config
    updateDerivedConfig(); // Update fadeRange etc.
    // Color updates are now handled by specific callbacks from GUI

    // 3. Regenerate Terrain Mesh
    terrainMesh = generateTerrain(); // Returns the mesh, stored in module scope
    if (terrainMesh && !terrainMesh.parent && scene) { // Add to scene if not already added
       // scene.add(terrainMesh); // Usually not needed as it's invisible
    }


    // 4. Regenerate Contour Lines
    // Pass the necessary geometry and the *current* baseContourColor THREE.Color object
    const newContourGroup = generateContourLines(terrainMesh!.geometry, baseContourColor);
    if (contourLinesGroup && contourLinesGroup.parent) {
        scene.remove(contourLinesGroup); // Remove old group
    }
    contourLinesGroup = newContourGroup; // Store the new group
    if (contourLinesGroup && !contourLinesGroup.parent && scene) {
        scene.add(contourLinesGroup); // Add new group to scene
    }


    // 5. Recreate or Update Terrain Border
    // Pass the scene so the border can be added/removed correctly
    terrainBorder = createTerrainBorder(scene); // Returns the border, stored in module scope

    // 6. Update Scene Elements (Fog, Controls) based on potentially changed config
    updateFog();
    updateControls();

    // 7. Update GUI display to reflect randomized values (optional but good practice)
    updateGUI();

    console.log("Update complete.");
}


// --- Export Function ---
function exportToPNG(): void {
    if (!scene || !camera || !renderer) return;
    const originalBackground = scene.background;
    scene.background = null; // Set background to transparent for export
    renderer.render(scene, camera); // Render one frame

    const dataURL = renderer.domElement.toDataURL('image/png'); // Get data URL

    scene.background = originalBackground; // Restore background
    renderer.render(scene, camera); // Render again for display consistency

    // Trigger download
    const link = document.createElement('a');
    link.download = 'topographic-export.png';
    link.href = dataURL;
    link.click();
}


// --- Animation Loop ---
const tempVec3 = new THREE.Vector3();
const tempColor = new THREE.Color();

function animate(): void {
    requestAnimationFrame(animate);

    // Update controls if enabled
    if (controls && controls.enabled && (config.enableRotate || config.enableVerticalRotate || config.enableZoom)) {
         controls.update();
    }

    // Update contour line colors based on distance (fading)
    if (contourLinesGroup && camera) {
        const cameraPosition = camera.position;
        // Use the dynamically updated fadeRange from config module (or recalculate here)
        const currentFadeRange = Math.max(1.0, config.maxFadeDistance - config.minFadeDistance);

        contourLinesGroup.children.forEach((line: THREE.Object3D) => {
            if (!((line as THREE.LineSegments).geometry) || !((line as THREE.LineSegments).geometry.attributes.position) || !((line as THREE.LineSegments).geometry.attributes.color)) return;
            line.visible = true; // Ensure lines are visible
            const geometry = (line as THREE.LineSegments).geometry;
            const positions = geometry.attributes.position.array as Float32Array;
            const colors = geometry.attributes.color.array as Float32Array;
            let colorsNeedUpdate = false;

            for (let i = 0; i < positions.length; i += 3) {
                tempVec3.set(positions[i], positions[i + 1], positions[i + 2]);
                const distance = tempVec3.distanceTo(cameraPosition);

                // Calculate fade factor using current config values
                const fadeFactor = Math.min(Math.max((distance - config.minFadeDistance) / currentFadeRange, 0), 1);

                // Lerp between the *current* baseContourColor and fadeToBgColor
                tempColor.copy(baseContourColor).lerp(fadeToBgColor, fadeFactor);

                // Check if color update is needed (with a small threshold)
                const threshold = 0.005;
                if (Math.abs(colors[i] - tempColor.r) > threshold || Math.abs(colors[i + 1] - tempColor.g) > threshold || Math.abs(colors[i + 2] - tempColor.b) > threshold) {
                    colors[i] = tempColor.r; colors[i + 1] = tempColor.g; colors[i + 2] = tempColor.b;
                    colorsNeedUpdate = true;
                }
            }
            // Mark colors attribute for update if any color changed
            if (colorsNeedUpdate) geometry.attributes.color.needsUpdate = true;
        });
    }

    // Render the scene
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

// --- Handle Color Changes from GUI ---
function handleContourColorChange(value: string): void {
    // Update the THREE.Color object used in the animation loop
    baseContourColor.set(value);
    // The animation loop will pick up this change and update vertex colors
}

function handleBackgroundColorChange(value: string): void {
    // Update the THREE.Color object used in the animation loop
    fadeToBgColor.set(value);
    // Update the scene background immediately
    if (scene) scene.background = fadeToBgColor;
    // Update fog color to match background
    updateFog();
}


// --- Start ---
init();

// Optional: Add cleanup logic if needed (e.g., for hot module replacement)
// window.addEventListener('beforeunload', () => {
//     disposeScene();
//     if (gui) gui.destroy();
//     // Dispose terrain/contour resources if necessary
// });