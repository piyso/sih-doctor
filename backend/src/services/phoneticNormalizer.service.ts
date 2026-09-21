/**
 * PhoneticNormalizer — Code-Switching & Clinical Dialect Normalizer
 * Ported & adapted from 1.piynoteskiro (src/main/services/PhoneticNormalizer.ts)
 *
 * Normalizes colloquial Hinglish, Devanagari, and Indian clinical colloquialisms
 * into standardized clinical and AYUSH terminologies prior to parsing and ontology mapping.
 */

export interface ClinicalPhoneticMapping {
  raw: string;
  canonical: string;
  category: 'symptom' | 'herb' | 'drug' | 'dosha' | 'colloquial';
}

export const CLINICAL_PHONETIC_DICTIONARY: ClinicalPhoneticMapping[] = [
  // Chest & Cardiac (Hindi, Hinglish, Bhojpuri, Awadhi, Haryanvi)
  { raw: 'chaati me bojh', canonical: 'Substernal Crushing Pressure', category: 'symptom' },
  { raw: 'seene me dard', canonical: 'Substernal Chest Pain', category: 'symptom' },
  { raw: 'chhati me dard', canonical: 'Substernal Chest Pain', category: 'symptom' },
  { raw: 'kareja me dard', canonical: 'Substernal Chest Pain', category: 'symptom' },
  { raw: 'chhatiya me bada bhari dard', canonical: 'Substernal Crushing Pressure', category: 'symptom' },
  { raw: 'chhati ke beech me ghana dard', canonical: 'Substernal Crushing Pressure', category: 'symptom' },
  { raw: 'chhati me ghanero dard', canonical: 'Substernal Chest Pain', category: 'symptom' },
  { raw: 'paseena chhoot raha', canonical: 'Marked Diaphoresis', category: 'symptom' },
  { raw: 'pasina aa raha', canonical: 'Diaphoresis', category: 'symptom' },
  { raw: 'pasina chootat ba', canonical: 'Marked Diaphoresis', category: 'symptom' },
  { raw: 'saans phool rahi', canonical: 'Dyspnea / Breathlessness', category: 'symptom' },
  { raw: 'dum phoolna', canonical: 'Dyspnea / Breathlessness', category: 'symptom' },
  { raw: 'dhadkan tez', canonical: 'Tachycardia / Palpitations', category: 'symptom' },
  { raw: 'baaye haath me dard', canonical: 'Left Arm Radiation Pain', category: 'symptom' },
  { raw: 'baaye baahu me dard', canonical: 'Left Arm Radiation Pain', category: 'symptom' },

  // Tamil (Clinical Vernacular & Script)
  { raw: 'nenju vali', canonical: 'Substernal Chest Pain', category: 'symptom' },
  { raw: 'nenjil vali', canonical: 'Substernal Chest Pain', category: 'symptom' },
  { raw: 'nenjil param', canonical: 'Substernal Crushing Pressure', category: 'symptom' },
  { raw: 'adhika viyarvai', canonical: 'Marked Diaphoresis', category: 'symptom' },
  { raw: 'moochu thinaral', canonical: 'Dyspnea / Breathlessness', category: 'symptom' },
  { raw: 'நெஞ்சு வலி', canonical: 'Substernal Chest Pain', category: 'symptom' },
  { raw: 'அதிக வியர்வை', canonical: 'Marked Diaphoresis', category: 'symptom' },

  // Telugu (Clinical Vernacular & Script)
  { raw: 'chati noppi', canonical: 'Substernal Chest Pain', category: 'symptom' },
  { raw: 'gunde noppi', canonical: 'Substernal Chest Pain', category: 'symptom' },
  { raw: 'chati lo baram', canonical: 'Substernal Crushing Pressure', category: 'symptom' },
  { raw: 'chematlu', canonical: 'Diaphoresis', category: 'symptom' },
  { raw: 'swasa aadakapovadam', canonical: 'Dyspnea / Breathlessness', category: 'symptom' },
  { raw: 'ఛాతీ నొప్పి', canonical: 'Substernal Chest Pain', category: 'symptom' },
  { raw: 'గుండె నొప్పి', canonical: 'Substernal Chest Pain', category: 'symptom' },

  // Bengali (Clinical Vernacular & Script)
  { raw: 'buke byatha', canonical: 'Substernal Chest Pain', category: 'symptom' },
  { raw: 'buke bhalo byatha', canonical: 'Substernal Chest Pain', category: 'symptom' },
  { raw: 'buke chaap', canonical: 'Substernal Crushing Pressure', category: 'symptom' },
  { raw: 'ghamb hochhe', canonical: 'Marked Diaphoresis', category: 'symptom' },
  { raw: 'shaas koshto', canonical: 'Dyspnea / Breathlessness', category: 'symptom' },
  { raw: 'বুকে ব্যথা', canonical: 'Substernal Chest Pain', category: 'symptom' },

  // Marathi (Clinical Vernacular & Script)
  { raw: 'chatit vedana', canonical: 'Substernal Chest Pain', category: 'symptom' },
  { raw: 'chatit dukhne', canonical: 'Substernal Chest Pain', category: 'symptom' },
  { raw: 'chatit khup bhari vedana', canonical: 'Substernal Crushing Pressure', category: 'symptom' },
  { raw: 'gham yet ahe', canonical: 'Marked Diaphoresis', category: 'symptom' },
  { raw: 'dava hatat vedana', canonical: 'Left Arm Radiation Pain', category: 'symptom' },
  { raw: 'छातीत दुखणे', canonical: 'Substernal Chest Pain', category: 'symptom' },

  // Kannada & Malayalam
  { raw: 'ede novu', canonical: 'Substernal Chest Pain', category: 'symptom' },
  { raw: 'seetha bemaru', canonical: 'Cold Diaphoresis', category: 'symptom' },
  { raw: 'nenjil vedana', canonical: 'Substernal Chest Pain', category: 'symptom' },
  { raw: 'viyarppu', canonical: 'Diaphoresis', category: 'symptom' },

  // Joint & Musculoskeletal
  { raw: 'ghutne me cut cut', canonical: 'Janu Sandhi Crepitus', category: 'symptom' },
  { raw: 'ghutno me cut cut', canonical: 'Janu Sandhi Crepitus', category: 'symptom' },
  { raw: 'subah uthke akad jaata', canonical: 'Morning Stiffness (Sandhi Stambha)', category: 'symptom' },
  { raw: 'jodon me sujan', canonical: 'Joint Inflammation / Sandhishotha', category: 'symptom' },
  { raw: 'kamar dard', canonical: 'Kati Shoola / Low Back Pain', category: 'symptom' },

  // Gastrointestinal & Agni (Multi-lingual / Dialectal)
  { raw: 'upari paat', canonical: 'Epigastric Pain / Amlapitta (Upper Abdomen)', category: 'symptom' },
  { raw: 'upari pet', canonical: 'Epigastric Pain / Amlapitta (Upper Abdomen)', category: 'symptom' },
  { raw: 'upri pet', canonical: 'Epigastric Pain / Amlapitta (Upper Abdomen)', category: 'symptom' },
  { raw: 'upri paat', canonical: 'Epigastric Pain / Amlapitta (Upper Abdomen)', category: 'symptom' },
  { raw: 'upar ka pet', canonical: 'Epigastric Pain / Amlapitta (Upper Abdomen)', category: 'symptom' },
  { raw: 'nichali pate', canonical: 'Lower Abdominal / Pelvic Pain (Hypogastrium)', category: 'symptom' },
  { raw: 'nichle pate', canonical: 'Lower Abdominal / Pelvic Pain (Hypogastrium)', category: 'symptom' },
  { raw: 'nichla pet', canonical: 'Lower Abdominal / Pelvic Pain (Hypogastrium)', category: 'symptom' },
  { raw: 'nichli pet', canonical: 'Lower Abdominal / Pelvic Pain (Hypogastrium)', category: 'symptom' },
  { raw: 'nichle pet me dard', canonical: 'Lower Abdominal / Pelvic Pain (Hypogastrium)', category: 'symptom' },
  { raw: 'niche ka pet', canonical: 'Lower Abdominal / Pelvic Pain (Hypogastrium)', category: 'symptom' },
  { raw: 'paat dard', canonical: 'Abdominal Pain / Udarashoola', category: 'symptom' },
  { raw: 'paet dard', canonical: 'Abdominal Pain / Udarashoola', category: 'symptom' },
  { raw: 'pait dard', canonical: 'Abdominal Pain / Udarashoola', category: 'symptom' },
  { raw: 'pait me dard', canonical: 'Abdominal Pain / Udarashoola', category: 'symptom' },
  { raw: 'pet dard', canonical: 'Abdominal Pain / Udarashoola', category: 'symptom' },
  { raw: 'pet me dard', canonical: 'Abdominal Pain / Udarashoola', category: 'symptom' },
  { raw: 'pet kharab', canonical: 'Gastrointestinal Disturbance / Grahani', category: 'symptom' },
  { raw: 'paat kharab', canonical: 'Gastrointestinal Disturbance / Grahani', category: 'symptom' },
  { raw: 'pet me marod', canonical: 'Abdominal Colic / Shoola', category: 'symptom' },
  { raw: 'pet me marodh', canonical: 'Abdominal Colic / Shoola', category: 'symptom' },
  { raw: 'marod uth rahi', canonical: 'Abdominal Colic / Shoola', category: 'symptom' },
  { raw: 'pet phool raha', canonical: 'Abdominal Distension / Aanaha', category: 'symptom' },
  { raw: 'afara', canonical: 'Abdominal Distension / Aanaha', category: 'symptom' },
  { raw: 'afra', canonical: 'Abdominal Distension / Aanaha', category: 'symptom' },
  { raw: 'daye pet me dard', canonical: 'Right Lower Quadrant Appendicitis Pain', category: 'symptom' },
  { raw: 'baye pet me dard', canonical: 'Left Lower Quadrant Renal/Colonic Pain', category: 'symptom' },
  { raw: 'pedu me dard', canonical: 'Pelvic / Hypogastric Pain', category: 'symptom' },
  { raw: 'nabhi me dard', canonical: 'Umbilical Colic / Nabhi Shula', category: 'symptom' },
  { raw: 'kadupu noppi', canonical: 'Abdominal Pain / Udarashoola', category: 'symptom' },
  { raw: 'vayiru vali', canonical: 'Abdominal Pain / Udarashoola', category: 'symptom' },
  { raw: 'pete byatha', canonical: 'Abdominal Pain / Udarashoola', category: 'symptom' },
  { raw: 'potat dukhne', canonical: 'Abdominal Pain / Udarashoola', category: 'symptom' },
  { raw: 'hotte novu', canonical: 'Abdominal Pain / Udarashoola', category: 'symptom' },
  { raw: 'vayar vedana', canonical: 'Abdominal Pain / Udarashoola', category: 'symptom' },
  { raw: 'pet me jalan', canonical: 'Amlapitta / Epigastric Pyrosis', category: 'symptom' },
  { raw: 'khatti dakar', canonical: 'Acid Eructation / Amlodgara', category: 'symptom' },
  { raw: 'pet saaf nahi hota', canonical: 'Vibandha / Constipation', category: 'symptom' },
  { raw: 'bhookh nahi lagti', canonical: 'Aruchi / Anorexia', category: 'symptom' },

  // Respiratory & Fever
  { raw: 'tez bukhar', canonical: 'High Grade Fever / Teekshna Jwara', category: 'symptom' },
  { raw: 'gale me kharash', canonical: 'Pharyngeal Irritation / Kantharoga', category: 'symptom' },
  { raw: 'khansi me balgam', canonical: 'Productive Cough / Kaphaja Kasa', category: 'symptom' },

  // Common Allopathic Brand Names & OTC Colloquials
  { raw: 'antaside', canonical: 'Antacid Suspension', category: 'drug' },
  { raw: 'antacide', canonical: 'Antacid Suspension', category: 'drug' },
  { raw: 'antacid', canonical: 'Antacid Suspension', category: 'drug' },
  { raw: 'antacid syrup', canonical: 'Antacid Suspension', category: 'drug' },
  { raw: 'gelusil', canonical: 'Gelusil Antacid', category: 'drug' },
  { raw: 'gelucil', canonical: 'Gelusil Antacid', category: 'drug' },
  { raw: 'digene', canonical: 'Digene Antacid', category: 'drug' },
  { raw: 'eno', canonical: 'Eno Fruit Salt Antacid', category: 'drug' },
  { raw: 'mucaine gel', canonical: 'Mucaine Gel Antacid', category: 'drug' },
  { raw: 'mucaine', canonical: 'Mucaine Gel Antacid', category: 'drug' },
  { raw: 'pantocid', canonical: 'Pantoprazole', category: 'drug' },
  { raw: 'pan 40', canonical: 'Pantoprazole', category: 'drug' },
  { raw: 'pan forty', canonical: 'Pantoprazole', category: 'drug' },
  { raw: 'pan-d', canonical: 'Pantoprazole + Domperidone (Pan-D)', category: 'drug' },
  { raw: 'pan d', canonical: 'Pantoprazole + Domperidone (Pan-D)', category: 'drug' },
  { raw: 'pantocid dsr', canonical: 'Pantoprazole + Domperidone (Pan-D)', category: 'drug' },
  { raw: 'pantoprazole', canonical: 'Pantoprazole', category: 'drug' },
  { raw: 'rabicip', canonical: 'Rabeprazole', category: 'drug' },
  { raw: 'rabeprazole', canonical: 'Rabeprazole', category: 'drug' },
  { raw: 'rabekind', canonical: 'Rabeprazole', category: 'drug' },
  { raw: 'omez', canonical: 'Omeprazole', category: 'drug' },
  { raw: 'omeprazole', canonical: 'Omeprazole', category: 'drug' },
  { raw: 'nexpro', canonical: 'Esomeprazole', category: 'drug' },
  { raw: 'esomeprazole', canonical: 'Esomeprazole', category: 'drug' },
  { raw: 'aciloc', canonical: 'Ranitidine (Aciloc)', category: 'drug' },
  { raw: 'rantac', canonical: 'Ranitidine (Rantac)', category: 'drug' },
  { raw: 'sucralfate', canonical: 'Sucralfate', category: 'drug' },
  { raw: 'cremaffin', canonical: 'Cremaffin Emulsion', category: 'drug' },
  { raw: 'dulcolax', canonical: 'Bisacodyl (Dulcolax)', category: 'drug' },
  { raw: 'isabgol', canonical: 'Psyllium Husk (Isabgol)', category: 'drug' },
  { raw: 'pudina hara', canonical: 'Pudina Hara (Mentha Satva)', category: 'herb' },
  { raw: 'gasex', canonical: 'Himalaya Gasex', category: 'herb' },
  { raw: 'liv 52', canonical: 'Liv.52 Formulation', category: 'herb' },
  { raw: 'liv.52', canonical: 'Liv.52 Formulation', category: 'herb' },

  // Pain, Analgesics & Anti-inflammatory
  { raw: 'crocin', canonical: 'Paracetamol', category: 'drug' },
  { raw: 'calpol', canonical: 'Paracetamol', category: 'drug' },
  { raw: 'dolo 650', canonical: 'Paracetamol (Dolo 650)', category: 'drug' },
  { raw: 'dolo', canonical: 'Paracetamol (Dolo 650)', category: 'drug' },
  { raw: 'doloo', canonical: 'Paracetamol (Dolo 650)', category: 'drug' },
  { raw: 'paracitmol', canonical: 'Paracetamol', category: 'drug' },
  { raw: 'paracitamol', canonical: 'Paracetamol', category: 'drug' },
  { raw: 'paracetamol', canonical: 'Paracetamol', category: 'drug' },
  { raw: 'combiflam', canonical: 'Combiflam (Ibuprofen + Paracetamol)', category: 'drug' },
  { raw: 'meftal spas', canonical: 'Meftal-Spas (Mefenamic + Dicyclomine)', category: 'drug' },
  { raw: 'meftal', canonical: 'Meftal (Mefenamic Acid)', category: 'drug' },
  { raw: 'brufen', canonical: 'Ibuprofen (Brufen)', category: 'drug' },
  { raw: 'voveran', canonical: 'Diclofenac (Voveran)', category: 'drug' },
  { raw: 'zerodol sp', canonical: 'Zerodol-SP (Aceclofenac + Serratiopeptidase)', category: 'drug' },
  { raw: 'zerodol', canonical: 'Aceclofenac (Zerodol)', category: 'drug' },
  { raw: 'aceclofenac', canonical: 'Aceclofenac', category: 'drug' },
  { raw: 'etoricoxib', canonical: 'Etoricoxib', category: 'drug' },
  { raw: 'tramadol', canonical: 'Tramadol', category: 'drug' },
  { raw: 'ultracet', canonical: 'Ultracet (Tramadol + Paracetamol)', category: 'drug' },
  { raw: 'volini', canonical: 'Volini Pain Gel (Diclofenac)', category: 'drug' },
  { raw: 'disprin', canonical: 'Aspirin (Disprin)', category: 'drug' },
  { raw: 'saridon', canonical: 'Saridon Analgesic', category: 'drug' },
  { raw: 'nurokind', canonical: 'Mecobalamin (Nurokind)', category: 'drug' },
  { raw: 'neurobion', canonical: 'Neurobion Forte', category: 'drug' },
  { raw: 'becosules', canonical: 'Becosules B-Complex', category: 'drug' },
  { raw: 'limcee', canonical: 'Vitamin C (Limcee 500mg)', category: 'drug' },

  // Antibiotics & Anti-infectives
  { raw: 'augmentin 625', canonical: 'Amoxicillin-Clavulanate (Augmentin 625)', category: 'drug' },
  { raw: 'augmentin', canonical: 'Amoxicillin-Clavulanate (Augmentin)', category: 'drug' },
  { raw: 'moxikind', canonical: 'Amoxicillin', category: 'drug' },
  { raw: 'amoxicillin', canonical: 'Amoxicillin', category: 'drug' },
  { raw: 'azithral', canonical: 'Azithromycin (Azithral)', category: 'drug' },
  { raw: 'azithro', canonical: 'Azithromycin', category: 'drug' },
  { raw: 'azithromycin', canonical: 'Azithromycin', category: 'drug' },
  { raw: 'cefixime', canonical: 'Cefixime', category: 'drug' },
  { raw: 'taxim o', canonical: 'Cefixime (Taxim-O)', category: 'drug' },
  { raw: 'mahacef', canonical: 'Cefixime (Mahacef)', category: 'drug' },
  { raw: 'ciprofloxacin', canonical: 'Ciprofloxacin', category: 'drug' },
  { raw: 'ciplox', canonical: 'Ciprofloxacin (Ciplox)', category: 'drug' },
  { raw: 'norfloxacin', canonical: 'Norfloxacin', category: 'drug' },
  { raw: 'norflox tz', canonical: 'Norfloxacin + Tinidazole (Norflox-TZ)', category: 'drug' },
  { raw: 'norflox-tz', canonical: 'Norfloxacin + Tinidazole (Norflox-TZ)', category: 'drug' },
  { raw: 'ofloxacin', canonical: 'Ofloxacin', category: 'drug' },
  { raw: 'oflox oz', canonical: 'Ofloxacin + Ornidazole (Oflox-OZ)', category: 'drug' },
  { raw: 'oflox-oz', canonical: 'Ofloxacin + Ornidazole (Oflox-OZ)', category: 'drug' },
  { raw: 'metrogyl', canonical: 'Metronidazole (Metrogyl)', category: 'drug' },
  { raw: 'metronidazole', canonical: 'Metronidazole', category: 'drug' },
  { raw: 'doxycycline', canonical: 'Doxycycline', category: 'drug' },
  { raw: 'levofloxacin', canonical: 'Levofloxacin', category: 'drug' },
  { raw: 'levomac', canonical: 'Levofloxacin (Levomac)', category: 'drug' },

  // Allergy, Cold & Cough
  { raw: 'cetrizine', canonical: 'Cetirizine', category: 'drug' },
  { raw: 'cetzine', canonical: 'Cetirizine', category: 'drug' },
  { raw: 'cetirizine', canonical: 'Cetirizine', category: 'drug' },
  { raw: 'levocetirizine', canonical: 'Levocetirizine', category: 'drug' },
  { raw: '1 al', canonical: 'Levocetirizine (1-AL)', category: 'drug' },
  { raw: 'allegra', canonical: 'Fexofenadine (Allegra)', category: 'drug' },
  { raw: 'fexofenadine', canonical: 'Fexofenadine', category: 'drug' },
  { raw: 'montair lc', canonical: 'Montelukast + Levocetirizine (Montair-LC)', category: 'drug' },
  { raw: 'montair', canonical: 'Montelukast (Montair)', category: 'drug' },
  { raw: 'montelukast', canonical: 'Montelukast', category: 'drug' },
  { raw: 'ascoril', canonical: 'Ascoril Cough Expectorant', category: 'drug' },
  { raw: 'grilinctus', canonical: 'Grilinctus Cough Syrup', category: 'drug' },
  { raw: 'benadryl', canonical: 'Benadryl Cough Formula', category: 'drug' },
  { raw: 'alex', canonical: 'Alex Cough Syrup', category: 'drug' },
  { raw: 'cheston cold', canonical: 'Cheston Cold Tablet', category: 'drug' },
  { raw: 'sinarest', canonical: 'Sinarest Tablet', category: 'drug' },
  { raw: 'wikoryl', canonical: 'Wikoryl Tablet', category: 'drug' },
  { raw: 'strepsils', canonical: 'Strepsils Antiseptic Lozenge', category: 'drug' },

  // Cardio, Diabetes & Chronic
  { raw: 'glycomet', canonical: 'Metformin', category: 'drug' },
  { raw: 'metformin', canonical: 'Metformin', category: 'drug' },
  { raw: 'glimepiride', canonical: 'Glimepiride', category: 'drug' },
  { raw: 'amaryl', canonical: 'Glimepiride (Amaryl)', category: 'drug' },
  { raw: 'glynase', canonical: 'Glipizide (Glynase)', category: 'drug' },
  { raw: 'teneligliptin', canonical: 'Teneligliptin', category: 'drug' },
  { raw: 'vildagliptin', canonical: 'Vildagliptin', category: 'drug' },
  { raw: 'galvus', canonical: 'Vildagliptin (Galvus)', category: 'drug' },
  { raw: 'dapagliflozin', canonical: 'Dapagliflozin', category: 'drug' },
  { raw: 'forxiga', canonical: 'Dapagliflozin (Forxiga)', category: 'drug' },
  { raw: 'empagliflozin', canonical: 'Empagliflozin', category: 'drug' },
  { raw: 'jardiance', canonical: 'Empagliflozin (Jardiance)', category: 'drug' },
  { raw: 'januvia', canonical: 'Sitagliptin (Januvia)', category: 'drug' },
  { raw: 'sitagliptin', canonical: 'Sitagliptin', category: 'drug' },
  { raw: 'janumet', canonical: 'Sitagliptin + Metformin (Janumet)', category: 'drug' },
  { raw: 'telma 40', canonical: 'Telmisartan (Telma-40)', category: 'drug' },
  { raw: 'telma', canonical: 'Telmisartan', category: 'drug' },
  { raw: 'telmisartan', canonical: 'Telmisartan', category: 'drug' },
  { raw: 'telpres', canonical: 'Telmisartan (Telpres)', category: 'drug' },
  { raw: 'amlong', canonical: 'Amlodipine (Amlong)', category: 'drug' },
  { raw: 'amlodipine', canonical: 'Amlodipine', category: 'drug' },
  { raw: 'cilnidipine', canonical: 'Cilnidipine', category: 'drug' },
  { raw: 'cilacar', canonical: 'Cilnidipine (Cilacar)', category: 'drug' },
  { raw: 'atenolol', canonical: 'Atenolol', category: 'drug' },
  { raw: 'aten', canonical: 'Atenolol', category: 'drug' },
  { raw: 'metoprolol', canonical: 'Metoprolol', category: 'drug' },
  { raw: 'betaloc', canonical: 'Metoprolol (Betaloc)', category: 'drug' },
  { raw: 'atorva', canonical: 'Atorvastatin (Atorva)', category: 'drug' },
  { raw: 'atorvastatin', canonical: 'Atorvastatin', category: 'drug' },
  { raw: 'lipitor', canonical: 'Atorvastatin (Lipitor)', category: 'drug' },
  { raw: 'rosuvas', canonical: 'Rosuvastatin (Rosuvas)', category: 'drug' },
  { raw: 'rosuvastatin', canonical: 'Rosuvastatin', category: 'drug' },
  { raw: 'ecospirin', canonical: 'Aspirin (Ecosprin)', category: 'drug' },
  { raw: 'ecosprin', canonical: 'Aspirin (Ecosprin)', category: 'drug' },
  { raw: 'aspirin', canonical: 'Aspirin', category: 'drug' },
  { raw: 'clopidogrel', canonical: 'Clopidogrel', category: 'drug' },
  { raw: 'clopilet', canonical: 'Clopidogrel (Clopilet)', category: 'drug' },
  { raw: 'thyronorm', canonical: 'Levothyroxine (Thyronorm)', category: 'drug' },
  { raw: 'thyroxine', canonical: 'Levothyroxine', category: 'drug' },
  { raw: 'eltoxin', canonical: 'Levothyroxine (Eltroxin)', category: 'drug' },
  { raw: 'coumadin', canonical: 'Warfarin', category: 'drug' },
  { raw: 'lanoxin', canonical: 'Digoxin', category: 'drug' },

  // Classical Formulations & Herbs (AFI / AYUSH)
  { raw: 'avipattikar churna', canonical: 'Avipattikar Churna', category: 'herb' },
  { raw: 'avipattikar', canonical: 'Avipattikar Churna', category: 'herb' },
  { raw: 'avipatikar', canonical: 'Avipattikar Churna', category: 'herb' },
  { raw: 'kamadudha rasa', canonical: 'Kamadudha Rasa', category: 'herb' },
  { raw: 'kamadudha', canonical: 'Kamadudha Rasa', category: 'herb' },
  { raw: 'kamdudha', canonical: 'Kamadudha Rasa', category: 'herb' },
  { raw: 'sutshekhar rasa', canonical: 'Sutshekhar Rasa', category: 'herb' },
  { raw: 'sutshekhar', canonical: 'Sutshekhar Rasa', category: 'herb' },
  { raw: 'sootshekhar', canonical: 'Sutshekhar Rasa', category: 'herb' },
  { raw: 'shankha bhasma', canonical: 'Shankha Bhasma', category: 'herb' },
  { raw: 'shankh bhasma', canonical: 'Shankha Bhasma', category: 'herb' },
  { raw: 'praval pishti', canonical: 'Praval Pishti', category: 'herb' },
  { raw: 'kapardika bhasma', canonical: 'Kapardika Bhasma', category: 'herb' },
  { raw: 'hingwashtak churna', canonical: 'Hingwashtak Churna', category: 'herb' },
  { raw: 'hingwashtak', canonical: 'Hingwashtak Churna', category: 'herb' },
  { raw: 'lavanbhaskar churna', canonical: 'Lavanbhaskar Churna', category: 'herb' },
  { raw: 'lavanbhaskar', canonical: 'Lavanbhaskar Churna', category: 'herb' },
  { raw: 'triphala churna', canonical: 'Triphala Churna', category: 'herb' },
  { raw: 'triphala', canonical: 'Triphala Churna', category: 'herb' },
  { raw: 'triphala guggulu', canonical: 'Triphala Guggulu', category: 'herb' },
  { raw: 'trayodashang guggulu', canonical: 'Trayodashang Guggulu', category: 'herb' },
  { raw: 'rasnasaptak kwath', canonical: 'Rasnasaptak Kwath', category: 'herb' },
  { raw: 'yograj guggulu', canonical: 'Yograj Guggulu', category: 'herb' },
  { raw: 'yograj guggul', canonical: 'Yograj Guggulu', category: 'herb' },
  { raw: 'yogaraja guggulu', canonical: 'Yograj Guggulu', category: 'herb' },
  { raw: 'yogaraja guggul', canonical: 'Yograj Guggulu', category: 'herb' },
  { raw: 'kaishore guggulu', canonical: 'Kaishore Guggulu', category: 'herb' },
  { raw: 'sinhanad guggulu', canonical: 'Sinhanad Guggulu', category: 'herb' },
  { raw: 'gokshuradi guggulu', canonical: 'Gokshuradi Guggulu', category: 'herb' },
  { raw: 'mahasudarshan vati', canonical: 'Mahasudarshan Vati', category: 'herb' },
  { raw: 'bilwadi churna', canonical: 'Bilwadi Churna', category: 'herb' },
  { raw: 'nisha amalaki', canonical: 'Nisha Amalaki', category: 'herb' },
  { raw: 'maharasnadi kwath', canonical: 'Maharasnadi Kwath', category: 'herb' },
  { raw: 'maharasnadi', canonical: 'Maharasnadi Kwath', category: 'herb' },
  { raw: 'dashmoolarishta', canonical: 'Dashmoolarishta', category: 'herb' },
  { raw: 'ashokarishta', canonical: 'Ashokarishta', category: 'herb' },
  { raw: 'arjunarishta', canonical: 'Arjunarishta', category: 'herb' },
  { raw: 'draksharishta', canonical: 'Draksharishta', category: 'herb' },
  { raw: 'amritarishta', canonical: 'Amritarishta', category: 'herb' },
  { raw: 'kutajarishta', canonical: 'Kutajarishta', category: 'herb' },
  { raw: 'kumaryasava', canonical: 'Kumaryasava', category: 'herb' },
  { raw: 'punarnavasava', canonical: 'Punarnavasava', category: 'herb' },
  { raw: 'arogyavardhini vati', canonical: 'Arogyavardhini Vati', category: 'herb' },
  { raw: 'arogyavardhini', canonical: 'Arogyavardhini Vati', category: 'herb' },
  { raw: 'chandraprabha vati', canonical: 'Chandraprabha Vati', category: 'herb' },
  { raw: 'chandraprabha', canonical: 'Chandraprabha Vati', category: 'herb' },
  { raw: 'chitrakadi vati', canonical: 'Chitrakadi Vati', category: 'herb' },
  { raw: 'kutajghan vati', canonical: 'Kutajghan Vati', category: 'herb' },
  { raw: 'shankhavati', canonical: 'Shankhavati', category: 'herb' },
  { raw: 'brahmi vati', canonical: 'Brahmi Vati', category: 'herb' },
  { raw: 'brahmi', canonical: 'Brahmi Vati', category: 'herb' },
  { raw: 'manasamitra vatakam', canonical: 'Manasamitra Vatakam', category: 'herb' },
  { raw: 'ashwagandha churna', canonical: 'Ashwagandha Churna', category: 'herb' },
  { raw: 'ashwagandha', canonical: 'Ashwagandha Churna', category: 'herb' },
  { raw: 'shilajit rasayana', canonical: 'Shilajit Rasayana', category: 'herb' },
  { raw: 'shilajit', canonical: 'Shilajit Rasayana', category: 'herb' },
  { raw: 'shatavari', canonical: 'Shatavari Gulam', category: 'herb' },
  { raw: 'guduchi', canonical: 'Guduchi (Giloy)', category: 'herb' },
  { raw: 'giloy', canonical: 'Guduchi (Giloy)', category: 'herb' },
  { raw: 'samshamani vati', canonical: 'Samshamani Vati', category: 'herb' },
  { raw: 'tulsi', canonical: 'Tulsi Swarasa', category: 'herb' },
  { raw: 'vasa', canonical: 'Vasa Avaleha', category: 'herb' },
  { raw: 'kantakari', canonical: 'Kantakari Avaleha', category: 'herb' },
  { raw: 'sitopaladi churna', canonical: 'Sitopaladi Churna', category: 'herb' },
  { raw: 'sitopaladi', canonical: 'Sitopaladi Churna', category: 'herb' },
  { raw: 'talisadi churna', canonical: 'Talisadi Churna', category: 'herb' },
  { raw: 'haridra khanda', canonical: 'Haridra Khanda', category: 'herb' },
  { raw: 'chyawanprash', canonical: 'Chyawanprash Avaleha', category: 'herb' },
  { raw: 'septilin', canonical: 'Himalaya Septilin', category: 'herb' },
  { raw: 'cystone', canonical: 'Himalaya Cystone', category: 'herb' },
  { raw: 'shallaki', canonical: 'Shallaki Vati', category: 'herb' },
  { raw: 'mulethi', canonical: 'Yashtimadhu', category: 'herb' },
  { raw: 'yashti madhu', canonical: 'Yashtimadhu', category: 'herb' }
];

