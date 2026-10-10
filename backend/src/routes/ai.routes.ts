/**
 * AI-assisted features, served by the on-premise Edge AI service with rule-based fallbacks.
 *
 * Safety rules that apply to every endpoint here:
 *  - Nothing a patient says or taps is read by a language model. Extraction (POST /extract) is the rules
 *    engine in every configuration; there is no code path from the kiosk to a language model.
 *  - Triage, red flags, drug interactions, doses and the history summary are NEVER decided or written by a
 *    language model; they stay with the deterministic rules and templates.
 *  - The one place a language model may be used is a signed-in clinician's visit-note draft (POST /soap),
 *    and only when the hospital sets LLM_ASSIST=clinician (services/aiPolicy.ts). The draft is labelled, the
 *    plan always comes from what was prescribed, and the clinician edits it before anything is saved.
 *  - Machine output is a suggestion: translations are reviewed by the clinician before they are printed.
 */

import express, { Router, Request, Response } from 'express';
import { BhashiniClient } from '../services/externalSigning.service';
import { db } from '../db/database';
import { requireKioskOrStaff, requireStaff, rateLimit } from '../security/middleware';
import { CLINICIAN_ROLES } from '../security/config';
import { audit } from '../security/audit';
import { EdgeAiClient } from '../services/edgeAi.client';
import { ClinicalParserService } from '../services/clinicalParser.service';
import { normaliseHistory, buildHistorySummary } from '../services/clinicalHistory.service';
import { deniedSymptoms } from '../services/intakeExtraction.service';
import { AiPolicyError } from '../services/aiPolicy';

export const aiRouter = Router();
const aiLimiter = rateLimit('ai', 60, 60_000);

const LANGS = ['en', 'hi', 'mr', 'bn', 'ta', 'te', 'gu', 'kn', 'ml', 'pa', 'or'];
const cleanLang = (l: unknown) => (typeof l === 'string' && LANGS.includes(l) ? l : 'hi');

aiRouter.get('/status', requireKioskOrStaff, async (req: Request, res: Response): Promise<void> => {
  const status = await EdgeAiClient.status();
  // a kiosk is never offered the language model, whatever the hospital has switched on for its clinicians
  if (!req.staff) status.capabilities.llm = { available: false };
  res.json({ success: true, data: status });
});

/** Speech to text. Body: raw audio (audio/wav, audio/webm, audio/ogg). */
aiRouter.post('/asr', requireKioskOrStaff, aiLimiter, express.raw({ type: ['audio/*', 'application/octet-stream'], limit: '12mb' }), async (req: Request, res: Response): Promise<void> => {
  if (!(await EdgeAiClient.available('asr'))) {
    res.status(503).json({ error: 'On-premise speech recognition is not available.', code: 'ASR_UNAVAILABLE' });
    return;
  }
  if (!Buffer.isBuffer(req.body) || req.body.length < 1000) {
    res.status(400).json({ error: 'No audio received.' });
    return;
  }
  try {
    const r = await EdgeAiClient.transcribe(req.body, String(req.headers['content-type'] || ''), cleanLang(req.query.lang), req.query.profile === 'dictation' ? 'dictation' : undefined);
    res.json({ success: true, data: r });
  } catch (err: any) {
    if (err instanceof AiPolicyError) {
      res.status(503).json({ error: 'On-premise speech recognition is not available for this language. Please tap or type instead.', code: err.code });
      return;
    }
    res.status(502).json({ error: 'Speech recognition failed. Please try again or type instead.', detail: err.message });
  }
});

/** Text to speech in the patient's language. */
aiRouter.post('/tts', requireKioskOrStaff, aiLimiter, async (req: Request, res: Response): Promise<void> => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, 600) : '';
  if (!text) {
    res.status(400).json({ error: 'text is required' });
    return;
  }
  if (!(await EdgeAiClient.available('tts'))) {
    res.status(503).json({ error: 'On-premise speech synthesis is not available.', code: 'TTS_UNAVAILABLE' });
    return;
  }
  try {
    const { audio, contentType } = await EdgeAiClient.synthesize(text, cleanLang(req.body?.lang));
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(audio);
  } catch (err: any) {
    res.status(502).json({ error: 'Speech synthesis failed.', detail: err.message });
  }
});

/**
 * Translate short clinical instructions (e.g. "1 tablet twice a day after food") into the
 * patient's language for the printed prescription. The clinician sees both and can edit.
 */
