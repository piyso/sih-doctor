import fs from 'fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

if (typeof global.window === 'undefined') { global.window = global; }
if (typeof global.document === 'undefined') {
  global.document = { createElementNS: () => ({}), createElement: () => ({}) };
}

class NodeFileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      if (this.onload) this.onload({ target: this });
      if (this.onloadend) this.onloadend({ target: this });
    }).catch(err => {
      if (this.onerror) this.onerror(err);
      if (this.onloadend) this.onloadend({ target: this });
    });
  }
}
global.FileReader = NodeFileReader;

async function run() {
  const fbxPath = '/Users/piyushkumar/Desktop/SIH/26047/3D modal.fbx';
  console.log('Loading FBX file from disk...');
  const buffer = fs.readFileSync(fbxPath);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

  console.log('Parsing FBX...');
  const loader = new FBXLoader();
  const fbx = loader.parse(arrayBuffer, '');
  console.log('FBX parsed successfully. Processing materials & geometry...');

  let meshCount = 0;
  let vertCount = 0;

  fbx.traverse((child) => {
    if (child.isMesh) {
      meshCount++;
      vertCount += child.geometry?.attributes?.position?.count || 0;
      
      const mat = child.material;
      const matName = Array.isArray(mat) ? mat[0]?.name : mat?.name;
      let color = 0x94a3b8;
      let roughness = 0.5;
      let metalness = 0.1;

      if (/muscle/i.test(matName) || /muscle/i.test(child.name)) {
        color = 0xb91c1c; // Deep Ruby Red
        roughness = 0.6;
      } else if (/bone|cartilage|skeleton|phalanx|vertebra|rib|skull|patell|femur|tibia/i.test(matName) || /bone|vertebra|rib|atlas|axis|t1|l1|c1/i.test(child.name)) {
        color = 0xf5eedb; // Ivory Bone
        roughness = 0.35;
      } else if (/artery|aort|coronary/i.test(matName) || /artery|aort|coronary/i.test(child.name)) {
        color = 0xef4444; // Arterial Crimson
        roughness = 0.25;
      } else if (/vein|jugular|sinus|cava/i.test(matName) || /vein|jugular/i.test(child.name)) {
        color = 0x2563eb; // Venous Azure
        roughness = 0.25;
      } else if (/ligament|tendon/i.test(matName) || /ligament|tendon/i.test(child.name)) {
        color = 0xe2e8f0; // Tendon Silver
        roughness = 0.45;
      } else if (/heart/i.test(child.name)) {
        color = 0xdc2626; // Vital Heart
        roughness = 0.3;
      }

      child.material = new THREE.MeshStandardMaterial({
        name: matName || 'AnatomicalStructure',
        color: new THREE.Color(color),
        roughness,
        metalness,
        side: THREE.DoubleSide
      });
    }
  });

  console.log(`Processed ${meshCount} meshes (${vertCount} vertices). Starting parseAsync...`);
  const exporter = new GLTFExporter();
  const gltf = await exporter.parseAsync(fbx, { binary: true, embedImages: false });
  
  let outBuffer;
  if (gltf instanceof ArrayBuffer) {
    outBuffer = Buffer.from(gltf);
  } else if (gltf instanceof Blob) {
    const arrayBuf = await gltf.arrayBuffer();
    outBuffer = Buffer.from(arrayBuf);
  } else {
    outBuffer = Buffer.from(JSON.stringify(gltf));
  }

  const outPath = '/Users/piyushkumar/Desktop/SIH/26047/frontend/public/models/anatomical_full_body.glb';
  fs.writeFileSync(outPath, outBuffer);
  console.log(`GLB export complete! Saved to ${outPath} (${(outBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
}

run().catch(err => {
  console.error('Fatal error in export:', err);
  process.exit(1);
});