export class PhoneticNormalizerService {
  private static normalizerMap = new Map<string, string>();
  private static regexPattern: RegExp;
  private static initialized: boolean = false;

  // Multi-Lingual Anatomical Loci Root Regular Expressions
  private static readonly ANAT_THORAX = /\b(ch[a|h]ati|seene|seena|sina|kareja|kaleja|hridaya|buke|chatit|nenju|nenjil|gunde|ede|hikk|sinus)\b/i;
  private static readonly ANAT_LEFT_ARM = /\b(baaye\s*haath|baya\s*hath|baaye\s*baahu|baam\s*haat|dava\s*hat|edama\s*cheyyi|idathu\s*kai|khabbe\s*hath|khowur\s*atha)\b/i;
  private static readonly ANAT_KNEE_JOINT = /\b(ghutn[ae]|janu|muttukal|mokaalu|jod[o]?|sandhi)\b/i;
  private static readonly ANAT_LUMBAR_SPINE = /\b(kamar|peeth|kati|nadumu|kodum)\b/i;
  private static readonly ANAT_ABDOMEN = /\b(pet|pait|paat|paet|udar|koshtha|vayiru|potte|kadupu|hotte|vayar|pedu|nabhi)\b/i;
  private static readonly ANAT_HEAD = /\b(sir|sar|matha|kapaal|thala|tala)\b/i;

