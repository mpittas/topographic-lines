import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { config, baseConfig, randomRanges, updateDerivedConfig, baseContourColor as configBaseContourColor, fadeToBgColor as configFadeToBgColor } from './config';
import { generateTerrain, generateContourLines, createTerrainBorder, randomizeTerrainSettings } from './terrain';
import { initScene, updateFog, updateControls, disposeScene } from './scene';
import { setupGUI, updateGUI } from './gui';

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let terrainMesh: THREE.Mesh | null;
let terrainBorder: THREE.Line | null;
let contourLinesGroup: THREE.Group;

let baseContourColor = new THREE.Color(config.contourColor);
let fadeToBgColor = new THREE.Color(config.backgroundColor);

function init(): void {
    const sceneElements = initScene(document.body);
    scene = sceneElements.scene;
    camera = sceneElements.camera;
    renderer = sceneElements.renderer;
    controls = sceneElements.controls;

    updateVisualization();

    const infoElement = document.getElementById('info');
    if (infoElement) infoElement.style.display = 'none';

    setupGUI(
        updateVisualization,
        exportToPNG,
        () => terrainBorder,
        handleContourColorChange,
        handleBackgroundColorChange,
        contourLinesGroup
    );

    animate();
}

function updateVisualization(shouldRandomize: boolean = false): void {
    console.log(`Updating visualization... (Randomize: ${shouldRandomize})`);

    if (shouldRandomize) {
        randomizeTerrainSettings();

        baseConfig.terrainMaxHeight = config.terrainMaxHeight;
        baseConfig.noiseScale = config.noiseScale;
        baseConfig.minTerrainHeightFactor = config.minTerrainHeightFactor;
        baseConfig.contourInterval = config.contourInterval;
    } else {
        config.terrainMaxHeight = baseConfig.terrainMaxHeight;
        config.noiseScale = baseConfig.noiseScale;
        config.minTerrainHeightFactor = baseConfig.minTerrainHeightFactor;
    }

    updateDerivedConfig();

    terrainMesh = generateTerrain();
    if (terrainMesh && !terrainMesh.parent && scene) {
    }

    const newContourGroup = generateContourLines(terrainMesh!.geometry, baseContourColor);
    if (contourLinesGroup && contourLinesGroup.parent) {
        scene.remove(contourLinesGroup);
    }
    contourLinesGroup = newContourGroup;
    if (contourLinesGroup && !contourLinesGroup.parent && scene) {
        scene.add(contourLinesGroup);
    }

    terrainBorder = createTerrainBorder(scene);

    updateFog();
    updateControls();

    updateGUI();

    console.log("Update complete.");
}

function exportToPNG(): void {
    if (!scene || !camera || !renderer) return;
    const originalBackground = scene.background;
    scene.background = null;
    renderer.render(scene, camera);

    const dataURL = renderer.domElement.toDataURL('image/png');

    scene.background = originalBackground;
    renderer.render(scene, camera);

    const link = document.createElement('a');
    link.download = 'topographic-export.png';
    link.href = dataURL;
    link.click();
}

const tempVec3 = new THREE.Vector3();
const tempColor = new THREE.Color();

function animate(): void {
    requestAnimationFrame(animate);

    if (controls && controls.enabled && (config.enableRotate || config.enableVerticalRotate || config.enableZoom)) {
         controls.update();
    }

    if (contourLinesGroup && camera) {
        const cameraPosition = camera.position;
        contourLinesGroup.children.forEach((line: THREE.Object3D) => {
            if (!((line as THREE.LineSegments).geometry) || !((line as THREE.LineSegments).geometry.attributes.position) || !((line as THREE.LineSegments).geometry.attributes.color)) return;
            line.visible = true;
            const geometry = (line as THREE.LineSegments).geometry;
            const positions = geometry.attributes.position.array as Float32Array;
            const colors = geometry.attributes.color.array as Float32Array;
            let colorsNeedUpdate = false;

            const intensity = config.fogIntensity;
            let applyFade = false;
            let near = 0, far = 0, currentFadeRange = 1;

            if (intensity > 0) {
                applyFade = true;
                const minDistance = config.minFadeDistance;
                const maxDistance = config.maxFadeDistance;
                const range = maxDistance - minDistance;
                near = maxDistance - range * intensity;
                far = maxDistance + range * (1 - intensity) * 1.5;
                currentFadeRange = Math.max(1.0, far - near);
            }

            for (let i = 0; i < positions.length; i += 3) {
                tempVec3.set(positions[i], positions[i + 1], positions[i + 2]);

                if (applyFade) {
                    const distance = tempVec3.distanceTo(cameraPosition);
                    const fadeFactor = Math.min(Math.max((distance - near) / currentFadeRange, 0), 1);
                    tempColor.copy(baseContourColor).lerp(fadeToBgColor, fadeFactor);
                } else {
                    tempColor.copy(baseContourColor);
                }

                const threshold = 0.005;
                if (Math.abs(colors[i] - tempColor.r) > threshold || Math.abs(colors[i + 1] - tempColor.g) > threshold || Math.abs(colors[i + 2] - tempColor.b) > threshold) {
                    colors[i] = tempColor.r; colors[i + 1] = tempColor.g; colors[i + 2] = tempColor.b;
                    colorsNeedUpdate = true;
                }
            }
            if (colorsNeedUpdate) geometry.attributes.color.needsUpdate = true;
        });
    }

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

function handleContourColorChange(value: string): void {
    baseContourColor.set(value);
}

function handleBackgroundColorChange(value: string): void {
    fadeToBgColor.set(value);
    if (scene) scene.background = fadeToBgColor;
    updateFog();
}

init();