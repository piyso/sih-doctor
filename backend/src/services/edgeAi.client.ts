/**
 * Client for the on-premise Edge AI service (edge-ai/, Python FastAPI).
 *
 * The service runs open models on the hospital's own machine — speech recognition, speech
 * synthesis, translation, OCR and, only if the hospital installs one, a small language model for a
 * clinician's note draft — so what is sent to it stays on the premises. Every capability is
 * optional: the service reports what it has loaded, and each caller falls back to the deterministic
 * rules when a model is missing or the service is down.
 *
 * What this server may use is decided by aiPolicy.ts, not by what is installed: with the default
 * policy no language model and no generative speech recogniser is ever called. There is no method
 * here that sends a patient's words to a language model for extraction.
 */

import { AiPolicy, AiPolicyError, applyAiPolicy, generativeAsrAllowed, llmAssist } from './aiPolicy';

// read on each call, so a test can point the client at a stand-in service
const base = () => (process.env.EDGE_AI_URL || 'http://127.0.0.1:8090').replace(/\/$/, '');
const TOKEN = process.env.EDGE_AI_TOKEN || '';

export interface EdgeAiStatus {
  online: boolean;
  url: string;
  capabilities: Record<'asr' | 'tts' | 'translate' | 'llm' | 'ocr', { available: boolean; model?: string; languages?: string[] }>;
  device?: string;
  checkedAt: string;
}

const OFFLINE = (): EdgeAiStatus => ({
  online: false,
  url: base(),
  capabilities: {
    asr: { available: false }, tts: { available: false }, translate: { available: false }, llm: { available: false }, ocr: { available: false }
  },
  checkedAt: new Date().toISOString()
});

let cached: EdgeAiStatus | null = null;
let cachedAt = 0;

const headers = (extra: Record<string, string> = {}) => ({ ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}), ...extra });

async function call<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const r = await fetch(`${base()}${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`Edge AI ${path} failed (${r.status}) ${body.slice(0, 200)}`);
  }
  return r.json() as Promise<T>;
}

export const EdgeAiClient = {
  get baseUrl() { return base(); },

  /** What the service offers, after the hospital's model policy (aiPolicy.ts) has been applied. */
  async status(force = false): Promise<EdgeAiStatus & { policy: AiPolicy }> {
    if (force || !cached || Date.now() - cachedAt >= 30_000) {
      try {
        const h = await call<any>('/health', { headers: headers() }, 2500);
        cached = { online: true, url: base(), capabilities: { ...OFFLINE().capabilities, ...(h.capabilities || {}) }, device: h.device, checkedAt: new Date().toISOString() };
      } catch {
        cached = OFFLINE();
      }
      cachedAt = Date.now();
    }
    // applied on every read, so a policy change takes effect without waiting for the cache
    return applyAiPolicy(cached);
  },

  async available(cap: keyof EdgeAiStatus['capabilities']): Promise<boolean> {
    const s = await this.status();
    return s.online && !!s.capabilities[cap]?.available;
  },

  /**
   * alternatives: re-check decodes of the same audio (speed-perturbed); the extractor combines their findings.
   * speech: false (with `rejected`) when the audio held no speech — tones, hum, fan noise — and text is "".
   * profile "dictation" adds medicine-name hotwords for a doctor's dictation (English).
   */
  async transcribe(audio: Buffer, contentType: string, lang: string, profile?: 'dictation') {
    // Only a language the allowed recognisers serve is sent at all; with the default policy that excludes Whisper.
    const st = await this.status();
    if (st.online && st.capabilities.asr.available && !(st.capabilities.asr.languages || []).includes(lang)) {
      throw new AiPolicyError('ASR_LANGUAGE_UNAVAILABLE', `No on-premise speech recogniser is installed for '${lang}'.`);
    }
    const r = await call<{ text: string; language: string; engine?: string; confidence?: number; durationSec?: number; alternatives?: string[]; speech?: boolean; rejected?: string }>(
      `/asr?lang=${encodeURIComponent(lang)}${profile ? `&profile=${profile}` : ''}`,
      { method: 'POST', headers: headers({ 'Content-Type': contentType || 'application/octet-stream' }), body: new Uint8Array(audio) },
      30_000
    );
    // second lock: text written by a generative recogniser is discarded, whatever the status said
    if (/whisper/i.test(r.engine || '') && !generativeAsrAllowed()) {
      throw new AiPolicyError('GENERATIVE_ASR_OFF', 'The speech server answered with a generative recogniser, which this hospital has not allowed.');
    }
    return r;
  },

  async synthesize(text: string, lang: string): Promise<{ audio: Buffer; contentType: string }> {
    const r = await fetch(`${base()}/tts`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ text, lang }),
      signal: AbortSignal.timeout(20_000)
    });
    if (!r.ok) throw new Error(`Edge AI /tts failed (${r.status})`);
    return { audio: Buffer.from(await r.arrayBuffer()), contentType: r.headers.get('content-type') || 'audio/wav' };
  },

  translate(texts: string[], source: string, target: string) {
    return call<{ translations: string[]; model?: string }>(
      '/translate',
      { method: 'POST', headers: headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ texts, source, target }) },
      30_000
    );
  },

  /** A clinician's visit-note draft from the on-premise language model; refused unless LLM_ASSIST=clinician. */
  async soap(input: { transcript: string; structured: unknown; careStream: string }) {
    if (llmAssist() !== 'clinician') throw new AiPolicyError('LLM_OFF', 'This hospital has not switched on the language-model note draft.');
    return call<{ subjective: string; objective: string; assessment: string; plan: string; model?: string }>(
      '/soap',
      { method: 'POST', headers: headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(input) },
      60_000
    );
  },

  ocr(image: Buffer, contentType: string) {
    return call<{ text: string; lines: Array<{ text: string; confidence: number }>; model?: string }>(
      '/ocr',
      { method: 'POST', headers: headers({ 'Content-Type': contentType || 'image/jpeg' }), body: new Uint8Array(image) },
      30_000
    );
  }
};
