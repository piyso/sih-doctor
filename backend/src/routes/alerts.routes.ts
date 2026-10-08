/**
 * Nurse-station alert handling (SOS from kiosks).
 */

import { Router, Request, Response } from 'express';
import { requireStaff } from '../security/middleware';
import { CLINICIAN_ROLES } from '../security/config';
import { audit } from '../security/audit';
import { AlertsService } from '../services/alerts.service';

export const alertsRouter = Router();

alertsRouter.use(requireStaff(...CLINICIAN_ROLES, 'reception'));

alertsRouter.get('/', (_req: Request, res: Response): void => {
  res.json({ success: true, data: AlertsService.listOpen() });
});

alertsRouter.post('/:id/ack', (req: Request, res: Response): void => {
  const a = AlertsService.acknowledge(String(req.params.id), req.staff!.displayName);
  if (!a) {
    res.status(404).json({ error: 'Alert not found' });
    return;
  }
  audit(req, 'sos.acknowledged', a.id);
  res.json({ success: true, data: a });
});

alertsRouter.post('/:id/resolve', (req: Request, res: Response): void => {
  const a = AlertsService.resolve(String(req.params.id), req.staff!.displayName, typeof req.body?.note === 'string' ? req.body.note : undefined);
  if (!a) {
    res.status(404).json({ error: 'Alert not found' });
    return;
  }
  audit(req, 'sos.resolved', a.id, { note: req.body?.note || null });
  res.json({ success: true, data: a });
});
