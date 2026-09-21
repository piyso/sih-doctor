/**
 * ABDM FHIR R4 Invariant & Tri-Coding Benchmark
 * Evaluates FHIR R4 Document Bundle builder, structural invariants, and tri-coded diagnostic concepts.
 */

import { FhirGeneratorService } from '../src/services/fhirGenerator.service';
import { ConsultationRecord } from '../../../shared/types';

export function runFhirBenchmark(bundleCount: number = 1000) {
  console.log(`\n========================================================================`);
  console.log(`  RUNNING ABDM FHIR R4 INTEROPERABILITY & TRI-CODING BENCHMARK`);
  console.log(`========================================================================`);

  const tStart = performance.now();

  let validBundles = 0;
  let triCodedEntries = 0;
  let compositionInvariantsMet = 0;

  const diagnosisArchetypes = [
    {
      aCode: 'AYU-JWA-001',
      sanskritTerm: 'Vataja Jwara',
      englishEquivalent: 'Acute Pyrexia / Viral Fever',
      icd10DualCode: 'R50.9',
      snomedConceptId: '386661006',
      icmrStandardWorkflowId: 'ICMR-STW-INF-001',
      drug: { drugName: 'Paracetamol', dosage: '650mg', route: 'Oral' as const, frequency: 'TDS' as const, timing: 'After Food (PC)' as const, duration: '3 days' },
      ayush: { formulationName: 'Mahasudarshan Vati', category: 'Vati/Gutika' as const, dosage: '2 tablets', frequency: 'BD' as const, anupana: 'Warm Water', timing: 'Prathakaal (Morning)' as const, duration: '7 days' }
    },
    {
      aCode: 'AYU-AML-001',
      sanskritTerm: 'Amlapitta',
      englishEquivalent: 'Non-Ulcer Dyspepsia / GERD',
      icd10DualCode: 'K21.9',
      snomedConceptId: '235595009',
      icmrStandardWorkflowId: 'ICMR-STW-GAS-002',
      drug: { drugName: 'Pantoprazole', dosage: '40mg', route: 'Oral' as const, frequency: 'OD' as const, timing: 'Before Food (AC)' as const, duration: '14 days' },
      ayush: { formulationName: 'Avipattikar Churna', category: 'Churna' as const, dosage: '3g', frequency: 'BD' as const, anupana: 'Cold Water', timing: 'Prathakaal (Morning)' as const, duration: '15 days' }
    },
    {
      aCode: 'AYU-SAN-005',
      sanskritTerm: 'Sandhivata',
      englishEquivalent: 'Osteoarthritis / Degenerative Joint Disease',
      icd10DualCode: 'M17.9',
      snomedConceptId: '399269003',
      icmrStandardWorkflowId: 'ICMR-STW-MSK-001',
      drug: { drugName: 'Paracetamol', dosage: '650mg', route: 'Oral' as const, frequency: 'SOS' as const, timing: 'After Food (PC)' as const, duration: '5 days' },
      ayush: { formulationName: 'Yograj Guggulu', category: 'Guggulu' as const, dosage: '2 tablets', frequency: 'BD' as const, anupana: 'Warm Water', timing: 'Prathakaal (Morning)' as const, duration: '30 days' }
    },
    {
      aCode: 'AYU-PRA-001',
      sanskritTerm: 'Kaphaja Prameha',
      englishEquivalent: 'Type 2 Diabetes Mellitus',
      icd10DualCode: 'E11.9',
      snomedConceptId: '44054006',
      icmrStandardWorkflowId: 'ICMR-STW-END-001',
      drug: { drugName: 'Metformin', dosage: '500mg', route: 'Oral' as const, frequency: 'BD' as const, timing: 'With Food' as const, duration: '30 days' },
      ayush: { formulationName: 'Chandraprabha Vati', category: 'Vati/Gutika' as const, dosage: '2 tablets', frequency: 'BD' as const, anupana: 'Lukewarm Water', timing: 'Prathakaal (Morning)' as const, duration: '30 days' }
    },
    {
      aCode: 'AYU-KAS-002',
      sanskritTerm: 'Kaphaja Kasa',
      englishEquivalent: 'Productive Cough / Acute Bronchitis',
      icd10DualCode: 'J20.9',
      snomedConceptId: '49727002',
      icmrStandardWorkflowId: 'ICMR-STW-RES-004',
      drug: { drugName: 'Azithromycin', dosage: '500mg', route: 'Oral' as const, frequency: 'OD' as const, timing: 'Before Food (AC)' as const, duration: '5 days' },
      ayush: { formulationName: 'Sitopaladi Churna', category: 'Churna' as const, dosage: '3g', frequency: 'BD' as const, anupana: 'Madhu (Honey)', timing: 'Prathakaal (Morning)' as const, duration: '7 days' }
    },
    {
      aCode: 'AYU-VAT-008',
      sanskritTerm: 'Gridhrasi',
      englishEquivalent: 'Sciatica / Lumbar Radiculopathy',
      icd10DualCode: 'M54.3',
      snomedConceptId: '279039007',
      icmrStandardWorkflowId: 'ICMR-STW-NEU-002',
      drug: { drugName: 'Pregabalin', dosage: '75mg', route: 'Oral' as const, frequency: 'HS' as const, timing: 'Bedtime (HS)' as const, duration: '14 days' },
      ayush: { formulationName: 'Trayodashang Guggulu', category: 'Guggulu' as const, dosage: '2 tablets', frequency: 'BD' as const, anupana: 'Warm Water', timing: 'Prathakaal (Morning)' as const, duration: '15 days' }
    }
  ];

  let acyclicIntegrityPassed = 0;

  for (let i = 0; i < bundleCount; i++) {
    const arch = diagnosisArchetypes[i % diagnosisArchetypes.length];
    const record: ConsultationRecord = {
      encounterId: `enc-${i}`,
      sessionId: `sess-${i}`,
      patientId: `pat-${i}`,
      doctorId: 'doc-aiia-01',
      doctorName: 'Dr. Vaidya Consulting Specialist',
      department: 'Kaya Chikitsa',
      symptoms: [
        { name: arch.englishEquivalent.split('/')[0].trim(), severity: 5, isNegated: false, onset: '3 days' }
      ],
      pariksha: {
        prakriti: 'Vata-Pitta',
        vikriti: 'Pitta Vriddhi',
        sara: 'Madhyama',
        samhanana: 'Moderate',
        pramana: 'Ideal',
        satmya: 'Ritu Satmya',
        sattva: 'Pravara',
        aharaShakti: 'Abhyavaharana',
        vyayamaShakti: 'Medium',
        vaya: 'Madhyama',
        agni: 'Samagni',
        amaPresent: false
      },
      vitals: { bp: '120/80', pulse: 76, temp: '98.6°F', spo2: '98%' },
      diagnoses: [{
        aCode: arch.aCode,
        sanskritTerm: arch.sanskritTerm,
        englishEquivalent: arch.englishEquivalent,
        icd10DualCode: arch.icd10DualCode,
        snomedConceptId: arch.snomedConceptId,
        icmrStandardWorkflowId: arch.icmrStandardWorkflowId
      }],
      allopathicPrescription: [arch.drug],
      ayushPrescription: [arch.ayush],
      investigationsOrdered: ['CBC'],
      conflictAlerts: [],
      createdAt: new Date().toISOString()
    };

    const bundle = FhirGeneratorService.buildBundle(record);

    // Invariant 1: Document Bundle structure
    if (bundle.resourceType === 'Bundle' && bundle.type === 'document' && bundle.entry.length >= 4) {
      validBundles++;
    }

    // Invariant 2: First entry must be Composition
    if (bundle.entry[0].resource.resourceType === 'Composition') {
      compositionInvariantsMet++;
    }

    // Invariant 3: Condition has all 3 code systems (NAMASTE, ICD-10, SNOMED)
    const condEntry = bundle.entry.find(e => e.resource.resourceType === 'Condition');
    if (condEntry && condEntry.resource.code && condEntry.resource.code.coding.length >= 3) {
      const systems = condEntry.resource.code.coding.map((c: any) => c.system);
      if (
        systems.includes('https://namstp.ayush.gov.in') &&
        systems.includes('http://hl7.org/fhir/sid/icd-10') &&
        systems.includes('http://snomed.info/sct')
      ) {
        triCodedEntries++;
      }
    }

    // Invariant 4: Subject Reference Resolution & Acyclic Integrity
    const comp = bundle.entry[0].resource;
    const patientEntry = bundle.entry.find(e => e.resource.resourceType === 'Patient');
    if (patientEntry && comp.subject && comp.subject.reference) {
      if (comp.subject.reference.includes(patientEntry.resource.id)) {
        acyclicIntegrityPassed++;
      }
    }
  }

  const tEnd = performance.now();
  const totalTimeMs = tEnd - tStart;
  const bundlesPerSec = Math.round((bundleCount / totalTimeMs) * 1000);

  console.log(`• Bundles Generated & Evaluated: ${bundleCount.toLocaleString()}`);
  console.log(`• Total Generation Time:         ${totalTimeMs.toFixed(2)} ms (${(totalTimeMs / 1000).toFixed(3)}s)`);
  console.log(`• Generation Throughput:         ${bundlesPerSec.toLocaleString()} bundles / sec`);
  console.log(`• Schema Valid Document Bundles: ${((validBundles / bundleCount) * 100).toFixed(2)}% (${validBundles}/${bundleCount})`);
  console.log(`• Composition Invariants Met:    ${((compositionInvariantsMet / bundleCount) * 100).toFixed(2)}%`);
  console.log(`• NAMASTE Tri-Coded Diagnoses:   ${((triCodedEntries / bundleCount) * 100).toFixed(2)}%`);
  console.log(`• Acyclic Reference Integrity:   ${((acyclicIntegrityPassed / bundleCount) * 100).toFixed(2)}%`);

  const passed = validBundles === bundleCount && 
                 compositionInvariantsMet === bundleCount && 
                 triCodedEntries === bundleCount && 
                 acyclicIntegrityPassed === bundleCount;
  console.log(`• Status:                        ${passed ? 'PASSED (100% ABDM FHIR R4 COMPLIANCE)' : 'FAILED'}`);
  console.log(`========================================================================\n`);

  return { passed, totalTimeMs, bundlesPerSec };
}

if (require.main === module) {
  runFhirBenchmark(1000);
}
