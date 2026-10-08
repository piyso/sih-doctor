import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Mic, MicOff, CheckCircle2, Edit3, Undo2, Trash2, Shield, Flame, Zap, Activity, HeartPulse, Wind,
  AlertTriangle, AlertOctagon, X, Sparkles, MapPin, Keyboard, Loader2
} from 'lucide-react';
import { AudioVisualizer } from '../common/AudioVisualizer';
import { api } from '../../services/api';
import { sovereignSound } from '../../utils/audio';
import { SocratesSymptom, VitalsData } from '../../types/api';
import { CLUSTER_DISAMBIGUATION, LOCUS_TO_CLUSTER } from './AnatomicalMannequin3D';
import { BodyMapStage } from './BodyMapStage';
import {
  BCP47, KioskTextKey, PAIN_CHARACTERS, SupportedKioskLanguage, kioskText, normalizeLang, regionName, regionNameEn
} from '../../utils/kioskLocalization';
import {
  KioskSymptom, PRIVATE_SYMPTOMS, REGIONAL_SYMPTOMS, REGION_TO_CATEGORY, SYSTEMIC_CATEGORIES, SYSTEMIC_SYMPTOMS,
  SystemicCategoryId, symptomLabel
} from '../../utils/kioskSymptomCatalog';
import {
  detectRegionFromSpeech, extractSymptomsFromSpeech, mergeSpeechPieces, sanitizeVernacularTranscript
} from '../../utils/vernacularSpeech';
import { RegisterNav, useStepNav } from './kioskNav';
import { aiCapabilities, cloudSpeechAllowed, startRecording, Recorder } from '../../utils/onPremAsr';
import { analyseComplaint } from '../../utils/clinicalLexicon';
import { kioskSymptomMatcher, SUGGEST_MIN_SCORE } from '../../utils/symptomMatcher';

interface Step3VoiceBodyIntakeProps {
  transcript: string;
  setTranscript: (text: string) => void;
  selectedBodyRegion: string;
  setSelectedBodyRegion: (region: string) => void;
  symptoms: SocratesSymptom[];
  setSymptoms: React.Dispatch<React.SetStateAction<SocratesSymptom[]>>;
  vitals: VitalsData;
  setVitals: React.Dispatch<React.SetStateAction<VitalsData>>;
  redFlags?: string[];
  language?: string;
  onExtras: (extra: { redFlags?: string[]; causalDagOverride?: any; mlcCaseInfo?: any; airborneIsolationInfo?: any }) => void;
  /** Opens the kiosk's SOS confirmation (same as the header button). */
  onRequestSos?: () => void;
  registerNav?: RegisterNav;
  onNext: () => void;
  onBack: () => void;
}

type Severity = 'mild' | 'moderate' | 'severe';
type DurationKey = 'today' | '23' | 'week' | 'month';

const SEVERITY_SCORE: Record<Severity, number> = { mild: 3, moderate: 5, severe: 8 };
const scoreToSeverity = (score?: number): Severity | null =>
  !score ? null : score <= 3 ? 'mild' : score <= 6 ? 'moderate' : 'severe';

const DURATIONS: Array<{ key: DurationKey; label: KioskTextKey; en: string }> = [
  { key: 'today', label: 'durToday', en: 'Since today' },
  { key: '23', label: 'dur23', en: '2–3 days' },
  { key: 'week', label: 'durWeek', en: 'About a week' },
  { key: 'month', label: 'durMonth', en: '1 month or more' }
];

const SENSATION_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  dull: Shield, sharp: Zap, crushing: HeartPulse, burning: Flame, throbbing: Activity, stiffness: Wind
};

const SPEECH_LANGS: SupportedKioskLanguage[] = ['hi', 'en', 'mr', 'bn', 'ta', 'te', 'gu', 'kn', 'ml', 'pa', 'or'];
const SPEECH_LANG_NAMES: Record<SupportedKioskLanguage, string> = {
  hi: 'हिन्दी', en: 'English', mr: 'मराठी', bn: 'বাংলা', ta: 'தமிழ்', te: 'తెలుగు',
  gu: 'ગુજરાતી', kn: 'ಕನ್ನಡ', ml: 'മലയാളം', pa: 'ਪੰਜਾਬੀ', or: 'ଓଡ଼ିଆ'
};

const blankSymptom = (): Omit<SocratesSymptom, 'site'> => ({
  onset: '', character: '', radiation: '', associations: [], timing: '', exacerbatingFactors: [], relievingFactors: [], severityScore: 0
});

