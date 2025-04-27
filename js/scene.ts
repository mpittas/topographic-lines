import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { config } from './config.js';

let scene: THREE.Scene;
export let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;

// Initializes Three.js scene with camera, renderer and orbit controls
export function initScene(container: HTMLElement): { scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, controls: OrbitControls } {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(config.backgroundColor);
    updateFog();

    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(65, aspect, 1, config.terrainSize * 2.5);
    // Position camera at midpoint between min/max zoom distances
    const initialRadius = (config.minZoomDistance + config.maxZoomDistance) / 2;
    camera.position.set(
        0,
        initialRadius * Math.cos(Math.PI / 3),
        initialRadius * Math.sin(Math.PI / 3)
    );
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        precision: 'mediump',
        powerPreference: 'high-performance',
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    updateControls();

    window.addEventListener('resize', onWindowResize, false);

    return { scene, camera, renderer, controls };
}

// Updates scene fog based on intensity and distance config
export function updateFog(): void {
    if (!scene) return;

    const intensity = config.fogIntensity;
    const bgColor = config.backgroundColor;
    const minDistance = config.minFadeDistance;
    const maxDistance = config.maxFadeDistance;

    // Smooth linear fog mapping: no fog at 0, increasing fade range at full intensity
    if (intensity <= 0) {
        // Disable scene fog entirely
        scene.fog = null;
    } else {
        // Linearly interpolate fog start (near) between maxDistance and minDistance
        const near = maxDistance - (maxDistance - minDistance) * intensity;
        const far = maxDistance;

        if (scene.fog) {
            scene.fog.color.set(bgColor);
            if ('near' in scene.fog) {
                scene.fog.near = near;
                scene.fog.far = far;
            } else {
                scene.fog = new THREE.Fog(bgColor, near, far);
            }
        } else {
            scene.fog = new THREE.Fog(bgColor, near, far);
        }
    }
}

// Configures orbit controls based on current settings
export function updateControls(): void {
    if (!controls) return;
    controls.enableRotate = config.enableRotate;
    controls.enableZoom = config.enableZoom;
    controls.enablePan = false;

    controls.minDistance = config.minZoomDistance;
    controls.maxDistance = config.maxZoomDistance;

    controls.minPolarAngle = 0.5;
    controls.maxPolarAngle = Math.PI / 2.25 - config.cameraMinPitchAngle;

    controls.target.set(0, 0, 0);
    controls.update();
}

function onWindowResize(): void {
    if (!camera || !renderer) return;
    const aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

export function disposeScene(): void {
    window.removeEventListener('resize', onWindowResize);
    if (controls) controls.dispose();
    if (renderer) renderer.dispose();
    if (scene) {
    }
}
