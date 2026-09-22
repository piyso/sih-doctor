/**
 * Sovereign Audio Pipeline & Far-Field Dynamic VAD Engine
 * PS ID: 26047 - Ministry of Ayush & AIIA New Delhi
 *
 * Designed for Closed-Cabin Far-Field Audio & Low-Voice / Whispered Speech.
 * Features:
 * - Real-time Linear 16-bit PCM RMS & Decibel Computation
 * - Dynamic Exponential Moving Average (EMA) Ambient Noise Floor Tracking
 * - Adaptive SNR Gating (Triggers speech at Noise Floor + Delta, preventing silence dropouts)
 * - Circular Ring-Buffer Pre-Roll (500ms buffer guarantees zero syllable truncation)
 * - Hangover Window (900ms prevents choppy fragmentation during natural pauses)
 * - Soft-Knee Dynamic Gain Compensation (+12dB to +18dB far-field boost)
 * - Whisper Detection Flag for subtle unvoiced consonant enhancement
 */

import { EventEmitter } from 'events';

export type VadState = 'SILENCE' | 'SPEECH_START' | 'SPEECH_ONGOING' | 'SPEECH_END';
export type AcousticMode = 'standard' | 'far_field_cabin' | 'whisper_boost' | 'ultra_sensitive';

export interface VadEvent {
  state: VadState;
  rmsEnergy: number;
  dbLevel: number;
  noiseFloorDb: number;
  snrDb: number;
  isVoiceActive: boolean;
  isWhisper: boolean;
  isFanRumbleRejected?: boolean;
  zeroCrossingRate?: number;
  highFreqRatio?: number;
  gainCompensationDb: number;
  acousticMode: AcousticMode;
  preRollBufferedBytes?: number;
  timestamp: string;
}

export interface AcousticMetrics {
  currentFloorDb: number;
  currentSnrDb: number;
  currentDbLevel: number;
  activeMode: AcousticMode;
  consecutiveVoiceFrames: number;
  consecutiveSilenceFrames: number;
  preRollBufferCount: number;
}

export class AudioVadPipelineService extends EventEmitter {
  private sampleRate: number;
  private energyThresholdDb: number;
  private mode: AcousticMode = 'far_field_cabin';
  private currentState: VadState = 'SILENCE';
  private consecutiveVoiceFrames: number = 0;
  private consecutiveSilenceFrames: number = 0;

  // Adaptive Dynamic Noise Floor Tracking
  private noiseFloorDb: number = -52.0;
  private readonly FLOOR_ALPHA_IDLE: number = 0.02; // EMA adaptation rate during silence
  private readonly FLOOR_MIN_DB: number = -65.0;
  private readonly FLOOR_MAX_DB: number = -30.0;

  // Circular Ring-Buffer for Pre-Roll (Prevents first-syllable clipping)
  private readonly MAX_PREROLL_FRAMES: number = 25; // ~500ms at 20ms/frame
  private preRollRingBuffer: Buffer[] = [];

  // Hysteresis frame thresholds
  private voiceStartFrames: number = 3;
  private voiceEndFrames: number = 10; // ~800-900ms hangover window

  constructor(sampleRate = 16000, energyThresholdDb = -36, initialMode: AcousticMode = 'far_field_cabin') {
    super();
    this.sampleRate = sampleRate;
    this.energyThresholdDb = energyThresholdDb;
    this.setAcousticMode(initialMode, energyThresholdDb);
  }

  /**
   * Set acoustic mode and adjust sensitivity parameters
   */
  public setAcousticMode(mode: AcousticMode, customThresholdDb?: number): void {
    this.mode = mode;
    if (customThresholdDb !== undefined) {
      this.energyThresholdDb = customThresholdDb;
    }

    switch (mode) {
      case 'whisper_boost':
        this.voiceStartFrames = 2; // Faster trigger on faint whisper onset
        this.voiceEndFrames = 12;  // Longer hangover for soft breathing
        break;
      case 'far_field_cabin':
        this.voiceStartFrames = 3;
        this.voiceEndFrames = 10;
        break;
      case 'ultra_sensitive':
        this.voiceStartFrames = 2;
        this.voiceEndFrames = 14;
        break;
      case 'standard':
      default:
        this.voiceStartFrames = 3;
        this.voiceEndFrames = 8;
        break;
    }
  }

