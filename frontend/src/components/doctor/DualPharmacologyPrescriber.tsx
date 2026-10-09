import React, { useState } from 'react';
import { Trash2, AlertTriangle, ShieldCheck, Printer, FileCode, Sparkles, Zap, Search, AlertOctagon, Leaf, Pill, X } from 'lucide-react';
import { AllopathicMedication, AyushFormulation, ConflictAlert, SessionDetail } from '../../types/api';
import { CLINICAL_ALLOPATHIC_FORMULARY, CLINICAL_AYUSH_FORMULARY, FormularyAllopathicItem, FormularyAyushItem } from '../../services/clinicalFormulary';
import { api } from '../../services/api';
import { ConflictAlertModal } from './ConflictAlertModal';
import { AbdmFhirExportModal } from './AbdmFhirExportModal';
import { sovereignSound } from '../../utils/audio';
import { getDynamicDietaryGuidance } from '../../utils/clinicalPathya';
import { DoctorRole, RxDraft } from './doctorRole';

interface DualPharmacologyPrescriberProps {
  role: DoctorRole;
  allopathicMeds: AllopathicMedication[];
  setAllopathicMeds: React.Dispatch<React.SetStateAction<AllopathicMedication[]>>;
  ayushFormulations: AyushFormulation[];
  setAyushFormulations: React.Dispatch<React.SetStateAction<AyushFormulation[]>>;
  draft: RxDraft;
  updateDraft: (patch: Partial<RxDraft> | ((d: RxDraft) => Partial<RxDraft>)) => void;
  sessionId: string;
  session?: SessionDetail | null;
  onOpenRxModal?: () => void;
}

export interface ConflictResolutionStrategy {
  targetHerbKeywords: string[];
  substitutes: AyushFormulation[];
  buttonLabel: string;
  mechanismDetail: string;
  severityTitle: string;
}

