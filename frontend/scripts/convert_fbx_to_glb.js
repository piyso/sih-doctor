import fs from 'fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// Polyfill minimal browser globals for loaders/exporters in Node
if (typeof global.window === 'undefined') { global.window = global; }
if (typeof global.document === 'undefined') {
  global.document = { createElementNS: () => ({}), createElement: () => ({}) };
}

class NodeFileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      if (this.onload) this.onload({ target: this });
    }).catch(err => {
      if (this.onerror) this.onerror(err);
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buffer) => {
      const base64 = Buffer.from(buffer).toString('base64');
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${base64}`;
      if (this.onload) this.onload({ target: this });
    }).catch(err => {
      if (this.onerror) this.onerror(err);
    });
  }
}
global.FileReader = NodeFileReader;

const fbxPath = '/Users/piyushkumar/Desktop/SIH/26047/3D modal.fbx';
console.log('Loading FBX file...');
const buffer = fs.readFileSync(fbxPath);
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

const loader = new FBXLoader();
const fbx = loader.parse(arrayBuffer, '');
console.log('FBX parsed. Standardizing materials...');

// Standardize materials to MeshStandardMaterial so GLTFExporter and WebGL renderer render cleanly
fbx.traverse((child) => {
  if (child.isMesh) {
    // Ensure geometry attributes are valid
    if (child.geometry && !child.geometry.attributes.normal) {
      child.geometry.computeVertexNormals();
    }
    
    // Convert materials
    const mat = child.material;
    const matName = Array.isArray(mat) ? mat[0]?.name : mat?.name;
    let color = 0x8899aa;
    let opacity = 1.0;
    let transparent = false;
    let roughness = 0.5;
    let metalness = 0.1;

    if (/muscle/i.test(matName) || /muscle/i.test(child.name)) {
      color = 0x9e2a2b; // Rich muscle crimson
      roughness = 0.6;
    } else if (/bone|cartilage|skeleton|phalanx|vertebra|rib|skull/i.test(matName) || /bone|vertebra|rib/i.test(child.name)) {
      color = 0xe8dfc8; // Bone ivory
      roughness = 0.4;
    } else if (/artery|aort|coronary/i.test(matName) || /artery|aort|coronary/i.test(child.name)) {
      color = 0xd90429; // Arterial red
      roughness = 0.3;
    } else if (/vein|jugular|sinus/i.test(matName) || /vein/i.test(child.name)) {
      color = 0x0077b6; // Venous blue
      roughness = 0.3;
    } else if (/ligament|tendon/i.test(matName) || /ligament|tendon/i.test(child.name)) {
      color = 0xdcdcdd; // Tendon pearlescent
      roughness = 0.5;
    } else if (/heart/i.test(child.name)) {
      color = 0xc1121f; // Cardiac deep red
      roughness = 0.4;
    }

    child.material = new THREE.MeshStandardMaterial({
      name: matName || 'AnatomicalMaterial',
      color: new THREE.Color(color),
      roughness,
      metalness,
      transparent,
      opacity,
      side: THREE.DoubleSide
    });
  }
});

console.log('Exporting GLB...');
const exporter = new GLTFExporter();
exporter.parse(
  fbx,
  (gltf) => {
    const outBuffer = Buffer.from(gltf);
    const outPath = '/Users/piyushkumar/Desktop/SIH/26047/frontend/public/models/anatomical_full_body.glb';
    fs.writeFileSync(outPath, outBuffer);
    console.log(`SUCCESS! Exported GLB: ${outPath} (${(outBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
    process.exit(0);
  },
  (err) => {
    console.error('Export error:', err);
    process.exit(1);
  },
  { binary: true, embedImages: false }
);