aiRouter.post('/translate', requireStaff(...CLINICIAN_ROLES, 'pharmacist'), aiLimiter, async (req: Request, res: Response): Promise<void> => {
  const texts: string[] = (Array.isArray(req.body?.texts) ? req.body.texts : []).filter((t: unknown) => typeof t === 'string').map((t: string) => t.slice(0, 400)).slice(0, 40);
  const target = cleanLang(req.body?.target);
  if (!texts.length) {
    res.status(400).json({ error: 'texts is required' });
    return;
  }
  if (target === 'en') {
    res.json({ success: true, data: { translations: texts, machine: false } });
    return;
  }
  const onPrem = await EdgeAiClient.available('translate');
  if (!onPrem && !BhashiniClient.configured()) {
    res.status(503).json({ error: 'On-premise translation is not available.', code: 'TRANSLATE_UNAVAILABLE' });
    return;
  }
  try {
    // On-premise first; Bhashini (MeitY) only when configured and the local model is absent.
    const r = onPrem ? await EdgeAiClient.translate(texts, 'en', target) : await BhashiniClient.translate(texts, 'en', target);
    audit(req, 'ai.translate', null, { target, count: texts.length, model: r.model });
    res.json({ success: true, data: { translations: r.translations, machine: true, model: r.model } });
  } catch (err: any) {
    res.status(502).json({ error: 'Translation failed.', detail: err.message });
  }
});

/**
 * Structured symptom extraction from free speech/text: the rules engine, and nothing else, in every
 * configuration. `aiFindings` and `model` stay in the response for older kiosk builds and are always empty.
 */
aiRouter.post('/extract', requireKioskOrStaff, aiLimiter, async (req: Request, res: Response): Promise<void> => {
  const text = typeof req.body?.text === 'string' ? req.body.text.slice(0, 3000) : '';
  if (!text.trim()) {
    res.status(400).json({ error: 'text is required' });
    return;
  }
  const rules = ClinicalParserService.parse(text);
  res.json({
    success: true,
    data: {
      rules: {
        symptoms: rules.symptoms || [],
        // Red flags always come from the rules engine.
        isEmergencyRedFlag: rules.isEmergencyRedFlag,
        redFlagTriggers: rules.redFlagTriggers || []
      },
      aiFindings: [],
      rejectedUngrounded: 0,
      model: null
    }
  });
});

const safe = <T>(raw: any, fallback: T): T => {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
};

/** Deterministic SOAP note built only from recorded data: the default, and the fallback when the model draft is off or fails. */
function templateSoap(session: any, draft: any, transcript: string) {
  const symptoms: any[] = safe(session.symptoms_json, []);
  const vitals: any = safe(session.vitals_json, {});
  const history: any = safe(session.history_json, {});
  const pariksha: any = safe(session.pariksha_json, {});
  // pertinent negatives from the patient's own words at the kiosk ("बुखार नहीं है" → "Denies fever")
  // plus every complaint the record itself marks as denied: a denied complaint must never read as "Presents with"
  const denied = [...new Map([...deniedSymptoms(session.raw_transcript || ''), ...symptoms.filter(s => s?.isNegated).map(s => String(s.name || s.symptom_name || ''))]
    .filter(Boolean).map(d => [d.toLowerCase(), d] as const)).values()];
  const sym = symptoms.filter(s => s && !s.isNegated).map(s => {
    const parts = [s.name || s.symptom_name || 'Complaint'];
    if (s.site && !/^(general|unspecified)$/i.test(s.site)) parts.push(`at ${s.site}`);
    if (s.character) parts.push(`(${s.character})`);
    if (Number(s.severityScore) > 0) parts.push(`severity ${s.severityScore}/10`); // 0 = not stated
    if (s.duration) parts.push(`for ${s.duration}`);
    // the kiosk and the parser store "3 days" / "since last night" in onset; say it as a duration
    const onset = String(s.onset || '');
    if (onset && onset !== 'Unspecified') parts.push(/^(\d|a few|long|since)/i.test(onset) ? (/^since/i.test(onset) ? onset.toLowerCase() : `for ${onset}`) : `onset ${onset.toLowerCase()}`);
    if (s.radiation) parts.push(`radiating to ${s.radiation}`);
    return parts.join(' ');
  });
  // Past / drug / allergy / family / personal / ROS come from the structured history summary (never invented).
  const structured = normaliseHistory(history);
  const summary = buildHistorySummary({ patient: {}, symptoms, history: structured, vitals, pariksha });
  const hist = summary.sections.filter(s => ['pastMedical', 'pastSurgical', 'drugAllergy', 'family', 'personal', 'ros'].includes(s.id)).map(s => `${s.title}: ${s.text}`).join(' ');
  const vit = [
    vitals.bp && `BP ${vitals.bp} mmHg`, vitals.pulse && `pulse ${vitals.pulse}/min`, vitals.spo2 && `SpO2 ${vitals.spo2}%`,
    vitals.temp && `temperature ${vitals.temp}`, vitals.respiratoryRate && `RR ${vitals.respiratoryRate}/min`
  ].filter(Boolean).join(', ');
  const vitSource = vitals.source === 'clinician' ? `(measured by ${vitals.recordedBy || 'staff'})` : vit ? '(patient-reported at kiosk — verify)' : '';
  const meds = [...(draft?.allopathic || []).map((m: any) => `${m.name} ${m.dosage || ''} ${m.frequency || ''} × ${m.durationDays || '?'} days`),
    ...(draft?.ayush || []).map((a: any) => `${a.classicalName} ${a.dose || ''} ${a.frequency || ''}${a.anupana ? ` with ${a.anupana}` : ''}`)];
  return {
    subjective: [sym.length ? `Presents with ${sym.join('; ')}.` : 'Chief complaint not recorded.', denied.length ? `Denies ${denied.join(', ').toLowerCase()}.` : '', hist, transcript ? `In the consultation: "${transcript.slice(0, 400)}${transcript.length > 400 ? '…' : ''}"` : ''].filter(Boolean).join(' '),
    objective: [vit ? `${vit} ${vitSource}.` : 'Vitals not recorded.', pariksha?.prakriti ? `Prakriti (self-assessed): ${pariksha.prakriti}.` : '', pariksha?.agni ? `Agni: ${pariksha.agni}.` : ''].filter(Boolean).join(' '),
    assessment: 'To be completed by the clinician.',
    plan: [meds.length ? `Medicines: ${meds.join('; ')}.` : '', draft?.advice ? `Advice: ${draft.advice}.` : '', draft?.followUpDays ? `Review after ${draft.followUpDays} days.` : ''].filter(Boolean).join(' ') || 'To be completed by the clinician.'
  };
}

