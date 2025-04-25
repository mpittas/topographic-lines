import * as THREE from 'three'; // Needed for THREE.Color updates
import { config, baseConfig } from './config.js';
import { updateControls, updateFog } from './scene.js'; // Import scene-specific updates

let gui;

// --- Setup dat.GUI ---
// Takes callbacks for actions that involve multiple modules (terrain generation, export)
export function setupGUI(updateVisualizationCallback, exportCallback, getTerrainBorder, updateContourColorCallback, updateBackgroundColorCallback) {
    if (gui) gui.destroy(); // Destroy previous GUI if exists
    gui = new dat.GUI();

    // Terrain Folder - Controls BASE values for randomization center point
    const terrainFolder = gui.addFolder('Terrain Shape');
    terrainFolder.add(baseConfig, 'terrainMaxHeight', 10, 300, 5).name('Base Max Height').onFinishChange(updateVisualizationCallback);
    terrainFolder.add(baseConfig, 'noiseScale', 10, 500, 10).name('Base Feature Scale').onFinishChange(updateVisualizationCallback);
    terrainFolder.add(baseConfig, 'minTerrainHeightFactor', 0, 0.5, 0.01).name('Base Min Height Factor').onFinishChange(updateVisualizationCallback);
    terrainFolder.open();

    // Contours Folder
    const contoursFolder = gui.addFolder('Contours');
    // Use onFinishChange for interval to avoid regenerating on every drag increment
    contoursFolder.add(config, 'contourInterval', 1, 50, 1).name('Interval').onFinishChange(updateVisualizationCallback);
    contoursFolder.addColor(config, 'contourColor').name('Line Color').onChange(updateContourColorCallback);
    contoursFolder.addColor(config, 'backgroundColor').name('Background').onChange(updateBackgroundColorCallback);
    contoursFolder.open();

    // --- Fading Folder REMOVED ---

    // Camera Folder
    const cameraFolder = gui.addFolder('Camera Controls');
    // Zoom limits are fixed, controls removed
    cameraFolder.add(config, 'enableZoom').name('Enable Zoom').onChange(updateControls);
    cameraFolder.add(config, 'enableRotate').name('Enable Horiz Rotate').onChange(updateControls);
    cameraFolder.add(config, 'enableVerticalRotate').name('Enable Vert Rotate').onChange(updateControls);
    // Allow changing the fixed vertical angle if vertical rotation is disabled
    cameraFolder.add(config, 'fixedVerticalAngle', Math.PI / 5, Math.PI / 3, 0.01)
        .name('Vertical Angle')
        .listen() // Listen for changes if enableVerticalRotate is false
        .onChange(() => {
            if (!config.enableVerticalRotate) {
                updateControls(); // Apply the change only if vertical rotation is off
            }
        });
    // cameraFolder.open(); // Keep closed by default

    // Debug Folder
    const debugFolder = gui.addFolder('Debugging');
    debugFolder.add(config, 'showTerrainBorder').name('Show Border').onChange((value) => {
        const border = getTerrainBorder(); // Get the border object from main
        if (border) border.visible = value;
    });
    // debugFolder.open(); // Keep closed by default

    // Generate New Terrain Button
    // Pass the main update function directly
    gui.add({ generate: updateVisualizationCallback }, 'generate').name('Generate New Terrain');

    // Export Button
    // Pass the main export function directly
    gui.add({ export: exportCallback }, 'export').name('Export PNG');

    return gui; // Return the gui instance if needed elsewhere
}

// Optional: Function to update GUI display if config is changed programmatically
export function updateGUI() {
    if (gui) {
        // Iterate over controllers and update their display value
        for (const folderName in gui.__folders) {
            const folder = gui.__folders[folderName];
            folder.__controllers.forEach(controller => controller.updateDisplay());
        }
        // Update top-level controllers if any
         gui.__controllers.forEach(controller => controller.updateDisplay());
    }
}