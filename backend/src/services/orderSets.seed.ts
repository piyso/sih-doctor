/**
 * Starter order sets. They are templates the hospital's Drugs & Therapeutics Committee should
 * adopt or edit; each names the guidance it follows. Doctors also save their own.
 *
 *  - Hypertension: India Hypertension Control Initiative drug-and-dose protocol (Punjab variant:
 *    amlodipine 5 → 10 mg, + telmisartan 40 → 80 mg, + chlorthalidone 12.5 → 25 mg; telmisartan
 *    first in CKD; recheck every 30 days). Kaur et al., Global Heart 2024.
 *  - Modern-medicine sets follow the ICMR Standard Treatment Workflows / ICMR antimicrobial
 *    guidelines approach (Access antibiotics first, no antibiotic for viral illness).
 *  - Animal bite sets follow the National Guidelines for Rabies Prophylaxis (NRCP, NCDC/MoHFW
 *    2019): wound washing for all; rabies vaccine for category II and III (intradermal, 0.1 mL at
 *    two sites on days 0, 3, 7 and 28); rabies immunoglobulin infiltrated into category III wounds.
 *  - Ayurveda sets follow the Ministry of Ayush Ayurvedic Standard Treatment Guidelines (2017)
 *    structure (formulation, dose, anupana, kala, pathya–apathya).
 */

export interface OrderSetSeed {
  id: string;
  careStream: 'ALLOPATHY' | 'AYURVEDA';
  name: string;
  condition: string;
  source: string;
  items: {
    medicines: any[];
    investigations?: string[];
    advice?: string;
    pathya?: string[];
    apathya?: string[];
    followUpDays?: number;
    steps?: Array<{ step: number; label: string; medicines: any[] }>;
  };
}

const m = (name: string, dosage: string, frequency: string, durationDays: number, extra: Record<string, unknown> = {}) => ({ name, dosage, frequency, durationDays, route: 'ORAL', ...extra });
const a = (classicalName: string, dose: string, frequency: string, anupana: string, durationDays: number, extra: Record<string, unknown> = {}) => ({ classicalName, dose, frequency, anupana, durationDays, ...extra });

