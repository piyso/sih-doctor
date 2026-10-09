/**
 * Prescription safety rules over resolved prescription lines and the patient's context.
 *
 * Three tiers, one meaning each:
 *   STOP — must not be signed without a typed reason (stored in the signed record).
 *   WARN — shown beside the medicine; no block.
 *   INFO — in the safety summary only (spacing advice, statutory labels, stewardship tags).
 * "Interrupt only for what must stop the prescriber" (Phansalkar et al., JAMIA 2012/2013).
 *
 * Every rule names a mechanism, an action and a source. Rules about lines the patient only
 * *reports* taking are capped at WARN unless a prescribed line is involved.
 */

import { DrugClass, DrugConcept, drugById, REVIEW_STATUS } from './drugDictionary';
import { AyushFlag, constituentsWithFlag } from './ayushDictionary';
import { ResolvedLine, lookupAllo, cleanName } from './resolver';
import { findBannedFdc } from './bannedFdc';
import { dailyDoseMg, parseDose, parseFrequency } from './sig';

export type Tier = 'STOP' | 'WARN' | 'INFO';
export type Family =
  | 'allergy' | 'duplicate' | 'ddi' | 'herb_drug' | 'viruddha' | 'pregnancy' | 'lactation' | 'renal' | 'paediatric' | 'elderly'
  | 'dose' | 'disease' | 'banned_fdc' | 'statutory' | 'stewardship' | 'context';
export type Evidence = 'established' | 'probable' | 'theoretical' | 'statutory';

export interface SafetyAlert {
  alertId: string;
  severity: 'CRITICAL_CONTRAINDICATION' | 'WARNING' | 'INFO' | 'AYUSH_INCOMPATIBILITY' | 'STATUTORY_SCHEDULE_E1';
  tier: Tier;
  family: Family;
  itemA: string;
  itemB: string;
  mechanism: string;
  clinicalAction: string;
  citation: string;
  evidence: Evidence;
  evidenceScore: number;
  lineRefs: number[];
  groupKey: string;
  source: 'rules' | 'registry' | 'ontology' | 'ayush_engine';
}

export interface SafetyContext {
  age?: number;
  gender?: string;
  isPregnant?: boolean;
  /** 'unknown' when the patient did not answer or was not sure (isPregnant is then not true). */
  pregnancyStatus?: 'yes' | 'no' | 'unknown';
  gestationalWeeks?: number;
  isLactating?: boolean;
  eGfr?: number;
  weightKg?: number;
  isDiabetic?: boolean;
  allergies?: Array<{ agent: string; reaction?: string; severity?: string }>;
  conditions?: string[];
  teleconsult?: boolean;
}

export const EVIDENCE_SCORE: Record<Evidence, number> = { established: 0.95, probable: 0.85, theoretical: 0.6, statutory: 1 };
export const severityForTier = (tier: Tier): SafetyAlert['severity'] => tier === 'STOP' ? 'CRITICAL_CONTRAINDICATION' : tier === 'WARN' ? 'WARNING' : 'INFO';
export const tierForSeverity = (sev: string): Tier => sev === 'CRITICAL_CONTRAINDICATION' ? 'STOP' : sev === 'INFO' || sev === 'STATUTORY_SCHEDULE_E1' || sev === 'SAFE_COMBINATION' ? 'INFO' : 'WARN';
export const groupKeyOf = (family: Family, lineRefs: number[]) => `${family}:${Array.from(new Set(lineRefs)).sort((a, b) => a - b).join('-') || 'patient'}`;

const C = {
  ddi: 'Product labels; BNF interactions (Appendix 1); Stockley’s Drug Interactions',
  allergy: 'Drug allergy practice parameter (AAAAI/ACAAI 2022): penicillin–cephalosporin and sulfonamide cross-reactivity',
  pregnancy: 'Product labels; BNF pregnancy guidance; FDA 2020 NSAID ≥ 20 weeks advisory',
  renal: 'Product labels; BNF renal-impairment dosing; KDIGO',
  paed: 'Product labels; BNF for Children; FDA 2017 codeine/tramadol < 12 y; CDSCO 2011 nimesulide < 12 y',
  elderly: 'American Geriatrics Society Beers Criteria (2023)',
  aware: 'WHO AWaRe antibiotic book (2022) / classification (2023); MoHFW advisory (2024) to record the indication for every antibiotic',
  statutory: 'Drugs and Cosmetics Rules 1945 (Schedules E(1), H, H1, X); NDPS Act 1985; Telemedicine Practice Guidelines 2020',
  herb: 'WHO monographs on selected medicinal plants; published case reports and pharmacology (evidence level stated per alert)'
};

interface Ctx {
  lines: ResolvedLine[];
  alerts: SafetyAlert[];
  ctx: SafetyContext;
}

function emit(state: Ctx, a: Omit<SafetyAlert, 'severity' | 'evidenceScore' | 'groupKey' | 'source'> & { severity?: SafetyAlert['severity'] }) {
  // A rule involving only lines the patient reports (not prescribed now) is capped at WARN.
  const involved = a.lineRefs.map(i => state.lines.find(l => l.index === i)).filter(Boolean) as ResolvedLine[];
  let tier = a.tier;
  if (tier === 'STOP' && involved.length && involved.every(l => l.role === 'reported')) tier = 'WARN';
  const groupKey = groupKeyOf(a.family, a.lineRefs);
  const existing = state.alerts.find(x => x.groupKey === groupKey && x.alertId === a.alertId);
  if (existing) return;
  state.alerts.push({
    ...a,
    tier,
    severity: a.severity && tier === a.tier ? a.severity : severityForTier(tier),
    evidenceScore: EVIDENCE_SCORE[a.evidence],
    groupKey,
    source: 'rules'
  });
}

// ── Selectors ────────────────────────────────────────────────────────────────
interface Sel { ids?: string[]; classes?: DrugClass[]; cyp?: Array<NonNullable<DrugConcept['cyp3a4']>>; qt?: boolean; serotonergic?: boolean }
const matches = (c: DrugConcept, s: Sel) =>
  (s.ids?.includes(c.id) ?? false) || (s.classes?.some(k => c.classes.includes(k)) ?? false) || (s.cyp?.includes(c.cyp3a4 as any) ?? false) || (!!s.qt && !!c.qt) || (!!s.serotonergic && !!c.serotonergic);

interface DdiRule { id: string; a: Sel; b: Sel; tier: Tier; mechanism: string; action: string; evidence: Evidence; unless?: (ctx: SafetyContext) => boolean; stopIf?: (ctx: SafetyContext) => boolean }

