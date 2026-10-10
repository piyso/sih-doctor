/**
 * Hospital OS backend: application factory.
 *
 * `createServer()` builds the Express app, the HTTP server and the ambient-scribe WebSocket
 * endpoint without listening, so the same code runs under `npm run dev`, in Docker, and inside
 * the HTTP integration battery (tests/http_api.test.ts) on an ephemeral port.
 */

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { db } from './db/database';
import { ensureStaffAccounts } from './db/demoStaff';
import { initDemoMode } from './services/demoMode.service';
import { hideSampleRecords } from './services/sampleData';
import { systemRouter } from './routes/system.routes';
import { kioskRouter } from './routes/kiosk.routes';
import { documentsRouter } from './routes/documents.routes';
import { doctorRouter } from './routes/doctor.routes';
import { contraindicationsRouter } from './routes/contraindications.routes';
import { abdmRouter } from './routes/abdm.routes';
import { securityRouter } from './routes/security.routes';
import { ashaRouter } from './routes/asha.routes';
import { authRouter } from './routes/auth.routes';
import { adminRouter } from './routes/admin.routes';
import { queueRouter } from './routes/queue.routes';
import { alertsRouter } from './routes/alerts.routes';
import { printRouter } from './routes/print.routes';
import { aiRouter } from './routes/ai.routes';
import { interviewRouter } from './routes/interview.routes';
import { abdmHipRouter } from './routes/abdmHip.routes';
import { retrievalRouter } from './routes/retrieval.routes';
import { retrievalOrchestrator } from './services/retrieval/orchestrator';
import { ClinicalParserService } from './services/clinicalParser.service';
import { PiyGraphService } from './services/piygraph.service';
import { AudioVadPipelineService } from './services/audioVadPipeline.service';
import { PhoneticNormalizerService } from './services/phoneticNormalizer.service';
import { securityConfig, CLINICIAN_ROLES } from './security/config';
import { securityHeaders, corsMiddleware, authenticate, requireKioskOrStaff, requireStaff, rateLimit, errorHandler } from './security/middleware';
import { redeemStreamTicket } from './security/auth.service';
import { startRetentionSchedule } from './security/privacy.service';
import { startBackupSchedule } from './services/backup.service';
import { startFollowUpReminders } from './services/followUpReminders.service';
import { SCHEMA_VERSION } from './db/migrations';

export const APP_VERSION = '2.2.0';

/** Demonstration mode (stored choice, demo patients or parked demo visits) and staff accounts. */
export function prepareData(): void {
  try {
    initDemoMode();
    ensureStaffAccounts();
  } catch (e) {
    console.warn('[Database] Startup data check notice:', e);
  }
}

