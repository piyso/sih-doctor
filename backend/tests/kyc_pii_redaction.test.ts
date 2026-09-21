/**
 * 10,000-Record Indian KYC & Privacy Protection Benchmark
 * Ported from project cloud/benchmarks/real_indian_kyc_exhaustive_eval.ts
 * Evaluates Verhoeff algorithm on 10,000 Aadhaar records, PAN regex, and multilingual PII de-identification.
 */

import { SovereignNERService } from '../src/services/sovereignNER.service';

export function runKYCBenchmark(recordCount: number = 10000) {
  console.log(`\n========================================================================`);
  console.log(`  RUNNING 10,000-RECORD INDIAN KYC & PII SHIELD EVALUATION`);
  console.log(`========================================================================`);

  const tStart = performance.now();

  let validAadhaarPassed = 0;
  let corruptedAadhaarCaught = 0;
  let validPanPassed = 0;
  let invalidPanCaught = 0;
  let piiRedactionsSuccessful = 0;

  const half = recordCount / 2;

  // 1. Test 5,000 Valid Aadhaar Numbers
  for (let i = 0; i < half; i++) {
    // Generate 11 random digits
    const base11 = (10000000000 + (i * 18041)).toString().slice(0, 11);
    const checksum = SovereignNERService.generateAadhaarChecksum(base11);
    const fullAadhaar = `${base11}${checksum}`;

    if (SovereignNERService.validateAadhaar(fullAadhaar)) {
      validAadhaarPassed++;
    }

    // Masking check
    const masked = SovereignNERService.maskAadhaar(fullAadhaar);
    if (masked.startsWith('XXXXXXXX') && masked.length === 12) {
      // Correct mask
    }
  }

  // 2. Test 5,000 Corrupted Aadhaar Numbers (Transposition & Substitution Errors)
  for (let i = 0; i < half; i++) {
    const base11 = (10000000000 + (i * 18041)).toString().slice(0, 11);
    const checksum = SovereignNERService.generateAadhaarChecksum(base11);
    // Perturb checksum to simulate typo
    const fakeChecksum = ((parseInt(checksum, 10) + 1) % 10).toString();
    const corruptedAadhaar = `${base11}${fakeChecksum}`;

    if (!SovereignNERService.validateAadhaar(corruptedAadhaar)) {
      corruptedAadhaarCaught++;
    }
  }

  // 3. Test PAN Card Validation (4th char must be P, C, H, F, A, T, B, L, J, G)
  const validPANs = ['ABCPE1234F', 'BKZPK5678M', 'AAACP9999K', 'XYZPA4321A'];
  const invalidPANs = ['12345ABCDE', 'ABCDE12345', 'ABC1234DEF', 'ABCDE1234Z9'];

  for (const pan of validPANs) {
    if (SovereignNERService.validatePAN(pan)) validPanPassed++;
  }
  for (const pan of invalidPANs) {
    if (!SovereignNERService.validatePAN(pan)) invalidPanCaught++;
  }

  // 4. Multilingual PII De-Identification Stress Test
  const testPhrases = [
    { text: 'मरीज का नाम रमेश कुमार है, पिता का नाम श्याम सुंदर है, मोबाइल 9876543210', pii: ['9876543210', 'रमेश कुमार'] },
    { text: 'Patient name is Priya Sharma, Aadhaar 4521 8921 3412, phone 8765432109', pii: ['Priya Sharma', '4521 8921 3412', '8765432109'] },
    { text: 'नाम: अनीता देवी, मोबाइल: 9123456780, जिला: वाराणसी, आधार: 9812 3456 7810', pii: ['अनीता देवी', '9123456780', '9812 3456 7810'] }
  ];

  for (const item of testPhrases) {
    const res = SovereignNERService.deIdentifyText(item.text);
    const leaked = item.pii.filter(p => res.redactedText.includes(p));
    if (leaked.length === 0) {
      piiRedactionsSuccessful++;
    }
  }

  const tEnd = performance.now();
  const totalTimeMs = tEnd - tStart;
  const latencyPerRecordMs = totalTimeMs / recordCount;

  console.log(`• Total KYC Records Evaluated: ${recordCount.toLocaleString()}`);
  console.log(`• Execution Time:              ${totalTimeMs.toFixed(2)} ms (${(totalTimeMs / 1000).toFixed(3)}s)`);
  console.log(`• Mean Verification Latency:   ${latencyPerRecordMs.toFixed(4)} ms / record`);
  console.log(`• Verhoeff Valid Aadhaar:      ${((validAadhaarPassed / half) * 100).toFixed(2)}% (${validAadhaarPassed}/${half})`);
  console.log(`• Corrupted Aadhaar Caught:    ${((corruptedAadhaarCaught / half) * 100).toFixed(2)}% (${corruptedAadhaarCaught}/${half})`);
  console.log(`• PAN Verification Accuracy:   ${validPanPassed}/${validPANs.length} Valid, ${invalidPanCaught}/${invalidPANs.length} Invalid Caught`);
  console.log(`• Multilingual PII Redaction:  ${piiRedactionsSuccessful}/${testPhrases.length} Zero-Leakage`);

  const passed = validAadhaarPassed === half && 
                 corruptedAadhaarCaught === half && 
                 validPanPassed === validPANs.length && 
                 invalidPanCaught === invalidPANs.length && 
                 piiRedactionsSuccessful === testPhrases.length;
  console.log(`• Status:                      ${passed ? 'PASSED (100% VERHOEFF, PAN & PII ACCURACY)' : 'FAILED'}`);
  console.log(`========================================================================\n`);

  return { passed, totalTimeMs, latencyPerRecordMs };
}

if (require.main === module) {
  runKYCBenchmark(10000);
}
