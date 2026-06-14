/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

// We import loaders when needed or load them dynamically.
// To ensure perfect compile safety regardless of Three.js subfolder setups in the environments,
// we write a dynamic loader that imports GLTFLoader, STLLoader, or OBJLoader as needed.

export async function parseModelFile(
  file: File
): Promise<{ mesh: THREE.Group | THREE.Mesh; name: string }> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const fileUrl = URL.createObjectURL(file);

  try {
    if (extension === 'glb' || extension === 'gltf') {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const loader = new GLTFLoader();
      return new Promise((resolve, reject) => {
        loader.load(
          fileUrl,
          (gltf) => {
            // Success
            const group = gltf.scene;
            // Clean/scale
            normalizeGroupSize(group);
            resolve({ mesh: group, name: file.name });
          },
          undefined,
          (err) => reject(err)
        );
      });
    } else if (extension === 'stl') {
      const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
      const loader = new STLLoader();
      return new Promise((resolve, reject) => {
        loader.load(
          fileUrl,
          (geometry) => {
            const material = new THREE.MeshStandardMaterial({
              color: 0xcccccc,
              metalness: 0.8,
              roughness: 0.2,
            });
            const mesh = new THREE.Mesh(geometry, material);
            const group = new THREE.Group();
            group.add(mesh);
            normalizeGroupSize(group);
            resolve({ mesh: group, name: file.name });
          },
          undefined,
          (err) => reject(err)
        );
      });
    } else if (extension === 'obj') {
      const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
      const loader = new OBJLoader();
      return new Promise((resolve, reject) => {
        loader.load(
          fileUrl,
          (obj) => {
            normalizeGroupSize(obj);
            resolve({ mesh: obj, name: file.name });
          },
          undefined,
          (err) => reject(err)
        );
      });
    } else {
      throw new Error("Formato non supportato. File caricabili: .glb, .gltf, .stl, .obj");
    }
  } catch (err: any) {
    console.error("Model loader error:", err);
    throw new Error(`Errore durante il caricamento del modello: ${err?.message || err}`);
  } finally {
    // We clean up the object URL after loaded
    setTimeout(() => {
      URL.revokeObjectURL(fileUrl);
    }, 10000);
  }
}

/**
 * Normalizes the group dimensions so it perfectly fits a 25x20x15 bounding box
 */
function normalizeGroupSize(group: THREE.Group | THREE.Object3D) {
  // Compute current bounding box
  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  box.getSize(size);

  const center = new THREE.Vector3();
  box.getCenter(center);

  // Translate to center (0,0,0)
  group.position.x -= center.x;
  group.position.y -= center.y;
  group.position.z -= center.z;

  // Max dimension scale to fit ~ 25 cm length, 20 cm width, 15 cm height
  const targetX = 20;
  const targetY = 15;
  const targetZ = 25;

  const scaleX = targetX / (size.x || 1);
  const scaleY = targetY / (size.y || 1);
  const scaleZ = targetZ / (size.z || 1);

  // Uniform scale using minimum to preserve proportions
  const scaleFactor = Math.min(scaleX, scaleY, scaleZ);
  group.scale.set(scaleFactor, scaleFactor, scaleFactor);

  // Position it so base is at y = 0
  group.position.y += (size.y * scaleFactor) / 2;

  // Rotate 180 degrees around Y axis if the importer faces backward, standardise
  // We can let the user flip/rotate it inside the UI in case it faces sideways
}