  // Multi-Lingual Pathological Sensation Root Regular Expressions
  private static readonly SENS_CRUSHING = /\b(bojh|bhari|bhaari|chaap|dabav|baram|wazan|saap|kediya|crushing|pressure|ghana|ghano)\b/i;
  private static readonly SENS_PAIN = /\b(dard|peeda|vedana|byatha|noppi|vali|novu|peer|daag|bikh|kasak|jatana|pain|dukh|dukhne)\b/i;
  private static readonly SENS_CREPITUS = /\b(cut\s*cut|kat\s*kat|char\s*char|crepitus|crackling|clicking)\b/i;
  private static readonly SENS_STIFFNESS = /\b(akad|akdan|stambha|stiff|jam)\b/i;
  private static readonly SENS_BURNING = /\b(jalan|jalna|daaha|daha|erichal|manta|acid|burn)\b/i;
  private static readonly SENS_DIAPHORESIS = /\b(pasina|paseena|gham|ghamb|viyarvai|viyarppu|chematlu|arakh|sweat)\b/i;
  private static readonly SENS_DYSPNEA = /\b(saans\s*phool|swasa|dum\s*phool|shaas\s*koshto|moochu\s*thinaral|aadakapovadam)\b/i;

  private static initialize(): void {
    if (this.initialized) return;

    for (const item of CLINICAL_PHONETIC_DICTIONARY) {
      this.normalizerMap.set(item.raw.toLowerCase(), item.canonical);
    }

    const escapedTerms = Array.from(this.normalizerMap.keys())
      .sort((a, b) => b.length - a.length)
      .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    this.regexPattern = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
    this.initialized = true;
  }

