/**
 * Drug dictionary for prescription safety: the medicines an Indian OPD prescribes, by generic
 * (INN) name, with their class, statutory schedule and the patient-context facts the rules need.
 *
 * Content was curated from standard references (WHO ATC index, WHO AWaRe 2023, Drugs & Cosmetics
 * Rules Schedules H/H1, NDPS Act schedules, product labels, BNF-style renal and pregnancy guidance,
 * AGS Beers Criteria 2023). It is decision support and must be reviewed by the hospital's drug
 * and therapeutics committee before go-live; `REVIEW_STATUS` says so on every response.
 *
 * Brand names map to the generic so the engine sees the ingredient, never the brand.
 */

export type DrugClass =
  | 'penicillin' | 'cephalosporin' | 'carbapenem' | 'macrolide' | 'fluoroquinolone' | 'tetracycline' | 'aminoglycoside'
  | 'sulfonamide_antibiotic' | 'nitroimidazole' | 'nitrofuran' | 'lincosamide' | 'oxazolidinone' | 'azole_antifungal'
  | 'antitubercular' | 'antimalarial' | 'anthelmintic' | 'antiviral'
  | 'nsaid' | 'cox2_inhibitor' | 'analgesic_simple' | 'opioid'
  | 'ssri' | 'snri' | 'tca' | 'maoi' | 'antidepressant_other' | 'benzodiazepine' | 'z_drug' | 'antipsychotic' | 'antiepileptic' | 'lithium'
  | 'acei' | 'arb' | 'ccb_dhp' | 'ccb_nondhp' | 'beta_blocker' | 'beta_blocker_nonselective' | 'thiazide' | 'loop_diuretic' | 'k_sparing_diuretic'
  | 'nitrate' | 'pde5_inhibitor' | 'cardiac_glycoside' | 'antiarrhythmic' | 'alpha_blocker' | 'central_antihypertensive' | 'vasodilator'
  | 'vka' | 'doac' | 'heparin' | 'antiplatelet'
  | 'statin' | 'fibrate' | 'lipid_other'
  | 'biguanide' | 'sulfonylurea' | 'dpp4_inhibitor' | 'sglt2_inhibitor' | 'thiazolidinedione' | 'insulin' | 'alpha_glucosidase_inhibitor'
  | 'ppi' | 'h2_blocker' | 'antiemetic_d2' | 'antiemetic_5ht3' | 'antispasmodic' | 'antidiarrhoeal' | 'laxative' | 'antacid' | 'mucosal_protectant'
  | 'saba' | 'laba' | 'inhaled_corticosteroid' | 'leukotriene_antagonist' | 'methylxanthine' | 'antihistamine_sedating' | 'antihistamine_nonsedating'
  | 'mucolytic' | 'antitussive' | 'decongestant'
  | 'thyroid_hormone' | 'antithyroid' | 'corticosteroid'
  | 'muscle_relaxant' | 'xanthine_oxidase_inhibitor' | 'antigout'
  | 'calcium' | 'vitamin_d' | 'iron' | 'folate' | 'vitamin_b12' | 'potassium_supplement'
  | 'alpha_blocker_urological' | 'five_ari' | 'antimuscarinic_urological'
  | 'combined_oral_contraceptive' | 'progestogen' | 'uterotonic' | 'ovulation_inducer' | 'antifibrinolytic'
  | 'antimetabolite' | 'immunosuppressant' | 'retinoid' | 'antivertigo' | 'antimigraine' | 'antiparkinson' | 'antidementia' | 'disulfiram_like'
  | 'vaccine' | 'immunoglobulin';

export interface DrugConcept {
  id: string;
  inn: string;
  atc: string;
  classes: DrugClass[];
  /** Lower-case alternative generic spellings and common Indian brands (whole-name matches). */
  synonyms?: string[];
  /** Fixed-dose combination: the component concept ids (the FDC itself has no classes). */
  ingredients?: string[];
  /** Usual strengths of the branded combination, in ingredient order (for banned-strength checks). */
  fdcStrengthsMg?: number[];
  aware?: 'ACCESS' | 'WATCH' | 'RESERVE';
  schedule?: 'H' | 'H1' | 'X';
  ndps?: boolean;
  nlem?: boolean;
  highAlert?: boolean;
  pregnancy?: { level: 'contraindicated' | 'avoid' | 'caution'; note: string; fromWeek?: number };
  lactation?: { level: 'avoid' | 'caution'; note: string };
  renal?: { avoidBelow?: number; adjustBelow?: number; note: string };
  paed?: { minAgeYears?: number; minAgeNote?: string; mgPerKgDose?: number; mgPerKgDay?: number; maxMgDay?: number };
  elderly?: { level: 'avoid' | 'caution'; note: string };
  maxDailyMg?: number;
  qt?: boolean;
  serotonergic?: boolean;
  sedating?: boolean;
  cyp3a4?: 'strong_inhibitor' | 'moderate_inhibitor' | 'strong_inducer';
  hepatotoxic?: boolean;
}

export const REVIEW_STATUS = 'Curated decision-support content; requires review by the hospital Drugs & Therapeutics Committee.';

const D = (id: string, inn: string, atc: string, classes: DrugClass[], extra: Omit<DrugConcept, 'id' | 'inn' | 'atc' | 'classes'> = {}): DrugConcept =>
  ({ id, inn, atc, classes, ...extra });
const FDC = (id: string, inn: string, ingredients: string[], synonyms: string[] = [], extra: Partial<DrugConcept> = {}): DrugConcept =>
  ({ id, inn, atc: '', classes: [], ingredients, synonyms, ...extra });

// Shared notes
const NSAID_PREG = { level: 'avoid' as const, note: 'Avoid NSAIDs from 20 weeks (fetal renal dysfunction, oligohydramnios) and especially in the third trimester (premature ductus closure).', fromWeek: 20 };
const NSAID_RENAL = { avoidBelow: 30, adjustBelow: 60, note: 'NSAIDs reduce renal perfusion; avoid if eGFR < 30, use lowest dose for shortest time if eGFR 30–60.' };
const NSAID_ELDERLY = { level: 'caution' as const, note: 'Beers 2023: avoid chronic use unless alternatives fail and a gastroprotective agent is given (GI bleeding, renal injury).' };
const RAAS_PREG = { level: 'contraindicated' as const, note: 'Fetotoxic in the 2nd and 3rd trimesters (renal failure, oligohydramnios, skull hypoplasia); stop when pregnancy is recognised.' };
const STATIN_PREG = { level: 'contraindicated' as const, note: 'Contraindicated in pregnancy (cholesterol synthesis needed for fetal development); stop before conception.' };
const BZD_ELDERLY = { level: 'avoid' as const, note: 'Beers 2023: avoid — cognitive impairment, delirium, falls, fractures.' };
const SEDATING_AH_ELDERLY = { level: 'avoid' as const, note: 'Beers 2023: strongly anticholinergic — confusion, constipation, urinary retention.' };
const FQ_PAED = { minAgeYears: 18, minAgeNote: 'Fluoroquinolones are avoided under 18 years (arthropathy, tendon injury) unless no alternative.' };
const TETRA_PAED = { minAgeYears: 8, minAgeNote: 'Tetracyclines stain developing teeth; avoid under 8 years (short doxycycline courses only for specific indications).' };

