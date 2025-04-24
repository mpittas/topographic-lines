import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// Using Perlin noise from Three.js examples (ImprovedNoise)
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

let scene, camera, renderer, controls;
let terrainMesh;
const contourLinesGroup = new THREE.Group(); // Group to hold all contour lines

// --- Configuration ---
const terrainSize = 800; // Increased from 500 to fill more of viewport
const terrainSegments = 120; // Slightly increased resolution
const terrainMaxHeight = 100; // Increased height for more prominent peaks
const noiseScale = 50; // Increased scale for fewer, larger features
const contourInterval = 5; // Height difference between contour lines
const contourColor = 0xd95f20; // Orange color like the example
const backgroundColor = 0xf0efe6; // Off-white background

// --- Initialization ---
function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
    
    // Add fog to help with performance (fade out distant terrain)
    scene.fog = new THREE.Fog(backgroundColor, terrainSize * 0.8, terrainSize * 1.5);

    // Camera (Perspective for an angled top-down view)
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(65, aspect, 1, terrainSize * 2);

    // Position camera to better fill viewport
    camera.position.set(0, terrainMaxHeight * 1.8, terrainMaxHeight * 1.1);
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
    controls.enableZoom = false;
    controls.enablePan = false;
    
    // Lock vertical rotation (allow only horizontal)
    controls.minPolarAngle = Math.PI / 3.5; // Adjusted for better view
    controls.maxPolarAngle = Math.PI / 3.5; // Lock at same angle
    
    // Set initial position
    controls.target.set(0, 0, 0);
    controls.update();

    // Create a frustum to aid with culling
    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();
    
    // Terrain Generation
    terrainMesh = generateTerrain();
    // scene.add(terrainMesh); // Optional: show the terrain mesh itself

    // Contour Line Generation with frustum culling
    generateContourLines(terrainMesh.geometry, contourInterval, terrainMaxHeight);
    scene.add(contourLinesGroup);

    // Hide info message
    document.getElementById('info').style.display = 'none';

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

        // Apply noise based on world position
        vertices[j + 1] = noise.noise(x / noiseScale, z / noiseScale, 0) * terrainMaxHeight;
    }

    geometry.computeVertexNormals();
    geometry.attributes.position.needsUpdate = true;

    // Basic material if we were to show the mesh
    const material = new THREE.MeshBasicMaterial({ color: 0xcccccc, wireframe: true, visible: false });

    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
}

// --- Contour Line Generation ---
function generateContourLines(geometry, interval, maxHeight) {
    const vertices = geometry.attributes.position.array;
    const index = geometry.index.array;
    // Enable vertex colors and increase line width
    const contourMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff, // Base color is white when using vertex colors
        linewidth: 2, // Increase line width (Note: > 1 might not work everywhere)
        vertexColors: true
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
            if (h <= 0) continue; // Skip contours at or below sea level for clarity

            const levelPoints = [];
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
                // Calculate fade factor (0 = full color, 1 = fully faded)
                const fadeFactor = Math.min(Math.max(h / maxHeight, 0), 1);
                const baseColor = new THREE.Color(contourColor);
                const fadeToColor = new THREE.Color(backgroundColor);
                const segmentColor = baseColor.clone().lerp(fadeToColor, fadeFactor);

                // Add the two points forming the line segment
                lines[h].points.push(intersections[0].x, intersections[0].y, intersections[0].z);
                lines[h].points.push(intersections[1].x, intersections[1].y, intersections[1].z);
                // Add colors for the two points
                lines[h].colors.push(segmentColor.r, segmentColor.g, segmentColor.b);
                lines[h].colors.push(segmentColor.r, segmentColor.g, segmentColor.b);

                 // Handle rare case of 3 intersections
                 if (intersections.length === 3) {
                     lines[h].points.push(intersections[0].x, intersections[0].y, intersections[0].z);
                     lines[h].points.push(intersections[2].x, intersections[2].y, intersections[2].z);
                     lines[h].colors.push(segmentColor.r, segmentColor.g, segmentColor.b);
                     lines[h].colors.push(segmentColor.r, segmentColor.g, segmentColor.b);

                     lines[h].points.push(intersections[1].x, intersections[1].y, intersections[1].z);
                     lines[h].points.push(intersections[2].x, intersections[2].y, intersections[2].z);
                     lines[h].colors.push(segmentColor.r, segmentColor.g, segmentColor.b);
                     lines[h].colors.push(segmentColor.r, segmentColor.g, segmentColor.b);
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
            lineGeometry.setAttribute('color', new THREE.Float32BufferAttribute(levelData.colors, 3)); // Add color attribute
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

// --- Animation Loop with Culling ---
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    
    // Update the frustum to match the current camera
    const projScreenMatrix = new THREE.Matrix4();
    projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const frustum = new THREE.Frustum();
    frustum.setFromProjectionMatrix(projScreenMatrix);
    
    // Set visibility for contour lines based on frustum
    contourLinesGroup.children.forEach(line => {
        if (line.geometry.boundingSphere === null) {
            line.geometry.computeBoundingSphere();
        }
        // Check if the bounding sphere of this line intersects with the camera frustum
        line.visible = frustum.intersectsSphere(line.geometry.boundingSphere);
    });
    
    renderer.render(scene, camera);
}

// --- Start ---
init();