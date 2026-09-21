import fs from 'fs';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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

async function optimizeAndExport() {
  const fbxPath = '/Users/piyushkumar/Desktop/SIH/26047/3D modal.fbx';
  console.log('Reading FBX...');
  const buffer = fs.readFileSync(fbxPath);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

  const loader = new FBXLoader();
  const fbx = loader.parse(arrayBuffer, '');
  console.log('FBX parsed. Optimizing geometries...');

  // Scale and center the model to standard kiosk height (height ~ 2.0 units, centered at y=0)
  const rootBox = new THREE.Box3().setFromObject(fbx);
  const rootSize = new THREE.Vector3();
  rootBox.getSize(rootSize);
  const rootCenter = new THREE.Vector3();
  rootBox.getCenter(rootCenter);
  
  console.log(`Original bounding box size: [${rootSize.x.toFixed(2)}, ${rootSize.y.toFixed(2)}, ${rootSize.z.toFixed(2)}]`);
  console.log(`Original center: [${rootCenter.x.toFixed(2)}, ${rootCenter.y.toFixed(2)}, ${rootCenter.z.toFixed(2)}]`);

  // Target height = 2.0 (standard Three.js character scale)
  const targetScale = 2.0 / rootSize.y;
  
  let originalVerts = 0;
  let optimizedVerts = 0;
  let meshCount = 0;

  // Optimize and categorize each mesh
  fbx.traverse((child) => {
    if (child.isMesh && child.geometry) {
      meshCount++;
      const posAttr = child.geometry.attributes.position;
      const count = posAttr?.count || 0;
      originalVerts += count;

      // Merge vertices (remove duplicates)
      let geom = child.geometry;
      try {
        if (!geom.index) {
          geom = BufferGeometryUtils.mergeVertices(geom, 0.05); // weld vertices within 0.5mm
        }
      } catch (e) {
        // keep original if mergeVertices fails
      }

      geom.computeVertexNormals();
      child.geometry = geom;
      optimizedVerts += (child.geometry.attributes.position?.count || 0);

      const matName = Array.isArray(child.material) ? child.material[0]?.name : child.material?.name;
      const name = child.name;

      // Determine material theme
      let color = 0x94a3b8;
      let roughness = 0.5;
      let metalness = 0.1;
      let opacity = 1.0;
      let transparent = false;

      if (/muscle/i.test(matName) || /muscle/i.test(name)) {
        color = 0xbe123c; // Crimson Muscle
        roughness = 0.55;
      } else if (/bone|skeleton|phalanx|vertebra|rib|skull|patell|femur|tibia/i.test(matName) || /bone|vertebra|rib|atlas|axis|t1|l1|c1/i.test(name)) {
        color = 0xf8fafc; // Ivory Bone
        roughness = 0.35;
      } else if (/artery|aort|coronary/i.test(matName) || /artery|aort|coronary/i.test(name)) {
        color = 0xef4444; // Arterial Red
        roughness = 0.2;
      } else if (/vein|jugular|sinus|cava/i.test(matName) || /vein|jugular/i.test(name)) {
        color = 0x3b82f6; // Venous Blue
        roughness = 0.2;
      } else if (/cartilage/i.test(matName) || /cartilage|meniscus/i.test(name)) {
        color = 0x38bdf8; // Cartilage Cyan
        roughness = 0.2;
        transparent = true;
        opacity = 0.85;
      } else if (/ligament|tendon/i.test(matName) || /ligament|tendon/i.test(name)) {
        color = 0xe2e8f0; // Tendon
        roughness = 0.4;
      } else if (/heart/i.test(name)) {
        color = 0xe11d48; // Heart
        roughness = 0.3;
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

  console.log(`Processed ${meshCount} meshes.`);
  console.log(`Original vertices: ${originalVerts}, Optimized vertices: ${optimizedVerts} (${((1 - optimizedVerts / originalVerts) * 100).toFixed(1)}% reduction)`);

  const exporter = new GLTFExporter();
  const gltf = await exporter.parseAsync(fbx, { binary: true, embedImages: false });
  
  const outBuffer = Buffer.from(gltf);
  const outPath = '/Users/piyushkumar/Desktop/SIH/26047/frontend/public/models/anatomical_full_body_optimized.glb';
  fs.writeFileSync(outPath, outBuffer);
  console.log(`Optimized GLB saved to: ${outPath} (${(outBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
}

optimizeAndExport().catch(console.error);
