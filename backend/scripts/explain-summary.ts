/**
 * Prints how one sentence becomes a summary line, step by step, with no language model involved.
 *
 *   npm run explain -- "मुझे तीन दिन से पेट में दर्द है बुखार नहीं है बीपी एक सौ पचास बटा पचानवे है"
 *   npm run explain -- --json "I have had chest pain since morning, no fever"
 *   npm run explain                      (a built-in example)
 */
import { formatTrace, traceSummary } from '../src/services/summaryTrace';

const args = process.argv.slice(2);
const json = args.includes('--json');
const text = args.filter(a => a !== '--json').join(' ').trim() || 'मुझे तीन दिन से पेट में दर्द है बुखार नहीं है बीपी एक सौ पचास बटा पचानवे है';

for (let i = 0; i < 40; i++) traceSummary(text); // warm up, so the time printed is the working speed and not start-up
const trace = traceSummary(text);
console.log(json ? JSON.stringify(trace, null, 2) : `\n${formatTrace(trace)}\n`);
