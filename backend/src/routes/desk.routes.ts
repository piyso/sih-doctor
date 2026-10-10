/**
 * Doctor / Vaidya desk utilities, mounted under /api/doctor (see doctor.routes.ts).
 */

import express, { Router, Request, Response } from 'express';
import { db } from '../db/database';
import { requireStaff } from '../security/middleware';
import { CLINICIAN_ROLES } from '../security/config';
import { audit } from '../security/audit';
import { publish } from '../services/eventBus.service';
import {
  claimSession, releaseClaim, getDraft, saveDraft, deleteDraft, patientTimeline, seenToday, favourites, listOrderSets, saveOrderSet,
  deleteOrderSet, prescribingQuality, alertOutcomes, createAdrReport, listAdrReports, markAdrSubmitted, listNotifiable,
  markNotifiableSubmitted, ihipWeekly, recordRecordingConsent, recordingConsent, consentActive, logScribeUsage, RECORDING_NOTICE_VERSION, INVESTIGATIONS
} from '../services/doctorDesk.service';
import { EdgeAiClient } from '../services/edgeAi.client';
import { rateLimit } from '../security/middleware';
import { TerminologyService } from '../services/terminology.service';
import { DRUG_CONCEPTS, REVIEW_STATUS } from '../services/safety/drugDictionary';
import { AYUSH_FORMULATIONS, AYUSH_INGREDIENTS } from '../services/safety/ayushDictionary';
import { BANNED_FDCS } from '../services/safety/bannedFdc';
import { ESignService, BhashiniClient } from '../services/externalSigning.service';
import { cleanName } from '../services/safety/resolver';
import { formulationFlags, constituentsWithFlag, ayushIngredientById } from '../services/safety/ayushDictionary';
import { COMMON_DOSES, COMMON_AYUSH_DOSES } from '../services/safety/commonDoses';

export const deskRouter = Router();
const prescribers = requireStaff('doctor', 'vaidya');
const clinicians = requireStaff(...CLINICIAN_ROLES);

const wrap = (fn: (req: Request, res: Response) => void | Promise<void>) => async (req: Request, res: Response) => {
  try { await fn(req, res); } catch (err: any) { res.status(Number(err.status) || 400).json({ error: err.message || 'Request failed', ...(err.code ? { code: err.code } : {}) }); }
};

// ── Claims ──────────────────────────────────────────────────────────────────
deskRouter.post('/encounter/:sessionId/claim', clinicians, wrap((req, res) => {
  const r = claimSession(String(req.params.sessionId), req.staff!, req.body?.takeOver === true);
  if (!r.ok && !r.claimedBy) { res.status(404).json({ error: 'Visit not found' }); return; }
  if (!r.ok) { res.status(409).json({ error: `${r.claimedBy!.name} is already seeing this patient.`, code: 'CLAIMED_BY_OTHER', claimedBy: r.claimedBy }); return; }
  audit(req, 'queue.claimed', String(req.params.sessionId), { takeOver: req.body?.takeOver === true });
  publish({ type: 'queue.changed', reason: 'claimed', sessionId: String(req.params.sessionId) });
  res.json({ success: true, claimedBy: r.claimedBy });
}));
deskRouter.delete('/encounter/:sessionId/claim', clinicians, wrap((req, res) => {
  const ok = releaseClaim(String(req.params.sessionId), req.staff!);
  publish({ type: 'queue.changed', reason: 'released', sessionId: String(req.params.sessionId) });
  res.json({ success: ok });
}));

// ── Drafts (survive refresh / another workstation) ─────────────────────────
deskRouter.get('/drafts/:sessionId', clinicians, wrap((req, res) => { res.json({ success: true, data: getDraft(String(req.params.sessionId), req.staff!.id) }); }));
deskRouter.put('/drafts/:sessionId', clinicians, wrap((req, res) => {
  const exists = db.prepare('SELECT 1 FROM sessions WHERE id = ?').get(String(req.params.sessionId));
  if (!exists) { res.status(404).json({ error: 'Visit not found' }); return; }
  res.json({ success: true, updatedAt: saveDraft(String(req.params.sessionId), req.staff!.id, req.body?.draft) });
}));
deskRouter.delete('/drafts/:sessionId', clinicians, wrap((req, res) => { deleteDraft(String(req.params.sessionId), req.staff!.id); res.json({ success: true }); }));

