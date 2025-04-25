import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { config } from './config'; 

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;

// --- Initialization ---
export function initScene(container: HTMLElement): { scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, controls: OrbitControls } {
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
export function updateFog(): void {
    if (!scene) return;

    const intensity = config.fogIntensity;
    const bgColor = config.backgroundColor;
    const minDistance = config.minFadeDistance;
    const maxDistance = config.maxFadeDistance;
    const range = maxDistance - minDistance;

    if (intensity <= 0) {
        // Disable fog by setting distances very far
        if (scene.fog) {
             // Update existing fog if possible, otherwise create new
            scene.fog.color.set(bgColor);
            scene.fog.near = maxDistance * 100; // Effectively disable
            scene.fog.far = maxDistance * 101;
        } else {
            scene.fog = new THREE.Fog(bgColor, maxDistance * 100, maxDistance * 101);
        }
    } else {
        // Calculate interpolated distances based on intensity
        // Near distance moves from maxDistance towards minDistance as intensity increases
        const near = maxDistance - range * intensity;
        // Far distance starts far and moves towards maxDistance as intensity increases
        // Let's make it extend further out when intensity is low
        const far = maxDistance + range * (1 - intensity) * 1.5; // Adjust multiplier as needed

        if (scene.fog) {
            // Update existing fog
            scene.fog.color.set(bgColor);
            scene.fog.near = near;
            scene.fog.far = far;
        } else {
            // Create new fog
            scene.fog = new THREE.Fog(bgColor, near, far);
        }
    }
}

// --- Controls Update ---
export function updateControls(): void {
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
function onWindowResize(): void {
    if (!camera || !renderer) return;
    const aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // No need to re-render here, the animation loop handles it
}

// --- Cleanup ---
export function disposeScene(): void {
    window.removeEventListener('resize', onWindowResize);
    if (controls) controls.dispose();
    if (renderer) renderer.dispose();
    if (scene) {
        // Dispose geometries, materials, textures in the scene if necessary
        // (Terrain and contours handle their own disposal)
    }
    // Clear references
    // scene = null; // Cannot assign null to type Scene
    // camera = null; // Cannot assign null to type PerspectiveCamera
    // renderer = null; // Cannot assign null to type WebGLRenderer
    // controls = null; // Cannot assign null to type OrbitControls
}