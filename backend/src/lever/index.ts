/**
 * Sovereign Lever Hub — Master Integration Orchestrator
 * Connects MediKiosk to cognitive intelligence, audio stream, and cryptographic verification assets.
 */

import { PiyApiLever } from './PiyApiLever';
import { PiyNotesLever } from './PiyNotesLever';
import { PatentLever } from './PatentLever';

export { PiyApiLever, PiyNotesLever, PatentLever };

export class LeverHub {
  /**
   * Diagnostic Report of all 3 Sovereign Core Subsystems
   */
  public static getLeverDiagnostics(): {
    piyApiProjectCloud: { connected: boolean; path: string; subsystems: string[] };
    piyNotesAudio: { connected: boolean; path: string; subsystems: string[] };
    patentZkpArbiter: { connected: boolean; path: string; protocol: string };
  } {
    const isPiyApiConnected = PiyApiLever.checkAvailability();
    const isPiyNotesConnected = PiyNotesLever.checkAvailability();

    return {
      piyApiProjectCloud: {
        connected: isPiyApiConnected,
        path: 'backend/src/services/core (Embedded Cognitive Kernel)',
        subsystems: [
          'TruthEngine (Beta-Binomial Bayesian Updating)',
          'PACConformalGate (99% Statistical Triage Safety)',
          'SovereignNER (Verhoeff D5 Aadhaar Validation)',
          'AyushGraph (Causal Ayush-Allopathy Multi-Hop Traversal)'
        ]
      },
      piyNotesAudio: {
        connected: isPiyNotesConnected,
        path: 'backend/src/services/audioVadPipeline.service.ts (Embedded Audio DSP)',
        subsystems: [
          'PhoneticNormalizer (Hinglish/Code-Switching Dialects)',
          'AudioPipelineService (Linear 16kHz PCM VAD Engine)'
        ]
      },
      patentZkpArbiter: {
        connected: true,
        path: 'backend/src/data/zkp_circuit (Embedded BN128 Circuit)',
        protocol: 'Groth16 / BN128 (Statutory Invariance Engine)'
      }
    };
  }
}
