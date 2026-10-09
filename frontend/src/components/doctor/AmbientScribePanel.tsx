import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square, Pause, Play, Trash2, Pencil, Check, X, ShieldCheck, ShieldOff, Users, AlertTriangle, Loader2, FileText, Sparkles, Info } from 'lucide-react';
import { AudioVisualizer } from '../common/AudioVisualizer';
import { api } from '../../services/api';
import { aiCapabilities, cloudSpeechAllowed, startRecording, Recorder } from '../../utils/onPremAsr';
import { scribeChips, ScribeChipKind } from '../../utils/scribeEntities';
import { markUncertainWords, MarkedWord, uncertainCount, isUnclearClip } from '../../utils/asrUncertainty';
import { RecordingConsentState } from '../../types/api';
import { RECORDING_NOTICE, NoticeLang } from './recordingNotice';

/**
 * The consultation scribe, one per visit (the desk mounts it with key={sessionId}: nothing carries over
 * between patients, and every recorder is stopped when the patient changes).
 *
 * Dictation first. The clinician holds the button and speaks: a close-talk, push-to-talk clip is the most
 * accurate input in a noisy OPD (edge-ai/eval), it records nobody else, and it needs no consent. Indian OPD
 * visits are short, crowded and multilingual, and relatives often answer for the patient — exactly where
 * room capture and speaker separation are weakest.
 *
 * Room recording only after the patient's consent for this visit is on record. The notice is read in the
 * patient's language; who agreed (patient, or parent/guardian for a child) and whether others in the room
 * were told are recorded; the server refuses room audio without that consent; there is no cloud fallback
 * for room audio; pause captures nothing; withdrawal is one tap and deletes the text made from the
 * recording. Audio is never stored.
 *
 * No speaker guessing. Lines are labelled by how they were captured — "Dictation (you)" or "Room (speaker not
 * identified)" — never by an inferred speaker: a misattributed sentence turns a complaint into a finding or the
 * reverse. Room-line chips say "Mentioned"/"Asked about", never "patient reports". The clinician may mark who
 * said a line; that mark is theirs and is labelled as such.
 *
 * Nothing reaches the record by itself. Lines are inserted into the notes by the clinician, with their source;
 * medicines found are offered for confirmation. Uncertain words (where the server's re-decodes disagree) are
 * marked for checking.
 */

type Mode = 'dictation' | 'room';
type Who = 'patient' | 'attendant' | 'clinician';
interface Line { id: string; mode: Mode; text: string; words: MarkedWord[]; at: string; seconds: number; edited: boolean; who?: Who; engine?: string }

interface AmbientScribePanelProps {
  sessionId: string | null;
  patientAge?: number;
  patientLanguage?: string;
  clinicianName: string;
  consent: RecordingConsentState | null;
  onConsentChange?: (consent: RecordingConsentState | null) => void;
  /** Medicines found in the transcript are offered for confirmation (never added silently). */
  onAutoExtract: (transcriptText: string) => void;
  /** Full transcript (with each line's source) and whether any of it came from the room recording. */
  onTranscriptChange?: (text: string, hasRoom: boolean) => void;
  /** Adds text to the clinical notes; `fromRoom` lets the desk delete it again if consent is withdrawn. */
  onInsertNotes: (text: string, fromRoom: boolean) => void;
  /** Consent was withdrawn: the desk removes room-derived text from the unsigned notes and says how much. */
  onWithdrawn: () => void;
}

const CHIP: Record<ScribeChipKind, string> = {
  emergency: 'bg-rose-500/10 border-rose-500/40 text-rose-700',
  symptom: 'bg-muted border-border text-foreground',
  asked: 'bg-background border-dashed border-border text-muted-foreground',
  denied: 'bg-muted border-border text-muted-foreground',
  vital: 'bg-sky-500/10 border-sky-500/30 text-sky-700',
  duration: 'bg-muted border-border text-muted-foreground',
  rx: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700',
  ayush: 'bg-amber-500/10 border-amber-500/30 text-amber-800'
};
const WHO_LABEL: Record<Who, string> = { patient: 'patient', attendant: 'attendant / relative', clinician: 'clinician' };
const LANG_LABEL: Record<string, string> = { hi: 'हिन्दी', en: 'English', mr: 'मराठी', bn: 'বাংলা', ta: 'தமிழ்', te: 'తెలుగు', gu: 'ગુજરાતી', kn: 'ಕನ್ನಡ', ml: 'മലയാളം', pa: 'ਪੰਜਾਬੀ', or: 'ଓଡ଼ିଆ' };

