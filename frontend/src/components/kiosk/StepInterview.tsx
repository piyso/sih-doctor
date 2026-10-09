import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertOctagon, Check, Loader2, Mic, MicOff, Volume2, WifiOff, MessageCircleQuestion } from 'lucide-react';
import { PatientHistory, SocratesSymptom } from '../../types/api';
import { api, InterviewQuestion, InterviewRedFlag, InterviewResult } from '../../services/api';
import { KioskPatient } from './Step2AbhaAuth';
import { RegisterNav, useStepNav } from './kioskNav';
import { BCP47, kioskText, normalizeLang } from '../../utils/kioskLocalization';
import { sovereignSound } from '../../utils/audio';

/**
 * Adaptive history interview (PS Module A). The question plan, branching and red-flag probes live on
 * the server (/api/kiosk/interview); this step only renders one question at a time, speaks it
 * aloud, and routes Back / Next through the kiosk dock. Every answer is immediately persisted.
 */

interface StepInterviewProps {
  patient: KioskPatient;
  language?: string;
  symptoms: SocratesSymptom[];
  transcript: string;
  interviewId: string | null;
  setInterviewId: (id: string | null) => void;
  setHistory: React.Dispatch<React.SetStateAction<PatientHistory>>;
  setSymptoms: React.Dispatch<React.SetStateAction<SocratesSymptom[]>>;
  setRedFlags: React.Dispatch<React.SetStateAction<string[]>>;
  onInterviewResult?: (result: InterviewResult) => void;
  onRequestSos: () => void;
  onNext: () => void;
  onBack: () => void;
  registerNav?: RegisterNav;
}

/** Map what the body-map / voice step already captured onto a complaint family, so the first question is skipped. */
const familyFromSymptom = (s?: SocratesSymptom, transcript = ''): string | null => {
  const text = `${s?.name || ''} ${s?.site || ''} ${s?.key || ''} ${transcript}`.toLowerCase();
  const rules: Array<[string, RegExp]> = [
    ['chest_pain', /chest|seene|seena|chhati|सीने|छाती|precord|angina/],
    ['breathless', /breathless|dyspn|saans|sans|सांस|साँस|shwas/],
    ['pregnancy', /pregnan|garbh|गर्भ|labour|prasav|प्रसव/],
    ['injury', /injur|accident|fall|bite|snake|dog|burn|chot|चोट|kaat|काट|jal gaya|जल/],
    ['headache', /headache|migraine|sir ?dard|सिर|सर दर्द|head$/],
    ['fever', /fever|bukhar|बुखार|jwara|taap|tap\b/],
    ['cough', /cough|khansi|खांसी|खाँसी|kasa|balgam/],
    ['abdominal_pain', /abdom|stomach|pet\b|pet |पेट|udar|epigastr|belly/],
    ['vomiting_diarrhoea', /vomit|ulti|उल्टी|diarr|dast|दस्त|loose/],
    ['urinary', /urin|peshab|पेशाब|dysuria|mutra/],
    ['joint_pain', /joint|knee|ghutn|घुटन|back|kamar|कमर|spine|shoulder|hip|sandhi|arthr/],
    ['skin', /skin|rash|itch|khujli|खुजली|daane|दाने|twacha|त्वचा/],
    ['dizziness', /dizz|chakkar|चक्कर|weak|kamzor|कमज़ोर|कमजोर|faint|giddi/],
    ['mental', /sleep|neend|नींद|anxi|ghabrahat|घबराहट|depress|udas|उदास|mood/]
  ];
  for (const [fam, re] of rules) if (re.test(text)) return fam;
  return null;
};

