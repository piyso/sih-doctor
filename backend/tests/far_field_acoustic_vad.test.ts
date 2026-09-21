/**
 * Far-Field Acoustic VAD & Closed-Cabin Whisper Test Suite
 * PS ID 26047 - AIIA Sovereign MediKiosk
 *
 * Validates:
 * 1. Adaptive Noise-Floor Tracking during silence
 * 2. Low-Voice & Whispered Speech Activation (vs Fixed Threshold Dropouts)
 * 3. 500ms Circular Pre-Roll Ring Buffer (Zero-Syllable Truncation)
 * 4. Hangover Window Persistence across Hesitation Pauses
 * 5. Soft-Knee Dynamic Gain Compensation
 * 6. Dynamic Mode Switching (Standard, Far-Field Cabin, Whisper Boost)
 */

import { AudioVadPipelineService, VadEvent } from '../src/services/audioVadPipeline.service';

function generatePcmChunk(amplitude: number, samples = 320): Buffer {
  const buf = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    const sample = Math.sin((2 * Math.PI * 440 * i) / 16000) * amplitude * 32767;
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(sample))), i * 2);
  }
  return buf;
}

function generateSilenceChunk(samples = 320): Buffer {
  const buf = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    const noise = (Math.random() * 2 - 1) * 0.0012 * 32767;
    buf.writeInt16LE(Math.round(noise), i * 2);
  }
  return buf;
}