const DDI: DdiRule[] = [
  { id: 'DDI-VKA-NSAID', a: { classes: ['vka'] }, b: { classes: ['nsaid'] }, tier: 'STOP', evidence: 'established', mechanism: 'NSAIDs add antiplatelet effect and gastric mucosal injury to anticoagulation: major GI and other bleeding.', action: 'Avoid; use paracetamol for pain. If an NSAID is essential, shortest course with a PPI and INR check.' },
  { id: 'DDI-ANTICOAG-ANTIPLATELET', a: { classes: ['vka', 'doac'] }, b: { classes: ['antiplatelet'] }, tier: 'WARN', evidence: 'established', mechanism: 'Anticoagulant plus antiplatelet raises major bleeding risk.', action: 'Confirm a clear indication (e.g. recent stent); add gastroprotection; review duration.' },
  { id: 'DDI-VKA-INR-RISE', a: { classes: ['vka'] }, b: { ids: ['metronidazole', 'tinidazole', 'fluconazole', 'cotrimoxazole'] }, tier: 'STOP', evidence: 'established', mechanism: 'CYP2C9 inhibition / reduced warfarin clearance: large INR rise and bleeding.', action: 'Choose another antimicrobial; if unavoidable, reduce warfarin and check INR within 3–5 days.' },
  { id: 'DDI-VKA-INR-MONITOR', a: { classes: ['vka'] }, b: { ids: ['clarithromycin', 'erythromycin', 'ciprofloxacin', 'levofloxacin', 'ofloxacin', 'amiodarone', 'allopurinol', 'itraconazole', 'ketoconazole'] }, tier: 'WARN', evidence: 'probable', mechanism: 'May potentiate warfarin (raised INR).', action: 'Check INR within a week of starting or stopping.' },
  { id: 'DDI-VKA-INDUCER', a: { classes: ['vka'] }, b: { cyp: ['strong_inducer'] }, tier: 'WARN', evidence: 'established', mechanism: 'Enzyme induction lowers warfarin levels: loss of anticoagulation (and rebound when stopped).', action: 'Monitor INR closely; adjust dose.' },
  { id: 'DDI-DOAC-NSAID', a: { classes: ['doac'] }, b: { classes: ['nsaid'] }, tier: 'WARN', evidence: 'established', mechanism: 'Additive bleeding risk.', action: 'Avoid regular NSAIDs; use paracetamol.' },
  { id: 'DDI-DOAC-INTERACTING', a: { classes: ['doac'] }, b: { cyp: ['strong_inhibitor', 'strong_inducer'] }, tier: 'WARN', evidence: 'established', mechanism: 'Strong CYP3A4/P-gp inhibitors raise and inducers lower DOAC levels.', action: 'Avoid the combination or choose an alternative anticoagulant.' },
  { id: 'DDI-STATIN-CYP3A4', a: { ids: ['simvastatin', 'lovastatin'] }, b: { cyp: ['strong_inhibitor'] }, tier: 'STOP', evidence: 'established', mechanism: 'Strong CYP3A4 inhibition raises simvastatin/lovastatin many-fold: rhabdomyolysis.', action: 'Contraindicated: suspend the statin during the course or use azithromycin instead of clarithromycin.' },
  { id: 'DDI-ATORVA-CYP3A4', a: { ids: ['atorvastatin'] }, b: { cyp: ['strong_inhibitor'] }, tier: 'WARN', evidence: 'established', mechanism: 'Raised atorvastatin exposure (myopathy).', action: 'Limit atorvastatin to 20 mg or pause it during the course.' },
  { id: 'DDI-SIMVA-CCB', a: { ids: ['simvastatin', 'lovastatin'] }, b: { ids: ['amlodipine', 'diltiazem', 'verapamil', 'amiodarone'] }, tier: 'WARN', evidence: 'established', mechanism: 'Raised simvastatin levels (myopathy).', action: 'Maximum simvastatin 20 mg (10 mg with diltiazem/verapamil), or switch to atorvastatin/rosuvastatin.' },
  { id: 'DDI-STATIN-GEMFIBROZIL', a: { classes: ['statin'] }, b: { ids: ['gemfibrozil'] }, tier: 'STOP', evidence: 'established', mechanism: 'Gemfibrozil inhibits statin glucuronidation/OATP1B1: rhabdomyolysis.', action: 'Avoid; use fenofibrate if a fibrate is needed.' },
  { id: 'DDI-PDE5-NITRATE', a: { classes: ['pde5_inhibitor'] }, b: { classes: ['nitrate'] }, tier: 'STOP', evidence: 'established', mechanism: 'Synergistic cGMP-mediated vasodilatation: severe, refractory hypotension and MI.', action: 'Contraindicated. No PDE5 inhibitor within 24 h (sildenafil) / 48 h (tadalafil) of a nitrate.' },
  { id: 'DDI-PDE5-ALPHA', a: { classes: ['pde5_inhibitor'] }, b: { classes: ['alpha_blocker', 'alpha_blocker_urological'] }, tier: 'WARN', evidence: 'established', mechanism: 'Additive hypotension.', action: 'Start the PDE5 inhibitor at the lowest dose once the alpha-blocker is stable.' },
  { id: 'DDI-TIZANIDINE-CYP1A2', a: { ids: ['tizanidine'] }, b: { ids: ['ciprofloxacin', 'fluvoxamine'] }, tier: 'STOP', evidence: 'established', mechanism: 'CYP1A2 inhibition raises tizanidine ~10-fold: hypotension, sedation.', action: 'Contraindicated; choose another antibiotic or muscle relaxant.' },
  { id: 'DDI-MTX-TRIMETHOPRIM', a: { ids: ['methotrexate'] }, b: { ids: ['cotrimoxazole'] }, tier: 'STOP', evidence: 'established', mechanism: 'Additive antifolate effect and reduced renal clearance: pancytopenia.', action: 'Avoid co-trimoxazole in patients on methotrexate.' },
  { id: 'DDI-MTX-NSAID', a: { ids: ['methotrexate'] }, b: { classes: ['nsaid'] }, tier: 'WARN', evidence: 'probable', mechanism: 'NSAIDs reduce methotrexate clearance (significant at higher doses).', action: 'Avoid regular NSAIDs around methotrexate; monitor blood counts and renal function.' },
  { id: 'DDI-SEROTONIN-LINEZOLID', a: { serotonergic: true }, b: { ids: ['linezolid'] }, tier: 'STOP', evidence: 'established', mechanism: 'Linezolid is an MAO inhibitor: serotonin toxicity with serotonergic drugs.', action: 'Avoid; if linezolid is essential, stop the serotonergic drug and monitor.' },
  { id: 'DDI-SEROTONIN-OPIOID', a: { classes: ['ssri', 'snri', 'tca'] }, b: { ids: ['tramadol', 'tapentadol', 'dextromethorphan'] }, tier: 'WARN', evidence: 'established', mechanism: 'Serotonin toxicity and lowered seizure threshold.', action: 'Prefer a non-serotonergic analgesic; if used, lowest dose and warn about agitation, tremor, fever.' },
  { id: 'DDI-DUAL-RAAS', a: { classes: ['acei'] }, b: { classes: ['arb'] }, tier: 'STOP', evidence: 'established', mechanism: 'Dual RAAS blockade: hyperkalaemia, hypotension, acute kidney injury without outcome benefit (ONTARGET).', action: 'Use one RAAS agent only.' },
  { id: 'DDI-RAAS-KSPARING', a: { classes: ['acei', 'arb'] }, b: { classes: ['k_sparing_diuretic', 'potassium_supplement'] }, tier: 'WARN', evidence: 'established', mechanism: 'Hyperkalaemia.', action: 'Check potassium and creatinine within 1–2 weeks; avoid if eGFR < 30.', stopIf: c => c.eGfr !== undefined && c.eGfr < 30 },
  { id: 'DDI-KSPARING-POTASSIUM', a: { classes: ['k_sparing_diuretic'] }, b: { classes: ['potassium_supplement'] }, tier: 'STOP', evidence: 'established', mechanism: 'Severe hyperkalaemia.', action: 'Do not combine unless hypokalaemia is documented and monitored.' },
  { id: 'DDI-RAAS-NSAID', a: { classes: ['acei', 'arb'] }, b: { classes: ['nsaid'] }, tier: 'WARN', evidence: 'established', mechanism: 'NSAIDs blunt the antihypertensive effect and reduce glomerular perfusion (acute kidney injury risk).', action: 'Short course only; check creatinine if > 1 week, older, or dehydrated.' },
  { id: 'DDI-LITHIUM', a: { classes: ['lithium'] }, b: { classes: ['nsaid', 'acei', 'arb', 'thiazide', 'loop_diuretic'] }, tier: 'STOP', evidence: 'established', mechanism: 'Reduced renal lithium clearance: lithium toxicity (tremor, ataxia, confusion).', action: 'Avoid; if essential, reduce lithium and check levels within 5–7 days.' },
  { id: 'DDI-AZA-XO', a: { ids: ['azathioprine'] }, b: { classes: ['xanthine_oxidase_inhibitor'] }, tier: 'STOP', evidence: 'established', mechanism: 'Xanthine oxidase inhibition blocks azathioprine breakdown: severe myelosuppression.', action: 'Avoid, or reduce azathioprine to 25% with close blood-count monitoring (specialist).' },
  { id: 'DDI-THEOPHYLLINE-INHIBITOR', a: { classes: ['methylxanthine'] }, b: { ids: ['ciprofloxacin', 'clarithromycin', 'erythromycin', 'fluvoxamine'] }, tier: 'WARN', evidence: 'established', mechanism: 'Raised theophylline levels: arrhythmia, seizures.', action: 'Choose another antibiotic or halve theophylline and monitor.' },
  { id: 'DDI-OC-INDUCER', a: { classes: ['combined_oral_contraceptive', 'progestogen'] }, b: { cyp: ['strong_inducer'] }, tier: 'WARN', evidence: 'established', mechanism: 'Enzyme induction lowers hormone levels: contraceptive failure.', action: 'Advise a copper IUD or depot injection, or additional barrier method.' },
  { id: 'DDI-CLOPIDOGREL-PPI', a: { ids: ['clopidogrel'] }, b: { ids: ['omeprazole', 'esomeprazole'] }, tier: 'WARN', evidence: 'probable', mechanism: 'CYP2C19 inhibition reduces clopidogrel activation.', action: 'Use pantoprazole instead.' },
  { id: 'DDI-DIGOXIN-LEVEL', a: { classes: ['cardiac_glycoside'] }, b: { ids: ['amiodarone', 'verapamil', 'diltiazem', 'clarithromycin', 'erythromycin', 'itraconazole'] }, tier: 'WARN', evidence: 'established', mechanism: 'Raised digoxin levels (P-gp inhibition): toxicity.', action: 'Halve the digoxin dose and check level / heart rate.' },
  { id: 'DDI-DIGOXIN-DIURETIC', a: { classes: ['cardiac_glycoside'] }, b: { classes: ['loop_diuretic', 'thiazide'] }, tier: 'WARN', evidence: 'established', mechanism: 'Diuretic-induced hypokalaemia sensitises the heart to digoxin toxicity.', action: 'Monitor potassium; supplement or add a potassium-sparing agent.' },
  { id: 'DDI-BB-NONDHP', a: { classes: ['beta_blocker'] }, b: { classes: ['ccb_nondhp'] }, tier: 'WARN', evidence: 'established', mechanism: 'Additive AV-nodal block: bradycardia, heart block, heart failure.', action: 'Avoid in conduction disease or LV dysfunction; monitor heart rate.' },
  { id: 'DDI-DOMPERIDONE-CYP3A4', a: { ids: ['domperidone'] }, b: { cyp: ['strong_inhibitor'] }, tier: 'STOP', evidence: 'established', mechanism: 'Raised domperidone levels with QT prolongation: ventricular arrhythmia.', action: 'Contraindicated; use another antiemetic.' },
  { id: 'DDI-DISULFIRAM-NITRO', a: { ids: ['disulfiram'] }, b: { classes: ['nitroimidazole'] }, tier: 'STOP', evidence: 'established', mechanism: 'Psychotic reactions with metronidazole and disulfiram.', action: 'Contraindicated.' },
  { id: 'DDI-SU-INHIBITOR', a: { classes: ['sulfonylurea'] }, b: { ids: ['fluconazole', 'cotrimoxazole', 'clarithromycin'] }, tier: 'WARN', evidence: 'established', mechanism: 'Raised sulfonylurea levels: hypoglycaemia.', action: 'Warn about hypoglycaemia; check sugars; consider dose reduction.' },
  { id: 'DDI-HYPO-NSBB', a: { classes: ['insulin', 'sulfonylurea'] }, b: { classes: ['beta_blocker_nonselective'] }, tier: 'INFO', evidence: 'probable', mechanism: 'Non-selective β-blockers mask hypoglycaemia warning signs and delay recovery.', action: 'Prefer a cardioselective β-blocker; counsel about sweating as a remaining warning sign.' },
  { id: 'DDI-CHELATION', a: { classes: ['fluoroquinolone', 'tetracycline'] }, b: { classes: ['antacid', 'calcium', 'iron'], ids: ['zinc_sulfate', 'sucralfate'] }, tier: 'INFO', evidence: 'established', mechanism: 'Divalent/trivalent cations chelate the antibiotic and cut absorption.', action: 'Give the antibiotic 2 h before or 6 h after the mineral/antacid.' },
  { id: 'DDI-LEVOTHYROXINE-ABSORPTION', a: { classes: ['thyroid_hormone'] }, b: { classes: ['calcium', 'iron', 'antacid'], ids: ['sucralfate'] }, tier: 'INFO', evidence: 'established', mechanism: 'Reduced levothyroxine absorption.', action: 'Take levothyroxine on an empty stomach, 4 h apart from calcium/iron/antacids.' },
  { id: 'DDI-BZD-OPIOID', a: { classes: ['benzodiazepine', 'z_drug'] }, b: { classes: ['opioid'] }, tier: 'WARN', evidence: 'established', mechanism: 'Additive CNS and respiratory depression (FDA boxed warning).', action: 'Avoid the combination; if unavoidable, lowest doses, shortest time, warn about sedation.' },
  { id: 'DDI-COLCHICINE-CYP3A4', a: { ids: ['colchicine'] }, b: { cyp: ['strong_inhibitor'] }, tier: 'STOP', evidence: 'established', mechanism: 'Strong CYP3A4/P-gp inhibition: fatal colchicine toxicity.', action: 'Contraindicated (especially with renal or hepatic impairment); pause colchicine.' },
  { id: 'DDI-CBZ-MACROLIDE', a: { ids: ['carbamazepine'] }, b: { ids: ['clarithromycin', 'erythromycin'] }, tier: 'WARN', evidence: 'established', mechanism: 'Raised carbamazepine levels: toxicity.', action: 'Use azithromycin instead.' },
  { id: 'DDI-FQ-STEROID', a: { classes: ['fluoroquinolone'] }, b: { classes: ['corticosteroid'] }, tier: 'WARN', evidence: 'established', mechanism: 'Tendinopathy and tendon rupture risk (greater over 60 years).', action: 'Avoid the combination where possible; warn to stop at first tendon pain.' },
  { id: 'DDI-SSRI-BLEED', a: { classes: ['ssri', 'snri'] }, b: { classes: ['nsaid', 'vka', 'doac', 'antiplatelet'] }, tier: 'WARN', evidence: 'established', mechanism: 'SSRIs deplete platelet serotonin: added GI bleeding risk.', action: 'Add a PPI if the combination is needed; monitor for bleeding.' },
  { id: 'DDI-NSAID-STEROID', a: { classes: ['nsaid'] }, b: { classes: ['corticosteroid'] }, tier: 'WARN', evidence: 'established', mechanism: 'Higher risk of peptic ulceration and GI bleeding.', action: 'Add a PPI; shortest course.' },
  { id: 'DDI-ASPIRIN-NSAID', a: { ids: ['aspirin'] }, b: { classes: ['nsaid'] }, tier: 'WARN', evidence: 'established', mechanism: 'Added GI bleeding risk; ibuprofen can reduce aspirin’s antiplatelet effect.', action: 'Prefer paracetamol; if an NSAID is needed, take aspirin 30 min before and add a PPI.' },
  { id: 'DDI-PHENYTOIN-FLUCONAZOLE', a: { ids: ['phenytoin'] }, b: { ids: ['fluconazole'] }, tier: 'WARN', evidence: 'established', mechanism: 'Raised phenytoin levels: ataxia, nystagmus.', action: 'Monitor phenytoin levels.' },
  { id: 'DDI-LINEZOLID-SYMPATHO', a: { ids: ['linezolid'] }, b: { classes: ['decongestant'] }, tier: 'WARN', evidence: 'established', mechanism: 'MAO inhibition with sympathomimetics: hypertensive reaction.', action: 'Avoid decongestants during linezolid.' },
  { id: 'DDI-ANTIDIABETIC-STEROID', a: { classes: ['insulin', 'sulfonylurea', 'biguanide', 'dpp4_inhibitor', 'sglt2_inhibitor'] }, b: { classes: ['corticosteroid'] }, tier: 'INFO', evidence: 'established', mechanism: 'Corticosteroids raise blood glucose.', action: 'Monitor sugars during the steroid course.' },
  { id: 'DDI-QT-PAIR', a: { qt: true }, b: { qt: true }, tier: 'WARN', evidence: 'probable', mechanism: 'Two QT-prolonging drugs: additive risk of torsades de pointes (more with low K/Mg, bradycardia, older age).', action: 'Avoid the pair where an alternative exists; ECG if the patient has heart disease.' }
];