export const Step3VoiceBodyIntake: React.FC<Step3VoiceBodyIntakeProps> = ({
  transcript,
  setTranscript,
  selectedBodyRegion,
  setSelectedBodyRegion,
  symptoms,
  setSymptoms,
  vitals,
  setVitals,
  language = 'hi',
  onExtras,
  onRequestSos,
  registerNav,
  onNext,
  onBack
}) => {
  const lang = normalizeLang(language);
  const tx = kioskText(lang);

  // ---------------------------------------------------------------- Restore previous choices
  const primaryExisting = symptoms[0];
  const [subPhase, setSubPhase] = useState<'body' | 'symptoms'>(() => (symptoms.length > 0 || transcript ? 'symptoms' : 'body'));
  const [severity, setSeverity] = useState<Severity | null>(() => scoreToSeverity(primaryExisting?.severityScore));
  const [duration, setDuration] = useState<DurationKey | null>(() => DURATIONS.find(d => d.en === primaryExisting?.onset)?.key || null);
  const [sensation, setSensation] = useState<string | null>(
    () => PAIN_CHARACTERS.find(c => c.value === primaryExisting?.character)?.sensationKey || null
  );
  const [chips, setChips] = useState<Record<string, KioskSymptom>>(() => {
    const restored: Record<string, KioskSymptom> = {};
    symptoms.filter(s => s.source === 'chip' && s.name).forEach(s => {
      const label = s.labelLocal || s.name!;
      restored[s.name!] = { en: s.name!, hi: label, mr: label, bn: label, ta: label, te: label, isEmergency: s.isEmergency };
    });
    return restored;
  });
  const [dismissedVoice, setDismissedVoice] = useState<string[]>([]);
  const [parserSymptoms, setParserSymptoms] = useState<SocratesSymptom[]>([]);
  const [systemicCategory, setSystemicCategory] = useState<SystemicCategoryId>('general');
  const [isPrivateMode, setIsPrivateMode] = useState(false);
  const [showPrivateText, setShowPrivateText] = useState(false);
  const [dismissedMismatch, setDismissedMismatch] = useState<string | null>(null);

  // Speech
  const [micLang, setMicLang] = useState<SupportedKioskLanguage>(lang);
  const [isRecording, setIsRecording] = useState(false);
  const [micError, setMicError] = useState<KioskTextKey | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState('');
  const recognitionRef = useRef<any>(null);
  const recorderRef = useRef<Recorder | null>(null);
  const [onPremAsr, setOnPremAsr] = useState(false);
  const [llmAvailable, setLlmAvailable] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  // AI-found symptoms are only suggestions until the patient confirms them.
  const [aiSuggestions, setAiSuggestions] = useState<Array<{ symptom: string; evidence: string }>>([]);
  const [acceptedAi, setAcceptedAi] = useState<SocratesSymptom[]>([]);
  const [dismissedAi, setDismissedAi] = useState<string[]>([]);
  const transcriptBeforeRecordingRef = useRef('');
  const latestTranscriptRef = useRef(transcript);
  const parseSeqRef = useRef(0);
  const parseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setMicLang(lang); }, [lang]);
  useEffect(() => {
    let alive = true;
    aiCapabilities().then(c => { if (alive) { setOnPremAsr(c.asr); setLlmAvailable(c.llm); } }).catch(() => {});
    return () => { alive = false; };
  }, []);
  useEffect(() => { latestTranscriptRef.current = transcript; }, [transcript]);

  useEffect(() => () => {
    if (parseTimerRef.current) clearTimeout(parseTimerRef.current);
    try { recognitionRef.current?.stop(); } catch {}
    recorderRef.current?.cancel();
  }, []);

  // ---------------------------------------------------------------- Derived symptom model
  const voiceFindings = useMemo(() => extractSymptomsFromSpeech(transcript, micLang), [transcript, micLang]);
  const durationEn = DURATIONS.find(d => d.key === duration)?.en || voiceFindings.duration || '';
  const severityScore = severity ? SEVERITY_SCORE[severity] : 0;
  const characterValue = PAIN_CHARACTERS.find(c => c.sensationKey === sensation)?.value || '';

  const composedSymptoms = useMemo<SocratesSymptom[]>(() => {
    const list: SocratesSymptom[] = [];
    const existingPrimary = symptoms[0];
    const keep = (key: string) => symptoms.find(s => s.key === key);

    if (selectedBodyRegion) {
      const key = `area:${selectedBodyRegion}`;
      const prev = keep(key);
      list.push({
        ...blankSymptom(),
        key,
        source: 'area',
        name: `Pain / discomfort — ${regionNameEn(selectedBodyRegion)}`,
        symptom_name: `Pain / discomfort — ${regionNameEn(selectedBodyRegion)}`,
        labelLocal: regionName(selectedBodyRegion, lang),
        site: selectedBodyRegion,
        radiation: prev?.radiation || '',
        onset: durationEn,
        character: characterValue,
        severityScore
      });
    }

    Object.values(chips).forEach(chip => {
      const key = `chip:${chip.en}`;
      list.push({
        ...blankSymptom(),
        key,
        source: 'chip',
        name: chip.en,
        symptom_name: chip.en,
        labelLocal: symptomLabel(chip, lang),
        site: selectedBodyRegion || 'General',
        onset: durationEn,
        character: characterValue,
        severityScore,
        isEmergency: chip.isEmergency
      });
    });

    voiceFindings.symptoms
      .filter(v => !dismissedVoice.includes(v.key!))
      // Pain at the already-selected area is the same complaint as the area entry.
      .filter(v => !(selectedBodyRegion && v.site === selectedBodyRegion))
      .forEach(v => list.push({ ...v, onset: durationEn || v.onset, character: v.character || characterValue, severityScore: severityScore || v.severityScore }));

    // Symptoms the patient confirmed from the AI suggestions.
    acceptedAi.forEach(a => { if (!list.some(x => (x.name || '').toLowerCase() === (a.name || '').toLowerCase())) list.push({ ...a, onset: durationEn || a.onset, character: a.character || characterValue }); });

    // The server parser is only a fallback when nothing was recognised locally.
    if (list.length === 0) parserSymptoms.forEach(p => list.push(p));

    // Carry over Step 4 edits of the main complaint (radiation, edited site text).
    if (list[0] && existingPrimary && existingPrimary.key === list[0].key) {
      list[0] = { ...list[0], radiation: existingPrimary.radiation || list[0].radiation };
    }
    return list;
    // `symptoms` is read only for carrying over Step 4 edits; including it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBodyRegion, chips, voiceFindings, dismissedVoice, parserSymptoms, acceptedAi, durationEn, characterValue, severityScore, lang]);

  useEffect(() => {
    setSymptoms(prev => (JSON.stringify(prev) === JSON.stringify(composedSymptoms) ? prev : composedSymptoms));
  }, [composedSymptoms, setSymptoms]);

  // ---------------------------------------------------------------- Server parse (extras only)
  const runServerParse = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean) {
      setParserSymptoms([]);
      onExtras({ redFlags: [], causalDagOverride: null, mlcCaseInfo: null, airborneIsolationInfo: null });
      return;
    }
    const seq = ++parseSeqRef.current;
    setIsParsing(true);
    try {
      const extracted = await api.parseAudioTranscript(clean);
      if (seq !== parseSeqRef.current) return; // a newer request superseded this one
      setParserSymptoms((extracted.symptoms || []).map((s: any, i: number) => ({
        ...blankSymptom(),
        ...s,
        key: `parser:${s.name || s.character || i}`,
        source: 'parser' as const,
        name: s.name || s.character || 'Reported symptom',
        labelLocal: s.name || s.character || 'Reported symptom'
      })));
      onExtras({
        redFlags: extracted.redFlagTriggers || [],
        causalDagOverride: extracted.causalDagOverride ?? null,
        mlcCaseInfo: extracted.mlcCaseInfo ?? null,
        airborneIsolationInfo: extracted.airborneIsolationInfo ?? null
      });
      // Only take vitals the patient actually spoke (numbers present), and never overwrite typed ones.
      const v = extracted.vitals || {};
      if (/\d/.test(clean) && (v.bp || v.pulse || v.temp || v.spo2)) {
        setVitals(prev => ({
          bp: prev.bp || v.bp || prev.bp,
          pulse: prev.pulse || v.pulse || prev.pulse,
          temp: prev.temp || v.temp || prev.temp,
          spo2: prev.spo2 || v.spo2 || prev.spo2
        }));
      }
      // Optional on-premise language model: grounded suggestions the patient must confirm.
      if (llmAvailable && clean.length > 8) {
        api.extractFindings(clean, micLang).then(r => {
          if (seq !== parseSeqRef.current) return;
          setAiSuggestions((r.aiFindings || []).filter((f: any) => !f.negated && f.evidence).map((f: any) => ({ symptom: String(f.symptom), evidence: String(f.evidence) })));
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('[Step3] Server parse unavailable; using on-device recognition only.', e);
    } finally {
      if (seq === parseSeqRef.current) setIsParsing(false);
    }
  }, [onExtras, setVitals, llmAvailable, micLang]);

  const scheduleParse = (text: string, delay = 800) => {
    if (parseTimerRef.current) clearTimeout(parseTimerRef.current);
    parseTimerRef.current = setTimeout(() => runServerParse(text), delay);
  };

  const commitTranscript = (text: string, parseDelay = 800) => {
    setTranscript(text);
    latestTranscriptRef.current = text;
    setDismissedMismatch(null);
    scheduleParse(text, parseDelay);
  };

  // ---------------------------------------------------------------- Microphone
  const stopRecording = () => {
    try { recognitionRef.current?.stop(); } catch {}
    recognitionRef.current = null;
    setIsRecording(false);
  };

  const toggleOnPremRecordingRef = useRef<() => void>(() => {});
  /** Hospital's own speech recognition: record here, transcribe on the hospital server. */
  const toggleOnPremRecording = async () => {
    if (recorderRef.current) {
      sovereignSound.playMechanicalSnap();
      const rec = recorderRef.current;
      recorderRef.current = null;
      setIsRecording(false);
      setIsTranscribing(true);
      try {
        const blob = await rec.stop();
        const r = await api.transcribeAudio(blob, micLang);
        const base = latestTranscriptRef.current;
        if (r.text.trim()) commitTranscript(sanitizeVernacularTranscript(base ? `${base} ${r.text}` : r.text, micLang), 0);
        else setMicError('micNoSpeech');
      } catch (e) {
        console.warn('[Step3] On-premise ASR failed:', e);
        setMicError('micUnavailable');
      } finally {
        setIsTranscribing(false);
      }
      return;
    }
    try {
      sovereignSound.playMechanicalSnap();
      // Stops by itself ~1.5 s after the patient finishes speaking (press-to-talk still works).
      recorderRef.current = await startRecording({ maxSeconds: 60, onSilence: () => { if (recorderRef.current) toggleOnPremRecordingRef.current(); } });
      setIsRecording(true);
    } catch (e: any) {
      setMicError(e?.name === 'NotAllowedError' ? 'micDenied' : 'micUnavailable');
    }
  };

  toggleOnPremRecordingRef.current = toggleOnPremRecording;

  const toggleRecording = () => {
    setMicError(null);
    if (onPremAsr) {
      toggleOnPremRecording();
      return;
    }
    if (isRecording) {
      sovereignSound.playMechanicalSnap();
      stopRecording();
      scheduleParse(latestTranscriptRef.current, 0);
      return;
    }
    if (!cloudSpeechAllowed) {
      setMicError('micUnavailable');
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicError('micNotSupported');
      return;
    }
    try {
      sovereignSound.playMechanicalSnap();
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = BCP47[micLang];
      recognition.maxAlternatives = 1;
      transcriptBeforeRecordingRef.current = latestTranscriptRef.current;

      recognition.onstart = () => setIsRecording(true);
      recognition.onresult = (event: any) => {
        const pieces: string[] = [];
        for (let i = 0; i < event.results.length; i++) pieces.push(event.results[i][0].transcript);
        const spoken = mergeSpeechPieces(pieces);
        const base = transcriptBeforeRecordingRef.current;
        const combined = sanitizeVernacularTranscript(base ? `${base} ${spoken}` : spoken, micLang);
        setTranscript(combined);
        latestTranscriptRef.current = combined;
        scheduleParse(combined, 1100);
      };
      recognition.onerror = (err: any) => {
        if (err.error === 'not-allowed' || err.error === 'service-not-allowed') setMicError('micDenied');
        else if (err.error === 'no-speech') setMicError('micNoSpeech');
        setIsRecording(false);
      };
      recognition.onend = () => {
        setIsRecording(false);
        recognitionRef.current = null;
        scheduleParse(latestTranscriptRef.current, 0);
      };
      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error('[Step3] Speech recognition failed to start:', e);
      setMicError('micNotSupported');
      setIsRecording(false);
    }
  };

  // ---------------------------------------------------------------- Handlers
  const handleRegion = (regionId: string) => {
    setSelectedBodyRegion(regionId);
    setDismissedMismatch(null);
  };

  const toggleChip = (sym: KioskSymptom) => {
    sovereignSound.playMechanicalSnap();
    setChips(prev => {
      const next = { ...prev };
      if (next[sym.en]) delete next[sym.en];
      else next[sym.en] = sym;
      return next;
    });
  };

  const handleQuickChoice = (sym: KioskSymptom, sev: Severity, dur: DurationKey) => {
    sovereignSound.playMechanicalSnap();
    setChips(prev => ({ ...prev, [sym.en]: sym }));
    setSeverity(sev);
    setDuration(dur);
  };

  const removeNoted = (s: SocratesSymptom) => {
    sovereignSound.playMechanicalSnap();
    if (s.source === 'area') setSelectedBodyRegion('');
    else if (s.source === 'chip') setChips(prev => { const n = { ...prev }; delete n[s.name!]; return n; });
    else if (s.source === 'voice') setDismissedVoice(prev => [...prev, s.key!]);
    else if (s.source === 'ai') {
      setAcceptedAi(prev => prev.filter(a => a.key !== s.key));
      setDismissedAi(prev => [...prev, s.name || '']);
    }
    else setParserSymptoms(prev => prev.filter(p => p.key !== s.key));
  };

  const handleUndo = () => {
    sovereignSound.playMechanicalSnap();
    const parts = transcript.split(/(?<=[।.!?])\s+|\s*,\s*/).filter(Boolean);
    parts.pop();
    commitTranscript(parts.join(' '), 300);
  };

  // ---------------------------------------------------------------- Area mismatch (voice vs body map)
  const spoken = useMemo(() => detectRegionFromSpeech(transcript, micLang), [transcript, micLang]);
  const mismatch = useMemo(() => {
    if (!selectedBodyRegion || !transcript) return null;
    const chestEmergency = voiceFindings.symptoms.find(s => s.key === 'voice:chest_pain');
    let target = chestEmergency ? 'Left Chest / Precordium' : spoken?.region;
    if (!target) return null;
    const family = (r: string) => r.replace(/^(Left|Right) /, '');
    // No side spoken: keep the side the patient already tapped (e.g. left knee → left hand).
    if (!chestEmergency && spoken && !spoken.sideKnown) {
      const side = selectedBodyRegion.match(/^(Left|Right) /)?.[1] || 'Right';
      target = `${side} ${family(target)}`;
    }
    if (target === selectedBodyRegion || family(target) === family(selectedBodyRegion)) return null;
    if (target === 'Left Chest / Precordium' && ['Right Chest', 'Lungs & Respiration'].includes(selectedBodyRegion)) return null;
    if (dismissedMismatch === target) return null;
    const phrase = chestEmergency?.labelLocal || (spoken && !spoken.sideKnown && spoken.genericLabel) || regionName(target, lang);
    return { target, phrase, isEmergency: !!chestEmergency };
  }, [selectedBodyRegion, transcript, spoken, voiceFindings, dismissedMismatch, lang]);

  // ---------------------------------------------------------------- Navigation (single dock)
  const hasAnything = composedSymptoms.length > 0 || transcript.trim().length > 0;
  useStepNav(registerNav, subPhase === 'body'
    ? {
        canNext: true,
        onNext: () => { setSubPhase('symptoms'); try { window.scrollTo({ top: 0 }); } catch {} },
        onBack
      }
    : {
        canNext: hasAnything,
        blockedHint: tx('needAreaOrWords'),
        onNext: () => {
          if (isRecording) stopRecording();
          if (parseTimerRef.current) { clearTimeout(parseTimerRef.current); runServerParse(latestTranscriptRef.current); }
          onNext();
        },
        onBack: () => {
          if (isRecording) stopRecording();
          setSubPhase('body');
          try { window.scrollTo({ top: 0 }); } catch {}
        }
      });

  // ---------------------------------------------------------------- Lists for the current area
  const effectiveCategory: SystemicCategoryId = selectedBodyRegion ? (REGION_TO_CATEGORY[selectedBodyRegion] || 'general') : systemicCategory;
  const areaSymptoms: KioskSymptom[] = selectedBodyRegion
    ? REGIONAL_SYMPTOMS[selectedBodyRegion] || SYSTEMIC_SYMPTOMS[effectiveCategory]
    : SYSTEMIC_SYMPTOMS[systemicCategory];
  const quickChoices = useMemo(() => {
    // "snake bite · moderate · 2–3 days" makes no sense: no presets for emergencies or follow-up visits
    if (effectiveCategory === 'urgent' || effectiveCategory === 'visit') return [];
    const base = areaSymptoms.filter(s => !s.isEmergency);
    const pool = base.length >= 2 ? base : areaSymptoms;
    const choices: Array<{ sym: KioskSymptom; sev: Severity; dur: DurationKey }> = [];
    if (pool[0]) choices.push({ sym: pool[0], sev: 'moderate', dur: '23' });
    if (pool[1]) choices.push({ sym: pool[1], sev: 'moderate', dur: 'week' });
    if (pool[0]) choices.push({ sym: pool[0], sev: 'severe', dur: 'today' });
    if (pool[2]) choices.push({ sym: pool[2], sev: 'mild', dur: 'month' });
    return choices;
  }, [areaSymptoms, effectiveCategory]);

  // ---------------------------------------------------------------- Words → cards, emergency rules, follow-up
  // Deterministic and offline (clinicalLexicon.ts / symptomMatcher.ts): Hindi, Hinglish and English.
  const complaint = useMemo(() => analyseComplaint(transcript), [transcript]);
  const wordSuggestions = useMemo(() => {
    if (!transcript.trim()) return [];
    const inArea = new Set(areaSymptoms.map(s => s.en));
    const visitCards = new Set(SYSTEMIC_SYMPTOMS.visit.map(s => s.en)); // offered by the follow-up prompt instead
    return kioskSymptomMatcher()
      .rank(transcript, { limit: 8 })
      .filter(m => m.score >= SUGGEST_MIN_SCORE && !chips[m.symptom.en] && !visitCards.has(m.symptom.en))
      // a card in the area the patient tapped wins a close call
      .map(m => ({ ...m, rankScore: m.score + (inArea.has(m.symptom.en) ? 0.15 : 0) }))
      .sort((a, b) => b.rankScore - a.rankScore)
      .slice(0, 3);
  }, [transcript, areaSymptoms, chips]);
  const visitCards = SYSTEMIC_SYMPTOMS.visit;
  const showVisitPrompt = complaint.visitReason === 'follow-up' && !visitCards.some(v => chips[v.en]);
  const urgentOnly = !complaint.sos && complaint.redFlags.length > 0;

  const cluster = selectedBodyRegion ? CLUSTER_DISAMBIGUATION[LOCUS_TO_CLUSTER[selectedBodyRegion]] : null;
  const anyEmergency = composedSymptoms.some(s => s.isEmergency);

  // ================================================================ Render
  if (subPhase === 'body') {
    return (
      <BodyMapStage
        selectedRegion={selectedBodyRegion}
        onSelectRegion={handleRegion}
        isPrivateMode={isPrivateMode}
        onTogglePrivateMode={() => setIsPrivateMode(p => !p)}
        language={lang}
        onDescribeInstead={() => { sovereignSound.playMechanicalSnap(); setSubPhase('symptoms'); }}
      />
    );
  }

  const severityWord = (s?: number) => (!s ? '' : s <= 3 ? tx('sevMild') : s <= 6 ? tx('sevModerate') : tx('sevSevere'));
  const durationWord = DURATIONS.find(d => d.key === duration) ? tx(DURATIONS.find(d => d.key === duration)!.label) : '';

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-4 animate-in fade-in duration-200">
      {/* Area header */}
      <div className="p-4 rounded-2xl bg-card border border-border/80 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/30 text-primary flex items-center justify-center shrink-0">
            <MapPin size={20} />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold text-muted-foreground">{tx('areaLabel')}</span>
            <div className="font-heading font-extrabold text-lg text-foreground truncate">
              {selectedBodyRegion ? regionName(selectedBodyRegion, lang) : tx('areaGeneral')}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { sovereignSound.playMechanicalSnap(); setSubPhase('body'); }}
          className="tactile-btn px-4 py-2 rounded-xl text-sm font-bold text-primary border-primary/30"
        >
          {tx('changeArea')}
        </button>
      </div>

      {/* Voice says a different area than the one chosen */}
      {mismatch && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${mismatch.isEmergency ? 'bg-rose-500/10 border-rose-500/50' : 'bg-amber-500/10 border-amber-500/50'}`} role="alert">
          <div className="flex items-start gap-3 min-w-0">
            {mismatch.isEmergency ? <HeartPulse size={20} className="text-rose-600 shrink-0 mt-0.5" /> : <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />}
            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground">{tx('mismatchTitle')}</div>
              <p className="text-sm text-foreground/90 leading-snug">
                {tx('mismatchBody', { chosen: regionName(selectedBodyRegion, lang), phrase: mismatch.phrase, suggested: regionName(mismatch.target, lang) })}
              </p>
              {mismatch.isEmergency && <p className="text-xs font-semibold text-rose-700 dark:text-rose-300 mt-1">{tx('mismatchUrgent')}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => setDismissedMismatch(mismatch.target)} className="px-3 py-2 rounded-xl text-sm font-semibold border border-border bg-background hover:bg-muted">
              {tx('mismatchKeep')}
            </button>
            <button
              type="button"
              onClick={() => { sovereignSound.playMechanicalSnap(); handleRegion(mismatch.target); }}
              className={`px-3 py-2 rounded-xl text-sm font-bold text-white ${mismatch.isEmergency ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'}`}
            >
              {tx('mismatchSwitch', { suggested: regionName(mismatch.target, lang) })}
            </button>
          </div>
        </div>
      )}

      {/* Narrow down the area */}
      {cluster && (
        <div className="p-4 rounded-2xl bg-card border border-border/80 flex flex-col gap-2.5">
          <span className="text-sm font-heading font-bold text-foreground">{tx('clarifyArea')}</span>
          <div className="flex flex-wrap gap-2">
            {cluster.options.map(opt => {
              const active = selectedBodyRegion === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { sovereignSound.playMechanicalSnap(); handleRegion(opt.id); }}
                  aria-pressed={active}
                  className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                    active ? (opt.isEmergency ? 'bg-rose-600 text-white border-rose-600' : 'bg-primary text-primary-foreground border-primary') : 'bg-muted/40 hover:bg-muted text-foreground border-border/70'
                  }`}
                >
                  {regionName(opt.id, lang)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Speak / type */}
      <div className="p-5 rounded-2xl bg-card border border-border/80 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="font-heading font-extrabold text-base text-foreground">{tx('speakTitle')}</span>
          <div className="flex items-center gap-2">
            <select
              value={micLang}
              onChange={e => setMicLang(e.target.value as SupportedKioskLanguage)}
              className="text-sm font-semibold px-3 py-1.5 rounded-xl border border-border bg-background text-foreground"
              aria-label="Speech language"
            >
              {SPEECH_LANGS.map(code => <option key={code} value={code}>{SPEECH_LANG_NAMES[code]}</option>)}
            </select>
          </div>
        </div>

        {/* Transcript (only the patient's own words) */}
        <div className="relative min-h-[96px] p-4 rounded-2xl bg-muted/30 border border-border/70">
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={draftText}
                onChange={e => setDraftText(e.target.value)}
                rows={3}
                autoFocus
                placeholder={tx('editPh')}
                className="w-full p-2.5 rounded-xl border border-primary/50 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={() => setIsEditing(false)} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-muted-foreground hover:bg-muted">{tx('cancel')}</button>
                <button
                  type="button"
                  onClick={() => { setIsEditing(false); commitTranscript(sanitizeVernacularTranscript(draftText, micLang), 200); }}
                  className="px-4 py-1.5 rounded-lg text-sm font-bold bg-primary text-primary-foreground"
                >
                  {tx('save')}
                </button>
              </div>
            </div>
          ) : transcript ? (
            <>
              {isPrivateMode && !showPrivateText ? (
                <button type="button" onClick={() => setShowPrivateText(true)} className="text-sm font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <Shield size={14} /> ••••••••••
                </button>
              ) : (
                <p className="text-base font-medium text-foreground leading-relaxed">{transcript}</p>
              )}
              <div className="flex items-center justify-end gap-1.5 pt-3 flex-wrap">
                <button type="button" onClick={handleUndo} className="px-2.5 py-1 rounded-lg bg-background hover:bg-muted text-sm font-semibold flex items-center gap-1 border border-border/70">
                  <Undo2 size={13} /> {tx('undoText')}
                </button>
                <button type="button" onClick={() => { setDraftText(transcript); setIsEditing(true); }} className="px-2.5 py-1 rounded-lg bg-background hover:bg-muted text-sm font-semibold flex items-center gap-1 border border-border/70">
                  <Edit3 size={13} /> {tx('editText')}
                </button>
                <button type="button" onClick={() => { sovereignSound.playMechanicalSnap(); commitTranscript('', 0); setDismissedVoice([]); }} className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-sm font-semibold flex items-center gap-1 border border-rose-500/30">
                  <Trash2 size={13} /> {tx('clearText')}
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{isRecording ? tx('micListening') : tx('transcriptPh')}</p>
          )}
        </div>

        <AudioVisualizer isRecording={isRecording} color="#0284c7" height={26} />

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={toggleRecording}
            className={`w-full sm:w-auto min-w-[220px] py-3.5 px-8 text-base font-heading font-bold rounded-2xl flex items-center justify-center gap-2.5 shadow-md active:scale-95 transition-all ${
              isRecording ? 'bg-rose-600 text-white ring-4 ring-rose-400/30' : 'bg-primary text-primary-foreground hover:bg-primary/95'
            }`}
          >
            {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
            <span>{isRecording ? tx('micStop') : tx('micTap')}</span>
          </button>
          {!transcript && !isEditing && (
            <button type="button" onClick={() => { setDraftText(''); setIsEditing(true); }} className="tactile-btn px-4 py-3 rounded-2xl text-sm font-semibold gap-2">
              <Keyboard size={16} /> {tx('typeInstead')}
            </button>
          )}
        </div>

        {/* Fixed-height status line: mic errors / understanding indicator */}
        <div className="min-h-[22px] text-sm text-center" aria-live="polite">
          {micError ? (
            <span className="font-semibold text-rose-600 dark:text-rose-400">{tx(micError)}</span>
          ) : isTranscribing ? (
            <span className="inline-flex items-center gap-2 text-primary font-semibold"><Loader2 size={14} className="animate-spin" /> {tx('micTranscribing')}</span>
          ) : isParsing ? (
            <span className="inline-flex items-center gap-2 text-primary font-semibold"><Loader2 size={14} className="animate-spin" /> {tx('understanding')}</span>
          ) : onPremAsr ? (
            <span className="text-xs text-muted-foreground">{tx('micOnPrem')}</span>
          ) : null}
        </div>
      </div>

      {/* The patient's words suggest an emergency: one tap to the SOS desk */}
      {complaint.sos && (
        <div className="p-4 rounded-2xl bg-rose-600 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg" role="alert">
          <div className="flex items-start gap-3 min-w-0">
            <AlertOctagon size={22} className="shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="font-heading font-extrabold text-base">{tx('sosSuggestTitle')}</div>
              <p className="text-sm text-white/95 leading-snug">{tx('sosSuggestBody')}</p>
            </div>
          </div>
          {onRequestSos && (
            <button type="button" onClick={() => { sovereignSound.playMechanicalSnap(); onRequestSos(); }} className="shrink-0 px-5 py-3 rounded-xl bg-white text-rose-700 font-heading font-extrabold text-sm shadow">
              {tx('sosSuggestBtn')}
            </button>
          )}
        </div>
      )}
      {urgentOnly && (
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-sm font-semibold text-amber-900 dark:text-amber-100 flex items-start gap-2" role="status">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{tx('urgentFlagNote')}</span>
        </div>
      )}

      {/* Here for a review, refill or reports */}
      {showVisitPrompt && (
        <div className="p-4 rounded-2xl bg-sky-500/5 border border-sky-500/40 flex flex-col gap-2.5">
          <span className="text-sm font-heading font-bold text-foreground">{tx('visitPrompt')}</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {visitCards.map(v => (
              <button key={v.en} type="button" onClick={() => toggleChip(v)} className="p-3 rounded-xl text-left text-sm font-semibold border border-sky-500/40 bg-background hover:bg-sky-500/10">
                {symptomLabel(v, lang)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cards that match the patient's own words — added only when tapped */}
      {wordSuggestions.length > 0 && (
        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/30 flex flex-col gap-2.5" aria-live="polite">
          <span className="text-sm font-heading font-bold text-foreground flex items-center gap-2"><Sparkles size={14} className="text-primary" /> {tx('matchTitle')}</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {wordSuggestions.map(m => (
              <button
                key={m.symptom.en}
                type="button"
                onClick={() => toggleChip(m.symptom)}
                className={`p-3 rounded-xl text-left text-sm font-semibold border transition-colors flex items-center justify-between gap-2 ${m.symptom.isEmergency ? 'border-rose-500/50 bg-rose-500/5 hover:bg-rose-500/10' : 'border-primary/30 bg-background hover:bg-primary/10'}`}
              >
                <span>{isPrivateMode && !showPrivateText ? '••••' : symptomLabel(m.symptom, lang)}</span>
                <span className="h-6 w-6 rounded-lg border border-border/80 flex items-center justify-center text-primary font-bold shrink-0">+</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* What we have noted — only what the patient chose or said */}
      <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/30 flex flex-col gap-3" aria-live="polite">
        <div className="flex items-center justify-between gap-2">
          <span className="font-heading font-extrabold text-sm text-foreground flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            {tx('summaryTitle')}
          </span>
          {composedSymptoms.length > 0 && (severity || duration || sensation) && (
            <span className="text-xs text-muted-foreground">
              {[severity ? tx(severity === 'mild' ? 'sevMild' : severity === 'moderate' ? 'sevModerate' : 'sevSevere') : '', durationWord, sensation ? tx(PAIN_CHARACTERS.find(c => c.sensationKey === sensation)!.key) : ''].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
        {composedSymptoms.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tx('summaryEmpty')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {composedSymptoms.map(s => (
              <span
                key={s.key}
                className={`pl-3 pr-1.5 py-1.5 rounded-xl border text-sm font-semibold flex items-center gap-2 ${s.isEmergency ? 'bg-rose-500/10 border-rose-500/40 text-rose-800 dark:text-rose-200' : 'bg-card border-emerald-500/40 text-foreground'}`}
              >
                <span>{isPrivateMode && !showPrivateText ? '••••' : s.labelLocal || s.name}</span>
                {s.source === 'voice' && <span className="text-[10.5px] font-medium text-muted-foreground">({tx('fromVoice')})</span>}
                {s.source === 'voice' && !severity && s.severityScore >= 8 && (
                  <span className="text-[10.5px] font-bold text-rose-700 dark:text-rose-300">{severityWord(s.severityScore)}</span>
                )}
                <button type="button" onClick={() => removeNoted(s)} className="h-6 w-6 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground" aria-label={tx('remove')}>
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        )}
        {anyEmergency && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-sm font-semibold text-rose-800 dark:text-rose-200 flex items-start gap-2">
            <AlertOctagon size={16} className="shrink-0 mt-0.5" />
            <span>{tx('urgentNote')}</span>
          </div>
        )}
        {(() => {
          const pending = aiSuggestions.filter(a => !dismissedAi.includes(a.symptom) && !composedSymptoms.some(c => (c.name || '').toLowerCase().includes(a.symptom.toLowerCase())));
          if (!pending.length) return null;
          return (
            <div className="p-3 rounded-xl bg-violet-500/5 border border-violet-500/30">
              <div className="text-xs font-bold text-violet-800 dark:text-violet-200 mb-2">{tx('aiSuggestTitle')}</div>
              <div className="flex flex-col gap-2">
                {pending.map(a => (
                  <div key={a.symptom} className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm text-foreground">{tx('aiYouSaid', { text: a.evidence })}</span>
                    <span className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          sovereignSound.playMechanicalSnap();
                          setAcceptedAi(prev => [...prev, { ...blankSymptom(), key: `ai:${a.symptom}`, source: 'ai', name: a.symptom, symptom_name: a.symptom, labelLocal: a.evidence, site: selectedBodyRegion || 'General' }]);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold"
                      >
                        {tx('aiAdd')}
                      </button>
                      <button type="button" onClick={() => setDismissedAi(prev => [...prev, a.symptom])} className="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground" aria-label={tx('remove')}>
                        <X size={13} />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Structured choices */}
      <div className="p-5 rounded-2xl bg-card border border-border/80 flex flex-col gap-5">
        {/* 1. Symptoms */}
        <div>
          <div className="flex items-baseline justify-between gap-2 flex-wrap mb-2.5">
            <span className="text-sm font-heading font-bold text-foreground">{tx('symptomsTitle')}</span>
            <span className="text-xs text-muted-foreground">{tx('symptomsHint')}</span>
          </div>

          {!selectedBodyRegion && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-3" role="tablist">
              {SYSTEMIC_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={systemicCategory === cat.id}
                  onClick={() => { sovereignSound.playMechanicalSnap(); setSystemicCategory(cat.id); }}
                  className={`px-3 py-1.5 rounded-xl text-sm font-bold shrink-0 border transition-colors ${
                    systemicCategory === cat.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/40 hover:bg-muted text-foreground border-border/70'
                  }`}
                >
                  {tx(cat.key)}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {areaSymptoms.map(sym => {
              const active = !!chips[sym.en];
              return (
                <button
                  key={sym.en}
                  type="button"
                  onClick={() => toggleChip(sym)}
                  aria-pressed={active}
                  className={`p-3.5 rounded-2xl text-left border transition-colors flex items-center justify-between gap-3 ${
                    active
                      ? sym.isEmergency ? 'bg-rose-600 text-white border-rose-600' : 'bg-primary text-primary-foreground border-primary'
                      : sym.isEmergency ? 'bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/30' : 'bg-muted/30 hover:bg-primary/10 border-border/70'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-heading font-bold text-sm">{symptomLabel(sym, lang)}</span>
                    {sym.isEmergency && !active && (
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-rose-600 text-white uppercase shrink-0">{tx('emergencyTag')}</span>
                    )}
                  </span>
                  <span className={`h-7 w-7 rounded-xl border flex items-center justify-center shrink-0 font-bold ${active ? 'bg-white/20 border-white/40' : 'bg-background border-border/80 text-primary'}`}>
                    {active ? <CheckCircle2 size={15} /> : '+'}
                  </span>
                </button>
              );
            })}
          </div>

          {quickChoices.length > 0 && (
            <div className="mt-4">
              <div className="flex items-baseline justify-between gap-2 flex-wrap mb-2">
                <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5"><Sparkles size={12} className="text-primary" /> {tx('quickTitle')}</span>
                <span className="text-xs text-muted-foreground">{tx('quickHint')}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {quickChoices.map((q, i) => (
                  <button
                    key={`${q.sym.en}-${i}`}
                    type="button"
                    onClick={() => handleQuickChoice(q.sym, q.sev, q.dur)}
                    className="p-2.5 rounded-xl bg-muted/30 hover:bg-primary/10 border border-border/70 hover:border-primary/40 text-left text-sm transition-colors"
                  >
                    <span className="font-semibold text-foreground">{symptomLabel(q.sym, lang)}</span>
                    <span className="text-muted-foreground"> · {tx(q.sev === 'mild' ? 'sevMild' : q.sev === 'moderate' ? 'sevModerate' : 'sevSevere')} · {tx(DURATIONS.find(d => d.key === q.dur)!.label)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 2. Severity + 3. Duration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/60">
          <div>
            <span className="text-sm font-heading font-bold text-foreground mb-2.5 block">{tx('severityTitle')}</span>
            <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-muted/40 border border-border/70" role="radiogroup">
              {(['mild', 'moderate', 'severe'] as Severity[]).map(s => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={severity === s}
                  onClick={() => { sovereignSound.playMechanicalSnap(); setSeverity(prev => (prev === s ? null : s)); }}
                  className={`py-2.5 px-2 rounded-xl text-sm font-bold transition-colors ${
                    severity === s ? (s === 'severe' ? 'bg-rose-600 text-white' : 'bg-card text-foreground shadow-sm border border-border') : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tx(s === 'mild' ? 'sevMild' : s === 'moderate' ? 'sevModerate' : 'sevSevere')}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="text-sm font-heading font-bold text-foreground mb-2.5 block">{tx('durationTitle')}</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 rounded-2xl bg-muted/40 border border-border/70" role="radiogroup">
              {DURATIONS.map(d => (
                <button
                  key={d.key}
                  type="button"
                  role="radio"
                  aria-checked={duration === d.key}
                  onClick={() => { sovereignSound.playMechanicalSnap(); setDuration(prev => (prev === d.key ? null : d.key)); }}
                  className={`py-2.5 px-1 rounded-xl text-sm font-bold transition-colors ${
                    duration === d.key ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tx(d.label)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4. Sensation */}
        <div className="pt-4 border-t border-border/60">
          <div className="flex items-baseline justify-between gap-2 flex-wrap mb-2.5">
            <span className="text-sm font-heading font-bold text-foreground">{tx('sensationTitle')}</span>
            <span className="text-xs text-muted-foreground">{tx('sensationHint')}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2" role="radiogroup">
            {PAIN_CHARACTERS.map(c => {
              const Icon = SENSATION_ICONS[c.sensationKey];
              const active = sensation === c.sensationKey;
              return (
                <button
                  key={c.sensationKey}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => { sovereignSound.playMechanicalSnap(); setSensation(prev => (prev === c.sensationKey ? null : c.sensationKey)); }}
                  className={`p-3 rounded-2xl border text-center transition-colors flex flex-col items-center justify-center gap-1.5 min-h-[76px] ${
                    active ? 'bg-primary text-primary-foreground border-primary ring-2 ring-primary/30' : 'border-border/70 bg-muted/30 hover:bg-primary/10'
                  }`}
                >
                  <Icon size={18} className={active ? 'text-primary-foreground' : 'text-primary'} />
                  <span className="text-sm font-bold leading-tight">{tx(c.key)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Private concerns (private mode only) */}
      {isPrivateMode && (
        <div className="p-5 rounded-2xl border border-amber-500/40 bg-amber-500/5 flex flex-col gap-3">
          <span className="font-heading font-bold text-sm text-foreground flex items-center gap-2"><Shield size={15} className="text-amber-600" /> {tx('privateTitle')}</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRIVATE_SYMPTOMS.map(sym => {
              const active = !!chips[sym.en];
              return (
                <button
                  key={sym.en}
                  type="button"
                  onClick={() => toggleChip(sym)}
                  aria-pressed={active}
                  className={`p-3 rounded-xl text-left text-sm font-semibold border transition-colors ${active ? 'bg-amber-600 text-white border-amber-600' : 'bg-background border-amber-500/30 hover:bg-amber-500/10'}`}
                >
                  {symptomLabel(sym, lang)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
