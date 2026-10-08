/**
 * AIIA MediKiosk & Sovereign Ambient Scribe Backend Server Entrypoint
 * Ministry of Ayush & MoHFW
 *
 * Integrates:
 * 1. PiyGraph Causal Knowledge Graph (Spreading Activation)
 * 2. Bayesian Beta-Binomial Truth Engine
 * 3. Audio Pipeline & Real-Time RMS Voice Activity Detection (VAD)
 * 4. Continuous Modern Hopfield Associative Memory & PAC Conformal Gate
 */

import 'dotenv/config'; // must run before any module reads process.env
import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { db } from './db/database';
import { seedDatabase, applyDemoCareStreams } from './db/seed';
import { ensureStaffAccounts } from './db/demoStaff';
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
import { ClinicalParserService } from './services/clinicalParser.service';
import { PiyGraphService } from './services/piygraph.service';
import { AudioVadPipelineService } from './services/audioVadPipeline.service';
import fs from 'fs';
import path from 'path';
import { PhoneticNormalizerService } from './services/phoneticNormalizer.service';
import { securityConfig, CLINICIAN_ROLES } from './security/config';
import { securityHeaders, corsMiddleware, authenticate, requireKioskOrStaff, requireStaff, rateLimit, errorHandler } from './security/middleware';
import { redeemStreamTicket } from './security/auth.service';
import { startRetentionSchedule } from './security/privacy.service';
import { startBackupSchedule } from './services/backup.service';
import { startFollowUpReminders } from './services/followUpReminders.service';

const app = express();
const PORT = process.env.PORT || 8001;

// Initialize PiyGraph Causal Ayush Knowledge Graph
PiyGraphService.initialize();
const graphStats = PiyGraphService.getGraphStats();
console.log(`[PiyGraph] Initialized Causal AYUSH Graph: ${graphStats.nodeCount} nodes, ${graphStats.edgeCount} edges`);

// Demo data only where demo data is allowed (never by default in production).
try {
  if (securityConfig.allowDemo) {
    const sessionCount = (db.prepare('SELECT count(*) as count FROM sessions').get() as any)?.count || 0;
    if (sessionCount === 0) {
      console.log('[Database] Fresh database: loading demo patients (ALLOW_DEMO_DATA is on).');
      seedDatabase();
    }
    applyDemoCareStreams();
  }
  ensureStaffAccounts();
} catch (e) {
  console.warn('[Database] Startup data check notice:', e);
}

// ---------- Middleware ----------
if (securityConfig.trustProxy) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(securityHeaders);
app.use(corsMiddleware);
// Large bodies only where images are uploaded; everything else is small JSON.
app.use(['/api/documents', '/api/asha/sync'], express.json({ limit: '15mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(authenticate);
// Generous per-client budget (a busy doctor desk polls + streams). Long-lived event streams are exempt.
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

// Health check (public: used by Docker and load balancers). No internal details.
app.get(['/health', '/api/health'], (_req, res) => {
  let dbOk = true;
  try { db.prepare('SELECT 1').get(); } catch { dbOk = false; }
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'HEALTHY' : 'DEGRADED',
    service: 'Hospital OS',
    version: '2.1.0',
    database: dbOk ? 'ok' : 'error',
    uptimeSeconds: Math.round(process.uptime())
  });
});

import { Readable } from 'stream';

// High-Speed CORS-Enabled 3D Anatomical Model Streaming Endpoint (1,751 Clean Meshes)
app.get('/api/models/anatomical-smooth', async (req, res) => {
  const localSmoothPath = path.join(__dirname, '..', '..', 'frontend', 'public', 'models', '3d_mannequin_smooth.glb');
  const localInstantPath = path.join(__dirname, '..', '..', 'frontend', 'public', 'models', '3d_mannequin_instant.glb');

  if (fs.existsSync(localSmoothPath)) {
    res.setHeader('Content-Type', 'model/gltf-binary');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(localSmoothPath);
  }
  if (fs.existsSync(localInstantPath)) {
    res.setHeader('Content-Type', 'model/gltf-binary');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(localInstantPath);
  }

  const cdnUrl = process.env.PROPRIETARY_MODEL_ASSETS_CDN_URL;
  if (!cdnUrl) {
    return res.status(404).json({ error: '3D model assets are proprietary and restricted to authorized local kiosks.' });
  }
  try {
    const range = req.headers.range;
    const fetchHeaders: Record<string, string> = {};
    if (range) fetchHeaders['Range'] = range;

    const response = await fetch(cdnUrl, { headers: fetchHeaders });
    res.status(response.status);
    response.headers.forEach((val, key) => {
      const lowerKey = key.toLowerCase();
      if (!['content-encoding', 'transfer-encoding', 'connection'].includes(lowerKey)) {
        res.setHeader(key, val);
      }
    });
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as any);
      nodeStream.on('error', (err) => {
        console.error('[Stream Error in 3D Model Proxy]:', err);
        if (!res.headersSent) res.status(500).end();
      });
      nodeStream.pipe(res);
    } else {
      res.status(500).json({ error: 'No response body received from CDN' });
    }
  } catch (err) {
    console.error('Error streaming 3D model:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream 3D model' });
    }
  }
});

