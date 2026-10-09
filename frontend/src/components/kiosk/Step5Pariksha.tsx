import React, { useEffect, useRef, useState } from 'react';
import { Flame, CheckCircle2, Shield, Wind, Droplets, Volume2, Sparkles, Zap, Scale, ClipboardList, Leaf, Mic, Square, Loader2 } from 'lucide-react';
import { DashavidhaPariksha, AgniType, SocratesSymptom, PatientHistory, CareStream } from '../../types/api';
import { api } from '../../services/api';
import { sovereignSound } from '../../utils/audio';
import { BCP47, KioskTextKey, kioskText, normalizeLang } from '../../utils/kioskLocalization';
import { IntakeTextKey, intakeText } from '../../utils/kioskIntakeText';
import { aiCapabilities, speechRouteFor, startRecording, Recorder } from '../../utils/onPremAsr';
import { RegisterNav, useStepNav } from './kioskNav';

interface Step5ParikshaProps {
  pariksha: DashavidhaPariksha;
  setPariksha: React.Dispatch<React.SetStateAction<DashavidhaPariksha>>;
  history: PatientHistory;
  setHistory: React.Dispatch<React.SetStateAction<PatientHistory>>;
  careStream: CareStream;
  symptoms?: SocratesSymptom[];
  selectedBodyRegion?: string;
  transcript?: string;
  language?: string;
  registerNav?: RegisterNav;
}

// `value` is the English label stored for the doctor (the same values the history interview uses).
const CONDITIONS: Array<{ value: string; key: KioskTextKey | IntakeTextKey; own?: boolean }> = [
  { value: 'Diabetes', key: 'condDiabetes' },
  { value: 'Hypertension', key: 'condBp' },
  { value: 'Heart disease', key: 'condHeart' },
  { value: 'Asthma / COPD', key: 'condAsthma' },
  { value: 'Thyroid disorder', key: 'condThyroid' },
  { value: 'Kidney disease', key: 'condKidney' },
  { value: 'Liver disease', key: 'condLiver' },
  { value: 'Tuberculosis', key: 'condTb', own: true },
  { value: 'Epilepsy', key: 'condEpilepsy', own: true },
  { value: 'Stroke', key: 'condStroke', own: true }
];
const isNone = (c: string) => /^none$/i.test(c);

/** Long-standing illnesses the speech parser reports, as the values above. */
const FROM_PARSER: Record<string, string> = {
  'Type 2 Diabetes Mellitus': 'Diabetes', 'Essential Hypertension': 'Hypertension', 'Pulmonary Tuberculosis': 'Tuberculosis',
  'Bronchial Asthma': 'Asthma / COPD', 'Hypothyroidism': 'Thyroid disorder', 'Coronary Artery Disease': 'Heart disease',
  'Chronic Kidney Disease': 'Kidney disease'
};

const ALLERGY_CHIPS: Array<{ value: string; key: IntakeTextKey }> = [
  { value: 'Penicillin', key: 'alPenicillin' }, { value: 'Sulfa drugs', key: 'alSulfa' }, { value: 'Painkillers (NSAIDs)', key: 'alPainkiller' },
  { value: 'Aspirin', key: 'alAspirin' }, { value: 'Dust / pollen', key: 'alDust' }, { value: 'Food', key: 'alFood' }
];
const MEDICINE_CHIPS: Array<{ value: string; key: IntakeTextKey }> = [
  { value: 'BP medicine', key: 'mdBp' }, { value: 'Diabetes medicine', key: 'mdSugar' }, { value: 'Insulin', key: 'mdInsulin' },
  { value: 'Thyroid medicine', key: 'mdThyroid' }, { value: 'Blood thinner', key: 'mdBloodThinner' }, { value: 'Ayurvedic / home remedy', key: 'mdAyurvedic' }
];

const AGNI: Array<{ type: AgniType; title: KioskTextKey; sub: KioskTextKey; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { type: 'SAMAGNI', title: 'agniSama', sub: 'agniSamaSub', icon: Shield },
  { type: 'VISHAMAGNI', title: 'agniVishama', sub: 'agniVishamaSub', icon: Wind },
  { type: 'TIKSHNAGNI', title: 'agniTikshna', sub: 'agniTikshnaSub', icon: Flame },
  { type: 'MANDAGNI', title: 'agniManda', sub: 'agniMandaSub', icon: Droplets }
];

