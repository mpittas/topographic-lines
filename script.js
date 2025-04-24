// --- START OF FILE script.js ---

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// Using Perlin noise from Three.js examples (ImprovedNoise)
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

let scene, camera, renderer, controls;
let terrainMesh;
const contourLinesGroup = new THREE.Group(); // Group to hold all contour lines

// --- Configuration ---
const terrainSize = 800; // Size of the terrain plane
const terrainSegments = 150; // Increased resolution slightly for smoother large peaks
const terrainMaxHeight = 120; // Slightly increased height for more prominent peaks
const noiseScale = 200; // << INCREASED SIGNIFICANTLY for fewer, larger features (was 50)
const contourInterval = 5; // Height difference between contour lines
const contourColor = 0xd95f20; // Orange color like the example
const backgroundColor = 0xf0efe6; // Off-white background

// --- NEW: Terrain Base Height Configuration ---
// Controls how low the valleys go. 0 = valleys can reach height 0.
// 0.1 = minimum height is 10% of terrainMaxHeight, reducing "spacing".
// Adjust this value (0.0 to maybe 0.3) to control valley depth.
const minTerrainHeightFactor = 0.1; // << NEW PROP (e.g., 0.1 means 10% min height)

// Distance Fading Configuration ("Props" to control the fade)
// Adjust these values to control how the lines fade with distance:
const minFadeDistance = 160; // Start fading lines closer (previously terrainSize * 0.2)
const maxFadeDistance = 960; // Lines fully faded further out (previously terrainSize * 1.2)
const fadeRange = maxFadeDistance - minFadeDistance; // Pre-calculate range

// --- NEW: Zoom Limit Configuration ---
// Define min/max zoom distances directly (approximates previous calculation)
const minZoomDistance = 220; // Minimum distance camera can be from the center
const maxZoomDistance = 340; // Maximum distance camera can be from the center

// Pre-create colors for performance in animate loop
const baseContourColor = new THREE.Color(contourColor);
const fadeToBgColor = new THREE.Color(backgroundColor);

// --- Initialization ---
function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);

    // Add fog (still useful for far clipping, though fading is handled differently now)
    // Adjusted fog to start earlier and end further to blend with new fade distances
    scene.fog = new THREE.Fog(backgroundColor, maxFadeDistance * 0.8, maxFadeDistance * 1.4); // Adjusted factors (was 0.9, 1.5)

    // Camera (Perspective for an angled top-down view)
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(65, aspect, 1, terrainSize * 2);

    // Position camera to better fill viewport, adjusted slightly for potentially taller peaks
    camera.position.set(0, terrainMaxHeight * 2.0, terrainMaxHeight * 1.2); // Adjusted Y and Z slightly
    camera.lookAt(0, 0, 0);

    // Renderer with optimizations
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        precision: 'mediump', // 'highp', 'mediump' or 'lowp'
        powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance
    document.body.appendChild(renderer.domElement);

    // Controls (Allow only horizontal rotation)
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableRotate = true;
    // --- MODIFICATION: Enable Zoom ---
    controls.enableZoom = true; // << CHANGED from false
    controls.enablePan = false;

    // --- MODIFICATION: Add Zoom Limits ---
    // Adjust these values as needed
    // controls.minDistance = terrainMaxHeight * 0.75; // OLD - Now uses config variable
    // controls.maxDistance = terrainSize * 1.5;      // OLD - Now uses config variable
    controls.minDistance = minZoomDistance; // Use configured min zoom
    controls.maxDistance = maxZoomDistance; // Use configured max zoom

    // Lock vertical rotation (allow only horizontal)
    controls.minPolarAngle = Math.PI / 3.5; // Adjusted for better view
    controls.maxPolarAngle = Math.PI / 3.5; // Lock at same angle

    // Set initial position
    controls.target.set(0, 0, 0);
    controls.update();

    // Terrain Generation
    terrainMesh = generateTerrain();
    // scene.add(terrainMesh); // Optional: show the terrain mesh itself

    // Contour Line Generation (uses distance fade in animate loop)
    generateContourLines(terrainMesh.geometry, contourInterval, terrainMaxHeight);
    scene.add(contourLinesGroup);

    // Hide info message
    const infoElement = document.getElementById('info');
    if (infoElement) {
        infoElement.style.display = 'none';
    }


    // Event Listeners
    window.addEventListener('resize', onWindowResize, false);

    // Start Animation Loop
    animate();
}