// ── Allergy ─────────────────────────────────────────────────────────────────
const ALLERGY_CLASS_WORDS: Array<{ re: RegExp; classes: DrugClass[]; ids?: string[] }> = [
  { re: /penicil|pcn\b|amoxy?cil|ampicil|augmentin|cloxacil/i, classes: ['penicillin'] },
  { re: /sulph?a\b|sulfonamide|sulphonamide|septran|bactrim|co-?trimoxazole|cotrimoxazole/i, classes: ['sulfonamide_antibiotic'] },
  { re: /cephalospor|ceph\b|cef[a-z]+/i, classes: ['cephalosporin'] },
  { re: /quinolone|floxacin/i, classes: ['fluoroquinolone'] },
  { re: /macrolide|azithro|erythro|clarithro/i, classes: ['macrolide'] },
  { re: /tetracycline|doxycycline/i, classes: ['tetracycline'] },
  { re: /\bnsaids?\b|aspirin|ibuprofen|diclofenac|painkiller/i, classes: ['nsaid'], ids: ['aspirin'] },
  { re: /opioid|codeine|morphine|tramadol/i, classes: ['opioid'] },
  { re: /\bstatin/i, classes: ['statin'] },
  { re: /ace inhibitor|enalapril|ramipril|lisinopril/i, classes: ['acei'] }
];
const NO_ALLERGY = /^(none|nil|no|nkda|no known|not known|nahi|no allergy|no allergies)\b/i;

function allergyRules(state: Ctx) {
  const allergies = (state.ctx.allergies || []).filter(a => a?.agent && !NO_ALLERGY.test(a.agent.trim()));
  if (!allergies.length) return;
  for (const allergy of allergies) {
    const agent = allergy.agent;
    const directId = lookupAllo(agent);
    const direct = directId ? drugById(directId) : undefined;
    const allergenClasses = new Set<DrugClass>(direct?.classes || []);
    const allergenIds = new Set<string>(direct ? (direct.ingredients || [direct.id]) : []);
    for (const w of ALLERGY_CLASS_WORDS) if (w.re.test(agent)) { w.classes.forEach(c => allergenClasses.add(c)); (w.ids || []).forEach(i => allergenIds.add(i)); }
    const reaction = allergy.reaction ? ` (${allergy.reaction})` : '';
    const anaphylaxis = /anaphyla|angio-?oedema|angioedema|swelling of (face|lips|throat)|breath|sjs|stevens|ten\b/i.test(`${allergy.reaction || ''} ${allergy.severity || ''}`);

    for (const line of state.lines) {
      if (line.negated || line.kind !== 'allopathic') continue;
      for (const id of line.conceptIds) {
        const c = drugById(id);
        if (!c) continue;
        const sameDrug = allergenIds.has(c.id);
        const sameClass = c.classes.some(k => allergenClasses.has(k) && !['antiplatelet'].includes(k));
        if (sameDrug || sameClass) {
          const nsaidCox2 = allergenClasses.has('nsaid') && !sameDrug && c.classes.includes('cox2_inhibitor');
          emit(state, {
            alertId: nsaidCox2 ? 'ALLERGY-NSAID-COX2' : 'ALLERGY-MATCH', tier: nsaidCox2 ? 'WARN' : 'STOP', family: 'allergy', evidence: 'established',
            itemA: `Allergy: ${agent}${reaction}`, itemB: c.inn, lineRefs: [line.index],
            mechanism: sameDrug ? `The patient has a recorded allergy to ${agent}${reaction}; ${c.inn} is the same drug.` : nsaidCox2 ? `NSAID hypersensitivity recorded; COX-2 selective drugs are usually tolerated but cross-reactions occur.` : `The patient has a recorded allergy to ${agent}${reaction}; ${c.inn} belongs to the same class.`,
            clinicalAction: nsaidCox2 ? 'Use only if essential, first dose under observation.' : 'Do not give. Choose a drug from another class, and confirm the allergy history with the patient.',
            citation: C.allergy
          });
          continue;
        }
        if (allergenClasses.has('penicillin') && c.classes.includes('cephalosporin')) {
          emit(state, { alertId: 'ALLERGY-PEN-CEPH', tier: anaphylaxis ? 'STOP' : 'WARN', family: 'allergy', evidence: 'established', itemA: `Allergy: ${agent}${reaction}`, itemB: c.inn, lineRefs: [line.index],
            mechanism: 'Penicillin–cephalosporin cross-reactivity is low (about 1–2%) and mostly with first-generation agents sharing side chains; higher concern after anaphylaxis.',
            clinicalAction: anaphylaxis ? 'Avoid after a penicillin anaphylaxis unless allergy-tested; choose a non-β-lactam.' : 'Acceptable with a non-severe history; prefer a later-generation cephalosporin and observe the first dose.', citation: C.allergy });
        } else if (allergenClasses.has('cephalosporin') && c.classes.includes('penicillin')) {
          emit(state, { alertId: 'ALLERGY-CEPH-PEN', tier: anaphylaxis ? 'STOP' : 'WARN', family: 'allergy', evidence: 'established', itemA: `Allergy: ${agent}${reaction}`, itemB: c.inn, lineRefs: [line.index],
            mechanism: 'Cephalosporin–penicillin cross-reactivity is uncommon but possible.', clinicalAction: 'Confirm the reaction; observe the first dose or choose a non-β-lactam.', citation: C.allergy });
        } else if (allergenClasses.has('sulfonamide_antibiotic') && ['furosemide', 'hydrochlorothiazide', 'chlorthalidone', 'indapamide', 'glimepiride', 'glibenclamide', 'gliclazide', 'glipizide', 'celecoxib'].includes(c.id)) {
          emit(state, { alertId: 'ALLERGY-SULFA-NONANTIBIOTIC', tier: 'INFO', family: 'allergy', evidence: 'established', itemA: `Allergy: ${agent}`, itemB: c.inn, lineRefs: [line.index],
            mechanism: 'Non-antibiotic sulfonamides rarely cross-react with sulfonamide-antibiotic allergy.', clinicalAction: 'Usually safe; ask about the original reaction.', citation: C.allergy });
        }
      }
    }
    // Ayurvedic allergen ("allergic to ashwagandha")
    const allergenKey = cleanName(agent);
    for (const line of state.lines) {
      if (line.kind === 'allopathic' || !line.ayush || line.negated) continue;
      const names = [line.ayush.name, ...line.ayush.constituents].map(cleanName);
      if (allergenKey.length >= 4 && names.some(n => n && (n.includes(allergenKey) || allergenKey.includes(n)))) {
        emit(state, { alertId: 'ALLERGY-AYUSH', tier: 'STOP', family: 'allergy', evidence: 'established', itemA: `Allergy: ${agent}${reaction}`, itemB: line.ayush.name, lineRefs: [line.index],
          mechanism: `The patient reports an allergy to ${agent}, which is in ${line.ayush.name}.`, clinicalAction: 'Do not give; choose another formulation.', citation: C.allergy });
      }
    }
  }
}

// ── Duplicates ──────────────────────────────────────────────────────────────
const DUPLICATE_CLASSES: DrugClass[] = ['nsaid', 'ppi', 'h2_blocker', 'ssri', 'snri', 'tca', 'benzodiazepine', 'statin', 'sulfonylurea', 'beta_blocker', 'acei', 'arb', 'antihistamine_sedating', 'antihistamine_nonsedating', 'opioid', 'corticosteroid', 'macrolide', 'fluoroquinolone', 'cephalosporin', 'penicillin', 'dpp4_inhibitor', 'sglt2_inhibitor', 'ccb_dhp', 'thiazide', 'loop_diuretic', 'antiemetic_d2'];

