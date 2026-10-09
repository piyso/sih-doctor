/**
 * Online latency model for the homomorphic path (claims 12 and 13).
 *
 * Ridge regression on [1, ciphertexts, queue depth, CPU utilisation]. Each observation is first
 * scored against the current model (a held-out error), then used to update it; the mean absolute
 * error of the last 20 held-out errors is the release criterion. Until the model is released the
 * arbiter uses its default mode.
 */
export interface LatencyFeatures { ciphertexts: number; queueDepth: number; cpuUtil: number }

const K = 4;

export class LatencyPredictor {
  private xtx: number[][] = Array.from({ length: K }, (_, i) => Array.from({ length: K }, (_, j) => (i === j ? 1e-3 : 0)));
  private xty: number[] = new Array(K).fill(0);
  private weights: number[] | null = null;
  private errors: number[] = [];
  private observed: number[] = [];
  readonly minObservations: number;
  readonly maxMaeMs: number;
  readonly maxMaeRatio: number;

  constructor(opts: { minObservations?: number; maxMaeMs?: number; maxMaeRatio?: number } = {}) {
    this.minObservations = opts.minObservations ?? 8;
    this.maxMaeMs = opts.maxMaeMs ?? 40;
    this.maxMaeRatio = opts.maxMaeRatio ?? 0.3;
  }

  private row(f: LatencyFeatures): number[] { return [1, f.ciphertexts, f.queueDepth, f.cpuUtil]; }

  predict(f: LatencyFeatures): number | null {
    if (!this.weights) return null;
    const x = this.row(f);
    let y = 0;
    for (let i = 0; i < K; i++) y += this.weights[i] * x[i];
    return Math.max(0, y);
  }

  observe(f: LatencyFeatures, ms: number): void {
    const p = this.predict(f);
    if (p != null) { this.errors.push(Math.abs(p - ms)); if (this.errors.length > 20) this.errors.shift(); }
    this.observed.push(ms);
    if (this.observed.length > 200) this.observed.shift();
    const x = this.row(f);
    for (let i = 0; i < K; i++) { this.xty[i] += x[i] * ms; for (let j = 0; j < K; j++) this.xtx[i][j] += x[i] * x[j]; }
    this.weights = solve(this.xtx.map(r => r.slice()), this.xty.slice());
  }

  mae(): number | null { return this.errors.length ? this.errors.reduce((a, b) => a + b, 0) / this.errors.length : null; }
  meanObservedMs(): number | null { return this.observed.length ? this.observed.reduce((a, b) => a + b, 0) / this.observed.length : null; }
  observations(): number { return this.observed.length; }

  /** Release gate (claim 13): predictions are used only once the held-out error is small enough. */
  released(): boolean {
    const mae = this.mae(); const mean = this.meanObservedMs();
    if (this.errors.length < this.minObservations || mae == null || mean == null) return false;
    return mae <= Math.max(this.maxMaeMs, this.maxMaeRatio * mean);
  }

  state() {
    return { observations: this.observations(), heldOutErrors: this.errors.length, maeMs: this.mae(), meanObservedMs: this.meanObservedMs(), released: this.released(), weights: this.weights };
  }
}

/** Gaussian elimination with partial pivoting for the small normal equations. */
function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    if (Math.abs(a[p][c]) < 1e-12) return null;
    [a[c], a[p]] = [a[p], a[c]]; [b[c], b[p]] = [b[p], b[c]];
    for (let r = c + 1; r < n; r++) {
      const f = a[r][c] / a[c][c];
      for (let k = c; k < n; k++) a[r][k] -= f * a[c][k];
      b[r] -= f * b[c];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= a[r][k] * x[k];
    x[r] = s / a[r][r];
  }
  return x;
}
