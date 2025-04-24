// --- START OF FILE script.js ---

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
// dat.GUI is loaded globally via script tag in index.html

let scene, camera, renderer, controls, gui;
let terrainMesh, terrainBorder;
const contourLinesGroup = new THREE.Group();

// --- Configuration Object ---
const config = {
    // Terrain Shape
    terrainSize: 1000, // << INCREASED
    terrainSegments: 350, // << INCREASED proportionally
    terrainMaxHeight: 130,
    noiseScale: 100, // Note: May need adjustment for larger terrain feel
    minTerrainHeightFactor: 0.3,

    // Contours
    contourInterval: 4,
    contourColor: '#d95f20',
    backgroundColor: '#f0efe6',

    // Fading
    minFadeDistance: 800, // << INCREASED
    maxFadeDistance: 2500, // << INCREASED significantly

    // Camera / Controls
    minZoomDistance: 280,
    maxZoomDistance: 340,
    enableZoom: true,
    enableRotate: true, // This now primarily controls horizontal rotation enable/disable
    enableVerticalRotate: false, // << NEW: Toggle for vertical tilt, default false (locked)
    fixedVerticalAngle: Math.PI / 3.5, // << NEW: Store the default fixed angle

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
    // Adjust far plane based on the NEW larger terrain size
    camera = new THREE.PerspectiveCamera(65, aspect, 1, config.terrainSize * 2.5); // Far plane now 5000
    // Set initial position based on the fixed angle
    const initialRadius = (config.minZoomDistance + config.maxZoomDistance) / 2; // Start in middle of zoom range
    camera.position.set(
        0,
        initialRadius * Math.cos(config.fixedVerticalAngle), // Calculate initial Y based on angle
        initialRadius * Math.sin(config.fixedVerticalAngle)  // Calculate initial Z based on angle
    );
    camera.lookAt(0, 0, 0);


    // Renderer
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        precision: 'mediump',
        powerPreference: 'high-performance',
        alpha: true // <<< ADDED: Enable transparency for export
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    updateControls(); // Apply initial control settings

    // Initial Generation
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
    if (scene.fog) scene.fog = null; // Clear existing fog if any
    // Adjust fog distances based on the NEW larger fade distances
    scene.fog = new THREE.Fog(config.backgroundColor, config.maxFadeDistance * 0.8, config.maxFadeDistance * 1.4);
}


// --- Controls Update ---
function updateControls() {
    controls.enableRotate = config.enableRotate || config.enableVerticalRotate; // Rotation is enabled if either horizontal or vertical is
    controls.enableZoom = config.enableZoom;
    controls.enablePan = false; // Keep panning disabled
    controls.minDistance = config.minZoomDistance;
    controls.maxDistance = config.maxZoomDistance;

    // --- MODIFICATION START: Set Polar Angle Limits ---
    if (config.enableVerticalRotate) {
        // Allow vertical rotation within a reasonable range
        // (e.g., 0.1 to PI - 0.1 to avoid gimbal lock or looking straight up/down)
        controls.minPolarAngle = 0.1;
        controls.maxPolarAngle = Math.PI - 0.1;
    } else {
        // Lock vertical rotation to the fixed angle
        controls.minPolarAngle = config.fixedVerticalAngle;
        controls.maxPolarAngle = config.fixedVerticalAngle;
    }
    // --- MODIFICATION END ---

    controls.target.set(0, 0, 0); // Ensure target is always the center
    controls.update(); // Apply the changes to the controls
}

// --- Terrain Generation ---
// ... (no changes needed in this function) ...
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


