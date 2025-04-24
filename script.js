// --- START OF FILE script.js ---
// Based in part on code from:
// - Three.js (MIT License) https://github.com/mrdoob/three.js
// - llevasseur/webgl_threejs (MIT License) https://github.com/llevasseur/webgl_threejs

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
// dat.GUI is loaded globally via script tag in index.html

let scene, camera, renderer, controls, gui;
let terrainMesh, terrainBorder;
const contourLinesGroup = new THREE.Group();

// --- Configuration Object ---
// Store base values that randomization will modify slightly
const baseConfig = {
    terrainMaxHeight: 130,
    noiseScale: 100,
    minTerrainHeightFactor: 0.3,
    contourInterval: 4,
};

// Randomization ranges (percentage for height/scale, absolute for height factor)
const randomRanges = {
    heightRange: 30,    // +/- % for terrainMaxHeight
    noiseRange: 15,     // +/- % for noiseScale
    minHeightRange: 0.05, // +/- absolute for minTerrainHeightFactor
    intervalRange: 8    // Max random interval (1 to N)
};

const config = {
    // Terrain Shape (These will be slightly randomized on generation)
    terrainSize: 1000,
    terrainSegments: 500,
    terrainMaxHeight: baseConfig.terrainMaxHeight,
    noiseScale: baseConfig.noiseScale,
    minTerrainHeightFactor: baseConfig.minTerrainHeightFactor,

    // Contours (Interval will be randomized)
    contourInterval: baseConfig.contourInterval,
    contourColor: '#d95f20',
    backgroundColor: '#f0efe6',

    // Fading (Fixed values, removed from GUI)
    minFadeDistance: 200,
    maxFadeDistance: 640,

    // Camera / Controls (Zoom limits fixed, removed from GUI)
    minZoomDistance: 280,
    maxZoomDistance: 540,
    enableZoom: true,
    enableRotate: true,
    enableVerticalRotate: false,
    fixedVerticalAngle: Math.PI / 3,

    // Debugging
    showTerrainBorder: false
};

// --- Derived Configuration ---
let fadeRange = config.maxFadeDistance - config.minFadeDistance;

// --- Pre-create colors ---
let baseContourColor = new THREE.Color(config.contourColor);
let fadeToBgColor = new THREE.Color(config.backgroundColor);

// --- Initialization ---
function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(config.backgroundColor);
    updateFog();

    // Camera
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(65, aspect, 1, config.terrainSize * 2.5);
    const initialRadius = (config.minZoomDistance + config.maxZoomDistance) / 2;
    camera.position.set(
        0,
        initialRadius * Math.cos(config.fixedVerticalAngle),
        initialRadius * Math.sin(config.fixedVerticalAngle)
    );
    camera.lookAt(0, 0, 0);


    // Renderer
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        precision: 'mediump',
        powerPreference: 'high-performance',
        alpha: true // Enable transparency for export
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    updateControls(); // Apply initial control settings

    // Initial Generation (with initial randomization)
    updateVisualization();

    // Create Terrain Border
    createTerrainBorder();

    // Hide info message
    const infoElement = document.getElementById('info');
    if (infoElement) infoElement.style.display = 'none';

    // Setup dat.GUI
    setupGUI();

    // Event Listeners
    window.addEventListener('resize', onWindowResize, false);

    // Start Animation Loop
    animate();
}

// --- Fog Update ---
function updateFog() {
    if (scene.fog) scene.fog = null;
    // Use the fixed config values for fog
    scene.fog = new THREE.Fog(config.backgroundColor, config.maxFadeDistance * 0.8, config.maxFadeDistance * 1.4);
}


