/**
 * Field-level protection for direct identifiers (phone numbers).
 *
 * - `encryptField` / `decryptField`: AES-256-GCM, used to keep the full phone number only so an SMS
 *   can be sent when the patient agreed to it.
 * - `blindIndex`: HMAC-SHA256, used to find an existing patient by phone without storing the number
 *   in a searchable plain form.
 *
 * The key lives in DATA_DIR/keys (or FIELD_ENCRYPTION_KEY, 32 bytes base64). Back it up with the DB.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const KEY_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '../../data'), 'keys');
const KEY_PATH = path.join(KEY_DIR, 'field-encryption.key');

function loadKey(): Buffer {
  if (process.env.FIELD_ENCRYPTION_KEY) {
    const k = Buffer.from(process.env.FIELD_ENCRYPTION_KEY, 'base64');
    if (k.length !== 32) throw new Error('FIELD_ENCRYPTION_KEY must be 32 bytes, base64 encoded.');
    return k;
  }
  if (fs.existsSync(KEY_PATH)) return Buffer.from(fs.readFileSync(KEY_PATH, 'utf8').trim(), 'base64');
  fs.mkdirSync(KEY_DIR, { recursive: true, mode: 0o700 });
  const k = crypto.randomBytes(32);
  fs.writeFileSync(KEY_PATH, k.toString('base64'), { mode: 0o600 });
  console.log(`[FieldCrypto] Created new field-encryption key at ${KEY_PATH}. Back this file up with the database.`);
  return k;
}

const KEY = loadKey();
const INDEX_KEY = crypto.createHmac('sha256', KEY).update('blind-index-v1').digest();

export function encryptField(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${enc.toString('base64')}`;
}

export function decryptField(stored: string | null | undefined): string | null {
  if (!stored || !stored.startsWith('v1:')) return null;
  try {
    const [, iv, tag, data] = stored.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export function blindIndex(value: string): string {
  return crypto.createHmac('sha256', INDEX_KEY).update(value).digest('hex');
}

/** A purpose-specific sub-key derived from the field-encryption key (HMAC-SHA256 over a label). */
export function deriveKey(label: string): Buffer {
  return crypto.createHmac('sha256', KEY).update(`derived:${label}`).digest();
}

/** Indian mobile numbers: keep the last 10 digits. Returns '' when it is not a valid mobile. */
export function normalisePhone(raw: unknown): string {
  const digits = String(raw || '').replace(/\D/g, '').slice(-10);
  return /^[6-9]\d{9}$/.test(digits) ? digits : '';
}
