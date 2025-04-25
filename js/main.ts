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

const tempVec3 = new THREE.Vector3();
const tempColor = new THREE.Color();

// Main animation loop
function animate(): void {
    requestAnimationFrame(animate);

    if (controls && controls.enabled && (config.enableRotate || config.enableVerticalRotate || config.enableZoom)) {
         controls.update();
    }

    if (contourLinesGroup && sceneCamera) {
        if (config.style === Styles.FADING_LINES &&
            contourLinesGroup.userData.sharedMaterial instanceof THREE.ShaderMaterial) {
            // No per-frame uniform updates needed for height-based fade unless colors/heights change
            // const shaderMaterial = contourLinesGroup.userData.sharedMaterial as THREE.ShaderMaterial;
            // shaderMaterial.uniforms.cameraPosition.value.copy(sceneCamera.position); // REMOVED
            // UPDATE: Need to update camera position uniform for manual fog
            const shaderMaterial = contourLinesGroup.userData.sharedMaterial as THREE.ShaderMaterial;
            if (shaderMaterial.uniforms.u_cameraPosition) {
                shaderMaterial.uniforms.u_cameraPosition.value.copy(sceneCamera.position);
            }
        } else if (config.style === Styles.LINES_ONLY &&
                   contourLinesGroup.userData.sharedMaterial instanceof THREE.LineBasicMaterial &&
                   contourLinesGroup.userData.sharedMaterial.vertexColors) {
            // --- REMOVED Per-frame color update/fog fade for LINES_ONLY ---
            // Lines retain their generated vertex colors based on baseContourColor.
            // If baseContourColor changes, updateVisualization handles regeneration.
            /*
             const cameraPosition = sceneCamera.position;
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
                         const fadeFactor = THREE.MathUtils.smoothstep(distance, near, far);
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
             */
            // Ensure lines are visible if style is LINES_ONLY
             if (!contourLinesGroup.visible) contourLinesGroup.visible = true; // Should be handled by updateVisualization already
        }
    }

    if (renderer && scene && sceneCamera) {
        renderer.render(scene, sceneCamera);
    }
}

function handleContourColorChange(value: string): void {
    // Update the color used for generating line vertex colors
    baseContourColor.set(value);

    // Mesh color for FILLED_MOUNTAIN is handled in updateVisualization now.

    // If using Fading Lines, update the baseColor uniform
    if (contourLinesGroup && contourLinesGroup.userData.sharedMaterial instanceof THREE.ShaderMaterial && config.style === Styles.FADING_LINES) {
        const shaderMaterial = contourLinesGroup.userData.sharedMaterial as THREE.ShaderMaterial;
        if (shaderMaterial.uniforms.baseColor) {
            shaderMaterial.uniforms.baseColor.value.set(value);
        }
    }
}

function handleBackgroundColorChange(value: string): void {
    fadeToBgColor.set(value);
    if (scene) scene.background = fadeToBgColor;

    // Update scene fog and then update shader uniforms if necessary
    updateFog();
    updateFadingLinesFogUniforms();
}

// --- NEW Function to update Fading Lines shader fog uniforms --- 
export function updateFadingLinesFogUniforms(): void {
    if (config.style === Styles.FADING_LINES && contourLinesGroup && contourLinesGroup.userData.sharedMaterial instanceof THREE.ShaderMaterial) {
        const shaderMaterial = contourLinesGroup.userData.sharedMaterial;

        // Update fog color uniform
        if (shaderMaterial.uniforms.u_fogColor) {
            shaderMaterial.uniforms.u_fogColor.value.set(config.backgroundColor);
        }

        // Update fog distance uniforms based on scene.fog state
        if (scene.fog && config.fogIntensity > 0) {
            // Cast scene.fog to THREE.Fog as updateFog ensures it is not FogExp2
            const fog = scene.fog as THREE.Fog;
            if (shaderMaterial.uniforms.u_fogNear) {
                shaderMaterial.uniforms.u_fogNear.value = fog.near;
            }
            if (shaderMaterial.uniforms.u_fogFar) {
                shaderMaterial.uniforms.u_fogFar.value = fog.far;
            }
        } else {
            // Fog is off, set shader fog distances very far to disable effect
            if (shaderMaterial.uniforms.u_fogNear) {
                shaderMaterial.uniforms.u_fogNear.value = 1000000;
            }
            if (shaderMaterial.uniforms.u_fogFar) {
                shaderMaterial.uniforms.u_fogFar.value = 1000001;
            }
        }
    }
}

init();