// --- Controls Update ---
function updateControls() {
    controls.enableRotate = config.enableRotate || config.enableVerticalRotate;
    controls.enableZoom = config.enableZoom;
    controls.enablePan = false;
    // Use the fixed config values for zoom limits
    controls.minDistance = config.minZoomDistance;
    controls.maxDistance = config.maxZoomDistance;

    if (config.enableVerticalRotate) {
        controls.minPolarAngle = 0.1;
        controls.maxPolarAngle = Math.PI - 0.1;
    } else {
        controls.minPolarAngle = config.fixedVerticalAngle;
        controls.maxPolarAngle = config.fixedVerticalAngle;
    }

    controls.target.set(0, 0, 0);
    controls.update();
}

// --- Terrain Generation ---
function generateTerrain() {
    if (terrainMesh && terrainMesh.geometry) terrainMesh.geometry.dispose();

    const geometry = new THREE.PlaneGeometry(config.terrainSize, config.terrainSize, config.terrainSegments, config.terrainSegments);
    geometry.rotateX(-Math.PI / 2);

    const vertices = geometry.attributes.position.array;
    const noise = new ImprovedNoise();
    const noiseSeed = Math.random() * 100;

    // Use the current (potentially randomized) config values
    const currentMaxHeight = config.terrainMaxHeight;
    const currentNoiseScale = config.noiseScale;
    const currentMinHeightFactor = config.minTerrainHeightFactor;

    for (let i = 0, j = 0; i < vertices.length; i++, j += 3) {
        const x = vertices[j], z = vertices[j + 2];
    // Base large-scale noise
    const noise1 = noise.noise(x / currentNoiseScale, z / currentNoiseScale, noiseSeed);
    
    // Higher frequency detail noise
    const noise2 = noise.noise(
        x / (currentNoiseScale * 0.3), 
        z / (currentNoiseScale * 0.3), 
        noiseSeed + 100
    );
    
    // Combined noise with different weights
    const combinedNoise = (noise1 * 0.7) + (noise2 * 0.3);
    
    // Exponential scaling for sharper peaks
    const expNoise = Math.pow((combinedNoise + 1) / 2, 2.5);
    
    // Final height with erosion simulation
    const slopeFactor = 1 + Math.abs(noise1 - noise2) * 0.8;
    const finalHeight = expNoise * currentMaxHeight * slopeFactor;
    
    // Apply minimum height factor
    vertices[j + 1] = Math.max(
        currentMinHeightFactor * currentMaxHeight, 
        finalHeight
    );
    }
    geometry.computeVertexNormals();
    geometry.attributes.position.needsUpdate = true;

    const material = new THREE.MeshBasicMaterial({ color: 0xcccccc, wireframe: true, visible: false });
    if (!terrainMesh) terrainMesh = new THREE.Mesh(geometry, material);
    else terrainMesh.geometry = geometry;
    return terrainMesh;
}


