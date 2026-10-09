/**
 * Microphone recording for the hospital's own speech-recognition service (Edge AI).
 *
 * The browser's built-in Web Speech API sends audio to the browser vendor's cloud. When the
 * hospital runs on-premise ASR, the kiosk records locally and sends the audio only to its own
 * server instead.
 */

import { api } from '../services/api';

let cached: { asr: boolean; llm: boolean; asrLanguages: string[]; at: number } | null = null;

/** `asr`: the hospital's speech service is up; `asrLanguages`: the languages it has models for (e.g. hi, en). */
export async function aiCapabilities(): Promise<{ asr: boolean; llm: boolean; asrLanguages: string[] }> {
  if (cached && Date.now() - cached.at < 60_000) return cached;
  const s = await api.getAiStatus();
  const asr = (s.capabilities?.asr || {}) as { available?: boolean; languages?: string[] };
  cached = {
    asr: !!(s.online && asr.available),
    llm: !!(s.online && s.capabilities?.llm?.available),
    asrLanguages: s.online && asr.available && Array.isArray(asr.languages) ? asr.languages : [],
    at: Date.now()
  };
  return cached;
}

/**
 * How the kiosk can listen in a language: the hospital's own recogniser when it has that language, else the
 * browser's (cloud) recogniser if the hospital allows it, else not at all (the patient taps or types).
 */
export function speechRouteFor(lang: string, caps: { asr: boolean; asrLanguages: string[] } | null): 'onprem' | 'cloud' | 'none' {
  if (caps?.asr && (caps.asrLanguages.length === 0 || caps.asrLanguages.includes(lang))) return 'onprem';
  const hasBrowserSpeech = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  return cloudSpeechAllowed && hasBrowserSpeech ? 'cloud' : 'none';
}

/** Whether the hospital allows the browser's cloud speech recognition (set VITE_ALLOW_CLOUD_SPEECH=false to forbid). */
export const cloudSpeechAllowed = (import.meta.env.VITE_ALLOW_CLOUD_SPEECH as string | undefined) !== 'false';

export interface Recorder {
  /** Stops and returns 16 kHz mono 16-bit WAV (what the speech models expect), or the raw recording if conversion fails. */
  stop: () => Promise<Blob>;
  cancel: () => void;
  /** Whether speech was heard (null when speech detection was not running). Clips with no speech are not worth transcribing. */
  heardSpeech: () => boolean | null;
}

export interface RecordingOptions {
  maxSeconds?: number;
  /** Called once the patient has spoken and then stayed quiet for `silenceMs` (auto-stop). */
  onSilence?: () => void;
  silenceMs?: number;
  /** Run the speech detector even without `onSilence`, so `heardSpeech()` can answer. */
  detectSpeech?: boolean;
}

/**
 * Records from the microphone for the hospital's own speech recognition.
 *
 * Browser noise suppression and echo cancellation are switched OFF: in our tests (edge-ai/eval) speech
 * enhancement in front of the recogniser made accuracy worse in every condition. Background noise is best
 * fixed with a close-talk or handset microphone and press-to-talk. Gain control stays on for quiet voices.
 */
export async function startRecording(opts: RecordingOptions | number = {}): Promise<Recorder> {
  const { maxSeconds = 45, onSilence, silenceMs = 1500, detectSpeech = false } = typeof opts === 'number' ? { maxSeconds: opts } : opts;
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true, channelCount: 1 }
  });
  const mime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4'].find(m => MediaRecorder.isTypeSupported(m)) || '';
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: BlobPart[] = [];
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  rec.start(250);

  // Simple energy-based end-of-speech detection: adapts to the room's noise floor.
  let ctx: AudioContext | null = null;
  let vadTimer: ReturnType<typeof setInterval> | null = null;
  let heard: boolean | null = null;
  if (onSilence || detectSpeech) {
    heard = false;
    try {
      ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      let floor = 0.01, spoke = false, quietSince = 0, fired = false;
      const started = Date.now();
      vadTimer = setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        const rms = Math.sqrt(buf.reduce((a, v) => a + v * v, 0) / buf.length);
        if (Date.now() - started < 400) { floor = Math.max(floor, rms); return; } // calibrate on the first 0.4 s
        const speaking = rms > Math.max(0.015, floor * 2.5);
        if (speaking) { spoke = true; heard = true; quietSince = 0; } else {
          floor = floor * 0.98 + rms * 0.02;
          if (spoke && !quietSince) quietSince = Date.now();
        }
        if (onSilence && !fired && spoke && quietSince && Date.now() - quietSince > silenceMs) { fired = true; onSilence(); }
      }, 100);
    } catch { heard = null; /* auto-stop is a convenience; the stop button still works */ }
  }

  const release = () => {
    stream.getTracks().forEach(t => t.stop());
    if (vadTimer) clearInterval(vadTimer);
    ctx?.close().catch(() => {});
  };
  const limit = setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, maxSeconds * 1000);
  const done = new Promise<Blob>(resolve => {
    rec.onstop = () => {
      clearTimeout(limit);
      release();
      const raw = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      toWav16k(raw).then(resolve, () => resolve(raw));
    };
  });
  return {
    stop: () => {
      if (rec.state === 'recording') rec.stop();
      return done;
    },
    cancel: () => {
      clearTimeout(limit);
      try { rec.stop(); } catch {}
      release();
    },
    heardSpeech: () => heard
  };
}

/** Decodes any browser recording and re-encodes it as 16 kHz mono PCM WAV. */
export async function toWav16k(blob: Blob): Promise<Blob> {
  const decodeCtx = new AudioContext();
  try {
    const decoded = await decodeCtx.decodeAudioData(await blob.arrayBuffer());
    const rate = 16000;
    const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * rate)), rate);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start();
    const pcm = (await offline.startRendering()).getChannelData(0);
    const out = new DataView(new ArrayBuffer(44 + pcm.length * 2));
    const str = (o: number, t: string) => [...t].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF'); out.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
    out.setUint32(24, rate, true); out.setUint32(28, rate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true);
    str(36, 'data'); out.setUint32(40, pcm.length * 2, true);
    pcm.forEach((v, i) => out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true));
    return new Blob([out.buffer], { type: 'audio/wav' });
  } finally {
    decodeCtx.close().catch(() => {});
  }
}
