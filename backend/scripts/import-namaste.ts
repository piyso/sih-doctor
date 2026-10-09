/**
 * Import the official NAMASTE morbidity-code export (and optional ICD-11 TM2 mappings) into the
 * terminology search index.
 *
 *   npm run import:namaste -- path/to/namaste_ayurveda.csv [--system NAMASTE] [--dry-run]
 *
 * Accepts CSV with a header row. Column names are matched case-insensitively and flexibly:
 *   code:      NAMC_CODE | NAMASTE_CODE | CODE | A_CODE
 *   term:      NAMC_TERM | TERM | SANSKRIT | NAME
 *   english:   NAMC_TERM_DIACRITICAL | ENGLISH | SHORT_DEFINITION | DESCRIPTION
 *   icd11:     ICD11 | ICD_11 | TM2 | ICD11_TM2 | TM2_CODE
 *   icd10:     ICD10 | ICD_10
 *   synonyms:  SYNONYMS | ALIASES  (separated by | ; or ,)
 * Download the export from the NAMASTE portal (namstp.ayush.gov.in) with your institutional login;
 * this repository does not redistribute it.
 */
import fs from 'fs';
import path from 'path';

process.env.DB_PATH = process.env.DB_PATH || path.resolve(__dirname, '../data/hospital.db');

import { TerminologyService, TerminologyEntry, TerminologySystem } from '../src/services/terminology.service';

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}

const pick = (header: string[], names: string[]): number => header.findIndex(h => names.includes(h.trim().toUpperCase().replace(/\s+/g, '_')));

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const system = ((args[args.indexOf('--system') + 1] || 'NAMASTE') as TerminologySystem);
if (!file || !fs.existsSync(file)) {
  console.error('Usage: npm run import:namaste -- <export.csv> [--system NAMASTE|ICD-11-TM2|AFI|MOLECULE] [--dry-run]');
  process.exit(1);
}

const rows = parseCsv(fs.readFileSync(file, 'utf8'));
const header = rows[0].map(h => h.replace(/^﻿/, ''));
const iCode = pick(header, ['NAMC_CODE', 'NAMASTE_CODE', 'CODE', 'A_CODE', 'ICD11_CODE', 'TM2_CODE']);
const iTerm = pick(header, ['NAMC_TERM', 'TERM', 'SANSKRIT', 'NAME', 'TITLE']);
const iEnglish = pick(header, ['NAMC_TERM_DIACRITICAL', 'ENGLISH', 'SHORT_DEFINITION', 'DESCRIPTION', 'LONG_DEFINITION']);
const iIcd11 = pick(header, ['ICD11', 'ICD_11', 'TM2', 'ICD11_TM2', 'TM2_CODE', 'ICD-11']);
const iIcd10 = pick(header, ['ICD10', 'ICD_10', 'ICD-10']);
const iSyn = pick(header, ['SYNONYMS', 'ALIASES', 'SYNONYM']);
if (iCode < 0 || iTerm < 0) {
  console.error(`Could not find code/term columns in header: ${header.join(', ')}`);
  process.exit(1);
}

const entries: TerminologyEntry[] = [];
for (const r of rows.slice(1)) {
  const code = (r[iCode] || '').trim();
  const term = (r[iTerm] || '').trim();
  if (!code || !term) continue;
  const english = iEnglish >= 0 ? (r[iEnglish] || '').trim() : '';
  const synonyms = Array.from(new Set([english, ...(iSyn >= 0 ? (r[iSyn] || '').split(/[|;,]/) : [])].map(s => s.trim()).filter(Boolean)));
  entries.push({ system, code, term, synonyms, mapping: { english: english || undefined, icd11: iIcd11 >= 0 ? (r[iIcd11] || '').trim() || undefined : undefined, icd10: iIcd10 >= 0 ? (r[iIcd10] || '').trim() || undefined : undefined } });
}
console.log(`Parsed ${entries.length} ${system} entries from ${path.basename(file)} (columns: code=${header[iCode]}, term=${header[iTerm]}${iEnglish >= 0 ? `, english=${header[iEnglish]}` : ''}${iIcd11 >= 0 ? `, icd11=${header[iIcd11]}` : ''})`);
if (dryRun) { console.log(entries.slice(0, 5)); process.exit(0); }
const n = TerminologyService.upsert(entries);
console.log(`Imported ${n} rows. Index now holds: ${JSON.stringify(TerminologyService.stats())}`);
process.exit(0);
