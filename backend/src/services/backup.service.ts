/**
 * Encrypted database backups.
 *
 * A consistent snapshot is taken with SQLite's online backup API, then encrypted with AES-256-GCM
 * (key: BACKUP_ENCRYPTION_KEY, 32 bytes base64; falls back to the field-encryption key file) and
 * written to BACKUP_DIR. The newest BACKUP_KEEP files are kept. Copy BACKUP_DIR off the machine
 * (USB drive / another server) — a backup on the same disk does not survive a disk failure.
 *
 * Restore: `npm run restore-backup -- <file.enc> <target.db>`.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { db } from '../db/database';
import { appendAudit } from '../security/audit';

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '../../data'));
export const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR || path.join(DATA_DIR, 'backups'));
const KEEP = Number(process.env.BACKUP_KEEP) || 14;

export function backupKey(): Buffer {
  if (process.env.BACKUP_ENCRYPTION_KEY) {
    const k = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY, 'base64');
    if (k.length !== 32) throw new Error('BACKUP_ENCRYPTION_KEY must be 32 bytes, base64 encoded.');
    return k;
  }
  const keyFile = path.join(DATA_DIR, 'keys', 'field-encryption.key');
  if (process.env.FIELD_ENCRYPTION_KEY) return Buffer.from(process.env.FIELD_ENCRYPTION_KEY, 'base64');
  return Buffer.from(fs.readFileSync(keyFile, 'utf8').trim(), 'base64');
}

/** File layout: "HOSB1" | 12-byte IV | ciphertext | 16-byte GCM tag. */
export async function runBackup(): Promise<{ file: string; bytes: number }> {
  fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const tmp = path.join(BACKUP_DIR, `.snapshot-${stamp}.db`);
  const out = path.join(BACKUP_DIR, `hospital-${stamp}.db.enc`);
  await db.backup(tmp);
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', backupKey(), iv);
    const ws = fs.createWriteStream(out, { mode: 0o600 });
    ws.write(Buffer.from('HOSB1'));
    ws.write(iv);
    await new Promise<void>((resolve, reject) => {
      const rs = fs.createReadStream(tmp);
      rs.on('data', chunk => {
        if (!ws.write(cipher.update(chunk as Buffer))) {
          rs.pause();
          ws.once('drain', () => rs.resume());
        }
      });
      rs.on('end', () => {
        ws.write(cipher.final());
        ws.end(cipher.getAuthTag(), () => resolve());
      });
      rs.on('error', reject);
      ws.on('error', reject);
    });
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  const bytes = fs.statSync(out).size;
  const all = fs.readdirSync(BACKUP_DIR).filter(f => /^hospital-.*\.db\.enc$/.test(f)).sort();
  for (const old of all.slice(0, Math.max(0, all.length - KEEP))) fs.rmSync(path.join(BACKUP_DIR, old), { force: true });
  appendAudit({ action: 'system.backup', actor: 'system', metadata: { file: path.basename(out), bytes } });
  return { file: out, bytes };
}

export function decryptBackup(file: string, target: string): void {
  const buf = fs.readFileSync(file);
  if (buf.subarray(0, 5).toString() !== 'HOSB1') throw new Error('Not a hospital backup file.');
  const iv = buf.subarray(5, 17);
  const tag = buf.subarray(buf.length - 16);
  const data = buf.subarray(17, buf.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', backupKey(), iv);
  decipher.setAuthTag(tag);
  fs.writeFileSync(target, Buffer.concat([decipher.update(data), decipher.final()]), { mode: 0o600 });
}

export function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => /^hospital-.*\.db\.enc$/.test(f))
    .sort()
    .reverse()
    .map(f => ({ file: f, bytes: fs.statSync(path.join(BACKUP_DIR, f)).size, createdAt: fs.statSync(path.join(BACKUP_DIR, f)).mtime.toISOString() }));
}

/** Nightly at BACKUP_HOUR (local server time, default 02:00). Disabled with BACKUP_HOUR=off. */
export function startBackupSchedule(): void {
  if ((process.env.BACKUP_HOUR || '').toLowerCase() === 'off') return;
  const hour = Number(process.env.BACKUP_HOUR ?? 2);
  const schedule = () => {
    const next = new Date();
    next.setHours(hour, 0, 0, 0);
    if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
    setTimeout(async () => {
      try { await runBackup(); } catch (e) { console.error('[Backup] Nightly backup failed', e); appendAudit({ action: 'system.backup', actor: 'system', outcome: 'failure', metadata: { error: String(e) } }); }
      schedule();
    }, next.getTime() - Date.now()).unref();
  };
  schedule();
}
