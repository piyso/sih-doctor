/**
 * Synthetic reference shard for cold start.
 *
 * A new facility has no encounters, so "similar cases" would be empty for weeks. This shard is a
 * deterministic, clearly labelled set of de-identified reference presentations built from the
 * NAMASTE entries, classical formulations and allopathic lexicon already shipped with the system.
 * Every result from it carries source = "reference"; nothing here is a real patient.
 */
import { CaseRecord } from './types';

interface Template {
  dept: string; cs: 'AYURVEDA' | 'ALLOPATHY'; tier?: 1;
  sx: string[]; sites: string[]; dx: string[]; rx: string[]; inv?: string[]; rf?: string[];
  ages?: string[]; sex?: string[];
}

const T: Template[] = [
  { dept: 'Kaya Chikitsa', cs: 'AYURVEDA', sx: ['Fever', 'Chills', 'Bodyache', 'Headache', 'Loss of appetite'], sites: ['General'], dx: ['AYU-JWA-001 Vataja Jwara (Acute pyrexia / viral fever)'], rx: ['Mahasudarshan Vati', 'Amritarishta', 'Tribhuvan Kirti Ras', 'Paracetamol'], inv: ['CBC', 'Peripheral smear for malaria'] },
  { dept: 'Kaya Chikitsa', cs: 'AYURVEDA', sx: ['Cough', 'Productive sputum', 'Fever', 'Chest congestion', 'Sore throat'], sites: ['Chest'], dx: ['AYU-KAS-002 Kaphaja Kasa (Productive cough / acute bronchitis)'], rx: ['Sitopaladi Churna', 'Vasavaleha', 'Kanthakari Avaleha', 'Levocetirizine'], inv: ['Chest X-ray'] },
  { dept: 'Kaya Chikitsa', cs: 'AYURVEDA', sx: ['Burning epigastric pain', 'Sour belching', 'Nausea', 'Bloating', 'Heartburn'], sites: ['Epigastrium', 'Abdomen'], dx: ['AYU-AML-001 Amlapitta (Non-ulcer dyspepsia / GERD)'], rx: ['Avipattikar Churna', 'Sutashekhar Ras', 'Kamadudha Ras', 'Pantoprazole'] },
  { dept: 'Kaya Chikitsa', cs: 'AYURVEDA', sx: ['Knee pain', 'Morning stiffness', 'Joint crepitus', 'Joint swelling', 'Difficulty climbing stairs'], sites: ['Knee', 'Joint'], dx: ['AYU-SAN-005 Sandhivata (Osteoarthritis of knee)'], rx: ['Yograj Guggulu', 'Dashmoolarishta', 'Mahanarayan Taila', 'Diclofenac'], inv: ['X-ray knee AP/lateral'], ages: ['41-60', '61+'] },
  { dept: 'Kaya Chikitsa', cs: 'AYURVEDA', sx: ['Polyuria', 'Excessive thirst', 'Fatigue', 'Weight loss', 'Burning feet'], sites: ['General'], dx: ['AYU-PRA-001 Kaphaja Prameha (Type 2 diabetes mellitus)'], rx: ['Chandraprabha Vati', 'Mehari Churna', 'Vasant Kusumakar Ras', 'Metformin', 'Glimepiride'], inv: ['Fasting blood sugar', 'HbA1c', 'Urine routine'], ages: ['41-60', '61+', '19-40'] },
  { dept: 'Kaya Chikitsa', cs: 'AYURVEDA', sx: ['Dysuria', 'Urinary frequency', 'Lower abdominal pain', 'Fever', 'Burning micturition'], sites: ['Urinary', 'Lower abdomen'], dx: ['AYU-MUT-003 Mutrakrichhra (Urinary tract infection)'], rx: ['Gokshuradi Guggulu', 'Chandraprabha Vati', 'Punarnavasava', 'Cefixime'], inv: ['Urine routine and culture'] },
  { dept: 'Kaya Chikitsa', cs: 'AYURVEDA', sx: ['Loose stools', 'Bloating', 'Abdominal cramps', 'Mucus in stool', 'Alternating constipation'], sites: ['Abdomen'], dx: ['AYU-GRA-001 Grahani Roga (Irritable bowel / malabsorption)'], rx: ['Kutajarishta', 'Bilwadi Churna', 'Gangadhar Churna'], inv: ['Stool routine'] },
  { dept: 'Kaya Chikitsa', cs: 'AYURVEDA', sx: ['Low back pain radiating to leg', 'Numbness in leg', 'Tingling', 'Pain on walking'], sites: ['Lower back', 'Leg'], dx: ['AYU-VAT-008 Gridhrasi (Sciatica / lumbar radiculopathy)'], rx: ['Trayodashang Guggulu', 'Rasnasaptak Kwath', 'Sameera Pannaga Ras', 'Ibuprofen'], inv: ['X-ray lumbosacral spine'], ages: ['19-40', '41-60', '61+'] },
  { dept: 'Kaya Chikitsa', cs: 'AYURVEDA', sx: ['Chest pain on exertion', 'Breathlessness', 'Palpitations', 'Sweating', 'Fatigue'], sites: ['Chest'], dx: ['AYU-HRI-002 Hridroga (Ischaemic heart disease)'], rx: ['Arjunarishta', 'Prabhakar Vati', 'Aspirin', 'Atorvastatin', 'Amlodipine'], inv: ['ECG', 'Lipid profile', 'Troponin'], rf: ['chest_pain'], ages: ['41-60', '61+'] },
  { dept: 'Kaya Chikitsa', cs: 'AYURVEDA', sx: ['Itching', 'Rash', 'Scaling of skin', 'Oozing lesions', 'Dry skin'], sites: ['Skin'], dx: ['AYU-TVA-004 Vicharchika (Eczema / dermatitis)'], rx: ['Khadirarishta', 'Kaishore Guggulu', 'Mahatiktaka Ghrita', 'Levocetirizine'] },
  { dept: 'General Medicine', cs: 'ALLOPATHY', sx: ['Headache', 'Dizziness', 'High blood pressure', 'Neck pain', 'Blurred vision'], sites: ['Head', 'General'], dx: ['I10 Essential hypertension'], rx: ['Amlodipine', 'Telmisartan'], inv: ['ECG', 'Renal function test', 'Fundus examination'], ages: ['41-60', '61+'] },
  { dept: 'General Medicine', cs: 'ALLOPATHY', sx: ['Sore throat', 'Runny nose', 'Cough', 'Fever', 'Sneezing'], sites: ['Throat', 'Nose'], dx: ['J06.9 Acute upper respiratory infection'], rx: ['Paracetamol', 'Levocetirizine', 'Warm saline gargles'] },
  { dept: 'General Medicine', cs: 'ALLOPATHY', sx: ['Vomiting', 'Loose stools', 'Abdominal cramps', 'Dehydration', 'Fever'], sites: ['Abdomen'], dx: ['A09 Acute gastroenteritis'], rx: ['ORS', 'Zinc', 'Pantoprazole'], inv: ['Serum electrolytes'] },
  { dept: 'General Medicine', cs: 'ALLOPATHY', sx: ['Unilateral throbbing headache', 'Nausea', 'Photophobia', 'Visual aura'], sites: ['Head'], dx: ['G43.9 Migraine'], rx: ['Paracetamol', 'Ibuprofen'] },
  { dept: 'General Medicine', cs: 'ALLOPATHY', sx: ['Wheeze', 'Breathlessness', 'Night cough', 'Chest tightness'], sites: ['Chest'], dx: ['J45.9 Asthma'], rx: ['Montelukast', 'Salbutamol inhaler', 'Budesonide inhaler'], inv: ['Peak expiratory flow'] },
  { dept: 'General Medicine', cs: 'ALLOPATHY', sx: ['Fatigue', 'Pallor', 'Breathlessness on exertion', 'Palpitations', 'Hair loss'], sites: ['General'], dx: ['D50.9 Iron deficiency anaemia'], rx: ['Iron folic acid', 'Vitamin C'], inv: ['CBC', 'Serum ferritin'], sex: ['FEMALE', 'FEMALE', 'MALE'] },
  { dept: 'General Medicine', cs: 'ALLOPATHY', sx: ['High fever', 'Retro-orbital pain', 'Bodyache', 'Rash', 'Bleeding gums'], sites: ['General'], dx: ['A90 Dengue fever (suspected)'], rx: ['Paracetamol', 'Oral fluids'], inv: ['Dengue NS1', 'Platelet count', 'CBC'], rf: ['bleeding'] },
  { dept: 'Shalya Tantra', cs: 'AYURVEDA', sx: ['Ankle pain', 'Swelling after fall', 'Difficulty walking', 'Bruising'], sites: ['Ankle'], dx: ['S93.4 Ankle sprain'], rx: ['Diclofenac', 'Murivenna', 'Rest ice compression elevation'], inv: ['X-ray ankle'] },
  { dept: 'Kaumarbhritya', cs: 'AYURVEDA', sx: ['Loose stools', 'Vomiting', 'Fever', 'Refusal to feed', 'Irritability'], sites: ['Abdomen'], dx: ['A09 Acute diarrhoea (paediatric)'], rx: ['ORS', 'Zinc', 'Bilwadi Churna'], ages: ['0-5', '6-12'] },
  { dept: 'Prasuti Tantra', cs: 'AYURVEDA', tier: 1, sx: ['Pregnancy', 'Nausea', 'Backache', 'Fatigue', 'Leg cramps'], sites: ['Pelvis', 'Lower back'], dx: ['Z34 Antenatal care visit'], rx: ['Iron folic acid', 'Calcium', 'Garbhapala Rasa'], inv: ['Haemoglobin', 'Obstetric ultrasound', 'Urine protein'], ages: ['19-40'], sex: ['FEMALE'] },
  { dept: 'Manas Roga', cs: 'AYURVEDA', tier: 1, sx: ['Low mood', 'Insomnia', 'Anxiety', 'Fatigue', 'Poor concentration'], sites: ['General'], dx: ['F32.9 Depressive episode'], rx: ['Brahmi Vati', 'Ashwagandha Churna', 'Counselling'] },
  { dept: 'General Medicine', cs: 'ALLOPATHY', sx: ['Low back pain', 'Stiffness', 'Pain on bending', 'Muscle spasm'], sites: ['Lower back'], dx: ['M54.5 Low back pain'], rx: ['Diclofenac', 'Hot fomentation'], ages: ['19-40', '41-60'] }
];