// --- Create Terrain Border ---
// ... (no changes needed in this function) ...
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
// ... (no changes needed in this function, but ensure material cloning if needed) ...
function generateContourLines(geometry) {
    while (contourLinesGroup.children.length > 0) {
        const line = contourLinesGroup.children[0];
        if (line.geometry) line.geometry.dispose();
        // Check if material is shared before disposing - cloning might be safer
        if (line.material && line.material.dispose) line.material.dispose();
        contourLinesGroup.remove(line);
    }

    const vertices = geometry.attributes.position.array;
    const index = geometry.index ? geometry.index.array : null;
    if (!index) {
        console.error("Geometry has no index buffer.");
        return;
    };

    // Create one base material instance
    const contourMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff, // Use white base color for vertex coloring
        linewidth: 2,
        vertexColors: true
    });
    baseContourColor = new THREE.Color(config.contourColor); // Update base color reference

    const lines = {};
    function getIntersection(p1, p2, height) {
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
             // Skip contours below the minimum possible terrain height, unless it's exactly 0 and the factor allows it
             if (h < (config.minTerrainHeightFactor * config.terrainMaxHeight) && h <= 0 && config.minTerrainHeightFactor > 0) continue;
             // Also skip exactly 0 if interval is > 0 to avoid line at base plane
             if (h <= 0 && config.contourInterval > 0) continue;

            const intersections = [];
            const edge12 = getIntersection(v1, v2, h), edge23 = getIntersection(v2, v3, h), edge31 = getIntersection(v3, v1, h);
            if (edge12) intersections.push(edge12); if (edge23) intersections.push(edge23); if (edge31) intersections.push(edge31);

            if (intersections.length >= 2) {
                if (!lines[h]) lines[h] = { points: [], colors: [] };
                const baseColor = baseContourColor; // Use the updated base color reference
                lines[h].points.push(intersections[0].x, intersections[0].y, intersections[0].z, intersections[1].x, intersections[1].y, intersections[1].z);
                lines[h].colors.push(baseColor.r, baseColor.g, baseColor.b, baseColor.r, baseColor.g, baseColor.b);
                 if (intersections.length === 3) { // Handle rare case
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
            lineGeometry.computeBoundingSphere(); // Important for potential culling/fading optimizations
            // Use the single material instance for all line segments
            const contourLine = new THREE.LineSegments(lineGeometry, contourMaterial);
            contourLinesGroup.add(contourLine);
        }
    }
    if (!contourLinesGroup.parent) scene.add(contourLinesGroup); // Add group to scene if not already added
}


// --- Update Visualization ---
// ... (no changes needed in this function) ...
function updateVisualization() {
    console.log("Updating visualization...");
    fadeRange = config.maxFadeDistance - config.minFadeDistance;
    baseContourColor = new THREE.Color(config.contourColor);
    fadeToBgColor = new THREE.Color(config.backgroundColor);
    scene.background = fadeToBgColor;

    const terrain = generateTerrain();
    generateContourLines(terrain.geometry);
    createTerrainBorder(); // Recreate border in case terrainSize changes

    updateFog();
    updateControls(); // Ensure controls reflect latest config (e.g., if fixed angle changed)
    console.log("Update complete.");
}


// --- Export Function ---
function exportToPNG() {
    const originalBackground = scene.background; // Store original background
    scene.background = null; // Set background to transparent for capture
    renderer.render(scene, camera); // Render one frame with transparent bg

    const dataURL = renderer.domElement.toDataURL('image/png'); // Get data URL

    scene.background = originalBackground; // Restore original background
    renderer.render(scene, camera); // Render again to show original bg on screen

    // Trigger download
    const link = document.createElement('a');
    link.download = 'topographic-export.png';
    link.href = dataURL;
    link.click();
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
    contoursFolder.addColor(config, 'contourColor').name('Line Color').onChange(() => { baseContourColor = new THREE.Color(config.contourColor); }); // Update color ref immediately
    contoursFolder.addColor(config, 'backgroundColor').name('Background').onChange(() => { fadeToBgColor = new THREE.Color(config.backgroundColor); scene.background = fadeToBgColor; updateFog(); });
    // contoursFolder.open();

    // Fading Folder
    const fadingFolder = gui.addFolder('Distance Fading');
    fadingFolder.add(config, 'minFadeDistance', 0, 1000, 10).name('Min Fade Dist').onChange(() => { fadeRange = Math.max(1, config.maxFadeDistance - config.minFadeDistance); }); // Prevent zero/negative range
    fadingFolder.add(config, 'maxFadeDistance', 100, 2000, 10).name('Max Fade Dist').onChange(() => { fadeRange = Math.max(1, config.maxFadeDistance - config.minFadeDistance); updateFog(); }); // Prevent zero/negative range
    // fadingFolder.open();

    // Camera Folder
    const cameraFolder = gui.addFolder('Camera Controls');
    cameraFolder.add(config, 'minZoomDistance', 10, 1000, 5).name('Min Zoom').onChange(updateControls);
    cameraFolder.add(config, 'maxZoomDistance', 50, 2000, 5).name('Max Zoom').onChange(updateControls);
    cameraFolder.add(config, 'enableZoom').name('Enable Zoom').onChange(updateControls);
    cameraFolder.add(config, 'enableRotate').name('Enable Horiz Rotate').onChange(updateControls); // Clarified name
    // --- MODIFICATION START: Add Vertical Rotate Toggle ---
    cameraFolder.add(config, 'enableVerticalRotate').name('Enable Vert Rotate').onChange(updateControls);
    // --- MODIFICATION END ---
    // cameraFolder.open();

    // Debug Folder
    const debugFolder = gui.addFolder('Debugging');
    debugFolder.add(config, 'showTerrainBorder').name('Show Border').onChange((value) => {
        if (terrainBorder) terrainBorder.visible = value;
    });
    // debugFolder.open();

    // Export Button (added outside folders for prominence)
    gui.add({ export: exportToPNG }, 'export').name('Export PNG');
}