// --- Create Terrain Border ---
// ... (no changes needed) ...
function createTerrainBorder() {
    if (terrainBorder) {
        if (terrainBorder.geometry) terrainBorder.geometry.dispose();
        if (terrainBorder.material) terrainBorder.material.dispose();
        scene.remove(terrainBorder);
    }

    const halfSize = config.terrainSize / 2;
    const points = [
        new THREE.Vector3(-halfSize, 0, -halfSize), new THREE.Vector3( halfSize, 0, -halfSize),
        new THREE.Vector3( halfSize, 0,  halfSize), new THREE.Vector3(-halfSize, 0,  halfSize),
        new THREE.Vector3(-halfSize, 0, -halfSize)
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({ color: 0x000000, linewidth: 1, scale: 1, dashSize: 10, gapSize: 5 });
    terrainBorder = new THREE.Line(geometry, material);
    terrainBorder.computeLineDistances();
    terrainBorder.visible = config.showTerrainBorder;
    scene.add(terrainBorder);
}


// --- Contour Line Generation ---
// ... (no changes needed, uses current config.contourInterval) ...
function generateContourLines(geometry) {
    while (contourLinesGroup.children.length > 0) {
        const line = contourLinesGroup.children[0];
        if (line.geometry) line.geometry.dispose();
        contourLinesGroup.remove(line);
    }
    if (contourLinesGroup.userData.sharedMaterial) {
        contourLinesGroup.userData.sharedMaterial.dispose();
        contourLinesGroup.userData.sharedMaterial = null;
    }

    const vertices = geometry.attributes.position.array;
    const index = geometry.index ? geometry.index.array : null;
    if (!index) { console.error("Geometry has no index buffer."); return; };

    const contourMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2, vertexColors: true });
    contourLinesGroup.userData.sharedMaterial = contourMaterial;
    baseContourColor = new THREE.Color(config.contourColor);

    const lines = {};
    function getIntersection(p1, p2, height) {
        const p1y = p1.y; const p2y = p2.y;
        if ((p1y < height && p2y < height) || (p1y >= height && p2y >= height)) return null;
        const t = (height - p1y) / (p2y - p1y);
        return p1.clone().lerp(p2, t);
    }

    // Use the current (potentially randomized) config values
    const currentInterval = config.contourInterval;
    const currentMaxHeight = config.terrainMaxHeight;
    const currentMinHeightFactor = config.minTerrainHeightFactor;

    for (let i = 0; i < index.length; i += 3) {
        const i1 = index[i], i2 = index[i + 1], i3 = index[i + 2];
        const v1 = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, i1);
        const v2 = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, i2);
        const v3 = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, i3);
        const minY = Math.min(v1.y, v2.y, v3.y);
        const maxY = Math.max(v1.y, v2.y, v3.y);

        for (let h = Math.ceil(minY / currentInterval) * currentInterval; h <= maxY && h < currentMaxHeight; h += currentInterval) {
             if (h < (currentMinHeightFactor * currentMaxHeight) && h <= 0 && currentMinHeightFactor > 0) continue;
             if (h <= 0 && currentInterval > 0) continue;

            const intersections = [];
            const edge12 = getIntersection(v1, v2, h), edge23 = getIntersection(v2, v3, h), edge31 = getIntersection(v3, v1, h);
            if (edge12) intersections.push(edge12); if (edge23) intersections.push(edge23); if (edge31) intersections.push(edge31);

            if (intersections.length >= 2) {
                if (!lines[h]) lines[h] = { points: [], colors: [] };
                const baseColor = baseContourColor;
                lines[h].points.push(intersections[0].x, intersections[0].y, intersections[0].z, intersections[1].x, intersections[1].y, intersections[1].z);
                lines[h].colors.push(baseColor.r, baseColor.g, baseColor.b, baseColor.r, baseColor.g, baseColor.b);
                 if (intersections.length === 3) {
                     lines[h].points.push(intersections[1].x, intersections[1].y, intersections[1].z, intersections[2].x, intersections[2].y, intersections[2].z);
                     lines[h].colors.push(baseColor.r, baseColor.g, baseColor.b, baseColor.r, baseColor.g, baseColor.b);
                 }
            }
        }
    }

    for (const height in lines) {
        const levelData = lines[height];
        if (levelData.points.length > 0) {
            const lineGeometry = new THREE.BufferGeometry();
            lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(levelData.points, 3));
            lineGeometry.setAttribute('color', new THREE.Float32BufferAttribute(levelData.colors, 3));
            lineGeometry.computeBoundingSphere();
            const contourLine = new THREE.LineSegments(lineGeometry, contourMaterial);
            contourLinesGroup.add(contourLine);
        }
    }
    if (!contourLinesGroup.parent) scene.add(contourLinesGroup);
}

