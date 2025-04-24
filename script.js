// --- START OF FILE script.js ---

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
// dat.GUI is loaded globally via script tag in index.html

let scene, camera, renderer, controls, gui;
let terrainMesh, terrainBorder; // Added terrainBorder
const contourLinesGroup = new THREE.Group(); // Group to hold all contour lines

// --- Configuration Object ---
const config = {
    // Terrain Shape
    terrainSize: 800,       // Size of the terrain plane
    terrainSegments: 150,   // Resolution
    terrainMaxHeight: 125,  // Max height of peaks
    noiseScale: 130,        // Controls size of terrain features
    minTerrainHeightFactor: 0.01, // Controls how low valleys go

    // Contours
    contourInterval: 4,     // Height difference between contour lines
    contourColor: '#d95f20', // Orange color
    backgroundColor: '#f0efe6', // Off-white background

    // Fading
    minFadeDistance: 260,   // Start fading lines closer
    maxFadeDistance: 800,   // Lines fully faded further

    // Camera / Controls
    minZoomDistance: 220,   // Minimum distance camera can be from the center
    maxZoomDistance: 340,   // Maximum distance camera can be from the center
    enableZoom: true,
    enableRotate: true,

    // Debugging
    showTerrainBorder: false // << NEW: Toggle for border visibility
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
    camera = new THREE.PerspectiveCamera(65, aspect, 1, config.terrainSize * 2.5); // Increased far plane slightly
    camera.position.set(0, config.terrainMaxHeight * 2.0, config.terrainMaxHeight * 1.2);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, precision: 'mediump', powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    updateControls();

    // Initial Generation
    updateVisualization(); // Generates terrain and contours

    // Create Terrain Border (after terrain exists)
    createTerrainBorder(); // << NEW

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
    scene.fog = new THREE.Fog(config.backgroundColor, config.maxFadeDistance * 0.8, config.maxFadeDistance * 1.4);
}

// --- Controls Update ---
function updateControls() {
    controls.enableRotate = config.enableRotate;
    controls.enableZoom = config.enableZoom;
    controls.enablePan = false;
    controls.minDistance = config.minZoomDistance;
    controls.maxDistance = config.maxZoomDistance;
    controls.minPolarAngle = Math.PI / 3.5;
    controls.maxPolarAngle = Math.PI / 3.5;
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
    for (let i = 0, j = 0; i < vertices.length; i++, j += 3) {
        const x = vertices[j], z = vertices[j + 2];
        const noiseValue = noise.noise(x / config.noiseScale, z / config.noiseScale, 0);
        const normalizedHeightZeroToOne = (noiseValue + 1) / 2;
        const mappedHeightFactor = (normalizedHeightZeroToOne * (1 - config.minTerrainHeightFactor)) + config.minTerrainHeightFactor;
        vertices[j + 1] = mappedHeightFactor * config.terrainMaxHeight;
    }
    geometry.computeVertexNormals();
    geometry.attributes.position.needsUpdate = true;

    const material = new THREE.MeshBasicMaterial({ color: 0xcccccc, wireframe: true, visible: false });
    if (!terrainMesh) terrainMesh = new THREE.Mesh(geometry, material);
    else terrainMesh.geometry = geometry;
    return terrainMesh;
}

// --- Create Terrain Border --- << NEW FUNCTION
function createTerrainBorder() {
    // Dispose previous border if exists
    if (terrainBorder) {
        if (terrainBorder.geometry) terrainBorder.geometry.dispose();
        if (terrainBorder.material) terrainBorder.material.dispose();
        scene.remove(terrainBorder);
    }

    const halfSize = config.terrainSize / 2;
    const points = [];
    points.push(new THREE.Vector3(-halfSize, 0, -halfSize));
    points.push(new THREE.Vector3( halfSize, 0, -halfSize));
    points.push(new THREE.Vector3( halfSize, 0,  halfSize));
    points.push(new THREE.Vector3(-halfSize, 0,  halfSize));
    points.push(new THREE.Vector3(-halfSize, 0, -halfSize)); // Close the loop

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
        color: 0x000000, // Black border
        linewidth: 1,
        scale: 1,
        dashSize: 10, // Size of dashes
        gapSize: 5,   // Size of gaps
    });

    terrainBorder = new THREE.Line(geometry, material);
    terrainBorder.computeLineDistances(); // Required for dashed lines
    terrainBorder.visible = config.showTerrainBorder; // Set initial visibility
    scene.add(terrainBorder);
}

// --- Contour Line Generation ---
function generateContourLines(geometry) {
    while (contourLinesGroup.children.length > 0) {
        const line = contourLinesGroup.children[0];
        if (line.geometry) line.geometry.dispose();
        if (line.material) line.material.dispose();
        contourLinesGroup.remove(line);
    }

    const vertices = geometry.attributes.position.array;
    const index = geometry.index ? geometry.index.array : null;
    if (!index) return;

    const contourMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2, vertexColors: true });
    baseContourColor = new THREE.Color(config.contourColor);

    const lines = {};
    function getIntersection(p1, p2, height) { /* ... (no changes) ... */
        const p1y = p1.y;
        const p2y = p2.y;
        if ((p1y < height && p2y < height) || (p1y >= height && p2y >= height)) {
            return null;
        }
        const t = (height - p1y) / (p2y - p1y);
        return p1.clone().lerp(p2, t);
    }

    for (let i = 0; i < index.length; i += 3) {
        const i1 = index[i], i2 = index[i + 1], i3 = index[i + 2];
        const v1 = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, i1);
        const v2 = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, i2);
        const v3 = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, i3);
        const minY = Math.min(v1.y, v2.y, v3.y);
        const maxY = Math.max(v1.y, v2.y, v3.y);

        for (let h = Math.ceil(minY / config.contourInterval) * config.contourInterval; h <= maxY && h < config.terrainMaxHeight; h += config.contourInterval) {
             if (h < (config.minTerrainHeightFactor * config.terrainMaxHeight) && h <= 0) continue;
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
            const contourLine = new THREE.LineSegments(lineGeometry, contourMaterial.clone());
            contourLinesGroup.add(contourLine);
        }
    }
    if (!contourLinesGroup.parent) scene.add(contourLinesGroup);
}

