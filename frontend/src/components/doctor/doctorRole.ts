import { AllopathicMedication, AyushFormulation, DiagnosisEntry, InvestigationOrder } from '../../types/api';

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

/** Clinician-recorded examination. For a vaidya: Ashtavidha / Dashavidha Pariksha and Samprapti. */
export interface ClinicalExamination {
  general?: string;
  ashtavidha?: Partial<Record<'nadi' | 'mutra' | 'mala' | 'jihva' | 'shabda' | 'sparsha' | 'drik' | 'akriti', string>>;
  dashavidha?: Partial<Record<'prakriti' | 'vikriti' | 'sara' | 'samhanana' | 'pramana' | 'satmya' | 'satva' | 'aharaShakti' | 'vyayamaShakti' | 'vaya', string>>;
  samprapti?: Partial<Record<'dosha' | 'dushya' | 'srotas' | 'srotodushti' | 'agni' | 'udbhavaSthana' | 'adhishthana', string>>;
}

/** Everything the doctor is writing for one patient; kept per patient and saved on the server. */
export interface RxDraft {
  allopathic: AllopathicMedication[];
  ayush: AyushFormulation[];
  pathya: string[];
  apathya: string[];
  advice: string;
  followUpDays: number | '';
  notes: string;
  diagnoses: DiagnosisEntry[];
  investigations: InvestigationOrder[];
  examination: ClinicalExamination;
  /** Typed reasons for STOP alerts, by group key (sent with the signature). */
  acknowledgements: Record<string, string>;
}

export const emptyRxDraft = (): RxDraft => ({
  allopathic: [],
  ayush: [],
  pathya: [],
  apathya: [],
  advice: '',
  followUpDays: '',
  notes: '',
  diagnoses: [],
  investigations: [],
  examination: {},
  acknowledgements: {}
});

/** Fills fields added after a draft was saved, so older drafts load safely. */
export const normaliseDraft = (d: any): RxDraft => ({ ...emptyRxDraft(), ...(d && typeof d === 'object' ? d : {}) });

/** Display text and codes for a provisional diagnosis from the backend (several shapes exist). */
export const formatDiagnosis = (d: any, role: DoctorRole): { title: string; subtitle: string; codes: string[] } | null => {
  if (!d) return null;
  if (typeof d === 'string') return { title: d, subtitle: '', codes: [] };
  if (d.display && !d.sanskritTerm) {
    const codes = [
      d.system === 'NAMASTE' && d.code && d.codeVerified ? `NAMASTE ${d.code}` : '',
      (d.system === 'ICD-11-MMS' || d.system === 'ICD-11-TM2') && d.code ? `ICD-11 ${d.code}` : '',
      d.icd10 ? `ICD-10 ${d.icd10}` : '',
      d.snomed ? `SNOMED CT ${d.snomed}` : ''
    ].filter(Boolean);
    return { title: d.display, subtitle: d.status === 'final' ? 'Final diagnosis' : 'Provisional diagnosis', codes };
  }
  const sanskrit = d.sanskritTerm || d.ayushTerm || '';
  const english = d.englishEquivalent || d.display || d.name || '';
  const title = role === 'AYURVEDA' ? sanskrit || english : english || sanskrit;
  const subtitle = role === 'AYURVEDA' ? (sanskrit && english ? english : '') : (english && sanskrit ? `Ayurveda: ${sanskrit}` : '');
  // Seed NAMASTE codes (AYU-…) are placeholders until the official export is imported: not shown as codes.
  const codes = [
    d.icd11Code && `ICD-11 ${d.icd11Code}`,
    d.icd10DualCode && `ICD-10 ${d.icd10DualCode}`,
    (d.snomedConceptId || d.snomedCode) && `SNOMED CT ${d.snomedConceptId || d.snomedCode}`
  ].filter(Boolean) as string[];
  return title ? { title, subtitle, codes } : null;
};

/** A kiosk suggestion turned into a diagnosis entry the doctor can accept (never auto-accepted). */
export const suggestionToDiagnosis = (d: any, role: DoctorRole): DiagnosisEntry | null => {
  const f = formatDiagnosis(d, role);
  if (!f) return null;
  return {
    display: f.title + (f.subtitle && !/diagnosis/i.test(f.subtitle) ? ` (${f.subtitle.replace(/^Ayurveda: /, '')})` : ''),
    system: d?.aCode ? 'NAMASTE' : 'FREE_TEXT',
    code: d?.aCode,
    codeVerified: false,
    icd10: d?.icd10DualCode,
    snomed: d?.snomedConceptId ? String(d.snomedConceptId) : undefined,
    english: d?.englishEquivalent,
    status: 'provisional',
    source: 'accepted_suggestion'
  };
};
