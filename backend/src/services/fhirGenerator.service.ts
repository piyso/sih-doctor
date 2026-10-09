/**
 * ABDM FHIR R4 document bundle builder following the NRCES NDHM implementation guide
 * (https://nrces.in/ndhm/fhir/r4): OPConsultRecord composition with the IG's section codes,
 * NDHM resource profiles, and `urn:uuid` references that resolve inside the bundle.
 *
 * Rules this builder follows:
 *  - No identifier is ever invented. ABHA number / address appear only when the patient has them;
 *    otherwise the hospital MRN (the local patient id) is used with a hospital-scoped system URL.
 *    The practitioner carries the council registration number from the staff record; the HPR id
 *    only when configured. Facility HFR id only when HFR_FACILITY_ID is set.
 *  - Diagnoses carry NAMASTE + ICD-10 + SNOMED CT (+ ICD-11 when the entry has it).
 *  - Vitals are LOINC-coded Observations; the structured history becomes AllergyIntolerance,
 *    FamilyMemberHistory, Condition (past medical), Procedure (past surgical), MedicationStatement
 *    (ongoing medicines), social-history Observations; investigations become ServiceRequests,
 *    follow-up an Appointment, scanned documents DocumentReferences.
 *  - `validateBundle` performs the structural checks a validator would fail first on (reference
 *    resolution, required elements, section codes). Full profile validation needs the HAPI
 *    validator with the NDHM IG package: `java -jar validator_cli.jar bundle.json -version 4.0.1 -ig nrces.in.ndhm.fhir.r4#6.5.0`.
 */

import { v4 as uuidv4 } from 'uuid';
import { AbdmFhirBundle, ClinicalHistory, NamasteTriCodedDiagnosis } from '../shared/types';
import { AyushEngineService } from './ayushEngine.service';
import { normaliseHistory } from './clinicalHistory.service';

const NDHM = 'https://nrces.in/ndhm/fhir/r4/StructureDefinition';
const SCT = 'http://snomed.info/sct';
const LOINC = 'http://loinc.org';
const HOSPITAL = (process.env.HOSPITAL_FHIR_BASE || 'https://hospital.example/fhir').replace(/\/$/, '');
const HOSPITAL_NAME = process.env.HOSPITAL_SHORT_NAME || 'Hospital';
const HFR_ID = process.env.HFR_FACILITY_ID || '';

export const SECTION_CODES = {
  chiefComplaints: { code: '422843007', display: 'Chief complaint section' },
  physicalExamination: { code: '425044008', display: 'Physical exam section' },
  allergies: { code: '722446000', display: 'Allergy record' },
  medicalHistory: { code: '371529009', display: 'History and physical report' },
  familyHistory: { code: '422432008', display: 'Family history section' },
  investigationAdvice: { code: '721963009', display: 'Order document' },
  medications: { code: '721912009', display: 'Medication summary document' },
  followUp: { code: '736271009', display: 'Outpatient care plan' },
  procedure: { code: '371525003', display: 'Clinical procedure report' },
  otherObservations: { code: '404684003', display: 'Clinical finding' },
  documentReference: { code: '371530004', display: 'Clinical consultation report' }
} as const;

export interface FhirBuildInput {
  encounterId?: string;
  sessionId?: string;
  patientId?: string;
  patient?: { id?: string; name?: string; age?: number; gender?: string; abhaId?: string | null; abhaAddress?: string | null; isPregnant?: boolean; gestationalWeeks?: number; weightKg?: number };
  practitioner?: { id?: string; name?: string; registrationNo?: string | null; qualification?: string | null; role?: string; hprId?: string | null };
  doctorId?: string;
  doctorName?: string;
  doctorRegistration?: string;
  doctorQualification?: string;
  department?: string;
  careStream?: string;
  createdAt?: string;
  symptoms?: any[];
  diagnoses?: NamasteTriCodedDiagnosis[] | any[];
  allopathicPrescription?: any[];
  allopathicPrescriptions?: any[];
  ayushPrescription?: any[];
  ayushPrescriptions?: any[];
  ongoingMedicines?: any[];
  investigationsOrdered?: string[];
  vitals?: Record<string, any>;
  history?: ClinicalHistory | any;
  followUpDays?: number;
  advice?: string;
  doctorNotes?: string;
  scannedDocuments?: Array<{ id?: string; documentType?: string; extractedText?: string | null; recordedDate?: string; createdAt?: string; mimeType?: string; base64?: string }>;
}