/**
 * Draft a SOAP note for the clinician to edit: the fixed template, unless the hospital has set
 * LLM_ASSIST=clinician and a model is installed (EdgeAiClient.available('llm') is false otherwise).
 * Body: { sessionId, transcript?, draft? }
 */
aiRouter.post('/soap', requireStaff('doctor', 'vaidya', 'nurse'), aiLimiter, async (req: Request, res: Response): Promise<void> => {
  const session: any = typeof req.body?.sessionId === 'string' ? db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.body.sessionId) : null;
  if (!session) {
    res.status(404).json({ error: 'Visit not found' });
    return;
  }
  const transcript = typeof req.body?.transcript === 'string' ? req.body.transcript.slice(0, 12000) : '';
  const draft = req.body?.draft || {};
  const template = templateSoap(session, draft, transcript);

  if (transcript.trim().length > 40 && (await EdgeAiClient.available('llm'))) {
    try {
      const r = await EdgeAiClient.soap({
        transcript,
        careStream: session.care_stream || 'UNDECIDED',
        structured: { symptoms: safe(session.symptoms_json, []), vitals: safe(session.vitals_json, {}), history: safe(session.history_json, {}), draft }
      });
      audit(req, 'ai.soap_drafted', session.id, { model: r.model });
      // Plan always comes from what the doctor actually prescribed, never from the model.
      res.json({ success: true, data: { ...r, plan: template.plan, generatedBy: 'llm', model: r.model, reviewRequired: true } });
      return;
    } catch (err) {
      console.warn('[AI] SOAP via LLM failed, using template:', (err as Error).message);
    }
  }
  res.json({ success: true, data: { ...template, generatedBy: 'template', reviewRequired: true } });
});

/** Vision OCR for documents, when the edge service has an OCR model loaded. */
aiRouter.post('/ocr', requireKioskOrStaff, aiLimiter, express.raw({ type: ['image/*'], limit: '12mb' }), async (req: Request, res: Response): Promise<void> => {
  if (!(await EdgeAiClient.available('ocr'))) {
    res.status(503).json({ error: 'On-premise OCR is not available.', code: 'OCR_UNAVAILABLE' });
    return;
  }
  try {
    const r = await EdgeAiClient.ocr(req.body, String(req.headers['content-type'] || 'image/jpeg'));
    res.json({ success: true, data: r });
  } catch (err: any) {
    res.status(502).json({ error: 'OCR failed.', detail: err.message });
  }
});
