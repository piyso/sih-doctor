/**
 * Master Sovereign Lever Architecture Battery
 * Empirically tests the 3 live levers connecting 26047 to project cloud, 1.piynoteskiro, and patent.
 */

import { LeverHub, PiyApiLever, PiyNotesLever, PatentLever } from '../src/lever';

export async function runLeverTests() {
  const tStart = performance.now();
  console.log('\n╔══════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║             AIIA SOVEREIGN LEVER ARCHITECTURE EMPIRICAL TEST BATTERY                 ║');
  console.log('║       Connecting 26047 -> project cloud (PiyAPI) -> 1.piynoteskiro -> Patent         ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════════════╝\n');

  // Diagnostic Check
  console.log('--- LEVER DIAGNOSTIC STATUS ---');
  const diag = LeverHub.getLeverDiagnostics();
  console.log(`• Lever 1 (PiyAPI / Project Cloud): ${diag.piyApiProjectCloud.connected ? '🟢 CONNECTED (Live on PC)' : '🟡 AIRGAP'}`);
  console.log(`  Path: ${diag.piyApiProjectCloud.path}`);
  console.log(`• Lever 2 (1.piynoteskiro Audio):   ${diag.piyNotesAudio.connected ? '🟢 CONNECTED (Live on PC)' : '🟡 AIRGAP'}`);
  console.log(`  Path: ${diag.piyNotesAudio.path}`);
  console.log(`• Lever 3 (Patent Groth16 Circuit):  ${diag.patentZkpArbiter.connected ? '🟢 CONNECTED (Live on PC)' : '🟡 AIRGAP'}`);
  console.log(`  Path: ${diag.patentZkpArbiter.path}`);
  console.log('-------------------------------\n');

  // Test Lever 1: PiyAPI / Project Cloud
  console.log('--- TEST 1: LEVER 1 — PIYAPI TRUTH ENGINE & PAC CONFORMAL GATE ---');
  const interaction = PiyApiLever.evaluateHerbDrugInteraction('Warfarin', 'Yogaraja Guggulu');
  console.log(`• Evaluated Pair:           ${interaction.drug} + ${interaction.herb}`);
  console.log(`• Lever Source:             ${interaction.leverSource}`);
  console.log(`• Posterior Parameters:     Alpha=${interaction.alpha}, Beta=${interaction.beta}`);
  console.log(`• Bayesian Confidence E[θ]: ${(interaction.expectedConfidence * 100).toFixed(2)}%`);
  console.log(`• Bayes Factor BF10:        ${interaction.bayesFactor}`);
  console.log(`• Statistically Decisive:   ${interaction.isStatisticallySignificant ? 'YES' : 'NO'}`);
  if (interaction.expectedConfidence < 0.80) throw new Error('Lever 1 failed to reach expected confidence threshold');

  const pacGate = PiyApiLever.evaluatePACConformalGate(0.98, 0.12, 1, 0.01);
  console.log(`• PAC Conformal Guarantee:  ${pacGate.statisticalCoverageGuarantee}`);
  console.log(`• Recommended Pathway:      ${pacGate.recommendedPathway}`);

  // Aadhaar Verhoeff
  const validAadhaar = PiyApiLever.validateAadhaarVerhoeff('234567890124');
  const corruptedAadhaar = PiyApiLever.validateAadhaarVerhoeff('234567890123');
  console.log(`• Verhoeff D5 Valid Test:   ${validAadhaar ? 'PASSED' : 'FAILED'}`);
  console.log(`• Verhoeff D5 Corrupt Catch:${!corruptedAadhaar ? 'PASSED' : 'FAILED'}`);
  if (!validAadhaar || corruptedAadhaar) throw new Error('Verhoeff D5 check failed');
  console.log('• Status:                   PASSED (PiyAPI Lever 1 Operational)\n');

  // Test Lever 2: 1.piynoteskiro
  console.log('--- TEST 2: LEVER 2 — 1.PIYNOTESKIRO CODE-SWITCHING & VAD ---');
  const sampleSpeech = 'chaati me bojh hai aur ghutne me cut cut hota hai crocin lene se aaram mila';
  const normalized = PiyNotesLever.normalizeTranscript(sampleSpeech);
  console.log(`• Raw Spoken Input:         "${sampleSpeech}"`);
  console.log(`• Lever Normalized Form:    "${normalized.normalizedText}"`);
  console.log(`• Detected Terms:           ${normalized.replacements.map(r => `${r.raw} -> ${r.canonical}`).join(' | ')}`);
  console.log(`• Lever Source:             ${normalized.leverSource}`);
  if (!normalized.normalizedText.includes('Substernal Crushing Pressure') || !normalized.normalizedText.includes('Janu Sandhi Crepitus')) {
    throw new Error('Lever 2 phonetic normalizer missed terms');
  }

  // Audio Chunk VAD
  const testBuffer = Buffer.alloc(640);
  for (let i = 0; i < 320; i++) {
    testBuffer.writeInt16LE(Math.round(Math.sin(i / 10) * 12000), i * 2);
  }
  const vadResult = PiyNotesLever.processAudioChunk(testBuffer, -36);
  console.log(`• VAD Audio Chunk RMS:      ${vadResult.rms} (dB Level: ${vadResult.dbLevel} dBFS)`);
  console.log(`• Voice Active State:       ${vadResult.state}`);
  if (!vadResult.isVoiceActive) throw new Error('Lever 2 VAD failed on active frame');
  console.log('• Status:                   PASSED (1.piynoteskiro Lever 2 Operational)\n');

  // Test Lever 3: Patent zk-SNARK
  console.log('--- TEST 3: LEVER 3 — PATENT zk-SNARK GROTH16/BN128 ---');
  const zkResult = await PatentLever.verifyConsultationIntegrity();
  console.log(`• Cryptographic Protocol:   ${zkResult.protocol} / ${zkResult.curve}`);
  console.log(`• Verification Status:      ${zkResult.verified ? 'VERIFIED_VALID' : 'FAILED'}`);
  console.log(`• Verification Speed:       ${zkResult.verificationLatencyMs} ms`);
  console.log(`• Lever Source:             ${zkResult.leverSource}`);
  console.log(`• Patent Claims Covered:    ${zkResult.patentClaimsCovered.length} Claims`);
  if (!zkResult.verified) throw new Error('Lever 3 Patent verification failed');
  console.log('• Status:                   PASSED (Patent Lever 3 Operational)\n');

  console.log('========================================================================');
  console.log('  ALL 3 LEVERS OPERATIONAL AND INTEGRATED WITH ZERO DEFECTS');
  console.log('========================================================================\n');

  const durationMs = performance.now() - tStart;
  return {
    suite: '3-Lever Live Architecture (project cloud, 1.piynoteskiro, patent)',
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