// --- NEW: Randomize Settings ---
function randomizeTerrainSettings() {
    // Max Height: +/- heightRange% of base
    config.terrainMaxHeight = baseConfig.terrainMaxHeight * 
        (1 + (Math.random() - 0.5) * randomRanges.heightRange / 50); // Convert % to factor

    // Noise Scale: +/- noiseRange% of base
    config.noiseScale = baseConfig.noiseScale * 
        (1 + (Math.random() - 0.5) * randomRanges.noiseRange / 50); // Convert % to factor

    // Min Height Factor: +/- minHeightRange absolute, clamped between 0 and 0.5
    config.minTerrainHeightFactor = Math.max(0, Math.min(0.5, 
        baseConfig.minTerrainHeightFactor + (Math.random() - 0.5) * randomRanges.minHeightRange * 2));

    // Contour Interval: Random integer between 1 and intervalRange if randomization enabled
    if (randomRanges.enableIntervalRandomization) {
        config.contourInterval = Math.floor(Math.random() * randomRanges.intervalRange) + 1;
    }

    // Ensure values don't go below reasonable minimums
    config.terrainMaxHeight = Math.max(10, config.terrainMaxHeight);
    config.noiseScale = Math.max(10, config.noiseScale);

    console.log("Randomized Settings:", {
        maxH: config.terrainMaxHeight.toFixed(1) + ` (base ${baseConfig.terrainMaxHeight} ±${randomRanges.heightRange}%)`,
        noiseS: config.noiseScale.toFixed(1) + ` (base ${baseConfig.noiseScale} ±${randomRanges.noiseRange}%)`,
        minHF: config.minTerrainHeightFactor.toFixed(2) + ` (base ${baseConfig.minTerrainHeightFactor} ±${randomRanges.minHeightRange})`,
        interval: config.contourInterval + (randomRanges.enableIntervalRandomization ? ` (random 1-${randomRanges.intervalRange})` : ' (manual)')
    });

    // Randomization ranges kept in code but removed from GUI
}


// --- Update Visualization ---
function updateVisualization() {
    console.log("Updating visualization...");
    // --- CALL RANDOMIZATION HERE ---
    randomizeTerrainSettings();

    // Update derived values and colors
    fadeRange = config.maxFadeDistance - config.minFadeDistance; // Still needed for animation loop
    baseContourColor = new THREE.Color(config.contourColor);
    fadeToBgColor = new THREE.Color(config.backgroundColor);
    scene.background = fadeToBgColor;

    const terrain = generateTerrain();
    generateContourLines(terrain.geometry);
    createTerrainBorder();

    updateFog(); // Fog uses fixed distances now
    updateControls(); // Controls use fixed distances now
    console.log("Update complete.");
}


// --- Export Function ---
// ... (no changes needed) ...
function exportToPNG() {
    const originalBackground = scene.background;
    scene.background = null; // Set background to transparent
    renderer.render(scene, camera); // Render frame

    const dataURL = renderer.domElement.toDataURL('image/png'); // Get data URL

    scene.background = originalBackground; // Restore background
    renderer.render(scene, camera); // Render again for display

    const link = document.createElement('a');
    link.download = 'topographic-export.png';
    link.href = dataURL;
    link.click();
}