export const DEFAULT_ORDER_SETS: OrderSetSeed[] = [
  {
    id: 'os-ihci-htn', careStream: 'ALLOPATHY', name: 'Hypertension — IHCI protocol', condition: 'Essential hypertension',
    source: 'India Hypertension Control Initiative drug-and-dose protocol (Punjab variant); recheck BP every 30 days',
    items: {
      medicines: [m('Amlodipine', '5 mg', '1-0-0', 30)],
      investigations: ['creatinine', 'electrolytes', 'fbs', 'urine_routine', 'ecg'],
      advice: 'Salt under 5 g/day, daily walk 30 minutes, no tobacco. Take the tablet every day even when you feel well. Come back in 30 days for a BP check.',
      followUpDays: 30,
      steps: [
        { step: 1, label: 'Amlodipine 5 mg', medicines: [m('Amlodipine', '5 mg', '1-0-0', 30)] },
        { step: 2, label: 'Amlodipine 10 mg', medicines: [m('Amlodipine', '10 mg', '1-0-0', 30)] },
        { step: 3, label: '+ Telmisartan 40 mg', medicines: [m('Amlodipine', '10 mg', '1-0-0', 30), m('Telmisartan', '40 mg', '1-0-0', 30)] },
        { step: 4, label: 'Telmisartan 80 mg', medicines: [m('Amlodipine', '10 mg', '1-0-0', 30), m('Telmisartan', '80 mg', '1-0-0', 30)] },
        { step: 5, label: '+ Chlorthalidone 12.5 mg', medicines: [m('Amlodipine', '10 mg', '1-0-0', 30), m('Telmisartan', '80 mg', '1-0-0', 30), m('Chlorthalidone', '12.5 mg', '1-0-0', 30)] },
        { step: 6, label: 'Chlorthalidone 25 mg', medicines: [m('Amlodipine', '10 mg', '1-0-0', 30), m('Telmisartan', '80 mg', '1-0-0', 30), m('Chlorthalidone', '25 mg', '1-0-0', 30)] }
      ]
    }
  },
  {
    id: 'os-fever-adult', careStream: 'ALLOPATHY', name: 'Fever, adult, no focus (first 3 days)', condition: 'Acute febrile illness',
    source: 'ICMR STW approach: symptomatic care, no empirical antibiotic, test if fever persists',
    items: {
      medicines: [m('Paracetamol', '650 mg', '1-1-1 after food', 3)],
      investigations: [],
      advice: 'Drink plenty of fluids and rest. Do not take painkillers other than paracetamol. Come back at once for bleeding, severe abdominal pain, vomiting, breathlessness, drowsiness, or if fever lasts more than 3 days (dengue/malaria test).',
      followUpDays: 3
    }
  },
  {
    id: 'os-diarrhoea-adult', careStream: 'ALLOPATHY', name: 'Acute watery diarrhoea, adult', condition: 'Acute gastroenteritis',
    source: 'WHO / ICMR: rehydration first; no antibiotic for watery diarrhoea without blood or fever',
    items: {
      medicines: [m('ORS', '1 sachet in 1 litre', 'after each loose stool', 3)],
      advice: 'Sip ORS after every loose stool; continue normal food. Come back at once for blood in stool, high fever, very little urine, or drowsiness.',
      followUpDays: 3
    }
  },
  {
    id: 'os-diarrhoea-child', careStream: 'ALLOPATHY', name: 'Acute diarrhoea, child (ORS + zinc)', condition: 'Acute gastroenteritis (child)',
    source: 'WHO/UNICEF ORS + zinc: zinc 20 mg/day for 14 days (10 mg under 6 months)',
    items: {
      medicines: [m('ORS', '50–100 ml per loose stool', 'after each loose stool', 3), m('Zinc sulfate (dispersible)', '20 mg', '1-0-0', 14)],
      advice: 'Continue breastfeeding and normal food. Give ORS after every loose stool. Come back at once if the child is drowsy, cannot drink, has blood in stool or passes very little urine.',
      followUpDays: 3
    }
  },
  {
    id: 'os-gerd', careStream: 'ALLOPATHY', name: 'Acid peptic disease / GERD', condition: 'Dyspepsia / GERD',
    source: 'Standard PPI course; review need at 4–8 weeks (Beers: avoid > 8 weeks in older adults without indication)',
    items: {
      medicines: [m('Pantoprazole', '40 mg', '1-0-0 before breakfast', 14)],
      advice: 'Small meals; avoid late dinners, tea/coffee on an empty stomach and smoking. Come back at once for black stools, vomiting blood or weight loss.',
      followUpDays: 14
    }
  },
  {
    id: 'os-allergic-rhinitis', careStream: 'ALLOPATHY', name: 'Allergic rhinitis', condition: 'Allergic rhinitis',
    source: 'Second-generation antihistamine first',
    items: { medicines: [m('Cetirizine', '10 mg', '0-0-1', 7)], advice: 'Avoid dust and smoke; steam inhalation helps.', followUpDays: 14 }
  },
  {
    id: 'os-uti-cystitis', careStream: 'ALLOPATHY', name: 'Uncomplicated cystitis (non-pregnant woman)', condition: 'Acute uncomplicated cystitis',
    source: 'ICMR treatment guidelines for antimicrobial use: nitrofurantoin (Access) 100 mg BD × 5 days',
    items: {
      medicines: [m('Nitrofurantoin', '100 mg', '1-0-1 after food', 5, { indication: 'Acute uncomplicated cystitis' })],
      investigations: ['urine_routine'],
      advice: 'Drink plenty of water. Come back at once for fever, back pain or vomiting.',
      followUpDays: 5
    }
  },
  {
    id: 'os-strep-pharyngitis', careStream: 'ALLOPATHY', name: 'Sore throat with suspected streptococcal infection', condition: 'Acute pharyngitis (suspected bacterial)',
    source: 'ICMR / WHO AWaRe: most sore throats are viral; amoxicillin (Access) only when bacterial infection is likely',
    items: {
      medicines: [m('Amoxicillin', '500 mg', '1-1-1', 10, { indication: 'Suspected streptococcal pharyngitis' }), m('Paracetamol', '650 mg', 'SOS (up to 3 times a day)', 3)],
      advice: 'Complete the full 10-day course. Warm saline gargles. Come back if you cannot swallow or have difficulty breathing.',
      followUpDays: 7
    }
  },
  {
    id: 'os-animal-bite-cat2', careStream: 'ALLOPATHY', name: 'Animal bite — category II (rabies PEP)', condition: 'Animal bite, WHO category II exposure (Z20.3)',
    source: 'NRCP National Guidelines for Rabies Prophylaxis 2019: wound washing + rabies vaccine; no immunoglobulin for category II',
    items: {
      medicines: [
        m('Rabies vaccine (cell culture)', '0.1 mL ID at 2 sites', 'Days 0, 3, 7, 28', 28, { route: 'INTRADERMAL', indication: 'Post-exposure prophylaxis, category II' }),
        m('Td', '0.5 mL IM', 'Once', 1, { route: 'INTRAMUSCULAR', indication: 'Tetanus-prone wound; omit if fully immunised with a dose in the last 5 years' }),
        m('Paracetamol', '500 mg', 'SOS (up to 3 times a day)', 3)
      ],
      advice: 'Wash the wound at once with soap and running water for 15 minutes, then apply povidone-iodine. Do not stitch, bandage tightly or apply chilli, oil or turmeric. Take every vaccine dose on days 0, 3, 7 and 28 even if the animal stays healthy. Come back at once if the wound becomes red, swollen or painful.',
      followUpDays: 3
    }
  },
  {
    id: 'os-animal-bite-cat3', careStream: 'ALLOPATHY', name: 'Animal bite — category III (rabies PEP + RIG)', condition: 'Animal bite, WHO category III exposure (Z20.3)',
    source: 'NRCP National Guidelines for Rabies Prophylaxis 2019: wound washing + rabies immunoglobulin into and around all wounds + rabies vaccine',
    items: {
      medicines: [
        m('Rabies immunoglobulin', 'eRIG 40 IU/kg or hRIG 20 IU/kg', 'Once, day 0 — infiltrate into and around every wound', 1, { route: 'LOCAL INFILTRATION', indication: 'Category III exposure' }),
        m('Rabies vaccine (cell culture)', '0.1 mL ID at 2 sites', 'Days 0, 3, 7, 28', 28, { route: 'INTRADERMAL', indication: 'Post-exposure prophylaxis, category III' }),
        m('Td', '0.5 mL IM', 'Once', 1, { route: 'INTRAMUSCULAR', indication: 'Tetanus-prone wound; omit if fully immunised with a dose in the last 5 years' }),
        m('Amoxicillin + clavulanic acid', '625 mg', '1-0-1 after food', 5, { indication: 'Deep or high-risk bite wound (hand, face, cat bite); omit for clean superficial wounds' }),
        m('Paracetamol', '500 mg', 'SOS (up to 3 times a day)', 3)
      ],
      advice: 'Wash the wound at once with soap and running water for 15 minutes, then apply povidone-iodine. Do not stitch the wound now unless the surgeon advises it after the immunoglobulin. Take every vaccine dose on days 0, 3, 7 and 28 even if the animal stays healthy. Come back at once for fever, spreading redness or pus.',
      followUpDays: 3
    }
  },
  {
    id: 'os-t2dm-start', careStream: 'ALLOPATHY', name: 'Type 2 diabetes — start metformin', condition: 'Type 2 diabetes mellitus',
    source: 'NP-NCD / ICMR: metformin first line, titrate; check renal function',
    items: {
      medicines: [m('Metformin', '500 mg', '1-0-1 after food', 30)],
      investigations: ['hba1c', 'creatinine', 'lipid', 'urine_routine'],
      advice: 'Walk 30 minutes daily; reduce sugar, sweets, rice portions. Check feet daily. Come back in 4 weeks with sugar readings.',
      followUpDays: 30
    }
  },
  {
    id: 'os-hypothyroid', careStream: 'ALLOPATHY', name: 'Hypothyroidism — start levothyroxine', condition: 'Primary hypothyroidism',
    source: 'Standard practice: take on an empty stomach; recheck TSH at 6–8 weeks',
    items: {
      medicines: [m('Levothyroxine', '50 mcg', '1-0-0 empty stomach', 42)],
      investigations: ['tsh'],
      advice: 'Take the tablet on an empty stomach with water, 30–60 minutes before breakfast, 4 hours apart from calcium or iron.',
      followUpDays: 42
    }
  },
  {
    id: 'os-ida', careStream: 'ALLOPATHY', name: 'Iron-deficiency anaemia', condition: 'Iron-deficiency anaemia',
    source: 'Anaemia Mukt Bharat: oral iron–folic acid; recheck haemoglobin',
    items: {
      medicines: [m('Iron folic acid', '1 tablet', '0-1-0 after food', 90)],
      investigations: ['cbc'],
      advice: 'Take iron with lemon water or after food, not with tea, milk or calcium. Stools may turn black — this is expected.',
      followUpDays: 30
    }
  },
  // ── Ayurveda ──────────────────────────────────────────────────────────────
  {
    id: 'os-ayu-amlapitta', careStream: 'AYURVEDA', name: 'Amlapitta', condition: 'Amlapitta (hyperacidity)',
    source: 'Ayurvedic Standard Treatment Guidelines (Ministry of Ayush, 2017) — adapt per prakriti and bala',
    items: {
      medicines: [a('Avipattikar Churna', '3–6 g', '1-0-1 before food', 'Lukewarm water', 15), a('Kamdudha Ras', '250 mg', '1-0-1', 'Water', 15)],
      pathya: ['Old rice', 'Barley', 'Moong dal', 'Pomegranate', 'Coconut water'],
      apathya: ['Spicy, sour and fried food', 'Late-night meals', 'Tea/coffee on an empty stomach', 'Curd at night'],
      advice: 'Eat at regular times; avoid long gaps without food.',
      followUpDays: 15
    }
  },
  {
    id: 'os-ayu-sandhigata', careStream: 'AYURVEDA', name: 'Sandhigata Vata (knee osteoarthritis)', condition: 'Sandhigata Vata',
    source: 'Ayurvedic Standard Treatment Guidelines (Ministry of Ayush, 2017) — adapt per dosha and bala',
    items: {
      medicines: [a('Yogaraja Guggulu', '2 tablets (250 mg each)', '1-0-1 after food', 'Lukewarm water', 30), a('Rasnasaptaka Kwatha', '15 ml with equal water', '1-0-1 before food', 'Lukewarm water', 30), a('Mahanarayana Taila', 'For local application', 'Twice daily (external)', 'External use — warm massage', 30)],
      pathya: ['Warm, freshly cooked food', 'Ginger in diet', 'Warm water'],
      apathya: ['Cold drinks', 'Curd', 'Day sleep', 'Prolonged standing'],
      advice: 'Gentle knee exercises daily; avoid squatting and climbing many stairs.',
      followUpDays: 30
    }
  },
  {
    id: 'os-ayu-kasa', careStream: 'AYURVEDA', name: 'Kasa (cough)', condition: 'Kaphaja Kasa',
    source: 'Ayurvedic Standard Treatment Guidelines (Ministry of Ayush, 2017)',
    items: {
      medicines: [a('Sitopaladi Churna', '3 g', '1-1-1', 'Honey', 7), a('Vasavaleha', '10 g', '1-0-1', 'Lukewarm water', 7)],
      pathya: ['Warm water', 'Ginger–tulsi decoction', 'Light warm meals'],
      apathya: ['Cold food and drinks', 'Curd', 'Fried food', 'Exposure to cold air'],
      advice: 'Come back if cough lasts more than 2 weeks (TB test) or there is blood in sputum or breathlessness.',
      followUpDays: 7
    }
  },
  {
    id: 'os-ayu-jwara', careStream: 'AYURVEDA', name: 'Jwara (fever)', condition: 'Jwara',
    source: 'Ayurvedic Standard Treatment Guidelines (Ministry of Ayush, 2017)',
    items: {
      medicines: [a('Sudarshana Ghanavati', '2 tablets (500 mg)', '1-1-1 after food', 'Lukewarm water', 5), a('Guduchi Ghanavati', '1 tablet (500 mg)', '1-0-1', 'Lukewarm water', 5)],
      pathya: ['Light gruel (peya)', 'Boiled and cooled water', 'Moong soup'],
      apathya: ['Heavy, oily food', 'Cold baths', 'Day sleep'],
      advice: 'Come back at once for bleeding, vomiting, drowsiness or fever beyond 3 days (dengue/malaria test).',
      followUpDays: 3
    }
  },
  {
    id: 'os-ayu-vibandha', careStream: 'AYURVEDA', name: 'Vibandha (constipation)', condition: 'Vibandha',
    source: 'Ayurvedic Standard Treatment Guidelines (Ministry of Ayush, 2017)',
    items: { medicines: [a('Triphala Churna', '5 g', '0-0-1 at bedtime', 'Lukewarm water', 15)], pathya: ['Fibre-rich vegetables', 'Ghee in moderation', 'Warm water'], apathya: ['Refined flour', 'Late dinners'], followUpDays: 15 }
  },
  {
    id: 'os-ayu-prameha', careStream: 'AYURVEDA', name: 'Prameha (adjunct to diabetes care)', condition: 'Prameha / Madhumeha',
    source: 'Ayurvedic Standard Treatment Guidelines (Ministry of Ayush, 2017); continue modern antidiabetic therapy and monitor sugars',
    items: {
      medicines: [a('Nishamalaki Vati', '2 tablets (500 mg)', '1-0-1 before food', 'Lukewarm water', 30)],
      pathya: ['Barley (yava)', 'Moong', 'Bitter vegetables', 'Daily walk'],
      apathya: ['Sweets, jaggery', 'Day sleep', 'Excess rice and potatoes'],
      advice: 'Keep taking your diabetes medicines; check sugars weekly.',
      followUpDays: 30
    }
  },
  {
    id: 'os-ayu-anidra', careStream: 'AYURVEDA', name: 'Anidra (insomnia, stress)', condition: 'Anidra',
    source: 'Ayurvedic Standard Treatment Guidelines (Ministry of Ayush, 2017)',
    items: {
      medicines: [a('Ashwagandha Churna', '3 g', '0-0-1 at bedtime', 'Warm milk', 30), a('Brahmi Vati', '1 tablet (250 mg)', '0-0-1', 'Warm milk', 30)],
      pathya: ['Fixed sleep time', 'Warm milk at night', 'Oil massage of feet (padabhyanga)'],
      apathya: ['Screens after 9 pm', 'Tea/coffee after evening', 'Heavy late dinners'],
      followUpDays: 30
    }
  }
];