// ── Patient timeline, the doctor's day, favourites ─────────────────────────
deskRouter.get('/patient/:patientId/timeline', clinicians, wrap((req, res) => {
  audit(req, 'record.view_timeline', null, { patientId: String(req.params.patientId) });
  res.json({ success: true, data: patientTimeline(String(req.params.patientId)) });
}));
deskRouter.get('/seen-today', clinicians, wrap((req, res) => { res.json({ success: true, data: seenToday(req.staff!.id) }); }));
deskRouter.get('/favourites', prescribers, wrap((req, res) => {
  const stream = req.query.stream === 'AYURVEDA' || (req.staff!.role === 'vaidya' && req.query.stream !== 'ALLOPATHY') ? 'AYURVEDA' : 'ALLOPATHY';
  res.json({ success: true, data: favourites(req.staff!.id, stream) });
}));

// ── Order sets ──────────────────────────────────────────────────────────────
deskRouter.get('/order-sets', clinicians, wrap((req, res) => {
  const stream = req.query.stream === 'AYURVEDA' || req.query.stream === 'ALLOPATHY' ? String(req.query.stream) : undefined;
  res.json({ success: true, data: listOrderSets(req.staff!.id, stream) });
}));
deskRouter.post('/order-sets', prescribers, wrap((req, res) => { res.json({ success: true, id: saveOrderSet(req.staff!.id, req.body) }); }));
deskRouter.put('/order-sets/:id', prescribers, wrap((req, res) => { res.json({ success: true, id: saveOrderSet(req.staff!.id, req.body, String(req.params.id)) }); }));
deskRouter.delete('/order-sets/:id', prescribers, wrap((req, res) => { res.json({ success: deleteOrderSet(req.staff!.id, String(req.params.id)) }); }));

// ── Catalogues and search ───────────────────────────────────────────────────
deskRouter.get('/investigations', clinicians, wrap((_req, res) => { res.json({ success: true, data: INVESTIGATIONS }); }));

/**
 * Diagnosis search across the terminology index. Seed NAMASTE rows carry placeholder codes
 * (AYU-…) until the official export is imported; they are returned with codeVerified=false so
 * the record keeps the term and the real ICD-10/SNOMED mapping but never the placeholder code.
 */
deskRouter.get('/diagnosis-search', clinicians, wrap((req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) { res.json({ success: true, data: [] }); return; }
  const hits = TerminologyService.search(q, { limit: 12 }).filter(h => h.system === 'NAMASTE' || h.system === 'ICD-11-TM2' || (h.system as string) === 'ICD-11-MMS');
  res.json({
    success: true,
    data: hits.map(h => {
      const placeholder = /^AYU-/i.test(h.code);
      return {
        display: h.mapping.english && h.system === 'NAMASTE' ? `${h.term} (${h.mapping.english})` : h.term,
        term: h.term, english: h.mapping.english, system: h.system, code: h.code, codeVerified: !placeholder,
        icd10: h.mapping.icd10, icd11: h.mapping.icd11, snomed: h.mapping.snomed, score: h.score,
        provenance: placeholder ? 'Demo seed term (placeholder code) — import the official NAMASTE export' : 'Imported terminology'
      };
    }),
    terminology: TerminologyService.stats()
  });
}));

/**
 * Formulary search over the safety dictionary (generic first; brands shown as "also sold as").
 * Returns usual starting regimens where known, as editable defaults.
 */