function duplicateRules(state: Ctx) {
  const active = state.lines.filter(l => l.kind === 'allopathic' && !l.negated);
  // Same ingredient in two lines (e.g. paracetamol in Dolo and in Combiflam).
  const byIngredient = new Map<string, ResolvedLine[]>();
  for (const l of active) for (const id of l.conceptIds) byIngredient.set(id, [...(byIngredient.get(id) || []), l]);
  for (const [id, lines] of byIngredient) {
    const distinct = Array.from(new Set(lines.map(l => l.index)));
    if (distinct.length < 2) continue;
    const c = drugById(id)!;
    const bothPrescribed = lines.filter(l => l.role === 'prescribed').length >= 2;
    emit(state, { alertId: 'DUP-INGREDIENT', tier: bothPrescribed ? 'STOP' : 'WARN', family: 'duplicate', evidence: 'established', itemA: c.inn, itemB: lines.map(l => l.raw).join(' + '), lineRefs: distinct,
      mechanism: `${c.inn} is in ${distinct.length} medicines on this list: the total dose adds up (overdose risk${id === 'paracetamol' ? ', liver injury' : ''}).`,
      clinicalAction: 'Keep one product containing it, or confirm the combined daily dose is within the maximum.', citation: C.ddi });
  }
  // Two anticoagulants
  const anticoag = active.filter(l => l.conceptIds.some(i => drugById(i)?.classes.some(k => ['vka', 'doac', 'heparin'].includes(k))));
  if (new Set(anticoag.flatMap(l => l.conceptIds.filter(i => drugById(i)?.classes.some(k => ['vka', 'doac', 'heparin'].includes(k))))).size >= 2) {
    emit(state, { alertId: 'DUP-ANTICOAGULANT', tier: 'STOP', family: 'duplicate', evidence: 'established', itemA: 'Anticoagulant', itemB: anticoag.map(l => l.raw).join(' + '), lineRefs: anticoag.map(l => l.index),
      mechanism: 'Two anticoagulants together: very high bleeding risk (except a planned bridging overlap).', clinicalAction: 'Keep one anticoagulant; document any planned overlap.', citation: C.ddi });
  }
  // Same therapeutic class in different lines.
  for (const cls of DUPLICATE_CLASSES) {
    const lines = active.filter(l => l.conceptIds.some(i => drugById(i)?.classes.includes(cls)));
    const ingredients = new Set(lines.flatMap(l => l.conceptIds.filter(i => drugById(i)?.classes.includes(cls))));
    if (lines.length >= 2 && ingredients.size >= 2) {
      emit(state, { alertId: `DUP-CLASS-${cls.toUpperCase()}`, tier: 'WARN', family: 'duplicate', evidence: 'established', itemA: cls.replace(/_/g, ' '), itemB: lines.map(l => l.raw).join(' + '), lineRefs: lines.map(l => l.index),
        mechanism: `Two drugs of the same class (${cls.replace(/_/g, ' ')}): more adverse effects without added benefit.`, clinicalAction: 'Keep one, unless the duplication is deliberate and documented.', citation: C.ddi });
    }
  }
}

// ── Drug–drug pairs and list-level combinations ─────────────────────────────
function ddiRules(state: Ctx) {
  const active = state.lines.filter(l => l.kind === 'allopathic' && !l.negated);
  for (let i = 0; i < active.length; i++) {
    for (let j = 0; j < active.length; j++) {
      if (i === j) continue;
      const A = active[i], B = active[j];
      for (const ai of A.conceptIds) for (const bi of B.conceptIds) {
        const a = drugById(ai)!, b = drugById(bi)!;
        if (!a || !b || a.id === b.id) continue;
        for (const r of DDI) {
          if (!matches(a, r.a) || !matches(b, r.b)) continue;
          if (r.id === 'DDI-QT-PAIR' && i > j) continue; // symmetric rule: once per pair
          const tier: Tier = r.stopIf?.(state.ctx) ? 'STOP' : r.tier;
          emit(state, { alertId: r.id, tier, family: 'ddi', evidence: r.evidence, itemA: a.inn, itemB: b.inn, lineRefs: [A.index, B.index], mechanism: r.mechanism, clinicalAction: r.action, citation: C.ddi });
        }
      }
    }
  }
  const has = (pred: (c: DrugConcept) => boolean) => active.filter(l => l.conceptIds.some(id => { const c = drugById(id); return !!c && pred(c); }));
  // "Triple whammy": RAAS blocker + diuretic + NSAID.
  const raas = has(c => c.classes.includes('acei') || c.classes.includes('arb'));
  const diur = has(c => c.classes.includes('loop_diuretic') || c.classes.includes('thiazide'));
  const nsaid = has(c => c.classes.includes('nsaid'));
  if (raas.length && diur.length && nsaid.length) {
    emit(state, { alertId: 'DDI-TRIPLE-WHAMMY', tier: 'STOP', family: 'ddi', evidence: 'established', itemA: 'ACE inhibitor/ARB + diuretic', itemB: nsaid.map(l => l.raw).join(', '), lineRefs: [...raas, ...diur, ...nsaid].map(l => l.index),
      mechanism: '"Triple whammy": RAAS blockade + diuretic volume loss + NSAID afferent vasoconstriction collapse glomerular filtration pressure — acute kidney injury.',
      clinicalAction: 'Do not add an NSAID; use paracetamol. If unavoidable, hold the diuretic and check creatinine within 3 days.', citation: 'Lapi et al., BMJ 2013; BNF' });
  }
  // Bleeding stack: an anticoagulant plus two or more other bleeding-risk agents.
  const anticoag = has(c => c.classes.includes('vka') || c.classes.includes('doac'));
  if (anticoag.length) {
    // Count agents, not lines: Guggulu in two formulations is one agent; an aspirin + clopidogrel tablet is two.
    const bleedingDrug = (c: DrugConcept) => c.classes.includes('antiplatelet') || c.classes.includes('nsaid') || c.classes.includes('ssri') || c.classes.includes('snri');
    const agents = new Set<string>();
    const others: typeof state.lines = [];
    for (const l of state.lines) {
      if (l.negated || anticoag.includes(l)) continue;
      const keys = l.kind === 'allopathic'
        ? l.conceptIds.filter(id => { const c = drugById(id); return !!c && bleedingDrug(c); })
        : l.ayush && !l.ayush.external && (l.ayush.flags.has('antiplatelet') || l.ayush.flags.has('guggulsterone'))
          ? (l.ayush.formulation ? [...constituentsWithFlag(l.ayush.formulation, 'antiplatelet'), ...constituentsWithFlag(l.ayush.formulation, 'guggulsterone')] : [l.ayush.name]).map(n => `herb:${n.toLowerCase()}`)
          : [];
      if (!keys.length) continue;
      keys.forEach(k => agents.add(k));
      others.push(l);
    }
    const distinct = others;
    if (agents.size >= 2) {
      emit(state, { alertId: 'DDI-BLEEDING-STACK', tier: 'STOP', family: 'ddi', evidence: 'probable', itemA: anticoag.map(l => l.raw).join(', '), itemB: distinct.map(l => l.raw).join(', '), lineRefs: [...anticoag, ...distinct].map(l => l.index),
        mechanism: 'Anticoagulant plus several other agents that impair haemostasis (antiplatelet, NSAID, SSRI, garlic/guggulu): cumulative hemorrhage (major bleeding) risk is high.',
        clinicalAction: 'Remove every agent that is not essential; add gastroprotection; check INR/blood count.', citation: C.ddi });
    }
  }
  // Sedative stack.
  const sedatives = [...has(c => !!c.sedating), ...state.lines.filter(l => l.kind !== 'allopathic' && !l.negated && l.ayush && !l.ayush.external && l.ayush.flags.has('sedative'))];
  if (new Set(sedatives.map(l => l.index)).size >= 3) {
    emit(state, { alertId: 'DDI-SEDATIVE-STACK', tier: 'WARN', family: 'ddi', evidence: 'probable', itemA: 'CNS depressants', itemB: sedatives.map(l => l.raw).join(', '), lineRefs: sedatives.map(l => l.index),
      mechanism: 'Three or more sedating medicines: drowsiness, falls, respiratory depression (greater in older adults).', clinicalAction: 'Reduce to the essential ones; warn about driving and falls.', citation: C.ddi });
  }
  // Serotonergic load.
  const sero = has(c => !!c.serotonergic);
  if (new Set(sero.map(l => l.index)).size >= 3) {
    emit(state, { alertId: 'DDI-SEROTONIN-LOAD', tier: 'WARN', family: 'ddi', evidence: 'probable', itemA: 'Serotonergic drugs', itemB: sero.map(l => l.raw).join(', '), lineRefs: sero.map(l => l.index),
      mechanism: 'Three or more serotonergic drugs: serotonin toxicity risk.', clinicalAction: 'Review necessity of each; warn about agitation, tremor, sweating, fever.', citation: C.ddi });
  }
}

