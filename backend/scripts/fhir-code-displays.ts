/**
 * Rebuild src/data/code_displays.json: the official ICD-10 / SNOMED CT display names for every code
 * the AYUSH registry maps to, as reported by the HL7 FHIR validator (tx.fhir.org).
 *
 *   npm run fhir:code-displays                     # writes the probe bundle only
 *   FHIR_VALIDATOR_JAR=/path/validator_cli.jar npm run fhir:code-displays   # runs the validator and updates the table
 *
 * Why: NRCES ndhm.in Condition.code.coding requires `display` (1..1) and the validator rejects any
 * wording other than the terminology's own, so registry prose must not be copied into `display`.
 * Unknown codes (for example ICD-10-CM codes that do not exist in WHO ICD-10) are printed so the
 * registry can be corrected.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';

const root = path.join(__dirname, '..');
const ontology = JSON.parse(fs.readFileSync(path.join(root, 'src/shared/ayush_ontology.json'), 'utf8'));
const tablePath = path.join(root, 'src/data/code_displays.json');
const table = fs.existsSync(tablePath) ? JSON.parse(fs.readFileSync(tablePath, 'utf8')) : { icd10: {}, snomed: {} };

const icd = new Set<string>(); const sct = new Set<string>();
const walk = (o: any) => {
  if (Array.isArray(o)) return o.forEach(walk);
  if (!o || typeof o !== 'object') return;
  if (o.icd10DualCode) icd.add(String(o.icd10DualCode));
  if (o.snomedConceptId) sct.add(String(o.snomedConceptId));
  Object.values(o).forEach(walk);
};
walk(ontology);

const cond = (system: string, code: string) => ({
  fullUrl: `urn:uuid:${randomUUID()}`,
  resource: {
    resourceType: 'Condition', id: randomUUID(), meta: { profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/Condition'] },
    text: { status: 'generated', div: '<div xmlns="http://www.w3.org/1999/xhtml"><p>probe</p></div>' },
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
    code: { coding: [{ system, code, display: 'PROBE-DISPLAY' }], text: code }, subject: { display: 'probe' }
  }
});
const bundle = { resourceType: 'Bundle', type: 'collection', entry: [
  ...[...icd].map(c => cond('http://hl7.org/fhir/sid/icd-10', c)), ...[...sct].map(c => cond('http://snomed.info/sct', c))
] };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fhir-probe-'));
const probe = path.join(dir, 'probe.json'); const report = path.join(dir, 'report.json');
fs.writeFileSync(probe, JSON.stringify(bundle));
console.log(`${icd.size} ICD-10 and ${sct.size} SNOMED codes; probe bundle at ${probe}`);

const jar = process.env.FHIR_VALIDATOR_JAR;
if (!jar) { console.log('Set FHIR_VALIDATOR_JAR to run the validator and update src/data/code_displays.json'); process.exit(0); }
try {
  execFileSync(process.env.JAVA || 'java', ['-Djava.net.preferIPv4Stack=true', '-Xmx3g', '-jar', jar, probe, '-version', '4.0.1', '-ig', 'ndhm.in#4.0.0', '-level', 'warnings', '-output', report], { stdio: 'ignore' });
} catch { /* exit code 1 = validation findings, which is what we parse */ }
const issues = JSON.parse(fs.readFileSync(report, 'utf8')).issue || [];
let updated = 0; const unknown: string[] = [];
for (const i of issues) {
  const t: string = i.details?.text || '';
  const m = t.match(/Wrong Display Name '.*?' for (\S+)#(\S+)\. Valid display is (?:one of \d+ choices: )?'(.+?)' \(/);
  if (m) { const [, sys, code, disp] = m; const key = sys.includes('icd-10') ? 'icd10' : 'snomed'; if (table[key][code] !== disp) { table[key][code] = disp; updated++; } }
  const u = t.match(/Unknown code '(\S+)' in the CodeSystem '(\S+)'/); if (u) unknown.push(`${u[2]}#${u[1]}`);
}
for (const k of ['icd10', 'snomed']) table[k] = Object.fromEntries(Object.entries(table[k]).sort());
fs.writeFileSync(tablePath, JSON.stringify(table, null, 2) + '\n');
console.log(`updated ${updated} displays -> ${path.relative(root, tablePath)}`);
if (unknown.length) { console.error('UNKNOWN CODES (fix the registry):', unknown.join(', ')); process.exit(2); }
