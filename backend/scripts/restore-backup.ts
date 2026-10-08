/**
 * Decrypt an encrypted backup into a plain SQLite file.
 *   npm run restore-backup -- data/backups/hospital-....db.enc ./restored.db
 * Stop the server, move the current data/hospital.db aside, and put the restored file in its place.
 */
import { decryptBackup } from '../src/services/backup.service';

const [file, target] = process.argv.slice(2);
if (!file || !target) {
  console.error('Usage: npm run restore-backup -- <backup.db.enc> <target.db>');
  process.exit(1);
}
decryptBackup(file, target);
console.log(`Restored ${file} -> ${target}`);
process.exit(0);
