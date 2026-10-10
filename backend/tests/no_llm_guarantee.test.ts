/**
 * The "no language model" guarantee, checked by running the system rather than by reading a claim.
 *
 *   npm run test:no-llm          (or: npx tsx tests/no_llm_guarantee.test.ts)
 *
 * What it proves
 *   A. Nothing in the product depends on a language-model library or calls a language-model service.
 *   B. Policy: the server is started against a stand-in Edge AI machine that advertises a language model and a
 *      Whisper recogniser. Under the default policy neither is ever called — not for a kiosk, not for a clinician.
 *      The template visit note never lists a denied complaint as present.
 *      When the hospital switches the clinician note draft on, the kiosk path still never reaches the model.
 *   C. Same input, same output, with the network cut off.
 *   D. Grounding: every word of every summary comes from the patient's record or from the fixed templates.
 *   E. The Hindi summary is Hindi: every name the parser or the kiosk can produce has a Hindi entry, and Hindi
 *      and English never disagree about "denied" versus "not answered".
 *   F. Every quoted source is, letter for letter, something the patient said.
 */
import './env';
import fs from 'fs';
import http from 'http';
import net from 'net';
import path from 'path';
import { createServer } from '../src/app';
import { EdgeAiClient } from '../src/services/edgeAi.client';
import { AiPolicyError } from '../src/services/aiPolicy';
import { AuthService } from '../src/security/auth.service';
import { ClinicalParserService } from '../src/services/clinicalParser.service';
import { buildHistorySummary, normaliseHistory } from '../src/services/clinicalHistory.service';
import { HindiTerms } from '../src/services/summaryRealiser';
import { traceSummary } from '../src/services/summaryTrace';
import { buildKioskLabels } from '../scripts/sync-kiosk-labels';

const ROOT = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.resolve(ROOT, p), 'utf8');

function demoPin(username: string): string {
  const m = read('backend/src/db/demoStaff.ts').match(new RegExp(`^ \\*\\s+${username.replace('.', '\\.')}\\s+\\S+\\s+(\\d+)`, 'm'));
  if (!m) throw new Error(`No demo PIN for ${username}`);
  return m[1];
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) sourceFiles(p, out);
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Every spoken test sentence in the repository's evaluation sets. */
function evalSentences(): string[] {
  const out: string[] = [];
  for (const f of ['extraction_cases', 'extraction_blind', 'extraction_holdout', 'extraction_final', 'extraction_contrast', 'extraction_socrates']) {
    const p = path.resolve(ROOT, `edge-ai/eval/${f}.json`);
    if (!fs.existsSync(p)) continue;
    for (const c of JSON.parse(fs.readFileSync(p, 'utf8')).cases || []) if (typeof c.t === 'string') out.push(c.t);
  }
  return out;
}

const words = (s: string): string[] => s.toLowerCase().normalize('NFC').split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
function deepStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string' || typeof v === 'number') out.push(String(v));
  else if (Array.isArray(v)) v.forEach(x => deepStrings(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (typeof x === 'boolean') continue; out.push(k); deepStrings(x, out); }
  return out;
}

