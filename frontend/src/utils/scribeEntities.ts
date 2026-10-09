/**
 * Chips under each line of the consultation scribe: what the line actually says, read with the same engine as
 * the kiosk (clinicalText.ts, clinicalLexicon.ts, vernacularSpeech.ts) — symptoms the speaker affirmed, findings
 * they denied (quoted in their own words), vitals and durations as read, and medicines matched as whole words.
 * Display only: the structured note still comes from the server parser ("Auto-extract").
 */
import { findDurations, findPhrase, parseVitals, tokens } from './clinicalText';
import { analyseComplaint, conceptMentions, NEVER_NEGATED } from './clinicalLexicon';
import { extractSymptomsFromSpeech } from './vernacularSpeech';

export type ScribeChipKind = 'symptom' | 'emergency' | 'denied' | 'vital' | 'duration' | 'rx' | 'ayush';
export interface ScribeChip { kind: ScribeChipKind; label: string }

/** [spoken form, chip label]: generics, common Indian brands and their Hindi spellings. */
const RX: Array<[string, string]> = [
  ['paracetamol', 'Paracetamol'], ['dolo', 'Paracetamol'], ['crocin', 'Paracetamol'], ['calpol', 'Paracetamol'], ['पैरासिटामोल', 'Paracetamol'],
  ['डोलो', 'Paracetamol'], ['क्रोसिन', 'Paracetamol'], ['combiflam', 'Ibuprofen + Paracetamol'], ['ibuprofen', 'Ibuprofen'], ['brufen', 'Ibuprofen'],
  ['diclofenac', 'Diclofenac'], ['voveran', 'Diclofenac'], ['aceclofenac', 'Aceclofenac'], ['zerodol', 'Aceclofenac'], ['meftal', 'Mefenamic acid'],
  ['naproxen', 'Naproxen'], ['etoricoxib', 'Etoricoxib'], ['tramadol', 'Tramadol'],
  ['pantoprazole', 'Pantoprazole'], ['pantocid', 'Pantoprazole'], ['pan 40', 'Pantoprazole'], ['pan d', 'Pantoprazole + Domperidone'],
  ['omeprazole', 'Omeprazole'], ['omez', 'Omeprazole'], ['rabeprazole', 'Rabeprazole'], ['esomeprazole', 'Esomeprazole'], ['ranitidine', 'Ranitidine'],
  ['rantac', 'Ranitidine'], ['aciloc', 'Ranitidine'], ['famotidine', 'Famotidine'], ['digene', 'Antacid'], ['gelusil', 'Antacid'], ['eno', 'Antacid'],
  ['antacid', 'Antacid'], ['sucralfate', 'Sucralfate'], ['domperidone', 'Domperidone'], ['ondansetron', 'Ondansetron'], ['emeset', 'Ondansetron'],
  ['ors', 'ORS'], ['ओआरएस', 'ORS'],
  ['amoxicillin', 'Amoxicillin'], ['augmentin', 'Amoxicillin + Clavulanate'], ['azithromycin', 'Azithromycin'], ['azithral', 'Azithromycin'],
  ['cefixime', 'Cefixime'], ['taxim', 'Cefixime'], ['ciprofloxacin', 'Ciprofloxacin'], ['ciplox', 'Ciprofloxacin'], ['ofloxacin', 'Ofloxacin'],
  ['norfloxacin', 'Norfloxacin'], ['metronidazole', 'Metronidazole'], ['metrogyl', 'Metronidazole'], ['doxycycline', 'Doxycycline'], ['levofloxacin', 'Levofloxacin'],
  ['metformin', 'Metformin'], ['glycomet', 'Metformin'], ['मेटफॉर्मिन', 'Metformin'], ['glimepiride', 'Glimepiride'], ['amaryl', 'Glimepiride'],
  ['sitagliptin', 'Sitagliptin'], ['januvia', 'Sitagliptin'], ['teneligliptin', 'Teneligliptin'], ['vildagliptin', 'Vildagliptin'],
  ['dapagliflozin', 'Dapagliflozin'], ['empagliflozin', 'Empagliflozin'], ['insulin', 'Insulin'], ['इंसुलिन', 'Insulin'],
  ['amlodipine', 'Amlodipine'], ['amlong', 'Amlodipine'], ['telmisartan', 'Telmisartan'], ['telma', 'Telmisartan'], ['losartan', 'Losartan'],
  ['atenolol', 'Atenolol'], ['metoprolol', 'Metoprolol'], ['atorvastatin', 'Atorvastatin'], ['atorva', 'Atorvastatin'], ['rosuvastatin', 'Rosuvastatin'],
  ['aspirin', 'Aspirin'], ['ecosprin', 'Aspirin'], ['clopidogrel', 'Clopidogrel'], ['warfarin', 'Warfarin'], ['digoxin', 'Digoxin'],
  ['levothyroxine', 'Levothyroxine'], ['thyronorm', 'Levothyroxine'], ['eltroxin', 'Levothyroxine'],
  ['cetirizine', 'Cetirizine'], ['levocetirizine', 'Levocetirizine'], ['montelukast', 'Montelukast'], ['montair', 'Montelukast'],
  ['salbutamol', 'Salbutamol'], ['asthalin', 'Salbutamol'], ['budesonide', 'Budesonide'], ['ascoril', 'Ascoril (expectorant)'], ['grilinctus', 'Grilinctus (cough syrup)'],
  ['pregabalin', 'Pregabalin'], ['alprazolam', 'Alprazolam'], ['shelcal', 'Calcium'], ['becosules', 'B-complex'], ['neurobion', 'B-complex']
];
const AYUSH: Array<[string, string]> = [
  ['guggulu', 'Guggulu'], ['गुग्गुलु', 'Guggulu'], ['ashwagandha', 'Ashwagandha'], ['अश्वगंधा', 'Ashwagandha'], ['triphala', 'Triphala'], ['त्रिफला', 'Triphala'],
  ['giloy', 'Guduchi (Giloy)'], ['guduchi', 'Guduchi (Giloy)'], ['गिलोय', 'Guduchi (Giloy)'], ['shilajit', 'Shilajit'], ['avipattikar', 'Avipattikar Churna'],
  ['arogyavardhini', 'Arogyavardhini Vati'], ['chandraprabha', 'Chandraprabha Vati'], ['sitopaladi', 'Sitopaladi Churna'], ['yashtimadhu', 'Yashtimadhu'],
  ['mulethi', 'Yashtimadhu'], ['brahmi', 'Brahmi'], ['shallaki', 'Shallaki'], ['haridra', 'Haridra'], ['draksharishta', 'Draksharishta'],
  ['arjuna', 'Arjuna'], ['dashmoolarishta', 'Dashamoolarishta'], ['mahasudarshan', 'Mahasudarshan'], ['chyawanprash', 'Chyawanprash'], ['च्यवनप्राश', 'Chyawanprash'],
  ['punarnavasava', 'Punarnavasava'], ['kutajarishta', 'Kutajarishta'], ['rasnasaptak', 'Rasnasaptaka Kwatha']
];

