/**
 * In-memory two-stage index over de-identified cases.
 *   Stage 1 (coarse): brute-force dot products over int8 vectors (compression level 1).
 *   Stage 2 (re-rank): the top-k candidates at full precision, in the mode the arbiter chose.
 * A graph index (HNSW) replaces the brute-force scan when a shard grows past a few hundred thousand
 * cases; at facility scale the scan is sub-millisecond and simpler to audit.
 */
import { CASE_DIM, Idf, caseTokens, dotInt8, embed, quantize } from './embedding';
import { CaseQuery, CaseRecord } from './types';

export class CaseIndex {
  readonly records: CaseRecord[];
  readonly vectors: Float32Array[];
  private readonly quantized: Int8Array[];
  private readonly scales: number[];
  readonly idf: Idf;
  readonly builtAt: string;

  private constructor(records: CaseRecord[], vectors: Float32Array[], quantized: Int8Array[], scales: number[], idf: Idf) {
    this.records = records; this.vectors = vectors; this.quantized = quantized; this.scales = scales; this.idf = idf; this.builtAt = new Date().toISOString();
  }

  static build(records: CaseRecord[]): CaseIndex {
    const idf = new Idf();
    const tokenLists = records.map(r => caseTokens(r));
    for (const t of tokenLists) idf.add(t);
    const vectors = tokenLists.map(t => embed(t, idf));
    const quantized: Int8Array[] = []; const scales: number[] = [];
    for (const v of vectors) { const q = quantize(v); quantized.push(q.q); scales.push(q.scale); }
    return new CaseIndex(records, vectors, quantized, scales, idf);
  }

  size(): number { return this.records.length; }

  embedQuery(q: CaseQuery): Float32Array { return embed(caseTokens(q), this.idf); }

  /** Coarse stage over the compressed copy; returns record indexes ordered by approximate similarity. */
  coarse(query: Float32Array, k: number, exclude: Set<string> = new Set()): Array<{ idx: number; score: number }> {
    const qq = quantize(query);
    const scored: Array<{ idx: number; score: number }> = [];
    for (let i = 0; i < this.records.length; i++) {
      if (exclude.has(this.records[i].id)) continue;
      scored.push({ idx: i, score: dotInt8(qq.q, this.quantized[i]) / (qq.scale * this.scales[i]) });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  }

  /** Full-precision candidate matrix (row-major, CASE_DIM per row) for the re-ranking stage. */
  candidateMatrix(idxs: number[]): Float32Array {
    const m = new Float32Array(idxs.length * CASE_DIM);
    idxs.forEach((idx, row) => m.set(this.vectors[idx], row * CASE_DIM));
    return m;
  }
}