// ── Herb–drug (Ayush flags) and diet ────────────────────────────────────────
interface HerbRule { id: string; flag: AyushFlag; drug: Sel; tier: Tier; evidence: Evidence; mechanism: string; action: string; stopIf?: (ctx: SafetyContext) => boolean }
const HERB_RULES: HerbRule[] = [
  { id: 'HD-ALCOHOL-DISULFIRAM', flag: 'alcohol', drug: { classes: ['disulfiram_like'] }, tier: 'STOP', evidence: 'probable', mechanism: 'Asava/Arishta contain self-generated alcohol (about 5–10%); with metronidazole/tinidazole/disulfiram this can cause a disulfiram-like reaction (flushing, vomiting, tachycardia).', action: 'Use a non-fermented form (kwatha, vati, churna) until 72 h after the course.' },
  { id: 'HD-ALCOHOL-CNS', flag: 'alcohol', drug: { classes: ['benzodiazepine', 'z_drug', 'opioid'] }, tier: 'WARN', evidence: 'probable', mechanism: 'Alcohol in Asava/Arishta adds to CNS depression.', action: 'Prefer a non-fermented form.' },
  { id: 'HD-GLYCYRRHIZIN-DIGOXIN', flag: 'glycyrrhizin', drug: { classes: ['cardiac_glycoside'] }, tier: 'STOP', evidence: 'probable', mechanism: 'Glycyrrhizin inhibits 11β-HSD2: pseudo-aldosteronism and potassium loss, which sensitises the heart to digoxin toxicity.', action: 'Avoid Yashtimadhu with digoxin; choose another formulation.' },
  { id: 'HD-GLYCYRRHIZIN-KLOSS', flag: 'glycyrrhizin', drug: { classes: ['loop_diuretic', 'thiazide', 'corticosteroid'] }, tier: 'WARN', evidence: 'probable', mechanism: 'Additive potassium loss (hypokalaemia).', action: 'Limit duration/dose of Yashtimadhu; check potassium.' },
  { id: 'HD-GLYCYRRHIZIN-BP', flag: 'glycyrrhizin', drug: { classes: ['acei', 'arb', 'ccb_dhp', 'beta_blocker', 'thiazide'] }, tier: 'WARN', evidence: 'probable', mechanism: 'Glycyrrhizin causes sodium and water retention and raises blood pressure, opposing antihypertensives.', action: 'Avoid prolonged Yashtimadhu in hypertension; monitor BP.' },
  { id: 'HD-GUGGULU-VKA', flag: 'guggulsterone', drug: { classes: ['vka'] }, tier: 'WARN', evidence: 'theoretical', mechanism: 'Guggulu may alter warfarin effect (case reports of INR change; antiplatelet activity).', action: 'If used, check INR within a week.' },
  { id: 'HD-GUGGULU-THYROID', flag: 'thyroid_active', drug: { classes: ['thyroid_hormone', 'antithyroid'] }, tier: 'WARN', evidence: 'theoretical', mechanism: 'Guggulu / Ashwagandha can raise thyroid hormone levels (animal and small human studies).', action: 'Check TSH 6–8 weeks after starting.' },
  { id: 'HD-PIPERINE-NTI', flag: 'piperine', drug: { ids: ['phenytoin', 'theophylline', 'propranolol'] }, tier: 'INFO', evidence: 'theoretical', mechanism: 'Piperine increases absorption of some drugs (phenytoin, theophylline, propranolol).', action: 'Monitor for toxicity / levels.' },
  { id: 'HD-AQUARETIC-LITHIUM', flag: 'aquaretic', drug: { classes: ['lithium'] }, tier: 'WARN', evidence: 'theoretical', mechanism: 'Diuretic herbs may reduce lithium clearance.', action: 'Check lithium level after starting.' },
  { id: 'HD-HYPOGLYCAEMIC', flag: 'hypoglycaemic', drug: { classes: ['insulin', 'sulfonylurea', 'biguanide', 'dpp4_inhibitor', 'sglt2_inhibitor', 'thiazolidinedione'] }, tier: 'WARN', evidence: 'probable', mechanism: 'Additive glucose lowering: hypoglycaemia risk, especially with insulin or sulfonylureas.', action: 'Warn about hypoglycaemia; check sugars in the first 2 weeks; adjust the antidiabetic if needed.' },
  { id: 'HD-SEDATIVE', flag: 'sedative', drug: { classes: ['benzodiazepine', 'z_drug', 'opioid', 'antihistamine_sedating', 'tca', 'antipsychotic'] }, tier: 'WARN', evidence: 'theoretical', mechanism: 'Additive sedation.', action: 'Warn about drowsiness; avoid driving.' },
  { id: 'HD-GARLIC-ANTICOAG', flag: 'antiplatelet', drug: { classes: ['vka', 'doac'] }, tier: 'WARN', evidence: 'theoretical', mechanism: 'Medicinal garlic inhibits platelet aggregation; added bleeding risk.', action: 'Avoid medicinal doses; dietary amounts are fine.' },
  { id: 'HD-RESERPINE-BP', flag: 'reserpine', drug: { classes: ['acei', 'arb', 'ccb_dhp', 'beta_blocker', 'thiazide', 'loop_diuretic', 'alpha_blocker'] }, tier: 'WARN', evidence: 'probable', mechanism: 'Sarpagandha (reserpine) adds to antihypertensive effect: hypotension, bradycardia.', action: 'Monitor BP; reduce one agent.' },
  { id: 'HD-RESERPINE-ANTIDEPRESSANT', flag: 'reserpine', drug: { classes: ['ssri', 'snri', 'tca', 'antiparkinson'] }, tier: 'WARN', evidence: 'probable', mechanism: 'Reserpine depletes monoamines: depression, and opposes levodopa.', action: 'Avoid Sarpagandha with antidepressants or levodopa.' },
  { id: 'HD-CALCIUM-CHELATION', flag: 'calcium', drug: { classes: ['fluoroquinolone', 'tetracycline', 'thyroid_hormone', 'iron'] }, tier: 'INFO', evidence: 'established', mechanism: 'Calcium (Praval/Mukta/Shankha/Kapardika) chelates or reduces absorption.', action: 'Space doses: antibiotic 2 h before or 6 h after; levothyroxine 4 h apart.' },
  { id: 'HD-POTASSIUM-RAAS', flag: 'potassium_salt', drug: { classes: ['acei', 'arb', 'k_sparing_diuretic', 'potassium_supplement'] }, tier: 'WARN', evidence: 'probable', mechanism: 'Kshara (potassium salts) plus potassium-retaining drugs: hyperkalaemia.', action: 'Check potassium; avoid if eGFR < 30.', stopIf: c => c.eGfr !== undefined && c.eGfr < 30 },
  { id: 'HD-IMMUNE', flag: 'immunomodulator', drug: { classes: ['immunosuppressant'] }, tier: 'WARN', evidence: 'theoretical', mechanism: 'Immunostimulant herbs (Guduchi, Ashwagandha) may oppose immunosuppression.', action: 'Avoid in transplant recipients; discuss with the treating specialist.' },
  { id: 'HD-CARDIAC-GLYCOSIDE', flag: 'cardiac_glycoside', drug: { classes: ['cardiac_glycoside'] }, tier: 'STOP', evidence: 'established', mechanism: 'Oleander (Karavira) glycosides add to digoxin: heart block, fatal arrhythmia.', action: 'Do not combine.' },
  { id: 'HD-SHANKHAPUSHPI-PHENYTOIN', flag: 'phenytoin_level', drug: { ids: ['phenytoin'] }, tier: 'WARN', evidence: 'theoretical', mechanism: 'Shankhapushpi reduced phenytoin levels with loss of seizure control (case reports, animal data).', action: 'Avoid, or monitor phenytoin levels.' }
];

function herbRules(state: Ctx) {
  const drugs = state.lines.filter(l => l.kind === 'allopathic' && !l.negated);
  // One alert per rule, drug and kind: the same herb in several formulations is one interaction to review, not several.
  const groups = new Map<string, { r: HerbRule; c: DrugConcept; d: typeof drugs[number]; herbs: typeof drugs; via: Set<string>; diet: boolean }>();
  for (const h of state.lines) {
    if (h.kind === 'allopathic' || h.negated || !h.ayush || h.ayush.external) continue;
    for (const r of HERB_RULES) {
      if (!h.ayush.flags.has(r.flag)) continue;
      for (const d of drugs) for (const id of d.conceptIds) {
        const c = drugById(id);
        if (!c || !matches(c, r.drug)) continue;
        const diet = h.kind === 'diet';
        const key = `${r.id}|${d.index}|${id}|${diet ? 'diet' : 'rx'}`;
        const g = groups.get(key) || { r, c, d, herbs: [], via: new Set<string>(), diet };
        g.herbs.push(h);
        if (h.ayush.formulation) constituentsWithFlag(h.ayush.formulation, r.flag).forEach(v => g.via.add(v));
        groups.set(key, g);
      }
    }
  }
  for (const { r, c, d, herbs, via, diet } of groups.values()) {
    const tier: Tier = diet ? (r.tier === 'STOP' ? 'WARN' : r.tier) : (r.stopIf?.(state.ctx) ? 'STOP' : r.tier);
    const names = herbs.map(h => h.ayush!.name).join(', ');
    emit(state, { alertId: r.id, tier, family: 'herb_drug', evidence: r.evidence, itemA: c.inn, itemB: `${names}${via.size ? ` (${Array.from(via).join(', ')})` : ''}${diet ? ' — diet advice' : ''}`, lineRefs: [d.index, ...herbs.map(h => h.index)],
      mechanism: r.mechanism, clinicalAction: diet ? `Diet advice conflicts with ${c.inn}: ${r.action}` : r.action, citation: C.herb });
  }
}

