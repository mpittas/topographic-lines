import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { config } from './config.js';

let scene, camera, renderer, controls;

// --- Initialization ---
export function initScene(container) {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(config.backgroundColor); // Initial background
    updateFog(); // Initial fog setup

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
        precision: 'mediump', // Balance quality and performance
        powerPreference: 'high-performance',
        alpha: true // Enable transparency for export
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance
    container.appendChild(renderer.domElement); // Append to the provided container (document.body)

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    updateControls(); // Apply initial control settings

    // Event Listeners
    window.addEventListener('resize', onWindowResize, false);

    return { scene, camera, renderer, controls };
}

// --- Fog Update ---
export function updateFog() {
    if (!scene) return;
    // Clear existing fog first
    if (scene.fog) scene.fog = null;
    // Use the fixed config values for fog distance, but current background color
    scene.fog = new THREE.Fog(config.backgroundColor, config.maxFadeDistance * 0.8, config.maxFadeDistance * 1.4);
}

// --- Controls Update ---
export function updateControls() {
    if (!controls) return;
    controls.enableRotate = config.enableRotate || config.enableVerticalRotate;
    controls.enableZoom = config.enableZoom;
    controls.enablePan = false; // Keep panning disabled

    // Use the fixed config values for zoom limits
    controls.minDistance = config.minZoomDistance;
    controls.maxDistance = config.maxZoomDistance;

    // Set polar angle limits based on vertical rotation setting
    if (config.enableVerticalRotate) {
        controls.minPolarAngle = 0.1; // Allow almost vertical view
        controls.maxPolarAngle = Math.PI - 0.1; // Allow almost bottom view
    } else {
        // Lock to the fixed angle
        controls.minPolarAngle = config.fixedVerticalAngle;
        controls.maxPolarAngle = config.fixedVerticalAngle;
    }

    controls.target.set(0, 0, 0); // Ensure controls target the center
    controls.update(); // Apply changes
}

// --- Window Resize ---
function onWindowResize() {
    if (!camera || !renderer) return;
    const aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // No need to re-render here, the animation loop handles it
}

// --- Cleanup ---
export function disposeScene() {
    window.removeEventListener('resize', onWindowResize);
    if (controls) controls.dispose();
    if (renderer) renderer.dispose();
    if (scene) {
        // Dispose geometries, materials, textures in the scene if necessary
        // (Terrain and contours handle their own disposal)
    }
    // Clear references
    scene = null;
    camera = null;
    renderer = null;
    controls = null;
}