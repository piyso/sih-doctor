/**
 * Homomorphic-mode engine: CKKS (Microsoft SEAL through node-seal) evaluating cosine similarity on an
 * encrypted query against packed plaintext candidate vectors.
 *
 * Packing follows the application (claim 19): the query is replicated across the slots of one
 * ciphertext; 16 candidates of 256 dimensions fill the 4,096 slots of one plaintext; one
 * ciphertext-plaintext multiplication followed by log2(256) = 8 rotate-and-add steps leaves each
 * candidate's score in the first slot of its block. The noise-floor admission check of claims 11 and
 * 21 runs before every level-consuming operation: a query ciphertext whose residual budget would fall
 * below the floor is refreshed (decrypted and re-encrypted, the "enclave-assisted refresh" of the
 * description) before the operation.
 *
 * Honest scope: in this single-node prototype the orchestrator also holds the secret key, so the
 * peer node and the client are the same process. Candidate vectors are plaintext on the peer; what
 * the homomorphic path protects is the query (the patient's presentation).
 */
import { CASE_DIM } from './embedding';

export const POLY_MODULUS_DEGREE = 8192;
export const COEFF_MODULUS_BITS = [60, 40, 40, 60];
export const SCALE_BITS = 40;
export const CANDIDATES_PER_CIPHERTEXT = POLY_MODULUS_DEGREE / 2 / CASE_DIM; // 16
export const NOISE_FLOOR = 0.15; // normalised residual budget below which an operation is not admitted

type Seal = any;

export interface EncryptedQuery {
  cipher: any;
  /** Residual budget in [0, 1]: remaining levels over the levels of a fresh ciphertext. */
  residualBudget: () => number;
}

export class HeEngine {
  private seal: Seal | null = null;
  private ctx: any; private encoder: any; private encryptor: any; private decryptor: any; private evaluator: any; private galois: any;
  private freshLevels = 0;
  private initPromise: Promise<boolean> | null = null;
  lastError: string | null = null;
  readonly counters = { encryptions: 0, ciphertextsEvaluated: 0, refreshes: 0, admissionChecks: 0 };
  readonly timings = { lastEncryptMs: 0, lastEvaluateMs: 0, lastDecryptMs: 0 };

  available(): boolean { return this.seal != null; }