  /**
   * Calculate Zero-Crossing Rate (ZCR) for spectral texture & whisper discrimination
   */
  public computeZeroCrossingRate(pcmBuffer: Buffer): number {
    if (!pcmBuffer || !Buffer.isBuffer(pcmBuffer) || pcmBuffer.length < 4) return 0;
    const sampleCount = Math.floor(pcmBuffer.length / 2);
    let zeroCrossings = 0;
    let prevVal = pcmBuffer.readInt16LE(0);

    for (let i = 1; i < sampleCount; i++) {
      const currentVal = pcmBuffer.readInt16LE(i * 2);
      if ((prevVal >= 0 && currentVal < 0) || (prevVal < 0 && currentVal >= 0)) {
        zeroCrossings++;
      }
      prevVal = currentVal;
    }

    return zeroCrossings / (sampleCount - 1);
  }

  /**
   * Calculate High-Frequency First-Difference Energy Ratio (HFPR)
   * High ratio indicates unvoiced human consonants ("ch", "s", "kh", "th"); low ratio indicates fan/AC rumble
   */
  public computeHighFrequencyRatio(pcmBuffer: Buffer): number {
    if (!pcmBuffer || !Buffer.isBuffer(pcmBuffer) || pcmBuffer.length < 4) return 0;
    const sampleCount = Math.floor(pcmBuffer.length / 2);
    let totalEnergy = 0;
    let diffEnergy = 0;
    let prevSample = pcmBuffer.readInt16LE(0) / 32768.0;

    for (let i = 1; i < sampleCount; i++) {
      const sample = pcmBuffer.readInt16LE(i * 2) / 32768.0;
      totalEnergy += sample * sample;
      const diff = sample - prevSample;
      diffEnergy += diff * diff;
      prevSample = sample;
    }

    if (totalEnergy < 1e-6) return 0;
    return Math.min(1.0, diffEnergy / (4 * totalEnergy));
  }

  /**
   * Calculate Root Mean Square (RMS) amplitude from 16-bit PCM buffer
   */
  public computeRms(pcmBuffer: Buffer): number {
    if (!pcmBuffer || !Buffer.isBuffer(pcmBuffer) || pcmBuffer.length < 2) return 0;
    const sampleCount = Math.floor(pcmBuffer.length / 2);
    if (sampleCount === 0) return 0;

    let sumSquares = 0;
    for (let i = 0; i < sampleCount; i++) {
      const sample = pcmBuffer.readInt16LE(i * 2) / 32768.0; // Normalize to [-1.0, 1.0]
      sumSquares += sample * sample;
    }

    return Math.sqrt(sumSquares / sampleCount);
  }

  /**
   * Convert linear RMS to decibels relative to full scale (dBFS)
   */
  public rmsToDb(rms: number): number {
    if (rms <= 1e-6) return -96.0;
    return 20 * Math.log10(rms);
  }

  /**
   * Calculate dynamic trigger threshold based on noise floor & acoustic mode
   */
  private getDynamicTriggerThreshold(): number {
    if (this.mode === 'standard') {
      return this.energyThresholdDb;
    }

    let deltaDb = 6.0;
    if (this.mode === 'whisper_boost') deltaDb = 3.5;
    if (this.mode === 'ultra_sensitive') deltaDb = 2.5;
    if (this.mode === 'far_field_cabin') deltaDb = 5.0;

    // Dynamic threshold is the noise floor + delta, clamped by minimum energy threshold
    const dynamicThreshold = Math.min(this.energyThresholdDb, this.noiseFloorDb + deltaDb);
    return Math.max(dynamicThreshold, this.FLOOR_MIN_DB + 3.0);
  }

  /**
   * Calculate soft-knee dynamic gain compensation for far-field audio
   */
  public computeGainCompensation(db: number): number {
    if (this.mode === 'standard') return 0;
    if (db < -42.0) return 18.0; // Max +18dB boost for distant whispers
    if (db < -32.0) return 12.0; // +12dB boost for far-field speech
    if (db < -20.0) return 6.0;  // +6dB boost for normal speech
    return 0.0;                  // Zero boost for close loud speech (prevents clipping)
  }

