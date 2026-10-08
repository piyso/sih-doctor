#!/usr/bin/env node
// Copies the canonical clinical lexicon from the frontend into the backend (separate Docker build contexts
// mean they cannot share a folder). `--check` exits non-zero when the copy is stale (used by backend tests).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'frontend/src/utils/clinicalLexicon.ts');
const dst = resolve(root, 'backend/src/services/clinicalLexicon.ts');
const HEADER = '// GENERATED from frontend/src/utils/clinicalLexicon.ts by scripts/sync-clinical-lexicon.mjs — do not edit here.\n';
const want = HEADER + readFileSync(src, 'utf8');
if (process.argv.includes('--check')) {
  const ok = existsSync(dst) && readFileSync(dst, 'utf8') === want;
  console.log(ok ? 'clinicalLexicon.ts is in sync' : 'backend/src/services/clinicalLexicon.ts is stale — run node scripts/sync-clinical-lexicon.mjs');
  process.exit(ok ? 0 : 1);
}
writeFileSync(dst, want);
console.log(`wrote ${dst}`);
