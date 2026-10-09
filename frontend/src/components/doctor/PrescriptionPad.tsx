import React, { useState } from 'react';
import { Leaf, Pill, X, Sparkles, FileText, CalendarDays } from 'lucide-react';
import { AllopathicMedication, AyushFormulation, AyushFormularyHit, FormularyHit, OrderSet, SafetyEvaluation, SessionDetail, TimelineEncounter } from '../../types/api';
import { DoctorRole, RxDraft } from './doctorRole';
import { MedicineSearch } from './MedicineSearch';
import { MedicineLine } from './MedicineLine';
import { DiagnosisPicker } from './DiagnosisPicker';
import { InvestigationPicker } from './InvestigationPicker';
import { SafetyPanel } from './SafetyPanel';
import { ClinicalExamPanel } from './ClinicalExamPanel';
import { OrderSetBar } from './OrderSetBar';
import { getDynamicDietaryGuidance } from '../../utils/clinicalPathya';
import { api } from '../../services/api';

export interface TranscriptSuggestions { allopathic: AllopathicMedication[]; ayush: AyushFormulation[] }

interface PrescriptionPadProps {
  role: DoctorRole;
  draft: RxDraft;
  updateDraft: (patch: Partial<RxDraft> | ((d: RxDraft) => Partial<RxDraft>)) => void;
  session: SessionDetail | null;
  safety: SafetyEvaluation;
  checking: boolean;
  canPrescribe: boolean;
  onOpenRxModal: () => void;
  onDraftNote: () => void;
  searchRef?: React.Ref<HTMLInputElement>;
  suggestions: TranscriptSuggestions | null;
  onClearSuggestions: () => void;
}

const SOURCE_LABEL: Record<string, string> = { order_set: 'from order set', favourite: 'favourite', repeat: 'repeated', dictation: 'from dictation — confirm dose', scanned_document: 'from a scanned prescription — review', reported: 'reported by patient' };

/** A numbered step of the prescription, so the pad reads in clinical order at a glance. */
const Step: React.FC<{ n: number; title: string; hint?: React.ReactNode; children: React.ReactNode; first?: boolean }> = ({ n, title, hint, children, first }) => (
  <section className={`flex flex-col gap-3 ${first ? '' : 'pt-4 border-t border-border/70'}`}>
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <h4 className="m-0 text-[13px] font-bold text-foreground flex items-center gap-2">
        <span className="h-5 w-5 rounded-full bg-foreground text-background text-[11px] font-bold inline-flex items-center justify-center">{n}</span>
        {title}
      </h4>
      {hint}
    </div>
    {children}
  </section>
);

const splitAdvice = (text: string) => text.replace(/\*/g, '').split(/[,;]|\.\s/).map(t => t.trim().replace(/\.$/, '')).filter(t => t.length > 1);

