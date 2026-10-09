/**
 * Case embeddings without a neural model: hashed TF-IDF over the structured fields of a case.
 *
 * Words go through the clinical lexicon's phonetic key, so "bukhar", "बुखार" and "fever"-class
 * spellings land on the same feature. Each token and each adjacent pair is hashed (FNV-1a) into a
 * fixed 256-dimensional vector with a sign bit (the hashing trick), weighted by tf·idf and
 * L2-normalised, so a dot product is a cosine similarity. The coarse stage uses an int8 copy
 * (compression level 1 in the application's terms); the re-ranking stage uses full precision.
 */
import { wordKey } from '../clinicalLexicon';
import { CaseQuery, CaseRecord } from './types';

export const CASE_DIM = 256;

const WORD = /[\p{L}\p{N}][\p{L}\p{M}\p{N}'-]*/gu;
const LETTERS = /^[\p{L}\p{M}]+$/u;

function keyOf(word: string): string {
  if (!LETTERS.test(word)) return word;
  try { const k = wordKey(word); return k && k.length > 0 ? k : word; } catch { return word; }
}

/** Tokens for one free-text field: `prefix:key` for each word and `prefix:key_key` for each adjacent pair. */
export function termTokens(prefix: string, text: string | null | undefined): string[] {
  if (!text) return [];
  const words = (String(text).normalize('NFC').toLowerCase().match(WORD) || []).filter(w => w.length > 1);
  const keys = words.map(keyOf);
  const out: string[] = keys.map(k => `${prefix}:${k}`);
  for (let i = 0; i + 1 < keys.length; i++) out.push(`${prefix}:${keys[i]}_${keys[i + 1]}`);
  return out;
}

function whole(prefix: string, value: string | null | undefined): string[] {
  if (!value) return [];
  const v = String(value).normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
  return v ? [`${prefix}=${v}`] : [];
}

/** All tokens of a case or query. The same function serves both sides so the spaces coincide. */
export function caseTokens(c: CaseQuery | CaseRecord): string[] {
  const t: string[] = [];
  for (const s of c.symptoms || []) t.push(...termTokens('sx', s));
  for (const s of c.sites || []) t.push(...termTokens('site', s));
  for (const d of c.diagnoses || []) t.push(...termTokens('dx', d));
  for (const m of c.medicines || []) t.push(...termTokens('rx', m));
  for (const i of c.investigations || []) t.push(...termTokens('inv', i));
  for (const r of c.redFlags || []) t.push(...whole('rf', r));
  t.push(...termTokens('dept', c.department));
  t.push(...whole('cs', c.careStream));
  t.push(...whole('age', c.ageBand));
  t.push(...whole('sex', c.sex));
  if ('complaintText' in c) t.push(...termTokens('cx', (c as CaseQuery).complaintText));
  return t;
}

export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Inverse document frequency learned from the corpus; rebuilt with the index. */
export class Idf {
  private df = new Map<string, number>();
  docs = 0;
  add(tokens: Iterable<string>): void {
    this.docs++;
    for (const t of new Set(tokens)) this.df.set(t, (this.df.get(t) || 0) + 1);
  }
  weight(token: string): number {
    const d = this.df.get(token) || 0;
    return Math.log((this.docs + 1) / (d + 1)) + 1;
  }
}

export function embed(tokens: string[], idf: Idf | null): Float32Array {
  const v = new Float32Array(CASE_DIM);
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  for (const [t, n] of tf) {
    const h = fnv1a(t);
    const idx = h % CASE_DIM;
    const sign = (h & 0x80000000) ? -1 : 1;
    v[idx] += sign * (1 + Math.log(n)) * (idf ? idf.weight(t) : 1);
  }
  let norm = 0;
  for (let i = 0; i < CASE_DIM; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < CASE_DIM; i++) v[i] /= norm;
  return v;
}

/** Symmetric int8 quantisation with a per-vector scale (coarse stage). */
export function quantize(v: Float32Array): { q: Int8Array; scale: number } {
  let max = 0;
  for (let i = 0; i < v.length; i++) max = Math.max(max, Math.abs(v[i]));
  const scale = max > 0 ? 127 / max : 1;
  const q = new Int8Array(v.length);
  for (let i = 0; i < v.length; i++) q[i] = Math.max(-127, Math.min(127, Math.round(v[i] * scale)));
  return { q, scale };
}

export function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function dotInt8(a: Int8Array, b: Int8Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function ageBandOf(age: number | null | undefined): string {
  if (age == null || !Number.isFinite(Number(age))) return 'unknown';
  const a = Number(age);
  if (a <= 5) return '0-5';
  if (a <= 12) return '6-12';
  if (a <= 18) return '13-18';
  if (a <= 40) return '19-40';
  if (a <= 60) return '41-60';
  return '61+';
}