// ---------- Routes ----------
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/kiosk', requireKioskOrStaff, kioskRouter);
app.use('/api/documents', requireKioskOrStaff, documentsRouter);
app.use('/api/doctor', doctorRouter); // each route has its own role guard
app.use('/api/contraindications', requireKioskOrStaff, contraindicationsRouter);
app.use('/api/abdm', abdmRouter); // per-route guards
// BYOD gate (patient's own phone at the hospital gate) is public; the rest needs a kiosk or staff.
const PUBLIC_SECURITY_PATHS = new Set(['/gate-nonce', '/validate-gate-nonce', '/verify-proximity']);
app.use('/api/security', (req, res, next) => (PUBLIC_SECURITY_PATHS.has(req.path) ? next() : requireKioskOrStaff(req, res, next)), securityRouter);
app.use('/api/asha', requireStaff('asha', 'admin', ...CLINICIAN_ROLES), ashaRouter);
app.use('/api/queue', queueRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/print', printRouter);
app.use('/api/ai', aiRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});
app.use(errorHandler);

// HTTP Server
const server = http.createServer(app);

// WebSocket Server for Live Ambient Audio Scribing & Binary PCM VAD
// The consultation-room scribe socket carries patient conversation: only signed-in clinicians,
// authenticated with a one-time ticket from POST /api/auth/stream-ticket (?ticket=...).
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
  console.log('[WebSocket] Doctor Ambient Scribe & VAD client connected');
  const vadPipeline = new AudioVadPipelineService(16000, -36);
  const cleanup = () => {
    vadPipeline.removeAllListeners();
  };

  vadPipeline.on('vad', (event) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'VAD_EVENT',
        ...event
      }));
    }
  });

  ws.on('message', (message: any, isBinary: boolean) => {
    try {
      if (isBinary || Buffer.isBuffer(message)) {
        // Raw linear 16-bit PCM buffer ingested from far-field mic array
        const pcmBuffer = Buffer.from(message);
        vadPipeline.processPcmChunk(pcmBuffer);
      } else {
        const textStr = message.toString();
        const payload = JSON.parse(textStr);

        if (payload.type === 'SET_ACOUSTIC_MODE' && payload.mode) {
          vadPipeline.setAcousticMode(payload.mode, payload.thresholdDb);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'ACOUSTIC_MODE_UPDATED',
              mode: payload.mode,
              metrics: vadPipeline.getAcousticMetrics()
            }));
          }
        } else if (payload.type === 'TRANSCRIPT_CHUNK' && payload.text) {
          const normalized = PhoneticNormalizerService.normalize(payload.text);
          const parsed = ClinicalParserService.parse(normalized, payload.patientId);

          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'EXTRACTED_STATE',
              data: parsed,
              normalized
            }));
          }
        }
      }
    } catch (e: any) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ERROR', message: e.message }));
      }
    }
  });

  ws.on('error', (err) => {
    console.warn('[WebSocket] Ambient Scribe socket warning:', err);
    cleanup();
  });

  ws.on('close', () => {
    console.log('[WebSocket] Ambient Scribe client disconnected');
    cleanup();
  });
});

server.listen(PORT, () => {
  startRetentionSchedule();
  startBackupSchedule();
  startFollowUpReminders();
  console.log(`
Hospital OS backend listening on http://localhost:${PORT}  (ws: /ws/ambient)
  Mode:            ${securityConfig.isProduction ? 'PRODUCTION' : 'development'}
  Demo data:       ${securityConfig.allowDemo ? 'ON (do not use with real patients)' : 'off'}
  Kiosk enrolment: ${securityConfig.kioskOpen ? 'not required (open)' : 'required'}
  CORS origins:    ${securityConfig.corsAllowAll ? '* (development)' : securityConfig.corsOrigins.join(', ') || 'same-origin only'}
  Knowledge graph: ${graphStats.nodeCount} nodes, ${graphStats.edgeCount} edges
`);
  if (securityConfig.isProduction && securityConfig.allowDemo) {
    console.warn('[Security] WARNING: demo data is enabled in production. Set ALLOW_DEMO_DATA=false.');
  }
});