// --- Terrain Generation ---
function generateTerrain() {
    const geometry = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegments, terrainSegments);
    geometry.rotateX(-Math.PI / 2); // Rotate plane to be horizontal

    const vertices = geometry.attributes.position.array;
    const noise = new ImprovedNoise();

    for (let i = 0, j = 0; i < vertices.length; i++, j += 3) {
        const x = vertices[j];
        const z = vertices[j + 2]; // Use z for depth since we rotated

        // --- MODIFICATION START: Adjust height mapping ---
        // Get the raw noise value (typically ~ -1 to 1)
        const noiseValue = noise.noise(x / noiseScale, z / noiseScale, 0);

        // Normalize the noise value to the range [0, 1]
        const normalizedHeightZeroToOne = (noiseValue + 1) / 2;

        // Map the [0, 1] range to [minTerrainHeightFactor, 1]
        // This scales the height variation into the top part of the range
        // and adds the minimum factor as a base height.
        const mappedHeightFactor = (normalizedHeightZeroToOne * (1 - minTerrainHeightFactor)) + minTerrainHeightFactor;

        // Apply the mapped height scaled by the max height
        vertices[j + 1] = mappedHeightFactor * terrainMaxHeight;
        // --- MODIFICATION END ---
    }

    geometry.computeVertexNormals(); // Still useful if mesh is shown
    geometry.attributes.position.needsUpdate = true;

    // Basic material if we were to show the mesh
    const material = new THREE.MeshBasicMaterial({ color: 0xcccccc, wireframe: true, visible: false });

    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
}

// --- Contour Line Generation ---
// (No changes needed in this function)
function generateContourLines(geometry, interval, maxHeight) {
    const vertices = geometry.attributes.position.array;
    const index = geometry.index.array;
    // Enable vertex colors and increase line width
    const contourMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff, // Base color is white when using vertex colors
        linewidth: 2, // Increase line width (Note: > 1 might not work everywhere)
        vertexColors: true // IMPORTANT: This enables per-vertex coloring
    });

    const lines = {}; // Object to hold points and colors for each contour level

    // Helper function for linear interpolation
    function getIntersection(p1, p2, height) {
        const p1y = p1.y;
        const p2y = p2.y;
        if ((p1y < height && p2y < height) || (p1y >= height && p2y >= height)) {
            return null; // Edge doesn't cross the contour plane
        }
        // Interpolate position
        const t = (height - p1y) / (p2y - p1y);
        return p1.clone().lerp(p2, t);
    }

    // Iterate through each triangle (face) in the geometry
    for (let i = 0; i < index.length; i += 3) {
        const i1 = index[i];
        const i2 = index[i + 1];
        const i3 = index[i + 2];

        const v1 = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, i1);
        const v2 = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, i2);
        const v3 = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, i3);

        const triangleVertices = [v1, v2, v3];
        const minY = Math.min(v1.y, v2.y, v3.y);
        const maxY = Math.max(v1.y, v2.y, v3.y);

        // Check each contour level
        for (let h = Math.ceil(minY / interval) * interval; h <= maxY && h < maxHeight; h += interval) {
            // --- MODIFICATION: Adjust check slightly due to raised base height ---
            // Only skip if the contour level is strictly below the minimum possible terrain height
            if (h < (minTerrainHeightFactor * maxHeight) && h <= 0) continue; // Keep skipping 0 if factor is 0
            // A simpler check might be sufficient if minTerrainHeightFactor > 0:
            // if (h < interval) continue; // Skip the very first interval if it's too low

            const intersections = [];

            // Check intersections with triangle edges
            const edge12 = getIntersection(v1, v2, h);
            const edge23 = getIntersection(v2, v3, h);
            const edge31 = getIntersection(v3, v1, h);

            if (edge12) intersections.push(edge12);
            if (edge23) intersections.push(edge23);
            if (edge31) intersections.push(edge31);

            // A triangle crossing a plane should have 2 intersection points
            if (intersections.length >= 2) {
                if (!lines[h]) {
                    lines[h] = { points: [], colors: [] }; // Store points and colors
                }

                // Add the base color here. The fading happens in animate().
                const baseColor = baseContourColor; // Use the pre-defined base color

                // Add the two points forming the line segment
                lines[h].points.push(intersections[0].x, intersections[0].y, intersections[0].z);
                lines[h].points.push(intersections[1].x, intersections[1].y, intersections[1].z);
                // Add base colors for the two points (will be updated each frame)
                lines[h].colors.push(baseColor.r, baseColor.g, baseColor.b);
                lines[h].colors.push(baseColor.r, baseColor.g, baseColor.b);

                 // Handle rare case of 3 intersections (e.g., vertex lies exactly on contour plane)
                 if (intersections.length === 3) {
                     // Connect 0-2 and 1-2 to avoid ambiguity or just use 0-1, 1-2
                     lines[h].points.push(intersections[1].x, intersections[1].y, intersections[1].z);
                     lines[h].points.push(intersections[2].x, intersections[2].y, intersections[2].z);
                     lines[h].colors.push(baseColor.r, baseColor.g, baseColor.b);
                     lines[h].colors.push(baseColor.r, baseColor.g, baseColor.b);
                 }
            }
        }
    }

    // Create LineSegments for each contour level
    for (const height in lines) {
        const levelData = lines[height];
        if (levelData.points.length > 0) {
            const lineGeometry = new THREE.BufferGeometry();
            lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(levelData.points, 3));
            // IMPORTANT: Add color attribute, initialized with base colors
            lineGeometry.setAttribute('color', new THREE.Float32BufferAttribute(levelData.colors, 3));
            lineGeometry.computeBoundingSphere(); // Compute sphere for culling
            const contourLine = new THREE.LineSegments(lineGeometry, contourMaterial);
            contourLinesGroup.add(contourLine); // Add to the group
        }
    }
}