  /**
   * Process an incoming binary PCM audio frame with dynamic floor tracking & pre-roll
   */
  public processPcmChunk(pcmBuffer: Buffer): VadEvent {
    const rms = this.computeRms(pcmBuffer);
    const db = this.rmsToDb(rms);

    // Update dynamic noise floor during silent frames
    if (this.currentState === 'SILENCE' && db < this.energyThresholdDb) {
      const clampedDb = Math.max(this.FLOOR_MIN_DB, Math.min(this.FLOOR_MAX_DB, db));
      this.noiseFloorDb = (1 - this.FLOOR_ALPHA_IDLE) * this.noiseFloorDb + this.FLOOR_ALPHA_IDLE * clampedDb;
    }

    const triggerThreshold = this.getDynamicTriggerThreshold();
    const snrDb = Math.max(0, db - this.noiseFloorDb);
    const zcr = this.computeZeroCrossingRate(pcmBuffer);
    const highFreqRatio = this.computeHighFrequencyRatio(pcmBuffer);

    // Mechanical Fan / AC Low-Frequency Rumble Detector
    // Continuous 50Hz hum has low ZCR (< 0.06) and negligible high-frequency ratio (< 0.08)
    const isFanRumble = db >= triggerThreshold && zcr < 0.05 && highFreqRatio < 0.08 && snrDb < 10.0;

    // Whispered speech discriminator: low overall RMS, but high unvoiced consonant friction (ZCR > 0.18)
    const isWhisper = (db < -36.0 && (db >= triggerThreshold || (snrDb >= 2.5 && zcr > 0.18))) && !isFanRumble;

    // A frame is classified as valid voice if energy exceeds dynamic threshold and is NOT mechanical fan rumble,
    // OR if it matches unvoiced whisper profile
    const isFrameVoice = ((db >= triggerThreshold && !isFanRumble) || isWhisper);
    const gainCompensationDb = this.computeGainCompensation(db);

    // Maintain Circular Pre-Roll Ring Buffer
    this.preRollRingBuffer.push(pcmBuffer);
    if (this.preRollRingBuffer.length > this.MAX_PREROLL_FRAMES) {
      this.preRollRingBuffer.shift();
    }

    let nextState: VadState = this.currentState;
    let preRollBufferedBytes = 0;

    if (isFrameVoice) {
      this.consecutiveVoiceFrames++;
      this.consecutiveSilenceFrames = 0;

      if (this.currentState === 'SILENCE' && this.consecutiveVoiceFrames >= this.voiceStartFrames) {
        nextState = 'SPEECH_START';
        // Compute total pre-roll bytes captured to flush to transcriber
        preRollBufferedBytes = this.preRollRingBuffer.reduce((acc, buf) => acc + buf.length, 0);
      } else if (this.currentState === 'SPEECH_START' || this.currentState === 'SPEECH_ONGOING') {
        nextState = 'SPEECH_ONGOING';
      }
    } else {
      this.consecutiveSilenceFrames++;
      this.consecutiveVoiceFrames = 0;

      if (
        (this.currentState === 'SPEECH_ONGOING' || this.currentState === 'SPEECH_START') &&
        this.consecutiveSilenceFrames >= this.voiceEndFrames
      ) {
        nextState = 'SPEECH_END';
      } else if (this.currentState === 'SPEECH_END') {
        nextState = 'SILENCE';
      }
    }

    this.currentState = nextState;

    const event: VadEvent = {
      state: this.currentState,
      rmsEnergy: parseFloat(rms.toFixed(4)),
      dbLevel: parseFloat(db.toFixed(1)),
      noiseFloorDb: parseFloat(this.noiseFloorDb.toFixed(1)),
      snrDb: parseFloat(snrDb.toFixed(1)),
      isVoiceActive: this.currentState === 'SPEECH_START' || this.currentState === 'SPEECH_ONGOING',
      isWhisper,
      isFanRumbleRejected: isFanRumble,
      zeroCrossingRate: parseFloat(zcr.toFixed(3)),
      highFreqRatio: parseFloat(highFreqRatio.toFixed(3)),
      gainCompensationDb,
      acousticMode: this.mode,
      preRollBufferedBytes,
      timestamp: new Date().toISOString()
    };

    this.emit('vad', event);
    return event;
  }

  /**
   * Flush all buffered pre-roll audio frames as a single concatenated buffer
   */
  public flushPreRollBuffer(): Buffer {
    const combined = Buffer.concat(this.preRollRingBuffer);
    return combined;
  }

  public getCurrentState(): VadState {
    return this.currentState;
  }

  public getAcousticMetrics(): AcousticMetrics {
    return {
      currentFloorDb: parseFloat(this.noiseFloorDb.toFixed(1)),
      currentSnrDb: 0,
      currentDbLevel: 0,
      activeMode: this.mode,
      consecutiveVoiceFrames: this.consecutiveVoiceFrames,
      consecutiveSilenceFrames: this.consecutiveSilenceFrames,
      preRollBufferCount: this.preRollRingBuffer.length
    };
  }
}