interface Entry { fullUrl: string; resource: Record<string, any> }

const ref = (id: string) => ({ reference: `urn:uuid:${id}` });
const coding = (system: string, code: string, display?: string) => ({ system, code, ...(display ? { display } : {}) });
const text = (t: string) => ({ text: t });
const genderOf = (g: unknown): 'male' | 'female' | 'other' | 'unknown' => {
  const s = String(g || '').toLowerCase();
  return s === 'male' || s === 'female' || s === 'other' ? s : 'unknown';
};
const num = (v: unknown): number | null => { const n = parseFloat(String(v ?? '').replace(/[^\d.\-]/g, '')); return Number.isFinite(n) ? n : null; };
const isoDate = (s?: string) => (s && !Number.isNaN(Date.parse(s)) ? new Date(s).toISOString() : new Date().toISOString());

export class FhirGeneratorService {
  static generateEncounterBundle(record: any): AbdmFhirBundle {
    return this.buildBundle(record);
  }

  static buildBundle(record: FhirBuildInput): AbdmFhirBundle {
    const timestamp = isoDate(record.createdAt);
    const ids = {
      bundle: uuidv4(), composition: uuidv4(), patient: uuidv4(), practitioner: uuidv4(), organization: uuidv4(), encounter: uuidv4()
    };
    const entries: Entry[] = [];
    const add = (resource: Record<string, any>): string => {
      entries.push({ fullUrl: `urn:uuid:${resource.id}`, resource });
      return resource.id;
    };

    // ---- Patient
    const p = record.patient || {};
    const patientLocalId = p.id || record.patientId || record.sessionId || 'unknown';
    const patientIdentifiers: any[] = [];
    if (p.abhaId) patientIdentifiers.push({ type: { coding: [coding('http://terminology.hl7.org/CodeSystem/v2-0203', 'MR', 'Medical record number')], text: 'ABHA number' }, system: 'https://healthid.ndhm.gov.in', value: String(p.abhaId) });
    if (p.abhaAddress) patientIdentifiers.push({ type: text('ABHA address'), system: 'https://healthid.ndhm.gov.in', value: String(p.abhaAddress) });
    patientIdentifiers.push({ type: { coding: [coding('http://terminology.hl7.org/CodeSystem/v2-0203', 'MR', 'Medical record number')], text: 'Hospital MRN' }, system: `${HOSPITAL}/mrn`, value: String(patientLocalId) });
    const patientResource: Record<string, any> = {
      resourceType: 'Patient', id: ids.patient, meta: { profile: [`${NDHM}/Patient`] },
      identifier: patientIdentifiers,
      name: [{ text: p.name || 'Patient' }],
      gender: genderOf(p.gender)
    };
    if (Number.isFinite(Number(p.age)) && Number(p.age) > 0) {
      patientResource.extension = [{ url: `${HOSPITAL}/StructureDefinition/age-years`, valueInteger: Number(p.age) }];
    }
    add(patientResource);

    // ---- Organization
    add({
      resourceType: 'Organization', id: ids.organization, meta: { profile: [`${NDHM}/Organization`] },
      ...(HFR_ID ? { identifier: [{ type: { coding: [coding('http://terminology.hl7.org/CodeSystem/v2-0203', 'PRN', 'Provider number')] }, system: 'https://facility.ndhm.gov.in', value: HFR_ID }] } : {}),
      name: HOSPITAL_NAME
    });

    // ---- Practitioner (identifiers from the staff record only)
    const pr = record.practitioner || {};
    const regNo = pr.registrationNo || record.doctorRegistration || '';
    const practitionerIdentifiers: any[] = [];
    if (pr.hprId) practitionerIdentifiers.push({ type: { coding: [coding('http://terminology.hl7.org/CodeSystem/v2-0203', 'MD', 'Medical License number')] }, system: 'https://doctor.ndhm.gov.in', value: pr.hprId });
    if (regNo) practitionerIdentifiers.push({ type: { coding: [coding('http://terminology.hl7.org/CodeSystem/v2-0203', 'MD', 'Medical License number')], text: 'Council registration' }, system: record.careStream === 'AYURVEDA' || pr.role === 'vaidya' ? 'https://ncismindia.org' : 'https://www.nmc.org.in', value: String(regNo) });
    add({
      resourceType: 'Practitioner', id: ids.practitioner, meta: { profile: [`${NDHM}/Practitioner`] },
      ...(practitionerIdentifiers.length ? { identifier: practitionerIdentifiers } : {}),
      name: [{ text: pr.name || record.doctorName || 'Consulting practitioner' }],
      ...(pr.qualification || record.doctorQualification ? { qualification: [{ code: text(String(pr.qualification || record.doctorQualification)) }] } : {})
    });

    // ---- Encounter
    add({
      resourceType: 'Encounter', id: ids.encounter, meta: { profile: [`${NDHM}/Encounter`] },
      ...(record.encounterId ? { identifier: [{ system: `${HOSPITAL}/encounter`, value: String(record.encounterId) }] } : {}),
      status: 'finished',
      class: coding('http://terminology.hl7.org/CodeSystem/v3-ActCode', 'AMB', 'ambulatory'),
      ...(record.department ? { serviceType: text(String(record.department)) } : {}),
      subject: ref(ids.patient),
      participant: [{ individual: ref(ids.practitioner) }],
      period: { start: timestamp, end: timestamp },
      serviceProvider: ref(ids.organization)
    });

    const history = normaliseHistory(record.history);
    const sectionEntries: Record<keyof typeof SECTION_CODES, string[]> = {
      chiefComplaints: [], physicalExamination: [], allergies: [], medicalHistory: [], familyHistory: [], investigationAdvice: [],
      medications: [], followUp: [], procedure: [], otherObservations: [], documentReference: []
    };

    // ---- Chief complaints / diagnoses as Condition (tri-coded when resolvable)
    const diagnoses: any[] = (record.diagnoses && record.diagnoses.length > 0) ? record.diagnoses : [];
    const symptomsPresent = (record.symptoms || []).filter((s: any) => s && !s.isNegated);
    const conditionFromDiag = (d: any) => ({
      resourceType: 'Condition', id: uuidv4(), meta: { profile: [`${NDHM}/Condition`] },
      clinicalStatus: { coding: [coding('http://terminology.hl7.org/CodeSystem/condition-clinical', 'active', 'Active')] },
      category: [{ coding: [coding('http://terminology.hl7.org/CodeSystem/condition-category', 'encounter-diagnosis', 'Encounter Diagnosis')] }],
      code: {
        coding: [
          ...(d.aCode ? [coding('https://namstp.ayush.gov.in', d.aCode, d.sanskritTerm)] : []),
          ...(d.icd11Code ? [coding('http://id.who.int/icd/release/11/mms', d.icd11Code, d.englishEquivalent)] : []),
          ...(d.icd10DualCode ? [coding('http://hl7.org/fhir/sid/icd-10', d.icd10DualCode, d.englishEquivalent)] : []),
          ...(d.snomedConceptId ? [coding(SCT, String(d.snomedConceptId), d.englishEquivalent)] : [])
        ],
        text: d.sanskritTerm ? `${d.sanskritTerm} (${d.englishEquivalent})` : String(d.englishEquivalent || d.name || 'Diagnosis')
      },
      subject: ref(ids.patient), encounter: ref(ids.encounter), recordedDate: timestamp
    });
    if (diagnoses.length) {
      for (const d of diagnoses) sectionEntries.chiefComplaints.push(add(conditionFromDiag(d)));
    } else {
      for (const s of symptomsPresent.length ? symptomsPresent : [{ name: 'Clinical finding' }]) {
        const name = typeof s === 'string' ? s : (s.name || s.standard || 'Clinical finding');
        const resolved = AyushEngineService.resolveDiagnosis(name);
        if (resolved) sectionEntries.chiefComplaints.push(add(conditionFromDiag(resolved)));
        else sectionEntries.chiefComplaints.push(add({
          resourceType: 'Condition', id: uuidv4(), meta: { profile: [`${NDHM}/Condition`] },
          clinicalStatus: { coding: [coding('http://terminology.hl7.org/CodeSystem/condition-clinical', 'active', 'Active')] },
          category: [{ coding: [coding('http://terminology.hl7.org/CodeSystem/condition-category', 'problem-list-item', 'Problem List Item')] }],
          code: { coding: [coding(SCT, '404684003', 'Clinical finding')], text: String(name) },
          subject: ref(ids.patient), encounter: ref(ids.encounter),
          ...(typeof s === 'object' && s.onset && !/unspecified/i.test(s.onset) ? { onsetString: String(s.onset) } : {})
        }));
      }
    }

    // ---- Vitals as LOINC Observations
    const v = record.vitals || {};
    const vitalObs = (code: string, display: string, value: number, unit: string, ucum: string) => add({
      resourceType: 'Observation', id: uuidv4(), meta: { profile: [`${NDHM}/Observation`] }, status: 'final',
      category: [{ coding: [coding('http://terminology.hl7.org/CodeSystem/observation-category', 'vital-signs', 'Vital Signs')] }],
      code: { coding: [coding(LOINC, code, display)], text: display }, subject: ref(ids.patient), encounter: ref(ids.encounter), effectiveDateTime: timestamp,
      valueQuantity: { value, unit, system: 'http://unitsofmeasure.org', code: ucum },
      ...(v.source && v.source !== 'clinician' ? { note: [{ text: 'Patient-reported at kiosk; not verified by staff.' }] } : {})
    });
    const bp = String(v.bp || '').match(/(\d{2,3})\s*(?:\/|by|बटा)\s*(\d{2,3})/i);
    if (bp) sectionEntries.physicalExamination.push(add({
      resourceType: 'Observation', id: uuidv4(), meta: { profile: [`${NDHM}/Observation`] }, status: 'final',
      category: [{ coding: [coding('http://terminology.hl7.org/CodeSystem/observation-category', 'vital-signs', 'Vital Signs')] }],
      code: { coding: [coding(LOINC, '85354-9', 'Blood pressure panel with all children optional')], text: 'Blood pressure' },
      subject: ref(ids.patient), encounter: ref(ids.encounter), effectiveDateTime: timestamp,
      component: [
        { code: { coding: [coding(LOINC, '8480-6', 'Systolic blood pressure')] }, valueQuantity: { value: parseInt(bp[1], 10), unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' } },
        { code: { coding: [coding(LOINC, '8462-4', 'Diastolic blood pressure')] }, valueQuantity: { value: parseInt(bp[2], 10), unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' } }
      ]
    }));
    const pulse = num(v.pulse); if (pulse !== null) sectionEntries.physicalExamination.push(vitalObs('8867-4', 'Heart rate', pulse, '/min', '/min'));
    const spo2 = num(v.spo2); if (spo2 !== null) sectionEntries.physicalExamination.push(vitalObs('2708-6', 'Oxygen saturation in Arterial blood', spo2, '%', '%'));
    const rr = num(v.respiratoryRate); if (rr !== null) sectionEntries.physicalExamination.push(vitalObs('9279-1', 'Respiratory rate', rr, '/min', '/min'));
    const temp = v.temp !== undefined ? String(v.temp).match(/(\d{2,3}(?:\.\d+)?)\s*°?\s*([cf])?/i) : null;
    if (temp) {
      const val = parseFloat(temp[1]);
      const isF = (temp[2] || '').toLowerCase() === 'f' || (!temp[2] && val >= 50);
      sectionEntries.physicalExamination.push(vitalObs('8310-5', 'Body temperature', isF ? parseFloat(((val - 32) * 5 / 9).toFixed(1)) : val, 'Cel', 'Cel'));
    }
    const weight = num(v.weightKg ?? p.weightKg); if (weight !== null) sectionEntries.physicalExamination.push(vitalObs('29463-7', 'Body weight', weight, 'kg', 'kg'));
    const glucose = num(v.bloodSugar); if (glucose !== null) sectionEntries.physicalExamination.push(vitalObs('2339-0', 'Glucose [Mass/volume] in Blood', glucose, 'mg/dL', 'mg/dL'));

    // ---- Allergies
    for (const a of history.allergyList) {
      sectionEntries.allergies.push(add({
        resourceType: 'AllergyIntolerance', id: uuidv4(), meta: { profile: [`${NDHM}/AllergyIntolerance`] },
        clinicalStatus: { coding: [coding('http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', 'active', 'Active')] },
        verificationStatus: { coding: [coding('http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', 'unconfirmed', 'Unconfirmed')] },
        ...(a.type && a.type !== 'other' ? { category: [a.type === 'drug' ? 'medication' : a.type] } : {}),
        ...(a.severity === 'severe' ? { criticality: 'high' } : a.severity === 'mild' ? { criticality: 'low' } : {}),
        code: text(a.agent), patient: ref(ids.patient), recordedDate: timestamp,
        ...(a.reaction ? { reaction: [{ manifestation: [text(a.reaction)] }] } : {})
      }));
    }

    // ---- Medical history (past medical as Condition, past surgical as Procedure)
    for (const h of history.pastMedical) {
      sectionEntries.medicalHistory.push(add({
        resourceType: 'Condition', id: uuidv4(), meta: { profile: [`${NDHM}/Condition`] },
        clinicalStatus: { coding: [coding('http://terminology.hl7.org/CodeSystem/condition-clinical', h.status === 'resolved' ? 'resolved' : 'active', h.status === 'resolved' ? 'Resolved' : 'Active')] },
        category: [{ coding: [coding('http://terminology.hl7.org/CodeSystem/condition-category', 'problem-list-item', 'Problem List Item')] }],
        code: text(h.name), subject: ref(ids.patient), ...(h.since ? { onsetString: h.since } : {}), ...(h.notes ? { note: [{ text: h.notes }] } : {})
      }));
    }
    for (const s of history.pastSurgical) {
      sectionEntries.procedure.push(add({
        resourceType: 'Procedure', id: uuidv4(), meta: { profile: [`${NDHM}/Procedure`] }, status: 'completed',
        code: text(s.name), subject: ref(ids.patient), ...(s.since ? { performedString: s.since } : {})
      }));
    }

    // ---- Family history
    for (const f of history.familyHistory) {
      sectionEntries.familyHistory.push(add({
        resourceType: 'FamilyMemberHistory', id: uuidv4(), meta: { profile: [`${NDHM}/FamilyMemberHistory`] }, status: 'completed',
        patient: ref(ids.patient), relationship: text(f.relation || 'family member'), condition: [{ code: text(f.condition) }]
      }));
    }

    // ---- Medications: prescribed (MedicationRequest) and ongoing (MedicationStatement)
    const allopathic = record.allopathicPrescription || record.allopathicPrescriptions || [];
    const ayush = record.ayushPrescription || record.ayushPrescriptions || [];
    const medRequest = (name: string, dosage: string, extra: Record<string, any> = {}) => add({
      resourceType: 'MedicationRequest', id: uuidv4(), meta: { profile: [`${NDHM}/MedicationRequest`] }, status: 'active', intent: 'order',
      medicationCodeableConcept: { ...(extra.coding ? { coding: extra.coding } : {}), text: name },
      subject: ref(ids.patient), encounter: ref(ids.encounter), authoredOn: timestamp, requester: ref(ids.practitioner),
      dosageInstruction: [{ text: dosage }]
    });
    for (const m of allopathic) {
      const name = m?.drugName || m?.name || m?.genericName || 'Medication';
      const dose = [m?.dosage, m?.frequency, m?.timing, m?.duration || (m?.durationDays ? `${m.durationDays} days` : '')].filter(Boolean).join(' ').trim() || 'As directed';
      sectionEntries.medications.push(medRequest(String(name), dose));
    }
    for (const a of ayush) {
      const name = a?.formulationName || a?.classicalName || a?.name || 'Ayurvedic formulation';
      const dose = [a?.dosage || a?.dose, a?.frequency, a?.anupana ? `with ${a.anupana}` : '', a?.timing, a?.duration || (a?.durationDays ? `${a.durationDays} days` : '')].filter(Boolean).join(' ').trim() || 'As directed';
      sectionEntries.medications.push(medRequest(String(name), dose, { coding: [coding('https://namstp.ayush.gov.in/formulations', String(name), String(name))] }));
    }
    for (const o of [...(record.ongoingMedicines || []), ...history.drugHistory]) {
      const name = typeof o === 'string' ? o : (o?.drugName || o?.name || o?.formulationName || o?.classicalName || '');
      if (!name) continue;
      sectionEntries.medications.push(add({
        resourceType: 'MedicationStatement', id: uuidv4(), meta: { profile: [`${NDHM}/MedicationStatement`] },
        status: (o as any)?.adherence === 'stopped' ? 'stopped' : 'active', medicationCodeableConcept: text(String(name)), subject: ref(ids.patient), dateAsserted: timestamp,
        ...((o as any)?.dose || (o as any)?.dosage ? { dosage: [{ text: String((o as any).dose || (o as any).dosage) }] } : {})
      }));
    }

    // ---- Investigation advice
    for (const inv of record.investigationsOrdered || []) {
      if (!inv) continue;
      sectionEntries.investigationAdvice.push(add({
        resourceType: 'ServiceRequest', id: uuidv4(), meta: { profile: [`${NDHM}/ServiceRequest`] }, status: 'active', intent: 'order',
        code: text(String(inv)), subject: ref(ids.patient), encounter: ref(ids.encounter), authoredOn: timestamp, requester: ref(ids.practitioner)
      }));
    }

    // ---- Follow-up
    if (Number.isFinite(Number(record.followUpDays)) && Number(record.followUpDays) > 0) {
      const start = new Date(new Date(timestamp).getTime() + Number(record.followUpDays) * 86400000).toISOString();
      sectionEntries.followUp.push(add({
        resourceType: 'Appointment', id: uuidv4(), meta: { profile: [`${NDHM}/Appointment`] }, status: 'proposed',
        description: `Follow-up visit after ${record.followUpDays} days${record.advice ? `: ${String(record.advice).slice(0, 200)}` : ''}`,
        start, end: start, participant: [{ actor: ref(ids.patient), status: 'needs-action' }, { actor: ref(ids.practitioner), status: 'needs-action' }]
      }));
    }

    // ---- Other observations: social history
    const soc = history.personal;
    const social = (code: { system: string; code: string; display: string } | null, label: string, value: string) => add({
      resourceType: 'Observation', id: uuidv4(), meta: { profile: [`${NDHM}/Observation`] }, status: 'final',
      category: [{ coding: [coding('http://terminology.hl7.org/CodeSystem/observation-category', 'social-history', 'Social History')] }],
      code: { ...(code ? { coding: [coding(code.system, code.code, code.display)] } : {}), text: label }, subject: ref(ids.patient), effectiveDateTime: timestamp, valueString: value
    });
    if (soc.tobacco) sectionEntries.otherObservations.push(social({ system: LOINC, code: '72166-2', display: 'Tobacco smoking status' }, 'Tobacco use', `${soc.tobacco}${soc.tobaccoDetail ? ` (${soc.tobaccoDetail})` : ''}`));
    if (soc.alcohol) sectionEntries.otherObservations.push(social({ system: LOINC, code: '74013-4', display: 'Alcoholic drinks per day' }, 'Alcohol use', soc.alcohol));
    if (soc.diet) sectionEntries.otherObservations.push(social(null, 'Diet', soc.diet.replace('_', '-')));
    if (soc.appetite) sectionEntries.otherObservations.push(social(null, 'Appetite', soc.appetite));
    if (soc.bowel) sectionEntries.otherObservations.push(social(null, 'Bowel habit', soc.bowel));
    if (soc.sleep) sectionEntries.otherObservations.push(social(null, 'Sleep', soc.sleep));
    if (soc.physicalActivity) sectionEntries.otherObservations.push(social(null, 'Physical activity', soc.physicalActivity));
    const denied = (record.symptoms || []).filter((s: any) => s?.isNegated).map((s: any) => s.name).filter(Boolean);
    if (denied.length) sectionEntries.otherObservations.push(social(null, 'Symptoms denied by patient', denied.join(', ')));
    const ros = Object.entries(history.reviewOfSystems).filter(([, a]) => a === 'denied').map(([s]) => s);
    if (ros.length) sectionEntries.otherObservations.push(social(null, 'Review of systems: negative', ros.join(', ')));

    // ---- Scanned documents
    for (const d of record.scannedDocuments || []) {
      const content: any = d.base64 ? { attachment: { contentType: d.mimeType || 'image/jpeg', data: d.base64, creation: isoDate(d.recordedDate || d.createdAt) } }
        : { attachment: { contentType: 'text/plain', data: Buffer.from(String(d.extractedText || '').slice(0, 20000), 'utf8').toString('base64'), title: 'OCR text', creation: isoDate(d.recordedDate || d.createdAt) } };
      sectionEntries.documentReference.push(add({
        resourceType: 'DocumentReference', id: uuidv4(), meta: { profile: [`${NDHM}/DocumentReference`] }, status: 'current',
        type: text(String(d.documentType || 'Prior medical document').replace(/_/g, ' ')), subject: ref(ids.patient), date: isoDate(d.recordedDate || d.createdAt), content: [content]
      }));
    }

    // ---- Composition (first entry per the document-bundle rule)
    const sections = (Object.keys(SECTION_CODES) as Array<keyof typeof SECTION_CODES>)
      .filter(k => sectionEntries[k].length > 0)
      .map(k => ({
        title: k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim(),
        code: { coding: [coding(SCT, SECTION_CODES[k].code, SECTION_CODES[k].display)] },
        entry: sectionEntries[k].map(id => ref(id))
      }));
    const composition = {
      resourceType: 'Composition', id: ids.composition, meta: { profile: [`${NDHM}/OPConsultRecord`] },
      language: 'en-IN', identifier: { system: `${HOSPITAL}/composition`, value: String(record.encounterId || ids.composition) },
      status: 'final', type: { coding: [coding(SCT, '371530004', 'Clinical consultation report')], text: 'Clinical Consultation report' },
      subject: ref(ids.patient), encounter: ref(ids.encounter), date: timestamp, author: [ref(ids.practitioner)],
      title: 'OP Consultation Record', custodian: ref(ids.organization), section: sections
    };
    entries.unshift({ fullUrl: `urn:uuid:${ids.composition}`, resource: composition });

    return {
      resourceType: 'Bundle', id: ids.bundle,
      meta: { versionId: '1', lastUpdated: timestamp, profile: [`${NDHM}/DocumentBundle`] },
      identifier: { system: `${HOSPITAL}/bundle`, value: ids.bundle },
      type: 'document', timestamp, entry: entries
    };
  }

  /** Structural pre-validation: what a FHIR validator fails first on. */
  static validateBundle(bundle: AbdmFhirBundle): { valid: boolean; errors: string[]; warnings: string[]; resourceCounts: Record<string, number> } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const counts: Record<string, number> = {};
    if (bundle.resourceType !== 'Bundle' || bundle.type !== 'document') errors.push('Bundle.type must be "document"');
    if (!bundle.timestamp) errors.push('Bundle.timestamp is required for document bundles');
    const urls = new Set<string>();
    for (const e of bundle.entry || []) {
      const r = e.resource;
      counts[r.resourceType] = (counts[r.resourceType] || 0) + 1;
      if (!e.fullUrl?.startsWith('urn:uuid:')) errors.push(`${r.resourceType}: fullUrl must be urn:uuid`);
      if (e.fullUrl !== `urn:uuid:${r.id}`) errors.push(`${r.resourceType}: fullUrl does not match resource id`);
      if (urls.has(e.fullUrl)) errors.push(`duplicate fullUrl ${e.fullUrl}`);
      urls.add(e.fullUrl);
      if (!r.meta?.profile?.length) warnings.push(`${r.resourceType} ${r.id}: no NDHM profile declared`);
    }
    const first = bundle.entry?.[0]?.resource;
    if (!first || first.resourceType !== 'Composition') errors.push('First entry must be the Composition');
    const walk = (node: any, where: string) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach((n, i) => walk(n, `${where}[${i}]`)); return; }
      for (const [k, val] of Object.entries(node)) {
        if (k === 'reference' && typeof val === 'string') { if (!urls.has(val)) errors.push(`unresolved reference ${val} at ${where}`); }
        else walk(val, `${where}.${k}`);
      }
    };
    for (const e of bundle.entry || []) walk(e.resource, e.resource.resourceType);
    if (first?.resourceType === 'Composition') {
      for (const need of ['status', 'type', 'subject', 'date', 'author', 'title']) if (!(first as any)[need]) errors.push(`Composition.${need} is required`);
      for (const s of first.section || []) {
        if (!s.code?.coding?.[0]?.code) errors.push(`Composition.section "${s.title}" has no code`);
        if (!s.entry?.length) errors.push(`Composition.section "${s.title}" has no entries`);
      }
      if (!(first.section || []).some((s: any) => s.code?.coding?.[0]?.code === SECTION_CODES.chiefComplaints.code)) warnings.push('No Chief complaints section');
    }
    const patient = (bundle.entry || []).find(e => e.resource.resourceType === 'Patient')?.resource;
    if (patient) {
      for (const idf of patient.identifier || []) {
        if (idf.system === 'https://healthid.ndhm.gov.in' && idf.type?.text !== 'ABHA address' && !/^\d{14}$|^\d{2}-\d{4}-\d{4}-\d{4}$/.test(String(idf.value))) errors.push(`ABHA number "${idf.value}" is not 14 digits`);
      }
      if (!patient.gender) errors.push('Patient.gender is required by the NDHM profile');
    }
    return { valid: errors.length === 0, errors, warnings, resourceCounts: counts };
  }
}