export function createApp(): express.Express {
  const app = express();
  PiyGraphService.initialize();

  if (securityConfig.trustProxy) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.use(corsMiddleware);
  // Large bodies only where images are uploaded; everything else is small JSON.
  app.use(['/api/documents', '/api/asha/sync'], express.json({ limit: '15mb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(authenticate);
  app.use('/api', hideSampleRecords); // Real mode: a request that names a sample record gets 404
  // Per-client budget (a busy doctor desk polls + streams). Long-lived event streams are exempt.
  const apiLimiter = rateLimit('api', 1500, 60_000);
  app.use('/api', (req, res, next) => (req.path.endsWith('/stream') || req.path === '/queue/events' ? next() : apiLimiter(req, res, next)));

  // In production never send internal error text (SQL, stack traces) to the browser.
  if (securityConfig.isProduction) {
    app.use((_req, res, next) => {
      const json = res.json.bind(res);
      res.json = (body: any) => {
        if (res.statusCode >= 500 && body && typeof body === 'object' && 'error' in body) {
          console.error('[Server] 5xx response:', body.error);
          return json({ error: 'Something went wrong on the server. Please try again.' });
        }
        return json(body);
      };
      next();
    });
  }

  app.get(['/health', '/api/health'], (_req, res) => {
    let dbOk = true;
    try { db.prepare('SELECT 1').get(); } catch { dbOk = false; }
    res.status(dbOk ? 200 : 503).json({ status: dbOk ? 'HEALTHY' : 'DEGRADED', service: 'Hospital OS', version: APP_VERSION, schemaVersion: SCHEMA_VERSION, database: dbOk ? 'ok' : 'error', uptimeSeconds: Math.round(process.uptime()) });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/system', systemRouter); // demonstration-mode status (public) and switch (administrator)
  app.use('/api/admin', adminRouter);
  app.use('/api/kiosk/interview', requireKioskOrStaff, interviewRouter);
  app.use('/api/kiosk', requireKioskOrStaff, kioskRouter);
  app.use('/api/documents', requireKioskOrStaff, documentsRouter);
  app.use('/api/doctor', doctorRouter); // each route has its own role guard
  app.use('/api/contraindications', requireKioskOrStaff, contraindicationsRouter);
  app.use('/api/abdm/hip', abdmHipRouter); // gateway callbacks + staff views, guards inside
  app.use('/api/abdm', abdmRouter); // per-route guards
  // BYOD gate (patient's own phone at the hospital gate) is public; the rest needs a kiosk or staff.
  const PUBLIC_SECURITY_PATHS = new Set(['/gate-nonce', '/validate-gate-nonce', '/verify-proximity']);
  app.use('/api/security', (req, res, next) => (PUBLIC_SECURITY_PATHS.has(req.path) ? next() : requireKioskOrStaff(req, res, next)), securityRouter);
  app.use('/api/asha', requireStaff('asha', 'admin', ...CLINICIAN_ROLES), ashaRouter);
  app.use('/api/queue', queueRouter);
  app.use('/api/alerts', alertsRouter);
  app.use('/api/print', printRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/retrieval', requireStaff(...CLINICIAN_ROLES), retrievalRouter); // encrypted similar-case retrieval (docs/RETRIEVAL_LAYER.md)
  retrievalOrchestrator.init().catch(() => { /* reported by /api/retrieval/status */ });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  app.use(errorHandler);
  return app;
}

/** HTTP server with the consultation-room ambient-scribe WebSocket (ticket-authenticated). */
export function createServer(): { app: express.Express; server: http.Server; wss: WebSocketServer } {
  prepareData();
  const app = createApp();
  const server = http.createServer(app);

  const wss = new WebSocketServer({
    server,
    path: '/ws/ambient',
    maxPayload: 1024 * 1024,
    verifyClient: (info, done) => {
      try {
        const url = new URL(info.req.url || '', 'http://localhost');
        const user = redeemStreamTicket(url.searchParams.get('ticket') || '');
        if (!user || !['doctor', 'vaidya', 'nurse', 'admin'].includes(user.role)) return done(false, 401, 'Unauthorized');
        done(true);
      } catch {
        done(false, 400, 'Bad request');
      }
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    const vadPipeline = new AudioVadPipelineService(16000, -36);
    const cleanup = () => { vadPipeline.removeAllListeners(); };
    vadPipeline.on('vad', (event) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'VAD_EVENT', ...event }));
    });
    ws.on('message', (message: any, isBinary: boolean) => {
      try {
        if (isBinary || Buffer.isBuffer(message)) {
          vadPipeline.processPcmChunk(Buffer.from(message));
        } else {
          const payload = JSON.parse(message.toString());
          if (payload.type === 'SET_ACOUSTIC_MODE' && payload.mode) {
            vadPipeline.setAcousticMode(payload.mode, payload.thresholdDb);
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ACOUSTIC_MODE_UPDATED', mode: payload.mode, metrics: vadPipeline.getAcousticMetrics() }));
          } else if (payload.type === 'TRANSCRIPT_CHUNK' && payload.text) {
            // parse() normalises internally and also reads the words as spoken; normalised text is sent for display.
            const normalized = PhoneticNormalizerService.normalize(payload.text);
            const parsed = ClinicalParserService.parse(payload.text, payload.patientId);
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'EXTRACTED_STATE', data: parsed, normalized }));
          }
        }
      } catch (e: any) {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ERROR', message: e.message }));
      }
    });
    ws.on('error', (err) => { console.warn('[WebSocket] Ambient Scribe socket warning:', err); cleanup(); });
    ws.on('close', cleanup);
  });

  return { app, server, wss };
}

/** Background schedules (retention, backups, follow-up SMS). Not started inside tests. */
export function startSchedules(): void {
  startRetentionSchedule();
  startBackupSchedule();
  startFollowUpReminders();
}