const RICH_HISTORY = {
  pastMedical: [{ name: 'Bronchial Asthma', since: '2015', status: 'controlled', source: 'patient' }, { name: 'Diabetes', since: '5 years' }], pastSurgical: [{ name: 'Appendicectomy', since: '2010' }],
  drugHistory: [{ name: 'Salbutamol inhaler', dose: '2 puffs', frequency: 'SOS', adherence: 'regular' }], allergyList: [{ agent: 'Sulfa', reaction: 'rash', severity: 'moderate' }],
  familyHistory: [{ condition: 'Diabetes', relation: 'father' }],
  personal: { tobacco: 'former', alcohol: 'occasional', diet: 'non_vegetarian', appetite: 'reduced', bowel: 'constipation', sleep: 'disturbed', physicalActivity: 'sedentary', occupation: 'farmer' },
  reviewOfSystems: { constitutional: 'present', cardiovascular: 'denied' }, askedSections: { pastMedical: true, pastSurgical: true, drugHistory: true, allergies: true, familyHistory: true }
};
const RICH_EXTRAS = {
  patient: { name: 'Asha Devi', age: 34, gender: 'FEMALE', isPregnant: true, gestationalWeeks: 20 },
  vitals: { bp: '150/95', pulse: 96, spo2: '97%', temp: '100.4°F', respiratoryRate: 20, bloodSugar: 180, source: 'clinician', recordedBy: 'nurse.priya' },
  pariksha: { prakriti: 'Vata-Pitta', agni: 'Mandagni', koshtha: 'Krura', sara: 'Madhyama', vyayamaShakti: 'Low', amaPresent: true },
  documents: [{ documentType: 'LAB_REPORT', recordedDate: '2026-09-01', extractedLabMarkers: [{ testName: 'Hb', value: 9.1, unit: 'g/dL', isAbnormal: true, flag: 'LOW' }], extractedDiagnoses: ['Anaemia'], extractedMedications: [{ name: 'Ferrous sulphate' }] }]
};

