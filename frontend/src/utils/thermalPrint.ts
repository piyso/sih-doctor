/**
 * Token slips for 80 mm / 58 mm ESC/POS thermal printers.
 *
 * Printer fonts cannot print Devanagari, Tamil, Bengali etc., so the slip is drawn on a canvas with
 * the browser's own fonts, converted to a 1-bit image and sent to the kiosk's printer through the
 * backend (POST /api/print/raster).
 */

import QRCode from 'qrcode';
import { api } from '../services/api';

export interface SlipContent {
  hospital: string;
  title: string;          // e.g. "Your token"
  token: string;          // e.g. GENMED-014
  lines: Array<{ text: string; size?: number; bold?: boolean }>;
  qr?: string;
  footer?: string;
}

const FONT = '"Noto Sans", "Noto Sans Devanagari", "Noto Sans Bengali", "Noto Sans Tamil", "Noto Sans Telugu", "Noto Sans Gujarati", "Noto Sans Kannada", "Noto Sans Malayalam", "Noto Sans Gurmukhi", "Noto Sans Oriya", system-ui, sans-serif';

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      out.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) out.push(line);
  return out;
}

/** Draw the slip; returns a canvas exactly `widthDots` wide. */
export async function drawSlip(content: SlipContent, widthDots = 576): Promise<HTMLCanvasElement> {
  const pad = 16;
  const inner = widthDots - pad * 2;
  const canvas = document.createElement('canvas');
  canvas.width = widthDots;
  canvas.height = 2000;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'top';
  let y = pad;

  const text = (t: string, size: number, bold = false, align: 'left' | 'center' = 'left') => {
    ctx.font = `${bold ? '700' : '500'} ${size}px ${FONT}`;
    for (const l of wrap(ctx, t, inner)) {
      const x = align === 'center' ? (widthDots - ctx.measureText(l).width) / 2 : pad;
      ctx.fillText(l, x, y);
      y += Math.round(size * 1.3);
    }
  };

  text(content.hospital, 24, true, 'center');
  y += 6;
  ctx.fillRect(pad, y, inner, 2);
  y += 12;
  text(content.title, 22, false, 'center');
  text(content.token, 64, true, 'center');
  y += 4;
  for (const l of content.lines) text(l.text, l.size || 24, !!l.bold);

  if (content.qr) {
    y += 8;
    const qr = document.createElement('canvas');
    await QRCode.toCanvas(qr, content.qr, { width: 180, margin: 0 });
    ctx.drawImage(qr, (widthDots - 180) / 2, y);
    y += 190;
  }
  if (content.footer) {
    y += 4;
    text(content.footer, 18, false, 'center');
  }
  y += pad;

  const out = document.createElement('canvas');
  out.width = widthDots;
  out.height = y;
  out.getContext('2d')!.drawImage(canvas, 0, 0);
  return out;
}

/** Threshold to 1-bit and pack rows MSB-first (1 = black), as ESC/POS GS v 0 expects. */
export function packRaster(canvas: HTMLCanvasElement): { bytesPerRow: number; height: number; data: string } {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const img = ctx.getImageData(0, 0, width, height).data;
  const bytesPerRow = Math.ceil(width / 8);
  const out = new Uint8Array(bytesPerRow * height);
  for (let yy = 0; yy < height; yy++) {
    for (let xx = 0; xx < width; xx++) {
      const i = (yy * width + xx) * 4;
      const lum = 0.299 * img[i] + 0.587 * img[i + 1] + 0.114 * img[i + 2];
      if (lum < 140) out[yy * bytesPerRow + (xx >> 3)] |= 0x80 >> (xx & 7);
    }
  }
  let bin = '';
  for (let i = 0; i < out.length; i += 0x8000) bin += String.fromCharCode(...out.subarray(i, i + 0x8000));
  return { bytesPerRow, height, data: btoa(bin) };
}

/** Print on the kiosk's thermal printer. Resolves false when no printer is configured or it failed. */
export async function printThermalSlip(content: SlipContent): Promise<boolean> {
  const status = await api.getPrinterStatus();
  if (!status.configured) return false;
  try {
    const canvas = await drawSlip(content);
    const r = packRaster(canvas);
    await api.printRaster(r.bytesPerRow, r.height, r.data);
    return true;
  } catch (e) {
    console.warn('[Print] Thermal print failed:', e);
    return false;
  }
}