// A three-item screen (build, temperature and skin, sleep and temperament) — a first guess for the Vaidya, never
// the assessment itself.
const PRAKRITI_QUESTIONS: Array<{ title: IntakeTextKey; options: Array<{ dosha: 'V' | 'P' | 'K'; key: IntakeTextKey }> }> = [
  { title: 'prQ1', options: [{ dosha: 'V', key: 'prQ1V' }, { dosha: 'P', key: 'prQ1P' }, { dosha: 'K', key: 'prQ1K' }] },
  { title: 'prQ2', options: [{ dosha: 'V', key: 'prQ2V' }, { dosha: 'P', key: 'prQ2P' }, { dosha: 'K', key: 'prQ2K' }] },
  { title: 'prQ3', options: [{ dosha: 'V', key: 'prQ3V' }, { dosha: 'P', key: 'prQ3P' }, { dosha: 'K', key: 'prQ3K' }] }
];
const DOSHA_NAME = { V: 'Vata', P: 'Pitta', K: 'Kapha' } as const;
/** "Vata", "Vata, with Pitta" or "Mixed (Vata-Pitta-Kapha)", from the answers given so far. */
function provisionalPrakriti(answers: Array<'V' | 'P' | 'K' | undefined>): string {
  const given = answers.filter((a): a is 'V' | 'P' | 'K' => !!a);
  if (!given.length) return '';
  const counts = (['V', 'P', 'K'] as const).map(d => [d, given.filter(a => a === d).length] as const).sort((a, b) => b[1] - a[1]);
  if (given.length === 3 && counts[0][1] === 1) return 'Mixed (Vata-Pitta-Kapha) — provisional';
  const others = counts.slice(1).filter(c => c[1] > 0).map(c => DOSHA_NAME[c[0]]);
  return `${DOSHA_NAME[counts[0][0]]}${others.length ? `, with ${others.join(' and ')}` : ''} — provisional (${given.length} of 3 answered)`;
}

const ENERGY: Array<{ value: NonNullable<DashavidhaPariksha['energySelfReport']>; label: KioskTextKey }> = [
  { value: 'Good all day', label: 'enHigh' },
  { value: 'Enough for daily work', label: 'enMed' },
  { value: 'Tires quickly', label: 'enLow' }
];

/** "none", "no", "nil", "नहीं", "koi nahi" typed as an answer: a denial, not a medicine or allergy name. */
const SAID_NONE = /^(?:none|no|nil|nothing|na|n\/a|not\s+any|no\s+(?:allergy|allergies|medicines?)|nahi|nahin|koi\s+nahi|kuch\s+nahi|नहीं|नही|कोई\s+नहीं|कुछ\s+नहीं)\.?$/i;
const saysNone = (text?: string) => SAID_NONE.test((text || '').trim());
const splitList = (text?: string) => (saysNone(text) ? [] : (text || '').split(/[,;\n]/).map(s => s.trim()).filter(s => s && !SAID_NONE.test(s)));
const addToList = (text: string | undefined, value: string) => {
  const items = splitList(text);
  return items.some(i => i.toLowerCase() === value.toLowerCase()) ? items.join(', ') : [...items, value].join(', ');
};