  /**
   * Compositional Root Resolver: Maps anatomical locus + sensation co-occurrence to canonical clinical entities
   * Transcend static dictionaries by evaluating semantic invariants across 22 Indic languages & dialects.
   */
  private static applyCompositionalInference(input: string): string {
    let text = input;

    // 1. Thorax + Crushing Pressure -> Substernal Crushing Pressure
    if (this.ANAT_THORAX.test(text) && this.SENS_CRUSHING.test(text)) {
      text = text.replace(
        new RegExp(`(${this.ANAT_THORAX.source}[^.!?,;:\\n]{0,30}${this.SENS_CRUSHING.source}|${this.SENS_CRUSHING.source}[^.!?,;:\\n]{0,30}${this.ANAT_THORAX.source})`, 'gi'),
        'Substernal Crushing Pressure'
      );
    }

    // 2. Thorax + Pain -> Substernal Chest Pain
    if (this.ANAT_THORAX.test(text) && this.SENS_PAIN.test(text)) {
      text = text.replace(
        new RegExp(`(${this.ANAT_THORAX.source}[^.!?,;:\\n]{0,30}${this.SENS_PAIN.source}|${this.SENS_PAIN.source}[^.!?,;:\\n]{0,30}${this.ANAT_THORAX.source})`, 'gi'),
        'Substernal Chest Pain'
      );
    }

    // 3. Left Arm + Pain -> Left Arm Radiation Pain
    if (this.ANAT_LEFT_ARM.test(text) && this.SENS_PAIN.test(text)) {
      text = text.replace(
        new RegExp(`(${this.ANAT_LEFT_ARM.source}[^.!?,;:\\n]{0,30}${this.SENS_PAIN.source}|${this.SENS_PAIN.source}[^.!?,;:\\n]{0,30}${this.ANAT_LEFT_ARM.source})`, 'gi'),
        'Left Arm Radiation Pain'
      );
    }

    // 4. Knee/Joint + Crepitus -> Janu Sandhi Crepitus
    if (this.ANAT_KNEE_JOINT.test(text) && this.SENS_CREPITUS.test(text)) {
      text = text.replace(
        new RegExp(`(${this.ANAT_KNEE_JOINT.source}[^.!?,;:\\n]{0,30}${this.SENS_CREPITUS.source}|${this.SENS_CREPITUS.source}[^.!?,;:\\n]{0,30}${this.ANAT_KNEE_JOINT.source})`, 'gi'),
        'Janu Sandhi Crepitus'
      );
    }

    // 5. Knee/Joint + Stiffness -> Morning Stiffness (Sandhi Stambha)
    if (this.ANAT_KNEE_JOINT.test(text) && this.SENS_STIFFNESS.test(text)) {
      text = text.replace(
        new RegExp(`(${this.ANAT_KNEE_JOINT.source}[^.!?,;:\\n]{0,30}${this.SENS_STIFFNESS.source}|${this.SENS_STIFFNESS.source}[^.!?,;:\\n]{0,30}${this.ANAT_KNEE_JOINT.source})`, 'gi'),
        'Morning Stiffness (Sandhi Stambha)'
      );
    }

    // 6. Lumbar Spine + Pain -> Kati Shoola / Low Back Pain (unless radicular / sciatica pattern)
    if (this.ANAT_LUMBAR_SPINE.test(text) && this.SENS_PAIN.test(text)) {
      const isSciatica = /\b(kamar\s*se\s*pair|pair\s*tak|radiation|gridhrasi|sciatica|nas\s*kheench)\b/i.test(text);
      if (!isSciatica) {
        text = text.replace(
          new RegExp(`(${this.ANAT_LUMBAR_SPINE.source}[^.!?,;:\\n]{0,30}${this.SENS_PAIN.source}|${this.SENS_PAIN.source}[^.!?,;:\\n]{0,30}${this.ANAT_LUMBAR_SPINE.source})`, 'gi'),
          'Kati Shoola / Low Back Pain'
        );
      }
    }

    // 7. Abdomen + Burning -> Amlapitta / Epigastric Pyrosis
    if (this.ANAT_ABDOMEN.test(text) && this.SENS_BURNING.test(text)) {
      text = text.replace(
        new RegExp(`(${this.ANAT_ABDOMEN.source}[^.!?,;:\\n]{0,30}${this.SENS_BURNING.source}|${this.SENS_BURNING.source}[^.!?,;:\\n]{0,30}${this.ANAT_ABDOMEN.source})`, 'gi'),
        'Amlapitta / Epigastric Pyrosis'
      );
    }

    // 8. Diaphoresis & Dyspnea Standalone Roots
    if (this.SENS_DIAPHORESIS.test(text)) {
      text = text.replace(
        new RegExp(`\\b(?:bahut|khup|adhika|intense|severe|chhoot\\s*raha)?\\s*${this.SENS_DIAPHORESIS.source}\\s*(?:aa\\s*raha|chhoot\\s*raha|yet\\s*ahe|pattestunnayi|kottuthu)?\\b`, 'gi'),
        'Marked Diaphoresis'
      );
    }

    if (this.SENS_DYSPNEA.test(text)) {
      text = text.replace(
        new RegExp(`\\b${this.SENS_DYSPNEA.source}\\b`, 'gi'),
        'Dyspnea / Breathlessness'
      );
    }

    // 9. Common Indian Brand Posology Stemming (e.g., Crocin-650, Dolo-650, Calpol-500)
    text = text.replace(/\b(crocin|calpol|dolo|pacimol|pyragesic)(?:[-\s]?\d+)?\b/gi, 'Paracetamol');
    text = text.replace(/\b(augmentin|moxclav|augpen)(?:[-\s]?\d+)?\b/gi, 'Amoxicillin + Clavulanic Acid');
    text = text.replace(/\b(pan-?d|pantocid-?d)\b/gi, 'Pantoprazole + Domperidone');
    text = text.replace(/\b(ecosprin|ecospirin|disprin)(?:[-\s]?\d+)?\b/gi, 'Aspirin');
    text = text.replace(/\b(glycomet|glyciphage)(?:[-\s]?\d+)?\b/gi, 'Metformin');

    return text;
  }