export const DRUG_CONCEPTS: DrugConcept[] = [
  // ── Analgesics, antipyretics, NSAIDs ──────────────────────────────────────
  D('paracetamol', 'Paracetamol', 'N02BE01', ['analgesic_simple'], { synonyms: ['acetaminophen', 'dolo', 'dolo 650', 'calpol', 'crocin', 'pacimol', 'p-650', 'metacin', 'fepanil', 'sumo l'], nlem: true, maxDailyMg: 4000, paed: { mgPerKgDose: 15, mgPerKgDay: 60, maxMgDay: 4000 }, hepatotoxic: true }),
  D('ibuprofen', 'Ibuprofen', 'M01AE01', ['nsaid'], { synonyms: ['brufen', 'ibugesic'], nlem: true, maxDailyMg: 2400, pregnancy: NSAID_PREG, renal: NSAID_RENAL, elderly: NSAID_ELDERLY, paed: { minAgeYears: 0.25, minAgeNote: 'Not under 3 months.', mgPerKgDose: 10, mgPerKgDay: 40, maxMgDay: 2400 } }),
  D('diclofenac', 'Diclofenac', 'M01AB05', ['nsaid'], { synonyms: ['voveran', 'dynapar', 'reactin'], nlem: true, maxDailyMg: 150, pregnancy: NSAID_PREG, renal: NSAID_RENAL, elderly: NSAID_ELDERLY }),
  D('aceclofenac', 'Aceclofenac', 'M01AB16', ['nsaid'], { synonyms: ['zerodol', 'hifenac', 'acenac'], maxDailyMg: 200, pregnancy: NSAID_PREG, renal: NSAID_RENAL, elderly: NSAID_ELDERLY }),
  D('naproxen', 'Naproxen', 'M01AE02', ['nsaid'], { synonyms: ['naprosyn', 'naxdom'], maxDailyMg: 1250, pregnancy: NSAID_PREG, renal: NSAID_RENAL, elderly: NSAID_ELDERLY }),
  D('mefenamic_acid', 'Mefenamic acid', 'M01AG01', ['nsaid'], { synonyms: ['meftal', 'ponstan'], maxDailyMg: 1500, pregnancy: NSAID_PREG, renal: NSAID_RENAL, elderly: NSAID_ELDERLY }),
  D('etoricoxib', 'Etoricoxib', 'M01AH05', ['nsaid', 'cox2_inhibitor'], { synonyms: ['etoshine', 'nucoxia', 'arcoxia'], maxDailyMg: 120, pregnancy: NSAID_PREG, renal: NSAID_RENAL, elderly: NSAID_ELDERLY }),
  D('celecoxib', 'Celecoxib', 'M01AH01', ['nsaid', 'cox2_inhibitor'], { synonyms: ['celebrex'], maxDailyMg: 400, pregnancy: NSAID_PREG, renal: NSAID_RENAL, elderly: NSAID_ELDERLY }),
  D('ketorolac', 'Ketorolac', 'M01AB15', ['nsaid'], { synonyms: ['ketorol', 'toradol'], maxDailyMg: 40, pregnancy: NSAID_PREG, renal: { avoidBelow: 50, note: 'Ketorolac is contraindicated in moderate–severe renal impairment.' }, elderly: { level: 'avoid', note: 'Beers 2023: avoid ketorolac (GI bleeding, acute kidney injury).' } }),
  D('nimesulide', 'Nimesulide', 'M01AX17', ['nsaid'], { synonyms: ['nise', 'nimulid'], maxDailyMg: 200, pregnancy: NSAID_PREG, renal: NSAID_RENAL, elderly: NSAID_ELDERLY, hepatotoxic: true, paed: { minAgeYears: 12, minAgeNote: 'Nimesulide formulations are prohibited for children under 12 in India (CDSCO, 2011).' } }),
  D('aspirin', 'Aspirin (acetylsalicylic acid)', 'B01AC06', ['antiplatelet'], { synonyms: ['acetylsalicylic acid', 'ecosprin', 'disprin', 'loprin', 'asa'], nlem: true, paed: { minAgeYears: 16, minAgeNote: 'Avoid aspirin under 16 years (Reye syndrome) except on specialist advice, e.g. Kawasaki disease.' }, elderly: { level: 'caution', note: 'Beers 2023: avoid starting aspirin for primary prevention (bleeding risk outweighs benefit).' } }),
  D('tramadol', 'Tramadol', 'N02AX02', ['opioid'], { synonyms: ['contramal', 'tramazac', 'ultram'], schedule: 'H1', ndps: true, maxDailyMg: 400, serotonergic: true, sedating: true, renal: { adjustBelow: 30, note: 'eGFR < 30: dose every 12 h, maximum 200 mg/day.' }, paed: { minAgeYears: 12, minAgeNote: 'Tramadol is contraindicated under 12 years (respiratory depression; FDA 2017).' }, lactation: { level: 'avoid', note: 'Ultra-rapid CYP2D6 metabolisers pass active metabolite to the infant.' }, elderly: { level: 'caution', note: 'Beers 2023: may cause hyponatraemia/SIADH; monitor sodium.' } }),
  D('tapentadol', 'Tapentadol', 'N02AX06', ['opioid'], { synonyms: ['tapal', 'tydol'], maxDailyMg: 600, serotonergic: true, sedating: true }),
  D('codeine', 'Codeine', 'R05DA04', ['opioid', 'antitussive'], { synonyms: ['codeine phosphate'], schedule: 'H1', ndps: true, sedating: true, paed: { minAgeYears: 12, minAgeNote: 'Codeine is contraindicated under 12 years (fatal respiratory depression in ultra-rapid metabolisers).' }, lactation: { level: 'avoid', note: 'Avoid in breastfeeding (infant opioid toxicity).' } }),
  D('morphine', 'Morphine', 'N02AA01', ['opioid'], { ndps: true, highAlert: true, sedating: true, renal: { adjustBelow: 30, note: 'Active metabolites accumulate; reduce dose or choose another opioid.' } }),
  D('pentazocine', 'Pentazocine', 'N02AD01', ['opioid'], { synonyms: ['fortwin'], schedule: 'H1', ndps: true, sedating: true }),
  D('buprenorphine', 'Buprenorphine', 'N02AE01', ['opioid'], { schedule: 'H1', ndps: true, sedating: true }),

  // ── Antibacterials ───────────────────────────────────────────────────────
  D('amoxicillin', 'Amoxicillin', 'J01CA04', ['penicillin'], { synonyms: ['amoxycillin', 'mox', 'novamox', 'amoxil', 'almox'], aware: 'ACCESS', schedule: 'H', nlem: true, maxDailyMg: 3000, renal: { adjustBelow: 30, note: 'eGFR < 30: reduce dose / extend interval.' }, paed: { mgPerKgDay: 90, maxMgDay: 3000 } }),
  D('amoxicillin_clavulanate', 'Amoxicillin + clavulanic acid', 'J01CR02', ['penicillin'], { synonyms: ['co-amoxiclav', 'amoxicillin-clavulanate', 'amoxycillin clavulanate', 'amoxicillin + clavulanic acid', 'augmentin', 'moxclav', 'clavam', 'moxikind cv', 'amoxyclav'], aware: 'ACCESS', schedule: 'H', nlem: true, renal: { adjustBelow: 30, note: 'eGFR < 30: avoid 875 mg strength; reduce dose.' }, hepatotoxic: true }),
  D('ampicillin', 'Ampicillin', 'J01CA01', ['penicillin'], { aware: 'ACCESS', schedule: 'H', nlem: true }),
  D('cloxacillin', 'Cloxacillin', 'J01CF02', ['penicillin'], { aware: 'ACCESS', schedule: 'H', nlem: true }),
  D('phenoxymethylpenicillin', 'Phenoxymethylpenicillin (Penicillin V)', 'J01CE02', ['penicillin'], { synonyms: ['penicillin v', 'pen v'], aware: 'ACCESS', schedule: 'H', nlem: true }),
  D('benzathine_penicillin', 'Benzathine benzylpenicillin', 'J01CE08', ['penicillin'], { synonyms: ['benzathine penicillin', 'penidure', 'pencom'], aware: 'ACCESS', schedule: 'H', nlem: true }),
  D('cephalexin', 'Cefalexin', 'J01DB01', ['cephalosporin'], { synonyms: ['cephalexin', 'sporidex', 'phexin'], aware: 'ACCESS', schedule: 'H', nlem: true }),
  D('cefadroxil', 'Cefadroxil', 'J01DB05', ['cephalosporin'], { synonyms: ['droxyl', 'odoxil'], aware: 'ACCESS', schedule: 'H' }),
  D('cefuroxime', 'Cefuroxime', 'J01DC02', ['cephalosporin'], { synonyms: ['cefuroxime axetil', 'ceftum', 'zinnat'], aware: 'WATCH', schedule: 'H' }),
  D('cefixime', 'Cefixime', 'J01DD08', ['cephalosporin'], { synonyms: ['taxim-o', 'taxim o', 'zifi', 'mahacef', 'cefix'], aware: 'WATCH', schedule: 'H1', nlem: true, maxDailyMg: 400, renal: { adjustBelow: 20, note: 'eGFR < 20: halve the dose.' }, paed: { mgPerKgDay: 8, maxMgDay: 400 } }),
  D('cefpodoxime', 'Cefpodoxime', 'J01DD13', ['cephalosporin'], { synonyms: ['cepodem', 'monocef-o'], aware: 'WATCH', schedule: 'H1' }),
  D('ceftriaxone', 'Ceftriaxone', 'J01DD04', ['cephalosporin'], { synonyms: ['monocef', 'rocephin', 'intacef'], aware: 'WATCH', schedule: 'H1', nlem: true }),
  D('azithromycin', 'Azithromycin', 'J01FA10', ['macrolide'], { synonyms: ['azee', 'azithral', 'zithromax', 'azax'], aware: 'WATCH', schedule: 'H', nlem: true, qt: true, maxDailyMg: 500, paed: { mgPerKgDay: 10, maxMgDay: 500 } }),
  D('clarithromycin', 'Clarithromycin', 'J01FA09', ['macrolide'], { synonyms: ['claribid', 'klaricid'], aware: 'WATCH', schedule: 'H', nlem: true, qt: true, cyp3a4: 'strong_inhibitor', maxDailyMg: 1000, renal: { adjustBelow: 30, note: 'eGFR < 30: halve the dose.' } }),
  D('erythromycin', 'Erythromycin', 'J01FA01', ['macrolide'], { synonyms: ['althrocin', 'erythrocin'], aware: 'WATCH', schedule: 'H', qt: true, cyp3a4: 'moderate_inhibitor' }),
  D('ciprofloxacin', 'Ciprofloxacin', 'J01MA02', ['fluoroquinolone'], { synonyms: ['cifran', 'ciplox', 'ciprobid', 'cipro'], aware: 'WATCH', schedule: 'H', nlem: true, qt: true, maxDailyMg: 1500, renal: { adjustBelow: 30, note: 'eGFR < 30: reduce dose / extend interval.' }, paed: FQ_PAED, elderly: { level: 'caution', note: 'Beers 2023: delirium, tendon rupture, dysglycaemia; avoid with corticosteroids.' } }),
  D('levofloxacin', 'Levofloxacin', 'J01MA12', ['fluoroquinolone'], { synonyms: ['levoflox', 'glevo', 'levomac', 'tavanic'], aware: 'WATCH', schedule: 'H1', nlem: true, qt: true, maxDailyMg: 750, renal: { adjustBelow: 50, note: 'eGFR < 50: reduce dose / extend interval.' }, paed: FQ_PAED }),
  D('ofloxacin', 'Ofloxacin', 'J01MA01', ['fluoroquinolone'], { synonyms: ['zanocin', 'oflox'], aware: 'WATCH', schedule: 'H', qt: true, maxDailyMg: 800, paed: FQ_PAED }),
  D('norfloxacin', 'Norfloxacin', 'J01MA06', ['fluoroquinolone'], { synonyms: ['norflox'], aware: 'WATCH', schedule: 'H', paed: FQ_PAED }),
  D('moxifloxacin', 'Moxifloxacin', 'J01MA14', ['fluoroquinolone'], { synonyms: ['moxif', 'avelox'], aware: 'WATCH', schedule: 'H1', qt: true, paed: FQ_PAED }),
  D('doxycycline', 'Doxycycline', 'J01AA02', ['tetracycline'], { synonyms: ['doxt', 'doxy-1', 'microdox', 'biodoxi'], aware: 'ACCESS', schedule: 'H', nlem: true, maxDailyMg: 200, pregnancy: { level: 'avoid', note: 'Tetracyclines are avoided in pregnancy (fetal tooth discolouration, bone growth; maternal hepatotoxicity).' }, paed: TETRA_PAED }),
  D('tetracycline', 'Tetracycline', 'J01AA07', ['tetracycline'], { aware: 'ACCESS', schedule: 'H', pregnancy: { level: 'avoid', note: 'Tetracyclines are avoided in pregnancy.' }, paed: TETRA_PAED, renal: { avoidBelow: 30, note: 'Tetracycline (not doxycycline) worsens renal failure.' } }),
  D('cotrimoxazole', 'Co-trimoxazole (sulfamethoxazole + trimethoprim)', 'J01EE01', ['sulfonamide_antibiotic'], { synonyms: ['co-trimoxazole', 'trimethoprim + sulfamethoxazole', 'sulfamethoxazole + trimethoprim', 'trimethoprim sulfamethoxazole', 'bactrim', 'septran', 'septra', 'smx-tmp', 'tmp-smx'], aware: 'ACCESS', schedule: 'H', nlem: true, pregnancy: { level: 'caution', note: 'Folate antagonist (1st trimester) and kernicterus risk near term; use only if benefit outweighs risk.' }, renal: { avoidBelow: 15, adjustBelow: 30, note: 'eGFR 15–30: halve the dose; avoid below 15. Raises potassium.' }, paed: { minAgeYears: 0.12, minAgeNote: 'Not in neonates (kernicterus).' } }),
  D('nitrofurantoin', 'Nitrofurantoin', 'J01XE01', ['nitrofuran'], { synonyms: ['niftran', 'furadantin', 'macrobid'], aware: 'ACCESS', schedule: 'H', nlem: true, renal: { avoidBelow: 30, note: 'Ineffective and neurotoxic when eGFR < 30 (Beers 2023: avoid if CrCl < 30).' }, pregnancy: { level: 'avoid', note: 'Avoid at term (36 weeks onward): neonatal haemolysis.', fromWeek: 36 }, elderly: { level: 'caution', note: 'Beers 2023: avoid long-term use (pulmonary toxicity, neuropathy).' } }),
  D('metronidazole', 'Metronidazole', 'P01AB01', ['nitroimidazole', 'disulfiram_like'], { synonyms: ['flagyl', 'metrogyl', 'metron'], aware: 'ACCESS', schedule: 'H', nlem: true, maxDailyMg: 2000, paed: { mgPerKgDay: 40, maxMgDay: 2000 } }),
  D('tinidazole', 'Tinidazole', 'P01AB02', ['nitroimidazole', 'disulfiram_like'], { synonyms: ['fasigyn', 'tiniba'], schedule: 'H', pregnancy: { level: 'avoid', note: 'Avoid in the first trimester.' } }),
  D('ornidazole', 'Ornidazole', 'P01AB03', ['nitroimidazole'], { synonyms: ['dazolic'], schedule: 'H' }),
  D('clindamycin', 'Clindamycin', 'J01FF01', ['lincosamide'], { synonyms: ['dalacin', 'clindac'], aware: 'ACCESS', schedule: 'H', nlem: true }),
  D('linezolid', 'Linezolid', 'J01XX08', ['oxazolidinone'], { synonyms: ['linospan', 'lizolid'], aware: 'RESERVE', schedule: 'H', serotonergic: true }),
  D('gentamicin', 'Gentamicin', 'J01GB03', ['aminoglycoside'], { aware: 'ACCESS', schedule: 'H', nlem: true, highAlert: true, renal: { adjustBelow: 60, note: 'Nephro- and ototoxic: dose by level and renal function.' }, pregnancy: { level: 'avoid', note: 'Aminoglycosides risk fetal ototoxicity.' } }),

  // ── Antifungals, antituberculars, antimalarials, anthelmintics, antivirals ─
  D('fluconazole', 'Fluconazole', 'J02AC01', ['azole_antifungal'], { synonyms: ['forcan', 'zocon', 'syscan'], schedule: 'H', nlem: true, qt: true, cyp3a4: 'moderate_inhibitor', renal: { adjustBelow: 50, note: 'eGFR < 50: halve the dose for repeat dosing.' }, pregnancy: { level: 'avoid', note: 'High-dose / prolonged use linked to congenital anomalies; single 150 mg dose is lower risk but topical treatment is preferred.' } }),
  D('itraconazole', 'Itraconazole', 'J02AC02', ['azole_antifungal'], { synonyms: ['itaspor', 'canditral', 'sporanox'], schedule: 'H', qt: true, cyp3a4: 'strong_inhibitor', pregnancy: { level: 'avoid', note: 'Avoid in pregnancy.' } }),
  D('ketoconazole', 'Ketoconazole (oral)', 'J02AB02', ['azole_antifungal'], { synonyms: ['nizral'], schedule: 'H', qt: true, cyp3a4: 'strong_inhibitor', hepatotoxic: true }),
  D('terbinafine', 'Terbinafine', 'D01BA02', ['azole_antifungal'], { synonyms: ['terbicip', 'lamisil'], schedule: 'H', hepatotoxic: true }),
  D('griseofulvin', 'Griseofulvin', 'D01BA01', [], { synonyms: ['grisovin'], schedule: 'H', pregnancy: { level: 'contraindicated', note: 'Teratogenic; contraindicated in pregnancy.' } }),
  D('isoniazid', 'Isoniazid', 'J04AC01', ['antitubercular'], { synonyms: ['inh'], schedule: 'H1', nlem: true, hepatotoxic: true }),
  D('rifampicin', 'Rifampicin', 'J04AB02', ['antitubercular'], { synonyms: ['rifampin', 'r-cin', 'rimactane'], schedule: 'H1', nlem: true, cyp3a4: 'strong_inducer', hepatotoxic: true }),
  D('pyrazinamide', 'Pyrazinamide', 'J04AK01', ['antitubercular'], { synonyms: ['pza'], schedule: 'H1', nlem: true, hepatotoxic: true }),
  D('ethambutol', 'Ethambutol', 'J04AK02', ['antitubercular'], { synonyms: ['combutol', 'myambutol'], schedule: 'H1', nlem: true, renal: { adjustBelow: 30, note: 'eGFR < 30: three times weekly dosing (optic neuritis risk).' } }),
  FDC('hrze', 'Isoniazid + Rifampicin + Pyrazinamide + Ethambutol (FDC)', ['isoniazid', 'rifampicin', 'pyrazinamide', 'ethambutol'], ['hrze', '4fdc', 'akt-4', 'akt 4', 'forecox']),
  D('chloroquine', 'Chloroquine', 'P01BA01', ['antimalarial'], { synonyms: ['lariago', 'resochin'], schedule: 'H', nlem: true, qt: true }),
  D('hydroxychloroquine', 'Hydroxychloroquine', 'P01BA02', ['antimalarial', 'immunosuppressant'], { synonyms: ['hcqs', 'hcq', 'plaquenil'], schedule: 'H', nlem: true, qt: true }),
  D('primaquine', 'Primaquine', 'P01BA03', ['antimalarial'], { schedule: 'H', nlem: true, pregnancy: { level: 'contraindicated', note: 'Haemolysis in a G6PD-deficient fetus; contraindicated in pregnancy.' } }),
  D('artemether_lumefantrine', 'Artemether + lumefantrine', 'P01BF01', ['antimalarial'], { synonyms: ['coartem', 'lumerax', 'falcynate-lf'], schedule: 'H', nlem: true, qt: true }),
  D('albendazole', 'Albendazole', 'P02CA03', ['anthelmintic'], { synonyms: ['zentel', 'bandy'], nlem: true, pregnancy: { level: 'avoid', note: 'Avoid in the first trimester.' }, paed: { minAgeYears: 1, minAgeNote: 'Not under 1 year (200 mg at 1–2 years).' } }),
  D('mebendazole', 'Mebendazole', 'P02CA01', ['anthelmintic'], { synonyms: ['mebex'], nlem: true, pregnancy: { level: 'avoid', note: 'Avoid in the first trimester.' } }),
  D('ivermectin', 'Ivermectin', 'P02CF01', ['anthelmintic'], { synonyms: ['ivermectol', 'iverjohn'], pregnancy: { level: 'avoid', note: 'Avoid in pregnancy.' } }),
  D('diethylcarbamazine', 'Diethylcarbamazine', 'P02CB02', ['anthelmintic'], { synonyms: ['dec', 'banocide', 'hetrazan'], nlem: true }),
  D('acyclovir', 'Aciclovir', 'J05AB01', ['antiviral'], { synonyms: ['acyclovir', 'acivir', 'zovirax'], schedule: 'H', nlem: true, renal: { adjustBelow: 25, note: 'eGFR < 25: extend the dosing interval (neurotoxicity).' } }),
  D('oseltamivir', 'Oseltamivir', 'J05AH02', ['antiviral'], { synonyms: ['tamiflu', 'fluvir'], schedule: 'H', nlem: true, renal: { adjustBelow: 30, note: 'eGFR < 30: reduce dose.' } }),

  // ── Cardiovascular ────────────────────────────────────────────────────────
  D('amlodipine', 'Amlodipine', 'C08CA01', ['ccb_dhp'], { synonyms: ['amlong', 'amlokind', 'stamlo', 'amlopres', 'amlip', 'norvasc'], nlem: true, maxDailyMg: 10 }),
  D('nifedipine', 'Nifedipine', 'C08CA05', ['ccb_dhp'], { synonyms: ['depin', 'nicardia', 'calcigard'], nlem: true, elderly: { level: 'avoid', note: 'Beers 2023: avoid immediate-release nifedipine (hypotension, myocardial ischaemia).' } }),
  D('cilnidipine', 'Cilnidipine', 'C08CA14', ['ccb_dhp'], { synonyms: ['cilacar', 'cinod'] }),
  D('diltiazem', 'Diltiazem', 'C08DB01', ['ccb_nondhp'], { synonyms: ['dilzem', 'dilcontin'], nlem: true, cyp3a4: 'moderate_inhibitor' }),
  D('verapamil', 'Verapamil', 'C08DA01', ['ccb_nondhp', 'antiarrhythmic'], { synonyms: ['calaptin'], nlem: true, cyp3a4: 'moderate_inhibitor' }),
  D('atenolol', 'Atenolol', 'C07AB03', ['beta_blocker'], { synonyms: ['aten', 'tenormin', 'betacard'], nlem: true, pregnancy: { level: 'caution', note: 'Associated with fetal growth restriction; labetalol or nifedipine are preferred in pregnancy.' }, renal: { adjustBelow: 35, note: 'Renally cleared: reduce dose if eGFR < 35.' } }),
  D('metoprolol', 'Metoprolol', 'C07AB02', ['beta_blocker'], { synonyms: ['metoprolol succinate', 'metoprolol tartrate', 'metolar', 'met xl', 'betaloc', 'seloken', 'revelol', 'metpure'], nlem: true }),
  D('bisoprolol', 'Bisoprolol', 'C07AB07', ['beta_blocker'], { synonyms: ['concor', 'corbis'], nlem: true }),
  D('nebivolol', 'Nebivolol', 'C07AB12', ['beta_blocker'], { synonyms: ['nebicard', 'nebistar'] }),
  D('propranolol', 'Propranolol', 'C07AA05', ['beta_blocker', 'beta_blocker_nonselective'], { synonyms: ['ciplar', 'inderal'], nlem: true }),
  D('carvedilol', 'Carvedilol', 'C07AG02', ['beta_blocker', 'beta_blocker_nonselective'], { synonyms: ['carca', 'cardivas'], nlem: true }),
  D('labetalol', 'Labetalol', 'C07AG01', ['beta_blocker', 'beta_blocker_nonselective'], { synonyms: ['lobet'], nlem: true }),
  D('enalapril', 'Enalapril', 'C09AA02', ['acei'], { synonyms: ['envas', 'enam', 'vasotec'], nlem: true, maxDailyMg: 40, pregnancy: RAAS_PREG, renal: { adjustBelow: 30, note: 'Start low and monitor creatinine and potassium.' } }),
  D('ramipril', 'Ramipril', 'C09AA05', ['acei'], { synonyms: ['cardace', 'ramace', 'altace'], nlem: true, maxDailyMg: 10, pregnancy: RAAS_PREG, renal: { adjustBelow: 30, note: 'Start low and monitor creatinine and potassium.' } }),
  D('lisinopril', 'Lisinopril', 'C09AA03', ['acei'], { synonyms: ['listril', 'lipril'], maxDailyMg: 80, pregnancy: RAAS_PREG }),
  D('telmisartan', 'Telmisartan', 'C09CA07', ['arb'], { synonyms: ['telma', 'telmikind', 'telsar', 'telvas', 'micardis'], nlem: true, maxDailyMg: 80, pregnancy: RAAS_PREG }),
  D('losartan', 'Losartan', 'C09CA01', ['arb'], { synonyms: ['losar', 'repace', 'losacar', 'cozaar'], nlem: true, maxDailyMg: 100, pregnancy: RAAS_PREG }),
  D('olmesartan', 'Olmesartan', 'C09CA08', ['arb'], { synonyms: ['olmezest', 'olsar'], maxDailyMg: 40, pregnancy: RAAS_PREG }),
  D('hydrochlorothiazide', 'Hydrochlorothiazide', 'C03AA03', ['thiazide'], { synonyms: ['hctz', 'aquazide', 'hydrazide'], nlem: true, renal: { adjustBelow: 30, note: 'Thiazides lose efficacy when eGFR < 30.' } }),
  D('chlorthalidone', 'Chlorthalidone', 'C03BA04', ['thiazide'], { synonyms: ['chlorthalidone', 'thaloric', 'clorpres'], nlem: true, renal: { adjustBelow: 30, note: 'Reduced efficacy when eGFR < 30.' } }),
  D('indapamide', 'Indapamide', 'C03BA11', ['thiazide'], { synonyms: ['natrilix', 'lorvas'] }),
  D('furosemide', 'Furosemide', 'C03CA01', ['loop_diuretic'], { synonyms: ['frusemide', 'lasix'], nlem: true }),
  D('torsemide', 'Torasemide', 'C03CA04', ['loop_diuretic'], { synonyms: ['torsemide', 'dytor', 'tide'], nlem: true }),
  D('spironolactone', 'Spironolactone', 'C03DA01', ['k_sparing_diuretic'], { synonyms: ['aldactone'], nlem: true, renal: { avoidBelow: 30, note: 'Hyperkalaemia risk; avoid if eGFR < 30.' }, pregnancy: { level: 'avoid', note: 'Anti-androgenic effects on the fetus.' } }),
  D('eplerenone', 'Eplerenone', 'C03DA04', ['k_sparing_diuretic'], { synonyms: ['eptus'], renal: { avoidBelow: 30, note: 'Hyperkalaemia risk; avoid if eGFR < 30.' } }),
  D('amiloride', 'Amiloride', 'C03DB01', ['k_sparing_diuretic'], { renal: { avoidBelow: 30, note: 'Hyperkalaemia risk.' } }),
  D('isosorbide_mononitrate', 'Isosorbide mononitrate', 'C01DA14', ['nitrate'], { synonyms: ['monotrate', 'imdur', 'ismo', 'isosorbide-5-mononitrate'], nlem: true }),
  D('isosorbide_dinitrate', 'Isosorbide dinitrate', 'C01DA08', ['nitrate'], { synonyms: ['sorbitrate', 'isordil'], nlem: true }),
  D('glyceryl_trinitrate', 'Glyceryl trinitrate', 'C01DA02', ['nitrate'], { synonyms: ['nitroglycerin', 'nitroglycerine', 'gtn', 'nitrocontin', 'angispan'], nlem: true }),
  D('nicorandil', 'Nicorandil', 'C01DX16', ['nitrate'], { synonyms: ['korandil', 'nikoran'] }),
  D('digoxin', 'Digoxin', 'C01AA05', ['cardiac_glycoside'], { synonyms: ['lanoxin', 'digox'], nlem: true, highAlert: true, renal: { adjustBelow: 60, note: 'Renally cleared: reduce dose and monitor level if eGFR < 60.' }, elderly: { level: 'caution', note: 'Beers 2023: avoid doses above 0.125 mg/day.' } }),
  D('amiodarone', 'Amiodarone', 'C01BD01', ['antiarrhythmic'], { synonyms: ['cordarone', 'tachyra'], nlem: true, highAlert: true, qt: true, cyp3a4: 'moderate_inhibitor', pregnancy: { level: 'avoid', note: 'Fetal thyroid dysfunction.' }, lactation: { level: 'avoid', note: 'Iodine content; avoid.' } }),
  D('ivabradine', 'Ivabradine', 'C01EB17', [], { synonyms: ['ivabrad', 'bradia'], pregnancy: { level: 'contraindicated', note: 'Fetotoxic in animal studies.' } }),
  D('prazosin', 'Prazosin', 'C02CA01', ['alpha_blocker'], { synonyms: ['minipress'], elderly: { level: 'avoid', note: 'Beers 2023: avoid as an antihypertensive (orthostatic hypotension).' } }),
  D('clonidine', 'Clonidine', 'C02AC01', ['central_antihypertensive'], { synonyms: ['arkamin', 'catapres'], sedating: true, elderly: { level: 'avoid', note: 'Beers 2023: avoid as first-line antihypertensive (CNS effects, bradycardia).' } }),
  D('methyldopa', 'Methyldopa', 'C02AB01', ['central_antihypertensive'], { synonyms: ['alphadopa', 'aldomet'], nlem: true }),
  D('hydralazine', 'Hydralazine', 'C02DB02', ['vasodilator'], { nlem: true }),
  D('sildenafil', 'Sildenafil', 'G04BE03', ['pde5_inhibitor'], { synonyms: ['viagra', 'penegra', 'manforce', 'suhagra'] }),
  D('tadalafil', 'Tadalafil', 'G04BE08', ['pde5_inhibitor'], { synonyms: ['cialis', 'megalis', 'tadacip'] }),

  // ── Antithrombotics ───────────────────────────────────────────────────────
  D('warfarin', 'Warfarin', 'B01AA03', ['vka'], { synonyms: ['coumadin', 'warf', 'uniwarfin'], nlem: true, highAlert: true, pregnancy: { level: 'contraindicated', note: 'Warfarin embryopathy (6–12 weeks) and fetal haemorrhage; switch to heparin.' } }),
  D('acenocoumarol', 'Acenocoumarol', 'B01AA07', ['vka'], { synonyms: ['acitrom', 'nicoumalone'], nlem: true, highAlert: true, pregnancy: { level: 'contraindicated', note: 'Coumarin embryopathy; switch to heparin.' } }),
  D('clopidogrel', 'Clopidogrel', 'B01AC04', ['antiplatelet'], { synonyms: ['clopilet', 'plavix', 'clopitab', 'deplatt'], nlem: true }),
  D('ticagrelor', 'Ticagrelor', 'B01AC24', ['antiplatelet'], { synonyms: ['brilinta', 'axcer'], nlem: true }),
  D('prasugrel', 'Prasugrel', 'B01AC22', ['antiplatelet'], { synonyms: ['prasita', 'effient'] }),
  D('rivaroxaban', 'Rivaroxaban', 'B01AF01', ['doac'], { synonyms: ['xarelto'], highAlert: true, renal: { avoidBelow: 15, adjustBelow: 50, note: 'eGFR 15–50: dose reduction for AF; avoid below 15.' }, pregnancy: { level: 'contraindicated', note: 'Not recommended in pregnancy.' } }),
  D('apixaban', 'Apixaban', 'B01AF02', ['doac'], { synonyms: ['eliquis', 'apigat'], highAlert: true, renal: { avoidBelow: 15, note: 'Avoid if eGFR < 15.' }, pregnancy: { level: 'contraindicated', note: 'Not recommended in pregnancy.' } }),
  D('dabigatran', 'Dabigatran', 'B01AE07', ['doac'], { synonyms: ['pradaxa'], highAlert: true, renal: { avoidBelow: 30, note: 'Avoid if eGFR < 30.' }, pregnancy: { level: 'contraindicated', note: 'Not recommended in pregnancy.' } }),
  D('enoxaparin', 'Enoxaparin', 'B01AB05', ['heparin'], { synonyms: ['clexane', 'lomoh'], highAlert: true, renal: { adjustBelow: 30, note: 'eGFR < 30: reduce dose.' } }),

  // ── Lipid-lowering ────────────────────────────────────────────────────────
  D('atorvastatin', 'Atorvastatin', 'C10AA05', ['statin'], { synonyms: ['atorva', 'lipitor', 'storvas', 'atocor', 'tonact'], nlem: true, maxDailyMg: 80, pregnancy: STATIN_PREG, lactation: { level: 'avoid', note: 'Avoid while breastfeeding.' } }),
  D('rosuvastatin', 'Rosuvastatin', 'C10AA07', ['statin'], { synonyms: ['rosuvas', 'crestor', 'rozavel', 'rosulip'], maxDailyMg: 40, pregnancy: STATIN_PREG, renal: { adjustBelow: 30, note: 'eGFR < 30: start 5 mg, maximum 10 mg.' } }),
  D('simvastatin', 'Simvastatin', 'C10AA01', ['statin'], { synonyms: ['simvotin', 'zocor'], maxDailyMg: 40, pregnancy: STATIN_PREG }),
  D('lovastatin', 'Lovastatin', 'C10AA02', ['statin'], { pregnancy: STATIN_PREG }),
  D('pravastatin', 'Pravastatin', 'C10AA03', ['statin'], { pregnancy: STATIN_PREG }),
  D('fenofibrate', 'Fenofibrate', 'C10AB05', ['fibrate'], { synonyms: ['lipicard', 'fenolip', 'tricor'], renal: { avoidBelow: 30, note: 'Avoid if eGFR < 30.' } }),
  D('gemfibrozil', 'Gemfibrozil', 'C10AB04', ['fibrate'], { synonyms: ['lopid'] }),
  D('ezetimibe', 'Ezetimibe', 'C10AX09', ['lipid_other'], { synonyms: ['ezedoc', 'zetia'] }),

  // ── Diabetes ──────────────────────────────────────────────────────────────
  D('metformin', 'Metformin', 'A10BA02', ['biguanide'], { synonyms: ['glycomet', 'glucophage', 'gluconorm', 'obimet', 'glyciphage', 'metformin hydrochloride'], nlem: true, maxDailyMg: 2550, renal: { avoidBelow: 30, adjustBelow: 45, note: 'Contraindicated if eGFR < 30 (lactic acidosis); do not start and use maximum 1000 mg/day if eGFR 30–45.' } }),
  D('glimepiride', 'Glimepiride', 'A10BB12', ['sulfonylurea'], { synonyms: ['amaryl', 'glimy', 'glimestar', 'zoryl'], nlem: true, maxDailyMg: 8, renal: { adjustBelow: 30, note: 'Hypoglycaemia risk rises in CKD; start 1 mg.' }, elderly: { level: 'caution', note: 'Beers 2023: sulfonylureas raise the risk of prolonged hypoglycaemia; avoid as first- or second-line.' } }),
  D('glibenclamide', 'Glibenclamide', 'A10BB01', ['sulfonylurea'], { synonyms: ['glyburide', 'daonil', 'euglucon'], nlem: true, maxDailyMg: 15, renal: { avoidBelow: 60, note: 'Long-acting active metabolites accumulate; avoid in CKD.' }, elderly: { level: 'avoid', note: 'Beers 2023: avoid — prolonged hypoglycaemia.' } }),
  D('gliclazide', 'Gliclazide', 'A10BB09', ['sulfonylurea'], { synonyms: ['diamicron', 'glizid', 'reclide'], nlem: true, maxDailyMg: 320, elderly: { level: 'caution', note: 'Beers 2023: sulfonylureas raise the risk of hypoglycaemia; prefer safer agents.' } }),
  D('glipizide', 'Glipizide', 'A10BB07', ['sulfonylurea'], { synonyms: ['glynase'], maxDailyMg: 20, elderly: { level: 'caution', note: 'Beers 2023: sulfonylureas raise the risk of hypoglycaemia.' } }),
  D('sitagliptin', 'Sitagliptin', 'A10BH01', ['dpp4_inhibitor'], { synonyms: ['januvia', 'istavel', 'zita'], maxDailyMg: 100, renal: { adjustBelow: 45, note: 'eGFR 30–45: 50 mg; < 30: 25 mg.' } }),
  D('vildagliptin', 'Vildagliptin', 'A10BH02', ['dpp4_inhibitor'], { synonyms: ['galvus', 'jalra', 'zomelis'], renal: { adjustBelow: 50, note: 'eGFR < 50: 50 mg once daily.' } }),
  D('teneligliptin', 'Teneligliptin', 'A10BH08', ['dpp4_inhibitor'], { synonyms: ['tenepride', 'teneza', 'zita plus'] }),
  D('empagliflozin', 'Empagliflozin', 'A10BK03', ['sglt2_inhibitor'], { synonyms: ['jardiance', 'gibtulio'], renal: { adjustBelow: 20, note: 'Do not start if eGFR < 20; glucose-lowering effect falls below 45.' } }),
  D('dapagliflozin', 'Dapagliflozin', 'A10BK01', ['sglt2_inhibitor'], { synonyms: ['forxiga', 'dapaglyn', 'oxra'], renal: { adjustBelow: 25, note: 'Do not start if eGFR < 25; glucose-lowering effect falls below 45.' } }),
  D('pioglitazone', 'Pioglitazone', 'A10BG03', ['thiazolidinedione'], { synonyms: ['pioz', 'pioglit'] }),
  D('voglibose', 'Voglibose', 'A10BF03', ['alpha_glucosidase_inhibitor'], { synonyms: ['volix', 'vobose'] }),
  D('acarbose', 'Acarbose', 'A10BF01', ['alpha_glucosidase_inhibitor'], { synonyms: ['glucobay'] }),
  D('insulin', 'Insulin', 'A10A', ['insulin'], { synonyms: ['human insulin', 'insulin regular', 'actrapid', 'mixtard', 'huminsulin', 'insulatard', 'lantus', 'glargine', 'insulin glargine', 'novorapid', 'aspart', 'lispro', 'humalog', 'basalog'], nlem: true, highAlert: true }),
  FDC('metformin_glimepiride', 'Metformin + Glimepiride', ['metformin', 'glimepiride'], ['glycomet gp', 'glycomet-gp', 'gemer', 'glimy m']),
  FDC('metformin_sitagliptin', 'Metformin + Sitagliptin', ['metformin', 'sitagliptin'], ['janumet', 'istamet']),
  FDC('metformin_vildagliptin', 'Metformin + Vildagliptin', ['metformin', 'vildagliptin'], ['galvus met', 'jalra-m']),

  // ── Gastrointestinal ──────────────────────────────────────────────────────
  D('pantoprazole', 'Pantoprazole', 'A02BC02', ['ppi'], { synonyms: ['pan', 'pan 40', 'pantocid', 'pantop', 'protonix', 'pantodac'], nlem: true, maxDailyMg: 80, elderly: { level: 'caution', note: 'Beers 2023: avoid > 8 weeks unless indicated (C. difficile, fractures, B12 deficiency).' } }),
  D('omeprazole', 'Omeprazole', 'A02BC01', ['ppi'], { synonyms: ['omez', 'ocid', 'prilosec'], nlem: true, maxDailyMg: 80, elderly: { level: 'caution', note: 'Beers 2023: avoid > 8 weeks unless indicated.' } }),
  D('esomeprazole', 'Esomeprazole', 'A02BC05', ['ppi'], { synonyms: ['nexpro', 'esoz', 'nexium'], maxDailyMg: 80 }),
  D('rabeprazole', 'Rabeprazole', 'A02BC04', ['ppi'], { synonyms: ['rablet', 'razo', 'rabicip', 'happi'], maxDailyMg: 40 }),
  D('lansoprazole', 'Lansoprazole', 'A02BC03', ['ppi'], { synonyms: ['lanzol', 'prevacid'] }),
  D('famotidine', 'Famotidine', 'A02BA03', ['h2_blocker'], { synonyms: ['famocid', 'topcid'], nlem: true, renal: { adjustBelow: 50, note: 'eGFR < 50: halve the dose (confusion in older adults).' } }),
  D('ranitidine', 'Ranitidine', 'A02BA02', ['h2_blocker'], { synonyms: ['rantac', 'aciloc', 'zinetac'], renal: { adjustBelow: 50, note: 'eGFR < 50: halve the dose.' } }),
  D('domperidone', 'Domperidone', 'A03FA03', ['antiemetic_d2'], { synonyms: ['domstal', 'vomistop', 'motilium'], qt: true, maxDailyMg: 30 }),
  D('metoclopramide', 'Metoclopramide', 'A03FA01', ['antiemetic_d2'], { synonyms: ['perinorm', 'reglan'], nlem: true, maxDailyMg: 30, paed: { minAgeYears: 1, minAgeNote: 'Contraindicated under 1 year (extrapyramidal reactions); second-line only in children.' }, elderly: { level: 'avoid', note: 'Beers 2023: avoid unless gastroparesis (extrapyramidal effects, tardive dyskinesia).' } }),
  D('ondansetron', 'Ondansetron', 'A04AA01', ['antiemetic_5ht3'], { synonyms: ['emeset', 'ondem', 'vomikind', 'zofran'], nlem: true, qt: true, serotonergic: true, maxDailyMg: 24, paed: { mgPerKgDose: 0.15, maxMgDay: 24 } }),
  D('dicyclomine', 'Dicyclomine (dicycloverine)', 'A03AA07', ['antispasmodic'], { synonyms: ['dicycloverine', 'cyclopam', 'colimex', 'meftal spas'], elderly: { level: 'avoid', note: 'Beers 2023: strongly anticholinergic antispasmodic — avoid.' }, paed: { minAgeYears: 0.5, minAgeNote: 'Contraindicated under 6 months.' } }),
  D('drotaverine', 'Drotaverine', 'A03AD02', ['antispasmodic'], { synonyms: ['drotin', 'doverin', 'no-spa'] }),
  D('hyoscine_butylbromide', 'Hyoscine butylbromide', 'A03BB01', ['antispasmodic'], { synonyms: ['buscopan'], nlem: true, elderly: { level: 'avoid', note: 'Beers 2023: anticholinergic antispasmodic — avoid.' } }),
  D('loperamide', 'Loperamide', 'A07DA03', ['antidiarrhoeal'], { synonyms: ['imodium', 'eldoper', 'lopamide'], paed: { minAgeYears: 2, minAgeNote: 'Contraindicated under 2 years (ileus, CNS depression); WHO advises against antimotility drugs for childhood diarrhoea.' } }),
  D('ors', 'Oral rehydration salts', 'A07CA', [], { synonyms: ['oral rehydration salts', 'oral rehydration solution', 'electral', 'ors sachet'], nlem: true }),
  D('zinc_sulfate', 'Zinc sulfate (dispersible)', 'A12CB01', [], { synonyms: ['zinc', 'zinconia', 'zinc dispersible'], nlem: true }),
  D('lactulose', 'Lactulose', 'A06AD11', ['laxative'], { synonyms: ['duphalac', 'looz'], nlem: true }),
  D('bisacodyl', 'Bisacodyl', 'A06AB02', ['laxative'], { synonyms: ['dulcolax'], nlem: true }),
  D('ispaghula', 'Ispaghula husk (psyllium)', 'A06AC01', ['laxative'], { synonyms: ['psyllium', 'isabgol', 'isabgol husk', 'sat isabgol'] }),
  D('sucralfate', 'Sucralfate', 'A02BX02', ['mucosal_protectant'], { synonyms: ['sucral', 'sparacid'] }),
  D('antacid', 'Aluminium hydroxide + magnesium hydroxide', 'A02AD01', ['antacid'], { synonyms: ['digene', 'gelusil', 'mucaine', 'antacid', 'aluminium hydroxide', 'magnesium hydroxide'], nlem: true }),
  D('ursodeoxycholic_acid', 'Ursodeoxycholic acid', 'A05AA02', [], { synonyms: ['udiliv', 'ursocol', 'udca'] }),
  D('mesalazine', 'Mesalazine', 'A07EC02', [], { synonyms: ['mesacol', 'asacol'] }),
  FDC('pantoprazole_domperidone', 'Pantoprazole + Domperidone', ['pantoprazole', 'domperidone'], ['pan-d', 'pan d', 'pantocid-d', 'pantop-d']),
  FDC('rabeprazole_domperidone', 'Rabeprazole + Domperidone', ['rabeprazole', 'domperidone'], ['rablet-d', 'razo-d', 'rabicip-d']),
  FDC('mefenamic_dicyclomine', 'Mefenamic acid + Dicyclomine', ['mefenamic_acid', 'dicyclomine'], ['meftal-spas', 'meftal spas']),
  FDC('dicyclomine_paracetamol', 'Dicyclomine + Paracetamol', ['dicyclomine', 'paracetamol'], ['cyclopam', 'cyclopam tablet']),

  // ── Respiratory and allergy ───────────────────────────────────────────────
  D('salbutamol', 'Salbutamol', 'R03AC02', ['saba'], { synonyms: ['albuterol', 'asthalin', 'ventolin'], nlem: true }),
  D('levosalbutamol', 'Levosalbutamol', 'R03AC', ['saba'], { synonyms: ['levolin'] }),
  D('budesonide', 'Budesonide (inhaled)', 'R03BA02', ['inhaled_corticosteroid'], { synonyms: ['budecort', 'pulmicort'], nlem: true }),
  D('formoterol', 'Formoterol', 'R03AC13', ['laba'], { synonyms: ['foracort', 'formonide'] }),
  D('tiotropium', 'Tiotropium', 'R03BB04', [], { synonyms: ['tiova', 'spiriva'], nlem: true }),
  D('montelukast', 'Montelukast', 'R03DC03', ['leukotriene_antagonist'], { synonyms: ['montair', 'montek', 'romilast', 'singulair'], maxDailyMg: 10 }),
  D('theophylline', 'Theophylline', 'R03DA04', ['methylxanthine'], { synonyms: ['theo-asthalin', 'theobid', 'unicontin'], nlem: true, highAlert: true }),
  D('etofylline', 'Etofylline', 'R03DA', ['methylxanthine'], {}),
  D('doxofylline', 'Doxofylline', 'R03DA11', ['methylxanthine'], { synonyms: ['doxobid', 'doxolin', 'synasma'] }),
  D('cetirizine', 'Cetirizine', 'R06AE07', ['antihistamine_nonsedating'], { synonyms: ['cetzine', 'okacet', 'alerid', 'zyrtec', 'cetrizine'], nlem: true, maxDailyMg: 20, renal: { adjustBelow: 50, note: 'eGFR < 50: halve the dose.' } }),
  D('levocetirizine', 'Levocetirizine', 'R06AE09', ['antihistamine_nonsedating'], { synonyms: ['levocet', 'xyzal', 'teczine', 'lecope'], maxDailyMg: 5, renal: { adjustBelow: 50, note: 'eGFR < 50: reduce dose / extend interval.' } }),
  D('fexofenadine', 'Fexofenadine', 'R06AX26', ['antihistamine_nonsedating'], { synonyms: ['allegra', 'fexova'], maxDailyMg: 180 }),
  D('loratadine', 'Loratadine', 'R06AX13', ['antihistamine_nonsedating'], { synonyms: ['lorfast', 'claritin'] }),
  D('chlorpheniramine', 'Chlorphenamine (chlorpheniramine)', 'R06AB04', ['antihistamine_sedating'], { synonyms: ['chlorphenamine', 'cpm', 'piriton'], nlem: true, sedating: true, elderly: SEDATING_AH_ELDERLY }),
  D('promethazine', 'Promethazine', 'R06AD02', ['antihistamine_sedating'], { synonyms: ['phenergan', 'avomine'], sedating: true, elderly: SEDATING_AH_ELDERLY, paed: { minAgeYears: 2, minAgeNote: 'Contraindicated under 2 years (fatal respiratory depression).' } }),
  D('hydroxyzine', 'Hydroxyzine', 'N05BB01', ['antihistamine_sedating'], { synonyms: ['atarax'], sedating: true, qt: true, elderly: SEDATING_AH_ELDERLY }),
  D('diphenhydramine', 'Diphenhydramine', 'R06AA02', ['antihistamine_sedating'], { synonyms: ['benadryl'], sedating: true, elderly: SEDATING_AH_ELDERLY }),
  D('ambroxol', 'Ambroxol', 'R05CB06', ['mucolytic'], { synonyms: ['mucolite', 'ambrodil'] }),
  D('bromhexine', 'Bromhexine', 'R05CB02', ['mucolytic'], { synonyms: ['bisolvon'] }),
  D('dextromethorphan', 'Dextromethorphan', 'R05DA09', ['antitussive'], { serotonergic: true }),
  D('guaifenesin', 'Guaifenesin', 'R05CA03', ['mucolytic'], { synonyms: ['guaiphenesin'] }),
  D('phenylephrine', 'Phenylephrine (oral)', 'R01BA03', ['decongestant'], {}),
  D('pseudoephedrine', 'Pseudoephedrine', 'R01BA02', ['decongestant'], {}),
  FDC('montelukast_levocetirizine', 'Montelukast + Levocetirizine', ['montelukast', 'levocetirizine'], ['montair-lc', 'montair lc', 'montek-lc', 'montek lc', 'levocet-m']),
  FDC('etofylline_theophylline', 'Etofylline + Theophylline', ['etofylline', 'theophylline'], ['deriphyllin', 'deriphylline']),

  // ── Endocrine ─────────────────────────────────────────────────────────────
  D('levothyroxine', 'Levothyroxine', 'H03AA01', ['thyroid_hormone'], { synonyms: ['thyroxine', 'thyronorm', 'eltroxin', 'thyrox', 'lethyrox', 'synthroid'], nlem: true }),
  D('carbimazole', 'Carbimazole', 'H03BB01', ['antithyroid'], { synonyms: ['neo-mercazole', 'neomercazole'], nlem: true, pregnancy: { level: 'avoid', note: 'First trimester: embryopathy; propylthiouracil is preferred until 16 weeks.' } }),
  D('methimazole', 'Thiamazole (methimazole)', 'H03BB02', ['antithyroid'], { synonyms: ['methimazole', 'thyrocab'], pregnancy: { level: 'avoid', note: 'First trimester: embryopathy.' } }),
  D('propylthiouracil', 'Propylthiouracil', 'H03BA02', ['antithyroid'], { synonyms: ['ptu'], hepatotoxic: true }),
  D('prednisolone', 'Prednisolone', 'H02AB06', ['corticosteroid'], { synonyms: ['wysolone', 'omnacortil', 'predone'], nlem: true, paed: { mgPerKgDay: 2, maxMgDay: 60 } }),
  D('dexamethasone', 'Dexamethasone', 'H02AB02', ['corticosteroid'], { synonyms: ['dexona', 'decadron'], nlem: true }),
  D('methylprednisolone', 'Methylprednisolone', 'H02AB04', ['corticosteroid'], { synonyms: ['medrol', 'solu-medrol'] }),
  D('deflazacort', 'Deflazacort', 'H02AB13', ['corticosteroid'], { synonyms: ['defcort', 'dfz'] }),
  D('hydrocortisone', 'Hydrocortisone', 'H02AB09', ['corticosteroid'], { nlem: true }),

  // ── Nervous system ────────────────────────────────────────────────────────
  D('alprazolam', 'Alprazolam', 'N05BA12', ['benzodiazepine'], { synonyms: ['alprax', 'restyl', 'alzolam', 'xanax'], schedule: 'H1', ndps: true, sedating: true, elderly: BZD_ELDERLY }),
  D('clonazepam', 'Clonazepam', 'N03AE01', ['benzodiazepine'], { synonyms: ['rivotril', 'clonotril', 'lonazep', 'petril'], ndps: true, sedating: true, elderly: BZD_ELDERLY }),
  D('diazepam', 'Diazepam', 'N05BA01', ['benzodiazepine'], { synonyms: ['valium', 'calmpose'], schedule: 'H1', ndps: true, sedating: true, nlem: true, elderly: BZD_ELDERLY }),
  D('lorazepam', 'Lorazepam', 'N05BA06', ['benzodiazepine'], { synonyms: ['ativan', 'larpose'], ndps: true, sedating: true, nlem: true, elderly: BZD_ELDERLY }),
  D('chlordiazepoxide', 'Chlordiazepoxide', 'N05BA02', ['benzodiazepine'], { synonyms: ['librium'], schedule: 'H1', ndps: true, sedating: true, elderly: BZD_ELDERLY }),
  D('zolpidem', 'Zolpidem', 'N05CF02', ['z_drug'], { synonyms: ['zolfresh', 'nitrest', 'ambien'], schedule: 'H1', ndps: true, sedating: true, elderly: { level: 'avoid', note: 'Beers 2023: avoid Z-drugs (falls, fractures, delirium).' } }),
  D('amitriptyline', 'Amitriptyline', 'N06AA09', ['tca'], { synonyms: ['tryptomer', 'amitone', 'elavil'], nlem: true, sedating: true, serotonergic: true, qt: true, elderly: { level: 'avoid', note: 'Beers 2023: strongly anticholinergic and sedating — avoid.' } }),
  D('nortriptyline', 'Nortriptyline', 'N06AA10', ['tca'], { synonyms: ['sensival', 'primox'], sedating: true, serotonergic: true }),
  D('imipramine', 'Imipramine', 'N06AA02', ['tca'], { synonyms: ['depsonil'], sedating: true, serotonergic: true, elderly: { level: 'avoid', note: 'Beers 2023: anticholinergic — avoid.' } }),
  D('fluoxetine', 'Fluoxetine', 'N06AB03', ['ssri'], { synonyms: ['fludac', 'prodep', 'prozac', 'flunil'], nlem: true, serotonergic: true }),
  D('sertraline', 'Sertraline', 'N06AB06', ['ssri'], { synonyms: ['serta', 'daxid', 'serlift', 'zoloft'], nlem: true, serotonergic: true }),
  D('escitalopram', 'Escitalopram', 'N06AB10', ['ssri'], { synonyms: ['nexito', 'cipralex', 'stalopam', 'feliz s'], serotonergic: true, qt: true }),
  D('paroxetine', 'Paroxetine', 'N06AB05', ['ssri'], { synonyms: ['pari', 'paxil'], serotonergic: true, elderly: { level: 'avoid', note: 'Beers 2023: strongly anticholinergic SSRI — avoid.' } }),
  D('fluvoxamine', 'Fluvoxamine', 'N06AB08', ['ssri'], { synonyms: ['fluvoxin', 'luvox'], serotonergic: true }),
  D('duloxetine', 'Duloxetine', 'N06AX21', ['snri'], { synonyms: ['duzela', 'dulane', 'cymbalta'], serotonergic: true }),
  D('venlafaxine', 'Venlafaxine', 'N06AX16', ['snri'], { synonyms: ['venlor', 'effexor'], serotonergic: true }),
  D('mirtazapine', 'Mirtazapine', 'N06AX11', ['antidepressant_other'], { synonyms: ['mirtaz', 'mirt'], sedating: true }),
  D('haloperidol', 'Haloperidol', 'N05AD01', ['antipsychotic'], { synonyms: ['serenace', 'haldol'], nlem: true, qt: true, sedating: true }),
  D('olanzapine', 'Olanzapine', 'N05AH03', ['antipsychotic'], { synonyms: ['oleanz', 'olanex'], nlem: true, sedating: true }),
  D('risperidone', 'Risperidone', 'N05AX08', ['antipsychotic'], { synonyms: ['risdone', 'sizodon'], nlem: true, qt: true }),
  D('quetiapine', 'Quetiapine', 'N05AH04', ['antipsychotic'], { synonyms: ['qutipin', 'seroquel'], sedating: true, qt: true }),
  D('lithium', 'Lithium carbonate', 'N05AN01', ['lithium'], { synonyms: ['lithium carbonate', 'lithosun', 'licab'], nlem: true, highAlert: true, renal: { avoidBelow: 30, adjustBelow: 60, note: 'Renally cleared, narrow therapeutic index: avoid if eGFR < 30; monitor levels.' }, pregnancy: { level: 'avoid', note: 'Ebstein anomaly risk (1st trimester); specialist review.' }, lactation: { level: 'avoid', note: 'Avoid while breastfeeding.' } }),
  D('phenytoin', 'Phenytoin', 'N03AB02', ['antiepileptic'], { synonyms: ['eptoin', 'dilantin', 'phenytoin sodium'], nlem: true, highAlert: true, cyp3a4: 'strong_inducer', pregnancy: { level: 'avoid', note: 'Fetal hydantoin syndrome; specialist review, do not stop abruptly.' } }),
  D('carbamazepine', 'Carbamazepine', 'N03AF01', ['antiepileptic'], { synonyms: ['tegretol', 'mazetol', 'zen retard'], nlem: true, cyp3a4: 'strong_inducer', pregnancy: { level: 'avoid', note: 'Neural tube defects; specialist review, folic acid 5 mg.' } }),
  D('oxcarbazepine', 'Oxcarbazepine', 'N03AF02', ['antiepileptic'], { synonyms: ['oxetol', 'trileptal'] }),
  D('valproate', 'Sodium valproate', 'N03AG01', ['antiepileptic'], { synonyms: ['sodium valproate', 'valproic acid', 'divalproex', 'divalproex sodium', 'valparin', 'encorate', 'epilex', 'dicorate', 'depakote'], nlem: true, hepatotoxic: true, pregnancy: { level: 'contraindicated', note: 'Major teratogen (neural tube defects, ~10% malformations, neurodevelopmental harm); do not use in pregnancy or in women able to conceive without a pregnancy prevention programme.' } }),
  D('levetiracetam', 'Levetiracetam', 'N03AX14', ['antiepileptic'], { synonyms: ['levipil', 'keppra', 'levroxa'], nlem: true, renal: { adjustBelow: 50, note: 'eGFR < 50: reduce dose.' } }),
  D('lamotrigine', 'Lamotrigine', 'N03AX09', ['antiepileptic'], { synonyms: ['lamitor', 'lametec'] }),
  D('phenobarbital', 'Phenobarbital', 'N03AA02', ['antiepileptic'], { synonyms: ['phenobarbitone', 'gardenal'], nlem: true, ndps: true, sedating: true, cyp3a4: 'strong_inducer' }),
  D('topiramate', 'Topiramate', 'N03AX11', ['antiepileptic'], { synonyms: ['topamac', 'topamax'], pregnancy: { level: 'avoid', note: 'Oral clefts; specialist review.' } }),
  D('gabapentin', 'Gabapentin', 'N03AX12', ['antiepileptic'], { synonyms: ['gabapin', 'gabantin', 'neurontin'], sedating: true, renal: { adjustBelow: 60, note: 'Renally cleared: reduce dose if eGFR < 60.' } }),
  D('pregabalin', 'Pregabalin', 'N03AX16', ['antiepileptic'], { synonyms: ['lyrica', 'pregaba', 'pregalin'], sedating: true, maxDailyMg: 600, renal: { adjustBelow: 60, note: 'Renally cleared: reduce dose if eGFR < 60.' } }),
  D('sumatriptan', 'Sumatriptan', 'N02CC01', ['antimigraine'], { synonyms: ['suminat', 'imigran'], serotonergic: true }),
  D('flunarizine', 'Flunarizine', 'N07CA03', ['antivertigo'], { synonyms: ['sibelium', 'flunarin'], sedating: true }),
  D('betahistine', 'Betahistine', 'N07CA01', ['antivertigo'], { synonyms: ['vertin', 'betaserc'] }),
  D('cinnarizine', 'Cinnarizine', 'N07CA02', ['antivertigo'], { synonyms: ['stugeron'], sedating: true }),
  D('prochlorperazine', 'Prochlorperazine', 'N05AB04', ['antiemetic_d2'], { synonyms: ['stemetil'], sedating: true, elderly: { level: 'avoid', note: 'Beers 2023: antipsychotic class — avoid in older adults except for specific indications.' } }),
  D('donepezil', 'Donepezil', 'N06DA02', ['antidementia'], { synonyms: ['donecept', 'aricept'], qt: true }),
  D('levodopa_carbidopa', 'Levodopa + Carbidopa', 'N04BA02', ['antiparkinson'], { synonyms: ['syndopa', 'tidomet', 'sinemet'], nlem: true }),
  D('trihexyphenidyl', 'Trihexyphenidyl', 'N04AA01', ['antiparkinson'], { synonyms: ['pacitane', 'benzhexol'], nlem: true, elderly: { level: 'avoid', note: 'Beers 2023: strongly anticholinergic — avoid.' } }),
  D('disulfiram', 'Disulfiram', 'N07BB01', ['disulfiram_like'], { synonyms: ['esperal', 'antabuse'] }),

  // ── Musculoskeletal ───────────────────────────────────────────────────────
  D('tizanidine', 'Tizanidine', 'M03BX02', ['muscle_relaxant'], { synonyms: ['tizan', 'sirdalud'], sedating: true }),
  D('thiocolchicoside', 'Thiocolchicoside', 'M03BX05', ['muscle_relaxant'], { synonyms: ['myoril', 'thiospa'], pregnancy: { level: 'contraindicated', note: 'Aneugenic metabolite; contraindicated in pregnancy and in women of child-bearing potential without contraception.' }, paed: { minAgeYears: 16, minAgeNote: 'Not under 16 years.' } }),
  D('chlorzoxazone', 'Chlorzoxazone', 'M03BB03', ['muscle_relaxant'], { sedating: true, hepatotoxic: true, elderly: { level: 'avoid', note: 'Beers 2023: muscle relaxants — poorly tolerated (anticholinergic, sedation, falls).' } }),
  D('methocarbamol', 'Methocarbamol', 'M03BA03', ['muscle_relaxant'], { synonyms: ['robinax'], sedating: true, elderly: { level: 'avoid', note: 'Beers 2023: muscle relaxants — avoid.' } }),
  D('baclofen', 'Baclofen', 'M03BX01', ['muscle_relaxant'], { synonyms: ['liofen', 'lioresal'], sedating: true, renal: { adjustBelow: 60, note: 'Encephalopathy in CKD; reduce dose.' } }),
  D('allopurinol', 'Allopurinol', 'M04AA01', ['xanthine_oxidase_inhibitor'], { synonyms: ['zyloric', 'zyloprim'], nlem: true, renal: { adjustBelow: 60, note: 'Start low (e.g. 50–100 mg) and titrate in CKD.' } }),
  D('febuxostat', 'Febuxostat', 'M04AA03', ['xanthine_oxidase_inhibitor'], { synonyms: ['febutaz', 'zurig', 'febucip'] }),
  D('colchicine', 'Colchicine', 'M04AC01', ['antigout'], { synonyms: ['zycolchin', 'goutnil'], nlem: true, renal: { adjustBelow: 50, note: 'Reduce dose in CKD; avoid with strong CYP3A4/P-gp inhibitors.' } }),
  D('glucosamine', 'Glucosamine', 'M01AX05', [], { synonyms: ['glucosamine sulphate', 'glucosamine sulfate'] }),

  // ── Minerals and vitamins ─────────────────────────────────────────────────
  D('calcium_carbonate', 'Calcium carbonate', 'A12AA04', ['calcium'], { synonyms: ['calcium', 'calcium carbonate', 'calcium citrate', 'shelcal', 'calcimax', 'ccm', 'cipcal'], nlem: true }),
  D('cholecalciferol', 'Cholecalciferol (vitamin D3)', 'A11CC05', ['vitamin_d'], { synonyms: ['vitamin d3', 'vitamin d', 'calcirol', 'uprise d3', 'd-rise', 'arachitol'], nlem: true }),
  D('ferrous_sulfate', 'Ferrous salt (oral iron)', 'B03AA07', ['iron'], { synonyms: ['ferrous sulphate', 'ferrous sulfate', 'ferrous fumarate', 'iron', 'oral iron', 'livogen', 'autrin', 'orofer', 'dexorange', 'iron folic acid', 'ifa'], nlem: true }),
  D('folic_acid', 'Folic acid', 'B03BB01', ['folate'], { synonyms: ['folate', 'folvite'], nlem: true }),
  D('cyanocobalamin', 'Vitamin B12', 'B03BA01', ['vitamin_b12'], { synonyms: ['vitamin b12', 'methylcobalamin', 'mecobalamin', 'cyanocobalamin', 'nurokind', 'methycobal'] }),
  D('potassium_chloride', 'Potassium chloride', 'A12BA01', ['potassium_supplement'], { synonyms: ['kcl', 'potklor'], nlem: true, highAlert: true, renal: { adjustBelow: 30, note: 'Hyperkalaemia risk in CKD; monitor potassium.' } }),

  // ── Urology, women's health ───────────────────────────────────────────────
  D('tamsulosin', 'Tamsulosin', 'G04CA02', ['alpha_blocker_urological'], { synonyms: ['urimax', 'veltam', 'flomax'], nlem: true }),
  D('finasteride', 'Finasteride', 'G04CB01', ['five_ari'], { synonyms: ['finast', 'fincar', 'proscar'], pregnancy: { level: 'contraindicated', note: 'Feminisation of a male fetus; pregnant women should not handle crushed tablets.' } }),
  D('oxybutynin', 'Oxybutynin', 'G04BD04', ['antimuscarinic_urological'], { synonyms: ['cystran', 'oxyspas'], elderly: { level: 'avoid', note: 'Beers 2023: strongly anticholinergic — avoid.' } }),
  D('tolterodine', 'Tolterodine', 'G04BD07', ['antimuscarinic_urological'], { synonyms: ['roliten', 'detrol'] }),
  D('flavoxate', 'Flavoxate', 'G04BD02', ['antimuscarinic_urological'], { synonyms: ['urispas'] }),
  D('combined_oc', 'Combined oral contraceptive (ethinylestradiol + levonorgestrel)', 'G03AA07', ['combined_oral_contraceptive'], { synonyms: ['oral contraceptive', 'ocp', 'oral contraceptive pill', 'ethinylestradiol + levonorgestrel', 'levonorgestrel + ethinylestradiol', 'ethinylestradiol', 'mala-d', 'mala d', 'ovral', 'ovral-l', 'loette', 'yasmin', 'novelon'], nlem: true, pregnancy: { level: 'avoid', note: 'Stop if pregnancy is confirmed.' }, lactation: { level: 'caution', note: 'Combined pills reduce milk supply in the first 6 weeks; prefer progestogen-only.' } }),
  D('medroxyprogesterone', 'Medroxyprogesterone', 'G03DA02', ['progestogen'], { synonyms: ['meprate', 'depo-provera', 'antara'], nlem: true }),
  D('norethisterone', 'Norethisterone', 'G03DC02', ['progestogen'], { synonyms: ['primolut-n', 'regestrone'], nlem: true, pregnancy: { level: 'avoid', note: 'Virilisation of a female fetus.' } }),
  D('dydrogesterone', 'Dydrogesterone', 'G03DB01', ['progestogen'], { synonyms: ['duphaston'] }),
  D('progesterone', 'Progesterone (micronised)', 'G03DA04', ['progestogen'], { synonyms: ['susten', 'naturogest'] }),
  D('misoprostol', 'Misoprostol', 'G02AD06', ['uterotonic'], { synonyms: ['cytotec', 'misoprost', 'cytolog'], nlem: true, pregnancy: { level: 'contraindicated', note: 'Uterotonic: causes abortion and fetal anomalies (outside a supervised obstetric indication).' } }),
  D('clomiphene', 'Clomifene', 'G03GB02', ['ovulation_inducer'], { synonyms: ['clomiphene citrate', 'clomid', 'fertyl', 'siphene'], pregnancy: { level: 'contraindicated', note: 'Contraindicated in pregnancy.' } }),
  D('tranexamic_acid', 'Tranexamic acid', 'B02AA02', ['antifibrinolytic'], { synonyms: ['pause', 'trapic', 'cyklokapron'], nlem: true, renal: { adjustBelow: 50, note: 'Reduce dose in CKD.' } }),
  D('mifepristone', 'Mifepristone', 'G03XB01', [], { synonyms: ['mifegest'], pregnancy: { level: 'contraindicated', note: 'Abortifacient — only under the MTP Act protocol.' } }),

  // ── Immunology, dermatology ───────────────────────────────────────────────
  D('methotrexate', 'Methotrexate', 'L04AX03', ['antimetabolite', 'immunosuppressant'], { synonyms: ['folitrax', 'imutrex', 'trexall', 'mtx'], nlem: true, highAlert: true, hepatotoxic: true, pregnancy: { level: 'contraindicated', note: 'Abortifacient and teratogen; contraindicated (stop 3 months before conception).' }, lactation: { level: 'avoid', note: 'Contraindicated while breastfeeding.' }, renal: { avoidBelow: 30, adjustBelow: 60, note: 'Avoid if eGFR < 30; reduce dose if 30–60.' } }),
  D('azathioprine', 'Azathioprine', 'L04AX01', ['immunosuppressant'], { synonyms: ['azoran', 'imuran'], nlem: true, highAlert: true }),
  D('leflunomide', 'Leflunomide', 'L04AA13', ['immunosuppressant'], { synonyms: ['lefno', 'arava'], hepatotoxic: true, pregnancy: { level: 'contraindicated', note: 'Teratogenic; washout required before conception.' } }),
  D('mycophenolate', 'Mycophenolate mofetil', 'L04AA06', ['immunosuppressant'], { synonyms: ['cellcept', 'mycept'], pregnancy: { level: 'contraindicated', note: 'Teratogenic (pregnancy loss, malformations).' } }),
  D('tacrolimus', 'Tacrolimus', 'L04AD02', ['immunosuppressant'], { synonyms: ['pangraf', 'tacrograf'], highAlert: true }),
  D('cyclosporine', 'Ciclosporin', 'L04AD01', ['immunosuppressant'], { synonyms: ['cyclosporine', 'ciclosporin', 'sandimmun', 'panimun'], highAlert: true }),
  D('isotretinoin', 'Isotretinoin', 'D10BA01', ['retinoid'], { synonyms: ['isotroin', 'sotret', 'accutane'], pregnancy: { level: 'contraindicated', note: 'Potent teratogen; pregnancy must be excluded and prevented.' } }),
  D('acitretin', 'Acitretin', 'D05BB02', ['retinoid'], { synonyms: ['acetec', 'acitrin'], pregnancy: { level: 'contraindicated', note: 'Teratogen; avoid pregnancy for 3 years after stopping.' } }),

  // ── Vaccines and immunoglobulins (post-exposure prophylaxis) ──────────────
  // 'ARV' is deliberately not a synonym: in Indian prescriptions it also means antiretrovirals.
  D('rabies_vaccine', 'Rabies vaccine (cell culture)', 'J07BG01', ['vaccine'], { synonyms: ['anti-rabies vaccine', 'anti rabies vaccine', 'rabies vaccine', 'rabipur', 'verorab', 'abhayrab', 'indirab', 'vaxirab', 'rabivax-s', 'rabivax'], nlem: true }),
  D('rabies_immunoglobulin', 'Rabies immunoglobulin', 'J06BB05', ['immunoglobulin'], { synonyms: ['erig', 'hrig', 'equine rabies immunoglobulin', 'human rabies immunoglobulin', 'equirab', 'kamrab', 'berirab'], nlem: true }),
  D('td_vaccine', 'Tetanus and diphtheria toxoids (Td)', 'J07AM51', ['vaccine'], { synonyms: ['td', 'td vaccine', 'tetanus toxoid', 'tt', 'tt injection', 'tetanus vaccine'], nlem: true }),

  // ── Common branded combinations (resolved to their components) ───────────
  FDC('ibuprofen_paracetamol', 'Ibuprofen + Paracetamol', ['ibuprofen', 'paracetamol'], ['combiflam', 'ibugesic plus', 'flexon'], { fdcStrengthsMg: [400, 325] }),
  FDC('aceclofenac_paracetamol', 'Aceclofenac + Paracetamol', ['aceclofenac', 'paracetamol'], ['zerodol-p', 'zerodol p', 'hifenac-p', 'acenac-p'], { fdcStrengthsMg: [100, 325] }),
  FDC('aceclofenac_paracetamol_serratiopeptidase', 'Aceclofenac + Paracetamol + Serratiopeptidase', ['aceclofenac', 'paracetamol'], ['zerodol-sp', 'zerodol sp', 'hifenac-d']),
  FDC('diclofenac_paracetamol', 'Diclofenac + Paracetamol', ['diclofenac', 'paracetamol'], ['dynapar-plus', 'voveran-p']),
  FDC('tramadol_paracetamol', 'Tramadol + Paracetamol', ['tramadol', 'paracetamol'], ['ultracet', 'dolotram', 'tramazac-p']),
  FDC('telmisartan_hctz', 'Telmisartan + Hydrochlorothiazide', ['telmisartan', 'hydrochlorothiazide'], ['telma-h', 'telma h', 'telsar-h']),
  FDC('telmisartan_amlodipine', 'Telmisartan + Amlodipine', ['telmisartan', 'amlodipine'], ['telma-am', 'telma am', 'telmikind-am']),
  FDC('losartan_hctz', 'Losartan + Hydrochlorothiazide', ['losartan', 'hydrochlorothiazide'], ['losar-h', 'repace-h']),
  FDC('atorvastatin_aspirin', 'Atorvastatin + Aspirin', ['atorvastatin', 'aspirin'], ['ecosprin-av', 'ecosprin av']),
  FDC('aspirin_clopidogrel', 'Aspirin + Clopidogrel', ['aspirin', 'clopidogrel'], ['clopilet-a', 'deplatt-a', 'ecosprin gold']),
  FDC('amoxicillin_dicloxacillin', 'Amoxicillin + Dicloxacillin', ['amoxicillin', 'cloxacillin'], ['novaclox']),
  FDC('ofloxacin_ornidazole', 'Ofloxacin + Ornidazole', ['ofloxacin', 'ornidazole'], ['oflox-oz', 'o2', 'zanocin-oz']),
  FDC('norfloxacin_tinidazole', 'Norfloxacin + Tinidazole', ['norfloxacin', 'tinidazole'], ['norflox-tz', 'norflox tz']),
  FDC('cefixime_ofloxacin', 'Cefixime + Ofloxacin', ['cefixime', 'ofloxacin'], ['zifi-o', 'taxim-of']),
  FDC('calcium_vitd', 'Calcium carbonate + Vitamin D3', ['calcium_carbonate', 'cholecalciferol'], ['shelcal 500', 'shelcal-500', 'calcimax-p', 'ccm', 'cipcal 500']),
  FDC('paracetamol_phenylephrine_cpm', 'Paracetamol + Phenylephrine + Chlorphenamine', ['paracetamol', 'phenylephrine', 'chlorpheniramine'], ['sinarest', 'coldact', 'd-cold total', 'cheston cold']),
  FDC('levocetirizine_ambroxol', 'Levocetirizine + Ambroxol', ['levocetirizine', 'ambroxol'], []),
  FDC('cpm_codeine', 'Chlorphenamine + Codeine', ['chlorpheniramine', 'codeine'], ['codeine syrup', 'corex', 'phensedyl'])
];

const BY_ID = new Map(DRUG_CONCEPTS.map(c => [c.id, c]));
export const drugById = (id: string): DrugConcept | undefined => BY_ID.get(id);