deskRouter.get('/formulary/search', clinicians, wrap((req, res) => {
  const q = cleanName(String(req.query.q || ''));
  const stream = req.query.stream === 'AYURVEDA' ? 'AYURVEDA' : 'ALLOPATHY';
  if (q.length < 2) { res.json({ success: true, data: [] }); return; }
  const score = (names: string[]) => {
    let best = 0;
    for (const n of names.map(cleanName)) {
      if (!n) continue;
      if (n === q) best = Math.max(best, 100);
      else if (n.startsWith(q)) best = Math.max(best, 80 - Math.min(20, n.length - q.length));
      else if (n.split(/[\s+\-]+/).some(w => w.startsWith(q))) best = Math.max(best, 60);
      else if (q.length >= 4 && n.includes(q)) best = Math.max(best, 40);
    }
    return best;
  };
  if (stream === 'ALLOPATHY') {
    // Single-ingredient generics rank above combinations that start the same way.
    // A medicine is a hit only when its own name, id or a brand matches; essential-list status and being a
    // combination only reorder the hits. (Adding the bonus first made every essential medicine a "hit" for any
    // text at all, so an unknown name followed by Enter picked Paracetamol.)
    const hits = DRUG_CONCEPTS.map(c => ({ c, name: score([c.inn, c.id.replace(/_/g, ' '), ...(c.synonyms || [])]) }))
      .filter(x => x.name > 0)
      .map(({ c, name }) => ({ c, s: name + (c.nlem ? 3 : 0) - (c.ingredients || / \+ /.test(c.inn) ? 8 : 0) }))
      .sort((a, b) => b.s - a.s).slice(0, 12)
      .map(({ c }) => {
        const brandHit = (c.synonyms || []).find(sy => cleanName(sy).startsWith(q) && !cleanName(c.inn).startsWith(q));
        return {
          id: c.id, generic: c.inn, isCombination: !!c.ingredients || / \+ /.test(c.inn), matchedBrand: brandHit || undefined,
          brands: (c.synonyms || []).filter(sy => !/[+]/.test(sy) && sy.length > 3 && sy !== c.inn.toLowerCase()).slice(0, 4),
          aware: c.aware, schedule: c.schedule, ndps: !!c.ndps, nlem: !!c.nlem, highAlert: !!c.highAlert,
          defaults: COMMON_DOSES[c.id] || (c.ingredients ? undefined : undefined)
        };
      });
    res.json({ success: true, data: hits });
    return;
  }
  const hits = AYUSH_FORMULATIONS.map(f => ({ f, s: score([f.name, ...f.aliases]) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 12)
    .map(({ f }) => {
      const flags = formulationFlags(f);
      return {
        id: f.id, name: f.name, form: f.form, external: !!f.external,
        keyConstituents: f.constituents.map(id => ayushIngredientById(id)?.name || id),
        scheduleE1: flags.has('schedule_e1') ? constituentsWithFlag(f, 'schedule_e1') : [],
        heavyMetal: flags.has('mineral_heavy_metal'), alcohol: flags.has('alcohol'),
        defaults: COMMON_AYUSH_DOSES[f.id]
      };
    });
  res.json({ success: true, data: hits });
}));

// ── Prescribing quality and alert outcomes ─────────────────────────────────
deskRouter.get('/prescribing-quality', clinicians, wrap((req, res) => {
  const scope = req.query.scope === 'hospital' ? 'hospital' : 'me';
  if (scope === 'hospital' && !['admin', 'doctor', 'vaidya'].includes(req.staff!.role)) { res.status(403).json({ error: 'Not allowed' }); return; }
  res.json({ success: true, scope, data: prescribingQuality({ staffId: scope === 'me' ? req.staff!.id : undefined, days: Number(req.query.days) || 30 }) });
}));
deskRouter.get('/alert-outcomes', requireStaff('admin', 'doctor', 'vaidya'), wrap((req, res) => { res.json({ success: true, data: alertOutcomes(Number(req.query.days) || 90) }); }));

deskRouter.get('/safety/status', clinicians, wrap((_req, res) => {
  res.json({
    success: true,
    data: {
      drugConcepts: DRUG_CONCEPTS.length,
      ayushFormulations: AYUSH_FORMULATIONS.length,
      ayushIngredients: AYUSH_INGREDIENTS.length,
      bannedFdcEntries: BANNED_FDCS.length,
      reviewStatus: REVIEW_STATUS,
      legalSignature: ESignService.status(),
      bhashini: BhashiniClient.configured() ? 'configured' : 'not configured'
    }
  });
}));

// ── Adverse drug reactions ──────────────────────────────────────────────────
deskRouter.post('/adr', clinicians, wrap((req, res) => {
  const r = createAdrReport(req.body, req.staff!);
  audit(req, 'pharmacovigilance.adr_created', r.id, { channel: r.channel });
  res.json({ success: true, data: r });
}));
deskRouter.get('/adr', requireStaff(...CLINICIAN_ROLES, 'pharmacist'), wrap((req, res) => { res.json({ success: true, data: listAdrReports(req.query.patientId ? String(req.query.patientId) : undefined) }); }));
deskRouter.post('/adr/:id/submitted', requireStaff(...CLINICIAN_ROLES, 'pharmacist'), wrap((req, res) => {
  const ok = markAdrSubmitted(String(req.params.id), String(req.body?.referenceNo || ''));
  audit(req, 'pharmacovigilance.adr_submitted', String(req.params.id));
  res.json({ success: ok });
}));

// ── Notifiable diseases (Nikshay) and IHIP ──────────────────────────────────
deskRouter.get('/notifiable', clinicians, wrap((req, res) => { res.json({ success: true, data: listNotifiable(req.query.status ? String(req.query.status) : undefined) }); }));
deskRouter.post('/notifiable/:id/submitted', clinicians, wrap((req, res) => {
  const ok = markNotifiableSubmitted(String(req.params.id), String(req.body?.referenceNo || ''), req.staff!);
  audit(req, 'public_health.notified', String(req.params.id), { referenceNo: req.body?.referenceNo || null });
  res.json({ success: ok });
}));
deskRouter.get('/ihip/weekly', requireStaff('admin', 'doctor', 'vaidya'), wrap((req, res) => {
  const d = req.query.weekStart ? String(req.query.weekStart) : (() => { const t = new Date(); t.setDate(t.getDate() - ((t.getDay() + 6) % 7) - 7); return t.toISOString().slice(0, 10); })();
  res.json({ success: true, data: ihipWeekly(d) });
}));

// ── Scribe: recording consent and transcription (per visit) ────────────────
/** Consent event for room recording: { event: given | declined | withdrawn, consenter, consenterName, relationship, noticeLanguage, othersInformed }. */
deskRouter.post('/encounter/:sessionId/recording-consent', clinicians, wrap((req, res) => {
  const sessionId = String(req.params.sessionId);
  const b = req.body || {};
  const event = typeof b.event === 'string' ? b.event : b.given === true ? 'given' : 'declined';
  recordRecordingConsent(sessionId, { event, consenter: b.consenter, consenterName: b.consenterName, relationship: b.relationship, noticeLanguage: b.noticeLanguage, othersInformed: b.othersInformed === true, method: b.method }, req.staff!);
  audit(req, 'consent.recording', sessionId, { event, consenter: b.consenter || 'patient', noticeVersion: RECORDING_NOTICE_VERSION, noticeLanguage: b.noticeLanguage || null });
  publish({ type: 'queue.changed', reason: 'recording_consent', sessionId });
  res.json({ success: true, data: recordingConsent(sessionId) });
}));

const SCRIBE_LANGS = ['en', 'hi', 'mr', 'bn', 'ta', 'te', 'gu', 'kn', 'ml', 'pa', 'or'];
const scribeLimiter = rateLimit('scribe', 120, 60_000);
/**
 * Transcribes one clip for the desk scribe on the hospital's own speech server. Audio is passed
 * through in memory and never stored; only the mode and length are logged. Room clips are refused
 * unless the patient's consent for this visit is on record and not withdrawn — checked here, not
 * only on the screen. Dictation (the clinician's own push-to-talk) needs no consent.
 */
deskRouter.post('/encounter/:sessionId/scribe/transcribe', prescribers, scribeLimiter,
  express.raw({ type: ['audio/*', 'application/octet-stream'], limit: '12mb' }), wrap(async (req, res) => {
    const sessionId = String(req.params.sessionId);
    const mode = req.query.mode === 'room' ? 'room' : 'dictation';
    const lang = SCRIBE_LANGS.includes(String(req.query.lang)) ? String(req.query.lang) : 'hi';
    const visit: any = db.prepare('SELECT id, status FROM sessions WHERE id = ?').get(sessionId);
    if (!visit) { res.status(404).json({ error: 'Visit not found' }); return; }
    if (mode === 'room' && !consentActive(sessionId)) {
      res.status(403).json({ error: 'Room recording needs the patient’s consent for this visit (none on record, declined or withdrawn).', code: 'RECORDING_CONSENT_REQUIRED' });
      return;
    }
    if (!Buffer.isBuffer(req.body) || req.body.length < 1000) { res.status(400).json({ error: 'No audio received.' }); return; }
    if (!(await EdgeAiClient.available('asr'))) {
      res.status(503).json({ error: 'The hospital speech server is not running.', code: 'ASR_UNAVAILABLE' });
      return;
    }
    // Dictation uses the medicine-name vocabulary; room conversation does not (boosting drug names there would make the
    // engine "hear" medicines nobody prescribed).
    const r: any = await EdgeAiClient.transcribe(req.body, String(req.headers['content-type'] || ''), lang, mode === 'dictation' ? 'dictation' : undefined);
    logScribeUsage(sessionId, req.staff!.id, mode, Number(r?.durationSec) || 0, lang);
    if (mode === 'room') audit(req, 'scribe.room_clip', sessionId, { seconds: Number(r?.durationSec) || 0, lang });
    res.json({ success: true, data: {
      text: String(r?.text || ''), alternatives: Array.isArray(r?.alternatives) ? r.alternatives.map(String) : [], durationSec: Number(r?.durationSec) || 0,
      engine: r?.engine, language: lang, mode, speech: r?.speech !== false, ...(r?.rejected ? { rejected: String(r.rejected) } : {})
    } });
  }));