export const getConflictResolutionStrategy = (
  alert: ConflictAlert
): ConflictResolutionStrategy => {
  const allo = (alert.allopathicDrug || '').toLowerCase();
  const herb = (alert.ayushHerb || '').toLowerCase();

  // 1. Warfarin / Anticoagulants + Guggulu / Garlic
  if (allo.includes('warfarin') || allo.includes('coumadin') || allo.includes('clopidogrel') || herb.includes('guggulu') || herb.includes('garlic') || herb.includes('lasuna')) {
    return {
      targetHerbKeywords: ['guggulu', 'guggul', 'garlic', 'lasuna', 'lashuna', 'allium'],
      substitutes: [
        {
          classicalName: 'Rasnasaptaka Kwatha (AIIA Safe Alternative)',
          namasteCode: 'AYU-KW-042',
          dosageForm: 'Kwatha (Decoction)',
          dose: '15ml BD with equal warm water',
          anupana: 'Koshna Jala (Warm Water)',
          frequency: 'Twice daily after food',
          durationDays: 14,
          pathya: ['Warm medicated water', 'light soups (Mudga yusha)'],
          apathya: ['Curd', 'fermented food', 'night-time sleep']
        },
        {
          classicalName: 'Shallaki (Boswellia serrata)',
          namasteCode: 'AYU-SHA-001',
          dosageForm: 'Extract Tablet',
          dose: '500mg BD',
          anupana: 'Warm Water',
          frequency: 'Twice daily after food',
          durationDays: 30
        }
      ],
      buttonLabel: '1-Click Switch to Rasnasaptaka Kwatha + Shallaki',
      mechanismDetail: 'Hepatic CYP2C9/CYP3A4 inhibition by guggulsterones elevates free warfarin fraction, causing fatal INR surge.',
      severityTitle: 'CRITICAL HEMORRHAGE RISK'
    };
  }

  // 2. Digoxin + Yashtimadhu / Licorice / Mulethi
  if (allo.includes('digoxin') || allo.includes('lanoxin') || herb.includes('yashtimadhu') || herb.includes('licorice') || herb.includes('mulethi') || herb.includes('glycyrrhiza')) {
    return {
      targetHerbKeywords: ['yashtimadhu', 'licorice', 'mulethi', 'glycyrrhiza'],
      substitutes: [
        {
          classicalName: 'Draksharishta (AIIA Safe Alternative)',
          namasteCode: 'AYU-ARI-012',
          dosageForm: 'Asava-Arishta',
          dose: '20ml BD with equal water',
          anupana: 'Equal Water',
          frequency: 'Twice daily after meals',
          durationDays: 30,
          pathya: ['Fresh fruits', 'pomegranate juice', 'cow milk'],
          apathya: ['Dry pungent foods', 'excessive fasting']
        },
        {
          classicalName: 'Arjuna Kwatha (Terminalia arjuna)',
          namasteCode: 'AYU-KW-018',
          dosageForm: 'Decoction',
          dose: '20ml BD',
          anupana: 'Boiled Milk / Warm Water',
          frequency: 'Twice daily',
          durationDays: 30
        }
      ],
      buttonLabel: '1-Click Switch to Draksharishta + Arjuna Kwatha',
      mechanismDetail: '11β-HSD2 enzyme inhibition causes severe hypokalemia, inducing fatal digitalis-mediated ventricular arrhythmias.',
      severityTitle: 'FATAL ARRHYTHMIA RISK'
    };
  }

  // 3. Metformin / Sulfonylureas + Shilajit / Nisha Amalaki
  if (allo.includes('metformin') || allo.includes('glimepiride') || allo.includes('glibenclamide') || allo.includes('glycomet') || herb.includes('shilajit') || herb.includes('karela') || herb.includes('meshashringi')) {
    return {
      targetHerbKeywords: ['shilajit', 'karela', 'meshashringi', 'gymnema'],
      substitutes: [
        {
          classicalName: 'Nishamalaki Vati (AIIA Safe Alternative)',
          namasteCode: 'AYU-VAT-031',
          dosageForm: 'Vati (Tablet)',
          dose: '500mg BD',
          anupana: 'Warm Water',
          frequency: 'Twice daily before food',
          durationDays: 30,
          pathya: ['Yava (Barley)', 'Mudga (Moong dal)', 'bitter vegetables'],
          apathya: ['Refined sugar', 'jaggery', 'heavy dairy', 'daytime sleeping']
        }
      ],
      buttonLabel: '1-Click Switch to Nishamalaki Vati',
      mechanismDetail: 'Additive AMPK-mediated peripheral glucose uptake produces rapid, symptomatic hypoglycemic collapse.',
      severityTitle: 'HYPOGLYCEMIC COLLAPSE RISK'
    };
  }

  // 4. Aspirin + Lasuna / Garlic
  if (allo.includes('aspirin') || allo.includes('ecosprin') || herb.includes('lasuna') || herb.includes('garlic') || herb.includes('lashuna')) {
    return {
      targetHerbKeywords: ['lasuna', 'garlic', 'lashuna', 'allium'],
      substitutes: [
        {
          classicalName: 'Haridra Khanda (AIIA Safe Alternative)',
          namasteCode: 'AYU-KHA-009',
          dosageForm: 'Granules',
          dose: '3g BD with warm milk',
          anupana: 'Warm Milk / Koshna Jala',
          frequency: 'Twice daily after food',
          durationDays: 21,
          pathya: ['Light warm food', 'fresh vegetables'],
          apathya: ['Sour foods', 'curd at night']
        }
      ],
      buttonLabel: '1-Click Switch to Haridra Khanda',
      mechanismDetail: 'Dual platelet COX-1 blockade and allicin antiplatelet synergy increases gastrointestinal hemorrhage hazard.',
      severityTitle: 'GASTROINTESTINAL BLEEDING HAZARD'
    };
  }

  // 5. Default Fallback
  const herbBase = (alert.ayushHerb || 'Herb').split(' ')[0];
  return {
    targetHerbKeywords: [herbBase.toLowerCase()],
    substitutes: [
      {
        classicalName: 'Amalaki Rasayana (Pure Standardized Extract)',
        namasteCode: 'AYU-RAS-004',
        dosageForm: 'Rasayana Churna',
        dose: '3g BD with honey or water',
        anupana: 'Madhu / Warm Water',
        frequency: 'Twice daily before meals',
        durationDays: 30,
        pathya: ['Light nutritious diet', 'cow ghee'],
        apathya: ['Excessive spicy / pungent food']
      }
    ],
    buttonLabel: '1-Click Switch to Amalaki Rasayana',
    mechanismDetail: alert.mechanism || 'Metabolic pathway competition detected.',
    severityTitle: alert.severity === 'CRITICAL_LETHAL' ? 'CRITICAL CONTRAINDICATION' : 'CLINICAL CONFLICT'
  };
};

