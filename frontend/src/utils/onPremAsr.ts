/**
 * Microphone recording for the hospital's own speech-recognition service (Edge AI).
 *
 * The browser's built-in Web Speech API sends audio to the browser vendor's cloud. When the
 * hospital runs on-premise ASR, the kiosk records locally and sends the audio only to its own
 * server instead.
 */

import { api } from '../services/api';

let cached: { asr: boolean; llm: boolean; at: number } | null = null;

export async function aiCapabilities(): Promise<{ asr: boolean; llm: boolean }> {
  if (cached && Date.now() - cached.at < 60_000) return cached;
  const s = await api.getAiStatus();
  cached = { asr: !!(s.online && s.capabilities?.asr?.available), llm: !!(s.online && s.capabilities?.llm?.available), at: Date.now() };
  return cached;
}

/** Whether the hospital allows the browser's cloud speech recognition (set VITE_ALLOW_CLOUD_SPEECH=false to forbid). */
export const cloudSpeechAllowed = (import.meta.env.VITE_ALLOW_CLOUD_SPEECH as string | undefined) !== 'false';

export interface Recorder {
  stop: () => Promise<Blob>;
  cancel: () => void;
}

export async function startRecording(maxSeconds = 45): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
  const mime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4'].find(m => MediaRecorder.isTypeSupported(m)) || '';
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: BlobPart[] = [];
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  rec.start(250);
  const release = () => stream.getTracks().forEach(t => t.stop());
  const limit = setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, maxSeconds * 1000);
  const done = new Promise<Blob>(resolve => {
    rec.onstop = () => {
      clearTimeout(limit);
      release();
      resolve(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
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
    }
  };
}
