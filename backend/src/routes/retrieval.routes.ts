/**
 * /api/retrieval: de-identified similar-case retrieval for clinicians.
 *   POST /similar  { sessionId } or { query: {...} }, optional topN  -> results + arbitration decision
 *   GET  /status                                                      -> engines, guards, predictor, corpus
 * Mounted behind requireStaff(clinician roles) in app.ts.
 */
import { Request, Response, Router } from 'express';
import { audit } from '../security/audit';
import { RetrievalError, retrievalOrchestrator } from '../services/retrieval/orchestrator';

export const retrievalRouter = Router();

const strList = (v: unknown, max = 50): string[] => (Array.isArray(v) ? v.slice(0, max).map(x => String(x ?? '').trim().slice(0, 120)).filter(Boolean) : []);
const strOpt = (v: unknown, max = 120): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);

retrievalRouter.post('/similar', async (req: Request, res: Response): Promise<void> => {
  const b = req.body || {};
  const sessionId = typeof b.sessionId === 'string' && b.sessionId.length <= 80 ? b.sessionId : undefined;
  const query = b.query && typeof b.query === 'object' ? {
    department: strOpt(b.query.department), careStream: strOpt(b.query.careStream, 20), ageBand: strOpt(b.query.ageBand, 10), sex: strOpt(b.query.sex, 10),
    symptoms: strList(b.query.symptoms), sites: strList(b.query.sites), diagnoses: strList(b.query.diagnoses), medicines: strList(b.query.medicines),
    investigations: strList(b.query.investigations), redFlags: strList(b.query.redFlags), complaintText: strOpt(b.query.complaintText, 500)
  } : undefined;
  if (!sessionId && !query) { res.status(400).json({ success: false, error: 'sessionId or query is required' }); return; }
  try {
    const r = await retrievalOrchestrator.similar({ sessionId, query, topN: Number(b.topN) || 8 });
    audit(req, 'retrieval.similar', sessionId, { mode: r.decision.mode, guards: r.decision.guards, results: r.results.length, corpus: r.stages.corpusSize, ms: r.stages.totalMs });
    res.json({ success: true, data: r });
  } catch (e: any) {
    if (e instanceof RetrievalError) {
      const status = e.code === 'SESSION_NOT_FOUND' ? 404 : e.code === 'EMPTY_CORPUS' ? 503 : 400;
      res.status(status).json({ success: false, error: e.code === 'SESSION_NOT_FOUND' ? 'Session not found' : e.code === 'EMPTY_CORPUS' ? 'No cases indexed yet' : 'A query is required' });
      return;
    }
    console.error('[retrieval] failed:', e?.message || e);
    res.status(500).json({ success: false, error: 'Retrieval failed' });
  }
});

retrievalRouter.get('/status', (_req: Request, res: Response): void => {
  res.json({ success: true, data: retrievalOrchestrator.status() });
});
