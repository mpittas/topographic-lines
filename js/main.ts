import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { config, baseConfig, randomRanges, updateDerivedConfig, baseContourColor as configBaseContourColor, fadeToBgColor as configFadeToBgColor, Styles } from './config.js';
import { generateTerrain, generateContourLines, createTerrainBorder, randomizeTerrainSettings } from './terrain.js';
import { initScene, updateFog, updateControls, disposeScene, camera as sceneCamera } from './scene.js';
import { setupGUI, updateGUI } from './gui.js';

let scene: THREE.Scene;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let terrainMesh: THREE.Mesh | null;
let terrainBorder: THREE.Line | null;
let contourLinesGroup: THREE.Group;

let baseContourColor = new THREE.Color(config.contourColor);
let fadeToBgColor = new THREE.Color(config.backgroundColor);

// Initializes Three.js scene, terrain and GUI controls
function init(): void {
    const sceneElements = initScene(document.body);
    scene = sceneElements.scene;
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
        updateFadingLinesFogUniforms,
        contourLinesGroup
    );

    animate();
}

// Regenerates terrain and updates all visual elements
function updateVisualization(shouldRandomize: boolean = false, updateStyleOnly: boolean = false): void {
    console.log(`Updating visualization... (Randomize: ${shouldRandomize}, Style Only: ${updateStyleOnly})`);

    // --- Terrain Data Generation ---
    if (!updateStyleOnly) {
        // Only regenerate terrain geometry if updateStyleOnly is false
        if (shouldRandomize) {
            randomizeTerrainSettings();
            // Sync baseConfig with randomized values for GUI display
            baseConfig.terrainMaxHeight = config.terrainMaxHeight;
            baseConfig.noiseScale = config.noiseScale;
            baseConfig.minTerrainHeightFactor = config.minTerrainHeightFactor;
            baseConfig.contourInterval = config.contourInterval; // Keep interval sync? Might not be needed if not randomized here.
        } else {
            // Update config from GUI if not randomizing
            config.terrainMaxHeight = baseConfig.terrainMaxHeight;
            config.noiseScale = baseConfig.noiseScale;
            config.minTerrainHeightFactor = baseConfig.minTerrainHeightFactor;
             // config.contourInterval = baseConfig.contourInterval; // Interval is handled separately now
        }

        updateDerivedConfig();

        // Regenerate terrain mesh
        const newTerrainMesh = generateTerrain(); // This uses config values
        // Remove old mesh if it exists
        if (terrainMesh && terrainMesh.parent) {
            scene.remove(terrainMesh);
            // Ensure geometry and material are disposed if replaced
            terrainMesh.geometry.dispose();
            (terrainMesh.material as THREE.Material).dispose();
        }
        terrainMesh = newTerrainMesh;
        // Add the new mesh to the scene
        if (terrainMesh && !terrainMesh.parent && scene) {
            scene.add(terrainMesh);
        }

        // Also update the terrain border if geometry changed
        terrainBorder = createTerrainBorder(scene);

    } else {
        // If only updating style, ensure config reflects GUI changes for contours/style
        // updateDerivedConfig(); // Might be needed if contour interval affects derived values
        // We don't regenerate terrainMesh geometry here.
    }


    // --- Visual Representation Update (Contours, Materials) ---
    // Always regenerate contours based on the CURRENT terrainMesh geometry
    if (terrainMesh && terrainMesh.geometry) {
        // Update material/visibility of the main terrain mesh based on style
        if (config.style === Styles.FILLED_MOUNTAIN) {
             if (!(terrainMesh.material instanceof THREE.MeshBasicMaterial)) {
                 // Dispose old material if different type
                 if (terrainMesh.material) (terrainMesh.material as THREE.Material).dispose();
                 terrainMesh.material = new THREE.MeshBasicMaterial({
                     color: config.contourColor, // Use contour color for filled style
                     transparent: true,
                     opacity: config.fillOpacity, // Use config value
                 });
             } else {
                 // Just update color and transparency if already correct material type
                 const material = terrainMesh.material as THREE.MeshBasicMaterial;
                 material.color.set(config.contourColor);
                 material.transparent = true;
                 material.opacity = config.fillOpacity; // Use config value
             }
             terrainMesh.visible = true;
        } else {
            terrainMesh.visible = false; // Hide mesh for line-based styles
            // Dispose mesh material if not needed? Optional optimization.
            // if (terrainMesh.material) (terrainMesh.material as THREE.Material).dispose();
            // terrainMesh.material = new THREE.MeshBasicMaterial({ visible: false }); // Or simply hide
        }


        // Apply color changes from GUI *before* regenerating contours/materials
        // so the generators receive the correct base colors.
        handleContourColorChange(config.contourColor);
        handleBackgroundColorChange(config.backgroundColor);

        // Regenerate contour lines based on current geometry and style
        const newContourGroup = generateContourLines(
            terrainMesh!.geometry,
            baseContourColor,      // Pass current color
            config.lineOpacity,    // Pass line opacity
            config.style           // Pass current style
        );
        if (contourLinesGroup && contourLinesGroup.parent) {
            scene.remove(contourLinesGroup);
            // Potentially dispose old contour geometries/materials here if needed
             if (contourLinesGroup.userData.sharedMaterial) {
                 (contourLinesGroup.userData.sharedMaterial as THREE.Material).dispose();
             }
             contourLinesGroup.children.forEach(child => {
                 if ((child as THREE.LineSegments).geometry) {
                     (child as THREE.LineSegments).geometry.dispose();
                 }
             });
        }
        contourLinesGroup = newContourGroup;
        if (contourLinesGroup && !contourLinesGroup.parent && scene) {
            scene.add(contourLinesGroup);
             // Lines are now always visible regardless of style
             contourLinesGroup.visible = true;
        }

    } else {
         console.warn("Cannot update visuals: terrainMesh or geometry missing.");
     }


    // --- Scene Updates ---
    // updateFog(); // Fog color updated in handleBackgroundColorChange
    updateControls(); // Camera controls don't depend on terrain data

    // --- Ensure Fog Uniforms Correct After Potential Style Change ---
    updateFog(); // Ensure scene fog is correct
    updateFadingLinesFogUniforms(); // Ensure shader uniforms are correct

    // --- GUI Update ---
    updateGUI(); // Refresh GUI to show potentially randomized/updated values

    console.log("Update complete.");
}

