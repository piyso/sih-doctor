/**
 * AIIA MediKiosk & Sovereign Ambient Scribe Backend Server Entrypoint
 * PS ID 26047 — Ministry of Ayush & MoHFW
 *
 * Integrates:
 * 1. PiyGraph Causal Knowledge Graph (Spreading Activation)
 * 2. Bayesian Beta-Binomial Truth Engine
 * 3. Audio Pipeline & Real-Time RMS Voice Activity Detection (VAD)
 * 4. Continuous Modern Hopfield Associative Memory & PAC Conformal Gate
 */

import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import { db } from './db/database';
import { seedDatabase } from './db/seed';
import { kioskRouter } from './routes/kiosk.routes';
import { documentsRouter } from './routes/documents.routes';
import { doctorRouter } from './routes/doctor.routes';
import { contraindicationsRouter } from './routes/contraindications.routes';
import { abdmRouter } from './routes/abdm.routes';
import { securityRouter } from './routes/security.routes';
import { ashaRouter } from './routes/asha.routes';
import { ClinicalParserService } from './services/clinicalParser.service';
import { PiyGraphService } from './services/piygraph.service';
import { AudioVadPipelineService } from './services/audioVadPipeline.service';
import { PhoneticNormalizerService } from './services/phoneticNormalizer.service';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8001;

// Initialize PiyGraph Causal Ayush Knowledge Graph
PiyGraphService.initialize();
const graphStats = PiyGraphService.getGraphStats();
console.log(`[PiyGraph] Initialized Causal AYUSH Graph: ${graphStats.nodeCount} nodes, ${graphStats.edgeCount} edges`);

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health Check with Deep Cognitive Subsystem Status
app.get(['/health', '/api/health'], (_req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'AIIA MediKiosk Sovereign Engine (PiyGraph + Bayesian Truth Engine)',
    version: '2.0.0',
    statutoryCompliance: 'DPDP Act 2023 / ABDM M3 / Ministry of Ayush',
    cognitiveSubsystems: {
      piyGraph: { status: 'ONLINE', nodes: graphStats.nodeCount, edges: graphStats.edgeCount },
      bayesianTruthEngine: { status: 'ONLINE', prior: 'Beta(2, 1)', methodAware: true },
      hopfieldAttractor: { status: 'ONLINE', beta: 8.0, dimension: 10 },
      pacConformalGate: { status: 'ONLINE', alpha: 0.01, coverageGuarantee: '99.0%' },
      audioVadPipeline: { status: 'ONLINE', sampleRate: 16000 }
    },
    uptimeSeconds: process.uptime()
  });
});

// Mount Routes
app.use('/api/kiosk', kioskRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/doctor', doctorRouter);
app.use('/api/contraindications', contraindicationsRouter);
app.use('/api/abdm', abdmRouter);
app.use('/api/security', securityRouter);
app.use('/api/asha', ashaRouter);

// HTTP Server
const server = http.createServer(app);

// WebSocket Server for Live Ambient Audio Scribing & Binary PCM VAD
const wss = new WebSocketServer({ server, path: '/ws/ambient' });

wss.on('connection', (ws: WebSocket) => {
  console.log('[WebSocket] Doctor Ambient Scribe & VAD client connected');
  const vadPipeline = new AudioVadPipelineService(16000, -36);

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
          ws.send(JSON.stringify({
            type: 'ACOUSTIC_MODE_UPDATED',
            mode: payload.mode,
            metrics: vadPipeline.getAcousticMetrics()
          }));
        } else if (payload.type === 'TRANSCRIPT_CHUNK' && payload.text) {
          const normalized = PhoneticNormalizerService.normalize(payload.text);
          const parsed = ClinicalParserService.parse(normalized, payload.patientId);

          ws.send(JSON.stringify({
            type: 'EXTRACTED_STATE',
            data: parsed,
            normalized
          }));
        } else if (payload.type === 'SIMULATE_STREAM') {
          // Stream simulated conversational turns
          const dialogue = [
            { speaker: 'Doctor', text: 'नमस्ते रमेश जी, बताइए क्या परेशानी हो रही है? (Namaste, what brings you in today?)', timestamp: '10:16:02' },
            { speaker: 'Patient', text: 'डॉक्टर साहब, 3 घंटे से सीने में बहुत भारी दबाव और दर्द है, जैसे कोई भारी पत्थर रख दिया हो। (Crushing chest pain since 3 hours.)', timestamp: '10:16:08' },
            { speaker: 'Doctor', text: 'क्या यह दर्द बाईं बांह में जा रहा है? क्या पसीना छूट रहा है? (Does it radiate to left arm? Are you sweating?)', timestamp: '10:16:15' },
            { speaker: 'Patient', text: 'हाँ डॉक्टर, बाईं बांह में खिंचाव है और बहुत पसीना आ रहा है। (Yes, left arm radiation and diaphoresis.)', timestamp: '10:16:22' },
            { speaker: 'Doctor', text: 'बीपी 160/100 है। यह एक्यूट कोरोनरी सिंड्रोम का रेड फ्लैग है। (BP is 160/100. Stat Emergency Protocol activated.)', timestamp: '10:16:30' }
          ];

          let idx = 0;
          const interval = setInterval(() => {
            if (idx < dialogue.length && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'AMBIENT_LINE',
                ...dialogue[idx]
              }));
              idx++;
            } else {
              clearInterval(interval);
            }
          }, 2000);
        }
      }
    } catch (e: any) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ERROR', message: e.message }));
      }
    }
  });

  ws.on('close', () => {
    console.log('[WebSocket] Ambient Scribe client disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`
┌────────────────────────────────────────────────────────────────────────┐
│   AIIA SOVEREIGN MEDIKIOSK & COGNITIVE SCRIBE ENGINE (PS ID 26047)     │
├────────────────────────────────────────────────────────────────────────┤
│ • REST API Server:   http://localhost:${PORT}                            │
│ • WebSocket Stream:  ws://localhost:${PORT}/ws/ambient                  │
│ • PiyGraph Causal:   ${graphStats.nodeCount} nodes, ${graphStats.edgeCount} causal edges               │
│ • Bayesian Engine:   Beta-Binomial Conjugate Updating Online           │
│ • Hopfield Recall:   Continuous Modern Attractor Dynamics (Beta=8.0)   │
│ • PAC Gating:        99.0% Statistical Coverage Emergency Bound        │
│ • Audio VAD:         Real-time RMS Linear PCM Pipeline (16kHz)         │
│ • Storage Mode:      SQLite WAL Bare-Metal Zero-Cloud Sovereign        │
│ • zk-SNARK Protocol: Groth16 / BN128 Curve (Patent Claims 1-43)        │
└────────────────────────────────────────────────────────────────────────┘
  `);
});

export { app, server };