export const StepInterview: React.FC<StepInterviewProps> = ({
  patient, language = 'hi', symptoms, transcript, interviewId, setInterviewId, setHistory, setSymptoms, setRedFlags, onInterviewResult, onRequestSos, onNext, onBack, registerNav
}) => {
  const lang = normalizeLang(language);
  const tx = kioskText(lang);
  const [question, setQuestion] = useState<InterviewQuestion | null>(null);
  const [value, setValue] = useState<any>(undefined);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [done, setDone] = useState(false);
  const [redFlags, setLocalRedFlags] = useState<InterviewRedFlag[]>([]);
  const [showAnswerHint, setShowAnswerHint] = useState(false);
  const [ttsLangs, setTtsLangs] = useState<string[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const askedRef = useRef<InterviewQuestion[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recRef = useRef<any>(null);
  const startedRef = useRef(false);

  const stopSpeaking = useCallback(() => {
    try { audioRef.current?.pause(); } catch {}
    audioRef.current = null;
    try { window.speechSynthesis?.cancel(); } catch {}
    setSpeaking(false);
  }, []);

  // ---------------------------------------------------------------- Start or resume
  useEffect(() => {
    let alive = true;
    api.getAiStatus().then(s => { if (alive) setTtsLangs(((s?.capabilities?.tts as any)?.languages as string[]) || []); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const showQuestion = useCallback((q: InterviewQuestion | null) => {
    setQuestion(q);
    setValue(q?.type === 'multi' ? [] : undefined);
    setShowAnswerHint(false);
    if (q && !askedRef.current.some(a => a.id === q.id)) askedRef.current.push(q);
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      setBusy(true);
      try {
        if (interviewId) {
          const r = await api.resumeInterview(interviewId);
          if (r.done) setDone(true); else showQuestion(r.question);
        } else {
          const r = await api.startInterview({
            language: lang, careStream: patient.careStream,
            patient: { age: Number(patient.age) || null, gender: patient.gender, isPregnant: patient.isPregnant === true }
          });
          setInterviewId(r.interviewId);
          // What the body map / voice step already told us answers the first question.
          const fam = familyFromSymptom(symptoms[0], transcript);
          if (fam) {
            let step = await api.answerInterview(r.interviewId, { questionId: 'cc_family', value: fam });
            if (step.question?.id === 'cc_text' && transcript.trim()) step = await api.answerInterview(r.interviewId, { questionId: 'cc_text', value: transcript.trim().slice(0, 500) });
            setLocalRedFlags(step.redFlags);
            showQuestion(step.question);
          } else {
            showQuestion(r.question);
          }
        }
      } catch (e) {
        console.warn('[Interview] unavailable', e);
        setOffline(true);
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------- Read aloud
  const speak = useCallback(async (text: string) => {
    stopSpeaking();
    setSpeaking(true);
    try {
      if (ttsLangs.includes(lang)) {
        const blob = await api.synthesizeSpeech(text, lang);
        const audio = new Audio(URL.createObjectURL(blob));
        audioRef.current = audio;
        audio.onended = () => setSpeaking(false);
        await audio.play();
        return;
      }
    } catch {
      /* fall through to the browser voice */
    }
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = BCP47[lang] || 'hi-IN';
      u.rate = 0.9;
      u.onend = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
    } catch {
      setSpeaking(false);
    }
  }, [lang, ttsLangs, stopSpeaking]);

  useEffect(() => {
    if (question) speak(question.text);
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id]);

  // ---------------------------------------------------------------- Voice answer for text questions (browser recognizer; on-prem ASR is wired in step 3)
  const toggleListening = () => {
    if (listening) { try { recRef.current?.stop(); } catch {} setListening(false); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = BCP47[lang] || 'hi-IN';
    rec.interimResults = false;
    rec.onresult = (ev: any) => { const t = ev.results?.[0]?.[0]?.transcript || ''; if (t) setValue((prev: any) => (prev ? `${prev} ${t}` : t)); };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    stopSpeaking();
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  };

  // ---------------------------------------------------------------- Answer / skip / back
  const hasValue = useMemo(() => {
    if (!question) return false;
    if (question.type === 'multi') return Array.isArray(value) && value.length > 0;
    if (question.type === 'text') return typeof value === 'string' && value.trim().length > 0;
    return value !== undefined && value !== null && value !== '';
  }, [question, value]);

  const submit = async (skip = false) => {
    if (!question || !interviewId || busy) return;
    setBusy(true);
    try {
      const step = await api.answerInterview(interviewId, skip ? { questionId: question.id, skip: true } : { questionId: question.id, value: question.type === 'text' ? String(value).trim() : value });
      setLocalRedFlags(step.redFlags);
      if (step.redFlags.some(f => f.tier === 'sos') && !redFlags.some(f => f.tier === 'sos')) { try { sovereignSound.playClinicalAlert(); } catch {} }
      if (step.done) await finish(); else showQuestion(step.question);
    } catch (e) {
      console.warn('[Interview] answer failed', e);
      setOffline(true);
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!interviewId) return;
    const result = await api.finishInterview(interviewId);
    setHistory(prev => ({ ...prev, ...result.history, conditions: Array.from(new Set([...(prev.conditions || []), ...(result.history.conditions || [])])), allergies: result.history.allergies || prev.allergies, currentMedicines: result.history.currentMedicines || prev.currentMedicines }));
    if (result.symptoms.length) {
      setSymptoms(prev => {
        const s = result.symptoms[0];
        if (!prev.length) return [{ ...s, key: `interview:${s.name}` } as any];
        const [first, ...rest] = prev;
        return [{ ...first, onset: first.onset || s.onset, character: first.character || s.character, radiation: first.radiation || s.radiation, timing: first.timing || s.timing, severityScore: first.severityScore || s.severityScore, associations: Array.from(new Set([...(first.associations || []), ...(s.associations || (s as any).associated || [])])) } as any, ...rest];
      });
    }
    if (result.redFlags.length) setRedFlags(prev => Array.from(new Set([...prev, ...result.redFlags.map(f => f.label)])));
    onInterviewResult?.(result);
    setDone(true);
    try { sovereignSound.playCrystalChime(); } catch {}
  };

  const goBack = () => {
    stopSpeaking();
    const list = askedRef.current;
    const idx = question ? list.findIndex(q => q.id === question.id) : list.length;
    if (idx > 0) showQuestion(list[idx - 1]);
    else onBack();
  };

  const sos = redFlags.some(f => f.tier === 'sos');

  useStepNav(registerNav, {
    canNext: offline || done || !!question?.optional || hasValue,
    nextLabel: done || offline ? undefined : question?.optional && !hasValue ? tx('ivSkip') : undefined,
    blockedHint: tx('ivAnswerFirst'),
    busy,
    onNext: () => { if (done || offline) onNext(); else if (hasValue) submit(false); else if (question?.optional) submit(true); },
    onBack: goBack,
    onBlockedNext: () => setShowAnswerHint(true)
  });

  // ---------------------------------------------------------------- Render
  const progress = question?.progress;
  const pct = progress ? Math.round((progress.answered / Math.max(1, progress.planned)) * 100) : done ? 100 : 0;
  const choice = (v: string, label: string, selected: boolean, onClick: () => void) => (
    <button key={v} type="button" onClick={() => { sovereignSound.playMechanicalSnap(); onClick(); }} aria-pressed={selected}
      className={`text-left px-4 py-3 rounded-2xl border-2 text-base font-semibold transition-all active:scale-[0.98] ${selected ? 'border-primary bg-primary/10 text-foreground' : 'border-border/80 bg-card text-foreground hover:border-primary/50'}`}>
      <span className="flex items-center gap-2">{selected && <Check size={16} className="text-primary shrink-0" />}{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><MessageCircleQuestion size={18} /></div>
          <div className="min-w-0">
            <div className="text-sm font-heading font-bold text-foreground truncate">{tx('stepTitleInterview')}</div>
            {progress && <div className="text-[11px] text-muted-foreground">{progress.answered}/{progress.planned} · {question?.section}</div>}
          </div>
        </div>
        {question && (
          <button type="button" onClick={() => (speaking ? stopSpeaking() : speak(question.text))} className="tactile-btn px-3 py-2 rounded-full text-xs font-semibold gap-1.5" aria-label={tx('listenBtn')}>
            {speaking ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />} {speaking ? tx('speakingBtn') : tx('listenBtn')}
          </button>
        )}
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>

      {sos && (
        <div className="p-3 rounded-2xl bg-rose-500/10 border-2 border-rose-500/40 flex items-start gap-3" role="alert">
          <AlertOctagon size={20} className="text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-rose-800 dark:text-rose-200">{tx('ivRedFlag')}</div>
            <ul className="text-xs text-rose-700 dark:text-rose-300 mt-1 list-disc list-inside">{redFlags.filter(f => f.tier === 'sos').map(f => <li key={f.questionId}>{f.label}</li>)}</ul>
          </div>
          <button type="button" onClick={onRequestSos} className="px-3 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold shrink-0">{tx('sosBtn')}</button>
        </div>
      )}

      {offline && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-sm text-amber-900 dark:text-amber-100 flex items-center gap-2"><WifiOff size={16} /> {tx('ivOffline')}</div>
      )}

      {done && !offline && (
        <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center">
          <Check size={28} className="mx-auto text-emerald-600 mb-2" />
          <div className="text-base font-bold text-foreground">{tx('ivDone')}</div>
        </div>
      )}

      {!done && !offline && !question && busy && (
        <div className="p-8 flex items-center justify-center text-muted-foreground"><Loader2 size={22} className="animate-spin" /></div>
      )}

      {!done && !offline && question && (
        <div className="physical-card p-4 sm:p-6 rounded-3xl flex flex-col gap-4">
          <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-foreground leading-snug">{question.text}</h2>
          {lang !== 'en' && question.textEn !== question.text && <p className="text-sm text-muted-foreground -mt-2">{question.textEn}</p>}
          {question.optional && <p className="text-xs text-muted-foreground">({tx('optional')})</p>}

          {question.type === 'yesno' && (
            <div className="grid grid-cols-2 gap-3">
              {choice('yes', tx('yes'), value === true, () => setValue(true))}
              {choice('no', tx('no'), value === false, () => setValue(false))}
            </div>
          )}

          {question.type === 'single' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(question.options || []).map(o => choice(o.value, o.label, value === o.value, () => setValue(o.value)))}
            </div>
          )}

          {question.type === 'multi' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(question.options || []).map(o => {
                const arr: string[] = Array.isArray(value) ? value : [];
                const exclusive = o.value === 'none';
                const selected = arr.includes(o.value);
                return choice(o.value, o.label, selected, () => setValue(selected ? arr.filter(x => x !== o.value) : exclusive ? [o.value] : [...arr.filter(x => x !== 'none'), o.value]));
              })}
            </div>
          )}

          {(question.type === 'scale' || question.type === 'number') && (
            <div className="flex flex-col gap-3">
              {question.type === 'scale' ? (
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                  {Array.from({ length: (question.max ?? 10) - (question.min ?? 1) + 1 }, (_, i) => (question.min ?? 1) + i).map(n => (
                    <button key={n} type="button" onClick={() => { sovereignSound.playMechanicalSnap(); setValue(n); }} aria-pressed={value === n}
                      className={`py-3 rounded-xl border-2 font-mono font-bold text-base ${value === n ? 'border-primary bg-primary/10' : 'border-border/80 bg-card'} ${n >= 8 ? 'text-rose-600' : n >= 5 ? 'text-amber-600' : 'text-emerald-700'}`}>{n}</button>
                  ))}
                </div>
              ) : (
                <input inputMode="numeric" value={value ?? ''} onChange={e => setValue(e.target.value.replace(/[^\d]/g, '').slice(0, 3))} min={question.min} max={question.max}
                  className="w-40 px-4 py-3 rounded-xl border-2 border-border bg-background font-mono text-xl font-bold" aria-label={question.textEn} />
              )}
            </div>
          )}

          {question.type === 'text' && (
            <div className="flex flex-col gap-2">
              <textarea value={typeof value === 'string' ? value : ''} onChange={e => setValue(e.target.value.slice(0, 500))} rows={3} placeholder={tx('ivTypeHere')}
                className="w-full px-4 py-3 rounded-xl border-2 border-border bg-background text-base" aria-label={question.textEn} />
              {question.voice && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) && (
                <button type="button" onClick={toggleListening} className={`self-start tactile-btn px-3 py-2 rounded-full text-xs font-semibold gap-1.5 ${listening ? 'text-rose-600' : ''}`}>
                  {listening ? <MicOff size={14} /> : <Mic size={14} />} {listening ? tx('speakingBtn') : tx('listenBtn')}
                </button>
              )}
            </div>
          )}

          {showAnswerHint && !hasValue && !question.optional && <p className="text-xs font-semibold text-amber-700" role="alert">{tx('ivAnswerFirst')}</p>}
        </div>
      )}
    </div>
  );
};
