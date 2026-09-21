import fs from 'fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// Polyfill minimal browser globals for FBXLoader in node
if (typeof global.window === 'undefined') {
  global.window = global;
}
if (typeof global.document === 'undefined') {
  global.document = {
    createElementNS: () => ({}),
    createElement: () => ({})
  };
}

const fbxPath = '/Users/piyushkumar/Desktop/SIH/26047/3D modal.fbx';
console.log('Reading FBX file from:', fbxPath);
const buffer = fs.readFileSync(fbxPath);
console.log(`Buffer read (${(buffer.length / 1024 / 1024).toFixed(2)} MB). Parsing with FBXLoader...`);

const loader = new FBXLoader();
try {
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const fbx = loader.parse(arrayBuffer, '');
  console.log('FBX parsed successfully!');
  
  const meshes = [];
  const allNodes = [];
  
  fbx.traverse((child) => {
    allNodes.push({
      name: child.name,
      type: child.type,
      isMesh: !!child.isMesh,
      vertexCount: child.geometry?.attributes?.position?.count || 0,
      materialName: child.material ? (Array.isArray(child.material) ? child.material.map(m => m.name) : child.material.name) : null,
      parent: child.parent ? child.parent.name : null,
    });
    if (child.isMesh) {
      meshes.push({
        name: child.name,
        vertexCount: child.geometry?.attributes?.position?.count || 0,
        parent: child.parent ? child.parent.name : null,
        box: new THREE.Box3().setFromObject(child).min.toArray().concat(new THREE.Box3().setFromObject(child).max.toArray()),
      });
    }
  });

  console.log(`Total nodes in hierarchy: ${allNodes.length}`);
  console.log(`Total meshes: ${meshes.length}`);
  console.log('All nodes:', JSON.stringify(allNodes, null, 2));

  // Compute total bounding box
  const box = new THREE.Box3().setFromObject(fbx);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  console.log('Bounding box:');
  console.log('Min:', box.min.toArray());
  console.log('Max:', box.max.toArray());
  console.log('Size:', size.toArray());
  console.log('Center:', center.toArray());

} catch (err) {
  console.error('Error parsing FBX:', err);
}