// --- Setup dat.GUI ---
function setupGUI() {
    if (gui) gui.destroy();
    gui = new dat.GUI();

    // Terrain Folder
    const terrainFolder = gui.addFolder('Terrain Shape');
    // Add controls for the BASE values if you want to adjust the center point of randomization
    terrainFolder.add(baseConfig, 'terrainMaxHeight', 10, 300, 5).name('Base Max Height').onChange(updateVisualization);
    terrainFolder.add(baseConfig, 'noiseScale', 10, 500, 10).name('Base Feature Scale').onChange(updateVisualization);
    terrainFolder.add(baseConfig, 'minTerrainHeightFactor', 0, 0.5, 0.01).name('Base Min Height Factor').onChange(updateVisualization);
    terrainFolder.open();

    // Contours Folder
    const contoursFolder = gui.addFolder('Contours');
    contoursFolder.add(config, 'contourInterval', 1, 50, 1).name('Interval').onFinishChange(updateVisualization);
    contoursFolder.addColor(config, 'contourColor').name('Line Color').onChange(() => { baseContourColor = new THREE.Color(config.contourColor); });
    contoursFolder.addColor(config, 'backgroundColor').name('Background').onChange(() => { fadeToBgColor = new THREE.Color(config.backgroundColor); scene.background = fadeToBgColor; updateFog(); });
    contoursFolder.open();

    // --- Fading Folder REMOVED ---
    // const fadingFolder = gui.addFolder('Distance Fading');
    // fadingFolder.add(config, 'minFadeDistance', 0, 1000, 10).name('Min Fade Dist').onChange(() => { fadeRange = Math.max(1, config.maxFadeDistance - config.minFadeDistance); });
    // fadingFolder.add(config, 'maxFadeDistance', 100, 2000, 10).name('Max Fade Dist').onChange(() => { fadeRange = Math.max(1, config.maxFadeDistance - config.minFadeDistance); updateFog(); });
    // fadingFolder.open();

    // Camera Folder
    const cameraFolder = gui.addFolder('Camera Controls');
    // cameraFolder.add(config, 'minZoomDistance', 10, 1000, 5).name('Min Zoom').onChange(updateControls); // REMOVED
    // cameraFolder.add(config, 'maxZoomDistance', 50, 2000, 5).name('Max Zoom').onChange(updateControls); // REMOVED
    cameraFolder.add(config, 'enableZoom').name('Enable Zoom').onChange(updateControls);
    cameraFolder.add(config, 'enableRotate').name('Enable Horiz Rotate').onChange(updateControls);
    cameraFolder.add(config, 'enableVerticalRotate').name('Enable Vert Rotate').onChange(updateControls);
    cameraFolder.add(config, 'fixedVerticalAngle', Math.PI/5, Math.PI/3, 0.01)
        .name('Vertical Angle')
        .onChange(updateControls);
    // cameraFolder.open();

    // Debug Folder
    const debugFolder = gui.addFolder('Debugging');
    debugFolder.add(config, 'showTerrainBorder').name('Show Border').onChange((value) => {
        if (terrainBorder) terrainBorder.visible = value;
    });
    // debugFolder.open();

    // Generate New Terrain Button
    gui.add({ generate: updateVisualization }, 'generate').name('Generate New Terrain');

    // Export Button
    gui.add({ export: exportToPNG }, 'export').name('Export PNG');
}

// --- Window Resize ---
// ... (no changes needed) ...
function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}


// --- Animation Loop ---
// ... (no changes needed) ...
const tempVec3 = new THREE.Vector3();
const tempColor = new THREE.Color();

function animate() {
    requestAnimationFrame(animate);
    if (controls.enabled && (config.enableRotate || config.enableVerticalRotate || config.enableZoom)) {
         controls.update();
    }

    const cameraPosition = camera.position;
    contourLinesGroup.children.forEach(line => {
        if (!line.geometry || !line.geometry.attributes.position || !line.geometry.attributes.color) return;
        line.visible = true;
        const geometry = line.geometry;
        const positions = geometry.attributes.position.array;
        const colors = geometry.attributes.color.array;
        let colorsNeedUpdate = false;
        const currentFadeRange = Math.max(1.0, fadeRange); // fadeRange uses fixed config values

        for (let i = 0; i < positions.length; i += 3) {
            tempVec3.set(positions[i], positions[i + 1], positions[i + 2]);
            const distance = tempVec3.distanceTo(cameraPosition);
            // Use fixed config values for fading
            const fadeFactor = Math.min(Math.max((distance - config.minFadeDistance) / currentFadeRange, 0), 1);
            tempColor.copy(baseContourColor).lerp(fadeToBgColor, fadeFactor);
            const threshold = 0.005;
            if (Math.abs(colors[i] - tempColor.r) > threshold || Math.abs(colors[i + 1] - tempColor.g) > threshold || Math.abs(colors[i + 2] - tempColor.b) > threshold) {
                colors[i] = tempColor.r; colors[i + 1] = tempColor.g; colors[i + 2] = tempColor.b;
                colorsNeedUpdate = true;
            }
        }
        if (colorsNeedUpdate) geometry.attributes.color.needsUpdate = true;
    });

    renderer.render(scene, camera);
}

// --- Start ---
init();

// --- END OF FILE script.js ---
