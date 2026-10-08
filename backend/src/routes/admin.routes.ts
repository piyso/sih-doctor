/**
 * Administration: staff accounts, kiosk devices, audit log, patient-rights requests (DPDP),
 * backups and analytics. Admin role only (analytics also open to clinicians).
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/database';
import { requireStaff } from '../security/middleware';
import { securityConfig, StaffRole } from '../security/config';
import { AuthService } from '../security/auth.service';
import { audit, verifyAuditChain } from '../security/audit';
import { exportPatientData, eraseIdentifiers, withdrawConsent, effectiveConsent, runRetention, CONSENT_PURPOSES, ConsentPurpose } from '../security/privacy.service';
import { SIGNING_KEY_ID, getPublicKeyPem, verifyRecord } from '../security/recordSigning';
import { runBackup, listBackups } from '../services/backup.service';
import { getOperationalSnapshot, getDailyTrend, getSyndromicSignals, getPrescribingSafety, getFollowUpAdherence } from '../services/analytics.service';
import { SmsService } from '../services/sms.service';
import { EdgeAiClient } from '../services/edgeAi.client';

export const adminRouter = Router();

// ---------- Analytics (admin + clinicians) ----------

adminRouter.get('/analytics', requireStaff('admin', 'doctor', 'vaidya', 'nurse'), (_req: Request, res: Response): void => {
  res.json({
    success: true,
    data: {
      snapshot: getOperationalSnapshot(),
      trend: getDailyTrend(14),
      syndromicSignals: getSyndromicSignals(),
      prescribingSafety: getPrescribingSafety(30),
      followUp: getFollowUpAdherence()
    }
  });
});

/** Anyone with the record can check its signature; the public key is not secret. */
adminRouter.get('/signing-key', (_req: Request, res: Response): void => {
  res.json({ keyId: SIGNING_KEY_ID, algorithm: 'Ed25519', publicKeyPem: getPublicKeyPem() });
});

adminRouter.get('/verify-encounter/:encounterId', requireStaff('admin', 'doctor', 'vaidya', 'nurse', 'pharmacist'), (req: Request, res: Response): void => {
  const e: any = db.prepare('SELECT case_sheet_json, signature_json FROM encounters WHERE id = ?').get(String(req.params.encounterId));
  if (!e) {
    res.status(404).json({ error: 'Prescription not found' });
    return;
  }
  if (!e.signature_json) {
    res.json({ valid: false, reason: 'This record was created before digital signatures were enabled.' });
    return;
  }
  res.json(verifyRecord(JSON.parse(e.case_sheet_json), JSON.parse(e.signature_json)));
});

// Everything below: administrators only.
adminRouter.use(requireStaff('admin'));

// ---------- Staff ----------

adminRouter.get('/users', (_req: Request, res: Response): void => {
  res.json({ success: true, data: AuthService.listUsers() });
});