// ── Patient context: pregnancy, lactation, renal, children, older adults, conditions ──
function contextRules(state: Ctx) {
  const { ctx } = state;
  const female = String(ctx.gender || '').toLowerCase().startsWith('f');
  for (const line of state.lines) {
    if (line.negated) continue;
    if (line.kind === 'allopathic') {
      for (const id of line.conceptIds) {
        const c = drugById(id);
        if (!c) continue;
        // Pregnancy
        if (ctx.isPregnant && c.pregnancy) {
          const p = c.pregnancy;
          const notYet = p.fromWeek !== undefined && ctx.gestationalWeeks !== undefined && ctx.gestationalWeeks < p.fromWeek;
          const tier: Tier = notYet ? 'INFO' : p.level === 'contraindicated' ? 'STOP' : p.level === 'avoid' ? 'WARN' : 'INFO';
          emit(state, { alertId: `PREG-${c.id.toUpperCase()}`, tier, family: 'pregnancy', evidence: 'established', itemA: `Pregnancy${ctx.gestationalWeeks ? ` (${ctx.gestationalWeeks} wk)` : ''}`, itemB: c.inn, lineRefs: [line.index],
            mechanism: p.note, clinicalAction: p.level === 'contraindicated' ? 'Do not prescribe in pregnancy; choose a pregnancy-safe alternative.' : notYet ? `Fine now; avoid from ${p.fromWeek} weeks.` : 'Avoid unless the benefit clearly outweighs the risk; document the reason.', citation: C.pregnancy });
        } else if (!ctx.isPregnant && ctx.pregnancyStatus === 'unknown' && female && ctx.age !== undefined && ctx.age >= 12 && ctx.age <= 50 && c.pregnancy && c.pregnancy.level !== 'caution' && line.role === 'prescribed') {
          // Not answered / not sure is not "not pregnant".
          emit(state, { alertId: 'PREG-STATUS-UNKNOWN', tier: 'WARN', family: 'pregnancy', evidence: 'established', itemA: 'Pregnancy status not known', itemB: c.inn, lineRefs: [line.index],
            mechanism: `${c.inn}: ${c.pregnancy.note}`, clinicalAction: 'Ask whether she could be pregnant (and test if unsure) before prescribing.', citation: C.pregnancy });
        } else if (!ctx.isPregnant && female && ctx.age !== undefined && ctx.age >= 12 && ctx.age <= 50 && c.pregnancy?.level === 'contraindicated' && line.role === 'prescribed') {
          emit(state, { alertId: 'PREG-POTENTIAL', tier: 'INFO', family: 'pregnancy', evidence: 'established', itemA: 'Woman of child-bearing age', itemB: c.inn, lineRefs: [line.index],
            mechanism: `${c.inn} is contraindicated in pregnancy.`, clinicalAction: 'Confirm she is not pregnant and is using reliable contraception; counsel before prescribing.', citation: C.pregnancy });
        }
        if (ctx.isLactating && c.lactation) {
          emit(state, { alertId: `LACT-${c.id.toUpperCase()}`, tier: c.lactation.level === 'avoid' ? 'WARN' : 'INFO', family: 'lactation', evidence: 'established', itemA: 'Breastfeeding', itemB: c.inn, lineRefs: [line.index],
            mechanism: c.lactation.note, clinicalAction: 'Choose a breastfeeding-compatible alternative or monitor the infant.', citation: C.pregnancy });
        }
        // Renal
        if (ctx.eGfr !== undefined && c.renal) {
          const r = c.renal;
          if (r.avoidBelow !== undefined && ctx.eGfr < r.avoidBelow) {
            emit(state, { alertId: `RENAL-AVOID-${c.id.toUpperCase()}`, tier: 'STOP', family: 'renal', evidence: 'established', itemA: `eGFR ${ctx.eGfr} mL/min`, itemB: c.inn, lineRefs: [line.index], mechanism: r.note, clinicalAction: `Avoid at eGFR < ${r.avoidBelow}; choose an alternative.`, citation: C.renal });
          } else if (r.adjustBelow !== undefined && ctx.eGfr < r.adjustBelow) {
            emit(state, { alertId: `RENAL-ADJUST-${c.id.toUpperCase()}`, tier: 'WARN', family: 'renal', evidence: 'established', itemA: `eGFR ${ctx.eGfr} mL/min`, itemB: c.inn, lineRefs: [line.index], mechanism: r.note, clinicalAction: 'Adjust the dose for renal function.', citation: C.renal });
          }
        }
        // Children
        if (ctx.age !== undefined && c.paed?.minAgeYears !== undefined && ctx.age < c.paed.minAgeYears) {
          const soft = ['fluoroquinolone', 'tetracycline'].some(k => c.classes.includes(k as DrugClass)) || ['thiocolchicoside', 'albendazole', 'ibuprofen'].includes(c.id);
          emit(state, { alertId: `PAED-AGE-${c.id.toUpperCase()}`, tier: soft ? 'WARN' : 'STOP', family: 'paediatric', evidence: 'established', itemA: `Age ${formatAge(ctx.age)}`, itemB: c.inn, lineRefs: [line.index],
            mechanism: c.paed.minAgeNote || `Not recommended under ${c.paed.minAgeYears} years.`, clinicalAction: soft ? 'Use only if no suitable alternative; document why.' : 'Do not prescribe at this age; choose an age-appropriate alternative.', citation: C.paed });
        }
        // Older adults
        if (ctx.age !== undefined && ctx.age >= 65 && c.elderly) {
          emit(state, { alertId: `BEERS-${c.id.toUpperCase()}`, tier: c.elderly.level === 'avoid' ? 'WARN' : 'INFO', family: 'elderly', evidence: 'established', itemA: `Age ${ctx.age}`, itemB: c.inn, lineRefs: [line.index],
            mechanism: c.elderly.note, clinicalAction: c.elderly.level === 'avoid' ? 'Prefer a safer alternative for an older adult.' : 'Use with care; review the need regularly.', citation: C.elderly });
        }
      }
    } else if (line.ayush && !line.ayush.external) {
      const f = line.ayush.flags;
      const name = line.ayush.name;
      const via = (flag: AyushFlag) => line.ayush!.formulation ? constituentsWithFlag(line.ayush!.formulation, flag) : [];
      if (ctx.isPregnant) {
        if (f.has('uterotonic_strong')) emit(state, { alertId: 'PREG-AYUSH-GARBHAPATANA', tier: 'STOP', family: 'pregnancy', evidence: 'probable', itemA: 'Pregnancy (Garbhini)', itemB: `${name}${via('uterotonic_strong').length ? ` (${via('uterotonic_strong').join(', ')})` : ''}`, lineRefs: [line.index],
          mechanism: 'Contains drugs classically avoided in pregnancy for their garbhapatana (uterotonic / strong purgative) action.', clinicalAction: 'Avoid in pregnancy (Garbhini paricharya); choose a pregnancy-appropriate formulation.', citation: 'Charaka Samhita Sharirasthana 8; AFI' });
        if (f.has('schedule_e1') || f.has('mineral_heavy_metal')) emit(state, { alertId: 'PREG-AYUSH-MINERAL', tier: 'STOP', family: 'pregnancy', evidence: 'probable', itemA: 'Pregnancy', itemB: `${name}${via('mineral_heavy_metal').concat(via('schedule_e1')).length ? ` (${Array.from(new Set(via('mineral_heavy_metal').concat(via('schedule_e1')))).join(', ')})` : ''}`, lineRefs: [line.index],
          mechanism: 'Contains a Schedule E(1) or heavy-metal ingredient; fetal exposure to mercury, arsenic or lead must be avoided.', clinicalAction: 'Avoid in pregnancy.', citation: C.statutory });
        if (f.has('pregnancy_caution') && !f.has('uterotonic_strong')) emit(state, { alertId: 'PREG-AYUSH-CAUTION', tier: 'WARN', family: 'pregnancy', evidence: 'theoretical', itemA: 'Pregnancy', itemB: `${name}${via('pregnancy_caution').length ? ` (${via('pregnancy_caution').join(', ')})` : ''}`, lineRefs: [line.index],
          mechanism: 'Contains an ingredient used with caution in pregnancy (strong purgative, Hingu, Guggulu, Vacha in medicinal doses).', clinicalAction: 'Use only if needed, at the lowest dose and short duration.', citation: 'Classical Garbhini paricharya; AFI' });
        if (f.has('alcohol')) emit(state, { alertId: 'PREG-AYUSH-ALCOHOL', tier: 'WARN', family: 'pregnancy', evidence: 'probable', itemA: 'Pregnancy', itemB: name, lineRefs: [line.index],
          mechanism: 'Asava/Arishta contain self-generated alcohol.', clinicalAction: 'Prefer a non-fermented form in pregnancy.', citation: C.herb });
      }
      if (ctx.age !== undefined && ctx.age < 12) {
        if (f.has('schedule_e1') || f.has('mineral_heavy_metal')) emit(state, { alertId: 'PAED-AYUSH-MINERAL', tier: 'STOP', family: 'paediatric', evidence: 'probable', itemA: `Age ${formatAge(ctx.age)}`, itemB: name, lineRefs: [line.index],
          mechanism: 'Contains a Schedule E(1) or heavy-metal ingredient; children are most vulnerable to mercury, arsenic and lead.', clinicalAction: 'Choose a herbal paediatric formulation; mineral preparations only under specialist supervision.', citation: 'Kashyapa Samhita; AFI; Drugs & Cosmetics Rules Schedule E(1)' });
        if (f.has('alcohol')) emit(state, { alertId: 'PAED-AYUSH-ALCOHOL', tier: 'WARN', family: 'paediatric', evidence: 'probable', itemA: `Age ${formatAge(ctx.age)}`, itemB: name, lineRefs: [line.index],
          mechanism: 'Asava/Arishta contain self-generated alcohol.', clinicalAction: 'Prefer a non-fermented form for children.', citation: C.herb });
      }
      if (ctx.eGfr !== undefined && ctx.eGfr < 30 && f.has('mineral_heavy_metal')) emit(state, { alertId: 'RENAL-AYUSH-MINERAL', tier: 'STOP', family: 'renal', evidence: 'probable', itemA: `eGFR ${ctx.eGfr} mL/min`, itemB: name, lineRefs: [line.index],
        mechanism: 'Heavy-metal preparations are renally excreted and nephrotoxic when they accumulate.', clinicalAction: 'Avoid in severe kidney disease.', citation: C.herb });
      if (ctx.isLactating && (f.has('schedule_e1') || f.has('mineral_heavy_metal'))) emit(state, { alertId: 'LACT-AYUSH-MINERAL', tier: 'WARN', family: 'lactation', evidence: 'theoretical', itemA: 'Breastfeeding', itemB: name, lineRefs: [line.index],
        mechanism: 'Heavy metals pass into breast milk.', clinicalAction: 'Avoid while breastfeeding.', citation: C.herb });
    }
  }
}

const formatAge = (age: number) => age < 1 ? `${Math.round(age * 12)} months` : `${age} y`;

// Conditions on file (kiosk history / known conditions).
const CONDITION_LABEL: Record<string, string> = {
  asthma: 'Asthma / COPD', ckd: 'Chronic kidney disease', peptic: 'Peptic ulcer / GI bleed', heart_failure: 'Heart failure',
  liver: 'Liver disease', epilepsy: 'Epilepsy', bph: 'Prostatic enlargement / retention', glaucoma: 'Glaucoma',
  myasthenia: 'Myasthenia gravis', g6pd: 'G6PD deficiency', long_qt: 'Long QT', bleeding: 'Bleeding disorder',
  hypertension: 'Hypertension', diabetes: 'Diabetes', migraine_aura: 'Migraine with aura'
};

const CONDITIONS: Array<{ key: string; re: RegExp }> = [
  { key: 'asthma', re: /asthma|copd|wheez|bronchospas|tamaka|shwasa/i },
  { key: 'ckd', re: /\bckd\b|kidney disease|renal (failure|disease|impairment)|dialysis/i },
  { key: 'peptic', re: /peptic|ulcer|gi bleed|gastrointestinal bleed|melena|malena|haematemesis|hematemesis/i },
  { key: 'heart_failure', re: /heart failure|\bccf\b|\bchf\b|cardiac failure|\bhf\b/i },
  { key: 'liver', re: /cirrhosis|hepatitis|liver disease|fatty liver|hepatic/i },
  { key: 'epilepsy', re: /epilep|seizure|fits|convulsion|apasmara/i },
  { key: 'bph', re: /\bbph\b|prostat|urinary retention/i },
  { key: 'glaucoma', re: /glaucoma/i },
  { key: 'myasthenia', re: /myasthenia/i },
  { key: 'g6pd', re: /g6pd/i },
  { key: 'long_qt', re: /long qt|qt prolong/i },
  { key: 'bleeding', re: /haemophilia|hemophilia|bleeding disorder|von willebrand/i },
  { key: 'hypertension', re: /hypertension|high (bp|blood pressure)|\bhtn\b|raktachapa/i },
  { key: 'diabetes', re: /diabet|\bsugar\b|madhumeha|prameha|\bdm\b/i },
  { key: 'migraine_aura', re: /migraine with aura/i }
];