const AGES = ['0-5', '6-12', '13-18', '19-40', '41-60', '61+'];
const SEX = ['MALE', 'FEMALE'];

/** Deterministic PRNG so the shard is identical on every host (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function pick<T>(r: () => number, arr: T[], n: number): T[] {
  const copy = arr.slice(); const out: T[] = [];
  while (copy.length && out.length < n) out.push(copy.splice(Math.floor(r() * copy.length), 1)[0]);
  return out;
}

export function buildReferenceShard(count = 400, seed = 26047): CaseRecord[] {
  const r = rng(seed);
  const out: CaseRecord[] = [];
  for (let i = 0; i < count; i++) {
    const t = T[i % T.length];
    const nSx = 2 + Math.floor(r() * Math.min(3, t.sx.length - 1));
    const month = `2026-${String(1 + Math.floor(r() * 9)).padStart(2, '0')}`;
    out.push({
      id: `ref-${String(i + 1).padStart(4, '0')}`,
      source: 'reference',
      department: t.dept,
      careStream: t.cs,
      ageBand: (t.ages || AGES)[Math.floor(r() * (t.ages || AGES).length)],
      sex: (t.sex || SEX)[Math.floor(r() * (t.sex || SEX).length)],
      symptoms: pick(r, t.sx, nSx),
      sites: t.sites,
      diagnoses: t.dx,
      medicines: pick(r, t.rx, 1 + Math.floor(r() * Math.min(3, t.rx.length))),
      investigations: t.inv ? pick(r, t.inv, 1 + Math.floor(r() * t.inv.length)) : [],
      redFlags: t.rf || [],
      month,
      tier: t.tier || 2
    });
  }
  return out;
}

export const REFERENCE_TEMPLATE_COUNT = T.length;