adminRouter.post('/users', (req: Request, res: Response): void => {
  try {
    const { username, displayName, role, pin, department, qualification, registrationNo } = req.body || {};
    if ((role === 'doctor' || role === 'vaidya') && !String(registrationNo || '').trim()) {
      res.status(400).json({ error: 'Doctors and vaidyas need a medical council registration number (printed on prescriptions).' });
      return;
    }
    const user = AuthService.createUser({ username, displayName, role: role as StaffRole, pin, department, qualification, registrationNo, mustChangePin: true });
    audit(req, 'admin.user_created', user.id, { username: user.username, role: user.role });
    res.json({ success: true, data: user });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.patch('/users/:id', (req: Request, res: Response): void => {
  try {
    if (String(req.params.id) === req.staff!.id && (req.body?.active === false || (req.body?.role && req.body.role !== 'admin'))) {
      res.status(400).json({ error: 'You cannot deactivate or demote your own account.' });
      return;
    }
    const user = AuthService.updateUser(String(req.params.id), req.body || {});
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    audit(req, 'admin.user_updated', user.id, { fields: Object.keys(req.body || {}) });
    res.json({ success: true, data: user });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.post('/users/:id/reset-pin', (req: Request, res: Response): void => {
  try {
    if (!AuthService.getUser(String(req.params.id))) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    AuthService.setPin(String(req.params.id), String(req.body?.pin || ''), true);
    AuthService.revokeAllSessions(String(req.params.id));
    audit(req, 'admin.pin_reset', String(req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- Kiosk devices ----------

adminRouter.get('/devices', (_req: Request, res: Response): void => {
  res.json({ success: true, data: db.prepare(`
    SELECT id, name, location, printer_host AS printerHost, enrolled_by AS enrolledBy, created_at AS createdAt,
           last_seen_at AS lastSeenAt, revoked_at AS revokedAt FROM kiosk_devices ORDER BY created_at DESC
  `).all() });
});

/** Returns the device token ONCE; the kiosk stores it. It cannot be shown again. */
adminRouter.post('/devices', (req: Request, res: Response): void => {
  try {
    const { device, token } = AuthService.enrollDevice(String(req.body?.name || ''), req.body?.location, req.staff!.id);
    if (typeof req.body?.printerHost === 'string' && req.body.printerHost.trim()) {
      db.prepare('UPDATE kiosk_devices SET printer_host = ? WHERE id = ?').run(req.body.printerHost.trim().slice(0, 80), device.id);
    }
    audit(req, 'admin.device_enrolled', device.id, { name: device.name });
    res.json({ success: true, device, token });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.patch('/devices/:id', (req: Request, res: Response): void => {
  const r = db.prepare('UPDATE kiosk_devices SET printer_host = ?, location = COALESCE(?, location) WHERE id = ?')
    .run(String(req.body?.printerHost || '').trim().slice(0, 80) || null, req.body?.location ?? null, String(req.params.id));
  if (!r.changes) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }
  audit(req, 'admin.device_updated', String(req.params.id));
  res.json({ success: true });
});

adminRouter.delete('/devices/:id', (req: Request, res: Response): void => {
  if (!AuthService.revokeDevice(String(req.params.id))) {
    res.status(404).json({ error: 'Device not found or already revoked' });
    return;
  }
  audit(req, 'admin.device_revoked', String(req.params.id));
  res.json({ success: true });
});

// ---------- Audit ----------

adminRouter.get('/audit', (req: Request, res: Response): void => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const where: string[] = [];
  const args: any[] = [];
  if (req.query.entity) { where.push('entity_id = ?'); args.push(String(req.query.entity)); }
  if (req.query.actor) { where.push('actor = ?'); args.push(String(req.query.actor)); }
  if (req.query.action) { where.push('action LIKE ?'); args.push(`${String(req.query.action)}%`); }
  if (req.query.outcome) { where.push('outcome = ?'); args.push(String(req.query.outcome)); }
  const rows = db.prepare(`
    SELECT a.id, a.action, a.entity_id AS entityId, a.actor, a.actor_role AS actorRole, a.ip, a.outcome, a.metadata_json AS metadata, a.created_at AS createdAt,
           u.display_name AS actorName
    FROM audit_logs a LEFT JOIN staff_users u ON u.id = a.actor
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY a.id DESC LIMIT ?
  `).all(...args, limit) as any[];
  res.json({ success: true, data: rows.map(r => ({ ...r, metadata: r.metadata ? JSON.parse(r.metadata) : null })) });
});

adminRouter.get('/audit/verify', (_req: Request, res: Response): void => {
  res.json({ success: true, data: verifyAuditChain() });
});

// ---------- Patient rights (DPDP) ----------

adminRouter.get('/patients', (req: Request, res: Response): void => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) {
    res.json({ success: true, data: [] });
    return;
  }
  const rows = db.prepare(`
    SELECT id, name, age, gender, phone_masked AS phoneMasked, abha_id AS abhaId, created_at AS createdAt, erased_at AS erasedAt,
      (SELECT COUNT(*) FROM sessions s WHERE s.patient_id = patients.id) AS visits
    FROM patients WHERE name LIKE ? OR abha_id = ? OR phone_masked LIKE ? ORDER BY created_at DESC LIMIT 25
  `).all(`%${q}%`, q, `%${q.replace(/\D/g, '').slice(-4) || '#'}`) as any[];
  audit(req, 'privacy.patient_search', null, { q: q.slice(0, 3) + '…' });
  res.json({ success: true, data: rows.map(r => ({ ...r, consent: effectiveConsent(r.id) })) });
});

adminRouter.get('/patients/:id/export', (req: Request, res: Response): void => {
  const data = exportPatientData(String(req.params.id));
  if (!data) {
    res.status(404).json({ error: 'Patient not found' });
    return;
  }
  audit(req, 'privacy.data_exported', String(req.params.id));
  res.setHeader('Content-Disposition', `attachment; filename="patient-${String(req.params.id)}.json"`);
  res.json(data);
});

adminRouter.post('/patients/:id/erase', (req: Request, res: Response): void => {
  if (req.body?.confirm !== 'ERASE') {
    res.status(400).json({ error: 'Type ERASE to confirm.' });
    return;
  }
  if (!eraseIdentifiers(String(req.params.id), req.staff!.id, typeof req.body?.note === 'string' ? req.body.note : undefined)) {
    res.status(404).json({ error: 'Patient not found' });
    return;
  }
  res.json({ success: true });
});

adminRouter.post('/patients/:id/withdraw-consent', (req: Request, res: Response): void => {
  const purposes = (Array.isArray(req.body?.purposes) ? req.body.purposes : []).filter((p: string) => (CONSENT_PURPOSES as readonly string[]).includes(p)) as ConsentPurpose[];
  if (!purposes.length) {
    res.status(400).json({ error: `purposes must include one of ${CONSENT_PURPOSES.join(', ')}` });
    return;
  }
  withdrawConsent(String(req.params.id), purposes, req.staff!.id);
  res.json({ success: true, consent: effectiveConsent(String(req.params.id)) });
});

// ---------- Operations ----------

adminRouter.post('/retention/run', (req: Request, res: Response): void => {
  const result = runRetention();
  audit(req, 'admin.retention_run', null, result);
  res.json({ success: true, data: result });
});

adminRouter.get('/backups', (_req: Request, res: Response): void => {
  res.json({ success: true, data: listBackups() });
});

adminRouter.post('/backups', async (req: Request, res: Response): Promise<void> => {
  try {
    const r = await runBackup();
    audit(req, 'admin.backup_now', null, { bytes: r.bytes });
    res.json({ success: true, data: { file: r.file.split(/[\\/]/).pop(), bytes: r.bytes } });
  } catch (err: any) {
    res.status(500).json({ error: `Backup failed: ${err.message}` });
  }
});

adminRouter.get('/sms-log', (_req: Request, res: Response): void => {
  res.json({ success: true, provider: SmsService.provider, data: SmsService.recent(100) });
});

adminRouter.get('/system', async (_req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    data: {
      environment: securityConfig.isProduction ? 'production' : 'development',
      demoData: securityConfig.allowDemo,
      kioskEnrollmentRequired: !securityConfig.kioskOpen,
      corsOrigins: securityConfig.corsOrigins,
      signingKeyId: SIGNING_KEY_ID,
      smsProvider: SmsService.provider,
      edgeAi: await EdgeAiClient.status(),
      auditChain: verifyAuditChain(),
      backups: listBackups().slice(0, 3),
      retention: {
        draftHours: securityConfig.draftRetentionHours,
        abandonedVisitDays: securityConfig.abandonedSessionDays,
        clinicalYears: securityConfig.clinicalRetentionYears
      }
    }
  });
});
