import * as THREE from 'three';
import { config, baseConfig } from './config';
import { updateControls, updateFog } from './scene';

declare const dat: any;

let gui: dat.GUI;

export function setupGUI(
    updateVisualizationCallback: (shouldRandomize?: boolean) => void,
    exportCallback: () => void,
    getTerrainBorder: () => THREE.Line | null,
    updateContourColorCallback: (value: string) => void,
    updateBackgroundColorCallback: (value: string) => void,
    contourLinesGroup: THREE.Group
): dat.GUI {
    if (gui) gui.destroy();
    gui = new dat.GUI();

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
    const contoursFolder = gui.addFolder('Contours');
    contoursFolder.add(config, 'contourInterval', 1, 50, 1).name('Interval')
        .onChange(() => { if (contourLinesGroup) contourLinesGroup.visible = false; })
        .onFinishChange(() => {
            updateVisualizationCallback(false);
            if (contourLinesGroup) contourLinesGroup.visible = true;
        });
    contoursFolder.addColor(config, 'contourColor').name('Line Color').onFinishChange(updateContourColorCallback);
    contoursFolder.addColor(config, 'backgroundColor').name('Background').onFinishChange(updateBackgroundColorCallback);
    contoursFolder.open();
    const fogFolder = gui.addFolder('Fog');
    fogFolder.add(config, 'fogIntensity', 0, 1, 0.01).name('Intensity')
        .onFinishChange(updateFog);
    fogFolder.open();

    const cameraFolder = gui.addFolder('Camera Controls');
    cameraFolder.add(config, 'enableZoom').name('Enable Zoom').onChange(updateControls);
    cameraFolder.add(config, 'enableRotate').name('Enable Horiz Rotate').onChange(updateControls);
    cameraFolder.add(config, 'enableVerticalRotate').name('Enable Vert Rotate').onChange(updateControls);
    cameraFolder.add(config, 'fixedVerticalAngle', Math.PI / 5, Math.PI / 3, 0.01)
        .name('Vertical Angle')
        .listen()
        .onChange(() => {
            if (!config.enableVerticalRotate) {
                updateControls();
            }
        });

    const debugFolder = gui.addFolder('Debugging');
    debugFolder.add(config, 'showTerrainBorder').name('Show Border').onChange((value: boolean) => {
        const border = getTerrainBorder();
        if (border) border.visible = value;
    });

    gui.add({ generate: () => updateVisualizationCallback(true) }, 'generate').name('Generate New Terrain');

    gui.add({ export: exportCallback }, 'export').name('Export PNG');

    return gui;
}

export function updateGUI(): void {
    if (gui) {
        for (const folderName in gui.__folders) {
            const folder = gui.__folders[folderName];
            folder.__controllers.forEach((controller: any) => controller.updateDisplay());
        }
         gui.__controllers.forEach((controller: any) => controller.updateDisplay());
    }
}