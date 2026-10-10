/**
 * ABDM Health Information Provider (HIP) layer: care-context linking, consent artefacts, and
 * health-information requests answered with encrypted FHIR bundles.
 *
 * Flows implemented (ABDM Gateway v0.5 / HIP milestone M2):
 *  1. Care contexts: every finalized OPD visit of an ABHA-linked patient becomes a care context
 *     (reference = encounter id, display = "OPD visit <date>"). With gateway credentials the HIP
 *     calls /v0.5/links/link/add-contexts; without them the context is queued as PENDING_GATEWAY.
 *  2. Consent: the gateway posts a consent artefact to /v0.5/consents/hip/notify. It is stored and
 *     acknowledged on /v0.5/consents/hip/on-notify. Only artefacts whose patient has given the
 *     local DPDP `abha_link` consent are honoured.
 *  3. Health information: the gateway posts /v0.5/health-information/hip/request with the HIU's
 *     key material and a dataPushUrl. The HIP answers on-request, builds the FHIR bundles for the
 *     consented care contexts inside the date range, encrypts each with the ECDH (Curve25519) +
 *     HKDF-SHA256 + AES-256-GCM scheme ABDM specifies ("Fidelius"), posts the entries to the
 *     dataPushUrl, then notifies /v0.5/health-information/notify.
 *
 * Interop note: key material follows the Fidelius reference (32-byte Curve25519 keys and
 * 32-byte nonces, salt = first 20 bytes and IV = last 12 bytes of senderNonce XOR receiverNonce).
 * Verify against the sandbox before go-live; `simulateHiuExchange` runs the full loop locally so
 * the exchange can be demonstrated and tested without sandbox credentials.
 */

import crypto from 'crypto';
import { db } from '../db/database';
import { AbdmClient } from './abdm.client';
import { FhirGeneratorService } from './fhirGenerator.service';
import { effectiveConsent } from '../security/privacy.service';
import { appendAudit } from '../security/audit';
import { localDate } from './hospitalRouting.service';
import { realOnly } from './sampleData';

db.exec(`
  CREATE TABLE IF NOT EXISTS abdm_care_contexts (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    session_id TEXT,
    encounter_id TEXT UNIQUE,
    abha_address TEXT,
    abha_number TEXT,
    reference TEXT NOT NULL,
    display TEXT NOT NULL,
    hi_types_json TEXT NOT NULL,
    link_status TEXT NOT NULL,
    gateway_request_id TEXT,
    created_at TEXT NOT NULL,
    linked_at TEXT,
    error TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_abdm_cc_patient ON abdm_care_contexts(patient_id);
  CREATE TABLE IF NOT EXISTS abdm_consents (
    consent_id TEXT PRIMARY KEY,
    patient_id TEXT,
    abha_address TEXT NOT NULL,
    hi_types_json TEXT NOT NULL,
    date_from TEXT NOT NULL,
    date_to TEXT NOT NULL,
    data_erase_at TEXT,
    care_context_refs_json TEXT NOT NULL,
    status TEXT NOT NULL,
    artefact_json TEXT NOT NULL,
    received_at TEXT NOT NULL,
    revoked_at TEXT
  );
  CREATE TABLE IF NOT EXISTS abdm_hi_requests (
    transaction_id TEXT PRIMARY KEY,
    consent_id TEXT NOT NULL,
    request_id TEXT,
    status TEXT NOT NULL,
    entries_pushed INTEGER DEFAULT 0,
    error TEXT,
    requested_at TEXT NOT NULL,
    completed_at TEXT
  );
`);

export const HI_TYPES = ['OPConsultation', 'Prescription', 'DiagnosticReport', 'DischargeSummary', 'ImmunizationRecord', 'HealthDocumentRecord', 'WellnessRecord'] as const;
export type HiType = typeof HI_TYPES[number];

// ---------------------------------------------------------------- Fidelius-style envelope

export interface KeyMaterial {
  cryptoAlg: 'ECDH';
  curve: 'Curve25519';
  dhPublicKey: { expiry: string; parameters: string; keyValue: string }; // base64 raw 32-byte X25519 public key
  nonce: string; // base64 32 bytes
}

export interface KeyPairMaterial { keyMaterial: KeyMaterial; privateKey: crypto.KeyObject }