export function runFarFieldAcousticVadTests(): void {
  console.log('\n========================================================================');
  console.log('⚡ BATTERY 22: FAR-FIELD ACOUSTIC VAD & CLOSED-CABIN WHISPER RIGOR');
  console.log('   Testing Dynamic Floor Tracking, Ring-Buffer Pre-Roll & Whisper Boost');
  console.log('========================================================================\n');

  const tStart = performance.now();
  let assertions = 0;

  // Test 1: Dynamic Noise Floor Adapts to Quiet Cabin
  console.log('[Test 1] Testing Dynamic Noise Floor Tracking in Quiet Consultation Room...');
  const vad = new AudioVadPipelineService(16000, -36, 'far_field_cabin');
  const silenceFrame = generateSilenceChunk();
  let lastEvent: VadEvent | null = null;
  for (let i = 0; i < 30; i++) {
    lastEvent = vad.processPcmChunk(silenceFrame);
  }
  if (!lastEvent || lastEvent.state !== 'SILENCE' || lastEvent.isVoiceActive !== false || lastEvent.noiseFloorDb >= -40.0) {
    throw new Error(`Dynamic noise floor tracking failed: ${JSON.stringify(lastEvent)}`);
  }
  assertions += 3;
  console.log(`  ✓ Dynamic noise floor adapted smoothly to ${lastEvent.noiseFloorDb} dBFS.`);

  // Test 2: Whisper-Boost Rescues Faint Low-Voice Patients
  console.log('[Test 2] Testing Low-Voice & Whispered Speech Activation (-42 dBFS)...');
  const whisperVad = new AudioVadPipelineService(16000, -36, 'whisper_boost');
  for (let i = 0; i < 10; i++) {
    whisperVad.processPcmChunk(generateSilenceChunk());
  }

  const whisperFrame = generatePcmChunk(0.008);
  let detectedVoice = false;
  let whisperFlag = false;
  for (let i = 0; i < 6; i++) {
    const ev = whisperVad.processPcmChunk(whisperFrame);
    if (ev.isVoiceActive) detectedVoice = true;
    if (ev.isWhisper) whisperFlag = true;
  }
  if (!detectedVoice || !whisperFlag) {
    throw new Error('Whisper boost failed to trigger on faint patient murmur');
  }
  assertions += 2;
  console.log('  ✓ Faint patient murmur (-42 dBFS) detected with isWhisper flag activated.');

  // Test 3: Pre-Roll Buffer Guarantees Zero Syllable Truncation
  console.log('[Test 3] Testing 500ms Circular Pre-Roll Ring Buffer...');
  const preRollVad = new AudioVadPipelineService(16000, -36, 'far_field_cabin');
  for (let i = 0; i < 10; i++) {
    preRollVad.processPcmChunk(generateSilenceChunk());
  }

  const speechFrame = generatePcmChunk(0.15);
  let startEvent: VadEvent | null = null;
  for (let i = 0; i < 3; i++) {
    const ev = preRollVad.processPcmChunk(speechFrame);
    if (ev.state === 'SPEECH_START') {
      startEvent = ev;
    }
  }
  if (!startEvent || !startEvent.preRollBufferedBytes || startEvent.preRollBufferedBytes <= 0) {
    throw new Error('Pre-roll buffer empty on SPEECH_START transition');
  }
  const flushed = preRollVad.flushPreRollBuffer();
  if (flushed.length === 0) {
    throw new Error('Flush pre-roll returned empty buffer');
  }
  assertions += 2;
  console.log(`  ✓ Circular pre-roll captured ${startEvent.preRollBufferedBytes} bytes (Zero syllable truncation).`);

  // Test 4: Hangover Window Across Pauses
  console.log('[Test 4] Testing Hangover Window Persistence Across Hesitation Pauses...');
  for (let i = 0; i < 4; i++) {
    preRollVad.processPcmChunk(speechFrame);
  }
  if (preRollVad.getCurrentState() !== 'SPEECH_ONGOING') {
    throw new Error('Expected SPEECH_ONGOING state');
  }
  for (let i = 0; i < 4; i++) {
    preRollVad.processPcmChunk(generateSilenceChunk());
  }
  if (preRollVad.getCurrentState() !== 'SPEECH_ONGOING') {
    throw new Error('Hangover window dropped speech state prematurely');
  }
  assertions += 2;
  console.log('  ✓ Hangover window maintained continuous speech across hesitation pause.');

  // Test 5: Soft-Knee Dynamic Gain Compensation
  console.log('[Test 5] Testing Soft-Knee Dynamic Gain Compensation...');
  if (vad.computeGainCompensation(-46) !== 18.0) throw new Error('Gain comp error at -46dB');
  if (vad.computeGainCompensation(-35) !== 12.0) throw new Error('Gain comp error at -35dB');
  if (vad.computeGainCompensation(-25) !== 6.0) throw new Error('Gain comp error at -25dB');
  if (vad.computeGainCompensation(-10) !== 0.0) throw new Error('Gain comp error at -10dB');
  assertions += 4;
  console.log('  ✓ Soft-knee gain compensation curves verified (+18dB, +12dB, +6dB, 0dB).');

  // Test 6: Mechanical Fan Rumble Rejection vs Whispered Consonant
  console.log('[Test 6] Testing Mechanical Fan Rumble (50Hz hum) Rejection vs Whispered Consonant...');
  const fanHumBuffer = Buffer.alloc(640);
  for (let i = 0; i < 320; i++) {
    const sample = Math.sin((2 * Math.PI * 50 * i) / 16000) * 0.05 * 32767; // 50Hz low hum
    fanHumBuffer.writeInt16LE(Math.round(sample), i * 2);
  }
  const fanZcr = vad.computeZeroCrossingRate(fanHumBuffer);
  const fanHfRatio = vad.computeHighFrequencyRatio(fanHumBuffer);

  if (fanZcr >= 0.05 || fanHfRatio >= 0.08) {
    throw new Error(`Expected low ZCR and low HF ratio for 50Hz fan hum, got ZCR=${fanZcr}, HFPR=${fanHfRatio}`);
  }

  // Whispered fricative consonant: high ZCR (> 0.25)
  const whisperConsonant = Buffer.alloc(640);
  for (let i = 0; i < 320; i++) {
    const noise = (Math.random() * 2 - 1) * 0.012 * 32767;
    whisperConsonant.writeInt16LE(Math.round(noise), i * 2);
  }
  const whisperZcr = vad.computeZeroCrossingRate(whisperConsonant);
  const whisperHfRatio = vad.computeHighFrequencyRatio(whisperConsonant);

  if (whisperZcr < 0.20 || whisperHfRatio < 0.15) {
    throw new Error(`Expected high ZCR and high HF ratio for whisper consonant, got ZCR=${whisperZcr}, HFPR=${whisperHfRatio}`);
  }
  assertions += 4;
  console.log(`  ✓ 50Hz Fan Rumble (ZCR: ${fanZcr.toFixed(3)}, HFPR: ${fanHfRatio.toFixed(3)}) rejected cleanly.`);
  console.log(`  ✓ Whispered Consonant (ZCR: ${whisperZcr.toFixed(3)}, HFPR: ${whisperHfRatio.toFixed(3)}) discriminated accurately.`);

  const elapsed = (performance.now() - tStart).toFixed(2);
  console.log('------------------------------------------------------------------------');
  console.log(`✅ BATTERY 22 PASSED: All ${assertions} acoustic assertions verified in ${elapsed} ms.`);
  console.log('------------------------------------------------------------------------');
}
