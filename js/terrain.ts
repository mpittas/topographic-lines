import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { config, baseConfig, randomRanges, Styles } from './config.js';

// Import shaders as text (requires appropriate loader setup, e.g., vite-plugin-string)
// OR load them asynchronously if not using a loader
// Assuming vite-plugin-string or similar:
import lineFadeVertexShader from '../shaders/lineFadeVertex.glsl?raw';
import lineFadeFragmentShader from '../shaders/lineFadeFragment.glsl?raw';

// We need access to the camera, potentially pass it in or import from scene
import { camera } from './scene.js'; // Add .js // Assuming camera is exported from scene.ts

let terrainMesh: THREE.Mesh | null = null;
const contourLinesGroup = new THREE.Group();
let terrainBorder: THREE.Line | null = null;

// Generates terrain mesh using Perlin noise with configurable parameters
export function generateTerrain(): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(config.terrainSize, config.terrainSize, config.terrainSegments, config.terrainSegments);
    geometry.rotateX(-Math.PI / 2);

    const vertices = geometry.attributes.position.array as Float32Array;
    const noise = new ImprovedNoise();
    const noiseSeed = Math.random() * 100;

    const currentMaxHeight = config.terrainMaxHeight;
    const currentNoiseScale = config.noiseScale;
    const currentMinHeightFactor = config.minTerrainHeightFactor;
    const currentPlateauVolume = config.plateauVolume;

    const plateauCutoffHeight = currentMaxHeight * (1 - currentPlateauVolume * 0.5);

    for (let i = 0, j = 0; i < vertices.length; i++, j += 3) {
        const x = vertices[j], z = vertices[j + 2];
        const noise1 = noise.noise(x / currentNoiseScale, z / currentNoiseScale, noiseSeed);
        const noise2 = noise.noise(
            x / (currentNoiseScale * 1.2),
            z / (currentNoiseScale * 1.2),
            noiseSeed + 100
        );
        // Combine two noise layers for more natural terrain variation
        const combinedNoise = (noise1 * 0.97) + (noise2 * 0.03);
        const expNoise = (combinedNoise + 1) / 2;
        const slopeFactor = 1 + Math.abs(noise1 - noise2) * 0.1;
        let finalHeight = expNoise * currentMaxHeight * slopeFactor;

        if (currentPlateauVolume > 0 && finalHeight > plateauCutoffHeight) {
             finalHeight = plateauCutoffHeight + (finalHeight - plateauCutoffHeight) * (1 - currentPlateauVolume);
        }

        vertices[j + 1] = Math.max(
            currentMinHeightFactor * currentMaxHeight,
            finalHeight
        );
    }
    geometry.computeVertexNormals();
    geometry.attributes.position.needsUpdate = true;

    // --- use MeshBasicMaterial so colour shows without lights ---
    const material = new THREE.MeshBasicMaterial({
        color: config.contourColor, // SAME as "Line color"
        transparent: true,          // allow opacity for filled style
        opacity: 0.6,               // 60 % fill
        // side: THREE.DoubleSide,   // uncomment if you need both sides
    });

    if (!terrainMesh) {
        terrainMesh = new THREE.Mesh(geometry, material);
    } else {
        // Dispose old material before assigning new one
        if (terrainMesh.material) {
             (terrainMesh.material as THREE.Material).dispose();
        }
        terrainMesh.geometry.dispose();
        terrainMesh.geometry = geometry;
        terrainMesh.material = material;
    }

    // Set transparency/opacity ONLY when in FILLED_MOUNTAIN style
    // Otherwise, ensure it's fully opaque (or let the visibility handle it)
    material.transparent = (config.style === Styles.FILLED_MOUNTAIN);
    material.opacity = (config.style === Styles.FILLED_MOUNTAIN) ? 0.6 : 1.0;

    // Mesh is visible ONLY for the FILLED_MOUNTAIN style
    terrainMesh.visible = (config.style === Styles.FILLED_MOUNTAIN);

    return terrainMesh;
}