const rawX25519Public = (key: crypto.KeyObject): Buffer => {
  const jwk = key.export({ format: 'jwk' }) as { x: string };
  return Buffer.from(jwk.x, 'base64url');
};

export function importX25519Public(b64: string): crypto.KeyObject {
  const buf = Buffer.from(b64, 'base64');
  if (buf.length === 32) return crypto.createPublicKey({ key: { kty: 'OKP', crv: 'X25519', x: buf.toString('base64url') }, format: 'jwk' });
  return crypto.createPublicKey({ key: buf, format: 'der', type: 'spki' }); // some implementations send X.509 SPKI
}

export function generateKeyMaterial(expiryMinutes = 60): KeyPairMaterial {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');
  return {
    privateKey,
    keyMaterial: {
      cryptoAlg: 'ECDH', curve: 'Curve25519',
      dhPublicKey: { expiry: new Date(Date.now() + expiryMinutes * 60000).toISOString(), parameters: 'Curve25519/32byte random key', keyValue: rawX25519Public(publicKey).toString('base64') },
      nonce: crypto.randomBytes(32).toString('base64')
    }
  };
}

function deriveAesKey(privateKey: crypto.KeyObject, peerPublicB64: string, senderNonceB64: string, receiverNonceB64: string): { key: Buffer; iv: Buffer } {
  const shared = crypto.diffieHellman({ privateKey, publicKey: importX25519Public(peerPublicB64) });
  const a = Buffer.from(senderNonceB64, 'base64');
  const b = Buffer.from(receiverNonceB64, 'base64');
  const xor = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) xor[i] = a[i] ^ b[i];
  const salt = xor.subarray(0, 20);
  const iv = xor.subarray(20, 32);
  const key = Buffer.from(crypto.hkdfSync('sha256', shared, salt, Buffer.alloc(0), 32));
  return { key, iv };
}

/** Encrypt a payload for the receiver (HIU) with our private key and both nonces. */
export function encryptEnvelope(plain: string, sender: KeyPairMaterial, receiver: KeyMaterial): string {
  const { key, iv } = deriveAesKey(sender.privateKey, receiver.dhPublicKey.keyValue, sender.keyMaterial.nonce, receiver.nonce);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final(), cipher.getAuthTag()]);
  return enc.toString('base64');
}

