import * as THREE from 'three'; // Needed for THREE.Color updates
import { config, baseConfig } from './config'; // Changed import path to .ts
import { updateControls, updateFog } from './scene'; // Changed import path to .ts

// Declare dat globally for TypeScript
declare const dat: any;

let gui: dat.GUI;

// --- Setup dat.GUI ---
// Takes callbacks for actions that involve multiple modules (terrain generation, export)
export function setupGUI(
    updateVisualizationCallback: (shouldRandomize?: boolean) => void, // Update type definition
    exportCallback: () => void,
    getTerrainBorder: () => THREE.Line | null,
    updateContourColorCallback: (value: string) => void,
    updateBackgroundColorCallback: (value: string) => void, // Add comma here
    contourLinesGroup: THREE.Group // Add this parameter
): dat.GUI { // Add contourLinesGroup parameter
    if (gui) gui.destroy(); // Destroy previous GUI if exists
    gui = new dat.GUI();

    // Add onChange handlers to hide contours during drag

// Terrain Folder - Controls BASE values for randomization center point
    const terrainFolder = gui.addFolder('Terrain Shape');
    terrainFolder.add(baseConfig, 'terrainMaxHeight', 20, 300, 5).name('Height')
        .onChange(() => { if (contourLinesGroup) contourLinesGroup.visible = false; }) // Hide on drag
        .onFinishChange(() => {
            updateVisualizationCallback(false); // Don't randomize on slider change
            if (contourLinesGroup) contourLinesGroup.visible = true; // Show on finish
        });
    terrainFolder.add(baseConfig, 'noiseScale', 70, 200, 10).name('Feature Size')
        .onChange(() => { if (contourLinesGroup) contourLinesGroup.visible = false; }) // Hide on drag
        .onFinishChange(() => {
            updateVisualizationCallback(false); // Don't randomize on slider change
            if (contourLinesGroup) contourLinesGroup.visible = true; // Show on finish
        });
    // Add Plateau Volume slider
    terrainFolder.add(config, 'plateauVolume', 0.0, 1.0, 0.01).name('Plateau Volume')
        .onChange(() => { if (contourLinesGroup) contourLinesGroup.visible = false; }) // Hide on drag
        .onFinishChange(() => {
            updateVisualizationCallback(false); // Don't randomize on slider change
            if (contourLinesGroup) contourLinesGroup.visible = true; // Show on finish
        });
    terrainFolder.open();
// Contours Folder
    const contoursFolder = gui.addFolder('Contours');
    // Use onFinishChange for interval to avoid regenerating on every drag increment
    contoursFolder.add(config, 'contourInterval', 1, 50, 1).name('Interval')
        .onChange(() => { if (contourLinesGroup) contourLinesGroup.visible = false; }) // Hide on drag
        .onFinishChange(() => {
            updateVisualizationCallback(false); // Don't randomize on slider change
            if (contourLinesGroup) contourLinesGroup.visible = true; // Show on finish
        });
    contoursFolder.addColor(config, 'contourColor').name('Line Color').onFinishChange(updateContourColorCallback); // Use onFinishChange
    contoursFolder.addColor(config, 'backgroundColor').name('Background').onFinishChange(updateBackgroundColorCallback); // Use onFinishChange
    contoursFolder.open();
// Fog Folder
    const fogFolder = gui.addFolder('Fog');
    fogFolder.add(config, 'fogIntensity', 0, 1, 0.01).name('Intensity')
        .onFinishChange(updateFog); // Call updateFog when slider changes
    fogFolder.open();

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
    debugFolder.add(config, 'showTerrainBorder').name('Show Border').onChange((value: boolean) => {
        const border = getTerrainBorder(); // Get the border object from main
        if (border) border.visible = value;
    });
    // debugFolder.open(); // Keep closed by default

    // Generate New Terrain Button
    // Pass the main update function directly
    gui.add({ generate: () => updateVisualizationCallback(true) }, 'generate').name('Generate New Terrain'); // Randomize on button click

    // Export Button
    // Pass the main export function directly
    gui.add({ export: exportCallback }, 'export').name('Export PNG');

    return gui; // Return the gui instance if needed elsewhere
}

// Optional: Function to update GUI display if config is changed programmatically
export function updateGUI(): void {
    if (gui) {
        // Iterate over controllers and update their display value
        for (const folderName in gui.__folders) {
            const folder = gui.__folders[folderName];
            folder.__controllers.forEach((controller: any) => controller.updateDisplay());
        }
        // Update top-level controllers if any
         gui.__controllers.forEach((controller: any) => controller.updateDisplay());
    }
}