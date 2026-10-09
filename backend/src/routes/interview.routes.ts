/**
 * Kiosk interview endpoints (adaptive history taking). Mounted at /api/kiosk/interview behind
 * requireKioskOrStaff. State lives server-side (encrypted) so a kiosk reload resumes the interview.
 */

import { Router, Request, Response } from 'express';
import { InterviewService, loadInterview } from '../services/interview.service';
import { buildHistorySummary } from '../services/clinicalHistory.service';
import { audit } from '../security/audit';

export const interviewRouter = Router();

/** POST /start — body { language?, careStream?, patient?: { age, gender, isPregnant } } */
interviewRouter.post('/start', (req: Request, res: Response): void => {
  try {
    const { state, question } = InterviewService.start(req.body || {});
    res.json({ success: true, interviewId: state.id, question, questionBankSize: InterviewService.questionBankSize() });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/** GET /:id — current question and progress (for resuming). */
interviewRouter.get('/:id', (req: Request, res: Response): void => {
  const state = loadInterview(String(req.params.id));
  if (!state) {
    res.status(404).json({ error: 'Interview not found or expired' });
    return;
  }
  const question = InterviewService.next(state);
  res.json({ success: true, interviewId: state.id, question, done: !question, answered: Object.keys(state.answers).length, skipped: state.skipped.length });
});

/** POST /:id/answer — body { questionId, value } or { questionId, skip: true } */
interviewRouter.post('/:id/answer', (req: Request, res: Response): void => {
  const state = loadInterview(String(req.params.id));
  if (!state) {
    res.status(404).json({ error: 'Interview not found or expired' });
    return;
  }
  try {
    const { questionId, value, skip } = req.body || {};
    if (typeof questionId !== 'string') {
      res.status(400).json({ error: 'questionId is required' });
      return;
    }
    const r = InterviewService.answer(state, questionId, value, skip === true);
    res.json({ success: true, interviewId: state.id, ...r });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/** POST /:id/finish — structured history, SOCRATES symptom, red flags, summary and the asked/answered log. */
interviewRouter.post('/:id/finish', (req: Request, res: Response): void => {
  const state = loadInterview(String(req.params.id));
  if (!state) {
    res.status(404).json({ error: 'Interview not found or expired' });
    return;
  }
  const result = InterviewService.finish(state);
  const summary = buildHistorySummary({ patient: { age: state.patient.age ?? undefined, gender: state.patient.gender ?? undefined, isPregnant: result.history.obstetric?.isPregnant }, symptoms: result.symptoms, history: result.history });
  audit(req, 'kiosk.interview_finished', state.id, { answered: result.history.completeness.answered, skipped: result.history.completeness.skipped, redFlags: result.redFlags.length });
  res.json({ success: true, interviewId: state.id, ...result, summary });
});
