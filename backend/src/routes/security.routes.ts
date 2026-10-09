/**
 * Integrity, privacy and physical-presence endpoints.
 *
 * Everything here verifies something real or refuses:
 *  - offline seal: Ed25519 signature over the canonical record, checked with the hospital key;
 *  - ZKP verifier: Groth16/BN128 proof supplied by the caller, no bundled sample fallback;
 *  - provenance chain: hash-chained encounter nodes;
 *  - gate nonce: HMAC with a key derived from the hospital's field-encryption key;
 *  - proximity: geofence and Wi-Fi strength from values the client actually sent.
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/database';
import { ZkProofService } from '../services/zkProof.service';
import { SovereignNERService } from '../services/sovereignNER.service';
import { EdgeAiClient } from '../services/edgeAi.client';
import { PiyGraphService } from '../services/piygraph.service';
import { loadCalibration } from '../services/pacConformalGate.service';
import { verifyRecord, SIGNING_KEY_ID, getPublicKeyPem, RecordSignature } from '../security/recordSigning';
import { deriveKey } from '../security/fieldCrypto';
import { verifyAuditChain, audit } from '../security/audit';
import drugInteractions from '../shared/drug_interactions.json';

export const securityRouter = Router();

function diagnostics() {
  const cal = loadCalibration();
  const graph = PiyGraphService.getGraphStats();
  return {
    cognitiveEngine: {
      connected: true,
      path: 'backend/src/services/core (plain TypeScript, no bundled code)',
      subsystems: [
        `Knowledge graph: ${graph.nodeCount} nodes, ${graph.edgeCount} cited edges`,
        `Interaction registry: ${drugInteractions.interactions.length} rules + WHO ATC / AFI constituent ontology`,
        'Beta-Binomial evidence engine with Savage-Dickey Bayes factor (H0: theta = 0.5)',
        cal?.guaranteed ? `Split-conformal suggestion gate: n=${cal.n}, alpha=${cal.alpha}, q-hat=${cal.qHat.toFixed(3)}` : 'Split-conformal suggestion gate: not calibrated (suggestions withheld)'
      ],
      graph,
      conformal: cal ? { calibrated: cal.guaranteed, n: cal.n, alpha: cal.alpha, qHat: cal.qHat, source: cal.source } : { calibrated: false }
    },
    integrityLedger: {
      connected: true,
      path: 'backend/src/security (Ed25519 record signatures, SHA-256 audit chain, provenance chain)',
      protocol: 'Ed25519 over canonical JSON + SHA-256 hash chains',
      signingKeyId: SIGNING_KEY_ID,
      auditChain: verifyAuditChain(),
      provenanceChain: ZkProofService.verifyFullMerkleChain()
    }
  };
}

/** GET /api/security/diagnostics (alias: /lever-diagnostics) */
const diagnosticsHandler = async (_req: Request, res: Response): Promise<void> => {
  const edge = await EdgeAiClient.status();
  const caps = Object.entries(edge.capabilities).filter(([, v]) => v.available).map(([k, v]) => `${k}: ${v.model || 'ready'}`);
  res.json({
    success: true,
    diagnostics: {
      ...diagnostics(),
      speechPipeline: {
        connected: edge.online,
        path: 'edge-ai/ (sherpa-onnx ASR; on-premise, no external calls)',
        subsystems: caps.length ? caps : ['Edge AI service offline: rule-based fallbacks active'],
        device: edge.device || null
      }
    }
  });
};
securityRouter.get('/diagnostics', diagnosticsHandler);
securityRouter.get('/lever-diagnostics', diagnosticsHandler);

/** Public key so any party can verify a printed or exported record. */
securityRouter.get('/signing-key', (_req: Request, res: Response): void => {
  res.json({ keyId: SIGNING_KEY_ID, algorithm: 'Ed25519', publicKeyPem: getPublicKeyPem() });
});

/**
 * POST /api/security/verify-zkp (alias /zkp/verify)
 * Groth16/BN128 verification of a proof the caller supplies. Nothing is verified without a proof.
 */