// --- Window Resize ---
function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Animation Loop with Culling and Distance Fading ---
const tempVec3 = new THREE.Vector3(); // Reusable vector to avoid allocations in loop
const tempColor = new THREE.Color(); // Reusable color

function animate() {
    requestAnimationFrame(animate);
    controls.update(); // Update camera position based on controls

    // --- Frustum Culling (Optional - currently disabled in favor of smooth fade) ---
    // const projScreenMatrix = new THREE.Matrix4();
    // projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    // const frustum = new THREE.Frustum();
    // frustum.setFromProjectionMatrix(projScreenMatrix);

    // --- Distance-Based Vertex Color Fading ---
    const cameraPosition = camera.position;

    contourLinesGroup.children.forEach(line => {
        // Optional: Full object culling based on bounding sphere
        // line.visible = frustum.intersectsSphere(line.geometry.boundingSphere);
        // if (!line.visible) return; // Skip invisible lines entirely

        // Ensure lines are potentially renderable even if we don't use frustum culling above
        line.visible = true;

        const geometry = line.geometry;
        const positions = geometry.attributes.position.array;
        const colors = geometry.attributes.color.array;
        let colorsNeedUpdate = false;

        for (let i = 0; i < positions.length; i += 3) {
            tempVec3.set(positions[i], positions[i + 1], positions[i + 2]);
            const distance = tempVec3.distanceTo(cameraPosition);

            // Calculate fade factor (0 = no fade/close, 1 = full fade/far)
            // Clamped between 0 and 1
            const fadeFactor = Math.min(Math.max((distance - minFadeDistance) / fadeRange, 0), 1);

            // Interpolate color from base contour color to background color
            tempColor.copy(baseContourColor).lerp(fadeToBgColor, fadeFactor);

            // Update the color buffer only if the color actually changed significantly
            // (Minor optimization, might not be necessary)
            // if (Math.abs(colors[i] - tempColor.r) > 0.01 || Math.abs(colors[i+1] - tempColor.g) > 0.01 || Math.abs(colors[i+2] - tempColor.b) > 0.01) {
                colors[i] = tempColor.r;
                colors[i + 1] = tempColor.g;
                colors[i + 2] = tempColor.b;
                colorsNeedUpdate = true;
            // }
        }

        // If any colors were changed, mark the attribute for update
        if (colorsNeedUpdate) {
            geometry.attributes.color.needsUpdate = true;
        }
    });

    renderer.render(scene, camera);
}

// --- Start ---
init();

// --- END OF FILE script.js ---
