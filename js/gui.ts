import * as THREE from 'three';
import { config, baseConfig, Styles } from './config.js';
import { updateControls, updateFog } from './scene.js';

declare const dat: any;

let gui: dat.GUI;
let fillOpacityController: dat.GUIController;

// Creates dat.GUI interface with controls for terrain, camera and visualization
export function setupGUI(
    updateVisualizationCallback: (shouldRandomize?: boolean, updateStyleOnly?: boolean) => void,
    exportCallback: () => void,
    getTerrainBorder: () => THREE.Line | null,
    updateContourColorCallback: (value: string) => void,
    updateBackgroundColorCallback: (value: string) => void,
    updateFadingLinesFogUniformsCallback: () => void,
    contourLinesGroup: THREE.Group
): dat.GUI {
    if (gui) gui.destroy();
    gui = new dat.GUI();

    // --- Style Folder (Moved to Top) ---
    const styleFolder = gui.addFolder('Style');
    styleFolder.add(config, 'style', Object.values(Styles)).name('Render Style')
        .onFinishChange(() => {
            // Avoid full regeneration, just update style/material
            updateVisualizationCallback(false, true); // Pass flag/call simpler refresh
            // Show/hide opacity controller based on style
            toggleOpacityControllerVisibility();
        });
    styleFolder.open();

    // --- Terrain Shape Folder ---
    const terrainFolder = gui.addFolder('Terrain Shape');
    terrainFolder.add(baseConfig, 'terrainMaxHeight', 20, 300, 5).name('Height')
        .onChange(() => { if (contourLinesGroup) contourLinesGroup.visible = false; })
        .onFinishChange(() => {
            updateVisualizationCallback(false);
            if (contourLinesGroup) contourLinesGroup.visible = true;
        });
    terrainFolder.add(baseConfig, 'noiseScale', 70, 200, 10).name('Feature Size')
        .onChange(() => { if (contourLinesGroup) contourLinesGroup.visible = false; })
        .onFinishChange(() => {
            updateVisualizationCallback(false);
            if (contourLinesGroup) contourLinesGroup.visible = true;
        });
    terrainFolder.add(config, 'plateauVolume', 0.0, 1.0, 0.01).name('Plateau Volume')
        .onChange(() => { if (contourLinesGroup) contourLinesGroup.visible = false; })
        .onFinishChange(() => {
            updateVisualizationCallback(false);
            if (contourLinesGroup) contourLinesGroup.visible = true;
        });
    terrainFolder.open();

    // --- Contours Folder ---
    const contoursFolder = gui.addFolder('Contours');
    contoursFolder.add(config, 'contourInterval', 1, 50, 1).name('Interval')
        .onChange(() => { if (contourLinesGroup) contourLinesGroup.visible = false; })
        .onFinishChange(() => {
            // Only update contours/visuals, don't regenerate terrain
            updateVisualizationCallback(false, true); 
            if (contourLinesGroup) contourLinesGroup.visible = true;
        });
    contoursFolder.addColor(config, 'contourColor').name('Line Color')
        .onFinishChange((value: string) => {
             updateContourColorCallback(value);
             // Also trigger a general refresh to update mesh material if needed
             updateVisualizationCallback(false, true); // Pass flag/call simpler refresh
         });
    contoursFolder.add(config, 'lineOpacity', 0.0, 1.0, 0.01).name('Line Opacity')
        .onFinishChange((value: string) => {
            // Also trigger a general refresh to update mesh material if needed
            updateVisualizationCallback(false, true); // Pass flag/call simpler refresh
        });
    fillOpacityController = contoursFolder.add(config, 'fillOpacity', 0.0, 1.0, 0.01).name('Fill Opacity');
    fillOpacityController.onFinishChange(() => {
        // Only need to update style/material
        updateVisualizationCallback(false, true);
    });

    // Set initial visibility *after* controller is created
    toggleOpacityControllerVisibility();

    contoursFolder.addColor(config, 'backgroundColor').name('Background').onFinishChange(updateBackgroundColorCallback);
    contoursFolder.open();

    // Function to toggle visibility
    function toggleOpacityControllerVisibility() {
        if (fillOpacityController) { // Check if controller exists
            const show = config.style === Styles.FILLED_MOUNTAIN;
            // Access the DOM element to hide/show
            const parentElement = fillOpacityController.domElement.parentElement;
            if (parentElement) {
                parentElement.style.display = show ? '' : 'none';
            }
        }
    }

    const fogFolder = gui.addFolder('Fog');
    fogFolder.add(config, 'fogIntensity', 0, 1, 0.01).name('Intensity')
        .onFinishChange(() => {
            updateFog(); // Update scene fog first
            updateFadingLinesFogUniformsCallback(); // Call the passed callback
        });
    fogFolder.open();

    // --- Camera Controls Folder ---
    const cameraFolder = gui.addFolder('Camera');
    cameraFolder.add(config, 'enableZoom').name('Enable Zoom').onChange(updateControls);
    cameraFolder.add(config, 'enableRotate').name('Enable Rotation').onChange(updateControls);

    const debugFolder = gui.addFolder('Debugging');
    debugFolder.add(config, 'showTerrainBorder').name('Show Border').onChange((value: boolean) => {
        const border = getTerrainBorder();
        if (border) border.visible = value;
    });

    gui.add({ generate: () => updateVisualizationCallback(true) }, 'generate').name('Generate New Terrain');

    gui.add({ export: exportCallback }, 'export').name('Export PNG');

    return gui;
}

// Refreshes all GUI controls to reflect current state
export function updateGUI(): void {
    if (gui) {
        for (const folderName in gui.__folders) {
            const folder = gui.__folders[folderName];
            folder.__controllers.forEach((controller: any) => controller.updateDisplay());
        }
         gui.__controllers.forEach((controller: any) => controller.updateDisplay());

        // Ensure Fill Opacity controller visibility is correct on general GUI update
        // Check within the 'Contours' folder now
        const contoursFolderRef = gui.__folders['Contours'];
        if (contoursFolderRef) {
             const opacityController = contoursFolderRef.__controllers.find((c: any) => c.property === 'fillOpacity');
             if (opacityController) {
                 const show = config.style === Styles.FILLED_MOUNTAIN;
                 const parentElement = opacityController.domElement.parentElement;
                 if (parentElement) {
                     parentElement.style.display = show ? '' : 'none';
                 }
             }
        }
    }
}