const FREQUENCIES = ['OD (Once daily)', 'BD (Twice daily)', 'TDS (Thrice daily)', 'QID (Four times daily)', 'HS (At bedtime)', 'SOS (When needed)', 'Before food, twice daily', 'After food, twice daily'];

const splitAdvice = (text: string) =>
  text.replace(/\*/g, '').split(/[,;]|\.\s/).map(t => t.trim().replace(/\.$/, '')).filter(t => t.length > 1);

/** Editable list of short advice items (used for Pathya / Apathya). */
const AdviceList: React.FC<{
  title: string;
  tone: 'good' | 'avoid';
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}> = ({ title, tone, items, onChange, placeholder }) => {
  const [value, setValue] = useState('');
  const add = () => {
    const v = value.trim();
    if (!v || items.some(i => i.toLowerCase() === v.toLowerCase())) return;
    onChange([...items, v]);
    setValue('');
  };
  return (
    <div className="flex flex-col gap-2">
      <span className={`text-xs font-extrabold flex items-center gap-1.5 ${tone === 'good' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
        <span className={`w-2 h-2 rounded-full ${tone === 'good' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
        {title}
      </span>
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {items.length === 0 && <span className="text-[11px] text-muted-foreground italic">Nothing added yet</span>}
        {items.map(item => (
          <span key={item} className={`pl-2.5 pr-1 py-1 rounded-lg text-xs font-medium border flex items-center gap-1 ${tone === 'good' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
            {item}
            <button type="button" onClick={() => onChange(items.filter(i => i !== item))} className="h-5 w-5 rounded flex items-center justify-center hover:bg-background/70" aria-label={`Remove ${item}`}>
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background"
        />
        <button type="button" onClick={add} className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-border bg-card hover:bg-muted">Add</button>
      </div>
    </div>
  );
};

/** One editable medicine row. */
const MedRow: React.FC<{
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  fields: Array<{ label: string; value: string | number; onChange: (v: string) => void; type?: 'text' | 'number' | 'frequency'; width?: string }>;
  onRemove: () => void;
  tone: 'allo' | 'ayush';
}> = ({ title, subtitle, badge, fields, onRemove, tone }) => (
  <div className={`p-3 rounded-xl border bg-card flex flex-col gap-2 ${tone === 'ayush' ? 'border-emerald-500/30' : 'border-sky-500/30'}`}>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="text-sm font-bold text-foreground flex items-center gap-1.5 flex-wrap">{title}{badge}</div>
        {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
      </div>
      <button type="button" onClick={onRemove} className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 shrink-0" title="Remove">
        <Trash2 size={14} />
      </button>
    </div>
    <div className="flex flex-wrap gap-2">
      {fields.map(f => (
        <label key={f.label} className={`flex flex-col gap-0.5 ${f.width || 'flex-1 min-w-[110px]'}`}>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase">{f.label}</span>
          {f.type === 'frequency' ? (
            <select value={String(f.value)} onChange={e => f.onChange(e.target.value)} className="px-2 py-1.5 text-xs rounded-lg border border-border bg-background">
              {!FREQUENCIES.includes(String(f.value)) && f.value !== '' && <option value={String(f.value)}>{String(f.value)}</option>}
              {f.value === '' && <option value="">Choose…</option>}
              {FREQUENCIES.map(q => <option key={q} value={q}>{q}</option>)}
            </select>
          ) : (
            <input
              type={f.type === 'number' ? 'number' : 'text'}
              min={f.type === 'number' ? 0 : undefined}
              value={f.value}
              onChange={e => f.onChange(e.target.value)}
              className="px-2 py-1.5 text-xs rounded-lg border border-border bg-background"
            />
          )}
        </label>
      ))}
    </div>
  </div>
);

/** Search + quick-add for a formulary. */
const FormularyPicker = <T,>({
  items,
  quickItems,
  getLabel,
  getDetail,
  matches,
  onPick,
  onCustom,
  placeholder,
  tone
}: {
  items: T[];
  quickItems: T[];
  getLabel: (item: T) => string;
  getDetail: (item: T) => string;
  matches: (item: T, term: string) => boolean;
  onPick: (item: T) => void;
  onCustom: (name: string) => void;
  placeholder: string;
  tone: 'allo' | 'ayush';
}) => {
  const [term, setTerm] = useState('');
  const results = term.trim() ? items.filter(i => matches(i, term.trim().toLowerCase())).slice(0, 8) : [];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {quickItems.map(item => (
          <button key={getLabel(item)} type="button" onClick={() => onPick(item)} className={`px-2.5 py-1 rounded-lg text-xs font-semibold border bg-background hover:bg-muted ${tone === 'ayush' ? 'border-emerald-500/30' : 'border-sky-500/30'}`}>
            + {getLabel(item)}
          </button>
        ))}
      </div>
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
        <input
          value={term}
          onChange={e => setTerm(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && term.trim()) {
              e.preventDefault();
              if (results[0]) onPick(results[0]);
              else onCustom(term.trim());
              setTerm('');
            }
          }}
          placeholder={placeholder}
          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background"
        />
      </div>
      {term.trim() && (
        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
          {results.map(item => (
            <button key={getLabel(item)} type="button" onClick={() => { onPick(item); setTerm(''); }} className="text-left px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs">
              <strong className="text-foreground">{getLabel(item)}</strong>
              <span className="block text-[10.5px] text-muted-foreground">{getDetail(item)}</span>
            </button>
          ))}
          <button type="button" onClick={() => { onCustom(term.trim()); setTerm(''); }} className="text-left px-2.5 py-1.5 rounded-lg border border-dashed border-primary/50 text-xs font-semibold text-primary">
            + Add “{term.trim()}” (not in formulary)
          </button>
        </div>
      )}
    </div>
  );
};

export const DualPharmacologyPrescriber: React.FC<DualPharmacologyPrescriberProps> = ({
  role,
  allopathicMeds,
  setAllopathicMeds,
  ayushFormulations,
  setAyushFormulations,
  draft,
  updateDraft,
  sessionId,
  session = null,
  onOpenRxModal
}) => {
  const [detectedConflicts, setDetectedConflicts] = useState<ConflictAlert[]>([]);
  const [modalAlert, setModalAlert] = useState<ConflictAlert | null>(null);
  const hasShownModalForPair = React.useRef<string>('');
  const [showFhirModal, setShowFhirModal] = useState(false);

  // Re-check herb–drug interactions whenever either list changes.
  React.useEffect(() => {
    let active = true;
    if (allopathicMeds.length === 0 || ayushFormulations.length === 0) {
      setDetectedConflicts([]);
      setModalAlert(null);
      hasShownModalForPair.current = '';
      return;
    }
    api.checkContraindicationsFull(allopathicMeds, ayushFormulations).then(res => {
      if (!active) return;
      setDetectedConflicts(res.alerts);
      if (res.alerts.length > 0) {
        const pairKey = `${res.alerts[0].itemA || res.alerts[0].allopathicDrug}-${res.alerts[0].itemB || res.alerts[0].ayushHerb}`;
        if (hasShownModalForPair.current !== pairKey) {
          hasShownModalForPair.current = pairKey;
          sovereignSound.playClinicalAlert();
          setModalAlert(res.alerts[0]);
        }
      } else {
        hasShownModalForPair.current = '';
        setModalAlert(null);
      }
    }).catch(e => console.warn('Interaction check failed:', e));
    return () => { active = false; };
  }, [allopathicMeds, ayushFormulations]);

  const detectedConflict: ConflictAlert | null = detectedConflicts[0] || null;

  const handleSubstitute = (strategy: ConflictResolutionStrategy) => {
    sovereignSound.playCrystalChime();
    setAyushFormulations(prev => [
      ...prev.filter(a => !strategy.targetHerbKeywords.some(k => (a.classicalName || '').toLowerCase().includes(k))),
      ...strategy.substitutes
    ]);
    setDetectedConflicts([]);
    setModalAlert(null);
    hasShownModalForPair.current = '';
  };

  const addAllopathic = (m: FormularyAllopathicItem | { name: string }) => {
    sovereignSound.playDialNotch();
    const item = m as FormularyAllopathicItem;
    setAllopathicMeds(prev => prev.some(p => p.name.toLowerCase() === item.name.toLowerCase()) ? prev : [...prev, {
      name: item.name,
      genericName: item.genericName,
      dosage: item.dosage || '',
      route: item.route || 'ORAL',
      frequency: item.frequency || '',
      durationDays: item.durationDays || 0
    }]);
  };

  const addAyush = (a: FormularyAyushItem | { classicalName: string }) => {
    sovereignSound.playDialNotch();
    const item = a as FormularyAyushItem;
    setAyushFormulations(prev => prev.some(p => p.classicalName.toLowerCase() === item.classicalName.toLowerCase()) ? prev : [...prev, {
      classicalName: item.classicalName,
      namasteCode: item.namasteCode,
      dosageForm: item.dosageForm || '',
      dose: item.dose || '',
      anupana: item.anupana || '',
      frequency: item.frequency || '',
      durationDays: item.durationDays || 0,
      pathya: item.pathya,
      apathya: item.apathya
    }]);
  };

  const editAllo = (idx: number, patch: Partial<AllopathicMedication>) =>
    setAllopathicMeds(prev => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  const editAyush = (idx: number, patch: Partial<AyushFormulation>) =>
    setAyushFormulations(prev => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));

  const suggestDiet = () => {
    const guidance = getDynamicDietaryGuidance(session, ayushFormulations);
    const merge = (current: string[], text: string) => Array.from(new Set([...current, ...splitAdvice(text)]));
    updateDraft(d => ({ pathya: merge(d.pathya, guidance.pathya), apathya: merge(d.apathya, guidance.apathya) }));
    sovereignSound.playCrystalChime();
  };

  const isAyurveda = role === 'AYURVEDA';

  const alloSection = (secondary: boolean) => (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
          <Pill size={15} /> {secondary ? 'Modern medicines the patient already takes' : 'Medicines'}
          <span className="text-[10.5px] font-bold px-1.5 rounded-full bg-sky-500/10">{allopathicMeds.length}</span>
        </span>
      </div>
      {secondary && <p className="text-[11px] text-muted-foreground -mt-1">Recorded only to check interactions with your Ayurvedic prescription.</p>}
      <FormularyPicker<FormularyAllopathicItem>
        items={CLINICAL_ALLOPATHIC_FORMULARY}
        quickItems={secondary ? [] : CLINICAL_ALLOPATHIC_FORMULARY.slice(0, 5)}
        getLabel={m => m.name}
        getDetail={m => `${m.genericName} · ${m.dosage} · ${m.frequency}`}
        matches={(m, t) => m.name.toLowerCase().includes(t) || m.genericName.toLowerCase().includes(t) || m.category.toLowerCase().includes(t)}
        onPick={addAllopathic}
        onCustom={name => addAllopathic({ name })}
        placeholder="Search NLEM medicine by name or class…"
        tone="allo"
      />
      <div className="flex flex-col gap-2">
        {allopathicMeds.map((med, idx) => (
          <MedRow
            key={`${med.name}-${idx}`}
            tone="allo"
            title={med.name}
            subtitle={med.genericName && med.genericName !== med.name ? med.genericName : med.instructions}
            onRemove={() => setAllopathicMeds(prev => prev.filter((_, i) => i !== idx))}
            fields={[
              { label: 'Dose', value: med.dosage, onChange: v => editAllo(idx, { dosage: v }), width: 'w-24' },
              { label: 'Frequency', value: med.frequency, onChange: v => editAllo(idx, { frequency: v }), type: 'frequency' },
              { label: 'Days', value: med.durationDays || '', onChange: v => editAllo(idx, { durationDays: parseInt(v, 10) || 0 }), type: 'number', width: 'w-20' }
            ]}
          />
        ))}
        {allopathicMeds.length === 0 && (
          <div className="text-center py-4 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
            {secondary ? 'None recorded.' : 'No medicines added yet.'}
          </div>
        )}
      </div>
    </section>
  );

  const ayushSection = (secondary: boolean) => (
    <section className="flex flex-col gap-2.5">
      <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
        <Leaf size={15} /> {secondary ? 'Ayurvedic / herbal medicines the patient already takes' : 'Classical formulations'}
        <span className="text-[10.5px] font-bold px-1.5 rounded-full bg-emerald-500/10">{ayushFormulations.length}</span>
      </span>
      {secondary && <p className="text-[11px] text-muted-foreground -mt-1">Recorded only to check interactions with your prescription.</p>}
      <FormularyPicker<FormularyAyushItem>
        items={CLINICAL_AYUSH_FORMULARY}
        quickItems={secondary ? [] : CLINICAL_AYUSH_FORMULARY.slice(0, 5)}
        getLabel={a => a.classicalName}
        getDetail={a => `${a.dosageForm} · ${a.dose} · Anupana: ${a.anupana}`}
        matches={(a, t) => a.classicalName.toLowerCase().includes(t) || a.category.toLowerCase().includes(t)}
        onPick={addAyush}
        onCustom={name => addAyush({ classicalName: name })}
        placeholder="Search Ayurvedic Formulary of India…"
        tone="ayush"
      />
      <div className="flex flex-col gap-2">
        {ayushFormulations.map((ay, idx) => {
          const isSchE1 = /rasa|bhasma|sindura|vatsanabha|kupilu|gunja|bhanga/i.test(ay.classicalName || '');
          return (
            <MedRow
              key={`${ay.classicalName}-${idx}`}
              tone="ayush"
              title={ay.classicalName}
              subtitle={ay.dosageForm}
              badge={isSchE1 ? <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-200 flex items-center gap-1" title="Schedule E1 drug — prescribe with caution (Drugs & Cosmetics Rules, Rule 161)"><AlertOctagon size={10} /> Schedule E1</span> : undefined}
              onRemove={() => setAyushFormulations(prev => prev.filter((_, i) => i !== idx))}
              fields={[
                { label: 'Dose', value: ay.dose, onChange: v => editAyush(idx, { dose: v }), width: 'w-28' },
                { label: 'Anupana (vehicle)', value: ay.anupana, onChange: v => editAyush(idx, { anupana: v }) },
                { label: 'Frequency', value: ay.frequency, onChange: v => editAyush(idx, { frequency: v }), type: 'frequency' },
                { label: 'Days', value: ay.durationDays || '', onChange: v => editAyush(idx, { durationDays: parseInt(v, 10) || 0 }), type: 'number', width: 'w-20' }
              ]}
            />
          );
        })}
        {ayushFormulations.length === 0 && (
          <div className="text-center py-4 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
            {secondary ? 'None recorded.' : 'No formulations added yet.'}
          </div>
        )}
      </div>
    </section>
  );

  return (
    <div className="physical-card p-4 flex flex-col gap-4">
      <div className="flex justify-between items-center flex-wrap gap-2 border-b border-border/70 pb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-bold text-foreground m-0">Prescription</h3>
          <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${isAyurveda ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300' : 'bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-300'}`}>
            {isAyurveda ? <Leaf size={11} /> : <Pill size={11} />} {isAyurveda ? 'Ayurveda' : 'Modern medicine'}
          </span>
          <span className="text-[10.5px] text-muted-foreground flex items-center gap-1" title="Every change is checked for herb–drug interactions"><ShieldCheck size={12} /> Interaction check on</span>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => { sovereignSound.playCrystalChime(); setShowFhirModal(true); }} disabled={!session} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 11.5 }} title="View the ABDM FHIR R4 record for this visit">
            <FileCode size={13} /> <span>ABDM record</span>
          </button>
          <button type="button" onClick={() => { sovereignSound.playMechanicalSnap(); onOpenRxModal?.(); }} disabled={!session} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 11.5 }}>
            <Printer size={13} /> <span>Finalize & print</span>
          </button>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {isAyurveda ? ayushSection(false) : alloSection(false)}
        {isAyurveda ? alloSection(true) : ayushSection(true)}
      </div>

      {/* Herb–drug interaction */}
      {detectedConflict && (() => {
        const strategy = getConflictResolutionStrategy(detectedConflict);
        return (
          <div className="p-3.5 rounded-xl border-2 border-rose-400 bg-rose-500/5 flex flex-col gap-2.5" role="alert">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-extrabold text-rose-800 dark:text-rose-200">
                    Interaction: {detectedConflict.allopathicDrug} × {detectedConflict.ayushHerb}
                  </div>
                  <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">{strategy.severityTitle}</div>
                </div>
              </div>
              {detectedConflict.citation && (
                <div className="text-right text-[11px] text-muted-foreground max-w-[45%]">
                  Source: <span className="text-foreground">{detectedConflict.citation}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-foreground/90 leading-relaxed m-0"><strong>Why:</strong> {detectedConflict.mechanism || strategy.mechanismDetail}</p>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <button type="button" onClick={() => handleSubstitute(strategy)} className="btn" style={{ background: '#16a34a', color: '#fff', borderColor: '#16a34a', padding: '7px 14px', fontSize: 12 }}>
                <Zap size={14} /> {strategy.buttonLabel.replace('1-Click ', '')}
              </button>
              <button type="button" onClick={() => setModalAlert(detectedConflict)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 11.5 }}>
                Details / override…
              </button>
            </div>
          </div>
        );
      })()}

      {/* Diet & advice */}
      {isAyurveda ? (
        <section className="p-3.5 rounded-xl bg-muted/30 border border-border flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm font-bold text-foreground">Pathya – Apathya (diet & lifestyle)</span>
            <button type="button" onClick={suggestDiet} className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-border bg-card hover:bg-muted flex items-center gap-1">
              <Sparkles size={12} className="text-primary" /> Suggest from prescription & Prakriti
            </button>
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <AdviceList title="Pathya — recommended" tone="good" items={draft.pathya} onChange={pathya => updateDraft({ pathya })} placeholder="e.g. Warm water, moong dal soup" />
            <AdviceList title="Apathya — avoid" tone="avoid" items={draft.apathya} onChange={apathya => updateDraft({ apathya })} placeholder="e.g. Curd at night, fried food" />
          </div>
          <p className="text-[11px] text-muted-foreground m-0">These lists are printed on the prescription. Leave them empty to print none.</p>
        </section>
      ) : null}

      <section className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold text-foreground">{isAyurveda ? 'Other advice (yoga, routine, therapy)' : 'Advice to patient'}</span>
          <textarea
            value={draft.advice}
            onChange={e => updateDraft({ advice: e.target.value })}
            rows={2}
            placeholder={isAyurveda ? 'e.g. Gentle walking 20 min daily; abhyanga with sesame oil' : 'e.g. Rest, plenty of fluids; return if fever crosses 102°F'}
            className="px-2.5 py-2 text-xs rounded-lg border border-border bg-background resize-y"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold text-foreground">Follow-up after (days)</span>
          <input
            type="number"
            min={0}
            value={draft.followUpDays}
            onChange={e => updateDraft({ followUpDays: e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0) })}
            placeholder="e.g. 14"
            className="px-2.5 py-2 text-xs rounded-lg border border-border bg-background w-32"
          />
        </label>
      </section>

      {modalAlert && (
        <ConflictAlertModal
          alert={modalAlert}
          onClose={() => setModalAlert(null)}
          onOverride={() => setModalAlert(null)}
          onRemoveHerb={herbName => {
            const key = (herbName || '').toLowerCase().split(' ')[0];
            setAyushFormulations(prev => prev.filter(a => !(a.classicalName || '').toLowerCase().includes(key)));
            setDetectedConflicts([]);
            setModalAlert(null);
            hasShownModalForPair.current = '';
          }}
        />
      )}

      {showFhirModal && session && (
        <AbdmFhirExportModal
          sessionId={sessionId}
          session={session}
          role={role}
          draft={draft}
          onClose={() => setShowFhirModal(false)}
        />
      )}
    </div>
  );
};
