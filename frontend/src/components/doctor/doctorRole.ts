import { AllopathicMedication, AyushFormulation } from '../../types/api';

/** Which kind of doctor is using the desk. Changes the queue, intake panel and prescription pad. */
export type DoctorRole = 'AYURVEDA' | 'ALLOPATHY';

const ROLE_KEY = 'doctor_desk_role';

export const loadDoctorRole = (): DoctorRole => {
  try {
    const saved = localStorage.getItem(ROLE_KEY);
    if (saved === 'AYURVEDA' || saved === 'ALLOPATHY') return saved;
  } catch {}
  return 'AYURVEDA';
};

export const saveDoctorRole = (role: DoctorRole) => {
  try { localStorage.setItem(ROLE_KEY, role); } catch {}
};

/** Everything the doctor is writing for one patient; kept per patient so switching never loses it. */
export interface RxDraft {
  allopathic: AllopathicMedication[];
  ayush: AyushFormulation[];
  pathya: string[];
  apathya: string[];
  advice: string;
  followUpDays: number | '';
  notes: string;
}

export const emptyRxDraft = (): RxDraft => ({
  allopathic: [],
  ayush: [],
  pathya: [],
  apathya: [],
  advice: '',
  followUpDays: '',
  notes: ''
});

/** Display text and codes for a provisional diagnosis from the backend (several shapes exist). */
export const formatDiagnosis = (d: any, role: DoctorRole): { title: string; subtitle: string; codes: string[] } | null => {
  if (!d) return null;
  if (typeof d === 'string') return { title: d, subtitle: '', codes: [] };
  const sanskrit = d.sanskritTerm || d.ayushTerm || '';
  const english = d.englishEquivalent || d.display || d.name || '';
  const title = role === 'AYURVEDA' ? sanskrit || english : english || sanskrit;
  const subtitle = role === 'AYURVEDA' ? (sanskrit && english ? english : '') : (english && sanskrit ? `Ayurveda: ${sanskrit}` : '');
  const codes = [
    (d.aCode || d.namasteCode) && `NAMASTE ${d.aCode || d.namasteCode}`,
    d.icd11Code && `ICD-11 ${d.icd11Code}`,
    d.icd10DualCode && `ICD-10 ${d.icd10DualCode}`,
    (d.snomedConceptId || d.snomedCode) && `SNOMED CT ${d.snomedConceptId || d.snomedCode}`
  ].filter(Boolean) as string[];
  return title ? { title, subtitle, codes } : null;
};