interface DiseaseRule { id: string; cond: string; drug: Sel; tier: Tier; mechanism: string; action: string }
const DISEASE_RULES: DiseaseRule[] = [
  { id: 'DIS-ASTHMA-NSBB', cond: 'asthma', drug: { classes: ['beta_blocker_nonselective'] }, tier: 'STOP', mechanism: 'Non-selective β-blockers can cause fatal bronchospasm in asthma/COPD.', action: 'Avoid; if a β-blocker is essential, use a cardioselective one at low dose.' },
  { id: 'DIS-ASTHMA-BB', cond: 'asthma', drug: { classes: ['beta_blocker'] }, tier: 'WARN', mechanism: 'Even cardioselective β-blockers may worsen bronchospasm.', action: 'Use the lowest dose of a cardioselective agent; monitor.' },
  { id: 'DIS-ASTHMA-NSAID', cond: 'asthma', drug: { classes: ['nsaid'], ids: ['aspirin'] }, tier: 'INFO', mechanism: 'NSAIDs can trigger bronchospasm in aspirin-exacerbated respiratory disease.', action: 'Ask about prior NSAID reactions.' },
  { id: 'DIS-PEPTIC-NSAID', cond: 'peptic', drug: { classes: ['nsaid'] }, tier: 'WARN', mechanism: 'NSAIDs in peptic ulcer / prior GI bleed: re-bleeding risk.', action: 'Avoid; if essential, use a PPI and the lowest dose.' },
  { id: 'DIS-HF-NSAID', cond: 'heart_failure', drug: { classes: ['nsaid'] }, tier: 'WARN', mechanism: 'NSAIDs cause fluid retention and worsen heart failure.', action: 'Avoid; use paracetamol.' },
  { id: 'DIS-HF-TZD', cond: 'heart_failure', drug: { classes: ['thiazolidinedione'] }, tier: 'STOP', mechanism: 'Pioglitazone causes fluid retention; contraindicated in heart failure.', action: 'Do not use; choose another antidiabetic.' },
  { id: 'DIS-HF-NONDHP', cond: 'heart_failure', drug: { classes: ['ccb_nondhp'] }, tier: 'WARN', mechanism: 'Diltiazem/verapamil are negatively inotropic (worse in reduced EF).', action: 'Avoid in HFrEF.' },
  { id: 'DIS-LIVER-HEPATOTOXIC', cond: 'liver', drug: {}, tier: 'WARN', mechanism: 'Hepatotoxic medicine in a patient with liver disease.', action: 'Reduce dose or choose an alternative; monitor liver tests.' },
  { id: 'DIS-LIVER-METFORMIN', cond: 'liver', drug: { classes: ['biguanide'] }, tier: 'WARN', mechanism: 'Liver disease raises lactic acidosis risk with metformin.', action: 'Avoid in decompensated liver disease.' },
  { id: 'DIS-EPILEPSY-THRESHOLD', cond: 'epilepsy', drug: { ids: ['tramadol', 'tapentadol'], classes: ['fluoroquinolone'] }, tier: 'WARN', mechanism: 'Lowers the seizure threshold.', action: 'Choose an alternative where possible.' },
  { id: 'DIS-MG-FQ', cond: 'myasthenia', drug: { classes: ['fluoroquinolone', 'macrolide', 'aminoglycoside'] }, tier: 'STOP', mechanism: 'Can precipitate a myasthenic crisis (FDA boxed warning for fluoroquinolones).', action: 'Avoid; choose another antibiotic.' },
  { id: 'DIS-BPH-ANTICHOLINERGIC', cond: 'bph', drug: { classes: ['antihistamine_sedating', 'tca', 'antispasmodic', 'antimuscarinic_urological', 'decongestant'] }, tier: 'WARN', mechanism: 'Anticholinergic / sympathomimetic drugs can cause urinary retention in BPH.', action: 'Avoid; choose a non-sedating antihistamine.' },
  { id: 'DIS-GLAUCOMA-ANTICHOLINERGIC', cond: 'glaucoma', drug: { classes: ['antihistamine_sedating', 'tca', 'antispasmodic', 'antimuscarinic_urological'] }, tier: 'WARN', mechanism: 'Anticholinergics can precipitate angle-closure glaucoma.', action: 'Check glaucoma type; avoid in angle-closure.' },
  { id: 'DIS-G6PD-PRIMAQUINE', cond: 'g6pd', drug: { ids: ['primaquine'] }, tier: 'STOP', mechanism: 'Severe haemolysis in G6PD deficiency.', action: 'Do not give standard-dose primaquine; specialist advice.' },
  { id: 'DIS-G6PD-OXIDANT', cond: 'g6pd', drug: { ids: ['nitrofurantoin', 'cotrimoxazole'] }, tier: 'WARN', mechanism: 'Oxidant drugs can cause haemolysis in G6PD deficiency.', action: 'Prefer an alternative; watch for dark urine / jaundice.' },
  { id: 'DIS-LONGQT', cond: 'long_qt', drug: { qt: true }, tier: 'STOP', mechanism: 'QT-prolonging drug in a patient with known QT prolongation.', action: 'Choose a non-QT-prolonging alternative.' },
  { id: 'DIS-BLEEDING', cond: 'bleeding', drug: { classes: ['vka', 'doac', 'antiplatelet', 'nsaid'] }, tier: 'STOP', mechanism: 'Antithrombotic / NSAID in a bleeding disorder.', action: 'Avoid unless specialist-directed.' },
  { id: 'DIS-HTN-DECONGESTANT', cond: 'hypertension', drug: { classes: ['decongestant'] }, tier: 'WARN', mechanism: 'Sympathomimetic decongestants raise blood pressure.', action: 'Use saline / steam instead.' },
  { id: 'DIS-DM-STEROID', cond: 'diabetes', drug: { classes: ['corticosteroid'] }, tier: 'INFO', mechanism: 'Corticosteroids raise blood glucose.', action: 'Monitor sugars during the course.' },
  { id: 'DIS-MIGRAINE-COC', cond: 'migraine_aura', drug: { classes: ['combined_oral_contraceptive'] }, tier: 'STOP', mechanism: 'Combined pills in migraine with aura raise ischaemic stroke risk (WHO MEC category 4).', action: 'Use a progestogen-only or non-hormonal method.' }
];

function diseaseRules(state: Ctx) {
  const text = (state.ctx.conditions || []).join(' ; ');
  if (!text.trim()) return;
  const present = new Set(CONDITIONS.filter(c => c.re.test(text)).map(c => c.key));
  if (state.ctx.isDiabetic) present.add('diabetes');
  if (!present.size) return;
  for (const line of state.lines) {
    if (line.negated) continue;
    if (line.kind === 'allopathic') {
      for (const id of line.conceptIds) {
        const c = drugById(id);
        if (!c) continue;
        for (const r of DISEASE_RULES) {
          if (!present.has(r.cond)) continue;
          const hit = r.id === 'DIS-LIVER-HEPATOTOXIC' ? !!c.hepatotoxic : matches(c, r.drug);
          if (!hit) continue;
          if (r.id === 'DIS-ASTHMA-BB' && c.classes.includes('beta_blocker_nonselective')) continue;
          emit(state, { alertId: r.id, tier: r.tier, family: 'disease', evidence: 'established', itemA: `${CONDITION_LABEL[r.cond] || r.cond.replace(/_/g, ' ')} (known)`, itemB: c.inn, lineRefs: [line.index], mechanism: r.mechanism, clinicalAction: r.action, citation: C.ddi });
        }
      }
    } else if (line.ayush && !line.ayush.external && line.ayush.flags.has('glycyrrhizin') && present.has('hypertension')) {
      emit(state, { alertId: 'DIS-HTN-GLYCYRRHIZIN', tier: 'WARN', family: 'disease', evidence: 'probable', itemA: 'Hypertension (known)', itemB: line.ayush.name, lineRefs: [line.index],
        mechanism: 'Glycyrrhizin (Yashtimadhu) raises blood pressure with prolonged use.', clinicalAction: 'Short courses only; monitor BP.', citation: C.herb });
    }
  }
}