  /** Load SEAL once. Returns false (and records the reason) when the WebAssembly cannot run here. */
  init(): Promise<boolean> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const factory = require('node-seal/throws_wasm_node_umd');
        const seal = await factory();
        const parms = seal.EncryptionParameters(seal.SchemeType.ckks);
        parms.setPolyModulusDegree(POLY_MODULUS_DEGREE);
        parms.setCoeffModulus(seal.CoeffModulus.Create(POLY_MODULUS_DEGREE, Int32Array.from(COEFF_MODULUS_BITS)));
        const ctx = seal.Context(parms, true, seal.SecurityLevel.tc128);
        if (!ctx.parametersSet()) throw new Error('CKKS parameters rejected');
        const keyGen = seal.KeyGenerator(ctx);
        const steps: number[] = []; for (let s = 1; s < CASE_DIM; s *= 2) steps.push(s);
        this.galois = keyGen.createGaloisKeys(Int32Array.from(steps));
        this.encoder = seal.CKKSEncoder(ctx);
        this.encryptor = seal.Encryptor(ctx, keyGen.createPublicKey());
        this.decryptor = seal.Decryptor(ctx, keyGen.secretKey());
        this.evaluator = seal.Evaluator(ctx);
        this.ctx = ctx;
        this.seal = seal;
        const probe = this.encryptor.encrypt(this.encoder.encode(new Float64Array(this.encoder.slotCount), Math.pow(2, SCALE_BITS)));
        this.freshLevels = probe.coeffModulusSize - 1;
        probe.delete();
        return true;
      } catch (e: any) {
        this.lastError = String(e?.message || e).slice(0, 200);
        this.seal = null;
        return false;
      }
    })();
    return this.initPromise;
  }

  get slotCount(): number { return this.encoder ? this.encoder.slotCount : POLY_MODULUS_DEGREE / 2; }

  private levelsOf(cipher: any): number { return cipher.coeffModulusSize - 1; }

  /** Encrypt a unit query vector replicated across all slots. */
  encryptQuery(vec: Float32Array): EncryptedQuery {
    if (!this.seal) throw new Error('HE engine not available');
    const t0 = performance.now();
    const slots = this.encoder.slotCount;
    const arr = new Float64Array(slots);
    for (let i = 0; i < slots; i++) arr[i] = vec[i % CASE_DIM];
    const plain = this.encoder.encode(arr, Math.pow(2, SCALE_BITS));
    const cipher = this.encryptor.encrypt(plain);
    plain.delete();
    this.counters.encryptions++;
    this.timings.lastEncryptMs = performance.now() - t0;
    return { cipher, residualBudget: () => this.levelsOf(cipher) / this.freshLevels };
  }

  /** Lower the query's level by one (test hook: makes the admission check and the refresh observable). */
  modSwitchDown(q: EncryptedQuery): void {
    if (!this.seal) return;
    this.evaluator.cipherModSwitchToNext(q.cipher, q.cipher);
  }

  /** Noise-floor admission check (claims 11, 21): refresh before an operation that would drop below the floor. */
  admit(q: EncryptedQuery, levelsConsumed = 1): { refreshed: boolean; budgetAfter: number } {
    this.counters.admissionChecks++;
    const after = (this.levelsOf(q.cipher) - levelsConsumed) / this.freshLevels;
    if (after >= NOISE_FLOOR) return { refreshed: false, budgetAfter: after };
    // Refresh: decrypt and re-encrypt (the peer's isolated environment does this in the application).
    const plain = this.decryptor.decrypt(q.cipher);
    const values: Float64Array = this.encoder.decode(plain);
    plain.delete();
    const fresh = this.encoder.encode(values, Math.pow(2, SCALE_BITS));
    const cipher = this.encryptor.encrypt(fresh);
    fresh.delete();
    q.cipher.delete();
    q.cipher = cipher;
    this.counters.refreshes++;
    return { refreshed: true, budgetAfter: (this.levelsOf(cipher) - levelsConsumed) / this.freshLevels };
  }

  /**
   * Similarity of the encrypted query to `candidates` (row-major, CASE_DIM each).
   * Returns the decrypted scores and how many ciphertexts were evaluated.
   */
  evaluate(q: EncryptedQuery, candidates: Float32Array): { scores: number[]; ciphertexts: number; refreshes: number } {
    if (!this.seal) throw new Error('HE engine not available');
    const k = Math.floor(candidates.length / CASE_DIM);
    const slots = this.encoder.slotCount;
    const scale = Math.pow(2, SCALE_BITS);
    const scores: number[] = new Array(k).fill(0);
    let ciphertexts = 0;
    let refreshes = 0;
    const tEval0 = performance.now();
    let decryptMs = 0;
    for (let start = 0; start < k; start += CANDIDATES_PER_CIPHERTEXT) {
      const n = Math.min(CANDIDATES_PER_CIPHERTEXT, k - start);
      const packed = new Float64Array(slots);
      for (let j = 0; j < n; j++) {
        const off = (start + j) * CASE_DIM;
        for (let d = 0; d < CASE_DIM; d++) packed[j * CASE_DIM + d] = candidates[off + d];
      }
      const adm = this.admit(q, 1);
      if (adm.refreshed) refreshes++;
      const plain = this.encoder.encode(packed, scale);
      const prod = this.evaluator.multiplyPlain(q.cipher, plain);
      plain.delete();
      this.evaluator.rescaleToNext(prod, prod);
      for (let s = 1; s < CASE_DIM; s *= 2) {
        const rot = this.evaluator.rotateVector(prod, s, this.galois);
        this.evaluator.add(prod, rot, prod);
        rot.delete();
      }
      const tD = performance.now();
      const dec = this.decryptor.decrypt(prod);
      const out: Float64Array = this.encoder.decode(dec);
      dec.delete(); prod.delete();
      decryptMs += performance.now() - tD;
      for (let j = 0; j < n; j++) scores[start + j] = out[j * CASE_DIM];
      ciphertexts++;
    }
    this.counters.ciphertextsEvaluated += ciphertexts;
    this.timings.lastEvaluateMs = performance.now() - tEval0 - decryptMs;
    this.timings.lastDecryptMs = decryptMs;
    return { scores, ciphertexts, refreshes };
  }

  release(q: EncryptedQuery): void { try { q.cipher.delete(); } catch { /* already freed */ } }

  parameters() {
    return { scheme: 'CKKS', polyModulusDegree: POLY_MODULUS_DEGREE, coeffModulusBits: COEFF_MODULUS_BITS, scaleBits: SCALE_BITS, slots: this.slotCount, candidatesPerCiphertext: CANDIDATES_PER_CIPHERTEXT, freshLevels: this.freshLevels, noiseFloor: NOISE_FLOOR, library: 'node-seal 5.1.5 (Microsoft SEAL 4.x, WebAssembly)' };
  }
}
