#!/usr/bin/env node
/**
 * Builds the kiosk's 3D body model: the same anatomy (every part and its name, which the app uses for
 * colours and body-region mapping), made light enough for kiosk tablets.
 *
 *   node scripts/optimize-body-model.mjs [input.glb] [output.glb] [--ratio 0.2] [--error 0.0005]
 *
 * Steps: decode (Draco or plain) → drop texture coordinates (the model has no textures) and the parts the
 * app always hides → weld + simplify with meshoptimizer under a visual-error bound → quantise + meshopt
 * compression (decoded by three.js in milliseconds, no WebAssembly worker, small after brotli/gzip).
 * Nodes are never joined or flattened, so names survive.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, simplify, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { statSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? Number(args[i + 1]) : def; };
const positional = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const input = positional[0] || 'public/models/3d_mannequin_draco.glb';
const output = positional[1] || 'public/models/body.glb';
const ratio = flag('ratio', 0.2);
const error = flag('error', 0.0005);

// Same rule as AnatomicalMannequin3D: these parts are never shown.
const HIDDEN = /penis|penile|pudendal|scrotum|testis|testicle|prepuce|glans|superficial_dorsal_vein/i;

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'meshopt.decoder': MeshoptDecoder,
  'meshopt.encoder': MeshoptEncoder
});

const doc = await io.read(input);
const root = doc.getRoot();
const triangles = () => root.listMeshes().flatMap(m => m.listPrimitives()).reduce((a, p) => a + (p.getIndices()?.getCount() ?? 0) / 3, 0);
const before = { tris: triangles(), nodes: root.listNodes().filter(n => n.getMesh()).length };

let hidden = 0;
for (const node of root.listNodes()) {
  if (node.getMesh() && HIDDEN.test(node.getName())) { node.dispose(); hidden++; }
}
for (const prim of root.listMeshes().flatMap(m => m.listPrimitives())) {
  for (const sem of prim.listSemantics()) if (sem.startsWith('TEXCOORD_')) prim.setAttribute(sem, null);
}
root.listExtensionsUsed().filter(e => e.extensionName === KHRDracoMeshCompression.EXTENSION_NAME).forEach(e => e.dispose());

await doc.transform(
  prune(),
  dedup(),
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio, error }),
  prune(),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' })
);

await io.write(output, doc);
const after = { tris: triangles(), nodes: root.listNodes().filter(n => n.getMesh()).length };
console.log(JSON.stringify({
  input, output, ratio, error, hiddenRemoved: hidden,
  triangles: `${before.tris} → ${after.tris}`, meshNodes: `${before.nodes} → ${after.nodes}`,
  bytes: `${statSync(input).size} → ${statSync(output).size}`
}, null, 1));