// --- Window Resize ---
// ... (no changes needed in this function) ...
function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}


// --- Animation Loop ---
// ... (minor optimization in fade check) ...
const tempVec3 = new THREE.Vector3();
const tempColor = new THREE.Color();

function animate() {
    requestAnimationFrame(animate);
    // Only call controls.update() if controls are actually enabled
    // and might change the camera view (rotation or zoom)
    if (controls.enabled && (config.enableRotate || config.enableVerticalRotate || config.enableZoom)) {
         controls.update();
    }


    // --- Distance-Based Vertex Color Fading ---
    const cameraPosition = camera.position;
    contourLinesGroup.children.forEach(line => {
        // Basic check if geometry and attributes exist
        if (!line.geometry || !line.geometry.attributes.position || !line.geometry.attributes.color) return;

        line.visible = true; // Assume visible unless culled later (if culling added)
        const geometry = line.geometry;
        const positions = geometry.attributes.position.array;
        const colors = geometry.attributes.color.array;
        let colorsNeedUpdate = false;

        for (let i = 0; i < positions.length; i += 3) {
            tempVec3.set(positions[i], positions[i + 1], positions[i + 2]);
            const distance = tempVec3.distanceTo(cameraPosition);

            // Ensure fadeRange is at least a small positive number to avoid division by zero
            const currentFadeRange = Math.max(1.0, fadeRange); // Use 1.0 or a small epsilon

            // Calculate fade factor (0 = no fade/close, 1 = full fade/far)
            const fadeFactor = Math.min(Math.max((distance - config.minFadeDistance) / currentFadeRange, 0), 1);

            // Interpolate color from base contour color to background color
            tempColor.copy(baseContourColor).lerp(fadeToBgColor, fadeFactor);

            // Update the color buffer only if the color actually changed significantly
            // Using a small threshold can sometimes reduce GPU buffer updates
            const threshold = 0.005; // Adjust if needed
            if (Math.abs(colors[i] - tempColor.r) > threshold || Math.abs(colors[i + 1] - tempColor.g) > threshold || Math.abs(colors[i + 2] - tempColor.b) > threshold) {
                colors[i] = tempColor.r;
                colors[i + 1] = tempColor.g;
                colors[i + 2] = tempColor.b;
                colorsNeedUpdate = true;
            }
        }

        // If any colors were changed, mark the attribute for update
        if (colorsNeedUpdate) {
            geometry.attributes.color.needsUpdate = true;
        }
    });

    // Update border visibility (redundant check, GUI onChange should handle it)
    // if (terrainBorder && terrainBorder.visible !== config.showTerrainBorder) {
    //     terrainBorder.visible = config.showTerrainBorder;
    // }

    renderer.render(scene, camera);
}

// --- Start ---
init();

// --- END OF FILE script.js ---
