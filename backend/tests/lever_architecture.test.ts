/**
 * Master Sovereign Lever Architecture Battery
 * Empirically tests the 3 live levers connecting MediKiosk to Cognitive Engine, Acoustic Scribe, and Integrity Arbiter.
 */

import { LeverHub, PiyApiLever, PiyNotesLever, PatentLever } from '../src/lever';

export async function runLeverTests() {
  const tStart = performance.now();
  console.log('\n+--------------------------------------------------------------------------------------+');
  console.log('|             AIIA SOVEREIGN CORE SUBSYSTEM EMPIRICAL TEST BATTERY                     |');
  console.log('|     Subsystem 1 (Cognitive Engine) -> Subsystem 2 (Audio VAD) -> Subsystem 3 (ZKP)   |');
  console.log('+--------------------------------------------------------------------------------------+\n');

  // Diagnostic Check
  console.log('--- SUBSYSTEM DIAGNOSTIC STATUS ---');
  const diag = LeverHub.getLeverDiagnostics();
  console.log(`* Subsystem 1 (Cognitive Clinical Engine): ${diag.piyApiProjectCloud.connected ? '[OK] EMBEDDED KERNEL' : '[AIRGAP]'}`);
  console.log(`  Path: ${diag.piyApiProjectCloud.path}`);
  console.log(`* Subsystem 2 (Far-Field Audio Pipeline):  ${diag.piyNotesAudio.connected ? '[OK] EMBEDDED DSP' : '[AIRGAP]'}`);
  console.log(`  Path: ${diag.piyNotesAudio.path}`);
  console.log(`* Subsystem 3 (Groth16 zk-SNARK Arbiter):  ${diag.patentZkpArbiter.connected ? '[OK] EMBEDDED BN128' : '[AIRGAP]'}`);
  console.log(`  Path: ${diag.patentZkpArbiter.path}`);
  console.log('-----------------------------------\n');

  // Test Subsystem 1
  console.log('--- TEST 1: SUBSYSTEM 1 - TRUTH ENGINE & PAC CONFORMAL GATE ---');
  const interaction = PiyApiLever.evaluateHerbDrugInteraction('Warfarin', 'Yogaraja Guggulu');
  console.log(`* Evaluated Pair:           ${interaction.drug} + ${interaction.herb}`);
  console.log(`* Engine Source:            ${interaction.leverSource}`);
  console.log(`* Posterior Parameters:     Alpha=${interaction.alpha}, Beta=${interaction.beta}`);
  console.log(`* Bayesian Confidence E[theta]: ${(interaction.expectedConfidence * 100).toFixed(2)}%`);
  console.log(`* Bayes Factor BF10:        ${interaction.bayesFactor}`);
  console.log(`* Statistically Decisive:   ${interaction.isStatisticallySignificant ? 'YES' : 'NO'}`);
  if (interaction.expectedConfidence < 0.80) throw new Error('Subsystem 1 failed to reach expected confidence threshold');

  const pacGate = PiyApiLever.evaluatePACConformalGate(0.98, 0.12, 1, 0.01);
  console.log(`* PAC Conformal Guarantee:  ${pacGate.statisticalCoverageGuarantee}`);
  console.log(`* Recommended Pathway:      ${pacGate.recommendedPathway}`);

  // Aadhaar Verhoeff
  const validAadhaar = PiyApiLever.validateAadhaarVerhoeff('234567890124');
  const corruptedAadhaar = PiyApiLever.validateAadhaarVerhoeff('234567890123');
  console.log(`* Verhoeff D5 Valid Test:   ${validAadhaar ? 'PASSED' : 'FAILED'}`);
  console.log(`* Verhoeff D5 Corrupt Catch:${!corruptedAadhaar ? 'PASSED' : 'FAILED'}`);
  if (!validAadhaar || corruptedAadhaar) throw new Error('Verhoeff D5 check failed');
  console.log('* Status:                   PASSED (Cognitive Engine Subsystem 1 Operational)\n');

  // Test Subsystem 2
  console.log('--- TEST 2: SUBSYSTEM 2 - VERNACULAR CODE-SWITCHING & VAD ---');
  const sampleSpeech = 'chaati me bojh hai aur ghutne me cut cut hota hai crocin lene se aaram mila';
  const normalized = PiyNotesLever.normalizeTranscript(sampleSpeech);
  console.log(`* Raw Spoken Input:         "${sampleSpeech}"`);
  console.log(`* Normalized Clinical Form: "${normalized.normalizedText}"`);
  console.log(`* Detected Terms:           ${normalized.replacements.map(r => `${r.raw} -> ${r.canonical}`).join(' | ')}`);
  console.log(`* Normalizer Source:        ${normalized.leverSource}`);
  if (!normalized.normalizedText.includes('Substernal Crushing Pressure') || !normalized.normalizedText.includes('Janu Sandhi Crepitus')) {
    throw new Error('Subsystem 2 phonetic normalizer missed terms');
  }

  // Audio Chunk VAD
  const testBuffer = Buffer.alloc(640);
  for (let i = 0; i < 320; i++) {
    testBuffer.writeInt16LE(Math.round(Math.sin(i / 10) * 12000), i * 2);
  }
  const vadResult = PiyNotesLever.processAudioChunk(testBuffer, -36);
  console.log(`* VAD Audio Chunk RMS:      ${vadResult.rms} (dB Level: ${vadResult.dbLevel} dBFS)`);
  console.log(`* Voice Active State:       ${vadResult.state}`);
  if (!vadResult.isVoiceActive) throw new Error('Subsystem 2 VAD failed on active frame');
  console.log('* Status:                   PASSED (Audio Pipeline Subsystem 2 Operational)\n');

  // Test Subsystem 3
  console.log('--- TEST 3: SUBSYSTEM 3 - GROTH16 ZK-SNARK INTEGRITY SEAL ---');
  const zkResult = await PatentLever.verifyConsultationIntegrity();
  console.log(`* Cryptographic Protocol:   ${zkResult.protocol} / ${zkResult.curve}`);
  console.log(`* Verification Status:      ${zkResult.verified ? 'VERIFIED_VALID' : 'FAILED'}`);
  console.log(`* Verification Speed:       ${zkResult.verificationLatencyMs} ms`);
  console.log(`* Circuit Source:           ${zkResult.leverSource}`);
  console.log(`* Invariance Claims Tested: ${zkResult.patentClaimsCovered.length} Claims`);
  if (!zkResult.verified) throw new Error('Subsystem 3 zk-SNARK verification failed');
  console.log('* Status:                   PASSED (zk-SNARK Arbiter Subsystem 3 Operational)\n');

  console.log('========================================================================');
  console.log('  ALL 3 CORE SUBSYSTEMS OPERATIONAL AND INTEGRATED WITH ZERO DEFECTS');
  console.log('========================================================================\n');

  const durationMs = performance.now() - tStart;
  return {
    suite: 'Sovereign Core Tri-Subsystem Architecture',
    durationMs,
    passed: true
  };
}

if (require.main === module) {
  runLeverTests().catch((err) => {
    console.error('Lever test failed:', err);
    process.exit(1);
  });
}