const DICT_LANG_KEY = 'scribe_dictation_lang';
const DICT_STYLE_KEY = 'scribe_dictation_style';
const DICT_MAX_S = 60;
const CLIP_MAX_S = 20;
const ROOM_MAX_MS = 15 * 60_000;
const BACKGROUND_PAUSE_MS = 60_000;

const stored = (k: string, fallback: string) => { try { return localStorage.getItem(k) || fallback; } catch { return fallback; } };
const store = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
const clock = (d = new Date()) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
const mmss = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
const newId = () => Math.random().toString(36).slice(2, 10);

export const AmbientScribePanel: React.FC<AmbientScribePanelProps> = ({
  sessionId, patientAge, patientLanguage, clinicianName, consent, onConsentChange, onAutoExtract, onTranscriptChange, onInsertNotes, onWithdrawn
}) => {
  const [caps, setCaps] = useState<{ asr: boolean; asrLanguages: string[] } | null>(null);
  const [dictLang, setDictLang] = useState(() => stored(DICT_LANG_KEY, 'en'));
  const [dictStyle, setDictStyle] = useState<'hold' | 'tap'>(() => (stored(DICT_STYLE_KEY, 'hold') === 'tap' ? 'tap' : 'hold'));
  const [roomLang, setRoomLang] = useState(patientLanguage && LANG_LABEL[patientLanguage] ? patientLanguage : 'hi');
  const [lines, setLines] = useState<Line[]>([]);
  /** Clips held back as noise (see isUnclearClip): counted and showable, never silently lost. */
  const [unclear, setUnclear] = useState<Line[]>([]);
  const [dictating, setDictating] = useState(false);
  const [dictStart, setDictStart] = useState(0);
  const [room, setRoom] = useState<'off' | 'recording' | 'paused'>('off');
  const [roomMs, setRoomMs] = useState(0);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [, tick] = useState(0);

  const mounted = useRef(true);
  const dictRec = useRef<Recorder | null>(null);
  const browserRec = useRef<any>(null);
  const roomActive = useRef(false);
  const clipFinish = useRef<(() => void) | null>(null);
  const clipCancel = useRef<(() => void) | null>(null);
  const withdrawEpoch = useRef(0);
  const roomStartedAt = useRef(0);
  const roomBankedMs = useRef(0);

  const minor = patientAge !== undefined && patientAge < 18;
  const consentActive = consent?.event === 'given';
  const roomAvailable = !!caps?.asr && (caps.asrLanguages.length === 0 || caps.asrLanguages.includes(roomLang));
  const langsFor = (fallback: string[]) => (caps?.asrLanguages.length ? caps.asrLanguages : fallback).filter(l => LANG_LABEL[l]);

  useEffect(() => {
    mounted.current = true;
    aiCapabilities().then(c => mounted.current && setCaps(c)).catch(() => mounted.current && setCaps({ asr: false, asrLanguages: [] }));
    return () => {
      mounted.current = false;
      roomActive.current = false;
      clipCancel.current?.();
      dictRec.current?.cancel();
      try { browserRec.current?.abort?.(); } catch { /* already stopped */ }
    };
  }, []);

  useEffect(() => {
    const hasRoom = lines.some(l => l.mode === 'room');
    onTranscriptChange?.(lines.map(l => `${l.mode === 'room' ? `Room recording${l.who ? ` (${WHO_LABEL[l.who]}, as marked by the clinician)` : ' (speaker not identified)'}` : 'Dictation (clinician)'}: ${l.text}`).join('\n'), hasRoom);
  }, [lines, onTranscriptChange]);

  // Room clock, the 15-minute limit, and pausing when the desk goes to the background.
  useEffect(() => {
    if (room !== 'recording') return;
    const t = setInterval(() => {
      const ms = roomBankedMs.current + (Date.now() - roomStartedAt.current);
      setRoomMs(ms);
      if (ms >= ROOM_MAX_MS) { stopRoom(); setInfo('Room recording stopped after 15 minutes. Start it again if the consultation continues.'); }
    }, 1000);
    let hiddenTimer: ReturnType<typeof setTimeout> | null = null;
    const onVis = () => {
      if (document.hidden) hiddenTimer = setTimeout(() => { pauseRoom(); setInfo('Room recording paused: the desk was in the background for a minute.'); }, BACKGROUND_PAUSE_MS);
      else if (hiddenTimer) { clearTimeout(hiddenTimer); hiddenTimer = null; }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); if (hiddenTimer) clearTimeout(hiddenTimer); document.removeEventListener('visibilitychange', onVis); };
  }, [room]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!dictating) return;
    const t = setInterval(() => { tick(n => n + 1); if (Date.now() - dictStart >= DICT_MAX_S * 1000) void stopDictation(); }, 500);
    return () => clearInterval(t);
  }, [dictating, dictStart]); // eslint-disable-line react-hooks/exhaustive-deps

  const addLine = useCallback((mode: Mode, text: string, alternatives: string[], seconds: number, engine?: string) => {
    const t = text.trim();
    if (!t || !mounted.current) return false;
    const line: Line = { id: newId(), mode, text: t, words: markUncertainWords(t, alternatives), at: clock(), seconds, edited: false, engine };
    if (isUnclearClip(t, line.words, alternatives)) { setUnclear(prev => [...prev, line]); return false; }
    setLines(prev => [...prev, line]);
    return true;
  }, []);

  /** Sends one clip to the hospital speech server. Results that arrive after a withdrawal are dropped. */
  const transcribe = async (blob: Blob, mode: Mode, lang: string) => {
    if (!sessionId) return;
    const epoch = withdrawEpoch.current;
    setPending(n => n + 1);
    try {
      const r = await api.scribeTranscribe(sessionId, blob, mode, lang);
      if (epoch !== withdrawEpoch.current) return;
      if (r.speech === false) {
        // The server's speech check found no speech (hum, beeps, noise): nothing to show.
        if (mode === 'dictation') setError('No speech was detected in that clip. Hold the microphone closer and try again.');
        return;
      }
      const added = addLine(mode, r.text, r.alternatives || [], r.durationSec, r.engine);
      if (!added && mode === 'dictation') setError('Nothing was recognised. Hold the microphone closer and try again.');
    } catch (e: any) {
      if (!mounted.current) return;
      if (e?.code === 'RECORDING_CONSENT_REQUIRED') {
        roomActive.current = false; clipCancel.current?.(); setRoom('off');
        setError('The server refused the room recording: no current consent for this visit. Nothing was transcribed.');
      } else if (e?.code === 'ASR_UNAVAILABLE') setError('The hospital speech server stopped. Type the note instead.');
      else setError('The speech server did not respond. That clip was not transcribed.');
    } finally {
      if (mounted.current) setPending(n => Math.max(0, n - 1));
    }
  };

  // ── Dictation ─────────────────────────────────────────────────────────────
  const dictOnPrem = !!caps?.asr && (caps.asrLanguages.length === 0 || caps.asrLanguages.includes(dictLang));
  const startDictation = async () => {
    if (dictating || room === 'recording' || !sessionId) return;
    setError(null); setInfo(null);
    if (!dictOnPrem) { startBrowserDictation(); return; }
    try {
      dictRec.current = await startRecording({ maxSeconds: DICT_MAX_S + 1, detectSpeech: true });
      setDictStart(Date.now());
      setDictating(true);
    } catch (e: any) {
      setError(e?.name === 'NotAllowedError' ? 'Microphone permission was denied in the browser.' : 'The microphone could not be started.');
    }
  };
  const stopDictation = async () => {
    if (browserRec.current) { try { browserRec.current.stop(); } catch { /* stopped */ } return; }
    const r = dictRec.current;
    dictRec.current = null;
    setDictating(false);
    if (!r) return;
    const blob = await r.stop().catch(() => null);
    if (!blob) return;
    if (r.heardSpeech() === false) { setError('No speech was heard. Hold the button while you speak.'); return; }
    void transcribe(blob, 'dictation', dictLang);
  };
  // Browser recognition sends audio to the browser maker's cloud: dictation only, only if the hospital allows it, and labelled.
  const startBrowserDictation = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!cloudSpeechAllowed) { setError('The hospital speech server is not running and cloud speech is turned off here. Type the note instead.'); return; }
    if (!SR) { setError('Speech recognition is not available in this browser. Type the note instead.'); return; }
    const rec = new SR();
    rec.lang = dictLang === 'hi' ? 'hi-IN' : 'en-IN';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) addLine('dictation', e.results[i][0].transcript, [], 0, 'browser (cloud)'); };
    rec.onerror = (e: any) => setError(e.error === 'not-allowed' ? 'Microphone permission was denied in the browser.' : 'Browser speech recognition stopped.');
    rec.onend = () => { if (browserRec.current === rec) { browserRec.current = null; setDictating(false); } };
    browserRec.current = rec;
    rec.start();
    setDictStart(Date.now());
    setDictating(true);
  };

  // ── Room recording (consented; clip by clip, cut at pauses in speech) ─────
  const runRoom = async () => {
    if (!consentActive || !roomAvailable || roomActive.current || dictating) return;
    setError(null); setInfo(null);
    roomActive.current = true;
    roomStartedAt.current = Date.now();
    setRoom('recording');
    const lang = roomLang;
    while (roomActive.current && mounted.current) {
      let rec: Recorder;
      try {
        rec = await startRecording({ maxSeconds: CLIP_MAX_S + 1, silenceMs: 1200, onSilence: () => clipFinish.current?.() });
      } catch (e: any) {
        setError(e?.name === 'NotAllowedError' ? 'Microphone permission was denied in the browser.' : 'The microphone could not be started.');
        break;
      }
      if (!roomActive.current) { rec.cancel(); break; }
      const blob = await new Promise<Blob | null>(resolve => {
        let settled = false;
        const timer = setTimeout(() => clipFinish.current?.(), CLIP_MAX_S * 1000);
        clipFinish.current = () => { if (settled) return; settled = true; clearTimeout(timer); rec.stop().then(resolve, () => resolve(null)); };
        clipCancel.current = () => { if (settled) return; settled = true; clearTimeout(timer); rec.cancel(); resolve(null); };
      });
      clipFinish.current = null; clipCancel.current = null;
      // Silence is never sent: speech models can invent words in silence.
      if (blob && rec.heardSpeech() !== false) void transcribe(blob, 'room', lang);
    }
    roomActive.current = false;
    if (mounted.current) {
      roomBankedMs.current += Date.now() - roomStartedAt.current;
      setRoom(r => (r === 'recording' ? 'off' : r));
    }
  };
  /** Stop: the clip in progress is transcribed (the last words matter). */
  const stopRoom = () => { roomActive.current = false; clipFinish.current?.(); setRoom('off'); };
  /** Pause: the clip in progress is discarded; nothing is captured until Resume. */
  const pauseRoom = () => { roomActive.current = false; clipCancel.current?.(); setRoom('paused'); };

  // ── Consent ───────────────────────────────────────────────────────────────
  const saveConsent = async (input: Parameters<typeof api.recordRecordingConsent>[1]) => {
    if (!sessionId) return false;
    setSaving(true); setError(null);
    try {
      const r = await api.recordRecordingConsent(sessionId, input);
      onConsentChange?.(r.data);
      return true;
    } catch (e: any) {
      setError(e?.message || 'The consent could not be saved.');
      return false;
    } finally { setSaving(false); }
  };
  /** Withdrawal: one tap, no questions. Recording stops, its text is deleted, the event is recorded. */
  const withdraw = async () => {
    withdrawEpoch.current++;
    roomActive.current = false;
    clipCancel.current?.();
    setRoom('off');
    const removed = lines.filter(l => l.mode === 'room').length;
    setLines(prev => prev.filter(l => l.mode !== 'room'));
    setUnclear(prev => prev.filter(l => l.mode !== 'room'));
    onWithdrawn();
    const ok = await saveConsent({ event: 'withdrawn' });
    setInfo(`Consent withdrawn${ok ? ' and recorded' : ' (could not be saved — the recording is stopped anyway)'}. ${removed} line${removed === 1 ? '' : 's'} from the recording deleted; dictation kept.`);
  };

  // ── Lines ─────────────────────────────────────────────────────────────────
  const noteText = (l: Line) => `${l.mode === 'room' ? `Room recording ${l.at}${l.who ? ` — ${WHO_LABEL[l.who]} (marked by ${clinicianName})` : ' — speaker not identified'}` : `Dictated ${l.at}`}: ${l.text}`;
  const insert = (subset: Line[]) => {
    if (!subset.length) return;
    const fromRoom = subset.some(l => l.mode === 'room');
    onInsertNotes(subset.map(noteText).join('\n'), fromRoom);
    setInfo(`${subset.length} line${subset.length === 1 ? '' : 's'} added to the clinical notes${fromRoom ? ' (marked as from the room recording)' : ''}. Review before signing.`);
  };
  const saveEdit = (id: string) => {
    const t = editText.trim();
    setLines(prev => prev.map(l => (l.id === id ? { ...l, text: t, words: t.split(/\s+/).filter(Boolean).map(text => ({ text, uncertain: false })), edited: true } : l)).filter(l => l.text));
    setEditing(null);
  };

  const transcript = lines.map(l => l.text).join('\n');
  const uncertainTotal = lines.reduce((n, l) => n + uncertainCount(l.words), 0);
  const speechLabel = caps === null ? 'checking speech server…' : caps.asr ? 'Hospital speech server · audio not kept' : cloudSpeechAllowed ? 'Speech server off · dictation via browser (cloud)' : 'Speech unavailable — type notes';

  return (
    <section className="physical-card p-4 flex flex-col gap-3 mb-4 no-print" aria-label="Dictation and scribe">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Mic size={15} className="text-primary" />
          <span className="text-sm font-bold text-foreground">Dictation &amp; scribe</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${caps?.asr ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700' : 'bg-amber-500/10 border-amber-500/30 text-amber-800'}`}>{speechLabel}</span>
        </div>
      </div>

      {/* Dictation: the clinician's own voice; the default path. */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onPointerDown={dictStyle === 'hold' ? e => { e.preventDefault(); void startDictation(); } : undefined}
          onPointerUp={dictStyle === 'hold' ? () => void stopDictation() : undefined}
          onPointerLeave={dictStyle === 'hold' ? () => { if (dictating) void stopDictation(); } : undefined}
          onClick={dictStyle === 'tap' ? () => void (dictating ? stopDictation() : startDictation()) : undefined}
          onKeyDown={dictStyle === 'hold' ? e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); void startDictation(); } } : undefined}
          onKeyUp={dictStyle === 'hold' ? e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); void stopDictation(); } } : undefined}
          disabled={!sessionId || room === 'recording'}
          aria-pressed={dictating}
          title={room === 'recording' ? 'Pause the room recording to dictate' : 'Records only you, only while held'}
          className={`h-9 px-3.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border select-none ${dictating ? 'bg-rose-600 text-white border-rose-600' : 'bg-primary text-primary-foreground border-primary'} disabled:opacity-50`}
          aria-label={dictStyle === 'hold' ? 'Hold to dictate' : dictating ? 'Stop dictating' : 'Tap to dictate'}
        >
          <Mic size={14} />
          {dictating ? `Listening ${Math.min(DICT_MAX_S, Math.floor((Date.now() - dictStart) / 1000))}s — ${dictStyle === 'hold' ? 'release' : 'tap'} to finish` : dictStyle === 'hold' ? 'Hold to dictate' : 'Tap to dictate'}
        </button>
        <select value={dictLang} onChange={e => { setDictLang(e.target.value); store(DICT_LANG_KEY, e.target.value); }} aria-label="Dictation language" className="h-9 px-2 rounded-lg border border-border bg-background text-xs">
          {langsFor(['en', 'hi']).map(l => <option key={l} value={l}>{LANG_LABEL[l]}</option>)}
        </select>
        <button type="button" onClick={() => { const v = dictStyle === 'hold' ? 'tap' : 'hold'; setDictStyle(v); store(DICT_STYLE_KEY, v); }} className="h-9 px-2 rounded-lg text-[11px] font-semibold text-muted-foreground hover:bg-muted" title="Switch between hold-to-talk and tap-to-start / tap-to-stop">
          {dictStyle === 'hold' ? 'Use tap instead' : 'Use hold instead'}
        </button>
        <span className="text-[10.5px] text-muted-foreground">Your voice only · up to {DICT_MAX_S} s per clip</span>
      </div>

      {/* Room recording: consent first. */}
      <div className="rounded-xl border border-border p-2.5 flex flex-col gap-2" data-testid="scribe-room">
        {room === 'recording' && (
          <div className="rounded-lg bg-rose-600 text-white px-3 py-2 flex items-center gap-2 flex-wrap" role="status" aria-live="polite">
            <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" aria-hidden="true" />
            <span className="text-xs font-bold">Recording the room · {mmss(roomMs)}</span>
            <span className="text-[11px] opacity-90">speakers are not identified · audio is not kept</span>
            <span className="ml-auto flex gap-1.5">
              <button type="button" onClick={pauseRoom} className="h-7 px-2.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold inline-flex items-center gap-1"><Pause size={12} /> Pause</button>
              <button type="button" onClick={stopRoom} className="h-7 px-2.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold inline-flex items-center gap-1"><Square size={12} /> Stop</button>
              <button type="button" onClick={withdraw} data-testid="scribe-withdraw" className="h-7 px-2.5 rounded-lg bg-white text-rose-700 text-xs font-bold inline-flex items-center gap-1"><ShieldOff size={12} /> Patient withdraws</button>
            </span>
          </div>
        )}
        {room === 'paused' && (
          <div className="rounded-lg bg-amber-500/15 border border-amber-500/40 px-3 py-2 flex items-center gap-2 flex-wrap text-amber-950 dark:text-amber-100" role="status">
            <Pause size={13} /> <span className="text-xs font-bold">Paused — nothing is being recorded</span>
            <span className="ml-auto flex gap-1.5">
              <button type="button" onClick={() => void runRoom()} className="h-7 px-2.5 rounded-lg border border-amber-500/50 text-xs font-bold inline-flex items-center gap-1"><Play size={12} /> Resume</button>
              <button type="button" onClick={() => setRoom('off')} className="h-7 px-2.5 rounded-lg border border-amber-500/50 text-xs font-bold inline-flex items-center gap-1"><Square size={12} /> Stop</button>
              <button type="button" onClick={withdraw} data-testid="scribe-withdraw" className="h-7 px-2.5 rounded-lg bg-rose-600 text-white text-xs font-bold inline-flex items-center gap-1"><ShieldOff size={12} /> Patient withdraws</button>
            </span>
          </div>
        )}

        {room === 'off' && (
          <div className="flex items-center gap-2 flex-wrap text-[11.5px]" data-testid="scribe-consent-state">
            <Users size={13} className="text-muted-foreground" />
            {consentActive ? (
              <>
                <span className="text-emerald-700 font-semibold flex items-center gap-1"><ShieldCheck size={12} /> Consent for this visit</span>
                <span className="text-muted-foreground">
                  {consent?.consenter && consent.consenter !== 'patient' ? `${consent.consenterName} (${consent.relationship})` : 'patient'}
                  {consent?.noticeLanguage ? ` · notice in ${LANG_LABEL[consent.noticeLanguage] || consent.noticeLanguage}` : ''} · {clock(new Date(consent!.at))} · recorded by {consent?.by}
                </span>
                <span className="ml-auto flex gap-1.5 items-center">
                  <select value={roomLang} onChange={e => setRoomLang(e.target.value)} aria-label="Room recording language" className="h-8 px-2 rounded-lg border border-border bg-background text-xs">
                    {langsFor(['hi', 'en']).map(l => <option key={l} value={l}>{LANG_LABEL[l]}</option>)}
                  </select>
                  <button type="button" onClick={() => void runRoom()} disabled={!roomAvailable || dictating || !sessionId} className="h-8 px-3 rounded-lg bg-rose-600 text-white text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50"><Mic size={12} /> Start room recording</button>
                  <button type="button" onClick={withdraw} data-testid="scribe-withdraw" className="h-8 px-2.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted inline-flex items-center gap-1"><ShieldOff size={12} /> Patient withdraws</button>
                </span>
              </>
            ) : (
              <>
                <span className="text-muted-foreground">
                  {consent?.event === 'declined' ? `Patient declined room recording at ${clock(new Date(consent.at))} — use dictation.`
                    : consent?.event === 'withdrawn' ? `Consent withdrawn at ${clock(new Date(consent.at))}; text from the recording was deleted.`
                    : 'Room recording is off. It needs the patient’s consent for this visit.'}
                </span>
                {!sheetOpen && <button type="button" onClick={() => setSheetOpen(true)} disabled={!sessionId} data-testid="scribe-consent-ask" className="ml-auto h-8 px-3 rounded-lg border border-border text-xs font-bold hover:bg-muted">{consent ? 'Ask again' : 'Ask for consent'}</button>}
              </>
            )}
          </div>
        )}
        {room === 'off' && consentActive && !roomAvailable && caps !== null && (
          <div className="text-[11px] text-amber-800 flex items-center gap-1.5"><AlertTriangle size={12} /> Room recording runs only on the hospital speech server{caps.asr ? ` (no model for ${LANG_LABEL[roomLang] || roomLang})` : ', which is not running'}. Room audio is never sent to a cloud service. Use dictation.</div>
        )}

        {sheetOpen && !consentActive && (
          <ConsentSheet
            minor={minor}
            patientLanguage={patientLanguage}
            saving={saving}
            onCancel={() => setSheetOpen(false)}
            onDecide={async input => { if (await saveConsent(input)) setSheetOpen(false); }}
          />
        )}
      </div>

      {(dictating || room === 'recording') && <AudioVisualizer isRecording color="#0f172a" height={30} />}
      {pending > 0 && <div className="text-[11px] text-muted-foreground flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Transcribing {pending} clip{pending > 1 ? 's' : ''} on the hospital server…</div>}
      {error && <div className="text-[11px] font-semibold text-rose-700 flex items-center gap-1.5" role="alert"><AlertTriangle size={12} /> {error}</div>}
      {info && <div className="text-[11px] text-foreground flex items-center gap-1.5" role="status"><Info size={12} className="text-primary" /> {info}</div>}

      {unclear.length > 0 && (
        <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
          <AlertTriangle size={12} className="text-amber-600" />
          {unclear.length} unclear clip{unclear.length > 1 ? 's' : ''} not added: the speech engine’s re-checks disagreed (noise, or very short speech).
          <button type="button" onClick={() => { setLines(prev => [...prev, ...unclear]); setUnclear([]); }} className="font-semibold text-foreground underline">Show anyway</button>
          <button type="button" onClick={() => setUnclear([])} className="font-semibold underline">Discard</button>
        </div>
      )}

      {lines.length > 0 && (
        <ol className="max-h-72 overflow-y-auto flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-2.5" aria-label="Transcript">
          {lines.map(l => {
            const chips = scribeChips(l.text, { conversational: l.mode === 'room' && l.who !== 'clinician' });
            return (
              <li key={l.id} className="text-xs">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                  <span className={`font-bold uppercase px-1 rounded ${l.mode === 'room' ? 'bg-rose-500/10 text-rose-700' : 'bg-primary/10 text-primary'}`}>{l.mode === 'room' ? 'Room' : 'Dictation'}</span>
                  <span>{l.mode === 'room' ? (l.who ? `${WHO_LABEL[l.who]} — marked by you` : 'speaker not identified') : 'you'}</span>
                  <span>{l.at}{l.seconds ? ` · ${Math.round(l.seconds)} s` : ''}</span>
                  {l.engine === 'browser (cloud)' && <span className="text-amber-700">browser (cloud)</span>}
                  {l.edited && <span className="italic">edited</span>}
                  <span className="ml-auto flex items-center gap-0.5">
                    {l.mode === 'room' && (
                      <select value={l.who || ''} onChange={e => setLines(prev => prev.map(x => (x.id === l.id ? { ...x, who: (e.target.value || undefined) as Who | undefined } : x)))} aria-label="Who said this (your mark)" className="h-6 px-1 rounded border border-border bg-background text-[10px]">
                        <option value="">Who said it? (not marked)</option>
                        <option value="patient">Patient</option>
                        <option value="attendant">Attendant / relative</option>
                        <option value="clinician">Me (clinician)</option>
                      </select>
                    )}
                    <button type="button" onClick={() => insert([l])} className="p-1 rounded hover:bg-muted" aria-label="Add this line to the notes" title="Add to the clinical notes"><FileText size={11} /></button>
                    <button type="button" onClick={() => { setEditing(l.id); setEditText(l.text); }} className="p-1 rounded hover:bg-muted" aria-label="Correct this line"><Pencil size={11} /></button>
                    <button type="button" onClick={() => setLines(prev => prev.filter(x => x.id !== l.id))} className="p-1 rounded hover:bg-muted hover:text-rose-600" aria-label="Delete this line"><Trash2 size={11} /></button>
                  </span>
                </div>
                {editing === l.id ? (
                  <div className="flex gap-1.5 mt-1">
                    <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={2} className="flex-1 rounded-lg border border-border bg-background p-1.5 text-xs" aria-label="Corrected text" autoFocus />
                    <div className="flex flex-col gap-1">
                      <button type="button" onClick={() => saveEdit(l.id)} className="p-1.5 rounded bg-primary text-primary-foreground" aria-label="Save correction"><Check size={12} /></button>
                      <button type="button" onClick={() => setEditing(null)} className="p-1.5 rounded border border-border" aria-label="Cancel correction"><X size={12} /></button>
                    </div>
                  </div>
                ) : (
                  <p className="text-foreground leading-relaxed mt-0.5">
                    {l.words.map((w, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && ' '}
                        {w.uncertain ? <span className="underline decoration-dotted decoration-amber-600 underline-offset-2" title="The speech engine heard this differently on a re-check — verify it">{w.text}</span> : w.text}
                      </React.Fragment>
                    ))}
                  </p>
                )}
                {chips.length > 0 && <div className="flex flex-wrap gap-1 mt-1">{chips.map((c, k) => <span key={k} className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${CHIP[c.kind]}`}>{c.label}</span>)}</div>}
              </li>
            );
          })}
        </ol>
      )}

      {lines.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => insert(lines)} className="h-8 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 bg-primary text-primary-foreground"><FileText size={13} /> Add all to notes</button>
          <button type="button" onClick={() => onAutoExtract(transcript)} className="h-8 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 border border-border bg-card hover:bg-muted">
            <Sparkles size={13} className="text-primary" /> Find medicines
          </button>
          <button type="button" onClick={() => setLines([])} className="h-8 px-2.5 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted">Clear</button>
          {uncertainTotal > 0 && <span className="text-[10.5px] text-amber-800">{uncertainTotal} uncertain word{uncertainTotal > 1 ? 's' : ''} (dotted) — check them.</span>}
        </div>
      )}
      <p className="text-[10.5px] text-muted-foreground leading-snug">
        Speech-to-text is a draft: check names, numbers and doses. Nothing here is saved until you add it to the notes; medicines found are only offered for you to confirm. Audio is never stored.
      </p>
    </section>
  );
};

// ── Consent sheet ───────────────────────────────────────────────────────────
interface ConsentSheetProps {
  minor: boolean;
  patientLanguage?: string;
  saving: boolean;
  onCancel: () => void;
  onDecide: (input: { event: 'given' | 'declined'; consenter: 'patient' | 'guardian' | 'representative'; consenterName?: string; relationship?: string; noticeLanguage: string; othersInformed: boolean; method: string }) => void;
}

const ConsentSheet: React.FC<ConsentSheetProps> = ({ minor, patientLanguage, saving, onCancel, onDecide }) => {
  const other = patientLanguage && patientLanguage !== 'hi' && patientLanguage !== 'en' ? patientLanguage : null;
  const [noticeLang, setNoticeLang] = useState<string>(patientLanguage === 'en' ? 'en' : 'hi');
  const [consenter, setConsenter] = useState<'patient' | 'guardian' | 'representative'>(minor ? 'guardian' : 'patient');
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [othersInformed, setOthersInformed] = useState(false);
  const shown: NoticeLang = noticeLang === 'en' ? 'en' : 'hi';
  const notice = RECORDING_NOTICE[shown];
  const needsName = consenter !== 'patient';
  const canAgree = othersInformed && (!needsName || (name.trim().length > 1 && relationship.trim().length > 1)) && !(minor && consenter === 'patient');
  const decide = (event: 'given' | 'declined') => onDecide({
    event, consenter, consenterName: needsName ? name.trim() : undefined, relationship: needsName ? relationship.trim() : undefined,
    noticeLanguage: noticeLang, othersInformed, method: noticeLang === other ? 'verbal, notice explained in the patient’s language' : 'verbal, notice read aloud'
  });

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex flex-col gap-2.5" role="group" aria-label="Recording consent">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-bold text-foreground">Read this to the patient before recording</span>
        <div className="flex gap-1 p-0.5 rounded-lg bg-muted border border-border" role="radiogroup" aria-label="Notice language">
          {(['hi', 'en', ...(other ? [other] : [])] as string[]).map(l => (
            <button key={l} type="button" role="radio" aria-checked={noticeLang === l} onClick={() => setNoticeLang(l)} className={`px-2 py-0.5 rounded text-[11px] font-bold ${noticeLang === l ? 'bg-card shadow-xs' : 'text-muted-foreground'}`}>
              {LANG_LABEL[l] || l}{l === other ? ' (explain)' : ''}
            </button>
          ))}
        </div>
      </div>
      {noticeLang === other && <div className="text-[11px] text-amber-800">No written notice in {LANG_LABEL[other!] || other} yet: explain each point below in the patient’s language.</div>}
      <div lang={shown} className="text-[12.5px] leading-relaxed text-foreground">
        <p>{notice.intro}</p>
        <ul className="list-disc pl-5 mt-1 space-y-0.5">{notice.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
        <p className="mt-1 font-semibold">{notice.question}</p>
      </div>

      <div className="flex flex-col gap-1.5 text-[11.5px]">
        <span className="font-bold">Who is answering?</span>
        <div className="flex gap-3 flex-wrap">
          <label className={`flex items-center gap-1 ${minor ? 'opacity-50' : ''}`}><input type="radio" name="consenter" checked={consenter === 'patient'} disabled={minor} onChange={() => setConsenter('patient')} /> The patient</label>
          <label className="flex items-center gap-1"><input type="radio" name="consenter" checked={consenter === 'guardian'} onChange={() => setConsenter('guardian')} /> Parent / guardian</label>
          <label className="flex items-center gap-1"><input type="radio" name="consenter" checked={consenter === 'representative'} onChange={() => setConsenter('representative')} /> Other representative</label>
        </div>
        {minor && <span className="text-muted-foreground">The patient is under 18: a parent or guardian answers.</span>}
        {needsName && (
          <div className="flex gap-2 flex-wrap">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Their name" aria-label="Name of the person giving consent" className="flex-1 min-w-[140px] px-2 py-1 rounded-lg border border-border bg-background text-xs" />
            <input value={relationship} onChange={e => setRelationship(e.target.value)} placeholder="Relationship (e.g. mother)" aria-label="Relationship to the patient" className="flex-1 min-w-[140px] px-2 py-1 rounded-lg border border-border bg-background text-xs" />
          </div>
        )}
        <label className="flex items-start gap-1.5"><input type="checkbox" checked={othersInformed} onChange={e => setOthersInformed(e.target.checked)} className="mt-0.5" aria-label="Others in the room were told" /> Everyone else in the room has been told and does not object (or no one else is present).</label>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <button type="button" disabled={!canAgree || saving} onClick={() => decide('given')} data-testid="scribe-consent-agree" className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50">They agree — record consent</button>
        <button type="button" disabled={saving} onClick={() => decide('declined')} data-testid="scribe-consent-decline" className="h-8 px-3 rounded-lg border border-border text-xs font-bold hover:bg-muted">They decline</button>
        <button type="button" onClick={onCancel} className="h-8 px-2.5 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted">Cancel</button>
        <span className="text-[10.5px] text-muted-foreground">Saying no does not change their care. Consent covers this visit only.</span>
      </div>
    </div>
  );
};