const handleZkpVerify = async (req: Request, res: Response): Promise<void> => {
  const { proof, publicSignals } = req.body || {};
  if (!proof || !Array.isArray(publicSignals)) {
    res.status(400).json({ success: false, error: 'proof and publicSignals are required; this endpoint does not hold sample proofs.' });
    return;
  }
  const r = await ZkProofService.verifyProof(proof, publicSignals);
  res.json({
    success: true,
    verified: r.isValid,
    status: r.isValid ? 'VERIFIED_VALID' : 'VERIFIED_INVALID',
    reason: r.reason,
    protocol: 'Groth16',
    curve: 'BN128 (alt_bn128)',
    verificationLatencyMs: r.latencyMs,
    publicSignals,
    note: 'The bundled circuit (integrity_check.circom) proves knowledge of a, b with a*b = product. It does not bind a clinical record; record integrity is established by the Ed25519 signature and the provenance chain.'
  });
};
securityRouter.post('/verify-zkp', handleZkpVerify);
securityRouter.post('/zkp/verify', handleZkpVerify);

/** POST /api/security/redact: de-identify free text (DPDP). */
securityRouter.post('/redact', (req: Request, res: Response): void => {
  const { text } = req.body || {};
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'text is required' });
    return;
  }
  res.json({ success: true, data: SovereignNERService.deIdentifyText(text) });
});

/** GET /api/security/verify-merkle: walk the whole provenance chain. */
securityRouter.get('/verify-merkle', (_req: Request, res: Response): void => {
  res.json({ success: true, data: ZkProofService.verifyFullMerkleChain() });
});

// ---------- Physical presence at the hospital gate ----------

const GATE_KEY = deriveKey('gate-nonce-v1');
const GATE_ID = process.env.HOSPITAL_GATE_ID || 'GATE-01-MAIN-LOBBY';
const gateSig = (nonce: string, expires: number) => crypto.createHmac('sha256', GATE_KEY).update(`${nonce}:${expires}`).digest('hex').slice(0, 32);

/** GET /api/security/gate-nonce: 60-second rotating token for the lobby display QR. */
securityRouter.get('/gate-nonce', (_req: Request, res: Response): void => {
  const nonce = crypto.randomBytes(8).toString('hex');
  const now = Date.now();
  const expires = now + 60_000;
  const token = `gate1_${nonce}_${expires}_${gateSig(nonce, expires)}`;
  res.json({ success: true, gateId: GATE_ID, nonce, timestamp: now, expiresAt: expires, validDurationSec: 60, token });
});

/** POST /api/security/validate-gate-nonce */
securityRouter.post('/validate-gate-nonce', (req: Request, res: Response): void => {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const parts = token.split('_');
  if (parts.length !== 4 || parts[0] !== 'gate1') {
    res.json({ valid: false, reason: 'Invalid token structure' });
    return;
  }
  const [, nonce, expiresRaw, sig] = parts;
  const expires = parseInt(expiresRaw, 10);
  if (!Number.isFinite(expires) || Date.now() > expires) {
    res.json({ valid: false, reason: 'Gate QR expired (>60s). Scan the live lobby display again.' });
    return;
  }
  const expected = gateSig(nonce, expires);
  const ok = sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!ok) {
    res.json({ valid: false, reason: 'Signature mismatch: not a token issued by this hospital.' });
    return;
  }
  res.json({ valid: true, gateId: GATE_ID, timeRemainingSec: Math.max(0, Math.floor((expires - Date.now()) / 1000)), message: 'Live gate token verified.' });
});

/**
 * POST /api/security/verify-proximity
 * Geofence (Haversine) plus Wi-Fi RSSI, from values the device actually measured. Missing values
 * are a 400, never a pass. Anchor and thresholds come from the environment.
 */
const ANCHOR = { lat: Number(process.env.HOSPITAL_LAT) || 28.5284, lng: Number(process.env.HOSPITAL_LNG) || 77.2917 };
const GEOFENCE_M = Number(process.env.HOSPITAL_GEOFENCE_M) || 150;
const MIN_RSSI = Number(process.env.HOSPITAL_MIN_RSSI_DBM) || -68;

