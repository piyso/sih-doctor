/**
 * Build the split-conformal calibration for the syndrome suggester.
 *
 *   npm run calibrate:conformal            # writes src/data/conformal_calibration.json
 *   npm run calibrate:conformal -- -v      # also prints every case
 *
 * Input:  edge-ai/eval/syndrome_calibration.json (labelled transcripts, alpha)
 * Method: for each case, run the real intake pipeline (analyseTranscript) and take the softmax
 *         weight the suggester assigns to the labelled prototype; nonconformity = 1 − weight.
 *         Cases with fewer than two active indicators are excluded (the product never suggests
 *         for them) and are listed in the report so the set can be improved.
 * Output: alpha, n, k, q̂, empirical coverage, sorted scores, and per-case diagnostics.
 */
import fs from 'fs';
import path from 'path';

process.env.DB_PATH = process.env.DB_PATH || path.join(require('os').tmpdir(), 'hospital-calibrate.db');

import { analyseTranscript } from '../src/services/intakeExtraction.service';
import { calibrate } from '../src/services/core/conformal.engine';
import { HopfieldAssociativeService } from '../src/services/hopfieldAssociative.service';

const verbose = process.argv.includes('-v');
const input = path.resolve(__dirname, '../../edge-ai/eval/syndrome_calibration.json');
const output = path.resolve(__dirname, '../src/data/conformal_calibration.json');

const spec = JSON.parse(fs.readFileSync(input, 'utf8')) as { alpha: number; cases: Array<{ t: string; label: string }> };
const ids = new Set(HopfieldAssociativeService.STORED_SYNDROMES.map(s => s.id));

const scores: number[] = [];
const diagnostics: Array<{ t: string; label: string; predicted: string | null; weight: number; score: number | null; activeFeatures: number }> = [];
let skipped = 0;
let correct = 0;

for (const c of spec.cases) {
  if (!ids.has(c.label)) throw new Error(`Unknown label ${c.label}`);
  const r: any = analyseTranscript(c.t);
  const attractor = r.hopfieldAttractor;
  const weights: Array<{ id: string; weight: number }> = attractor?.allWeights || [];
  const w = weights.find(x => x.id === c.label)?.weight ?? 0;
  const predicted = attractor ? (HopfieldAssociativeService.STORED_SYNDROMES.find(s => s.name === attractor.syndromeName)?.id ?? null) : null;
  const active = Number(attractor?.activeFeatures ?? (attractor ? 2 : 0));
  if (!attractor) {
    skipped++;
    diagnostics.push({ t: c.t, label: c.label, predicted: null, weight: 0, score: null, activeFeatures: active });
    continue;
  }
  const score = 1 - w;
  scores.push(score);
  if (predicted === c.label) correct++;
  diagnostics.push({ t: c.t, label: c.label, predicted, weight: parseFloat(w.toFixed(4)), score: parseFloat(score.toFixed(4)), activeFeatures: active });
}

const cal = calibrate(scores, spec.alpha, path.relative(path.resolve(__dirname, '../..'), input));
const report = { ...cal, labelAccuracy: scores.length ? parseFloat((correct / scores.length).toFixed(4)) : 0, skippedCases: skipped, cases: diagnostics };
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2));

console.log(`\nConformal calibration — ${scores.length} usable cases (${skipped} skipped: fewer than two indicators)`);
console.log(`  alpha=${cal.alpha}  k=${cal.k}  q̂=${Number.isFinite(cal.qHat) ? cal.qHat.toFixed(4) : 'inf (not guaranteed)'}  empirical coverage=${cal.empiricalCoverage}  top-1 accuracy=${report.labelAccuracy}`);
console.log(`  written: ${path.relative(process.cwd(), output)}`);
if (verbose || skipped) {
  for (const d of diagnostics) if (verbose || d.score === null) console.log(`  ${d.score === null ? 'SKIP' : d.predicted === d.label ? ' ok ' : 'MISS'} ${d.label.padEnd(16)} w=${d.weight.toFixed(3)} s=${d.score === null ? '  -  ' : d.score.toFixed(3)}  ${d.t}`);
}
process.exit(cal.guaranteed ? 0 : 2);
