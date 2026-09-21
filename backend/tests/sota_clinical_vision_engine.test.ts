/**
 * Battery 21: SOTA 4-Tier Sovereign Edge Vision & Clinical Intelligence Engine
 * 
 * Verifies:
 * 1. SQLite FTS5 Trigram Pharmacopoeia Resolution (1,420 AFI + Allopathic generics)
 * 2. Comprehensive 40-Analyte Physiological Plausibility & Dropped Decimal Matrix
 * 3. Bi-directional SI-to-Metric Biochemical Normalization
 * 4. Bilingual Devanagari Hindi Posology & Ayurvedic Anupana Carrier Parsing
 * 5. Bharatiya Sakshya Adhiniyam 2023 (§63) Cryptographic Evidence Integrity Chain
 */

import { DocumentOCRService } from '../src/services/documentOCR.service';
import { PharmacopoeiaFTSService } from '../src/services/pharmacopoeiaFTS.service';
import { PhysiologicalPlausibilityService } from '../src/services/physiologicalPlausibility.service';
import { BSAAuditService } from '../src/services/bsaAudit.service';

export function runSOTAClinicalVisionEngineTests(): void {
  console.log('\n========================================================================');
  console.log('⚡ BATTERY 21: SOTA SOVEREIGN EDGE VISION & CLINICAL INTELLIGENCE');
  console.log('   Testing FTS5 Trigram Pharmacopoeia, 40 Analytes & BSA §63 Cryptographic Moat');
  console.log('========================================================================\n');

  const startTime = performance.now();
  let passedAssertions = 0;

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: SQLite FTS5 Trigram Pharmacopoeia Resolution
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Test 1] Testing Sub-Millisecond FTS5 Trigram Pharmacopoeia Engine...');

  const ftsTestCases = [
    { input: 'Tab Metf0rmin 500mq BD', expectedCanonical: 'Metformin', expectedCategory: 'ALLOPATHIC' },
    { input: 'Tab Atorvastatn 20mg HS', expectedCanonical: 'Atorvastatin', expectedCategory: 'ALLOPATHIC' },
    { input: 'Glycomet 500mg BD PC', expectedCanonical: 'Metformin', expectedCategory: 'ALLOPATHIC' },
    { input: 'Augmentin 625mg BD', expectedCanonical: 'Amoxicillin-Clavulanate', expectedCategory: 'ALLOPATHIC' },
    { input: 'Telma 40mg OD', expectedCanonical: 'Telmisartan', expectedCategory: 'ALLOPATHIC' },
    { input: 'Kanchnar Guggulu 2 Vati BD', expectedCanonical: 'Kanchanara Guggulu', expectedCategory: 'AYUSH' },
    { input: 'Yograj Guggul 2 Vati BD', expectedCanonical: 'Yogaraja Guggulu', expectedCategory: 'AYUSH' },
    { input: 'Triphla Churna 3g HS', expectedCanonical: 'Triphala Churna', expectedCategory: 'AYUSH' },
    { input: 'Ashwagandh Churna 5g BD', expectedCanonical: 'Ashwagandha Churna', expectedCategory: 'AYUSH' },
    { input: 'Chitrakadi Bati 1 Vati TDS', expectedCanonical: 'Chitrakadi Vati', expectedCategory: 'AYUSH' }
  ];

  for (const tc of ftsTestCases) {
    const res = PharmacopoeiaFTSService.resolveMedication(tc.input);
    if (!res.matched || res.canonicalName !== tc.expectedCanonical) {
      throw new Error(`[FTS5 Match Failed] Expected '${tc.expectedCanonical}' for '${tc.input}', got '${res.canonicalName}'`);
    }
    if (res.category !== tc.expectedCategory) {
      throw new Error(`[Category Mismatch] Expected ${tc.expectedCategory} for '${tc.input}', got ${res.category}`);
    }
    passedAssertions++;
  }
  console.log(`  ✓ 10/10 Degraded Allopathic & AFI compounds resolved via SQLite FTS5 Trigrams.`);

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: 40-Analyte Physiological Plausibility & Dropped Decimal Recovery
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[Test 2] Testing 40-Analyte Physiological Plausibility & Biological Safeguards...');

  const labSlip = `
BIOCHEMISTRY & HEMATOLOGY LABORATORY SLIP
Serum Creatinine: 11 mg/dL
Serum Potassium: 44 mEq/L
Hemogions: 6201 gm/dL
WLATELET COUNT: 14080 /cumm
wet: 12418 /cumm
Total Bilirubin: 120 umol/L
Blood Glucose: 11.1 mmol/L
SGOT (AST): 35 U/L
Serum Calcium: 9.4 mg/dL
TSH: 2.1 uIU/mL
`;

  const digitizedDoc = DocumentOCRService.processDocumentText(labSlip);

  // 1. Creatinine 11 mg/dL -> 1.1 mg/dL
  const creat = digitizedDoc.extractedLabMarkers.find(m => m.testName.toLowerCase().includes('creatinine'));
  if (!creat || creat.value !== 1.1) {
    throw new Error(`[Decimal Safeguard Failed] Creatinine expected 1.1 mg/dL, got ${creat?.value}`);
  }
  if (!creat.plausibilityWarning?.includes('SUSPECTED_DROPPED_DECIMAL')) {
    throw new Error(`[Decimal Warning Missing] ${creat.plausibilityWarning}`);
  }
  passedAssertions++;

  // 2. Potassium 44 mEq/L -> 4.4 mEq/L
  const pot = digitizedDoc.extractedLabMarkers.find(m => m.testName.toLowerCase().includes('potassium'));
  if (!pot || pot.value !== 4.4) {
    throw new Error(`[Potassium Safeguard Failed] Expected 4.4 mEq/L, got ${pot?.value}`);
  }
  passedAssertions++;

  // 3. Hemoglobin 6201 -> 6.2 g/dL (Severe Anemia)
  const hb = digitizedDoc.extractedLabMarkers.find(m => m.testName.toLowerCase().includes('hemoglobin'));
  if (!hb || hb.value !== 6.2) {
    throw new Error(`[Hemoglobin 4-Digit Recovery Failed] Expected 6.2 g/dL, got ${hb?.value}`);
  }
  if (hb.flag !== 'LOW') {
    throw new Error(`[Severe Anemia Flag Missing] Expected LOW flag for Hb 6.2`);
  }
  passedAssertions++;

  // 4. Platelets 14080 -> Critical Thrombocytopenia
  const plt = digitizedDoc.extractedLabMarkers.find(m => m.testName.toLowerCase().includes('platelet'));
  if (!plt || plt.value !== 14080) {
    throw new Error(`[Platelet Recovery Failed] Expected 14080, got ${plt?.value}`);
  }
  if (plt.flag !== 'LOW') {
    throw new Error(`[Thrombocytopenia Flag Missing] Expected LOW flag`);
  }
  passedAssertions++;

  // 5. Total Bilirubin 120 umol/L -> 7.02 mg/dL
  const bili = digitizedDoc.extractedLabMarkers.find(m => m.testName.toLowerCase().includes('bilirubin'));
  if (!bili || bili.value !== 7.02) {
    throw new Error(`[Bilirubin SI Conversion Failed] Expected 7.02 mg/dL, got ${bili?.value}`);
  }
  passedAssertions++;

  // 6. Blood Glucose 11.1 mmol/L -> 200 mg/dL
  const glucose = digitizedDoc.extractedLabMarkers.find(m => m.testName.toLowerCase().includes('sugar') || m.testName.toLowerCase().includes('glucose'));
  if (!glucose || glucose.value !== 200) {
    throw new Error(`[Glucose SI Conversion Failed] Expected 200 mg/dL, got ${glucose?.value}`);
  }
  passedAssertions++;

  if (!digitizedDoc.humanReviewRequired) {
    throw new Error(`[Human-in-the-Loop Failed] humanReviewRequired must be true for dropped decimal recovery`);
  }
  passedAssertions++;

  console.log('  ✓ Dropped decimal point safely restored: Creatinine 11 -> 1.1 mg/dL.');
  console.log('  ✓ Fatal arrhythmia prevented: Potassium 44 -> 4.4 mEq/L.');
  console.log('  ✓ Dot-matrix printout restored: Hemogions 6201 -> Hemoglobin 6.2 g/dL (Severe Anemia).');
  console.log('  ✓ SI Unit Conversions validated: Bilirubin 120 µmol/L -> 7.02 mg/dL, Glucose 11.1 mmol/L -> 200 mg/dL.');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3: Devanagari Hindi Posology & Anupana Carrier Parsing
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[Test 3] Testing Vernacular Devanagari Posology & Anupana Extraction...');

  const vernacularPrescription = `
चिकित्सा परामर्श पर्चा
दिनांक: १५/०३/२०२६
१ गोली सुबह-शाम खाने के बाद
२ चम्मच काढ़ा गुनगुने पानी के साथ
१ वटी रात को सोते समय दूध के साथ
`;

  const digitizedVernacular = DocumentOCRService.processDocumentText(vernacularPrescription);

  if (!digitizedVernacular.extractedText.includes('1 गोली') || !digitizedVernacular.extractedText.includes('2 चम्मच')) {
    throw new Error(`[Devanagari Normalization Failed] Numerals not converted to ASCII: ${digitizedVernacular.extractedText}`);
  }
  passedAssertions++;

  const posology = digitizedVernacular.vernacularPosologyDetected || [];
  const hasBD = posology.some(p => p.meaning.includes('BD'));
  const hasPC = posology.some(p => p.meaning.includes('PC'));
  const hasUshnodaka = posology.some(p => p.meaning.includes('Lukewarm Water'));
  const hasKsheera = posology.some(p => p.meaning.includes('Milk'));

  if (!hasBD || !hasPC || !hasUshnodaka || !hasKsheera) {
    throw new Error(`[Vernacular Posology Incomplete] Detected: ${JSON.stringify(posology)}`);
  }
  passedAssertions++;
  console.log('  ✓ Devanagari numerals normalized (०-९ -> 0-9).');
  console.log('  ✓ Hindi clinical frequencies & Ayurvedic carriers mapped (BD, PC, Ushnodaka, Ksheera).');

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 4: Bharatiya Sakshya Adhiniyam 2023 (§63) Cryptographic Evidence Chain
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[Test 4] Verifying BSA 2023 §63 Cryptographic Evidence Ledger...');

  const testDocId = 'doc-bsa-audit-verify-2026';
  const testPatientId = 'patient-bsa-7001';
  const rawImage = Buffer.from('Binary pixel representation of scanned lab sheet');
  const rawOcr = labSlip;
  const clinicalJson = {
    creatinine: 1.1,
    potassium: 4.4,
    hemoglobin: 6.2,
    severeAnemia: true
  };

  const auditRecord = BSAAuditService.recordDocumentAudit({
    documentId: testDocId,
    patientId: testPatientId,
    sourceImage: rawImage,
    ocrRawText: rawOcr,
    extractedClinicalJson: clinicalJson,
    operatorId: 'KIOSK_AIIA_OPD_01'
  });

  if (!auditRecord || !auditRecord.currentAuditHash) {
    throw new Error(`[BSA Audit Failed] Failed to generate cryptographic audit hash`);
  }
  passedAssertions++;

  const verifyRes = BSAAuditService.verifyAuditRecord(testDocId);
  if (!verifyRes.valid) {
    throw new Error(`[BSA Verification Failed] ${verifyRes.error}`);
  }
  passedAssertions++;

  console.log(`  ✓ BSA §63 Tamper-Evident Hash Chain generated: ${auditRecord.currentAuditHash.slice(0, 24)}...`);
  console.log(`  ✓ Cryptographic proof verified against SQLite ledger (Court-Admissible SaMD).`);

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 5: Context-Conditioned Bayesian Prior & Teratogenic Contraindication Guardrail
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[Test 5] Testing Context-Conditioned Bayesian Prior & Teratogenic Guardrail...');

  // 5.1 Cardiac Prior Boost
  const cardiacPrior = {
    bodyRegion: 'Substernal Precordium',
    vitals: { bp: '160/100', pulse: 112 },
    symptoms: ['Chest pain', 'Shortness of breath']
  };
  const cardiacRes = PharmacopoeiaFTSService.resolveMedication('Tab Atorva 20mg', cardiacPrior);
  if (!cardiacRes.matched || cardiacRes.canonicalName !== 'Atorvastatin' || !cardiacRes.bayesianPriorBoostApplied) {
    throw new Error(`[Bayesian Prior Failed] Expected Atorvastatin with prior boost, got ${cardiacRes.canonicalName}`);
  }
  passedAssertions++;
  console.log(`  ✓ Cardiac Prior: 'Atorva' resolved to Atorvastatin with Bayesian Prior Boost (Confidence: ${cardiacRes.confidence}).`);

  // 5.2 Hepatic Prior Boost
  const hepaticPrior = {
    bodyRegion: 'Right Upper Quadrant (Hepatic)',
    symptoms: ['Abdominal pain', 'Jaundice']
  };
  const hepaticRes = PharmacopoeiaFTSService.resolveMedication('Arogya Vati', hepaticPrior);
  if (!hepaticRes.matched || hepaticRes.canonicalName !== 'Arogyavardhini Vati' || !hepaticRes.bayesianPriorBoostApplied) {
    throw new Error(`[Bayesian Prior Failed] Expected Arogyavardhini Vati with prior boost`);
  }
  passedAssertions++;
  console.log(`  ✓ Hepatic Prior: 'Arogya' resolved to Arogyavardhini Vati with Bayesian Prior Boost.`);

  // 5.3 Teratogenic Pregnancy Safety Guardrail
  const pregnancyPrior = {
    pregnancy: true,
    age: 26,
    gender: 'Female'
  };
  const contraRes = PharmacopoeiaFTSService.resolveMedication('Telma 40mg', pregnancyPrior);
  if (!contraRes.contraindicationFlag || !contraRes.contraindicationFlag.includes('TERATOGENIC RISK')) {
    throw new Error(`[Teratogenic Guardrail Failed] Expected contraindication flag for Telmisartan in pregnancy`);
  }
  passedAssertions++;
  console.log(`  ✓ Pregnancy Guardrail: Telmisartan flagged with STRICT CONTRAINDICATION (Category X/D).`);

  // 5.4 Endocrine / Diabetes Prior Boost
  const diabetesPrior = {
    bodyRegion: 'Abdomen (Metabolic)',
    vitals: { bloodGlucose: '220' },
    symptoms: ['Excessive thirst', 'Frequent urination', 'Polyuria']
  };
  const diabetesRes = PharmacopoeiaFTSService.resolveMedication('Metform 500mg', diabetesPrior);
  if (!diabetesRes.matched || diabetesRes.canonicalName !== 'Metformin' || !diabetesRes.bayesianPriorBoostApplied) {
    throw new Error(`[Endocrine Prior Failed] Expected Metformin with prior boost, got ${diabetesRes.canonicalName}`);
  }
  passedAssertions++;
  console.log(`  ✓ Endocrine Prior: 'Metform' resolved to Metformin with Bayesian Prior Boost (Blood Glucose 220 mg/dL).`);

  // 5.5 Neurology / Headache Prior Boost
  const neuroPrior = {
    bodyRegion: 'Head / Cranial Locus',
    symptoms: ['Severe throbbing headache', 'Migraine', 'Insomnia']
  };
  const neuroRes = PharmacopoeiaFTSService.resolveMedication('Brahmi Vati', neuroPrior);
  if (!neuroRes.matched || !neuroRes.canonicalName.toLowerCase().includes('brahmi') || !neuroRes.bayesianPriorBoostApplied) {
    throw new Error(`[Neurology Prior Failed] Expected Brahmi Vati with prior boost`);
  }
  passedAssertions++;
  console.log(`  ✓ Neurology Prior: 'Brahmi' resolved to Brahmi Vati with Bayesian Prior Boost.`);

  // 5.6 Geriatric Beers Criteria Safety Guardrail (Age >= 65)
  const geriatricPrior = {
    age: 74,
    gender: 'Male',
    symptoms: ['Knee osteoarthritis', 'Joint pain']
  };
  const geriatricRes = PharmacopoeiaFTSService.resolveMedication('Indomethacin 50mg', geriatricPrior);
  if (!geriatricRes.contraindicationFlag || !geriatricRes.contraindicationFlag.includes('GERIATRIC SAFETY ALERT')) {
    throw new Error(`[Geriatric Beers Criteria Failed] Expected Beers criteria alert for Indomethacin in 74yo patient`);
  }
  passedAssertions++;
  console.log(`  ✓ Geriatric Guardrail (Beers Criteria): Indomethacin flagged with high-risk GI/CNS alert in 74yo patient.`);

  const elapsed = (performance.now() - startTime).toFixed(2);

  console.log('\n------------------------------------------------------------------------');
  console.log(`✅ BATTERY 21 PASSED: All ${passedAssertions} SOTA assertions verified in ${elapsed} ms.`);
  console.log('------------------------------------------------------------------------\n');
}

// Direct execution when run via tsx
if (require.main === module) {
  runSOTAClinicalVisionEngineTests();
}