const isDevanagari = (t: string) => /[ऀ-ॿ]/.test(t);

/** Chips for one transcript line. */
export function scribeChips(text: string): ScribeChip[] {
  const line = (text || '').trim();
  if (!line) return [];
  const chips: ScribeChip[] = [];
  const add = (kind: ScribeChipKind, label: string) => { if (!chips.some(c => c.label === label)) chips.push({ kind, label }); };

  // Emergency rules first (same recall-first rules as the kiosk), then the symptoms the speaker affirmed.
  for (const f of analyseComplaint(line).redFlags) add('emergency', `Red flag: ${f.label}`);
  for (const s of extractSymptomsFromSpeech(line, isDevanagari(line) ? 'hi' : 'en').symptoms) { if (s.name) add(s.isEmergency ? 'emergency' : 'symptom', s.name); }

  // Denials, quoted as said: neighbouring denied phrases in one clause form one quote ("seene me dard").
  const words = tokens(line);
  const wordAt = (pos: number) => words.findIndex(w => w.end > pos);
  const denied = conceptMentions(line).filter(m => m.negated);
  const groups: Array<{ start: number; end: number; finding: boolean }> = [];
  for (const m of denied) {
    const finding = m.concepts.some(c => (c.startsWith('F_') || c.startsWith('R_')) && !NEVER_NEGATED(c));
    const last = groups[groups.length - 1];
    const between = last ? words.slice(wordAt(last.end), wordAt(m.start)) : [];
    if (last && m.start >= last.end && between.length <= 3 && !between.some(w => w.punct)) {
      last.end = Math.max(last.end, m.end);
      last.finding ||= finding;
    } else if (!last || m.start >= last.end) groups.push({ start: m.start, end: m.end, finding });
  }
  for (const g of groups) if (g.finding) add('denied', `No ${line.slice(g.start, g.end).slice(0, 40)}`);

  const v = parseVitals(line);
  if (v.bp) add('vital', `BP ${v.bp}`);
  if (v.pulse) add('vital', `Pulse ${v.pulse}`);
  if (v.spo2) add('vital', `SpO₂ ${v.spo2}`);
  if (v.temp) add('vital', `Temp ${v.temp}`);
  if (v.bloodSugar) add('vital', `Sugar ${v.bloodSugar} mg/dL`);
  if (v.respiratoryRate) add('vital', `RR ${v.respiratoryRate}/min`);

  const d = findDurations(line)[0]?.value;
  if (d) add('duration', /^\d|^a few/.test(d) ? `For ${d}` : d[0].toUpperCase() + d.slice(1));

  for (const [phrase, label] of RX) if (findPhrase(line, phrase).length) add('rx', `Rx: ${label}`);
  for (const [phrase, label] of AYUSH) if (findPhrase(line, phrase).length) add('ayush', `AYUSH: ${label}`);
  return chips;
}
