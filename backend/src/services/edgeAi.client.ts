/**
 * Client for the on-premise Edge AI service (edge-ai/, Python FastAPI).
 *
 * The service runs open models on the hospital's own machine — speech recognition, speech
 * synthesis, translation, a small LLM for structured extraction and note drafting, and OCR — so
 * patient audio and text never leave the premises. Every capability is optional: the service
 * reports what it has loaded, and each caller falls back to the deterministic rules when a model
 * is missing or the service is down.
 */

const BASE = (process.env.EDGE_AI_URL || 'http://127.0.0.1:8090').replace(/\/$/, '');
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
  url: BASE,
  capabilities: {
    asr: { available: false }, tts: { available: false }, translate: { available: false }, llm: { available: false }, ocr: { available: false }
  },
  checkedAt: new Date().toISOString()
});

let cached: EdgeAiStatus | null = null;
let cachedAt = 0;

const headers = (extra: Record<string, string> = {}) => ({ ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}), ...extra });

async function call<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`Edge AI ${path} failed (${r.status}) ${body.slice(0, 200)}`);
  }
  return r.json() as Promise<T>;
}

export const EdgeAiClient = {
  baseUrl: BASE,

  async status(force = false): Promise<EdgeAiStatus> {
    if (!force && cached && Date.now() - cachedAt < 30_000) return cached;
    try {
      const h = await call<any>('/health', { headers: headers() }, 2500);
      cached = { online: true, url: BASE, capabilities: { ...OFFLINE().capabilities, ...(h.capabilities || {}) }, device: h.device, checkedAt: new Date().toISOString() };
    } catch {
      cached = OFFLINE();
    }
    cachedAt = Date.now();
    return cached;
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
  transcribe(audio: Buffer, contentType: string, lang: string, profile?: 'dictation') {
    return call<{ text: string; language: string; confidence?: number; durationSec?: number; alternatives?: string[]; speech?: boolean; rejected?: string }>(
      `/asr?lang=${encodeURIComponent(lang)}${profile ? `&profile=${profile}` : ''}`,
      { method: 'POST', headers: headers({ 'Content-Type': contentType || 'application/octet-stream' }), body: new Uint8Array(audio) },
      30_000
    );
  },

  async synthesize(text: string, lang: string): Promise<{ audio: Buffer; contentType: string }> {
    const r = await fetch(`${BASE}/tts`, {
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

  extract(text: string, lang: string) {
    return call<{ findings: any[]; model?: string }>(
      '/extract',
      { method: 'POST', headers: headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ text, lang }) },
      25_000
    );
  },

  soap(input: { transcript: string; structured: unknown; careStream: string }) {
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
