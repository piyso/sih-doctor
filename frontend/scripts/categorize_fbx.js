import fs from 'fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

if (typeof global.window === 'undefined') { global.window = global; }
if (typeof global.document === 'undefined') {
  global.document = { createElementNS: () => ({}), createElement: () => ({}) };
}

const fbxPath = '/Users/piyushkumar/Desktop/SIH/26047/3D modal.fbx';
const buffer = fs.readFileSync(fbxPath);
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

const loader = new FBXLoader();
const fbx = loader.parse(arrayBuffer, '');

const meshList = [];
let totalVerts = 0;

fbx.traverse((child) => {
  if (child.isMesh) {
    const vCount = child.geometry?.attributes?.position?.count || 0;
    totalVerts += vCount;
    const box = new THREE.Box3().setFromObject(child);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    
    meshList.push({
      name: child.name,
      material: Array.isArray(child.material) ? child.material.map(m => m.name).join(', ') : child.material?.name,
      vertexCount: vCount,
      center: [Number(center.x.toFixed(2)), Number(center.y.toFixed(2)), Number(center.z.toFixed(2))],
      size: [Number(size.x.toFixed(2)), Number(size.y.toFixed(2)), Number(size.z.toFixed(2))],
    });
  }
});

console.log(`Total Meshes: ${meshList.length}`);
console.log(`Total Vertices: ${totalVerts}`);

// Save summary to JSON
fs.writeFileSync('/Users/piyushkumar/Desktop/SIH/26047/frontend/scripts/fbx_mesh_manifest.json', JSON.stringify(meshList, null, 2));

// Categorize and print counts
const categories = {
  heart_cardiac: meshList.filter(m => /heart|coronary|aort|atrium|ventricle|pericard/i.test(m.name)),
  lungs_respiratory: meshList.filter(m => /lung|bronch|trachea|pleura/i.test(m.name)),
  digestive_abdominal: meshList.filter(m => /stomach|gastric|liver|hepatic|spleen|pancrea|intestin|colon|rectum|duoden|gallbladder/i.test(m.name)),
  renal_urinary: meshList.filter(m => /kidney|renal|bladder|ureter/i.test(m.name)),
  head_cranial_brain: meshList.filter(m => /brain|cerebr|cerebel|temporal|frontal|occipital|parietal|eye|sinus|nasal|ear|tongue|maxill|mandib|skull|head/i.test(m.name)),
  neck_throat: meshList.filter(m => /throat|larynx|pharynx|thyroid|cervical|hyoid/i.test(m.name)),
  spine_vertebra: meshList.filter(m => /vertebra|spine|spinal|sacrum|coccyx|nucleus_pulposus/i.test(m.name)),
  chest_thoracic: meshList.filter(m => /pectoral|rib|costal|intercostal|sternum|sternal|clavic/i.test(m.name)),
  upper_limb_arms_hands: meshList.filter(m => /deltoid|bicep|tricep|brachia|radius|ulna|carpal|humerus|hand|finger|palmar/i.test(m.name)),
  pelvis_gluteal: meshList.filter(m => /pelvis|ilium|ischium|pubic|glute/i.test(m.name)),
  lower_limb_legs_feet: meshList.filter(m => /femur|femoral|quadricep|hamstring|patell|knee|tibia|fibula|gastrocnem|soleus|tarsal|metatarsal|foot|plantar/i.test(m.name)),
  vascular_arteries_veins: meshList.filter(m => /artery|arterie|vein|sinus|jugular|carotid/i.test(m.name)),
  muscles: meshList.filter(m => /muscle|tendon/i.test(m.material) || /muscle/i.test(m.name)),
  bones: meshList.filter(m => /bone|cartilage|skeleton/i.test(m.material) || /bone/i.test(m.name)),
};

for (const [k, v] of Object.entries(categories)) {
  console.log(`${k}: ${v.length} meshes`);
}
