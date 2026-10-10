process.env.DB_PATH = process.env.DB_PATH || require('path').join(require('os').tmpdir(), 'hospital-fhir-sample.db');
import fs from 'fs';
import { FhirGeneratorService } from '/Users/piyushkumar/Desktop/SIH/26047/backend/src/services/fhirGenerator.service';
const bundle = FhirGeneratorService.buildBundle({
  encounterId: 'enc-sample-001', patientId: 'pat-sample-001', createdAt: new Date().toISOString(), doctorName: 'Dr Ananya Sharma', department: 'General Medicine OPD', careStream: 'ALLOPATHY',
  patient: { id: 'pat-sample-001', name: 'Rekha Devi', age: 31, gender: 'FEMALE', abhaId: '91-1234-5678-9012', abhaAddress: 'rekha.demo@sbx', isPregnant: true, gestationalWeeks: 22 },
  practitioner: { id: 'staff-1', name: 'Dr Ananya Sharma', registrationNo: 'DMC Reg. 98421', qualification: 'MBBS, MD (General Medicine)', role: 'doctor' },
  symptoms: [{ name: 'Fever', severity: 5, isNegated: false, onset: '3 days' }, { name: 'Chest Pain', severity: 0, isNegated: true }],
  diagnoses: [{ aCode: 'AYU-JWA-001', sanskritTerm: 'Vataja Jwara', englishEquivalent: 'Acute Pyrexia / Viral Fever', icd10DualCode: 'R50.9', snomedConceptId: '386661006', icmrStandardWorkflowId: 'ICMR-STW-INF-001' }],
  allopathicPrescription: [{ drugName: 'Paracetamol', dosage: '500 mg', route: 'Oral', frequency: 'TDS', timing: 'After Food (PC)', duration: '3 days' }],
  ongoingMedicines: ['Levothyroxine 50 mcg'], investigationsOrdered: ['Complete blood count'], followUpDays: 5,
  vitals: { bp: '118/76', pulse: 112, spo2: 94, temp: '101.5 F', source: 'clinician' },
  history: { conditions: ['Hypothyroidism'], allergies: 'Penicillin (rash)', currentMedicines: 'Levothyroxine 50 mcg', pastSurgical: [{ name: 'LSCS', since: '2022' }], familyHistory: [{ condition: 'Diabetes', relation: 'mother' }], personal: { tobacco: 'never', alcohol: 'never', diet: 'vegetarian' }, reviewOfSystems: { respiratory: 'present', cardiovascular: 'denied' } },
  scannedDocuments: [{ id: 'doc-1', documentType: 'LAB_REPORT', extractedText: 'Hb 11.2 g/dL', createdAt: new Date().toISOString() }]
} as any);
fs.writeFileSync(process.argv[2], JSON.stringify(bundle, null, 2));
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(FhirGeneratorService.buildPrescriptionRecord(bundle), null, 2));
console.log('bundle written', process.argv[2], 'entries', bundle.entry.length, 'validate:', JSON.stringify(FhirGeneratorService.validateBundle(bundle)).slice(0, 200));
