/**
 * Seed Script for Pre-Loading 5 Diverse Real-World Hospital Profiles
 * Includes Emergency Red Flag, Sandhivata, Pediatric Pyrexia, Diabetic Prameha, and Rural Dialect.
 */

import { db } from './database';

export function seedDatabase() {
  console.log('[Seed] Seeding sample patients and sessions...');

  // Clean existing seed records
  db.exec(`
    DELETE FROM encounters;
    DELETE FROM documents;
    DELETE FROM sessions;
    DELETE FROM patients;
  `);

  const insertPatient = db.prepare(`
    INSERT INTO patients (id, abha_id, abha_address, name, age, gender, phone_masked, language, prakriti, is_pregnant, gestational_weeks, is_lactating, weight_kg, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSession = db.prepare(`
    INSERT INTO sessions (id, patient_id, symptoms_json, pariksha_json, vitals_json, triage_priority, red_flag_triggers, raw_transcript, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertDoc = db.prepare(`
    INSERT INTO documents (id, patient_id, document_type, extracted_text, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertEncounter = db.prepare(`
    INSERT INTO encounters (id, session_id, patient_id, doctor_id, doctor_name, department, case_sheet_json, fhir_bundle_json, zkp_proof_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();

  // 1. Patient A: Emergency Triage (Acute substernal chest pain radiating to left arm)
  insertPatient.run(
    'pat-001',
    '91-4567-8901-2345',
    'ramesh.kumar@abdm',
    'Ramesh Kumar',
    58,
    'MALE',
    'XXXXXX8921',
    'hi',
    'Pitta-Vata',
    0, null, 0, 72,
    now
  );
  insertSession.run(
    'sess-001',
    'pat-001',
    JSON.stringify([
      { name: 'Chest Pain', rawVernacular: 'chhati me bhari dard', site: 'Substernal', onset: '2 hours ago', character: 'Crushing / Constricting', radiation: 'Left Arm & Jaw', associated: ['Diaphoresis', 'Breathlessness'], severity: 9, isNegated: false },
      { name: 'Palpitations', rawVernacular: 'ghabrahat', site: 'Precordium', onset: '2 hours ago', severity: 8, isNegated: false }
    ]),
    JSON.stringify({
      prakriti: 'Pitta-Vata', vikriti: 'Pitta Vriddhi', sara: 'Madhyama', samhanana: 'Moderate', pramana: 'Ideal', satmya: 'Ritu Satmya', sattva: 'Avara', aharaShakti: 'Heena', vyayamaShakti: 'Low', vaya: 'Madhyama', agni: 'Vishamagni', amaPresent: true
    }),
    JSON.stringify({ bp: '160/100', pulse: 112, spo2: '93%', temp: '98.6°F' }),
    'EMERGENCY_RED_FLAG',
    JSON.stringify(['Acute Substernal Chest Pain with Radiation to Left Arm', 'Marked Diaphoresis', 'Hypertensive Urgency (160/100)']),
    'Doctor mujhe 2 ghante se chhati me bhari dard aur ghabrahat ho rahi hai, dard baaye haath me ja raha hai aur bahut pasina aa raha hai...',
    'DIVERTED_EMERGENCY',
    now
  );

  // 2. Patient B: Sandhivata (Osteoarthritis, Vataja Prakriti, Mandagni)
  insertPatient.run(
    'pat-002',
    '91-7890-1234-5678',
    'shanti.devi@abdm',
    'Shanti Devi',
    64,
    'FEMALE',
    'XXXXXX4312',
    'hi',
    'Vataja',
    0, null, 0, 58,
    now
  );
  insertSession.run(
    'sess-002',
    'pat-002',
    JSON.stringify([
      { name: 'Knee Joint Pain', rawVernacular: 'ghutne me dard aur kat-kat', site: 'Bilateral Knees', onset: '6 months', character: 'Aching with crepitus', radiation: 'None', associated: ['Morning stiffness'], severity: 7, isNegated: false },
      { name: 'Constipation', rawVernacular: 'kabz rehti hai', site: 'Lower GI', onset: '1 month', severity: 5, isNegated: false }
    ]),
    JSON.stringify({
      prakriti: 'Vataja', vikriti: 'Vata Prakopa', sara: 'Avara', samhanana: 'Heena', pramana: 'Atikrsha', satmya: 'Oka Satmya', sattva: 'Madhyama', aharaShakti: 'Heena', vyayamaShakti: 'Low', vaya: 'Jirna', agni: 'Mandagni', amaPresent: true
    }),
    JSON.stringify({ bp: '130/84', pulse: 74, spo2: '98%', temp: '98.4°F' }),
    'ROUTINE',
    JSON.stringify([]),
    'Doctor sahab pichle 6 mahine se dono ghutno me bahut dard hai, chalne me kat-kat ki aawaz aati hai aur subah uthne par jakdan rehti hai...',
    'PENDING_DOCTOR',
    now
  );

  // 3. Patient C: Pediatric Pyrexia (Vataja Jwara + Cough)
  insertPatient.run(
    'pat-003',
    '91-2345-6789-0123',
    'aarav.sharma@abdm',
    'Aarav Sharma',
    8,
    'MALE',
    'XXXXXX9870',
    'hi',
    'Kapha-Pitta',
    0, null, 0, 24,
    now
  );
  insertSession.run(
    'sess-003',
    'pat-003',
    JSON.stringify([
      { name: 'Fever', rawVernacular: 'tez bukhar', site: 'Systemic', onset: '3 days', character: 'Continuous with chills', severity: 7, isNegated: false },
      { name: 'Cough', rawVernacular: 'khansi', site: 'Throat', onset: '2 days', character: 'Productive', severity: 6, isNegated: false },
      { name: 'Vomiting', rawVernacular: 'ulti nahi hai', site: 'GI', onset: 'None', severity: 0, isNegated: true }
    ]),
    JSON.stringify({
      prakriti: 'Kapha-Pitta', vikriti: 'Pitta-Kapha', sara: 'Madhyama', samhanana: 'Moderate', pramana: 'Ideal', satmya: 'Sarva Rasa', sattva: 'Pravara', aharaShakti: 'Madhyama', vyayamaShakti: 'Medium', vaya: 'Balya', agni: 'Vishamagni', amaPresent: false
    }),
    JSON.stringify({ bp: '100/68', pulse: 96, spo2: '99%', temp: '101.4°F' }),
    'HIGH_PRIORITY',
    JSON.stringify(['Pediatric Febrile Illness (101.4°F) with Mild Dehydration Risk (Weight 24kg)']),
    'Bacche ko 3 din se tez bukhar hai aur 2 din se khansi ho rahi hai, ulti dast bilkul nahi hai...',
    'PENDING_DOCTOR',
    now
  );

  // 4. Patient D: Type 2 Diabetes Follow-up (Kaphaja Prameha, HbA1c 8.2%)
  insertPatient.run(
    'pat-004',
    '91-5678-9012-3456',
    'manoj.verma@abdm',
    'Manoj Verma',
    52,
    'MALE',
    'XXXXXX6543',
    'hi',
    'Kaphaja',
    0, null, 0, 78,
    now
  );
  insertSession.run(
    'sess-004',
    'pat-004',
    JSON.stringify([
      { name: 'General Weakness / Asthenia', rawVernacular: 'kamzori lagti hai', site: 'General', onset: '1 month', severity: 6, isNegated: false },
      { name: 'Dysuria / Burning Micturition', rawVernacular: 'peshab me jalan', site: 'Urethra', onset: '4 days', severity: 5, isNegated: false }
    ]),
    JSON.stringify({
      prakriti: 'Kaphaja', vikriti: 'Kapha-Meda', sara: 'Madhyama', samhanana: 'Compact', pramana: 'Atibrhat', satmya: 'Oka Satmya', sattva: 'Madhyama', aharaShakti: 'Uttama', vyayamaShakti: 'Low', vaya: 'Madhyama', agni: 'Mandagni', amaPresent: true
    }),
    JSON.stringify({ bp: '138/88', pulse: 80, spo2: '97%', temp: '98.6°F', bloodSugar: 218 }),
    'ROUTINE',
    JSON.stringify([]),
    'Doctor sahab 5 saal se sugar hai, Metformin 500mg le raha hu par pichle ek mahine se thakan bahut rehti hai aur peshab me jalan hai...',
    'PENDING_DOCTOR',
    now
  );
  insertDoc.run(
    'doc-001',
    'pat-004',
    'LAB_REPORT',
    'BIOCHEMISTRY REPORT: HbA1c: 8.2 % (HIGH, Ref: 4.0-5.6), Fasting Blood Sugar: 168 mg/dL (HIGH), Serum Creatinine: 1.1 mg/dL (NORMAL, Ref: 0.7-1.3)',
    JSON.stringify({ hba1c: 8.2, fbs: 168, creatinine: 1.1 }),
    now
  );

  // 5. Patient E: Pregnant Mother 14w (Garbhini Chhardi / Hyperemesis Gravidarum)
  insertPatient.run(
    'pat-005',
    '91-8901-2345-6789',
    'kavita.devi@abdm',
    'Kavita Devi',
    23,
    'FEMALE',
    'XXXXXX1234',
    'hi',
    'Pitta-Vata',
    1, 14, 0, 52,
    now
  );
  insertSession.run(
    'sess-005',
    'pat-005',
    JSON.stringify([
      { name: 'Nausea & Hyperemesis', rawVernacular: 'subah se ulti aur chakkar', site: 'Epigastrium', onset: '2 weeks', severity: 6, isNegated: false },
      { name: 'Lower Pelvic Discomfort', rawVernacular: 'pedu me halka dard', site: 'Pelvic', onset: '3 days', severity: 4, isNegated: false }
    ]),
    JSON.stringify({
      prakriti: 'Pitta-Vata', vikriti: 'Garbhini Chhardi', sara: 'Madhyama', samhanana: 'Moderate', pramana: 'Ideal', satmya: 'Ritu Satmya', sattva: 'Madhyama', aharaShakti: 'Heena', vyayamaShakti: 'Low', vaya: 'Yuva', agni: 'Vishamagni', amaPresent: false
    }),
    JSON.stringify({ bp: '108/68', pulse: 82, spo2: '99%', temp: '98.4°F' }),
    'HIGH_PRIORITY',
    JSON.stringify(['Maternal-Fetal Pharmacology Guard Active (14w Gestation)']),
    'Doctor sahab subah uthte hi bahut ulti hoti hai aur chakkar aate hain, kuch bhi pach nahi raha...',
    'PENDING_DOCTOR',
    now
  );

  // 6. Patient F: Geriatric Multimorbid (Sarcopenic CKD eGFR 31.8 mL/min + Polypharmacy)
  insertPatient.run(
    'pat-006',
    '91-3456-7890-1234',
    'joginder.singh@abdm',
    'Sardar Joginder Singh',
    74,
    'MALE',
    'XXXXXX7890',
    'pa',
    'Vata-Kapha',
    0, null, 0, 62,
    now
  );
  insertSession.run(
    'sess-006',
    'pat-006',
    JSON.stringify([
      { name: 'Bilateral Knee Joint Pain', rawVernacular: 'godiyan vich dard', site: 'Bilateral Knees', onset: '3 years', character: 'Severe morning stiffness and crepitus', severity: 7, isNegated: false },
      { name: 'Postural Dizziness', rawVernacular: 'uth ke chakkar', site: 'Head', onset: '2 weeks', severity: 5, isNegated: false }
    ]),
    JSON.stringify({
      prakriti: 'Vata-Kapha', vikriti: 'Sandhigata Vata & Sarcopenic Dhatu Kshaya', sara: 'Avara', samhanana: 'Heena', pramana: 'Atikrsha', satmya: 'Oka Satmya', sattva: 'Pravara', aharaShakti: 'Heena', vyayamaShakti: 'Low', vaya: 'Jirna', agni: 'Mandagni', amaPresent: true
    }),
    JSON.stringify({ bp: '148/86', pulse: 68, spo2: '96%', temp: '98.0°F' }),
    'HIGH_PRIORITY',
    JSON.stringify([
      'Sarcopenic Renal Drift (eGFR 31.8 mL/min despite normal serum Cr 1.1 mg/dL)',
      'Polypharmacy Bleeding Risk: Warfarin + Aspirin + Guggulu Clashing Cascade'
    ]),
    'Doctor sahab godiyan vich bahut dard hai, savere uthiya nahi janda, te khade hon te chakkar aande ne...',
    'PENDING_DOCTOR',
    now
  );
  insertDoc.run(
    'doc-002',
    'pat-006',
    'LAB_REPORT',
    'CIVIL HOSPITAL BIOCHEMISTRY: Fasting Plasma Glucose: 8.0 mmol/L (144.1 mg/dL), Serum Creatinine: 1.2 mg/dL, Estimated GFR: 31.8 mL/min/1.73m2 (Stage 3b CKD), PT-INR: 2.4',
    JSON.stringify({
      fbs_normalized: '144.1 mg/dL',
      creatinine_mg_dl: 1.2,
      egfr: 31.8,
      inr: 2.4,
      medications: [
        { name: 'Warfarin Sodium', dosage: '5 mg', frequency: 'OD' },
        { name: 'Amlodipine', dosage: '5 mg', frequency: 'OD' }
      ]
    }),
    now
  );

  // 7. Patient G: Lakshmi Ammal (55yo, Chennai, Tamil Nadu) - Acute Vatarakta / Gout Flare
  insertPatient.run(
    'pat-007',
    '91-6789-0123-4567',
    'lakshmi.ammal@abdm',
    'Lakshmi Ammal',
    55,
    'FEMALE',
    'XXXXXX3490',
    'ta',
    'Vata-Pitta',
    0, null, 0, 66,
    now
  );
  insertSession.run(
    'sess-007',
    'pat-007',
    JSON.stringify([
      { name: 'Great Toe & Ankle Pain', rawVernacular: 'kaal viral vali veekam', site: 'Right 1st MTP & Ankle', onset: '2 days', character: 'Throbbing, hot, burning and severe nocturnal aggravation', radiation: 'Dorsal Foot', associated: ['Erythema', 'Inability to bear weight'], severity: 8, isNegated: false }
    ]),
    JSON.stringify({
      prakriti: 'Vata-Pitta', vikriti: 'Vata-Rakta Sannipata', sara: 'Madhyama', samhanana: 'Compact', pramana: 'Ideal', satmya: 'Ritu Satmya', sattva: 'Madhyama', aharaShakti: 'Madhyama', vyayamaShakti: 'Medium', vaya: 'Madhyama', agni: 'Tikshnagni', amaPresent: true
    }),
    JSON.stringify({ bp: '134/86', pulse: 84, spo2: '98%', temp: '99.0°F' }),
    'HIGH_PRIORITY',
    JSON.stringify(['Acute Podagra / Vatarakta flare with Serum Uric Acid 8.6 mg/dL']),
    'Doctor, enakku kaal periya viral-le romba kodiya vali irukku, thoda kooda mudiyala, veengi sivanndhu irukku...',
    'PENDING_DOCTOR',
    now
  );
  insertDoc.run(
    'doc-003',
    'pat-007',
    'LAB_REPORT',
    'APOLLO CLINICAL DIAGNOSTICS: Serum Uric Acid: 8.6 mg/dL (HIGH, Ref: 2.4-6.0), ESR: 42 mm/1st hr (HIGH), Serum Creatinine: 0.9 mg/dL (NORMAL)',
    JSON.stringify({ uric_acid: 8.6, esr: 42, creatinine: 0.9 }),
    now
  );

  // 8. Patient H: Subhash Chandra Mondal (48yo, Murshidabad, West Bengal) - Chronic Amlapitta
  insertPatient.run(
    'pat-008',
    '91-7890-4561-2345',
    'subhash.mondal@abdm',
    'Subhash Chandra Mondal',
    48,
    'MALE',
    'XXXXXX5612',
    'bn',
    'Pitta-Kapha',
    0, null, 0, 70,
    now
  );
  insertSession.run(
    'sess-008',
    'pat-008',
    JSON.stringify([
      { name: 'Retrosternal Burning & Sour Eructations', rawVernacular: 'buk jala ebong tok dhekur', site: 'Epigastrium & Lower Chest', onset: '3 weeks', character: 'Burning aggravated post-meals', radiation: 'Throat', associated: ['Nausea', 'Loss of appetite'], severity: 6, isNegated: false }
    ]),
    JSON.stringify({
      prakriti: 'Pitta-Kapha', vikriti: 'Vidagdhajirna & Amlapitta', sara: 'Madhyama', samhanana: 'Moderate', pramana: 'Ideal', satmya: 'Sarva Rasa', sattva: 'Madhyama', aharaShakti: 'Heena', vyayamaShakti: 'Medium', vaya: 'Madhyama', agni: 'Tikshnagni', amaPresent: true
    }),
    JSON.stringify({ bp: '124/80', pulse: 76, spo2: '99%', temp: '98.4°F' }),
    'ROUTINE',
    JSON.stringify([]),
    'Doctor babu, amar buke khub jala kore, tok dhekur uthe, khabar khelei ombol hoye jaye...',
    'PENDING_DOCTOR',
    now
  );

  // 9. Patient I: Devi Lal Meena (38yo, Alwar, Rajasthan) - Acute Viperid Envenomation Red-Flag
  insertPatient.run(
    'pat-009',
    '91-9012-3456-7890',
    'devilal.meena@abdm',
    'Devi Lal Meena',
    38,
    'MALE',
    'XXXXXX9012',
    'hi',
    'Vataja',
    0, null, 0, 68,
    now
  );
  insertSession.run(
    'sess-009',
    'pat-009',
    JSON.stringify([
      { name: 'Snake Envenomation / Fang Puncture', rawVernacular: 'khet me saanp ne kaat liya', site: 'Right Dorsal Foot', onset: '45 mins ago', character: 'Excruciating local pain and rapid ascending edema', radiation: 'Right Lower Leg', associated: ['Epistaxis', 'Local Ecchymosis', 'Oliguria'], severity: 10, isNegated: false }
    ]),
    JSON.stringify({
      prakriti: 'Vataja', vikriti: 'Visha Vega Prakopa (Sarpadansha)', sara: 'Avara', samhanana: 'Heena', pramana: 'Ideal', satmya: 'Oka Satmya', sattva: 'Avara', aharaShakti: 'Heena', vyayamaShakti: 'Low', vaya: 'Yuva', agni: 'Vishamagni', amaPresent: true
    }),
    JSON.stringify({ bp: '90/60', pulse: 128, spo2: '91%', temp: '97.8°F' }),
    'EMERGENCY_RED_FLAG',
    JSON.stringify([
      'Acute Hemotoxic Snake Envenomation (Viperidae / Russell Viper Bite)',
      'Ascending Edema with Fang Marks & Spontaneous Systemic Bleeding (Epistaxis)',
      'Hypotension (90/60) and Tachycardia (128 bpm) — Immediate ASV + ICU Resuscitation Triggered'
    ]),
    'Doctor sahab khet me paani lagate waqt saanp ne kaat liya, pair me do daant ke nishan hain, behad dard aur khoon nikal raha hai...',
    'DIVERTED_EMERGENCY',
    now
  );

  // 10. Patient J: Geeta Rani Patel (42yo, Raipur, Chhattisgarh) - Sickle Cell Trait & Vataja Pandu
  insertPatient.run(
    'pat-010',
    '91-1234-5678-9012',
    'geeta.patel@abdm',
    'Geeta Rani Patel',
    42,
    'FEMALE',
    'XXXXXX1122',
    'hi',
    'Vata-Pitta',
    0, null, 0, 50,
    now
  );
  insertSession.run(
    'sess-010',
    'pat-010',
    JSON.stringify([
      { name: 'Severe Fatigue, Bodyache & Exertional Breathlessness', rawVernacular: 'behad thakan aur sharir me dard', site: 'Systemic & Long Bones', onset: '2 months', character: 'Aching deep bone pains and generalized pallor', severity: 6, isNegated: false }
    ]),
    JSON.stringify({
      prakriti: 'Vata-Pitta', vikriti: 'Pandu Roga & Rasa-Rakta Dhatu Kshaya', sara: 'Avara (Asara)', samhanana: 'Heena', pramana: 'Krsha', satmya: 'Ritu Satmya', sattva: 'Madhyama', aharaShakti: 'Heena', vyayamaShakti: 'Low', vaya: 'Madhyama', agni: 'Mandagni', amaPresent: true
    }),
    JSON.stringify({ bp: '110/72', pulse: 88, spo2: '97%', temp: '98.6°F' }),
    'HIGH_PRIORITY',
    JSON.stringify(['Microcytic Hypochromic Severe Anemia (Hb 7.4 g/dL) with Sickle Cell Solubility Positive']),
    'Doctor didi, bohot thakan lagti hai, thoda chalne par hi saans phoolti hai aur haddiyo me meetha dard rehta hai...',
    'PENDING_DOCTOR',
    now
  );
  insertDoc.run(
    'doc-004',
    'pat-010',
    'LAB_REPORT',
    'DISTRICT HOSPITAL RAIPUR HEMATOLOGY: Hemoglobin: 7.4 g/dL (LOW, Ref: 12.0-15.5), RBC: 3.1 million/mcL, Peripheral Smear: Target cells & sickled RBCs seen, Sickling Test: POSITIVE',
    JSON.stringify({ hemoglobin: 7.4, rbc: 3.1, sickling: 'POSITIVE' }),
    now
  );

  // Seed Completed Clinical Encounters in encounters Table for Pharmacy Desk & Audit Verification
  insertEncounter.run(
    'enc-001',
    'sess-004',
    'pat-004',
    'doc-001',
    'Dr. Rajesh Shastri, BAMS, MD (Ayu)',
    'Room 08 (Kayachikitsa / Prameha Clinic)',
    JSON.stringify({
      encounterId: 'enc-001',
      sessionId: 'sess-004',
      patientId: 'pat-004',
      doctorName: 'Dr. Rajesh Shastri, BAMS, MD (Ayu)',
      department: 'Room 08 (Kayachikitsa / Prameha Clinic)',
      allopathicPrescription: [
        { name: 'Metformin Hydrochloride', dosage: '500 mg', route: 'ORAL', frequency: 'BD after food', durationDays: 30, instructions: 'Swallow whole with plain water' }
      ],
      ayushPrescription: [
        { classicalName: 'Nisha Amalaki Churna', namasteCode: 'AYU-CH-019', dosageForm: 'Churna', dose: '3 grams', anupana: 'Koshna Jala (Warm Water)', frequency: 'BD before food', durationDays: 30 }
      ],
      conflictAlerts: [],
      doctorNotes: 'Prameha follow-up. Blood sugar 218 mg/dL. Prescribed integrative regimen with kidney function monitoring.',
      createdAt: now
    }),
    JSON.stringify({ resourceType: 'Bundle', id: 'bundle-enc-001' }),
    JSON.stringify({ protocol: 'groth16', curve: 'bn128', verified: true }),
    now
  );

  insertEncounter.run(
    'enc-002',
    'sess-006',
    'pat-006',
    'doc-002',
    'Dr. Ananya Sharma, MD',
    'Room 14 (Geriatric & Integrative Medicine)',
    JSON.stringify({
      encounterId: 'enc-002',
      sessionId: 'sess-006',
      patientId: 'pat-006',
      doctorName: 'Dr. Ananya Sharma, MD',
      department: 'Room 14 (Geriatric & Integrative Medicine)',
      allopathicPrescription: [
        { name: 'Amlodipine Besylate', dosage: '5 mg', route: 'ORAL', frequency: 'OD (Morning)', durationDays: 30 },
        { name: 'Paracetamol', dosage: '500 mg', route: 'ORAL', frequency: 'SOS (Max 3/day)', durationDays: 7, instructions: 'Renal-safe analgesic. Strictly avoid NSAIDs.' }
      ],
      ayushPrescription: [
        { classicalName: 'Rasnasaptaka Kwatha (AIIA Safe Renal Formulation)', namasteCode: 'AYU-KW-042', dosageForm: 'Kwatha', dose: '15 ml with equal warm water', anupana: 'Koshna Jala', frequency: 'BD after food', durationDays: 30 }
      ],
      conflictAlerts: [
        { severity: 'CRITICAL_LASA', drugName: 'Amlodipine', warningMessage: 'Monitor blood pressure weekly.' }
      ],
      doctorNotes: 'Elderly sarcopenic patient with eGFR 31.8 mL/min. NSAIDs contraindicated. Warfarin INR stable at 2.4.',
      createdAt: now
    }),
    JSON.stringify({ resourceType: 'Bundle', id: 'bundle-enc-002' }),
    JSON.stringify({ protocol: 'groth16', curve: 'bn128', verified: true }),
    now
  );

  console.log('[Seed] Database successfully seeded with 10 diverse Pan-Indian clinical patients and physical SQLite encounters.');
}

if (require.main === module) {
  seedDatabase();
}

