/**
 * Digital signature for finalized clinical records.
 *
 * Each finalized prescription is hashed (SHA-256 over a canonical JSON form) and the hash is signed
 * with the hospital server's Ed25519 key. Anyone holding the public key can check that a printed or
 * exported record has not been altered since it was finalized.
 *
 * The key is created on first start and kept in DATA_DIR/keys (or provided via SIGNING_PRIVATE_KEY).
 * Back it up together with the database; a lost key means older records can still be read but no
 * longer verified.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const KEY_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '../../data'), 'keys');
const PRIV_PATH = path.join(KEY_DIR, 'record-signing-ed25519.pem');

function loadOrCreateKey(): crypto.KeyObject {
  if (process.env.SIGNING_PRIVATE_KEY) return crypto.createPrivateKey(process.env.SIGNING_PRIVATE_KEY.replace(/\\n/g, '\n'));
  if (fs.existsSync(PRIV_PATH)) return crypto.createPrivateKey(fs.readFileSync(PRIV_PATH, 'utf8'));
  fs.mkdirSync(KEY_DIR, { recursive: true, mode: 0o700 });
  const { privateKey } = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(PRIV_PATH, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  console.log(`[Signing] Created new record-signing key at ${PRIV_PATH}. Back this file up with the database.`);
  return privateKey;
}

const privateKey = loadOrCreateKey();
const publicKey = crypto.createPublicKey(privateKey);
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
/** Short, stable identifier of the signing key (first 16 hex chars of the SHA-256 of the public key). */
export const SIGNING_KEY_ID = crypto.createHash('sha256').update(publicKeyPem).digest('hex').slice(0, 16);

/** JSON with object keys sorted, so the same record always produces the same bytes. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).filter(k => obj[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

export interface RecordSignature {
  algorithm: 'Ed25519';
  hashAlgorithm: 'SHA-256';
  keyId: string;
  recordSha256: string;
  signature: string; // base64
  signedAt: string;
  signedBy: string;
}

export function signRecord(record: unknown, signedBy: string): RecordSignature {
  const recordSha256 = crypto.createHash('sha256').update(canonicalJson(record)).digest('hex');
  const signature = crypto.sign(null, Buffer.from(recordSha256, 'hex'), privateKey).toString('base64');
  return { algorithm: 'Ed25519', hashAlgorithm: 'SHA-256', keyId: SIGNING_KEY_ID, recordSha256, signature, signedAt: new Date().toISOString(), signedBy };
}

export function verifyRecord(record: unknown, sig: RecordSignature): { valid: boolean; reason?: string } {
  if (!sig || sig.algorithm !== 'Ed25519') return { valid: false, reason: 'No signature on this record.' };
  if (sig.keyId !== SIGNING_KEY_ID) return { valid: false, reason: 'Signed with a different hospital key.' };
  const hash = crypto.createHash('sha256').update(canonicalJson(record)).digest('hex');
  if (hash !== sig.recordSha256) return { valid: false, reason: 'The record has changed since it was signed.' };
  const ok = crypto.verify(null, Buffer.from(hash, 'hex'), publicKey, Buffer.from(sig.signature, 'base64'));
  return ok ? { valid: true } : { valid: false, reason: 'The signature does not match.' };
}

export function getPublicKeyPem(): string {
  return publicKeyPem;
}