const AdviceList: React.FC<{ title: string; tone: 'good' | 'avoid'; items: string[]; onChange: (items: string[]) => void; placeholder: string }> = ({ title, tone, items, onChange, placeholder }) => {
  const [value, setValue] = useState('');
  const add = () => { const v = value.trim(); if (!v || items.some(i => i.toLowerCase() === v.toLowerCase())) return; onChange([...items, v]); setValue(''); };
  return (
    <div className="flex flex-col gap-1.5">
      <span className={`text-xs font-extrabold ${tone === 'good' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>{title}</span>
      <div className="flex flex-wrap gap-1.5 min-h-[24px]">
        {items.length === 0 && <span className="text-[11px] text-muted-foreground italic">Nothing added</span>}
        {items.map(item => (
          <span key={item} className={`pl-2.5 pr-1 py-0.5 rounded-lg text-xs border flex items-center gap-1 ${tone === 'good' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
            {item}<button type="button" onClick={() => onChange(items.filter(i => i !== item))} className="h-5 w-5 rounded flex items-center justify-center hover:bg-background/70" aria-label={`Remove ${item}`}><X size={11} /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder={placeholder} className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-border bg-background" />
        <button type="button" onClick={add} className="px-2.5 py-1 rounded-lg text-xs font-bold border border-border bg-card hover:bg-muted">Add</button>
      </div>
    </div>
  );
};

const alloFromHit = (h: FormularyHit | { generic: string; custom: true }, source?: AllopathicMedication['source']): AllopathicMedication => {
  const d = 'custom' in h ? undefined : h.defaults;
  return { name: h.generic, genericName: h.generic, dosage: d?.dosage || '', route: 'ORAL', frequency: d ? `${d.frequency}${d.food ? ` ${d.food}` : ''}` : '', durationDays: d?.durationDays || 0, source };
};
const ayushFromHit = (h: AyushFormularyHit | { name: string; custom: true }, source?: AyushFormulation['source']): AyushFormulation => {
  const d = 'custom' in h ? undefined : h.defaults;
  return { classicalName: h.name, dosageForm: 'custom' in h ? '' : h.form, dose: d?.dose || '', anupana: d?.anupana || '', frequency: d?.frequency || '', durationDays: d?.durationDays || 0, source };
};

/** The visit, in clinical order: examination and notes → diagnosis and tests → medicines → advice and follow-up. */
export const PrescriptionPad: React.FC<PrescriptionPadProps> = ({ role, draft, updateDraft, session, safety, checking, canPrescribe, onDraftNote, searchRef, suggestions, onClearSuggestions }) => {
  const isAyurveda = role === 'AYURVEDA';
  const alloOffset = 0;
  const ayushOffset = draft.allopathic.length;
  const lineAlerts = (index: number) => safety.alerts.filter(a => a.lineRefs?.includes(index) && a.tier !== 'INFO');
  const resolved = (index: number) => safety.resolvedLines.find(r => r.index === index);

  const addAllo = (m: AllopathicMedication) => updateDraft(d => (d.allopathic.some(x => x.name.toLowerCase() === m.name.toLowerCase()) ? {} : { allopathic: [...d.allopathic, m] }));
  const addAyush = (a: AyushFormulation) => updateDraft(d => (d.ayush.some(x => x.classicalName.toLowerCase() === a.classicalName.toLowerCase()) ? {} : { ayush: [...d.ayush, a] }));

  const applySet = (s: OrderSet, stepMedicines?: any[]) => {
    const meds = (stepMedicines || s.medicines).map(m => ({ ...m, source: 'order_set' as const }));
    updateDraft(d => ({
      ...(s.careStream === 'AYURVEDA'
        ? { ayush: [...d.ayush.filter(x => !meds.some((m: any) => m.classicalName?.toLowerCase() === x.classicalName.toLowerCase())), ...meds.map((m: any) => ({ classicalName: m.classicalName, dosageForm: '', dose: m.dose, anupana: m.anupana, frequency: m.frequency, durationDays: m.durationDays, source: 'order_set' as const }))] }
        : { allopathic: [...d.allopathic.filter(x => !(stepMedicines ? meds.some((m: any) => m.name?.toLowerCase() === x.name.toLowerCase()) || /amlodipine|telmisartan|chlorthalidone/i.test(x.name) : meds.some((m: any) => m.name?.toLowerCase() === x.name.toLowerCase()))), ...meds.map((m: any) => ({ name: m.name, genericName: m.name, dosage: m.dosage, route: m.route || 'ORAL', frequency: m.frequency, durationDays: m.durationDays, indication: m.indication, source: 'order_set' as const }))] }),
      advice: d.advice || s.advice || '',
      followUpDays: d.followUpDays || s.followUpDays || '',
      pathya: Array.from(new Set([...d.pathya, ...(s.pathya || [])])),
      apathya: Array.from(new Set([...d.apathya, ...(s.apathya || [])])),
      investigations: [...d.investigations, ...(s.investigations || []).filter(id => !d.investigations.some(i => i.id === id)).map(id => ({ id, display: id }))]
    }));
  };
  const repeatLast = (enc: TimelineEncounter) => {
    const meds = enc.medicines.filter(m => m.stream === role);
    updateDraft(d => role === 'AYURVEDA'
      ? { ayush: [...d.ayush, ...meds.filter(m => !d.ayush.some(x => x.classicalName.toLowerCase() === m.name.toLowerCase())).map(m => ({ classicalName: m.name, dosageForm: '', dose: m.dosage || '', anupana: m.anupana || '', frequency: m.frequency || '', durationDays: m.durationDays || 0, source: 'repeat' as const }))] }
      : { allopathic: [...d.allopathic, ...meds.filter(m => !d.allopathic.some(x => x.name.toLowerCase() === m.name.toLowerCase())).map(m => ({ name: m.name, dosage: m.dosage || '', route: 'ORAL', frequency: m.frequency || '', durationDays: m.durationDays || 0, source: 'repeat' as const }))] });
  };
  const addFavourite = (f: any) => {
    if (role === 'AYURVEDA') addAyush({ classicalName: f.classicalName, dosageForm: f.dosageForm || '', dose: f.dose || '', anupana: f.anupana || '', frequency: f.frequency || '', durationDays: f.durationDays || 0, source: 'favourite' });
    else addAllo({ name: f.name, genericName: f.genericName, dosage: f.dosage || '', route: f.route || 'ORAL', frequency: f.frequency || '', durationDays: f.durationDays || 0, indication: f.indication, source: 'favourite' });
  };
  const saveCurrent = async (name: string) => {
    await api.saveOrderSet({ name, careStream: role, medicines: role === 'AYURVEDA' ? draft.ayush : draft.allopathic, investigations: draft.investigations.map(i => i.id || i.display), advice: draft.advice, pathya: draft.pathya, apathya: draft.apathya, followUpDays: draft.followUpDays || undefined } as any);
  };

  const followUpDate = draft.followUpDays ? new Date(Date.now() + Number(draft.followUpDays) * 86400000).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : '';

  const alloSection = (secondary: boolean) => (
    <section className={`flex flex-col gap-2 ${secondary ? 'rounded-xl bg-muted/30 border border-border/70 p-3' : ''}`}>
      {secondary && <span className="text-xs font-bold text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
        <Pill size={15} /> {secondary ? 'Modern medicines the patient already takes' : 'Medicines'}
        <span className="text-[11px] font-bold px-1.5 rounded-full bg-sky-500/10">{draft.allopathic.length}</span>
      </span>}
      {secondary && <p className="text-[11px] text-muted-foreground -mt-1">Recorded so your prescription is checked against them; not prescribed here.</p>}
      <MedicineSearch ref={secondary ? undefined : searchRef} stream="ALLOPATHY" compact={secondary} placeholder={secondary ? 'Add a medicine the patient takes…' : undefined} onPickAllopathic={h => addAllo(alloFromHit(h, secondary ? 'reported' : 'doctor'))} onPickAyush={() => {}} />
      {draft.allopathic.map((m, i) => (
        <MedicineLine key={`${m.name}-${i}`} kind="allo" resolved={resolved(alloOffset + i)} alerts={lineAlerts(alloOffset + i)}
          sourceLabel={m.source ? SOURCE_LABEL[m.source] : undefined}
          fields={{ title: m.name, dose: m.dosage, frequency: m.frequency, durationDays: m.durationDays, indication: m.indication }}
          onChange={p => updateDraft(d => ({ allopathic: d.allopathic.map((x, j) => (j === i ? { ...x, ...(p.dose !== undefined ? { dosage: p.dose } : {}), ...(p.frequency !== undefined ? { frequency: p.frequency } : {}), ...(p.durationDays !== undefined ? { durationDays: p.durationDays } : {}), ...(p.indication !== undefined ? { indication: p.indication } : {}), source: x.source === 'dictation' ? 'doctor' : x.source } : x)) }))}
          onRemove={() => updateDraft(d => ({ allopathic: d.allopathic.filter((_, j) => j !== i) }))} />
      ))}
      {draft.allopathic.length === 0 && <div className={secondary ? 'text-[11px] text-muted-foreground' : 'text-center py-3 text-xs text-muted-foreground border border-dashed border-border rounded-xl'}>{secondary ? 'None recorded.' : 'No medicines yet — search above, pick an order set, or repeat the last prescription.'}</div>}
    </section>
  );

  const ayushSection = (secondary: boolean) => (
    <section className={`flex flex-col gap-2 ${secondary ? 'rounded-xl bg-muted/30 border border-border/70 p-3' : ''}`}>
      {secondary && <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
        <Leaf size={15} /> {secondary ? 'Ayurvedic / herbal medicines the patient already takes' : 'Classical formulations'}
        <span className="text-[11px] font-bold px-1.5 rounded-full bg-emerald-500/10">{draft.ayush.length}</span>
      </span>}
      {secondary && <p className="text-[11px] text-muted-foreground -mt-1">Recorded so your prescription is checked against them; not prescribed here.</p>}
      <MedicineSearch ref={secondary ? undefined : searchRef} stream="AYURVEDA" compact={secondary} placeholder={secondary ? 'Add an Ayurvedic medicine the patient takes…' : undefined} onPickAyush={h => addAyush(ayushFromHit(h, secondary ? 'reported' : 'doctor'))} onPickAllopathic={() => {}} />
      {draft.ayush.map((a, i) => (
        <MedicineLine key={`${a.classicalName}-${i}`} kind="ayush" resolved={resolved(ayushOffset + i)} alerts={lineAlerts(ayushOffset + i)}
          sourceLabel={a.source ? SOURCE_LABEL[a.source] : undefined}
          readOnlyNote={a.dosageForm || undefined}
          fields={{ title: a.classicalName, dose: a.dose, frequency: a.frequency, durationDays: a.durationDays, anupana: a.anupana }}
          onChange={p => updateDraft(d => ({ ayush: d.ayush.map((x, j) => (j === i ? { ...x, ...(p.dose !== undefined ? { dose: p.dose } : {}), ...(p.frequency !== undefined ? { frequency: p.frequency } : {}), ...(p.durationDays !== undefined ? { durationDays: p.durationDays } : {}), ...(p.anupana !== undefined ? { anupana: p.anupana } : {}) } : x)) }))}
          onRemove={() => updateDraft(d => ({ ayush: d.ayush.filter((_, j) => j !== i) }))} />
      ))}
      {draft.ayush.length === 0 && <div className={secondary ? 'text-[11px] text-muted-foreground' : 'text-center py-3 text-xs text-muted-foreground border border-dashed border-border rounded-xl'}>{secondary ? 'None recorded.' : 'No formulations yet — search above, pick an order set, or repeat the last prescription.'}</div>}
    </section>
  );

  const pendingSuggestions = suggestions && (suggestions.allopathic.length + suggestions.ayush.length) > 0;

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-4 flex flex-col gap-4">
      <Step n={1} first title="Examination & notes">
        <ClinicalExamPanel role={role} value={draft.examination} onChange={examination => updateDraft({ examination })} kioskPariksha={session?.pariksha as any} />

        <section className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">Clinical notes</span>
            <button type="button" onClick={onDraftNote} disabled={!session} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-border bg-card hover:bg-muted inline-flex items-center gap-1"><FileText size={12} /> Draft a SOAP note</button>
          </div>
          <textarea value={draft.notes} onChange={e => updateDraft({ notes: e.target.value })} rows={3} placeholder="History, examination, assessment and plan — saved in the signed record (not printed on the patient copy)." className="px-2.5 py-2 text-xs rounded-lg border border-border bg-background resize-y" />
        </section>
      </Step>
      <Step n={2} title="Diagnosis & tests">
        <DiagnosisPicker role={role} value={draft.diagnoses} onChange={diagnoses => updateDraft({ diagnoses })} suggestions={session?.provisionalDiagnoses || []} />
        <InvestigationPicker value={draft.investigations} onChange={investigations => updateDraft({ investigations })} />
      </Step>

      <Step n={3} title={isAyurveda ? 'Formulations' : 'Medicines'} hint={<span className="text-[11px] font-semibold text-muted-foreground">{(isAyurveda ? draft.ayush : draft.allopathic).length} on this prescription</span>}>
        <OrderSetBar role={role} canPrescribe={canPrescribe} lastEncounter={session?.previousEncounters?.[0]} onApplySet={applySet} onAddFavourite={addFavourite} onRepeat={repeatLast} onSaveCurrent={saveCurrent} hasItems={(isAyurveda ? draft.ayush : draft.allopathic).length > 0} />
        {pendingSuggestions && (
          <section className="rounded-xl border border-dashed border-primary/50 bg-primary/5 p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-bold text-foreground"><span className="flex items-center gap-1.5"><Sparkles size={13} className="text-primary" /> Medicines heard in the transcript — confirm each</span>
              <button type="button" onClick={onClearSuggestions} className="text-[11px] font-semibold text-muted-foreground hover:underline">Dismiss all</button></div>
            {[...suggestions!.allopathic.map(m => ({ kind: 'allo' as const, name: m.name, m })), ...suggestions!.ayush.map(a => ({ kind: 'ayush' as const, name: a.classicalName, a }))].map((s, i) => (
              <div key={`${s.name}-${i}`} className="flex items-center gap-2 flex-wrap text-xs">
                <strong className="text-foreground">{s.name}</strong>
                <button type="button" className="px-2 py-0.5 rounded border border-primary/40 font-semibold text-primary hover:bg-primary/10" onClick={() => {
                  if (s.kind === 'allo') { if (role === 'ALLOPATHY') addAllo({ ...(s as any).m, source: 'dictation' }); else addAllo({ ...(s as any).m, source: 'reported' }); }
                  else { if (role === 'AYURVEDA') addAyush({ ...(s as any).a, source: 'dictation' }); else addAyush({ ...(s as any).a, source: 'reported' }); }
                  onClearSuggestions();
                }}>{(s.kind === 'allo') === (role === 'ALLOPATHY') ? 'Prescribe' : 'Add to patient’s current medicines'}</button>
                {(s.kind === 'allo') === (role === 'ALLOPATHY') && (
                  <button type="button" className="px-2 py-0.5 rounded border border-border font-semibold hover:bg-muted" onClick={() => { if (s.kind === 'allo') addAllo({ ...(s as any).m, source: 'reported' }); else addAyush({ ...(s as any).a, source: 'reported' }); onClearSuggestions(); }}>Patient already takes it</button>
                )}
              </div>
            ))}
          </section>
        )}
        {isAyurveda ? ayushSection(false) : alloSection(false)}
        <SafetyPanel safety={safety} checking={checking} lineCount={draft.allopathic.length + draft.ayush.length} />
        {isAyurveda ? alloSection(true) : ayushSection(true)}
      </Step>

      <Step n={4} title={isAyurveda ? 'Pathya, advice & follow-up' : 'Advice & follow-up'}>
        {isAyurveda && (
          <section className="p-3.5 rounded-xl bg-muted/30 border border-border flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm font-bold text-foreground">Pathya – Apathya (diet &amp; lifestyle)</span>
              <button type="button" onClick={() => { const g = getDynamicDietaryGuidance(session, draft.ayush as any); updateDraft(d => ({ pathya: Array.from(new Set([...d.pathya, ...splitAdvice(g.pathya)])), apathya: Array.from(new Set([...d.apathya, ...splitAdvice(g.apathya)])) })); }}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-border bg-card hover:bg-muted flex items-center gap-1"><Sparkles size={12} className="text-primary" /> Suggest from prescription &amp; Prakriti</button>
            </div>
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              <AdviceList title="Pathya — recommended" tone="good" items={draft.pathya} onChange={pathya => updateDraft({ pathya })} placeholder="e.g. Warm water, moong dal soup" />
              <AdviceList title="Apathya — avoid" tone="avoid" items={draft.apathya} onChange={apathya => updateDraft({ apathya })} placeholder="e.g. Curd at night, fried food" />
            </div>
            <p className="text-[11px] text-muted-foreground m-0">Diet items are checked against the patient’s medicines too (e.g. garlic with blood thinners).</p>
          </section>
        )}

        <section className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold text-foreground">{isAyurveda ? 'Other advice (yoga, routine, therapy)' : 'Advice to patient'}</span>
            <textarea value={draft.advice} onChange={e => updateDraft({ advice: e.target.value })} rows={2}
              placeholder={isAyurveda ? 'e.g. Gentle walking 20 min daily; abhyanga with sesame oil' : 'e.g. Rest, plenty of fluids. Come back at once if breathless, drowsy or bleeding.'}
              className="px-2.5 py-2 text-xs rounded-lg border border-border bg-background resize-y" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold text-foreground flex items-center gap-1"><CalendarDays size={12} /> Follow-up after (days)</span>
            <div className="flex items-center gap-2">
              <input type="number" min={0} value={draft.followUpDays} onChange={e => updateDraft({ followUpDays: e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0) })} placeholder="e.g. 14" className="px-2.5 py-2 text-xs rounded-lg border border-border bg-background w-24" />
              {followUpDate && <span className="text-[11px] text-muted-foreground">on {followUpDate}</span>}
            </div>
          </label>
        </section>
      </Step>


    </div>
  );
};
