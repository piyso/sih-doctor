/**
 * AI-assisted features, served by the on-premise Edge AI service with rule-based fallbacks.
 *
 * Safety rules that apply to every endpoint here:
 *  - AI output is a suggestion. Kiosk findings must be confirmed by the patient; notes and
 *    translations must be reviewed by the clinician before they are saved or printed.
 *  - Triage, red flags, drug interactions and doses are NEVER decided by a language model; they
 *    stay with the deterministic rules.
 *  - Extracted findings must quote the patient's own words (grounding); anything that does not
 *    appear in the input is discarded as a hallucination.
 */

import express, { Router, Request, Response } from 'express';
import { db } from '../db/database';
import { requireKioskOrStaff, requireStaff, rateLimit } from '../security/middleware';
import { CLINICIAN_ROLES } from '../security/config';
import { audit } from '../security/audit';
import { EdgeAiClient } from '../services/edgeAi.client';
import { ClinicalParserService } from '../services/clinicalParser.service';
import { normaliseHistory, buildHistorySummary } from '../services/clinicalHistory.service';
import { deniedSymptoms } from '../services/intakeExtraction.service';

export const aiRouter = Router();
const aiLimiter = rateLimit('ai', 60, 60_000);

const LANGS = ['en', 'hi', 'mr', 'bn', 'ta', 'te', 'gu', 'kn', 'ml', 'pa', 'or'];
const cleanLang = (l: unknown) => (typeof l === 'string' && LANGS.includes(l) ? l : 'hi');

aiRouter.get('/status', requireKioskOrStaff, async (_req: Request, res: Response): Promise<void> => {
  res.json({ success: true, data: await EdgeAiClient.status() });
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
    const r = await EdgeAiClient.transcribe(req.body, String(req.headers['content-type'] || ''), cleanLang(req.query.lang));
    res.json({ success: true, data: r });
  } catch (err: any) {
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
  if (!(await EdgeAiClient.available('translate'))) {
    res.status(503).json({ error: 'On-premise translation is not available.', code: 'TRANSLATE_UNAVAILABLE' });
    return;
  }
  try {
    const r = await EdgeAiClient.translate(texts, 'en', target);
    audit(req, 'ai.translate', null, { target, count: texts.length, model: r.model });
    res.json({ success: true, data: { translations: r.translations, machine: true, model: r.model } });
  } catch (err: any) {
    res.status(502).json({ error: 'Translation failed.', detail: err.message });
  }
});

/** Normalise for grounding checks: lower-case, collapse whitespace and punctuation. */
const norm = (s: string) => s.toLowerCase().normalize('NFC').replace(/[\s.,!?;:।॥"'()-]+/g, ' ').trim();

/**
 * Structured symptom extraction from free speech/text.
 * Rules run first; the LLM (when present) can only ADD findings, each grounded in the input.
 */
aiRouter.post('/extract', requireKioskOrStaff, aiLimiter, async (req: Request, res: Response): Promise<void> => {
  const text = typeof req.body?.text === 'string' ? req.body.text.slice(0, 3000) : '';
  const lang = cleanLang(req.body?.lang);
  if (!text.trim()) {
    res.status(400).json({ error: 'text is required' });
    return;
  }
  const rules = ClinicalParserService.parse(text);
  let aiFindings: any[] = [];
  let model: string | undefined;
  let rejected = 0;

  if (await EdgeAiClient.available('llm')) {
    try {
      const r = await EdgeAiClient.extract(text, lang);
      model = r.model;
      const hay = norm(text);
      for (const f of Array.isArray(r.findings) ? r.findings : []) {
        const evidence = typeof f?.evidence === 'string' ? norm(f.evidence) : '';
        const name = typeof f?.symptom === 'string' ? f.symptom.trim().slice(0, 60) : '';
        const severity = Number(f?.severity);
        // Grounding: the quoted words must really be in what the patient said.
        if (!name || evidence.length < 2 || !hay.includes(evidence)) { rejected++; continue; }
        aiFindings.push({
          symptom: name,
          bodyPart: typeof f.bodyPart === 'string' ? f.bodyPart.slice(0, 40) : null,
          side: ['left', 'right', 'both'].includes(f.side) ? f.side : null,
          severity: Number.isFinite(severity) && severity >= 0 && severity <= 10 ? Math.round(severity) : null,
          durationDays: Number.isFinite(Number(f.durationDays)) && Number(f.durationDays) >= 0 ? Number(f.durationDays) : null,
          negated: f.negated === true,
          evidence: f.evidence,
          source: 'ai',
          needsConfirmation: true
        });
      }
      // Drop anything the rules already found.
      const known = new Set((rules.symptoms || []).map((s: any) => norm(String(s.name || ''))));
      aiFindings = aiFindings.filter(f => !known.has(norm(f.symptom)));
    } catch (err) {
      console.warn('[AI] extract failed, using rules only:', (err as Error).message);
    }
  }

  res.json({
    success: true,
    data: {
      rules: {
        symptoms: rules.symptoms || [],
        // Red flags always come from the rules engine.
        isEmergencyRedFlag: rules.isEmergencyRedFlag,
        redFlagTriggers: rules.redFlagTriggers || []
      },
      aiFindings,
      rejectedUngrounded: rejected,
      model: model || null
    }
  });
});

const safe = <T>(raw: any, fallback: T): T => {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
};

/** Deterministic SOAP note built only from recorded data (used when no LLM is available). */
function templateSoap(session: any, draft: any, transcript: string) {
  const symptoms: any[] = safe(session.symptoms_json, []);
  const vitals: any = safe(session.vitals_json, {});
  const history: any = safe(session.history_json, {});
  const pariksha: any = safe(session.pariksha_json, {});
  // pertinent negatives from the patient's own words at the kiosk ("बुखार नहीं है" → "Denies fever")
  const denied = deniedSymptoms(session.raw_transcript || '');
  const sym = symptoms.map(s => {
    const parts = [s.name || s.symptom_name || 'Complaint'];
    if (s.site && s.site !== 'General') parts.push(`at ${s.site}`);
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
 * Draft a SOAP note for the clinician to edit. Uses the LLM when available, the template otherwise.
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
