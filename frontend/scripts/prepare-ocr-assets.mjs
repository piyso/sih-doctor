/**
 * Self-hosts the Tesseract.js worker and WASM core under public/tesseract so document OCR works
 * on an offline / air-gapped kiosk instead of hanging while it tries to reach a CDN.
 * Runs automatically before `npm run dev` and `npm run build`.
 */
import { build } from 'rolldown';
import { copyFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'tesseract');
const workerOut = join(outDir, 'worker.min.js');
const coreDir = join(root, 'node_modules', 'tesseract.js-core');
const workerEntry = join(root, 'node_modules', 'tesseract.js', 'src', 'worker-script', 'browser', 'index.js');
// LSTM-only cores (OEM 1); the worker picks the fastest one the browser supports.
const CORE_FILES = ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'];

mkdirSync(outDir, { recursive: true });

const isFresh = (src, dest) => existsSync(dest) && statSync(dest).mtimeMs >= statSync(src).mtimeMs;

if (!isFresh(workerEntry, workerOut)) {
  await build({
    input: workerEntry,
    platform: 'browser',
    logLevel: 'warn',
    output: {
      file: workerOut,
      format: 'iife',
      minify: true,
      // The worker expects Node-style globals.
      banner: 'self.global=self;self.process=self.process||{env:{},browser:true,nextTick:function(f){var a=[].slice.call(arguments,1);Promise.resolve().then(function(){f.apply(null,a)})}};'
    }
  });
  console.log('[ocr-assets] built public/tesseract/worker.min.js');
}

for (const file of CORE_FILES) {
  const src = join(coreDir, file);
  const dest = join(outDir, file);
  if (!isFresh(src, dest)) {
    copyFileSync(src, dest);
    console.log(`[ocr-assets] copied ${file}`);
  }
}
