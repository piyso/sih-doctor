import React, { useEffect, useMemo, useRef } from 'react';
import { Flame, CheckCircle2, Shield, Wind, Droplets, Volume2, Sparkles, Zap, Scale, ClipboardList, Leaf } from 'lucide-react';
import { DashavidhaPariksha, AgniType, SocratesSymptom, PatientHistory, CareStream } from '../../types/api';
import { sovereignSound } from '../../utils/audio';
import { getClinicalProfile, getLocalizedRationale } from '../../utils/clinicalOntology';
import { BCP47, KioskTextKey, kioskText, normalizeLang } from '../../utils/kioskLocalization';
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

// `value` is the English label stored for the doctor.
const CONDITIONS: Array<{ value: string; key: KioskTextKey }> = [
  { value: 'Diabetes', key: 'condDiabetes' },
  { value: 'Hypertension', key: 'condBp' },
  { value: 'Heart disease', key: 'condHeart' },
  { value: 'Asthma / COPD', key: 'condAsthma' },
  { value: 'Thyroid disorder', key: 'condThyroid' },
  { value: 'Kidney disease', key: 'condKidney' },
  { value: 'Liver disease', key: 'condLiver' }
];

const AGNI: Array<{ type: AgniType; title: KioskTextKey; sub: KioskTextKey; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
  { type: 'SAMAGNI', title: 'agniSama', sub: 'agniSamaSub', icon: Shield },
  { type: 'VISHAMAGNI', title: 'agniVishama', sub: 'agniVishamaSub', icon: Wind },
  { type: 'TIKSHNAGNI', title: 'agniTikshna', sub: 'agniTikshnaSub', icon: Flame },
  { type: 'MANDAGNI', title: 'agniManda', sub: 'agniMandaSub', icon: Droplets }
];

const PRAKRITI: Array<{ id: string; key: KioskTextKey }> = [
  { id: 'Vataja', key: 'prVata' },
  { id: 'Pittaja', key: 'prPitta' },
  { id: 'Kaphaja', key: 'prKapha' },
  { id: 'Mixed / Dvandvaja', key: 'prMixed' }
];

const ENERGY: Array<{ key: 'Pravara' | 'Madhyama' | 'Avara'; label: KioskTextKey }> = [
  { key: 'Pravara', label: 'enHigh' },
  { key: 'Madhyama', label: 'enMed' },
  { key: 'Avara', label: 'enLow' }
];

