#!/usr/bin/env node
// Copies the canonical clinical language files from the frontend into the backend (separate Docker build
// contexts mean they cannot share a folder). `--check` exits non-zero when a copy is stale (used by backend tests).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['clinicalText.ts', 'clinicalLexicon.ts'];
let stale = 0;
for (const name of FILES) {
  const src = resolve(root, 'frontend/src/utils', name);
  const dst = resolve(root, 'backend/src/services', name);
  const want = `// GENERATED from frontend/src/utils/${name} by scripts/sync-clinical-lexicon.mjs — do not edit here.\n` + readFileSync(src, 'utf8');
  if (process.argv.includes('--check')) {
    const ok = existsSync(dst) && readFileSync(dst, 'utf8') === want;
    console.log(ok ? `${name} is in sync` : `backend/src/services/${name} is stale — run node scripts/sync-clinical-lexicon.mjs`);
    if (!ok) stale++;
  } else {
    writeFileSync(dst, want);
    console.log(`wrote ${dst}`);
  }
}
process.exit(stale ? 1 : 0);