  /**
   * Normalize input vernacular Hinglish text to standard clinical terms
   * Combines exact idiomatic lookup with generalized compositional morphological inference.
   */
  public static normalize(text: string): string {
    if (!text || !text.trim()) return text;
    this.initialize();

    // Pass 1: High-Speed Exact Idiom Replacement
    let normalized = text.replace(this.regexPattern, (match) => {
      const canonical = this.normalizerMap.get(match.toLowerCase());
      return canonical || match;
    });

    // Pass 2: Generalized Compositional Anatomical x Sensation Root Normalization
    normalized = this.applyCompositionalInference(normalized);

    return normalized;
  }

  /**
   * Extract all matched clinical terms and their normalized equivalents
   */
  public static extractTerms(text: string): Array<{ raw: string; canonical: string }> {
    if (!text || !text.trim()) return [];
    this.initialize();

    const matches: Array<{ raw: string; canonical: string }> = [];
    let match: RegExpExecArray | null;

    const regex = new RegExp(this.regexPattern.source, 'gi');
    while ((match = regex.exec(text)) !== null) {
      const raw = match[0].toLowerCase();
      const canonical = this.normalizerMap.get(raw) || match[0];
      matches.push({ raw: match[0], canonical });
    }

    // Also include compositional matches
    const compositionalText = this.applyCompositionalInference(text);
    if (compositionalText.includes('Substernal Crushing Pressure') && !matches.some(m => m.canonical === 'Substernal Crushing Pressure')) {
      matches.push({ raw: 'compositional_thorax_crushing', canonical: 'Substernal Crushing Pressure' });
    }
    if (compositionalText.includes('Substernal Chest Pain') && !matches.some(m => m.canonical === 'Substernal Chest Pain')) {
      matches.push({ raw: 'compositional_thorax_pain', canonical: 'Substernal Chest Pain' });
    }
    if (compositionalText.includes('Left Arm Radiation Pain') && !matches.some(m => m.canonical === 'Left Arm Radiation Pain')) {
      matches.push({ raw: 'compositional_left_arm_pain', canonical: 'Left Arm Radiation Pain' });
    }

    return matches;
  }
}