export const Step5Pariksha: React.FC<Step5ParikshaProps> = ({
  pariksha,
  setPariksha,
  history,
  setHistory,
  careStream,
  selectedBodyRegion = '',
  transcript = '',
  language = 'hi',
  registerNav
}) => {
  const lang = normalizeLang(language);
  const tx = kioskText(lang);
  const showAyurveda = careStream !== 'ALLOPATHY';
  const userTouchedAgni = useRef(!!pariksha.agni);

  const clinicalProfile = useMemo(() => getClinicalProfile(selectedBodyRegion, transcript), [selectedBodyRegion, transcript]);

  // Pre-select the digestion pattern most often linked to the complaint — only as a suggestion the
  // patient can change, and never overriding something they already chose.
  useEffect(() => {
    if (!showAyurveda || userTouchedAgni.current) return;
    setPariksha(prev => (prev.agni ? prev : { ...prev, agni: clinicalProfile.defaultAgni }));
  }, [clinicalProfile, showAyurveda, setPariksha]);

  useStepNav(registerNav, { canNext: true });

  const toggleCondition = (value: string) => {
    sovereignSound.playDialNotch();
    setHistory(prev => {
      const has = prev.conditions.includes(value);
      const conditions = value === 'None'
        ? (has ? [] : ['None'])
        : has ? prev.conditions.filter(c => c !== value) : [...prev.conditions.filter(c => c !== 'None'), value];
      return { ...prev, conditions };
    });
  };

  const optionClass = (active: boolean) =>
    `rounded-2xl border transition-colors text-left ${active ? 'bg-primary/5 border-primary ring-2 ring-primary/30' : 'bg-muted/30 border-border/70 hover:bg-muted/60'}`;

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

      {/* Health history — asked of every patient */}
      <div className="p-5 sm:p-6 rounded-3xl bg-card border border-border/80 flex flex-col gap-4">
        <div>
          <span className="block font-heading font-bold text-sm sm:text-base text-foreground mb-2.5">{tx('s5Conditions')}</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[...CONDITIONS, { value: 'None', key: 'condNone' as KioskTextKey }].map(c => {
              const active = history.conditions.includes(c.value);
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => toggleCondition(c.value)}
                  aria-pressed={active}
                  className={`p-3 text-sm font-semibold flex items-center justify-between gap-2 ${optionClass(active)}`}
                >
                  <span>{tx(c.key)}</span>
                  {active && <CheckCircle2 size={15} className="text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-foreground/90 mb-1.5" htmlFor="s5-allergy">{tx('s5Allergy')}</label>
            <input
              id="s5-allergy"
              type="text"
              value={history.allergies}
              onChange={e => setHistory(prev => ({ ...prev, allergies: e.target.value }))}
              placeholder={tx('s5AllergyPh')}
              className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-sky-500/30"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground/90 mb-1.5" htmlFor="s5-meds">{tx('s5Meds')}</label>
            <input
              id="s5-meds"
              type="text"
              value={history.currentMedicines}
              onChange={e => setHistory(prev => ({ ...prev, currentMedicines: e.target.value }))}
              placeholder={tx('s5MedsPh')}
              className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-sky-500/30"
            />
          </div>
        </div>
      </div>

      {/* Ayurvedic assessment — only for patients seeing (or open to) an Ayurveda doctor */}
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
              <span className="font-bold text-foreground block mb-0.5">{tx('s5WhyTitle')}</span>
              {getLocalizedRationale(clinicalProfile, lang)}
            </div>
          </div>

          <div className="p-5 sm:p-6 rounded-3xl bg-card border border-border/80 flex flex-col gap-3">
            <span className="font-heading font-bold text-sm sm:text-base text-foreground flex items-center gap-2"><Flame size={17} className="text-amber-500" /> {tx('agniTitle')}</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {AGNI.map(opt => {
                const Icon = opt.icon;
                const active = pariksha.agni === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => { userTouchedAgni.current = true; sovereignSound.playDialNotch(); setPariksha(prev => ({ ...prev, agni: opt.type })); }}
                    aria-pressed={active}
                    className={`p-3.5 flex items-start gap-3 ${optionClass(active)}`}
                  >
                    <Icon size={18} className="text-primary shrink-0 mt-0.5" />
                    <span className="flex flex-col min-w-0">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-heading font-bold text-sm text-foreground">{tx(opt.title)}</span>
                        {active && !userTouchedAgni.current && (
                          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{tx('suggested')}</span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{tx(opt.sub)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-5 sm:p-6 rounded-3xl bg-card border border-border/80 flex flex-col gap-3">
            <span className="font-heading font-bold text-sm sm:text-base text-foreground flex items-center gap-2"><Zap size={17} className="text-primary" /> {tx('prakritiTitle')}</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PRAKRITI.map(p => {
                const active = pariksha.prakriti === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { sovereignSound.playDialNotch(); setPariksha(prev => ({ ...prev, prakriti: p.id })); }}
                    aria-pressed={active}
                    className={`p-3.5 text-sm font-semibold flex items-center justify-between gap-2 ${optionClass(active)}`}
                  >
                    <span>{tx(p.key)}</span>
                    {active && <CheckCircle2 size={16} className="text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-5 sm:p-6 rounded-3xl bg-card border border-border/80 flex flex-col gap-3">
            <span className="font-heading font-bold text-sm sm:text-base text-foreground flex items-center gap-2"><Scale size={17} className="text-primary" /> {tx('energyTitle')}</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {ENERGY.map(lvl => {
                const active = pariksha.sara === lvl.key;
                return (
                  <button
                    key={lvl.key}
                    type="button"
                    onClick={() => { sovereignSound.playDialNotch(); setPariksha(prev => ({ ...prev, sara: lvl.key, satva: lvl.key })); }}
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