export async function runNoLlmGuaranteeBattery() {
  const t0 = performance.now();
  let passed = 0;
  let total = 0;
  const check = (ok: boolean, what: string) => { total++; if (ok) passed++; console.log(`  ${ok ? '[OK]  ' : '[FAIL]'} ${what}`); };
  const sentences = evalSentences();

  // ------------------------------------------------------------------ A. Nothing to call
  console.log('\n--- A. No language-model library, no language-model service ---');
  const LLM_PACKAGES = /^(openai|@anthropic-ai\/|anthropic|@google\/generative-ai|@google-cloud\/vertexai|@google\/genai|langchain|@langchain\/|llamaindex|ollama|node-llama-cpp|@xenova\/transformers|@huggingface\/|cohere-ai|@mistralai\/|groq-sdk|replicate|together-ai|@aws-sdk\/client-bedrock|ai$|@ai-sdk\/)/;
  const deps: string[] = [];
  for (const p of ['package.json', 'backend/package.json', 'frontend/package.json']) {
    const j = JSON.parse(read(p));
    deps.push(...Object.keys({ ...j.dependencies, ...j.devDependencies, ...j.optionalDependencies }));
  }
  const badDeps = deps.filter(d => LLM_PACKAGES.test(d));
  check(deps.length > 20 && badDeps.length === 0, `no language-model package among ${deps.length} dependencies of the server and the screens${badDeps.length ? ` — found ${badDeps.join(', ')}` : ''}`);

  const LLM_HOSTS = /api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|aiplatform\.googleapis\.com|api\.groq\.com|api\.mistral\.ai|api\.cohere\.|openrouter\.ai|api\.together\.|api-inference\.huggingface|bedrock-runtime|api\.deepseek\.com|dashscope\.aliyuncs\.com|:11434/i;
  const files = [...sourceFiles(path.resolve(ROOT, 'backend/src')), ...sourceFiles(path.resolve(ROOT, 'frontend/src'))];
  const hostHits = files.filter(f => LLM_HOSTS.test(fs.readFileSync(f, 'utf8')));
  check(files.length > 100 && hostHits.length === 0, `no language-model service address in ${files.length} source files${hostHits.length ? ` — found in ${hostHits.map(f => path.relative(ROOT, f)).join(', ')}` : ''}`);

  check(typeof (EdgeAiClient as any).extract === 'undefined', 'the Edge AI client has no method that sends a patient\'s words to a language model');
  const soapCallers = sourceFiles(path.resolve(ROOT, 'backend/src')).filter(f => /EdgeAiClient\.soap\(/.test(fs.readFileSync(f, 'utf8'))).map(f => path.relative(ROOT, f));
  check(soapCallers.length === 1 && soapCallers[0] === 'backend/src/routes/ai.routes.ts', `the note-draft model is reachable from one place only (${soapCallers.join(', ')})`);

  // the understanding and summary path may not even import a network or model client
  const PATH_FILES = ['clinicalText.ts', 'clinicalLexicon.ts', 'clinicalParser.service.ts', 'phoneticNormalizer.service.ts', 'clinicalHistory.service.ts', 'summaryRealiser.ts', 'summaryTrace.ts'];
  const leaks = PATH_FILES.filter(f => /EdgeAiClient|edgeAi\.client|\bfetch\(|from 'https?'|from 'net'|child_process|axios/.test(read(`backend/src/services/${f}`)));
  check(leaks.length === 0, `extraction and summary code (${PATH_FILES.length} files) imports no network or model client${leaks.length ? ` — ${leaks.join(', ')}` : ''}`);

  // ------------------------------------------------------------------ B. Policy against a stand-in machine
  console.log('\n--- B. Server against an Edge AI machine that HAS a language model and Whisper ---');
  const calls = { extract: 0, soap: 0, asr: [] as string[] };
  let asrEngineForHindi = 'sherpa-onnx';
  const standIn = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://x');
    const chunks: Buffer[] = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const json = (o: unknown) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (url.pathname === '/health') return json({ status: 'ok', device: 'stand-in', capabilities: {
        asr: { available: true, model: 'sherpa-onnx:en,hi + whisper:small', languages: ['en', 'hi', 'mr', 'bn', 'ta', 'te', 'gu', 'kn', 'ml', 'pa'] },
        tts: { available: false }, translate: { available: false }, ocr: { available: false }, llm: { available: true, model: 'stand-in-llm' } } });
      if (url.pathname === '/extract') { calls.extract++; return json({ findings: [{ symptom: 'INVENTED BY MODEL', evidence: 'fever' }], model: 'stand-in-llm' }); }
      if (url.pathname === '/soap') { calls.soap++; return json({ subjective: 'MODEL SUBJECTIVE', objective: 'MODEL OBJECTIVE', assessment: 'MODEL ASSESSMENT', plan: 'MODEL PLAN: give everything', model: 'stand-in-llm' }); }
      if (url.pathname === '/asr') {
        const lang = url.searchParams.get('lang') || '';
        calls.asr.push(lang);
        return json({ text: 'TEXT WRITTEN BY THE RECOGNISER', language: lang, engine: lang === 'hi' ? asrEngineForHindi : lang === 'en' ? 'sherpa-onnx' : 'faster-whisper', durationSec: 1 });
      }
      res.writeHead(404); res.end();
    });
  });
  await new Promise<void>(r => standIn.listen(0, '127.0.0.1', () => r()));
  const saved = { url: process.env.EDGE_AI_URL, llm: process.env.LLM_ASSIST, asr: process.env.GENERATIVE_ASR };
  process.env.EDGE_AI_URL = `http://127.0.0.1:${(standIn.address() as any).port}`;
  delete process.env.LLM_ASSIST;
  delete process.env.GENERATIVE_ASR;
  await EdgeAiClient.status(true);

  const { server } = createServer();
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const api = async (method: string, p: string, body?: any, token?: string, raw?: Buffer) => {
    const r = await fetch(`${base}${p}`, { method, headers: { 'Content-Type': raw ? 'audio/wav' : 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: raw ? new Uint8Array(raw) : body === undefined ? undefined : JSON.stringify(body) });
    let json: any = null;
    try { json = await r.json(); } catch { json = null; }
    return { status: r.status, json };
  };
  const audio = Buffer.alloc(4000, 1);
  const transcript = 'Patient reports fever for three days with body ache and a dry cough, no chest pain, eating poorly, advised rest and fluids.';

  try {
    // signed in through the auth service itself: inside the full runner the HTTP sign-in limiter (30 a minute) is
    // already used up by the batteries before this one
    const signIn: any = AuthService.login('dr.sharma', demoPin('dr.sharma'), { ip: '127.0.0.1', userAgent: 'no-llm-battery' });
    const doctor = signIn?.token as string;
    const intake = await api('POST', '/api/kiosk/intake', {
      patient: { name: `NOLLM-${Date.now()}`, age: 40, gender: 'MALE' }, careStream: 'ALLOPATHY', language: 'hi',
      symptoms: [{ name: 'Fever', site: 'General', severityScore: 4, onset: '3 days' }], history: { conditions: [], allergies: '', currentMedicines: '' },
      consent: { purposes: { care: true, abha_link: false, sms: false, research: false }, language: 'hi', method: 'kiosk_self' }
    });
    const sessionId = intake.json?.sessionId;
    check(!!doctor && !!sessionId, `a clinician is signed in and a visit exists${doctor && sessionId ? '' : ` (sign-in: ${JSON.stringify(signIn).slice(0, 120)}; intake: ${intake.status} ${JSON.stringify(intake.json).slice(0, 160)})`}`);

    console.log('  default policy (LLM_ASSIST unset):');
    const st = await api('GET', '/api/ai/status');
    check(st.status === 200 && st.json.data.capabilities.llm.available === false && st.json.data.policy.llmAssist === 'off' && st.json.data.policy.installed.llm === true,
      'a language model is installed on the machine, and the server reports it as not available (policy: off)');
    check(JSON.stringify(st.json.data.capabilities.asr.languages) === '["en","hi"]' && !/whisper/i.test(st.json.data.capabilities.asr.model) && st.json.data.policy.installed.generativeAsr === true,
      'Whisper is installed on the machine, and only the two non-generative speech languages are offered');
    const stStaff = await api('GET', '/api/ai/status', undefined, doctor);
    check(stStaff.json.data.capabilities.llm.available === false, 'a clinician is not offered the model either');

    const ex = await api('POST', '/api/ai/extract', { text: 'मुझे तीन दिन से बुखार है और सीने में दर्द नहीं है', lang: 'hi' });
    check(ex.status === 200 && ex.json.data.rules.symptoms.some((s: any) => s.name === 'Fever' && !s.isNegated) && ex.json.data.aiFindings.length === 0 && ex.json.data.model === null && calls.extract === 0,
      'kiosk extraction: rules found the fever, nothing came from a model, the model was not called');
    const exStaff = await api('POST', '/api/ai/extract', { text: 'fever and cough since 2 days', lang: 'en' }, doctor);
    check(exStaff.json.data.aiFindings.length === 0 && calls.extract === 0, 'extraction for a signed-in clinician: also rules only');

    const soap = await api('POST', '/api/ai/soap', { sessionId, transcript, draft: { advice: 'Rest and fluids', followUpDays: 3 } }, doctor);
    check(soap.status === 200 && soap.json.data.generatedBy === 'template' && !/MODEL/.test(JSON.stringify(soap.json.data)) && calls.soap === 0,
      'visit-note draft: built by the fixed template, the model was not called');
    // a visit whose record holds a denied complaint: the template note must not list it as present
    const spokenText = 'मुझे तीन दिन से पेट में दर्द है बुखार नहीं है';
    const spokenIntake = await api('POST', '/api/kiosk/intake', {
      patient: { name: `NOLLM-DENIED-${Date.now()}`, age: 42, gender: 'MALE' }, careStream: 'ALLOPATHY', language: 'hi', rawTranscript: spokenText,
      symptoms: ClinicalParserService.parse(spokenText).symptoms, history: { conditions: [], allergies: '', currentMedicines: '' },
      consent: { purposes: { care: true, abha_link: false, sms: false, research: false }, language: 'hi', method: 'kiosk_self' }
    });
    const spokenSoap = await api('POST', '/api/ai/soap', { sessionId: spokenIntake.json?.sessionId, transcript: '', draft: {} }, doctor);
    const subj = String(spokenSoap.json?.data?.subjective || '');
    check(/Presents with Abdominal Pain at Abdomen for 3 days\./.test(subj) && /Denies fever\./.test(subj) && !/Presents with[^.]*Fever/i.test(subj) && !/Unspecified/.test(subj),
      `the template note says "Denies fever" and never "Presents with Fever" for a complaint the patient denied — "${subj.slice(0, 90)}"`);
    let refused: unknown = null;
    try { await EdgeAiClient.soap({ transcript, structured: {}, careStream: 'ALLOPATHY' }); } catch (e) { refused = e; }
    check(refused instanceof AiPolicyError && refused.code === 'LLM_OFF' && calls.soap === 0, 'even a direct call to the note-draft model is refused in code');

    const asrMr = await api('POST', '/api/ai/asr?lang=mr', undefined, undefined, audio);
    check(asrMr.status === 503 && asrMr.json.code === 'ASR_LANGUAGE_UNAVAILABLE' && calls.asr.length === 0, 'speech in a language only Whisper could serve is refused before any audio is sent');
    const asrHi = await api('POST', '/api/ai/asr?lang=hi', undefined, undefined, audio);
    check(asrHi.status === 200 && calls.asr.join() === 'hi', 'Hindi speech goes to the non-generative recogniser');
    asrEngineForHindi = 'faster-whisper';
    const asrLie = await api('POST', '/api/ai/asr?lang=hi', undefined, undefined, audio);
    check(asrLie.status === 503 && asrLie.json.code === 'GENERATIVE_ASR_OFF' && !/TEXT WRITTEN/.test(JSON.stringify(asrLie.json)), 'if the machine answers with Whisper anyway, its text is thrown away');
    asrEngineForHindi = 'sherpa-onnx';

    console.log('  hospital switches the clinician note draft on (LLM_ASSIST=clinician):');
    process.env.LLM_ASSIST = 'clinician';
    const st2 = await api('GET', '/api/ai/status');
    const st2Staff = await api('GET', '/api/ai/status', undefined, doctor);
    check(st2.json.data.capabilities.llm.available === false && st2Staff.json.data.capabilities.llm.available === true, 'the kiosk is still told there is no model; the clinician is told there is one');
    const ex2 = await api('POST', '/api/ai/extract', { text: 'मुझे तीन दिन से बुखार है', lang: 'hi' });
    const ex2Staff = await api('POST', '/api/ai/extract', { text: 'fever since 3 days', lang: 'en' }, doctor);
    check(ex2.json.data.aiFindings.length === 0 && ex2Staff.json.data.aiFindings.length === 0 && ex2.json.data.model === null && calls.extract === 0, 'extraction still never reaches the model, for anyone');
    const soap2 = await api('POST', '/api/ai/soap', { sessionId, transcript, draft: { advice: 'Rest and fluids', followUpDays: 3 } }, doctor);
    check(soap2.json.data.generatedBy === 'llm' && calls.soap === 1 && soap2.json.data.reviewRequired === true, 'the clinician\'s note draft now comes from the model and is marked for review');
    check(soap2.json.data.plan === soap.json.data.plan && !/MODEL PLAN/.test(soap2.json.data.plan), 'the plan is still taken from what was prescribed, never from the model');
    const nurseDenied = await api('POST', '/api/ai/soap', { sessionId, transcript, draft: {} });
    check(nurseDenied.status === 401 && calls.soap === 1, 'nobody without a clinician sign-in can ask for a model draft');
  } finally {
    for (const [k, v] of [['EDGE_AI_URL', saved.url], ['LLM_ASSIST', saved.llm], ['GENERATIVE_ASR', saved.asr]] as const) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    await new Promise<void>(r => server.close(() => r()));
    await new Promise<void>(r => standIn.close(() => r()));
    await EdgeAiClient.status(true).catch(() => undefined);
  }

  // ------------------------------------------------------------------ C. Same in, same out, no network
  console.log('\n--- C. Deterministic, and it works with the network cut off ---');
  const summarise = (text: string, rich = false) => {
    const r: any = ClinicalParserService.parse(text);
    const s = buildHistorySummary({ ...(rich ? RICH_EXTRAS : { patient: {} }), symptoms: r.symptoms || [], history: normaliseHistory(rich ? RICH_HISTORY : {}), vitals: rich ? RICH_EXTRAS.vitals : r.vitals, rawTranscript: text });
    return { input: { symptoms: r.symptoms, vitals: r.vitals }, summary: s, fingerprint: JSON.stringify({ ...r, timestamp: 0 }) + JSON.stringify({ ...s, generatedAt: 0 }) };
  };
  const sample = sentences.slice(0, 40);
  const first = sample.map(t => summarise(t).fingerprint);
  let same = true;
  for (let run = 0; run < 25 && same; run++) same = sample.every((t, i) => summarise(t).fingerprint === first[i]);
  check(sample.length === 40 && same, '40 sentences × 25 runs: every record and summary identical to the first run');

  const realFetch = globalThis.fetch;
  const realConnect = net.Socket.prototype.connect;
  let networkAttempts = 0;
  (globalThis as any).fetch = () => { networkAttempts++; throw new Error('network is cut off'); };
  (net.Socket.prototype as any).connect = function () { networkAttempts++; throw new Error('network is cut off'); };
  let offlineOk = true;
  try {
    for (const t of sentences) { const s = summarise(t, true).summary; if (s.method !== 'deterministic-template' || s.sections.length < 9) offlineOk = false; }
    if (traceSummary(sentences[0]).method !== 'deterministic-template') offlineOk = false;
  } catch { offlineOk = false; } finally { globalThis.fetch = realFetch; net.Socket.prototype.connect = realConnect; }
  check(offlineOk && networkAttempts === 0, `${sentences.length} sentences understood and summarised with the network cut off (network attempts: ${networkAttempts})`);

  // ------------------------------------------------------------------ D. Grounding
  console.log('\n--- D. Every word comes from the record or from the fixed templates ---');
  // the templates are the string constants of these files; the kiosk's own Hindi labels are data
  const templateWords = new Set<string>(words([read('backend/src/services/clinicalHistory.service.ts'), read('backend/src/services/summaryRealiser.ts'), read('backend/src/data/kiosk_labels_hi.json')].join('\n')));
  const strays = new Map<string, string>();
  let checkedWords = 0;
  let summaries = 0;
  sentences.forEach((t, i) => {
    const rich = i % 3 === 0;
    const { input, summary } = summarise(t, rich);
    const allowed = new Set<string>(words(deepStrings(rich ? { ...input, ...RICH_EXTRAS, history: normaliseHistory(RICH_HISTORY) } : input).join(' ')));
    for (const w of words(`${summary.text}\n${summary.textHi}`)) {
      checkedWords++;
      if (!allowed.has(w) && !templateWords.has(w)) strays.set(w, t);
    }
    summaries++;
  });
  check(summaries === sentences.length && summaries > 400 && strays.size === 0, `${checkedWords.toLocaleString()} words in ${summaries} English + Hindi summaries: all from the record or the templates${strays.size ? ` — strays: ${[...strays.keys()].slice(0, 8).join(', ')}` : ''}`);
  const marker = buildHistorySummary({ patient: { name: 'Zxqv Person' }, symptoms: [{ name: 'Qwzpl complaint', site: 'Vbnmk', onset: 'Jkhgf', isNegated: false, severity: 0 }], history: normaliseHistory({ pastMedical: [{ name: 'Plokij disease' }] }) });
  check(/Qwzpl complaint at Vbnmk since Jkhgf/.test(marker.text) && /Plokij disease/.test(marker.text) && JSON.stringify(marker.untranslatedHi) === JSON.stringify(['Jkhgf', 'Plokij disease', 'Qwzpl complaint', 'Vbnmk']),
    'unknown terms are passed through exactly as recorded and listed as untranslated, never replaced by a guess');

  // ------------------------------------------------------------------ E. Hindi
  console.log('\n--- E. The Hindi summary is Hindi ---');
  const labels = buildKioskLabels();
  check(read('backend/src/data/kiosk_labels_hi.json') === JSON.stringify(labels, null, 2) + '\n' && Object.keys(labels.symptoms).length > 120, `the Hindi label file matches the kiosk catalog (${Object.keys(labels.symptoms).length} complaints, ${Object.keys(labels.regions).length} body areas)`);

  const parserSrc = read('backend/src/services/clinicalParser.service.ts');
  const names = new Set<string>();
  const sites = new Set<string>();
  for (const m of parserSrc.matchAll(/standard: '([^']+)'(?:, defaultSite: '([^']+)')?/g)) { names.add(m[1]); if (m[2]) sites.add(m[2]); }
  for (const m of parserSrc.matchAll(/note\('([^']+)', '([^']+)'/g)) { names.add(m[1]); sites.add(m[2]); }
  for (const m of parserSrc.matchAll(/\[\[[^\]]*\], \[[^\]]*\], '([^']+)', '([^']+)'\]/g)) { names.add(m[1]); sites.add(m[2]); }
  for (const m of parserSrc.matchAll(/F_[A-Z_]+: \['([^']+)', '([^']+)'\]/g)) { names.add(m[1]); sites.add(m[2]); }
  for (const n of ['Hematochezia / Rectal Bleeding', 'Hematuria', 'Epistaxis', 'Bleeding Per Vagina / Rectum', 'Hemoptysis', 'Hematemesis']) names.add(n);
  const T = new HindiTerms();
  for (const n of names) T.symptom(n);
  for (const s of sites) T.site(s);
  for (const n of Object.keys(labels.symptoms)) T.symptom(n);
  for (const r of Object.keys(labels.regions)) { T.site(r); T.symptom(r); }
  check(names.size > 100 && sites.size > 40 && T.untranslated.size === 0, `all ${names.size} complaint names and ${sites.size} body areas the speech parser can emit, and all ${Object.keys(labels.symptoms).length} kiosk complaints, have a Hindi entry${T.untranslated.size ? ` — missing: ${[...T.untranslated].slice(0, 10).join(' | ')}` : ''}`);

  const missing = new Set<string>();
  for (const t of sentences) for (const u of summarise(t).summary.untranslatedHi || []) missing.add(u);
  check(missing.size === 0, `${sentences.length} test sentences: no summary left a term untranslated${missing.size ? ` — ${[...missing].slice(0, 10).join(' | ')}` : ''}`);

  const hi = summarise('मुझे तीन दिन से पेट में दर्द है बुखार नहीं है बीपी एक सौ पचास बटा पचानवे है').summary;
  check(!/[A-Za-z]/.test(hi.textHi) && /पेट में दर्द, 3 दिन से/.test(hi.textHi) && /नकारा: बुखार/.test(hi.textHi) && /बीपी 150\/95/.test(hi.textHi), 'a Hindi complaint is summarised with no English word in it');
  const full = buildHistorySummary({ ...RICH_EXTRAS, symptoms: ClinicalParserService.parse('सीने में दर्द है जो बाएं हाथ तक जाता है चलने पर बढ़ता है दो हफ्ते से').symptoms, history: normaliseHistory(RICH_HISTORY) });
  const latin = (full.textHi.match(/[A-Za-z][A-Za-z.-]*/g) || []).filter(w => !['Asha', 'Devi', 'Appendicectomy', 'Salbutamol', 'inhaler', 'puffs', 'SOS', 'Sulfa', 'rash', 'farmer', 'SpO', 'F', 'Hb', 'g', 'dL', 'Anaemia', 'Ferrous', 'sulphate', 'NEWS'].includes(w));
  check(latin.length === 0 && /मधुमेह/.test(full.textHi) && /पिता/.test(full.textHi) && /प्रकृति वात-पित्त/.test(full.textHi) && /बाएँ हाथ तक फैलता है/.test(full.textHi),
    `in a full record only names, medicines, typed text and lab codes stay as written${latin.length ? ` — unexpected: ${latin.join(', ')}` : ''}`);

  // "asked, not answered" must never read as "none" in either language
  const unanswered = buildHistorySummary({ patient: {}, symptoms: [], history: normaliseHistory({ conditions: [], allergies: '', currentMedicines: '' }) });
  const drugHi = unanswered.sections.find(s => s.id === 'drugAllergy')!;
  check(/asked, not answered/.test(drugHi.text) && /पूछा गया, उत्तर नहीं मिला/.test(drugHi.textHi) && !/कोई एलर्जी नहीं|कोई दवा नहीं/.test(drugHi.textHi), 'an unanswered allergy question reads "asked, not answered" in Hindi too, not "no allergies"');
  const deniedAll = buildHistorySummary({ patient: {}, symptoms: [], history: normaliseHistory({ conditions: [], allergies: 'none', currentMedicines: 'nahi' }) });
  const deniedHi = deniedAll.sections.find(s => s.id === 'drugAllergy')!;
  check(/patient denies/.test(deniedHi.text) && /कोई एलर्जी नहीं \(मरीज़ ने नकारा\)/.test(deniedHi.textHi), 'a real denial reads as a denial in both languages');

  // ------------------------------------------------------------------ F. Sources
  console.log('\n--- F. Every quoted source is something the patient said ---');
  let spoken = 0, quoted = 0, notVerbatim = 0, wrongSense = 0;
  // a denial ("नहीं", "no", "denies"), a complaint that is over ("ठीक हो गया", "has gone") or one from the past ("पहले … थी", "last year")
  const DENIAL = /नहीं|नही|नहिं|ना|\bno\b|\bnot\b|n't|\bnahi|\bnahin|\bnhi\b|denies|denied|without|बिना|\bnever\b|ठीक|गया|गई|गए|gone|stopped|resolved|\bnil\b|\bna\b|न\s|पहले|\bथा\b|थी|\bhad\b|last year|used to|\bago\b/i;
  for (const t of sentences) {
    const s = summarise(t).summary;
    for (const src of s.sections.find(x => x.id === 'hpi')?.sources || []) {
      spoken++;
      if (!src.quote) continue;
      quoted++;
      if (!t.includes(src.quote)) notVerbatim++;
      if (src.item.startsWith('Denies: ') && !DENIAL.test(src.quote)) wrongSense++;
    }
  }
  const pct = spoken ? Math.round((quoted / spoken) * 1000) / 10 : 0;
  check(quoted > 300 && notVerbatim === 0, `${quoted} quoted sources: each one is, letter for letter, part of what the patient said`);
  check(wrongSense === 0, 'a quote behind a "denies" line always shows the patient\'s own denial (or that the complaint is over or past)');
  check(pct >= 85, `${pct}% of ${spoken} spoken findings carry a quote (the rest are stated without one rather than guessed)`);
  const tr = traceSummary('मुझे तीन दिन से पेट में दर्द है बुखार नहीं है बीपी एक सौ पचास बटा पचानवे है');
  check(tr.method === 'deterministic-template' && tr.numbers.text.includes('150 बटा 95') && tr.lookup.some(m => m.words === 'बुखार' && m.denied && m.denialWord === 'नहीं') && tr.record.some(r => r.complaint === 'Abdominal Pain' && r.since === '3 days' && !r.denied),
    'the step-by-step trace (npm run explain) shows numbers, dictionary hits, the denial word and the record');

  const isPassed = passed === total;
  console.log(`\nNo-language-model guarantee: ${passed}/${total} ${isPassed ? 'passed' : 'FAILED'} in ${(performance.now() - t0).toFixed(0)} ms`);
  return { passed, total, isPassed, quotedPercent: pct };
}

if (require.main === module) {
  runNoLlmGuaranteeBattery().then(r => process.exit(r.isPassed ? 0 : 1));
}
