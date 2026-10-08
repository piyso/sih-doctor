/**
 * ESC/POS thermal printer over the network (raw TCP, usually port 9100).
 *
 * The kiosk renders the token slip in the browser (so every Indian script prints correctly, which
 * printer fonts cannot do), converts it to a 1-bit image, and sends it here. We wrap it in ESC/POS
 * raster commands and stream it to the printer.
 */

import net from 'net';
import { db } from '../db/database';

try { db.exec('ALTER TABLE kiosk_devices ADD COLUMN printer_host TEXT;'); } catch {}

export function printerFor(deviceId?: string | null): { host: string; port: number } | null {
  let target = '';
  if (deviceId) {
    const r: any = db.prepare('SELECT printer_host FROM kiosk_devices WHERE id = ?').get(deviceId);
    target = r?.printer_host || '';
  }
  target = target || process.env.THERMAL_PRINTER_HOST || '';
  if (!target) return null;
  const [host, port] = target.split(':');
  return { host, port: Number(port) || 9100 };
}

/** Build ESC/POS bytes for a packed 1-bit raster (rows MSB-first, 1 = black). */
export function buildRasterJob(bytesPerRow: number, height: number, data: Buffer, opts: { cut?: boolean; copies?: number } = {}): Buffer {
  const parts: Buffer[] = [];
  const copies = Math.min(Math.max(opts.copies || 1, 1), 3);
  for (let c = 0; c < copies; c++) {
    parts.push(Buffer.from([0x1b, 0x40])); // ESC @  initialise
    parts.push(Buffer.from([0x1b, 0x61, 0x01])); // ESC a 1  centre
    // Send in bands: some printers cap the height of a single GS v 0 image.
    const BAND = 256;
    for (let y = 0; y < height; y += BAND) {
      const h = Math.min(BAND, height - y);
      parts.push(Buffer.from([0x1d, 0x76, 0x30, 0x00, bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff, h & 0xff, (h >> 8) & 0xff]));
      parts.push(data.subarray(y * bytesPerRow, (y + h) * bytesPerRow));
    }
    parts.push(Buffer.from([0x1b, 0x64, 0x04])); // ESC d 4  feed 4 lines
    if (opts.cut !== false) parts.push(Buffer.from([0x1d, 0x56, 0x42, 0x00])); // GS V B 0  partial cut
  }
  return Buffer.concat(parts);
}

export function sendToPrinter(target: { host: string; port: number }, job: Buffer, timeoutMs = 6000): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: target.host, port: target.port });
    const fail = (err: Error) => { socket.destroy(); reject(err); };
    socket.setTimeout(timeoutMs, () => fail(new Error('Printer did not respond')));
    socket.on('error', fail);
    socket.on('connect', () => socket.end(job));
    socket.on('close', hadError => { if (!hadError) resolve(); });
  });
}

export function probePrinter(target: { host: string; port: number }): Promise<boolean> {
  return new Promise(resolve => {
    const s = net.createConnection({ host: target.host, port: target.port });
    s.setTimeout(2000, () => { s.destroy(); resolve(false); });
    s.on('connect', () => { s.end(); resolve(true); });
    s.on('error', () => resolve(false));
  });
}
