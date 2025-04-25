import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { config, baseConfig, randomRanges } from './config.js';

let terrainMesh = null;
const contourLinesGroup = new THREE.Group();
let terrainBorder = null;

// --- Terrain Generation ---
export function generateTerrain() {
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
        // Single-scale noise for cohesive formations
        const noise2 = noise.noise(
            x / (currentNoiseScale * 1.2),  // Slightly larger scale
            z / (currentNoiseScale * 1.2),
            noiseSeed + 100
        );
        // Strong primary noise dominance
        const combinedNoise = (noise1 * 0.97) + (noise2 * 0.03);  // 97/3 ratio
        // Linear scaling for smooth slopes
        const expNoise = (combinedNoise + 1) / 2;  // Removed exponential scaling
        // Nearly flat erosion effect
        const slopeFactor = 1 + Math.abs(noise1 - noise2) * 0.1;  // Reduced to 0.1
        // Very high minimum elevation
        // const minHeight = currentMinHeightFactor * currentMaxHeight * 1.7; // This wasn't used, removed
        const finalHeight = expNoise * currentMaxHeight * slopeFactor;

        // Apply minimum height factor
        vertices[j + 1] = Math.max(
            currentMinHeightFactor * currentMaxHeight,
            finalHeight
        );
    }
    geometry.computeVertexNormals();
    geometry.attributes.position.needsUpdate = true;

    // Use a basic material, visibility is handled elsewhere or not needed if only contours are shown
    const material = new THREE.MeshBasicMaterial({ color: 0xcccccc, wireframe: true, visible: false });
    if (!terrainMesh) {
        terrainMesh = new THREE.Mesh(geometry, material);
    } else {
        terrainMesh.geometry = geometry; // Reuse mesh object, replace geometry
    }
    return terrainMesh;
}

// --- Contour Line Generation ---
export function generateContourLines(geometry, baseContourColor) {
    // Clear existing lines
    while (contourLinesGroup.children.length > 0) {
        const line = contourLinesGroup.children[0];
        if (line.geometry) line.geometry.dispose();
        // Material is shared, dispose separately
        contourLinesGroup.remove(line);
    }
    if (contourLinesGroup.userData.sharedMaterial) {
        contourLinesGroup.userData.sharedMaterial.dispose();
        contourLinesGroup.userData.sharedMaterial = null;
    }

    const vertices = geometry.attributes.position.array;
    const index = geometry.index ? geometry.index.array : null;
    if (!index) { console.error("Geometry has no index buffer."); return null; }; // Return null or empty group

    // Create one shared material for all lines
    const contourMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2, vertexColors: true });
    contourLinesGroup.userData.sharedMaterial = contourMaterial; // Store for disposal

    const lines = {}; // Store points and colors per height level

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
             // Skip contours below the minimum height factor threshold if it's positive
             if (h < (currentMinHeightFactor * currentMaxHeight) && currentMinHeightFactor > 0) continue;
             // Skip zero/negative height contours if interval is positive (avoids issues with flat bases at y=0)
             if (h <= 0 && currentInterval > 0) continue;

            const intersections = [];
            const edge12 = getIntersection(v1, v2, h), edge23 = getIntersection(v2, v3, h), edge31 = getIntersection(v3, v1, h);
            if (edge12) intersections.push(edge12); if (edge23) intersections.push(edge23); if (edge31) intersections.push(edge31);

            if (intersections.length >= 2) {
                if (!lines[h]) lines[h] = { points: [], colors: [] };
                // Use the passed baseContourColor
                lines[h].points.push(intersections[0].x, intersections[0].y, intersections[0].z, intersections[1].x, intersections[1].y, intersections[1].z);
                lines[h].colors.push(baseContourColor.r, baseContourColor.g, baseContourColor.b, baseContourColor.r, baseContourColor.g, baseContourColor.b);
                 if (intersections.length === 3) { // Handle intersections on all 3 edges (rare)
                     lines[h].points.push(intersections[1].x, intersections[1].y, intersections[1].z, intersections[2].x, intersections[2].y, intersections[2].z);
                     lines[h].colors.push(baseContourColor.r, baseContourColor.g, baseContourColor.b, baseContourColor.r, baseContourColor.g, baseContourColor.b);
                 }
            }
        }
    }

    // Create LineSegments for each height level
    for (const height in lines) {
        const levelData = lines[height];
        if (levelData.points.length > 0) {
            const lineGeometry = new THREE.BufferGeometry();
            lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(levelData.points, 3));
            lineGeometry.setAttribute('color', new THREE.Float32BufferAttribute(levelData.colors, 3));
            lineGeometry.computeBoundingSphere(); // Important for visibility checks/frustum culling
            const contourLine = new THREE.LineSegments(lineGeometry, contourMaterial); // Use shared material
            contourLinesGroup.add(contourLine);
        }
    }
    return contourLinesGroup; // Return the group containing all lines
}


// --- Create Terrain Border ---
export function createTerrainBorder(scene) {
    if (terrainBorder) {
        if (terrainBorder.geometry) terrainBorder.geometry.dispose();
        if (terrainBorder.material) terrainBorder.material.dispose();
        scene.remove(terrainBorder); // Remove from the scene passed as argument
        terrainBorder = null;
    }

    const halfSize = config.terrainSize / 2;
    const points = [
        new THREE.Vector3(-halfSize, 0, -halfSize), new THREE.Vector3( halfSize, 0, -halfSize),
        new THREE.Vector3( halfSize, 0,  halfSize), new THREE.Vector3(-halfSize, 0,  halfSize),
        new THREE.Vector3(-halfSize, 0, -halfSize) // Close the loop
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({ color: 0x000000, linewidth: 1, scale: 1, dashSize: 10, gapSize: 5 });
    terrainBorder = new THREE.Line(geometry, material);
    terrainBorder.computeLineDistances(); // Required for dashed lines
    terrainBorder.visible = config.showTerrainBorder;
    scene.add(terrainBorder); // Add to the scene passed as argument
    return terrainBorder;
}

// --- Randomize Settings ---
export function randomizeTerrainSettings() {
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
    // else: keep the value set by the GUI

    // Ensure values don't go below reasonable minimums
    config.terrainMaxHeight = Math.max(10, config.terrainMaxHeight);
    config.noiseScale = Math.max(10, config.noiseScale);

    console.log("Randomized Settings:", {
        maxH: config.terrainMaxHeight.toFixed(1) + ` (base ${baseConfig.terrainMaxHeight} ±${randomRanges.heightRange}%)`,
        noiseS: config.noiseScale.toFixed(1) + ` (base ${baseConfig.noiseScale} ±${randomRanges.noiseRange}%)`,
        minHF: config.minTerrainHeightFactor.toFixed(2) + ` (base ${baseConfig.minTerrainHeightFactor} ±${randomRanges.minHeightRange})`,
        interval: config.contourInterval + (randomRanges.enableIntervalRandomization ? ` (random 1-${randomRanges.intervalRange})` : ' (manual)')
    });

    // Note: updateDerivedConfig() might be needed if randomization affects derived values directly
    // Currently, it only affects fadeRange which is recalculated in the animation loop anyway.
}