/** A microphone button that writes what the patient says into a field (hospital recogniser, else the browser's). */
const SpeakIntoField: React.FC<{ lang: string; onText: (t: string) => void }> = ({ lang, onText }) => {
  const it = intakeText(lang);
  const [route, setRoute] = useState<'onprem' | 'cloud' | 'none' | null>(null);
  const [state, setState] = useState<'idle' | 'listening' | 'working'>('idle');
  const recRef = useRef<Recorder | null>(null);
  const cloudRef = useRef<any>(null);
  useEffect(() => {
    let alive = true;
    aiCapabilities().then(c => alive && setRoute(speechRouteFor(lang, c))).catch(() => alive && setRoute(speechRouteFor(lang, null)));
    return () => { alive = false; try { recRef.current?.cancel(); cloudRef.current?.abort?.(); } catch {} };
  }, [lang]);
  if (!route || route === 'none') return null;

  const stop = async () => {
    if (route === 'cloud') { try { cloudRef.current?.stop(); } catch {} return; }
    const rec = recRef.current;
    recRef.current = null;
    if (!rec) return;
    setState('working');
    try {
      const r = await api.transcribeAudio(await rec.stop(), lang);
      if (r.text?.trim()) onText(r.text.trim());
    } catch { /* the patient can still type */ }
    setState('idle');
  };
  const start = async () => {
    sovereignSound.playMechanicalSnap();
    if (route === 'cloud') {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const r = new SR();
      r.lang = BCP47[normalizeLang(lang)];
      r.interimResults = false;
      r.onresult = (e: any) => { const t = Array.from(e.results).map((x: any) => x[0]?.transcript || '').join(' ').trim(); if (t) onText(t); };
      r.onend = () => setState('idle');
      r.onerror = () => setState('idle');
      cloudRef.current = r;
      r.start();
      setState('listening');
      return;
    }
    try {
      recRef.current = await startRecording({ maxSeconds: 20, onSilence: () => { stop(); } });
      setState('listening');
    } catch { setState('idle'); }
  };
  return (
    <button
      type="button"
      onClick={() => (state === 'listening' ? stop() : state === 'idle' ? start() : undefined)}
      className={`tactile-btn px-3 py-2 rounded-xl text-xs font-semibold gap-1.5 shrink-0 ${state === 'listening' ? 'text-rose-600 border-rose-500/40' : 'text-primary border-primary/30'}`}
      aria-label={state === 'listening' ? it('stopSpeak') : it('speak')}
    >
      {state === 'working' ? <Loader2 size={14} className="animate-spin" /> : state === 'listening' ? <Square size={13} /> : <Mic size={14} />}
      <span>{state === 'listening' ? it('stopSpeak') : it('speak')}</span>
    </button>
  );
};

type Status = 'none' | 'unknown' | 'listed';

