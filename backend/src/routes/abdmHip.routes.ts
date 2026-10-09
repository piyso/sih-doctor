/**
 * ABDM HIP endpoints.
 *  - Gateway callbacks (/v0.5/...) are authenticated with ABDM_CALLBACK_TOKEN when set; the gateway
 *    sends its bearer token on every callback. Without the token configured they are refused in
 *    production and allowed on the LAN in development for sandbox testing.
 *  - Staff endpoints expose linking status, consents and the local HIU simulation.
 */

import { Router, Request, Response } from 'express';
import { requireStaff } from '../security/middleware';
import { securityConfig, CLINICIAN_ROLES } from '../security/config';
import { audit } from '../security/audit';
import { AbdmHipService } from '../services/abdmHip.service';

export const abdmHipRouter = Router();

function gatewayAuth(req: Request, res: Response, next: () => void): void {
  const expected = process.env.ABDM_CALLBACK_TOKEN || '';
  const got = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (expected) {
    if (got === expected) return next();
    res.status(401).json({ error: 'Gateway token mismatch' });
    return;
  }
  if (securityConfig.isProduction) {
    res.status(503).json({ error: 'ABDM_CALLBACK_TOKEN is not configured on this HIP' });
    return;
  }
  next();
}

// ---------- Gateway callbacks ----------

abdmHipRouter.post('/v0.5/consents/hip/notify', gatewayAuth, (req: Request, res: Response): void => {
  try {
    const r = AbdmHipService.handleConsentNotify(req.body);
    // The gateway expects 202 and a separate on-notify; we return the acknowledgement body as well for sandbox tooling.
    res.status(202).json({ requestId: req.body?.requestId || null, timestamp: new Date().toISOString(), acknowledgement: { status: r.accepted ? 'OK' : 'DENIED', consentId: r.consentId }, error: r.accepted ? null : { message: r.reason } });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

abdmHipRouter.post('/v0.5/health-information/hip/request', gatewayAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const r = await AbdmHipService.handleHiRequest(req.body);
    res.status(r.status === 'TRANSFERRED' ? 202 : 400).json({ requestId: req.body?.requestId || null, timestamp: new Date().toISOString(), hiRequest: { transactionId: r.transactionId, sessionStatus: r.status === 'TRANSFERRED' ? 'ACKNOWLEDGED' : 'ERRORED' }, entriesPushed: r.entries, error: r.error ? { message: r.error } : null });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

abdmHipRouter.post('/v0.5/links/link/on-add-contexts', gatewayAuth, (req: Request, res: Response): void => {
  const reqId = String(req.body?.resp?.requestId || req.body?.requestId || '');
  const ok = !req.body?.error;
  const n = AbdmHipService.markLinked(reqId, ok, req.body?.error?.message);
  res.status(202).json({ updated: n });
});

// ---------- Staff ----------

abdmHipRouter.get('/status', requireStaff('admin', ...CLINICIAN_ROLES), (_req: Request, res: Response): void => {
  res.json({ success: true, data: AbdmHipService.status() });
});

abdmHipRouter.get('/care-contexts/:patientId', requireStaff('admin', ...CLINICIAN_ROLES), (req: Request, res: Response): void => {
  res.json({ success: true, data: AbdmHipService.careContextsFor(String(req.params.patientId)) });
});

abdmHipRouter.post('/care-contexts/:id/link', requireStaff('admin', ...CLINICIAN_ROLES), async (req: Request, res: Response): Promise<void> => {
  try {
    const cc = await AbdmHipService.linkCareContext(String(req.params.id));
    audit(req, 'abdm.link_requested', cc.id, { status: cc.linkStatus });
    res.json({ success: true, data: cc });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

abdmHipRouter.get('/consents', requireStaff('admin', ...CLINICIAN_ROLES), (_req: Request, res: Response): void => {
  res.json({ success: true, data: AbdmHipService.consents() });
});

/** Local HIU simulation: consent → request → encrypted push → decrypt → validate, all in-process. */
abdmHipRouter.post('/simulate-hiu/:patientId', requireStaff('admin', ...CLINICIAN_ROLES), async (req: Request, res: Response): Promise<void> => {
  try {
    const r = await AbdmHipService.simulateHiuExchange(String(req.params.patientId));
    audit(req, 'abdm.hiu_simulation', String(req.params.patientId), { entries: r.entries });
    res.json({ success: true, data: r });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
