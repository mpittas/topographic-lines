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

// --- Color Helper Functions ---

// Converts hex color string (#RRGGBB or #RGB) to {r, g, b} object
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    // Expand shorthand form (e.g. '03F') to full form (e.g. '0033FF')
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
        }
        : null;
}

// Calculates relative luminance from RGB values
function luminance(r: number, g: number, b: number): number {
    const a = [r, g, b].map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

// Calculates WCAG contrast ratio between two RGB colors
function contrastRatio(rgb1: { r: number; g: number; b: number }, rgb2: { r: number; g: number; b: number }): number {
    const lum1 = luminance(rgb1.r, rgb1.g, rgb1.b);
    const lum2 = luminance(rgb2.r, rgb2.g, rgb2.b);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
}

// Generates a random hex color with sufficient contrast against a background color
function generateRandomContrastingColor(backgroundHex: string, minContrast: number = 4.5): string {
    const backgroundRgb = hexToRgb(backgroundHex);
    if (!backgroundRgb) {
        console.error("Invalid background color for contrast check.");
        return `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`; // fallback
    }

    let attempts = 0;
    const maxAttempts = 50; // Prevent infinite loops

    while (attempts < maxAttempts) {
        attempts++;
        // Generate random color favoring higher saturation/lightness for better contrast chance
        const h = Math.random();
        const s = 0.6 + Math.random() * 0.4; // Saturation between 0.6 and 1.0
        const l = 0.4 + Math.random() * 0.4; // Lightness between 0.4 and 0.8
        const tempColor = new THREE.Color().setHSL(h, s, l);
        const randomHex = `#${tempColor.getHexString()}`;
        const randomRgb = { r: tempColor.r * 255, g: tempColor.g * 255, b: tempColor.b * 255 };

        if (contrastRatio(randomRgb, backgroundRgb) >= minContrast) {
            console.log(`Generated contrasting color: ${randomHex} (Contrast: ${contrastRatio(randomRgb, backgroundRgb).toFixed(2)}:${1}) after ${attempts} attempts.`);
            return randomHex;
        }
    }

    console.warn(`Could not find a color with ${minContrast}:1 contrast after ${maxAttempts} attempts. Using last generated color.`);
    // Fallback to the last generated color if no contrasting one is found quickly
    const fallbackColor = new THREE.Color().setHSL(Math.random(), 0.7, 0.6);
     return `#${fallbackColor.getHexString()}`;
}

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

    // --- Terrain Data Generation --- // & Color Randomization
    if (!updateStyleOnly) {
        // Only regenerate terrain geometry if updateStyleOnly is false
        if (shouldRandomize) {
            randomizeTerrainSettings();

            // --- Generate New Random Background Color ---
            // Favor lighter colors for background (higher lightness)
            const hBg = Math.random();
            const sBg = 0.3 + Math.random() * 0.4; // Saturation between 0.3 and 0.7
            const lBg = 0.75 + Math.random() * 0.2; // Lightness between 0.75 and 0.95
            const newBgColorThree = new THREE.Color().setHSL(hBg, sBg, lBg);
            const newBackgroundColor = `#${newBgColorThree.getHexString()}`;
            config.backgroundColor = newBackgroundColor;
            console.log("New background color:", config.backgroundColor);
            // ------------------------------------------

            // --- Generate New Contrasting Contour Color ---
            // Ensure contour contrasts with the *new* background
            config.contourColor = generateRandomContrastingColor(config.backgroundColor);
            console.log("New contour color:", config.contourColor);
            // -------------------------------------------

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