import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Leaf, Stethoscope } from 'lucide-react';
import { ClinicalExamination, DoctorRole } from './doctorRole';

interface ClinicalExamPanelProps {
  role: DoctorRole;
  value: ClinicalExamination;
  onChange: (next: ClinicalExamination) => void;
  /** Patient-reported Prakriti / Agni from the kiosk, shown as a hint, never copied in. */
  kioskPariksha?: { prakriti?: string; agni?: string; sara?: string };
}

const ASHTAVIDHA: Array<[keyof NonNullable<ClinicalExamination['ashtavidha']>, string, string]> = [
  ['nadi', 'Nadi (pulse)', 'e.g. Vata-Pitta, 84/min'], ['mutra', 'Mutra (urine)', 'e.g. normal, pale'], ['mala', 'Mala (stool)', 'e.g. sama, baddha'],
  ['jihva', 'Jihva (tongue)', 'e.g. saama (coated)'], ['shabda', 'Shabda (voice)', ''], ['sparsha', 'Sparsha (touch)', 'e.g. ushna'],
  ['drik', 'Drik (eyes)', ''], ['akriti', 'Akriti (build)', 'e.g. madhyama']
];
const DASHAVIDHA: Array<[keyof NonNullable<ClinicalExamination['dashavidha']>, string]> = [
  ['prakriti', 'Prakriti'], ['vikriti', 'Vikriti'], ['sara', 'Sara'], ['samhanana', 'Samhanana'], ['pramana', 'Pramana'],
  ['satmya', 'Satmya'], ['satva', 'Satva'], ['aharaShakti', 'Ahara shakti'], ['vyayamaShakti', 'Vyayama shakti'], ['vaya', 'Vaya']
];
const SAMPRAPTI: Array<[keyof NonNullable<ClinicalExamination['samprapti']>, string]> = [
  ['dosha', 'Dosha'], ['dushya', 'Dushya'], ['srotas', 'Srotas'], ['srotodushti', 'Srotodushti'], ['agni', 'Agni'], ['udbhavaSthana', 'Udbhava sthana'], ['adhishthana', 'Adhishthana']
];

/** Clinician-recorded examination: general findings, and for a vaidya Ashtavidha / Dashavidha Pariksha and Samprapti ghataka. */
export const ClinicalExamPanel: React.FC<ClinicalExamPanelProps> = ({ role, value, onChange, kioskPariksha }) => {
  const [open, setOpen] = useState(false);
  const filled = [value.general, ...Object.values(value.ashtavidha || {}), ...Object.values(value.dashavidha || {}), ...Object.values(value.samprapti || {})].filter(Boolean).length;
  const grid = <K extends string>(rows: Array<[K, string, string?]>, part: 'ashtavidha' | 'dashavidha' | 'samprapti') => (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
      {rows.map(([k, label, ph]) => (
        <label key={k} className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold text-muted-foreground">{label}</span>
          <input value={(value[part] as any)?.[k] || ''} placeholder={ph || ''} onChange={e => onChange({ ...value, [part]: { ...(value[part] || {}), [k]: e.target.value } })} className="px-2 py-1 text-xs rounded-lg border border-border bg-background" />
        </label>
      ))}
    </div>
  );
  return (
    <section className="rounded-xl border border-border p-3 flex flex-col gap-2" aria-label="Examination">
      <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center justify-between text-xs font-extrabold text-foreground">
        <span className="flex items-center gap-1.5">{role === 'AYURVEDA' ? <Leaf size={13} className="text-emerald-600" /> : <Stethoscope size={13} />} Examination {role === 'AYURVEDA' ? '(Ashtavidha / Dashavidha / Samprapti)' : ''}</span>
        <span className="flex items-center gap-1 text-[10.5px] font-semibold text-muted-foreground">{filled ? `${filled} recorded` : 'not recorded'} {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
      </button>
      {open && (
        <>
          <textarea value={value.general || ''} onChange={e => onChange({ ...value, general: e.target.value })} rows={2} placeholder="General and systemic examination findings" className="px-2.5 py-2 text-xs rounded-lg border border-border bg-background resize-y" />
          {role === 'AYURVEDA' && (
            <>
              {kioskPariksha && (kioskPariksha.prakriti || kioskPariksha.agni) && (
                <div className="text-[10.5px] text-muted-foreground">Patient-reported at the kiosk: {[kioskPariksha.prakriti && `Prakriti ${kioskPariksha.prakriti}`, kioskPariksha.agni && `Agni ${kioskPariksha.agni}`, kioskPariksha.sara && `Sara ${kioskPariksha.sara}`].filter(Boolean).join(' · ')} — confirm on examination.</div>
              )}
              <span className="text-[10.5px] font-bold text-emerald-700 uppercase">Ashtavidha Pariksha</span>
              {grid(ASHTAVIDHA, 'ashtavidha')}
              <span className="text-[10.5px] font-bold text-emerald-700 uppercase">Dashavidha Pariksha</span>
              {grid(DASHAVIDHA.map(([k, l]) => [k, l, ''] as [typeof k, string, string]), 'dashavidha')}
              <span className="text-[10.5px] font-bold text-emerald-700 uppercase">Samprapti ghataka</span>
              {grid(SAMPRAPTI.map(([k, l]) => [k, l, ''] as [typeof k, string, string]), 'samprapti')}
            </>
          )}
        </>
      )}
    </section>
  );
};
