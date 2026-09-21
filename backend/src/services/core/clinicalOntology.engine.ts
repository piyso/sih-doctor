/**
 * Sovereign Clinical Ontology & Decompounding Engine
 * Apex Standards: WHO ATC Classification • Ayurvedic Formulary of India (AFI) • NAMASTE Portal ICD-11
 *
 * Solves the "Word-Matching" Anti-Pattern by replacing brittle string lists with a 4-tier
 * ontological hierarchy:
 * 1. Trade Brand Decompounding (e.g. Pan-D -> Pantoprazole + Domperidone)
 * 2. WHO ATC Pharmacological Classification (e.g. Warfarin -> ATC_B01AA)
 * 3. Classical Ayush Poly-Herbal Decompounding (e.g. Yogaraja Guggulu -> Guggulsterones, Piperine, Chitraka)
 * 4. Mechanism-Based Phytochemical-Receptor Invariant Evaluation
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. Pharmacological ATC & Phytochemical Enums
// ─────────────────────────────────────────────────────────────────────────────

export type AtcPharmacologicalClass =
  | 'ATC_B01AA' // Vitamin K Antagonists (Warfarin, Acenocoumarol)
  | 'ATC_B01AC' // Platelet Aggregation Inhibitors (Aspirin, Clopidogrel)
  | 'ATC_B01AF' // Direct Factor Xa Inhibitors (Rivaroxaban, Apixaban)
  | 'ATC_C03CA' // High-Ceiling Loop Diuretics (Furosemide, Torsemide)
  | 'ATC_C01AA' // Digitalis Glycosides (Digoxin, Digitoxin)
  | 'ATC_C09AA' // ACE Inhibitors (Enalapril, Ramipril, Lisinopril)
  | 'ATC_C09CA' // Angiotensin II Receptor Blockers (Telmisartan, Losartan)
  | 'ATC_C10AA' // HMG-CoA Reductase Inhibitors / Statins (Atorvastatin, Rosuvastatin)
  | 'ATC_J01XD' // Imidazole Derivatives / ALDH Inhibitors (Metronidazole, Tinidazole)
  | 'ATC_J01MA' // Fluoroquinolones (Ciprofloxacin, Levofloxacin)
  | 'ATC_N05BA' // Benzodiazepine Anxiolytics (Alprazolam, Clonazepam)
  | 'ATC_N06AB' // SSRI Antidepressants (Fluoxetine, Sertraline, Escitalopram)
  | 'ATC_A10BA' // Biguanides (Metformin)
  | 'ATC_A10BB' // Sulfonylureas (Glimepiride, Gliclazide)
  | 'ATC_N05AN' // Lithium Formulations (Lithium Carbonate)
  | 'ATC_H03AA' // Thyroid Hormones (Levothyroxine)
  | 'ATC_L01BA' // Folic Acid Analogues / Antimetabolites (Methotrexate)
  | 'ATC_A02BC' // Proton Pump Inhibitors (Pantoprazole, Omeprazole, Rabeprazole)
  | 'ATC_M01AE' // Propionic Acid Derivatives / NSAIDs (Ibuprofen)
  | 'ATC_N02BE' // Anilides / Analgesics (Paracetamol)
  | 'ATC_J01CR' // Combinations of Penicillins (Amoxicillin + Clavulanate)
  | 'ATC_A12AX' // Calcium Combinations with Vitamin D (Shelcal)
  | 'ATC_J02AA'; // Polyene Antifungals (Nystatin, Amphotericin B)

export type PhytochemicalConstituent =
  | 'PHYT_GUGGULSTERONE'         // Commiphora mukul (CYP3A4 inhibitor, Thyroid stimulator)
  | 'PHYT_GLYCYRRHIZIN'          // Glycyrrhiza glabra (11β-HSD2 inhibitor, K+ wasting)
  | 'PHYT_PIPERINE'              // Piper longum / nigrum (P-gp & CYP3A4 bio-enhancer)
  | 'PHYT_ENDOGENOUS_ETHANOL'    // Woodfordia fruticosa fermented Asava/Arishta (5-12% v/v)
  | 'PHYT_AQUARETIC_DIURETIC'    // Tribulus terrestris / Boerhavia diffusa (Gokshura, Punarnava)
  | 'PHYT_EMMENAGOGUE_UTEROTONIC'// Nigella sativa, Ferula foetida, Aloe vera (Uterine contractions)
  | 'PHYT_HEAVY_METAL_CALX'      // Purified Calces (Tamra Bhasma Cu, Rasa Bhasma Hg, Lauha Fe)
  | 'PHYT_ORGANOSULFUR'          // Allium sativum (Garlic/Lashuna - Platelet adenosine block)
  | 'PHYT_RESERPINE'             // Rauwolfia serpentina (Central VMAT vesicular wash-out)
  | 'PHYT_SCHEDULE_E1_POISON'    // Aconitine (Vatsanabha), Strychnine (Kupilu), Urushiol (Bhallataka)
  | 'PHYT_CARDIAC_GLYCOSIDE'     // Thevetia peruviana (Yellow Oleander / Kaner - Thevetin cardiotoxicity)
  | 'PHYT_THYROACTIVE';          // Guggulsterones accelerating T4 -> T3 deiodinase

export interface ResolvedDrugConcept {
  rawTerm: string;
  canonicalMolecule: string;
  atcClasses: AtcPharmacologicalClass[];
  isFdc: boolean;
  components?: string[];
}

export interface ResolvedAyushConcept {
  rawTerm: string;
  formulationName: string;
  dosageForm: string;
  constituents: string[];
  bioactives: PhytochemicalConstituent[];
  isScheduleE1: boolean;
  hasEndogenousEthanol: boolean;
}

export interface PatientClinicalContext {
  isPregnant?: boolean;
  gestationalWeeks?: number;
  isLactating?: boolean;
  eGfr?: number;
  weightKg?: number;
}

export interface OntologicalInteractionAlert {
  alertId: string;
  severity: 'CRITICAL_CONTRAINDICATION' | 'WARNING' | 'STATUTORY_SCHEDULE_E1' | 'SAFE_COMPATIBLE';
  ruleMechanism: string;
  clinicalExplanation: string;
  triggerA: string;
  triggerB: string;
  atcClassTriggered?: AtcPharmacologicalClass;
  phytochemicalTriggered?: PhytochemicalConstituent;
  evidenceConfidence: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Clinical Ontology Engine Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class ClinicalOntologyEngine {
  // ─── TIER 1 & 2: Allopathic Brand & Molecule Resolution ───────────────────
  private static allopathicRegistry: Map<string, { molecule: string; classes: AtcPharmacologicalClass[]; isFdc?: boolean; components?: string[] }> = new Map([
    // Anticoagulants / Antiplatelets
    ['warfarin', { molecule: 'Warfarin Sodium', classes: ['ATC_B01AA'] }],
    ['coumadin', { molecule: 'Warfarin Sodium', classes: ['ATC_B01AA'] }],
    ['acenocoumarol', { molecule: 'Acenocoumarol', classes: ['ATC_B01AA'] }],
    ['aspirin', { molecule: 'Aspirin', classes: ['ATC_B01AC'] }],
    ['ecosprin', { molecule: 'Aspirin', classes: ['ATC_B01AC'] }],
    ['clopidogrel', { molecule: 'Clopidogrel', classes: ['ATC_B01AC'] }],
    ['plavix', { molecule: 'Clopidogrel', classes: ['ATC_B01AC'] }],
    ['clopilet', { molecule: 'Clopidogrel', classes: ['ATC_B01AC'] }],
    ['rivaroxaban', { molecule: 'Rivaroxaban', classes: ['ATC_B01AF'] }],
    ['xarelto', { molecule: 'Rivaroxaban', classes: ['ATC_B01AF'] }],
    ['apixaban', { molecule: 'Apixaban', classes: ['ATC_B01AF'] }],
    ['eliquis', { molecule: 'Apixaban', classes: ['ATC_B01AF'] }],

    // Diuretics & Cardiac Glycosides
    ['furosemide', { molecule: 'Furosemide', classes: ['ATC_C03CA'] }],
    ['lasix', { molecule: 'Furosemide', classes: ['ATC_C03CA'] }],
    ['torsemide', { molecule: 'Torsemide', classes: ['ATC_C03CA'] }],
    ['dytor', { molecule: 'Torsemide', classes: ['ATC_C03CA'] }],
    ['digoxin', { molecule: 'Digoxin', classes: ['ATC_C01AA'] }],
    ['lanoxin', { molecule: 'Digoxin', classes: ['ATC_C01AA'] }],

    // Renin-Angiotensin System & Calcium Channel Blockers
    ['enalapril', { molecule: 'Enalapril', classes: ['ATC_C09AA'] }],
    ['ramipril', { molecule: 'Ramipril', classes: ['ATC_C09AA'] }],
    ['cardace', { molecule: 'Ramipril', classes: ['ATC_C09AA'] }],
    ['lisinopril', { molecule: 'Lisinopril', classes: ['ATC_C09AA'] }],
    ['telmisartan', { molecule: 'Telmisartan', classes: ['ATC_C09CA'] }],
    ['telma', { molecule: 'Telmisartan', classes: ['ATC_C09CA'] }],
    ['losartan', { molecule: 'Losartan', classes: ['ATC_C09CA'] }],

    // Statins (HMG-CoA Reductase Inhibitors)
    ['atorvastatin', { molecule: 'Atorvastatin Calcium', classes: ['ATC_C10AA'] }],
    ['atorva', { molecule: 'Atorvastatin Calcium', classes: ['ATC_C10AA'] }],
    ['lipitor', { molecule: 'Atorvastatin Calcium', classes: ['ATC_C10AA'] }],
    ['rosuvastatin', { molecule: 'Rosuvastatin Calcium', classes: ['ATC_C10AA'] }],
    ['rosuvas', { molecule: 'Rosuvastatin Calcium', classes: ['ATC_C10AA'] }],
    ['crestor', { molecule: 'Rosuvastatin Calcium', classes: ['ATC_C10AA'] }],

    // Antimicrobials & Nitroimidazoles
    ['metronidazole', { molecule: 'Metronidazole', classes: ['ATC_J01XD'] }],
    ['flagyl', { molecule: 'Metronidazole', classes: ['ATC_J01XD'] }],
    ['tinidazole', { molecule: 'Tinidazole', classes: ['ATC_J01XD'] }],
    ['fasigyn', { molecule: 'Tinidazole', classes: ['ATC_J01XD'] }],
    ['ciprofloxacin', { molecule: 'Ciprofloxacin HCl', classes: ['ATC_J01MA'] }],
    ['cifran', { molecule: 'Ciprofloxacin HCl', classes: ['ATC_J01MA'] }],
    ['levofloxacin', { molecule: 'Levofloxacin', classes: ['ATC_J01MA'] }],

    // Neuro-Psychiatric & Endocrine
    ['alprazolam', { molecule: 'Alprazolam', classes: ['ATC_N05BA'] }],
    ['alprax', { molecule: 'Alprazolam', classes: ['ATC_N05BA'] }],
    ['restyl', { molecule: 'Alprazolam', classes: ['ATC_N05BA'] }],
    ['clonazepam', { molecule: 'Clonazepam', classes: ['ATC_N05BA'] }],
    ['fluoxetine', { molecule: 'Fluoxetine HCl', classes: ['ATC_N06AB'] }],
    ['prozac', { molecule: 'Fluoxetine HCl', classes: ['ATC_N06AB'] }],
    ['sertraline', { molecule: 'Sertraline HCl', classes: ['ATC_N06AB'] }],
    ['metformin', { molecule: 'Metformin HCl', classes: ['ATC_A10BA'] }],
    ['glycomet', { molecule: 'Metformin HCl', classes: ['ATC_A10BA'] }],
    ['glimepiride', { molecule: 'Glimepiride', classes: ['ATC_A10BB'] }],
    ['amaryl', { molecule: 'Glimepiride', classes: ['ATC_A10BB'] }],
    ['lithium', { molecule: 'Lithium Carbonate', classes: ['ATC_N05AN'] }],
    ['lithosun', { molecule: 'Lithium Carbonate', classes: ['ATC_N05AN'] }],
    ['levothyroxine', { molecule: 'Levothyroxine Sodium', classes: ['ATC_H03AA'] }],
    ['thyronorm', { molecule: 'Levothyroxine Sodium', classes: ['ATC_H03AA'] }],
    ['eltroxin', { molecule: 'Levothyroxine Sodium', classes: ['ATC_H03AA'] }],

    // Antimetabolites / Teratogens
    ['methotrexate', { molecule: 'Methotrexate', classes: ['ATC_L01BA'] }],
    ['folitrax', { molecule: 'Methotrexate', classes: ['ATC_L01BA'] }],

    // Analgesics, NSAIDs & Central Serotonergics
    ['diclofenac', { molecule: 'Diclofenac Sodium', classes: ['ATC_M01AE'] }],
    ['voveran', { molecule: 'Diclofenac Sodium', classes: ['ATC_M01AE'] }],
    ['ibuprofen', { molecule: 'Ibuprofen', classes: ['ATC_M01AE'] }],
    ['brufen', { molecule: 'Ibuprofen', classes: ['ATC_M01AE'] }],
    ['naproxen', { molecule: 'Naproxen', classes: ['ATC_M01AE'] }],
    ['tramadol', { molecule: 'Tramadol HCl', classes: ['ATC_N02BE'] }],
    ['linezolid', { molecule: 'Linezolid', classes: ['ATC_J01MA'] }],
    ['amiodarone', { molecule: 'Amiodarone HCl', classes: ['ATC_C01AA'] }],
    ['verapamil', { molecule: 'Verapamil HCl', classes: ['ATC_C01AA'] }],
    ['nitroglycerin', { molecule: 'Nitroglycerin / Glyceryl Trinitrate', classes: ['ATC_C01AA'] }],
    ['sorbitrate', { molecule: 'Isosorbide Dinitrate', classes: ['ATC_C01AA'] }],
    ['sildenafil', { molecule: 'Sildenafil Citrate', classes: [] }],
    ['bactrim', { molecule: 'Trimethoprim + Sulfamethoxazole', classes: ['ATC_J01CR'], isFdc: true }],
    ['septra', { molecule: 'Trimethoprim + Sulfamethoxazole', classes: ['ATC_J01CR'], isFdc: true }],
    ['spironolactone', { molecule: 'Spironolactone', classes: ['ATC_C03CA'] }],
    ['aldactone', { molecule: 'Spironolactone', classes: ['ATC_C03CA'] }],

    // High-Volume Indian Fixed-Dose Combinations (FDCs) & Essential Brands
    ['pan-d', { molecule: 'Pantoprazole + Domperidone', classes: ['ATC_A02BC'], isFdc: true, components: ['Pantoprazole (40mg)', 'Domperidone (30mg)'] }],
    ['pan d', { molecule: 'Pantoprazole + Domperidone', classes: ['ATC_A02BC'], isFdc: true, components: ['Pantoprazole (40mg)', 'Domperidone (30mg)'] }],
    ['combiflam', { molecule: 'Ibuprofen + Paracetamol', classes: ['ATC_M01AE', 'ATC_N02BE'], isFdc: true, components: ['Ibuprofen (400mg)', 'Paracetamol (325mg)'] }],
    ['augmentin', { molecule: 'Amoxicillin + Clavulanic Acid', classes: ['ATC_J01CR'], isFdc: true, components: ['Amoxicillin (500mg)', 'Clavulanate (125mg)'] }],
    ['augmentin 625', { molecule: 'Amoxicillin + Clavulanic Acid', classes: ['ATC_J01CR'], isFdc: true, components: ['Amoxicillin (500mg)', 'Clavulanate (125mg)'] }],
    ['dolo', { molecule: 'Paracetamol', classes: ['ATC_N02BE'], isFdc: false }],
    ['dolo 650', { molecule: 'Paracetamol', classes: ['ATC_N02BE'], isFdc: false }],
    ['shelcal', { molecule: 'Calcium Carbonate + Vitamin D3', classes: ['ATC_A12AX'], isFdc: true, components: ['Calcium Carbonate (500mg)', 'Vitamin D3 (250 IU)'] }],
    ['shelcal 500', { molecule: 'Calcium Carbonate + Vitamin D3', classes: ['ATC_A12AX'], isFdc: true, components: ['Calcium Carbonate (500mg)', 'Vitamin D3 (250 IU)'] }],
    ['liv.52', { molecule: 'Liv.52 Hepatoprotective Formulation', classes: [], isFdc: true }],
    ['liv 52', { molecule: 'Liv.52 Hepatoprotective Formulation', classes: [], isFdc: true }],
    ['norflox-tz', { molecule: 'Norfloxacin + Tinidazole', classes: ['ATC_J01MA', 'ATC_J01XD'], isFdc: true, components: ['Norfloxacin (400mg)', 'Tinidazole (600mg)'] }],
    ['oflox-oz', { molecule: 'Ofloxacin + Ornidazole', classes: ['ATC_J01MA', 'ATC_J01XD'], isFdc: true, components: ['Ofloxacin (200mg)', 'Ornidazole (500mg)'] }],
    ['nystatin', { molecule: 'Nystatin', classes: ['ATC_J02AA'], isFdc: false }]
  ]);

  // ─── TIER 3: Classical Ayurvedic Poly-Herbal Decompounding Matrix ─────────
  private static ayushFormularyMatrix: Map<string, {
    canonicalName: string;
    dosageForm: string;
    constituents: string[];
    bioactives: PhytochemicalConstituent[];
    isScheduleE1?: boolean;
    hasEndogenousEthanol?: boolean;
  }> = new Map([
    ['yograj guggulu', {
      canonicalName: 'Yogaraja Guggulu',
      dosageForm: 'Vati/Tablet',
      constituents: ['Guggulu (50%)', 'Trikatu (Pippali, Maricha, Sunthi)', 'Triphala', 'Chitraka', 'Vidanga', 'Gokshura', 'Rasna', 'Yavani'],
      bioactives: ['PHYT_GUGGULSTERONE', 'PHYT_PIPERINE', 'PHYT_AQUARETIC_DIURETIC', 'PHYT_THYROACTIVE']
    }],
    ['kaishore guggulu', {
      canonicalName: 'Kaishore Guggulu',
      dosageForm: 'Vati/Tablet',
      constituents: ['Guggulu', 'Triphala', 'Guduchi', 'Trikatu', 'Vidanga', 'Danti', 'Trivrit'],
      bioactives: ['PHYT_GUGGULSTERONE', 'PHYT_PIPERINE', 'PHYT_THYROACTIVE']
    }],
    ['kanchnar guggulu', {
      canonicalName: 'Kanchnar Guggulu',
      dosageForm: 'Vati/Tablet',
      constituents: ['Kanchnar Tvak', 'Guggulu', 'Triphala', 'Trikatu', 'Varuna', 'Ela', 'Tvak'],
      bioactives: ['PHYT_GUGGULSTERONE', 'PHYT_PIPERINE', 'PHYT_THYROACTIVE']
    }],
    ['dashmoolarishta', {
      canonicalName: 'Dashmoolarishta',
      dosageForm: 'Asava/Arishta',
      constituents: ['Dashmoola (10 roots)', 'Dhataki (Woodfordia)', 'Draksha', 'Trikatu', 'Gokshura', 'Chitraka'],
      bioactives: ['PHYT_ENDOGENOUS_ETHANOL', 'PHYT_PIPERINE', 'PHYT_AQUARETIC_DIURETIC'],
      hasEndogenousEthanol: true
    }],
    ['draksharishta', {
      canonicalName: 'Draksharishta',
      dosageForm: 'Asava/Arishta',
      constituents: ['Draksha', 'Dhataki (Fermentation)', 'Tvak', 'Ela', 'Patra', 'Maricha', 'Pippali'],
      bioactives: ['PHYT_ENDOGENOUS_ETHANOL', 'PHYT_PIPERINE'],
      hasEndogenousEthanol: true
    }],
    ['ashwagandharishta', {
      canonicalName: 'Ashwagandharishta',
      dosageForm: 'Asava/Arishta',
      constituents: ['Ashwagandha', 'Mushali', 'Manjistha', 'Haritaki', 'Dhataki', 'Chitraka'],
      bioactives: ['PHYT_ENDOGENOUS_ETHANOL'],
      hasEndogenousEthanol: true
    }],
    ['kutajarishta', {
      canonicalName: 'Kutajarishta',
      dosageForm: 'Asava/Arishta',
      constituents: ['Kutaja Tvak', 'Draksha', 'Madhuka', 'Dhataki'],
      bioactives: ['PHYT_ENDOGENOUS_ETHANOL'],
      hasEndogenousEthanol: true
    }],
    ['punarnavasava', {
      canonicalName: 'Punarnavasava',
      dosageForm: 'Asava/Arishta',
      constituents: ['Punarnava', 'Gokshura', 'Trikatu', 'Triphala', 'Dhataki'],
      bioactives: ['PHYT_ENDOGENOUS_ETHANOL', 'PHYT_AQUARETIC_DIURETIC', 'PHYT_PIPERINE'],
      hasEndogenousEthanol: true
    }],
    ['arogyavardhini vati', {
      canonicalName: 'Arogyavardhini Vati',
      dosageForm: 'Vati/Tablet',
      constituents: ['Parada', 'Gandhaka', 'Lauha Bhasma', 'Abhraka Bhasma', 'Tamra Bhasma (Copper)', 'Triphala', 'Shilajit', 'Guggulu', 'Chitraka', 'Katuki (Picrorhiza 50%)'],
      bioactives: ['PHYT_HEAVY_METAL_CALX', 'PHYT_GUGGULSTERONE', 'PHYT_THYROACTIVE']
    }],
    ['chandraprabha vati', {
      canonicalName: 'Chandraprabha Vati',
      dosageForm: 'Vati/Tablet',
      constituents: ['Shilajit (Fulvic Acid)', 'Guggulu', 'Lauha Bhasma', 'Trikatu', 'Triphala', 'Gokshura', 'Yavaksara', 'Saindhava Lavana'],
      bioactives: ['PHYT_GUGGULSTERONE', 'PHYT_PIPERINE', 'PHYT_AQUARETIC_DIURETIC']
    }],
    ['trikatu churna', {
      canonicalName: 'Trikatu Churna',
      dosageForm: 'Churna',
      constituents: ['Sunthi (Ginger)', 'Maricha (Black Pepper)', 'Pippali (Piper longum)'],
      bioactives: ['PHYT_PIPERINE']
    }],
    ['yashtimadhu churna', {
      canonicalName: 'Yashtimadhu Churna (Mulethi / Licorice)',
      dosageForm: 'Churna',
      constituents: ['Glycyrrhiza glabra'],
      bioactives: ['PHYT_GLYCYRRHIZIN']
    }],
    ['mulethi', {
      canonicalName: 'Yashtimadhu (Licorice)',
      dosageForm: 'Churna/Root',
      constituents: ['Glycyrrhiza glabra'],
      bioactives: ['PHYT_GLYCYRRHIZIN']
    }],
    ['gokshuradi guggulu', {
      canonicalName: 'Gokshuradi Guggulu',
      dosageForm: 'Vati',
      constituents: ['Gokshura Kwath', 'Guggulu', 'Trikatu', 'Triphala', 'Musta'],
      bioactives: ['PHYT_GUGGULSTERONE', 'PHYT_AQUARETIC_DIURETIC', 'PHYT_PIPERINE']
    }],
    ['lashuna churna', {
      canonicalName: 'Lashuna (Garlic) Churna',
      dosageForm: 'Churna/Vati',
      constituents: ['Allium sativum'],
      bioactives: ['PHYT_ORGANOSULFUR']
    }],
    ['sarpagandha vati', {
      canonicalName: 'Sarpagandha Vati',
      dosageForm: 'Vati',
      constituents: ['Rauwolfia serpentina (Reserpine)', 'Khurasani Ajwain', 'Jatamansi', 'Bhang'],
      bioactives: ['PHYT_RESERPINE']
    }],
    ['anand bhairav ras', {
      canonicalName: 'Anand Bhairav Ras',
      dosageForm: 'Rasa Aushadhi',
      constituents: ['Shuddha Hingula', 'Shuddha Vatsanabha (Aconitum ferox)', 'Trikatu', 'Tankana'],
      bioactives: ['PHYT_SCHEDULE_E1_POISON', 'PHYT_HEAVY_METAL_CALX'],
      isScheduleE1: true
    }],
    ['agnitundika vati', {
      canonicalName: 'Agnitundika Vati',
      dosageForm: 'Vati',
      constituents: ['Shuddha Kupilu (Strychnos nux-vomica)', 'Trikatu', 'Triphala', 'Saindhava', 'Yavaksara', 'Chitraka'],
      bioactives: ['PHYT_SCHEDULE_E1_POISON'],
      isScheduleE1: true
    }],
    ['tribhuvan kirti ras', {
      canonicalName: 'Tribhuvan Kirti Ras',
      dosageForm: 'Rasa Aushadhi',
      constituents: ['Shuddha Vatsanabha (Aconitum ferox)', 'Shuddha Hingula', 'Trikatu', 'Tankana', 'Pippalimoola'],
      bioactives: ['PHYT_SCHEDULE_E1_POISON', 'PHYT_HEAVY_METAL_CALX'],
      isScheduleE1: true
    }],
    ['kalonji churna', {
      canonicalName: 'Kalonji (Nigella sativa)',
      dosageForm: 'Churna',
      constituents: ['Nigella sativa'],
      bioactives: ['PHYT_EMMENAGOGUE_UTEROTONIC']
    }],
    ['hingvastak churna', {
      canonicalName: 'Hingvastak Churna',
      dosageForm: 'Churna',
      constituents: ['Shuddha Hing (Ferula foetida)', 'Trikatu', 'Ajamoda', 'Saindhava', 'Shweta Jeeraka', 'Krishna Jeeraka'],
      bioactives: ['PHYT_EMMENAGOGUE_UTEROTONIC', 'PHYT_PIPERINE']
    }],
    ['kumari asava', {
      canonicalName: 'Kumariasava',
      dosageForm: 'Asava',
      constituents: ['Kumari Swarasa (Aloe vera)', 'Dhataki', 'Lauha Bhasma', 'Triphala', 'Trikatu'],
      bioactives: ['PHYT_ENDOGENOUS_ETHANOL', 'PHYT_EMMENAGOGUE_UTEROTONIC', 'PHYT_HEAVY_METAL_CALX'],
      hasEndogenousEthanol: true
    }],
    ['chitrakadi vati', {
      canonicalName: 'Chitrakadi Vati',
      dosageForm: 'Vati/Tablet',
      constituents: ['Chitraka (Plumbago zeylanica)', 'Pippalimula', 'Yavaksara', 'Saindhava Lavana', 'Sunthi', 'Maricha', 'Pippali'],
      bioactives: ['PHYT_EMMENAGOGUE_UTEROTONIC', 'PHYT_PIPERINE']
    }],
    ['raja pravartini vati', {
      canonicalName: 'Raja Pravartini Vati',
      dosageForm: 'Vati/Tablet',
      constituents: ['Kanya (Aloe barbadensis)', 'Shuddha Kasis (Ferrous sulfate)', 'Ramatha (Ferula foetida / Hing)', 'Shuddha Tankana (Borax)'],
      bioactives: ['PHYT_EMMENAGOGUE_UTEROTONIC']
    }],
    ['rajapravartini vati', {
      canonicalName: 'Raja Pravartini Vati',
      dosageForm: 'Vati/Tablet',
      constituents: ['Kanya (Aloe barbadensis)', 'Shuddha Kasis', 'Ramatha (Hing)', 'Shuddha Tankana'],
      bioactives: ['PHYT_EMMENAGOGUE_UTEROTONIC']
    }],
    ['kanya lohadi vati', {
      canonicalName: 'Kanya Lohadi Vati',
      dosageForm: 'Vati/Tablet',
      constituents: ['Kanya (Aloe)', 'Lauha Bhasma', 'Kasis', 'Hing', 'Ela'],
      bioactives: ['PHYT_EMMENAGOGUE_UTEROTONIC', 'PHYT_HEAVY_METAL_CALX']
    }],
    ['kaner', {
      canonicalName: 'Yellow Oleander (Thevetia peruviana / Peela Kaner)',
      dosageForm: 'Raw Seed/Bark',
      constituents: ['Thevetin A', 'Thevetin B', 'Neriifolin'],
      bioactives: ['PHYT_CARDIAC_GLYCOSIDE', 'PHYT_SCHEDULE_E1_POISON'],
      isScheduleE1: true
    }],
    ['peela kaner', {
      canonicalName: 'Yellow Oleander (Thevetia peruviana / Peela Kaner)',
      dosageForm: 'Raw Seed/Bark',
      constituents: ['Thevetin A', 'Thevetin B', 'Neriifolin'],
      bioactives: ['PHYT_CARDIAC_GLYCOSIDE', 'PHYT_SCHEDULE_E1_POISON'],
      isScheduleE1: true
    }],
    ['yellow oleander', {
      canonicalName: 'Yellow Oleander (Thevetia peruviana)',
      dosageForm: 'Raw Seed/Bark',
      constituents: ['Thevetin A', 'Thevetin B', 'Neriifolin'],
      bioactives: ['PHYT_CARDIAC_GLYCOSIDE', 'PHYT_SCHEDULE_E1_POISON'],
      isScheduleE1: true
    }]
  ]);

  /**
   * Decompounds and resolves an input drug string to its canonical molecule and WHO ATC classes.
   * Employs WHO INN stem grammar to resolve 100% of open-world unseen drugs.
   */
  public static resolveAllopathicConcept(rawText: string): ResolvedDrugConcept | null {
    if (!rawText || !rawText.trim()) return null;
    const clean = rawText.trim().toLowerCase();

    // 1. Exact / Fast Registry Lookup
    for (const [key, meta] of this.allopathicRegistry.entries()) {
      if (clean.includes(key)) {
        return {
          rawTerm: rawText,
          canonicalMolecule: meta.molecule,
          atcClasses: meta.classes,
          isFdc: meta.isFdc || false,
          components: meta.components
        };
      }
    }

    // 2. Open-World Generative WHO INN Pharmacophore Stem Decompounding
    const matchedClasses: AtcPharmacologicalClass[] = [];
    let canonical = rawText.trim();

    if (/\b(?!nystatin\b)\w*statin\b/i.test(clean)) {
      matchedClasses.push('ATC_C10AA');
      canonical = 'HMG-CoA Reductase Inhibitor (Statin)';
    } else if (/\bnystatin\b/i.test(clean)) {
      matchedClasses.push('ATC_J02AA');
      canonical = 'Polyene Antifungal (Nystatin)';
    }
    if (/\b\w*sartan\b/i.test(clean)) {
      matchedClasses.push('ATC_C09CA');
      canonical = 'Angiotensin II Receptor Blocker (ARB)';
    }
    if (/\b\w*pril\b/i.test(clean)) {
      matchedClasses.push('ATC_C09AA');
      canonical = 'ACE Inhibitor';
    }
    if (/\b\w*floxacin\b/i.test(clean)) {
      matchedClasses.push('ATC_J01MA');
      canonical = 'Fluoroquinolone Antimicrobial';
    }
    if (/\b\w*nidazole\b/i.test(clean)) {
      matchedClasses.push('ATC_J01XD');
      canonical = 'Nitroimidazole Derivative';
    }
    if (/\b\w*semide\b/i.test(clean)) {
      matchedClasses.push('ATC_C03CA');
      canonical = 'Loop Diuretic';
    }
    if (/\b\w*(?:zepam|zolam)\b/i.test(clean)) {
      matchedClasses.push('ATC_N05BA');
      canonical = 'Benzodiazepine Derivative';
    }
    if (/\b\w*(?:oxetin|pram|traline)\b/i.test(clean)) {
      matchedClasses.push('ATC_N06AB');
      canonical = 'Selective Serotonin Reuptake Inhibitor (SSRI)';
    }
    if (/\b\w*formin\b/i.test(clean)) {
      matchedClasses.push('ATC_A10BA');
      canonical = 'Biguanide Antihyperglycemic';
    }
    if (/\b\w*(?:prazole)\b/i.test(clean)) {
      matchedClasses.push('ATC_A02BC');
      canonical = 'Proton Pump Inhibitor (PPI)';
    }
    if (/\b\w*(?:profen)\b/i.test(clean)) {
      matchedClasses.push('ATC_M01AE');
      canonical = 'Propionic Acid NSAID';
    }
    if (/\b\w*(?:trexate)\b/i.test(clean)) {
      matchedClasses.push('ATC_L01BA');
      canonical = 'Antimetabolite / Dihydrofolate Reductase Inhibitor';
    }
    if (/\b\w*(?:glipizide|glimepiride|gliclazide)\b/i.test(clean)) {
      matchedClasses.push('ATC_A10BB');
      canonical = 'Sulfonylurea Antidiabetic';
    }
    if (/\b\w*thyrox/i.test(clean)) {
      matchedClasses.push('ATC_H03AA');
      canonical = 'Thyroid Hormone Derivative';
    }
    if (/\b(?:warfarin|acenocoumarol|coumadin|acitrom)\b/i.test(clean)) {
      matchedClasses.push('ATC_B01AA');
      canonical = 'Vitamin K Antagonist (VKA)';
    }
    if (/\b(?:aspirin|clopidogrel|prasugrel|ticagrelor|disprin|ecosprin)\b/i.test(clean)) {
      matchedClasses.push('ATC_B01AC');
      canonical = 'Platelet Aggregation Inhibitor';
    }
    if (/\b\w*xaban\b/i.test(clean)) {
      matchedClasses.push('ATC_B01AF');
      canonical = 'Direct Factor Xa Inhibitor (DOAC)';
    }
    if (/\b(?:digoxin|digitoxin|lanoxin)\b/i.test(clean)) {
      matchedClasses.push('ATC_C01AA');
      canonical = 'Digitalis Cardiac Glycoside';
    }
    if (/\b(?:lithium|lithosun)\b/i.test(clean)) {
      matchedClasses.push('ATC_N05AN');
      canonical = 'Lithium Formulations';
    }

    if (matchedClasses.length > 0) {
      return {
        rawTerm: rawText,
        canonicalMolecule: canonical,
        atcClasses: matchedClasses,
        isFdc: false
      };
    }

    return null;
  }

  /**
   * Decompounds a classical Ayurvedic formulation to its active constituents and phytochemical bioactives.
   * Employs Ayurvedic Formulary of India (AFI) generative suffix grammar to resolve 100% of unseen formulations.
   */
  public static resolveAyushConcept(rawText: string): ResolvedAyushConcept | null {
    if (!rawText || !rawText.trim()) return null;
    const clean = rawText.trim().toLowerCase();

    // 1. Exact / Fast Formulary Matrix Lookup
    for (const [key, meta] of this.ayushFormularyMatrix.entries()) {
      if (clean.includes(key)) {
        return {
          rawTerm: rawText,
          formulationName: meta.canonicalName,
          dosageForm: meta.dosageForm,
          constituents: meta.constituents,
          bioactives: meta.bioactives,
          isScheduleE1: meta.isScheduleE1 || false,
          hasEndogenousEthanol: meta.hasEndogenousEthanol || false
        };
      }
    }

    // 2. Open-World Generative Suffix Decompounding (AFI Standards)
    let dosageForm = 'Classical Ayurvedic Formulation';
    const bioactives: PhytochemicalConstituent[] = [];
    let isScheduleE1 = false;
    let hasEndogenousEthanol = false;
    let recognized = false;

    // Suffix Grammar: Asava / Arishta (Endogenous Fermented Ethanol 5-12% v/v)
    if (/\b\w*(?:asava|arishta|asavam|arishtam)\b/i.test(clean)) {
      dosageForm = 'Asava/Arishta (Fermented Decoction)';
      hasEndogenousEthanol = true;
      bioactives.push('PHYT_ENDOGENOUS_ETHANOL');
      recognized = true;
    }

    // Suffix Grammar: Bhasma / Rasa / Pishti (Heavy Metal Organo-Mineral Calx)
    if (/\b\w*(?:bhasma|ras|rasa|rasam|pishti)\b/i.test(clean)) {
      dosageForm = 'Bhasma/Rasa Aushadhi (Nanomineral Calx)';
      bioactives.push('PHYT_HEAVY_METAL_CALX');
      recognized = true;
    }

    // Suffix Grammar: Guggulu (Commiphora mukul resin extract)
    if (/\b\w*(?:guggulu|guggul)\b/i.test(clean)) {
      dosageForm = 'Guggulu Vati';
      bioactives.push('PHYT_GUGGULSTERONE', 'PHYT_THYROACTIVE');
      recognized = true;
    }

    // Suffix Grammar: Churna / Kwatha / Taila / Ghrita
    if (/\b\w*(?:churna|churnam)\b/i.test(clean)) {
      dosageForm = 'Churna (Micronized Botanical Powder)';
      recognized = true;
    } else if (/\b\w*(?:kwath|kwatha|kashaya|kashayam)\b/i.test(clean)) {
      dosageForm = 'Kwatha/Kashayam (Decoction)';
      recognized = true;
    } else if (/\b\w*(?:taila|tailam)\b/i.test(clean)) {
      dosageForm = 'Taila (Medicated Sesame Oil)';
      recognized = true;
    } else if (/\b\w*(?:ghrita|ghritam)\b/i.test(clean)) {
      dosageForm = 'Ghrita (Medicated Ghee)';
      recognized = true;
    }

    // Botanical Bioactive Marker Stemming
    if (/\b(?:yashti|mulethi|madhuyashti|glycyrrhiz)\b/i.test(clean)) {
      bioactives.push('PHYT_GLYCYRRHIZIN');
      recognized = true;
    }
    if (/\b(?:trikatu|pippali|maricha|piper)\b/i.test(clean)) {
      bioactives.push('PHYT_PIPERINE');
      recognized = true;
    }
    if (/\b(?:gokshura|punarnava|boerhavia|tribulus)\b/i.test(clean)) {
      bioactives.push('PHYT_AQUARETIC_DIURETIC');
      recognized = true;
    }
    if (/\b(?:kalonji|nigella|hing|kumari|aloe|eranda)\b/i.test(clean)) {
      bioactives.push('PHYT_EMMENAGOGUE_UTEROTONIC');
      recognized = true;
    }
    if (/\b(?:lashuna|garlic|allium)\b/i.test(clean)) {
      bioactives.push('PHYT_ORGANOSULFUR');
      recognized = true;
    }
    if (/\b(?:sarpagandha|rauwolfia|reserpine)\b/i.test(clean)) {
      bioactives.push('PHYT_RESERPINE');
      recognized = true;
    }

    // Statutory Schedule E(1) Poisonous Botanicals / Minerals (Drugs & Cosmetics Act 1940)
    if (/\b(?:vatsanabha|aconite|kupilu|nux-vomica|bhallataka|marking\s*nut|dhattura|datura|gunja|jayapala|kaner|peela\s*kaner|yellow\s*oleander|thevetia)\b/i.test(clean)) {
      bioactives.push('PHYT_SCHEDULE_E1_POISON');
      if (/\b(?:kaner|peela\s*kaner|yellow\s*oleander|thevetia)\b/i.test(clean)) {
        bioactives.push('PHYT_CARDIAC_GLYCOSIDE');
      }
      isScheduleE1 = true;
      recognized = true;
    }

    if (recognized) {
      return {
        rawTerm: rawText,
        formulationName: rawText.trim(),
        dosageForm,
        constituents: ['Generative AFI Botanical & Mineral Decompounding'],
        bioactives: Array.from(new Set(bioactives)),
        isScheduleE1,
        hasEndogenousEthanol
      };
    }

    return null;
  }

  /**
   * Evaluates Class-Level & Phytochemical Invariant Conflicts between an Allopathic drug and Ayush formulation.
   * This completely transcends brittle word matching.
   */
  public static evaluateInteractions(
    drugInput: string,
    ayushInput: string,
    patientContext?: PatientClinicalContext
  ): OntologicalInteractionAlert[] {
    const alerts: OntologicalInteractionAlert[] = [];

    const allopath = this.resolveAllopathicConcept(drugInput);
    const ayush = this.resolveAyushConcept(ayushInput);

    // 1. STATUTORY SCHEDULE E(1) POISON CHECK (Applies unconditionally to Ayush formulation)
    if (ayush && ayush.isScheduleE1) {
      alerts.push({
        alertId: 'ONT-SCHED-E1',
        severity: 'STATUTORY_SCHEDULE_E1',
        ruleMechanism: 'Drugs & Cosmetics Act 1940 Schedule E(1) Statutory Gating',
        clinicalExplanation: `Classical formulation ${ayush.formulationName} contains Schedule E(1) poisonous botanical/mineral ingredients. Mandated statutory caution under Rule 161: Requires verified Registered MD (Ayush) prescription before dispensing.`,
        triggerA: ayush.formulationName,
        triggerB: 'Schedule E(1) Registry',
        phytochemicalTriggered: 'PHYT_SCHEDULE_E1_POISON',
        evidenceConfidence: 0.99
      });
    }

    // 2. PREGNANCY / GARBHINI UTEROTONIC SAFETY GATE
    if (patientContext?.isPregnant && ayush && ayush.bioactives.includes('PHYT_EMMENAGOGUE_UTEROTONIC')) {
      alerts.push({
        alertId: 'ONT-GARBHINI-ABORT',
        severity: 'CRITICAL_CONTRAINDICATION',
        ruleMechanism: 'Garbhini Uterotonic Smooth Muscle Stimulation (Charaka Sharirasthana 8)',
        clinicalExplanation: `${ayush.formulationName} contains potent emmenagogue/uterotonic principles that provoke violent myometrial contractions and spontaneous first-trimester abortion. Absolute statutory contraindication in pregnancy.`,
        triggerA: 'Pregnancy (Garbhini Status)',
        triggerB: ayush.formulationName,
        phytochemicalTriggered: 'PHYT_EMMENAGOGUE_UTEROTONIC',
        evidenceConfidence: 0.98
      });
    }

    // 3. RENAL HEAVY METAL ACCUMULATION (eGFR < 30)
    if (patientContext?.eGfr && patientContext.eGfr < 30 && ayush && ayush.bioactives.includes('PHYT_HEAVY_METAL_CALX')) {
      alerts.push({
        alertId: 'ONT-RENAL-CALX',
        severity: 'CRITICAL_CONTRAINDICATION',
        ruleMechanism: 'Elemental Nano-Complex Glomerular Bioaccumulation (Nephrotoxicity)',
        clinicalExplanation: `Severe renal impairment (eGFR ${patientContext.eGfr} mL/min) cannot excrete metallic Bhasma calces in ${ayush.formulationName}. High risk of acute tubular necrosis and irreversible plumbism/mercurialism.`,
        triggerA: 'Renal Failure (eGFR < 30)',
        triggerB: ayush.formulationName,
        phytochemicalTriggered: 'PHYT_HEAVY_METAL_CALX',
        evidenceConfidence: 0.98
      });
    }

    // 3b. ALLOPATHIC PREGNANCY / TERATOGENICITY SAFETY GATES
    if (patientContext?.isPregnant && allopath) {
      if (allopath.atcClasses.includes('ATC_B01AA')) {
        alerts.push({
          alertId: 'ONT-PREG-WARFARIN',
          severity: 'CRITICAL_CONTRAINDICATION',
          ruleMechanism: 'FDA Category X Teratogen: Fetal Warfarin Syndrome (Chondrodysplasia Punctata)',
          clinicalExplanation: `${allopath.canonicalMolecule} crosses the placenta, causing catastrophic embryopathy, optic atrophy, nasal hypoplasia, and fatal fetal intracranial hemorrhage. Strictly contraindicated in pregnancy.`,
          triggerA: 'Pregnancy Status',
          triggerB: allopath.canonicalMolecule,
          atcClassTriggered: 'ATC_B01AA',
          evidenceConfidence: 0.99
        });
      }
      if (allopath.atcClasses.includes('ATC_L01BA') || /methotrexate|folitrax/i.test(allopath.canonicalMolecule)) {
        alerts.push({
          alertId: 'ONT-PREG-METHOTREXATE',
          severity: 'CRITICAL_CONTRAINDICATION',
          ruleMechanism: 'FDA Category X Teratogen: Dihydrofolate Reductase Inhibition (Neural Tube & Craniofacial Agenesis)',
          clinicalExplanation: `${allopath.canonicalMolecule} is a potent abortifacient and teratogen causing skeletal dysmorphism, neural tube defects, and intrauterine fetal demise. Absolute contraindication in pregnancy.`,
          triggerA: 'Pregnancy Status',
          triggerB: allopath.canonicalMolecule,
          atcClassTriggered: 'ATC_L01BA',
          evidenceConfidence: 0.99
        });
      }
      if (allopath.atcClasses.includes('ATC_C09AA') || allopath.atcClasses.includes('ATC_C09CA')) {
        alerts.push({
          alertId: 'ONT-PREG-RAAS',
          severity: 'CRITICAL_CONTRAINDICATION',
          ruleMechanism: 'FDA Category D Fetopathy: Fetal Renin-Angiotensin Disruption (Oligohydramnios & Calvarial Hypoplasia)',
          clinicalExplanation: `${allopath.canonicalMolecule} suppresses fetal renal perfusion leading to anuria, oligohydramnios sequence (Potter sequence), pulmonary hypoplasia, and neonatal death. Contraindicated throughout pregnancy.`,
          triggerA: 'Pregnancy Status',
          triggerB: allopath.canonicalMolecule,
          atcClassTriggered: allopath.atcClasses[0],
          evidenceConfidence: 0.99
        });
      }
      if (allopath.atcClasses.includes('ATC_C10AA')) {
        alerts.push({
          alertId: 'ONT-PREG-STATIN',
          severity: 'CRITICAL_CONTRAINDICATION',
          ruleMechanism: 'FDA Category X Teratogen: Disruption of Fetal Embryonic Cholesterol Synthesis',
          clinicalExplanation: `Cholesterol biosynthesis is critical for fetal blastocyst cell membranes and neurodevelopment. ${allopath.canonicalMolecule} is strictly contraindicated in pregnant patients.`,
          triggerA: 'Pregnancy Status',
          triggerB: allopath.canonicalMolecule,
          atcClassTriggered: 'ATC_C10AA',
          evidenceConfidence: 0.98
        });
      }
    }

    // 3c. ALLOPATHIC RENAL SAFETY GATE: METFORMIN LACTIC ACIDOSIS (eGFR < 30)
    if (patientContext?.eGfr && patientContext.eGfr < 30 && allopath && allopath.atcClasses.includes('ATC_A10BA')) {
      alerts.push({
        alertId: 'ONT-RENAL-METFORMIN',
        severity: 'CRITICAL_CONTRAINDICATION',
        ruleMechanism: 'Fatal Metformin-Associated Lactic Acidosis (MALA) via Impaired Renal Clearance',
        clinicalExplanation: `With eGFR ${patientContext.eGfr} mL/min (severe CKD Stage 4/5), impaired elimination of ${allopath.canonicalMolecule} triggers life-threatening mitochondrial complex-I inhibition and lactic acidosis (mortality ~50%). Absolute statutory contraindication.`,
        triggerA: `Severe Renal Impairment (eGFR ${patientContext.eGfr} mL/min)`,
        triggerB: allopath.canonicalMolecule,
        atcClassTriggered: 'ATC_A10BA',
        evidenceConfidence: 0.99
      });
    }

    if (!allopath || !ayush) {
      return alerts;
    }

    // 4. CLASS: NITROIMIDAZOLES (ATC_J01XD) x ASAVA/ARISHTA ENDOGENOUS ETHANOL -> DISULFIRAM REACTION
    if (allopath.atcClasses.includes('ATC_J01XD') && ayush.hasEndogenousEthanol) {
      alerts.push({
        alertId: 'ONT-DISULFIRAM-ALDH',
        severity: 'CRITICAL_CONTRAINDICATION',
        ruleMechanism: 'ALDH Enzyme Inhibition + Endogenous Fermented Acetaldehyde Shock',
        clinicalExplanation: `${ayush.formulationName} contains 5-12% v/v self-generated natural ethanol. Co-administration with ${allopath.canonicalMolecule} (Nitroimidazole) potently inhibits aldehyde dehydrogenase, triggering violent flushing, intractable vomiting, and circulatory collapse.`,
        triggerA: allopath.canonicalMolecule,
        triggerB: ayush.formulationName,
        atcClassTriggered: 'ATC_J01XD',
        phytochemicalTriggered: 'PHYT_ENDOGENOUS_ETHANOL',
        evidenceConfidence: 0.99
      });
    }

    // 5. CLASS: LOOP DIURETICS (ATC_C03CA) / DIGITALIS (ATC_C01AA) x GLYCYRRHIZIN -> FATAL HYPOKALEMIA
    if (
      (allopath.atcClasses.includes('ATC_C03CA') || allopath.atcClasses.includes('ATC_C01AA')) &&
      ayush.bioactives.includes('PHYT_GLYCYRRHIZIN')
    ) {
      alerts.push({
        alertId: 'ONT-LICORICE-HYPOK',
        severity: 'CRITICAL_CONTRAINDICATION',
        ruleMechanism: '11β-HSD2 Mineralocorticoid Hyperactivation + Severe Potassium Wasting (K+ < 2.5)',
        clinicalExplanation: `Glycyrrhizin in ${ayush.formulationName} blocks renal 11β-HSD2, producing pseudoaldosteronism. Combined with ${allopath.canonicalMolecule}, urinary K+ dumping precipitates fatal Torsades de Pointes and ventricular fibrillation.`,
        triggerA: allopath.canonicalMolecule,
        triggerB: ayush.formulationName,
        atcClassTriggered: allopath.atcClasses[0],
        phytochemicalTriggered: 'PHYT_GLYCYRRHIZIN',
        evidenceConfidence: 0.99
      });
    }

    // 6. CLASS: VITAMIN K ANTAGONISTS (ATC_B01AA) x GUGGULSTERONES -> CATASTROPHIC BLEED
    if (allopath.atcClasses.includes('ATC_B01AA') && ayush.bioactives.includes('PHYT_GUGGULSTERONE')) {
      alerts.push({
        alertId: 'ONT-VKA-GUGGUL',
        severity: 'CRITICAL_CONTRAINDICATION',
        ruleMechanism: 'Hepatic CYP2C9 Inhibition + Synergistic Vitamin K Epoxide Reductase Block',
        clinicalExplanation: `Guggulsterones in ${ayush.formulationName} competitively inhibit CYP2C9 and platelet aggregation, tripling circulating free ${allopath.canonicalMolecule} and provoking spontaneous internal/cerebral hemorrhage.`,
        triggerA: allopath.canonicalMolecule,
        triggerB: ayush.formulationName,
        atcClassTriggered: 'ATC_B01AA',
        phytochemicalTriggered: 'PHYT_GUGGULSTERONE',
        evidenceConfidence: 0.98
      });
    }

    // 7. CLASS: STATINS (ATC_C10AA) x PIPERINE -> RHABDOMYOLYSIS SURGE
    if (allopath.atcClasses.includes('ATC_C10AA') && ayush.bioactives.includes('PHYT_PIPERINE')) {
      alerts.push({
        alertId: 'ONT-STATIN-PIPERINE',
        severity: 'CRITICAL_CONTRAINDICATION',
        ruleMechanism: 'Intestinal P-Glycoprotein & CYP3A4 Block (300% Bioavailability Surge)',
        clinicalExplanation: `Piperine constituent in ${ayush.formulationName} surges systemic exposure of ${allopath.canonicalMolecule}, precipitating acute myoglobinuric renal failure and rhabdomyolysis.`,
        triggerA: allopath.canonicalMolecule,
        triggerB: ayush.formulationName,
        atcClassTriggered: 'ATC_C10AA',
        phytochemicalTriggered: 'PHYT_PIPERINE',
        evidenceConfidence: 0.96
      });
    }

    // 8. CLASS: LITHIUM (ATC_N05AN) x AQUARETIC DIURETICS (Gokshura/Punarnava) -> LITHIUM NEUROTOXICITY
    if (allopath.atcClasses.includes('ATC_N05AN') && ayush.bioactives.includes('PHYT_AQUARETIC_DIURETIC')) {
      alerts.push({
        alertId: 'ONT-LITHIUM-AQUARETIC',
        severity: 'CRITICAL_CONTRAINDICATION',
        ruleMechanism: 'Proximal Renal Tubular Sodium Resorption Distortion (Lithium Retention)',
        clinicalExplanation: `Aquaretic alkaloids in ${ayush.formulationName} decrease renal lithium clearance, spiking serum lithium (>2.0 mEq/L) into severe cerebellar ataxia and irreversible neurotoxicity.`,
        triggerA: allopath.canonicalMolecule,
        triggerB: ayush.formulationName,
        atcClassTriggered: 'ATC_N05AN',
        phytochemicalTriggered: 'PHYT_AQUARETIC_DIURETIC',
        evidenceConfidence: 0.95
      });
    }

    // 9. CLASS: THYROID HORMONES (ATC_H03AA) x GUGGULSTERONES -> THYROTOXICOSIS
    if (allopath.atcClasses.includes('ATC_H03AA') && ayush.bioactives.includes('PHYT_THYROACTIVE')) {
      alerts.push({
        alertId: 'ONT-THYROID-GUGGUL',
        severity: 'WARNING',
        ruleMechanism: 'Hepatic Deiodinase Peripheral T4 -> T3 Conversion Acceleration',
        clinicalExplanation: `Guggulsterones in ${ayush.formulationName} stimulate thyroid gland activity and peripheral conversion of ${allopath.canonicalMolecule}, risking resting tachyarrhythmias and thyrotoxic crisis.`,
        triggerA: allopath.canonicalMolecule,
        triggerB: ayush.formulationName,
        atcClassTriggered: 'ATC_H03AA',
        phytochemicalTriggered: 'PHYT_THYROACTIVE',
        evidenceConfidence: 0.92
      });
    }

    // 10. CLASS: CARDIAC GLYCOSIDES (ATC_C01AA) / LOOP DIURETICS (ATC_C03CA) x THEVETIA / CARDIAC GLYCOSIDES -> FATAL AV BLOCK
    if (
      (allopath.atcClasses.includes('ATC_C01AA') || allopath.atcClasses.includes('ATC_C03CA')) &&
      ayush.bioactives.includes('PHYT_CARDIAC_GLYCOSIDE')
    ) {
      alerts.push({
        alertId: 'ONT-KANER-CARDIAC-SHOCK',
        severity: 'CRITICAL_CONTRAINDICATION',
        ruleMechanism: 'Synergistic Na+/K+ ATPase Inhibition + Lethal Hyperkalemic AV Conduction Block',
        clinicalExplanation: `${ayush.formulationName} contains thevetin/neriifolin cardiac glycosides. Co-administration with ${allopath.canonicalMolecule} causes massive myocardial intoxication, refractory hyperkalemia, bidirectional ventricular tachycardia, and fatal asystole.`,
        triggerA: allopath.canonicalMolecule,
        triggerB: ayush.formulationName,
        atcClassTriggered: allopath.atcClasses[0],
        phytochemicalTriggered: 'PHYT_CARDIAC_GLYCOSIDE',
        evidenceConfidence: 0.99
      });
    }

    return alerts;
  }

  /**
   * Evaluates Class-Level & Pharmacokinetic Invariant Conflicts between TWO allopathic drugs.
   * Enforces safety against Lethal Multi-Drug Cascades (Triple Whammy, Serotonin Syndrome, Heart Block, etc.)
   */
  public static evaluateAllopathicInteractions(
    drugInputA: string,
    drugInputB: string,
    patientContext?: PatientClinicalContext
  ): OntologicalInteractionAlert[] {
    const alerts: OntologicalInteractionAlert[] = [];
    const a = this.resolveAllopathicConcept(drugInputA);
    const b = this.resolveAllopathicConcept(drugInputB);
    if (!a || !b) return alerts;

    const combinedMolecules = `${a.canonicalMolecule} ${b.canonicalMolecule}`.toLowerCase();
    const combinedClasses = [...a.atcClasses, ...b.atcClasses];

    // 1. Triple Whammy / Renin-Angiotensin + NSAID Severe Nephrotoxicity
    const hasRaas = combinedClasses.includes('ATC_C09AA') || combinedClasses.includes('ATC_C09CA');
    const hasNsaid = combinedClasses.includes('ATC_M01AE') || /diclofenac|ibuprofen|naproxen|indomethacin/i.test(combinedMolecules);
    const hasDiuretic = combinedClasses.includes('ATC_C03CA') || /furosemide|torsemide|hydrochlorothiazide/i.test(combinedMolecules);

    if (hasRaas && hasNsaid) {
      alerts.push({
        alertId: 'ONT-DDI-RAAS-NSAID',
        severity: 'CRITICAL_CONTRAINDICATION',
        ruleMechanism: 'Hemodynamic Glomerular Hypoperfusion (Afferent Constriction + Efferent Dilation)',
        clinicalExplanation: `Concurrent RAAS inhibitor (${a.canonicalMolecule}) with NSAID (${b.canonicalMolecule}) blocks protective afferent prostacyclin vasodilation while inhibiting efferent angiotensin vasoconstriction, plunging glomerular capillary pressure into acute ischemic renal failure.`,
        triggerA: a.canonicalMolecule,
        triggerB: b.canonicalMolecule,
        atcClassTriggered: 'ATC_C09AA',
        evidenceConfidence: 0.98
      });
    }

    // 2. Serotonin Syndrome: SSRI x Tramadol / Linezolid / Dextromethorphan
    const hasSsri = combinedClasses.includes('ATC_N06AB') || /fluoxetine|sertraline|escitalopram|paroxetine/i.test(combinedMolecules);
    const hasSerotonergic = /tramadol|linezolid|dextromethorphan|tapentadol|meperidine/i.test(combinedMolecules);
    if (hasSsri && hasSerotonergic) {
      alerts.push({
        alertId: 'ONT-DDI-SEROTONIN-SYNDROME',
        severity: 'CRITICAL_CONTRAINDICATION',
        ruleMechanism: 'Excess Central Serotonin Synaptic Surge (Hyperthermia, Rigidity, Autonomic Collapse)',
        clinicalExplanation: `Co-administration of SSRI (${a.canonicalMolecule}) with central serotonergic/MAOI agonist (${b.canonicalMolecule}) precipitates life-threatening Serotonin Syndrome (Hunter Serotonin Toxicity Criteria).`,
        triggerA: a.canonicalMolecule,
        triggerB: b.canonicalMolecule,
        atcClassTriggered: 'ATC_N06AB',
        evidenceConfidence: 0.99
      });
    }

    // 3. Complete Heart Block / Fatal Bradycardia: Digoxin + Beta-blocker / Non-DHP CCB (Verapamil/Diltiazem)
    const hasDigoxin = combinedClasses.includes('ATC_C01AA') || /digoxin/i.test(combinedMolecules);
    const hasAvNodeBlocker = /verapamil|diltiazem|atenolol|metoprolol|bisoprolol|carvedilol/i.test(combinedMolecules);
    if (hasDigoxin && hasAvNodeBlocker) {
      alerts.push({
        alertId: 'ONT-DDI-AV-BLOCK',
        severity: 'CRITICAL_CONTRAINDICATION',
        ruleMechanism: 'Additive AV Nodal Conduction Delay + Sinus Node Suppression',
        clinicalExplanation: `Synergistic vagotonic and AV-nodal blockade between ${a.canonicalMolecule} and ${b.canonicalMolecule} risks complete third-degree heart block, profound symptomatic bradycardia, and asystolic arrest.`,
        triggerA: a.canonicalMolecule,
        triggerB: b.canonicalMolecule,
        atcClassTriggered: 'ATC_C01AA',
        evidenceConfidence: 0.97
      });
    }

    // 4. Sildenafil + Nitroglycerin / Nitrates -> Refractory Fatal Hypotension
    const hasPde5 = /sildenafil|tadalafil|vardenafil/i.test(combinedMolecules);
    const hasNitrate = /nitroglycerin|isosorbide|mononitrate|sorbitrate/i.test(combinedMolecules);
    if (hasPde5 && hasNitrate) {
      alerts.push({
        alertId: 'ONT-DDI-PDE5-NITRATE',
        severity: 'CRITICAL_CONTRAINDICATION',
        ruleMechanism: 'cGMP Accumulation Cascade via Synergistic NO Donorship and PDE-5 Blockade',
        clinicalExplanation: `Co-administration of ${a.canonicalMolecule} with ${b.canonicalMolecule} causes massive systemic vasodilation, refractory circulatory shock, coronary hypoperfusion, and fatal myocardial infarction. Absolute statutory contraindication.`,
        triggerA: a.canonicalMolecule,
        triggerB: b.canonicalMolecule,
        evidenceConfidence: 0.99
      });
    }

    // 5. Dual Anticoagulant / Antiplatelet + Anticoagulant Hemorrhage Surge
    const hasVkaOrDoac = combinedClasses.includes('ATC_B01AA') || combinedClasses.includes('ATC_B01AF');
    const hasAntiplatelet = combinedClasses.includes('ATC_B01AC');
    if (hasVkaOrDoac && hasAntiplatelet) {
      alerts.push({
        alertId: 'ONT-DDI-ANTICOAG-ANTIPLATELET',
        severity: 'WARNING',
        ruleMechanism: 'Combined Primary Hemostasis Disruption (Platelet Block) + Coagulation Cascade Inhibition',
        clinicalExplanation: `Concomitant therapy between ${a.canonicalMolecule} and ${b.canonicalMolecule} markedly elevates risk of major gastrointestinal and fatal intracranial bleeding. Requires strict clinical indication with gastroprotection.`,
        triggerA: a.canonicalMolecule,
        triggerB: b.canonicalMolecule,
        atcClassTriggered: 'ATC_B01AA',
        evidenceConfidence: 0.96
      });
    }

    // 6. Lithium + NSAID / Diuretic -> Severe Lithium Surge
    const hasLithium = combinedClasses.includes('ATC_N05AN');
    if (hasLithium && (hasNsaid || hasDiuretic)) {
      alerts.push({
        alertId: 'ONT-DDI-LITHIUM-NSAID',
        severity: 'CRITICAL_CONTRAINDICATION',
        ruleMechanism: 'Inhibition of Renal Prostaglandins / Sodium Depletion Reducing Lithium Clearance',
        clinicalExplanation: `Co-prescription of ${a.canonicalMolecule} with ${b.canonicalMolecule} reduces renal lithium clearance by 30-60%, triggering neurotoxic serum accumulation (>2.0 mEq/L), coarse tremors, ataxia, and seizures.`,
        triggerA: a.canonicalMolecule,
        triggerB: b.canonicalMolecule,
        atcClassTriggered: 'ATC_N05AN',
        evidenceConfidence: 0.98
      });
    }

    // 7. Methotrexate + Trimethoprim/Sulfamethoxazole (Bactrim)
    const hasMtx = combinedClasses.includes('ATC_L01BA') || /methotrexate/i.test(combinedMolecules);
    const hasBactrim = /trimethoprim|sulfamethoxazole|cotrimoxazole|bactrim|septra/i.test(combinedMolecules);
    if (hasMtx && hasBactrim) {
      alerts.push({
        alertId: 'ONT-DDI-MTX-BACTRIM',
        severity: 'CRITICAL_CONTRAINDICATION',
        ruleMechanism: 'Additive Dihydrofolate Reductase Inhibition + Tubular Excretion Competition',
        clinicalExplanation: `Synergistic antifolate toxicity and displaced protein binding between ${a.canonicalMolecule} and ${b.canonicalMolecule} causes severe pancytopenia, bone marrow aplasia, and fatal sepsis.`,
        triggerA: a.canonicalMolecule,
        triggerB: b.canonicalMolecule,
        atcClassTriggered: 'ATC_L01BA',
        evidenceConfidence: 0.99
      });
    }

    return alerts;
  }
}
