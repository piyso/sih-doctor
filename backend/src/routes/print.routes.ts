/**
 * Thermal printing for kiosks (token slips) — see services/thermalPrinter.service.ts.
 */

import { Router, Request, Response } from 'express';
import { requireKioskOrStaff } from '../security/middleware';
import { buildRasterJob, printerFor, probePrinter, sendToPrinter } from '../services/thermalPrinter.service';
import { audit } from '../security/audit';

export const printRouter = Router();
printRouter.use(requireKioskOrStaff);

printRouter.get('/status', async (req: Request, res: Response): Promise<void> => {
  const target = printerFor(req.kioskDevice?.id);
  if (!target) {
    res.json({ configured: false, reachable: false });
    return;
  }
  res.json({ configured: true, reachable: await probePrinter(target) });
});

/** Body: { bytesPerRow, height, data: base64 of packed 1-bit rows, copies? } */
printRouter.post('/raster', async (req: Request, res: Response): Promise<void> => {
  const target = printerFor(req.kioskDevice?.id);
  if (!target) {
    res.status(409).json({ error: 'No thermal printer is configured for this kiosk.', code: 'NO_PRINTER' });
    return;
  }
  const bytesPerRow = Number(req.body?.bytesPerRow);
  const height = Number(req.body?.height);
  const data = typeof req.body?.data === 'string' ? Buffer.from(req.body.data, 'base64') : null;
  // 80 mm printers are 576 dots (72 bytes) wide; 58 mm are 384 dots (48 bytes).
  if (!data || !Number.isInteger(bytesPerRow) || bytesPerRow < 8 || bytesPerRow > 128 || !Number.isInteger(height) || height < 1 || height > 4000 || data.length !== bytesPerRow * height) {
    res.status(400).json({ error: 'Invalid raster image.' });
    return;
  }
  try {
    await sendToPrinter(target, buildRasterJob(bytesPerRow, height, data, { copies: Number(req.body?.copies) || 1 }));
    audit(req, 'print.token_slip', null, { height });
    res.json({ success: true });
  } catch (err: any) {
    res.status(502).json({ error: `Printer problem: ${err.message}`, code: 'PRINTER_ERROR' });
  }
});