// --- Update Visualization ---
function updateVisualization() {
    console.log("Updating visualization...");
    fadeRange = config.maxFadeDistance - config.minFadeDistance;
    baseContourColor = new THREE.Color(config.contourColor);
    fadeToBgColor = new THREE.Color(config.backgroundColor);
    scene.background = fadeToBgColor;

    const terrain = generateTerrain();
    generateContourLines(terrain.geometry);
    createTerrainBorder(); // Recreate border in case terrainSize changes (though not currently in GUI)

    updateFog();
    updateControls();
    console.log("Update complete.");
}

// --- Setup dat.GUI ---
function setupGUI() {
    gui = new dat.GUI();

    // Terrain Folder
    const terrainFolder = gui.addFolder('Terrain Shape');
    terrainFolder.add(config, 'terrainMaxHeight', 10, 300, 5).name('Max Height').onFinishChange(updateVisualization);
    terrainFolder.add(config, 'noiseScale', 10, 500, 10).name('Feature Scale').onFinishChange(updateVisualization);
    terrainFolder.add(config, 'minTerrainHeightFactor', 0, 0.5, 0.01).name('Min Height Factor').onFinishChange(updateVisualization);
    // terrainFolder.open();

    // Contours Folder
    const contoursFolder = gui.addFolder('Contours');
    contoursFolder.add(config, 'contourInterval', 1, 50, 1).name('Interval').onFinishChange(updateVisualization);
    contoursFolder.addColor(config, 'contourColor').name('Line Color').onChange(() => { baseContourColor = new THREE.Color(config.contourColor); });
    contoursFolder.addColor(config, 'backgroundColor').name('Background').onChange(() => { fadeToBgColor = new THREE.Color(config.backgroundColor); scene.background = fadeToBgColor; updateFog(); });
    // contoursFolder.open();

    // Fading Folder
    const fadingFolder = gui.addFolder('Distance Fading');
    fadingFolder.add(config, 'minFadeDistance', 0, 1000, 10).name('Min Fade Dist').onChange(() => { fadeRange = config.maxFadeDistance - config.minFadeDistance; });
    fadingFolder.add(config, 'maxFadeDistance', 100, 2000, 10).name('Max Fade Dist').onChange(() => { fadeRange = config.maxFadeDistance - config.minFadeDistance; updateFog(); });
    // fadingFolder.open();

    // Camera Folder
    const cameraFolder = gui.addFolder('Camera Controls');
    cameraFolder.add(config, 'minZoomDistance', 10, 1000, 5).name('Min Zoom').onChange(updateControls);
    cameraFolder.add(config, 'maxZoomDistance', 50, 2000, 5).name('Max Zoom').onChange(updateControls);
    cameraFolder.add(config, 'enableZoom').name('Enable Zoom').onChange(updateControls);
    cameraFolder.add(config, 'enableRotate').name('Enable Rotate').onChange(updateControls);
    // cameraFolder.open();

    // Debug Folder << NEW
    const debugFolder = gui.addFolder('Debugging');
    debugFolder.add(config, 'showTerrainBorder').name('Show Border').onChange((value) => {
        if (terrainBorder) terrainBorder.visible = value;
    });
    // debugFolder.open();
}

// --- Window Resize ---
function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Animation Loop ---
const tempVec3 = new THREE.Vector3();
const tempColor = new THREE.Color();

function animate() {
    requestAnimationFrame(animate);
    if (config.enableRotate || config.enableZoom) controls.update();

    // --- Distance-Based Vertex Color Fading ---
    const cameraPosition = camera.position;
    contourLinesGroup.children.forEach(line => {
        if (!line.geometry || !line.geometry.attributes.position || !line.geometry.attributes.color) return;
        line.visible = true;
        const geometry = line.geometry;
        const positions = geometry.attributes.position.array;
        const colors = geometry.attributes.color.array;
        let colorsNeedUpdate = false;
        for (let i = 0; i < positions.length; i += 3) {
            tempVec3.set(positions[i], positions[i + 1], positions[i + 2]);
            const distance = tempVec3.distanceTo(cameraPosition);
            const currentFadeRange = Math.max(1, fadeRange);
            const fadeFactor = Math.min(Math.max((distance - config.minFadeDistance) / currentFadeRange, 0), 1);
            tempColor.copy(baseContourColor).lerp(fadeToBgColor, fadeFactor);
            if (Math.abs(colors[i] - tempColor.r) > 0.001 || Math.abs(colors[i + 1] - tempColor.g) > 0.001 || Math.abs(colors[i + 2] - tempColor.b) > 0.001) {
                colors[i] = tempColor.r; colors[i + 1] = tempColor.g; colors[i + 2] = tempColor.b;
                colorsNeedUpdate = true;
            }
        }
        if (colorsNeedUpdate) geometry.attributes.color.needsUpdate = true;
    });

    // Update border visibility (in case it wasn't caught by GUI onChange)
    if (terrainBorder && terrainBorder.visible !== config.showTerrainBorder) {
        terrainBorder.visible = config.showTerrainBorder;
    }

    renderer.render(scene, camera);
}

// --- Start ---
init();

// --- END OF FILE script.js ---