// Generates contour lines by finding height intersections with terrain geometry
export function generateContourLines(
    geometry: THREE.BufferGeometry,
    baseContourColor: THREE.Color,
    lineOpacity: number,
    style: string
): THREE.Group {
    while (contourLinesGroup.children.length > 0) {
        const line = contourLinesGroup.children[0] as THREE.LineSegments;
        if (line.geometry) line.geometry.dispose();
        contourLinesGroup.remove(line);
    }

    // Determine if lines should be generated (all styles require lines now)
    const shouldGenerateLines = true; // Lines are always generated now

    // --- Material Handling ---
    let contourMaterial: THREE.Material | null = null;

    // Use LineBasicMaterial for FILLED_MOUNTAIN and LINES_ONLY
    if (style === Styles.LINES_ONLY || style === Styles.FILLED_MOUNTAIN) {
        // Dispose previous shader material if switching
        if (contourLinesGroup.userData.sharedMaterial && !(contourLinesGroup.userData.sharedMaterial instanceof THREE.LineBasicMaterial)) {
             (contourLinesGroup.userData.sharedMaterial as THREE.Material).dispose();
            contourLinesGroup.userData.sharedMaterial = null;
        }
        // Create or update LineBasicMaterial
        if (!contourLinesGroup.userData.sharedMaterial) {
            contourLinesGroup.userData.sharedMaterial = new THREE.LineBasicMaterial({
                color: 0xffffff,
                linewidth: 2,
                vertexColors: true,
                depthTest: true,
                transparent: lineOpacity < 1.0,
                opacity: lineOpacity,
                depthWrite: true,
             });
        }
        contourMaterial = contourLinesGroup.userData.sharedMaterial as THREE.LineBasicMaterial;
        // Ensure material properties are correct
        (contourMaterial as THREE.LineBasicMaterial).color.set(0xffffff);
        (contourMaterial as THREE.LineBasicMaterial).vertexColors = true;
        (contourMaterial as THREE.LineBasicMaterial).transparent = lineOpacity < 1.0;
        (contourMaterial as THREE.LineBasicMaterial).opacity = lineOpacity;

        // *** Adjust depth testing for filled style to draw lines on top ***
        if (style === Styles.FILLED_MOUNTAIN) {
             (contourMaterial as THREE.LineBasicMaterial).depthTest = false;
             (contourMaterial as THREE.LineBasicMaterial).depthWrite = false;
        } else {
            (contourMaterial as THREE.LineBasicMaterial).depthTest = true;
            (contourMaterial as THREE.LineBasicMaterial).depthWrite = true;
        }

    } else if (style === Styles.FADING_LINES) {
        // Dispose previous basic material if switching
        if (contourLinesGroup.userData.sharedMaterial && !(contourLinesGroup.userData.sharedMaterial instanceof THREE.ShaderMaterial)) {
             (contourLinesGroup.userData.sharedMaterial as THREE.Material).dispose();
            contourLinesGroup.userData.sharedMaterial = null;
        }

        // Define fade heights
        const minHeight = config.minTerrainHeightFactor * config.terrainMaxHeight;
        const maxHeight = config.terrainMaxHeight;

        const uniforms = {
            baseColor: { value: baseContourColor },
            fogColor: { value: new THREE.Color(config.backgroundColor) },
            minFadeHeight: { value: minHeight },
            maxFadeHeight: { value: maxHeight },
            u_opacity: { value: lineOpacity }
        };

        if (!contourLinesGroup.userData.sharedMaterial) {
            contourLinesGroup.userData.sharedMaterial = new THREE.ShaderMaterial({
                uniforms: uniforms,
                vertexShader: lineFadeVertexShader,
                fragmentShader: lineFadeFragmentShader,
                transparent: true,
                linewidth: 2,
                depthTest: true, // Keep standard depth test for fading lines
                depthWrite: true,
            });
        } else {
            // Update uniforms
            const existingMaterial = contourLinesGroup.userData.sharedMaterial as THREE.ShaderMaterial;
            existingMaterial.uniforms.baseColor.value = baseContourColor;
            existingMaterial.uniforms.fogColor.value.set(config.backgroundColor);
            existingMaterial.uniforms.minFadeHeight.value = minHeight;
            existingMaterial.uniforms.maxFadeHeight.value = maxHeight;
            existingMaterial.uniforms.u_opacity.value = lineOpacity;
            // existingMaterial.needsUpdate = true; // Not usually needed for uniform updates
        }
        contourMaterial = contourLinesGroup.userData.sharedMaterial as THREE.ShaderMaterial;
    }

    if (!contourMaterial) {
        console.error("Material not properly set for contour lines.");
        contourLinesGroup.visible = false;
        return contourLinesGroup;
    }
    contourLinesGroup.visible = true; // Ensure group is visible if material succeeded

    const vertices = geometry.attributes.position.array as Float32Array;
    const index = geometry.index ? geometry.index.array as Uint16Array | Uint32Array : null;
    if (!index) { console.error("Geometry has no index buffer."); return new THREE.Group(); };
    const lines: { [key: number]: { points: number[], colors: number[] } } = {};

    function getIntersection(p1: THREE.Vector3, p2: THREE.Vector3, height: number): THREE.Vector3 | null {
        const p1y = p1.y; const p2y = p2.y;
        if ((p1y < height && p2y < height) || (p1y >= height && p2y >= height)) return null;
        const t = (height - p1y) / (p2y - p1y);
        return p1.clone().lerp(p2, t);
    }

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
             if (h < (currentMinHeightFactor * currentMaxHeight) && currentMinHeightFactor > 0) continue;
             if (h <= 0 && currentInterval > 0) continue;

            const intersections: THREE.Vector3[] = [];
            const edge12 = getIntersection(v1, v2, h), edge23 = getIntersection(v2, v3, h), edge31 = getIntersection(v3, v1, h);
            if (edge12) intersections.push(edge12); if (edge23) intersections.push(edge23); if (edge31) intersections.push(edge31);

            if (intersections.length >= 2) {
                if (!lines[h]) lines[h] = { points: [], colors: [] };
                lines[h].points.push(intersections[0].x, intersections[0].y, intersections[0].z, intersections[1].x, intersections[1].y, intersections[1].z);
                // Use the *current* baseContourColor for vertex colors when using LineBasicMaterial
                const r = baseContourColor.r;
                const g = baseContourColor.g;
                const b = baseContourColor.b;
                lines[h].colors.push(r, g, b, r, g, b);
                 if (intersections.length === 3) {
                     lines[h].points.push(intersections[1].x, intersections[1].y, intersections[1].z, intersections[2].x, intersections[2].y, intersections[2].z);
                     lines[h].colors.push(r, g, b, r, g, b);
                 }
            }
        }
    }

    for (const height in lines) {
        const levelData = lines[height];
        if (levelData.points.length > 0) {
            const lineGeometry = new THREE.BufferGeometry();
            lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(levelData.points, 3));

            // Set vertex colors only if using LineBasicMaterial with vertexColors=true
            if (contourMaterial instanceof THREE.LineBasicMaterial && contourMaterial.vertexColors) {
                lineGeometry.setAttribute('color', new THREE.Float32BufferAttribute(levelData.colors, 3));
            }

            lineGeometry.computeBoundingSphere();
            const contourLine = new THREE.LineSegments(lineGeometry, contourMaterial);
            contourLine.renderOrder = (style === Styles.FILLED_MOUNTAIN) ? 1 : 0; // Use renderOrder as alternative/addition to depthTest
            contourLinesGroup.add(contourLine);
        }
    }
    return contourLinesGroup;
}

// Creates a dashed border around the terrain perimeter
export function createTerrainBorder(scene: THREE.Scene): THREE.Line {
    if (terrainBorder) {
        if (terrainBorder.geometry) terrainBorder.geometry.dispose();
        if (terrainBorder.material) (terrainBorder.material as THREE.Material).dispose();
        scene.remove(terrainBorder);
        terrainBorder = null;
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
    return terrainBorder;
}

export function randomizeTerrainSettings(): void {
    config.terrainMaxHeight = Math.random() * (300 - 20) + 20;

    config.noiseScale = Math.random() * (200 - 70) + 70;

    config.minTerrainHeightFactor = Math.max(0, Math.min(0.5,
        baseConfig.minTerrainHeightFactor + (Math.random() - 0.5) * randomRanges.minHeightRange * 2));

    config.plateauVolume = Math.random();

    if (randomRanges.enableIntervalRandomization) {
        config.contourInterval = Math.floor(Math.random() * 7) + 2;
    }

    config.plateauVolume = Math.random();

    if (randomRanges.enableIntervalRandomization) {
        config.contourInterval = Math.floor(Math.random() * 7) + 2;
    }
}