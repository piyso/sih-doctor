/**
 * Test environment: imported first by the runner so every battery shares one throw-away database
 * instead of the site's hospital.db. Set DB_PATH yourself to override.
 */
import os from 'os';
import path from 'path';
import fs from 'fs';

if (!process.env.DB_PATH) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hospital-os-tests-'));
  process.env.DB_PATH = path.join(dir, 'test.db');
  process.env.DATA_DIR = dir;
}
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.BACKUP_HOUR = 'off';
