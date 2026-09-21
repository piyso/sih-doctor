/**
 * High-Performance Sovereign SQLite Engine with Write-Ahead Logging (WAL)
 * Provides sub-millisecond local persistence, zero cloud leaks, and air-gap endurance.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.resolve(__dirname, '../../data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = process.env.DB_PATH || path.join(DB_DIR, 'hospital.db');

export const db: Database.Database = new Database(DB_PATH);

// Configure SQLite for high concurrency and zero-busy locks
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    abha_id TEXT UNIQUE,
    abha_address TEXT,
    name TEXT NOT NULL,
    age INTEGER NOT NULL,
    gender TEXT NOT NULL,
    phone_masked TEXT,
    language TEXT DEFAULT 'hi',
    prakriti TEXT,
    is_pregnant INTEGER DEFAULT 0,
    gestational_weeks INTEGER,
    is_lactating INTEGER DEFAULT 0,
    weight_kg REAL,
    created_at TEXT NOT NULL
  );


  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    symptoms_json TEXT,
    pariksha_json TEXT,
    vitals_json TEXT,
    triage_priority TEXT DEFAULT 'ROUTINE',
    red_flag_triggers TEXT,
    raw_transcript TEXT,
    status TEXT DEFAULT 'PENDING_DOCTOR',
    created_at TEXT NOT NULL,
    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    document_type TEXT NOT NULL,
    extracted_text TEXT,
    metadata_json TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS encounters (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    doctor_id TEXT NOT NULL,
    doctor_name TEXT NOT NULL,
    department TEXT NOT NULL,
    case_sheet_json TEXT NOT NULL,
    fhir_bundle_json TEXT,
    zkp_proof_json TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    entity_id TEXT,
    actor TEXT,
    metadata_json TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS causal_edges (
    id TEXT PRIMARY KEY,
    source_entity TEXT NOT NULL,
    target_entity TEXT NOT NULL,
    relation_type TEXT NOT NULL,
    strength REAL NOT NULL,
    mechanism TEXT,
    evidence_source TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bayesian_observations (
    id TEXT PRIMARY KEY,
    item_a TEXT NOT NULL,
    item_b TEXT NOT NULL,
    signal TEXT NOT NULL,
    source_reliability REAL NOT NULL,
    method TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS merkle_fact_nodes (
    id TEXT PRIMARY KEY,
    encounter_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    predicate TEXT NOT NULL,
    object TEXT NOT NULL,
    evidence_score REAL NOT NULL,
    node_hash TEXT NOT NULL,
    parent_hash TEXT,
    intervals_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ephemeral_drafts (
    id TEXT PRIMARY KEY,
    phone TEXT,
    name TEXT,
    draft_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Bharatiya Sakshya Adhiniyam 2023 (§63) Cryptographic Audit Trail
  CREATE TABLE IF NOT EXISTS bsa_audit_trail (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    source_image_sha256 TEXT NOT NULL,
    ocr_raw_text_sha256 TEXT NOT NULL,
    extracted_json_sha256 TEXT NOT NULL,
    prev_audit_hash TEXT,
    current_audit_hash TEXT NOT NULL,
    operator_id TEXT NOT NULL,
    verification_status TEXT DEFAULT 'VERIFIED_LEGAL_EVIDENCE',
    timestamp TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
  CREATE INDEX IF NOT EXISTS idx_sessions_triage ON sessions(triage_priority);
  CREATE INDEX IF NOT EXISTS idx_encounters_patient ON encounters(patient_id);
  CREATE INDEX IF NOT EXISTS idx_causal_source ON causal_edges(source_entity);
  CREATE INDEX IF NOT EXISTS idx_causal_target ON causal_edges(target_entity);
  CREATE INDEX IF NOT EXISTS idx_bayesian_pair ON bayesian_observations(item_a, item_b);
  CREATE INDEX IF NOT EXISTS idx_merkle_encounter ON merkle_fact_nodes(encounter_id);
  CREATE INDEX IF NOT EXISTS idx_drafts_phone ON ephemeral_drafts(phone);
  CREATE INDEX IF NOT EXISTS idx_drafts_name ON ephemeral_drafts(name);
  CREATE INDEX IF NOT EXISTS idx_bsa_doc ON bsa_audit_trail(document_id);
`);

// Safe column migrations for existing databases
try { db.exec('ALTER TABLE patients ADD COLUMN is_pregnant INTEGER DEFAULT 0;'); } catch {}
try { db.exec('ALTER TABLE patients ADD COLUMN gestational_weeks INTEGER;'); } catch {}
try { db.exec('ALTER TABLE patients ADD COLUMN is_lactating INTEGER DEFAULT 0;'); } catch {}
try { db.exec('ALTER TABLE patients ADD COLUMN weight_kg REAL;'); } catch {}


// Create Virtual Table for FTS5 Trigram Pharmacopoeia Search
try {
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS pharmacopoeia_fts USING fts5(
      canonical_name,
      brand_names,
      category,
      standard_posology,
      indications,
      tokenize='trigram'
    );
  `);
} catch (err) {
  console.warn('[Database] FTS5 Virtual Table initialization warning:', err);
}

// Seed the comprehensive Pharmacopoeia FTS5 Table if empty or incomplete
const countRow = db.prepare('SELECT count(*) as cnt FROM pharmacopoeia_fts').get() as { cnt: number } | undefined;
const hasIndo = db.prepare("SELECT count(*) as cnt FROM pharmacopoeia_fts WHERE canonical_name = 'Indomethacin'").get() as { cnt: number } | undefined;
if (!countRow || countRow.cnt < 45 || !hasIndo || hasIndo.cnt === 0) {
  if (countRow && countRow.cnt > 0) {
    db.exec(`DELETE FROM pharmacopoeia_fts;`);
  }
  const insertFTS = db.prepare(`
    INSERT INTO pharmacopoeia_fts (canonical_name, brand_names, category, standard_posology, indications)
    VALUES (?, ?, ?, ?, ?)
  `);

  const initialSeed: [string, string, string, string, string][] = [
    // Allopathic Cardiovascular & Antihypertensives
    ['Atorvastatin', 'Atorva, Lipitor, Storvas, Tonact, Atocor', 'ALLOPATHIC', '10-80mg OD HS', 'Hypercholesterolemia, Dyslipidemia'],
    ['Rosuvastatin', 'Rosuvas, Crestor, Rozavel, Novastat', 'ALLOPATHIC', '5-40mg OD HS', 'Atherosclerosis, Hyperlipidemia'],
    ['Amlodipine', 'Amlong, Norvasc, Amlovas, Stamlo', 'ALLOPATHIC', '2.5-10mg OD', 'Essential Hypertension, Angina'],
    ['Telmisartan', 'Telma, Micardis, Telmikind, Arbitel, Telsar', 'ALLOPATHIC', '20-80mg OD', 'Hypertension, Diabetic Nephropathy'],
    ['Losartan', 'Losacar, Cozaar, Repace, Alsartan', 'ALLOPATHIC', '25-100mg OD/BD', 'Hypertension, Heart Failure'],
    ['Ramipril', 'Cardace, Altace, Ramipres, Hopace', 'ALLOPATHIC', '2.5-10mg OD', 'Post-MI, Hypertension'],
    ['Enalapril', 'Envas, Vasotec, Enam', 'ALLOPATHIC', '2.5-20mg OD/BD', 'Congestive Heart Failure, Hypertension'],
    ['Metoprolol', 'Betaloc, Lopressor, Metolar, Starpress', 'ALLOPATHIC', '25-100mg OD/BD', 'Arrhythmia, Angina, Hypertension'],
    ['Atenolol', 'Aten, Tenormin, Betacard', 'ALLOPATHIC', '25-100mg OD', 'Hypertension, Angina'],
    ['Clopidogrel', 'Deplatt, Plavix, Clopilet, Ceruvin', 'ALLOPATHIC', '75mg OD', 'Acute Coronary Syndrome, Stent Thrombosis'],
    ['Aspirin', 'Ecosprin, Disprin, Loprin, Delisprin', 'ALLOPATHIC', '75-150mg OD', 'Secondary Prophylaxis of MI / Stroke'],

    // Allopathic Endocrine & Diabetes
    ['Metformin', 'Glycomet, Glucophage, Obimet, Cetapin, Bigomet', 'ALLOPATHIC', '500-2000mg BD PC', 'Type 2 Diabetes Mellitus, Glycemic Control'],
    ['Glimepiride', 'Amaryl, Glimy, Zoryl, Glimestar', 'ALLOPATHIC', '1-4mg OD AC', 'Type 2 Diabetes Mellitus'],
    ['Gliclazide', 'Diamicron, Reclide, Glycinorm', 'ALLOPATHIC', '40-160mg OD/BD', 'Type 2 Diabetes Mellitus'],
    ['Teneligliptin', 'Ziten, Tenglyn, Dynaglipt, Afoglip', 'ALLOPATHIC', '20mg OD', 'Type 2 Diabetes Mellitus'],
    ['Sitagliptin', 'Januvia, Istavel, Sitaglyn', 'ALLOPATHIC', '50-100mg OD', 'Type 2 Diabetes Mellitus'],
    ['Vildagliptin', 'Galvus, Jalra, Zomelis, Vysov', 'ALLOPATHIC', '50mg BD', 'Type 2 Diabetes Mellitus'],
    ['Dapagliflozin', 'Forxiga, Oxra, Dapaone, Dapavel', 'ALLOPATHIC', '5-10mg OD', 'T2D, Heart Failure, CKD'],
    ['Empagliflozin', 'Jardiance, Gibtulio', 'ALLOPATHIC', '10-25mg OD', 'T2D, Cardiovascular Risk Reduction'],
    ['Levothyroxine', 'Thyronorm, Eltroxin, Thyrox', 'ALLOPATHIC', '25-150mcg OD AC', 'Hypothyroidism, Thyroid Goiter'],

    // Allopathic Gastrointestinal
    ['Pantoprazole', 'Pan, Pantocid, Pantodac, Pantosec', 'ALLOPATHIC', '40mg OD AC', 'GERD, Peptic Ulcer Disease, Hyperacidity'],
    ['Omeprazole', 'Omez, Prilosec, Ocid, Omecip', 'ALLOPATHIC', '20mg OD AC', 'Acid Peptic Disease, Gastritis'],
    ['Rabeprazole', 'Razo, Pariet, Happi, Rablet', 'ALLOPATHIC', '20mg OD AC', 'GERD, Zollinger-Ellison'],
    ['Esomeprazole', 'Nexpro, Nexium, Esomac', 'ALLOPATHIC', '20-40mg OD AC', 'Erosive Esophagitis'],
    ['Domperidone', 'Domstal, Motilium, Vomistop', 'ALLOPATHIC', '10mg TDS AC', 'Nausea, Gastroparesis'],
    ['Ondansetron', 'Emeset, Zofran, Vomikind, Ondem', 'ALLOPATHIC', '4-8mg BD/TDS', 'Chemotherapy/Post-op Nausea'],
    ['Sucralfate', 'Sucrafil, Carafate, Pepsigard', 'ALLOPATHIC', '1g QID AC', 'Duodenal Ulcer, Mucosal Protection'],

    // Allopathic Analgesics & Anti-inflammatory
    ['Paracetamol', 'Calpol, Dolo, Crocin, Pacimol, Febrex', 'ALLOPATHIC', '500-650mg TDS/QID', 'Pyrexia, Mild-to-Moderate Pain'],
    ['Ibuprofen', 'Brufen, Combiflam, Ibugesic', 'ALLOPATHIC', '200-400mg TDS PC', 'Musculoskeletal Pain, Dysmenorrhea'],
    ['Diclofenac', 'Voveran, Voltaren, Diclogesic', 'ALLOPATHIC', '50mg BD/TDS PC', 'Osteoarthritis, Acute Pain'],
    ['Aceclofenac', 'Zerodol, Hifenac, Aceclo', 'ALLOPATHIC', '100mg BD PC', 'Rheumatoid Arthritis, Ankylosing Spondylitis'],
    ['Indomethacin', 'Indocap, Inmecin, Indocin', 'ALLOPATHIC', '25-50mg BD/TDS PC', 'Acute Gout, Ankylosing Spondylitis, Severe Arthritis'],
    ['Tramadol', 'Ultracet, Tramazac, Domadol', 'ALLOPATHIC', '50-100mg BD/TDS', 'Moderate-to-Severe Pain'],

    // Allopathic Renal & Diuretics
    ['Furosemide', 'Lasix, Frusenex, Salinex', 'ALLOPATHIC', '20-80mg OD/BD', 'Edema, Congestive Heart Failure, Renal Fluid Overload'],
    ['Tamsulosin', 'Urimax, Flomax, Dynapres', 'ALLOPATHIC', '0.4mg OD HS', 'Benign Prostatic Hyperplasia, Mutrakricchra'],

    // Allopathic Dermatology & Cutaneous
    ['Clotrimazole', 'Candid, Canesten, Surfaz', 'ALLOPATHIC', 'Apply BD/TDS topically', 'Tinea, Cutaneous Candidiasis, Fungal Skin Rash'],

    // Allopathic Ophthalmology & ENT
    ['Moxifloxacin', 'Vigamox, Mahaflox, Moxicip', 'ALLOPATHIC', '1-2 drops QID / 400mg OD', 'Bacterial Conjunctivitis, Ocular Infections'],

    // Allopathic Antimicrobials
    ['Amoxicillin-Clavulanate', 'Augmentin, Moxikind-CV, Clavam, Megamentin', 'ALLOPATHIC', '625mg BD PC', 'Respiratory & Soft Tissue Infections'],
    ['Azithromycin', 'Azithral, Zithromax, Azee, Zady', 'ALLOPATHIC', '500mg OD for 3-5 days', 'Atypical Pneumonia, ENT Infections'],
    ['Ciprofloxacin', 'Ciplox, Cifran, Ciprobid', 'ALLOPATHIC', '500mg BD PC', 'UTI, Typhoid, Bacterial Diarrhea'],
    ['Levofloxacin', 'Levomac, Loxof, Glevo', 'ALLOPATHIC', '500mg OD', 'Community Acquired Pneumonia, UTI'],
    ['Cefixime', 'Zifi, Taxim-O, Cefolac, Mahacef', 'ALLOPATHIC', '200mg BD PC', 'Enteric Fever, Gonococcal Infections'],
    ['Metronidazole', 'Flagyl, Metrogyl, Aristogyl', 'ALLOPATHIC', '400mg TDS PC', 'Amoebiasis, Anaerobic Infections'],

    // Allopathic Respiratory
    ['Salbutamol', 'Asthalin, Ventolin, Salbair', 'ALLOPATHIC', '2-4mg TDS / Inhaler PRN', 'Bronchospasm, Asthma, COPD'],
    ['Levocetirizine', 'Levocet, Teczine, Vozet', 'ALLOPATHIC', '5mg OD HS', 'Allergic Rhinitis, Urticaria'],
    ['Montelukast', 'Montair, Singulair, Romilast', 'ALLOPATHIC', '10mg OD HS', 'Prophylaxis of Chronic Asthma'],

    // Canonical Ayurvedic Formulations (AFI) - Guggulus
    ['Yogaraja Guggulu', 'Yograj Guggul, Baidyanath Yograj, Dabur Yograj', 'AYUSH', '2 Vati BD with Ushnodaka', 'Amavata, Sandhivata, Vata Vyadhi'],
    ['Kaishore Guggulu', 'Kaishore Guggul, Baidyanath Kaishore', 'AYUSH', '2 Vati BD with Manjishtadi Kwatha', 'Vatarakta (Gout), Prameha Pidika'],
    ['Kanchanara Guggulu', 'Kanchnar Guggulu, Dabur Kanchnar', 'AYUSH', '2 Vati BD with Varunadi Kwatha', 'Galaganda, Gandamala, Arbuda, Thyroid'],
    ['Gokshuradi Guggulu', 'Gokshura Guggulu, Baidyanath Gokshuradi', 'AYUSH', '2 Vati BD with Musta Kwatha', 'Mutrakricchra, Ashmari, Prameha'],
    ['Triphala Guggulu', 'Triphala Guggul, Zandu Triphala Guggulu', 'AYUSH', '2 Vati BD with Warm Water', 'Arsha (Piles), Bhagandara (Fistula), Shotha'],
    ['Punarnavadi Guggulu', 'Punarnavadi Guggul', 'AYUSH', '2 Vati BD with Punarnavadi Kwatha', 'Vrikka Roga, Sarvanga Shotha, Udara'],
    ['Mahayograj Guggulu', 'Maha Yograj Guggul with Bhasma', 'AYUSH', '1-2 Vati BD with Rasnadi Kwatha', 'Chronic Sandhivata, Pakshaghata'],
    ['Simhanada Guggulu', 'Singhnad Guggul', 'AYUSH', '2 Vati BD with Warm Water', 'Amavata, Khanja, Pangu'],
    ['Lakshadi Guggulu', 'Laksha Guggulu', 'AYUSH', '2 Vati BD with Milk/Ksheera', 'Asthibhanga (Fractures), Asthisoushirya'],

    // Canonical Ayurvedic Formulations (AFI) - Vatis & Gutikas
    ['Chitrakadi Vati', 'Chitrakadi Bati', 'AYUSH', '1-2 Vati BD AC with Buttermilk/Takra', 'Agnimandya, Ajeerna, Grahani'],
    ['Chandraprabha Vati', 'Chandraprabha Bati, Dabur Chandraprabha', 'AYUSH', '2 Vati BD with Milk or Water', 'Prameha, Mutrakricchra, Shukradosha'],
    ['Sanjivani Vati', 'Sanjeevani Vati', 'AYUSH', '1 Vati BD with Ginger juice/Ardraka Swarasa', 'Ajirna, Gulma, Sannipata Jwara'],
    ['Arogyavardhini Vati', 'Arogyavardhini Bati, Baidyanath Arogyavardhini', 'AYUSH', '2 Vati BD with Milk or Warm Water', 'Yakrit Roga (Liver), Kushtha, Medoroga'],
    ['Shankha Vati', 'Shankh Bati', 'AYUSH', '1-2 Vati BD AC with Nimbu Swarasa', 'Shoola, Amlapitta, Grahani'],
    ['Lashunadi Vati', 'Lasunadi Bati', 'AYUSH', '2 Vati BD with Warm Water', 'Visuchika, Atisara, Agnimandya'],
    ['Brahmi Vati', 'Brahmi Bati with Gold/Suvarna', 'AYUSH', '1 Vati BD with Honey or Milk', 'Unmada, Smriti Dourbalya, Anidra'],
    ['Kutajghan Vati', 'Kutajghan Bati', 'AYUSH', '2 Vati TDS with Kutajarishta', 'Atisara, Pravahika, Grahani'],

    // Canonical Ayurvedic Formulations (AFI) - Churnas
    ['Triphala Churna', 'Triphla Powder, Baidyanath Triphala', 'AYUSH', '3-6g HS with Lukewarm Water', 'Vibandha (Constipation), Netraroga, Prameha'],
    ['Ashwagandha Churna', 'Ashwagandh Powder, Dabur Ashwagandha', 'AYUSH', '3-5g BD with Milk (Ksheera)', 'Kshaya, Dourbalya, Klaibya, Vata Vyadhi'],
    ['Sitopaladi Churna', 'Sitopladi Churan, Dabur Sitopaladi', 'AYUSH', '2-4g TDS with Honey & Ghrita', 'Kasa, Shwasa, Kshaya, Mandagni'],
    ['Trikatu Churna', 'Trikatu Powder', 'AYUSH', '1-2g BD with Honey', 'Shwasa, Kasa, Agnimandya, Gala Roga'],
    ['Avipattikar Churna', 'Avipattikar Powder, Baidyanath Avipattikar', 'AYUSH', '3-6g BD AC with Coconut Water or Milk', 'Amlapitta, Vibandha, Agnimandya'],
    ['Hingwashtak Churna', 'Hingwastak Powder', 'AYUSH', '2-3g BD with First morsel of food + Ghee', 'Vatagulma, Adhmana, Shoola'],

    // Canonical Ayurvedic Formulations (AFI) - Asavas & Arishtas
    ['Ashwagandharishta', 'Ashwagandha Arishta', 'AYUSH', '15-25ml BD with Equal Water PC', 'Murcha, Apasmara, Shosha, Karshya'],
    ['Draksharishta', 'Draksharisht', 'AYUSH', '15-25ml BD with Equal Water PC', 'Urakshata, Kasa, Shwasa, Dourbalya'],
    ['Dashmoolarishta', 'Dashmularishta', 'AYUSH', '15-25ml BD with Equal Water PC', 'Sutika Roga, Vata Vyadhi, Grahani'],
    ['Arjunarishta', 'Parthadhyarishta', 'AYUSH', '15-25ml BD with Equal Water PC', 'Hridroga (Cardiac Tonic), Raktapitta'],
    ['Punarnavasava', 'Punarnavasavam', 'AYUSH', '15-25ml BD with Equal Water PC', 'Shotha, Udara, Yakritodara, Plihodara']
  ];

  const insertMany = db.transaction((rows: [string, string, string, string, string][]) => {
    for (const r of rows) {
      insertFTS.run(r[0], r[1], r[2], r[3], r[4]);
    }
  });

  insertMany(initialSeed);
  console.log(`[Database] Seeded ${initialSeed.length} canonical Allopathic & AFI formulations into FTS5 trigram virtual table.`);
}

console.log(`[Database] Sovereign SQLite engine initialized in WAL mode at: ${DB_PATH}`);
