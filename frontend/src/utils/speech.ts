/**
 * Read text aloud in an Indian language.
 *
 * Prefers the hospital's on-premise voice (Edge AI service) because many kiosk PCs have no
 * Tamil/Telugu/Odia/etc. voice installed; falls back to the browser's built-in voices.
 */

import { api } from '../services/api';

const BCP47: Record<string, string> = {
  en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN', bn: 'bn-IN', ta: 'ta-IN', te: 'te-IN',
  gu: 'gu-IN', kn: 'kn-IN', ml: 'ml-IN', pa: 'pa-IN', or: 'or-IN'
};

let edgeTts: boolean | null = null;
let edgeCheckedAt = 0;
let current: HTMLAudioElement | null = null;

async function edgeAvailable(): Promise<boolean> {
  if (edgeTts !== null && Date.now() - edgeCheckedAt < 60_000) return edgeTts;
  const s = await api.getAiStatus();
  edgeTts = !!(s.online && s.capabilities?.tts?.available);
  edgeCheckedAt = Date.now();
  return edgeTts;
}

/** True when the browser has a voice for this language. */
export function hasBrowserVoice(lang: string): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  const tag = (BCP47[lang] || lang).toLowerCase();
  return window.speechSynthesis.getVoices().some(v => v.lang.toLowerCase().replace('_', '-').startsWith(tag.slice(0, 2)) && v.lang.toLowerCase().includes(tag.slice(3)));
}

export function stopSpeaking(): void {
  try { current?.pause(); } catch {}
  current = null;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

/** Speak `text`; resolves when playback ends (or immediately if speech is impossible). */
export async function speak(text: string, lang: string, opts: { rate?: number } = {}): Promise<void> {
  stopSpeaking();
  if (!text.trim()) return;
  if (await edgeAvailable().catch(() => false)) {
    try {
      const blob = await api.synthesizeSpeech(text, lang);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      current = audio;
      await new Promise<void>(resolve => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      });
      URL.revokeObjectURL(url);
      return;
    } catch {
      /* fall back to the browser voice */
    }
  }
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  await new Promise<void>(resolve => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = BCP47[lang] || 'en-IN';
    u.rate = opts.rate ?? 0.92;
    const voice = window.speechSynthesis.getVoices().find(v => v.lang.toLowerCase() === u.lang.toLowerCase());
    if (voice) u.voice = voice;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
    setTimeout(resolve, Math.min(20000, 2000 + text.length * 120));
  });
}
