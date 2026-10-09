/**
 * Mode arbiter: for every retrieval operation, choose homomorphic ("HE") or isolated execution.
 *
 * Steps, in the order the application states them (claims 8 and 20, with 9, 13 and 15):
 *   1. candidate mode: ISOLATED when the predicted homomorphic latency exceeds the threshold,
 *      HE otherwise; before the predictor is released (claim 13) the default mode is used;
 *   2. tier override: a highest-confidentiality query never leaves the homomorphic domain (claim 15);
 *   3. secure-memory guard: no isolated dispatch that would take the secure-memory region above its
 *      ceiling (claim 9, prospective form);
 *   4. enclave-ratio guard: no isolated dispatch that would make the isolated share of the W most
 *      recent operations, including this one, exceed the maximum ratio (claims 8, 20, prospective).
 * The guards are deterministic and apply whatever the prediction or the threshold says.
 *
 * Pure logic, no I/O: the test battery drives it with adversarial inputs.
 */
import { ArbitrationDecision, ConfidentialityTier, ExecMode, GuardFlags } from './types';

export interface ArbiterConfig {
  /** W: window length in operations. */
  windowW: number;
  /** Maximum share of isolated-mode operations in any window (r_max < 1). */
  maxEnclaveRatio: number;
  /** Maximum utilisation of the secure-memory region (0..1). */
  secureMemoryCeiling: number;
  /** Mode-switching latency threshold in milliseconds (fixed in this embodiment). */
  thresholdMs: number;
  /** Mode used until the latency predictor is released. */
  defaultMode: ExecMode;
}

export const DEFAULT_ARBITER_CONFIG: ArbiterConfig = {
  windowW: 100,
  maxEnclaveRatio: 0.8,
  secureMemoryCeiling: 0.85,
  thresholdMs: 250,
  defaultMode: 'HE'
};

export interface ArbiterInput {
  predictedHeMs: number | null;
  predictorReleased: boolean;
  tier: ConfidentialityTier;
  /** Secure-memory utilisation the isolated evaluator would reach if this operation were dispatched to it. */
  secureMemoryUtilAfter: number;
  heAvailable: boolean;
  isolatedAvailable: boolean;
}

export class ModeArbiter {
  readonly cfg: ArbiterConfig;
  private window: ExecMode[] = [];
  readonly counters = {
    operations: 0,
    he: 0,
    isolated: 0,
    defaultedBeforeRelease: 0,
    tierOverrides: 0,
    enclaveRatioGuardTrips: 0,
    secureMemoryGuardTrips: 0,
    availabilityFallbacks: 0,
    maxWindowEnclaveShare: 0
  };

  constructor(cfg: Partial<ArbiterConfig> = {}) {
    this.cfg = { ...DEFAULT_ARBITER_CONFIG, ...cfg };
    if (!(this.cfg.windowW > 1) || !(this.cfg.maxEnclaveRatio < 1)) throw new Error('arbiter: W must exceed 1 and the maximum enclave ratio must be below 1');
  }

  /** Decide the mode for the next operation. Call `record()` with the mode actually executed. */
  decide(i: ArbiterInput): ArbitrationDecision {
    const guards: GuardFlags = { tierOverride: false, enclaveRatio: false, secureMemory: false, availabilityFallback: false };
    let candidate: ExecMode;
    if (!i.predictorReleased || i.predictedHeMs == null) {
      candidate = this.cfg.defaultMode;
      this.counters.defaultedBeforeRelease++;
    } else {
      candidate = i.predictedHeMs > this.cfg.thresholdMs ? 'ISOLATED' : 'HE';
    }
    let mode: ExecMode = candidate;

    if (i.tier === 1 && mode === 'ISOLATED') { mode = 'HE'; guards.tierOverride = true; this.counters.tierOverrides++; }

    if (mode === 'ISOLATED' && i.secureMemoryUtilAfter > this.cfg.secureMemoryCeiling) {
      mode = 'HE'; guards.secureMemory = true; this.counters.secureMemoryGuardTrips++;
    }

    if (mode === 'ISOLATED' && !this.enclaveAdmissible()) {
      mode = 'HE'; guards.enclaveRatio = true; this.counters.enclaveRatioGuardTrips++;
    }

    if (mode === 'HE' && !i.heAvailable && i.isolatedAvailable) { mode = 'ISOLATED'; guards.availabilityFallback = true; this.counters.availabilityFallbacks++; }
    if (mode === 'ISOLATED' && !i.isolatedAvailable && i.heAvailable) { mode = 'HE'; guards.availabilityFallback = true; this.counters.availabilityFallbacks++; }

    return {
      mode,
      candidateMode: candidate,
      predictedHeMs: i.predictedHeMs,
      thresholdMs: this.cfg.thresholdMs,
      predictorReleased: i.predictorReleased,
      tier: i.tier,
      guards,
      windowEnclaveShare: this.shareIf(mode),
      secureMemoryUtilisation: i.secureMemoryUtilAfter
    };
  }

  /** Prospective check: would one more isolated operation keep every window within the ratio? */
  private enclaveAdmissible(): boolean {
    return this.shareIf('ISOLATED') <= this.cfg.maxEnclaveRatio + 1e-12;
  }

  /** Isolated share of the W most recent operations if the next one runs in `mode`. */
  private shareIf(mode: ExecMode): number {
    const recent = this.window.slice(-(this.cfg.windowW - 1));
    const isolated = recent.filter(m => m === 'ISOLATED').length + (mode === 'ISOLATED' ? 1 : 0);
    return isolated / (recent.length + 1);
  }

  record(mode: ExecMode): void {
    this.window.push(mode);
    if (this.window.length > this.cfg.windowW) this.window.shift();
    this.counters.operations++;
    if (mode === 'HE') this.counters.he++; else this.counters.isolated++;
    this.counters.maxWindowEnclaveShare = Math.max(this.counters.maxWindowEnclaveShare, this.windowEnclaveShare());
  }

  windowEnclaveShare(): number {
    if (this.window.length === 0) return 0;
    return this.window.filter(m => m === 'ISOLATED').length / this.window.length;
  }

  windowLength(): number { return this.window.length; }
}