// Exports current view to PNG with transparent background
function exportToPNG(): void {
    if (!scene || !sceneCamera || !renderer) return;
    const originalBackground = scene.background;
    scene.background = null;
    renderer.render(scene, sceneCamera);

    const dataURL = renderer.domElement.toDataURL('image/png');

    scene.background = originalBackground;
    renderer.render(scene, sceneCamera);

    const link = document.createElement('a');
    link.download = 'topographic-export.png';
    link.href = dataURL;
    link.click();
}

// Main animation loop
function animate(): void {
    requestAnimationFrame(animate);

    if (controls && controls.enabled && (config.enableRotate || config.enableVerticalRotate || config.enableZoom)) {
         controls.update();
    }

    if (contourLinesGroup && sceneCamera) {
        // Update uniforms for FADING_LINES shader
        if (config.style === Styles.FADING_LINES &&
            contourLinesGroup.userData.sharedMaterial instanceof THREE.ShaderMaterial) {
            const shaderMaterial = contourLinesGroup.userData.sharedMaterial;
        }

        // Visibility check for LINES_ONLY (remains the same)
        if (config.style === Styles.LINES_ONLY &&
            contourLinesGroup.userData.sharedMaterial instanceof THREE.LineBasicMaterial &&
            contourLinesGroup.userData.sharedMaterial.vertexColors) {
             if (!contourLinesGroup.visible) contourLinesGroup.visible = true;
        }
    }

    if (renderer && scene && sceneCamera) {
        renderer.render(scene, sceneCamera);
    }
}

function handleContourColorChange(value: string): void {
    baseContourColor.set(value);
    // Update shader uniform if applicable
    if (config.style === Styles.FADING_LINES && contourLinesGroup && contourLinesGroup.userData.sharedMaterial instanceof THREE.ShaderMaterial) {
        const shaderMaterial = contourLinesGroup.userData.sharedMaterial;
        if (shaderMaterial.uniforms.baseColor) {
            shaderMaterial.uniforms.baseColor.value = baseContourColor;
        }
    }
}

function handleBackgroundColorChange(value: string): void {
    fadeToBgColor.set(value);
    if (scene) scene.background = fadeToBgColor;
    updateFog(); // Update scene fog color
    updateFadingLinesFogUniforms(); // Update shader fog color uniform
}

// Updates relevant uniforms for the Fading Lines shader
export function updateFadingLinesFogUniforms(): void {
    if (config.style === Styles.FADING_LINES && contourLinesGroup && contourLinesGroup.userData.sharedMaterial instanceof THREE.ShaderMaterial) {
        const shaderMaterial = contourLinesGroup.userData.sharedMaterial;

        // Update fog color uniform
        if (shaderMaterial.uniforms.u_fogColor) {
            shaderMaterial.uniforms.u_fogColor.value.set(config.backgroundColor);
        }

        // Update edge fade intensity uniform
        if (shaderMaterial.uniforms.u_edgeFadeIntensity) {
            shaderMaterial.uniforms.u_edgeFadeIntensity.value = config.fogIntensity;
        }

        // Update terrain half size uniform (in case terrain size changes)
        if (shaderMaterial.uniforms.u_terrainHalfSize) {
            shaderMaterial.uniforms.u_terrainHalfSize.value = config.terrainSize / 2.0;
        }
    }
}

document.addEventListener('DOMContentLoaded', init);
// Remove listener on dispose (optional but good practice)
function cleanup(): void {
    disposeScene();
}
window.addEventListener('beforeunload', cleanup);