// ── Doses ───────────────────────────────────────────────────────────────────
function doseRules(state: Ctx) {
  const { ctx } = state;
  const child = ctx.age !== undefined && ctx.age < 12;
  let weightNeeded = false;
  for (const line of state.lines) {
    if (line.negated || line.kind !== 'allopathic' || line.role !== 'prescribed') continue;
    if (line.conceptIds.length !== 1) continue; // combination products: per-component doses are not on the line
    const c = drugById(line.conceptIds[0]);
    if (!c) continue;
    const strength = line.components[0]?.strengthMg;
    const daily = dailyDoseMg(line.dosage, line.frequency, strength);
    if (c.highAlert && !line.dosage && !strength) {
      emit(state, { alertId: 'DOSE-HIGH-ALERT-MISSING', tier: 'WARN', family: 'dose', evidence: 'established', itemA: c.inn, itemB: 'Dose not stated', lineRefs: [line.index],
        mechanism: `${c.inn} is a high-alert medicine (narrow margin between benefit and harm).`, clinicalAction: 'Write the exact dose and frequency.', citation: 'ISMP high-alert medication list' });
    }
    if (child && c.paed && (c.paed.mgPerKgDay || c.paed.mgPerKgDose)) {
      if (!ctx.weightKg) { weightNeeded = true; continue; }
      if (daily !== undefined && c.paed.mgPerKgDay) {
        const perKg = daily / ctx.weightKg;
        const ceiling = Math.min(c.paed.mgPerKgDay * ctx.weightKg, c.paed.maxMgDay ?? Infinity);
        if (daily > ceiling * 1.05) {
          const ratio = daily / ceiling;
          emit(state, { alertId: 'DOSE-PAED-DAILY', tier: ratio >= 1.25 ? 'STOP' : 'WARN', family: 'dose', evidence: 'established', itemA: `${ctx.weightKg} kg child`, itemB: `${c.inn} ${Math.round(daily)} mg/day`, lineRefs: [line.index],
            mechanism: `${Math.round(perKg * 10) / 10} mg/kg/day is ${Math.round(ratio * 10) / 10}× the maximum (${c.paed.mgPerKgDay} mg/kg/day${c.paed.maxMgDay ? `, cap ${c.paed.maxMgDay} mg` : ''}).`,
            clinicalAction: `Maximum for ${ctx.weightKg} kg: ${Math.round(ceiling)} mg/day${c.paed.mgPerKgDose ? `; single dose up to ${Math.round(c.paed.mgPerKgDose * ctx.weightKg * 10) / 10} mg` : ''}.`, citation: C.paed });
        }
      }
      const single = parseDose(line.dosage).mg ?? (parseDose(line.dosage).units && strength ? parseDose(line.dosage).units! * strength : undefined);
      if (single !== undefined && c.paed.mgPerKgDose && single > c.paed.mgPerKgDose * ctx.weightKg * 1.25) {
        emit(state, { alertId: 'DOSE-PAED-SINGLE', tier: 'WARN', family: 'dose', evidence: 'established', itemA: `${ctx.weightKg} kg child`, itemB: `${c.inn} ${single} mg per dose`, lineRefs: [line.index],
          mechanism: `Single dose ${Math.round((single / ctx.weightKg) * 10) / 10} mg/kg exceeds ${c.paed.mgPerKgDose} mg/kg.`, clinicalAction: `Usual single dose: up to ${Math.round(c.paed.mgPerKgDose * ctx.weightKg * 10) / 10} mg.`, citation: C.paed });
      }
      continue;
    }
    if (daily !== undefined && c.maxDailyMg && daily > c.maxDailyMg * 1.001) {
      const ratio = daily / c.maxDailyMg;
      emit(state, { alertId: 'DOSE-ADULT-MAX', tier: ratio >= 1.5 ? 'STOP' : 'WARN', family: 'dose', evidence: 'established', itemA: c.inn, itemB: `${Math.round(daily)} mg/day`, lineRefs: [line.index],
        mechanism: `The prescribed ${Math.round(daily)} mg/day is above the usual adult maximum of ${c.maxDailyMg} mg/day.`, clinicalAction: 'Check the dose and frequency.', citation: 'Product labels; BNF' });
    }
    if (c.id === 'digoxin' && ctx.age !== undefined && ctx.age >= 65 && daily !== undefined && daily > 0.125 + 1e-6) {
      emit(state, { alertId: 'BEERS-DIGOXIN-DOSE', tier: 'WARN', family: 'elderly', evidence: 'established', itemA: `Age ${ctx.age}`, itemB: `Digoxin ${daily} mg/day`, lineRefs: [line.index],
        mechanism: 'Beers 2023: avoid digoxin doses above 0.125 mg/day in older adults (toxicity with reduced clearance).', clinicalAction: 'Use 0.0625–0.125 mg/day and check levels.', citation: C.elderly });
    }
  }
  if (weightNeeded) {
    emit(state, { alertId: 'DOSE-PAED-WEIGHT-MISSING', tier: 'WARN', family: 'dose', evidence: 'established', itemA: `Age ${formatAge(ctx.age!)}`, itemB: 'Weight not recorded', lineRefs: [],
      mechanism: 'Children’s doses are calculated per kilogram; without a weight the dose cannot be checked.', clinicalAction: 'Record the child’s weight before signing.', citation: C.paed });
  }
}

// ── Banned FDCs, statutory and stewardship ──────────────────────────────────
function regulatoryRules(state: Ctx) {
  for (const line of state.lines) {
    if (line.negated) continue;
    if (line.kind === 'allopathic') {
      if (line.components.length >= 2) {
        const match = findBannedFdc(line.components.map(c => c.normalised), line.components.map(c => c.strengthMg));
        if (match) {
          emit(state, { alertId: 'FDC-BANNED', tier: match.certainty === 'exact' ? 'STOP' : 'WARN', family: 'banned_fdc', evidence: 'statutory', itemA: line.raw, itemB: match.entry.notification, lineRefs: [line.index],
            mechanism: match.certainty === 'exact'
              ? `${match.entry.label}${match.entry.form ? ` (${match.entry.form})` : ''} is prohibited for human use under Section 26A of the Drugs and Cosmetics Act (${match.entry.notification}).`
              : `${match.entry.label} is prohibited at ${match.entry.strengthsMg?.join(' + ')} mg (${match.entry.notification}); the strength of this product is not stated.`,
            clinicalAction: match.certainty === 'exact' ? 'Do not prescribe. Prescribe the single ingredients that are actually needed.' : 'Confirm the strength; if it is the prohibited one, prescribe single ingredients instead.',
            citation: 'Drugs and Cosmetics Act 1940, Section 26A; CDSCO gazette notifications' });
        }
      }
      for (const id of line.conceptIds) {
        const c = drugById(id);
        if (!c) continue;
        if (c.aware && line.role === 'prescribed') {
          const tier: Tier = !line.indication ? 'WARN' : c.aware === 'ACCESS' ? 'INFO' : 'INFO';
          emit(state, { alertId: !line.indication ? 'ABX-INDICATION-MISSING' : `ABX-AWARE-${c.aware}`, tier, family: 'stewardship', evidence: 'statutory', itemA: c.inn, itemB: !line.indication ? `indication not recorded (AWaRe ${c.aware})` : `AWaRe ${c.aware}`, lineRefs: [line.index],
            mechanism: !line.indication ? `Antibiotic without a recorded indication. ${c.inn} is in the WHO ${c.aware} group.` : `${c.inn} is a WHO ${c.aware} antibiotic${c.aware !== 'ACCESS' ? ' — keep for indications where Access antibiotics are not suitable' : ''}.`,
            clinicalAction: !line.indication ? 'Record why the antibiotic is given (MoHFW advisory, 2024).' : c.aware === 'ACCESS' ? 'Access group: first choice for common infections.' : 'Confirm that an Access antibiotic would not do.', citation: C.aware });
        }
        if ((c.ndps || c.schedule === 'X') && state.ctx.teleconsult) {
          emit(state, { alertId: 'TELE-PROHIBITED', tier: 'STOP', family: 'statutory', evidence: 'statutory', itemA: c.inn, itemB: 'Teleconsultation', lineRefs: [line.index],
            mechanism: 'Schedule X and NDPS-listed medicines may not be prescribed through telemedicine (Telemedicine Practice Guidelines 2020, prohibited list).', clinicalAction: 'Prescribe only after an in-person consultation.', citation: C.statutory });
        }
      }
    } else if (line.ayush && line.ayush.flags.has('schedule_e1') && !line.ayush.external) {
      const via = line.ayush.formulation ? constituentsWithFlag(line.ayush.formulation, 'schedule_e1') : [];
      emit(state, { alertId: 'E1-LABEL', tier: 'INFO', family: 'statutory', evidence: 'statutory', itemA: line.ayush.name, itemB: `Schedule E(1)${via.length ? `: ${via.join(', ')}` : ''}`, lineRefs: [line.index],
        mechanism: `Contains Schedule E(1) ingredient(s)${via.length ? ` (${via.join(', ')})` : ''}: "Caution: to be taken under medical supervision"; dispensed only against this prescription.`,
        clinicalAction: 'State dose and duration exactly; avoid in pregnancy, children and severe kidney disease.', citation: C.statutory, severity: 'STATUTORY_SCHEDULE_E1' });
    } else if (line.ayush && !line.ayush.compositionKnown && /\b(ras|rasa|bhasma|sindura|sindoor|parpati|pishti)\b/i.test(line.ayush.name) && !line.ayush.external) {
      emit(state, { alertId: 'AYUSH-COMPOSITION-UNKNOWN', tier: 'INFO', family: 'statutory', evidence: 'statutory', itemA: line.ayush.name, itemB: 'Composition not in the safety database', lineRefs: [line.index],
        mechanism: 'A Rasaushadhi / Bhasma whose ingredients are not in the database: mineral and Schedule E(1) content could not be checked.', clinicalAction: 'Check the label for Parada, Hingula, Vatsanabha or other Schedule E(1) ingredients.', citation: C.statutory });
    }
  }
}

// ── Public API ──────────────────────────────────────────────────────────────
export interface SafetyCoverage {
  linesChecked: number;
  unresolved: Array<{ line: number; name: string }>;
  contextUsed: string[];
  contextMissing: string[];
  reviewStatus: string;
}

export function evaluateSafety(lines: ResolvedLine[], ctx: SafetyContext = {}): { alerts: SafetyAlert[]; coverage: SafetyCoverage } {
  const state: Ctx = { lines, alerts: [], ctx };
  allergyRules(state);
  duplicateRules(state);
  ddiRules(state);
  herbRules(state);
  contextRules(state);
  diseaseRules(state);
  doseRules(state);
  regulatoryRules(state);

  const contextUsed: string[] = [];
  const contextMissing: string[] = [];
  if (ctx.age !== undefined) contextUsed.push(`age ${formatAge(ctx.age)}`); else contextMissing.push('age');
  const childBearing = String(ctx.gender || '').toLowerCase().startsWith('f') && ctx.age !== undefined && ctx.age >= 12 && ctx.age <= 50;
  if (ctx.isPregnant) contextUsed.push(`pregnant${ctx.gestationalWeeks ? ` ${ctx.gestationalWeeks} wk` : ''}`);
  else if (ctx.pregnancyStatus === 'unknown' && childBearing) contextMissing.push('pregnancy status');
  else if (childBearing) contextUsed.push('not pregnant');
  if (ctx.isLactating) contextUsed.push('breastfeeding');
  if (ctx.eGfr !== undefined) contextUsed.push(`eGFR ${ctx.eGfr}`); else contextMissing.push('kidney function');
  if (ctx.weightKg) contextUsed.push(`${ctx.weightKg} kg`); else if (ctx.age !== undefined && ctx.age < 12) contextMissing.push('weight');
  const realAllergies = (ctx.allergies || []).filter(a => a?.agent && !NO_ALLERGY.test(a.agent.trim()));
  if (ctx.allergies) contextUsed.push(realAllergies.length ? `allergies: ${realAllergies.map(a => a.agent).join(', ')}` : 'no known allergies'); else contextMissing.push('allergy history');
  if (ctx.conditions?.length) contextUsed.push(`conditions: ${ctx.conditions.slice(0, 4).join(', ')}`);

  const unresolved = lines.filter(l => !l.negated && l.unresolved.length && l.kind !== 'diet').flatMap(l => l.unresolved.map(name => ({ line: l.index, name })));
  return {
    alerts: state.alerts,
    coverage: { linesChecked: lines.filter(l => !l.negated && l.kind !== 'diet').length, unresolved, contextUsed, contextMissing, reviewStatus: REVIEW_STATUS }
  };
}