/** Decrypt as the receiver: our private key, the sender's public key and nonce. */
export function decryptEnvelope(cipherB64: string, receiver: KeyPairMaterial, sender: KeyMaterial): string {
  const { key, iv } = deriveAesKey(receiver.privateKey, sender.dhPublicKey.keyValue, sender.nonce, receiver.keyMaterial.nonce);
  const buf = Buffer.from(cipherB64, 'base64');
  const tag = buf.subarray(buf.length - 16);
  const data = buf.subarray(0, buf.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export const md5 = (s: string) => crypto.createHash('md5').update(s).digest('hex');

// ---------------------------------------------------------------- Care contexts

export interface CareContextRow {
  id: string; patientId: string; sessionId: string | null; encounterId: string | null; abhaAddress: string | null; abhaNumber: string | null;
  reference: string; display: string; hiTypes: HiType[]; linkStatus: 'PENDING_CONSENT' | 'PENDING_GATEWAY' | 'LINK_REQUESTED' | 'LINKED' | 'FAILED'; createdAt: string; linkedAt: string | null; error: string | null;
}

const toCc = (r: any): CareContextRow => ({
  id: r.id, patientId: r.patient_id, sessionId: r.session_id, encounterId: r.encounter_id, abhaAddress: r.abha_address, abhaNumber: r.abha_number,
  reference: r.reference, display: r.display, hiTypes: JSON.parse(r.hi_types_json || '[]'), linkStatus: r.link_status, createdAt: r.created_at, linkedAt: r.linked_at, error: r.error
});

export const AbdmHipService = {
  status() {
    const counts = Object.fromEntries((db.prepare(`SELECT link_status, COUNT(*) AS n FROM abdm_care_contexts WHERE ${realOnly('patient_id')} GROUP BY link_status`).all() as any[]).map(r => [r.link_status, r.n]));
    return {
      gateway: AbdmClient.mode,
      configured: AbdmClient.isConfigured,
      hipId: process.env.ABDM_HIP_ID || null,
      careContexts: counts,
      consents: (db.prepare(`SELECT COUNT(*) AS n FROM abdm_consents WHERE status = 'GRANTED' AND revoked_at IS NULL AND ${realOnly('patient_id')}`).get() as any).n,
      hiRequests: (db.prepare('SELECT status, COUNT(*) AS n FROM abdm_hi_requests GROUP BY status').all() as any[]).reduce((a, r) => ({ ...a, [r.status]: r.n }), {}),
      encryption: 'ECDH Curve25519 + HKDF-SHA256 + AES-256-GCM (Fidelius profile)'
    };
  },

  /** Register a finalized encounter as a care context (idempotent). Needs ABHA + local abha_link consent. */
  registerCareContext(input: { patientId: string; sessionId?: string | null; encounterId: string; hiTypes?: HiType[]; at?: string }): CareContextRow | null {
    const p: any = db.prepare('SELECT id, abha_id, abha_address FROM patients WHERE id = ?').get(input.patientId);
    if (!p || (!p.abha_address && !p.abha_id)) return null;
    const consent = effectiveConsent(input.patientId);
    const existing: any = db.prepare('SELECT * FROM abdm_care_contexts WHERE encounter_id = ?').get(input.encounterId);
    if (existing) return toCc(existing);
    const row = {
      id: `cc-${crypto.randomBytes(6).toString('hex')}`, patient_id: input.patientId, session_id: input.sessionId || null, encounter_id: input.encounterId,
      abha_address: p.abha_address || null, abha_number: p.abha_id || null, reference: input.encounterId,
      display: `OPD visit ${localDate(input.at ? new Date(input.at) : new Date())}`,
      hi_types_json: JSON.stringify(input.hiTypes || ['OPConsultation', 'Prescription']),
      link_status: !consent.abha_link ? 'PENDING_CONSENT' : AbdmClient.isConfigured ? 'LINK_REQUESTED' : 'PENDING_GATEWAY',
      created_at: new Date().toISOString()
    };
    db.prepare(`INSERT INTO abdm_care_contexts (id, patient_id, session_id, encounter_id, abha_address, abha_number, reference, display, hi_types_json, link_status, created_at)
      VALUES (@id, @patient_id, @session_id, @encounter_id, @abha_address, @abha_number, @reference, @display, @hi_types_json, @link_status, @created_at)`).run(row);
    appendAudit({ action: 'abdm.care_context_registered', entityId: row.id, actor: 'system', metadata: { encounterId: input.encounterId, status: row.link_status } });
    return toCc(db.prepare('SELECT * FROM abdm_care_contexts WHERE id = ?').get(row.id));
  },

  careContextsFor(patientId: string): CareContextRow[] {
    return (db.prepare('SELECT * FROM abdm_care_contexts WHERE patient_id = ? ORDER BY created_at DESC').all(patientId) as any[]).map(toCc);
  },

  /** HIP-initiated linking: POST /v0.5/links/link/add-contexts. Returns the gateway request id or a queued status. */
  async linkCareContext(id: string): Promise<CareContextRow> {
    const cc: any = db.prepare('SELECT * FROM abdm_care_contexts WHERE id = ?').get(id);
    if (!cc) throw new Error('Care context not found');
    if (cc.link_status === 'PENDING_CONSENT') throw new Error('Patient has not consented to ABHA linking');
    if (!AbdmClient.isConfigured) {
      db.prepare("UPDATE abdm_care_contexts SET link_status = 'PENDING_GATEWAY' WHERE id = ?").run(id);
      return toCc(db.prepare('SELECT * FROM abdm_care_contexts WHERE id = ?').get(id));
    }
    const requestId = crypto.randomUUID();
    try {
      await AbdmClient.gatewayPost('/v0.5/links/link/add-contexts', {
        requestId, timestamp: new Date().toISOString(),
        link: {
          accessToken: process.env.ABDM_LINK_TOKEN || undefined,
          patient: { referenceNumber: cc.patient_id, display: 'Patient', careContexts: [{ referenceNumber: cc.reference, display: cc.display }] }
        }
      });
      db.prepare("UPDATE abdm_care_contexts SET link_status = 'LINK_REQUESTED', gateway_request_id = ?, error = NULL WHERE id = ?").run(requestId, id);
    } catch (err: any) {
      db.prepare("UPDATE abdm_care_contexts SET link_status = 'FAILED', error = ? WHERE id = ?").run(String(err.message).slice(0, 200), id);
    }
    return toCc(db.prepare('SELECT * FROM abdm_care_contexts WHERE id = ?').get(id));
  },

  /** Gateway callback for a link acknowledgement (on-add-contexts). */
  markLinked(gatewayRequestId: string, ok: boolean, error?: string): number {
    return db.prepare(`UPDATE abdm_care_contexts SET link_status = ?, linked_at = ?, error = ? WHERE gateway_request_id = ?`)
      .run(ok ? 'LINKED' : 'FAILED', ok ? new Date().toISOString() : null, error || null, gatewayRequestId).changes;
  },

  // ---------------------------------------------------------------- Consent artefacts

  /** Store a consent artefact from /v0.5/consents/hip/notify. Returns what to acknowledge. */
  handleConsentNotify(payload: any): { consentId: string; status: 'GRANTED' | 'REVOKED' | 'EXPIRED' | 'DENIED'; accepted: boolean; reason?: string } {
    const n = payload?.notification || {};
    const consentId = String(n.consentId || n.consentDetail?.consentId || '');
    const status = String(n.status || 'GRANTED').toUpperCase() as any;
    if (!consentId) throw new Error('notification.consentId is required');
    if (status === 'REVOKED' || status === 'EXPIRED') {
      db.prepare('UPDATE abdm_consents SET status = ?, revoked_at = ? WHERE consent_id = ?').run(status, new Date().toISOString(), consentId);
      appendAudit({ action: 'abdm.consent_updated', entityId: consentId, actor: 'gateway', metadata: { status } });
      return { consentId, status, accepted: true };
    }
    const d = n.consentDetail || {};
    const abhaAddress = String(d.patient?.id || '');
    const hiTypes: string[] = Array.isArray(d.hiTypes) ? d.hiTypes.filter((t: string) => (HI_TYPES as readonly string[]).includes(t)) : [];
    const refs: string[] = Array.isArray(d.careContexts) ? d.careContexts.map((c: any) => String(c.careContextReference || '')).filter(Boolean) : [];
    const from = d.permission?.dateRange?.from || '';
    const to = d.permission?.dateRange?.to || '';
    if (!abhaAddress || !hiTypes.length || !from || !to) throw new Error('consentDetail must carry patient.id, hiTypes and permission.dateRange');
    // A consent from the gateway is about a real person: it never attaches to a sample record in Real mode.
    const patient: any = db.prepare(`SELECT id FROM patients WHERE (abha_address = ? OR abha_id = ?) AND ${realOnly('id')}`).get(abhaAddress, abhaAddress);
    const localConsent = patient ? effectiveConsent(patient.id) : null;
    const accepted = !!patient && !!localConsent?.abha_link;
    db.prepare(`INSERT INTO abdm_consents (consent_id, patient_id, abha_address, hi_types_json, date_from, date_to, data_erase_at, care_context_refs_json, status, artefact_json, received_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(consent_id) DO UPDATE SET status = excluded.status, artefact_json = excluded.artefact_json, received_at = excluded.received_at, revoked_at = NULL`)
      .run(consentId, patient?.id || null, abhaAddress, JSON.stringify(hiTypes), from, to, d.permission?.dataEraseAt || null, JSON.stringify(refs), accepted ? 'GRANTED' : 'DENIED', JSON.stringify(d), new Date().toISOString());
    appendAudit({ action: 'abdm.consent_received', entityId: consentId, actor: 'gateway', metadata: { accepted, hiTypes, careContexts: refs.length } });
    return { consentId, status: accepted ? 'GRANTED' : 'DENIED', accepted, reason: accepted ? undefined : patient ? 'Patient withdrew ABHA-linking consent at this hospital' : 'Unknown patient at this HIP' };
  },

  consents(limit = 50) {
    return (db.prepare(`SELECT * FROM abdm_consents WHERE ${realOnly('patient_id')} ORDER BY received_at DESC LIMIT ?`).all(limit) as any[]).map(r => ({
      consentId: r.consent_id, patientId: r.patient_id, abhaAddress: r.abha_address, hiTypes: JSON.parse(r.hi_types_json), dateFrom: r.date_from, dateTo: r.date_to,
      dataEraseAt: r.data_erase_at, careContextRefs: JSON.parse(r.care_context_refs_json), status: r.status, receivedAt: r.received_at, revokedAt: r.revoked_at
    }));
  },

  // ---------------------------------------------------------------- Health information

  /** Bundles for the care contexts a consent covers, within its date range. */
  bundlesForConsent(consentId: string): Array<{ careContextReference: string; bundle: any; hiType: string }> {
    const c: any = db.prepare('SELECT * FROM abdm_consents WHERE consent_id = ?').get(consentId);
    if (!c || c.status !== 'GRANTED' || c.revoked_at) throw new Error('No granted consent with that id');
    if (new Date(c.date_to).getTime() < Date.now() - 365 * 86400000 * 5) throw new Error('Consent date range is implausible');
    const refs: string[] = JSON.parse(c.care_context_refs_json || '[]');
    const hiTypes: string[] = JSON.parse(c.hi_types_json || '[]');
    const rows: any[] = db.prepare(`
      SELECT e.id, e.fhir_bundle_json, e.created_at FROM encounters e JOIN abdm_care_contexts cc ON cc.encounter_id = e.id
      WHERE cc.patient_id = ? AND e.created_at >= ? AND e.created_at <= ? ${refs.length ? `AND cc.reference IN (${refs.map(() => '?').join(',')})` : ''}
      ORDER BY e.created_at ASC
    `).all(c.patient_id, c.date_from, c.date_to, ...refs);
    const hiType = hiTypes.includes('OPConsultation') ? 'OPConsultation' : hiTypes[0];
    return rows.filter(r => r.fhir_bundle_json).map(r => ({ careContextReference: r.id, bundle: JSON.parse(r.fhir_bundle_json), hiType }));
  },

  /**
   * Serve /v0.5/health-information/hip/request: encrypt the consented bundles for the HIU and push
   * them. `push` is injectable so the exchange can run in-process for tests and demos.
   */
  async handleHiRequest(payload: any, push?: (url: string, body: any) => Promise<void>): Promise<{ transactionId: string; entries: number; status: 'TRANSFERRED' | 'FAILED' | 'ERRORED'; error?: string; senderKeyMaterial?: KeyMaterial }> {
    const hi = payload?.hiRequest || {};
    const transactionId = String(payload?.transactionId || '');
    const consentId = String(hi.consent?.id || '');
    if (!transactionId || !consentId || !hi.dataPushUrl || !hi.keyMaterial?.dhPublicKey?.keyValue || !hi.keyMaterial?.nonce) throw new Error('transactionId, hiRequest.consent.id, dataPushUrl and keyMaterial are required');
    db.prepare(`INSERT INTO abdm_hi_requests (transaction_id, consent_id, request_id, status, requested_at) VALUES (?, ?, ?, 'ACKNOWLEDGED', ?)
      ON CONFLICT(transaction_id) DO UPDATE SET status = 'ACKNOWLEDGED', requested_at = excluded.requested_at`).run(transactionId, consentId, payload?.requestId || null, new Date().toISOString());
    try {
      const bundles = this.bundlesForConsent(consentId);
      const from = hi.dateRange?.from ? new Date(hi.dateRange.from).getTime() : -Infinity;
      const to = hi.dateRange?.to ? new Date(hi.dateRange.to).getTime() : Infinity;
      const inRange = bundles.filter(b => { const t = new Date(b.bundle.timestamp).getTime(); return t >= from && t <= to; });
      const sender = generateKeyMaterial();
      const receiver: KeyMaterial = hi.keyMaterial;
      const entries = inRange.map(b => {
        const plain = JSON.stringify(b.bundle);
        return { content: encryptEnvelope(plain, sender, receiver), media: 'application/fhir+json', checksum: md5(plain), careContextReference: b.careContextReference };
      });
      const body = { pageNumber: 1, pageCount: 1, transactionId, entries, keyMaterial: sender.keyMaterial };
      const doPush = push || (async (url: string, b: any) => {
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b), signal: AbortSignal.timeout(15000) });
        if (!r.ok) throw new Error(`dataPushUrl responded ${r.status}`);
      });
      await doPush(String(hi.dataPushUrl), body);
      db.prepare("UPDATE abdm_hi_requests SET status = 'TRANSFERRED', entries_pushed = ?, completed_at = ? WHERE transaction_id = ?").run(entries.length, new Date().toISOString(), transactionId);
      appendAudit({ action: 'abdm.health_information_pushed', entityId: transactionId, actor: 'gateway', metadata: { consentId, entries: entries.length } });
      if (AbdmClient.isConfigured) {
        await AbdmClient.gatewayPost('/v0.5/health-information/notify', {
          requestId: crypto.randomUUID(), timestamp: new Date().toISOString(),
          notification: { consentId, transactionId, doneAt: new Date().toISOString(), notifier: { type: 'HIP', id: process.env.ABDM_HIP_ID || 'HIP' }, statusNotification: { sessionStatus: 'TRANSFERRED', hipId: process.env.ABDM_HIP_ID || 'HIP', statusResponses: entries.map(e => ({ careContextReference: e.careContextReference, hiStatus: 'OK' })) } }
        }).catch(() => undefined);
      }
      return { transactionId, entries: entries.length, status: 'TRANSFERRED', senderKeyMaterial: sender.keyMaterial };
    } catch (err: any) {
      db.prepare("UPDATE abdm_hi_requests SET status = 'ERRORED', error = ?, completed_at = ? WHERE transaction_id = ?").run(String(err.message).slice(0, 200), new Date().toISOString(), transactionId);
      return { transactionId, entries: 0, status: 'ERRORED', error: err.message };
    }
  },

  /**
   * Local end-to-end demonstration: act as an HIU, grant a consent for the patient's care contexts,
   * request health information, receive the encrypted entries in-process, decrypt them and validate
   * the bundles. Nothing leaves the machine.
   */
  async simulateHiuExchange(patientId: string): Promise<{ consentId: string; transactionId: string; entries: number; decryptedBundles: Array<{ careContextReference: string; valid: boolean; resourceTypes: Record<string, number>; checksumOk: boolean }>; status: string }> {
    const p: any = db.prepare('SELECT id, abha_address, abha_id FROM patients WHERE id = ?').get(patientId);
    if (!p) throw new Error('Patient not found');
    const abha = p.abha_address || p.abha_id;
    if (!abha) throw new Error('Patient has no ABHA address or number on file');
    const ccs = this.careContextsFor(patientId);
    if (!ccs.length) throw new Error('No care contexts for this patient (finalize a visit first)');
    const consentId = `demo-consent-${crypto.randomBytes(4).toString('hex')}`;
    const ack = this.handleConsentNotify({
      notification: { consentId, status: 'GRANTED', consentDetail: {
        consentId, patient: { id: abha }, hiTypes: ['OPConsultation', 'Prescription'],
        careContexts: ccs.map(c => ({ patientReference: patientId, careContextReference: c.reference })),
        permission: { accessMode: 'VIEW', dateRange: { from: new Date(Date.now() - 365 * 86400000).toISOString(), to: new Date(Date.now() + 86400000).toISOString() }, dataEraseAt: new Date(Date.now() + 30 * 86400000).toISOString(), frequency: { unit: 'HOUR', value: 1, repeats: 0 } }
      } }
    });
    if (!ack.accepted) throw new Error(`Consent not honoured: ${ack.reason}`);
    const hiu = generateKeyMaterial();
    let received: any = null;
    const transactionId = crypto.randomUUID();
    const result = await this.handleHiRequest({
      requestId: crypto.randomUUID(), timestamp: new Date().toISOString(), transactionId,
      hiRequest: { consent: { id: consentId }, dateRange: { from: new Date(Date.now() - 365 * 86400000).toISOString(), to: new Date(Date.now() + 86400000).toISOString() }, dataPushUrl: 'local://hiu', keyMaterial: hiu.keyMaterial }
    }, async (_url, body) => { received = body; });
    if (result.status !== 'TRANSFERRED' || !received) throw new Error(result.error || 'push failed');
    const decryptedBundles = received.entries.map((e: any) => {
      const plain = decryptEnvelope(e.content, hiu, received.keyMaterial);
      const bundle = JSON.parse(plain);
      const v = FhirGeneratorService.validateBundle(bundle);
      return { careContextReference: e.careContextReference, valid: v.valid, resourceTypes: v.resourceCounts, checksumOk: md5(plain) === e.checksum };
    });
    return { consentId, transactionId, entries: received.entries.length, decryptedBundles, status: result.status };
  }
};