securityRouter.post('/verify-proximity', (req: Request, res: Response): void => {
  const lat = Number(req.body?.latitude);
  const lng = Number(req.body?.longitude);
  const rssi = Number(req.body?.rssiDbm ?? req.body?.rssiDb);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || !Number.isFinite(rssi)) {
    res.status(400).json({ authorized: false, withinPerimeter: false, reason: 'latitude, longitude and rssiDbm are required (measured on the device).' });
    return;
  }
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371e3;
  const dPhi = toRad(ANCHOR.lat - lat);
  const dLambda = toRad(ANCHOR.lng - lng);
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(ANCHOR.lat)) * Math.sin(dLambda / 2) ** 2;
  const distanceMeters = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  const inGeofence = distanceMeters <= GEOFENCE_M;
  const rssiOk = rssi >= MIN_RSSI;
  const authorized = inGeofence && rssiOk;
  res.json({
    authorized,
    withinPerimeter: authorized,
    distanceMeters,
    rssiDb: rssi,
    rssiDbm: rssi,
    thresholds: { geofenceMeters: GEOFENCE_M, minRssiDbm: MIN_RSSI },
    campusAnchor: { facility: process.env.HOSPITAL_SHORT_NAME || 'Hospital', latitude: ANCHOR.lat, longitude: ANCHOR.lng },
    perimeterType: authorized ? 'GEOFENCE_AND_WIFI_AUTHENTIC' : 'OUTSIDE_CAMPUS_REJECTED',
    perimeterStatus: authorized ? 'INSIDE_HOSPITAL_RADIUS' : !inGeofence ? 'OUTSIDE_GEOFENCE_RADIUS' : 'WIFI_SIGNAL_TOO_WEAK_MOVE_INSIDE',
    reason: authorized ? undefined : !inGeofence ? `Device is ${distanceMeters} m from the hospital anchor (limit ${GEOFENCE_M} m).` : `Wi-Fi signal ${rssi} dBm is weaker than ${MIN_RSSI} dBm.`
  });
});

// ---------- Offline prescription seal ----------

/**
 * POST /api/security/verify-offline-seal
 * Body: { record, signature } (as returned by /api/doctor/prescribe) or { encounterId }.
 * Optional `simulateTamper: true` alters one field of a copy before checking, for demonstrations.
 * Verification needs only the hospital public key, so it works with no network.
 */
securityRouter.post('/verify-offline-seal', (req: Request, res: Response): void => {
  let record: any = req.body?.record ?? req.body?.prescriptionPayload;
  let signature: RecordSignature | undefined = req.body?.signature ?? req.body?.proofBadge?.signature;
  const encounterId = typeof req.body?.encounterId === 'string' ? req.body.encounterId : null;
  if (encounterId) {
    const row: any = db.prepare('SELECT case_sheet_json, signature_json FROM encounters WHERE id = ?').get(encounterId);
    if (!row) {
      res.status(404).json({ success: false, error: 'Encounter not found' });
      return;
    }
    record = JSON.parse(row.case_sheet_json);
    signature = row.signature_json ? JSON.parse(row.signature_json) : undefined;
  }
  if (!record || typeof record !== 'object' || !signature) {
    res.status(400).json({ success: false, error: 'record and signature are required (or an encounterId with a signed record).' });
    return;
  }
  const t0 = performance.now();
  let checked = record;
  if (req.body?.simulateTamper === true) {
    checked = JSON.parse(JSON.stringify(record));
    checked.doctorNotes = `${checked.doctorNotes || ''} [tampered]`;
  }
  const v = verifyRecord(checked, signature);
  const prescriptionHash = crypto.createHash('sha256').update(JSON.stringify(checked)).digest('hex');
  const chainNodes = encounterId ? ZkProofService.nodesForEncounter(encounterId) : [];
  const verification = {
    authentic: v.valid,
    tamperDetected: !v.valid,
    details: v.valid ? 'Signature verifies against the hospital public key; the record is unchanged since it was finalized.' : v.reason || 'Signature does not verify.',
    algorithm: 'Ed25519',
    hashAlgorithm: 'SHA-256',
    keyId: signature.keyId,
    signedAt: signature.signedAt,
    signedBy: signature.signedBy,
    recordSha256: signature.recordSha256,
    prescriptionHash,
    pharmacistLockout: !v.valid,
    provenanceNode: chainNodes[0]?.nodeHash || null,
    pairingLatencyMs: parseFloat((performance.now() - t0).toFixed(2)),
    proofProtocol: 'Ed25519 signature (offline verifiable)',
    curve: 'Curve25519'
  };
  if (req.staff || req.kioskDevice) audit(req, 'record.seal_verified', encounterId, { valid: v.valid, simulateTamper: req.body?.simulateTamper === true });
  res.json({ success: true, isValid: v.valid, ...verification, verification });
});