export const Step5Pariksha: React.FC<Step5ParikshaProps> = ({
  pariksha,
  setPariksha,
  history,
  setHistory,
  careStream,
  transcript = '',
  language = 'hi',
  registerNav
}) => {
  const lang = normalizeLang(language);
  const tx = kioskText(lang);
  const it = intakeText(lang);
  const label = (key: KioskTextKey | IntakeTextKey) => (key in CONDITION_OWN ? it(key as IntakeTextKey) : tx(key as KioskTextKey));
  const showAyurveda = careStream !== 'ALLOPATHY';
  const [fromSpeech, setFromSpeech] = useState<string[]>([]);
  const [prefilled, setPrefilled] = useState(false);

  useStepNav(registerNav, { canNext: true });

  // What the patient already said while describing the complaint ("शुगर की बीमारी है", "metformin खाता हूं") is
  // filled in here to confirm — not asked again. The interview's answers are already in `history`.
  const askedSpeech = useRef(false);
  useEffect(() => {
    if (askedSpeech.current || !transcript.trim()) return;
    askedSpeech.current = true;
    api.parseAudioTranscript(transcript).then(r => {
      const conditions = Array.from(new Set((r.pastHistory || []).map(h => FROM_PARSER[h]).filter(Boolean)));
      const medicines = r.mentionedMedicines || [];
      if (!conditions.length && !medicines.length) return;
      setFromSpeech([...conditions, ...medicines]);
      setPrefilled(true);
      setHistory(prev => {
        const noneChosen = prev.conditions.some(isNone);
        const next: PatientHistory = {
          ...prev,
          conditions: noneChosen ? prev.conditions : Array.from(new Set([...prev.conditions, ...conditions])),
          mentionedInSpeech: { conditions, medicines }
        };
        if (medicines.length && prev.medicineStatus !== 'none') {
          // spoken names are added to whatever is already listed (a typed "none" is replaced: they named one)
          next.currentMedicines = medicines.reduce((list, m) => addToList(list, m), splitList(prev.currentMedicines).join(', '));
          next.medicineStatus = 'listed';
        }
        return next;
      });
    }).catch(() => { /* offline: the patient fills the page in */ });
  }, [transcript, setHistory]);

  const toggleCondition = (value: string) => {
    sovereignSound.playDialNotch();
    setHistory(prev => {
      const has = prev.conditions.includes(value);
      const conditions = isNone(value)
        ? (has ? [] : ['None'])
        : has ? prev.conditions.filter(c => c !== value) : [...prev.conditions.filter(c => !isNone(c)), value];
      return { ...prev, conditions };
    });
  };
  const otherConditions = history.conditions.filter(c => !isNone(c) && !CONDITIONS.some(k => k.value === c));

  const fromText = (text: string): Status | undefined => (saysNone(text) ? 'none' : text.trim() ? 'listed' : undefined);
  const allergyStatus: Status | undefined = history.allergyStatus || fromText(history.allergies);
  const medicineStatus: Status | undefined = history.medicineStatus || fromText(history.currentMedicines);

  // A typed "none" from an earlier answer becomes the explicit status, so the doctor sees a denial, not a drug name.
  useEffect(() => {
    const patch: Partial<PatientHistory> = {};
    if (!history.allergyStatus && saysNone(history.allergies)) Object.assign(patch, { allergyStatus: 'none', allergies: '' });
    if (!history.medicineStatus && saysNone(history.currentMedicines)) Object.assign(patch, { medicineStatus: 'none', currentMedicines: '' });
    if (Object.keys(patch).length) setHistory(prev => ({ ...prev, ...patch }));
  }, [history.allergies, history.currentMedicines, history.allergyStatus, history.medicineStatus, setHistory]);
  const setStatus = (field: 'allergyStatus' | 'medicineStatus', value: Status) => {
    sovereignSound.playDialNotch();
    setHistory(prev => ({
      ...prev,
      [field]: value,
      // "no allergy" / "not taking any" clears a list typed earlier
      ...(value === 'none' ? (field === 'allergyStatus' ? { allergies: '' } : { currentMedicines: '' }) : {})
    }));
  };

  // medicines the patient named while speaking that are not on the list (e.g. after answering "none" elsewhere)
  const mentionedMeds = (history.mentionedInSpeech?.medicines || []).filter(m => !splitList(history.currentMedicines).some(x => x.toLowerCase() === m.toLowerCase()));

  const agniFromInterview = (history as any).ayush?.agni as string | undefined;
  const agni = pariksha.agni || (agniFromInterview ? (agniFromInterview.toUpperCase() as AgniType) : undefined);
  const screen = pariksha.prakritiScreen?.answers || [];
  const answerPrakriti = (q: number, dosha: 'V' | 'P' | 'K') => {
    sovereignSound.playDialNotch();
    setPariksha(prev => {
      const answers = [...(prev.prakritiScreen?.answers || [])] as Array<'V' | 'P' | 'K'>;
      answers[q] = answers[q] === dosha ? (undefined as any) : dosha;
      return { ...prev, prakritiScreen: { answers, provisional: provisionalPrakriti(answers) } };
    });
  };

  const optionClass = (active: boolean) =>
    `rounded-2xl border transition-colors text-left ${active ? 'bg-primary/5 border-primary ring-2 ring-primary/30' : 'bg-muted/30 border-border/70 hover:bg-muted/60'}`;
  const pill = (active: boolean) =>
    `px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'}`;

  const statusRow = (field: 'allergyStatus' | 'medicineStatus', current: Status | undefined, keys: [IntakeTextKey, IntakeTextKey, IntakeTextKey]) => (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {(['none', 'unknown', 'listed'] as const).map((v, i) => (
        <button key={v} type="button" role="radio" aria-checked={current === v} onClick={() => setStatus(field, v)} className={pill(current === v)}>
          {it(keys[i])}
        </button>
      ))}
    </div>
  );

  return (
    <div className="w-full max-w-3xl mx-auto py-2 px-2 sm:px-4 flex flex-col gap-5 animate-in fade-in duration-300">
      <div className="p-4 sm:p-5 rounded-3xl bg-card border border-border/80 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="h-10 w-10 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-600 flex items-center justify-center shrink-0">
            <ClipboardList size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="font-heading font-extrabold text-lg text-foreground">{tx('s5Title')}</h2>
            <p className="text-sm text-muted-foreground">{tx('s5Sub')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { sovereignSound.playMechanicalSnap(); sovereignSound.speakGuidance(tx('s5Audio'), BCP47[lang]); }}
          className="tactile-btn px-3.5 py-2 rounded-xl text-xs font-semibold text-primary border-primary/30 gap-1.5"
        >
          <Volume2 size={15} />
          <span>{tx('listenBtn')}</span>
        </button>
      </div>

      {(prefilled || history.conditions.length > 0 || history.allergies || history.currentMedicines) && (
        <div className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/30 text-sm text-foreground flex items-start gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
          <span>{it('notedHint')}</span>
        </div>
      )}

      {/* Health history — asked of every patient */}
      <div className="p-5 sm:p-6 rounded-3xl bg-card border border-border/80 flex flex-col gap-5">
        <div>
          <span className="block font-heading font-bold text-sm sm:text-base text-foreground mb-2.5">{tx('s5Conditions')}</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[...CONDITIONS, { value: 'None', key: 'condNone' as KioskTextKey }].map(c => {
              const active = c.value === 'None' ? history.conditions.some(isNone) : history.conditions.includes(c.value);
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => toggleCondition(c.value)}
                  aria-pressed={active}
                  className={`p-3 text-sm font-semibold flex items-center justify-between gap-2 ${optionClass(active)}`}
                >
                  <span className="flex flex-col items-start">
                    <span>{label(c.key)}</span>
                    {active && fromSpeech.includes(c.value) && <span className="text-[10.5px] font-bold text-emerald-700 dark:text-emerald-300">{it('fromWords')}</span>}
                  </span>
                  {active && <CheckCircle2 size={15} className="text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
          {otherConditions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {otherConditions.map(c => (
                <button key={c} type="button" onClick={() => toggleCondition(c)} className={pill(true)} aria-pressed>
                  {c} ✕
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="block font-heading font-bold text-sm sm:text-base text-foreground">{tx('s5Allergy')}</span>
          {statusRow('allergyStatus', allergyStatus, ['allergyNone', 'notSure', 'allergyYes'])}
          {allergyStatus === 'listed' && (
            <>
              <div className="flex flex-wrap gap-2">
                {ALLERGY_CHIPS.map(a => {
                  const on = splitList(history.allergies).some(x => x.toLowerCase() === a.value.toLowerCase());
                  return (
                    <button key={a.value} type="button" aria-pressed={on} className={pill(on)}
                      onClick={() => { sovereignSound.playDialNotch(); setHistory(prev => ({ ...prev, allergyStatus: 'listed', allergies: on ? splitList(prev.allergies).filter(x => x.toLowerCase() !== a.value.toLowerCase()).join(', ') : addToList(prev.allergies, a.value) })); }}>
                      {it(a.key)}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 items-center">
                <input
                  id="s5-allergy"
                  type="text"
                  value={history.allergies}
                  onChange={e => setHistory(prev => ({ ...prev, allergies: e.target.value, allergyStatus: 'listed' }))}
                  placeholder={tx('s5AllergyPh')}
                  className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-sky-500/30"
                />
                <SpeakIntoField lang={lang} onText={t => setHistory(prev => ({ ...prev, allergyStatus: 'listed', allergies: addToList(prev.allergies, t) }))} />
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="block font-heading font-bold text-sm sm:text-base text-foreground">{tx('s5Meds')}</span>
          {statusRow('medicineStatus', medicineStatus, ['medsNone', 'medsUnsure', 'medsYes'])}
          {mentionedMeds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {mentionedMeds.map(m => (
                <button key={m} type="button" className={pill(false)}
                  onClick={() => { sovereignSound.playDialNotch(); setHistory(prev => ({ ...prev, medicineStatus: 'listed', currentMedicines: addToList(splitList(prev.currentMedicines).join(', '), m) })); }}>
                  + {m} <span className="text-[10.5px] font-bold text-emerald-700 dark:text-emerald-300">({it('fromWords')})</span>
                </button>
              ))}
            </div>
          )}
          {(medicineStatus === 'listed' || medicineStatus === 'unknown') && (
            <>
              <div className="flex flex-wrap gap-2">
                {MEDICINE_CHIPS.map(m => {
                  const on = splitList(history.currentMedicines).some(x => x.toLowerCase() === m.value.toLowerCase());
                  return (
                    <button key={m.value} type="button" aria-pressed={on} className={pill(on)}
                      onClick={() => { sovereignSound.playDialNotch(); setHistory(prev => ({ ...prev, medicineStatus: 'listed', currentMedicines: on ? splitList(prev.currentMedicines).filter(x => x.toLowerCase() !== m.value.toLowerCase()).join(', ') : addToList(prev.currentMedicines, m.value) })); }}>
                      {it(m.key)}
                    </button>
                  );
                })}
              </div>
              {medicineStatus === 'listed' && (
                <div className="flex gap-2 items-center">
                  <input
                    id="s5-meds"
                    type="text"
                    value={history.currentMedicines}
                    onChange={e => setHistory(prev => ({ ...prev, currentMedicines: e.target.value, medicineStatus: 'listed' }))}
                    placeholder={tx('s5MedsPh')}
                    className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                  <SpeakIntoField lang={lang} onText={t => setHistory(prev => ({ ...prev, medicineStatus: 'listed', currentMedicines: addToList(prev.currentMedicines, t) }))} />
                </div>
              )}
              <p className="text-xs text-muted-foreground">{it('medsStripHint')}</p>
            </>
          )}
        </div>
      </div>

      {/* Ayurvedic questions — only for patients seeing (or open to) an Ayurveda doctor */}
      {showAyurveda && (
        <>
          <div className="flex items-center gap-2.5 pt-1">
            <Leaf size={18} className="text-emerald-600" />
            <div>
              <div className="font-heading font-extrabold text-base text-foreground">{tx('s5Ayurveda')}</div>
              <div className="text-xs text-muted-foreground">{tx('s5AyurvedaSub')}</div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 flex items-start gap-3">
            <Sparkles size={18} className="text-primary shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground leading-relaxed">
              <span className="font-bold text-foreground block mb-0.5">{it('whyTitle')}</span>
              {it('whyPlain')}
            </div>
          </div>

          {/* Digestion: the patient's own answer only — nothing is pre-selected from the complaint */}
          <div className="p-5 sm:p-6 rounded-3xl bg-card border border-border/80 flex flex-col gap-3">
            <span className="font-heading font-bold text-sm sm:text-base text-foreground flex items-center gap-2"><Flame size={17} className="text-amber-500" /> {tx('agniTitle')}</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {AGNI.map(opt => {
                const Icon = opt.icon;
                const active = agni === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => { sovereignSound.playDialNotch(); setPariksha(prev => ({ ...prev, agni: prev.agni === opt.type ? undefined : opt.type })); }}
                    aria-pressed={active}
                    className={`p-3.5 flex items-start gap-3 ${optionClass(active)}`}
                  >
                    <Icon size={18} className="text-primary shrink-0 mt-0.5" />
                    <span className="flex flex-col min-w-0">
                      <span className="font-heading font-bold text-sm text-foreground">{tx(opt.title)}</span>
                      <span className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{tx(opt.sub)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-5 sm:p-6 rounded-3xl bg-card border border-border/80 flex flex-col gap-4">
            <span className="font-heading font-bold text-sm sm:text-base text-foreground flex items-center gap-2"><Zap size={17} className="text-primary" /> {it('prTitle')}</span>
            {PRAKRITI_QUESTIONS.map((q, qi) => (
              <div key={q.title}>
                <span className="block text-sm font-semibold text-foreground/90 mb-1.5">{it(q.title)}</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {q.options.map(o => {
                    const active = screen[qi] === o.dosha;
                    return (
                      <button key={o.dosha} type="button" aria-pressed={active} onClick={() => answerPrakriti(qi, o.dosha)}
                        className={`p-3 text-sm font-semibold flex items-center justify-between gap-2 ${optionClass(active)}`}>
                        <span>{it(o.key)}</span>
                        {active && <CheckCircle2 size={15} className="text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">{it('prNote')}</p>
          </div>

          <div className="p-5 sm:p-6 rounded-3xl bg-card border border-border/80 flex flex-col gap-3">
            <span className="font-heading font-bold text-sm sm:text-base text-foreground flex items-center gap-2"><Scale size={17} className="text-primary" /> {tx('energyTitle')}</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {ENERGY.map(lvl => {
                const active = pariksha.energySelfReport === lvl.value;
                return (
                  <button
                    key={lvl.value}
                    type="button"
                    onClick={() => { sovereignSound.playDialNotch(); setPariksha(prev => ({ ...prev, energySelfReport: prev.energySelfReport === lvl.value ? undefined : lvl.value })); }}
                    aria-pressed={active}
                    className={`p-3.5 text-sm font-semibold flex items-center justify-between gap-2 ${optionClass(active)}`}
                  >
                    <span>{tx(lvl.label)}</span>
                    {active && <CheckCircle2 size={16} className="text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/** Condition labels that live in kioskIntakeText rather than kioskLocalization. */
const CONDITION_OWN: Record<string, true> = Object.fromEntries(CONDITIONS.filter(c => c.own).map(c => [c.key, true]));
